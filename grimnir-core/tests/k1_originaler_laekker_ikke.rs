//! K1: originaler lækker ikke i fejl, panikbeskeder eller `Debug`-udskrifter.

mod faelles;

use std::panic;
use std::sync::{Arc, Mutex};

use faelles::{kaede, ordbog};
use grimnir_core::{analyser, demasker, foreslaa, masker, Erstatning, Fejl, Original, Sag, SagData};

const TEKST: &str = "hostname=srv-068.intern.eksempel.dk user=bruger022 password=Sommer2026! ip=10.20.30.1 KONTOR\\bruger022";
const FACIT: [&str; 6] = ["srv-068", "intern.eksempel.dk", "bruger022", "Sommer2026!", "10.20.30.1", "KONTOR"];

fn ingen_facit(udskrift: &str) {
    for f in FACIT {
        assert!(!udskrift.contains(f), "en original står i udskriften");
    }
}

#[test]
fn debug_af_alle_typer_uden_originaler() {
    let o = ordbog();
    let mut sag = Sag::default();
    let k = kaede(TEKST, &o, &mut sag);
    let e = foreslaa(&k.fund, TEKST, &mut sag);
    let mut udskrift = format!("{:?}{:?}{:?}{:?}{:?}", k.fund, e, k.rester, k.advarsler, sag);
    let (_, adv) = demasker("198.18.0.77 h0099", &sag);
    udskrift.push_str(&format!("{adv:?}"));
    ingen_facit(&udskrift);
    assert!(udskrift.contains("<skjult>"));
}

#[test]
fn hver_fejltype_uden_originaler() {
    let o = ordbog();
    let mut sag = Sag::default();
    let fund = analyser(TEKST, &o);
    let e = foreslaa(&fund, TEKST, &mut sag);
    let kode = e
        .iter()
        .find(|x| x.original.som_tekst() == "srv-068")
        .map(|x| x.kode.clone())
        .expect("værten har en kode");
    let andre = e
        .iter()
        .find(|x| x.original.som_tekst() == "bruger022")
        .map(|x| x.kode.clone())
        .expect("brugeren har en kode");

    let mut fejl: Vec<Fejl> = vec![
        sag.ret(&kode, &andre, TEKST).expect_err("kollision med sagens kode"),
        sag.ret(&kode, "hostname", TEKST).expect_err("kollision med teksten"),
        sag.ret("h9999", "ny", TEKST).expect_err("ukendt kode"),
        sag.ret(&kode, "-ny-", TEKST).expect_err("ugyldig kode"),
    ];
    let mut o2 = o.clone();
    o2.net.push("ikke et net".into());
    fejl.push(o2.valider().expect_err("ugyldigt net"));
    let mut data: SagData = sag.data().clone();
    data.poster[0].enhed = 9999;
    fejl.push(Sag::fra_data(data).expect_err("beskadigede data"));

    let mut udskrift = String::new();
    for f in &fejl {
        udskrift.push_str(&format!("{f} | {f:?}\n"));
    }
    assert!(matches!(fejl[0], Fejl::KodeKolliderer { .. }));
    assert!(matches!(fejl[1], Fejl::KodeKolliderer { .. }));
    assert!(matches!(fejl[2], Fejl::UkendtKode { .. }));
    assert!(matches!(fejl[3], Fejl::UgyldigKode { .. }));
    assert!(matches!(fejl[4], Fejl::UgyldigtNet { .. }));
    assert!(matches!(fejl[5], Fejl::UgyldigeSagsdata { .. }));
    ingen_facit(&udskrift);
}

#[test]
fn panik_uden_originaler() {
    let o = ordbog();
    let mut sag = Sag::default();
    let fund = analyser(TEKST, &o);
    let mut e: Vec<Erstatning> = foreslaa(&fund, TEKST, &mut sag);
    // To overlappende erstatninger og en, der ikke passer til teksten
    let mut forkert = e[0].clone();
    forkert.slut += 2;
    e.push(forkert);

    let besked = Arc::new(Mutex::new(String::new()));
    let b2 = Arc::clone(&besked);
    let gammel = panic::take_hook();
    panic::set_hook(Box::new(move |info| {
        if let Ok(mut b) = b2.lock() {
            b.push_str(&info.to_string());
        }
    }));
    let resultat = panic::catch_unwind(|| masker(TEKST, &e));
    let mut forkert_original = foreslaa(&fund, TEKST, &mut sag);
    forkert_original[0].original = Original::ny("srv-068.intern.eksempel.dk!");
    let resultat2 = panic::catch_unwind(|| masker(TEKST, &forkert_original));
    panic::set_hook(gammel);

    assert!(resultat.is_err() && resultat2.is_err(), "masker skal gå i panik");
    let besked = besked.lock().map(|b| b.clone()).unwrap_or_default();
    assert!(besked.contains("erstatning nr."), "panikbeskeden blev ikke fanget");
    ingen_facit(&besked);
}
