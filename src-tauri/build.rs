//! Appens egne kommandoer får autogenererede rettigheder (`allow-<kommando>`), så `capabilities/default.json` skal nævne
//! hver enkelt. Kernens versionsnummer læses fra `../grimnir-core/Cargo.toml` og gives videre som `GRIMNIR_KERNE_VERSION`:
//! kernen har ingen egen konstant for det, og den må ikke ændres i denne cyklus.
const KOMMANDOER: &[&str] = &[
    "kerne_version",
    "analyser",
    "gem_og_masker",
    "demasker",
    "sag_status",
    "sag_nulstil",
    "menu_sprog",
];

fn kerne_version() -> String {
    let sti = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../grimnir-core/Cargo.toml");
    println!("cargo:rerun-if-changed={}", sti.display());
    let toml = std::fs::read_to_string(&sti).expect("grimnir-core/Cargo.toml kan læses");
    let mut i_pakke = false;
    for linje in toml.lines().map(str::trim) {
        if linje.starts_with('[') {
            i_pakke = linje == "[package]";
        } else if i_pakke {
            if let Some(v) = linje.strip_prefix("version").map(str::trim).and_then(|r| r.strip_prefix('=')) {
                return v.trim().trim_matches('"').to_string();
            }
        }
    }
    panic!("version mangler i [package] i grimnir-core/Cargo.toml");
}

fn main() {
    println!("cargo:rustc-env=GRIMNIR_KERNE_VERSION={}", kerne_version());
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(tauri_build::AppManifest::new().commands(KOMMANDOER)))
        .expect("tauri-build fejlede");
}
