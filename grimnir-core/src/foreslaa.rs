//! Forslag til erstatninger og maskering ved spænd (K3, K4).

use crate::graense::efter_procent;
use crate::net::{find_ipv4, laes_ipv4, laes_ipv6, laes_mac};
use crate::original::Original;
use crate::sag::{Sag, Valg, FORM_ALENE, FORM_DEL, FORM_ESC2, FORM_PROCENT};
use crate::typer::{Art, Erstatning, Fund, Klasse, Sammensat, Sikkerhed};

/// Sand, hvis fundet foreslås maskeret med sagens valg.
pub(crate) fn skal_maskeres(f: &Fund, valg: &Valg) -> bool {
    match f.sikkerhed {
        Sikkerhed::Version | Sikkerhed::TjekSelv => false,
        _ => !matches!(f.art, Art::Ipv4Fremmed | Art::Ipv6Fremmed) || valg.masker_fremmede,
    }
}

fn former(t: &[u8], f: &Fund) -> u8 {
    let del = match f.art {
        Art::Vaert => f.del_af == Some(Sammensat::Fqdn) && !f.afledt,
        Art::Domaene => matches!(f.del_af, Some(Sammensat::Fqdn | Sammensat::Mail)) && !f.afledt,
        _ => false,
    };
    let mut b = if del { FORM_DEL } else { FORM_ALENE };
    if f.art == Art::NetbiosDomaene && t[f.slut..].starts_with(b"\\\\") {
        b |= FORM_ESC2;
    }
    if efter_procent(t, f.start) {
        b |= FORM_PROCENT;
    }
    b
}

/// Koden for en værdi af en given art.
fn kode(sag: &mut Sag, art: Art, original: &str, former: u8) -> String {
    match art {
        Art::Ipv4Egen => sag.kode_ipv4(original, true, former),
        Art::Ipv4Fremmed => sag.kode_ipv4(original, false, former),
        Art::Ipv6Egen | Art::Ipv6Fremmed => sag.kode_ipv6(original, former),
        Art::Mac => sag.kode_mac(original, former),
        Art::Sid => sag.kode_sid(original, former),
        Art::LignerKode => {
            let b = original.as_bytes();
            if laes_ipv4(b).is_some() {
                sag.kode_ipv4(original, false, former)
            } else if laes_mac(b).is_some() {
                sag.kode_mac(original, former)
            } else if laes_ipv6(b).is_some() {
                sag.kode_ipv6(original, former)
            } else {
                sag.kode_navn(Klasse::Ord, original, former)
            }
        }
        _ => sag.kode_navn(art.klasse(), original, former),
    }
}

/// Foreslår erstatninger for fundene og gemmer dem i sagen. Samme original får samme kode i samme sag.
///
/// Først reserveres alt i teksten, der har en kodes form (kontrol 8.1). Bagefter maskeres enhver
/// forekomst af en af sagens eksisterende koder, som står urørt i teksten, så demaskeringen aldrig
/// kan sætte en forkert original ind.
pub fn foreslaa(fund: &[Fund], tekst: &str, sag: &mut Sag) -> Vec<Erstatning> {
    let t = tekst.as_bytes();
    sag.reserver(t);
    let valg = sag.valg();
    let mut ud: Vec<Erstatning> = Vec::new();
    let mut fund: Vec<&Fund> = fund
        .iter()
        .filter(|f| f.start < f.slut && f.slut <= t.len() && skal_maskeres(f, &valg))
        .collect();
    fund.sort_by_key(|f| (f.start, f.slut));
    let mut slut = 0;
    for f in fund {
        if f.start < slut || !tekst.is_char_boundary(f.start) || !tekst.is_char_boundary(f.slut) {
            continue;
        }
        let original = &tekst[f.start..f.slut];
        let k = kode(sag, f.art, original, former(t, f));
        ud.push(Erstatning {
            start: f.start,
            slut: f.slut,
            kode: k,
            original: Original::ny(original),
            art: f.art,
        });
        slut = f.slut;
    }

    // Kollisioner: sagens koder og adresser i sagens mål-net, der står urørt i teksten.
    let mut urort: Vec<(usize, usize)> = sag.find_koder(t).into_iter().map(|(s, e, _)| (s, e)).collect();
    find_ipv4(t, |s, e, ip, foer_ok| {
        if foer_ok && sag.maal4_i_brug(ip.verdi >> 8) {
            urort.push((s, e));
        }
    });
    urort.sort_unstable();
    urort.dedup();
    let mut nye = Vec::new();
    for (s, e) in urort {
        let i = ud.partition_point(|x| x.slut <= s);
        if ud.get(i).is_some_and(|x| x.start < e) || nye.iter().any(|x: &Erstatning| x.start < e && s < x.slut) {
            continue;
        }
        let original = &tekst[s..e];
        let f = Fund {
            start: s,
            slut: e,
            art: Art::LignerKode,
            sikkerhed: Sikkerhed::Sikker,
            del_af: None,
            afledt: false,
        };
        let k = kode(sag, Art::LignerKode, original, former(t, &f));
        nye.push(Erstatning {
            start: s,
            slut: e,
            kode: k,
            original: Original::ny(original),
            art: Art::LignerKode,
        });
    }
    ud.extend(nye);
    ud.sort_by_key(|e| e.start);
    ud
}

/// Erstatter spændene i ét gennemløb. Ingen gentagen søg og erstat.
///
/// # Panics
/// Hvis en erstatning overlapper en anden, ligger uden for teksten eller ikke passer til teksten.
/// Panikbeskeden indeholder kun positioner, aldrig en original.
pub fn masker(tekst: &str, erstatninger: &[Erstatning]) -> String {
    let mut liste: Vec<&Erstatning> = erstatninger.iter().collect();
    liste.sort_by_key(|e| (e.start, e.slut));
    let mut ud = String::with_capacity(tekst.len() + tekst.len() / 8);
    let mut pos = 0;
    for (i, e) in liste.iter().enumerate() {
        let gyldig = e.start >= pos
            && e.start < e.slut
            && e.slut <= tekst.len()
            && tekst.is_char_boundary(e.start)
            && tekst.is_char_boundary(e.slut)
            && tekst.as_bytes()[e.start..e.slut] == *e.original.som_tekst().as_bytes();
        assert!(
            gyldig,
            "erstatning nr. {i} (byte {}..{}) overlapper, ligger uden for teksten eller passer ikke til teksten",
            e.start, e.slut
        );
        ud.push_str(&tekst[pos..e.start]);
        ud.push_str(&e.kode);
        pos = e.slut;
    }
    ud.push_str(&tekst[pos..]);
    ud
}
