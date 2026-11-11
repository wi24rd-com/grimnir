//! Stilstand (V-LAAS.3 N2): hvor længe Grimnir har stået uden aktivitet, målt med et monotont ur i skallen (kernen har
//! ingen ure).
//!
//! **Aktivitet** er en kommando fra webvisningen (hver kommando tæller; `lib.rs` melder den, før kommandoen kører) og
//! tastatur eller mus i Grimnirs vindue (webvisningen sender kommandoen `aktivitet`, højst hvert 20. sekund). En lang
//! kommando (en analyse af en stor fil) holder en [`Travl`], mens den kører: så længe en kommando er i gang, er der ingen
//! stilstand, og når den slutter, starter uret forfra.
//!
//! **Uret** er et trait ([`Ur`]), så tests kan styre tiden ([`StyretUr`]). Programmet bruger [`SystemUr`]
//! (`std::time::Instant`, der aldrig går baglæns).
//!
//! Grænsen er brugerens valg i Indstillinger: 5, 15 (standard), 30 eller 60 minutter ([`MINUTTER`]). Den kan ikke slås
//! fra. At låse ved stilstand er [`crate::maskering::tjek_stilstand`]; den kaldes jævnligt fra en tråd i `lib.rs`.

use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

/// De grænser, brugeren kan vælge (minutter). Der er bevidst ingen "aldrig".
pub const MINUTTER: [u32; 4] = [5, 15, 30, 60];
/// Standardgrænsen (minutter).
pub const STANDARD_MINUTTER: u32 = 15;

/// Et monotont ur: tiden siden et fast, vilkårligt nulpunkt.
pub trait Ur: Send + Sync {
    /// Tiden nu, målt fra urets nulpunkt. Går aldrig baglæns.
    fn nu(&self) -> Duration;
}

/// Systemets monotone ur (`Instant`), med nulpunkt, da uret blev lavet.
pub struct SystemUr(Instant);

impl Default for SystemUr {
    fn default() -> Self {
        SystemUr(Instant::now())
    }
}

impl Ur for SystemUr {
    fn nu(&self) -> Duration {
        self.0.elapsed()
    }
}

/// Et ur, testen selv styrer: står stille, til testen flytter det frem.
#[derive(Default)]
pub struct StyretUr(Mutex<Duration>);

impl StyretUr {
    /// Flytter uret `d` frem.
    pub fn frem(&self, d: Duration) {
        *self.0.lock().unwrap_or_else(|e| e.into_inner()) += d;
    }
}

impl Ur for StyretUr {
    fn nu(&self) -> Duration {
        *self.0.lock().unwrap_or_else(|e| e.into_inner())
    }
}

impl<T: Ur + ?Sized> Ur for Arc<T> {
    fn nu(&self) -> Duration {
        (**self).nu()
    }
}

/// Stilstanden: uret, tidspunktet for den seneste aktivitet og antallet af kommandoer, der er i gang.
pub struct Stilstand {
    ur: Box<dyn Ur>,
    sidst: Mutex<Duration>,
    travle: AtomicUsize,
}

impl Default for Stilstand {
    fn default() -> Self {
        Stilstand::med(Box::new(SystemUr::default()))
    }
}

impl Stilstand {
    /// Stilstand målt med uret `ur`; nu er der aktivitet.
    pub fn med(ur: Box<dyn Ur>) -> Self {
        let nu = ur.nu();
        Stilstand {
            ur,
            sidst: Mutex::new(nu),
            travle: AtomicUsize::new(0),
        }
    }

    /// Der er aktivitet nu: uret starter forfra.
    pub fn aktivitet(&self) {
        *self.sidst.lock().unwrap_or_else(|e| e.into_inner()) = self.ur.nu();
    }

    /// En kommando er i gang, til den returnerede vagt slippes; imens er der ingen stilstand.
    pub fn travl(&self) -> Travl<'_> {
        self.travle.fetch_add(1, Ordering::SeqCst);
        self.aktivitet();
        Travl(self)
    }

    /// Tiden siden seneste aktivitet; nul, mens en kommando er i gang.
    pub fn stille(&self) -> Duration {
        if self.travle.load(Ordering::SeqCst) > 0 {
            return Duration::ZERO;
        }
        let sidst = *self.sidst.lock().unwrap_or_else(|e| e.into_inner());
        self.ur.nu().saturating_sub(sidst)
    }

    /// Sand, når der har været stille i mindst `minutter` minutter.
    pub fn udloebet(&self, minutter: u32) -> bool {
        self.stille() >= Duration::from_secs(u64::from(minutter) * 60)
    }
}

/// En kommando i gang ([`Stilstand::travl`]). Når den slippes, tæller det som aktivitet.
pub struct Travl<'a>(&'a Stilstand);

impl Drop for Travl<'_> {
    fn drop(&mut self) {
        self.0.aktivitet();
        self.0.travle.fetch_sub(1, Ordering::SeqCst);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn stilstand_med_styret_ur() {
        let ur = Arc::new(StyretUr::default());
        let s = Stilstand::med(Box::new(ur.clone()));
        assert!(!s.udloebet(5));
        ur.frem(Duration::from_secs(5 * 60 - 1));
        assert!(!s.udloebet(5));
        ur.frem(Duration::from_secs(1));
        assert!(s.udloebet(5) && !s.udloebet(15));
        s.aktivitet();
        assert_eq!(s.stille(), Duration::ZERO);
        {
            let _t = s.travl();
            ur.frem(Duration::from_secs(3600));
            assert!(!s.udloebet(5), "en kommando i gang er ikke stilstand");
        }
        assert_eq!(s.stille(), Duration::ZERO, "når kommandoen slutter, starter uret forfra");
    }

    #[test]
    fn systemuret_gaar_ikke_baglaens() {
        let u = SystemUr::default();
        let a = u.nu();
        assert!(u.nu() >= a);
        assert!(MINUTTER.contains(&STANDARD_MINUTTER));
    }
}
