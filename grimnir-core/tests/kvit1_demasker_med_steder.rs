//! V-KVIT.1 N3 (kernetesten, der manglede fra V-PUDS.1 N4): `demasker_med_steder` direkte. Antal steder og første
//! position for koden, for et alias og for koden med andre store/små bogstaver; en kode, der er en del af en anden
//! (overlap); og at `demasker` og `demasker_med_steder` giver samme tekst og samme advarsler. Kun opdigtede data.

mod faelles;

use faelles::{kaede, ordbog};
use grimnir_core::{demasker, demasker_med_steder, Advarsel, AdvarselArt, AfledtArt, Sag, SatTilbage};

const ORIGINAL: &str = "gw=10.20.30.1 vaert=srv-068.intern.kontor.test og srv-002 KONTOR\\bruger022 mail bruger022@kontor.test";

/// Sagen fra k5_demaskering.rs. Koder: 10.20.30.1 → 198.18.0.1, srv-068 → h0001, intern.kontor.test → d01.example,
/// srv-002 → h0002, KONTOR → NB01, bruger022 → user0001, kontor.test → d02.example.
fn sag() -> Sag {
    let mut sag = Sag::default();
    let k = kaede(ORIGINAL, &ordbog(), &mut sag);
    assert_eq!(
        k.maskeret,
        "gw=198.18.0.1 vaert=h0001.d01.example og h0002 NB01\\user0001 mail user0001@d02.example"
    );
    sag
}

/// Postens nummer for en kode.
fn post(sag: &Sag, kode: &str) -> usize {
    sag.data()
        .poster
        .iter()
        .position(|p| p.kode == kode)
        .unwrap_or_else(|| panic!("{kode} findes ikke"))
}

/// En advarsel uden forslagets original (kun om der er et).
fn flad(a: &[Advarsel]) -> Vec<(AdvarselArt, usize, usize, String, Option<String>)> {
    a.iter()
        .map(|x| {
            (
                x.art,
                x.start,
                x.slut,
                x.kode.clone(),
                x.forslag.as_ref().map(|o| o.som_tekst().to_string()),
            )
        })
        .collect()
}

/// Kører begge funktioner, kræver samme tekst og samme advarsler, og svarer med teksten, advarslerne og stederne.
fn begge(tekst: &str, sag: &Sag) -> (String, Vec<Advarsel>, Vec<SatTilbage>) {
    let (ud, adv, steder) = demasker_med_steder(tekst, sag);
    let (ud2, adv2) = demasker(tekst, sag);
    assert_eq!(ud, ud2, "samme tekst");
    assert_eq!(flad(&adv), flad(&adv2), "samme advarsler");
    // Stederne står i postens rækkefølge, højst én gang pr. post, og hver har mindst ét sted inde i teksten.
    assert!(steder.windows(2).all(|w| w[0].post < w[1].post), "{steder:?}");
    assert!(
        steder
            .iter()
            .all(|s| s.antal > 0 && s.foerste < tekst.len() && s.post < sag.antal_poster()),
        "{steder:?}"
    );
    (ud, adv, steder)
}

fn sted(post: usize, antal: usize, foerste: usize) -> SatTilbage {
    SatTilbage { post, antal, foerste }
}

#[test]
fn antal_og_foerste_position_for_koden() {
    let s = sag();
    let tekst = "a h0002 b h0002\nc 198.18.0.1 h0002";
    let (ud, _, steder) = begge(tekst, &s);
    assert_eq!(ud, "a srv-002 b srv-002\nc 10.20.30.1 srv-002");
    // Adressen er sagens første post, maskinen en senere; positionerne er bytes i den maskerede tekst.
    assert_eq!(
        steder,
        [
            sted(post(&s, "198.18.0.1"), 1, tekst.find("198.18.0.1").unwrap()),
            sted(post(&s, "h0002"), 3, 2)
        ]
    );
    assert_eq!(tekst.find("198.18.0.1"), Some(18));
    // Positionen er i bytes, også efter tegn, der fylder mere end én byte.
    let (_, _, steder) = begge("æøå h0002", &s);
    assert_eq!(steder, [sted(post(&s, "h0002"), 1, 7)]);
}

#[test]
fn en_tekst_uden_koder_og_en_tom_sag() {
    let s = sag();
    let (ud, adv, steder) = begge("ingen koder her", &s);
    assert_eq!(ud, "ingen koder her");
    assert!(steder.is_empty());
    assert_eq!(adv.iter().filter(|a| a.art == AdvarselArt::IkkeBrugt).count(), s.antal_poster());
    let (ud, adv, steder) = begge("h0002 198.18.0.1", &Sag::default());
    assert_eq!(ud, "h0002 198.18.0.1");
    assert!(
        steder.is_empty() && adv.iter().all(|a| a.art == AdvarselArt::UkendtKode),
        "{:?}",
        flad(&adv)
    );
    let (ud, adv, steder) = begge("", &s);
    assert!(ud.is_empty() && steder.is_empty());
    assert_eq!(adv.len(), s.antal_poster());
}

#[test]
fn hele_den_maskerede_tekst_hvert_sted_taelles_en_gang() {
    let mut s = Sag::default();
    let k = kaede(ORIGINAL, &ordbog(), &mut s);
    let (ud, adv, steder) = begge(&k.maskeret, &s);
    assert_eq!(ud, ORIGINAL);
    assert!(adv.is_empty(), "{:?}", flad(&adv));
    // Syv poster; brugeren står to steder, resten ét. Maskinen og dens domæne (`h0001.d01.example`) er to poster.
    let ventet: Vec<SatTilbage> = [
        ("198.18.0.1", 1),
        ("h0001", 1),
        ("d01.example", 1),
        ("h0002", 1),
        ("NB01", 1),
        ("user0001", 2),
        ("d02.example", 1),
    ]
    .iter()
    .map(|&(kode, antal)| sted(post(&s, kode), antal, k.maskeret.find(kode).unwrap()))
    .collect();
    let mut sorteret = ventet.clone();
    sorteret.sort_by_key(|x| x.post);
    assert_eq!(steder, sorteret);
    assert_eq!(steder.iter().map(|x| x.antal).sum::<usize>(), 8);
}

#[test]
fn et_alias_taeller_med_til_posten() {
    // Koden rettes efter en maskering: den gamle kode er et alias for samme post (D18).
    let mut s = sag();
    s.ret("h0002", "fw-ydre", "").expect("rettelsen er fri");
    let p = post(&s, "fw-ydre");
    assert_eq!(s.data().aliaser, [("h0002".to_string(), p)]);
    let tekst = "x h0002 og fw-ydre og h0002";
    let (ud, adv, steder) = begge(tekst, &s);
    assert_eq!(ud, "x srv-002 og srv-002 og srv-002");
    assert_eq!(
        steder,
        [sted(p, 3, 2)],
        "aliaset og koden er samme post; det første sted er aliasets"
    );
    assert!(adv.iter().all(|a| a.art == AdvarselArt::IkkeBrugt), "{:?}", flad(&adv));
    // Kun aliaset i teksten: posten er sat tilbage og meldes ikke som ikke brugt.
    let (ud, adv, steder) = begge("kun h0002", &s);
    assert_eq!(ud, "kun srv-002");
    assert_eq!(steder, [sted(p, 1, 4)]);
    assert!(!adv.iter().any(|a| a.art == AdvarselArt::IkkeBrugt && a.kode == "fw-ydre"));
}

#[test]
fn koden_med_andre_store_og_smaa_bogstaver_taeller_med() {
    let s = sag();
    let p = post(&s, "h0002");
    let tekst = "H0002 og h0002 og H0002";
    let (ud, adv, steder) = begge(tekst, &s);
    assert_eq!(ud, "SRV-002 og srv-002 og SRV-002");
    assert_eq!(steder, [sted(p, 3, 0)], "det første sted er det med store bogstaver");
    let anden: Vec<(usize, usize)> = adv
        .iter()
        .filter(|a| a.art == AdvarselArt::AfledtForm(AfledtArt::AndenStavemaade))
        .map(|a| (a.start, a.slut))
        .collect();
    assert_eq!(anden, [(0, 5), (18, 23)]);
    // Kun den anden stavemåde: stedet tælles, og posten er brugt.
    let (ud, adv, steder) = begge("ping H0002", &s);
    assert_eq!(ud, "ping SRV-002");
    assert_eq!(steder, [sted(p, 1, 5)]);
    assert!(!adv.iter().any(|a| a.art == AdvarselArt::IkkeBrugt && a.kode == "h0002"));
    // Et alias med andre store/små bogstaver hører også til posten.
    let mut s = sag();
    s.ret("h0002", "fw-ydre", "").unwrap();
    let p = post(&s, "fw-ydre");
    let (ud, _, steder) = begge("H0002 fw-ydre", &s);
    assert_eq!(ud, "SRV-002 srv-002");
    assert_eq!(steder, [sted(p, 2, 0)]);
}

#[test]
fn overlap_en_kode_der_er_en_del_af_en_anden() {
    // To koder, hvor den ene er begyndelsen af den anden: hvert sted tælles én gang, for den post, der blev sat tilbage.
    let mut s = sag();
    s.ret("h0001", "fw", "").expect("fw er fri");
    s.ret("h0002", "fw-ydre", "").expect("fw-ydre er fri");
    let (kort, lang) = (post(&s, "fw"), post(&s, "fw-ydre"));
    let tekst = "fw-ydre fw fw-ydre fw";
    let (ud, _, steder) = begge(tekst, &s);
    assert_eq!(ud, "srv-002 srv-068 srv-002 srv-068");
    let mut ventet = [sted(kort, 2, 8), sted(lang, 2, 0)];
    ventet.sort_by_key(|x| x.post);
    assert_eq!(steder, ventet);
    assert_eq!(steder.iter().map(|x| x.antal).sum::<usize>(), 4, "fire steder, ingen talt to gange");
    // Koder lige efter hinanden (maskine.domæne, bruger@domæne) er hver sit sted.
    let s = sag();
    let tekst = "h0001.d01.example user0001@d02.example";
    let (ud, _, steder) = begge(tekst, &s);
    assert_eq!(ud, "srv-068.intern.kontor.test bruger022@kontor.test");
    let mut ventet = [
        sted(post(&s, "h0001"), 1, 0),
        sted(post(&s, "d01.example"), 1, 6),
        sted(post(&s, "user0001"), 1, 18),
        sted(post(&s, "d02.example"), 1, 27),
    ];
    ventet.sort_by_key(|x| x.post);
    assert_eq!(steder, ventet);
}
