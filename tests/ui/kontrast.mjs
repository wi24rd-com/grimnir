// Kontrast for Wi24rd UI Kit 2's par i begge temaer, regnet ud fra design/wi24rd-ui-kit-2.tokens.json (WCAG 2.x
// relativ luminans). Tekst mod flade skal være mindst 4,5:1; kontrolkanter, fokusring og ikoner, der bærer betydning,
// mindst 3:1. Fejler (exit 1), hvis et par er under grænsen. Brug: node tests/ui/kontrast.mjs
// Listen er kittets par, som kit.css og app.css bruger dem; et nyt par i CSS'en skal også stå her.
import { laesTokens, temaVaerdier } from '../../design/build-tokens.mjs';

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
  // Den primære knaps fokusring står 2 px uden for knappen (outline-offset i kit.css) og ligger derfor på fladen omkring
  // den (info på surface/bg), ikke på accent. info på accent er 1,1:1 og må aldrig bruges.
];

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
let fejl = 0, ok = 0;
for (const tema of ['light', 'dark']) {
  const farver = Object.fromEntries(temaVaerdier(tokens, tema));
  for (const [fg, bg, graense, hvor] of PAR) {
    if (!(fg in farver) || !(bg in farver)) throw new Error(`ukendt token i parret ${fg}/${bg}`);
    const k = kontrast(farver[fg], farver[bg]);
    const bestaar = k >= graense;
    if (bestaar) ok++;
    else fejl++;
    console.log(`${bestaar ? 'ok  ' : 'FEJL'} ${tema.padEnd(5)} ${fg} på ${bg}: ${k.toFixed(2)}:1 (mindst ${graense}:1) · ${hvor}`);
  }
}
console.log(`\n${PAR.length} par × 2 temaer = ${ok + fejl} kontroller: ${ok} bestod, ${fejl} fejlede`);
process.exit(fejl ? 1 : 0);
