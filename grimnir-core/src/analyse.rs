//! Genkenderne (K2): finder følsomme værdier og opdeler sammensatte værdier.
//!
//! Hver genkender giver kandidater med et ydre spænd og en eller flere dele. Overlap afgøres på det
//! ydre spænd: længste spænd vinder. Kandidater, der kun er "tjek selv", udfylder bagefter de huller,
//! der er tilbage, så en lang streng med høj entropi aldrig fortrænger en sikker hemmelighed.

use std::collections::HashMap;
use std::sync::OnceLock;

use aho_corasick::{AhoCorasick, MatchKind};
use regex::bytes::{Captures, Regex, RegexBuilder};

use crate::graense::{graense_efter, graense_foer, ved_graense, Moenster};
use crate::kodeform::find_navnekoder;
use crate::net::{
    find_ipv4, find_ipv6, find_mac, klassificer_ipv4, klassificer_ipv6, klassificer_mac, laes_ipv4, laes_ipv6, Ipv4, Ipv4Klasse, Ipv6,
    Ipv6Klasse, Mac, MacForm, MacKlasse,
};
use crate::ordbog::{Opslag, Ordbog};
use crate::typer::{Art, Fund, Sammensat, Sikkerhed};

const N: Moenster = Moenster::Navn;

fn re(kilde: &str) -> Regex {
    RegexBuilder::new(kilde)
        .unicode(false)
        .build()
        .expect("fast mønster i kernen kan ikke oversættes")
}

macro_rules! statisk {
    ($kilde:expr) => {{
        static RE: OnceLock<Regex> = OnceLock::new();
        RE.get_or_init(|| re($kilde))
    }};
}

fn fund(start: usize, slut: usize, art: Art, sikkerhed: Sikkerhed, del_af: Option<Sammensat>) -> Fund {
    Fund {
        start,
        slut,
        art,
        sikkerhed,
        del_af,
        afledt: false,
    }
}

struct Kandidat {
    start: usize,
    slut: usize,
    prio: u8,
    dele: Vec<Fund>,
}

/// Hvilke bytes der allerede er taget af en kandidat.
struct Daekning(Vec<u64>);

impl Daekning {
    fn ny(len: usize) -> Self {
        Daekning(vec![0; len / 64 + 1])
    }
    fn fri(&self, start: usize, slut: usize) -> bool {
        (start..slut).all(|i| self.0[i / 64] & (1 << (i % 64)) == 0)
    }
    fn saet(&mut self, start: usize, slut: usize) {
        for i in start..slut {
            self.0[i / 64] |= 1 << (i % 64);
        }
    }
}

struct Ctx<'a> {
    t: &'a [u8],
    ordbog: &'a Ordbog,
    opslag: &'a Opslag,
    dns: Vec<String>,
    /// V-MANUEL.2 N2: sikkerheden for et FQDN under hvert domæne i `dns` (samme plads): ordbogens domæner er
    /// [`Sikkerhed::Ordbog`], domæner fra tekstens mailadresser [`Sikkerhed::Sikker`] og domæner fra værtskolonnen i en
    /// syslog-linje [`Sikkerhed::Sandsynlig`].
    dns_sikkerhed: Vec<Sikkerhed>,
    netbios: Vec<String>,
    k: Vec<Kandidat>,
}

impl Ctx<'_> {
    fn tilfoej(&mut self, start: usize, slut: usize, prio: u8, dele: Vec<Fund>) {
        if !dele.is_empty() && start < slut {
            self.k.push(Kandidat { start, slut, prio, dele });
        }
    }

    fn en(&mut self, f: Fund, prio: u8) {
        self.tilfoej(f.start, f.slut, prio, vec![f]);
    }

    /// Ordet, der står lige før `start` (efter mellemrum, `:`, `=` og anførselstegn), med små bogstaver.
    fn ord_foer(&self, start: usize) -> String {
        let mut i = start;
        while i > 0 && start - i < 8 && matches!(self.t[i - 1], b' ' | b'\t' | b':' | b'=' | b'"' | b'\'') {
            i -= 1;
        }
        let mut j = i;
        while j > 0 && i - j < 16 && self.t[j - 1].is_ascii_alphabetic() {
            j -= 1;
        }
        String::from_utf8_lossy(&self.t[j..i]).to_ascii_lowercase()
    }

    fn ipv4_fund(&self, start: usize, slut: usize, ip: Ipv4) -> Option<Fund> {
        if self.opslag.aldrig_ipv4(ip.verdi) {
            return None;
        }
        let (art, sikkerhed) = match klassificer_ipv4(ip.verdi) {
            Ipv4Klasse::Aldrig => return None,
            Ipv4Klasse::Kodeomraade => (Art::LignerKode, Sikkerhed::TjekSelv),
            Ipv4Klasse::Privat => (Art::Ipv4Egen, Sikkerhed::Sikker),
            Ipv4Klasse::Fremmed if self.opslag.eget_net(ip.verdi) => (Art::Ipv4Egen, Sikkerhed::Ordbog),
            Ipv4Klasse::Fremmed => (Art::Ipv4Fremmed, Sikkerhed::Sikker),
        };
        Some(fund(start, slut, art, sikkerhed, None))
    }

    fn ipv6_fund(&self, start: usize, slut: usize, ip: Ipv6) -> Option<Fund> {
        let (art, sikkerhed) = match klassificer_ipv6(ip.verdi) {
            Ipv6Klasse::Aldrig => return None,
            Ipv6Klasse::Kodeomraade => (Art::LignerKode, Sikkerhed::TjekSelv),
            Ipv6Klasse::Egen => (Art::Ipv6Egen, Sikkerhed::Sikker),
            Ipv6Klasse::Fremmed => (Art::Ipv6Fremmed, Sikkerhed::Sikker),
        };
        Some(fund(start, slut, art, sikkerhed, None))
    }

    fn mac_fund(&self, start: usize, slut: usize, mac: Mac) -> Option<Fund> {
        let (art, sikkerhed) = match klassificer_mac(mac.verdi) {
            MacKlasse::Aldrig => return None,
            MacKlasse::Kodeomraade => (Art::LignerKode, Sikkerhed::TjekSelv),
            MacKlasse::Egen if mac.form == MacForm::Punktum && self.t[start..slut].iter().all(|b| b.is_ascii_digit() || *b == b'.') => {
                (Art::Mac, Sikkerhed::Sandsynlig)
            }
            MacKlasse::Egen => (Art::Mac, Sikkerhed::Sikker),
        };
        Some(fund(start, slut, art, sikkerhed, None))
    }

    /// Opdeler et værtsfelt (URL, UNC, nøgleord): adresse, FQDN under ordbogens domæner eller kort navn.
    fn vaert_dele(&self, start: usize, slut: usize, kort: Sikkerhed, del_af: Option<Sammensat>) -> Vec<Fund> {
        let s = &self.t[start..slut];
        if s.len() > 2 && s[0] == b'[' && s[s.len() - 1] == b']' {
            return laes_ipv6(&s[1..s.len() - 1])
                .and_then(|ip| self.ipv6_fund(start + 1, slut - 1, ip))
                .into_iter()
                .collect();
        }
        if let Some(ip) = laes_ipv4(s) {
            return self.ipv4_fund(start, slut, ip).into_iter().collect();
        }
        if let Some(ip) = laes_ipv6(s) {
            return self.ipv6_fund(start, slut, ip).into_iter().collect();
        }
        if let Some(d) = self.fqdn_dele(start, slut) {
            return d;
        }
        let navn = s.to_ascii_lowercase();
        if !s.contains(&b'.') && s.len() <= 63 && s.iter().any(u8::is_ascii_alphabetic) && navn != b"localhost" && navn != b"local" {
            return vec![fund(start, slut, Art::Vaert, kort, del_af)];
        }
        Vec::new()
    }

    /// Opdeler `vaert.under.domaene` i vært og domæne, hvis det ender på et af ordbogens domæner eller (V-MANUEL.2 N2) et
    /// domæne, teksten selv viser ([`tekstens_domaener`]). Første led er maskinen; resten (mellemled og domænet) er ét
    /// domæne, som for ordbogens domæner før.
    fn fqdn_dele(&self, start: usize, slut: usize) -> Option<Vec<Fund>> {
        let s = self.t[start..slut].to_ascii_lowercase();
        for (i, d) in self.dns.iter().enumerate() {
            let d = d.as_bytes();
            let sikkerhed = self.dns_sikkerhed.get(i).copied().unwrap_or(Sikkerhed::Ordbog);
            if s == d {
                return Some(vec![fund(start, slut, Art::Domaene, sikkerhed, None)]);
            }
            if s.len() > d.len() + 1 && s.ends_with(d) && s[s.len() - d.len() - 1] == b'.' {
                let p = s.iter().position(|b| *b == b'.').unwrap_or(0);
                return Some(vec![
                    fund(start, start + p, Art::Vaert, sikkerhed, Some(Sammensat::Fqdn)),
                    fund(start + p + 1, slut, Art::Domaene, sikkerhed, Some(Sammensat::Fqdn)),
                ]);
            }
        }
        None
    }

    /// V-MANUEL.2 N2: lægger et domæne, teksten viser, til listen over domæner, så et FQDN under det deles i maskine og
    /// domæne. Et domæne, ordbogen har, et domæne på "maskér aldrig" og et domæne med en kodes form (`d01.example`) springes
    /// over. Første led bliver et kendt NetBIOS-navn (`EKSEMPEL` i `EKSEMPEL\bruger`), som for ordbogens domæner.
    fn tekstdomaene(&mut self, d: &[u8], sikkerhed: Sikkerhed) {
        let d = d.to_ascii_lowercase();
        if !d.contains(&b'.') || self.opslag.aldrig_tekst(&d) || har_kodeform(&d) {
            return;
        }
        let Ok(d) = String::from_utf8(d) else { return };
        if let Some(i) = self.dns.iter().position(|x| *x == d) {
            // Samme domæne set flere steder: den stærkeste sammenhæng gælder (mail før værtskolonne).
            if sikkerhed < self.dns_sikkerhed[i] && self.dns_sikkerhed[i] != Sikkerhed::Ordbog {
                self.dns_sikkerhed[i] = sikkerhed;
            }
            return;
        }
        if let Some(f) = d
            .split('.')
            .next()
            .filter(|f| !f.is_empty() && !self.netbios.iter().any(|n| n == f))
        {
            self.netbios.push(f.to_string());
        }
        self.dns.push(d);
        self.dns_sikkerhed.push(sikkerhed);
    }
}

/// Første gruppe af 1..=n, der matchede.
fn vaerdi<'a>(c: &Captures<'a>, n: usize) -> Option<regex::bytes::Match<'a>> {
    (1..=n).find_map(|i| c.get(i))
}

/// Gennemløber alle match af et mønster; ved et match, der afvises, prøves igen fra næste byte.
fn hvert(re: &Regex, t: &[u8], mut f: impl FnMut(&Captures) -> bool) {
    let mut pos = 0;
    while pos <= t.len() {
        let Some(c) = re.captures_at(t, pos) else { break };
        let m = c.get(0).map(|m| (m.start(), m.end())).unwrap_or((pos, pos));
        pos = if f(&c) { m.1.max(m.0 + 1) } else { m.0 + 1 };
    }
}

/// Nøgleord før en værdi skal stå ved en grænse (så `bypass=` ikke er `pass=`).
fn noegle_ok(t: &[u8], c: &Captures) -> bool {
    c.get(0).is_some_and(|m| graense_foer(t, m.start(), N))
}

fn er_hemmelig_vaerdi(v: &[u8]) -> bool {
    if v.is_empty() || matches!(v[0], b'$' | b'%' | b'{' | b'<' | b'(' | b'@' | b'[') || v.iter().all(|b| *b == b'*') {
        return false;
    }
    let kerne = v.iter().rposition(|b| *b != b'=').map_or(&v[..0], |p| &v[..=p]);
    if kerne.contains(&b'=') {
        return false;
    }
    let l = v.to_ascii_lowercase();
    !matches!(
        l.as_slice(),
        b"null" | b"none" | b"true" | b"false" | b"enc" | b"n/a" | b"undefined" | b"xxx" | b"-" | b"\"\""
    )
}

/// Sand, hvis værdien er en sti (`/home/x`, `~/x`, `C:\x`); `PWD=` i sudo-linjer er arbejdsmappen.
fn er_sti(v: &[u8]) -> bool {
    matches!(v.first(), Some(b'/' | b'~')) || (v.len() > 2 && v[0].is_ascii_alphabetic() && v[1] == b':' && matches!(v[2], b'\\' | b'/'))
}

fn gyldig_cpr(s: &[u8]) -> bool {
    let tal = |a: usize, b: usize| s[a..b].iter().fold(0u32, |x, c| x * 10 + u32::from(c - b'0'));
    let (dag, md, aa, syv) = (tal(0, 2), tal(2, 4), tal(4, 6), tal(7, 8));
    let aarhundrede = match syv {
        0..=3 => 1900,
        4 | 9 => {
            if aa <= 36 {
                2000
            } else {
                1900
            }
        }
        _ => {
            if aa <= 57 {
                2000
            } else {
                1800
            }
        }
    };
    let aar = aarhundrede + aa;
    let skud = (aar % 4 == 0 && aar % 100 != 0) || aar % 400 == 0;
    let dage = match md {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 if skud => 29,
        2 => 28,
        _ => return false,
    };
    (1..=dage).contains(&dag)
}

fn entropi(s: &[u8]) -> f64 {
    let mut antal = [0u32; 256];
    for b in s {
        antal[*b as usize] += 1;
    }
    let n = s.len() as f64;
    antal
        .iter()
        .filter(|a| **a > 0)
        .map(|a| f64::from(*a) / n)
        .map(|p| -p * p.log2())
        .sum()
}

const VERSIONSORD: [&str; 10] = [
    "version", "ver", "v", "build", "release", "firmware", "fw", "rev", "revision", "versjon",
];
const MASKEORD: [&str; 4] = ["mask", "netmask", "subnetmask", "wildcard"];
/// Almindelige ord, der ikke søges alene (afledte former, sagens kendte originaler). V-MANUEL.2 N2: også almindelige
/// tjenestenavne forrest i et FQDN (`portal`, `vpn`, `smtp` …): i FQDN'et maskeres de som maskinens navn, men alene er de
/// almindelige ord.
pub(crate) const STOPORD: [&str; 35] = [
    "portal",
    "vpn",
    "smtp",
    "imap",
    "pop",
    "pop3",
    "ftp",
    "sftp",
    "ns1",
    "ns2",
    "dns",
    "web",
    "webmail",
    "intranet",
    "proxy",
    "gateway",
    "api",
    "admin",
    "administrator",
    "root",
    "user",
    "guest",
    "system",
    "test",
    "service",
    "support",
    "info",
    "www",
    "mail",
    "localhost",
    "server",
    "host",
    "default",
    "public",
    "local",
];
/// Værdier i Windows-hændelser, der ikke er navne (F2).
const IKKE_NAVNE: [&str; 7] = [
    "-",
    "system",
    "anonymous logon",
    "local service",
    "network service",
    "n/a",
    "localhost",
];
const NETBIOS_UNDTAGET: [&str; 16] = [
    "hklm",
    "hkcu",
    "hkcr",
    "hku",
    "hkcc",
    "hkey_local_machine",
    "nt",
    "builtin",
    "system",
    "software",
    "sam",
    "security",
    "windows",
    "system32",
    "users",
    "temp",
];

/// Finder fund i teksten. Spændene er byte-positioner og ligger altid på tegngrænser.
pub fn analyser(tekst: &str, ordbog: &Ordbog) -> Vec<Fund> {
    let t = tekst.as_bytes();
    let opslag = ordbog.opslag();
    let dns = ordbog.dns_domaener();
    let mut c = Ctx {
        t,
        ordbog,
        opslag: &opslag,
        dns_sikkerhed: vec![Sikkerhed::Ordbog; dns.len()],
        dns,
        netbios: ordbog.netbios(),
        k: Vec::new(),
    };

    adresser(&mut c);
    hemmeligheder(&mut c);
    // V-MANUEL.2 N2: mailadresser og værtskolonnen først, så deres domæner er kendt, når FQDN'er, URL'er, UNC-stier og
    // nøgleord deles op.
    mails(&mut c);
    maskinnavne(&mut c);
    sammensatte(&mut c);
    noegleord(&mut c);
    ordbogen(&mut c);

    // "Maskér aldrig" vinder over alt: delen fjernes, men spændet bliver optaget.
    for k in &mut c.k {
        if opslag.aldrig_tekst(&t[k.start..k.slut]) {
            k.dele.clear();
        } else {
            k.dele.retain(|f| !opslag.aldrig_tekst(&t[f.start..f.slut]));
        }
    }

    let (tjek, sikre): (Vec<Kandidat>, Vec<Kandidat>) = std::mem::take(&mut c.k).into_iter().partition(|k| {
        !k.dele.is_empty()
            && k.dele
                .iter()
                .all(|f| matches!(f.sikkerhed, Sikkerhed::TjekSelv | Sikkerhed::Version))
    });

    let mut daekket = Daekning::ny(t.len());
    let mut ud = Vec::new();
    loes(sikre, &mut daekket, &mut ud);
    afledte(t, &opslag, &mut daekket, &mut ud, false);
    let mut c2 = Ctx {
        t,
        ordbog,
        opslag: &opslag,
        dns: Vec::new(),
        dns_sikkerhed: Vec::new(),
        netbios: Vec::new(),
        k: tjek,
    };
    tjek_selv(&mut c2);
    loes(c2.k, &mut daekket, &mut ud);
    // V-MANUEL.2 N3: et maskinnavn med svag sammenhæng ("Tjek selv") findes også de andre steder, det står, så hele navnet er
    // én række, og et valg af rækken maskerer alle steder.
    afledte(t, &opslag, &mut daekket, &mut ud, true);

    // Sikring: et fund skal stå ved grænser efter den fælles grænseregel, ellers kan koden ikke findes igen.
    ud.retain(|f| {
        f.start < f.slut
            && tekst.is_char_boundary(f.start)
            && tekst.is_char_boundary(f.slut)
            && (f.sikkerhed == Sikkerhed::Version || ved_graense(t, f.start, f.slut, f.art.klasse().moenster()))
    });
    ud.sort_by_key(|f| (f.start, f.slut));
    ud.dedup_by_key(|f| (f.start, f.slut));
    // To fund lige op ad hinanden (kun muligt, når de begynder eller slutter med et grænsetegn, fx en tilføjet værdi `=` i
    // `==`) ville give to koder uden grænse imellem (`h0001h0001`), som demaskeringen ikke kan finde. Det andet tages ikke
    // med; det står urørt (fundet af egenskabstesten i V-MANUEL.2, fejlen er fra V-MANUEL.1).
    let mut slut = usize::MAX;
    ud.retain(|f| {
        let ok = f.start != slut;
        if ok {
            slut = f.slut;
        }
        ok
    });
    ud
}

fn loes(mut k: Vec<Kandidat>, daekket: &mut Daekning, ud: &mut Vec<Fund>) {
    k.sort_by(|a, b| {
        (b.slut - b.start)
            .cmp(&(a.slut - a.start))
            .then(b.prio.cmp(&a.prio))
            .then(a.start.cmp(&b.start))
    });
    for kandidat in k {
        if daekket.fri(kandidat.start, kandidat.slut) {
            daekket.saet(kandidat.start, kandidat.slut);
            ud.extend(kandidat.dele);
        }
    }
}

/// Afledte former: dele af sammensatte værdier (brugernavn, kort værtsnavn, domæne) søges som ord i hele teksten.
///
/// `tjek`: V-MANUEL.2 N3: kun maskinnavne med status "Tjek selv" (de findes med samme status); ellers alle andre.
fn afledte(t: &[u8], opslag: &Opslag, daekket: &mut Daekning, ud: &mut Vec<Fund>, tjek: bool) {
    let mut ord: HashMap<Vec<u8>, (Art, Sikkerhed)> = HashMap::new();
    for f in ud.iter() {
        let er_tjek = f.sikkerhed == Sikkerhed::TjekSelv;
        if !matches!(f.art, Art::Vaert | Art::Bruger | Art::NetbiosDomaene | Art::Domaene)
            || er_tjek != tjek
            || (tjek && (f.art != Art::Vaert || f.afledt))
        {
            continue;
        }
        let s = t[f.start..f.slut].to_ascii_lowercase();
        if s.len() < 3 || !s.iter().any(u8::is_ascii_alphabetic) || STOPORD.iter().any(|o| o.as_bytes() == s) || opslag.aldrig_tekst(&s) {
            continue;
        }
        ord.entry(s).or_insert((f.art, f.sikkerhed));
    }
    if ord.is_empty() {
        return;
    }
    let (moenstre, arter): (Vec<Vec<u8>>, Vec<(Art, Sikkerhed)>) = ord.into_iter().unzip();
    let Ok(ac) = AhoCorasick::builder()
        .ascii_case_insensitive(true)
        .match_kind(MatchKind::LeftmostLongest)
        .build(&moenstre)
    else {
        return;
    };
    for m in ac.find_iter(t) {
        if ved_graense(t, m.start(), m.end(), N) && daekket.fri(m.start(), m.end()) {
            daekket.saet(m.start(), m.end());
            let (art, sikkerhed) = arter[m.pattern().as_usize()];
            ud.push(Fund {
                start: m.start(),
                slut: m.end(),
                art,
                sikkerhed,
                del_af: None,
                afledt: true,
            });
        }
    }
}

fn adresser(c: &mut Ctx) {
    let t = c.t;
    let mut nye = Vec::new();
    find_ipv4(t, |s, e, ip, foer_ok| {
        let ord = c.ord_foer(s);
        if VERSIONSORD.contains(&ord.as_str()) {
            let art = if klassificer_ipv4(ip.verdi) == Ipv4Klasse::Privat {
                Art::Ipv4Egen
            } else {
                Art::Ipv4Fremmed
            };
            nye.push((fund(s, e, art, Sikkerhed::Version, None), 55));
        } else if foer_ok && !MASKEORD.contains(&ord.as_str()) {
            if let Some(f) = c.ipv4_fund(s, e, ip) {
                nye.push((f, 55));
            }
        }
    });
    find_ipv6(t, |s, e, ip| {
        if let Some(f) = c.ipv6_fund(s, e, ip) {
            nye.push((f, 55));
        }
    });
    find_mac(t, |s, e, mac| {
        if let Some(f) = c.mac_fund(s, e, mac) {
            nye.push((f, 56));
        }
    });
    for (f, p) in nye {
        c.en(f, p);
    }
}

fn hemmeligheder(c: &mut Ctx) {
    let t = c.t;
    let pem = statisk!(r"(?s)-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----(?:\r?\n|\\n)(.*?)(?:\r?\n|\\n)-----END [A-Z0-9 ]*PRIVATE KEY-----");
    for m in pem.captures_iter(t) {
        if let (Some(ydre), Some(krop)) = (m.get(0), m.get(1)) {
            c.tilfoej(
                ydre.start(),
                ydre.end(),
                90,
                vec![fund(krop.start(), krop.end(), Art::Hemmelighed, Sikkerhed::Sikker, None)],
            );
        }
    }
    let jwt = statisk!(r"eyJ[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]*");
    for m in jwt.find_iter(t) {
        if ved_graense(t, m.start(), m.end(), N) {
            c.en(fund(m.start(), m.end(), Art::Hemmelighed, Sikkerhed::Sikker, None), 85);
        }
    }
    let moenstre: [(&Regex, bool); 7] = [
        (
            statisk!(concat!(
                r"(?i)(?:password|passwd|passord|adgangskode|pwd|pass|secret|client_secret|psksecret|token|access_token|refresh_token",
                r#"|auth_token|apikey|api_key|api-key|x-api-key|community|private_key|secret_key|access_key|sas_token)"?\s*[:=]\s*"#,
                r#"(?:"([^"\r\n]*)"|'([^'\r\n]*)'|([^\s;,"'&<>)}\]]+))"#
            )),
            true,
        ),
        (
            statisk!(concat!(
                r"(?i)set\s+(?:password|passwd|psksecret|secret|key|community|token|auth-pwd|passphrase)\s+(?:ENC\s+)?",
                r#"(?:"([^"\r\n]*)"|'([^'\r\n]*)'|(\S+))"#
            )),
            true,
        ),
        (
            statisk!(r#"(?i)-(?:password|token|apikey|secret|accesskey)\s+(?:"([^"\r\n]*)"|'([^'\r\n]*)'|([^\s;]+))"#),
            true,
        ),
        (
            statisk!(r#"(?i)convertto-securestring\s+(?:-string\s+)?(?:"([^"\r\n]*)"|'([^'\r\n]*)')"#),
            true,
        ),
        (statisk!(r"(?i)bearer\s+([A-Za-z0-9._~+/=-]{8,})"), true),
        (statisk!(r"(?i)<(?:password|secret|token|apikey|pwd)>([^<\r\n]+)</"), false),
        (statisk!(r#"(?i)identified\s+by\s+(?:"([^"\r\n]*)"|'([^'\r\n]*)'|([^\s;]+))"#), true),
    ];
    let mut nye = Vec::new();
    for (re, noegle) in moenstre {
        hvert(re, t, |m| {
            if noegle && !noegle_ok(t, m) {
                return false;
            }
            let pwd_sti = m.get(0).is_some_and(|x| x.as_bytes().to_ascii_lowercase().starts_with(b"pwd"))
                && vaerdi(m, 3).is_some_and(|v| er_sti(v.as_bytes()));
            match vaerdi(m, 3) {
                Some(v) if er_hemmelig_vaerdi(v.as_bytes()) && !pwd_sti => {
                    nye.push(fund(v.start(), v.end(), Art::Hemmelighed, Sikkerhed::Sikker, None));
                    true
                }
                _ => false,
            }
        });
    }
    for f in nye {
        c.en(f, 80);
    }
}

/// Mail og UPN (også URL-kodet): bruger og domæne. V-MANUEL.2 N2: domænerne er tekstens egne domæner (sikre), så et FQDN
/// under dem deles i maskine og domæne.
fn mails(c: &mut Ctx) {
    let t = c.t;
    let mut nye: Vec<(usize, usize, u8, Vec<Fund>)> = Vec::new();

    // Mail og UPN: bruger + domæne
    let mail = statisk!(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}");
    for m in mail.find_iter(t) {
        let (mut s, e) = (m.start(), m.end());
        while s < e && matches!(t[s], b'.' | b'-' | b'+' | b'%') {
            s += 1;
        }
        let Some(at) = t[s..e].iter().position(|b| *b == b'@').map(|p| s + p) else {
            continue;
        };
        if at == s || !ved_graense(t, s, e, N) {
            continue;
        }
        let m = Some(Sammensat::Mail);
        nye.push((
            s,
            e,
            70,
            vec![
                fund(s, at, Art::Bruger, Sikkerhed::Sikker, m),
                fund(at + 1, e, Art::Domaene, Sikkerhed::Sikker, m),
            ],
        ));
    }

    // Mail og UPN, URL-kodet: bruger%40domæne og %40bruger%40domæne (F3). `%40` bevares.
    let mail_kodet = statisk!(r"[A-Za-z0-9._+-]+%40[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}");
    for m in mail_kodet.find_iter(t) {
        let (mut s, e) = (m.start(), m.end());
        // Et %XX foran (fx det første %40) hører ikke til brugernavnet
        while s >= 1 && t[s - 1] == b'%' && s + 2 <= e && t[s].is_ascii_hexdigit() && t[s + 1].is_ascii_hexdigit() {
            s += 2;
        }
        while s < e && matches!(t[s], b'.' | b'-' | b'+') {
            s += 1;
        }
        let Some(at) = t[s..e].windows(3).position(|w| w == b"%40").map(|p| s + p) else {
            continue;
        };
        if at == s || !ved_graense(t, s, e, N) {
            continue;
        }
        let m = Some(Sammensat::Mail);
        nye.push((
            s,
            e,
            70,
            vec![
                fund(s, at, Art::Bruger, Sikkerhed::Sikker, m),
                fund(at + 3, e, Art::Domaene, Sikkerhed::Sikker, m),
            ],
        ));
    }

    for (s, e, p, d) in nye {
        for f in d.iter().filter(|f| f.art == Art::Domaene) {
            c.tekstdomaene(&t[f.start..f.slut], Sikkerhed::Sikker);
        }
        c.tilfoej(s, e, p, d);
    }
}

/// V-MANUEL.2 N3: ord, der står hvor en maskine plejer at stå, men aldrig er en maskine (logniveauer, handlinger, ord fra
/// en logs faste tekst). Små bogstaver.
const IKKE_VAERT: [&str; 44] = [
    "info",
    "information",
    "warn",
    "warning",
    "error",
    "err",
    "debug",
    "trace",
    "notice",
    "crit",
    "critical",
    "alert",
    "emerg",
    "emergency",
    "fatal",
    "severe",
    "verbose",
    "kernel",
    "system",
    "localhost",
    "local",
    "unknown",
    "none",
    "null",
    "true",
    "false",
    "fejl",
    "advarsel",
    "accept",
    "drop",
    "deny",
    "allow",
    "reject",
    "block",
    "ok",
    "fail",
    "failed",
    "success",
    "audit",
    "cron",
    "sshd",
    "sudo",
    "systemd",
    "login",
];

/// V-MANUEL.2 N3: sand, hvis tokenet har et maskinnavns form: begynder med et bogstav, har kun bogstaver, cifre og `-`, slutter
/// med et bogstav eller ciffer, er højst 63 tegn og står ikke på listen over ord, der aldrig er en maskine. Navne som
/// netkort (`eth0`, `ens33`), teknik (`ipv6`, `utf-8`, `sha256`) og rene hextegn regnes ikke med.
fn ligner_maskine(v: &[u8]) -> bool {
    if v.len() < 2 || v.len() > 63 || !v[0].is_ascii_alphabetic() || !v[v.len() - 1].is_ascii_alphanumeric() {
        return false;
    }
    if !v.iter().all(|b| b.is_ascii_alphanumeric() || *b == b'-') {
        return false;
    }
    let l = v.to_ascii_lowercase();
    let ls = String::from_utf8_lossy(&l);
    if IKKE_VAERT.contains(&ls.as_ref()) || STOPORD.contains(&ls.as_ref()) {
        return false;
    }
    let teknik = statisk!(concat!(
        r"^(?:(?:eth|ens|enp|eno|wlan|wlp|lo|em|bond|br|vlan|tun|tap|wg|ppp|docker|veth)[0-9]",
        r"|ipv[46]|utf-?(?:8|16|32)|sha-?[0-9]+|md5|x86|x64|amd64|arm64|i[3-6]86|win(?:32|64)|base64|http[0-9]|tls[0-9]",
        r"|ssl[0-9]|ext[234]|fat32|v[0-9]+$|[0-9a-f]{8,}$",
        // Tråde og trin i et programs log (`Thread-12`, `worker-3`, `pool-1-thread-2`, `step2`).
        r"|(?:thread|worker|pool|task|job|executor|main|step|phase|stage|part|chunk|batch|item|run|try|attempt|retry|round|pass)-?[0-9])"
    ));
    !teknik.is_match(&l)
}

/// Sand, hvis tokenet har både et bogstav og et ciffer (`srv-db02`, `pc-17`, `dc01`): navnet på en maskine, ikke et ord.
fn har_ciffer(v: &[u8]) -> bool {
    v.iter().any(u8::is_ascii_digit) && v.iter().any(u8::is_ascii_alphabetic)
}

/// Sand, hvis hele teksten har en kodes form (`d01.example`, `h0001`).
fn har_kodeform(v: &[u8]) -> bool {
    let mut hel = false;
    find_navnekoder(v, |s, e, _| hel |= s == 0 && e == v.len());
    hel
}

/// V-MANUEL.2 N3: værtskolonnen i en syslog-linje: (start, slut, kolon lige efter, slutningen af mellemrummet efter) for
/// tokenet efter tidsstemplet, eller `None`. Tidsstemplet er RFC 3164 (`Nov 10 08:00:00`, også efter `<PRI>`) eller ISO
/// (`2026-11-10 08:00:00`, `2026-11-10T08:00:00.123+01:00`, også efter RFC 5424's `<PRI>1 `). Tokenet er
/// `[A-Za-z0-9][A-Za-z0-9._-]{0,252}`, eventuelt med `:` lige efter, og følges af mellemrum eller linjens slutning (med
/// eller uden `\r`). Skrevet i hånden i stedet for et regulært udtryk pr. linje (ydelse, se HANDOFF-V-MANUEL.2).
fn vaertskolonne(l: &[u8]) -> Option<(usize, usize, bool, usize)> {
    let ciffer = |k: usize| l.get(k).is_some_and(u8::is_ascii_digit);
    let blank = |k: usize| matches!(l.get(k), Some(b' ' | b'\t'));
    let mut i = 0;
    if l.first() == Some(&b'<') {
        let mut j = 1;
        while j <= 3 && ciffer(j) {
            j += 1;
        }
        if j == 1 || l.get(j) != Some(&b'>') {
            return None;
        }
        i = j + 1;
        if l.get(i) == Some(&b'1') && l.get(i + 1) == Some(&b' ') {
            i += 2;
        }
    }
    let tid = |j: usize| {
        ciffer(j)
            && ciffer(j + 1)
            && l.get(j + 2) == Some(&b':')
            && ciffer(j + 3)
            && ciffer(j + 4)
            && l.get(j + 5) == Some(&b':')
            && ciffer(j + 6)
            && ciffer(j + 7)
    };
    let mut j;
    if l.get(i).is_some_and(u8::is_ascii_uppercase) {
        // Nov 10 08:00:00
        if !(l.get(i + 1).is_some_and(u8::is_ascii_lowercase) && l.get(i + 2).is_some_and(u8::is_ascii_lowercase) && blank(i + 3)) {
            return None;
        }
        j = i + 3;
        while blank(j) {
            j += 1;
        }
        let d = j;
        while ciffer(j) && j - d < 2 {
            j += 1;
        }
        if j == d || !blank(j) {
            return None;
        }
        while blank(j) {
            j += 1;
        }
        if !tid(j) {
            return None;
        }
        j += 8;
    } else {
        // 2026-11-10 08:00:00 eller 2026-11-10T08:00:00(.fff)(Z|+01:00)
        let dato = (0..4).all(|k| ciffer(i + k))
            && l.get(i + 4) == Some(&b'-')
            && ciffer(i + 5)
            && ciffer(i + 6)
            && l.get(i + 7) == Some(&b'-')
            && ciffer(i + 8)
            && ciffer(i + 9)
            && matches!(l.get(i + 10), Some(b'T' | b' '));
        if !dato || !tid(i + 11) {
            return None;
        }
        j = i + 19;
        if matches!(l.get(j), Some(b'.' | b',')) && ciffer(j + 1) {
            let s = j + 1;
            let mut k = s;
            while ciffer(k) && k - s < 9 {
                k += 1;
            }
            j = k;
        }
        if l.get(j) == Some(&b'Z') {
            j += 1;
        } else if matches!(l.get(j), Some(b'+' | b'-')) && ciffer(j + 1) && ciffer(j + 2) {
            let k = if l.get(j + 3) == Some(&b':') { j + 4 } else { j + 3 };
            if ciffer(k) && ciffer(k + 1) {
                j = k + 2;
            }
        }
    }
    if !blank(j) {
        return None;
    }
    while blank(j) {
        j += 1;
    }
    let s = j;
    if !l.get(s).is_some_and(u8::is_ascii_alphanumeric) {
        return None;
    }
    let mut e = s + 1;
    while e < l.len() && e - s < 253 && (l[e].is_ascii_alphanumeric() || matches!(l[e], b'.' | b'_' | b'-')) {
        e += 1;
    }
    let kolon = l.get(e) == Some(&b':');
    let mut k = e + usize::from(kolon);
    let slut = k >= l.len() || (l[k] == b'\r' && k + 1 == l.len());
    if !slut && !blank(k) {
        return None;
    }
    while blank(k) {
        k += 1;
    }
    Some((s, e, kolon, k))
}

/// V-MANUEL.2 N3: maskinnavne efter, hvor de står.
///
/// 1. **Værtskolonnen i en syslog-linje**: tokenet lige efter tidsstemplet (RFC 3164 `Nov 10 08:00:00`, ISO
///    `2026-11-10 08:00:00` eller `2026-11-10T08:00:00Z`, også efter `<PRI>` og RFC 5424's `1`).
///    - Et navn med cifre (`srv-db02`, `pc-17`) er **Sandsynlig**; står der kolon lige efter (`db1:`), kan tokenet også
///      være et programnavn, og det er **Tjek selv**.
///    - Et ord uden cifre kan kun være en maskine, når et program står efter (`web sshd[42]:`, `kernel:`,
///      `postfix/smtp:`): **Tjek selv** (`backup kernel:` kan være en maskine eller et ord). Ellers intet (`INFO`, `ACCEPT`,
///      `fejl:`).
///    - Et FQDN med mindst tre led (`dc01.intern.eksempel-firma.example`) deles i maskine og domæne (**Sandsynlig**), og
///      domænet bliver et af tekstens domæner, så det også deler FQDN'er andre steder.
/// 2. **Foran et program med proces-id eller `kernel:`** et andet sted på linjen (`srv-web03 sshd[812]:`): et navn med
///    cifre er **Sandsynlig**; et ord uden cifre tages ikke (`the daemon sshd[100]:`).
///
/// Ord, der aldrig er en maskine ([`IKKE_VAERT`], [`STOPORD`]), adresser og tekniske navne ([`ligner_maskine`]) tages ikke.
/// UNC-stier og nøgleord (`host=`, `ComputerName`, `server=`) har deres egne genkendere.
fn maskinnavne(c: &mut Ctx) {
    let t = c.t;
    let mut nye: Vec<(usize, usize, Vec<Fund>)> = Vec::new();
    let mut domaener: Vec<(usize, usize)> = Vec::new();
    let program = statisk!(r"^(?:[A-Za-z][A-Za-z0-9_./-]{0,40}\[[0-9]{1,10}\]|kernel|[A-Za-z][A-Za-z0-9_-]{0,30}/[A-Za-z0-9_./-]{1,40}):");
    let mut ls = 0;
    while ls < t.len() {
        let le = t[ls..].iter().position(|b| *b == b'\n').map_or(t.len(), |p| ls + p);
        let naeste = le + 1;
        let Some((vs, ve, kolon, efter)) = vaertskolonne(&t[ls..le]) else {
            ls = naeste;
            continue;
        };
        let (s, mut e, efter) = (ls + vs, ls + ve, ls + efter);
        ls = naeste;
        while e > s && matches!(t[e - 1], b'.' | b'-' | b'_') {
            e -= 1;
        }
        let token = &t[s..e];
        if laes_ipv4(token).is_some() || laes_ipv6(token).is_some() {
            continue;
        }
        if token.contains(&b'.') {
            // Et FQDN: første led er maskinen, resten domænet (mindst to led, sidste led er bogstaver).
            let led: Vec<&[u8]> = token.split(|b| *b == b'.').collect();
            let tld = led[led.len() - 1];
            if kolon
                || led.len() < 3
                || tld.len() < 2
                || !tld.iter().all(u8::is_ascii_alphabetic)
                || led
                    .iter()
                    .any(|l| l.is_empty() || l.len() > 63 || !l.iter().all(|b| b.is_ascii_alphanumeric() || *b == b'-'))
                || !ligner_maskine(led[0])
            {
                continue;
            }
            let p = s + led[0].len();
            domaener.push((p + 1, e));
            let f = Some(Sammensat::Fqdn);
            nye.push((
                s,
                e,
                vec![
                    fund(s, p, Art::Vaert, Sikkerhed::Sandsynlig, f),
                    fund(p + 1, e, Art::Domaene, Sikkerhed::Sandsynlig, f),
                ],
            ));
            continue;
        }
        if !ligner_maskine(token) {
            continue;
        }
        let sikkerhed = if har_ciffer(token) {
            if kolon {
                Sikkerhed::TjekSelv
            } else {
                Sikkerhed::Sandsynlig
            }
        } else if !kolon && program.is_match(&t[efter..]) {
            Sikkerhed::TjekSelv
        } else {
            continue;
        };
        nye.push((s, e, vec![fund(s, e, Art::Vaert, sikkerhed, None)]));
    }

    // Foran et program med proces-id eller kernel: et andet sted (ikke i værtskolonnen, som er taget ovenfor). Ankrene
    // (`]:` og `kernel:`) findes først; derfra læses programmet og navnet foran baglæns.
    static ANKRE: OnceLock<Option<AhoCorasick>> = OnceLock::new();
    let kolonnen: Vec<(usize, usize)> = nye.iter().map(|(s, e, _)| (*s, *e)).collect();
    let mut foran: Vec<(usize, usize)> = Vec::new();
    if let Some(ac) = ANKRE.get_or_init(|| AhoCorasick::new(["]:", "kernel:"]).ok()) {
        for a in ac.find_iter(t) {
            // Programmets start: `navn[123]:` eller `kernel:` ved en grænse.
            let mut p = a.start();
            if a.pattern().as_usize() == 0 {
                let mut q = p;
                while q > 0 && t[q - 1].is_ascii_digit() {
                    q -= 1;
                }
                if q == p || q == 0 || t[q - 1] != b'[' {
                    continue;
                }
                p = q - 1;
                while p > 0 && (t[p - 1].is_ascii_alphanumeric() || matches!(t[p - 1], b'_' | b'.' | b'/' | b'-')) {
                    p -= 1;
                }
                if p == q - 1 || !t[p].is_ascii_alphabetic() {
                    continue;
                }
            } else if p > 0 && t[p - 1].is_ascii_alphanumeric() {
                continue;
            }
            // Mellemrum og navnet foran.
            let mut e = p;
            while e > 0 && matches!(t[e - 1], b' ' | b'\t') {
                e -= 1;
            }
            if e == p {
                continue;
            }
            let mut s = e;
            while s > 0 && (t[s - 1].is_ascii_alphanumeric() || t[s - 1] == b'-') {
                s -= 1;
            }
            if s == e || (s > 0 && !matches!(t[s - 1], b' ' | b'\t' | b'\n')) {
                continue;
            }
            let token = &t[s..e];
            let i = kolonnen.partition_point(|x| x.1 <= s);
            if !ligner_maskine(token) || !har_ciffer(token) || kolonnen.get(i).is_some_and(|x| x.0 < e) || foran.last() == Some(&(s, e)) {
                continue;
            }
            foran.push((s, e));
        }
    }
    for (s, e) in foran {
        nye.push((s, e, vec![fund(s, e, Art::Vaert, Sikkerhed::Sandsynlig, None)]));
    }

    for (s, e) in domaener {
        c.tekstdomaene(&t[s..e], Sikkerhed::Sandsynlig);
    }
    // Prioritet 39: under ordbogens navnemønstre (40), så brugerens eget mønster giver status "Ordbog" for samme spænd.
    for (s, e, d) in nye {
        c.tilfoej(s, e, 39, d);
    }
}

fn sammensatte(c: &mut Ctx) {
    let t = c.t;
    let mut nye: Vec<(usize, usize, u8, Vec<Fund>)> = Vec::new();

    // URL: bruger, adgangskode og vært
    let url = statisk!(r"(?i)[a-z][a-z0-9+.-]{1,15}://(?:([^\s/@:]+)(?::([^\s/@]*))?@)?(\[[0-9a-f:.]+\]|[A-Za-z0-9._-]+)");
    for m in url.captures_iter(t) {
        let (Some(ydre), Some(vaert)) = (m.get(0), m.get(3)) else {
            continue;
        };
        let u = Some(Sammensat::Url);
        let mut dele = Vec::new();
        if let Some(b) = m.get(1) {
            dele.push(fund(b.start(), b.end(), Art::Bruger, Sikkerhed::Sikker, u));
        }
        if let Some(p) = m.get(2).filter(|p| er_hemmelig_vaerdi(p.as_bytes())) {
            dele.push(fund(p.start(), p.end(), Art::Hemmelighed, Sikkerhed::Sikker, u));
        }
        let (mut vs, mut ve) = (vaert.start(), vaert.end());
        while ve > vs && matches!(t[ve - 1], b'.' | b'-' | b'_') {
            ve -= 1;
        }
        while vs < ve && matches!(t[vs], b'.' | b'-' | b'_') {
            vs += 1;
        }
        dele.extend(c.vaert_dele(vs, ve, Sikkerhed::Sandsynlig, u));
        nye.push((ydre.start(), ve.max(ydre.start()), 70, dele));
    }

    // UNC-sti: \\vaert\del
    let unc = statisk!(r"\\\\([A-Za-z0-9][A-Za-z0-9._-]*)\\");
    for m in unc.captures_iter(t) {
        let (Some(ydre), Some(v)) = (m.get(0), m.get(1)) else { continue };
        let mut ve = v.end();
        while ve > v.start() && t[ve - 1] == b'.' {
            ve -= 1;
        }
        nye.push((
            ydre.start(),
            ydre.end(),
            60,
            c.vaert_dele(v.start(), ve, Sikkerhed::Sandsynlig, Some(Sammensat::Unc)),
        ));
    }

    // DOMÆNE\bruger (også JSON-escaped med to skråstreger)
    let db = statisk!(r"([A-Za-z0-9][A-Za-z0-9-]{0,14})(\\{1,2})([A-Za-z0-9][A-Za-z0-9._-]{0,63})");
    hvert(db, t, |m| {
        let (Some(nb), Some(sep), Some(bruger)) = (m.get(1), m.get(2), m.get(3)) else {
            return false;
        };
        let foer = if nb.start() > 0 { t[nb.start() - 1] } else { b' ' };
        // Grænsereglen afgør starten, så `\r\nKONTOR\\bruger` og `%5CKONTOR` også findes (F3)
        if !graense_foer(t, nb.start(), N) || matches!(foer, b'\\' | b'/' | b':' | b'.' | b'%' | b'$' | b'-') {
            return false;
        }
        if t.get(bruger.end())
            .is_some_and(|b| b.is_ascii_alphanumeric() || matches!(b, b'.' | b'-' | b'_'))
        {
            return false;
        }
        let mut be = bruger.end();
        while be > bruger.start() && matches!(t[be - 1], b'.' | b'-' | b'_') {
            be -= 1;
        }
        if be < t.len() && matches!(t[be], b'\\' | b'/') {
            return false;
        }
        let navn = nb.as_bytes().to_ascii_lowercase();
        if nb.len() < 2 || NETBIOS_UNDTAGET.iter().any(|u| u.as_bytes() == navn) {
            return false;
        }
        let b = &t[bruger.start()..be];
        if sep.len() == 1 && b.len() > 1 && matches!(b[0], b'n' | b't' | b'r' | b'0' | b'x' | b'u') && b[1].is_ascii_uppercase() {
            return false;
        }
        // V-OPBYG.4 N6: en escape-sekvens på ét bogstav (`\t`, `\n`, `\r`, `\0` med én skråstreg) efter et kort ord er
        // ikke et domæne med en bruger (`echo A0\t x`). En bruger på flere tegn (`KONTOR\t.hansen`, `KONTOR\tina`), et
        // andet bogstav (`KONTOR\p`), et stort T og to skråstreger (JSON-escaped `KONTOR\\t`) findes som før.
        if sep.len() == 1 && b.len() == 1 && matches!(b[0], b'n' | b't' | b'r' | b'0') {
            return false;
        }
        let kendt = c.netbios.iter().any(|n| n.as_bytes() == navn);
        let store = nb
            .as_bytes()
            .iter()
            .all(|x| x.is_ascii_uppercase() || x.is_ascii_digit() || *x == b'-')
            && nb.as_bytes().iter().any(u8::is_ascii_alphabetic);
        if !kendt && !store {
            return false;
        }
        let sikkerhed = if kendt { Sikkerhed::Sikker } else { Sikkerhed::Sandsynlig };
        let d = Some(Sammensat::DomaeneBruger);
        nye.push((
            nb.start(),
            be,
            60,
            vec![
                fund(nb.start(), nb.end(), Art::NetbiosDomaene, sikkerhed, d),
                fund(bruger.start(), be, Art::Bruger, sikkerhed, d),
            ],
        ));
        true
    });

    // Hjemmemappe i en sti
    let hjem = statisk!(r"(?i)(?:[a-z]:(?:\\{1,2}|/)users(?:\\{1,2}|/)|/users/|/home/)([a-z0-9._-]+)");
    for m in hjem.captures_iter(t) {
        let (Some(ydre), Some(navn)) = (m.get(0), m.get(1)) else { continue };
        let l = navn.as_bytes().to_ascii_lowercase();
        if matches!(
            l.as_slice(),
            b"public" | b"default" | b"shared" | b"all users" | b"guest" | b"defaultuser0" | b"default.migrated"
        ) {
            continue;
        }
        let f = fund(
            navn.start(),
            navn.end(),
            Art::Bruger,
            Sikkerhed::Sikker,
            Some(Sammensat::Hjemmemappe),
        );
        nye.push((ydre.start(), ydre.end(), 65, vec![f]));
    }

    // AD-sti: CN=…,OU=…,DC=…
    let ad = statisk!(r#"(?i)(?:(?:cn|ou)=[^,=\r\n"<>]+|dc=[a-z0-9-]+)(?:,\s*(?:(?:cn|ou)=[^,=\r\n"<>]+|dc=[a-z0-9-]+))+"#);
    for m in ad.find_iter(t) {
        if !graense_foer(t, m.start(), N) {
            continue;
        }
        let mut dele = Vec::new();
        let mut pos = m.start();
        let komponenter: Vec<(usize, usize)> = m
            .as_bytes()
            .split(|b| *b == b',')
            .map(|k| {
                let s = pos;
                pos += k.len() + 1;
                (s, s + k.len())
            })
            .collect();
        let sidste_dc = komponenter.iter().rposition(|(s, _)| {
            t[*s..]
                .iter()
                .find(|b| !b.is_ascii_whitespace())
                .is_some_and(|b| *b == b'd' || *b == b'D')
        });
        for (i, (s, e)) in komponenter.iter().enumerate() {
            let mut s = *s;
            while s < *e && t[s].is_ascii_whitespace() {
                s += 1;
            }
            let noegle = t[s..s + 2].to_ascii_lowercase();
            let (mut vs, mut ve) = (s + 3, *e);
            while vs < ve && t[vs] == b' ' {
                vs += 1;
            }
            while ve > vs && t[ve - 1] == b' ' {
                ve -= 1;
            }
            if vs >= ve {
                continue;
            }
            let v = t[vs..ve].to_ascii_lowercase();
            let a = Some(Sammensat::AdSti);
            match noegle.as_slice() {
                b"dc" if Some(i) != sidste_dc => dele.push(fund(vs, ve, Art::Ord, Sikkerhed::Sikker, a)),
                b"cn"
                    if !matches!(
                        v.as_slice(),
                        b"users" | b"computers" | b"builtin" | b"system" | b"configuration" | b"schema"
                    ) =>
                {
                    let art = if v.contains(&b' ') { Art::Person } else { Art::Bruger };
                    dele.push(fund(vs, ve, art, Sikkerhed::Sikker, a));
                }
                b"ou" => dele.push(fund(vs, ve, Art::Ord, Sikkerhed::Sandsynlig, a)),
                _ => {}
            }
        }
        nye.push((m.start(), m.end(), 65, dele));
    }

    // SID
    let sid = statisk!(r"(?i)s-1-5-21-[0-9]{1,10}-[0-9]{1,10}-[0-9]{1,10}(?:-[0-9]{1,10})?");
    for m in sid.find_iter(t) {
        if ved_graense(t, m.start(), m.end(), N) {
            nye.push((
                m.start(),
                m.end(),
                60,
                vec![fund(m.start(), m.end(), Art::Sid, Sikkerhed::Sikker, None)],
            ));
        }
    }

    // CPR-nummer med datovalidering
    let cpr = statisk!(r"[0-9]{6}-[0-9]{4}");
    for m in cpr.find_iter(t) {
        if ved_graense(t, m.start(), m.end(), N) && gyldig_cpr(m.as_bytes()) {
            nye.push((
                m.start(),
                m.end(),
                50,
                vec![fund(m.start(), m.end(), Art::Cpr, Sikkerhed::Sandsynlig, None)],
            ));
        }
    }

    // FQDN under ordbogens domæner
    if !c.dns.is_empty() {
        let alle: Vec<String> = c.dns.iter().map(|d| regex::escape(d)).collect();
        let fqdn = re(&format!(r"(?i)(?:[a-z0-9][a-z0-9-]*\.)*(?:{})", alle.join("|")));
        for m in fqdn.find_iter(t) {
            if !ved_graense(t, m.start(), m.end(), N) {
                continue;
            }
            // V-MANUEL.2: `$pc.intern.kontor.test` (PowerShell) og `%pc%.…`: første led er en variabel, ikke en maskine. Kun
            // resten er et navn (domænet), og variablen står urørt.
            if m.start() > 0 && matches!(t[m.start() - 1], b'$' | b'%') {
                if let Some(p) = t[m.start()..m.end()].iter().position(|b| *b == b'.') {
                    let s = m.start() + p + 1;
                    let i = c.dns.iter().position(|d| {
                        t[s..m.end()].eq_ignore_ascii_case(d.as_bytes()) || t[s..m.end()].to_ascii_lowercase().ends_with(d.as_bytes())
                    });
                    if let Some(i) = i {
                        let sikkerhed = c.dns_sikkerhed.get(i).copied().unwrap_or(Sikkerhed::Ordbog);
                        nye.push((s, m.end(), 50, vec![fund(s, m.end(), Art::Domaene, sikkerhed, None)]));
                    }
                }
                continue;
            }
            if let Some(d) = c.fqdn_dele(m.start(), m.end()) {
                nye.push((m.start(), m.end(), 50, d));
            }
        }
    }

    for (s, e, p, d) in nye {
        c.tilfoej(s, e, p, d);
    }
}

fn noegleord(c: &mut Ctx) {
    let t = c.t;
    let mut nye: Vec<(Fund, u8)> = Vec::new();

    // Korte maskinnavne efter nøgleord
    let vaerter: [&Regex; 4] = [
        statisk!(concat!(
            r"(?i)(?:hostname|host-name|devname|computername|computer_name|servername|server_name|machinename|machine_name",
            r"|shost|dhost|dvchost|src_host|dst_host|srchost|dsthost",
            r#"|workstation|nodename|host)"?\s*[:=]\s*["']?([A-Za-z0-9][A-Za-z0-9._-]*)"#
        )),
        statisk!(r#"(?i)(?:hostname|devname|set\s+alias)\s+["']?([A-Za-z0-9][A-Za-z0-9._-]*)"#),
        statisk!(r#"(?i)-computername\s+["']?([A-Za-z0-9][A-Za-z0-9._-]*)"#),
        statisk!(r"(?i)(?:server|data source|address|addr|network address)\s*=\s*(?:tcp:)?([A-Za-z0-9][A-Za-z0-9._-]*)"),
    ];
    for r in vaerter {
        hvert(r, t, |m| {
            let Some(v) = m.get(1) else { return false };
            if !noegle_ok(t, m) {
                return false;
            }
            let mut e = v.end();
            while e > v.start() && matches!(t[e - 1], b'.' | b'-' | b'_') {
                e -= 1;
            }
            for f in c.vaert_dele(v.start(), e, Sikkerhed::Sandsynlig, None) {
                nye.push((f, 45));
            }
            true
        });
    }

    // Brugere efter nøgleord
    let brugere: [&Regex; 3] = [
        statisk!(r#"(?i)(?:user id|userid|uid|username|user_name|user|login|srcuser|dstuser)"?\s*[:=]\s*["']?([^;"'\s,&<>)]+)"#),
        statisk!(r#"(?i)-(?:username|user|credential)\s+["']?([^\s"';]+)"#),
        statisk!(
            r"(?i)(?:accepted|failed) (?:password|publickey|keyboard-interactive(?:/pam)?) for (?:invalid user )?([A-Za-z0-9._-]+) from"
        ),
    ];
    for r in brugere {
        hvert(r, t, |m| {
            let Some(v) = m.get(1) else { return false };
            let l = v.as_bytes().to_ascii_lowercase();
            if !noegle_ok(t, m) || !er_hemmelig_vaerdi(v.as_bytes()) || matches!(l.as_slice(), b"unknown" | b"anonymous") {
                return false;
            }
            nye.push((fund(v.start(), v.end(), Art::Bruger, Sikkerhed::Sandsynlig, None), 45));
            true
        });
    }

    // Windows-hændelser (F2): brugere og maskiner efter nøgleord, sikkerhed Sandsynlig.
    // Værdier, der ikke er navne, springes over; et navn med `$` til sidst er en maskine.
    let win: [(&Regex, bool); 3] = [
        (statisk!(r"(?i)(?:account name|user name|logon account):[ \t]*(\S+)"), true),
        (
            statisk!(r"(?i)(?:workstation name|source workstation|computername|computer)[ \t]*[:=][ \t]*(\S+)"),
            false,
        ),
        (statisk!(r"(?i)user[ \t]+([A-Za-z0-9._$-]+)[ \t]+logged[ \t]+(?:in|on|out)"), true),
    ];
    for (r, bruger) in win {
        hvert(r, t, |m| {
            let Some(v) = m.get(1) else { return false };
            if !noegle_ok(t, m) {
                return false;
            }
            let linje_slut = t[v.start()..]
                .iter()
                .position(|b| *b == b'\n' || *b == b'\r')
                .map_or(t.len(), |p| v.start() + p);
            let resten = String::from_utf8_lossy(&t[v.start()..linje_slut]).trim().to_ascii_lowercase();
            if IKKE_NAVNE.iter().any(|n| resten == *n || resten.starts_with(&format!("{n} "))) {
                return false;
            }
            let (s, mut e) = (v.start(), v.end());
            while e > s && matches!(t[e - 1], b'.' | b',' | b';' | b'"' | b'\'') {
                e -= 1;
            }
            let vaerdi = &t[s..e];
            if vaerdi.is_empty() || vaerdi.contains(&b'\\') || vaerdi.contains(&b'@') {
                return false; // DOMÆNE\bruger og UPN tages af deres egne genkendere
            }
            if vaerdi.ends_with(b"$") {
                for f in c.vaert_dele(s, e - 1, Sikkerhed::Sandsynlig, None) {
                    nye.push((f, 45));
                }
            } else if bruger {
                nye.push((fund(s, e, Art::Bruger, Sikkerhed::Sandsynlig, None), 45));
            } else {
                for f in c.vaert_dele(s, e, Sikkerhed::Sandsynlig, None) {
                    nye.push((f, 45));
                }
            }
            true
        });
    }

    // Databaser
    let databaser: [&Regex; 3] = [
        statisk!(r#"(?i)(?:database|initial catalog|dbname|db)\s*=\s*["']?([^;"'\s]+)"#),
        statisk!(r"(?i)use\s+\[([^\]\r\n]+)\]"),
        statisk!(r"(?i)use\s+([a-z_][a-z0-9_]*)\s*;"),
    ];
    for r in databaser {
        hvert(r, t, |m| {
            let Some(v) = m.get(1) else { return false };
            let l = v.as_bytes().to_ascii_lowercase();
            if !noegle_ok(t, m) || matches!(l.as_slice(), b"master" | b"tempdb" | b"model" | b"msdb") {
                return false;
            }
            nye.push((fund(v.start(), v.end(), Art::Database, Sikkerhed::Sandsynlig, None), 45));
            true
        });
    }

    // GUID efter nøgleord
    let guids: [&Regex; 2] = [
        statisk!(concat!(
            r"(?i)(?:tenant|tenantid|tenant_id|tenant-id|subscription|subscriptionid|subscription_id|subscription-id|client_id|clientid",
            r#"|client-id|app_id|appid|application_id|applicationid|object_id|objectid|directory_id)"?\s*[:=]\s*["'{]?"#,
            r"([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})"
        )),
        statisk!(r"(?i)/(?:subscriptions|tenants)/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})"),
    ];
    for (i, r) in guids.into_iter().enumerate() {
        hvert(r, t, |m| {
            let Some(v) = m.get(1) else { return false };
            if (i == 0 && !noegle_ok(t, m)) || !graense_efter(t, v.end(), N) {
                return false;
            }
            nye.push((fund(v.start(), v.end(), Art::Guid, Sikkerhed::Sikker, None), 60));
            true
        });
    }

    // Serienumre efter nøgleord
    let serie = statisk!(
        r#"(?i)(?:serial|serialnumber|serial_number|serial-number|serienummer|sn|devid|device_id|deviceid)"?\s*[:=]\s*["']?([A-Za-z0-9][A-Za-z0-9-]{3,63})"#
    );
    hvert(serie, t, |m| {
        let Some(v) = m.get(1) else { return false };
        if !noegle_ok(t, m) || !graense_efter(t, v.end(), N) || !v.as_bytes().iter().any(u8::is_ascii_digit) {
            return false;
        }
        nye.push((fund(v.start(), v.end(), Art::Serienummer, Sikkerhed::Sandsynlig, None), 45));
        true
    });

    for (f, p) in nye {
        c.en(f, p);
    }
}

fn ordbogen(c: &mut Ctx) {
    let t = c.t;
    let mut nye: Vec<Fund> = Vec::new();

    // Navnemønstre: # er ét ciffer, * er nul eller flere bogstaver, cifre og -
    let moenstre: Vec<String> = c
        .ordbog
        .navnemoenstre
        .iter()
        .filter(|m| !m.trim().is_empty())
        .map(|m| {
            m.trim()
                .chars()
                .map(|ch| match ch {
                    '#' => "[0-9]".to_string(),
                    '*' => "[a-z0-9-]*".to_string(),
                    _ => regex::escape(&ch.to_string()),
                })
                .collect::<String>()
        })
        .collect();
    if !moenstre.is_empty() {
        if let Ok(r) = RegexBuilder::new(&format!("(?i)(?:{})", moenstre.join("|"))).unicode(false).build() {
            hvert(&r, t, |m| {
                let Some(v) = m.get(0) else { return false };
                if !ved_graense(t, v.start(), v.end(), N) {
                    return false;
                }
                nye.push(fund(v.start(), v.end(), Art::Vaert, Sikkerhed::Ordbog, None));
                true
            });
        }
    }

    // Værdier, brugeren har peget på (V-MANUEL.1), ord, personer og NetBIOS-navne. De tilføjede står først, så de vinder
    // over en ordbogsindgang med samme spænd (brugerens valg af art gælder).
    let mut ord: Vec<(String, Art, Sikkerhed)> = Vec::new();
    ord.extend(c.ordbog.gyldige_tilfoejede().map(|(v, a)| (v.to_string(), a, Sikkerhed::Sikker)));
    ord.extend(c.ordbog.ord.iter().map(|o| (o.trim().to_string(), Art::Ord, Sikkerhed::Ordbog)));
    ord.extend(
        c.ordbog
            .personer
            .iter()
            .map(|o| (o.trim().to_string(), Art::Person, Sikkerhed::Ordbog)),
    );
    ord.extend(
        c.ordbog
            .domaener
            .iter()
            .filter(|d| !d.contains('.'))
            .map(|o| (o.trim().to_string(), Art::NetbiosDomaene, Sikkerhed::Ordbog)),
    );
    ord.retain(|(o, _, _)| !o.is_empty());
    if !ord.is_empty() {
        let ac = AhoCorasick::builder()
            .ascii_case_insensitive(true)
            .match_kind(MatchKind::LeftmostLongest)
            .build(ord.iter().map(|(o, _, _)| o.as_bytes()));
        if let Ok(ac) = ac {
            for m in ac.find_iter(t) {
                if ved_graense(t, m.start(), m.end(), N) {
                    let (_, art, sikkerhed) = &ord[m.pattern().as_usize()];
                    nye.push(fund(m.start(), m.end(), *art, *sikkerhed, None));
                }
            }
        }
    }
    for f in nye {
        c.en(f, 40);
    }
}

/// "Tjek selv": høj entropi og tekst, der ligner en kode.
fn tjek_selv(c: &mut Ctx) {
    let t = c.t;
    let mut nye = Vec::new();
    let token = statisk!(r"[A-Za-z0-9+/_-]{24,}={0,2}");
    for m in token.find_iter(t) {
        let s = m.as_bytes();
        if !ved_graense(t, m.start(), m.end(), N) {
            continue;
        }
        let linje_start = t[..m.start()].iter().rposition(|b| *b == b'\n').map_or(0, |p| p + 1);
        let linje_slut = t[m.end()..].iter().position(|b| *b == b'\n').map_or(t.len(), |p| m.end() + p);
        let taelle = |x: u8| s.iter().filter(|b| **b == x).count();
        let klasser = [
            s.iter().any(u8::is_ascii_uppercase),
            s.iter().any(u8::is_ascii_lowercase),
            s.iter().any(u8::is_ascii_digit),
        ];
        if linje_slut - linje_start > 4096 || taelle(b'/') >= 2 || taelle(b'_') >= 3 || taelle(b'-') >= 3 || klasser.iter().any(|k| !k) {
            continue;
        }
        if entropi(s) >= 3.8 {
            nye.push(fund(m.start(), m.end(), Art::Entropi, Sikkerhed::TjekSelv, None));
        }
    }
    find_navnekoder(t, |s, e, _| nye.push(fund(s, e, Art::LignerKode, Sikkerhed::TjekSelv, None)));
    for f in nye {
        let p = if f.art == Art::Entropi { 10 } else { 5 };
        c.en(f, p);
    }
}
