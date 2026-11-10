//! K6: "ingen netværkskode" som test (AGENTS.md, ADR-001 Konsekvenser).

use std::collections::BTreeSet;
use std::path::{Path, PathBuf};
use std::process::Command;

fn cargo_tree(args: &[&str]) -> BTreeSet<String> {
    let cargo = std::env::var("CARGO").unwrap_or_else(|_| "cargo".into());
    let ud = Command::new(cargo)
        .args(["tree", "--offline", "-e", "normal", "--prefix", "none", "--format", "{p}"])
        .args(args)
        .current_dir(env!("CARGO_MANIFEST_DIR"))
        .output()
        .expect("cargo tree kan ikke køres");
    assert!(ud.status.success(), "cargo tree fejlede: {}", String::from_utf8_lossy(&ud.stderr));
    String::from_utf8_lossy(&ud.stdout)
        .lines()
        .filter_map(|l| l.split_whitespace().next())
        .map(str::to_string)
        .collect()
}

#[test]
fn afhaengighedstraeet_er_kun_regex_og_aho_corasick() {
    let kerne = cargo_tree(&["-p", "grimnir-core"]);
    let direkte = cargo_tree(&["-p", "grimnir-core", "--depth", "1"]);
    let tilladt: BTreeSet<String> = cargo_tree(&["-p", "regex"])
        .union(&cargo_tree(&["-p", "aho-corasick"]))
        .cloned()
        .collect();
    let forventet_direkte: BTreeSet<String> = ["grimnir-core", "regex", "aho-corasick"].iter().map(|s| s.to_string()).collect();
    assert_eq!(direkte, forventet_direkte, "direkte afhængigheder");
    let andre: Vec<&String> = kerne.iter().filter(|c| *c != "grimnir-core" && !tilladt.contains(*c)).collect();
    assert!(andre.is_empty(), "crates uden for regex og aho-corasick: {andre:?}");
    const FORBUDT: [&str; 17] = [
        "reqwest",
        "hyper",
        "h2",
        "rustls",
        "native-tls",
        "openssl",
        "ureq",
        "curl",
        "tungstenite",
        "quinn",
        "socket2",
        "mio",
        "tokio",
        "hickory-resolver",
        "hickory-proto",
        "url",
        "http",
    ];
    for f in FORBUDT {
        assert!(!kerne.contains(f), "forbudt crate i træet: {f}");
    }
}

fn rs_filer(mappe: &Path, ud: &mut Vec<PathBuf>) {
    for e in std::fs::read_dir(mappe).expect("src kan læses").flatten() {
        let p = e.path();
        if p.is_dir() {
            rs_filer(&p, ud);
        } else if p.extension().is_some_and(|x| x == "rs") {
            ud.push(p);
        }
    }
}

#[test]
fn kildekoden_naevner_ikke_netvaerk_filer_processer_eller_ure() {
    let mut filer = Vec::new();
    rs_filer(&PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("src"), &mut filer);
    assert!(filer.len() >= 10, "for få kildefiler fundet: {}", filer.len());
    const FORBUDT: [&str; 9] = [
        "TcpStream",
        "TcpListener",
        "UdpSocket",
        "std::fs",
        "std::process",
        "std::time",
        "SystemTime",
        "Instant",
        "std::env",
    ];
    for f in &filer {
        let indhold = std::fs::read_to_string(f).expect("kildefil kan læses");
        for ord in FORBUDT {
            assert!(!indhold.contains(ord), "{} nævner {ord}", f.display());
        }
    }
}
