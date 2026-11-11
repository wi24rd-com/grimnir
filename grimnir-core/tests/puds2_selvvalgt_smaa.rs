//! V-PUDS.2 N1: en selvvalgt kode (og et alias uden kodeform), der kommer tilbage med andre store/små bogstaver, sættes
//! tilbage som F4 (`AfledtForm(AndenStavemaade)`), med de samme grænseregler som det præcise opslag. Et præcist træf vinder
//! altid; overlap afgøres længst til venstre, derefter længst. `ret` og `ret_enhed` afviser en kode, der uafhængigt af
//! store/små findes i sagen eller står i teksten. Kun opdigtede data.

mod faelles;

use faelles::{kaede, ordbog};
use grimnir_core::{demasker, demasker_med_steder, Advarsel, AdvarselArt, AfledtArt, Fejl, Sag, SatTilbage};

const ORIGINAL: &str = "gw=10.20.30.1 vaert=srv-068.intern.kontor.test og srv-002 KONTOR\\bruger022 mail bruger022@kontor.test";
const ANDEN: AdvarselArt = AdvarselArt::AfledtForm(AfledtArt::AndenStavemaade);

/// Sagen fra k5/kvit1. Koder: srv-068 → h0001, intern.kontor.test → d01.example, srv-002 → h0002, KONTOR → NB01,
/// bruger022 → user0001, kontor.test → d02.example.
fn sag() -> Sag {
    let mut sag = Sag::default();
    let k = kaede(ORIGINAL, &ordbog(), &mut sag);
    assert_eq!(
        k.maskeret,
        "gw=198.18.0.1 vaert=h0001.d01.example og h0002 NB01\\user0001 mail user0001@d02.example"
    );
    sag
}

/// Sagen, hvor srv-002 har fået den selvvalgte kode `fw-ydre`.
fn sag_fw() -> Sag {
    let mut s = sag();
    s.ret("h0002", "fw-ydre", ORIGINAL).expect("fw-ydre er fri");
    s
}

fn post(sag: &Sag, kode: &str) -> usize {
    sag.data()
        .poster
        .iter()
        .position(|p| p.kode == kode)
        .unwrap_or_else(|| panic!("{kode} findes ikke"))
}

fn flad(a: &[Advarsel]) -> Vec<(AdvarselArt, usize, usize, String, bool)> {
    a.iter()
        .map(|x| (x.art, x.start, x.slut, x.kode.clone(), x.forslag.is_some()))
        .collect()
}

/// Begge funktioner: samme tekst og samme advarsler (krav i N1).
fn begge(tekst: &str, sag: &Sag) -> (String, Vec<Advarsel>, Vec<SatTilbage>) {
    let (ud, adv, steder) = demasker_med_steder(tekst, sag);
    let (ud2, adv2) = demasker(tekst, sag);
    assert_eq!(ud, ud2, "samme tekst");
    assert_eq!(flad(&adv), flad(&adv2), "samme advarsler");
    (ud, adv, steder)
}

/// Advarslerne "anden stavemåde": (start, slut, kode).
fn anden(adv: &[Advarsel]) -> Vec<(usize, usize, String)> {
    adv.iter()
        .filter(|a| a.art == ANDEN)
        .map(|a| (a.start, a.slut, a.kode.clone()))
        .collect()
}

fn ikke_brugt(adv: &[Advarsel], kode: &str) -> bool {
    adv.iter().any(|a| a.art == AdvarselArt::IkkeBrugt && a.kode == kode)
}

fn sted(post: usize, antal: usize, foerste: usize) -> SatTilbage {
    SatTilbage { post, antal, foerste }
}

#[test]
fn selvvalgt_kode_med_store_og_blandede_bogstaver() {
    let s = sag_fw();
    let p = post(&s, "fw-ydre");
    // Kun store bogstaver: navnet spejles (originalen med store).
    let (ud, adv, steder) = begge("ping FW-YDRE", &s);
    assert_eq!(ud, "ping SRV-002");
    assert_eq!(anden(&adv), [(5, 12, "FW-YDRE".to_string())]);
    assert_eq!(steder, [sted(p, 1, 5)]);
    assert!(!ikke_brugt(&adv, "fw-ydre"), "posten er brugt");
    assert!(!adv.iter().any(|a| a.art == AdvarselArt::UkendtKode), "{:?}", flad(&adv));
    // Blandede bogstaver: originalen, som den er.
    let (ud, adv, steder) = begge("Fw-Ydre svarer", &s);
    assert_eq!(ud, "srv-002 svarer");
    assert_eq!(anden(&adv), [(0, 7, "Fw-Ydre".to_string())]);
    assert_eq!(steder, [sted(p, 1, 0)]);
    // Fejlen fra V-KVIT.1: før stod koden urørt, og eneste advarsel var "ikke brugt".
    let (ud, adv, _) = begge("FW-YDRE", &s);
    assert_eq!(ud, "SRV-002");
    assert!(!ikke_brugt(&adv, "fw-ydre"));
}

#[test]
fn alias_uden_kodeform_med_andre_bogstaver() {
    let mut s = sag_fw();
    s.ret("fw-ydre", "fw-indre", ORIGINAL).expect("fw-indre er fri");
    let p = post(&s, "fw-indre");
    assert!(s.data().aliaser.iter().any(|(k, q)| k == "fw-ydre" && *q == p));
    let (ud, adv, steder) = begge("a FW-YDRE b Fw-Indre c fw-ydre", &s);
    assert_eq!(ud, "a SRV-002 b srv-002 c srv-002");
    assert_eq!(anden(&adv), [(2, 9, "FW-YDRE".to_string()), (12, 20, "Fw-Indre".to_string())]);
    assert_eq!(steder, [sted(p, 3, 2)], "aliaset, koden og aliaset igen er samme post");
    // Tilbage til postens egen gamle kode: aliaset forsvinder, og begge findes stadig med andre bogstaver.
    s.ret("fw-indre", "fw-ydre", "").expect("postens egen gamle kode");
    let (ud, _, steder) = begge("FW-YDRE FW-INDRE", &s);
    assert_eq!(ud, "SRV-002 SRV-002");
    assert_eq!(steder, [sted(post(&s, "fw-ydre"), 2, 0)]);
}

#[test]
fn kode_midt_i_et_ord_saettes_ikke_tilbage() {
    let s = sag_fw();
    for t in ["xFW-YDRE", "FW-YDREx", "FW-YDRE2", "2FW-YDRE", "afw-ydreb"] {
        let (ud, adv, steder) = begge(t, &s);
        assert_eq!(ud, t, "{t}");
        assert!(anden(&adv).is_empty() && steder.is_empty(), "{t}: {:?}", flad(&adv));
        assert!(ikke_brugt(&adv, "fw-ydre"), "{t}");
    }
    // Grænsetegn er alt andet end bogstaver og cifre: punktum, understreg, parentes, linjeskift, %XX foran.
    let (ud, _, steder) = begge("(FW-YDRE). FW-YDRE_log\nFw-ydre %40FW-YDRE", &s);
    assert_eq!(ud, "(SRV-002). SRV-002_log\nsrv-002 %40SRV-002");
    assert_eq!(steder[0].antal, 4);
}

#[test]
fn praecist_traef_og_afvigende_traef_i_samme_tekst() {
    let s = sag_fw();
    let p = post(&s, "fw-ydre");
    let (ud, adv, steder) = begge("fw-ydre og FW-YDRE og fw-ydre", &s);
    assert_eq!(ud, "srv-002 og SRV-002 og srv-002");
    assert_eq!(anden(&adv), [(11, 18, "FW-YDRE".to_string())], "kun det afvigende sted advares");
    assert_eq!(steder, [sted(p, 3, 0)]);

    // Et præcist træf vinder altid over et overlappende træf med andre bogstaver: `fw` står præcist ved grænsen `-`.
    let mut s = sag();
    s.ret("h0001", "fw", "").unwrap();
    s.ret("h0002", "fw-ydre", "").unwrap();
    let (ud, adv, _) = begge("fw-YDRE", &s);
    assert_eq!(ud, "srv-068-YDRE");
    assert!(anden(&adv).is_empty(), "{:?}", flad(&adv));
    // Mellem to afvigende træf: længst til venstre, derefter længst.
    let (ud, adv, steder) = begge("FW-YDRE FW Fw-Ydre-x", &s);
    assert_eq!(ud, "SRV-002 SRV-068 srv-002-x");
    assert_eq!(anden(&adv).len(), 3);
    assert_eq!(steder.iter().map(|x| x.antal).sum::<usize>(), 3);
}

#[test]
fn overlap_med_en_kodeform() {
    // En selvvalgt kode, der begynder med en kodeform: samme start, den selvvalgte er længst og vinder.
    let mut s = sag();
    s.ret("h0002", "h0001-ny", "").expect("h0001-ny er fri");
    let (ud, adv, _) = begge("H0001-NY og H0001", &s);
    assert_eq!(ud, "SRV-002 og SRV-068");
    assert_eq!(anden(&adv), [(0, 8, "H0001-NY".to_string()), (12, 17, "H0001".to_string())]);
    assert!(!adv.iter().any(|a| a.art == AdvarselArt::UkendtKode), "{:?}", flad(&adv));
    // En kodeform, der begynder før den selvvalgte kode og overlapper den, vinder (længst til venstre).
    let mut s = sag();
    s.ret("h0002", "example-x", "").expect("example-x er fri");
    let (ud, adv, _) = begge("D01.EXAMPLE-X", &s);
    assert_eq!(ud, "INTERN.KONTOR.TEST-X");
    assert_eq!(anden(&adv), [(0, 11, "D01.EXAMPLE".to_string())]);
    assert!(ikke_brugt(&adv, "example-x"));
    // Står den alene, sættes den tilbage.
    assert_eq!(begge("EXAMPLE-X", &s).0, "SRV-002");
}

#[test]
fn spejling_for_navne_og_hele_enheden() {
    let mut s = sag();
    s.ret("user0001", "kunde7", "").unwrap();
    let (ud, _, _) = begge("KUNDE7 Kunde7 kunde7", &s);
    assert_eq!(ud, "BRUGER022 bruger022 bruger022");
    // Hele enheden (to stavemåder) omdøbt: koderne spejler stavemåderne, og begge findes med andre bogstaver.
    let mut s = Sag::default();
    let t = "user=\"bruger061\" og user=\"BRUGER061\"";
    let k = kaede(t, &ordbog(), &mut s);
    s.ret_enhed("user0001", "kunde8", t).unwrap();
    assert_eq!(s.kode_for_original(grimnir_core::Klasse::Bruger, "BRUGER061"), Some("KUNDE8"));
    let (ud, adv, _) = begge("KUNDE8 kunde8 KuNdE8", &s);
    assert_eq!(ud, "BRUGER061 bruger061 bruger061");
    assert_eq!(anden(&adv), [(14, 20, "KuNdE8".to_string())], "samme enhed: ingen tvetydighed");
    assert_eq!(demasker(&k.maskeret, &s).0, t);
}

#[test]
fn hemmelighed_saettes_tilbage_bogstaveligt() {
    let t = "password=Sommer2026!";
    let mut s = Sag::default();
    let k = kaede(t, &ordbog(), &mut s);
    assert_eq!(k.maskeret, "password=GRIMNIR_SECRET_0001");
    s.ret("GRIMNIR_SECRET_0001", "hemmelig-a", t).unwrap();
    let (ud, adv, _) = begge("password=HEMMELIG-A og Hemmelig-A", &s);
    assert_eq!(ud, "password=Sommer2026! og Sommer2026!");
    assert_eq!(anden(&adv).len(), 2);
}

#[test]
fn sagen_genskabt_fra_data_finder_det_samme() {
    let mut s = sag_fw();
    s.ret("user0001", "kunde7", "").unwrap();
    let igen = Sag::fra_data(s.data().clone()).unwrap();
    let t = "FW-YDRE Kunde7 h0001";
    let a = begge(t, &s);
    let b = begge(t, &igen);
    assert_eq!(a.0, "SRV-002 bruger022 srv-068");
    assert_eq!((a.0, flad(&a.1), a.2), (b.0, flad(&b.1), b.2));
}

#[test]
fn ens_bortset_fra_store_og_smaa_kan_ikke_opstaa_med_ret() {
    // `ret` og `ret_enhed` afviser en kode, der bortset fra store/små er en anden posts kode eller alias.
    let mut s = sag_fw();
    for ny in ["FW-YDRE", "Fw-Ydre"] {
        assert!(matches!(s.ret("h0001", ny, ""), Err(Fejl::KodeKolliderer { .. })), "{ny}");
        assert!(matches!(s.ret_enhed("h0001", ny, ""), Err(Fejl::KodeKolliderer { .. })), "{ny}");
    }
    s.ret("fw-ydre", "fw-indre", "").unwrap();
    assert!(matches!(s.ret("h0001", "FW-YDRE", ""), Err(Fejl::KodeKolliderer { .. })), "alias");
    assert!(
        matches!(s.ret_enhed("h0001", "fw-YDRE", ""), Err(Fejl::KodeKolliderer { .. })),
        "alias"
    );
}

#[test]
fn ens_bortset_fra_store_og_smaa_fra_data_udefra_saettes_ikke_tilbage() {
    // Data, `ret` aldrig ville lave: to maskiner (to enheder), hvis koder kun afviger i store/små.
    let mut d = sag().data().clone();
    let (a, b) = (
        d.poster.iter().position(|p| p.kode == "h0001").unwrap(),
        d.poster.iter().position(|p| p.kode == "h0002").unwrap(),
    );
    assert_ne!(d.poster[a].enhed, d.poster[b].enhed);
    d.poster[a].kode = "fw-ydre".into();
    d.poster[b].kode = "FW-YDRE".into();
    let s = Sag::fra_data(d).expect("præcis forskellige koder");
    // Præcise træf er entydige og sættes tilbage.
    assert_eq!(begge("fw-ydre FW-YDRE", &s).0, "srv-068 srv-002");
    // Et træf med andre bogstaver kan være begge: ingen sættes tilbage, og der advares.
    let (ud, adv, steder) = begge("Fw-Ydre", &s);
    assert_eq!(ud, "Fw-Ydre");
    assert!(steder.is_empty());
    assert!(anden(&adv).is_empty());
    assert!(adv
        .iter()
        .any(|x| x.art == AdvarselArt::UkendtKode && (x.start, x.slut, x.kode.as_str()) == (0, 7, "Fw-Ydre")));
    assert!(ikke_brugt(&adv, "fw-ydre") && ikke_brugt(&adv, "FW-YDRE"));
}

#[test]
fn ret_afviser_en_kode_der_staar_i_teksten_med_andre_bogstaver() {
    // Ellers kunne et almindeligt ord i loggen blive "sat tilbage" ved demaskeringen.
    let t = "login FW-YDRE ok\nsrv-002";
    for ny in ["fw-ydre", "Fw-Ydre", "FW-YDRE"] {
        let mut s = sag();
        assert!(matches!(s.ret("h0002", ny, t), Err(Fejl::KodeKolliderer { .. })), "ret {ny}");
        assert!(
            matches!(s.ret_enhed("h0002", ny, t), Err(Fejl::KodeKolliderer { .. })),
            "ret_enhed {ny}"
        );
        assert_eq!(s.data().poster[post(&s, "h0002")].kode, "h0002", "intet ændret");
    }
    // Ved en grænse: punktum, understreg og linjeskift er grænser; inde i et ord er det ikke.
    for t in ["(FW-YDRE).", "x_fw-ydre_y", "a\r\nFw-Ydre"] {
        let mut s = sag();
        assert!(s.ret("h0002", "fw-ydre", t).is_err(), "{t:?}");
    }
    for t in ["xfw-ydre", "FW-YDREx", "afw-ydre2"] {
        let mut s = sag();
        assert!(s.ret("h0002", "fw-ydre", t).is_ok(), "{t:?}");
        // Og demaskeringen lader det stå, med samme grænseregel.
        assert_eq!(demasker(t, &s).0, t);
    }
}

#[test]
fn kollisionspasset_maskerer_den_selvvalgte_kode_med_andre_bogstaver_i_en_ny_tekst() {
    // Står `FW-YDRE` som et ord i en senere tekst, ville demaskeringen sætte en forkert original ind. Den maskeres derfor
    // som en af sagens koder (som F4 for Grimnirs egne koder), og rundturen er bytepræcis.
    let mut s = sag_fw();
    let t2 = "regel FW-YDRE tillader Fw-Ydre, men xFW-YDRE er et andet ord";
    let k = kaede(t2, &ordbog(), &mut s);
    assert!(
        !k.maskeret.contains(" FW-YDRE ") && !k.maskeret.contains("Fw-Ydre"),
        "{}",
        k.maskeret
    );
    assert!(k.maskeret.contains("xFW-YDRE"), "inde i et ord: urørt");
    assert!(k.tilbage == t2, "rundturen er ikke bytepræcis: {}", k.maskeret);
    assert!(anden(&k.advarsler).is_empty());
}
