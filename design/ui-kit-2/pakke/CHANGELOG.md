# Ændringer i Wi24rd UI Kit 2

Første tal stiger, når et program skal ændre noget for at følge med. Andet tal ved nyt. Tredje tal ved rettelser.

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
