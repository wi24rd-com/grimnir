# Flytning: Wi24rd Huginn and Muninn til UI Kit 2

Skrevet ud fra en læsning af repoet `Huginn-Muninn` den 2026-11-11 (seneste commit `42e3483`). Repoet er kun læst; intet er ændret. Alt herunder er set i koden, medmindre det står under "Ikke undersøgt". Programmet er ikke startet, så udseendet er ikke set, kun koden.

Læs pakkens `README.md` og `KOMPONENTER.md` først.

## Beslutning: hele skallen

Jan har besluttet 2026-11-11, at Wi24rd Huginn and Muninn skal have **hele Kit 2-skallen**: mørk titellinje, handlingsbånd, træ og fodlinje. Programmet skal altså ikke kun have kittets farver, skrift og komponenter i sin nuværende ramme. Mangler kittet noget, programmet har brug for, udvides kittet i kilden (`design/ui-kit-2/pakke/` i Grimnir), så de andre programmer får det med.

Resten af vejledningen er skrevet ud fra den beslutning.

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

Programmet får hele Kit 2's skal (se beslutningen øverst). Trin 1–6 lægger farver, tema, skrift og komponenter over i den nuværende ramme, så programmet kan afleveres undervejs; trin 7 bygger rammen om til skallen. Hvor de ti visninger og båndets vælgere skal stå i skallen, afgøres i undersøgelsen (cyklus A), før trin 7.

1. **Pakken ind ved siden af det gamle.** Kopiér `tokens/tokens.css`, `web/kit.css`, `web/kit.js`, `web/tema.js`, `web/sprogmotor.js` og `web/fonts/` ind (fx i `ui/assets/kit2/`, så de ikke overskriver programmets egne `tokens.css` og `tema.js`). Indlæs dem ikke endnu. Notér pakkens version.
2. **Tokens: en bro fra de gamle navne til de nye.** De to sæt variabler har forskellige navne, så de kan leve side om side. Lav en lille fil, der sætter programmets semantiske variabler til kittets (`--color-surface: var(--surface)`, `--color-accent: var(--accent)`, `--status-ok-bg: var(--accent-soft)` osv.), og lad den afløse det semantiske lag i den gamle `tokens.css`. Så skifter hele programmet farver på én gang, uden at `app.css` og `vagt.css` skal røres. Det, Kit 2 ikke har et token til (se næste afsnit), bliver i programmets egen fil.
3. **Tema.** Skift til kittets `tema.js` med `data-kit-praefiks="hm"`: `<html data-tema="lys | moerk | system">` i stedet for `data-theme`. Det gemte valg skal oversættes én gang ved start (`light` → `lys`, `dark` → `moerk`; nøglen `hm-tema` er den samme). `visning-indstillinger.js` kalder i dag `window.hmTema.saet`; den skal kalde `Tema.saet`. **Tekststørrelsen** kan fra 2.3.0 skifte til kittets `Tekst` i samme `tema.js`: nøglen er igen den samme (`hm-tekst`), og det gemte valg oversættes én gang (`compact` → `lille`, `large` → `stor`); `data-density` og de tre blokke i `tokens.css` udgår, og ⌘+ ⌘− ⌘0 kalder `Tekst.større`, `Tekst.mindre` og `Tekst.nulstil`. Kittets skala er `zoom` på hele fladen, ikke programmets egne skriftstørrelser; det skal ses i fotobogen.
4. **Skrift.** Kit 2 bruger Inter; programmet bruger Outfit. Skiftet sker, når `kit.css` indlæses og `--font-*` peger på kittets. Tekstbredder ændrer sig, så alt med faste bredder skal ses efter.
5. **Sprog.** Behold `hmSprog`. Kittet kræver kun, at noget udfylder `data-t`, `data-t-aria` og `data-t-title` på de elementer, `kit.js` bygger. Programmets egen udfyldning tager i dag kun `data-t`; den skal udvides med de to andre (og `data-t-ph`), eller programmet giver kittet færdig tekst (`tekst:` og `aria:`) i stedet for nøgler. `sprogmotor.js` skal ikke bruges, så længe programmet har brug for `{domaene}`, `__fl` og genindlæsning.
6. **Komponenterne, én ad gangen.** Erstat programmets egne med kittets, hvor de findes: knapper (`.knap` → `.btn`), chips (`.chip-groen/-gul/-roed/-graa` → `.chip.ok/.warn/.danger/.none`; symbolet står i dag i CSS og kommer i Kit 2 fra `Kit.chip`), tabeller (`.tabel` findes begge steder, men er ikke ens: programmets har talkolonner, to hovedrækker og egne celletyper; fra 2.3.0 har `Kit.tabel` to hovedrækker, sortering og `Kit.sideskift`), tekstfelter og bannere. Fra 2.3.0 også dialoger, afkrydsning, kontakter, radiogrupper, valglister, fliser, kort (`.kort` → `Kit.kasse`), tom tilstand, fremdrift, værktøjstip og filterchips (se "Opfyldte ønsker"). Klassenavnene `.chip` og `.tabel` findes i begge sæt og vil støde sammen, når `kit.css` indlæses: tag dem i samme trin, som `kit.css` kommer ind.
7. **Skallen.** Byg siden om til AppShell: titellinje, `Kit.commandBar`, `Kit.navTrae` og `Kit.visningsskift`, værktøjslinje og fodlinje. Kittets visningsskift tager fra 2.2.0 højst otte visninger; programmet har ti, så Indstillinger flyttes til en `.rk`-knap i titellinjen og Opsætning til en Wizard (anbefalingen i `KOMPONENTER.md`). Båndets vælgere (domæne, land) bliver til `Kit.vaelger` i titellinjen eller båndet, og hjælpeskuffen til `Kit.sidepanel`. Det blå bånd med bølger og sidebjælken udgår. Pladsen til macOS' vinduesknapper står i dag som `[data-platform="macos"] .band`; den flyttes til `.titel` i programmets egen CSS.
8. **Ryd op.** Fjern det gamle `tokens.json`-lag, der ikke længere bruges, den gamle `tema.js`, Outfit og de regler i `app.css`, kittet har overtaget.

## Opfyldte ønsker

Ønskerne står i `../Huginn-Muninn/claude_cowork/from-cowork/KIT-OENSKER-HAM.md` (K1–K38). Kittet udvides i kilden, så næste program får det med.

| Ønske | Pakke | Hvad kittet har nu |
|---|---|---|
| K1 Egen farve til "ok" | 2.1.0 | `--ok`, `--ok-soft` (samme grønne som accent; reglen står i `KOMPONENTER.md`, Grundlag) |
| K2 Mærkefarver | 2.1.0 | `--ok-mark`, `--warn-mark`, `--danger-mark`, `--info-mark`, `--none-mark`. Afløser `--status-*-dot` |
| K3 Diagramfarver | 2.1.0 | `--data-1` … `--data-6`, `--data-axis`, `--data-grid`, `--data-label`. Angreb er `--danger-mark`, besøg `--info-mark`. Afløser `--chart-http-*` og tavlens seriefarver |
| K4 Kortfarver | 2.1.0 | `--seq-1` … `--seq-5` og `--map-sea`, `--map-land`, `--map-border`, `--map-ring`, `--map-arc`. Afløser `--kort-*` |
| K5 Flere end seks visninger | 2.2.0 | `Kit.visningsskift` tager højst otte (tæt ved syv og otte, `.skift.taet`). Afløser sidebjælkens ti links (`.side .nav`), når Indstillinger er i titellinjen og Opsætning i en Wizard |
| K6 Vælger i titellinje eller bånd | 2.2.0 | `Kit.vaelger` med ét eller flere valg, søgefelt og "alle". Afløser `<select id="vg-zone">` og `<select id="vg-land">` i `.band-vaelger` og domænevælgerens "Samlet (N)" |
| K7 Træ med flere valgte | 2.2.0 | Regel: træet vælger ét punkt; "et, flere eller alle domæner" er en vælger med `flere: true` og `alle`. Afløser listen med Vælg alle / Fravælg alle som filter (indstillingen i Indstillinger kan blive) |
| K8 Sidepanel/skuffe | 2.2.0 | `Kit.sidepanel`: skubber fra 1200 px vindue, lægger sig over under det. Afløser hjælpeskuffen (`aside.hjaelp`, `--help-width`, `hjaelp()` i `ramme.js`) |
| K9 Bånd til programmer, man ser i | 2.2.0 | `Kit.commandBar` med `udenFaner: true` og `{ id, element }` i grupperne, og `Kit.segment`. Afløser `.band-hoejre` (Hent nu, Hjælp) og `.segment` (`hmTegn.segment` i `vg-tegn.js`) |

| K10 Dialog | 2.3.0 | `Kit.dialog` (på `<dialog>` og `showModal()`, fokus ind og tilbage, svaret i `vedLuk`) og `Kit.bekraeft`. Afløser `.dialog`, `.dialog-knapper` og `bekraeft()` i `ramme.js` |
| K11 Afkrydsning, kontakt, valgliste, radiogruppe | 2.3.0 | `Kit.afkrydsning` (også delvis valgt), `Kit.kontakt` (`role="switch"`), `Kit.radiogruppe` og `Kit.valgliste`. Afløser `input.boks`, `input.kontakt`, `.radiol` og `.hm-niveau`/`.hm-valgmulighed`, og den fælles `select`-regel i `app.css` |
| K12 StatusTile | 2.3.0 | `Kit.statusflise` og `Kit.statusfliser` (tal, etiket, status, udvikling; hele flisen klikbar; `role="list"`). Afløser `.vg-fliser` og `.vg-flise` i `vagt.css` |
| K13 Kort | 2.3.0 | `Kit.kasse` (klassen `.kasse`, så den ikke støder sammen med programmets `.kort`). Afløser `.kort` og dens `.raekke`-opbygning; `fyld: true` til en tabel helt ud til kanten |
| K14 Tom tilstand, fremdrift, værktøjstip | 2.3.0 | `Kit.tomTilstand`, `Kit.fremdrift` (`<progress>` eller ring, `aria-busy`) og `Kit.vaerktoejstip` (hover og tastatur, Esc). Afløser `.tom-ravn`, `.email-tom` og `.tek-tomt`, spinneren i `.pille.henter` og `.pille-bar`, og de `title`, der forklarer mere end navnet |
| K15 Tabel: to hovedrækker, sortering, sideskift | 2.3.0 | `Kit.tabel` med `kolonnegrupper` og `gruppe`, `sort` og `vedSortering` (programmet sorterer, fx i Rust som i dag), og `Kit.sideskift`. Afløser hovedet med `<colgroup>`, `rowspan` og `scope="colgroup"` i `index.html` og `nav.dyk-sider` i `visning-vaernet.js` |
| K16 Filterchip | 2.3.0 | `Kit.filterchips` og `Kit.filterchip` (`aria-pressed`, antal, gruppe med navn). Afløser filterknapperne med `aria-pressed` på Angreb og Login |
| K17 Tekststørrelse i tre trin | 2.3.0 | `Tekst` i kittets `tema.js` (lille, normal, stor; én skala for hele fladen). Afløser `tekst.js` (`hmTekst`, `data-density`); se trin 3 |
| K18 Deaktiveret tekst | 2.4.0 | `--text-disabled` (4,5:1 mod `--surface`, `--surface-raised` og `--bg`; programmets egen lyse værdi var 4,4:1 mod `--bg`). Afløser `--color-text-disabled` |
| K19 Hover på et mærke | 2.4.0 | `--info-mark-hover` m.fl. (mærket 78 % blandet med `--text`, som programmet gør nu; tokens, fordi WPF ikke kan blande). Afløser `--board-visitors-hover` |
| K20 Buer, der er angreb | 2.4.0 | Regel: en bue tager betydningens mærkefarve; angreb er `--danger-mark`. Programmets `--kort-bue: var(--danger-mark)` er efter reglen |
| K21 Svag flade af et mærke | 2.4.0 | Regel med `color-mix` og `transparent`: 18 % (mærke) og 92 % (`--surface`), som programmet gør nu; ingen tokens. `--kort-ring-fyld` og `--board-zoom-bg` kan blive, hvor de er, eller skrives direkte |
| K29 Knaptekst ombrydes ikke | 2.4.0 | `.btn` har `white-space: nowrap` i kittet. Afløser `.btn { white-space: nowrap; }` i `app.css` |
| K30 Symbolet for `danger` | 2.4.0 | `Kit.SYMBOL.danger` er `×` (før `?`). Røde chips ("Handl", "Kritisk", "Afvist") viser × |
| K36 Rækker, der åbner, og tabel uden rækkevalg | 2.4.0 | `Kit.tabel` med `raekkeHandling: 'aabn'` (Overblik: `vedAabn`, klik, Enter, mellemrum; et klik på et tal eller et link i "Hvorfor" åbner ikke rækken) og `'ingen'` ("De seneste", Login, DMARC, trafik pr. dag). Navnet er `raekkeHandling`, ikke `raekker` som i ønsket: `raekker` er listen |
| K37 Rækkehoved, celleklasser og rækkens data | 2.4.0 | `hoved: true` (domænet som `<th scope="row">`), `klasse` (`tal-kol`, `st`, `hv`, `chev` kan blive programmets klasser), `bredde` (fast sæt: `xs` 40, `s` 72, `m` 112, `l` 160, `xl` 240 px; `tal-kol` er i dag ca. 64 px), `skille: true` på kolonnegrupperne (afløser `.sep`), `attr: { 'data-zone': … }`, `titel` og `titelT` (afløser `<caption class="sr-only">`) |
| K38 Tabel, der følger indholdet og ruller vandret | 2.4.0 | `layout: 'auto'`, `Kit.tabelRul(tabel, { ariaT })` og `fastFoerste: true`. Afløser `.tabel-rul` i `index.html` og `app.css` og den faste første kolonne i `@media (max-width: 1099px)`; kittets kolonne står fast ved alle bredder, når rammen ruller |

**Alle 17 ønsker (K1–K17) er opfyldt med 2.3.0.** K18–K21, K29, K30 og K36–K38 er opfyldt med 2.4.0. Med 2.4.0 kan programmet flytte **B2d** (tabellerne, tom tilstand, fremdrift og værktøjstip): Overblik og de fire læsetabeller kan bygges med `Kit.tabel`, og hverken piletasterne eller musen åbner noget, programmet ikke har bedt om.

**Venter på 2.5.0** (V-KIT.6): K22 (mærke med eget billede), K23 (titellinjeknap slået fra eller aktiv), K24 (visningsskift med punkt slået fra og tal), K25 (status med fremdrift i fodlinjen), K26 (træ, der kan bygges om), K28 (segmentknap uden valg), K31 (radiogruppe, valgliste og kontakt med navn uden for gruppen), K32 (ikon i kassens overskrift), K33 (valgt flise og flise med to mål), K34 (aktivt filter, der kan fjernes) og K35 (flise med frit indhold). Indtil da bliver de dele i programmets egne filer, som ønskerne beskriver. **K27** (præfiks på kittets klasser) kræver 3.0.0 og er ikke planlagt.

Det af `--board-*`, der ikke har en modpart i kittet, bliver programmets eget og peger på kittets flader og tekstfarver.

## Det, der ikke kan flyttes endnu

| Hvad | Hvorfor |
|---|---|
| Tæthed for sig (tættere rækker uden mindre tekst) | Kittet har tekststørrelsen i tre trin (2.3.0), som skalerer hele fladen, men ingen tæthed for sig. Har programmet brug for det, er det et nyt ønske |
| Ønskerne K22–K26, K28 og K31–K35 | Ikke i 2.4.0; venter på 2.5.0 (se "Opfyldte ønsker"). K27 kræver 3.0.0 |
| Båndets bølger og logo | Kit 2's titellinje er en rolig linje på 34 px. Med hele skallen udgår bølgerne; logoet bliver til mærket (`.mrk`) eller programmets eget. Vælgerne (domæne, land) har plads fra 2.2.0 (`Kit.vaelger` i `.titel .hoejre`) |
| Sprogets mekanik (`hmSprog`) | Programmets er rigere end kittets (`{domaene}`, `{land}`, datoer, tal, ordliste, genindlæsning). Flyttes ikke |
| XAML-udgaven fra Kit 1.0 (`design/out/Wi24rdTokens.xaml`) | Filen siger selv, at den endnu ikke bruges af FTP. Kit 2 har sin egen (`tokens/Tokens.xaml`) med andre nøgler; den gamle kan udgå, når Kit 1.0 udgår |

## Det, der skal tages om bagefter

- **Fotobogen.** Alle skærmbilleder skifter udseende. Fotobogen skal køres igen i hele matrixen, og `fotobog-diff.mjs` vil melde alt som ændret; den nye bog bliver det nye grundlag.
- **Manualen.** De 63 billeder i `docs/manual/img/` kommer fra fotobogen og skal tages om. De 24 sider (dansk og engelsk) skal læses igennem for ord, der beskriver udseendet: det blå bånd, sidebjælken, farver på chips og hvor ting står. Fordi skallen flyttes, skal også alle beskrivelser af, hvordan man kommer rundt, skrives om.
- **UI-testen.** `tests/ui/ui-roeg.mjs` kender klassenavne, `data-theme`, `hm-tema` og båndets opbygning. Den skal følge med trin for trin, ikke til sidst.
- **Kontrast.** Kit 2's par er målt i kilde-repoet. Programmets egne par (tavlen, kortene) skal måles igen mod de nye flader.
- **Brand.** `design/brand/` (logo, app-ikon) er programmets og bliver. Kit 2's accent er nordlysgrøn og titellinjen mørk marineblå; det skal Jan have set sammen med logoet.

## Forslag til cyklusser

Opdelingen er den for hele skallen: seks cyklusser efter undersøgelsen.

| Cyklus | Indhold | Kan afleveres alene |
|---|---|---|
| A (undersøgelse) | Mockup af hele skallen med Overblik og Angreb i Kit 2. Hvor de ti visninger står (visningsskift, træ eller faner), og hvor domæne- og landevælgeren står. Hvad kittet mangler til det (og derfor skal udvides med). Liste over hver variabel i Kit 1.0 og dens nye navn | Ja |
| B1 | Trin 1–3: pakken ind, broen mellem tokens, tema. Programmet ser nyt ud i farverne, men er bygget som før | Ja |
| B2 | Trin 4–6: skrift, sprogaftalen og komponenterne. Med 2.3.0 har kittet alle de komponenter, programmet har ønsket (K10–K17): dialoger, afkrydsning, kontakter, radiogrupper, valglister, fliser, kasser, tom tilstand, fremdrift, værktøjstip, tabellens to hovedrækker, sortering og sideskift, og filterchips. Tekststørrelsen skifter til kittets `Tekst` (trin 3) | Ja |
| B3 | Trin 7, rammen: titellinje, handlingsbånd, visningsskift, træ, værktøjslinje og fodlinje; det blå bånd og sidebjælken udgår. Visningernes indhold flyttes uændret ind | Ja |
| B4 | Trin 7, visningerne: hver af de otte visninger får sine kommandoer i handlingsbåndet (`udenFaner`, `Kit.segment` til perioden), sit træ og sin fodlinje; vælgerne bliver `Kit.vaelger`, hjælpeskuffen `Kit.sidepanel`, Indstillinger en knap i titellinjen og Opsætning en Wizard | Ja |
| B5 | Trin 8 og fotobogen: oprydning og ny fotobog | Ja |
| B6 | Manualen: nye billeder og gennemskrivning på dansk og engelsk, også af hvordan man kommer rundt | Ja |

## Ikke undersøgt

- Hvordan programmet ser ud, når det kører: kun koden er læst.
- `vagt.css` og `vg-tegn.js` i detaljer (hvilke af tavlens farver der kunne være kittets).
- Rust-siden (`src-tauri/src/`): om menuer eller notifikationer bruger farver eller tekster, der skal følge med.
- Om der findes flere brugere af Kit 1.0's XAML end det, filen selv siger.
- Hvad de enkelte manualsider skriver om udseendet: kun antallet af sider og billeder er talt.
- Hvor mange af de 1464 tjek i UI-testen der rammer klassenavne, som ændres.
