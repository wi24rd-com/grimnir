//! V-SAG.1 G1: aliaser (D18), `ret_enhed`, ordbogens forberegnede opslag og `VERSION`. Kun opdigtede data.

mod faelles;

use faelles::{kaede, ordbog};
use grimnir_core::{analyser, demasker, AdvarselArt, Fejl, Klasse, Ordbog, Sag, VERSION};

fn ukendte(advarsler: &[grimnir_core::Advarsel]) -> usize {
    advarsler.iter().filter(|a| a.art == AdvarselArt::UkendtKode).count()
}

// ---------------------------------------------------------------- aliaser (D18)

#[test]
fn alias_demaskerer_tekst_maskeret_foer_rettelsen() {
    // Fund 5 i V-SKAL.2 og fund 1 i V-KERNE.2: en tekst er kopieret med den gamle kode, før koden blev rettet.
    let mut sag = Sag::default();
    let t1 = "hostname=srv-068";
    let k1 = kaede(t1, &ordbog(), &mut sag);
    assert_eq!(k1.maskeret, "hostname=h0001");
    sag.ret("h0001", "fw-ydre", t1).expect("rettelsen er fri");
    assert_eq!(sag.data().aliaser, [("h0001".to_string(), 0)]);
    let (tilbage, adv) = demasker(&k1.maskeret, &sag);
    assert_eq!(tilbage, t1, "den gamle kode peger stadig på posten");
    assert_eq!(
        ukendte(&adv),
        0,
        "ingen advarsel om ukendt kode: {:?}",
        adv.iter().map(|a| a.art).collect::<Vec<_>>()
    );
    // Den nye kode virker også, og opslaget kender begge.
    assert_eq!(demasker("hostname=fw-ydre", &sag).0, t1);
    assert_eq!(sag.opslag("h0001").map(|o| o.som_tekst()), Some("srv-068"));
    assert_eq!(sag.opslag("fw-ydre").map(|o| o.som_tekst()), Some("srv-068"));
}

#[test]
fn alias_efter_to_rettelser() {
    let mut sag = Sag::default();
    let t1 = "hostname=srv-068";
    let k1 = kaede(t1, &ordbog(), &mut sag);
    sag.ret("h0001", "fw-ydre", "").unwrap();
    let k2 = kaede(t1, &ordbog(), &mut sag);
    assert_eq!(k2.maskeret, "hostname=fw-ydre");
    sag.ret("fw-ydre", "fw-indre", "").unwrap();
    for gammel in [&k1.maskeret, &k2.maskeret] {
        let (tilbage, adv) = demasker(gammel, &sag);
        assert_eq!(&tilbage, t1);
        assert_eq!(ukendte(&adv), 0);
    }
    let a: Vec<&str> = sag.data().aliaser.iter().map(|(k, _)| k.as_str()).collect();
    assert_eq!(a, ["h0001", "fw-ydre"]);
}

#[test]
fn alias_kan_ikke_tildeles_eller_vaelges_til_en_anden_vaerdi() {
    let mut sag = Sag::default();
    let t1 = "hostname=srv-068 hostname=srv-069";
    let k1 = kaede(t1, &ordbog(), &mut sag);
    assert_eq!(k1.maskeret, "hostname=h0001 hostname=h0002");
    sag.ret("h0001", "fw-ydre", "").unwrap();
    // En anden værdi kan ikke vælge den gamle kode, heller ikke med andre store/små bogstaver.
    for k in ["h0001", "H0001"] {
        assert!(matches!(sag.ret("h0002", k, ""), Err(Fejl::KodeKolliderer { .. })), "{k}");
        assert!(matches!(sag.ret_enhed("h0002", k, ""), Err(Fejl::KodeKolliderer { .. })), "{k}");
    }
    // En ny værdi får ikke den gamle kode tildelt.
    let k2 = kaede("hostname=srv-070", &ordbog(), &mut sag);
    assert_eq!(k2.maskeret, "hostname=h0003");
    assert_eq!(demasker(&k1.maskeret, &sag).0, t1);
}

#[test]
fn alias_i_ny_tekst_maskeres_af_kollisionspasset() {
    let mut sag = Sag::default();
    let k1 = kaede("hostname=srv-068", &ordbog(), &mut sag);
    sag.ret("h0001", "fwydre01", "").unwrap();
    // En ny tekst har den gamle kode stående bogstaveligt: den må ikke blive stående, ellers sætter demaskeringen
    // srv-068 ind i stedet for teksten.
    let t2 = "se fwydre01 og den gamle h0001 og H0001";
    let k2 = kaede(t2, &ordbog(), &mut sag);
    assert!(k2.tilbage == t2, "rundturen er ikke bytepræcis: {}", k2.maskeret);
    assert!(!k2.maskeret.contains("h0001") && !k2.maskeret.contains("H0001"), "{}", k2.maskeret);
    // Den nuværende kode, der står bogstaveligt, maskeres også (som før).
    assert!(!k2.maskeret.contains("se fwydre01 "), "{}", k2.maskeret);
    assert_eq!(demasker(&k1.maskeret, &sag).0, "hostname=srv-068");
}

#[test]
fn tilbage_til_postens_egen_gamle_kode() {
    let mut sag = Sag::default();
    let k1 = kaede("hostname=srv-068", &ordbog(), &mut sag);
    sag.ret("h0001", "fw-ydre", "").unwrap();
    sag.ret("fw-ydre", "h0001", "").expect("postens egen gamle kode er fri for den");
    assert_eq!(sag.data().aliaser, [("fw-ydre".to_string(), 0)]);
    assert_eq!(demasker(&k1.maskeret, &sag).0, "hostname=srv-068");
    assert_eq!(demasker("hostname=fw-ydre", &sag).0, "hostname=srv-068");
}

#[test]
fn aliaser_overlever_data_og_beskadigede_afvises() {
    let mut sag = Sag::default();
    let k1 = kaede("hostname=srv-068", &ordbog(), &mut sag);
    sag.ret("h0001", "fw-ydre", "").unwrap();
    let igen = Sag::fra_data(sag.data().clone()).expect("data hænger sammen");
    assert_eq!(demasker(&k1.maskeret, &igen).0, "hostname=srv-068");
    for forkert in [("h0001".to_string(), 7usize), ("fw-ydre".to_string(), 0), (String::new(), 0)] {
        let mut d = sag.data().clone();
        d.aliaser.push(forkert);
        assert!(matches!(Sag::fra_data(d), Err(Fejl::UgyldigeSagsdata { .. })));
    }
}

// ---------------------------------------------------------------- ret_enhed (fund 3 i V-SKAL.2)

#[test]
fn ret_enhed_omdoeber_alle_stavemaader_og_spejler() {
    let mut sag = Sag::default();
    let t1 = "user=\"bruger060\" fra pc01\r\nuser=\"BRUGER060\" igen\r\n";
    let k1 = kaede(t1, &ordbog(), &mut sag);
    assert!(
        k1.maskeret.contains("user0001") && k1.maskeret.contains("USER0001"),
        "{}",
        k1.maskeret
    );
    // `ret` kan ikke tage koden for den ene stavemåde, fordi den anden har den med store bogstaver.
    assert!(matches!(sag.ret("user0001", "kunde7", t1), Ok(())));
    assert!(matches!(sag.ret("USER0001", "KUNDE7", t1), Err(Fejl::KodeKolliderer { .. })));
    // ret_enhed omdøber begge samlet.
    let par = sag.ret_enhed("USER0001", "Kunde7", t1).expect("enheden kan omdøbes");
    // bruger060 har allerede kunde7 (fra `ret`); kun BRUGER060 får en ny kode.
    assert_eq!(par, [("USER0001".to_string(), "KUNDE7".to_string())]);
    assert_eq!(sag.kode_for_original(Klasse::Bruger, "bruger060"), Some("kunde7"));
    assert_eq!(sag.kode_for_original(Klasse::Bruger, "BRUGER060"), Some("KUNDE7"));
    let k2 = kaede(t1, &ordbog(), &mut sag);
    assert!(
        k2.maskeret.contains("\"kunde7\"") && k2.maskeret.contains("\"KUNDE7\""),
        "{}",
        k2.maskeret
    );
    assert!(k2.tilbage == t1);
    // Den første tekst med de gamle koder kan stadig demaskeres.
    let (tilbage, adv) = demasker(&k1.maskeret, &sag);
    assert_eq!(tilbage, t1);
    assert_eq!(ukendte(&adv), 0);
    // En ny stavemåde af enheden får en kode ud fra den nye kode (blandede bogstaver: som brugeren skrev den).
    let t3 = "login Bruger060";
    let k3 = kaede(t3, &ordbog(), &mut sag);
    assert_eq!(k3.maskeret, "login Kunde7");
    assert!(k3.tilbage == t3);
}

#[test]
fn ret_enhed_fra_automatiske_koder() {
    let mut sag = Sag::default();
    let t1 = "user=\"bruger061\" og user=\"BRUGER061\"";
    let k1 = kaede(t1, &ordbog(), &mut sag);
    let par = sag.ret_enhed("user0001", "kunde8", t1).unwrap();
    assert_eq!(
        par,
        [
            ("user0001".to_string(), "kunde8".to_string()),
            ("USER0001".to_string(), "KUNDE8".to_string())
        ]
    );
    assert_eq!(demasker(&k1.maskeret, &sag).0, t1);
    assert_eq!(demasker("kunde8 KUNDE8", &sag).0, "bruger061 BRUGER061");
}

#[test]
fn ret_enhed_afviser_kollision_og_aendrer_intet() {
    let mut sag = Sag::default();
    let t1 = "user=\"bruger062\" user=\"BRUGER062\" hostname=srv-068";
    let _ = kaede(t1, &ordbog(), &mut sag);
    let foer: Vec<String> = sag.data().poster.iter().map(|p| p.kode.clone()).collect();
    for (ny, tekst) in [("h0001", ""), ("H0001", ""), ("hostname", t1), ("-x", "")] {
        assert!(sag.ret_enhed("user0001", ny, tekst).is_err(), "{ny}");
    }
    assert!(matches!(sag.ret_enhed("h9999", "x1", ""), Err(Fejl::UkendtKode { .. })));
    let efter: Vec<String> = sag.data().poster.iter().map(|p| p.kode.clone()).collect();
    assert_eq!(foer, efter);
    assert!(sag.data().aliaser.is_empty());
}

// ---------------------------------------------------------------- ordbogen (fund 4 i V-SKAL.2)

#[test]
fn ordbog_aldrig_virker_som_foer_med_net_tekst_og_mange_indgange() {
    let t = "a 10.20.30.7 b 10.20.31.7 c 172.16.5.9 d 100.70.1.2 e srv-068 f SRV-069 g Projekt Uglebo";
    let mut o = ordbog();
    let alle = analyser(t, &o).len();
    // 5.000 indgange, der ikke står i teksten, ændrer intet.
    for i in 0..2500 {
        o.aldrig.push(format!("ikke-i-teksten-{i}"));
        o.aldrig.push(format!("192.0.2.{}/32", i % 250 + 1));
    }
    assert_eq!(analyser(t, &o).len(), alle);
    // Et net, en enkelt adresse og en tekst uafhængigt af store/små.
    o.aldrig
        .extend(["10.20.30.0/24".into(), "172.16.5.9".into(), "srv-069".into(), "ugyldig/99".into()]);
    let fund = analyser(t, &o);
    let tekster: Vec<&str> = fund.iter().map(|f| &t[f.start..f.slut]).collect();
    assert!(
        !tekster.contains(&"10.20.30.7") && !tekster.contains(&"172.16.5.9") && !tekster.contains(&"SRV-069"),
        "{tekster:?}"
    );
    assert!(tekster.contains(&"10.20.31.7") && tekster.contains(&"srv-068"), "{tekster:?}");
    // Egne net: 100.70.0.0/16 i ordbogen gør adressen til en egen adresse (Ordbog).
    let f = fund.iter().find(|f| &t[f.start..f.slut] == "100.70.1.2").expect("egen adresse");
    assert_eq!(f.sikkerhed, grimnir_core::Sikkerhed::Ordbog);
    // /0 dækker alt.
    let mut alt = Ordbog::ny();
    alt.aldrig.push("0.0.0.0/0".into());
    assert!(analyser("10.20.30.7 og 172.16.5.9", &alt).is_empty());
}

// ---------------------------------------------------------------- VERSION

#[test]
fn version_er_kernens_version() {
    assert_eq!(VERSION, env!("CARGO_PKG_VERSION"));
    assert!(include_str!("../Cargo.toml").contains(&format!("version = \"{VERSION}\"")));
}
