//! Lækagetjek (K4): søger det maskerede resultat for sagens originaler og kører genkenderne igen.

use aho_corasick::{AhoCorasick, MatchKind};

use crate::analyse::analyser;
use crate::foreslaa::skal_maskeres;
use crate::graense::ved_graense;
use crate::kodeform::find_navnekoder;
use crate::ordbog::Ordbog;
use crate::sag::Sag;
use crate::typer::{Art, Klasse, Rest, RestArt};

/// Finder alt i det maskerede resultat, der ikke er en af sagens koder, men burde være maskeret.
///
/// V-MANUEL.2 N4: en rest meldes kun uden for sagens koder. Et ord, der også står i en kodes skabelon (`example` i
/// `d01.example`, `user` i `user0001`), er ikke en original, der står tilbage, når det står inde i en af sagens koder:
/// demaskeringen erstatter hele koden. Koderne findes med samme søgning som demaskeringen ([`Sag::find_koder`]: koder og
/// aliaser ved grænser).
pub fn laekagetjek(maskeret: &str, sag: &Sag, ordbog: &Ordbog) -> Vec<Rest> {
    let t = maskeret.as_bytes();
    let opslag = ordbog.opslag();
    let mut rester = Vec::new();
    let koder = sag.find_koder(t);
    // Sand, hvis spændet ligger helt inde i en af sagens koder (koderne er sorteret og overlapper ikke).
    let i_kode = |s: usize, e: usize| {
        let i = koder.partition_point(|k| k.1 <= s);
        koder.get(i).is_some_and(|k| k.0 <= s && e <= k.1)
    };

    // 1. Sagens originaler, uafhængigt af store/små bogstaver.
    //
    // V-OPBYG.3 N1: en original på ét tegn søges ikke som ord alene. Et enkelt bogstav eller ciffer står alene overalt i
    // en tekst og kan ikke skelnes fra den; analysen søger heller ikke efter det andre steder (afledte former først fra tre
    // tegn), så det blev meldt som rest i samme tekst, det blev maskeret i (`p` fra `A0\p` gav resten "P" i `P A0\p`;
    // V-OPBYG.2, sideeffekt-fund 1). To tegn og mere meldes som før (V-KERNE.2: "sa" og "2024" er rester, så brugeren selv
    // kan afgøre det). Står originalen i sin sammenhæng (`KONTOR\p`), finder genkenderne den igen (trin 2).
    let poster = sag.poster();
    let soeges: Vec<usize> = (0..poster.len())
        .filter(|&i| poster[i].original.som_tekst().chars().nth(1).is_some())
        .collect();
    if !soeges.is_empty() {
        let ac = AhoCorasick::builder()
            .ascii_case_insensitive(true)
            .match_kind(MatchKind::LeftmostLongest)
            .build(soeges.iter().map(|&i| poster[i].original.som_tekst().as_bytes()));
        if let Ok(ac) = ac {
            for m in ac.find_iter(t) {
                let p = soeges[m.pattern().as_usize()];
                let tekst = &maskeret[m.start()..m.end()];
                if poster[p].original.is_empty()
                    || sag.opslag(tekst).is_some()
                    || opslag.aldrig_tekst(tekst.as_bytes())
                    || i_kode(m.start(), m.end())
                {
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
    //
    // V-OPBYG.5 N1: et fund, der dækker flere af sagens koder (`Db= h0001.d01.example`: et nøgleord gør hele FQDN'et til
    // en database, men det er en værtskode og en domænekode), er kun en rest for de dele, der ikke er koder. Består det
    // kun af koder og skilletegn, er der ingen rest; står der noget andet (`h0001.prod7`), meldes netop den del.
    let valg = sag.valg();
    for f in analyser(maskeret, ordbog) {
        if !skal_maskeres(&f, &valg) || sag.opslag(&maskeret[f.start..f.slut]).is_some() || i_kode(f.start, f.slut) {
            continue;
        }
        for (s, e) in uden_for_koder(t, f.start, f.slut, &koder) {
            if rester.iter().any(|r: &Rest| r.start < e && s < r.slut) {
                continue;
            }
            rester.push(Rest {
                start: s,
                slut: e,
                art: RestArt::NytFund(f.art),
            });
        }
    }
    // 3. V-MANUEL.2 N2: maskindelen af et FQDN, hvor domænet er en af sagens koder (`srv-db02.intern.d01.example`): hvert
    // led foran domænekoden, der ikke selv er en kode, er en rest (første led en maskine, de andre en del af domænet). En
    // variabel foran (`$pc.d01.example`) er ikke et navn.
    for &(s, _, p) in &koder {
        if sag.klasse_af(p) != Klasse::Domaene || s < 2 || t[s - 1] != b'.' {
            continue;
        }
        let mut ls = s - 1;
        while ls > 0 && (t[ls - 1].is_ascii_alphanumeric() || matches!(t[ls - 1], b'-' | b'.')) {
            ls -= 1;
        }
        if ls > 0 && matches!(t[ls - 1], b'$' | b'%' | b'@') {
            continue;
        }
        let mut pos = ls;
        let mut foerste = true;
        for led in t[ls..s - 1].split(|b| *b == b'.') {
            let (a, b) = (pos, pos + led.len());
            pos = b + 1;
            let er_foerste = std::mem::replace(&mut foerste, false);
            if led.is_empty() || !led.iter().any(u8::is_ascii_alphanumeric) {
                continue;
            }
            let tekst = &maskeret[a..b];
            // En kode (også en, sagen ikke kender: den har en kodes form og er "ligner en kode", ikke en rest).
            let mut kodeform = false;
            find_navnekoder(led, |a, b, _| kodeform |= a == 0 && b == led.len());
            if sag.opslag(tekst).is_some() || sag.kode_smaa(tekst).is_some() || kodeform || opslag.aldrig_tekst(led) {
                continue;
            }
            if rester.iter().any(|r: &Rest| r.start < b && a < r.slut) {
                continue;
            }
            rester.push(Rest {
                start: a,
                slut: b,
                art: RestArt::NytFund(if er_foerste { Art::Vaert } else { Art::Domaene }),
            });
        }
    }
    rester.sort_by_key(|r| (r.start, r.slut));
    rester
}

/// V-OPBYG.5 N1: delene af spændet `s..e`, der ikke ligger i en af sagens koder (`koder` sorteret, uden overlap). Rører
/// spændet ingen kode, er svaret hele spændet (som før). Ellers er hver del uden kode trimmet for ASCII-skilletegn i begge
/// ender, og en del uden et bogstav, et ciffer eller et tegn uden for ASCII er ikke med.
fn uden_for_koder(t: &[u8], s: usize, e: usize, koder: &[(usize, usize, usize)]) -> Vec<(usize, usize)> {
    let foerste = koder.partition_point(|k| k.1 <= s);
    let roerte: Vec<(usize, usize)> = koder[foerste..].iter().take_while(|k| k.0 < e).map(|k| (k.0, k.1)).collect();
    if roerte.is_empty() {
        return vec![(s, e)];
    }
    let skille = |b: u8| b.is_ascii() && !b.is_ascii_alphanumeric();
    let mut ud = Vec::new();
    let mut pos = s;
    for (ks, ke) in roerte.into_iter().chain(std::iter::once((e, e))) {
        // En kode kan begynde før spændet og slutte efter det; `pos` og `ks` holdes inden for `s..=e`.
        let mut a = pos.min(e);
        let mut b = ks.min(e).max(a);
        while a < b && skille(t[a]) {
            a += 1;
        }
        while b > a && skille(t[b - 1]) {
            b -= 1;
        }
        if a < b {
            ud.push((a, b));
        }
        pos = ke.max(pos);
    }
    ud
}
