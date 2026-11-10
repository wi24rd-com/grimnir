//! Skallen i Wi24rd Grimnir: ét vindue med Wi24rd UI Kit 2's programskal, programmenuen og kommandoerne:
//! `kerne_version` (fodlinjen), `analyser`, `gem_og_masker`, `demasker`, `sag_status` og `sag_nulstil` (V-SKAL.2),
//! `menu_sprog` (programmenuen følger UI'ets sprog) og sagerne på disk (V-SAG.1): `sag_ny`, `sag_liste`, `sag_aabn`,
//! `sag_luk`, `sag_omdoeb`, `sag_udloeb`, `sag_slet` og `program_afslut`; ordbogen og indstillingerne (V-ORDBOG.1):
//! `ordbog_hent`, `ordbog_tilfoej`, `ordbog_ret`, `ordbog_fjern`, `ordbog_proev`, `indstillinger_hent`,
//! `indstillinger_gem` og `sag_valg`.
//!
//! Ingen plugins og ingen netværkskode. Sagerne ligger krypteret i `<app-data>/sager/` ([`sager`]), ordbogen krypteret
//! i `<app-data>/ordbog.grimnir` ([`ordbog`]); nøglerne i Keychain/Credential Manager. Indstillingerne står i klartekst i
//! `<app-data>/indstillinger.json` ([`indstillinger`]; intet følsomt).
#![forbid(unsafe_code)]

pub mod indstillinger;
pub mod maskering;
pub mod ordbog;
pub mod sager;

// Menuen bygges kun på macOS (se `run`); på Windows bruges kun `handling` og `platform_skript`.
#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
mod programmenu;

use indstillinger::Indstillinger;
use maskering::{Analyse, Demaskering, Maskering, OrdbogUd, Proeve, Rettelse, SagListePost, SagStatus, Tilstand, UiFejl};
use tauri::{Emitter, Manager, State};

/// Kernens versionsnummer (`grimnir_core::VERSION`).
pub const KERNE_VERSION: &str = grimnir_core::VERSION;

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

/// Gør den aktuelle sag til en navngiven sag på disk (`udloeb`: `ÅÅÅÅ-MM-DD` eller udeladt).
#[tauri::command(async)]
fn sag_ny(tilstand: State<'_, Tilstand>, navn: String, udloeb: Option<String>) -> Result<SagStatus, UiFejl> {
    maskering::sag_ny(&tilstand, &navn, udloeb.as_deref())
}

/// Sagerne på disk (hovederne; en sag, der ikke kan åbnes, står med årsag).
#[tauri::command(async)]
fn sag_liste(tilstand: State<'_, Tilstand>) -> Result<Vec<SagListePost>, UiFejl> {
    maskering::sag_liste(&tilstand)
}

/// Åbner en sag fra disk.
#[tauri::command(async)]
fn sag_aabn(tilstand: State<'_, Tilstand>, id: String) -> Result<SagStatus, UiFejl> {
    maskering::sag_aabn(&tilstand, &id)
}

/// Lukker sagen (en ny, tom midlertidig sag starter).
#[tauri::command]
fn sag_luk(tilstand: State<'_, Tilstand>) -> SagStatus {
    maskering::sag_luk(&tilstand)
}

/// Omdøber en sag.
#[tauri::command(async)]
fn sag_omdoeb(tilstand: State<'_, Tilstand>, id: String, navn: String) -> Result<(), UiFejl> {
    maskering::sag_omdoeb(&tilstand, &id, &navn)
}

/// Sætter eller fjerner en sags udløbsdato.
#[tauri::command(async)]
fn sag_udloeb(tilstand: State<'_, Tilstand>, id: String, udloeb: Option<String>) -> Result<(), UiFejl> {
    maskering::sag_udloeb(&tilstand, &id, udloeb.as_deref())
}

/// Sletter en sags fil og nøgle (UI'et bekræfter med sagens navn først).
#[tauri::command(async)]
fn sag_slet(tilstand: State<'_, Tilstand>, id: String) -> Result<SagStatus, UiFejl> {
    maskering::sag_slet(&tilstand, &id)
}

/// Ændrer valget (D4, D5) for den åbne sag; gælder nye værdier.
#[tauri::command(async)]
fn sag_valg(tilstand: State<'_, Tilstand>, masker_fremmede: bool, bevar_sidste_oktet: bool) -> Result<SagStatus, UiFejl> {
    maskering::sag_valg(&tilstand, masker_fremmede, bevar_sidste_oktet)
}

/// Ordbogen (posterne, og fejlen, hvis filen ikke kunne åbnes).
#[tauri::command(async)]
fn ordbog_hent(tilstand: State<'_, Tilstand>) -> OrdbogUd {
    maskering::ordbog_hent(&tilstand)
}

/// Tilføjer en post til ordbogen (`type`: domaene | netbios | navnemoenster | eget_net | ord | person | aldrig).
#[tauri::command(async)]
fn ordbog_tilfoej(tilstand: State<'_, Tilstand>, r#type: String, vaerdi: String, note: Option<String>) -> Result<OrdbogUd, UiFejl> {
    maskering::ordbog_tilfoej(&tilstand, &r#type, &vaerdi, note.as_deref())
}

/// Retter en posts værdi og note.
#[tauri::command(async)]
fn ordbog_ret(tilstand: State<'_, Tilstand>, id: u64, vaerdi: String, note: Option<String>) -> Result<OrdbogUd, UiFejl> {
    maskering::ordbog_ret(&tilstand, id, &vaerdi, note.as_deref())
}

/// Fjerner en post (UI'et bekræfter med værdien først).
#[tauri::command(async)]
fn ordbog_fjern(tilstand: State<'_, Tilstand>, id: u64) -> Result<OrdbogUd, UiFejl> {
    maskering::ordbog_fjern(&tilstand, id)
}

/// Kører analysen med ordbogen på en tekst uden at røre sagen; teksten gemmes ikke.
#[tauri::command(async)]
fn ordbog_proev(tilstand: State<'_, Tilstand>, tekst: String) -> Result<Proeve, UiFejl> {
    maskering::ordbog_proev(&tilstand, &tekst)
}

/// Indstillingerne.
#[tauri::command]
fn indstillinger_hent(tilstand: State<'_, Tilstand>) -> Indstillinger {
    maskering::indstillinger_hent(&tilstand)
}

/// Gemmer indstillingerne.
#[tauri::command(async)]
fn indstillinger_gem(tilstand: State<'_, Tilstand>, indstillinger: Indstillinger) -> Result<Indstillinger, UiFejl> {
    maskering::indstillinger_gem(&tilstand, indstillinger)
}

/// Afslutter programmet, efter brugeren har svaret på spørgsmålet om den midlertidige sag (Gem som sag eller Kassér).
#[tauri::command]
fn program_afslut(app: tauri::AppHandle, tilstand: State<'_, Tilstand>) {
    tilstand.tillad_afslut();
    app.exit(0);
}

/// Afslut fra menuen (⌘Q) eller vinduets lukkeknap: med en midlertidig sag, der har poster, spørger webvisningen først
/// (hændelsen `menu` med "afslut"); ellers lukker programmet.
fn anmod_afslut(app: &tauri::AppHandle) -> bool {
    let spoerg = app.state::<Tilstand>().skal_spoerge_ved_luk();
    if spoerg {
        if let Some(v) = app.get_webview_window("main") {
            let _ = v.show();
            let _ = v.set_focus();
        }
        let _ = app.emit("menu", "afslut");
    }
    spoerg
}

/// Programmets mappe `<app-data>` (macOS: `~/Library/Application Support/com.wi24rd.grimnir`) med `sager/`,
/// `ordbog.grimnir` og `indstillinger.json`.
fn tilstand_for(app: &tauri::AppHandle) -> Tilstand {
    match app.path().app_data_dir() {
        Ok(d) => Tilstand::paa_disk(d, std::sync::Arc::new(sager::Noeglering)),
        Err(_) => Tilstand::ny(),
    }
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
        .invoke_handler(tauri::generate_handler![
            kerne_version,
            analyser,
            gem_og_masker,
            demasker,
            sag_status,
            sag_nulstil,
            menu_sprog,
            sag_ny,
            sag_liste,
            sag_aabn,
            sag_luk,
            sag_omdoeb,
            sag_udloeb,
            sag_slet,
            program_afslut,
            sag_valg,
            ordbog_hent,
            ordbog_tilfoej,
            ordbog_ret,
            ordbog_fjern,
            ordbog_proev,
            indstillinger_hent,
            indstillinger_gem
        ])
        .on_window_event(|vindue, ev| match ev {
            tauri::WindowEvent::CloseRequested { api, .. } => {
                if anmod_afslut(vindue.app_handle()) {
                    api.prevent_close();
                }
            }
            // Fuldskærm på macOS: trafiklysene er skjult, så titellinjen skal ikke holde plads til dem (G4).
            tauri::WindowEvent::Resized(_) => {
                if let Ok(fuld) = vindue.is_fullscreen() {
                    let _ = vindue.emit("fuldskaerm", fuld);
                }
            }
            _ => {}
        })
        .on_menu_event(|app, ev| {
            if let Some(handling) = programmenu::handling(ev.id().as_ref()) {
                if handling == "afslut" {
                    if !anmod_afslut(app) {
                        app.exit(0);
                    }
                    return;
                }
                if let Some(v) = app.get_webview_window("main") {
                    let _ = v.show();
                    let _ = v.set_focus();
                }
                let _ = app.emit("menu", handling);
            }
        })
        .setup(|app| {
            app.manage(tilstand_for(app.handle()));
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
