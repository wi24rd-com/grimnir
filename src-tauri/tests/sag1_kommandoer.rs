//! V-SAG.1 G3: kommandoerne for sager uden vindue og uden rigtig Keychain (midlertidig mappe fra `std::env::temp_dir()`
//! med tilfældigt navn, ryddet efter testen; nøglelager i hukommelsen). Kun opdigtede værdier.

use std::path::PathBuf;
use std::sync::Arc;

use grimnir_lib::maskering::{
    analyser, demasker, gem_og_masker, sag_aabn, sag_liste, sag_luk, sag_ny, sag_omdoeb, sag_slet, sag_status, sag_udloeb, Analyse,
    Tilstand, UiFejl, MAKS_BYTES, MAKS_DEMASKER,
};
use grimnir_lib::sager::{sti, Arkiv, HukommelsesLager, SagFejl, SagsId};

const TEKST: &str = "date=2026-11-10 devname=\"FW-KONTOR01\" srcip=10.20.30.11 user=\"bruger060\"\r\n\
Server=srv-068;Database=Kunde_DB;User Id=app;Password=Sommer2026!;\r\n\
user=\"BRUGER060\" fra 10.20.30.11\r\n";
const TEKST2: &str = "login failed for bruger061 from 10.20.31.5\r\n";

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
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let _ = std::fs::set_permissions(&self.0, std::fs::Permissions::from_mode(0o700));
        }
        let _ = std::fs::remove_dir_all(&self.0);
    }
}

/// Et "program": tilstand med arkiv på mappen og et fælles nøglelager (som Keychain, der overlever programmet).
fn program(m: &Mappe, lager: &Arc<HukommelsesLager>) -> Tilstand {
    Tilstand::med_arkiv(Arkiv::ny(m.0.clone(), Box::new(lager.clone())))
}

fn fravalgt(a: &Analyse) -> Vec<usize> {
    a.raekker.iter().filter(|r| !r.valgt).map(|r| r.id).collect()
}

fn masker(t: &Tilstand, tekst: &str) -> Result<String, UiFejl> {
    let a = analyser(t, tekst, None, &[])?;
    gem_og_masker(t, tekst, &fravalgt(&a), &[]).map(|m| m.maskeret)
}

fn eneste_id(m: &Mappe) -> SagsId {
    let ider = grimnir_lib::sager::ider(&m.0).unwrap();
    assert_eq!(ider.len(), 1);
    ider[0]
}

#[test]
fn programmet_starter_med_en_midlertidig_sag() {
    let m = Mappe::ny();
    let lager = Arc::new(HukommelsesLager::ny());
    let t = program(&m, &lager);
    let s = sag_status(&t);
    assert_eq!((s.poster, s.id, s.navn), (0, None, None));
    assert!(sag_liste(&t).unwrap().is_empty());
    assert!(!t.skal_spoerge_ved_luk(), "en tom midlertidig sag spørger ikke");
}

#[test]
fn gem_luk_programmet_aabn_igen_og_demasker_bytepraecist() {
    let m = Mappe::ny();
    let lager = Arc::new(HukommelsesLager::ny());
    // I dag: maskér i den midlertidige sag, gem den som sag, maskér en tekst mere (gemmes automatisk).
    let maskeret1;
    let maskeret2;
    {
        let t = program(&m, &lager);
        maskeret1 = masker(&t, TEKST).unwrap();
        assert!(t.skal_spoerge_ved_luk(), "midlertidig sag med poster");
        let poster = sag_status(&t).poster;
        let s = sag_ny(&t, "Supportsag 0042", Some("2027-01-31")).unwrap();
        assert_eq!(
            (s.poster, s.navn.as_deref(), s.udloeb.as_deref()),
            (poster, Some("Supportsag 0042"), Some("2027-01-31"))
        );
        assert!(!t.skal_spoerge_ved_luk(), "en navngiven sag spørger ikke");
        maskeret2 = masker(&t, TEKST2).unwrap();
        assert!(sag_status(&t).poster > poster);
    }
    // I morgen: et nyt program, samme mappe og nøglering.
    let t = program(&m, &lager);
    assert_eq!(sag_status(&t).poster, 0);
    let liste = sag_liste(&t).unwrap();
    assert_eq!(liste.len(), 1);
    assert_eq!(liste[0].navn.as_deref(), Some("Supportsag 0042"));
    assert!(liste[0].fejl.is_none() && !liste[0].aaben);
    let s = sag_aabn(&t, &liste[0].id).unwrap();
    assert_eq!(s.id.as_deref(), Some(liste[0].id.as_str()));
    assert!(sag_liste(&t).unwrap()[0].aaben);
    for (m, original) in [(&maskeret1, TEKST), (&maskeret2, TEKST2)] {
        let d = demasker(&t, m).unwrap();
        assert_eq!(d.tekst.as_bytes(), original.as_bytes(), "bytepræcis");
        assert!(d.advarsler.iter().all(|a| a.art == "ikke_brugt"), "{:?}", d.advarsler);
    }
}

#[test]
fn rettelse_i_navngiven_sag_gemmes_og_gamle_koder_virker() {
    let m = Mappe::ny();
    let lager = Arc::new(HukommelsesLager::ny());
    let t = program(&m, &lager);
    sag_ny(&t, "Rettelser", None).unwrap();
    let foer = masker(&t, TEKST).unwrap();
    // Ret brugeren (to stavemåder) til kunde7: hele enheden omdøbes samlet (ret_enhed), feltet kan rettes.
    let a = analyser(&t, TEKST, None, &[]).unwrap();
    let r = a
        .raekker
        .iter()
        .find(|r| r.vaerdier.len() == 2)
        .expect("brugeren med to stavemåder");
    let ret = [grimnir_lib::maskering::Rettelse {
        id: r.id,
        kode: "kunde7".into(),
    }];
    let a2 = analyser(&t, TEKST, Some(&fravalgt(&a)), &ret).unwrap();
    assert!(a2.fejl.is_empty(), "{:?}", a2.fejl);
    let r2 = a2.raekker.iter().find(|x| x.id == r.id).unwrap();
    assert_eq!(r2.koder, ["kunde7", "KUNDE7"]);
    let efter = gem_og_masker(&t, TEKST, &fravalgt(&a2), &ret).unwrap().maskeret;
    assert!(efter.contains("\"kunde7\"") && efter.contains("\"KUNDE7\""), "{efter}");
    // Et nyt program: både teksten med de gamle koder og den nye demaskeres.
    let t2 = program(&m, &lager);
    sag_aabn(&t2, &eneste_id(&m).hex()).unwrap();
    for tekst in [&foer, &efter] {
        let d = demasker(&t2, tekst).unwrap();
        assert_eq!(d.tekst, TEKST);
        assert!(!d.advarsler.iter().any(|a| a.art == "ukendt_kode"), "{:?}", d.advarsler);
    }
}

#[test]
fn fejler_skrivningen_udleveres_ingen_maskeret_tekst() {
    let m = Mappe::ny();
    let lager = Arc::new(HukommelsesLager::ny());
    let t = program(&m, &lager);
    sag_ny(&t, "Skrivebeskyttet", None).unwrap();
    let id = eneste_id(&m);
    let foer = std::fs::read(sti(&m.0, &id)).unwrap();
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&m.0, std::fs::Permissions::from_mode(0o500)).unwrap();
    }
    #[cfg(not(unix))]
    std::fs::remove_dir_all(&m.0).unwrap();
    let a = analyser(&t, TEKST, None, &[]).unwrap();
    let r = gem_og_masker(&t, TEKST, &fravalgt(&a), &[]);
    assert!(
        matches!(
            r,
            Err(UiFejl::Sag {
                fejl: SagFejl::Disk { .. }
            })
        ),
        "{r:?}"
    );
    assert_eq!(sag_status(&t).poster, 0, "sagen i hukommelsen er uændret");
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&m.0, std::fs::Permissions::from_mode(0o700)).unwrap();
        assert_eq!(std::fs::read(sti(&m.0, &id)).unwrap(), foer, "filen er uændret");
        // Når disken virker igen, lykkes det.
        assert!(masker(&t, TEKST).is_ok());
    }
}

#[test]
fn to_vinduer_konflikt_og_aabn_igen() {
    let m = Mappe::ny();
    let lager = Arc::new(HukommelsesLager::ny());
    let v1 = program(&m, &lager);
    sag_ny(&v1, "Delt", None).unwrap();
    let id = eneste_id(&m).hex();
    let v2 = program(&m, &lager);
    sag_aabn(&v2, &id).unwrap();
    let m1 = masker(&v1, TEKST).unwrap();
    let fil = std::fs::read(sti(&m.0, &eneste_id(&m))).unwrap();
    // Vindue 2 har en forældet udgave: skrivningen afvises, intet overskrives, og der er ingen maskeret tekst.
    let r = masker(&v2, TEKST2);
    assert!(matches!(r, Err(UiFejl::Sag { fejl: SagFejl::Konflikt })), "{r:?}");
    assert_eq!(std::fs::read(sti(&m.0, &eneste_id(&m))).unwrap(), fil);
    assert!(matches!(
        sag_omdoeb(&v2, &id, "Andet navn"),
        Err(UiFejl::Sag { fejl: SagFejl::Konflikt })
    ));
    // "Åbn den igen": vindue 2 læser sagen igen og kan så både demaskere vindue 1's tekst og gemme.
    sag_aabn(&v2, &id).unwrap();
    assert_eq!(demasker(&v2, &m1).unwrap().tekst, TEKST);
    assert!(masker(&v2, TEKST2).is_ok());
    // Nu er vindue 1 forældet.
    assert!(matches!(masker(&v1, TEKST2), Err(UiFejl::Sag { fejl: SagFejl::Konflikt })));
}

#[test]
fn omdoeb_udloeb_og_liste_med_sag_der_ikke_kan_aabnes() {
    let m = Mappe::ny();
    let lager = Arc::new(HukommelsesLager::ny());
    let t = program(&m, &lager);
    sag_ny(&t, "Første", None).unwrap();
    masker(&t, TEKST).unwrap();
    let a = sag_status(&t).id.unwrap();
    sag_ny(&t, "Anden", Some("2026-12-24")).unwrap();
    let b = sag_status(&t).id.unwrap();
    assert_ne!(a, b);
    assert_eq!(sag_status(&t).poster, 0, "en ny sag fra en navngiven starter tom");
    // Omdøb og udløb: den åbne (b) og en, der ikke er åben (a).
    sag_omdoeb(&t, &b, "  Anden sag  ").unwrap();
    sag_omdoeb(&t, &a, "Første sag").unwrap();
    sag_udloeb(&t, &a, Some("2027-03-01")).unwrap();
    sag_udloeb(&t, &b, None).unwrap();
    assert!(matches!(
        sag_udloeb(&t, &a, Some("2027-02-30")),
        Err(UiFejl::Sag {
            fejl: SagFejl::UgyldigDato
        })
    ));
    assert!(matches!(
        sag_omdoeb(&t, &a, " "),
        Err(UiFejl::Sag {
            fejl: SagFejl::UgyldigtNavn
        })
    ));
    assert!(matches!(sag_aabn(&t, "../../etc"), Err(UiFejl::Sag { fejl: SagFejl::UgyldigtId })));
    assert_eq!(sag_status(&t).navn.as_deref(), Some("Anden sag"));
    let liste = sag_liste(&t).unwrap();
    let post = |id: &str| liste.iter().find(|p| p.id == id).unwrap().clone();
    assert_eq!(
        (post(&a).navn.as_deref(), post(&a).udloeb.as_deref()),
        (Some("Første sag"), Some("2027-03-01"))
    );
    assert_eq!((post(&b).navn.as_deref(), post(&b).udloeb), (Some("Anden sag"), None));
    assert!(post(&a).poster > 0 && post(&b).aaben && !post(&a).aaben);
    // En beskadiget sag og en uden nøgle står i listen med årsag og slettes ikke.
    let ida = SagsId::fra_hex(&a).unwrap();
    let mut bytes = std::fs::read(sti(&m.0, &ida)).unwrap();
    bytes[50] ^= 1;
    std::fs::write(sti(&m.0, &ida), &bytes).unwrap();
    let liste = sag_liste(&t).unwrap();
    let pa = liste.iter().find(|p| p.id == a).unwrap();
    assert_eq!((pa.navn.clone(), pa.fejl.clone()), (None, Some(SagFejl::Beskadiget)));
    assert!(matches!(sag_aabn(&t, &a), Err(UiFejl::Sag { fejl: SagFejl::Beskadiget })));
    use grimnir_lib::sager::Noeglelager;
    lager.slet(&SagsId::fra_hex(&b).unwrap()).unwrap();
    let liste = sag_liste(&t).unwrap();
    assert_eq!(liste.iter().find(|p| p.id == b).unwrap().fejl, Some(SagFejl::ManglerNoegle));
    assert_eq!(liste.len(), 2);
}

#[test]
fn slet_og_luk() {
    let m = Mappe::ny();
    let lager = Arc::new(HukommelsesLager::ny());
    let t = program(&m, &lager);
    masker(&t, TEKST).unwrap();
    sag_ny(&t, "Slettes", None).unwrap();
    let id = sag_status(&t).id.unwrap();
    // Luk: filen bliver, sagen i hukommelsen er tom og midlertidig.
    let s = sag_luk(&t);
    assert_eq!((s.poster, s.id), (0, None));
    assert_eq!(sag_liste(&t).unwrap().len(), 1);
    // Åbn og slet: fil og nøgle er væk, og den åbne sag er lukket.
    sag_aabn(&t, &id).unwrap();
    let s = sag_slet(&t, &id).unwrap();
    assert_eq!((s.poster, s.id), (0, None));
    assert!(sag_liste(&t).unwrap().is_empty());
    assert_eq!(lager.antal(), 0);
    assert!(std::fs::read_dir(&m.0).unwrap().next().is_none(), "mappen er tom");
    assert!(matches!(sag_aabn(&t, &id), Err(UiFejl::Sag { fejl: SagFejl::ManglerFil })));
}

#[test]
fn graenser_5_mib_i_masker_og_8_mib_i_demasker() {
    assert_eq!((MAKS_BYTES, MAKS_DEMASKER), (5_242_880, 8_388_608));
    let t = Tilstand::ny();
    let seks = "a".repeat(6 * 1024 * 1024);
    assert!(matches!(
        analyser(&t, &seks, None, &[]),
        Err(UiFejl::ForStor { maks: MAKS_BYTES, .. })
    ));
    assert_eq!(demasker(&t, &seks).unwrap().tekst.len(), seks.len(), "Demaskér tager over 5 MiB");
    let over = "a".repeat(MAKS_DEMASKER + 1);
    assert!(matches!(demasker(&t, &over), Err(UiFejl::ForStor { maks: MAKS_DEMASKER, .. })));
}

#[test]
fn uden_arkiv_svarer_sagskommandoerne_ingen_arkiv() {
    let t = Tilstand::ny();
    assert!(matches!(sag_ny(&t, "x", None), Err(UiFejl::IngenArkiv)));
    assert!(matches!(sag_liste(&t), Err(UiFejl::IngenArkiv)));
}

#[test]
fn afslut_spoerger_kun_ved_midlertidig_sag_med_poster() {
    let m = Mappe::ny();
    let lager = Arc::new(HukommelsesLager::ny());
    let t = program(&m, &lager);
    assert!(!t.skal_spoerge_ved_luk());
    masker(&t, TEKST).unwrap();
    assert!(t.skal_spoerge_ved_luk());
    t.tillad_afslut();
    assert!(!t.skal_spoerge_ved_luk(), "brugeren har svaret");
}

#[test]
fn sagsfejl_til_ui_naevner_ingen_originaler() {
    let m = Mappe::ny();
    let lager = Arc::new(HukommelsesLager::ny());
    let v1 = program(&m, &lager);
    sag_ny(&v1, "Supportsag Uglebo", None).unwrap();
    let v2 = program(&m, &lager);
    sag_aabn(&v2, &eneste_id(&m).hex()).unwrap();
    masker(&v1, TEKST).unwrap();
    let f = masker(&v2, TEKST).unwrap_err();
    let json = serde_json::to_string(&f).unwrap();
    assert_eq!(json, r#"{"art":"sag","fejl":{"art":"konflikt"}}"#);
    for o in ["FW-KONTOR01", "10.20.30.11", "bruger060", "Sommer2026!", "Kunde_DB", "Uglebo"] {
        assert!(!json.contains(o) && !format!("{f:?}").contains(o));
    }
}
