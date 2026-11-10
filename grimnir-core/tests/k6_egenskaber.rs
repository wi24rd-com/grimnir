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
    "srv-068.intern.eksempel.dk",
    "KONTOR\\bruger022",
    "KONTOR\\\\bruger022",
    "bruger022@eksempel.dk",
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
    "https://admin:Hemm3lig@srv-030.eksempel.dk/",
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
        prop_assert_eq!(grimnir_core::demasker(&ka.maskeret, &sag).0, a);
    }
}
