//! V-OPBYG.4 i kernen. Kun opdigtede værdier (`eksempel-firma.example`, `kontor.test`, opfundne navne og hemmeligheder).
//!
//! - N2: en værdi, brugeren tilføjer som hemmelighed (Maskér markering), får kernens kode for hemmeligheder
//!   (`GRIMNIR_SECRET_0001`), rundturen er bytepræcis, og lækagetjekket melder den, hvis den står tilbage.
//! - N6: advarslen om en hemmeligheds værdi, der står alene et andet sted (`pWD:443` og `:443`), er rigtig; et `\t`, `\n`,
//!   `\r` eller `\0` efter et kort ord er ikke et NetBIOS-domæne med en bruger, men `KONTOR\t.hansen` findes stadig.

mod faelles;

use faelles::kaede;
use grimnir_core::{analyser, demasker, laekagetjek, Art, Klasse, Ordbog, RestArt, Sag};

const MAIL: &str = "bo.proeve@eksempel-firma.example";

fn med_hemmelighed(v: &str) -> Ordbog {
    let mut o = Ordbog::ny();
    o.tilfoejede.push((v.to_string(), Art::Hemmelighed));
    o
}

// ─────────────────────────────────────────────────────────────── N2

#[test]
fn n2_en_tilfoejet_hemmelighed_faar_kernens_kode_og_rundturen_er_bytepraecis() {
    let t = "login ok for bo; nøglen Fjeld-Ravn-77 virker\r\nFjeld-Ravn-77 igen, fjeld-ravn-77 med små\r\n";
    let o = med_hemmelighed("Fjeld-Ravn-77");
    let f = analyser(t, &o);
    let h: Vec<_> = f.iter().filter(|x| x.art == Art::Hemmelighed).collect();
    assert_eq!(h.len(), 3, "alle steder ved en grænse, uden hensyn til store/små bogstaver");
    let mut sag = Sag::default();
    let k = kaede(t, &o, &mut sag);
    assert_eq!(k.tilbage, t, "rundturen er bytepræcis");
    assert!(!k.maskeret.to_ascii_lowercase().contains("fjeld-ravn-77"), "{}", k.maskeret);
    assert!(k.maskeret.contains("GRIMNIR_SECRET_0001"), "{}", k.maskeret);
    assert!(k.rester.is_empty());
    // Som en genkendt hemmelighed: store og små bogstaver er to enheder i klassen Hemmelighed.
    let kode = sag.kode_for_original(Klasse::Hemmelighed, "Fjeld-Ravn-77").expect("en kode");
    assert!(kode.starts_with("GRIMNIR_SECRET_"), "{kode}");
    assert!(sag.kode_for_original(Klasse::Hemmelighed, "fjeld-ravn-77").is_some());
    assert_eq!(demasker(&k.maskeret, &sag).0, t);
}

#[test]
fn n2_laekagetjekket_melder_en_tilfoejet_hemmelighed_der_staar_tilbage() {
    let t = "nøglen Fjeld-Ravn-77 virker\n";
    let o = med_hemmelighed("Fjeld-Ravn-77");
    let mut sag = Sag::default();
    let k = kaede(t, &o, &mut sag);
    assert!(k.rester.is_empty());
    // En tekst, hvor værdien står i klartekst (fx sat ind efter maskeringen): resten er en original af klassen Hemmelighed.
    let ny = format!("{} og igen Fjeld-Ravn-77\n", k.maskeret.trim_end());
    let r = laekagetjek(&ny, &sag, &Ordbog::ny());
    assert_eq!(r.len(), 1, "{r:?}");
    assert_eq!(r[0].art, RestArt::Original(Klasse::Hemmelighed));
    assert_eq!(&ny[r[0].start..r[0].slut], "Fjeld-Ravn-77");
}

#[test]
fn n2_maskér_aldrig_vinder_ogsaa_over_en_tilfoejet_hemmelighed() {
    let mut o = med_hemmelighed("Fjeld-Ravn-77");
    o.aldrig.push("fjeld-ravn-77".into());
    assert!(analyser("nøglen Fjeld-Ravn-77\n", &o).iter().all(|f| f.art != Art::Hemmelighed));
}

// ─────────────────────────────────────────────────────────────── N6

/// Jans svar 1: advarslen er rigtig. `pWD:443` gør "443" til en adgangskode (`pwd` er et nøgleord), og når `:443` står et
/// andet sted, står hemmelighedens værdi i klartekst: lækagetjekket melder den som rest.
#[test]
fn n6_en_hemmeligheds_vaerdi_alene_et_andet_sted_giver_en_rest() {
    let t = format!("{MAIL}\npWD:443 \nsrv-db02.eksempel-firma.example:443 \n");
    let o = Ordbog::ny();
    let mut sag = Sag::default();
    let k = kaede(&t, &o, &mut sag);
    assert_eq!(k.tilbage, t);
    let rester: Vec<(&str, RestArt)> = k.rester.iter().map(|r| (&k.maskeret[r.start..r.slut], r.art)).collect();
    assert_eq!(rester, [("443", RestArt::Original(Klasse::Hemmelighed))], "{}", k.maskeret);
}

#[test]
fn n6_et_escape_paa_et_bogstav_er_ikke_en_bruger() {
    let o = Ordbog::ny();
    for t in ["echo A0\\t x\n", "echo A0\\n x\n", "echo KONTOR\\r\n", "printf AB\\0 ok\n", "A0\\t"] {
        let f = analyser(t, &o);
        assert!(
            f.iter().all(|x| !matches!(x.art, Art::NetbiosDomaene | Art::Bruger)),
            "{t:?}: {:?}",
            f.iter().map(|x| (&t[x.start..x.slut], x.art)).collect::<Vec<_>>()
        );
    }
}

#[test]
fn n6_rigtige_netbios_fund_findes_stadig() {
    let o = Ordbog::ny();
    for (t, nb, bruger) in [
        ("logon KONTOR\\t.hansen ok\n", "KONTOR", "t.hansen"),
        ("logon KONTOR\\tina ok\n", "KONTOR", "tina"),
        ("logon KONTOR\\p ok\n", "KONTOR", "p"),
        ("logon KONTOR\\\\t ok\n", "KONTOR", "t"),
        ("logon KONTOR\\T ok\n", "KONTOR", "T"),
    ] {
        let f = analyser(t, &o);
        let tekst: Vec<(&str, Art)> = f.iter().map(|x| (&t[x.start..x.slut], x.art)).collect();
        assert!(tekst.contains(&(nb, Art::NetbiosDomaene)), "{t:?}: {tekst:?}");
        assert!(tekst.contains(&(bruger, Art::Bruger)), "{t:?}: {tekst:?}");
    }
}
