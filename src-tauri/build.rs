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
    "sag_valg",
    "ordbog_hent",
    "ordbog_tilfoej",
    "ordbog_ret",
    "ordbog_fjern",
    "ordbog_proev",
    "indstillinger_hent",
    "indstillinger_gem",
    "fil_aabn",
    "fil_aabn_sluppet",
    "fil_luk",
    "fil_analyser",
    "fil_raekker",
    "fil_gem_og_masker",
    "fil_demasker",
    "fil_kopi",
    "fil_gem",
    "ordbog_start_forfra",
    "laas_status",
    "laas_op",
    "aktivitet",
    "udklip_kopieret",
    "kvittering",
    "sag_indhold",
    // V-OPBYG.1 N7: Vejledning (beder styresystemet åbne en fast adresse) og Lås i titellinjen.
    "vejledning_aabn",
    "laas_nu",
];

fn main() {
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(tauri_build::AppManifest::new().commands(KOMMANDOER)))
        .expect("tauri-build fejlede");
}
