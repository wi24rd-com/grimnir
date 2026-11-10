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

use std::collections::{HashMap, HashSet};
use std::sync::{Mutex, MutexGuard};

use grimnir_core::{
    analyser as kerne_analyser, demasker as kerne_demasker, foreslaa_med_ordbog, laekagetjek, masker, Advarsel, AdvarselArt, AfledtArt,
    Art, Erstatning, Fejl, Fund, Klasse, Ordbog, Pulje, RestArt, Sag, Sikkerhed,
};
use serde::{Deserialize, Serialize};

/// Største tekst, skallen tager imod: 5 MiB (5 242 880 bytes). Større tekster kræver "Åbn fil" (B3).
pub const MAKS_BYTES: usize = 5 * 1024 * 1024;

/// Programmets tilstand: den midlertidige sag. Lukkes programmet, er den væk (B3 gemmer sager krypteret).
#[derive(Default)]
pub struct Tilstand {
    sag: Mutex<Sag>,
}

impl Tilstand {
    /// En tom tilstand.
    pub fn ny() -> Self {
        Tilstand::default()
    }

    /// Låsen til sagen. Sagen ændres kun ved at blive erstattet af en færdigregnet kopi, så en forgiftet lås (panik i
    /// en anden tråd) efterlader aldrig en halvt ændret sag; derfor bruges indholdet videre.
    fn sag(&self) -> MutexGuard<'_, Sag> {
        self.sag.lock().unwrap_or_else(|e| e.into_inner())
    }
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
}

impl From<Fejl> for UiFejl {
    fn from(f: Fejl) -> Self {
        UiFejl::Sagsdata { hvad: f.to_string() }
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

/// Svaret fra `sag_status` og `sag_nulstil`.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
pub struct SagStatus {
    /// Antal stavemåder med kode i sagen.
    pub poster: usize,
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
    if tekst.len() > MAKS_BYTES {
        return Err(UiFejl::ForStor {
            bytes: tekst.len(),
            maks: MAKS_BYTES,
        });
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
    /// Kernens "maskér aldrig" for dette valg: kun fravalgte værdier, sagen allerede kender (dér virker F1).
    aldrig: Ordbog,
    /// Alle fravalgte værdier med små bogstaver: lækagetjekkets rester sorteres mod dem.
    fravalgte: HashSet<String>,
    linjer: Linjer,
}

/// Regner forslag, valg og rettelser ud på en kopi af sagen. Sagen selv røres ikke.
///
/// `fravalgt`: rækker, der ikke maskeres (`None`: kernens standard). `rettelser`: koder, brugeren har skrevet.
fn beregn(sag: &Sag, tekst: &str, fravalgt: Option<&[usize]>, rettelser: &[Rettelse]) -> Result<Beregning, UiFejl> {
    let tom = Ordbog::ny();
    let linjer = Linjer::ny(tekst);
    let fund = kerne_analyser(tekst, &tom);
    let fund_ved: HashMap<(usize, usize), &Fund> = fund.iter().map(|f| ((f.start, f.slut), f)).collect();
    let fremmede = sag.valg().masker_fremmede;

    // 1. Fuldt gennemløb: alt får en kode, så alle rækker og deres grupper kendes.
    let mut alle = kopi(sag, true)?;
    let fund_alle: Vec<Fund> = fund.iter().map(slaaet_til).collect();
    let ers_alle = foreslaa_med_ordbog(&fund_alle, tekst, &mut alle, &tom);
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

    // 2. Gennemløbet, der gemmes: kun de valgte rækker. Kernen gennemløber "maskér aldrig" lineært for hvert fund,
    // så listen holdes kort: kun fravalgte værdier, som sagen kender i forvejen (F1 kan kun finde dem).
    let mut fravalgte: HashSet<String> = HashSet::new();
    for (g, v) in grupper.iter().zip(&valgt) {
        if !v {
            fravalgte.extend(g.vaerdier.iter().map(|x| x.to_ascii_lowercase()));
        }
    }
    let mut aldrig = Ordbog::ny();
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
        if forskellige.len() != 1 {
            fejl.push(RaekkeFejl {
                id: r.id,
                fejl: "flere_stavemaader",
                kode: r.kode.clone(),
            });
            continue;
        }
        let nu = forskellige.remove(0);
        if nu == ny {
            continue;
        }
        match kladde.ret(&nu, ny, tekst) {
            Ok(()) => {
                for (i, e) in ers.iter_mut().enumerate() {
                    if ers_gruppe[i] == Some(gi) && e.kode == nu {
                        e.kode = ny.to_string();
                    }
                }
                for k in koder[gi].iter_mut() {
                    *k = ny.to_string();
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
    // Sagen kopieres under låsen; selve beregningen sker uden lås.
    let sag = {
        let laast = t.sag();
        kopi(&laast, laast.valg().masker_fremmede)?
    };
    let b = beregn(&sag, tekst, fravalgt, rettelser)?;
    Ok(Analyse {
        advarsler: samlede_advarsler(&b.advarsler, &b.linjer),
        linjer: b.linjer.antal(tekst),
        raekker: b.raekker,
        fejl: b.fejl,
        bytes: tekst.len(),
    })
}

/// Maskerer med brugerens valg og rettelser og gemmer sagen. Afvises en rettelse, gemmes intet.
pub fn gem_og_masker(t: &Tilstand, tekst: &str, fravalgt: &[usize], rettelser: &[Rettelse]) -> Result<Maskering, UiFejl> {
    tjek_tekst(tekst)?;
    let mut sag = t.sag();
    let b = beregn(&sag, tekst, Some(fravalgt), rettelser)?;
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
    *sag = b.kladde;
    Ok(Maskering {
        maskeret,
        rester,
        advarsler,
        poster: sag.antal_poster(),
    })
}

/// Sætter sagens originaler tilbage i en tekst.
pub fn demasker(t: &Tilstand, tekst: &str) -> Result<Demaskering, UiFejl> {
    tjek_tekst(tekst)?;
    let sag = t.sag();
    let (ud, adv) = kerne_demasker(tekst, &sag);
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
    drop(sag);
    Ok(Demaskering {
        advarsler: samlede_advarsler(&adv, &Linjer::ny(tekst)),
        tekst: ud,
        koder,
    })
}

/// Antal poster i sagen.
pub fn sag_status(t: &Tilstand) -> SagStatus {
    SagStatus {
        poster: t.sag().antal_poster(),
    }
}

/// Tømmer sagen.
pub fn sag_nulstil(t: &Tilstand) -> SagStatus {
    *t.sag() = Sag::default();
    sag_status(t)
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
