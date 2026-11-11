//! Indstillinger (V-ORDBOG.1 O6): standardvalg for nye sager, standardudløb og om guiden ved første start er vist; fra
//! V-LAAS.3 også "Lås efter stilstand" (5, 15, 30 eller 60 minutter).
//!
//! V-LAAS.3 N1 (ADR D20): "Lås Grimnir ved start" fra V-LAAS.2 er fjernet. Låsen ved start kan ikke slås fra, fordi
//! denne fil står i klartekst og kan rettes af en person ved maskinen. En ældre fil med feltet `laas_ved_start` læses
//! uden fejl; feltet ignoreres (som alle ukendte felter) og forsvinder, næste gang filen gemmes.
//!
//! Filen `<app-data>/indstillinger.json` er ikke følsom (kun sandhedsværdier og et tal) og står derfor i klartekst. Den
//! skrives atomart med samme kode som sagerne ([`crate::sager::skriv_atomart`]). Tema og sprog bliver i webvisningens
//! `localStorage` som før. Mangler filen, eller kan den ikke læses, gælder standardværdierne; den beskadigede fil
//! overskrives først, når brugeren gemmer indstillingerne.

use std::path::{Path, PathBuf};

use grimnir_core::Valg;
use serde::{Deserialize, Serialize};

use crate::sager::{skriv_atomart, SagFejl};
use crate::stilstand;

/// Filens navn i `<app-data>`.
pub const FILNAVN: &str = "indstillinger.json";
/// De standardudløb, brugeren kan vælge (dage); `None` er ingen udløb.
pub const UDLOEB: [Option<u32>; 3] = [None, Some(30), Some(90)];

/// Indstillingerne. Ukendte felter ignoreres, og manglende felter får standardværdien (en ældre eller nyere fil kan
/// læses).
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default)]
pub struct Indstillinger {
    /// Nye sager maskerer fremmede offentlige adresser (ADR D4; standard: nej).
    pub masker_fremmede: bool,
    /// Nye sager bevarer sidste oktet i egne net (ADR D5; standard: ja).
    pub bevar_sidste_oktet: bool,
    /// Standardudløb for en ny navngiven sag i dage: ingen, 30 eller 90.
    pub udloeb_dage: Option<u32>,
    /// Guiden ved første start er afsluttet eller sprunget over.
    pub guide_vist: bool,
    /// V-LAAS.3: "Lås efter stilstand" i minutter: 5, 15 (standard), 30 eller 60 ([`stilstand::MINUTTER`]). Der er
    /// ingen værdi, der slår låsen fra.
    pub laas_efter_min: u32,
}

impl Default for Indstillinger {
    fn default() -> Self {
        let v = Valg::default();
        Indstillinger {
            masker_fremmede: v.masker_fremmede,
            bevar_sidste_oktet: v.bevar_sidste_oktet,
            udloeb_dage: None,
            guide_vist: false,
            laas_efter_min: stilstand::STANDARD_MINUTTER,
        }
    }
}

impl Indstillinger {
    /// Valget for en ny sag.
    pub fn valg(&self) -> Valg {
        Valg {
            masker_fremmede: self.masker_fremmede,
            bevar_sidste_oktet: self.bevar_sidste_oktet,
        }
    }

    /// Sand, hvis standardudløbet og grænsen for stilstand er blandt de tilladte.
    pub fn gyldig(&self) -> bool {
        UDLOEB.contains(&self.udloeb_dage) && stilstand::MINUTTER.contains(&self.laas_efter_min)
    }
}

/// Filens sti i mappen.
pub fn sti(mappe: &Path) -> PathBuf {
    mappe.join(FILNAVN)
}

/// Læser indstillingerne. Mangler filen, eller kan den ikke læses, svares der med standardværdierne.
pub fn laes(fil: &Path) -> Indstillinger {
    std::fs::read(fil)
        .ok()
        .and_then(|b| serde_json::from_slice::<Indstillinger>(&b).ok())
        .filter(Indstillinger::gyldig)
        .unwrap_or_default()
}

/// Skriver indstillingerne atomart (mappen oprettes, hvis den mangler).
pub fn gem(fil: &Path, i: &Indstillinger) -> Result<(), SagFejl> {
    if let Some(m) = fil.parent() {
        crate::sager::opret_mappe(m)?;
    }
    let mut bytes = serde_json::to_vec_pretty(i).map_err(|_| SagFejl::Beskadiget)?;
    bytes.push(b'\n');
    skriv_atomart(fil, &bytes, &mut || Ok(()))
}

// ------------------------------------------------------------------------------------------------------- V-LAAS.6 N2

/// V-LAAS.6 N2: filen i `<app-data>` med navnet på en midlertidig sag, Grimnir gemte, da programmet afsluttede uden at
/// spørge (Afslut fra Dock, log ud, genstart, sluk), eller (V-PUDS.1 N1) da den låste. Ved næste oplåsning (i samme
/// kørsel eller ved næste start) siges navnet, og filen slettes.
///
/// Filen har ét felt, `midlertidig_gemt`, og kun et navn, Grimnir selv giver (`Midlertidig ÅÅÅÅ-MM-DD TT.MM.SS` /
/// `Temporary …`, [`er_midlertidigt_navn`]): et tidsstempel, intet om sagens indhold. Den står derfor i klartekst, som
/// indstillingerne. Den er en fil for sig og ikke et felt i [`Indstillinger`], fordi webvisningen gemmer indstillingerne
/// hele (`indstillinger_gem`) og ellers skulle kende og sende feltet tilbage.
pub const GEMT_FILNAVN: &str = "gemt-ved-afslut.json";

/// Indholdet af [`GEMT_FILNAVN`]. Andre felter afvises (så filen kun kan bære navnet).
#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct GemtVedAfslut {
    midlertidig_gemt: String,
}

/// Filens sti i mappen.
pub fn gemt_sti(mappe: &Path) -> PathBuf {
    mappe.join(GEMT_FILNAVN)
}

/// Sand, hvis `navn` har præcis formen på et navn, Grimnir giver en midlertidig sag, der gemmes af sig selv:
/// `Midlertidig ` eller `Temporary ` og `ÅÅÅÅ-MM-DD TT.MM.SS` (cifre).
pub fn er_midlertidigt_navn(navn: &str) -> bool {
    let Some(tid) = navn.strip_prefix("Midlertidig ").or_else(|| navn.strip_prefix("Temporary ")) else {
        return false;
    };
    let b = tid.as_bytes();
    b.len() == 19
        && b.iter().enumerate().all(|(i, c)| match i {
            4 | 7 => *c == b'-',
            10 => *c == b' ',
            13 | 16 => *c == b'.',
            _ => c.is_ascii_digit(),
        })
}

/// Skriver navnet atomart (mappen oprettes, hvis den mangler). Et andet navn end Grimnirs eget afvises.
pub fn gem_gemt_navn(fil: &Path, navn: &str) -> Result<(), SagFejl> {
    if !er_midlertidigt_navn(navn) {
        return Err(SagFejl::Beskadiget);
    }
    if let Some(m) = fil.parent() {
        crate::sager::opret_mappe(m)?;
    }
    let mut bytes = serde_json::to_vec(&GemtVedAfslut {
        midlertidig_gemt: navn.to_string(),
    })
    .map_err(|_| SagFejl::Beskadiget)?;
    bytes.push(b'\n');
    skriv_atomart(fil, &bytes, &mut || Ok(()))
}

/// Læser navnet. Mangler filen, kan den ikke læses, eller er navnet ikke Grimnirs eget, svares der `None`.
pub fn laes_gemt_navn(fil: &Path) -> Option<String> {
    std::fs::read(fil)
        .ok()
        .and_then(|b| serde_json::from_slice::<GemtVedAfslut>(&b).ok())
        .map(|g| g.midlertidig_gemt)
        .filter(|n| er_midlertidigt_navn(n))
}

/// Sletter filen (beskeden er givet). En fil, der ikke findes, er ikke en fejl.
pub fn glem_gemt_navn(fil: &Path) {
    let _ = std::fs::remove_file(fil);
}
