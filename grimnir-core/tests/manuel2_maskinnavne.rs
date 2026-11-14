//! V-MANUEL.2 N2–N5: maskindelen af et fuldt navn, maskinnavne efter placering, forslag til navnemønstre og lækagetjekket.
//! Kun opdigtede navne og adresser (`eksempel-firma.example`, `kontor.test`, 10.20.0.0/16, 100.70.0.0/16).

mod faelles;

use std::path::PathBuf;
use std::time::Instant;

use faelles::{kaede, ordbog};
use grimnir_core::{
    analyser, demasker, foreslaa_med_ordbog, foreslaa_moenstre, laekagetjek, masker, AdvarselArt, AfledtArt, Art, Fund, Ordbog, RestArt,
    Sag, Sikkerhed,
};
use proptest::prelude::*;

const MAIL: &str = "bo.proeve@eksempel-firma.example";

/// Antal steder, hvor `navn` står ved en grænse (ikke et bogstav, et ciffer eller `-` på hver side), uden hensyn til
/// store og små bogstaver.
fn staar(t: &str, navn: &str) -> usize {
    let tl = t.to_ascii_lowercase();
    let n = navn.to_ascii_lowercase();
    let b = tl.as_bytes();
    let mut c = 0;
    let mut p = 0;
    while let Some(i) = tl[p..].find(&n) {
        let s = p + i;
        let e = s + n.len();
        let foer = s == 0 || !(b[s - 1].is_ascii_alphanumeric() || b[s - 1] == b'-');
        let efter = e >= b.len() || !(b[e].is_ascii_alphanumeric() || b[e] == b'-');
        if foer && efter {
            c += 1;
        }
        p = s + 1;
    }
    c
}

/// Fundet med præcis denne tekst (første).
fn fund_af<'a>(t: &str, fund: &'a [Fund], v: &str) -> Option<&'a Fund> {
    fund.iter().find(|f| &t[f.start..f.slut] == v)
}

fn maskér(t: &str, o: &Ordbog, sag: &mut Sag) -> String {
    let f = analyser(t, o);
    let e = foreslaa_med_ordbog(&f, t, sag, o);
    masker(t, &e)
}

/// De fem opdigtede testfiler fra Jans prøve (V-MANUEL.2), byte for byte kopieret til kernens korpus, så testene ikke
/// afhænger af `claude_cowork/` (ignoreret af git).
fn testlog(navn: &str) -> String {
    let p = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("tests")
        .join("korpus")
        .join("manuel2")
        .join(navn);
    std::fs::read_to_string(&p).unwrap_or_else(|_| panic!("{navn} mangler i grimnir-core/tests/korpus/manuel2"))
}

// ─────────────────────────────────────────────────────────────── N2: maskindelen af et fuldt navn

#[test]
fn n2_fqdn_med_et_to_og_tre_led_foran_tekstens_domaene() {
    let t = format!(
        "fra {MAIL}\nsrv1.eksempel-firma.example\nsrv-db02.intern.eksempel-firma.example:5432\nweb03.a.b.eksempel-firma.example/\n"
    );
    let o = Ordbog::ny();
    let f = analyser(&t, &o);
    for (vaert, domaene) in [
        ("srv1", "eksempel-firma.example"),
        ("srv-db02", "intern.eksempel-firma.example"),
        ("web03", "a.b.eksempel-firma.example"),
    ] {
        let v = fund_af(&t, &f, vaert).unwrap_or_else(|| panic!("{vaert} er ikke fundet"));
        assert_eq!((v.art, v.sikkerhed), (Art::Vaert, Sikkerhed::Sikker), "{vaert}");
        let d = fund_af(&t, &f, domaene).unwrap_or_else(|| panic!("{domaene} er ikke fundet"));
        assert_eq!(d.art, Art::Domaene, "{domaene}");
    }
    let mut sag = Sag::default();
    let m = maskér(&t, &o, &mut sag);
    for rest in ["srv1", "srv-db02", "intern", "web03", ".a.b.", "eksempel-firma"] {
        assert!(!m.contains(rest), "{rest} står i det maskerede: {m}");
    }
    assert!(laekagetjek(&m, &sag, &o).is_empty());
    assert_eq!(demasker(&m, &sag).0, t);
}

#[test]
fn n2_bart_navn_foer_og_efter_fqdn_faar_samme_kode_og_bogstaver_spejles() {
    let t = format!("srv-db02 starter\n{MAIL} til srv-db02.intern.eksempel-firma.example\nSRV-DB02 svarer, srv-db02x ikke\n");
    let o = Ordbog::ny();
    let mut sag = Sag::default();
    let m = maskér(&t, &o, &mut sag);
    let kode = sag
        .kode_for_original(grimnir_core::Klasse::Vaert, "srv-db02")
        .expect("srv-db02 har en kode")
        .to_string();
    assert_eq!(staar(&m, "srv-db02"), 0, "{m}");
    assert!(m.contains("srv-db02x"), "et længere ord røres ikke: {m}");
    assert!(m.starts_with(&format!("{kode} starter")), "{m}");
    assert!(m.contains(&format!("{kode}.d")), "{m}");
    assert!(
        m.contains(&format!("{} svarer", kode.to_ascii_uppercase())),
        "store bogstaver spejles: {m}"
    );
    assert_eq!(demasker(&m, &sag).0, t);
}

#[test]
fn n2_unc_og_netbios_findes_og_navnet_alene_bagefter() {
    let t = format!("{MAIL}\n\\\\srv-fil04\\deling\\x.xlsx aabnet af eksempel\\eva\nsrv-fil04 svarer\nkontakt eva@EKSEMPEL.EXAMPLE\n");
    let o = Ordbog::ny();
    let f = analyser(&t, &o);
    let unc = fund_af(&t, &f, "srv-fil04").expect("værten i UNC-stien");
    assert_eq!((unc.art, unc.del_af), (Art::Vaert, Some(grimnir_core::Sammensat::Unc)));
    let nb = fund_af(&t, &f, "eksempel").expect("NetBIOS-domænet med små bogstaver, kendt fra EKSEMPEL.EXAMPLE");
    assert_eq!((nb.art, nb.sikkerhed), (Art::NetbiosDomaene, Sikkerhed::Sikker));
    let mut sag = Sag::default();
    let m = maskér(&t, &o, &mut sag);
    assert_eq!(staar(&m, "srv-fil04"), 0, "{m}");
    assert_eq!(demasker(&m, &sag).0, t);
}

#[test]
fn n2_ordbogens_domaene_som_foer_og_tjenestenavne_forrest_maskeres_i_fqdn_men_ikke_alene() {
    let t = "https://portal.kontor.test/api og www.kontor.test, smtp.kontor.test; portal alene og www alene\n";
    let o = ordbog();
    let f = analyser(t, &o);
    for v in ["portal", "www", "smtp"] {
        let x = fund_af(t, &f, v).unwrap_or_else(|| panic!("{v} i FQDN'et"));
        assert_eq!((x.art, x.del_af), (Art::Vaert, Some(grimnir_core::Sammensat::Fqdn)), "{v}");
    }
    let mut sag = Sag::default();
    let m = maskér(t, &o, &mut sag);
    assert!(
        m.ends_with("; portal alene og www alene\n"),
        "tjenestenavne alene er almindelige ord: {m}"
    );
    assert_eq!(demasker(&m, &sag).0, t);
}

#[test]
fn n2_maskér_aldrig_vinder_over_maskindelen() {
    let t = format!("{MAIL}\nsrv-db02.intern.eksempel-firma.example\nsrv-db02 alene\n");
    let mut o = Ordbog::ny();
    o.aldrig.push("SRV-DB02".into());
    let mut sag = Sag::default();
    let m = maskér(&t, &o, &mut sag);
    assert_eq!(staar(&m, "srv-db02"), 2, "{m}");
    assert!(!m.contains("intern"), "domænet maskeres stadig: {m}");
    assert!(laekagetjek(&m, &sag, &o).is_empty(), "maskér aldrig er ikke en rest");
    // Uden "maskér aldrig" er maskindelen, der står tilbage, en rest (N2): først led som maskine.
    let r = laekagetjek(&m, &sag, &Ordbog::ny());
    assert!(
        r.iter()
            .any(|x| &m[x.start..x.slut] == "srv-db02" && x.art == RestArt::NytFund(Art::Vaert)),
        "{r:?}"
    );
    assert_eq!(demasker(&m, &sag).0, t);
}

#[test]
fn n2_laekagetjekket_melder_maskindel_og_mellemled_foran_en_domaenekode() {
    let mut sag = Sag::default();
    let o = Ordbog::ny();
    let m = maskér(&format!("{MAIL}\n"), &o, &mut sag);
    let d = m.trim_end().rsplit('@').next().expect("domænekoden").to_string();
    assert!(d.starts_with('d') && d.ends_with(".example"), "{d}");
    let gammel = format!("{m}srv-db02.intern.{d}:5432 og h0001.{d} og $pc.{d}\n");
    let r = laekagetjek(&gammel, &sag, &o);
    let tekster: Vec<(&str, RestArt)> = r.iter().map(|x| (&gammel[x.start..x.slut], x.art)).collect();
    assert!(tekster.contains(&("srv-db02", RestArt::NytFund(Art::Vaert))), "{tekster:?}");
    assert!(tekster.contains(&("intern", RestArt::NytFund(Art::Domaene))), "{tekster:?}");
    assert!(
        !tekster.iter().any(|(t, _)| *t == "pc" || *t == "h0001"),
        "en variabel og en kode er ikke rester: {tekster:?}"
    );
}

#[test]
fn n2_demaskering_af_fqdn_kort_navn_og_store_bogstaver() {
    let t = format!("{MAIL}\nsrv-db02.intern.eksempel-firma.example\n");
    let o = Ordbog::ny();
    let mut sag = Sag::default();
    let m = maskér(&t, &o, &mut sag);
    let h = sag
        .kode_for_original(grimnir_core::Klasse::Vaert, "srv-db02")
        .expect("kode")
        .to_string();
    let d = sag
        .kode_for_original(grimnir_core::Klasse::Domaene, "intern.eksempel-firma.example")
        .expect("domænekode")
        .to_string();
    let svar = format!("Tjek {h}.{d} og {} og {h} igen\n", h.to_ascii_uppercase());
    let (ud, adv) = demasker(&svar, &sag);
    assert_eq!(ud, "Tjek srv-db02.intern.eksempel-firma.example og SRV-DB02 og srv-db02 igen\n");
    assert!(adv.iter().any(|a| a.art == AdvarselArt::AfledtForm(AfledtArt::FqdnForkortet)));
    assert!(adv.iter().any(|a| a.art == AdvarselArt::AfledtForm(AfledtArt::AndenStavemaade)));
    assert_eq!(demasker(&m, &sag).0, t);
}

#[test]
fn n2_variabel_foran_fqdn_er_ikke_en_maskine() {
    let t = format!("{MAIL}\nTest-Connection -ComputerName \"$pc.intern.eksempel-firma.example\"\n");
    let o = Ordbog::ny();
    let f = analyser(&t, &o);
    assert!(fund_af(&t, &f, "pc").is_none(), "variablen er ikke en maskine");
    assert_eq!(fund_af(&t, &f, "intern.eksempel-firma.example").map(|x| x.art), Some(Art::Domaene));
    let mut sag = Sag::default();
    let k = kaede(&t, &o, &mut sag);
    assert!(k.maskeret.contains("$pc.d"), "{}", k.maskeret);
    assert!(k.rester.is_empty(), "{:?}", k.rester);
    assert_eq!(k.tilbage, t);
}

// ─────────────────────────────────────────────────────────────── N4: falsk rest i en kodes skabelon

#[test]
fn n4_et_maskeret_ord_i_en_kodes_skabelon_er_ikke_en_rest() {
    let t = format!("{MAIL} og ordet example og user\n");
    let mut o = Ordbog::ny();
    o.ord.push("example".into());
    o.tilfoejede.push(("user".into(), Art::Ord));
    let mut sag = Sag::default();
    let k = kaede(&t, &o, &mut sag);
    assert!(k.maskeret.contains(".example"), "koden har ordet i sin skabelon: {}", k.maskeret);
    assert!(k.rester.is_empty(), "ingen falsk rest: {:?}", k.rester);
    // En rigtig rest uden for en kode meldes stadig (både som original og som fund).
    let m2 = format!("{}example\n", k.maskeret);
    let r = laekagetjek(&m2, &sag, &o);
    assert_eq!(r.len(), 1, "{r:?}");
    assert_eq!(&m2[r[0].start..r[0].slut], "example");
    assert_eq!(k.tilbage, t);
}

// ─────────────────────────────────────────────────────────────── N3: maskinnavne efter placering

#[test]
fn n3_vaertskolonnen_i_forskellige_tidsstempler() {
    let t = concat!(
        "Nov 10 08:00:00 fw-nord01 ACCEPT src=10.20.30.1\n",
        "2026-11-10 08:00:01 srv-web03 fejl: x\n",
        "2026-11-10T08:00:02Z pc-204 kernel: y\n",
        "2026-11-10T08:00:03.123+01:00 dc01 sshd[42]: z\n",
        "<34>1 2026-11-10T08:00:04Z appsrv01 app 1 - besked\n",
        "<13>Nov 10 08:00:05 db1 postgres[7]: ok\n",
        "2026-11-10 08:00:06 kasse3: job startet\n",
        "Nov 10 08:00:07 webserver nginx[9]: started\n",
        "2026-11-10 08:00:08 dc01.intern.eksempel-firma.example Kerberos: TGT\n",
        "senere: srv-web03 og dc01 og webserver og kasse3\n",
    );
    let f = analyser(t, &Ordbog::ny());
    let status = |v: &str| fund_af(t, &f, v).map(|x| (x.art, x.sikkerhed));
    for v in ["fw-nord01", "srv-web03", "pc-204", "dc01", "appsrv01", "db1"] {
        assert_eq!(status(v), Some((Art::Vaert, Sikkerhed::Sandsynlig)), "{v}");
    }
    assert_eq!(status("kasse3"), Some((Art::Vaert, Sikkerhed::TjekSelv)), "kolon lige efter: svag");
    assert_eq!(
        status("webserver"),
        Some((Art::Vaert, Sikkerhed::TjekSelv)),
        "ord uden cifre foran et program: svag"
    );
    assert_eq!(status("intern.eksempel-firma.example"), Some((Art::Domaene, Sikkerhed::Sandsynlig)));
    // Alle steder i teksten: den sidste linje har dem alle (Tjek selv også med samme status).
    let sidste = t.rfind("senere").unwrap_or(0);
    for v in ["srv-web03", "dc01", "webserver", "kasse3"] {
        let s = t[sidste..].find(v).map(|p| sidste + p).expect("står i sidste linje");
        let x = f
            .iter()
            .find(|x| x.start == s)
            .unwrap_or_else(|| panic!("{v} alene er ikke fundet"));
        assert!(x.afledt && x.art == Art::Vaert, "{v}");
    }
    let mut sag = Sag::default();
    let k = kaede(t, &Ordbog::ny(), &mut sag);
    assert_eq!(k.tilbage, t);
    assert!(k.rester.is_empty(), "{:?}", k.rester);
}

/// Almindelige ord og navne, der står hvor en maskine kunne stå, men ikke må foreslås som maskiner.
const IKKE_MASKINER: [&str; 40] = [
    "INFO",
    "WARN",
    "ERROR",
    "DEBUG",
    "notice",
    "fejl",
    "ACCEPT",
    "DROP",
    "login",
    "kunde",
    "job",
    "eth0",
    "ipv6",
    "v2",
    "utf-8",
    "sha256",
    "http2",
    "deadbeef01",
    "x86",
    "Thread-12",
    "worker-3",
    "step2",
    "localhost",
    "systemd",
    "CRON",
    "kernel",
    "sudo",
    "daemon",
    "process",
    "scheduler",
    "the",
    "Started",
    "Service",
    "Request",
    "level",
    "main",
    "pool-1-thread-2",
    "backup",
    "amd64",
    "ens33",
];

fn stoej() -> String {
    [
        "2026-11-10 08:00:00 INFO Starting service on port 8080",
        "2026-11-10 08:00:01 WARN Disk usage above 80 percent",
        "2026-11-10 08:00:02 ERROR Connection refused",
        "2026-11-10 08:00:03 DEBUG cache hit ratio 0.93",
        "2026-11-10 08:00:04 [main] INFO app started",
        "2026-11-10T08:00:05Z level=info msg=\"request done\" status=200",
        "2026-11-10T08:00:06.123+01:00 notice: backup started",
        "2026-11-10 08:00:07 fejl: forbindelse afvist",
        "2026-11-10 08:00:08 ACCEPT src=10.20.30.1 dst=10.20.30.2",
        "2026-11-10 08:00:09 DROP src=10.20.30.3 dst=10.20.30.4",
        "2026-11-10 08:00:10 login ok for bruger",
        "2026-11-10 08:00:11 kunde ringede om printer",
        "2026-11-10 08:00:12 job startet af planlaeggeren",
        "2026-11-10 08:00:13 eth0: link up 1000 Mbps",
        "2026-11-10 08:00:14 ipv6: address added",
        "2026-11-10 08:00:15 v2: migration done",
        "2026-11-10 08:00:16 utf-8 encoding detected",
        "2026-11-10 08:00:17 sha256 checksum ok",
        "2026-11-10 08:00:18 Request GET /api/v1/items 200",
        "2026-11-10 08:00:19 http2 stream opened",
        "2026-11-10 08:00:20 deadbeef01 transaction id",
        "2026-11-10 08:00:21 x86 build loaded",
        "2026-11-10 08:00:22 Thread-12 waiting",
        "2026-11-10 08:00:23 worker-3 picked job 17",
        "2026-11-10 08:00:24 step2: done",
        "2026-11-10 08:00:25 pool-1-thread-2 idle",
        "2026-11-10 08:00:26 amd64 image ok",
        "2026-11-10 08:00:27 ens33 up",
        "Nov 10 08:00:28 systemd[1]: Started Daily cleanup.",
        "Nov 10 08:00:29 CRON[2211]: (root) CMD (run-parts /etc/cron.hourly)",
        "Nov 10 08:00:30 kernel: [12.345] usb 1-1: new device",
        "Nov 10 08:00:31 sudo: pam_unix(sudo:session): session opened",
        "Nov 10 08:00:32 localhost sshd[812]: Server listening on 0.0.0.0 port 22.",
        "Nov 10 08:00:33 the daemon sshd[100]: started",
        "Nov 10 08:00:34 Started process cron[55]: ok",
        "Service started at 2026-11-10 08:00:35 by scheduler sshd[9]: ready",
        // Logniveauer og ord fra en logs faste tekst foran et program (listen over ord, der aldrig er en maskine).
        "2026-11-10 08:00:36 ERROR kernel: oops",
        "2026-11-10 08:00:37 info sshd[5]: ok",
        "Nov 10 08:00:38 accept postfix/smtp: x",
        "",
    ]
    .join("\n")
}

#[test]
fn n3_almindelige_ord_foreslaas_ikke_som_maskiner() {
    let t = stoej();
    let f = analyser(&t, &Ordbog::ny());
    let vaerter: Vec<&str> = f.iter().filter(|x| x.art == Art::Vaert).map(|x| &t[x.start..x.slut]).collect();
    for ord in IKKE_MASKINER {
        assert!(!vaerter.contains(&ord), "{ord} er foreslået som maskine: {vaerter:?}");
    }
    assert!(vaerter.is_empty(), "ingen maskiner i støjen: {vaerter:?}");
}

#[test]
fn n3_testfilerne_giver_de_forventede_maskiner_og_ingen_staar_tilbage() {
    let o = Ordbog::ny();
    // (fil, navne med status Sandsynlig eller Sikker, navne med status Tjek selv, navne uden sammenhæng, der står tilbage)
    type Forventet<'a> = (&'a str, &'a [&'a str], &'a [&'a str], &'a [&'a str]);
    let forventet: [Forventet; 5] = [
        ("01-firewall-lille.log", &["fw-nord01", "fw-syd02"], &[], &[]),
        (
            "02-blandet-stor.log",
            &[
                "fw-nord01",
                "fw-syd02",
                "srv-db02",
                "srv-web03",
                "srv-fil04",
                "dc01",
                "pc-204",
                "pc-17",
                "mail01",
                "vpn01",
                "nas-arkiv",
                "db1",
                "portal",
            ],
            &[],
            &[],
        ),
        (
            "03-script.ps1",
            &["srv-db02", "mail01", "portal", "nas-arkiv"],
            &[],
            &["pc-17", "pc-204", "dc01"],
        ),
        ("04-til-masker-dette.log", &[], &["db1", "pc-17", "kasse3", "printer-gang2"], &[]),
        ("05-hemmeligheder.conf", &["srv-db02", "mail01", "portal"], &[], &[]),
    ];
    for (fil, sikre, tjek, tilbage) in forventet {
        let t = testlog(fil);
        let f = analyser(&t, &o);
        for v in sikre {
            let x = f
                .iter()
                .find(|x| t[x.start..x.slut].eq_ignore_ascii_case(v))
                .unwrap_or_else(|| panic!("{fil}: {v} mangler"));
            assert!(
                x.art == Art::Vaert && matches!(x.sikkerhed, Sikkerhed::Sikker | Sikkerhed::Sandsynlig),
                "{fil}: {v} {x:?}"
            );
        }
        for v in tjek {
            let x = f
                .iter()
                .find(|x| &t[x.start..x.slut] == *v)
                .unwrap_or_else(|| panic!("{fil}: {v} mangler"));
            assert_eq!((x.art, x.sikkerhed), (Art::Vaert, Sikkerhed::TjekSelv), "{fil}: {v}");
        }
        let mut sag = Sag::default();
        let k = kaede(&t, &o, &mut sag);
        assert_eq!(k.tilbage, t, "{fil}: rundturen");
        for v in sikre {
            assert_eq!(staar(&k.maskeret, v), 0, "{fil}: {v} står i det maskerede");
        }
        for v in tilbage {
            assert!(
                staar(&k.maskeret, v) > 0,
                "{fil}: {v} har ingen sammenhæng og bør stå (forventningen er forkert)"
            );
        }
        assert!(!k.maskeret.contains(".intern."), "{fil}: mellemleddet står tilbage");
    }
}

#[test]
fn n3_korpus_ordbogens_moenster_vinder_og_kolonnen_aendrer_intet_andet() {
    let t = std::fs::read_to_string(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/korpus/syslog.log")).expect("syslog.log");
    let f = analyser(&t, &ordbog());
    let v = f.iter().find(|x| t[x.start..x.slut].starts_with("srv-")).expect("srv-###");
    assert_eq!(
        (v.art, v.sikkerhed),
        (Art::Vaert, Sikkerhed::Ordbog),
        "ordbogens navnemønster giver status Ordbog"
    );
}

// ─────────────────────────────────────────────────────────────── N3: mønstre

fn moenstre(t: &str, o: &Ordbog) -> Vec<(String, usize)> {
    let f = analyser(t, o);
    foreslaa_moenstre(t, &f, o).into_iter().map(|m| (m.moenster, m.navne)).collect()
}

#[test]
fn n3_moenstre_paa_testfilerne_og_korpus() {
    let o = Ordbog::ny();
    assert_eq!(moenstre(&testlog("01-firewall-lille.log"), &o), vec![("fw-*".to_string(), 2)]);
    assert_eq!(
        moenstre(&testlog("02-blandet-stor.log"), &o),
        vec![("srv-*".to_string(), 3), ("fw-*".to_string(), 2), ("pc-*".to_string(), 2)]
    );
    for fil in ["03-script.ps1", "04-til-masker-dette.log", "05-hemmeligheder.conf"] {
        assert!(moenstre(&testlog(fil), &o).is_empty(), "{fil}");
    }
    assert!(moenstre(&stoej(), &o).is_empty(), "støjen");
    let syslog = std::fs::read_to_string(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/korpus/syslog.log")).expect("syslog");
    assert_eq!(moenstre(&syslog, &o), vec![("srv-###".to_string(), 28)], "uden ordbog");
    assert!(moenstre(&syslog, &ordbog()).is_empty(), "ordbogen har srv-### i forvejen");
}

#[test]
fn n3_moenstre_reglerne() {
    let o = Ordbog::ny();
    let linje = |v: &str| format!("2026-11-10 08:00:00 {v} fejl: x\n");
    let t: String = ["dc01", "dc02", "dc10", "pc-17", "pc-204", "ws-1001", "ws-1002", "mail01", "web-a1"]
        .iter()
        .map(|v| linje(v))
        .collect();
    assert_eq!(
        moenstre(&t, &o),
        vec![("dc##".to_string(), 3), ("pc-*".to_string(), 2), ("ws-####".to_string(), 2)]
    );
    // Et mønster, ordbogen har, foreslås ikke igen; tjenestenavne som præfiks heller ikke.
    let mut o2 = Ordbog::ny();
    o2.navnemoenstre.push("DC##".into());
    let t2 = format!("{t}{}{}", linje("vpn01"), linje("vpn02"));
    let m = moenstre(&t2, &o2);
    assert!(!m.iter().any(|(x, _)| x == "dc##" || x.starts_with("vpn")), "{m:?}");
    // Forslaget viser ikke præfikset i Debug.
    let f = analyser(&t, &o);
    let d = format!("{:?}", foreslaa_moenstre(&t, &f, &o));
    assert!(!d.contains("dc") && !d.contains("pc-"), "{d}");
}

// ─────────────────────────────────────────────────────────────── ydelse

#[test]
fn ydelse_den_store_proeve_analyseres_hurtigt() {
    // 02-blandet-stor.log 20 gange (4,8 MB, lige under Maskérs grænse på 5 MiB). Grænsen er vid, fordi testen også
    // kører uoptimeret; tallene før og efter i release står i HANDOFF-V-MANUEL.2.
    let t = testlog("02-blandet-stor.log").repeat(20);
    let start = Instant::now();
    let f = analyser(&t, &Ordbog::ny());
    let analyse = start.elapsed();
    let start = Instant::now();
    let m = foreslaa_moenstre(&t, &f, &Ordbog::ny());
    let forslag = start.elapsed();
    assert_eq!(m.len(), 3);
    assert!(analyse.as_secs_f64() < 30.0, "analysen tog {analyse:?}");
    assert!(forslag.as_secs_f64() < 2.0, "forslagene tog {forslag:?}");
}

// ─────────────────────────────────────────────────────────────── egenskabstest

const NAVNE: [&str; 6] = ["srv-db02", "fw-nord01", "pc-17", "dc01", "nas-arkiv", "mail01"];
const MELLEM: [&str; 3] = ["", "intern.", "a.b."];
// `:443` og ikke `:5432`: støjen `Sn:` foran gør et tal på fire cifre til et serienummer, og et rent tal genbruges ikke
// som ord andre steder (det står tilbage og meldes rigtigt som rest; se HANDOFF-V-MANUEL.2, sideeffekt-fund).
const SKILLE: [&str; 8] = [" ", "\n", "\r\n", ":443 ", "/", "\"", ",", "\t"];

#[derive(Clone, Debug)]
enum Stykke {
    Fqdn(usize, usize, bool),
    Alene(usize, bool),
    Kolonne(usize),
    Unc(usize),
    Stoej(String),
}

/// V-OPBYG.4 N6: nøgleordene, kernens genkendere af hemmeligheder bruger (`analyse.rs`, `hemmeligheder`), som kan stå i et
/// stykke støj på højst seks tegn (også som del af et længere: `pass` i `passwd`, `token` i `x-token`). Hvert stykke
/// efterfølges af et skilletegn uden bogstaver, så et nøgleord kan ikke dannes på tværs af to stykker.
const NOEGLEORD: [&str; 8] = ["pwd", "pass", "secret", "token", "apikey", "key", "bearer", "set"];

/// Sand, hvis støjen kan danne et nøgleord for en hemmelighed (uden hensyn til store/små bogstaver). Så kunne et tal i
/// teksten blive en adgangskode (`pWD:443`), og når tallet står et andet sted, er resten rigtig (Jans svar 1, V-OPBYG.4):
/// egenskabstesten skal ikke lave den slags tekst; den almindelige test `opbyg4_kerne::n6_en_hemmeligheds_vaerdi_alene_et_
/// andet_sted_giver_en_rest` viser advarslen.
fn har_noegleord(x: &str) -> bool {
    let l = x.to_ascii_lowercase();
    NOEGLEORD.iter().any(|n| l.contains(n))
}

/// V-OPBYG.5 N1 (Jans svar 1): kernens andre nøgleord, der kan stå i et stykke støj på højst seks tegn: brugere (`uid`,
/// `user`, `login`; `uid` i `uId:443` gjorde 443 til en bruger), databaser (`db`, `use`; `Db=` foran et FQDN), serienumre
/// (`sn`, `serial`, `devid`) og maskiner (`host`, `addr`, `server`). Med dem kunne støjen selv blive et navn, og testen
/// skal kun prøve maskinnavnene i [`NAVNE`]. Hvad kernen gør med hver klasse, viser de almindelige tests
/// `n1_klasse_*` i `opbyg5_kerne.rs`.
const ANDRE_NOEGLEORD: [&str; 11] = ["uid", "user", "login", "db", "use", "sn", "serial", "devid", "host", "addr", "server"];

/// Sand, hvis støjen kan danne et af [`ANDRE_NOEGLEORD`] (uden hensyn til store/små bogstaver).
fn har_andet_noegleord(x: &str) -> bool {
    let l = x.to_ascii_lowercase();
    ANDRE_NOEGLEORD.iter().any(|n| l.contains(n))
}

/// V-OPBYG.5 N1: sand, hvis støjen har en NetBIOS-form: et bogstav eller ciffer, en eller to skråstreger og et bogstav eller
/// ciffer (`IX\1`). Så bliver `IX` et NetBIOS-domæne, og `Ix` et andet sted er en rigtig rest (reglen om to tegn).
fn har_netbios_form(x: &str) -> bool {
    let b = x.as_bytes();
    let an = |i: usize| b.get(i).is_some_and(u8::is_ascii_alphanumeric);
    (1..b.len()).any(|i| b[i] == b'\\' && an(i + 1) && (an(i - 1) || (b[i - 1] == b'\\' && i >= 2 && an(i - 2))))
}

fn stykke() -> impl Strategy<Value = Stykke> {
    prop_oneof![
        (0..NAVNE.len(), 0..MELLEM.len(), any::<bool>()).prop_map(|(n, m, s)| Stykke::Fqdn(n, m, s)),
        (0..NAVNE.len(), any::<bool>()).prop_map(|(n, s)| Stykke::Alene(n, s)),
        (0..NAVNE.len()).prop_map(Stykke::Kolonne),
        (0..NAVNE.len()).prop_map(Stykke::Unc),
        "[ -~]{0,6}"
            .prop_filter("støjen danner ikke et nøgleord for en hemmelighed", |x| !har_noegleord(x))
            .prop_filter("støjen danner ikke et andet nøgleord eller en NetBIOS-form", |x| {
                !har_andet_noegleord(x) && !har_netbios_form(x)
            })
            .prop_map(Stykke::Stoej),
    ]
}

/// V-OPBYG.5 N1: generatorens nye filter: de tre klasser fra HANDOFF-V-OPBYG.4 (sideeffekt-fund 1) og de andre nøgleord
/// slipper ikke igennem; almindelig støj gør.
#[test]
fn n1_stoejen_danner_ikke_andre_noegleord_eller_netbios() {
    for x in ["uId", "Db=", "sn:", "USER", "login", "use a;", "Serial", "devid", "host:", "addr", "server"] {
        assert!(har_andet_noegleord(x), "{x}");
    }
    for x in ["IX\\1", "a\\\\b", "A0\\p", "x\\y"] {
        assert!(har_netbios_form(x), "{x}");
    }
    for x in ["Ix", "P", ":443", "srv", "\\\\", "a\\", "\\b", "a \\b", "s n", "d-b"] {
        assert!(!har_andet_noegleord(x) && !har_netbios_form(x), "{x}");
    }
}

/// V-OPBYG.4 N6: generatorens filter: de nøgleord, der gav en rigtig rest (`pWD:443`), og de andre slipper ikke igennem.
#[test]
fn n6_stoejen_danner_ikke_et_noegleord() {
    for x in ["pWD", "x:pass", "Secret", "TOKEN", "apikey", "a key", "bearer", "set"] {
        assert!(har_noegleord(x), "{x}");
    }
    for x in ["A0\\p", "P", ":443", "srv", "pw d"] {
        assert!(!har_noegleord(x), "{x}");
    }
}

proptest! {
    #![proptest_config(ProptestConfig { cases: 256, ..ProptestConfig::default() })]

    /// V-MANUEL.2 N5: maskinnavne i FQDN'er under tekstens domæne (et, to og tre led foran), alene (også med store
    /// bogstaver), i værtskolonnen og i UNC-stier, blandet med støj: maskér → lækagetjek → demaskér giver teksten
    /// bytepræcist, ingen rester, og et navn, der har stået i et FQDN, står ikke tilbage nogen steder (ved en grænse).
    #[test]
    fn maskinnavne_rundtur_og_intet_tilbage(dele in prop::collection::vec((stykke(), 0..SKILLE.len()), 1..25)) {
        let mut t = format!("{MAIL}\n");
        let mut fqdn = std::collections::BTreeSet::new();
        for (s, k) in dele {
            match s {
                Stykke::Fqdn(n, m, store) => {
                    let navn = if store { NAVNE[n].to_ascii_uppercase() } else { NAVNE[n].to_string() };
                    t.push_str(&format!("{navn}.{}eksempel-firma.example", MELLEM[m]));
                    fqdn.insert(NAVNE[n]);
                }
                Stykke::Alene(n, store) => t.push_str(&if store { NAVNE[n].to_ascii_uppercase() } else { NAVNE[n].to_string() }),
                Stykke::Kolonne(n) => t.push_str(&format!("\n2026-11-10 08:00:00 {} fejl: x\n", NAVNE[n])),
                Stykke::Unc(n) => t.push_str(&format!("\\\\{}\\deling\\x", NAVNE[n])),
                Stykke::Stoej(x) => t.push_str(&x),
            }
            t.push_str(SKILLE[k]);
        }
        let o = Ordbog::ny();
        let mut sag = Sag::default();
        let k = kaede(&t, &o, &mut sag);
        prop_assert_eq!(&k.tilbage, &t);
        prop_assert!(k.rester.is_empty(), "rester: {:?}", k.rester.iter().map(|r| &k.maskeret[r.start..r.slut]).collect::<Vec<_>>());
        for n in fqdn {
            prop_assert_eq!(staar(&k.maskeret, n), 0, "{} står i {}", n, k.maskeret);
        }
        prop_assert!(!k.maskeret.contains("eksempel-firma"));
        prop_assert_eq!(demasker(&k.maskeret, &sag).0, t);
    }
}
