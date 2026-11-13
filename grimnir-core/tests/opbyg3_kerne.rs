//! V-OPBYG.3 N1: kernefejlen fra V-OPBYG.2 (sideeffekt-fund 1). Et brugernavn på ét tegn (`p` fra `A0\p`, `user=p`,
//! `p@…`) blev maskeret i sin sammenhæng, men lækagetjekket søgte også efter det som ord alene og meldte et almindeligt
//! bogstav andre steder ("P") som en rest. Nu søger lækagetjekket ikke efter en original på ét tegn alene. To tegn og mere
//! meldes som før (V-KERNE.2: "sa" er en rest, så brugeren selv kan afgøre det). Kun opdigtede værdier
//! (`eksempel-firma.example`, `kontor.test`, opfundne navne).

mod faelles;

use faelles::kaede;
use grimnir_core::{analyser, foreslaa_med_ordbog, laekagetjek, masker, Klasse, Ordbog, RestArt, Sag};

const MAIL: &str = "bo.proeve@eksempel-firma.example";

/// Netop inputtet fra `manuel2_maskinnavne.proptest-regressions` (`dele = [(Stoej("P"), 0), (Stoej("A0\\p"), 0)]`), bygget
/// som egenskabstesten bygger teksten: mailen og et linjeskift, så hvert stykke med skilletegnet `" "` efter.
#[test]
fn regressionen_p_fra_egenskabstesten() {
    let t = format!("{MAIL}\nP A0\\p ");
    let o = Ordbog::ny();
    let mut sag = Sag::default();
    let k = kaede(&t, &o, &mut sag);
    assert_eq!(k.tilbage, t);
    assert!(
        k.rester.is_empty(),
        "rester: {:?}",
        k.rester.iter().map(|r| &k.maskeret[r.start..r.slut]).collect::<Vec<_>>()
    );
    // Brugeren i `A0\p` er stadig maskeret; bogstavet P alene står, som analysen lader det stå.
    let kode = sag.kode_for_original(Klasse::Bruger, "p").expect("p har en kode").to_string();
    assert!(k.maskeret.contains(&format!("\\{kode} ")), "{}", k.maskeret);
    assert!(k.maskeret.contains("\nP "), "{}", k.maskeret);
}

/// Samme fejl fra de andre genkendere (nøgleord, mail, citeret værdi) og med små bogstaver: ingen rest for ét tegn alene.
#[test]
fn et_tegn_giver_ingen_rest_som_ord_alene() {
    let o = Ordbog::ny();
    for t in [
        "user=p og P igen\n",
        "p@eksempel-firma.example og P igen\n",
        "user: \"q\" og Q\n",
        "Logon KONTOR\\p og p igen\n",
        "p A0\\p ",
    ] {
        let mut sag = Sag::default();
        let k = kaede(t, &o, &mut sag);
        assert_eq!(k.tilbage, t);
        assert!(
            k.rester.is_empty(),
            "{t:?}: rester {:?}",
            k.rester.iter().map(|r| &k.maskeret[r.start..r.slut]).collect::<Vec<_>>()
        );
    }
}

/// To tegn meldes som før (V-KERNE.2): et brugernavn på to tegn, der står alene et andet sted, er en rest, både i samme
/// tekst og i en ny tekst med samme sag.
#[test]
fn to_tegn_meldes_som_foer() {
    let o = Ordbog::ny();
    let mut sag = Sag::default();
    let t = "Logon KONTOR\\jt og jt igen\n";
    let k = kaede(t, &o, &mut sag);
    assert_eq!(k.tilbage, t);
    let rester: Vec<&str> = k.rester.iter().map(|r| &k.maskeret[r.start..r.slut]).collect();
    assert_eq!(rester, ["jt"]);
    assert_eq!(k.rester[0].art, RestArt::Original(Klasse::Bruger));
    let t2 = "jt står tilbage\n";
    let f = analyser(t2, &o);
    let e = foreslaa_med_ordbog(&f, t2, &mut sag, &o);
    let m = masker(t2, &e);
    let r = laekagetjek(&m, &sag, &o);
    assert_eq!(r.iter().map(|x| &m[x.start..x.slut]).collect::<Vec<_>>(), ["jt"]);
}

/// Et brugernavn på ét tegn i sin sammenhæng, der står umaskeret, findes stadig: genkenderne kører igen i lækagetjekket.
#[test]
fn et_kort_brugernavn_i_sin_sammenhaeng_findes_stadig() {
    let o = Ordbog::ny();
    let mut sag = Sag::default();
    let _ = kaede("Logon KONTOR\\p\n", &o, &mut sag);
    let umaskeret = "Logon KONTOR\\p\n";
    let r = laekagetjek(umaskeret, &sag, &o);
    let p = r.iter().find(|x| &umaskeret[x.start..x.slut] == "p").expect("p er en rest");
    assert!(matches!(p.art, RestArt::NytFund(_)), "{:?}", p.art);
    // Domænet (seks tegn) findes som før af søgningen efter sagens originaler.
    assert!(r.iter().any(|x| &umaskeret[x.start..x.slut] == "KONTOR"));
}
