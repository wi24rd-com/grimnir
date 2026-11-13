//! V-OPBYG.2 N1, N2, N3 og N5 (skallen uden vindue): noterne i sagen og stederne i teksten.
//!
//! - Kommandoerne `noter_hent`, `note_tilfoej`, `note_ret` og `note_slet` på den midlertidige og en navngiven sag, med en
//!   styret klokke; grænserne som fejl uden tekst; en navngiven sag gemmes straks, og en gemning, der fejler, ændrer intet.
//! - Filen: formatversion 2 kun med noter (version 1 uden, med præcis de gamle felter); hvad en ældre Grimnir gør med en
//!   sag med noter (`UkendtVersion`, intet overskrives); versionen er bundet i AAD; rundtur gennem krypteringen med mange
//!   slags tekst; antallet i listen læses af hovedet alene.
//! - D21: den midlertidige sag med kun noter spørges der om ved Afslut og gemmes ved lås og afslutning; "Gem som sag" tager
//!   noterne med; efter lås er intet tilbage i hukommelsen; låst svarer alt `laast`.
//! - En notes tekst står aldrig i den maskerede tekst, kvitteringen, en maskeret fil, demaskeringens resultat, sagsfilen i
//!   klartekst eller en fejl; ingen `Debug` på typerne med notetekst; intet logges.
//! - Sagens indhold for en anden sag viser dens noter (kun læst).
//! - Kopiér noterne: udklipsholderen huskes og ryddes ved lås (D21), kun når den har sagens noter.
//! - N3: stederne i UTF-16 for teksten og den maskerede tekst.
//!
//! Tests rører aldrig Nøglering eller den rigtige udklipsholder (`HukommelsesLager`, `HukommelsesUdklip`). Kun opdigtede
//! værdier (`kontor.test`, RFC 1918, opfundne navne).

use std::path::PathBuf;
use std::sync::Arc;

use grimnir_lib::klokke::StyretKlokke;
use grimnir_lib::laas::{HukommelsesDoer, Svar, Udloeser};
use grimnir_lib::maskering::{
    analyser, analyser_med, demasker, fil_aabn, fil_analyser, fil_gem_og_masker, fil_gem_til, fil_kopi, gem_og_masker, kvittering,
    laas_igen, laas_op, levende, note_ret, note_slet, note_tilfoej, noter_hent, sag_aabn, sag_indhold, sag_liste, sag_ny, sag_status,
    udklip_noter_kopieret, ved_afslut, IndholdValg, SideValg, Tilstand, UiFejl, Visning, MAKS_VIST_UTF16,
};
use grimnir_lib::sager::{
    self, laes_krypteret, laes_krypteret_hoved, sti, HukommelsesLager, Ident, Noeglelager, SagFejl, SagsId, FORMATVERSION,
    FORMATVERSION_NOTER,
};
use grimnir_lib::udklip::HukommelsesUdklip;

const TEKST: &str = "srv-web01.kontor.test 10.20.0.5 bruger=anders.eksempel password=Sommer2026!\r\nlogin ok fra pc-0042\n";
/// En notetekst, der ikke står i teksten.
const MAERKE: &str = "Notemærke Kv9 sendt til leverandøren";
/// 2026-11-13 10:00:00 UTC.
const NU_MS: u64 = 1_794_564_000_000;
const DK: i32 = 3600;

struct Mappe(PathBuf);
impl Mappe {
    fn ny() -> Self {
        let p = std::env::temp_dir().join(format!("grimnir-opbyg2-{}", SagsId::ny().unwrap().hex()));
        std::fs::create_dir_all(&p).unwrap();
        Mappe(p)
    }
    fn sager(&self) -> PathBuf {
        self.0.join("sager")
    }
}
impl Drop for Mappe {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}

struct Program {
    t: Tilstand,
    lager: Arc<HukommelsesLager>,
    klokke: Arc<StyretKlokke>,
}

/// Programmet på disk (ulåst, som de andre skal-tests), med en styret klokke.
fn program(m: &Mappe) -> Program {
    let lager = Arc::new(HukommelsesLager::ny());
    let klokke = Arc::new(StyretKlokke::ny(NU_MS, DK));
    let t = Tilstand::paa_disk(m.0.clone(), lager.clone()).med_klokke(Box::new(klokke.clone()));
    Program { t, lager, klokke }
}

fn noter(t: &Tilstand) -> Vec<(u64, String, u64, Option<u64>)> {
    noter_hent(t)
        .unwrap()
        .noter
        .iter()
        .map(|n| (n.nr, n.tekst.clone(), n.oprettet, n.rettet))
        .collect()
}

fn id_af(s: &str) -> SagsId {
    SagsId::fra_hex(s).unwrap()
}

fn version(m: &Mappe, id: &SagsId) -> u16 {
    let b = std::fs::read(sti(&m.sager(), id)).unwrap();
    u16::from_le_bytes([b[8], b[9]])
}

/// Maskerer TEKST med kernens standard i den åbne sag; svarer med den maskerede tekst.
fn masker(t: &Tilstand) -> String {
    let a = analyser(t, TEKST, None, &[]).unwrap();
    let fra: Vec<usize> = a.raekker.iter().filter(|r| !r.valgt).map(|r| r.id).collect();
    gem_og_masker(t, TEKST, &fra, &[]).unwrap().maskeret
}

// ------------------------------------------------------------------------------------------------------- kommandoerne

#[test]
fn noter_i_den_midlertidige_sag_med_styret_klokke() {
    let m = Mappe::ny();
    let p = program(&m);
    let t = &p.t;
    let svar = noter_hent(t).unwrap();
    assert!(svar.id.is_none() && svar.navn.is_none() && svar.noter.is_empty());
    assert_eq!((svar.maks_tegn, svar.maks_antal), (4000, 200));
    assert_eq!(note_tilfoej(t, "Første\nanden linje").unwrap().nr, Some(1));
    p.klokke.stil(NU_MS + 60_000, DK);
    assert_eq!(note_tilfoej(t, MAERKE).unwrap().nr, Some(2));
    p.klokke.stil(NU_MS + 120_000, DK);
    assert_eq!(note_ret(t, 1, "Første, rettet").unwrap().nr, Some(1));
    assert_eq!(
        noter(t),
        vec![
            (1, "Første, rettet".to_string(), NU_MS, Some(NU_MS + 120_000)),
            (2, MAERKE.to_string(), NU_MS + 60_000, None),
        ]
    );
    assert_eq!(sag_status(t).unwrap().noter, 2);
    assert_eq!(sag_status(t).unwrap().poster, 0);
    let s = note_slet(t, 1).unwrap();
    assert_eq!((s.nr, s.noter.len()), (None, 1));
    // Fejlene er uden notens tekst.
    assert_eq!(note_tilfoej(t, "   \n").err(), Some(UiFejl::Note { hvad: "tom", maks: 0 }));
    let lang = format!("{MAERKE}{}", "ø".repeat(4000));
    let f = note_tilfoej(t, &lang).err().unwrap();
    assert_eq!(
        f,
        UiFejl::Note {
            hvad: "for_lang",
            maks: 4000
        }
    );
    assert_eq!(note_ret(t, 9, "x").err(), Some(UiFejl::Note { hvad: "ukendt", maks: 0 }));
    assert_eq!(note_slet(t, 9).err(), Some(UiFejl::Note { hvad: "ukendt", maks: 0 }));
    assert!(!serde_json::to_string(&f).unwrap().contains("Notemærke"));
    for i in 0..199 {
        note_tilfoej(t, &format!("note {i}")).unwrap();
    }
    assert_eq!(
        note_tilfoej(t, "en for meget").err(),
        Some(UiFejl::Note {
            hvad: "for_mange",
            maks: 200
        })
    );
    assert_eq!(noter(t).len(), 200);
}

#[test]
fn en_navngiven_sag_gemmes_straks_og_en_fejlet_gemning_aendrer_intet() {
    let m = Mappe::ny();
    let p = program(&m);
    let t = &p.t;
    masker(t);
    let id = sag_ny(t, "Uglebo-sagen", None).unwrap().id.unwrap();
    let sid = id_af(&id);
    assert_eq!(version(&m, &sid), FORMATVERSION, "uden noter: formatversion 1");
    note_tilfoej(t, MAERKE).unwrap();
    assert_eq!(version(&m, &sid), FORMATVERSION_NOTER, "med noter: formatversion 2");
    // Gemt straks: et andet program på samme mappe læser noten.
    let p2 = Program {
        t: Tilstand::paa_disk(m.0.clone(), p.lager.clone()),
        lager: p.lager.clone(),
        klokke: p.klokke.clone(),
    };
    sag_aabn(&p2.t, &id).unwrap();
    assert_eq!(noter(&p2.t), vec![(1, MAERKE.to_string(), NU_MS, None)]);
    // Konflikt: det andet program gemmer en note først; så afvises ændringen her, og noterne er uændrede.
    note_tilfoej(&p2.t, "fra det andet vindue").unwrap();
    let foer = noter(t);
    assert_eq!(
        note_tilfoej(t, "kommer ikke med").err(),
        Some(UiFejl::Sag { fejl: SagFejl::Konflikt })
    );
    assert_eq!(note_ret(t, 1, "heller ikke").err(), Some(UiFejl::Sag { fejl: SagFejl::Konflikt }));
    assert_eq!(note_slet(t, 1).err(), Some(UiFejl::Sag { fejl: SagFejl::Konflikt }));
    assert_eq!(noter(t), foer, "en gemning, der fejler, ændrer intet i hukommelsen");
    // Slettes alle noter, skrives sagen med formatversion 1 igen.
    note_slet(&p2.t, 1).unwrap();
    note_slet(&p2.t, 2).unwrap();
    assert_eq!(version(&m, &sid), FORMATVERSION);
    assert_eq!(sag_liste(&p2.t).unwrap()[0].noter, 0);
}

#[test]
fn en_note_goer_ikke_en_maskeret_fil_foraeldet() {
    let m = Mappe::ny();
    let p = program(&m);
    let fil = m.0.join("indsat.log");
    std::fs::write(&fil, TEKST).unwrap();
    fil_aabn(&p.t, Visning::Masker, &fil).unwrap();
    let side = SideValg {
        filter: "alle".into(),
        antal: 500,
        ..SideValg::default()
    };
    let a = fil_analyser(&p.t, None, None, &[], &side).unwrap();
    let fra: Vec<usize> = a.side.raekker.iter().filter(|r| !r.valgt).map(|r| r.id).collect();
    fil_gem_og_masker(&p.t, &fra, &[]).unwrap();
    note_tilfoej(&p.t, MAERKE).unwrap();
    let kopi = fil_kopi(&p.t, Visning::Masker).expect("noten ændrer ikke sagens koder; den maskerede fil gælder stadig");
    assert!(!kopi.contains("Notemærke"));
}

// ------------------------------------------------------------------------------------------------------- filen

#[test]
fn version_1_har_praecis_de_gamle_felter() {
    let m = Mappe::ny();
    let p = program(&m);
    masker(&p.t);
    let id = id_af(&sag_ny(&p.t, "Uden noter", None).unwrap().id.unwrap());
    let n = p.lager.hent(&id).unwrap();
    let (h, k) = laes_krypteret(&sti(&m.sager(), &id), Ident::Sag(&id), &n).unwrap();
    let h: serde_json::Value = serde_json::from_slice(&h).unwrap();
    let k: serde_json::Value = serde_json::from_slice(&k).unwrap();
    let noegler = |v: &serde_json::Value| {
        let mut x: Vec<String> = v.as_object().unwrap().keys().cloned().collect();
        x.sort();
        x
    };
    assert_eq!(
        noegler(&h),
        ["navn", "oprettet", "poster", "sidst_brugt", "skrivetaeller", "udloeb"],
        "hovedet som før V-OPBYG.2"
    );
    assert_eq!(noegler(&k["hoved"]), noegler(&h));
    assert_eq!(
        noegler(&k["data"]),
        [
            "aliaser",
            "enheder",
            "iid6",
            "net4",
            "net6",
            "overloeb_meldt",
            "poster",
            "reserverede_ip4",
            "reserverede_ip6",
            "reserverede_mac",
            "reserverede_navne",
            "rettede_koder",
            "sid_domaener",
            "taellere",
            "vaerter4",
            "valg",
        ],
        "kroppen som før V-OPBYG.2"
    );
}

#[test]
fn en_aeldre_grimnir_afviser_en_sag_med_noter_og_kan_ikke_overskrive_den() {
    let m = Mappe::ny();
    let p = program(&m);
    masker(&p.t);
    let id = id_af(&sag_ny(&p.t, "Med noter", None).unwrap().id.unwrap());
    note_tilfoej(&p.t, MAERKE).unwrap();
    let fil = sti(&m.sager(), &id);
    let n = p.lager.hent(&id).unwrap();
    // `laes_krypteret` og `laes_krypteret_hoved` er de læsere, der kun kender version 1 (som før V-OPBYG.2): de afviser
    // filen med en tydelig fejl ("filen er fra en nyere udgave af Grimnir"), både hovedet (listen) og hele filen (Åbn,
    // Omdøb, Udløb). Uden at kunne læse filen kan en ældre udgave ikke gemme den igen og miste noterne.
    assert_eq!(
        laes_krypteret(&fil, Ident::Sag(&id), &n).err(),
        Some(SagFejl::UkendtVersion { version: 2 })
    );
    assert_eq!(
        laes_krypteret_hoved(&fil, Ident::Sag(&id), &n).err(),
        Some(SagFejl::UkendtVersion { version: 2 })
    );
    // Versionen er bundet i AAD: en fil med noter kan ikke gøres til version 1 (så en ældre udgave læste den og tabte
    // noterne), og en fil uden noter kan ikke gøres til version 2.
    let mut b = std::fs::read(&fil).unwrap();
    b[8..10].copy_from_slice(&FORMATVERSION.to_le_bytes());
    std::fs::write(&fil, &b).unwrap();
    assert_eq!(sager::laes(&m.sager(), &id, &n).err(), Some(SagFejl::Beskadiget));
    assert_eq!(laes_krypteret(&fil, Ident::Sag(&id), &n).err(), Some(SagFejl::Beskadiget));
    let id2 = id_af(&sag_ny(&p.t, "Uden noter", None).unwrap().id.unwrap());
    let fil2 = sti(&m.sager(), &id2);
    let mut b2 = std::fs::read(&fil2).unwrap();
    assert_eq!(u16::from_le_bytes([b2[8], b2[9]]), FORMATVERSION);
    b2[8..10].copy_from_slice(&FORMATVERSION_NOTER.to_le_bytes());
    std::fs::write(&fil2, &b2).unwrap();
    assert_eq!(
        sager::laes(&m.sager(), &id2, &p.lager.hent(&id2).unwrap()).err(),
        Some(SagFejl::Beskadiget)
    );
}

#[test]
fn rundtur_gennem_krypteringen_med_mange_slags_noter() {
    let m = Mappe::ny();
    let p = program(&m);
    let id = sag_ny(&p.t, "Rundtur", None).unwrap().id.unwrap();
    // Faste svære tilfælde og en deterministisk blanding (fast frø).
    let mut tekster: Vec<String> = vec![
        "linje 1\r\nlinje 2\nlinje 3\r".into(),
        "\"citat\" \\ sti\\til\\fil \u{0}nul \t tab".into(),
        "æøå ÆØÅ 🙂 中文 \u{202e}baglæns".into(),
        "ø".repeat(4000),
        "x".into(),
        "  mellemrum før og efter  ".into(),
        "</script><!-- {\"json\": [1,2]} -->".into(),
    ];
    let stykker = [
        "ord ",
        "æøå",
        "\r\n",
        "\n",
        "\"",
        "\\",
        "🙂",
        "10.20.0.5 ",
        "srv-web01 ",
        "\t",
        "{}",
        "Sommer2026!",
    ];
    let mut x: u64 = 0x9e37_79b9_7f4a_7c15;
    while tekster.len() < 200 {
        let mut s = String::new();
        for _ in 0..(1 + (x % 40)) {
            x ^= x << 13;
            x ^= x >> 7;
            x ^= x << 17;
            s.push_str(stykker[(x % stykker.len() as u64) as usize]);
        }
        if !s.trim().is_empty() {
            tekster.push(s);
        }
    }
    for (i, s) in tekster.iter().enumerate() {
        p.klokke.stil(NU_MS + i as u64, DK);
        note_tilfoej(&p.t, s).unwrap();
    }
    // Ret og slet et par stykker, så både `rettet` og huller i numrene kommer med.
    note_ret(&p.t, 3, "rettet æøå\r\n").unwrap();
    note_slet(&p.t, 5).unwrap();
    let foer = noter(&p.t);
    assert_eq!(foer.len(), 199);
    let p2 = program(&m);
    let p2 = Program {
        t: Tilstand::paa_disk(m.0.clone(), p.lager.clone()),
        ..p2
    };
    sag_aabn(&p2.t, &id).unwrap();
    assert_eq!(noter(&p2.t), foer, "noterne er de samme efter kryptering, disk og læsning");
    // Sagsfilen har ingen notetekst i klartekst.
    let b = std::fs::read(sti(&m.sager(), &id_af(&id))).unwrap();
    for s in ["leverand", "rettet æøå", "Sommer2026!", "srv-web01"] {
        assert!(!b.windows(s.len()).any(|w| w == s.as_bytes()), "{s} står i klartekst i filen");
    }
}

#[test]
fn listen_viser_antallet_fra_hovedet_alene() {
    let m = Mappe::ny();
    let p = program(&m);
    let id = sag_ny(&p.t, "Tre noter", None).unwrap().id.unwrap();
    for s in ["a", "b", "c"] {
        note_tilfoej(&p.t, s).unwrap();
    }
    assert_eq!(sag_liste(&p.t).unwrap()[0].noter, 3);
    // Kroppen ødelægges (sidste byte i filen): listen viser stadig antallet (kun hovedet læses), Åbn afviser filen.
    let fil = sti(&m.sager(), &id_af(&id));
    let mut b = std::fs::read(&fil).unwrap();
    let sidste = b.len() - 1;
    b[sidste] ^= 0xff;
    std::fs::write(&fil, &b).unwrap();
    let p2 = Program {
        t: Tilstand::paa_disk(m.0.clone(), p.lager.clone()),
        lager: p.lager.clone(),
        klokke: p.klokke.clone(),
    };
    let l = sag_liste(&p2.t).unwrap();
    assert_eq!((l[0].noter, l[0].fejl.clone()), (3, None));
    assert_eq!(sag_aabn(&p2.t, &id).err(), Some(UiFejl::Sag { fejl: SagFejl::Beskadiget }));
}

// ------------------------------------------------------------------------------------------------------- D21

#[test]
fn den_midlertidige_sag_med_kun_noter_spoerges_om_og_gemmes_ved_laas() {
    let m = Mappe::ny();
    let p = program(&m);
    let t = &p.t;
    assert!(!t.skal_spoerge_ved_luk());
    note_tilfoej(t, MAERKE).unwrap();
    assert!(
        t.skal_spoerge_ved_luk(),
        "en midlertidig sag med noter (uden poster) spørges der om ved Afslut"
    );
    assert!(laas_igen(t, Udloeser::Stilstand));
    assert_eq!(levende(t).noter, 0, "efter låsen er der ingen noter i hukommelsen");
    assert_eq!(noter_hent(t).err(), Some(UiFejl::Laast));
    assert_eq!(note_tilfoej(t, "låst").err(), Some(UiFejl::Laast));
    assert_eq!(
        levende(t).noter,
        0,
        "låst lægges ingen note i hukommelsen (porten før ændringen, ikke kun før svaret)"
    );
    assert_eq!(note_ret(t, 1, "låst").err(), Some(UiFejl::Laast));
    assert_eq!(note_slet(t, 1).err(), Some(UiFejl::Laast));
    let svar = laas_op(t, &HukommelsesDoer::ny(Svar::Ok), "da");
    let navn = svar.efter.unwrap().midlertidig_gemt.expect("den midlertidige sag er gemt");
    assert!(navn.starts_with("Midlertidig 2026-11-13"), "{navn}");
    assert!(noter_hent(t).unwrap().noter.is_empty(), "efter oplåsningen er sagen ny og tom");
    let l = sag_liste(t).unwrap();
    assert_eq!((l.len(), l[0].noter, l[0].poster), (1, 1, 0));
    sag_aabn(t, &l[0].id).unwrap();
    assert_eq!(
        noter(t),
        vec![(1, MAERKE.to_string(), NU_MS, None)],
        "noten hentes fra Rust efter lås og oplåsning"
    );
}

#[test]
fn ved_afslut_gemmes_en_midlertidig_sag_med_noter() {
    let m = Mappe::ny();
    let p = program(&m);
    note_tilfoej(&p.t, MAERKE).unwrap();
    ved_afslut(&p.t);
    let p2 = Program {
        t: Tilstand::paa_disk(m.0.clone(), p.lager.clone()),
        lager: p.lager.clone(),
        klokke: p.klokke.clone(),
    };
    let l = sag_liste(&p2.t).unwrap();
    assert_eq!((l.len(), l[0].noter), (1, 1));
    assert!(l[0].navn.as_deref().unwrap().starts_with("Midlertidig "));
}

#[test]
fn gem_som_sag_tager_noterne_med() {
    let m = Mappe::ny();
    let p = program(&m);
    masker(&p.t);
    note_tilfoej(&p.t, MAERKE).unwrap();
    note_tilfoej(&p.t, "anden note").unwrap();
    let s = sag_ny(&p.t, "Navngivet", None).unwrap();
    assert_eq!((s.noter, s.poster > 0), (2, true));
    let id = s.id.unwrap();
    assert_eq!(version(&m, &id_af(&id)), FORMATVERSION_NOTER);
    let p2 = Program {
        t: Tilstand::paa_disk(m.0.clone(), p.lager.clone()),
        lager: p.lager.clone(),
        klokke: p.klokke.clone(),
    };
    sag_aabn(&p2.t, &id).unwrap();
    assert_eq!(
        noter(&p2.t).iter().map(|n| n.1.as_str()).collect::<Vec<_>>(),
        vec![MAERKE, "anden note"]
    );
    // En maskering i den navngivne sag beholder noterne (sagen erstattes af en kopi med alle data).
    masker(&p2.t);
    assert_eq!(noter(&p2.t).len(), 2);
}

// ------------------------------------------------------------------------------------------------------- aldrig med

#[test]
fn en_notes_tekst_kommer_aldrig_med_i_resultater() {
    let m = Mappe::ny();
    let p = program(&m);
    let t = &p.t;
    let id = sag_ny(t, "Sag med noter", None).unwrap().id.unwrap();
    note_tilfoej(t, MAERKE).unwrap();
    // En note med tekstens egne værdier: den gennemsøges ikke og bruges ikke af maskeringen.
    note_tilfoej(t, "srv-web01.kontor.test 10.20.0.5 anders.eksempel").unwrap();
    let maskeret = masker(t);
    assert!(!maskeret.contains("Notemærke"));
    for sprog in ["da", "en"] {
        let k = kvittering(t, false, sprog).unwrap();
        assert!(!k.contains("Notemærke") && !k.contains("leverandøren"), "kvitteringen ({sprog})");
    }
    let d = demasker(t, &maskeret).unwrap();
    assert_eq!(d.tekst, TEKST);
    let d2 = demasker(t, "note 1 note nr. 2 h0001").unwrap();
    assert!(!d2.tekst.contains("Notemærke"));
    // En maskeret fil.
    let fil = m.0.join("indsat.log");
    std::fs::write(&fil, TEKST).unwrap();
    fil_aabn(t, Visning::Masker, &fil).unwrap();
    let side = SideValg {
        filter: "alle".into(),
        antal: 500,
        ..SideValg::default()
    };
    let a = fil_analyser(t, None, None, &[], &side).unwrap();
    let fra: Vec<usize> = a.side.raekker.iter().filter(|r| !r.valgt).map(|r| r.id).collect();
    fil_gem_og_masker(t, &fra, &[]).unwrap();
    let ud = m.0.join("ud.log");
    fil_gem_til(t, Visning::Masker, &ud, true).unwrap();
    let gemt = std::fs::read(&ud).unwrap();
    assert!(!gemt.windows(8).any(|w| w == "Notemærk".as_bytes()));
    assert!(!kvittering(t, true, "da").unwrap().contains("Notemærke"));
    // Sagens indhold for den åbne sag har ingen noter (de står i fanen Noter); intet felt i analysen har noten.
    let ind = sag_indhold(t, Some(&id), &IndholdValg::default()).unwrap();
    assert!(ind.aaben && ind.noter.is_empty());
    let am = analyser_med(t, TEKST, None, &[], &[]).unwrap();
    assert!(!serde_json::to_string(&am).unwrap().contains("Notemærke"));
}

#[test]
fn sagens_indhold_for_en_anden_sag_viser_dens_noter() {
    let m = Mappe::ny();
    let p = program(&m);
    masker(&p.t);
    let id = sag_ny(&p.t, "Den anden", None).unwrap().id.unwrap();
    note_tilfoej(&p.t, MAERKE).unwrap();
    p.klokke.stil(NU_MS + 5_000, DK);
    note_ret(&p.t, 1, "Rettet note").unwrap();
    grimnir_lib::maskering::sag_luk(&p.t).unwrap();
    note_tilfoej(&p.t, "midlertidig").unwrap();
    let ind = sag_indhold(&p.t, Some(&id), &IndholdValg::default()).unwrap();
    assert!(!ind.aaben);
    let n: Vec<_> = ind.noter.iter().map(|n| (n.nr, n.tekst.clone(), n.oprettet, n.rettet)).collect();
    assert_eq!(n, vec![(1, "Rettet note".to_string(), NU_MS, Some(NU_MS + 5_000))]);
    // Den åbne (midlertidige) sag er ikke skiftet.
    assert_eq!(noter(&p.t).iter().map(|n| n.1.as_str()).collect::<Vec<_>>(), vec!["midlertidig"]);
}

#[test]
fn ingen_debug_og_ingen_log_med_notetekst() {
    let kilde = |f: &str| std::fs::read_to_string(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join(f)).unwrap();
    let kerne = std::fs::read_to_string(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../grimnir-core/src/sag.rs")).unwrap();
    let m = kilde("src/maskering.rs");
    // Typerne med notetekst: ingen afledt Debug (attributten lige over typen).
    for (fil, typen) in [
        (&kerne, "pub struct Note {"),
        (&m, "pub struct NoteUd {"),
        (&m, "pub struct NoterUd {"),
    ] {
        let i = fil.find(typen).unwrap_or_else(|| panic!("{typen} mangler"));
        let derive = &fil[fil[..i].rfind("#[derive(").unwrap()..i];
        assert!(!derive.contains("Debug"), "{typen}: {derive}");
        assert!(!fil.contains(&format!("impl std::fmt::Debug for {}", &typen[11..typen.len() - 2])));
        assert!(!fil.contains(&format!("impl fmt::Debug for {}", &typen[11..typen.len() - 2])));
    }
    // Intet skrives til log eller konsol i skallen og kernens sag.
    let (sager_rs, lib_rs) = (kilde("src/sager.rs"), kilde("src/lib.rs"));
    for (navn, tekst) in [
        ("maskering.rs", m.as_str()),
        ("sager.rs", sager_rs.as_str()),
        ("lib.rs", lib_rs.as_str()),
        ("sag.rs", kerne.as_str()),
    ] {
        for x in ["println!", "eprintln!", "print!(", "eprint!(", "dbg!", "log::", "tracing::"] {
            // Ved et ordskel (rfd::AsyncFileDialog::new indeholder "log::").
            let fundet = tekst
                .match_indices(x)
                .any(|(i, _)| i == 0 || !(tekst.as_bytes()[i - 1].is_ascii_alphanumeric() || tekst.as_bytes()[i - 1] == b'_'));
            assert!(!fundet, "{navn}: {x}");
        }
    }
}

// ------------------------------------------------------------------------------------------------------- Kopiér noterne

#[test]
fn kopier_noterne_huskes_og_ryddes_ved_laas() {
    for laesbar in [true, false] {
        let m = Mappe::ny();
        let lager = Arc::new(HukommelsesLager::ny());
        let u = Arc::new(HukommelsesUdklip::ny(laesbar));
        let t = Tilstand::paa_disk(m.0.clone(), lager)
            .med_klokke(Box::new(StyretKlokke::ny(NU_MS, DK)))
            .med_udklip(Some(Box::new(u.clone())));
        // Uden noter: intet at huske.
        u.skriv("noget andet");
        assert_eq!(udklip_noter_kopieret(&t), Ok(false));
        note_tilfoej(&t, MAERKE).unwrap();
        note_tilfoej(&t, "anden\nnote").unwrap();
        // Webvisningen lægger noterne med dato foran i udklipsholderen og melder det.
        u.skriv(&format!(
            "Midlertidig sag\n\n13. nov. 2026 kl. 11.00\n{MAERKE}\n\n13. nov. 2026 kl. 11.00\nanden\nnote\n"
        ));
        assert_eq!(udklip_noter_kopieret(&t), Ok(true), "læsbar: {laesbar}");
        laas_igen(&t, Udloeser::Stilstand);
        assert_eq!(u.nu(), None, "låsen rydder noterne fra udklipsholderen (læsbar: {laesbar})");
        laas_op(&t, &HukommelsesDoer::ny(Svar::Ok), "da");
        // Står der noget andet (fx kun den ene af sagens to noter), huskes intet, og intet ryddes.
        if laesbar {
            let l = sag_liste(&t).unwrap();
            sag_aabn(&t, &l[0].id).unwrap();
            assert_eq!(noter_hent(&t).unwrap().noter.len(), 2);
            u.skriv(MAERKE);
            assert_eq!(udklip_noter_kopieret(&t), Ok(false), "ikke alle sagens noter står der");
            laas_igen(&t, Udloeser::Stilstand);
            assert_eq!(u.nu().as_deref(), Some(MAERKE), "brugerens eget indhold røres ikke");
        }
    }
}

// ------------------------------------------------------------------------------------------------------- N3: stederne

#[test]
fn stederne_er_utf16_og_passer_til_vaerdierne_og_koderne() {
    let m = Mappe::ny();
    let p = program(&m);
    let t = &p.t;
    // Tegn uden for BMP og æøå før værdierne, så byte- og UTF-16-positioner er forskellige.
    let tekst = "🙂 æøå srv-web01.kontor.test 10.20.0.5\r\n🙂🙂 bruger=anders.eksempel srv-web01.kontor.test\n";
    let u16: Vec<u16> = tekst.encode_utf16().collect();
    let a = analyser_med(t, tekst, None, &[], &[]).unwrap();
    assert!(!a.steder.is_empty());
    assert!(a.steder.windows(2).all(|w| w[0] <= w[1]), "sorteret");
    for r in &a.raekker {
        let mine: Vec<_> = a.steder.iter().filter(|s| s.2 == r.id).collect();
        assert_eq!(mine.len(), r.antal, "rækkens steder er dens antal: {}", r.art);
        for (s, e, _) in mine {
            let v = String::from_utf16(&u16[*s..*e]).unwrap();
            assert!(r.vaerdier.contains(&v), "{v:?} er en af rækkens værdier");
        }
    }
    // Efter maskeringen: kodernes steder i den maskerede tekst.
    let fra: Vec<usize> = a.raekker.iter().filter(|r| !r.valgt).map(|r| r.id).collect();
    let mk = gem_og_masker(t, tekst, &fra, &[]).unwrap();
    let mu: Vec<u16> = mk.maskeret.encode_utf16().collect();
    let valgte: Vec<_> = a.raekker.iter().filter(|r| r.valgt).collect();
    assert_eq!(mk.steder.len(), valgte.iter().map(|r| r.antal).sum::<usize>());
    for (s, e, id) in &mk.steder {
        let k = String::from_utf16(&mu[*s..*e]).unwrap();
        let r = valgte.iter().find(|r| r.id == *id).expect("en valgt række");
        assert!(r.koder.contains(&k), "{k:?} er rækkens kode");
    }
}

#[test]
fn kun_steder_i_de_viste_tegn_sendes() {
    let m = Mappe::ny();
    let p = program(&m);
    // Én linje med en værdi, gentaget, så teksten er over grænsen på 200.000 UTF-16-enheder.
    let linje = "ACCEPT src=10.20.0.5 dst=srv-web01.kontor.test ø\n";
    let n = MAKS_VIST_UTF16 / linje.encode_utf16().count() + 50;
    let tekst = linje.repeat(n);
    let a = analyser_med(&p.t, &tekst, None, &[], &[]).unwrap();
    let alle: usize = a.raekker.iter().map(|r| r.antal).sum();
    assert!(a.steder.len() < alle, "{} < {alle}", a.steder.len());
    assert!(a.steder.iter().all(|s| s.0 < MAKS_VIST_UTF16));
    assert!(a.steder.last().unwrap().0 > MAKS_VIST_UTF16 - 2 * linje.len());
    assert_eq!(MAKS_VIST_UTF16, 200_000);
}
