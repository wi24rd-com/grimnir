//! V-KVIT.1: kvitteringen for en maskering. En kort, ren tekst, der siger, hvad der blev maskeret, uden en eneste
//! original værdi; den kan sættes ind sammen med den maskerede log som dokumentation for, hvad der blev delt.
//!
//! Teksten bygges her i Rust ud fra tallene fra den maskering, der lige er gennemført ([`Tal`]; de regnes ud i
//! [`crate::maskering`]), ikke i webvisningen. [`Tal`] har kun tal og typenøgler: ingen original, intet alias, ingen
//! kode, ingen erstatning, ingen sti og intet filnavn kan komme ind i teksten, fordi de ikke findes i det, teksten
//! bygges af. Det eneste fra brugeren er sagens navn (brugerens eget; det tages med).
//!
//! **Filnavnet er udeladt.** Et filnavn kan røbe noget (et servernavn, en kunde, en dato), og det kan være netop en af
//! de værdier, der blev maskeret i filen. Kvitteringen skriver derfor kun, at kilden var en fil, og tekstens størrelse.
//!
//! Typenavnene er de samme som i fundtabellen (`art_*` i `ui/assets/sprog.js`); testen `kvit1.rs` holder de to lister
//! ens. "Værdier" er rækker i fundtabellen (én enhed pr. række), "steder" er forekomster i teksten.

use crate::klokke;

/// Én type i kvitteringen: nøglen (som `art` i fundtabellen), antal forskellige værdier (rækker) og antal steder.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct TypeTal {
    /// Fundets art (`ipv4_egen`, `vaert` …).
    pub art: &'static str,
    /// Antal forskellige værdier (rækker i fundtabellen), der blev maskeret.
    pub vaerdier: usize,
    /// Antal steder i teksten, der blev erstattet.
    pub steder: usize,
}

/// Tallene fra én maskering. Kun tal og typenøgler.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Tal {
    /// Tidspunktet for maskeringen: millisekunder siden 1970 (UTC).
    pub ms: u64,
    /// Den lokale tidszones forskel fra UTC i sekunder på det tidspunkt.
    pub forskel: i32,
    /// Antal linjer i den maskerede tekst.
    pub linjer: usize,
    /// Antal tegn i den maskerede tekst.
    pub tegn: usize,
    /// De maskerede typer i fundtabellens typeorden ([`ARTER`]); typer uden maskerede fund er ikke med.
    pub typer: Vec<TypeTal>,
    /// Antal rester fra lækagetjekket.
    pub rester: usize,
    /// Fund, kernen foreslog maskeret, og som brugeren valgte fra.
    pub fravalgt: usize,
    /// Fund, kernen ikke foreslog maskeret (Tjek selv, version, offentlige adresser), og som ikke blev slået til.
    pub ikke_foreslaaet: usize,
    /// Forskellige værdier på "Maskér aldrig", som analysen mødte i teksten.
    pub aldrig: usize,
    /// V-MANUEL.1: af de maskerede værdier dem, brugeren selv tilføjede ("Maskér dette"): antal værdier (rækker) …
    pub tilfoejet_vaerdier: usize,
    /// … og antal steder.
    pub tilfoejet_steder: usize,
}

/// Hvor teksten kom fra.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Kilde {
    /// Indsat tekst.
    Tekst,
    /// En fil (navnet tages ikke med).
    Fil,
}

/// Typerne i den rækkefølge, kvitteringen viser dem: nøglen, dansk og engelsk navn (som `art_*` i `sprog.js`).
pub const ARTER: [(&str, &str, &str); 19] = [
    ("ipv4_egen", "IPv4, eget net", "IPv4, own network"),
    ("ipv4_fremmed", "IPv4, offentlig", "IPv4, public"),
    ("ipv6_egen", "IPv6, eget net", "IPv6, own network"),
    ("ipv6_fremmed", "IPv6, offentlig", "IPv6, public"),
    ("mac", "MAC-adresse", "MAC address"),
    ("vaert", "Maskine", "Machine"),
    ("domaene", "Domæne", "Domain"),
    ("netbios", "NetBIOS-domæne", "NetBIOS domain"),
    ("bruger", "Bruger", "User"),
    ("person", "Person", "Person"),
    ("database", "Database", "Database"),
    ("ord", "Ord", "Word"),
    ("hemmelighed", "Hemmelighed", "Secret"),
    ("sid", "SID", "SID"),
    ("guid", "GUID", "GUID"),
    ("serienummer", "Serienummer", "Serial number"),
    ("cpr", "CPR-nummer", "CPR number"),
    ("entropi", "Lang tilfældig streng", "Long random string"),
    ("ligner_kode", "Ligner en kode", "Looks like a code"),
];

/// Typens plads i [`ARTER`] (ukendte sidst).
pub fn plads(art: &str) -> usize {
    ARTER.iter().position(|a| a.0 == art).unwrap_or(ARTER.len())
}

fn type_navn(art: &'static str, engelsk: bool) -> &'static str {
    ARTER.iter().find(|a| a.0 == art).map_or(art, |a| if engelsk { a.2 } else { a.1 })
}

/// UTC-forskellen som `+01:00`.
fn forskel_tekst(forskel: i32) -> String {
    let min = forskel.unsigned_abs() / 60;
    format!("{}{:02}:{:02}", if forskel < 0 { '-' } else { '+' }, min / 60, min % 60)
}

/// `n ental` eller `n flertal`.
fn antal(n: usize, ental: &str, flertal: &str) -> String {
    format!("{n} {}", if n == 1 { ental } else { flertal })
}

/// Kvitteringen som ren tekst (linjeskift LF) på dansk eller engelsk. `sag`: den navngivne sags navn (`None`:
/// midlertidig sag).
pub fn tekst(tal: &Tal, sag: Option<&str>, kilde: Kilde, engelsk: bool) -> String {
    let en = engelsk;
    let v = |n| {
        if en {
            antal(n, "value", "values")
        } else {
            antal(n, "værdi", "værdier")
        }
    };
    let s = |n| {
        if en {
            antal(n, "place", "places")
        } else {
            antal(n, "sted", "steder")
        }
    };
    let mut ud = String::new();
    let mut linje = |l: String| {
        ud.push_str(&l);
        ud.push('\n');
    };
    linje(
        if en {
            "Wi24rd Grimnir — receipt"
        } else {
            "Wi24rd Grimnir — kvittering"
        }
        .to_string(),
    );
    linje(format!("Version {}", grimnir_core::VERSION));
    linje(String::new());
    linje(format!(
        "{}: {} (UTC{})",
        if en { "Masked" } else { "Maskeret" },
        klokke::lokal(tal.ms, tal.forskel).tekst(),
        forskel_tekst(tal.forskel)
    ));
    linje(format!(
        "{}: {}",
        if en { "Case" } else { "Sag" },
        sag.unwrap_or(if en { "Temporary case" } else { "Midlertidig sag" })
    ));
    linje(format!(
        "{}: {}",
        if en { "Source" } else { "Kilde" },
        match (kilde, en) {
            (Kilde::Tekst, false) => "indsat tekst",
            (Kilde::Tekst, true) => "pasted text",
            (Kilde::Fil, false) => "fil",
            (Kilde::Fil, true) => "file",
        }
    ));
    linje(if en {
        format!(
            "Masked text: {}, {}",
            antal(tal.linjer, "line", "lines"),
            antal(tal.tegn, "character", "characters")
        )
    } else {
        format!("Maskeret tekst: {}, {} tegn", antal(tal.linjer, "linje", "linjer"), tal.tegn)
    });
    linje(String::new());
    linje(if en { "Masked values" } else { "Maskerede værdier" }.to_string());
    for t in &tal.typer {
        linje(format!("- {}: {}, {}", type_navn(t.art, en), v(t.vaerdier), s(t.steder)));
    }
    linje(format!(
        "- {}: {}, {}",
        if en { "Total" } else { "I alt" },
        v(tal.typer.iter().map(|t| t.vaerdier).sum()),
        s(tal.typer.iter().map(|t| t.steder).sum())
    ));
    // V-MANUEL.1: kun når brugeren selv har tilføjet værdier (så kvitteringen er uændret uden dem).
    if tal.tilfoejet_vaerdier > 0 {
        linje(format!(
            "- {}: {}, {}",
            if en {
                "Of which added by the user"
            } else {
                "Heraf tilføjet af brugeren"
            },
            v(tal.tilfoejet_vaerdier),
            s(tal.tilfoejet_steder)
        ));
    }
    linje(String::new());
    linje(if en {
        format!("Leak check: {} found", antal(tal.rester, "leftover", "leftovers"))
    } else {
        format!("Lækagetjek: {} fundet", antal(tal.rester, "rest", "rester"))
    });
    linje(String::new());
    linje(if en { "Deliberately not masked" } else { "Ikke maskeret med vilje" }.to_string());
    linje(format!(
        "- {}: {}",
        if en {
            "Findings the user deselected"
        } else {
            "Fund, brugeren valgte fra"
        },
        tal.fravalgt
    ));
    linje(format!(
        "- {}: {}",
        if en {
            "Findings Grimnir did not suggest and that were not turned on"
        } else {
            "Fund, Grimnir ikke foreslog, og som ikke blev slået til"
        },
        tal.ikke_foreslaaet
    ));
    linje(format!(
        "- {}: {}",
        if en {
            "Values on Never mask that were met"
        } else {
            "Værdier på Maskér aldrig, der blev mødt"
        },
        tal.aldrig
    ));
    linje(String::new());
    linje(
        if en {
            "This receipt contains no original values."
        } else {
            "Denne kvittering indeholder ingen originale værdier."
        }
        .to_string(),
    );
    ud
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn utc_forskellen() {
        assert_eq!(forskel_tekst(3600), "+01:00");
        assert_eq!(forskel_tekst(7200), "+02:00");
        assert_eq!(forskel_tekst(0), "+00:00");
        assert_eq!(forskel_tekst(-12_600), "-03:30");
        assert_eq!(forskel_tekst(20_700), "+05:45");
    }

    #[test]
    fn ental_og_flertal_og_ingen_typer() {
        let tal = Tal {
            ms: 1_794_384_330_000,
            forskel: 3600,
            linjer: 1,
            tegn: 1,
            typer: vec![TypeTal {
                art: "vaert",
                vaerdier: 1,
                steder: 1,
            }],
            rester: 1,
            fravalgt: 0,
            ikke_foreslaaet: 0,
            aldrig: 0,
            tilfoejet_vaerdier: 0,
            tilfoejet_steder: 0,
        };
        let da = tekst(&tal, None, Kilde::Tekst, false);
        assert!(da.contains("Maskeret tekst: 1 linje, 1 tegn\n"), "{da}");
        assert!(da.contains("- Maskine: 1 værdi, 1 sted\n- I alt: 1 værdi, 1 sted\n"), "{da}");
        assert!(da.contains("Lækagetjek: 1 rest fundet\n"), "{da}");
        let en = tekst(&tal, None, Kilde::Fil, true);
        assert!(en.contains("Masked text: 1 line, 1 character\n"), "{en}");
        assert!(en.contains("- Machine: 1 value, 1 place\n- Total: 1 value, 1 place\n"), "{en}");
        assert!(en.contains("Leak check: 1 leftover found\n"), "{en}");
        let tom = Tal { typer: Vec::new(), ..tal };
        assert!(tekst(&tom, None, Kilde::Tekst, false).contains("Maskerede værdier\n- I alt: 0 værdier, 0 steder\n"));
    }
}
