//! V-MANUEL.1 N1 (skallen uden vindue): værdier, brugeren selv peger på i teksten ("Maskér dette").
//!
//! - `analyser_med` og `gem_og_masker_med` tager de tilføjede værdier; de står i rækkerne som alle andre fund, med
//!   `tilfoejet` og et svar pr. værdi (række, antal, hvorfor afvist).
//! - Typen giver kodens form; en rettet kode bliver ved et typeskift.
//! - Tomme værdier, linjeskift, ukendte typer, sagens koder og værdier på "maskér aldrig" afvises med en grund.
//! - Gem og maskér lægger dem i sagen (svaret kan demaskeres), ordbogen ændres ikke, og kvitteringen tæller dem.
//! - Intet om dem står i en fejl, en `Debug`-udskrift, svarene uden rækkernes værdier eller en log.
//!
//! Kun opdigtede værdier (`kontor.test`, RFC 1918, opfundne navne). Tests rører aldrig Nøglering eller udklipsholderen.

use grimnir_lib::maskering::{
    analyser, analyser_med, demasker, gem_og_masker_med, kvittering, ordbog_hent, ordbog_tilfoej, Analyse, AnalyseMed, Raekke, Rettelse,
    Tilfoejet, Tilstand, UiFejl, TILFOEJ_ARTER,
};

const TEKST: &str = "login bruger jdoe fra 10.20.30.11\nfejl for JDoe; jdoe2 og xjdoe ignoreres\n";

fn t(vaerdi: &str, art: &str) -> Tilfoejet {
    Tilfoejet {
        vaerdi: vaerdi.into(),
        art: art.into(),
    }
}

fn raekke(a: &AnalyseMed, nr: usize) -> &Raekke {
    a.raekker
        .iter()
        .find(|r| r.tilfoejet == Some(nr))
        .unwrap_or_else(|| panic!("ingen række for tilføjet nr. {nr}"))
}

fn fravalgt(a: &Analyse) -> Vec<usize> {
    a.raekker.iter().filter(|r| !r.valgt).map(|r| r.id).collect()
}

#[test]
fn en_tilfoejet_vaerdi_bliver_en_raekke_med_alle_forekomster() {
    let ts = Tilstand::ny();
    let a = analyser_med(&ts, TEKST, None, &[], &[t("jdoe", "bruger")]).unwrap();
    let r = raekke(&a, 0);
    assert_eq!(r.art, "bruger");
    assert_eq!(r.antal, 2, "jdoe og JDoe, ikke jdoe2 og xjdoe");
    assert_eq!(r.vaerdier, ["jdoe", "JDoe"]);
    assert!(r.valgt && r.standard && !r.laast && !r.hemmelig);
    assert!(r.koder.iter().all(|k| k.to_ascii_lowercase().starts_with("user")), "{:?}", r.koder);
    assert_eq!(r.id, TEKST.find("jdoe").unwrap());
    assert_eq!(a.tilfoejede.len(), 1);
    let x = &a.tilfoejede[0];
    assert_eq!((x.nr, x.raekke, x.antal, x.afvist), (0, Some(r.id), 2, None));
    // De andre rækker er ikke tilføjede.
    assert!(a.raekker.iter().filter(|x| x.id != r.id).all(|x| x.tilfoejet.is_none()));
}

#[test]
fn uden_tilfoejede_er_analysen_som_foer() {
    let ts = Tilstand::ny();
    let a = analyser(&ts, TEKST, None, &[]).unwrap();
    let b = analyser_med(&ts, TEKST, None, &[], &[]).unwrap();
    // Webvisningen får ét objekt: Analyse-felterne og tilfoejede (tom).
    let mut jb = serde_json::to_value(&b).unwrap();
    assert_eq!(jb.as_object_mut().unwrap().remove("tilfoejede"), Some(serde_json::json!([])));
    // V-OPBYG.2 N3: og stederne i teksten (til markeringen); de står ikke i `Analyse`.
    assert_eq!(
        jb.as_object_mut().unwrap().remove("steder"),
        Some(serde_json::to_value(&b.steder).unwrap())
    );
    assert!(!b.steder.is_empty());
    assert_eq!(serde_json::to_value(&a).unwrap(), jb);
    assert!(b.tilfoejede.is_empty() && a.raekker.iter().all(|r| r.tilfoejet.is_none()));
}

#[test]
fn typen_giver_kodens_form_og_en_rettelse_bliver_ved_et_typeskift() {
    let ts = Tilstand::ny();
    for (art, start) in [
        ("vaert", "h"),
        ("bruger", "user"),
        ("ord", "ord"),
        ("person", "person "),
        ("domaene", "d"),
    ] {
        let a = analyser_med(&ts, TEKST, None, &[], &[t("jdoe", art)]).unwrap();
        let r = raekke(&a, 0);
        assert_eq!(r.art, art);
        assert!(r.koder[0].to_ascii_lowercase().starts_with(start), "{art}: {:?}", r.koder);
    }
    // Alle typer, valglisten kan give, er nogle, skallen kender.
    assert_eq!(TILFOEJ_ARTER.len(), 8);
    let a = analyser_med(&ts, TEKST, None, &[], &[t("jdoe", "bruger")]).unwrap();
    let id = raekke(&a, 0).id;
    let ret = [Rettelse {
        id,
        kode: "konto-a".into(),
    }];
    for art in ["bruger", "vaert"] {
        let b = analyser_med(&ts, TEKST, Some(&fravalgt(&a)), &ret, &[t("jdoe", art)]).unwrap();
        assert!(b.fejl.is_empty(), "{:?}", b.fejl);
        let r = raekke(&b, 0);
        // To stavemåder (jdoe, JDoe): hele enheden omdøbes, og kernen giver den anden et bogstav bagefter (V-SKAL.2).
        assert!(
            r.rettet && r.koder[0] == "konto-a" && r.koder.iter().all(|k| k.starts_with("konto-a")),
            "{art}: {:?}",
            r.koder
        );
    }
}

#[test]
fn afviste_vaerdier_faar_en_grund_og_ingen_raekke() {
    let ts = Tilstand::ny();
    ordbog_tilfoej(&ts, "aldrig", "fra", None).unwrap();
    // Først en maskering, så sagen har koden for jdoe.
    let a = analyser_med(&ts, TEKST, None, &[], &[t("jdoe", "bruger")]).unwrap();
    let kode = raekke(&a, 0).koder[0].clone();
    gem_og_masker_med(&ts, TEKST, &fravalgt(&a), &[], &[t("jdoe", "bruger")]).unwrap();
    let svar = format!("svar til {kode} og {}", kode.to_ascii_uppercase());
    let liste = [
        t("", "ord"),
        t("   ", "ord"),
        t("login\nbruger", "ord"),
        t("bruger", "ipv4_egen"),
        t("bruger", "hemmelighed"),
        t("bruger", "noget"),
        t(&kode, "ord"),
        t(&kode.to_ascii_uppercase(), "ord"),
        t("FRA", "ord"),
        t("  svar  ", "ord"),
    ];
    let b = analyser_med(&ts, &svar, None, &[], &liste).unwrap();
    let grunde: Vec<Option<&str>> = b.tilfoejede.iter().map(|x| x.afvist).collect();
    assert_eq!(
        grunde,
        [
            Some("tom"),
            Some("tom"),
            Some("linjeskift"),
            Some("type"),
            Some("type"),
            Some("type"),
            Some("kode"),
            Some("kode"),
            Some("aldrig"),
            None
        ]
    );
    assert!(b.tilfoejede[..9].iter().all(|x| x.raekke.is_none() && x.antal == 0));
    // Mellemrum i enderne skæres af: "svar" findes én gang.
    assert_eq!(
        (b.tilfoejede[9].antal, b.raekker.iter().filter(|r| r.tilfoejet.is_some()).count()),
        (1, 1)
    );
}

#[test]
fn en_vaerdi_inde_i_et_laengere_fund_faar_nul_steder() {
    let ts = Tilstand::ny();
    ordbog_tilfoej(&ts, "domaene", "kontor.test", None).unwrap();
    let tekst = "ssh srv-068.kontor.test\n";
    let a = analyser_med(&ts, tekst, None, &[], &[t("srv", "vaert"), t("068.kon", "ord")]).unwrap();
    for x in &a.tilfoejede {
        assert_eq!((x.raekke, x.antal, x.afvist), (None, 0, None), "{x:?}");
    }
    assert!(a.raekker.iter().all(|r| r.tilfoejet.is_none()));
}

#[test]
fn gem_og_masker_laegger_dem_i_sagen_svaret_kan_demaskeres_og_ordbogen_er_uaendret() {
    let ts = Tilstand::ny();
    let liste = [t("jdoe", "bruger"), t("ignoreres", "ord")];
    let a = analyser_med(&ts, TEKST, None, &[], &liste).unwrap();
    let m = gem_og_masker_med(&ts, TEKST, &fravalgt(&a), &[], &liste).unwrap();
    assert!(
        !m.maskeret.contains("jdoe\n") && !m.maskeret.contains("JDoe") && !m.maskeret.contains("ignoreres"),
        "{}",
        m.maskeret
    );
    assert!(m.maskeret.contains("jdoe2 og xjdoe"), "kun hele ord: {}", m.maskeret);
    assert!(m.rester.is_empty(), "{:?}", m.rester);
    let d = demasker(&ts, &m.maskeret).unwrap();
    assert_eq!(d.tekst, TEKST);
    assert!(ordbog_hent(&ts).unwrap().poster.is_empty(), "ordbogen er urørt");
    // En ny analyse uden de tilføjede finder dem som sagens kendte værdier (F1).
    let b = analyser(&ts, "igen jdoe\n", None, &[]).unwrap();
    assert!(b.raekker.iter().any(|r| r.vaerdier == ["jdoe"] && r.kendt), "{:?}", b.raekker);
}

#[test]
fn en_fravalgt_tilfoejet_raekke_maskeres_ikke_og_er_ikke_en_rest() {
    let ts = Tilstand::ny();
    let liste = [t("jdoe", "bruger")];
    let a = analyser_med(&ts, TEKST, None, &[], &liste).unwrap();
    let mut fra = fravalgt(&a);
    fra.push(raekke(&a, 0).id);
    let b = analyser_med(&ts, TEKST, Some(&fra), &[], &liste).unwrap();
    assert!(!raekke(&b, 0).valgt);
    let m = gem_og_masker_med(&ts, TEKST, &fra, &[], &liste).unwrap();
    assert!(
        m.maskeret.contains("bruger jdoe fra") && m.maskeret.contains("JDoe"),
        "{}",
        m.maskeret
    );
    assert!(m.rester.is_empty(), "{:?}", m.rester);
}

#[test]
fn kvitteringen_taeller_dem_uden_at_naevne_dem() {
    let ts = Tilstand::ny();
    let liste = [t("jdoe", "bruger"), t("ignoreres", "ord")];
    let a = analyser_med(&ts, TEKST, None, &[], &liste).unwrap();
    gem_og_masker_med(&ts, TEKST, &fravalgt(&a), &[], &liste).unwrap();
    let da = kvittering(&ts, false, "da").unwrap();
    assert!(da.contains("- I alt: "), "{da}");
    assert!(da.contains("\n- Heraf tilføjet af brugeren: 2 værdier, 3 steder\n\n"), "{da}");
    let en = kvittering(&ts, false, "en").unwrap();
    assert!(en.contains("\n- Of which added by the user: 2 values, 3 places\n\n"), "{en}");
    for k in [&da, &en] {
        assert!(!k.contains("jdoe") && !k.contains("JDoe") && !k.contains("ignoreres"), "{k}");
    }
    // Uden tilføjede værdier står linjen ikke der.
    let ts = Tilstand::ny();
    let a = analyser(&ts, TEKST, None, &[]).unwrap();
    gem_og_masker_med(&ts, TEKST, &fravalgt(&a), &[], &[]).unwrap();
    assert!(!kvittering(&ts, false, "da").unwrap().contains("Heraf tilføjet"));
}

#[test]
fn intet_om_dem_i_fejl_debug_svar_eller_log() {
    let x = t("hemmelig-konto-77", "bruger");
    assert!(!format!("{x:?}").contains("hemmelig-konto-77"), "{x:?}");
    let ts = Tilstand::ny();
    let liste = [t("hemmelig-konto-77", "bruger"), t("hemmelig-konto-77\nb", "ord")];
    let tekst = "a hemmelig-konto-77 b\n";
    let a = analyser_med(&ts, tekst, None, &[], &liste).unwrap();
    let json = serde_json::to_string(&a.tilfoejede).unwrap();
    assert!(!json.contains("hemmelig"), "{json}");
    // En afvist rettelse: fejlen har rækkens id og den ønskede kode, ikke værdien.
    let id = raekke(&a, 0).id;
    let ret = [Rettelse {
        id,
        kode: "ugyldig kode ".into(),
    }];
    let f = gem_og_masker_med(&ts, tekst, &fravalgt(&a), &ret, &liste).unwrap_err();
    assert!(matches!(f, UiFejl::Raekker { .. }));
    assert!(!format!("{f:?}").contains("hemmelig") && !serde_json::to_string(&f).unwrap().contains("hemmelig"));
    // Skallens kilde skriver intet til en log eller konsollen.
    for fil in ["src/maskering.rs", "src/lib.rs", "src/kvittering.rs"] {
        let kilde = std::fs::read_to_string(fil).unwrap();
        for m in ["println!", "eprintln!", "print!(", "eprint!(", "dbg!", "log::", "tracing::"] {
            // Kun som eget navn: "log::" i fx "AsyncFileDialog::" tæller ikke.
            let brugt = kilde
                .match_indices(m)
                .any(|(i, _)| i == 0 || !kilde.as_bytes()[i - 1].is_ascii_alphanumeric());
            assert!(!brugt, "{fil}: {m}");
        }
    }
}
