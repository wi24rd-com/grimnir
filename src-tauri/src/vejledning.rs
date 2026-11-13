//! V-OPBYG.1 N7 (D27): knappen Vejledning i titellinjen beder styresystemet åbne Grimnirs vejledning i brugerens browser.
//!
//! Ingen netværkskode, ingen ny crate og intet plugin: Grimnir starter styresystemets eget program til at åbne en adresse
//! (`/usr/bin/open` på macOS, `explorer.exe` på Windows) med én af to faste adresser og venter ikke på browseren. Det er
//! browseren, ikke Grimnir, der henter siden. Webvisningen vælger kun sproget (`da` eller `en`); intet fra brugeren, teksten
//! eller sagen sendes med, og en anden adresse kan ikke gives (alt andet end `en` giver den danske). Virker også, mens
//! Grimnir er låst: adressen rører hverken sager eller ordbog. `tests/intet_netvaerk.rs` holder netop det.

/// Vejledningen på dansk (Jans valg; manualen skrives senere, og siden behøver ikke findes endnu).
pub const ADRESSE_DA: &str = "https://wi24rd.com/grimnir/vejledning";
/// Vejledningen på engelsk.
pub const ADRESSE_EN: &str = "https://wi24rd.com/grimnir/guide";

/// Adressen for UI'ets sprog: `en` giver den engelske, alt andet den danske.
pub fn adresse(sprog: &str) -> &'static str {
    if sprog == "en" {
        ADRESSE_EN
    } else {
        ADRESSE_DA
    }
}

/// Beder styresystemet åbne vejledningen. Programmet ventes der på i en tråd for sig (så det ikke bliver hængende som en
/// zombie), ikke på browseren. Fejlen siger kun, at det ikke lykkedes; ingen sti, intet indhold.
pub fn aabn(sprog: &str) -> Result<(), String> {
    let a = adresse(sprog);
    #[cfg(target_os = "macos")]
    let barn = std::process::Command::new("/usr/bin/open").arg(a).spawn();
    #[cfg(target_os = "windows")]
    let barn = std::process::Command::new("explorer.exe").arg(a).spawn();
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    let barn: std::io::Result<std::process::Child> = {
        let _ = a;
        Err(std::io::Error::other("ikke en af Grimnirs platforme"))
    };
    match barn {
        Ok(mut b) => {
            std::thread::spawn(move || {
                let _ = b.wait();
            });
            Ok(())
        }
        Err(_) => Err("kunne_ikke_aabne".into()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Kun sproget vælger adressen; en adresse eller noget andet fra webvisningen giver den danske (ikke det, der blev
    /// sendt). `aabn` prøves ikke her: den ville åbne en browser.
    #[test]
    fn adressen_er_fast_og_kun_sproget_vaelger() {
        assert_eq!(adresse("da"), "https://wi24rd.com/grimnir/vejledning");
        assert_eq!(adresse("en"), "https://wi24rd.com/grimnir/guide");
        for andet in ["", "EN", "de", "https://eksempel.dk", "en ", "../guide"] {
            assert_eq!(adresse(andet), ADRESSE_DA, "{andet:?}");
        }
    }
}
