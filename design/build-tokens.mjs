// Wi24rd UI Kit 2: design/wi24rd-ui-kit-2.tokens.json → ui/assets/tokens.css. Ingen afhængigheder ud over Node selv.
//   node design/build-tokens.mjs          skriver filen
//   node design/build-tokens.mjs --check  sammenligner med filen på disken (exit 1 ved forskel)
// Formatet: farver og skygger er lister af {name, value: {light, dark}, usage}; luft og radier {name, value}; skrift har
// families (sans, mono) og grupper af stilarter. Lyst tema står på :root, mørkt på [data-tema="moerk"], og ved
// [data-tema="system"] følger temaet prefers-color-scheme. Mønsteret (én JSON-fil, ét lille script, --check) er
// Huginn and Muninns; selve læsningen er ny, fordi kittets format er et andet (TILLAEG-UI-KIT-2, Q2).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const KILDE = path.join(REPO, 'design', 'wi24rd-ui-kit-2.tokens.json');
export const MAAL = path.join(REPO, 'ui', 'assets', 'tokens.css');
const NAVN = /^[a-z][a-z0-9-]*$/;

export function laesTokens(fil = KILDE) {
  return JSON.parse(fs.readFileSync(fil, 'utf8'));
}

/* Temaernes id'er i filen (light, dark) og deres navn i data-tema. */
const TEMA = { light: 'lys', dark: 'moerk' };

function tjekNavn(navn, set) {
  if (!NAVN.test(navn)) throw new Error('ugyldigt tokennavn: ' + navn);
  if (set.has(navn)) throw new Error('dobbelt tokennavn: ' + navn);
  set.add(navn);
}

/* Farver og skygger for ét tema: [[navn, værdi], …]. */
export function temaVaerdier(tokens, tema) {
  const ud = [];
  for (const t of [...tokens.color.tokens, ...tokens.shadow.tokens]) {
    const v = t.value && t.value[tema];
    if (typeof v !== 'string') throw new Error(`${t.name}: mangler værdi for ${tema}`);
    ud.push([t.name, v]);
  }
  return ud;
}

/* Det, der er ens i begge temaer: skriftfamilier, skriftstile, luft og radier. */
function faelles(tokens) {
  const ud = [];
  for (const [k, v] of Object.entries(tokens.type.families)) ud.push([`font-${k}`, v]);
  for (const g of tokens.type.groups) {
    for (const s of g.styles) {
      ud.push([`${s.name}-size`, s.fontSize], [`${s.name}-line`, s.lineHeight], [`${s.name}-weight`, String(s.fontWeight)]);
      if (s.letterSpacing) ud.push([`${s.name}-tracking`, s.letterSpacing]);
      ud.push([`${s.name}-family`, `var(--font-${g.family})`]);
    }
  }
  for (const t of [...tokens.spacing.tokens, ...tokens.radius.tokens]) ud.push([t.name, t.value]);
  return ud;
}

function blok(vaelger, poster, indryk = '', scheme = null) {
  const set = new Set();
  const linjer = poster.map(([navn, v]) => {
    tjekNavn(navn, set);
    return `${indryk}  --${navn}: ${v};`;
  });
  if (scheme) linjer.unshift(`${indryk}  color-scheme: ${scheme};`);
  return `${indryk}${vaelger} {\n${linjer.join('\n')}\n${indryk}}`;
}

export function bygCss(tokens) {
  const temaer = tokens.color.themes.map(t => t.id);
  for (const t of Object.keys(TEMA)) if (!temaer.includes(t)) throw new Error('temaet mangler i tokens.json: ' + t);
  // Samme navn må ikke stå både i temaerne og i det fælles lag.
  const alle = new Set();
  for (const [n] of [...faelles(tokens), ...temaVaerdier(tokens, 'light')]) tjekNavn(n, alle);
  return [
    `/* GENERERET af design/build-tokens.mjs fra design/wi24rd-ui-kit-2.tokens.json (${tokens.name}, version ${tokens.version}).`,
    '   Ret ikke i hånden: ret JSON-filen og kør node design/build-tokens.mjs. Lyst tema er standard; <html data-tema="moerk">',
    '   vælger mørkt, og <html data-tema="system"> følger macOS/Windows (prefers-color-scheme). */',
    blok(':root', faelles(tokens)),
    blok(':root', temaVaerdier(tokens, 'light'), '', 'light'),
    blok(`:root[data-tema="${TEMA.dark}"]`, temaVaerdier(tokens, 'dark'), '', 'dark'),
    `@media (prefers-color-scheme: dark) {\n${blok(':root[data-tema="system"]', temaVaerdier(tokens, 'dark'), '  ', 'dark')}\n}`,
  ].join('\n') + '\n';
}

const erHoved = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (erHoved) {
  const css = bygCss(laesTokens());
  if (process.argv.includes('--check')) {
    const paaDisk = fs.existsSync(MAAL) ? fs.readFileSync(MAAL, 'utf8') : '';
    if (paaDisk !== css) {
      console.error('tokens.css afviger fra design/wi24rd-ui-kit-2.tokens.json. Kør: node design/build-tokens.mjs');
      process.exit(1);
    }
    console.log('tokens.css svarer til tokens.json (' + css.split('\n').filter(l => l.trim().startsWith('--')).length + ' variabler)');
  } else {
    fs.writeFileSync(MAAL, css);
    console.log('skrev ' + path.relative(REPO, MAAL));
  }
}
