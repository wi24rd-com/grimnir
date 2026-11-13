// V-RET.1 R1: regnetest for tabellernes kolonner. jsdom har ingen layout, så bredderne regnes ud fra CSS'en: NavPane'ens
// bredde (kit.css), arbejdsfladens polstring, gitteret i Maskér og hvornår det stables (app.css), panelernes kant og hver
// tabels kolonnevariabler (--k1 … --k7, --celle, --tabel-min, også de engelske og dem i @media). For 1024 (mindste fra
// V-FANER.2; 900, kittets standard og Grimnirs mindste før, regnes stadig), 1200
// (standard), 1600 og 1920 px og overgangene imellem regnes det ud, at værdikolonnen får mindst 140 px, at tabellen ikke ruller
// vandret, og at hver overskrift, chip og typeord kan være i sin kolonne (målt i WebKit, se MAALT_*).
//
// Hvad testen IKKE kan se: den regner, den tegner ikke. Den bygger på, at WebKit giver en tabelcelle præcis sin bredde med
// polstring (målt i V-RET.1 i en WKWebView), og på teksternes bredde målt dér med Inter (pakket med). Windows (WebView2,
// Segoe UI som reserve, klassiske rullebjælker) er ikke målt; en klassisk rullebjælke regnes med 16 px (antaget, ikke
// målt), og dér må tabellen gerne rulle vandret. Højder, rækker, der brydes over flere linjer, og tekst, brugeren selv
// skriver (værdier, sagsnavne, noter), er ikke med; de forkortes med … og står hele i title.
// V-KITBRUG.1 N2: tekststørrelsen i tre trin. Kittets zoom på <html> (lille 0,9, stor 1,125) giver layoutet vinduets
// bredde / zoom (et vindue på 900 px er 800 px ved stor), mens @media-grænserne måler vinduet (begge målt i en
// WKWebView, macOS 26.6). Tekst og kolonner skaleres sammen, så de målte tekstbredder gælder i alle trin; det, der
// ændres, er pladsen og hvilke regler der gælder. app.css har derfor reglerne to gange: :root:not([data-tekst="stor"])
// med grænserne som før, og :root[data-tekst="stor"] med grænserne × 1,125. Ved stor kan tabellen i Maskér først stå uden
// vandret rulning, når layoutet er mindst 900 px (vinduet mindst 1013 px); smallere ruller den vandret og holder værdien
// på mindst 140 px (tabellens --tabel-min). Det regnes og skrives i rapporten.
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
const MAALT_TH = { '✓': 11, 'Type': 32, 'Fundet værdi': 92, 'Fundet': 49, 'værdi': 40, 'Erstatning': 77, 'Antal': 41, 'Status': 47, 'Hvad': 34, 'Tekst': 40, 'Linje': 34, 'Kode': 34, 'Navn': 35, 'Værdier': 55, 'Oprettet': 64, 'Sidst brugt': 81, 'Sidst': 36, 'brugt': 41, 'Udløber': 57, 'Ordbog': 52, 'Værdi eller mønster': 143, 'Værdi': 40, 'eller': 37, 'mønster': 60, 'Note': 34, 'Value found': 86, 'Value': 40, 'found': 43, 'Replacement': 90, 'Count': 44, 'What': 37, 'Text': 32, 'Line': 27, 'Code': 34, 'Name': 36, 'Values': 48, 'Created': 56, 'Last used': 68, 'Last': 32, 'used': 33, 'Expires': 51, 'Dictionary': 76, 'Value or pattern': 118, 'or': 17, 'pattern': 55,
  // V-OPBYG.1 N5: Sagers kolonne hedder Erstatninger (målt i WKWebView; kalibreret: Værdier 54,9 og Values 47,3 som før).
  'Erstatninger': 92, 'Replacements': 97 };
const MAALT_CHIP = { 'Sikker': 69, 'Fra ordbog': 89, 'Sandsynlig': 91, 'Tjek selv': 81, 'Version': 75, 'Original står tilbage': 140, 'Ligner følsom værdi': 142, 'Sat tilbage': 95, 'Ukendt adresse i sagens net': 193, 'Ukendt kode': 102, 'Andre store/små bogstaver': 185, 'Maskine uden domæne': 162, 'Domæne alene': 113, 'Escaped skråstreg': 134, 'URL-kodet': 87, 'Ikke i svaret': 100, 'Ligner en anden sag': 146, 'Pulje løb over: egne net': 162, 'Pulje løb over: offentlige adresser': 221, 'Pulje løb over: MAC-adresser': 196, 'Pulje løb over: IPv6': 137, 'Åben': 64, 'Udløber snart': 106, 'Udløbet': 75, 'Kan ikke åbnes': 117, 'Certain': 76, 'From dictionary': 117, 'Probable': 78, 'Check yourself': 117, 'Original left behind': 136, 'Looks sensitive': 116, 'Put back': 84, 'Unknown address in the case network': 250, 'Unknown code': 116, 'Different upper/lower case': 181, 'Machine without domain': 169, 'Domain alone': 105, 'Escaped backslash': 138, 'URL-encoded': 105, 'Not in the reply': 119, 'Looks like another case': 166, 'Pool ran out: own networks': 184, 'Pool ran out: public addresses': 201, 'Pool ran out: MAC addresses': 194, 'Pool ran out: IPv6': 128, 'Open': 64, 'Expiring soon': 105, 'Expired': 73, 'Cannot be opened': 135,
  // V-OPBYG.1 N2: status er resultatet (målt i WKWebView med kittets chip og de pakkede skrifter, rundet op; kalibreret: Sikker
  // giver 69 som før). Tjek selv har nu advarslens udseende (målt 77,9 og 113,8); de gamle, bredere tal (81, 117) står.
  'Maskeres': 90, 'Bevares': 77, 'Maskeret': 87, 'Bevaret': 75, 'To mask': 82, 'To keep': 76, 'Masked': 79, 'Kept': 57 };
/* V-OPBYG.1 N2: hvor sikkert fundet er, står dæmpet efter typen (.typecelle .sikkerhed, lille skrift); det længste ord, der ikke
   kan brydes, målt i WKWebView og rundet op. */
const MAALT_SIKKER = { 'Sikker': 35, 'Fra ordbog': 41, 'Sandsynlig': 63, 'Tjek selv': 25, 'Version': 43, 'Tilføjet': 39, 'Certain': 42, 'From dictionary': 57, 'Probable': 51, 'Check yourself': 46, 'Added': 38 };
const MAALT_ORD = { 'IPv4, eget net': 34, 'IPv4, offentlig': 55, 'IPv6, eget net': 33, 'IPv6, offentlig': 55, 'MAC-adresse': 53, 'Maskine': 56, 'Domæne': 61, 'NetBIOS-domæne': 63, 'Bruger': 45, 'Person': 47, 'Database': 63, 'Ord': 25, 'Hemmelighed': 92, 'SID': 23, 'GUID': 35, 'Serienummer': 89, 'CPR-nummer': 55, 'Lang tilfældig streng': 54, 'Ligner en kode': 42, 'IPv4, own network': 54, 'IPv4, public': 41, 'IPv6, own network': 54, 'IPv6, public': 41, 'MAC address': 53, 'Machine': 57, 'Domain': 51, 'NetBIOS domain': 56, 'User': 32, 'Word': 36, 'Secret': 43, 'Serial number': 51, 'CPR number': 51, 'Long random string': 51, 'Looks like a code': 40 };
/* V-PUDS.1 N3: ordene i knapperne Altid og Aldrig (12 px, vægt 600, Inter), målt i en WKWebView (macOS 26.6) med
   ui/assets/*.css og de pakkede skrifter og rundet op, som tallene ovenfor (samme måling gav Ordbog 51,5 → 52,
   Antal 40,2 → 41, Erstatning 76,1 → 77). */
const MAALT_KNAPORD = { 'Altid': 27, 'Aldrig': 35, 'Always': 43, 'Never': 35 };

const VAERDI_MIN = 140;
// V-LAAS.4 N3: 1920 er med som bred skærm; overgangene er de brudpunkter, CSS'en har (1100, 1200 og 1720; 1200 står i BREDDER).
// V-FANER.2: 1024 er Grimnirs mindste vindue (app.css og tauri.conf.json); 900 (kittets standard) regnes stadig med.
const BREDDER = [900, 1024, 1200, 1600, 1920];
// V-PUDS.1 N3: 1839/1840, hvor ordet i Altid/Aldrig kommer igen, når fundene står side om side.
// V-PUDS.3 N3: 943/944, hvor cellerne i Maskér får deres almindelige polstring igen, og 1013 (Erstatning: 15 tegn derfra).
const OVERGANGE = [943, 944, 1013, 1099, 1100, 1199, 1719, 1720, 1839, 1840];
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
const TRIN = [{ navn: 'normal', z: 1 }, { navn: 'lille', z: 0.9 }, { navn: 'stor', z: 1.125 }];
/* En selektor er halen (fx ".fundtabel") alene eller med et præfiks for sprog og trin: html[lang="en"], :root:not([data-
   tekst="stor"]) eller :root[data-tekst="stor"], de to sidste evt. med [lang="en"]. Giver præfiksets vægt (klasser og
   attributter tæller 1, html 0,01, som i CSS'ens kaskade) eller null, når reglen ikke gælder for sproget og trinnet. */
function praefiks(v, hale, sprog, trin) {
  if (v === hale) return 0;
  if (!v.endsWith(' ' + hale)) return null;
  const m = v.slice(0, -hale.length - 1).match(/^(html|:root)(?::not\(\[data-tekst="(\w+)"\]\)|\[data-tekst="(\w+)"\])?(\[lang="en"\])?$/);
  if (!m) return null;
  if (m[4] && sprog !== 'en') return null;
  if (m[2] && trin === m[2]) return null;
  if (m[3] && trin !== m[3]) return null;
  return (m[1] === ':root' ? 1 : 0.01) + (m[2] || m[3] ? 1 : 0) + (m[4] ? 1 : 0);
}
const har = (r, hale, sprog, trin) => r.valg.some(v => praefiks(v, hale, sprog, trin) != null);

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
const stakTil = trin => { const r = APP.find(x => x.media && x.media.max && har(x, '.delt:not(.lige)', 'da', trin) && /^minmax\(0, 1fr\)$/.test(x.decl['grid-template-columns'] || '')); return r ? r.media.max : null; };
const STAK_TIL = stakTil('normal');
tjek('fladen: NavPane, polstring, gitter og kant læst fra CSS\'en', NAV === 232 && PAD === 12 && GAP === 12 && KANT === 1 && FR.join() === '2,3', `nav ${NAV}, polstring ${PAD}, gap ${GAP}, kant ${KANT}, fr ${FR}`);
// V-LAAS.4 N3: før 1399; med Erstatning på 24 tegn er der først plads side om side fra 1720 px.
tjek('Maskér: fundene står under teksten op til ' + STAK_TIL + ' px og side om side derover', STAK_TIL === 1719, String(STAK_TIL));
// V-KITBRUG.1 N2: lille som normal; stor fra 1720 × 1,125 = 1935 px vindue.
tjek('V-KITBRUG.1: lille: fundene står under teksten op til 1719 px (som normal)', stakTil('lille') === 1719, String(stakTil('lille')));
tjek('V-KITBRUG.1: stor: fundene står under teksten op til 1934 px (1720 × 1,125)', stakTil('stor') === 1934, String(stakTil('stor')));
const konf = JSON.parse(laes('src-tauri/tauri.conf.json')).app.windows[0];
// V-FANER.2: kit 2.7.0's sidste regel for .vindue er calc(var(--vindue-min-bredde, 900px) / var(--tekst-zoom)): kittets
// standard er stadig 900 px, og Grimnir sætter sit eget mindstemål (--vindue-min-bredde i app.css). Regnet ved normal (zoom 1).
const kitMinRegel = /^calc\(var\(--vindue-min-bredde, (\d+)px\) \/ var\(--tekst-zoom\)\)$/.exec(decl(KIT, '.vindue', 'min-width') || '');
const kitStandard = kitMinRegel ? Number(kitMinRegel[1]) : null;
const appMin = Number((/:root \{ --vindue-min-bredde: (\d+)px; \}/.exec(laes('ui/assets/app.css')) || [])[1]);
const vinduMin = appMin || kitStandard;
tjek('mindste vindue: kittets standard er 900 px, Grimnirs er 1024 px i både app.css (--vindue-min-bredde) og tauri.conf.json (det mindste, der regnes på), standard 1200 px', kitStandard === 900 && vinduMin === 1024 && konf.minWidth === 1024 && konf.width === 1200 && BREDDER.includes(vinduMin), `${kitStandard} / ${appMin} / ${konf.minWidth} / ${konf.width}`);

/* V-LAAS.4 N3: feltet i Erstatning er et <input class="mono"> i en tabelcelle: skriften fra .mono, polstring og kant fra
   .tabel td input. */
const MONO_PX = px(decl(KIT, '.mono', 'font-size'));
const MONO_FAMILIE = decl(KIT, '.mono', 'font-family');
const FELT_POLSTRING = (decl(KIT, '.tabel td input', 'padding') || '').split(/\s+/).map(px);
const FELT_KANT = Number((decl(KIT, '.tabel td input', 'border') || '').match(/^(\d+)px/)?.[1]);
const FELT_EKSTRA = 2 * (FELT_POLSTRING[1] ?? FELT_POLSTRING[0]) + 2 * FELT_KANT;
const TEGN_PX = MONO_EM * MONO_PX;
tjek('V-LAAS.4: feltet i Erstatning er <input class="mono"> med JetBrains Mono 13 px, polstring 8 px og kant 1 px', /inp\.className = 'mono';/.test(laes('ui/assets/maskering.js')) && MONO_FAMILIE === 'var(--mono-family)' && /^"JetBrains Mono"/.test(tokens['--font-mono']) && MONO_PX === 13 && FELT_EKSTRA === 18, `${MONO_FAMILIE} ${tokens['--font-mono']} ${MONO_PX} ${FELT_EKSTRA}`);

/* Pladsen til tabellen ved vinduesbredden W i trinnet (minus en eventuel rullebjælke). Layoutet er W / zoom; om fundene står
   under teksten, afgør @media ud fra W. */
function vaertBredde(vaert, W, rb, trin = TRIN[0]) {
  const inde = W / trin.z - NAV - 2 * PAD;
  if (vaert === 'masker') return (W > stakTil(trin.navn) ? (inde - GAP) * FR[1] / (FR[0] + FR[1]) : inde) - 2 * KANT - rb;
  if (vaert === 'panel') return inde - 2 * KANT - rb;
  return inde - rb;
}

/* Tabellens variabler ved W og sprog: reglerne for .klasse og html[lang="en"] .klasse, i CSS'ens kaskade (en engelsk
   regel vinder over en almindelig; ellers vinder den sidste). */
function variabler(klasse, sprog, W, trin = 'normal') {
  const passer = APP.filter(r => mediaPasser(r.media, W)).flatMap(r => r.valg.map(v => ({ v, r })))
    .map(({ v, r }) => ({ spec: praefiks(v, '.' + klasse, sprog, trin), nr: r.nr, decl: r.decl }))
    .filter(x => x.spec != null)
    .sort((a, b) => a.spec - b.spec || a.nr - b.nr);
  const v = {};
  for (const p of passer) for (const [k, x] of Object.entries(p.decl)) if (k.startsWith('--')) v[k] = x;
  return v;
}
/* Bryder overskrifterne i tabellen ved W (white-space: normal i en @media)? */
const thBrydes = (klasse, W, trin = 'normal') => APP.some(r => mediaPasser(r.media, W) && r.media && har(r, `.${klasse} th`, 'da', trin) && r.decl['white-space'] === 'normal');

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
  { klasse: 'fundtabel', fil: 'ui/assets/maskering.js', vaert: 'masker', vaerdi: 3, kol: ['kolMasker', 'kolType', 'kolVaerdi', 'kolErstatning', 'kolAntal', 'kolStatus', 'kolOrdbog'], chips: { 6: ['stMaskeres', 'stBevares', 'stTjek', 'stMaskeret', 'stBevaret'] }, ord: { 2: ART }, sikker: { 2: ['stSikker', 'stOrdbog', 'stSandsynlig', 'stTjek', 'stVersion', 'stTilfoejet'] } },
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
const ordVises = (W, trin = 'normal') => APP.some(r => r.media && mediaPasser(r.media, W) && har(r, ORD_VAELG, 'da', trin) && r.decl.position === 'static');
const knapRegel = (W, trin = 'normal') => APP.filter(r => r.media && mediaPasser(r.media, W) && har(r, KNAP_VAELG, 'da', trin)).pop();
const MINI_KANT = Number((decl(APP, '.mini', 'border') || '').match(/^(\d+)px/)?.[1]);
const IKON = px(decl(APP, '.mini.ikonknap svg', 'width'));
const IKONKNAP = px(decl(APP, '.mini.ikonknap', 'width'));
const KNAP_AFSTAND = px(decl(APP, '.ordbogknapper', 'gap'));
function ordbogBredde(sprog, W, trin = 'normal') {
  if (!ordVises(W, trin)) return 2 * IKONKNAP + KNAP_AFSTAND;
  const k = knapRegel(W, trin);
  const pol = (k.decl.padding || '').split(/\s+/).map(px);
  const mellem = px(k.decl.gap);
  return ['kAltid', 'kAldrig'].reduce((a, n) => a + 2 * MINI_KANT + 2 * (pol[1] ?? pol[0]) + IKON + mellem + MAALT_KNAPORD[S.TEKST[sprog][n]], 0) + KNAP_AFSTAND;
}
tjek('V-PUDS.1 N3: knappernes mål læst fra CSS\'en (kant 1, ikon 14, ikonknap 24, afstand 4 px)', MINI_KANT === 1 && IKON === 14 && IKONKNAP === 24 && KNAP_AFSTAND === 4, [MINI_KANT, IKON, IKONKNAP, KNAP_AFSTAND].join());
tjek('V-PUDS.1 N3: ordene i Altid/Aldrig er målt i begge sprog', ['da', 'en'].every(sp => ['kAltid', 'kAldrig'].every(n => S.TEKST[sp][n] in MAALT_KNAPORD)));
for (const W of [900, 1099, 1100, 1199]) tjek(`V-PUDS.1 N3: ${W} px: kun ikonet i Altid/Aldrig (under 1200 px)`, !ordVises(W));
for (const W of [1200, 1600, 1719, 1840, 1920]) tjek(`V-PUDS.1 N3: ${W} px: ordet står ved ikonet i Altid/Aldrig`, ordVises(W) && knapRegel(W));
tjek('V-PUDS.1 N3: 1720 px (side om side, smal tabel): kun ikonet', !ordVises(1720) && !ordVises(1839));
// V-KITBRUG.1 N2: lille har grænserne som normal; stor har dem × 1,125 (1200 → 1350, 1720 → 1935, 1840 → 2070).
for (const W of [900, 1199, 1720, 1839]) tjek(`V-KITBRUG.1: lille ${W} px: kun ikonet i Altid/Aldrig (som normal)`, !ordVises(W, 'lille'));
for (const W of [1200, 1719, 1840]) tjek(`V-KITBRUG.1: lille ${W} px: ordet står ved ikonet (som normal)`, ordVises(W, 'lille') && knapRegel(W, 'lille'));
for (const W of [900, 1200, 1349, 1935, 2069]) tjek(`V-KITBRUG.1: stor ${W} px: kun ikonet i Altid/Aldrig`, !ordVises(W, 'stor'));
for (const W of [1350, 1600, 1934, 2070]) tjek(`V-KITBRUG.1: stor ${W} px: ordet står ved ikonet`, ordVises(W, 'stor') && knapRegel(W, 'stor'));
// V-PUDS.1 N4: Demaskér-tabellens Antal og Linje har faste bredder i begge sprog ved alle bredder.
for (const sprog of ['da', 'en']) for (const W of [...BREDDER, ...OVERGANGE]) {
  const v = variabler('advtabel', sprog, W);
  if (W === 900 || W === 1920) tjek(`V-PUDS.1 N4: advtabel ${sprog} ${W} px: Antal (${v['--k3']}) og Linje (${v['--k4']}) har faste bredder`, px(v['--k3']) >= 64 && px(v['--k4']) >= 56);
}

const rapport = [];
// V-KITBRUG.1 N2: overgangene ved stor (grænserne × 1,125) og hvor layoutet når 900 px (1012/1013 px vindue).
// V-PUDS.3 N3: 1061/1062 (943/944 × 1,125).
const OVERGANGE_STOR = [1012, 1013, 1061, 1062, 1237, 1238, 1349, 1350, 1934, 1935, 2069, 2070];
for (const trin of TRIN) for (const tb of TABELLER) {
  const n = tb.kol.length;
  const tn = trin.navn === 'normal' ? '' : ' ' + trin.navn;
  for (const sprog of ['da', 'en']) {
    for (const W of [...BREDDER, ...OVERGANGE, ...(trin.navn === 'stor' ? OVERGANGE_STOR : [])]) {
      const v = variabler(tb.klasse, sprog, W, trin.navn);
      // V-KITBRUG.1 N2: ved stor er reglerne ved vinduet W de samme som ved normal i et vindue på W / 1,125 (layoutets bredde).
      if (trin.navn === 'stor') {
        const L = Math.floor(W / trin.z), vn = variabler(tb.klasse, sprog, L, 'normal');
        tjek(`${tb.klasse} ${sprog} stor ${W} px: samme regler som normal ved ${L} px (kolonner, overskrifter, ord i Altid/Aldrig, stak)`, JSON.stringify(v) === JSON.stringify(vn) && thBrydes(tb.klasse, W, 'stor') === thBrydes(tb.klasse, L) && ordVises(W, 'stor') === ordVises(L) && (W > stakTil('stor')) === (L > STAK_TIL), JSON.stringify(v) + ' ≠ ' + JSON.stringify(vn));
      }
      const celle = px(v['--celle']) ?? px('var(--space-3)');
      const bredde = [...Array(n)].map((_, i) => v['--k' + (i + 1)] || 'auto');
      const auto = bredde.map((b, i) => (b === 'auto' ? i + 1 : 0)).filter(Boolean);
      const min = px(v['--tabel-min']) ?? 0;
      const pxSum = bredde.filter(b => b !== 'auto' && !b.endsWith('%')).reduce((a, b) => a + px(b), 0);
      const harPct = bredde.some(b => b.endsWith('%'));
      const regn = rb => {
        const plads = vaertBredde(tb.vaert, W, rb, trin);
        const tabel = Math.max(plads, min);
        const kol = bredde.map(b => (b === 'auto' ? null : b.endsWith('%') ? tabel * parseFloat(b) / 100 : px(b)));
        const fast = kol.reduce((a, b) => a + (b || 0), 0);
        kol[tb.vaerdi - 1] = tabel - fast;
        return { plads, tabel, kol, rul: tabel > plads + 0.01 };
      };
      const a = regn(0), b = regn(RULLEBJAELKE);
      const navn = `${tb.klasse} ${sprog}${tn} ${W} px`;
      // Ved stor er layoutet W / 1,125; under 900 px layout (vinduet under 1013 px) må tabellen rulle vandret.
      const layout = W / trin.z, rulMaa = layout < 900;
      if (BREDDER.includes(W) || (rulMaa && a.rul && sprog === 'da')) rapport.push(`${navn.padEnd(30)} plads ${String(Math.round(a.plads)).padStart(4)}  kolonner [${a.kol.map(Math.round).join(', ')}]  værdi ${Math.round(a.kol[tb.vaerdi - 1])}` + (b.rul ? `  (klassisk rullebjælke: ruller ${Math.round(b.tabel - b.plads)} px)` : ''));
      if (BREDDER.includes(W) && sprog === 'da' && !tn) tjek(`${tb.klasse}: én kolonne uden fast bredde, og det er værdien (kolonne ${tb.vaerdi})`, auto.join() === String(tb.vaerdi), auto.join());
      if (!harPct) tjek(`${navn}: --tabel-min (${min}) giver værdien mindst ${VAERDI_MIN} px`, min >= pxSum + VAERDI_MIN, `${pxSum} + ${VAERDI_MIN}`);
      tjek(`${navn}: værdikolonnen er ${Math.round(a.kol[tb.vaerdi - 1])} px (mindst ${VAERDI_MIN})`, a.kol[tb.vaerdi - 1] >= VAERDI_MIN);
      if (!rulMaa) tjek(`${navn}: ingen vandret rulning (plads ${Math.round(a.plads)}, tabel ${Math.round(a.tabel)})`, !a.rul);
      else tjek(`${navn}: layoutet er ${Math.round(layout)} px (under 900): vandret rulning tilladt, værdien holdes af --tabel-min`, trin.navn === 'stor' && a.kol[tb.vaerdi - 1] >= VAERDI_MIN);
      tjek(`${navn}: med en klassisk rullebjælke har værdien stadig mindst ${VAERDI_MIN} px`, b.kol[tb.vaerdi - 1] >= VAERDI_MIN, String(Math.round(b.kol[tb.vaerdi - 1])));
      // Overskrifter, chips og typeord kan være i deres kolonne (bredden minus polstring); første kolonne i Maskér har
      // mindre polstring til højre (space-1).
      const indhold = i => a.kol[i] - celle - (tb.klasse === 'fundtabel' && i === 0 ? px('var(--space-1)') : celle);
      const for_brede = [];
      const mangler = [];
      tb.kol.forEach((k, i) => {
        const tekst = T[sprog][k];
        const dele = thBrydes(tb.klasse, W, trin.navn) ? tekst.split(' ') : [tekst];
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
      for (const [i, noegler] of Object.entries(tb.sikker || {})) for (const k of noegler) {
        const t = T[sprog][k];
        if (!(t in MAALT_SIKKER)) mangler.push(t); else if (MAALT_SIKKER[t] > indhold(i - 1)) for_brede.push(`sikkerheden «${t}» ${MAALT_SIKKER[t]} > ${Math.round(indhold(i - 1))}`);
      }
      tjek(`${navn}: alle tekster er målt (ellers: mål dem i WebKit og skriv dem i MAALT_*)`, mangler.length === 0, [...new Set(mangler)].join(', '));
      if (tb.klasse === 'fundtabel' && W >= ERSTATNING_FRA * (trin.navn === 'stor' ? trin.z : 1)) {
        // V-LAAS.4 N3: Erstatning (kolonne 4) har plads til 24 tegn; Fundet værdi har mindst 240 px.
        const felt = a.kol[3] - 2 * celle - FELT_EKSTRA;
        tjek(`${navn}: Erstatning viser ${ERSTATNING_TEGN} tegn (${Math.round(felt * 10) / 10} px ≥ ${ERSTATNING_TEGN} × ${TEGN_PX} px)`, felt >= ERSTATNING_TEGN * TEGN_PX, String(felt));
        tjek(`${navn}: Fundet værdi har mindst ${VAERDI_BRED} px (${Math.round(a.kol[2])})`, a.kol[2] >= VAERDI_BRED);
      }
      if (tb.klasse === 'fundtabel') {
        // V-PUDS.1 N3: Altid og Aldrig (med eller uden ord) kan være i Ordbog (kolonne 7).
        const kn = ordbogBredde(sprog, W, trin.navn);
        tjek(`${navn}: Altid og Aldrig${ordVises(W, trin.navn) ? ' med ord' : ''} kan være i Ordbog (${Math.round(kn * 10) / 10} ≤ ${Math.round(indhold(6))} px)`, kn <= indhold(6));
      }
      if (tb.klasse === 'fundtabel' && W === 900 && !rulMaa) tjek(`${navn}: V-LAAS.4: ingen vandret rulning ved 900 px (Erstatning er først bredere fra 1200 px)`, !a.rul);
      tjek(`${navn}: overskrifter, chips og typer kan være i deres kolonne`, for_brede.length === 0, for_brede.join('; '));
    }
  }
}

/* V-PUDS.3 N3: Erstatning viser mindst 15 tegn i feltets skrift i alle tre trin ved hver vinduesbredde fra 1013 px (under
   1013 px ved stor ruller tabellen vandret; det er godkendt). Regnet for hver hele px fra 1013 til 2600 i begge sprog, med
   de øvrige krav ved samme bredde: værdien har mindst 140 px, tabellen ruller ikke vandret, når layoutet er mindst 900 px,
   og hver overskrift, chip og type kan være i sin kolonne. */
const ERSTATNING_MIN_TEGN = 15, ERSTATNING_MIN_FRA = 1013;
function fundRegn(sprog, W, trin) {
  const tb = TABELLER[0];
  const v = variabler(tb.klasse, sprog, W, trin.navn);
  const celle = px(v['--celle']) ?? px('var(--space-3)');
  const kol = [...Array(7)].map((_, i) => (v['--k' + (i + 1)] ? px(v['--k' + (i + 1)]) : null));
  const plads = vaertBredde(tb.vaert, W, 0, trin);
  const tabel = Math.max(plads, px(v['--tabel-min']) ?? 0);
  kol[2] = tabel - kol.reduce((a, b) => a + (b || 0), 0);
  const indhold = i => kol[i] - celle - (i === 0 ? px('var(--space-1)') : celle);
  const for_brede = [];
  tb.kol.forEach((k, i) => { for (const d of [T[sprog][k]]) if (MAALT_TH[d] > indhold(i)) for_brede.push(`«${d}»`); });
  for (const [i, nl] of Object.entries(tb.chips)) for (const k of nl) if (MAALT_CHIP[T[sprog][k]] > indhold(i - 1)) for_brede.push(`chip «${T[sprog][k]}»`);
  for (const [i, nl] of Object.entries(tb.ord)) for (const k of nl) if (MAALT_ORD[T[sprog][k]] > indhold(i - 1)) for_brede.push(`typen «${T[sprog][k]}»`);
  for (const [i, nl] of Object.entries(tb.sikker || {})) for (const k of nl) if (MAALT_SIKKER[T[sprog][k]] > indhold(i - 1)) for_brede.push(`sikkerheden «${T[sprog][k]}»`);
  if (ordbogBredde(sprog, W, trin.navn) > indhold(6)) for_brede.push('Altid/Aldrig');
  return { felt: kol[3] - 2 * celle - FELT_EKSTRA, vaerdi: kol[2], rul: tabel > plads + 0.01, layout: W / trin.z, for_brede };
}
tjek(`V-PUDS.3 N3: ${ERSTATNING_MIN_TEGN} tegn i feltets skrift er ${Math.round(ERSTATNING_MIN_TEGN * TEGN_PX * 10) / 10} px (JetBrains Mono 13 px, 0,6 em pr. tegn)`, Math.abs(ERSTATNING_MIN_TEGN * TEGN_PX - 117) < 1e-9);
for (const trin of TRIN) for (const sprog of ['da', 'en']) {
  const brud = { felt: [], vaerdi: [], rul: [], plads: [] };
  let mindst = Infinity, n = 0;
  for (let W = ERSTATNING_MIN_FRA; W <= 2600; W++) {
    const r = fundRegn(sprog, W, trin);
    n++;
    mindst = Math.min(mindst, r.felt);
    if (r.felt < ERSTATNING_MIN_TEGN * TEGN_PX - 1e-9) brud.felt.push(W);
    if (r.vaerdi < VAERDI_MIN) brud.vaerdi.push(W);
    if (r.layout >= 900 && r.rul) brud.rul.push(W);
    if (r.for_brede.length) brud.plads.push(W + ' ' + r.for_brede.join(' '));
  }
  const vis = l => l.length ? `${l.length} bredder, fx ${l.slice(0, 4).join(', ')}` : '';
  tjek(`V-PUDS.3 N3: ${trin.navn} ${sprog}: Erstatning viser mindst ${ERSTATNING_MIN_TEGN} tegn ved hver bredde fra ${ERSTATNING_MIN_FRA} til 2600 px (${n} bredder; mindst ${Math.round(mindst * 10) / 10} px)`, brud.felt.length === 0, vis(brud.felt));
  tjek(`V-PUDS.3 N3: ${trin.navn} ${sprog}: … og Fundet værdi har stadig mindst ${VAERDI_MIN} px ved hver af dem`, brud.vaerdi.length === 0, vis(brud.vaerdi));
  tjek(`V-PUDS.3 N3: ${trin.navn} ${sprog}: … og tabellen ruller ikke vandret ved nogen af dem`, brud.rul.length === 0, vis(brud.rul));
  tjek(`V-PUDS.3 N3: ${trin.navn} ${sprog}: … og overskrifter, chips, typer og Altid/Aldrig kan være i deres kolonne ved hver af dem`, brud.plads.length === 0, vis(brud.plads));
}
// Ved de opdigtede koder fra vinduesprøven (198.18.0.41 og d01.example, 11 tegn) ved stor i 1200 px: før 9 tegn.
for (const sprog of ['da', 'en']) {
  const r = fundRegn(sprog, 1200, TRIN[2]);
  tjek(`V-PUDS.3 N3: stor ${sprog} 1200 px (vinduesprøven): Erstatning har plads til ${Math.floor(r.felt / TEGN_PX + 1e-9)} tegn, så "198.18.0.41" og "d01.example" står hele`, r.felt >= 11 * TEGN_PX);
}
// Reglen for smalle vinduer findes for begge trin-grupper, ved grænser, der passer sammen (stor = (943 + 1) × 1,125 − 1).
tjek('V-PUDS.3 N3: den smalle regel for fundtabellen står ved max-width 943 px (normal og lille) og 1061 px (stor)', APP.some(r => r.media && r.media.max === 943 && har(r, '.fundtabel', 'da', 'normal') && r.decl['--k4']) && APP.some(r => r.media && r.media.max === 1061 && har(r, '.fundtabel', 'da', 'stor') && r.decl['--k4']) && (943 + 1) * 1.125 - 1 === 1061);

/* V-MANUEL.1: en tilføjet række i fundtabellen. Chippen "Tilføjet", typens valgliste og Altid + Fjern skal kunne være i
   deres kolonne ved hver vinduesbredde fra 900 px (ved stor fra 1013 px, hvor tabellen holder op med at rulle vandret), i alle
   tre trin og begge sprog. Målt i V-MANUEL.1 i en WKWebView (macOS, WebKit som i Tauri; engangsværktøj i scratchpad, ikke i
   repoet) med ui/assets/*.css og de pakkede skrifter og rundet op som de andre tal; kontroller målt samme sted gav de gamle
   tal (Fra ordbog 88,1 → 89, From dictionary 116,1 → 117, Altid 26,9 → 27, Aldrig 34,9 → 35, Always 42,3 → 43, Never 34,7 → 35,
   Maskine 55,4 → 56, Domæne 60,0 → 61, Machine 56,6 → 57). Valglisten er målt med sin naturlige bredde (width: auto) for de
   bredeste typeord: ordet, polstringen fra app.css, kanten og WebKits egen 1 px. */
const MAALT_CHIP_MANUEL = { 'Tilføjet': 66, 'Added': 64 };
/* Ordet i Fjern er målt (Fjern 29,5 → 30, Remove 46,6 → 47), men vises aldrig: med ord ville Always + Remove være 158 px i
   Ordbog-kolonnens 148 px på engelsk. Fjern er derfor altid kun krydset (24 px; reglen i app.css prøves nedenfor). */
const MAALT_KNAPORD_MANUEL = { 'Fjern': 30, 'Remove': 47 };
const MAALT_VALG = { da: { 'Domæne': 87, 'Maskine': 82, 'Ord': 51 }, en: { 'Machine': 63, 'Domain': 57, 'Word': 42 } };
const TYPER_UI = ((laes('ui/assets/maskering.js').match(/const TYPER = \[([^\]]+)\]/) || [])[1] || '').split(',').map(x => x.trim().replace(/'/g, ''));
tjek('V-OPBYG.1 N2: statusordene (Maskeres, Bevares, Tjek selv, Maskeret, Bevaret) og sikkerheden ved typen er målt i begge sprog, og Status bruger ikke længere sikkerheden som chip', ['da', 'en'].every(sp => ['stMaskeres', 'stBevares', 'stTjek', 'stMaskeret', 'stBevaret'].every(k => T[sp][k] in MAALT_CHIP) && ['stSikker', 'stOrdbog', 'stSandsynlig', 'stTjek', 'stVersion', 'stTilfoejet'].every(k => T[sp][k] in MAALT_SIKKER)) && !TABELLER.find(t => t.klasse === 'fundtabel').chips[6].includes('stSikker'));
tjek('V-MANUEL.1: chippen Tilføjet og ordet i Fjern er målt i begge sprog', ['da', 'en'].every(sp => T[sp].stTilfoejet in MAALT_CHIP_MANUEL && T[sp].kFjern in MAALT_KNAPORD_MANUEL));
tjek(`V-MANUEL.1: valglistens typer (${TYPER_UI.join(', ')}) er alle målt, og den bredeste valgliste er målt i hvert sprog`, TYPER_UI.length === 5 && ['da', 'en'].every(sp => {
  const ord = TYPER_UI.map(t => T[sp]['art_' + t]);
  const bredest = Math.max(...ord.map(o => MAALT_ORD[o]));
  return ord.every(o => o in MAALT_ORD) && Object.keys(MAALT_VALG[sp]).some(o => MAALT_ORD[o] === bredest);
}));
const VALG_SEL = '.fundtabel .typevalg .vliste select';
tjek('V-MANUEL.1: valglistens polstring er den, der blev målt (dansk 0 20px 0 4px med pil, engelsk 0 2px uden pil); ellers mål igen',
  APP.some(r => !r.media && r.valg.includes(VALG_SEL) && r.decl.padding === '0 20px 0 4px') && APP.some(r => !r.media && r.valg.includes('html[lang="en"] ' + VALG_SEL) && r.decl.padding === '0 2px') && APP.some(r => !r.media && r.valg.includes('html[lang="en"] .fundtabel .typevalg .vliste svg') && r.decl.display === 'none'));
function ordbogBreddeTilfoejet(sprog, W, trin = 'normal') {
  if (!ordVises(W, trin)) return 2 * IKONKNAP + KNAP_AFSTAND;
  const k = knapRegel(W, trin);
  const pol = (k.decl.padding || '').split(/\s+/).map(px);
  const mellem = px(k.decl.gap);
  return 2 * MINI_KANT + 2 * (pol[1] ?? pol[0]) + IKON + mellem + MAALT_KNAPORD[T[sprog].kAltid] + KNAP_AFSTAND + IKONKNAP;
}
// Hvis Fjern viste ordet som Altid og Aldrig: for bredt på engelsk (derfor reglen).
function ordbogBreddeMedOrd(sprog, W, trin) {
  const k = knapRegel(W, trin), pol = (k.decl.padding || '').split(/\s+/).map(px), mellem = px(k.decl.gap);
  return [MAALT_KNAPORD[T[sprog].kAltid], MAALT_KNAPORD_MANUEL[T[sprog].kFjern]].reduce((a, w) => a + 2 * MINI_KANT + 2 * (pol[1] ?? pol[0]) + IKON + mellem + w, 0) + KNAP_AFSTAND;
}
{
  const v = variabler('fundtabel', 'en', 1600, 'normal'), celle = px(v['--celle']) ?? px('var(--space-3)');
  tjek(`V-MANUEL.1: Fjern med ord ville ikke kunne være i Ordbog på engelsk ved 1600 px (${ordbogBreddeMedOrd('en', 1600, 'normal')} > ${px(v['--k7']) - 2 * celle} px); derfor kun krydset`, ordbogBreddeMedOrd('en', 1600, 'normal') > px(v['--k7']) - 2 * celle);
  const FJ = ':root .fundtabel .ordbogknapper .mini.ikonknap.fjern';
  tjek('V-MANUEL.1: app.css holder Fjern som et kryds på 24 px uden synligt ord, efter de brede regler (der viser ordet)', (() => {
    const i = APP.findIndex(r => !r.media && r.valg.includes(FJ) && r.decl.width === '24px' && r.decl.padding === '0');
    const j = APP.findIndex(r => !r.media && r.valg.includes(FJ + ' .skjult-tekst') && r.decl.position === 'absolute' && r.decl.width === '1px');
    const sidsteBred = Math.max(...APP.map((r, n) => (r.media && r.valg.some(x => x.includes('.ordbogknapper .skjult-tekst')) ? n : -1)));
    return i > sidsteBred && j > sidsteBred && sidsteBred > 0;
  })());
}
for (const trin of TRIN) for (const sprog of ['da', 'en']) {
  const brud = [];
  let n = 0, mindstType = Infinity;
  for (let W = trin.navn === 'stor' ? 1013 : 900; W <= 2600; W++) {
    const v = variabler('fundtabel', sprog, W, trin.navn);
    const celle = px(v['--celle']) ?? px('var(--space-3)');
    const kol = [...Array(7)].map((_, i) => (v['--k' + (i + 1)] ? px(v['--k' + (i + 1)]) : null));
    const plads = vaertBredde('masker', W, 0, trin);
    kol[2] = Math.max(plads, px(v['--tabel-min']) ?? 0) - kol.reduce((a, b) => a + (b || 0), 0);
    const indhold = i => kol[i] - 2 * celle;
    n++;
    mindstType = Math.min(mindstType, indhold(1));
    const valg = Math.max(...Object.values(MAALT_VALG[sprog]));
    if (valg > indhold(1)) brud.push(`${W}: valglisten ${valg} > ${indhold(1)}`);
    if (MAALT_CHIP_MANUEL[T[sprog].stTilfoejet] > indhold(5)) brud.push(`${W}: chippen`);
    if (ordbogBreddeTilfoejet(sprog, W, trin.navn) > indhold(6)) brud.push(`${W}: Altid og Fjern`);
  }
  tjek(`V-MANUEL.1: ${trin.navn} ${sprog}: en tilføjet række: valglisten (${Math.max(...Object.values(MAALT_VALG[sprog]))} px; Type har mindst ${mindstType} px), chippen Tilføjet og Altid + Fjern kan være i deres kolonne ved hver bredde (${n} bredder)`, brud.length === 0, brud.slice(0, 4).join('; '));
}

console.log('\nKolonnebredder (px i layoutet, med polstring), regnet ud fra CSS\'en uden rullebjælke (lille og stor: V-KITBRUG.1):');
for (const l of rapport) console.log('  ' + l);
console.log(`\n${ok + fejl} tjek: ${ok} ok, ${fejl} fejl`);
process.exit(fejl ? 1 : 0);
