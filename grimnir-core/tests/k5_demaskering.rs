//! K5: de ti demaskeringstilfælde fra INVESTIGATION Q6.

mod faelles;

use faelles::{kaede, ordbog};
use grimnir_core::{demasker, AdvarselArt, AfledtArt, Sag};

const ORIGINAL: &str = "gw=10.20.30.1 vaert=srv-068.intern.eksempel.dk og srv-002 KONTOR\\bruger022 mail bruger022@eksempel.dk";

/// En sag, der kender ORIGINAL. Koder: 10.20.30.1 → 198.18.0.1, srv-068 → h0001, intern.eksempel.dk → d01.example,
/// srv-002 → h0002, KONTOR → NB01, bruger022 → user0001, eksempel.dk → d02.example.
fn sag() -> Sag {
    let mut sag = Sag::default();
    let k = kaede(ORIGINAL, &ordbog(), &mut sag);
    assert_eq!(
        k.maskeret,
        "gw=198.18.0.1 vaert=h0001.d01.example og h0002 NB01\\user0001 mail user0001@d02.example"
    );
    sag
}

fn arter(svar: &str, sag: &Sag) -> (String, Vec<AdvarselArt>) {
    let (t, a) = demasker(svar, sag);
    (t, a.into_iter().map(|a| a.art).filter(|a| *a != AdvarselArt::IkkeBrugt).collect())
}

#[test]
fn q6_1_kendt_kode() {
    let s = sag();
    let (t, a) = arter("ret gw 198.18.0.1 på h0001.d01.example", &s);
    assert_eq!(t, "ret gw 10.20.30.1 på srv-068.intern.eksempel.dk");
    assert!(a.is_empty(), "{a:?}");
}

#[test]
fn q6_2_ukendt_adresse_i_sagens_net() {
    let s = sag();
    let (t, a) = demasker("tilføj 198.18.0.77", &s);
    assert_eq!(t, "tilføj 198.18.0.77", "ukendt adresse står urørt");
    let adv = a.iter().find(|x| x.art == AdvarselArt::UkendtAdresseISagensNet).expect("advarsel");
    assert_eq!(adv.forslag.as_ref().map(|o| o.som_tekst()), Some("10.20.30.77"));
}

#[test]
fn q6_3_ukendt_kode_af_kendt_form() {
    let s = sag();
    let (t, a) = arter("og h0099", &s);
    assert_eq!(t, "og h0099");
    assert_eq!(a, [AdvarselArt::UkendtKode]);
}

#[test]
fn q6_4_anden_stavemaade() {
    let s = sag();
    let (t, a) = arter("server H0002 svarer", &s);
    assert_eq!(t, "server SRV-002 svarer");
    assert_eq!(a, [AdvarselArt::AfledtForm(AfledtArt::AndenStavemaade)]);
}

#[test]
fn q6_5_fqdn_forkortet_og_domaenet_alene() {
    let s = sag();
    let (t, a) = arter("log ind på h0001 i d01.example", &s);
    assert_eq!(t, "log ind på srv-068 i intern.eksempel.dk");
    assert_eq!(
        a,
        [
            AdvarselArt::AfledtForm(AfledtArt::FqdnForkortet),
            AdvarselArt::AfledtForm(AfledtArt::DomaeneAlene)
        ]
    );
}

#[test]
fn q6_6_adresse_med_maske_eller_port() {
    let s = sag();
    let (t, a) = arter("route 198.18.0.1/24 og https://198.18.0.1:443/x", &s);
    assert_eq!(t, "route 10.20.30.1/24 og https://10.20.30.1:443/x");
    assert!(a.is_empty(), "{a:?}");
}

#[test]
fn q6_7_escaped_i_json_og_url_kodet() {
    let s = sag();
    let (t, a) = arter(r#"{"konto": "NB01\\user0001", "q": "mail=user0001%40d02.example"}"#, &s);
    assert_eq!(t, r#"{"konto": "KONTOR\\bruger022", "q": "mail=bruger022%40eksempel.dk"}"#);
    assert!(a.contains(&AdvarselArt::AfledtForm(AfledtArt::Escaped)), "{a:?}");
    assert!(a.contains(&AdvarselArt::AfledtForm(AfledtArt::UrlKodet)), "{a:?}");
}

#[test]
fn q6_8_kode_brudt_over_linjer() {
    let s = sag();
    let (t, a) = demasker("vaert h00\n01", &s);
    assert_eq!(t, "vaert h00\n01", "en brudt kode genkendes ikke");
    assert!(a.iter().any(|x| x.art == AdvarselArt::IkkeBrugt && x.kode == "h0001"));
}

#[test]
fn q6_9_koder_der_ikke_forekommer() {
    let s = sag();
    let (_, a) = demasker("kun 198.18.0.1", &s);
    let ikke: Vec<&str> = a
        .iter()
        .filter(|x| x.art == AdvarselArt::IkkeBrugt)
        .map(|x| x.kode.as_str())
        .collect();
    assert_eq!(ikke.len(), s.antal_poster() - 1);
    assert!(ikke.contains(&"h0002") && !ikke.contains(&"198.18.0.1"));
}

#[test]
fn q6_10_ligner_en_anden_sag() {
    let s = sag();
    let (_, a) = arter("h0101 h0102 user0103 198.18.0.200 db0007", &s);
    assert!(a.contains(&AdvarselArt::LignerAndenSag), "{a:?}");
}

#[test]
fn uaendret_tekst_giver_ingen_advarsler() {
    let mut s = Sag::default();
    let k = kaede(ORIGINAL, &ordbog(), &mut s);
    assert_eq!(k.tilbage, ORIGINAL);
    assert!(k.advarsler.is_empty(), "{:?}", k.advarsler);
}
