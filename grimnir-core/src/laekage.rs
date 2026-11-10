//! Lækagetjek (K4): søger det maskerede resultat for sagens originaler og kører genkenderne igen.

use aho_corasick::{AhoCorasick, MatchKind};

use crate::analyse::analyser;
use crate::foreslaa::skal_maskeres;
use crate::graense::ved_graense;
use crate::ordbog::Ordbog;
use crate::sag::Sag;
use crate::typer::{Rest, RestArt};

/// Finder alt i det maskerede resultat, der ikke er en af sagens koder, men burde være maskeret.
pub fn laekagetjek(maskeret: &str, sag: &Sag, ordbog: &Ordbog) -> Vec<Rest> {
    let t = maskeret.as_bytes();
    let mut rester = Vec::new();

    // 1. Sagens originaler, uafhængigt af store/små bogstaver
    let poster = sag.poster();
    if !poster.is_empty() {
        let ac = AhoCorasick::builder()
            .ascii_case_insensitive(true)
            .match_kind(MatchKind::LeftmostLongest)
            .build(poster.iter().map(|p| p.original.som_tekst().as_bytes()));
        if let Ok(ac) = ac {
            for m in ac.find_iter(t) {
                let p = m.pattern().as_usize();
                let tekst = &maskeret[m.start()..m.end()];
                if poster[p].original.is_empty() || sag.opslag(tekst).is_some() {
                    continue;
                }
                if ved_graense(t, m.start(), m.end(), sag.moenster_af(p)) {
                    rester.push(Rest {
                        start: m.start(),
                        slut: m.end(),
                        art: RestArt::Original(sag.klasse_af(p)),
                    });
                }
            }
        }
    }

    // 2. Genkenderne igen: alt, der ville blive maskeret, og som ikke er en kode
    let valg = sag.valg();
    for f in analyser(maskeret, ordbog) {
        if !skal_maskeres(&f, &valg) || sag.opslag(&maskeret[f.start..f.slut]).is_some() {
            continue;
        }
        if rester.iter().any(|r: &Rest| r.start < f.slut && f.start < r.slut) {
            continue;
        }
        rester.push(Rest {
            start: f.start,
            slut: f.slut,
            art: RestArt::NytFund(f.art),
        });
    }
    rester.sort_by_key(|r| (r.start, r.slut));
    rester
}
