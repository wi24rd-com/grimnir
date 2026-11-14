//! Demaskering (K5): typet genkendelse af koder + opslag; aldrig blind søg og erstat.

use crate::graense::efter_procent;
use crate::kodeform::{find_kodeformer, Kodeform};
use crate::net::formater_ipv4;
use crate::original::Original;
use crate::sag::{Sag, FORM_ALENE, FORM_ESC2, FORM_PROCENT};
use crate::typer::{Advarsel, AdvarselArt, AfledtArt, Klasse};

/// Så mange ukendte koder (og flere end kendte), før teksten "ligner en anden sag".
const ANDEN_SAG: usize = 3;

fn advarsel(art: AdvarselArt, start: usize, slut: usize, kode: &str, forslag: Option<Original>) -> Advarsel {
    Advarsel {
        art,
        start,
        slut,
        kode: kode.to_string(),
        forslag,
    }
}

/// Originalen for post `p`, når koden står med andre store/små bogstaver (F4): navne og adresser får originalen i samme
/// bogstavform som koden; hemmeligheder og andre klasser uden spejling sættes tilbage bogstaveligt.
fn med_kodens_bogstaver(sag: &Sag, p: usize, kode: &str) -> String {
    let o = sag.post(p).original.som_tekst();
    let kb = kode.as_bytes();
    let spejl = sag.klasse_af(p).spejler() || matches!(sag.klasse_af(p), Klasse::Ipv6 | Klasse::Mac);
    if !spejl {
        o.to_string()
    } else if !kb.iter().any(u8::is_ascii_lowercase) {
        o.to_ascii_uppercase()
    } else if !kb.iter().any(u8::is_ascii_uppercase) {
        o.to_ascii_lowercase()
    } else {
        o.to_string()
    }
}

/// Hvor en af sagens poster blev sat tilbage (V-PUDS.1 N4): antal steder i teksten og byte-positionen for det første.
/// Kun postens nummer og tal; ingen original.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct SatTilbage {
    /// Postens nummer i [`crate::SagData::poster`].
    pub post: usize,
    /// Antal steder, hvor posten blev sat tilbage (koden, et alias eller koden med andre store/små bogstaver).
    pub antal: usize,
    /// Byte-positionen i teksten for det første sted.
    pub foerste: usize,
}

/// Sætter originalerne tilbage for alle sagens koder i teksten og melder alt, der ser forkert ud.
pub fn demasker(tekst: &str, sag: &Sag) -> (String, Vec<Advarsel>) {
    let (ud, advarsler, _) = demasker_med_steder(tekst, sag);
    (ud, advarsler)
}

/// [`demasker`], og for hver post, der blev sat tilbage, antal steder og det første ([`SatTilbage`], i postens
/// rækkefølge). Stederne tælles i samme gennemløb, der bygger resultatet, så de er præcis dem, der blev erstattet.
pub fn demasker_med_steder(tekst: &str, sag: &Sag) -> (String, Vec<Advarsel>, Vec<SatTilbage>) {
    let t = tekst.as_bytes();
    let traef = sag.find_koder(t);
    let mut advarsler = Vec::new();
    let mut brugt = vec![false; sag.antal_poster()];

    // Afledte former af kendte koder
    for (i, &(s, e, p)) in traef.iter().enumerate() {
        brugt[p] = true;
        let post = sag.post(p);
        let klasse = sag.klasse_af(p);
        let kode = &t[s..e];
        let kode = std::str::from_utf8(kode).unwrap_or_default();
        let naeste = traef.get(i + 1).filter(|n| n.0 == e + 1);
        let forrige = i.checked_sub(1).and_then(|j| traef.get(j));
        let alene = match klasse {
            Klasse::Vaert => !(t.get(e) == Some(&b'.') && naeste.is_some_and(|n| sag.klasse_af(n.2) == Klasse::Domaene)),
            Klasse::Domaene => !forrige.is_some_and(|f| {
                let k = sag.klasse_af(f.2);
                (f.1 + 1 == s && t[s - 1] == b'.' && k == Klasse::Vaert)
                    || (f.1 + 1 == s && t[s - 1] == b'@' && k == Klasse::Bruger)
                    || (f.1 + 3 == s && &t[s - 3..s] == b"%40" && k == Klasse::Bruger)
            }),
            _ => false,
        };
        if alene && post.former & FORM_ALENE == 0 {
            let art = if klasse == Klasse::Vaert {
                AfledtArt::FqdnForkortet
            } else {
                AfledtArt::DomaeneAlene
            };
            advarsler.push(advarsel(AdvarselArt::AfledtForm(art), s, e, kode, None));
        }
        if klasse == Klasse::Netbios && t[e..].starts_with(b"\\\\") && post.former & FORM_ESC2 == 0 {
            advarsler.push(advarsel(AdvarselArt::AfledtForm(AfledtArt::Escaped), s, e, kode, None));
        }
        if efter_procent(t, s) && post.former & FORM_PROCENT == 0 {
            advarsler.push(advarsel(AdvarselArt::AfledtForm(AfledtArt::UrlKodet), s, e, kode, None));
        }
    }

    // Selvvalgte koder og aliaser uden kodeform med andre store/små bogstaver (V-PUDS.2 N1). Et præcist træf vinder
    // altid; mod kodeformerne nedenfor afgøres et overlap længst til venstre, derefter længst.
    let kandidater = sag.find_selvvalgte_smaa(t, &traef);
    let mut fjernet = vec![false; kandidater.len()];

    // Kodeformer, der ikke er sagens koder
    let mut ekstra: Vec<(usize, usize, String, usize)> = Vec::new();
    let mut ukendte = 0usize;
    // En kode, hvis bogstaver er ændret efter maskeringen (F4): opslag uafhængigt af store/små.
    let mut anden_stavemaade = |s: usize, e: usize, kode: &str, advarsler: &mut Vec<Advarsel>| -> bool {
        let Some(p) = sag.kode_smaa(kode) else { return false };
        if ekstra.iter().any(|x| x.0 < e && s < x.1) {
            return true;
        }
        brugt[p] = true;
        advarsler.push(advarsel(AdvarselArt::AfledtForm(AfledtArt::AndenStavemaade), s, e, kode, None));
        ekstra.push((s, e, med_kodens_bogstaver(sag, p, kode), p));
        true
    };
    find_kodeformer(t, |s, e, form| {
        let j = traef.partition_point(|x| x.1 <= s);
        if traef.get(j).is_some_and(|x| x.0 < e) {
            return;
        }
        let kode = String::from_utf8_lossy(&t[s..e]).into_owned();
        // Overlapper spændet en selvvalgt kode med andre bogstaver (N1), vinder kodeformen kun, hvis den selv er en af
        // sagens koder med andre bogstaver og står længst til venstre (eller samme sted og længere); ellers er den udeladt.
        // Kandidaterne overlapper ikke hinanden, så de er sorteret efter både start og slut.
        let k0 = kandidater.partition_point(|x| x.1 <= s);
        let k1 = k0 + kandidater[k0..].iter().take_while(|c| c.0 < e).count();
        if (k0..k1).any(|k| !fjernet[k]) {
            let vinder = !matches!(form, Kodeform::Ipv4(_))
                && sag.kode_smaa(&kode).is_some()
                && (k0..k1)
                    .filter(|k| !fjernet[*k])
                    .all(|k| s < kandidater[k].0 || (s == kandidater[k].0 && e > kandidater[k].1));
            if !vinder {
                return;
            }
            fjernet[k0..k1].iter_mut().for_each(|f| *f = true);
        }
        // V-OPBYG.5 N2: en kode, brugeren har slettet, sættes aldrig tilbage, heller ikke som en anden stavemåde af en
        // enhed, der stadig har en (F4); den står urørt og meldes som ukendt.
        if sag.er_slettet(&kode) {
            advarsler.push(advarsel(AdvarselArt::UkendtKode, s, e, &kode, None));
            ukendte += 1;
            return;
        }
        match form {
            Kodeform::Ipv4(v) => {
                if let Some(eget) = sag.eget_net_for(v >> 8) {
                    let forslag = sag
                        .valg()
                        .bevar_sidste_oktet
                        .then(|| Original::ny(formater_ipv4((eget << 8) | (v & 0xff), None)));
                    advarsler.push(advarsel(AdvarselArt::UkendtAdresseISagensNet, s, e, &kode, forslag));
                    ukendte += 1;
                }
            }
            Kodeform::Ipv6(v) => {
                if !anden_stavemaade(s, e, &kode, &mut advarsler) && sag.maal6_kendt((v >> 64) as u64) {
                    advarsler.push(advarsel(AdvarselArt::UkendtAdresseISagensNet, s, e, &kode, None));
                    ukendte += 1;
                }
            }
            Kodeform::Mac(_) => {
                anden_stavemaade(s, e, &kode, &mut advarsler);
            }
            Kodeform::Navn(_) if sag.reserveret_navn(&kode) => {}
            Kodeform::Navn(_) => {
                if !anden_stavemaade(s, e, &kode, &mut advarsler) {
                    advarsler.push(advarsel(AdvarselArt::UkendtKode, s, e, &kode, None));
                    ukendte += 1;
                }
            }
        }
    });

    for (k, &(s, e, p)) in kandidater.iter().enumerate() {
        if fjernet[k] {
            continue;
        }
        let kode = std::str::from_utf8(&t[s..e]).unwrap_or_default();
        match p {
            Some(p) => {
                brugt[p] = true;
                advarsler.push(advarsel(AdvarselArt::AfledtForm(AfledtArt::AndenStavemaade), s, e, kode, None));
                ekstra.push((s, e, med_kodens_bogstaver(sag, p, kode), p));
            }
            // Ens bortset fra store/små for poster i flere enheder: ingen sættes tilbage, og koden står urørt.
            None => advarsler.push(advarsel(AdvarselArt::UkendtKode, s, e, kode, None)),
        }
    }

    // V-OPBYG.5 N2: en slettet kode uden kodeform (brugerens egen) står urørt og meldes som ukendt; en slettet kode med
    // kodeform er allerede meldt ovenfor (den er hverken sagens eller reserveret).
    for (s, e) in sag.find_slettede_uden_form(t) {
        let optaget = |a: usize, b: usize| a < e && s < b;
        if traef.iter().any(|x| optaget(x.0, x.1)) || ekstra.iter().any(|x| optaget(x.0, x.1)) || advarsler.iter().any(|x| optaget(x.start, x.slut)) {
            continue;
        }
        advarsler.push(advarsel(AdvarselArt::UkendtKode, s, e, std::str::from_utf8(&t[s..e]).unwrap_or_default(), None));
        ukendte += 1;
    }

    if ukendte >= ANDEN_SAG && ukendte > traef.len() {
        advarsler.push(advarsel(AdvarselArt::LignerAndenSag, 0, 0, "", None));
    }
    for (p, b) in brugt.iter().enumerate() {
        if !b {
            advarsler.push(advarsel(AdvarselArt::IkkeBrugt, 0, 0, &sag.post(p).kode, None));
        }
    }

    // Byg resultatet i ét gennemløb
    let mut alle: Vec<(usize, usize, &str, usize)> = traef.iter().map(|&(s, e, p)| (s, e, sag.post(p).original.som_tekst(), p)).collect();
    alle.extend(ekstra.iter().map(|(s, e, o, p)| (*s, *e, o.as_str(), *p)));
    alle.sort_by_key(|x| x.0);
    let mut ud = String::with_capacity(tekst.len());
    let mut pos = 0;
    let mut steder: Vec<Option<SatTilbage>> = vec![None; sag.antal_poster()];
    for (s, e, o, p) in alle {
        if s < pos {
            continue;
        }
        ud.push_str(&tekst[pos..s]);
        ud.push_str(o);
        pos = e;
        // Stederne kommer i tekstens rækkefølge; det første sted er det første, der tælles.
        let st = steder[p].get_or_insert(SatTilbage {
            post: p,
            antal: 0,
            foerste: s,
        });
        st.antal += 1;
    }
    ud.push_str(&tekst[pos..]);
    advarsler.sort_by_key(|a| (a.start, a.slut));
    (ud, advarsler, steder.into_iter().flatten().collect())
}
