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
