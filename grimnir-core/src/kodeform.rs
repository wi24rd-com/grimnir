//! Genkendelse af tekst, der har en kodes form (kontrol 8.1).
//!
//! Bruges tre steder med samme regel: analysen melder "ligner en kode", tildelingen reserverer
//! formerne, så de aldrig tages i brug, og demaskeringen melder ukendte koder af kendt form.

use std::sync::OnceLock;

use regex::bytes::Regex;

use crate::graense::{graense_efter, graense_foer, ved_graense, Moenster};
use crate::net::{klassificer_ipv4, klassificer_ipv6, klassificer_mac, laes_ipv4, laes_ipv6, laes_mac, Ipv4Klasse, Ipv6Klasse, MacKlasse};
use crate::typer::Klasse;

/// En kodeform i teksten.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum Kodeform {
    Navn(Klasse),
    Ipv4(u32),
    Ipv6(u128),
    Mac(u64),
}

const GRUPPER: [(&str, Klasse); 12] = [
    ("h", Klasse::Vaert),
    ("u", Klasse::Bruger),
    ("p", Klasse::Person),
    ("db", Klasse::Database),
    ("o", Klasse::Ord),
    ("sn", Klasse::Serie),
    ("sec", Klasse::Hemmelighed),
    ("nb", Klasse::Netbios),
    ("d", Klasse::Domaene),
    ("g", Klasse::Guid),
    ("c", Klasse::Cpr),
    ("sid", Klasse::Sid),
];

fn navne_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| {
        regex::bytes::RegexBuilder::new(concat!(
            r"(?i)(?P<h>h[0-9]{4,}[a-z]*)|(?P<u>user[0-9]{4,}[a-z]*)|(?P<p>person [0-9]{4,}[a-z]*)",
            r"|(?P<db>db[0-9]{4,}[a-z]*)|(?P<o>ord[0-9]{4,}[a-z]*)|(?P<sn>sn[0-9]{4,}[a-z]*)",
            r"|(?P<sec>grimnir_secret_[0-9]{4,}[a-z]*)|(?P<nb>nb[0-9]{2,}[a-z]*)|(?P<d>d[0-9]{2,}[a-z]*\.example)",
            r"|(?P<g>00000000-0000-0000-0000-[0-9]{12})|(?P<c>000000-[0-9]{4,}[a-z]*)|(?P<sid>s-1-5-21-0-0-[0-9]+(?:-[0-9]+)?)"
        ))
        .unicode(false)
        .build()
        .expect("fast mønster i kernen kan ikke oversættes")
    })
}

/// Navnekoder ved grænser: (start, slut, klasse).
pub(crate) fn find_navnekoder(tekst: &[u8], mut f: impl FnMut(usize, usize, Klasse)) {
    let re = navne_re();
    let mut pos = 0;
    while pos <= tekst.len() {
        let Some(c) = re.captures_at(tekst, pos) else { break };
        let Some(m) = c.get(0) else { break };
        if ved_graense(tekst, m.start(), m.end(), Klasse::Vaert.moenster()) {
            let klasse = GRUPPER
                .iter()
                .find(|(n, _)| c.name(n).is_some())
                .map(|(_, k)| *k)
                .unwrap_or(Klasse::Ord);
            f(m.start(), m.end(), klasse);
            pos = m.end().max(m.start() + 1);
        } else {
            pos = m.start() + 1;
        }
    }
}

/// Alle IPv4-formede spænd, som kodesøgningen kunne ramme: fra hver grænse fire talrækker med punktum
/// imellem og en grænse bagefter. Prøver alle startpositioner, så `203.0.113.1` i `9.203.0.113.1` også findes.
fn alle_ipv4(t: &[u8], mut f: impl FnMut(usize, usize, u32)) {
    for s in 0..t.len() {
        if !t[s].is_ascii_digit() || !graense_foer(t, s, Moenster::Ipv4) {
            continue;
        }
        let mut e = s;
        let mut dele = 0;
        while dele < 4 {
            let d = e;
            while e < t.len() && t[e].is_ascii_digit() {
                e += 1;
            }
            if e == d {
                break;
            }
            dele += 1;
            if dele < 4 {
                if e < t.len() && t[e] == b'.' {
                    e += 1;
                } else {
                    break;
                }
            }
        }
        if dele == 4 && ved_graense(t, s, e, Moenster::Ipv4) {
            if let Some(ip) = laes_ipv4(&t[s..e]) {
                f(s, e, ip.verdi);
            }
        }
    }
}

/// Alle IPv6-formede spænd ved grænser, også inde i længere rækker af hextegn og kolon.
fn alle_ipv6(t: &[u8], mut f: impl FnMut(usize, usize, u128)) {
    let mut i = 0;
    while i < t.len() {
        if !(t[i].is_ascii_hexdigit() || t[i] == b':') {
            i += 1;
            continue;
        }
        let start = i;
        while i < t.len() && (t[i].is_ascii_hexdigit() || t[i] == b':') {
            i += 1;
        }
        let slut = i;
        if t[start..slut].iter().filter(|b| **b == b':').count() < 2 {
            continue;
        }
        // Hver position kan være start eller slut, hvis grænsereglen siger ja (som i kodesøgningen).
        let starter: Vec<usize> = (start..slut)
            .filter(|s| t[*s].is_ascii_hexdigit() || t[*s] == b':')
            .filter(|s| graense_foer(t, *s, Moenster::Hex))
            .collect();
        let ender: Vec<usize> = (start + 1..=slut).filter(|e| graense_efter(t, *e, Moenster::Hex)).collect();
        for &s in &starter {
            for &e in ender.iter().filter(|e| **e > s) {
                if let Some(ip) = laes_ipv6(&t[s..e]) {
                    f(s, e, ip.verdi);
                }
            }
        }
    }
}

/// Alle MAC-formede spænd ved grænser, også inde i længere rækker.
fn alle_mac(t: &[u8], mut f: impl FnMut(usize, usize, u64)) {
    for s in 0..t.len() {
        if !t[s].is_ascii_hexdigit() || !graense_foer(t, s, Moenster::Hex) {
            continue;
        }
        for l in [17, 14] {
            if s + l <= t.len() && ved_graense(t, s, s + l, Moenster::Hex) {
                if let Some(m) = laes_mac(&t[s..s + l]) {
                    f(s, s + l, m.verdi);
                }
            }
        }
    }
}

/// Alle kodeformer i teksten (navne, adresser i kodeområderne, MAC-adresser i kodeområderne).
/// Finder mindst alt det, som demaskeringens kodesøgning kan ramme.
pub(crate) fn find_kodeformer(tekst: &[u8], mut f: impl FnMut(usize, usize, Kodeform)) {
    find_navnekoder(tekst, |s, e, k| f(s, e, Kodeform::Navn(k)));
    alle_ipv4(tekst, |s, e, v| {
        if klassificer_ipv4(v) == Ipv4Klasse::Kodeomraade {
            f(s, e, Kodeform::Ipv4(v));
        }
    });
    alle_ipv6(tekst, |s, e, v| {
        if klassificer_ipv6(v) == Ipv6Klasse::Kodeomraade {
            f(s, e, Kodeform::Ipv6(v));
        }
    });
    alle_mac(tekst, |s, e, v| {
        if klassificer_mac(v) == MacKlasse::Kodeomraade {
            f(s, e, Kodeform::Mac(v));
        }
    });
}
