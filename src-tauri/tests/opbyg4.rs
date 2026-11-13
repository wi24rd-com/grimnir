//! V-OPBYG.4 (skallen uden vindue).
//!
//! - N1: en hemmeligheds klartekst står ikke i svarene fra `analyser`, `fil_analyser` og `fil_raekker` (der ledes i hele
//!   JSON'en); `raekke_vaerdi` giver den én række ad gangen, svarer `laast`, når der er låst, og glemmer den ved en ny
//!   analyse, en åben fil og låsen. Søgningen finder ikke en skjult hemmelighed på værdien.
//!
//! - N2: en værdi, brugeren tilføjer som hemmelighed (Maskér markering), får kernens kode for hemmeligheder, står uden
//!   værdi i rækken (som en genkendt), maskeres og demaskeres, står ikke i kvitteringen; en værdi, der allerede er fundet
//!   som hemmelighed, afvises med `hemmelighed` og rækken (webvisningen kender ikke værdien).
//!
//! Tests rører aldrig Nøglering (`HukommelsesLager`, `HukommelsesDoer`). Kun opdigtede værdier (RFC 1918, opfundne navne og
//! hemmeligheder).

use std::path::PathBuf;
use std::sync::Arc;

use grimnir_lib::laas::{HukommelsesDoer, Svar, Udloeser};
use grimnir_lib::maskering::{
    analyser, analyser_med, demasker, fil_aabn, fil_analyser, fil_raekker, gem_og_masker_med, kvittering, laas_igen, laas_op, levende,
    raekke_vaerdi, Raekke, SideValg, Tilfoejet, Tilstand, UiFejl, Visning,
};
use grimnir_lib::sager::{HukommelsesLager, SagsId};

struct Mappe(PathBuf);
impl Mappe {
    fn ny() -> Self {
        let p = std::env::temp_dir().join(format!("grimnir-opbyg4-{}", SagsId::ny().unwrap().hex()));
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

/// To hemmeligheder (en adgangskode og et token med høj entropi) og almindelige fund.
const TEKST: &str = "srcip=10.20.30.11 user=\"bruger060\"\r\nServer=srv-068;Password=Sommer2026!;\r\ntoken=Zq8Xv2Lm9Pw4Rt7Yk3Nb6Hc1Jd5Fg0Qs\r\n";
const HEMMELIG: &str = "Sommer2026!";
const TOKEN: &str = "Zq8Xv2Lm9Pw4Rt7Yk3Nb6Hc1Jd5Fg0Qs";

fn json<T: serde::Serialize>(x: &T) -> String {
    serde_json::to_string(x).unwrap()
}

fn side(antal: usize, soeg: &str, vist: Vec<usize>) -> SideValg {
    SideValg {
        filter: "alle".into(),
        soeg: soeg.into(),
        vist,
        antal,
    }
}

fn hemmelige(r: &[Raekke]) -> Vec<&Raekke> {
    r.iter().filter(|r| r.hemmelig).collect()
}

#[test]
fn n1_analysens_svar_har_ingen_hemmelighed_i_klartekst() {
    let t = Tilstand::ny();
    let a = analyser(&t, TEKST, None, &[]).unwrap();
    let j = json(&a);
    assert!(!j.contains(HEMMELIG) && !j.contains(TOKEN), "en hemmelighed står i svaret");
    let h = hemmelige(&a.raekker);
    assert_eq!(h.len(), 2, "to hemmeligheder");
    assert!(h.iter().all(|r| r.vaerdier.is_empty() && !r.koder.is_empty()), "uden værdi, men med kode");
    // De andre rækker har deres værdier som før.
    assert!(a.raekker.iter().any(|r| r.vaerdier == ["10.20.30.11"]));
    // Vis: én række ad gangen.
    let mut set: Vec<String> = h.iter().map(|r| raekke_vaerdi(&t, false, r.id).unwrap().vaerdier.join("|")).collect();
    set.sort();
    assert_eq!(set, [HEMMELIG, TOKEN]);
    // Kun hemmeligheder: en almindelig række og et ukendt id giver ingen værdi.
    let ip = a.raekker.iter().find(|r| !r.hemmelig).unwrap();
    assert_eq!(raekke_vaerdi(&t, false, ip.id).err(), Some(UiFejl::UkendtRaekke));
    assert_eq!(raekke_vaerdi(&t, false, 999_999).err(), Some(UiFejl::UkendtRaekke));
    // Svaret fra raekke_vaerdi som JSON er id og værdierne.
    let v = raekke_vaerdi(&t, false, h[0].id).unwrap();
    assert_eq!(serde_json::to_value(&v).unwrap()["id"], h[0].id);
}

#[test]
fn n1_en_ny_analyse_erstatter_de_holdte_hemmeligheder() {
    let t = Tilstand::ny();
    let a = analyser(&t, TEKST, None, &[]).unwrap();
    let id = hemmelige(&a.raekker)[0].id;
    assert!(raekke_vaerdi(&t, false, id).is_ok());
    // En anden tekst uden hemmeligheder: den gamle række findes ikke længere.
    analyser(&t, "srcip=10.20.30.12 ok\n", None, &[]).unwrap();
    assert_eq!(raekke_vaerdi(&t, false, id).err(), Some(UiFejl::UkendtRaekke));
    assert_eq!(levende(&t).hemmelige, 0);
}

#[test]
fn n1_filens_svar_har_ingen_hemmelighed_i_klartekst_og_vis_henter_den() {
    let m = Mappe::ny();
    let t = program(&m);
    fil_aabn(&t, Visning::Masker, &m.fil("app.log", TEKST)).unwrap();
    let a = fil_analyser(&t, None, None, &[], &side(500, "", vec![])).unwrap();
    let j = json(&a);
    assert!(!j.contains(HEMMELIG) && !j.contains(TOKEN), "en hemmelighed står i fil_analyser");
    let ider: Vec<usize> = hemmelige(&a.side.raekker).iter().map(|r| r.id).collect();
    assert_eq!(ider.len(), 2);
    // Også når brugeren har valgt Vis (vist) og søger: rækkerne er uden værdi.
    let s = fil_raekker(&t, &side(500, "", ider.clone())).unwrap();
    let j = json(&s);
    assert!(!j.contains(HEMMELIG) && !j.contains(TOKEN), "en hemmelighed står i fil_raekker");
    // Søgning: en skjult hemmelighed findes ikke på værdien; en vist findes (søgningen sker i Rust).
    assert_eq!(fil_raekker(&t, &side(500, "sommer2026", vec![])).unwrap().i_alt, 0);
    let vist = fil_raekker(&t, &side(500, "sommer2026", ider.clone())).unwrap();
    assert_eq!(vist.i_alt, 1);
    assert!(!json(&vist).contains(HEMMELIG));
    // Vis for filen.
    let mut set: Vec<String> = ider.iter().map(|id| raekke_vaerdi(&t, true, *id).unwrap().vaerdier.join("|")).collect();
    set.sort();
    assert_eq!(set, [HEMMELIG, TOKEN]);
    // Den indsatte teksts hemmeligheder er ikke filens.
    assert_eq!(raekke_vaerdi(&t, false, ider[0]).err(), Some(UiFejl::UkendtRaekke));
}

#[test]
fn n1_en_aaben_fil_slipper_den_indsatte_teksts_hemmeligheder() {
    let m = Mappe::ny();
    let t = program(&m);
    analyser(&t, TEKST, None, &[]).unwrap();
    assert_eq!(levende(&t).hemmelige, 2);
    fil_aabn(&t, Visning::Masker, &m.fil("a.log", "srcip=10.20.30.12\n")).unwrap();
    assert_eq!(levende(&t).hemmelige, 0);
}

#[test]
fn n1_laast_svarer_laast_og_laasen_glemmer_vaerdierne() {
    let m = Mappe::ny();
    let t = program(&m);
    let a = analyser(&t, TEKST, None, &[]).unwrap();
    let id = hemmelige(&a.raekker)[0].id;
    fil_aabn(&t, Visning::Masker, &m.fil("app.log", TEKST)).unwrap();
    fil_analyser(&t, None, None, &[], &side(10, "", vec![])).unwrap();
    assert_eq!(levende(&t).hemmelige, 0, "filen tog over");
    analyser(&t, TEKST, None, &[]).unwrap();
    assert_eq!(levende(&t).hemmelige, 2);
    assert!(laas_igen(&t, Udloeser::Dvale));
    assert_eq!(raekke_vaerdi(&t, false, id).err(), Some(UiFejl::Laast));
    assert_eq!(raekke_vaerdi(&t, true, id).err(), Some(UiFejl::Laast));
    assert_eq!(levende(&t).hemmelige, 0, "låsen glemmer hemmelighederne");
    assert_eq!(levende(&t).filer, 0);
    // Efter oplåsningen er værdien væk (den hentes ikke fra noget andet sted).
    assert_eq!(laas_op(&t, &HukommelsesDoer::ny(Svar::Ok), "da").svar, Svar::Ok);
    assert_eq!(raekke_vaerdi(&t, false, id).err(), Some(UiFejl::UkendtRaekke));
    assert_eq!(raekke_vaerdi(&t, true, id).err(), Some(UiFejl::IngenFil));
}

/// Kilden: svartypen har ingen `Debug`, værdierne nulstilles ved `Drop`, porten tjekkes før og efter, og intet skrives
/// til log eller konsol i kommandoen.
#[test]
fn n1_svartypen_uden_debug_nulstilles_og_porten_tjekkes_igen() {
    let kilde = std::fs::read_to_string(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("src/maskering.rs")).unwrap();
    let i = kilde.find("pub struct RaekkeVaerdi").unwrap();
    let foer = &kilde[kilde[..i].rfind("#[derive").unwrap()..i];
    assert!(!foer.contains("Debug"), "RaekkeVaerdi må ikke have Debug: {foer}");
    assert!(kilde.contains("impl Drop for RaekkeVaerdi"));
    let s = kilde.find("pub fn raekke_vaerdi").unwrap();
    let krop = &kilde[s..s + kilde[s..].find("\n}\n").unwrap()];
    assert_eq!(krop.matches("t.aaben()?").count(), 2, "porten før og efter: {krop}");
    for ord in ["println", "eprintln", "dbg!", "log::"] {
        assert!(!krop.contains(ord), "{ord} i raekke_vaerdi");
    }
    let lib = std::fs::read_to_string(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("src/lib.rs")).unwrap();
    assert!(lib.contains("        raekke_vaerdi\n    ]);"));
    let build = std::fs::read_to_string(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("build.rs")).unwrap();
    assert!(build.contains("\"raekke_vaerdi\""));
    let cap = std::fs::read_to_string(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("capabilities/default.json")).unwrap();
    assert!(cap.contains("\"allow-raekke-vaerdi\""));
}

// ─────────────────────────────────────────────────────────────── N2

fn tf(v: &str, art: &str) -> Tilfoejet {
    Tilfoejet {
        vaerdi: v.into(),
        art: art.into(),
    }
}

const EGEN: &str = "Fjeld-Ravn-77";

#[test]
fn n2_en_tilfoejet_hemmelighed_er_skjult_maskeres_og_staar_ikke_i_kvitteringen() {
    let t = Tilstand::ny();
    let tekst = format!("{TEKST}nøglen {EGEN} virker; {EGEN} igen\r\n");
    let liste = [tf(EGEN, "hemmelighed")];
    let a = analyser_med(&t, &tekst, None, &[], &liste).unwrap();
    assert!(!json(&a).contains(EGEN), "den tilføjede hemmelighed står i analysens svar");
    let x = &a.tilfoejede[0];
    assert_eq!((x.afvist, x.antal), (None, 2));
    let r = a.raekker.iter().find(|r| Some(r.id) == x.raekke).expect("en række");
    assert_eq!((r.art, r.hemmelig, r.tilfoejet), ("hemmelighed", true, Some(0)));
    assert!(r.vaerdier.is_empty() && r.koder.iter().all(|k| k.starts_with("GRIMNIR_SECRET_")), "{:?}", r.koder);
    assert_eq!(raekke_vaerdi(&t, false, r.id).unwrap().vaerdier, [EGEN]);
    let fravalgt: Vec<usize> = a.raekker.iter().filter(|r| !r.valgt).map(|r| r.id).collect();
    let m = gem_og_masker_med(&t, &tekst, &fravalgt, &[], &liste).unwrap();
    assert!(!m.maskeret.contains(EGEN), "{}", m.maskeret);
    assert!(m.rester.is_empty());
    let mut j = serde_json::to_value(&m).unwrap();
    j.as_object_mut().unwrap().remove("maskeret");
    assert!(!j.to_string().contains(EGEN));
    for sprog in ["da", "en"] {
        let k = kvittering(&t, false, sprog).unwrap();
        assert!(!k.contains(EGEN) && !k.contains(HEMMELIG) && !k.contains("GRIMNIR_SECRET"), "{k}");
    }
    assert_eq!(demasker(&t, &m.maskeret).unwrap().tekst, tekst);
}

#[test]
fn n2_en_vaerdi_der_allerede_er_en_hemmelighed_afvises_med_raekken() {
    let t = Tilstand::ny();
    let a0 = analyser(&t, TEKST, None, &[]).unwrap();
    let liste = [tf(HEMMELIG, "ord")];
    let a = analyser_med(&t, TEKST, None, &[], &liste).unwrap();
    assert!(!json(&a).contains(HEMMELIG));
    let x = &a.tilfoejede[0];
    assert_eq!(x.afvist, Some("hemmelighed"));
    let r = a.raekker.iter().find(|r| Some(r.id) == x.raekke).expect("hemmelighedens række");
    assert!(r.hemmelig && r.tilfoejet.is_none(), "rækken er stadig Grimnirs egen hemmelighed");
    assert_eq!(raekke_vaerdi(&t, false, r.id).unwrap().vaerdier, [HEMMELIG]);
    // Rækkerne er de samme som uden den tilføjede værdi.
    let ider = |a: &[Raekke]| a.iter().map(|r| (r.id, r.art)).collect::<Vec<_>>();
    assert_eq!(ider(&a.raekker), ider(&a0.raekker));
}
