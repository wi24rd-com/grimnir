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
//! Filen slutter præcis dér. Tilknyttede data (AAD) for hver del: magisk streng ‖ version ‖ sags-id (16 bytes) ‖
//! `hoved` eller `krop`. En del kan derfor hverken flyttes til en anden sags fil eller bytte plads med den anden del.
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
//! ændret et andet sted, afvises skrivningen, og intet overskrives.
//!
//! **Fejl** ([`SagFejl`]) indeholder hverken originaler, koder, navne eller stier.

use std::collections::HashMap;
use std::fs::{self, File, OpenOptions};
use std::io::{self, Read, Write};
use std::path::{Path, PathBuf};
use std::sync::Mutex;

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
pub trait Noeglelager: Send + Sync {
    /// Henter nøglen. [`SagFejl::ManglerNoegle`], hvis den ikke findes.
    fn hent(&self, id: &SagsId) -> Result<Noegle, SagFejl>;
    /// Gemmer nøglen (en ny sag).
    fn gem(&self, id: &SagsId, noegle: &Noegle) -> Result<(), SagFejl>;
    /// Sletter nøglen. En nøgle, der ikke findes, er ikke en fejl.
    fn slet(&self, id: &SagsId) -> Result<(), SagFejl>;
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
    fn hent(&self, id: &SagsId) -> Result<Noegle, SagFejl> {
        let post = keyring::Entry::new(TJENESTE, &id.konto()).map_err(noeglering_fejl)?;
        let mut b = Zeroizing::new(post.get_secret().map_err(noeglering_fejl)?);
        let n = Noegle::fra_bytes(&b);
        b.zeroize();
        n
    }

    fn gem(&self, id: &SagsId, noegle: &Noegle) -> Result<(), SagFejl> {
        let post = keyring::Entry::new(TJENESTE, &id.konto()).map_err(noeglering_fejl)?;
        post.set_secret(noegle.bytes()).map_err(noeglering_fejl)
    }

    fn slet(&self, id: &SagsId) -> Result<(), SagFejl> {
        let post = keyring::Entry::new(TJENESTE, &id.konto()).map_err(noeglering_fejl)?;
        match post.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(e) => Err(noeglering_fejl(e)),
        }
    }
}

/// Et nøglelager i hukommelsen til tests. Rører aldrig den rigtige Keychain.
#[derive(Default)]
pub struct HukommelsesLager(Mutex<HashMap<SagsId, Zeroizing<[u8; 32]>>>);

impl HukommelsesLager {
    /// Et tomt lager.
    pub fn ny() -> Self {
        HukommelsesLager::default()
    }

    fn laas(&self) -> std::sync::MutexGuard<'_, HashMap<SagsId, Zeroizing<[u8; 32]>>> {
        self.0.lock().unwrap_or_else(|e| e.into_inner())
    }

    /// Antal nøgler (til tests).
    pub fn antal(&self) -> usize {
        self.laas().len()
    }

    /// Sand, hvis der er en nøgle for sagen (til tests).
    pub fn har(&self, id: &SagsId) -> bool {
        self.laas().contains_key(id)
    }

    /// Lægger en anden, tilfældig nøgle ind for sagen (test: forkert nøgle).
    pub fn byt_til_tilfaeldig(&self, id: &SagsId) -> Result<(), SagFejl> {
        let n = Noegle::ny()?;
        self.gem(id, &n)
    }
}

impl Noeglelager for HukommelsesLager {
    fn hent(&self, id: &SagsId) -> Result<Noegle, SagFejl> {
        let l = self.laas();
        let n = l.get(id).ok_or(SagFejl::ManglerNoegle)?;
        Noegle::fra_bytes(&n[..])
    }

    fn gem(&self, id: &SagsId, noegle: &Noegle) -> Result<(), SagFejl> {
        let mut n = Zeroizing::new([0u8; 32]);
        n.copy_from_slice(noegle.bytes());
        self.laas().insert(*id, n);
        Ok(())
    }

    fn slet(&self, id: &SagsId) -> Result<(), SagFejl> {
        self.laas().remove(id);
        Ok(())
    }
}

impl<T: Noeglelager + ?Sized> Noeglelager for std::sync::Arc<T> {
    fn hent(&self, id: &SagsId) -> Result<Noegle, SagFejl> {
        (**self).hent(id)
    }
    fn gem(&self, id: &SagsId, noegle: &Noegle) -> Result<(), SagFejl> {
        (**self).gem(id, noegle)
    }
    fn slet(&self, id: &SagsId) -> Result<(), SagFejl> {
        (**self).slet(id)
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

fn aad(id: &SagsId, del: &[u8]) -> Vec<u8> {
    let mut a = Vec::with_capacity(FAST + 16 + del.len());
    a.extend_from_slice(MAGI);
    a.extend_from_slice(&FORMATVERSION.to_le_bytes());
    a.extend_from_slice(id.bytes());
    a.extend_from_slice(del);
    a
}

fn krypter(noegle: &Noegle, id: &SagsId, del: &[u8], klar: &[u8]) -> Result<(XNonce, Vec<u8>), SagFejl> {
    let nonce = XNonce::try_generate().map_err(|_| SagFejl::Tilfaeldighed)?;
    let aad = aad(id, del);
    let c = noegle
        .chiffer()
        .encrypt(&nonce, Payload { msg: klar, aad: &aad })
        .map_err(|_| SagFejl::Beskadiget)?;
    Ok((nonce, c))
}

fn dekrypter(noegle: &Noegle, id: &SagsId, del: &[u8], nonce: &[u8], c: &[u8]) -> Result<Zeroizing<Vec<u8>>, SagFejl> {
    let nonce = XNonce::try_from(nonce).map_err(|_| SagFejl::Beskadiget)?;
    let aad = aad(id, del);
    noegle
        .chiffer()
        .decrypt(&nonce, Payload { msg: c, aad: &aad })
        .map(Zeroizing::new)
        .map_err(|_| SagFejl::Beskadiget)
}

/// Hele filens bytes for et hoved og en sag. Klarteksten (JSON) nulstilles efter krypteringen.
fn byg_fil(noegle: &Noegle, id: &SagsId, hoved: &Hoved, data: &SagData) -> Result<Vec<u8>, SagFejl> {
    let hoved_klar = Zeroizing::new(serde_json::to_vec(hoved).map_err(|_| SagFejl::Beskadiget)?);
    let krop_klar = Zeroizing::new(
        serde_json::to_vec(&KropUd {
            hoved,
            data: data_ud(data),
        })
        .map_err(|_| SagFejl::Beskadiget)?,
    );
    let (n1, c1) = krypter(noegle, id, b"hoved", &hoved_klar)?;
    let (n2, c2) = krypter(noegle, id, b"krop", &krop_klar)?;
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

/// Læser kun hovedet (starten af filen).
pub fn laes_hoved(mappe: &Path, id: &SagsId, noegle: &Noegle) -> Result<Hoved, SagFejl> {
    let mut f = File::open(sti(mappe, id))?;
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
    let klar = dekrypter(noegle, id, b"hoved", &start[FAST..FAST + NONCE], &c1)?;
    serde_json::from_slice(&klar).map_err(|_| SagFejl::Beskadiget)
}

/// Læser hele sagen. Hoved og krop skal have samme skrivetæller.
pub fn laes(mappe: &Path, id: &SagsId, noegle: &Noegle) -> Result<(Hoved, SagData), SagFejl> {
    let b = fs::read(sti(mappe, id))?;
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
    let hoved_klar = dekrypter(noegle, id, b"hoved", n1, c1)?;
    let hoved: Hoved = serde_json::from_slice(&hoved_klar).map_err(|_| SagFejl::Beskadiget)?;
    let krop_klar = dekrypter(noegle, id, b"krop", n2, c2)?;
    let krop: KropInd = serde_json::from_slice(&krop_klar).map_err(|_| SagFejl::Beskadiget)?;
    drop(krop_klar);
    if krop.hoved != hoved {
        return Err(SagFejl::Beskadiget);
    }
    let data = data_ind(krop.data)?;
    Ok((hoved, data))
}

/// Skriver filen atomart: en ny fil i samme mappe med kun chiffertekst, synkroniseret, omdøbt til sagens fil.
/// `foer_omdoeb` kaldes lige før omdøbningen (tests afbryder dér).
fn skriv_atomart(mappe: &Path, id: &SagsId, bytes: &[u8], foer_omdoeb: &mut dyn FnMut() -> io::Result<()>) -> Result<(), SagFejl> {
    let tilfaeldig = SagsId::ny()?;
    let midl = mappe.join(format!(".{}.{}.tmp", id.hex(), &tilfaeldig.hex()[..8]));
    let resultat = (|| -> io::Result<()> {
        let mut f = OpenOptions::new().write(true).create_new(true).open(&midl)?;
        f.write_all(bytes)?;
        f.sync_all()?;
        drop(f);
        foer_omdoeb()?;
        fs::rename(&midl, sti(mappe, id))?;
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
    skriv_atomart(mappe, id, &bytes, foer_omdoeb)
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

    /// Som [`Arkiv::gem`] med et kald før omdøbningen (tests).
    #[doc(hidden)]
    pub fn gem_med(
        &self,
        aaben: &AabenSag,
        hoved: &mut Hoved,
        data: &SagData,
        foer_omdoeb: &mut dyn FnMut() -> io::Result<()>,
    ) -> Result<(), SagFejl> {
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
