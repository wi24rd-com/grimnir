//! V-RET.1 R5: igangværende skrivninger i brugerens mapper.
//!
//! Når Grimnir gemmer en fil i brugerens mappe ("Gem maskeret fil" og "Gem som fil" under Demaskér), skrives den først til
//! en midlertidig fil `.<navn>.<8 hextegn>.tmp` ved siden af og omdøbes bagefter ([`crate::sager::skriv_atomart_noteret`]).
//! Går programmet ned midt i det, ligger den midlertidige fil tilbage; for en demaskeret fil med de rigtige værdier i
//! klartekst. Derfor noteres den midlertidige fils fulde sti i `<app-data>/igang.json`, før der skrives, og fjernes igen
//! efter omdøbningen eller oprydningen. Ved start ([`Igang::ryd`]) slettes de noterede filer, hvis de findes, er
//! almindelige filer og hedder `.<navn>.<8 hextegn>.tmp`, og listen tømmes. Alt andet røres ikke.
//!
//! Filen indeholder kun stier (aldrig indhold) og højst de skrivninger, der er i gang lige nu; er der ingen, findes filen
//! ikke. Den skrives atomart med sagernes hjælper. En sti, der ikke er gyldig UTF-8, kan ikke noteres; så gemmes filen
//! ikke (fejlen siger kun, at disken ikke kunne bruges).

use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use serde::{Deserialize, Serialize};

use crate::sager::{opret_mappe, skriv_atomart, SagFejl};

/// Filens navn i `<app-data>`.
pub const FIL: &str = "igang.json";

#[derive(Serialize, Deserialize, Default)]
struct Liste {
    filer: Vec<PathBuf>,
}

/// Listen over igangværende skrivninger: i hukommelsen og i `<app-data>/igang.json`.
pub struct Igang {
    fil: PathBuf,
    liste: Mutex<Vec<PathBuf>>,
}

fn io_fejl(e: SagFejl) -> io::Error {
    io::Error::other(format!("{e:?}"))
}

impl Igang {
    /// Listen i `<mappe>/igang.json` (filen læses først i [`Igang::ryd`]).
    pub fn ny(mappe: &Path) -> Self {
        Igang {
            fil: mappe.join(FIL),
            liste: Mutex::new(Vec::new()),
        }
    }

    /// Stien til `igang.json`.
    pub fn sti(&self) -> &Path {
        &self.fil
    }

    fn laas(&self) -> std::sync::MutexGuard<'_, Vec<PathBuf>> {
        self.liste.lock().unwrap_or_else(|e| e.into_inner())
    }

    /// Noterer en midlertidig fil, før den oprettes. Kan listen ikke skrives, noteres intet, og fejlen gives videre (så
    /// skrives filen heller ikke).
    pub fn noter(&self, midl: &Path) -> io::Result<()> {
        let mut l = self.laas();
        l.push(midl.to_path_buf());
        if let Err(e) = self.skriv(&l) {
            l.pop();
            return Err(e);
        }
        Ok(())
    }

    /// Fjerner en midlertidig fil fra listen (efter omdøbningen eller oprydningen). En fejl her efterlader stien på listen;
    /// den ryddes ved næste start.
    pub fn fjern(&self, midl: &Path) {
        let mut l = self.laas();
        l.retain(|p| p != midl);
        let _ = self.skriv(&l);
    }

    /// Skriver listen; en tom liste fjerner filen.
    fn skriv(&self, l: &[PathBuf]) -> io::Result<()> {
        if l.is_empty() {
            return match fs::remove_file(&self.fil) {
                Err(e) if e.kind() != io::ErrorKind::NotFound => Err(e),
                _ => Ok(()),
            };
        }
        let bytes = serde_json::to_vec(&Liste { filer: l.to_vec() }).map_err(io::Error::other)?;
        if let Some(mappe) = self.fil.parent() {
            opret_mappe(mappe).map_err(io_fejl)?;
        }
        skriv_atomart(&self.fil, &bytes, &mut || Ok(())).map_err(io_fejl)
    }

    /// Ved start: sletter de noterede midlertidige filer, der findes, er almindelige filer (ikke en mappe eller et link) og
    /// hedder `.<navn>.<8 hextegn>.tmp`, og tømmer listen (filen fjernes). Kan filen ikke læses, fjernes den også. Svarer
    /// med antallet af slettede filer.
    pub fn ryd(&self) -> usize {
        let Ok(bytes) = fs::read(&self.fil) else { return 0 };
        let liste: Liste = serde_json::from_slice(&bytes).unwrap_or_default();
        let mut slettet = 0;
        for p in &liste.filer {
            let navn_ok = p.file_name().and_then(|n| n.to_str()).is_some_and(er_midlertidig);
            let fil_ok = fs::symlink_metadata(p).is_ok_and(|m| m.file_type().is_file());
            if navn_ok && fil_ok && fs::remove_file(p).is_ok() {
                slettet += 1;
            }
        }
        self.laas().clear();
        let _ = fs::remove_file(&self.fil);
        slettet
    }
}

/// Et navn på en midlertidig fil fra den atomare skrivning: `.<navn>.<8 små hextegn>.tmp` med et navn, der ikke er tomt.
pub fn er_midlertidig(navn: &str) -> bool {
    let Some(midt) = navn.strip_prefix('.').and_then(|n| n.strip_suffix(".tmp")) else {
        return false;
    };
    let Some((stamme, hex)) = midt.rsplit_once('.') else {
        return false;
    };
    !stamme.is_empty() && hex.len() == 8 && hex.bytes().all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn moenstret() {
        for ja in [".app.demaskeret.0a1b2c3d.tmp", ".rapport.12345678.tmp", ".x.abcdef01.tmp"] {
            assert!(er_midlertidig(ja), "{ja}");
        }
        for nej in [
            "app.log",
            ".app.0a1b2c3d.TMP",
            "app.0a1b2c3d.tmp",
            "..0a1b2c3d.tmp",
            ".app.0A1B2C3D.tmp",
            ".app.0a1b2c3.tmp",
            ".app.0a1b2c3d4.tmp",
            ".0a1b2c3d.tmp",
            ".app.0a1b2c3g.tmp",
        ] {
            assert!(!er_midlertidig(nej), "{nej}");
        }
    }
}
