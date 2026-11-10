//! IPv4, IPv6 og MAC: læsning, stavemåde, klassificering og formatering.
//!
//! `regex` har ingen lookaround; mønstrene matcher bredt, og koden her validerer bagefter.

use std::sync::OnceLock;

use regex::bytes::Regex;

use crate::graense::{graense_efter, graense_foer, Moenster};

fn regex(kilde: &str) -> Regex {
    regex::bytes::RegexBuilder::new(kilde)
        .unicode(false)
        .build()
        .expect("fast mønster i kernen kan ikke oversættes")
}

// ---------------------------------------------------------------- IPv4

/// En IPv4-adresse med originalens stavemåde (antal cifre pr. del).
#[derive(Clone, Copy, PartialEq, Eq)]
pub(crate) struct Ipv4 {
    pub verdi: u32,
    pub bredder: [u8; 4],
}

/// Læser præcis fire dele på 0–255 med 1–3 cifre hver.
pub(crate) fn laes_ipv4(s: &[u8]) -> Option<Ipv4> {
    let mut verdi: u32 = 0;
    let mut bredder = [0u8; 4];
    let mut dele = 0;
    for del in s.split(|b| *b == b'.') {
        if dele == 4 || del.is_empty() || del.len() > 3 || !del.iter().all(u8::is_ascii_digit) {
            return None;
        }
        let tal = del.iter().fold(0u32, |a, b| a * 10 + u32::from(b - b'0'));
        if tal > 255 {
            return None;
        }
        verdi = (verdi << 8) | tal;
        bredder[dele] = del.len() as u8;
        dele += 1;
    }
    (dele == 4).then_some(Ipv4 { verdi, bredder })
}

/// Formaterer en adresse; med bredder spejles foranstillede nuller, hvor det kan lade sig gøre.
pub(crate) fn formater_ipv4(verdi: u32, bredder: Option<[u8; 4]>) -> String {
    let okt = verdi.to_be_bytes();
    let mut ud = String::with_capacity(15);
    for (i, o) in okt.iter().enumerate() {
        if i > 0 {
            ud.push('.');
        }
        let b = bredder.map(|b| b[i] as usize).unwrap_or(0);
        ud.push_str(&format!("{o:0b$}"));
    }
    ud
}

/// Sand, hvis stavemåden har foranstillede nuller.
pub(crate) fn har_nuller(ip: &Ipv4) -> bool {
    ip.verdi
        .to_be_bytes()
        .iter()
        .zip(ip.bredder)
        .any(|(o, b)| (b as usize) > o.to_string().len())
}

/// Hvordan en IPv4-adresse skal behandles.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum Ipv4Klasse {
    /// Røres aldrig.
    Aldrig,
    /// Ligger i et af kodeområderne.
    Kodeomraade,
    /// RFC 1918.
    Privat,
    /// Alt andet.
    Fremmed,
}

pub(crate) fn i_net(v: u32, net: u32, praefiks: u32) -> bool {
    let maske = if praefiks == 0 { 0 } else { u32::MAX << (32 - praefiks) };
    v & maske == net & maske
}

/// Sand, hvis værdien er en netmaske (sammenhængende ettaller, første del 255).
pub(crate) fn er_netmaske(v: u32) -> bool {
    (v >> 24 == 255 && (!v).wrapping_add(1).is_power_of_two()) || v == u32::MAX
}

pub(crate) fn klassificer_ipv4(v: u32) -> Ipv4Klasse {
    const TEST_NET: [u32; 3] = [0xC000_0200, 0xC633_6400, 0xCB00_7100];
    if v == 0 || v == u32::MAX || er_netmaske(v) || i_net(v, 0, 8) || i_net(v, 0x7F00_0000, 8) || i_net(v, 0xA9FE_0000, 16) {
        return Ipv4Klasse::Aldrig;
    }
    if i_net(v, 0xE000_0000, 4) {
        return Ipv4Klasse::Aldrig;
    }
    if i_net(v, 0xC612_0000, 15) || TEST_NET.iter().any(|n| i_net(v, *n, 24)) || i_net(v, 0xF000_0000, 4) {
        return Ipv4Klasse::Kodeomraade;
    }
    if i_net(v, 0x0A00_0000, 8) || i_net(v, 0xAC10_0000, 12) || i_net(v, 0xC0A8_0000, 16) {
        return Ipv4Klasse::Privat;
    }
    Ipv4Klasse::Fremmed
}

/// Alle IPv4-adresser ved grænser i teksten: (start, slut, adresse, grænse foran overholdt).
/// Grænsen bagefter er altid overholdt; grænsen foran meldes, så genkenderen kan se `v10.2.3.4`.
pub(crate) fn find_ipv4(tekst: &[u8], mut f: impl FnMut(usize, usize, Ipv4, bool)) {
    static RE: OnceLock<Regex> = OnceLock::new();
    let re = RE.get_or_init(|| regex(r"[0-9]+(?:\.[0-9]+)+"));
    for m in re.find_iter(tekst) {
        if let Some(ip) = laes_ipv4(m.as_bytes()) {
            if graense_efter(tekst, m.end(), Moenster::Ipv4) {
                f(m.start(), m.end(), ip, graense_foer(tekst, m.start(), Moenster::Ipv4));
            }
        }
    }
}

// ---------------------------------------------------------------- IPv6

/// Genkendernes eget, strengere tjek: en hex-adresse må ikke være en del af en længere række
/// (`aa:bb:cc:dd:ee:ff:00`). Bruges kun til at finde adresser i originalen, ikke til koder.
fn hex_fortsaetter(tekst: &[u8], start: usize, slut: usize) -> bool {
    let sep = |b: u8| matches!(b, b':' | b'.' | b'-');
    let foer = start >= 2 && sep(tekst[start - 1]) && tekst[start - 2].is_ascii_hexdigit();
    let efter = slut + 1 < tekst.len() && sep(tekst[slut]) && tekst[slut + 1].is_ascii_hexdigit();
    foer || efter
}

/// En IPv6-adresse med originalens stavemåde.
#[derive(Clone, Copy, PartialEq, Eq)]
pub(crate) struct Ipv6 {
    pub verdi: u128,
    /// Sand, hvis originalen bruger `::`.
    pub komprimeret: bool,
    /// Antal hextegn pr. gruppe (kun når adressen ikke er komprimeret).
    pub bredder: [u8; 8],
    /// Sand, hvis originalen kun har store hexbogstaver.
    pub store: bool,
}

fn laes_grupper(s: &[u8]) -> Option<Vec<(u16, u8)>> {
    if s.is_empty() {
        return Some(Vec::new());
    }
    s.split(|b| *b == b':')
        .map(|g| {
            if g.is_empty() || g.len() > 4 || !g.iter().all(u8::is_ascii_hexdigit) {
                return None;
            }
            let v = g.iter().fold(0u16, |a, b| (a << 4) | (*b as char).to_digit(16).unwrap_or(0) as u16);
            Some((v, g.len() as u8))
        })
        .collect()
}

/// Læser en IPv6-adresse uden indlejret IPv4 og uden zone.
pub(crate) fn laes_ipv6(s: &[u8]) -> Option<Ipv6> {
    let store = s.iter().any(u8::is_ascii_uppercase) && !s.iter().any(u8::is_ascii_lowercase);
    let pos = s.windows(2).position(|w| w == b"::");
    let (grupper, komprimeret) = match pos {
        Some(p) => {
            let venstre = laes_grupper(&s[..p])?;
            let hoejre = laes_grupper(&s[p + 2..])?;
            if s[p + 2..].windows(2).any(|w| w == b"::") || venstre.len() + hoejre.len() > 7 {
                return None;
            }
            let mut alle = venstre;
            alle.resize(8 - hoejre.len(), (0, 1));
            alle.extend(hoejre);
            (alle, true)
        }
        None => {
            let g = laes_grupper(s)?;
            if g.len() != 8 {
                return None;
            }
            (g, false)
        }
    };
    let mut verdi: u128 = 0;
    let mut bredder = [0u8; 8];
    for (i, (v, b)) in grupper.iter().enumerate() {
        verdi = (verdi << 16) | u128::from(*v);
        bredder[i] = *b;
    }
    Some(Ipv6 {
        verdi,
        komprimeret,
        bredder,
        store,
    })
}

/// RFC 5952-form: små bogstaver, ingen foranstillede nuller, længste nulrække (mindst to) som `::`.
pub(crate) fn formater_ipv6_kort(v: u128) -> String {
    let g: Vec<u16> = (0..8).map(|i| (v >> (112 - 16 * i)) as u16).collect();
    let (mut bedst, mut bedst_len, mut i) = (usize::MAX, 0, 0);
    while i < 8 {
        if g[i] == 0 {
            let s = i;
            while i < 8 && g[i] == 0 {
                i += 1;
            }
            if i - s > bedst_len && i - s >= 2 {
                bedst = s;
                bedst_len = i - s;
            }
        } else {
            i += 1;
        }
    }
    let del = |a: &[u16]| a.iter().map(|x| format!("{x:x}")).collect::<Vec<_>>().join(":");
    if bedst == usize::MAX {
        del(&g)
    } else {
        format!("{}::{}", del(&g[..bedst]), del(&g[bedst + bedst_len..]))
    }
}

/// Formaterer en kode, så den spejler originalens stavemåde.
pub(crate) fn formater_ipv6(v: u128, stav: &Ipv6) -> String {
    let ud = if stav.komprimeret {
        formater_ipv6_kort(v)
    } else {
        (0..8)
            .map(|i| {
                let x = (v >> (112 - 16 * i)) as u16;
                format!("{x:0w$x}", w = stav.bredder[i] as usize)
            })
            .collect::<Vec<_>>()
            .join(":")
    };
    if stav.store {
        ud.to_ascii_uppercase()
    } else {
        ud
    }
}

/// Hvordan en IPv6-adresse skal behandles.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum Ipv6Klasse {
    Aldrig,
    Kodeomraade,
    Egen,
    Fremmed,
}

pub(crate) fn klassificer_ipv6(v: u128) -> Ipv6Klasse {
    let top16 = (v >> 112) as u16;
    if v <= 1 || top16 >> 8 == 0xff || v >> 32 == 0xffff || v >> 96 == 0 {
        return Ipv6Klasse::Aldrig;
    }
    if top16 & 0xffc0 == 0xfe80 {
        // link-local: kun hvis interface-delen er bygget på en MAC (EUI-64: ff:fe i midten)
        let iid = v as u64;
        return if (iid >> 24) & 0xffff == 0xfffe {
            Ipv6Klasse::Egen
        } else {
            Ipv6Klasse::Aldrig
        };
    }
    if v >> 96 == 0x2001_0db8 || (v >> 108) == 0x3fff0 {
        return Ipv6Klasse::Kodeomraade;
    }
    if top16 & 0xfe00 == 0xfc00 {
        return Ipv6Klasse::Egen;
    }
    Ipv6Klasse::Fremmed
}

/// Alle IPv6-adresser ved grænser i teksten.
pub(crate) fn find_ipv6(tekst: &[u8], mut f: impl FnMut(usize, usize, Ipv6)) {
    static RE: OnceLock<Regex> = OnceLock::new();
    let re = RE.get_or_init(|| regex(r"[0-9A-Fa-f]*:[0-9A-Fa-f]*:[0-9A-Fa-f:]*"));
    for m in re.find_iter(tekst) {
        let (start, mut slut) = (m.start(), m.end());
        let s = m.as_bytes();
        if s.ends_with(b":") && !s.ends_with(b"::") {
            slut -= 1;
        }
        let kandidat = &tekst[start..slut];
        if !kandidat.iter().any(u8::is_ascii_digit) {
            continue;
        }
        if let Some(ip) = laes_ipv6(kandidat) {
            if graense_foer(tekst, start, Moenster::Hex)
                && graense_efter(tekst, slut, Moenster::Hex)
                && !hex_fortsaetter(tekst, start, slut)
            {
                f(start, slut, ip);
            }
        }
    }
}

// ---------------------------------------------------------------- MAC

/// Skilletegnet i en MAC-adresse.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum MacForm {
    Kolon,
    Bindestreg,
    Punktum,
}

/// En MAC-adresse med originalens stavemåde.
#[derive(Clone, Copy, PartialEq, Eq)]
pub(crate) struct Mac {
    pub verdi: u64,
    pub form: MacForm,
    pub store: bool,
}

pub(crate) fn laes_mac(s: &[u8]) -> Option<Mac> {
    let store = s.iter().any(u8::is_ascii_uppercase) && !s.iter().any(u8::is_ascii_lowercase);
    let (form, hex): (MacForm, Vec<u8>) = if s.len() == 17 && (s[2] == b':' || s[2] == b'-') {
        let sep = s[2];
        if (0..5).any(|i| s[2 + 3 * i] != sep) {
            return None;
        }
        (
            if sep == b':' { MacForm::Kolon } else { MacForm::Bindestreg },
            s.iter().copied().filter(|b| *b != sep).collect(),
        )
    } else if s.len() == 14 && s[4] == b'.' && s[9] == b'.' {
        (MacForm::Punktum, s.iter().copied().filter(|b| *b != b'.').collect())
    } else {
        return None;
    };
    if hex.len() != 12 || !hex.iter().all(u8::is_ascii_hexdigit) {
        return None;
    }
    let verdi = hex
        .iter()
        .fold(0u64, |a, b| (a << 4) | u64::from((*b as char).to_digit(16).unwrap_or(0)));
    Some(Mac { verdi, form, store })
}

pub(crate) fn formater_mac(v: u64, form: MacForm, store: bool) -> String {
    let b: Vec<u8> = (0..6).map(|i| (v >> (40 - 8 * i)) as u8).collect();
    let ud = match form {
        MacForm::Kolon => b.iter().map(|x| format!("{x:02x}")).collect::<Vec<_>>().join(":"),
        MacForm::Bindestreg => b.iter().map(|x| format!("{x:02x}")).collect::<Vec<_>>().join("-"),
        MacForm::Punktum => format!("{:02x}{:02x}.{:02x}{:02x}.{:02x}{:02x}", b[0], b[1], b[2], b[3], b[4], b[5]),
    };
    if store {
        ud.to_ascii_uppercase()
    } else {
        ud
    }
}

/// Hvordan en MAC-adresse skal behandles.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum MacKlasse {
    Aldrig,
    Kodeomraade,
    Egen,
}

pub(crate) fn klassificer_mac(v: u64) -> MacKlasse {
    if v == 0 || v == 0xffff_ffff_ffff {
        MacKlasse::Aldrig
    } else if v >> 8 == 0x00_005e_0053 || v >> 24 == 0x02_0000 {
        MacKlasse::Kodeomraade
    } else {
        MacKlasse::Egen
    }
}

/// Alle MAC-adresser ved grænser i teksten.
pub(crate) fn find_mac(tekst: &[u8], mut f: impl FnMut(usize, usize, Mac)) {
    static RE: OnceLock<Regex> = OnceLock::new();
    let re = RE.get_or_init(|| {
        regex(r"[0-9A-Fa-f]{2}(?::[0-9A-Fa-f]{2}){5}|[0-9A-Fa-f]{2}(?:-[0-9A-Fa-f]{2}){5}|[0-9A-Fa-f]{4}\.[0-9A-Fa-f]{4}\.[0-9A-Fa-f]{4}")
    });
    let mut pos = 0;
    while let Some(m) = re.find_at(tekst, pos) {
        if graense_foer(tekst, m.start(), Moenster::Hex)
            && graense_efter(tekst, m.end(), Moenster::Hex)
            && !hex_fortsaetter(tekst, m.start(), m.end())
        {
            if let Some(mac) = laes_mac(m.as_bytes()) {
                f(m.start(), m.end(), mac);
            }
            pos = m.end();
        } else {
            pos = m.start() + 1;
        }
    }
}

#[cfg(test)]
mod test {
    use super::*;

    #[test]
    fn ipv4_laeses_og_spejles() {
        let ip = laes_ipv4(b"010.020.030.001").expect("gyldig");
        assert_eq!(formater_ipv4(0xC612_0001, Some(ip.bredder)), "198.018.000.001");
        assert!(har_nuller(&ip));
        assert!(laes_ipv4(b"1.3.6.1.4").is_none());
        assert!(laes_ipv4(b"256.1.1.1").is_none());
    }

    #[test]
    fn ipv6_kort_form() {
        let ip = laes_ipv6(b"2001:DB8:0:0::1").expect("gyldig");
        assert_eq!(formater_ipv6_kort(ip.verdi), "2001:db8::1");
        assert!(ip.store);
        assert!(laes_ipv6(b"11:30:00").is_none());
        assert!(laes_ipv6(b"aa:bb:cc:dd:ee:ff").is_none());
        assert_eq!(klassificer_ipv6(ip.verdi), Ipv6Klasse::Kodeomraade);
        assert_eq!(
            klassificer_ipv6(laes_ipv6(b"3fff::1").expect("gyldig").verdi),
            Ipv6Klasse::Kodeomraade
        );
    }

    #[test]
    fn mac_former() {
        let m = laes_mac(b"AA-BB-CC-00-11-22").expect("gyldig");
        assert_eq!(formater_mac(m.verdi, m.form, m.store), "AA-BB-CC-00-11-22");
        let p = laes_mac(b"aabb.cc00.1122").expect("gyldig");
        assert_eq!(p.verdi, m.verdi);
    }
}
