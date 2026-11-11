//! V-PUDS.2 N1 (skallen uden vindue): en selvvalgt kode, der kommer tilbage med andre store/små bogstaver, sættes tilbage,
//! og Demaskér-tabellen får rækken "anden stavemåde" med koden, antal og linje. Stederne tælles med i `tilbage`. Kun
//! opdigtede værdier (`kontor.test`, RFC 1918, opfundne navne).

use grimnir_lib::maskering::{analyser, demasker, gem_og_masker, Analyse, Raekke, Rettelse, Tilstand};

const TEKST: &str = "hostname=fw01 srcip=10.20.30.11\r\nuser=\"bruger060\"\r\n";

fn raekke<'a>(a: &'a Analyse, vaerdi: &str) -> &'a Raekke {
    a.raekker
        .iter()
        .find(|r| r.vaerdier.iter().any(|v| v == vaerdi))
        .unwrap_or_else(|| panic!("ingen række for testværdien {vaerdi}"))
}

fn fravalgt(a: &Analyse) -> Vec<usize> {
    a.raekker.iter().filter(|r| !r.valgt).map(|r| r.id).collect()
}

/// Maskerer TEKST med den selvvalgte kode `fw-ydre` for maskinen.
fn tilstand_med_fw_ydre() -> Tilstand {
    let t = Tilstand::ny();
    let a = analyser(&t, TEKST, None, &[]).unwrap();
    let ret = [Rettelse {
        id: raekke(&a, "fw01").id,
        kode: "fw-ydre".into(),
    }];
    let a2 = analyser(&t, TEKST, Some(&fravalgt(&a)), &ret).unwrap();
    assert!(a2.fejl.is_empty(), "{:?}", a2.fejl);
    let m = gem_og_masker(&t, TEKST, &fravalgt(&a), &ret).unwrap();
    assert!(m.maskeret.starts_with("hostname=fw-ydre "), "{}", m.maskeret);
    t
}

#[test]
fn selvvalgt_kode_med_store_bogstaver_saettes_tilbage_med_raekke_antal_og_linje() {
    let t = tilstand_med_fw_ydre();
    // Linje 1 uden koder, FW-YDRE to gange på linje 2, Fw-Ydre på linje 3, koden som den er på linje 4; CRLF.
    let svar = "Svar fra leverandøren\r\nFW-YDRE og FW-YDRE\r\nFw-Ydre\r\nfw-ydre\r\n";
    let d = demasker(&t, svar).unwrap();
    assert_eq!(d.tekst, "Svar fra leverandøren\r\nFW01 og FW01\r\nfw01\r\nfw01\r\n");
    // Rækkerne i Demaskér-tabellen (pr. art og kode): antal og første linje.
    let r: Vec<(&str, &str, usize, usize)> = d
        .advarsler
        .iter()
        .map(|a| (a.art, a.kode.as_str(), a.antal, a.linje))
        .filter(|a| a.0 == "anden_stavemaade")
        .collect();
    assert_eq!(r, [("anden_stavemaade", "FW-YDRE", 2, 2), ("anden_stavemaade", "Fw-Ydre", 1, 3)]);
    // Posten er brugt (ingen "ikke brugt"), og alle fire steder tælles med i "sat tilbage" fra det første (linje 2).
    assert!(
        !d.advarsler.iter().any(|a| a.art == "ikke_brugt" && a.kode == "fw-ydre"),
        "{:?}",
        d.advarsler
    );
    let x = d.tilbage.iter().find(|x| x.kode == "fw-ydre").expect("fw-ydre i tilbage");
    assert_eq!((x.antal, x.linje), (4, 2));
    assert_eq!(d.tilbage.iter().map(|x| x.kode.as_str()).collect::<Vec<_>>(), d.koder);
    // Ingen original i rækkerne eller tallene (JSON-svaret til webvisningen, uden selve teksten).
    let mut json = serde_json::to_value(&d).unwrap();
    json.as_object_mut().unwrap().remove("tekst");
    let json = json.to_string();
    assert!(!json.contains("fw01") && !json.contains("FW01"), "{json}");
}

#[test]
fn selvvalgt_kode_inde_i_et_ord_staar_urort() {
    let t = tilstand_med_fw_ydre();
    let d = demasker(&t, "xFW-YDRE FW-YDREx\r\n").unwrap();
    assert_eq!(d.tekst, "xFW-YDRE FW-YDREx\r\n");
    assert!(d.tilbage.is_empty());
    assert!(!d.advarsler.iter().any(|a| a.art == "anden_stavemaade"));
    assert!(d.advarsler.iter().any(|a| a.art == "ikke_brugt" && a.kode == "fw-ydre"));
}
