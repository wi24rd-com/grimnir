# Komponenterne i Wi24rd UI Kit 2

Det her er, hvad `web/kit.css`, `web/kit.js`, `web/tema.js` (tema og fra 2.3.0 tekststørrelse) og `web/sprogmotor.js` har i pakkens version (se `VERSION`). En test holder listen og koden ens: hver komponent herunder har mindst én klasse eller funktion i kittet, og hver klasse og funktion i kittet står under en komponent.

Se dem alle i `demo/index.html`.

Fælles for alle funktioner i `Kit`:

- En tekst gives enten som nøgle (`t: 'noegle'`), der bliver til `data-t` og udfyldes af `Sprog.anvend(rod)`, eller som færdig tekst (`tekst: 'Gem'`).
- En `aria-label` gives som nøgle (`ariaT`) eller som færdig tekst (`aria`).
- Funktionerne returnerer elementer, programmet selv sætter ind. Kald `Sprog.anvend(element)` bagefter, hvis der er brugt nøgler.
- Intet bygges med `innerHTML`, og kittet sætter aldrig inline-stil: tilstande er klasser og attributter (se README).

## Hvilken kontrol hvornår

Fra 2.3.0 har kittet flere kontroller til at vælge med. Vælg efter, hvad valget gælder, og hvor mange muligheder der er:

| Valget | Kontrol | Fx |
|---|---|---|
| Til eller fra, og det gælder med det samme | Kontakt (`Kit.kontakt`) | Lås efter 5 minutter |
| Til eller fra i en formular, der gemmes med en knap; eller flere af få | Afkrydsning (`Kit.afkrydsning`) | Maskér fremmede adresser; vælg rækker |
| Ét af 2–5, der skal kunne ses alle på én gang, i en formular | Radiogruppe (`Kit.radiogruppe`) | Tema: lys, mørk, system |
| Ét af 2–5 korte for hele skærmen (bånd eller værktøjslinje) | Segmentknap (`Kit.segment`) | 7 dage / 30 dage / År |
| Ét af mange (over fem) i en formular | Valgliste (`Kit.valgliste`, browserens `<select>`) | Udløber efter |
| Ét, flere eller alle af mange for hele skærmen, gerne med søgning | Vælger (`Kit.vaelger`) | Domæne, land |
| Slå filtre over en liste eller et diagram til og fra | Filterchip (`Kit.filterchips`) | Fejl, Advarsler |
| Hvilken del af arbejdsfladen der vises | Træet (`Kit.navTrae`) | Alle fund, Skal tjekkes |

Regler: en kontrol, der gemmer straks, står ikke i en formular med Gem. Over fem muligheder i en radiogruppe eller segmentknap er for mange. Valglisten er til formularer; vælgeren er til hele skærmen og står i titellinjen, båndet eller værktøjslinjen. En egen listeboks laves ikke, før et program viser, at `<select>` og vælgeren ikke rækker.

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

**Klasser:** `.cmd`, `.tabs`, `.tab`, `.on`, `.grupper`, `.grp`, `.kn`, `.cap`, `.cb`, `.pri`, `.enkel`, `.baand-el`

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

### Bånd til programmer med få kommandoer (fra 2.2.0)

Et program, man ser i og ikke arbejder i (fx et overblik med opdatér, periode, eksport og hjælp), har kun én fane. Så er en fanerække en kontrol, der ikke gør noget, og den udelades.

- **Indstillingen `udenFaner: true`** giver et bånd uden fanerække. Den kræver præcis én fane; flere giver en fejl. Grupper og gruppenavne er som i dag.
- **Valgt som indstilling**, ikke som noget, én fane selv udløser: et program på 2.0.0 med én fane skal se ud og virke som før (et bånd uden indstillingen er præcis som i 2.0.0, også med én fane).
- **En gruppe kan rumme en vælger eller en segmentknap**: en post `{ id, element }` i `knapper` sætter elementet ind i gruppen (`.baand-el`, 54 px høj, centreret). `baand.knap(id)` giver elementet.
- Båndet har rollen `group` med navnet fra `ariaT`; der er ingen faner og ingen `tabpanel`.
- Højst én primær kommando, og helst under seks poster i alt.

```js
const periode = Kit.segment({ ariaT: 'periodeAria', valgt: '7', valg: [{ id: '7', t: 'p7' }, { id: '30', t: 'p30' }, { id: 'aar', t: 'pAar' }], vedValg: id => hent(id) });
const domaene = Kit.vaelger({ etiket: { t: 'domaene' }, punkter: [{ id: 'a', tekst: 'eksempel.dk' }], vedValg: id => vis(id) });
Kit.commandBar(document.getElementById('baand'), {
  ariaT: 'cmdAria', udenFaner: true,
  faner: [{ id: 'start', t: 'faneStart', grupper: [
    { t: 'gData', knapper: [{ id: 'opdater', t: 'kOpdater', ikon: 'afspil', pri: true, ved: () => hent() }, { id: 'eksport', t: 'kEksport', ikon: 'eksport' }] },
    { t: 'gPeriode', knapper: [{ id: 'periode', element: periode.rod }] },
    { t: 'gDomaene', knapper: [{ id: 'domaene', element: domaene.rod }] },
  ] }],
});
```

## NavPane

**Klasser:** `.nav`, `.trae`, `.tr`, `.ant`, `.skift`, `.vs`, `.taet`

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

**Tilstande:** Valgt punkt i træet (`.tr.on`, `aria-current`). Foldet ud eller ind (`aria-expanded`). Aktiv visning (`.vs.on`, `aria-current="page"`). Tæt visningsskift (`.skift.taet`, fra 2.2.0): ved syv og otte visninger er hvert punkt 30 px højt i stedet for 38 px; seks eller færre er som i 2.0.0.

**Tastatur:** I træet: op og ned flytter, Home og End går til første og sidste, højre folder ud, venstre folder ind eller går til forælderen, Enter og mellemrum vælger. Visningsskiftets punkter er links og nås med Tab.

**Kræver af programmet:** Hvad et valg i træet filtrerer (`vedValg`). Selve visningsskiftet: hvert punkt er et link til `#id`; programmet viser den rigtige visning, kalder `markér(id)` og sætter selv eventuelle genveje. Højst otte visninger, altid i samme rækkefølge.

**Højst otte visninger (fra 2.2.0; før: seks).** Ni eller flere giver en fejl (`visningsskift: højst otte visninger`), som et ukendt ikon gør. Anbefalingen er at holde tallet nede: Indstillinger hører til i titellinjen (en `.rk`-knap med tandhjulet), og en opsætningsguide hører til i Wizard, ikke i visningsskiftet. Har programmet stadig flere end otte, er nogle af dem punkter i træet eller faner i båndet.

**Det mindste vindue, kittet lover, er 900 × 560 px** (`.vindue` i `kit.css`). Dér er der plads til otte visninger: titellinjen (34 px) og et bånd med faner og én række grupper (116 px) efterlader 410 px til navigationsruden. Overskriften tager 40 px, otte tætte punkter 256 px, og træet har 114 px, så mindst tre punkter ses, og resten rulles. Uden fanerække (`udenFaner`) er der 33 px mere. I bredden har navnet 143 px ved siden af ikonet og en genvej på to tegn; det er 17 tegn i 13 px Inter, regnet med 0,62 em pr. tegn (mere end Inters gennemsnit). Et længere navn afkortes med … og bør gøres kortere.

**Træet vælger ét punkt (fra 2.2.0, regel).** Træet er navigation: det vælger præcis ét punkt, og valget filtrerer arbejdsfladen. "Et, flere eller alle" (fx domæner) er et filter og hører til i en vælger med flere valg (se Vælger), ikke i træet. Træet får ingen afkrydsning.

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

**Klasser:** `.tabel`, `.r`, `.gruppe`, `.sel`, `.sorter`, `.sorter-pil`, `.kolgruppe`, `.sideskift`, `.sideskift-nr`, `.sideskift-pr`, `.vliste`

**Funktioner:** `Kit.tabel`, `Kit.sideskift`

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

**Tilstande:** Hover på rækken. Valgt række (`.sel`, `aria-selected="true"`). Grupperækker (`tr.gruppe`) kan ikke vælges. Fra 2.3.0: sorteret kolonne (`aria-sort`, pil ▲ eller ▼), kolonne, der kan sorteres (pil ↕), gruppeoverskrift (`.kolgruppe`), og i sideskiftet første og sidste side (`aria-disabled`).

**Tastatur:** Tab går til den valgte række (ellers den første). Op og ned vælger forrige og næste, Home og End første og sidste. Fra 2.3.0: sorteringsknapperne i hovedet nås med Tab før rækkerne og sorterer med Enter og mellemrum; sideskiftets knapper og antal pr. side nås med Tab efter tabellen.

**Kræver af programmet:** Kolonnebredder i programmets egen CSS (tabellen har `table-layout: fixed`). Hvad et valg åbner (`vedValg`). At bygge tabellen igen, når rækkerne ændres (eller fra 2.3.0: `tabel.saetRaekker(raekker)`).

### Sortering, to hovedrækker og sideskift (fra 2.3.0)

Tre nye indstillinger. **Uden dem er tabellen byte for byte som i 2.0.0** (en test sammenligner med en tabel bygget af 2.0.0's `kit.js`), og tastaturet i rækkerne (pil op og ned, Home, End) er det samme med dem.

```js
const tabel = Kit.tabel({
  ariaT: 'tabelAria',
  kolonnegrupper: [{ id: 'afvist', t: 'thAfvist' }, { id: 'angreb', t: 'thAngreb' }],
  kolonner: [
    { t: 'thDomaene', sort: true },                                   // står i begge hovedrækker (rowspan)
    { t: 'thIGaar', tal: true, gruppe: 'afvist', sort: true, sortStart: 'faldende' },
    { t: 'th7', tal: true, gruppe: 'afvist' },
    { t: 'thUgen', tal: true, gruppe: 'angreb' },
  ],
  sortering: { kolonne: 0, retning: 'stigende' },
  vedSortering: (kolonne, retning) => tabel.saetRaekker(sorter(kolonne, retning)),
  raekker: [...],
});
const sider = Kit.sideskift({
  ariaT: 'siderAria', side: 1, sider: 9, forrige: { t: 'forrige' }, naeste: { t: 'naeste' }, sideAf: { t: 'sideAf' },   // 'Side {v} af {w}'
  valg: [25, 50, 100], prSide: 25, prSideEtiket: { t: 'prSide' },
  vedSide: n => hentSide(n).then(r => tabel.saetRaekker(r)), vedPrSide: n => hent(1, n),
});
ramme.append(tabel, sider.rod);   Sprog.anvend(ramme);
sider.saet(1, 4);   tabel.saetSortering(1, 'faldende');
```

```html
<colgroup></colgroup><colgroup span="2"></colgroup><colgroup></colgroup>
<thead>
  <tr><th scope="col" rowspan="2" aria-sort="ascending"><button type="button" class="sorter" data-kolonne="0"><span>Domæne</span><span class="sorter-pil" aria-hidden="true">▲</span></button></th>
      <th class="kolgruppe" scope="colgroup" colspan="2">Afvist</th><th class="kolgruppe" scope="colgroup" colspan="1">Angreb</th></tr>
  <tr><th class="r" scope="col">…</th><th class="r" scope="col">7 dage</th><th class="r" scope="col">Denne uge</th></tr>
</thead>
<nav class="sideskift" aria-label="Sider"><button type="button" class="btn" data-side="forrige" aria-disabled="true">…</button><span class="sideskift-nr" role="status">Side 1 af 9</span><button type="button" class="btn" data-side="naeste">…</button><label class="sideskift-pr"><span>Pr. side</span><span class="vliste"><select>…</select><svg>…</svg></span></label></nav>
```

- **Sortering.** `sort: true` gør kolonnens hoved til en knap (`.sorter`) med en pil: ↕ (kan sorteres), ▲ (stigende) og ▼ (faldende); pilen er `aria-hidden`, og den sorterede kolonne har `aria-sort="ascending"` eller `"descending"` (de andre har ingen). Et klik på den sorterede kolonne vender retningen; et klik på en ny sorterer stigende (eller faldende med `sortStart: 'faldende'`, fx for tal, hvor det største er det vigtige). **Programmet sorterer selv**: kittet melder kolonne og retning (`vedSortering`), og programmet giver de sorterede rækker med `tabel.saetRaekker`. Valgt sådan, fordi kun programmet har alle rækkerne (med sideskift har tabellen kun én side, og grupperækker kan ikke sorteres med resten) og kender typerne (tal, datoer, IP-adresser). `saetRaekker` rører ikke hovedet, så fokus bliver på sorteringsknappen. `saetSortering(kolonne, retning)` sætter pilen udefra uden at kalde `vedSortering`.
- **To hovedrækker.** `kolonnegrupper` med `id` og tekst, og `gruppe: id` på kolonnerne. Kolonner med samme gruppe ved siden af hinanden får en fælles overskrift (`.kolgruppe`, `scope="colgroup"`, `colspan`) i første række og deres egne i anden (`scope="col"`); en kolonne uden gruppe står i begge rækker (`rowspan="2"`). Tabellen får en `<colgroup>` pr. gruppe og pr. kolonne uden gruppe, så `scope="colgroup"` peger på de rigtige kolonner.
- **Sideskift.** `Kit.sideskift` er sin egen funktion, fordi en `<nav>` ikke kan stå inde i `<table>`, og `Kit.tabel` returnerer tabellen selv (som i 2.0.0). Den står under tabellen: Forrige, "Side X af Y" (`role="status"`, så et skift læses op) og Næste, og til højre antal pr. side (browserens `<select>` med valglistens udseende). Forrige og Næste har `aria-disabled="true"` på første og sidste side og kan stadig nås med Tab, så fokus ikke forsvinder, når man når enden. Et klik flytter tallet og kalder `vedSide(n)`; **programmet leverer siderne** (henter eller skærer rækkerne til) og kalder `saet(side, sider)`, når antallet af sider ændres. `vedPrSide(n)` kaldes, når antal pr. side skiftes.

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

## Vælger

**Klasser:** `.vlg`, `.vlg-knap`, `.vlg-vaerdi`, `.vlg-pop`, `.op`, `.hoejre-kant`, `.vlg-soeg`, `.vlg-liste`, `.vlg-p`, `.aktiv`, `.vlg-mark`, `.vlg-boks`, `.vlg-alle`, `.vlg-navn`, `.vlg-ingen`, `.ant`

**Funktioner:** `Kit.vaelger`

**Formål:** En knap, der viser den aktuelle værdi, og en liste, der åbner under den (fra 2.2.0). Til valg, der gælder hele skærmen: domæne, land, periode med mange trin. Står i titellinjen (`.titel .hoejre`), i værktøjslinjen og i båndet; udseendet følger fladen (mørk på titellinjen, lys ellers). To former: **ét valg** (listen lukker ved valg) og **flere valg** (afkrydsning pr. punkt, "alle" øverst, listen bliver åben). Det er ikke en valgliste i en formular; til det bruges `<select>` i `.felt`.

**Markup:** Bygges af funktionen; programmet sætter `rod` ind.

```js
const land = Kit.vaelger({
  etiket: { t: 'landEtiket' },                       // knappens og listens navn (skjult tekst)
  punkter: [{ id: 'dk', t: 'landDk', antal: 12 }, { id: 'se', t: 'landSe' }],
  valgt: 'dk',
  vedValg: id => vis(id),                            // kun når brugeren ændrer valget
});
document.querySelector('.titel .hoejre').prepend(land.rod);

const domaener = Kit.vaelger({
  etiket: { t: 'domaeneEtiket' }, flere: true,
  alle: { t: 'alleDomaener' },                       // punktet øverst; knappen viser det, når alt er valgt
  nValgt: { t: 'nValgt' },                           // '{v} valgt'; data-v er antallet
  soeg: { ph: 'soegDomaenePh', ariaT: 'soegDomaene' }, ingen: { t: 'ingenFundet' },
  punkter: [{ id: 'z1', tekst: 'eksempel.dk' }, { id: 'z2', tekst: 'shop.eksempel.dk' }],
  valgt: ['z1', 'z2'],
  vedValg: ids => { filtrer(ids); Sprog.anvend(domaener.rod); },
});
Sprog.anvend(domaener.rod);
domaener.saetPunkter([...], ['z1']);   domaener.saetValgt(['z2']);   domaener.valgt;   domaener.aaben;
```

```html
<div class="vlg">
  <button type="button" class="vlg-knap" aria-haspopup="listbox" aria-expanded="false" aria-controls="kit-vlg1-liste">
    <span class="skjult-tekst" id="kit-vlg1-etiket">Land</span><span class="vlg-vaerdi">Danmark</span><svg>…</svg>
  </button>
  <div class="vlg-pop" hidden>
    <ul class="vlg-liste" id="kit-vlg1-liste" role="listbox" aria-labelledby="kit-vlg1-etiket" tabindex="-1">
      <li class="vlg-p" role="option" aria-selected="true"><span class="vlg-mark" aria-hidden="true">✓</span><span class="vlg-navn">Danmark</span><span class="ant">12</span></li>
    </ul>
  </div>
</div>
```

**Tilstande:** Åben (`aria-expanded="true"`, listen er synlig). Valgt punkt (`aria-selected="true"`): ved ét valg flueben, fed skrift og blød accentflade; ved flere valg en afkrydset boks og fed skrift. Aktivt punkt med tastaturet (`.aktiv`, `aria-activedescendant`, fokusring i `info`). "Alle" er valgt, når hvert punkt er. Listen åbner opad (`.op`), når der er mere plads over knappen, og står ved knappens højre kant (`.hoejre-kant`), når den ellers ville gå ud over vinduet. Største højde er 360 px og højst et halvt vindue minus 48 px; resten rulles. Søgefeltet skjuler punkter, der ikke passer, og "alle" mens der søges; `ingen` vises, når intet passer.

**Tastatur:** På knappen åbner Enter, mellemrum og pil ned (og pil op). I listen flytter pil op og ned, Home og End går til første og sidste, Enter vælger (ved flere valg: krydser af), mellemrum krydser af ved flere valg og vælger ved ét valg, og et bogstav hopper til næste punkt, der begynder med det (uden søgefelt). Med søgefelt står fokus i feltet: man skriver for at søge, og pilene og Enter virker som i listen. Esc lukker og giver fokus tilbage til knappen. Tab og klik uden for lukker. ARIA: `aria-haspopup="listbox"`, `aria-expanded` og `aria-controls` på knappen; `role="listbox"` (med `aria-multiselectable="true"` ved flere valg) og `role="option"` med `aria-selected`.

**Kræver af programmet:** Alle tekster som nøgler eller færdig tekst: `etiket`, punkternes navne, `alle`, `nValgt` (med `{v}`), søgefeltets `ph` og `ariaT`, og `ingen`. `Sprog.anvend(v.rod)` efter oprettelse og efter `saetPunkter`, og i `vedValg`, når knappen kan vise `nValgt`. Hvad et valg betyder (`vedValg`). `saetPunkter` og `saetValgt` kalder ikke `vedValg` (som at sætte `value` på et felt). Søgefelt fra omkring ti punkter. Vælgeren må ikke stå i et område, der selv ruller eller klipper (fx `.flade`); titellinjen, værktøjslinjen og båndet gør ikke.

## Sidepanel

**Klasser:** `.sidepanel`, `.over`, `.sp-top`, `.sp-luk`, `.sp-indhold`, `.midte`

**Funktioner:** `Kit.sidepanel`

**Formål:** Et panel i højre side af arbejdsfladen (fra 2.2.0) med overskrift, lukkeknap og indhold, der ruller. Til hjælp, detaljer om det valgte og lignende, der skal kunne ses ved siden af arbejdet.

**Markup:** Programmet lægger et tomt `<aside>` sidst i `.midte` (efter `.arb`); funktionen bygger indholdet.

```html
<div class="midte">
  <nav class="nav">…</nav>
  <main class="arb">…</main>
  <aside id="hjaelp"></aside>
</div>
<button type="button" class="rk" aria-controls="hjaelp" aria-expanded="false" data-t-aria="hjaelpAria">?</button>
```

```js
const hjaelp = Kit.sidepanel(document.getElementById('hjaelp'), {
  t: 'hjaelpH', lukAriaT: 'hjaelpLuk', indhold: byggetHjaelp,
  overlaeg: false,                 // true: læg altid over arbejdsfladen
  vedLuk: aarsag => {},            // 'knap', 'esc' eller 'kode'
});
knap.addEventListener('click', () => hjaelp.skift());
hjaelp.aabn();   hjaelp.luk();   hjaelp.aaben;   hjaelp.overlagt;   hjaelp.indhold;
```

**Tilstande:** Lukket (`hidden`). Åbent og skubber: panelet er 320 px bredt og står i rækken, så arbejdsfladen bliver smallere. Åbent og lægger over (`.over`): panelet ligger oven på højre side af arbejdsfladen med skygge (`--shadow-pop`). Det lægger over, når vinduet er smallere end **1200 px** (grænsen; kan ændres med `graense`), eller når programmet beder om det (`overlaeg: true`). Grænsen tjekkes ved åbning og når vinduet ændrer størrelse. Knapper med `aria-controls` = panelets id får `aria-expanded`.

**Tastatur:** Ved åbning går fokus til overskriften, så skærmlæsere hører den. Tab går videre til lukkeknappen og indholdet. Esc i panelet lukker; ligger panelet over, lukker Esc også fra resten af siden (medmindre en anden har brugt tasten, fx en åben vælger). Ved lukning går fokus tilbage til det, der åbnede panelet, hvis fokus var i panelet. Panelet er ikke en modal dialog: fokus fanges ikke, og resten af skærmen kan bruges. `role="complementary"` med navnet fra overskriften (`aria-labelledby`).

**Kræver af programmet:** `<aside>` som sidste barn af `.midte`. Overskriften (`t` eller `tekst`) og lukkeknappens navn (`lukAriaT` eller `lukAria`). Indholdet. Knappen, der åbner, med `aria-controls`. `Sprog.anvend(panel.rod)`, når indholdet er bygget. `.midte` får `position: relative`, når den har et sidepanel.

## Segmentknap

**Klasser:** `.seg`, `.seg-v`

**Funktioner:** `Kit.segment`

**Formål:** To til fem valg, hvor præcis ét er valgt (fra 2.2.0), fx "7 dage / 30 dage / År". Står i båndet (i en gruppe, se CommandBar) og i værktøjslinjen. Til få, korte valg, der skal kunne ses alle på én gang; flere eller lange valg hører til i en vælger.

**Markup:** Bygges af funktionen.

```js
const periode = Kit.segment({
  ariaT: 'periodeAria',
  valg: [{ id: '7', t: 'p7' }, { id: '30', t: 'p30' }, { id: 'aar', t: 'pAar' }],
  valgt: '7',
  vedValg: id => hent(id),          // kun når valget ændres
});
vaerktoejslinje.appendChild(periode.rod);
periode.vaelg('30');   periode.valgt;
```

```html
<div class="seg" role="radiogroup" aria-label="Periode">
  <button type="button" class="seg-v" role="radio" aria-checked="true" tabindex="0">7 dage</button>
  <button type="button" class="seg-v" role="radio" aria-checked="false" tabindex="-1">30 dage</button>
</div>
```

**Tilstande:** Valgt (`aria-checked="true"`): blød accentflade, fed skrift og en streg i accent forneden, så valget ikke hviler på farven alene. Hover. Færre end to eller flere end fem valg giver en fejl.

**Tastatur:** Tab går ind på det valgte og ud igen (hele segmentknappen er ét stop). Pilene (venstre/højre og op/ned) flytter og vælger og går rundt; Home og End vælger første og sidste. Enter og mellemrum vælger det punkt, der har fokus. `role="radiogroup"` med `role="radio"` og `aria-checked`.

**Kræver af programmet:** Gruppens navn (`ariaT` eller `aria`) og valgenes tekster. Hvad et valg betyder (`vedValg`). `vaelg(id)` kalder ikke `vedValg`.

## Filterchip

**Klasser:** `.fchips`, `.fchip`, `.fchip-mark`, `.ant`

**Funktioner:** `Kit.filterchip`, `Kit.filterchips`

**Formål:** En chip, der kan klikkes (fra 2.3.0): den slår et filter til og fra over en liste eller et diagram, fx "Fejl", "Advarsler" og "Oplysninger" over en tabel. Hver chip er sit eget til og fra; nul, en eller flere kan være valgt. Den almindelige chip (StatusChip, `.chip`) er uændret og kan ikke klikkes: den melder en status. Skal præcis ét være valgt, er det en segmentknap.

**Markup:** Bygges af funktionen.

```js
const filtre = Kit.filterchips({
  ariaT: 'filterAria',                                   // gruppens navn
  chips: [{ id: 'fejl', t: 'cFejl', antal: 3 }, { id: 'adv', t: 'cAdv', antal: 12 }, { id: 'info', t: 'cInfo', antal: 40 }],
  valgt: ['fejl'],
  vedValg: ids => filtrer(ids),                          // ved hvert klik: listen af de valgte
});
vaerktoejslinje.appendChild(filtre.rod);
filtre.saetValgt(['fejl', 'adv']);   filtre.valgt;   filtre.chips;

const ny = Kit.filterchip({ id: 'nye', t: 'cNye', vedSkift: (til, id) => vis(til) });   // én chip for sig
```

```html
<div class="fchips" role="group" aria-label="Vis">
  <button type="button" class="fchip" data-chip="fejl" aria-pressed="true"><span class="fchip-mark" aria-hidden="true">✓</span><span>Fejl</span><span class="ant">3</span></button>
  <button type="button" class="fchip" data-chip="adv" aria-pressed="false"><span class="fchip-mark" aria-hidden="true">✓</span><span>Advarsler</span><span class="ant">12</span></button>
</div>
```

**Tilstande:** Valgt (`aria-pressed="true"`): blød accentflade, kant i accent, fed skrift og et flueben foran ordet, så valget ikke hviler på farven alene. Ikke valgt: flade, kant i `border-strong`, intet flueben. Hover. Deaktiveret (`disabled`). Antallet (`.ant`) er valgfrit. Chippen er 28 px høj.

**Tastatur:** Hver chip er en knap: Tab går fra chip til chip, Enter og mellemrum slår til og fra. `aria-pressed` siger, om filteret er slået til; gruppen har `role="group"` og et navn.

**Kræver af programmet:** Gruppens navn (`ariaT` eller `aria`) og chippernes tekster og id'er. Hvad filteret gør (`vedValg` eller `vedSkift`). `saetValgt` kalder ikke `vedValg`. En chip skal altid gøre noget: et filter, der ikke ændrer noget, vises ikke.

## Kasse

**Klasser:** `.kasse`, `.kasse-top`, `.kasse-handling`, `.kasse-indhold`, `.fyld`, `.kasse-fod`

**Funktioner:** `Kit.kasse`

**Formål:** Kittets kort (card, fra 2.3.0): en flade med kant, et hoved med overskrift og valgfri handling, indholdet og en valgfri fodlinje. Til at dele en visning i afsnit, der hver har en overskrift: en liste, en tabel, et lille diagram, en forklaring. **Navnet:** klassen hedder `.kasse` og ikke `.kort`, fordi `.kort` i Huginn and Muninn er programmets eget kort (29 steder) og `--map-*` er kittets verdenskort. Kittets navneskik er et kort dansk ord uden forkortelse, og delene får komponentens navn foran (`.kasse-top`, `.kasse-indhold`, `.kasse-fod`), som `.sp-top` og `.vlg-liste`.

**Markup:** Bygges af funktionen; programmet sætter `rod` ind.

```js
const k = Kit.kasse({
  t: 'kasseAngreb',                                   // overskriften (h2; niveau: 3 eller 4 giver h3 eller h4)
  handling: Kit.knap({ t: 'visAlle', variant: 'ghost', ved: () => vis() }),
  indhold: tabel, fyld: true,                         // fyld: indholdet går helt ud til kanten (fx en tabel)
  fod: tekst,                                         // valgfri fodlinje (en Node)
});
visning.appendChild(k.rod);
k.indhold;   k.overskrift;   k.fod;
```

```html
<section class="kasse" aria-labelledby="kit-kasse1-h">
  <div class="kasse-top"><h2 id="kit-kasse1-h">Angreb i dag</h2><div class="kasse-handling"><button type="button" class="btn ghost">…</button></div></div>
  <div class="kasse-indhold">…</div>
  <div class="kasse-fod">…</div>
</section>
```

**Tilstande:** Med eller uden handling i hovedet og fodlinje. `.fyld` på indholdet fjerner luften. Overskriften står i `h3`-størrelse, uanset om den er `h2`, `h3` eller `h4`, så niveauet kan følge siden uden at ændre udseendet. Kassen har ingen `overflow`, så en vælger i hovedet ikke klippes.

**Tastatur:** Ingen egne taster: kassen er en flade. Handlingen i hovedet og indholdet nås med Tab i den rækkefølge, de står.

**Kræver af programmet:** Overskriften (`t` eller `tekst`), indholdet og eventuel handling og fodlinje. Højst én handling i hovedet; den siger, hvad der sker (fx "Vis alle"). Kassen er ikke klikbar som helhed; skal hele fladen åbne noget, er det en StatusTile. Overskriftens niveau (`niveau`) efter sidens opbygning.

## StatusTile

**Klasser:** `.sfliser`, `.sflise`, `.sflise-navn`, `.sflise-tal`, `.sflise-under`, `.sflise-pil`, `.ok`, `.warn`, `.danger`, `.info`, `.none`

**Funktioner:** `Kit.statusflise`, `Kit.statusfliser`

**Formål:** En flise svarer på "skal jeg gøre noget?" med ét tal, én etiket og én status (fra 2.3.0; før kun som forhåndsvisning i `../components/StatusTile`). Fliserne står i en række øverst på en oversigt, tre til fem ad gangen, og hele flisen åbner det, tallet tæller. **En flise findes kun, når brugeren handler på tallet** (kittets regel "Ingen pynt med tal" i `../README.md`): et tal, man ikke kan gøre noget ved, hører til i en tabel, en kasse eller fodlinjen. Klassen hedder `.sflise`, fordi `.flise` i Huginn and Muninn er logoets flise.

**Markup:** Bygges af funktionen.

```js
const fliser = Kit.statusfliser({
  ariaT: 'fliserAria',                                       // listens navn
  fliser: [
    { t: 'flMaskeres', tal: 13, status: { variant: 'ok', t: 'stKlar' }, ved: () => vis('maskeres') },
    { t: 'flVenter', tal: 2, status: { variant: 'warn', t: 'stTjek' }, udvikling: { retning: 'op', t: 'udvEnMere' }, ved: () => vis('tjek') },
    { t: 'flHemmelige', tal: 1, status: { variant: 'info', t: 'stKrypteres' }, href: '#hemmeligheder' },
  ],
});
oversigt.prepend(fliser);
Kit.statusflise({ t: 'flRester', tal: 0, under: { t: 'efterMaskering' } });   // én flise for sig; uden ved og href er den tekst
```

```html
<ul class="sfliser" role="list" aria-label="Status">
  <li><button type="button" class="sflise warn">
    <span class="sflise-navn">Venter på dig</span><span class="sflise-tal">2</span>
    <span class="chip warn"><span aria-hidden="true">!</span><span class="ord">Tjek selv</span></span>
    <span class="sflise-under"><span class="sflise-pil" aria-hidden="true">↑</span><span>1 mere end i går</span></span>
  </button></li>
</ul>
```

**Tilstande:** Fem statusser som StatusChip: `ok`, `warn`, `danger`, `info` og `none`. Status ses tre steder: chippen (symbol, ord og blød flade, `--*-soft`), stregen i venstre side (`--*-mark`) og ordet; aldrig farven alene. Uden status har flisen ingen chip og en neutral streg. Klikbar som knap (`ved`) eller link (`href`): hover på fladen, markør og fokusring om hele flisen. Uden `ved` og `href` er flisen en `div` uden hover. Tallet står i `h1`-størrelse med tal i samme bredde; mangler tallet, står "–". Undertekst (`under`) eller udvikling (`udvikling`: en pil ↑, ↓ eller → og en tekst). Rækken (`.sfliser`) ombryder og holder fliserne lige brede (mindst 176 px).

**Tastatur:** En flise med `ved` er en knap (Tab, Enter og mellemrum); med `href` et link (Tab og Enter). Hele flisen er ét stop med én fokusring. Knappens navn er etiket, tal, status og undertekst i den rækkefølge; symbolet og pilen er `aria-hidden`. Rækken er en liste (`role="list"`, så Safari ikke fjerner listen) med et navn.

**Kræver af programmet:** Etiketten, tallet og statussens ord. Hvad flisen åbner (`ved` eller `href`); det skal være præcis det, tallet tæller. Udviklingens tekst skal sige det hele ("1 mere end i går"); pilen er kun pynt for øjet. Højst fem fliser i en række. En variant betyder det samme her som i resten af programmet.

## Tom tilstand

**Klasser:** `.tomt`, `.tomt-ikon`, `.tomt-h`, `.tomt-p`, `.lille`

**Funktioner:** `Kit.tomTilstand`

**Formål:** Det, der står, når der intet er at vise (fra 2.3.0): et ikon, en overskrift, én sætning og højst én handling. Tre brug: **en tom visning** (fx "Ingen sager endnu" med "Ny sag"), **en tom tabel** (tabelhovedet står, og den lille udgave står under det) og **ingen træffere** efter en søgning eller et filter (den lille udgave med "Ryd filter"). Løftet fra Grimnirs egen tomme tilstand (`.tom` i Grimnirs `app.css`, samme mål); klassen hedder `.tomt`, fordi `.tom` allerede er Grimnirs og Huginn and Muninns.

**Markup:** Bygges af funktionen.

```js
visning.appendChild(Kit.tomTilstand({ ikon: 'mappe', t: 'tomSagerH', p: 'tomSagerP', handling: { t: 'nySag', variant: 'primary', ved: () => ny() } }));
ramme.append(tabel, Kit.tomTilstand({ lille: true, ikon: 'soeg', t: 'ingenTraef', p: 'ingenTraefP', handling: { t: 'rydFilter', ved: () => ryd() } }));
```

```html
<div class="tomt">
  <svg class="tomt-ikon" viewBox="0 0 24 24" aria-hidden="true">…</svg>
  <h2 class="tomt-h">Ingen sager endnu</h2>
  <p class="tomt-p">Indsæt en tekst, så laves en midlertidig sag.</p>
  <button type="button" class="btn primary"><span>Ny sag</span></button>
</div>
<div class="tomt lille" role="status"><svg class="tomt-ikon">…</svg><p class="tomt-h">Ingen træffere</p><p class="tomt-p">…</p></div>
```

**Tilstande:** Stor (standard): midt på fladen, højst 520 px bred, ikon på 40 px, overskrift i `h2`-størrelse. Lille (`.lille`): ikon på 24 px, overskrift i `h3`-størrelse, mindre luft; overskriften er et afsnit, ikke en overskrift i sidens opbygning, og hele udgaven har `role="status"`, så en ny tekst ("Ingen træffere") læses op. Ikon, sætning og handling er valgfri.

**Tastatur:** Ingen egne taster. Handlingen er en almindelig knap.

**Kræver af programmet:** Overskriften og sætningen. Sætningen siger, hvad visningen gør, eller hvorfor der intet er, og hvad man kan gøre. Højst én handling, og kun en, der hjælper videre (ny, åbn, ryd filter). Programmet sætter den tomme tilstand ind i stedet for indholdet (eller under tabelhovedet) og fjerner den igen, når der er noget at vise. Den lille udgave skal stå i siden, før teksten skifter, hvis skiftet skal læses op.

## Fremdrift

**Klasser:** `.frem`, `.ubestemt`, `.frem-tekst`, `.frem-bjaelke`, `.snurr`

**Funktioner:** `Kit.fremdrift`

**Formål:** Viser, at programmet arbejder (fra 2.3.0), og altid med en tekst, der siger hvad: "Analyserer filen …", "3 af 8 filer". To former: **bestemt**, når programmet ved, hvor langt det er (en bjælke), og **ubestemt**, når det ikke ved det (en ring, der snurrer, foran teksten). En ring alene er aldrig den eneste besked.

**Markup:** Bygges af funktionen.

```js
const f = Kit.fremdrift({ t: 'analyserer', omraade: flade });                  // ubestemt; flade får aria-busy="true"
const b = Kit.fremdrift({ t: 'nAfM', maks: 8, vaerdi: 3, omraade: flade });   // bestemt
vaerktoejslinje.after(f.rod);
b.saet(4, { t: 'nAfM', v: 4, w: 8 });  Sprog.anvend(b.rod);                  // ny værdi og ny tekst
f.faerdig();  f.rod.remove();                                                   // aria-busy fjernes
```

```html
<div class="frem ubestemt"><span class="snurr" aria-hidden="true"></span><span class="frem-tekst" id="kit-frem1" role="status">Analyserer filen …</span></div>
<div class="frem"><span class="frem-tekst" id="kit-frem2" role="status">3 af 8 filer</span><progress class="frem-bjaelke" max="8" value="3" aria-labelledby="kit-frem2"></progress></div>
```

**Tilstande:** Bestemt (`<progress>` med `max` og `value`, navngivet af teksten): en bjælke på 8 px med kant, fyldt med accent. Ubestemt (`.ubestemt`): en ring på 16 px, der snurrer; ved `prefers-reduced-motion: reduce` står den stille (teksten siger stadig, at der arbejdes). Området, der arbejder, har `aria-busy="true"` fra start til `faerdig()`.

**Tastatur:** Ingen; fremdrift er ikke en kontrol. Teksten har `role="status"`, så en ny tekst læses op uden at flytte fokus.

**Kræver af programmet:** Teksten (nøgle, gerne med `{v}` og `{w}`, eller færdig tekst). Hvornår fremdriften vises: først når noget har varet mere end et øjeblik (Grimnir venter et sekund), så korte opgaver ikke blinker. At kalde `faerdig()` og fjerne `rod`, når arbejdet er gjort, og at sige resultatet (fx med et banner). Det område, der arbejder (`omraade`), hvis det skal have `aria-busy`.

## Værktøjstip

**Klasser:** `.tip-plads`, `.tip`, `.under`, `.venstre-kant`, `.hoejre-kant`

**Funktioner:** `Kit.vaerktoejstip`

**Formål:** En kort forklaring, der dukker op ved et element (fra 2.3.0): hvorfor en kommando ikke kan bruges, hvad et tal tæller, hele værdien bag en afkortet tekst. Den virker med mus **og** tastatur og opfylder WCAG 1.4.13: den kan lukkes uden at flytte musen eller fokus (Esc), man kan flytte musen op på den uden at den forsvinder, og den bliver, til musen går, fokus går, eller Esc trykkes.

**Hvornår `title`, og hvornår et værktøjstip.** Kittets egne ikonknapper (og programmets) har deres navn i `aria-label` og må gentage det i `title`; det beholder de. `title` er kun en gentagelse af navnet: den vises ikke ved tastaturfokus og ikke på berøringsskærme. Et værktøjstip bruges, når teksten siger noget ud over navnet, og når den skal kunne læses fra tastaturet. Det vigtige står aldrig kun i et værktøjstip: er det nødvendigt for at bruge skærmen, står det i teksten. Et værktøjstip sættes aldrig på et element med `disabled` (det kan ikke få fokus); brug `aria-disabled="true"`, som båndet gør.

**Markup:** Funktionen tager et element, der er der i forvejen.

```js
const tip = Kit.vaerktoejstip(baand.knap('kopier'), { t: 'hvorforIntetValgt' });
Sprog.anvend(tip.plads);
tip.vis();   tip.skjul();   tip.synlig;
```

```html
<span class="tip-plads">
  <button type="button" class="cb" aria-disabled="true" aria-describedby="kit-tip1">…</button>
  <span class="tip" id="kit-tip1" role="tooltip" hidden>Vælg en række i tabellen først</span>
</span>
```

**Tilstande:** Skjult (`hidden`) og vist. Vises 300 ms efter, at musen kommer ind over elementet, og straks ved tastaturfokus (`:focus-visible`; et museklik viser det ikke). Skjules 150 ms efter, at musen er gået (tid til at flytte musen op på tippet), når fokus går, og ved Esc. Placering: midt over elementet; `.under`, hvis der ikke er plads over; `.venstre-kant` eller `.hoejre-kant`, hvis det ellers går ud over vinduet. Mørk flade (`--rail`, `--rail-strong`) i begge temaer, højst 280 px bred.

**Tastatur:** Tab til elementet viser tippet; Tab væk skjuler det. Esc skjuler det uden at flytte fokus; kittet kalder `preventDefault()` og stopper tastetrykket, så andre lyttere (fx et sidepanel, der ligger over) ikke får det. Om en åben `<dialog>` så heller ikke lukker, er browserens opførsel og ikke prøvet i WebKit. Elementet har `aria-describedby` til tippet (`role="tooltip"`), så skærmlæsere læser forklaringen efter navnet.

**Kræver af programmet:** Teksten (kort, én sætning). Elementet skal kunne få fokus (en knap, et link, et felt). Kittet lægger elementet i en `<span class="tip-plads">` (`display: inline-flex`); står elementet i en række, hvor det skal være et direkte barn, lægger programmet selv `.tip-plads` om det, og kittet bruger den. Tippet må ikke stå i et område, der selv klipper (`overflow`), som vælgeren. `Sprog.anvend(tip.plads)`, når tippet bruger en nøgle.

## Afkrydsning

**Klasser:** `.afk-felt`, `.afk`, `.afk-boks`, `.afk-tekst`, `.afk-hj`, `.fejltekst`

**Funktioner:** `Kit.afkrydsning`

**Formål:** Et valg, der er til eller fra, i en formular, der gemmes med en knap; eller flere valg af få i en liste (fra 2.3.0). Browserens egen `<input type="checkbox">` med kittets tegning: ingen hjemmebygget rolle, så etiketten, mellemrum, formularen og skærmlæseren virker som i browseren. Se "Hvilken kontrol hvornår" øverst.

**Markup:** Bygges af funktionen.

```js
const a = Kit.afkrydsning({ t: 'valgFremmede', hjaelp: { t: 'hjFremmede' }, valgt: true, vedSkift: v => {} });
const alle = Kit.afkrydsning({ t: 'vaelgAlle', delvis: true });          // delvis valgt (indeterminate)
formular.append(a.rod, alle.rod);
a.valgt;   a.saetValgt(false);   alle.saetDelvis();   a.input;
```

```html
<div class="afk-felt">
  <label class="afk"><input type="checkbox" id="kit-afk-1" class="afk-boks" aria-describedby="kit-afk-1-hj"><span class="afk-tekst">Maskér fremmede offentlige adresser</span></label>
  <span class="afk-hj" id="kit-afk-1-hj">Adresser, der ikke er dine.</span>
</div>
```

**Tilstande:** Ikke valgt: boks på 16 px med kant i `border-strong` (3:1). Valgt (`checked`): fyldt med accent og et flueben i `on-accent`. Delvis valgt (`indeterminate`, fx "Vælg alle", når nogle er valgt): fyldt med accent og en vandret streg; et klik gør den valgt. Fejl (`fejl`): kant i `danger`, fejlteksten under i `danger` og `aria-invalid="true"`. Deaktiveret (`disabled`): hele rækken nedtonet. Hjælp eller fejl står under teksten, rykket ind til tekstens kant, med `aria-describedby`. Klikfladen (etiketten) er mindst 24 px høj.

**Tastatur:** Tab til boksen, mellemrum slår til og fra. Et klik på teksten virker som et klik på boksen (etiketten).

**Kræver af programmet:** Teksten, og hjælp eller fejl. Hvornår valget gemmes (`vedSkift` eller formularens egen knap). At sætte "delvis" igen (`saetDelvis()`), når det, den står over, ændres; `saetValgt` fjerner det delvise.

## Radiogruppe

**Klasser:** `.valgsaet`, `.vandret`, `.afk-felt`, `.afk`, `.afk-boks`, `.afk-tekst`, `.afk-hj`, `.label`

**Funktioner:** `Kit.radiogruppe`

**Formål:** Ét valg af 2–5, der skal kunne ses alle på én gang, i en formular (fra 2.3.0), fx tema eller sprog i Indstillinger. Browserens egne `<input type="radio">` i en `<fieldset>` med `<legend>`. Ét valg for hele skærmen (periode) er en segmentknap; mange valg er en valgliste.

**Markup:** Bygges af funktionen.

```js
const tema = Kit.radiogruppe({
  etiket: { t: 'temaEtiket' },                                  // gruppens navn (legend)
  valg: [{ id: 'lys', t: 'kLys' }, { id: 'moerk', t: 'kMoerk' }, { id: 'system', t: 'kSystem', hjaelp: { t: 'hjSystem' } }],
  valgt: 'system', vandret: true,
  vedValg: id => Tema.saet(id),
});
indstillinger.appendChild(tema.rod);
tema.valgt;   tema.vaelg('lys');   tema.inputs;
```

```html
<fieldset class="valgsaet vandret">
  <legend class="label">Tema</legend>
  <div class="afk-felt"><label class="afk"><input type="radio" class="afk-boks" name="kit-radio-1" value="lys"><span class="afk-tekst">Lys</span></label></div>
  <div class="afk-felt"><label class="afk"><input type="radio" class="afk-boks" name="kit-radio-1" value="moerk" checked><span class="afk-tekst">Mørk</span></label></div>
</fieldset>
```

**Tilstande:** Under hinanden (standard) eller i en række (`.vandret`). Valgt: rund boks fyldt med accent med en ring i fladens farve om prikken. Hvert valg kan have sin egen hjælp; gruppen kan have hjælp eller fejl under sig (`aria-describedby` på `<fieldset>`). En fejl ses på teksten og på boksenes kant; `aria-invalid` hører ikke til en gruppe eller en radioknap og sættes ikke. Deaktiveret valg nedtonet.

**Tastatur:** Browserens egne: Tab går ind på det valgte (eller det første) og ud igen som ét stop; pilene flytter og vælger. Gruppens navn er `<legend>`.

**Kræver af programmet:** Gruppens navn og valgenes tekster og id'er. Hvad et valg betyder (`vedValg`). `vaelg(id)` kalder ikke `vedValg`. Et `navn`, hvis gruppen skal sendes med en formular (ellers giver kittet et).

## Kontakt

**Klasser:** `.tilfra`, `.tilfra-ord`, `.tilfra-til`, `.tilfra-fra`, `.afk-felt`, `.afk`, `.afk-tekst`, `.afk-hj`

**Funktioner:** `Kit.kontakt`

**Formål:** Til eller fra, der **virker straks** (fra 2.3.0), fx "Lås efter 5 minutter" i Indstillinger, der gemmes, så snart man slår den til. Noget, der først gælder, når man trykker Gem, er en afkrydsning.

**Valget af element:** `<input type="checkbox" role="switch">`, ikke `<button role="switch" aria-checked>`. Input'en har tilstanden (`checked`), mellemrum, etiketten, formularen og `change` fra browseren, så kittet ikke skal efterligne dem; `role="switch"` får skærmlæsere til at sige "kontakt, til" eller "fra" i stedet for "afkrydsningsfelt". En knap skulle have sin egen tilstand og sin egen etiket bygget i JavaScript.

**Markup:** Bygges af funktionen.

```js
const laas = Kit.kontakt({ t: 'laasEfter', til: true, ord: { til: { t: 'til' }, fra: { t: 'fra' } }, vedSkift: til => gem(til) });
indstillinger.appendChild(laas.rod);
laas.til;   laas.saet(false);
```

```html
<div class="afk-felt">
  <label class="afk">
    <input type="checkbox" role="switch" class="tilfra" id="kit-tf-1" checked>
    <span class="afk-tekst">Lås efter 5 minutter</span>
    <span class="tilfra-ord" aria-hidden="true"><span class="tilfra-til">Til</span><span class="tilfra-fra">Fra</span></span>
  </label>
</div>
```

**Tilstande:** Fra: knoppen til venstre (i `border-strong`) på en lys flade med kant. Til: knoppen til højre (i `on-accent`) på en flade i accent. **Til og fra ses på knoppens plads**, ikke kun på farven, og med `ord` også på et ord efter teksten; begge ord står i markup, og `kit.css` viser det, der passer (`:checked`), så et sprogskift ikke kræver noget. Ordet er `aria-hidden`, fordi kontakten selv siger sin tilstand. Knoppen glider på 0,12 s og står stille ved `prefers-reduced-motion`. Deaktiveret nedtonet; fejl som Afkrydsning.

**Tastatur:** Tab til kontakten, mellemrum slår til og fra (browserens egen). Et klik på teksten slår også til og fra.

**Kræver af programmet:** Teksten og, hvis det skal være der, ordene for til og fra. At valget gælder med det samme (`vedSkift`); kan det fejle, sætter programmet kontakten tilbage (`saet`) og siger hvorfor.

## Valgliste

**Klasser:** `.vliste`, `.felt`, `.label`, `.hj`, `.fejltekst`

**Funktioner:** `Kit.valgliste`

**Formål:** Ét valg af mange (over fem) i en formular (fra 2.3.0), fx sprog eller udløb i en dialog. Browserens egen `<select>` med kittets kant, flade og pil; listen, der åbner, er styresystemets (og følger temaet gennem `color-scheme`). En hjemmebygget listeboks laves kun, hvis et program viser, at `<select>` ikke rækker; til "vælg blandt mange med søgning" eller "et, flere eller alle" for hele skærmen findes Vælgeren.

**Markup:** Bygges af funktionen.

```js
const udloeb = Kit.valgliste({
  etiket: { t: 'udloebEtiket' }, hjaelp: { t: 'hjUdloeb' },
  valg: [{ id: '7', t: 'dage7' }, { id: '30', t: 'dage30' }, { id: '90', t: 'dage90' }, { id: 'aldrig', t: 'aldrig' }],
  valgt: '30', vedValg: id => saet(id),
});
dialog.appendChild(udloeb.rod);
udloeb.valgt;   udloeb.vaelg('90');   udloeb.select;
```

```html
<div class="felt">
  <label class="label" for="kit-vl-1">Udløber efter</label>
  <span class="vliste"><select id="kit-vl-1" aria-describedby="kit-vl-1-hj"><option value="7">7 dage</option>…</select><svg aria-hidden="true">…</svg></span>
  <span class="hj" id="kit-vl-1-hj">Sagen slettes derefter.</span>
</div>
```

**Tilstande:** Som TextField: 36 px høj, kant i `border-strong`, etiket over, hjælp eller fejl under (`aria-invalid="true"` og kant i `danger`). Pilen er kittets ikon `ned` i `text-muted`. Deaktiveret nedtonet. Et deaktiveret valg i listen (`deaktiveret` på valget) kan ikke vælges.

**Tastatur:** Browserens egne: Tab til listen; pil op og ned skifter valg (i macOS åbner mellemrum og pilene listen); et bogstav hopper. Etiketten er en `<label for>`.

**Kræver af programmet:** Etiketten og valgenes tekster og id'er. Hvad et valg betyder (`vedValg`). `vaelg(id)` kalder ikke `vedValg`. `Sprog.anvend(liste.rod)` efter oprettelse, når valgene er nøgler.

## Dialog

**Klasser:** `.modal`, `.bred`, `.modal-top`, `.modal-luk`, `.modal-tekst`, `.modal-indhold`, `.modal-fod`

**Funktioner:** `Kit.dialog`, `Kit.bekraeft`

**Formål:** En modal dialog (fra 2.3.0): et spørgsmål eller en lille formular, der skal besvares, før man går videre. Bygget på browserens `<dialog>` og `showModal()`, så fokusfælden (resten af siden er inert), Esc og den dæmpede baggrund er browserens egne. Overskrift, en sætning og/eller frit indhold, en fodlinje med knapper og en valgfri lukkeknap. `Kit.bekraeft` er den korte vej til "Er du sikker?". Løftet fra Grimnirs egne dialoger (`.dlg` i Grimnirs `app.css`, samme mål); klassen hedder `.modal`, fordi `.dlg` er Grimnirs og `.dialog` Huginn and Muninns. Noget, der skal kunne ses ved siden af arbejdet, er et sidepanel, ikke en dialog.

**Markup:** Bygges af funktionen; kittet sætter dialogen ind i `<body>` ved første `aabn()`.

```js
const omdoeb = Kit.dialog({
  t: 'omdoebH', p: 'omdoebP',                                     // overskrift og sætning (aria-labelledby, aria-describedby)
  indhold: Kit.felt({ etiket: { t: 'fNavn' } }),
  luk: { ariaT: 'lukAria' },                                      // valgfri lukkeknap med navn (svaret 'luk'); uden navn: fejl
  knapper: [
    { id: 'annuller', t: 'annuller' },
    { id: 'gem', t: 'gem', variant: 'primary', ved: d => (gyldigt() ? true : false) },   // false: dialogen bliver åben
  ],
  vedLuk: svar => {},                                             // 'gem', 'annuller', 'esc', 'luk' eller 'kode'
});
Sprog.anvend(omdoeb.rod);
knap.addEventListener('click', () => omdoeb.aabn());             // aabn('gem') giver en bestemt knap fokus
omdoeb.luk();   omdoeb.aaben;   omdoeb.indhold;   omdoeb.knap('gem');

if (await Kit.bekraeft({ t: 'sletH', p: 'sletP', nej: { t: 'annuller' }, ja: { t: 'slet' }, farlig: true, udfyld: rod => Sprog.anvend(rod) })) slet();
```

```html
<dialog class="modal" aria-labelledby="kit-dlg1-h" aria-describedby="kit-dlg1-p">
  <div class="modal-top"><h2 id="kit-dlg1-h" tabindex="-1">Slet sagen?</h2><button type="button" class="modal-luk" aria-label="Luk">…</button></div>
  <p class="modal-tekst" id="kit-dlg1-p">Sagen og dens nøgle slettes. Det kan ikke fortrydes.</p>
  <div class="modal-indhold"></div>
  <div class="modal-fod"><button type="button" class="btn" data-svar="nej">…</button><button type="button" class="btn danger" data-svar="ja">…</button></div>
</dialog>
```

**Tilstande:** Lukket og åben (`open`, modal). 480 px bred (`bred: true` giver `.bred`, 620 px), højst vinduets højde minus 48 px, så ruller den. Radius `radius-lg`, skygge `shadow-pop`, baggrunden er titellinjens farve dæmpet til 45 %. **Knapperne:** fodlinjen står til højre, og den primære knap flyttes yderst til højre, uanset hvor den står i listen; en farlig handling er `variant: 'danger'` (`.btn.danger`), og den står sidst i listen. **Fokus ved åbning:** det, programmet peger på (`fokus`), ellers det første felt i indholdet, ellers knappen, der ikke er farlig, når der er en farlig (så Enter aldrig sletter ved et uheld), ellers den primære. **Fokus ved lukning:** tilbage til det, der havde fokus, da dialogen åbnede. **Svaret:** knappens `svar` (standard: dens `id`), `'esc'`, `'luk'` eller `'kode'`; det står også i `rod.returnValue`.

**Tastatur:** Tab og Skift+Tab går rundt i dialogen og kommer ikke ud (browserens fokusfælde). Esc lukker med svaret `'esc'`. En åben vælger og et synligt værktøjstip bruger selv Esc og kalder `preventDefault()`; at browseren så ikke også lukker dialogen af samme tryk, er browserens opførsel og er ikke prøvet i WebKit (et syntetisk tastetryk udløser ikke browserens egen handling). Enter og mellemrum på en knap. Overskriften kan få fokus fra koden (`overskrift.focus()`), så skærmlæsere hører den.

**Kræver af programmet:** Overskriften, sætningen og knappernes tekster (nøgler eller færdig tekst) og `Sprog.anvend(d.rod)` (ved `Kit.bekraeft`: `udfyld`, der kaldes lige før den åbner). Hvad hver knap gør (`ved`, `vedLuk`); validering, der holder dialogen åben, returnerer `false` fra `ved`. Højst én primær knap; ved en farlig handling ingen primær, men den farlige knap sidst. En vælger i en dialog kan blive klippet (dialogen ruller); brug en valgliste i dialoger. Dialogen lukker ikke ved klik på baggrunden (en halvt udfyldt formular skal ikke forsvinde).

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

## Tekststørrelse

**Funktioner:** `Tekst.saet`, `Tekst.valg`, `Tekst.TRIN`, `Tekst.større`, `Tekst.mindre`, `Tekst.nulstil`

**Formål:** Tekststørrelse i tre trin, lille, normal og stor (fra 2.3.0), som **én fælles skala for hele fladen** og for alle programmer (Jans valg). Valget ligger i `tema.js` efter samme mønster som temaet: det huskes under programmets præfiks, sættes før første tegning og melder en hændelse.

**Mekanismen:** `tema.js` sætter `<html data-tekst="lille">` eller `"stor"`, og `kit.css` sætter `zoom` på roden: `.9` og `1.125` (normal har ingen attribut og ingen regel, så et program uden valget er præcis som før). `zoom` skalerer tekst, luft, ikoner, kanter og alle kittets mål sammen, så forholdet mellem dem er det samme i alle trin. Fravalgt: et token pr. mål (Jans valg c; kittet har sine mål i px i `kit.css`, ikke i tokens), `rem` (samme grund) og `transform: scale` (flytter ikke layoutet). `zoom` skalerer også `vh`, `vw` og `px` i de regler, der skal følge vinduet; derfor deler `kit.css` dem med trinnet for `.vindue` (højden og det mindste vindue), vælgerens liste og dialogen, så skallen stadig fylder vinduet præcis, og det mindste vindue stadig er 900 × 560 px på skærmen.

**Målt i WKWebView** (macOS 26.6, engangsprøve uden for repoet med pakkens filer og en skal med titellinje, bånd med faner, træ, otte visninger, værktøjslinje, en tabel med 30 rækker og fodlinje; V-KIT.4): i 900 × 560 og 1200 × 800 fylder skallen vinduet præcis i alle tre trin (ingen rulning, fodlinjen nederst). Titellinjen er 34 / 30,6 / 38,3 px, båndet 116 / 104 / 129,5 px, en tabelrække 40 / 36 / 45 px (normal / lille / stor). En dialog med langt indhold holder sig inden for vinduet. Uden de delte mål blev skallen ved stor 1013 × 630 px i et vindue på 900 × 560 (fodlinjen udenfor), og ved lille 504 px høj. **Ved stor i det mindste vindue** er der med otte visninger 60 px til træet (ét punkt; resten rulles); med seks visninger mere. **WebView2 (Chromium, Windows) er ikke målt.** Chromium har `zoom` (standardiseret fra version 128), og efter standarden skaleres alle længder, også `vh`; hvis WebView2 alligevel ikke skalerer `vh`, bliver skallen ved stor kortere end vinduet (ikke længere), og det skal måles, før et Windows-program tager valget i brug.

**Markup:**

```html
<html data-tema="system" data-kit-praefiks="mitprogram">        <!-- data-tekst sættes af tema.js -->
<script src="assets/tema.js"></script>                            <!-- i <head>, uden defer: trinnet er sat før første tegning -->
```

```js
Tekst.saet('stor');   Tekst.større();   Tekst.mindre();   Tekst.nulstil();   Tekst.valg;   Tekst.TRIN;
document.addEventListener('mitprogram-tekst', opdater);
document.addEventListener('keydown', e => {                      // genvejene er programmets: ⌘+ ⌘− ⌘0 (Ctrl på Windows)
  if (!(e.metaKey || e.ctrlKey)) return;
  if (e.key === '+' || e.key === '=') { e.preventDefault(); Tekst.større(); }
  else if (e.key === '-') { e.preventDefault(); Tekst.mindre(); }
  else if (e.key === '0') { e.preventDefault(); Tekst.nulstil(); }
});
```

**Tilstande:** `lille`, `normal` (standard) og `stor` (listen står i `Tekst.TRIN`). Et ukendt valg bliver til `normal`. `større` og `mindre` stopper ved stor og lille. Valget huskes i `localStorage['<præfiks>-tekst']`; uden lagring (privat tilstand) gælder det kun denne gang.

**Tastatur:** Ingen fra kittet. Programmet sætter selv genvejene og eventuelt en indstilling (en radiogruppe eller segmentknap) og menupunkter.

**Kræver af programmet:** At kalde funktionerne fra sine genveje, menuer og indstillinger, og at vise valget. Programmets egen CSS skaleres med (zoom gælder hele siden); bruger programmet selv `vh` eller `vw` til noget, der skal følge vinduet, eller `window.innerWidth` til en grænse, skal det tage højde for trinnet på samme måde (kittets sidepanel bruger vinduets bredde, som zoom ikke ændrer). Er programmets mindste vindue 900 × 560, er det det samme i alle trin.

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
| Cover | Kun forhåndsvisning |
| Menu | Mangler. Vælgeren (2.2.0) er til at vælge en værdi, ikke til kommandoer |
| Egen listeboks | Laves ikke, før et program viser, at valglisten (browserens `<select>`, 2.3.0) og vælgeren ikke rækker. Vælgeren og segmentknappen (2.2.0) er til valg for hele skærmen, valglisten og radiogruppen (2.3.0) til formularer; se "Hvilken kontrol hvornår" |
| Tæthed for sig | Mangler. Tekststørrelsen (2.3.0) skalerer hele fladen; tættere rækker uden mindre tekst findes ikke |
| Komponenter til WPF | Mangler. Kun tokens (`tokens/Tokens.xaml`) |

Fra 2.3.0 er Dialog, Afkrydsning, Kontakt, Radiogruppe, Valgliste, StatusTile, Kasse (kort), Tom tilstand, Fremdrift, Værktøjstip, Filterchip og Tekststørrelse kode; de står ovenfor.
