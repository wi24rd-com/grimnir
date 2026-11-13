# Grimnirs ikon

Ikonet er en nordisk hjelmmaske i kittets turkis på en mørk flise (ADR D28, `docs/adr/001-grundlag.md`). Forlægget er et
billede, Jan fik lavet i ChatGPT; Cowork-Claude har tegnet det op som vektor, spejlet og renset, i en fuld og en lille
udgave. Ret ikke i tegningerne her: ændringer laves i kilderne og aftales først (D28).

## Filerne

| Fil | Hvad |
|---|---|
| `kilde/grimnir-ikon.svg` | Programikonet (flise og maske), den fulde tegning, 512 × 512. |
| `kilde/grimnir-ikon-lille.svg` | Programikonet, den lille tegning (bredere sprækker) til 32 px og mindre, 512 × 512. |
| `kilde/grimnir-maerke.svg` | Mærket alene (masken i sort på gennemsigtig), fuld tegning, 24 × 24. Bruges som maske i UI'et. |
| `kilde/grimnir-maerke-lille.svg` | Mærket alene, den lille tegning (under 24 px; titellinjen). |
| `icon.png` (512), `32x32.png`, `128x128.png`, `128x128@2x.png` (256) | Programikonet som PNG (Tauri). |
| `icon.ico` | Windows: 16, 24, 32, 48, 64 og 256 px. |
| `Grimnir.iconset/` | macOS: ti PNG-filer med Apples navne (16–512 og @2x til og med 1024). |
| `icon.icns` | macOS: lavet af `Grimnir.iconset/` med `iconutil`. |

Størrelser til og med 32 px er lavet af den lille tegning, resten af den fulde. `ui/assets/grimnir-maerke.svg` og
`ui/assets/grimnir-maerke-lille.svg` er byte for byte kopier af kilderne (UI'et kan kun hente filer under `ui/`); testen
`src-tauri/tests/opbyg3_ikon.rs` tjekker det.

SVG- og PNG-filerne har et indlejret C2PA-manifest (Anthropics indholdsattest: "Claude provided this file …"). Det er
metadata, ikke en del af tegningen, og står urørt.

## Lav filerne igen

PNG- og ICO-filerne er lavet af Cowork-Claude ud fra kilderne (rasteriseret i filens størrelse; den lille tegning til og
med 32 px) og ligger i `claude_cowork/shared/design/ikon/app/` (ignoreret af git). Hvilket værktøj der rasteriserede, står
ikke i forlægget; laves de om, så brug samme regel for den lille og den fulde tegning. `icon.icns` laves på macOS med
Apples eget værktøj (signerer intet):

```sh
iconutil -c icns src-tauri/icons/Grimnir.iconset -o src-tauri/icons/icon.icns
```

Kør derefter `cargo test -p grimnir --test opbyg3_ikon` (målene, ICO'ens seks størrelser, ICNS'ens typer og
`tauri.conf.json`) og en bygning (`npm run tauri build -- --debug`).
