//! V-SAG.1 G2: sagsfilen uden vindue og uden rigtig Keychain. Mappen er en midlertidig mappe fra
//! `std::env::temp_dir()` med tilfældigt navn, ryddet efter testen; nøglelageret ligger i hukommelsen. Kun opdigtede
//! værdier: RFC 1918-adresser, opfundne navne og hemmeligheder.

use std::path::PathBuf;
use std::sync::Arc;

use grimnir_core::{analyser, demasker, foreslaa_med_ordbog, masker, Ordbog, Sag, SagData};
use grimnir_lib::sager::{
    ider, laes, laes_hoved, rens_navn, skriv_med, sti, tjek_dato, Arkiv, Hoved, HukommelsesLager, Noegle, Noeglelager, SagFejl, SagsId,
    FORMATVERSION, MAGI, TJENESTE,
};

const TEKST: &str = "devname=\"FW-KONTOR01\" srcip=10.20.30.11 user=\"bruger060\"\r\n\
Server=srv-068;Database=Kunde_DB;User Id=app;Password=Sommer2026!;\r\n\
user=\"BRUGER060\" token=Zq8Xv2Lm9Pw4Rt7Yk3Nb6Hc1Jd5Fg0Qs\r\n";
const NAVN: &str = "Supportsag Uglebo 0042";
const ORIGINALER: [&str; 8] = [
    "FW-KONTOR01",
    "10.20.30.11",
    "bruger060",
    "BRUGER060",
    "srv-068",
    "Kunde_DB",
    "Sommer2026!",
    "Zq8Xv2Lm9Pw4Rt7Yk3Nb6Hc1Jd5Fg0Qs",
];

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

fn arkiv(m: &Mappe) -> (Arkiv, Arc<HukommelsesLager>) {
    let lager = Arc::new(HukommelsesLager::ny());
    (Arkiv::ny(m.0.clone(), Box::new(lager.clone())), lager)
}

/// En sag med TEKST maskeret: (sagens data, den maskerede tekst).
fn sag_med_tekst() -> (SagData, String) {
    let mut sag = Sag::default();
    let o = Ordbog::ny();
    let fund = analyser(TEKST, &o);
    let e = foreslaa_med_ordbog(&fund, TEKST, &mut sag, &o);
    let m = masker(TEKST, &e);
    sag.ret_enhed("user0001", "kunde7", TEKST).expect("rettelse");
    (sag.til_data(), m)
}

fn bytes(m: &Mappe, id: &SagsId) -> Vec<u8> {
    std::fs::read(sti(&m.0, id)).unwrap()
}

fn find(hav: &[u8], naal: &[u8]) -> bool {
    hav.windows(naal.len()).any(|w| w == naal)
}

#[test]
fn rundtur_gem_luk_aabn_demasker_bytepraecist() {
    let m = Mappe::ny();
    let (a, lager) = arkiv(&m);
    let (data, maskeret) = sag_med_tekst();
    let poster = data.poster.len();
    let id = a.opret(NAVN, Some("2027-01-31".into()), &data, 1_700_000_000_000).unwrap().id;
    assert!(lager.har(&id));
    drop(data);
    // "Programmet lukkes": et nyt arkiv på samme mappe og lager.
    let (aaben, data) = a.aabn(&id).unwrap();
    assert_eq!(aaben.hoved.navn, NAVN);
    assert_eq!(aaben.hoved.udloeb.as_deref(), Some("2027-01-31"));
    assert_eq!((aaben.hoved.poster, aaben.hoved.skrivetaeller), (poster, 1));
    let sag = Sag::fra_data(data).unwrap();
    let (tilbage, _) = demasker(&maskeret, &sag);
    assert_eq!(tilbage.as_bytes(), TEKST.as_bytes(), "rundturen er bytepræcis");
    // Aliaset fra rettelsen overlever filen: den maskerede tekst har den gamle kode user0001.
    assert!(maskeret.contains("user0001") && sag.data().aliaser.iter().any(|(k, _)| k == "user0001"));
    // Listen viser hovedet uden at åbne kroppen.
    let liste = a.liste().unwrap();
    assert_eq!(liste.len(), 1);
    assert!(matches!(&liste[0].hoved, Ok(h) if h.navn == NAVN));
}

#[test]
fn filens_bytes_indeholder_ingen_originaler_koder_eller_navn() {
    let m = Mappe::ny();
    let (a, _) = arkiv(&m);
    let (data, _) = sag_med_tekst();
    let koder: Vec<String> = data
        .poster
        .iter()
        .map(|p| p.kode.clone())
        .chain(data.aliaser.iter().map(|x| x.0.clone()))
        .collect();
    let id = a.opret(NAVN, None, &data, 1).unwrap().id;
    let b = bytes(&m, &id);
    assert!(b.starts_with(MAGI) && b[8..10] == FORMATVERSION.to_le_bytes());
    assert!(koder.len() >= 8, "{}", koder.len());
    for s in ORIGINALER
        .iter()
        .copied()
        .chain(koder.iter().map(String::as_str))
        .chain([NAVN, "Uglebo", "kunde7"])
    {
        for form in [s.to_string(), s.to_ascii_lowercase(), s.to_ascii_uppercase()] {
            assert!(
                !find(&b, form.as_bytes()),
                "filen indeholder en værdi fra sagen i klartekst ({} bytes)",
                form.len()
            );
        }
    }
    // Heller ikke sags-id står i filen (det står kun i filnavnet).
    assert!(!find(&b, id.hex().as_bytes()));
    // Ingen midlertidige filer er blevet liggende.
    assert_eq!(std::fs::read_dir(&m.0).unwrap().count(), 1);
}

#[test]
fn ny_nonce_ved_hver_skrivning() {
    let m = Mappe::ny();
    let (a, _) = arkiv(&m);
    let (data, _) = sag_med_tekst();
    let mut aaben = a.opret(NAVN, None, &data, 1).unwrap();
    let foer = bytes(&m, &aaben.id);
    let h = aaben.hoved.clone();
    a.gem(&mut aaben, h, &data).unwrap();
    let efter = bytes(&m, &aaben.id);
    assert_eq!(aaben.hoved.skrivetaeller, 2);
    assert_ne!(foer[10..34], efter[10..34], "hovedets nonce er ny");
    let l1 = u32::from_le_bytes(efter[34..38].try_into().unwrap()) as usize;
    let k = 38 + l1;
    assert_ne!(foer[k..k + 24], efter[k..k + 24], "kroppens nonce er ny");
}

#[test]
fn forkert_noegle_giver_beskadiget() {
    let m = Mappe::ny();
    let (a, lager) = arkiv(&m);
    let (data, _) = sag_med_tekst();
    let id = a.opret(NAVN, None, &data, 1).unwrap().id;
    lager.byt_til_tilfaeldig(&id).unwrap();
    assert!(matches!(a.aabn(&id), Err(SagFejl::Beskadiget)));
    assert!(matches!(&a.liste().unwrap()[0].hoved, Err(SagFejl::Beskadiget)));
}

#[test]
fn en_aendret_byte_i_hoved_og_i_krop_opdages() {
    let m = Mappe::ny();
    let (a, _) = arkiv(&m);
    let (data, _) = sag_med_tekst();
    let id = a.opret(NAVN, None, &data, 1).unwrap().id;
    let rigtig = bytes(&m, &id);
    let l1 = u32::from_le_bytes(rigtig[34..38].try_into().unwrap()) as usize;
    let krop = 38 + l1 + 24 + 8;
    // nonce i hovedet, chiffertekst i hovedet, nonce i kroppen, chiffertekst i kroppen, sidste byte (mærket)
    for pos in [12, 40, 38 + l1 - 1, 38 + l1 + 3, krop + 5, rigtig.len() - 1] {
        let mut b = rigtig.clone();
        b[pos] ^= 0x01;
        std::fs::write(sti(&m.0, &id), &b).unwrap();
        assert!(matches!(a.aabn(&id), Err(SagFejl::Beskadiget)), "byte {pos}");
    }
    // En afkortet fil og en fil med en byte for meget.
    for b in [
        rigtig[..rigtig.len() - 1].to_vec(),
        [rigtig.clone(), vec![0]].concat(),
        rigtig[..20].to_vec(),
    ] {
        std::fs::write(sti(&m.0, &id), &b).unwrap();
        assert!(matches!(a.aabn(&id), Err(SagFejl::Beskadiget)));
    }
    std::fs::write(sti(&m.0, &id), &rigtig).unwrap();
    assert!(a.aabn(&id).is_ok());
}

#[test]
fn hoved_flyttet_til_en_anden_sags_fil_afvises() {
    let m = Mappe::ny();
    let (a, _) = arkiv(&m);
    let (data, _) = sag_med_tekst();
    let ida = a.opret("Sag A", None, &data, 1).unwrap().id;
    let idb = a.opret("Sag B", None, &data, 1).unwrap().id;
    let ba = bytes(&m, &ida);
    let bb = bytes(&m, &idb);
    let hoved_a = |b: &[u8]| {
        let l1 = u32::from_le_bytes(b[34..38].try_into().unwrap()) as usize;
        (10, 38 + l1)
    };
    let (s, e) = hoved_a(&ba);
    let (sb, eb) = hoved_a(&bb);
    let blandet = [&bb[..sb], &ba[s..e], &bb[eb..]].concat();
    std::fs::write(sti(&m.0, &idb), &blandet).unwrap();
    assert!(matches!(a.aabn(&idb), Err(SagFejl::Beskadiget)), "hoved fra A i B's fil");
    // Hele A's fil under B's navn: id indgår i AAD.
    std::fs::write(sti(&m.0, &idb), &ba).unwrap();
    assert!(matches!(a.aabn(&idb), Err(SagFejl::Beskadiget)));
}

#[test]
fn hoved_og_krop_fra_to_skrivninger_afvises() {
    let m = Mappe::ny();
    let (a, _) = arkiv(&m);
    let (data, _) = sag_med_tekst();
    let mut aaben = a.opret(NAVN, None, &data, 1).unwrap();
    let gammel = bytes(&m, &aaben.id);
    let mut h = aaben.hoved.clone();
    h.navn = "Nyt navn".into();
    a.gem(&mut aaben, h, &data).unwrap();
    let ny = bytes(&m, &aaben.id);
    let l_gammel = 38 + u32::from_le_bytes(gammel[34..38].try_into().unwrap()) as usize;
    let l_ny = 38 + u32::from_le_bytes(ny[34..38].try_into().unwrap()) as usize;
    // Nyt hoved med gammel krop: begge dele er gyldige hver for sig, men skrivetælleren passer ikke.
    let blandet = [&ny[..l_ny], &gammel[l_gammel..]].concat();
    std::fs::write(sti(&m.0, &aaben.id), &blandet).unwrap();
    assert!(matches!(a.aabn(&aaben.id), Err(SagFejl::Beskadiget)));
}

#[test]
fn ukendt_version() {
    let m = Mappe::ny();
    let (a, _) = arkiv(&m);
    let (data, _) = sag_med_tekst();
    let id = a.opret(NAVN, None, &data, 1).unwrap().id;
    let mut b = bytes(&m, &id);
    b[8..10].copy_from_slice(&2u16.to_le_bytes());
    std::fs::write(sti(&m.0, &id), &b).unwrap();
    assert_eq!(a.aabn(&id).err(), Some(SagFejl::UkendtVersion { version: 2 }));
    assert!(matches!(&a.liste().unwrap()[0].hoved, Err(SagFejl::UkendtVersion { version: 2 })));
    b[0] = b'X';
    std::fs::write(sti(&m.0, &id), &b).unwrap();
    assert_eq!(a.aabn(&id).err(), Some(SagFejl::Beskadiget));
}

#[test]
fn manglende_noegle_og_noegle_uden_fil() {
    let m = Mappe::ny();
    let (a, lager) = arkiv(&m);
    let (data, _) = sag_med_tekst();
    let id = a.opret(NAVN, None, &data, 1).unwrap().id;
    // Fil uden nøgle: kan ikke åbnes, vises i listen med årsag, og filen er ikke slettet.
    lager.slet(&id).unwrap();
    assert_eq!(a.aabn(&id).err(), Some(SagFejl::ManglerNoegle));
    assert!(matches!(&a.liste().unwrap()[0].hoved, Err(SagFejl::ManglerNoegle)));
    assert!(sti(&m.0, &id).exists(), "filen slettes aldrig automatisk");
    // Nøgle uden fil.
    let id2 = a.opret("Anden", None, &data, 1).unwrap().id;
    std::fs::remove_file(sti(&m.0, &id2)).unwrap();
    assert_eq!(a.aabn(&id2).err(), Some(SagFejl::ManglerFil));
    assert!(lager.har(&id2));
    assert_eq!(a.liste().unwrap().len(), 1);
}

#[test]
fn afbrudt_skrivning_efterlader_den_gamle_fil_intakt() {
    let m = Mappe::ny();
    let (a, _) = arkiv(&m);
    let (data, maskeret) = sag_med_tekst();
    let aaben = a.opret(NAVN, None, &data, 1).unwrap();
    let foer = bytes(&m, &aaben.id);
    // Skrivningen afbrydes lige før omdøbningen (som et nedbrud eller en fuld disk).
    let mut h = aaben.hoved.clone();
    h.navn = "Må ikke gemmes".into();
    let r = a.gem_med(&aaben, &mut h, &SagData::default(), &mut || Err(std::io::Error::other("afbrudt")));
    assert!(matches!(r, Err(SagFejl::Disk { .. })));
    assert_eq!(bytes(&m, &aaben.id), foer, "den gamle fil er uændret");
    assert_eq!(std::fs::read_dir(&m.0).unwrap().count(), 1, "ingen midlertidig fil efterladt");
    let (igen, d) = a.aabn(&aaben.id).unwrap();
    assert_eq!(igen.hoved.navn, NAVN);
    assert_eq!(demasker(&maskeret, &Sag::fra_data(d).unwrap()).0, TEKST);
    // En midlertidig fil fra et nedbrud (kun chiffertekst) forstyrrer hverken listen eller åbningen.
    std::fs::write(m.0.join(format!(".{}.deadbeef.tmp", aaben.id.hex())), &foer[..100]).unwrap();
    assert_eq!(ider(&m.0).unwrap(), [aaben.id]);
    // Uden afbrydelse lykkes samme skrivning.
    let mut h2 = aaben.hoved.clone();
    h2.navn = "Gemt".into();
    let mut aaben = aaben;
    a.gem(&mut aaben, h2, &data).unwrap();
    assert_eq!(a.aabn(&aaben.id).unwrap().0.hoved.navn, "Gemt");
}

#[test]
fn skrivetaeller_konflikt_overskriver_intet() {
    let m = Mappe::ny();
    let (a, _) = arkiv(&m);
    let (data, _) = sag_med_tekst();
    let id = a.opret(NAVN, None, &data, 1).unwrap().id;
    // To vinduer åbner samme sag.
    let (mut v1, d1) = a.aabn(&id).unwrap();
    let (mut v2, d2) = a.aabn(&id).unwrap();
    let mut h1 = v1.hoved.clone();
    h1.navn = "Vindue 1".into();
    a.gem(&mut v1, h1, &d1).unwrap();
    let efter1 = bytes(&m, &id);
    let mut h2 = v2.hoved.clone();
    h2.navn = "Vindue 2".into();
    assert_eq!(a.gem(&mut v2, h2, &d2).err(), Some(SagFejl::Konflikt));
    assert_eq!(bytes(&m, &id), efter1, "intet er overskrevet");
    assert_eq!(v2.hoved.navn, NAVN, "vindue 2's hoved er uændret");
    assert_eq!(a.aabn(&id).unwrap().0.hoved.navn, "Vindue 1");
}

#[test]
fn slet_fjerner_fil_og_noegle() {
    let m = Mappe::ny();
    let (a, lager) = arkiv(&m);
    let (data, _) = sag_med_tekst();
    let id = a.opret(NAVN, None, &data, 1).unwrap().id;
    let id2 = a.opret("Bliver", None, &data, 1).unwrap().id;
    a.slet(&id).unwrap();
    assert!(!sti(&m.0, &id).exists() && !lager.har(&id));
    assert!(sti(&m.0, &id2).exists() && lager.har(&id2));
    assert_eq!(lager.antal(), 1);
    // En sag uden nøgle (eller uden fil) kan også slettes.
    lager.slet(&id2).unwrap();
    a.slet(&id2).unwrap();
    assert!(!sti(&m.0, &id2).exists());
    assert!(a.liste().unwrap().is_empty());
}

#[test]
fn fejlbeskeder_indeholder_ingen_originaler_navn_eller_sti() {
    let m = Mappe::ny();
    let (a, lager) = arkiv(&m);
    let (data, _) = sag_med_tekst();
    let id = a.opret(NAVN, None, &data, 1).unwrap().id;
    let mut fejl = Vec::new();
    lager.byt_til_tilfaeldig(&id).unwrap();
    fejl.push(a.aabn(&id).err().unwrap());
    lager.slet(&id).unwrap();
    fejl.push(a.aabn(&id).err().unwrap());
    let mut b = bytes(&m, &id);
    b[8] = 9;
    std::fs::write(sti(&m.0, &id), &b).unwrap();
    fejl.push(a.aabn(&id).err().unwrap());
    fejl.push(a.opret("", None, &data, 1).err().unwrap());
    fejl.push(a.opret(NAVN, Some("2026-02-30".into()), &data, 1).err().unwrap());
    // Mappen er en fil: diskfejlen må ikke nævne stien.
    let ugyldig = Arkiv::ny(sti(&m.0, &id), Box::new(HukommelsesLager::ny()));
    fejl.push(ugyldig.opret(NAVN, None, &data, 1).err().unwrap());
    fejl.push(SagFejl::Konflikt);
    assert!(fejl.len() == 7);
    let mappe = m.0.to_string_lossy().to_string();
    for f in &fejl {
        let tekster = [format!("{f:?}"), serde_json::to_string(f).unwrap()];
        for t in &tekster {
            for o in ORIGINALER.iter().copied().chain([NAVN, mappe.as_str(), "kunde7"]) {
                assert!(!t.contains(o), "fejlen {t} nævner en værdi fra sagen");
            }
        }
    }
}

#[test]
fn navn_dato_id_og_noeglering_konto() {
    assert_eq!(rens_navn("  Sag 1 ").unwrap(), "Sag 1");
    assert!(rens_navn("   ").is_err() && rens_navn("a\nb").is_err() && rens_navn(&"x".repeat(121)).is_err());
    for ok in ["2026-11-10", "2028-02-29", "2000-02-29", "9999-12-31"] {
        assert!(tjek_dato(ok).is_ok(), "{ok}");
    }
    for forkert in [
        "2026-02-29",
        "1900-02-29",
        "2026-13-01",
        "2026-00-10",
        "2026-11-31",
        "26-11-10",
        "2026/11/10",
        "2026-1-10",
        "1999-12-31",
    ] {
        assert!(tjek_dato(forkert).is_err(), "{forkert}");
    }
    let id = SagsId::ny().unwrap();
    assert_eq!(id.hex().len(), 32);
    assert_eq!(SagsId::fra_hex(&id.hex()).unwrap(), id);
    assert_eq!(SagsId::fra_hex(&id.hex().to_uppercase()).unwrap(), id);
    assert!(SagsId::fra_hex("../x").is_err() && SagsId::fra_hex(&"g".repeat(32)).is_err());
    assert_ne!(SagsId::ny().unwrap(), id);
    assert_eq!(id.konto(), format!("sag:{}", id.hex()));
    assert_eq!(TJENESTE, "com.wi24rd.grimnir");
}

#[test]
fn laes_og_skriv_direkte() {
    // Lavniveau: skriv_med uden afbrydelse og laes giver samme hoved og data tilbage.
    let m = Mappe::ny();
    let (data, maskeret) = sag_med_tekst();
    let id = SagsId::ny().unwrap();
    let n = Noegle::ny().unwrap();
    let h = Hoved {
        navn: NAVN.into(),
        oprettet: 5,
        sidst_brugt: 6,
        udloeb: None,
        poster: data.poster.len(),
        skrivetaeller: 3,
    };
    skriv_med(&m.0, &id, &n, &h, &data, &mut || Ok(())).unwrap();
    let (h2, d2) = laes(&m.0, &id, &n).unwrap();
    assert!(h2 == h);
    assert_eq!(demasker(&maskeret, &Sag::fra_data(d2).unwrap()).0, TEKST);
    assert!(laes_hoved(&m.0, &id, &n).unwrap() == h);
}

#[test]
fn sags_id_er_bundet_til_filen_ogsaa_med_samme_noegle() {
    // Hver sag har sin egen nøgle, så en flyttet del fejler allerede på nøglen. Her bruges samme nøgle til to sager,
    // så kun de tilknyttede data (magi ‖ version ‖ sags-id ‖ del) kan afvise filen under det forkerte id.
    let m = Mappe::ny();
    let (data, _) = sag_med_tekst();
    let (ida, idb) = (SagsId::ny().unwrap(), SagsId::ny().unwrap());
    let n = Noegle::ny().unwrap();
    let h = Hoved {
        navn: NAVN.into(),
        oprettet: 1,
        sidst_brugt: 1,
        udloeb: None,
        poster: data.poster.len(),
        skrivetaeller: 1,
    };
    skriv_med(&m.0, &ida, &n, &h, &data, &mut || Ok(())).unwrap();
    std::fs::copy(sti(&m.0, &ida), sti(&m.0, &idb)).unwrap();
    assert!(laes(&m.0, &ida, &n).is_ok());
    assert!(matches!(laes(&m.0, &idb, &n), Err(SagFejl::Beskadiget)));
    assert!(matches!(laes_hoved(&m.0, &idb, &n), Err(SagFejl::Beskadiget)));
}
