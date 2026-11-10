//! K2: genkenderne, sikkerhed, overlap, afledte former og "maskér aldrig".

mod faelles;

use faelles::{fund_for, ordbog, tekster};
use grimnir_core::{analyser, Art, Ordbog, Sammensat, Sikkerhed};

fn har(tekst: &str, o: &Ordbog, vaerdi: &str, art: Art) {
    let fund = analyser(tekst, o);
    let f = fund_for(tekst, &fund, vaerdi).unwrap_or_else(|| panic!("intet fund for {vaerdi:?} i {:?}", tekster(tekst, &fund)));
    assert_eq!(f.art, art, "forkert art for {vaerdi}");
}

fn har_ikke(tekst: &str, o: &Ordbog) {
    let fund: Vec<_> = analyser(tekst, o)
        .into_iter()
        .filter(|f| f.sikkerhed != Sikkerhed::Version)
        .collect();
    assert!(fund.is_empty(), "uventede fund i {tekst:?}: {:?}", tekster(tekst, &fund));
}

#[test]
fn ipv4_og_cidr() {
    let o = ordbog();
    har("ip=10.20.30.1", &o, "10.20.30.1", Art::Ipv4Egen);
    har("net 10.20.30.0/24 via 172.16.5.1", &o, "10.20.30.0", Art::Ipv4Egen);
    har("peer 100.99.4.4", &o, "100.99.4.4", Art::Ipv4Fremmed);
    har("ordbogens net 100.70.1.2", &o, "100.70.1.2", Art::Ipv4Egen);
}

#[test]
fn ipv4_ikke_fund() {
    let o = ordbog();
    har_ikke("OID 1.3.6.1.4.1.9.9 og 1.2.3.4.5", &o);
    har_ikke("0.0.0.0 255.255.255.255 255.255.255.0 127.0.0.1 169.254.1.1 224.0.0.251", &o);
    har_ikke("netmask 255.255.0.0 mask 0.0.0.255", &o);
    let fund = analyser("version 10.2.3.4 v10.2.3.5 build 10.2.3.6", &o);
    assert_eq!(fund.len(), 3);
    assert!(fund.iter().all(|f| f.sikkerhed == Sikkerhed::Version));
}

#[test]
fn ipv6_og_mac() {
    let o = ordbog();
    har("fd00:0:0:1::5", &o, "fd00:0:0:1::5", Art::Ipv6Egen);
    har("addr 2001:2:0:1::5", &o, "2001:2:0:1::5", Art::Ipv6Fremmed);
    har("fe80::21a:2bff:fe3c:4d5e%en0", &o, "fe80::21a:2bff:fe3c:4d5e", Art::Ipv6Egen);
    har_ikke("fe80::1 ::1 kl. 11:30:00 std::vector", &o);
    har("mac 0a:1a:2b:3c:4d:5e", &o, "0a:1a:2b:3c:4d:5e", Art::Mac);
    har("mac 0A-1A-2B-3C-4D-5E", &o, "0A-1A-2B-3C-4D-5E", Art::Mac);
    har("mac 0a1a.2b3c.4d5e", &o, "0a1a.2b3c.4d5e", Art::Mac);
}

#[test]
fn mail_upn_og_domaene_bruger() {
    let o = ordbog();
    let t = "bruger022@kontor.test og KONTOR\\bruger022 og ANDET\\bruger023 og \"KONTOR\\\\bruger024\"";
    let fund = analyser(t, &o);
    let mail = fund_for(t, &fund, "kontor.test").expect("domæne");
    assert_eq!((mail.art, mail.del_af), (Art::Domaene, Some(Sammensat::Mail)));
    let nb = fund_for(t, &fund, "KONTOR").expect("NetBIOS");
    assert_eq!((nb.art, nb.sikkerhed), (Art::NetbiosDomaene, Sikkerhed::Sikker));
    assert_eq!(fund_for(t, &fund, "ANDET").map(|f| f.sikkerhed), Some(Sikkerhed::Sandsynlig));
    assert!(fund_for(t, &fund, "bruger024").is_some(), "JSON-escaped DOMÆNE\\\\bruger");
    har_ikke("C:\\Temp\\fil.txt HKLM\\SOFTWARE\\Firma printf(\"a\\nb\")", &o);
}

#[test]
fn vaertsnavne() {
    let o = ordbog();
    let t = "srv-068.intern.kontor.test";
    let fund = analyser(t, &o);
    assert_eq!(tekster(t, &fund), ["srv-068", "intern.kontor.test"]);
    har("hostname=fw01", &o, "fw01", Art::Vaert);
    har("set hostname \"FW-KONTOR01\"", &o, "FW-KONTOR01", Art::Vaert);
    har("Get-Service -ComputerName pc-0042", &o, "pc-0042", Art::Vaert);
    har("Server=sqlsrv01\\SQLEXPRESS;", &o, "sqlsrv01", Art::Vaert);
    har("kopi til \\\\filsrv01\\deling\\a.txt", &o, "filsrv01", Art::Vaert);
    har("maskine WS-0042-B", &o, "WS-0042-B", Art::Vaert);
    har_ikke("README.md deploy.sh System.Net.Sockets lib.so Host: www.example.com", &o);
}

#[test]
fn url_opdeles() {
    let o = ordbog();
    let t = "https://admin:Hemm3lig@srv-030.kontor.test:8443/sti?x=1";
    let fund = analyser(t, &o);
    assert_eq!(tekster(t, &fund), ["admin", "Hemm3lig", "srv-030", "kontor.test"]);
    assert!(fund
        .iter()
        .all(|f| f.del_af == Some(Sammensat::Url) || f.del_af == Some(Sammensat::Fqdn)));
}

#[test]
fn stier_ad_og_sid() {
    let o = ordbog();
    har("C:\\Users\\bruger022\\Documents", &o, "bruger022", Art::Bruger);
    har("/home/bruger022/.bashrc", &o, "bruger022", Art::Bruger);
    har_ikke("C:\\Users\\Public\\x /Users/Shared/y", &o);
    let t = "CN=Anna Testesen,OU=Salg,DC=kontor,DC=test";
    let fund = analyser(t, &o);
    assert_eq!(tekster(t, &fund), ["Anna Testesen", "Salg", "kontor"]);
    har(
        "S-1-5-21-1111111111-2222222222-3333333333-1105",
        &o,
        "S-1-5-21-1111111111-2222222222-3333333333-1105",
        Art::Sid,
    );
    har_ikke("S-1-5-18 S-1-5-32-544", &o);
}

#[test]
fn hemmeligheder() {
    let o = ordbog();
    har("password=Sommer2026!", &o, "Sommer2026!", Art::Hemmelighed);
    har("db_password=Vinter2026", &o, "Vinter2026", Art::Hemmelighed);
    har("\"apiKey\": \"abc123def\"", &o, "abc123def", Art::Hemmelighed);
    har("set psksecret ENC Hemmelig123", &o, "Hemmelig123", Art::Hemmelighed);
    har(
        "ConvertTo-SecureString \"P@ssw0rd\" -AsPlainText -Force",
        &o,
        "P@ssw0rd",
        Art::Hemmelighed,
    );
    har("Authorization: Bearer abcdefgh12345678", &o, "abcdefgh12345678", Art::Hemmelighed);
    har("snmp community=offentlig42", &o, "offentlig42", Art::Hemmelighed);
    har("<Password>Hemmelig</Password>", &o, "Hemmelig", Art::Hemmelighed);
    har(
        "jwt eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0In0.c2lnbmF0dXJl",
        &o,
        "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0In0.c2lnbmF0dXJl",
        Art::Hemmelighed,
    );
    let pem = "-----BEGIN PRIVATE KEY-----\nTUlJQ29wZGlndGVk\nbm9nbGU=\n-----END PRIVATE KEY-----";
    har(pem, &o, "TUlJQ29wZGlndGVk\nbm9nbGU=", Art::Hemmelighed);
    har_ikke("password=$pw bypass=1 password= password=null -Password $kode", &o);
}

#[test]
fn guid_serie_cpr_og_entropi() {
    let o = ordbog();
    har(
        "tenant_id=12345678-1234-1234-1234-123456789abc",
        &o,
        "12345678-1234-1234-1234-123456789abc",
        Art::Guid,
    );
    har_ikke("CLSID {12345678-1234-1234-1234-123456789abc}", &o);
    har("serial=FGT60F1234567", &o, "FGT60F1234567", Art::Serienummer);
    har("CPR 010190-1234", &o, "010190-1234", Art::Cpr);
    har_ikke("ordre 320190-1234 og 011390-1234", &o);
    let t = "nøgle aB3dE5fG7hJ9kL1mN3pQ5rS7tU9vW";
    let fund = analyser(t, &o);
    assert_eq!(
        fund.first().map(|f| (f.art, f.sikkerhed)),
        Some((Art::Entropi, Sikkerhed::TjekSelv))
    );
}

#[test]
fn overlap_laengste_vinder() {
    let o = ordbog();
    // Mailadressen er længere end domænet alene; værten i URL'en får samme opdeling som alene
    let t = "bruger022@srv-068.intern.kontor.test";
    let fund = analyser(t, &o);
    assert_eq!(tekster(t, &fund), ["bruger022", "srv-068.intern.kontor.test"]);
    assert_eq!(fund[1].art, Art::Domaene);
}

#[test]
fn afledte_former() {
    let o = ordbog();
    let t = "login KONTOR\\bruger022\nssh bruger022@10.20.30.1\nhost filsrv01 ping \\\\filsrv01\\c$";
    let fund = analyser(t, &o);
    let afledte: Vec<&str> = fund.iter().filter(|f| f.afledt).map(|f| &t[f.start..f.slut]).collect();
    assert!(afledte.contains(&"bruger022"), "nøgent brugernavn: {afledte:?}");
    assert!(afledte.contains(&"filsrv01"), "kort værtsnavn: {afledte:?}");
}

#[test]
fn maskeer_aldrig_vinder() {
    let mut o = ordbog();
    o.aldrig = vec!["srv-068".into(), "10.20.30.0/24".into(), "support@kontor.test".into()];
    let t = "srv-068 10.20.30.1 10.20.31.1 support@kontor.test";
    let fund = analyser(t, &o);
    assert_eq!(tekster(t, &fund), ["10.20.31.1"]);
}

#[test]
fn ligner_en_kode() {
    let o = ordbog();
    let t = "gw=198.18.0.11 peer=203.0.113.5 navn h0001 mac 00:00:5e:00:53:01 ip6 2001:db8::7";
    let fund = analyser(t, &o);
    assert_eq!(fund.len(), 5, "{:?}", tekster(t, &fund));
    assert!(fund.iter().all(|f| f.art == Art::LignerKode && f.sikkerhed == Sikkerhed::TjekSelv));
}
