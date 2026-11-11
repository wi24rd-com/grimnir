# Wi24rd UI Kit 2

Ro, klarhed og ét tydeligt næste skridt. Kittet er fælles udseende og opførsel for Wi24rd-programmerne (Grimnir først; Huginn and Muninn og FTP kan følge efter) og afløser UI kit 1.0 med det blå bånd.

## Hvor det kommer fra

Jan pegede den 10. november 2026 på Veeams programflader som forbillede: de er rolige, lyse og får tunge driftsopgaver til at føles overskuelige. Jan sendte samme dag et skærmbillede af konsollen med de zoner, han holder af. Kittet låner **opbygningen og principperne**, ikke udseendet:

| Princip, vi tager med | Sådan gør vi det selv |
|---|---|
| Handlingsbånd øverst med kommandoer i faste grupper | CommandBar: ikon over ord, gruppens navn under, én primær kommando |
| Navigationsrude til venstre med træ øverst og visningsskift nederst | NavPane |
| Arbejdsflade med søgning, filter og tabel | AppShell med DataTable |
| Fodlinje med det, der altid gælder | StatusFooter |
| Lys, rolig arbejdsflade med én mættet farve | `accent` er nordlysgrøn og bruges kun til den primære handling, valg og OK |
| Guider, der tager én beslutning ad gangen | Wizard med trinliste, indhold og fast fodlinje |
| Tydelige statusser, man kan handle på | StatusTile og StatusChip |
| Lys, mørk eller som systemet | to temaer med samme tokens |

Det er bevidst **ikke** en kopi: zonerne er almindelige mønstre for skrivebordsprogrammer, men ingen af Veeams farveværdier, logoer, ikoner, skrifter eller skærmbilleder er brugt. Titellinjen er mørk marineblå (`rail`) og ikke grøn, accenten er nordlysgrøn, og ikonerne er egne stregikoner.

## Hvor vi vil være bedre

1. **Status hviler aldrig på farve alene.** Hver status har symbol, ord og farve, og advarsel og fejl skiller sig også ud i lyshed.
2. **Alt kan betjenes fra tastaturet**, med synlig fokusring i `info`.
3. **Kontrast er målt.** Al tekst har mindst 4,5:1 mod sin flade i begge temaer; kanter på kontroller mindst 3:1.
4. **Klart sprog.** Knapper siger, hvad der sker. Fejl siger, hvad der er galt, og hvad man gør.
5. **Tillid er synlig.** Programmer, der holder alt lokalt, siger det fast i fodlinjen.
6. **Ingen pynt med tal.** En flise findes kun, når brugeren handler på tallet.
7. **Båndet er roligt.** Én primær kommando pr. visning, højst otte knapper pr. fane, og kommandoer flytter sig aldrig.

## Farver

- **Flader:** `bg` bag alt, `surface` til arbejdsflade, kort og tabeller, `surface-raised` til handlingsbånd, hoveder og fodlinjer. `rail` er titellinjen og er mørk i begge temaer.
- **Tekst:** `text` og `text-muted`. Intet tredje gråt.
- **Accent:** `accent` med `on-accent` ovenpå; `accent-soft` til valgte rækker og OK-chips. Højst én primær knap pr. skærm.
- **Signaler:** `info`, `warn`, `danger`, hver med en `-soft` flade. De betyder altid det samme.
- **Kanter:** `border` til skillelinjer, `border-strong` til kontroller.

## Skrift

Inter til alt, JetBrains Mono til værdier. Begge hentes fra Google Fonts i forhåndsvisningerne i `components/`; pakken har skriftfilerne med (OFL-licens, `pakke/web/fonts/`), så et program og demosiden ikke bruger net. Uden skriftfilerne bruges systemskriften (`Segoe UI`, `system-ui`). Brødtekst er `body` (14/20). Værdier, brugeren skal kontrollere, står altid i `mono`.

## Form og luft

Små radier (`radius-sm` 4, `radius-md` 6, `radius-lg` 10) og kanter frem for skygger. Luft i trin på 4 px (`space-1` til `space-8`). Kontroller er 36 px høje, tabelrækker 40 px.

## Ikoner

Stregikoner på 16 eller 18 px, 2 px streg, runde ender, tegnet i `currentColor`. Kittet har ikke sit eget ikonsæt endnu; forhåndsvisningerne bruger nogle få håndtegnede. Ingen emoji.

## Sprog

Dansk først, engelsk med samme nøgler. Du-form, korte sætninger, ingen udråbstegn. Tal før ord i statusser: "13 maskeres · 2 venter på dig".

## Nordisk detalje

Fletbaand er det ene pynteelement, og det er valgfrit. Runemærker og lignende hører til det enkelte programs logo, ikke til kittet.

## Pakken

Kittet findes som pakket kode i `pakke/` (version i `pakke/VERSION`): tokens som JSON, CSS og XAML, komponenterne til web, tema og sprogets mekanik, skrifterne, en demoside og vejledninger. `pakke/README.md` siger, hvordan et program tager det i brug; `pakke/KOMPONENTER.md` beskriver hver komponent. Pakken er kittets ene kilde: Grimnirs egne kopier i `ui/assets/` laves af `npm run kit`.

Som kode findes: AppShell, CommandBar, NavPane, StatusFooter, DataTable, StatusChip, Button, TextField, Banner, Wizard, Fletbaand, stregikoner, tema og sprog. Forhåndsvisningerne i `components/` er de oprindelige skitser; StatusTile og Cover findes kun dér.

## Det mangler

- Logo og app-ikoner (hører til det enkelte program).
- Et fuldt ikonsæt: `kit.js` har de almene stregikoner; et program lægger sine egne til.
- Dialog, menu, værktøjstip, tom tilstand og fremdrift.
- Afkrydsning, kontakt (til/fra) og valgliste.
- StatusTile og Cover som kode.
- Komponenter til WPF: pakken har kun tokens (`pakke/tokens/Tokens.xaml`), og skrifterne findes kun som woff2.
