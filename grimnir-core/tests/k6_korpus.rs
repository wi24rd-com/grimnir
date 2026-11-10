//! K6: korpus med facit, rundtur, lækage, stabilitet og overløb.

mod faelles;

use std::collections::BTreeSet;
use std::path::PathBuf;

use faelles::korpus::{facit_tekst, korpus};
use faelles::{kaede, ordbog};
use grimnir_core::{analyser, foreslaa, masker, AdvarselArt, Pulje, Sag, Sikkerhed, Valg};

fn mappe() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests").join("korpus")
}

/// Skriver korpusset til disken. Køres kun med `cargo test -- --ignored skriv_korpus`.
#[test]
#[ignore]
fn skriv_korpus() {
    let k = korpus();
    std::fs::create_dir_all(mappe()).expect("mappe");
    for (navn, indhold) in &k.filer {
        std::fs::write(mappe().join(navn), indhold).expect("skriv");
    }
    std::fs::write(mappe().join("facit.txt"), facit_tekst(&k)).expect("skriv facit");
}

#[test]
fn korpus_paa_disken_er_generatorens() {
    let k = korpus();
    for (navn, indhold) in &k.filer {
        let disk = std::fs::read_to_string(mappe().join(navn)).unwrap_or_else(|_| panic!("{navn} mangler; kør skriv_korpus"));
        assert!(disk == *indhold, "{navn} afviger fra generatoren");
    }
    let facit = std::fs::read_to_string(mappe().join("facit.txt")).expect("facit.txt");
    assert_eq!(facit, facit_tekst(&k));
}

#[test]
fn rundtur_bytepraecis_pr_fil() {
    let o = ordbog();
    for (navn, tekst) in korpus().filer {
        let mut sag = Sag::default();
        let k = kaede(&tekst, &o, &mut sag);
        assert!(k.tilbage == tekst, "{navn}: rundturen er ikke bytepræcis");
        assert!(k.rester.is_empty(), "{navn}: lækagetjekket fandt {:?}", k.rester);
        let ukendte: Vec<_> = k.advarsler.iter().filter(|a| a.art != AdvarselArt::IkkeBrugt).collect();
        assert!(ukendte.is_empty(), "{navn}: advarsler ved uændret tekst {ukendte:?}");
    }
}

#[test]
fn ingen_facit_original_i_det_maskerede_og_alle_findes() {
    let o = ordbog();
    let k = korpus();
    let mut sag = Sag::default();
    let mut maskerede = BTreeSet::new();
    for (navn, tekst) in &k.filer {
        let fund = analyser(tekst, &o);
        let e = foreslaa(&fund, tekst, &mut sag);
        maskerede.extend(e.iter().map(|x| x.original.som_tekst().to_string()));
        let m = masker(tekst, &e);
        for f in &k.fund {
            assert!(
                !m.contains(f.as_str()),
                "{navn}: en facit-original står i det maskerede resultat (nr. {})",
                k.fund.iter().position(|x| x == f).unwrap_or(0)
            );
        }
        for f in &k.ikke_fund {
            if tekst.contains(f) {
                assert!(m.contains(f), "{navn}: ikke-fund {f:?} er ændret");
                let start = tekst.find(f).unwrap_or(0);
                let rammer = fund
                    .iter()
                    .filter(|x| x.sikkerhed != Sikkerhed::Version)
                    .any(|x| x.start < start + f.len() && start < x.slut);
                assert!(!rammer, "{navn}: ikke-fund {f:?} er et fund");
            }
        }
        for f in &k.fremmede {
            if tekst.contains(f.as_str()) {
                assert!(m.contains(f.as_str()), "{navn}: fremmed adresse maskeret uden tilvalg");
            }
        }
    }
    let mangler: Vec<&String> = k.fund.iter().filter(|f| !maskerede.contains(*f)).collect();
    assert!(mangler.is_empty(), "facit-fund, der ikke blev maskeret: {mangler:?}");
}

#[test]
fn stabil_kode_paa_tvaers_af_filer() {
    let o = ordbog();
    let k = korpus();
    let mut sag = Sag::default();
    let foerste = |sag: &mut Sag| {
        let t = &k.filer[0].1;
        masker(t, &foreslaa(&analyser(t, &o), t, sag))
    };
    let m1 = foerste(&mut sag);
    for (_, t) in &k.filer[1..] {
        let _ = masker(t, &foreslaa(&analyser(t, &o), t, &mut sag));
    }
    assert_eq!(foerste(&mut sag), m1, "samme sag giver samme koder for samme fil");
    // Og hver fil kan demaskeres med den fælles sag
    for (navn, t) in &k.filer {
        let m = masker(t, &foreslaa(&analyser(t, &o), t, &mut sag));
        assert!(grimnir_core::demasker(&m, &sag).0 == *t, "{navn}: rundtur med fælles sag");
    }
}

fn overloeb(tekst: &str, valg: Valg) -> Vec<AdvarselArt> {
    let mut sag = Sag::ny(valg);
    let k = kaede(tekst, &ordbog(), &mut sag);
    assert!(k.tilbage == tekst, "rundturen holder ikke ved overløb");
    assert!(k.rester.is_empty(), "rester ved overløb: {}", k.rester.len());
    sag.tag_advarsler().into_iter().map(|a| a.art).collect()
}

#[test]
fn overloeb_over_512_egne_net() {
    let t: String = (0..520u32).map(|i| format!("ip=10.{}.{}.7\n", 30 + i / 256, i % 256)).collect();
    assert_eq!(overloeb(&t, Valg::default()), [AdvarselArt::Overloeb(Pulje::EgneNet)]);
}

#[test]
fn overloeb_over_762_fremmede() {
    let t: String = (0..800u32).map(|i| format!("peer=100.99.{}.{}\n", i / 250, i % 250 + 1)).collect();
    assert_eq!(
        overloeb(
            &t,
            Valg {
                masker_fremmede: true,
                ..Valg::default()
            }
        ),
        [AdvarselArt::Overloeb(Pulje::Fremmede)]
    );
}

#[test]
fn overloeb_over_256_mac() {
    let t: String = (0..300u32)
        .map(|i| format!("mac=0a:1b:2c:00:{:02x}:{:02x}\n", i / 256, i % 256))
        .collect();
    assert_eq!(overloeb(&t, Valg::default()), [AdvarselArt::Overloeb(Pulje::Mac)]);
}
