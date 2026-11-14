//! V-OPBYG.6 (skallen uden vindue).
//!
//! - N1: Maskér markering i en åben fil. Webvisningen sender stedet i det viste uddrag (UTF-16) og typen, aldrig teksten
//!   (`fil_marker`); Rust slår værdien op i filens tekst og husker den i filen. Analysen og maskeringen tager den med for
//!   hele filen (også efter uddraget) ud fra pladsen (`fil_analyser_med`, `fil_gem_og_masker_med`). Afvisningerne er
//!   de samme som for indsat tekst, plus et sted midt i et tegn eller uden for uddraget. En hemmelighed står ikke i
//!   svarene; Vis henter den. Låst: `laast`; låsen, `fil_luk` og en ny fil glemmer værdierne.
//!
//! - N3: det, Rust selv lægger i udklipsholderen (Kopiér værdi for en skjult hemmelighed), får fortroligt-mærket fra
//!   nspasteboard.org (`org.nspasteboard.ConcealedType`) og kilden (`org.nspasteboard.source`) på samme element som
//!   teksten, der stadig er almindelig tekst. Lås og afslutning rydder som før (D21). Det, webvisningen kopierer, får
//!   intet mærke (den kan ikke). macOS-udgaven oversættes kun; testene bruger den efterlignede udklipsholder, der husker
//!   typerne.
//!
//! Tests rører aldrig Nøglering (`HukommelsesLager`, `HukommelsesDoer`) og aldrig den rigtige udklipsholder. Kun
//! opdigtede værdier (RFC 1918, opfundne navne og hemmeligheder).

use std::path::PathBuf;
use std::sync::Arc;

use grimnir_lib::laas::{HukommelsesDoer, Svar, Udloeser};
use grimnir_lib::maskering::{analyser, sag_indhold, sag_post_kopier, udklip_vaerdi_kopieret, ved_afslut, IndholdValg, SagPost};
use grimnir_lib::maskering::{
    analyser_med, fil_aabn, fil_analyser, fil_analyser_med, fil_gem_og_masker_med, fil_kopi, fil_luk, fil_marker, gem_og_masker,
    kvittering, laas_igen, laas_op, levende, ordbog_tilfoej, raekke_vaerdi, FilAnalyse, FilMarkering, FilTilfoejet, Raekke, SideValg,
    Tilfoejet, Tilstand, UiFejl, Visning,
};
use grimnir_lib::sager::{HukommelsesLager, SagsId};
use grimnir_lib::udklip::{HukommelsesUdklip, BUNDLE_ID, FORTROLIG, KILDE, TEKST_TYPE};

struct Mappe(PathBuf);
impl Mappe {
    fn ny() -> Self {
        let p = std::env::temp_dir().join(format!("grimnir-opbyg6-{}", SagsId::ny().unwrap().hex()));
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

fn json<T: serde::Serialize>(x: &T) -> String {
    serde_json::to_string(x).unwrap()
}

fn side(antal: usize) -> SideValg {
    SideValg {
        filter: "alle".into(),
        soeg: String::new(),
        vist: vec![],
        antal,
    }
}

/// Stedet for `del` i `tekst` som (start, længde) i UTF-16-enheder (som webvisningens markering).
fn sted(tekst: &str, del: &str) -> (usize, usize) {
    let i = tekst.find(del).unwrap();
    (tekst[..i].encode_utf16().count(), del.encode_utf16().count())
}

fn tf(tid: usize, art: &str) -> FilTilfoejet {
    FilTilfoejet { tid, art: art.into() }
}

fn marker(t: &Tilstand, tekst: &str, del: &str, art: &str) -> FilMarkering {
    let (s, l) = sted(tekst, del);
    fil_marker(t, s, l, art).unwrap()
}

fn raekke_med<'a>(a: &'a FilAnalyse, v: &str) -> Option<&'a Raekke> {
    a.side.raekker.iter().find(|r| r.vaerdier.iter().any(|x| x == v))
}

/// En værdi med æøå efter et emoji i første linje, fyld over 200.000 tegn og værdien igen efter uddraget.
const VAERDI: &str = "Blåbær-Øst-7";
fn stor_tekst() -> String {
    format!(
        "kunde 😀 æøå {VAERDI} svarede srcip=10.20.30.11\r\nServer=srv-068;Password=Sommer2026!;\r\n{}igen {VAERDI} til sidst\r\n",
        "linje med fyld uden fund\r\n".repeat(8000)
    )
}
const HEMMELIG: &str = "Sommer2026!";

// ─────────────────────────────────────────────────────────────── N1

#[test]
fn n1_stedet_i_utf16_bliver_til_vaerdien_og_raekken_gaelder_hele_filen() {
    let m = Mappe::ny();
    let t = program(&m);
    let tekst = stor_tekst();
    let info = fil_aabn(&t, Visning::Masker, &m.fil("app.log", &tekst)).unwrap();
    assert!(info.ikke_vist > 0, "værdien står igen efter uddraget");
    let a0 = fil_analyser(&t, None, None, &[], &side(500)).unwrap();
    assert!(raekke_med(&a0, VAERDI).is_none(), "værdien er ikke et fund i forvejen");
    // Stedet efter et emoji (to UTF-16-enheder) og æøå (én hver).
    let mk = marker(&t, &tekst, VAERDI, "ord");
    assert_eq!(mk.afvist, None);
    assert_eq!(mk.tid, Some(0));
    assert!(!json(&mk).contains(VAERDI), "svaret har aldrig værdien");
    assert_eq!(levende(&t).fil_tilfoejede, 1);
    let a = fil_analyser_med(&t, None, None, &[], &side(500), &[tf(0, "ord")]).unwrap();
    let r = raekke_med(&a, VAERDI).expect("en række for den markerede værdi");
    assert_eq!(r.tilfoejet, Some(0));
    assert_eq!(r.antal, 2, "også stedet efter uddraget");
    assert!(r.valgt, "maskeres");
    assert_eq!(a.tilfoejede.len(), 1);
    assert_eq!(
        (a.tilfoejede[0].raekke, a.tilfoejede[0].antal, a.tilfoejede[0].afvist),
        (Some(r.id), 2, None)
    );
    // Markeringen i teksten: stederne har rækken med det samme.
    assert!(a.steder.iter().any(|s| s.2 == r.id));
    assert!(a.sted_raekker.iter().any(|s| s.0 == r.id));
    // Maskeringen: værdien står ingen steder i resultatet, heller ikke efter uddraget; kvitteringen nævner den ikke.
    let fm = fil_gem_og_masker_med(&t, &a.fravalgt, &[], &[tf(0, "ord")]).unwrap();
    assert!(!fm.uddrag.contains(VAERDI));
    let hele = fil_kopi(&t, Visning::Masker).unwrap();
    assert!(!hele.contains(VAERDI), "værdien er maskeret i hele filen");
    assert!(hele.contains("igen ") && hele.ends_with(" til sidst\r\n"));
    assert!(!kvittering(&t, true, "da").unwrap().contains(VAERDI));
}

#[test]
fn n1_samme_vaerdi_med_andre_store_bogstaver_faar_samme_plads() {
    let m = Mappe::ny();
    let t = program(&m);
    let tekst = "ref Kunde-Alfa ok\nREF KUNDE-ALFA ok\nref kunde-beta ok\n";
    fil_aabn(&t, Visning::Masker, &m.fil("a.log", tekst)).unwrap();
    assert_eq!(marker(&t, tekst, "Kunde-Alfa", "ord").tid, Some(0));
    assert_eq!(marker(&t, tekst, "KUNDE-ALFA", "person").tid, Some(0));
    assert_eq!(marker(&t, tekst, "kunde-beta", "ord").tid, Some(1));
    // Mellemrum i enderne skæres af.
    let (s, l) = sted(tekst, " kunde-beta ");
    assert_eq!(fil_marker(&t, s, l, "ord").unwrap().tid, Some(1));
    assert_eq!(levende(&t).fil_tilfoejede, 2);
}

#[test]
fn n1_et_ugyldigt_sted_afvises_med_en_grund() {
    let m = Mappe::ny();
    let t = program(&m);
    let tekst = stor_tekst();
    fil_aabn(&t, Visning::Masker, &m.fil("app.log", &tekst)).unwrap();
    let (e, _) = sted(&tekst, "😀");
    let grund = |s, l, art: &str| fil_marker(&t, s, l, art).unwrap().afvist;
    assert_eq!(grund(e + 1, 3, "ord"), Some("midt_i_tegn"), "start midt i emojiet");
    assert_eq!(grund(e - 2, 3, "ord"), Some("midt_i_tegn"), "slut midt i emojiet");
    assert_eq!(grund(0, 0, "ord"), Some("tom"));
    let (mel, _) = sted(&tekst, " 😀 ");
    assert_eq!(grund(mel, 1, "ord"), Some("tom"), "kun mellemrum");
    let (lin, _) = sted(&tekst, "10.20.30.11\r\nServer");
    assert_eq!(grund(lin + 5, 12, "ord"), Some("linjeskift"));
    let uddrag16: usize = tekst.chars().take(200_000).map(char::len_utf16).sum();
    assert_eq!(grund(uddrag16 - 1, 2, "ord"), Some("uden_for"), "ud over uddraget");
    assert_eq!(grund(uddrag16 + 10, 3, "ord"), Some("uden_for"), "efter uddraget");
    let (v, l) = sted(&tekst, VAERDI);
    assert_eq!(grund(v, l, "vaabenart"), Some("type"));
    assert_eq!(grund(v, l, "version"), Some("type"), "en art, der ikke kan tilføjes");
    // Intet afvist er husket.
    assert_eq!(levende(&t).fil_tilfoejede, 0);
    // Et helt emoji (begge halvdele) er et gyldigt sted.
    assert_eq!(grund(e, 2, "ord"), None);
    assert_eq!(levende(&t).fil_tilfoejede, 1);
    // Uden fil: IngenFil.
    fil_luk(&t, Visning::Masker).unwrap();
    assert_eq!(fil_marker(&t, 0, 1, "ord").err(), Some(UiFejl::IngenFil));
}

#[test]
fn n1_samme_afvisninger_som_for_indsat_tekst() {
    let m = Mappe::ny();
    let t = program(&m);
    let tekst = stor_tekst();
    fil_aabn(&t, Visning::Masker, &m.fil("app.log", &tekst)).unwrap();
    let a = fil_analyser(&t, None, None, &[], &side(500)).unwrap();
    // Allerede et fund: rækken gives, så webvisningen kan vælge den og slå den til.
    let ip = raekke_med(&a, "10.20.30.11").unwrap().id;
    let mk = marker(&t, &tekst, "10.20.30.11", "ord");
    assert_eq!((mk.afvist, mk.raekke, mk.tid), (Some("findes"), Some(ip), None));
    // Allerede en hemmelighed: som en anden type afvises den med rækken og linjen (aldrig værdien); som hemmelighed er den
    // allerede et fund.
    let hem = a.side.raekker.iter().find(|r| r.hemmelig).unwrap();
    let mk = marker(&t, &tekst, HEMMELIG, "ord");
    assert_eq!(
        (mk.afvist, mk.raekke, mk.linje, mk.hemmelig),
        (Some("hemmelighed"), Some(hem.id), Some(hem.linje), true)
    );
    assert!(!json(&mk).contains(HEMMELIG));
    assert_eq!(marker(&t, &tekst, HEMMELIG, "hemmelighed").afvist, Some("findes"));
    assert_eq!(levende(&t).fil_tilfoejede, 0);
    // "Maskér aldrig" vinder: analysen afviser den som for indsat tekst.
    ordbog_tilfoej(&t, "aldrig", VAERDI, None).unwrap();
    let mk = marker(&t, &tekst, VAERDI, "ord");
    let a = fil_analyser_med(&t, None, None, &[], &side(500), &[tf(mk.tid.unwrap(), "ord")]).unwrap();
    assert_eq!(a.tilfoejede[0].afvist, Some("aldrig"));
    assert!(raekke_med(&a, VAERDI).is_none());
}

#[test]
fn n1_en_kode_i_sagen_afvises() {
    let m = Mappe::ny();
    let t = program(&m);
    let mk = gem_og_masker(&t, "srcip=10.20.30.11 ok\n", &[], &[]).unwrap();
    let kode = mk.maskeret["srcip=".len()..].split_whitespace().next().unwrap().to_string();
    assert_ne!(kode, "10.20.30.11");
    let tekst = format!("svar fra {kode} kom\n");
    fil_aabn(&t, Visning::Masker, &m.fil("svar.log", &tekst)).unwrap();
    // Før en analyse (ingen rækker) og efter (koden er en låst række).
    assert_eq!(marker(&t, &tekst, &kode, "ord").afvist, Some("kode"));
    fil_analyser(&t, None, None, &[], &side(500)).unwrap();
    assert_eq!(marker(&t, &tekst, &kode, "ord").afvist, Some("kode"));
}

#[test]
fn n1_en_hemmelighed_staar_ikke_i_svarene_og_vis_henter_den() {
    let m = Mappe::ny();
    let t = program(&m);
    let tekst = stor_tekst();
    fil_aabn(&t, Visning::Masker, &m.fil("app.log", &tekst)).unwrap();
    let mk = marker(&t, &tekst, VAERDI, "hemmelighed");
    let a = fil_analyser_med(&t, None, None, &[], &side(500), &[tf(mk.tid.unwrap(), "hemmelighed")]).unwrap();
    let j = json(&a);
    assert!(!j.contains(VAERDI) && !j.contains(HEMMELIG), "en hemmelighed står i fil_analyser");
    let r = a.side.raekker.iter().find(|r| r.tilfoejet == Some(0)).unwrap();
    assert!(r.hemmelig && r.vaerdier.is_empty() && r.valgt);
    assert_eq!(r.antal, 2);
    assert_eq!(raekke_vaerdi(&t, true, r.id).unwrap().vaerdier, vec![VAERDI.to_string()]);
    let fm = fil_gem_og_masker_med(&t, &a.fravalgt, &[], &[tf(0, "hemmelighed")]).unwrap();
    assert!(!json(&fm).contains(VAERDI));
    assert!(!fil_kopi(&t, Visning::Masker).unwrap().contains(VAERDI));
}

/// Fortryd/Gentag og Fjern sker i webvisningen: den sender listen uden pladsen (Fortryd, Fjern) og med den igen (Gentag).
/// Rust svarer som for indsat tekst: rækken forsvinder og kommer igen med samme id; en plads, filen ikke har, afvises.
#[test]
fn n1_fortryd_og_fjern_er_listen_uden_pladsen() {
    let m = Mappe::ny();
    let t = program(&m);
    let tekst = stor_tekst();
    fil_aabn(&t, Visning::Masker, &m.fil("app.log", &tekst)).unwrap();
    let tid = marker(&t, &tekst, VAERDI, "ord").tid.unwrap();
    let med = fil_analyser_med(&t, None, None, &[], &side(500), &[tf(tid, "ord")]).unwrap();
    let id = raekke_med(&med, VAERDI).unwrap().id;
    let uden = fil_analyser_med(&t, None, None, &[], &side(500), &[]).unwrap();
    assert!(raekke_med(&uden, VAERDI).is_none(), "Fortryd: rækken er væk");
    assert_eq!(uden.side.i_alt + 1, med.side.i_alt);
    let igen = fil_analyser_med(&t, None, None, &[], &side(500), &[tf(tid, "person")]).unwrap();
    let r = raekke_med(&igen, VAERDI).unwrap();
    assert_eq!((r.id, r.art), (id, "person"), "Gentag (og en ny type): samme række");
    assert_eq!(
        fil_analyser_med(&t, None, None, &[], &side(500), &[tf(7, "ord")]).err(),
        Some(UiFejl::UkendtRaekke)
    );
    assert_eq!(
        fil_gem_og_masker_med(&t, &[], &[], &[tf(7, "ord")]).err(),
        Some(UiFejl::UkendtRaekke)
    );
}

#[test]
fn n1_luk_en_ny_fil_og_en_indsat_tekst_glemmer_vaerdierne() {
    let m = Mappe::ny();
    let t = program(&m);
    let tekst = stor_tekst();
    let sti = m.fil("app.log", &tekst);
    fil_aabn(&t, Visning::Masker, &sti).unwrap();
    marker(&t, &tekst, VAERDI, "ord");
    assert_eq!(levende(&t).fil_tilfoejede, 1);
    fil_luk(&t, Visning::Masker).unwrap();
    assert_eq!(levende(&t).fil_tilfoejede, 0);
    fil_aabn(&t, Visning::Masker, &sti).unwrap();
    marker(&t, &tekst, VAERDI, "ord");
    fil_aabn(&t, Visning::Masker, &m.fil("b.log", "ny fil\n")).unwrap();
    assert_eq!(levende(&t).fil_tilfoejede, 0, "en ny fil begynder forfra");
    assert_eq!(
        fil_analyser_med(&t, None, None, &[], &side(10), &[tf(0, "ord")]).err(),
        Some(UiFejl::UkendtRaekke),
        "pladsen fra den gamle fil gælder ikke"
    );
    // Indsat tekst bruger stadig sin egen liste med værdien (V-MANUEL.1).
    let a = analyser_med(
        &t,
        "ny tekst med Kunde-Gamma\n",
        None,
        &[],
        &[Tilfoejet {
            vaerdi: "Kunde-Gamma".into(),
            art: "ord".into(),
        }],
    )
    .unwrap();
    assert_eq!(a.tilfoejede[0].antal, 1);
}

#[test]
fn n1_laast_svarer_laast_og_laasen_glemmer_vaerdierne() {
    let m = Mappe::ny();
    let t = program(&m);
    let tekst = stor_tekst();
    fil_aabn(&t, Visning::Masker, &m.fil("app.log", &tekst)).unwrap();
    marker(&t, &tekst, VAERDI, "hemmelighed");
    assert_eq!(levende(&t).fil_tilfoejede, 1);
    assert!(laas_igen(&t, Udloeser::Dvale));
    let (s, l) = sted(&tekst, VAERDI);
    assert_eq!(fil_marker(&t, s, l, "ord").err(), Some(UiFejl::Laast));
    assert_eq!(
        fil_analyser_med(&t, None, None, &[], &side(10), &[tf(0, "ord")]).err(),
        Some(UiFejl::Laast)
    );
    assert_eq!(levende(&t).fil_tilfoejede, 0);
    assert_eq!(levende(&t).filer, 0);
    assert_eq!(laas_op(&t, &HukommelsesDoer::ny(Svar::Ok), "da").svar, Svar::Ok);
    assert_eq!(fil_marker(&t, s, l, "ord").err(), Some(UiFejl::IngenFil));
}

fn kilde(fil: &str) -> String {
    std::fs::read_to_string(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join(fil)).unwrap()
}

/// Kilden: kommandoen tager stedet og typen (ingen tekst), porten tjekkes før og efter, intet skrives til log; svaret og
/// listen har intet felt til en værdi; kommandoen er registreret ét sted hver.
#[test]
fn n1_kilden_kommandoen_tager_aldrig_teksten() {
    let k = kilde("src/maskering.rs");
    let s = k.find("pub fn fil_marker(").unwrap();
    let krop = &k[s..s + k[s..].find("\n}\n").unwrap()];
    assert!(
        krop.starts_with("pub fn fil_marker(t: &Tilstand, start: usize, laengde: usize, art: &str)"),
        "{}",
        &krop[..120]
    );
    assert_eq!(krop.matches("t.aaben()?").count(), 2, "porten før og efter");
    for ord in ["println", "eprintln", "dbg!", "log::"] {
        assert!(!krop.contains(ord), "{ord} i fil_marker");
    }
    for typ in ["pub struct FilMarkering", "pub struct FilTilfoejet"] {
        let i = k.find(typ).unwrap();
        let felter = &k[i..i + k[i..].find("\n}\n").unwrap()];
        assert!(!felter.contains("String,") || typ == "pub struct FilTilfoejet", "{typ}: {felter}");
        assert!(!felter.contains("vaerdi"), "{typ} har et felt til en værdi");
    }
    let lib = kilde("src/lib.rs");
    assert!(lib.contains("fn fil_marker(tilstand: State<'_, Tilstand>, start: usize, laengde: usize, art: String)"));
    assert!(lib.contains("        fil_marker,\n"));
    assert!(kilde("build.rs").contains("\"fil_marker\""));
    assert!(kilde("capabilities/default.json").contains("\"allow-fil-marker\""));
}

// ─────────────────────────────────────────────────────────────── N3

/// Programmet med en efterlignet udklipsholder (aldrig den rigtige).
fn med_udklip(laesbar: bool) -> (Mappe, Tilstand, Arc<HukommelsesUdklip>) {
    let u = Arc::new(HukommelsesUdklip::ny(laesbar));
    let m = Mappe::ny();
    let t = Tilstand::paa_disk(m.0.clone(), Arc::new(HukommelsesLager::ny())).med_udklip(Some(Box::new(u.clone())));
    (m, t, u)
}

const N3_TEKST: &str = "srcip=10.20.30.11 user=\"bruger060\"\r\nServer=srv-068;Password=Sommer2026!;\r\n";

fn masker_n3(t: &Tilstand) {
    let a = analyser(t, N3_TEKST, None, &[]).unwrap();
    let fra: Vec<usize> = a.raekker.iter().filter(|r| !r.valgt).map(|r| r.id).collect();
    gem_og_masker(t, N3_TEKST, &fra, &[]).unwrap();
}

fn poster(t: &Tilstand) -> Vec<SagPost> {
    let alle = sag_indhold(
        t,
        None,
        &IndholdValg {
            antal: 1000,
            ..IndholdValg::default()
        },
    )
    .unwrap();
    let vist: Vec<usize> = alle.raekker.iter().map(|p| p.nr).collect();
    sag_indhold(
        t,
        None,
        &IndholdValg {
            antal: 1000,
            vist,
            ..IndholdValg::default()
        },
    )
    .unwrap()
    .raekker
}

fn typer(u: &HukommelsesUdklip) -> Vec<(String, String)> {
    u.typer_nu()
}

fn maerket(vaerdi: &str) -> Vec<(String, String)> {
    vec![
        (TEKST_TYPE.to_string(), vaerdi.to_string()),
        (FORTROLIG.to_string(), String::new()),
        (KILDE.to_string(), BUNDLE_ID.to_string()),
    ]
}

#[test]
fn n3_en_skjult_hemmelighed_faar_fortroligt_maerket_og_er_stadig_almindelig_tekst() {
    let (_m, t, u) = med_udklip(false);
    masker_n3(&t);
    let h = poster(&t).into_iter().find(|p| p.hemmelig).unwrap();
    assert!(sag_post_kopier(&t, h.nr, &h.kode).unwrap());
    assert_eq!(
        typer(&u),
        maerket("Sommer2026!"),
        "teksten som almindelig tekst og mærkerne på samme element"
    );
    assert_eq!(u.nu().as_deref(), Some("Sommer2026!"), "kan sættes ind som almindelig tekst");
    assert_eq!((u.skrivninger(), u.laesninger()), (1, 0));
    assert_eq!((FORTROLIG, KILDE), ("org.nspasteboard.ConcealedType", "org.nspasteboard.source"));
    // Lås rydder som før (D21): teksten og mærkerne er væk.
    assert!(laas_igen(&t, Udloeser::Dvale));
    assert_eq!((u.nu(), typer(&u)), (None, vec![]));
}

#[test]
fn n3_afslutning_rydder_og_et_andet_program_roeres_ikke() {
    let (_m, t, u) = med_udklip(false);
    masker_n3(&t);
    let h = poster(&t).into_iter().find(|p| p.hemmelig).unwrap();
    assert!(sag_post_kopier(&t, h.nr, &h.kode).unwrap());
    ved_afslut(&t);
    assert_eq!((u.nu(), typer(&u)), (None, vec![]), "afslutningen rydder");
    let (_m, t, u) = med_udklip(false);
    masker_n3(&t);
    let h = poster(&t).into_iter().find(|p| p.hemmelig).unwrap();
    assert!(sag_post_kopier(&t, h.nr, &h.kode).unwrap());
    u.skriv("et andet programs tekst");
    assert!(laas_igen(&t, Udloeser::Dvale));
    assert_eq!(
        typer(&u),
        vec![(TEKST_TYPE.to_string(), "et andet programs tekst".to_string())],
        "et andet programs indhold røres ikke og får intet mærke"
    );
}

#[test]
fn n3_en_mislykket_skrivning_efterlader_intet_og_en_almindelig_vaerdi_faar_intet_maerke() {
    let (_m, t, u) = med_udklip(true);
    masker_n3(&t);
    let h = poster(&t).into_iter().find(|p| p.hemmelig).unwrap();
    u.afvis_skrivning();
    assert!(!sag_post_kopier(&t, h.nr, &h.kode).unwrap());
    assert_eq!(typer(&u), vec![]);
    // En almindelig værdi kopierer webvisningen (navigator.clipboard); Rust husker kun tælleren og mærker intet.
    let (_m, t, u) = med_udklip(true);
    masker_n3(&t);
    let p = poster(&t).into_iter().find(|p| p.vaerdi.as_deref() == Some("srv-068")).unwrap();
    u.skriv("srv-068");
    assert!(udklip_vaerdi_kopieret(&t, p.nr, &p.kode).unwrap());
    assert_eq!(typer(&u), vec![(TEKST_TYPE.to_string(), "srv-068".to_string())]);
}

/// Kilden: bundle-id'et er programmets; `sag_post_kopier` skriver med mærket; macOS-udgaven skriver teksten som
/// `NSPasteboardTypeString` og mærkerne med `setString:forType:` og rydder, hvis et mærke ikke kan skrives.
#[test]
fn n3_kilden_maerket_skrives_i_macos_og_bundle_id_er_programmets() {
    let konf: serde_json::Value = serde_json::from_str(&kilde("tauri.conf.json")).unwrap();
    assert_eq!(konf["identifier"].as_str(), Some(BUNDLE_ID));
    let m = kilde("src/maskering.rs");
    let i = m.find("pub fn sag_post_kopier(").unwrap();
    let krop = &m[i..i + m[i..].find("\n}\n").unwrap()];
    assert!(
        krop.contains("u.skriv_fortrolig(&vaerdi)") && !krop.contains("skriv_tekst("),
        "{krop}"
    );
    let u = kilde("src/udklip.rs");
    let i = u
        .find("        fn skriv_fortrolig(&self, tekst: &str) -> bool {\n            autoreleasepool")
        .unwrap();
    let mac = &u[i..i + u[i..].find("\n        }\n").unwrap()];
    for del in [
        "pb.clearContents();",
        "setString_forType(&s, type_)",
        "NSString::from_str(FORTROLIG)",
        "NSString::from_str(KILDE)",
        "NSString::from_str(BUNDLE_ID)",
        "if !(maerke && kilde) {\n                    pb.clearContents();\n                    return false;",
    ] {
        assert!(mac.contains(del), "{del} mangler i macOS-udgavens skriv_fortrolig");
    }
    assert_eq!(
        mac.matches("pb.clearContents();").count(),
        3,
        "før, ved fejl i teksten og ved fejl i mærket"
    );
}
