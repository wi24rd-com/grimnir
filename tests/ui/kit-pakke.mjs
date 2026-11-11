// V-KIT.1: Wi24rd UI Kit 2 som pakke (design/ui-kit-2/pakke/). Uden at starte programmet og uden netværk.
// Kontrollerer: at pakken er den ene kilde (kopierne i ui/assets/ er byte for byte ens, tokens.css og Tokens.xaml svarer
// til tokens.json), at kittets web-filer ikke kender programmet, de blev udskilt fra, at demosiden ikke henter noget
// udefra og faktisk kører med pakkens filer i begge temaer og sprog, at Tokens.xaml er velformet og har hver token i
// begge ordbøger med samme farver som CSS, og at KOMPONENTER.md og koden nævner de samme klasser og funktioner.
// Brug: node tests/ui/kit-pakke.mjs (npm run test:kit). Exit 1 ved fejl. Kun opdigtede data.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { JSDOM, VirtualConsole } from 'jsdom';
import { laesTokens, bygCss, bygXaml, temaVaerdier, pascal, argb, KILDE, MAAL, MAAL_XAML, PAKKE, XAML_TEMA, pakkeVersion } from '../../design/build-tokens.mjs';
import { afvigelser, par } from '../../design/build-kit.mjs';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const pk = p => fs.readFileSync(path.join(PAKKE, p), 'utf8');
let ok = 0, fejl = 0;
const tjek = (navn, betingelse, detalje = '') => {
  if (betingelse) { ok++; console.log('ok   ' + navn); } else { fejl++; console.log('FEJL ' + navn + (detalje ? ' — ' + detalje : '')); }
};
const vent = (ms = 0) => new Promise(r => setTimeout(r, ms));
const tokens = laesTokens();
const VERSION = pakkeVersion();

// ── N1: én kilde ──
{
  tjek('pakken ligger i design/ui-kit-2/pakke', path.relative(repo, PAKKE) === path.join('design', 'ui-kit-2', 'pakke'));
  tjek('tokens.json læses fra pakken (samme sti, som kontrasttesten får fra build-tokens.mjs)', path.relative(PAKKE, KILDE) === path.join('tokens', 'wi24rd-ui-kit-2.tokens.json') && fs.existsSync(KILDE));
  tjek('den gamle kopi design/wi24rd-ui-kit-2.tokens.json findes ikke længere (én kilde)', !fs.existsSync(path.join(repo, 'design', 'wi24rd-ui-kit-2.tokens.json')));
  const kontrast = fs.readFileSync(path.join(repo, 'tests', 'ui', 'kontrast.mjs'), 'utf8');
  tjek('kontrasttesten bruger pakkens tokens (laesTokens() uden egen sti)', /import \{[^}]*laesTokens[^}]*\} from '\.\.\/\.\.\/design\/build-tokens\.mjs'/.test(kontrast) && /const tokens = laesTokens\(\);/.test(kontrast) && !/tokens\.json'\)/.test(kontrast));
  tjek('tokens --check: tokens.css svarer til tokens.json', fs.readFileSync(MAAL, 'utf8') === bygCss(tokens));
  tjek('tokens --check: Tokens.xaml svarer til tokens.json', fs.readFileSync(MAAL_XAML, 'utf8') === bygXaml(tokens));
  const a = afvigelser();
  tjek('kit --check: kopierne i ui/assets er byte for byte som pakken', a.length === 0, a.join('; '));
  const kopier = par().map(([, k]) => path.relative(path.join(repo, 'ui', 'assets'), k)).sort();
  tjek('kit: de kopierede filer er tokens.css, de fire web-filer og seks filer i fonts/', JSON.stringify(kopier) === JSON.stringify(['fonts/OFL-Inter.txt', 'fonts/OFL-JetBrainsMono.txt', 'fonts/inter-latin-ext-wght-normal.woff2', 'fonts/inter-latin-wght-normal.woff2', 'fonts/jetbrains-mono-latin-ext-wght-normal.woff2', 'fonts/jetbrains-mono-latin-wght-normal.woff2', 'kit.css', 'kit.js', 'sprogmotor.js', 'tema.js', 'tokens.css']), kopier.join(', '));
  const pkg = JSON.parse(fs.readFileSync(path.join(repo, 'package.json'), 'utf8'));
  tjek('package.json: npm run kit og npm run tokens findes', pkg.scripts.kit === 'node design/build-kit.mjs' && pkg.scripts.tokens === 'node design/build-tokens.mjs');
  tjek('package.json: npm run tjek kører tokens --check og kit --check i samme kørsel', /build-tokens\.mjs --check && node design\/build-kit\.mjs --check/.test(pkg.scripts.tjek || ''), pkg.scripts.tjek);
  tjek('package.json: ingen nye afhængigheder', JSON.stringify(Object.keys(pkg.devDependencies).sort()) === JSON.stringify(['@tauri-apps/cli', 'jsdom']) && !pkg.dependencies);
}

// ── N3: pakkens indhold ──
{
  const skal = ['VERSION', 'CHANGELOG.md', 'README.md', 'KOMPONENTER.md', 'LICENSE.md', 'tokens/wi24rd-ui-kit-2.tokens.json', 'tokens/tokens.css', 'tokens/Tokens.xaml',
    'web/kit.css', 'web/kit.js', 'web/tema.js', 'web/sprogmotor.js', 'web/fonts/OFL-Inter.txt', 'web/fonts/OFL-JetBrainsMono.txt', 'demo/index.html', 'demo/demo.js',
    'flytning/HUGINN-MUNINN.md', 'flytning/WI24RD-FTP.md', 'LICENSE', 'flytning/WI24RD-SANDBOX.md'];
  const mangler = skal.filter(f => !fs.existsSync(path.join(PAKKE, f)));
  tjek('pakken har alle sine filer', mangler.length === 0, mangler.join(', '));
  // V-KVIT.1 N4: pakken er 2.0.1 (kun dokumenter: licensteksten, beslutningen om Huginn and Muninn, noten om Sandbox).
  tjek('VERSION er 2.1.0', VERSION === '2.1.0' && pk('VERSION') === '2.1.0\n', JSON.stringify(pk('VERSION')));
  const log = pk('CHANGELOG.md');
  const foerste = /^## (\d+\.\d+\.\d+) — (\d{4}-\d{2}-\d{2})$/m.exec(log);
  tjek('CHANGELOG: første post er pakkens version med en dato', Boolean(foerste) && foerste[1] === VERSION, foerste ? foerste[0] : 'ingen post');
  tjek('CHANGELOG: kun dato, ingen klokkeslæt', !/\d{1,2}[:.]\d{2}(?![\d.])\s*(?:$|[^\d-])/m.test(log.replace(/\d+\.\d+\.\d+/g, '')) && !/T\d{2}:\d{2}|\bkl\.\s*\d/.test(log));
  tjek('fire skriftfiler (woff2) ligger i pakken', fs.readdirSync(path.join(PAKKE, 'web', 'fonts')).filter(f => f.endsWith('.woff2')).length === 4);
  tjek('begge OFL-licenser nævner SIL Open Font License', ['OFL-Inter.txt', 'OFL-JetBrainsMono.txt'].every(f => /SIL OPEN FONT LICENSE/i.test(pk('web/fonts/' + f))));
  const lic = pk('LICENSE.md'), readme = pk('README.md');
  tjek('V-KVIT.1: CHANGELOG har posterne 2.0.1 og 2.0.0, nyeste først, og 2.0.1 nævner de tre tilføjelser', log.indexOf('## 2.0.1 — ') > 0 && log.indexOf('## 2.0.1 — ') < log.indexOf('## 2.0.0 — ') && ['`LICENSE`', 'HUGINN-MUNINN.md', 'WI24RD-SANDBOX.md'].every(o => log.slice(log.indexOf('## 2.0.1'), log.indexOf('## 2.0.0')).includes(o)));
  tjek('V-KVIT.1: hele Apache-2.0-teksten ligger i pakken (LICENSE, byte for byte som repoets), og LICENSE.md og README peger på den', pk('LICENSE') === fs.readFileSync(path.join(repo, 'LICENSE'), 'utf8') && /Apache License\s+Version 2\.0, January 2004/.test(pk('LICENSE')) && /END OF TERMS AND CONDITIONS/.test(pk('LICENSE')) && /`LICENSE` i denne mappe/.test(lic) && /`LICENSE`/.test(readme));
  tjek('LICENSE.md: Apache-2.0 som repoet, skrifterne under OFL', /Apache License 2\.0/.test(lic) && /SIL Open Font License 1\.1/.test(lic) && /Apache License/.test(fs.readFileSync(path.join(repo, 'LICENSE'), 'utf8')));
  tjek('README: web (rækkefølge, tema, sprog), WPF (flet ind, ingen komponenter), opdatering og hvad der mangler', ['## Sådan tager et webbaseret program kittet i brug', 'data-kit-praefiks', 'Tema.saet(', 'KitSprog.opret(', '## Sådan tager et WPF-program tokens i brug', 'Komponenterne findes ikke til WPF endnu', 'MergedDictionaries', 'DynamicResource', '## Sådan opdaterer du til en ny version', '## Hvad pakken ikke indeholder'].every(s => readme.includes(s)));
  tjek('README: navnereglen for XAML står der (Wi24rd + PascalCase, fx Wi24rdAccentBrush)', /`Wi24rd` \+ tokenets navn i PascalCase/.test(readme) && readme.includes('Wi24rdAccentBrush'));
  const raekkefoelge = ['tokens.css', 'kit.css', 'tema.js', 'sprogmotor.js', 'kit.js'].map(f => readme.indexOf(`assets/${f}"`));
  tjek('README: filerne står i den rækkefølge, de skal indlæses', raekkefoelge.every((x, i) => x > 0 && (i === 0 || x > raekkefoelge[i - 1])), raekkefoelge.join(','));
  const gammel = fs.readFileSync(path.join(repo, 'design', 'ui-kit-2', 'README.md'), 'utf8');
  tjek('kittets README: listen "Det mangler" siger ikke længere, at der ingen pakket kode er', !/ingen pakket kode endnu/.test(gammel) && /pakke\//.test(gammel));
}

// ── N2/N5: kittets web-filer kender ikke det program, de blev udskilt fra ──
{
  /* En oprindelseskommentar er en kommentar, der indeholder ordet "Oprindelse:"; kun dér må navnet stå. */
  const udenOprindelse = t => t.replace(/\/\*[\s\S]*?\*\//g, k => (/Oprindelse:/.test(k) ? '' : k));
  const NAVN = /grimnir/i;
  const filer = par().map(([kilde]) => kilde).filter(f => /\.(css|js|txt)$/.test(f) && f.includes(path.join('pakke', 'web')));
  tjek('pakkens web/ har tekstfilerne (kit.css, kit.js, tema.js, sprogmotor.js og to licenser)', filer.length === 6, filer.map(f => path.basename(f)).join(', '));
  const med = filer.filter(f => NAVN.test(udenOprindelse(fs.readFileSync(f, 'utf8'))));
  tjek('ingen fil i pakkens web/ nævner Grimnir uden for en oprindelseskommentar', med.length === 0, med.map(f => path.relative(PAKKE, f)).join(', '));
  tjek('kontrol: reglen fanger navnet i kode og i en almindelig kommentar, men ikke i en oprindelseskommentar', NAVN.test(udenOprindelse("const N = 'grimnir-tema';")) && NAVN.test(udenOprindelse('/* Grimnirs tabel */ a{}')) && NAVN.test(udenOprindelse('// GRIMNIR')) && !NAVN.test(udenOprindelse('/* Oprindelse: udskilt fra Wi24rd Grimnir. */ a{}')));
  tjek('tokens.css og Tokens.xaml nævner heller ikke programmet', !NAVN.test(pk('tokens/tokens.css')) && !NAVN.test(pk('tokens/Tokens.xaml')) && !NAVN.test(pk('tokens/wi24rd-ui-kit-2.tokens.json')));
  const js = ['kit.js', 'tema.js', 'sprogmotor.js'].map(f => pk('web/' + f)).join('\n');
  tjek('kittet kender ikke Tauri eller programmets kommandoer (ingen __TAURI__, invoke eller data-platform)', !/__TAURI__|invoke\(|data-platform|data-tauri/.test(js + pk('web/kit.css')));
  tjek('tema.js og sprogmotor.js har ikke et fast navn i localStorage: præfikset kommer fra <html data-kit-praefiks>', /getAttribute\('data-kit-praefiks'\) \|\| 'wi24rd'\) \+ '-tema'/.test(pk('web/tema.js')) && /getAttribute\('data-kit-praefiks'\) \|\| 'wi24rd'\) \+ '-sprog'/.test(pk('web/sprogmotor.js')));
  tjek('ingen console.* og ingen farvekoder i kittets kode', !/\bconsole\s*\./.test(js) && !/#[0-9a-fA-F]{3,8}(?![\w-])|\brgba?\(|\bhsla?\(/.test(js.replace(/url\(#\$\{id\}\)/g, '') + pk('web/kit.css')));
  const css = pk('web/kit.css');
  const urler = [...css.matchAll(/url\(([^)]+)\)/g)].map(m => m[1]);
  tjek('kit.css henter kun skrifterne i fonts/ ved siden af sig selv', urler.length === 4 && urler.every(u => /^fonts\/[a-z0-9-]+\.woff2$/.test(u) && fs.existsSync(path.join(PAKKE, 'web', u))) && !/@import/.test(css));
  // Det, der blev flyttet ud til programmet, står nu i programmets egne filer.
  const ui = p => fs.readFileSync(path.join(repo, 'ui', p), 'utf8');
  tjek('flyttet: pladsen til macOS-knapperne står i programmets app.css, ikke i kit.css', /\[data-platform="macos"\] \.titel \{ padding-left: 80px; \}/.test(ui('assets/app.css')) && !/data-platform/.test(css));
  tjek('flyttet: de fire programikoner registreres i app.js, og kit.js har dem ikke', /K\.registrerIkoner\(\{\s*foerefter: [\s\S]*?kvittering: [\s\S]*?maske: [\s\S]*?naeste: /.test(ui('assets/app.js')) && !/^\s+(foerefter|kvittering|maske|naeste): \[/m.test(pk('web/kit.js')));
  tjek('omdøbt: .titel .sag hedder .titel .hoejre i kittet og i programmets index.html', /\.titel \.hoejre \{ margin-left: auto;/.test(css) && !/\.sag\b/.test(css) && /<span class="hoejre">/.test(ui('index.html')) && !/class="sag"/.test(ui('index.html')));
  tjek('programmet giver sit præfiks og indlæser sprogmotor.js før sprog.js', /<html[^>]* data-kit-praefiks="grimnir"/.test(ui('index.html')) && ui('index.html').indexOf('assets/sprogmotor.js') > 0 && ui('index.html').indexOf('assets/sprogmotor.js') < ui('index.html').indexOf('assets/sprog.js'));
  tjek('programmets sprog.js har teksterne og bruger kittets mekanik (ingen egen localStorage eller anvend)', /window\.KitSprog\.opret\(\{ tekst: TEKST, standard: 'da', noegle: NOEGLE, haendelse: NOEGLE, titel: 'dokTitel' \}\)/.test(ui('assets/sprog.js')) && !/localStorage\s*\./.test(ui('assets/sprog.js')) && !/function anvend/.test(ui('assets/sprog.js')));
}

// ── N3/N5: demosiden henter intet udefra og kører med pakkens rigtige filer ──
const demoFil = path.join(PAKKE, 'demo', 'index.html');
{
  const html = pk('demo/index.html'), script = pk('demo/demo.js');
  const begge = html + '\n' + script;
  const UDEFRA = /https?:|\bwss?:|\bftp:|(^|[^:\w/])\/\/[\w-]+(\.[\w-]+)+|\bcdn\b|@import|\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon|\bimport\s*\(|<iframe|<object|<embed|<link[^>]+rel="(?:preconnect|dns-prefetch|preload)"/i;
  tjek('demo: ingen http, //-adresser, CDN eller kode, der henter noget', !UDEFRA.test(begge), (UDEFRA.exec(begge) || [''])[0]);
  tjek('kontrol: mønsteret fanger https://, //cdn.example.com, fetch( og @import, men ikke stier og adresser i eksemplerne', ['src="https://example.com/a.js"', 'href="//cdn.example.com/a.css"', "fetch('a')", '@import "a.css"', 'new WebSocket(u)'].every(s => UDEFRA.test(s)) && !UDEFRA.test('href="../web/kit.css" 192.0.2.0/24 2001:db8::17 srv-app01.eksempel.dk'));
  const henvisninger = [...html.matchAll(/\b(?:src|href)="([^"]+)"/g)].map(m => m[1]);
  const lokale = henvisninger.filter(h => !h.startsWith('#'));
  tjek('demo: alle src og href er relative stier til filer i pakken', lokale.length === 6 && lokale.every(h => !/^[a-z]+:|^\//i.test(h) && path.resolve(PAKKE, 'demo', h).startsWith(PAKKE + path.sep) && fs.existsSync(path.resolve(PAKKE, 'demo', h))), lokale.join(', '));
  tjek('demo: bruger pakkens rigtige filer i den rækkefølge, README beskriver', JSON.stringify(lokale) === JSON.stringify(['../tokens/tokens.css', '../web/kit.css', '../web/tema.js', '../web/sprogmotor.js', '../web/kit.js', 'demo.js']));
  tjek('demo: tema.js står uden defer i <head>; resten har defer', /<script src="\.\.\/web\/tema\.js"><\/script>/.test(html) && /<script src="\.\.\/web\/kit\.js" defer><\/script>/.test(html));
  tjek('demo: ingen farvekoder (kun tokens)', !/#[0-9a-fA-F]{3,8}(?![\w-])|\brgba?\(|\bhsla?\(/.test(begge));
  tjek('demo: versionen på siden er pakkens', (html.match(/data-v="(\d+\.\d+\.\d+)"/g) || []).length === 3 && (html.match(/data-v="(\d+\.\d+\.\d+)"/g) || []).every(m => m === `data-v="${VERSION}"`));
  const liste = navn => JSON.parse(new RegExp(`const ${navn} = (\\[[^\\]]*\\]);`).exec(script)[1].replace(/'/g, '"'));
  tjek('demo: farverne på Tokens-visningen er dem i tokens.json', JSON.stringify(liste('FARVER')) === JSON.stringify(tokens.color.tokens.map(t => t.name)));
  tjek('demo: skriftstile, luft og radier er dem i tokens.json', JSON.stringify(liste('STILE')) === JSON.stringify(tokens.type.groups.flatMap(g => g.styles.map(s => s.name))) && JSON.stringify(liste('LUFT')) === JSON.stringify(tokens.spacing.tokens.map(t => t.name)) && JSON.stringify(liste('RADIER')) === JSON.stringify(tokens.radius.tokens.map(t => t.name)));
  tjek('demo: kun opdigtede adresser og navne (dokumentationsnet og eksempel.dk)', (begge.match(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g) || []).every(ip => ip.startsWith('192.0.2.')) && (begge.match(/[\w-]+\.[\w-]+\.(?:dk|com|net|org)\b|\b[\w-]+\.(?:dk|com|net|org)\b/g) || []).every(d => /(?:^|\.)eksempel\.dk$|(?:^|\.)example\.com$/.test(d)));
}
{
  // Siden indlæses, som en browser gør det fra disken: jsdom henter kun filerne ved siden af (file:), aldrig noget andet.
  const hentet = [], fejlListe = [];
  const konsol = new VirtualConsole();
  konsol.on('jsdomError', e => fejlListe.push(String(e && (e.detail || e.message))));
  konsol.on('error', e => fejlListe.push(String(e)));
  const { ResourceLoader } = await import('jsdom');
  class KunDisk extends ResourceLoader {
    fetch(url, o) {
      hentet.push(url);
      if (!url.startsWith('file:')) return Promise.reject(new Error('ikke fra disken: ' + url));
      return super.fetch(url, o);
    }
  }
  const dom = await JSDOM.fromFile(demoFil, { runScripts: 'dangerously', resources: new KunDisk(), pretendToBeVisual: true, virtualConsole: konsol });
  const w = dom.window, d = w.document;
  await new Promise(r => (d.readyState === 'complete' ? r() : w.addEventListener('load', r)));
  await vent(20);
  tjek('demo: indlæses uden fejl', fejlListe.length === 0 && Boolean(w.Kit && w.Tema && w.KitSprog && w.Sprog), fejlListe.join(' | ').slice(0, 300));
  const pakkeUrl = pathToFileURL(PAKKE).href;
  tjek('demo: alt, siden hentede, ligger i pakken (2 stilark og 4 scripts; skrifterne henter jsdom ikke)', hentet.length === 6 && hentet.every(u => u.startsWith(pakkeUrl + '/')), hentet.map(u => u.replace(pakkeUrl, '')).join(', '));
  const KOMPONENT = { AppShell: '.vindue > .titel', CommandBar: '#demo-baand.cmd .cb', NavPane: '#demo-trae.trae .tr', Visningsskift: '#demo-skift.skift .vs', StatusFooter: '.demo-ramme > .fodl', DataTable: '#demo-tabel table.tabel tbody tr', StatusChip: '#demo-chips .chip', Banner: '#demo-bannere .ban', Wizard: '#demo-guide.wiz .trin .t', Button: '#demo-knapper .btn', TextField: '#demo-felter .felt input', Ikoner: '#demo-ikoner svg', Fletbaand: '#demo-flet svg.flet', Grundlag: '.skjult-tekst' };
  const tomme = Object.entries(KOMPONENT).filter(([, v]) => !d.querySelector(v)).map(([k]) => k);
  tjek('demo: hver komponent er på siden, bygget af kittet', tomme.length === 0, tomme.join(', '));
  tjek('demo: hver sektion på Komponenter-visningen har en komponent fra KOMPONENTER.md', [...d.querySelectorAll('#v-komponenter .demo-sektion')].length === 13);
  tjek('demo: alle fem chips, fire bannere, fire knapvarianter og tre felter', d.querySelectorAll('#demo-chips .chip').length === 5 && d.querySelectorAll('#demo-bannere .ban').length === 4 && ['primary', 'danger', 'ghost'].every(v => d.querySelector(`#demo-knapper .btn.${v}`)) && d.querySelectorAll('#demo-knapper .btn').length === 4 && d.querySelectorAll('#demo-felter .felt').length === 3 && d.querySelector('#demo-felter [aria-invalid="true"]'));
  tjek('demo: alle kittets ikoner vises', d.querySelectorAll('#demo-ikoner .demo-ikon').length === Object.keys(w.Kit.IKONER).length && Object.keys(w.Kit.IKONER).length === 27, String(Object.keys(w.Kit.IKONER).length));

  // Begge temaer: valget sætter <html data-tema>, huskes under sidens eget præfiks og kan ses på knapperne.
  // jsdom giver ingen localStorage til en side fra disken (file:). Det er samme vilkår som en browser i privat tilstand:
  // siden skal virke alligevel, og valget gælder så kun denne gang. At valget huskes under præfikset, prøves længere nede.
  let lager = null;
  try { lager = w.localStorage || null; } catch (e) { lager = null; }
  tjek('demo: virker uden lagring (ingen localStorage på file: i jsdom)', lager === null && w.Tema.valg === 'system' && w.Sprog.lang === 'da');
  tjek('demo: starter i system', d.documentElement.getAttribute('data-tema') === 'system' && w.Tema.valg === 'system');
  d.querySelector('#baand [data-kommando="tema-moerk"]').click();
  tjek('demo: Mørk sætter data-tema="moerk", og knapperne viser valget', d.documentElement.getAttribute('data-tema') === 'moerk' && w.Tema.valg === 'moerk' && d.querySelector('#baand [data-kommando="tema-moerk"]').getAttribute('aria-pressed') === 'true' && d.querySelector('#baand [data-kommando="tema-system"]').getAttribute('aria-pressed') === 'false');
  d.querySelector('#baand [data-kommando="tema-lys"]').click();
  tjek('demo: Lys sætter data-tema="lys"', d.documentElement.getAttribute('data-tema') === 'lys' && w.Tema.valg === 'lys');
  d.getElementById('skift-tema').click();
  tjek('demo: knappen i titellinjen går videre til næste tema', d.documentElement.getAttribute('data-tema') === 'moerk');
  tjek('demo: siden har sit eget præfiks (kit-demo), så den ikke deler valg med et program', d.documentElement.getAttribute('data-kit-praefiks') === 'kit-demo' && /addEventListener\('kit-demo-tema'/.test(pk('demo/demo.js')) && /addEventListener\('kit-demo-sprog'/.test(pk('demo/demo.js')));

  // Begge sprog: hver nøgle findes, og intet element står tomt.
  const T = w.Sprog.TEKST;
  const da = Object.keys(T.da).sort(), en = Object.keys(T.en).sort();
  tjek('demo: dansk og engelsk har de samme nøgler', JSON.stringify(da) === JSON.stringify(en), da.filter(k => !en.includes(k)).concat(en.filter(k => !da.includes(k))).join(', '));
  const ukendte = () => [...d.querySelectorAll('[data-t],[data-t-aria],[data-t-title],[data-t-ph]')].flatMap(e => ['data-t', 'data-t-aria', 'data-t-title', 'data-t-ph'].map(a => e.getAttribute(a)).filter(Boolean)).filter(k => !(k in T.da) || !(k in T.en));
  tjek('demo: ingen nøgle på siden mangler i et af sprogene', ukendte().length === 0, [...new Set(ukendte())].join(', '));
  const tomt = () => [...d.querySelectorAll('[data-t]')].filter(e => !e.textContent.trim()).map(e => e.getAttribute('data-t'));
  tjek('demo (dansk): intet element med data-t står tomt', tomt().length === 0 && d.documentElement.lang === 'da' && d.title === 'Wi24rd UI Kit 2 — demo', tomt().join(', '));
  tjek('demo (dansk): ental og flertal (13 komponenter vises)', d.getElementById('fod-antal').textContent === '13 komponenter vises' && d.querySelector('#status-chip .ord').textContent === '13 komponenter');
  d.getElementById('skift-sprog').click();
  tjek('demo (English): sproget skifter uden genindlæsning', d.documentElement.lang === 'en' && w.Sprog.lang === 'en' && d.getElementById('fod-antal').textContent === '13 components shown' && d.querySelector('#demo-knapper .btn.primary span').textContent === 'Save and mask');
  tjek('demo (English): intet element med data-t står tomt', tomt().length === 0, tomt().join(', '));

  // Kittets opførsel på siden: træet filtrerer, søgningen filtrerer, tabellen vælger, guiden går frem.
  const punkt = id => d.querySelector(`#trae [data-punkt="${id}"]`);
  punkt('kontroller').click();
  const synlige = () => [...d.querySelectorAll('#v-komponenter .demo-sektion')].filter(s => !s.hidden).map(s => s.dataset.navn);
  tjek('demo: træet filtrerer arbejdsfladen (Controls: Button og TextField)', JSON.stringify(synlige()) === JSON.stringify(['Button', 'TextField']) && d.getElementById('fod-antal').textContent === '2 components shown');
  d.getElementById('ryd').click();
  d.getElementById('soeg').value = 'chip';
  d.getElementById('soeg').dispatchEvent(new w.Event('input', { bubbles: true }));
  tjek('demo: søgefeltet filtrerer (chip → StatusChip, ental)', JSON.stringify(synlige()) === JSON.stringify(['StatusChip']) && d.getElementById('fod-antal').textContent === '1 component shown');
  d.getElementById('ryd').click();
  tjek('demo: Ryd filter viser alle igen', synlige().length === 13);
  const raekker = [...d.querySelectorAll('#demo-tabel tbody tr:not(.gruppe)')];
  raekker[0].click();
  raekker[0].dispatchEvent(new w.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
  tjek('demo: tabellen vælger med klik og pil ned', raekker[1].classList.contains('sel') && raekker[1].getAttribute('aria-selected') === 'true' && d.getElementById('tabel-valgt').textContent === 'Selected: 2001:db8::17');
  const frem = d.querySelector('#demo-guide .fod .btn.primary');
  frem.click();
  tjek('demo: guiden går til trin 2 og udfylder teksterne', d.querySelector('#demo-guide .t.now').textContent.includes('Your domains') && d.querySelector('#demo-guide h2').textContent === 'Your domains' && d.querySelectorAll('#demo-guide .t.done').length === 1 && d.querySelector('#demo-guide .felt input'));
  frem.click();
  tjek('demo: i sidste trin hedder den primære knap Done', frem.querySelector('span').textContent === 'Done');
  w.location.hash = '#tokens';
  w.dispatchEvent(new w.HashChangeEvent('hashchange'));
  tjek('demo: visningsskiftet viser Tokens (48 farver, 8 skriftstile) og markerer den', !d.getElementById('v-tokens').hidden && d.getElementById('v-komponenter').hidden && d.querySelectorAll('#demo-farver .demo-farve').length === 48 && d.querySelectorAll('#demo-skrift > div').length === 8 && d.querySelector('#skift .vs.on').dataset.visning === 'tokens' && d.querySelector('#skift .vs.on').getAttribute('aria-current') === 'page');
  tjek('demo: stadig ingen fejl efter brug', fejlListe.length === 0, fejlListe.join(' | ').slice(0, 300));
  w.close();
}

// ── N3/N5: Tokens.xaml ──
{
  const xaml = pk('tokens/Tokens.xaml');
  let doc = null, xmlFejl = '';
  try { doc = new JSDOM(xaml, { contentType: 'application/xml' }).window.document; } catch (e) { xmlFejl = String(e && e.message); }
  tjek('Tokens.xaml er velformet XML', Boolean(doc), xmlFejl);
  let daarlig = true;
  try { new JSDOM(xaml.replace('</ResourceDictionary>', ''), { contentType: 'application/xml' }); daarlig = false; } catch (e) { /* forventet */ }
  tjek('kontrol: XML-læseren afviser en fil med et manglende sluttag', daarlig);
  const WPF = 'http://schemas.microsoft.com/winfx/2006/xaml/presentation', X = 'http://schemas.microsoft.com/winfx/2006/xaml';
  const rod = doc.documentElement;
  tjek('Tokens.xaml: roden er en WPF ResourceDictionary', rod.localName === 'ResourceDictionary' && rod.namespaceURI === WPF && rod.getAttribute('xmlns:x') === X);
  const ordboeger = [...rod.children];
  tjek('Tokens.xaml: præcis to ordbøger, Wi24rdLys og Wi24rdMoerk', ordboeger.length === 2 && ordboeger.every(o => o.localName === 'ResourceDictionary') && JSON.stringify(ordboeger.map(o => o.getAttributeNS(X, 'Key'))) === JSON.stringify([XAML_TEMA.light, XAML_TEMA.dark]));
  const laes = o => {
    const m = new Map();
    let dobbelt = 0;
    for (const e of o.children) {
      const k = e.getAttributeNS(X, 'Key');
      if (m.has(k)) dobbelt++;
      m.set(k, e);
    }
    return { m, dobbelt };
  };
  const lys = laes(ordboeger[0]), moerk = laes(ordboeger[1]);
  tjek('Tokens.xaml: ingen nøgle står to gange i samme ordbog', lys.dobbelt === 0 && moerk.dobbelt === 0);
  tjek('Tokens.xaml: de to ordbøger har præcis de samme nøgler (151 hver)', lys.m.size === 151 && JSON.stringify([...lys.m.keys()]) === JSON.stringify([...moerk.m.keys()]), `${lys.m.size} / ${moerk.m.size}`);
  tjek('Tokens.xaml: alle nøgler følger navnereglen (Wi24rd + PascalCase)', [...lys.m.keys()].every(k => /^Wi24rd[A-Z][A-Za-z0-9]*$/.test(k)));
  tjek('kontrol: navnereglen (surface-raised → Wi24rdSurfaceRaised, space-1 → Wi24rdSpace1, accent → Wi24rdAccent)', pascal('surface-raised') === 'Wi24rdSurfaceRaised' && pascal('space-1') === 'Wi24rdSpace1' && pascal('accent') + 'Brush' === 'Wi24rdAccentBrush');

  // Hver token i JSON findes i begge ordbøger, med den type WPF skal bruge.
  const forventet = [];
  for (const t of tokens.color.tokens) forventet.push([pascal(t.name) + 'Brush', 'SolidColorBrush'], [pascal(t.name) + 'Color', 'Color']);
  for (const t of tokens.shadow.tokens) forventet.push([pascal(t.name), 'DropShadowEffect']);
  for (const k of Object.keys(tokens.type.families)) forventet.push([pascal('font-' + k), 'FontFamily']);
  for (const g of tokens.type.groups) for (const s of g.styles) {
    forventet.push([pascal(s.name) + 'Size', 'Double'], [pascal(s.name) + 'Line', 'Double'], [pascal(s.name) + 'Weight', 'FontWeight'], [pascal(s.name) + 'Family', 'FontFamily']);
    if (s.letterSpacing) forventet.push([pascal(s.name) + 'Tracking', 'Double']);
  }
  for (const t of tokens.spacing.tokens) forventet.push([pascal(t.name), 'Double'], [pascal(t.name) + 'Thickness', 'Thickness']);
  for (const t of tokens.radius.tokens) forventet.push([pascal(t.name), 'CornerRadius']);
  for (const [navn, o] of [['Wi24rdLys', lys], ['Wi24rdMoerk', moerk]]) {
    const mangler = forventet.filter(([k, type]) => !o.m.has(k) || o.m.get(k).localName !== type).map(([k]) => k);
    tjek(`Tokens.xaml (${navn}): hver token i JSON findes med rigtig type (${forventet.length} nøgler)`, mangler.length === 0 && forventet.length === o.m.size, mangler.join(', '));
  }

  // Hver CSS-variabel har en nøgle efter navnereglen, og farver, tal og skrift er de samme som i tokens.css.
  const css = pk('tokens/tokens.css');
  const blok = (start) => { const i = css.indexOf(start); return Object.fromEntries([...css.slice(i, css.indexOf('}', i)).matchAll(/--([a-z0-9-]+): ([^;]+);/g)].map(m => [m[1], m[2]])); };
  const faelles = blok(':root {\n  --font-sans'), cssLys = blok(':root {\n  color-scheme: light;'), cssMoerk = blok(':root[data-tema="moerk"] {');
  tjek('tokens.css: 47 fælles variabler og 50 pr. tema (kontrol af læsningen)', Object.keys(faelles).length === 47 && Object.keys(cssLys).length === 50 && Object.keys(cssMoerk).length === 50, [faelles, cssLys, cssMoerk].map(b => Object.keys(b).length).join('/'));
  const farveNavne = tokens.color.tokens.map(t => t.name);
  for (const [navn, o, c, tema] of [['Wi24rdLys', lys, cssLys, 'light'], ['Wi24rdMoerk', moerk, cssMoerk, 'dark']]) {
    const uens = farveNavne.filter(n => {
      const brush = o.m.get(pascal(n) + 'Brush'), color = o.m.get(pascal(n) + 'Color');
      const v = argb(c[n], n);
      return !brush || !color || brush.getAttribute('Color') !== v || color.textContent !== v;
    });
    tjek(`Tokens.xaml (${navn}): de 48 farver er de samme som i tokens.css (pensel og farve)`, farveNavne.length === 48 && uens.length === 0, uens.join(', '));
    tjek(`Tokens.xaml (${navn}): farverne er også dem i tokens.json (${tema})`, temaVaerdier(tokens, tema).filter(([n]) => farveNavne.includes(n)).every(([n, v]) => o.m.get(pascal(n) + 'Brush').getAttribute('Color') === '#FF' + v.slice(1).toUpperCase()));
    const tal = Object.entries(faelles).filter(([, v]) => /^-?[\d.]+px$/.test(v));
    const talUens = tal.filter(([n, v]) => { const e = o.m.get(pascal(n)); return !e || e.textContent !== v.replace('px', ''); }).map(([n]) => n);
    tjek(`Tokens.xaml (${navn}): størrelser, linjehøjder, luft og radier er tallene fra tokens.css (${tal.length} værdier)`, tal.length === 26 && talUens.length === 0, talUens.join(', '));
    const skygger = tokens.shadow.tokens.map(t => {
      const e = o.m.get(pascal(t.name)), m = /^0 (\d+)px (\d+)px(?: -?\d+px)? rgba\((\d+),(\d+),(\d+),([\d.]+)\)$/.exec(c[t.name]);
      return e && m && e.getAttribute('ShadowDepth') === m[1] && e.getAttribute('BlurRadius') === m[2] && e.getAttribute('Opacity') === m[6] && e.getAttribute('Direction') === '270'
        && e.getAttribute('Color') === '#' + [m[3], m[4], m[5]].map(x => Number(x).toString(16).padStart(2, '0')).join('').toUpperCase();
    });
    tjek(`Tokens.xaml (${navn}): de to skygger har samme afstand, sløring, farve og styrke som i tokens.css`, skygger.length === 2 && skygger.every(Boolean));
    const alleCss = [...Object.keys(faelles), ...Object.keys(c)];
    const udenNoegle = alleCss.filter(n => !(o.m.has(pascal(n)) || o.m.has(pascal(n) + 'Brush')));
    tjek(`Tokens.xaml (${navn}): hver CSS-variabel har en nøgle efter navnereglen (${alleCss.length} variabler)`, alleCss.length === 97 && udenNoegle.length === 0, udenNoegle.join(', '));
  }
  tjek('Tokens.xaml: skriftvægte og familier (Normal/SemiBold; Inter, Segoe UI; ingen CSS-ord som system-ui)', lys.m.get('Wi24rdBodyWeight').textContent === 'Normal' && lys.m.get('Wi24rdH1Weight').textContent === 'SemiBold' && lys.m.get('Wi24rdFontSans').textContent === 'Inter, Segoe UI' && lys.m.get('Wi24rdFontMono').textContent === 'JetBrains Mono, Cascadia Mono, Menlo' && lys.m.get('Wi24rdMonoFamily').textContent === lys.m.get('Wi24rdFontMono').textContent && !/system-ui|sans-serif|monospace|&quot;/.test(xaml));
  tjek('Tokens.xaml: lyst og mørkt tema har forskellige farver, men samme tal', lys.m.get('Wi24rdSurfaceBrush').getAttribute('Color') === '#FFFFFFFF' && moerk.m.get('Wi24rdSurfaceBrush').getAttribute('Color') === '#FF121C29' && lys.m.get('Wi24rdSpace4').textContent === moerk.m.get('Wi24rdSpace4').textContent);
  tjek('Tokens.xaml: ingen farve i CSS-form (#RGB uden alfa i pensler, rgba) og ingen px', !/rgba?\(|px\b/.test(xaml.replace(/<!--[\s\S]*?-->/g, '')) && [...xaml.matchAll(/<SolidColorBrush [^>]*Color="([^"]+)"/g)].every(m => /^#FF[0-9A-F]{6}$/.test(m[1])));
}

// ── N3/N5: KOMPONENTER.md og koden nævner det samme ──
{
  const md = pk('KOMPONENTER.md');
  const afsnit = md.split(/^## /m).slice(1).map(a => ({ navn: a.slice(0, a.indexOf('\n')).trim(), tekst: a })).filter(a => a.navn !== 'Findes ikke endnu');
  const klasserI = a => { const m = /^\*\*Klasser:\*\* (.*)$/m.exec(a.tekst); return m ? [...m[1].matchAll(/`\.([a-z][a-z0-9-]*)`/g)].map(x => x[1]) : []; };
  const funktionerI = a => { const m = /^\*\*Funktioner:\*\* (.*)$/m.exec(a.tekst); return m ? [...m[1].matchAll(/`(Kit|Tema|KitSprog)\.([A-Za-zé]+)`/g)].map(x => x[1] + '.' + x[2]) : []; };
  tjek('KOMPONENTER.md: 15 komponenter', afsnit.length === 15, afsnit.map(a => a.navn).join(', '));
  const DELE = ['**Formål:**', '**Markup:**', '**Tilstande:**', '**Tastatur:**', '**Kræver af programmet:**'];
  const ufuldstaendige = afsnit.filter(a => !DELE.every(d => a.tekst.includes(d))).map(a => a.navn);
  tjek('KOMPONENTER.md: hver komponent har formål, markup, tilstande, tastatur og hvad den kræver', ufuldstaendige.length === 0, ufuldstaendige.join(', '));

  // Klasserne i kit.css (vælgerne, uden kommentarer og erklæringer) og dem, kit.js selv sætter.
  const css = pk('web/kit.css').replace(/\/\*[\s\S]*?\*\//g, '').replace(/@font-face\s*\{[^}]*\}/g, '').replace(/\{[^}]*\}/g, ' ');
  const cssKlasser = new Set([...css.matchAll(/\.([a-z][a-z0-9-]*)/g)].map(m => m[1]));
  const kitJs = pk('web/kit.js');
  // Det, kittet stiller til rådighed: læst ved at køre de tre filer i en tom side.
  const dom = new JSDOM('<!doctype html><html data-kit-praefiks="proeve"><body></body></html>', { runScripts: 'outside-only', url: 'http://kit.invalid/' });
  for (const f of ['tema.js', 'sprogmotor.js', 'kit.js']) dom.window.eval(pk('web/' + f));
  const w = dom.window;
  const kodeFunktioner = new Set([...Object.keys(w.Kit).map(k => 'Kit.' + k), ...Object.keys(w.Tema).map(k => 'Tema.' + k), ...Object.keys(w.KitSprog).map(k => 'KitSprog.' + k)]);
  tjek('kittet stiller Kit (14 navne), Tema (3) og KitSprog (1) til rådighed', Object.keys(w.Kit).length === 14 && Object.keys(w.Tema).length === 3 && Object.keys(w.KitSprog).length === 1, [...kodeFunktioner].join(', '));
  tjek('kit.css har 65 klasser i sine vælgere (kontrol af læsningen)', cssKlasser.size === 65 && cssKlasser.has('btn') && cssKlasser.has('skjult-tekst') && !cssKlasser.has('woff2'), String(cssKlasser.size));

  const uden = afsnit.filter(a => klasserI(a).length + funktionerI(a).length === 0).map(a => a.navn);
  tjek('hver komponent i KOMPONENTER.md nævner mindst én klasse eller funktion', uden.length === 0, uden.join(', '));
  const ukendteKlasser = afsnit.flatMap(a => klasserI(a).filter(k => !cssKlasser.has(k)).map(k => `${a.navn}: .${k}`));
  tjek('hver klasse i KOMPONENTER.md findes i kit.css', ukendteKlasser.length === 0, ukendteKlasser.join(', '));
  const ukendteFunktioner = afsnit.flatMap(a => funktionerI(a).filter(f => !kodeFunktioner.has(f)).map(f => `${a.navn}: ${f}`));
  tjek('hver funktion i KOMPONENTER.md findes i kittet', ukendteFunktioner.length === 0, ukendteFunktioner.join(', '));
  const dokKlasser = new Set(afsnit.flatMap(klasserI)), dokFunktioner = new Set(afsnit.flatMap(funktionerI));
  const udokKlasser = [...cssKlasser].filter(k => !dokKlasser.has(k));
  tjek('omvendt: hver klasse i kit.css står under en komponent i KOMPONENTER.md', udokKlasser.length === 0, udokKlasser.map(k => '.' + k).join(', '));
  const udokFunktioner = [...kodeFunktioner].filter(f => !dokFunktioner.has(f));
  tjek('omvendt: hver funktion i Kit, Tema og KitSprog står under en komponent i KOMPONENTER.md', udokFunktioner.length === 0, udokFunktioner.join(', '));
  // Hver komponentoverskrift i kit.css (/* ── Navn ── */) har et afsnit, og omvendt for dem, der har CSS.
  const cssAfsnit = [...pk('web/kit.css').matchAll(/\/\* ── ([A-Za-z]+) ──/g)].map(m => m[1]).filter(n => n !== 'Skrifter');
  const navne = afsnit.map(a => a.navn);
  tjek('hvert afsnit i kit.css er en komponent i KOMPONENTER.md', cssAfsnit.length === 12 && cssAfsnit.every(n => navne.includes(n)), cssAfsnit.filter(n => !navne.includes(n)).join(', '));
  const ikoner = Object.keys(w.Kit.IKONER);
  const ikonAfsnit = afsnit.find(a => a.navn === 'Ikoner').tekst;
  const ikonLinje = /^Kittets ikoner: (.*)$/m.exec(ikonAfsnit);
  const dokIkoner = ikonLinje ? [...ikonLinje[1].matchAll(/`([a-z]+)`/g)].map(m => m[1]) : [];
  tjek('KOMPONENTER.md: listen over ikoner er kittets (27)', JSON.stringify(dokIkoner) === JSON.stringify(ikoner), ikoner.filter(i => !dokIkoner.includes(i)).concat(dokIkoner.filter(i => !ikoner.includes(i))).join(', '));
  // De eksempler, der kalder kittet i KOMPONENTER.md og README.md, bruger kun navne, der findes.
  const kald = [...(md + pk('README.md')).matchAll(/\b(Kit|Tema|KitSprog)\.([A-Za-zé]+)\b/g)].map(m => m[1] + '.' + m[2]);
  const forkerte = [...new Set(kald.filter(k => !kodeFunktioner.has(k)))];
  tjek('eksemplerne i KOMPONENTER.md og README.md kalder kun navne, kittet har', kald.length > 30 && forkerte.length === 0, forkerte.join(', '));
  tjek('registrerIkoner: et nyt ikon kan bruges, og et af kittets navne kan ikke overtages', (() => {
    w.Kit.registrerIkoner({ proeve: [['path', { d: 'M4 12h16' }]] });
    let afvist = false;
    try { w.Kit.registrerIkoner({ sol: [['path', { d: 'M4 12h16' }]] }); } catch (e) { afvist = true; }
    return w.Kit.ikon('proeve').querySelector('path').getAttribute('d') === 'M4 12h16' && afvist && w.Kit.IKONER.sol.length === 2;
  })());
  tjek('tema.js: præfikset fra <html data-kit-praefiks> bruges til lager og hændelse', (() => {
    let meldt = 0;
    w.document.addEventListener('proeve-tema', () => meldt++);
    w.Tema.saet('moerk');
    return w.localStorage.getItem('proeve-tema') === 'moerk' && meldt === 1 && w.document.documentElement.getAttribute('data-tema') === 'moerk';
  })());
  tjek('sprogmotor.js: opret, t (ental/flertal), anvend og saet; ukendt sprog giver standardsproget', (() => {
    const S = w.KitSprog.opret({ standard: 'da', tekst: { da: { antal: '{v} {v:fil|filer}', gem: 'Gem' }, en: { antal: '{v} {v:file|files}', gem: 'Save' } } });
    w.document.body.innerHTML = '<button data-t="gem" data-t-aria="gem"></button><span data-t="antal" data-v="1"></span>';
    S.anvend(w.document);
    const b = w.document.querySelector('button'), s = w.document.querySelector('span');
    const foer = b.textContent === 'Gem' && b.getAttribute('aria-label') === 'Gem' && s.textContent === '1 fil' && S.t('antal', 3) === '3 filer';
    let meldt = 0;
    w.document.addEventListener('proeve-sprog', () => meldt++);
    S.saet('en');
    const efter = b.textContent === 'Save' && s.textContent === '1 file' && w.localStorage.getItem('proeve-sprog') === 'en' && meldt === 1 && w.document.documentElement.lang === 'en';
    S.saet('tysk');
    return foer && efter && S.lang === 'da' && b.textContent === 'Gem';
  })());
  w.close();
}

// ── Pakke 2.1.0 (K1–K4): ok, mærker, dataserier, skala og kort ──
{
  const farve = Object.fromEntries(tokens.color.tokens.map(t => [t.name, t.value]));
  // Intet er omdøbt eller fjernet i forhold til 2.0.0: de 22 farver findes stadig med samme værdier.
  const V200 = {"bg": {"light": "#F3F5F8", "dark": "#0B131E"}, "surface": {"light": "#FFFFFF", "dark": "#121C29"}, "surface-raised": {"light": "#F8FAFB", "dark": "#192433"}, "rail": {"light": "#0B1F33", "dark": "#070E17"}, "rail-text": {"light": "#C9D5E2", "dark": "#B9C6D6"}, "rail-strong": {"light": "#FFFFFF", "dark": "#FFFFFF"}, "rail-active": {"light": "#16364F", "dark": "#13293D"}, "accent-on-rail": {"light": "#35D6B3", "dark": "#35D6B3"}, "border": {"light": "#D8DEE6", "dark": "#263345"}, "border-strong": {"light": "#7C8A99", "dark": "#6B7C90"}, "text": {"light": "#17212B", "dark": "#E8EEF4"}, "text-muted": {"light": "#4F5E6D", "dark": "#A6B4C3"}, "accent": {"light": "#007864", "dark": "#35D6B3"}, "accent-hover": {"light": "#006050", "dark": "#6BE5CA"}, "on-accent": {"light": "#FFFFFF", "dark": "#04231D"}, "accent-soft": {"light": "#E2F4F0", "dark": "#0F322D"}, "info": {"light": "#1B5CC8", "dark": "#86B4FF"}, "info-soft": {"light": "#E7EFFD", "dark": "#13284A"}, "warn": {"light": "#8A5300", "dark": "#FFC66E"}, "warn-soft": {"light": "#FFF2DA", "dark": "#39290C"}, "danger": {"light": "#B3261E", "dark": "#FF9E96"}, "danger-soft": {"light": "#FDEBE9", "dark": "#3E1613"}};
  const aendret = Object.keys(V200).filter(n => !farve[n] || farve[n].light !== V200[n].light || farve[n].dark !== V200[n].dark);
  tjek('2.1.0: de 22 farver fra 2.0.0 findes stadig med samme værdier (intet omdøbt eller fjernet)', Object.keys(V200).length === 22 && aendret.length === 0, aendret.join(', '));
  const NYE = ['ok', 'ok-soft', 'ok-mark', 'warn-mark', 'danger-mark', 'info-mark', 'none-mark', 'data-1', 'data-2', 'data-3', 'data-4', 'data-5', 'data-6', 'data-axis', 'data-grid', 'data-label',
    'seq-1', 'seq-2', 'seq-3', 'seq-4', 'seq-5', 'map-sea', 'map-land', 'map-border', 'map-ring', 'map-arc'];
  const mangler = NYE.filter(n => !farve[n] || !/^#[0-9A-F]{6}$/.test(farve[n].light) || !/^#[0-9A-F]{6}$/.test(farve[n].dark));
  tjek('2.1.0: de 26 nye farver findes i lyst og mørkt tema', mangler.length === 0 && tokens.color.tokens.length === 48, mangler.join(', '));
  tjek('2.1.0 (K1): ok og ok-soft har samme værdier som accent og accent-soft, men er egne tokens', ['light', 'dark'].every(t => farve.ok[t] === farve.accent[t] && farve['ok-soft'][t] === farve['accent-soft'][t]));
  const css = pk('web/kit.css');
  tjek('2.1.0 (K1): OK-chip og OK-banner bruger ok, ikke accent', /\.chip\.ok \{ background: var\(--ok-soft\); color: var\(--ok\); \}/.test(css) && /\.ban\.ok \{ background: var\(--ok-soft\); \} \.ban\.ok \.s \{ background: var\(--ok\);/.test(css));
  tjek('2.1.0: primær knap, valgt række og aktiv fane bruger stadig accent', /\.btn\.primary \{ background: var\(--accent\)/.test(css) && /\.tabel tr\.sel td[^{]*\{ background: var\(--accent-soft\)/.test(css) && /\.tab\.on \{ border-bottom-color: var\(--accent\)/.test(css));
  tjek('2.1.0 (K2): mærkefarverne er ikke tekstfarverne (egne værdier i lyst tema)', ['warn', 'danger', 'info'].every(n => farve[n + '-mark'].light !== farve[n].light) && farve['ok-mark'].light !== farve.ok.light);
  tjek('2.1.0 (K3): seks dataserier med forskellige farver i begge temaer; besøg/oplysning er samme blå som data-1', ['light', 'dark'].every(t => new Set([1, 2, 3, 4, 5, 6].map(n => farve['data-' + n][t])).size === 6 && farve['data-1'][t] === farve['info-mark'][t]));
  tjek('2.1.0 (K3): akse, gitter og etiket følger kittets kanter og sekundære tekst', ['light', 'dark'].every(t => farve['data-axis'][t] === farve['border-strong'][t] && farve['data-grid'][t] === farve.border[t] && farve['data-label'][t] === farve['text-muted'][t]));
  tjek('2.1.0 (K4): angrebets ring er fejlens mærke, buen oplysningens', ['light', 'dark'].every(t => farve['map-ring'][t] === farve['danger-mark'][t] && farve['map-arc'][t] === farve['info-mark'][t]));
  const tcss = pk('tokens/tokens.css'), xaml = pk('tokens/Tokens.xaml');
  tjek('2.1.0: hver ny farve står i tokens.css (tre blokke) og i Tokens.xaml (pensel og farve i begge ordbøger)', NYE.every(n => (tcss.match(new RegExp('--' + n + ': #', 'g')) || []).length === 3 && (xaml.match(new RegExp('x:Key="' + pascal(n) + 'Brush"', 'g')) || []).length === 2 && (xaml.match(new RegExp('x:Key="' + pascal(n) + 'Color"', 'g')) || []).length === 2));
  tjek('kontrol: navnereglen for de nye (ok-mark → Wi24rdOkMark, data-1 → Wi24rdData1, map-sea → Wi24rdMapSea)', pascal('ok-mark') === 'Wi24rdOkMark' && pascal('data-1') === 'Wi24rdData1' && pascal('map-sea') === 'Wi24rdMapSea');
  const log = pk('CHANGELOG.md');
  const post = log.slice(log.indexOf('## 2.1.0'), log.indexOf('\n## ', log.indexOf('## 2.1.0') + 1));
  tjek('CHANGELOG 2.1.0: nævner K1–K4, de nye tokens, og at intet er omdøbt eller fjernet', ['(K1)', '(K2)', '(K3)', '(K4)', '--ok-soft', '--none-mark', '--data-6', '--seq-5', '--map-arc', 'Intet er omdøbt eller fjernet'].every(o => post.includes(o)));
  const md = pk('KOMPONENTER.md');
  const grundlag = md.slice(md.indexOf('\n## Grundlag'), md.indexOf('\n## AppShell'));
  tjek('KOMPONENTER.md (Grundlag): hver ny farve er nævnt eller dækket af en række, og reglerne står der', ['--ok-soft', '--ok-mark', '--none-mark', '--data-1', '--data-6', '--data-axis', '--data-grid', '--data-label', '--seq-1', '--seq-5', '--map-sea', '--map-arc', 'Aldrig farve alene', 'Faste betydninger', 'Accent og ok'].every(o => grundlag.includes(o)));
  const hm = pk('flytning/HUGINN-MUNINN.md');
  tjek('flytning/HUGINN-MUNINN.md: K1–K4 står som opfyldt i 2.1.0, og tavlens farver står ikke længere som umulige at flytte', ['K1', 'K2', 'K3', 'K4'].every(k => new RegExp('\\| ' + k + ' [^|]*\\| 2\\.1\\.0 \\|').test(hm)) && !/Kit 2 har ingen farver til diagrammer og kort/.test(hm));
  // Demoen viser de nye tokens med pakkens rigtige filer.
  const dom = await JSDOM.fromFile(demoFil, { runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, virtualConsole: new VirtualConsole() });
  const w = dom.window, d = w.document;
  await new Promise(r => (d.readyState === 'complete' ? r() : w.addEventListener('load', r)));
  await vent(20);
  const baggrund = v => [...d.querySelectorAll(v + ' i')].map(i => i.style.background);
  tjek('demo 2.1.0: fem mærker, seks søjler, fem trin og fem kortfarver, hver med sit token og sit navn', JSON.stringify(baggrund('#demo-maerker')) === JSON.stringify(['ok', 'warn', 'danger', 'info', 'none'].map(n => `var(--${n}-mark)`))
    && JSON.stringify(baggrund('#demo-data')) === JSON.stringify([1, 2, 3, 4, 5, 6].map(n => `var(--data-${n})`)) && JSON.stringify(baggrund('#demo-seq')) === JSON.stringify([1, 2, 3, 4, 5].map(n => `var(--seq-${n})`))
    && d.querySelectorAll('#demo-kortfarver i').length === 5 && [...d.querySelectorAll('#demo-maerker-sektion .mono')].length === 21);
  const kort = d.querySelector('#demo-kort svg');
  tjek('demo 2.1.0: kortet er tegnet med kortets tokens (hav, land, grænse, trin, ring og bue)', Boolean(kort) && ['--map-sea', '--map-land', '--map-border', '--seq-3', '--seq-5', '--map-ring', '--map-arc'].every(t => kort.outerHTML.includes(`var(${t})`)));
  tjek('demo 2.1.0: sektionen har overskrift og tekst i begge sprog', d.querySelector('#demo-maerker-sektion h2').textContent === 'Mærker, data, skala og kort' && d.querySelector('#demo-maerker-sektion p').textContent.startsWith('Fra 2.1.0') && w.Sprog.TEKST.en.hMaerker === 'Marks, data, scale and map');
  w.close();
}

// ── N4: flyttevejledningerne ──
{
  for (const [fil, ord] of [['flytning/HUGINN-MUNINN.md', ['manual', 'fotobog']], ['flytning/WI24RD-FTP.md', ['Tokens.xaml', 'DynamicResource']]]) {
    const t = pk(fil);
    const DELE = ['## Hvad programmet har i dag', '## Rækkefølgen', '## Det, der ikke kan flyttes endnu', '## Det, der skal tages om bagefter', '## Forslag til cyklusser', '## Ikke undersøgt'];
    const mangler = DELE.filter(d => !t.includes(d));
    tjek(`${fil}: har alle afsnit`, mangler.length === 0 && ord.every(o => t.includes(o)), mangler.join(', '));
  }
}

// ── V-KVIT.1 N4: beslutningen om Huginn and Muninn og noten om Sandbox ──
{
  const hm = pk('flytning/HUGINN-MUNINN.md');
  tjek('V-KVIT.1: HUGINN-MUNINN.md: beslutningen (hele Kit 2-skallen, 2026-11-11) står der, og valget er ikke længere åbent', /## Beslutning: hele skallen/.test(hm) && /Jan har besluttet 2026-11-11/.test(hm) && /hele Kit 2-skallen/.test(hm) && ['mørk titellinje', 'handlingsbånd', 'træ', 'fodlinje'].every(o => hm.includes(o)) && !/kun hvis Jan vælger|kun ved hele skallen|Jan vælger: hele skallen eller/.test(hm));
  const cyk = hm.slice(hm.indexOf('## Forslag til cyklusser'), hm.indexOf('## Ikke undersøgt'));
  tjek('V-KVIT.1: HUGINN-MUNINN.md: cyklusserne er dem for hele skallen (A, B1–B6; skallen i B3 og B4)', ['| A (undersøgelse) |', '| B1 |', '| B2 |', '| B3 |', '| B4 |', '| B5 |', '| B6 |'].every(o => cyk.includes(o)) && !cyk.includes('| B7 |') && /\| B3 \| Trin 7, rammen/.test(cyk) && /\| B4 \| Trin 7, visningerne/.test(cyk));
  const sb = pk('flytning/WI24RD-SANDBOX.md');
  tjek('V-KVIT.1: WI24RD-SANDBOX.md: kun Windows, venter, ikke undersøgt, samme vej som FTP (XAML)', /kun et Windows-program/.test(sb) && /ligger og venter/.test(sb) && /ikke undersøgt/.test(sb) && /samme vej som Wi24rd FTP/.test(sb) && sb.includes('XAML') && sb.includes('WI24RD-FTP.md') && sb.length < 2000);
  tjek('V-KVIT.1: WI24RD-FTP.md peger på noten om Sandbox', pk('flytning/WI24RD-FTP.md').includes('WI24RD-SANDBOX.md'));
}

console.log(`\n${ok + fejl} tjek: ${ok} ok, ${fejl} fejl`);
process.exit(fejl ? 1 : 0);
