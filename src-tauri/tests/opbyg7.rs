//! V-OPBYG.7 (skallen uden vindue).
//!
//! - N1: Rust skriver de fortrolige kopier selv, med fortroligt-mærket (`org.nspasteboard.ConcealedType`) og kilden:
//!   Kopiér værdi for en almindelig værdi (`sag_post_kopier`), Kopiér resultat i Demaskér for en fil og en indsat tekst
//!   (`resultat_kopier`) og Kopiér noterne (`noter_kopier`). Porten før og igen før skrivningen, `laast`, tælleren huskes,
//!   lås og afslutning rydder (D21). Kan Rust ikke skrive (ingen udklipsholder som på Windows, eller skrivningen
//!   mislykkes), er svaret `false`, intet ligger der, og intet huskes; webvisningen kopierer så som før (UI-testen).
//!   `skriv_tekst` (uden mærket) er fjernet.
//! - N3: `fil_raekker` med en række (`med`) giver den side, der har rækken, også efter de første 500, og rækkens plads i
//!   listen efter filter og søgning.
//!
//! Tests rører aldrig Nøglering (`HukommelsesLager`, `HukommelsesDoer`) og aldrig den rigtige udklipsholder
//! (`HukommelsesUdklip`). Kun opdigtede værdier (RFC 1918 og dokumentationsnet, opfundne navne og hemmeligheder).

use std::path::PathBuf;
use std::sync::Arc;

use grimnir_lib::laas::{HukommelsesDoer, Svar, Udloeser};
use grimnir_lib::maskering::{
    analyser, demasker, fil_aabn, fil_analyser, fil_demasker, fil_kopi, fil_marker, fil_raekker, fil_raekker_med, gem_og_masker, laas_igen,
    laas_op, note_ret, note_tilfoej, noter_kopier, resultat_kopier, sag_indhold, sag_ny, sag_post_kopier, ved_afslut, IndholdValg, NoteTid,
    SagPost, SideValg, Tilstand, UiFejl, Visning, MAKS_TID_TEGN,
};
use grimnir_lib::sager::{HukommelsesLager, SagsId};
use grimnir_lib::udklip::{HukommelsesUdklip, BUNDLE_ID, FORTROLIG, KILDE, TEKST_TYPE};

struct Mappe(PathBuf);
impl Mappe {
    fn ny() -> Self {
        let p = std::env::temp_dir().join(format!("grimnir-opbyg7-{}", SagsId::ny().unwrap().hex()));
        std::fs::create_dir_all(&p).unwrap();
        Mappe(p)
    }
    fn fil(&self, navn: &str, tekst: &str) -> PathBuf {
        let p = self.0.join(navn);
        std::fs::write(&p, tekst).unwrap();
        p
    }
}
impl Drop for Mappe {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}

/// Programmet med en efterlignet udklipsholder (aldrig den rigtige).
fn med_udklip(laesbar: bool) -> (Mappe, Tilstand, Arc<HukommelsesUdklip>) {
    let u = Arc::new(HukommelsesUdklip::ny(laesbar));
    let m = Mappe::ny();
    let t = Tilstand::paa_disk(m.0.clone(), Arc::new(HukommelsesLager::ny())).med_udklip(Some(Box::new(u.clone())));
    (m, t, u)
}

const TEKST: &str = "srcip=10.20.30.11 user=\"bruger060\"\r\nServer=srv-068;Password=Sommer2026!;\r\n";

/// Maskerer [`TEKST`] (alle fund) og giver den maskerede tekst.
fn masker(t: &Tilstand) -> String {
    let a = analyser(t, TEKST, None, &[]).unwrap();
    let fra: Vec<usize> = a.raekker.iter().filter(|r| !r.valgt).map(|r| r.id).collect();
    gem_og_masker(t, TEKST, &fra, &[]).unwrap().maskeret
}

fn poster(t: &Tilstand) -> Vec<SagPost> {
    let alle = sag_indhold(
        t,
        None,
        &IndholdValg {
            antal: 1000,
            ..IndholdValg::default()
        },
    )
    .unwrap();
    let vist: Vec<usize> = alle.raekker.iter().map(|p| p.nr).collect();
    sag_indhold(
        t,
        None,
        &IndholdValg {
            antal: 1000,
            vist,
            ..IndholdValg::default()
        },
    )
    .unwrap()
    .raekker
}

fn post(t: &Tilstand, vaerdi: &str) -> SagPost {
    poster(t).into_iter().find(|p| p.vaerdi.as_deref() == Some(vaerdi)).unwrap()
}

/// Teksten som almindelig tekst og på samme element mærket og kilden.
fn maerket(tekst: &str) -> Vec<(String, String)> {
    vec![
        (TEKST_TYPE.to_string(), tekst.to_string()),
        (FORTROLIG.to_string(), String::new()),
        (KILDE.to_string(), BUNDLE_ID.to_string()),
    ]
}

fn tid(nr: u64, tekst: &str) -> NoteTid {
    NoteTid { nr, tekst: tekst.into() }
}

fn kilde(fil: &str) -> String {
    std::fs::read_to_string(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join(fil)).unwrap()
}

fn krop<'a>(k: &'a str, start: &str) -> &'a str {
    let s = k.find(start).unwrap_or_else(|| panic!("{start} mangler"));
    &k[s..s + k[s..].find("\n}\n").unwrap()]
}

// ─────────────────────────────────────────────────────────────── N1: Kopiér værdi

#[test]
fn n1_kopier_vaerdi_for_en_almindelig_vaerdi_skriver_rust_med_maerket_og_laasen_rydder() {
    let (_m, t, u) = med_udklip(false);
    masker(&t);
    let p = post(&t, "srv-068");
    assert!(!p.hemmelig);
    assert!(sag_post_kopier(&t, p.nr, &p.kode).unwrap());
    assert_eq!(
        u.typer_nu(),
        maerket("srv-068"),
        "almindelig tekst med mærket og kilden på samme element"
    );
    assert_eq!((u.skrivninger(), u.laesninger()), (1, 0), "skrevet af Rust; intet læst");
    assert!(laas_igen(&t, Udloeser::Dvale));
    assert_eq!((u.nu(), u.typer_nu()), (None, vec![]), "låsen rydder den (D21)");
    // Afslutningen rydder også; et andet programs tekst bagefter røres ikke.
    assert_eq!(laas_op(&t, &HukommelsesDoer::ny(Svar::Ok), "da").svar, Svar::Ok);
    masker(&t);
    let p = post(&t, "srv-068");
    assert!(sag_post_kopier(&t, p.nr, &p.kode).unwrap());
    ved_afslut(&t);
    assert_eq!(u.nu(), None, "afslutningen rydder den");
    let (_m, t, u) = med_udklip(false);
    masker(&t);
    let p = post(&t, "srv-068");
    assert!(sag_post_kopier(&t, p.nr, &p.kode).unwrap());
    u.skriv("et andet programs tekst");
    assert!(laas_igen(&t, Udloeser::Dvale));
    assert_eq!(u.nu().as_deref(), Some("et andet programs tekst"));
}

// ─────────────────────────────────────────────────────────────── N1: Kopiér resultat

#[test]
fn n1_kopier_resultat_for_indsat_tekst_skriver_rusts_eget_resultat_med_maerket() {
    let (_m, t, u) = med_udklip(false);
    let maskeret = masker(&t);
    let d = demasker(&t, &maskeret).unwrap();
    assert_eq!(d.tekst, TEKST);
    assert!(resultat_kopier(&t, false, Some(&d.tekst)).unwrap());
    assert_eq!(u.typer_nu(), maerket(TEKST));
    assert_eq!((u.skrivninger(), u.laesninger()), (1, 0));
    assert!(laas_igen(&t, Udloeser::Dvale));
    assert_eq!((u.nu(), u.typer_nu()), (None, vec![]), "låsen rydder (D21)");
    // Afslutningen rydder også.
    assert_eq!(laas_op(&t, &HukommelsesDoer::ny(Svar::Ok), "da").svar, Svar::Ok);
    let maskeret = masker(&t);
    let d = demasker(&t, &maskeret).unwrap();
    assert!(resultat_kopier(&t, false, Some(&d.tekst)).unwrap());
    ved_afslut(&t);
    assert_eq!(u.nu(), None);
}

#[test]
fn n1_kopier_resultat_skriver_ikke_en_anden_tekst_end_rusts_resultat() {
    let (_m, t, u) = med_udklip(true);
    let maskeret = masker(&t);
    // Før en demaskering: intet resultat at genkende.
    assert!(!resultat_kopier(&t, false, Some(TEKST)).unwrap());
    let d = demasker(&t, &maskeret).unwrap();
    assert!(!resultat_kopier(&t, false, Some("en tekst, webvisningen fandt på")).unwrap());
    assert!(!resultat_kopier(&t, false, Some(&format!("{} ", d.tekst))).unwrap());
    assert_eq!((u.skrivninger(), u.nu()), (0, None), "intet skrevet");
    assert_eq!(resultat_kopier(&t, false, None), Err(UiFejl::IntetResultat));
}

#[test]
fn n1_kopier_resultat_for_en_fil_skriver_filens_resultat_uden_tekst_fra_webvisningen() {
    let (m, t, u) = med_udklip(false);
    let maskeret = masker(&t);
    assert_eq!(resultat_kopier(&t, true, None), Err(UiFejl::IngenFil));
    let sti = m.fil("maskeret.log", &maskeret);
    fil_aabn(&t, Visning::Demasker, &sti).unwrap();
    assert_eq!(resultat_kopier(&t, true, None), Err(UiFejl::IntetResultat));
    fil_demasker(&t).unwrap();
    let hele = fil_kopi(&t, Visning::Demasker).unwrap();
    // En tekst fra webvisningen bruges ikke for en fil.
    assert!(resultat_kopier(&t, true, Some("ignoreres")).unwrap());
    assert_eq!(u.typer_nu(), maerket(&hele));
    assert_eq!(u.nu().as_deref(), Some(TEKST));
    assert!(laas_igen(&t, Udloeser::Dvale));
    assert_eq!((u.nu(), u.typer_nu()), (None, vec![]), "låsen rydder (D21)");
}

#[test]
fn n1_kopier_resultat_for_en_fil_over_5_mib_afvises_som_fil_kopi() {
    let (m, t, u) = med_udklip(false);
    let maskeret = masker(&t);
    let sti = m.fil("stor.log", &maskeret.repeat(6 * 1024 * 1024 / maskeret.len() + 1));
    fil_aabn(&t, Visning::Demasker, &sti).unwrap();
    let d = fil_demasker(&t).unwrap();
    assert!(!d.kopierbar);
    assert!(matches!(resultat_kopier(&t, true, None), Err(UiFejl::ForStorTilKopi { .. })));
    assert_eq!(u.skrivninger(), 0);
}

// ─────────────────────────────────────────────────────────────── N1: Kopiér noterne

#[test]
fn n1_kopier_noterne_bygger_teksten_som_webvisningen_og_skriver_den_med_maerket() {
    let (_m, t, u) = med_udklip(false);
    // Uden noter: intet at kopiere.
    assert!(!noter_kopier(&t, "da", &[]).unwrap());
    let n1 = note_tilfoej(&t, "Ringet til leverandøren.\nVenter på svar.").unwrap().nr.unwrap();
    let n2 = note_tilfoej(&t, "De beder om loggen fra fw-syd02.").unwrap().nr.unwrap();
    note_ret(&t, n2, "De beder om loggen fra fw-syd02.\nHusk samme sag.").unwrap();
    let tider = [
        tid(n1, "13. november 2026 kl. 15.10"),
        tid(n2, "13. november 2026 kl. 15.12 · rettet 14. november 2026 kl. 09.00"),
    ];
    assert!(noter_kopier(&t, "da", &tider).unwrap());
    let forventet = "Noter · Midlertidig sag\n\n13. november 2026 kl. 15.10\nRinget til leverandøren.\nVenter på svar.\n\n\
                     13. november 2026 kl. 15.12 · rettet 14. november 2026 kl. 09.00\nDe beder om loggen fra fw-syd02.\nHusk samme sag.\n";
    assert_eq!(u.typer_nu(), maerket(forventet));
    // Engelsk; tidspunkterne i en anden rækkefølge end noterne: noternes rækkefølge gælder.
    let tider_en = [tid(n2, "13 November 2026 at 15:12"), tid(n1, "13 November 2026 at 15:10")];
    assert!(noter_kopier(&t, "en", &tider_en).unwrap());
    assert!(u
        .nu()
        .unwrap()
        .starts_with("Notes · Temporary case\n\n13 November 2026 at 15:10\nRinget"));
    assert!(laas_igen(&t, Udloeser::Dvale));
    assert_eq!((u.nu(), u.typer_nu()), (None, vec![]), "låsen rydder (D21)");
}

#[test]
fn n1_kopier_noterne_i_en_navngiven_sag_har_sagens_navn_fra_rust() {
    let (_m, t, u) = med_udklip(false);
    sag_ny(&t, "Uglebo-sagen", None).unwrap();
    let nr = note_tilfoej(&t, "Første note.").unwrap().nr.unwrap();
    assert!(noter_kopier(&t, "da", &[tid(nr, "kl. 10")]).unwrap());
    assert_eq!(u.nu().as_deref(), Some("Noter · Uglebo-sagen\n\nkl. 10\nFørste note.\n"));
    assert!(noter_kopier(&t, "en", &[tid(nr, "10:00")]).unwrap());
    assert_eq!(u.nu().as_deref(), Some("Notes · Uglebo-sagen\n\n10:00\nFørste note.\n"));
    ved_afslut(&t);
    assert_eq!(u.nu(), None, "afslutningen rydder (D21)");
}

#[test]
fn n1_kopier_noterne_afviser_tidspunkter_der_ikke_passer_til_noterne() {
    let (_m, t, u) = med_udklip(false);
    let n1 = note_tilfoej(&t, "En note.").unwrap().nr.unwrap();
    let n2 = note_tilfoej(&t, "En anden note.").unwrap().nr.unwrap();
    let ukendt = Err(UiFejl::Note { hvad: "ukendt", maks: 0 });
    assert_eq!(noter_kopier(&t, "da", &[tid(n1, "a")]), ukendt, "en note mangler");
    assert_eq!(
        noter_kopier(&t, "da", &[tid(n1, "a"), tid(n2 + 7, "b")]),
        ukendt,
        "et ukendt nummer"
    );
    assert_eq!(
        noter_kopier(&t, "da", &[tid(n1, "a"), tid(n2, "b"), tid(n2, "c")]),
        ukendt,
        "et tidspunkt for meget"
    );
    assert_eq!(
        noter_kopier(&t, "da", &[tid(n1, "a\nb"), tid(n2, "c")]),
        ukendt,
        "et linjeskift i et tidspunkt"
    );
    let langt = "x".repeat(MAKS_TID_TEGN + 1);
    assert_eq!(noter_kopier(&t, "da", &[tid(n1, &langt), tid(n2, "c")]), ukendt, "for langt");
    assert!(noter_kopier(&t, "da", &[tid(n1, &"x".repeat(MAKS_TID_TEGN)), tid(n2, "c")]).unwrap());
    assert_eq!(u.skrivninger(), 1, "kun den sidste er skrevet");
}

/// Overskrifterne er de samme ord som webvisningens (`sprog.js`), som teksten var, da webvisningen byggede den.
#[test]
fn n1_noternes_overskrifter_er_de_samme_som_i_sprog_js() {
    let sprog = std::fs::read_to_string(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../ui/assets/sprog.js")).unwrap();
    assert!(sprog.contains("noterKopiMidl: 'Noter · Midlertidig sag', noterKopiSag: 'Noter · {v}',"));
    assert!(sprog.contains("noterKopiMidl: 'Notes · Temporary case', noterKopiSag: 'Notes · {v}',"));
    let m = kilde("src/maskering.rs");
    let k = krop(&m, "fn noter_tekst(");
    for del in [
        "\"Noter · {n}\"",
        "\"Notes · {n}\"",
        "\"Noter · Midlertidig sag\"",
        "\"Notes · Temporary case\"",
    ] {
        assert!(k.contains(del), "{del}");
    }
}

// ─────────────────────────────────────────────────────────────── N1: fælles

#[test]
fn n1_kan_rust_ikke_skrive_er_svaret_falsk_intet_ligger_der_og_intet_huskes() {
    let (m, t, u) = med_udklip(true);
    let maskeret = masker(&t);
    let d = demasker(&t, &maskeret).unwrap();
    let nr = note_tilfoej(&t, "En note.").unwrap().nr.unwrap();
    let p = post(&t, "srv-068");
    let sti = m.fil("maskeret.log", &maskeret);
    fil_aabn(&t, Visning::Demasker, &sti).unwrap();
    fil_demasker(&t).unwrap();
    u.skriv("noget, der stod der før");
    u.afvis_skrivning();
    assert!(!sag_post_kopier(&t, p.nr, &p.kode).unwrap());
    assert!(!resultat_kopier(&t, false, Some(&d.tekst)).unwrap());
    assert!(!resultat_kopier(&t, true, None).unwrap());
    assert!(!noter_kopier(&t, "da", &[tid(nr, "kl. 10")]).unwrap());
    assert_eq!(u.skrivninger(), 4);
    assert_eq!(u.nu().as_deref(), Some("noget, der stod der før"), "intet skrevet");
    let foer = u.taeller_nu();
    assert!(laas_igen(&t, Udloeser::Dvale));
    assert_eq!(
        (u.taeller_nu(), u.nu().as_deref()),
        (foer, Some("noget, der stod der før")),
        "intet huskes, så låsen rydder intet"
    );
    // Uden udklipsholder (som på Windows): falsk; webvisningen kopierer som før.
    let t2 = Tilstand::ny();
    let maskeret = masker(&t2);
    let d = demasker(&t2, &maskeret).unwrap();
    let nr = note_tilfoej(&t2, "En note.").unwrap().nr.unwrap();
    let p = post(&t2, "srv-068");
    assert!(!sag_post_kopier(&t2, p.nr, &p.kode).unwrap());
    assert!(!resultat_kopier(&t2, false, Some(&d.tekst)).unwrap());
    assert!(!resultat_kopier(&t2, true, None).unwrap());
    assert!(!noter_kopier(&t2, "da", &[tid(nr, "kl. 10")]).unwrap());
}

#[test]
fn n1_laast_svarer_laast_og_intet_skrives() {
    let (_m, t, u) = med_udklip(false);
    let maskeret = masker(&t);
    let d = demasker(&t, &maskeret).unwrap();
    let nr = note_tilfoej(&t, "En note.").unwrap().nr.unwrap();
    let p = post(&t, "srv-068");
    assert!(laas_igen(&t, Udloeser::Dvale));
    assert_eq!(sag_post_kopier(&t, p.nr, &p.kode).err(), Some(UiFejl::Laast));
    assert_eq!(resultat_kopier(&t, false, Some(&d.tekst)).err(), Some(UiFejl::Laast));
    assert_eq!(resultat_kopier(&t, true, None).err(), Some(UiFejl::Laast));
    assert_eq!(noter_kopier(&t, "da", &[tid(nr, "kl. 10")]).err(), Some(UiFejl::Laast));
    assert_eq!(u.skrivninger(), 0);
    // Efter oplåsningen er det demaskerede resultat glemt (låsen glemmer fingeraftrykkene).
    assert_eq!(laas_op(&t, &HukommelsesDoer::ny(Svar::Ok), "da").svar, Svar::Ok);
    assert!(!resultat_kopier(&t, false, Some(&d.tekst)).unwrap());
}

/// Kilden: porten før og igen under udklipsholderens lås, mærket (`skriv_fortrolig`), intet til log; `skriv_tekst` er
/// væk; kommandoerne er registreret og tilladt; `lib.rs` nulstiller den indsatte teksts resultat; Kopiér maskeret tekst
/// og Kopiér kvittering er ikke fortrolige og bruger ikke de nye kommandoer.
#[test]
fn n1_kilden_porten_maerket_registreringen_og_det_der_ikke_er_fortroligt() {
    let m = kilde("src/maskering.rs");
    for navn in ["resultat_kopier", "noter_kopier", "sag_post_kopier"] {
        let k = krop(&m, &format!("pub fn {navn}("));
        assert!(k.matches("t.aaben()?").count() >= 2, "{navn}: porten før og igen");
        // Hver gang udklipsholderens lås tages, tjekkes porten igen straks efter (en lås imens venter på den og rydder).
        assert!(k.contains("t.udklip_husk()"), "{navn}");
        for (i, _) in k.match_indices("t.udklip_husk();") {
            let efter = &k[i..];
            let naeste = efter.lines().nth(1).unwrap_or_default().trim();
            assert_eq!(naeste, "t.aaben()?;", "{navn}: porten igen under udklipsholderens lås");
        }
        for ord in ["println", "eprintln", "dbg!", "log::"] {
            assert!(!k.contains(ord), "{ord} i {navn}");
        }
    }
    let skriv = krop(&m, "fn skriv_og_husk(");
    assert!(skriv.contains("u.skriv_fortrolig(tekst)") && skriv.contains("h.taeller = u.taeller();"));
    let u = kilde("src/udklip.rs");
    assert!(!u.contains("fn skriv_tekst("), "skriv_tekst er fjernet");
    let lib = kilde("src/lib.rs");
    let rk = krop(&lib, "fn resultat_kopier(");
    assert!(
        rk.contains("zeroize::Zeroize::zeroize(&mut tekst);"),
        "den indsatte teksts resultat nulstilles"
    );
    for navn in ["resultat_kopier", "noter_kopier"] {
        assert!(lib.contains(&format!("        {navn}")), "{navn} i generate_handler");
        assert!(kilde("build.rs").contains(&format!("\"{navn}\"")));
        assert!(kilde("capabilities/default.json").contains(&format!("\"allow-{}\"", navn.replace('_', "-"))));
    }
    let js = std::fs::read_to_string(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../ui/assets/maskering.js")).unwrap();
    let kvit = &js[js.find("async function kopierKvittering").unwrap()..js.find("document.addEventListener('grimnir-ordbog'").unwrap()];
    assert!(
        !kvit.contains("resultat_kopier") && !kvit.contains("kopierFortroligt"),
        "kvitteringen er ikke fortrolig"
    );
    assert_eq!(js.matches("invoke('resultat_kopier'").count(), 1, "kun Kopiér resultat i Demaskér");
}

// ─────────────────────────────────────────────────────────────── N3

/// En fil med 3 × 256 = 768 forskellige adresser i dokumentationsnettene (RFC 5737): hver bliver sin egen række.
fn mange_raekker() -> String {
    let mut s = String::new();
    for net in ["192.0.2", "198.51.100", "203.0.113"] {
        for i in 0..=255 {
            s.push_str(&format!("forbindelse fra {net}.{i} afvist\n"));
        }
    }
    s
}

fn side(filter: &str, soeg: &str, antal: usize) -> SideValg {
    SideValg {
        filter: filter.into(),
        soeg: soeg.into(),
        vist: vec![],
        antal,
    }
}

#[test]
fn n3_en_raekke_efter_de_foerste_500_kommer_med_paa_siden_med_sin_plads() {
    let m = Mappe::ny();
    let t = Tilstand::paa_disk(m.0.clone(), Arc::new(HukommelsesLager::ny()));
    let tekst = mange_raekker();
    let sti = m.fil("mange.log", &tekst);
    fil_aabn(&t, Visning::Masker, &sti).unwrap();
    let a = fil_analyser(&t, None, None, &[], &side("alle", "", 500)).unwrap();
    assert!(a.side.i_alt > 700, "{}", a.side.i_alt);
    assert_eq!((a.side.raekker.len(), a.side.plads), (500, None));
    // Rækkerne i rækkefølge, som Rust sender dem (en stor side).
    let alle = fil_raekker(&t, &side("alle", "", 5000)).unwrap().raekker;
    let (p, maal) = alle
        .iter()
        .enumerate()
        .find(|(_, r)| r.vaerdier.iter().any(|v| v == "203.0.113.200"))
        .unwrap();
    assert!(p >= 500, "{p}");
    // Maskér markering på adressen svarer "allerede et fund" med rækken (V-OPBYG.6).
    let i = tekst.find("203.0.113.200").unwrap();
    let fm = fil_marker(&t, tekst[..i].encode_utf16().count(), "203.0.113.200".len(), "ord").unwrap();
    assert_eq!((fm.afvist, fm.raekke), (Some("findes"), Some(maal.id)));
    // Siden med rækken: det mindste multiplum af 500, der når den, og pladsen.
    let s = fil_raekker_med(&t, &side("alle", "", 500), Some(maal.id)).unwrap();
    assert_eq!(s.plads, Some(p));
    assert!(s.raekker.iter().any(|r| r.id == maal.id));
    assert_eq!(s.raekker.len(), 1000.min(a.side.i_alt));
    // Efter "Vis flere" (1000): rækken er allerede med; siden er den samme størrelse.
    let s = fil_raekker_med(&t, &side("alle", "", 1000), Some(maal.id)).unwrap();
    assert_eq!((s.plads, s.raekker.len()), (Some(p), 1000.min(a.side.i_alt)));
    // En række på første side: siden er uændret.
    let s = fil_raekker_med(&t, &side("alle", "", 500), Some(alle[3].id)).unwrap();
    assert_eq!((s.plads, s.raekker.len()), (Some(3), 500));
    // Uden `med` er svaret som før.
    let s = fil_raekker(&t, &side("alle", "", 500)).unwrap();
    assert_eq!((s.plads, s.raekker.len()), (None, 500));
}

#[test]
fn n3_skjuler_filteret_eller_soegningen_raekken_er_pladsen_tom() {
    let m = Mappe::ny();
    let t = Tilstand::paa_disk(m.0.clone(), Arc::new(HukommelsesLager::ny()));
    let sti = m.fil("mange.log", &mange_raekker());
    fil_aabn(&t, Visning::Masker, &sti).unwrap();
    fil_analyser(&t, None, None, &[], &side("alle", "", 500)).unwrap();
    let alle = fil_raekker(&t, &side("alle", "", 5000)).unwrap().raekker;
    let maal = alle.iter().find(|r| r.vaerdier.iter().any(|v| v == "203.0.113.200")).unwrap();
    // Søgningen skjuler den: ingen plads, siden som uden `med`.
    let s = fil_raekker_med(&t, &side("alle", "192.0.2.", 500), Some(maal.id)).unwrap();
    assert_eq!(s.plads, None);
    assert!(s.raekker.iter().all(|r| r.id != maal.id));
    // Søgningen viser den: pladsen i den søgte liste.
    let s = fil_raekker_med(&t, &side("alle", "203.0.113.2", 500), Some(maal.id)).unwrap();
    assert!(s.plads.is_some() && s.raekker.iter().any(|r| r.id == maal.id));
    // En ukendt række: ingen plads.
    let s = fil_raekker_med(&t, &side("alle", "", 500), Some(usize::MAX)).unwrap();
    assert_eq!((s.plads, s.raekker.len()), (None, 500));
}

// ─────────────────────────────────────────────────────────────── N4

/// Repoets filer (README'erne, ui/).
fn repo(fil: &str) -> String {
    std::fs::read_to_string(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("..").join(fil)).unwrap()
}

/// Fanerne i rækkefølge fra `app.js` (`VISNINGER`: `      id: '<id>', t: '<nøgle>'`) med navnet på dansk og engelsk fra
/// `sprog.js` (første forekomst af nøglen er dansk, anden engelsk).
fn faner() -> Vec<(String, String, String)> {
    let app = repo("ui/assets/app.js");
    let sprog = repo("ui/assets/sprog.js");
    let start = app.find("const VISNINGER = [").unwrap();
    let slut = app.find("const ID = VISNINGER.map(v => v.id);").unwrap();
    let mut ud = Vec::new();
    for l in app[start..slut].lines() {
        let Some(rest) = l.strip_prefix("      id: '") else { continue };
        let id = &rest[..rest.find('\'').unwrap()];
        let n = &rest[rest.find("t: '").unwrap() + 4..];
        let noegle = &n[..n.find('\'').unwrap()];
        let navne: Vec<String> = sprog
            .match_indices(&format!("{noegle}: '"))
            .map(|(i, m)| {
                let v = &sprog[i + m.len()..];
                v[..v.find('\'').unwrap()].to_string()
            })
            .collect();
        assert_eq!(navne.len(), 2, "{noegle}: én tekst på dansk og én på engelsk");
        ud.push((id.to_string(), navne[0].clone(), navne[1].clone()));
    }
    ud
}

/// Alle genveje i et afsnit: `⌘X` og `⇧⌘X` (X er ét tegn efter ⌘).
fn genveje_i(tekst: &str) -> Vec<String> {
    let t: Vec<char> = tekst.chars().collect();
    let mut ud = Vec::new();
    for i in 0..t.len() {
        if t[i] == '⌘' && i + 1 < t.len() {
            let shift = i > 0 && t[i - 1] == '⇧';
            ud.push(format!("{}⌘{}", if shift { "⇧" } else { "" }, t[i + 1]));
        }
    }
    ud
}

/// Genvejene i koden: ⌘1 … ⌘n for fanerne (`app.js`), programmenuen (`programmenu.rs`), visningernes (`maskering.js`
/// `GV`, ⌘↵ i Noter), tekststørrelsen (`app.js` `TEKST_TAST`) og ⌘V (systemets Indsæt).
fn genveje_i_koden(n: usize) -> Vec<String> {
    let mut k: Vec<String> = (1..=n).map(|i| format!("⌘{i}")).collect();
    let app = repo("ui/assets/app.js");
    assert!(
        app.contains("if (tal && Number(tal[1]) <= ID.length) {"),
        "⌘1–⌘n følger antallet af faner"
    );
    assert!(app.contains("const TEKST_TAST = { '+': 'større', '=': 'større', '-': 'mindre', 0: 'nulstil' };"));
    k.extend(["⌘+", "⌘−", "⌘0", "⌘V"].map(String::from));
    let menu = kilde("src/programmenu.rs");
    for l in menu.lines().filter(|l| l.starts_with("pub const GENVEJ_")) {
        let v = &l[l.find('"').unwrap() + 1..l.rfind('"').unwrap()];
        let tast = v.strip_prefix("CmdOrCtrl+").unwrap();
        k.push(match tast.strip_prefix("Shift+") {
            Some(x) => format!("⇧⌘{x}"),
            None => format!("⌘{tast}"),
        });
    }
    let m = repo("ui/assets/maskering.js");
    let gv = &m[m.find("  const GV = {").unwrap()..];
    let gv = &gv[..gv.find("\n  };").unwrap()];
    for l in gv.lines() {
        if let Some(i) = l.find("G.mod + '") {
            k.push(format!("⌘{}", l[i + 9..].chars().next().unwrap()));
        }
        if let Some(i) = l.find("'Ctrl+Shift+') + '") {
            k.push(format!("⇧⌘{}", l[i + 18..].chars().next().unwrap()));
        }
        if l.contains("['genvejTitel', '⇧⌘Z'") {
            k.push("⇧⌘Z".into());
        }
    }
    assert!(repo("ui/assets/noter.js").contains("const genvej = () => (G.mac ? '⌘↵' : 'Ctrl+Enter');"));
    k
}

#[test]
fn n4_readme_naevner_de_faner_og_genveje_koden_har_paa_begge_sprog() {
    let f = faner();
    assert_eq!(
        f.iter().map(|x| x.0.as_str()).collect::<Vec<_>>(),
        ["masker", "demasker", "noter", "sager", "ordbog"]
    );
    let n = f.len();
    let kendte = genveje_i_koden(n);
    let tal_en = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
    let tal_da = ["nul", "en", "to", "tre", "fire", "fem", "seks", "syv", "otte", "ni"];
    for (fil, da, overskrift) in [("README.md", false, "## Shortcuts"), ("README.da.md", true, "## Genveje")] {
        let r = repo(fil);
        let navne: Vec<&str> = f.iter().map(|x| if da { x.1.as_str() } else { x.2.as_str() }).collect();
        // Antallet og rækkefølgen af fanerne.
        let liste = navne.iter().map(|x| format!("**{x}**")).collect::<Vec<_>>();
        let (foer, sidst) = liste.split_at(n - 1);
        let saetning = if da {
            format!("med {} faner i denne rækkefølge: {} og {}.", tal_da[n], foer.join(", "), sidst[0])
        } else {
            format!("with {} tabs in this order: {} and {}.", tal_en[n], foer.join(", "), sidst[0])
        };
        assert!(r.contains(&saetning), "{fil}: {saetning}");
        // ⌘1–⌘n med fanernes navne, og ingen ⌘ til en fane, der ikke findes.
        for (i, x) in navne.iter().enumerate() {
            assert!(r.contains(&format!("⌘{} {x} ·", i + 1)), "{fil}: ⌘{} {x}", i + 1);
        }
        assert!(!r.contains(&format!("⌘{} ", n + 1)), "{fil}: ⌘{} findes ikke", n + 1);
        // Hver genvej i README findes i koden.
        let afsnit = &r[r.find(overskrift).unwrap()..];
        let afsnit = &afsnit[..afsnit[3..].find("\n## ").map_or(afsnit.len(), |i| i + 3)];
        assert!(genveje_i(afsnit).len() >= n + 8, "{fil}: genvejsafsnittet");
        for g in genveje_i(&r) {
            assert!(kendte.contains(&g), "{fil}: {g} findes ikke i koden ({kendte:?})");
        }
        // Navn og slogan (D22, D28).
        assert!(r.starts_with("# Wi24rd Grimnir\n\n*Mask. Share. Restore.*\n"), "{fil}");
        assert!(
            r.contains("Apache-2.0") && r.contains("THIRD_PARTY_LICENSES.md") && r.contains("(NOTICE)"),
            "{fil}"
        );
    }
    // CHANGELOG: fanerne og ⌘1–⌘n.
    let c = repo("CHANGELOG.md");
    let da: Vec<&str> = f.iter().map(|x| x.1.as_str()).collect();
    let linje = format!(
        "- {} faner: {} og {} (⌘1–⌘{n}).",
        {
            let mut s = tal_da[n].to_string();
            s[..1].make_ascii_uppercase();
            s
        },
        da[..n - 1].join(", "),
        da[n - 1]
    );
    assert!(c.contains(&linje), "CHANGELOG: {linje}");
    for g in genveje_i(&c) {
        assert!(kendte.contains(&g) || g == format!("⌘{n}"), "CHANGELOG: {g}");
    }
}

/// README og CHANGELOG lover intet om udgivelse, signering eller Windows ud over, at det ikke findes endnu, og har ingen
/// klokkeslæt eller datoer i CHANGELOG.
#[test]
fn n4_readme_og_changelog_lover_intet_der_ikke_findes() {
    let en = repo("README.md");
    let da = repo("README.da.md");
    assert!(
        en.contains("**Status:** early prototype. Development builds on macOS only. Not released. The Windows version has not been built.")
    );
    assert!(da.contains("**Status:** tidlig prototype. Kun udviklingsbygninger til macOS. Ikke udgivet. Windows-udgaven er ikke bygget."));
    for (fil, r) in [("README.md", &en), ("README.da.md", &da)] {
        for ord in ["Releases", "notar", "Developer ID", "wi24rd.com", "Download", "Hent "] {
            assert!(!r.contains(ord), "{fil}: {ord}");
        }
    }
    let c = repo("CHANGELOG.md");
    assert!(c.contains("## [Ikke udgivet]"));
    assert_eq!(c.matches("\n## ").count(), 1, "én post");
    for (i, ch) in c.char_indices() {
        // Ingen dato (2026-…) og intet klokkeslæt (TT:MM).
        if ch.is_ascii_digit() {
            let rest = &c[i..];
            assert!(
                !rest.starts_with("20") || !rest[2..].starts_with(|x: char| x.is_ascii_digit()) || !rest[4..].starts_with('-'),
                "en dato i CHANGELOG"
            );
            assert!(
                !(rest.len() > 4 && rest.as_bytes()[2] == b':' && rest.as_bytes()[1].is_ascii_digit()),
                "et klokkeslæt i CHANGELOG"
            );
        }
    }
}
