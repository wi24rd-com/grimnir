//! Skallen i Wi24rd Grimnir: ét vindue med Wi24rd UI Kit 2's programskal, programmenuen og kommandoerne:
//! `kerne_version` (fodlinjen), `analyser`, `gem_og_masker`, `demasker`, `sag_status` og `sag_nulstil` (V-SKAL.2) og
//! `menu_sprog` (programmenuen følger UI'ets sprog).
//!
//! Ingen plugins og ingen netværkskode. Sagen lever kun i hukommelsen ([`maskering::Tilstand`]); sager på disk,
//! kryptering og ordbog kommer i B3.
#![forbid(unsafe_code)]

pub mod maskering;

// Menuen bygges kun på macOS (se `run`); på Windows bruges kun `handling` og `platform_skript`.
#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
mod programmenu;

use maskering::{Analyse, Demaskering, Maskering, Rettelse, SagStatus, Tilstand, UiFejl};
use tauri::{Emitter, Manager, State};

/// Kernens versionsnummer (`version` i `grimnir-core/Cargo.toml`, læst af `build.rs`).
pub const KERNE_VERSION: &str = env!("GRIMNIR_KERNE_VERSION");

/// Kernens versionsnummer til fodlinjen.
#[tauri::command]
fn kerne_version() -> &'static str {
    KERNE_VERSION
}

/// Fundene i en tekst med forslag til koder. `fravalgt` og `rettelser` er brugerens valg indtil nu (udeladt: kernens
/// standard), så tabellen viser de koder, `gem_og_masker` vil bruge. Ændrer ikke sagen.
#[tauri::command(async)]
fn analyser(
    tilstand: State<'_, Tilstand>,
    tekst: String,
    fravalgt: Option<Vec<usize>>,
    rettelser: Option<Vec<Rettelse>>,
) -> Result<Analyse, UiFejl> {
    maskering::analyser(&tilstand, &tekst, fravalgt.as_deref(), rettelser.as_deref().unwrap_or_default())
}

/// Maskerer teksten med brugerens valg og gemmer sagen (i hukommelsen). Afvises en rettelse, gemmes intet.
#[tauri::command(async)]
fn gem_og_masker(
    tilstand: State<'_, Tilstand>,
    tekst: String,
    fravalgt: Vec<usize>,
    rettelser: Vec<Rettelse>,
) -> Result<Maskering, UiFejl> {
    maskering::gem_og_masker(&tilstand, &tekst, &fravalgt, &rettelser)
}

/// Sætter de rigtige værdier tilbage i en tekst med sagens koder.
#[tauri::command(async)]
fn demasker(tilstand: State<'_, Tilstand>, tekst: String) -> Result<Demaskering, UiFejl> {
    maskering::demasker(&tilstand, &tekst)
}

/// Antal poster i sagen.
#[tauri::command]
fn sag_status(tilstand: State<'_, Tilstand>) -> SagStatus {
    maskering::sag_status(&tilstand)
}

/// Programmenuen på UI'ets sprog (`da` | `en`). Kun macOS har en programmenu; andre steder gør kommandoen intet.
#[tauri::command]
fn menu_sprog(app: tauri::AppHandle, sprog: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let menu = programmenu::byg(&app, programmenu::tekster(&sprog)).map_err(|e| e.to_string())?;
        app.set_menu(menu).map_err(|e| e.to_string())?;
    }
    #[cfg(not(target_os = "macos"))]
    let _ = (app, sprog);
    Ok(())
}

/// Tømmer sagen (UI'et beder om bekræftelse først).
#[tauri::command]
fn sag_nulstil(tilstand: State<'_, Tilstand>) -> SagStatus {
    maskering::sag_nulstil(&tilstand)
}

/// Bygger vinduet fra konfigurationen ("create": false i tauri.conf.json), så init-scriptet kan give siden platformen
/// (`<html data-platform>`), før den tegnes: rammen reserverer så plads til trafiklysene på macOS.
fn aabn_vindue(app: &tauri::AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let konfig = app
        .config()
        .app
        .windows
        .first()
        .cloned()
        .ok_or("vinduet mangler i tauri.conf.json")?;
    let vindue = tauri::WebviewWindowBuilder::from_config(app, &konfig)?
        .initialization_script(programmenu::platform_skript(std::env::consts::OS))
        .build()?;
    vindue.show()?;
    vindue.set_focus()?;
    Ok(())
}

/// Starter programmet.
pub fn run() {
    tauri::Builder::default()
        .manage(Tilstand::ny())
        .invoke_handler(tauri::generate_handler![
            kerne_version,
            analyser,
            gem_og_masker,
            demasker,
            sag_status,
            sag_nulstil,
            menu_sprog
        ])
        .on_menu_event(|app, ev| {
            if let Some(handling) = programmenu::handling(ev.id().as_ref()) {
                if let Some(v) = app.get_webview_window("main") {
                    let _ = v.show();
                    let _ = v.set_focus();
                }
                let _ = app.emit("menu", handling);
            }
        })
        .setup(|app| {
            // Kun macOS: på Windows ville menuen blive en menubjælke i vinduet; dér fanger rammen Ctrl+, selv.
            #[cfg(target_os = "macos")]
            app.set_menu(programmenu::byg(app.handle(), &programmenu::DA)?)?;
            aabn_vindue(app.handle())?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Grimnir kunne ikke starte");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn kerne_version_er_kernens_version() {
        // Samme tal som Cargo selv har for kernen (Cargo.toml i grimnir-core).
        let toml = include_str!("../../grimnir-core/Cargo.toml");
        assert!(toml.contains(&format!("version = \"{KERNE_VERSION}\"")), "{KERNE_VERSION}");
        assert_eq!(kerne_version(), KERNE_VERSION);
        assert!(KERNE_VERSION.split('.').count() == 3 && KERNE_VERSION.split('.').all(|d| d.parse::<u32>().is_ok()));
    }
}
