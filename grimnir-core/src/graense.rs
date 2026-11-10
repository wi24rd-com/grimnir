//! Én grænseregel for både maskering og demaskering (kontrol 8.3).
//!
//! Et grænsetegn er alt andet end ASCII-bogstaver og cifre, så `_`, `-`, `.` og `:` er grænser.
//! Tegn, der er en del af selve mønsteret (`-` i `srv-068`, `.` i en adresse), ligger inde i spændet,
//! fordi genkenderne og koderne selv omfatter dem; længste kode vinder. Et `%XX` (URL-kodning) lige
//! foran et navn og en escape-sekvens (`\\n`, `\\r`, `\\t`) lige foran et spænd tæller som grænse. Reglen bruges af genkenderne, af kollisionskontrollen og af demaskeringen;
//! `\b` fra `regex` bruges ikke til koder.

/// Hvilket mønster et spænd tilhører.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Moenster {
    /// Navne og navnekoder.
    Navn,
    /// IPv4-adresser.
    Ipv4,
    /// IPv6- og MAC-adresser.
    Hex,
}

fn er_hex(b: u8) -> bool {
    b.is_ascii_hexdigit()
}

/// Sand, hvis `%XX` står lige før `start`.
fn procent_foer(tekst: &[u8], start: usize) -> bool {
    start >= 3 && tekst[start - 3] == b'%' && er_hex(tekst[start - 2]) && er_hex(tekst[start - 1])
}

/// Sand, hvis en escape-sekvens (`\n`, `\r`, `\t`) står lige før `start`, fx i JSON.
fn escape_foer(tekst: &[u8], start: usize) -> bool {
    start >= 2 && tekst[start - 2] == b'\\' && matches!(tekst[start - 1], b'n' | b'r' | b't')
}

/// Sand, hvis et spænd, der begynder ved `start`, begynder ved en grænse.
///
/// Kun nabotegnet tæller. Det er bevidst: når naboen selv er en kode, ændres tegnene længere ude
/// ved maskeringen, og en regel, der kiggede længere ud, ville give et andet svar ved demaskeringen.
pub fn graense_foer(tekst: &[u8], start: usize, m: Moenster) -> bool {
    if start == 0 {
        return true;
    }
    if tekst[start - 1].is_ascii_alphanumeric() {
        return escape_foer(tekst, start) || (m == Moenster::Navn && procent_foer(tekst, start));
    }
    true
}

/// Sand, hvis et spænd, der slutter ved `slut` (eksklusiv), slutter ved en grænse.
pub fn graense_efter(tekst: &[u8], slut: usize, _m: Moenster) -> bool {
    slut >= tekst.len() || !tekst[slut].is_ascii_alphanumeric()
}

/// Sand, hvis spændet `start..slut` står ved grænser i begge ender.
pub fn ved_graense(tekst: &[u8], start: usize, slut: usize, m: Moenster) -> bool {
    graense_foer(tekst, start, m) && graense_efter(tekst, slut, m)
}

/// Sand, hvis spændet står lige efter en URL-kodning (`%XX`).
pub(crate) fn efter_procent(tekst: &[u8], start: usize) -> bool {
    start >= 1 && tekst[start - 1].is_ascii_alphanumeric() && procent_foer(tekst, start)
}
