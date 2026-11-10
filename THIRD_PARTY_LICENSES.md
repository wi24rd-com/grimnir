# Tredjepartslicenser — Wi24rd Grimnir

Grimnir selv er under Apache-2.0 (`LICENSE`). Her står det, der er pakket med i programmet fra andre.

## Skrifter (`ui/assets/fonts/`)

Skrifterne ligger som filer i programmet og hentes aldrig udefra (ADR-001 D15). Begge er under SIL Open Font License 1.1; licensteksterne ligger uændret ved siden af filerne.

| Skrift | Fil | Kilde og version | Licens | SHA-256 |
|---|---|---|---|---|
| Inter (variabel, latin) | `inter-latin-wght-normal.woff2` | npm `@fontsource-variable/inter@5.3.0` (Fontsource; skriftens version v20, The Inter Project Authors, https://github.com/rsms/inter) | OFL-1.1, `OFL-Inter.txt` | `3100e775e8616cd2611beecfa23a4263d7037586789b43f035236a2e6fbd4c62` |
| Inter (variabel, latin-ext) | `inter-latin-ext-wght-normal.woff2` | som ovenfor | OFL-1.1, `OFL-Inter.txt` | `34b9c504cab7a73e37b746343a449132e56cf7b5481af2cb81dc74dcff25c956` |
| JetBrains Mono (variabel, latin) | `jetbrains-mono-latin-wght-normal.woff2` | npm `@fontsource-variable/jetbrains-mono@5.3.0` (Fontsource; skriftens version v24, The JetBrains Mono Project Authors, https://github.com/JetBrains/JetBrainsMono). Byte-identisk med Huginn and Muninns fil | OFL-1.1, `OFL-JetBrainsMono.txt` | `18be452724bfdc236c074ca94a249a7f41a86752c7d04ab258ce9ed5651f6a7e` |
| JetBrains Mono (variabel, latin-ext) | `jetbrains-mono-latin-ext-wght-normal.woff2` | som ovenfor | OFL-1.1, `OFL-JetBrainsMono.txt` | `79bfdab9ba467e26eea4122e6f2567e188dd8a09a8c730d501fc487c4ab99c6e` |

| Licenstekst | SHA-256 |
|---|---|
| `OFL-Inter.txt` (pakkens `LICENSE`, uændret) | `3b0a5fca3d17942cde889069889dedbbbd075e9b599968c82a95f4d944e9b345` |
| `OFL-JetBrainsMono.txt` (pakkens `LICENSE`, uændret) | `403581b69dac5cff4079205e01c6b467e56af449ecbd7247693ddb1baafa005b` |

Pakkerne er kontrolleret mod npm-registrets `dist.integrity` (sha512) før brug. Kun delmængderne latin og latin-ext er med; andre tegn falder tilbage til systemskriften (`"Segoe UI"`, `system-ui`).

## Rust-crates og npm-pakker

Skallens direkte afhængigheder: `tauri` 2.12.5 (Apache-2.0 OR MIT), `serde` 1.0.229 og `serde_json` 1.0.154 (MIT OR Apache-2.0), `keyring` 3.6.3 med `apple-native` og `windows-native` (MIT OR Apache-2.0), `chacha20poly1305` 0.11.0 (Apache-2.0 OR MIT), `zeroize` 1.9.1 (Apache-2.0 OR MIT) og `grimnir-core` (Grimnirs egen, Apache-2.0) med `regex` 1.13.1 (MIT OR Apache-2.0) og `aho-corasick` 1.1.5 (Unlicense OR MIT). Sagernes crates (V-SAG.1) trækker kun MIT OR Apache-2.0-crates ind (RustCrypto, `security-framework` på macOS, `windows-sys` på Windows), undtagen `byteorder` 1.5.0 (Unlicense OR MIT, kun Windows). Filvalgsdialogerne (V-FIL.1): `rfd` 0.18.0 (MIT) uden standardfunktioner; den trækker kun én ny crate ind ud over sig selv, `objc2-uniform-type-identifiers` 0.3.2 (Zlib OR Apache-2.0 OR MIT, kun macOS); resten (`objc2`-familien, `block2`, `dispatch2`, `raw-window-handle`, `log`, `windows-sys` 0.61.2) var der i forvejen via `tauri`.

Hele træet på macOS (aarch64-apple-darwin) er 226 forskellige crates, inklusive `grimnir` og `grimnir-core` (`cargo tree -p grimnir -e normal --target aarch64-apple-darwin --prefix none --format '{p}'`, unikke linjer; V-FIL.1). Windows (x86_64-pc-windows-msvc) er 230. De fleste er MIT og/eller Apache-2.0; resten, alle trukket ind af `tauri`:
- MPL-2.0: `cssparser`, `cssparser-macros`, `dtoa-short`, `option-ext`, `selectors`.
- Unicode-3.0: `icu_*` (7 crates), `litemap`, `potential_utf`, `tinystr`, `writeable`, `yoke`, `yoke-derive`, `zerofrom`, `zerofrom-derive`, `zerotrie`, `zerovec`, `zerovec-derive`; `unicode-ident` er (MIT OR Apache-2.0) AND Unicode-3.0.
- BSD-3-Clause: `alloc-no-stdlib`, `alloc-stdlib`; `brotli` (BSD-3-Clause AND MIT), `brotli-decompressor` (BSD-3-Clause/MIT).
- Zlib: `foldhash` 0.2.0 (via `dom_query` 0.28.0 → `tauri-utils` 2.10.2 → `tauri`, ifølge `cargo tree -i foldhash`). `dpi`: Apache-2.0 AND MIT.

Licensteksterne for crates er endnu ikke samlet i programmet; det skal ske før første udgivelse.

npm-pakkerne `@tauri-apps/cli` 2.12.4 (Apache-2.0 OR MIT) og `jsdom` 26.1.0 (MIT) bruges kun til at bygge og teste og er ikke med i programmet.
