//! V-LAAS.4 N1: vægur med lokal tid til navnet på en midlertidig sag, der gemmes, når Grimnir låser
//! (`Midlertidig ÅÅÅÅ-MM-DD TT.MM`), og til dens standardudløb.
//!
//! [`Klokke`] er et trait, så testene styrer tiden ([`StyretKlokke`]). [`SystemKlokke`] tager tiden fra styresystemet og
//! den lokale tidszones forskel fra UTC på det tidspunkt: på macOS fra `NSTimeZone.localTimeZone`
//! (`secondsFromGMTForDate:`, så sommertid gælder for netop det øjeblik). Andre platforme har endnu ingen tidszone her og
//! bruger UTC (Windows-udgaven er B4). Kalenderregningen er ren kode uden crate (gregoriansk, som `tjek_dato`).
//!
//! Stilstand måles med et andet, monotont ur ([`crate::stilstand`]); dette ur bruges kun til navne og datoer.

use std::sync::Mutex;

/// Et vægur: nu i millisekunder siden 1970 (UTC) og den lokale tidszones forskel fra UTC i sekunder (øst er positiv).
pub trait Klokke: Send + Sync {
    /// Nu og den lokale forskel fra UTC.
    fn nu(&self) -> (u64, i32);
}

/// Styresystemets ur og tidszone.
pub struct SystemKlokke;

impl Klokke for SystemKlokke {
    fn nu(&self) -> (u64, i32) {
        let ms = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);
        (ms, forskel(ms))
    }
}

/// Den lokale tidszones forskel fra UTC på tidspunktet `ms` (macOS: `NSTimeZone`).
#[cfg(target_os = "macos")]
fn forskel(ms: u64) -> i32 {
    use objc2_foundation::{NSDate, NSTimeZone};
    // Kaldet kan komme fra en tråd uden egen autorelease-pulje (låsen kører i en tråd for sig).
    objc2::rc::autoreleasepool(|_| {
        let dato = NSDate::dateWithTimeIntervalSince1970(ms as f64 / 1000.0);
        NSTimeZone::localTimeZone().secondsFromGMTForDate(&dato) as i32
    })
}

/// Uden tidszone (Windows i dag): UTC.
#[cfg(not(target_os = "macos"))]
fn forskel(_ms: u64) -> i32 {
    0
}

/// Et ur, testen styrer.
pub struct StyretKlokke(Mutex<(u64, i32)>);

impl StyretKlokke {
    /// Uret står på `ms` (UTC) med forskellen `forskel` sekunder.
    pub fn ny(ms: u64, forskel: i32) -> Self {
        StyretKlokke(Mutex::new((ms, forskel)))
    }

    /// Stiller uret.
    pub fn stil(&self, ms: u64, forskel: i32) {
        *self.0.lock().unwrap_or_else(|e| e.into_inner()) = (ms, forskel);
    }
}

impl Klokke for StyretKlokke {
    fn nu(&self) -> (u64, i32) {
        *self.0.lock().unwrap_or_else(|e| e.into_inner())
    }
}

impl<T: Klokke + ?Sized> Klokke for std::sync::Arc<T> {
    fn nu(&self) -> (u64, i32) {
        (**self).nu()
    }
}

/// En lokal dato og et klokkeslæt (til minuttet).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Lokal {
    /// År.
    pub aar: i64,
    /// Måned 1–12.
    pub md: u32,
    /// Dag 1–31.
    pub dag: u32,
    /// Time 0–23.
    pub time: u32,
    /// Minut 0–59.
    pub min: u32,
    /// Dage siden 1970-01-01 (lokalt).
    dage: i64,
}

/// Dage siden 1970-01-01 → (år, måned, dag) (H. Hinnants `civil_from_days`, gregoriansk).
fn dato_af_dage(z: i64) -> (i64, u32, u32) {
    let z = z + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z.rem_euclid(146_097);
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = (doy - (153 * mp + 2) / 5 + 1) as u32;
    let m = if mp < 10 { mp + 3 } else { mp - 9 } as u32;
    let y = yoe + era * 400 + i64::from(m <= 2);
    (y, m, d)
}

/// Den lokale tid for `ms` (UTC) med forskellen `forskel` sekunder.
pub fn lokal(ms: u64, forskel: i32) -> Lokal {
    let sek = (ms / 1000) as i64 + i64::from(forskel);
    let dage = sek.div_euclid(86_400);
    let i_dag = sek.rem_euclid(86_400);
    let (aar, md, dag) = dato_af_dage(dage);
    Lokal {
        aar,
        md,
        dag,
        time: (i_dag / 3600) as u32,
        min: ((i_dag % 3600) / 60) as u32,
        dage,
    }
}

impl Lokal {
    /// `ÅÅÅÅ-MM-DD TT.MM` (som i sagsnavnet).
    pub fn tekst(&self) -> String {
        format!("{:04}-{:02}-{:02} {:02}.{:02}", self.aar, self.md, self.dag, self.time, self.min)
    }

    /// Datoen `dage` dage senere som `ÅÅÅÅ-MM-DD` (standardudløbet).
    pub fn dato_om(&self, dage: u32) -> String {
        let (y, m, d) = dato_af_dage(self.dage + i64::from(dage));
        format!("{y:04}-{m:02}-{d:02}")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lokal_tid_og_datoer() {
        // 2026-11-11 08:05:30 UTC; Danmark er UTC+1 om vinteren.
        let ms = 1_794_384_330_000;
        assert_eq!(lokal(ms, 0).tekst(), "2026-11-11 08.05");
        assert_eq!(lokal(ms, 3600).tekst(), "2026-11-11 09.05");
        // Over midnat og nytår, begge veje.
        assert_eq!(lokal(1_798_761_540_000, 3600).tekst(), "2027-01-01 00.59");
        assert_eq!(lokal(1_798_761_540_000, -3600).tekst(), "2026-12-31 22.59");
        assert_eq!(lokal(0, 0).tekst(), "1970-01-01 00.00");
        // Skudår og udløb.
        let l = lokal(1_835_136_000_000, 0);
        assert_eq!(l.tekst(), "2028-02-26 00.00");
        assert_eq!(l.dato_om(3), "2028-02-29");
        assert_eq!(l.dato_om(4), "2028-03-01");
        assert_eq!(lokal(ms, 3600).dato_om(30), "2026-12-11");
        assert_eq!(lokal(ms, 3600).dato_om(90), "2027-02-09");
    }

    #[test]
    fn styret_klokke() {
        let k = StyretKlokke::ny(5, 7);
        assert_eq!(k.nu(), (5, 7));
        k.stil(9, -3);
        assert_eq!(k.nu(), (9, -3));
    }
}
