//! V-LAAS.4 N4 (skallen uden vindue): ved lås mistes ingen data, og originaler bliver ikke liggende i udklipsholderen.
//!
//! - N1: en midlertidig sag med poster gemmes ved lås under `Midlertidig ÅÅÅÅ-MM-DD TT.MM` (uret styres af testen);
//!   navnesammenfald giver ` (2)` og ` (3)`; engelsk UI giver `Temporary …`; standardudløbet gælder; sagen kan åbnes efter
//!   oplåsningen og demaskere; fejl ved gemningen (nøglelager og disk) låser alligevel og vises uden indhold; en tom
//!   midlertidig sag gemmes ikke; en kommando midt i låsen svarer `laast`, og vagten om nøglelageret afviser andre tråde;
//!   intet er levende efter låsen.
//! - N2: udklipsholderen ryddes ved hver udløser, når Grimnir skrev sidst og det var demaskeret (indsat tekst og fil, med
//!   og uden lov til at læse teksten); ikke efter en maskeret kopi; ikke når en anden har skrevet siden; ikke når teksten
//!   ikke var Grimnirs.
//!
//! Tests kalder aldrig `LAContext`, rører aldrig Nøglering (nøglelageret er `HukommelsesLager` bag en krog) og læser eller
//! skriver aldrig den rigtige udklipsholder (`HukommelsesUdklip`; en tilstand uden `med_udklip` har ingen). Kun opdigtede
//! værdier (`kontor.test`, RFC 1918, opfundne navne). Mappen er en midlertidig mappe, der slettes igen.

use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

use grimnir_lib::indstillinger::Indstillinger;
use grimnir_lib::klokke::StyretKlokke;
use grimnir_lib::laas::{HukommelsesDoer, Svar, Udloeser};
use grimnir_lib::maskering::{
    aabn_forbi_porten, analyser, demasker, fil_aabn, fil_demasker, fil_kopi, gem_og_masker, indstillinger_gem, indstillinger_hent,
    laas_igen, laas_op, levende, ordbog_hent, ordbog_tilfoej, sag_aabn, sag_liste, sag_ny, sag_status, udklip_kopieret, EfterLaas, Levende,
    Tilstand, UiFejl, Visning,
};
use grimnir_lib::sager::{HukommelsesLager, Noegle, Noeglelager, SagFejl, SagsId};
use grimnir_lib::udklip::HukommelsesUdklip;

/// En midlertidig mappe, der slettes igen.
struct Mappe(PathBuf);
impl Mappe {
    fn ny() -> Self {
        let p = std::env::temp_dir().join(format!("grimnir-laas4-{}", SagsId::ny().unwrap().hex()));
        std::fs::create_dir_all(&p).unwrap();
        Mappe(p)
    }
    fn sager(&self) -> usize {
        std::fs::read_dir(self.0.join("sager"))
            .map(|d| {
                d.filter(|e| e.as_ref().unwrap().path().extension().is_some_and(|x| x == "grimnir"))
                    .count()
            })
            .unwrap_or(0)
    }
}
impl Drop for Mappe {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}

type Krog = Box<dyn FnOnce() + Send>;

/// Et nøglelager i hukommelsen med en krog: `krog` kaldes én gang, næste gang en nøgle gemmes (midt i låsen), og
/// `fejl` får hver gemning til at fejle.
#[derive(Default)]
struct Kroglager {
    lager: HukommelsesLager,
    fejl: AtomicBool,
    krog: Mutex<Option<Krog>>,
}
impl Noeglelager for Kroglager {
    fn hent_konto(&self, konto: &str) -> Result<Noegle, SagFejl> {
        self.lager.hent_konto(konto)
    }
    fn gem_konto(&self, konto: &str, noegle: &Noegle) -> Result<(), SagFejl> {
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
        self.lager.slet_konto(konto)
    }
}

const TEKST: &str = "srv-web01.kontor.test 10.20.0.5 bruger=anders.eksempel\n";
const HEMMELIGE: [&str; 3] = ["kontor.test", "10.20.0.5", "anders"];
/// 2026-11-11 08:05:30 UTC (målt med `date -u -r 1794384330`); i Danmark (UTC+1) er klokken 09.05.
const NU_MS: u64 = 1_794_384_330_000;
const DK: i32 = 3600;
const NAVN: &str = "Midlertidig 2026-11-11 09.05";

/// Programmet ved start med uret styret, låst op med døren.
fn startet(m: &Mappe, lager: &Arc<Kroglager>, klokke: &Arc<StyretKlokke>) -> Tilstand {
    let t = Tilstand::paa_disk(m.0.clone(), lager.clone())
        .med_klokke(Box::new(klokke.clone()))
        .ved_start();
    assert_eq!(laas_op(&t, &HukommelsesDoer::ny(Svar::Ok), "da").svar, Svar::Ok);
    t
}

/// Maskerer `TEKST` i den aktuelle sag og svarer med den maskerede tekst.
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

// ------------------------------------------------------------------------------------------------------- N1

#[test]
fn midlertidig_sag_gemmes_under_dato_navn_og_kan_demaskere() {
    let m = Mappe::ny();
    let lager = Arc::new(Kroglager::default());
    let klokke = Arc::new(StyretKlokke::ny(NU_MS, DK));
    let t = startet(&m, &lager, &klokke);
    let maskeret = masker(&t);
    let poster = sag_status(&t).unwrap().poster;
    assert!(poster > 0 && sag_status(&t).unwrap().id.is_none(), "en midlertidig sag med poster");
    let noegler = lager.lager.antal();
    assert!(laas_igen(&t, Udloeser::Dvale));
    assert!(t.er_laast());
    assert_eq!(levende(&t), Levende::default(), "intet levende efter låsen");
    assert_eq!(m.sager(), 1, "sagen er skrevet");
    assert_eq!(lager.lager.antal(), noegler + 1, "med sin egen nye nøgle");
    // Navnet står kun i sagens krypterede hoved.
    let fil = std::fs::read_dir(m.0.join("sager")).unwrap().next().unwrap().unwrap().path();
    let bytes = std::fs::read(&fil).unwrap();
    for x in [NAVN, "Midlertidig", "2026-11-11"].iter().chain(HEMMELIGE.iter()) {
        assert!(
            !bytes.windows(x.len()).any(|w| w == x.as_bytes()),
            "{x} står i klartekst i sagsfilen"
        );
    }
    // Efter oplåsningen: beskeden med navnet, én gang, uden indhold.
    let efter = oplaas(&t, "da");
    assert_eq!(efter, gemt(NAVN));
    let json = serde_json::to_string(&efter).unwrap();
    assert_eq!(
        json,
        format!(r#"{{"midlertidig_gemt":"{NAVN}","midlertidig_fejl":null,"gem_fejl":null}}"#)
    );
    laas_igen(&t, Udloeser::Stilstand);
    assert_eq!(oplaas(&t, "da"), None, "beskeden gives én gang");
    // Sagen åbnes ikke af sig selv; den står i listen med postantal og uden udløb (standard: ingen).
    let s = sag_status(&t).unwrap();
    assert_eq!((s.poster, s.id), (0, None));
    let liste = sag_liste(&t).unwrap();
    assert_eq!(liste.len(), 1);
    let p = &liste[0];
    assert_eq!((p.navn.as_deref(), p.poster, p.udloeb.as_deref()), (Some(NAVN), poster, None));
    assert_eq!(p.oprettet, NU_MS, "oprettet efter uret");
    // Den kan åbnes og demaskere den tekst, der blev maskeret før låsen.
    assert_eq!(sag_aabn(&t, &p.id).unwrap().navn.as_deref(), Some(NAVN));
    assert_eq!(demasker(&t, &maskeret).unwrap().tekst, TEKST);
}

#[test]
fn navnesammenfald_engelsk_og_standardudloeb() {
    let m = Mappe::ny();
    let lager = Arc::new(Kroglager::default());
    let klokke = Arc::new(StyretKlokke::ny(NU_MS, DK));
    let t = startet(&m, &lager, &klokke);
    let i = Indstillinger {
        udloeb_dage: Some(30),
        ..indstillinger_hent(&t)
    };
    indstillinger_gem(&t, i).unwrap();
    // En navngiven sag hedder allerede det samme (sat af brugeren).
    sag_ny(&t, NAVN, None).unwrap();
    masker(&t);
    laas_igen(&t, Udloeser::SkaermSlukket);
    assert_eq!(oplaas(&t, "da"), None, "en navngiven sag uden ændringer: intet at sige");
    let mut forventet = vec![NAVN.to_string()];
    for n in [2, 3] {
        masker(&t);
        laas_igen(&t, Udloeser::Stilstand);
        let navn = format!("{NAVN} ({n})");
        assert_eq!(oplaas(&t, "da"), gemt(&navn));
        forventet.push(navn);
    }
    // Engelsk UI (sproget kommer med laas_op og menu_sprog). En lås uden poster gemmer intet.
    laas_igen(&t, Udloeser::Brugerskift);
    assert_eq!(oplaas(&t, "en"), None, "intet at sige endnu: sproget gælder fra næste lås");
    klokke.stil(NU_MS + 60_000, DK);
    masker(&t);
    laas_igen(&t, Udloeser::Dvale);
    assert_eq!(oplaas(&t, "en"), gemt("Temporary 2026-11-11 09.06"));
    forventet.push("Temporary 2026-11-11 09.06".to_string());
    let mut navne: Vec<(String, Option<String>)> = sag_liste(&t).unwrap().into_iter().map(|p| (p.navn.unwrap(), p.udloeb)).collect();
    navne.sort();
    forventet.sort();
    assert_eq!(navne.iter().map(|x| x.0.clone()).collect::<Vec<_>>(), forventet);
    // Standardudløbet (30 dage) gælder de gemte midlertidige sager, ikke sagen, brugeren selv oprettede uden udløb.
    for (navn, udloeb) in &navne {
        let ventet = if navn == NAVN { None } else { Some("2026-12-11") };
        assert_eq!(udloeb.as_deref(), ventet, "{navn}");
    }
}

#[test]
fn fejl_ved_gemning_af_midlertidig_sag_laaser_alligevel() {
    // Nøglelageret fejler.
    let m = Mappe::ny();
    let lager = Arc::new(Kroglager::default());
    let klokke = Arc::new(StyretKlokke::ny(NU_MS, DK));
    let t = startet(&m, &lager, &klokke);
    masker(&t);
    lager.fejl.store(true, Ordering::SeqCst);
    let noegler = lager.lager.antal();
    assert!(laas_igen(&t, Udloeser::Dvale));
    assert!(t.er_laast(), "låst, selv om gemningen fejlede");
    assert_eq!(levende(&t), Levende::default(), "nulstillet, selv om gemningen fejlede");
    assert_eq!((m.sager(), lager.lager.antal()), (0, noegler), "intet skrevet, ingen nøgle");
    assert_eq!(
        laas_op(&t, &HukommelsesDoer::ny(Svar::Annulleret), "da").efter,
        None,
        "ikke låst op: intet"
    );
    let ud = laas_op(&t, &HukommelsesDoer::ny(Svar::Ok), "da");
    let fejl = EfterLaas {
        midlertidig_fejl: Some(SagFejl::Noeglering { hvad: "andet" }),
        ..EfterLaas::default()
    };
    assert_eq!(ud.efter, Some(fejl));
    let json = serde_json::to_string(&ud).unwrap();
    assert!(
        json.contains(r#""efter":{"midlertidig_gemt":null,"midlertidig_fejl":{"art":"noeglering","hvad":"andet"},"gem_fejl":null}"#),
        "{json}"
    );
    for h in HEMMELIGE.iter().chain([&"Midlertidig", &m.0.to_str().unwrap()]) {
        assert!(!json.contains(h), "{h} står i svaret: {json}");
    }
    assert_eq!(sag_status(&t).unwrap().poster, 0, "sagen er lukket");

    // Disken fejler: mappen til sagerne kan ikke oprettes (der står en fil, hvor den skulle være).
    let m = Mappe::ny();
    std::fs::write(m.0.join("sager"), b"ikke en mappe").unwrap();
    let lager = Arc::new(Kroglager::default());
    let t = startet(&m, &lager, &klokke);
    masker(&t);
    assert!(laas_igen(&t, Udloeser::Stilstand));
    assert_eq!(levende(&t), Levende::default());
    assert_eq!(lager.lager.antal(), 0, "ingen nøgle efterladt");
    let efter = oplaas(&t, "da").unwrap();
    assert!(
        matches!(efter.midlertidig_fejl, Some(SagFejl::Disk { .. })) && efter.midlertidig_gemt.is_none(),
        "{efter:?}"
    );
}

#[test]
fn tom_midlertidig_sag_gemmes_ikke() {
    let m = Mappe::ny();
    let lager = Arc::new(Kroglager::default());
    let klokke = Arc::new(StyretKlokke::ny(NU_MS, DK));
    let t = startet(&m, &lager, &klokke);
    assert!(laas_igen(&t, Udloeser::Dvale));
    assert_eq!((m.sager(), lager.lager.antal()), (0, 0));
    assert_eq!(oplaas(&t, "da"), None, "ingen besked");
}

#[test]
fn kommando_midt_i_laasen_svarer_laast() {
    let m = Mappe::ny();
    let lager = Arc::new(Kroglager::default());
    let klokke = Arc::new(StyretKlokke::ny(NU_MS, DK));
    let t = Arc::new(startet(&m, &lager, &klokke));
    // En navngiven sag på disk, som en anden tråd prøver at læse midt i låsen.
    masker(&t);
    let id = sag_ny(&t, "Uglebo-sagen", None).unwrap().id.unwrap();
    sag_aabn(&t, &id).unwrap();
    grimnir_lib::maskering::sag_luk(&t).unwrap();
    ordbog_tilfoej(&t, "ord", "Kragevig", None).unwrap();
    masker(&t);
    let koert = Arc::new(AtomicBool::new(false));
    let oplaasning: Arc<Mutex<Option<std::thread::JoinHandle<Option<EfterLaas>>>>> = Arc::default();
    {
        let (t, id, koert, oplaasning) = (t.clone(), id.clone(), koert.clone(), oplaasning.clone());
        *lager.krog.lock().unwrap() = Some(Box::new(move || {
            // Midt i låsen: den midlertidige sags nøgle er ved at blive oprettet.
            assert!(t.er_laast());
            assert_eq!(sag_status(&t), Err(UiFejl::Laast));
            assert_eq!(sag_liste(&t).map(|_| ()), Err(UiFejl::Laast));
            assert_eq!(ordbog_hent(&t).map(|_| ()), Err(UiFejl::Laast));
            assert_eq!(analyser(&t, TEKST, None, &[]).map(|_| ()), Err(UiFejl::Laast));
            assert_eq!(udklip_kopieret(&t, false), Err(UiFejl::Laast));
            // Vagten om nøglelageret afviser en anden tråd (som en kommando, der kom forbi porten før låsen).
            let (t2, id2) = (t.clone(), id.clone());
            let anden = std::thread::spawn(move || aabn_forbi_porten(&t2, &id2));
            assert_eq!(anden.join().unwrap(), Err(SagFejl::Noeglering { hvad: "laast" }));
            // En oplåsning, der kommer nu, venter, til låsen er færdig.
            let t3 = t.clone();
            *oplaasning.lock().unwrap() = Some(std::thread::spawn(move || laas_op(&t3, &HukommelsesDoer::ny(Svar::Ok), "da").efter));
            std::thread::sleep(std::time::Duration::from_millis(50));
            assert!(t.er_laast(), "oplåsningen venter på låsen");
            koert.store(true, Ordering::SeqCst);
        }));
    }
    assert!(laas_igen(&t, Udloeser::Dvale));
    assert!(koert.load(Ordering::SeqCst), "krogen kørte midt i låsen");
    let efter = oplaasning.lock().unwrap().take().unwrap().join().unwrap();
    assert_eq!(efter, gemt(NAVN), "oplåsningen fik beskeden, efter låsen var færdig");
    assert!(!t.er_laast());
    // Efter låsen kan den tråd, der låste, heller ikke komme forbi vagten: undtagelsen er sluppet.
    laas_igen(&t, Udloeser::Stilstand);
    assert_eq!(aabn_forbi_porten(&t, &id), Err(SagFejl::Noeglering { hvad: "laast" }));
    assert_eq!(levende(&t), Levende::default());
}

// ------------------------------------------------------------------------------------------------------- N2

const ALLE: [Udloeser; 4] = [Udloeser::Dvale, Udloeser::SkaermSlukket, Udloeser::Brugerskift, Udloeser::Stilstand];

/// Et program med en udklipsholder i hukommelsen (`laesbar`: teksten må læses uden besked).
fn med_udklip(m: &Mappe, laesbar: bool) -> (Tilstand, Arc<HukommelsesUdklip>) {
    let u = Arc::new(HukommelsesUdklip::ny(laesbar));
    let lager = Arc::new(Kroglager::default());
    let t = Tilstand::paa_disk(m.0.clone(), lager)
        .med_klokke(Box::new(StyretKlokke::ny(NU_MS, DK)))
        .med_udklip(Some(Box::new(u.clone())))
        .ved_start();
    laas_op(&t, &HukommelsesDoer::ny(Svar::Ok), "da");
    (t, u)
}

#[test]
fn demaskeret_kopi_ryddes_ved_hver_udloeser() {
    for laesbar in [false, true] {
        for grund in ALLE {
            let m = Mappe::ny();
            let (t, u) = med_udklip(&m, laesbar);
            let maskeret = masker(&t);
            // Indsat tekst: Demaskér, Kopiér (webvisningen skriver), og meldingen til Rust.
            let d = demasker(&t, &maskeret).unwrap();
            u.skriv(&d.tekst);
            assert_eq!(udklip_kopieret(&t, false), Ok(true), "{laesbar} {grund:?}");
            assert!(laas_igen(&t, grund));
            assert_eq!(u.nu(), None, "{laesbar} {grund:?}: ryddet");
            assert_eq!(levende(&t).udklip, 0);
        }
    }
    // Filresultatet (Kopiér af en demaskeret fil).
    for laesbar in [false, true] {
        let m = Mappe::ny();
        let (t, u) = med_udklip(&m, laesbar);
        let maskeret = masker(&t);
        let fil = m.0.join("svar.log");
        std::fs::write(&fil, &maskeret).unwrap();
        fil_aabn(&t, Visning::Demasker, &fil).unwrap();
        fil_demasker(&t).unwrap();
        u.skriv(&fil_kopi(&t, Visning::Demasker).unwrap());
        assert_eq!(udklip_kopieret(&t, true), Ok(true), "fil {laesbar}");
        assert!(laas_igen(&t, Udloeser::Dvale));
        assert_eq!(u.nu(), None, "fil {laesbar}: ryddet");
    }
}

#[test]
fn maskeret_kopi_ryddes_ikke() {
    for laesbar in [false, true] {
        let m = Mappe::ny();
        let (t, u) = med_udklip(&m, laesbar);
        // Kopiér i Maskér melder intet til Rust.
        let maskeret = masker(&t);
        u.skriv(&maskeret);
        laas_igen(&t, Udloeser::Dvale);
        assert_eq!(
            u.nu().as_deref(),
            Some(maskeret.as_str()),
            "{laesbar}: maskeret tekst er lavet til at blive delt"
        );
        // Demaskeret kopi og derefter Kopiér i Maskér: det maskerede ligger øverst og bliver.
        oplaas(&t, "da");
        let maskeret = masker(&t);
        let d = demasker(&t, &maskeret).unwrap();
        u.skriv(&d.tekst);
        assert_eq!(udklip_kopieret(&t, false), Ok(true));
        u.skriv(&maskeret);
        laas_igen(&t, Udloeser::Stilstand);
        assert_eq!(u.nu().as_deref(), Some(maskeret.as_str()), "{laesbar}");
    }
}

#[test]
fn ryddes_ikke_naar_en_anden_har_skrevet_siden() {
    for laesbar in [false, true] {
        for grund in ALLE {
            let m = Mappe::ny();
            let (t, u) = med_udklip(&m, laesbar);
            let maskeret = masker(&t);
            let d = demasker(&t, &maskeret).unwrap();
            u.skriv(&d.tekst);
            assert_eq!(udklip_kopieret(&t, false), Ok(true));
            u.skriv("noget fra et andet program");
            let taeller = u.taeller_nu();
            laas_igen(&t, grund);
            assert_eq!(u.nu().as_deref(), Some("noget fra et andet program"), "{laesbar} {grund:?}");
            assert_eq!(u.taeller_nu(), taeller, "udklipsholderen er ikke rørt");
        }
    }
}

#[test]
fn ryddes_ikke_naar_teksten_ikke_var_grimnirs() {
    let m = Mappe::ny();
    let (t, u) = med_udklip(&m, true);
    let maskeret = masker(&t);
    // Intet demaskeret endnu: en melding huskes ikke.
    u.skriv("noget fra et andet program");
    assert_eq!(udklip_kopieret(&t, false), Ok(false));
    // Demaskeret, men udklipsholderen har noget andet (et andet program skrev imellem kopien og meldingen).
    demasker(&t, &maskeret).unwrap();
    u.skriv("noget fra et andet program");
    assert_eq!(udklip_kopieret(&t, false), Ok(false));
    // Den forkerte kilde: filens resultat er ikke demaskeret.
    let d = demasker(&t, &maskeret).unwrap();
    u.skriv(&d.tekst);
    assert_eq!(udklip_kopieret(&t, true), Ok(false));
    // Den maskerede tekst er ikke det demaskerede resultat.
    u.skriv(&maskeret);
    assert_eq!(udklip_kopieret(&t, false), Ok(false));
    laas_igen(&t, Udloeser::Dvale);
    assert_eq!(u.nu().as_deref(), Some(maskeret.as_str()));
    // En tilstand uden udklipsholder (Windows i dag, og alle andre tests) husker intet og rydder intet.
    let m2 = Mappe::ny();
    let t2 = Tilstand::paa_disk(m2.0.clone(), Arc::new(Kroglager::default())).ved_start();
    laas_op(&t2, &HukommelsesDoer::ny(Svar::Ok), "da");
    let maskeret = masker(&t2);
    demasker(&t2, &maskeret).unwrap();
    assert_eq!(udklip_kopieret(&t2, false), Ok(false));
}

// ------------------------------------------------------------------------------------------------------- kilden

fn kilde(fil: &str) -> String {
    std::fs::read_to_string(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join(fil)).unwrap()
}

#[test]
fn den_rigtige_udklipsholder_kun_i_programmet() {
    // Platformens udklipsholder gives ét sted: til programmets tilstand i lib.rs. Testene bruger den aldrig.
    let lib = kilde("src/lib.rs");
    assert_eq!(lib.matches("udklip::platformens()").count(), 1);
    assert!(lib.contains(".med_udklip(udklip::platformens())"));
    for e in std::fs::read_dir(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests")).unwrap() {
        let p = e.unwrap().path();
        let tekst = std::fs::read_to_string(&p).unwrap();
        let navn = p.file_name().unwrap().to_string_lossy().into_owned();
        // (Denne fil nævner navnene i sine egne tjek.)
        if navn != "laas4.rs" {
            assert!(!tekst.contains("platformens()") && !tekst.contains("MacUdklip"), "{navn}");
        }
    }
    // Kommandoen er registreret og tilladt; NSPasteboard bruges kun i udklip.rs.
    assert!(lib.contains("        udklip_kopieret\n    ]);"));
    assert!(kilde("build.rs").contains("\"udklip_kopieret\""));
    assert!(kilde("capabilities/default.json").contains("\"allow-udklip-kopieret\""));
    for e in std::fs::read_dir(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("src")).unwrap() {
        let p = e.unwrap().path();
        let navn = p.file_name().unwrap().to_string_lossy().into_owned();
        if navn != "udklip.rs" {
            assert!(!std::fs::read_to_string(&p).unwrap().contains("NSPasteboard"), "{navn}");
        }
    }
    // Rækkefølgen i laas_igen: låst først, udklipsholderen, filerne, sagen med undtagelsen, ordbogen.
    let m = kilde("src/maskering.rs");
    let i = m.find("pub fn laas_igen(").unwrap();
    let krop = &m[i..i + m[i..].find("\n}\n").unwrap()];
    let pos = |x: &str| krop.find(x).unwrap_or_else(|| panic!("{x} mangler i laas_igen"));
    assert!(pos("koerer.lock()") < pos(".swap(true"));
    assert!(pos(".swap(true") < pos("ryd_udklip(t)"));
    assert!(pos("ryd_udklip(t)") < pos("t.fil(v).take()"));
    assert!(pos("t.fil(v).take()") < pos("let mut a = t.sag();"));
    assert!(pos("let mut a = t.sag();") < pos("Undtagelse::ny("));
    assert!(pos("Undtagelse::ny(") < pos("gem_midlertidig(") && pos("gem_midlertidig(") < pos("drop(undtagelse)"));
    assert!(pos("drop(undtagelse)") < pos("erstat(aktuel"));
    assert!(
        pos("t.indstillinger()") < pos("let mut a = t.sag();"),
        "indstillingerne læses før sagens lås"
    );
}
