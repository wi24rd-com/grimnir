# Wi24rd UI Kit 2 — pakken

Version: se `VERSION`. Ændringer: se `CHANGELOG.md`.

Denne mappe er Wi24rd UI Kit 2 som kode: farver, skrift, luft og de fælles komponenter til Wi24rd-skrivebordsprogrammerne. Et program tager kittet i brug ved at kopiere mappen (eller de dele, det skal bruge) ind i sit eget repo og følge vejledningen herunder. Du behøver ikke kende det program, kittet blev udskilt fra.

Tankerne bag kittet (principper, farvernes betydning, sprogtone) står i `../README.md` i kilde-repoet. Hver komponent er beskrevet i `KOMPONENTER.md`.

## Indhold

| Sti | Hvad |
|---|---|
| `VERSION`, `CHANGELOG.md` | Pakkens version og hvad der er ændret |
| `tokens/wi24rd-ui-kit-2.tokens.json` | Kilden til alle tokens: farver i lyst og mørkt tema (også ok, mærker, dataserier, skala og kort fra 2.1.0; tekst, der er slået fra, og hover på mærker fra 2.4.0), skrift, luft, radier, skygger |
| `tokens/tokens.css` | Samme tokens som CSS-variabler (genereret) |
| `tokens/Tokens.xaml` | Samme tokens som WPF-ressourcer (genereret) |
| `web/kit.css` | Komponenternes udseende (fra 2.2.0 også vælger, sidepanel og segmentknap; fra 2.3.0 dialog, afkrydsning, kontakt, radiogruppe, valgliste, StatusTile, kasse, tom tilstand, fremdrift, værktøjstip, filterchip, tabellens sortering og sideskift, og tekststørrelsen; fra 2.4.0 tabellens rulleramme, faste bredder og skillelinjer) |
| `web/kit.js` | Komponenternes opførsel (`window.Kit`), også `Kit.vaelger`, `Kit.sidepanel` og `Kit.segment` fra 2.2.0, og fra 2.3.0 `Kit.dialog`, `Kit.bekraeft`, `Kit.afkrydsning`, `Kit.kontakt`, `Kit.radiogruppe`, `Kit.valgliste`, `Kit.statusflise`, `Kit.statusfliser`, `Kit.kasse`, `Kit.tomTilstand`, `Kit.fremdrift`, `Kit.vaerktoejstip`, `Kit.filterchip`, `Kit.filterchips` og `Kit.sideskift`, og fra 2.4.0 `Kit.tabelRul` |
| `web/tema.js` | Lyst, mørkt eller som systemet (`window.Tema`), og fra 2.3.0 tekststørrelsen i tre trin (`window.Tekst`) |
| `web/sprogmotor.js` | Sprogets mekanik: opslag, ental og flertal, sprogskift (`window.KitSprog`) |
| `web/fonts/` | Inter og JetBrains Mono (woff2) med deres OFL-licenser |
| `demo/index.html` | Demoside med hver komponent; åbnes direkte fra disken |
| `KOMPONENTER.md` | Hver komponent: formål, markup, tilstande, tastatur, hvad den kræver |
| `flytning/` | Vejledninger til de programmer, der skal over på kittet |
| `LICENSE.md`, `LICENSE` | Licens, og hele Apache-2.0-teksten |

Se demoen ved at dobbeltklikke på `demo/index.html`. Den henter intet udefra. Skift tema og sprog i titellinjen eller på fanen Vis.

## Sådan tager et webbaseret program kittet i brug (Tauri eller browser)

Kittet er almindelige filer uden byggetrin: ingen npm-pakker, ingen bundler.

### 1. Kopiér filerne

Læg disse filer i samme mappe i programmet (fx `ui/assets/`):

- `tokens/tokens.css`
- `web/kit.css`, `web/kit.js`, `web/tema.js`, `web/sprogmotor.js`
- hele `web/fonts/` som undermappen `fonts/` (kit.css henter skrifterne fra `fonts/` ved siden af sig selv)

Ret ikke i kopierne. Programmets eget udseende og egne tekster ligger i programmets egne filer.

### 2. Indlæs dem i denne rækkefølge

```html
<html lang="da" data-tema="system" data-kit-praefiks="mitprogram">
<head>
  <link rel="stylesheet" href="assets/tokens.css">
  <link rel="stylesheet" href="assets/kit.css">
  <link rel="stylesheet" href="assets/app.css">           <!-- programmets egen CSS, efter kittets -->
  <script src="assets/tema.js"></script>                   <!-- uden defer: temaet sættes, før siden tegnes -->
  <script src="assets/sprogmotor.js" defer></script>
  <script src="assets/sprog.js" defer></script>            <!-- programmets tekster, se trin 4 -->
  <script src="assets/kit.js" defer></script>
  <script src="assets/app.js" defer></script>              <!-- programmets egen kode -->
</head>
```

`data-kit-praefiks` er programmets eget korte navn (små bogstaver og bindestreg). Det bruges til navnene i `localStorage` og på hændelserne, så to programmer aldrig deler valg: `mitprogram-tema` og `mitprogram-sprog`. Udelades det, er præfikset `wi24rd`.

### 3. Tema

`tema.js` læser valget fra `localStorage['<præfiks>-tema']` og sætter `<html data-tema="lys | moerk | system">`. `system` følger macOS eller Windows. Standard er `system`.

```js
Tema.saet('moerk');            // lys | moerk | system; huskes, og siden skifter straks
Tema.valg;                     // det aktuelle valg
document.addEventListener('mitprogram-tema', () => { /* opdatér fx en knap, der viser valget */ });
```

Brug kun tokens til farver i programmets egen CSS (`var(--surface)`, `var(--accent)` …), aldrig farvekoder. Så følger alt med, når temaet skifter.

**Tekststørrelse (fra 2.3.0).** Samme fil giver `window.Tekst`: lille, normal eller stor som én skala for hele fladen (`<html data-tekst>`, `zoom` i `kit.css`). Valget huskes i `localStorage['<præfiks>-tekst']` og sættes før første tegning; uden et valg er alt som før. Genvejene (⌘+ ⌘− ⌘0) og indstillingen er programmets; kittet giver funktionerne.

```js
Tekst.saet('stor');   Tekst.større();   Tekst.mindre();   Tekst.nulstil();   Tekst.valg;
document.addEventListener('mitprogram-tekst', () => { /* opdatér fx menuen */ });
```

### 4. Sprog

Kittet ejer mekanikken, programmet ejer teksterne. Programmets `sprog.js`:

```js
window.Sprog = window.KitSprog.opret({
  standard: 'da',
  titel: 'dokTitel',                       // nøglen til vinduets titel; kan udelades
  tekst: {
    da: { dokTitel: 'Mit program', gem: 'Gem', antal: '{v} {v:fil|filer}' },
    en: { dokTitel: 'My program', gem: 'Save', antal: '{v} {v:file|files}' },
  },
});
```

- I markup: `data-t="gem"` (tekst), `data-t-aria="…"` (aria-label), `data-t-title="…"` (title), `data-t-ph="…"` (placeholder).
- `{v}` og `{w}` erstattes af elementets `data-v` og `data-w`. `{v:ental|flertal}` vælger form efter tallet: ental kun ved præcis 1.
- `Sprog.anvend(rod)` udfylder alle elementer under `rod` (eller hele siden). Kald den, når programmet har bygget noget nyt med kittet.
- `Sprog.saet('en')` skifter straks, husker valget i `localStorage['<præfiks>-sprog']` og melder `<præfiks>-sprog` på `document`.
- `Sprog.t('antal', 3)` giver teksten direkte.
- Alle sprog skal have de samme nøgler. Dansk først.

Har programmet allerede sit eget sprogmodul, kan det beholde det. Kittet kræver kun, at der findes noget, som udfylder `data-t`, `data-t-aria` og `data-t-title` på de elementer, `kit.js` bygger. Se `flytning/HUGINN-MUNINN.md` for et eksempel.

### 5. Byg skærmen

Start med skallen i `KOMPONENTER.md` (AppShell) og fyld den med `Kit.commandBar`, `Kit.navTrae`, `Kit.visningsskift` og `Kit.tabel`. Til valg for hele skærmen er der `Kit.vaelger` (titellinje, værktøjslinje, bånd) og `Kit.segment`; til hjælp og detaljer ved siden af arbejdet `Kit.sidepanel`. Et program med få kommandoer bruger båndet uden faner (`udenFaner: true`). Fra 2.3.0 er der dialoger (`Kit.dialog`, `Kit.bekraeft`), formularens valg (`Kit.afkrydsning`, `Kit.kontakt`, `Kit.radiogruppe`, `Kit.valgliste`; se "Hvilken kontrol hvornår" i `KOMPONENTER.md`), fliser (`Kit.statusfliser`), kasser (`Kit.kasse`), tom tilstand, fremdrift, værktøjstip, filterchips og tabellens sortering og sideskift. Fra 2.4.0 kan tabellens rækker åbne noget i stedet for at blive valgt, eller slet ikke reagere (`raekkeHandling`), og tabellen kan have rækkehoved, faste bredder, skillelinjer, en `caption`, følge indholdet og rulle vandret med første kolonne fast (`Kit.tabelRul`). Demoens `demo/index.html` og `demo/demo.js` er et lille, komplet eksempel.

Det, kittet forventer af programmet:

- Programmet ejer visningsskiftet (hvad der vises for `#id`), hvad kommandoerne gør, og alle data.
- Programmets egne ikoner lægges til med `Kit.registrerIkoner({ navn: [[element, attributter], …] })`, før de bruges.
- Titellinjen er programmets: mærke, navn og det, der står til højre (`.hoejre`). Har vinduet styresystemets knapper oven på titellinjen (fx macOS med overlejret titellinje), giver programmet selv plads til dem i sin egen CSS.
- Mindste vindue er 900 × 560 px. Dér er der plads til otte visninger i visningsskiftet (se NavPane i `KOMPONENTER.md`).
- Alt, der kan aktiveres, skal have synlig hover, kunne nås med Tab og have en `aria-label`, der siger, hvad der sker.

### Ingen inline-stil

**Kittet sætter aldrig inline-stil**: ingen `.style.`, ingen `style=""` og ingen `setAttribute('style', …)` i `web/`. Tilstande udtrykkes med klasser og attributter (`hidden`, `aria-expanded`, `.op`, `.under` …), og placeringer med klasser, som `kit.css` har reglerne til. Så virker kittet også i et program med en indholdspolitik (CSP), der kun tillader stilark fra programmet selv (`style-src 'self'`). En test i kilde-repoet holder reglen over alle filer i `web/`. Programmet kan gøre det samme i sin egen kode; det er ikke et krav fra kittet.

## Sådan tager et WPF-program tokens i brug

**Komponenterne findes ikke til WPF endnu.** Pakken har kun tokens til WPF: farver, skrift, luft, radier og skygger. Knapper, tabeller, bånd og resten skal programmet selv tegne som WPF-stilarter ud fra `KOMPONENTER.md` og demoen, indtil kittet får en WPF-udgave.

`Tokens.xaml` bygger i et WPF-projekt, men er ikke indlæst af et kørende program endnu. WPF's XAML-oversætter i .NET 8 SDK gav 0 fejl og 0 advarsler i Wi24rd FTP's fase A (2026-11-11, bygget på Linux, hvor et WPF-program ikke kan startes). Nøgler og farver er sammenlignet med CSS-udgaven af en test. Om de to ordbøger kan hentes og skiftes, mens programmet kører, viser en prøve på Windows; indtil den er kørt, skal den første, der fletter filen ind, bekræfte, at den indlæses.

### Navneregel

`Wi24rd` + tokenets navn i PascalCase. Navnet er det samme som CSS-variablens: bindestreger fjernes, og hvert led får stort begyndelsesbogstav.

| Token (CSS) | Nøgle i XAML | Type |
|---|---|---|
| `--accent` | `Wi24rdAccentBrush` | `SolidColorBrush` (den, man normalt bruger) |
| `--accent` | `Wi24rdAccentColor` | `Color` |
| `--surface-raised` | `Wi24rdSurfaceRaisedBrush` / `…Color` | som ovenfor |
| `--body-size`, `--body-line` | `Wi24rdBodySize`, `Wi24rdBodyLine` | `Double` |
| `--body-weight` | `Wi24rdBodyWeight` | `FontWeight` |
| `--body-family`, `--font-sans` | `Wi24rdBodyFamily`, `Wi24rdFontSans` | `FontFamily` |
| `--label-tracking` | `Wi24rdLabelTracking` | `Double` i em (WPF har ingen egenskab til det på `TextBlock`) |
| `--space-3` | `Wi24rdSpace3` / `Wi24rdSpace3Thickness` | `Double` / `Thickness` (til `Margin` og `Padding`) |
| `--radius-md` | `Wi24rdRadiusMd` | `CornerRadius` |
| `--shadow-card` | `Wi24rdShadowCard` | `DropShadowEffect` (spredning findes ikke i WPF og er udeladt) |

Tal er WPF-enheder: 1 enhed er 1 px ved 96 dpi, så værdierne er de samme som i CSS.

### Flet ind

Filen har to ordbøger med de samme nøgler: `Wi24rdLys` og `Wi24rdMoerk`. Hver indeholder alle tokens. Programmet fletter præcis én af dem ind ad gangen.

1. Kopiér `tokens/Tokens.xaml` ind i projektet (fx `Tokens/Tokens.xaml`). Byggehandlingen er `Page`, som for andre XAML-filer.
2. Indlæs filen i `App.xaml`:

```xml
<Application.Resources>
  <ResourceDictionary>
    <ResourceDictionary.MergedDictionaries>
      <ResourceDictionary Source="Tokens/Tokens.xaml"/>
    </ResourceDictionary.MergedDictionaries>
    <!-- programmets egne stilarter herunder -->
  </ResourceDictionary>
</Application.Resources>
```

3. Vælg tema ved start, og igen når brugeren skifter (i `App.xaml.cs`):

```csharp
private ResourceDictionary? _tema;

public void SaetTema(bool moerk)
{
    var nyt = (ResourceDictionary)FindResource(moerk ? "Wi24rdMoerk" : "Wi24rdLys");
    if (_tema != null) Resources.MergedDictionaries.Remove(_tema);
    Resources.MergedDictionaries.Add(nyt);
    _tema = nyt;
}
```

   Kald `SaetTema` i `OnStartup`, før det første vindue laves. **Ingen token findes før det**: nøglerne ligger inde i `Wi24rdLys` og `Wi24rdMoerk` og kommer først op på øverste niveau, når en af de to er flettet ind. Et `StaticResource` i `App.xaml` kan derfor ikke pege på en kit-nøgle: `App.xaml` læses, før `SaetTema` kører.

4. Brug `DynamicResource` til alt fra kittet, så et temaskift slår igennem uden genstart:

```xml
<Border Background="{DynamicResource Wi24rdSurfaceBrush}"
        BorderBrush="{DynamicResource Wi24rdBorderBrush}"
        CornerRadius="{DynamicResource Wi24rdRadiusMd}"
        Padding="{DynamicResource Wi24rdSpace4Thickness}"/>
```

`StaticResource` virker kun, hvis programmet aldrig skifter tema, mens det kører.

### Farver, der regnes (fra 2.4.0)

`KOMPONENTER.md` (Grundlag, "Farver til status, data og kort") har to regler, der i CSS skrives med `color-mix`. WPF har ingen `color-mix`, så de holdes ens sådan:

- **Hover på et mærke** (78 % mærke, 22 % `--text`) kan ikke skrives i XAML. Derfor er den regnet ud som tokens: `Wi24rdInfoMarkHoverBrush` osv. (fem mærker, begge temaer).
- **Svag flade af et mærke** (18 % dækning) og **næsten dækkende flade** (92 %) er farven med gennemsigtighed. Den skrives med pensels `Opacity` på den farve, der findes, så der er ingen nye tokens:

```xml
<Ellipse Stroke="{DynamicResource Wi24rdDangerMarkBrush}">
  <Ellipse.Fill><SolidColorBrush Color="{DynamicResource Wi24rdDangerMarkColor}" Opacity="0.18"/></Ellipse.Fill>
</Ellipse>
<Button><Button.Background><SolidColorBrush Color="{DynamicResource Wi24rdSurfaceColor}" Opacity="0.92"/></Button.Background></Button>
```

Skrevet efter WPF's `Brush.Opacity`; ikke bygget eller kørt i et WPF-program.

### Skrifterne i WPF

`Wi24rdFontSans` er `Inter, Segoe UI`, og `Wi24rdFontMono` er `JetBrains Mono, Cascadia Mono, Menlo`. WPF bruger det første navn, der er installeret på maskinen, så uden videre falder et WPF-program tilbage til Segoe UI og Cascadia Mono. Pakken har kun skrifterne som woff2, og det kan WPF ikke læse. Filerne er desuden variable skrifter (én fil med alle vægte, `…-wght-normal.woff2`); WPF skal have statiske filer, én pr. vægt.

Skal programmet vise Inter og JetBrains Mono, skal det selv hente dem som statiske TTF-filer (fx Regular og SemiBold) og lægge dem i projektet med byggehandlingen `Resource`. Skriften nævnes så med en `pack://`-sti til mappen foran navnet, fx `pack://application:,,,/Fonts/#Inter`. Et navn alene finder kun en skrift, der er installeret på maskinen, og sådan er `Wi24rdFontSans` og `Wi24rdFontMono` skrevet. Programmet sætter derfor sin egen `FontFamily` med stien først og kittets navne som reserve, indtil pakken har skrifterne til WPF. Det er et hul i pakken (se nederst).

## Sådan opdaterer du til en ny version

1. Læs `CHANGELOG.md` i den nye pakke fra din nuværende version og frem. Første tal i versionen stiger, når noget skal ændres i programmet (en klasse eller funktion er omdøbt eller fjernet). Andet tal stiger ved nyt, der ikke kræver ændringer. Tredje tal ved rettelser.
2. Erstat de kopierede filer med de nye. Ret aldrig i kopierne: har programmet brug for noget andet, hører det hjemme i programmets egne filer eller som et ønske til kittet.
3. Notér pakkens version i programmet (fx i en kommentar ved siden af kopierne), så det kan ses, hvilken version der er i brug.
4. Kør programmets egne tests, og se demoen i den nye pakke for det, der er nyt.

I kilde-repoet laves programmets kopier af et script (`npm run kit`), og `npm run kit -- --check` fejler, hvis en kopi ikke er byte for byte som pakken. Et program, der vil have samme sikkerhed, kan sammenligne sine kopier med pakken på samme måde.

Ligger programmet i git, skal kit-kopierne have `-text` i programmets `.gitattributes`, fx `Tokens/Tokens.xaml -text`. Git på Windows kan lave linjeskift om ved udtjekning (`core.autocrlf`), og så er kopien ikke længere byte for byte som pakken, selv om ingen har rettet i den. Pakkens filer har linjeskiftet LF.

## Hvad pakken ikke indeholder

- **Komponenter til WPF.** Kun tokens.
- **Skrifter til WPF** (statiske TTF-filer). Kun variable woff2 til web.
- **Logo og app-ikoner.** De hører til det enkelte program.
- **Et fuldt ikonsæt.** `kit.js` har de almene stregikoner, kittets egne komponenter og de første programmer har brugt. Programmet lægger sine egne til.
- **Menu, Cover og en egen listeboks.** De findes ikke som kode i kittet. Et program, der har brug for dem, tegner dem selv med kittets tokens. Vælgeren, sidepanelet og segmentknappen findes fra 2.2.0; dialog, afkrydsning, kontakt, radiogruppe, valgliste, StatusTile, kasse, tom tilstand, fremdrift, værktøjstip og filterchip fra 2.3.0. Vælgeren er til valg for hele skærmen; i en formular bruges valglisten.
- **Flervalg i træet.** Træet vælger ét punkt; flere valg hører til i vælgeren (se `KOMPONENTER.md`).
- **Tekster.** Kittet har ingen tekster; alle tekster er programmets.
- **Tæthed for sig.** Tekststørrelsen i tre trin findes fra 2.3.0 og skalerer hele fladen; tættere rækker uden mindre tekst findes ikke.
- **Byggeværktøjet.** `tokens.css` og `Tokens.xaml` laves fra JSON-filen af `design/build-tokens.mjs` i kilde-repoet. Pakken har de færdige filer.
- **Programmets egne ting:** visninger, data, kommandoer, genveje og vinduesopsætning.

## Licens

Se `LICENSE.md`: Apache-2.0 som resten af kilde-repoet; hele licensteksten ligger i `LICENSE` her i pakken. Skrifterne i `web/fonts/` er under SIL Open Font License 1.1.
