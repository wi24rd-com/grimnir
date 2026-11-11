# Komponenterne i Wi24rd UI Kit 2

Det her er, hvad `web/kit.css`, `web/kit.js`, `web/tema.js` og `web/sprogmotor.js` har i pakkens version (se `VERSION`). En test holder listen og koden ens: hver komponent herunder har mindst én klasse eller funktion i kittet, og hver klasse og funktion i kittet står under en komponent.

Se dem alle i `demo/index.html`.

Fælles for alle funktioner i `Kit`:

- En tekst gives enten som nøgle (`t: 'noegle'`), der bliver til `data-t` og udfyldes af `Sprog.anvend(rod)`, eller som færdig tekst (`tekst: 'Gem'`).
- En `aria-label` gives som nøgle (`ariaT`) eller som færdig tekst (`aria`).
- Funktionerne returnerer elementer, programmet selv sætter ind. Kald `Sprog.anvend(element)` bagefter, hvis der er brugt nøgler.
- Intet bygges med `innerHTML`.

## Grundlag

**Klasser:** `.mono`, `.muted`, `.label`, `.ik`, `.skjult-tekst`

**Formål:** Det, alle skærme deler: sidens baggrund, tekstfarve og skrift, hjælpeklasser og fokusringen.

**Markup:**

```html
<span class="label">Kolonnenavn</span>
<span class="muted">Sekundær tekst</span>
<span class="mono">srv-app01.eksempel.dk</span>
<svg class="ik" viewBox="0 0 24 24" aria-hidden="true">…</svg>
<span class="skjult-tekst">Kun til skærmlæsere</span>
```

**Tilstande:** `[hidden]` skjuler altid. `:focus-visible` giver en ring på 2 px i `info` på alt, der kan aktiveres.

**Tastatur:** Fokusringen vises ved Tab, ikke ved museklik.

**Kræver af programmet:** `tokens.css` før `kit.css`. Værdier, brugeren skal kunne læse tegn for tegn, står i `.mono`.

### Farver til status, data og kort (fra 2.1.0)

Ud over fladerne, teksten, accenten og signalerne har kittet fire grupper af farver. De er tokens, ikke komponenter: programmet tegner selv prikken, søjlen eller kortet.

| Gruppe | Tokens | Bruges til | Krav |
|---|---|---|---|
| Ok | `--ok`, `--ok-soft` | Tekst, symbol og flade for "alt er godt" (OK-chip, OK-banner) | Som `--accent`: 4,5:1 som tekst |
| Mærker | `--ok-mark`, `--warn-mark`, `--danger-mark`, `--info-mark`, `--none-mark` | Statusprikker, søjler, markører | 3:1 mod `--surface`, `--surface-raised` og `--bg` |
| Data | `--data-1` … `--data-6`, `--data-axis`, `--data-grid`, `--data-label` | Diagrammer | Serier og akse 3:1; etiketter 4,5:1 |
| Skala | `--seq-1` … `--seq-5` | Fra lidt til meget: kort, varmekort | Nabotrin skilles ad i lyshed (mindst 1,3:1) |
| Kort | `--map-sea`, `--map-land`, `--map-border`, `--map-ring`, `--map-arc` | Verdenskort og lignende | Ring og bue 3:1 mod land og hav |

Regler:

- **Accent og ok.** `--accent` er handlingen (primær knap, valg, aktiv fane). `--ok` er betydningen "alt er godt". De har samme grønne i dag. Brug altid `--ok`, når noget melder en tilstand, og `--accent`, når noget kan trykkes eller er valgt. En primær knap må stå ved siden af en OK-chip: chippen har blød flade, symbol og ord; knappen er fyldt.
- **Aldrig farve alene.** En prik står sammen med et ord. En serie har en etiket eller en forklaring. Et trin på skalaen har en forklaring med tal.
- **Faste betydninger.** Fejl og angreb er `--danger-mark`. Oplysning og besøg er `--info-mark` (samme blå som `--data-1`). Advarsel er `--warn-mark`. En betydning skifter aldrig farve fra visning til visning.
- **Dataserier bruges i rækkefølge** (`--data-1` først) og højst seks ad gangen. Har et diagram flere serier, samles de mindste i "Andre" (`--none-mark`).
- **Mærker og serier er ikke tekst.** Tekst i statusfarve bruger `--ok`, `--warn`, `--danger` og `--info`; tal og etiketter i et diagram bruger `--data-label`.
- **Skalaen** går fra `--seq-1` (lidt) til `--seq-5` (meget). I lyst tema bliver trinene mørkere, i mørkt tema lysere; land uden data er `--map-land`.

## AppShell

**Klasser:** `.vindue`, `.titel`, `.mrk`, `.rk`, `.hoejre`, `.midte`, `.arb`, `.vl`, `.soeg`, `.fl`, `.flade`

**Formål:** Programmets faste opbygning: titellinje (34 px, mørk i begge temaer), handlingsbånd, navigationsrude til venstre, arbejdsflade med værktøjslinje, og fodlinje.

**Markup:**

```html
<div class="vindue">
  <header class="titel">
    <span class="mrk" aria-hidden="true">W</span>
    <b>Programmets navn</b>
    <span class="hoejre">
      <button type="button" class="rk" aria-label="Åbn indstillinger">…</button>
    </span>
  </header>
  <div id="baand"></div>                         <!-- Kit.commandBar -->
  <div class="midte">
    <nav class="nav" aria-label="Navigation">…</nav>   <!-- NavPane -->
    <main class="arb">
      <div class="vl">
        <label class="soeg"><svg>…</svg><input type="search" placeholder="Søg"></label>
        <button type="button" class="fl"><svg>…</svg>Filter</button>
        <span class="hoejre">…</span>
      </div>
      <div class="flade">…</div>                 <!-- tabellen eller visningens indhold; ruller selv -->
      <footer class="fodl">…</footer>            <!-- StatusFooter -->
    </main>
  </div>
</div>
```

**Tilstande:** `.rk` (knap på titellinjen) har hover. `.fl` og søgefeltet kan være `disabled`; `.fl` kan også have `aria-disabled="true"`. `.soeg` får fokusringen, når feltet i den har fokus.

**Tastatur:** Tab går gennem titellinjens knapper, båndet, navigationsruden og arbejdsfladen i den rækkefølge.

**Kræver af programmet:** Mindste vindue 900 × 560 px. Titellinjens indhold (mærke, navn, det til højre). Har vinduet styresystemets knapper oven på titellinjen, giver programmet selv plads i sin egen CSS (fx `padding-left` på `.titel`). Skal titellinjen kunne trækkes, sætter programmet det selv (i Tauri: `data-tauri-drag-region`).

## CommandBar

**Klasser:** `.cmd`, `.tabs`, `.tab`, `.on`, `.grupper`, `.grp`, `.kn`, `.cap`, `.cb`, `.pri`

**Funktioner:** `Kit.commandBar`

**Formål:** Handlingsbåndet øverst: faner, og under hver fane kommandoer i navngivne grupper med ikon over ord.

**Markup:** Bygges af funktionen i et tomt element.

```js
const baand = Kit.commandBar(document.getElementById('baand'), {
  ariaT: 'cmdAria',
  valgt: 'start',
  faner: [{ id: 'start', t: 'faneStart', grupper: [
    { t: 'gFil', knapper: [
      { id: 'aabn', t: 'kAabn', ikon: 'fil', pri: true, ved: () => aabn() },
      { id: 'kopier', t: 'kKopier', ikon: 'kopier', deaktiveret: true, hvorfor: 'hvorforIntetValgt' },
      { id: 'lys', t: 'kLys', ikon: 'sol', trykket: true, ved: () => Tema.saet('lys') },
    ] },
  ] }],
  vedFane: id => {},
});
baand.knap('kopier');        // knappens element
baand.vaelgFane('start');    // skift fane fra koden
```

**Tilstande:** Aktiv fane (`.tab.on`, `aria-selected`). Primær kommando (`.cb.pri`). Trykket (`aria-pressed="true"`). Deaktiveret (`aria-disabled="true"`): knappen står nedtonet, kan stadig nås med Tab og siger hvorfor i `title`; den forsvinder ikke.

**Tastatur:** Venstre og højre pil skifter fane, Home og End går til første og sidste. Tab går ind i kommandoerne. Enter og mellemrum aktiverer.

**Kræver af programmet:** Hvad hver kommando gør (`ved`). At ændre en knaps tilstand selv (`aria-disabled`, `aria-pressed`, `data-t-title`) på elementet fra `baand.knap(id)`. Højst én primær kommando pr. visning og højst otte knapper pr. fane. Fanerne skifter båndets indhold, aldrig visningen.

## NavPane

**Klasser:** `.nav`, `.trae`, `.tr`, `.ant`, `.skift`, `.vs`

**Funktioner:** `Kit.navTrae`, `Kit.visningsskift`

**Formål:** Navigationsruden til venstre (232 px): øverst et træ, der filtrerer arbejdsfladen; nederst visningsskiftet, der skifter visning.

**Markup:**

```html
<nav class="nav" aria-label="Navigation">
  <h3>Filtre</h3>
  <ul id="trae"></ul>
  <div id="skift"></div>
</nav>
```

```js
const trae = Kit.navTrae(document.getElementById('trae'), [
  { id: 'alle', t: 'tAlle', antal: 16, boern: [{ id: 'tjek', t: 'tTjek', antal: 2 }] },
], { ariaT: 'traeAria', valgt: 'alle', vedValg: id => filtrer(id) });
trae.vaelg('tjek');

const skift = Kit.visningsskift(document.getElementById('skift'), [
  { id: 'filer', t: 'vFiler', ikon: 'mappe', genvej: '⌘1', genvejAria: 'Meta+1' },
], { ariaT: 'visninger' });
skift.markér('filer');
```

**Tilstande:** Valgt punkt i træet (`.tr.on`, `aria-current`). Foldet ud eller ind (`aria-expanded`). Aktiv visning (`.vs.on`, `aria-current="page"`).

**Tastatur:** I træet: op og ned flytter, Home og End går til første og sidste, højre folder ud, venstre folder ind eller går til forælderen, Enter og mellemrum vælger. Visningsskiftets punkter er links og nås med Tab.

**Kræver af programmet:** Hvad et valg i træet filtrerer (`vedValg`). Selve visningsskiftet: hvert punkt er et link til `#id`; programmet viser den rigtige visning, kalder `markér(id)` og sætter selv eventuelle genveje. Højst seks visninger, altid i samme rækkefølge.

## StatusFooter

**Klasser:** `.fodl`, `.h`

**Formål:** Fodlinjen (26 px) med det, der altid gælder: antal til venstre, tillid og version til højre.

**Markup:**

```html
<footer class="fodl">
  <span>16 fund · 13 maskeres</span>
  <span class="h">
    <span><svg viewBox="0 0 24 24" aria-hidden="true">…</svg>Kun på denne maskine</span>
    <span>Version 1.0.0</span>
  </span>
</footer>
```

**Tilstande:** Ingen.

**Tastatur:** Ingen; fodlinjen er tekst. Er noget i den klikbart, er det en almindelig knap eller et link.

**Kræver af programmet:** Teksterne. Tal før ord. Programmer, der holder alt lokalt, siger det her.

## DataTable

**Klasser:** `.tabel`, `.r`, `.gruppe`, `.sel`

**Funktioner:** `Kit.tabel`

**Formål:** Tabellen på arbejdsfladen: rækker på 40 px, grupper, tal til højre, værdier i mono. Hele rækken vælges.

**Markup:** Bygges af funktionen.

```js
const tabel = Kit.tabel({
  ariaT: 'tabelAria',
  kolonner: [{ t: 'kolVaerdi' }, { t: 'kolStatus' }, { t: 'kolAntal', tal: true }],
  raekker: [
    { gruppe: { t: 'grpAdresser' }, note: '2 rækker' },
    { celler: ['192.0.2.17', Kit.chip('ok', { t: 'cOk' }), 4], mono: [0], data: { id: 1 } },
  ],
  vedValg: (tr, data) => vis(data),
});
flade.appendChild(tabel);
tabel.vaelg(0);              // vælg første række fra koden
```

En celle er tekst, et tal eller et element (fx en chip eller et felt). `mono` er numrene på de celler, der står i mono.

**Tilstande:** Hover på rækken. Valgt række (`.sel`, `aria-selected="true"`). Grupperækker (`tr.gruppe`) kan ikke vælges.

**Tastatur:** Tab går til den valgte række (ellers den første). Op og ned vælger forrige og næste, Home og End første og sidste.

**Kræver af programmet:** Kolonnebredder i programmets egen CSS (tabellen har `table-layout: fixed`). Hvad et valg åbner (`vedValg`). At bygge tabellen igen, når rækkerne ændres.

## StatusChip

**Klasser:** `.chip`, `.ok`, `.warn`, `.danger`, `.info`, `.none`, `.ord`

**Funktioner:** `Kit.chip`, `Kit.SYMBOL`

**Formål:** En status i en tabelrække eller en værktøjslinje. Altid symbol, ord og farve, så status aldrig hviler på farven alene.

**Markup:**

```js
Kit.chip('warn', { t: 'cSkalTjekkes' });     // eller Kit.chip('ok', 'Maskeres')
```

```html
<span class="chip warn"><span aria-hidden="true">!</span><span class="ord">Skal tjekkes</span></span>
```

**Tilstande:** Fem varianter: `ok` (✓), `warn` (!), `danger` (?), `info` (i) og `none` (–). Symbolerne står i `Kit.SYMBOL`.

**Tastatur:** Ingen; en chip er ikke klikbar.

**Kræver af programmet:** Ordet. En variant betyder altid det samme i hele programmet.

## Button

**Klasser:** `.btn`, `.primary`, `.danger`, `.ghost`, `.gv`

**Funktioner:** `Kit.knap`

**Formål:** Knapper på 36 px i indholdet, i dialoger og i guider. (Kommandoerne i båndet er CommandBar.)

**Markup:**

```js
Kit.knap({ t: 'kGem', variant: 'primary', ikon: 'gem', genvej: 'Ctrl+S', ved: () => gem() });
```

```html
<button type="button" class="btn primary"><svg class="ik">…</svg><span>Gem</span><span class="gv">Ctrl+S</span></button>
```

**Tilstande:** Fire varianter: sekundær (ingen klasse), `primary`, `danger` og `ghost`. Hover. Deaktiveret (`disabled` eller `aria-disabled="true"`).

**Tastatur:** Tab, Enter og mellemrum (browserens egne).

**Kræver af programmet:** Hvad der sker (`ved`). Højst én primær knap pr. skærm. Teksten siger, hvad der sker. Genvejen, der vises i `.gv`, skal programmet selv få til at virke.

## TextField

**Klasser:** `.felt`, `.fejl`, `.hj`, `.fejltekst`

**Funktioner:** `Kit.felt`

**Formål:** Et tekstfelt med etiket over og hjælp eller fejl under. Klassen `.felt` former også `select` og `textarea`, som programmet selv sætter ind.

**Markup:**

```js
Kit.felt({ etiket: { t: 'fVaert' }, vaerdi: 'srv-app01.eksempel.dk', mono: true, foelsom: true, hjaelp: { t: 'hjVaert' } });
Kit.felt({ etiket: 'Eget net', vaerdi: '192.0.2.0/33', fejl: 'Skriv et net som 192.0.2.0/24.' });
```

```html
<div class="felt">
  <label class="label" for="kit-felt-1">Værtsnavn</label>
  <input id="kit-felt-1" type="text" class="mono" aria-describedby="kit-felt-1-hj">
  <span class="hj" id="kit-felt-1-hj">Står i mono.</span>
</div>
```

**Tilstande:** Fejl (`aria-invalid="true"` på feltet eller klassen `.fejl`, og `.hj.fejltekst` på teksten). Mono (`.mono` på feltet). Følsom (`foelsom: true`): ingen stavekontrol, autoudfyld eller autokorrektur.

**Tastatur:** Browserens egne.

**Kræver af programmet:** Validering og hvornår fejlen vises. En fejl siger, hvad der er galt, og hvad man gør. Felter med følsomme værdier skal have `foelsom: true`.

## Banner

**Klasser:** `.ban`, `.s`

**Funktioner:** `Kit.banner`

**Formål:** En besked over indholdet: én sætning og højst én handling.

**Markup:**

```js
Kit.banner({ variant: 'warn', t: 'bSkalTjekkes', handling: { t: 'hVis', ved: () => vis() } });
```

```html
<div class="ban warn" role="alert"><span class="s" aria-hidden="true">!</span><span class="ord">2 værdier skal tjekkes.</span><button type="button" class="btn ghost">…</button></div>
```

**Tilstande:** Fire varianter som StatusChip: `info` (i), `ok` (✓), `warn` (!) og `danger` (!). `warn` og `danger` har `role="alert"` og læses op med det samme; `info` og `ok` har `role="status"`.

**Tastatur:** Handlingen er en almindelig knap.

**Kræver af programmet:** Hvor banneret står, og hvornår det fjernes. Kittet har ingen luk-knap og ingen tidsudløb.

## Wizard

**Klasser:** `.wiz`, `.trin`, `.t`, `.n`, `.done`, `.now`, `.indhold`, `.fod`, `.luft`

**Funktioner:** `Kit.guide`

**Formål:** En guide, der tager én beslutning ad gangen: trinliste til venstre, det aktuelle trin til højre og en fodlinje med de samme knapper hele vejen.

**Markup:** Bygges af funktionen i et tomt element.

```js
const rod = document.getElementById('guide');
const guide = Kit.guide(rod, {
  hId: 'guide-h',
  trin: [
    { t: 'trin1', h: 'overskrift1', p: 'saetning1' },
    { t: 'trin2', h: 'overskrift2', p: 'saetning2', indhold: Kit.felt({ etiket: { t: 'fDomaene' } }) },
  ],
  naeste: { t: 'naeste' }, tilbage: { t: 'tilbage' }, slut: { t: 'faerdig' }, spring: { t: 'springOver' },
  vedSkift: i => Sprog.anvend(rod),
  vedSlut: () => luk(),
  vedSpring: () => luk(),
});
guide.gaaTil(1);  guide.aktuel;  guide.overskrift;
```

**Tilstande:** Et trin er nået (`.t.done`, flueben, kan klikkes), aktuelt (`.t.now`, `aria-current="step"`) eller kommende (kan ikke klikkes). Tilbage er deaktiveret i første trin. Den primære knap hedder `naeste` og i sidste trin `slut`.

**Tastatur:** Tab går gennem de nåede trin, trinnets indhold og fodlinjens knapper. Overskriften kan få fokus fra koden (`guide.overskrift.focus()`), så skærmlæsere hører det nye trin.

**Kræver af programmet:** Trinenes tekster skal gives som nøgler (`t`, `h`, `p`, og `naeste`/`slut` som `{ t: … }`); færdig tekst virker ikke her endnu. Programmet kalder `Sprog.anvend(rod)` i `vedSkift`, så det nye trins tekster udfyldes. Programmet ejer rammen omkring guiden (fx en dialog), og hvad der sker ved slut og spring over.

## Fletbaand

**Klasser:** `.flet`

**Funktioner:** `Kit.fletbaand`

**Formål:** Kittets ene pynteelement: en tynd flettet linje i accent, 10 px høj.

**Markup:**

```js
plads.appendChild(Kit.fletbaand());
```

**Tilstande:** Ingen.

**Tastatur:** Ingen; båndet er `aria-hidden`.

**Kræver af programmet:** Ét sted pr. skærm, og det er valgfrit. Båndet betyder ikke noget og må ikke bære information.

## Ikoner

**Funktioner:** `Kit.ikon`, `Kit.registrerIkoner`, `Kit.IKONER`

**Formål:** Stregikoner på 24 × 24 med 2 px streg og runde ender, tegnet i tekstens farve. Kittet har de almene; programmet lægger sine egne til.

**Markup:**

```js
knap.appendChild(Kit.ikon('soeg', 'ik'));                       // 'ik' giver 16 px
Kit.registrerIkoner({ mitikon: [['path', { d: 'M4 12h16' }], ['circle', { cx: 12, cy: 12, r: 3 }]] });
```

Kittets ikoner: `indsaet`, `fil`, `soeg`, `skjold`, `kopier`, `oeje`, `mappe`, `bog`, `gem`, `plus`, `aabn`, `eksport`, `import`, `slet`, `afspil`, `sol`, `maane`, `skaerm`, `sprog`, `laas`, `tandhjul`, `ned`, `hoejre`, `filter`, `luk`, `rediger` og `kalender`.

**Tilstande:** Ingen; ikonet arver farven fra teksten omkring sig.

**Tastatur:** Ingen; ikoner er `aria-hidden`. Knappen omkring et ikon uden tekst skal have en `aria-label`.

**Kræver af programmet:** At registrere egne ikoner, før de bruges; et navn, kittet allerede har, kan ikke overtages. `Kit.ikon` fejler ved et ukendt navn. Ingen emoji.

## Tema

**Funktioner:** `Tema.saet`, `Tema.valg`, `Tema.VALG`

**Formål:** Lyst, mørkt eller som systemet. Valget huskes, og siden tegnes i det rigtige tema fra første billede.

**Markup:**

```html
<html data-tema="system" data-kit-praefiks="mitprogram">
<script src="assets/tema.js"></script>      <!-- i <head>, uden defer -->
```

```js
Tema.saet('moerk');
document.addEventListener('mitprogram-tema', opdater);
```

**Tilstande:** `lys`, `moerk` og `system` (listen står i `Tema.VALG`). Et ukendt valg bliver til `system`.

**Tastatur:** Ingen; programmet laver selv knapperne, der skifter.

**Kræver af programmet:** `data-kit-praefiks` på `<html>` (ellers `wi24rd`). Knapper eller en indstilling, der kalder `Tema.saet`. Kun tokens til farver i programmets egen CSS.

## Sprog

**Funktioner:** `KitSprog.opret`

**Formål:** Sprogets mekanik: opslag af tekster, ental og flertal, udfyldning af siden og sprogskift uden genindlæsning. Teksterne er programmets.

**Markup:**

```js
window.Sprog = KitSprog.opret({ standard: 'da', titel: 'dokTitel', tekst: { da: {…}, en: {…} } });
Sprog.anvend(document);   Sprog.saet('en');   Sprog.t('antal', 3);   Sprog.lang;
```

```html
<button data-t="gem" data-t-aria="ariaGem" data-t-title="titelGem"></button>
<input data-t-ph="soegPh">
<span data-t="antal" data-v="3"></span>          <!-- '{v} {v:fil|filer}' → "3 filer" -->
```

**Tilstande:** Det aktuelle sprog (`Sprog.lang`, og `<html lang>`). Et ukendt sprog bliver til standardsproget.

**Tastatur:** Ingen; programmet laver selv knapperne, der skifter.

**Kræver af programmet:** Teksterne i alle sprog med de samme nøgler. At kalde `Sprog.anvend(rod)`, når noget nyt er bygget. Navnet `window.Sprog` er en aftale, ikke et krav fra `kit.js`: `kit.js` sætter kun `data-t`-attributterne.

## Findes ikke endnu

Disse er ikke i kittet som kode. Nogle findes som forhåndsvisning i `../components/` i kilde-repoet.

| Komponent | Status |
|---|---|
| StatusTile | Kun forhåndsvisning |
| Cover | Kun forhåndsvisning |
| Dialog | Mangler. Programmerne bruger `<dialog>` med egen CSS |
| Menu | Mangler |
| Værktøjstip | Mangler. Kittet bruger `title` |
| Tom tilstand | Mangler |
| Fremdrift | Mangler |
| Afkrydsning, kontakt (til/fra), valgliste | Mangler. `.felt` former `select`, men kittet har ingen egen valgliste |
| Komponenter til WPF | Mangler. Kun tokens (`tokens/Tokens.xaml`) |
