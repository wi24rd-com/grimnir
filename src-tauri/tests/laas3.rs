//! V-LAAS.3 N5 (skallen uden vindue): låsen kan ikke slås fra, og Grimnir låser igen.
//!
//! - N1: en ældre `indstillinger.json` med `"laas_ved_start": false` læses uden fejl og giver låst start.
//! - N2: hver udløser gennem `laas_igen`; nulstillingen felt for felt (`levende`); en ændret navngiven sag gemmes; fejl
//!   ved gemning låser alligevel og vises efter oplåsningen uden indhold (V-LAAS.4: en midlertidig sag med poster gemmes
//!   nu; testene for den står i `laas4.rs`);
//!   stilstand med et ur, testen styrer, ved 5 og 15 minutter; aktivitet nulstiller uret; en lang kommando låser ikke midt
//!   i; oplåsning efter ny lås virker og læser nøglerne igen.
//! - N4: `unsafe` findes kun i `laas.rs` og `notifikationer.rs` (V-LAAS.4: og `udklip.rs`), hver gang med en
//!   `SAFETY`-kommentar.
//! - Kilden: observatørerne registreres ét sted og går gennem `laas_igen`; hver kommando tæller som aktivitet; de lange
//!   kommandoer holder `travl`.
//!
//! Tests kalder aldrig `LAContext` og rører aldrig Nøglering: døren er `HukommelsesDoer`, nøglelageret er
//! `HukommelsesLager` bag en tæller. Notifikationerne registreres ikke her (de kræver AppKit og et kørende program). Kun
//! opdigtede værdier (`kontor.test`, RFC 1918, opfundne navne). Mappen er en midlertidig mappe, der slettes igen.

use std::path::PathBuf;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use std::time::Duration;

use grimnir_lib::indstillinger::Indstillinger;
use grimnir_lib::laas::{HukommelsesDoer, Svar, Udloeser};
use grimnir_lib::maskering::{
    analyser, fil_aabn, fil_gem_og_masker, gem_og_masker, indstillinger_gem, indstillinger_hent, laas_igen, laas_op, laas_status, levende,
    marker_ugemt, ordbog_hent, ordbog_tilfoej, sag_aabn, sag_liste, sag_ny, sag_status, sag_valg, tjek_stilstand, EfterLaas, LaasStatus,
    Levende, Tilstand, UiFejl, Visning,
};
use grimnir_lib::sager::{HukommelsesLager, Noegle, Noeglelager, SagFejl, SagsId};
use grimnir_lib::stilstand::StyretUr;

/// En midlertidig mappe, der slettes igen.
struct Mappe(PathBuf);
impl Mappe {
    fn ny() -> Self {
        let p = std::env::temp_dir().join(format!("grimnir-laas3-{}", SagsId::ny().unwrap().hex()));
        std::fs::create_dir_all(&p).unwrap();
        Mappe(p)
    }
}
impl Drop for Mappe {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}

/// Et nøglelager i hukommelsen, der tæller hvert opslag.
#[derive(Default)]
struct Taellende {
    lager: HukommelsesLager,
    opslag: AtomicUsize,
}
impl Taellende {
    fn opslag(&self) -> usize {
        self.opslag.load(Ordering::SeqCst)
    }
}
impl Noeglelager for Taellende {
    fn hent_konto(&self, konto: &str) -> Result<Noegle, SagFejl> {
        self.opslag.fetch_add(1, Ordering::SeqCst);
        self.lager.hent_konto(konto)
    }
    fn gem_konto(&self, konto: &str, noegle: &Noegle) -> Result<(), SagFejl> {
        self.opslag.fetch_add(1, Ordering::SeqCst);
        self.lager.gem_konto(konto, noegle)
    }
    fn slet_konto(&self, konto: &str) -> Result<(), SagFejl> {
        self.opslag.fetch_add(1, Ordering::SeqCst);
        self.lager.slet_konto(konto)
    }
}

const SAGSNAVN: &str = "Uglebo-sagen";
const ORD: &str = "Kragevig";
const TEKST: &str = "srv-web01.kontor.test 10.20.0.5 bruger=anders.eksempel Kragevig\n";
const HEMMELIGE: [&str; 5] = [SAGSNAVN, ORD, "kontor.test", "10.20.0.5", "anders"];

/// Programmet ved start, låst op med døren (som efter fingeren).
fn startet(m: &Mappe, lager: &Arc<Taellende>) -> Tilstand {
    let t = Tilstand::paa_disk(m.0.clone(), lager.clone()).ved_start();
    assert!(t.er_laast());
    assert_eq!(laas_op(&t, &HukommelsesDoer::ny(Svar::Ok), "da").svar, Svar::Ok);
    t
}

/// Maskerer `TEKST` i den aktuelle sag (rækkerne, kernen foreslår).
fn masker(t: &Tilstand) {
    let a = analyser(t, TEKST, None, &[]).unwrap();
    let fra: Vec<usize> = a.raekker.iter().filter(|r| !r.valgt).map(|r| r.id).collect();
    gem_og_masker(t, TEKST, &fra, &[]).unwrap();
}

/// En mappe med en navngiven sag (med poster) og en ordbog med én post. Svarer med sagens id.
fn med_data(m: &Mappe, lager: &Arc<Taellende>) -> String {
    let t = Tilstand::paa_disk(m.0.clone(), lager.clone());
    ordbog_tilfoej(&t, "ord", ORD, None).unwrap();
    masker(&t);
    sag_ny(&t, SAGSNAVN, None).unwrap().id.unwrap()
}

/// Et program, der har alt i hukommelsen: den åbne navngivne sag (nøgle og originaler), ordbogen og en fil i både
/// Maskér og Demaskér, med et resultat i Maskér.
fn fuldt(m: &Mappe, lager: &Arc<Taellende>, id: &str) -> Tilstand {
    let t = startet(m, lager);
    sag_aabn(&t, id).unwrap();
    assert_eq!(ordbog_hent(&t).unwrap().poster.len(), 1);
    let fil = m.0.join("indsat.log");
    std::fs::write(&fil, TEKST).unwrap();
    fil_aabn(&t, Visning::Masker, &fil).unwrap();
    fil_aabn(&t, Visning::Demasker, &fil).unwrap();
    fil_gem_og_masker(&t, &[], &[]).unwrap();
    let l = levende(&t);
    assert_eq!((l.noegler, l.ordbogsvaerdier, l.filer, l.resultater), (1, 1, 2, 1), "{l:?}");
    assert!(l.originaler > 0 && l.ordbog_laest);
    t
}

const ALLE: [Udloeser; 4] = [Udloeser::Dvale, Udloeser::SkaermSlukket, Udloeser::Brugerskift, Udloeser::Stilstand];

// ------------------------------------------------------------------------------------------------------- N1

#[test]
fn aeldre_fil_med_laas_ved_start_false_starter_laast() {
    let m = Mappe::ny();
    let fil = m.0.join("indstillinger.json");
    std::fs::write(
        &fil,
        "{\"masker_fremmede\": true, \"bevar_sidste_oktet\": false, \"udloeb_dage\": 30, \"guide_vist\": true, \"laas_ved_start\": false}",
    )
    .unwrap();
    let lager = Arc::new(Taellende::default());
    let t = Tilstand::paa_disk(m.0.clone(), lager.clone()).ved_start();
    assert!(t.er_laast(), "\"laas_ved_start\": false giver låst start");
    // Filen er læst uden fejl: de andre felter gælder; feltet er ignoreret.
    let i = indstillinger_hent(&t);
    assert_eq!(
        i,
        Indstillinger {
            masker_fremmede: true,
            bevar_sidste_oktet: false,
            udloeb_dage: Some(30),
            guide_vist: true,
            laas_efter_min: 15,
        }
    );
    // Næste gang filen gemmes, er feltet væk.
    indstillinger_gem(&t, i).unwrap();
    let json = std::fs::read_to_string(&fil).unwrap();
    assert!(
        !json.contains("laas_ved_start") && json.contains("\"laas_efter_min\": 15"),
        "{json}"
    );
    assert!(Tilstand::paa_disk(m.0.clone(), lager).ved_start().er_laast());
}

#[test]
fn stilstand_kan_ikke_slaas_fra() {
    let t = Tilstand::ny();
    assert_eq!(indstillinger_hent(&t).laas_efter_min, 15, "standard: 15 minutter");
    for min in [5, 15, 30, 60] {
        let i = Indstillinger {
            laas_efter_min: min,
            ..indstillinger_hent(&t)
        };
        assert_eq!(indstillinger_gem(&t, i).map(|x| x.laas_efter_min), Ok(min));
    }
    for min in [0, 1, 7, 61, 120, u32::MAX] {
        let i = Indstillinger {
            laas_efter_min: min,
            ..indstillinger_hent(&t)
        };
        assert_eq!(indstillinger_gem(&t, i), Err(UiFejl::Indstillinger { fejl: None }), "{min}");
    }
    assert_eq!(indstillinger_hent(&t).laas_efter_min, 60);
    // En fil med en graense, der ikke er tilladt (fx 0 = aldrig), giver standardværdierne.
    let m = Mappe::ny();
    std::fs::write(m.0.join("indstillinger.json"), "{\"laas_efter_min\": 0, \"guide_vist\": true}").unwrap();
    let t = Tilstand::paa_disk(m.0.clone(), Arc::new(Taellende::default()));
    assert_eq!(indstillinger_hent(&t), Indstillinger::default());
}

// ------------------------------------------------------------------------------------------------------- N2

#[test]
fn hver_udloeser_laaser_og_nulstiller_alt() {
    let m = Mappe::ny();
    let lager = Arc::new(Taellende::default());
    let id = med_data(&m, &lager);
    for grund in ALLE {
        let t = fuldt(&m, &lager, &id);
        assert!(laas_igen(&t, grund), "{grund:?}: var låst op");
        assert!(t.er_laast());
        assert_eq!(
            laas_status(&t),
            LaasStatus {
                laast: true,
                igen: Some(grund),
                uden_doer: None
            }
        );
        assert_eq!(levende(&t), Levende::default(), "{grund:?}: intet tilbage i tilstanden");
        let opslag = lager.opslag();
        assert_eq!(sag_status(&t), Err(UiFejl::Laast));
        assert_eq!(sag_liste(&t), Err(UiFejl::Laast));
        assert_eq!(ordbog_hent(&t).map(|_| ()), Err(UiFejl::Laast));
        assert_eq!(lager.opslag(), opslag, "{grund:?}: ingen nøgle slået op, mens der er låst");
        assert_eq!(levende(&t), Levende::default(), "{grund:?}: porten lægger intet tilbage");
        // Allerede låst: ingen ny hændelse.
        assert!(!laas_igen(&t, grund));
    }
}

#[test]
fn igen_som_json_uden_indhold() {
    let t = Tilstand::ny();
    let j = |t: &Tilstand| serde_json::to_string(&laas_status(t)).unwrap();
    assert_eq!(j(&t), r#"{"laast":false,"igen":null,"uden_doer":null}"#);
    for (grund, navn) in ALLE.iter().zip(["dvale", "skaerm_slukket", "brugerskift", "stilstand"]) {
        laas_igen(&t, *grund);
        assert_eq!(j(&t), format!(r#"{{"laast":true,"igen":"{navn}","uden_doer":null}}"#));
    }
}

#[test]
fn oplaasning_efter_ny_laas_laeser_noeglerne_igen() {
    let m = Mappe::ny();
    let lager = Arc::new(Taellende::default());
    let id = med_data(&m, &lager);
    let t = fuldt(&m, &lager, &id);
    laas_igen(&t, Udloeser::Dvale);
    // Uden fingeren: stadig låst.
    let d = HukommelsesDoer::ny(Svar::Annulleret);
    let ud = laas_op(&t, &d, "da");
    assert_eq!(
        (ud.svar, ud.status.laast, ud.status.igen, ud.efter),
        (Svar::Annulleret, true, Some(Udloeser::Dvale), None)
    );
    // Med fingeren: låst op, og nøglerne læses igen, når de bruges (ikke før).
    let opslag = lager.opslag();
    d.svar(Svar::Ok);
    let ud = laas_op(&t, &d, "da");
    assert_eq!(
        (ud.svar, ud.status),
        (
            Svar::Ok,
            LaasStatus {
                laast: false,
                igen: None,
                uden_doer: None
            }
        )
    );
    assert_eq!(ud.efter, None, "en navngiven sag og ingen fejl: intet at fortælle");
    assert_eq!(lager.opslag(), opslag, "døren selv læser ingen nøgle");
    assert_eq!(levende(&t), Levende::default(), "intet læses, før det bruges");
    assert_eq!(sag_liste(&t).unwrap().len(), 1);
    assert_eq!(ordbog_hent(&t).unwrap().poster.len(), 1, "ordbogen er læst igen");
    assert_eq!(sag_aabn(&t, &id).unwrap().navn.as_deref(), Some(SAGSNAVN));
    assert!(lager.opslag() > opslag, "nøglerne er læst igen");
    let l = levende(&t);
    assert_eq!((l.noegler, l.ordbogsvaerdier), (1, 1));
}

#[test]
fn aendret_navngiven_sag_gemmes_ved_laas() {
    let m = Mappe::ny();
    let lager = Arc::new(Taellende::default());
    let id = med_data(&m, &lager);
    let sagsfil = m.0.join("sager").join(format!("{id}.grimnir"));
    let t = fuldt(&m, &lager, &id);
    // En anden udgave af programmet har sagen åben med samme skrivetæller.
    let t2 = startet(&m, &lager);
    sag_aabn(&t2, &id).unwrap();
    let foer = std::fs::read(&sagsfil).unwrap();
    let poster = sag_status(&t).unwrap().poster;
    marker_ugemt(&t);
    assert!(laas_igen(&t, Udloeser::SkaermSlukket));
    assert_ne!(std::fs::read(&sagsfil).unwrap(), foer, "sagen er skrevet igen");
    assert_eq!(
        sag_valg(&t2, true, false),
        Err(UiFejl::from(SagFejl::Konflikt)),
        "skrivetælleren er talt op"
    );
    let ud = laas_op(&t, &HukommelsesDoer::ny(Svar::Ok), "da");
    assert_eq!(ud.efter, None, "gemt uden fejl: intet at fortælle");
    assert_eq!(
        sag_aabn(&t, &id).unwrap().poster,
        poster,
        "sagen kan åbnes igen med de samme poster"
    );
    // Uden ændring skrives sagen ikke.
    let foer = std::fs::read(&sagsfil).unwrap();
    laas_igen(&t, Udloeser::Dvale);
    assert_eq!(std::fs::read(&sagsfil).unwrap(), foer, "en sag uden ændringer skrives ikke");
}

#[test]
fn fejl_ved_gemning_laaser_alligevel_og_vises_efter_oplaasning() {
    let m = Mappe::ny();
    let lager = Arc::new(Taellende::default());
    let id = med_data(&m, &lager);
    let t = fuldt(&m, &lager, &id);
    // Sagen ændres et andet sted, så gemningen giver en konflikt.
    let t2 = startet(&m, &lager);
    sag_aabn(&t2, &id).unwrap();
    sag_valg(&t2, true, false).unwrap();
    marker_ugemt(&t);
    assert!(laas_igen(&t, Udloeser::Brugerskift));
    assert!(t.er_laast(), "låst, selv om gemningen fejlede");
    assert_eq!(levende(&t), Levende::default(), "nulstillet, selv om gemningen fejlede");
    // Ikke låst op: fejlen gives ikke ud.
    assert_eq!(laas_op(&t, &HukommelsesDoer::ny(Svar::Afvist), "da").efter, None);
    let ud = laas_op(&t, &HukommelsesDoer::ny(Svar::Ok), "da");
    let efter = EfterLaas {
        midlertidig_gemt: None,
        midlertidig_fejl: None,
        gem_fejl: Some(SagFejl::Konflikt),
    };
    assert_eq!(ud.efter, Some(efter));
    let json = serde_json::to_string(&ud).unwrap();
    assert!(
        json.contains(r#""efter":{"midlertidig_gemt":null,"midlertidig_fejl":null,"gem_fejl":{"art":"konflikt"}}"#),
        "{json}"
    );
    for h in HEMMELIGE.iter().chain([&id.as_str(), &m.0.to_str().unwrap()]) {
        assert!(!json.contains(h), "{h} står i svaret: {json}");
    }
    // Beskeden gives én gang.
    laas_igen(&t, Udloeser::Dvale);
    assert_eq!(laas_op(&t, &HukommelsesDoer::ny(Svar::Ok), "da").efter, None);
}

// ------------------------------------------------------------------------------------------------------- stilstand

/// Et program med et ur, testen styrer, låst op.
fn med_ur(graense: Option<u32>) -> (Tilstand, Arc<StyretUr>) {
    let ur = Arc::new(StyretUr::default());
    let t = Tilstand::ny().med_ur(Box::new(ur.clone()));
    if let Some(min) = graense {
        let i = Indstillinger {
            laas_efter_min: min,
            ..indstillinger_hent(&t)
        };
        indstillinger_gem(&t, i).unwrap();
    }
    masker(&t);
    t.aktivitet();
    (t, ur)
}

const MIN: Duration = Duration::from_secs(60);
const SEK: Duration = Duration::from_secs(1);

#[test]
fn stilstand_ved_5_og_15_minutter() {
    for (graense, min) in [(Some(5), 5), (None, 15)] {
        let (t, ur) = med_ur(graense);
        ur.frem(MIN * min - SEK);
        assert!(!tjek_stilstand(&t), "{min} minutter minus et sekund");
        assert!(!t.er_laast());
        ur.frem(SEK);
        assert!(tjek_stilstand(&t), "{min} minutter");
        assert!(t.er_laast());
        assert_eq!(laas_status(&t).igen, Some(Udloeser::Stilstand));
        assert_eq!(levende(&t), Levende::default());
        // Allerede låst: intet nyt, uanset hvor længe.
        ur.frem(MIN * 120);
        assert!(!tjek_stilstand(&t));
    }
}

#[test]
fn aktivitet_nulstiller_uret() {
    let (t, ur) = med_ur(None);
    ur.frem(MIN * 14);
    t.aktivitet();
    ur.frem(MIN * 14);
    assert!(!tjek_stilstand(&t), "aktivitet efter 14 minutter: uret starter forfra");
    ur.frem(MIN);
    assert!(tjek_stilstand(&t), "15 minutter efter seneste aktivitet");
    // Efter oplåsning starter uret forfra (oplåsningen er aktivitet).
    laas_op(&t, &HukommelsesDoer::ny(Svar::Ok), "da");
    ur.frem(MIN * 15 - SEK);
    assert!(!tjek_stilstand(&t));
}

#[test]
fn lang_kommando_laaser_ikke_midt_i() {
    let (t, ur) = med_ur(Some(5));
    {
        // Som `lib.rs` gør for de lange kommandoer (analyser, fil_analyser, gem og maskér …).
        let _travl = t.travl();
        ur.frem(MIN * 90);
        assert!(!tjek_stilstand(&t), "en analyse, der har kørt i halvanden time, låses ikke midt i");
        assert!(!t.er_laast() && levende(&t).originaler > 0);
    }
    assert!(!tjek_stilstand(&t), "når kommandoen slutter, starter uret forfra");
    ur.frem(MIN * 5);
    assert!(tjek_stilstand(&t));
}

// ------------------------------------------------------------------------------------------------------- kilden

fn kilde(fil: &str) -> String {
    std::fs::read_to_string(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("src").join(fil)).unwrap()
}

/// Kroppen af en funktion i `lib.rs` (til den første linje med `}` alene).
fn krop<'a>(lib: &'a str, navn: &str) -> &'a str {
    let i = lib
        .find(&format!("fn {navn}("))
        .unwrap_or_else(|| panic!("{navn} mangler i lib.rs"));
    &lib[i..i + lib[i..].find("\n}\n").unwrap()]
}

#[test]
fn unsafe_kun_i_laas_og_notifikationer() {
    // N4: `unsafe` (blok, fn, impl, extern) står kun i de tre filer, og hver forekomst har en `SAFETY:`-kommentar i
    // kommentarblokken lige over (eller på samme linje). Kommentarer og `unsafe_code` tæller ikke.
    // V-LAAS.4: også udklip.rs (NSPasteboard).
    const TILLADT: [&str; 3] = ["laas.rs", "notifikationer.rs", "udklip.rs"];
    let mappe = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("src");
    let mut fundet: Vec<(String, usize)> = Vec::new();
    let mut filer = 0;
    for e in std::fs::read_dir(&mappe).unwrap() {
        let p = e.unwrap().path();
        if p.extension().and_then(|x| x.to_str()) != Some("rs") {
            continue;
        }
        filer += 1;
        let navn = p.file_name().unwrap().to_string_lossy().into_owned();
        let tekst = std::fs::read_to_string(&p).unwrap();
        let linjer: Vec<&str> = tekst.lines().collect();
        for (i, l) in linjer.iter().enumerate() {
            let t = l.trim_start();
            if t.starts_with("//") {
                continue;
            }
            let kode = t.split("//").next().unwrap_or("");
            let brug = ["unsafe {", "unsafe fn", "unsafe impl", "unsafe extern"]
                .iter()
                .any(|m| kode.contains(m));
            if !brug {
                assert!(
                    !kode.replace("unsafe_code", "").contains("unsafe"),
                    "{navn}:{}: `unsafe` i en form, testen ikke kender: {l}",
                    i + 1
                );
                continue;
            }
            fundet.push((navn.clone(), i + 1));
            assert!(TILLADT.contains(&navn.as_str()), "{navn}:{}: `unsafe` uden for {TILLADT:?}", i + 1);
            let mut blok = String::from(*l);
            let mut j = i;
            while j > 0 && linjer[j - 1].trim_start().starts_with("//") {
                j -= 1;
                blok.push_str(linjer[j]);
            }
            assert!(
                blok.contains("SAFETY:"),
                "{navn}:{}: `unsafe` uden `SAFETY:`-kommentar lige over",
                i + 1
            );
        }
    }
    assert!(filer >= 11, "for få kildefiler: {filer}");
    let i = |f: &str| fundet.iter().filter(|(n, _)| n == f).count();
    assert!(
        i("laas.rs") >= 6 && i("notifikationer.rs") >= 2 && i("udklip.rs") >= 1,
        "{fundet:?}"
    );
    // `lib.rs` nægter `unsafe` for resten af skallen; de to moduler tillader det selv.
    assert!(kilde("lib.rs").contains("#![deny(unsafe_code)]"));
    assert!(kilde("notifikationer.rs").contains("#![allow(unsafe_code)]"));
    assert!(kilde("udklip.rs").contains("#![allow(unsafe_code)]"));
}

#[test]
fn udloeserne_gaar_gennem_laas_igen() {
    let lib = kilde("lib.rs");
    // Notifikationerne: registreret ét sted, kun på macOS, og koden bag er laas_igen_og_meld → maskering::laas_igen.
    assert_eq!(lib.matches("notifikationer::registrer(").count(), 1);
    let i = lib.find("notifikationer::registrer(").unwrap();
    assert!(lib[..i].rfind("#[cfg(target_os = \"macos\")]").is_some_and(|c| i - c < 200));
    assert!(lib[i..i + 600].contains("laas_igen_og_meld(&h, grund)"));
    assert!(krop(&lib, "laas_igen_og_meld").contains("maskering::laas_igen("));
    // Stilstand: tråden kalder tjek_stilstand (der kalder laas_igen) og melder `laast`.
    let vagt = krop(&lib, "start_stilstandsvagt");
    assert!(vagt.contains("maskering::tjek_stilstand(") && vagt.contains("meld_laast("));
    assert!(krop(&lib, "meld_laast").contains("emit(\"laast\""));
    assert_eq!(lib.matches("emit(\"laast\"").count(), 1, "hændelsen sendes ét sted");
    // De tre notifikationer og deres udløsere.
    let n = kilde("notifikationer.rs");
    for (navn, grund) in [
        ("NSWorkspaceWillSleepNotification, Udloeser::Dvale", "dvale"),
        ("NSWorkspaceScreensDidSleepNotification, Udloeser::SkaermSlukket", "skærm"),
        (
            "NSWorkspaceSessionDidResignActiveNotification, Udloeser::Brugerskift",
            "brugerskift",
        ),
    ] {
        assert!(n.contains(navn), "{grund}");
    }
    assert_eq!(
        n.matches("addObserverForName_object_queue_usingBlock(").count(),
        1,
        "én registrering i en løkke"
    );
}

#[test]
fn hver_kommando_er_aktivitet_og_lange_kommandoer_er_travle() {
    let lib = kilde("lib.rs");
    let h = lib.find(".invoke_handler(").unwrap();
    let handler = &lib[h..h + lib[h..].find("})").unwrap()];
    assert!(handler.contains("t.aktivitet()") && handler.contains("kommandoer(invoke)"));
    assert!(
        handler.find("t.aktivitet()") < handler.find("kommandoer(invoke)"),
        "aktiviteten meldes, før kommandoen kører"
    );
    for k in [
        "analyser",
        "gem_og_masker",
        "demasker",
        "sag_liste",
        "sag_aabn",
        "ordbog_proev",
        "fil_aabn",
        "fil_aabn_sluppet",
        "fil_analyser",
        "fil_raekker",
        "fil_gem_og_masker",
        "fil_demasker",
        "fil_kopi",
        "fil_gem",
    ] {
        assert!(krop(&lib, k).contains("let _travl = tilstand.travl();"), "{k} holder ikke `travl`");
    }
    // Kommandoen `aktivitet` gør intet selv og er tilladt i capabilities.
    assert!(lib.contains("fn aktivitet() {}"));
    let cap = std::fs::read_to_string(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("capabilities/default.json")).unwrap();
    assert!(cap.contains("\"allow-aktivitet\"") && !cap.contains("allow-laas-ved-start"));
}
