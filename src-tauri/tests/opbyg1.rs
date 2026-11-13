//! V-OPBYG.1 N7: Lås i titellinjen (kommandoen `laas_nu`) låser ad samme vej som lås ved stilstand ([`laas_igen`] med
//! [`Udloeser::Bruger`]): Grimnir er låst bagefter, låsens grund er `bruger` (hændelsen `laast` til webvisningen), en
//! kommando, der bruger sagen, svarer `Laast`, og en lås, mens der allerede er låst, gør intet. D21's regler for den
//! midlertidige sag og udklipsholderen er de samme som ved stilstand (prøvet i laas4.rs, laas6.rs og kvit1.rs med
//! `laas_igen`). Kun opdigtede data; nøglerne i hukommelsen.

use grimnir_lib::laas::{HukommelsesDoer, Svar, Udloeser};
use grimnir_lib::maskering::{analyser, laas_igen, laas_op, laas_status, Tilstand, UiFejl};

#[test]
fn laas_nu_laaser_som_stilstand_og_goer_intet_naar_der_er_laast() {
    let t = Tilstand::ny();
    // Tilstand::ny() starter ulåst i tests (som efter laas_op); en analyse virker.
    assert!(!laas_status(&t).laast);
    assert!(analyser(&t, "srcip=192.0.2.10 vaert=srv-db02.eksempel.dk\n", None, &[]).is_ok());
    assert!(laas_igen(&t, Udloeser::Bruger), "en åben Grimnir låses");
    let st = laas_status(&t);
    assert!(st.laast);
    assert_eq!(st.igen, Some(Udloeser::Bruger));
    assert_eq!(serde_json::to_string(&Udloeser::Bruger).unwrap(), "\"bruger\"");
    assert!(matches!(analyser(&t, "srcip=192.0.2.10\n", None, &[]), Err(UiFejl::Laast)));
    assert!(!laas_igen(&t, Udloeser::Bruger), "en låst Grimnir låses ikke igen");
    let ud = laas_op(&t, &HukommelsesDoer::ny(Svar::Ok), "da");
    assert!(!ud.status.laast);
}

/// V-OPBYG.1 N7: kommandoen `laas_nu` går den ene vej, notifikationerne også går ([`laas_igen_og_meld`] i lib.rs: låser og
/// melder `laast`), med grunden `Bruger`; den er registreret og tilladt.
#[test]
fn laas_nu_er_samme_vej_som_de_andre_laase() {
    let kilde = |f: &str| std::fs::read_to_string(std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR")).join(f)).unwrap();
    let lib = kilde("src/lib.rs");
    assert!(lib.contains("fn laas_nu(app: tauri::AppHandle) {\n    laas_igen_og_meld(&app, Udloeser::Bruger);\n}"));
    assert!(lib.contains("        laas_nu,\n"));
    assert!(kilde("build.rs").contains("\"laas_nu\""));
    assert!(kilde("capabilities/default.json").contains("\"allow-laas-nu\""));
    assert!(kilde("build.rs").contains("\"vejledning_aabn\""));
    assert!(kilde("capabilities/default.json").contains("\"allow-vejledning-aabn\""));
}
