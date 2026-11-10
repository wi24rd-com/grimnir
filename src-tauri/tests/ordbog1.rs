//! V-ORDBOG.1 O8 (skallen uden vindue): ordbogen på disk, kommandoerne, validering, analysen med ordbog, låsefilen,
//! oprydningen og indstillingerne. Mappen er en midlertidig mappe fra `std::env::temp_dir()` med tilfældigt navn, ryddet
//! efter testen; nøglelageret ligger i hukommelsen og rører aldrig den rigtige Nøglering. Kun opdigtede værdier:
//! `kontor.test`, RFC 1918-adresser, opfundne navne og ord.

use std::path::PathBuf;
use std::sync::{Arc, Barrier};
use std::time::{Duration, SystemTime};

use grimnir_lib::indstillinger::Indstillinger;
use grimnir_lib::maskering::{
    analyser, gem_og_masker, indstillinger_gem, indstillinger_hent, ordbog_fjern, ordbog_hent, ordbog_proev, ordbog_ret, ordbog_tilfoej,
    sag_luk, sag_ny, sag_status, sag_valg, Analyse, Tilstand, UiFejl,
};
use grimnir_lib::ordbog::{self, OrdbogPost, Ordbogsfil, PostType, KONTO};
use grimnir_lib::sager::{
    anslaa_krop, json_klar, laas_sti, ryd_midlertidige, skriv, sti, tag_laas, Arkiv, Hoved, HukommelsesLager, Noegle, Noeglelager, SagFejl,
    SagsId, LAAS_VENT,
};

/// En midlertidig mappe, der slettes igen.
struct Mappe(PathBuf);
impl Mappe {
    fn ny() -> Self {
        let p = std::env::temp_dir().join(format!("grimnir-test-{}", SagsId::ny().unwrap().hex()));
        std::fs::create_dir_all(&p).unwrap();
        Mappe(p)
    }
}
impl Drop for Mappe {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}

/// Et "program" på mappen med et fælles nøglelager (som Keychain, der overlever programmet).
fn program(m: &Mappe, lager: &Arc<HukommelsesLager>) -> Tilstand {
    Tilstand::paa_disk(m.0.clone(), lager.clone())
}

fn ny() -> (Mappe, Arc<HukommelsesLager>) {
    (Mappe::ny(), Arc::new(HukommelsesLager::ny()))
}

fn tilfoej(t: &Tilstand, type_: &str, v: &str, note: Option<&str>) -> Vec<OrdbogPost> {
    ordbog_tilfoej(t, type_, v, note)
        .unwrap_or_else(|e| panic!("{type_} afvist: {e:?}"))
        .poster
}

/// Fejlene for en afvist post.
fn afvist(r: Result<grimnir_lib::maskering::OrdbogUd, UiFejl>) -> Vec<(&'static str, &'static str)> {
    match r {
        Err(UiFejl::Ordbog { fejl }) => fejl.into_iter().map(|f| (f.felt, f.fejl)).collect(),
        Err(e) => panic!("forventede feltfejl, fik {e:?}"),
        Ok(_) => vec![("tilføjet", "")],
    }
}

fn vaerdier(p: &[OrdbogPost]) -> Vec<(PostType, String, Option<String>)> {
    p.iter().map(|x| (x.type_, x.vaerdi.clone(), x.note.clone())).collect()
}

fn fravalgt(a: &Analyse) -> Vec<usize> {
    a.raekker.iter().filter(|r| !r.valgt).map(|r| r.id).collect()
}

fn indeholder(hoestak: &[u8], naal: &str) -> bool {
    let h = hoestak.to_ascii_lowercase();
    let n = naal.to_ascii_lowercase().into_bytes();
    h.windows(n.len()).any(|w| w == n.as_slice())
}

const VAERDIER: [&str; 9] = [
    "kontor.test",
    "KONTOR",
    "srv-###",
    "10.20.0.0/16",
    "Uglebo",
    "Anders Eksempelsen",
    "10.20.30.40",
    "kunde Uglebo, hemmeligt",
    "fællesdrev",
];

/// En ordbog med én post af hver type (noterne er også følsomme).
fn fyld(t: &Tilstand) {
    tilfoej(t, "domaene", " kontor.test ", Some("hoveddomænet"));
    tilfoej(t, "netbios", "KONTOR", None);
    tilfoej(t, "navnemoenster", "srv-###", Some("servere"));
    tilfoej(t, "eget_net", "10.20.0.0/16", None);
    tilfoej(t, "ord", "Uglebo", Some(VAERDIER[7]));
    tilfoej(t, "person", "Anders Eksempelsen", None);
    tilfoej(t, "aldrig", "10.20.30.40", Some(VAERDIER[8]));
}

// ------------------------------------------------------------------------------------------------------- O1

#[test]
fn ordbogens_rundtur_paa_disk() {
    let (m, lager) = ny();
    let t = program(&m, &lager);
    assert!(
        ordbog_hent(&t).poster.is_empty() && ordbog_hent(&t).fejl.is_none(),
        "uden fil er ordbogen tom"
    );
    assert!(!m.0.join(ordbog::FILNAVN).exists(), "at læse en tom ordbog skriver intet");
    fyld(&t);
    let foer = vaerdier(&ordbog_hent(&t).poster);
    assert_eq!(foer.len(), 7);
    assert_eq!(
        foer[0],
        (PostType::Domaene, "kontor.test".into(), Some("hoveddomænet".into())),
        "værdien trimmes"
    );
    assert!(lager.har_konto(KONTO), "nøglen står under kontoen ordbog");
    // "Programmet lukkes og startes igen": en ny tilstand på samme mappe og nøglelager.
    drop(t);
    let t2 = program(&m, &lager);
    let efter = ordbog_hent(&t2);
    assert!(efter.fejl.is_none());
    assert_eq!(vaerdier(&efter.poster), foer);
    let ider: Vec<u64> = efter.poster.iter().map(|p| p.id).collect();
    assert_eq!(ider, (1..=7).collect::<Vec<_>>());
    // Ret og fjern overlever også en genstart.
    ordbog_ret(&t2, 5, "Uglebo2", None).unwrap();
    ordbog_fjern(&t2, 6).unwrap();
    let t3 = program(&m, &lager);
    let p = ordbog_hent(&t3).poster;
    assert_eq!(p.len(), 6);
    assert!(p.iter().any(|x| x.id == 5 && x.vaerdi == "Uglebo2" && x.note.is_none()));
    assert!(!p.iter().any(|x| x.id == 6));
    assert_eq!(
        ordbog_ret(&t3, 99, "x1", None).err(),
        Some(UiFejl::Ordbog {
            fejl: vec![ordbog::FeltFejl {
                felt: "id",
                fejl: "ukendt_post"
            }]
        })
    );
}

#[test]
fn filens_format_og_bytes_indeholder_ingen_vaerdier() {
    let (m, lager) = ny();
    let t = program(&m, &lager);
    fyld(&t);
    let b = std::fs::read(m.0.join(ordbog::FILNAVN)).unwrap();
    assert_eq!(&b[..8], b"GRIMNIRS");
    assert_eq!(u16::from_le_bytes([b[8], b[9]]), 1);
    let l1 = u32::from_le_bytes(b[34..38].try_into().unwrap()) as usize;
    let l2 = u64::from_le_bytes(b[62 + l1..70 + l1].try_into().unwrap()) as usize;
    assert_eq!(
        b.len(),
        70 + l1 + l2,
        "filen slutter præcis efter kroppen (samme format som en sag)"
    );
    for v in VAERDIER
        .iter()
        .chain(["hoveddomænet", "servere", "ordbog", "domaene", "aldrig"].iter())
    {
        assert!(!indeholder(&b, v), "filen indeholder {v:?} i klartekst");
    }
    // Ingen midlertidige filer eller låse er efterladt.
    let navne: Vec<String> = std::fs::read_dir(&m.0)
        .unwrap()
        .flatten()
        .map(|e| e.file_name().to_string_lossy().into_owned())
        .collect();
    assert!(navne.iter().all(|n| !n.ends_with(".tmp") && !n.ends_with(".lock")), "{navne:?}");
}

#[test]
fn sagsfil_som_ordbog_og_omvendt_afvises() {
    let (m, lager) = ny();
    // En sagsfil, lagt ind som ordbog med samme nøgle under kontoen ordbog: AAD har sags-id'et, ikke "ordbog".
    let id = SagsId::ny().unwrap();
    let noegle = Noegle::fra_bytes(&[7u8; 32]).unwrap();
    let hoved = Hoved {
        navn: "Prøvesag".into(),
        oprettet: 1,
        sidst_brugt: 1,
        udloeb: None,
        poster: 0,
        skrivetaeller: 1,
    };
    skriv(&m.0, &id, &noegle, &hoved, grimnir_core::Sag::default().data()).unwrap();
    std::fs::copy(sti(&m.0, &id), m.0.join(ordbog::FILNAVN)).unwrap();
    lager.gem_konto(KONTO, &Noegle::fra_bytes(&[7u8; 32]).unwrap()).unwrap();
    let fil = Ordbogsfil::ny(m.0.clone(), Box::new(lager.clone()));
    assert_eq!(fil.laes().err(), Some(SagFejl::Beskadiget), "en sagsfil kan ikke læses som ordbog");
    assert_eq!(
        ordbog::laes_fil(&m.0.join(ordbog::FILNAVN), &Noegle::fra_bytes(&[7u8; 32]).unwrap()).err(),
        Some(SagFejl::Beskadiget)
    );

    // Og omvendt: en ordbog lagt ind som sag med ordbogens nøgle under sagens konto.
    let (m2, lager2) = ny();
    let t = program(&m2, &lager2);
    fyld(&t);
    let id2 = SagsId::ny().unwrap();
    std::fs::create_dir_all(m2.0.join("sager")).unwrap();
    std::fs::copy(m2.0.join(ordbog::FILNAVN), sti(&m2.0.join("sager"), &id2)).unwrap();
    let n = lager2.hent_konto(KONTO).unwrap();
    lager2.gem(&id2, &n).unwrap();
    let arkiv = Arkiv::ny(m2.0.join("sager"), Box::new(lager2.clone()));
    assert_eq!(
        arkiv.aabn(&id2).err(),
        Some(SagFejl::Beskadiget),
        "en ordbog kan ikke åbnes som sag"
    );
    let liste = arkiv.liste().unwrap();
    assert_eq!(liste.len(), 1);
    assert_eq!(liste[0].hoved.as_ref().err(), Some(&SagFejl::Beskadiget));
}

#[test]
fn beskadiget_ordbog_overskrives_ikke() {
    for (art, forventet) in [
        ("affald", SagFejl::Beskadiget),
        ("uden nøgle", SagFejl::ManglerNoegle),
        ("ny version", SagFejl::UkendtVersion { version: 2 }),
    ] {
        let (m, lager) = ny();
        let fil = m.0.join(ordbog::FILNAVN);
        match art {
            "affald" => {
                lager.gem_konto(KONTO, &Noegle::ny().unwrap()).unwrap();
                std::fs::write(&fil, b"GRIMNIRS\x01\x00 dette er ikke en ordbog").unwrap();
            }
            "uden nøgle" => {
                let t = program(&m, &lager);
                fyld(&t);
                lager.slet_konto(KONTO).unwrap();
            }
            _ => {
                let t = program(&m, &lager);
                fyld(&t);
                let mut b = std::fs::read(&fil).unwrap();
                b[8] = 2;
                std::fs::write(&fil, b).unwrap();
            }
        }
        let foer = std::fs::read(&fil).unwrap();
        let t = program(&m, &lager);
        let ud = ordbog_hent(&t);
        assert_eq!(
            ud.fejl,
            Some(forventet.clone()),
            "{art}: programmet siger tydeligt, at ordbogen ikke kunne åbnes"
        );
        assert!(ud.poster.is_empty(), "{art}: tom ordbog i hukommelsen");
        assert_eq!(
            ordbog_tilfoej(&t, "ord", "Uglebo", None).err(),
            Some(UiFejl::OrdbogLaast { fejl: forventet.clone() })
        );
        assert_eq!(ordbog_fjern(&t, 1).err(), Some(UiFejl::OrdbogLaast { fejl: forventet.clone() }));
        // Programmet arbejder videre: analysen kører med en tom ordbog.
        let a = analyser(&t, "Projekt Uglebo på srv-068 fra 10.20.30.11\n", None, &[]).unwrap();
        assert!(a.raekker.iter().all(|r| r.status != "ordbog"), "{art}");
        assert_eq!(std::fs::read(&fil).unwrap(), foer, "{art}: filen er uændret");
    }
}

// ------------------------------------------------------------------------------------------------------- O2 validering

#[test]
fn validering_pr_type() {
    let t = Tilstand::ny();
    let gode = [
        ("domaene", "kontor.test"),
        ("domaene", "afd-3.kontor.test"),
        ("netbios", "KONTOR"),
        ("netbios", "AFD_3"),
        ("navnemoenster", "srv-###"),
        ("navnemoenster", "WS-*"),
        ("eget_net", "10.20.0.0/16"),
        ("eget_net", "172.16.5.0/24"),
        ("eget_net", "192.168.7.9"),
        ("ord", "Uglebo"),
        ("person", "Anders Eksempelsen"),
        ("aldrig", "localhost"),
    ];
    for (type_, v) in gode {
        tilfoej(&t, type_, v, None);
    }
    let daarlige = [
        ("domaene", "kontor", "ugyldigt_domaene"),
        ("domaene", ".kontor.test", "ugyldigt_domaene"),
        ("domaene", "kontor..test", "ugyldigt_domaene"),
        ("domaene", "kon tor.test", "ugyldigt_domaene"),
        ("netbios", "kontor.test", "ugyldigt_netbios"),
        ("netbios", "ETNAVNPAAOVER15TEGN", "ugyldigt_netbios"),
        ("navnemoenster", "srv-[0-9]", "ugyldigt_moenster"),
        ("navnemoenster", "srv.###", "ugyldigt_moenster"),
        ("navnemoenster", "###", "ugyldigt_moenster"),
        ("navnemoenster", "*", "ugyldigt_moenster"),
        ("eget_net", "10.20.0.0/33", "ugyldigt_net"),
        ("eget_net", "10.20.300.0/24", "ugyldigt_net"),
        ("eget_net", "kontor.test", "ugyldigt_net"),
        ("eget_net", "0.0.0.0/0", "for_bredt_net"),
        ("eget_net", "10.0.0.0/7", "for_bredt_net"),
        ("ord", "U", "for_kort"),
        ("ord", "   ", "tom"),
        ("person", "", "tom"),
        ("ord", "linje\nskift", "styretegn"),
        ("ord", "Zq8Xv2Lm9Pw4Rt7Yk3Nb6Hc1Jd5Fg0Qs", "hemmelighed"),
        ("aldrig", "Hk3Nb6Zq8Xv2Lm9Pw4Rt7Yc1Jd5Fg0Qs", "hemmelighed"),
    ];
    for (type_, v, fejl) in daarlige {
        assert_eq!(afvist(ordbog_tilfoej(&t, type_, v, None)), vec![("vaerdi", fejl)], "{type_} {v:?}");
    }
    assert_eq!(
        afvist(ordbog_tilfoej(&t, "ord", &"x".repeat(254), None)),
        vec![("vaerdi", "for_lang")]
    );
    assert_eq!(
        afvist(ordbog_tilfoej(&t, "ord", "Projekt7", Some(&"n".repeat(201)))),
        vec![("note", "for_lang")]
    );
    assert_eq!(
        afvist(ordbog_tilfoej(&t, "ord", "Projekt7", Some("a\tb"))),
        vec![("note", "styretegn")]
    );
    assert_eq!(afvist(ordbog_tilfoej(&t, "kunde", "Projekt7", None)), vec![("type", "ukendt_type")]);
    // Fejl i både værdi og note meldes samtidig; intet er gemt.
    assert_eq!(
        afvist(ordbog_tilfoej(&t, "domaene", "kontor", Some("a\u{7}"))),
        vec![("vaerdi", "ugyldigt_domaene"), ("note", "styretegn")]
    );
    assert_eq!(ordbog_hent(&t).poster.len(), gode.len());
    // En tom note bliver ingen note.
    let p = tilfoej(&t, "ord", "Projekt7", Some("   "));
    assert!(p.last().unwrap().note.is_none());
}

#[test]
fn dubletter_og_maskeraltid_mod_maskeraldrig() {
    let t = Tilstand::ny();
    tilfoej(&t, "domaene", "kontor.test", None);
    tilfoej(&t, "aldrig", "8-bit", None);
    assert_eq!(
        afvist(ordbog_tilfoej(&t, "domaene", "KONTOR.test", None)),
        vec![("vaerdi", "dublet")],
        "dublet uafhængigt af store/små"
    );
    assert_eq!(
        afvist(ordbog_tilfoej(&t, "ord", "Kontor.Test", None)),
        vec![("vaerdi", "dublet")],
        "dublet på tværs af maskér altid"
    );
    assert_eq!(
        afvist(ordbog_tilfoej(&t, "aldrig", "kontor.TEST", None)),
        vec![("vaerdi", "modstrid")],
        "altid → aldrig"
    );
    assert_eq!(
        afvist(ordbog_tilfoej(&t, "ord", "8-BIT", None)),
        vec![("vaerdi", "modstrid")],
        "aldrig → altid"
    );
    assert_eq!(afvist(ordbog_tilfoej(&t, "aldrig", "8-Bit", None)), vec![("vaerdi", "dublet")]);
    // En rettelse må beholde sin egen værdi (med andre store/små), men ikke ramme en anden posts.
    let ud = ordbog_ret(&t, 1, "Kontor.Test", Some("nu med note")).unwrap();
    assert_eq!(ud.poster[0].vaerdi, "Kontor.Test");
    assert_eq!(afvist(ordbog_ret(&t, 2, "kontor.test", None)), vec![("vaerdi", "modstrid")]);
    assert_eq!(ordbog_hent(&t).poster.len(), 2);
}

// ------------------------------------------------------------------------------------------------------- analysen

const FRI: &str = "Projekt Uglebo kører nu på srv-068 og srv-069.\r\nsrv-068 svarer fra 10.20.30.11; 10.20.30.40 er printeren.\r\nMvh Anders Eksempelsen\r\n";

#[test]
fn analyser_med_ordbog_finder_moenster_og_ord_og_maskeraldrig_vinder() {
    let (m, lager) = ny();
    let t = program(&m, &lager);
    // Uden ordbog: hverken srv-068 (intet domæne) eller Uglebo er fundet.
    let foer = analyser(&t, FRI, None, &[]).unwrap();
    let har = |a: &Analyse, v: &str| {
        a.raekker
            .iter()
            .find(|r| r.vaerdier.iter().any(|x| x == v))
            .map(|r| (r.art, r.status, r.valgt))
    };
    assert_eq!(har(&foer, "srv-068"), None);
    assert_eq!(har(&foer, "Uglebo"), None);
    assert!(har(&foer, "10.20.30.40").is_some(), "uden ordbog maskeres egne adresser");

    tilfoej(&t, "navnemoenster", "srv-###", None);
    tilfoej(&t, "ord", "Uglebo", None);
    tilfoej(&t, "person", "Anders Eksempelsen", None);
    tilfoej(&t, "aldrig", "srv-069", None);
    tilfoej(&t, "aldrig", "10.20.30.40", None);
    let a = analyser(&t, FRI, None, &[]).unwrap();
    assert_eq!(har(&a, "srv-068"), Some(("vaert", "ordbog", true)), "navnemønster uden domæne");
    assert_eq!(har(&a, "Uglebo"), Some(("ord", "ordbog", true)), "ord i fri tekst");
    assert_eq!(har(&a, "Anders Eksempelsen"), Some(("person", "ordbog", true)));
    assert_eq!(har(&a, "srv-069"), None, "maskér aldrig vinder over navnemønstret");
    assert_eq!(har(&a, "10.20.30.40"), None, "maskér aldrig vinder over eget net");
    assert_eq!(a.raekker.iter().find(|r| r.vaerdier[0] == "srv-068").unwrap().antal, 2);

    // Gem og maskér: værdierne er væk, srv-069 og printeren står, og lækagetjekket melder dem ikke.
    let mk = gem_og_masker(&t, FRI, &fravalgt(&a), &[]).unwrap();
    for v in ["srv-068", "Uglebo", "Anders Eksempelsen", "10.20.30.11"] {
        assert!(!mk.maskeret.contains(v), "{v} er ikke maskeret");
    }
    assert!(mk.maskeret.contains("srv-069") && mk.maskeret.contains("10.20.30.40"));
    assert!(
        mk.rester.is_empty(),
        "rester: {:?}",
        mk.rester.iter().map(|r| (r.art, r.type_)).collect::<Vec<_>>()
    );
    assert_eq!(mk.maskeret.matches("\r\n").count(), 3);

    // Fjernes en værdi fra ordbogen, finder lækagetjekket den ikke længere som ordbogsværdi, men sagen kender den.
    let id = ordbog_hent(&t).poster.iter().find(|p| p.vaerdi == "srv-069").unwrap().id;
    ordbog_fjern(&t, id).unwrap();
    let a2 = analyser(&t, FRI, None, &[]).unwrap();
    assert_eq!(har(&a2, "srv-069"), Some(("vaert", "ordbog", true)));
}

#[test]
fn proev_paa_tekst_viser_det_ordbogen_fanger_og_roerer_ikke_sagen() {
    let t = Tilstand::ny();
    tilfoej(&t, "navnemoenster", "srv-###", None);
    tilfoej(&t, "ord", "Uglebo", None);
    tilfoej(&t, "aldrig", "10.20.30.40", None);
    let p = ordbog_proev(&t, FRI).unwrap();
    let f: Vec<(&str, &str, &str, usize, usize)> = p
        .fund
        .iter()
        .map(|x| (x.status, x.art, x.tekst.as_str(), x.antal, x.linje))
        .collect();
    assert!(f.contains(&("fanget", "vaert", "srv-068", 2, 1)), "{f:?}");
    assert!(f.contains(&("fanget", "vaert", "srv-069", 1, 1)));
    assert!(f.contains(&("fanget", "ord", "Uglebo", 1, 1)));
    assert!(f.contains(&("aldrig", "ipv4_egen", "10.20.30.40", 1, 2)));
    assert!(
        !f.iter().any(|x| x.2 == "10.20.30.11"),
        "fund, der ikke kommer fra ordbogen, står ikke som fanget"
    );
    assert!(p.i_alt > f.len());
    assert_eq!(sag_status(&t).poster, 0, "sagen er ikke rørt");
    assert_eq!(ordbog_proev(&t, "").err(), Some(UiFejl::TomTekst));
}

#[test]
fn konflikt_mellem_to_programmer_laeser_ordbogen_igen() {
    let (m, lager) = ny();
    let a = program(&m, &lager);
    let b = program(&m, &lager);
    assert!(ordbog_hent(&b).poster.is_empty());
    tilfoej(&a, "ord", "Uglebo", None);
    assert_eq!(
        ordbog_tilfoej(&b, "ord", "Projekt7", None).err(),
        Some(UiFejl::OrdbogFil { fejl: SagFejl::Konflikt })
    );
    // B har læst ordbogen igen og ser A's post; næste forsøg lykkes og overskriver intet.
    assert_eq!(vaerdier(&ordbog_hent(&b).poster), vec![(PostType::Ord, "Uglebo".into(), None)]);
    tilfoej(&b, "ord", "Projekt7", None);
    let c = program(&m, &lager);
    assert_eq!(ordbog_hent(&c).poster.len(), 2);
}

// ------------------------------------------------------------------------------------------------------- O7

#[test]
fn laasefilen_med_to_traade() {
    let (m, lager) = ny();
    let arkiv = Arkiv::ny(m.0.join("sager"), Box::new(lager.clone()));
    let aaben = arkiv.opret("Prøvesag", None, grimnir_core::Sag::default().data(), 1).unwrap();
    let id = aaben.id;
    // To "vinduer" har sagen åben med samme skrivetæller.
    let (mut a, data_a) = arkiv.aabn(&id).unwrap();
    let (mut b, data_b) = arkiv.aabn(&id).unwrap();
    let start = Barrier::new(2);
    let (ra, rb) = std::thread::scope(|s| {
        let ta = s.spawn(|| {
            let mut h = a.hoved.clone();
            // A holder låsen og venter mellem kontrollen og omdøbningen; B starter i det øjeblik.
            arkiv.gem_med(&a, &mut h, &data_a, &mut || {
                start.wait();
                std::thread::sleep(Duration::from_millis(300));
                Ok(())
            })
        });
        let tb = s.spawn(|| {
            start.wait();
            let h = b.hoved.clone();
            arkiv.gem(&mut b, h, &data_b)
        });
        (ta.join().unwrap(), tb.join().unwrap())
    });
    assert_eq!(ra, Ok(()));
    assert_eq!(rb, Err(SagFejl::Konflikt), "B ventede på låsen og så A's skrivetæller");
    a.hoved.skrivetaeller += 1;
    let (paa_disk, _) = arkiv.aabn(&id).unwrap();
    assert_eq!(paa_disk.hoved.skrivetaeller, 2);
    assert!(!laas_sti(&sti(&m.0.join("sager"), &id)).exists(), "låsefilen er fjernet igen");

    // En frisk lås, en anden holder: der ventes LAAS_VENT og svares Optaget; intet skrives.
    let fil = sti(&m.0.join("sager"), &id);
    let holdt = tag_laas(&fil).unwrap();
    let foer = std::fs::read(&fil).unwrap();
    let t0 = std::time::Instant::now();
    let (mut c, data_c) = arkiv.aabn(&id).unwrap();
    let h = c.hoved.clone();
    assert_eq!(arkiv.gem(&mut c, h, &data_c), Err(SagFejl::Optaget));
    assert!(t0.elapsed() >= LAAS_VENT);
    assert_eq!(std::fs::read(&fil).unwrap(), foer);
    drop(holdt);
    assert!(!laas_sti(&fil).exists());

    // En efterladt lås ældre end 30 sekunder overtages.
    let l = std::fs::File::create(laas_sti(&fil)).unwrap();
    l.set_modified(SystemTime::now() - Duration::from_secs(31)).unwrap();
    drop(l);
    let h = c.hoved.clone();
    assert_eq!(arkiv.gem(&mut c, h, &data_c), Ok(()));
    assert!(!laas_sti(&fil).exists());
}

#[test]
fn ordbogens_skrivning_holder_laasen() {
    let (m, lager) = ny();
    let fil = Ordbogsfil::ny(m.0.clone(), Box::new(lager.clone()));
    let post = |id: u64, v: &str| OrdbogPost {
        id,
        type_: PostType::Ord,
        vaerdi: v.into(),
        note: None,
        oprettet: 1,
    };
    assert_eq!(fil.gem(0, &[post(1, "Uglebo")]), Ok(1));
    let start = Barrier::new(2);
    let (ra, rb) = std::thread::scope(|s| {
        let ta = s.spawn(|| {
            fil.gem_med(1, &[post(1, "Uglebo"), post(2, "Projekt7")], &mut || {
                start.wait();
                std::thread::sleep(Duration::from_millis(300));
                Ok(())
            })
        });
        let tb = s.spawn(|| {
            start.wait();
            fil.gem(1, &[post(1, "Uglebo"), post(3, "Projekt8")])
        });
        (ta.join().unwrap(), tb.join().unwrap())
    });
    assert_eq!((ra, rb), (Ok(2), Err(SagFejl::Konflikt)));
    let (n, p) = fil.laes().unwrap();
    assert_eq!(n, 2);
    assert_eq!(p.iter().map(|x| x.vaerdi.as_str()).collect::<Vec<_>>(), ["Uglebo", "Projekt7"]);
}

#[test]
fn oprydning_af_midlertidige_filer() {
    let m = Mappe::ny();
    let gammel = SystemTime::now() - Duration::from_secs(2 * 60 * 60);
    let lav = |navn: &str, tid: SystemTime| {
        let f = std::fs::File::create(m.0.join(navn)).unwrap();
        f.set_modified(tid).unwrap();
    };
    let hex = SagsId::ny().unwrap().hex();
    let slettes = [
        format!(".{hex}.0a1b2c3d.tmp"),
        ".ordbog.0a1b2c3d.tmp".into(),
        ".indstillinger.ffffffff.tmp".into(),
    ];
    let bliver = [
        format!(".{hex}.0a1b2c3d.tmpx"),
        format!("{hex}.grimnir"),
        ".andet.0a1b2c3d.tmp".into(),
        // Store hextegn (macOS skelner ikke store og små i filnavne, så et andet tal end ovenfor).
        format!(".{hex}.0A1B2C3E.tmp"),
        format!(".{hex}.0a1b2c3.tmp"),
        "noter.tmp".into(),
        format!(".{hex}.lock"),
    ];
    for n in slettes.iter().chain(&bliver) {
        lav(n, gammel);
    }
    let frisk = format!(".{hex}.12345678.tmp");
    lav(&frisk, SystemTime::now() - Duration::from_secs(30 * 60));
    assert_eq!(ryd_midlertidige(&m.0, SystemTime::now()), 3);
    for n in &slettes {
        assert!(!m.0.join(n).exists(), "{n} skulle være slettet");
    }
    for n in bliver.iter().chain([&frisk]) {
        assert!(m.0.join(n).exists(), "{n} skulle blive");
    }
    // Programmet rydder op ved start i både <app-data> og <app-data>/sager.
    std::fs::create_dir_all(m.0.join("sager")).unwrap();
    let f = std::fs::File::create(m.0.join("sager").join(format!(".{hex}.00000000.tmp"))).unwrap();
    f.set_modified(gammel).unwrap();
    drop(f);
    let _t = Tilstand::paa_disk(m.0.clone(), Arc::new(HukommelsesLager::ny()));
    assert!(!m.0.join("sager").join(format!(".{hex}.00000000.tmp")).exists());
    assert!(m.0.join(&frisk).exists());
}

#[test]
fn klarteksten_skrives_til_en_buffer_med_anslaaet_kapacitet() {
    // En sag med en rigtig maskering: anslaget er stort nok, så bufferen aldrig vokser.
    let tekst =
        "devname=\"FW-KONTOR01\" srcip=10.20.30.11 user=\"bruger060\"\r\nServer=srv-068;Database=Kunde_DB;Password=Sommer2026!;\r\n";
    let mut sag = grimnir_core::Sag::default();
    let fund = grimnir_core::analyser(tekst, &grimnir_core::Ordbog::ny());
    grimnir_core::foreslaa(&fund, tekst, &mut sag);
    let hoved = Hoved {
        navn: "Supportsag \"Uglebo\"\t0042".into(),
        oprettet: 1,
        sidst_brugt: 2,
        udloeb: Some("2027-01-31".into()),
        poster: sag.antal_poster(),
        skrivetaeller: 9,
    };
    let anslaaet = anslaa_krop(&hoved, sag.data());
    #[derive(serde::Serialize)]
    struct K<'a> {
        h: &'a Hoved,
        v: Vec<(String, String)>,
    }
    let v: Vec<(String, String)> = sag
        .data()
        .poster
        .iter()
        .map(|p| (p.original.som_tekst().to_string(), p.kode.clone()))
        .collect();
    let b = json_klar(&K { h: &hoved, v }, anslaaet).unwrap();
    assert_eq!(b.vaekst(), 0, "anslaget {anslaaet} var for lille til {} bytes", b.bytes().len());
    // For lille anslag: bufferen vokser (og den gamle nulstilles), og indholdet er stadig rigtigt.
    let lille = json_klar(&vec!["Uglebo"; 200], 8).unwrap();
    assert!(lille.vaekst() >= 3);
    assert_eq!(lille.bytes(), serde_json::to_vec(&vec!["Uglebo"; 200]).unwrap().as_slice());
    // Ordbogens anslag dækker en ordbog med noter og escapes.
    let poster: Vec<OrdbogPost> = (0..50)
        .map(|i| OrdbogPost {
            id: i,
            type_: PostType::Person,
            vaerdi: format!("Anders \"Eksempelsen\" {i}"),
            note: Some("kunde\\afd".into()),
            oprettet: u64::MAX,
        })
        .collect();
    let b = json_klar(&poster, ordbog::anslaa_krop(&poster)).unwrap();
    assert_eq!(b.vaekst(), 0);
}

#[test]
fn fejlbeskeder_indeholder_ingen_vaerdier() {
    let t = Tilstand::ny();
    tilfoej(&t, "ord", "Uglebo", None);
    let fejl = [
        ordbog_tilfoej(&t, "ord", "Uglebo", Some("kunde Uglebo")).err().unwrap(),
        ordbog_tilfoej(&t, "aldrig", "uglebo", None).err().unwrap(),
        ordbog_tilfoej(&t, "domaene", "kontor", Some("hemmeligt\n")).err().unwrap(),
        UiFejl::OrdbogLaast { fejl: SagFejl::Beskadiget },
    ];
    for f in fejl {
        let s = format!("{f:?} {}", serde_json::to_string(&f).unwrap()).to_lowercase();
        for v in ["uglebo", "kontor", "hemmeligt"] {
            assert!(!s.contains(v), "{s}");
        }
    }
}

// ------------------------------------------------------------------------------------------------------- O6

#[test]
fn indstillinger_gemmes_og_gaelder_en_ny_sag() {
    let (m, lager) = ny();
    let t = program(&m, &lager);
    assert_eq!(indstillinger_hent(&t), Indstillinger::default());
    let s = sag_status(&t);
    assert_eq!(
        (s.valg.masker_fremmede, s.valg.bevar_sidste_oktet),
        (false, true),
        "standard: D4 fra, D5 til"
    );
    let ny_i = Indstillinger {
        masker_fremmede: true,
        bevar_sidste_oktet: false,
        udloeb_dage: Some(30),
        guide_vist: true,
    };
    assert_eq!(indstillinger_gem(&t, ny_i), Ok(ny_i));
    let s = sag_status(&t);
    assert_eq!(
        (s.valg.masker_fremmede, s.valg.bevar_sidste_oktet),
        (false, true),
        "den åbne sag ændres ikke"
    );
    let s = sag_luk(&t);
    assert_eq!(
        (s.valg.masker_fremmede, s.valg.bevar_sidste_oktet),
        (true, false),
        "en ny sag får indstillingerne"
    );
    let json = std::fs::read_to_string(m.0.join("indstillinger.json")).unwrap();
    assert!(
        json.contains("\"masker_fremmede\": true") && json.contains("\"udloeb_dage\": 30") && json.contains("\"guide_vist\": true"),
        "{json}"
    );
    // Efter en genstart.
    let t2 = program(&m, &lager);
    assert_eq!(indstillinger_hent(&t2), ny_i);
    assert!(sag_status(&t2).valg.masker_fremmede);
    // Ugyldigt udløb afvises; en beskadiget fil giver standardværdierne.
    let forkert = Indstillinger {
        udloeb_dage: Some(7),
        ..ny_i
    };
    assert_eq!(indstillinger_gem(&t2, forkert), Err(UiFejl::Indstillinger { fejl: None }));
    std::fs::write(m.0.join("indstillinger.json"), "{ikke json").unwrap();
    assert_eq!(indstillinger_hent(&program(&m, &lager)), Indstillinger::default());
    // Ældre fil uden alle felter: de manglende får standardværdien.
    std::fs::write(m.0.join("indstillinger.json"), "{\"guide_vist\": true}").unwrap();
    assert_eq!(
        indstillinger_hent(&program(&m, &lager)),
        Indstillinger {
            guide_vist: true,
            ..Indstillinger::default()
        }
    );
}

#[test]
fn valget_kan_aendres_for_den_aabne_sag_og_gaelder_nye_vaerdier() {
    let (m, lager) = ny();
    let t = program(&m, &lager);
    let tekst = "fra 10.20.30.11 til 10.20.30.12\n";
    let a = analyser(&t, tekst, None, &[]).unwrap();
    let foer = gem_og_masker(&t, tekst, &fravalgt(&a), &[]).unwrap().maskeret;
    assert!(foer.contains(".11 ") && foer.ends_with(".12\n"), "D5: sidste oktet bevaret: {foer}");
    sag_ny(&t, "Prøvesag", None).unwrap();
    let s = sag_valg(&t, true, false).unwrap();
    assert_eq!((s.valg.masker_fremmede, s.valg.bevar_sidste_oktet), (true, false));
    // Gemt i sagens fil: et nyt program åbner sagen med det nye valg.
    let t2 = program(&m, &lager);
    let id = s.id.unwrap();
    let s2 = grimnir_lib::maskering::sag_aabn(&t2, &id).unwrap();
    assert_eq!((s2.valg.masker_fremmede, s2.valg.bevar_sidste_oktet), (true, false));
    // Kendte værdier beholder deres koder; en ny adresse i samme net får ikke sit sidste oktet bevaret, og ingen kode
    // bruges to gange.
    let tekst2 = "fra 10.20.30.11 til 10.20.30.13\n";
    let a2 = analyser(&t2, tekst2, None, &[]).unwrap();
    let efter = gem_og_masker(&t2, tekst2, &fravalgt(&a2), &[]).unwrap().maskeret;
    let kode11 = foer.split_whitespace().nth(1).unwrap();
    assert_eq!(efter.split_whitespace().nth(1).unwrap(), kode11);
    let kode13 = efter.split_whitespace().nth(3).unwrap();
    assert!(
        !kode13.ends_with(".13") && kode13 != kode11 && kode13 != foer.split_whitespace().nth(3).unwrap(),
        "{efter}"
    );
    let (tilbage, _) = grimnir_lib::maskering::demasker(&t2, &efter)
        .map(|d| (d.tekst, d.advarsler))
        .unwrap();
    assert_eq!(tilbage, tekst2);
}

#[test]
fn tilstand_paa_disk_uden_filer_skriver_intet_ved_start() {
    let (m, lager) = ny();
    let t = program(&m, &lager);
    assert!(ordbog_hent(&t).poster.is_empty());
    let _ = analyser(&t, "srv-068\n", None, &[]).unwrap();
    assert_eq!(std::fs::read_dir(&m.0).unwrap().count(), 0, "ingen filer før brugeren gemmer noget");
    assert_eq!(lager.antal(), 0, "ingen nøgle før ordbogen gemmes");
}
