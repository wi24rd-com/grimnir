# Flytning: Wi24rd FTP til UI Kit 2

Skrevet ud fra en læsning af repoet `Wi24rd-FTP` den 2026-11-11 (seneste commit `514c97c`). Repoet er kun læst; intet er ændret. Alt herunder er set i koden, medmindre det står under "Ikke undersøgt". Programmet er ikke bygget eller startet: det er et Windows-program, og læsningen er sket på macOS.

Rettet 2026-11-11 efter Wi24rd FTP's egen fase A (`claude_cowork/from-cowork/INVESTIGATION-KIT2-FASE-A.md` i FTP-repoet): det gamle trin 2 er udgået, tabellen er rettet, og det, den første læsning ikke fandt i koden, står nu under "Hvad programmet har i dag". Tallene er talt efter i FTP-repoet ved samme commit.

Læs pakkens `README.md` (afsnittet om WPF) først. Det vigtigste at vide: **pakken har kun tokens til WPF** (`tokens/Tokens.xaml`). Komponenterne findes kun til web.

## Hvad programmet har i dag

**Teknik.** .NET 8 WPF (`net8.0-windows`), ét projekt: `src/Wi24rdFTP/Wi24rdFTP.csproj`. Ingen UI-pakker; den eneste pakke er `System.ServiceProcess.ServiceController`.

**Skærme.** To vinduer: `MainWindow.xaml` (405 linjer; 1020 × 800, mindst 900 × 680) og `AboutWindow.xaml` (55 linjer). Bekræftelser og fejl vises med Windows' egne `MessageBox` (9 kald: 1 i `App.xaml.cs` og 8 i `MainWindow.xaml.cs`); de følger hverken kittet eller mørkt tema. Hovedvinduet er ét billede uden faner eller navigation: en blå hoved på 84 px med farveforløb, op til tre bannere (forudsætninger, administrator, opdatering), et statuskort, et kort med delte filer (slip-zone og en `ListView`), et kort med forbindelsen (FTP eller SFTP som to valg ved siden af hinanden, adresser, adgangskode) og en nederste række på 86 px.

**Udseende.** Alt ligger i `App.xaml` (282 linjer) som ressourcer direkte i `Application.Resources`:

- 30 pensler med nøgler som `Brush.Accent`, `Brush.Card`, `Brush.Border`, `Brush.Text`, `Brush.Muted`, `Brush.AmberPale` og to farveforløb (`Brush.HeaderGradient`, `Brush.PrimaryGradient`). Paletten er blå og kun lys.
- 16 stilarter: `BaseButton`, `PrimaryButton`, `DangerButton`, `SecondaryButton`, `LinkButton`, `IconButton`, `HeaderIconButton`, `RowIconButton`, `SegmentRadio`, `Card`, `CardTitle`, `Label`, `LabelIcon`, `Value`, `MonoValue` og `FileList`. Dertil to stilarter uden navn: `ListViewItem` og `GridViewColumnHeader`.
- 6 af de 30 pensler bruges ingen steder: `Brush.Navy`, `NavyLight`, `Cyan`, `GreenDark`, `GreenPale` og `RedPale`.
- Farvekoder står direkte i XAML: 37 steder i `App.xaml` og 7 i `MainWindow.xaml`.
- Alt bruges med `StaticResource`: `Brush.*` slås op 99 steder (33 i `App.xaml`, 55 i `MainWindow.xaml`, 11 i `AboutWindow.xaml`). `DynamicResource` bruges ingen steder.
- **Koden henter pensler efter navn 13 steder.** `MainWindow.xaml.cs` kalder `FindResource("Brush.…")` i linje 101–112 (slip-zonen), 484–499 (de tre statusprikker) og 539–541 (adgangskodens tegn) og sætter farven fast. Fjernes en gammel nøgle uden at rette her, bygger programmet og vælter, når linjen køres. En farve, der er sat fast, følger heller ikke et temaskift.
- Hjørner (`CornerRadius`) og skriftstørrelser står som tal i XAML (13, 14, 12, 16, 15, 18 og enkelte større).

**Tema.** Der er ét: lyst. Intet i koden læser Windows' valg af lyst eller mørkt, og intet beder Windows om en mørk titellinje.

**Git.** Repoet har ingen `.gitattributes`. Kit-kopier skal have `-text`, ellers kan git på Windows lave linjeskift om, så kopien ikke længere er byte for byte som pakken.

**Skrift og ikoner.** Segoe UI til tekst, `Cascadia Mono, Consolas` til værdier og `Segoe MDL2 Assets` til ikoner (som tegn i en `TextBlock`).

**Sprog.** `L.cs` slår op i `Resources/Strings.resx` (engelsk, neutralt) og `Strings.da.resx` (dansk); 99 tekster i hver. Sproget følger Windows; der er ingen sprogvælger i programmet.

## Rækkefølgen

1. **Tokens ind.** Kopiér `tokens/Tokens.xaml` til projektet (fx `src/Wi24rdFTP/Tokens/Tokens.xaml`), notér pakkens version ved siden af, og giv kopien `-text` i en `.gitattributes` (se pakkens README, "Sådan opdaterer du til en ny version"). Flet filen ind i `App.xaml` som beskrevet i README. `App.xaml` har i dag sine ressourcer direkte i `Application.Resources`; de skal ind i en `ResourceDictionary` med `MergedDictionaries`, før filen kan flettes ind. Kald `SaetTema` i `OnStartup` (den findes allerede i `App.xaml.cs`), før hovedvinduet laves: ingen token findes før det. Filen bygger; **om den indlæses, viser prøven på Windows** (se "Det, der ikke kan flyttes endnu").
2. **Penslerne skiftes direkte til kittets.** De 99 `{StaticResource Brush.…}` i XAML bliver `{DynamicResource Wi24rd…Brush}`, og de 13 `FindResource("Brush.…")` i `MainWindow.xaml.cs` bliver `SetResourceReference` med kittets nøgle, så farven følger temaet. De 30 gamle nøgler slettes; de 6 ubrugte uden erstatning. Forslag til oversættelse (skal bekræftes af Jan, når det ses på skærmen):

   | I dag | Kit 2 |
   |---|---|
   | `Brush.Bg` | `Wi24rdBgBrush` |
   | `Brush.Card` | `Wi24rdSurfaceBrush` |
   | `Brush.Field`, `Brush.Hover` | `Wi24rdSurfaceRaisedBrush` |
   | `Brush.Border` | `Wi24rdBorderBrush` (til kort) og `Wi24rdBorderStrongBrush` (til felter og knapper) |
   | `Brush.Text` | `Wi24rdTextBrush` |
   | `Brush.Muted`, `Brush.Grey` (som tekst) | `Wi24rdTextMutedBrush` |
   | `Brush.Accent`, `Brush.Green` | `Wi24rdAccentBrush` (handling og valgt), `Wi24rdTextMutedBrush` (ikon ved en etiket) eller `Wi24rdInfoBrush` (oplysning) |
   | `Brush.AccentDark` | `Wi24rdAccentHoverBrush` |
   | `Brush.AccentPale` | `Wi24rdAccentSoftBrush` (valgt) eller `Wi24rdInfoSoftBrush` (oplysning) |
   | `Brush.Ok` (som tekst) | `Wi24rdOkBrush` (egen token siden 2.1.0; ikke `Wi24rdAccentBrush`) |
   | Statusprikkerne, sat fra koden: `Brush.Ok`, `Brush.Amber`, `Brush.Grey`, `Brush.Red` | `Wi24rdOkMarkBrush`, `Wi24rdWarnMarkBrush`, `Wi24rdNoneMarkBrush`, `Wi24rdDangerMarkBrush`. Hver prik skal have et ord ved siden af: farve bærer aldrig betydning alene |
   | `Brush.Red` (som tekst og kant) | `Wi24rdDangerBrush`, med `Wi24rdDangerSoftBrush` som bund |
   | `Brush.Amber` / `Brush.AmberPale` (banner) | `Wi24rdWarnBrush` / `Wi24rdWarnSoftBrush` |
   | `Brush.HeaderGradient` | `Wi24rdRailBrush` (titellinjen er ensfarvet i Kit 2) |
   | `Brush.PrimaryGradient` | `Wi24rdAccentBrush` (ingen farveforløb i Kit 2) |
   | `Brush.Navy`, `NavyLight`, `Cyan`, `GreenDark`, `GreenPale`, `RedPale` | Bruges ingen steder; slettes |

   `Brush.Border` og `Brush.Accent` kan ikke oversættes med søg og erstat: hvert sted skal ses for sig, fordi kittet har flere tokens til det, FTP har én pensel til.

   Et mellemled, hvor de gamle nøgler bliver og peger på kittet, kan ikke laves (det stod som trin 2 i denne vejledning til og med 2.3.0). Kittets nøgler ligger inde i `Wi24rdLys` og `Wi24rdMoerk` og findes først på øverste niveau, når `SaetTema` har kørt, altså efter at `App.xaml` er læst. Et `StaticResource` fra `App.xaml` til en kit-nøgle kan derfor ikke slås op, og det ville heller ikke følge et temaskift.
3. **Farvekoderne væk.** De 37 + 7 farvekoder erstattes af kittets pensler. Det tager også hover-laget i knapperne (`#000000` med gennemsigtighed) og de to farveforløb.
4. **Tema.** Læs Windows' valg ved start, kald `SaetTema`, og skift, når Windows skifter. Bed Windows om en mørk titellinje i mørkt tema; den bliver ikke mørk af sig selv. Adgangskodens tegn skal tegnes igen ved et skift. Vælg her, om programmet også skal have sit eget valg (lys, mørk, system) som de web-baserede programmer.
5. **Stilarterne tegnes om efter kittet.** De 16 stilarter får kittets mål og former ud fra `KOMPONENTER.md` og demoen: knapper 36 px høje med `Wi24rdRadiusMd` og fire varianter; kort med kant frem for skygge; etiketter som `label` (11 px, store bogstaver); værdier i mono; `FileList` som DataTable (rækker på 40 px, hoved på 34 px, hele rækken vælges; de to stilarter uden navn hører med her); bannerne som Banner med symbol og højst én handling; og en dialog efter kittets mål (Dialog i `KOMPONENTER.md`) i stedet for de 9 `MessageBox`. Tallene i XAML erstattes af `Wi24rdBodySize`, `Wi24rdSpace3Thickness` og de andre tokens.
6. **Skallen.** Den blå hoved med farveforløb bliver til kittets titellinje (34 px, `Wi24rdRailBrush`) eller til Windows' egen titellinje plus en rolig overskrift. Programmet har én skærm, så handlingsbånd med faner og navigationsrude giver næppe mening her: bundlinjens knapper og en fodlinje med "kun på denne maskine" og versionen er nok. Det er Jans valg.
7. **Skrift.** Vælg: Segoe UI (det, `Wi24rdFontSans` falder tilbage til uden videre) eller Inter lagt ind i projektet som statiske TTF-filer med en `pack://`-sti (se README, "Skrifterne i WPF"). Det samme for mono (Cascadia Mono er allerede kittets første reserve).

## Det, der ikke kan flyttes endnu

| Hvad | Hvorfor |
|---|---|
| `Tokens.xaml` er ikke indlæst af WPF endnu | Filen bygger: WPF's XAML-oversætter i .NET 8 SDK gav 0 fejl og 0 advarsler i FTP's fase A (2026-11-11, på Linux), også flettet ind i en kopi af FTP, og `xmlns:sys` (`assembly=System.Runtime`) blev godkendt ved byg. Ikke prøvet: at de to ordbøger, der ligger som ressourcer med `x:Key` i filen, kan hentes med `FindResource` og skiftes i et åbent vindue. Det kræver Windows; prøven ligger i FTP-repoet (`claude_cowork/from-cowork/tokens-proeve/`). Virker det ikke, er rettelsen i kittets byggescript, ikke i FTP |
| Komponenterne | Kittet har dem kun til web. Stilarterne i trin 5 er FTP's eget arbejde og bør bagefter løftes op i kittet som dets WPF-udgave, så det næste WPF-program får dem |
| Fyldt rød knap til Stop | Jan har valgt (2026-11-11), at en farlig handling som Stop må være fyldt rød. Kittets `danger` er kant og tekst. Den fyldte udgave kræver en ny token til teksten på rødt og kommer derfor i en ny pakke, efter prøven på Windows. Indtil da tegner FTP den selv og mærker stedet `KIT-ØNSKE F7` |
| Knap med kun ikon | Får ikke sin egen beskrivelse i kittet (Jans valg, 2026-11-11). `IconButton`, `HeaderIconButton` og `RowIconButton` tegnes som Button med ikon og et navn, der siger, hvad der sker |
| Inter og JetBrains Mono | Pakken har dem kun som woff2, som WPF ikke læser, og filerne er variable skrifter. WPF skal have statiske TTF-filer |
| Ikonerne | Kittets stregikoner er SVG-stier i `kit.js`. FTP bruger Segoe MDL2 Assets. En WPF-udgave af ikonerne (som `Geometry`) findes ikke |
| Bogstavafstand (`…Tracking`) | WPF har ingen egenskab til det på `TextBlock`. Etiketter med store bogstaver bliver uden den ekstra afstand |
| Skyggernes spredning | Findes ikke i `DropShadowEffect`; `Wi24rdShadowPop` er derfor lidt bredere end i CSS |
| Sprogets mekanik | Kittets `sprogmotor.js` er til web. FTP beholder `L.cs` og `.resx`. Kun tonen (du-form, korte sætninger, tal før ord) flytter med |
| Farverne til adgangskodens tegn (`Brush.PwDigit`, `PwUpper`, `PwLower` og deres blege udgaver) | Kit 2 har ingen tokens til det. De bliver programmets egne, men skal vælges, så de kan læses i begge temaer |

## Det, der skal tages om bagefter

- **Skærmbilleder og banner.** `docs/screenshot.png`, `docs/banner.jpg` og `docs/banner-original.png` viser det blå udseende.
- **README.** `README.md` og `README.da.md` skal ses efter for billeder og beskrivelser af udseendet.
- **Logo og ikon.** `Assets/logo.svg`, `logo-*.png` og `wi24rd-ftp.ico` er programmets egne og bliver, men skal ses sammen med den mørke titellinje og den grønne accent.
- **Installationsprogrammet.** `installer/Wi24rdFTP.iss` skal ses efter for billeder eller farver.
- **Mørkt tema.** Det er nyt for FTP: hver skærm, hvert banner og begge vinduer skal ses i begge temaer, og de farver, der bliver programmets egne, skal måles for kontrast.

## Forslag til cyklusser

| Cyklus | Indhold | Kan afleveres alene |
|---|---|---|
| A (undersøgelse) | Flet `Tokens.xaml` ind i en kopi og byg (gjort: den bygger), og kør prøven på Windows: indlæses den? Mål, hvor mange steder der skal røres (gjort). Jan vælger skal (titellinje), skrift og tema | Ja |
| B1 | Trin 1–3: tokens ind, alle penselopslag (99 i XAML, 13 i koden) til kittets nøgler med `DynamicResource` og `SetResourceReference`, farvekoderne væk, de 6 ubrugte pensler slettet. Lyst tema, fast. Større end før, men ét gennemløb af XAML'en i stedet for to | Ja |
| B2 | Trin 4: tema, der følger Windows (og eget valg, hvis Jan vælger det), mørk titellinje, adgangskodens farver i begge temaer | Ja |
| B3 | Trin 5–7: stilarterne tegnet om, dialogen, skallen og skriften | Ja |
| B4 | Skærmbilleder, banner og README; og stilarterne løftet tilbage til kittet som WPF-udgave | Ja |

## Ikke undersøgt

- Hvordan programmet ser ud, når det kører: kun koden er læst, og intet er bygget.
- Om `Tokens.xaml` kan indlæses af WPF (se ovenfor): den bygger, men prøven på Windows er ikke kørt.
- `Scripts/Wi24rdFtp.ps1`, `Services/` og `installer/`: de er ikke læst for udseende.
- Wi24rd Sandbox, som er nævnt sammen med FTP i planen for kittet: det er ikke fundet i dette repo og er ikke undersøgt. Se `WI24RD-SANDBOX.md`.
- Byggeforløbet i `.github/workflows/`: om en ny XAML-fil kræver ændringer dér.
