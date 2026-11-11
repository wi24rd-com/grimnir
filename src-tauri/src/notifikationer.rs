//! Udløserne på macOS (V-LAAS.3 N2): Grimnir låser igen, når maskinen går i dvale, når skærmene slukker, og når brugeren
//! skifter til en anden bruger. Kun macOS; på Windows bygges udløserne med Windows-udgaven.
//!
//! Tre notifikationer fra `NSWorkspace.sharedWorkspace.notificationCenter` (AppKit `NSWorkspace.h`; i
//! `objc2-app-kit` 0.3.2 `src/generated/NSWorkspace.rs`):
//! - `NSWorkspaceWillSleepNotification` → [`Udloeser::Dvale`]
//! - `NSWorkspaceScreensDidSleepNotification` → [`Udloeser::SkaermSlukket`]
//! - `NSWorkspaceSessionDidResignActiveNotification` → [`Udloeser::Brugerskift`]
//!
//! De registreres ét sted ([`registrer`]), og koden bag dem er den samme for alle tre: kalderens funktion, som i
//! `lib.rs` er `laas_igen_og_meld` ([`crate::maskering::laas_igen`] + hændelsen `laast`). Derfor kan låsen testes uden
//! notifikationer.
//!
//! En offentlig notifikation for, at skærmen *låses* uden at slukke, findes ikke i `NSWorkspace.h` eller i
//! `objc2-app-kit` 0.3.2 (se HANDOFF-V-LAAS.3).
//!
//! Alle kald er `unsafe` (bindinger til Objective-C); derfor er `unsafe` tilladt her og i `laas::mac`, og ingen andre
//! steder (testen `unsafe_kun_i_laas_og_notifikationer`). Hvert kald står med sin begrundelse.
#![allow(unsafe_code)]

use std::ptr::NonNull;
use std::sync::Arc;

use block2::RcBlock;
use objc2_app_kit::{
    NSWorkspace, NSWorkspaceScreensDidSleepNotification, NSWorkspaceSessionDidResignActiveNotification, NSWorkspaceWillSleepNotification,
};
use objc2_foundation::{NSNotification, NSNotificationName};

use crate::laas::Udloeser;

/// Registrerer de tre observatører. `paa` kaldes på den tråd, der sender notifikationen (hovedtråden), og skal selv
/// flytte langsomt arbejde væk. Kaldes én gang ved start; observatørerne lever, så længe programmet kører.
pub fn registrer(paa: impl Fn(Udloeser) + Send + Sync + 'static) {
    let paa: Arc<dyn Fn(Udloeser) + Send + Sync> = Arc::new(paa);
    let center = NSWorkspace::sharedWorkspace().notificationCenter();
    // SAFETY: tre konstante `NSString`'er i AppKit, der lever hele programmets tid (`extern "C" static`).
    let navne: [(&NSNotificationName, Udloeser); 3] = unsafe {
        [
            (NSWorkspaceWillSleepNotification, Udloeser::Dvale),
            (NSWorkspaceScreensDidSleepNotification, Udloeser::SkaermSlukket),
            (NSWorkspaceSessionDidResignActiveNotification, Udloeser::Brugerskift),
        ]
    };
    for (navn, grund) in navne {
        let paa = paa.clone();
        let blok = RcBlock::new(move |_n: NonNull<NSNotification>| paa(grund));
        // SAFETY: `obj` er `None` (alle afsendere), og `queue` er `None`: blokken kører på den tråd, der sender
        // notifikationen; der er ingen særlige krav til tråden. Blokken er "sendable": den fanger kun en
        // `Arc<dyn Fn + Send + Sync>`. Centret kopierer blokken.
        let observatoer = unsafe { center.addObserverForName_object_queue_usingBlock(Some(navn), None, None, &blok) };
        // Observatøren skal leve, så længe programmet kører; den fjernes aldrig. Uden en reference fra os kunne den
        // blive frigivet, og så kom notifikationen ikke. Derfor glemmes den bevidst (ingen `Drop`, ingen frigivelse).
        std::mem::forget(observatoer);
    }
}
