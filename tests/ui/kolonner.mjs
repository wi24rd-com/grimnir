// V-RET.1 R1: regnetest for tabellernes kolonner. jsdom har ingen layout, så bredderne regnes ud fra CSS'en: NavPane'ens
// bredde (kit.css), arbejdsfladens polstring, gitteret i Maskér og hvornår det stables (app.css), panelernes kant og hver
// tabels kolonnevariabler (--k1 … --k7, --celle, --tabel-min, også de engelske og dem i @media). For 900 (mindste), 1200
// (standard), 1600 og 1920 px og overgangene imellem regnes det ud, at værdikolonnen får mindst 140 px, at tabellen ikke ruller
// vandret, og at hver overskrift, chip og typeord kan være i sin kolonne (målt i WebKit, se MAALT_*).
//
// Hvad testen IKKE kan se: den regner, den tegner ikke. Den bygger på, at WebKit giver en tabelcelle præcis sin bredde med
// polstring (målt i V-RET.1 i en WKWebView), og på teksternes bredde målt dér med Inter (pakket med). Windows (WebView2,
// Segoe UI som reserve, klassiske rullebjælker) er ikke målt; en klassisk rullebjælke regnes med 16 px (antaget, ikke
// målt), og dér må tabellen gerne rulle vandret. Højder, rækker, der brydes over flere linjer, og tekst, brugeren selv
// skriver (værdier, sagsnavne, noter), er ikke med; de forkortes med … og står hele i title.
// Brug: npm run test:kolonner (= node tests/ui/kolonner.mjs).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const laes = p => fs.readFileSync(path.join(repo, p), 'utf8');
let ok = 0, fejl = 0;
const tjek = (navn, betingelse, detalje = '') => {
  if (betingelse) { ok++; console.log('ok   ' + navn); } else { fejl++; console.log('FEJL ' + navn + (detalje ? ' — ' + detalje : '')); }
};

/* Teksternes naturlige bredde i px, målt i V-RET.1 i en WKWebView (macOS 26.6, WebKit som i Tauri) med ui/assets/kit.css
   og de pakkede skrifter: kolonneoverskrifter (også hvert ord), chips i den variant, koden bruger, og det længste ord, der
   ikke kan brydes, i hver type. Ændres en tekst, mangler den her, og testen fejler: mål den igen. */
const MAALT_TH = { '✓': 11, 'Type': 32, 'Fundet værdi': 92, 'Fundet': 49, 'værdi': 40, 'Erstatning': 77, 'Antal': 41, 'Status': 47, 'Hvad': 34, 'Tekst': 40, 'Linje': 34, 'Kode': 34, 'Navn': 35, 'Værdier': 55, 'Oprettet': 64, 'Sidst brugt': 81, 'Sidst': 36, 'brugt': 41, 'Udløber': 57, 'Ordbog': 52, 'Værdi eller mønster': 143, 'Værdi': 40, 'eller': 37, 'mønster': 60, 'Note': 34, 'Value found': 86, 'Value': 40, 'found': 43, 'Replacement': 90, 'Count': 44, 'What': 37, 'Text': 32, 'Line': 27, 'Code': 34, 'Name': 36, 'Values': 48, 'Created': 56, 'Last used': 68, 'Last': 32, 'used': 33, 'Expires': 51, 'Dictionary': 76, 'Value or pattern': 118, 'or': 17, 'pattern': 55 };
const MAALT_CHIP = { 'Sikker': 69, 'Fra ordbog': 89, 'Sandsynlig': 91, 'Tjek selv': 81, 'Version': 75, 'Original står tilbage': 140, 'Ligner følsom værdi': 142, 'Sat tilbage': 95, 'Ukendt adresse i sagens net': 193, 'Ukendt kode': 102, 'Andre store/små bogstaver': 185, 'Maskine uden domæne': 162, 'Domæne alene': 113, 'Escaped skråstreg': 134, 'URL-kodet': 87, 'Ikke i svaret': 100, 'Ligner en anden sag': 146, 'Pulje løb over: egne net': 162, 'Pulje løb over: offentlige adresser': 221, 'Pulje løb over: MAC-adresser': 196, 'Pulje løb over: IPv6': 137, 'Åben': 64, 'Udløber snart': 106, 'Udløbet': 75, 'Kan ikke åbnes': 117, 'Certain': 76, 'From dictionary': 117, 'Probable': 78, 'Check yourself': 117, 'Original left behind': 136, 'Looks sensitive': 116, 'Put back': 84, 'Unknown address in the case network': 250, 'Unknown code': 116, 'Different upper/lower case': 181, 'Machine without domain': 169, 'Domain alone': 105, 'Escaped backslash': 138, 'URL-encoded': 105, 'Not in the reply': 119, 'Looks like another case': 166, 'Pool ran out: own networks': 184, 'Pool ran out: public addresses': 201, 'Pool ran out: MAC addresses': 194, 'Pool ran out: IPv6': 128, 'Open': 64, 'Expiring soon': 105, 'Expired': 73, 'Cannot be opened': 135 };
const MAALT_ORD = { 'IPv4, eget net': 34, 'IPv4, offentlig': 55, 'IPv6, eget net': 33, 'IPv6, offentlig': 55, 'MAC-adresse': 53, 'Maskine': 56, 'Domæne': 61, 'NetBIOS-domæne': 63, 'Bruger': 45, 'Person': 47, 'Database': 63, 'Ord': 25, 'Hemmelighed': 92, 'SID': 23, 'GUID': 35, 'Serienummer': 89, 'CPR-nummer': 55, 'Lang tilfældig streng': 54, 'Ligner en kode': 42, 'IPv4, own network': 54, 'IPv4, public': 41, 'IPv6, own network': 54, 'IPv6, public': 41, 'MAC address': 53, 'Machine': 57, 'Domain': 51, 'NetBIOS domain': 56, 'User': 32, 'Word': 36, 'Secret': 43, 'Serial number': 51, 'CPR number': 51, 'Long random string': 51, 'Looks like a code': 40 };
/* V-PUDS.1 N3: ordene i knapperne Altid og Aldrig (12 px, vægt 600, Inter), målt i en WKWebView (macOS 26.6) med
   ui/assets/*.css og de pakkede skrifter og rundet op, som tallene ovenfor (samme måling gav Ordbog 51,5 → 52,
   Antal 40,2 → 41, Erstatning 76,1 → 77). */
const MAALT_KNAPORD = { 'Altid': 27, 'Aldrig': 35, 'Always': 43, 'Never': 35 };

const VAERDI_MIN = 140;
// V-LAAS.4 N3: 1920 er med som bred skærm; overgangene er de brudpunkter, CSS'en har (1100, 1200 og 1720; 1200 står i BREDDER).
const BREDDER = [900, 1200, 1600, 1920];
// V-PUDS.1 N3: 1839/1840, hvor ordet i Altid/Aldrig kommer igen, når fundene står side om side.
const OVERGANGE = [1099, 1100, 1199, 1719, 1720, 1839, 1840];
/* V-LAAS.4 N3: fra 1200 px skal Erstatning kunne vise 24 tegn i feltets skrift, og Fundet værdi skal have mindst 240 px.
   Feltets skrift er JetBrains Mono (pakket med). Fremføringen er målt i ui/assets/fonts/jetbrains-mono-latin-wght-normal.woff2
   (hhea/hmtx/cmap efter brotli-udpakning): alle 95 tegn fra U+0020 til U+007E har 600 enheder ved unitsPerEm 1000, altså
   0,6 em. Feltets polstring, kant og skriftstørrelse læses fra CSS'en nedenfor. */
const MONO_EM = 0.6;
const ERSTATNING_TEGN = 24;
const ERSTATNING_FRA = 1200;
const VAERDI_BRED = 240;
const RULLEBJAELKE = 16; // en klassisk rullebjælke (antaget, ikke målt)

/* ── CSS → regler: [{ media: {max, min}, valg: [selektorer], decl: {navn: værdi}, nr }] ── */
function regler(css) {
  const ud = [];
  let nr = 0;
  const s = css.replace(/\/\*[\s\S]*?\*\//g, '');
  function blok(tekst, media) {
    let i = 0;
    while (i < tekst.length) {
      const a = tekst.indexOf('{', i);
      if (a < 0) break;
      const prelude = tekst.slice(i, a).trim();
      if (prelude.startsWith('@media')) {
        let dybde = 1, j = a + 1;
        while (dybde && j < tekst.length) { if (tekst[j] === '{') dybde++; else if (tekst[j] === '}') dybde--; j++; }
        const mx = prelude.match(/max-width:\s*(\d+)px/), mn = prelude.match(/min-width:\s*(\d+)px/);
        blok(tekst.slice(a + 1, j - 1), { max: mx ? Number(mx[1]) : null, min: mn ? Number(mn[1]) : null, tekst: prelude });
        i = j;
      } else {
        const b = tekst.indexOf('}', a);
        const decl = {};
        for (const d of tekst.slice(a + 1, b).split(';')) {
          const k = d.indexOf(':');
          if (k > 0) decl[d.slice(0, k).trim()] = d.slice(k + 1).trim();
        }
        ud.push({ media, valg: prelude.split(',').map(x => x.trim().replace(/\s+/g, ' ')), decl, nr: nr++ });
        i = b + 1;
      }
    }
  }
  blok(s, null);
  return ud;
}
const mediaPasser = (m, W) => !m || ((m.max == null || W <= m.max) && (m.min == null || W >= m.min));

const tokens = {};
for (const m of laes('ui/assets/tokens.css').matchAll(/(--[a-z0-9-]+):\s*([^;]+);/g)) if (!(m[1] in tokens)) tokens[m[1]] = m[2].trim();
function px(v) {
  if (v == null) return null;
  const r = v.replace(/var\((--[a-z0-9-]+)(?:,\s*([^)]+))?\)/g, (_, n, fb) => tokens[n] || fb || '');
  const m = r.match(/^(-?\d+(?:\.\d+)?)px$/);
  return m ? Number(m[1]) : r === '0' ? 0 : null;
}
const KIT = regler(laes('ui/assets/kit.css')), APP = regler(laes('ui/assets/app.css'));
const decl = (rl, valg, navn) => { const r = rl.filter(x => !x.media && x.valg.includes(valg) && navn in x.decl); return r.length ? r[r.length - 1].decl[navn] : null; };

/* ── Fladen: NavPane, polstring, gitteret i Maskér, panelets kant ── */
const NAV = px(decl(KIT, '.nav', 'width'));
const PAD = px(decl(APP, '.arbejde', 'padding'));
const GAP = px(decl(APP, '.delt', 'gap'));
const KANT = Number((decl(APP, '.panel', 'border') || '').match(/^(\d+)px/)?.[1]);
const FR = [...(decl(APP, '.delt', 'grid-template-columns') || '').matchAll(/(\d+)fr/g)].map(m => Number(m[1]));
const stak = APP.find(r => r.media && r.media.max && r.valg.includes('.delt:not(.lige)') && /^minmax\(0, 1fr\)$/.test(r.decl['grid-template-columns'] || ''));
const STAK_TIL = stak ? stak.media.max : null;
tjek('fladen: NavPane, polstring, gitter og kant læst fra CSS\'en', NAV === 232 && PAD === 12 && GAP === 12 && KANT === 1 && FR.join() === '2,3', `nav ${NAV}, polstring ${PAD}, gap ${GAP}, kant ${KANT}, fr ${FR}`);
// V-LAAS.4 N3: før 1399; med Erstatning på 24 tegn er der først plads side om side fra 1720 px.
tjek('Maskér: fundene står under teksten op til ' + STAK_TIL + ' px og side om side derover', STAK_TIL === 1719, String(STAK_TIL));
const vinduMin = px(decl(KIT, '.vindue', 'min-width'));
const konf = JSON.parse(laes('src-tauri/tauri.conf.json')).app.windows[0];
tjek('mindste vindue er 900 px i både kit.css og tauri.conf.json (det mindste, der regnes på)', vinduMin === 900 && konf.minWidth === 900 && konf.width === 1200, `${vinduMin} / ${konf.minWidth} / ${konf.width}`);

/* V-LAAS.4 N3: feltet i Erstatning er et <input class="mono"> i en tabelcelle: skriften fra .mono, polstring og kant fra
   .tabel td input. */
const MONO_PX = px(decl(KIT, '.mono', 'font-size'));
const MONO_FAMILIE = decl(KIT, '.mono', 'font-family');
const FELT_POLSTRING = (decl(KIT, '.tabel td input', 'padding') || '').split(/\s+/).map(px);
const FELT_KANT = Number((decl(KIT, '.tabel td input', 'border') || '').match(/^(\d+)px/)?.[1]);
const FELT_EKSTRA = 2 * (FELT_POLSTRING[1] ?? FELT_POLSTRING[0]) + 2 * FELT_KANT;
const TEGN_PX = MONO_EM * MONO_PX;
tjek('V-LAAS.4: feltet i Erstatning er <input class="mono"> med JetBrains Mono 13 px, polstring 8 px og kant 1 px', /inp\.className = 'mono';/.test(laes('ui/assets/maskering.js')) && MONO_FAMILIE === 'var(--mono-family)' && /^"JetBrains Mono"/.test(tokens['--font-mono']) && MONO_PX === 13 && FELT_EKSTRA === 18, `${MONO_FAMILIE} ${tokens['--font-mono']} ${MONO_PX} ${FELT_EKSTRA}`);

/* Pladsen til tabellen ved vinduesbredden W (minus en eventuel rullebjælke). */
function vaertBredde(vaert, W, rb) {
  const inde = W - NAV - 2 * PAD;
  if (vaert === 'masker') return (W > STAK_TIL ? (inde - GAP) * FR[1] / (FR[0] + FR[1]) : inde) - 2 * KANT - rb;
  if (vaert === 'panel') return inde - 2 * KANT - rb;
  return inde - rb;
}

/* Tabellens variabler ved W og sprog: reglerne for .klasse og html[lang="en"] .klasse, i CSS'ens kaskade (en engelsk
   regel vinder over en almindelig; ellers vinder den sidste). */
function variabler(klasse, sprog, W) {
  const passer = APP.filter(r => mediaPasser(r.media, W)).flatMap(r => r.valg.map(v => ({ v, r })))
    .filter(({ v }) => v === '.' + klasse || (sprog === 'en' && v === 'html[lang="en"] .' + klasse))
    .map(({ v, r }) => ({ spec: v.startsWith('html') ? 2 : 1, nr: r.nr, decl: r.decl }))
    .sort((a, b) => a.spec - b.spec || a.nr - b.nr);
  const v = {};
  for (const p of passer) for (const [k, x] of Object.entries(p.decl)) if (k.startsWith('--')) v[k] = x;
  return v;
}
/* Bryder overskrifterne i tabellen ved W (white-space: normal i en @media)? */
const thBrydes = (klasse, W) => APP.some(r => mediaPasser(r.media, W) && r.media && r.valg.includes(`.${klasse} th`) && r.decl['white-space'] === 'normal');

/* ── Tabellerne: kolonnernes sprognøgler (som i koden), værdikolonnen, hvor tabellen står, og chips/typer pr. kolonne ── */
const S = (() => {
  const w = { localStorage: { getItem: () => null, setItem() { } } };
  const doc = { documentElement: {}, addEventListener() { }, dispatchEvent() { } };
  // V-KIT.1: mekanikken er kittets sprogmotor.js (indlæses før sprog.js, som i index.html).
  new Function('window', 'localStorage', 'document', 'CustomEvent', laes('ui/assets/sprogmotor.js') + '\n' + laes('ui/assets/sprog.js'))(w, w.localStorage, doc, function () { });
  return w.Sprog;
})();
const T = S.TEKST;
const ART = Object.keys(T.da).filter(k => k.startsWith('art_'));
const TABELLER = [
  { klasse: 'fundtabel', fil: 'ui/assets/maskering.js', vaert: 'masker', vaerdi: 3, kol: ['kolMasker', 'kolType', 'kolVaerdi', 'kolErstatning', 'kolAntal', 'kolStatus', 'kolOrdbog'], chips: { 6: ['stSikker', 'stOrdbog', 'stSandsynlig', 'stTjek', 'stVersion'] }, ord: { 2: ART } },
  { klasse: 'resttabel', fil: 'ui/assets/maskering.js', vaert: 'masker', vaerdi: 3, kol: ['kolHvad', 'kolType', 'kolTekst', 'kolAntal', 'kolLinje'], chips: { 1: ['rest_original', 'rest_nyt_fund'] }, ord: { 2: ART } },
  { klasse: 'advtabel', fil: 'ui/assets/maskering.js', vaert: 'panel', vaerdi: 2, kol: ['kolHvad', 'kolKode', 'kolAntal', 'kolLinje'], chips: { 1: Object.keys(T.da).filter(k => k.startsWith('adv_')) } },
  { klasse: 'sagtabel', fil: 'ui/assets/sager.js', vaert: 'flade', vaerdi: 1, kol: ['kolNavn', 'kolVaerdier', 'kolOprettet', 'kolSidstBrugt', 'kolUdloeber', 'kolStatus'], chips: { 6: ['stAaben', 'stUdloeberSnart', 'stUdloebet', 'stKanIkke'] } },
  { klasse: 'ordbogtabel', fil: 'ui/assets/ordbog.js', vaert: 'flade', vaerdi: 2, kol: ['kolType', 'kolVaerdiMoenster', 'kolNote'] },
];

for (const tb of TABELLER) {
  const kilde = laes(tb.fil);
  const lister = [...kilde.matchAll(/kolonner: \[([^\]]+)\]/g)].map(m => [...m[1].matchAll(/t: '(\w+)'/g)].map(x => x[1]).join());
  tjek(`${tb.klasse}: kolonnerne i testen er dem i ${path.basename(tb.fil)}, og tabellen får klassen`, lister.includes(tb.kol.join()) && kilde.includes(`classList.add('${tb.klasse}')`));
}

/* V-PUDS.1 N3: står ordet ved ikonet i Altid/Aldrig ved W? (en @media-regel gør det skjulte ord synligt i fundtabellen).
   Knappens bredde læses fra CSS'en: kant fra .mini, polstring og mellemrum fra reglen i @media (ellers 24 px uden ord),
   ikonet fra .mini.ikonknap svg, afstanden mellem knapperne fra .ordbogknapper. */
const ORD_VAELG = '.fundtabel .ordbogknapper .skjult-tekst', KNAP_VAELG = '.fundtabel .ordbogknapper .mini.ikonknap';
const ordVises = W => APP.some(r => r.media && mediaPasser(r.media, W) && r.valg.includes(ORD_VAELG) && r.decl.position === 'static');
const knapRegel = W => APP.filter(r => r.media && mediaPasser(r.media, W) && r.valg.includes(KNAP_VAELG)).pop();
const MINI_KANT = Number((decl(APP, '.mini', 'border') || '').match(/^(\d+)px/)?.[1]);
const IKON = px(decl(APP, '.mini.ikonknap svg', 'width'));
const IKONKNAP = px(decl(APP, '.mini.ikonknap', 'width'));
const KNAP_AFSTAND = px(decl(APP, '.ordbogknapper', 'gap'));
function ordbogBredde(sprog, W) {
  if (!ordVises(W)) return 2 * IKONKNAP + KNAP_AFSTAND;
  const k = knapRegel(W);
  const pol = (k.decl.padding || '').split(/\s+/).map(px);
  const mellem = px(k.decl.gap);
  return ['kAltid', 'kAldrig'].reduce((a, n) => a + 2 * MINI_KANT + 2 * (pol[1] ?? pol[0]) + IKON + mellem + MAALT_KNAPORD[S.TEKST[sprog][n]], 0) + KNAP_AFSTAND;
}
tjek('V-PUDS.1 N3: knappernes mål læst fra CSS\'en (kant 1, ikon 14, ikonknap 24, afstand 4 px)', MINI_KANT === 1 && IKON === 14 && IKONKNAP === 24 && KNAP_AFSTAND === 4, [MINI_KANT, IKON, IKONKNAP, KNAP_AFSTAND].join());
tjek('V-PUDS.1 N3: ordene i Altid/Aldrig er målt i begge sprog', ['da', 'en'].every(sp => ['kAltid', 'kAldrig'].every(n => S.TEKST[sp][n] in MAALT_KNAPORD)));
for (const W of [900, 1099, 1100, 1199]) tjek(`V-PUDS.1 N3: ${W} px: kun ikonet i Altid/Aldrig (under 1200 px)`, !ordVises(W));
for (const W of [1200, 1600, 1719, 1840, 1920]) tjek(`V-PUDS.1 N3: ${W} px: ordet står ved ikonet i Altid/Aldrig`, ordVises(W) && knapRegel(W));
tjek('V-PUDS.1 N3: 1720 px (side om side, smal tabel): kun ikonet', !ordVises(1720) && !ordVises(1839));
// V-PUDS.1 N4: Demaskér-tabellens Antal og Linje har faste bredder i begge sprog ved alle bredder.
for (const sprog of ['da', 'en']) for (const W of [...BREDDER, ...OVERGANGE]) {
  const v = variabler('advtabel', sprog, W);
  if (W === 900 || W === 1920) tjek(`V-PUDS.1 N4: advtabel ${sprog} ${W} px: Antal (${v['--k3']}) og Linje (${v['--k4']}) har faste bredder`, px(v['--k3']) >= 64 && px(v['--k4']) >= 56);
}

const rapport = [];
for (const tb of TABELLER) {
  const n = tb.kol.length;
  for (const sprog of ['da', 'en']) {
    for (const W of [...BREDDER, ...OVERGANGE]) {
      const v = variabler(tb.klasse, sprog, W);
      const celle = px(v['--celle']) ?? px('var(--space-3)');
      const bredde = [...Array(n)].map((_, i) => v['--k' + (i + 1)] || 'auto');
      const auto = bredde.map((b, i) => (b === 'auto' ? i + 1 : 0)).filter(Boolean);
      const min = px(v['--tabel-min']) ?? 0;
      const pxSum = bredde.filter(b => b !== 'auto' && !b.endsWith('%')).reduce((a, b) => a + px(b), 0);
      const har = bredde.some(b => b.endsWith('%'));
      const regn = rb => {
        const plads = vaertBredde(tb.vaert, W, rb);
        const tabel = Math.max(plads, min);
        const kol = bredde.map(b => (b === 'auto' ? null : b.endsWith('%') ? tabel * parseFloat(b) / 100 : px(b)));
        const fast = kol.reduce((a, b) => a + (b || 0), 0);
        kol[tb.vaerdi - 1] = tabel - fast;
        return { plads, tabel, kol, rul: tabel > plads + 0.01 };
      };
      const a = regn(0), b = regn(RULLEBJAELKE);
      const navn = `${tb.klasse} ${sprog} ${W} px`;
      if (BREDDER.includes(W)) rapport.push(`${navn.padEnd(24)} plads ${String(Math.round(a.plads)).padStart(4)}  kolonner [${a.kol.map(Math.round).join(', ')}]  værdi ${Math.round(a.kol[tb.vaerdi - 1])}` + (b.rul ? `  (klassisk rullebjælke: ruller ${Math.round(b.tabel - b.plads)} px)` : ''));
      if (BREDDER.includes(W) && sprog === 'da') tjek(`${tb.klasse}: én kolonne uden fast bredde, og det er værdien (kolonne ${tb.vaerdi})`, auto.join() === String(tb.vaerdi), auto.join());
      if (!har) tjek(`${navn}: --tabel-min (${min}) giver værdien mindst ${VAERDI_MIN} px`, min >= pxSum + VAERDI_MIN, `${pxSum} + ${VAERDI_MIN}`);
      tjek(`${navn}: værdikolonnen er ${Math.round(a.kol[tb.vaerdi - 1])} px (mindst ${VAERDI_MIN})`, a.kol[tb.vaerdi - 1] >= VAERDI_MIN);
      tjek(`${navn}: ingen vandret rulning (plads ${Math.round(a.plads)}, tabel ${Math.round(a.tabel)})`, !a.rul);
      tjek(`${navn}: med en klassisk rullebjælke har værdien stadig mindst ${VAERDI_MIN} px`, b.kol[tb.vaerdi - 1] >= VAERDI_MIN, String(Math.round(b.kol[tb.vaerdi - 1])));
      // Overskrifter, chips og typeord kan være i deres kolonne (bredden minus polstring); første kolonne i Maskér har
      // mindre polstring til højre (space-1).
      const indhold = i => a.kol[i] - celle - (tb.klasse === 'fundtabel' && i === 0 ? px('var(--space-1)') : celle);
      const for_brede = [];
      const mangler = [];
      tb.kol.forEach((k, i) => {
        const tekst = T[sprog][k];
        const dele = thBrydes(tb.klasse, W) ? tekst.split(' ') : [tekst];
        for (const d of dele) { if (!(d in MAALT_TH)) mangler.push(d); else if (MAALT_TH[d] > indhold(i)) for_brede.push(`«${d}» ${MAALT_TH[d]} > ${Math.round(indhold(i))}`); }
      });
      for (const [i, noegler] of Object.entries(tb.chips || {})) for (const k of noegler) {
        const t = T[sprog][k];
        if (!(t in MAALT_CHIP)) mangler.push(t); else if (MAALT_CHIP[t] > indhold(i - 1)) for_brede.push(`chip «${t}» ${MAALT_CHIP[t]} > ${Math.round(indhold(i - 1))}`);
      }
      for (const [i, noegler] of Object.entries(tb.ord || {})) for (const k of noegler) {
        const t = T[sprog][k];
        if (!(t in MAALT_ORD)) mangler.push(t); else if (MAALT_ORD[t] > indhold(i - 1)) for_brede.push(`typen «${t}» ${MAALT_ORD[t]} > ${Math.round(indhold(i - 1))}`);
      }
      tjek(`${navn}: alle tekster er målt (ellers: mål dem i WebKit og skriv dem i MAALT_*)`, mangler.length === 0, [...new Set(mangler)].join(', '));
      if (tb.klasse === 'fundtabel' && W >= ERSTATNING_FRA) {
        // V-LAAS.4 N3: Erstatning (kolonne 4) har plads til 24 tegn; Fundet værdi har mindst 240 px.
        const felt = a.kol[3] - 2 * celle - FELT_EKSTRA;
        tjek(`${navn}: Erstatning viser ${ERSTATNING_TEGN} tegn (${Math.round(felt * 10) / 10} px ≥ ${ERSTATNING_TEGN} × ${TEGN_PX} px)`, felt >= ERSTATNING_TEGN * TEGN_PX, String(felt));
        tjek(`${navn}: Fundet værdi har mindst ${VAERDI_BRED} px (${Math.round(a.kol[2])})`, a.kol[2] >= VAERDI_BRED);
      }
      if (tb.klasse === 'fundtabel') {
        // V-PUDS.1 N3: Altid og Aldrig (med eller uden ord) kan være i Ordbog (kolonne 7).
        const kn = ordbogBredde(sprog, W);
        tjek(`${navn}: Altid og Aldrig${ordVises(W) ? ' med ord' : ''} kan være i Ordbog (${Math.round(kn * 10) / 10} ≤ ${Math.round(indhold(6))} px)`, kn <= indhold(6));
      }
      if (tb.klasse === 'fundtabel' && W === 900) tjek(`${navn}: V-LAAS.4: ingen vandret rulning ved 900 px (Erstatning er først bredere fra 1200 px)`, !a.rul);
      tjek(`${navn}: overskrifter, chips og typer kan være i deres kolonne`, for_brede.length === 0, for_brede.join('; '));
    }
  }
}

console.log('\nKolonnebredder (px, med polstring), regnet ud fra CSS\'en uden rullebjælke:');
for (const l of rapport) console.log('  ' + l);
console.log(`\n${ok + fejl} tjek: ${ok} ok, ${fejl} fejl`);
process.exit(fejl ? 1 : 0);
