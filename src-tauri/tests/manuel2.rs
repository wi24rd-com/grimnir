//! V-MANUEL.2 (skallen uden vindue): sagens indhold i sider (N1) og forslag til navnemønstre i analysen (N3).
//!
//! - `sag_indhold` giver den åbne sags poster (også den midlertidige) og en anden sags poster fra disk i sider med type,
//!   søgning og "vis flere"; en anden sag læses kun (den åbne sag skiftes ikke, og en midlertidig sag med poster mister
//!   intet).
//! - En hemmelighed sendes kun, når den er vist, og kan kun søges, når den er vist.
//! - Låst: intet læses; en sag uden nøgle svarer med årsagen og uden indhold.
//! - Intet om posterne står i en fejl, og kommandoen skriver ingen log.
//! - `analyser` og `fil_analyser` giver forslag til navnemønstre.
//!
//! Kun opdigtede værdier (`eksempel-firma.example`, RFC 1918, opfundne navne). Tests rører aldrig Nøglering.

use std::path::PathBuf;
use std::sync::Arc;

use grimnir_lib::maskering::{
    analyser, fil_aabn, fil_analyser, gem_og_masker, sag_aabn, sag_indhold, sag_liste, sag_luk, sag_ny, sag_status, Analyse, IndholdValg,
    SagIndhold, SideValg, Tilstand, UiFejl, Visning,
};
use grimnir_lib::sager::{Arkiv, HukommelsesLager, Noeglelager, SagFejl, SagsId};

const TEKST: &str = "2026-11-10 08:00:00 srv-db02 fejl: forbindelse til srv-db02.intern.eksempel-firma.example afvist\n\
2026-11-10 08:00:07 srv-web03 postfix/smtp: from=<bo.proeve@eksempel-firma.example> status=sent\n\
2026-11-10 08:00:14 srv-fil04 \\\\srv-fil04\\deling\\x.xlsx aabnet af EKSEMPEL\\eva fra 10.20.30.11\n\
password=Vinter2026!Opdigtet\n";

struct Mappe(PathBuf);
impl Mappe {
    fn ny() -> Self {
        let p = std::env::temp_dir().join(format!("grimnir-test-{}", SagsId::ny().unwrap().hex()));
        std::fs::create_dir_all(&p).unwrap();
        Mappe(p)
    }
}
impl Drop for Mappe {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}

fn program(m: &Mappe, lager: &Arc<HukommelsesLager>) -> Tilstand {
    Tilstand::med_arkiv(Arkiv::ny(m.0.clone(), Box::new(lager.clone())))
}

fn fravalgt(a: &Analyse) -> Vec<usize> {
    a.raekker.iter().filter(|r| !r.valgt).map(|r| r.id).collect()
}

fn masker(t: &Tilstand, tekst: &str) -> String {
    let a = analyser(t, tekst, None, &[]).unwrap();
    gem_og_masker(t, tekst, &fravalgt(&a), &[]).unwrap().maskeret
}

fn valg(type_: &str, soeg: &str, vist: &[usize], antal: usize) -> IndholdValg {
    IndholdValg {
        type_: type_.into(),
        soeg: soeg.into(),
        vist: vist.to_vec(),
        antal,
    }
}

fn vaerdier(i: &SagIndhold) -> Vec<String> {
    i.raekker.iter().filter_map(|p| p.vaerdi.clone()).collect()
}

#[test]
fn den_aabne_sags_poster_med_type_kode_og_vaerdi_og_hemmelighed_skjult() {
    let t = Tilstand::ny();
    let m = masker(&t, TEKST);
    let i = sag_indhold(&t, None, &valg("", "", &[], 500)).unwrap();
    assert_eq!(
        (i.id.as_deref(), i.navn.as_deref(), i.aaben),
        (None, None, true),
        "den midlertidige sag"
    );
    assert_eq!(i.i_alt, sag_status(&t).unwrap().poster);
    assert_eq!(i.fundet, i.i_alt);
    assert_eq!(i.raekker.len(), i.i_alt);
    // Hver post: koden står i det maskerede, og værdien er den rigtige (den står i teksten).
    for p in &i.raekker {
        assert!(m.contains(&p.kode), "{} står ikke i det maskerede", p.kode);
        if let Some(v) = &p.vaerdi {
            assert!(TEKST.contains(v.as_str()), "{v}");
        }
    }
    let v = vaerdier(&i);
    for navn in ["srv-db02", "srv-web03", "srv-fil04", "intern.eksempel-firma.example", "10.20.30.11"] {
        assert!(v.iter().any(|x| x == navn), "{navn} mangler i {v:?}");
    }
    // Hemmeligheden: skjult (ingen værdi), til den er vist.
    let h = i.raekker.iter().find(|p| p.hemmelig).expect("en hemmelighed");
    assert_eq!((h.type_, h.vaerdi.as_deref()), ("hemmelighed", None));
    assert!(!v.iter().any(|x| x.contains("Vinter2026")));
    let vist = sag_indhold(&t, None, &valg("", "", &[h.nr], 500)).unwrap();
    let hv = vist.raekker.iter().find(|p| p.nr == h.nr).unwrap();
    assert_eq!(hv.vaerdi.as_deref(), Some("Vinter2026!Opdigtet"));
    // Typerne i venstre side og sorteringen (type, så kode).
    assert!(i.typer.iter().any(|x| x.type_ == "vaert" && x.antal >= 3), "{:?}", i.typer);
    assert_eq!(i.typer.iter().map(|x| x.antal).sum::<usize>(), i.i_alt);
    let typer: Vec<&str> = i.raekker.iter().map(|p| p.type_).collect();
    let mut sorteret = typer.clone();
    sorteret.dedup();
    assert_eq!(sorteret.len(), i.typer.len(), "posterne står samlet pr. type: {typer:?}");
}

#[test]
fn soegning_type_og_sider() {
    let t = Tilstand::ny();
    // 5000 maskiner (opdigtede navne) i én tekst.
    let tekst: String = (0..5000).map(|n| format!("hostname=vaert-{n:05}\n")).collect();
    masker(&t, &tekst);
    let alle = sag_indhold(&t, None, &valg("", "", &[], 500)).unwrap();
    assert_eq!((alle.i_alt, alle.fundet, alle.raekker.len()), (5000, 5000, 500));
    let flere = sag_indhold(&t, None, &valg("", "", &[], 1000)).unwrap();
    assert_eq!(flere.raekker.len(), 1000);
    assert_eq!(
        flere.raekker[..500].iter().map(|p| p.nr).collect::<Vec<_>>(),
        alle.raekker.iter().map(|p| p.nr).collect::<Vec<_>>()
    );
    let soeg = sag_indhold(&t, None, &valg("", "VAERT-0423", &[], 500)).unwrap();
    assert_eq!(soeg.fundet, 10, "vaert-04230 … vaert-04239");
    assert!(soeg
        .raekker
        .iter()
        .all(|p| p.vaerdi.as_deref().is_some_and(|v| v.starts_with("vaert-0423"))));
    let kode = soeg.raekker[0].kode.clone();
    let paa_kode = sag_indhold(&t, None, &valg("", &kode.to_uppercase(), &[], 500)).unwrap();
    assert!(paa_kode.raekker.iter().any(|p| p.kode == kode), "søgning i koden");
    assert_eq!(sag_indhold(&t, None, &valg("bruger", "", &[], 500)).unwrap().fundet, 0);
    assert_eq!(sag_indhold(&t, None, &valg("vaert", "", &[], 500)).unwrap().fundet, 5000);
}

#[test]
fn en_hemmelighed_kan_kun_soeges_naar_den_er_vist() {
    let t = Tilstand::ny();
    masker(&t, TEKST);
    assert_eq!(sag_indhold(&t, None, &valg("", "vinter2026", &[], 500)).unwrap().fundet, 0);
    let h = sag_indhold(&t, None, &valg("hemmelighed", "", &[], 500)).unwrap().raekker[0].nr;
    let i = sag_indhold(&t, None, &valg("", "vinter2026", &[h], 500)).unwrap();
    assert_eq!(i.fundet, 1);
    assert_eq!(i.raekker[0].vaerdi.as_deref(), Some("Vinter2026!Opdigtet"));
}

#[test]
fn en_anden_sag_laeses_uden_at_den_aabne_skiftes_og_den_midlertidige_mister_intet() {
    let m = Mappe::ny();
    let lager = Arc::new(HukommelsesLager::ny());
    let t = program(&m, &lager);
    masker(&t, TEKST);
    let a = sag_ny(&t, "Opdigtet sag A", None).unwrap();
    let a_id = a.id.clone().unwrap();
    // En ny midlertidig sag med andre poster.
    sag_luk(&t).unwrap();
    masker(&t, "login fra 10.20.31.5 til srv-andet01\n");
    let foer = sag_status(&t).unwrap();
    assert!(foer.poster > 0 && foer.id.is_none());
    let i = sag_indhold(&t, Some(&a_id), &valg("", "", &[], 500)).unwrap();
    assert_eq!(
        (i.id.as_deref(), i.navn.as_deref(), i.aaben),
        (Some(a_id.as_str()), Some("Opdigtet sag A"), false)
    );
    assert!(vaerdier(&i).iter().any(|v| v == "srv-db02"));
    assert_eq!(sag_status(&t).unwrap(), foer, "den midlertidige sag er stadig den åbne og uændret");
    // Den åbne sag med sit id er den i hukommelsen.
    sag_luk(&t).unwrap();
    sag_aabn(&t, &a_id).unwrap();
    let j = sag_indhold(&t, Some(&a_id), &valg("", "", &[], 500)).unwrap();
    assert!(j.aaben);
    assert_eq!(j.i_alt, i.i_alt);
    assert_eq!(j.udloeb, None);
}

#[test]
fn en_sag_uden_noegle_eller_fil_svarer_med_aarsagen_og_intet_indhold() {
    let m = Mappe::ny();
    let lager = Arc::new(HukommelsesLager::ny());
    let t = program(&m, &lager);
    masker(&t, TEKST);
    let id = sag_ny(&t, "Opdigtet sag B", None).unwrap().id.unwrap();
    sag_luk(&t).unwrap();
    lager.slet(&SagsId::fra_hex(&id).unwrap()).unwrap();
    let f = sag_indhold(&t, Some(&id), &valg("", "", &[], 500)).err().expect("fejl");
    assert_eq!(
        f,
        UiFejl::Sag {
            fejl: SagFejl::ManglerNoegle
        }
    );
    let json = serde_json::to_string(&f).unwrap();
    for v in ["srv-db02", "Vinter2026", "eksempel-firma", "Opdigtet sag B"] {
        assert!(!json.contains(v), "{json}");
    }
    assert_eq!(
        sag_liste(&t).unwrap()[0].fejl,
        Some(SagFejl::ManglerNoegle),
        "listen siger det samme"
    );
    let ukendt = "0".repeat(32);
    assert_eq!(
        sag_indhold(&t, Some(&ukendt), &valg("", "", &[], 500)).err(),
        Some(UiFejl::Sag { fejl: SagFejl::ManglerFil })
    );
    assert_eq!(
        sag_indhold(&t, Some("ikke-et-id"), &valg("", "", &[], 500)).err(),
        Some(UiFejl::Sag { fejl: SagFejl::UgyldigtId })
    );
}

#[test]
fn laast_giver_intet() {
    let t = Tilstand::ny();
    masker(&t, TEKST);
    t.laas();
    assert_eq!(sag_indhold(&t, None, &valg("", "", &[], 500)).err(), Some(UiFejl::Laast));
    assert_eq!(
        sag_indhold(&t, Some(&"0".repeat(32)), &valg("", "", &[], 500)).err(),
        Some(UiFejl::Laast)
    );
}

#[test]
fn intet_om_posterne_i_en_log() {
    // Kommandoen og dens hjælpere skriver ingen log og har ingen Debug-udskrift af værdierne.
    let kilde = include_str!("../src/maskering.rs");
    let start = kilde
        .find("// ---------------------------------------------------------------------------------------------- sagens indhold")
        .unwrap_or_else(|| kilde.find("sagens indhold (V-MANUEL.2)").expect("afsnittet"));
    let slut = start
        + kilde[start..]
            .find("// ------------------------------------------------------------------------------------------------------- ordbogen")
            .expect("næste afsnit");
    let afsnit = &kilde[start..slut];
    for m in [
        "println!",
        "eprintln!",
        "dbg!",
        "log::",
        "tracing::",
        "#[derive(Clone, Debug, Serialize)]\npub struct SagPost",
        "#[derive(Clone, Debug, Serialize)]\npub struct SagIndhold",
    ] {
        assert!(!afsnit.contains(m), "{m}");
    }
    assert!(afsnit.contains("pub struct SagPost") && afsnit.contains("pub struct SagIndhold"));
    let lib = include_str!("../src/lib.rs");
    let i = lib.find("fn sag_indhold(").expect("kommandoen");
    let krop = &lib[i..i + lib[i..].find("\n}\n").unwrap()];
    assert!(!krop.contains("println") && !krop.contains("eprintln") && !krop.contains("log"));
}

#[test]
fn analysen_giver_forslag_til_navnemoenstre_ogsaa_for_en_fil() {
    let t = Tilstand::ny();
    let a = analyser(&t, TEKST, None, &[]).unwrap();
    assert_eq!(a.moenstre.len(), 1);
    assert_eq!((a.moenstre[0].moenster.as_str(), a.moenstre[0].navne), ("srv-*", 3));
    let json = serde_json::to_value(&a).unwrap();
    assert_eq!(json["moenstre"][0]["moenster"], "srv-*");
    let m = Mappe::ny();
    let fil = m.0.join("indsat.log");
    std::fs::write(&fil, TEKST).unwrap();
    fil_aabn(&t, Visning::Masker, &fil).unwrap();
    let side = SideValg {
        filter: "alle".into(),
        antal: 500,
        ..SideValg::default()
    };
    let f = fil_analyser(&t, None, None, &[], &side).unwrap();
    assert_eq!(f.moenstre, a.moenstre);
}

#[test]
fn en_rettet_kode_viser_den_tidligere_kode() {
    use grimnir_lib::maskering::Rettelse;
    let t = Tilstand::ny();
    let a = analyser(&t, TEKST, None, &[]).unwrap();
    let r = a.raekker.iter().find(|r| r.vaerdier == ["srv-web03"]).expect("srv-web03");
    let gammel = r.koder[0].clone();
    gem_og_masker(
        &t,
        TEKST,
        &fravalgt(&a),
        &[Rettelse {
            id: r.id,
            kode: "maskine-web".into(),
        }],
    )
    .unwrap();
    let i = sag_indhold(&t, None, &valg("", "maskine-web", &[], 500)).unwrap();
    assert_eq!(i.fundet, 1);
    let p = &i.raekker[0];
    assert_eq!(
        (p.kode.as_str(), p.vaerdi.as_deref(), p.rettet),
        ("maskine-web", Some("srv-web03"), true)
    );
    assert_eq!(p.aliaser, vec![gammel.clone()]);
    // Den tidligere kode kan også søges.
    assert_eq!(
        sag_indhold(&t, None, &valg("", &gammel, &[], 500)).unwrap().raekker[0].kode,
        "maskine-web"
    );
}
