//! V-LAAS.4 N2: udklipsholderen ryddes, når Grimnir låser, men kun hvis den stadig indeholder demaskeret tekst, som
//! Grimnir selv lagde der (Kopiér i Demaskér). Maskeret tekst og andre programmers indhold røres ikke (ADR D21).
//!
//! **Metoden** (logikken står i [`crate::maskering::udklip_kopieret`] og [`crate::maskering::laas_igen`]):
//! 1. Webvisningen kopierer som før (bytepræcist fra strengen; selve kopieringen er uændret) og melder et vellykket
//!    Kopiér i Demaskér til Rust (kommandoen `udklip_kopieret`). Kopiér i Maskér melder intet.
//! 2. Rust læser udklipsholderens tæller (`changeCount`). Må teksten læses uden at brugeren får besked (se nedenfor),
//!    sammenlignes den med et fingeraftryk af det demaskerede resultat, Rust selv lavede; er den anderledes, huskes
//!    intet. Tælleren læses igen bagefter; har den flyttet sig, huskes intet. Ellers huskes tælleren.
//! 3. Ved [`crate::maskering::laas_igen`] og (V-LAAS.5 N1) når programmet afslutter ([`crate::maskering::ved_afslut`]):
//!    står tælleren stadig på det tal, ryddes udklipsholderen (`clearContents`). Har nogen skrevet til den siden (også
//!    Grimnir selv, fx Kopiér i Maskér), er tælleren en anden, og den røres ikke. Rydningen læser aldrig teksten.
//!
//! **Hvorfor teksten normalt ikke læses.** Fra macOS 15.4 er standarden for den generelle udklipsholder "to ask upon
//! programmatic access" (`NSPasteboard.h`, `NSPasteboardAccessBehaviorDefault`, SDK 26/27): et program, der læser den
//! uden at brugeren har sat ind, kan få macOS til at vise en dialog. Tælleren er ikke indhold og giver ingen dialog.
//! Derfor læses teksten kun, når systemet siger, at det er tilladt uden besked (`accessBehavior == AlwaysAllow`, eller
//! før macOS 15.4, hvor ordningen ikke findes). Ellers bygger metoden på tælleren alene; hullet er beskrevet i
//! HANDOFF-V-LAAS.4.
//!
//! Teksten fra udklipsholderen gemmes ikke og logges ikke: den sammenlignes og nulstilles (Rust-kopien; `NSString`'en
//! fra AppKit kan Grimnir ikke nulstille).
//!
//! **Windows** har endnu ingen udgave (B4): [`platformens`] svarer `None`, og intet ryddes.
//!
//! `unsafe` står kun her (og i `laas.rs` og `notifikationer.rs`), hver gang med `SAFETY:`.
#![allow(unsafe_code)]

use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Mutex;

use zeroize::Zeroizing;

/// Udklipsholderens tekst, som Grimnir ser den.
pub enum Indhold {
    /// Teksten (nulstilles, når den slippes).
    Tekst(Zeroizing<String>),
    /// Der er ingen tekst.
    Ingen,
    /// Teksten må ikke læses uden at brugeren får besked; kun tælleren kan bruges.
    MaaIkkeLaeses,
}

/// Den generelle udklipsholder. Den rigtige udgave er macOS' `NSPasteboard` ([`platformens`]); tests bruger
/// [`HukommelsesUdklip`] og rører aldrig den rigtige.
pub trait Udklip: Send + Sync {
    /// Tælleren, der går op, hver gang nogen skriver til udklipsholderen (`changeCount`). `None`: kan ikke læses.
    fn taeller(&self) -> Option<isize>;
    /// Teksten, hvis den må læses uden besked til brugeren.
    fn tekst(&self) -> Indhold;
    /// Rydder udklipsholderen.
    fn ryd(&self);
}

impl<T: Udklip + ?Sized> Udklip for std::sync::Arc<T> {
    fn taeller(&self) -> Option<isize> {
        (**self).taeller()
    }
    fn tekst(&self) -> Indhold {
        (**self).tekst()
    }
    fn ryd(&self) {
        (**self).ryd()
    }
}

/// En udklipsholder i hukommelsen til tests: en tæller og en tekst. `laesbar` afgør, om teksten må læses (som
/// `AlwaysAllow` på macOS) eller ej (standarden).
pub struct HukommelsesUdklip {
    indhold: Mutex<(isize, Option<String>)>,
    laesbar: bool,
    /// V-LAAS.5: antal kald af [`Udklip::tekst`] (en læsning, der på macOS kan give en dialog).
    laesninger: AtomicUsize,
}

impl HukommelsesUdklip {
    /// En tom udklipsholder; `laesbar`: teksten må læses uden besked.
    pub fn ny(laesbar: bool) -> Self {
        HukommelsesUdklip {
            indhold: Mutex::new((0, None)),
            laesbar,
            laesninger: AtomicUsize::new(0),
        }
    }

    fn laas(&self) -> std::sync::MutexGuard<'_, (isize, Option<String>)> {
        self.indhold.lock().unwrap_or_else(|e| e.into_inner())
    }

    /// Nogen (webvisningen eller et andet program) skriver tekst: tælleren går op.
    pub fn skriv(&self, tekst: &str) {
        let mut g = self.laas();
        g.0 += 1;
        g.1 = Some(tekst.to_string());
    }

    /// Teksten nu (testens øjne; uden for traitet).
    pub fn nu(&self) -> Option<String> {
        self.laas().1.clone()
    }

    /// Tælleren nu (testens øjne).
    pub fn taeller_nu(&self) -> isize {
        self.laas().0
    }

    /// V-LAAS.5: antal gange, Grimnir har bedt om teksten ([`Udklip::tekst`]), uanset om den måtte læses.
    pub fn laesninger(&self) -> usize {
        self.laesninger.load(Ordering::SeqCst)
    }
}

impl Udklip for HukommelsesUdklip {
    fn taeller(&self) -> Option<isize> {
        Some(self.laas().0)
    }
    fn tekst(&self) -> Indhold {
        self.laesninger.fetch_add(1, Ordering::SeqCst);
        if !self.laesbar {
            return Indhold::MaaIkkeLaeses;
        }
        match &self.laas().1 {
            Some(t) => Indhold::Tekst(Zeroizing::new(t.clone())),
            None => Indhold::Ingen,
        }
    }
    fn ryd(&self) {
        let mut g = self.laas();
        g.0 += 1;
        g.1 = None;
    }
}

/// Platformens udklipsholder: `NSPasteboard.generalPasteboard` på macOS; ingen andre steder endnu (B4).
pub fn platformens() -> Option<Box<dyn Udklip>> {
    #[cfg(target_os = "macos")]
    {
        Some(Box::new(mac::MacUdklip))
    }
    #[cfg(not(target_os = "macos"))]
    {
        None
    }
}

#[cfg(target_os = "macos")]
mod mac {
    use objc2::rc::autoreleasepool;
    use objc2_app_kit::{NSPasteboard, NSPasteboardAccessBehavior, NSPasteboardTypeString};
    use zeroize::Zeroizing;

    use super::{Indhold, Udklip};

    /// `NSPasteboard.generalPasteboard`. Hentes ved hvert kald (objektet holdes ikke mellem tråde).
    pub struct MacUdklip;

    impl Udklip for MacUdklip {
        fn taeller(&self) -> Option<isize> {
            autoreleasepool(|_| Some(NSPasteboard::generalPasteboard().changeCount()))
        }

        fn tekst(&self) -> Indhold {
            autoreleasepool(|_| {
                let pb = NSPasteboard::generalPasteboard();
                // `accessBehavior` findes fra macOS 15.4; før det spørger macOS ikke ved programmatisk læsning.
                if objc2::available!(macos = 15.4) && pb.accessBehavior() != NSPasteboardAccessBehavior::AlwaysAllow {
                    return Indhold::MaaIkkeLaeses;
                }
                // SAFETY: `NSPasteboardTypeString` er en konstant `NSString`, som AppKit eksporterer og aldrig ændrer;
                // at læse en `extern static` er `unsafe`, fordi Rust ikke kan se, at den er initialiseret. AppKit er
                // linket (featuren `NSPasteboard`), og værdien er en gyldig, uforanderlig reference hele programmets tid.
                let type_ = unsafe { NSPasteboardTypeString };
                match pb.stringForType(type_) {
                    Some(s) => Indhold::Tekst(Zeroizing::new(s.to_string())),
                    None => Indhold::Ingen,
                }
            })
        }

        fn ryd(&self) {
            autoreleasepool(|_| {
                NSPasteboard::generalPasteboard().clearContents();
            });
        }
    }
}
