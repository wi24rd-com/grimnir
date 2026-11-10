//! V-KERNE.2: rettelser efter kontrollen (F1–F6). Kun opdigtede data.

mod faelles;

use faelles::{kaede, ordbog};
use grimnir_core::{analyser, demasker, foreslaa_med_ordbog, masker, AdvarselArt, Art, Klasse, RestArt, Sag, Sikkerhed};

// ---------------------------------------------------------------- F1

const TEKST1: &str = "ssh bruger022@srv-068.intern.kontor.test password=Sommer2026! db=kundedata";

fn sag_efter_tekst1() -> Sag {
    let mut sag = Sag::default();
    let k = kaede(TEKST1, &ordbog(), &mut sag);
    assert_eq!(k.maskeret, "ssh user0001@d01.example password=GRIMNIR_SECRET_0001 db=db0001");
    assert!(k.rester.is_empty());
    sag
}

fn tjek(sag: &mut Sag, tekst: &str, forventet: &str) {
    let k = kaede(tekst, &ordbog(), sag);
    assert_eq!(k.maskeret, forventet);
    assert!(k.rester.is_empty(), "rester: {:?}", k.rester);
    assert!(k.tilbage == tekst, "rundturen er ikke bytepræcis");
}

#[test]
fn f1_kendt_bruger_i_ny_tekst() {
    let mut sag = sag_efter_tekst1();
    tjek(
        &mut sag,
        "login failed for bruger022 from zeus01",
        "login failed for user0001 from zeus01",
    );
}

#[test]
fn f1_kendt_hemmelighed_i_ny_tekst() {
    let mut sag = sag_efter_tekst1();
    tjek(&mut sag, "fejl: Sommer2026! afvist", "fejl: GRIMNIR_SECRET_0001 afvist");
}

#[test]
fn f1_kendt_database_og_stavemaader_i_ny_tekst() {
    let mut sag = sag_efter_tekst1();
    tjek(&mut sag, "open kundedata; BRUGER022 Bruger022", "open db0001; USER0001 user0001b");
}

#[test]
fn f1_hemmelighed_kun_bogstaveligt() {
    let mut sag = sag_efter_tekst1();
    // Genbruges ikke (hemmeligheder sammenlignes bogstaveligt), men lækagetjekket melder dem (K4).
    let t = "fejl: SOMMER2026! og sommer2026!";
    let k = kaede(t, &ordbog(), &mut sag);
    assert_eq!(k.maskeret, t);
    assert_eq!(k.rester.len(), 2);
    assert!(k.rester.iter().all(|r| r.art == RestArt::Original(Klasse::Hemmelighed)));
}

#[test]
fn f1_fund_fra_analyser_vinder_over_sagsfund() {
    let mut sag = sag_efter_tekst1();
    let t = "Database=kundedata_arkiv;";
    let fund = analyser(t, &ordbog());
    let e = foreslaa_med_ordbog(&fund, t, &mut sag, &ordbog());
    assert_eq!(e.len(), 1);
    assert_eq!((e[0].start, e[0].slut, e[0].kode.as_str()), (9, 24, "db0002"));
}

#[test]
fn f1_maskeer_aldrig_vinder_over_sagsfund() {
    let mut sag = sag_efter_tekst1();
    let mut o = ordbog();
    o.aldrig.push("kundedata".into());
    let t = "open kundedata og bruger022";
    let k = kaede(t, &o, &mut sag);
    assert_eq!(k.maskeret, "open kundedata og user0001");
    assert!(k.rester.is_empty(), "rester: {:?}", k.rester);
    assert!(k.tilbage == t);
}

#[test]
fn f1_korte_og_rene_tal_genbruges_ikke() {
    let mut sag = Sag::default();
    let t1 = "Server=srv-068;Database=2024;User Id=sa;Password=Sommer2026!;";
    let k1 = kaede(t1, &ordbog(), &mut sag);
    assert_eq!(
        k1.maskeret,
        "Server=h0001;Database=db0001;User Id=user0001;Password=GRIMNIR_SECRET_0001;"
    );
    // "sa" (under fire tegn) og "2024" (kun cifre) genbruges ikke som frie ord. Lækagetjekket
    // melder dem som rester, så brugeren selv kan afgøre det.
    let t2 = "sa har 2024 rapporter";
    let k2 = kaede(t2, &ordbog(), &mut sag);
    assert_eq!(k2.maskeret, t2);
    let arter: Vec<RestArt> = k2.rester.iter().map(|r| r.art).collect();
    assert_eq!(arter, [RestArt::Original(Klasse::Bruger), RestArt::Original(Klasse::Database)]);
}

// ---------------------------------------------------------------- F4

#[test]
fn f4_koder_uafhaengigt_af_store_og_smaa() {
    let t = "hostname=srv-068 mac=0a:1b:2c:3d:4e:5f ip6=fd00:20:30:1::a ip=10.20.30.1 bruger022@kontor.test KONTOR\\bruger022";
    let mut sag = Sag::default();
    let k = kaede(t, &ordbog(), &mut sag);
    assert!(
        k.maskeret.contains("00:00:5e:00:53:00") && k.maskeret.contains("2001:db8::1"),
        "{}",
        k.maskeret
    );
    for (redigeret, tilbage_forventet) in [
        (k.maskeret.to_ascii_uppercase(), t.to_ascii_uppercase()),
        (k.maskeret.to_ascii_lowercase(), t.to_ascii_lowercase()),
    ] {
        let (tilbage, adv) = demasker(&redigeret, &sag);
        assert_eq!(tilbage, tilbage_forventet, "alle koder sættes tilbage");
        assert!(!adv.iter().any(|a| a.art == AdvarselArt::UkendtKode), "{adv:?}");
        assert!(adv
            .iter()
            .any(|a| a.art == AdvarselArt::AfledtForm(grimnir_core::AfledtArt::AndenStavemaade)));
    }
}

#[test]
fn f4_hemmelighed_saettes_tilbage_bogstaveligt() {
    let t = "password=Sommer2026!";
    let mut sag = Sag::default();
    let k = kaede(t, &ordbog(), &mut sag);
    assert_eq!(demasker(&k.maskeret.to_ascii_lowercase(), &sag).0, t);
}

// ---------------------------------------------------------------- F6

#[test]
fn f6_brugerens_kode_reserveres_i_senere_tekster() {
    let mut sag = Sag::default();
    let t1 = "hostname=srv-068";
    let k1 = kaede(t1, &ordbog(), &mut sag);
    assert_eq!(k1.maskeret, "hostname=h0001");
    sag.ret("h0001", "fw-ydre", t1).expect("rettelsen er fri");
    assert_eq!(sag.data().rettede_koder, ["fw-ydre"]);
    let t2 = "fw-ydre er den ydre firewall, srv-068 den indre, FW-YDRE står også her";
    let k2 = kaede(t2, &ordbog(), &mut sag);
    assert!(k2.tilbage == t2, "rundturen er ikke bytepræcis: {}", k2.maskeret);
    assert!(k2.maskeret.contains("fw-ydre den indre"), "{}", k2.maskeret);
    assert!(
        !k2.maskeret.starts_with("fw-ydre"),
        "den bogstavelige forekomst er maskeret: {}",
        k2.maskeret
    );
    let k1b = kaede(t1, &ordbog(), &mut sag);
    assert_eq!(k1b.maskeret, "hostname=fw-ydre");
    assert_eq!(sag.kode_for_original(Klasse::Vaert, "srv-068"), Some("fw-ydre"));
    // Reservationen husker den bogstavelige forekomst i tekst 2: efter en ny rettelse kan koden ikke tages igen
    sag.ret("fw-ydre", "fw-indre", t1).expect("ny rettelse");
    assert!(matches!(
        sag.ret("fw-indre", "fw-ydre", ""),
        Err(grimnir_core::Fejl::KodeKolliderer { .. })
    ));
    assert_eq!(sag.data().rettede_koder, ["fw-ydre", "fw-indre"]);
    let _ = (Art::Vaert, Sikkerhed::Sikker, masker);
}

// ---------------------------------------------------------------- F3

#[test]
fn f3_url_kodet_mail() {
    let o = ordbog();
    for t in ["q=%40bruger022%40kontor.test&x=1", "mail=bruger022%40kontor.test"] {
        let fund = analyser(t, &o);
        let tekster: Vec<&str> = fund.iter().map(|f| &t[f.start..f.slut]).collect();
        assert_eq!(tekster, ["bruger022", "kontor.test"], "{t}");
        assert!(fund.iter().all(|f| f.del_af == Some(grimnir_core::Sammensat::Mail)));
        let mut sag = Sag::default();
        let k = kaede(t, &o, &mut sag);
        assert!(k.maskeret.contains("user0001%40d01.example"), "{}", k.maskeret);
        assert!(k.rester.is_empty() && k.tilbage == t);
        assert!(k.advarsler.iter().all(|a| a.art == AdvarselArt::IkkeBrugt), "{:?}", k.advarsler);
    }
}

#[test]
fn f3_domaene_bruger_efter_escape() {
    let o = ordbog();
    let t = r#"{"log": "start\r\nKONTOR\\bruger022 logget ind\r\nANDET\\bruger023"}"#;
    let fund = analyser(t, &o);
    let tekster: Vec<&str> = fund.iter().map(|f| &t[f.start..f.slut]).collect();
    assert_eq!(tekster, ["KONTOR", "bruger022", "ANDET", "bruger023"]);
    let mut sag = Sag::default();
    let k = kaede(t, &o, &mut sag);
    assert!(
        k.maskeret.contains(r"\r\nNB01\\user0001 logget ind\r\nNB02\\user0002"),
        "{}",
        k.maskeret
    );
    assert!(k.rester.is_empty() && k.tilbage == t);
}

// ---------------------------------------------------------------- F2

#[test]
fn f2_windows_haendelser() {
    let o = ordbog();
    let t = "Account Name:\t\tbruger022\nWorkstation Name:\tPC1234\nUser bruger023 logged on\nLogon Account:\tbruger024\n\
             Source Workstation:\tPC5678\nComputer:\tsrv-068.intern.kontor.test\nComputerName=WS-ALFA\nUser Name: bruger025\n\
             Account Name:\t\tSRV-099$";
    let fund = analyser(t, &o);
    let par: Vec<(&str, Art, Sikkerhed)> = fund.iter().map(|f| (&t[f.start..f.slut], f.art, f.sikkerhed)).collect();
    let s = Sikkerhed::Sandsynlig;
    for forventet in [
        ("bruger022", Art::Bruger, s),
        ("PC1234", Art::Vaert, s),
        ("bruger023", Art::Bruger, s),
        ("bruger024", Art::Bruger, s),
        ("PC5678", Art::Vaert, s),
        ("bruger025", Art::Bruger, s),
        ("SRV-099", Art::Vaert, s),
    ] {
        assert!(par.contains(&forventet), "mangler {forventet:?} i {par:?}");
    }
    assert!(
        par.iter().any(|p| p.0 == "srv-068") && par.iter().any(|p| p.0 == "WS-ALFA"),
        "{par:?}"
    );
    let mut sag = Sag::default();
    let k = kaede(t, &o, &mut sag);
    assert!(k.rester.is_empty() && k.tilbage == t);
    assert!(
        k.maskeret.ends_with("Account Name:\t\tH0005$"),
        "maskinkontoen beholder sit $: {}",
        k.maskeret
    );
}

#[test]
fn f2_vaerdier_der_ikke_er_navne() {
    let o = ordbog();
    let t = "Account Name:\t-\nAccount Name:\tSYSTEM\nAccount Name:\tANONYMOUS LOGON\nAccount Name:\tLOCAL SERVICE\n\
             Account Name:\tNETWORK SERVICE\nWorkstation Name:\t-\nUser Name: system";
    let fund = analyser(t, &o);
    assert!(
        fund.is_empty(),
        "{:?}",
        fund.iter().map(|f| &t[f.start..f.slut]).collect::<Vec<_>>()
    );
}
