//! K6: egenskabstest med `proptest` på sammensatte, opdigtede tekster.

mod faelles;

use faelles::{kaede, ordbog};
use grimnir_core::{Sag, Valg};
use proptest::prelude::*;

/// Brudstykker, der rammer genkenderne, kodeformerne og grænsereglen (kun opdigtede værdier).
const STYKKER: [&str; 52] = [
    "10.20.30.1",
    "010.020.030.001",
    "10.20.30.11",
    "172.16.5.9",
    "100.70.1.2",
    "100.99.4.4",
    "198.18.0.11",
    "198.18.0.1",
    "203.0.113.5",
    "version 10.2.3.4",
    "1.3.6.1.4.1",
    "fd00:0:0:1::5",
    "FD00:0:0:1::5",
    "fd00:0:0:1:0:0:0:5",
    "2001:db8::1",
    "0a:1b:2c:3d:4e:5f",
    "0A-1B-2C-3D-4E-5F",
    "00:00:5e:00:53:00",
    "srv-068",
    "SRV-068",
    "srv-068_backup.log",
    "srv-068.intern.kontor.test",
    "KONTOR\\bruger022",
    "KONTOR\\\\bruger022",
    "bruger022@kontor.test",
    "bruger022",
    "hostname=fw01",
    "password=Hemmelig1",
    "Server=sqlsrv01;Database=Kunde_DB;",
    "h0001",
    "H0001",
    "user0001",
    "d01.example",
    "NB01",
    "Person 0001",
    "GRIMNIR_SECRET_0001",
    "Anna Testesen",
    "S-1-5-21-1111111111-2222222222-3333333333-1105",
    "%40",
    "æøå",
    "README.md",
    "C:\\Users\\bruger022\\x",
    "https://admin:Hemm3lig@srv-030.kontor.test/",
    "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0In0.c2ln",
    "S-1-5-21-0-0-1",
    "000000-0001",
    "203.0.113.1",
    "2001:db8::1:5",
    "00:00:5e:00:53:00:11",
    "\\n",
    "%5C",
    "tenant_id=12345678-1234-1234-1234-123456789abc",
];
const SKILLE: [&str; 12] = [" ", "", ".", "_", "-", ":", "/24", "\n", "\r\n", "\\", "\"", "="];

fn tekst() -> impl Strategy<Value = String> {
    prop::collection::vec((0..STYKKER.len(), 0..SKILLE.len(), "[ -~]{0,4}"), 0..30).prop_map(|dele| {
        let mut s = String::new();
        for (a, b, stoej) in dele {
            s.push_str(STYKKER[a]);
            s.push_str(SKILLE[b]);
            s.push_str(&stoej);
        }
        s
    })
}

proptest! {
    #![proptest_config(ProptestConfig { cases: 512, ..ProptestConfig::default() })]

    #[test]
    fn rundtur_bytepraecis(t in tekst()) {
        let mut sag = Sag::default();
        let k = kaede(&t, &ordbog(), &mut sag);
        prop_assert_eq!(k.tilbage, t);
    }

    #[test]
    fn rundtur_med_fremmede_og_omblanding(t in tekst()) {
        let mut sag = Sag::ny(Valg { masker_fremmede: true, bevar_sidste_oktet: false });
        let k = kaede(&t, &ordbog(), &mut sag);
        prop_assert_eq!(k.tilbage, t);
    }

    #[test]
    fn to_tekster_i_samme_sag(a in tekst(), b in tekst()) {
        let mut sag = Sag::default();
        let ka = kaede(&a, &ordbog(), &mut sag);
        let kb = kaede(&b, &ordbog(), &mut sag);
        prop_assert_eq!(kb.tilbage, b);
        // Den første tekst kan stadig demaskeres, selv om sagen er vokset
        prop_assert_eq!(&grimnir_core::demasker(&ka.maskeret, &sag).0, &a);
    }
}

/// F1: sammensat form i tekst A, samme værdi nøgen i tekst B (kun opdigtede værdier).
const PAR: [(&str, &[&str]); 12] = [
    ("KONTOR\\bruger022", &["bruger022"]),
    ("bruger023@kontor.test", &["bruger023"]),
    ("password=Hemmelig1x", &["Hemmelig1x"]),
    ("Database=Kunde_DB;", &["Kunde_DB"]),
    ("hostname=fw01", &["fw01"]),
    ("https://drift:Hemm3lig@srv-030.kontor.test/", &["drift", "Hemm3lig"]),
    ("C:\\Users\\bruger024\\x", &["bruger024"]),
    ("User Id=appbruger;", &["appbruger"]),
    ("-ComputerName pc-0042", &["pc-0042"]),
    ("serial=FGT60F1234567", &["FGT60F1234567"]),
    ("CN=Anna Jensen,OU=Salg,DC=kontor,DC=test", &["Anna Jensen", "Salg"]),
    (
        "tenant_id=12345678-1234-1234-1234-123456789abc",
        &["12345678-1234-1234-1234-123456789abc"],
    ),
];
const ADSKIL: [&str; 4] = [" ", "\n", ", ", ". "];

proptest! {
    #![proptest_config(ProptestConfig { cases: 256, ..ProptestConfig::default() })]

    #[test]
    fn f1_noegne_vaerdier_i_ny_tekst(valg in prop::collection::vec((0..PAR.len(), 0..ADSKIL.len()), 1..12)) {
        let a: String = valg.iter().map(|(p, s)| format!("{}{}", PAR[*p].0, ADSKIL[*s])).collect();
        let b: String = valg.iter().flat_map(|(p, s)| PAR[*p].1.iter().map(move |v| format!("{v}{}", ADSKIL[*s]))).collect();
        let mut sag = Sag::default();
        let ka = kaede(&a, &ordbog(), &mut sag);
        prop_assert_eq!(&ka.tilbage, &a);
        let kb = kaede(&b, &ordbog(), &mut sag);
        prop_assert!(kb.rester.is_empty(), "rester i B: {:?} i {:?}", kb.rester, kb.maskeret);
        prop_assert_eq!(&kb.tilbage, &b);
    }
}

proptest! {
    #![proptest_config(ProptestConfig { cases: 512, ..ProptestConfig::default() })]

    /// V-SAG.1 (D18): ret en kode (én stavemåde eller hele enheden), maskér mere, demaskér den første tekst. En afvist
    /// rettelse ændrer intet; en godkendt gør den gamle kode til et alias, så den første tekst stadig kan demaskeres.
    #[test]
    fn ret_en_kode_masker_mere_demasker_den_foerste(
        a in tekst(),
        b in tekst(),
        valg in 0usize..1000,
        hele_enheden in any::<bool>(),
        ny in "[a-z][a-z0-9-]{1,8}[a-z0-9]",
    ) {
        let mut sag = Sag::default();
        let ka = kaede(&a, &ordbog(), &mut sag);
        prop_assume!(sag.antal_poster() > 0);
        let kode = sag.data().poster[valg % sag.antal_poster()].kode.clone();
        let _ = if hele_enheden { sag.ret_enhed(&kode, &ny, &a).map(|_| ()) } else { sag.ret(&kode, &ny, &a) };
        let kb = kaede(&b, &ordbog(), &mut sag);
        prop_assert_eq!(kb.tilbage, b);
        prop_assert_eq!(&grimnir_core::demasker(&ka.maskeret, &sag).0, &a);
        // Efter rettelsen kan sagen genskabes fra sine data og demaskerer stadig den første tekst.
        let igen = Sag::fra_data(sag.data().clone()).expect("data hænger sammen");
        prop_assert_eq!(grimnir_core::demasker(&ka.maskeret, &igen).0, a);
    }
}
