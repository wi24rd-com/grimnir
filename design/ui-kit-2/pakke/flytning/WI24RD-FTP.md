# Flytning: Wi24rd FTP til UI Kit 2

Skrevet ud fra en læsning af repoet `Wi24rd-FTP` den 2026-11-11 (seneste commit `514c97c`). Repoet er kun læst; intet er ændret. Alt herunder er set i koden, medmindre det står under "Ikke undersøgt". Programmet er ikke bygget eller startet: det er et Windows-program, og læsningen er sket på macOS.

Læs pakkens `README.md` (afsnittet om WPF) først. Det vigtigste at vide: **pakken har kun tokens til WPF** (`tokens/Tokens.xaml`). Komponenterne findes kun til web.

## Hvad programmet har i dag

**Teknik.** .NET 8 WPF (`net8.0-windows`), ét projekt: `src/Wi24rdFTP/Wi24rdFTP.csproj`. Ingen UI-pakker; den eneste pakke er `System.ServiceProcess.ServiceController`.

**Skærme.** To vinduer: `MainWindow.xaml` (405 linjer; 1020 × 800, mindst 900 × 680) og `AboutWindow.xaml` (55 linjer). Bekræftelser og fejl vises med Windows' egne `MessageBox`. Hovedvinduet er ét billede uden faner eller navigation: en blå hoved på 84 px med farveforløb, op til tre bannere (forudsætninger, administrator, opdatering), et statuskort, et kort med delte filer (slip-zone og en `ListView`), et kort med forbindelsen (FTP eller SFTP som to valg ved siden af hinanden, adresser, adgangskode) og en nederste række på 86 px.

**Udseende.** Alt ligger i `App.xaml` (282 linjer) som ressourcer direkte i `Application.Resources`:

- 30 pensler med nøgler som `Brush.Accent`, `Brush.Card`, `Brush.Border`, `Brush.Text`, `Brush.Muted`, `Brush.AmberPale` og to farveforløb (`Brush.HeaderGradient`, `Brush.PrimaryGradient`). Paletten er blå og kun lys.
- 16 stilarter: `BaseButton`, `PrimaryButton`, `DangerButton`, `SecondaryButton`, `LinkButton`, `IconButton`, `HeaderIconButton`, `RowIconButton`, `SegmentRadio`, `Card`, `CardTitle`, `Label`, `LabelIcon`, `Value`, `MonoValue` og `FileList`.
- Farvekoder står direkte i XAML: 37 steder i `App.xaml` og 7 i `MainWindow.xaml`.
- Alt bruges med `StaticResource`. `DynamicResource` bruges ingen steder.
- Hjørner (`CornerRadius`) og skriftstørrelser står som tal i XAML (13, 14, 12, 16, 15, 18 og enkelte større).

**Tema.** Der er ét: lyst. Intet i koden læser Windows' valg af lyst eller mørkt.

**Skrift og ikoner.** Segoe UI til tekst, `Cascadia Mono, Consolas` til værdier og `Segoe MDL2 Assets` til ikoner (som tegn i en `TextBlock`).

**Sprog.** `L.cs` slår op i `Resources/Strings.resx` (engelsk, neutralt) og `Strings.da.resx` (dansk); 99 tekster i hver. Sproget følger Windows; der er ingen sprogvælger i programmet.

## Rækkefølgen

1. **Tokens ind.** Kopiér `tokens/Tokens.xaml` til projektet (fx `src/Wi24rdFTP/Tokens/Tokens.xaml`) og flet den ind i `App.xaml` som beskrevet i pakkens README. `App.xaml` har i dag sine ressourcer direkte i `Application.Resources`; de skal ind i en `ResourceDictionary` med `MergedDictionaries`, før filen kan flettes ind. **Det første, der skal ske, er at bygge og starte programmet**: `Tokens.xaml` er endnu ikke prøvet i et WPF-projekt (se "Det, der ikke kan flyttes endnu").
2. **Penslerne peger på kittet.** Lad de 30 `Brush.*`-nøgler blive, men giv dem kittets farver, så resten af XAML'en ikke skal røres i samme trin. Forslag til oversættelse (skal bekræftes af Jan, når det ses på skærmen):

   | I dag | Kit 2 |
   |---|---|
   | `Brush.Bg` | `Wi24rdBgBrush` |
   | `Brush.Card` | `Wi24rdSurfaceBrush` |
   | `Brush.Field`, `Brush.Hover` | `Wi24rdSurfaceRaisedBrush` |
   | `Brush.Border` | `Wi24rdBorderBrush` (til kort) og `Wi24rdBorderStrongBrush` (til felter og knapper) |
   | `Brush.Text` | `Wi24rdTextBrush` |
   | `Brush.Muted`, `Brush.Grey` | `Wi24rdTextMutedBrush` |
   | `Brush.Accent`, `Brush.Green` | `Wi24rdAccentBrush` |
   | `Brush.AccentDark`, `Brush.GreenDark` | `Wi24rdAccentHoverBrush` |
   | `Brush.AccentPale`, `Brush.GreenPale` | `Wi24rdAccentSoftBrush` (valgt) eller `Wi24rdInfoSoftBrush` (oplysning) |
   | `Brush.Ok` | `Wi24rdAccentBrush` |
   | `Brush.Red` / `Brush.RedPale` | `Wi24rdDangerBrush` / `Wi24rdDangerSoftBrush` |
   | `Brush.Amber` / `Brush.AmberPale` | `Wi24rdWarnBrush` / `Wi24rdWarnSoftBrush` |
   | `Brush.Navy`, `Brush.HeaderGradient` | `Wi24rdRailBrush` (titellinjen er ensfarvet i Kit 2) |
   | `Brush.PrimaryGradient` | `Wi24rdAccentBrush` (ingen farveforløb i Kit 2) |

   En pensel kan ikke pege på en anden med `StaticResource` og samtidig følge et temaskift. Skal temaet kunne skiftes, mens programmet kører, skal de gamle nøgler væk, og XAML'en bruge `{DynamicResource Wi24rd…Brush}` direkte (trin 4).
3. **Farvekoderne væk.** De 37 + 7 farvekoder erstattes af kittets pensler. Det tager også hover-laget i knapperne (`#000000` med gennemsigtighed) og de to farveforløb.
4. **Fra `StaticResource` til `DynamicResource`** for alt fra kittet, og et tema ved start: læs Windows' valg, flet `Wi24rdLys` eller `Wi24rdMoerk` ind, og skift, når Windows skifter. Vælg her, om programmet også skal have sit eget valg (lys, mørk, system) som de web-baserede programmer.
5. **Stilarterne tegnes om efter kittet.** De 16 stilarter får kittets mål og former ud fra `KOMPONENTER.md` og demoen: knapper 36 px høje med `Wi24rdRadiusMd` og fire varianter; kort med kant frem for skygge; etiketter som `label` (11 px, store bogstaver); værdier i mono; `FileList` som DataTable (rækker på 40 px, hoved på 34 px, hele rækken vælges); bannerne som Banner med symbol og højst én handling. Tallene i XAML erstattes af `Wi24rdBodySize`, `Wi24rdSpace3Thickness` og de andre tokens.
6. **Skallen.** Den blå hoved med farveforløb bliver til kittets titellinje (34 px, `Wi24rdRailBrush`) eller til Windows' egen titellinje plus en rolig overskrift. Programmet har én skærm, så handlingsbånd med faner og navigationsrude giver næppe mening her: bundlinjens knapper og en fodlinje med "kun på denne maskine" og versionen er nok. Det er Jans valg.
7. **Skrift.** Vælg: Segoe UI (det, `Wi24rdFontSans` falder tilbage til uden videre) eller Inter lagt ind i projektet som TTF/OTF. Det samme for mono (Cascadia Mono er allerede kittets første reserve).

## Det, der ikke kan flyttes endnu

| Hvad | Hvorfor |
|---|---|
| `Tokens.xaml` er ikke bygget | Filen er lavet og kontrolleret på macOS: velformet XML, alle tokens i begge ordbøger, samme farver som CSS. Den er aldrig indlæst af WPF. Usikkert indtil prøvet: at de to ordbøger, der ligger som ressourcer med `x:Key` i filen, kan flettes ind med `FindResource` som beskrevet; og `xmlns:sys` (`assembly=System.Runtime`). Virker det ikke, er rettelsen i kittets byggescript, ikke i FTP |
| Komponenterne | Kittet har dem kun til web. Stilarterne i trin 5 er FTP's eget arbejde og bør bagefter løftes op i kittet som dets WPF-udgave, så det næste WPF-program får dem |
| Inter og JetBrains Mono | Pakken har dem kun som woff2, som WPF ikke læser |
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
| A (undersøgelse, på Windows) | Flet `Tokens.xaml` ind i en kopi og byg: virker filen, som den er? Mål, hvor mange steder der skal røres. Jan vælger skal (titellinje) og skrift | Ja |
| B1 | Trin 1–3: tokens ind, penslerne peger på kittet, farvekoderne væk. Programmet får kittets farver i lyst tema | Ja |
| B2 | Trin 4: `DynamicResource` og mørkt tema, der følger Windows | Ja |
| B3 | Trin 5–7: stilarterne tegnet om, skallen og skriften | Ja |
| B4 | Skærmbilleder, banner og README; og stilarterne løftet tilbage til kittet som WPF-udgave | Ja |

## Ikke undersøgt

- Hvordan programmet ser ud, når det kører: kun koden er læst, og intet er bygget.
- Om `Tokens.xaml` kan indlæses af WPF (se ovenfor).
- `MainWindow.xaml.cs` (581 linjer): om koden sætter farver eller stilarter selv ud over det, XAML'en gør. En søgning efter farvekoder i `.cs`-filerne gav ingen.
- `Scripts/Wi24rdFtp.ps1`, `Services/` og `installer/`: de er ikke læst for udseende.
- Wi24rd Sandbox, som er nævnt sammen med FTP i planen for kittet: det er ikke fundet i dette repo og er ikke undersøgt. Se `WI24RD-SANDBOX.md`.
- Byggeforløbet i `.github/workflows/`: om en ny XAML-fil kræver ændringer dér.
