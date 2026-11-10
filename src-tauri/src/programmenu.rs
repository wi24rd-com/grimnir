//! Programmenuen: Grimnir (Om Grimnir · Indstillinger… ⌘, · Tjenester · Skjul · Afslut ⌘Q), Arkiv (Åbn… ⌘O · Gem… ⌘S,
//! V-FIL.1), Rediger (uden den virker ⌘C/⌘V ikke i tekstfelter på macOS) og Vindue. Et klik på Om eller Indstillinger udsender hændelsen `menu` med
//! "om" eller "indstillinger" til webvisningen, som åbner dialogen. Menuen følger UI'ets sprog: webvisningen kalder
//! kommandoen `menu_sprog` ved start og ved hvert sprogskift, og menuen bygges igen med [`DA`] eller [`EN`].
//! Visningsskiftet (⌘1–⌘4) ligger ikke i menuen: rammen fanger genvejene med `keydown`, så de virker ens på macOS og Windows.

/// Menupunkternes id'er.
pub const OM: &str = "pm-om";
/// Indstillinger… (⌘,).
pub const INDSTILLINGER: &str = "pm-indstillinger";

/// Afslut (⌘Q). Et eget menupunkt, ikke systemets `terminate:`: lukkes programmet med en midlertidig sag med poster,
/// spørger webvisningen først (V-SAG.1, G4). Systemets punkt afslutter uden at spørge.
pub const AFSLUT: &str = "pm-afslut";

/// Arkiv → Åbn… (⌘O): hændelsen `menu` med "aabn"; visningen (Maskér eller Demaskér) åbner filvalgsdialogen.
pub const AABN: &str = "pm-aabn";
/// Arkiv → Gem… (⌘S): hændelsen `menu` med "gem"; Maskér gemmer den maskerede fil, Demaskér spørger først.
pub const GEM: &str = "pm-gem";
/// Genvejen til Åbn….
pub const GENVEJ_AABN: &str = "CmdOrCtrl+O";
/// Genvejen til Gem….
pub const GENVEJ_GEM: &str = "CmdOrCtrl+S";

/// Genvejen til Indstillinger (Tauris accelerator-syntaks).
pub const GENVEJ_INDSTILLINGER: &str = "CmdOrCtrl+,";
/// Genvejen til Afslut.
pub const GENVEJ_AFSLUT: &str = "CmdOrCtrl+Q";

/// Menupunktets id → navnet, webvisningen får i hændelsen `menu`; `None` for alt andet. Ren funktion.
pub fn handling(id: &str) -> Option<&'static str> {
    match id {
        OM => Some("om"),
        INDSTILLINGER => Some("indstillinger"),
        AFSLUT => Some("afslut"),
        AABN => Some("aabn"),
        GEM => Some("gem"),
        _ => None,
    }
}

/// Alle synlige tekster i programmenuen.
#[derive(Debug)]
pub struct Tekster {
    pub app: &'static str,
    pub om: &'static str,
    pub indstillinger: &'static str,
    pub tjenester: &'static str,
    pub skjul: &'static str,
    pub skjul_andre: &'static str,
    pub vis_alle: &'static str,
    pub afslut: &'static str,
    pub arkiv: &'static str,
    pub aabn: &'static str,
    pub gem: &'static str,
    /// Titlerne på filvalgsdialogerne (V-FIL.1; dialogerne åbnes fra Rust).
    pub dlg_aabn: &'static str,
    pub dlg_gem_maskeret: &'static str,
    pub dlg_gem_demaskeret: &'static str,
    pub rediger: &'static str,
    pub fortryd: &'static str,
    pub gentag: &'static str,
    pub klip: &'static str,
    pub kopier: &'static str,
    pub saet_ind: &'static str,
    pub vaelg_alt: &'static str,
    pub vindue: &'static str,
    pub minimer: &'static str,
    pub zoom: &'static str,
    pub luk: &'static str,
}

/// Teksterne på dansk.
pub const DA: Tekster = Tekster {
    app: "Grimnir",
    om: "Om Grimnir",
    indstillinger: "Indstillinger…",
    tjenester: "Tjenester",
    skjul: "Skjul Grimnir",
    skjul_andre: "Skjul andre",
    vis_alle: "Vis alle",
    afslut: "Afslut Grimnir",
    arkiv: "Arkiv",
    aabn: "Åbn…",
    gem: "Gem…",
    dlg_aabn: "Åbn fil",
    dlg_gem_maskeret: "Gem maskeret fil",
    dlg_gem_demaskeret: "Gem som fil (rigtige værdier)",
    rediger: "Rediger",
    fortryd: "Fortryd",
    gentag: "Gentag",
    klip: "Klip",
    kopier: "Kopiér",
    saet_ind: "Sæt ind",
    vaelg_alt: "Vælg alt",
    vindue: "Vindue",
    minimer: "Minimér",
    zoom: "Zoom",
    luk: "Luk vindue",
};

/// Teksterne på engelsk.
pub const EN: Tekster = Tekster {
    app: "Grimnir",
    om: "About Grimnir",
    indstillinger: "Settings…",
    tjenester: "Services",
    skjul: "Hide Grimnir",
    skjul_andre: "Hide Others",
    vis_alle: "Show All",
    afslut: "Quit Grimnir",
    arkiv: "File",
    aabn: "Open…",
    gem: "Save…",
    dlg_aabn: "Open file",
    dlg_gem_maskeret: "Save masked file",
    dlg_gem_demaskeret: "Save as file (real values)",
    rediger: "Edit",
    fortryd: "Undo",
    gentag: "Redo",
    klip: "Cut",
    kopier: "Copy",
    saet_ind: "Paste",
    vaelg_alt: "Select All",
    vindue: "Window",
    minimer: "Minimise",
    zoom: "Zoom",
    luk: "Close Window",
};

/// Teksterne for et sprog fra UI'et (`da` | `en`); alt andet giver dansk.
pub fn tekster(sprog: &str) -> &'static Tekster {
    match sprog {
        "en" => &EN,
        _ => &DA,
    }
}

/// Bygger programmenuen på det givne sprog.
pub fn byg(app: &tauri::AppHandle, t: &Tekster) -> tauri::Result<tauri::menu::Menu<tauri::Wry>> {
    use tauri::menu::{Menu, MenuItem, PredefinedMenuItem as P, Submenu};
    let program = Submenu::with_items(
        app,
        t.app,
        true,
        &[
            &MenuItem::with_id(app, OM, t.om, true, None::<&str>)?,
            &P::separator(app)?,
            &MenuItem::with_id(app, INDSTILLINGER, t.indstillinger, true, Some(GENVEJ_INDSTILLINGER))?,
            &P::separator(app)?,
            &P::services(app, Some(t.tjenester))?,
            &P::separator(app)?,
            &P::hide(app, Some(t.skjul))?,
            &P::hide_others(app, Some(t.skjul_andre))?,
            &P::show_all(app, Some(t.vis_alle))?,
            &P::separator(app)?,
            &MenuItem::with_id(app, AFSLUT, t.afslut, true, Some(GENVEJ_AFSLUT))?,
        ],
    )?;
    let arkiv = Submenu::with_items(
        app,
        t.arkiv,
        true,
        &[
            &MenuItem::with_id(app, AABN, t.aabn, true, Some(GENVEJ_AABN))?,
            &MenuItem::with_id(app, GEM, t.gem, true, Some(GENVEJ_GEM))?,
        ],
    )?;
    let rediger = Submenu::with_items(
        app,
        t.rediger,
        true,
        &[
            &P::undo(app, Some(t.fortryd))?,
            &P::redo(app, Some(t.gentag))?,
            &P::separator(app)?,
            &P::cut(app, Some(t.klip))?,
            &P::copy(app, Some(t.kopier))?,
            &P::paste(app, Some(t.saet_ind))?,
            &P::select_all(app, Some(t.vaelg_alt))?,
        ],
    )?;
    let vindue = Submenu::with_items(
        app,
        t.vindue,
        true,
        &[
            &P::minimize(app, Some(t.minimer))?,
            &P::maximize(app, Some(t.zoom))?,
            &P::separator(app)?,
            &P::close_window(app, Some(t.luk))?,
        ],
    )?;
    Menu::with_items(app, &[&program, &arkiv, &rediger, &vindue])
}

/// Webvisningen får platformen som `<html data-platform>` (og `window.__GRIMNIR_PLATFORM__`), så rammen kan give plads
/// til trafiklysene og vise ⌘ eller Ctrl ved genvejene. Sat af Rust, ikke gættet ud fra userAgent. Init-scriptet kører,
/// før siden har et `<html>`-element; derfor også ved `readystatechange`.
pub fn platform_skript(os: &str) -> String {
    let os = match os {
        "macos" | "windows" | "linux" => os,
        _ => "andet",
    };
    format!(
        "(function(){{var p='{os}';Object.defineProperty(window,'__GRIMNIR_PLATFORM__',{{value:p}});\
         function s(){{if(document.documentElement)document.documentElement.setAttribute('data-platform',p);}}\
         s();document.addEventListener('readystatechange',s);}})();"
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn menupunkter_giver_de_rigtige_hændelser() {
        assert_eq!(handling(OM), Some("om"));
        assert_eq!(handling(INDSTILLINGER), Some("indstillinger"));
        assert_eq!(handling(AFSLUT), Some("afslut"));
        assert_eq!(handling(AABN), Some("aabn"));
        assert_eq!(handling(GEM), Some("gem"));
        assert_eq!((GENVEJ_AABN, GENVEJ_GEM), ("CmdOrCtrl+O", "CmdOrCtrl+S"));
        assert_eq!(
            (DA.arkiv, DA.aabn, DA.gem, EN.arkiv, EN.aabn),
            ("Arkiv", "Åbn…", "Gem…", "File", "Open…")
        );
        assert_eq!(handling("noget-andet"), None);
        assert_eq!(GENVEJ_INDSTILLINGER, "CmdOrCtrl+,");
        assert_eq!(GENVEJ_AFSLUT, "CmdOrCtrl+Q");
    }

    #[test]
    fn menutekster_er_danske_og_naevner_grimnir() {
        assert_eq!(
            (DA.om, DA.indstillinger, DA.afslut),
            ("Om Grimnir", "Indstillinger…", "Afslut Grimnir")
        );
        assert_eq!((DA.rediger, DA.kopier, DA.saet_ind), ("Rediger", "Kopiér", "Sæt ind"));
    }

    #[test]
    fn menuen_findes_paa_engelsk_og_sproget_vaelges() {
        assert_eq!(
            (EN.om, EN.afslut, EN.saet_ind, EN.kopier),
            ("About Grimnir", "Quit Grimnir", "Paste", "Copy")
        );
        assert_eq!(tekster("en").rediger, "Edit");
        assert_eq!(tekster("da").rediger, "Rediger");
        assert_eq!(tekster("noget-andet").rediger, "Rediger");
    }

    #[test]
    fn platform_skriptet_kender_kun_faste_navne() {
        assert!(platform_skript("macos").contains("var p='macos'"));
        assert!(platform_skript("windows").contains("var p='windows'"));
        assert!(platform_skript("noget'farligt").contains("var p='andet'"));
    }
}
