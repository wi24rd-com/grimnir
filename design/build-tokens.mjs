// Wi24rd UI Kit 2: pakkens tokens.json → tokens.css (web) og Tokens.xaml (WPF). Ingen afhængigheder ud over Node selv.
//   node design/build-tokens.mjs          skriver begge filer i design/ui-kit-2/pakke/tokens/
//   node design/build-tokens.mjs --check  sammenligner med filerne på disken (exit 1 ved forskel)
// Kilden er design/ui-kit-2/pakke/tokens/wi24rd-ui-kit-2.tokens.json (V-KIT.1: pakken er kittets ene kilde). Programmets
// egen kopi af tokens.css (ui/assets/tokens.css) laves af design/build-kit.mjs.
// Formatet: farver og skygger er lister af {name, value: {light, dark}, usage}; luft og radier {name, value}; skrift har
// families (sans, mono) og grupper af stilarter. I CSS står lyst tema på :root, mørkt på [data-tema="moerk"], og ved
// [data-tema="system"] følger temaet prefers-color-scheme. I XAML er hvert tema én ordbog med alle tokens (se bygXaml).
// Mønsteret (én JSON-fil, ét lille script, --check) er Huginn and Muninns; selve læsningen er ny, fordi kittets format
// er et andet (TILLAEG-UI-KIT-2, Q2).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const PAKKE = path.join(REPO, 'design', 'ui-kit-2', 'pakke');
export const KILDE = path.join(PAKKE, 'tokens', 'wi24rd-ui-kit-2.tokens.json');
export const MAAL = path.join(PAKKE, 'tokens', 'tokens.css');
export const MAAL_XAML = path.join(PAKKE, 'tokens', 'Tokens.xaml');
const NAVN = /^[a-z][a-z0-9-]*$/;

export function laesTokens(fil = KILDE) {
  return JSON.parse(fs.readFileSync(fil, 'utf8'));
}
export function pakkeVersion() {
  return fs.readFileSync(path.join(PAKKE, 'VERSION'), 'utf8').trim();
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

export function bygCss(tokens, version = pakkeVersion()) {
  const temaer = tokens.color.themes.map(t => t.id);
  for (const t of Object.keys(TEMA)) if (!temaer.includes(t)) throw new Error('temaet mangler i tokens.json: ' + t);
  // Samme navn må ikke stå både i temaerne og i det fælles lag.
  const alle = new Set();
  for (const [n] of [...faelles(tokens), ...temaVaerdier(tokens, 'light')]) tjekNavn(n, alle);
  return [
    `/* GENERERET fra wi24rd-ui-kit-2.tokens.json (${tokens.name}, pakke ${version}). Ret ikke i hånden: ret JSON-filen i`,
    '   kittets kilde og byg igen (node design/build-tokens.mjs). Lyst tema er standard; <html data-tema="moerk"> vælger',
    '   mørkt, og <html data-tema="system"> følger macOS/Windows (prefers-color-scheme). */',
    blok(':root', faelles(tokens)),
    blok(':root', temaVaerdier(tokens, 'light'), '', 'light'),
    blok(`:root[data-tema="${TEMA.dark}"]`, temaVaerdier(tokens, 'dark'), '', 'dark'),
    `@media (prefers-color-scheme: dark) {\n${blok(':root[data-tema="system"]', temaVaerdier(tokens, 'dark'), '  ', 'dark')}\n}`,
  ].join('\n') + '\n';
}

/* ── XAML (WPF) ──
   Navnereglen: Wi24rd + tokenets navn i PascalCase (bindestreger væk, hvert led med stort: surface-raised →
   SurfaceRaised, space-1 → Space1). Navnet er CSS-variablens: --body-size → Wi24rdBodySize. Farver får to nøgler:
   …Brush (SolidColorBrush, den man normalt bruger) og …Color (Color). Luft får også …Thickness (til Margin og Padding).
   Hvert tema er én ResourceDictionary med ALLE tokens (også dem, der er ens i begge temaer), så programmet fletter præcis
   én ind ad gangen: x:Key="Wi24rdLys" og x:Key="Wi24rdMoerk" i filens yderste ordbog. */
export const XAML_TEMA = { light: 'Wi24rdLys', dark: 'Wi24rdMoerk' };
export const pascal = navn => 'Wi24rd' + navn.split('-').map(d => d.charAt(0).toUpperCase() + d.slice(1)).join('');
const xml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const VAEGT = { 400: 'Normal', 500: 'Medium', 600: 'SemiBold', 700: 'Bold' };
/* CSS' generiske familier findes ikke i WPF; resten er navne, WPF selv prøver i rækkefølge. */
const GENERISK = new Set(['system-ui', 'sans-serif', 'serif', 'monospace', 'ui-monospace', 'ui-sans-serif']);
const px = (v, navn) => {
  const m = /^(-?\d+(?:\.\d+)?)px$/.exec(v);
  if (!m) throw new Error(`${navn}: kan ikke læses som px: ${v}`);
  return m[1];
};
export function argb(hex, navn) {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) throw new Error(`${navn}: farven skal være #RRGGBB: ${hex}`);
  return '#FF' + m[1].toUpperCase();
}
const familie = v => v.split(',').map(d => d.trim().replace(/^"|"$/g, '')).filter(d => !GENERISK.has(d)).join(', ');
/* "x y blur [spread] rgba(r,g,b,a)" → DropShadowEffect. WPF har ingen spredning: den udelades (står i README). */
function skygge(v, navn) {
  const m = /^(-?\d+(?:\.\d+)?)(?:px)? (-?\d+(?:\.\d+)?)px (\d+(?:\.\d+)?)px(?: (-?\d+(?:\.\d+)?)px)? rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)$/.exec(v);
  if (!m || Number(m[1]) !== 0) throw new Error(`${navn}: skyggen kan ikke oversættes: ${v}`);
  const hex = '#' + [m[5], m[6], m[7]].map(n => Number(n).toString(16).padStart(2, '0')).join('').toUpperCase();
  return `<DropShadowEffect x:Key="${pascal(navn)}" Direction="270" ShadowDepth="${m[2]}" BlurRadius="${m[3]}" Color="${hex}" Opacity="${m[8]}"/>`;
}

function xamlTema(tokens, tema) {
  const set = new Set(), ud = [];
  const post = (noegle, linje) => {
    if (set.has(noegle)) throw new Error('dobbelt XAML-nøgle: ' + noegle);
    set.add(noegle);
    ud.push(linje);
  };
  for (const t of tokens.color.tokens) {
    const c = argb(t.value[tema], t.name), n = pascal(t.name);
    post(n + 'Color', `<Color x:Key="${n}Color">${c}</Color>`);
    post(n + 'Brush', `<SolidColorBrush x:Key="${n}Brush" Color="${c}"/>`);
  }
  for (const t of tokens.shadow.tokens) post(pascal(t.name), skygge(t.value[tema], t.name));
  for (const [k, v] of Object.entries(tokens.type.families)) {
    const n = pascal(`font-${k}`);
    post(n, `<FontFamily x:Key="${n}">${xml(familie(v))}</FontFamily>`);
  }
  for (const g of tokens.type.groups) {
    for (const s of g.styles) {
      const n = pascal(s.name);
      if (!VAEGT[s.fontWeight]) throw new Error(`${s.name}: ukendt skriftvægt ${s.fontWeight}`);
      post(n + 'Size', `<sys:Double x:Key="${n}Size">${px(s.fontSize, s.name)}</sys:Double>`);
      post(n + 'Line', `<sys:Double x:Key="${n}Line">${px(s.lineHeight, s.name)}</sys:Double>`);
      post(n + 'Weight', `<FontWeight x:Key="${n}Weight">${VAEGT[s.fontWeight]}</FontWeight>`);
      if (s.letterSpacing) {
        const m = /^(-?\d+(?:\.\d+)?)em$/.exec(s.letterSpacing);
        if (!m) throw new Error(`${s.name}: letterSpacing skal være i em`);
        post(n + 'Tracking', `<sys:Double x:Key="${n}Tracking">${m[1]}</sys:Double>`);
      }
      post(n + 'Family', `<FontFamily x:Key="${n}Family">${xml(familie(tokens.type.families[g.family]))}</FontFamily>`);
    }
  }
  for (const t of tokens.spacing.tokens) {
    const n = pascal(t.name), v = px(t.value, t.name);
    post(n, `<sys:Double x:Key="${n}">${v}</sys:Double>`);
    post(n + 'Thickness', `<Thickness x:Key="${n}Thickness">${v}</Thickness>`);
  }
  for (const t of tokens.radius.tokens) {
    const n = pascal(t.name);
    post(n, `<CornerRadius x:Key="${n}">${px(t.value, t.name)}</CornerRadius>`);
  }
  return ud;
}

export function bygXaml(tokens, version = pakkeVersion()) {
  const ordbog = tema => [
    `  <ResourceDictionary x:Key="${XAML_TEMA[tema]}">`,
    ...xamlTema(tokens, tema).map(l => '    ' + l),
    '  </ResourceDictionary>',
  ];
  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    `<!-- GENERERET fra wi24rd-ui-kit-2.tokens.json (${xml(tokens.name)}, pakke ${version}). Ret ikke i hånden.`,
    '     To ordbøger med de samme nøgler: Wi24rdLys og Wi24rdMoerk. Flet præcis én ind i programmets ressourcer og brug',
    '     DynamicResource, så temaet kan skiftes (se pakkens README.md). Tal er WPF-enheder (1 = 1 px ved 96 dpi);',
    '     …Tracking er i em, og WPF har ingen egenskab til det på TextBlock. -->',
    '<ResourceDictionary xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"',
    '                    xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"',
    '                    xmlns:sys="clr-namespace:System;assembly=System.Runtime">',
    ...ordbog('light'),
    ...ordbog('dark'),
    '</ResourceDictionary>',
  ].join('\n') + '\n';
}

const erHoved = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (erHoved) {
  const tokens = laesTokens();
  const filer = [[MAAL, bygCss(tokens)], [MAAL_XAML, bygXaml(tokens)]];
  if (process.argv.includes('--check')) {
    let fejl = 0;
    for (const [fil, indhold] of filer) {
      const paaDisk = fs.existsSync(fil) ? fs.readFileSync(fil, 'utf8') : '';
      if (paaDisk !== indhold) {
        console.error(path.relative(REPO, fil) + ' afviger fra tokens.json. Kør: node design/build-tokens.mjs');
        fejl++;
      }
    }
    if (fejl) process.exit(1);
    const css = filer[0][1], xaml = filer[1][1];
    console.log('tokens.css svarer til tokens.json (' + css.split('\n').filter(l => l.trim().startsWith('--')).length + ' variabler)');
    console.log('Tokens.xaml svarer til tokens.json (' + (xaml.match(/ x:Key="/g).length - 2) + ' nøgler i to ordbøger)');
  } else {
    for (const [fil, indhold] of filer) {
      fs.writeFileSync(fil, indhold);
      console.log('skrev ' + path.relative(REPO, fil));
    }
  }
}
