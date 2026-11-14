//! V-OPBYG.5 i kernen. Kun opdigtede værdier (`eksempel-firma.example`, opfundne navne og koder).
//!
//! - N1: lækagetjekket melder ikke en værdi, der kun består af sagens koder og skilletegn (`Db= h0001.d01.example`), men
//!   stadig den del af en værdi, der ikke er en kode. De tre andre klasser fra HANDOFF-V-OPBYG.4 (sideeffekt-fund 1) har
//!   hver en test, der viser, hvad kernen gør; `sn:` sidst på en linje tager ikke længere næste linje med.
//! - N2: `Sag::slet_post` sletter en post (stavemåde og kode), dens gamle koder og enheden, hvis den ikke har flere
//!   stavemåder. Koden gives aldrig igen, og demaskeringen melder den som ukendt (også brugerens egen kode uden kodeform).

mod faelles;

use faelles::kaede;
use grimnir_core::{analyser, demasker, laekagetjek, AdvarselArt, Art, Fejl, Klasse, Ordbog, RestArt, Sag};

const MAIL: &str = "bo.proeve@eksempel-firma.example";

/// Resterne som (tekst, art).
fn rester(maskeret: &str, sag: &Sag, o: &Ordbog) -> Vec<(String, RestArt)> {
    laekagetjek(maskeret, sag, o)
        .iter()
        .map(|r| (maskeret[r.start..r.slut].to_string(), r.art))
        .collect()
}

// ─────────────────────────────────────────────────────────────── N1: lækagetjekket og `Db=` + koder

/// Fra egenskabstesten (HANDOFF-V-OPBYG.4, sideeffekt-fund 1): `Db=` gør hele FQDN'et til en database, det maskeres til
/// en værtskode og en domænekode, og lækagetjekket meldte koden selv som et nyt fund.
#[test]
fn n1_db_foran_et_fqdn_giver_ingen_rest() {
    let o = Ordbog::ny();
    for t in [
        format!("{MAIL}\nDb= srv-db02.eksempel-firma.example \n"),
        format!("{MAIL}\ndatabase=srv-db02.intern.eksempel-firma.example;\n"),
        format!("{MAIL}\nDB=PC-17.eksempel-firma.example\n"),
    ] {
        let mut sag = Sag::default();
        let k = kaede(&t, &o, &mut sag);
        assert_eq!(k.tilbage, t, "rundturen er bytepræcis");
        assert!(
            k.rester.is_empty(),
            "{}: {:?}",
            k.maskeret,
            k.rester.iter().map(|r| &k.maskeret[r.start..r.slut]).collect::<Vec<_>>()
        );
        assert!(!k.maskeret.contains("eksempel-firma"), "{}", k.maskeret);
    }
}

/// En værdi, der består af en kode og noget, der ikke er en kode, er stadig en rest for den del.
#[test]
fn n1_en_kode_og_en_rigtig_original_er_stadig_en_rest() {
    let o = Ordbog::ny();
    let t = format!("{MAIL}\nsrv-db02.eksempel-firma.example\n");
    let mut sag = Sag::default();
    let k = kaede(&t, &o, &mut sag);
    assert!(k.rester.is_empty());
    assert_eq!(k.maskeret, "user0001@d01.example\nh0001.d01.example\n");
    // Tilføjet efter maskeringen (fx skrevet ind i svaret): koden og noget nyt efter et nøgleord.
    let ny = |x: &str| format!("{}{x}\n", k.maskeret);
    assert_eq!(rester(&ny("Db= h0001.prod7"), &sag, &o), [("prod7".to_string(), RestArt::NytFund(Art::Database))]);
    assert_eq!(rester(&ny("Db= kunde7.d01.example"), &sag, &o), [("kunde7".to_string(), RestArt::NytFund(Art::Database))]);
    // En af sagens originaler ved siden af koden: originalen (trin 1).
    assert_eq!(rester(&ny("Db= h0001.srv-db02"), &sag, &o), [("srv-db02".to_string(), RestArt::Original(Klasse::Vaert))]);
    // Kun koder og skilletegn: ingen rest, også med koden alene.
    for x in ["Db= h0001.d01.example", "Db= h0001", "db=d01.example", "Db= h0001.d01.example;user0001"] {
        assert!(rester(&ny(x), &sag, &o).is_empty(), "{x}");
    }
}

/// Et fund, der ikke rører en kode, meldes som før med hele sit spænd.
#[test]
fn n1_et_fund_uden_koder_meldes_som_foer() {
    let o = Ordbog::ny();
    let t = format!("{MAIL}\n");
    let mut sag = Sag::default();
    let k = kaede(&t, &o, &mut sag);
    let ny = format!("{}Db= lager-prod;\n", k.maskeret);
    assert_eq!(rester(&ny, &sag, &o), [("lager-prod".to_string(), RestArt::NytFund(Art::Database))]);
}

// ─────────────────────────────────────────────────────────────── N1: de tre andre klasser

/// `IX\1` er NetBIOS-domænet `IX` med brugeren `1`; `Ix` alene et andet sted er en rest (reglen om to tegn fra V-KERNE.2:
/// et navn på to tegn meldes, så brugeren selv kan afgøre det). Kernen er ikke ændret for den.
#[test]
fn n1_klasse_netbios_paa_to_tegn_giver_en_rest_for_det_samme_ord_alene() {
    let o = Ordbog::ny();
    let t = format!("{MAIL}\nIx srv-db02.eksempel-firma.example IX\\1 \n");
    let mut sag = Sag::default();
    let k = kaede(&t, &o, &mut sag);
    assert_eq!(k.tilbage, t);
    assert!(k.maskeret.contains("NB01\\user0002"), "{}", k.maskeret);
    let r: Vec<(&str, RestArt)> = k.rester.iter().map(|r| (&k.maskeret[r.start..r.slut], r.art)).collect();
    assert_eq!(r, [("Ix", RestArt::Original(Klasse::Netbios))], "{}", k.maskeret);
}

/// `uId:443` gør 443 til en bruger (`uid` er et nøgleord); `:443` et andet sted er en rest af klassen Bruger, som
/// `pWD:443` er det for en hemmelighed (V-OPBYG.4). Kernen er ikke ændret for den.
#[test]
fn n1_klasse_uid_gor_et_tal_til_en_bruger_og_tallet_et_andet_sted_er_en_rest() {
    let o = Ordbog::ny();
    let t = format!("{MAIL}\nsrv-db02.eksempel-firma.example:443 uId:443 \n");
    let mut sag = Sag::default();
    let k = kaede(&t, &o, &mut sag);
    assert_eq!(k.tilbage, t);
    assert!(k.maskeret.contains("uId:user0002"), "{}", k.maskeret);
    let r: Vec<(&str, RestArt)> = k.rester.iter().map(|r| (&k.maskeret[r.start..r.slut], r.art)).collect();
    assert_eq!(r, [("443", RestArt::Original(Klasse::Bruger))], "{}", k.maskeret);
}

/// Rettet i V-OPBYG.5: `sn:` sidst på en linje gjorde datoen først på næste linje til et serienummer, og datoen et andet
/// sted blev en rest. Nu står serienummeret på samme linje som nøgleordet.
#[test]
fn n1_klasse_sn_sidst_paa_en_linje_tager_ikke_naeste_linje() {
    let o = Ordbog::ny();
    for brud in ["\n", "\r\n"] {
        let t = format!("{MAIL}\nsn:{brud}2026-11-10 08:00:00 dc01 fejl: x\n2026-11-10 \n");
        let f = analyser(&t, &o);
        assert!(f.iter().all(|x| x.art != Art::Serienummer), "{:?}", f.iter().map(|x| (&t[x.start..x.slut], x.art)).collect::<Vec<_>>());
        let mut sag = Sag::default();
        let k = kaede(&t, &o, &mut sag);
        assert_eq!(k.tilbage, t);
        assert!(k.rester.is_empty(), "{}", k.maskeret);
        assert!(k.maskeret.contains("2026-11-10 08:00:00 h0001"), "{}", k.maskeret);
    }
}

/// Et serienummer på samme linje findes stadig, også med mellemrum eller tabulator efter `:` og `=`.
#[test]
fn n1_serienummer_paa_samme_linje_findes_stadig() {
    let o = Ordbog::ny();
    for (t, v) in [
        ("sn: FX12AB34\n", "FX12AB34"),
        ("SN:\tQ7W8E9R0\n", "Q7W8E9R0"),
        ("serial = \"ABC-1234\"\n", "ABC-1234"),
        ("devid=FGT60F0000000001\n", "FGT60F0000000001"),
    ] {
        let f = analyser(t, &o);
        assert!(
            f.iter().any(|x| x.art == Art::Serienummer && &t[x.start..x.slut] == v),
            "{t:?}: {:?}",
            f.iter().map(|x| (&t[x.start..x.slut], x.art)).collect::<Vec<_>>()
        );
    }
}

// ─────────────────────────────────────────────────────────────── N2: slet en post

/// De ukendte koder i en demaskering som tekst.
fn ukendte(tekst: &str, sag: &Sag) -> (String, Vec<String>) {
    let (ud, adv) = demasker(tekst, sag);
    let u = adv
        .iter()
        .filter(|a| matches!(a.art, AdvarselArt::UkendtKode | AdvarselArt::UkendtAdresseISagensNet))
        .map(|a| tekst[a.start..a.slut].to_string())
        .collect();
    (ud, u)
}

#[test]
fn n2_en_slettet_kode_demaskeres_ikke_og_meldes_som_ukendt() {
    let o = Ordbog::ny();
    let t = format!("{MAIL}\nsrv-db02.eksempel-firma.example og pc-17.eksempel-firma.example\n");
    let mut sag = Sag::default();
    let k = kaede(&t, &o, &mut sag);
    assert_eq!(k.tilbage, t);
    let kode = sag.kode_for_original(Klasse::Vaert, "srv-db02").expect("en kode").to_string();
    let antal = sag.antal_poster();
    let (post, enhed) = sag.slet_post(&kode).unwrap();
    assert_eq!(post.original.som_tekst(), "srv-db02");
    assert!(enhed.is_some(), "enheden havde kun den stavemåde");
    assert_eq!(sag.antal_poster(), antal - 1);
    assert!(sag.opslag(&kode).is_none());
    assert!(sag.er_slettet(&kode) && sag.er_slettet(&kode.to_ascii_uppercase()));
    assert_eq!(sag.data().slettede_koder, std::slice::from_ref(&kode));
    // Den gamle maskerede tekst: koden står urørt og meldes som ukendt; resten demaskeres som før.
    let (ud, u) = ukendte(&k.maskeret, &sag);
    assert_eq!(u, std::slice::from_ref(&kode));
    assert_eq!(ud, t.replace("srv-db02", &kode), "kun den slettede kode står tilbage");
}

#[test]
fn n2_en_slettet_kode_gives_aldrig_igen() {
    let o = Ordbog::ny();
    let t = format!("{MAIL}\nsrv-db02.eksempel-firma.example\n");
    let mut sag = Sag::default();
    kaede(&t, &o, &mut sag);
    let kode = sag.kode_for_original(Klasse::Vaert, "srv-db02").unwrap().to_string();
    sag.slet_post(&kode).unwrap();
    // Samme værdi igen: en ny kode.
    let k2 = kaede(&t, &o, &mut sag);
    let ny = sag.kode_for_original(Klasse::Vaert, "srv-db02").unwrap().to_string();
    assert_ne!(ny.to_ascii_lowercase(), kode.to_ascii_lowercase());
    assert_eq!(k2.tilbage, t);
    // En anden værdi får den heller ikke, og brugeren kan ikke give den (heller ikke med andre store/små bogstaver).
    let t3 = format!("{MAIL}\nfw-nord01.eksempel-firma.example\n");
    kaede(&t3, &o, &mut sag);
    let fw = sag.kode_for_original(Klasse::Vaert, "fw-nord01").unwrap().to_string();
    assert_ne!(fw.to_ascii_lowercase(), kode.to_ascii_lowercase());
    for k in [kode.clone(), kode.to_ascii_uppercase()] {
        assert!(matches!(sag.ret(&fw, &k, ""), Err(Fejl::KodeKolliderer { .. })), "{k}");
    }
}

#[test]
fn n2_brugerens_egen_kode_og_dens_gamle_kode_meldes_som_ukendte() {
    let o = Ordbog::ny();
    let t = format!("{MAIL}\nsrv-db02.eksempel-firma.example\n");
    let mut sag = Sag::default();
    let k = kaede(&t, &o, &mut sag);
    let auto = sag.kode_for_original(Klasse::Vaert, "srv-db02").unwrap().to_string();
    sag.ret(&auto, "kunde7", &t).unwrap();
    let ny_maskeret = k.maskeret.replace(&auto, "kunde7");
    sag.slet_post("kunde7").unwrap();
    let mut sl = sag.data().slettede_koder.clone();
    sl.sort();
    let mut forventet = vec![auto.clone(), "kunde7".to_string()];
    forventet.sort();
    assert_eq!(sl, forventet, "koden og den gamle kode (alias)");
    assert_eq!(ukendte(&ny_maskeret, &sag).1, ["kunde7"], "brugerens egen kode uden kodeform");
    assert_eq!(ukendte(&k.maskeret, &sag).1, std::slice::from_ref(&auto), "den gamle kode");
    assert_eq!(ukendte("svar fra KUNDE7 i dag\n", &sag).1, ["KUNDE7"], "uden hensyn til store/små bogstaver");
    assert!(ukendte("kunde77 og xkunde7\n", &sag).1.is_empty(), "kun ved en grænse");
}

#[test]
fn n2_en_stavemaade_slettes_og_enheden_og_de_andre_bliver() {
    let o = Ordbog::ny();
    let t = format!("{MAIL}\nsrv-db02.eksempel-firma.example SRV-DB02.eksempel-firma.example\n");
    let mut sag = Sag::default();
    let k = kaede(&t, &o, &mut sag);
    let smaa = sag.kode_for_original(Klasse::Vaert, "srv-db02").unwrap().to_string();
    let store = sag.kode_for_original(Klasse::Vaert, "SRV-DB02").unwrap().to_string();
    let (_, enhed) = sag.slet_post(&store).unwrap();
    assert!(enhed.is_none(), "enheden har stadig en stavemåde");
    assert_eq!(sag.opslag(&smaa).map(|x| x.som_tekst().to_string()).as_deref(), Some("srv-db02"));
    let (ud, u) = ukendte(&k.maskeret, &sag);
    assert_eq!(u, std::slice::from_ref(&store));
    assert!(ud.contains("srv-db02.eksempel-firma.example") && ud.contains(&format!("{store}.eksempel-firma.example")), "{ud}");
    // Den store stavemåde igen: enheden er den samme, men koden er en anden end den slettede.
    kaede(&t, &o, &mut sag);
    let igen = sag.kode_for_original(Klasse::Vaert, "SRV-DB02").unwrap().to_string();
    assert_ne!(igen, store);
}

#[test]
fn n2_gamle_koder_for_senere_poster_peger_stadig_paa_den_rigtige_vaerdi() {
    let o = Ordbog::ny();
    let t = format!("{MAIL}\nsrv-db02.eksempel-firma.example og pc-17.eksempel-firma.example\n");
    let mut sag = Sag::default();
    let k = kaede(&t, &o, &mut sag);
    let pc = sag.kode_for_original(Klasse::Vaert, "pc-17").unwrap().to_string();
    sag.ret(&pc, "kunde9", &t).unwrap();
    // Den første post slettes; pc-17's plads rykker, og dens gamle kode skal stadig pege på pc-17.
    let foerste = sag.data().poster[0].kode.clone();
    sag.slet_post(&foerste).unwrap();
    assert_eq!(sag.opslag(&pc).map(|x| x.som_tekst().to_string()).as_deref(), Some("pc-17"));
    assert_eq!(sag.opslag("kunde9").map(|x| x.som_tekst().to_string()).as_deref(), Some("pc-17"));
    assert!(demasker(&k.maskeret, &sag).0.contains("pc-17.eksempel-firma.example"));
}

#[test]
fn n2_sagen_kan_genskabes_med_slettede_koder_og_ugyldige_afvises() {
    let o = Ordbog::ny();
    let t = format!("{MAIL}\nsrv-db02.eksempel-firma.example\n");
    let mut sag = Sag::default();
    kaede(&t, &o, &mut sag);
    let kode = sag.kode_for_original(Klasse::Vaert, "srv-db02").unwrap().to_string();
    sag.slet_post(&kode).unwrap();
    let igen = Sag::fra_data(sag.data().clone()).unwrap();
    assert!(igen.er_slettet(&kode));
    assert_eq!(igen.data().slettede_koder, [kode]);
    // En slettet kode, der stadig er en af sagens koder, hænger ikke sammen.
    let mut d = igen.data().clone();
    let i_brug = d.poster[0].kode.clone();
    d.slettede_koder.push(i_brug);
    assert!(Sag::fra_data(d).is_err());
    // En kode, sagen ikke har, kan ikke slettes; et alias alene heller ikke.
    let mut s2 = Sag::fra_data(sag.data().clone()).unwrap();
    assert!(matches!(s2.slet_post("h9999"), Err(Fejl::UkendtKode { .. })));
}

#[test]
fn n2_en_slettet_adresse_meldes_som_ukendt_adresse_i_sagens_net() {
    let o = Ordbog::ny();
    let t = "fra 10.20.30.11 til 10.20.30.12\n";
    let mut sag = Sag::default();
    let k = kaede(t, &o, &mut sag);
    let kode = sag.kode_for_original(Klasse::Ipv4, "10.20.30.11").unwrap().to_string();
    sag.slet_post(&kode).unwrap();
    let (ud, u) = ukendte(&k.maskeret, &sag);
    assert_eq!(u, std::slice::from_ref(&kode));
    assert!(ud.contains("10.20.30.12") && !ud.contains("10.20.30.11"), "{ud}");
    // Samme adresse igen får ikke den slettede kode.
    kaede(t, &o, &mut sag);
    assert_ne!(sag.kode_for_original(Klasse::Ipv4, "10.20.30.11").unwrap(), kode);
}
