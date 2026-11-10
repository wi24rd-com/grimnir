//! Brugerens ordbog: "maskér altid" og "maskér aldrig".

use crate::net::{i_net, laes_ipv4};
use crate::typer::Fejl;

/// Brugerens ordbog.
///
/// Ordbogen er selv følsom (den indeholder domæner og navne) og gemmes krypteret i B3.
#[derive(Clone, Default)]
pub struct Ordbog {
    /// Egne DNS-domæner (`eksempel.dk`). En indgang uden punktum er et NetBIOS-domæne (`KONTOR`).
    pub domaener: Vec<String>,
    /// Navnemønstre for maskiner: `#` er ét ciffer, `*` er nul eller flere bogstaver, cifre og `-` (`srv-###`, `WS-*`).
    pub navnemoenstre: Vec<String>,
    /// Egne net i CIDR-form (`10.20.0.0/16`) ud over RFC 1918.
    pub net: Vec<String>,
    /// Ord, der altid maskeres (projektnavne, kundenavne).
    pub ord: Vec<String>,
    /// Personnavne, der altid maskeres.
    pub personer: Vec<String>,
    /// Værdier, der aldrig maskeres. Vinder over alt andet. En indgang i CIDR-form gælder hele nettet.
    pub aldrig: Vec<String>,
}

impl Ordbog {
    /// En tom ordbog.
    pub fn ny() -> Self {
        Ordbog::default()
    }

    /// Kontrollerer, at alle net kan læses.
    pub fn valider(&self) -> Result<(), Fejl> {
        for (i, n) in self.net.iter().enumerate() {
            if laes_cidr(n).is_none() {
                return Err(Fejl::UgyldigtNet { indgang: i });
            }
        }
        Ok(())
    }

    /// Sand, hvis adressen ligger i et af ordbogens egne net.
    pub(crate) fn eget_net(&self, v: u32) -> bool {
        self.net.iter().filter_map(|n| laes_cidr(n)).any(|(net, p)| i_net(v, net, p))
    }

    /// Sand, hvis adressen står på "maskér aldrig" (som adresse eller net).
    pub(crate) fn aldrig_ipv4(&self, v: u32) -> bool {
        self.aldrig.iter().filter_map(|n| laes_cidr(n)).any(|(net, p)| i_net(v, net, p))
    }

    /// Sand, hvis værdien står på "maskér aldrig" (uafhængigt af store/små).
    pub(crate) fn aldrig_tekst(&self, s: &[u8]) -> bool {
        self.aldrig.iter().any(|a| a.as_bytes().eq_ignore_ascii_case(s))
    }

    /// DNS-domæner (med punktum), små bogstaver.
    pub(crate) fn dns_domaener(&self) -> Vec<String> {
        self.domaener
            .iter()
            .map(|d| d.trim().trim_matches('.').to_ascii_lowercase())
            .filter(|d| d.contains('.'))
            .collect()
    }

    /// Kendte NetBIOS-navne: indgange uden punktum og første del af hvert DNS-domæne.
    pub(crate) fn netbios(&self) -> Vec<String> {
        let mut ud: Vec<String> = self
            .domaener
            .iter()
            .map(|d| d.trim().to_ascii_lowercase())
            .filter(|d| !d.is_empty() && !d.contains('.'))
            .collect();
        for d in self.dns_domaener() {
            if let Some(f) = d.split('.').next() {
                ud.push(f.to_string());
            }
        }
        ud
    }
}

/// Læser `a.b.c.d/p` eller en enkelt adresse.
pub(crate) fn laes_cidr(s: &str) -> Option<(u32, u32)> {
    let s = s.trim();
    let (adr, p) = match s.split_once('/') {
        Some((a, p)) => (a, p.parse::<u32>().ok()?),
        None => (s, 32),
    };
    if p > 32 {
        return None;
    }
    laes_ipv4(adr.as_bytes()).map(|ip| (ip.verdi, p))
}
