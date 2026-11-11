//! # grimnir-core
//!
//! Kernen i Wi24rd Grimnir: finder følsomme værdier i logs og scripts, foreslår erstatninger,
//! maskerer, lækagetjekker og demaskerer med bytepræcis rundtur.
//!
//! Ingen skal, intet udseende, ingen filer, intet netværk og ingen ure. Afhængigheder: kun `regex`
//! og `aho-corasick`.
//!
//! ```
//! use grimnir_core::{analyser, demasker, foreslaa, laekagetjek, masker, Ordbog, Sag};
//!
//! let mut ordbog = Ordbog::ny();
//! ordbog.domaener.push("kontor.test".into());
//! let tekst = "ssh bruger022@srv-068.kontor.test fra 10.20.30.1";
//! let mut sag = Sag::default();
//! let fund = analyser(tekst, &ordbog);
//! let erstatninger = foreslaa(&fund, tekst, &mut sag);
//! let maskeret = masker(tekst, &erstatninger);
//! assert!(laekagetjek(&maskeret, &sag, &ordbog).is_empty());
//! let (tilbage, _) = demasker(&maskeret, &sag);
//! assert_eq!(tilbage, tekst);
//! ```
#![deny(missing_docs)]
#![forbid(unsafe_code)]

/// Kernens versionsnummer (`version` i `grimnir-core/Cargo.toml`, sat af Cargo ved oversættelsen).
pub const VERSION: &str = env!("CARGO_PKG_VERSION");

mod analyse;
mod demasker;
mod foreslaa;
mod graense;
mod kodeform;
mod laekage;
mod net;
mod ordbog;
mod original;
mod sag;
mod typer;

pub use analyse::analyser;
pub use demasker::{demasker, demasker_med_steder, SatTilbage};
pub use foreslaa::{foreslaa, foreslaa_med_ordbog, masker};
pub use graense::{graense_efter, graense_foer, ved_graense, Moenster};
pub use laekage::laekagetjek;
pub use ordbog::Ordbog;
pub use original::Original;
pub use sag::{Enhed, Post, Sag, SagData, Taellere, Valg, FORM_ALENE, FORM_DEL, FORM_ESC2, FORM_PROCENT};
pub use typer::{
    Advarsel, AdvarselArt, AfledtArt, Art, Erstatning, Fejl, Fund, Klasse, Pulje, Rest, RestArt, Sammensat, Sikkerhed, KLASSER,
};
