//! Sager på disk (V-SAG.1, G2; ADR D7, D8, D13): én krypteret fil pr. sag, nøglen i Keychain/Credential Manager.
//!
//! **Filen** `<app-data>/sager/<sags-id>.grimnir`. Sags-id er 16 tilfældige bytes som 32 hextegn; det siger intet om
//! indholdet. Opbygning (formatversion 1), alle tal little-endian:
//!
//! | Byte | Længde | Indhold |
//! |---|---|---|
//! | 0 | 8 | magisk streng `GRIMNIRS` (klartekst) |
//! | 8 | 2 | formatversion, `u16` (klartekst) |
//! | 10 | 24 | hovedets nonce (tilfældig, ny ved hver skrivning) |
//! | 34 | 4 | hovedets længde `L1` i bytes, `u32` |
//! | 38 | `L1` | hovedet: XChaCha20-Poly1305-chiffertekst med 16 bytes mærke til sidst |
//! | 38+`L1` | 24 | kroppens nonce |
//! | 62+`L1` | 8 | kroppens længde `L2`, `u64` |
//! | 70+`L1` | `L2` | kroppen: chiffertekst med mærke |
//!
//! Filen slutter præcis dér. Tilknyttede data (AAD) for hver del: magisk streng ‖ version ‖ identitet ‖ `hoved` eller
//! `krop`. Identiteten er sags-id'et (16 bytes) for en sag og de 6 bytes `ordbog` for ordbogen ([`Ident`], V-ORDBOG.1).
//! En del kan derfor hverken flyttes til en anden sags fil, bytte plads med den anden del eller lægges ind som ordbog
//! (og omvendt). Samme kode læser og skriver begge slags filer ([`byg_krypteret`], [`laes_krypteret`],
//! [`skriv_atomart`]).
//! **Hovedet** (navn, oprettet, sidst brugt, udløb, antal poster, skrivetæller) kan læses uden kroppen, så listen kan
//! vises. **Kroppen** er hele sagen: hovedet igen og sagens data. Skrivetælleren står i begge og skal være ens, så et
//! hoved og en krop fra to forskellige skrivninger ikke kan sættes sammen.
//!
//! **Nøglen** er 32 tilfældige bytes pr. sag under tjenesten `com.wi24rd.grimnir`, kontoen `sag:<sags-id>`. Den forlader
//! aldrig Rust og ligger i [`Noegle`], der nulstilles, når den slippes. Nøglelageret er et trait ([`Noeglelager`]): tests
//! bruger [`HukommelsesLager`] og rører aldrig den rigtige Keychain.
//!
//! **Skrivning** er atomar: en ny fil i samme mappe (kun chiffertekst) skrives, synkroniseres og omdøbes til sagens
//! fil. Før hver skrivning sammenlignes skrivetælleren i filens hoved med den, sagen blev læst med (D8): er filen
//! ændret et andet sted, afvises skrivningen, og intet overskrives. Sammenligning og omdøbning sker under en låsefil
//! (`.<navn>.lock`, oprettet med `create_new` og fjernet igen; V-ORDBOG.1 O7), så to skrivninger ikke kan krydse
//! hinanden. En efterladt lås, der er ældre end 30 sekunder, må overtages.
//!
//! **Klarteksten** (JSON) skrives til en buffer med anslået kapacitet ([`NulstilBuffer`]); bliver den for lille, flyttes
//! indholdet til en større buffer, og den gamle nulstilles, før den slippes.
//!
//! **Oprydning:** efterladte midlertidige filer (`.<navn>.<8 hextegn>.tmp`, kun chiffertekst eller indstillinger), der
//! er ældre end en time, slettes ved start ([`ryd_midlertidige`]).
//!
//! **Fejl** ([`SagFejl`]) indeholder hverken originaler, koder, navne eller stier.

use std::collections::HashMap;
use std::fs::{self, File, OpenOptions};
use std::io::{self, Read, Write};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{Duration, Instant, SystemTime};

use chacha20poly1305::aead::{Aead, Generate, Payload};
use chacha20poly1305::{KeyInit, XChaCha20Poly1305, XNonce};
use grimnir_core::{Enhed, Klasse, Original, Post, SagData, Taellere, Valg, KLASSER};
use serde::{Deserialize, Serialize};
use zeroize::{Zeroize, Zeroizing};

/// Den magiske streng i starten af hver sagsfil.
pub const MAGI: &[u8; 8] = b"GRIMNIRS";
/// Filformatets version (D13: fra start, så eksport med adgangssætning kan komme i v2).
pub const FORMATVERSION: u16 = 1;
/// Tjenesten i Keychain/Credential Manager.
pub const TJENESTE: &str = "com.wi24rd.grimnir";
/// Sagsfilernes endelse.
pub const ENDELSE: &str = "grimnir";
/// Længste sagsnavn i tegn.
pub const MAKS_NAVN: usize = 120;

/// Ordbogens faste identitet i AAD (V-ORDBOG.1 O1). Seks bytes, så den aldrig kan forveksles med et sags-id (16 bytes).
pub const ORDBOG_IDENT: &[u8; 6] = b"ordbog";
/// En lås ældre end dette er efterladt (programmet gik ned under en skrivning) og må overtages.
pub const LAAS_FORAELDET: Duration = Duration::from_secs(30);
/// Så længe venter en skrivning på en lås, en anden holder, før den giver op med [`SagFejl::Optaget`].
pub const LAAS_VENT: Duration = Duration::from_secs(2);
/// Midlertidige filer ældre end dette slettes ved start.
pub const MIDLERTIDIG_FORAELDET: Duration = Duration::from_secs(60 * 60);

const NONCE: usize = 24;
const FAST: usize = 8 + 2; // magi + version
/// Største hoved, der læses (et hoved er et navn og nogle tal; alt over dette er en beskadiget fil).
const MAKS_HOVED: u32 = 64 * 1024;

// ------------------------------------------------------------------------------------------------------- fejl

/// Fejl med sager på disk. Ingen variant indeholder originaler, koder, navne eller stier.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(tag = "art", rename_all = "snake_case")]
pub enum SagFejl {
    /// Filen har en formatversion, denne udgave af Grimnir ikke kender.
    UkendtVersion {
        /// Versionen i filen.
        version: u16,
    },
    /// Filen er beskadiget eller ændret: forkert magisk streng, forkert længde, AEAD-fejl (forkert nøgle, ændret byte,
    /// en del fra en anden fil) eller indhold, der ikke kan læses.
    Beskadiget,
    /// Filen findes, men nøglen mangler i nøgleringen (fil uden nøgle).
    ManglerNoegle,
    /// Nøglen findes måske, men filen gør ikke (nøgle uden fil), eller sagen findes ikke.
    ManglerFil,
    /// Sagen er ændret et andet sted (skrivetælleren passer ikke). Intet er overskrevet.
    Konflikt,
    /// Filen gemmes lige nu et andet sted (låsefilen er i brug). Intet er overskrevet; prøv igen.
    Optaget,
    /// Nøgleringen kunne ikke bruges.
    Noeglering {
        /// `ingen_adgang` | `platform` | `andet`
        hvad: &'static str,
    },
    /// Disken: `io::ErrorKind` som tekst (fx `PermissionDenied`), aldrig stien.
    Disk {
        /// Fejlens art.
        hvad: String,
    },
    /// Navnet er tomt, for langt eller har styretegn.
    UgyldigtNavn,
    /// Udløbsdatoen er ikke en gyldig dato på formen ÅÅÅÅ-MM-DD.
    UgyldigDato,
    /// Ukendt sags-id.
    UgyldigtId,
    /// Styresystemets tilfældige tal kunne ikke hentes.
    Tilfaeldighed,
}

impl From<io::Error> for SagFejl {
    fn from(e: io::Error) -> Self {
        if e.kind() == io::ErrorKind::NotFound {
            SagFejl::ManglerFil
        } else {
            SagFejl::Disk {
                hvad: format!("{:?}", e.kind()),
            }
        }
    }
}

// ------------------------------------------------------------------------------------------------------- id og nøgle

/// En sags id: 16 tilfældige bytes. Vises som 32 hextegn (filnavn og konto i nøgleringen).
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub struct SagsId([u8; 16]);

impl SagsId {
    /// Et nyt, tilfældigt id.
    pub fn ny() -> Result<Self, SagFejl> {
        <[u8; 16]>::try_generate().map(SagsId).map_err(|_| SagFejl::Tilfaeldighed)
    }

    /// Id som 32 små hextegn.
    pub fn hex(&self) -> String {
        self.0.iter().map(|b| format!("{b:02x}")).collect()
    }

    /// Læser 32 hextegn (små eller store).
    pub fn fra_hex(s: &str) -> Result<Self, SagFejl> {
        let b = s.as_bytes();
        if b.len() != 32 || !b.iter().all(u8::is_ascii_hexdigit) {
            return Err(SagFejl::UgyldigtId);
        }
        let mut id = [0u8; 16];
        for (i, x) in id.iter_mut().enumerate() {
            *x = u8::from_str_radix(&s[2 * i..2 * i + 2], 16).map_err(|_| SagFejl::UgyldigtId)?;
        }
        Ok(SagsId(id))
    }

    /// Kontoen i nøgleringen.
    pub fn konto(&self) -> String {
        format!("sag:{}", self.hex())
    }

    fn bytes(&self) -> &[u8; 16] {
        &self.0
    }
}

/// En sags nøgle (32 bytes). Nulstilles, når den slippes. Har bevidst hverken `Debug` eller `Clone`.
pub struct Noegle(Zeroizing<[u8; 32]>);

impl Noegle {
    /// En ny, tilfældig nøgle fra styresystemet.
    pub fn ny() -> Result<Self, SagFejl> {
        let mut n = Zeroizing::new([0u8; 32]);
        let mut tilfaeldig = <[u8; 32]>::try_generate().map_err(|_| SagFejl::Tilfaeldighed)?;
        n.copy_from_slice(&tilfaeldig);
        tilfaeldig.zeroize();
        Ok(Noegle(n))
    }

    /// Nøglen fra bytes (nøglelageret). Bytes nulstilles af kalderen.
    pub fn fra_bytes(b: &[u8]) -> Result<Self, SagFejl> {
        if b.len() != 32 {
            return Err(SagFejl::Beskadiget);
        }
        let mut n = Zeroizing::new([0u8; 32]);
        n.copy_from_slice(b);
        Ok(Noegle(n))
    }

    fn bytes(&self) -> &[u8] {
        &self.0[..]
    }

    fn chiffer(&self) -> XChaCha20Poly1305 {
        // Chifferen kopierer nøglen og nulstiller sin kopi, når den slippes (chacha20poly1305 med `zeroize`).
        XChaCha20Poly1305::new_from_slice(self.bytes()).expect("nøglen er 32 bytes")
    }
}

// ------------------------------------------------------------------------------------------------------- nøglelager

/// Hvor nøglerne ligger. Den rigtige udgave er [`Noeglering`]; tests bruger [`HukommelsesLager`].
///
/// Nøglerne står under en konto i tjenesten [`TJENESTE`]: `sag:<sags-id>` for en sag og `ordbog` for ordbogen
/// (V-ORDBOG.1). `hent`, `gem` og `slet` er genveje for en sag.
pub trait Noeglelager: Send + Sync {
    /// Henter nøglen for kontoen. [`SagFejl::ManglerNoegle`], hvis den ikke findes.
    fn hent_konto(&self, konto: &str) -> Result<Noegle, SagFejl>;
    /// Gemmer nøglen under kontoen (overskriver en, der findes).
    fn gem_konto(&self, konto: &str, noegle: &Noegle) -> Result<(), SagFejl>;
    /// Sletter kontoens nøgle. En nøgle, der ikke findes, er ikke en fejl.
    fn slet_konto(&self, konto: &str) -> Result<(), SagFejl>;

    /// Henter sagens nøgle.
    fn hent(&self, id: &SagsId) -> Result<Noegle, SagFejl> {
        self.hent_konto(&id.konto())
    }
    /// Gemmer sagens nøgle (en ny sag).
    fn gem(&self, id: &SagsId, noegle: &Noegle) -> Result<(), SagFejl> {
        self.gem_konto(&id.konto(), noegle)
    }
    /// Sletter sagens nøgle.
    fn slet(&self, id: &SagsId) -> Result<(), SagFejl> {
        self.slet_konto(&id.konto())
    }
}

/// Keychain (macOS) og Credential Manager (Windows) via `keyring` 3.6.3.
pub struct Noeglering;

fn noeglering_fejl(e: keyring::Error) -> SagFejl {
    match e {
        keyring::Error::NoEntry => SagFejl::ManglerNoegle,
        keyring::Error::NoStorageAccess(_) => SagFejl::Noeglering { hvad: "ingen_adgang" },
        keyring::Error::PlatformFailure(_) => SagFejl::Noeglering { hvad: "platform" },
        _ => SagFejl::Noeglering { hvad: "andet" },
    }
}

impl Noeglelager for Noeglering {
    fn hent_konto(&self, konto: &str) -> Result<Noegle, SagFejl> {
        let post = keyring::Entry::new(TJENESTE, konto).map_err(noeglering_fejl)?;
        let mut b = Zeroizing::new(post.get_secret().map_err(noeglering_fejl)?);
        let n = Noegle::fra_bytes(&b);
        b.zeroize();
        n
    }

    fn gem_konto(&self, konto: &str, noegle: &Noegle) -> Result<(), SagFejl> {
        let post = keyring::Entry::new(TJENESTE, konto).map_err(noeglering_fejl)?;
        post.set_secret(noegle.bytes()).map_err(noeglering_fejl)
    }

    fn slet_konto(&self, konto: &str) -> Result<(), SagFejl> {
        let post = keyring::Entry::new(TJENESTE, konto).map_err(noeglering_fejl)?;
        match post.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(e) => Err(noeglering_fejl(e)),
        }
    }
}

/// Et nøglelager i hukommelsen til tests. Rører aldrig den rigtige Keychain.
#[derive(Default)]
pub struct HukommelsesLager(Mutex<HashMap<String, Zeroizing<[u8; 32]>>>);

impl HukommelsesLager {
    /// Et tomt lager.
    pub fn ny() -> Self {
        HukommelsesLager::default()
    }

    fn laas(&self) -> std::sync::MutexGuard<'_, HashMap<String, Zeroizing<[u8; 32]>>> {
        self.0.lock().unwrap_or_else(|e| e.into_inner())
    }

    /// Antal nøgler (til tests).
    pub fn antal(&self) -> usize {
        self.laas().len()
    }

    /// Sand, hvis der er en nøgle for sagen (til tests).
    pub fn har(&self, id: &SagsId) -> bool {
        self.har_konto(&id.konto())
    }

    /// Sand, hvis der er en nøgle under kontoen (til tests).
    pub fn har_konto(&self, konto: &str) -> bool {
        self.laas().contains_key(konto)
    }

    /// Lægger en anden, tilfældig nøgle ind for sagen (test: forkert nøgle).
    pub fn byt_til_tilfaeldig(&self, id: &SagsId) -> Result<(), SagFejl> {
        let n = Noegle::ny()?;
        self.gem(id, &n)
    }
}

impl Noeglelager for HukommelsesLager {
    fn hent_konto(&self, konto: &str) -> Result<Noegle, SagFejl> {
        let l = self.laas();
        let n = l.get(konto).ok_or(SagFejl::ManglerNoegle)?;
        Noegle::fra_bytes(&n[..])
    }

    fn gem_konto(&self, konto: &str, noegle: &Noegle) -> Result<(), SagFejl> {
        let mut n = Zeroizing::new([0u8; 32]);
        n.copy_from_slice(noegle.bytes());
        self.laas().insert(konto.to_string(), n);
        Ok(())
    }

    fn slet_konto(&self, konto: &str) -> Result<(), SagFejl> {
        self.laas().remove(konto);
        Ok(())
    }
}

impl<T: Noeglelager + ?Sized> Noeglelager for std::sync::Arc<T> {
    fn hent_konto(&self, konto: &str) -> Result<Noegle, SagFejl> {
        (**self).hent_konto(konto)
    }
    fn gem_konto(&self, konto: &str, noegle: &Noegle) -> Result<(), SagFejl> {
        (**self).gem_konto(konto, noegle)
    }
    fn slet_konto(&self, konto: &str) -> Result<(), SagFejl> {
        (**self).slet_konto(konto)
    }
}

// ------------------------------------------------------------------------------------------------------- hovedet

/// Sagens hoved: det, listen viser. Har bevidst ikke `Debug` (navnet er brugerens tekst).
#[derive(Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Hoved {
    /// Sagens navn.
    pub navn: String,
    /// Oprettet (millisekunder siden 1970, UTC).
    pub oprettet: u64,
    /// Sidst gemt (millisekunder siden 1970, UTC).
    pub sidst_brugt: u64,
    /// Udløbsdato `ÅÅÅÅ-MM-DD` eller ingen.
    pub udloeb: Option<String>,
    /// Antal poster (stavemåder med kode).
    pub poster: usize,
    /// Skrivetæller: én mere ved hver skrivning (D8).
    pub skrivetaeller: u64,
}

/// Kontrollerer og renser et sagsnavn: trimmet, 1–[`MAKS_NAVN`] tegn, uden styretegn.
pub fn rens_navn(navn: &str) -> Result<String, SagFejl> {
    let n = navn.trim();
    if n.is_empty() || n.chars().count() > MAKS_NAVN || n.chars().any(char::is_control) {
        return Err(SagFejl::UgyldigtNavn);
    }
    Ok(n.to_string())
}

/// Kontrollerer en udløbsdato `ÅÅÅÅ-MM-DD` (gregoriansk, år 2000–9999).
pub fn tjek_dato(d: &str) -> Result<(), SagFejl> {
    let b = d.as_bytes();
    let tal = |r: std::ops::Range<usize>| {
        d.get(r)
            .filter(|s| s.bytes().all(|c| c.is_ascii_digit()))
            .and_then(|s| s.parse::<u32>().ok())
    };
    if b.len() != 10 || b[4] != b'-' || b[7] != b'-' {
        return Err(SagFejl::UgyldigDato);
    }
    let (Some(aar), Some(md), Some(dag)) = (tal(0..4), tal(5..7), tal(8..10)) else {
        return Err(SagFejl::UgyldigDato);
    };
    let skud = (aar % 4 == 0 && aar % 100 != 0) || aar % 400 == 0;
    let dage = match md {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 if skud => 29,
        2 => 28,
        _ => 0,
    };
    if !(2000..=9999).contains(&aar) || dag == 0 || dag > dage {
        return Err(SagFejl::UgyldigDato);
    }
    Ok(())
}

// ------------------------------------------------------------------------------------------------------- sagens data som JSON

/// Sagens data til JSON. Lånte felter, så originalerne ikke kopieres en ekstra gang før krypteringen.
#[derive(Serialize)]
struct DataUd<'a> {
    valg: (bool, bool),
    enheder: Vec<(usize, &'a str, &'a str)>,
    poster: Vec<(usize, &'a str, &'a str, u8, bool)>,
    net4: Vec<(&'a str, u32)>,
    net6: Vec<(&'a str, u64)>,
    vaerter4: &'a [(u32, u32)],
    iid6: &'a [(u64, u64)],
    sid_domaener: Vec<&'a str>,
    taellere: (&'a [u64], u32, u64, u64, u64),
    reserverede_navne: &'a [String],
    reserverede_ip4: &'a [u32],
    reserverede_ip6: Vec<String>,
    reserverede_mac: &'a [u64],
    overloeb_meldt: u8,
    rettede_koder: &'a [String],
    aliaser: &'a [(String, usize)],
}

/// Sagens data fra JSON. Strengene flyttes ind i kernens typer uden kopi.
#[derive(Deserialize)]
struct DataInd {
    valg: (bool, bool),
    enheder: Vec<(usize, String, String)>,
    poster: Vec<(usize, String, String, u8, bool)>,
    net4: Vec<(String, u32)>,
    net6: Vec<(String, u64)>,
    vaerter4: Vec<(u32, u32)>,
    iid6: Vec<(u64, u64)>,
    sid_domaener: Vec<String>,
    taellere: (Vec<u64>, u32, u64, u64, u64),
    reserverede_navne: Vec<String>,
    reserverede_ip4: Vec<u32>,
    reserverede_ip6: Vec<String>,
    reserverede_mac: Vec<u64>,
    overloeb_meldt: u8,
    rettede_koder: Vec<String>,
    aliaser: Vec<(String, usize)>,
}

#[derive(Serialize)]
struct KropUd<'a> {
    hoved: &'a Hoved,
    data: DataUd<'a>,
}

#[derive(Deserialize)]
struct KropInd {
    hoved: Hoved,
    data: DataInd,
}

fn data_ud(d: &SagData) -> DataUd<'_> {
    DataUd {
        valg: (d.valg.masker_fremmede, d.valg.bevar_sidste_oktet),
        enheder: d
            .enheder
            .iter()
            .map(|e| (e.klasse.nr(), e.noegle.som_tekst(), e.grundform.as_str()))
            .collect(),
        poster: d
            .poster
            .iter()
            .map(|p| (p.enhed, p.original.som_tekst(), p.kode.as_str(), p.former, p.rettet))
            .collect(),
        net4: d.net4.iter().map(|(n, m)| (n.som_tekst(), *m)).collect(),
        net6: d.net6.iter().map(|(n, m)| (n.som_tekst(), *m)).collect(),
        vaerter4: &d.vaerter4,
        iid6: &d.iid6,
        sid_domaener: d.sid_domaener.iter().map(Original::som_tekst).collect(),
        taellere: (
            &d.taellere.navne,
            d.taellere.net4,
            d.taellere.pulje4,
            d.taellere.net6,
            d.taellere.mac,
        ),
        reserverede_navne: &d.reserverede_navne,
        reserverede_ip4: &d.reserverede_ip4,
        reserverede_ip6: d.reserverede_ip6.iter().map(|v| format!("{v:032x}")).collect(),
        reserverede_mac: &d.reserverede_mac,
        overloeb_meldt: d.overloeb_meldt,
        rettede_koder: &d.rettede_koder,
        aliaser: &d.aliaser,
    }
}

fn data_ind(d: DataInd) -> Result<SagData, SagFejl> {
    let klasse = |nr: usize| Klasse::ALLE.get(nr).copied().ok_or(SagFejl::Beskadiget);
    let mut navne = [0u64; KLASSER];
    if d.taellere.0.len() != KLASSER {
        return Err(SagFejl::Beskadiget);
    }
    navne.copy_from_slice(&d.taellere.0);
    let mut enheder = Vec::with_capacity(d.enheder.len());
    for (k, noegle, grundform) in d.enheder {
        enheder.push(Enhed {
            klasse: klasse(k)?,
            noegle: Original::ny(noegle),
            grundform,
        });
    }
    let mut ip6 = Vec::with_capacity(d.reserverede_ip6.len());
    for v in &d.reserverede_ip6 {
        ip6.push(u128::from_str_radix(v, 16).map_err(|_| SagFejl::Beskadiget)?);
    }
    Ok(SagData {
        valg: Valg {
            masker_fremmede: d.valg.0,
            bevar_sidste_oktet: d.valg.1,
        },
        enheder,
        poster: d
            .poster
            .into_iter()
            .map(|(enhed, o, kode, former, rettet)| Post {
                enhed,
                original: Original::ny(o),
                kode,
                former,
                rettet,
            })
            .collect(),
        net4: d.net4.into_iter().map(|(n, m)| (Original::ny(n), m)).collect(),
        net6: d.net6.into_iter().map(|(n, m)| (Original::ny(n), m)).collect(),
        vaerter4: d.vaerter4,
        iid6: d.iid6,
        sid_domaener: d.sid_domaener.into_iter().map(Original::ny).collect(),
        taellere: Taellere {
            navne,
            net4: d.taellere.1,
            pulje4: d.taellere.2,
            net6: d.taellere.3,
            mac: d.taellere.4,
        },
        reserverede_navne: d.reserverede_navne,
        reserverede_ip4: d.reserverede_ip4,
        reserverede_ip6: ip6,
        reserverede_mac: d.reserverede_mac,
        overloeb_meldt: d.overloeb_meldt,
        rettede_koder: d.rettede_koder,
        aliaser: d.aliaser,
    })
}

/// Nulstiller alle strenge i sagens data og slipper dem (når en sag lukkes). Kernens typer har ingen `Zeroize`, men
/// strengene kan tages ud og nulstilles her. Kopier, der er lavet undervejs (kladder i `maskering`), er allerede sluppet
/// uden nulstilling; se HANDOFF-V-SAG.1 "hvad der ikke nulstilles".
pub fn nulstil(d: SagData) {
    for p in d.poster {
        p.original.til_tekst().zeroize();
        let mut k = p.kode;
        k.zeroize();
    }
    for e in d.enheder {
        e.noegle.til_tekst().zeroize();
        let mut g = e.grundform;
        g.zeroize();
    }
    for (n, _) in d.net4 {
        n.til_tekst().zeroize();
    }
    for (n, _) in d.net6 {
        n.til_tekst().zeroize();
    }
    for s in d.sid_domaener {
        s.til_tekst().zeroize();
    }
    for mut s in d.reserverede_navne.into_iter().chain(d.rettede_koder) {
        s.zeroize();
    }
    for (mut s, _) in d.aliaser {
        s.zeroize();
    }
}

// ------------------------------------------------------------------------------------------------------- filen

/// Sagsfilens sti.
pub fn sti(mappe: &Path, id: &SagsId) -> PathBuf {
    mappe.join(format!("{}.{ENDELSE}", id.hex()))
}

/// Hvem en krypteret fil tilhører. Indgår i AAD, så en sagsfil ikke kan læses som ordbog og omvendt.
#[derive(Clone, Copy)]
pub enum Ident<'a> {
    /// En sag (sags-id'et, 16 bytes).
    Sag(&'a SagsId),
    /// Ordbogen ([`ORDBOG_IDENT`]).
    Ordbog,
}

impl Ident<'_> {
    fn bytes(&self) -> &[u8] {
        match self {
            Ident::Sag(id) => id.bytes(),
            Ident::Ordbog => ORDBOG_IDENT,
        }
    }
}

fn aad(ident: Ident<'_>, del: &[u8]) -> Vec<u8> {
    let i = ident.bytes();
    let mut a = Vec::with_capacity(FAST + i.len() + del.len());
    a.extend_from_slice(MAGI);
    a.extend_from_slice(&FORMATVERSION.to_le_bytes());
    a.extend_from_slice(i);
    a.extend_from_slice(del);
    a
}

fn krypter(noegle: &Noegle, ident: Ident<'_>, del: &[u8], klar: &[u8]) -> Result<(XNonce, Vec<u8>), SagFejl> {
    let nonce = XNonce::try_generate().map_err(|_| SagFejl::Tilfaeldighed)?;
    let aad = aad(ident, del);
    // `encrypt` kopierer klarteksten til en buffer med plads til mærket og krypterer den på stedet (aead 0.6.1,
    // `Aead::encrypt`), så der ikke står en ekstra kopi af klarteksten tilbage.
    let c = noegle
        .chiffer()
        .encrypt(&nonce, Payload { msg: klar, aad: &aad })
        .map_err(|_| SagFejl::Beskadiget)?;
    Ok((nonce, c))
}

fn dekrypter(noegle: &Noegle, ident: Ident<'_>, del: &[u8], nonce: &[u8], c: &[u8]) -> Result<Zeroizing<Vec<u8>>, SagFejl> {
    let nonce = XNonce::try_from(nonce).map_err(|_| SagFejl::Beskadiget)?;
    let aad = aad(ident, del);
    noegle
        .chiffer()
        .decrypt(&nonce, Payload { msg: c, aad: &aad })
        .map(Zeroizing::new)
        .map_err(|_| SagFejl::Beskadiget)
}

/// En skrivebuffer til klartekst. Den starter med en anslået kapacitet; bliver den for lille, kopieres indholdet til
/// en ny buffer med dobbelt kapacitet, og den gamle nulstilles (hele kapaciteten), før den slippes. Nulstilles også, når
/// den selv slippes. `serde_json::to_writer` skriver direkte hertil uden egne mellemliggende buffere på heapen.
pub struct NulstilBuffer {
    buf: Vec<u8>,
    vaekst: usize,
}

impl NulstilBuffer {
    /// En buffer med kapaciteten `anslaaet`.
    pub fn med_kapacitet(anslaaet: usize) -> Self {
        NulstilBuffer {
            buf: Vec::with_capacity(anslaaet.max(64)),
            vaekst: 0,
        }
    }

    /// Indholdet.
    pub fn bytes(&self) -> &[u8] {
        &self.buf
    }

    /// Antal gange, bufferen var for lille (til tests og målinger).
    pub fn vaekst(&self) -> usize {
        self.vaekst
    }
}

impl Write for NulstilBuffer {
    fn write(&mut self, b: &[u8]) -> io::Result<usize> {
        let behov = self.buf.len() + b.len();
        if behov > self.buf.capacity() {
            let mut ny = Vec::with_capacity(behov.max(self.buf.capacity() * 2));
            ny.extend_from_slice(&self.buf);
            // `Vec::zeroize` nulstiller hele kapaciteten, også den ubrugte del (zeroize 1.9.1).
            self.buf.zeroize();
            self.buf = ny;
            self.vaekst += 1;
        }
        self.buf.extend_from_slice(b);
        Ok(b.len())
    }

    fn flush(&mut self) -> io::Result<()> {
        Ok(())
    }
}

impl Drop for NulstilBuffer {
    fn drop(&mut self) {
        self.buf.zeroize();
    }
}

/// Et JSON-dokument i en [`NulstilBuffer`] med den anslåede kapacitet.
pub fn json_klar<T: Serialize + ?Sized>(v: &T, anslaaet: usize) -> Result<NulstilBuffer, SagFejl> {
    let mut b = NulstilBuffer::med_kapacitet(anslaaet);
    serde_json::to_writer(&mut b, v).map_err(|_| SagFejl::Beskadiget)?;
    Ok(b)
}

/// Hele filens bytes for et hoved og en krop i klartekst (JSON). Fælles for sager og ordbogen.
pub fn byg_krypteret(noegle: &Noegle, ident: Ident<'_>, hoved_klar: &[u8], krop_klar: &[u8]) -> Result<Vec<u8>, SagFejl> {
    let (n1, c1) = krypter(noegle, ident, b"hoved", hoved_klar)?;
    let (n2, c2) = krypter(noegle, ident, b"krop", krop_klar)?;
    let l1 = u32::try_from(c1.len()).map_err(|_| SagFejl::Beskadiget)?;
    let mut ud = Vec::with_capacity(FAST + 2 * NONCE + 12 + c1.len() + c2.len());
    ud.extend_from_slice(MAGI);
    ud.extend_from_slice(&FORMATVERSION.to_le_bytes());
    ud.extend_from_slice(&n1);
    ud.extend_from_slice(&l1.to_le_bytes());
    ud.extend_from_slice(&c1);
    ud.extend_from_slice(&n2);
    ud.extend_from_slice(&(c2.len() as u64).to_le_bytes());
    ud.extend_from_slice(&c2);
    Ok(ud)
}

/// Anslået længde af sagens krop som JSON: strengene to gange (plads til escapes) og en fast mængde pr. post. Er
/// anslaget for lavt, vokser [`NulstilBuffer`] og nulstiller den gamle buffer.
pub fn anslaa_krop(hoved: &Hoved, d: &SagData) -> usize {
    let s = |x: &str| 2 * x.len() + 8;
    let mut n = 1024 + s(&hoved.navn) + hoved.udloeb.as_deref().map_or(0, s);
    n += d.poster.iter().map(|p| s(p.original.som_tekst()) + s(&p.kode) + 24).sum::<usize>();
    n += d
        .enheder
        .iter()
        .map(|e| s(e.noegle.som_tekst()) + s(&e.grundform) + 16)
        .sum::<usize>();
    n += d.net4.iter().map(|(x, _)| s(x.som_tekst()) + 16).sum::<usize>();
    n += d.net6.iter().map(|(x, _)| s(x.som_tekst()) + 26).sum::<usize>();
    n += d.vaerter4.len() * 26 + d.iid6.len() * 46 + d.reserverede_ip4.len() * 12 + d.reserverede_ip6.len() * 36;
    n += d.reserverede_mac.len() * 22 + KLASSER * 21;
    n += d.sid_domaener.iter().map(|x| s(x.som_tekst())).sum::<usize>();
    n += d.reserverede_navne.iter().chain(&d.rettede_koder).map(|x| s(x)).sum::<usize>();
    n += d.aliaser.iter().map(|(x, _)| s(x) + 24).sum::<usize>();
    n
}

/// Hele filens bytes for et hoved og en sag. Klarteksten (JSON) nulstilles efter krypteringen.
fn byg_fil(noegle: &Noegle, id: &SagsId, hoved: &Hoved, data: &SagData) -> Result<Vec<u8>, SagFejl> {
    let hoved_klar = json_klar(hoved, 2 * hoved.navn.len() + 256)?;
    let krop_klar = json_klar(
        &KropUd {
            hoved,
            data: data_ud(data),
        },
        anslaa_krop(hoved, data),
    )?;
    byg_krypteret(noegle, Ident::Sag(id), hoved_klar.bytes(), krop_klar.bytes())
}

fn tjek_start(start: &[u8]) -> Result<(), SagFejl> {
    if start.len() < FAST || &start[..8] != MAGI {
        return Err(SagFejl::Beskadiget);
    }
    let v = u16::from_le_bytes([start[8], start[9]]);
    if v != FORMATVERSION {
        return Err(SagFejl::UkendtVersion { version: v });
    }
    Ok(())
}

/// Læser og dekrypterer kun hovedet (starten af filen). Fælles for sager og ordbogen.
pub fn laes_krypteret_hoved(fil: &Path, ident: Ident<'_>, noegle: &Noegle) -> Result<Zeroizing<Vec<u8>>, SagFejl> {
    let mut f = File::open(fil)?;
    let mut start = [0u8; FAST + NONCE + 4];
    if f.read_exact(&mut start[..FAST]).is_err() {
        return Err(SagFejl::Beskadiget);
    }
    tjek_start(&start[..FAST])?;
    f.read_exact(&mut start[FAST..]).map_err(|_| SagFejl::Beskadiget)?;
    let l1 = u32::from_le_bytes(start[FAST + NONCE..].try_into().map_err(|_| SagFejl::Beskadiget)?);
    if l1 > MAKS_HOVED {
        return Err(SagFejl::Beskadiget);
    }
    let mut c1 = vec![0u8; l1 as usize];
    f.read_exact(&mut c1).map_err(|_| SagFejl::Beskadiget)?;
    dekrypter(noegle, ident, b"hoved", &start[FAST..FAST + NONCE], &c1)
}

/// Hoved og krop i klartekst; nulstilles, når de slippes.
pub type Klartekst = (Zeroizing<Vec<u8>>, Zeroizing<Vec<u8>>);

/// Læser og dekrypterer hele filen: (hoved, krop) i klartekst. Filen skal slutte præcis efter kroppen.
pub fn laes_krypteret(fil: &Path, ident: Ident<'_>, noegle: &Noegle) -> Result<Klartekst, SagFejl> {
    let b = fs::read(fil)?;
    tjek_start(&b)?;
    let del = |fra: usize, til: usize| b.get(fra..til).ok_or(SagFejl::Beskadiget);
    let mut pos = FAST;
    let n1 = del(pos, pos + NONCE)?;
    pos += NONCE;
    let l1 = u32::from_le_bytes(del(pos, pos + 4)?.try_into().map_err(|_| SagFejl::Beskadiget)?) as usize;
    pos += 4;
    let c1 = del(pos, pos + l1)?;
    pos += l1;
    let n2 = del(pos, pos + NONCE)?;
    pos += NONCE;
    let l2 = u64::from_le_bytes(del(pos, pos + 8)?.try_into().map_err(|_| SagFejl::Beskadiget)?);
    pos += 8;
    let l2 = usize::try_from(l2).map_err(|_| SagFejl::Beskadiget)?;
    let c2 = del(pos, pos.checked_add(l2).ok_or(SagFejl::Beskadiget)?)?;
    if pos + l2 != b.len() {
        return Err(SagFejl::Beskadiget);
    }
    let hoved = dekrypter(noegle, ident, b"hoved", n1, c1)?;
    let krop = dekrypter(noegle, ident, b"krop", n2, c2)?;
    Ok((hoved, krop))
}

/// Læser kun hovedet (starten af filen).
pub fn laes_hoved(mappe: &Path, id: &SagsId, noegle: &Noegle) -> Result<Hoved, SagFejl> {
    let klar = laes_krypteret_hoved(&sti(mappe, id), Ident::Sag(id), noegle)?;
    serde_json::from_slice(&klar).map_err(|_| SagFejl::Beskadiget)
}

/// Læser hele sagen. Hoved og krop skal have samme skrivetæller.
pub fn laes(mappe: &Path, id: &SagsId, noegle: &Noegle) -> Result<(Hoved, SagData), SagFejl> {
    let (hoved_klar, krop_klar) = laes_krypteret(&sti(mappe, id), Ident::Sag(id), noegle)?;
    let hoved: Hoved = serde_json::from_slice(&hoved_klar).map_err(|_| SagFejl::Beskadiget)?;
    let krop: KropInd = serde_json::from_slice(&krop_klar).map_err(|_| SagFejl::Beskadiget)?;
    drop(krop_klar);
    if krop.hoved != hoved {
        return Err(SagFejl::Beskadiget);
    }
    let data = data_ind(krop.data)?;
    Ok((hoved, data))
}

/// Filnavnet uden endelse (`<sags-id>`, `ordbog`, `indstillinger`): stammen i navnene på midlertidige filer og låse.
fn stamme(fil: &Path) -> String {
    fil.file_stem().and_then(|s| s.to_str()).unwrap_or("fil").to_string()
}

/// Skriver filen atomart: en ny fil i samme mappe (`.<stamme>.<8 hextegn>.tmp`), synkroniseret og omdøbt til filen.
/// `foer_omdoeb` kaldes lige før omdøbningen (tests afbryder dér). Fælles for sager, ordbogen og indstillingerne.
pub fn skriv_atomart(fil: &Path, bytes: &[u8], foer_omdoeb: &mut dyn FnMut() -> io::Result<()>) -> Result<(), SagFejl> {
    skriv_atomart_med(fil, &mut |f| f.write_all(bytes), foer_omdoeb)
}

/// Som [`skriv_atomart`], men indholdet skrives af `skriv` i stykker (V-FIL.1: en fil på op til 100 MiB kodes til
/// UTF-16 undervejs i stedet for at blive kopieret hel først).
pub fn skriv_atomart_med(
    fil: &Path,
    skriv: &mut dyn FnMut(&mut File) -> io::Result<()>,
    foer_omdoeb: &mut dyn FnMut() -> io::Result<()>,
) -> Result<(), SagFejl> {
    let mappe = fil.parent().ok_or(SagFejl::Disk { hvad: "NotFound".into() })?;
    let tilfaeldig = SagsId::ny()?;
    let midl = mappe.join(format!(".{}.{}.tmp", stamme(fil), &tilfaeldig.hex()[..8]));
    let resultat = (|| -> io::Result<()> {
        let mut f = OpenOptions::new().write(true).create_new(true).open(&midl)?;
        skriv(&mut f)?;
        f.sync_all()?;
        drop(f);
        foer_omdoeb()?;
        fs::rename(&midl, fil)?;
        // Omdøbningen er først sikker på disken, når mappen er synkroniseret (kun muligt på Unix).
        #[cfg(unix)]
        File::open(mappe)?.sync_all()?;
        Ok(())
    })();
    if resultat.is_err() {
        let _ = fs::remove_file(&midl);
    }
    resultat.map_err(SagFejl::from)
}

/// Låsefilens sti for en fil: `.<stamme>.lock` i samme mappe.
pub fn laas_sti(fil: &Path) -> PathBuf {
    fil.with_file_name(format!(".{}.lock", stamme(fil)))
}

/// En taget lås. Låsefilen fjernes, når låsen slippes.
pub struct Laas(PathBuf);

impl Drop for Laas {
    fn drop(&mut self) {
        let _ = fs::remove_file(&self.0);
    }
}

fn foraeldet(fil: &Path, graense: Duration, nu: SystemTime) -> bool {
    fs::metadata(fil)
        .and_then(|m| m.modified())
        .ok()
        .and_then(|t| nu.duration_since(t).ok())
        .is_some_and(|alder| alder >= graense)
}

/// Tager låsen for en fil: opretter `.<stamme>.lock` med `create_new` (atomart: kun én kan oprette den). Holder en
/// anden låsen, ventes der op til [`LAAS_VENT`]; derefter [`SagFejl::Optaget`]. En lås ældre end [`LAAS_FORAELDET`]
/// er efterladt og overtages (én gang pr. forsøg).
pub fn tag_laas(fil: &Path) -> Result<Laas, SagFejl> {
    let sti = laas_sti(fil);
    let start = Instant::now();
    let mut overtaget = false;
    loop {
        match OpenOptions::new().write(true).create_new(true).open(&sti) {
            Ok(_) => return Ok(Laas(sti)),
            Err(e) if e.kind() == io::ErrorKind::AlreadyExists => {
                if !overtaget && foraeldet(&sti, LAAS_FORAELDET, SystemTime::now()) {
                    overtaget = true;
                    let _ = fs::remove_file(&sti);
                    continue;
                }
                if start.elapsed() >= LAAS_VENT {
                    return Err(SagFejl::Optaget);
                }
                std::thread::sleep(Duration::from_millis(20));
            }
            Err(e) => return Err(e.into()),
        }
    }
}

/// Et navn på en midlertidig fil fra [`skriv_atomart`]: `.<stamme>.<8 små hextegn>.tmp`, hvor stammen er et sags-id
/// (32 små hextegn), `ordbog` eller `indstillinger`.
fn er_midlertidig(navn: &str) -> bool {
    let Some(midt) = navn.strip_prefix('.').and_then(|n| n.strip_suffix(".tmp")) else {
        return false;
    };
    let Some((stamme, hex)) = midt.rsplit_once('.') else {
        return false;
    };
    let lille_hex = |s: &str| s.bytes().all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b));
    let stamme_ok = (stamme.len() == 32 && lille_hex(stamme)) || stamme == "ordbog" || stamme == "indstillinger";
    hex.len() == 8 && lille_hex(hex) && stamme_ok
}

/// Sletter efterladte midlertidige filer i mappen, der er ældre end [`MIDLERTIDIG_FORAELDET`] (målt mod `nu`). Andre
/// filer røres ikke. Svarer med antallet, der er slettet.
pub fn ryd_midlertidige(mappe: &Path, nu: SystemTime) -> usize {
    let Ok(laeser) = fs::read_dir(mappe) else { return 0 };
    let mut slettet = 0;
    for e in laeser.flatten() {
        let navn = e.file_name();
        let Some(navn) = navn.to_str() else { continue };
        let p = e.path();
        if er_midlertidig(navn) && p.is_file() && foraeldet(&p, MIDLERTIDIG_FORAELDET, nu) && fs::remove_file(&p).is_ok() {
            slettet += 1;
        }
    }
    slettet
}

/// Skriver sagen (ny fil eller overskrivning), uden kontrol af skrivetælleren.
pub fn skriv(mappe: &Path, id: &SagsId, noegle: &Noegle, hoved: &Hoved, data: &SagData) -> Result<(), SagFejl> {
    skriv_med(mappe, id, noegle, hoved, data, &mut || Ok(()))
}

/// Som [`skriv`], med et kald lige før omdøbningen. Kun til tests (en afbrudt skrivning).
#[doc(hidden)]
pub fn skriv_med(
    mappe: &Path,
    id: &SagsId,
    noegle: &Noegle,
    hoved: &Hoved,
    data: &SagData,
    foer_omdoeb: &mut dyn FnMut() -> io::Result<()>,
) -> Result<(), SagFejl> {
    let bytes = byg_fil(noegle, id, hoved, data)?;
    skriv_atomart(&sti(mappe, id), &bytes, foer_omdoeb)
}

/// Opretter mappen (kun ejeren har adgang på Unix).
pub fn opret_mappe(mappe: &Path) -> Result<(), SagFejl> {
    fs::create_dir_all(mappe)?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(mappe, fs::Permissions::from_mode(0o700))?;
    }
    Ok(())
}

/// Id'erne på sagsfilerne i mappen (filer med et gyldigt id og endelsen `.grimnir`; midlertidige filer springes over).
pub fn ider(mappe: &Path) -> Result<Vec<SagsId>, SagFejl> {
    let mut ud = Vec::new();
    let laeser = match fs::read_dir(mappe) {
        Ok(l) => l,
        Err(e) if e.kind() == io::ErrorKind::NotFound => return Ok(ud),
        Err(e) => return Err(e.into()),
    };
    for e in laeser.flatten() {
        let navn = e.file_name();
        let Some(navn) = navn.to_str() else { continue };
        if let Some(hex) = navn.strip_suffix(&format!(".{ENDELSE}")) {
            if let Ok(id) = SagsId::fra_hex(hex) {
                if hex == id.hex() {
                    ud.push(id);
                }
            }
        }
    }
    ud.sort_by_key(SagsId::hex);
    Ok(ud)
}

// ------------------------------------------------------------------------------------------------------- arkivet

/// En åben, navngiven sag: id, hovedet som læst eller sidst skrevet, og nøglen.
pub struct AabenSag {
    /// Sagens id.
    pub id: SagsId,
    /// Hovedet, som filen havde, da sagen blev læst eller sidst skrevet herfra.
    pub hoved: Hoved,
    noegle: Noegle,
}

/// Én linje i listen.
pub struct ListePost {
    /// Sagens id.
    pub id: SagsId,
    /// Hovedet, eller årsagen til, at det ikke kan læses.
    pub hoved: Result<Hoved, SagFejl>,
}

/// Sagerne på disk: mappen og nøglelageret.
pub struct Arkiv {
    mappe: PathBuf,
    lager: Box<dyn Noeglelager>,
}

impl Arkiv {
    /// Et arkiv i mappen med nøglelageret.
    pub fn ny(mappe: PathBuf, lager: Box<dyn Noeglelager>) -> Self {
        Arkiv { mappe, lager }
    }

    /// Mappen.
    pub fn mappe(&self) -> &Path {
        &self.mappe
    }

    /// Opretter en ny sag med data: ny nøgle i nøglelageret og ny fil. Fejler skrivningen, slettes nøglen igen.
    pub fn opret(&self, navn: &str, udloeb: Option<String>, data: &SagData, nu: u64) -> Result<AabenSag, SagFejl> {
        let navn = rens_navn(navn)?;
        if let Some(d) = &udloeb {
            tjek_dato(d)?;
        }
        opret_mappe(&self.mappe)?;
        let id = SagsId::ny()?;
        let noegle = Noegle::ny()?;
        let hoved = Hoved {
            navn,
            oprettet: nu,
            sidst_brugt: nu,
            udloeb,
            poster: data.poster.len(),
            skrivetaeller: 1,
        };
        self.lager.gem(&id, &noegle)?;
        if let Err(e) = skriv(&self.mappe, &id, &noegle, &hoved, data) {
            let _ = self.lager.slet(&id);
            return Err(e);
        }
        Ok(AabenSag { id, hoved, noegle })
    }

    /// Åbner en sag: henter nøglen og læser hele filen.
    pub fn aabn(&self, id: &SagsId) -> Result<(AabenSag, SagData), SagFejl> {
        if !sti(&self.mappe, id).exists() {
            return Err(SagFejl::ManglerFil);
        }
        let noegle = self.lager.hent(id)?;
        let (hoved, data) = laes(&self.mappe, id, &noegle)?;
        Ok((AabenSag { id: *id, hoved, noegle }, data))
    }

    /// Gemmer en åben sag med nyt hoved. Afvises med [`SagFejl::Konflikt`], hvis filens skrivetæller ikke er den, sagen
    /// blev læst med; så er intet overskrevet. Lykkes det, har `aaben` det nye hoved.
    pub fn gem(&self, aaben: &mut AabenSag, mut hoved: Hoved, data: &SagData) -> Result<(), SagFejl> {
        self.gem_med(aaben, &mut hoved, data, &mut || Ok(()))?;
        aaben.hoved = hoved;
        Ok(())
    }

    /// Som [`Arkiv::gem`] med et kald før omdøbningen (tests). Kontrollen af skrivetælleren og omdøbningen sker under
    /// sagens låsefil, så en anden skrivning ikke kan komme imellem (V-ORDBOG.1 O7).
    #[doc(hidden)]
    pub fn gem_med(
        &self,
        aaben: &AabenSag,
        hoved: &mut Hoved,
        data: &SagData,
        foer_omdoeb: &mut dyn FnMut() -> io::Result<()>,
    ) -> Result<(), SagFejl> {
        let _laas = tag_laas(&sti(&self.mappe, &aaben.id))?;
        let paa_disk = laes_hoved(&self.mappe, &aaben.id, &aaben.noegle)?;
        if paa_disk.skrivetaeller != aaben.hoved.skrivetaeller {
            return Err(SagFejl::Konflikt);
        }
        hoved.skrivetaeller = aaben.hoved.skrivetaeller + 1;
        hoved.poster = data.poster.len();
        skriv_med(&self.mappe, &aaben.id, &aaben.noegle, hoved, data, foer_omdoeb)
    }

    /// Ændrer hovedet på en sag, der ikke er åben her (omdøb, udløb): læser hele filen og skriver den igen. "Sidst
    /// brugt" ændres ikke af det.
    pub fn ret_hoved(&self, id: &SagsId, aendr: impl FnOnce(&mut Hoved)) -> Result<(), SagFejl> {
        let (mut aaben, data) = self.aabn(id)?;
        let mut hoved = aaben.hoved.clone();
        aendr(&mut hoved);
        let r = self.gem(&mut aaben, hoved, &data);
        nulstil(data);
        r
    }

    /// Listen: hvert id med hovedet eller årsagen til, at det ikke kan læses. Intet slettes.
    pub fn liste(&self) -> Result<Vec<ListePost>, SagFejl> {
        let mut ud = Vec::new();
        for id in ider(&self.mappe)? {
            let hoved = self.lager.hent(&id).and_then(|n| laes_hoved(&self.mappe, &id, &n));
            ud.push(ListePost { id, hoved });
        }
        Ok(ud)
    }

    /// Sletter sagens fil og nøgle. En sag uden fil eller uden nøgle kan også slettes.
    pub fn slet(&self, id: &SagsId) -> Result<(), SagFejl> {
        match fs::remove_file(sti(&self.mappe, id)) {
            Ok(()) => {}
            Err(e) if e.kind() == io::ErrorKind::NotFound => {}
            Err(e) => return Err(e.into()),
        }
        #[cfg(unix)]
        if let Ok(m) = File::open(&self.mappe) {
            let _ = m.sync_all();
        }
        self.lager.slet(id)
    }
}
