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
// Pakke 2.3.0 (K10–K17): de nye navne i kittet. Det, der ikke står her, V200_* eller 2.2.0's lister, må ikke findes.
const V230_FUNKTIONER = ['Kit.filterchip', 'Kit.filterchips', 'Kit.kasse', 'Kit.statusflise', 'Kit.statusfliser', 'Kit.tomTilstand', 'Kit.fremdrift', 'Kit.vaerktoejstip', 'Kit.afkrydsning', 'Kit.kontakt', 'Kit.radiogruppe', 'Kit.valgliste', 'Kit.dialog', 'Kit.bekraeft', 'Kit.sideskift'];
// K15: en tabel bygget af 2.0.0's kit.js (git show 64c0cce:design/ui-kit-2/pakke/web/kit.js) med bygTabel i 2.3.0-blokken: efter
// oprettelsen og efter vaelg(1). Uden de nye indstillinger skal tabellen være byte for byte den samme.
const V200_TABEL = {"tabel": "<table class=\"tabel\" role=\"grid\" data-t-aria=\"tabelAria\"><thead><tr><th data-t=\"kolVaerdi\" scope=\"col\"></th><th scope=\"col\">Status</th><th class=\"r\" data-t=\"kolAntal\" scope=\"col\"></th></tr></thead><tbody><tr class=\"gruppe\"><td colspan=\"3\"><b data-t=\"grpAdresser\"></b> <span class=\"muted\">2 rækker</span></td></tr><tr tabindex=\"0\" aria-selected=\"false\"><td class=\"mono\">192.0.2.17</td><td><span class=\"chip ok\"><span aria-hidden=\"true\">✓</span><span class=\"ord\">Maskeres</span></span></td><td class=\"r\">4</td></tr><tr tabindex=\"-1\" aria-selected=\"false\"><td class=\"mono\">2001:db8::17</td><td></td><td class=\"r\">12</td></tr><tr class=\"gruppe\"><td colspan=\"3\"><b>Navne</b></td></tr><tr tabindex=\"-1\" aria-selected=\"false\"><td class=\"mono\">srv-app01.eksempel.dk</td><td><span class=\"chip warn\"><span aria-hidden=\"true\">!</span><span class=\"ord\" data-t=\"cWarn\"></span></span></td><td class=\"r\">0</td></tr></tbody></table>", "tabelValgt": "<table class=\"tabel\" role=\"grid\" data-t-aria=\"tabelAria\"><thead><tr><th data-t=\"kolVaerdi\" scope=\"col\"></th><th scope=\"col\">Status</th><th class=\"r\" data-t=\"kolAntal\" scope=\"col\"></th></tr></thead><tbody><tr class=\"gruppe\"><td colspan=\"3\"><b data-t=\"grpAdresser\"></b> <span class=\"muted\">2 rækker</span></td></tr><tr tabindex=\"-1\" aria-selected=\"false\"><td class=\"mono\">192.0.2.17</td><td><span class=\"chip ok\"><span aria-hidden=\"true\">✓</span><span class=\"ord\">Maskeres</span></span></td><td class=\"r\">4</td></tr><tr tabindex=\"0\" aria-selected=\"true\" class=\"sel\"><td class=\"mono\">2001:db8::17</td><td></td><td class=\"r\">12</td></tr><tr class=\"gruppe\"><td colspan=\"3\"><b>Navne</b></td></tr><tr tabindex=\"-1\" aria-selected=\"false\"><td class=\"mono\">srv-app01.eksempel.dk</td><td><span class=\"chip warn\"><span aria-hidden=\"true\">!</span><span class=\"ord\" data-t=\"cWarn\"></span></span></td><td class=\"r\">0</td></tr></tbody></table>"};
// Pakke 2.4.0 (K36–K38, K18–K21, K29, K30): de nye navne. Det, der ikke står her, V200_*, 2.2.0's eller V230_*, må ikke findes.
const V240_FUNKTIONER = ['Kit.tabelRul'];
const V240_KLASSER = ['uden-valg', 'kol-xs', 'kol-s', 'kol-m', 'kol-l', 'kol-xl', 'kol-skille', 'layout-auto', 'tabel-rul', 'fast-foerste'];
const V240_FARVER = ['text-disabled', 'ok-mark-hover', 'warn-mark-hover', 'danger-mark-hover', 'info-mark-hover', 'none-mark-hover'];
const V230_KLASSER = ['fchips', 'fchip', 'fchip-mark', 'kasse', 'kasse-top', 'kasse-handling', 'kasse-indhold', 'fyld', 'kasse-fod', 'sfliser', 'sflise', 'sflise-navn', 'sflise-tal', 'sflise-under', 'sflise-pil', 'tomt', 'tomt-ikon', 'tomt-h', 'tomt-p', 'lille', 'frem', 'ubestemt', 'frem-tekst', 'frem-bjaelke', 'snurr', 'tip-plads', 'tip', 'under', 'venstre-kant', 'afk-felt', 'afk', 'afk-boks', 'afk-tekst', 'afk-hj', 'valgsaet', 'vandret', 'tilfra', 'tilfra-ord', 'tilfra-til', 'tilfra-fra', 'vliste', 'modal', 'bred', 'modal-top', 'modal-luk', 'modal-tekst', 'modal-indhold', 'modal-fod', 'sorter', 'sorter-pil', 'kolgruppe', 'sideskift', 'sideskift-nr', 'sideskift-pr'];

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
  tjek('VERSION er 2.4.0', VERSION === '2.4.0' && pk('VERSION') === '2.4.0\n', JSON.stringify(pk('VERSION')));
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
  // V-KITBRUG.1: Grimnir deler de 80 px med tekststørrelsen (80 px på skærmen i alle trin).
  tjek('flyttet: pladsen til macOS-knapperne står i programmets app.css, ikke i kit.css', /\[data-platform="macos"\] \.titel \{ padding-left: (80px|calc\(80px \/ var\(--z\)\)); \}/.test(ui('assets/app.css')) && !/data-platform/.test(css));
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
  const KOMPONENT = { AppShell: '.vindue > .titel', CommandBar: '#demo-baand.cmd .cb', NavPane: '#demo-trae.trae .tr', Visningsskift: '#demo-skift.skift .vs', StatusFooter: '.demo-ramme > .fodl', DataTable: '#demo-tabel table.tabel tbody tr', TabelNy: '#demo-tabel-ny table.tabel thead th[aria-sort] button.sorter', Sideskift: '#demo-tabel-ny nav.sideskift .sideskift-nr', StatusChip: '#demo-chips .chip', Banner: '#demo-bannere .ban', Wizard: '#demo-guide.wiz .trin .t', Button: '#demo-knapper .btn', TextField: '#demo-felter .felt input', Ikoner: '#demo-ikoner svg', Fletbaand: '#demo-flet svg.flet', Grundlag: '.skjult-tekst', Vælger: '#demo-vaelger-titel .vlg .vlg-knap', Sidepanel: '#demo-sidepanel.sidepanel .sp-top h2', Segmentknap: '#demo-segment .seg .seg-v', BaandUdenFaner: '#demo-baand-enkel.cmd.enkel .baand-el .seg', OtteVisninger: '#demo-skift-otte.skift.taet .vs', Filterchip: '#demo-filterchips .fchips .fchip', Kasse: '#demo-kasser section.kasse .kasse-top h2', StatusTile: '#demo-fliser ul.sfliser > li > button.sflise', TomTilstand: '#demo-tom-stor .tomt h2.tomt-h', Fremdrift: '#demo-frem .frem.ubestemt .snurr', Vaerktoejstip: '#demo-tip .tip-plads .tip[role="tooltip"]', Afkrydsning: '#demo-afk .afk input.afk-boks[type="checkbox"]', Kontakt: '#demo-kontakt input.tilfra[role="switch"]', Radiogruppe: '#demo-radio fieldset.valgsaet input[type="radio"]', Valgliste: '#demo-valgliste .vliste select', Dialog: '#demo-dialog .btn', Tekststoerrelse: '#demo-tekst .seg .seg-v' };
  const tomme = Object.entries(KOMPONENT).filter(([, v]) => !d.querySelector(v)).map(([k]) => k);
  tjek('demo: hver komponent er på siden, bygget af kittet', tomme.length === 0, tomme.join(', '));
  tjek('demo: hver sektion på Komponenter-visningen har en komponent fra KOMPONENTER.md', [...d.querySelectorAll('#v-komponenter .demo-sektion')].length === 28);
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
  tjek('demo (dansk): ental og flertal (28 komponenter vises)', d.getElementById('fod-antal').textContent === '28 komponenter vises' && d.querySelector('#status-chip .ord').textContent === '28 komponenter');
  d.getElementById('skift-sprog').click();
  tjek('demo (English): sproget skifter uden genindlæsning', d.documentElement.lang === 'en' && w.Sprog.lang === 'en' && d.getElementById('fod-antal').textContent === '28 components shown' && d.querySelector('#demo-knapper .btn.primary span').textContent === 'Save and mask');
  tjek('demo (English): intet element med data-t står tomt', tomt().length === 0, tomt().join(', '));

  // Kittets opførsel på siden: træet filtrerer, søgningen filtrerer, tabellen vælger, guiden går frem.
  const punkt = id => d.querySelector(`#trae [data-punkt="${id}"]`);
  punkt('kontroller').click();
  const synlige = () => [...d.querySelectorAll('#v-komponenter .demo-sektion')].filter(s => !s.hidden).map(s => s.dataset.navn);
  tjek('demo: træet filtrerer arbejdsfladen (Controls: Vælger, Segmentknap, Filterchip, Afkrydsning, Kontakt, Radiogruppe, Valgliste, Button og TextField)', JSON.stringify(synlige()) === JSON.stringify(['Vælger', 'Segmentknap', 'Filterchip', 'Afkrydsning', 'Kontakt', 'Radiogruppe', 'Valgliste', 'Button', 'TextField']) && d.getElementById('fod-antal').textContent === '9 components shown', JSON.stringify(synlige()));
  d.getElementById('ryd').click();
  d.getElementById('soeg').value = 'banner';
  d.getElementById('soeg').dispatchEvent(new w.Event('input', { bubbles: true }));
  tjek('demo: søgefeltet filtrerer (banner → Banner, ental; "chip" rammer fra 2.3.0 også Filterchip)', JSON.stringify(synlige()) === JSON.stringify(['Banner']) && d.getElementById('fod-antal').textContent === '1 component shown');
  d.getElementById('ryd').click();
  tjek('demo: Ryd filter viser alle igen', synlige().length === 28);
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
  tjek('demo: visningsskiftet viser Tokens (54 farver fra 2.4.0, 8 skriftstile) og markerer den', !d.getElementById('v-tokens').hidden && d.getElementById('v-komponenter').hidden && d.querySelectorAll('#demo-farver .demo-farve').length === 54 && d.querySelectorAll('#demo-skrift > div').length === 8 && d.querySelector('#skift .vs.on').dataset.visning === 'tokens' && d.querySelector('#skift .vs.on').getAttribute('aria-current') === 'page');
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
  tjek('Tokens.xaml: de to ordbøger har præcis de samme nøgler (163 hver fra 2.4.0)', lys.m.size === 163 && JSON.stringify([...lys.m.keys()]) === JSON.stringify([...moerk.m.keys()]), `${lys.m.size} / ${moerk.m.size}`);
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
  tjek('tokens.css: 47 fælles variabler og 56 pr. tema fra 2.4.0 (kontrol af læsningen)', Object.keys(faelles).length === 47 && Object.keys(cssLys).length === 56 && Object.keys(cssMoerk).length === 56, [faelles, cssLys, cssMoerk].map(b => Object.keys(b).length).join('/'));
  const farveNavne = tokens.color.tokens.map(t => t.name);
  for (const [navn, o, c, tema] of [['Wi24rdLys', lys, cssLys, 'light'], ['Wi24rdMoerk', moerk, cssMoerk, 'dark']]) {
    const uens = farveNavne.filter(n => {
      const brush = o.m.get(pascal(n) + 'Brush'), color = o.m.get(pascal(n) + 'Color');
      const v = argb(c[n], n);
      return !brush || !color || brush.getAttribute('Color') !== v || color.textContent !== v;
    });
    tjek(`Tokens.xaml (${navn}): de 54 farver (fra 2.4.0) er de samme som i tokens.css (pensel og farve)`, farveNavne.length === 54 && uens.length === 0, uens.join(', '));
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
    tjek(`Tokens.xaml (${navn}): hver CSS-variabel har en nøgle efter navnereglen (${alleCss.length} variabler)`, alleCss.length === 103 && udenNoegle.length === 0, udenNoegle.join(', '));
  }
  tjek('Tokens.xaml: skriftvægte og familier (Normal/SemiBold; Inter, Segoe UI; ingen CSS-ord som system-ui)', lys.m.get('Wi24rdBodyWeight').textContent === 'Normal' && lys.m.get('Wi24rdH1Weight').textContent === 'SemiBold' && lys.m.get('Wi24rdFontSans').textContent === 'Inter, Segoe UI' && lys.m.get('Wi24rdFontMono').textContent === 'JetBrains Mono, Cascadia Mono, Menlo' && lys.m.get('Wi24rdMonoFamily').textContent === lys.m.get('Wi24rdFontMono').textContent && !/system-ui|sans-serif|monospace|&quot;/.test(xaml));
  tjek('Tokens.xaml: lyst og mørkt tema har forskellige farver, men samme tal', lys.m.get('Wi24rdSurfaceBrush').getAttribute('Color') === '#FFFFFFFF' && moerk.m.get('Wi24rdSurfaceBrush').getAttribute('Color') === '#FF121C29' && lys.m.get('Wi24rdSpace4').textContent === moerk.m.get('Wi24rdSpace4').textContent);
  tjek('Tokens.xaml: ingen farve i CSS-form (#RGB uden alfa i pensler, rgba) og ingen px', !/rgba?\(|px\b/.test(xaml.replace(/<!--[\s\S]*?-->/g, '')) && [...xaml.matchAll(/<SolidColorBrush [^>]*Color="([^"]+)"/g)].every(m => /^#FF[0-9A-F]{6}$/.test(m[1])));
}

// ── N3/N5: KOMPONENTER.md og koden nævner det samme ──
{
  const md = pk('KOMPONENTER.md');
  const afsnit = md.split(/^## /m).slice(1).map(a => ({ navn: a.slice(0, a.indexOf('\n')).trim(), tekst: a })).filter(a => a.navn !== 'Findes ikke endnu' && a.navn !== 'Hvilken kontrol hvornår');
  const klasserI = a => { const m = /^\*\*Klasser:\*\* (.*)$/m.exec(a.tekst); return m ? [...m[1].matchAll(/`\.([a-z][a-z0-9-]*)`/g)].map(x => x[1]) : []; };
  const funktionerI = a => { const m = /^\*\*Funktioner:\*\* (.*)$/m.exec(a.tekst); return m ? [...m[1].matchAll(/`(Kit|Tema|KitSprog|Tekst)\.([A-Za-zéø]+)`/g)].map(x => x[1] + '.' + x[2]) : []; };
  tjek('KOMPONENTER.md: 30 komponenter', afsnit.length === 30, afsnit.map(a => a.navn).join(', '));
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
  const kodeFunktioner = new Set([...Object.keys(w.Kit).map(k => 'Kit.' + k), ...Object.keys(w.Tema).map(k => 'Tema.' + k), ...Object.keys(w.KitSprog).map(k => 'KitSprog.' + k), ...Object.keys(w.Tekst).map(k => 'Tekst.' + k)]);
  tjek('kittet stiller Kit (33 navne fra 2.4.0), Tema (3), KitSprog (1) og fra 2.3.0 Tekst (6) til rådighed', Object.keys(w.Kit).length === 33 && Object.keys(w.Tema).length === 3 && Object.keys(w.KitSprog).length === 1 && Object.keys(w.Tekst).length === 6, [...kodeFunktioner].join(', '));
  tjek('kit.css har 154 klasser i sine vælgere fra 2.4.0 (kontrol af læsningen)', cssKlasser.size === 154 && cssKlasser.has('btn') && cssKlasser.has('skjult-tekst') && !cssKlasser.has('woff2'), String(cssKlasser.size));

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
  tjek('omvendt: hver funktion i Kit, Tema, KitSprog og Tekst står under en komponent i KOMPONENTER.md', udokFunktioner.length === 0, udokFunktioner.join(', '));
  // Hver komponentoverskrift i kit.css (/* ── Navn ── */) har et afsnit, og omvendt for dem, der har CSS.
  const cssAfsnit = [...pk('web/kit.css').matchAll(/\/\* ── ([A-Za-zÆØÅæøå][A-Za-zÆØÅæøå ]*?) ──/g)].map(m => m[1]).filter(n => n !== 'Skrifter');
  const navne = afsnit.map(a => a.navn);
  tjek('hvert afsnit i kit.css er en komponent i KOMPONENTER.md', cssAfsnit.length === 27 && cssAfsnit.every(n => navne.includes(n)), cssAfsnit.filter(n => !navne.includes(n)).join(', '));
  const ikoner = Object.keys(w.Kit.IKONER);
  const ikonAfsnit = afsnit.find(a => a.navn === 'Ikoner').tekst;
  const ikonLinje = /^Kittets ikoner: (.*)$/m.exec(ikonAfsnit);
  const dokIkoner = ikonLinje ? [...ikonLinje[1].matchAll(/`([a-z]+)`/g)].map(m => m[1]) : [];
  tjek('KOMPONENTER.md: listen over ikoner er kittets (27)', JSON.stringify(dokIkoner) === JSON.stringify(ikoner), ikoner.filter(i => !dokIkoner.includes(i)).concat(dokIkoner.filter(i => !ikoner.includes(i))).join(', '));
  // De eksempler, der kalder kittet i KOMPONENTER.md og README.md, bruger kun navne, der findes.
  const kald = [...(md + pk('README.md')).matchAll(/\b(Kit|Tema|KitSprog|Tekst)\.([A-Za-zéø]+)/g)].map(m => m[1] + '.' + m[2]);
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
  tjek('2.1.0: de 26 nye farver findes i lyst og mørkt tema (i alt 54 fra 2.4.0)', mangler.length === 0 && tokens.color.tokens.length === 54, mangler.join(', '));
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

// ── Pakke 2.2.0 (K5–K9): skallen. Flere visninger, vælger, regel for træet, sidepanel, bånd uden faner og segmentknap ──
{
  // Intet er omdøbt eller fjernet i forhold til 2.0.0: listerne er læst fra 2.0.0 (git show 64c0cce:design/ui-kit-2/pakke/web/kit.css
  // og kit.js, tema.js, sprogmotor.js) og står her som faste lister. V200_UDSEENDE er det, 2.0.0's kit.js byggede af de
  // tre eksempler i bygEksempler herunder (et bånd med to faner, seks visninger, et træ).
  const V200_KLASSER = ["ant","arb","ban","btn","cap","cb","chip","cmd","danger","done","fejl","fejltekst","felt","fl","flade","flet","fod","fodl","ghost","grp","gruppe","grupper","gv","h","hj","hoejre","ik","indhold","info","kn","label","luft","midte","mono","mrk","muted","n","nav","none","now","ok","on","ord","pri","primary","r","rk","s","sel","skift","skjult-tekst","soeg","t","tab","tabel","tabs","titel","tr","trae","trin","vindue","vl","vs","warn","wiz"];
  const V200_FUNKTIONER = ["Kit.IKONER","Kit.ikon","Kit.registrerIkoner","Kit.chip","Kit.knap","Kit.felt","Kit.banner","Kit.tabel","Kit.commandBar","Kit.navTrae","Kit.visningsskift","Kit.guide","Kit.fletbaand","Kit.SYMBOL","Tema.VALG","Tema.valg","Tema.saet","KitSprog.opret"];
  const V200_IKONER = ["indsaet","fil","soeg","skjold","kopier","oeje","mappe","bog","gem","plus","aabn","eksport","import","slet","afspil","sol","maane","skaerm","sprog","laas","tandhjul","ned","hoejre","filter","luk","rediger","kalender"];
  const V200_UDSEENDE = {"baand":"<div class=\"cmd\"><div class=\"tabs\" role=\"tablist\" data-t-aria=\"cmdAria\"><button class=\"tab\" data-t=\"faneStart\" type=\"button\" id=\"kit-cb1-fane-start\" role=\"tab\" aria-controls=\"kit-cb1-panel-start\" data-fane=\"start\" aria-selected=\"false\" tabindex=\"-1\"></button><button class=\"tab on\" data-t=\"faneVis\" type=\"button\" id=\"kit-cb1-fane-vis\" role=\"tab\" aria-controls=\"kit-cb1-panel-vis\" data-fane=\"vis\" aria-selected=\"true\" tabindex=\"0\"></button></div><div class=\"grupper\" id=\"kit-cb1-panel-start\" role=\"tabpanel\" aria-labelledby=\"kit-cb1-fane-start\" data-fane=\"start\" hidden=\"\"><div class=\"grp\" role=\"group\" aria-labelledby=\"kit-cb1-grp-1\"><div class=\"kn\"><button class=\"cb pri\" type=\"button\" data-kommando=\"aabn\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M6 3h8l4 4v14H6z\"></path><path d=\"M14 3v4h4\"></path></svg><span data-t=\"kAabn\"></span></button><button class=\"cb\" type=\"button\" data-kommando=\"kopier\" aria-disabled=\"true\" data-t-title=\"hvorfor\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><rect x=\"8\" y=\"8\" width=\"12\" height=\"12\" rx=\"2\"></rect><path d=\"M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2\"></path></svg><span data-t=\"kKopier\"></span></button></div><span class=\"cap\" data-t=\"gFil\" id=\"kit-cb1-grp-1\"></span></div></div><div class=\"grupper\" id=\"kit-cb1-panel-vis\" role=\"tabpanel\" aria-labelledby=\"kit-cb1-fane-vis\" data-fane=\"vis\"><div class=\"grp\" role=\"group\" aria-labelledby=\"kit-cb1-grp-2\"><div class=\"kn\"><button class=\"cb\" type=\"button\" data-kommando=\"lys\" aria-pressed=\"true\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><circle cx=\"12\" cy=\"12\" r=\"4\"></circle><path d=\"M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4\"></path></svg><span data-t=\"kLys\"></span></button><button class=\"cb\" type=\"button\" data-kommando=\"moerk\" aria-pressed=\"false\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z\"></path></svg><span data-t=\"kMoerk\"></span></button></div><span class=\"cap\" data-t=\"gTema\" id=\"kit-cb1-grp-2\"></span></div></div></div>","skift":"<div class=\"skift\" role=\"group\" data-t-aria=\"visninger\"><a class=\"vs\" href=\"#v1\" data-visning=\"v1\" aria-keyshortcuts=\"Meta+1\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M3 7h6l2 2h10v10H3z\"></path></svg><span data-t=\"v1\"></span><kbd aria-hidden=\"true\">⌘1</kbd></a><a class=\"vs on\" href=\"#v2\" data-visning=\"v2\" aria-keyshortcuts=\"Meta+2\" aria-current=\"page\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M3 7h6l2 2h10v10H3z\"></path></svg><span data-t=\"v2\"></span><kbd aria-hidden=\"true\">⌘2</kbd></a><a class=\"vs\" href=\"#v3\" data-visning=\"v3\" aria-keyshortcuts=\"Meta+3\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M3 7h6l2 2h10v10H3z\"></path></svg><span data-t=\"v3\"></span><kbd aria-hidden=\"true\">⌘3</kbd></a><a class=\"vs\" href=\"#v4\" data-visning=\"v4\" aria-keyshortcuts=\"Meta+4\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M3 7h6l2 2h10v10H3z\"></path></svg><span data-t=\"v4\"></span><kbd aria-hidden=\"true\">⌘4</kbd></a><a class=\"vs\" href=\"#v5\" data-visning=\"v5\" aria-keyshortcuts=\"Meta+5\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M3 7h6l2 2h10v10H3z\"></path></svg><span data-t=\"v5\"></span><kbd aria-hidden=\"true\">⌘5</kbd></a><a class=\"vs\" href=\"#v6\" data-visning=\"v6\" aria-keyshortcuts=\"Meta+6\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M3 7h6l2 2h10v10H3z\"></path></svg><span data-t=\"v6\"></span><kbd aria-hidden=\"true\">⌘6</kbd></a></div>","trae":"<ul class=\"trae\" role=\"tree\" data-t-aria=\"traeAria\"><li role=\"none\"><button class=\"tr\" type=\"button\" data-punkt=\"alle\" role=\"treeitem\" aria-level=\"1\" tabindex=\"-1\" aria-expanded=\"true\" aria-selected=\"false\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M6 9l6 6 6-6\"></path></svg><span data-t=\"tAlle\"></span><span class=\"ant\">3</span></button><ul role=\"group\"><li role=\"none\"><button class=\"tr on\" type=\"button\" data-punkt=\"a\" role=\"treeitem\" aria-level=\"2\" tabindex=\"0\" aria-current=\"true\" aria-selected=\"true\"><span data-t=\"tA\"></span><span class=\"ant\">1</span></button></li></ul></li></ul>"};
  const css = pk('web/kit.css'), kitJs = pk('web/kit.js');
  const cssUden = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@font-face\s*\{[^}]*\}/g, '').replace(/\{[^}]*\}/g, ' ');
  const cssKlasser = new Set([...cssUden.matchAll(/\.([a-z][a-z0-9-]*)/g)].map(m => m[1]));
  const ny = () => {
    const dom = new JSDOM('<!doctype html><html data-kit-praefiks="proeve"><body></body></html>', { runScripts: 'outside-only', url: 'http://kit.invalid/', pretendToBeVisual: true });
    for (const f of ['tema.js', 'sprogmotor.js', 'kit.js']) dom.window.eval(pk('web/' + f));
    return dom.window;
  };
  const w = ny(), d = w.document, K = w.Kit;
  const fn = [...Object.keys(w.Kit).map(k => 'Kit.' + k), ...Object.keys(w.Tema).map(k => 'Tema.' + k), ...Object.keys(w.KitSprog).map(k => 'KitSprog.' + k)];
  const mKl = V200_KLASSER.filter(k => !cssKlasser.has(k)), mFn = V200_FUNKTIONER.filter(f => !fn.includes(f)), mIk = V200_IKONER.filter(i => !(i in K.IKONER));
  tjek('2.2.0: hver klasse i kit.css fra 2.0.0 findes stadig (65)', V200_KLASSER.length === 65 && mKl.length === 0, mKl.join(', '));
  tjek('2.2.0: hver funktion i Kit, Tema og KitSprog fra 2.0.0 findes stadig (18)', V200_FUNKTIONER.length === 18 && mFn.length === 0, mFn.join(', '));
  tjek('2.2.0: hvert ikon fra 2.0.0 findes stadig (27), og der er ingen nye', V200_IKONER.length === 27 && mIk.length === 0 && JSON.stringify(Object.keys(K.IKONER)) === JSON.stringify(V200_IKONER), mIk.join(', '));
  tjek('2.2.0: de nye navne er Kit.vaelger, Kit.sidepanel og Kit.segment (og fra 2.3.0 og 2.4.0 kun dem i V230_FUNKTIONER og V240_FUNKTIONER)', JSON.stringify(fn.filter(f => !V200_FUNKTIONER.includes(f) && !V230_FUNKTIONER.includes(f) && !V240_FUNKTIONER.includes(f))) === JSON.stringify(['Kit.vaelger', 'Kit.sidepanel', 'Kit.segment']), fn.filter(f => !V200_FUNKTIONER.includes(f)).join(', '));
  const nyeKl = ['enkel', 'baand-el', 'taet', 'vlg', 'vlg-knap', 'vlg-vaerdi', 'vlg-pop', 'op', 'hoejre-kant', 'vlg-soeg', 'vlg-liste', 'vlg-p', 'aktiv', 'vlg-mark', 'vlg-boks', 'vlg-alle', 'vlg-navn', 'vlg-ingen', 'sidepanel', 'over', 'sp-top', 'sp-luk', 'sp-indhold', 'seg', 'seg-v'];
  tjek('2.2.0: kit.css har de 25 nye klasser og ingen andre nye (ud over dem i V230_KLASSER fra 2.3.0 og V240_KLASSER fra 2.4.0)', nyeKl.length === 25 && JSON.stringify([...cssKlasser].filter(k => !V200_KLASSER.includes(k) && !V230_KLASSER.includes(k) && !V240_KLASSER.includes(k)).sort()) === JSON.stringify([...nyeKl].sort()), [...cssKlasser].filter(k => !V200_KLASSER.includes(k)).join(', '));
  function bygEksempler(K2, d2) {
    const b = d2.createElement('div');
    K2.commandBar(b, { ariaT: 'cmdAria', valgt: 'vis', faner: [
      { id: 'start', t: 'faneStart', grupper: [{ t: 'gFil', knapper: [{ id: 'aabn', t: 'kAabn', ikon: 'fil', pri: true }, { id: 'kopier', t: 'kKopier', ikon: 'kopier', deaktiveret: true, hvorfor: 'hvorfor' }] }] },
      { id: 'vis', t: 'faneVis', grupper: [{ t: 'gTema', knapper: [{ id: 'lys', t: 'kLys', ikon: 'sol', trykket: true }, { id: 'moerk', t: 'kMoerk', ikon: 'maane', trykket: false }] }] },
    ] });
    const s = d2.createElement('div');
    K2.visningsskift(s, [1, 2, 3, 4, 5, 6].map(i => ({ id: 'v' + i, t: 'v' + i, ikon: 'mappe', genvej: '⌘' + i, genvejAria: 'Meta+' + i })), { ariaT: 'visninger' }).markér('v2');
    const t = d2.createElement('ul');
    K2.navTrae(t, [{ id: 'alle', t: 'tAlle', antal: 3, boern: [{ id: 'a', t: 'tA', antal: 1 }] }], { ariaT: 'traeAria', valgt: 'a' });
    return { baand: b.outerHTML, skift: s.outerHTML, trae: t.outerHTML };
  }
  const w2 = ny(), nu = bygEksempler(w2.Kit, w2.document);
  tjek('2.2.0 (K9): et bånd med to faner bygges præcis som i 2.0.0 (samme markup, byte for byte; Grimnirs bånd har to faner)', nu.baand === V200_UDSEENDE.baand);
  tjek('2.2.0 (K5): seks visninger bygges præcis som i 2.0.0 (ingen taet)', nu.skift === V200_UDSEENDE.skift && !/taet/.test(nu.skift));
  tjek('2.2.0 (K7): træet bygges præcis som i 2.0.0', nu.trae === V200_UDSEENDE.trae);
  tjek('2.2.0: kittet sætter ingen inline-stil (Grimnirs CSP er style-src \'self\', og dets UI-test forbyder .style.)', !/\.style\.|setAttribute\(\s*['"]style['"]|\.cssText/.test(kitJs));

  // ── K5: op til otte visninger ──
  const vis = n => Array.from({ length: n }, (_, i) => ({ id: 'v' + i, tekst: 'Visning ' + (i + 1), ikon: 'mappe', genvej: String(i + 1) }));
  const s7 = d.createElement('div'), s8 = d.createElement('div'), s9 = d.createElement('div');
  K.visningsskift(s7, vis(7));
  const skift8 = K.visningsskift(s8, vis(8));
  skift8.markér('v7');
  let fejl9 = '';
  try { K.visningsskift(s9, vis(9)); } catch (e) { fejl9 = String(e.message); }
  tjek('K5: syv og otte visninger virker og får klassen taet; otte links med aria-current på den aktive', s7.classList.contains('taet') && s8.className === 'skift taet' && s8.querySelectorAll('a.vs').length === 8 && s8.querySelector('[aria-current="page"]').dataset.visning === 'v7');
  tjek('K5: ni afvises tydeligt med en fejl (som et ukendt ikon), og elementet røres ikke', /højst otte visninger \(fik 9\)/.test(fejl9) && s9.outerHTML === '<div></div>', fejl9);
  tjek('K5: et skift, der bygges om fra otte til seks, mister taet', (() => { K.visningsskift(s8, vis(6)); return !s8.classList.contains('taet') && s8.classList.contains('skift'); })());
  // Det mindste vindue, kittet lover (.vindue), og målene i kit.css og tokens.css. Regnet her; jsdom tegner ikke.
  const tcss = pk('tokens/tokens.css');
  const tok = n => Number((new RegExp(`--${n}: (\\d+)px;`).exec(tcss) || [])[1]);
  const regel = (vaelger, egenskab) => {
    const m = new RegExp('(?:^|\\n)' + vaelger.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ' \\{([^}]*)\\}').exec(css);
    const v = m && new RegExp('(?:^|[;\\s])' + egenskab + ': ([^;]+);').exec(m[1]);
    if (!v) return NaN;
    const x = v[1].trim(), t = /^var\(--([a-z0-9-]+)\)$/.exec(x);
    return t ? tok(t[1]) : parseFloat(x);
  };
  const vindue = /\.vindue \{[^}]*min-width: (\d+)px; min-height: (\d+)px;/.exec(css);
  const [minB, minH] = [Number(vindue[1]), Number(vindue[2])];
  const titel = regel('.titel', 'height');
  const baand = regel('.tab', 'height') + 1 + tok('space-2') + tok('space-1') + regel('.cb', 'height') + 2 + 14 + 1;
  const h3 = tok('space-3') + tok('space-2') + tok('h3-line');
  const vsTaet = regel('.skift.taet .vs', 'height');
  const skiftH = 1 + 2 * tok('space-1') + 8 * vsTaet + 7 * 1;
  const traeH = minH - titel - baand - h3 - skiftH;
  const tretr = 3 * regel('.tr', 'height') + 2 * 1 + tok('space-3');
  tjek(`K5: ved det mindste vindue (${minB} × ${minH}) er der plads til otte visninger og mindst tre punkter i træet (titel ${titel} + bånd ${baand} + overskrift ${h3} + skift ${skiftH}; træet får ${traeH} px, tre punkter kræver ${tretr})`,
    minB === 900 && minH === 560 && titel === 34 && baand === 116 && h3 === 40 && vsTaet === 30 && skiftH === 256 && traeH === 114 && traeH >= tretr, [titel, baand, h3, vsTaet, skiftH, traeH, tretr].join('/'));
  tjek('K5: seks visninger er stadig 38 px (uændret), og 30 px er over WCAG 2.5.8 (24 px)', regel('.vs', 'height') === 38 && vsTaet >= 24);
  const navB = Number(/\.nav \{[^}]*width: (\d+)px;/.exec(css)[1]);
  const tekstB = navB - 1 - 2 * tok('space-1') - 2 * tok('space-3') - 18 - tok('space-3') - tok('space-3') - Math.ceil(2 * 11 * 0.6);
  const tegn = Math.floor(tekstB / (13 * 0.62));
  tjek(`K5: navnet har ${tekstB} px i bredden, det er ${tegn} tegn à 0,62 em i 13 px; et længere navn afkortes med … (ingen ombrydning ud af punktet)`, tekstB === 143 && tegn === 17 && /\.skift\.taet \.vs > span \{[^}]*text-overflow: ellipsis;[^}]*white-space: nowrap;/.test(css));
  tjek('K5: kontrol: de længste navne i Huginn and Muninns visningsskift kan stå uafkortet (Indstillinger, Since last time, Land lige nu)', ['Indstillinger', 'Since last time', 'Land lige nu', 'Besøgende', 'Technology'].every(n => n.length <= tegn));
  const md = pk('KOMPONENTER.md');
  const afsnitAf = navn => { const i = md.indexOf('\n## ' + navn + '\n'); return md.slice(i, md.indexOf('\n## ', i + 1)); };
  const navpane = afsnitAf('NavPane');
  tjek('K5: KOMPONENTER.md: reglen er højst otte (ikke seks), ni giver en fejl, og anbefalingen (Indstillinger i titellinjen, opsætningsguide i Wizard) og det mindste vindue står der', /Højst otte visninger/.test(navpane) && !/Højst seks visninger/.test(navpane) && /Ni eller flere giver en fejl/.test(navpane) && /Indstillinger hører til i titellinjen/.test(navpane) && /opsætningsguide hører til i Wizard/.test(navpane) && /900 × 560 px/.test(navpane) && /17 tegn/.test(navpane) && /\(højst otte, altid samme rækkefølge\)/.test(kitJs));

  // ── K7: træet vælger ét punkt ──
  tjek('K7: reglen står under NavPane og under Vælger: træet vælger ét punkt, "et, flere eller alle" hører til i vælgeren', /Træet vælger ét punkt/.test(navpane) && /"Et, flere eller alle"/.test(navpane) && /hører til i en vælger med flere valg/.test(navpane) && /Det er ikke en valgliste i en formular/.test(afsnitAf('Vælger')) && /flere valg/.test(afsnitAf('Vælger')));
  tjek('K7: navTrae er uændret i koden (ingen afkrydsning, ét valgt punkt)', (() => {
    const ul = d.createElement('ul');
    const t = K.navTrae(ul, [{ id: 'a', tekst: 'A' }, { id: 'b', tekst: 'B' }]);
    t.vaelg('b');
    return ul.querySelectorAll('[aria-selected="true"]').length === 1 && !ul.querySelector('input,[role="checkbox"],[aria-checked]') && !ul.hasAttribute('aria-multiselectable');
  })());

  // ── K6: vælger ──
  const tast = (el, key, x = {}) => el.dispatchEvent(new w.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...x }));
  const mus = (el, type) => el.dispatchEvent(new w.MouseEvent(type, { bubbles: true, cancelable: true }));
  const aktivt = v => d.getElementById(v.liste.getAttribute('aria-activedescendant'));
  const navn = li => li.querySelector('.vlg-navn').textContent;
  const PUNKTER = [{ id: 'dk', tekst: 'Danmark', antal: 12 }, { id: 'se', tekst: 'Sverige' }, { id: 'no', tekst: 'Norge' }, { id: 'de', tekst: 'Tyskland' }, { id: 'fi', tekst: 'Finland' }];
  const kald = [];
  const v1 = K.vaelger({ etiket: 'Land', punkter: PUNKTER, valgt: 'se', vedValg: x => kald.push(x) });
  d.body.appendChild(v1.rod);
  tjek('K6: knappen har aria-haspopup="listbox", aria-expanded="false" og aria-controls til listen, og viser etiket og den aktuelle værdi', v1.knap.getAttribute('aria-haspopup') === 'listbox' && v1.knap.getAttribute('aria-expanded') === 'false' && v1.knap.getAttribute('aria-controls') === v1.liste.id && v1.knap.querySelector('.skjult-tekst').textContent === 'Land' && v1.knap.querySelector('.vlg-vaerdi').textContent === 'Sverige' && v1.knap.type === 'button');
  tjek('K6 (ét valg): listen er role="listbox" uden aria-multiselectable, navngivet af etiketten; punkterne er role="option" med aria-selected', v1.liste.getAttribute('role') === 'listbox' && !v1.liste.hasAttribute('aria-multiselectable') && v1.liste.getAttribute('aria-labelledby') === v1.knap.querySelector('.skjult-tekst').id && [...v1.liste.children].every(li => li.getAttribute('role') === 'option') && [...v1.liste.children].map(li => li.getAttribute('aria-selected')).join() === 'false,true,false,false,false' && v1.liste.querySelector('.ant').textContent === '12');
  tast(v1.knap, 'ArrowDown');
  tjek('K6: pil ned på knappen åbner; fokus går til listen, og det valgte punkt er aktivt (aria-activedescendant, .aktiv)', v1.aaben && v1.knap.getAttribute('aria-expanded') === 'true' && d.activeElement === v1.liste && navn(aktivt(v1)) === 'Sverige' && aktivt(v1).classList.contains('aktiv'));
  tast(v1.liste, 'ArrowDown'); tast(v1.liste, 'ArrowDown');
  const efterPile = navn(aktivt(v1));
  tast(v1.liste, 'End'); const efterEnd = navn(aktivt(v1));
  tast(v1.liste, 'Home'); const efterHome = navn(aktivt(v1));
  tast(v1.liste, 'ArrowUp'); const vedToppen = navn(aktivt(v1));
  tjek('K6: pilene flytter (og stopper ved enderne), Home og End går til første og sidste', efterPile === 'Tyskland' && efterEnd === 'Finland' && efterHome === 'Danmark' && vedToppen === 'Danmark' && kald.length === 0);
  tast(v1.liste, 't');
  const efterT = navn(aktivt(v1));
  tast(v1.liste, 'n');
  tjek('K6: et bogstav hopper til næste punkt, der begynder med det', efterT === 'Tyskland' && navn(aktivt(v1)) === 'Norge');
  tast(v1.liste, 'Enter');
  tjek('K6 (ét valg): Enter vælger, listen lukker, fokus går tilbage til knappen, og vedValg får id', !v1.aaben && v1.knap.getAttribute('aria-expanded') === 'false' && d.activeElement === v1.knap && v1.valgt === 'no' && JSON.stringify(kald) === '["no"]' && v1.knap.querySelector('.vlg-vaerdi').textContent === 'Norge');
  tast(v1.knap, 'ArrowDown'); tast(v1.liste, 'ArrowDown'); tast(v1.liste, 'Escape');
  tjek('K6: Esc lukker uden at vælge og giver fokus tilbage til knappen', !v1.aaben && d.activeElement === v1.knap && v1.valgt === 'no' && kald.length === 1);
  v1.knap.click();
  const aabnetMedKlik = v1.aaben;
  tast(v1.liste, ' ');
  tjek('K6: klik åbner, og mellemrum vælger ved ét valg (samme punkt igen: ingen vedValg)', aabnetMedKlik && !v1.aaben && kald.length === 1);
  v1.knap.click();
  v1.liste.children[0].click();
  tjek('K6: klik på et punkt vælger det', v1.valgt === 'dk' && !v1.aaben && JSON.stringify(kald) === '["no","dk"]');
  v1.knap.click(); mus(v1.knap, 'mousedown'); v1.knap.click();
  tjek('K6: klik på knappen lukker en åben liste (også hvor knappen ikke får fokus ved klik)', !v1.aaben);
  v1.knap.click();
  const ude = d.createElement('button'); d.body.appendChild(ude);
  mus(ude, 'mousedown');
  tjek('K6: et klik uden for lukker listen', !v1.aaben);
  v1.knap.click();
  v1.liste.dispatchEvent(new w.FocusEvent('focusout', { bubbles: true, relatedTarget: ude }));
  tjek('K6: når fokus går uden for (Tab), lukker listen', !v1.aaben);
  v1.saetPunkter([{ id: 'x', tekst: 'Xland' }, { id: 'y', tekst: 'Yland' }], 'y');
  v1.saetValgt('x');
  tjek('K6: saetPunkter og saetValgt sætter værdier og valg udefra uden at kalde vedValg; et ukendt valg giver første punkt', v1.liste.children.length === 2 && v1.valgt === 'x' && v1.knap.querySelector('.vlg-vaerdi').textContent === 'Xland' && kald.length === 2 && (v1.saetValgt('findes-ikke'), v1.valgt === 'x'));
  // Tekster som nøgler: knappen arver punktets data-t, så sprogskift udfylder den.
  const vt = K.vaelger({ etiket: { t: 'eti' }, punkter: [{ id: 'a', t: 'pA' }], valgt: 'a' });
  tjek('K6: nøgler giver data-t på etiket, punkter og knappens værdi (kittet har ingen tekster)', vt.knap.querySelector('.skjult-tekst').getAttribute('data-t') === 'eti' && vt.liste.querySelector('.vlg-navn').getAttribute('data-t') === 'pA' && vt.knap.querySelector('.vlg-vaerdi').getAttribute('data-t') === 'pA');

  const kaldF = [];
  const v2 = K.vaelger({ etiket: 'Domæner', flere: true, alle: 'Alle domæner', nValgt: { t: 'nValgt' }, soeg: { ph: 'soegPh', aria: 'Søg i domænerne' }, ingen: 'Ingen passer',
    punkter: [{ id: 'a', tekst: 'eksempel.dk' }, { id: 'b', tekst: 'shop.eksempel.dk' }, { id: 'c', tekst: 'blog.eksempel.dk' }], valgt: ['a', 'b', 'c'], vedValg: x => kaldF.push(x) });
  d.body.appendChild(v2.rod);
  const alle = v2.liste.querySelector('.vlg-alle'), felt = v2.rod.querySelector('.vlg-soeg input');
  tjek('K6 (flere valg): aria-multiselectable, "Alle" øverst og valgt, afkrydsningsbokse, og knappen viser alle-teksten', v2.liste.getAttribute('aria-multiselectable') === 'true' && v2.liste.firstElementChild === alle && alle.getAttribute('aria-selected') === 'true' && v2.liste.querySelectorAll('.vlg-boks').length === 4 && v2.knap.querySelector('.vlg-vaerdi').textContent === 'Alle domæner');
  v2.knap.click();
  tjek('K6: med søgefelt går fokus til feltet ved åbning; feltet styrer listen (aria-controls, aria-activedescendant) og har programmets tekster', d.activeElement === felt && felt.getAttribute('aria-controls') === v2.liste.id && felt.getAttribute('aria-activedescendant') === aktivt(v2).id && felt.getAttribute('data-t-ph') === 'soegPh' && felt.getAttribute('aria-label') === 'Søg i domænerne' && felt.spellcheck === false);
  tast(felt, 'ArrowDown'); tast(felt, 'Enter');
  tjek('K6 (flere valg): Enter krydser af, listen bliver åben, vedValg får listen af id, og knappen viser "N valgt" (nøgle med data-v)', v2.aaben && JSON.stringify(kaldF.at(-1)) === '["a","c"]' && alle.getAttribute('aria-selected') === 'false' && v2.knap.querySelector('.vlg-vaerdi').getAttribute('data-t') === 'nValgt' && v2.knap.querySelector('.vlg-vaerdi').getAttribute('data-v') === '2');
  tast(felt, ' ');
  tjek('K6: mellemrum i søgefeltet skrives (krydser ikke af)', kaldF.length === 1);
  v2.liste.focus(); tast(v2.liste, ' ');
  tjek('K6 (flere valg): mellemrum i listen krydser af', JSON.stringify(kaldF.at(-1)) === '["a","b","c"]' && alle.getAttribute('aria-selected') === 'true' && v2.aaben);
  alle.click();
  tjek('K6 (flere valg): "Alle" fravælger alle, når alle er valgt, og vælger alle ellers', JSON.stringify(kaldF.at(-1)) === '[]' && (alle.click(), JSON.stringify(kaldF.at(-1)) === '["a","b","c"]'));
  v2.liste.children[2].click(); v2.liste.children[3].click();
  tjek('K6 (flere valg): ét valgt viser det ene navn', JSON.stringify(v2.valgt) === '["a"]' && v2.knap.querySelector('.vlg-vaerdi').textContent === 'eksempel.dk' && !v2.knap.querySelector('.vlg-vaerdi').hasAttribute('data-t'));
  felt.value = 'shop'; felt.dispatchEvent(new w.Event('input', { bubbles: true }));
  const synligeP = () => [...v2.liste.children].filter(li => !li.hidden).map(navn);
  const ingenP = v2.rod.querySelector('.vlg-ingen');
  tjek('K6: søgefeltet filtrerer, skjuler "Alle" under søgning og gør det første synlige punkt aktivt', JSON.stringify(synligeP()) === '["shop.eksempel.dk"]' && alle.hidden && navn(aktivt(v2)) === 'shop.eksempel.dk' && ingenP.hidden);
  felt.value = 'zzz'; felt.dispatchEvent(new w.Event('input', { bubbles: true }));
  tjek('K6: når intet passer, vises programmets tekst for ingen, og intet er aktivt', synligeP().length === 0 && !ingenP.hidden && !v2.liste.hasAttribute('aria-activedescendant'));
  tast(felt, 'Escape');
  tjek('K6: Esc lukker også fra søgefeltet, og feltet er tomt næste gang', !v2.aaben && d.activeElement === v2.knap && (v2.knap.click(), felt.value === '' && synligeP().length === 4));
  v2.luk();
  // Placering: listen åbner opad og står ved knappens højre kant, når der ikke er plads; kun klasser (ingen inline-stil).
  const placer = (k, p, vb, vh) => {
    Object.defineProperty(w, 'innerWidth', { value: vb, configurable: true });
    Object.defineProperty(w, 'innerHeight', { value: vh, configurable: true });
    v1.knap.getBoundingClientRect = () => ({ left: k[0], top: k[1], right: k[0] + k[2], bottom: k[1] + 26, width: k[2], height: 26 });
    v1.rod.querySelector('.vlg-pop').getBoundingClientRect = () => ({ left: 0, top: 0, right: p[0], bottom: p[1], width: p[0], height: p[1] });
    v1.knap.click();
    const pop = v1.rod.querySelector('.vlg-pop'), ud = [pop.classList.contains('op'), pop.classList.contains('hoejre-kant'), pop.hasAttribute('style')];
    v1.luk();
    return ud.join();
  };
  tjek('K6: i titellinjen til højre (900 × 560): listen står under knappen og ved dens højre kant, så vinduets kant ikke klipper den', placer([800, 4, 90], [240, 220], 900, 560) === 'false,true,false');
  tjek('K6: til venstre øverst: under og ved knappens venstre kant', placer([20, 4, 120], [240, 220], 900, 560) === 'false,false,false');
  tjek('K6: nederst i vinduet: listen åbner opad', placer([20, 500, 120], [240, 220], 900, 560) === 'true,false,false');
  tjek('K6 (CSS): listen ligger over siden (absolute, z-index) under knappen, opad med .op, ved højre kant med .hoejre-kant, højst 360 px og et halvt vindue minus 48 px, og rulles', /\.vlg \{ position: relative;/.test(css) && /\.vlg-pop \{\s*position: absolute; top: calc\(100% \+ 4px\); left: 0; z-index: 20;[^}]*max-height: min\(360px, calc\(50vh - 48px\)\);/.test(css) && /\.vlg-pop\.op \{ top: auto; bottom: calc\(100% \+ 4px\); \}/.test(css) && /\.vlg-pop\.hoejre-kant \{ left: auto; right: 0; \}/.test(css) && /\.vlg-liste \{[^}]*min-height: 0; overflow: auto;/.test(css));
  tjek('K6 (CSS): titellinjen, værktøjslinjen og båndet klipper ikke listen (ingen overflow i .titel, .hoejre, .vl, .cmd, .grupper, .grp, .kn, .baand-el)', ['.titel', '.titel .hoejre', '.vl', '.cmd', '.grupper', '.grp', '.grp .kn', '.baand-el'].every(v => { const m = new RegExp('(?:^|\\n)' + v.replace(/\./g, '\\.') + ' \\{([^}]*)\\}').exec(css); return m && !/overflow/.test(m[1]); }));
  tjek('K6 (CSS): udseendet følger fladen: lys knap med kant (surface, border-strong) og mørk på titellinjen (rail, rail-text; hover rail-active, rail-strong)', /\.vlg-knap \{[^}]*border: 1px solid var\(--border-strong\);[^}]*background: var\(--surface\); color: var\(--text\);/.test(css) && /\.titel \.vlg-knap \{[^}]*border-color: var\(--rail-text\); background: var\(--rail\); color: var\(--rail-text\);/.test(css) && /\.titel \.vlg-knap:hover, \.titel \.vlg-knap\[aria-expanded="true"\] \{ background: var\(--rail-active\); color: var\(--rail-strong\); \}/.test(css));
  tjek('K6 (CSS): valgt er aldrig farve alene (flueben og fed skrift; afkrydset boks), og det aktive punkt har fokusringen i info', /\.vlg-p\[aria-selected="true"\] \{ font-weight: 600; \}/.test(css) && /\.vlg-p\[aria-selected="true"\] \.vlg-mark \{ visibility: visible; \}/.test(css) && /\.vlg-p\[aria-selected="true"\] \.vlg-boks \{ background: var\(--accent\); border-color: var\(--accent\); color: var\(--on-accent\); \}/.test(css) && /\.vlg-pop:focus-within \.vlg-p\.aktiv \{ outline: 2px solid var\(--info\);/.test(css));

  // ── K8: sidepanel ──
  const midte = d.createElement('div');
  midte.className = 'midte';
  midte.innerHTML = '<main class="arb"><button id="sp-aabner" aria-controls="sp-proeve" aria-expanded="false">?</button><button id="sp-andet">x</button></main><aside id="sp-proeve"></aside>';
  d.body.appendChild(midte);
  const spLuk = [];
  const aside = d.getElementById('sp-proeve'), aabner = d.getElementById('sp-aabner');
  const sp = K.sidepanel(aside, { tekst: 'Hjælp', lukAria: 'Luk hjælpen', indhold: d.createTextNode('Forklaring'), vedLuk: a => spLuk.push(a) });
  const h = aside.querySelector('.sp-top h2'), lukK = aside.querySelector('.sp-luk');
  tjek('K8: role="complementary" med navn fra overskriften, lukkeknap med navn, indhold, og lukket fra start', aside.getAttribute('role') === 'complementary' && aside.getAttribute('aria-labelledby') === h.id && h.textContent === 'Hjælp' && lukK.getAttribute('aria-label') === 'Luk hjælpen' && lukK.type === 'button' && sp.indhold.textContent === 'Forklaring' && aside.hidden && !sp.aaben && !aside.hasAttribute('aria-modal'));
  const bredde = b => Object.defineProperty(w, 'innerWidth', { value: b, configurable: true });
  bredde(1400); aabner.focus(); sp.aabn();
  tjek('K8: åbnes ved bredt vindue (1400 px): skubber (ingen .over), fokus på overskriften, aria-expanded="true" på knappen, der styrer det', sp.aaben && !sp.overlagt && !aside.classList.contains('over') && d.activeElement === h && aabner.getAttribute('aria-expanded') === 'true');
  bredde(1000); w.dispatchEvent(new w.Event('resize'));
  tjek('K8: under grænsen (1000 < 1200 px) lægger det sig over (.over), også når vinduet ændres, mens det er åbent', sp.overlagt && aside.classList.contains('over'));
  bredde(1200); w.dispatchEvent(new w.Event('resize'));
  tjek('K8: grænsen er 1200 px: ved præcis 1200 skubber det', !sp.overlagt);
  tast(h, 'Escape');
  tjek('K8: Esc i panelet lukker; fokus går tilbage til det, der åbnede; vedLuk("esc"); aria-expanded="false"', !sp.aaben && aside.hidden && d.activeElement === aabner && spLuk.join() === 'esc' && aabner.getAttribute('aria-expanded') === 'false');
  aabner.focus(); sp.aabn(); lukK.focus(); lukK.click();
  tjek('K8: lukkeknappen lukker, og fokus går tilbage (vedLuk("knap"))', !sp.aaben && d.activeElement === aabner && spLuk.at(-1) === 'knap');
  bredde(1400); sp.aabn(); d.getElementById('sp-andet').focus();
  tast(d.getElementById('sp-andet'), 'Escape');
  tjek('K8: ikke modalt: når panelet skubber, kan resten bruges, og Esc uden for panelet lukker det ikke', sp.aaben && d.activeElement === d.getElementById('sp-andet'));
  sp.luk();
  tjek('K8: luk() fra koden flytter ikke fokus, når fokus ikke var i panelet (vedLuk("kode"))', !sp.aaben && d.activeElement === d.getElementById('sp-andet') && spLuk.at(-1) === 'kode');
  bredde(1000); sp.aabn(); d.getElementById('sp-andet').focus();
  tjek('K8: når panelet ligger over, fanges fokus ikke (fokus kan gå uden for)', sp.aaben && sp.overlagt && d.activeElement === d.getElementById('sp-andet'));
  tast(d.getElementById('sp-andet'), 'Escape');
  tjek('K8: når panelet ligger over, lukker Esc også uden for panelet', !sp.aaben && spLuk.at(-1) === 'esc');
  const aside2 = d.createElement('aside'); midte.appendChild(aside2);
  const sp2 = K.sidepanel(aside2, { tekst: 'Detaljer', lukAria: 'Luk', overlaeg: true });
  bredde(1600); sp2.aabn();
  tjek('K8: overlaeg: true lægger altid over (også ved 1600 px); id gives, hvis elementet ikke har et', sp2.overlagt && /^kit-sp\d+$/.test(aside2.id) && (sp2.skift(), !sp2.aaben));
  tjek('K8 (CSS): 320 px i rækken (skubber); .over ligger over med skygge; .midte bliver positioneret kun med et sidepanel (Grimnirs .midte er uændret); indholdet ruller', /\.sidepanel \{[^}]*width: 320px;[^}]*flex: none;/.test(css) && /\.sidepanel\.over \{ position: absolute; top: 0; right: 0; bottom: 0; z-index: 10; box-shadow: var\(--shadow-pop\); \}/.test(css) && /\.midte:has\(> \.sidepanel\) \{ position: relative; \}/.test(css) && /(?:^|\n)\.midte \{ display: flex; flex: 1; min-height: 0; \}/.test(css) && /\.sp-indhold \{[^}]*min-height: 0; overflow: auto;/.test(css));
  tjek('K8: grænsen 1200 px står i koden og i KOMPONENTER.md', /const SP_GRAENSE = 1200;/.test(kitJs) && /smallere end \*\*1200 px\*\*/.test(afsnitAf('Sidepanel')));

  // ── K9: bånd uden faner og segmentknap ──
  const seg = K.segment({ aria: 'Periode', valg: [{ id: '7', tekst: '7 dage' }, { id: '30', tekst: '30 dage' }, { id: 'aar', tekst: 'År' }], valgt: '30', vedValg: x => kald.push('seg:' + x) });
  const vb = K.vaelger({ etiket: 'Domæne', punkter: [{ id: 'a', tekst: 'eksempel.dk' }] });
  const enkelt = d.createElement('div');
  const be = K.commandBar(enkelt, { ariaT: 'cmdAria', udenFaner: true, faner: [{ id: 'start', t: 'faneStart', grupper: [
    { t: 'gData', knapper: [{ id: 'opdater', t: 'kOpdater', ikon: 'afspil', pri: true }] },
    { t: 'gPeriode', knapper: [{ id: 'periode', element: seg.rod }] },
    { t: 'gDomaene', knapper: [{ id: 'domaene', element: vb.rod }] },
  ] }] });
  tjek('K9: udenFaner: ingen fanerække, ingen tab/tabpanel; båndet er en navngiven gruppe (.cmd.enkel, role="group", data-t-aria)', enkelt.className === 'cmd enkel' && !enkelt.querySelector('.tabs,[role="tab"],[role="tablist"],[role="tabpanel"]') && enkelt.getAttribute('role') === 'group' && enkelt.getAttribute('data-t-aria') === 'cmdAria' && enkelt.querySelectorAll('.grupper').length === 1);
  tjek('K9: grupper og gruppenavne som i dag; en vælger og en segmentknap står i båndet (.baand-el), og knap(id) giver elementet', enkelt.querySelectorAll('.grp[role="group"] .cap').length === 3 && enkelt.querySelector('.cb.pri') && enkelt.querySelectorAll('.baand-el').length === 2 && be.knap('periode') === seg.rod && be.knap('domaene') === vb.rod && seg.rod.parentElement.className === 'baand-el');
  let fejlTo = '';
  try { K.commandBar(d.createElement('div'), { udenFaner: true, faner: [{ id: 'a', t: 'a', grupper: [] }, { id: 'b', t: 'b', grupper: [] }] }); } catch (e) { fejlTo = String(e.message); }
  tjek('K9: udenFaner med to faner giver en fejl', /udenFaner kræver præcis én fane \(fik 2\)/.test(fejlTo), fejlTo);
  const enFane = d.createElement('div');
  K.commandBar(enFane, { faner: [{ id: 'a', t: 'a', grupper: [] }] });
  tjek('K9: et bånd med én fane uden indstillingen har stadig fanerækken (som i 2.0.0)', enFane.querySelector('.tabs [role="tab"]') && !enFane.classList.contains('enkel'));
  tjek('K9: segmentknappen er role="radiogroup" med navn og role="radio" med aria-checked; kun den valgte kan nås med Tab', seg.rod.getAttribute('role') === 'radiogroup' && seg.rod.getAttribute('aria-label') === 'Periode' && seg.knapper.every(b => b.getAttribute('role') === 'radio' && b.type === 'button') && seg.knapper.map(b => b.getAttribute('aria-checked') + b.tabIndex).join() === 'false-1,true0,false-1' && seg.valgt === '30');
  d.body.appendChild(enkelt);
  seg.knapper[1].focus(); tast(seg.knapper[1], 'ArrowRight');
  tjek('K9: pil højre flytter og vælger; fokus følger; vedValg får id', seg.valgt === 'aar' && d.activeElement === seg.knapper[2] && kald.at(-1) === 'seg:aar' && seg.knapper[2].tabIndex === 0 && seg.knapper[1].tabIndex === -1);
  tast(seg.knapper[2], 'ArrowRight');
  const rundt = seg.valgt;
  tast(seg.knapper[0], 'ArrowUp');
  tjek('K9: pilene går rundt (højre fra sidste til første, op fra første til sidste)', rundt === '7' && seg.valgt === 'aar');
  tast(seg.knapper[2], 'Home'); const home = seg.valgt; tast(seg.knapper[0], 'End');
  tjek('K9: Home og End vælger første og sidste', home === '7' && seg.valgt === 'aar');
  seg.knapper[1].click();
  const n = kald.length;
  seg.knapper[1].click(); seg.vaelg('7');
  tjek('K9: klik vælger; samme valg igen kalder ikke vedValg; vaelg(id) udefra kalder den ikke', kald[n - 1] === 'seg:30' && kald.length === n && seg.valgt === '7' && seg.knapper[0].getAttribute('aria-checked') === 'true');
  const forMange = [1, 6].map(antal => { try { K.segment({ valg: Array.from({ length: antal }, (_, i) => ({ id: String(i), tekst: String(i) })) }); return ''; } catch (e) { return String(e.message); } });
  tjek('K9: færre end to eller flere end fem valg giver en fejl', forMange.every(f => /to til fem valg/.test(f)), forMange.join(' | '));
  tjek('K9 (CSS): valgt har flade, fed skrift og streg (ikke farve alene); fokusring i info; et bånd uden faner har luft foroven og forneden', /\.seg-v\[aria-checked="true"\] \{ background: var\(--accent-soft\); font-weight: 600; box-shadow: inset 0 -2px 0 var\(--accent\); \}/.test(css) && /\.seg-v:focus-visible \{ outline: 2px solid var\(--info\);/.test(css) && /\.cmd\.enkel \.grupper \{ padding: var\(--space-2\) var\(--space-3\); \}/.test(css) && /\.baand-el \{[^}]*height: 54px;/.test(css));
  const cb = afsnitAf('CommandBar');
  tjek('K9: KOMPONENTER.md (CommandBar): reglen for et bånd med få kommandoer, valget af indstilling frem for automatik med begrundelse, og element i en gruppe', /### Bånd til programmer med få kommandoer/.test(cb) && /udenFaner: true/.test(cb) && /Valgt som indstilling/.test(cb) && /præcis som i 2\.0\.0, også med én fane/.test(cb) && /\{ id, element \}/.test(cb));
  w.close(); w2.close();

  // ── Dokumenterne ──
  const DELE = ['**Klasser:**', '**Funktioner:**', '**Formål:**', '**Markup:**', '**Tilstande:**', '**Tastatur:**', '**Kræver af programmet:**'];
  const mangler = ['Vælger', 'Sidepanel', 'Segmentknap'].flatMap(nv => DELE.filter(x => !afsnitAf(nv).includes(x)).map(x => nv + ': ' + x));
  tjek('KOMPONENTER.md: Vælger, Sidepanel og Segmentknap har alle syv dele', mangler.length === 0, mangler.join(', '));
  tjek('KOMPONENTER.md: Vælger nævner tastaturet og ARIA, som prompten kræver', ['Enter', 'mellemrum', 'pil ned', 'Esc', 'et bogstav', 'aria-haspopup="listbox"', 'aria-expanded', 'role="listbox"', 'role="option"', 'aria-multiselectable', 'aria-selected'].every(o => afsnitAf('Vælger').includes(o)));
  const findes = md.slice(md.indexOf('## Findes ikke endnu'));
  tjek('KOMPONENTER.md: "Findes ikke endnu" er rettet (vælgeren og segmentknappen nævnt ved menu og valgliste)', /Vælgeren \(2\.2\.0\)/.test(findes) && /segmentknappen \(2\.2\.0\)/.test(findes));
  const log = pk('CHANGELOG.md');
  const post = log.slice(log.indexOf('## 2.2.0'), log.indexOf('\n## ', log.indexOf('## 2.2.0') + 1));
  tjek('CHANGELOG 2.2.0: første post, kun dato, nævner K5–K9, de nye funktioner, og at intet er omdøbt eller fjernet', log.indexOf('## 2.2.0 — 2026-11-11') > 0 && log.indexOf('## 2.2.0') < log.indexOf('## 2.1.0') && ['(K5)', '(K6)', '(K7)', '(K8)', '(K9)', 'Kit.vaelger', 'Kit.sidepanel', 'Kit.segment', 'udenFaner', 'Intet er omdøbt eller fjernet'].every(o => post.includes(o)));
  const readme = pk('README.md');
  tjek('README: indholdslisten og "Hvad pakken ikke indeholder" passer med 2.2.0', /Kit\.vaelger`, `Kit\.sidepanel` og `Kit\.segment` fra 2\.2\.0/.test(readme) && /Vælgeren, sidepanelet og segmentknappen findes fra 2\.2\.0/.test(readme) && /\*\*Flervalg i træet\.\*\*/.test(readme));
  const hm = pk('flytning/HUGINN-MUNINN.md');
  tjek('flytning/HUGINN-MUNINN.md: K5–K9 står som opfyldt i 2.2.0 med hvad de afløser, og hjælpeskuffen og vælgerne står ikke længere som umulige at flytte', ['K5', 'K6', 'K7', 'K8', 'K9'].every(k => new RegExp('\\| ' + k + ' [^|]*\\| 2\\.2\\.0 \\|[^\\n]*Afløser').test(hm)) && !/\| Hjælpeskuffen, dialoger/.test(hm) && !/højst seks visninger/.test(hm) && /Kit\.vaelger/.test(hm) && /Kit\.sidepanel/.test(hm));
}
{
  // Demoen 2.2.0 med pakkens rigtige filer: sektionerne, båndet med én fane og de otte visninger, i begge sprog.
  const dom = await JSDOM.fromFile(demoFil, { runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, virtualConsole: new VirtualConsole() });
  const w = dom.window, d = w.document;
  await new Promise(r => (d.readyState === 'complete' ? r() : w.addEventListener('load', r)));
  await vent(20);
  const sektion = n => d.querySelector(`#v-komponenter .demo-sektion[data-navn="${n}"]`);
  tjek('demo 2.2.0: en sektion for Vælger, Sidepanel og Segmentknap, med overskrift og tekst', ['Vælger', 'Sidepanel', 'Segmentknap'].every(n => sektion(n) && sektion(n).querySelector('h2').textContent && sektion(n).querySelector('p').textContent.startsWith('Fra 2.2.0')));
  tjek('demo 2.2.0: et bånd med én fane, en vælger og en segmentknap (og ingen fanerække)', Boolean(d.querySelector('#demo-baand-enkel.cmd.enkel .baand-el .vlg') && d.querySelector('#demo-baand-enkel .baand-el .seg')) && !d.querySelector('#demo-baand-enkel .tabs'));
  tjek('demo 2.2.0: visningsskift med otte punkter (taet)', d.querySelectorAll('#demo-skift-otte.taet .vs').length === 8);
  tjek('demo 2.2.0: en vælger i titellinjen (ét valg) og en i værktøjslinjen (flere valg med søgefelt)', Boolean(d.querySelector('#demo-vaelger-titel .hoejre .vlg .vlg-knap') && d.querySelector('#demo-vaelger-vl .vlg [aria-multiselectable="true"]') && d.querySelector('#demo-vaelger-vl .vlg-soeg input')));
  const knapLand = d.querySelector('#demo-vaelger-titel .vlg-knap');
  knapLand.click();
  d.activeElement.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
  d.activeElement.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  tjek('demo 2.2.0: vælgeren vælger og melder valget (dansk)', d.getElementById('vaelger-valgt').textContent === 'Valgt: Sverige' && knapLand.querySelector('.vlg-vaerdi').textContent === 'Sverige');
  d.getElementById('demo-sp-aabn').focus();
  d.getElementById('demo-sp-aabn').click();
  tjek('demo 2.2.0: sidepanelet åbner, får fokus og navn, og knappen får aria-expanded', !d.getElementById('demo-sidepanel').hidden && d.activeElement === d.querySelector('#demo-sidepanel h2') && d.querySelector('#demo-sidepanel h2').textContent === 'Hjælp' && d.getElementById('demo-sp-aabn').getAttribute('aria-expanded') === 'true');
  d.activeElement.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  tjek('demo 2.2.0: Esc lukker sidepanelet og fokus går tilbage', d.getElementById('demo-sidepanel').hidden && d.activeElement === d.getElementById('demo-sp-aabn') && d.getElementById('sp-valgt').textContent === 'Panelet blev lukket (esc).');
  d.querySelector('#demo-segment .seg-v[aria-checked="false"]').click();
  tjek('demo 2.2.0: segmentknappen vælger og melder valget', /^Valgt: (30 dage|År)$/.test(d.getElementById('segment-valgt').textContent));
  w.Sprog.saet('en');
  const tomme = [...d.querySelectorAll('#demo-baand-enkel [data-t], #v-komponenter [data-navn="Vælger"] [data-t], #v-komponenter [data-navn="Sidepanel"] [data-t], #v-komponenter [data-navn="Segmentknap"] [data-t], #demo-skift-otte [data-t]')].filter(e => !e.textContent.trim()).map(e => e.getAttribute('data-t'));
  tjek('demo 2.2.0 (English): de nye dele har tekst, og vælgerens knap følger sproget', tomme.length === 0 && knapLand.querySelector('.vlg-vaerdi').textContent === 'Sweden' && d.querySelector('#demo-sidepanel h2').textContent === 'Help' && d.querySelector('#demo-segment .seg-v').textContent === '7 days', tomme.join(', '));
  w.Tema.saet('moerk');
  tjek('demo 2.2.0: mørkt tema sættes på siden med de nye komponenter (kun tokens i kit.css, se farvetjekket)', d.documentElement.getAttribute('data-tema') === 'moerk');
  w.close();
}

// ── Pakke 2.3.0 (K10–K17): komponenterne. Filterchip, kasse, statusflise, tom tilstand, fremdrift, værktøjstip,
// afkrydsning, kontakt, radiogruppe, valgliste, dialog, tabellens nye indstillinger og tekststørrelsen. ──
{
  const css = pk('web/kit.css'), kitJs = pk('web/kit.js'), md = pk('KOMPONENTER.md');
  const afsnitAf = navn => { const i = md.indexOf('\n## ' + navn + '\n'); return i < 0 ? '' : md.slice(i, md.indexOf('\n## ', i + 1)); };
  const DELE = ['**Klasser:**', '**Funktioner:**', '**Formål:**', '**Markup:**', '**Tilstande:**', '**Tastatur:**', '**Kræver af programmet:**'];
  const harDele = (navn, dele = DELE) => { const a = afsnitAf(navn); return a.length > 0 && dele.every(x => a.includes(x)); };
  const ny = () => {
    const dom = new JSDOM('<!doctype html><html data-kit-praefiks="proeve"><body></body></html>', { runScripts: 'outside-only', url: 'http://kit.invalid/', pretendToBeVisual: true });
    for (const f of ['tema.js', 'sprogmotor.js', 'kit.js']) dom.window.eval(pk('web/' + f));
    return dom.window;
  };
  const w = ny(), d = w.document, K = w.Kit;
  const tast = (el, key, x = {}) => el.dispatchEvent(new w.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...x }));
  const TIP_VENT_MS = Number(/const TIP_VENT = (\d+), TIP_SLIP = (\d+)/.exec(kitJs)[1]);
  const fn = Object.keys(K).map(k => 'Kit.' + k);
  tjek('2.3.0: hvert nyt navn i V230_FUNKTIONER findes i Kit', V230_FUNKTIONER.every(f => fn.includes(f)), V230_FUNKTIONER.filter(f => !fn.includes(f)).join(', '));
  const cssUden = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@font-face\s*\{[^}]*\}/g, '').replace(/@keyframes[^{]*\{(?:[^{}]*\{[^}]*\})*[^}]*\}/g, ' ').replace(/\{[^}]*\}/g, ' ');
  const cssKlasser = new Set([...cssUden.matchAll(/\.([a-z][a-z0-9-]*)/g)].map(m => m[1]));
  tjek('2.3.0: hver ny klasse i V230_KLASSER findes i kit.css', V230_KLASSER.every(k => cssKlasser.has(k)), V230_KLASSER.filter(k => !cssKlasser.has(k)).join(', '));
  // Kittet bruger ikke de klassenavne, programmerne allerede har til noget andet (Grimnirs app.css og HAM's app.css og vagt.css).
  const OPTAGET = ['kort', 'flise', 'fliser', 'tom', 'dlg', 'dlg-knapper', 'afkryds', 'valg', 'panel', 'kontakt', 'boks', 'sort', 'sider', 'dialog', 'tal', 'etik', 'pille', 'arbejder'];
  tjek('2.3.0: kittet bruger ingen af de klassenavne, Grimnir og Huginn and Muninn har til noget andet (.kort, .tom, .dlg, .flise, .kontakt …)', OPTAGET.every(k => !cssKlasser.has(k)), OPTAGET.filter(k => cssKlasser.has(k)).join(', '));

  // Reglen: kittet sætter aldrig inline-stil, så det virker under style-src 'self'. Over alle tekstfiler i web/.
  const INLINE = /\.style\.|\bstyle\s*=\s*["'`]|setAttribute\(\s*['"`]style['"`]|\.cssText|setProperty\(/;
  const webFiler = (function alle(dir) { return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? alle(path.join(dir, e.name)) : [path.join(dir, e.name)]); })(path.join(PAKKE, 'web')).filter(f => /\.(js|css|html|txt)$/.test(f));
  const medInline = webFiler.filter(f => INLINE.test(fs.readFileSync(f, 'utf8')));
  tjek(`2.3.0: ingen fil i web/ sætter inline-stil (.style., style="", setAttribute('style'), cssText; ${webFiler.length} filer)`, webFiler.length >= 6 && medInline.length === 0, medInline.map(f => path.relative(PAKKE, f)).join(', '));
  tjek('kontrol: inline-mønsteret fanger .style.color, style="x", setAttribute(\'style\', …) og .cssText, men ikke klassen .stylet', ["e.style.color = 'x'", '<i style="x">', "e.setAttribute('style', 'x')", 'e.style.cssText = s', "e.style.setProperty('--a', 1)"].every(s => INLINE.test(s)) && !INLINE.test("e.classList.add('stylet'); el('span', 'stilart')"));
  tjek('2.3.0: reglen om inline-stil står i README', /\*\*Kittet sætter aldrig inline-stil\*\*/.test(pk('README.md')) && /style-src 'self'/.test(pk('README.md')));

  // ── K16: filterchip ──
  const skift = [];
  const fc = K.filterchip({ id: 'nye', tekst: 'Nye', antal: 4, vedSkift: (til, id) => skift.push(til + ':' + id) });
  d.body.appendChild(fc);
  tjek('K16: filterchip er en knap (type="button") med aria-pressed="false", flueben (aria-hidden), ord og antal', fc.tagName === 'BUTTON' && fc.type === 'button' && fc.className === 'fchip' && fc.getAttribute('aria-pressed') === 'false' && fc.querySelector('.fchip-mark').getAttribute('aria-hidden') === 'true' && fc.querySelector('.fchip-mark').textContent === '✓' && fc.children[1].textContent === 'Nye' && fc.querySelector('.ant').textContent === '4' && fc.dataset.chip === 'nye');
  fc.click();
  const efterEt = fc.getAttribute('aria-pressed');
  fc.click();
  tjek('K16: klik slår til og fra (aria-pressed) og melder til/fra og id', efterEt === 'true' && fc.getAttribute('aria-pressed') === 'false' && skift.join() === 'true:nye,false:nye');
  tjek('K16: deaktiveret er disabled; nøgle giver data-t', K.filterchip({ t: 'cNoegle', deaktiveret: true }).disabled && K.filterchip({ t: 'cNoegle' }).children[1].getAttribute('data-t') === 'cNoegle');
  const fv = [];
  const fg = K.filterchips({ aria: 'Vis', chips: [{ id: 'a', tekst: 'Fejl', antal: 3 }, { id: 'b', tekst: 'Advarsler' }, { id: 'c', tekst: 'Oplysninger' }], valgt: ['a'], vedValg: ids => fv.push(ids.join('+')) });
  d.body.appendChild(fg.rod);
  tjek('K16: filterchips er en navngiven gruppe (role="group", aria-label) med én knap pr. chip; valgt fra start', fg.rod.className === 'fchips' && fg.rod.getAttribute('role') === 'group' && fg.rod.getAttribute('aria-label') === 'Vis' && fg.chips.length === 3 && fg.chips.map(b => b.getAttribute('aria-pressed')).join() === 'true,false,false' && JSON.stringify(fg.valgt) === '["a"]');
  fg.chips[2].click(); fg.chips[0].click();
  tjek('K16: hver chip slås til og fra for sig; vedValg får listen af de valgte ved hvert klik (også ingen)', fv.join() === 'a+c,c' && (fg.chips[2].click(), fv.at(-1) === '' && JSON.stringify(fg.valgt) === '[]'));
  fg.saetValgt(['b', 'c']);
  tjek('K16: saetValgt sætter valget udefra uden at kalde vedValg', JSON.stringify(fg.valgt) === '["b","c"]' && fv.length === 3);
  tjek('K16: ariaT giver data-t-aria på gruppen', K.filterchips({ ariaT: 'filterAria', chips: [] }).rod.getAttribute('data-t-aria') === 'filterAria');
  tjek('K16: den almindelige chip er uændret og kan ikke klikkes (samme markup som 2.0.0, ingen knap, tabindex eller rolle)', K.chip('ok', 'Maskeres').outerHTML === '<span class="chip ok"><span aria-hidden="true">✓</span><span class="ord">Maskeres</span></span>' && /(?:^|\n)\.chip \{\n  display: inline-flex; align-items: center; gap: var\(--space-1\);\n  height: 22px; padding: 0 9px; border-radius: var\(--radius-pill\);\n  font-size: var\(--small-size\); font-weight: 600; white-space: nowrap;\n\}/.test(css) && !/\.chip[^{]*\{[^}]*cursor/.test(css));
  tjek('K16 (CSS): valgt er ikke farve alene (flade, kant i accent, fed skrift og flueben); 28 px høj; deaktiveret nedtonet', /\.fchip\[aria-pressed="true"\] \{ background: var\(--accent-soft\); border-color: var\(--accent\); font-weight: 600; \}/.test(css) && /\.fchip\[aria-pressed="true"\] \.fchip-mark \{ display: inline; \}/.test(css) && /\.fchip-mark \{ display: none;/.test(css) && /\.fchip \{[^}]*height: 28px;[^}]*border: 1px solid var\(--border-strong\);/.test(css) && /\.fchip\[disabled\] \{ opacity: \.55;/.test(css));
  // ── K13: kasse (kittets kort) ──
  const knapH = K.knap({ tekst: 'Vis alle', variant: 'ghost' });
  const k1 = K.kasse({ tekst: 'Seneste sager', handling: knapH, indhold: d.createTextNode('Indhold'), fod: d.createTextNode('Fod') });
  tjek('K13: <section class="kasse"> med navn fra overskriften (aria-labelledby → h2 med id), hoved, indhold og fodlinje', k1.rod.tagName === 'SECTION' && k1.rod.className === 'kasse' && k1.rod.getAttribute('aria-labelledby') === k1.overskrift.id && k1.overskrift.tagName === 'H2' && k1.overskrift.textContent === 'Seneste sager' && /^kit-kasse\d+-h$/.test(k1.overskrift.id) && k1.rod.children.length === 3 && k1.rod.children[0].className === 'kasse-top' && k1.indhold.className === 'kasse-indhold' && k1.indhold.textContent === 'Indhold' && k1.fod.className === 'kasse-fod' && k1.fod.textContent === 'Fod');
  tjek('K13: handlingen står i hovedet efter overskriften (.kasse-handling)', knapH.parentElement.className === 'kasse-handling' && knapH.parentElement.parentElement === k1.rod.children[0] && k1.rod.children[0].firstElementChild === k1.overskrift);
  const k2 = K.kasse({ t: 'kNoegle', id: 'mit-kort', niveau: 3, fyld: true });
  tjek('K13: uden handling og fodlinje er der kun hoved og indhold; niveau 3 giver h3; id og nøgle; fyld giver .fyld', k2.rod.children.length === 2 && k2.fod === null && !k2.rod.querySelector('.kasse-handling') && k2.overskrift.tagName === 'H3' && k2.rod.id === 'mit-kort' && k2.overskrift.id === 'mit-kort-h' && k2.overskrift.getAttribute('data-t') === 'kNoegle' && k2.indhold.className === 'kasse-indhold fyld' && K.kasse({ tekst: 'x', niveau: 7 }).overskrift.tagName === 'H2');
  tjek('K13 (CSS): klassen er ikke .kort; flade med kant og radius, hoved og fod på surface-raised; ingen overflow (en vælger i hovedet klippes ikke); overskriften i h3-størrelse', !/\.kort\b/.test(css.replace(/\/\*[\s\S]*?\*\//g, '')) && /\.kasse \{[^}]*background: var\(--surface\); border: 1px solid var\(--border\); border-radius: var\(--radius-md\);[^}]*\}/.test(css) && !/\.kasse[^{]*\{[^}]*overflow/.test(css) && /\.kasse-top \{[^}]*background: var\(--surface-raised\);/.test(css) && /\.kasse-top > h2, \.kasse-top > h3, \.kasse-top > h4 \{[^}]*font-size: var\(--h3-size\);/.test(css) && /\.kasse-indhold\.fyld \{ padding: 0; \}/.test(css));
  tjek('KOMPONENTER.md: Kasse har alle syv dele og skriver valget af navn (.kasse, ikke .kort)', harDele('Kasse') && /ikke `\.kort`/.test(afsnitAf('Kasse')) && /navneskik/.test(afsnitAf('Kasse')));
  // ── K12: StatusTile ──
  const flKald = [];
  const fl = K.statusflise({ tekst: 'Venter på dig', tal: 2, status: { variant: 'warn', tekst: 'Tjek selv' }, udvikling: { retning: 'op', tekst: '1 mere end i går' }, ved: () => flKald.push('ja') });
  d.body.appendChild(fl);
  tjek('K12: med ved er hele flisen en knap (type="button") med etiket, tal, statuschip og udvikling i den rækkefølge; streg efter status (.warn)', fl.tagName === 'BUTTON' && fl.type === 'button' && fl.className === 'sflise warn' && [...fl.children].map(c => c.className).join() === 'sflise-navn,sflise-tal,chip warn,sflise-under' && fl.querySelector('.sflise-tal').textContent === '2' && fl.querySelector('.chip .ord').textContent === 'Tjek selv' && fl.querySelector('.chip [aria-hidden="true"]').textContent === '!');
  tjek('K12: udviklingen er en pil (aria-hidden) og en tekst; knappens indhold er etiket, tal, status og udvikling', fl.querySelector('.sflise-pil').textContent === '↑' && fl.querySelector('.sflise-pil').getAttribute('aria-hidden') === 'true' && fl.querySelector('.sflise-under').textContent === '↑1 mere end i går' && fl.textContent.replace(/[!↑]/g, '') === 'Venter på dig2Tjek selv1 mere end i går');
  fl.click();
  tjek('K12: klik på flisen kalder ved', flKald.join() === 'ja');
  const flA = K.statusflise({ t: 'flNoegle', tal: 13, status: { variant: 'ok', t: 'stKlar' }, href: '#maskeres' });
  const flD = K.statusflise({ tekst: 'Rester', tal: null, under: 'efter maskering' });
  tjek('K12: med href er flisen et link; uden ved og href en div (ikke klikbar; intet tal giver –); undertekst; nøgler giver data-t', flA.tagName === 'A' && flA.getAttribute('href') === '#maskeres' && flA.querySelector('.sflise-navn').getAttribute('data-t') === 'flNoegle' && flA.querySelector('.chip .ord').getAttribute('data-t') === 'stKlar' && flD.tagName === 'DIV' && flD.className === 'sflise' && !flD.querySelector('.chip') && flD.querySelector('.sflise-tal').textContent === '–' && flD.querySelector('.sflise-under').textContent === 'efter maskering' && !flD.hasAttribute('tabindex'));
  const fejlFl = [() => K.statusflise({ tekst: 'x', tal: 1, status: { variant: 'groen', tekst: 'x' } }), () => K.statusflise({ tekst: 'x', tal: 1, udvikling: { retning: 'skraat', tekst: 'x' } })].map(f => { try { f(); return ''; } catch (e) { return e.message; } });
  tjek('K12: en ukendt status eller udvikling giver en fejl', /ukendt status: groen/.test(fejlFl[0]) && /ukendt udvikling: skraat/.test(fejlFl[1]), fejlFl.join(' | '));
  const raekke = K.statusfliser({ aria: 'Status', fliser: [{ tekst: 'A', tal: 1, ved: () => {} }, flD] });
  tjek('K12: en række er <ul role="list"> med navn og én <li> pr. flise (også en færdig flise)', raekke.tagName === 'UL' && raekke.className === 'sfliser' && raekke.getAttribute('role') === 'list' && raekke.getAttribute('aria-label') === 'Status' && raekke.children.length === 2 && [...raekke.children].every(li => li.tagName === 'LI' && li.children.length === 1) && raekke.children[1].firstChild === flD);
  tjek('K12 (CSS): stregen har statussens mærkefarve (fem varianter), kun knap og link har hover og markør, rækken ombrydes (grid, auto-fill), tallet i h1-størrelse', ['ok', 'warn', 'danger', 'info', 'none'].every(v => new RegExp('\\.sflise\\.' + v + ' \\{ border-left-color: var\\(--' + v + '-mark\\); \\}').test(css)) && /button\.sflise, a\.sflise \{ cursor: pointer; \}/.test(css) && /button\.sflise:hover, a\.sflise:hover \{/.test(css) && !/(?:^|\n)\.sflise:hover/.test(css) && /\.sfliser \{[^}]*grid-template-columns: repeat\(auto-fill, minmax\(176px, 1fr\)\);/.test(css) && /\.sflise-tal \{ font-size: var\(--h1-size\);/.test(css) && /\.sflise \{[^}]*border-left: 4px solid var\(--border\);/.test(css));
  tjek('KOMPONENTER.md: StatusTile har alle syv dele og reglen "En flise findes kun, når brugeren handler på tallet"', harDele('StatusTile') && /En flise findes kun, når brugeren handler på tallet/.test(afsnitAf('StatusTile')) && /role="list"/.test(afsnitAf('StatusTile')));
  // ── K14: tom tilstand ──
  const tomKald = [];
  const tomS = K.tomTilstand({ ikon: 'mappe', tekst: 'Ingen sager endnu', p: 'Indsæt en tekst.', handling: { tekst: 'Ny sag', variant: 'primary', ved: () => tomKald.push('ny') } });
  tjek('K14 (tom): ikon (aria-hidden), overskrift (h2), én sætning og én handling (knap) i den rækkefølge; ingen role', tomS.className === 'tomt' && [...tomS.children].map(c => c.tagName.toLowerCase() + '.' + (c.getAttribute('class') || '')).join() === 'svg.tomt-ikon,h2.tomt-h,p.tomt-p,button.btn primary' && tomS.querySelector('svg').getAttribute('aria-hidden') === 'true' && tomS.querySelector('h2').textContent === 'Ingen sager endnu' && !tomS.hasAttribute('role') && (tomS.querySelector('button').click(), tomKald.join() === 'ny'));
  const tomL = K.tomTilstand({ lille: true, t: 'ingenTraef', p: { t: 'ingenTraefP' } });
  tjek('K14 (tom): den lille udgave har role="status", overskriften er et afsnit, og ikon og handling er valgfri; niveau 3 giver h3', tomL.className === 'tomt lille' && tomL.getAttribute('role') === 'status' && [...tomL.children].map(c => c.tagName + '.' + c.className).join() === 'P.tomt-h,P.tomt-p' && tomL.firstChild.getAttribute('data-t') === 'ingenTraef' && tomL.lastChild.getAttribute('data-t') === 'ingenTraefP' && K.tomTilstand({ tekst: 'x', niveau: 3 }).querySelector('.tomt-h').tagName === 'H3');
  tjek('K14 (tom, CSS): midt på fladen, højst 520 px, ikon 40 px (24 px i den lille), samme mål som Grimnirs .tom (V-KITBRUG.1: Grimnir bruger nu kittets; ingen .tom i app.css)', /\.tomt \{ display: flex; flex-direction: column; align-items: center; gap: var\(--space-2\); max-width: 520px; margin: 0 auto; padding: var\(--space-8\) var\(--space-6\); text-align: center; \}/.test(css) && /\.tomt-ikon \{ width: 40px; height: 40px;/.test(css) && /\.tomt\.lille \.tomt-ikon \{ width: 24px; height: 24px; \}/.test(css) && !/(^|\n)\.tom \{/.test(fs.readFileSync(path.join(repo, 'ui', 'assets', 'app.css'), 'utf8')));
  // ── K14: fremdrift ──
  const omr = d.createElement('div');
  d.body.appendChild(omr);
  const fu = K.fremdrift({ tekst: 'Analyserer filen …', omraade: omr });
  tjek('K14 (fremdrift, ubestemt): ring (aria-hidden) og tekst med role="status"; ringen er aldrig alene; området får aria-busy', fu.rod.className === 'frem ubestemt' && fu.rod.children[0].className === 'snurr' && fu.rod.children[0].getAttribute('aria-hidden') === 'true' && fu.rod.children[1].className === 'frem-tekst' && fu.rod.children[1].getAttribute('role') === 'status' && fu.rod.children[1].textContent === 'Analyserer filen …' && fu.bjaelke === null && omr.getAttribute('aria-busy') === 'true');
  fu.faerdig();
  tjek('K14 (fremdrift): faerdig() fjerner aria-busy', !omr.hasAttribute('aria-busy'));
  const fb = K.fremdrift({ t: 'nAfM', maks: 8, vaerdi: 3 });
  const fbT = fb.rod.querySelector('.frem-tekst');
  tjek('K14 (fremdrift, bestemt): <progress> med max og value, navngivet af teksten (aria-labelledby); teksten som nøgle', fb.rod.className === 'frem' && fb.bjaelke.tagName === 'PROGRESS' && fb.bjaelke.className === 'frem-bjaelke' && fb.bjaelke.max === 8 && fb.bjaelke.value === 3 && fb.bjaelke.getAttribute('aria-labelledby') === fbT.id && fbT.getAttribute('data-t') === 'nAfM' && !fb.rod.querySelector('.snurr'));
  fb.saet(5, { t: 'nAfM', v: 5, w: 8 });
  const efterNoegle = fb.bjaelke.value === 5 && fbT.getAttribute('data-v') === '5' && fbT.getAttribute('data-w') === '8';
  fb.saet(null, 'Færdig');
  tjek('K14 (fremdrift): saet(værdi, tekst) sætter værdien og en ny tekst (nøgle med data-v og data-w, eller færdig tekst)', efterNoegle && fb.bjaelke.value === 5 && fbT.textContent === 'Færdig' && !fbT.hasAttribute('data-t') && !fbT.hasAttribute('data-v'));
  tjek('K14 (fremdrift, CSS): ringen snurrer og står stille ved prefers-reduced-motion; bjælken har kant og fyld i accent', /\.snurr \{[^}]*animation: kit-snurr \.9s linear infinite;/.test(css) && /@keyframes kit-snurr \{ to \{ transform: rotate\(360deg\); \} \}/.test(css) && /@media \(prefers-reduced-motion: reduce\) \{ \.snurr \{ animation: none; \} \}/.test(css) && /\.frem-bjaelke::-webkit-progress-value \{ background: var\(--accent\); \}/.test(css) && /\.frem-bjaelke \{[^}]*border: 1px solid var\(--border-strong\);/.test(css));
  // ── K14: værktøjstip ──
  const raekkeT = d.createElement('div');
  const tipM = d.createElement('button');
  tipM.setAttribute('aria-describedby', 'andet');
  tipM.textContent = 'Kopiér';
  raekkeT.appendChild(tipM);
  d.body.appendChild(raekkeT);
  const tp = K.vaerktoejstip(tipM, { tekst: 'Vælg en række først.' });
  tjek('K14 (tip): role="tooltip", skjult fra start; elementet ligger i .tip-plads og får aria-describedby (tilføjet til det, der var)', tp.tip.getAttribute('role') === 'tooltip' && tp.tip.hidden && tp.tip.textContent === 'Vælg en række først.' && tipM.parentElement === tp.plads && tp.plads.className === 'tip-plads' && tp.plads.parentElement === raekkeT && tp.tip.parentElement === tp.plads && tipM.getAttribute('aria-describedby') === 'andet ' + tp.tip.id && !tp.synlig);
  tipM.focus();
  const vedFokus = tp.synlig;
  tast(tipM, 'Escape');
  const efterEsc = tp.synlig;
  tjek('K14 (tip): tastaturfokus viser tippet; Esc skjuler det uden at flytte fokus', vedFokus && !efterEsc && d.activeElement === tipM);
  tipM.blur();
  tp.plads.dispatchEvent(new w.MouseEvent('mouseenter'));
  const straks = tp.synlig;
  await vent(TIP_VENT_MS + 50);
  const efterVent = tp.synlig;
  tp.plads.dispatchEvent(new w.MouseEvent('mouseleave'));
  await vent(50);
  tp.plads.dispatchEvent(new w.MouseEvent('mouseenter'));
  await vent(200);
  const holdt = tp.synlig;
  tp.plads.dispatchEvent(new w.MouseEvent('mouseleave'));
  await vent(200);
  tjek('K14 (tip): hover viser efter 300 ms; musen kan flyttes op på tippet uden at det forsvinder (inden for 150 ms); det forsvinder, når musen går', !straks && efterVent && holdt && !tp.synlig);
  const andenEsc = [];
  d.addEventListener('keydown', e => andenEsc.push(e.defaultPrevented));
  tp.vis();
  tast(d.body, 'Escape');
  tast(d.body, 'Escape');
  tjek('K14 (tip): Esc bruges kun til at skjule tippet (andre lyttere får den ikke), og næste Esc går videre som før', !tp.synlig && andenEsc.length === 1 && andenEsc[0] === false);
  const tp2 = K.vaerktoejstip(tipM, { t: 'tNoegle' });
  tjek('K14 (tip): et element med to tip genbruger .tip-plads; nøgle giver data-t', tp2.plads === tp.plads && tp2.tip.getAttribute('data-t') === 'tNoegle' && tipM.getAttribute('aria-describedby').split(' ').length === 3);
  const placerTip = (m, t, vb) => {
    Object.defineProperty(w, 'innerWidth', { value: vb, configurable: true });
    tipM.getBoundingClientRect = () => ({ left: m[0], top: m[1], right: m[0] + m[2], bottom: m[1] + 30, width: m[2], height: 30 });
    tp.tip.getBoundingClientRect = () => ({ left: 0, top: 0, right: t[0], bottom: t[1], width: t[0], height: t[1] });
    tp.skjul(); tp.vis();
    const k = ['under', 'venstre-kant', 'hoejre-kant'].filter(x => tp.tip.classList.contains(x)).join('+') || 'over';
    return k + (tp.tip.hasAttribute('style') ? '+stil' : '');
  };
  tjek('K14 (tip): placering med klasser: midt over; under ved toppen; venstre-kant og hoejre-kant ved vinduets kanter; ingen inline-stil', placerTip([400, 300, 80], [200, 40], 900) === 'over' && placerTip([400, 20, 80], [200, 40], 900) === 'under' && placerTip([10, 300, 40], [200, 40], 900) === 'venstre-kant' && placerTip([840, 300, 50], [200, 40], 900) === 'hoejre-kant' && placerTip([840, 10, 50], [200, 40], 900) === 'under+hoejre-kant');
  tp.skjul();
  tjek('K14 (tip, CSS): over som standard, .under, .venstre-kant og .hoejre-kant; mørk flade i begge temaer; højst 280 px', /\.tip \{\n  position: absolute; bottom: calc\(100% \+ 6px\); left: 50%; z-index: 30; transform: translateX\(-50%\);/.test(css) && /\.tip\.under \{ bottom: auto; top: calc\(100% \+ 6px\); \}/.test(css) && /\.tip\.venstre-kant \{ left: 0; transform: none; \}/.test(css) && /\.tip\.hoejre-kant \{ left: auto; right: 0; transform: none; \}/.test(css) && /background: var\(--rail\); color: var\(--rail-strong\);/.test(css) && /max-width: 280px;/.test(css) && /\.tip-plads \{ position: relative;/.test(css));
  tjek('KOMPONENTER.md: Tom tilstand, Fremdrift og Værktøjstip har alle syv dele; reglen for title og værktøjstip, WCAG 1.4.13, aria-busy og prefers-reduced-motion står der', ['Tom tilstand', 'Fremdrift', 'Værktøjstip'].every(n => harDele(n)) && /Hvornår `title`, og hvornår et værktøjstip/.test(afsnitAf('Værktøjstip')) && /beholder de/.test(afsnitAf('Værktøjstip')) && /1\.4\.13/.test(afsnitAf('Værktøjstip')) && /aria-busy/.test(afsnitAf('Fremdrift')) && /prefers-reduced-motion/.test(afsnitAf('Fremdrift')) && /ingen træffere/i.test(afsnitAf('Tom tilstand')) && /tom tabel/.test(afsnitAf('Tom tilstand')));
  // ── K11: afkrydsning, kontakt, radiogruppe og valgliste ──
  const afkKald = [];
  const afk = K.afkrydsning({ tekst: 'Maskér fremmede', hjaelp: 'Adresser, der ikke er dine.', valgt: true, vedSkift: v => afkKald.push(v) });
  d.body.appendChild(afk.rod);
  const afkIn = afk.input, afkHj = afk.rod.querySelector('.afk-hj');
  tjek('K11 (afkrydsning): browserens <input type="checkbox"> (ingen egen rolle) i en <label> med teksten; hjælp under med aria-describedby', afkIn.tagName === 'INPUT' && afkIn.type === 'checkbox' && !afkIn.hasAttribute('role') && afkIn.className === 'afk-boks' && afkIn.parentElement.tagName === 'LABEL' && afkIn.parentElement.className === 'afk' && afkIn.nextElementSibling.className === 'afk-tekst' && afkIn.nextElementSibling.textContent === 'Maskér fremmede' && afkIn.checked && afk.valgt && afkHj.textContent === 'Adresser, der ikke er dine.' && afkIn.getAttribute('aria-describedby') === afkHj.id && !afkIn.hasAttribute('aria-invalid'));
  afkIn.click();
  tjek('K11 (afkrydsning): klik slår fra og kalder vedSkift(false); et klik på teksten virker også (etiketten)', !afk.valgt && afkKald.join() === 'false' && (afkIn.nextElementSibling.click(), afk.valgt && afkKald.join() === 'false,true'));
  const afkD = K.afkrydsning({ t: 'vaelgAlle', delvis: true });
  const delvisFoer = afkD.input.indeterminate;
  afkD.saetValgt(true);
  const efterSaet = !afkD.input.indeterminate && afkD.valgt;
  afkD.saetDelvis();
  tjek('K11 (afkrydsning): delvis valgt (indeterminate) fra start, saetValgt fjerner det, saetDelvis sætter det igen; nøgle giver data-t', delvisFoer && efterSaet && afkD.input.indeterminate && afkD.rod.querySelector('.afk-tekst').getAttribute('data-t') === 'vaelgAlle');
  const afkF = K.afkrydsning({ tekst: 'Jeg har læst', fejl: { t: 'fejlX' }, deaktiveret: true, navn: 'vilkaar', vaerdi: 'ja', id: 'mit-felt' });
  tjek('K11 (afkrydsning): fejl giver aria-invalid og fejltekst (.fejltekst, nøgle); deaktiveret, navn, værdi og id', afkF.input.getAttribute('aria-invalid') === 'true' && afkF.rod.querySelector('.afk-hj.fejltekst').getAttribute('data-t') === 'fejlX' && afkF.input.disabled && afkF.input.name === 'vilkaar' && afkF.input.value === 'ja' && afkF.input.id === 'mit-felt' && afkF.input.getAttribute('aria-describedby') === 'mit-felt-hj');
  const tfKald = [];
  const tf = K.kontakt({ tekst: 'Lås efter 5 minutter', til: true, ord: { til: 'Til', fra: 'Fra' }, vedSkift: v => tfKald.push(v) });
  d.body.appendChild(tf.rod);
  const tfIn = tf.input, tfOrd = tf.rod.querySelector('.tilfra-ord');
  tjek('K11 (kontakt): <input type="checkbox" role="switch"> i en <label> med teksten; ordene til og fra står begge i markup (aria-hidden)', tfIn.type === 'checkbox' && tfIn.getAttribute('role') === 'switch' && tfIn.className === 'tilfra' && tfIn.parentElement.tagName === 'LABEL' && tfIn.checked && tf.til && tfOrd.getAttribute('aria-hidden') === 'true' && tfOrd.querySelector('.tilfra-til').textContent === 'Til' && tfOrd.querySelector('.tilfra-fra').textContent === 'Fra' && tfIn.parentElement.contains(tfOrd));
  tfIn.click();
  tf.saet(true);
  tjek('K11 (kontakt): klik slår fra og kalder vedSkift(false); saet(true) udefra kalder den ikke', tfKald.join() === 'false' && tf.til);
  tjek('K11 (kontakt, CSS): til og fra ses på knoppens plads (left 2 px / 18 px) og fladen; ordet vises efter :checked; glider ikke ved prefers-reduced-motion', /\.tilfra::before \{[^}]*left: 2px;[^}]*background: var\(--border-strong\);[^}]*\}/.test(css) && /\.tilfra:checked::before \{ left: 18px; background: var\(--on-accent\); \}/.test(css) && /\.tilfra:checked \{ border-color: var\(--accent\); background: var\(--accent\); \}/.test(css) && /\.tilfra:checked ~ \.tilfra-ord > \.tilfra-fra, \.tilfra:not\(:checked\) ~ \.tilfra-ord > \.tilfra-til \{ display: none; \}/.test(css) && /@media \(prefers-reduced-motion: reduce\) \{ \.tilfra::before \{ transition: none; \} \}/.test(css));
  tjek('K11 (kontakt): valget (input frem for button) står med begrundelse i kit.js og KOMPONENTER.md', /Valgt frem for <button role="switch" aria-checked>/.test(kitJs) && /\*\*Valget af element:\*\* `<input type="checkbox" role="switch">`, ikke `<button role="switch" aria-checked>`/.test(afsnitAf('Kontakt')));
  const rgKald = [];
  const rg = K.radiogruppe({ etiket: 'Tema', valgt: 'moerk', vandret: true, hjaelp: 'Gælder kun dette vindue.', valg: [{ id: 'lys', tekst: 'Lys' }, { id: 'moerk', tekst: 'Mørk' }, { id: 'system', tekst: 'System', hjaelp: 'Følger macOS.' }], vedValg: id => rgKald.push(id) });
  d.body.appendChild(rg.rod);
  tjek('K11 (radiogruppe): <fieldset> med <legend> og browserens <input type="radio"> med samme name; den valgte er checked; hjælp med aria-describedby på gruppen', rg.rod.tagName === 'FIELDSET' && rg.rod.className === 'valgsaet vandret' && rg.rod.firstElementChild.tagName === 'LEGEND' && rg.rod.firstElementChild.textContent === 'Tema' && rg.inputs.length === 3 && rg.inputs.every(i => i.type === 'radio' && i.name === rg.inputs[0].name && !i.hasAttribute('role')) && rg.inputs.map(i => i.value).join() === 'lys,moerk,system' && rg.valgt === 'moerk' && rg.rod.getAttribute('aria-describedby') === rg.rod.lastElementChild.id && rg.rod.lastElementChild.textContent === 'Gælder kun dette vindue.' && rg.inputs[2].getAttribute('aria-describedby') && !rg.rod.hasAttribute('aria-invalid'));
  rg.inputs[2].click();
  rg.vaelg('lys');
  tjek('K11 (radiogruppe): et valg kalder vedValg(id); vaelg(id) udefra kalder den ikke; én valgt ad gangen', rgKald.join() === 'system' && rg.valgt === 'lys' && rg.inputs.filter(i => i.checked).length === 1);
  const rgF = K.radiogruppe({ etiket: { t: 'temaEt' }, fejl: 'Vælg et tema.', valg: [{ id: 'a', t: 'a' }, { id: 'b', t: 'b' }] });
  tjek('K11 (radiogruppe): fejl står under gruppen (fejltekst, aria-describedby) uden aria-invalid på gruppe eller knapper; ingen valgt giver null; to grupper får hver sit name', rgF.rod.querySelector(':scope > .afk-hj.fejltekst').textContent === 'Vælg et tema.' && !rgF.rod.hasAttribute('aria-invalid') && rgF.inputs.every(i => !i.hasAttribute('aria-invalid')) && rgF.valgt === null && rgF.inputs[0].name !== rg.inputs[0].name && rgF.rod.querySelector('legend').getAttribute('data-t') === 'temaEt' && /\.valgsaet:has\(> \.afk-hj\.fejltekst\) \.afk-boks \{ border-color: var\(--danger\); \}/.test(css));
  const vlKald = [];
  const vl = K.valgliste({ etiket: 'Udløber efter', hjaelp: 'Sagen slettes derefter.', valgt: '30', valg: [{ id: '7', tekst: '7 dage' }, { id: '30', tekst: '30 dage' }, { id: 'x', t: 'aldrig', deaktiveret: true }], vedValg: id => vlKald.push(id) });
  d.body.appendChild(vl.rod);
  const sel = vl.select;
  tjek('K11 (valgliste): browserens <select> i .felt med <label for>, kittets pil (aria-hidden) og hjælp under med aria-describedby', vl.rod.className === 'felt' && sel.tagName === 'SELECT' && sel.parentElement.className === 'vliste' && sel.nextElementSibling.tagName === 'svg' && sel.nextElementSibling.getAttribute('aria-hidden') === 'true' && vl.rod.querySelector('label').htmlFor === sel.id && vl.rod.querySelector('label').className === 'label' && sel.options.length === 3 && sel.options[2].disabled && sel.options[2].getAttribute('data-t') === 'aldrig' && vl.valgt === '30' && sel.getAttribute('aria-describedby') === vl.rod.querySelector('.hj').id);
  sel.value = '7';
  sel.dispatchEvent(new w.Event('change', { bubbles: true }));
  vl.vaelg('30');
  tjek('K11 (valgliste): et valg kalder vedValg(id); vaelg(id) udefra kalder den ikke; fejl giver aria-invalid', vlKald.join() === '7' && vl.valgt === '30' && K.valgliste({ etiket: 'x', fejl: 'Vælg.', valg: [{ id: 'a', tekst: 'a' }] }).select.getAttribute('aria-invalid') === 'true');
  tjek('K11 (CSS): boksen er appearance: none med kant i border-strong, valgt fyldt med accent og flueben, delvis med en streg, radioknappen rund med prik; valglisten har appearance: none og plads til pilen', /\.afk-boks \{\n  -webkit-appearance: none; appearance: none;[^}]*border: 1px solid var\(--border-strong\);/.test(css) && /\.afk-boks:checked, \.afk-boks:indeterminate \{ background: var\(--accent\); border-color: var\(--accent\); \}/.test(css) && /\.afk-boks\[type="checkbox"\]:checked::before \{ content: "";/.test(css) && /\.afk-boks\[type="checkbox"\]:indeterminate::before \{ content: ""; width: 8px; height: 2px;/.test(css) && /\.afk-boks\[type="radio"\] \{ border-radius: 50%; \}/.test(css) && /\.vliste select \{\n  -webkit-appearance: none; appearance: none;[^}]*padding: 0 32px 0 10px;/.test(css) && /\.afk \{[^}]*min-height: 24px;/.test(css));
  tjek('KOMPONENTER.md: Afkrydsning, Radiogruppe, Kontakt og Valgliste har alle syv dele, og "Hvilken kontrol hvornår" nævner valgliste, vælger, radiogruppe og segmentknap', ['Afkrydsning', 'Radiogruppe', 'Kontakt', 'Valgliste'].every(n => harDele(n)) && (() => { const o = afsnitAf('Hvilken kontrol hvornår'); return ['Valgliste (`Kit.valgliste`', 'Vælger (`Kit.vaelger`)', 'Radiogruppe (`Kit.radiogruppe`)', 'Segmentknap (`Kit.segment`)', 'Kontakt (`Kit.kontakt`)', 'Afkrydsning (`Kit.afkrydsning`)', 'Filterchip'].every(x => o.includes(x)); })() && /en hjemmebygget listeboks laves kun, hvis et program viser/i.test(afsnitAf('Valgliste')));
  // ── K10: dialog ── jsdom har ikke showModal og close; de efterlignes her som i Grimnirs UI-test (open, returnValue,
  // cancel og close). Fokusfælden og Esc er browserens og kan ikke prøves i jsdom; testen holder, at kittet bruger dem.
  const modaler = [];
  w.HTMLDialogElement.prototype.showModal = function () { modaler.push(this); this.setAttribute('open', ''); };
  w.HTMLDialogElement.prototype.close = function (v) { if (!this.hasAttribute('open')) return; this.removeAttribute('open'); if (v !== undefined) this.returnValue = v; this.dispatchEvent(new w.Event('close')); };
  const escDialog = dlgEl => { if (dlgEl.dispatchEvent(new w.Event('cancel', { cancelable: true }))) dlgEl.close(); };
  const dlgSvar = [];
  const aabner = d.createElement('button');
  aabner.textContent = 'Omdøb';
  d.body.appendChild(aabner);
  const navnF = K.felt({ etiket: 'Navn', vaerdi: 'Sag' });
  let gyldig = false;
  const dl = K.dialog({ tekst: 'Omdøb sagen', p: 'Navnet ses kun her.', indhold: navnF, luk: { aria: 'Luk' }, knapper: [{ id: 'gem', tekst: 'Gem', variant: 'primary', ved: () => gyldig }, { id: 'annuller', tekst: 'Annullér' }], vedLuk: s => dlgSvar.push(s) });
  const dlH = dl.overskrift, dlP = dl.rod.querySelector('.modal-tekst');
  tjek('K10: browserens <dialog class="modal"> med aria-labelledby (h2) og aria-describedby (sætningen); ikke på siden før aabn()', dl.rod.tagName === 'DIALOG' && dl.rod.className === 'modal' && dl.rod.getAttribute('aria-labelledby') === dlH.id && dlH.tagName === 'H2' && dlH.textContent === 'Omdøb sagen' && dl.rod.getAttribute('aria-describedby') === dlP.id && dlP.textContent === 'Navnet ses kun her.' && !dl.rod.isConnected && !dl.aaben);
  const fodKn = [...dl.rod.querySelectorAll('.modal-fod .btn')];
  tjek('K10: fodlinjen har knapperne med den primære yderst til højre (også når den står først i listen); lukkeknap med navn', fodKn.map(b => b.dataset.svar).join() === 'annuller,gem' && fodKn[1].classList.contains('primary') && dl.knap('gem') === fodKn[1] && dl.rod.querySelector('.modal-top .modal-luk').getAttribute('aria-label') === 'Luk' && dl.rod.querySelector('.modal-top .modal-luk').type === 'button');
  aabner.focus();
  dl.aabn();
  tjek('K10: aabn() sætter dialogen ind i <body> og åbner med showModal (modal: fokusfælde og Esc fra browseren); fokus på det første felt', dl.rod.parentElement === d.body && modaler.at(-1) === dl.rod && dl.aaben && d.activeElement === navnF.querySelector('input') && /rod\.showModal\(\)/.test(kitJs) && !/\.show\(\)/.test(kitJs));
  dl.knap('gem').click();
  const holdtAaben = dl.aaben && dlgSvar.length === 0;
  gyldig = true;
  dl.knap('gem').click();
  tjek('K10: ved, der giver false, holder dialogen åben; ellers lukker den med knappens id som svar; fokus tilbage til det, der åbnede; returnValue', holdtAaben && !dl.aaben && dlgSvar.join() === 'gem' && d.activeElement === aabner && dl.rod.returnValue === 'gem');
  dl.aabn();
  escDialog(dl.rod);
  dl.aabn();
  dl.rod.querySelector('.modal-luk').click();
  dl.aabn();
  dl.luk();
  tjek('K10: Esc giver svaret "esc", lukkeknappen "luk", luk() fra koden "kode"; fokus går tilbage hver gang', dlgSvar.join() === 'gem,esc,luk,kode' && d.activeElement === aabner);
  const dlF = K.dialog({ tekst: 'Slet?', knapper: [{ id: 'nej', tekst: 'Annullér' }, { id: 'ja', tekst: 'Slet', variant: 'danger' }] });
  dlF.aabn();
  const fokusFarlig = d.activeElement === dlF.knap('nej');
  dlF.luk();
  const dlP2 = K.dialog({ tekst: 'Gem?', knapper: [{ id: 'nej', tekst: 'Nej' }, { id: 'ja', tekst: 'Ja', variant: 'primary' }] });
  dlP2.aabn();
  const fokusPri = d.activeElement === dlP2.knap('ja');
  dlP2.luk();
  dlP2.aabn('nej');
  const fokusValgt = d.activeElement === dlP2.knap('nej');
  dlP2.luk();
  let lukUdenNavn = '';
  try { K.dialog({ tekst: 'x', luk: true }); } catch (e) { lukUdenNavn = e.message; }
  tjek('K10: en lukkeknap uden navn (luk: true) giver en fejl; med ariaT får den data-t-aria', /lukkeknappen skal have et navn/.test(lukUdenNavn) && K.dialog({ tekst: 'x', luk: { ariaT: 'lukAria' } }).rod.querySelector('.modal-luk').getAttribute('data-t-aria') === 'lukAria', lukUdenNavn);
  const dlTom = K.dialog({ tekst: 'Kun tekst' });
  dlTom.aabn();
  tjek('K10: fokus ved åbning: ved en farlig handling på knappen, der ikke er farlig; ellers den primære; aabn(id) peger selv; uden knapper overskriften', fokusFarlig && fokusPri && fokusValgt && d.activeElement === dlTom.overskrift && dlTom.overskrift.tabIndex === -1 && !dlTom.rod.querySelector('.modal-fod') && !dlTom.rod.hasAttribute('aria-describedby'));
  dlTom.luk();
  const bekSvar = [];
  aabner.focus();
  const b1 = K.bekraeft({ tekst: 'Slet sagen?', p: 'Det kan ikke fortrydes.', nej: { t: 'annuller' }, ja: 'Slet', farlig: true, udfyld: rod => bekSvar.push('udfyldt:' + rod.tagName) }).then(v => bekSvar.push(v));
  const bDlg = modaler.at(-1);
  const bKn = [...bDlg.querySelectorAll('.modal-fod .btn')];
  const bFokus = d.activeElement === bKn[0];
  bKn[1].click();
  await b1;
  const b2 = K.bekraeft({ tekst: 'Gem?', nej: 'Nej', ja: 'Ja' }).then(v => bekSvar.push(v));
  const b2Dlg = modaler.at(-1);
  const b2Pri = b2Dlg.querySelector('.modal-fod .btn.primary') && d.activeElement === b2Dlg.querySelector('.modal-fod .btn.primary');
  escDialog(b2Dlg);
  await b2;
  tjek('K10 (bekraeft): to knapper, nej til venstre og ja til højre; farlig giver .btn.danger og fokus på nej; ellers primær med fokus; løftet giver true ved ja og false ved Esc; udfyld før åbning; dialogen fjernes bagefter', bKn.map(b => b.className + ':' + b.dataset.svar).join() === 'btn:nej,btn danger:ja' && bKn[0].querySelector('span').getAttribute('data-t') === 'annuller' && bFokus && b2Pri && bekSvar.join() === 'udfyldt:DIALOG,true,false' && !bDlg.isConnected && !b2Dlg.isConnected && d.activeElement === aabner);
  tjek('K10 (CSS): målene fra Grimnirs .dlg (480 px, luft 24 px, radius-lg, shadow-pop, baggrunden rail 45 %); .bred 620 px; ruller ved for lidt højde; fodlinjen til højre; .modal selv sætter ikke display (en lukket dialog forbliver skjult)', /\.modal \{\n  width: min\(480px, calc\(100vw - 2 \* var\(--space-6\)\)\); max-height: calc\(100vh - 2 \* var\(--space-6\)\);\n  padding: var\(--space-6\); border: 1px solid var\(--border\); border-radius: var\(--radius-lg\);\n  background: var\(--surface\); color: var\(--text\); box-shadow: var\(--shadow-pop\); overflow: auto;\n\}/.test(css) && /\.modal::backdrop \{ background: var\(--rail\); opacity: \.45; \}/.test(css) && /\.modal\.bred \{ width: min\(620px,/.test(css) && /\.modal-fod \{ display: flex; flex-wrap: wrap; justify-content: flex-end;/.test(css) && /\.dlg::backdrop \{ background: var\(--rail\); opacity: \.45; \}/.test(fs.readFileSync(path.join(repo, 'ui', 'assets', 'app.css'), 'utf8')) && !/(?:^|\n)\.modal(?:\.bred)? \{[^}]*display:/.test(css) && /(?:^|\n)\.modal-top \{ display: flex;/.test(css));
  tjek('KOMPONENTER.md: Dialog har alle syv dele og siger, hvor fokus går hen, at den primære står til højre, og hvad Esc giver', harDele('Dialog') && /Fokus ved åbning/.test(afsnitAf('Dialog')) && /Fokus ved lukning/.test(afsnitAf('Dialog')) && /yderst til højre/.test(afsnitAf('Dialog')) && /`\.btn\.danger`/.test(afsnitAf('Dialog')) && /'esc'/.test(afsnitAf('Dialog')) && /`Kit\.bekraeft`/.test(afsnitAf('Dialog')));
  // ── K15: tabel med sortering, to hovedrækker og sideskift ──
  const bygTabel = K2 => {
    const t = K2.tabel({ ariaT: 'tabelAria', kolonner: [{ t: 'kolVaerdi' }, { tekst: 'Status' }, { t: 'kolAntal', tal: true }], raekker: [
      { gruppe: { t: 'grpAdresser' }, note: '2 rækker' },
      { celler: ['192.0.2.17', K2.chip('ok', 'Maskeres'), 4], mono: [0], data: 1 },
      { celler: ['2001:db8::17', null, 12], mono: [0], data: 2 },
      { gruppe: 'Navne' },
      { celler: ['srv-app01.eksempel.dk', K2.chip('warn', { t: 'cWarn' }), 0], mono: [0], data: 3 },
    ] });
    const foer = t.outerHTML;
    t.vaelg(1);
    return { tabel: foer, tabelValgt: t.outerHTML, t };
  };
  const nuT = bygTabel(K);
  tjek('K15: uden de nye indstillinger er tabellen byte for byte som i 2.0.0 (bygget og efter vaelg; snapshot fra 2.0.0\'s kit.js)', nuT.tabel === V200_TABEL.tabel && nuT.tabelValgt === V200_TABEL.tabelValgt && !/sorter|aria-sort|colgroup|kolgruppe/.test(nuT.tabel));
  const sKald = [];
  const valgtT = [];
  const st = K.tabel({ kolonner: [{ tekst: 'Navn', sort: true }, { tekst: 'Antal', tal: true, sort: true, sortStart: 'faldende' }, { tekst: 'Note' }], sortering: { kolonne: 0, retning: 'stigende' }, raekker: [{ celler: ['a', 1, 'x'], data: 'a' }, { celler: ['b', 2, 'y'], data: 'b' }, { celler: ['c', 3, 'z'], data: 'c' }], vedSortering: (k, r) => sKald.push(k + ':' + r), vedValg: (tr, data) => valgtT.push(data) });
  d.body.appendChild(st);
  const ths = [...st.querySelectorAll('thead th')];
  const knapS = i => ths[i].querySelector('button.sorter');
  const pilS = i => ths[i].querySelector('.sorter-pil').textContent;
  tjek('K15 (sortering): en kolonne med sort er en knap (type="button") i hovedet med navn og pil (aria-hidden); en uden er tekst som før', knapS(0) && knapS(0).type === 'button' && knapS(0).firstChild.textContent === 'Navn' && ths[0].querySelector('.sorter-pil').getAttribute('aria-hidden') === 'true' && !knapS(2) && ths[2].textContent === 'Note' && ths.every(th => th.scope === 'col') && ths[1].className === 'r');
  tjek('K15 (sortering): den sorterede kolonne har aria-sort="ascending" og ▲; de andre ingen aria-sort og ↕ (kan sorteres)', ths[0].getAttribute('aria-sort') === 'ascending' && pilS(0) === '▲' && !ths[1].hasAttribute('aria-sort') && pilS(1) === '↕' && !ths[2].hasAttribute('aria-sort'));
  knapS(0).focus();
  knapS(0).click();
  const efterVend = ths[0].getAttribute('aria-sort') === 'descending' && pilS(0) === '▼';
  knapS(1).click();
  tjek('K15 (sortering): klik på den sorterede vender retningen (descending, ▼); en ny kolonne begynder med sortStart (faldende); vedSortering får kolonne og retning', efterVend && sKald.join() === '0:faldende,1:faldende' && ths[1].getAttribute('aria-sort') === 'descending' && !ths[0].hasAttribute('aria-sort') && pilS(0) === '↕');
  knapS(1).focus();
  st.saetRaekker([{ celler: ['c', 3, 'z'], data: 'c' }, { celler: ['b', 2, 'y'], data: 'b' }]);
  const rk = [...st.querySelectorAll('tbody tr')];
  tjek('K15: saetRaekker bygger rækkerne om uden at røre hovedet (fokus bliver på sorteringsknappen); den første række kan nås med Tab', d.activeElement === knapS(1) && rk.length === 2 && rk[0].textContent === 'c3z' && rk[0].tabIndex === 0 && rk[1].tabIndex === -1 && ths[1].getAttribute('aria-sort') === 'descending');
  rk[0].click();
  rk[0].dispatchEvent(new w.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
  const nedOk = rk[1].classList.contains('sel') && d.activeElement === rk[1];
  rk[1].dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true }));
  tjek('K15: tastaturet fra 2.0.0 virker stadig efter saetRaekker (klik, pil ned, Home); vedValg får rækkens data', nedOk && rk[0].classList.contains('sel') && rk[0].getAttribute('aria-selected') === 'true' && valgtT.join() === 'c,b,c');
  st.saetSortering(2, 'stigende');
  const n0 = sKald.length;
  st.saetSortering(0, 'faldende');
  tjek('K15: saetSortering sætter sorteringen udefra uden at kalde vedSortering (også på en kolonne uden knap: ingen aria-sort)', sKald.length === n0 && n0 === 2 && ths[0].getAttribute('aria-sort') === 'descending' && st.querySelectorAll('[aria-sort]').length === 1);
  const gt = K.tabel({ kolonnegrupper: [{ id: 'af', tekst: 'Afvist' }, { id: 'an', t: 'thAngreb' }], kolonner: [{ tekst: 'Domæne', sort: true }, { tekst: 'Status' }, { tekst: 'I går', tal: true, gruppe: 'af' }, { tekst: '7 dage', tal: true, gruppe: 'af' }, { tekst: '30 dage', tal: true, gruppe: 'af' }, { tekst: 'Uge', tal: true, gruppe: 'an' }, { tekst: 'Åbn' }], raekker: [{ celler: ['eksempel.dk', 'ok', 1, 2, 3, 4, '›'] }] });
  const [gr1, gr2] = gt.querySelectorAll('thead tr');
  const cgs = [...gt.querySelectorAll(':scope > colgroup')];
  tjek('K15 (to hovedrækker): én <colgroup> pr. gruppe (span) og pr. kolonne uden gruppe, før <thead>', cgs.map(c => c.span).join() === '1,1,3,1,1' && gt.firstElementChild.tagName === 'COLGROUP' && cgs.length === 5 && gt.querySelector('thead').previousElementSibling === cgs[4] && cgs[2].getAttribute('span') === '3' && !cgs[0].hasAttribute('span'));
  tjek('K15 (to hovedrækker): første række har kolonnerne uden gruppe (rowspan="2", scope="col") og gruppeoverskrifterne (.kolgruppe, scope="colgroup", colspan); anden række gruppernes kolonner (scope="col")', [...gr1.children].map(th => (th.rowSpan === 2 ? 'r2:' : '') + th.scope + ':' + (th.colSpan || 1) + ':' + th.textContent).join('|') === 'r2:col:1:Domæne↕|r2:col:1:Status|colgroup:3:Afvist|colgroup:1:|r2:col:1:Åbn' && gr1.children[2].className === 'kolgruppe' && gr1.children[3].getAttribute('data-t') === 'thAngreb' && [...gr2.children].map(th => th.scope + ':' + th.textContent + ':' + th.className).join('|') === 'col:I går:r|col:7 dage:r|col:30 dage:r|col:Uge:r' && gt.querySelectorAll('tbody td').length === 7);
  const sdKald = [], prKald = [];
  const sd = K.sideskift({ aria: 'Sider', side: 1, sider: 3, forrige: 'Forrige', naeste: 'Næste', sideAf: 'Side {v} af {w}', valg: [25, 50, 100], prSide: 50, prSideEtiket: 'Pr. side', vedSide: n => sdKald.push(n), vedPrSide: n => prKald.push(n) });
  d.body.appendChild(sd.rod);
  const [sdF, sdN] = sd.rod.querySelectorAll('button.btn');
  const sdNr = sd.rod.querySelector('.sideskift-nr');
  tjek('K15 (sideskift): <nav> med navn, Forrige, "Side 1 af 3" (role="status"), Næste og antal pr. side (<select> i .vliste med etiket); Forrige har aria-disabled på første side', sd.rod.tagName === 'NAV' && sd.rod.className === 'sideskift' && sd.rod.getAttribute('aria-label') === 'Sider' && sdF.dataset.side === 'forrige' && sdF.textContent === 'Forrige' && sdF.getAttribute('aria-disabled') === 'true' && sdN.getAttribute('aria-disabled') === 'false' && sdNr.textContent === 'Side 1 af 3' && sdNr.getAttribute('role') === 'status' && sd.rod.querySelector('label.sideskift-pr .vliste select').value === '50' && sd.prSide === 50 && sd.rod.querySelector('label.sideskift-pr > span').textContent === 'Pr. side');
  sdF.click();
  sdN.focus(); sdN.click(); sdN.click();
  const ved3 = sdNr.textContent === 'Side 3 af 3' && sdN.getAttribute('aria-disabled') === 'true' && d.activeElement === sdN;
  sdN.click();
  tjek('K15 (sideskift): Forrige på første side gør intet; Næste flytter og kalder vedSide(n); på sidste side har Næste aria-disabled og beholder fokus, og et klik gør intet', ved3 && sdKald.join() === '2,3' && sd.side === 3);
  sd.saet(1, 5);
  const sel2 = sd.rod.querySelector('select');
  sel2.value = '100'; sel2.dispatchEvent(new w.Event('change', { bubbles: true }));
  tjek('K15 (sideskift): saet(side, sider) udefra kalder ikke vedSide; antal pr. side kalder vedPrSide(n)', sdNr.textContent === 'Side 1 af 5' && sd.sider === 5 && sdKald.length === 2 && prKald.join() === '100');
  const sdT = K.sideskift({ ariaT: 'siderAria', side: 2, sider: 9, forrige: { t: 'forrige' }, naeste: { t: 'naeste' }, sideAf: { t: 'sideAf' } });
  const sdTnr = sdT.rod.querySelector('.sideskift-nr');
  tjek('K15 (sideskift): nøgler giver data-t (og data-v/data-w med side og sider); uden valg intet antal pr. side', sdT.rod.getAttribute('data-t-aria') === 'siderAria' && sdTnr.getAttribute('data-t') === 'sideAf' && sdTnr.getAttribute('data-v') === '2' && sdTnr.getAttribute('data-w') === '9' && !sdT.rod.querySelector('select') && sdT.prSide === null && sdT.rod.querySelector('[data-side="forrige"] span').getAttribute('data-t') === 'forrige');
  tjek('K15 (CSS): sorteringsknappen arver hovedets udseende (font, store bogstaver) uden egen flade; den sorterede står i tekstens farve; gruppeoverskriften er centreret; sideskiftet står under tabellen med en kant', /\.tabel th \.sorter \{[^}]*border: 0; background: none; color: inherit; font: inherit; letter-spacing: inherit; text-transform: inherit; cursor: pointer;/.test(css) && /\.tabel th \.sorter:hover, \.tabel th\[aria-sort\] \{ color: var\(--text\); \}/.test(css) && /\.tabel th\.kolgruppe \{ text-align: center; \}/.test(css) && /\.sideskift \{[^}]*border-top: 1px solid var\(--border\);/.test(css) && css.indexOf('.tabel th .sorter') > css.indexOf('/* ── DataTable ── */') && css.indexOf('.tabel th .sorter') < css.indexOf('/* ── AppShell ── */'));
  tjek('KOMPONENTER.md (DataTable): Kit.sideskift, de nye klasser, valget "programmet sorterer selv" med begrundelse, og at uden indstillingerne er tabellen som i 2.0.0', /\*\*Funktioner:\*\* `Kit\.tabel`, `Kit\.sideskift`/.test(afsnitAf('DataTable')) && /### Sortering, to hovedrækker og sideskift \(fra 2\.3\.0\)/.test(afsnitAf('DataTable')) && /\*\*Programmet sorterer selv\*\*/.test(afsnitAf('DataTable')) && /byte for byte som i 2\.0\.0/.test(afsnitAf('DataTable')) && /aria-sort/.test(afsnitAf('DataTable')) && /scope="colgroup"/.test(afsnitAf('DataTable')) && /\*\*programmet leverer siderne\*\*/.test(afsnitAf('DataTable')));
  // ── K17: tekststørrelse i tre trin ──
  const temaJs = pk('web/tema.js');
  const T = w.Tekst, html = d.documentElement;
  const tekstMeld = [];
  d.addEventListener('proeve-tekst', () => tekstMeld.push(T.valg));
  tjek('K17: tema.js giver Tekst med TRIN (lille, normal, stor), valg, saet, større, mindre og nulstil; uden valg er det normal og <html> har ingen data-tekst (som før)', JSON.stringify(T.TRIN) === '["lille","normal","stor"]' && T.valg === 'normal' && !html.hasAttribute('data-tekst') && ['saet', 'større', 'mindre', 'nulstil'].every(f => typeof T[f] === 'function') && w.localStorage.getItem('proeve-tekst') === null);
  T.saet('stor');
  const efterStor = html.getAttribute('data-tekst') === 'stor' && w.localStorage.getItem('proeve-tekst') === 'stor';
  T.større();
  const ved = [T.valg];
  T.mindre(); ved.push(T.valg); T.mindre(); ved.push(T.valg); T.mindre(); ved.push(T.valg, html.getAttribute('data-tekst'));
  T.nulstil();
  tjek('K17: saet husker under præfikset (<præfiks>-tekst) og sætter data-tekst; større og mindre stopper ved enderne; nulstil giver normal uden attribut; hvert skift melder <præfiks>-tekst', efterStor && ved.join() === 'stor,normal,lille,lille,lille' && T.valg === 'normal' && !html.hasAttribute('data-tekst') && w.localStorage.getItem('proeve-tekst') === 'normal' && tekstMeld.join() === 'stor,stor,normal,lille,lille,normal');
  T.saet('kæmpe');
  tjek('K17: et ukendt trin giver normal', T.valg === 'normal' && !html.hasAttribute('data-tekst'));
  const wGemt = (() => {
    const dom = new JSDOM('<!doctype html><html data-kit-praefiks="proeve"><head></head><body></body></html>', { runScripts: 'outside-only', url: 'http://kit.invalid/', pretendToBeVisual: true });
    dom.window.localStorage.setItem('proeve-tekst', 'lille');
    dom.window.eval(temaJs);
    return dom.window;
  })();
  tjek('K17: et gemt valg sættes, så snart tema.js kører (i <head>, før første tegning)', wGemt.document.documentElement.getAttribute('data-tekst') === 'lille' && wGemt.Tekst.valg === 'lille' && /getAttribute\('data-kit-praefiks'\) \|\| 'wi24rd'\) \+ '-tekst'/.test(temaJs));
  wGemt.close();
  tjek('K17 (CSS): én fælles skala med zoom på roden (.9 og 1.125); normal har ingen regel; .vindue, vælgerens liste og dialogen deler de mål, der følger vinduet, med trinnet; .vindue selv er uændret', /:root\[data-tekst="lille"\] \{ zoom: \.9; \}/.test(css) && /:root\[data-tekst="stor"\] \{ zoom: 1\.125; \}/.test(css) && !/data-tekst="normal"/.test(css) && /:root\[data-tekst="stor"\] \.vindue \{ height: calc\(100vh \/ 1\.125\); min-width: calc\(900px \/ 1\.125\); min-height: calc\(560px \/ 1\.125\); \}/.test(css) && /:root\[data-tekst="lille"\] \.vindue \{ height: calc\(100vh \/ \.9\); min-width: calc\(900px \/ \.9\); min-height: calc\(560px \/ \.9\); \}/.test(css) && /:root\[data-tekst="stor"\] \.vlg-pop \{/.test(css) && /:root\[data-tekst="lille"\] \.modal \{/.test(css) && /(?:^|\n)\.vindue \{ display: flex; flex-direction: column; height: 100vh; min-width: 900px; min-height: 560px; background: var\(--bg\); overflow: hidden; \}/.test(css) && (css.match(/zoom:/g) || []).length === 2);
  const tekstAfsnit = afsnitAf('Tekststørrelse');
  tjek('KOMPONENTER.md: Tekststørrelse har formål, markup, tilstande, tastatur og krav; mekanismen (zoom), målingen i WKWebView og at WebView2 ikke er målt', harDele('Tekststørrelse', DELE.filter(x => x !== '**Klasser:**')) && /zoom/.test(tekstAfsnit) && /\*\*Målt i WKWebView\*\*/.test(tekstAfsnit) && /\*\*WebView2 \(Chromium, Windows\) er ikke målt\.\*\*/.test(tekstAfsnit) && /900 × 560/.test(tekstAfsnit) && /Jans valg/.test(tekstAfsnit));
  // ── Pakken 2.3.0: CHANGELOG, README, KOMPONENTER og flyttevejledningen ──
  const log = pk('CHANGELOG.md');
  const post = log.slice(log.indexOf('## 2.3.0'), log.indexOf('\n## ', log.indexOf('## 2.3.0') + 1));
  tjek('CHANGELOG 2.3.0: første post med kun dato, nævner K10–K17, de nye funktioner, og at intet er omdøbt eller fjernet', log.indexOf('## 2.3.0 — 2026-11-11') > 0 && log.indexOf('## 2.3.0') < log.indexOf('## 2.2.0') && ['(K10)', '(K11)', '(K12)', '(K13)', '(K14)', '(K15)', '(K16)', '(K17)', 'Intet er omdøbt eller fjernet', 'byte for byte som i 2.0.0', 'style-src \'self\''].every(o => post.includes(o)) && V230_FUNKTIONER.every(f => post.includes('`' + f + '`')) && ['Tekst', 'saetRaekker', 'saetSortering'].every(o => post.includes(o)), V230_FUNKTIONER.filter(f => !post.includes('`' + f + '`')).join(', '));
  const readme = pk('README.md');
  const ikke = readme.slice(readme.indexOf('## Hvad pakken ikke indeholder'), readme.indexOf('## Licens'));
  tjek('README 2.3.0: indholdslisten nævner de nye funktioner og Tekst; "Hvad pakken ikke indeholder" nævner ikke længere dialog, værktøjstip, tom tilstand, fremdrift, afkrydsning, kontakt, valgliste, StatusTile eller tekststørrelse som manglende', V230_FUNKTIONER.every(f => readme.includes('`' + f + '`')) && /`window\.Tekst`/.test(readme) && /\*\*Menu, Cover og en egen listeboks\.\*\*/.test(ikke) && !/\*\*Dialog, menu, værktøjstip/.test(ikke) && !/Tekststørrelse eller tæthed som valg|Kittet har én størrelse/.test(ikke) && /fra 2\.3\.0/.test(ikke) && /Tekst\.saet\('stor'\)/.test(readme));
  const findes = md.slice(md.indexOf('## Findes ikke endnu'));
  tjek('KOMPONENTER.md: "Findes ikke endnu" er rettet: StatusTile, Dialog, Værktøjstip, Tom tilstand, Fremdrift, afkrydsning, kontakt og valgliste står ikke længere som manglende', !/\| (StatusTile|Dialog|Værktøjstip|Tom tilstand|Fremdrift) \|/.test(findes) && !/\| Afkrydsning, kontakt/.test(findes) && /\| Cover \|/.test(findes) && /\| Menu \|/.test(findes) && /Fra 2\.3\.0 er Dialog, Afkrydsning, Kontakt, Radiogruppe, Valgliste, StatusTile, Kasse \(kort\), Tom tilstand, Fremdrift, Værktøjstip, Filterchip og Tekststørrelse kode/.test(findes));
  const hm = pk('flytning/HUGINN-MUNINN.md');
  tjek('flytning/HUGINN-MUNINN.md: K10–K17 står som opfyldt i 2.3.0 med hvad de afløser; det siges, at alle 17 er opfyldt; tekststørrelse og komponenterne står ikke længere som umulige at flytte', ['K10', 'K11', 'K12', 'K13', 'K14', 'K15', 'K16', 'K17'].every(k => new RegExp('\\| ' + k + ' [^|]*\\| 2\\.3\\.0 \\|[^\\n]*Afløser').test(hm)) && /\*\*Alle 17 ønsker \(K1–K17\) er opfyldt med 2\.3\.0\.\*\*/.test(hm) && !/\| Tekststørrelse i tre trin \(`data-density`\) \| Kit 2 har én størrelse/.test(hm) && !/\| Dialoger, afkrydsning/.test(hm) && /compact` → `lille`/.test(hm) && /K18–K21/.test(hm));
  tjek('demo 2.3.0: versionen på siden er 2.3.0 eller nyere (fra 2.4.0: 2.4.0)', (pk('demo/index.html').match(/data-v="2\.[34]\.0"/g) || []).length === 3);
  tjek('KOMPONENTER.md: Filterchip har alle syv dele og siger, at .chip ikke kan klikkes', harDele('Filterchip') && /aria-pressed/.test(afsnitAf('Filterchip')) && /kan ikke klikkes/.test(afsnitAf('Filterchip')));

  w.close();
}
{
  // Demoen 2.3.0 med pakkens rigtige filer, i begge sprog og temaer.
  const dom = await JSDOM.fromFile(demoFil, { runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, virtualConsole: new VirtualConsole() });
  const w = dom.window, d = w.document;
  await new Promise(r => (d.readyState === 'complete' ? r() : w.addEventListener('load', r)));
  await vent(20);
  const sektion = n => d.querySelector(`#v-komponenter .demo-sektion[data-navn="${n}"]`);
  const NYE = ['Filterchip', 'Kasse', 'StatusTile', 'Tom tilstand', 'Fremdrift', 'Værktøjstip', 'Afkrydsning', 'Kontakt', 'Radiogruppe', 'Valgliste', 'Dialog', 'Tekststørrelse'];
  tjek('demo 2.3.0: en sektion for hver ny komponent, med overskrift og en tekst, der begynder med "Fra 2.3.0"', NYE.every(n => sektion(n) && sektion(n).querySelector('h2').textContent && sektion(n).querySelector('p').textContent.startsWith('Fra 2.3.0')), NYE.filter(n => !(sektion(n) && sektion(n).querySelector('p').textContent.startsWith('Fra 2.3.0'))).join(', '));
  const chips = [...d.querySelectorAll('#demo-filterchips .fchip')];
  chips[1].click();
  tjek('demo 2.3.0 (K16): filterchips i en gruppe; et klik slår til og melder de valgte (dansk)', chips.length === 3 && d.querySelector('#demo-filterchips .fchips[role="group"]') && chips[1].getAttribute('aria-pressed') === 'true' && d.getElementById('filterchip-valgt').textContent === 'Valgt: Fejl, Advarsler');
  const afkDemo = [...d.querySelectorAll('#demo-afk input.afk-boks')];
  const alleDemo = afkDemo[0];
  const delvisDemo = alleDemo.indeterminate;
  alleDemo.click();
  tjek('demo 2.3.0 (K11): "Vælg alle typer" er delvis valgt fra start; et klik vælger alle tre og melder dem (dansk)', delvisDemo && !alleDemo.indeterminate && alleDemo.checked && afkDemo.slice(1, 4).every(i => i.checked) && d.getElementById('afk-valgt').textContent === 'Valgt: IP-adresser, Værtsnavne, Brugernavne');
  afkDemo[2].click();
  tjek('demo 2.3.0 (K11): fravælges én, bliver "Vælg alle" delvis igen; feltet med fejl har aria-invalid', alleDemo.indeterminate && Boolean(d.querySelector('#demo-afk .afk-hj.fejltekst')) && afkDemo[5].getAttribute('aria-invalid') === 'true');
  const tfDemo = d.querySelector('#demo-kontakt input.tilfra');
  tfDemo.click();
  tjek('demo 2.3.0 (K11): kontakten slår fra og melder det; den deaktiverede kan ikke bruges', !tfDemo.checked && d.getElementById('kontakt-valgt').textContent === 'Valgt: Fra' && d.querySelectorAll('#demo-kontakt input.tilfra')[1].disabled);
  d.querySelectorAll('#demo-radio fieldset')[0].querySelectorAll('input')[1].click();
  const selDemo = d.querySelector('#demo-valgliste select');
  selDemo.value = '90'; selDemo.dispatchEvent(new w.Event('change', { bubbles: true }));
  tjek('demo 2.3.0 (K11): radiogruppen og valglisten melder valget; den vandrette gruppe og valglisten med fejl står der', d.getElementById('radio-valgt').textContent === 'Valgt: Kun hemmeligheder' && d.getElementById('valgliste-valgt').textContent === 'Valgt: 90 dage' && Boolean(d.querySelector('#demo-radio fieldset.valgsaet.vandret')) && d.querySelectorAll('#demo-valgliste select')[1].getAttribute('aria-invalid') === 'true' && selDemo.options[0].textContent === '7 dage');
  const tnRaekker = () => [...d.querySelectorAll('#demo-tabel-ny tbody tr')].map(tr => tr.firstChild.textContent);
  const tnFoer = tnRaekker();
  const tnTh = [...d.querySelectorAll('#demo-tabel-ny thead th')];
  const tnNaeste = d.querySelector('#demo-tabel-ny .sideskift [data-side="naeste"]');
  tnNaeste.click();
  const tnSide2 = tnRaekker();
  d.querySelector('#demo-tabel-ny thead th:first-child .sorter').click();
  tjek('demo 2.3.0 (K15): to hovedrækker (Afvist over to kolonner, Angreb over én), side 1 af 3 med fem rækker; Næste viser de næste fem; et klik på Domæne vender sorteringen og går til side 1 (dansk)', tnTh.length === 6 && tnTh[1].textContent === 'Afvist' && tnTh[1].colSpan === 2 && tnTh[2].textContent === 'Angreb' && tnFoer.length === 5 && tnFoer[0] === 'api.eksempel.dk' && tnSide2[0] === 'intra.eksempel.dk' && tnRaekker()[0] === 'www.eksempel.dk' && d.querySelector('#demo-tabel-ny thead th:first-child').getAttribute('aria-sort') === 'descending' && d.querySelector('#demo-tabel-ny .sideskift-nr').textContent === 'Side 1 af 3');
  w.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  w.HTMLDialogElement.prototype.close = function (v) { if (!this.hasAttribute('open')) return; this.removeAttribute('open'); if (v !== undefined) this.returnValue = v; this.dispatchEvent(new w.Event('close')); };
  const [dlgOmdoeb, dlgSlet] = d.querySelectorAll('#demo-dialog .btn');
  dlgOmdoeb.focus(); dlgOmdoeb.click();
  const omdDlg = d.querySelector('dialog.modal[open]');
  const omdInp = omdDlg.querySelector('input');
  const omdFokus = d.activeElement === omdInp && omdDlg.querySelector('h2').textContent === 'Omdøb sagen';
  omdInp.value = '';
  omdDlg.querySelector('.btn.primary').click();
  const omdFejl = omdDlg.open && omdInp.getAttribute('aria-invalid') === '' && omdDlg.querySelector('.hj.fejltekst').textContent === 'Skriv et navn.';
  omdInp.value = 'Leverandør 0007';
  omdDlg.querySelector('.btn.primary').click();
  tjek('demo 2.3.0 (K10): Omdøb åbner med fokus i feltet, holder sig åben ved et tomt navn (fejl), lukker ved Gem og melder svaret; fokus tilbage (dansk)', omdFokus && omdFejl && !omdDlg.open && d.getElementById('dialog-valgt').textContent === 'Svaret var: gem' && d.activeElement === dlgOmdoeb);
  dlgSlet.click();
  const sletDlg = d.querySelector('dialog.modal[open]');
  const sletOk = sletDlg && sletDlg.querySelector('h2').textContent === 'Slet sagen?' && d.activeElement === sletDlg.querySelector('.btn:not(.danger)') && sletDlg.querySelector('.btn.danger span').textContent === 'Slet sag';
  sletDlg.querySelector('.btn:not(.danger)').click();
  await vent(0);
  tjek('demo 2.3.0 (K10): Slet bekræftes i en dialog med fokus på Annullér; nej giver false, og dialogen fjernes', sletOk && !sletDlg.isConnected && d.getElementById('dialog-valgt').textContent === 'Svaret var: false');
  d.querySelector('#demo-tom-tabel .tomt.lille .btn').click();
  tjek('demo 2.3.0 (K14): en stor tom tilstand med handling, en tom tabel med den lille udgave under, fremdrift i begge former og to værktøjstip (dansk)', Boolean(d.querySelector('#demo-tom-stor .tomt:not(.lille) .btn.primary')) && d.querySelectorAll('#demo-tom-tabel table.tabel tbody tr').length === 0 && Boolean(d.querySelector('#demo-tom-tabel .tomt.lille[role="status"]')) && d.getElementById('tom-valgt').textContent === 'Valgt: Ryd filter' && d.querySelector('#demo-frem .frem-bjaelke').value === 3 && d.querySelector('#demo-frem .frem:not(.ubestemt) .frem-tekst').textContent === '3 af 8 filer' && d.getElementById('demo-frem').getAttribute('aria-busy') === 'true' && d.querySelectorAll('#demo-tip .tip[role="tooltip"]').length === 2);
  d.querySelector('#demo-frem-knapper .btn').click();
  tjek('demo 2.3.0 (K14): et trin frem opdaterer bjælken og teksten', d.querySelector('#demo-frem .frem-bjaelke').value === 4 && d.querySelector('#demo-frem .frem:not(.ubestemt) .frem-tekst').textContent === '4 af 8 filer');
  d.querySelectorAll('#demo-fliser .sflise')[1].click();
  tjek('demo 2.3.0 (K12): fire fliser i en liste; en flise melder sit mål (dansk)', d.querySelectorAll('#demo-fliser ul.sfliser[role="list"] > li > button.sflise').length === 4 && d.getElementById('flise-valgt').textContent === 'Valgt: Venter på dig' && Boolean(d.querySelector('#demo-fliser .sflise.warn .sflise-pil')));
  d.querySelector('#demo-kasser .kasse-handling .btn').click();
  tjek('demo 2.3.0 (K13): to kasser, den ene med handling og fodlinje; handlingen melder (dansk)', d.querySelectorAll('#demo-kasser .kasse').length === 2 && d.querySelector('#demo-kasser .kasse-fod') && d.getElementById('kasse-valgt').textContent === 'Valgt: Vis alle');
  const tekstSeg = [...d.querySelectorAll('#demo-tekst .seg-v')];
  const tekstStart = w.Tekst.valg === 'normal' && tekstSeg.map(b => b.getAttribute('aria-checked')).join() === 'false,true,false';
  tekstSeg[2].click();
  const tekstStor = d.documentElement.getAttribute('data-tekst') === 'stor' && d.getElementById('tekst-valgt').textContent === 'Valgt: Stor';
  d.dispatchEvent(new w.KeyboardEvent('keydown', { key: '-', metaKey: true, bubbles: true, cancelable: true }));
  const efterMinus = w.Tekst.valg === 'normal' && tekstSeg[1].getAttribute('aria-checked') === 'true';
  d.dispatchEvent(new w.KeyboardEvent('keydown', { key: '-', ctrlKey: true, bubbles: true, cancelable: true }));
  const efterMinus2 = d.documentElement.getAttribute('data-tekst') === 'lille';
  d.dispatchEvent(new w.KeyboardEvent('keydown', { key: '0', metaKey: true, bubbles: true, cancelable: true }));
  tjek('demo 2.3.0 (K17): segmentknappen og genvejene (⌘− og Ctrl+−, ⌘0) sætter trinnet med kittets funktioner, og knappen følger med', tekstStart && tekstStor && efterMinus && efterMinus2 && !d.documentElement.hasAttribute('data-tekst') && tekstSeg[1].getAttribute('aria-checked') === 'true');
  w.Sprog.saet('en');
  const tomme = () => NYE.flatMap(n => [...sektion(n).querySelectorAll('[data-t]')]).filter(e => !e.textContent.trim()).map(e => e.getAttribute('data-t'));
  tjek('demo 2.3.0 (English): de nye sektioner har tekst', tomme().length === 0 && chips[0].children[1].textContent === 'Errors' && sektion('Filterchip').querySelector('h2').textContent === 'Filter chip' && selDemo.options[0].textContent === '7 days' && d.querySelector('#demo-kontakt .tilfra-fra').textContent === 'Off', tomme().join(', '));
  w.Tema.saet('moerk');
  tjek('demo 2.3.0: mørkt tema sættes på siden med de nye komponenter', d.documentElement.getAttribute('data-tema') === 'moerk');
  w.close();
}

// ── Pakke 2.4.0 (K36–K38, K18–K21, K29, K30): tabellen, farverne og to ændringer, Jan har sagt ja til. ──
{
  const css = pk('web/kit.css'), kitJs = pk('web/kit.js'), md = pk('KOMPONENTER.md'), readme = pk('README.md');
  const afsnitAf = navn => { const i = md.indexOf('\n## ' + navn + '\n'); return i < 0 ? '' : md.slice(i, md.indexOf('\n## ', i + 1)); };
  const ny = () => {
    const dom = new JSDOM('<!doctype html><html data-kit-praefiks="proeve"><body></body></html>', { runScripts: 'outside-only', url: 'http://kit.invalid/', pretendToBeVisual: true });
    for (const f of ['tema.js', 'sprogmotor.js', 'kit.js']) dom.window.eval(pk('web/' + f));
    return dom.window;
  };
  const w = ny(), d = w.document, K = w.Kit;
  const tast = (el, key) => { const e = new w.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }); el.dispatchEvent(e); return e; };
  const fejlAf = f => { try { f(); return ''; } catch (e) { return String(e.message); } };
  const fn = Object.keys(K).map(k => 'Kit.' + k);
  const cssUden = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@font-face\s*\{[^}]*\}/g, '').replace(/@keyframes[^{]*\{(?:[^{}]*\{[^}]*\})*[^}]*\}/g, ' ').replace(/\{[^}]*\}/g, ' ');
  const cssKlasser = new Set([...cssUden.matchAll(/\.([a-z][a-z0-9-]*)/g)].map(m => m[1]));
  tjek('2.4.0: de nye navne i V240_FUNKTIONER og V240_KLASSER findes i Kit og kit.css', V240_FUNKTIONER.every(f => fn.includes(f)) && V240_KLASSER.every(k => cssKlasser.has(k)), [...V240_FUNKTIONER.filter(f => !fn.includes(f)), ...V240_KLASSER.filter(k => !cssKlasser.has(k))].join(', '));
  // Huginn and Muninns egne tabelklasser (app.css, vagt.css): kittet må ikke tage dem, mens programmet flytter.
  const HAM_TABEL = ['sep', 'tal-kol', 'chev', 'st', 'hv', 'v', 'sr-only', 'vg-tabel', 'vg-tabel-rul', 'domaene'];
  tjek('2.4.0: tabellens nye klasser støder ikke sammen med Huginn and Muninns tabelklasser (.sep, .tal-kol, .chev …) eller de optagne', HAM_TABEL.every(k => !cssKlasser.has(k)) && ['kort', 'tom', 'tal', 'sort', 'sider'].every(k => !cssKlasser.has(k)));

  const kol = [{ t: 'kolNavn' }, { t: 'kolStatus' }, { t: 'kolAntal', tal: true }];
  const rk = () => [{ gruppe: { t: 'grp' } }, { celler: ['a.eksempel.dk', 'ok', 1], data: 'a' }, { celler: ['b.eksempel.dk', 'warn', 2], data: 'b' }, { celler: ['c.eksempel.dk', 'ok', 3], data: 'c' }];
  // Uden de nye indstillinger og med raekkeHandling: 'vaelg' er tabellen den samme (2.0.0-snapshot står i K15).
  tjek('K36: raekkeHandling: \'vaelg\' giver præcis samme markup som uden indstillingen (standard)', K.tabel({ ariaT: 'x', kolonner: kol, raekker: rk(), raekkeHandling: 'vaelg' }).outerHTML === K.tabel({ ariaT: 'x', kolonner: kol, raekker: rk() }).outerHTML);
  tjek('K36: en ukendt raekkeHandling, et ukendt layout og en ukendt bredde giver en fejl', /ukendt raekkeHandling: vælg/.test(fejlAf(() => K.tabel({ kolonner: kol, raekker: [], raekkeHandling: 'vælg' }))) && /ukendt layout: flyd/.test(fejlAf(() => K.tabel({ kolonner: kol, raekker: [], layout: 'flyd' }))) && /ukendt bredde: 87/.test(fejlAf(() => K.tabel({ kolonner: [{ t: 'a', bredde: 87 }], raekker: [] }))));

  // ── K36 'aabn' ──
  const aabnet = [];
  const ta = K.tabel({ ariaT: 'x', kolonner: kol, raekker: rk(), raekkeHandling: 'aabn', vedAabn: (tr, data) => aabnet.push(data) });
  d.body.appendChild(ta);
  const rA = () => [...ta.querySelectorAll('tbody tr:not(.gruppe)')];
  tjek('K36 (aabn): role="grid"; én række har tabindex 0, de andre -1; ingen aria-selected og ingen .sel', ta.getAttribute('role') === 'grid' && rA().map(r => r.tabIndex).join() === '0,-1,-1' && rA().every(r => !r.hasAttribute('aria-selected') && !r.classList.contains('sel')) && !ta.classList.contains('uden-valg'));
  rA()[1].querySelector('td').click();
  tjek('K36 (aabn): klik kalder vedAabn(række, data); rækken bliver Tab-stop; intet bliver valgt', aabnet.join() === 'b' && rA()[1].tabIndex === 0 && rA()[0].tabIndex === -1 && rA().every(r => !r.hasAttribute('aria-selected') && !r.classList.contains('sel')));
  rA()[1].focus();
  const ned = tast(rA()[1], 'ArrowDown');
  const efterNed = d.activeElement === rA()[2] && rA()[2].tabIndex === 0 && aabnet.length === 1 && ned.defaultPrevented;
  tast(rA()[2], 'Home');
  const efterHome = d.activeElement === rA()[0] && aabnet.length === 1;
  tast(rA()[0], 'End');
  tjek('K36 (aabn): pil ned, Home og End flytter kun fokus (og Tab-stoppet); intet kaldes', efterNed && efterHome && d.activeElement === rA()[2] && aabnet.length === 1);
  const enter = tast(rA()[2], 'Enter');
  tast(rA()[0], ' ');
  tjek('K36 (aabn): Enter og mellemrum på rækken kalder vedAabn (og forhindrer standarden)', aabnet.join() === 'b,c,a' && enter.defaultPrevented);
  // Et link og en knap i en celle er deres egne mål.
  const iCelle = [];
  const knapI = d.createElement('button'); knapI.type = 'button'; knapI.textContent = '3'; knapI.addEventListener('click', () => iCelle.push('knap'));
  const linkI = d.createElement('a'); linkI.href = '#x'; linkI.textContent = 'mere'; linkI.addEventListener('click', e => { e.preventDefault(); iCelle.push('link'); });
  const indenI = d.createElement('span'); indenI.textContent = 'tekst';
  const tc = K.tabel({ kolonner: kol, raekker: [{ celler: [indenI, knapI, linkI], data: 'k' }], raekkeHandling: 'aabn', vedAabn: (tr, data) => iCelle.push('række:' + data) });
  d.body.appendChild(tc);
  knapI.click(); linkI.click();
  const foerEnter = iCelle.join();
  knapI.focus();
  tast(knapI, 'Enter'); tast(knapI, ' ');
  indenI.click();
  tjek('K36 (aabn): et klik på en knap eller et link i en celle åbner ikke rækken, og Enter/mellemrum på knappen går ikke til rækken; et klik på tekst i cellen åbner', foerEnter === 'knap,link' && iCelle.join() === 'knap,link,række:k');
  // saetRaekker: fokus bliver på rækken med samme data, ellers samme plads.
  rA()[2].focus();
  ta.saetRaekker([{ celler: ['c.eksempel.dk', 'ok', 3], data: 'c' }, { celler: ['a.eksempel.dk', 'ok', 1], data: 'a' }]);
  const sammeData = d.activeElement === rA()[0] && rA()[0].__data === 'c' && rA().map(r => r.tabIndex).join() === '0,-1';
  rA()[1].focus();
  ta.saetRaekker([{ celler: ['x', 'ok', 1], data: 'x' }, { celler: ['y', 'ok', 1], data: 'y' }, { celler: ['z', 'ok', 1], data: 'z' }]);
  const sammePlads = d.activeElement === rA()[1] && rA()[1].tabIndex === 0;
  ta.vaelg(0);
  tjek('K36 (aabn): saetRaekker beholder fokus på rækken med samme data, ellers samme plads; tabel.vaelg gør intet', sammeData && sammePlads && rA().every(r => !r.classList.contains('sel') && !r.hasAttribute('aria-selected')) && aabnet.length === 3);
  // Sortering, to hovedrækker og sideskift i 'aabn'.
  const sorteret = [];
  const tas = K.tabel({ raekkeHandling: 'aabn', vedAabn: (tr, data) => sorteret.push('å:' + data), kolonnegrupper: [{ id: 'g', t: 'g' }], kolonner: [{ t: 'n', sort: true }, { t: 'a', tal: true, gruppe: 'g', sort: true }, { t: 'b', tal: true, gruppe: 'g' }], sortering: { kolonne: 0 }, vedSortering: (k, r) => sorteret.push(k + ':' + r), raekker: [{ celler: ['p', 1, 2], data: 'p' }] });
  d.body.appendChild(tas);
  tas.querySelector('.sorter[data-kolonne="1"]').click();
  tas.saetRaekker([{ celler: ['q', 5, 6], data: 'q' }]);
  tas.querySelector('tbody tr').click();
  const sd = K.sideskift({ side: 1, sider: 2, forrige: 'F', naeste: 'N', vedSide: n => { sorteret.push('side' + n); tas.saetRaekker([{ celler: ['r', 7, 8], data: 'r' }]); } });
  sd.rod.querySelector('[data-side="naeste"]').click();
  tas.querySelector('tbody tr').click();
  tjek('K36 (aabn): sortering, to hovedrækker og sideskift virker (vedSortering, saetRaekker, vedAabn efter hver)', sorteret.join() === '1:stigende,å:q,side2,å:r' && tas.querySelectorAll('thead tr').length === 2 && tas.querySelector('tbody tr').tabIndex === 0);

  // ── K36 'ingen' ──
  const tiKnap = K.knap({ tekst: 'Vis' });
  let tiKlik = 0;
  tiKnap.addEventListener('click', () => tiKlik++);
  const ti = K.tabel({ ariaT: 'laes', kolonner: kol, raekker: [{ gruppe: 'g' }, { celler: ['a', tiKnap, 1], data: 'a' }, { celler: ['b', 'x', 2], data: 'b' }], raekkeHandling: 'ingen', kolonnegrupper: [{ id: 'g', t: 'g' }] });
  d.body.appendChild(ti);
  const rI = [...ti.querySelectorAll('tbody tr:not(.gruppe)')];
  rI[1].querySelector('td').click();
  tast(rI[0], 'ArrowDown');
  tiKnap.click();
  tjek('K36 (ingen): en almindelig <table class="tabel uden-valg"> uden role, uden tabindex og aria-selected på rækkerne; klik og piletaster gør intet; knappen i cellen virker og kan nås med Tab', !ti.hasAttribute('role') && ti.className === 'tabel uden-valg' && ti.getAttribute('data-t-aria') === 'laes' && rI.every(r => !r.hasAttribute('tabindex') && !r.hasAttribute('aria-selected') && !r.classList.contains('sel')) && tiKlik === 1 && tiKnap.tabIndex === 0 && !ti.querySelector('[tabindex="-1"]'));
  const tis = K.tabel({ raekkeHandling: 'ingen', kolonner: [{ t: 'n', sort: true }], vedSortering: () => tiKlik++, raekker: [] });
  tis.querySelector('.sorter').click();
  tis.saetRaekker([{ celler: ['n'] }]);
  tjek('K36 (ingen): sortering og saetRaekker virker; rækkerne får stadig ingen tabindex', tiKlik === 2 && !tis.querySelector('tbody tr').hasAttribute('tabindex'));
  tjek('K36 (CSS): .uden-valg har ingen markør og ingen hover (stærkere vælgere end tabellens hover; kun nye vælgere)', /\.tabel\.uden-valg tbody tr:not\(\.gruppe\) \{ cursor: auto; \}/.test(css) && /\.tabel\.uden-valg tbody tr:not\(\.gruppe\):hover > \* \{ background: none; \}/.test(css) && /\.tabel tbody tr:not\(\.gruppe\) \{ cursor: pointer; \}/.test(css) && /\.tabel tbody tr:not\(\.gruppe\):hover td \{ background: var\(--surface-raised\); \}/.test(css));
  tjek('KOMPONENTER.md (DataTable): raekkeHandling med de tre værdier, hvorfor navnet ikke er raekker, rollen (grid) med begrundelse, og hvad en skærmlæser hører (ikke prøvet)', /`raekkeHandling`/.test(afsnitAf('DataTable')) && /fordi `raekker` er listen/.test(afsnitAf('DataTable')) && /\*\*Rollen for en række, der åbner\.\*\*/.test(afsnitAf('DataTable')) && /`role="link"` på rækken er fravalgt/.test(afsnitAf('DataTable')) && /Hvad en skærmlæser hører/.test(afsnitAf('DataTable')) && /\*\*ikke prøvet\*\*/.test(afsnitAf('DataTable')));

  // ── K37 ──
  const tk37 = K.tabel({
    titelT: 'tNavn', kolonnegrupper: [{ id: 'g1', t: 'G1', skille: true }, { id: 'g2', t: 'G2' }],
    kolonner: [{ t: 'dom', hoved: true, klasse: 'dom' }, { t: 'st', klasse: 'st', bredde: 'm' }, { t: 'a', tal: true, gruppe: 'g1', bredde: 's' }, { t: 'b', tal: true, gruppe: 'g1', bredde: 's', klasse: 'ekstra' }, { t: 'c', tal: true, gruppe: 'g2', bredde: 'xs' }],
    raekker: [{ celler: ['eksempel.dk', 'ok', 1, 2, 3], mono: [0], data: 'z1', attr: { 'data-zone': 'z1', 'data-n': 7 }, titel: 'Hentet i dag' }, { celler: ['shop.eksempel.dk', 'ok', 4, 5, 6], data: 'z2', titelT: 'hentetT' }],
  });
  const kb = [...tk37.querySelector('tbody tr').children];
  tjek('K37 (hoved): kolonnen med hoved: true er <th scope="row"> i rækkerne og <th scope="col"> i hovedet', kb[0].tagName === 'TH' && kb[0].scope === 'row' && kb.slice(1).every(c => c.tagName === 'TD') && tk37.querySelector('thead th[data-t="dom"]').scope === 'col');
  tjek('K37 (klasse): klassen står på hovedcellen og hver kropscelle, efter r og mono og før bredden og skillelinjen', kb[0].className === 'mono dom' && kb[1].className === 'st kol-m' && kb[3].className === 'r ekstra kol-s' && kb[2].className === 'r kol-s kol-skille' && tk37.querySelector('thead th[data-t="b"]').className === 'r ekstra kol-s' && tk37.querySelector('thead th[data-t="dom"]').className === 'dom');
  const cols = [...tk37.querySelectorAll('colgroup')].map(cg => [...cg.children].map(c => c.className || '-').join('+'));
  tjek('K37 (bredde): én <col> pr. kolonne i gruppernes <colgroup> (uden span), med kol-xs/s/m (samme klasse på cellerne); en kolonne uden bredde har en tom <col>', cols.join(' | ') === '- | kol-m | kol-s+kol-s | kol-xs' && [...tk37.querySelectorAll('colgroup')].every(cg => !cg.hasAttribute('span')));
  const t1 = K.tabel({ kolonner: [{ t: 'a', bredde: 'l' }, { t: 'b' }, { t: 'c', bredde: 'xl' }], raekker: [] });
  tjek('K37 (bredde): uden kolonnegrupper én <colgroup> med en <col> pr. kolonne, før <thead>; uden bredde ingen <colgroup> (som før)', t1.firstElementChild.tagName === 'COLGROUP' && [...t1.querySelectorAll('col')].map(c => c.className || '-').join() === 'kol-l,-,kol-xl' && !K.tabel({ kolonner: [{ t: 'a' }], raekker: [] }).querySelector('colgroup'));
  const skille = [...tk37.querySelectorAll('th.kol-skille, td.kol-skille')].map(e => (e.getAttribute('data-t') || e.textContent) + ':' + e.tagName.toLowerCase());
  tjek('K37 (skille): skille: true giver .kol-skille på gruppens overskrift, dens første kolonnes hoved og første kolonnes celler; ikke på gruppen uden skille', skille.join() === 'G1:th,a:th,1:td,4:td');
  const tr0 = tk37.querySelector('tbody tr'), tr1 = tk37.querySelectorAll('tbody tr')[1];
  tjek('K37 (attr, titel): data-* sættes på rækken (værdien som tekst); titel giver title, titelT giver data-t-title', tr0.getAttribute('data-zone') === 'z1' && tr0.getAttribute('data-n') === '7' && tr0.title === 'Hentet i dag' && tr1.getAttribute('data-t-title') === 'hentetT' && !tr1.hasAttribute('title'));
  const afvist = ['onclick', 'role', 'tabindex', 'aria-label', 'class', 'style', 'data-', 'data-Zone', 'id'].map(n => fejlAf(() => K.tabel({ kolonner: kol, raekker: [{ celler: [1, 2, 3], attr: { [n]: 'x' } }] })));
  tjek('K37 (attr): alt andet end data-* giver en fejl (on*, role, tabindex, aria-*, class, style, id, tomt og store bogstaver)', afvist.every(f => /kun data-\*-attributter/.test(f)), afvist.join(' | '));
  tjek('K37 (begrundelse): afvisningen er begrundet i kit.js og KOMPONENTER.md', /role, tabindex, aria-\*, class og style er\s+kittets tilstand/.test(kitJs) && /\*\*Kun `data-\*`\*\*; et andet navn giver en fejl\. Begrundelse/.test(afsnitAf('DataTable')));
  tjek('K37 (caption): titelT giver <caption class="skjult-tekst" data-t> som tabellens første barn (kun for skærmlæsere, begrundet); titel giver tekst', tk37.firstElementChild.tagName === 'CAPTION' && tk37.firstElementChild.className === 'skjult-tekst' && tk37.firstElementChild.getAttribute('data-t') === 'tNavn' && K.tabel({ titel: 'Domæner', kolonner: kol, raekker: [] }).querySelector('caption').textContent === 'Domæner' && /\*\*Kun for skærmlæsere:\*\*/.test(afsnitAf('DataTable')));
  tjek('K37 (CSS): rækkehovedet ligner en celle (tekstens farve og størrelse, ingen store bogstaver, vægt 600) og følger hover og valg; faste bredder 40/72/112/160/240 px på klasser; skillelinjen 2 px border-strong', /\.tabel tbody th \{[^}]*font-size: var\(--body-size\); font-weight: 600; letter-spacing: normal; text-transform: none; color: var\(--text\);/.test(css) && /\.tabel tbody tr:not\(\.gruppe\):hover > th \{ background: var\(--surface-raised\); \}/.test(css) && /\.tabel tbody tr\.sel > th \{ background: var\(--accent-soft\); \}/.test(css) && [['xs', 40], ['s', 72], ['m', 112], ['l', 160], ['xl', 240]].every(([k, px]) => new RegExp(`\\.tabel \\.kol-${k} \\{ width: ${px}px; \\}`).test(css) && new RegExp(`\\.tabel\\.layout-auto \\.kol-${k} \\{ min-width: ${px}px; \\}`).test(css)) && /\.tabel \.kol-skille \{ border-left: 2px solid var\(--border-strong\); \}/.test(css));
  tjek('KOMPONENTER.md (DataTable): bredder kun som faste klasser (ingen inline-stil), og hvordan en anden bredde gives', /\*\*Kun faste bredder:\*\* kittet sætter aldrig inline-stil/.test(afsnitAf('DataTable')));

  // ── K38 ──
  const t38 = K.tabel({ kolonner: kol, raekker: rk(), layout: 'auto', fastFoerste: true });
  tjek('K38: layout: \'auto\' giver .layout-auto, fastFoerste giver .fast-foerste (begge kun med indstillingen); første kolonne i en gruppe giver en fejl', t38.className === 'tabel layout-auto fast-foerste' && K.tabel({ kolonner: kol, raekker: [], layout: 'fast' }).className === 'tabel' && /første kolonne må ikke være i en kolonnegruppe/.test(fejlAf(() => K.tabel({ fastFoerste: true, kolonnegrupper: [{ id: 'g' }], kolonner: [{ t: 'a', gruppe: 'g' }], raekker: [] }))));
  tjek('K38: Kit.tabelRul uden navn giver en fejl', /rullerammen skal have et navn/.test(fejlAf(() => K.tabelRul(K.tabel({ kolonner: kol, raekker: [] })))));
  const rul = K.tabelRul(t38, { ariaT: 'rulAria' });
  d.body.appendChild(rul.rod);
  let sw = 900, cw = 400;
  Object.defineProperty(rul.rod, 'scrollWidth', { get: () => sw });
  Object.defineProperty(rul.rod, 'clientWidth', { get: () => cw });
  const ruller = rul.maal();
  const naarRuller = rul.rod.getAttribute('role') === 'region' && rul.rod.tabIndex === 0 && rul.rod.getAttribute('data-t-aria') === 'rulAria';
  sw = 400;
  const ikke = rul.maal();
  tjek('K38 (tabelRul): <div class="tabel-rul"> om tabellen; når den ruller: role="region", tabindex 0 og navn; ellers hverken rolle eller Tab-stop (navnet bliver)', rul.rod.className === 'tabel-rul' && rul.tabel === t38 && t38.parentElement === rul.rod && ruller === true && naarRuller && ikke === false && !rul.rod.hasAttribute('role') && !rul.rod.hasAttribute('tabindex') && rul.rod.getAttribute('data-t-aria') === 'rulAria' && K.tabelRul(K.tabel({ kolonner: kol, raekker: [] }), { aria: 'Domæner' }).rod.getAttribute('aria-label') === 'Domæner');
  tjek('K38 (tabelRul): måles igen, når rammen eller tabellen skifter størrelse (ResizeObserver, når den findes)', /new ResizeObserver\(\(\) => maal\(\)\)/.test(kitJs) && /ro\.observe\(rod\);\s*ro\.observe\(tabelEl\);/.test(kitJs) && /typeof ResizeObserver === 'function'/.test(kitJs));
  tjek('K38 (CSS): layout-auto er table-layout: auto; rullerammen ruller vandret (position: relative, så en skjult caption ikke ruller siden); fokusringen ligger inden for rammen', /\.tabel\.layout-auto \{ table-layout: auto; \}/.test(css) && /\.tabel-rul \{ position: relative; overflow-x: auto;/.test(css) && /\.tabel-rul:focus-visible \{ outline-offset: -2px; \}/.test(css));
  tjek('K38 (CSS): fast første kolonne: sticky, left 0, kant til højre; flade surface (accent-soft i en valgt række, surface-raised ved hover, også i hovedet); kanterne pr. celle (separate)', /\.tabel\.fast-foerste \{ border-collapse: separate; border-spacing: 0; \}/.test(css) && /\.tabel\.fast-foerste thead tr:first-child > th:first-child,\n\.tabel\.fast-foerste tbody tr:not\(\.gruppe\) > :first-child \{ position: sticky; left: 0; z-index: 1; border-right: 1px solid var\(--border\); \}/.test(css) && /\.tabel\.fast-foerste tbody tr:not\(\.gruppe\) > :first-child \{ background: var\(--surface\); \}/.test(css) && /\.tabel\.fast-foerste tbody tr\.sel > :first-child \{ background: var\(--accent-soft\); \}/.test(css) && /\.tabel\.fast-foerste:not\(\.uden-valg\) tbody tr:not\(\.gruppe\):hover > :first-child \{ background: var\(--surface-raised\); \}/.test(css));
  // Rækkefølgen i kit.css afgør, hvilken flade den faste celle får, når vælgerne er lige stærke.
  const iCss = s => css.indexOf(s);
  tjek('K38 (CSS): den faste celles flade står efter .uden-valg-nulstillingen og før valgt/hover (samme styrke: rækkefølgen afgør)', iCss('.tabel.uden-valg tbody tr:not(.gruppe):hover > *') < iCss('.tabel.fast-foerste tbody tr:not(.gruppe) > :first-child { background') && iCss('.tabel.fast-foerste tbody tr:not(.gruppe) > :first-child { background') < iCss('.tabel.fast-foerste tbody tr.sel > :first-child'));

  // ── K18–K21: farverne ──
  const farve = Object.fromEntries(tokens.color.tokens.map(t => [t.name, t.value]));
  tjek('2.4.0: de seks nye farver findes i begge temaer som #RRGGBB, og de 48 fra før har samme værdier som i 2.3.0 (ingen ændret)', V240_FARVER.every(n => farve[n] && /^#[0-9A-F]{6}$/.test(farve[n].light) && /^#[0-9A-F]{6}$/.test(farve[n].dark)) && tokens.color.tokens.length === 54 && tokens.color.tokens.filter(t => !V240_FARVER.includes(t.name)).length === 48);
  const kanal = (h, i) => parseInt(h.slice(1 + 2 * i, 3 + 2 * i), 16);
  const bland = (a, p, b) => [0, 1, 2].map(i => kanal(a, i) * p + kanal(b, i) * (1 - p));
  const afvig = ['ok', 'warn', 'danger', 'info', 'none'].flatMap(m => ['light', 'dark'].map(t => { const r = bland(farve[m + '-mark'][t], 0.78, farve.text[t]); return Math.max(...[0, 1, 2].map(i => Math.abs(kanal(farve[m + '-mark-hover'][t], i) - r[i]))); }));
  tjek('K19: hver *-mark-hover er mærket 78 % blandet med text i srgb (som color-mix), højst en halv enhed fra pr. kanal, i begge temaer', afvig.every(x => x <= 0.5), afvig.map(x => x.toFixed(2)).join(','));
  const xaml = pk('tokens/Tokens.xaml');
  tjek('K18/K19: Tokens.xaml har Wi24rdTextDisabledBrush og fem Wi24rd*MarkHoverBrush i begge ordbøger', (xaml.match(/x:Key="Wi24rdTextDisabledBrush"/g) || []).length === 2 && ['Ok', 'Warn', 'Danger', 'Info', 'None'].every(m => (xaml.match(new RegExp(`x:Key="Wi24rd${m}MarkHoverBrush"`, 'g')) || []).length === 2));
  const grundlag = afsnitAf('Grundlag');
  tjek('K18 (regel): --text-disabled er til tekst, der er slået fra, ikke til tekst, der skal læses; aldrig farve alene; kittets knapper nedtones fortsat med opacity (og gør det)', /\*\*Tekst, der er slået fra\*\* \(K18\)/.test(grundlag) && /ikke til tekst, der skal læses/.test(grundlag) && /\*\*Kittets egne knapper nedtones fortsat som i dag\*\*/.test(grundlag) && /\.btn\[disabled\], \.btn\[aria-disabled="true"\] \{ opacity: \.55;/.test(css) && !/--text-disabled/.test(css));
  tjek('K19 (regel): mærket blandet med --text (78 %), tokens fordi Tokens.xaml ikke kan blande, og at hover aldrig står alene (lille forskel i mørkt tema)', /\*\*Hover på et mærke\*\* \(K19\)/.test(grundlag) && /78 % mærke og 22 % tekst/.test(grundlag) && /ikke kan blande to farver/.test(grundlag) && /hover må aldrig være det eneste/.test(grundlag));
  tjek('K20 (regel): en bue tager betydningens mærkefarve (angreb --danger-mark); --map-arc er standard; ingen token ændret (map-arc er stadig info-mark)', /\*\*Buer på kort\*\* \(K20\)/.test(grundlag) && /`--danger-mark`/.test(grundlag) && /`--map-arc` \(oplysningens blå\) er standard/.test(grundlag) && ['light', 'dark'].every(t => farve['map-arc'][t] === farve['info-mark'][t]));
  tjek('K21 (regel): to faste trin med color-mix og transparent (18 % mærke, 92 % surface), ingen tokens, og hvordan WPF gør det (Opacity); README har eksemplet', /\*\*Svag flade af et mærke\*\* \(K21\)/.test(grundlag) && /color-mix\(in srgb, var\(--danger-mark\) 18%, transparent\)/.test(grundlag) && /color-mix\(in srgb, var\(--surface\) 92%, transparent\)/.test(grundlag) && /Opacity="0\.18"/.test(grundlag) && /### Farver, der regnes \(fra 2\.4\.0\)/.test(readme) && /Opacity="0\.18"/.test(readme) && /Opacity="0\.92"/.test(readme) && !tokens.color.tokens.some(t => /svag|soft-mark|-18/.test(t.name)));

  // ── K29 og K30 ──
  tjek('K29: .btn har white-space: nowrap (i selve .btn-reglen); KOMPONENTER.md (Button) siger det', /\.btn \{\n[^}]*white-space: nowrap;[^}]*\}/.test(css) && /ombrydes teksten aldrig \(`white-space: nowrap`\)/.test(afsnitAf('Button')));
  tjek('K30: SYMBOL.danger er × (de andre som før), chippen viser det; bannerets danger er stadig !', K.SYMBOL.danger === '×' && [K.SYMBOL.ok, K.SYMBOL.warn, K.SYMBOL.info, K.SYMBOL.none].join('') === '✓!i–' && K.chip('danger', 'Fejl').firstChild.textContent === '×' && K.banner({ variant: 'danger', tekst: 'x' }).querySelector('.s').textContent === '!');
  tjek('K30: KOMPONENTER.md (StatusChip) siger `danger` (×) og ikke længere (?)', /`danger` \(×\)/.test(afsnitAf('StatusChip')) && !/`danger` \(\?\)/.test(afsnitAf('StatusChip')));

  // ── Pakken ──
  const log = pk('CHANGELOG.md');
  const a240 = log.slice(log.indexOf('## 2.4.0'), log.indexOf('## 2.3.0'));
  tjek('CHANGELOG 2.4.0: første post med kun dato; Nyt og Ændret; K29 og K30 under Ændret; K36–K38 og K18–K21 under Nyt; intet omdøbt eller fjernet', log.indexOf('## 2.4.0 — 2026-11-12') > 0 && log.indexOf('## 2.4.0') < log.indexOf('## 2.3.0') && /### Nyt[\s\S]*### Ændret/.test(a240) && /### Ændret[\s\S]*\(K29\)[\s\S]*\(K30\)/.test(a240) && ['K36', 'K37', 'K38', 'K18', 'K19', 'K20', 'K21'].every(k => a240.slice(0, a240.indexOf('### Ændret')).includes(k)) && /Intet er omdøbt eller fjernet/.test(a240));
  tjek('CHANGELOG: "Ikke udgivet endnu" er lagt ind under 2.4.0 (dokumentrettelserne efter Wi24rd FTP\'s fase A)', !/## Ikke udgivet endnu/.test(log) && /### Dokumenter/.test(a240) && /Wi24rd FTP's fase A/.test(a240) && /`flytning\/WI24RD-FTP\.md`: det gamle trin 2/.test(a240));
  const hm = pk('flytning/HUGINN-MUNINN.md');
  tjek('flytning/HUGINN-MUNINN.md: K18–K21, K29, K30 og K36–K38 står som opfyldt i 2.4.0; B2d kan flyttes; K22–K26, K28 og K31–K35 venter på 2.5.0; K27 er 3.0.0', ['K18', 'K19', 'K20', 'K21', 'K29', 'K30', 'K36', 'K37', 'K38'].every(k => new RegExp('\\| ' + k + ' [^|]*\\| 2\\.4\\.0 \\|').test(hm)) && /\*\*B2d\*\*/.test(hm) && /\*\*Venter på 2\.5\.0\*\*/.test(hm) && ['K22', 'K23', 'K24', 'K25', 'K26', 'K28', 'K31', 'K32', 'K33', 'K34', 'K35'].every(k => hm.slice(hm.indexOf('**Venter på 2.5.0**')).includes(k)) && /\*\*K27\*\* \(præfiks på kittets klasser\) kræver 3\.0\.0/.test(hm));
  tjek('README 2.4.0: indholdslisten nævner Kit.tabelRul; "Byg skærmen" nævner raekkeHandling og Kit.tabelRul', /`Kit\.sideskift`, og fra 2\.4\.0 `Kit\.tabelRul`/.test(readme) && /\(`raekkeHandling`\)/.test(readme) && /\(`Kit\.tabelRul`\)/.test(readme));
}
{
  // Demoen 2.4.0 med pakkens rigtige filer, i begge sprog og temaer.
  const dom = await JSDOM.fromFile(demoFil, { runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, virtualConsole: new VirtualConsole() });
  const w = dom.window, d = w.document;
  await new Promise(r => (d.readyState === 'complete' ? r() : w.addEventListener('load', r)));
  await vent(20);
  const html = pk('demo/index.html');
  const ta = d.querySelector('#demo-tabel-aabn > .tabel-rul > table.tabel');
  const rA = ta ? [...ta.querySelectorAll('tbody tr')] : [];
  tjek('demo 2.4.0 (K36–K38): tabellen med rækker, der åbner, står i en rulleramme med navn; layout-auto og fast-foerste; caption; rækkehoved; skillelinjer; bredder; data-zone og title (dansk)', Boolean(ta) && ta.className === 'tabel layout-auto fast-foerste' && ta.getAttribute('role') === 'grid' && ta.querySelector('caption').textContent === 'Domæner, der kan åbnes' && ta.parentElement.getAttribute('aria-label') === 'Domæner, ruller vandret' && rA.length === 8 && rA[0].firstElementChild.tagName === 'TH' && rA[0].firstElementChild.scope === 'row' && ta.querySelectorAll('thead .kol-skille').length === 4 && ta.querySelectorAll('col.kol-s').length === 3 && rA[0].getAttribute('data-zone') === 'z1' && rA[0].title === 'Hentet i dag' && rA.every(r => !r.hasAttribute('aria-selected')));
  rA[1].querySelector('td').click();
  const efterKlik = d.getElementById('tabel-aabn-valgt').textContent;
  rA[2].querySelector('.demo-tal').click();
  const efterTal = d.getElementById('tabel-aabn-valgt').textContent;
  rA[3].focus();
  rA[3].dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  tjek('demo 2.4.0 (K36): klik på en række åbner den, et klik på tallet åbner den ikke (tallet melder sig selv), Enter åbner (dansk); den sidste celle siger "Åbn …" til skærmlæseren', efterKlik === 'Åbnet: shop.eksempel.dk' && efterTal === 'Tallet for blog.eksempel.dk (rækken blev ikke åbnet)' && d.getElementById('tabel-aabn-valgt').textContent === 'Åbnet: api.eksempel.dk' && rA[0].lastElementChild.querySelector('.skjult-tekst').textContent === 'Åbn eksempel.dk');
  const tl = d.querySelector('#demo-tabel-laes > table.tabel');
  tl.querySelectorAll('tbody tr')[1].querySelector('.btn').click();
  tjek('demo 2.4.0 (K36): tabellen, der kun skal læses, har ingen rolle og ingen Tab-stop på rækkerne; knappen i rækken virker og har et navn (dansk)', tl.className === 'tabel uden-valg' && !tl.hasAttribute('role') && [...tl.querySelectorAll('tbody tr')].every(r => !r.hasAttribute('tabindex')) && d.getElementById('tabel-laes-valgt').textContent === 'Vist: shop.eksempel.dk' && tl.querySelectorAll('tbody tr')[1].querySelector('.btn').getAttribute('aria-label') === 'Vis shop.eksempel.dk');
  tjek('demo 2.4.0 (K18): tekst, der er slået fra, i --text-disabled under Grundlag', d.getElementById('demo-fra').textContent.startsWith('Kopiér') && /\.demo-fra \{ color: var\(--text-disabled\); \}/.test(html));
  tjek('demo 2.4.0 (K19, K21): fem søjler, der skifter til *-mark-hover under musen, og fem svage flader (color-mix 18 %) med tekst; forklaringen på kortet står på surface 92 %', d.querySelectorAll('#demo-hover i').length === 5 && ['ok', 'warn', 'danger', 'info', 'none'].every(m => new RegExp(`\\.demo-hover \\.${m}:hover \\{ background: var\\(--${m}-mark-hover\\); \\}`).test(html) && new RegExp(`\\.demo-svag \\.${m} \\{ background: color-mix\\(in srgb, var\\(--${m}-mark\\) 18%, transparent\\); \\}`).test(html)) && d.querySelectorAll('#demo-svag span').length === 5 && /background: color-mix\(in srgb, var\(--surface\) 92%, transparent\)/.test(html));
  const buer = [...d.querySelectorAll('#demo-kort240 path[data-bue]')].map(p => p.getAttribute('data-bue') + ':' + /stroke: var\(--([a-z-]+)\)/.exec(p.getAttribute('style'))[1]);
  tjek('demo 2.4.0 (K20, K21): kortet har en bue, der er et angreb (--danger-mark), og en uden betydning (--map-arc); ringen har mærkets svage flade (18 %)', buer.join() === 'angreb:danger-mark,neutral:map-arc' && /color-mix\(in srgb, var\(--map-ring\) 18%, transparent\)/.test(d.querySelector('#demo-kort240 circle[data-ring]').getAttribute('style')) && d.querySelector('#demo-kort240 .demo-forklaring .angreb').textContent === 'Angreb (danger-mark)');
  tjek('demo 2.4.0 (K30): chippen danger viser × i demoen', d.querySelector('#demo-chips .chip.danger').firstChild.textContent === '×');
  w.Sprog.saet('en');
  tjek('demo 2.4.0 (English): de nye dele har tekst', ta.querySelector('caption').textContent === 'Domains that can be opened' && d.getElementById('tabel-aabn-valgt').textContent === 'Opened: api.eksempel.dk' && d.querySelector('[data-t="hTabelAabn"]').textContent === 'Rows that open, and a table without row selection' && d.querySelector('[data-t="h240"]').textContent === 'Hover, arcs and faint surfaces' && rA[0].lastElementChild.querySelector('.skjult-tekst').textContent === 'Open eksempel.dk' && tl.querySelector('caption').textContent === 'Latest events');
  w.Tema.saet('moerk');
  tjek('demo 2.4.0: mørkt tema sættes på siden med de nye dele', d.documentElement.getAttribute('data-tema') === 'moerk' && Boolean(d.querySelector('#demo-tabel-aabn .tabel-rul')));
  const da = Object.keys(w.Sprog.TEKST.da), en = Object.keys(w.Sprog.TEKST.en);
  tjek('demo 2.4.0: dansk og engelsk har de samme nøgler', JSON.stringify(da.slice().sort()) === JSON.stringify(en.slice().sort()), da.filter(k => !en.includes(k)).concat(en.filter(k => !da.includes(k))).join(', '));
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
