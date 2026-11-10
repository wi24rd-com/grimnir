//! K3: erstatninger efter ADR-001 D4–D6 og kontrollens tilfælde 8.1–8.5.

mod faelles;

use faelles::{kaede, ordbog};
use grimnir_core::{analyser, foreslaa, masker, Erstatning, Fejl, Klasse, Sag, Valg};

fn kode<'a>(e: &'a [Erstatning], original: &str) -> &'a str {
    e.iter()
        .find(|x| x.original.som_tekst() == original)
        .map(|x| x.kode.as_str())
        .unwrap_or_else(|| panic!("ingen kode for {original}"))
}

fn masker_med(tekst: &str, sag: &mut Sag) -> (Vec<Erstatning>, String) {
    let f = analyser(tekst, &ordbog());
    let e = foreslaa(&f, tekst, sag);
    let m = masker(tekst, &e);
    (e, m)
}

#[test]
fn kodernes_form_d6() {
    let mut sag = Sag::default();
    let t = "srv-068.intern.kontor.test KONTOR\\bruger022 bruger022@kontor.test password=Sommer2026! Database=Kunde_DB Anna Testesen Projekt Uglebo";
    let (e, m) = masker_med(t, &mut sag);
    assert_eq!(kode(&e, "srv-068"), "h0001");
    assert_eq!(kode(&e, "intern.kontor.test"), "d01.example");
    assert_eq!(kode(&e, "KONTOR"), "NB01");
    assert_eq!(kode(&e, "bruger022"), "user0001");
    assert_eq!(kode(&e, "kontor.test"), "d02.example");
    assert_eq!(kode(&e, "Sommer2026!"), "GRIMNIR_SECRET_0001");
    assert_eq!(kode(&e, "Kunde_DB"), "db0001");
    assert_eq!(kode(&e, "Anna Testesen"), "Person 0001");
    assert_eq!(kode(&e, "Projekt Uglebo"), "ord0001");
    assert!(m.starts_with("h0001.d01.example NB01\\user0001 user0001@d02.example"));
}

#[test]
fn egne_net_d5_bevarer_sidste_oktet() {
    let mut sag = Sag::default();
    let (e, _) = masker_med("gw 10.20.30.1 nabo 10.20.30.11 andet net 10.20.31.7", &mut sag);
    assert_eq!(kode(&e, "10.20.30.1"), "198.18.0.1");
    assert_eq!(kode(&e, "10.20.30.11"), "198.18.0.11");
    assert_eq!(kode(&e, "10.20.31.7"), "198.18.1.7");
}

#[test]
fn egne_net_d5_slaaet_fra_omblander_vaertsdelen() {
    let mut sag = Sag::ny(Valg {
        bevar_sidste_oktet: false,
        ..Valg::default()
    });
    let (e, _) = masker_med("10.20.30.200 10.20.30.17 10.20.30.0", &mut sag);
    assert_eq!(kode(&e, "10.20.30.200"), "198.18.0.1");
    assert_eq!(kode(&e, "10.20.30.17"), "198.18.0.2");
    assert_eq!(kode(&e, "10.20.30.0"), "198.18.0.0");
}

#[test]
fn fremmede_d4_kun_med_tilvalg() {
    let mut sag = Sag::default();
    let (e, m) = masker_med("peer 100.99.4.4", &mut sag);
    assert!(e.is_empty() && m == "peer 100.99.4.4");
    let mut sag = Sag::ny(Valg {
        masker_fremmede: true,
        ..Valg::default()
    });
    let (e, _) = masker_med("peer 100.99.4.4 og 100.99.9.9", &mut sag);
    assert_eq!(kode(&e, "100.99.4.4"), "203.0.113.1");
    assert_eq!(kode(&e, "100.99.9.9"), "203.0.113.2");
}

#[test]
fn ipv6_og_mac_koder() {
    let mut sag = Sag::default();
    let (e, _) = masker_med(
        "fd00:0:0:1::5 fd00:0:0:1::6 fd00:0:0:2::5 AA-BB-CC-00-11-22 aabb.cc00.1123",
        &mut sag,
    );
    assert_eq!(kode(&e, "fd00:0:0:1::5"), "2001:db8::1");
    assert_eq!(kode(&e, "fd00:0:0:1::6"), "2001:db8::2");
    assert_eq!(kode(&e, "fd00:0:0:2::5"), "2001:db8:0:1::1");
    assert_eq!(kode(&e, "AA-BB-CC-00-11-22"), "00-00-5E-00-53-00");
    assert_eq!(kode(&e, "aabb.cc00.1123"), "0000.5e00.5301");
}

#[test]
fn samme_original_samme_kode_paa_tvaers_af_kald() {
    let mut sag = Sag::default();
    let (e1, _) = masker_med("hostname=srv-068 ip=10.20.30.1", &mut sag);
    let (e2, _) = masker_med("ping srv-068 fra 10.20.30.1", &mut sag);
    assert_eq!(kode(&e1, "srv-068"), kode(&e2, "srv-068"));
    assert_eq!(kode(&e1, "10.20.30.1"), kode(&e2, "10.20.30.1"));
}

#[test]
fn store_og_smaa_en_enhed_flere_stavemaader() {
    let mut sag = Sag::default();
    let t = "hostname=srv-068 hostname=SRV-068 hostname=Srv-068";
    let (e, m) = masker_med(t, &mut sag);
    assert_eq!(kode(&e, "srv-068"), "h0001");
    assert_eq!(kode(&e, "SRV-068"), "H0001");
    assert_eq!(kode(&e, "Srv-068"), "h0001b");
    let (tilbage, _) = grimnir_core::demasker(&m, &sag);
    assert_eq!(tilbage, t);
}

#[test]
fn brugerens_rettelse_respekteres_og_kollision_afvises() {
    let mut sag = Sag::default();
    let t = "hostname=srv-068 user=bruger022";
    let (e, _) = masker_med(t, &mut sag);
    sag.ret(kode(&e, "srv-068"), "firewall-a", t).expect("rettelsen er fri");
    let (e2, m2) = masker_med(t, &mut sag);
    assert_eq!(kode(&e2, "srv-068"), "firewall-a");
    assert_eq!(grimnir_core::demasker(&m2, &sag).0, t);
    assert!(matches!(sag.ret("firewall-a", "user0001", t), Err(Fejl::KodeKolliderer { .. })));
    assert!(matches!(sag.ret("firewall-a", "hostname", t), Err(Fejl::KodeKolliderer { .. })));
}

// ---------------------------------------------------------------- kontrol 8.1–8.5

#[test]
fn kontrol_8_1_tekst_der_ligner_en_kode() {
    let mut sag = Sag::default();
    let t = "gw=10.20.30.1 bench=198.18.0.11 peer=203.0.113.5 navn h0001 hostname=srv-068";
    let k = kaede(t, &ordbog(), &mut sag);
    // 198.18.0.0/24 er i brug i teksten og tages ikke; h0001 står i teksten og tages ikke
    assert!(
        k.maskeret
            .starts_with("gw=198.18.1.1 bench=198.18.0.11 peer=203.0.113.5 navn h0001 hostname=h0002"),
        "{}",
        k.maskeret
    );
    assert_eq!(k.tilbage, t);
    // Næste tekst i samme sag har et af sagens koder i klar tekst: det maskeres også
    let t2 = "ny log: 198.18.1.1 er en anden maskine end h0002";
    let k2 = kaede(t2, &ordbog(), &mut sag);
    assert!(
        !k2.maskeret.contains("198.18.1.1") && !k2.maskeret.contains("h0002"),
        "{}",
        k2.maskeret
    );
    assert_eq!(k2.tilbage, t2);
    assert!(k2.rester.is_empty());
}

#[test]
fn kontrol_8_2_stavemaader_af_adresser() {
    let mut sag = Sag::default();
    let t = "a 010.020.030.001 b 10.20.30.1 c 10.020.030.001 d fd00:0:0:1::5 e FD00:0:0:1::5 f fd00:0:0:1:0:0:0:5 g fd00::1:0:0:0:5";
    let k = kaede(t, &ordbog(), &mut sag);
    assert_eq!(k.tilbage, t, "rundturen er bytepræcis for hver stavemåde");
    assert!(k.maskeret.contains("a 198.018.000.001 b 198.18.0.1"), "{}", k.maskeret);
    assert!(k.maskeret.contains("e 2001:DB8::1"), "{}", k.maskeret);
    assert!(k.maskeret.contains("f 2001:db8:0:0:0:0:0:1"), "{}", k.maskeret);
    assert!(k.rester.is_empty());
}

#[test]
fn kontrol_8_3_en_graenseregel() {
    let mut sag = Sag::default();
    let t = "backup: srv-068_backup.log og srv-068-gammel.log";
    let k = kaede(t, &ordbog(), &mut sag);
    assert_eq!(k.maskeret, "backup: h0001_backup.log og h0001-gammel.log");
    assert_eq!(k.tilbage, t);
}

#[test]
fn kontrol_8_4_netbios_og_dns_er_to_enheder() {
    let mut sag = Sag::default();
    let t = "KONTOR\\bruger022 og bruger022@kontor.test og kontor\\bruger023";
    let k = kaede(t, &ordbog(), &mut sag);
    assert_eq!(k.maskeret, "NB01\\user0001 og user0001@d01.example og nb01\\user0002");
    assert_eq!(k.tilbage, t);
    assert_eq!(sag.kode_for_original(Klasse::Netbios, "KONTOR"), Some("NB01"));
    assert_eq!(sag.kode_for_original(Klasse::Domaene, "kontor.test"), Some("d01.example"));
}

#[test]
fn kontrol_8_5_over_9999_vaerter() {
    let mut sag = Sag::default();
    let t: String = (0..10_050).map(|i| format!("hostname=vaert-{i}\n")).collect();
    let k = kaede(&t, &ordbog(), &mut sag);
    assert!(k.maskeret.contains("hostname=h9999\nhostname=h10000\n"));
    assert_eq!(k.tilbage, t);
    assert!(k.rester.is_empty());
}
