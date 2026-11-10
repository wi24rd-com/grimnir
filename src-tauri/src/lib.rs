//! Skallen i Wi24rd Grimnir: ét vindue med Wi24rd UI Kit 2's programskal, programmenuen og én kommando,
//! `kerne_version`, der viser kernens versionsnummer i fodlinjen som bevis for koblingen til `grimnir-core`.
//!
//! Ingen plugins og ingen netværkskode. Maskering, sager og ordbog kommer i senere cyklusser.
#![forbid(unsafe_code)]

// Menuen bygges kun på macOS (se `run`); på Windows bruges kun `handling` og `platform_skript`.
#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
mod programmenu;

use tauri::{Emitter, Manager};

/// Kernens versionsnummer (`version` i `grimnir-core/Cargo.toml`, læst af `build.rs`).
pub const KERNE_VERSION: &str = env!("GRIMNIR_KERNE_VERSION");

/// Kernens versionsnummer til fodlinjen.
#[tauri::command]
fn kerne_version() -> &'static str {
    KERNE_VERSION
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
        .invoke_handler(tauri::generate_handler![kerne_version])
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
            app.set_menu(programmenu::byg(app.handle())?)?;
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
