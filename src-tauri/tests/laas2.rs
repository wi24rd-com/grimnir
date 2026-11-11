//! V-LAAS.2 L5 (skallen uden vindue): døren ved start. De fem svar gennem `laas_op` med døren i hukommelsen; ingen
//! nøgleopslag i låst tilstand (et nøglelager, der tæller); oplåsning giver adgang; "Lås Grimnir ved start" fra kræver en
//! oplåsning; fejl uden indhold. Tests kalder aldrig `LAContext` og rører aldrig Nøglering: døren er
//! [`HukommelsesDoer`], nøglelageret er [`HukommelsesLager`]. Kun opdigtede værdier (`kontor.test`, RFC 1918, opfundne
//! navne). Mappen er en midlertidig mappe med tilfældigt navn, ryddet efter testen.

use std::path::PathBuf;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use std::time::Duration;

use grimnir_lib::indstillinger::Indstillinger;
use grimnir_lib::laas::{begrundelse, Begrundelse, Doer, Grund, HukommelsesDoer, Svar};
use grimnir_lib::maskering::{
    analyser, demasker, fil_aabn, fil_analyser, fil_demasker, fil_gem_forslag, fil_gem_og_masker, fil_gem_til, fil_kopi, fil_luk,
    fil_raekker, gem_og_masker, indstillinger_gem, indstillinger_hent, laas_op, laas_status, laas_ved_start, ordbog_fjern, ordbog_hent,
    ordbog_proev, ordbog_ret, ordbog_start_forfra, ordbog_tilfoej, sag_aabn, sag_liste, sag_luk, sag_nulstil, sag_ny, sag_omdoeb, sag_slet,
    sag_status, sag_udloeb, sag_valg, LaasStatus, SideValg, Tilstand, UiFejl, Visning,
};
use grimnir_lib::sager::{HukommelsesLager, Noegle, Noeglelager, SagFejl, SagsId};

/// En midlertidig mappe, der slettes igen.
struct Mappe(PathBuf);
impl Mappe {
    fn ny() -> Self {
        let p = std::env::temp_dir().join(format!("grimnir-laas-{}", SagsId::ny().unwrap().hex()));
        std::fs::create_dir_all(&p).unwrap();
        Mappe(p)
    }
}
impl Drop for Mappe {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}

/// Et nøglelager i hukommelsen, der tæller hvert opslag (hent, gem, slet).
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

/// Programmet ved start på mappen (som `lib.rs`: `paa_disk(…).ved_start()`), med et fælles nøglelager.
fn start(m: &Mappe, lager: &Arc<Taellende>) -> Tilstand {
    Tilstand::paa_disk(m.0.clone(), lager.clone()).ved_start()
}

const SAGSNAVN: &str = "Uglebo-sagen";
const ORD: &str = "Kragevig";
const TEKST: &str = "srv-web01.kontor.test 10.20.0.5 bruger=anders.eksempel Kragevig\n";

/// En mappe med en navngiven sag (med poster) og en ordbog med én post, lavet af et ulåst program. Svarer med sagens id.
fn med_data(m: &Mappe, lager: &Arc<Taellende>) -> String {
    let t = Tilstand::paa_disk(m.0.clone(), lager.clone());
    assert!(!t.er_laast(), "paa_disk alene er ulåst (tests og ældre kode)");
    ordbog_tilfoej(&t, "ord", ORD, None).unwrap();
    let a = analyser(&t, TEKST, None, &[]).unwrap();
    let fra: Vec<usize> = a.raekker.iter().filter(|r| !r.valgt).map(|r| r.id).collect();
    gem_og_masker(&t, TEKST, &fra, &[]).unwrap();
    let s = sag_ny(&t, SAGSNAVN, None).unwrap();
    assert!(s.poster > 0);
    s.id.unwrap()
}

fn status(laast: bool, ved_start: bool, uden_doer: Option<&'static str>) -> LaasStatus {
    LaasStatus {
        laast,
        ved_start,
        uden_doer,
    }
}

/// Alle kommandoer, der bruger sager, ordbog, filer eller nøgler, som én liste: (navn, svaret som JSON eller fejlen).
/// `fil`: en fil i brugerens mappe (opdigtet indhold). `id`: en sags id.
fn alle_kommandoer(t: &Tilstand, fil: &std::path::Path, id: &str) -> Vec<(&'static str, Result<String, UiFejl>)> {
    let j = |r: Result<serde_json::Value, UiFejl>| r.map(|v| v.to_string());
    let side = SideValg {
        filter: "alle".into(),
        antal: 500,
        ..SideValg::default()
    };
    let ud = m_dir(fil).join("ud.log");
    vec![
        ("analyser", j(analyser(t, TEKST, None, &[]).map(|x| v(&x)))),
        ("gem_og_masker", j(gem_og_masker(t, TEKST, &[], &[]).map(|x| v(&x)))),
        ("demasker", j(demasker(t, "VAERT-001").map(|x| v(&x)))),
        ("sag_status", j(sag_status(t).map(|x| v(&x)))),
        ("sag_nulstil", j(sag_nulstil(t).map(|x| v(&x)))),
        ("sag_ny", j(sag_ny(t, "Ny sag", None).map(|x| v(&x)))),
        ("sag_liste", j(sag_liste(t).map(|x| v(&x)))),
        ("sag_aabn", j(sag_aabn(t, id).map(|x| v(&x)))),
        ("sag_luk", j(sag_luk(t).map(|x| v(&x)))),
        ("sag_omdoeb", j(sag_omdoeb(t, id, "Andet navn").map(|_| serde_json::Value::Null))),
        (
            "sag_udloeb",
            j(sag_udloeb(t, id, Some("2031-01-01")).map(|_| serde_json::Value::Null)),
        ),
        ("sag_valg", j(sag_valg(t, true, false).map(|x| v(&x)))),
        ("ordbog_hent", j(ordbog_hent(t).map(|x| v(&x)))),
        ("ordbog_tilfoej", j(ordbog_tilfoej(t, "ord", "Ravnsholt", None).map(|x| v(&x)))),
        ("ordbog_ret", j(ordbog_ret(t, 1, "Ravnsholt", None).map(|x| v(&x)))),
        ("ordbog_proev", j(ordbog_proev(t, TEKST).map(|x| v(&x)))),
        ("fil_analyser", j(fil_analyser(t, None, None, &[], &side).map(|x| v(&x)))),
        ("fil_raekker", j(fil_raekker(t, &side).map(|x| v(&x)))),
        ("fil_gem_og_masker", j(fil_gem_og_masker(t, &[], &[]).map(|x| v(&x)))),
        ("fil_demasker", j(fil_demasker(t).map(|x| v(&x)))),
        ("fil_kopi", j(fil_kopi(t, Visning::Masker).map(|x| v(&x)))),
        (
            "fil_gem_forslag",
            j(fil_gem_forslag(t, Visning::Masker, true).map(|f| serde_json::json!(f.navn))),
        ),
        ("fil_gem_til", j(fil_gem_til(t, Visning::Masker, &ud, true).map(|x| v(&x)))),
        ("fil_aabn", j(fil_aabn(t, Visning::Masker, fil).map(|x| v(&x)))),
        ("fil_luk", j(fil_luk(t, Visning::Demasker).map(|_| serde_json::Value::Null))),
        ("ordbog_start_forfra", j(ordbog_start_forfra(t, "2030-01-01").map(|x| v(&x)))),
        ("ordbog_fjern", j(ordbog_fjern(t, 1).map(|x| v(&x)))),
        ("sag_slet", j(sag_slet(t, id).map(|x| v(&x)))),
    ]
}

fn m_dir(fil: &std::path::Path) -> PathBuf {
    fil.parent().unwrap().to_path_buf()
}

/// Et svar som JSON (som Tauri sender det til webvisningen).
fn v<T: serde::Serialize>(x: &T) -> serde_json::Value {
    serde_json::to_value(x).unwrap()
}

/// Navnene på kommandoerne i `lib.rs` (`generate_handler!`).
fn kommandoer_i_lib() -> Vec<String> {
    let lib = include_str!("../src/lib.rs");
    let start = lib.find("generate_handler![").expect("generate_handler! findes") + "generate_handler![".len();
    let slut = start + lib[start..].find(']').unwrap();
    lib[start..slut]
        .split(',')
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect()
}

/// Kommandoer, der må virke, mens Grimnir er låst: de rører hverken sager, ordbog, filer eller nøgler.
const AABNE_I_LAAST: [&str; 8] = [
    "kerne_version",
    "menu_sprog",
    "program_afslut",
    "indstillinger_hent",
    "indstillinger_gem",
    "laas_status",
    "laas_op",
    "laas_ved_start",
];

#[test]
fn hver_kommando_er_enten_laast_eller_naevnt_som_aaben() {
    let m = Mappe::ny();
    let fil = m.0.join("indsat.log");
    std::fs::write(&fil, TEKST).unwrap();
    let t = Tilstand::ny();
    t.laas();
    let laaste: Vec<&str> = alle_kommandoer(&t, &fil, &"0".repeat(32)).into_iter().map(|(n, _)| n).collect();
    let lib = kommandoer_i_lib();
    assert!(lib.len() >= 36, "for få kommandoer i lib.rs: {}", lib.len());
    for k in &lib {
        let i_test = laaste.contains(&k.as_str()) || (k == "fil_aabn_sluppet") || (k == "fil_gem");
        assert!(
            i_test || AABNE_I_LAAST.contains(&k.as_str()),
            "{k} er hverken prøvet låst i denne test eller nævnt som åben i låst tilstand"
        );
        assert!(
            !(laaste.contains(&k.as_str()) && AABNE_I_LAAST.contains(&k.as_str())),
            "{k} står begge steder"
        );
    }
    // `fil_aabn_sluppet` og `fil_gem` kalder `maskering::fil_aabn` og `maskering::fil_gem_forslag` (prøvet ovenfor) før
    // noget andet; `fil_aabn` tjekker låsen, før dialogen åbnes.
    let lib_rs = include_str!("../src/lib.rs");
    let krop = |navn: &str| {
        let i = lib_rs.find(&format!("fn {navn}(")).unwrap_or_else(|| panic!("{navn} mangler"));
        &lib_rs[i..i + lib_rs[i..].find("\n}\n").unwrap()]
    };
    assert!(krop("fil_aabn_sluppet").contains("maskering::fil_aabn("));
    let gem = krop("fil_gem");
    assert!(gem.find("maskering::fil_gem_forslag(").unwrap() < gem.find("save_file()").unwrap());
    let aabn = krop("fil_aabn");
    assert!(aabn.find("tilstand.aaben()?").unwrap() < aabn.find("pick_file()").unwrap());
}

#[test]
fn laast_laeses_ingen_noegle_og_hver_kommando_svarer_laast() {
    let m = Mappe::ny();
    let lager = Arc::new(Taellende::default());
    let id = med_data(&m, &lager);
    let fil = m.0.join("indsat.log");
    std::fs::write(&fil, TEKST).unwrap();
    let sagsfil = m.0.join("sager").join(format!("{id}.grimnir"));
    let foer = std::fs::read(&sagsfil).unwrap();
    let ordbog_foer = std::fs::read(m.0.join("ordbog.grimnir")).unwrap();

    let t = start(&m, &lager);
    assert!(t.er_laast(), "standard: låst ved start");
    let opslag_foer = lager.opslag();
    for (navn, svar) in alle_kommandoer(&t, &fil, &id) {
        assert_eq!(svar, Err(UiFejl::Laast), "{navn}");
    }
    assert_eq!(lager.opslag() - opslag_foer, 0, "ingen nøgle er slået op, mens der er låst");
    assert_eq!(std::fs::read(&sagsfil).unwrap(), foer, "sagens fil er urørt");
    assert_eq!(std::fs::read(m.0.join("ordbog.grimnir")).unwrap(), ordbog_foer, "ordbogen er urørt");
    assert!(!m.0.join("ud.log").exists(), "intet er skrevet i brugerens mappe");
    // Indstillinger og låsens status virker.
    assert_eq!(indstillinger_hent(&t), Indstillinger::default());
    let i = Indstillinger {
        masker_fremmede: true,
        ..Indstillinger::default()
    };
    assert_eq!(indstillinger_gem(&t, i), Ok(i));
    assert_eq!(laas_status(&t), status(true, true, None));
    assert_eq!(lager.opslag() - opslag_foer, 0);

    // Lås op: nu virker kommandoerne og læser nøglerne.
    let d = HukommelsesDoer::ny(Svar::Ok);
    assert_eq!(laas_op(&t, &d, "da").status, status(false, true, None));
    let liste = sag_liste(&t).unwrap();
    assert_eq!(
        liste.iter().map(|p| p.navn.clone()).collect::<Vec<_>>(),
        vec![Some(SAGSNAVN.to_string())]
    );
    assert_eq!(
        ordbog_hent(&t).unwrap().poster.len(),
        1,
        "ordbogen er læst efter oplåsningen (ingen fejl fra låst tid)"
    );
    assert!(ordbog_hent(&t).unwrap().fejl.is_none());
    assert!(lager.opslag() > opslag_foer);
    assert_eq!(sag_aabn(&t, &id).unwrap().navn.as_deref(), Some(SAGSNAVN));
}

#[test]
fn laast_igen_med_aaben_fil_og_aaben_sag_svarer_laast() {
    // Også når der er en åben sag og en åben fil i hukommelsen, svarer kommandoerne `laast` (L2; låsen ved dvale og
    // stilstand er V-LAAS.3, men porten er den samme).
    let m = Mappe::ny();
    let lager = Arc::new(Taellende::default());
    let id = med_data(&m, &lager);
    let fil = m.0.join("indsat.log");
    std::fs::write(&fil, TEKST).unwrap();
    let t = Tilstand::paa_disk(m.0.clone(), lager.clone());
    sag_aabn(&t, &id).unwrap();
    fil_aabn(&t, Visning::Masker, &fil).unwrap();
    fil_aabn(&t, Visning::Demasker, &fil).unwrap();
    t.laas();
    let opslag_foer = lager.opslag();
    for (navn, svar) in alle_kommandoer(&t, &fil, &id) {
        assert_eq!(svar, Err(UiFejl::Laast), "{navn}");
    }
    assert_eq!(lager.opslag() - opslag_foer, 0);
}

#[test]
fn de_fem_svar_gennem_laas_op() {
    let m = Mappe::ny();
    let lager = Arc::new(Taellende::default());
    med_data(&m, &lager);
    let tilfaelde: [(Svar, LaasStatus); 6] = [
        (Svar::Ok, status(false, true, None)),
        (Svar::Annulleret, status(true, true, None)),
        (Svar::Afvist, status(true, true, None)),
        (
            Svar::IkkeTilgaengelig {
                hvorfor: "ingen_adgangskode",
            },
            status(false, true, Some("ingen_adgangskode")),
        ),
        (
            Svar::IkkeTilgaengelig { hvorfor: "platform" },
            status(false, true, Some("platform")),
        ),
        (Svar::Fejl { kode: -10 }, status(true, true, None)),
    ];
    for (svar, efter) in tilfaelde {
        let t = start(&m, &lager);
        let d = HukommelsesDoer::ny(svar.clone());
        let opslag_foer = lager.opslag();
        let ud = laas_op(&t, &d, "da");
        assert_eq!((ud.svar.clone(), ud.status.clone()), (svar.clone(), efter.clone()), "{svar:?}");
        assert_eq!(d.kald(), 1, "{svar:?}: døren spørges én gang");
        assert_eq!(d.sidste(), Some(begrundelse(Grund::Start, "da")));
        assert_eq!(lager.opslag(), opslag_foer, "{svar:?}: døren selv læser ingen nøgle");
        if efter.laast {
            assert_eq!(sag_liste(&t), Err(UiFejl::Laast), "{svar:?}: stadig låst");
            // Programmet lukker ikke; brugeren kan prøve igen (Lås op på låseskærmen).
            d.svar(Svar::Ok);
            assert_eq!(laas_op(&t, &d, "en").status, status(false, true, None));
            assert_eq!(d.sidste(), Some(begrundelse(Grund::Start, "en")));
        }
        assert_eq!(sag_liste(&t).unwrap().len(), 1, "{svar:?}: låst op giver adgang");
    }
}

#[test]
fn allerede_laast_op_spoerger_ikke_doeren() {
    let t = Tilstand::ny();
    let d = HukommelsesDoer::ny(Svar::Afvist);
    assert_eq!(laas_op(&t, &d, "da").svar, Svar::Ok);
    assert_eq!(d.kald(), 0);
}

/// En dør, der venter lidt, før den svarer (to tryk på "Lås op" lige efter hinanden).
struct LangsomDoer(HukommelsesDoer);
impl Doer for LangsomDoer {
    fn laas_op(&self, grund: &Begrundelse) -> Svar {
        std::thread::sleep(Duration::from_millis(50));
        self.0.laas_op(grund)
    }
}

#[test]
fn to_tryk_paa_laas_op_giver_en_dialog() {
    let t = Arc::new(Tilstand::ny());
    t.laas();
    let d = Arc::new(LangsomDoer(HukommelsesDoer::ny(Svar::Ok)));
    let traade: Vec<_> = (0..2)
        .map(|_| {
            let (t, d) = (t.clone(), d.clone());
            std::thread::spawn(move || laas_op(&t, d.as_ref(), "da").svar)
        })
        .collect();
    let svar: Vec<Svar> = traade.into_iter().map(|h| h.join().unwrap()).collect();
    assert_eq!(svar, vec![Svar::Ok, Svar::Ok]);
    assert_eq!(d.0.kald(), 1, "døren er spurgt én gang");
    assert!(!t.er_laast());
}

#[test]
fn laas_ved_start_fra_kraever_oplaasning() {
    let m = Mappe::ny();
    let lager = Arc::new(Taellende::default());
    med_data(&m, &lager);
    let t = start(&m, &lager);
    let d = HukommelsesDoer::ny(Svar::Ok);
    laas_op(&t, &d, "da");
    assert!(!t.er_laast());

    // indstillinger_gem kan ikke slå låsen fra.
    let fra = Indstillinger {
        laas_ved_start: false,
        ..indstillinger_hent(&t)
    };
    assert!(indstillinger_gem(&t, fra).unwrap().laas_ved_start);
    assert!(indstillinger_hent(&t).laas_ved_start);

    // Annulleret, Afvist og Fejl: intet ændret, også på disken; døren er spurgt med sin egen tekst.
    for svar in [Svar::Annulleret, Svar::Afvist, Svar::Fejl { kode: -1004 }] {
        let d = HukommelsesDoer::ny(svar.clone());
        let ud = laas_ved_start(&t, &d, false, "en").unwrap();
        assert_eq!(ud.svar, svar);
        assert_eq!(ud.status, status(false, true, None));
        assert_eq!(d.kald(), 1);
        assert_eq!(d.sidste(), Some(begrundelse(Grund::SlaaFra, "en")));
        assert!(indstillinger_hent(&t).laas_ved_start);
        assert!(start(&m, &lager).er_laast(), "{svar:?}: næste start er stadig låst");
    }

    // Ok: gemt; næste start er ulåst og spørger ikke.
    let d = HukommelsesDoer::ny(Svar::Ok);
    let ud = laas_ved_start(&t, &d, false, "da").unwrap();
    assert_eq!((ud.svar, ud.status), (Svar::Ok, status(false, false, None)));
    assert_eq!(d.sidste(), Some(begrundelse(Grund::SlaaFra, "da")));
    let json = std::fs::read_to_string(m.0.join("indstillinger.json")).unwrap();
    assert!(json.contains("\"laas_ved_start\": false"), "{json}");
    let t2 = start(&m, &lager);
    assert!(!t2.er_laast());
    assert_eq!(sag_liste(&t2).unwrap().len(), 1);

    // Til igen kræver ingen dør; næste start er låst.
    let d = HukommelsesDoer::ny(Svar::Afvist);
    let ud = laas_ved_start(&t2, &d, true, "da").unwrap();
    assert_eq!((ud.svar, d.kald()), (Svar::Ok, 0));
    assert!(start(&m, &lager).er_laast());
    // Allerede fra: at slå den fra igen spørger ikke.
    let d = HukommelsesDoer::ny(Svar::Ok);
    laas_ved_start(&t2, &d, false, "da").unwrap();
    laas_ved_start(&t2, &d, false, "da").unwrap();
    assert_eq!(d.kald(), 1);
}

#[test]
fn laas_ved_start_fra_mens_laast_laaser_op_ved_ok() {
    let m = Mappe::ny();
    let lager = Arc::new(Taellende::default());
    med_data(&m, &lager);
    let t = start(&m, &lager);
    let d = HukommelsesDoer::ny(Svar::Annulleret);
    assert_eq!(laas_ved_start(&t, &d, false, "da").unwrap().status, status(true, true, None));
    d.svar(Svar::Ok);
    assert_eq!(laas_ved_start(&t, &d, false, "da").unwrap().status, status(false, false, None));
    assert_eq!(sag_liste(&t).unwrap().len(), 1);
    // En maskine, der ikke kan bekræfte brugeren: valget gemmes, og banneret står.
    let m2 = Mappe::ny();
    let t = start(&m2, &lager);
    let d = HukommelsesDoer::ny(Svar::IkkeTilgaengelig { hvorfor: "platform" });
    assert_eq!(
        laas_ved_start(&t, &d, false, "da").unwrap().status,
        status(false, false, Some("platform"))
    );
}

#[test]
fn indstillingen_fra_starter_ulaast_og_aeldre_fil_er_laast() {
    let m = Mappe::ny();
    std::fs::write(m.0.join("indstillinger.json"), "{\"laas_ved_start\": false}").unwrap();
    let lager = Arc::new(Taellende::default());
    assert!(!start(&m, &lager).er_laast());
    // En ældre fil uden feltet, en beskadiget fil og ingen fil: låst.
    for indhold in [Some("{\"guide_vist\": true}"), Some("{ikke json"), None] {
        match indhold {
            Some(x) => std::fs::write(m.0.join("indstillinger.json"), x).unwrap(),
            None => std::fs::remove_file(m.0.join("indstillinger.json")).unwrap(),
        }
        assert!(start(&m, &lager).er_laast(), "{indhold:?}");
    }
    // Uden mappe (app-data kunne ikke findes) er programmet også låst ved start.
    assert!(Tilstand::ny().ved_start().er_laast());
    assert!(!Tilstand::ny().er_laast(), "en ny tilstand alene er ulåst (tests)");
}

#[test]
fn fejl_og_svar_er_uden_indhold() {
    let m = Mappe::ny();
    let lager = Arc::new(Taellende::default());
    let id = med_data(&m, &lager);
    let fil = m.0.join("indsat.log");
    std::fs::write(&fil, TEKST).unwrap();
    let t = start(&m, &lager);
    let mut alt = String::new();
    for (_, svar) in alle_kommandoer(&t, &fil, &id) {
        alt += &serde_json::to_string(&svar.unwrap_err()).unwrap();
    }
    assert_eq!(serde_json::to_string(&UiFejl::Laast).unwrap(), r#"{"art":"laast"}"#);
    alt += &serde_json::to_string(&laas_status(&t)).unwrap();
    for svar in [
        Svar::Annulleret,
        Svar::Afvist,
        Svar::Fejl { kode: -10 },
        Svar::IkkeTilgaengelig { hvorfor: "platform" },
        Svar::Ok,
    ] {
        let t = start(&m, &lager);
        alt += &serde_json::to_string(&laas_op(&t, &HukommelsesDoer::ny(svar), "da")).unwrap();
    }
    let j = serde_json::to_string(&laas_op(&start(&m, &lager), &HukommelsesDoer::ny(Svar::Fejl { kode: -1004 }), "da")).unwrap();
    assert_eq!(
        j,
        r#"{"svar":"fejl","kode":-1004,"status":{"laast":true,"ved_start":true,"uden_doer":null}}"#
    );
    for hemmeligt in [SAGSNAVN, ORD, "kontor.test", "10.20.0.5", "anders", &id, m.0.to_str().unwrap()] {
        assert!(!alt.contains(hemmeligt), "{hemmeligt} står i et svar: {alt}");
    }
    // Vagten om nøglelageret afviser uden indhold (nås kun, hvis en kommando mangler porten).
    assert_eq!(
        serde_json::to_string(&SagFejl::Noeglering { hvad: "laast" }).unwrap(),
        r#"{"art":"noeglering","hvad":"laast"}"#
    );
}
