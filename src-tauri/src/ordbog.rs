//! Ordbogen på disk (V-ORDBOG.1 O1, O2; ADR D7): brugerens domæner, NetBIOS-domæner, navnemønstre, egne net, ord og
//! personer, der altid maskeres, og værdier, der aldrig maskeres, på tværs af sager.
//!
//! **Filen** `<app-data>/ordbog.grimnir` har samme format som en sag (se [`crate::sager`]): magisk streng `GRIMNIRS`,
//! formatversion 1, et krypteret hoved og en krypteret krop, XChaCha20-Poly1305, atomar skrivning under en låsefil og
//! en skrivetæller i begge dele. Koden er sagernes ([`byg_krypteret`], [`laes_krypteret`], [`skriv_atomart`],
//! [`tag_laas`]); kun indholdet er ordbogens. AAD er magisk streng ‖ version ‖ `ordbog` ‖ `hoved`/`krop`
//! ([`Ident::Ordbog`]), så en sagsfil ikke kan læses som ordbog og omvendt.
//!
//! **Nøglen** står i nøgleringen under tjenesten `com.wi24rd.grimnir`, kontoen `ordbog`.
//!
//! **Hovedet** er antal poster pr. type og skrivetælleren; **kroppen** er hovedet igen og posterne (type, værdi,
//! valgfri note, oprettet). Ordbogen er følsom (den er en liste over brugerens egne domæner og navne): den står aldrig i
//! klartekst på disk, og fejlene her ([`FeltFejl`], [`SagFejl`]) indeholder hverken værdier eller noter.

use std::path::{Path, PathBuf};

use grimnir_core::{analyser as kerne_analyser, Art, Ordbog};
use serde::{Deserialize, Serialize};
use zeroize::Zeroize;

use crate::sager::{
    byg_krypteret, json_klar, laes_krypteret, laes_krypteret_hoved, opret_mappe, skriv_atomart, tag_laas, Ident, Noegle, Noeglelager,
    SagFejl,
};

/// Filens navn i `<app-data>`.
pub const FILNAVN: &str = "ordbog.grimnir";
/// Kontoen i nøgleringen (tjenesten er [`crate::sager::TJENESTE`]).
pub const KONTO: &str = "ordbog";
/// Længste værdi i tegn (et DNS-navn er højst 253).
pub const MAKS_VAERDI: usize = 253;
/// Længste note i tegn.
pub const MAKS_NOTE: usize = 200;

// ------------------------------------------------------------------------------------------------------- typer

/// En posts type. De første seks er "maskér altid"; [`PostType::Aldrig`] er "maskér aldrig".
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PostType {
    /// DNS-domæne med punktum (`kontor.test`).
    Domaene,
    /// NetBIOS-domæne uden punktum (`KONTOR`).
    Netbios,
    /// Navnemønster for maskiner (`srv-###`, `WS-*`).
    Navnemoenster,
    /// Eget net i CIDR-form eller én adresse (`10.20.0.0/16`).
    EgetNet,
    /// Ord (projekt- og kundenavne).
    Ord,
    /// Person.
    Person,
    /// Maskér aldrig.
    Aldrig,
}

impl PostType {
    /// Alle typer i fast rækkefølge (hovedets antal står i denne rækkefølge).
    pub const ALLE: [PostType; 7] = [
        PostType::Domaene,
        PostType::Netbios,
        PostType::Navnemoenster,
        PostType::EgetNet,
        PostType::Ord,
        PostType::Person,
        PostType::Aldrig,
    ];

    /// Navnet til UI'et og filen.
    pub fn navn(self) -> &'static str {
        match self {
            PostType::Domaene => "domaene",
            PostType::Netbios => "netbios",
            PostType::Navnemoenster => "navnemoenster",
            PostType::EgetNet => "eget_net",
            PostType::Ord => "ord",
            PostType::Person => "person",
            PostType::Aldrig => "aldrig",
        }
    }

    /// Typen ud fra navnet.
    pub fn fra_navn(s: &str) -> Option<Self> {
        PostType::ALLE.into_iter().find(|t| t.navn() == s)
    }

    /// Sand for "maskér altid".
    pub fn altid(self) -> bool {
        self != PostType::Aldrig
    }

    fn nr(self) -> usize {
        PostType::ALLE.iter().position(|t| *t == self).unwrap_or(0)
    }
}

/// Én post i ordbogen. Har bevidst ikke `Debug` (værdien er følsom).
#[derive(Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct OrdbogPost {
    /// Postens id (fast, så længe posten findes).
    pub id: u64,
    /// Typen.
    #[serde(rename = "type")]
    pub type_: PostType,
    /// Værdien eller mønstret.
    pub vaerdi: String,
    /// Valgfri note.
    pub note: Option<String>,
    /// Oprettet (ms siden 1970, UTC).
    pub oprettet: u64,
}

/// En valideringsfejl i ét felt. Indeholder hverken værdien eller noten.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct FeltFejl {
    /// `type` | `vaerdi` | `note` | `id`
    pub felt: &'static str,
    /// `ukendt_type` | `tom` | `for_lang` | `for_kort` | `styretegn` | `ugyldigt_domaene` | `ugyldigt_netbios` |
    /// `ugyldigt_moenster` | `ugyldigt_net` | `for_bredt_net` | `dublet` | `modstrid` | `hemmelighed` | `ukendt_post`
    pub fejl: &'static str,
}

/// En feltfejl.
pub fn felt(felt: &'static str, fejl: &'static str) -> FeltFejl {
    FeltFejl { felt, fejl }
}

// ------------------------------------------------------------------------------------------------------- validering

fn er_domaene(v: &str) -> bool {
    let dele: Vec<&str> = v.split('.').collect();
    dele.len() >= 2
        && dele.iter().all(|d| {
            !d.is_empty()
                && d.len() <= 63
                && d.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-')
                && !d.starts_with('-')
                && !d.ends_with('-')
        })
}

fn er_netbios(v: &str) -> bool {
    (1..=15).contains(&v.len()) && v.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
}

/// Et navnemønster: kun `#`, `*`, bogstaver (a–z), cifre og `-`, mindst ét bogstav, højst 63 tegn.
fn er_moenster(v: &str) -> bool {
    v.len() <= 63
        && v.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'#' || b == b'*')
        && v.bytes().any(|b| b.is_ascii_alphabetic())
}

/// Præfikslængden for et net (`/p`; en enkelt adresse er /32).
fn praefiks(v: &str) -> Option<u32> {
    match v.split_once('/') {
        Some((_, p)) => p.parse().ok(),
        None => Some(32),
    }
}

/// Ligner værdien alene en hemmelighed for kernens genkendere (en lang tilfældig streng eller en kendt nøgleform)?
fn er_hemmelighed(v: &str) -> bool {
    kerne_analyser(v, &Ordbog::ny())
        .iter()
        .any(|f| matches!(f.art, Art::Hemmelighed | Art::Entropi) && f.start == 0 && f.slut == v.len())
}

/// Kontrollerer og renser en ny eller rettet post mod ordbogen. `undtagen` er postens eget id ved en rettelse.
/// Svarer med (værdi, note) trimmet, eller med fejlene pr. felt.
pub fn valider(
    poster: &[OrdbogPost],
    type_: PostType,
    vaerdi: &str,
    note: Option<&str>,
    undtagen: Option<u64>,
) -> Result<(String, Option<String>), Vec<FeltFejl>> {
    let mut fejl = Vec::new();
    let v = vaerdi.trim();
    let tegn = v.chars().count();
    if v.is_empty() {
        fejl.push(felt("vaerdi", "tom"));
    } else if v.chars().any(char::is_control) {
        fejl.push(felt("vaerdi", "styretegn"));
    } else if tegn > MAKS_VAERDI {
        fejl.push(felt("vaerdi", "for_lang"));
    } else {
        let form = match type_ {
            PostType::Domaene if !er_domaene(v) => Some("ugyldigt_domaene"),
            PostType::Netbios if !er_netbios(v) => Some("ugyldigt_netbios"),
            PostType::Navnemoenster if !er_moenster(v) => Some("ugyldigt_moenster"),
            PostType::EgetNet => {
                let o = Ordbog {
                    net: vec![v.to_string()],
                    ..Ordbog::ny()
                };
                if o.valider().is_err() {
                    Some("ugyldigt_net")
                } else if praefiks(v).is_some_and(|p| p < 8) {
                    Some("for_bredt_net")
                } else {
                    None
                }
            }
            PostType::Ord | PostType::Person if tegn < 2 => Some("for_kort"),
            _ => None,
        };
        if let Some(f) = form {
            fejl.push(felt("vaerdi", f));
        } else if type_ != PostType::EgetNet && er_hemmelighed(v) {
            fejl.push(felt("vaerdi", "hemmelighed"));
        } else {
            let lille = v.to_lowercase();
            let andre = || poster.iter().filter(|p| Some(p.id) != undtagen && p.vaerdi.to_lowercase() == lille);
            if andre().any(|p| p.type_.altid() == type_.altid()) {
                fejl.push(felt("vaerdi", "dublet"));
            } else if andre().any(|p| p.type_.altid() != type_.altid()) {
                fejl.push(felt("vaerdi", "modstrid"));
            }
        }
    }
    let n = note.map(str::trim).filter(|n| !n.is_empty());
    if let Some(n) = n {
        if n.chars().any(char::is_control) {
            fejl.push(felt("note", "styretegn"));
        } else if n.chars().count() > MAKS_NOTE {
            fejl.push(felt("note", "for_lang"));
        }
    }
    if fejl.is_empty() {
        Ok((v.to_string(), n.map(str::to_string)))
    } else {
        Err(fejl)
    }
}

/// Kernens ordbog ud fra posterne.
pub fn kerne_ordbog(poster: &[OrdbogPost]) -> Ordbog {
    let mut o = Ordbog::ny();
    for p in poster {
        let v = p.vaerdi.clone();
        match p.type_ {
            PostType::Domaene | PostType::Netbios => o.domaener.push(v),
            PostType::Navnemoenster => o.navnemoenstre.push(v),
            PostType::EgetNet => o.net.push(v),
            PostType::Ord => o.ord.push(v),
            PostType::Person => o.personer.push(v),
            PostType::Aldrig => o.aldrig.push(v),
        }
    }
    o
}

/// Nulstiller posternes værdier og noter i hukommelsen og slipper dem.
pub fn nulstil(poster: Vec<OrdbogPost>) {
    for mut p in poster {
        p.vaerdi.zeroize();
        if let Some(n) = p.note.as_mut() {
            n.zeroize();
        }
    }
}

/// Nulstiller kernens ordbog (en kopi til en analyse) og slipper den.
pub fn nulstil_kerne(o: Ordbog) {
    for mut s in o
        .domaener
        .into_iter()
        .chain(o.navnemoenstre)
        .chain(o.net)
        .chain(o.ord)
        .chain(o.personer)
        .chain(o.aldrig)
    {
        s.zeroize();
    }
}

// ------------------------------------------------------------------------------------------------------- filen

/// Ordbogens hoved: antal poster pr. type (i [`PostType::ALLE`]s rækkefølge) og skrivetælleren.
#[derive(Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Hoved {
    /// Antal poster pr. type.
    pub antal: [usize; 7],
    /// Skrivetæller: én mere ved hver skrivning.
    pub skrivetaeller: u64,
}

impl Hoved {
    fn for_poster(poster: &[OrdbogPost], skrivetaeller: u64) -> Self {
        let mut antal = [0usize; 7];
        for p in poster {
            antal[p.type_.nr()] += 1;
        }
        Hoved { antal, skrivetaeller }
    }
}

#[derive(Serialize)]
struct KropUd<'a> {
    hoved: &'a Hoved,
    poster: &'a [OrdbogPost],
}

#[derive(Deserialize)]
struct KropInd {
    hoved: Hoved,
    poster: Vec<OrdbogPost>,
}

/// Anslået længde af kroppen som JSON: værdier og noter to gange (plads til escapes) og 96 bytes pr. post.
pub fn anslaa_krop(poster: &[OrdbogPost]) -> usize {
    256 + poster
        .iter()
        .map(|p| 96 + 2 * p.vaerdi.len() + p.note.as_ref().map_or(0, |n| 2 * n.len()))
        .sum::<usize>()
}

/// Ordbogens fil og nøgle.
pub struct Ordbogsfil {
    mappe: PathBuf,
    lager: Box<dyn Noeglelager>,
}

impl Ordbogsfil {
    /// Ordbogen i mappen (`<app-data>`) med nøglelageret.
    pub fn ny(mappe: PathBuf, lager: Box<dyn Noeglelager>) -> Self {
        Ordbogsfil { mappe, lager }
    }

    /// Filens sti.
    pub fn sti(&self) -> PathBuf {
        sti(&self.mappe)
    }

    /// Læser ordbogen: (skrivetæller, poster). Findes filen ikke, er ordbogen tom (tæller 0). Nøglen hentes kun, når
    /// filen findes.
    pub fn laes(&self) -> Result<(u64, Vec<OrdbogPost>), SagFejl> {
        let fil = self.sti();
        if !fil.exists() {
            return Ok((0, Vec::new()));
        }
        let noegle = self.lager.hent_konto(KONTO)?;
        laes_fil(&fil, &noegle)
    }

    /// Gemmer posterne. `laest` er skrivetælleren, ordbogen blev læst med (0: ingen fil). Er filen ændret et andet
    /// sted, afvises det med [`SagFejl::Konflikt`], og intet overskrives. Svarer med den nye skrivetæller.
    pub fn gem(&self, laest: u64, poster: &[OrdbogPost]) -> Result<u64, SagFejl> {
        self.gem_med(laest, poster, &mut || Ok(()))
    }

    /// Som [`Ordbogsfil::gem`] med et kald før omdøbningen (tests).
    #[doc(hidden)]
    pub fn gem_med(&self, laest: u64, poster: &[OrdbogPost], foer_omdoeb: &mut dyn FnMut() -> std::io::Result<()>) -> Result<u64, SagFejl> {
        opret_mappe(&self.mappe)?;
        let fil = self.sti();
        let _laas = tag_laas(&fil)?;
        let noegle = if fil.exists() {
            let n = self.lager.hent_konto(KONTO)?;
            let klar = laes_krypteret_hoved(&fil, Ident::Ordbog, &n)?;
            let paa_disk: Hoved = serde_json::from_slice(&klar).map_err(|_| SagFejl::Beskadiget)?;
            if paa_disk.skrivetaeller != laest {
                return Err(SagFejl::Konflikt);
            }
            n
        } else {
            if laest != 0 {
                // Filen er slettet et andet sted, efter ordbogen blev læst.
                return Err(SagFejl::Konflikt);
            }
            // V-FIL.1 F5: findes nøglen allerede (fx efter "Start forfra", hvor den gamle fil er flyttet til side), bruges
            // den igen, så den flyttede fil stadig kan læses med den. Ellers en ny nøgle.
            match self.lager.hent_konto(KONTO) {
                Ok(n) => n,
                Err(SagFejl::ManglerNoegle) => {
                    let n = Noegle::ny()?;
                    self.lager.gem_konto(KONTO, &n)?;
                    n
                }
                Err(f) => return Err(f),
            }
        };
        let hoved = Hoved::for_poster(poster, laest + 1);
        let hoved_klar = json_klar(&hoved, 256)?;
        let krop_klar = json_klar(&KropUd { hoved: &hoved, poster }, anslaa_krop(poster))?;
        let bytes = byg_krypteret(&noegle, Ident::Ordbog, hoved_klar.bytes(), krop_klar.bytes())?;
        skriv_atomart(&fil, &bytes, foer_omdoeb)?;
        Ok(hoved.skrivetaeller)
    }
}

impl Ordbogsfil {
    /// V-FIL.1 F5, "Start forfra": flytter en ordbog, der ikke kan åbnes, til side som `ordbog.<dato>.ulaeselig` (med
    /// `-2`, `-3` … hvis navnet er taget) i samme mappe. Filen slettes ikke, og nøglen bliver i nøgleringen. Svarer med
    /// det nye filnavn (`None`, hvis der ingen fil var). `dato` er `ÅÅÅÅ-MM-DD` (kontrolleret af kalderen).
    pub fn flyt_ulaeselig(&self, dato: &str) -> Result<Option<String>, SagFejl> {
        let fil = self.sti();
        let _laas = tag_laas(&fil)?;
        if !fil.exists() {
            return Ok(None);
        }
        for n in 1..1000 {
            let navn = if n == 1 {
                format!("ordbog.{dato}.ulaeselig")
            } else {
                format!("ordbog.{dato}-{n}.ulaeselig")
            };
            let ny = self.mappe.join(&navn);
            if !ny.exists() {
                std::fs::rename(&fil, &ny)?;
                return Ok(Some(navn));
            }
        }
        Err(SagFejl::Disk {
            hvad: "AlreadyExists".into(),
        })
    }
}

/// Ordbogens sti i mappen.
pub fn sti(mappe: &Path) -> PathBuf {
    mappe.join(FILNAVN)
}

/// Læser en ordbogsfil med nøglen: (skrivetæller, poster). Hoved og krop skal passe sammen.
pub fn laes_fil(fil: &Path, noegle: &Noegle) -> Result<(u64, Vec<OrdbogPost>), SagFejl> {
    let (hoved_klar, krop_klar) = laes_krypteret(fil, Ident::Ordbog, noegle)?;
    let hoved: Hoved = serde_json::from_slice(&hoved_klar).map_err(|_| SagFejl::Beskadiget)?;
    let krop: KropInd = serde_json::from_slice(&krop_klar).map_err(|_| SagFejl::Beskadiget)?;
    drop(krop_klar);
    if krop.hoved != hoved || Hoved::for_poster(&krop.poster, hoved.skrivetaeller) != hoved {
        nulstil(krop.poster);
        return Err(SagFejl::Beskadiget);
    }
    Ok((hoved.skrivetaeller, krop.poster))
}
