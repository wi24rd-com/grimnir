//! V-LAAS.5 N4 (skallen uden vindue): Jans svar efter V-LAAS.4 (ADR D22).
//!
//! - N1: udklipsholderen ryddes også, når programmet afslutter ([`ved_afslut`]), på samme betingelse som ved lås: kun
//!   efter Grimnirs egen melding om en demaskeret kopi og med uændret tæller. Maskeret tekst og andre programmers indhold
//!   røres ikke. Rydningen læser aldrig teksten (ingen dialog) og venter ikke på en lås, der står og venter på
//!   Nøglering. Kilden: hver vej ud af programmet ender i `RunEvent::Exit`, og dér, ét sted, ryddes der.
//! - N2: navnet på en midlertidig sag, der gemmes ved lås, har sekunder (`Midlertidig ÅÅÅÅ-MM-DD TT.MM.SS`); under låsen
//!   er det eneste opslag i nøglelageret oprettelsen af den nye sags nøgle (ingen navneliste); sagen kan åbnes og
//!   demaskere.
//!
//! Tests kalder aldrig `LAContext`, rører aldrig Nøglering (nøglelageret er `HukommelsesLager` bag en tæller) og læser
//! eller skriver aldrig den rigtige udklipsholder (`HukommelsesUdklip`). Kun opdigtede værdier (`kontor.test`, RFC 1918,
//! opfundne navne). Mappen er en midlertidig mappe, der slettes igen.

use std::path::PathBuf;
use std::sync::{mpsc, Arc, Mutex};
use std::time::Duration;

use grimnir_lib::klokke::StyretKlokke;
use grimnir_lib::laas::{HukommelsesDoer, Svar, Udloeser};
use grimnir_lib::maskering::{
    analyser, demasker, fil_aabn, fil_demasker, fil_kopi, gem_og_masker, laas_igen, laas_op, levende, sag_aabn, sag_liste, sag_luk, sag_ny,
    sag_status, udklip_kopieret, ved_afslut, EfterLaas, Levende, Tilstand, Visning,
};
use grimnir_lib::sager::{HukommelsesLager, Noegle, Noeglelager, SagFejl, SagsId};
use grimnir_lib::udklip::HukommelsesUdklip;

/// En midlertidig mappe, der slettes igen.
struct Mappe(PathBuf);
impl Mappe {
    fn ny() -> Self {
        let p = std::env::temp_dir().join(format!("grimnir-laas5-{}", SagsId::ny().unwrap().hex()));
        std::fs::create_dir_all(&p).unwrap();
        Mappe(p)
    }
}
impl Drop for Mappe {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}

type Krog = Box<dyn FnOnce() + Send>;

/// Et nøglelager i hukommelsen, der skriver hvert opslag ned (`hent`, `gem` eller `slet` og kontoen), og som kan køre
/// en krog én gang, næste gang en nøgle gemmes (midt i låsen).
#[derive(Default)]
struct Taellelager {
    lager: HukommelsesLager,
    opslag: Mutex<Vec<(&'static str, String)>>,
    krog: Mutex<Option<Krog>>,
}
impl Taellelager {
    fn tag(&self) -> Vec<(&'static str, String)> {
        std::mem::take(&mut *self.opslag.lock().unwrap())
    }
}
impl Noeglelager for Taellelager {
    fn hent_konto(&self, konto: &str) -> Result<Noegle, SagFejl> {
        self.opslag.lock().unwrap().push(("hent", konto.to_string()));
        self.lager.hent_konto(konto)
    }
    fn gem_konto(&self, konto: &str, noegle: &Noegle) -> Result<(), SagFejl> {
        self.opslag.lock().unwrap().push(("gem", konto.to_string()));
        let krog = self.krog.lock().unwrap().take();
        if let Some(k) = krog {
            k();
        }
        self.lager.gem_konto(konto, noegle)
    }
    fn slet_konto(&self, konto: &str) -> Result<(), SagFejl> {
        self.opslag.lock().unwrap().push(("slet", konto.to_string()));
        self.lager.slet_konto(konto)
    }
}

const TEKST: &str = "srv-db02.kontor.test 10.30.0.7 bruger=birthe.eksempel\n";
/// 2026-11-11 08:05:30 UTC (målt med `date -u -r 1794384330`) + 37 s = 08:06:07 UTC; i Danmark (UTC+1) 09.06.07.
const NU_MS: u64 = 1_794_384_330_000 + 37_000;
const DK: i32 = 3600;

fn startet(m: &Mappe, lager: &Arc<Taellelager>, udklip: Option<&Arc<HukommelsesUdklip>>) -> Tilstand {
    let t = Tilstand::paa_disk(m.0.clone(), lager.clone())
        .med_klokke(Box::new(StyretKlokke::ny(NU_MS, DK)))
        .med_udklip(udklip.map(|u| Box::new(u.clone()) as Box<dyn grimnir_lib::udklip::Udklip>))
        .ved_start();
    assert_eq!(laas_op(&t, &HukommelsesDoer::ny(Svar::Ok), "da").svar, Svar::Ok);
    t
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

// ------------------------------------------------------------------------------------------------------- N2

#[test]
fn navnet_har_sekunder_og_kun_den_nye_noegle_oprettes() {
    for (sprog, navn) in [("da", "Midlertidig 2026-11-11 09.06.07"), ("en", "Temporary 2026-11-11 09.06.07")] {
        let m = Mappe::ny();
        let lager = Arc::new(Taellelager::default());
        let t = startet(&m, &lager, None);
        t.saet_sprog(sprog);
        // Tre navngivne sager på disk, med hver sin nøgle.
        let mut andre = Vec::new();
        for n in ["Uglebo", "Kragevig", "Ravnsted"] {
            masker(&t);
            let id = sag_ny(&t, n, None).unwrap().id.unwrap();
            andre.push(SagsId::fra_hex(&id).unwrap().konto());
            sag_luk(&t).unwrap();
        }
        assert_eq!(sag_liste(&t).unwrap().len(), 3);
        let maskeret = masker(&t);
        assert!(sag_status(&t).unwrap().id.is_none(), "en midlertidig sag med poster");
        lager.tag();
        assert!(laas_igen(&t, Udloeser::Dvale));
        // Under låsen: præcis ét opslag, oprettelsen af den nye sags nøgle. Ingen af de andre sagers nøgler læses.
        let opslag = lager.tag();
        assert_eq!(opslag.len(), 1, "{sprog}: {opslag:?}");
        assert_eq!(opslag[0].0, "gem", "{sprog}");
        assert!(!andre.contains(&opslag[0].1), "{sprog}: en ny konto");
        assert!(lager.lager.har_konto(&opslag[0].1));
        assert_eq!(levende(&t), Levende::default());
        // Beskeden efter oplåsningen er uændret bortset fra navnet.
        assert_eq!(
            oplaas(&t, sprog),
            Some(EfterLaas {
                midlertidig_gemt: Some(navn.to_string()),
                ..EfterLaas::default()
            })
        );
        // Sagen står i listen med navnet, kan åbnes og demaskerer.
        let liste = sag_liste(&t).unwrap();
        let p = liste.iter().find(|p| p.navn.as_deref() == Some(navn)).expect(navn);
        assert_eq!(SagsId::fra_hex(&p.id).unwrap().konto(), opslag[0].1);
        assert_eq!(sag_aabn(&t, &p.id).unwrap().navn.as_deref(), Some(navn));
        assert_eq!(demasker(&t, &maskeret).unwrap().tekst, TEKST);
    }
}

#[test]
fn samme_sekund_giver_samme_navn() {
    let m = Mappe::ny();
    let lager = Arc::new(Taellelager::default());
    let t = startet(&m, &lager, None);
    for _ in 0..2 {
        masker(&t);
        laas_igen(&t, Udloeser::Stilstand);
        assert_eq!(
            oplaas(&t, "da").and_then(|e| e.midlertidig_gemt).as_deref(),
            Some("Midlertidig 2026-11-11 09.06.07")
        );
    }
    let liste = sag_liste(&t).unwrap();
    assert_eq!(liste.len(), 2, "to sager");
    assert!(liste.iter().all(|p| p.navn.as_deref() == Some("Midlertidig 2026-11-11 09.06.07")));
    assert_ne!(liste[0].id, liste[1].id, "hver med sit id");
}

// ------------------------------------------------------------------------------------------------------- N1

/// Demaskér, Kopiér resultat (webvisningen skriver) og meldingen til Rust; svarer med den demaskerede tekst.
fn demaskeret_kopi(t: &Tilstand, u: &HukommelsesUdklip, maskeret: &str) -> String {
    let d = demasker(t, maskeret).unwrap();
    u.skriv(&d.tekst);
    assert_eq!(udklip_kopieret(t, false), Ok(true));
    d.tekst
}

#[test]
fn afslut_rydder_den_demaskerede_kopi() {
    for laesbar in [false, true] {
        // Indsat tekst.
        let m = Mappe::ny();
        let u = Arc::new(HukommelsesUdklip::ny(laesbar));
        let t = startet(&m, &Arc::default(), Some(&u));
        let maskeret = masker(&t);
        demaskeret_kopi(&t, &u, &maskeret);
        let laest = u.laesninger();
        ved_afslut(&t);
        assert_eq!(u.nu(), None, "{laesbar}: ryddet");
        assert_eq!(u.laesninger(), laest, "{laesbar}: teksten læses ikke ved afslut (ingen dialog)");
        assert_eq!(levende(&t).udklip, 0, "fingeraftrykkene og tælleren er glemt");
        // En gang til gør intet (der er intet husket).
        u.skriv("noget fra et andet program");
        ved_afslut(&t);
        assert_eq!(u.nu().as_deref(), Some("noget fra et andet program"));

        // Filens resultat.
        let m = Mappe::ny();
        let u = Arc::new(HukommelsesUdklip::ny(laesbar));
        let t = startet(&m, &Arc::default(), Some(&u));
        let maskeret = masker(&t);
        let fil = m.0.join("svar.log");
        std::fs::write(&fil, &maskeret).unwrap();
        fil_aabn(&t, Visning::Demasker, &fil).unwrap();
        fil_demasker(&t).unwrap();
        u.skriv(&fil_kopi(&t, Visning::Demasker).unwrap());
        assert_eq!(udklip_kopieret(&t, true), Ok(true));
        let laest = u.laesninger();
        ved_afslut(&t);
        assert_eq!(u.nu(), None, "fil {laesbar}: ryddet");
        assert_eq!(u.laesninger(), laest);
    }
}

#[test]
fn afslut_roerer_ikke_maskeret_tekst_eller_andres() {
    for laesbar in [false, true] {
        // Maskeret tekst (Kopiér i Maskér melder intet).
        let m = Mappe::ny();
        let u = Arc::new(HukommelsesUdklip::ny(laesbar));
        let t = startet(&m, &Arc::default(), Some(&u));
        // V-LAAS.6: brugeren har svaret (Kassér), så ved_afslut kan kaldes flere gange på samme tilstand uden at gemme
        // og låse; rydningen er den samme på begge veje (den ubesvarede vej: laas6.rs).
        t.tillad_afslut();
        let maskeret = masker(&t);
        u.skriv(&maskeret);
        let taeller = u.taeller_nu();
        ved_afslut(&t);
        assert_eq!(u.nu().as_deref(), Some(maskeret.as_str()), "{laesbar}");
        assert_eq!(u.taeller_nu(), taeller, "{laesbar}: ikke rørt");
        // Demaskeret kopi, og derefter Kopiér i Maskér: det maskerede ligger øverst og bliver.
        demaskeret_kopi(&t, &u, &maskeret);
        u.skriv(&maskeret);
        let taeller = u.taeller_nu();
        ved_afslut(&t);
        assert_eq!(u.nu().as_deref(), Some(maskeret.as_str()), "{laesbar}");
        assert_eq!(u.taeller_nu(), taeller);
        // Et andet program har skrevet efter den demaskerede kopi.
        demaskeret_kopi(&t, &u, &maskeret);
        u.skriv("noget fra et andet program");
        let taeller = u.taeller_nu();
        ved_afslut(&t);
        assert_eq!(u.nu().as_deref(), Some("noget fra et andet program"), "{laesbar}");
        assert_eq!(u.taeller_nu(), taeller);
        // Intet demaskeret og ingen melding: et andet programs tekst bliver.
        let m = Mappe::ny();
        let u = Arc::new(HukommelsesUdklip::ny(laesbar));
        let t = startet(&m, &Arc::default(), Some(&u));
        u.skriv("noget fra et andet program");
        ved_afslut(&t);
        assert_eq!(u.nu().as_deref(), Some("noget fra et andet program"));
    }
    // En tilstand uden udklipsholder (Windows i dag): intet sker.
    let m = Mappe::ny();
    let t = startet(&m, &Arc::default(), None);
    ved_afslut(&t);
}

#[test]
fn afslut_venter_ikke_paa_en_laas_i_gang() {
    // Låsen står og venter på nøglelageret (som når Nøglering spørger): koerer og sagens lås holdes. Afslut må ikke vente.
    let m = Mappe::ny();
    let lager = Arc::new(Taellelager::default());
    let u = Arc::new(HukommelsesUdklip::ny(false));
    let t = Arc::new(startet(&m, &lager, Some(&u)));
    masker(&t);
    let (tx, rx) = mpsc::channel();
    {
        let t = t.clone();
        *lager.krog.lock().unwrap() = Some(Box::new(move || {
            let t2 = t.clone();
            let (svar_tx, svar_rx) = mpsc::channel();
            std::thread::spawn(move || {
                ved_afslut(&t2);
                svar_tx.send(()).unwrap();
            });
            tx.send(svar_rx.recv_timeout(Duration::from_secs(5)).is_ok()).unwrap();
        }));
    }
    assert!(laas_igen(&t, Udloeser::Dvale));
    assert!(rx.recv().unwrap(), "ved_afslut blev færdig, mens låsen ventede");
}

// ------------------------------------------------------------------------------------------------------- kilden

fn kilde(fil: &str) -> String {
    std::fs::read_to_string(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join(fil)).unwrap()
}

/// Koden uden kommentarlinjer (dokumentationen nævner også `app.exit`).
fn kode(tekst: &str) -> String {
    tekst
        .lines()
        .filter(|l| !l.trim_start().starts_with("//"))
        .collect::<Vec<_>>()
        .join("\n")
}

/// Kroppen af `fn navn(` i `kode` (til den første linje, der kun er `}`).
fn krop<'a>(kode: &'a str, navn: &str) -> &'a str {
    let i = kode.find(&format!("fn {navn}(")).unwrap_or_else(|| panic!("fn {navn} mangler"));
    &kode[i..i + kode[i..].find("\n}\n").unwrap()]
}

#[test]
fn hver_vej_ud_gaar_gennem_et_sted() {
    let lib = kode(&kilde("src/lib.rs"));
    // Grimnir kalder kun app.exit ét sted, i `afslut`, og både program_afslut og menuens Afslut går dertil.
    assert_eq!(lib.matches(".exit(").count(), 1, "app.exit kun i afslut");
    assert!(krop(&lib, "afslut").contains("app.exit(0)"));
    assert!(krop(&lib, "program_afslut").contains("afslut(&app)"));
    assert!(lib.contains("if !anmod_afslut(app) {\n                        afslut(app);"));
    // Lukkeknappen kalder ikke exit selv: vinduet lukkes, og Tauri afslutter, når det sidste vindue er væk.
    let luk = &lib[lib.find("WindowEvent::CloseRequested").unwrap()..];
    let luk = &luk[..luk.find("tauri::WindowEvent::DragDrop").unwrap()];
    assert!(!luk.contains("exit") && luk.contains("api.prevent_close()"));
    // Alle veje ender i RunEvent::Exit, og dér ryddes der, ét sted.
    assert!(
        !lib.contains(".run(tauri::generate_context!())"),
        "run uden hændelser ville ikke se Exit"
    );
    assert!(lib.contains(".build(tauri::generate_context!())"));
    assert!(lib.contains("if let tauri::RunEvent::Exit = ev {\n                ved_programslut(app);"));
    assert_eq!(lib.matches("ved_programslut(").count(), 2, "defineret og kaldt én gang");
    assert_eq!(lib.matches("maskering::ved_afslut(").count(), 1);
    assert!(krop(&lib, "ved_programslut").contains("maskering::ved_afslut(&t)"));
    // Ingen anden vej ud i skallens kode.
    for e in std::fs::read_dir(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("src")).unwrap() {
        let p = e.unwrap().path();
        let tekst = kode(&std::fs::read_to_string(&p).unwrap());
        assert!(!tekst.contains("process::exit") && !tekst.contains("abort()"), "{}", p.display());
    }
    // ved_afslut rydder med samme betingelse som låsen og venter ikke på låsen, filerne eller ordbogen.
    // V-LAAS.6 N1: bagefter gemmes en ubesvaret midlertidig sag. `koerer` tages kun, hvis den er ledig, og sagens lås
    // med en frist (laas6.rs); udklipsholderen ryddes først.
    let m = kode(&kilde("src/maskering.rs"));
    let ved = krop(&m, "ved_afslut");
    assert!(ved.contains("ryd_udklip(t)"));
    assert!(ved.find("ryd_udklip(t)") < ved.find("gem_og_nulstil_sag("));
    assert!(ved.contains("koerer.try_lock()") && !ved.contains("koerer.lock()"));
    assert!(ved.contains("t.sag_inden(AFSLUT_VENT)"));
    for x in ["t.sag()", "t.fil(", "ordbog", ".tekst()"] {
        assert!(!ved.contains(x), "{x} i ved_afslut");
    }
    let ryd = krop(&m, "ryd_udklip");
    assert!(!ryd.contains(".tekst()"), "rydningen læser ikke teksten");
    assert!(!ryd.contains("koerer") && !ryd.contains("t.sag()"));
}

#[test]
fn ingen_navneliste_i_gem_midlertidig() {
    let m = kilde("src/maskering.rs");
    let gem = krop(&m, "gem_midlertidig");
    assert!(!gem.contains(".liste()"), "ingen navneliste under låsen");
    assert!(
        !gem.contains("ledigt_navn") && !m.contains("fn ledigt_navn("),
        "\" (2)\" er bortfaldet"
    );
    assert!(gem.contains("ark.opret("));
}
