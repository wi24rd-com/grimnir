//! Skallen i Wi24rd Grimnir: ét vindue med Wi24rd UI Kit 2's programskal, programmenuen og kommandoerne:
//! `kerne_version` (fodlinjen), `analyser`, `gem_og_masker`, `demasker`, `sag_status` og `sag_nulstil` (V-SKAL.2),
//! `menu_sprog` (programmenuen følger UI'ets sprog) og sagerne på disk (V-SAG.1): `sag_ny`, `sag_liste`, `sag_aabn`,
//! `sag_luk`, `sag_omdoeb`, `sag_udloeb`, `sag_slet` og `program_afslut`; ordbogen og indstillingerne (V-ORDBOG.1):
//! `ordbog_hent`, `ordbog_tilfoej`, `ordbog_ret`, `ordbog_fjern`, `ordbog_proev`, `indstillinger_hent`,
//! `indstillinger_gem` og `sag_valg`; filerne (V-FIL.1): `fil_aabn`, `fil_aabn_sluppet`, `fil_luk`, `fil_analyser`,
//! `fil_raekker`, `fil_gem_og_masker`, `fil_demasker`, `fil_kopi`, `fil_gem` og `ordbog_start_forfra`; låsen (V-LAAS.2,
//! V-LAAS.3): `laas_status`, `laas_op` og `aktivitet`; udklipsholderen (V-LAAS.4): `udklip_kopieret`; kvitteringen
//! (V-KVIT.1): `kvittering`; noterne (V-OPBYG.2): `noter_hent`, `note_tilfoej`, `note_ret` og `note_slet`; en
//! hemmeligheds værdi ved Vis (V-OPBYG.4): `raekke_vaerdi`.
//!
//! **Låsen (V-LAAS.2).** Grimnir starter altid låst ([`Tilstand::ved_start`]; V-LAAS.3 N1, ADR D20). UI'et kalder
//! `laas_op` én gang ved start; døren ([`laas::platformens`]: Touch ID med adgangskoden som reserve på macOS) svarer i
//! en blok på en anden tråd, og kommandoen er `async`, så hovedtråden aldrig venter. Mens der er låst, svarer hver
//! kommando, der bruger sager, ordbog, filer eller nøgler, med fejlen `laast`, og Åbn fil viser ikke engang dialogen.
//! Døren beskytter mod en person ved en ulåst maskine, ikke mod et andet program, der kører som brugeren ([`laas`]).
//!
//! **Lås igen (V-LAAS.3).** [`laas_igen_og_meld`] er den ene vej: [`maskering::laas_igen`] nulstiller, og webvisningen
//! får hændelsen `laast` og genindlæser siden. Udløserne er macOS' notifikationer ([`notifikationer`]: dvale, skærmene
//! slukker, brugerskift) og stilstand (en tråd kalder [`maskering::tjek_stilstand`] hvert 10. sekund). Hver kommando
//! tæller som aktivitet (invoke-håndteringen nedenfor), og kommandoen `aktivitet` melder tastatur og mus i vinduet. De
//! lange kommandoer holder [`Tilstand::travl`], så en analyse, der varer længe, ikke låses midt i.
//!
//! **Ved lås mistes intet (V-LAAS.4).** En midlertidig sag med poster gemmes ved låsen under et dato-navn, og
//! udklipsholderen ryddes, hvis den stadig har den demaskerede tekst, Grimnir kopierede ([`udklip`]; kun macOS).
//!
//! **Afslut (V-LAAS.5).** Hver vej ud af programmet ender i Tauris `RunEvent::Exit`, og dér, ét sted
//! ([`ved_programslut`]), ryddes udklipsholderen på samme betingelse som ved lås ([`maskering::ved_afslut`]). Grimnirs
//! egne veje kalder [`afslut`]; se dokumentationen dér for listen. V-LAAS.6: har brugeren ikke svaret på spørgsmålet om
//! den midlertidige sag (Afslut fra Dock, log ud, genstart, sluk), gemmes den som ved lås, og navnet siges efter næste
//! oplåsning.
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
//! `<app-data>/indstillinger.json` ([`indstillinger`]; intet følsomt). Mens en fil gemmes i brugerens mappe, står den
//! midlertidige fils sti i `<app-data>/igang.json` ([`igang`]; kun stier, kun de igangværende).
// V-LAAS.2: `deny` i stedet for `forbid`, fordi macOS-døren (`laas::mac`) skal kalde LocalAuthentication, og alle de
// kald er `unsafe`. Kun dét modul har `allow(unsafe_code)`; resten af skallen er uændret uden `unsafe`.
#![deny(unsafe_code)]

pub mod fil;
pub mod igang;
pub mod indstillinger;
pub mod klokke;
pub mod kvittering;
pub mod laas;
pub mod maskering;
#[cfg(target_os = "macos")]
mod notifikationer;
pub mod ordbog;
pub mod sager;
pub mod stilstand;
pub mod udklip;
pub mod vejledning;

// Menuen bygges kun på macOS (se `run`); på Windows bruges kun `handling` og `platform_skript`.
#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
mod programmenu;

use indstillinger::Indstillinger;
use laas::Udloeser;
use maskering::{
    AnalyseMed, Demaskering, FilAnalyse, FilDemaskering, FilInfo, FilMaskering, IndholdValg, LaasStatus, LaasSvar, Maskering, NoterUd,
    OrdbogUd, Proeve, RaekkeSide, RaekkeVaerdi, Rettelse, SagIndhold, SagListePost, SagStatus, SideValg, StartForfra, Tilfoejet, Tilstand, UiFejl,
    Visning,
};
use std::path::PathBuf;
use std::sync::Arc;
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
/// standard), så tabellen viser de koder, `gem_og_masker` vil bruge. Ændrer ikke sagen. V-MANUEL.1: `tilfoejede` er
/// værdierne, brugeren selv har peget på i teksten ("Maskér dette"; udeladt: ingen).
#[tauri::command(async)]
fn analyser(
    tilstand: State<'_, Tilstand>,
    tekst: String,
    fravalgt: Option<Vec<usize>>,
    rettelser: Option<Vec<Rettelse>>,
    tilfoejede: Option<Vec<Tilfoejet>>,
) -> Result<AnalyseMed, UiFejl> {
    let _travl = tilstand.travl();
    maskering::analyser_med(
        &tilstand,
        &tekst,
        fravalgt.as_deref(),
        rettelser.as_deref().unwrap_or_default(),
        tilfoejede.as_deref().unwrap_or_default(),
    )
}

/// Maskerer teksten med brugerens valg og gemmer sagen (i hukommelsen). Afvises en rettelse, gemmes intet.
/// V-MANUEL.1: med de tilføjede værdier (udeladt: ingen); de gemmes i sagen som ethvert andet fund.
#[tauri::command(async)]
fn gem_og_masker(
    tilstand: State<'_, Tilstand>,
    tekst: String,
    fravalgt: Vec<usize>,
    rettelser: Vec<Rettelse>,
    tilfoejede: Option<Vec<Tilfoejet>>,
) -> Result<Maskering, UiFejl> {
    let _travl = tilstand.travl();
    maskering::gem_og_masker_med(&tilstand, &tekst, &fravalgt, &rettelser, tilfoejede.as_deref().unwrap_or_default())
}

/// Sætter de rigtige værdier tilbage i en tekst med sagens koder.
#[tauri::command(async)]
fn demasker(tilstand: State<'_, Tilstand>, tekst: String) -> Result<Demaskering, UiFejl> {
    let _travl = tilstand.travl();
    maskering::demasker(&tilstand, &tekst)
}

/// V-OPBYG.4 N1: én hemmeligheds værdi, når brugeren vælger Vis (`fil`: den åbne fil i Maskér, ellers seneste analyse
/// af den indsatte tekst). Låst: `laast`; porten tjekkes igen før svaret.
#[tauri::command(async)]
fn raekke_vaerdi(tilstand: State<'_, Tilstand>, fil: bool, id: usize) -> Result<RaekkeVaerdi, UiFejl> {
    maskering::raekke_vaerdi(&tilstand, fil, id)
}

/// V-MANUEL.2 N1: én side af en sags poster (kode, type og rigtig værdi). `id`: en sag på disk, der kun læses; udeladt:
/// den åbne sag. Hemmeligheder kun, når de er vist (`valg.vist`).
#[tauri::command(async)]
fn sag_indhold(tilstand: State<'_, Tilstand>, id: Option<String>, valg: IndholdValg) -> Result<SagIndhold, UiFejl> {
    maskering::sag_indhold(&tilstand, id.as_deref(), &valg)
}

/// Antal poster i sagen. V-FIL.1: `async` (ikke på hovedtråden), fordi sagens lås kan være optaget af en lang
/// maskering af en stor fil; vinduet må ikke fryse imens.
#[tauri::command(async)]
fn sag_status(tilstand: State<'_, Tilstand>) -> Result<SagStatus, UiFejl> {
    maskering::sag_status(&tilstand)
}

/// Programmenuen på UI'ets sprog (`da` | `en`). Kun macOS har en programmenu; andre steder gør kommandoen intet.
#[tauri::command]
fn menu_sprog(app: tauri::AppHandle, valgt: State<'_, Sprogvalg>, tilstand: State<'_, Tilstand>, sprog: String) -> Result<(), String> {
    // V-LAAS.4: navnet på en midlertidig sag, der gemmes ved lås, følger også UI'ets sprog.
    tilstand.saet_sprog(&sprog);
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
fn sag_nulstil(tilstand: State<'_, Tilstand>) -> Result<SagStatus, UiFejl> {
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
    let _travl = tilstand.travl();
    maskering::sag_liste(&tilstand)
}

/// Åbner en sag fra disk.
#[tauri::command(async)]
fn sag_aabn(tilstand: State<'_, Tilstand>, id: String) -> Result<SagStatus, UiFejl> {
    let _travl = tilstand.travl();
    maskering::sag_aabn(&tilstand, &id)
}

/// Lukker sagen (en ny, tom midlertidig sag starter). `async` som `sag_status`.
#[tauri::command(async)]
fn sag_luk(tilstand: State<'_, Tilstand>) -> Result<SagStatus, UiFejl> {
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
fn ordbog_hent(tilstand: State<'_, Tilstand>) -> Result<OrdbogUd, UiFejl> {
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
    let _travl = tilstand.travl();
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

/// V-LAAS.2: låsens tilstand (låst, om den er låst igen efter start og hvorfor, og om Grimnir er låst op uden
/// bekræftelse).
#[tauri::command]
fn laas_status(tilstand: State<'_, Tilstand>) -> LaasStatus {
    maskering::laas_status(&tilstand)
}

/// V-LAAS.2: platformens dør. Ligger som tilstand, så kommandoerne ikke selv vælger den.
struct Doeren(Arc<dyn laas::Doer>);

/// Låser op med døren (`sprog`: UI'ets sprog til dialogens tekst). `async`: døren venter på brugeren, og svaret kommer
/// i en blok; hovedtråden venter aldrig.
#[tauri::command(async)]
fn laas_op(tilstand: State<'_, Tilstand>, doer: State<'_, Doeren>, sprog: String) -> LaasSvar {
    maskering::laas_op(&tilstand, doer.0.as_ref(), &sprog)
}

/// V-LAAS.3: tastatur eller mus i Grimnirs vindue (webvisningen sender den højst hvert 20. sekund). Gør intet selv:
/// hver kommando tæller som aktivitet i invoke-håndteringen ([`run`]).
#[tauri::command]
fn aktivitet() {}

/// V-LAAS.4: webvisningen har kopieret det demaskerede resultat (Kopiér i Demaskér; `fil`: filens resultat). Rust husker
/// udklipsholderens tæller, hvis indholdet er Grimnirs, så låsen kan rydde den ([`maskering::udklip_kopieret`]). Kaldes
/// ikke efter Kopiér i Maskér. Tæller som aktivitet (som hver kommando).
#[tauri::command(async)]
fn udklip_kopieret(tilstand: State<'_, Tilstand>, fil: bool, noter: Option<bool>) -> Result<bool, UiFejl> {
    // V-OPBYG.2 N2: `noter`: webvisningen har kopieret den åbne sags noter (Kopiér noterne); samme regel (D21).
    if noter == Some(true) {
        return maskering::udklip_noter_kopieret(&tilstand);
    }
    maskering::udklip_kopieret(&tilstand, fil)
}

/// V-OPBYG.2 N1: den åbne sags noter (også den midlertidige). Låst: `laast`.
#[tauri::command(async)]
fn noter_hent(tilstand: State<'_, Tilstand>) -> Result<NoterUd, UiFejl> {
    maskering::noter_hent(&tilstand)
}

/// V-OPBYG.2 N1: en ny note i den åbne sag; en navngiven sag gemmes straks. Teksten gennemsøges ikke (D27).
#[tauri::command(async)]
fn note_tilfoej(tilstand: State<'_, Tilstand>, tekst: String) -> Result<NoterUd, UiFejl> {
    let r = maskering::note_tilfoej(&tilstand, &tekst);
    let mut tekst = tekst;
    zeroize::Zeroize::zeroize(&mut tekst);
    r
}

/// V-OPBYG.2 N1: retter en note i den åbne sag; en navngiven sag gemmes straks.
#[tauri::command(async)]
fn note_ret(tilstand: State<'_, Tilstand>, nr: u64, tekst: String) -> Result<NoterUd, UiFejl> {
    let r = maskering::note_ret(&tilstand, nr, &tekst);
    let mut tekst = tekst;
    zeroize::Zeroize::zeroize(&mut tekst);
    r
}

/// V-OPBYG.2 N1: sletter en note i den åbne sag; en navngiven sag gemmes straks.
#[tauri::command(async)]
fn note_slet(tilstand: State<'_, Tilstand>, nr: u64) -> Result<NoterUd, UiFejl> {
    maskering::note_slet(&tilstand, nr)
}

/// V-KVIT.1: kvitteringen for seneste maskering i Maskér som ren tekst (`fil`: den åbne fils resultat; `sprog`: UI'ets
/// sprog). Kun tal, typenavne og sagens navn; ingen original, kode, sti eller filnavn ([`maskering::kvittering`]).
/// Webvisningen kopierer teksten og melder den ikke til `udklip_kopieret`.
#[tauri::command(async)]
fn kvittering(tilstand: State<'_, Tilstand>, fil: bool, sprog: String) -> Result<String, UiFejl> {
    maskering::kvittering(&tilstand, fil, &sprog)
}

/// V-OPBYG.1 N7: Vejledning i titellinjen ([`vejledning::aabn`]): beder styresystemet åbne en af to faste adresser i
/// browseren. Webvisningen giver kun sproget. Virker også, mens Grimnir er låst (rører hverken sager eller ordbog).
#[tauri::command]
fn vejledning_aabn(sprog: String) -> Result<(), String> {
    vejledning::aabn(&sprog)
}

/// V-OPBYG.3 N3: `THIRD_PARTY_LICENSES.md` fra repoets rod, pakket med programmet ved bygningen (`include_str!`).
const TREDJEPARTSLICENSER: &str = include_str!("../../THIRD_PARTY_LICENSES.md");

/// V-OPBYG.3 N3: tredjepartslicenserne til Om Grimnir ("Vis tredjepartslicenser"). Teksten er pakket med programmet; intet
/// læses fra disken, og intet hentes. Virker også, mens Grimnir er låst (rører hverken sager, ordbog, filer eller nøgler;
/// Om-dialogen kan åbnes låst).
#[tauri::command]
fn tredjepartslicenser() -> &'static str {
    TREDJEPARTSLICENSER
}

/// V-OPBYG.1 N7: Lås i titellinjen låser nu ad samme vej som lås ved stilstand og notifikationerne ([`laas_igen_og_meld`]:
/// D21's regler for den midlertidige sag, udklipsholderen ryddes, filerne og ordbogen glemmes, og webvisningen får `laast`).
/// Er Grimnir allerede låst, sker intet.
#[tauri::command]
fn laas_nu(app: tauri::AppHandle) {
    laas_igen_og_meld(&app, Udloeser::Bruger);
}

/// V-LAAS.3: låser igen ([`maskering::laas_igen`]) og fortæller webvisningen det (hændelsen `laast`; webvisningen
/// genindlæser siden og står låst). Den ene vej for notifikationerne og (V-OPBYG.1) knappen Lås.
fn laas_igen_og_meld(app: &tauri::AppHandle, grund: Udloeser) {
    if maskering::laas_igen(&app.state::<Tilstand>(), grund) {
        meld_laast(app, grund);
    }
}

/// Efter [`maskering::laas_igen`]: den sti, et træk og slip efterlod, glemmes, og webvisningen får hændelsen `laast`.
fn meld_laast(app: &tauri::AppHandle, grund: Udloeser) {
    *app.state::<Sluppet>().0.lock().unwrap_or_else(|e| e.into_inner()) = None;
    let _ = app.emit("laast", grund);
}

/// V-LAAS.3: stilstand. Tjekker hvert 10. sekund, om "Lås efter stilstand" er nået; [`maskering::tjek_stilstand`]
/// kalder [`maskering::laas_igen`].
fn start_stilstandsvagt(app: &tauri::AppHandle) {
    let app = app.clone();
    std::thread::spawn(move || loop {
        std::thread::sleep(std::time::Duration::from_secs(10));
        if maskering::tjek_stilstand(&app.state::<Tilstand>()) {
            meld_laast(&app, Udloeser::Stilstand);
        }
    });
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
    // V-LAAS.2: låst åbnes dialogen slet ikke.
    tilstand.aaben()?;
    let valgt = rfd::AsyncFileDialog::new()
        .set_parent(&vindue)
        .set_title(titel(&sprog, |t| t.dlg_aabn))
        .pick_file()
        .await;
    match valgt {
        Some(h) => {
            let _travl = tilstand.travl();
            maskering::fil_aabn(&tilstand, visning, h.path()).map(Some)
        }
        None => Ok(None),
    }
}

/// Åbner filen fra seneste træk og slip i visningen.
#[tauri::command(async)]
fn fil_aabn_sluppet(tilstand: State<'_, Tilstand>, sluppet: State<'_, Sluppet>, visning: Visning) -> Result<Option<FilInfo>, UiFejl> {
    let sti = sluppet.0.lock().unwrap_or_else(|e| e.into_inner()).take();
    let _travl = tilstand.travl();
    match sti {
        Some(p) => maskering::fil_aabn(&tilstand, visning, &p).map(Some),
        None => Ok(None),
    }
}

/// Slipper visningens fil (indsat tekst tager over).
#[tauri::command(async)]
fn fil_luk(tilstand: State<'_, Tilstand>, visning: Visning) -> Result<(), UiFejl> {
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
    let _travl = tilstand.travl();
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
    let _travl = tilstand.travl();
    maskering::fil_raekker(&tilstand, &side)
}

/// `gem_og_masker` for den åbne fil i Maskér; den maskerede tekst bliver i Rust.
#[tauri::command(async)]
fn fil_gem_og_masker(tilstand: State<'_, Tilstand>, fravalgt: Vec<usize>, rettelser: Vec<Rettelse>) -> Result<FilMaskering, UiFejl> {
    let _travl = tilstand.travl();
    maskering::fil_gem_og_masker(&tilstand, &fravalgt, &rettelser)
}

/// `demasker` for den åbne fil i Demaskér; teksten med de rigtige værdier bliver i Rust.
#[tauri::command(async)]
fn fil_demasker(tilstand: State<'_, Tilstand>) -> Result<FilDemaskering, UiFejl> {
    let _travl = tilstand.travl();
    maskering::fil_demasker(&tilstand)
}

/// Hele resultatet til Kopiér (højst 5 MiB).
#[tauri::command(async)]
fn fil_kopi(tilstand: State<'_, Tilstand>, visning: Visning) -> Result<String, UiFejl> {
    let _travl = tilstand.travl();
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
        Some(h) => {
            let _travl = tilstand.travl();
            maskering::fil_gem_til(&tilstand, visning, h.path(), ok).map(Some)
        }
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
    afslut(&app);
}

/// V-LAAS.5 N1: Grimnirs egen vej ud (`program_afslut` og menuens Afslut ⌘Q, når der ikke skal spørges). Det eneste sted,
/// Grimnir selv kalder `app.exit`. Rydningen sker ikke her, men i [`ved_programslut`], som alle veje ender i:
///
/// - `program_afslut` (efter spørgsmålet om den midlertidige sag) og menuens Afslut / ⌘Q: her → `app.exit(0)` →
///   `RunEvent::ExitRequested` → `RunEvent::Exit`;
/// - lukkeknappen og Vindue → Luk vindue (⌘W) på det sidste vindue: `CloseRequested` (spørger evt. først) → vinduet
///   lukkes → Tauri: ingen vinduer tilbage → `ExitRequested` → `Exit`;
/// - Afslut fra Dock, log ud, genstart og sluk: macOS sender `terminate:` → tao's `applicationWillTerminate` →
///   `Exit` (tao 0.37.2 `app_delegate.rs:130` → `AppState::exit`; tauri-runtime-wry 2.12.3 `LoopDestroyed` →
///   `RunEvent::Exit`). Disse veje spørger ikke om den midlertidige sag; V-LAAS.6: den gemmes i stedet som ved lås
///   ([`maskering::ved_afslut`]).
///
/// Uden for Grimnirs rækkevidde: tvungen afslutning (Tving til at slutte, `kill -9`), et nedbrud, strømsvigt, og en
/// nedlukning, der dræber programmet, før det når at afslutte.
fn afslut(app: &tauri::AppHandle) {
    app.exit(0);
}

/// V-LAAS.5 N1: programmet afslutter (Tauris `RunEvent::Exit`, som hver vej ud ender i; se [`afslut`]). Udklipsholderen
/// ryddes på samme betingelse som ved lås, og (V-LAAS.6 N1) en midlertidig sag, brugeren ikke har svaret på, gemmes
/// ([`maskering::ved_afslut`]). Giver ingen dialog; venter ikke på en lås i gang og højst
/// [`maskering::AFSLUT_VENT`] på en kommando, der holder sagen.
fn ved_programslut(app: &tauri::AppHandle) {
    if let Some(t) = app.try_state::<Tilstand>() {
        maskering::ved_afslut(&t);
    }
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
/// `ordbog.grimnir` og `indstillinger.json`. Altid låst ved start (V-LAAS.3 N1).
fn tilstand_for(app: &tauri::AppHandle) -> Tilstand {
    match app.path().app_data_dir() {
        Ok(d) => Tilstand::paa_disk(d, std::sync::Arc::new(sager::Noeglering)),
        Err(_) => Tilstand::ny(),
    }
    .med_udklip(udklip::platformens())
    .ved_start()
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

/// Giver `generate_handler!` sin type, så den kan kaldes inde i Grimnirs egen invoke-håndtering (V-LAAS.3).
fn kommandoliste<F: Fn(tauri::ipc::Invoke<tauri::Wry>) -> bool>(f: F) -> F {
    f
}

/// Starter programmet.
pub fn run() {
    let kommandoer = kommandoliste(tauri::generate_handler![
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
        ordbog_start_forfra,
        laas_status,
        laas_op,
        aktivitet,
        kvittering,
        sag_indhold,
        vejledning_aabn,
        tredjepartslicenser,
        laas_nu,
        noter_hent,
        note_tilfoej,
        note_ret,
        note_slet,
        udklip_kopieret,
        raekke_vaerdi
    ]);
    tauri::Builder::default()
        // V-LAAS.3: hver kommando fra webvisningen er aktivitet (stilstand). Før kommandoen kører.
        .invoke_handler(move |invoke| {
            if let Some(t) = invoke.message.webview_ref().try_state::<Tilstand>() {
                t.aktivitet();
            }
            kommandoer(invoke)
        })
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
                        afslut(app);
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
            app.manage(Doeren(laas::platformens()));
            app.manage(Sprogvalg(Mutex::new(&programmenu::DA)));
            app.manage(Sluppet::default());
            // V-LAAS.3: udløserne. Notifikationerne kun på macOS; stilstand på alle platforme.
            #[cfg(target_os = "macos")]
            {
                let h = app.handle().clone();
                notifikationer::registrer(move |grund| {
                    // Notifikationen kommer på hovedtråden; låsen kan vente på en kommando, der kører (en analyse), så
                    // den gøres i en anden tråd, og vinduet fryser ikke.
                    let h = h.clone();
                    std::thread::spawn(move || laas_igen_og_meld(&h, grund));
                });
            }
            start_stilstandsvagt(app.handle());
            // Kun macOS: på Windows ville menuen blive en menubjælke i vinduet; dér fanger rammen Ctrl+, selv.
            #[cfg(target_os = "macos")]
            app.set_menu(programmenu::byg(app.handle(), &programmenu::DA)?)?;
            aabn_vindue(app.handle())?;
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("Grimnir kunne ikke starte")
        // V-LAAS.5 N1: hver vej ud af programmet ender her.
        .run(|app, ev| {
            if let tauri::RunEvent::Exit = ev {
                ved_programslut(app);
            }
        });
}

#[cfg(test)]
mod tests {
    use super::*;

    /// V-OPBYG.3 N3: Om Grimnirs tredjepartslicenser er filen i repoets rod, byte for byte, pakket med programmet.
    #[test]
    fn tredjepartslicenserne_er_filen_i_roden() {
        let fil = std::fs::read_to_string(concat!(env!("CARGO_MANIFEST_DIR"), "/../THIRD_PARTY_LICENSES.md")).unwrap();
        assert_eq!(tredjepartslicenser(), fil);
        assert!(tredjepartslicenser().starts_with("# Tredjepartslicenser — Wi24rd Grimnir"));
    }

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
