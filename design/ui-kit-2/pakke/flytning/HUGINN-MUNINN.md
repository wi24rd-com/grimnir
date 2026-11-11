# Flytning: Wi24rd Huginn and Muninn til UI Kit 2

Skrevet ud fra en læsning af repoet `Huginn-Muninn` den 2026-11-11 (seneste commit `42e3483`). Repoet er kun læst; intet er ændret. Alt herunder er set i koden, medmindre det står under "Ikke undersøgt". Programmet er ikke startet, så udseendet er ikke set, kun koden.

Læs pakkens `README.md` og `KOMPONENTER.md` først.

## Hvad programmet har i dag

**Teknik.** Tauri 2 med almindelig HTML, CSS og JavaScript uden bundler: samme teknik som kittet. Én side (`ui/index.html`) og filerne i `ui/assets/`. Vinduet er 1200 × 860, mindst 900 × 560, med `titleBarStyle: "Overlay"` på macOS.

**Udseende: UI kit 1.0.** `design/wi24rd-tokens.json` (version 1.0.0) i tre lag: rå skala, semantisk lag (lys og mørk) og komponentlag. `design/build-tokens.mjs` laver `ui/assets/tokens.css` (499 linjer med variabler) og `design/out/Wi24rdTokens.xaml`. Variablerne hedder noget andet end i Kit 2 (`--color-surface`, `--color-accent`, `--status-ok-bg`, `--band-*`, `--board-*`, `--kort-*`).

**Skal.** Et blåt bånd øverst (`.band`) som titel- og værktøjslinje med bølger, logo, navn, domæne- og landevælger og knapper; en sidebjælke (`.side`); indholdet (`.hovedomr`); en hjælpeskuffe (`.hjaelp`). Der er intet handlingsbånd med faner, ingen træ-navigation og ingen fodlinje.

**CSS.** `app.css` (rammen og de fælles byggeklodser: `.knap`, `.kort`, `.chip` med `.chip-roed/-gul/-groen/-graa`, `.tabel`, `.pille`, afkrydsning) og `vagt.css` (kort og søjler på en tavle: Angreb, Robotter). Begge bruger kun variabler, ingen farvekoder.

**Skærme.** Ti visninger (`section.visning`): overblik, siden sidst, værnet (Angreb), robotter, login, land, besøgende, teknologi, indstillinger og opsætning. Dertil velkomsten og hjælpeskuffen. Hver visning har sin egen fil (`visning-*.js`); rammen er `ramme.js`.

**Tema.** `tema.js` gemmer `localStorage['hm-tema']` = `system | light | dark` og sætter `<html data-theme>` (ved `system` fjernes attributten). Samme fil styrer tekststørrelsen: `localStorage['hm-tekst']` = `compact | normal | large` → `<html data-density>`, med genveje.

**Sprog.** `sprog.js` (`window.hmSprog`) har både tekster og mekanik: `localStorage['hm-sprog']` = `auto | da | en`, udfylder `[data-t]`, har flertal som en ekstra nøgle (`noegle__fl`), indsætter `{domaene}` og `{land}`, formaterer datoer og tal, og genindlæser siden ved sprogskift. Der bruges ikke `data-t-aria`, `data-t-title` eller `data-t-ph`.

**Skrift.** Outfit og JetBrains Mono (woff2, OFL) i `ui/assets/fonts/`.

**Tests og dokumentation, der afhænger af udseendet.** `tests/ui/ui-roeg.mjs` (1464 kald af `tjek(`), fotobogen (`tests/ui/fotobog.mjs`: skærmbilleder af hver side i `sider.mjs` i headless Chrome, tema × sprog × størrelse) og manualen (`docs/manual/`: 24 sider i `manual.json` på dansk og engelsk, 11 af dem under `40-visninger/`, og 63 billeder, der kommer fra fotobogen).

## Rækkefølgen

Det afgørende valg er, om Huginn and Muninn skal have Kit 2's **skal** (mørk titellinje, handlingsbånd, navigationsrude med træ, fodlinje) eller kun dets **farver, skrift og komponenter** i den nuværende ramme. Det er Jans beslutning, og den bør tages før trin 3. Trin 1 og 2 er ens i begge tilfælde.

1. **Pakken ind ved siden af det gamle.** Kopiér `tokens/tokens.css`, `web/kit.css`, `web/kit.js`, `web/tema.js`, `web/sprogmotor.js` og `web/fonts/` ind (fx i `ui/assets/kit2/`, så de ikke overskriver programmets egne `tokens.css` og `tema.js`). Indlæs dem ikke endnu. Notér pakkens version.
2. **Tokens: en bro fra de gamle navne til de nye.** De to sæt variabler har forskellige navne, så de kan leve side om side. Lav en lille fil, der sætter programmets semantiske variabler til kittets (`--color-surface: var(--surface)`, `--color-accent: var(--accent)`, `--status-ok-bg: var(--accent-soft)` osv.), og lad den afløse det semantiske lag i den gamle `tokens.css`. Så skifter hele programmet farver på én gang, uden at `app.css` og `vagt.css` skal røres. Det, Kit 2 ikke har et token til (se næste afsnit), bliver i programmets egen fil.
3. **Tema.** Skift til kittets `tema.js` med `data-kit-praefiks="hm"`: `<html data-tema="lys | moerk | system">` i stedet for `data-theme`. Det gemte valg skal oversættes én gang ved start (`light` → `lys`, `dark` → `moerk`; nøglen `hm-tema` er den samme). `visning-indstillinger.js` kalder i dag `window.hmTema.saet`; den skal kalde `Tema.saet`. Tekststørrelsen (`hmTekst`, `data-density`) bliver i programmet.
4. **Skrift.** Kit 2 bruger Inter; programmet bruger Outfit. Skiftet sker, når `kit.css` indlæses og `--font-*` peger på kittets. Tekstbredder ændrer sig, så alt med faste bredder skal ses efter.
5. **Sprog.** Behold `hmSprog`. Kittet kræver kun, at noget udfylder `data-t`, `data-t-aria` og `data-t-title` på de elementer, `kit.js` bygger. Programmets egen udfyldning tager i dag kun `data-t`; den skal udvides med de to andre (og `data-t-ph`), eller programmet giver kittet færdig tekst (`tekst:` og `aria:`) i stedet for nøgler. `sprogmotor.js` skal ikke bruges, så længe programmet har brug for `{domaene}`, `__fl` og genindlæsning.
6. **Komponenterne, én ad gangen.** Erstat programmets egne med kittets, hvor de findes: knapper (`.knap` → `.btn`), chips (`.chip-groen/-gul/-roed/-graa` → `.chip.ok/.warn/.danger/.none`; symbolet står i dag i CSS og kommer i Kit 2 fra `Kit.chip`), tabeller (`.tabel` findes begge steder, men er ikke ens: programmets har talkolonner, to hovedrækker og egne celletyper), tekstfelter og bannere. Klassenavnene `.chip` og `.tabel` findes i begge sæt og vil støde sammen, når `kit.css` indlæses: tag dem i samme trin, som `kit.css` kommer ind.
7. **Skallen (kun hvis Jan vælger den).** Byg siden om til AppShell: titellinje, `Kit.commandBar`, `Kit.navTrae` og `Kit.visningsskift`, værktøjslinje og fodlinje. Kittets visningsskift er til højst seks visninger; programmet har ti, så nogle skal blive til punkter i træet eller til faner. Båndets vælgere (domæne, land) skal have en ny plads. Pladsen til macOS' vinduesknapper står i dag som `[data-platform="macos"] .band`; den flyttes til `.titel` i programmets egen CSS.
8. **Ryd op.** Fjern det gamle `tokens.json`-lag, der ikke længere bruges, den gamle `tema.js`, Outfit og de regler i `app.css`, kittet har overtaget.

## Det, der ikke kan flyttes endnu

| Hvad | Hvorfor |
|---|---|
| Tavlen med kort og søjler (`vagt.css`, `--board-*`, `--kort-*`, `--chart-http-*`) | Kit 2 har ingen farver til diagrammer og kort. De bliver programmets egne tokens |
| Tekststørrelse i tre trin (`data-density`) | Kit 2 har én størrelse |
| Hjælpeskuffen, dialoger, afkrydsning, kontakt (til/fra), valglister, fliser, spinner | Findes ikke i kittet som kode (se `KOMPONENTER.md`, "Findes ikke endnu") |
| Båndets bølger, logo og vælgere | Kit 2's titellinje er en rolig linje på 34 px uden plads til dem. Kræver Jans valg af skal |
| Sprogets mekanik (`hmSprog`) | Programmets er rigere end kittets (`{domaene}`, `{land}`, datoer, tal, ordliste, genindlæsning). Flyttes ikke |
| XAML-udgaven fra Kit 1.0 (`design/out/Wi24rdTokens.xaml`) | Filen siger selv, at den endnu ikke bruges af FTP. Kit 2 har sin egen (`tokens/Tokens.xaml`) med andre nøgler; den gamle kan udgå, når Kit 1.0 udgår |

## Det, der skal tages om bagefter

- **Fotobogen.** Alle skærmbilleder skifter udseende. Fotobogen skal køres igen i hele matrixen, og `fotobog-diff.mjs` vil melde alt som ændret; den nye bog bliver det nye grundlag.
- **Manualen.** De 63 billeder i `docs/manual/img/` kommer fra fotobogen og skal tages om. De 24 sider (dansk og engelsk) skal læses igennem for ord, der beskriver udseendet: det blå bånd, sidebjælken, farver på chips og hvor ting står. Flyttes skallen, skal også alle beskrivelser af, hvordan man kommer rundt, skrives om.
- **UI-testen.** `tests/ui/ui-roeg.mjs` kender klassenavne, `data-theme`, `hm-tema` og båndets opbygning. Den skal følge med trin for trin, ikke til sidst.
- **Kontrast.** Kit 2's par er målt i kilde-repoet. Programmets egne par (tavlen, kortene) skal måles igen mod de nye flader.
- **Brand.** `design/brand/` (logo, app-ikon) er programmets og bliver. Kit 2's accent er nordlysgrøn og titellinjen mørk marineblå; det skal Jan have set sammen med logoet.

## Forslag til cyklusser

| Cyklus | Indhold | Kan afleveres alene |
|---|---|---|
| A (undersøgelse) | Jan vælger: hele skallen eller kun farver og komponenter. Mockup af Overblik og Angreb i Kit 2. Liste over hver variabel i Kit 1.0 og dens nye navn | Ja |
| B1 | Trin 1–3: pakken ind, broen mellem tokens, tema. Programmet ser nyt ud i farverne, men er bygget som før | Ja |
| B2 | Trin 4–6: skrift, sprogaftalen og komponenterne | Ja |
| B3 (kun ved hele skallen) | Trin 7: skallen. Den største; del den evt. i ramme og visninger | Ja |
| B4 | Trin 8 og fotobogen: oprydning og ny fotobog | Ja |
| B5 | Manualen: nye billeder og gennemskrivning på dansk og engelsk | Ja |

## Ikke undersøgt

- Hvordan programmet ser ud, når det kører: kun koden er læst.
- `vagt.css` og `vg-tegn.js` i detaljer (hvilke af tavlens farver der kunne være kittets).
- Rust-siden (`src-tauri/src/`): om menuer eller notifikationer bruger farver eller tekster, der skal følge med.
- Om der findes flere brugere af Kit 1.0's XAML end det, filen selv siger.
- Hvad de enkelte manualsider skriver om udseendet: kun antallet af sider og billeder er talt.
- Hvor mange af de 1464 tjek i UI-testen der rammer klassenavne, som ændres.
