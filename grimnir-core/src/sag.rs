//! Sagen: nøgletabellen i hukommelsen (original ↔ kode), net-afbildninger, tællere og valg (K3).

use std::collections::{HashMap, HashSet};
use std::fmt;

use aho_corasick::{AhoCorasick, Input, MatchKind};

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
}

#[derive(Default)]
struct Indeks {
    stavning: HashMap<(Klasse, Original), usize>,
    enhed: HashMap<(Klasse, Original), usize>,
    kode: HashMap<String, usize>,
    kode_smaa: HashMap<String, usize>,
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

    /// Originalen bag en kode.
    pub fn opslag(&self, kode: &str) -> Option<&Original> {
        self.idx.kode.get(kode).map(|i| &self.data.poster[*i].original)
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

    /// Brugerens rettelse af en kode (fri tekst). Afvises, hvis den nye kode findes i sagen eller i teksten.
    pub fn ret(&mut self, kode: &str, ny: &str, tekst: &str) -> Result<(), Fejl> {
        let i = *self.idx.kode.get(kode).ok_or_else(|| Fejl::UkendtKode { kode: kode.to_string() })?;
        let nb = ny.as_bytes();
        if nb.is_empty() || !nb[0].is_ascii_alphanumeric() || !nb[nb.len() - 1].is_ascii_alphanumeric() {
            return Err(Fejl::UgyldigKode { kode: ny.to_string() });
        }
        let moenster = self.klasse_af(i).moenster();
        let i_tekst = {
            let t = tekst.as_bytes();
            let l = smaa(ny);
            let tl = t.to_ascii_lowercase();
            let mut fundet = false;
            let mut pos = 0;
            while let Some(p) = tl[pos..].windows(nb.len()).position(|w| w == l.as_bytes()) {
                if ved_graense(t, pos + p, pos + p + nb.len(), moenster) {
                    fundet = true;
                    break;
                }
                pos += p + 1;
            }
            fundet
        };
        if self.idx.kode.contains_key(ny) || self.idx.kode_smaa.contains_key(&smaa(ny)) || self.idx.res_navne.contains(&smaa(ny)) || i_tekst
        {
            return Err(Fejl::KodeKolliderer { kode: ny.to_string() });
        }
        let gammel = std::mem::replace(&mut self.data.poster[i].kode, ny.to_string());
        self.data.poster[i].rettet = true;
        self.idx.kode.remove(&gammel);
        if self.idx.kode_smaa.get(&smaa(&gammel)) == Some(&i) {
            self.idx.kode_smaa.remove(&smaa(&gammel));
        }
        self.idx.kode.insert(ny.to_string(), i);
        self.idx.kode_smaa.entry(smaa(ny)).or_insert(i);
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

    pub(crate) fn kode_smaa(&self, kode: &str) -> Option<usize> {
        self.idx.kode_smaa.get(&smaa(kode)).copied()
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

    /// Alle sagens koder i teksten ved grænser: (start, slut, post). Samme søgning bruges af
    /// kollisionskontrollen og demaskeringen.
    pub(crate) fn find_koder(&self, t: &[u8]) -> Vec<(usize, usize, usize)> {
        let mut ud = Vec::new();
        if self.data.poster.is_empty() {
            return ud;
        }
        let Ok(ac) = AhoCorasick::builder()
            .match_kind(MatchKind::LeftmostLongest)
            .build(self.data.poster.iter().map(|p| p.kode.as_bytes()))
        else {
            return ud;
        };
        let mut pos = 0;
        while pos < t.len() {
            let Some(m) = ac.find(Input::new(t).span(pos..t.len())) else {
                break;
            };
            let p = m.pattern().as_usize();
            if ved_graense(t, m.start(), m.end(), self.klasse_af(p).moenster()) {
                ud.push((m.start(), m.end(), p));
                pos = m.end();
                continue;
            }
            // En kortere kode med samme start kan stå ved en grænse.
            let kortere = (m.start() + 1..m.end()).rev().find_map(|e| {
                let s = std::str::from_utf8(&t[m.start()..e]).ok()?;
                let q = *self.idx.kode.get(s)?;
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
        !self.idx.kode.contains_key(kode) && !self.idx.res_navne.contains(&smaa(kode))
    }

    fn nyt_nummer(&mut self, k: Klasse) -> u64 {
        loop {
            self.data.taellere.navne[k.nr()] += 1;
            let n = self.data.taellere.navne[k.nr()];
            let g = smaa(&k.grundform(n));
            if !self.idx.kode_smaa.contains_key(&g) && !self.idx.res_navne.contains(&g) {
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
