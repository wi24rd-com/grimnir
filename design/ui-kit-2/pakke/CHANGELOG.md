# Ændringer i Wi24rd UI Kit 2

Første tal stiger, når et program skal ændre noget for at følge med. Andet tal ved nyt. Tredje tal ved rettelser.

## 2.3.0 — 2026-11-11

Komponenterne: dialog, afkrydsning, kontakt, radiogruppe, valgliste, StatusTile, kasse (kittets kort), tom tilstand, fremdrift, værktøjstip, filterchip, tabellens sortering, to hovedrækker og sideskift, og tekststørrelse i tre trin. Intet er omdøbt eller fjernet; et program, der bruger 2.2.0, kan skifte filerne ud uden at ændre noget. Uden de nye funktioner og indstillinger ser alt ud og virker som før: tabellen er byte for byte som i 2.0.0, og uden et valg af tekststørrelse sætter `tema.js` ingen ny attribut.

### Nyt

- **Dialog** (K10): `Kit.dialog` på browserens `<dialog>` og `showModal()` (fokusfælde, Esc og baggrund fra browseren). Overskrift, sætning og/eller indhold, fodlinje med knapperne (den primære yderst til højre, en farlig som `.btn.danger`) og en valgfri lukkeknap med navn (`luk: { ariaT }`; uden navn giver det en fejl); `aria-labelledby` og `aria-describedby`. Fokus går ved åbning til det, programmet peger på, ellers det første felt, ellers knappen, der ikke er farlig, ellers den primære, og ved lukning tilbage. `vedLuk(svar)` siger, hvordan den blev lukket (knappens id, `'esc'`, `'luk'`, `'kode'`). `Kit.bekraeft` er "Er du sikker?" som et løfte (true/false). Klasserne begynder med `.modal`; målene er dem, Grimnirs egne dialoger har.
- **Afkrydsning, kontakt, radiogruppe og valgliste** (K11): `Kit.afkrydsning` (med delvis valgt), `Kit.kontakt` (`<input type="checkbox" role="switch">`; til og fra ses på knoppens plads og eventuelt et ord), `Kit.radiogruppe` (`<fieldset>` med `<legend>`) og `Kit.valgliste` (browserens `<select>` med kittets kant og pil). Alle er browserens egne `<input>` og `<select>` med kittets udseende, med etiket, hjælp, fejl og deaktiveret. `KOMPONENTER.md` har et nyt afsnit, "Hvilken kontrol hvornår", om valgliste, vælger, radiogruppe, segmentknap, afkrydsning, kontakt og filterchip.
- **StatusTile** (K12): `Kit.statusflise` og `Kit.statusfliser`. Tal, etiket, status (chip med symbol og ord, og en streg i `--*-mark`), undertekst eller udvikling (pil og tekst), og hele flisen som knap eller link. Rækken er en liste (`role="list"`), der ombrydes. Reglen: en flise findes kun, når brugeren handler på tallet. Klassen er `.sflise`.
- **Kasse** (K13): `Kit.kasse`, kittets kort: `<section>` med navn fra overskriften, valgfri handling i hovedet, indhold og valgfri fodlinje. Klassen hedder `.kasse` (ikke `.kort`, som Huginn and Muninn bruger til noget andet).
- **Tom tilstand, fremdrift og værktøjstip** (K14): `Kit.tomTilstand` (ikon, overskrift, én sætning, højst én handling; en lille udgave til en tom tabel og "ingen træffere"), `Kit.fremdrift` (en bestemt bjælke med `<progress>`, eller en ring med tekst; `aria-busy` på det område, der arbejder; står stille ved `prefers-reduced-motion`) og `Kit.vaerktoejstip` (ved hover og tastaturfokus, kan holdes åbent med musen og lukkes med Esc, `role="tooltip"` og `aria-describedby`; placeres med klasserne `.under`, `.venstre-kant` og `.hoejre-kant`). Reglen for `title` og værktøjstip står i `KOMPONENTER.md`.
- **Tabellen** (K15): `Kit.tabel` kan sortere (`sort: true` på en kolonne, `sortering`, `vedSortering`; hovedet er en knap med `aria-sort` og en pil, og programmet sorterer selv) og have to hovedrækker (`kolonnegrupper` og `gruppe` på kolonnerne; `scope="colgroup"`, `colspan` og `<colgroup>`). Nye metoder på tabellen: `saetRaekker` og `saetSortering`. `Kit.sideskift` står under tabellen med forrige, næste, "side X af Y" og antal pr. side i en `<nav>`; programmet leverer siderne.
- **Filterchip** (K16): `Kit.filterchip` og `Kit.filterchips`, en chip, der kan klikkes, med `aria-pressed`, valgfrit antal og en gruppe med navn. Valgt har flueben, kant og fed skrift. Den almindelige chip (`Kit.chip`, `.chip`) er uændret og kan ikke klikkes.
- **Tekststørrelse** (K17): lille, normal og stor som én fælles skala for hele fladen. `tema.js` giver `window.Tekst` (`saet`, `større`, `mindre`, `nulstil`, `valg`, `TRIN`), husker valget i `localStorage['<præfiks>-tekst']`, sætter `<html data-tekst>` før første tegning og melder `<præfiks>-tekst`. `kit.css` sætter `zoom` på roden (0,9 og 1,125) og deler de mål, der følger vinduet, med trinnet, så skallen fylder vinduet, og det mindste vindue er 900 × 560 px i alle trin (målt i WKWebView; WebView2 er ikke målt). Genvejene er programmets.
- **Ingen inline-stil**: reglen står i `README.md` (kittet virker under `style-src 'self'`), og en test holder den over alle filer i `web/`.
- Demoen har en sektion for hver ny komponent i begge temaer og sprog, en tabel med sortering, to hovedrækker og sideskift, og tekststørrelsen med genveje. Kontrasttesten måler de farvepar, de nye komponenter bruger.

### Ændret

- Ingen opførsel er ændret for et kald uden de nye funktioner og indstillinger. `tema.js` definerer nu også `window.Tekst`, og `Kit.tabel` giver tabellen to nye metoder; markup og opførsel er de samme som før.

## 2.2.0 — 2026-11-11

Skallen: flere visninger, vælger, sidepanel, bånd uden faner og segmentknap. Intet er omdøbt eller fjernet; et program, der bruger 2.1.0, kan skifte filerne ud uden at ændre noget. Uden de nye indstillinger ser båndet, træet og visningsskiftet ud og virker som i 2.0.0.

### Nyt

- **Op til otte visninger** (K5): `Kit.visningsskift` tager nu højst otte visninger (før: seks). Ved syv og otte får skiftet klassen `.taet`, og hvert punkt er 30 px højt, så otte kan stå i det mindste vindue (900 × 560 px). Seks eller færre er uændret. Ni eller flere giver en fejl. Reglen i `KOMPONENTER.md` er rettet, med anbefalingen: Indstillinger i titellinjen, en opsætningsguide i Wizard.
- **Vælger** (K6): `Kit.vaelger`, en knap med den aktuelle værdi og en liste. Ét valg eller flere valg (afkrydsning, "alle" øverst, "N valgt"), valgfrit søgefelt, tastatur og ARIA som en listbox. Står i titellinjen, værktøjslinjen og båndet; listen holder sig inden for vinduet uden inline-stil. Klasserne begynder med `.vlg`.
- **Træet vælger ét punkt** (K7): en skreven regel i `KOMPONENTER.md` under NavPane og Vælger. "Et, flere eller alle" er et filter og hører til i vælgeren. `Kit.navTrae` er uændret.
- **Sidepanel** (K8): `Kit.sidepanel`, et panel i højre side af `.midte` med overskrift, lukkeknap og rulbart indhold. Skubber arbejdsfladen fra 1200 px vindue og op og lægger sig over med skygge under det (eller altid med `overlaeg: true`). Esc og lukkeknappen lukker; fokus går ind ved åbning og tilbage ved lukning; `role="complementary"`. Klasserne `.sidepanel`, `.over`, `.sp-top`, `.sp-luk`, `.sp-indhold`.
- **Bånd uden faner** (K9): `Kit.commandBar` med `udenFaner: true` har ingen fanerække (præcis én fane). En post `{ id, element }` i en gruppe sætter en vælger eller segmentknap ind i båndet (`.baand-el`). Klassen `.cmd.enkel`. Et bånd uden de to indstillinger er som før.
- **Segmentknap** (K9): `Kit.segment`, to til fem valg med præcis ét valgt. `role="radiogroup"` med `role="radio"` og `aria-checked`; pilene flytter og vælger, Tab går ind og ud som én kontrol. Klasserne `.seg` og `.seg-v`.
- Demoen har en sektion for hver af de tre nye komponenter, et bånd med én fane, en vælger og en segmentknap, og et visningsskift med otte punkter. Kontrasttesten måler de farvepar, de nye komponenter bruger.

### Ændret

- `Kit.visningsskift` med ni eller flere visninger giver nu en fejl. Det var aldrig tilladt (reglen var højst seks); nu siger kittet det, som ved et ukendt ikon.

## 2.1.0 — 2026-11-11

Nye tokens. Intet er omdøbt eller fjernet; et program, der bruger 2.0.1, kan skifte filerne ud uden at ændre noget.

### Nyt

- **Egen farve til "ok"** (K1): `--ok` og `--ok-soft`. De har samme værdier som `--accent` og `--accent-soft`, men er deres egne tokens, så betydningen "alt er godt" og den primære handling kan skilles ad i koden. `.chip.ok` og `.ban.ok` bruger dem nu; udseendet er uændret.
- **Mærkefarver** (K2): `--ok-mark`, `--warn-mark`, `--danger-mark`, `--info-mark` og `--none-mark` til statusprikker, søjler og markører. Mindst 3:1 mod `--surface`, `--surface-raised` og `--bg` i begge temaer. De er ikke tekstfarver.
- **Diagramfarver** (K3): seks dataserier `--data-1` til `--data-6`, og `--data-axis`, `--data-grid` og `--data-label`. Serierne er mindst 3:1 mod `--surface` og `--bg`.
- **Skala i fem trin** (K4): `--seq-1` til `--seq-5`, fra lidt til meget, til kort, varmekort og lignende.
- **Kortfarver** (K4): `--map-sea`, `--map-land`, `--map-border`, `--map-ring` og `--map-arc`.
- De samme tokens findes i `Tokens.xaml` efter navnereglen (fx `Wi24rdOkMarkBrush`, `Wi24rdData1Brush`).
- Demoen viser dem under Tokens, og reglerne står i `KOMPONENTER.md` under Grundlag.

### Regler, der følger med

- Farve bærer aldrig betydning alene: en prik har et ord, en serie en etiket, et trin en forklaring.
- Faste betydninger: fejl og angreb er `--danger-mark`; oplysning og besøg er `--info-mark` (samme blå som `--data-1`).
- Mærkefarver og dataserier bruges ikke til tekst. Tekst bruger `--ok`, `--warn`, `--danger`, `--info` og `--data-label`.

## 2.0.1 — 2026-11-11

Kun dokumenter. Ingen kode, tokens eller komponenter er ændret, og et program på 2.0.0 skal ikke ændre noget.

- `LICENSE`: hele Apache-2.0-teksten ligger nu i pakken, så den følger med, når pakken kopieres til et andet repo. `LICENSE.md` peger på den.
- `flytning/HUGINN-MUNINN.md`: beslutningen er taget. Wi24rd Huginn and Muninn får hele Kit 2-skallen (mørk titellinje, handlingsbånd, træ og fodlinje). Rækkefølgen og opdelingen i cyklusser er skrevet om til det.
- `flytning/WI24RD-SANDBOX.md`: ny, kort note. Wi24rd Sandbox bliver kun et Windows-program, venter og er ikke undersøgt. Det følger samme vej som Wi24rd FTP (XAML), når det går i gang.

## 2.0.0 — 2026-11-11

Første pakkede udgave. Kittet er udskilt fra Wi24rd Grimnir, som var det første program på det, og kan nu kopieres til andre programmer.

### Indhold

- Tokens som JSON, CSS (`tokens/tokens.css`) og WPF-ressourcer (`tokens/Tokens.xaml`), i lyst og mørkt tema.
- Komponenter til web: AppShell, CommandBar, NavPane, StatusFooter, DataTable, StatusChip, Button, TextField, Banner, Wizard og Fletbaand, samt stregikoner.
- Tema (`web/tema.js`) og sprogets mekanik (`web/sprogmotor.js`).
- Inter og JetBrains Mono med OFL-licenser.
- Demoside, komponentbeskrivelser og flyttevejledninger.

### Ændret i forhold til koden, kittet blev udskilt fra

- `tema.js`: navnet i `localStorage` og på hændelsen er ikke længere fast. Det er `<præfiks>-tema`, hvor præfikset står på `<html data-kit-praefiks>` (standard `wi24rd`).
- Ny `sprogmotor.js` (`KitSprog.opret`): opslag, ental og flertal, udfyldning og sprogskift. Teksterne bliver i programmet.
- Ny `Kit.registrerIkoner`: programmet lægger sine egne ikoner til. Ikonerne `foerefter`, `kvittering`, `maske` og `naeste` er ikke længere i kittet.
- `.titel .sag` hedder nu `.titel .hoejre`.
- Reglen, der gav plads til macOS' vinduesknapper i titellinjen (`[data-platform="macos"] .titel`), er ude af kittet. Programmet giver selv pladsen.
