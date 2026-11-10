//! Appens egne kommandoer får autogenererede rettigheder (`allow-<kommando>`), så `capabilities/default.json` skal nævne
//! hver enkelt. Kernens versionsnummer kommer fra `grimnir_core::VERSION` (V-SAG.1), ikke herfra.
const KOMMANDOER: &[&str] = &[
    "kerne_version",
    "analyser",
    "gem_og_masker",
    "demasker",
    "sag_status",
    "sag_nulstil",
    "menu_sprog",
    "sag_ny",
    "sag_liste",
    "sag_aabn",
    "sag_luk",
    "sag_omdoeb",
    "sag_udloeb",
    "sag_slet",
    "program_afslut",
];

fn main() {
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(tauri_build::AppManifest::new().commands(KOMMANDOER)))
        .expect("tauri-build fejlede");
}
