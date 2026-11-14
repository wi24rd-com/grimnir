// Kontrast for Wi24rd UI Kit 2's par i begge temaer, regnet ud fra pakkens tokens.json (V-KIT.1: kilden er
// design/ui-kit-2/pakke/tokens/wi24rd-ui-kit-2.tokens.json; stien kommer fra build-tokens.mjs og skrives først; WCAG 2.x
// relativ luminans). Tekst mod flade skal være mindst 4,5:1; kontrolkanter, fokusring og ikoner, der bærer betydning,
// mindst 3:1. Fejler (exit 1), hvis et par er under grænsen. Brug: node tests/ui/kontrast.mjs
// Listen er kittets par, som kit.css og app.css bruger dem; et nyt par i CSS'en skal også stå her (V-ORDBOG.1: Wizard,
// Ordbog-visningen og Maskér → ordbogen).
import path from 'node:path';
import { laesTokens, temaVaerdier, KILDE } from '../../design/build-tokens.mjs';

const TEKST = 4.5, KANT = 3;

/* [forgrund, baggrund, grænse, hvor] */
export const PAR = [
  // Brødtekst og sekundær tekst på de tre flader.
  ['text', 'bg', TEKST, 'brødtekst på programmets baggrund'],
  ['text', 'surface', TEKST, 'brødtekst på arbejdsflade, kort og tabel'],
  ['text', 'surface-raised', TEKST, 'brødtekst i bånd, tabelhoved og fodlinje'],
  ['text-muted', 'bg', TEKST, 'hjælpetekst på baggrund'],
  ['text-muted', 'surface', TEKST, 'hjælpetekst, etiketter og antal i træet'],
  ['text-muted', 'surface-raised', TEKST, 'gruppenavne i båndet, kolonnenavne, fodlinje, chip Ingen'],
  ['text', 'border', TEKST, 'aktiv visning i visningsskiftet (.vs.on)'],
  // Titellinjen.
  ['rail-text', 'rail', TEKST, 'tekst på titellinjen'],
  ['rail-strong', 'rail', TEKST, 'programmets navn på titellinjen'],
  ['rail-text', 'rail-active', TEKST, 'hover på titellinjens knapper'],
  ['rail-strong', 'rail-active', TEKST, 'hover på titellinjens knapper, stærk tekst'],
  ['rail', 'accent-on-rail', TEKST, 'bogstavet i mærket'],
  ['accent-on-rail', 'rail', KANT, 'mærket mod titellinjen'],
  ['rail-strong', 'rail', KANT, 'fokusring på titellinjen'],
  ['rail-strong', 'rail-active', KANT, 'fokusring på titellinjen ved hover'],
  // Accent.
  ['on-accent', 'accent', TEKST, 'primær knap'],
  ['on-accent', 'accent-hover', TEKST, 'primær knap ved hover'],
  ['accent', 'accent-soft', TEKST, 'StatusChip OK'],
  ['text', 'accent-soft', TEKST, 'valgt række og valgt punkt i træet'],
  ['accent', 'surface', TEKST, 'accent som tekst på arbejdsfladen'],
  ['accent', 'surface', KANT, 'fanens streg og primær kommandos ikon'],
  ['accent', 'surface-raised', KANT, 'primær kommandos ikon i båndet; aktiv visnings ikon'],
  ['accent', 'border', KANT, 'aktiv visnings ikon på .vs.on'],
  // Signaler.
  ['info', 'info-soft', TEKST, 'StatusChip Oplysning'],
  ['warn', 'warn-soft', TEKST, 'StatusChip Advarsel'],
  ['danger', 'danger-soft', TEKST, 'StatusChip Fejl'],
  ['text', 'info-soft', TEKST, 'Banner Oplysning'],
  ['text', 'warn-soft', TEKST, 'Banner Advarsel'],
  ['text', 'danger-soft', TEKST, 'Banner Fejl'],
  ['surface', 'info', TEKST, 'Bannerets symbol, Oplysning'],
  ['surface', 'warn', TEKST, 'Bannerets symbol, Advarsel'],
  ['surface', 'danger', TEKST, 'Bannerets symbol, Fejl'],
  ['surface', 'accent', TEKST, 'Bannerets symbol, OK'],
  ['info', 'surface', TEKST, 'tekstknap og link'],
  ['danger', 'surface', TEKST, 'farlig knap og feltfejl'],
  ['info', 'info-soft', KANT, 'tekstknap i et banner (Oplysning)'],
  // Maskér-tabellen (V-SKAL.2): fravalgt række og rækkefejl på valgt og hover-række; Vis-knappen ved hover.
  ['text-muted', 'accent-soft', TEKST, 'fravalgt række, når den er valgt'],
  ['danger', 'accent-soft', TEKST, 'rækkefejl i en valgt række'],
  ['danger', 'surface-raised', TEKST, 'rækkefejl ved hover'],
  ['info', 'surface-raised', TEKST, 'Vis/Skjul-knap ved hover'],
  ['accent', 'surface', KANT, 'afkrydsningsboks (accent-color)'],
  // Kontrolkanter.
  ['border-strong', 'surface', KANT, 'kant på felter og sekundære knapper'],
  ['border-strong', 'surface-raised', KANT, 'kant på felter i værktøjslinjen'],
  ['border-strong', 'bg', KANT, 'kant på felter på baggrund'],
  ['danger', 'surface', KANT, 'kant på farlig knap og felt med fejl'],
  // Fokusring.
  ['info', 'surface', KANT, 'fokusring på arbejdsfladen'],
  ['info', 'surface-raised', KANT, 'fokusring i båndet og fodlinjen'],
  ['info', 'bg', KANT, 'fokusring på baggrund'],
  ['info', 'accent-soft', KANT, 'fokusring på valgt punkt'],
  ['info', 'border', KANT, 'fokusring på aktiv visning'],
  // V-ORDBOG.1: kittets Wizard (guiden ved første start).
  ['text-muted', 'surface-raised', TEKST, 'Wizard: kommende trin i trinlisten'],
  ['text', 'surface-raised', TEKST, 'Wizard: nået trin (kan klikkes)'],
  ['text', 'surface', TEKST, 'Wizard: nået trin ved hover'],
  ['text', 'accent-soft', TEKST, 'Wizard: aktuelt trin'],
  ['on-accent', 'accent', TEKST, 'Wizard: tallet i det aktuelle trin'],
  ['accent', 'accent-soft', TEKST, 'Wizard: fluebenet i et nået trin'],
  ['accent', 'accent-soft', KANT, 'Wizard: ringen om et nået trins tal'],
  ['border-strong', 'surface-raised', KANT, 'Wizard: ringen om et kommende trins tal'],
  ['info', 'surface-raised', TEKST, 'Wizard: Spring over (tekstknap) i fodlinjen'],
  ['info', 'surface-raised', KANT, 'Wizard: fokusring i trinlisten og fodlinjen'],
  ['text', 'surface', TEKST, 'Wizard: overskrift, sætning og felter'],
  // V-MANUEL.1: genvejsmenuen for en markering og typens valgliste i en tilføjet række.
  ['text', 'surface', TEKST, 'V-MANUEL.1: punkterne i genvejsmenuen og typen i valglisten'],
  ['text', 'surface-raised', TEKST, 'V-MANUEL.1: genvejsmenuens punkt ved hover og fokus'],
  ['text-muted', 'surface', TEKST, 'V-MANUEL.1: genvejen (kbd) i genvejsmenuen og valglistens pil'],
  ['text-muted', 'surface-raised', TEKST, 'V-MANUEL.1: genvejen (kbd) ved hover og fokus'],
  ['border-strong', 'surface', KANT, 'V-MANUEL.1: genvejsmenuens kant og valglistens kant'],
  ['info', 'surface-raised', KANT, 'V-MANUEL.1: fokusring på genvejsmenuens punkt'],
  ['info', 'surface', KANT, 'V-MANUEL.1: fokusring på valglisten og Fjern i en tilføjet række'],
  // V-ORDBOG.1: Ordbog-visningen, Maskér → ordbogen, indstillinger.
  ['text', 'surface-raised', TEKST, 'Ordbog: gruppeoverskriften Maskér altid / Maskér aldrig'],
  ['text-muted', 'surface-raised', TEKST, 'Ordbog: gruppens note'],
  ['text', 'surface-raised', TEKST, 'Ordbog: hjælpelinjen om navnemønstre'],
  ['surface', 'info', TEKST, 'Ordbog: hjælpelinjens symbol'],
  ['info', 'surface', TEKST, 'Maskér: knapperne Altid og Aldrig i en række'],
  ['info', 'accent-soft', TEKST, 'Maskér: Altid og Aldrig i en valgt række'],
  ['text-muted', 'surface', TEKST, 'Maskér: advarslen under en egen kode'],
  ['text-muted', 'surface-raised', TEKST, 'Maskér: advarslen under en egen kode ved hover'],
  ['warn', 'surface', TEKST, 'Maskér: advarselstegnet ved en egen kode'],
  ['warn', 'surface-raised', TEKST, 'Maskér: advarselstegnet ved hover'],
  ['warn', 'accent-soft', TEKST, 'Maskér: advarselstegnet i en valgt række'],
  ['accent', 'surface', KANT, 'Fletbåndet i Om-dialogen'],
  ['accent', 'surface', KANT, 'radioknapper og afkrydsning i Indstillinger (accent-color)'],
  // Den primære knaps fokusring står 2 px uden for knappen (outline-offset i kit.css) og ligger derfor på fladen omkring
  // den (info på surface/bg), ikke på accent. info på accent er 1,1:1 og må aldrig bruges.
  // V-FIL.1: filen i værktøjslinjen, "Grimnir arbejder", træk og slip, advarslen i Tilføj post.
  ['text', 'surface', TEKST, 'Fil: filnavnet i værktøjslinjen'],
  ['text-muted', 'surface', TEKST, 'Fil: størrelse, tegnsæt og linjeskift i værktøjslinjen'],
  ['text', 'info-soft', TEKST, 'Fil: Grimnir arbejder'],
  ['info', 'surface', KANT, 'Fil: fladens kant under et træk'],
  ['info', 'surface-raised', KANT, 'Fil: fladens kant under et træk over et panelhoved'],
  ['text-muted', 'surface', TEKST, 'Ordbog: advarslen om en adgangskode i Tilføj post'],
  ['warn', 'surface', TEKST, 'Ordbog: advarselstegnet i Tilføj post'],
  // V-RET.1: rullebjælken i tekstpanelerne (altid synlig) og Altid/Aldrig som ikonknapper.
  ['text-muted', 'surface-raised', KANT, 'Tekstpanel: rullebjælkens greb på sporet'],
  ['info', 'surface', KANT, 'Maskér: ikonet i Altid og Aldrig'],
  // V-LAAS.2: låseskærmen og banneret "Grimnir er ikke låst". Knapperne, overskriften og sætningen bruger kittets par
  // ovenfor; her står de, der er nye for låsen. Det nedtonede bånd og NavPane er inaktive kontroller (WCAG 1.4.3 undtager
  // dem) og står derfor ikke her.
  ['on-accent', 'accent', TEKST, 'Låseskærm: bogstavet i mærket'],
  ['accent', 'surface', KANT, 'Låseskærm: mærket mod arbejdsfladen'],
  ['text', 'surface', TEKST, 'Låseskærm: overskriften Grimnir er låst'],
  ['text-muted', 'surface', TEKST, 'Låseskærm: sætningen og beskeden under knapperne'],
  ['danger', 'surface', TEKST, 'Låseskærm: beskeden, når oplåsningen mislykkedes'],
  ['info', 'surface', KANT, 'Låseskærm: fokusringen om Lås op'],
  ['on-accent', 'accent', TEKST, 'Låseskærm: Lås op (primær knap)'],
  ['text', 'info-soft', TEKST, 'Banner: Grimnir er ikke låst'],
  ['surface', 'info', TEKST, 'Banner: symbolet i Grimnir er ikke låst'],
  // V-LAAS.5 N3: sloganet står nedtonet ved navnet på titellinjen, og under navnet i Om-dialogen og guidens første skærm.
  ['rail-text', 'rail', TEKST, 'Titellinjen: sloganet (nedtonet) ved navnet'],
  ['text-muted', 'surface', TEKST, 'Om-dialogen og guiden: sloganet under navnet'],
  ['text', 'surface', TEKST, 'Om-dialogen og guiden: navnet og beskrivelsen'],
  // Pakke 2.1.0 (K1–K4): ok, mærker, dataserier, skala og kort. Mærker, serier og akse er grafik (3:1); etiketter er tekst.
  ['ok', 'ok-soft', TEKST, '2.1.0: StatusChip OK (ok på ok-soft)'],
  ['ok', 'surface', TEKST, '2.1.0: ok som tekst på arbejdsfladen'],
  ['text', 'ok-soft', TEKST, '2.1.0: Banner OK'],
  ['surface', 'ok', TEKST, '2.1.0: Bannerets symbol, OK'],
  ['ok-mark', 'surface', KANT, '2.1.0: mærke (ok) på surface'],
  ['ok-mark', 'surface-raised', KANT, '2.1.0: mærke (ok) på surface-raised'],
  ['ok-mark', 'bg', KANT, '2.1.0: mærke (ok) på bg'],
  ['warn-mark', 'surface', KANT, '2.1.0: mærke (warn) på surface'],
  ['warn-mark', 'surface-raised', KANT, '2.1.0: mærke (warn) på surface-raised'],
  ['warn-mark', 'bg', KANT, '2.1.0: mærke (warn) på bg'],
  ['danger-mark', 'surface', KANT, '2.1.0: mærke (danger) på surface'],
  ['danger-mark', 'surface-raised', KANT, '2.1.0: mærke (danger) på surface-raised'],
  ['danger-mark', 'bg', KANT, '2.1.0: mærke (danger) på bg'],
  ['info-mark', 'surface', KANT, '2.1.0: mærke (info) på surface'],
  ['info-mark', 'surface-raised', KANT, '2.1.0: mærke (info) på surface-raised'],
  ['info-mark', 'bg', KANT, '2.1.0: mærke (info) på bg'],
  ['none-mark', 'surface', KANT, '2.1.0: mærke (none) på surface'],
  ['none-mark', 'surface-raised', KANT, '2.1.0: mærke (none) på surface-raised'],
  ['none-mark', 'bg', KANT, '2.1.0: mærke (none) på bg'],
  ['data-1', 'surface', KANT, '2.1.0: dataserie 1 på surface'],
  ['data-1', 'bg', KANT, '2.1.0: dataserie 1 på bg'],
  ['data-2', 'surface', KANT, '2.1.0: dataserie 2 på surface'],
  ['data-2', 'bg', KANT, '2.1.0: dataserie 2 på bg'],
  ['data-3', 'surface', KANT, '2.1.0: dataserie 3 på surface'],
  ['data-3', 'bg', KANT, '2.1.0: dataserie 3 på bg'],
  ['data-4', 'surface', KANT, '2.1.0: dataserie 4 på surface'],
  ['data-4', 'bg', KANT, '2.1.0: dataserie 4 på bg'],
  ['data-5', 'surface', KANT, '2.1.0: dataserie 5 på surface'],
  ['data-5', 'bg', KANT, '2.1.0: dataserie 5 på bg'],
  ['data-6', 'surface', KANT, '2.1.0: dataserie 6 på surface'],
  ['data-6', 'bg', KANT, '2.1.0: dataserie 6 på bg'],
  ['data-axis', 'surface', KANT, '2.1.0: akse på arbejdsfladen'],
  ['data-axis', 'bg', KANT, '2.1.0: akse på baggrund'],
  ['data-label', 'surface', TEKST, '2.1.0: etiketter i diagram på arbejdsfladen'],
  ['data-label', 'bg', TEKST, '2.1.0: etiketter i diagram på baggrund'],
  // Skalaen: nabotrin skal kunne skelnes i lyshed (1,3:1), laveste trin fra land uden data, højeste tydeligt mod havet.
  ['seq-2', 'seq-1', 1.3, '2.1.0: skala, trin 1 mod 2'],
  ['seq-3', 'seq-2', 1.3, '2.1.0: skala, trin 2 mod 3'],
  ['seq-4', 'seq-3', 1.3, '2.1.0: skala, trin 3 mod 4'],
  ['seq-5', 'seq-4', 1.3, '2.1.0: skala, trin 4 mod 5'],
  ['seq-1', 'map-land', 1.3, '2.1.0: laveste trin mod land uden data'],
  ['seq-5', 'map-sea', KANT, '2.1.0: højeste trin mod havet'],
  ['map-land', 'map-sea', 1.15, '2.1.0: kort, land mod hav'],
  ['map-border', 'map-land', 1.5, '2.1.0: kort, grænse mod land'],
  ['map-border', 'map-sea', 1.5, '2.1.0: kort, kystlinje mod hav'],
  ['map-ring', 'map-land', KANT, '2.1.0: kort, ring på land'],
  ['map-ring', 'map-sea', KANT, '2.1.0: kort, ring på hav'],
  ['map-arc', 'map-land', KANT, '2.1.0: kort, bue over land'],
  ['map-arc', 'map-sea', KANT, '2.1.0: kort, bue over hav'],
  // Pakke 2.2.0 (K5–K9): vælger, sidepanel, bånd uden faner og segmentknap. Parrene står her for hver ny komponent, også
  // når samme par allerede er målt for en anden; det tætte visningsskift (K5) bruger de samme par som før.
  ['rail-text', 'rail', TEKST, '2.2.0 Vælger: værdien på knappen i titellinjen'],
  ['rail-text', 'rail', KANT, '2.2.0 Vælger: knappens kant i titellinjen'],
  ['rail-strong', 'rail-active', TEKST, '2.2.0 Vælger: knappen i titellinjen ved hover og når listen er åben'],
  ['rail-strong', 'rail', KANT, '2.2.0 Vælger: fokusring på knappen i titellinjen'],
  ['text', 'surface', TEKST, '2.2.0 Vælger: værdien på knappen i værktøjslinjen og punkterne i listen'],
  ['text', 'surface-raised', TEKST, '2.2.0 Vælger: knappen og et punkt ved hover'],
  ['border-strong', 'surface', KANT, '2.2.0 Vælger: knappens kant, søgefeltets kant og den tomme afkrydsningsboks'],
  ['border-strong', 'surface-raised', KANT, '2.2.0 Vælger: knappens kant i båndet, og boksen ved hover'],
  ['text', 'accent-soft', TEKST, '2.2.0 Vælger: valgt punkt (ét valg)'],
  ['accent', 'accent-soft', TEKST, '2.2.0 Vælger: fluebenet ved det valgte punkt (ét valg)'],
  ['on-accent', 'accent', TEKST, '2.2.0 Vælger: fluebenet i en afkrydset boks'],
  ['accent', 'surface', KANT, '2.2.0 Vælger: den afkrydsede boks mod listen'],
  ['accent', 'surface-raised', KANT, '2.2.0 Vælger: den afkrydsede boks ved hover'],
  ['text-muted', 'surface', TEKST, '2.2.0 Vælger: antal, søgefeltets pladsholder og teksten ingen'],
  ['text-muted', 'surface-raised', TEKST, '2.2.0 Vælger: antal ved hover'],
  ['text-muted', 'accent-soft', TEKST, '2.2.0 Vælger: antal i det valgte punkt'],
  ['info', 'surface', KANT, '2.2.0 Vælger: fokusring om det aktive punkt og søgefeltet'],
  ['info', 'surface-raised', KANT, '2.2.0 Vælger: fokusring om det aktive punkt ved hover'],
  ['info', 'accent-soft', KANT, '2.2.0 Vælger: fokusring om det aktive, valgte punkt'],
  ['text', 'surface', TEKST, '2.2.0 Sidepanel: overskrift og indhold'],
  ['text-muted', 'surface', KANT, '2.2.0 Sidepanel: lukkeknappens kryds'],
  ['text', 'surface-raised', KANT, '2.2.0 Sidepanel: lukkeknappens kryds ved hover'],
  ['info', 'surface', KANT, '2.2.0 Sidepanel: fokusring på lukkeknappen'],
  ['info', 'surface-raised', KANT, '2.2.0 Sidepanel: fokusring på lukkeknappen ved hover'],
  ['text', 'surface', TEKST, '2.2.0 Segmentknap: et valg, der ikke er valgt'],
  ['text', 'surface-raised', TEKST, '2.2.0 Segmentknap: ved hover'],
  ['text', 'accent-soft', TEKST, '2.2.0 Segmentknap: det valgte'],
  ['accent', 'accent-soft', KANT, '2.2.0 Segmentknap: stregen under det valgte'],
  ['border-strong', 'surface', KANT, '2.2.0 Segmentknap: kanten og skillelinjerne'],
  ['border-strong', 'surface-raised', KANT, '2.2.0 Segmentknap: kanten i båndet'],
  ['info', 'surface', KANT, '2.2.0 Segmentknap: fokusring'],
  ['info', 'accent-soft', KANT, '2.2.0 Segmentknap: fokusring på det valgte'],
  ['text', 'surface-raised', TEKST, '2.2.0 Bånd uden faner: gruppenavne og kommandoer'],
  ['text-muted', 'surface-raised', TEKST, '2.2.0 Bånd uden faner: gruppenavne'],
  // Pakke 2.3.0 (K10–K17): komponenterne. Som for 2.2.0 står parrene her for hver ny komponent, også når samme par allerede
  // er målt for en anden.
  ['text', 'surface', TEKST, '2.3.0 Filterchip: ordet i en chip, der ikke er valgt'],
  ['text', 'surface-raised', TEKST, '2.3.0 Filterchip: ordet ved hover'],
  ['text', 'accent-soft', TEKST, '2.3.0 Filterchip: ordet og antallet i en valgt chip'],
  ['accent', 'accent-soft', TEKST, '2.3.0 Filterchip: fluebenet i en valgt chip'],
  ['text-muted', 'surface', TEKST, '2.3.0 Filterchip: antallet i en chip, der ikke er valgt'],
  ['text-muted', 'surface-raised', TEKST, '2.3.0 Filterchip: antallet ved hover'],
  ['border-strong', 'surface', KANT, '2.3.0 Filterchip: kanten om en chip, der ikke er valgt'],
  ['border-strong', 'bg', KANT, '2.3.0 Filterchip: kanten på baggrunden'],
  ['border-strong', 'surface-raised', KANT, '2.3.0 Filterchip: kanten ved hover og i båndet'],
  ['accent', 'surface', KANT, '2.3.0 Filterchip: kanten om en valgt chip mod fladen'],
  ['accent', 'accent-soft', KANT, '2.3.0 Filterchip: kanten om en valgt chip mod dens egen flade'],
  ['info', 'surface', KANT, '2.3.0 Filterchip: fokusring'],
  ['info', 'bg', KANT, '2.3.0 Filterchip: fokusring på baggrunden'],
  ['text', 'surface', TEKST, '2.3.0 Kasse: indholdet'],
  ['text', 'surface-raised', TEKST, '2.3.0 Kasse: overskriften i hovedet'],
  ['text-muted', 'surface-raised', TEKST, '2.3.0 Kasse: fodlinjens tekst'],
  ['text-muted', 'surface', TEKST, '2.3.0 Kasse: sekundær tekst i indholdet'],
  ['info', 'surface-raised', TEKST, '2.3.0 Kasse: tekstknappen (handling) i hovedet'],
  ['info', 'surface', TEKST, '2.3.0 Kasse: tekstknappen ved hover'],
  ['info', 'surface-raised', KANT, '2.3.0 Kasse: fokusring i hovedet og fodlinjen'],
  ['text', 'surface', TEKST, '2.3.0 StatusTile: tallet'],
  ['text-muted', 'surface', TEKST, '2.3.0 StatusTile: etiketten og underteksten'],
  ['text', 'surface-raised', TEKST, '2.3.0 StatusTile: tallet ved hover'],
  ['text-muted', 'surface-raised', TEKST, '2.3.0 StatusTile: etiketten og underteksten ved hover'],
  ['ok', 'ok-soft', TEKST, '2.3.0 StatusTile: chippen ok'],
  ['warn', 'warn-soft', TEKST, '2.3.0 StatusTile: chippen warn'],
  ['danger', 'danger-soft', TEKST, '2.3.0 StatusTile: chippen danger'],
  ['info', 'info-soft', TEKST, '2.3.0 StatusTile: chippen info'],
  ['text-muted', 'surface-raised', TEKST, '2.3.0 StatusTile: chippen none'],
  ['ok-mark', 'surface', KANT, '2.3.0 StatusTile: stregen ok mod fladen'],
  ['warn-mark', 'surface', KANT, '2.3.0 StatusTile: stregen warn mod fladen'],
  ['danger-mark', 'surface', KANT, '2.3.0 StatusTile: stregen danger mod fladen'],
  ['info-mark', 'surface', KANT, '2.3.0 StatusTile: stregen info mod fladen'],
  ['none-mark', 'surface', KANT, '2.3.0 StatusTile: stregen none mod fladen'],
  ['ok-mark', 'surface-raised', KANT, '2.3.0 StatusTile: stregen ok ved hover'],
  ['warn-mark', 'surface-raised', KANT, '2.3.0 StatusTile: stregen warn ved hover'],
  ['danger-mark', 'surface-raised', KANT, '2.3.0 StatusTile: stregen danger ved hover'],
  ['info-mark', 'surface-raised', KANT, '2.3.0 StatusTile: stregen info ved hover'],
  ['none-mark', 'surface-raised', KANT, '2.3.0 StatusTile: stregen none ved hover'],
  ['ok-mark', 'bg', KANT, '2.3.0 StatusTile: stregen ok mod baggrunden'],
  ['warn-mark', 'bg', KANT, '2.3.0 StatusTile: stregen warn mod baggrunden'],
  ['danger-mark', 'bg', KANT, '2.3.0 StatusTile: stregen danger mod baggrunden'],
  ['info-mark', 'bg', KANT, '2.3.0 StatusTile: stregen info mod baggrunden'],
  ['none-mark', 'bg', KANT, '2.3.0 StatusTile: stregen none mod baggrunden'],
  ['info', 'surface', KANT, '2.3.0 StatusTile: fokusring om flisen'],
  ['info', 'bg', KANT, '2.3.0 StatusTile: fokusring på baggrunden'],
  ['text', 'surface', TEKST, '2.3.0 Tom tilstand: overskriften'],
  ['text-muted', 'surface', TEKST, '2.3.0 Tom tilstand: sætningen'],
  ['text-muted', 'surface', KANT, '2.3.0 Tom tilstand: ikonet'],
  ['text', 'bg', TEKST, '2.3.0 Tom tilstand: overskriften på baggrunden'],
  ['text-muted', 'bg', TEKST, '2.3.0 Tom tilstand: sætningen på baggrunden'],
  ['text', 'surface', TEKST, '2.3.0 Fremdrift: teksten'],
  ['accent', 'surface', KANT, '2.3.0 Fremdrift: bjælkens fyld og ringens bue mod fladen'],
  ['border-strong', 'surface', KANT, '2.3.0 Fremdrift: bjælkens kant og ringens spor'],
  ['accent', 'bg', KANT, '2.3.0 Fremdrift: bjælkens fyld og ringens bue på baggrunden'],
  ['border-strong', 'bg', KANT, '2.3.0 Fremdrift: bjælkens kant på baggrunden'],
  ['text', 'info-soft', TEKST, '2.3.0 Fremdrift: teksten i en arbejder-linje (som Grimnirs)'],
  ['rail-strong', 'rail', TEKST, '2.3.0 Værktøjstip: teksten'],
  ['text', 'surface', TEKST, '2.3.0 Afkrydsning, radiogruppe, kontakt: teksten'],
  ['text-muted', 'surface', TEKST, '2.3.0 Afkrydsning, radiogruppe, kontakt: hjælpen under og gruppens navn'],
  ['danger', 'surface', TEKST, '2.3.0 Afkrydsning, radiogruppe, kontakt, valgliste: fejlteksten'],
  ['border-strong', 'surface', KANT, '2.3.0 Afkrydsning og radioknap: boksens kant (ikke valgt)'],
  ['border-strong', 'surface-raised', KANT, '2.3.0 Afkrydsning og radioknap: boksens kant på en hævet flade'],
  ['border-strong', 'bg', KANT, '2.3.0 Afkrydsning og radioknap: boksens kant på baggrunden'],
  ['accent', 'surface', KANT, '2.3.0 Afkrydsning og radioknap: den valgte boks mod fladen'],
  ['accent', 'bg', KANT, '2.3.0 Afkrydsning og radioknap: den valgte boks på baggrunden'],
  ['on-accent', 'accent', KANT, '2.3.0 Afkrydsning: fluebenet og stregen (delvis) i den valgte boks'],
  ['surface', 'accent', KANT, '2.3.0 Radiogruppe: ringen om prikken i den valgte radioknap'],
  ['danger', 'surface', KANT, '2.3.0 Afkrydsning, radiogruppe, kontakt, valgliste: kanten ved en fejl'],
  ['info', 'surface', KANT, '2.3.0 Afkrydsning, radiogruppe, kontakt, valgliste: fokusring'],
  ['border-strong', 'surface', KANT, '2.3.0 Kontakt: fladens kant og knoppen, når den er fra'],
  ['accent', 'surface', KANT, '2.3.0 Kontakt: fladen, når den er til, mod omgivelserne'],
  ['on-accent', 'accent', KANT, '2.3.0 Kontakt: knoppen, når den er til'],
  ['text-muted', 'surface', TEKST, '2.3.0 Kontakt: ordet til eller fra'],
  ['text', 'surface', TEKST, '2.3.0 Valgliste: det valgte'],
  ['border-strong', 'surface', KANT, '2.3.0 Valgliste: kanten'],
  ['text-muted', 'surface', KANT, '2.3.0 Valgliste: pilen'],
  ['text-muted', 'surface', TEKST, '2.3.0 Valgliste: etiketten og hjælpen'],
  ['text', 'surface', TEKST, '2.3.0 Dialog: overskrift, sætning og indhold'],
  ['text-muted', 'surface', KANT, '2.3.0 Dialog: lukkeknappens kryds'],
  ['text', 'surface-raised', KANT, '2.3.0 Dialog: lukkeknappens kryds ved hover'],
  ['on-accent', 'accent', TEKST, '2.3.0 Dialog: den primære knap'],
  ['danger', 'surface', TEKST, '2.3.0 Dialog: den farlige knaps ord'],
  ['danger', 'surface', KANT, '2.3.0 Dialog: den farlige knaps kant'],
  ['border-strong', 'surface', KANT, '2.3.0 Dialog: den sekundære knaps kant'],
  ['info', 'surface', KANT, '2.3.0 Dialog: fokusring'],
  ['text-muted', 'surface-raised', TEKST, '2.3.0 DataTable: et kolonnehoved, der kan sorteres, og dets pil ↕'],
  ['text', 'surface-raised', TEKST, '2.3.0 DataTable: den sorterede kolonne og pilen ▲/▼, og hover på et hoved'],
  ['text-muted', 'surface-raised', TEKST, '2.3.0 DataTable: gruppeoverskriften over flere kolonner'],
  ['info', 'surface-raised', KANT, '2.3.0 DataTable: fokusring på en sorteringsknap'],
  ['text-muted', 'surface', TEKST, '2.3.0 Sideskift: side X af Y og antal pr. side'],
  ['text', 'surface', TEKST, '2.3.0 Sideskift: forrige og næste'],
  ['border-strong', 'surface', KANT, '2.3.0 Sideskift: kanten om knapperne og valglisten'],
  ['info', 'surface', KANT, '2.3.0 Sideskift: fokusring'],
  // 2.4.0 (K36–K38): tabellen. Rækkehovedet (th scope="row") står i tekstens farve på rækkens flader; skillelinjen mellem
  // kolonnegrupperne er border-strong; den faste første kolonne har surface under sig; rullerammens fokusring er info.
  ['text', 'surface', TEKST, '2.4.0 DataTable: rækkehovedet og den faste første kolonne'],
  ['text', 'surface-raised', TEKST, '2.4.0 DataTable: rækkehovedet ved hover'],
  ['text', 'accent-soft', TEKST, '2.4.0 DataTable: rækkehovedet i en valgt række'],
  ['border-strong', 'surface', KANT, '2.4.0 DataTable: skillelinjen mellem kolonnegrupper i rækkerne'],
  ['border-strong', 'surface-raised', KANT, '2.4.0 DataTable: skillelinjen i hovedet'],
  ['info', 'surface', KANT, '2.4.0 DataTable: fokusring på en række, der åbner, og på rullerammen'],
  // 2.4.0 (K18): tekst, der er slået fra.
  ['text-disabled', 'surface', TEKST, '2.4.0 --text-disabled på surface'],
  ['text-disabled', 'surface-raised', TEKST, '2.4.0 --text-disabled på surface-raised (bånd, tabelhoved)'],
  ['text-disabled', 'bg', TEKST, '2.4.0 --text-disabled på bg'],
  // 2.4.0 (K19): hover på et mærke er stadig et mærke (3:1 mod fladerne).
  ...['ok', 'warn', 'danger', 'info', 'none'].flatMap(m => ['surface', 'surface-raised', 'bg'].map(f => [m + '-mark-hover', f, KANT, `2.4.0 hover på mærket (${m}) mod ${f}`])),
  // 2.4.0 (K21): tekst på et mærkes svage flade (18 % over surface) og på den næsten dækkende flade (surface 92 %) over
  // kortets eller skalaens mørkeste/lyseste farve. mix(A N%, B) er color-mix(in srgb, A N%, B), og color-mix med
  // transparent lagt på B giver det samme.
  ...['ok', 'warn', 'danger', 'info', 'none'].flatMap(m => [['text', `mix(${m}-mark 18%, surface)`, TEKST, `2.4.0 tekst på mærkets svage flade (${m})`], ['text-muted', `mix(${m}-mark 18%, surface)`, TEKST, `2.4.0 sekundær tekst på mærkets svage flade (${m})`]]),
  ...['map-sea', 'map-land', 'seq-5', 'danger-mark', 'data-3'].map(u => ['text', `mix(surface 92%, ${u})`, TEKST, `2.4.0 tekst på næsten dækkende flade over ${u}`]),
  ['danger', 'mix(surface 92%, map-sea)', TEKST, '2.4.0 demoens forklaring på kortet: angreb'],
  ['info', 'mix(surface 92%, map-sea)', TEKST, '2.4.0 demoens forklaring på kortet: bue'],
  // 2.5.0 (K23): titellinjeknapper. Slået fra er .rk med opacity .6 (mix 60 % over titellinjen); aria-current har en streg
  // i --accent-on-rail og aria-expanded en ring i --rail-text på den aktive flade.
  ['mix(rail-text 60%, rail)', 'rail', TEKST, '2.5.0 titellinjeknap slået fra (opacity .6)'],
  ['accent-on-rail', 'rail-active', KANT, '2.5.0 titellinjeknap med aria-current: stregen forneden'],
  ['rail-text', 'rail-active', KANT, '2.5.0 titellinjeknap med aria-expanded: ringen'],
  ['rail-strong', 'rail-active', TEKST, '2.5.0 titellinjeknap med aria-current eller aria-expanded: ikonet'],
  // 2.5.0 (K24): visningsskiftet. Tallet, der kræver handling, er danger på danger-soft med kant i danger; et punkt slået fra
  // er nedtonet (opacity .5; slået fra er undtaget fra 4,5:1, men ikonet og ordet skal stadig ses: 3:1).
  ['danger', 'danger-soft', TEKST, '2.5.0 visningsskiftets tal, der kræver handling'],
  ['danger', 'surface-raised', KANT, '2.5.0 kanten om tallet, der kræver handling, mod visningsskiftet'],
  ['danger', 'border', KANT, '2.5.0 kanten om tallet, der kræver handling, på den aktive visning'],
  ['text-muted', 'surface-raised', TEKST, '2.5.0 visningsskiftets almindelige tal'],
  ['mix(text 50%, surface-raised)', 'surface-raised', KANT, '2.5.0 et punkt i visningsskiftet slået fra (opacity .5)'],
  // 2.5.0 (K25): statusdelen i fodlinjen (surface-raised; surface ved hover på knappen).
  ...['ok', 'warn', 'danger', 'info'].map(v => [v, 'surface-raised', TEKST, `2.5.0 fodstatus: symbolet for ${v}`]),
  ...['ok', 'warn', 'danger', 'info'].map(v => [v, 'surface', TEKST, `2.5.0 fodstatus: symbolet for ${v} ved hover`]),
  ['text', 'surface', TEKST, '2.5.0 fodstatus: teksten i knappen ved hover'],
  ['accent', 'border', KANT, '2.5.0 fodstatus: fremdriften (accent på border)'],
  ['accent', 'surface-raised', KANT, '2.5.0 fodstatus: ringen, der snurrer (accent)'],
  ['info', 'surface-raised', KANT, '2.5.0 fodstatus: fokusring på knappen'],
  // 2.5.0 (K32, K33, K34, G8): kassens ikon, den valgte flise og flisens andet mål, filteret, der kan fjernes, og den tomme
  // flade, mens filer trækkes over.
  ['accent', 'surface-raised', KANT, '2.5.0 kassens ikon i overskriften'],
  ['accent', 'surface', KANT, '2.5.0 kanten om den valgte flise og om et aktivt filter'],
  ['accent', 'bg', KANT, '2.5.0 kanten om den valgte flise mod baggrunden'],
  ['text', 'accent-soft', TEKST, '2.5.0 tal og navn på den valgte flise; ordet i et aktivt filter'],
  ['text-muted', 'accent-soft', TEKST, '2.5.0 flisens navn på den valgte flise'],
  ['info', 'accent-soft', TEKST, '2.5.0 flisens andet mål (link) på den valgte flise'],
  ['info', 'surface', TEKST, '2.5.0 flisens andet mål (link)'],
  ['info', 'surface-raised', TEKST, '2.5.0 flisens andet mål ved hover på flisen'],
  ['accent', 'accent-soft', KANT, '2.5.0 den stiplede kant om en tom flade, mens filer trækkes over'],
  ['danger', 'surface', TEKST, '2.5.0 dialogens fejlfelt'],
  // 2.6.0: visningerne som faner øverst (.vfaner på surface). En fane slået fra er brødteksten med opacity .5 (mix 50 % over
  // fladen); den valgte har stregen og ikonet i accent; en valgt tabelrække under musen viser valget (text på accent-soft,
  // som en valgt række i forvejen).
  ['text-muted', 'surface', TEKST, '2.6.0 fanerne øverst: navn og tal på en fane, der ikke er valgt'],
  ['text', 'surface', TEKST, '2.6.0 fanerne øverst: den valgte fane og hover'],
  ['text-muted', 'surface', KANT, '2.6.0 fanerne øverst: ikonet på en fane, der ikke er valgt'],
  ['accent', 'surface', KANT, '2.6.0 fanerne øverst: stregen under den valgte fane og dens ikon'],
  ['info', 'surface', KANT, '2.6.0 fanerne øverst: fokusringen'],
  ['mix(text 50%, surface)', 'surface', KANT, '2.6.0 fanerne øverst: en fane slået fra (opacity .5)'],
  ['danger', 'danger-soft', TEKST, '2.6.0 fanerne øverst: tallet, der kræver handling'],
  ['danger', 'surface', KANT, '2.6.0 fanerne øverst: kanten om tallet, der kræver handling'],
  ['text', 'accent-soft', TEKST, '2.6.0 en valgt tabelrække under musen (valget vinder over hover)'],
  // 2.7.0: visningerne som store knapper i båndet (.cb på surface-raised; den åbne på accent-soft med streg og ikon i accent),
  // tal på knappen, en visning slået fra (opacity .5), og Mere-menuen (.mere-menu på surface; hover surface-raised; trykket
  // accent-soft; et punkt slået fra har ikon og navn ved .5, hvorfor i sekundær tekst).
  ['text', 'accent-soft', TEKST, '2.7.0 den åbne visning (og en kommando med aria-current) i båndet: navnet på fladen'],
  ['accent', 'accent-soft', KANT, '2.7.0 stregen under den åbne visning og dens ikon'],
  ['info', 'accent-soft', KANT, '2.7.0 fokusringen på den åbne visning'],
  ['text-muted', 'surface-raised', TEKST, '2.7.0 et tal på en visningsknap (kræver ikke handling)'],
  ['text-muted', 'accent-soft', TEKST, '2.7.0 et tal på den åbne visningsknap'],
  ['danger', 'danger-soft', TEKST, '2.7.0 tallet, der kræver handling, på en visningsknap'],
  ['danger', 'surface-raised', KANT, '2.7.0 kanten om tallet, der kræver handling, på båndets flade'],
  ['mix(text 50%, surface-raised)', 'surface-raised', KANT, '2.7.0 en visning slået fra i båndet (opacity .5)'],
  ['text', 'surface', TEKST, '2.7.0 Mere-menuen: punktets navn'],
  ['text-muted', 'surface', TEKST, '2.7.0 Mere-menuen: hvorfor under navnet'],
  ['text', 'surface-raised', TEKST, '2.7.0 Mere-menuen: punktet under musen'],
  ['text', 'accent-soft', TEKST, '2.7.0 Mere-menuen: et trykket punkt (menuitemcheckbox)'],
  ['mix(text 50%, surface)', 'surface', KANT, '2.7.0 Mere-menuen: ikon og navn på et punkt slået fra (opacity .5)'],
  ['info', 'surface', KANT, '2.7.0 Mere-menuen: fokusringen'],
  // 2.8.0: visningerne som båndets faner (.cmd-faner på bg; en fane under musen på surface; den åbne på surface-raised med
  // streg og ikon i accent og en kant i border; tal i sekundær tekst; slået fra ved .5; fokusring i info).
  ['text', 'bg', TEKST, '2.8.0 fanerne: navnet på en fane på rækkens flade'],
  ['text-muted', 'bg', TEKST, '2.8.0 fanerne: et tal på en fane'],
  ['text-muted', 'bg', KANT, '2.8.0 fanerne: ikonet på en fane'],
  ['text', 'surface', TEKST, '2.8.0 fanerne: en fane under musen'],
  ['text', 'surface-raised', TEKST, '2.8.0 fanerne: den åbne fanes navn på båndets flade'],
  ['accent', 'surface-raised', KANT, '2.8.0 fanerne: stregen øverst på den åbne fane og dens ikon'],
  ['text-muted', 'surface-raised', TEKST, '2.8.0 fanerne: et tal på den åbne fane'],
  ['danger', 'danger-soft', TEKST, '2.8.0 fanerne: tallet, der kræver handling'],
  ['danger', 'bg', KANT, '2.8.0 fanerne: kanten om tallet, der kræver handling, på rækkens flade'],
  ['mix(text 50%, bg)', 'bg', KANT, '2.8.0 fanerne: en fane slået fra (opacity .5)'],
  ['info', 'bg', KANT, '2.8.0 fanerne: fokusringen på en fane'],
  ['info', 'surface-raised', KANT, '2.8.0 fanerne: fokusringen på den åbne fane'],
  // V-OPBYG.1 (Grimnir, app.css): trinene (det aktuelle på accent-soft, tallet hvidt på accent, de næste i sekundær tekst
  // med en ring i border-strong), den kommando, der er næste skridt (kant i accent på accent-soft), sikkerheden ved typen og
  // "bevares som den er" (sekundær tekst på tabellen), den aktuelle sag i venstre side og fluebenet ved Gemmes automatisk.
  ['text', 'accent-soft', TEKST, 'V-OPBYG.1 trin: det aktuelle trin'],
  ['on-accent', 'accent', TEKST, 'V-OPBYG.1 trin: tallet og fluebenet i det aktuelle og de færdige trin'],
  ['text-muted', 'bg', TEKST, 'V-OPBYG.1 trin: de næste trin på arbejdsfladen'],
  ['text-muted', 'surface', TEKST, 'V-OPBYG.1 trin: tallet i et kommende trin'],
  ['border-strong', 'bg', KANT, 'V-OPBYG.1 trin: ringen om et kommende trin'],
  ['accent', 'accent-soft', KANT, 'V-OPBYG.1 næste skridt i båndet: kanten'],
  ['text', 'accent-soft', TEKST, 'V-OPBYG.1 næste skridt i båndet: navnet'],
  // V-OPBYG.6 N2 (Grimnir, app.css): næste skridt i Mere: Mere-knappen har knappens markering (kant i accent på
  // accent-soft, fed tekst), og punktet i menuen får en kant i accent inden i punktet på accent-soft, med ikonet i accent;
  // kanten står også mod menuens flade (surface).
  ['accent', 'accent-soft', KANT, 'V-OPBYG.6 N2 Mere-knappen som næste skridt: kanten'],
  ['text', 'accent-soft', TEKST, 'V-OPBYG.6 N2 Mere-knappen som næste skridt: navnet'],
  ['accent', 'accent-soft', KANT, 'V-OPBYG.6 N2 næste skridt i Mere-menuen: kanten og ikonet i punktet'],
  ['accent', 'surface', KANT, 'V-OPBYG.6 N2 næste skridt i Mere-menuen: kanten mod menuens flade'],
  ['text', 'accent-soft', TEKST, 'V-OPBYG.6 N2 næste skridt i Mere-menuen: navnet'],
  ['text-muted', 'surface', TEKST, 'V-OPBYG.1 sikkerheden ved typen og "bevares som den er"'],
  ['text-muted', 'surface', TEKST, 'V-OPBYG.1 Aktuel sag: overskrift, status og "Alt behandles på denne maskine"'],
  ['accent', 'surface', TEKST, 'V-OPBYG.1 Aktuel sag: fluebenet ved Gemmes automatisk'],
  // V-OPBYG.2 (Grimnir, app.css): markeringen i teksten (::highlight; understregning i ok, stiplet i warn, den valgte række og
  // koderne med en flade bag teksten), linjenumrene (sekundær tekst på surface-raised med en kant i border), fanen Noter
  // (tidspunktet i sekundær tekst, den valgte note med en kant i accent på accent-soft, fejlen i danger).
  ['ok', 'surface', KANT, 'V-OPBYG.2 markering: understregningen under en værdi, der maskeres'],
  ['warn', 'surface', KANT, 'V-OPBYG.2 markering: den stiplede streg under et usikkert fund (Tjek selv)'],
  ['text', 'warn-soft', TEKST, 'V-OPBYG.2 markering: teksten i den valgte række (flade)'],
  ['warn', 'warn-soft', KANT, 'V-OPBYG.2 markering: stregen over og under den valgte række'],
  ['text', 'ok-soft', TEKST, 'V-OPBYG.2 markering: en kode efter maskeringen (flade)'],
  ['ok', 'ok-soft', KANT, 'V-OPBYG.2 markering: understregningen under en kode'],
  ['text-muted', 'surface-raised', TEKST, 'V-OPBYG.2 linjenumrene'],
  ['text-muted', 'surface', TEKST, 'V-OPBYG.2 Noter: tidspunktet over en note'],
  ['text', 'accent-soft', TEKST, 'V-OPBYG.2 Noter: teksten i den valgte note'],
  ['accent', 'accent-soft', KANT, 'V-OPBYG.2 Noter: kanten om den valgte note'],
  ['danger', 'surface', TEKST, 'V-OPBYG.2 Noter: fejlen under feltet'],
  // V-OPBYG.3 (Grimnir, app.css): mærket er masken (D28) i titellinjen (kittets .mrk-maske i accent-on-rail på rail), på
  // låseskærmen og i Om-dialogen (accent på arbejdsfladen og dialogens flade, begge surface); Om-dialogens ikoner (accent),
  // punkternes sætning (sekundær tekst), tredjepartslicenserne (tekst på surface-raised med en kant) og fejlen (danger).
  ['accent-on-rail', 'rail', KANT, 'V-OPBYG.3 mærket (masken) i titellinjen'],
  ['accent', 'surface', KANT, 'V-OPBYG.3 mærket (masken) på låseskærmen'],
  ['accent', 'surface', KANT, 'V-OPBYG.3 mærket (masken) i Om Grimnir'],
  ['accent', 'surface', KANT, 'V-OPBYG.3 Om Grimnir: ikonet ved hvert punkt'],
  ['text-muted', 'surface', TEKST, 'V-OPBYG.3 Om Grimnir: punkternes sætning'],
  ['text', 'surface-raised', TEKST, 'V-OPBYG.3 Om Grimnir: tredjepartslicenserne'],
  ['danger', 'surface', TEKST, 'V-OPBYG.3 Om Grimnir: licenserne kunne ikke vises'],
  ['rail-text', 'rail', KANT, 'V-OPBYG.3 ⓘ i titellinjen (ikonet)'],
  ['rail-strong', 'rail-active', KANT, 'V-OPBYG.3 ⓘ i titellinjen ved hover'],
];

/* En farve fra et tokennavn eller fra mix(A N%, B): A og B blandet i srgb, N % af A. */
const BLAND = /^mix\(([a-z0-9-]+) (\d+(?:\.\d+)?)%, ([a-z0-9-]+)\)$/;
export function farveAf(spec, farver) {
  const m = BLAND.exec(spec);
  if (!m) {
    if (!(spec in farver)) throw new Error('ukendt token: ' + spec);
    return farver[spec];
  }
  const [a, b] = [farveAf(m[1], farver), farveAf(m[3], farver)], p = Number(m[2]) / 100;
  const kanal = (h, i) => parseInt(h.slice(1 + 2 * i, 3 + 2 * i), 16);
  return '#' + [0, 1, 2].map(i => Math.round(kanal(a, i) * p + kanal(b, i) * (1 - p)).toString(16).padStart(2, '0')).join('').toUpperCase();
}

function lin(c) {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}
function luminans(hex) {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) throw new Error('ikke en farve: ' + hex);
  const [r, g, b] = m.slice(1).map(h => lin(parseInt(h, 16)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function kontrast(a, b) {
  const [l1, l2] = [luminans(a), luminans(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

const tokens = laesTokens();
console.log('Tokens læses fra ' + path.relative(process.cwd(), KILDE) + '\n');
let fejl = 0, ok = 0;
for (const tema of ['light', 'dark']) {
  const farver = Object.fromEntries(temaVaerdier(tokens, tema));
  for (const [fg, bg, graense, hvor] of PAR) {
    const k = kontrast(farveAf(fg, farver), farveAf(bg, farver));
    const bestaar = k >= graense;
    if (bestaar) ok++;
    else fejl++;
    console.log(`${bestaar ? 'ok  ' : 'FEJL'} ${tema.padEnd(5)} ${fg} på ${bg}: ${k.toFixed(2)}:1 (mindst ${graense}:1) · ${hvor}`);
  }
}
console.log(`\n${PAR.length} par × 2 temaer = ${ok + fejl} kontroller: ${ok} bestod, ${fejl} fejlede`);
process.exit(fejl ? 1 : 0);
