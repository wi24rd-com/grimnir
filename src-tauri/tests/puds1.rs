//! V-PUDS.1 N5 (skallen uden vindue): småting efter låsecyklerne og vinduesprøven.
//!
//! - N1: gemmer en lås ([`laas_igen`]) den midlertidige sag, skrives navnet også i `<app-data>/gemt-ved-afslut.json`, så
//!   beskeden kommer, selv om programmet afsluttes fra låseskærmen uden oplåsning. Den gives præcis én gang: ved
//!   oplåsningen i samme kørsel (og filen slettes) eller ved næste start. Fejlbeskederne skrives ikke til disk.
//! - N4: Demaskér svarer med antal steder og første linje for hver kode, der er sat tilbage (`tilbage`), for indsat tekst
//!   og for en fil; CRLF, en kode to gange på samme linje, og koden med andre store/små bogstaver. Kun koder og tal, ingen
//!   originaler.
//!
//! Tests kalder aldrig `LAContext`, rører aldrig Nøglering (nøglelageret er `HukommelsesLager` bag en logbog) og læser
//! eller skriver aldrig den rigtige udklipsholder. "Næste start" er en ny `Tilstand` på samme mappe og samme nøglelager.
//! Kun opdigtede værdier (`kontor.test`, RFC 1918, opfundne navne). Mappen er en midlertidig mappe, der slettes igen.

use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

use grimnir_lib::indstillinger::GEMT_FILNAVN;
use grimnir_lib::klokke::StyretKlokke;
use grimnir_lib::laas::{HukommelsesDoer, Svar, Udloeser};
use grimnir_lib::maskering::{
    analyser, demasker, fil_aabn, fil_demasker, gem_og_masker, laas_igen, laas_op, sag_liste, ved_afslut, EfterLaas, TilbageUd, Tilstand,
    Visning,
};
use grimnir_lib::sager::{HukommelsesLager, Noegle, Noeglelager, SagFejl, SagsId};

/// En midlertidig mappe, der slettes igen.
struct Mappe(PathBuf);
impl Mappe {
    fn ny() -> Self {
        let p = std::env::temp_dir().join(format!("grimnir-puds1-{}", SagsId::ny().unwrap().hex()));
        std::fs::create_dir_all(&p).unwrap();
        Mappe(p)
    }
    fn sager(&self) -> usize {
        std::fs::read_dir(self.0.join("sager")).map(|l| l.count()).unwrap_or(0)
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

/// Et nøglelager i hukommelsen, der skriver hvert opslag i en logbog og kan få hver gemning til at fejle.
#[derive(Default)]
struct Loglager {
    lager: HukommelsesLager,
    log: Mutex<Vec<String>>,
    fejl: AtomicBool,
}
impl Noeglelager for Loglager {
    fn hent_konto(&self, konto: &str) -> Result<Noegle, SagFejl> {
        self.log.lock().unwrap().push(format!("hent:{konto}"));
        self.lager.hent_konto(konto)
    }
    fn gem_konto(&self, konto: &str, noegle: &Noegle) -> Result<(), SagFejl> {
        self.log.lock().unwrap().push(format!("gem:{konto}"));
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

const TEKST: &str = "srv-db02.kontor.test 10.30.0.7 bruger=birthe.eksempel\n";
/// Værdierne i [`TEKST`], der aldrig må stå i klartekst på disken eller i Demaskér-svarets tal.
const HEMMELIGE: [&str; 3] = ["srv-db02", "10.30.0.7", "birthe.eksempel"];
/// 2026-11-11 08:06:07 UTC (som i laas5.rs og laas6.rs); i Danmark (UTC+1) 09.06.07.
const NU_MS: u64 = 1_794_384_330_000 + 37_000;
const DK: i32 = 3600;
const NAVN: &str = "Midlertidig 2026-11-11 09.06.07";
const NAVN_EN: &str = "Temporary 2026-11-11 09.06.07";

/// Programmet startes (låst) på mappen, som ved næste start.
fn start(m: &Mappe, lager: &Arc<Loglager>) -> Tilstand {
    Tilstand::paa_disk(m.0.clone(), lager.clone())
        .med_klokke(Box::new(StyretKlokke::ny(NU_MS, DK)))
        .ved_start()
}

/// Programmet startes og låses op med `sprog`.
fn startet(m: &Mappe, lager: &Arc<Loglager>, sprog: &str) -> Tilstand {
    let t = start(m, lager);
    assert_eq!(oplaas(&t, sprog), None, "ingen besked ved første start");
    t
}

fn oplaas(t: &Tilstand, sprog: &str) -> Option<EfterLaas> {
    let ud = laas_op(t, &HukommelsesDoer::ny(Svar::Ok), sprog);
    assert!(!ud.status.laast);
    ud.efter
}

fn masker_i(t: &Tilstand, tekst: &str) -> String {
    let a = analyser(t, tekst, None, &[]).unwrap();
    let fra: Vec<usize> = a.raekker.iter().filter(|r| !r.valgt).map(|r| r.id).collect();
    gem_og_masker(t, tekst, &fra, &[]).unwrap().maskeret
}

fn gemt(navn: &str) -> Option<EfterLaas> {
    Some(EfterLaas {
        midlertidig_gemt: Some(navn.to_string()),
        ..EfterLaas::default()
    })
}

/// Filen bærer kun navnet (ét felt, intet fra sagen).
fn fil_med(m: &Mappe, navn: &str) {
    let indhold = std::fs::read_to_string(m.gemt()).expect("filen findes");
    assert_eq!(indhold, format!("{{\"midlertidig_gemt\":\"{navn}\"}}\n"));
    for h in HEMMELIGE {
        assert!(!indhold.contains(h));
    }
}

// ------------------------------------------------------------------------------------------------------- N1

#[test]
fn laas_og_afslut_fra_laaseskaermen_beskeden_kommer_ved_naeste_start_en_gang() {
    let m = Mappe::ny();
    let lager = Arc::new(Loglager::default());
    let t = startet(&m, &lager, "da");
    masker_i(&t, TEKST);
    assert!(laas_igen(&t, Udloeser::Dvale));
    assert_eq!(m.sager(), 1, "låsen har gemt sagen");
    fil_med(&m, NAVN);
    // Afslut fra låseskærmen: intet nyt gemmes, og filen står.
    ved_afslut(&t);
    drop(t);
    assert_eq!(m.sager(), 1);
    fil_med(&m, NAVN);
    // Næste start, men afsluttet igen fra låseskærmen: beskeden venter stadig.
    let t = start(&m, &lager);
    ved_afslut(&t);
    drop(t);
    fil_med(&m, NAVN);
    // Næste start med oplåsning: beskeden én gang, og filen er væk.
    let t = start(&m, &lager);
    assert_eq!(oplaas(&t, "da"), gemt(NAVN));
    assert!(!m.gemt().exists());
    assert_eq!(
        sag_liste(&t).unwrap().iter().filter(|s| s.navn.as_deref() == Some(NAVN)).count(),
        1,
        "sagen står i listen"
    );
    // Ikke igen i samme kørsel …
    laas_igen(&t, Udloeser::Stilstand);
    assert_eq!(oplaas(&t, "da"), None);
    ved_afslut(&t);
    drop(t);
    // … og ikke ved næste start.
    let t = start(&m, &lager);
    assert_eq!(oplaas(&t, "da"), None);
    assert_eq!(m.sager(), 1);
}

#[test]
fn laas_og_oplaasning_i_samme_koersel_giver_beskeden_en_gang_og_sletter_filen() {
    for (sprog, navn) in [("da", NAVN), ("en", NAVN_EN)] {
        let m = Mappe::ny();
        let lager = Arc::new(Loglager::default());
        let t = startet(&m, &lager, sprog);
        masker_i(&t, TEKST);
        assert!(laas_igen(&t, Udloeser::SkaermSlukket));
        fil_med(&m, navn);
        assert_eq!(oplaas(&t, sprog), gemt(navn), "{sprog}: beskeden ved oplåsningen");
        assert!(!m.gemt().exists(), "{sprog}: filen er slettet, da beskeden blev givet");
        // En ny lås uden poster, oplåsning og afslutning: ingen besked, ingen fil.
        laas_igen(&t, Udloeser::Dvale);
        assert_eq!(oplaas(&t, sprog), None);
        assert!(!m.gemt().exists());
        ved_afslut(&t);
        drop(t);
        let t = start(&m, &lager);
        assert_eq!(oplaas(&t, sprog), None, "{sprog}: ikke igen ved næste start");
        assert_eq!(m.sager(), 1);
    }
}

#[test]
fn to_laase_i_samme_koersel_med_oplaasning_imellem_hver_sin_besked() {
    let m = Mappe::ny();
    let lager = Arc::new(Loglager::default());
    let t = startet(&m, &lager, "da");
    masker_i(&t, TEKST);
    laas_igen(&t, Udloeser::Dvale);
    assert_eq!(oplaas(&t, "da"), gemt(NAVN));
    // Anden lås med en ny midlertidig sag; afsluttes fra låseskærmen.
    masker_i(&t, "db-test01.kontor.test 10.30.0.9\n");
    laas_igen(&t, Udloeser::Stilstand);
    fil_med(&m, NAVN);
    ved_afslut(&t);
    drop(t);
    let t = start(&m, &lager);
    assert_eq!(oplaas(&t, "da"), gemt(NAVN), "den anden lås' navn, én gang");
    assert!(!m.gemt().exists());
    assert_eq!(m.sager(), 2);
}

#[test]
fn fejl_ved_laasen_skrives_ikke_til_disk() {
    let m = Mappe::ny();
    let lager = Arc::new(Loglager::default());
    let t = startet(&m, &lager, "da");
    masker_i(&t, TEKST);
    lager.fejl.store(true, Ordering::SeqCst);
    laas_igen(&t, Udloeser::Dvale);
    assert_eq!(m.sager(), 0);
    assert!(!m.gemt().exists(), "midlertidig_fejl skrives ikke til disk");
    // I samme kørsel gives fejlen ved oplåsningen (som før) …
    let e = oplaas(&t, "da").expect("fejlen gives");
    assert!(e.midlertidig_gemt.is_none() && e.midlertidig_fejl.is_some());
    // … men efter en afslutning fra låseskærmen er den tabt (se HANDOFF).
    lager.fejl.store(false, Ordering::SeqCst);
    masker_i(&t, TEKST);
    lager.fejl.store(true, Ordering::SeqCst);
    laas_igen(&t, Udloeser::Dvale);
    ved_afslut(&t);
    drop(t);
    assert!(!m.gemt().exists());
    let t = start(&m, &lager);
    assert_eq!(oplaas(&t, "da"), None);
}

// ------------------------------------------------------------------------------------------------------- N4

/// En tekst med tre værdier, der maskeres som standard i en sag uden ordbog: to egne adresser og en bruger.
const TEKST4: &str = "srcip=10.20.30.11 dstip=10.20.30.12 user=\"bruger060\"\r\n";
const HEMMELIGE4: [&str; 3] = ["10.20.30.11", "10.20.30.12", "bruger060"];

/// Koderne i sagen efter én maskering (fra et demaskér af den maskerede tekst, så de er sagens egne).
fn koder(t: &Tilstand, maskeret: &str) -> Vec<String> {
    demasker(t, maskeret).unwrap().koder
}

/// `tilbage` for koden.
fn for_kode<'a>(tilbage: &'a [TilbageUd], kode: &str) -> &'a TilbageUd {
    tilbage
        .iter()
        .find(|x| x.kode == kode)
        .unwrap_or_else(|| panic!("{kode} mangler i {tilbage:?}"))
}

#[test]
fn demasker_tekst_antal_og_foerste_linje_crlf_og_to_gange_paa_en_linje() {
    let t = Tilstand::ny();
    let maskeret = masker_i(&t, TEKST4);
    let k = koder(&t, &maskeret);
    assert!(k.len() >= 3, "{k:?}");
    let (a, b, c) = (&k[0], &k[1], &k[2]);
    // Linje 1 uden koder, a to gange på linje 2, b på linje 3 og 4, c én gang på linje 4; CRLF.
    let svar = format!("Svar fra leverandøren\r\n{a} og {a} igen\r\n{b}\r\n{b} {c}\r\n");
    let d = demasker(&t, &svar).unwrap();
    assert_eq!(
        d.tilbage.iter().map(|x| x.kode.as_str()).collect::<Vec<_>>(),
        d.koder,
        "samme koder i samme rækkefølge"
    );
    let (ta, tb, tc) = (for_kode(&d.tilbage, a), for_kode(&d.tilbage, b), for_kode(&d.tilbage, c));
    assert_eq!((ta.antal, ta.linje), (2, 2), "{a}");
    assert_eq!((tb.antal, tb.linje), (2, 3), "{b}");
    assert_eq!((tc.antal, tc.linje), (1, 4), "{c}");
    assert_eq!(d.linjer, 4);
    // Enligt CR og LF tæller som linjeskift, som i Maskér.
    let d = demasker(&t, &format!("x\r{a}\ny\n{b}")).unwrap();
    assert_eq!(for_kode(&d.tilbage, a).linje, 2);
    assert_eq!(for_kode(&d.tilbage, b).linje, 4);
    // Ingen originaler i tallene (JSON-svaret til webvisningen).
    let json = serde_json::to_string(&d.tilbage).unwrap();
    for h in HEMMELIGE4 {
        assert!(!json.contains(h), "{h} i tilbage");
    }
}

#[test]
fn demasker_taeller_de_steder_der_blev_sat_tilbage() {
    let t = Tilstand::ny();
    let maskeret = masker_i(&t, TEKST4);
    // Antal er det samme som antal gange, koden stod i den maskerede tekst (én gang hver), og linjen er 1.
    let d = demasker(&t, &maskeret).unwrap();
    assert!(!d.tilbage.is_empty());
    for x in &d.tilbage {
        assert_eq!((x.antal, x.linje), (1, 1), "{x:?}");
    }
    // En kode med andre store/små bogstaver sættes tilbage og tælles med (advarslen "anden stavemåde" står for sig).
    let navn = d
        .tilbage
        .iter()
        .map(|x| x.kode.clone())
        .find(|k| k.chars().any(|c| c.is_ascii_lowercase()) && k.chars().any(|c| c.is_ascii_alphabetic()))
        .expect("en navnekode");
    let svar = format!("{navn}\n{}\n", navn.to_ascii_uppercase());
    let d = demasker(&t, &svar).unwrap();
    let x = for_kode(&d.tilbage, &navn);
    assert_eq!((x.antal, x.linje), (2, 1), "{navn}");
    assert!(d.advarsler.iter().any(|a| a.art == "anden_stavemaade"));
    // En kode, der ikke står i svaret, er ikke med.
    let d = demasker(&t, "intet her\n").unwrap();
    assert!(d.tilbage.is_empty() && d.koder.is_empty());
}

#[test]
fn demasker_fil_antal_og_foerste_linje() {
    let m = Mappe::ny();
    let lager = Arc::new(Loglager::default());
    let t = startet(&m, &lager, "da");
    let maskeret = masker_i(&t, TEKST4);
    let k = koder(&t, &maskeret);
    let (a, b) = (&k[0], &k[1]);
    let sti = m.0.join("svar.maskeret.log");
    std::fs::write(&sti, format!("# svar\r\n\r\n{a};{a};{a}\r\n{b}\r\n")).unwrap();
    fil_aabn(&t, Visning::Demasker, &sti).unwrap();
    let d = fil_demasker(&t).unwrap();
    assert_eq!(d.tilbage.iter().map(|x| x.kode.as_str()).collect::<Vec<_>>(), d.koder);
    let (ta, tb) = (for_kode(&d.tilbage, a), for_kode(&d.tilbage, b));
    assert_eq!((ta.antal, ta.linje), (3, 3), "{a}");
    assert_eq!((tb.antal, tb.linje), (1, 4), "{b}");
    let json = serde_json::to_string(&d.tilbage).unwrap();
    for h in HEMMELIGE4 {
        assert!(!json.contains(h), "{h} i tilbage");
    }
}
