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
use crate::ordbog::Ordbog;
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
    dns: Vec<String>,
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
        if self.ordbog.aldrig_ipv4(ip.verdi) {
            return None;
        }
        let (art, sikkerhed) = match klassificer_ipv4(ip.verdi) {
            Ipv4Klasse::Aldrig => return None,
            Ipv4Klasse::Kodeomraade => (Art::LignerKode, Sikkerhed::TjekSelv),
            Ipv4Klasse::Privat => (Art::Ipv4Egen, Sikkerhed::Sikker),
            Ipv4Klasse::Fremmed if self.ordbog.eget_net(ip.verdi) => (Art::Ipv4Egen, Sikkerhed::Ordbog),
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

    /// Opdeler `vaert.under.domaene` i vært og domæne, hvis det ender på et af ordbogens domæner.
    fn fqdn_dele(&self, start: usize, slut: usize) -> Option<Vec<Fund>> {
        let s = self.t[start..slut].to_ascii_lowercase();
        for d in &self.dns {
            let d = d.as_bytes();
            if s == d {
                return Some(vec![fund(start, slut, Art::Domaene, Sikkerhed::Ordbog, None)]);
            }
            if s.len() > d.len() + 1 && s.ends_with(d) && s[s.len() - d.len() - 1] == b'.' {
                let p = s.iter().position(|b| *b == b'.').unwrap_or(0);
                return Some(vec![
                    fund(start, start + p, Art::Vaert, Sikkerhed::Ordbog, Some(Sammensat::Fqdn)),
                    fund(start + p + 1, slut, Art::Domaene, Sikkerhed::Ordbog, Some(Sammensat::Fqdn)),
                ]);
            }
        }
        None
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
const STOPORD: [&str; 18] = [
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
    let mut c = Ctx {
        t,
        ordbog,
        dns: ordbog.dns_domaener(),
        netbios: ordbog.netbios(),
        k: Vec::new(),
    };

    adresser(&mut c);
    hemmeligheder(&mut c);
    sammensatte(&mut c);
    noegleord(&mut c);
    ordbogen(&mut c);

    // "Maskér aldrig" vinder over alt: delen fjernes, men spændet bliver optaget.
    for k in &mut c.k {
        if ordbog.aldrig_tekst(&t[k.start..k.slut]) {
            k.dele.clear();
        } else {
            k.dele.retain(|f| !ordbog.aldrig_tekst(&t[f.start..f.slut]));
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
    afledte(t, ordbog, &mut daekket, &mut ud);
    let mut c2 = Ctx {
        t,
        ordbog,
        dns: Vec::new(),
        netbios: Vec::new(),
        k: tjek,
    };
    tjek_selv(&mut c2);
    loes(c2.k, &mut daekket, &mut ud);

    // Sikring: et fund skal stå ved grænser efter den fælles grænseregel, ellers kan koden ikke findes igen.
    ud.retain(|f| {
        f.start < f.slut
            && tekst.is_char_boundary(f.start)
            && tekst.is_char_boundary(f.slut)
            && (f.sikkerhed == Sikkerhed::Version || ved_graense(t, f.start, f.slut, f.art.klasse().moenster()))
    });
    ud.sort_by_key(|f| (f.start, f.slut));
    ud.dedup_by_key(|f| (f.start, f.slut));
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
fn afledte(t: &[u8], ordbog: &Ordbog, daekket: &mut Daekning, ud: &mut Vec<Fund>) {
    let mut ord: HashMap<Vec<u8>, (Art, Sikkerhed)> = HashMap::new();
    for f in ud.iter() {
        if !matches!(f.art, Art::Vaert | Art::Bruger | Art::NetbiosDomaene | Art::Domaene) {
            continue;
        }
        let s = t[f.start..f.slut].to_ascii_lowercase();
        if s.len() < 3 || !s.iter().any(u8::is_ascii_alphabetic) || STOPORD.iter().any(|o| o.as_bytes() == s) || ordbog.aldrig_tekst(&s) {
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

fn sammensatte(c: &mut Ctx) {
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
        if foer.is_ascii_alphanumeric() || matches!(foer, b'\\' | b'/' | b':' | b'.' | b'%' | b'$' | b'-') {
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
            if ved_graense(t, m.start(), m.end(), N) {
                if let Some(d) = c.fqdn_dele(m.start(), m.end()) {
                    nye.push((m.start(), m.end(), 50, d));
                }
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

    // Databaser
    let databaser: [&Regex; 3] = [
        statisk!(r#"(?i)(?:database|initial catalog|dbname)\s*=\s*["']?([^;"'\s]+)"#),
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

    // Ord, personer og NetBIOS-navne
    let mut ord: Vec<(String, Art)> = Vec::new();
    ord.extend(c.ordbog.ord.iter().map(|o| (o.trim().to_string(), Art::Ord)));
    ord.extend(c.ordbog.personer.iter().map(|o| (o.trim().to_string(), Art::Person)));
    ord.extend(
        c.ordbog
            .domaener
            .iter()
            .filter(|d| !d.contains('.'))
            .map(|o| (o.trim().to_string(), Art::NetbiosDomaene)),
    );
    ord.retain(|(o, _)| !o.is_empty());
    if !ord.is_empty() {
        let ac = AhoCorasick::builder()
            .ascii_case_insensitive(true)
            .match_kind(MatchKind::LeftmostLongest)
            .build(ord.iter().map(|(o, _)| o.as_bytes()));
        if let Ok(ac) = ac {
            for m in ac.find_iter(t) {
                if ved_graense(t, m.start(), m.end(), N) {
                    nye.push(fund(m.start(), m.end(), ord[m.pattern().as_usize()].1, Sikkerhed::Ordbog, None));
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
