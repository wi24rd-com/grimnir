//! V-KVIT.1 N5 (skallen uden vindue): kvitteringen for en maskering.
//!
//! - Hele teksten for indsat tekst (dansk) og for en fil (engelsk), med styret ur.
//! - Tallene stemmer med fundene (rækkerne fra `analyser`) og med den maskerede tekst.
//! - Ingen af de opdigtede originaler, koder, aliaser eller erstatninger står i kvitteringen; heller ikke filens sti,
//!   mappe eller navn (filnavnet er udeladt).
//! - En fravalgt værdi og en værdi på Maskér aldrig tælles, men nævnes ikke.
//! - Låst, intet resultat, efter en ny analyse, efter Nulstil, efter en lås.
//! - Sagens navn, også når den midlertidige sag gemmes som sag efter maskeringen.
//! - Kvitteringen rører ikke udklipsholderen og det, Rust husker om den.
//! - Typenavnene er de samme som i fundtabellen (`ui/assets/sprog.js`).
//!
//! Tests rører aldrig Nøglering (nøglelageret er `HukommelsesLager`), kalder aldrig `LAContext` og læser eller skriver
//! aldrig den rigtige udklipsholder (`HukommelsesUdklip`). Kun opdigtede værdier (`kontor.test`, RFC 1918- og
//! dokumentationsadresser, opfundne navne). Mappen er en midlertidig mappe, der slettes igen.

use std::path::PathBuf;
use std::sync::Arc;

use grimnir_lib::klokke::StyretKlokke;
use grimnir_lib::kvittering::ARTER;
use grimnir_lib::laas::{HukommelsesDoer, Svar, Udloeser};
use grimnir_lib::maskering::{
    analyser, demasker, fil_aabn, fil_analyser, fil_gem_og_masker, fil_luk, gem_og_masker, kvittering, laas_igen, laas_op, levende,
    ordbog_tilfoej, sag_aabn, sag_luk, sag_nulstil, sag_ny, sag_valg, udklip_kopieret, Analyse, Rettelse, SideValg, Tilstand, UiFejl,
    Visning,
};
use grimnir_lib::sager::{HukommelsesLager, SagsId};
use grimnir_lib::udklip::HukommelsesUdklip;

/// En midlertidig mappe, der slettes igen.
struct Mappe(PathBuf);
impl Mappe {
    fn ny() -> Self {
        let p = std::env::temp_dir().join(format!("grimnir-kvit1-{}", SagsId::ny().unwrap().hex()));
        std::fs::create_dir_all(p.join(BRUGERMAPPE)).unwrap();
        Mappe(p)
    }
    fn fil(&self) -> PathBuf {
        let p = self.0.join(BRUGERMAPPE).join(FILNAVN);
        std::fs::write(&p, TEKST).unwrap();
        p
    }
}
impl Drop for Mappe {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}

/// Mappen og filnavnet røber noget (en kunde og en maskine); ingen af delene må stå i kvitteringen.
const BRUGERMAPPE: &str = "kunde-ravnsholt";
const FILNAVN: &str = "srv-068-eksport.log";

const TEKST: &str = "2026-11-10T08:00:01 srcip=10.20.30.11 dstip=203.0.113.10 user=\"bruger060\" msg=\"forbindelse åbnet\"\n\
Server=srv-068;Database=Kunde_DB;User Id=app;Password=Sommer2026!;\n\
login fra 10.20.30.11 til srv-014.kontor.test user=\"BRUGER060\"\n\
Projekt Kragevig kører på 10.20.31.5 og srv-068\n";

/// Alt det opdigtede, der står i [`TEKST`] og ordbogen. `Kunde_DB` vælges fra, `10.20.31.5` står på Maskér aldrig, og
/// `203.0.113.10` foreslås ikke maskeret: de tælles, men må ikke nævnes.
const ORIGINALER: [&str; 12] = [
    "10.20.30.11",
    "203.0.113.10",
    "bruger060",
    "srv-068",
    "Kunde_DB",
    "app",
    "Sommer2026!",
    "srv-014",
    "kontor.test",
    "Kragevig",
    "10.20.31.5",
    "forbindelse",
];
/// Koden, brugeren retter brugerens række til; den gamle kode (`user0001`) bliver et alias.
const RETTET: &str = "kunde-konto";
const SAGSNAVN: &str = "Uglebo-sagen";

/// 2026-11-11 08:06:07 UTC (som i puds1.rs); i Danmark (UTC+1) 09.06.07.
const NU_MS: u64 = 1_794_384_330_000 + 37_000;
const DK: i32 = 3600;

fn ordbog(t: &Tilstand) {
    ordbog_tilfoej(t, "ord", "Kragevig", None).unwrap();
    ordbog_tilfoej(t, "domaene", "kontor.test", None).unwrap();
    ordbog_tilfoej(t, "aldrig", "10.20.31.5", None).unwrap();
}

/// Et program i hukommelsen (ingen sager på disk) med styret ur og ordbogen.
fn program() -> Tilstand {
    let t = Tilstand::ny().med_klokke(Box::new(StyretKlokke::ny(NU_MS, DK)));
    ordbog(&t);
    t
}

/// Et program på disk (sager kan gemmes) med styret ur og ordbogen.
fn paa_disk(m: &Mappe) -> Tilstand {
    let t = Tilstand::paa_disk(m.0.join("app"), Arc::new(HukommelsesLager::ny())).med_klokke(Box::new(StyretKlokke::ny(NU_MS, DK)));
    ordbog(&t);
    t
}

/// Brugerens valg i [`TEKST`]: databasen vælges fra (ud over det, kernen ikke foreslår), og brugerens kode rettes.
fn valg(a: &Analyse) -> (Vec<usize>, Vec<Rettelse>) {
    let database = a.raekker.iter().find(|r| r.art == "database").expect("databasen findes").id;
    let bruger = a.raekker.iter().find(|r| r.art == "bruger").expect("brugeren findes").id;
    let mut fra: Vec<usize> = a.raekker.iter().filter(|r| !r.valgt).map(|r| r.id).collect();
    fra.push(database);
    (
        fra,
        vec![Rettelse {
            id: bruger,
            kode: RETTET.into(),
        }],
    )
}

/// Maskerer [`TEKST`] som indsat tekst med [`valg`]. Svarer med analysen og den maskerede tekst.
fn masker_tekst(t: &Tilstand) -> (Analyse, String) {
    let a = analyser(t, TEKST, None, &[]).unwrap();
    let (fra, ret) = valg(&a);
    let m = gem_og_masker(t, TEKST, &fra, &ret).unwrap();
    assert!(m.rester.is_empty(), "ingen rester i den opdigtede tekst");
    (a, m.maskeret)
}

fn side() -> SideValg {
    SideValg {
        filter: "alle".into(),
        antal: 500,
        ..SideValg::default()
    }
}

/// Åbner filen i Maskér og maskerer den med [`valg`].
fn masker_fil(t: &Tilstand, m: &Mappe) {
    fil_aabn(t, Visning::Masker, &m.fil()).unwrap();
    let a = fil_analyser(t, None, None, &[], &side()).unwrap();
    let a = Analyse {
        raekker: a.side.raekker,
        fejl: a.fejl,
        advarsler: a.advarsler,
        bytes: 0,
        linjer: a.linjer,
        moenstre: a.moenstre,
    };
    let (fra, ret) = valg(&a);
    let r = fil_gem_og_masker(t, &fra, &ret).unwrap();
    assert!(r.rester.is_empty());
}

/// Alt, der ikke må stå i en kvittering for [`TEKST`]: originalerne, hver kode fra analysen (koden og, for brugeren,
/// det alias, rettelsen efterlader), den rettede kode og hver erstatning i den maskerede tekst.
fn forbudte(a: &Analyse) -> Vec<String> {
    let mut ud: Vec<String> = ORIGINALER.iter().map(|s| s.to_string()).collect();
    for r in &a.raekker {
        ud.extend(r.vaerdier.iter().cloned());
        ud.extend(r.koder.iter().cloned());
    }
    ud.push(RETTET.to_string());
    ud.push(RETTET.to_uppercase());
    ud.sort();
    ud.dedup();
    assert!(
        ud.len() >= 24 && ud.iter().any(|s| s == "user0001") && ud.iter().any(|s| s == "GRIMNIR_SECRET_0001"),
        "{ud:?}"
    );
    ud
}

fn uden_forbudte(kvit: &str, forbudte: &[String]) {
    let smaa = kvit.to_lowercase();
    for f in forbudte {
        assert!(!smaa.contains(&f.to_lowercase()), "«{f}» står i kvitteringen");
    }
}

/// Kvitteringen for [`TEKST`] med [`valg`] på dansk (`tegn`: den maskerede teksts længde i tegn).
fn dansk(sag: &str, kilde: &str, tegn: usize) -> String {
    format!(
        "Wi24rd Grimnir — kvittering\n\
Version {}\n\
\n\
Maskeret: 2026-11-11 09.06.07 (UTC+01:00)\n\
Sag: {sag}\n\
Kilde: {kilde}\n\
Maskeret tekst: 4 linjer, {tegn} tegn\n\
\n\
Maskerede værdier\n\
- IPv4, eget net: 1 værdi, 2 steder\n\
- Maskine: 2 værdier, 3 steder\n\
- Domæne: 1 værdi, 1 sted\n\
- Bruger: 2 værdier, 3 steder\n\
- Ord: 1 værdi, 1 sted\n\
- Hemmelighed: 1 værdi, 1 sted\n\
- I alt: 8 værdier, 11 steder\n\
\n\
Lækagetjek: 0 rester fundet\n\
\n\
Ikke maskeret med vilje\n\
- Fund, brugeren valgte fra: 1\n\
- Fund, Grimnir ikke foreslog, og som ikke blev slået til: 1\n\
- Værdier på Maskér aldrig, der blev mødt: 1\n\
\n\
Denne kvittering indeholder ingen originale værdier.\n",
        grimnir_core::VERSION
    )
}

/// Det samme på engelsk.
fn engelsk(sag: &str, kilde: &str, tegn: usize) -> String {
    format!(
        "Wi24rd Grimnir — receipt\n\
Version {}\n\
\n\
Masked: 2026-11-11 09.06.07 (UTC+01:00)\n\
Case: {sag}\n\
Source: {kilde}\n\
Masked text: 4 lines, {tegn} characters\n\
\n\
Masked values\n\
- IPv4, own network: 1 value, 2 places\n\
- Machine: 2 values, 3 places\n\
- Domain: 1 value, 1 place\n\
- User: 2 values, 3 places\n\
- Word: 1 value, 1 place\n\
- Secret: 1 value, 1 place\n\
- Total: 8 values, 11 places\n\
\n\
Leak check: 0 leftovers found\n\
\n\
Deliberately not masked\n\
- Findings the user deselected: 1\n\
- Findings Grimnir did not suggest and that were not turned on: 1\n\
- Values on Never mask that were met: 1\n\
\n\
This receipt contains no original values.\n",
        grimnir_core::VERSION
    )
}

#[test]
fn indsat_tekst_paa_dansk_og_engelsk() {
    let t = program();
    let (a, maskeret) = masker_tekst(&t);
    let tegn = maskeret.chars().count();
    assert_eq!(maskeret.lines().count(), 4);
    let da = kvittering(&t, false, "da").unwrap();
    assert_eq!(da, dansk("Midlertidig sag", "indsat tekst", tegn));
    let en = kvittering(&t, false, "en").unwrap();
    assert_eq!(en, engelsk("Temporary case", "pasted text", tegn));
    // Et ukendt sprog er dansk (som resten af skallen: kun `en` er engelsk).
    assert_eq!(kvittering(&t, false, "").unwrap(), da);
    let f = forbudte(&a);
    uden_forbudte(&da, &f);
    uden_forbudte(&en, &f);
    // Kvitteringen kan hentes igen og igen; den ændrer intet.
    assert_eq!(kvittering(&t, false, "da").unwrap(), da);
}

#[test]
fn tallene_stemmer_med_fundene() {
    let t = program();
    let a = analyser(&t, TEKST, None, &[]).unwrap();
    let (fra, ret) = valg(&a);
    // Fundtabellen med brugerens valg (det, brugeren ser, før Gem og maskér).
    let a2 = analyser(&t, TEKST, Some(&fra), &ret).unwrap();
    let m = gem_og_masker(&t, TEKST, &fra, &ret).unwrap();
    let da = kvittering(&t, false, "da").unwrap();
    let valgte: Vec<_> = a2.raekker.iter().filter(|r| r.valgt).collect();
    // Hver type: antal rækker og summen af rækkernes antal, under typens navn fra fundtabellen.
    let mut typer = 0;
    for (art, navn, _) in ARTER {
        let r: Vec<_> = valgte.iter().filter(|r| r.art == art).collect();
        let linje = da.lines().find(|l| l.starts_with(&format!("- {navn}: ")));
        if r.is_empty() {
            assert_eq!(linje, None, "{art} har ingen maskerede fund og vises ikke");
            continue;
        }
        typer += 1;
        let (v, s) = (r.len(), r.iter().map(|x| x.antal).sum::<usize>());
        let ventet = format!(
            "- {navn}: {v} {}, {s} {}",
            if v == 1 { "værdi" } else { "værdier" },
            if s == 1 { "sted" } else { "steder" }
        );
        assert_eq!(linje, Some(ventet.as_str()));
    }
    assert_eq!(typer, 6);
    let steder: usize = valgte.iter().map(|r| r.antal).sum();
    assert!(
        da.contains(&format!("- I alt: {} værdier, {steder} steder\n", valgte.len())),
        "{da}"
    );
    // Stederne er de steder, hvor den maskerede tekst afviger fra originalen: hver kode i den maskerede tekst.
    let koder: Vec<&String> = a2.raekker.iter().filter(|r| r.valgt).flat_map(|r| &r.koder).collect();
    let i_teksten: usize = koder.iter().map(|k| m.maskeret.matches(k.as_str()).count()).sum();
    assert_eq!(i_teksten, steder);
    assert_eq!(steder, 11);
    // Det, der ikke blev maskeret.
    let fravalgt = a2.raekker.iter().filter(|r| !r.valgt && r.standard).count();
    let ikke_foreslaaet = a2.raekker.iter().filter(|r| !r.valgt && !r.standard).count();
    assert_eq!((fravalgt, ikke_foreslaaet), (1, 1));
    assert!(da.contains("- Fund, brugeren valgte fra: 1\n"));
    assert!(da.contains("- Fund, Grimnir ikke foreslog, og som ikke blev slået til: 1\n"));
    // Linjer og tegn er den maskerede teksts.
    assert!(da.contains(&format!("Maskeret tekst: 4 linjer, {} tegn\n", m.maskeret.chars().count())));
    assert_ne!(m.maskeret.chars().count(), m.maskeret.len(), "teksten har æøå: tegn, ikke bytes");
    // Den fravalgte værdi og værdien på Maskér aldrig står urørt i den maskerede tekst (og er talt ovenfor).
    assert!(m.maskeret.contains("Kunde_DB") && m.maskeret.contains("10.20.31.5") && m.maskeret.contains("203.0.113.10"));
}

#[test]
fn masker_aldrig_taelles_kun_naar_den_moedes() {
    // Uden værdien i teksten: 0. To forskellige adresser i et net på listen, den ene to gange: 2.
    let t = program();
    let uden = "srcip=10.20.30.11 user=\"bruger060\"\n";
    let a = analyser(&t, uden, None, &[]).unwrap();
    let fra: Vec<usize> = a.raekker.iter().filter(|r| !r.valgt).map(|r| r.id).collect();
    gem_og_masker(&t, uden, &fra, &[]).unwrap();
    assert!(kvittering(&t, false, "da")
        .unwrap()
        .contains("- Værdier på Maskér aldrig, der blev mødt: 0\n"));

    let t = Tilstand::ny();
    ordbog_tilfoej(&t, "aldrig", "10.20.31.0/24", None).unwrap();
    let med = "a 10.20.31.5 b 10.20.31.6 c 10.20.31.5 d 10.20.30.11\n";
    let a = analyser(&t, med, None, &[]).unwrap();
    assert_eq!(a.raekker.len(), 1, "kun adressen uden for nettet er et fund");
    gem_og_masker(&t, med, &[], &[]).unwrap();
    let k = kvittering(&t, false, "da").unwrap();
    assert!(k.contains("- Værdier på Maskér aldrig, der blev mødt: 2\n"), "{k}");
    assert!(k.contains("- IPv4, eget net: 1 værdi, 1 sted\n- I alt: 1 værdi, 1 sted\n"), "{k}");
    assert!(!k.contains("10.20."), "{k}");

    // Uden noget på listen: 0, og en tekst uden fund giver en kvittering uden typer.
    let t = Tilstand::ny();
    gem_og_masker(&t, "slut\n", &[], &[]).unwrap();
    let k = kvittering(&t, false, "da").unwrap();
    assert!(k.contains("Maskerede værdier\n- I alt: 0 værdier, 0 steder\n"), "{k}");
    assert!(k.contains("- Værdier på Maskér aldrig, der blev mødt: 0\n"));
}

#[test]
fn fil_paa_dansk_og_engelsk_uden_sti_og_filnavn() {
    let m = Mappe::ny();
    let t = paa_disk(&m);
    masker_fil(&t, &m);
    let a = analyser(&program(), TEKST, None, &[]).unwrap();
    let tegn = masker_tekst(&program()).1.chars().count();
    let en = kvittering(&t, true, "en").unwrap();
    assert_eq!(en, engelsk("Temporary case", "file", tegn));
    let da = kvittering(&t, true, "da").unwrap();
    assert_eq!(da, dansk("Midlertidig sag", "fil", tegn));
    let mut f = forbudte(&a);
    // Stien, mappen og filnavnet (valget i V-KVIT.1: filnavnet er udeladt), og filnavnets dele.
    f.push(m.0.to_string_lossy().into_owned());
    f.push(m.0.file_name().unwrap().to_string_lossy().into_owned());
    f.extend([BRUGERMAPPE, "ravnsholt", FILNAVN, "eksport", ".log", "/", "\\"].map(String::from));
    uden_forbudte(&da, &f);
    uden_forbudte(&en, &f);
    // Den indsatte teksts kvittering findes ikke, bare fordi filens gør.
    assert_eq!(kvittering(&t, false, "da"), Err(UiFejl::IntetResultat));
}

#[test]
fn laast_og_intet_resultat() {
    let m = Mappe::ny();
    let t = paa_disk(&m);
    // Før en maskering: intet resultat; uden åben fil: ingen fil.
    assert_eq!(kvittering(&t, false, "da"), Err(UiFejl::IntetResultat));
    assert_eq!(kvittering(&t, true, "da"), Err(UiFejl::IngenFil));
    // En åben og analyseret fil, der ikke er maskeret: intet resultat.
    fil_aabn(&t, Visning::Masker, &m.fil()).unwrap();
    fil_analyser(&t, None, None, &[], &side()).unwrap();
    assert_eq!(kvittering(&t, true, "da"), Err(UiFejl::IntetResultat));
    fil_luk(&t, Visning::Masker).unwrap();
    // En analyse alene giver ingen kvittering.
    analyser(&t, TEKST, None, &[]).unwrap();
    assert_eq!(kvittering(&t, false, "da"), Err(UiFejl::IntetResultat));
    // En afvist rettelse: intet er maskeret, ingen kvittering.
    let a = analyser(&t, TEKST, None, &[]).unwrap();
    let (fra, _) = valg(&a);
    let bruger = a.raekker.iter().find(|r| r.art == "bruger").unwrap().id;
    let afvist = gem_og_masker(
        &t,
        TEKST,
        &fra,
        &[Rettelse {
            id: bruger,
            kode: "h0001".into(),
        }],
    );
    assert!(matches!(afvist, Err(UiFejl::Raekker { .. })), "koden er optaget af maskinen");
    assert_eq!(kvittering(&t, false, "da"), Err(UiFejl::IntetResultat));

    // Låst (som ved start): både med og uden resultat svares `laast`, som de øvrige kommandoer.
    masker_tekst(&t);
    assert!(kvittering(&t, false, "da").is_ok());
    t.laas();
    assert_eq!(kvittering(&t, false, "da"), Err(UiFejl::Laast));
    assert_eq!(kvittering(&t, true, "en"), Err(UiFejl::Laast));
    // Det samme med en maskeret fil (en maskering mere giver en ny udgave af sagen; så er den indsatte teksts
    // kvittering væk, som filens resultat er forældet efter en ny maskering af indsat tekst).
    let m = Mappe::ny();
    let t = paa_disk(&m);
    masker_tekst(&t);
    masker_fil(&t, &m);
    assert!(kvittering(&t, true, "da").is_ok());
    assert_eq!(kvittering(&t, false, "da"), Err(UiFejl::IntetResultat));
    t.laas();
    assert_eq!(kvittering(&t, true, "en"), Err(UiFejl::Laast));
    assert_eq!(kvittering(&t, false, "da"), Err(UiFejl::Laast));
}

#[test]
fn en_ny_analyse_fjerner_kvitteringen() {
    let m = Mappe::ny();
    let t = paa_disk(&m);
    masker_tekst(&t);
    assert!(kvittering(&t, false, "da").is_ok());
    analyser(&t, TEKST, None, &[]).unwrap();
    assert_eq!(kvittering(&t, false, "da"), Err(UiFejl::IntetResultat));
    // Det samme for en fil.
    masker_fil(&t, &m);
    assert!(kvittering(&t, true, "da").is_ok());
    fil_analyser(&t, None, None, &[], &side()).unwrap();
    assert_eq!(kvittering(&t, true, "da"), Err(UiFejl::IntetResultat));
    // En ny fil i Maskér, og en lukket fil.
    masker_fil(&t, &m);
    fil_aabn(&t, Visning::Masker, &m.fil()).unwrap();
    assert_eq!(kvittering(&t, true, "da"), Err(UiFejl::IntetResultat));
    masker_fil(&t, &m);
    fil_luk(&t, Visning::Masker).unwrap();
    assert_eq!(kvittering(&t, true, "da"), Err(UiFejl::IngenFil));
    // En analyse, der afvises (tom tekst), fjerner den også: det gamle resultat er ikke længere det, brugeren ser på.
    masker_tekst(&t);
    assert_eq!(analyser(&t, "", None, &[]).err(), Some(UiFejl::TomTekst));
    assert_eq!(kvittering(&t, false, "da"), Err(UiFejl::IntetResultat));
}

#[test]
fn efter_nulstil_og_sagsskift_findes_den_ikke() {
    let m = Mappe::ny();
    let t = paa_disk(&m);
    // Nulstil.
    masker_tekst(&t);
    masker_fil(&t, &m);
    sag_nulstil(&t).unwrap();
    assert_eq!(kvittering(&t, false, "da"), Err(UiFejl::IntetResultat));
    assert_eq!(kvittering(&t, true, "da"), Err(UiFejl::IntetResultat));
    // Luk sag.
    masker_tekst(&t);
    sag_luk(&t).unwrap();
    assert_eq!(kvittering(&t, false, "da"), Err(UiFejl::IntetResultat));
    // En ny maskering i den nye sag giver en ny kvittering.
    masker_tekst(&t);
    assert!(kvittering(&t, false, "da").is_ok());
    // Sagens valg ændret: sagen er en ny udgave, og resultatet er forældet (webvisningen analyserer igen).
    sag_valg(&t, true, false).unwrap();
    assert_eq!(kvittering(&t, false, "da"), Err(UiFejl::IntetResultat));
    // En anden sag åbnet.
    let id = sag_ny(&t, SAGSNAVN, None).unwrap().id.unwrap();
    masker_tekst(&t);
    assert!(kvittering(&t, false, "da").is_ok());
    sag_aabn(&t, &id).unwrap();
    assert_eq!(kvittering(&t, false, "da"), Err(UiFejl::IntetResultat));
}

#[test]
fn efter_en_laas_findes_den_ikke() {
    let m = Mappe::ny();
    let t = paa_disk(&m);
    masker_tekst(&t);
    masker_fil(&t, &m);
    assert!(laas_igen(&t, Udloeser::Stilstand));
    assert_eq!(kvittering(&t, false, "da"), Err(UiFejl::Laast));
    let ud = laas_op(&t, &HukommelsesDoer::ny(Svar::Ok), "da");
    assert!(!ud.status.laast);
    assert_eq!(kvittering(&t, false, "da"), Err(UiFejl::IntetResultat));
    assert_eq!(kvittering(&t, true, "da"), Err(UiFejl::IngenFil));
}

#[test]
fn sagens_navn_staar_i_kvitteringen() {
    let m = Mappe::ny();
    let t = paa_disk(&m);
    // En navngiven sag.
    sag_ny(&t, SAGSNAVN, None).unwrap();
    let (a, maskeret) = masker_tekst(&t);
    let tegn = maskeret.chars().count();
    let da = kvittering(&t, false, "da").unwrap();
    assert_eq!(da, dansk(SAGSNAVN, "indsat tekst", tegn));
    assert_eq!(kvittering(&t, false, "en").unwrap(), engelsk(SAGSNAVN, "pasted text", tegn));
    uden_forbudte(&da, &forbudte(&a));
    // En midlertidig sag, der gemmes som sag efter maskeringen: kvitteringen findes stadig og har nu sagens navn.
    sag_luk(&t).unwrap();
    masker_tekst(&t);
    assert!(kvittering(&t, false, "da").unwrap().contains("Sag: Midlertidig sag\n"));
    sag_ny(&t, "Ravnsholt-sagen", None).unwrap();
    assert!(kvittering(&t, false, "da").unwrap().contains("Sag: Ravnsholt-sagen\n"));
}

#[test]
fn kvitteringen_roerer_ikke_udklipsholderen() {
    let u = Arc::new(HukommelsesUdklip::ny(true));
    let t = program().med_udklip(Some(Box::new(u.clone())));
    let (_, maskeret) = masker_tekst(&t);
    // Brugeren har kopieret et demaskeret resultat; Rust husker det (V-LAAS.4).
    let d = demasker(&t, &maskeret).unwrap();
    u.skriv(&d.tekst);
    assert_eq!(udklip_kopieret(&t, false), Ok(true));
    let (foer, taeller, laest) = (levende(&t), u.taeller_nu(), u.laesninger());
    // Kvitteringen: udklipsholderen læses og skrives ikke, og det huskede er uændret.
    let k = kvittering(&t, false, "da").unwrap();
    assert_eq!((levende(&t), u.taeller_nu(), u.laesninger()), (foer, taeller, laest));
    assert_eq!(u.nu().as_deref(), Some(d.tekst.as_str()));
    // Webvisningen lægger kvitteringen i udklipsholderen (melder intet til Rust). Ved lås ryddes den ikke: tælleren er
    // en anden end den, Rust huskede for det demaskerede resultat.
    u.skriv(&k);
    assert!(laas_igen(&t, Udloeser::Dvale));
    assert_eq!(
        u.nu().as_deref(),
        Some(k.as_str()),
        "kvitteringen ligger stadig i udklipsholderen efter låsen"
    );
}

#[test]
fn typenavnene_er_fundtabellens() {
    // `art_*` i sprog.js, dansk og engelsk: samme nøgler og samme navne som i kvitteringen.
    let js = include_str!("../../ui/assets/sprog.js");
    let en_fra = js.find("art_ipv4_egen: 'IPv4, own network'").expect("den engelske del findes");
    let (da, en) = js.split_at(en_fra);
    for (art, dansk, engelsk) in ARTER {
        assert!(da.contains(&format!("art_{art}: '{dansk}'")), "{art} på dansk");
        assert!(en.contains(&format!("art_{art}: '{engelsk}'")), "{art} på engelsk");
    }
    // Ingen type i sprog.js mangler i kvitteringen.
    assert_eq!(da.matches("art_").count(), ARTER.len(), "dansk");
    assert_eq!(en.matches("art_").count(), ARTER.len(), "engelsk");
    // Og hver art, skallen kan give en række, har et navn (`art_navn` i maskering.rs).
    let rs = include_str!("../src/maskering.rs");
    let start = rs.find("pub fn art_navn").unwrap();
    let krop = &rs[start..start + rs[start..].find("\n}\n").unwrap()];
    let i_skallen: Vec<&str> = krop.split("=> \"").skip(1).map(|s| &s[..s.find('"').unwrap()]).collect();
    assert_eq!(i_skallen.len(), ARTER.len());
    for a in i_skallen {
        assert!(ARTER.iter().any(|x| x.0 == a), "{a}");
    }
}
