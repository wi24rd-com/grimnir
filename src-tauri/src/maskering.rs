//! Maskering i skallen (V-SKAL.2, M2): sagen i hukommelsen og de fire handlinger, som kommandoerne i `lib.rs` kalder.
//!
//! Alt her er rene funktioner over [`Tilstand`], så de kan testes uden vindue (`tests/m2_kommandoer.rs`). Sagen lever
//! kun i hukommelsen; intet skrives til disk, og intet her skriver til log eller konsol.
//!
//! **Rækker.** Tabellen i UI'et har én række pr. enhed (én maskine, én bruger, én adresse), ikke pr. forekomst. Rækkerne
//! findes ved et "fuldt" gennemløb på en kopi af sagen, hvor alt, kernen finder, får en kode (også `Tjek selv`,
//! `Version` og fremmede adresser). Rækkens id er byte-positionen for enhedens første forekomst; den ændrer sig ikke,
//! når brugeren slår rækker til og fra.
//!
//! **Koderne.** Derefter et gennemløb på en ny kopi med kun de valgte rækker, præcis som `gem_og_masker` gør det. Så
//! er de koder, tabellen viser, de koder, der bliver gemt. En fravalgt række holdes ude af kernens trin F1 (sagens
//! kendte originaler) ved at stå på en midlertidig "maskér aldrig"-liste, som også gives til lækagetjekket: brugeren
//! har valgt den fra, så den er ikke en rest.
//!
//! **Sagen ændres først ved [`gem_og_masker`]**, og kun hvis ingen rettelse blev afvist.
//!
//! **Sager på disk (V-SAG.1).** Programmet starter med en midlertidig sag i hukommelsen. [`sag_ny`] gør den til en
//! navngiven sag på disk ([`crate::sager`]); i en navngiven sag gemmer [`gem_og_masker`] sagen krypteret, før svaret
//! sendes. Fejler skrivningen, får brugeren fejlen og ingen maskeret tekst, så der aldrig findes en maskeret tekst,
//! som ingen sag kan demaskere.
//!
//! **Ordbogen (V-ORDBOG.1).** `analyser`, `gem_og_masker` og lækagetjekket bruger den aktuelle ordbog: kernens
//! `analyser` finder ordbogens værdier, og "maskér aldrig" gives videre til forslagene (F1) og lækagetjekket. Ordbogen
//! læses fra disk første gang, den bruges ([`crate::ordbog::Ordbogsfil`]). Kan den ikke åbnes, arbejder programmet
//! videre med en tom ordbog og afviser ændringer, så filen ikke overskrives.
//!
//! **Indstillinger (V-ORDBOG.1 O6).** En ny sag (ved start, Luk sag, Nulstil, Slet og en ny navngiven sag oven på en
//! navngiven) får valget fra indstillingerne ([`Tilstand::ny_sag`]). [`sag_valg`] ændrer valget for den åbne sag.

use std::collections::{HashMap, HashSet};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, MutexGuard};

use grimnir_core::{
    analyser as kerne_analyser, demasker as kerne_demasker, foreslaa_med_ordbog, laekagetjek, masker, Advarsel, AdvarselArt, AfledtArt,
    Art, Erstatning, Fejl, Fund, Klasse, Ordbog, Pulje, RestArt, Sag, Sikkerhed, Valg,
};
use serde::{Deserialize, Serialize};

use crate::indstillinger::{self, Indstillinger};
use crate::ordbog::{self as ob, FeltFejl, OrdbogPost, Ordbogsfil, PostType};
use crate::sager::{nulstil, opret_mappe, rens_navn, ryd_midlertidige, tjek_dato, AabenSag, Arkiv, Noeglelager, SagFejl, SagsId};

/// Største tekst, Maskér tager imod: 5 MiB (5 242 880 bytes). Større tekster kræver "Åbn fil" (B3b).
pub const MAKS_BYTES: usize = 5 * 1024 * 1024;
/// Største tekst, Demaskér tager imod: 8 MiB (8 388 608 bytes). Det maskerede kan blive større end originalen, fordi
/// koderne kan være længere end værdierne (fund 1 i V-SKAL.2).
pub const MAKS_DEMASKER: usize = 8 * 1024 * 1024;

/// Den sag, der er i brug: sagen i hukommelsen og, hvis den er navngiven, dens fil og nøgle.
#[derive(Default)]
struct Aktuel {
    sag: Sag,
    aaben: Option<AabenSag>,
}

/// Ordbogen i hukommelsen: posterne, skrivetælleren, de blev læst med, kernens ordbog og fejlen, hvis filen ikke kunne
/// åbnes (så er ordbogen tom, og ændringer afvises).
#[derive(Default)]
struct OrdbogTilstand {
    poster: Vec<OrdbogPost>,
    taeller: u64,
    kerne: Ordbog,
    fejl: Option<SagFejl>,
}

impl OrdbogTilstand {
    fn med(poster: Vec<OrdbogPost>, taeller: u64) -> Self {
        OrdbogTilstand {
            kerne: ob::kerne_ordbog(&poster),
            poster,
            taeller,
            fejl: None,
        }
    }

    /// Erstatter posterne (nulstiller de gamle og kernens gamle kopi).
    fn erstat(&mut self, poster: Vec<OrdbogPost>) {
        let kerne = ob::kerne_ordbog(&poster);
        ob::nulstil(std::mem::replace(&mut self.poster, poster));
        ob::nulstil_kerne(std::mem::replace(&mut self.kerne, kerne));
    }
}

/// Programmets tilstand: den aktuelle sag, arkivet med sagerne på disk, ordbogen og indstillingerne.
#[derive(Default)]
pub struct Tilstand {
    sag: Mutex<Aktuel>,
    arkiv: Option<Arkiv>,
    ordbogsfil: Option<Ordbogsfil>,
    ordbog: Mutex<Option<OrdbogTilstand>>,
    indst_fil: Option<PathBuf>,
    indst: Mutex<Indstillinger>,
    afslut: AtomicBool,
}

impl Tilstand {
    /// En tom tilstand uden sager på disk (kun hukommelsen). Ordbogen lever kun i hukommelsen.
    pub fn ny() -> Self {
        Tilstand::default()
    }

    /// En tom tilstand med sager på disk. Ordbog og indstillinger lever kun i hukommelsen (V-SAG.1's tests).
    pub fn med_arkiv(arkiv: Arkiv) -> Self {
        Tilstand {
            arkiv: Some(arkiv),
            ..Tilstand::default()
        }
    }

    /// Programmet på disk: sagerne i `<mappe>/sager`, ordbogen i `<mappe>/ordbog.grimnir` og indstillingerne i
    /// `<mappe>/indstillinger.json`; nøglerne i `lager`. Efterladte midlertidige filer ældre end en time slettes, og den
    /// første midlertidige sag får valget fra indstillingerne. Ordbogen læses først, når den bruges.
    pub fn paa_disk(mappe: PathBuf, lager: Arc<dyn Noeglelager>) -> Self {
        let nu = std::time::SystemTime::now();
        ryd_midlertidige(&mappe, nu);
        ryd_midlertidige(&mappe.join("sager"), nu);
        let indst_fil = indstillinger::sti(&mappe);
        let indst = indstillinger::laes(&indst_fil);
        Tilstand {
            sag: Mutex::new(Aktuel {
                sag: Sag::ny(indst.valg()),
                aaben: None,
            }),
            arkiv: Some(Arkiv::ny(mappe.join("sager"), Box::new(lager.clone()))),
            ordbogsfil: Some(Ordbogsfil::ny(mappe, Box::new(lager))),
            ordbog: Mutex::new(None),
            indst_fil: Some(indst_fil),
            indst: Mutex::new(indst),
            afslut: AtomicBool::new(false),
        }
    }

    /// Låsen til sagen. Sagen ændres kun ved at blive erstattet af en færdigregnet kopi, så en forgiftet lås (panik i
    /// en anden tråd) efterlader aldrig en halvt ændret sag; derfor bruges indholdet videre.
    fn sag(&self) -> MutexGuard<'_, Aktuel> {
        self.sag.lock().unwrap_or_else(|e| e.into_inner())
    }

    fn arkiv(&self) -> Result<&Arkiv, UiFejl> {
        self.arkiv.as_ref().ok_or(UiFejl::IngenArkiv)
    }

    /// Indstillingerne nu.
    pub fn indstillinger(&self) -> Indstillinger {
        *self.indst.lock().unwrap_or_else(|e| e.into_inner())
    }

    /// En ny, tom sag med valget fra indstillingerne. Kaldes før sagens lås tages (låsene tages aldrig i omvendt orden).
    pub fn ny_sag(&self) -> Sag {
        Sag::ny(self.indstillinger().valg())
    }

    /// Ordbogen, læst fra disk første gang. Ordbogens lås holdes aldrig samtidig med sagens.
    fn ordbog(&self) -> MutexGuard<'_, Option<OrdbogTilstand>> {
        let mut g = self.ordbog.lock().unwrap_or_else(|e| e.into_inner());
        if g.is_none() {
            *g = Some(match &self.ordbogsfil {
                None => OrdbogTilstand::default(),
                Some(fil) => match fil.laes() {
                    Ok((taeller, poster)) => OrdbogTilstand::med(poster, taeller),
                    Err(fejl) => OrdbogTilstand {
                        fejl: Some(fejl),
                        ..OrdbogTilstand::default()
                    },
                },
            });
        }
        g
    }

    /// En kopi af kernens ordbog til én analyse.
    fn kerne_ordbog(&self) -> Ordbog {
        self.ordbog().as_ref().map(|o| o.kerne.clone()).unwrap_or_default()
    }

    /// Sand, hvis programmet skal spørge, før det lukkes: en midlertidig sag med poster, og brugeren har ikke allerede
    /// svaret (Gem som sag, Kassér).
    pub fn skal_spoerge_ved_luk(&self) -> bool {
        if self.afslut.load(Ordering::SeqCst) {
            return false;
        }
        let a = self.sag();
        a.aaben.is_none() && a.sag.antal_poster() > 0
    }

    /// Brugeren har svaret; programmet må lukke uden at spørge igen.
    pub fn tillad_afslut(&self) {
        self.afslut.store(true, Ordering::SeqCst);
    }
}

/// Erstatter den aktuelle sag og nulstiller den gamle i hukommelsen (strengene og nøglen).
fn erstat(a: &mut Aktuel, sag: Sag, aaben: Option<AabenSag>) {
    let gammel = std::mem::replace(&mut a.sag, sag);
    a.aaben = aaben;
    nulstil(gammel.til_data());
}

/// Nu i millisekunder siden 1970 (UTC). Uret bruges kun i skallen, aldrig i kernen.
fn nu_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

/// En kode, brugeren har skrevet i en række.
#[derive(Clone, Debug, Deserialize)]
pub struct Rettelse {
    /// Rækkens id.
    pub id: usize,
    /// Den ønskede kode.
    pub kode: String,
}

/// En afvist rettelse eller en ukendt række. Indeholder rækkens id og brugerens ønskede kode, aldrig en original.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct RaekkeFejl {
    /// Rækkens id.
    pub id: usize,
    /// `kollision` | `ugyldig` | `flere_stavemaader` | `ukendt_raekke`
    pub fejl: &'static str,
    /// Den kode, brugeren ønskede.
    pub kode: String,
}

/// Fejl til UI'et. Ingen variant indeholder en original.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(tag = "art", rename_all = "snake_case")]
pub enum UiFejl {
    /// Teksten er større end [`MAKS_BYTES`].
    ForStor {
        /// Tekstens størrelse i bytes.
        bytes: usize,
        /// Grænsen.
        maks: usize,
    },
    /// Der er ingen tekst.
    TomTekst,
    /// En eller flere rettelser blev afvist; intet er gemt.
    Raekker {
        /// Fejlene pr. række.
        fejl: Vec<RaekkeFejl>,
    },
    /// Sagsdata kunne ikke kopieres (bør ikke kunne ske).
    Sagsdata {
        /// Kernens beskrivelse (uden originaler).
        hvad: String,
    },
    /// En sag på disk kunne ikke læses, skrives eller slettes. I `gem_og_masker` betyder det: intet er gemt, og der
    /// er ingen maskeret tekst.
    Sag {
        /// Årsagen (uden indhold).
        fejl: SagFejl,
    },
    /// Programmet har ingen mappe til sager (kun i tests uden arkiv).
    IngenArkiv,
    /// En ordbogspost blev afvist; intet er gemt. Fejlene pr. felt uden værdien.
    Ordbog {
        /// Fejlene.
        fejl: Vec<FeltFejl>,
    },
    /// Ordbogens fil kunne ikke åbnes ved start. Grimnir bruger en tom ordbog og ændrer ikke filen.
    OrdbogLaast {
        /// Årsagen.
        fejl: SagFejl,
    },
    /// Ordbogen kunne ikke gemmes; intet er ændret. Ved [`SagFejl::Konflikt`] er ordbogen læst igen fra disken.
    OrdbogFil {
        /// Årsagen.
        fejl: SagFejl,
    },
    /// Indstillingerne kunne ikke gemmes, eller et valg er ugyldigt (`fejl` er `None`).
    Indstillinger {
        /// Årsagen fra disken.
        fejl: Option<SagFejl>,
    },
}

impl From<Fejl> for UiFejl {
    fn from(f: Fejl) -> Self {
        UiFejl::Sagsdata { hvad: f.to_string() }
    }
}

impl From<SagFejl> for UiFejl {
    fn from(fejl: SagFejl) -> Self {
        UiFejl::Sag { fejl }
    }
}

/// Én række i tabellen: én enhed i teksten.
#[derive(Clone, Debug, Serialize)]
pub struct Raekke {
    /// Byte-position for enhedens første forekomst. Fast for samme tekst.
    pub id: usize,
    /// Fundets art (`ipv4_egen`, `vaert`, `hemmelighed` …).
    pub art: &'static str,
    /// `sikker` | `ordbog` | `sandsynlig` | `tjek` | `version`
    pub status: &'static str,
    /// Maskeres som standard (`Tjek selv`, `Version` og fremmede adresser gør ikke).
    pub standard: bool,
    /// Maskeres i dette valg.
    pub valgt: bool,
    /// Kan ikke slås fra: teksten har allerede en af sagens koder her, og demaskeringen ville ellers sætte en forkert
    /// værdi ind (kernens kollisionspas).
    pub laast: bool,
    /// Hemmelighed: vises som prikker, til brugeren trykker Vis.
    pub hemmelig: bool,
    /// Enhedens stavemåder i teksten (originalerne, til visning).
    pub vaerdier: Vec<String>,
    /// Koden for hver stavemåde. For en fravalgt række er det forslaget, hvis den slås til.
    pub koder: Vec<String>,
    /// Antal forekomster.
    pub antal: usize,
    /// Linjen for første forekomst (1-baseret).
    pub linje: usize,
    /// Brugeren har rettet koden.
    pub rettet: bool,
    /// Alle rækkens koder fandtes i sagen før denne tekst (kendt fra en tidligere maskering i denne session).
    pub kendt: bool,
}

/// En advarsel fra kernen, samlet pr. art og kode. Uden forslag (forslaget er en original).
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct AdvarselUd {
    /// `ukendt_adresse` | `ukendt_kode` | `anden_stavemaade` | `fqdn_forkortet` | `domaene_alene` | `escaped` |
    /// `url_kodet` | `ikke_brugt` | `ligner_anden_sag` | `overloeb_egne_net` | `overloeb_fremmede` | `overloeb_mac` |
    /// `overloeb_ipv6`
    pub art: &'static str,
    /// Koden, det handler om (tom, hvis ingen).
    pub kode: String,
    /// Antal gange.
    pub antal: usize,
    /// Linjen for første gang (0 for advarsler uden sted).
    pub linje: usize,
}

/// Svaret fra `analyser`.
#[derive(Clone, Debug, Serialize)]
pub struct Analyse {
    /// Rækkerne i rækkefølge efter første forekomst.
    pub raekker: Vec<Raekke>,
    /// Rettelser, der ville blive afvist.
    pub fejl: Vec<RaekkeFejl>,
    /// Overløb under tildelingen.
    pub advarsler: Vec<AdvarselUd>,
    /// Tekstens størrelse i bytes.
    pub bytes: usize,
    /// Antal linjer.
    pub linjer: usize,
}

/// En rest fra lækagetjekket, samlet pr. art og tekst.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct RestUd {
    /// `original` (en af sagens originaler står stadig i teksten) | `nyt_fund` (genkenderne finder noget nyt).
    pub art: &'static str,
    /// Klassen eller fundets art.
    pub type_: &'static str,
    /// Teksten i det maskerede resultat (det er den, brugeren skal se for at afgøre det).
    pub tekst: String,
    /// Antal gange.
    pub antal: usize,
    /// Linjen for første gang.
    pub linje: usize,
}

/// Svaret fra `gem_og_masker`.
#[derive(Clone, Debug, Serialize)]
pub struct Maskering {
    /// Den maskerede tekst.
    pub maskeret: String,
    /// Rester fra lækagetjekket.
    pub rester: Vec<RestUd>,
    /// Overløb under tildelingen.
    pub advarsler: Vec<AdvarselUd>,
    /// Sagens antal poster efter gemningen.
    pub poster: usize,
}

/// Svaret fra `demasker`.
#[derive(Clone, Debug, Serialize)]
pub struct Demaskering {
    /// Teksten med de rigtige værdier.
    pub tekst: String,
    /// Kernens advarsler, samlet.
    pub advarsler: Vec<AdvarselUd>,
    /// Sagens koder, der forekommer i teksten (koderne, ikke originalerne).
    pub koder: Vec<String>,
}

/// Svaret fra `sag_status` og kommandoerne, der skifter sag.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct SagStatus {
    /// Antal stavemåder med kode i sagen.
    pub poster: usize,
    /// Den navngivne sags id (`None`: midlertidig sag).
    pub id: Option<String>,
    /// Den navngivne sags navn.
    pub navn: Option<String>,
    /// Udløbsdato `ÅÅÅÅ-MM-DD`.
    pub udloeb: Option<String>,
    /// Sagens valg (D4, D5).
    pub valg: ValgUd,
}

/// En sags valg til UI'et.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
pub struct ValgUd {
    /// Maskér fremmede offentlige adresser (D4).
    pub masker_fremmede: bool,
    /// Bevar sidste oktet i egne net (D5).
    pub bevar_sidste_oktet: bool,
}

impl From<Valg> for ValgUd {
    fn from(v: Valg) -> Self {
        ValgUd {
            masker_fremmede: v.masker_fremmede,
            bevar_sidste_oktet: v.bevar_sidste_oktet,
        }
    }
}

/// Én sag i listen.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct SagListePost {
    /// Sagens id (32 hextegn).
    pub id: String,
    /// Navnet (`None`, hvis sagen ikke kan åbnes).
    pub navn: Option<String>,
    /// Antal værdier (poster).
    pub poster: usize,
    /// Oprettet (ms siden 1970, UTC).
    pub oprettet: u64,
    /// Sidst gemt (ms siden 1970, UTC).
    pub sidst_brugt: u64,
    /// Udløbsdato.
    pub udloeb: Option<String>,
    /// Sagen er den, der er åben i dette vindue.
    pub aaben: bool,
    /// Årsagen, hvis sagen ikke kan åbnes ("Kan ikke åbnes").
    pub fejl: Option<SagFejl>,
}

// ------------------------------------------------------------------------------------------------------- navne til UI

/// Fundets art som nøgle til UI'et.
pub fn art_navn(a: Art) -> &'static str {
    match a {
        Art::Ipv4Egen => "ipv4_egen",
        Art::Ipv4Fremmed => "ipv4_fremmed",
        Art::Ipv6Egen => "ipv6_egen",
        Art::Ipv6Fremmed => "ipv6_fremmed",
        Art::Mac => "mac",
        Art::Vaert => "vaert",
        Art::Domaene => "domaene",
        Art::NetbiosDomaene => "netbios",
        Art::Bruger => "bruger",
        Art::Person => "person",
        Art::Database => "database",
        Art::Ord => "ord",
        Art::Hemmelighed => "hemmelighed",
        Art::Sid => "sid",
        Art::Guid => "guid",
        Art::Serienummer => "serienummer",
        Art::Cpr => "cpr",
        Art::Entropi => "entropi",
        Art::LignerKode => "ligner_kode",
    }
}

fn klasse_navn(k: Klasse) -> &'static str {
    match k {
        Klasse::Vaert => "vaert",
        Klasse::Domaene => "domaene",
        Klasse::Netbios => "netbios",
        Klasse::Bruger => "bruger",
        Klasse::Person => "person",
        Klasse::Database => "database",
        Klasse::Ord => "ord",
        Klasse::Hemmelighed => "hemmelighed",
        Klasse::Serie => "serienummer",
        Klasse::Cpr => "cpr",
        Klasse::Guid => "guid",
        Klasse::Sid => "sid",
        Klasse::Ipv4 => "ipv4_egen",
        Klasse::Ipv6 => "ipv6_egen",
        Klasse::Mac => "mac",
    }
}

fn status_navn(s: Sikkerhed) -> &'static str {
    match s {
        Sikkerhed::Sikker => "sikker",
        Sikkerhed::Ordbog => "ordbog",
        Sikkerhed::Sandsynlig => "sandsynlig",
        Sikkerhed::TjekSelv => "tjek",
        Sikkerhed::Version => "version",
    }
}

fn advarsel_navn(a: AdvarselArt) -> &'static str {
    match a {
        AdvarselArt::UkendtAdresseISagensNet => "ukendt_adresse",
        AdvarselArt::UkendtKode => "ukendt_kode",
        AdvarselArt::AfledtForm(AfledtArt::AndenStavemaade) => "anden_stavemaade",
        AdvarselArt::AfledtForm(AfledtArt::FqdnForkortet) => "fqdn_forkortet",
        AdvarselArt::AfledtForm(AfledtArt::DomaeneAlene) => "domaene_alene",
        AdvarselArt::AfledtForm(AfledtArt::Escaped) => "escaped",
        AdvarselArt::AfledtForm(AfledtArt::UrlKodet) => "url_kodet",
        AdvarselArt::IkkeBrugt => "ikke_brugt",
        AdvarselArt::LignerAndenSag => "ligner_anden_sag",
        AdvarselArt::Overloeb(Pulje::EgneNet) => "overloeb_egne_net",
        AdvarselArt::Overloeb(Pulje::Fremmede) => "overloeb_fremmede",
        AdvarselArt::Overloeb(Pulje::Mac) => "overloeb_mac",
        AdvarselArt::Overloeb(Pulje::Ipv6) => "overloeb_ipv6",
    }
}

// ------------------------------------------------------------------------------------------------------- hjælpere

/// Linjenumre ud fra byte-positioner (1-baseret). Bygges én gang pr. tekst.
struct Linjer(Vec<usize>);

impl Linjer {
    fn ny(t: &str) -> Self {
        Linjer(t.bytes().enumerate().filter(|(_, b)| *b == b'\n').map(|(i, _)| i).collect())
    }
    fn af(&self, pos: usize) -> usize {
        self.0.partition_point(|&i| i < pos) + 1
    }
    fn antal(&self, t: &str) -> usize {
        if t.is_empty() {
            0
        } else {
            self.0.len() + usize::from(!t.ends_with('\n'))
        }
    }
}

fn tjek_tekst(tekst: &str) -> Result<(), UiFejl> {
    tjek_tekst_op_til(tekst, MAKS_BYTES)
}

fn tjek_tekst_op_til(tekst: &str, maks: usize) -> Result<(), UiFejl> {
    if tekst.len() > maks {
        return Err(UiFejl::ForStor { bytes: tekst.len(), maks });
    }
    if tekst.is_empty() {
        return Err(UiFejl::TomTekst);
    }
    Ok(())
}

/// En kopi af sagen med `masker_fremmede` sat. Kernens `Sag` er ikke `Clone`; data er, og `fra_data` bygger indeksene.
fn kopi(sag: &Sag, masker_fremmede: bool) -> Result<Sag, Fejl> {
    let mut d = sag.data().clone();
    d.valg.masker_fremmede = masker_fremmede;
    Sag::fra_data(d)
}

/// Et fund, brugeren har slået til, selv om kernen ikke foreslår det (`Tjek selv`, `Version`).
fn slaaet_til(f: &Fund) -> Fund {
    let mut f = *f;
    if matches!(f.sikkerhed, Sikkerhed::TjekSelv | Sikkerhed::Version) {
        f.sikkerhed = Sikkerhed::Sandsynlig;
    }
    f
}

/// Som kernens `skal_maskeres` med sagens standardvalg: kernen ville selv foreslå fundet maskeret.
fn standard_for(f: &Fund, masker_fremmede: bool) -> bool {
    match f.sikkerhed {
        Sikkerhed::Version | Sikkerhed::TjekSelv => false,
        _ => !matches!(f.art, Art::Ipv4Fremmed | Art::Ipv6Fremmed) || masker_fremmede,
    }
}

fn samlede_advarsler(liste: &[Advarsel], linjer: &Linjer) -> Vec<AdvarselUd> {
    let mut ud: Vec<AdvarselUd> = Vec::new();
    let mut plads: HashMap<(&'static str, String), usize> = HashMap::new();
    for a in liste {
        let art = advarsel_navn(a.art);
        let linje = if a.slut > 0 { linjer.af(a.start) } else { 0 };
        match plads.get(&(art, a.kode.clone())) {
            Some(&i) => ud[i].antal += 1,
            None => {
                plads.insert((art, a.kode.clone()), ud.len());
                ud.push(AdvarselUd {
                    art,
                    kode: a.kode.clone(),
                    antal: 1,
                    linje,
                });
            }
        }
    }
    ud
}

// ------------------------------------------------------------------------------------------------------- beregning

/// En gruppe = én enhed i teksten = én række.
struct Gruppe {
    id: usize,
    art: Art,
    status: Sikkerhed,
    standard: bool,
    vaerdier: Vec<String>,
    forslag: Vec<String>,
}

struct Beregning {
    kladde: Sag,
    erstatninger: Vec<Erstatning>,
    raekker: Vec<Raekke>,
    fejl: Vec<RaekkeFejl>,
    advarsler: Vec<Advarsel>,
    /// Ordbogen for dette valg: brugerens ordbog, hvor "maskér aldrig" også har de fravalgte værdier, sagen allerede
    /// kender (dér virker F1). Bruges af lækagetjekket.
    aldrig: Ordbog,
    /// Alle fravalgte værdier med små bogstaver: lækagetjekkets rester sorteres mod dem.
    fravalgte: HashSet<String>,
    linjer: Linjer,
}

/// Regner forslag, valg og rettelser ud på en kopi af sagen. Sagen selv røres ikke.
///
/// `fravalgt`: rækker, der ikke maskeres (`None`: kernens standard). `rettelser`: koder, brugeren har skrevet.
/// `ordbog`: brugerens ordbog (V-ORDBOG.1); den finder værdier, og "maskér aldrig" vinder over alt.
fn beregn(sag: &Sag, tekst: &str, fravalgt: Option<&[usize]>, rettelser: &[Rettelse], ordbog: &Ordbog) -> Result<Beregning, UiFejl> {
    let linjer = Linjer::ny(tekst);
    let fund = kerne_analyser(tekst, ordbog);
    let fund_ved: HashMap<(usize, usize), &Fund> = fund.iter().map(|f| ((f.start, f.slut), f)).collect();
    let fremmede = sag.valg().masker_fremmede;

    // 1. Fuldt gennemløb: alt får en kode, så alle rækker og deres grupper kendes.
    let mut alle = kopi(sag, true)?;
    let fund_alle: Vec<Fund> = fund.iter().map(slaaet_til).collect();
    let ers_alle = foreslaa_med_ordbog(&fund_alle, tekst, &mut alle, ordbog);
    let post_af: HashMap<&str, usize> = alle.data().poster.iter().enumerate().map(|(i, p)| (p.kode.as_str(), i)).collect();
    let mut grupper: Vec<Gruppe> = Vec::new();
    let mut gruppe_af_enhed: HashMap<usize, usize> = HashMap::new();
    let mut gruppe_ved: HashMap<(usize, usize), usize> = HashMap::new();
    for e in &ers_alle {
        let Some(&p) = post_af.get(e.kode.as_str()) else { continue };
        let enhed = alle.data().poster[p].enhed;
        let gi = *gruppe_af_enhed.entry(enhed).or_insert_with(|| {
            grupper.push(Gruppe {
                id: e.start,
                art: e.art,
                status: Sikkerhed::Version,
                standard: false,
                vaerdier: Vec::new(),
                forslag: Vec::new(),
            });
            grupper.len() - 1
        });
        let g = &mut grupper[gi];
        gruppe_ved.insert((e.start, e.slut), gi);
        let o = e.original.som_tekst();
        if !g.vaerdier.iter().any(|v| v == o) {
            g.vaerdier.push(o.to_string());
            g.forslag.push(e.kode.clone());
        }
        // Et spænd uden fund er kernens eget (F1: kendt fra sagen; kollisionspasset): sikkert og standard.
        let (s, std) = match fund_ved.get(&(e.start, e.slut)) {
            Some(f) => (f.sikkerhed, standard_for(f, fremmede)),
            None => (Sikkerhed::Sikker, true),
        };
        g.status = g.status.min(s);
        g.standard |= std;
    }
    drop(post_af);
    drop(alle);

    let fra: Option<HashSet<usize>> = fravalgt.map(|f| f.iter().copied().collect());
    let valgt: Vec<bool> = grupper
        .iter()
        .map(|g| match &fra {
            None => g.standard,
            Some(f) => !f.contains(&g.id),
        })
        .collect();

    // 2. Gennemløbet, der gemmes: kun de valgte rækker. "Maskér aldrig" er ordbogens liste plus de fravalgte værdier,
    // som sagen kender i forvejen (F1 kan kun finde dem).
    let mut fravalgte: HashSet<String> = HashSet::new();
    for (g, v) in grupper.iter().zip(&valgt) {
        if !v {
            fravalgte.extend(g.vaerdier.iter().map(|x| x.to_ascii_lowercase()));
        }
    }
    let mut aldrig = ordbog.clone();
    if !fravalgte.is_empty() {
        let mut set = HashSet::new();
        for p in &sag.data().poster {
            let o = p.original.som_tekst().to_ascii_lowercase();
            if fravalgte.contains(&o) && set.insert(o) {
                aldrig.aldrig.push(p.original.som_tekst().to_string());
            }
        }
    }
    let fund_valgt: Vec<Fund> = fund
        .iter()
        .filter(|f| gruppe_ved.get(&(f.start, f.slut)).is_some_and(|&gi| valgt[gi]))
        .map(slaaet_til)
        .collect();
    let mut kladde = kopi(sag, true)?;
    let mut ers = foreslaa_med_ordbog(&fund_valgt, tekst, &mut kladde, &aldrig);
    let advarsler = kladde.tag_advarsler();
    let mut kladde = kopi(&kladde, fremmede)?;

    // Hver erstatning til sin række. Et spænd i en fravalgt række kan kun komme fra kollisionspasset: den er låst.
    let mut laast = vec![false; grupper.len()];
    let mut ers_gruppe: Vec<Option<usize>> = Vec::with_capacity(ers.len());
    for e in &ers {
        let gi = gruppe_ved.get(&(e.start, e.slut)).copied();
        if let Some(gi) = gi {
            if !valgt[gi] {
                laast[gi] = true;
            }
        }
        ers_gruppe.push(gi);
    }
    let effektiv: Vec<bool> = valgt.iter().zip(&laast).map(|(v, l)| *v || *l).collect();

    // Ekstra spænd, som det fulde gennemløb ikke havde (sjældent: et fravalg kan frilægge en kortere kendt værdi).
    let mut ekstra: HashMap<String, usize> = HashMap::new();
    for (i, e) in ers.iter().enumerate() {
        if ers_gruppe[i].is_none() {
            let gi = *ekstra.entry(e.kode.clone()).or_insert_with(|| {
                grupper.push(Gruppe {
                    id: e.start,
                    art: e.art,
                    status: Sikkerhed::Sikker,
                    standard: true,
                    vaerdier: Vec::new(),
                    forslag: Vec::new(),
                });
                laast.push(true);
                grupper.len() - 1
            });
            let o = e.original.som_tekst();
            if !grupper[gi].vaerdier.iter().any(|v| v == o) {
                grupper[gi].vaerdier.push(o.to_string());
                grupper[gi].forslag.push(e.kode.clone());
            }
            ers_gruppe[i] = Some(gi);
        }
    }
    let mut effektiv = effektiv;
    effektiv.resize(grupper.len(), true);

    // Koderne pr. række i dette valg.
    let mut koder: Vec<Vec<String>> = grupper.iter().map(|g| g.forslag.clone()).collect();
    let mut antal = vec![0usize; grupper.len()];
    let mut set_v: Vec<Vec<bool>> = grupper.iter().map(|g| vec![false; g.vaerdier.len()]).collect();
    for (i, e) in ers.iter().enumerate() {
        let Some(gi) = ers_gruppe[i] else { continue };
        antal[gi] += 1;
        if let Some(vi) = grupper[gi].vaerdier.iter().position(|v| v == e.original.som_tekst()) {
            if !set_v[gi][vi] {
                koder[gi][vi] = e.kode.clone();
                set_v[gi][vi] = true;
            }
        }
    }
    // En fravalgt række: antal fra det fulde gennemløb.
    for e in &ers_alle {
        if let Some(&gi) = gruppe_ved.get(&(e.start, e.slut)) {
            if !effektiv[gi] {
                antal[gi] += 1;
            }
        }
    }

    // 3. Rettelser.
    let mut rettet = vec![false; grupper.len()];
    let mut fejl = Vec::new();
    for r in rettelser {
        let ny = r.kode.as_str();
        let Some(gi) = grupper.iter().position(|g| g.id == r.id) else {
            fejl.push(RaekkeFejl {
                id: r.id,
                fejl: "ukendt_raekke",
                kode: r.kode.clone(),
            });
            continue;
        };
        if !effektiv[gi] {
            continue;
        }
        let mut forskellige = koder[gi].clone();
        forskellige.sort_unstable();
        forskellige.dedup();
        // Én kode: rettes som skrevet (`Sag::ret`). Flere stavemåder: hele enheden omdøbes samlet, og koden spejler
        // hver stavemådes store/små bogstaver (`Sag::ret_enhed`, fund 3 i V-SKAL.2).
        let svar = if forskellige.len() == 1 {
            if forskellige[0] == ny {
                continue;
            }
            kladde
                .ret(&forskellige[0], ny, tekst)
                .map(|()| vec![(forskellige[0].clone(), ny.to_string())])
        } else {
            kladde.ret_enhed(&koder[gi][0], ny, tekst)
        };
        match svar {
            Ok(par) => {
                let ny_for: HashMap<&str, &str> = par.iter().map(|(g, n)| (g.as_str(), n.as_str())).collect();
                for (i, e) in ers.iter_mut().enumerate() {
                    if ers_gruppe[i] == Some(gi) {
                        if let Some(n) = ny_for.get(e.kode.as_str()) {
                            e.kode = n.to_string();
                        }
                    }
                }
                for k in koder[gi].iter_mut() {
                    if let Some(n) = ny_for.get(k.as_str()) {
                        *k = n.to_string();
                    }
                }
                rettet[gi] = true;
            }
            Err(f) => fejl.push(RaekkeFejl {
                id: r.id,
                fejl: match f {
                    Fejl::KodeKolliderer { .. } => "kollision",
                    Fejl::UgyldigKode { .. } => "ugyldig",
                    _ => "ukendt_raekke",
                },
                kode: r.kode.clone(),
            }),
        }
    }

    let raekker = grupper
        .iter()
        .enumerate()
        .map(|(gi, g)| Raekke {
            id: g.id,
            art: art_navn(g.art),
            status: status_navn(g.status),
            standard: g.standard,
            valgt: effektiv[gi],
            laast: laast[gi],
            hemmelig: matches!(g.art, Art::Hemmelighed | Art::Entropi),
            vaerdier: g.vaerdier.clone(),
            koder: koder[gi].clone(),
            antal: antal[gi],
            linje: linjer.af(g.id),
            rettet: rettet[gi],
            kendt: !rettet[gi] && koder[gi].iter().all(|k| sag.opslag(k).is_some()),
        })
        .collect();
    Ok(Beregning {
        kladde,
        erstatninger: ers,
        raekker,
        fejl,
        advarsler,
        aldrig,
        fravalgte,
        linjer,
    })
}

// ------------------------------------------------------------------------------------------------------- handlingerne

/// Finder fundene og regner koderne ud på en kladde af sagen. Sagen ændres ikke.
pub fn analyser(t: &Tilstand, tekst: &str, fravalgt: Option<&[usize]>, rettelser: &[Rettelse]) -> Result<Analyse, UiFejl> {
    tjek_tekst(tekst)?;
    let ordbog = t.kerne_ordbog();
    // Sagen kopieres under låsen; selve beregningen sker uden lås.
    let sag = {
        let laast = t.sag();
        kopi(&laast.sag, laast.sag.valg().masker_fremmede)?
    };
    let b = beregn(&sag, tekst, fravalgt, rettelser, &ordbog);
    ob::nulstil_kerne(ordbog);
    let b = b?;
    let ud = Analyse {
        advarsler: samlede_advarsler(&b.advarsler, &b.linjer),
        linjer: b.linjer.antal(tekst),
        raekker: b.raekker,
        fejl: b.fejl,
        bytes: tekst.len(),
    };
    ob::nulstil_kerne(b.aldrig);
    nulstil(b.kladde.til_data());
    Ok(ud)
}

/// Maskerer med brugerens valg og rettelser og gemmer sagen. Afvises en rettelse, gemmes intet. I en navngiven sag
/// skrives sagen krypteret til disk, før svaret sendes; fejler det, er intet ændret, og der er ingen maskeret tekst.
pub fn gem_og_masker(t: &Tilstand, tekst: &str, fravalgt: &[usize], rettelser: &[Rettelse]) -> Result<Maskering, UiFejl> {
    tjek_tekst(tekst)?;
    let ordbog = t.kerne_ordbog();
    let mut a = t.sag();
    let b = beregn(&a.sag, tekst, Some(fravalgt), rettelser, &ordbog);
    ob::nulstil_kerne(ordbog);
    let b = b?;
    if !b.fejl.is_empty() {
        return Err(UiFejl::Raekker { fejl: b.fejl });
    }
    let maskeret = masker(tekst, &b.erstatninger);
    let ud_linjer = Linjer::ny(&maskeret);
    let mut rester: Vec<RestUd> = Vec::new();
    let mut plads: HashMap<(&str, &str, &str), usize> = HashMap::new();
    for r in laekagetjek(&maskeret, &b.kladde, &b.aldrig) {
        let (art, type_) = match r.art {
            RestArt::Original(k) => ("original", klasse_navn(k)),
            RestArt::NytFund(a) => ("nyt_fund", art_navn(a)),
        };
        let tekst_r = &maskeret[r.start..r.slut];
        // Brugeren har valgt værdien fra: den står urørt med vilje og er ikke en rest.
        if b.fravalgte.contains(&tekst_r.to_ascii_lowercase()) {
            continue;
        }
        match plads.get(&(art, type_, tekst_r)) {
            Some(&i) => rester[i].antal += 1,
            None => {
                plads.insert((art, type_, tekst_r), rester.len());
                rester.push(RestUd {
                    art,
                    type_,
                    tekst: tekst_r.to_string(),
                    antal: 1,
                    linje: ud_linjer.af(r.start),
                })
            }
        }
    }
    let advarsler = samlede_advarsler(&b.advarsler, &b.linjer);
    let aktuel = &mut *a;
    if let Some(aaben) = aktuel.aaben.as_mut() {
        let mut hoved = aaben.hoved.clone();
        hoved.sidst_brugt = nu_ms();
        if let Err(f) = t
            .arkiv()
            .and_then(|ark| ark.gem(aaben, hoved, b.kladde.data()).map_err(UiFejl::from))
        {
            // Intet udleveres: den maskerede tekst nulstilles, og sagen i hukommelsen er uændret.
            let mut m = maskeret;
            zeroize::Zeroize::zeroize(&mut m);
            nulstil(b.kladde.til_data());
            return Err(f);
        }
    }
    let poster = b.kladde.antal_poster();
    let aaben = aktuel.aaben.take();
    ob::nulstil_kerne(b.aldrig);
    erstat(aktuel, b.kladde, aaben);
    Ok(Maskering {
        maskeret,
        rester,
        advarsler,
        poster,
    })
}

/// Sætter sagens originaler tilbage i en tekst.
pub fn demasker(t: &Tilstand, tekst: &str) -> Result<Demaskering, UiFejl> {
    tjek_tekst_op_til(tekst, MAKS_DEMASKER)?;
    let a = t.sag();
    let sag = &a.sag;
    let (ud, adv) = kerne_demasker(tekst, sag);
    let ikke_brugt: HashSet<&str> = adv
        .iter()
        .filter(|a| a.art == AdvarselArt::IkkeBrugt)
        .map(|a| a.kode.as_str())
        .collect();
    let koder = sag
        .data()
        .poster
        .iter()
        .map(|p| p.kode.as_str())
        .filter(|k| !ikke_brugt.contains(k))
        .map(str::to_string)
        .collect();
    drop(a);
    Ok(Demaskering {
        advarsler: samlede_advarsler(&adv, &Linjer::ny(tekst)),
        tekst: ud,
        koder,
    })
}

fn status(a: &Aktuel) -> SagStatus {
    SagStatus {
        poster: a.sag.antal_poster(),
        id: a.aaben.as_ref().map(|x| x.id.hex()),
        navn: a.aaben.as_ref().map(|x| x.hoved.navn.clone()),
        udloeb: a.aaben.as_ref().and_then(|x| x.hoved.udloeb.clone()),
        valg: a.sag.valg().into(),
    }
}

/// Den aktuelle sag: antal poster, og navn og id, hvis den er navngiven.
pub fn sag_status(t: &Tilstand) -> SagStatus {
    status(&t.sag())
}

/// Tømmer sagen: en midlertidig sag kasseres; en navngiven lukkes (filen bliver). Som [`sag_luk`].
pub fn sag_nulstil(t: &Tilstand) -> SagStatus {
    sag_luk(t)
}

// ------------------------------------------------------------------------------------------------------- sager på disk

fn id_af(id: &str) -> Result<SagsId, UiFejl> {
    SagsId::fra_hex(id).map_err(UiFejl::from)
}

/// Gør den aktuelle sag til en navngiven sag på disk. En midlertidig sag (også med poster) bliver den nye sag; er en
/// navngiven sag åben, lukkes den (dens fil bliver), og den nye sag starter tom.
pub fn sag_ny(t: &Tilstand, navn: &str, udloeb: Option<&str>) -> Result<SagStatus, UiFejl> {
    let arkiv = t.arkiv()?;
    let ny = t.ny_sag();
    let mut a = t.sag();
    let data = if a.aaben.is_none() { a.sag.data() } else { ny.data() };
    let aaben = arkiv.opret(navn, udloeb.map(str::to_string), data, nu_ms())?;
    if a.aaben.is_some() {
        erstat(&mut a, ny, Some(aaben));
    } else {
        a.aaben = Some(aaben);
    }
    Ok(status(&a))
}

/// Sagerne på disk. En sag, der ikke kan åbnes, står med årsagen; intet slettes.
pub fn sag_liste(t: &Tilstand) -> Result<Vec<SagListePost>, UiFejl> {
    let arkiv = t.arkiv()?;
    let aaben_id = t.sag().aaben.as_ref().map(|x| x.id);
    let mut ud: Vec<SagListePost> = arkiv
        .liste()?
        .into_iter()
        .map(|p| {
            let aaben = Some(p.id) == aaben_id;
            match p.hoved {
                Ok(h) => SagListePost {
                    id: p.id.hex(),
                    navn: Some(h.navn),
                    poster: h.poster,
                    oprettet: h.oprettet,
                    sidst_brugt: h.sidst_brugt,
                    udloeb: h.udloeb,
                    aaben,
                    fejl: None,
                },
                Err(f) => SagListePost {
                    id: p.id.hex(),
                    navn: None,
                    poster: 0,
                    oprettet: 0,
                    sidst_brugt: 0,
                    udloeb: None,
                    aaben,
                    fejl: Some(f),
                },
            }
        })
        .collect();
    ud.sort_by(|a, b| b.sidst_brugt.cmp(&a.sidst_brugt).then_with(|| a.id.cmp(&b.id)));
    Ok(ud)
}

/// Åbner en sag fra disk og gør den til den aktuelle. Den tidligere sag nulstilles i hukommelsen (UI'et spørger først,
/// hvis den var midlertidig med poster). Er sagen allerede åben, læses den igen fra disk (efter en konflikt).
pub fn sag_aabn(t: &Tilstand, id: &str) -> Result<SagStatus, UiFejl> {
    let id = id_af(id)?;
    let (aaben, data) = t.arkiv()?.aabn(&id)?;
    let sag = Sag::fra_data(data).map_err(|_| UiFejl::from(SagFejl::Beskadiget))?;
    let mut a = t.sag();
    erstat(&mut a, sag, Some(aaben));
    Ok(status(&a))
}

/// Lukker sagen: den nulstilles i hukommelsen, og en ny, tom midlertidig sag starter. En navngiven sags fil bliver.
pub fn sag_luk(t: &Tilstand) -> SagStatus {
    let ny = t.ny_sag();
    let mut a = t.sag();
    erstat(&mut a, ny, None);
    status(&a)
}

/// Ændrer hovedet på en sag: den åbne (med kontrol af skrivetælleren) eller en anden på disk.
fn ret_hoved(t: &Tilstand, id: &SagsId, aendr: impl FnOnce(&mut crate::sager::Hoved)) -> Result<(), UiFejl> {
    let arkiv = t.arkiv()?;
    let mut a = t.sag();
    let aktuel = &mut *a;
    match aktuel.aaben.as_mut().filter(|x| x.id == *id) {
        Some(aaben) => {
            let mut h = aaben.hoved.clone();
            aendr(&mut h);
            arkiv.gem(aaben, h, aktuel.sag.data())?;
        }
        None => {
            drop(a);
            arkiv.ret_hoved(id, aendr)?;
        }
    }
    Ok(())
}

/// Omdøber en sag.
pub fn sag_omdoeb(t: &Tilstand, id: &str, navn: &str) -> Result<(), UiFejl> {
    let id = id_af(id)?;
    let navn = rens_navn(navn)?;
    ret_hoved(t, &id, |h| h.navn = navn)
}

/// Sætter eller fjerner en sags udløbsdato (`ÅÅÅÅ-MM-DD`). En udløbet sag slettes ikke automatisk.
pub fn sag_udloeb(t: &Tilstand, id: &str, dato: Option<&str>) -> Result<(), UiFejl> {
    let id = id_af(id)?;
    if let Some(d) = dato {
        tjek_dato(d)?;
    }
    let dato = dato.map(str::to_string);
    ret_hoved(t, &id, |h| h.udloeb = dato)
}

/// Sletter en sags fil og nøgle (UI'et bekræfter med sagens navn først). Er sagen åben, lukkes den.
pub fn sag_slet(t: &Tilstand, id: &str) -> Result<SagStatus, UiFejl> {
    let id = id_af(id)?;
    t.arkiv()?.slet(&id)?;
    let ny = t.ny_sag();
    let mut a = t.sag();
    if a.aaben.as_ref().is_some_and(|x| x.id == id) {
        erstat(&mut a, ny, None);
    }
    Ok(status(&a))
}

/// Ændrer valget (D4, D5) for den åbne sag. Koderne for værdier, sagen allerede har, ændres ikke; valget gælder nye
/// værdier. En navngiven sag gemmes (med kontrol af skrivetælleren).
pub fn sag_valg(t: &Tilstand, masker_fremmede: bool, bevar_sidste_oktet: bool) -> Result<SagStatus, UiFejl> {
    let mut a = t.sag();
    let mut d = a.sag.data().clone();
    d.valg = Valg {
        masker_fremmede,
        bevar_sidste_oktet,
    };
    let ny = Sag::fra_data(d)?;
    let aktuel = &mut *a;
    if let Some(aaben) = aktuel.aaben.as_mut() {
        let h = aaben.hoved.clone();
        if let Err(f) = t.arkiv().and_then(|ark| ark.gem(aaben, h, ny.data()).map_err(UiFejl::from)) {
            nulstil(ny.til_data());
            return Err(f);
        }
    }
    let aaben = aktuel.aaben.take();
    erstat(aktuel, ny, aaben);
    Ok(status(aktuel))
}

// ------------------------------------------------------------------------------------------------------- ordbogen

/// Ordbogen til UI'et: posterne og fejlen, hvis filen ikke kunne åbnes (så er listen tom, og ændringer afvises).
#[derive(Clone, Serialize)]
pub struct OrdbogUd {
    /// Posterne i den rækkefølge, de er tilføjet.
    pub poster: Vec<OrdbogPost>,
    /// Årsagen, hvis filen ikke kunne åbnes.
    pub fejl: Option<SagFejl>,
}

fn ordbog_ud(o: &OrdbogTilstand) -> OrdbogUd {
    OrdbogUd {
        poster: o.poster.clone(),
        fejl: o.fejl.clone(),
    }
}

/// Ordbogen.
pub fn ordbog_hent(t: &Tilstand) -> OrdbogUd {
    let g = t.ordbog();
    g.as_ref().map(ordbog_ud).unwrap_or(OrdbogUd {
        poster: Vec::new(),
        fejl: None,
    })
}

/// Ændrer ordbogen: `aendr` får en kopi af posterne. Gemmes kopien, bliver den ordbogen; fejler noget, er intet ændret.
fn aendr_ordbog(t: &Tilstand, aendr: impl FnOnce(&mut Vec<OrdbogPost>) -> Result<(), UiFejl>) -> Result<OrdbogUd, UiFejl> {
    let mut g = t.ordbog();
    let o = g.get_or_insert_with(OrdbogTilstand::default);
    if let Some(f) = &o.fejl {
        return Err(UiFejl::OrdbogLaast { fejl: f.clone() });
    }
    let mut nye = o.poster.clone();
    if let Err(f) = aendr(&mut nye) {
        ob::nulstil(nye);
        return Err(f);
    }
    if let Some(fil) = &t.ordbogsfil {
        match fil.gem(o.taeller, &nye) {
            Ok(n) => o.taeller = n,
            Err(fejl) => {
                ob::nulstil(nye);
                if fejl == SagFejl::Konflikt {
                    // Ændret et andet sted: læs den igen, så brugeren ser den gældende ordbog og kan prøve igen.
                    match fil.laes() {
                        Ok((n, poster)) => {
                            o.erstat(poster);
                            o.taeller = n;
                        }
                        Err(f) => {
                            o.erstat(Vec::new());
                            o.fejl = Some(f);
                        }
                    }
                }
                return Err(UiFejl::OrdbogFil { fejl });
            }
        }
    }
    o.erstat(nye);
    Ok(ordbog_ud(o))
}

fn post_type(type_: &str) -> Result<PostType, UiFejl> {
    PostType::fra_navn(type_).ok_or(UiFejl::Ordbog {
        fejl: vec![ob::felt("type", "ukendt_type")],
    })
}

/// Tilføjer en post. Afvises den, er intet gemt, og fejlene står pr. felt.
pub fn ordbog_tilfoej(t: &Tilstand, type_: &str, vaerdi: &str, note: Option<&str>) -> Result<OrdbogUd, UiFejl> {
    let type_ = post_type(type_)?;
    aendr_ordbog(t, |poster| {
        let (vaerdi, note) = ob::valider(poster, type_, vaerdi, note, None).map_err(|fejl| UiFejl::Ordbog { fejl })?;
        let id = poster.iter().map(|p| p.id).max().unwrap_or(0) + 1;
        poster.push(OrdbogPost {
            id,
            type_,
            vaerdi,
            note,
            oprettet: nu_ms(),
        });
        Ok(())
    })
}

fn ukendt_post() -> UiFejl {
    UiFejl::Ordbog {
        fejl: vec![ob::felt("id", "ukendt_post")],
    }
}

/// Retter en posts værdi og note (typen bliver).
pub fn ordbog_ret(t: &Tilstand, id: u64, vaerdi: &str, note: Option<&str>) -> Result<OrdbogUd, UiFejl> {
    aendr_ordbog(t, |poster| {
        let i = poster.iter().position(|p| p.id == id).ok_or_else(ukendt_post)?;
        let (v, n) = ob::valider(poster, poster[i].type_, vaerdi, note, Some(id)).map_err(|fejl| UiFejl::Ordbog { fejl })?;
        let p = &mut poster[i];
        zeroize::Zeroize::zeroize(&mut p.vaerdi);
        p.vaerdi = v;
        if let Some(gammel) = p.note.as_mut() {
            zeroize::Zeroize::zeroize(gammel);
        }
        p.note = n;
        Ok(())
    })
}

/// Fjerner en post.
pub fn ordbog_fjern(t: &Tilstand, id: u64) -> Result<OrdbogUd, UiFejl> {
    aendr_ordbog(t, |poster| {
        let i = poster.iter().position(|p| p.id == id).ok_or_else(ukendt_post)?;
        ob::nulstil(vec![poster.remove(i)]);
        Ok(())
    })
}

/// Et fund i "Prøv på tekst", samlet pr. tekst.
#[derive(Clone, Debug, Serialize)]
pub struct ProevFund {
    /// `fanget` (ordbogen finder værdien) | `aldrig` (genkenderne fandt den, men den står på "maskér aldrig").
    pub status: &'static str,
    /// Fundets art (som i Maskér).
    pub art: &'static str,
    /// Teksten i den indsatte tekst.
    pub tekst: String,
    /// Antal gange.
    pub antal: usize,
    /// Linjen for første gang.
    pub linje: usize,
}

/// Svaret fra "Prøv på tekst".
#[derive(Clone, Debug, Serialize)]
pub struct Proeve {
    /// Fundene.
    pub fund: Vec<ProevFund>,
    /// Antal fund i alt fra genkenderne og ordbogen (også dem, der ikke kommer fra ordbogen).
    pub i_alt: usize,
}

/// Kører analysen med ordbogen på en tekst og svarer med det, ordbogen fanger, og det, "maskér aldrig" beskytter.
/// Sagen røres ikke, og teksten gemmes ingen steder.
pub fn ordbog_proev(t: &Tilstand, tekst: &str) -> Result<Proeve, UiFejl> {
    tjek_tekst(tekst)?;
    let ordbog = t.kerne_ordbog();
    let med = kerne_analyser(tekst, &ordbog);
    let uden = kerne_analyser(tekst, &Ordbog::ny());
    ob::nulstil_kerne(ordbog);
    let linjer = Linjer::ny(tekst);
    let mut ud: Vec<ProevFund> = Vec::new();
    let mut plads: HashMap<(&'static str, String), usize> = HashMap::new();
    let mut laeg = |status: &'static str, f: &Fund| {
        let tekst_f = tekst[f.start..f.slut].to_string();
        match plads.get(&(status, tekst_f.to_lowercase())) {
            Some(&i) => ud[i].antal += 1,
            None => {
                plads.insert((status, tekst_f.to_lowercase()), ud.len());
                ud.push(ProevFund {
                    status,
                    art: art_navn(f.art),
                    tekst: tekst_f,
                    antal: 1,
                    linje: linjer.af(f.start),
                });
            }
        }
    };
    for f in med.iter().filter(|f| f.sikkerhed == Sikkerhed::Ordbog) {
        laeg("fanget", f);
    }
    // Et fund uden ordbog, som ordbogen har fjernet uden at sætte noget andet på samme sted: "maskér aldrig".
    for f in &uden {
        if !med.iter().any(|m| m.start < f.slut && f.start < m.slut) {
            laeg("aldrig", f);
        }
    }
    Ok(Proeve {
        fund: ud,
        i_alt: med.len(),
    })
}

// ------------------------------------------------------------------------------------------------------- indstillinger

/// Indstillingerne.
pub fn indstillinger_hent(t: &Tilstand) -> Indstillinger {
    t.indstillinger()
}

/// Gemmer indstillingerne. Uden mappe (tests) gælder de kun i hukommelsen.
pub fn indstillinger_gem(t: &Tilstand, ny: Indstillinger) -> Result<Indstillinger, UiFejl> {
    if !ny.gyldig() {
        return Err(UiFejl::Indstillinger { fejl: None });
    }
    let mut g = t.indst.lock().unwrap_or_else(|e| e.into_inner());
    if let Some(fil) = &t.indst_fil {
        if let Some(m) = fil.parent() {
            opret_mappe(m).map_err(|f| UiFejl::Indstillinger { fejl: Some(f) })?;
        }
        indstillinger::gem(fil, &ny).map_err(|f| UiFejl::Indstillinger { fejl: Some(f) })?;
    }
    *g = ny;
    Ok(ny)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn linjenumre() {
        let l = Linjer::ny("a\r\nb\nc");
        assert_eq!((l.af(0), l.af(3), l.af(5)), (1, 2, 3));
        assert_eq!(l.antal("a\r\nb\nc"), 3);
        assert_eq!(Linjer::ny("a\n").antal("a\n"), 1);
        assert_eq!(Linjer::ny("").antal(""), 0);
    }

    #[test]
    fn graensen_er_5_mib() {
        assert_eq!(MAKS_BYTES, 5_242_880);
        assert_eq!(tjek_tekst(""), Err(UiFejl::TomTekst));
        let stor = "a".repeat(MAKS_BYTES + 1);
        assert_eq!(
            tjek_tekst(&stor),
            Err(UiFejl::ForStor {
                bytes: MAKS_BYTES + 1,
                maks: MAKS_BYTES
            })
        );
        assert!(tjek_tekst(&stor[..MAKS_BYTES]).is_ok());
    }
}
