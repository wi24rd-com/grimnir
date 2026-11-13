//! Døren ved start (V-LAAS.2, ADR D7/D19; INVESTIGATION-V-LAAS.1 Q2, Q4, Q7, Q8).
//!
//! **Hvad døren er.** Når Grimnir starter, er programmet låst ([`crate::maskering::Tilstand`]). Døren spørger
//! styresystemet, om det er maskinens ejer, der sidder ved den: på macOS én dialog med Touch ID, hvor Mac'ens adgangskode
//! (og Apple Watch) er reserve (`LAPolicyDeviceOwnerAuthentication`). Lykkes det, låses Grimnir op, og nøglerne læses som
//! før. Der spørges én gang pr. start, ikke pr. sag.
//!
//! **Hvad døren ikke er.** Døren beskytter mod en person, der sætter sig ved en ulåst Mac og åbner Grimnir. Den beskytter
//! **ikke** nøglerne mod et andet program, der kører som brugeren: de ligger stadig i login-nøgleringen som før
//! (INVESTIGATION Q2), og døren ændrer intet ved dem. Den stærke udgave (nøglen bundet til fingeraftryk) kræver signering
//! med Developer ID og er en senere cyklus. Ingen tekst i programmet må love mere end dette.
//!
//! **Test.** Døren er et trait ([`Doer`]). Tests bruger [`HukommelsesDoer`], der svarer det, testen beder om, og rører
//! aldrig `LAContext`. Den rigtige udgave ([`platformens`]) prøves kun i Jans liste. På Windows svarer døren i denne
//! cyklus [`Svar::IkkeTilgaengelig`] (Hello bygges sammen med B4).
//!
//! **Fejlkoderne** fra `LAContext` oversættes til de fem svar i [`svar_for_kode`]. Ingen fejl indeholder brugerdata: kun
//! et tal eller en fast nøgle.

use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};

use serde::Serialize;

/// Dørens svar.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(tag = "svar", rename_all = "snake_case")]
pub enum Svar {
    /// Ejeren er bekræftet (fingeraftryk, adgangskode eller Apple Watch).
    Ok,
    /// Brugeren (eller systemet) annullerede dialogen.
    Annulleret,
    /// Bekræftelsen mislykkedes (forkert finger eller adgangskode for mange gange).
    Afvist,
    /// Maskinen kan ikke bekræfte, hvem brugeren er (ingen adgangskode på kontoen, eller platformen har ingen dør endnu).
    IkkeTilgaengelig {
        /// `ingen_adgangskode` | `platform`
        hvorfor: &'static str,
    },
    /// Noget andet gik galt. `kode` er fejlkoden fra styresystemet (ingen brugerdata).
    Fejl {
        /// Fejlkoden (`LAError` på macOS; 0, hvis der ingen kode var).
        kode: i64,
    },
}

/// Hvorfor døren spørges. Teksten i dialogen følger heraf.
///
/// V-LAAS.3 N1: `SlaaFra` ("Lås Grimnir ved start" fra) er fjernet sammen med indstillingen (ADR D20). Der er nu kun én
/// grund; enum'en bliver, så en senere grund ikke ændrer kaldene.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Grund {
    /// Grimnir er låst og skal låses op (ved start, eller når brugeren trykker "Lås op").
    Start,
}

/// V-LAAS.3 N2: hvorfor Grimnir låser igen ([`crate::maskering::laas_igen`]). De tre første er macOS' notifikationer
/// (`crate::notifikationer`); stilstand måles i skallen ([`crate::stilstand`]) og er fælles for alle platforme.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Udloeser {
    /// Maskinen går i dvale (`NSWorkspaceWillSleepNotification`).
    Dvale,
    /// Skærmene slukker (`NSWorkspaceScreensDidSleepNotification`).
    SkaermSlukket,
    /// Brugeren skifter til en anden bruger (`NSWorkspaceSessionDidResignActiveNotification`).
    Brugerskift,
    /// Ingen aktivitet i den valgte tid.
    Stilstand,
    /// V-OPBYG.1 N7: brugeren trykkede Lås i titellinjen.
    Bruger,
}

/// Teksterne til dialogen.
///
/// macOS sætter selv rammen om `aarsag`: `"Grimnir" forsøger at <aarsag>.` (dansk) og `"Grimnir" is trying to
/// <aarsag>.` (engelsk; Apples dokumentation af `localizedReason`). Derfor starter `aarsag` med et udsagnsord i
/// navnemåde og har intet punktum. Ordlyden, som den faktisk står i dialogen, måles i Jans liste.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Begrundelse {
    /// `localizedReason`.
    pub aarsag: &'static str,
    /// `localizedCancelTitle`.
    pub annuller: &'static str,
}

/// Teksterne til dialogen på UI'ets sprog (`da` | `en`; alt andet giver dansk, som UI'et).
pub fn begrundelse(grund: Grund, sprog: &str) -> Begrundelse {
    let en = sprog == "en";
    match (grund, en) {
        (Grund::Start, false) => Begrundelse {
            aarsag: "låse op for dine sager og din ordbog",
            annuller: "Annullér",
        },
        (Grund::Start, true) => Begrundelse {
            aarsag: "unlock your cases and your dictionary",
            annuller: "Cancel",
        },
    }
}

/// Døren. Den rigtige udgave er [`platformens`]; tests bruger [`HukommelsesDoer`].
///
/// `laas_op` venter på svaret og må derfor aldrig kaldes på hovedtråden (Tauri-kommandoen er `async`).
pub trait Doer: Send + Sync {
    /// Spørger, om det er maskinens ejer. Viser på macOS styresystemets dialog.
    fn laas_op(&self, grund: &Begrundelse) -> Svar;
}

impl<T: Doer + ?Sized> Doer for Arc<T> {
    fn laas_op(&self, grund: &Begrundelse) -> Svar {
        (**self).laas_op(grund)
    }
}

/// `LAError`-koderne (LocalAuthentication, `LAError.h`; samme tal i `objc2-local-authentication` 0.3.2,
/// `generated/LAError.rs`). Testen `koderne_er_lacontexts` (kun macOS) sammenligner dem med cratens konstanter.
pub mod kode {
    /// `LAErrorAuthenticationFailed`
    pub const AUTHENTICATION_FAILED: i64 = -1;
    /// `LAErrorUserCancel`
    pub const USER_CANCEL: i64 = -2;
    /// `LAErrorUserFallback`
    pub const USER_FALLBACK: i64 = -3;
    /// `LAErrorSystemCancel`
    pub const SYSTEM_CANCEL: i64 = -4;
    /// `LAErrorPasscodeNotSet`
    pub const PASSCODE_NOT_SET: i64 = -5;
    /// `LAErrorBiometryNotAvailable` (= `TouchIDNotAvailable`)
    pub const BIOMETRY_NOT_AVAILABLE: i64 = -6;
    /// `LAErrorBiometryNotEnrolled` (= `TouchIDNotEnrolled`)
    pub const BIOMETRY_NOT_ENROLLED: i64 = -7;
    /// `LAErrorBiometryLockout` (= `TouchIDLockout`)
    pub const BIOMETRY_LOCKOUT: i64 = -8;
    /// `LAErrorAppCancel`
    pub const APP_CANCEL: i64 = -9;
    /// `LAErrorInvalidContext`
    pub const INVALID_CONTEXT: i64 = -10;
    /// `LAErrorCompanionNotAvailable` (tidligere `WatchNotAvailable`)
    pub const WATCH_NOT_AVAILABLE: i64 = -11;
    /// `LAErrorBiometryNotPaired`
    pub const BIOMETRY_NOT_PAIRED: i64 = -12;
    /// `LAErrorBiometryDisconnected`
    pub const BIOMETRY_DISCONNECTED: i64 = -13;
    /// `LAErrorInvalidDimensions`
    pub const INVALID_DIMENSIONS: i64 = -14;
    /// `LAErrorNotInteractive`
    pub const NOT_INTERACTIVE: i64 = -1004;
}

/// Oversætter en `LAError`-kode (fra `LAErrorDomain`) til dørens svar.
///
/// - `UserCancel`, `SystemCancel`, `AppCancel`, `UserFallback` → [`Svar::Annulleret`] (der er ikke bekræftet; Grimnir
///   bliver låst). Med `deviceOwnerAuthentication` skifter "Brug adgangskode…" til adgangskoden i stedet for at afslutte,
///   så `UserFallback` bør ikke komme; kommer den alligevel, er det en annullering.
/// - `AuthenticationFailed`, `BiometryLockout` → [`Svar::Afvist`]. Med adgangskoden som reserve bør `BiometryLockout`
///   heller ikke komme (systemet spørger om adgangskoden i stedet).
/// - `PasscodeNotSet` → [`Svar::IkkeTilgaengelig`] (`ingen_adgangskode`): kontoen har ingen adgangskode, så maskinen
///   kan slet ikke bekræfte brugeren. **Kun** denne kode låser op uden bekræftelse.
/// - Alt andet → [`Svar::Fejl`] med koden; Grimnir bliver låst. Det gælder også `BiometryNotAvailable`,
///   `BiometryNotEnrolled`, `BiometryNotPaired` og `BiometryDisconnected`: adgangskoden er reserve, så manglende
///   fingeraftryk betyder ikke, at maskinen ikke kan bekræfte brugeren. `NotInteractive`, `InvalidContext`,
///   `WatchNotAvailable`, `InvalidDimensions` og ukendte koder er også [`Svar::Fejl`].
pub fn svar_for_kode(k: i64) -> Svar {
    match k {
        kode::USER_CANCEL | kode::SYSTEM_CANCEL | kode::APP_CANCEL | kode::USER_FALLBACK => Svar::Annulleret,
        kode::AUTHENTICATION_FAILED | kode::BIOMETRY_LOCKOUT => Svar::Afvist,
        kode::PASSCODE_NOT_SET => Svar::IkkeTilgaengelig {
            hvorfor: "ingen_adgangskode",
        },
        _ => Svar::Fejl { kode: k },
    }
}

/// En dør i hukommelsen til tests: svarer det, testen har sat, tæller kaldene og husker den seneste begrundelse. Rører
/// aldrig `LAContext`.
pub struct HukommelsesDoer {
    svar: Mutex<Svar>,
    kald: AtomicUsize,
    sidste: Mutex<Option<Begrundelse>>,
}

impl HukommelsesDoer {
    /// En dør, der svarer `svar`.
    pub fn ny(svar: Svar) -> Self {
        HukommelsesDoer {
            svar: Mutex::new(svar),
            kald: AtomicUsize::new(0),
            sidste: Mutex::new(None),
        }
    }

    /// Skifter svaret.
    pub fn svar(&self, svar: Svar) {
        *self.svar.lock().unwrap_or_else(|e| e.into_inner()) = svar;
    }

    /// Antal gange, døren er spurgt.
    pub fn kald(&self) -> usize {
        self.kald.load(Ordering::SeqCst)
    }

    /// Den seneste begrundelse.
    pub fn sidste(&self) -> Option<Begrundelse> {
        *self.sidste.lock().unwrap_or_else(|e| e.into_inner())
    }
}

impl Doer for HukommelsesDoer {
    fn laas_op(&self, grund: &Begrundelse) -> Svar {
        self.kald.fetch_add(1, Ordering::SeqCst);
        *self.sidste.lock().unwrap_or_else(|e| e.into_inner()) = Some(*grund);
        self.svar.lock().unwrap_or_else(|e| e.into_inner()).clone()
    }
}

/// En platform uden dør (i denne cyklus: alt andet end macOS). Svarer altid [`Svar::IkkeTilgaengelig`] (`platform`);
/// Grimnir starter så ulåst med et banner (L3).
pub struct IngenDoer;

impl Doer for IngenDoer {
    fn laas_op(&self, _grund: &Begrundelse) -> Svar {
        Svar::IkkeTilgaengelig { hvorfor: "platform" }
    }
}

/// Platformens dør: `LAContext` på macOS, [`IngenDoer`] ellers.
pub fn platformens() -> Arc<dyn Doer> {
    #[cfg(target_os = "macos")]
    {
        Arc::new(mac::MacDoer)
    }
    #[cfg(not(target_os = "macos"))]
    {
        Arc::new(IngenDoer)
    }
}

/// Døren på macOS: `LAContext.evaluatePolicy(.deviceOwnerAuthentication, localizedReason:reply:)`.
///
/// Alle kald i `objc2-local-authentication` er `unsafe` (bindinger til Objective-C); derfor er `unsafe` tilladt her og
/// kun her (`lib.rs` har `deny(unsafe_code)`). Hvert kald står med sin begrundelse.
#[cfg(target_os = "macos")]
#[allow(unsafe_code)]
mod mac {
    use std::sync::mpsc;

    use block2::RcBlock;
    use objc2::runtime::Bool;
    use objc2_foundation::{NSError, NSString};
    use objc2_local_authentication::{LAContext, LAErrorDomain, LAPolicy};

    use super::{svar_for_kode, Begrundelse, Doer, Svar};

    /// `LAContext` med `deviceOwnerAuthentication`.
    pub struct MacDoer;

    /// Svaret fra svarblokken. Kører på en privat kø i LocalAuthentication, ikke på hovedtråden.
    fn svar_af(ok: Bool, fejl: *mut NSError) -> Svar {
        if ok.as_bool() {
            return Svar::Ok;
        }
        // SAFETY: `fejl` er enten nul eller en gyldig `NSError`, som LocalAuthentication ejer, mens blokken kører
        // (svarblokkens kontrakt i `LAContext.h`). Den bruges kun inden for blokken.
        match unsafe { fejl.as_ref() } {
            None => Svar::Fejl { kode: 0 },
            Some(e) => {
                let kode = e.code() as i64;
                // SAFETY: `LAErrorDomain` er en konstant `NSString` i LocalAuthentication, der lever hele programmets tid.
                let la = unsafe { LAErrorDomain };
                if *e.domain() == *la {
                    svar_for_kode(kode)
                } else {
                    Svar::Fejl { kode }
                }
            }
        }
    }

    impl Doer for MacDoer {
        fn laas_op(&self, grund: &Begrundelse) -> Svar {
            let (tx, rx) = mpsc::channel::<Svar>();
            // SAFETY: `new` er `+[LAContext new]` uden forudsætninger.
            let ctx = unsafe { LAContext::new() };
            let annuller = NSString::from_str(grund.annuller);
            // SAFETY: en almindelig egenskab på en kontekst, vi ejer; strengen kopieres af LAContext.
            unsafe { ctx.setLocalizedCancelTitle(Some(&annuller)) };
            let aarsag = NSString::from_str(grund.aarsag);
            let blok = RcBlock::new(move |ok: Bool, fejl: *mut NSError| {
                // Kanalen kan være lukket, hvis den ventende tråd er væk; så er der ingen at svare.
                let _ = tx.send(svar_af(ok, fejl));
            });
            // SAFETY: `aarsag` er en ikke-tom streng (kravet i `LAContext.h`; ellers kastes NSInvalidArgumentException),
            // og blokken er "sendable": den fanger kun en `mpsc::Sender`, der er `Send + Sync`. Konteksten holdes i live
            // (`ctx`), til svaret er kommet.
            unsafe { ctx.evaluatePolicy_localizedReason_reply(LAPolicy::DeviceOwnerAuthentication, &aarsag, &blok) };
            // Venter på blokken. Kaldet sker aldrig på hovedtråden (kommandoen `laas_op` er `async`).
            let svar = rx.recv().unwrap_or(Svar::Fejl { kode: 0 });
            // SAFETY: `invalidate` på en kontekst, vi ejer; konteksten kasseres efter brug (L1).
            unsafe { ctx.invalidate() };
            svar
        }
    }

    #[cfg(test)]
    mod tests {
        use objc2_local_authentication::LAError;

        use super::super::kode;

        /// Tallene i [`kode`] er de samme som cratens `LAError`-konstanter. Kalder ikke `LAContext`.
        #[test]
        fn koderne_er_lacontexts() {
            let par = [
                (kode::AUTHENTICATION_FAILED, LAError::AuthenticationFailed),
                (kode::USER_CANCEL, LAError::UserCancel),
                (kode::USER_FALLBACK, LAError::UserFallback),
                (kode::SYSTEM_CANCEL, LAError::SystemCancel),
                (kode::PASSCODE_NOT_SET, LAError::PasscodeNotSet),
                (kode::BIOMETRY_NOT_AVAILABLE, LAError::BiometryNotAvailable),
                (kode::BIOMETRY_NOT_ENROLLED, LAError::BiometryNotEnrolled),
                (kode::BIOMETRY_LOCKOUT, LAError::BiometryLockout),
                (kode::APP_CANCEL, LAError::AppCancel),
                (kode::INVALID_CONTEXT, LAError::InvalidContext),
                (kode::WATCH_NOT_AVAILABLE, LAError::CompanionNotAvailable),
                (kode::BIOMETRY_NOT_PAIRED, LAError::BiometryNotPaired),
                (kode::BIOMETRY_DISCONNECTED, LAError::BiometryDisconnected),
                (kode::INVALID_DIMENSIONS, LAError::InvalidDimensions),
                (kode::NOT_INTERACTIVE, LAError::NotInteractive),
            ];
            for (vores, deres) in par {
                assert_eq!(vores, deres.0 as i64, "{deres:?}");
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn kun_ingen_adgangskode_laaser_op_uden_bekraeftelse() {
        let ikke = (-1100..=10).filter(|k| matches!(svar_for_kode(*k), Svar::IkkeTilgaengelig { .. }));
        assert_eq!(ikke.collect::<Vec<_>>(), vec![kode::PASSCODE_NOT_SET]);
        assert_eq!(
            svar_for_kode(kode::PASSCODE_NOT_SET),
            Svar::IkkeTilgaengelig {
                hvorfor: "ingen_adgangskode"
            }
        );
        // Adgangskoden er reserve: manglende eller ulæst fingeraftryk er ikke "ikke tilgængelig".
        for k in [
            kode::BIOMETRY_NOT_AVAILABLE,
            kode::BIOMETRY_NOT_ENROLLED,
            kode::BIOMETRY_NOT_PAIRED,
            kode::BIOMETRY_DISCONNECTED,
        ] {
            assert_eq!(svar_for_kode(k), Svar::Fejl { kode: k });
        }
    }

    #[test]
    fn koderne_giver_de_fem_svar() {
        for k in [kode::USER_CANCEL, kode::SYSTEM_CANCEL, kode::APP_CANCEL, kode::USER_FALLBACK] {
            assert_eq!(svar_for_kode(k), Svar::Annulleret, "{k}");
        }
        for k in [kode::AUTHENTICATION_FAILED, kode::BIOMETRY_LOCKOUT] {
            assert_eq!(svar_for_kode(k), Svar::Afvist, "{k}");
        }
        for k in [
            kode::INVALID_CONTEXT,
            kode::WATCH_NOT_AVAILABLE,
            kode::INVALID_DIMENSIONS,
            kode::NOT_INTERACTIVE,
            -999,
            0,
            1,
        ] {
            assert_eq!(svar_for_kode(k), Svar::Fejl { kode: k }, "{k}");
        }
    }

    #[test]
    fn begrundelsen_passer_i_rammen_og_lover_ikke_for_meget() {
        for sprog in ["da", "en"] {
            for g in [Grund::Start] {
                let b = begrundelse(g, sprog);
                assert!(!b.aarsag.is_empty() && !b.annuller.is_empty());
                // Rammen er macOS': "Grimnir" forsøger at <aarsag>. Ingen stort begyndelsesbogstav, intet punktum.
                assert!(b.aarsag.chars().next().is_some_and(char::is_lowercase), "{}", b.aarsag);
                assert!(!b.aarsag.ends_with('.'), "{}", b.aarsag);
                for ord in ["beskyt", "protect", "sikker", "secure", "krypter", "encrypt"] {
                    assert!(!b.aarsag.to_lowercase().contains(ord), "{} lover for meget", b.aarsag);
                }
            }
        }
        assert_eq!(begrundelse(Grund::Start, "da").aarsag, "låse op for dine sager og din ordbog");
        assert_eq!(begrundelse(Grund::Start, "en").aarsag, "unlock your cases and your dictionary");
        assert_eq!(begrundelse(Grund::Start, "xx"), begrundelse(Grund::Start, "da"));
        assert_eq!(begrundelse(Grund::Start, "en").annuller, "Cancel");
    }

    #[test]
    fn svarene_som_json_uden_indhold() {
        let j = |s: Svar| serde_json::to_string(&s).unwrap();
        assert_eq!(j(Svar::Ok), r#"{"svar":"ok"}"#);
        assert_eq!(j(Svar::Annulleret), r#"{"svar":"annulleret"}"#);
        assert_eq!(j(Svar::Afvist), r#"{"svar":"afvist"}"#);
        assert_eq!(
            j(Svar::IkkeTilgaengelig { hvorfor: "platform" }),
            r#"{"svar":"ikke_tilgaengelig","hvorfor":"platform"}"#
        );
        assert_eq!(j(Svar::Fejl { kode: -10 }), r#"{"svar":"fejl","kode":-10}"#);
    }

    #[test]
    fn hukommelsesdoeren_taeller_og_husker() {
        let d = HukommelsesDoer::ny(Svar::Afvist);
        assert_eq!(d.kald(), 0);
        let b = begrundelse(Grund::Start, "da");
        assert_eq!(d.laas_op(&b), Svar::Afvist);
        d.svar(Svar::Ok);
        assert_eq!(d.laas_op(&b), Svar::Ok);
        assert_eq!((d.kald(), d.sidste()), (2, Some(b)));
        assert_eq!(IngenDoer.laas_op(&b), Svar::IkkeTilgaengelig { hvorfor: "platform" });
    }
}
