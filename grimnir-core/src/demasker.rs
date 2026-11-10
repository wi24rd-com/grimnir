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

/// Sætter originalerne tilbage for alle sagens koder i teksten og melder alt, der ser forkert ud.
pub fn demasker(tekst: &str, sag: &Sag) -> (String, Vec<Advarsel>) {
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
        let forrige = i.checked_sub(1).and_then(|j| traef.get(j)).filter(|f| f.1 + 1 == s);
        let alene = match klasse {
            Klasse::Vaert => !(t.get(e) == Some(&b'.') && naeste.is_some_and(|n| sag.klasse_af(n.2) == Klasse::Domaene)),
            Klasse::Domaene => !forrige.is_some_and(|f| {
                (t[s - 1] == b'.' && sag.klasse_af(f.2) == Klasse::Vaert) || (t[s - 1] == b'@' && sag.klasse_af(f.2) == Klasse::Bruger)
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

    // Kodeformer, der ikke er sagens koder
    let mut ekstra: Vec<(usize, usize, String)> = Vec::new();
    let mut ukendte = 0usize;
    find_kodeformer(t, |s, e, form| {
        let j = traef.partition_point(|x| x.1 <= s);
        if traef.get(j).is_some_and(|x| x.0 < e) {
            return;
        }
        let kode = String::from_utf8_lossy(&t[s..e]).into_owned();
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
                if sag.maal6_kendt((v >> 64) as u64) {
                    advarsler.push(advarsel(AdvarselArt::UkendtAdresseISagensNet, s, e, &kode, None));
                    ukendte += 1;
                }
            }
            Kodeform::Mac(_) => {}
            Kodeform::Navn(_) if sag.reserveret_navn(&kode) => {}
            Kodeform::Navn(_) => match sag.kode_smaa(&kode) {
                Some(p) => {
                    let o = sag.post(p).original.som_tekst();
                    let kb = kode.as_bytes();
                    let ny = if !kb.iter().any(u8::is_ascii_lowercase) {
                        o.to_ascii_uppercase()
                    } else if !kb.iter().any(u8::is_ascii_uppercase) {
                        o.to_ascii_lowercase()
                    } else {
                        o.to_string()
                    };
                    brugt[p] = true;
                    advarsler.push(advarsel(AdvarselArt::AfledtForm(AfledtArt::AndenStavemaade), s, e, &kode, None));
                    ekstra.push((s, e, ny));
                }
                None => {
                    advarsler.push(advarsel(AdvarselArt::UkendtKode, s, e, &kode, None));
                    ukendte += 1;
                }
            },
        }
    });

    if ukendte >= ANDEN_SAG && ukendte > traef.len() {
        advarsler.push(advarsel(AdvarselArt::LignerAndenSag, 0, 0, "", None));
    }
    for (p, b) in brugt.iter().enumerate() {
        if !b {
            advarsler.push(advarsel(AdvarselArt::IkkeBrugt, 0, 0, &sag.post(p).kode, None));
        }
    }

    // Byg resultatet i ét gennemløb
    let mut alle: Vec<(usize, usize, &str)> = traef.iter().map(|&(s, e, p)| (s, e, sag.post(p).original.som_tekst())).collect();
    alle.extend(ekstra.iter().map(|(s, e, o)| (*s, *e, o.as_str())));
    alle.sort_by_key(|x| x.0);
    let mut ud = String::with_capacity(tekst.len());
    let mut pos = 0;
    for (s, e, o) in alle {
        if s < pos {
            continue;
        }
        ud.push_str(&tekst[pos..s]);
        ud.push_str(o);
        pos = e;
    }
    ud.push_str(&tekst[pos..]);
    advarsler.sort_by_key(|a| (a.start, a.slut));
    (ud, advarsler)
}
