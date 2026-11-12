//! V-MANUEL.2 N3: forslag til navnemønstre for maskiner.
//!
//! Ser Grimnir flere maskinnavne med samme form i en tekst (`srv-db02`, `srv-web03`, `srv-fil04`; `pc-17`, `pc-204`),
//! foreslås mønsteret (`srv-*`, `pc-*`), så brugeren med ét valg kan lægge det i ordbogen som navnemønster. Reglerne:
//!
//! - Navnene er tekstens maskiner ([`Art::Vaert`]) med status Sikker, Ordbog eller Sandsynlig ("Tjek selv" og versioner
//!   tæller ikke med), med mindst ét ciffer og kun bogstaver, cifre og `-`. Et navn, et af ordbogens navnemønstre allerede
//!   rammer, tæller ikke med.
//! - Et navn deles i et præfiks (mindst to bogstaver) og resten: `srv-` + `db02` (med bindestreg) eller `dc` + `01` (uden).
//! - Mindst to forskellige navne med samme præfiks giver et forslag. Er resten cifre med samme antal i alle navnene, bliver
//!   det `#` pr. ciffer (`dc##`, `pc-###`); ellers `*` efter en bindestreg (`srv-*`). Uden bindestreg kræves cifre med samme
//!   antal (`dc*` ville også ramme almindelige ord).
//! - Et præfiks, der er et almindeligt ord ([`crate::analyse::STOPORD`]), giver intet forslag.
//!
//! Mønstrene har ordbogens form (`#` er ét ciffer, `*` er nul eller flere bogstaver, cifre og `-`), så de kan lægges i
//! ordbogen, som de er.

use std::collections::{BTreeMap, BTreeSet};
use std::fmt;

use regex::RegexBuilder;

use crate::analyse::STOPORD;
use crate::ordbog::Ordbog;
use crate::typer::{Art, Fund, Sikkerhed};

/// Et forslag til et navnemønster. `moenster` indeholder en del af tekstens navne (præfikset), så typen viser det ikke i
/// `Debug`.
#[derive(Clone, PartialEq, Eq)]
pub struct MoensterForslag {
    /// Mønsteret i ordbogens form (`srv-*`, `pc-###`, `dc##`), med små bogstaver.
    pub moenster: String,
    /// Antal forskellige maskinnavne i teksten, der har formen.
    pub navne: usize,
}

impl fmt::Debug for MoensterForslag {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("MoensterForslag")
            .field("moenster", &"<skjult>")
            .field("navne", &self.navne)
            .finish()
    }
}

/// Højst så mange forslag pr. tekst.
const MAKS_FORSLAG: usize = 5;

/// Ordbogens navnemønstre som ét regulært udtryk for hele navne (som [`crate::analyse::analyser`] læser dem).
fn ordbogens_moenstre(ordbog: &Ordbog) -> Option<regex::Regex> {
    let dele: Vec<String> = ordbog
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
    if dele.is_empty() {
        return None;
    }
    RegexBuilder::new(&format!("(?i)^(?:{})$", dele.join("|"))).build().ok()
}

/// Præfiks og rest for et navn: (`srv-`, `db02`, true) eller (`dc`, `01`, false).
fn del(navn: &str) -> Option<(&str, &str, bool)> {
    let b = navn.as_bytes();
    let n = b.iter().take_while(|c| c.is_ascii_alphabetic()).count();
    if n < 2 || n >= b.len() {
        return None;
    }
    if b[n] == b'-' {
        let rest = &navn[n + 1..];
        (!rest.is_empty()).then_some((&navn[..=n], rest, true))
    } else if b[n..].iter().all(u8::is_ascii_digit) {
        Some((&navn[..n], &navn[n..], false))
    } else {
        None
    }
}

/// Forslag til navnemønstre ud fra tekstens maskinnavne (se modulet). `fund` er [`crate::analyser`]s fund i `tekst`.
/// Sorteret efter flest navne, derefter mønsteret.
pub fn foreslaa_moenstre(tekst: &str, fund: &[Fund], ordbog: &Ordbog) -> Vec<MoensterForslag> {
    let kendte = ordbogens_moenstre(ordbog);
    let mut navne: BTreeSet<String> = BTreeSet::new();
    for f in fund {
        if f.art != Art::Vaert || matches!(f.sikkerhed, Sikkerhed::TjekSelv | Sikkerhed::Version) {
            continue;
        }
        let Some(n) = tekst.get(f.start..f.slut) else { continue };
        let b = n.as_bytes();
        if !b.iter().all(|c| c.is_ascii_alphanumeric() || *c == b'-') || !b.iter().any(u8::is_ascii_digit) {
            continue;
        }
        let l = n.to_ascii_lowercase();
        if kendte.as_ref().is_some_and(|k| k.is_match(&l)) {
            continue;
        }
        navne.insert(l);
    }
    let mut grupper: BTreeMap<(String, bool), Vec<String>> = BTreeMap::new();
    for n in &navne {
        if let Some((p, rest, bindestreg)) = del(n) {
            grupper.entry((p.to_string(), bindestreg)).or_default().push(rest.to_string());
        }
    }
    let mut ud: Vec<MoensterForslag> = Vec::new();
    for ((praefiks, bindestreg), rester) in grupper {
        let ord = praefiks.trim_end_matches('-');
        if rester.len() < 2 || STOPORD.contains(&ord) {
            continue;
        }
        let cifre = rester.iter().all(|r| r.bytes().all(|c| c.is_ascii_digit()));
        let laengde = rester[0].len();
        let moenster = if cifre && rester.iter().all(|r| r.len() == laengde) {
            format!("{praefiks}{}", "#".repeat(laengde))
        } else if bindestreg {
            format!("{praefiks}*")
        } else {
            continue;
        };
        ud.push(MoensterForslag {
            moenster,
            navne: rester.len(),
        });
    }
    ud.sort_by(|a, b| b.navne.cmp(&a.navne).then_with(|| a.moenster.cmp(&b.moenster)));
    ud.truncate(MAKS_FORSLAG);
    ud
}
