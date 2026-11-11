//! V-LAAS.6 N3 (skallen uden vindue): den midlertidige sag gemmes også, når programmet afsluttes uden at spørge.
//!
//! - N1: [`ved_afslut`] (Tauris `RunEvent::Exit`) gemmer en midlertidig sag med poster, som brugeren ikke har svaret på
//!   (hverken Gem som sag eller Kassér), som ved lås: samme navn, standardudløb, egen ny nøgle. Kassér, Gem som sag, en
//!   tom sag, en navngiven sag og et låst Grimnir gemmer intet nyt. Udklipsholderen ryddes før sagen. Præcis ét opslag i
//!   nøglelageret. Fejler gemningen, afslutter programmet alligevel uden at efterlade en nøgle. Vagten om nøglelageret
//!   holder under afslutningen, og afslutningen venter højst [`AFSLUT_VENT`] på en kommando, der holder sagen.
//! - N2: navnet står i `<app-data>/gemt-ved-afslut.json` og siges efter næste oplåsning, én gang.
//!
//! Tests kalder aldrig `LAContext`, rører aldrig Nøglering (nøglelageret er `HukommelsesLager` bag en logbog) og læser
//! eller skriver aldrig den rigtige udklipsholder (`HukommelsesUdklip`). "Næste start" er en ny `Tilstand` på samme
//! mappe og samme nøglelager. Kun opdigtede værdier (`kontor.test`, RFC 1918, opfundne navne). Mappen er en midlertidig
//! mappe, der slettes igen.

use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{mpsc, Arc, Mutex};
use std::time::{Duration, Instant};

use grimnir_lib::indstillinger::{er_midlertidigt_navn, Indstillinger, GEMT_FILNAVN};
use grimnir_lib::klokke::StyretKlokke;
use grimnir_lib::laas::{HukommelsesDoer, Svar, Udloeser};
use grimnir_lib::maskering::{
    aabn_forbi_porten, analyser, demasker, gem_og_masker, indstillinger_gem, indstillinger_hent, laas_igen, laas_op, levende, sag_aabn,
    sag_liste, sag_luk, sag_ny, sag_status, udklip_kopieret, ved_afslut, EfterLaas, Tilstand, UiFejl, AFSLUT_VENT,
};
use grimnir_lib::sager::{HukommelsesLager, Noegle, Noeglelager, SagFejl, SagsId};
use grimnir_lib::udklip::{HukommelsesUdklip, Indhold, Udklip};

/// En midlertidig mappe, der slettes igen.
struct Mappe(PathBuf);
impl Mappe {
    fn ny() -> Self {
        let p = std::env::temp_dir().join(format!("grimnir-laas6-{}", SagsId::ny().unwrap().hex()));
        std::fs::create_dir_all(&p).unwrap();
        Mappe(p)
    }
    fn sager(&self) -> Vec<PathBuf> {
        match std::fs::read_dir(self.0.join("sager")) {
            Ok(l) => l.map(|e| e.unwrap().path()).collect(),
            Err(_) => Vec::new(),
        }
    }
    fn gemt(&self) -> PathBuf {
        self.0.join(GEMT_FILNAVN)
    }
}
impl Drop for Mappe {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}

type Krog = Box<dyn FnOnce() + Send>;
type Logbog = Arc<Mutex<Vec<String>>>;

/// Et nøglelager i hukommelsen, der skriver hvert opslag i en logbog (`hent:`, `gem:` eller `slet:` og kontoen); kan
/// køre en krog én gang, næste gang en nøgle gemmes, og kan få hver gemning til at fejle.
#[derive(Default)]
struct Loglager {
    lager: HukommelsesLager,
    log: Logbog,
    krog: Mutex<Option<Krog>>,
    fejl: AtomicBool,
}
impl Loglager {
    fn med(log: &Logbog) -> Self {
        Loglager {
            log: log.clone(),
            ..Loglager::default()
        }
    }
    fn tag(&self) -> Vec<String> {
        std::mem::take(&mut *self.log.lock().unwrap())
    }
}
impl Noeglelager for Loglager {
    fn hent_konto(&self, konto: &str) -> Result<Noegle, SagFejl> {
        self.log.lock().unwrap().push(format!("hent:{konto}"));
        self.lager.hent_konto(konto)
    }
    fn gem_konto(&self, konto: &str, noegle: &Noegle) -> Result<(), SagFejl> {
        self.log.lock().unwrap().push(format!("gem:{konto}"));
        let krog = self.krog.lock().unwrap().take();
        if let Some(k) = krog {
            k();
        }
        if self.fejl.load(Ordering::SeqCst) {
            return Err(SagFejl::Noeglering { hvad: "andet" });
        }
        self.lager.gem_konto(konto, noegle)
    }
    fn slet_konto(&self, konto: &str) -> Result<(), SagFejl> {
        self.log.lock().unwrap().push(format!("slet:{konto}"));
        self.lager.slet_konto(konto)
    }
}

/// En udklipsholder i hukommelsen, der skriver `ryd` i samme logbog som nøglelageret (rækkefølgen).
struct LogUdklip {
    u: HukommelsesUdklip,
    log: Logbog,
}
impl Udklip for LogUdklip {
    fn taeller(&self) -> Option<isize> {
        self.u.taeller()
    }
    fn tekst(&self) -> Indhold {
        self.u.tekst()
    }
    fn ryd(&self) {
        self.log.lock().unwrap().push("ryd".to_string());
        self.u.ryd();
    }
}

const TEKST: &str = "srv-db02.kontor.test 10.30.0.7 bruger=birthe.eksempel\n";
/// Værdierne i [`TEKST`], der aldrig må stå i klartekst på disken.
const HEMMELIGE: [&str; 3] = ["srv-db02", "10.30.0.7", "birthe.eksempel"];
/// 2026-11-11 08:06:07 UTC (som i laas5.rs); i Danmark (UTC+1) 09.06.07.
const NU_MS: u64 = 1_794_384_330_000 + 37_000;
const DK: i32 = 3600;
const NAVN: &str = "Midlertidig 2026-11-11 09.06.07";

/// Programmet startes (låst) på mappen og låses op med `sprog`.
fn startet(m: &Mappe, lager: &Arc<Loglager>, sprog: &str) -> Tilstand {
    let t = start(m, lager);
    assert_eq!(laas_op(&t, &HukommelsesDoer::ny(Svar::Ok), sprog).svar, Svar::Ok);
    t
}

/// Programmet startes (låst) på mappen, som ved næste start.
fn start(m: &Mappe, lager: &Arc<Loglager>) -> Tilstand {
    Tilstand::paa_disk(m.0.clone(), lager.clone())
        .med_klokke(Box::new(StyretKlokke::ny(NU_MS, DK)))
        .ved_start()
}

fn masker(t: &Tilstand) -> String {
    let a = analyser(t, TEKST, None, &[]).unwrap();
    let fra: Vec<usize> = a.raekker.iter().filter(|r| !r.valgt).map(|r| r.id).collect();
    gem_og_masker(t, TEKST, &fra, &[]).unwrap().maskeret
}

fn oplaas(t: &Tilstand, sprog: &str) -> Option<EfterLaas> {
    let ud = laas_op(t, &HukommelsesDoer::ny(Svar::Ok), sprog);
    assert!(!ud.status.laast);
    ud.efter
}

fn gemt(navn: &str) -> Option<EfterLaas> {
    Some(EfterLaas {
        midlertidig_gemt: Some(navn.to_string()),
        ..EfterLaas::default()
    })
}

/// Ingen fil i mappen (rekursivt) har en af [`HEMMELIGE`] i klartekst.
fn intet_i_klartekst(m: &Mappe) {
    let mut stak = vec![m.0.clone()];
    while let Some(d) = stak.pop() {
        for e in std::fs::read_dir(&d).unwrap() {
            let p = e.unwrap().path();
            if p.is_dir() {
                stak.push(p);
                continue;
            }
            let b = std::fs::read(&p).unwrap();
            let s = String::from_utf8_lossy(&b);
            for h in HEMMELIGE {
                assert!(!s.contains(h), "{h} i klartekst i {}", p.display());
            }
        }
    }
}

// ------------------------------------------------------------------------------------------------------- N1

#[test]
fn ubesvaret_midlertidig_sag_gemmes_og_kan_demaskere_ved_naeste_start() {
    for (sprog, navn) in [("da", NAVN), ("en", "Temporary 2026-11-11 09.06.07")] {
        let m = Mappe::ny();
        let log = Logbog::default();
        let lager = Arc::new(Loglager::med(&log));
        let t = startet(&m, &lager, sprog);
        let i = Indstillinger {
            udloeb_dage: Some(30),
            ..indstillinger_hent(&t)
        };
        indstillinger_gem(&t, i).unwrap();
        let maskeret = masker(&t);
        assert!(
            sag_status(&t).unwrap().id.is_none() && t.skal_spoerge_ved_luk(),
            "ubesvaret midlertidig sag"
        );
        lager.tag();
        // Afslut fra Dock / log ud: ingen har svaret.
        ved_afslut(&t);
        let opslag = lager.tag();
        assert_eq!(opslag.len(), 1, "{sprog}: præcis ét opslag: {opslag:?}");
        assert!(opslag[0].starts_with("gem:sag:"), "{sprog}: den nye sags nøgle: {opslag:?}");
        assert!(t.er_laast(), "låst under og efter gemningen");
        let l = levende(&t);
        assert_eq!((l.noegler, l.originaler), (0, 0), "sagen er nulstillet");
        assert_eq!(m.sager().len(), 1, "{sprog}: én sagsfil");
        // N2: kun navnet står i filen.
        assert_eq!(
            std::fs::read_to_string(m.gemt()).unwrap(),
            format!("{{\"midlertidig_gemt\":\"{navn}\"}}\n"),
            "{sprog}"
        );
        intet_i_klartekst(&m);
        drop(t);

        // Næste start: beskeden efter oplåsningen; sagen står i listen med standardudløbet og demaskerer.
        let t = start(&m, &lager);
        assert_eq!(
            laas_op(&t, &HukommelsesDoer::ny(Svar::Annulleret), sprog).efter,
            None,
            "ikke låst op: intet"
        );
        assert!(m.gemt().exists(), "beskeden venter på oplåsningen");
        assert_eq!(oplaas(&t, sprog), gemt(navn), "{sprog}");
        assert!(!m.gemt().exists(), "{sprog}: beskeden er givet, filen er slettet");
        let liste = sag_liste(&t).unwrap();
        assert_eq!(liste.len(), 1);
        assert_eq!(liste[0].navn.as_deref(), Some(navn));
        assert_eq!(liste[0].udloeb.as_deref(), Some("2026-12-11"), "standardudløbet (30 dage)");
        assert_eq!(
            format!("gem:{}", SagsId::fra_hex(&liste[0].id).unwrap().konto()),
            opslag[0],
            "sin egen nye nøgle"
        );
        assert_eq!(sag_aabn(&t, &liste[0].id).unwrap().navn.as_deref(), Some(navn));
        assert_eq!(demasker(&t, &maskeret).unwrap().tekst, TEKST, "{sprog}");
    }
}

#[test]
fn kasser_og_gem_som_sag_gemmer_intet_nyt() {
    // Kassér: program_afslut kalder tillad_afslut, før programmet afslutter.
    let m = Mappe::ny();
    let lager = Arc::new(Loglager::default());
    let t = startet(&m, &lager, "da");
    masker(&t);
    lager.tag();
    t.tillad_afslut();
    ved_afslut(&t);
    assert_eq!(lager.tag(), Vec::<String>::new(), "Kassér: intet opslag");
    assert!(m.sager().is_empty() && !m.gemt().exists(), "Kassér: ingen sag, ingen besked");
    intet_i_klartekst(&m);

    // Gem som sag: sag_ny, derefter program_afslut.
    let m = Mappe::ny();
    let lager = Arc::new(Loglager::default());
    let t = startet(&m, &lager, "da");
    masker(&t);
    sag_ny(&t, "Uglebo-sagen", None).unwrap();
    t.tillad_afslut();
    lager.tag();
    ved_afslut(&t);
    assert_eq!(lager.tag(), Vec::<String>::new(), "Gem som sag: intet opslag");
    assert_eq!(m.sager().len(), 1, "kun den sag, brugeren gemte");
    assert!(!m.gemt().exists());
    let t = start(&m, &lager);
    assert_eq!(oplaas(&t, "da"), None, "ingen besked ved næste start");
}

#[test]
fn tom_midlertidig_sag_gemmes_ikke() {
    let m = Mappe::ny();
    let lager = Arc::new(Loglager::default());
    let t = startet(&m, &lager, "da");
    lager.tag();
    ved_afslut(&t);
    assert_eq!(lager.tag(), Vec::<String>::new());
    assert!(m.sager().is_empty() && !m.gemt().exists());
    // Også efter Luk sag (ny, tom midlertidig sag).
    let m = Mappe::ny();
    let t = startet(&m, &lager, "da");
    masker(&t);
    sag_ny(&t, "Kragevig-sagen", None).unwrap();
    sag_luk(&t).unwrap();
    lager.tag();
    ved_afslut(&t);
    assert_eq!(lager.tag(), Vec::<String>::new());
    assert_eq!(m.sager().len(), 1);
    assert!(!m.gemt().exists());
}

#[test]
fn navngiven_sag_er_uaendret() {
    let m = Mappe::ny();
    let lager = Arc::new(Loglager::default());
    let t = startet(&m, &lager, "da");
    let maskeret = masker(&t);
    sag_ny(&t, "Ravnsted-sagen", None).unwrap();
    // ⌘Q med en navngiven sag spørger ikke; programmet afslutter uden tillad_afslut.
    assert!(!t.skal_spoerge_ved_luk());
    let fil = m.sager().pop().unwrap();
    let foer = std::fs::read(&fil).unwrap();
    let tid = std::fs::metadata(&fil).unwrap().modified().unwrap();
    lager.tag();
    ved_afslut(&t);
    assert_eq!(lager.tag(), Vec::<String>::new(), "intet opslag");
    assert_eq!(m.sager(), vec![fil.clone()], "ingen ny sag");
    assert_eq!(std::fs::read(&fil).unwrap(), foer, "filen er byte for byte den samme");
    assert_eq!(std::fs::metadata(&fil).unwrap().modified().unwrap(), tid);
    assert!(!m.gemt().exists());
    let t = start(&m, &lager);
    assert_eq!(oplaas(&t, "da"), None);
    let id = sag_liste(&t).unwrap()[0].id.clone();
    sag_aabn(&t, &id).unwrap();
    assert_eq!(demasker(&t, &maskeret).unwrap().tekst, TEKST);
}

#[test]
fn laast_grimnir_gemmer_intet() {
    // Låsen har gemt sagen; afslutningen gemmer intet nyt.
    let m = Mappe::ny();
    let lager = Arc::new(Loglager::default());
    let t = startet(&m, &lager, "da");
    masker(&t);
    assert!(laas_igen(&t, Udloeser::Dvale));
    assert_eq!(m.sager().len(), 1, "gemt af låsen");
    lager.tag();
    ved_afslut(&t);
    assert_eq!(lager.tag(), Vec::<String>::new());
    assert_eq!(m.sager().len(), 1);
    // V-PUDS.1 N1: låsen har skrevet navnet (så beskeden overlever afslutningen); afslutningen rører det ikke.
    assert_eq!(
        std::fs::read_to_string(m.gemt()).unwrap(),
        format!("{{\"midlertidig_gemt\":\"{NAVN}\"}}\n")
    );
    // Låst fra start og aldrig låst op.
    let m = Mappe::ny();
    let t = start(&m, &lager);
    lager.tag();
    ved_afslut(&t);
    assert_eq!(lager.tag(), Vec::<String>::new());
    assert!(m.sager().is_empty() && !m.gemt().exists());
}

#[test]
fn fejl_ved_gemningen_afslutter_alligevel_uden_noegle() {
    // Nøglelageret fejler.
    let m = Mappe::ny();
    let lager = Arc::new(Loglager::default());
    let t = startet(&m, &lager, "da");
    masker(&t);
    lager.fejl.store(true, Ordering::SeqCst);
    ved_afslut(&t);
    assert!(t.er_laast());
    assert_eq!(levende(&t).originaler, 0, "nulstillet");
    assert_eq!(lager.lager.antal(), 0, "ingen nøgle");
    assert!(m.sager().is_empty() && !m.gemt().exists(), "intet skrevet");
    intet_i_klartekst(&m);
    lager.fejl.store(false, Ordering::SeqCst);
    let t = start(&m, &lager);
    assert_eq!(oplaas(&t, "da"), None, "ingen besked ved næste start");

    // Disken fejler, efter nøglen er gemt: mappen til sagerne erstattes af en fil, før sagsfilen skrives. Arkiv::opret
    // sletter nøglen igen.
    let m = Mappe::ny();
    let lager = Arc::new(Loglager::default());
    let t = startet(&m, &lager, "da");
    masker(&t);
    let sager = m.0.join("sager");
    *lager.krog.lock().unwrap() = Some(Box::new(move || {
        let _ = std::fs::remove_dir_all(&sager);
        std::fs::write(&sager, b"ikke en mappe").unwrap();
    }));
    lager.tag();
    ved_afslut(&t);
    let opslag = lager.tag();
    assert_eq!(opslag.len(), 2, "{opslag:?}");
    assert!(
        opslag[0].starts_with("gem:sag:") && opslag[1] == opslag[0].replacen("gem:", "slet:", 1),
        "{opslag:?}"
    );
    assert_eq!(lager.lager.antal(), 0, "ingen nøgle efterladt");
    assert!(t.er_laast());
    assert!(!m.gemt().exists(), "ingen besked");
    intet_i_klartekst(&m);
}

#[test]
fn udklipsholderen_ryddes_foer_sagen_gemmes() {
    for laesbar in [false, true] {
        let m = Mappe::ny();
        let log = Logbog::default();
        let lager = Arc::new(Loglager::med(&log));
        let u = Arc::new(LogUdklip {
            u: HukommelsesUdklip::ny(laesbar),
            log: log.clone(),
        });
        let t = Tilstand::paa_disk(m.0.clone(), lager.clone())
            .med_klokke(Box::new(StyretKlokke::ny(NU_MS, DK)))
            .med_udklip(Some(Box::new(u.clone())))
            .ved_start();
        oplaas(&t, "da");
        let maskeret = masker(&t);
        let d = demasker(&t, &maskeret).unwrap();
        u.u.skriv(&d.tekst);
        assert_eq!(udklip_kopieret(&t, false), Ok(true));
        lager.tag();
        ved_afslut(&t);
        let alt = lager.tag();
        assert_eq!(alt.len(), 2, "{laesbar}: {alt:?}");
        assert_eq!(alt[0], "ryd", "{laesbar}: udklipsholderen først");
        assert!(alt[1].starts_with("gem:sag:"), "{laesbar}: derefter sagens nøgle: {alt:?}");
        assert_eq!(u.u.nu(), None);
        assert_eq!(
            std::fs::read_to_string(m.gemt()).unwrap(),
            format!("{{\"midlertidig_gemt\":\"{NAVN}\"}}\n")
        );
    }
}

#[test]
fn vagten_holder_under_afslutningen() {
    let m = Mappe::ny();
    let lager = Arc::new(Loglager::default());
    let t = Arc::new(startet(&m, &lager, "da"));
    // En navngiven sag på disk, som en anden tråd prøver at læse midt i afslutningen.
    masker(&t);
    let id = sag_ny(&t, "Uglebo-sagen", None).unwrap().id.unwrap();
    sag_luk(&t).unwrap();
    masker(&t);
    let koert = Arc::new(AtomicBool::new(false));
    {
        let (t, id, koert) = (t.clone(), id.clone(), koert.clone());
        *lager.krog.lock().unwrap() = Some(Box::new(move || {
            // Midt i afslutningen: den midlertidige sags nøgle er ved at blive oprettet.
            assert!(t.er_laast());
            assert_eq!(sag_status(&t), Err(UiFejl::Laast));
            assert_eq!(sag_liste(&t).map(|_| ()), Err(UiFejl::Laast));
            let (t2, id2) = (t.clone(), id.clone());
            let anden = std::thread::spawn(move || aabn_forbi_porten(&t2, &id2));
            assert_eq!(anden.join().unwrap(), Err(SagFejl::Noeglering { hvad: "laast" }));
            koert.store(true, Ordering::SeqCst);
        }));
    }
    ved_afslut(&t);
    assert!(koert.load(Ordering::SeqCst), "krogen kørte midt i afslutningen");
    // Bagefter er undtagelsen sluppet: heller ikke den tråd, der afsluttede, kommer forbi vagten.
    assert_eq!(aabn_forbi_porten(&t, &id), Err(SagFejl::Noeglering { hvad: "laast" }));
    assert_eq!(m.sager().len(), 2);
}

#[test]
fn afslutningen_venter_hoejst_fristen_paa_en_kommando() {
    // Gem som sag står og venter i nøglelageret (som når Nøglering spørger) og holder sagens lås. Afslut fra Dock kommer
    // imens: afslutningen venter højst AFSLUT_VENT og gemmer så intet (sagen bliver gemt af kommandoen selv).
    let m = Mappe::ny();
    let lager = Arc::new(Loglager::default());
    let t = Arc::new(startet(&m, &lager, "da"));
    masker(&t);
    let (inde_tx, inde_rx) = mpsc::channel();
    let (slip_tx, slip_rx) = mpsc::channel::<()>();
    *lager.krog.lock().unwrap() = Some(Box::new(move || {
        inde_tx.send(()).unwrap();
        let _ = slip_rx.recv_timeout(Duration::from_secs(20));
    }));
    let kommando = {
        let t = t.clone();
        std::thread::spawn(move || sag_ny(&t, "Kragevig-sagen", None).map(|s| s.id))
    };
    inde_rx.recv().unwrap();
    let start = Instant::now();
    ved_afslut(&t);
    let gaaet = start.elapsed();
    assert!(gaaet >= AFSLUT_VENT, "ventede på kommandoen: {gaaet:?}");
    assert!(
        gaaet < AFSLUT_VENT + Duration::from_secs(3),
        "men ikke længere end fristen: {gaaet:?}"
    );
    assert!(t.er_laast());
    slip_tx.send(()).unwrap();
    assert!(kommando.join().unwrap().unwrap().is_some(), "kommandoen gemte sagen selv");
    assert_eq!(m.sager().len(), 1, "kun sagen fra kommandoen");
    assert!(!m.gemt().exists());
}

// ------------------------------------------------------------------------------------------------------- N2

#[test]
fn beskeden_ved_naeste_start_kun_en_gang() {
    let m = Mappe::ny();
    let lager = Arc::new(Loglager::default());
    let t = startet(&m, &lager, "da");
    masker(&t);
    ved_afslut(&t);
    drop(t);
    // Næste start, men programmet afsluttes fra låseskærmen uden oplåsning: beskeden venter stadig.
    let t = start(&m, &lager);
    ved_afslut(&t);
    assert!(m.gemt().exists(), "ikke låst op: beskeden er ikke givet");
    drop(t);
    // Start igen: beskeden én gang.
    let t = start(&m, &lager);
    assert_eq!(oplaas(&t, "da"), gemt(NAVN));
    // Ikke igen efter en ny lås uden poster i samme kørsel …
    laas_igen(&t, Udloeser::Stilstand);
    assert_eq!(oplaas(&t, "da"), None);
    ved_afslut(&t);
    drop(t);
    // … og ikke ved næste start.
    let t = start(&m, &lager);
    assert_eq!(oplaas(&t, "da"), None);
    assert_eq!(sag_liste(&t).unwrap().len(), 1);
}

#[test]
fn filen_baerer_kun_grimnirs_eget_navn() {
    assert!(er_midlertidigt_navn("Midlertidig 2026-11-11 09.06.07"));
    assert!(er_midlertidigt_navn("Temporary 2026-11-11 09.06.07"));
    for n in [
        "Midlertidig 2026-11-11 09.06",
        "Midlertidig 2026-11-11 09.06.07 ",
        "Uglebo-sagen",
        "Temporary 2026-11-11T09.06.07",
        "Midlertidig <img src=x> 09.06.07",
        "",
    ] {
        assert!(!er_midlertidigt_navn(n), "{n}");
    }
    // En fil, der er rettet i hånden (andet navn eller andre felter), giver ingen besked, og den slettes ved oplåsningen.
    let lager = Arc::new(Loglager::default());
    for indhold in [
        r#"{"midlertidig_gemt":"Uglebo-sagen"}"#,
        r#"{"midlertidig_gemt":"Midlertidig 2026-11-11 09.06.07","poster":3}"#,
        r#"ikke json"#,
    ] {
        let m = Mappe::ny();
        std::fs::write(m.gemt(), indhold).unwrap();
        let t = start(&m, &lager);
        assert_eq!(oplaas(&t, "da"), None, "{indhold}");
        assert!(!m.gemt().exists(), "{indhold}");
    }
}

// ------------------------------------------------------------------------------------------------------- kilden

fn kode() -> String {
    std::fs::read_to_string(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("src/maskering.rs"))
        .unwrap()
        .lines()
        .filter(|l| !l.trim_start().starts_with("//"))
        .collect::<Vec<_>>()
        .join("\n")
}

#[test]
fn en_funktion_gemmer_og_nulstiller() {
    let m = kode();
    // gem_og_nulstil_sag: defineret og kaldt fra laas_igen og ved_afslut; ingen kopi af koden.
    assert_eq!(m.matches("gem_og_nulstil_sag(").count(), 3);
    assert_eq!(m.matches("gem_midlertidig(").count(), 2, "defineret og kaldt ét sted");
    assert_eq!(m.matches("Undtagelse::ny(").count(), 1, "undtagelsen tages ét sted");
    let i = m.find("fn gem_og_nulstil_sag(").unwrap();
    let krop = &m[i..i + m[i..].find("\n}\n").unwrap()];
    assert!(krop.contains("gem_midlertidig(") && krop.contains("Undtagelse::ny("));
    // Navnet skrives ét sted (husk_gemt_navn, V-PUDS.1 N1), kun efter en vellykket gemning: i ved_afslut og i laas_igen.
    assert_eq!(m.matches("gem_gemt_navn(").count(), 1);
    assert_eq!(
        m.matches("husk_gemt_navn(").count(),
        3,
        "defineret og kaldt fra ved_afslut og laas_igen"
    );
    let i = m.find("pub fn ved_afslut(").unwrap();
    let ved = &m[i..i + m[i..].find("\n}\n").unwrap()];
    assert!(ved.contains("if let Some(Ok(navn)) = &gemt.midlertidig {") && ved.contains("husk_gemt_navn(t, navn)"));
    let i = m.find("pub fn laas_igen(").unwrap();
    let laas = &m[i..i + m[i..].find("\n}\n").unwrap()];
    assert!(laas.contains("if let Some(Ok(navn)) = &midlertidig {") && laas.contains("husk_gemt_navn(t, navn)"));
    assert!(ved.find(".swap(true") < ved.find("t.sag_inden("), "låst før sagens lås");
}
