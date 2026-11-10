//! Filer ind og ud (V-FIL.1, D9: enkeltfil ind, maskeret fil ud). Rene funktioner over stier, så de kan testes uden
//! vindue og uden dialog (`tests/fil1.rs`). Dialogerne og træk-og-slip står i `lib.rs`.
//!
//! **Tegnsæt.** UTF-8 med og uden BOM, UTF-16LE og UTF-16BE med BOM. Alt andet afvises med en besked om, hvad filen
//! ligner ([`FilFejl::Tegnsaet`]), aldrig med indhold. Teksten holdes som UTF-8 i hukommelsen; BOM og tegnsæt huskes og
//! skrives tilbage, og linjeskift bevares, fordi de er en del af teksten (`\r\n` er to tegn i strengen). Rundturen fil →
//! tekst → fil giver derfor præcis de samme bytes; kun de erstattede værdier ændrer sig.
//!
//! **Kopier i hukommelsen** (F1). Læsning: filens bytes læses én gang ind i en `Vec` med den rigtige størrelse. UTF-8
//! bliver til en `String` uden kopi (BOM'en flyttes væk i samme buffer). UTF-16 afkodes til en ny `String`; på det
//! værste tidspunkt findes filens bytes (N) og teksten (op til 1,5 N) samtidig, derefter nulstilles og slippes bytes.
//! Skrivning: UTF-8 skrives direkte fra strengen (ingen kopi); UTF-16 kodes i stykker á 64 Ki tegn gennem en buffer på
//! 128 KiB, som nulstilles bagefter. Selve maskeringen laver den maskerede tekst ved siden af originalen (kernens
//! `masker`), så det værste tidspunkt i alt er: original + maskeret + kernens fund og erstatninger (målt i HANDOFF).
//!
//! **Originalen ændres aldrig.** Filen åbnes kun til læsning, og [`skriv`] afviser at skrive til den fil, teksten kom
//! fra ([`FilFejl::SammeFil`]). Skrivningen er atomar med samme hjælper som sagerne ([`crate::sager::skriv_atomart_med`]).

use std::fs::{self, File};
use std::io::{self, Read, Write};
use std::path::{Path, PathBuf};

use serde::Serialize;
use zeroize::Zeroize;

use crate::sager::{skriv_atomart_med, SagFejl};

/// Største fil: 100 MiB (104 857 600 bytes).
pub const MAKS_FIL: u64 = 100 * 1024 * 1024;
/// Tegn i uddraget til webvisningen (som `MAKS_VIST` i maskering.js).
pub const UDDRAG_TEGN: usize = 200_000;
/// Største tekst, der kan kopieres til udklipsholderen: 5 MiB (som Maskér for indsat tekst).
pub const MAKS_KOPI: usize = 5 * 1024 * 1024;

/// Filens tegnsæt.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Tegnsaet {
    /// UTF-8 uden BOM.
    Utf8,
    /// UTF-8 med BOM (EF BB BF).
    Utf8Bom,
    /// UTF-16 little endian med BOM (FF FE).
    Utf16le,
    /// UTF-16 big endian med BOM (FE FF).
    Utf16be,
}

/// Filens linjeskift (kun til visning; de bevares, som de er).
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Linjeskift {
    /// Kun `\n`.
    Lf,
    /// Kun `\r\n`.
    Crlf,
    /// Kun `\r`.
    Cr,
    /// Flere slags.
    Blandet,
    /// Ingen linjeskift.
    Ingen,
}

/// Fejl med filer. Ingen variant indeholder indhold eller stier.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(tag = "art", rename_all = "snake_case")]
pub enum FilFejl {
    /// Filen er større end [`MAKS_FIL`].
    ForStor {
        /// Filens størrelse i bytes.
        bytes: u64,
        /// Grænsen.
        maks: u64,
    },
    /// Filen er tom.
    Tom,
    /// Det er en mappe (mapper og zip er v2).
    Mappe,
    /// Det er hverken en fil eller en mappe (fx en enhed eller et rør).
    IkkeFil,
    /// Flere filer på én gang (træk-og-slip).
    FlereFiler,
    /// Tegnsættet kendes ikke. `ligner`: `enkeltbyte` (ikke UTF-8 og uden BOM, fx Latin-1/Windows-1252) |
    /// `ugyldig_utf8` (UTF-8 med en ugyldig byte) | `utf16_uden_bom` | `utf32` | `binaer` (nul-bytes) | `ugyldig_utf16`.
    /// `byte`: positionen (0-baseret) for den første byte, der ikke kan læses.
    Tegnsaet {
        /// Hvad filen ligner.
        ligner: &'static str,
        /// Bytepositionen.
        byte: Option<u64>,
    },
    /// Grimnir skriver aldrig til den fil, teksten kom fra.
    SammeFil,
    /// Disken: `io::ErrorKind` som tekst (fx `PermissionDenied`, `NotFound`), aldrig stien.
    Disk {
        /// Fejlens art.
        hvad: String,
    },
}

impl From<io::Error> for FilFejl {
    fn from(e: io::Error) -> Self {
        FilFejl::Disk {
            hvad: format!("{:?}", e.kind()),
        }
    }
}

impl From<SagFejl> for FilFejl {
    fn from(f: SagFejl) -> Self {
        match f {
            SagFejl::Disk { hvad } => FilFejl::Disk { hvad },
            SagFejl::ManglerFil => FilFejl::Disk { hvad: "NotFound".into() },
            _ => FilFejl::Disk { hvad: "Other".into() },
        }
    }
}

/// En åben fil: teksten i hukommelsen og det, der skal til for at skrive den tilbage. Teksten nulstilles, når filen
/// slippes.
pub struct Fil {
    /// Filnavnet (til visning; webvisningen ser aldrig mere af stien).
    pub navn: String,
    /// Stien (bliver i Rust).
    pub sti: PathBuf,
    /// Tegnsættet.
    pub tegnsaet: Tegnsaet,
    /// Linjeskiftene.
    pub linjeskift: Linjeskift,
    /// Filens størrelse i bytes.
    pub bytes: u64,
    /// Teksten.
    pub tekst: String,
}

impl Drop for Fil {
    fn drop(&mut self) {
        self.tekst.zeroize();
    }
}

impl Fil {
    /// Antal linjer (som `Linjer::antal` i maskering.rs).
    pub fn linjer(&self) -> usize {
        antal_linjer(&self.tekst)
    }
}

/// Antal linjer: `\n` tæller, og en sidste linje uden `\n` tæller med.
pub fn antal_linjer(t: &str) -> usize {
    if t.is_empty() {
        return 0;
    }
    let n = t.bytes().filter(|&b| b == b'\n').count();
    n + usize::from(!t.ends_with('\n'))
}

/// Linjeskiftene i teksten.
pub fn linjeskift(t: &str) -> Linjeskift {
    let b = t.as_bytes();
    let (mut lf, mut crlf, mut cr) = (false, false, false);
    let mut i = 0;
    while i < b.len() {
        match b[i] {
            b'\r' if b.get(i + 1) == Some(&b'\n') => {
                crlf = true;
                i += 1;
            }
            b'\r' => cr = true,
            b'\n' => lf = true,
            _ => {}
        }
        i += 1;
    }
    match (lf, crlf, cr) {
        (false, false, false) => Linjeskift::Ingen,
        (true, false, false) => Linjeskift::Lf,
        (false, true, false) => Linjeskift::Crlf,
        (false, false, true) => Linjeskift::Cr,
        _ => Linjeskift::Blandet,
    }
}

/// Uddraget til webvisningen: de første [`UDDRAG_TEGN`] tegn og antallet af tegn, der ikke vises.
pub fn uddrag(t: &str) -> (String, usize) {
    match t.char_indices().nth(UDDRAG_TEGN) {
        None => (t.to_string(), 0),
        Some((i, _)) => (t[..i].to_string(), t[i..].chars().count()),
    }
}

/// Læser en fil. Afviser mapper, tomme filer, filer over [`MAKS_FIL`] og ukendte tegnsæt. Filen åbnes kun til læsning.
pub fn laes(sti: &Path) -> Result<Fil, FilFejl> {
    let meta = fs::metadata(sti)?;
    if meta.is_dir() {
        return Err(FilFejl::Mappe);
    }
    if !meta.is_file() {
        return Err(FilFejl::IkkeFil);
    }
    if meta.len() > MAKS_FIL {
        return Err(FilFejl::ForStor {
            bytes: meta.len(),
            maks: MAKS_FIL,
        });
    }
    if meta.len() == 0 {
        return Err(FilFejl::Tom);
    }
    let mut bytes = Vec::with_capacity(meta.len() as usize + 1);
    // Højst én byte over grænsen læses: er filen vokset siden, afvises den uden at læse resten.
    File::open(sti)?.take(MAKS_FIL + 1).read_to_end(&mut bytes)?;
    if bytes.len() as u64 > MAKS_FIL {
        bytes.zeroize();
        return Err(FilFejl::ForStor {
            bytes: fs::metadata(sti).map(|m| m.len()).unwrap_or(MAKS_FIL + 1),
            maks: MAKS_FIL,
        });
    }
    if bytes.is_empty() {
        return Err(FilFejl::Tom);
    }
    let n = bytes.len() as u64;
    let (tekst, tegnsaet) = dekod(bytes)?;
    let navn = sti.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
    Ok(Fil {
        navn,
        sti: sti.to_path_buf(),
        tegnsaet,
        linjeskift: linjeskift(&tekst),
        bytes: n,
        tekst,
    })
}

/// Afkoder filens bytes. Bufferen nulstilles, hvis den ikke bliver til teksten.
pub fn dekod(mut b: Vec<u8>) -> Result<(String, Tegnsaet), FilFejl> {
    let fejl = |b: &mut Vec<u8>, ligner: &'static str, byte: Option<u64>| {
        b.zeroize();
        Err(FilFejl::Tegnsaet { ligner, byte })
    };
    if b.starts_with(&[0, 0, 0xFE, 0xFF]) || b.starts_with(&[0xFF, 0xFE, 0, 0]) {
        return fejl(&mut b, "utf32", None);
    }
    if b.starts_with(&[0xEF, 0xBB, 0xBF]) {
        b.drain(..3);
        return match String::from_utf8(b) {
            Ok(s) => Ok((s, Tegnsaet::Utf8Bom)),
            Err(e) => {
                let pos = e.utf8_error().valid_up_to();
                let mut b = e.into_bytes();
                let ligner = ugyldig_art(&b[..pos]);
                fejl(&mut b, ligner, Some(pos as u64 + 3))
            }
        };
    }
    for (bom, be, ts) in [([0xFF, 0xFE], false, Tegnsaet::Utf16le), ([0xFE, 0xFF], true, Tegnsaet::Utf16be)] {
        if b.starts_with(&bom) {
            let r = dekod_utf16(&b[2..], be);
            b.zeroize();
            return match r {
                Ok(s) => Ok((s, ts)),
                Err(enhed) => Err(FilFejl::Tegnsaet {
                    ligner: "ugyldig_utf16",
                    byte: Some(2 + 2 * enhed as u64),
                }),
            };
        }
    }
    // Uden BOM: kun UTF-8, og uden nul-bytes (en logfil har ingen; UTF-16 uden BOM og binære filer har mange).
    if let Some(i) = b.iter().position(|&x| x == 0) {
        let ligner = if ligner_utf16(&b) { "utf16_uden_bom" } else { "binaer" };
        return fejl(&mut b, ligner, Some(i as u64));
    }
    match String::from_utf8(b) {
        Ok(s) => Ok((s, Tegnsaet::Utf8)),
        Err(e) => {
            let pos = e.utf8_error().valid_up_to();
            let mut b = e.into_bytes();
            let ligner = ugyldig_art(&b[..pos]);
            fejl(&mut b, ligner, Some(pos as u64))
        }
    }
}

/// En ugyldig UTF-8-byte: har filen allerede gyldige UTF-8-tegn over ASCII før den, er det UTF-8 med en fejl midt i;
/// ellers ligner den et 8-bit-tegnsæt (Latin-1, Windows-1252).
fn ugyldig_art(gyldig_foer: &[u8]) -> &'static str {
    if gyldig_foer.iter().any(|&x| x >= 0x80) {
        "ugyldig_utf8"
    } else {
        "enkeltbyte"
    }
}

/// UTF-16 uden BOM: i starten er hver anden byte nul (ASCII-tekst).
fn ligner_utf16(b: &[u8]) -> bool {
    let start = &b[..b.len().min(4096) & !1];
    if start.len() < 4 {
        return false;
    }
    let par = start.len() / 2;
    let lige = start.iter().step_by(2).filter(|&&x| x == 0).count();
    let ulige = start.iter().skip(1).step_by(2).filter(|&&x| x == 0).count();
    lige * 2 > par || ulige * 2 > par
}

/// Afkoder UTF-16 uden BOM. Fejl: indekset (i 16-bit-enheder) for den første enhed, der ikke kan læses (et ulige antal
/// bytes giver den sidste halve enhed).
fn dekod_utf16(b: &[u8], be: bool) -> Result<String, usize> {
    let enheder = b.len() / 2;
    let u = |i: usize| {
        let p = [b[2 * i], b[2 * i + 1]];
        if be {
            u16::from_be_bytes(p)
        } else {
            u16::from_le_bytes(p)
        }
    };
    let mut s = String::with_capacity(b.len() + b.len() / 2);
    let mut i = 0;
    for r in char::decode_utf16((0..enheder).map(u)) {
        match r {
            Ok(c) => {
                s.push(c);
                i += c.len_utf16();
            }
            Err(_) => {
                s.zeroize();
                return Err(i);
            }
        }
    }
    if b.len() % 2 == 1 {
        s.zeroize();
        return Err(enheder);
    }
    Ok(s)
}

/// Skriver teksten med tegnsættet (og BOM'en) atomart til `sti`. `ikke_til`: filer, der ikke må overskrives (den fil,
/// teksten kom fra). Bufferen til UTF-16 nulstilles.
pub fn skriv(sti: &Path, tekst: &str, tegnsaet: Tegnsaet, ikke_til: &[&Path]) -> Result<(), FilFejl> {
    skriv_med(sti, tekst, tegnsaet, ikke_til, &mut || Ok(()))
}

/// Som [`skriv`] med et kald lige før omdøbningen (tests).
#[doc(hidden)]
pub fn skriv_med(
    sti: &Path,
    tekst: &str,
    tegnsaet: Tegnsaet,
    ikke_til: &[&Path],
    foer_omdoeb: &mut dyn FnMut() -> io::Result<()>,
) -> Result<(), FilFejl> {
    if ikke_til.iter().any(|o| samme_fil(sti, o)) {
        return Err(FilFejl::SammeFil);
    }
    if sti.is_dir() {
        return Err(FilFejl::Mappe);
    }
    let mut skriv = |f: &mut File| -> io::Result<()> {
        match tegnsaet {
            Tegnsaet::Utf8 => f.write_all(tekst.as_bytes()),
            Tegnsaet::Utf8Bom => {
                f.write_all(&[0xEF, 0xBB, 0xBF])?;
                f.write_all(tekst.as_bytes())
            }
            Tegnsaet::Utf16le | Tegnsaet::Utf16be => {
                let be = tegnsaet == Tegnsaet::Utf16be;
                f.write_all(if be { &[0xFE, 0xFF] } else { &[0xFF, 0xFE] })?;
                const STYKKE: usize = 64 * 1024;
                let mut buf: Vec<u8> = Vec::with_capacity(2 * STYKKE + 4);
                let mut r = Ok(());
                for e in tekst.encode_utf16() {
                    buf.extend_from_slice(&if be { e.to_be_bytes() } else { e.to_le_bytes() });
                    if buf.len() >= 2 * STYKKE {
                        r = f.write_all(&buf);
                        buf.zeroize();
                        if r.is_err() {
                            break;
                        }
                    }
                }
                if r.is_ok() && !buf.is_empty() {
                    r = f.write_all(&buf);
                }
                buf.zeroize();
                r
            }
        }
    };
    skriv_atomart_med(sti, &mut skriv, foer_omdoeb).map_err(FilFejl::from)
}

/// Peger to stier på samme fil? Findes `a` ikke, er svaret nej. Unix: enhed og inode (fanger også store/små bogstaver
/// på et filsystem, der ikke skelner); ellers de kanoniske stier uden forskel på store og små bogstaver.
pub fn samme_fil(a: &Path, b: &Path) -> bool {
    let (Ok(ma), Ok(mb)) = (fs::metadata(a), fs::metadata(b)) else {
        return false;
    };
    #[cfg(unix)]
    {
        use std::os::unix::fs::MetadataExt;
        ma.dev() == mb.dev() && ma.ino() == mb.ino()
    }
    #[cfg(not(unix))]
    {
        let _ = (ma, mb);
        match (fs::canonicalize(a), fs::canonicalize(b)) {
            (Ok(x), Ok(y)) => x.to_string_lossy().to_lowercase() == y.to_string_lossy().to_lowercase(),
            _ => false,
        }
    }
}

/// Filnavnet til den gemte fil: `<navn>.<tillaeg>.<endelse>`; uden endelse `<navn>.<tillaeg>`. Kun det sidste punktum
/// tæller (`a.b.log` → `a.b.maskeret.log`), og et punktum først i navnet er ikke en endelse (`.bashrc` →
/// `.bashrc.maskeret`).
pub fn forslag(navn: &str, tillaeg: &str) -> String {
    match navn.rfind('.') {
        Some(i) if i > 0 && i + 1 < navn.len() => format!("{}.{}{}", &navn[..i], tillaeg, &navn[i..]),
        _ => format!("{navn}.{tillaeg}"),
    }
}

/// Forslaget under Demaskér: `<navn>.demaskeret.<endelse>`. Hedder filen `<navn>.maskeret.<endelse>` (Grimnirs eget
/// forslag under Maskér), bliver `.maskeret` væk: `app.maskeret.log` → `app.demaskeret.log`.
pub fn forslag_demaskeret(navn: &str) -> String {
    let (stamme, endelse) = match navn.rfind('.') {
        Some(i) if i > 0 && i + 1 < navn.len() => (&navn[..i], &navn[i..]),
        _ => (navn, ""),
    };
    let stamme = stamme.strip_suffix(".maskeret").filter(|s| !s.is_empty()).unwrap_or(stamme);
    format!("{stamme}.demaskeret{endelse}")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn linjeskift_genkendes() {
        assert_eq!(linjeskift("a\nb\n"), Linjeskift::Lf);
        assert_eq!(linjeskift("a\r\nb\r\n"), Linjeskift::Crlf);
        assert_eq!(linjeskift("a\r\nb\n"), Linjeskift::Blandet);
        assert_eq!(linjeskift("a\rb"), Linjeskift::Cr);
        assert_eq!(linjeskift("ab"), Linjeskift::Ingen);
        assert_eq!(antal_linjer("a\r\nb"), 2);
        assert_eq!(antal_linjer("a\n"), 1);
    }

    #[test]
    fn uddraget_er_200000_tegn() {
        let t = "æ".repeat(UDDRAG_TEGN + 5);
        let (u, rest) = uddrag(&t);
        assert_eq!((u.chars().count(), rest), (UDDRAG_TEGN, 5));
        assert_eq!(uddrag("kort"), ("kort".to_string(), 0));
    }

    #[test]
    fn utf16_med_halv_enhed_og_enlig_surrogat_afvises() {
        let mut b = vec![0xFF, 0xFE, b'a', 0, b'b'];
        assert_eq!(
            dekod(b.clone()),
            Err(FilFejl::Tegnsaet {
                ligner: "ugyldig_utf16",
                byte: Some(4)
            })
        );
        b = vec![0xFF, 0xFE, b'a', 0, 0x00, 0xD8, b'b', 0];
        assert_eq!(
            dekod(b),
            Err(FilFejl::Tegnsaet {
                ligner: "ugyldig_utf16",
                byte: Some(4)
            })
        );
        assert_eq!(
            dekod(vec![0xFF, 0xFE, 0, 0, b'a', 0, 0, 0]),
            Err(FilFejl::Tegnsaet {
                ligner: "utf32",
                byte: None
            })
        );
    }
}
