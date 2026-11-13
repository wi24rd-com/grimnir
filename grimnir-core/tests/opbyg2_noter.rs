//! V-OPBYG.2 N1/N5: noter i sagen (kernen). Tilføj, ret, slet, grænserne, en sag uden noter (data fra før V-OPBYG.2),
//! data, der ikke hænger sammen, og at en notes tekst aldrig kommer med i den maskerede tekst, lækagetjekket, demaskeringens
//! resultat, en fejl eller en `Debug`-udskrift. Egenskabstest: rundturen gennem `SagData` bevarer noterne, og maskeringen
//! er den samme med og uden noter. Kun opdigtede værdier (`kontor.test`, RFC 1918, opfundne navne).

mod faelles;

use faelles::{kaede, ordbog};
use grimnir_core::{demasker, laekagetjek, Fejl, Note, Sag, SagData, MAKS_NOTER, MAKS_NOTE_TEGN};
use proptest::prelude::*;

const TEKST: &str = "hostname=srv-068.intern.kontor.test user=bruger022 password=Sommer2026! ip=10.20.30.1\r\nlogin ok\n";
/// En notetekst, der ikke står i teksten, og som kan findes i enhver udskrift.
const MAERKE: &str = "Notemærke Qx7 sendt til leverandøren";

fn noter(s: &Sag) -> Vec<(u64, String, u64, Option<u64>)> {
    s.noter().iter().map(|n| (n.nr, n.tekst.clone(), n.oprettet, n.rettet)).collect()
}

#[test]
fn tilfoej_ret_og_slet() {
    let mut s = Sag::default();
    assert!(!s.har_indhold());
    assert_eq!(s.tilfoej_note("Første note", 1_000), Ok(1));
    assert!(s.har_indhold(), "en sag med en note og uden poster har indhold (D21)");
    assert_eq!(s.antal_poster(), 0);
    assert_eq!(s.tilfoej_note("Anden\r\nlinje to\nlinje tre", 2_000), Ok(2));
    assert_eq!(s.antal_noter(), 2);
    assert_eq!(s.note_taeller(), 2);
    assert_eq!(
        noter(&s),
        vec![
            (1, "Første note".to_string(), 1_000, None),
            (2, "Anden\r\nlinje to\nlinje tre".to_string(), 2_000, None)
        ],
        "linjeskift gemmes, som de er skrevet"
    );
    // Ret: ny tekst og tidspunkt; den gamle tekst gives ud (skallen nulstiller den).
    assert_eq!(s.ret_note(1, "Første note, rettet", 3_000), Ok("Første note".to_string()));
    assert_eq!(noter(&s)[0], (1, "Første note, rettet".to_string(), 1_000, Some(3_000)));
    // Uændret tekst: intet ændres (heller ikke tidspunktet).
    assert_eq!(s.ret_note(1, "Første note, rettet", 4_000), Ok(String::new()));
    assert_eq!(noter(&s)[0].3, Some(3_000));
    // Slet: noten gives ud; nummeret bruges ikke igen, så længe sagen har noter.
    let n: Note = s.slet_note(1).unwrap();
    assert_eq!((n.nr, n.tekst.as_str()), (1, "Første note, rettet"));
    assert_eq!(s.tilfoej_note("Tredje", 5_000), Ok(3));
    assert_eq!(noter(&s).iter().map(|n| n.0).collect::<Vec<_>>(), vec![2, 3]);
    // Ukendt nummer.
    assert_eq!(s.ret_note(1, "x", 6_000), Err(Fejl::UkendtNote { nr: 1 }));
    assert!(s.slet_note(99).is_err());
    // Uden noter begynder løbenummeret forfra (sagens fil får så formatversion 1 igen, se skallen).
    s.slet_note(2).unwrap();
    s.slet_note(3).unwrap();
    assert_eq!((s.antal_noter(), s.note_taeller()), (0, 0));
    assert!(!s.har_indhold());
    assert_eq!(s.tilfoej_note("Igen", 7_000), Ok(1));
}

#[test]
fn graenserne() {
    let mut s = Sag::default();
    for tom in ["", " ", "\n\r\n\t "] {
        assert_eq!(s.tilfoej_note(tom, 1), Err(Fejl::NoteTom), "{tom:?}");
    }
    // Grænsen tæller tegn, ikke bytes: 4.000 × "ø" (8.000 bytes) er lige netop tilladt.
    let lige = "ø".repeat(MAKS_NOTE_TEGN);
    assert_eq!(s.tilfoej_note(&lige, 1), Ok(1));
    let over = "ø".repeat(MAKS_NOTE_TEGN + 1);
    assert_eq!(s.tilfoej_note(&over, 1), Err(Fejl::NoteForLang { maks: MAKS_NOTE_TEGN }));
    assert_eq!(s.ret_note(1, &over, 2), Err(Fejl::NoteForLang { maks: MAKS_NOTE_TEGN }));
    assert_eq!(s.ret_note(1, "  ", 2), Err(Fejl::NoteTom));
    assert_eq!(noter(&s)[0].1, lige, "en afvist rettelse ændrer intet");
    assert_eq!(noter(&s)[0].3, None);
    for i in 1..MAKS_NOTER {
        s.tilfoej_note(&format!("note {i}"), i as u64).unwrap();
    }
    assert_eq!(s.antal_noter(), MAKS_NOTER);
    assert_eq!(s.tilfoej_note("en for meget", 9), Err(Fejl::ForMangeNoter { maks: MAKS_NOTER }));
    assert_eq!(s.antal_noter(), MAKS_NOTER, "en afvist note ændrer intet");
    assert_eq!(s.note_taeller(), MAKS_NOTER as u64);
    assert_eq!((MAKS_NOTE_TEGN, MAKS_NOTER), (4000, 200));
}

#[test]
fn data_uden_noter_aabner_uden_noter() {
    // En sags data fra før V-OPBYG.2 har ingen noter og løbenummer 0 (standardværdierne).
    let mut s = Sag::default();
    let _ = kaede(TEKST, &ordbog(), &mut s);
    let mut d = s.data().clone();
    d.noter = Vec::new();
    d.note_taeller = 0;
    let s2 = Sag::fra_data(d).expect("data uden noter kan læses");
    assert_eq!(s2.antal_noter(), 0);
    assert!(s2.antal_poster() > 0);
    assert!(SagData::default().noter.is_empty() && SagData::default().note_taeller == 0);
}

#[test]
fn data_med_noter_der_ikke_haenger_sammen_afvises() {
    let god = || {
        let mut s = Sag::default();
        s.tilfoej_note("a", 1).unwrap();
        s.tilfoej_note("b", 2).unwrap();
        s.data().clone()
    };
    assert!(Sag::fra_data(god()).is_ok());
    let note = |nr: u64, t: &str| Note {
        nr,
        tekst: t.to_string(),
        oprettet: 0,
        rettet: None,
    };
    let mut tilfaelde: Vec<(&str, SagData)> = Vec::new();
    let mut d = god();
    d.noter[1].nr = 1;
    tilfaelde.push(("samme nummer to gange", d));
    let mut d = god();
    d.noter[1].nr = 3;
    tilfaelde.push(("nummer over tælleren", d));
    let mut d = god();
    d.noter[0].nr = 0;
    tilfaelde.push(("nummer 0", d));
    let mut d = god();
    d.noter[0].tekst = " ".into();
    tilfaelde.push(("tom tekst", d));
    let mut d = god();
    d.noter[0].tekst = "x".repeat(MAKS_NOTE_TEGN + 1);
    tilfaelde.push(("for lang", d));
    let mut d = god();
    d.note_taeller = (MAKS_NOTER + 1) as u64;
    d.noter = (1..=MAKS_NOTER as u64 + 1).map(|i| note(i, "x")).collect();
    tilfaelde.push(("for mange", d));
    for (navn, d) in tilfaelde {
        assert_eq!(Sag::fra_data(d).err(), Some(Fejl::UgyldigeSagsdata { hvad: "noter" }), "{navn}");
    }
    // erstat_noter kontrollerer på samme måde og ændrer intet ved en fejl.
    let mut s = Sag::fra_data(god()).unwrap();
    assert!(s.erstat_noter(vec![note(1, "x"), note(1, "y")], 1).is_err());
    assert_eq!(s.antal_noter(), 2);
    let (gamle, t) = s.erstat_noter(vec![note(4, "z")], 4).unwrap();
    assert_eq!((gamle.len(), t, s.antal_noter(), s.note_taeller()), (2, 2, 1, 4));
}

#[test]
fn en_notes_tekst_kommer_aldrig_med_i_maskering_demaskering_eller_udskrifter() {
    let o = ordbog();
    let mut uden = Sag::default();
    let mut med = Sag::default();
    med.tilfoej_note(MAERKE, 1).unwrap();
    // En note med de samme værdier som teksten (D27: noten gennemsøges ikke, og den bruges ikke af maskeringen).
    med.tilfoej_note("srv-068 bruger022 10.20.30.1 Sommer2026!", 2).unwrap();
    let ku = kaede(TEKST, &o, &mut uden);
    let km = kaede(TEKST, &o, &mut med);
    assert_eq!(km.maskeret, ku.maskeret, "noterne ændrer ikke maskeringen");
    assert_eq!(km.tilbage, TEKST, "demaskeringen giver teksten tilbage, intet andet");
    assert!(!km.maskeret.contains(MAERKE) && !km.tilbage.contains(MAERKE));
    assert!(km.rester.is_empty(), "lækagetjekket finder ingen rester");
    assert_eq!(
        laekagetjek(&km.maskeret, &med, &o).len(),
        laekagetjek(&ku.maskeret, &uden, &o).len()
    );
    // Demaskering af noget, der ligner noten: noten sættes aldrig ind.
    let (tilbage, adv) = demasker("note nr. 1 h0001 user0001", &med);
    assert!(!tilbage.contains(MAERKE) && !tilbage.contains("Notemærke"));
    let udskrift = format!("{med:?}{adv:?}{:?}{:?}", km.fund, km.advarsler);
    assert!(!udskrift.contains("Notemærke"), "Debug viser ikke noten");
    assert!(udskrift.contains("noter: 2"), "Debug viser antallet: {udskrift}");
    // Fejlene for noter har ingen tekst fra noten.
    let mut s = Sag::default();
    let fejl = [
        s.tilfoej_note(" ", 1).unwrap_err(),
        s.tilfoej_note(&format!("{MAERKE}{}", "x".repeat(MAKS_NOTE_TEGN)), 1).unwrap_err(),
        s.ret_note(7, MAERKE, 1).unwrap_err(),
        s.slet_note(7).err().expect("ukendt note"),
        Fejl::ForMangeNoter { maks: MAKS_NOTER },
    ];
    for f in fejl {
        let t = format!("{f} {f:?}");
        assert!(!t.contains("Notemærke") && !t.contains("xxxxxxxxxx"), "{t}");
    }
}

fn note_tekst() -> impl Strategy<Value = String> {
    // Brugerens egen tekst: bogstaver, æøå, tal, tegnsætning, citationstegn, skråstreger og linjeskift (også CRLF).
    prop::collection::vec(
        prop_oneof![
            "[a-zA-Z0-9 .,:;!?-]{1,12}",
            Just("æøå ÆØÅ".to_string()),
            Just("\"citat\" \\sti\\".to_string()),
            Just("\r\n".to_string()),
            Just("\n".to_string()),
            Just("srv-068 10.20.30.1".to_string()),
            Just("emoji 🙂".to_string()),
        ],
        1..8,
    )
    .prop_map(|v| v.concat())
    .prop_filter("ikke kun mellemrum", |s| !s.trim().is_empty())
}

#[derive(Clone)]
enum Trin {
    Tilfoej(String),
    Ret(usize, String),
    Slet(usize),
}

impl std::fmt::Debug for Trin {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Trin::Tilfoej(t) => write!(f, "Tilfoej({} tegn)", t.chars().count()),
            Trin::Ret(i, t) => write!(f, "Ret({i}, {} tegn)", t.chars().count()),
            Trin::Slet(i) => write!(f, "Slet({i})"),
        }
    }
}

fn trin() -> impl Strategy<Value = Trin> {
    prop_oneof![
        3 => note_tekst().prop_map(Trin::Tilfoej),
        1 => (0..6usize, note_tekst()).prop_map(|(i, t)| Trin::Ret(i, t)),
        1 => (0..6usize).prop_map(Trin::Slet),
    ]
}

proptest! {
    #![proptest_config(ProptestConfig { cases: 256, ..ProptestConfig::default() })]

    /// Rundturen gennem `SagData` (det, skallen krypterer og gemmer) bevarer noterne præcist, numrene er entydige og
    /// stigende, og maskeringen er den samme som uden noter.
    #[test]
    fn rundtur_og_maskering_uden_noter(trin in prop::collection::vec(trin(), 0..24)) {
        let mut s = Sag::default();
        let mut nu = 0u64;
        for t in trin {
            nu += 1;
            let numre: Vec<u64> = s.noter().iter().map(|n| n.nr).collect();
            match t {
                Trin::Tilfoej(x) => { s.tilfoej_note(&x, nu).unwrap(); }
                Trin::Ret(i, x) => if let Some(nr) = numre.get(i) { s.ret_note(*nr, &x, nu).unwrap(); },
                Trin::Slet(i) => if let Some(nr) = numre.get(i) { s.slet_note(*nr).unwrap(); },
            }
        }
        let foer = noter(&s);
        let numre: Vec<u64> = foer.iter().map(|n| n.0).collect();
        prop_assert!(numre.windows(2).all(|w| w[0] < w[1]), "numrene stiger");
        prop_assert!(numre.iter().all(|n| *n >= 1 && *n <= s.note_taeller()));
        let mut kopi = Sag::fra_data(s.data().clone()).unwrap();
        prop_assert!(noter(&kopi) == foer);
        prop_assert_eq!(kopi.note_taeller(), s.note_taeller());
        let mut uden = Sag::default();
        let km = kaede(TEKST, &ordbog(), &mut kopi);
        let ku = kaede(TEKST, &ordbog(), &mut uden);
        prop_assert_eq!(km.maskeret, ku.maskeret);
        prop_assert_eq!(km.tilbage, TEKST);
        prop_assert!(noter(&kopi) == foer, "maskeringen rører ikke noterne");
    }
}
