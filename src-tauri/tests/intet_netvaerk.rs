//! S5: "ingen netværkskode" for skallen (AGENTS.md, ADR-001 Konsekvenser). Kernens egen test står i
//! `grimnir-core/tests/k6_intet_netvaerk.rs`; denne udvider den til `src-tauri` (pakken `grimnir`) og til `ui/`.

use std::collections::BTreeSet;
use std::path::{Path, PathBuf};
use std::process::Command;

fn cargo_tree(args: &[&str]) -> Vec<String> {
    let cargo = std::env::var("CARGO").unwrap_or_else(|_| "cargo".into());
    let ud = Command::new(cargo)
        .args(["tree", "--offline", "-e", "normal", "--prefix", "none"])
        .args(args)
        .current_dir(env!("CARGO_MANIFEST_DIR"))
        .output()
        .expect("cargo tree kan ikke køres");
    assert!(ud.status.success(), "cargo tree fejlede: {}", String::from_utf8_lossy(&ud.stderr));
    String::from_utf8_lossy(&ud.stdout).lines().map(str::to_string).collect()
}

fn navne(linjer: &[String]) -> BTreeSet<String> {
    linjer
        .iter()
        .filter_map(|l| l.split_whitespace().next())
        .map(str::to_string)
        .collect()
}

/// De platforme, Grimnir udgives til (macOS og Windows). `cargo tree` viser ellers kun værtens træ. tauri 2.12.5 trækker
/// `reqwest` ind på Android/iOS og `soup3` (WebKitGTK) på Linux; ingen af dem er Grimnirs platforme (HANDOFF-V-SKAL.1, S5).
const MAAL: [&str; 4] = [
    "aarch64-apple-darwin",
    "x86_64-apple-darwin",
    "x86_64-pc-windows-msvc",
    "aarch64-pc-windows-msvc",
];

#[test]
fn skallens_afhaengighedstrae_har_ingen_netvaerkscrates_og_ingen_plugins() {
    for maal in MAAL {
        tjek_trae(maal);
    }
}

fn tjek_trae(maal: &str) {
    let trae = navne(&cargo_tree(&["-p", "grimnir", "--target", maal, "--format", "{p}"]));
    assert!(trae.len() > 50, "{maal}: træet er mistænkeligt lille: {}", trae.len());
    assert!(
        trae.contains("tauri") && trae.contains("grimnir-core"),
        "{maal}: tauri og grimnir-core skal være i træet"
    );
    const FORBUDT: [&str; 15] = [
        "soup3",
        "tokio-rustls",
        "reqwest",
        "hyper",
        "hyper-util",
        "h2",
        "mio",
        "socket2",
        "ureq",
        "curl",
        "tungstenite",
        "quinn",
        "native-tls",
        "hickory-resolver",
        "rustls",
    ];
    for f in FORBUDT {
        assert!(!trae.contains(f), "{maal}: forbudt crate i træet: {f}");
    }
    let plugins: Vec<&String> = trae.iter().filter(|c| c.starts_with("tauri-plugin")).collect();
    assert!(plugins.is_empty(), "{maal}: plugins i træet: {plugins:?}");
}

#[test]
fn tokio_er_uden_net() {
    // Første linje er "tokio v1.x <features>"; `-e features` viser desuden hver feature som "tokio feature \"net\"".
    for maal in MAAL {
        let linjer = cargo_tree(&[
            "-p", "grimnir", "--target", maal, "-e", "features", "-i", "tokio", "--format", "{p} {f}",
        ]);
        let features: Vec<&str> = linjer
            .first()
            .and_then(|l| l.split_whitespace().nth(2))
            .map(|f| f.split(',').collect())
            .unwrap_or_default();
        let alle = linjer.join("\n");
        for f in ["net", "full", "process", "signal"] {
            assert!(!features.contains(&f), "{maal}: tokio har featuren {f}: {features:?}");
            assert!(!alle.contains(&format!("tokio feature \"{f}\"")), "{maal}: tokio har featuren {f}");
        }
    }
}

fn filer(mappe: &Path, endelser: &[&str], ud: &mut Vec<PathBuf>) {
    for e in std::fs::read_dir(mappe).expect("mappen kan læses").flatten() {
        let p = e.path();
        if p.is_dir() {
            filer(&p, endelser, ud);
        } else if p.extension().and_then(|x| x.to_str()).is_some_and(|x| endelser.contains(&x)) {
            ud.push(p);
        }
    }
}

#[test]
fn skallens_kildekode_naevner_ikke_netvaerk() {
    let mut rs = Vec::new();
    filer(&PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("src"), &["rs"], &mut rs);
    assert!(rs.len() >= 2, "for få kildefiler: {}", rs.len());
    for f in &rs {
        let indhold = std::fs::read_to_string(f).expect("kildefil kan læses");
        for ord in ["TcpStream", "TcpListener", "UdpSocket", "std::net", "http://", "https://"] {
            assert!(!indhold.contains(ord), "{} nævner {ord}", f.display());
        }
    }
}

/// Fjernadresser i `src`, `href` og `url(`: http://, https:// og protokol-relative //. (CSP'ens http://ipc.localhost står
/// i tauri.conf.json, ikke i ui/.)
fn fjernadresser(tekst: &str) -> Vec<String> {
    let mut fund = Vec::new();
    let lille = tekst.to_ascii_lowercase();
    for (aabner, luk) in [("src=", None), ("href=", None), ("url(", Some(')'))] {
        let mut fra = 0;
        while let Some(i) = lille[fra..].find(aabner) {
            let start = fra + i + aabner.len();
            let rest = lille[start..].trim_start_matches([' ', '"', '\'']);
            if rest.starts_with("http://") || rest.starts_with("https://") || rest.starts_with("//") {
                let slut = rest
                    .find(|c: char| c.is_whitespace() || c == '"' || c == '\'' || Some(c) == luk)
                    .unwrap_or(rest.len());
                fund.push(rest[..slut].to_string());
            }
            fra = start;
        }
    }
    fund
}

#[test]
fn fjernadresse_genkenderen_virker() {
    assert_eq!(
        fjernadresser("<link href=\"https://eksempel.dk/a.css\">"),
        ["https://eksempel.dk/a.css"]
    );
    assert_eq!(fjernadresser("x{background:url( //eksempel.dk/b.png )}"), ["//eksempel.dk/b.png"]);
    assert_eq!(
        fjernadresser("<script src='http://eksempel.dk/c.js'></script>"),
        ["http://eksempel.dk/c.js"]
    );
    assert!(fjernadresser("<script src=\"assets/kit.js\"></script> url(fonts/inter.woff2)").is_empty());
}

#[test]
fn ui_har_ingen_fjernadresser() {
    let ui = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../ui");
    let mut alle = Vec::new();
    filer(&ui, &["html", "css", "js"], &mut alle);
    assert!(alle.len() >= 6, "for få filer i ui/: {}", alle.len());
    for f in &alle {
        let fund = fjernadresser(&std::fs::read_to_string(f).expect("ui-fil kan læses"));
        assert!(fund.is_empty(), "{} henter udefra: {fund:?}", f.display());
    }
}

#[test]
fn kontrol_testen_ser_netvaerkscrates_hvor_de_findes() {
    // Negativ kontrol: på Android trækker tauri reqwest ind (tauri 2.12.5, Cargo.toml). Ser testen det ikke dér, er den blind.
    let android = navne(&cargo_tree(&[
        "-p",
        "grimnir",
        "--target",
        "aarch64-linux-android",
        "--format",
        "{p}",
    ]));
    assert!(
        android.contains("reqwest") && android.contains("mio"),
        "kontrollen fandt ikke reqwest/mio på Android"
    );
}
