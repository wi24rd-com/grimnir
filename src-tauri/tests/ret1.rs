//! V-RET.1 (rettelser efter vinduesprøven), skallen uden vindue:
//! - R3: samme tekst giver samme linjetal i Maskér (`analyser`), Demaskér (`demasker`) og for en fil (`fil_aabn`), med
//!   LF, CRLF, enligt CR og blandet, med og uden afsluttende linjeskift.
//! - R5: en afbrudt skrivning i brugerens mappe efterlader en `.tmp` med teksten; næste start fjerner den, fordi stien
//!   stod i `<app-data>/igang.json`. En noteret fil, der ikke passer på mønstret, røres ikke. Listen vokser ikke.
//!
//! Nøglelageret ligger i hukommelsen og rører aldrig den rigtige Nøglering. Kun opdigtede værdier: `kontor.test`,
//! RFC 1918-adresser, opfundne brugere og ord.

use std::panic::{catch_unwind, AssertUnwindSafe};
use std::path::PathBuf;
use std::sync::Arc;

use grimnir_lib::fil;
use grimnir_lib::igang::{self, Igang};
use grimnir_lib::maskering::{
    analyser, demasker, fil_aabn, fil_analyser, fil_demasker, fil_gem_og_masker, fil_gem_til, fil_gem_til_med, SideValg, Tilstand, Visning,
};
use grimnir_lib::sager::{HukommelsesLager, SagsId};

/// En midlertidig mappe, der slettes igen. `app` er programmets mappe; `bruger` er brugerens filer.
struct Mappe(PathBuf);
impl Mappe {
    fn ny() -> Self {
        let p = std::env::temp_dir().join(format!("grimnir-ret1-{}", SagsId::ny().unwrap().hex()));
        std::fs::create_dir_all(p.join("bruger")).unwrap();
        Mappe(p)
    }
    fn app(&self) -> PathBuf {
        self.0.join("app")
    }
    fn bruger(&self, navn: &str) -> PathBuf {
        self.0.join("bruger").join(navn)
    }
    /// Filnavnene i brugerens mappe, sorteret.
    fn filer(&self) -> Vec<String> {
        let mut v: Vec<String> = std::fs::read_dir(self.0.join("bruger"))
            .unwrap()
            .map(|e| e.unwrap().file_name().to_string_lossy().into_owned())
            .collect();
        v.sort();
        v
    }
}
impl Drop for Mappe {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}

fn program(m: &Mappe, lager: &Arc<HukommelsesLager>) -> Tilstand {
    Tilstand::paa_disk(m.app(), lager.clone())
}

fn side() -> SideValg {
    SideValg {
        filter: "alle".into(),
        soeg: String::new(),
        vist: Vec::new(),
        antal: 500,
    }
}

// ------------------------------------------------------------------------------------------------------------- R3

/// Fire opdigtede linjer med det givne linjeskift; `slut`: også efter den sidste linje.
fn fire_linjer(ls: &str, slut: bool) -> String {
    let l = [
        "srcip=10.20.30.11 user=\"bruger060\"",
        "host=srv-014.kontor.test",
        "Password=Sommer2026!;",
        "slut",
    ];
    let mut t = l.join(ls);
    if slut {
        t.push_str(ls);
    }
    t
}

#[test]
fn samme_tekst_giver_samme_linjetal_i_masker_demasker_og_for_filer() {
    let m = Mappe::ny();
    let lager = Arc::new(HukommelsesLager::ny());
    let t = program(&m, &lager);
    let mut tilfaelde: Vec<(String, String, usize)> = Vec::new();
    for (navn, ls) in [("LF", "\n"), ("CRLF", "\r\n"), ("CR", "\r")] {
        tilfaelde.push((format!("{navn} med afsluttende"), fire_linjer(ls, true), 4));
        tilfaelde.push((format!("{navn} uden afsluttende"), fire_linjer(ls, false), 4));
    }
    // Blandet: CRLF, LF og et enligt CR i samme tekst.
    tilfaelde.push((
        "blandet med afsluttende".into(),
        "a=10.20.30.11\r\nb=srv-014.kontor.test\nc\rd\r\n".into(),
        4,
    ));
    tilfaelde.push((
        "blandet uden afsluttende".into(),
        "a=10.20.30.11\r\nb=srv-014.kontor.test\nc\rd".into(),
        4,
    ));
    tilfaelde.push(("én linje uden linjeskift".into(), "user=\"bruger060\"".into(), 1));
    tilfaelde.push(("kun et linjeskift".into(), "\r\n".into(), 1));
    tilfaelde.push(("tomme linjer".into(), "a\n\n\nb\n".into(), 4));

    for (i, (navn, tekst, n)) in tilfaelde.iter().enumerate() {
        let a = analyser(&t, tekst, None, &[]).unwrap();
        let d = demasker(&t, tekst).unwrap();
        let sti = m.bruger(&format!("linjer{i}.log"));
        std::fs::write(&sti, tekst.as_bytes()).unwrap();
        let info = fil_aabn(&t, Visning::Demasker, &sti).unwrap();
        assert_eq!(
            (a.linjer, d.linjer, info.linjer, fil::antal_linjer(tekst)),
            (*n, *n, *n, *n),
            "{navn}: {tekst:?}"
        );
    }
    // Den tomme tekst: 0 linjer (Maskér og Demaskér afviser den, før der tælles; en tom fil afvises også).
    assert_eq!(fil::antal_linjer(""), 0);
}

#[test]
fn linjenumrene_i_fundene_foelger_samme_linjeskift() {
    let m = Mappe::ny();
    let lager = Arc::new(HukommelsesLager::ny());
    let t = program(&m, &lager);
    // Adressen står på linje 3, efter et enligt CR og et CRLF.
    let a = analyser(&t, "start\rmidt\r\nsrcip=10.20.30.11\n", None, &[]).unwrap();
    let r = a
        .raekker
        .iter()
        .find(|r| r.vaerdier.iter().any(|v| v == "10.20.30.11"))
        .expect("adressen er et fund");
    assert_eq!((r.linje, a.linjer), (3, 3));
}

// ------------------------------------------------------------------------------------------------------------- R5

/// Midlertidige filer i brugerens mappe (`.<navn>.<8 hex>.tmp`).
fn tmp_filer(m: &Mappe) -> Vec<String> {
    m.filer().into_iter().filter(|n| igang::er_midlertidig(n)).collect()
}

/// Liste i igang.json (stier som tekst), eller None, hvis filen ikke findes.
fn igang_liste(m: &Mappe) -> Option<Vec<String>> {
    let b = std::fs::read(m.app().join(igang::FIL)).ok()?;
    let v: serde_json::Value = serde_json::from_slice(&b).unwrap();
    Some(
        v["filer"]
            .as_array()
            .unwrap()
            .iter()
            .map(|x| x.as_str().unwrap().to_string())
            .collect(),
    )
}

/// Maskér `app.log` og demaskér den maskerede fil i Demaskér: Rust holder nu den demaskerede tekst (klartekst).
fn klar_til_demaskeret_gem(m: &Mappe, t: &Tilstand) -> Vec<u8> {
    let original = b"2026-11-10 srcip=10.20.30.11 user=\"bruger060\"\r\nServer=srv-068;Password=Sommer2026!;\r\n".to_vec();
    let app = m.bruger("app.log");
    std::fs::write(&app, &original).unwrap();
    fil_aabn(t, Visning::Masker, &app).unwrap();
    let a = fil_analyser(t, None, None, &[], &side()).unwrap();
    fil_gem_og_masker(t, &a.fravalgt, &[]).unwrap();
    let mk = m.bruger("app.maskeret.log");
    fil_gem_til(t, Visning::Masker, &mk, false).unwrap();
    fil_aabn(t, Visning::Demasker, &mk).unwrap();
    fil_demasker(t).unwrap();
    original
}

#[test]
fn afbrudt_skrivning_efterlader_tmp_som_naeste_start_fjerner() {
    let m = Mappe::ny();
    let lager = Arc::new(HukommelsesLager::ny());
    let t = program(&m, &lager);
    let original = klar_til_demaskeret_gem(&m, &t);
    assert_eq!(igang_liste(&m), None, "ingen igangværende skrivninger: filen findes ikke");

    // Programmet "går ned" lige før omdøbningen: en panik midt i skrivningen af den demaskerede fil.
    let ud = m.bruger("app.demaskeret.log");
    let mut liste_under = None;
    let r = catch_unwind(AssertUnwindSafe(|| {
        let _ = fil_gem_til_med(&t, Visning::Demasker, &ud, true, &mut || {
            liste_under = igang_liste(&m);
            panic!("nedbrud midt i skrivningen (testens)");
        });
    }));
    assert!(r.is_err(), "skrivningen blev afbrudt");
    drop(t);

    // Tilbage: en .tmp med klartekst i brugerens mappe, og stien står i igang.json.
    let tmp = tmp_filer(&m);
    assert_eq!(tmp.len(), 1, "{:?}", m.filer());
    assert!(tmp[0].starts_with(".app.demaskeret.") && tmp[0].ends_with(".tmp"), "{tmp:?}");
    let tmp_sti = m.bruger(&tmp[0]);
    assert_eq!(
        std::fs::read(&tmp_sti).unwrap(),
        original,
        ".tmp'en er den demaskerede tekst (klartekst)"
    );
    assert!(!ud.exists(), "filen blev aldrig omdøbt");
    let liste = igang_liste(&m).expect("igang.json findes efter nedbruddet");
    assert_eq!(liste, vec![tmp_sti.to_string_lossy().into_owned()], "kun den igangværende sti");
    assert_eq!(liste_under.as_ref(), Some(&liste), "stien var noteret, før omdøbningen");
    let json = String::from_utf8(std::fs::read(m.app().join(igang::FIL)).unwrap()).unwrap();
    assert!(
        !json.contains("bruger060") && !json.contains("Sommer2026"),
        "listen har kun stier, intet indhold"
    );

    // Næste start: .tmp'en og listen er væk; resten af brugerens mappe er urørt.
    let _t2 = program(&m, &lager);
    assert!(tmp_filer(&m).is_empty(), "{:?}", m.filer());
    assert_eq!(m.filer(), ["app.log", "app.maskeret.log"]);
    assert_eq!(igang_liste(&m), None, "listen er tømt (filen er fjernet)");
}

#[test]
fn en_noteret_fil_der_ikke_passer_paa_moenstret_roeres_ikke() {
    let m = Mappe::ny();
    std::fs::create_dir_all(m.app()).unwrap();
    // Opdigtede filer: én, der passer, og fire, der ikke må røres (forkert navn, en mappe med et rigtigt navn, et link med
    // et rigtigt navn, og en sti, der ikke findes).
    let passer = m.bruger(".rapport.0a1b2c3d.tmp");
    let forkert = m.bruger("rapport.log");
    let mappe = m.bruger(".mappe.12345678.tmp");
    let link = m.bruger(".link.abcdef01.tmp");
    let findes_ikke = m.bruger(".borte.11223344.tmp");
    std::fs::write(&passer, "klartekst 10.20.30.11").unwrap();
    std::fs::write(&forkert, "brugerens egen fil").unwrap();
    std::fs::create_dir(&mappe).unwrap();
    #[cfg(unix)]
    std::os::unix::fs::symlink(&forkert, &link).unwrap();
    let liste = serde_json::json!({ "filer": [passer, forkert, mappe, link, findes_ikke] });
    std::fs::write(m.app().join(igang::FIL), serde_json::to_vec(&liste).unwrap()).unwrap();

    let lager = Arc::new(HukommelsesLager::ny());
    let _t = program(&m, &lager);
    assert!(!passer.exists(), "den noterede .tmp er slettet");
    assert_eq!(
        std::fs::read_to_string(&forkert).unwrap(),
        "brugerens egen fil",
        "en fil uden mønstret er urørt"
    );
    assert!(mappe.is_dir(), "en mappe slettes ikke");
    #[cfg(unix)]
    assert!(
        std::fs::symlink_metadata(&link).unwrap().file_type().is_symlink(),
        "et link slettes ikke"
    );
    assert!(!m.app().join(igang::FIL).exists(), "listen er tømt");
}

#[test]
fn ulaeselig_liste_fjernes_uden_at_roere_andet() {
    let m = Mappe::ny();
    std::fs::create_dir_all(m.app()).unwrap();
    let tmp = m.bruger(".app.0a1b2c3d.tmp");
    std::fs::write(&tmp, "x").unwrap();
    std::fs::write(m.app().join(igang::FIL), b"{ikke json").unwrap();
    let i = Igang::ny(&m.app());
    assert_eq!(i.ryd(), 0);
    assert!(tmp.exists(), "en .tmp, der ikke står på listen, røres ikke");
    assert!(!i.sti().exists());
}

#[test]
fn listen_vokser_ikke_og_har_kun_de_igangvaerende() {
    let m = Mappe::ny();
    let lager = Arc::new(HukommelsesLager::ny());
    let t = program(&m, &lager);
    let original = klar_til_demaskeret_gem(&m, &t);
    for navn in ["a.log", "b.log", "c.log"] {
        let mut under = None;
        fil_gem_til_med(&t, Visning::Demasker, &m.bruger(navn), true, &mut || {
            under = igang_liste(&m);
            Ok(())
        })
        .unwrap();
        assert_eq!(under.map(|l| l.len()), Some(1), "{navn}: kun den igangværende står på listen");
        assert_eq!(igang_liste(&m), None, "{navn}: efter omdøbningen er listen tom (filen fjernet)");
        assert_eq!(std::fs::read(m.bruger(navn)).unwrap(), original);
    }
    // En skrivning, der fejler (ikke et nedbrud), rydder op og fjerner stien igen.
    let r = fil_gem_til_med(&t, Visning::Demasker, &m.bruger("d.log"), true, &mut || {
        Err(std::io::Error::other("afbrudt"))
    });
    assert!(r.is_err());
    assert!(tmp_filer(&m).is_empty() && !m.bruger("d.log").exists());
    assert_eq!(igang_liste(&m), None);
}

#[test]
fn igang_noteres_kun_i_programmets_mappe() {
    // Uden disk (Tilstand::ny) er der ingen liste; skrivningen virker som før.
    let m = Mappe::ny();
    let t = Tilstand::ny();
    let sti = m.bruger("x.log");
    std::fs::write(&sti, "srcip=10.20.30.11\n").unwrap();
    fil_aabn(&t, Visning::Masker, &sti).unwrap();
    let a = fil_analyser(&t, None, None, &[], &side()).unwrap();
    fil_gem_og_masker(&t, &a.fravalgt, &[]).unwrap();
    fil_gem_til(&t, Visning::Masker, &m.bruger("x.maskeret.log"), false).unwrap();
    assert!(!m.app().exists());
}
