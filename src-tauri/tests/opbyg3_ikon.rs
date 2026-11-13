//! V-OPBYG.3 N2 (D28): Grimnirs nye ikon. Filerne findes med de rigtige mål (PNG-hovedet læses), `icon.ico` har seks
//! størrelser, `icon.icns` har typerne for 16–1024, `tauri.conf.json` peger på dem, kilderne ligger i `icons/kilde/`, og
//! UI'ets mærke er byte for byte kilden. Programmets navn og bundle-id er uændrede.

use std::path::{Path, PathBuf};

fn rod() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
}

fn laes(p: &Path) -> Vec<u8> {
    std::fs::read(p).unwrap_or_else(|_| panic!("{} mangler", p.display()))
}

/// Bredde og højde fra et PNG-hoved (signaturen og IHDR først).
fn png_maal(b: &[u8]) -> (u32, u32) {
    assert_eq!(&b[..8], b"\x89PNG\r\n\x1a\n", "ikke en PNG");
    assert_eq!(&b[12..16], b"IHDR");
    let tal = |i: usize| u32::from_be_bytes([b[i], b[i + 1], b[i + 2], b[i + 3]]);
    (tal(16), tal(20))
}

#[test]
fn png_filerne_har_de_rigtige_maal() {
    let ik = rod().join("icons");
    for (navn, side) in [("icon.png", 512), ("32x32.png", 32), ("128x128.png", 128), ("128x128@2x.png", 256)] {
        assert_eq!(png_maal(&laes(&ik.join(navn))), (side, side), "{navn}");
    }
}

#[test]
fn iconset_har_apples_ti_navne_og_maal() {
    let mappe = rod().join("icons").join("Grimnir.iconset");
    let mut navne: Vec<String> = std::fs::read_dir(&mappe)
        .expect("Grimnir.iconset mangler")
        .map(|e| e.unwrap().file_name().to_string_lossy().into_owned())
        .collect();
    navne.sort();
    let forventet = [
        ("icon_128x128.png", 128),
        ("icon_128x128@2x.png", 256),
        ("icon_16x16.png", 16),
        ("icon_16x16@2x.png", 32),
        ("icon_256x256.png", 256),
        ("icon_256x256@2x.png", 512),
        ("icon_32x32.png", 32),
        ("icon_32x32@2x.png", 64),
        ("icon_512x512.png", 512),
        ("icon_512x512@2x.png", 1024),
    ];
    assert_eq!(navne, forventet.iter().map(|(n, _)| n.to_string()).collect::<Vec<_>>());
    for (navn, side) in forventet {
        assert_eq!(png_maal(&laes(&mappe.join(navn))), (side, side), "{navn}");
    }
}

#[test]
fn ico_har_seks_stoerrelser() {
    let b = laes(&rod().join("icons").join("icon.ico"));
    assert_eq!(&b[..4], &[0, 0, 1, 0], "ICO-hovedet");
    let antal = u16::from_le_bytes([b[4], b[5]]) as usize;
    let mut maal = Vec::new();
    for k in 0..antal {
        let e = &b[6 + 16 * k..22 + 16 * k];
        let side = |x: u8| if x == 0 { 256 } else { x as u32 };
        let (w, h) = (side(e[0]), side(e[1]));
        let (laengde, start) = (
            u32::from_le_bytes([e[8], e[9], e[10], e[11]]) as usize,
            u32::from_le_bytes([e[12], e[13], e[14], e[15]]) as usize,
        );
        let billede = &b[start..start + laengde];
        // Hvert billede er en PNG med de mål, indgangen siger.
        assert_eq!(png_maal(billede), (w, h));
        maal.push(w);
    }
    assert_eq!(maal, [16, 24, 32, 48, 64, 256]);
}

#[test]
fn icns_har_typerne_for_16_til_1024() {
    let b = laes(&rod().join("icons").join("icon.icns"));
    assert_eq!(&b[..4], b"icns");
    assert_eq!(u32::from_be_bytes([b[4], b[5], b[6], b[7]]) as usize, b.len(), "længden i hovedet");
    let mut typer = std::collections::BTreeMap::new();
    let mut i = 8;
    while i < b.len() {
        let t = String::from_utf8_lossy(&b[i..i + 4]).into_owned();
        let n = u32::from_be_bytes([b[i + 4], b[i + 5], b[i + 6], b[i + 7]]) as usize;
        let d = &b[i + 8..i + n];
        typer.insert(t, if d.starts_with(b"\x89PNG") { Some(png_maal(d).0) } else { None });
        i += n;
    }
    // Apples typer: ic04/ic05 (16 og 32 i ARGB), ic11/ic12 (16@2x, 32@2x), ic07–ic10 (128–1024), ic13/ic14 (128@2x, 256@2x).
    for (t, side) in [
        ("ic11", 32),
        ("ic12", 64),
        ("ic07", 128),
        ("ic13", 256),
        ("ic08", 256),
        ("ic14", 512),
        ("ic09", 512),
        ("ic10", 1024),
    ] {
        assert_eq!(typer.get(t), Some(&Some(side)), "{t}: {typer:?}");
    }
    assert!(typer.contains_key("ic04") && typer.contains_key("ic05"), "16 og 32 px: {typer:?}");
}

#[test]
fn tauri_conf_peger_paa_ikonerne_og_navnet_er_uaendret() {
    let tekst = std::fs::read_to_string(rod().join("tauri.conf.json")).unwrap();
    let conf: serde_json::Value = serde_json::from_str(&tekst).unwrap();
    let ikoner: Vec<&str> = conf["bundle"]["icon"]
        .as_array()
        .unwrap()
        .iter()
        .map(|v| v.as_str().unwrap())
        .collect();
    assert_eq!(
        ikoner,
        [
            "icons/32x32.png",
            "icons/128x128.png",
            "icons/128x128@2x.png",
            "icons/icon.icns",
            "icons/icon.ico"
        ]
    );
    for i in ikoner {
        assert!(rod().join(i).is_file(), "{i}");
    }
    // D28: programmets navn i styresystemet og bundle-id ændres ikke.
    assert_eq!(conf["productName"], "Grimnir");
    assert_eq!(conf["identifier"], "com.wi24rd.grimnir");
    assert_eq!(conf["app"]["windows"][0]["title"], "Wi24rd Grimnir — Mask. Share. Restore.");
}

#[test]
fn kilderne_ligger_i_kilde_og_ui_maerket_er_kilden() {
    let kilde = rod().join("icons").join("kilde");
    for navn in [
        "grimnir-ikon.svg",
        "grimnir-ikon-lille.svg",
        "grimnir-maerke.svg",
        "grimnir-maerke-lille.svg",
    ] {
        let b = laes(&kilde.join(navn));
        assert!(b.starts_with(b"<svg "), "{navn}");
    }
    let ui = rod().join("..").join("ui").join("assets");
    for navn in ["grimnir-maerke.svg", "grimnir-maerke-lille.svg"] {
        assert_eq!(laes(&ui.join(navn)), laes(&kilde.join(navn)), "{navn}: UI'ets kopi er ikke kilden");
    }
    assert!(rod().join("icons").join("LAESMIG.md").is_file());
}
