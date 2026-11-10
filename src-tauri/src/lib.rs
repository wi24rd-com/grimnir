//! Skallen i Wi24rd Grimnir: ét vindue med Wi24rd UI Kit 2's programskal, programmenuen og kommandoerne:
//! `kerne_version` (fodlinjen), `analyser`, `gem_og_masker`, `demasker`, `sag_status` og `sag_nulstil` (V-SKAL.2),
//! `menu_sprog` (programmenuen følger UI'ets sprog) og sagerne på disk (V-SAG.1): `sag_ny`, `sag_liste`, `sag_aabn`,
//! `sag_luk`, `sag_omdoeb`, `sag_udloeb`, `sag_slet` og `program_afslut`; ordbogen og indstillingerne (V-ORDBOG.1):
//! `ordbog_hent`, `ordbog_tilfoej`, `ordbog_ret`, `ordbog_fjern`, `ordbog_proev`, `indstillinger_hent`,
//! `indstillinger_gem` og `sag_valg`; filerne (V-FIL.1): `fil_aabn`, `fil_aabn_sluppet`, `fil_luk`, `fil_analyser`,
//! `fil_raekker`, `fil_gem_og_masker`, `fil_demasker`, `fil_kopi`, `fil_gem` og `ordbog_start_forfra`.
//!
//! **Filer (V-FIL.1).** Åbn- og Gem-dialogerne er styresystemets egne, åbnet herfra med `rfd` (ikke
//! `tauri-plugin-dialog`/`-fs`); webvisningen får ingen fil-rettigheder og ser aldrig en sti, kun filnavnet. Træk og
//! slip: Tauri giver stien til Rust i vinduets hændelse `DragDrop`; Rust husker den og sender kun filnavnet videre
//! (hændelsen `fil-sluppet`). Tauris egen hændelse `tauri://drag-drop` med stierne sendes kun til en webvisning, der
//! lytter efter den (`Listeners::emit_js_filter` i tauri 2.12.5), og det gør Grimnirs webvisning ikke (UI-testen tjekker
//! det).
//!
//! Ingen plugins og ingen netværkskode. Sagerne ligger krypteret i `<app-data>/sager/` ([`sager`]), ordbogen krypteret
//! i `<app-data>/ordbog.grimnir` ([`ordbog`]); nøglerne i Keychain/Credential Manager. Indstillingerne står i klartekst i
//! `<app-data>/indstillinger.json` ([`indstillinger`]; intet følsomt).
#![forbid(unsafe_code)]

pub mod fil;
pub mod indstillinger;
pub mod maskering;
pub mod ordbog;
pub mod sager;

// Menuen bygges kun på macOS (se `run`); på Windows bruges kun `handling` og `platform_skript`.
#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
mod programmenu;

use indstillinger::Indstillinger;
use maskering::{
    Analyse, Demaskering, FilAnalyse, FilDemaskering, FilInfo, FilMaskering, Maskering, OrdbogUd, Proeve, RaekkeSide, Rettelse,
    SagListePost, SagStatus, SideValg, StartForfra, Tilstand, UiFejl, Visning,
};
use std::path::PathBuf;
use std::sync::Mutex;
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

/// Antal poster i sagen. V-FIL.1: `async` (ikke på hovedtråden), fordi sagens lås kan være optaget af en lang
/// maskering af en stor fil; vinduet må ikke fryse imens.
#[tauri::command(async)]
fn sag_status(tilstand: State<'_, Tilstand>) -> SagStatus {
    maskering::sag_status(&tilstand)
}

/// Programmenuen på UI'ets sprog (`da` | `en`). Kun macOS har en programmenu; andre steder gør kommandoen intet.
#[tauri::command]
fn menu_sprog(app: tauri::AppHandle, valgt: State<'_, Sprogvalg>, sprog: String) -> Result<(), String> {
    // Filvalgsdialogernes titler følger også UI'ets sprog (V-FIL.1), på alle platforme.
    *valgt.0.lock().unwrap_or_else(|e| e.into_inner()) = programmenu::tekster(&sprog);
    #[cfg(target_os = "macos")]
    {
        let menu = programmenu::byg(&app, programmenu::tekster(&sprog)).map_err(|e| e.to_string())?;
        app.set_menu(menu).map_err(|e| e.to_string())?;
    }
    #[cfg(not(target_os = "macos"))]
    let _ = (app, sprog);
    Ok(())
}

/// Tømmer sagen (UI'et beder om bekræftelse først). `async` som `sag_status`.
#[tauri::command(async)]
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

/// Lukker sagen (en ny, tom midlertidig sag starter). `async` som `sag_status`.
#[tauri::command(async)]
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

/// UI'ets sprog i Rust: titlerne på filvalgsdialogerne.
struct Sprogvalg(Mutex<&'static programmenu::Tekster>);

/// Stien fra seneste træk og slip. Bliver i Rust; webvisningen får kun filnavnet (hændelsen `fil-sluppet`).
#[derive(Default)]
struct Sluppet(Mutex<Option<PathBuf>>);

fn titel(s: &Sprogvalg, f: impl Fn(&programmenu::Tekster) -> &'static str) -> &'static str {
    f(*s.0.lock().unwrap_or_else(|e| e.into_inner()))
}

/// Åbn fil: styresystemets dialog (et ark på vinduet på macOS). `None`: brugeren fortrød.
#[tauri::command]
async fn fil_aabn(
    vindue: tauri::WebviewWindow,
    tilstand: State<'_, Tilstand>,
    sprog: State<'_, Sprogvalg>,
    visning: Visning,
) -> Result<Option<FilInfo>, UiFejl> {
    let valgt = rfd::AsyncFileDialog::new()
        .set_parent(&vindue)
        .set_title(titel(&sprog, |t| t.dlg_aabn))
        .pick_file()
        .await;
    match valgt {
        Some(h) => maskering::fil_aabn(&tilstand, visning, h.path()).map(Some),
        None => Ok(None),
    }
}

/// Åbner filen fra seneste træk og slip i visningen.
#[tauri::command(async)]
fn fil_aabn_sluppet(tilstand: State<'_, Tilstand>, sluppet: State<'_, Sluppet>, visning: Visning) -> Result<Option<FilInfo>, UiFejl> {
    let sti = sluppet.0.lock().unwrap_or_else(|e| e.into_inner()).take();
    match sti {
        Some(p) => maskering::fil_aabn(&tilstand, visning, &p).map(Some),
        None => Ok(None),
    }
}

/// Slipper visningens fil (indsat tekst tager over).
#[tauri::command(async)]
fn fil_luk(tilstand: State<'_, Tilstand>, visning: Visning) {
    maskering::fil_luk(&tilstand, visning)
}

/// `analyser` for den åbne fil i Maskér med første side rækker.
#[tauri::command(async)]
fn fil_analyser(
    tilstand: State<'_, Tilstand>,
    fravalgt: Option<Vec<usize>>,
    rort: Option<Vec<(usize, bool)>>,
    rettelser: Option<Vec<Rettelse>>,
    side: SideValg,
) -> Result<FilAnalyse, UiFejl> {
    maskering::fil_analyser(
        &tilstand,
        fravalgt.as_deref(),
        rort.as_deref(),
        rettelser.as_deref().unwrap_or_default(),
        &side,
    )
}

/// En side rækker fra seneste analyse af filen (filter, søgning, Vis flere).
#[tauri::command(async)]
fn fil_raekker(tilstand: State<'_, Tilstand>, side: SideValg) -> Result<RaekkeSide, UiFejl> {
    maskering::fil_raekker(&tilstand, &side)
}

/// `gem_og_masker` for den åbne fil i Maskér; den maskerede tekst bliver i Rust.
#[tauri::command(async)]
fn fil_gem_og_masker(tilstand: State<'_, Tilstand>, fravalgt: Vec<usize>, rettelser: Vec<Rettelse>) -> Result<FilMaskering, UiFejl> {
    maskering::fil_gem_og_masker(&tilstand, &fravalgt, &rettelser)
}

/// `demasker` for den åbne fil i Demaskér; teksten med de rigtige værdier bliver i Rust.
#[tauri::command(async)]
fn fil_demasker(tilstand: State<'_, Tilstand>) -> Result<FilDemaskering, UiFejl> {
    maskering::fil_demasker(&tilstand)
}

/// Hele resultatet til Kopiér (højst 5 MiB).
#[tauri::command(async)]
fn fil_kopi(tilstand: State<'_, Tilstand>, visning: Visning) -> Result<String, UiFejl> {
    maskering::fil_kopi(&tilstand, visning)
}

/// Gem maskeret fil (Maskér; `ok` = "Gem alligevel" ved rester) eller Gem som fil (Demaskér; `ok` = brugeren har
/// bekræftet, at filen får de rigtige værdier). Tjekket kommer før dialogen; dialogen foreslår navnet i den åbne fils
/// mappe og spørger selv, før en eksisterende fil overskrives. `None`: brugeren fortrød. Svarer med filnavnet.
#[tauri::command]
async fn fil_gem(
    vindue: tauri::WebviewWindow,
    tilstand: State<'_, Tilstand>,
    sprog: State<'_, Sprogvalg>,
    visning: Visning,
    ok: bool,
) -> Result<Option<String>, UiFejl> {
    let forslag = maskering::fil_gem_forslag(&tilstand, visning, ok)?;
    let mut d = rfd::AsyncFileDialog::new()
        .set_parent(&vindue)
        .set_title(titel(&sprog, |t| match visning {
            Visning::Masker => t.dlg_gem_maskeret,
            Visning::Demasker => t.dlg_gem_demaskeret,
        }))
        .set_file_name(&forslag.navn);
    if let Some(m) = &forslag.mappe {
        d = d.set_directory(m);
    }
    match d.save_file().await {
        Some(h) => maskering::fil_gem_til(&tilstand, visning, h.path(), ok).map(Some),
        None => Ok(None),
    }
}

/// "Start forfra" med en ordbog, der ikke kan åbnes (`dato`: i dag, `ÅÅÅÅ-MM-DD`).
#[tauri::command(async)]
fn ordbog_start_forfra(tilstand: State<'_, Tilstand>, dato: String) -> Result<StartForfra, UiFejl> {
    maskering::ordbog_start_forfra(&tilstand, &dato)
}

/// Svaret på et træk og slip til webvisningen: filnavnet eller hvorfor det blev afvist. Aldrig stien.
#[derive(Clone, serde::Serialize)]
struct SluppetUd {
    navn: Option<String>,
    fejl: Option<&'static str>,
}

/// Et træk og slip på vinduet: én fil huskes (stien bliver i Rust); flere filer eller en mappe afvises (D9: mapper og
/// zip er v2). Ren funktion over stierne, så den kan testes.
fn sluppet(stier: &[PathBuf]) -> Result<PathBuf, &'static str> {
    match stier {
        [] => Err("ingen"),
        [p] if p.is_dir() => Err("mappe"),
        [p] => Ok(p.clone()),
        _ => Err("flere"),
    }
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
            indstillinger_gem,
            fil_aabn,
            fil_aabn_sluppet,
            fil_luk,
            fil_analyser,
            fil_raekker,
            fil_gem_og_masker,
            fil_demasker,
            fil_kopi,
            fil_gem,
            ordbog_start_forfra
        ])
        .on_window_event(|vindue, ev| match ev {
            tauri::WindowEvent::CloseRequested { api, .. } => {
                if anmod_afslut(vindue.app_handle()) {
                    api.prevent_close();
                }
            }
            // V-FIL.1: træk og slip. Kun filnavnet (eller afvisningen) går til webvisningen; stien bliver her.
            tauri::WindowEvent::DragDrop(tauri::DragDropEvent::Enter { .. }) => {
                let _ = vindue.emit("fil-traek", true);
            }
            tauri::WindowEvent::DragDrop(tauri::DragDropEvent::Leave) => {
                let _ = vindue.emit("fil-traek", false);
            }
            tauri::WindowEvent::DragDrop(tauri::DragDropEvent::Drop { paths, .. }) => {
                let _ = vindue.emit("fil-traek", false);
                let ud = match sluppet(paths) {
                    Ok(p) => {
                        let navn = p.file_name().map(|n| n.to_string_lossy().into_owned());
                        *vindue.state::<Sluppet>().0.lock().unwrap_or_else(|e| e.into_inner()) = Some(p);
                        SluppetUd { navn, fejl: None }
                    }
                    Err(f) => SluppetUd { navn: None, fejl: Some(f) },
                };
                let _ = vindue.emit("fil-sluppet", ud);
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
            app.manage(Sprogvalg(Mutex::new(&programmenu::DA)));
            app.manage(Sluppet::default());
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

    #[test]
    fn traek_og_slip_tager_kun_en_fil() {
        let mappe = std::env::temp_dir();
        let fil = mappe.join("grimnir-findes-ikke.log");
        assert_eq!(sluppet(std::slice::from_ref(&fil)), Ok(fil.clone()));
        assert_eq!(sluppet(&[fil.clone(), fil.clone()]), Err("flere"));
        assert_eq!(sluppet(&[mappe]), Err("mappe"));
        assert_eq!(sluppet(&[]), Err("ingen"));
    }
}
