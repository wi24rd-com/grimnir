//! V-FIL.1 F6 (skallen uden vindue og uden dialog): filer læses og skrives med stier i en midlertidig mappe. De fire
//! tegnsæt × tre slags linjeskift bytepræcist rundt; afviste filer; originalen er uændret; den maskerede fil har ingen
//! originaler; rester kræver "Gem alligevel"; sagen gemmes før filen; ingen efterladte midlertidige filer;
//! filnavneforslagene; rækkerne i sider med søgning over alle; Kopiér op til 5 MiB; "Start forfra" med en ordbog, der
//! ikke kan åbnes; andre kommandoer svarer, mens en stor fil analyseres. Målingerne for 10 og 100 MB står i den ignorerede
//! test `maal_10_og_100_mb` (`cargo test -p grimnir --test fil1 -- --ignored --nocapture`).
//!
//! Nøglelageret ligger i hukommelsen og rører aldrig den rigtige Nøglering. Kun opdigtede værdier: `kontor.test`,
//! RFC 1918- og dokumentationsadresser, opfundne brugere og ord.

use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::{Duration, Instant};

use grimnir_lib::fil::{self, forslag, forslag_demaskeret, FilFejl, Linjeskift, Tegnsaet, MAKS_FIL};
use grimnir_lib::maskering::{
    analyser, fil_aabn, fil_analyser, fil_demasker, fil_gem_forslag, fil_gem_og_masker, fil_gem_til, fil_kopi, fil_luk, fil_raekker,
    gem_og_masker, indstillinger_hent, ordbog_hent, ordbog_start_forfra, ordbog_tilfoej, sag_luk, sag_ny, sag_status, FilAnalyse, SideValg,
    Tilstand, UiFejl, Visning,
};
use grimnir_lib::ordbog::{self, KONTO};
use grimnir_lib::sager::{HukommelsesLager, Noeglelager, SagFejl, SagsId};

/// En midlertidig mappe, der slettes igen. `app` er programmets mappe (sager, ordbog); `bruger` er brugerens filer.
struct Mappe(PathBuf);
impl Mappe {
    fn ny() -> Self {
        let p = std::env::temp_dir().join(format!("grimnir-test-{}", SagsId::ny().unwrap().hex()));
        std::fs::create_dir_all(p.join("bruger")).unwrap();
        Mappe(p)
    }
    fn app(&self) -> PathBuf {
        self.0.join("app")
    }
    fn bruger(&self, navn: &str) -> PathBuf {
        self.0.join("bruger").join(navn)
    }
}
impl Drop for Mappe {
    fn drop(&mut self) {
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let _ = std::fs::set_permissions(self.app().join("sager"), std::fs::Permissions::from_mode(0o700));
        }
        let _ = std::fs::remove_dir_all(&self.0);
    }
}

fn program(m: &Mappe) -> (Tilstand, Arc<HukommelsesLager>) {
    let lager = Arc::new(HukommelsesLager::ny());
    (Tilstand::paa_disk(m.app(), lager.clone()), lager)
}

/// Opdigtede logs. `{nl}` er linjeskiftet; den blandede bruger CRLF og LF skiftevis. Med æøå og et tegn uden for BMP
/// (UTF-16-surrogatpar).
const LINJER: [&str; 6] = [
    "2026-11-10T08:00:01 srcip=10.20.30.11 dstip=203.0.113.10 user=\"bruger060\" msg=\"forbindelse åbnet\"",
    "Server=srv-068;Database=Kunde_DB;User Id=app;Password=Sommer2026!;",
    "Bemærk: æøå ÆØÅ – kør igen 𝄞 fra 10.20.30.11",
    "login failed for bruger061 from 10.20.31.5",
    "host=srv-014.kontor.test user=\"BRUGER060\"",
    "slut",
];
/// Værdier, kernen altid finder i LINJER (adresser, `user=`, `Password=`). `bruger061` uden `user=` er ikke et fund.
const ORIGINALER: [&str; 4] = ["10.20.30.11", "bruger060", "Sommer2026!", "10.20.31.5"];

fn tekst(ls: Linjeskift) -> String {
    let mut t = String::new();
    for (i, l) in LINJER.iter().enumerate() {
        t.push_str(l);
        t.push_str(match ls {
            Linjeskift::Crlf => "\r\n",
            Linjeskift::Blandet if i % 2 == 0 => "\r\n",
            _ => "\n",
        });
    }
    t
}

/// Teksten som bytes i tegnsættet (med BOM).
fn kod(t: &str, ts: Tegnsaet) -> Vec<u8> {
    match ts {
        Tegnsaet::Utf8 => t.as_bytes().to_vec(),
        Tegnsaet::Utf8Bom => [&[0xEF, 0xBB, 0xBF][..], t.as_bytes()].concat(),
        Tegnsaet::Utf16le => [0xFF, 0xFE]
            .into_iter()
            .chain(t.encode_utf16().flat_map(u16::to_le_bytes))
            .collect(),
        Tegnsaet::Utf16be => [0xFE, 0xFF]
            .into_iter()
            .chain(t.encode_utf16().flat_map(u16::to_be_bytes))
            .collect(),
    }
}

/// Bytes fra en fil i tegnsættet tilbage til tekst (testens egen afkodning, ikke Grimnirs).
fn afkod(b: &[u8], ts: Tegnsaet) -> String {
    match ts {
        Tegnsaet::Utf8 => String::from_utf8(b.to_vec()).unwrap(),
        Tegnsaet::Utf8Bom => {
            assert_eq!(&b[..3], &[0xEF, 0xBB, 0xBF], "BOM'en er bevaret");
            String::from_utf8(b[3..].to_vec()).unwrap()
        }
        Tegnsaet::Utf16le | Tegnsaet::Utf16be => {
            let be = ts == Tegnsaet::Utf16be;
            assert_eq!(&b[..2], if be { &[0xFE, 0xFF] } else { &[0xFF, 0xFE] }, "BOM'en er bevaret");
            let u: Vec<u16> = b[2..]
                .chunks(2)
                .map(|c| {
                    if be {
                        u16::from_be_bytes([c[0], c[1]])
                    } else {
                        u16::from_le_bytes([c[0], c[1]])
                    }
                })
                .collect();
            String::from_utf16(&u).unwrap()
        }
    }
}

fn hash(p: &Path) -> u64 {
    let mut h = DefaultHasher::new();
    std::fs::read(p).unwrap().hash(&mut h);
    h.finish()
}

fn side(antal: usize) -> SideValg {
    SideValg {
        filter: "alle".into(),
        soeg: String::new(),
        vist: Vec::new(),
        antal,
    }
}

fn analysér(t: &Tilstand) -> FilAnalyse {
    fil_analyser(t, None, None, &[], &side(500)).unwrap()
}

/// Filnavnene i brugerens mappe, sorteret.
fn filer(m: &Mappe) -> Vec<String> {
    let mut v: Vec<String> = std::fs::read_dir(m.0.join("bruger"))
        .unwrap()
        .map(|e| e.unwrap().file_name().to_string_lossy().into_owned())
        .collect();
    v.sort();
    v
}

const TEGNSAET: [Tegnsaet; 4] = [Tegnsaet::Utf8, Tegnsaet::Utf8Bom, Tegnsaet::Utf16le, Tegnsaet::Utf16be];
const LINJESKIFT: [Linjeskift; 3] = [Linjeskift::Lf, Linjeskift::Crlf, Linjeskift::Blandet];

#[test]
fn fire_tegnsaet_tre_linjeskift_rundt_bytepraecist() {
    for ts in TEGNSAET {
        for ls in LINJESKIFT {
            let m = Mappe::ny();
            let (t, _) = program(&m);
            let original = kod(&tekst(ls), ts);
            let app = m.bruger("app.log");
            std::fs::write(&app, &original).unwrap();
            let foer = hash(&app);

            let info = fil_aabn(&t, Visning::Masker, &app).unwrap();
            assert_eq!(
                (info.tegnsaet, info.linjeskift, info.bytes),
                (ts, ls, original.len() as u64),
                "{ts:?} {ls:?}"
            );
            assert_eq!((info.navn.as_str(), info.linjer, info.ikke_vist), ("app.log", 6, 0));
            assert_eq!(info.uddrag, tekst(ls), "uddraget er teksten (under 200 000 tegn)");
            let a = analysér(&t);
            assert!(a.side.raekker.len() >= 5, "{ts:?} {ls:?}: {} rækker", a.side.raekker.len());
            let mk = fil_gem_og_masker(&t, &a.fravalgt, &[]).unwrap();
            assert!(
                mk.rester.is_empty(),
                "{ts:?} {ls:?}: {:?}",
                mk.rester.iter().map(|r| r.type_).collect::<Vec<_>>()
            );
            let f = fil_gem_forslag(&t, Visning::Masker, false).unwrap();
            assert_eq!(f.navn, "app.maskeret.log");
            assert_eq!(f.mappe.as_deref(), app.parent());
            let maskeret = m.bruger(&f.navn);
            assert_eq!(fil_gem_til(&t, Visning::Masker, &maskeret, false).unwrap(), "app.maskeret.log");

            // Den maskerede fil: samme tegnsæt og BOM, samme linjeskift, ingen af originalerne.
            let mb = std::fs::read(&maskeret).unwrap();
            let mt = afkod(&mb, ts);
            assert_eq!(fil::linjeskift(&mt), ls);
            let valgte = a
                .side
                .raekker
                .iter()
                .filter(|r| r.valgt)
                .flat_map(|r| r.vaerdier.iter().map(String::as_str));
            for o in ORIGINALER.into_iter().chain(valgte) {
                assert!(
                    !mt.to_lowercase().contains(&o.to_lowercase()),
                    "{ts:?} {ls:?}: {o} står i den maskerede fil"
                );
            }
            assert!(
                mt.contains("Bemærk: æøå ÆØÅ – kør igen 𝄞 fra "),
                "teksten uden for værdierne er uændret"
            );

            // Tilbage: åbn den maskerede fil i Demaskér, demaskér, gem; præcis de oprindelige bytes.
            let info2 = fil_aabn(&t, Visning::Demasker, &maskeret).unwrap();
            assert_eq!((info2.tegnsaet, info2.linjeskift), (ts, ls));
            let d = fil_demasker(&t).unwrap();
            assert!(d.koder.len() >= 5);
            let f2 = fil_gem_forslag(&t, Visning::Demasker, true).unwrap();
            assert_eq!(f2.navn, "app.demaskeret.log");
            let ud = m.bruger(&f2.navn);
            fil_gem_til(&t, Visning::Demasker, &ud, true).unwrap();
            assert_eq!(std::fs::read(&ud).unwrap(), original, "{ts:?} {ls:?}: rundturen er bytepræcis");
            assert_eq!(hash(&app), foer, "originalen er uændret");
            assert_eq!(
                filer(&m),
                ["app.demaskeret.log", "app.log", "app.maskeret.log"],
                "ingen midlertidige filer"
            );
        }
    }
}

#[test]
fn afviste_filer_siger_hvad_de_ligner_uden_indhold() {
    let m = Mappe::ny();
    let (t, _) = program(&m);
    let fejl = |navn: &str, b: &[u8]| {
        let p = m.bruger(navn);
        std::fs::write(&p, b).unwrap();
        match fil_aabn(&t, Visning::Masker, &p) {
            Err(UiFejl::Fil { fejl }) => fejl,
            r => panic!("{navn}: forventede en filfejl, fik {:?}", r.map(|i| i.navn)),
        }
    };
    // Latin-1 uden BOM: "Bemærk" med æ = 0xE6 på byte 4.
    assert_eq!(
        fejl("latin1.log", b"Bem\xe6rk: bruger060 fra 10.20.30.11\n"),
        FilFejl::Tegnsaet {
            ligner: "enkeltbyte",
            byte: Some(3)
        }
    );
    // Gyldig UTF-8 (æøå) og en ugyldig byte midt i: positionen.
    let mut b = "æøå bruger060\n".as_bytes().to_vec();
    let pos = b.len();
    b.extend_from_slice(b"\xff\xfe ord\n");
    assert_eq!(
        fejl("ugyldig.log", &b),
        FilFejl::Tegnsaet {
            ligner: "ugyldig_utf8",
            byte: Some(pos as u64)
        }
    );
    // UTF-16 uden BOM og en binær fil.
    let u16: Vec<u8> = "srcip=10.20.30.11\n".encode_utf16().flat_map(u16::to_le_bytes).collect();
    assert!(matches!(
        fejl("u16.log", &u16),
        FilFejl::Tegnsaet {
            ligner: "utf16_uden_bom",
            ..
        }
    ));
    assert!(matches!(
        fejl("bin.dat", b"\x7fELF\x02\x01\x01\x00\x00\x00\x00abc"),
        FilFejl::Tegnsaet { ligner: "binaer", .. }
    ));
    // Tom fil.
    assert_eq!(fejl("tom.log", b""), FilFejl::Tom);
    // Over grænsen (en tynd fil på 100 MiB + 1 byte; intet læses).
    let stor = m.bruger("stor.log");
    std::fs::File::create(&stor).unwrap().set_len(MAKS_FIL + 1).unwrap();
    assert_eq!(
        fil_aabn(&t, Visning::Masker, &stor).map(|i| i.navn),
        Err(UiFejl::Fil {
            fejl: FilFejl::ForStor {
                bytes: MAKS_FIL + 1,
                maks: MAKS_FIL
            }
        })
    );
    // En mappe, og en fil, der ikke findes.
    std::fs::create_dir(m.bruger("mappe")).unwrap();
    assert_eq!(
        fil_aabn(&t, Visning::Masker, &m.bruger("mappe")).map(|i| i.navn),
        Err(UiFejl::Fil { fejl: FilFejl::Mappe })
    );
    assert_eq!(
        fil_aabn(&t, Visning::Masker, &m.bruger("findes-ikke.log")).map(|i| i.navn),
        Err(UiFejl::Fil {
            fejl: FilFejl::Disk { hvad: "NotFound".into() }
        })
    );
    // Fejlen som JSON til webvisningen: art og felter, intet indhold.
    let json = serde_json::to_string(&UiFejl::Fil {
        fejl: FilFejl::Tegnsaet {
            ligner: "enkeltbyte",
            byte: Some(3),
        },
    })
    .unwrap();
    assert_eq!(json, r#"{"art":"fil","fejl":{"art":"tegnsaet","ligner":"enkeltbyte","byte":3}}"#);
    // Ingen fil er åben efter afvisningerne.
    assert_eq!(fil_raekker(&t, &side(10)).map(|s| s.i_alt), Err(UiFejl::IngenFil));
}

#[test]
fn originalen_overskrives_aldrig() {
    let m = Mappe::ny();
    let (t, _) = program(&m);
    let app = m.bruger("app.log");
    std::fs::write(&app, tekst(Linjeskift::Crlf)).unwrap();
    let foer = hash(&app);
    fil_aabn(&t, Visning::Masker, &app).unwrap();
    let a = analysér(&t);
    fil_gem_og_masker(&t, &a.fravalgt, &[]).unwrap();
    assert_eq!(
        fil_gem_til(&t, Visning::Masker, &app, false),
        Err(UiFejl::Fil { fejl: FilFejl::SammeFil })
    );
    // Samme fil under et andet navn (store bogstaver på et filsystem, der ikke skelner, og et hårdt link).
    let stort = m.bruger("APP.LOG");
    if stort.exists() {
        assert_eq!(
            fil_gem_til(&t, Visning::Masker, &stort, false),
            Err(UiFejl::Fil { fejl: FilFejl::SammeFil })
        );
    }
    let link = m.bruger("link.log");
    std::fs::hard_link(&app, &link).unwrap();
    assert_eq!(
        fil_gem_til(&t, Visning::Masker, &link, false),
        Err(UiFejl::Fil { fejl: FilFejl::SammeFil })
    );
    // Heller ikke fra Demaskér: den maskerede fil åbnes dér, og originalen i Maskér er stadig åben.
    let mk = m.bruger("app.maskeret.log");
    fil_gem_til(&t, Visning::Masker, &mk, false).unwrap();
    fil_aabn(&t, Visning::Demasker, &mk).unwrap();
    fil_demasker(&t).unwrap();
    assert_eq!(
        fil_gem_til(&t, Visning::Demasker, &app, true),
        Err(UiFejl::Fil { fejl: FilFejl::SammeFil })
    );
    assert_eq!(
        fil_gem_til(&t, Visning::Demasker, &mk, true),
        Err(UiFejl::Fil { fejl: FilFejl::SammeFil })
    );
    assert_eq!(hash(&app), foer, "originalen er uændret");
}

#[test]
fn rester_kraever_gem_alligevel() {
    let m = Mappe::ny();
    let (t, _) = program(&m);
    // Sagen kender hemmeligheden fra en indsat tekst. I filen står den med store bogstaver: hemmeligheder genbruges kun
    // bogstaveligt, så lækagetjekket melder den som en rest (kernens f1_hemmelighed_kun_bogstaveligt).
    let foerst = "Server=srv-068;User Id=app;Password=Sommer2026!;\r\n";
    let a = analyser(&t, foerst, None, &[]).unwrap();
    let fra: Vec<usize> = a.raekker.iter().filter(|r| !r.valgt).map(|r| r.id).collect();
    gem_og_masker(&t, foerst, &fra, &[]).unwrap();
    let p = m.bruger("fejl.log");
    std::fs::write(&p, "fejl: SOMMER2026! afvist\r\n").unwrap();
    fil_aabn(&t, Visning::Masker, &p).unwrap();
    let a = analysér(&t);
    let mk = fil_gem_og_masker(&t, &a.fravalgt, &[]).unwrap();
    assert_eq!(
        mk.rester.len(),
        1,
        "{:?}",
        mk.rester.iter().map(|r| (r.art, r.type_)).collect::<Vec<_>>()
    );
    assert_eq!(fil_gem_forslag(&t, Visning::Masker, false), Err(UiFejl::Rester { antal: 1 }));
    let ud = m.bruger("fejl.maskeret.log");
    assert_eq!(fil_gem_til(&t, Visning::Masker, &ud, false), Err(UiFejl::Rester { antal: 1 }));
    assert!(!ud.exists(), "uden Gem alligevel skrives ingen fil");
    assert!(fil_gem_forslag(&t, Visning::Masker, true).is_ok());
    fil_gem_til(&t, Visning::Masker, &ud, true).unwrap();
    assert!(ud.exists());
}

#[test]
fn sagen_gemmes_foer_filen() {
    let m = Mappe::ny();
    let (t, _) = program(&m);
    sag_ny(&t, "Kunde med fil", None).unwrap();
    let app = m.bruger("app.log");
    std::fs::write(&app, tekst(Linjeskift::Lf)).unwrap();
    fil_aabn(&t, Visning::Masker, &app).unwrap();
    let a = analysér(&t);
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(m.app().join("sager"), std::fs::Permissions::from_mode(0o500)).unwrap();
    }
    #[cfg(not(unix))]
    std::fs::remove_dir_all(m.app().join("sager")).unwrap();
    let r = fil_gem_og_masker(&t, &a.fravalgt, &[]);
    assert!(matches!(r, Err(UiFejl::Sag { .. })), "{:?}", r.map(|x| x.poster));
    assert_eq!(sag_status(&t).unwrap().poster, 0, "sagen i hukommelsen er uændret");
    // Intet resultat: ingen fil kan gemmes, og der er ingen fil.
    assert_eq!(fil_gem_forslag(&t, Visning::Masker, true), Err(UiFejl::IntetResultat));
    let ud = m.bruger("app.maskeret.log");
    assert_eq!(fil_gem_til(&t, Visning::Masker, &ud, true), Err(UiFejl::IntetResultat));
    assert_eq!(fil_kopi(&t, Visning::Masker), Err(UiFejl::IntetResultat));
    assert_eq!(filer(&m), ["app.log"]);
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(m.app().join("sager"), std::fs::Permissions::from_mode(0o700)).unwrap();
        // Disken virker igen: sagen gemmes, så kan filen gemmes.
        fil_gem_og_masker(&t, &a.fravalgt, &[]).unwrap();
        assert!(sag_status(&t).unwrap().poster > 0);
        fil_gem_til(&t, Visning::Masker, &ud, false).unwrap();
        // Lukkes sagen, hører resultatet ikke til en åben sag længere.
        sag_luk(&t).unwrap();
        assert_eq!(
            fil_gem_til(&t, Visning::Masker, &m.bruger("igen.log"), false),
            Err(UiFejl::Foraeldet)
        );
    }
}

#[test]
fn demaskeret_fil_kraever_bekraeftelse() {
    let m = Mappe::ny();
    let (t, _) = program(&m);
    let app = m.bruger("app.log");
    std::fs::write(&app, tekst(Linjeskift::Lf)).unwrap();
    fil_aabn(&t, Visning::Masker, &app).unwrap();
    let a = analysér(&t);
    fil_gem_og_masker(&t, &a.fravalgt, &[]).unwrap();
    let mk = m.bruger("app.maskeret.log");
    fil_gem_til(&t, Visning::Masker, &mk, false).unwrap();
    fil_aabn(&t, Visning::Demasker, &mk).unwrap();
    assert_eq!(
        fil_gem_forslag(&t, Visning::Demasker, true),
        Err(UiFejl::IntetResultat),
        "demaskér først"
    );
    fil_demasker(&t).unwrap();
    let ud = m.bruger("app.demaskeret.log");
    assert_eq!(fil_gem_forslag(&t, Visning::Demasker, false), Err(UiFejl::IkkeBekraeftet));
    assert_eq!(fil_gem_til(&t, Visning::Demasker, &ud, false), Err(UiFejl::IkkeBekraeftet));
    assert!(!ud.exists());
    fil_gem_til(&t, Visning::Demasker, &ud, true).unwrap();
    assert_eq!(std::fs::read(&ud).unwrap(), std::fs::read(&app).unwrap());
    // Kopiér: hele teksten med de rigtige værdier (under 5 MiB).
    assert_eq!(fil_kopi(&t, Visning::Demasker).unwrap(), tekst(Linjeskift::Lf));
    // Lukkes filen, er teksten og resultatet væk.
    fil_luk(&t, Visning::Demasker).unwrap();
    assert_eq!(fil_kopi(&t, Visning::Demasker), Err(UiFejl::IngenFil));
}

#[test]
fn afbrudt_skrivning_efterlader_intet() {
    let m = Mappe::ny();
    let ud = m.bruger("ud.log");
    let r = fil::skriv_med(&ud, "maskeret tekst\n", Tegnsaet::Utf16le, &[], &mut || {
        Err(std::io::Error::other("afbrudt"))
    });
    assert!(matches!(r, Err(FilFejl::Disk { .. })), "{r:?}");
    assert!(filer(&m).is_empty(), "{:?}", filer(&m));
    // En eksisterende fil er urørt efter en afbrudt overskrivning.
    std::fs::write(&ud, "før\n").unwrap();
    let _ = fil::skriv_med(&ud, "efter\n", Tegnsaet::Utf8, &[], &mut || Err(std::io::Error::other("afbrudt")));
    assert_eq!(std::fs::read_to_string(&ud).unwrap(), "før\n");
    assert_eq!(filer(&m), ["ud.log"]);
    // Til en mappe skrives ikke.
    assert_eq!(fil::skriv(&m.0.join("bruger"), "x", Tegnsaet::Utf8, &[]), Err(FilFejl::Mappe));
}

#[test]
fn filnavneforslag() {
    assert_eq!(forslag("app.log", "maskeret"), "app.maskeret.log");
    assert_eq!(forslag("app", "maskeret"), "app.maskeret");
    assert_eq!(forslag("arkiv.tar.gz", "maskeret"), "arkiv.tar.maskeret.gz");
    assert_eq!(forslag("fw.2026-11-10.log", "maskeret"), "fw.2026-11-10.maskeret.log");
    assert_eq!(forslag(".bashrc", "maskeret"), ".bashrc.maskeret");
    assert_eq!(forslag("slut.", "maskeret"), "slut..maskeret");
    assert_eq!(forslag_demaskeret("app.maskeret.log"), "app.demaskeret.log");
    assert_eq!(forslag_demaskeret("svar.log"), "svar.demaskeret.log");
    assert_eq!(forslag_demaskeret("svar"), "svar.demaskeret");
    assert_eq!(forslag_demaskeret("a.b.maskeret.txt"), "a.b.demaskeret.txt");
    assert_eq!(forslag_demaskeret(".maskeret.log"), ".maskeret.demaskeret.log");
}

/// En opdigtet log med `n` forskellige adresser (én række hver) og én hemmelighed.
fn mange_raekker(n: usize) -> String {
    let mut t = String::from("Password=Sommer2026!;\n");
    for i in 0..n {
        t.push_str(&format!("srcip=10.20.{}.{} msg=ok\n", i / 250, i % 250 + 1));
    }
    t
}

#[test]
fn raekker_i_sider_soegning_og_trae_over_alle() {
    let m = Mappe::ny();
    let (t, _) = program(&m);
    let p = m.bruger("mange.log");
    std::fs::write(&p, mange_raekker(1200)).unwrap();
    fil_aabn(&t, Visning::Masker, &p).unwrap();
    let a = analysér(&t);
    assert_eq!(a.side.raekker.len(), 500, "500 ad gangen");
    assert_eq!((a.side.i_alt, a.side.antal.alle), (1201, 1201));
    assert_eq!(a.side.antal.hemmelig, 1);
    // Vis flere.
    assert_eq!(fil_raekker(&t, &side(1000)).unwrap().raekker.len(), 1000);
    // Søgning over alle rækker: en adresse langt ude i filen, og en kode.
    let mut s = side(500);
    s.soeg = "10.20.4.150".into();
    let r = fil_raekker(&t, &s).unwrap();
    assert_eq!((r.i_alt, r.raekker[0].vaerdier[0].as_str()), (1, "10.20.4.150"));
    let kode = r.raekker[0].koder[0].clone();
    s.soeg = kode.clone();
    assert_eq!(fil_raekker(&t, &s).unwrap().raekker[0].koder[0], kode);
    // En skjult hemmelighed findes ikke på værdien; efter Vis gør den.
    s.soeg = "sommer2026".into();
    assert_eq!(fil_raekker(&t, &s).unwrap().i_alt, 0);
    let hid = a.side.raekker.iter().find(|r| r.hemmelig).unwrap().id;
    s.vist = vec![hid];
    assert_eq!(fil_raekker(&t, &s).unwrap().i_alt, 1);
    // Filteret Hemmeligheder.
    let mut h = side(500);
    h.filter = "hemmelig".into();
    assert_eq!(fil_raekker(&t, &h).unwrap().i_alt, 1);
    // Et fravalg langt ude i filen: valget gælder alle rækker; "rørt" bevarer brugerens valg over standarden.
    let langt = fil_raekker(&t, &{
        let mut x = side(500);
        x.soeg = "10.20.4.150".into();
        x
    })
    .unwrap()
    .raekker[0]
        .id;
    let a2 = fil_analyser(&t, Some(&[langt]), None, &[], &side(500)).unwrap();
    assert_eq!((a2.fravalgt.clone(), a2.side.valgte), (vec![langt], 1200));
    let a3 = fil_analyser(&t, None, Some(&[(langt, false)]), &[], &side(500)).unwrap();
    assert_eq!(a3.fravalgt, vec![langt], "rørt: fra");
    let a4 = fil_analyser(&t, None, None, &[], &side(500)).unwrap();
    assert!(a4.fravalgt.is_empty(), "standard: alt maskeres");
}

#[test]
fn kopi_op_til_5_mib() {
    let m = Mappe::ny();
    let (t, _) = program(&m);
    let lille = m.bruger("lille.log");
    std::fs::write(&lille, tekst(Linjeskift::Crlf)).unwrap();
    fil_aabn(&t, Visning::Masker, &lille).unwrap();
    let a = analysér(&t);
    let mk = fil_gem_og_masker(&t, &a.fravalgt, &[]).unwrap();
    assert!(mk.kopierbar);
    let kopi = fil_kopi(&t, Visning::Masker).unwrap();
    assert_eq!(kopi, mk.uddrag);
    assert!(!kopi.contains("bruger060"));
    // Over 5 MiB maskeret: Kopiér er nedtonet, og Rust afviser.
    let stor = m.bruger("stor.log");
    let linje = "2026-11-10T08:00:01 srcip=10.20.30.11 msg=\"forbindelse åbnet\" n=0000000000\n";
    std::fs::write(&stor, linje.repeat(6 * 1024 * 1024 / linje.len() + 1)).unwrap();
    let info = fil_aabn(&t, Visning::Masker, &stor).unwrap();
    assert!(info.ikke_vist > 0, "uddraget er afkortet");
    assert_eq!(info.uddrag.chars().count(), fil::UDDRAG_TEGN);
    let a = analysér(&t);
    let mk = fil_gem_og_masker(&t, &a.fravalgt, &[]).unwrap();
    assert!(!mk.kopierbar && mk.bytes > fil::MAKS_KOPI);
    assert!(matches!(fil_kopi(&t, Visning::Masker), Err(UiFejl::ForStorTilKopi { .. })));
}

#[test]
fn ordbog_der_ikke_kan_aabnes_start_forfra() {
    let m = Mappe::ny();
    let (t0, lager) = program(&m);
    // En gyldig ordbog (fil og nøgle); en kopi gemmes til sidst. Derefter beskadiges filen (sidste byte), og et nyt
    // program kan ikke åbne den.
    ordbog_tilfoej(&t0, "ord", "Rugbrød", None).unwrap();
    let fil = m.app().join("ordbog.grimnir");
    let gyldig = std::fs::read(&fil).unwrap();
    let mut beskadiget = gyldig.clone();
    *beskadiget.last_mut().unwrap() ^= 0xFF;
    std::fs::write(&fil, &beskadiget).unwrap();
    let t = Tilstand::paa_disk(m.app(), lager.clone());
    assert!(ordbog_hent(&t).unwrap().fejl.is_some());
    assert!(matches!(ordbog_tilfoej(&t, "ord", "Uglebo", None), Err(UiFejl::OrdbogLaast { .. })));
    assert!(matches!(
        ordbog_start_forfra(&t, "10-11-2026"),
        Err(UiFejl::Sag {
            fejl: SagFejl::UgyldigDato
        })
    ));
    let s = ordbog_start_forfra(&t, "2026-11-10").unwrap();
    assert_eq!(s.flyttet_til.as_deref(), Some("ordbog.2026-11-10.ulaeselig"));
    assert!(s.ordbog.fejl.is_none() && s.ordbog.poster.is_empty());
    let flyttet = m.app().join("ordbog.2026-11-10.ulaeselig");
    assert_eq!(std::fs::read(&flyttet).unwrap(), beskadiget, "filen er flyttet, ikke slettet");
    assert!(!fil.exists());
    // Den nye ordbog virker og bruger den samme nøgle: den gyldige kopi kan stadig læses med nøglen i lageret.
    ordbog_tilfoej(&t, "ord", "Uglebo", None).unwrap();
    let kopi = m.0.join("kopi.grimnir");
    std::fs::write(&kopi, &gyldig).unwrap();
    let (_, poster) = ordbog::laes_fil(&kopi, &lager.hent_konto(KONTO).unwrap()).unwrap();
    assert_eq!(poster[0].vaerdi, "Rugbrød");
    // Et nyt program læser den nye ordbog.
    let t2 = Tilstand::paa_disk(m.app(), lager.clone());
    assert_eq!(ordbog_hent(&t2).unwrap().poster.len(), 1);
    // Kan ordbogen åbnes, gør Start forfra intet.
    let s2 = ordbog_start_forfra(&t2, "2026-11-10").unwrap();
    assert_eq!((s2.flyttet_til, s2.ordbog.poster.len()), (None, 1));
    // Samme dato igen: -2.
    std::fs::write(&fil, b"igen beskadiget").unwrap();
    let t3 = Tilstand::paa_disk(m.app(), lager);
    assert!(ordbog_hent(&t3).unwrap().fejl.is_some());
    assert_eq!(
        ordbog_start_forfra(&t3, "2026-11-10").unwrap().flyttet_til.as_deref(),
        Some("ordbog.2026-11-10-2.ulaeselig")
    );
}

/// En opdigtet log på ca. `mb` MB (som målingerne i HANDOFF).
fn stor_log(mb: usize) -> String {
    let mut t = String::with_capacity(mb * 1_000_000 + 200);
    let mut i = 0u64;
    while t.len() < mb * 1_000_000 {
        let (a, b) = (i % 250, (i / 250) % 250);
        t.push_str(&format!(
            "2026-11-10T08:{:02}:{:02} srcip=10.20.{b}.{a} dst=203.0.113.{a} host=srv-{:03}.kontor.test user=bruger{:03} msg=\"forbindelse lukket\" n={i}\r\n",
            (i / 60) % 60,
            i % 60,
            i % 400,
            i % 120
        ));
        i += 1;
    }
    t
}

#[test]
fn andre_kommandoer_svarer_mens_en_stor_fil_arbejdes_paa() {
    let m = Mappe::ny();
    let (t, _) = program(&m);
    let t = Arc::new(t);
    let p = m.bruger("stor.log");
    std::fs::write(&p, stor_log(10)).unwrap();
    fil_aabn(&t, Visning::Masker, &p).unwrap();
    let t2 = t.clone();
    let traad = std::thread::spawn(move || {
        let a = fil_analyser(&t2, None, None, &[], &side(500)).unwrap();
        fil_gem_og_masker(&t2, &a.fravalgt, &[]).unwrap();
    });
    // Mens analysen og maskeringen kører: kommandoerne, rammen kalder, svarer hurtigt eller spørger hellere end at
    // vente (lukning).
    let mut langsomst = Duration::ZERO;
    let mut maalt = 0;
    std::thread::sleep(Duration::from_millis(50));
    while !traad.is_finished() {
        let s = Instant::now();
        let _ = ordbog_hent(&t).unwrap();
        let _ = indstillinger_hent(&t);
        let _ = t.skal_spoerge_ved_luk();
        langsomst = langsomst.max(s.elapsed());
        maalt += 1;
        std::thread::sleep(Duration::from_millis(20));
    }
    traad.join().unwrap();
    assert!(maalt >= 5, "målt {maalt} gange");
    assert!(langsomst < Duration::from_millis(100), "langsomste svar {langsomst:?}");
    println!("svartid under analyse og maskering af 10 MB: højst {langsomst:?} over {maalt} målinger");
}

/// Målingerne i HANDOFF (F6): 10 MB og 100 MB i debug-profilen (samme som debug-bundlen). Kør med
/// `/usr/bin/time -l cargo test -p grimnir --test fil1 -- --ignored --nocapture maal_` for største hukommelse.
#[test]
#[ignore]
fn maal_10_og_100_mb() {
    let mb: usize = std::env::var("GRIMNIR_MAAL_MB").ok().and_then(|s| s.parse().ok()).unwrap_or(10);
    let m = Mappe::ny();
    let (t, _) = program(&m);
    let p = m.bruger("maal.log");
    std::fs::write(&p, stor_log(mb)).unwrap();
    let s = Instant::now();
    let info = fil_aabn(&t, Visning::Masker, &p).unwrap();
    let laes = s.elapsed();
    let s = Instant::now();
    let a = analysér(&t);
    let analyse = s.elapsed();
    let s = Instant::now();
    let mk = fil_gem_og_masker(&t, &a.fravalgt, &[]).unwrap();
    let masker = s.elapsed();
    let s = Instant::now();
    fil_gem_til(&t, Visning::Masker, &m.bruger("maal.maskeret.log"), true).unwrap();
    let skriv = s.elapsed();
    println!(
        "MÅLING {mb} MB: {} bytes, {} linjer, {} rækker, {} rester | læs {laes:?} | analysér {analyse:?} | gem og maskér {masker:?} | skriv {skriv:?}",
        info.bytes,
        info.linjer,
        a.side.antal.alle,
        mk.rester.len()
    );
}
