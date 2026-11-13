//! M2: kommandoerne uden vindue (tilstand ind, svar ud). Kun opdigtede værdier: RFC 1918 og RFC 6598-adresser,
//! opfundne navne og hemmeligheder.

use grimnir_lib::maskering::{
    analyser, demasker, gem_og_masker, raekke_vaerdi, sag_nulstil, sag_status, Analyse, Raekke, Rettelse, Tilstand, UiFejl, MAKS_BYTES,
    MAKS_DEMASKER,
};

/// En opdigtet log med CRLF (Windows), en bruger i to stavemåder, en version, der ligner en adresse, og to hemmeligheder.
const TEKST: &str = "date=2026-11-10 time=10:00:01 devname=\"FW-KONTOR01\" srcip=10.20.30.11 dstip=100.99.4.7 user=\"bruger060\"\r\n\
Server=srv-068;Database=Kunde_DB;User Id=app;Password=Sommer2026!;\r\n\
msg=\"tunnel up\" version 10.2.3.4 token=Zq8Xv2Lm9Pw4Rt7Yk3Nb6Hc1Jd5Fg0Qs\r\n\
user=\"BRUGER060\" fra 10.20.30.11\r\n";

const HEMMELIG: &str = "Sommer2026!";

fn raekke<'a>(a: &'a Analyse, vaerdi: &str) -> &'a Raekke {
    a.raekker
        .iter()
        .find(|r| r.vaerdier.iter().any(|v| v == vaerdi))
        .unwrap_or_else(|| panic!("ingen række for testværdien {vaerdi}"))
}

/// V-OPBYG.4 N1: en hemmeligheds række. Dens værdi står ikke i analysens svar; den hentes som ved Vis (`raekke_vaerdi`).
fn hemmelig_raekke<'a>(t: &Tilstand, a: &'a Analyse, vaerdi: &str) -> &'a Raekke {
    a.raekker
        .iter()
        .filter(|r| r.hemmelig)
        .find(|r| raekke_vaerdi(t, false, r.id).is_ok_and(|v| v.vaerdier.iter().any(|x| x == vaerdi)))
        .unwrap_or_else(|| panic!("ingen hemmelighed med testværdien"))
}

/// Det, UI'et sender: alle rækker, der ikke er valgt.
fn fravalgt(a: &Analyse) -> Vec<usize> {
    a.raekker.iter().filter(|r| !r.valgt).map(|r| r.id).collect()
}

#[test]
fn rundtur_med_crlf_er_bytepraecis() {
    let t = Tilstand::ny();
    let a = analyser(&t, TEKST, None, &[]).unwrap();
    assert_eq!(sag_status(&t).unwrap().poster, 0, "analyser ændrer ikke sagen");
    let m = gem_og_masker(&t, TEKST, &fravalgt(&a), &[]).unwrap();
    assert_eq!(m.maskeret.matches("\r\n").count(), 4, "CRLF bevaret i det maskerede");
    assert!(!m.maskeret.contains("10.20.30.11") && !m.maskeret.contains(HEMMELIG) && !m.maskeret.contains("bruger060"));
    assert!(m.poster > 0 && sag_status(&t).unwrap().poster == m.poster);
    let d = demasker(&t, &m.maskeret).unwrap();
    assert_eq!(d.tekst.as_bytes(), TEKST.as_bytes(), "rundturen er bytepræcis");
    assert_eq!(d.koder.len(), m.poster, "alle sagens koder er brugt");
    assert!(d.koder.iter().all(|k| m.maskeret.contains(k.as_str())));
    // Anden gang er rækkerne kendt fra sagen.
    let a2 = analyser(&t, TEKST, None, &[]).unwrap();
    assert!(a.raekker.iter().all(|r| !r.kendt));
    assert!(a2.raekker.iter().filter(|r| r.valgt).all(|r| r.kendt));
}

#[test]
fn tabellens_koder_er_de_gemte_koder() {
    let t = Tilstand::ny();
    let a = analyser(&t, TEKST, None, &[]).unwrap();
    let m = gem_og_masker(&t, TEKST, &fravalgt(&a), &[]).unwrap();
    for r in a.raekker.iter().filter(|r| r.valgt) {
        for k in &r.koder {
            assert!(m.maskeret.contains(k.as_str()), "koden {k} fra tabellen står i resultatet");
        }
    }
    // Samme tekst igen: samme koder (sagen husker dem).
    let a2 = analyser(&t, TEKST, None, &[]).unwrap();
    let m2 = gem_og_masker(&t, TEKST, &fravalgt(&a2), &[]).unwrap();
    assert_eq!(m.maskeret, m2.maskeret);
}

#[test]
fn en_raekke_pr_enhed_og_standardvalg() {
    let t = Tilstand::ny();
    let a = analyser(&t, TEKST, None, &[]).unwrap();
    let b = raekke(&a, "bruger060");
    assert_eq!(b.vaerdier, ["bruger060", "BRUGER060"], "to stavemåder, én række");
    assert_eq!(b.antal, 2);
    assert_eq!(raekke(&a, "10.20.30.11").antal, 2, "én række pr. enhed, ikke pr. forekomst");
    let v = raekke(&a, "10.2.3.4");
    assert_eq!((v.status, v.standard, v.valgt), ("version", false, false), "Version er slået fra");
    let f = raekke(&a, "100.99.4.7");
    assert_eq!(
        (f.art, f.standard, f.valgt),
        ("ipv4_fremmed", false, false),
        "fremmed adresse er slået fra (D4)"
    );
    assert!(hemmelig_raekke(&t, &a, HEMMELIG).hemmelig && hemmelig_raekke(&t, &a, HEMMELIG).valgt);
    assert!(!v.koder[0].is_empty(), "en fravalgt række har et forslag");
    let ider: Vec<usize> = a.raekker.iter().map(|r| r.id).collect();
    let mut sorteret = ider.clone();
    sorteret.sort_unstable();
    assert_eq!(ider, sorteret, "rækkerne står efter første forekomst");
    assert_eq!(a.linjer, 4);
    assert_eq!(raekke(&a, "BRUGER060").linje, 1);
}

#[test]
fn version_og_fremmed_kan_slaas_til() {
    let t = Tilstand::ny();
    let m = gem_og_masker(&t, TEKST, &[], &[]).unwrap();
    assert!(!m.maskeret.contains("10.2.3.4") && !m.maskeret.contains("100.99.4.7"));
    assert_eq!(demasker(&t, &m.maskeret).unwrap().tekst, TEKST);
}

#[test]
fn fravalg_maskeres_ikke_og_er_ikke_en_rest() {
    let t = Tilstand::ny();
    let a = analyser(&t, TEKST, None, &[]).unwrap();
    let h = hemmelig_raekke(&t, &a, HEMMELIG).id;
    let mut fra = fravalgt(&a);
    fra.push(h);
    let a2 = analyser(&t, TEKST, Some(&fra), &[]).unwrap();
    assert!(!hemmelig_raekke(&t, &a2, HEMMELIG).valgt);
    let m = gem_og_masker(&t, TEKST, &fra, &[]).unwrap();
    assert!(m.maskeret.contains(HEMMELIG), "fravalgt: står urørt");
    assert!(
        m.rester.iter().all(|r| !r.tekst.contains(HEMMELIG)),
        "brugerens fravalg er ikke en rest"
    );
    // Svaret uden selve resultatet nævner ikke den fravalgte hemmelighed.
    let mut json = serde_json::to_value(&m).unwrap();
    json.as_object_mut().unwrap().remove("maskeret");
    assert!(!json.to_string().contains(HEMMELIG));
    // Sagen kender den ikke: en senere tekst med værdien alene får den ikke maskeret via sagen (F1).
    let senere = format!("kodeordet var {HEMMELIG} i går\r\n");
    let m2 = gem_og_masker(&t, &senere, &[], &[]).unwrap();
    assert!(m2.maskeret.contains(HEMMELIG));
    assert_eq!(demasker(&t, &m.maskeret).unwrap().tekst, TEKST);
}

#[test]
fn rettelse_bruges_og_demaskeres() {
    let t = Tilstand::ny();
    let a = analyser(&t, TEKST, None, &[]).unwrap();
    let r = raekke(&a, "Kunde_DB");
    let ret = [Rettelse {
        id: r.id,
        kode: "kundebase01".into(),
    }];
    let a2 = analyser(&t, TEKST, Some(&fravalgt(&a)), &ret).unwrap();
    assert!(a2.fejl.is_empty());
    let r2 = raekke(&a2, "Kunde_DB");
    assert_eq!((r2.koder[0].as_str(), r2.rettet), ("kundebase01", true));
    assert_eq!(sag_status(&t).unwrap().poster, 0, "en rettelse i analysen ændrer ikke sagen");
    let m = gem_og_masker(&t, TEKST, &fravalgt(&a), &ret).unwrap();
    assert!(m.maskeret.contains("Database=kundebase01;"));
    assert_eq!(demasker(&t, &m.maskeret).unwrap().tekst, TEKST);
}

#[test]
fn afvist_rettelse_kommer_tilbage_paa_raekken_og_intet_gemmes() {
    let t = Tilstand::ny();
    let a = analyser(&t, TEKST, None, &[]).unwrap();
    let db = raekke(&a, "Kunde_DB").id;
    let fw = raekke(&a, "FW-KONTOR01").id;
    // "tunnel" står i teksten; to rækker kan ikke få samme kode.
    let ret = [
        Rettelse {
            id: db,
            kode: "tunnel".into(),
        },
        Rettelse { id: fw, kode: "-x".into() },
    ];
    let f = gem_og_masker(&t, TEKST, &fravalgt(&a), &ret).unwrap_err();
    let UiFejl::Raekker { fejl } = &f else {
        panic!("forventede rækkefejl")
    };
    assert_eq!(fejl.len(), 2);
    assert_eq!((fejl[0].id, fejl[0].fejl, fejl[0].kode.as_str()), (db, "kollision", "tunnel"));
    assert_eq!((fejl[1].id, fejl[1].fejl), (fw, "ugyldig"));
    assert_eq!(sag_status(&t).unwrap().poster, 0, "intet gemt");
    // To rækker med samme kode: den anden kolliderer.
    let to = [
        Rettelse {
            id: db,
            kode: "faelles01".into(),
        },
        Rettelse {
            id: fw,
            kode: "faelles01".into(),
        },
    ];
    let a2 = analyser(&t, TEKST, Some(&fravalgt(&a)), &to).unwrap();
    assert_eq!(a2.fejl.len(), 1);
    assert_eq!((a2.fejl[0].id, a2.fejl[0].fejl), (fw, "kollision"));
    // V-SAG.1: en række med flere stavemåder omdøbes samlet og spejler store/små (kernens `ret_enhed`, fund 3 i
    // V-SKAL.2). Før blev den afvist med `flere_stavemaader`.
    let b = raekke(&a, "bruger060").id;
    let a3 = analyser(
        &t,
        TEKST,
        None,
        &[Rettelse {
            id: b,
            kode: "kunde7".into(),
        }],
    )
    .unwrap();
    assert!(a3.fejl.is_empty(), "{:?}", a3.fejl);
    assert_eq!(a3.raekker.iter().find(|r| r.id == b).unwrap().koder, ["kunde7", "KUNDE7"]);
    // Fejlene nævner ingen original.
    let json = serde_json::to_string(&f).unwrap() + &serde_json::to_string(&a2.fejl).unwrap();
    for o in ["Kunde_DB", "FW-KONTOR01", HEMMELIG, "bruger060"] {
        assert!(!json.contains(o));
    }
}

#[test]
fn nulstil_toemmer_sagen() {
    let t = Tilstand::ny();
    let a = analyser(&t, TEKST, None, &[]).unwrap();
    let m = gem_og_masker(&t, TEKST, &fravalgt(&a), &[]).unwrap();
    assert!(sag_status(&t).unwrap().poster > 0);
    assert_eq!(sag_nulstil(&t).unwrap().poster, 0);
    let d = demasker(&t, &m.maskeret).unwrap();
    assert_eq!(d.tekst, m.maskeret, "en tom sag sætter intet tilbage");
}

#[test]
fn intet_svar_naevner_en_hemmelighed_ud_over_visningen() {
    let t = Tilstand::ny();
    let a = analyser(&t, TEKST, None, &[]).unwrap();
    let m = gem_og_masker(&t, TEKST, &fravalgt(&a), &[]).unwrap();
    let json = serde_json::to_string(&m).unwrap();
    for o in [HEMMELIG, "Zq8Xv2Lm9Pw4Rt7Yk3Nb6Hc1Jd5Fg0Qs", "10.20.30.11", "bruger060"] {
        assert!(!json.contains(o), "gem_og_masker-svaret nævner ikke en maskeret original");
    }
    // Demaskeringens advarsler nævner kun koder, aldrig originaler.
    let svar = format!("{}\r\nprøv også h0099 og user0042\r\n", m.maskeret);
    let d = demasker(&t, &svar).unwrap();
    let adv = serde_json::to_string(&d.advarsler).unwrap();
    assert!(d.advarsler.iter().any(|x| x.art == "ukendt_kode"));
    for o in [HEMMELIG, "10.20.30.11", "bruger060", "Kunde_DB"] {
        assert!(!adv.contains(o));
    }
}

#[test]
fn for_stor_og_tom_tekst_afvises() {
    let t = Tilstand::ny();
    let stor = "x".repeat(MAKS_BYTES + 1);
    assert!(matches!(analyser(&t, &stor, None, &[]), Err(UiFejl::ForStor { .. })));
    assert!(matches!(gem_og_masker(&t, &stor, &[], &[]), Err(UiFejl::ForStor { .. })));
    // V-SAG.1: Demaskér tager op til 8 MiB (fund 1 i V-SKAL.2); grænsen for Maskér er stadig 5 MiB.
    assert!(demasker(&t, &stor).is_ok());
    assert!(matches!(demasker(&t, &"x".repeat(MAKS_DEMASKER + 1)), Err(UiFejl::ForStor { .. })));
    assert_eq!(analyser(&t, "", None, &[]).unwrap_err(), UiFejl::TomTekst);
}

#[test]
fn ukendt_raekke_i_rettelse() {
    let t = Tilstand::ny();
    let a = analyser(&t, TEKST, None, &[Rettelse { id: 3, kode: "x1".into() }]).unwrap();
    assert_eq!(a.fejl[0].fejl, "ukendt_raekke");
}
