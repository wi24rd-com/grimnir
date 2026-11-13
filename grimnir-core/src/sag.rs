//! Sagen: nøgletabellen i hukommelsen (original ↔ kode), net-afbildninger, tællere og valg (K3).

use std::collections::{HashMap, HashSet};
use std::fmt;

use aho_corasick::{AhoCorasick, Input, MatchKind};

use crate::analyse::STOPORD;
use crate::graense::{ved_graense, Moenster};
use crate::kodeform::{find_kodeformer, Kodeform};
use crate::net::{formater_ipv4, formater_ipv6, formater_ipv6_kort, formater_mac, har_nuller, laes_ipv4, laes_ipv6, laes_mac, MacForm};
use crate::original::Original;
use crate::typer::{Advarsel, AdvarselArt, Fejl, Klasse, Pulje, KLASSER};

/// Koden er set alene (ikke som del af en sammensat værdi).
pub const FORM_ALENE: u8 = 1;
/// Koden er set som del af et FQDN eller en mailadresse.
pub const FORM_DEL: u8 = 2;
/// NetBIOS-koden er set efterfulgt af to skråstreger (JSON-escaped).
pub const FORM_ESC2: u8 = 4;
/// Koden er set efter en URL-kodning (`%XX`).
pub const FORM_PROCENT: u8 = 8;

/// V-OPBYG.2 N1: største længde af én note i tegn (Unicode-skalarværdier). Omkring en A4-side: nok til et referat af en
/// supportsag, men så sagens fil ikke kan vokse uden loft.
pub const MAKS_NOTE_TEGN: usize = 4000;
/// V-OPBYG.2 N1: største antal noter i én sag. Med [`MAKS_NOTE_TEGN`] bliver noterne højst 800.000 tegn (højst 3,2 MB som
/// UTF-8) i sagens krypterede fil.
pub const MAKS_NOTER: usize = 200;

/// V-OPBYG.2 N1: en note i sagen: brugerens egen tekst (uden titel og formatering; linjeskift som skrevet), tidspunktet
/// for oprettelse og for seneste rettelse (millisekunder siden 1970, UTC; skallens ur) og et løbenummer i sagen.
///
/// Noten bruges aldrig af maskering, lækagetjek eller demaskering; den kommer aldrig med i en maskeret tekst eller i
/// demaskeringens resultat. Typen har bevidst ingen `Debug`: teksten er brugerens.
#[derive(Clone, PartialEq, Eq)]
pub struct Note {
    /// Løbenummeret i sagen (1, 2, 3 …); et slettet nummer bruges ikke igen, så længe sagen har noter.
    pub nr: u64,
    /// Teksten, som brugeren skrev den.
    pub tekst: String,
    /// Oprettet (ms siden 1970, UTC).
    pub oprettet: u64,
    /// Sidst rettet (ms siden 1970, UTC); `None`, hvis noten ikke er rettet.
    pub rettet: Option<u64>,
}

/// En notes tekst: ikke kun mellemrum og højst [`MAKS_NOTE_TEGN`] tegn.
fn tjek_note(tekst: &str) -> Result<(), Fejl> {
    if tekst.trim().is_empty() {
        return Err(Fejl::NoteTom);
    }
    if tekst.chars().count() > MAKS_NOTE_TEGN {
        return Err(Fejl::NoteForLang { maks: MAKS_NOTE_TEGN });
    }
    Ok(())
}

/// Noterne hænger sammen: højst [`MAKS_NOTER`], hver med en gyldig tekst og et nummer fra 1 til `taeller`, intet nummer
/// to gange.
fn tjek_noter(noter: &[Note], taeller: u64) -> Result<(), Fejl> {
    let ugyldig = || Fejl::UgyldigeSagsdata { hvad: "noter" };
    if noter.len() > MAKS_NOTER {
        return Err(ugyldig());
    }
    let mut set = HashSet::new();
    for n in noter {
        if n.nr == 0 || n.nr > taeller || !set.insert(n.nr) || tjek_note(&n.tekst).is_err() {
            return Err(ugyldig());
        }
    }
    Ok(())
}

/// Valg pr. sag.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Valg {
    /// Maskér også fremmede offentlige adresser (ADR D4; standard: nej).
    pub masker_fremmede: bool,
    /// Bevar sidste oktet i egne net (ADR D5; standard: ja). Slået fra omblandes værtsdelen inden for nettet.
    pub bevar_sidste_oktet: bool,
}

impl Default for Valg {
    fn default() -> Self {
        Valg {
            masker_fremmede: false,
            bevar_sidste_oktet: true,
        }
    }
}

/// En enhed: én maskine, én bruger, én adresse. Flere stavemåder deler enhed.
#[derive(Clone)]
pub struct Enhed {
    /// Kodeklassen.
    pub klasse: Klasse,
    /// Nøglen (små bogstaver for navne, talværdi for adresser).
    pub noegle: Original,
    /// Kodens grundform (`h0001`, `198.18.0.1`).
    pub grundform: String,
}

/// En stavemåde og dens kode.
#[derive(Clone)]
pub struct Post {
    /// Plads i [`SagData::enheder`].
    pub enhed: usize,
    /// Originalens præcise bytes.
    pub original: Original,
    /// Koden.
    pub kode: String,
    /// Hvordan koden er set i originalen (`FORM_*`).
    pub former: u8,
    /// Sand, hvis brugeren har rettet koden.
    pub rettet: bool,
}

/// Tællere for tildeling.
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct Taellere {
    /// Sidste nummer pr. klasse (navnekoder).
    pub navne: [u64; KLASSER],
    /// Næste mål-/24 i 198.18.0.0/15 (0–511).
    pub net4: u32,
    /// Næste plads i den fortløbende IPv4-pulje (dokumentationsnettene, derefter 240.0.0.0/4).
    pub pulje4: u64,
    /// Næste mål-/64 (under 2001:db8::/32, derefter 3fff::/20).
    pub net6: u64,
    /// Næste plads i MAC-puljen.
    pub mac: u64,
}

/// Sagens indhold som almindelige Rust-værdier, så B3 kan gemme det krypteret.
/// Ingen serialisering og ingen kryptering her. Typen har bevidst ingen afledt `Debug`.
#[derive(Clone, Default)]
pub struct SagData {
    /// Valg pr. sag.
    pub valg: Valg,
    /// Enhederne.
    pub enheder: Vec<Enhed>,
    /// Stavemåder og koder.
    pub poster: Vec<Post>,
    /// Egne /24 → mål-/24. Nøglen er nettets tal (a<<16 | b<<8 | c) som tekst.
    pub net4: Vec<(Original, u32)>,
    /// Egne /64 → mål-/64. Nøglen er prefikset som 16 hextegn.
    pub net6: Vec<(Original, u64)>,
    /// Mål-/24 → sidst tildelte værtsnummer (når sidste oktet ikke bevares).
    pub vaerter4: Vec<(u32, u32)>,
    /// Mål-/64 → sidste løbenummer.
    pub iid6: Vec<(u64, u64)>,
    /// SID-domænedele (`a-b-c`); plads + 1 er domænets nummer i koden.
    pub sid_domaener: Vec<Original>,
    /// Tællere.
    pub taellere: Taellere,
    /// Navnekoder, der stod i en tekst (små bogstaver) og derfor aldrig tages i brug.
    pub reserverede_navne: Vec<String>,
    /// IPv4-adresser i kodeområderne, der stod i en tekst.
    pub reserverede_ip4: Vec<u32>,
    /// IPv6-adresser i kodeområderne, der stod i en tekst.
    pub reserverede_ip6: Vec<u128>,
    /// MAC-adresser i kodeområderne, der stod i en tekst.
    pub reserverede_mac: Vec<u64>,
    /// Puljer, hvis overløb allerede er meldt (bit pr. [`Pulje`]).
    pub overloeb_meldt: u8,
    /// Koder, brugeren selv har skrevet med [`Sag::ret`], også tidligere rettelser (F6). Indgår i
    /// reservationen af senere tekster; kollisionspasset finder de nuværende via sagens koder.
    pub rettede_koder: Vec<String>,
    /// Gamle koder (ADR D18): (koden, posten). En rettet kode bliver ved med at pege på sin post, så tekster, der er
    /// maskeret før rettelsen, stadig kan demaskeres. En alias-kode er reserveret: den tildeles aldrig til en anden
    /// værdi, og kollisionspasset maskerer den som en af sagens koder.
    pub aliaser: Vec<(String, usize)>,
    /// V-OPBYG.2 N1: sagens noter i den rækkefølge, de er skrevet. Indgår ikke i nogen maskering.
    pub noter: Vec<Note>,
    /// V-OPBYG.2 N1: det sidste løbenummer, en note har fået.
    pub note_taeller: u64,
}

#[derive(Default)]
struct Indeks {
    stavning: HashMap<(Klasse, Original), usize>,
    enhed: HashMap<(Klasse, Original), usize>,
    kode: HashMap<String, usize>,
    kode_smaa: HashMap<String, usize>,
    alias: HashMap<String, usize>,
    alias_smaa: HashMap<String, Vec<usize>>,
    /// Koder og aliaser uden en af Grimnirs kodeformer (selvvalgte, V-PUDS.2 N1), med små bogstaver → posterne.
    uden_form: HashMap<String, Vec<usize>>,
    net4: HashMap<u32, u32>,
    maal4: HashMap<u32, u32>,
    net6: HashMap<u64, u64>,
    maal6: HashMap<u64, u64>,
    vaerter4: HashMap<u32, u32>,
    iid6: HashMap<u64, u64>,
    brugte4: HashSet<u32>,
    brugte6: HashSet<u128>,
    brugtemac: HashSet<u64>,
    sid: HashMap<Original, usize>,
    res_navne: HashSet<String>,
    res4: HashSet<u32>,
    res_net4: HashSet<u32>,
    res6: HashSet<u128>,
    res_net6: HashSet<u64>,
    resmac: HashSet<u64>,
}

/// Nøgletabellen for én sag.
pub struct Sag {
    data: SagData,
    idx: Indeks,
    advarsler: Vec<Advarsel>,
}

impl fmt::Debug for Sag {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("Sag")
            .field("valg", &self.data.valg)
            .field("enheder", &self.data.enheder.len())
            .field("poster", &self.data.poster.len())
            .field("net4", &self.data.net4.len())
            .field("net6", &self.data.net6.len())
            .field("noter", &self.data.noter.len())
            .field("advarsler", &self.advarsler.len())
            .finish()
    }
}

const BASE4: u32 = 0x00C6_1200; // 198.18.0 som /24-tal
const TEST_NET: [u32; 3] = [0x00CB_0071, 0x00C6_3364, 0x00C0_0002]; // 203.0.113, 198.51.100, 192.0.2
const PULJE4_DOK: u64 = 762;

fn pulje4_verdi(i: u64) -> u32 {
    if i < PULJE4_DOK {
        (TEST_NET[(i / 254) as usize] << 8) | ((i % 254) as u32 + 1)
    } else {
        0xF000_0000u32.wrapping_add((i - PULJE4_DOK + 1) as u32)
    }
}

fn pulje_bit(p: Pulje) -> u8 {
    match p {
        Pulje::EgneNet => 1,
        Pulje::Fremmede => 2,
        Pulje::Mac => 4,
        Pulje::Ipv6 => 8,
    }
}

fn smaa(s: &str) -> String {
    s.to_ascii_lowercase()
}

/// Sætter et bogstav-suffiks på en kode (`h0001` → `h0001b`, `d01.example` → `d01b.example`).
fn med_suffiks(kode: &str, k: u64, klasse: Klasse) -> String {
    let mut n = k;
    let mut s = Vec::new();
    loop {
        s.push(b'b' + ((n - 1) % 25) as u8);
        n = (n - 1) / 25;
        if n == 0 {
            break;
        }
    }
    s.reverse();
    let suffiks = String::from_utf8_lossy(&s).into_owned();
    match (klasse, kode.find('.')) {
        (Klasse::Domaene, Some(p)) => format!("{}{}{}", &kode[..p], suffiks, &kode[p..]),
        _ => format!("{kode}{suffiks}"),
    }
}

/// En kode, brugeren skriver, skal begynde og slutte med et bogstav eller et ciffer (ellers kan den ikke findes ved
/// grænsereglen).
fn gyldig_kode(ny: &str) -> Result<(), Fejl> {
    let nb = ny.as_bytes();
    if nb.is_empty() || !nb[0].is_ascii_alphanumeric() || !nb[nb.len() - 1].is_ascii_alphanumeric() {
        return Err(Fejl::UgyldigKode { kode: ny.to_string() });
    }
    Ok(())
}

/// `ny` med originalens store/små bogstaver, som [`Sag::kode_navn`] spejler grundformen.
fn spejlet(klasse: Klasse, ny: &str, original: &str) -> String {
    let o = original.as_bytes();
    if !klasse.spejler() {
        ny.to_string()
    } else if !o.iter().any(u8::is_ascii_uppercase) {
        ny.to_ascii_lowercase()
    } else if !o.iter().any(u8::is_ascii_lowercase) {
        ny.to_ascii_uppercase()
    } else {
        ny.to_string()
    }
}

/// Sand, hvis hele koden har en af Grimnirs kodeformer (så finder demaskeringens F4 den med andre store/små
/// bogstaver via [`find_kodeformer`]).
fn har_kodeform(kode: &str) -> bool {
    let b = kode.as_bytes();
    let mut hel = false;
    find_kodeformer(b, |s, e, _| hel |= s == 0 && e == b.len());
    hel
}

/// Om en kendt original må genbruges som frit ord i en ny tekst (F1).
///
/// Adresser er udeladt, fordi genkenderne altid finder dem. Under fire tegn, rene tal og stopord
/// (`admin`, `root` …) er udeladt, fordi de står som almindelige ord og tal overalt; de samme
/// stopord bruges allerede af de afledte former i analysen.
fn genbruges_som_ord(klasse: Klasse, original: &str) -> bool {
    !matches!(klasse, Klasse::Ipv4 | Klasse::Ipv6 | Klasse::Mac)
        && original.chars().count() >= 4
        && !original.bytes().all(|b| b.is_ascii_digit())
        && !STOPORD.contains(&original.to_ascii_lowercase().as_str())
}

impl Default for Sag {
    fn default() -> Self {
        Sag::ny(Valg::default())
    }
}

impl Sag {
    /// En ny, tom sag.
    pub fn ny(valg: Valg) -> Self {
        Sag {
            data: SagData {
                valg,
                ..SagData::default()
            },
            idx: Indeks::default(),
            advarsler: Vec::new(),
        }
    }

    /// Genskaber en sag fra data (fx læst af B3). Indeksene bygges igen.
    pub fn fra_data(data: SagData) -> Result<Self, Fejl> {
        let mut idx = Indeks::default();
        for (i, e) in data.enheder.iter().enumerate() {
            idx.enhed.insert((e.klasse, e.noegle.clone()), i);
        }
        for (i, p) in data.poster.iter().enumerate() {
            let e = data.enheder.get(p.enhed).ok_or(Fejl::UgyldigeSagsdata {
                hvad: "post peger på ukendt enhed",
            })?;
            if p.kode.is_empty() || idx.kode.insert(p.kode.clone(), i).is_some() {
                return Err(Fejl::UgyldigeSagsdata {
                    hvad: "kode er tom eller findes to gange",
                });
            }
            idx.kode_smaa.entry(smaa(&p.kode)).or_insert(i);
            if !har_kodeform(&p.kode) {
                idx.uden_form.entry(smaa(&p.kode)).or_default().push(i);
            }
            idx.stavning.insert((e.klasse, p.original.clone()), i);
            match e.klasse {
                Klasse::Ipv4 => {
                    if let Some(ip) = laes_ipv4(p.kode.as_bytes()) {
                        idx.brugte4.insert(ip.verdi);
                    }
                }
                Klasse::Ipv6 => {
                    if let Some(ip) = laes_ipv6(p.kode.as_bytes()) {
                        idx.brugte6.insert(ip.verdi);
                    }
                }
                Klasse::Mac => {
                    if let Some(m) = laes_mac(p.kode.as_bytes()) {
                        idx.brugtemac.insert(m.verdi);
                    }
                }
                _ => {}
            }
        }
        for (k, p) in &data.aliaser {
            if k.is_empty() || *p >= data.poster.len() || idx.kode.contains_key(k) || idx.alias.insert(k.clone(), *p).is_some() {
                return Err(Fejl::UgyldigeSagsdata {
                    hvad: "alias er tom, peger på ukendt post eller findes to gange",
                });
            }
            idx.alias_smaa.entry(smaa(k)).or_default().push(*p);
            if !har_kodeform(k) {
                idx.uden_form.entry(smaa(k)).or_default().push(*p);
            }
        }
        for (n, m) in &data.net4 {
            let net = n.som_tekst().parse::<u32>().map_err(|_| Fejl::UgyldigeSagsdata { hvad: "net4" })?;
            idx.net4.insert(net, *m);
            idx.maal4.insert(*m, net);
        }
        for (n, m) in &data.net6 {
            let net = u64::from_str_radix(n.som_tekst(), 16).map_err(|_| Fejl::UgyldigeSagsdata { hvad: "net6" })?;
            idx.net6.insert(net, *m);
            idx.maal6.insert(*m, net);
        }
        idx.vaerter4 = data.vaerter4.iter().copied().collect();
        idx.iid6 = data.iid6.iter().copied().collect();
        idx.sid = data.sid_domaener.iter().cloned().enumerate().map(|(i, d)| (d, i)).collect();
        idx.res_navne = data.reserverede_navne.iter().cloned().collect();
        idx.res4 = data.reserverede_ip4.iter().copied().collect();
        idx.res_net4 = idx.res4.iter().map(|v| v >> 8).collect();
        idx.res6 = data.reserverede_ip6.iter().copied().collect();
        idx.res_net6 = idx.res6.iter().map(|v| (v >> 64) as u64).collect();
        idx.resmac = data.reserverede_mac.iter().copied().collect();
        tjek_noter(&data.noter, data.note_taeller)?;
        Ok(Sag {
            data,
            idx,
            advarsler: Vec::new(),
        })
    }

    /// Sagens data.
    pub fn data(&self) -> &SagData {
        &self.data
    }

    /// Giver sagens data ud.
    pub fn til_data(self) -> SagData {
        self.data
    }

    /// Valgene for sagen.
    pub fn valg(&self) -> Valg {
        self.data.valg
    }

    /// Antal stavemåder med kode.
    pub fn antal_poster(&self) -> usize {
        self.data.poster.len()
    }

    // ------------------------------------------------------------ noter (V-OPBYG.2 N1)

    /// Sagens noter i den rækkefølge, de er skrevet.
    pub fn noter(&self) -> &[Note] {
        &self.data.noter
    }

    /// Antal noter.
    pub fn antal_noter(&self) -> usize {
        self.data.noter.len()
    }

    /// Det sidste løbenummer, en note har fået.
    pub fn note_taeller(&self) -> u64 {
        self.data.note_taeller
    }

    /// Sand, hvis sagen har noget, der går tabt, hvis den kasseres: stavemåder med kode eller noter (D21).
    pub fn har_indhold(&self) -> bool {
        !self.data.poster.is_empty() || !self.data.noter.is_empty()
    }

    /// Tilføjer en note med tidspunktet `nu` (ms siden 1970, UTC; skallens ur) og svarer med dens løbenummer. Afvises,
    /// hvis teksten er tom (kun mellemrum), er længere end [`MAKS_NOTE_TEGN`] tegn, eller sagen allerede har
    /// [`MAKS_NOTER`] noter; så er intet ændret. Teksten gennemsøges ikke (D27: ingen advarsel om værdier i en note).
    pub fn tilfoej_note(&mut self, tekst: &str, nu: u64) -> Result<u64, Fejl> {
        tjek_note(tekst)?;
        if self.data.noter.len() >= MAKS_NOTER {
            return Err(Fejl::ForMangeNoter { maks: MAKS_NOTER });
        }
        self.data.note_taeller += 1;
        let nr = self.data.note_taeller;
        self.data.noter.push(Note {
            nr,
            tekst: tekst.to_string(),
            oprettet: nu,
            rettet: None,
        });
        Ok(nr)
    }

    /// Retter teksten i note `nr`; tidspunktet for seneste rettelse bliver `nu`. Svarer med den gamle tekst, så skallen
    /// kan nulstille den (tom, hvis teksten er uændret; så ændres intet). Afvises som [`Sag::tilfoej_note`], og med
    /// [`Fejl::UkendtNote`], hvis noten ikke findes.
    pub fn ret_note(&mut self, nr: u64, tekst: &str, nu: u64) -> Result<String, Fejl> {
        tjek_note(tekst)?;
        let n = self.data.noter.iter_mut().find(|n| n.nr == nr).ok_or(Fejl::UkendtNote { nr })?;
        if n.tekst == tekst {
            return Ok(String::new());
        }
        n.rettet = Some(nu);
        Ok(std::mem::replace(&mut n.tekst, tekst.to_string()))
    }

    /// Sletter note `nr` og giver den ud (så skallen kan nulstille teksten). [`Fejl::UkendtNote`], hvis den ikke findes.
    pub fn slet_note(&mut self, nr: u64) -> Result<Note, Fejl> {
        let i = self.data.noter.iter().position(|n| n.nr == nr).ok_or(Fejl::UkendtNote { nr })?;
        let n = self.data.noter.remove(i);
        if self.data.noter.is_empty() {
            // Uden noter begynder løbenummeret forfra; sagens fil har så samme form som før V-OPBYG.2 (formatversion 1).
            self.data.note_taeller = 0;
        }
        Ok(n)
    }

    /// Lægger noterne tilbage (fx når en navngiven sag ikke kunne gemmes efter en ændring) og giver de nuværende ud.
    /// Afvises med [`Fejl::UgyldigeSagsdata`], hvis noterne ikke hænger sammen; så er intet ændret.
    pub fn erstat_noter(&mut self, noter: Vec<Note>, taeller: u64) -> Result<(Vec<Note>, u64), Fejl> {
        tjek_noter(&noter, taeller)?;
        let gamle = std::mem::replace(&mut self.data.noter, noter);
        let gammel_taeller = std::mem::replace(&mut self.data.note_taeller, taeller);
        Ok((gamle, gammel_taeller))
    }

    /// Originalen bag en kode eller en gammel kode (alias, D18).
    pub fn opslag(&self, kode: &str) -> Option<&Original> {
        self.post_for(kode).map(|i| &self.data.poster[i].original)
    }

    /// Posten bag en kode eller et alias.
    fn post_for(&self, kode: &str) -> Option<usize> {
        self.idx.kode.get(kode).or_else(|| self.idx.alias.get(kode)).copied()
    }

    /// Koden for en original (præcis stavemåde), hvis den findes.
    pub fn kode_for_original(&self, klasse: Klasse, original: &str) -> Option<&str> {
        self.idx
            .stavning
            .get(&(klasse, Original::ny(original)))
            .map(|i| self.data.poster[*i].kode.as_str())
    }

    /// Henter og tømmer advarsler fra tildelingen (overløb).
    pub fn tag_advarsler(&mut self) -> Vec<Advarsel> {
        std::mem::take(&mut self.advarsler)
    }

    /// Brugerens rettelse af en kode (fri tekst) for én stavemåde. Afvises, hvis den nye kode findes i sagen (også som
    /// alias for en anden post og uafhængigt af store/små), er reserveret eller står i teksten. Den gamle kode bliver et
    /// alias (D18): den peger stadig på posten ved demaskering og kan ikke gives til en anden værdi.
    pub fn ret(&mut self, kode: &str, ny: &str, tekst: &str) -> Result<(), Fejl> {
        let i = *self.idx.kode.get(kode).ok_or_else(|| Fejl::UkendtKode { kode: kode.to_string() })?;
        gyldig_kode(ny)?;
        if ny == kode {
            return Err(Fejl::KodeKolliderer { kode: ny.to_string() });
        }
        self.omdoeb(&[(i, ny.to_string())], ny, tekst)
    }

    /// Omdøber en hel enhed (alle dens stavemåder) samlet (fund 3 i V-SKAL.2). Den nye kode spejler hver stavemådes
    /// store/små bogstaver som de automatiske koder: en stavemåde med kun små bogstaver får `ny` med små, en med kun
    /// store får `ny` med store, en blandet får `ny`, som den er skrevet. Falder to stavemåder sammen, får den næste
    /// et bogstav bagefter (`kunde7b`), som de automatiske koder. De gamle koder bliver aliaser (D18), og nye stavemåder
    /// af enheden får senere en kode ud fra `ny`.
    ///
    /// Svaret er (gammel kode, ny kode) for hver stavemåde, der fik en ny kode.
    pub fn ret_enhed(&mut self, kode: &str, ny: &str, tekst: &str) -> Result<Vec<(String, String)>, Fejl> {
        let i = *self.idx.kode.get(kode).ok_or_else(|| Fejl::UkendtKode { kode: kode.to_string() })?;
        gyldig_kode(ny)?;
        let enhed = self.data.poster[i].enhed;
        let klasse = self.data.enheder[enhed].klasse;
        let mut nye: Vec<(usize, String)> = Vec::new();
        for (j, p) in self.data.poster.iter().enumerate().filter(|(_, p)| p.enhed == enhed) {
            let foerste = spejlet(klasse, ny, p.original.som_tekst());
            let k = if nye.iter().any(|(_, x)| *x == foerste) {
                (1..)
                    .map(|n| med_suffiks(&foerste, n, klasse))
                    .find(|c| !nye.iter().any(|(_, x)| x == c))
                    .unwrap_or_default()
            } else {
                foerste
            };
            nye.push((j, k));
        }
        let par: Vec<(String, String)> = nye
            .iter()
            .filter(|(j, k)| self.data.poster[*j].kode != *k)
            .map(|(j, k)| (self.data.poster[*j].kode.clone(), k.clone()))
            .collect();
        if par.is_empty() {
            return Ok(par);
        }
        self.omdoeb(&nye, ny, tekst)?;
        if klasse.spejler() {
            self.data.enheder[enhed].grundform = ny.to_string();
        }
        Ok(par)
    }

    /// Giver posterne nye koder samlet. `oensket` er brugerens kode (til fejlen). Alt kontrolleres, før noget ændres.
    fn omdoeb(&mut self, nye: &[(usize, String)], oensket: &str, tekst: &str) -> Result<(), Fejl> {
        let kollision = || Fejl::KodeKolliderer { kode: oensket.to_string() };
        let saet: HashSet<usize> = nye.iter().map(|(i, _)| *i).collect();
        let t = tekst.as_bytes();
        let tl = t.to_ascii_lowercase();
        for (a, (i, ny)) in nye.iter().enumerate() {
            gyldig_kode(ny)?;
            let l = smaa(ny);
            let moenster = self.klasse_af(*i).moenster();
            let andre_poster = self.idx.kode.get(ny.as_str()).is_some_and(|j| j != i)
                || self
                    .data
                    .poster
                    .iter()
                    .enumerate()
                    .any(|(j, p)| !saet.contains(&j) && smaa(&p.kode) == l);
            let andre_aliaser = self.idx.alias.get(ny.as_str()).is_some_and(|j| j != i)
                || self.idx.alias_smaa.get(&l).is_some_and(|v| v.iter().any(|j| !saet.contains(j)));
            let i_tekst = {
                let nb = l.as_bytes();
                let mut pos = 0;
                let mut fundet = false;
                while let Some(p) = tl[pos..].windows(nb.len()).position(|w| w == nb) {
                    if ved_graense(t, pos + p, pos + p + nb.len(), moenster) {
                        fundet = true;
                        break;
                    }
                    pos += p + 1;
                }
                fundet
            };
            if nye[..a].iter().any(|(_, k)| k == ny) || andre_poster || andre_aliaser || self.idx.res_navne.contains(&l) || i_tekst {
                return Err(kollision());
            }
        }
        let mut beroerte: HashSet<String> = HashSet::new();
        for (i, ny) in nye {
            let i = *i;
            if self.data.poster[i].kode == *ny {
                continue;
            }
            // Brugeren går tilbage til en af postens egne gamle koder: den er ikke længere et alias.
            if self.idx.alias.get(ny.as_str()) == Some(&i) {
                self.idx.alias.remove(ny.as_str());
                if let Some(v) = self.idx.alias_smaa.get_mut(&smaa(ny)) {
                    if let Some(x) = v.iter().position(|j| *j == i) {
                        v.remove(x);
                    }
                    if v.is_empty() {
                        self.idx.alias_smaa.remove(&smaa(ny));
                    }
                }
                self.data.aliaser.retain(|(k, p)| !(k == ny && *p == i));
            }
            let gammel = std::mem::replace(&mut self.data.poster[i].kode, ny.clone());
            self.data.poster[i].rettet = true;
            if !self.data.rettede_koder.iter().any(|k| k == ny) {
                self.data.rettede_koder.push(ny.clone());
            }
            self.idx.kode.remove(&gammel);
            self.idx.kode.insert(ny.clone(), i);
            beroerte.insert(smaa(&gammel));
            beroerte.insert(smaa(ny));
            self.idx.alias.insert(gammel.clone(), i);
            self.idx.alias_smaa.entry(smaa(&gammel)).or_default().push(i);
            self.data.aliaser.push((gammel, i));
        }
        // Opslaget uafhængigt af store/små: første post med koden, som `fra_data` bygger det. Det samme for koderne og
        // aliaserne uden kodeform (først koderne, så aliaserne).
        for l in &beroerte {
            self.idx.kode_smaa.remove(l);
            self.idx.uden_form.remove(l);
        }
        for (j, p) in self.data.poster.iter().enumerate() {
            let l = smaa(&p.kode);
            if beroerte.contains(&l) {
                self.idx.kode_smaa.entry(l.clone()).or_insert(j);
                if !har_kodeform(&p.kode) {
                    self.idx.uden_form.entry(l).or_default().push(j);
                }
            }
        }
        for (k, j) in &self.data.aliaser {
            let l = smaa(k);
            if beroerte.contains(&l) && !har_kodeform(k) {
                self.idx.uden_form.entry(l).or_default().push(*j);
            }
        }
        Ok(())
    }

    // ------------------------------------------------------------ til resten af craten

    pub(crate) fn klasse_af(&self, post: usize) -> Klasse {
        self.data.enheder[self.data.poster[post].enhed].klasse
    }

    pub(crate) fn post(&self, i: usize) -> &Post {
        &self.data.poster[i]
    }

    pub(crate) fn poster(&self) -> &[Post] {
        &self.data.poster
    }

    /// Sand, hvis navnekoden stod bogstaveligt i en tekst i sagen (og derfor er reserveret).
    pub(crate) fn reserveret_navn(&self, kode: &str) -> bool {
        self.idx.res_navne.contains(&smaa(kode))
    }

    /// Posten for en kode eller et alias uafhængigt af store/små bogstaver (F4).
    pub(crate) fn kode_smaa(&self, kode: &str) -> Option<usize> {
        let l = smaa(kode);
        self.idx
            .kode_smaa
            .get(&l)
            .copied()
            .or_else(|| self.idx.alias_smaa.get(&l).and_then(|v| v.first().copied()))
    }

    /// Sagens selvvalgte koder og aliaser uden kodeform, hvor kun store/små bogstaver afviger (V-PUDS.2 N1): (start, slut,
    /// post). Samme grænseregel som [`Sag::find_koder`]: længst til venstre, derefter længst, og en kortere kode med samme
    /// start, hvis den længste ikke står ved en grænse. Et spænd, der overlapper et præcist træf (`praecise`, sorteret), er
    /// udeladt: det præcise træf vinder. Posten er `None`, hvis koden bortset fra store/små hører til poster i flere
    /// enheder ([`Sag::ret`] afviser det; det kan kun komme fra data udefra); så sættes ingen af dem tilbage.
    pub(crate) fn find_selvvalgte_smaa(&self, t: &[u8], praecise: &[(usize, usize, usize)]) -> Vec<(usize, usize, Option<usize>)> {
        let mut ud = Vec::new();
        if self.idx.uden_form.is_empty() {
            return ud;
        }
        let Ok(ac) = AhoCorasick::builder()
            .ascii_case_insensitive(true)
            .match_kind(MatchKind::LeftmostLongest)
            .build(self.idx.uden_form.keys())
        else {
            return ud;
        };
        let overlapper = |s: usize, e: usize| {
            let j = praecise.partition_point(|x| x.1 <= s);
            praecise.get(j).is_some_and(|x| x.0 < e)
        };
        let mut pos = 0;
        while pos < t.len() {
            let Some(m) = ac.find(Input::new(t).span(pos..t.len())) else {
                break;
            };
            let s = m.start();
            let valgt = (s + 1..=m.end()).rev().find_map(|e| {
                let l = std::str::from_utf8(&t[s..e]).ok()?.to_ascii_lowercase();
                let poster = self.idx.uden_form.get(&l)?;
                let p = *poster.first()?;
                (ved_graense(t, s, e, self.klasse_af(p).moenster()) && !overlapper(s, e)).then_some((e, poster))
            });
            match valgt {
                Some((e, poster)) => {
                    let enhed = self.data.poster[poster[0]].enhed;
                    let p = poster.iter().all(|q| self.data.poster[*q].enhed == enhed).then_some(poster[0]);
                    ud.push((s, e, p));
                    pos = e;
                }
                None => pos = s + 1,
            }
        }
        ud
    }

    /// Det egne /24 bag et mål-/24.
    pub(crate) fn eget_net_for(&self, maal: u32) -> Option<u32> {
        self.idx.maal4.get(&maal).copied()
    }

    pub(crate) fn maal6_kendt(&self, maal: u64) -> bool {
        self.idx.maal6.contains_key(&maal)
    }

    pub(crate) fn advar(&mut self, p: Pulje) {
        let bit = pulje_bit(p);
        if self.data.overloeb_meldt & bit == 0 {
            self.data.overloeb_meldt |= bit;
            self.advarsler.push(Advarsel {
                art: AdvarselArt::Overloeb(p),
                start: 0,
                slut: 0,
                kode: String::new(),
                forslag: None,
            });
        }
    }

    /// Reserverer alt i teksten, der har en kodes form, så det aldrig tages i brug (kontrol 8.1).
    pub(crate) fn reserver(&mut self, t: &[u8]) {
        let mut former = Vec::new();
        find_kodeformer(t, |s, e, k| former.push((s, e, k)));
        // Brugerens egne koder har ingen fast form; de findes uafhængigt af store/små (F6).
        if !self.data.rettede_koder.is_empty() {
            let ac = AhoCorasick::builder()
                .ascii_case_insensitive(true)
                .match_kind(MatchKind::LeftmostLongest)
                .build(&self.data.rettede_koder);
            if let Ok(ac) = ac {
                for m in ac.find_iter(t) {
                    if ved_graense(t, m.start(), m.end(), Moenster::Navn) {
                        former.push((m.start(), m.end(), Kodeform::Navn(Klasse::Ord)));
                    }
                }
            }
        }
        for (s, e, k) in former {
            match k {
                Kodeform::Navn(k) => {
                    let l = String::from_utf8_lossy(&t[s..e]).to_ascii_lowercase();
                    // En SID med RID reserverer også domænedelen alene (`s-1-5-21-0-0-1`).
                    let domaene =
                        (k == Klasse::Sid && l.matches('-').count() == 7).then(|| l[..l.rfind('-').unwrap_or(l.len())].to_string());
                    for r in std::iter::once(l).chain(domaene) {
                        if self.idx.res_navne.insert(r.clone()) {
                            self.data.reserverede_navne.push(r);
                        }
                    }
                }
                Kodeform::Ipv4(v) => {
                    if self.idx.res4.insert(v) {
                        self.idx.res_net4.insert(v >> 8);
                        self.data.reserverede_ip4.push(v);
                    }
                }
                Kodeform::Ipv6(v) => {
                    if self.idx.res6.insert(v) {
                        self.idx.res_net6.insert((v >> 64) as u64);
                        self.data.reserverede_ip6.push(v);
                    }
                }
                Kodeform::Mac(v) => {
                    if self.idx.resmac.insert(v) {
                        self.data.reserverede_mac.push(v);
                    }
                }
            }
        }
    }

    /// Sand, hvis mål-/24 er i brug i sagen.
    pub(crate) fn maal4_i_brug(&self, net: u32) -> bool {
        self.idx.maal4.contains_key(&net)
    }

    /// Sagens kendte originaler i teksten ved grænser: (start, slut, post) (F1). Navne findes
    /// uafhængigt af store/små, hemmeligheder kun bogstaveligt. Se [`genbruges_som_ord`].
    pub(crate) fn find_originaler(&self, t: &[u8]) -> Vec<(usize, usize, usize)> {
        // Mønstre: originalen med små bogstaver → de poster, der har den.
        let mut moenstre: HashMap<Vec<u8>, Vec<usize>> = HashMap::new();
        for (i, p) in self.data.poster.iter().enumerate() {
            if genbruges_som_ord(self.klasse_af(i), p.original.som_tekst()) {
                moenstre
                    .entry(p.original.som_tekst().as_bytes().to_ascii_lowercase())
                    .or_default()
                    .push(i);
            }
        }
        let mut ud = Vec::new();
        if moenstre.is_empty() {
            return ud;
        }
        let (noegler, poster): (Vec<Vec<u8>>, Vec<Vec<usize>>) = moenstre.into_iter().unzip();
        let Ok(ac) = AhoCorasick::builder()
            .ascii_case_insensitive(true)
            .match_kind(MatchKind::LeftmostLongest)
            .build(&noegler)
        else {
            return ud;
        };
        let mut pos = 0;
        while pos < t.len() {
            let Some(m) = ac.find(Input::new(t).span(pos..t.len())) else {
                break;
            };
            let tekst = &t[m.start()..m.end()];
            let kandidater = &poster[m.pattern().as_usize()];
            // Præcis samme bytes først (alle klasser); ellers en klasse, hvor store/små er samme enhed.
            let valgt = kandidater
                .iter()
                .find(|p| self.data.poster[**p].original.som_tekst().as_bytes() == tekst)
                .or_else(|| kandidater.iter().find(|p| self.klasse_af(**p).foldes()))
                .copied()
                .filter(|p| ved_graense(t, m.start(), m.end(), self.klasse_af(*p).moenster()));
            match valgt {
                Some(p) => {
                    ud.push((m.start(), m.end(), p));
                    pos = m.end();
                }
                None => pos = m.start() + 1,
            }
        }
        ud
    }

    /// Alle sagens koder og aliaser (D18) i teksten ved grænser: (start, slut, post). Samme søgning bruges af
    /// kollisionskontrollen og demaskeringen.
    pub(crate) fn find_koder(&self, t: &[u8]) -> Vec<(usize, usize, usize)> {
        let mut ud = Vec::new();
        if self.data.poster.is_empty() {
            return ud;
        }
        // Mønster nr. → post: først sagens koder (nr. = post), derefter aliaserne.
        let post_af: Vec<usize> = (0..self.data.poster.len())
            .chain(self.data.aliaser.iter().map(|(_, p)| *p))
            .collect();
        let Ok(ac) = AhoCorasick::builder().match_kind(MatchKind::LeftmostLongest).build(
            self.data
                .poster
                .iter()
                .map(|p| p.kode.as_bytes())
                .chain(self.data.aliaser.iter().map(|(k, _)| k.as_bytes())),
        ) else {
            return ud;
        };
        let mut pos = 0;
        while pos < t.len() {
            let Some(m) = ac.find(Input::new(t).span(pos..t.len())) else {
                break;
            };
            let p = post_af[m.pattern().as_usize()];
            if ved_graense(t, m.start(), m.end(), self.klasse_af(p).moenster()) {
                ud.push((m.start(), m.end(), p));
                pos = m.end();
                continue;
            }
            // En kortere kode med samme start kan stå ved en grænse.
            let kortere = (m.start() + 1..m.end()).rev().find_map(|e| {
                let s = std::str::from_utf8(&t[m.start()..e]).ok()?;
                let q = self.post_for(s)?;
                ved_graense(t, m.start(), e, self.klasse_af(q).moenster()).then_some((e, q))
            });
            match kortere {
                Some((e, q)) => {
                    ud.push((m.start(), e, q));
                    pos = e;
                }
                None => pos = m.start() + 1,
            }
        }
        ud
    }

    // ------------------------------------------------------------ tildeling

    fn ny_post(&mut self, enhed: usize, original: &str, kode: String, former: u8) -> String {
        let klasse = self.data.enheder[enhed].klasse;
        let i = self.data.poster.len();
        self.idx.stavning.insert((klasse, Original::ny(original)), i);
        self.idx.kode.insert(kode.clone(), i);
        self.idx.kode_smaa.entry(smaa(&kode)).or_insert(i);
        if !har_kodeform(&kode) {
            self.idx.uden_form.entry(smaa(&kode)).or_default().push(i);
        }
        self.data.poster.push(Post {
            enhed,
            original: Original::ny(original),
            kode: kode.clone(),
            former,
            rettet: false,
        });
        kode
    }

    fn ny_enhed(&mut self, klasse: Klasse, noegle: String, grundform: String) -> usize {
        let i = self.data.enheder.len();
        self.idx.enhed.insert((klasse, Original::ny(noegle.clone())), i);
        self.data.enheder.push(Enhed {
            klasse,
            noegle: Original::ny(noegle),
            grundform,
        });
        i
    }

    fn eksisterende(&mut self, klasse: Klasse, original: &str, former: u8) -> Option<String> {
        let i = *self.idx.stavning.get(&(klasse, Original::ny(original)))?;
        self.data.poster[i].former |= former;
        Some(self.data.poster[i].kode.clone())
    }

    fn fri_kode(&self, kode: &str) -> bool {
        !self.idx.kode.contains_key(kode) && !self.idx.alias.contains_key(kode) && !self.idx.res_navne.contains(&smaa(kode))
    }

    fn nyt_nummer(&mut self, k: Klasse) -> u64 {
        loop {
            self.data.taellere.navne[k.nr()] += 1;
            let n = self.data.taellere.navne[k.nr()];
            let g = smaa(&k.grundform(n));
            if !self.idx.kode_smaa.contains_key(&g) && !self.idx.alias_smaa.contains_key(&g) && !self.idx.res_navne.contains(&g) {
                return n;
            }
        }
    }

    /// Koden for en navneværdi (vært, domæne, bruger, hemmelighed …).
    pub(crate) fn kode_navn(&mut self, klasse: Klasse, original: &str, former: u8) -> String {
        if let Some(k) = self.eksisterende(klasse, original, former) {
            return k;
        }
        let noegle = if klasse.foldes() { smaa(original) } else { original.to_string() };
        let enhed = match self.idx.enhed.get(&(klasse, Original::ny(noegle.clone()))) {
            Some(e) => *e,
            None => {
                let n = self.nyt_nummer(klasse);
                self.ny_enhed(klasse, noegle, klasse.grundform(n))
            }
        };
        let g = self.data.enheder[enhed].grundform.clone();
        let o = original.as_bytes();
        let foerste = if !klasse.spejler() {
            g
        } else if !o.iter().any(u8::is_ascii_uppercase) {
            smaa(&g)
        } else if !o.iter().any(u8::is_ascii_lowercase) {
            g.to_ascii_uppercase()
        } else {
            g
        };
        let kode = if self.fri_kode(&foerste) {
            foerste
        } else if klasse.spejler() {
            (1..)
                .map(|k| med_suffiks(&foerste, k, klasse))
                .find(|c| self.fri_kode(c))
                .unwrap_or_default()
        } else {
            let n = self.nyt_nummer(klasse);
            klasse.grundform(n)
        };
        self.ny_post(enhed, original, kode, former)
    }

    fn fra_pulje4(&mut self) -> u32 {
        loop {
            let i = self.data.taellere.pulje4;
            self.data.taellere.pulje4 += 1;
            if i == PULJE4_DOK {
                self.advar(Pulje::Fremmede);
            }
            let v = pulje4_verdi(i);
            if v != u32::MAX && !self.idx.brugte4.contains(&v) && !self.idx.res4.contains(&v) {
                self.idx.brugte4.insert(v);
                return v;
            }
        }
    }

    fn nyt_maalnet4(&mut self) -> Option<u32> {
        while self.data.taellere.net4 < 512 {
            let m = BASE4 + self.data.taellere.net4;
            self.data.taellere.net4 += 1;
            if !self.idx.res_net4.contains(&m) && !self.idx.maal4.contains_key(&m) {
                return Some(m);
            }
        }
        None
    }

    fn egen_adresse4(&mut self, v: u32) -> u32 {
        let net = v >> 8;
        let maal = match self.idx.net4.get(&net) {
            Some(m) => *m,
            None => match self.nyt_maalnet4() {
                Some(m) => {
                    self.idx.net4.insert(net, m);
                    self.idx.maal4.insert(m, net);
                    self.data.net4.push((Original::ny(net.to_string()), m));
                    m
                }
                None => {
                    self.advar(Pulje::EgneNet);
                    return self.fra_pulje4();
                }
            },
        };
        let vaert = v & 0xff;
        let kode = if self.data.valg.bevar_sidste_oktet || vaert == 0 || vaert == 255 {
            (maal << 8) | vaert
        } else {
            let mut n = self.idx.vaerter4.get(&maal).copied().unwrap_or(0);
            loop {
                n += 1;
                if n >= 255 {
                    return self.fra_pulje4();
                }
                let k = (maal << 8) | n;
                if !self.idx.brugte4.contains(&k) && !self.idx.res4.contains(&k) {
                    self.idx.vaerter4.insert(maal, n);
                    match self.data.vaerter4.iter_mut().find(|(m, _)| *m == maal) {
                        Some(x) => x.1 = n,
                        None => self.data.vaerter4.push((maal, n)),
                    }
                    break k;
                }
            }
        };
        if self.idx.brugte4.contains(&kode) {
            return self.fra_pulje4();
        }
        self.idx.brugte4.insert(kode);
        kode
    }

    /// Koden for en IPv4-adresse; `egen` afbildes net for net (D5), ellers fortløbende (D4).
    pub(crate) fn kode_ipv4(&mut self, original: &str, egen: bool, former: u8) -> String {
        if let Some(k) = self.eksisterende(Klasse::Ipv4, original, former) {
            return k;
        }
        let Some(ip) = laes_ipv4(original.as_bytes()) else {
            return self.kode_navn(Klasse::Ord, original, former);
        };
        let noegle = ip.verdi.to_string();
        let enhed = match self.idx.enhed.get(&(Klasse::Ipv4, Original::ny(noegle.clone()))) {
            Some(e) => *e,
            None => {
                let v = if egen { self.egen_adresse4(ip.verdi) } else { self.fra_pulje4() };
                self.ny_enhed(Klasse::Ipv4, noegle, formater_ipv4(v, None))
            }
        };
        let g = self.data.enheder[enhed].grundform.clone();
        let gv = laes_ipv4(g.as_bytes()).map(|x| x.verdi).unwrap_or(0);
        let mut kode = if har_nuller(&ip) { formater_ipv4(gv, Some(ip.bredder)) } else { g };
        if !self.fri_kode(&kode) {
            kode = formater_ipv4(self.fra_pulje4(), None);
        }
        self.ny_post(enhed, original, kode, former)
    }

    fn nyt_maalnet6(&mut self) -> u64 {
        loop {
            let n = self.data.taellere.net6;
            self.data.taellere.net6 += 1;
            let p = if n < (1 << 32) {
                0x2001_0db8_0000_0000 | n
            } else {
                self.advar(Pulje::Ipv6);
                0x3fff_0000_0000_0000 | (n - (1 << 32))
            };
            if !self.idx.res_net6.contains(&p) && !self.idx.maal6.contains_key(&p) {
                return p;
            }
        }
    }

    fn ny_iid(&mut self, maal: u64) -> u128 {
        let mut n = self.idx.iid6.get(&maal).copied().unwrap_or(0);
        loop {
            n += 1;
            let v = (u128::from(maal) << 64) | u128::from(n);
            if !self.idx.brugte6.contains(&v) && !self.idx.res6.contains(&v) {
                self.idx.iid6.insert(maal, n);
                match self.data.iid6.iter_mut().find(|(m, _)| *m == maal) {
                    Some(x) => x.1 = n,
                    None => self.data.iid6.push((maal, n)),
                }
                self.idx.brugte6.insert(v);
                return v;
            }
        }
    }

    /// Koden for en IPv6-adresse: hvert /64 får sit eget /64, interface-delen et løbenummer.
    pub(crate) fn kode_ipv6(&mut self, original: &str, former: u8) -> String {
        if let Some(k) = self.eksisterende(Klasse::Ipv6, original, former) {
            return k;
        }
        let Some(ip) = laes_ipv6(original.as_bytes()) else {
            return self.kode_navn(Klasse::Ord, original, former);
        };
        let noegle = format!("{:032x}", ip.verdi);
        let net = (ip.verdi >> 64) as u64;
        let maal = match self.idx.net6.get(&net) {
            Some(m) => *m,
            None => {
                let m = self.nyt_maalnet6();
                self.idx.net6.insert(net, m);
                self.idx.maal6.insert(m, net);
                self.data.net6.push((Original::ny(format!("{net:016x}")), m));
                m
            }
        };
        let enhed = match self.idx.enhed.get(&(Klasse::Ipv6, Original::ny(noegle.clone()))) {
            Some(e) => *e,
            None => {
                let v = self.ny_iid(maal);
                self.ny_enhed(Klasse::Ipv6, noegle, formater_ipv6_kort(v))
            }
        };
        let gv = laes_ipv6(self.data.enheder[enhed].grundform.as_bytes())
            .map(|x| x.verdi)
            .unwrap_or(0);
        let mut kode = formater_ipv6(gv, &ip);
        while !self.fri_kode(&kode) {
            let v = self.ny_iid(maal);
            kode = formater_ipv6(v, &crate::net::Ipv6 { komprimeret: true, ..ip });
        }
        self.ny_post(enhed, original, kode, former)
    }

    fn fra_pulje_mac(&mut self) -> u64 {
        loop {
            let i = self.data.taellere.mac;
            self.data.taellere.mac += 1;
            if i == 256 {
                self.advar(Pulje::Mac);
            }
            let v = if i < 256 {
                0x0000_5e00_5300 | i
            } else {
                0x0200_0000_0000 | (i - 255)
            };
            if !self.idx.brugtemac.contains(&v) && !self.idx.resmac.contains(&v) {
                self.idx.brugtemac.insert(v);
                return v;
            }
        }
    }

    /// Koden for en MAC-adresse; skilletegn og store/små bevares.
    pub(crate) fn kode_mac(&mut self, original: &str, former: u8) -> String {
        if let Some(k) = self.eksisterende(Klasse::Mac, original, former) {
            return k;
        }
        let Some(mac) = laes_mac(original.as_bytes()) else {
            return self.kode_navn(Klasse::Ord, original, former);
        };
        let noegle = format!("{:012x}", mac.verdi);
        let enhed = match self.idx.enhed.get(&(Klasse::Mac, Original::ny(noegle.clone()))) {
            Some(e) => *e,
            None => {
                let v = self.fra_pulje_mac();
                self.ny_enhed(Klasse::Mac, noegle, formater_mac(v, MacForm::Kolon, false))
            }
        };
        let gv = laes_mac(self.data.enheder[enhed].grundform.as_bytes())
            .map(|m| m.verdi)
            .unwrap_or(0);
        let mut kode = formater_mac(gv, mac.form, mac.store);
        if !self.fri_kode(&kode) {
            let v = self.fra_pulje_mac();
            kode = formater_mac(v, mac.form, mac.store);
        }
        self.ny_post(enhed, original, kode, former)
    }

    /// Koden for en SID: domænedelen får et nummer, RID'en bevares.
    pub(crate) fn kode_sid(&mut self, original: &str, former: u8) -> String {
        if let Some(k) = self.eksisterende(Klasse::Sid, original, former) {
            return k;
        }
        let dele: Vec<&str> = original.split('-').collect();
        if dele.len() < 7 {
            return self.kode_navn(Klasse::Ord, original, former);
        }
        let domaene = Original::ny(dele[4..7].join("-"));
        let rid = dele.get(7).map(|r| format!("-{r}")).unwrap_or_default();
        let s = &original[..1];
        let mut n = match self.idx.sid.get(&domaene) {
            Some(i) => *i + 1,
            None => {
                self.data.sid_domaener.push(domaene.clone());
                self.idx.sid.insert(domaene, self.data.sid_domaener.len() - 1);
                self.data.sid_domaener.len()
            }
        };
        let noegle = smaa(original);
        let enhed = match self.idx.enhed.get(&(Klasse::Sid, Original::ny(noegle.clone()))) {
            Some(e) => *e,
            None => self.ny_enhed(Klasse::Sid, noegle, format!("S-1-5-21-0-0-{n}{rid}")),
        };
        let mut kode = format!("{s}-1-5-21-0-0-{n}{rid}");
        while !self.fri_kode(&kode) {
            self.data.sid_domaener.push(Original::ny(String::new()));
            n = self.data.sid_domaener.len();
            kode = format!("{s}-1-5-21-0-0-{n}{rid}");
        }
        self.ny_post(enhed, original, kode, former)
    }

    /// Grænsereglen for en post.
    pub(crate) fn moenster_af(&self, post: usize) -> Moenster {
        self.klasse_af(post).moenster()
    }
}
