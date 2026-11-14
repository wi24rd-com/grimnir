//! V-OPBYG.5 (skallen uden vindue).
//!
//! - N1: Ryd i Maskér beder Rust glemme den indsatte teksts hemmeligheder med det samme (`tekst_glem`); låst svarer den
//!   `laast`, og intet er tilbage.
//! - N2: en post i den åbne sag slettes (`sag_post_slet`; en navngiven sag gemmes straks med formatversion 3, og en gemning,
//!   der fejler, ændrer intet); koden demaskeres ikke længere og meldes som ukendt. Kopiér værdi: en hemmelighed lægger
//!   Rust selv i udklipsholderen (`sag_post_kopier`, svaret er kun sandt/falsk), en almindelig værdi kopierer webvisningen
//!   og melder (`udklip_vaerdi_kopieret`); begge ryddes ved lås, hvis de stadig står der (D21).
//!
//! Tests rører aldrig Nøglering (`HukommelsesLager`, `HukommelsesDoer`) og aldrig den rigtige udklipsholder (en efterlignet
//! i hukommelsen). Kun opdigtede værdier (RFC 1918, opfundne navne og hemmeligheder).

use std::path::PathBuf;
use std::sync::Arc;

use grimnir_lib::laas::{HukommelsesDoer, Svar, Udloeser};
use grimnir_lib::maskering::{
    analyser, demasker, fil_aabn, fil_gem_og_masker, fil_gem_til, gem_og_masker, laas_igen, laas_op, levende, raekke_vaerdi,
    sag_aabn, sag_indhold, sag_ny, sag_post_kopier, sag_post_slet, sag_status, tekst_glem, udklip_vaerdi_kopieret,
    IndholdValg, Raekke, SagPost, Tilstand, UiFejl, Visning,
};
use grimnir_lib::sager::{sti, HukommelsesLager, SagFejl, SagsId, FORMATVERSION, FORMATVERSION_SLETTEDE};
use grimnir_lib::udklip::HukommelsesUdklip;

struct Mappe(PathBuf);
impl Mappe {
    fn ny() -> Self {
        let p = std::env::temp_dir().join(format!("grimnir-opbyg5-{}", SagsId::ny().unwrap().hex()));
        std::fs::create_dir_all(&p).unwrap();
        Mappe(p)
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

fn kilde(fil: &str) -> String {
    std::fs::read_to_string(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join(fil)).unwrap()
}

/// To hemmeligheder (en adgangskode og et token med høj entropi) og almindelige fund.
const TEKST: &str = "srcip=10.20.30.11 user=\"bruger060\"\r\nServer=srv-068;Password=Sommer2026!;\r\ntoken=Zq8Xv2Lm9Pw4Rt7Yk3Nb6Hc1Jd5Fg0Qs\r\n";

fn hemmelige(r: &[Raekke]) -> Vec<&Raekke> {
    r.iter().filter(|r| r.hemmelig).collect()
}

// ─────────────────────────────────────────────────────────────── N1: Ryd

#[test]
fn n1_ryd_glemmer_den_indsatte_teksts_hemmeligheder_med_det_samme() {
    let t = Tilstand::ny();
    let a = analyser(&t, TEKST, None, &[]).unwrap();
    let id = hemmelige(&a.raekker)[0].id;
    assert_eq!(levende(&t).hemmelige, 2);
    assert!(raekke_vaerdi(&t, false, id).is_ok());
    tekst_glem(&t).unwrap();
    assert_eq!(levende(&t).hemmelige, 0, "Ryd glemmer hemmelighederne");
    assert_eq!(raekke_vaerdi(&t, false, id).err(), Some(UiFejl::UkendtRaekke));
    // Igen (intet at glemme) gør ingen skade; en ny analyse holder dem igen.
    tekst_glem(&t).unwrap();
    analyser(&t, TEKST, None, &[]).unwrap();
    assert_eq!(levende(&t).hemmelige, 2);
}

#[test]
fn n1_ryd_laast_svarer_laast_og_intet_er_tilbage() {
    let m = Mappe::ny();
    let t = program(&m);
    analyser(&t, TEKST, None, &[]).unwrap();
    assert!(laas_igen(&t, Udloeser::Dvale));
    assert_eq!(tekst_glem(&t).err(), Some(UiFejl::Laast));
    assert_eq!(levende(&t).hemmelige, 0);
    assert_eq!(laas_op(&t, &HukommelsesDoer::ny(Svar::Ok), "da").svar, Svar::Ok);
    tekst_glem(&t).unwrap();
    assert_eq!(levende(&t).hemmelige, 0);
}

/// Kilden: porten først, intet til log eller konsol, kommandoen registreret og tilladt.
#[test]
fn n1_tekst_glem_er_registreret_og_tilladt() {
    let k = kilde("src/maskering.rs");
    let s = k.find("pub fn tekst_glem").unwrap();
    let krop = &k[s..s + k[s..].find("\n}\n").unwrap()];
    assert!(krop.contains("t.aaben()?"), "{krop}");
    for ord in ["println", "eprintln", "dbg!", "log::"] {
        assert!(!krop.contains(ord), "{ord} i tekst_glem");
    }
    assert!(kilde("src/lib.rs").contains("        tekst_glem,\n"));
    assert!(kilde("build.rs").contains("\"tekst_glem\""));
    assert!(kilde("capabilities/default.json").contains("\"allow-tekst-glem\""));
}

// ─────────────────────────────────────────────────────────────── N2: slet en post, Kopiér værdi

/// Maskerer TEKST med kernens standard; svarer med den maskerede tekst.
fn masker(t: &Tilstand) -> String {
    let a = analyser(t, TEKST, None, &[]).unwrap();
    let fra: Vec<usize> = a.raekker.iter().filter(|r| !r.valgt).map(|r| r.id).collect();
    gem_og_masker(t, TEKST, &fra, &[]).unwrap().maskeret
}

/// Den åbne sags poster (alle, hemmeligheder vist).
fn poster(t: &Tilstand) -> Vec<SagPost> {
    let alle = sag_indhold(t, None, &IndholdValg { antal: 1000, ..IndholdValg::default() }).unwrap();
    let vist: Vec<usize> = alle.raekker.iter().map(|p| p.nr).collect();
    sag_indhold(t, None, &IndholdValg { antal: 1000, vist, ..IndholdValg::default() }).unwrap().raekker
}

fn post(t: &Tilstand, vaerdi: &str) -> SagPost {
    poster(t).into_iter().find(|p| p.vaerdi.as_deref() == Some(vaerdi)).unwrap_or_else(|| panic!("{vaerdi} findes ikke"))
}

fn version(m: &Mappe, id: &str) -> u16 {
    let b = std::fs::read(sti(&m.0.join("sager"), &SagsId::fra_hex(id).unwrap())).unwrap();
    u16::from_le_bytes([b[8], b[9]])
}

fn ukendte(d: &grimnir_lib::maskering::Demaskering) -> Vec<String> {
    d.advarsler.iter().filter(|a| a.art == "ukendt_kode").map(|a| a.kode.clone()).collect()
}

#[test]
fn n2_en_post_slettes_i_den_midlertidige_sag_og_koden_meldes_som_ukendt() {
    let t = Tilstand::ny();
    let maskeret = masker(&t);
    let p = post(&t, "srv-068");
    let foer = sag_status(&t).unwrap().poster;
    let st = sag_post_slet(&t, p.nr, &p.kode).unwrap();
    assert_eq!(st.poster, foer - 1);
    assert!(poster(&t).iter().all(|x| x.kode != p.kode && x.vaerdi.as_deref() != Some("srv-068")));
    let d = demasker(&t, &maskeret).unwrap();
    assert_eq!(ukendte(&d), std::slice::from_ref(&p.kode));
    assert!(d.tekst.contains(&p.kode) && !d.tekst.contains("srv-068"), "koden står urørt");
    // Samme tekst igen: værdien får en ny kode, aldrig den slettede.
    masker(&t);
    let ny = post(&t, "srv-068");
    assert_ne!(ny.kode.to_ascii_lowercase(), p.kode.to_ascii_lowercase());
}

#[test]
fn n2_en_foraeldet_plads_eller_kode_afvises_og_intet_aendres() {
    let t = Tilstand::ny();
    masker(&t);
    let p = post(&t, "srv-068");
    let foer = sag_status(&t).unwrap().poster;
    assert_eq!(sag_post_slet(&t, p.nr, "h9999").err(), Some(UiFejl::UkendtPost));
    assert_eq!(sag_post_slet(&t, p.nr + 1000, &p.kode).err(), Some(UiFejl::UkendtPost));
    let anden = poster(&t).into_iter().find(|x| x.nr != p.nr).unwrap();
    assert_eq!(sag_post_slet(&t, anden.nr, &p.kode).err(), Some(UiFejl::UkendtPost), "pladsen og koden skal passe sammen");
    assert_eq!(sag_status(&t).unwrap().poster, foer);
}

#[test]
fn n2_en_navngiven_sag_gemmes_straks_med_formatversion_3_og_en_fejlet_gemning_aendrer_intet() {
    let m = Mappe::ny();
    let lager = Arc::new(HukommelsesLager::ny());
    let t = Tilstand::paa_disk(m.0.clone(), lager.clone());
    let maskeret = masker(&t);
    let id = sag_ny(&t, "Ravnsholt-sagen", None).unwrap().id.unwrap();
    assert_eq!(version(&m, &id), FORMATVERSION);
    let p = post(&t, "srv-068");
    sag_post_slet(&t, p.nr, &p.kode).unwrap();
    assert_eq!(version(&m, &id), FORMATVERSION_SLETTEDE, "med slettede koder: formatversion 3");
    // Gemt straks: et andet program på samme mappe åbner sagen uden posten, og koden meldes som ukendt dér.
    let t2 = Tilstand::paa_disk(m.0.clone(), lager.clone());
    sag_aabn(&t2, &id).unwrap();
    assert!(poster(&t2).iter().all(|x| x.kode != p.kode));
    assert_eq!(ukendte(&demasker(&t2, &maskeret).unwrap()), std::slice::from_ref(&p.kode));
    // Konflikt: det andet program sletter først; så afvises sletningen her, og posten er der stadig.
    let q = post(&t, "10.20.30.11");
    let q2 = post(&t2, "10.20.30.11");
    sag_post_slet(&t2, q2.nr, &q2.kode).unwrap();
    let foer = poster(&t).len();
    let r = post(&t, "bruger060");
    assert_eq!(sag_post_slet(&t, r.nr, &r.kode).err(), Some(UiFejl::Sag { fejl: SagFejl::Konflikt }));
    assert_eq!(poster(&t).len(), foer, "en gemning, der fejler, ændrer intet i hukommelsen");
    assert!(poster(&t).iter().any(|x| x.kode == r.kode) && poster(&t).iter().any(|x| x.kode == q.kode));
}

#[test]
fn n2_en_maskeret_fil_er_foraeldet_efter_en_sletning() {
    let m = Mappe::ny();
    let t = program(&m);
    let fil = m.0.join("app.log");
    std::fs::write(&fil, TEKST).unwrap();
    fil_aabn(&t, Visning::Masker, &fil).unwrap();
    fil_gem_og_masker(&t, &[], &[]).unwrap();
    let p = post(&t, "srv-068");
    sag_post_slet(&t, p.nr, &p.kode).unwrap();
    assert_eq!(fil_gem_til(&t, Visning::Masker, &m.0.join("ud.log"), true).err(), Some(UiFejl::Foraeldet));
}

#[test]
fn n2_laast_svarer_laast_og_intet_slettes_eller_kopieres() {
    let m = Mappe::ny();
    let t = program(&m);
    masker(&t);
    let p = post(&t, "srv-068");
    let h = post(&t, "Sommer2026!");
    assert!(laas_igen(&t, Udloeser::Dvale));
    assert_eq!(sag_post_slet(&t, p.nr, &p.kode).err(), Some(UiFejl::Laast));
    assert_eq!(sag_post_kopier(&t, h.nr, &h.kode).err(), Some(UiFejl::Laast));
    assert_eq!(udklip_vaerdi_kopieret(&t, p.nr, &p.kode).err(), Some(UiFejl::Laast));
}

/// Programmet i hukommelsen med en efterlignet udklipsholder (aldrig den rigtige).
fn med_udklip(laesbar: bool) -> (Mappe, Tilstand, Arc<HukommelsesUdklip>) {
    let u = Arc::new(HukommelsesUdklip::ny(laesbar));
    let m = Mappe::ny();
    let t = Tilstand::paa_disk(m.0.clone(), Arc::new(HukommelsesLager::ny())).med_udklip(Some(Box::new(u.clone())));
    (m, t, u)
}

#[test]
fn n2_kopier_vaerdi_for_en_hemmelighed_skriver_rust_og_laasen_rydder_den() {
    let (_m, t, u) = med_udklip(false);
    masker(&t);
    let h = poster(&t).into_iter().find(|p| p.hemmelig && p.vaerdi.as_deref() == Some("Sommer2026!")).unwrap();
    let svar = sag_post_kopier(&t, h.nr, &h.kode).unwrap();
    assert!(svar, "værdien ligger i udklipsholderen");
    assert_eq!(serde_json::to_string(&svar).unwrap(), "true", "svaret har ingen værdi");
    assert_eq!((u.nu().as_deref(), u.skrivninger(), u.laesninger()), (Some("Sommer2026!"), 1, 0), "skrevet af Rust; intet læst");
    assert!(laas_igen(&t, Udloeser::Dvale));
    assert_eq!(u.nu(), None, "låsen rydder den, når den stadig står der");
    // En anden skriver bagefter: låsen rører den ikke.
    assert_eq!(laas_op(&t, &HukommelsesDoer::ny(Svar::Ok), "da").svar, Svar::Ok);
    masker(&t);
    let h = poster(&t).into_iter().find(|p| p.hemmelig && p.vaerdi.as_deref() == Some("Sommer2026!")).unwrap();
    assert!(sag_post_kopier(&t, h.nr, &h.kode).unwrap());
    u.skriv("et andet programs tekst");
    assert!(laas_igen(&t, Udloeser::Dvale));
    assert_eq!(u.nu().as_deref(), Some("et andet programs tekst"));
}

#[test]
fn n2_kopier_vaerdi_kun_for_en_hemmelighed_og_uden_udklipsholder_eller_ved_fejl_falsk() {
    let (_m, t, u) = med_udklip(false);
    masker(&t);
    let p = post(&t, "srv-068");
    assert_eq!(sag_post_kopier(&t, p.nr, &p.kode).err(), Some(UiFejl::UkendtPost), "en almindelig værdi kopierer webvisningen");
    let h = poster(&t).into_iter().find(|p| p.hemmelig).unwrap();
    u.afvis_skrivning();
    assert!(!sag_post_kopier(&t, h.nr, &h.kode).unwrap(), "skrivningen mislykkedes");
    let foer = u.taeller_nu();
    assert!(laas_igen(&t, Udloeser::Dvale));
    assert_eq!(u.taeller_nu(), foer, "intet huskes, så låsen rydder intet");
    // Uden udklipsholder: falsk.
    let t2 = Tilstand::ny();
    masker(&t2);
    let h2 = poster(&t2).into_iter().find(|p| p.hemmelig).unwrap();
    assert!(!sag_post_kopier(&t2, h2.nr, &h2.kode).unwrap());
}

#[test]
fn n2_en_almindelig_vaerdi_kopieret_af_webvisningen_huskes_og_ryddes_ved_laas() {
    for laesbar in [true, false] {
        let (_m, t, u) = med_udklip(laesbar);
        masker(&t);
        let p = post(&t, "srv-068");
        u.skriv("srv-068");
        assert!(udklip_vaerdi_kopieret(&t, p.nr, &p.kode).unwrap(), "laesbar {laesbar}");
        assert!(laas_igen(&t, Udloeser::Dvale));
        assert_eq!(u.nu(), None, "laesbar {laesbar}");
    }
    // Står der noget andet (og må det læses), huskes intet.
    let (_m, t, u) = med_udklip(true);
    masker(&t);
    let p = post(&t, "srv-068");
    u.skriv("noget andet");
    assert!(!udklip_vaerdi_kopieret(&t, p.nr, &p.kode).unwrap());
    assert!(laas_igen(&t, Udloeser::Dvale));
    assert_eq!(u.nu().as_deref(), Some("noget andet"));
}

/// Kilden: porten først, intet til log eller konsol, kommandoerne registreret og tilladt; sletningen tæller sagens nummer
/// op og nulstiller den slettede post; ingen kommando giver værdien til webvisningen.
#[test]
fn n2_kommandoerne_er_registreret_tilladt_og_uden_log() {
    let k = kilde("src/maskering.rs");
    for navn in ["sag_post_slet", "sag_post_kopier", "udklip_vaerdi_kopieret"] {
        let s = k.find(&format!("pub fn {navn}(")).unwrap();
        let krop = &k[s..s + k[s..].find("\n}\n").unwrap()];
        assert!(krop.starts_with(&format!("pub fn {navn}(")) && krop.contains("    t.aaben()?;"), "{navn}");
        for ord in ["println", "eprintln", "dbg!", "log::"] {
            assert!(!krop.contains(ord), "{ord} i {navn}");
        }
        assert!(kilde("src/lib.rs").contains(&format!("        {navn},\n")), "{navn} i lib.rs");
        assert!(kilde("build.rs").contains(&format!("\"{navn}\"")), "{navn} i build.rs");
        assert!(kilde("capabilities/default.json").contains(&format!("\"allow-{}\"", navn.replace('_', "-"))), "{navn} i capabilities");
    }
    let s = k.find("pub fn sag_post_slet(").unwrap();
    let krop = &k[s..s + k[s..].find("\n}\n").unwrap()];
    assert!(krop.contains("aktuel.nr += 1") && krop.contains("nulstil_slettet(post, enhed)") && krop.contains("nulstil(foer)"));
    assert!(k.contains("pub fn sag_post_kopier(t: &Tilstand, nr: usize, kode: &str) -> Result<bool, UiFejl>"));
}
