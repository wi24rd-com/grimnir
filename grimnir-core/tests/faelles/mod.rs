//! Fælles hjælpere til testene. Kun opdigtede data.
#![allow(dead_code)]

pub mod korpus;

use grimnir_core::{analyser, demasker, foreslaa, laekagetjek, masker, Advarsel, Fund, Ordbog, Rest, Sag};

/// Standardordbogen for korpusset.
pub fn ordbog() -> Ordbog {
    let mut o = Ordbog::ny();
    o.domaener = vec!["eksempel.dk".into(), "intern.eksempel.dk".into(), "KONTOR".into()];
    o.navnemoenstre = vec!["srv-###".into(), "WS-*".into()];
    o.net = vec!["100.70.0.0/16".into()];
    o.ord = vec!["Projekt Uglebo".into()];
    o.personer = vec!["Anna Testesen".into()];
    o
}

/// Resultatet af en hel kæde.
pub struct Kaede {
    pub fund: Vec<Fund>,
    pub maskeret: String,
    pub tilbage: String,
    pub rester: Vec<Rest>,
    pub advarsler: Vec<Advarsel>,
}

/// analyser → foreslaa → masker → laekagetjek → demasker.
pub fn kaede(tekst: &str, ordbog: &Ordbog, sag: &mut Sag) -> Kaede {
    let fund = analyser(tekst, ordbog);
    let e = foreslaa(&fund, tekst, sag);
    let maskeret = masker(tekst, &e);
    let rester = laekagetjek(&maskeret, sag, ordbog);
    let (tilbage, advarsler) = demasker(&maskeret, sag);
    Kaede {
        fund,
        maskeret,
        tilbage,
        rester,
        advarsler,
    }
}

/// Teksten i hvert fund.
pub fn tekster<'a>(tekst: &'a str, fund: &[Fund]) -> Vec<&'a str> {
    fund.iter().map(|f| &tekst[f.start..f.slut]).collect()
}

/// Fundet, der dækker præcis denne værdi (første forekomst).
pub fn fund_for<'a>(tekst: &str, fund: &'a [Fund], vaerdi: &str) -> Option<&'a Fund> {
    fund.iter().find(|f| &tekst[f.start..f.slut] == vaerdi)
}

/// Lille deterministisk talgenerator (fast frø), så korpus og egenskaber kan genskabes.
pub struct Frø(u64);

impl Frø {
    pub fn ny(frø: u64) -> Self {
        Frø(frø)
    }
    pub fn tal(&mut self, n: u64) -> u64 {
        self.0 = self.0.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
        (self.0 >> 33) % n
    }
    pub fn vaelg<'a, T>(&mut self, liste: &'a [T]) -> &'a T {
        &liste[self.tal(liste.len() as u64) as usize]
    }
}
