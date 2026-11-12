//! V-MANUEL.1: værdier, brugeren selv peger på i teksten ("Maskér dette", `Ordbog::tilfoejede`). Kun opdigtede data.

mod faelles;

use faelles::{kaede, tekster};
use grimnir_core::{analyser, demasker, foreslaa_med_ordbog, laekagetjek, masker, Art, Klasse, Ordbog, RestArt, Sag, Sikkerhed};

fn med(liste: &[(&str, Art)]) -> Ordbog {
    let mut o = Ordbog::ny();
    o.tilfoejede = liste.iter().map(|(v, a)| (v.to_string(), *a)).collect();
    o
}

#[test]
fn en_tilfoejet_vaerdi_findes_alle_steder_ved_en_graense() {
    // Bogstaver og cifre lige før eller efter gør det til et længere ord; mellemrum, tegnsætning, _ og - er grænser.
    let t = "login jdoe ok\njdoe2 nej, xjdoe nej, JDoe ja, (jdoe) ja, jdoe_tmp ja, jdoe-01 ja";
    let fund = analyser(t, &med(&[("jdoe", Art::Bruger)]));
    let fundne = tekster(t, &fund);
    assert_eq!(fundne, ["jdoe", "JDoe", "jdoe", "jdoe", "jdoe"], "{fundne:?}");
    assert!(fund
        .iter()
        .all(|f| f.art == Art::Bruger && f.sikkerhed == Sikkerhed::Sikker && !f.afledt && f.del_af.is_none()));
    // jdoe2 og xjdoe er ikke taget med.
    let pos: Vec<usize> = fund.iter().map(|f| f.start).collect();
    assert!(!pos.contains(&t.find("jdoe2").unwrap()) && !pos.contains(&(t.find("xjdoe").unwrap() + 1)));
}

#[test]
fn store_og_smaa_bogstaver_er_samme_enhed_og_kommer_tilbage_som_de_stod() {
    let t = "jdoe og JDOE og JDoe";
    let o = med(&[("JDoe", Art::Bruger)]);
    let mut sag = Sag::default();
    let k = kaede(t, &o, &mut sag);
    assert_eq!(tekster(t, &k.fund), ["jdoe", "JDOE", "JDoe"]);
    assert_eq!(sag.data().enheder.len(), 1, "én enhed for alle tre stavemåder");
    assert!(!k.maskeret.to_ascii_lowercase().contains("jdoe"), "{}", k.maskeret);
    assert_eq!(k.tilbage, t);
    assert!(k.rester.is_empty());
}

#[test]
fn typen_giver_kodens_form() {
    let former = [
        (Art::Vaert, "h0001"),
        (Art::Bruger, "user0001"),
        (Art::Domaene, "d01.example"),
        (Art::NetbiosDomaene, "nb01"),
        (Art::Person, "person 0001"),
        (Art::Database, "db0001"),
        (Art::Ord, "ord0001"),
        (Art::Serienummer, "sn0001"),
    ];
    for (art, kode) in former {
        let t = "fra bxq77 til bxq77.";
        let o = med(&[("bxq77", art)]);
        let mut sag = Sag::default();
        let k = kaede(t, &o, &mut sag);
        assert_eq!(k.maskeret, format!("fra {kode} til {kode}."), "{art:?}");
        assert_eq!(k.tilbage, t, "{art:?}");
        assert_eq!(sag.data().enheder[0].klasse, art.klasse());
    }
}

#[test]
fn kun_navnearter_kan_tilfoejes() {
    let ja = [
        Art::Vaert,
        Art::Domaene,
        Art::NetbiosDomaene,
        Art::Bruger,
        Art::Person,
        Art::Database,
        Art::Ord,
        Art::Serienummer,
    ];
    let nej = [
        Art::Ipv4Egen,
        Art::Ipv4Fremmed,
        Art::Ipv6Egen,
        Art::Ipv6Fremmed,
        Art::Mac,
        Art::Hemmelighed,
        Art::Sid,
        Art::Guid,
        Art::Cpr,
        Art::Entropi,
        Art::LignerKode,
    ];
    assert!(ja.iter().all(|a| Ordbog::kan_tilfoejes(*a)));
    assert!(nej.iter().all(|a| !Ordbog::kan_tilfoejes(*a)));
    // En art, der ikke kan tilføjes, springes over: teksten har intet fund.
    let t = "abc xyz";
    for a in nej {
        assert!(analyser(t, &med(&[("xyz", a)])).is_empty(), "{a:?}");
    }
}

#[test]
fn tomme_vaerdier_og_linjeskift_afvises_og_mellemrum_i_enderne_skaeres_af() {
    let t = "a jd\noe b\r\nc jdoe d";
    let o = med(&[
        ("", Art::Ord),
        ("   ", Art::Ord),
        ("jd\noe", Art::Ord),
        ("b\r\nc", Art::Ord),
        ("\tjdoe  ", Art::Bruger),
    ]);
    let fund = analyser(t, &o);
    assert_eq!(tekster(t, &fund), ["jdoe"]);
    assert_eq!(fund[0].art, Art::Bruger);
}

#[test]
fn overlap_afgoeres_som_for_andre_fund_laengste_spaend_vinder() {
    let mut o = med(&[("srv", Art::Vaert), ("kontor", Art::Ord)]);
    o.domaener = vec!["kontor.test".into()];
    // I FQDN'et er "srv" og "kontor" en del af et længere fund og tages ikke med; alene tages de med.
    let t = "fqdn srv-068.kontor.test; alene srv og kontor";
    let fund = analyser(t, &o);
    let fundne = tekster(t, &fund);
    assert_eq!(fundne.iter().filter(|x| **x == "srv").count(), 1, "{fundne:?}");
    assert_eq!(fundne.iter().filter(|x| **x == "kontor").count(), 1, "{fundne:?}");
    let alene = t.rfind("srv").unwrap();
    assert!(fund.iter().any(|f| f.start == alene && f.art == Art::Vaert));
    // Ingen tilføjet værdi i FQDN'et: dér er de genkendte dele.
    let fqdn = t.find("srv-068").unwrap();
    assert!(fund
        .iter()
        .filter(|f| f.start >= fqdn && f.slut <= fqdn + "srv-068.kontor.test".len())
        .all(|f| f.art != Art::Ord));
    let mut sag = Sag::default();
    let k = kaede(t, &o, &mut sag);
    assert_eq!(k.tilbage, t);
}

#[test]
fn en_tilfoejet_vaerdi_vinder_over_ordbogens_ord_med_samme_spaend() {
    let mut o = med(&[("jdoe", Art::Bruger)]);
    o.ord = vec!["jdoe".into()];
    let fund = analyser("hej jdoe", &o);
    assert_eq!(fund.len(), 1);
    assert_eq!((fund[0].art, fund[0].sikkerhed), (Art::Bruger, Sikkerhed::Sikker));
}

#[test]
fn maskér_aldrig_vinder_ogsaa_over_en_tilfoejet_vaerdi() {
    let mut o = med(&[("jdoe", Art::Bruger)]);
    o.aldrig = vec!["JDOE".into()];
    assert!(analyser("hej jdoe", &o).is_empty());
}

#[test]
fn et_kort_ord_tages_med_ved_hver_graense() {
    let t = "a b a-c ab ba a.";
    let fund = analyser(t, &med(&[("a", Art::Ord)]));
    assert_eq!(fund.len(), 3, "{:?}", tekster(t, &fund));
    let mut sag = Sag::default();
    assert_eq!(kaede(t, &med(&[("a", Art::Ord)]), &mut sag).tilbage, t);
}

#[test]
fn laekagetjekket_fanger_en_tilfoejet_vaerdi_der_staar_tilbage() {
    let t = "bruger jdoe loggede ind fra pc-17";
    let o = med(&[("jdoe", Art::Bruger)]);
    // Maskeret uden den tilføjede værdi (fx med en ældre analyse): lækagetjekket med den finder den.
    let mut sag = Sag::default();
    let uden = analyser(t, &Ordbog::ny());
    let e = foreslaa_med_ordbog(&uden, t, &mut sag, &Ordbog::ny());
    let maskeret = masker(t, &e);
    let rester = laekagetjek(&maskeret, &sag, &o);
    let pos = maskeret.find("jdoe").expect("står tilbage");
    assert!(
        rester.iter().any(|r| r.start == pos && r.art == RestArt::NytFund(Art::Bruger)),
        "{rester:?}"
    );
    // Og en tilføjet værdi, sagen kender fra en tidligere tekst, findes som en af sagens originaler.
    let mut sag = Sag::default();
    let k = kaede("jdoe", &o, &mut sag);
    assert!(k.rester.is_empty());
    let rester = laekagetjek("igen jdoe", &sag, &Ordbog::ny());
    assert!(rester.iter().any(|r| r.art == RestArt::Original(Klasse::Bruger)), "{rester:?}");
}

#[test]
fn maskér_og_demaskér_med_tilfoejede_og_ordbogen_giver_originalen() {
    let mut o = faelles::ordbog();
    o.tilfoejede = vec![
        ("jdoe".into(), Art::Bruger),
        ("Fjordhuset".into(), Art::Ord),
        ("pc-17".into(), Art::Vaert),
    ];
    let t = "ssh jdoe@srv-068.intern.kontor.test fra pc-17\r\nFjordhuset: JDOE, Projekt Uglebo, 10.20.30.1\n";
    let mut sag = Sag::default();
    let k = kaede(t, &o, &mut sag);
    assert!(
        !k.maskeret.contains("Fjordhuset") && !k.maskeret.contains("pc-17") && !k.maskeret.contains("JDOE"),
        "{}",
        k.maskeret
    );
    assert!(k.rester.is_empty(), "{:?}", k.rester);
    assert_eq!(k.tilbage, t);
    // Et senere svar med koderne demaskeres med sagen alene (ordbogen og de tilføjede skal ikke med).
    let (tilbage, _) = demasker(&k.maskeret, &sag);
    assert_eq!(tilbage, t);
}
