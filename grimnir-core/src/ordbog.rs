//! Brugerens ordbog: "maskér altid" og "maskér aldrig".

use std::collections::HashSet;

use crate::net::laes_ipv4;
use crate::typer::Fejl;

/// Brugerens ordbog.
///
/// Ordbogen er selv følsom (den indeholder domæner og navne) og gemmes krypteret i B3.
#[derive(Clone, Default)]
pub struct Ordbog {
    /// Egne DNS-domæner (`kontor.test`). En indgang uden punktum er et NetBIOS-domæne (`KONTOR`).
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

    /// Ordbogens opslag, læst én gang (fund 4 i V-SKAL.2). Kernens funktioner bygger dem én gang pr. kald, så et
    /// opslag pr. fund ikke er lineært i ordbogens størrelse.
    pub(crate) fn opslag(&self) -> Opslag {
        Opslag {
            aldrig_tekst: self.aldrig.iter().map(|a| a.as_bytes().to_ascii_lowercase()).collect(),
            aldrig_net: NetSaet::ny(&self.aldrig),
            egne_net: NetSaet::ny(&self.net),
        }
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

/// Net læst på forhånd: ét sæt pr. præfikslængde, så et opslag højst er 33 opslag i et `HashSet`.
#[derive(Default)]
struct NetSaet {
    laengder: Vec<u32>,
    net: HashSet<(u32, u32)>,
}

fn maske(v: u32, praefiks: u32) -> u32 {
    if praefiks == 0 {
        0
    } else {
        v & (u32::MAX << (32 - praefiks))
    }
}

impl NetSaet {
    /// Indgange, der kan læses som adresse eller CIDR; resten springes over (som før).
    fn ny(liste: &[String]) -> Self {
        let mut s = NetSaet::default();
        for (net, p) in liste.iter().filter_map(|n| laes_cidr(n)) {
            if s.net.insert((p, maske(net, p))) && !s.laengder.contains(&p) {
                s.laengder.push(p);
            }
        }
        s
    }

    fn indeholder(&self, v: u32) -> bool {
        self.laengder.iter().any(|&p| self.net.contains(&(p, maske(v, p))))
    }
}

/// Ordbogens opslag for ét kald (se [`Ordbog::opslag`]).
pub(crate) struct Opslag {
    /// "Maskér aldrig" med små bogstaver.
    aldrig_tekst: HashSet<Vec<u8>>,
    aldrig_net: NetSaet,
    egne_net: NetSaet,
}

impl Opslag {
    /// Sand, hvis adressen ligger i et af ordbogens egne net.
    pub(crate) fn eget_net(&self, v: u32) -> bool {
        self.egne_net.indeholder(v)
    }

    /// Sand, hvis adressen står på "maskér aldrig" (som adresse eller net).
    pub(crate) fn aldrig_ipv4(&self, v: u32) -> bool {
        self.aldrig_net.indeholder(v)
    }

    /// Sand, hvis værdien står på "maskér aldrig" (uafhængigt af store/små).
    pub(crate) fn aldrig_tekst(&self, s: &[u8]) -> bool {
        !self.aldrig_tekst.is_empty() && self.aldrig_tekst.contains(&s.to_ascii_lowercase())
    }
}
