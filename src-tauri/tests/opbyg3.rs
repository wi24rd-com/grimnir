//! V-OPBYG.3 (skallen uden vindue).
//!
//! - N4: stederne for en åben fil kommer fra Rust: `fil_analyser` giver hver forekomst i det viste uddrag (UTF-16,
//!   sorteret) og for hver række bag dem, om den er "Tjek selv", og om den er låst (`sted_raekker`, ingen værdier), også
//!   når siden kun har få rækker; `fil_gem_og_masker` giver kodernes steder i det maskerede uddrag; kun steder i uddraget.
//!
//! Tests rører aldrig Nøglering (`HukommelsesLager`). Kun opdigtede værdier (`kontor.test`, RFC 1918, opfundne navne).

use std::path::PathBuf;
use std::sync::Arc;

use grimnir_lib::maskering::{fil_aabn, fil_analyser, fil_gem_og_masker, fil_raekker, SideValg, Tilstand, Visning, MAKS_VIST_UTF16};
use grimnir_lib::sager::{HukommelsesLager, SagsId};

struct Mappe(PathBuf);
impl Mappe {
    fn ny() -> Self {
        let p = std::env::temp_dir().join(format!("grimnir-opbyg3-{}", SagsId::ny().unwrap().hex()));
        std::fs::create_dir_all(&p).unwrap();
        Mappe(p)
    }
    fn fil(&self, navn: &str, tekst: &str) -> PathBuf {
        let p = self.0.join(navn);
        std::fs::write(&p, tekst).unwrap();
        p
    }
}
impl Drop for Mappe {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}

fn program(m: &Mappe) -> Tilstand {
    Tilstand::paa_disk(m.0.clone(), Arc::new(HukommelsesLager::ny()))
}

fn side(antal: usize) -> SideValg {
    SideValg {
        antal,
        ..SideValg::default()
    }
}

/// Tegn uden for BMP og æøå før værdierne, så byte-, tegn- og UTF-16-positioner er forskellige; en adresse i kodernes
/// område (198.18.0.0/15) er "Tjek selv" (ligner en kode).
const FIL: &str = "🙂 æøå srv-web01.kontor.test 10.20.0.5\r\n🙂🙂 bruger=anders.eksempel srv-web01.kontor.test\nfra 198.18.0.77 ok\n";

#[test]
fn n4_filens_steder_er_utf16_i_uddraget_og_passer_til_vaerdierne() {
    let m = Mappe::ny();
    let t = program(&m);
    let info = fil_aabn(&t, Visning::Masker, &m.fil("app.log", FIL)).unwrap();
    let u16: Vec<u16> = info.uddrag.encode_utf16().collect();
    // Én række på siden; stederne gælder alle rækker.
    let a = fil_analyser(&t, None, None, &[], &side(1)).unwrap();
    assert_eq!(a.side.raekker.len(), 1);
    let alle = fil_raekker(&t, &side(1000)).unwrap().raekker;
    assert!(alle.len() > 1, "{}", alle.len());
    assert!(!a.steder.is_empty());
    assert!(a.steder.windows(2).all(|w| w[0] <= w[1]), "sorteret");
    for r in &alle {
        let mine: Vec<_> = a.steder.iter().filter(|s| s.2 == r.id).collect();
        assert_eq!(mine.len(), r.antal, "rækkens steder er dens antal: {}", r.art);
        for (s, e, _) in mine {
            let v = String::from_utf16(&u16[*s..*e]).unwrap();
            assert!(r.vaerdier.contains(&v), "{v:?} er en af rækkens værdier");
        }
    }
    // sted_raekker: hver række bag et sted præcis én gang, med status og lås som rækken.
    let ider: std::collections::BTreeSet<usize> = a.steder.iter().map(|s| s.2).collect();
    assert_eq!(a.sted_raekker.iter().map(|x| x.0).collect::<std::collections::BTreeSet<_>>(), ider);
    assert_eq!(a.sted_raekker.len(), ider.len());
    for (id, tjek, laast) in &a.sted_raekker {
        let r = alle.iter().find(|r| r.id == *id).unwrap();
        assert_eq!((*tjek, *laast), (r.status == "tjek", r.laast), "{}", r.art);
    }
    assert!(a.sted_raekker.iter().any(|x| x.1), "der er et usikkert fund (198.18.0.77)");
}

#[test]
fn n4_filens_svar_har_ingen_vaerdier_ud_over_sidens_raekker() {
    let m = Mappe::ny();
    let t = program(&m);
    fil_aabn(&t, Visning::Masker, &m.fil("app.log", FIL)).unwrap();
    let a = fil_analyser(&t, None, None, &[], &side(1)).unwrap();
    let alle = fil_raekker(&t, &side(1000)).unwrap().raekker;
    let paa_siden = &a.side.raekker[0];
    let mut json = serde_json::to_value(&a).unwrap();
    // Uden siden: steder og sted_raekker er kun tal og sandhedsværdier, og ingen værdi fra en anden række står i svaret.
    json.as_object_mut().unwrap().remove("side");
    let tekst = json.to_string();
    assert!(json["steder"]
        .as_array()
        .unwrap()
        .iter()
        .flat_map(|x| x.as_array().unwrap())
        .all(|x| x.is_u64()));
    assert!(json["sted_raekker"].as_array().unwrap().iter().all(|x| {
        let x = x.as_array().unwrap();
        x.len() == 3 && x[0].is_u64() && x[1].is_boolean() && x[2].is_boolean()
    }));
    for r in alle.iter().filter(|r| r.id != paa_siden.id) {
        for v in &r.vaerdier {
            assert!(!tekst.contains(v.as_str()), "{v:?} står i svaret uden for siden");
        }
    }
}

#[test]
fn n4_kodernes_steder_i_den_maskerede_fil() {
    let m = Mappe::ny();
    let t = program(&m);
    fil_aabn(&t, Visning::Masker, &m.fil("app.log", FIL)).unwrap();
    let a = fil_analyser(&t, None, None, &[], &side(1000)).unwrap();
    let mk = fil_gem_og_masker(&t, &a.fravalgt, &[]).unwrap();
    let mu: Vec<u16> = mk.uddrag.encode_utf16().collect();
    let valgte: Vec<_> = a.side.raekker.iter().filter(|r| r.valgt).collect();
    assert_eq!(mk.steder.len(), valgte.iter().map(|r| r.antal).sum::<usize>());
    for (s, e, id) in &mk.steder {
        let k = String::from_utf16(&mu[*s..*e]).unwrap();
        let r = valgte.iter().find(|r| r.id == *id).expect("en valgt række");
        assert!(r.koder.contains(&k), "{k:?} er rækkens kode");
    }
}

#[test]
fn n4_kun_steder_i_det_viste_uddrag() {
    let m = Mappe::ny();
    let t = program(&m);
    let linje = "ACCEPT src=10.20.0.5 dst=srv-web01.kontor.test ø\n";
    let n = MAKS_VIST_UTF16 / linje.encode_utf16().count() + 50;
    // En værdi, der kun står efter uddraget: dens række har intet sted, så den er heller ikke i sted_raekker.
    let tekst = format!("{}login fra 10.20.9.99\n", linje.repeat(n));
    let info = fil_aabn(&t, Visning::Masker, &m.fil("stor.log", &tekst)).unwrap();
    assert!(info.ikke_vist > 0);
    let laengde = info.uddrag.encode_utf16().count();
    let a = fil_analyser(&t, None, None, &[], &side(10)).unwrap();
    let raekker = fil_raekker(&t, &side(1000)).unwrap().raekker;
    let alle: usize = raekker.iter().map(|r| r.antal).sum();
    assert!(a.steder.len() < alle, "{} < {alle}", a.steder.len());
    let bagved = raekker
        .iter()
        .find(|r| r.vaerdier.iter().any(|v| v == "10.20.9.99"))
        .expect("rækken efter uddraget");
    assert!(!a.steder.iter().any(|s| s.2 == bagved.id) && !a.sted_raekker.iter().any(|x| x.0 == bagved.id));
    assert_eq!(a.sted_raekker.len(), raekker.len() - 1);
    assert!(a.steder.iter().all(|s| s.0 < MAKS_VIST_UTF16 && s.1 <= laengde));
    assert!(a.steder.last().unwrap().0 > MAKS_VIST_UTF16 - 2 * linje.len());
    let mk = fil_gem_og_masker(&t, &a.fravalgt, &[]).unwrap();
    let ml = mk.uddrag.encode_utf16().count();
    assert!(!mk.steder.is_empty() && mk.steder.iter().all(|s| s.0 < MAKS_VIST_UTF16 && s.1 <= ml));
}
