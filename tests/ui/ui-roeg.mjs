// UI-røgtest for Grimnirs skal: jsdom, stub for __TAURI__ (invoke, event.listen, app.getVersion), intet netværk.
// Mønsteret er Huginn and Muninns tests/ui/ui-roeg.mjs. Brug: npm run test:ui (= node tests/ui/ui-roeg.mjs).
// Tjekker: de fire visninger skifter (visningsskift, adresse og ⌘1–⌘4), tema og sprog skifter og huskes, hver StatusChip
// har symbol og ord, ingen data-t-nøgle mangler i et af sprogene, ingen farvekoder uden for tokens.css, ingen inline-stil
// eller inline-script, kittets komponenter opfører sig som beskrevet, og menuens hændelser åbner dialogerne.
// V-SKAL.2: Maskér og Demaskér med en efterlignet Rust (falskRust): indsæt → analysér → ret en kode → slå en række fra →
// gem og maskér → kopiér; demaskér; filtrene; hemmelighed skjult; banner ved rester; ingen console.log; localStorage har
// kun tema og sprog.
// V-SAG.1: Sager med en efterlignet Rust (falskSagRust): ny sag, liste med status og træ, åbn, omdøb, udløb, slet med
// bekræftelse, konfliktbesked, "Kan ikke åbnes", luk med midlertidig sag, titellinjen, fuldskærm og Demaskér → Sager.
// V-ORDBOG.1: Ordbog med en efterlignet Rust (falskOrdbogRust): tilføj, ret, fjern, søg, træ, Prøv på tekst, fra Maskér til
// ordbogen, guiden (frem, tilbage, spring over, vises ikke igen), indstillinger (gemmes, gælder en ny sag), advarslen ved
// egen kode, kittets Wizard og Fletbånd.
// V-FIL.1: Åbn fil og Gem som fil med en efterlignet Rust (falskFilRust): åbn (menu, knap, ⌘O/Ctrl+O), uddrag og filinfo,
// rækker fra Rust i sider, søgning over alle rækker, gem og kopiér, rester → Gem alligevel, Demaskér med bekræftelse,
// træk og slip (én fil, flere filer, en mappe), arbejder-tilstand; ingen fil-rettigheder; Start forfra; adgangskode-advarsel.
// V-LAAS.2: låseskærmen med en efterlignet Rust (falskLaasRust): start låst, Lås op (ok, annulleret, afvist, ikke
// tilgængelig, fejl), Afslut, banneret ved ikke tilgængelig, intet sagsindhold i DOM'en, Enter, begge sprog.
// V-LAAS.3: "Lås Grimnir ved start" er væk i begge sprog (de V-LAAS.2-tjek, der slog den fra, er fjernet med den);
// hændelsen `laast` genindlæser siden (location.reload; jsdom melder "navigation"), og den genindlæste side er tom og
// kalder ikke laas_op af sig selv; beskeden om den midlertidige sag og om en sag, der ikke kunne gemmes; "Lås efter
// stilstand"; aktivitet fra tastatur og mus højst hvert 20. sekund; tandhjulet i titellinjen er ikke solen.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM, VirtualConsole } from 'jsdom';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const ui = p => fs.readFileSync(path.join(repo, 'ui', p), 'utf8');
let ok = 0, fejl = 0;
const tjek = (navn, betingelse, detalje = '') => {
  if (betingelse) { ok++; console.log('ok   ' + navn); } else { fejl++; console.log('FEJL ' + navn + (detalje ? ' — ' + detalje : '')); }
};
const vent = (ms = 0) => new Promise(r => setTimeout(r, ms));

/* Indlæser siden. lager: localStorage før start. platform: det, Rust sætter i init-scriptet. */
function side({ hash = '', lager = {}, platform = 'macos', rust = null, foer = null } = {}) {
  const html = ui('index.html');
  const scripts = [...html.matchAll(/<script src="([^"]+)"(?: defer)?><\/script>/g)].map(m => m[1]);
  // jsdom kan ikke navigere: location.reload() giver fejlen "Not implemented: navigation". Den samles her (og andre
  // jsdom-fejl vises stadig), så testen kan se, at siden bad om at blive genindlæst (V-LAAS.3).
  const jsdomFejl = [];
  const konsol = new VirtualConsole();
  konsol.sendTo(console, { omitJSDOMErrors: true });
  konsol.on('jsdomError', e => { jsdomFejl.push(String(e && e.message)); if (!/navigation/.test(String(e && e.message))) console.error(e); });
  const dom = new JSDOM(html.replace(/<script[^>]*><\/script>/g, ''), { url: 'http://tauri.localhost/index.html' + hash, runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole: konsol });
  const w = dom.window;
  for (const [k, v] of Object.entries(lager)) w.localStorage.setItem(k, v);
  Object.defineProperty(w, '__GRIMNIR_PLATFORM__', { value: platform });
  w.document.documentElement.setAttribute('data-platform', platform);
  w.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  // Som i browseren: close() melder 'close', når dialogen var åben (V-ORDBOG.1: Prøv på tekst rydder op ved 'close').
  w.HTMLDialogElement.prototype.close = function () { const var_aaben = this.hasAttribute('open'); this.removeAttribute('open'); if (var_aaben) this.dispatchEvent(new w.Event('close')); };
  const kald = [], lyttere = {};
  w.__TAURI__ = {
    core: {
      invoke: async (cmd, args) => {
        kald.push([cmd, args || {}]);
        if (cmd === 'kerne_version') return '0.1.0';
        if (rust && cmd in rust) return rust[cmd](args || {});
        // V-LAAS.2: uden en efterlignet dør er Grimnir låst op (de ældre afsnit); låseskærmen prøves i sit eget afsnit.
        if (cmd === 'laas_status') return { laast: false, igen: null, uden_doer: null };
        if (cmd === 'aktivitet') return null;
        if (cmd === 'sag_status') return { poster: 0, id: null, navn: null, udloeb: null };
        if (cmd === 'sag_liste') return [];
        if (cmd === 'menu_sprog') return null;
        throw new Error('ukendt kommando ' + cmd);
      },
    },
    event: { listen: async (navn, cb) => { (lyttere[navn] ||= []).push(cb); return () => { }; } },
    app: { getVersion: async () => '9.8.7' },
  };
  if (foer) foer(w);
  for (const s of scripts) w.eval(ui(s));
  const emit = (navn, payload) => (lyttere[navn] || []).forEach(cb => cb({ payload }));
  const tast = (key, x = {}) => w.document.dispatchEvent(new w.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...x }));
  return { w, d: w.document, kald, emit, tast, scripts, jsdomFejl };
}
const synlige = d => [...d.querySelectorAll('section.visning')].filter(s => !s.hidden).map(s => s.dataset.visning);
const VIS = ['masker', 'demasker', 'sager', 'ordbog'];

// ── Statisk: filerne ──
{
  const html = ui('index.html');
  tjek('index.html: ingen inline-script', !/<script(?![^>]*\bsrc=)[^>]*>/i.test(html));
  tjek('index.html: ingen <style> og ingen style=', !/<style\b/i.test(html) && !/\sstyle\s*=/i.test(html));
  tjek('index.html: ingen on*-håndtering i markup', !/\son[a-z]+\s*=/i.test(html));
  const filer = [];
  (function gaa(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) gaa(p);
      else if (/\.(css|js|html)$/.test(e.name)) filer.push(p);
    }
  })(path.join(repo, 'ui'));
  tjek('ui/ har filerne', filer.length >= 7, String(filer.length));
  const FARVE = /#[0-9a-fA-F]{3,8}(?![\w-])|\brgba?\(|\bhsla?\(/;
  const medFarve = filer.filter(f => path.basename(f) !== 'tokens.css').filter(f => FARVE.test(fs.readFileSync(f, 'utf8')));
  tjek('ingen farvekoder (#…, rgb(, hsl() i ui/ uden for tokens.css', medFarve.length === 0, medFarve.map(f => path.relative(repo, f)).join(', '));
  tjek('kontrol: farvemønsteret fanger #fff, #007864, rgb( og hsl(', ['a{color:#fff}', 'x:#007864;', 'rgb(1,2,3)', 'hsl(1 2% 3%)'].every(s => FARVE.test(s)) && !FARVE.test("href='#masker' #demasker #arb"));
  const medStil = filer.filter(f => f.endsWith('.js')).filter(f => /\.style\.|setAttribute\(\s*['"]style['"]|\.cssText/.test(fs.readFileSync(f, 'utf8')));
  tjek('ingen inline-stil sat fra JavaScript', medStil.length === 0, medStil.map(f => path.relative(repo, f)).join(', '));
  const kit = ui('assets/kit.css') + ui('assets/kit.js');
  tjek('kittets filer nævner ikke Grimnir', !/grimnir/i.test(kit));
  tjek('kit.css har synlig fokusring i info', /:focus-visible\s*\{\s*outline:\s*2px solid var\(--info\)/.test(ui('assets/kit.css')));
  const css = ui('assets/kit.css');
  const fonte = [...css.matchAll(/url\(([^)]+)\)/g)].map(m => m[1]);
  tjek('skrifterne hentes kun fra ui/assets/fonts', fonte.length === 4 && fonte.every(u => /^fonts\/[a-z0-9-]+\.woff2$/.test(u) && fs.existsSync(path.join(repo, 'ui', 'assets', u))), fonte.join(', '));
}

// ── Start, visningsskift og genveje ──
{
  const s = side();
  const { d } = s;
  await vent();
  tjek('starter på Maskér', JSON.stringify(synlige(d)) === '["masker"]', JSON.stringify(synlige(d)));
  const links = [...d.querySelectorAll('.skift .vs')];
  tjek('visningsskiftet har fire visninger i fast rækkefølge', JSON.stringify(links.map(a => a.dataset.visning)) === JSON.stringify(VIS));
  tjek('aria-current="page" kun på den aktive', links.filter(a => a.getAttribute('aria-current') === 'page').map(a => a.dataset.visning).join() === 'masker');
  tjek('genvejene står ved visningerne (⌘1–⌘4 på macOS)', links.map(a => a.querySelector('kbd').textContent).join() === '⌘1,⌘2,⌘3,⌘4');
  for (const [i, id] of VIS.entries()) {
    s.w.location.hash = id;
    await vent(5);
    tjek(`#${id} viser ${id}`, JSON.stringify(synlige(d)) === JSON.stringify([id]));
    tjek(`${id}: aria-current flytter med`, links.filter(a => a.getAttribute('aria-current') === 'page').map(a => a.dataset.visning).join() === id);
    const bar = d.querySelector(`#baand > [data-visning="${id}"]`);
    tjek(`${id}: kun visningens CommandBar vises`, !bar.hidden && [...d.querySelectorAll('#baand > [data-visning]')].filter(b => !b.hidden).length === 1);
    tjek(`${id}: én primær kommando på Start`, bar.querySelectorAll('.grupper[data-fane="start"] .cb.pri').length === 1);
    // Uden tekst er alt nedtonet med en forklaring, undtagen Indsæt i Maskér og Demaskér, Ny sag i Sager (V-SAG.1),
    // Tilføj post og Prøv på tekst i Ordbog (V-ORDBOG.1) og Åbn fil i Maskér og Demaskér (V-FIL.1).
    tjek(`${id}: kommandoerne er nedtonede med forklaring`, [...bar.querySelectorAll('.grupper[data-fane="start"] .cb')].every(b => (b.getAttribute('aria-disabled') === 'true' && b.title.length > 10) || (['indsaet', 'aabn-fil'].includes(b.dataset.kommando) && ['masker', 'demasker'].includes(id)) || (b.dataset.kommando === 'ny-sag' && id === 'sager') || (['tilfoej-post', 'proev'].includes(b.dataset.kommando) && id === 'ordbog')));
    tjek(`${id}: tom tilstand med overskrift og én sætning`, (() => { const t = d.querySelector(`section[data-visning="${id}"] .tom`); const p = t && t.querySelector('p').textContent; return t && t.querySelector('h2').textContent.length > 3 && p.length > 20 && (p.match(/[.]\s/g) || []).length === 0 && p.endsWith('.'); })());
    tjek(`${id}: fodlinjen siger, hvad fladen viser`, /^0 /.test(d.getElementById('fod-venstre').textContent));
    tjek(`${id}: træets valgte punkt har aria-current`, d.querySelectorAll(`.navdel[data-visning="${id}"] .tr[aria-current="true"]`).length === 1);
    tjek(`${id}: ${i + 1}. visning`, links[i].classList.contains('on'));
  }
  const kommandoer = { masker: ['Indsæt', 'Åbn fil', 'Analysér', 'Gem og maskér', 'Før og efter', 'Kopiér', 'Gem maskeret fil', 'Kvittering'], demasker: ['Indsæt', 'Åbn fil', 'Demaskér', 'Næste advarsel', 'Kopiér resultat', 'Gem som fil'], sager: ['Ny sag', 'Åbn i Maskér', 'Omdøb', 'Udløb', 'Eksportér', 'Importér', 'Slet sag'], ordbog: ['Tilføj post', 'Ret', 'Prøv på tekst', 'Importér', 'Eksportér', 'Fjern post'] };
  for (const [id, liste] of Object.entries(kommandoer)) {
    const ord = [...d.querySelectorAll(`#baand > [data-visning="${id}"] .grupper[data-fane="start"] .cb`)].map(b => b.textContent.trim());
    tjek(`${id}: kommandoerne fra design/skaerme/`, JSON.stringify(ord) === JSON.stringify(liste), JSON.stringify(ord));
  }
  const prim = Object.fromEntries(VIS.map(id => [id, d.querySelector(`#baand > [data-visning="${id}"] .cb.pri`).textContent.trim()]));
  tjek('primære kommandoer (Demaskér er primær i Demaskér, M4)', JSON.stringify(prim) === JSON.stringify({ masker: 'Gem og maskér', demasker: 'Demaskér', sager: 'Ny sag', ordbog: 'Tilføj post' }), JSON.stringify(prim));
  // ⌘1–⌘4
  s.tast('2', { metaKey: true, code: 'Digit2' });
  await vent(5);
  tjek('⌘2 skifter til Demaskér', synlige(d).join() === 'demasker');
  s.tast('4', { metaKey: true, code: 'Digit4' });
  await vent(5);
  tjek('⌘4 skifter til Ordbog', synlige(d).join() === 'ordbog');
  s.tast('1', { ctrlKey: true, code: 'Digit1' });
  await vent(5);
  tjek('Ctrl+1 gør intet på macOS', synlige(d).join() === 'ordbog');
  s.tast('1', { metaKey: true, code: 'Digit1' });
  await vent(5);
  tjek('⌘1 skifter til Maskér', synlige(d).join() === 'masker');
  // En deaktiveret kommando gør intet, men kan nås med Tab.
  const gem = d.querySelector('#baand > [data-visning="masker"] [data-kommando="gem-masker"]');
  let kastet = null;
  try { gem.click(); } catch (e) { kastet = e; }
  tjek('deaktiveret kommando kan klikkes uden fejl og bliver i tab-rækkefølgen', !kastet && gem.tabIndex === 0 && !gem.disabled);
  // Fodlinjen: version og kerne
  await vent(5);
  tjek('fodlinjen: Kun på denne maskine', d.getElementById('fod-lokalt').textContent.trim() === 'Kun på denne maskine');
  tjek('fodlinjen: programversion fra app.getVersion', d.getElementById('fod-version').textContent === 'Version 9.8.7');
  tjek('fodlinjen: kernens version fra kerne_version', d.getElementById('fod-kerne').textContent === 'Kerne 0.1.0' && s.kald.some(k => k[0] === 'kerne_version'));
  tjek('titellinjen kan trækkes (deep), mærket er G', d.querySelector('.titel').getAttribute('data-tauri-drag-region') === 'deep' && d.querySelector('.titel .mrk').textContent === 'G');
  // Menuen
  s.emit('menu', 'indstillinger');
  tjek('menuen "indstillinger" åbner Indstillinger', d.getElementById('dlg-indst').hasAttribute('open'));
  d.querySelector('#dlg-indst [data-luk]').click();
  tjek('Luk lukker dialogen', !d.getElementById('dlg-indst').hasAttribute('open'));
  s.emit('menu', 'om');
  tjek('menuen "om" åbner Om med versionerne', d.getElementById('dlg-om').hasAttribute('open') && d.getElementById('om-kerne').textContent === 'Kerne 0.1.0');
  s.emit('menu', 'noget-andet');
  tjek('ukendt menuhændelse gør intet', d.querySelectorAll('dialog[open]').length === 1);
  d.querySelector('#dlg-om [data-luk]').click();
  d.getElementById('aabn-indst').click();
  tjek('tandhjulet i titellinjen åbner Indstillinger', d.getElementById('dlg-indst').hasAttribute('open'));
  tjek('tandhjulet har aria-label og genvej i title', d.getElementById('aabn-indst').getAttribute('aria-label') === 'Åbn indstillinger' && d.getElementById('aabn-indst').title === 'Indstillinger (⌘,)');
}

// ── Windows: Ctrl-genveje ──
{
  const s = side({ platform: 'windows' });
  await vent();
  tjek('Windows: genvejene står som Ctrl+1–4', [...s.d.querySelectorAll('.skift kbd')].map(k => k.textContent).join() === 'Ctrl+1,Ctrl+2,Ctrl+3,Ctrl+4');
  s.tast('3', { ctrlKey: true, code: 'Digit3' });
  await vent(5);
  tjek('Windows: Ctrl+3 skifter til Sager', synlige(s.d).join() === 'sager');
  s.tast(',', { ctrlKey: true, code: 'Comma' });
  tjek('Windows: Ctrl+, åbner Indstillinger', s.d.getElementById('dlg-indst').hasAttribute('open'));
  tjek('Windows: ingen plads til trafiklys (data-platform)', s.d.documentElement.getAttribute('data-platform') === 'windows');
}

// ── Adressen bestemmer visningen ved start ──
{
  const s = side({ hash: '#sager' });
  await vent();
  tjek('#sager ved start viser Sager', synlige(s.d).join() === 'sager');
  const u = side({ hash: '#findes-ikke' });
  await vent();
  tjek('ukendt adresse viser Maskér', synlige(u.d).join() === 'masker');
}

// ── Tema ──
{
  const s = side();
  const { d } = s;
  await vent();
  tjek('tema: system som standard', d.documentElement.getAttribute('data-tema') === 'system');
  const bar = () => d.querySelector('#baand > [data-visning="masker"]');
  bar().querySelector('.tab[data-fane="vis"]').click();
  tjek('Vis-fanen viser tema og sprog', !bar().querySelector('.grupper[data-fane="vis"]').hidden && bar().querySelector('.grupper[data-fane="start"]').hidden);
  tjek('Vis-fanen: aria-selected', bar().querySelector('.tab[data-fane="vis"]').getAttribute('aria-selected') === 'true');
  tjek('fanen skifter ikke visningen', synlige(d).join() === 'masker');
  bar().querySelector('[data-kommando="tema-moerk"]').click();
  tjek('Mørk: data-tema="moerk"', d.documentElement.getAttribute('data-tema') === 'moerk');
  tjek('Mørk: gemt', s.w.localStorage.getItem('grimnir-tema') === 'moerk');
  tjek('Mørk: aria-pressed i alle fire bånd', [...d.querySelectorAll('[data-kommando="tema-moerk"]')].every(b => b.getAttribute('aria-pressed') === 'true') && [...d.querySelectorAll('[data-kommando="tema-lys"]')].every(b => b.getAttribute('aria-pressed') === 'false'));
  bar().querySelector('[data-kommando="tema-lys"]').click();
  tjek('Lys: data-tema="lys"', d.documentElement.getAttribute('data-tema') === 'lys');
  bar().querySelector('[data-kommando="tema-system"]').click();
  tjek('System: data-tema="system"', d.documentElement.getAttribute('data-tema') === 'system' && s.w.localStorage.getItem('grimnir-tema') === 'system');
  const igen = side({ lager: { 'grimnir-tema': 'moerk' } });
  tjek('gemt tema sættes, før siden tegnes (tema.js i head)', igen.d.documentElement.getAttribute('data-tema') === 'moerk');
  const skidt = side({ lager: { 'grimnir-tema': 'lilla' } });
  tjek('ukendt gemt tema giver system', skidt.d.documentElement.getAttribute('data-tema') === 'system');
  const tokens = ui('assets/tokens.css');
  tjek('tokens.css: lyst på :root, mørkt på [data-tema="moerk"] og ved system', /:root \{\n  color-scheme: light;/.test(tokens) && /:root\[data-tema="moerk"\] \{\n  color-scheme: dark;/.test(tokens) && /@media \(prefers-color-scheme: dark\) \{\n  :root\[data-tema="system"\]/.test(tokens));
}

// ── Sprog ──
{
  const s = side();
  const { d } = s;
  await vent();
  tjek('sprog: dansk som standard', d.documentElement.lang === 'da' && d.querySelector('.vs[data-visning="masker"] span').textContent === 'Maskér');
  const bar = d.querySelector('#baand > [data-visning="masker"]');
  bar.querySelector('[data-kommando="sprog-en"]').click();
  tjek('English: lang="en"', d.documentElement.lang === 'en');
  tjek('English: visningerne', [...d.querySelectorAll('.vs span')].map(x => x.textContent).join() === 'Mask,Unmask,Cases,Dictionary');
  tjek('English: kommandoer og grupper', bar.querySelector('[data-kommando="gem-masker"]').textContent.trim() === 'Save and mask' && bar.querySelector('.cap').textContent === 'Text');
  tjek('English: aria-label og title følger med', d.getElementById('aabn-indst').getAttribute('aria-label') === 'Open settings' && bar.querySelector('[data-kommando="analyser"]').title === 'Paste a text first' && bar.querySelector('[data-kommando="kvittering"]').title === 'Coming in a later version of Grimnir');
  tjek('English: placeholder følger med', d.querySelector('section[data-visning="masker"] input').placeholder === 'Search the findings');
  tjek('English: fodlinjen og kernen', d.getElementById('fod-lokalt').textContent.trim() === 'Only on this machine' && /^Core /.test(d.getElementById('fod-kerne').textContent));
  tjek('English: gemt', s.w.localStorage.getItem('grimnir-sprog') === 'en');
  tjek('English: aria-pressed', bar.querySelector('[data-kommando="sprog-en"]').getAttribute('aria-pressed') === 'true' && bar.querySelector('[data-kommando="sprog-da"]').getAttribute('aria-pressed') === 'false');
  const igen = side({ lager: { 'grimnir-sprog': 'en' } });
  await vent();
  tjek('gemt sprog bruges ved start', igen.d.documentElement.lang === 'en' && igen.d.querySelector('.tab').textContent === 'Home');
  bar.querySelector('[data-kommando="sprog-da"]').click();
  tjek('tilbage til dansk', d.documentElement.lang === 'da' && bar.querySelector('[data-kommando="gem-masker"]').textContent.trim() === 'Gem og maskér');
}

// ── Oversættelser og StatusChips i begge sprog ──
for (const sprog of ['da', 'en']) {
  const s = side({ lager: { 'grimnir-sprog': sprog } });
  const { d, w } = s;
  await vent(5);
  const T = w.Sprog.TEKST;
  const mangler = [];
  for (const attr of ['data-t', 'data-t-aria', 'data-t-title', 'data-t-ph']) {
    for (const el of d.querySelectorAll(`[${attr}]`)) {
      const k = el.getAttribute(attr);
      if (!(k in T.da) || !(k in T.en)) mangler.push(`${attr}=${k}`);
    }
  }
  tjek(`${sprog}: ingen data-t uden oversættelse i begge sprog`, mangler.length === 0, [...new Set(mangler)].join(', '));
  tjek(`${sprog}: da og en har de samme nøgler`, JSON.stringify(Object.keys(T.da).sort()) === JSON.stringify(Object.keys(T.en).sort()));
  const chips = [...d.querySelectorAll('.chip')];
  tjek(`${sprog}: der er StatusChips (én pr. visning)`, chips.length === 4, String(chips.length));
  const daarlige = chips.filter(c => { const sym = c.querySelector('[aria-hidden="true"]'); const ord = c.querySelector('.ord'); return !sym || !sym.textContent.trim() || !ord || ord.textContent.trim().length < 2; });
  tjek(`${sprog}: hver StatusChip har symbol og ord`, daarlige.length === 0, daarlige.map(c => c.outerHTML).join(' '));
  const tomme = [...d.querySelectorAll('[data-t]')].filter(el => !el.textContent.trim());
  tjek(`${sprog}: ingen tomme tekster`, tomme.length === 0, tomme.map(e => e.getAttribute('data-t')).join(', '));
  const unavngivne = [...d.querySelectorAll('button, a[href], input, [role="tab"], [role="treeitem"]')].filter(el => !(el.getAttribute('aria-label') || el.textContent.trim()));
  tjek(`${sprog}: alt, der kan aktiveres, har et navn`, unavngivne.length === 0, unavngivne.map(e => e.outerHTML.slice(0, 80)).join(' | '));
}

// ── Kittet: komponenterne ──
{
  const { w, d } = side();
  await vent();
  const K = w.Kit;
  tjek('Kit: StatusChip-symbolerne', ['ok', 'warn', 'danger', 'info', 'none'].map(v => K.chip(v, 'x').firstChild.textContent).join('') === '✓!?i–');
  let kast = false;
  try { K.chip('lilla', 'x'); } catch (e) { kast = true; }
  tjek('Kit: ukendt chip-variant afvises', kast);
  const b = K.knap({ tekst: 'Kopiér resultat', variant: 'primary', ikon: 'kopier', genvej: '⌘C' });
  tjek('Kit: Button primær med ikon og genvej', b.className === 'btn primary' && b.querySelector('svg') && b.querySelector('.gv').textContent === '⌘C' && b.type === 'button');
  const f = K.felt({ etiket: 'Eget net', vaerdi: '10.20.0.0/33', mono: true, foelsom: true, fejl: '/33 er ikke en gyldig maske. Brug /0 til /32.' });
  const inp = f.querySelector('input');
  tjek('Kit: TextField med etiket, fejl og følsom tekst', f.querySelector('label').htmlFor === inp.id && inp.getAttribute('aria-invalid') === 'true' && inp.spellcheck === false && inp.getAttribute('autocomplete') === 'off' && inp.getAttribute('aria-describedby') === f.querySelector('.hj').id && f.querySelector('.hj').classList.contains('fejltekst'));
  const ban = K.banner({ variant: 'warn', tekst: 'Svaret indeholder en adresse, sagen ikke kender.', handling: { tekst: 'Se den' } });
  tjek('Kit: Banner med symbol, sætning og én tekstknap', ban.querySelector('.s').textContent === '!' && ban.querySelectorAll('button.btn.ghost').length === 1 && ban.getAttribute('role') === 'alert');
  let valgt = null;
  const tab = K.tabel({
    kolonner: [{ tekst: 'Original' }, { tekst: 'Antal', tal: true }, { tekst: 'Sikkerhed' }],
    raekker: [{ gruppe: 'Net', note: '198.18.0.0/24' }, { celler: ['192.0.2.11', 2, K.chip('ok', 'Sikker')], mono: [0], data: 'a' }, { celler: ['192.0.2.12', 1, K.chip('warn', 'Sandsynlig')], mono: [0], data: 'b' }],
    vedValg: (tr, data) => { valgt = data; },
  });
  d.body.appendChild(tab);
  const r = [...tab.querySelectorAll('tbody tr:not(.gruppe)')];
  r[0].click();
  tjek('Kit: DataTable vælger rækken med klik', valgt === 'a' && r[0].classList.contains('sel') && r[0].getAttribute('aria-selected') === 'true');
  r[0].dispatchEvent(new w.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
  tjek('Kit: DataTable flytter med pil ned', valgt === 'b' && r[1].classList.contains('sel') && !r[0].classList.contains('sel') && d.activeElement === r[1]);
  tjek('Kit: DataTable: tal højrestillet, værdier i mono, gruppe-række', tab.querySelector('th.r') && r[0].children[1].className === 'r' && r[0].children[0].className === 'mono' && tab.querySelector('tr.gruppe td').colSpan === 3);
  // Træet: piletaster, fold og Enter
  const ul = d.querySelector('.navdel[data-visning="ordbog"] ul');
  const pkt = [...ul.querySelectorAll('.tr')];
  pkt[1].focus();
  pkt[1].dispatchEvent(new w.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
  tjek('Kit: træet flytter fokus med pil ned', d.activeElement === pkt[2]);
  pkt[2].dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  tjek('Kit: Enter vælger punktet, og filteret følger', pkt[2].getAttribute('aria-current') === 'true' && d.querySelector('section[data-visning="ordbog"] .fl span').textContent === 'Maskér aldrig');
  pkt[0].focus();
  pkt[0].dispatchEvent(new w.KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
  tjek('Kit: venstre folder ind', pkt[0].getAttribute('aria-expanded') === 'false' && pkt[0].parentElement.querySelector('ul').hidden);
  pkt[0].dispatchEvent(new w.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  tjek('Kit: højre folder ud', pkt[0].getAttribute('aria-expanded') === 'true' && !pkt[0].parentElement.querySelector('ul').hidden);
  tjek('Kit: et klik i træet skifter ikke visning', synlige(d).join() === 'masker');
  // CommandBar: piletaster mellem faner
  const tabs = [...d.querySelectorAll('#baand > [data-visning="masker"] .tab')];
  tabs[0].focus();
  tabs[0].dispatchEvent(new w.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  tjek('Kit: CommandBar: pil højre vælger næste fane', tabs[1].getAttribute('aria-selected') === 'true' && d.activeElement === tabs[1]);
}

// ══════════════════════════ V-SKAL.2: Maskér og Demaskér ══════════════════════════

/* En opdigtet tekst med CRLF og en efterlignet Rust, der svarer som src-tauri/src/maskering.rs (samme felter). */
const TEKST = 'srcip=10.20.30.11 user="bruger060"\r\nPassword=Sommer2026!;\r\nversion 10.2.3.4\r\n';
const HEMMELIG = 'Sommer2026!';
function falskRust({ rester = [], afvis = null } = {}) {
  const RAEKKER = [
    { id: 6, art: 'ipv4_egen', status: 'sikker', standard: true, hemmelig: false, vaerdier: ['10.20.30.11'], koder: ['198.18.0.11'], linje: 1 },
    { id: 24, art: 'bruger', status: 'sandsynlig', standard: true, hemmelig: false, vaerdier: ['bruger060'], koder: ['user0001'], linje: 1 },
    { id: 45, art: 'hemmelighed', status: 'sikker', standard: true, hemmelig: true, vaerdier: [HEMMELIG], koder: ['GRIMNIR_SECRET_0001'], linje: 2 },
    { id: 67, art: 'entropi', status: 'tjek', standard: false, hemmelig: true, vaerdier: ['Zq8Xv2Lm9Pw4'], koder: ['GRIMNIR_SECRET_0002'], linje: 3 },
    { id: 70, art: 'ipv4_egen', status: 'version', standard: false, hemmelig: false, vaerdier: ['10.2.3.4'], koder: ['198.18.1.4'], linje: 3 },
  ];
  let poster = 0, koder = {};
  const beregn = ({ fravalgt, rettelser }) => {
    const ret = new Map((rettelser || []).map(r => [r.id, r.kode]));
    const fejl = [...ret].filter(([, k]) => k === afvis).map(([id, kode]) => ({ id, fejl: 'kollision', kode }));
    const raekker = RAEKKER.map(r => ({ ...r, laast: false, antal: 1, kendt: false, rettet: ret.has(r.id), valgt: fravalgt == null ? r.standard : !fravalgt.includes(r.id), koder: ret.has(r.id) ? [ret.get(r.id)] : r.koder }));
    return { raekker, fejl };
  };
  return {
    analyser: a => { const b = beregn(a); return { raekker: b.raekker, fejl: b.fejl, advarsler: [], bytes: a.tekst.length, linjer: 3 }; },
    gem_og_masker: a => {
      const b = beregn(a);
      if (b.fejl.length) throw { art: 'raekker', fejl: b.fejl };
      let m = a.tekst;
      koder = {};
      for (const r of b.raekker.filter(x => x.valgt)) { m = m.split(r.vaerdier[0]).join(r.koder[0]); koder[r.koder[0]] = r.vaerdier[0]; }
      poster = Object.keys(koder).length;
      return { maskeret: m, rester, advarsler: [], poster };
    },
    demasker: a => {
      let t = a.tekst;
      for (const [k, o] of Object.entries(koder)) t = t.split(k).join(o);
      // linjer: som fil::antal_linjer i Rust (V-RET.1 R3): linjeskift (LF, CRLF, enligt CR) + 1 uden afsluttende linjeskift.
      const linjer = a.tekst === '' ? 0 : (a.tekst.match(/\r\n|\r|\n/g) || []).length + (/[\r\n]$/.test(a.tekst) ? 0 : 1);
      return { tekst: t, linjer, koder: Object.keys(koder).slice(1), advarsler: [{ art: 'ukendt_kode', kode: 'h0099', antal: 1, linje: 1 }, { art: 'ikke_brugt', kode: Object.keys(koder)[0], antal: 1, linje: 0 }] };
    },
    sag_status: () => ({ poster }),
    sag_nulstil: () => { poster = 0; koder = {}; return { poster: 0 }; },
    menu_sprog: () => null,
  };
}
/* Indsæt som WKWebView gør det: en paste-hændelse med clipboardData på det fokuserede element. */
function indsaet(w, maal, tekst) {
  const e = new w.Event('paste', { bubbles: true, cancelable: true });
  Object.defineProperty(e, 'clipboardData', { value: { getData: t => (t === 'text/plain' ? tekst : '') } });
  maal.dispatchEvent(e);
  return e;
}
const kommandoAktiv = (d, v, id) => d.querySelector(`#baand > [data-visning="${v}"] [data-kommando="${id}"]`).getAttribute('aria-disabled') !== 'true';
const knapI = (d, v, id) => d.querySelector(`#baand > [data-visning="${v}"] [data-kommando="${id}"]`);
const fundRaekker = d => [...d.querySelectorAll('section[data-visning="masker"] .fundtabel tbody tr[data-id]')];
const raekkeMed = (d, id) => d.querySelector(`section[data-visning="masker"] .fundtabel tr[data-id="${id}"]`);

// ── Statisk: konsol, lagring og nøgler til Rusts navne ──
{
  const js = fs.readdirSync(path.join(repo, 'ui', 'assets')).filter(f => f.endsWith('.js'));
  const medKonsol = js.filter(f => /\bconsole\s*\./.test(ui('assets/' + f)));
  tjek('ingen console.* i ui/assets/*.js', medKonsol.length === 0, medKonsol.join(', '));
  const lager = js.filter(f => /localStorage\s*\.\s*setItem|sessionStorage|indexedDB/.test(ui('assets/' + f)));
  tjek('kun tema.js og sprog.js skriver til localStorage (ingen sessionStorage/IndexedDB)', JSON.stringify(lager.sort()) === JSON.stringify(['sprog.js', 'tema.js']), lager.join(', '));
  const m = ui('assets/maskering.js');
  tjek('Maskér viser teksten i <pre>, aldrig i et textarea', !/createElement\(['"]textarea/.test(m) && /el\('pre'/.test(m));
  tjek('teksten tages fra clipboardData.getData(\'text/plain\')', /clipboardData\.getData\('text\/plain'\)/.test(m));
  const rs = fs.readFileSync(path.join(repo, 'src-tauri', 'src', 'maskering.rs'), 'utf8');
  const navne = (fn) => [...rs.slice(rs.indexOf('fn ' + fn)).split(/\n}\n/)[0].matchAll(/=> "([a-z0-9_]+)"/g)].map(x => x[1]);
  const { w } = side();
  const T = w.Sprog.TEKST;
  for (const [fn, pre] of [['art_navn', 'art_'], ['klasse_navn', 'art_'], ['advarsel_navn', 'adv_'], ['status_navn', null]]) {
    const n = navne(fn);
    const mangler = n.filter(x => pre ? !(pre + x in T.da && pre + x in T.en) : !Object.values({ sikker: 'stSikker', ordbog: 'stOrdbog', sandsynlig: 'stSandsynlig', tjek: 'stTjek', version: 'stVersion' }).includes({ sikker: 'stSikker', ordbog: 'stOrdbog', sandsynlig: 'stSandsynlig', tjek: 'stTjek', version: 'stVersion' }[x]));
    tjek(`sprog: hvert navn fra ${fn} i maskering.rs har en tekst (${n.length})`, n.length >= 5 && mangler.length === 0, mangler.join(', '));
  }
  const fejlNavne = [...rs.matchAll(/fejl: "([a-z_]+)"|=> "(kollision|ugyldig|ukendt_raekke)"/g)].map(x => x[1] || x[2]);
  const fm = [...new Set(fejlNavne)].filter(x => !('fejl_' + x in T.da && 'fejl_' + x in T.en));
  tjek('sprog: hver rækkefejl fra maskering.rs har en tekst', fejlNavne.length >= 3 && fm.length === 0, fm.join(', '));
}

// ── Maskér: hele forløbet ──
{
  const skrevet = [];
  let logget = 0;
  const s = side({
    rust: falskRust(),
    foer: w => {
      Object.defineProperty(w.navigator, 'clipboard', { value: { writeText: async t => { skrevet.push(t); } }, configurable: true });
      for (const k of ['log', 'info', 'warn', 'error', 'debug']) w.console[k] = () => { logget++; };
    },
  });
  const { d, w } = s;
  await vent(5);
  const G = w.GrimnirMaskering;
  const sek = d.querySelector('section[data-visning="masker"]');
  const tom = sek.querySelector('.tom');
  tjek('Maskér: tom tilstand tager imod ⌘V (kan få fokus, navn med genvej)', tom.tabIndex === 0 && tom.getAttribute('aria-label') === 'Tom flade: indsæt en log eller et script med ⌘V');
  tjek('Maskér: før indsæt er kun Indsæt aktiv', kommandoAktiv(d, 'masker', 'indsaet') && !kommandoAktiv(d, 'masker', 'analyser') && !kommandoAktiv(d, 'masker', 'gem-masker') && !kommandoAktiv(d, 'masker', 'kopier') && knapI(d, 'masker', 'analyser').title === 'Indsæt en tekst først');
  tjek('menu_sprog kaldes ved start med da', s.kald.some(k => k[0] === 'menu_sprog' && k[1].sprog === 'da'));

  // For stor tekst afvises med besked; intet indsat.
  const stor = 'x'.repeat(5 * 1024 * 1024 + 1);
  tom.focus();
  indsaet(w, tom, stor);
  tjek('over 5 MB: afvist med banner, intet indsat', G.M.st.tekst === null && /Teksten er 5\.0 MB\. Grimnir tager højst 5 MB/.test(sek.textContent) && sek.querySelector('.ban.danger'));
  tjek('utf8Laengde tæller bytes (æ = 2, € = 3, 😀 = 4)', G.utf8Laengde('aæ€😀') === 10 && G.MAKS_BYTES === 5242880);

  // ⌘V: teksten gemmes bytepræcist og vises i et felt, der ikke kan redigeres.
  const e = indsaet(w, tom, TEKST);
  tjek('⌘V: teksten er den indsatte, med CRLF', G.M.st.tekst === TEKST && (G.M.st.tekst.match(/\r\n/g) || []).length === 3 && e.defaultPrevented);
  const pre = sek.querySelector('pre.tekst');
  tjek('⌘V: vises i <pre>, ikke redigerbar, med CRLF', pre && pre.textContent === TEKST && !pre.isContentEditable && pre.tabIndex === 0 && !sek.querySelector('textarea'));
  tjek('efter indsæt: Analysér aktiv, Gem og maskér venter på analysen', kommandoAktiv(d, 'masker', 'analyser') && !kommandoAktiv(d, 'masker', 'gem-masker') && knapI(d, 'masker', 'gem-masker').title === 'Analysér teksten først' && knapI(d, 'masker', 'analyser').title === 'Genvej: ⌘↵');
  // Indsæt i søgefeltet er almindeligt indsæt.
  const soeg = sek.querySelector('.vl input[type="search"]');
  const e2 = indsaet(w, soeg, 'noget andet');
  tjek('indsæt i søgefeltet tages ikke af Maskér', !e2.defaultPrevented && G.M.st.tekst === TEKST);

  // ⌘↵ første gang: Analysér
  s.tast('Enter', { metaKey: true });
  await vent(5);
  const ak = s.kald.filter(k => k[0] === 'analyser');
  tjek('⌘↵ første gang: analyser med teksten og kernens standard', ak.length === 1 && ak[0][1].tekst === TEKST && ak[0][1].fravalgt === null && ak[0][1].rettelser === null);
  let r = fundRaekker(d);
  tjek('tabellen: én række pr. enhed (5)', r.length === 5, String(r.length));
  tjek('tabellen: kolonnerne Type, Fundet værdi, Erstatning, Antal, Status, Ordbog', [...sek.querySelectorAll('.fundtabel th')].map(t => t.textContent).join('|') === '✓|Type|Fundet værdi|Erstatning|Antal|Status|Ordbog');
  tjek('Tjek selv og Version er slået fra; resten til', r.map(x => x.querySelector('input[type="checkbox"]').checked).join() === 'true,true,true,false,false');
  tjek('StatusChips: Sikker, Sandsynlig, Tjek selv, Version med symbol', r.map(x => x.querySelector('.chip').textContent).join('|') === '✓Sikker|!Sandsynlig|✓Sikker|?Tjek selv|–Version');
  tjek('hemmeligheder vises som prikker som standard', !sek.querySelector('.fundtabel').textContent.includes(HEMMELIG) && !sek.querySelector('.fundtabel').textContent.includes('Zq8Xv2Lm9Pw4') && raekkeMed(d, 45).querySelector('.prikker'));
  tjek('hemmelighedens afkrydsning nævner ikke værdien', !raekkeMed(d, 45).querySelector('input[type="checkbox"]').getAttribute('aria-label').includes(HEMMELIG));
  raekkeMed(d, 45).querySelector('button.mini').click();
  tjek('Vis viser hemmeligheden i rækken', raekkeMed(d, 45).textContent.includes(HEMMELIG) && raekkeMed(d, 45).querySelector('button.mini').textContent === 'Skjul');
  raekkeMed(d, 45).querySelector('button.mini').click();
  tjek('Skjul skjuler den igen', !raekkeMed(d, 45).textContent.includes(HEMMELIG));
  const trae = n => d.querySelector(`.navdel[data-visning="masker"] [data-punkt="${n}"] .ant`).textContent;
  tjek('træets antal: alle 5, tjek 1, hemmeligheder 2, seneste 0', [trae('alle'), trae('tjek'), trae('hemmelig'), trae('seneste')].join() === '5,1,2,0');
  tjek('fodlinjen: antal fund og antal valgt', d.getElementById('fod-venstre').textContent === '5 fund · 3 maskeres');
  tjek('værktøjslinjen: "1 venter på dig"', sek.querySelector('.vl .chip').textContent === '!1 venter på dig');
  tjek('søgefeltet er aktivt efter analysen', !soeg.disabled);

  // Filtrene i træet og søgning
  const traeKnap = n => d.querySelector(`.navdel[data-visning="masker"] [data-punkt="${n}"]`);
  traeKnap('hemmelig').click();
  tjek('filter Hemmeligheder: 2 rækker', fundRaekker(d).length === 2 && sek.querySelector('.fl span').textContent === 'Hemmeligheder');
  traeKnap('tjek').click();
  tjek('filter Skal tjekkes: 1 række (Tjek selv)', fundRaekker(d).length === 1 && fundRaekker(d)[0].getAttribute('data-id') === '67');
  traeKnap('seneste').click();
  tjek('filter Seneste i sagen: ingen (sagen er ny)', fundRaekker(d).length === 0 && sek.textContent.includes('Ingen rækker passer til filteret.'));
  traeKnap('alle').click();
  soeg.value = 'user0001';
  soeg.dispatchEvent(new w.Event('input', { bubbles: true }));
  tjek('søgning på erstatning', fundRaekker(d).length === 1 && fundRaekker(d)[0].getAttribute('data-id') === '24');
  soeg.value = 'sommer';
  soeg.dispatchEvent(new w.Event('input', { bubbles: true }));
  tjek('søgning finder ikke en skjult hemmelighed på værdien', fundRaekker(d).length === 0);
  soeg.value = '10.20';
  soeg.dispatchEvent(new w.Event('input', { bubbles: true }));
  tjek('søgning på værdi', fundRaekker(d).length === 1 && fundRaekker(d)[0].getAttribute('data-id') === '6');
  soeg.value = '';
  soeg.dispatchEvent(new w.Event('input', { bubbles: true }));

  // Ret en kode og slå en række fra: ny analyse med valgene (efter et øjeblik)
  const kode = raekkeMed(d, 24).querySelector('input[data-felt="kode"]');
  kode.focus();
  kode.value = 'kunde01';
  kode.dispatchEvent(new w.Event('change', { bubbles: true }));
  const cb = raekkeMed(d, 6).querySelector('input[type="checkbox"]');
  cb.checked = false;
  cb.dispatchEvent(new w.Event('change', { bubbles: true }));
  tjek('slå fra: rækken bliver nedtonet straks, og erstatningen låses', raekkeMed(d, 6).classList.contains('fra') && raekkeMed(d, 6).querySelector('input[data-felt="kode"]').disabled);
  await vent(450);
  const ak2 = s.kald.filter(k => k[0] === 'analyser');
  const sidste = ak2[ak2.length - 1][1];
  tjek('ny analyse med fravalg og rettelse (én, efter 350 ms)', ak2.length === 2 && JSON.stringify(sidste.fravalgt.sort((a, b) => a - b)) === '[6,67,70]' && JSON.stringify(sidste.rettelser) === '[{"id":24,"kode":"kunde01"}]', JSON.stringify(sidste));
  tjek('rettelsen står i rækken', raekkeMed(d, 24).querySelector('input[data-felt="kode"]').value === 'kunde01');
  tjek('fodlinjen følger valget', d.getElementById('fod-venstre').textContent === '5 fund · 2 maskeres');

  // ⌘↵ anden gang: Gem og maskér
  s.tast('Enter', { metaKey: true });
  await vent(5);
  const gk = s.kald.filter(k => k[0] === 'gem_og_masker');
  tjek('⌘↵ anden gang: gem_og_masker med valgene', gk.length === 1 && JSON.stringify(gk[0][1].fravalgt.sort((a, b) => a - b)) === '[6,67,70]' && gk[0][1].rettelser[0].kode === 'kunde01' && gk[0][1].tekst === TEKST);
  const forventet = TEKST.split('bruger060').join('kunde01').split(HEMMELIG).join('GRIMNIR_SECRET_0001');
  tjek('resultatet vises (efter), med CRLF', G.M.st.resultat.maskeret === forventet && pre.textContent === forventet && knapI(d, 'masker', 'foer-efter').getAttribute('aria-pressed') === 'true');
  tjek('lækagetjekket: grønt banner ved 0 rester', sek.querySelector('.arbejde .bannere .ban.ok') && sek.querySelector('.arbejde .bannere').textContent.includes('Lækagetjekket fandt ingen'));
  tjek('Kopiér og Før og efter er aktive', kommandoAktiv(d, 'masker', 'kopier') && kommandoAktiv(d, 'masker', 'foer-efter') && knapI(d, 'masker', 'kopier').title === 'Genvej: ⇧⌘C');
  tjek('titellinjen: Midlertidig sag · 2 værdier', d.getElementById('sag-knap').textContent === 'Midlertidig sag · 2 værdier' && !d.getElementById('sag-knap').hidden && d.getElementById('sag').hidden);
  knapI(d, 'masker', 'foer-efter').click();
  tjek('Før og efter viser originalen igen', pre.textContent === TEKST && knapI(d, 'masker', 'foer-efter').getAttribute('aria-pressed') === 'false');
  knapI(d, 'masker', 'foer-efter').click();
  knapI(d, 'masker', 'kopier').click();
  await vent(5);
  tjek('Kopiér: resultatet fra hukommelsen, bytepræcist (CRLF)', skrevet.length === 1 && skrevet[0] === forventet && (skrevet[0].match(/\r\n/g) || []).length === 3);
  tjek('Kopiér: "Kopieret." i en statuslinje', sek.querySelector('.besked').textContent === 'Kopieret.' && sek.querySelector('.besked').getAttribute('role') === 'status');
  s.tast('C', { metaKey: true, shiftKey: true, code: 'KeyC' });
  await vent(5);
  tjek('⇧⌘C kopierer også', skrevet.length === 2 && skrevet[1] === forventet);
  tjek('V-LAAS.4: Kopiér i Maskér melder intet til Rust (udklip_kopieret)', !s.kald.some(k => k[0] === 'udklip_kopieret'));
  // Ændres et valg efter maskeringen, forsvinder resultatet.
  const cb2 = raekkeMed(d, 45).querySelector('input[type="checkbox"]');
  cb2.checked = false;
  cb2.dispatchEvent(new w.Event('change', { bubbles: true }));
  tjek('ændret valg efter maskering: resultat væk, Kopiér nedtonet, besked', !G.M.st.resultat && !kommandoAktiv(d, 'masker', 'kopier') && sek.textContent.includes('Valgene er ændret'));
  await vent(450);

  // Demaskér med den sag, der nu findes
  s.w.location.hash = 'demasker';
  await vent(5);
  const dsek = d.querySelector('section[data-visning="demasker"]');
  tjek('Demaskér: tom tilstand, når sagen har poster', dsek.querySelector('.tom p').textContent.startsWith('Her sætter du svaret'));
  const svarTekst = 'Prøv kunde01 på GRIMNIR_SECRET_0001\r\nog h0099\r\n';
  indsaet(w, dsek.querySelector('.tom'), svarTekst);
  tjek('Demaskér: svaret indsat bytepræcist, Demaskér aktiv og primær', G.D.st.tekst === svarTekst && kommandoAktiv(d, 'demasker', 'demasker') && knapI(d, 'demasker', 'demasker').classList.contains('pri'));
  s.tast('Enter', { metaKey: true });
  await vent(5);
  tjek('⌘↵ i Demaskér: demasker med svaret', s.kald.some(k => k[0] === 'demasker' && k[1].tekst === svarTekst));
  tjek('Demaskér: resultatet med de rigtige værdier og CRLF', dsek.querySelectorAll('pre.tekst')[1].textContent === 'Prøv bruger060 på Sommer2026!\r\nog h0099\r\n');
  tjek('Demaskér: advarsel som banner og ikke-brugt som oplysning', dsek.querySelector('.ban.warn') && dsek.querySelector('.ban.warn').textContent.includes('1 sted i svaret') && !dsek.querySelector('.ban.warn').textContent.includes('1 steder') && dsek.querySelector('.ban.info'));
  const dtrae = n => d.querySelector(`.navdel[data-visning="demasker"] [data-punkt="${n}"]`);
  dtrae('advarsler').click();
  const dr = [...dsek.querySelectorAll('.advarselpanel tbody tr')];
  tjek('Demaskér: advarslerne som rækker (hvad, kode, antal, linje)', dr.length === 1 && dr[0].textContent.includes('Ukendt kode') && dr[0].textContent.includes('h0099') && dsek.querySelector('.advarselpanel h3').textContent === 'Advarsler');
  dsek.querySelector('.ban.info button').click();
  tjek('"Vis dem" vælger Ikke brugt i træet', dtrae('ikke-brugt').getAttribute('aria-current') === 'true' && dsek.querySelectorAll('.advarselpanel tbody tr').length === 1);
  dtrae('alle').click();
  tjek('Alle koder: sat tilbage + advarsler', dsek.querySelectorAll('.advarselpanel tbody tr').length === 3);
  tjek('Demaskér: træets antal', [dtrae('alle'), dtrae('advarsler'), dtrae('ikke-brugt')].map(b => b.querySelector('.ant').textContent).join() === '3,1,1');
  knapI(d, 'demasker', 'kopier-resultat').click();
  await vent(5);
  tjek('Demaskér: Kopiér resultat bytepræcist', skrevet[skrevet.length - 1] === 'Prøv bruger060 på Sommer2026!\r\nog h0099\r\n');
  const meldt = s.kald.filter(k => k[0] === 'udklip_kopieret');
  tjek('V-LAAS.4: efter Kopiér i Demaskér melder webvisningen det til Rust én gang (indsat tekst: fil false), uden teksten', meldt.length === 1 && JSON.stringify(meldt[0][1]) === '{"fil":false}' && s.kald.findIndex(k => k[0] === 'udklip_kopieret') > s.kald.findIndex(k => k[0] === 'demasker'), JSON.stringify(meldt));

  // Nulstil sagen fra titellinjen (med bekræftelse)
  d.getElementById('sag-knap').click();
  tjek('sagsknappen åbner dialogen med antal', d.getElementById('dlg-sag').hasAttribute('open') && d.getElementById('dlg-sag-p').textContent.includes('2 værdier'));
  d.querySelector('#dlg-sag [data-luk]').click();
  tjek('Luk nulstiller ikke', !s.kald.some(k => k[0] === 'sag_nulstil') && !d.getElementById('sag-knap').hidden);
  d.getElementById('sag-knap').click();
  d.getElementById('sag-nulstil').click();
  await vent(5);
  tjek('Nulstil: sagen er tom, titellinjen siger Ingen sag åben', s.kald.some(k => k[0] === 'sag_nulstil') && d.getElementById('sag-knap').hidden && !d.getElementById('sag').hidden && !d.getElementById('dlg-sag').hasAttribute('open'));
  tjek('Nulstil: Demaskér er nedtonet med forklaring', !kommandoAktiv(d, 'demasker', 'demasker') && knapI(d, 'demasker', 'demasker').title === 'Maskér en tekst i denne session først');

  tjek('ingen konsoludskrift under hele forløbet', logget === 0, String(logget));
  const noegler = Object.keys(w.localStorage);
  tjek('localStorage har kun tema og sprog (her: intet valgt)', noegler.every(k => ['grimnir-tema', 'grimnir-sprog'].includes(k)), noegler.join());
  tjek('teksten og hemmeligheden står ikke i localStorage', !JSON.stringify(Object.entries(w.localStorage)).includes(HEMMELIG));

  // Sprogskift: tabellens tekster og programmenuen følger med
  s.w.location.hash = 'masker';
  await vent(5);
  tjek('Nulstil: Maskér beholder teksten, men analysen er væk (koderne gælder ikke længere)', G.M.st.tekst === TEKST && !G.M.st.analyse && fundRaekker(d).length === 0);
  knapI(d, 'masker', 'sprog-en').click();
  await vent(5);
  s.tast('Enter', { metaKey: true });
  await vent(5);
  tjek('English: menu_sprog med en', s.kald.some(k => k[0] === 'menu_sprog' && k[1].sprog === 'en'));
  tjek('English: typer og status i tabellen', raekkeMed(d, 24).textContent.includes('User') && raekkeMed(d, 6).textContent.includes('Certain'));
  tjek('English: localStorage har kun tema og sprog', Object.keys(w.localStorage).every(k => ['grimnir-tema', 'grimnir-sprog'].includes(k)) && w.localStorage.getItem('grimnir-sprog') === 'en');
}

// ── Maskér: rester, afvist rettelse og Windows-genveje ──
{
  const skrevet = [];
  const s = side({ platform: 'windows', rust: falskRust({ rester: [{ art: 'nyt_fund', type_: 'hemmelighed', tekst: 'Hemmelig42', antal: 2, linje: 2 }], afvis: 'kollision01' }), foer: w => Object.defineProperty(w.navigator, 'clipboard', { value: { writeText: async t => { skrevet.push(t); } } }) });
  const { d, w } = s;
  await vent(5);
  const sek = d.querySelector('section[data-visning="masker"]');
  indsaet(w, sek.querySelector('.tom'), TEKST);
  s.tast('Enter', { ctrlKey: true });
  await vent(5);
  tjek('Windows: Ctrl+↵ analyserer', s.kald.some(k => k[0] === 'analyser') && knapI(d, 'masker', 'analyser').getAttribute('aria-keyshortcuts') === null);
  // Afvist rettelse: rækken får fejlen, intet gemmes.
  const kode = raekkeMed(d, 24).querySelector('input[data-felt="kode"]');
  kode.value = 'kollision01';
  kode.dispatchEvent(new w.Event('change', { bubbles: true }));
  knapI(d, 'masker', 'gem-masker').click();
  await vent(5);
  tjek('afvist rettelse: fejlbanner, intet resultat, ingen sag', sek.querySelector('.ban.danger') && sek.textContent.includes('1 rettelse kan ikke bruges, så intet er gemt. Se rækken med rødt.') && !s.w.GrimnirMaskering.M.st.resultat && d.getElementById('sag-knap').hidden);
  const k2 = raekkeMed(d, 24).querySelector('input[data-felt="kode"]');
  const k2fejl = d.getElementById(k2.getAttribute('aria-describedby') || 'mangler');
  tjek('afvist rettelse: fejlen står på rækken (aria-invalid + tekst)', k2.getAttribute('aria-invalid') === 'true' && k2fejl && k2fejl.textContent === 'kollision01 findes allerede i sagen eller i teksten.', String(k2.outerHTML) + ' | ' + (k2fejl ? k2fejl.outerHTML : 'intet'));
  tjek('afvist rettelse: fejlen nævner ikke en original', !sek.querySelector('.raekkefejl').textContent.includes('bruger060'));
  await vent(450);
  k2.value = 'kunde02';
  k2.dispatchEvent(new w.Event('change', { bubbles: true }));
  await vent(450);
  s.tast('Enter', { ctrlKey: true });
  await vent(5);
  tjek('rester: advarselsbanner med antal og knap', sek.querySelector('.ban.warn') && sek.querySelector('.ban.warn').textContent.includes('2 steder') && sek.querySelector('.ban.warn button').textContent === 'Vis dem');
  sek.querySelector('.ban.warn button').click();
  tjek('rester: "Vis dem" viser dem i tabellen', sek.querySelector('.resttabel') && sek.querySelector('.resttabel').textContent.includes('Hemmelig42') && sek.querySelector('.ban.warn button').textContent === 'Vis fundene');
  tjek('rester: Kopiér er stadig aktiv', kommandoAktiv(d, 'masker', 'kopier'));
  s.tast('C', { ctrlKey: true, shiftKey: true, code: 'KeyC' });
  await vent(5);
  tjek('Windows: Ctrl+Shift+C kopierer ved rester, og banneret bliver stående', skrevet.length === 1 && sek.querySelector('.ban.warn') && knapI(d, 'masker', 'kopier').title === 'Genvej: Ctrl+Shift+C');
  s.tast('C', { metaKey: true, shiftKey: true, code: 'KeyC' });
  await vent(5);
  tjek('Windows: ⇧⌘C gør intet', skrevet.length === 1);
}

// ── Demaskér med tom sag ──
{
  const s = side({ hash: '#demasker', rust: falskRust() });
  const { d, w } = s;
  await vent(5);
  const dsek = d.querySelector('section[data-visning="demasker"]');
  tjek('tom sag: tom tilstand siger, at der først skal maskeres', dsek.querySelector('.tom p').textContent === 'Der er intet at demaskere endnu: maskér først en tekst i denne session, så kender Grimnir koderne.');
  indsaet(w, dsek.querySelector('.tom'), 'h0001 og user0001\n');
  tjek('tom sag: svaret indsat, men Demaskér nedtonet med forklaring og banner', !kommandoAktiv(d, 'demasker', 'demasker') && dsek.querySelector('.ban.info') && dsek.textContent.includes('Sagen er tom'));
  s.tast('Enter', { metaKey: true });
  await vent(5);
  tjek('tom sag: ⌘↵ kalder ikke demasker', !s.kald.some(k => k[0] === 'demasker'));
}

// ══════════════════════════ V-SAG.1: Sager ══════════════════════════

/* Lokal dato om n dage (ÅÅÅÅ-MM-DD), som sager.js regner. */
const datoOm = n => { const t = new Date(); t.setDate(t.getDate() + n); return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0'); };
const hexId = n => String(n).repeat(32).slice(0, 32);
/* Efterlignet Rust for sagerne (samme felter som SagStatus og SagListePost i src-tauri/src/maskering.rs). Maskér og
   Demaskér går til falskRust. */
function falskSagRust({ sager = [], konflikt = false } = {}) {
  const r = falskRust();
  const db = sager.map(x => ({ poster: 3, oprettet: Date.UTC(2026, 10, 1), sidst_brugt: Date.UTC(2026, 10, 9), udloeb: null, fejl: null, navn: null, ...x }));
  let aaben = null, nr = 9;
  const post = id => db.find(x => x.id === id);
  const status = () => { const p = post(aaben); return { poster: p ? p.poster : r.sag_status().poster, id: aaben, navn: p ? p.navn : null, udloeb: p ? p.udloeb : null }; };
  const sagfejl = art => ({ art: 'sag', fejl: { art } });
  return {
    ...r,
    st: { db, get aaben() { return aaben; }, set konflikt(v) { konflikt = v; } },
    gem_og_masker: a => {
      if (aaben && konflikt) throw sagfejl('konflikt');
      const m = r.gem_og_masker(a);
      if (aaben) post(aaben).poster = m.poster;
      return m;
    },
    sag_status: () => status(),
    sag_nulstil: () => { aaben = null; r.sag_nulstil(); return status(); },
    sag_liste: () => db.map(x => ({ ...x, aaben: x.id === aaben })),
    sag_ny: ({ navn, udloeb }) => {
      if (!navn || !navn.trim()) throw sagfejl('ugyldigt_navn');
      const poster = aaben ? 0 : r.sag_status().poster;
      if (aaben) r.sag_nulstil();
      const id = hexId(nr--);
      db.push({ id, navn: navn.trim(), poster, oprettet: Date.now(), sidst_brugt: Date.now(), udloeb: udloeb || null, fejl: null });
      aaben = id;
      return status();
    },
    sag_aabn: ({ id }) => {
      const p = post(id);
      if (!p) throw sagfejl('mangler_fil');
      if (p.fejl) throw { art: 'sag', fejl: p.fejl };
      r.sag_nulstil();
      aaben = id;
      return status();
    },
    sag_luk: () => { aaben = null; r.sag_nulstil(); return status(); },
    sag_omdoeb: ({ id, navn }) => { post(id).navn = navn.trim(); return null; },
    sag_udloeb: ({ id, udloeb }) => { post(id).udloeb = udloeb; return null; },
    sag_slet: ({ id }) => { db.splice(db.indexOf(post(id)), 1); if (aaben === id) { aaben = null; r.sag_nulstil(); } return status(); },
    program_afslut: () => null,
  };
}
const SAGER = () => [
  { id: hexId(1), navn: 'Supportsag 0042', poster: 214, udloeb: null },
  { id: hexId(2), navn: 'Backup-script', poster: 17, udloeb: datoOm(3) },
  { id: hexId(3), navn: 'SQL-job fejler', poster: 42, udloeb: datoOm(-1) },
  { id: hexId(4), navn: null, poster: 0, fejl: { art: 'mangler_noegle' } },
  { id: hexId(5), navn: 'Firewall-log', poster: 9, udloeb: datoOm(60) },
];
const sagRaekker = d => [...d.querySelectorAll('section[data-visning="sager"] .sagtabel tbody tr[data-id]')];
const sagRaekke = (d, id) => d.querySelector(`section[data-visning="sager"] .sagtabel tr[data-id="${id}"]`);
const klik = (w, el) => el.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
const skriv = (w, el, v) => { el.value = v; el.dispatchEvent(new w.Event('input', { bubbles: true })); };
const aaben = (d, id) => d.getElementById(id).hasAttribute('open');

// ── Statisk: hver sagsfejl fra Rust har en tekst ──
{
  const rs = fs.readFileSync(path.join(repo, 'src-tauri', 'src', 'sager.rs'), 'utf8');
  const enumKrop = rs.slice(rs.indexOf('pub enum SagFejl')).split('\n}\n')[0];
  const varianter = [...enumKrop.matchAll(/^    ([A-Z][A-Za-z]+)\b/gm)].map(m => m[1].replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase());
  const { w } = side();
  const T = w.Sprog.TEKST;
  const mangler = [...varianter, 'ingen_arkiv'].filter(v => !('sagfejl_' + v in T.da && 'sagfejl_' + v in T.en));
  tjek(`sprog: hver SagFejl i sager.rs har en tekst (${varianter.length})`, varianter.length >= 10 && mangler.length === 0, mangler.join(', ') + ' | ' + varianter.join(','));
  tjek('app.css: fuldskærm fjerner trafiklysenes plads', /\[data-platform="macos"\]\[data-fuldskaerm\] \.titel \{ padding-left: var\(--space-3\); \}/.test(ui('assets/app.css')));
  tjek('Maskér: en række med flere stavemåder kan rettes (intet readOnly)', !/readOnly/.test(ui('assets/maskering.js')));
}

// ── Sager: ny sag fra en midlertidig sag med poster, titellinjen, luk sag ──
{
  const rust = falskSagRust();
  const s = side({ hash: '#masker', rust });
  const { d, w } = s;
  await vent(5);
  const sagKnap = d.getElementById('sag-knap');
  tjek('titellinje: "Ingen sag åben" ved en tom midlertidig sag', !d.getElementById('sag').hidden && sagKnap.hidden);
  const sek = d.querySelector('section[data-visning="masker"]');
  indsaet(w, sek.querySelector('.tom'), TEKST);
  s.tast('Enter', { metaKey: true }); await vent(5);
  s.tast('Enter', { metaKey: true }); await vent(5);
  tjek('titellinje: "Midlertidig sag · 3 værdier" efter maskering', !sagKnap.hidden && sagKnap.textContent === 'Midlertidig sag · 3 værdier' && sagKnap.getAttribute('aria-label') === 'Midlertidig sag, 3 værdier: gem som sag eller nulstil');
  klik(w, sagKnap);
  tjek('titellinje: dialogen tilbyder Gem som sag og Nulstil', aaben(d, 'dlg-sag') && !d.getElementById('sag-gem-som').hidden && !d.getElementById('sag-nulstil').hidden && d.getElementById('sag-luk').hidden && d.getElementById('dlg-sag-p').textContent.includes('3 værdier'));
  klik(w, d.getElementById('sag-gem-som'));
  tjek('Gem som sag: dialogen Ny sag åbner og nævner de 3 værdier', aaben(d, 'dlg-ny-sag') && !aaben(d, 'dlg-sag') && d.getElementById('dlg-ny-sag-p').textContent.includes('3 værdier') && d.activeElement === d.getElementById('ny-sag-navn'));
  klik(w, d.getElementById('ny-sag-opret')); await vent(5);
  tjek('Ny sag: tomt navn afvises i dialogen, intet kald', d.getElementById('ny-sag-fejl').textContent === 'Skriv et navn.' && !s.kald.some(k => k[0] === 'sag_ny'));
  skriv(w, d.getElementById('ny-sag-navn'), '  Supportsag 0042 ');
  d.getElementById('ny-sag-udloeb').value = '2027-01-31';
  d.getElementById('ny-sag-navn').dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  await vent(10);
  const nyKald = s.kald.find(k => k[0] === 'sag_ny');
  tjek('Ny sag: Enter opretter med navn og udløb', nyKald && nyKald[1].navn === 'Supportsag 0042' && nyKald[1].udloeb === '2027-01-31' && !aaben(d, 'dlg-ny-sag'));
  tjek('titellinje: "Sag: Supportsag 0042 · 3 værdier"', sagKnap.textContent === 'Sag: Supportsag 0042 · 3 værdier' && sagKnap.getAttribute('aria-label') === 'Sag Supportsag 0042, 3 værdier: skift eller luk sagen');
  tjek('Ny sag: resultatet i Maskér bliver stående (sagen er den samme)', Boolean(w.GrimnirMaskering.M.st.resultat));
  // Gem og maskér i den navngivne sag; konflikt.
  rust.st.konflikt = true;
  indsaet(w, sek.querySelector('pre.tekst'), TEKST);
  s.tast('Enter', { metaKey: true }); await vent(5);
  s.tast('Enter', { metaKey: true }); await vent(5);
  const ban = sek.querySelector('.ban.danger');
  tjek('konflikt: banner "Sagen er ændret et andet sted. Åbn den igen." med knappen Åbn igen', ban && ban.textContent.includes('Sagen er ændret et andet sted. Åbn den igen.') && ban.querySelector('button').textContent === 'Åbn igen');
  tjek('konflikt: ingen maskeret tekst, Kopiér nedtonet', !w.GrimnirMaskering.M.st.resultat && !kommandoAktiv(d, 'masker', 'kopier'));
  rust.st.konflikt = false;
  klik(w, ban.querySelector('button')); await vent(10);
  tjek('konflikt: Åbn igen læser sagen fra disken (sag_aabn med samme id)', s.kald.some(k => k[0] === 'sag_aabn' && k[1].id === rust.st.aaben) && w.GrimnirMaskering.M.st.analyse === null);
  // Titellinjens dialog for en navngiven sag: Skift sag og Luk sag.
  klik(w, sagKnap);
  tjek('titellinje: navngiven sag giver Skift sag og Luk sag', d.getElementById('dlg-sag-h').textContent === 'Sag: Supportsag 0042' && d.getElementById('sag-gem-som').hidden && d.getElementById('sag-nulstil').hidden && !d.getElementById('sag-skift').hidden && !d.getElementById('sag-luk').hidden);
  klik(w, d.getElementById('sag-skift')); await vent(5);
  tjek('Skift sag: går til Sager', synlige(d).join() === 'sager' && !aaben(d, 'dlg-sag'));
  tjek('Sager: den nye sag står i listen som i brug', sagRaekker(d).length === 1 && sagRaekker(d)[0].textContent.includes('Supportsag 0042') && sagRaekker(d)[0].textContent.includes('i brug'));
  klik(w, sagKnap);
  klik(w, d.getElementById('sag-luk')); await vent(10);
  tjek('Luk sag: titellinjen er tilbage på "Ingen sag åben"', s.kald.some(k => k[0] === 'sag_luk') && !d.getElementById('sag').hidden && sagKnap.hidden);
}

// ── Sager: liste, status, træ, søgning, åbn, omdøb, udløb, slet, kan ikke åbnes ──
{
  const rust = falskSagRust({ sager: SAGER() });
  const s = side({ hash: '#sager', rust });
  const { d, w } = s;
  await vent(10);
  const sek = d.querySelector('section[data-visning="sager"]');
  const r = sagRaekker(d);
  tjek('Sager: alle fem sager i listen, tom tilstand skjult', r.length === 5 && sek.querySelector('.tom').hidden);
  const hoved = [...sek.querySelectorAll('.sagtabel thead th')].map(t => t.textContent);
  tjek('Sager: kolonnerne Navn, Værdier, Oprettet, Sidst brugt, Udløber, Status', JSON.stringify(hoved) === JSON.stringify(['Navn', 'Værdier', 'Oprettet', 'Sidst brugt', 'Udløber', 'Status']), JSON.stringify(hoved));
  const chipTekst = id => sagRaekke(d, id).querySelector('.chip').textContent;
  tjek('Sager: StatusChip Åben, Udløber snart, Udløbet, Kan ikke åbnes', chipTekst(hexId(1)) === '✓Åben' && chipTekst(hexId(2)) === '!Udløber snart' && chipTekst(hexId(3)) === '?Udløbet' && chipTekst(hexId(4)) === '?Kan ikke åbnes' && chipTekst(hexId(5)) === '✓Åben', [1, 2, 3, 4, 5].map(i => chipTekst(hexId(i))).join(','));
  tjek('Sager: "Kan ikke åbnes" har årsagen i title og et navn ud fra id', sagRaekke(d, hexId(4)).querySelector('.chip').title === 'Sagen kan ikke åbnes: nøglen mangler i nøgleringen' && sagRaekke(d, hexId(4)).textContent.startsWith('Sag 44444444…'));
  tjek('Sager: Udløber viser Aldrig eller datoen', sagRaekke(d, hexId(1)).children[4].textContent === 'Aldrig' && /\d/.test(sagRaekke(d, hexId(2)).children[4].textContent));
  const ant = id => d.querySelector(`.navdel[data-visning="sager"] [data-punkt="${id}"] .ant`).textContent;
  tjek('Sager: træet tæller Alle 5, Udløber snart 2, Ingen udløb 1', ant('alle') === '5' && ant('udloeber') === '2' && ant('uden-udloeb') === '1' && d.querySelector('.navdel[data-visning="sager"] [data-punkt="uden-udloeb"]').textContent.includes('Ingen udløb'));
  tjek('Sager: chip og fodlinje siger 5 sager', sek.querySelector('.vl .chip').textContent === 'i5 sager' && d.getElementById('fod-venstre').textContent === '5 sager');
  w.Grimnir.dele.sager.trae.vaelg('udloeber'); await vent(5);
  tjek('træ: Udløber snart viser to', sagRaekker(d).length === 2);
  w.Grimnir.dele.sager.trae.vaelg('alle'); await vent(5);
  const soeg = sek.querySelector('.vl input[type="search"]');
  skriv(w, soeg, 'backup');
  tjek('søgning på navn', sagRaekker(d).length === 1 && sagRaekker(d)[0].dataset.id === hexId(2));
  skriv(w, soeg, '');
  tjek('Sager: uden valg er Åbn, Omdøb, Udløb og Slet nedtonet med forklaring; Ny sag aktiv', kommandoAktiv(d, 'sager', 'ny-sag') && ['aabn-i-masker', 'omdoeb', 'udloeb', 'slet-sag'].every(id => !kommandoAktiv(d, 'sager', id) && knapI(d, 'sager', id).title === 'Vælg en sag i listen først'));
  tjek('Sager: Eksportér og Importér er stadig nedtonet (v2)', !kommandoAktiv(d, 'sager', 'eksporter') && !kommandoAktiv(d, 'sager', 'importer'));
  // Kan ikke åbnes: kun Slet er aktiv.
  klik(w, sagRaekke(d, hexId(4)).children[0]);
  tjek('Kan ikke åbnes: Åbn, Omdøb og Udløb nedtonet med årsag, Slet aktiv', ['aabn-i-masker', 'omdoeb', 'udloeb'].every(id => !kommandoAktiv(d, 'sager', id) && knapI(d, 'sager', id).title === 'Sagen kan ikke åbnes: nøglen mangler i nøgleringen') && kommandoAktiv(d, 'sager', 'slet-sag'));
  // Omdøb
  klik(w, sagRaekke(d, hexId(2)).children[0]);
  klik(w, knapI(d, 'sager', 'omdoeb'));
  const omNavn = d.getElementById('omdoeb-navn');
  tjek('Omdøb: dialogen har navnet', aaben(d, 'dlg-omdoeb') && omNavn.value === 'Backup-script');
  skriv(w, omNavn, 'Backup-script nat');
  klik(w, d.getElementById('omdoeb-ok')); await vent(10);
  tjek('Omdøb: sag_omdoeb med id og navn, listen opdateret', s.kald.some(k => k[0] === 'sag_omdoeb' && k[1].id === hexId(2) && k[1].navn === 'Backup-script nat') && sagRaekke(d, hexId(2)).textContent.includes('Backup-script nat') && !aaben(d, 'dlg-omdoeb'));
  // Udløb
  klik(w, sagRaekke(d, hexId(2)).children[0]);
  klik(w, knapI(d, 'sager', 'udloeb'));
  tjek('Udløb: dialogen har datoen og nævner sagen', aaben(d, 'dlg-udloeb') && d.getElementById('udloeb-dato').value === datoOm(3) && !d.getElementById('udloeb-ingen').checked && d.getElementById('dlg-udloeb-p').textContent === 'Sagen «Backup-script nat».');
  d.getElementById('udloeb-ingen').checked = true;
  d.getElementById('udloeb-ingen').dispatchEvent(new w.Event('change', { bubbles: true }));
  klik(w, d.getElementById('udloeb-ok')); await vent(10);
  tjek('Udløb: Ingen udløb sender null; sagen er nu Åben', s.kald.some(k => k[0] === 'sag_udloeb' && k[1].id === hexId(2) && k[1].udloeb === null) && chipTekst(hexId(2)) === '✓Åben');
  klik(w, sagRaekke(d, hexId(1)).children[0]);
  klik(w, knapI(d, 'sager', 'udloeb'));
  tjek('Udløb: en sag uden udløb åbner med Ingen udløb afkrydset og datoen nedtonet', d.getElementById('udloeb-ingen').checked && d.getElementById('udloeb-dato').disabled);
  d.getElementById('udloeb-ingen').checked = false;
  d.getElementById('udloeb-ingen').dispatchEvent(new w.Event('change', { bubbles: true }));
  klik(w, d.getElementById('udloeb-ok')); await vent(5);
  tjek('Udløb: uden dato og uden flueben afvises i dialogen', d.getElementById('udloeb-fejl').textContent === 'Vælg en dato, eller sæt flueben ved Ingen udløb.' && aaben(d, 'dlg-udloeb'));
  d.getElementById('udloeb-dato').value = datoOm(5);
  klik(w, d.getElementById('udloeb-ok')); await vent(10);
  tjek('Udløb: en dato inden 7 dage giver Udløber snart', s.kald.some(k => k[0] === 'sag_udloeb' && k[1].id === hexId(1) && k[1].udloeb === datoOm(5)) && chipTekst(hexId(1)) === '!Udløber snart');
  // Slet med bekræftelse
  klik(w, sagRaekke(d, hexId(3)).children[0]);
  klik(w, knapI(d, 'sager', 'slet-sag'));
  tjek('Slet: bekræftelsen nævner sagens navn', aaben(d, 'dlg-slet') && d.getElementById('dlg-slet-p').textContent.startsWith('Sagen «SQL-job fejler» og dens nøgle i nøgleringen slettes'));
  klik(w, d.querySelector('#dlg-slet [data-luk]'));
  tjek('Slet: Annullér sletter intet', !aaben(d, 'dlg-slet') && !s.kald.some(k => k[0] === 'sag_slet') && sagRaekker(d).length === 5);
  klik(w, knapI(d, 'sager', 'slet-sag'));
  klik(w, d.getElementById('slet-ok')); await vent(10);
  tjek('Slet: sag_slet, og sagen er væk', s.kald.some(k => k[0] === 'sag_slet' && k[1].id === hexId(3)) && !sagRaekke(d, hexId(3)) && sagRaekker(d).length === 4);
  // Åbn i Maskér (dobbeltklik og kommandoen)
  klik(w, sagRaekke(d, hexId(5)).children[0]);
  klik(w, knapI(d, 'sager', 'aabn-i-masker')); await vent(10);
  tjek('Åbn i Maskér: sag_aabn, Maskér vises, titellinjen har sagen', s.kald.some(k => k[0] === 'sag_aabn' && k[1].id === hexId(5)) && synlige(d).join() === 'masker' && d.getElementById('sag-knap').textContent === 'Sag: Firewall-log · 9 værdier');
  // English
  w.Sprog.saet('en'); w.Grimnir.vis('sager'); await vent(10);
  tjek('English: status og kolonner', chipTekst(hexId(1)) === '!Expiring soon' && sek.querySelector('.sagtabel thead th').textContent === 'Name' && d.getElementById('sag-knap').textContent === 'Case: Firewall-log · 9 values');
  w.Sprog.saet('da');
}

// ── Luk programmet med en midlertidig sag, og åbn en sag oven på en midlertidig ──
{
  const rust = falskSagRust({ sager: SAGER() });
  const s = side({ hash: '#masker', rust });
  const { d, w } = s;
  await vent(10);
  const sek = d.querySelector('section[data-visning="masker"]');
  indsaet(w, sek.querySelector('.tom'), TEKST);
  s.tast('Enter', { metaKey: true }); await vent(5);
  s.tast('Enter', { metaKey: true }); await vent(5);
  s.emit('menu', 'afslut');
  tjek('afslut: spørgsmålet med antal værdier og Gem som sag, Kassér, Annullér', aaben(d, 'dlg-kasser') && d.getElementById('dlg-kasser-h').textContent === 'Gem den midlertidige sag, før Grimnir lukker?' && d.getElementById('dlg-kasser-p').textContent.startsWith('Den midlertidige sag har 3 værdier') && d.activeElement === d.getElementById('kasser-gem'));
  klik(w, d.querySelector('#dlg-kasser [data-luk]'));
  tjek('afslut: Annullér lukker ikke programmet', !aaben(d, 'dlg-kasser') && !s.kald.some(k => k[0] === 'program_afslut'));
  s.emit('menu', 'afslut');
  klik(w, d.getElementById('kasser-gem'));
  skriv(w, d.getElementById('ny-sag-navn'), 'Inden lukning');
  klik(w, d.getElementById('ny-sag-opret')); await vent(10);
  const i = s.kald.findIndex(k => k[0] === 'sag_ny'), j = s.kald.findIndex(k => k[0] === 'program_afslut');
  tjek('afslut: Gem som sag opretter sagen og lukker derefter', i >= 0 && j > i && s.kald[i][1].navn === 'Inden lukning' && s.kald[i][1].udloeb === null);
  // Et nyt program: Kassér lukker uden at gemme.
  const s2 = side({ hash: '#masker', rust: falskSagRust() });
  await vent(5);
  indsaet(s2.w, s2.d.querySelector('section[data-visning="masker"] .tom'), TEKST);
  s2.tast('Enter', { metaKey: true }); await vent(5);
  s2.tast('Enter', { metaKey: true }); await vent(5);
  s2.emit('menu', 'afslut');
  klik(s2.w, s2.d.getElementById('kasser-ok')); await vent(5);
  tjek('afslut: Kassér lukker uden sag_ny', s2.kald.some(k => k[0] === 'program_afslut') && !s2.kald.some(k => k[0] === 'sag_ny'));
  // Åbn en gemt sag oven på en midlertidig sag med poster: der spørges først.
  const s3 = side({ hash: '#masker', rust: falskSagRust({ sager: SAGER() }) });
  await vent(10);
  indsaet(s3.w, s3.d.querySelector('section[data-visning="masker"] .tom'), TEKST);
  s3.tast('Enter', { metaKey: true }); await vent(5);
  s3.tast('Enter', { metaKey: true }); await vent(5);
  s3.w.Grimnir.vis('sager'); await vent(10);
  sagRaekke(s3.d, hexId(1)).dispatchEvent(new s3.w.MouseEvent('dblclick', { bubbles: true })); await vent(5);
  tjek('åbn oven på midlertidig sag: der spørges først', aaben(s3.d, 'dlg-kasser') && s3.d.getElementById('dlg-kasser-h').textContent === 'Gem den midlertidige sag, før en anden sag åbnes?' && !s3.kald.some(k => k[0] === 'sag_aabn'));
  klik(s3.w, s3.d.getElementById('kasser-ok')); await vent(10);
  tjek('åbn oven på midlertidig sag: Kassér åbner sagen', s3.kald.some(k => k[0] === 'sag_aabn' && k[1].id === hexId(1)) && s3.d.getElementById('sag-knap').textContent === 'Sag: Supportsag 0042 · 214 værdier');
}

// ── Demaskér peger på Sager; 8 MB; fuldskærm ──
{
  const s = side({ hash: '#demasker', rust: falskSagRust({ sager: SAGER() }) });
  const { d, w } = s;
  await vent(10);
  const dsek = d.querySelector('section[data-visning="demasker"]');
  const tilSager = [...dsek.querySelectorAll('.tom button')].find(b => b.textContent === 'Åbn Sager');
  tjek('Demaskér: tom sag med gemte sager peger på Sager', dsek.querySelector('.tom p').textContent === 'Der er ingen koder i denne sag endnu. Åbn den sag, svaret hører til, under Sager.' && tilSager && !tilSager.hidden);
  tjek('Demaskér: nedtonet med "Åbn en gemt sag under Sager først"', knapI(d, 'demasker', 'demasker').title === 'Åbn en gemt sag under Sager først');
  klik(w, tilSager); await vent(5);
  tjek('Demaskér: "Åbn Sager" går til Sager', synlige(d).join() === 'sager');
  w.Grimnir.vis('demasker'); await vent(5);
  const seks = 'h0001 '.repeat(1024 * 1024);
  indsaet(w, dsek.querySelector('.tom'), seks);
  tjek('Demaskér: 6 MB tages imod (grænsen er 8 MB)', w.GrimnirMaskering.D.st.tekst === seks);
  indsaet(w, dsek.querySelector('pre.tekst'), 'x'.repeat(8 * 1024 * 1024 + 1));
  tjek('Demaskér: over 8 MB afvises med besked', w.GrimnirMaskering.D.st.tekst === seks && /Teksten er 8\.0 MB\. Demaskér tager højst 8 MB/.test(dsek.textContent));
  s.emit('fuldskaerm', true);
  tjek('fuldskærm: <html data-fuldskaerm>', d.documentElement.hasAttribute('data-fuldskaerm'));
  s.emit('fuldskaerm', false);
  tjek('fuldskærm: væk igen', !d.documentElement.hasAttribute('data-fuldskaerm'));
  const tom = side({ hash: '#demasker' });
  await vent(5);
  const knap = [...tom.d.querySelectorAll('section[data-visning="demasker"] .tom button')].find(b => b.textContent === 'Åbn Sager');
  tjek('Demaskér: uden gemte sager er knappen skjult og teksten som før', knap && knap.hidden && tom.d.querySelector('section[data-visning="demasker"] .tom p').textContent.startsWith('Der er intet at demaskere endnu'));
}

// ══════════════════════════ V-ORDBOG.1: Ordbog, guiden og indstillingerne ══════════════════════════

/* Efterlignet Rust for ordbogen og indstillingerne (samme felter som OrdbogUd, OrdbogPost, FeltFejl, Proeve og
   Indstillinger i src-tauri/src/). Valideringen er et udsnit af Rusts (ordbog.rs), nok til at vise fejlene pr. felt.
   Analysen følger ordbogen: "maskér aldrig" fjerner rækken, "maskér altid" giver status ordbog. Kun opdigtede værdier. */
function falskOrdbogRust({ poster = [], indst = {}, laast = null, sager = [], gemFejl = false } = {}) {
  const r = falskSagRust({ sager });
  let db = poster.map((p, i) => ({ id: i + 1, note: null, oprettet: 1, ...p }));
  let i0 = { masker_fremmede: false, bevar_sidste_oktet: true, udloeb_dage: null, guide_vist: false, laas_efter_min: 15, ...indst };
  let valg = { masker_fremmede: false, bevar_sidste_oktet: true };
  const ud = () => ({ poster: db.map(p => ({ ...p })), fejl: laast });
  const felt = (f, fejl) => ({ art: 'ordbog', fejl: [{ felt: f, fejl }] });
  function valider(type, vaerdi, undtagen) {
    const v = vaerdi.trim();
    if (!v) throw felt('vaerdi', 'tom');
    if (type === 'domaene' && !/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(v)) throw felt('vaerdi', 'ugyldigt_domaene');
    if (type === 'netbios' && (v.includes('.') || v.length > 15)) throw felt('vaerdi', 'ugyldigt_netbios');
    if (type === 'navnemoenster' && (!/^[a-z0-9#*-]+$/i.test(v) || !/[a-z]/i.test(v))) throw felt('vaerdi', 'ugyldigt_moenster');
    if (type === 'eget_net' && !/^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/.test(v)) throw felt('vaerdi', 'ugyldigt_net');
    const andre = db.filter(p => p.id !== undtagen && p.vaerdi.toLowerCase() === v.toLowerCase());
    if (andre.some(p => (p.type === 'aldrig') === (type === 'aldrig'))) throw felt('vaerdi', 'dublet');
    if (andre.length) throw felt('vaerdi', 'modstrid');
    return v;
  }
  const status = s => ({ ...s, valg: { ...valg } });
  const nyValg = () => { valg = { masker_fremmede: i0.masker_fremmede, bevar_sidste_oktet: i0.bevar_sidste_oktet }; };
  return {
    ...r,
    ob: { get db() { return db; }, get indst() { return i0; }, set laast(v) { laast = v; } },
    analyser: a => {
      const svar = r.analyser(a);
      const aldrig = db.filter(p => p.type === 'aldrig').map(p => p.vaerdi.toLowerCase());
      const altid = db.filter(p => p.type !== 'aldrig').map(p => p.vaerdi.toLowerCase());
      svar.raekker = svar.raekker.filter(x => !aldrig.includes(x.vaerdier[0].toLowerCase()))
        .map(x => (altid.includes(x.vaerdier[0].toLowerCase()) ? { ...x, status: 'ordbog', standard: true, valgt: a.fravalgt == null ? true : x.valgt } : x));
      return svar;
    },
    ordbog_hent: () => ud(),
    ordbog_tilfoej: ({ type, vaerdi, note }) => {
      if (laast) throw { art: 'ordbog_laast', fejl: laast };
      if (gemFejl) throw { art: 'ordbog_fil', fejl: { art: 'konflikt' } };
      const v = valider(type, vaerdi, null);
      db.push({ id: Math.max(0, ...db.map(p => p.id)) + 1, type, vaerdi: v, note: note || null, oprettet: 2 });
      return ud();
    },
    ordbog_ret: ({ id, vaerdi, note }) => {
      const p = db.find(x => x.id === id);
      if (!p) throw felt('id', 'ukendt_post');
      p.vaerdi = valider(p.type, vaerdi, id);
      p.note = note || null;
      return ud();
    },
    ordbog_fjern: ({ id }) => { db = db.filter(x => x.id !== id); return ud(); },
    ordbog_proev: ({ tekst }) => {
      const t = tekst.toLowerCase();
      const fund = db.filter(p => p.type !== 'aldrig' && t.includes(p.vaerdi.toLowerCase())).map(p => ({ status: 'fanget', art: p.type === 'person' ? 'person' : 'ord', tekst: p.vaerdi, antal: 1, linje: 1 }));
      for (const p of db.filter(p => p.type === 'aldrig' && t.includes(p.vaerdi.toLowerCase()))) fund.push({ status: 'aldrig', art: 'ipv4_egen', tekst: p.vaerdi, antal: 1, linje: 2 });
      return { fund, i_alt: fund.length + 2 };
    },
    indstillinger_hent: () => ({ ...i0 }),
    indstillinger_gem: ({ indstillinger }) => {
      if (gemFejl) throw { art: 'indstillinger', fejl: { art: 'disk', hvad: 'PermissionDenied' } };
      i0 = { ...indstillinger };
      return { ...i0 };
    },
    sag_status: () => status(r.sag_status()),
    sag_nulstil: () => { const s = r.sag_nulstil(); nyValg(); return status(s); },
    sag_luk: () => { const s = r.sag_luk(); nyValg(); return status(s); },
    sag_ny: a => status(r.sag_ny(a)),
    sag_valg: ({ maskerFremmede, bevarSidsteOktet }) => { valg = { masker_fremmede: maskerFremmede, bevar_sidste_oktet: bevarSidsteOktet }; return status(r.sag_status()); },
  };
}
const ORDBOG = () => [
  { type: 'domaene', vaerdi: 'kontor.test', note: 'hoveddomænet' },
  { type: 'navnemoenster', vaerdi: 'srv-###' },
  { type: 'eget_net', vaerdi: '10.20.0.0/16' },
  { type: 'ord', vaerdi: 'Uglebo', note: 'projekt' },
  { type: 'aldrig', vaerdi: '10.20.30.40', note: 'printeren' },
  { type: 'aldrig', vaerdi: 'localhost' },
];
const oRaekker = d => [...d.querySelectorAll('section[data-visning="ordbog"] .ordbogtabel tbody tr[data-id]')];
const oRaekke = (d, v) => oRaekker(d).find(tr => tr.children[1].textContent === v);
const vaelgType = (w, sel, v) => { sel.value = v; sel.dispatchEvent(new w.Event('change', { bubbles: true })); };
const enter = (w, el) => el.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));

// ── Statisk: tekster til Rusts navne, kittets Wizard og Fletbånd ──
{
  const rs = fs.readFileSync(path.join(repo, 'src-tauri', 'src', 'ordbog.rs'), 'utf8');
  const { w, d } = side();
  await vent();
  const T = w.Sprog.TEKST;
  const fejlNavne = [...new Set([...rs.matchAll(/felt\("[a-z]+", "([a-z_]+)"\)|Some\("([a-z_]+)"\)/g)].map(x => x[1] || x[2]))];
  const mangler = fejlNavne.filter(x => !('ofejl_' + x in T.da && 'ofejl_' + x in T.en));
  tjek(`sprog: hver feltfejl i ordbog.rs har en tekst (${fejlNavne.length})`, fejlNavne.length >= 12 && mangler.length === 0, mangler.join(', '));
  const mrs = fs.readFileSync(path.join(repo, 'src-tauri', 'src', 'maskering.rs'), 'utf8');
  const fra_m = [...mrs.matchAll(/ob::felt\("[a-z]+", "([a-z_]+)"\)/g)].map(x => x[1]);
  tjek('sprog: feltfejlene fra maskering.rs har en tekst', fra_m.length === 2 && fra_m.every(x => 'ofejl_' + x in T.da && 'ofejl_' + x in T.en), fra_m.join());
  const typer = [...rs.matchAll(/PostType::\w+ => "([a-z_]+)"/g)].map(x => x[1]);
  tjek(`sprog: hver posttype i ordbog.rs har navn og hjælp (${typer.length})`, typer.length === 7 && typer.every(x => ['type_', 'hjt_'].every(p => p + x in T.da && p + x in T.en)));
  tjek('sprog: hver posttype findes i Tilføj-dialogen', JSON.stringify([...d.querySelectorAll('#opost-type option')].map(o => o.value)) === JSON.stringify(typer));
  const K = w.Kit;
  // Wizard
  const rod = d.createElement('div');
  d.body.appendChild(rod);
  let slut = 0, spring = 0;
  const g = K.guide(rod, { trin: [{ tekst: 'Et' }, { tekst: 'To' }, { tekst: 'Tre' }], naeste: { tekst: 'Næste' }, tilbage: { tekst: 'Tilbage' }, slut: { t: 'faerdig' }, spring: { tekst: 'Spring over' }, vedSlut: () => slut++, vedSpring: () => spring++ });
  const trin = () => [...rod.querySelectorAll('.trin .t')];
  const knapper = () => [...rod.querySelectorAll('.fod button')];
  tjek('Kit: Wizard har trinliste, indhold og fodlinje med Spring over, Tilbage og Næste', rod.classList.contains('wiz') && trin().length === 3 && rod.querySelector('.indhold h2') && knapper().map(b => b.textContent).join('|') === 'Spring over|Tilbage|Næste');
  tjek('Kit: Wizard: første trin er aktuelt (aria-current="step"), Tilbage er nedtonet', trin()[0].getAttribute('aria-current') === 'step' && trin()[0].classList.contains('now') && knapper()[1].disabled && trin().every(t => t.tagName === 'SPAN'));
  knapper()[2].click();
  tjek('Kit: Wizard: Næste går frem; nået trin har flueben og er en knap', g.aktuel === 1 && trin()[0].tagName === 'BUTTON' && trin()[0].querySelector('.n').textContent === '✓' && trin()[1].getAttribute('aria-current') === 'step' && trin()[2].tagName === 'SPAN');
  knapper()[2].click();
  tjek('Kit: Wizard: den primære knap hedder det, den gør, i sidste trin', g.aktuel === 2 && knapper()[2].querySelector('span').getAttribute('data-t') === 'faerdig');
  trin()[0].click();
  tjek('Kit: Wizard: et nået trin kan klikkes', g.aktuel === 0);
  knapper()[1].click();
  tjek('Kit: Wizard: Tilbage på første trin gør intet', g.aktuel === 0);
  g.gaaTil(2); knapper()[2].click(); knapper()[0].click();
  tjek('Kit: Wizard: Færdig og Spring over kalder forbrugeren', slut === 1 && spring === 1);
  // Fletbånd
  const f1 = K.fletbaand(), f2 = K.fletbaand();
  const id1 = f1.querySelector('pattern').id;
  tjek('Kit: Fletbånd er aria-hidden, 10 px højt, med eget mønster-id', f1.getAttribute('aria-hidden') === 'true' && f1.getAttribute('height') === '10' && id1 !== f2.querySelector('pattern').id && f1.querySelector('rect').getAttribute('fill') === `url(#${id1})` && f1.querySelector('pattern').getAttribute('width') === '28');
  tjek('Fletbåndet står ét sted: i Om-dialogen (ADR D16)', d.querySelectorAll('svg.flet').length === 1 && d.querySelector('#dlg-om svg.flet'));
  tjek('kit.css har Wizard og Fletbånd', /\.wiz \.t\.now \{/.test(ui('assets/kit.css')) && /\.flet path \{ fill: none; stroke: var\(--accent\)/.test(ui('assets/kit.css')));
}

// ── Ordbog: liste, grupper, træ, søgning, tilføj, ret, fjern, Prøv på tekst ──
{
  const rust = falskOrdbogRust({ poster: ORDBOG(), indst: { guide_vist: true } });
  const s = side({ hash: '#ordbog', rust });
  const { d, w } = s;
  await vent(10);
  const sek = d.querySelector('section[data-visning="ordbog"]');
  tjek('Ordbog: guiden vises ikke (allerede vist)', !aaben(d, 'dlg-guide'));
  tjek('Ordbog: seks poster, tom tilstand skjult', oRaekker(d).length === 6 && sek.querySelector('.tom').hidden);
  tjek('Ordbog: kolonnerne Type, Værdi eller mønster, Note', [...sek.querySelectorAll('.ordbogtabel thead th')].map(t => t.textContent).join('|') === 'Type|Værdi eller mønster|Note');
  const grupper = [...sek.querySelectorAll('.ordbogtabel tr.gruppe')].map(t => t.textContent);
  tjek('Ordbog: grupperne Maskér altid og Maskér aldrig med note', JSON.stringify(grupper) === JSON.stringify(['Maskér altid fanges i alle sager', 'Maskér aldrig røres ikke, selv om det ligner noget følsomt']), JSON.stringify(grupper));
  tjek('Ordbog: typerne står i Type-kolonnen (maskér aldrig efter, hvad værdien ligner)', oRaekke(d, 'kontor.test').children[0].textContent === 'Domæne' && oRaekke(d, 'srv-###').children[0].textContent === 'Navnemønster' && oRaekke(d, '10.20.30.40').children[0].textContent === 'Adresse' && oRaekke(d, 'localhost').children[0].textContent === 'Ord');
  tjek('Ordbog: værdien i mono, noten ved siden af', oRaekke(d, 'kontor.test').children[1].querySelector('.mono') && oRaekke(d, '10.20.30.40').children[2].textContent === 'printeren');
  tjek('Ordbog: banneret "Ordbogen ligger krypteret"', sek.querySelector('.ban.info').textContent.includes('Ordbogen ligger krypteret på denne maskine'));
  tjek('Ordbog: hjælpen om navnemønstre med Prøv på tekst', sek.querySelector('.hjaelpelinje').textContent.includes('srv-### fanger srv-068, også uden domæne') && sek.querySelector('.hjaelpelinje button').textContent === 'Prøv på tekst');
  const ant = id => d.querySelector(`.navdel[data-visning="ordbog"] [data-punkt="${id}"] .ant`).textContent;
  tjek('Ordbog: træet tæller listerne og typerne', [ant('altid'), ant('aldrig'), ant('t-domaene'), ant('t-netbios'), ant('t-navnemoenster'), ant('t-eget_net'), ant('t-ord'), ant('t-person')].join() === '4,2,1,0,1,1,1,0');
  tjek('Ordbog: chip og fodlinje siger 6 poster', sek.querySelector('.vl .chip').textContent === 'i6 poster' && d.getElementById('fod-venstre').textContent === '6 poster');
  const T = w.Grimnir.dele.ordbog.trae;
  T.vaelg('aldrig'); await vent();
  tjek('træ: Maskér aldrig viser to', oRaekker(d).length === 2 && sek.querySelectorAll('.ordbogtabel tr.gruppe').length === 1);
  T.vaelg('t-navnemoenster'); await vent();
  tjek('træ: Navnemønstre viser én', oRaekker(d).length === 1 && oRaekker(d)[0].children[1].textContent === 'srv-###');
  T.vaelg('lister'); await vent();
  const soeg = sek.querySelector('.vl input[type="search"]');
  skriv(w, soeg, 'PRINTER');
  tjek('søgning på noten (uafhængigt af store/små)', oRaekker(d).length === 1 && oRaekker(d)[0].children[1].textContent === '10.20.30.40');
  skriv(w, soeg, 'srv');
  tjek('søgning på værdien', oRaekker(d).length === 1);
  skriv(w, soeg, '');
  tjek('Ordbog: uden valg er Ret og Fjern post nedtonet med forklaring; Tilføj post og Prøv aktive; Importér og Eksportér stadig nedtonet', ['ret', 'fjern-post'].every(id => !kommandoAktiv(d, 'ordbog', id) && knapI(d, 'ordbog', id).title === 'Vælg en post i listen først') && kommandoAktiv(d, 'ordbog', 'tilfoej-post') && kommandoAktiv(d, 'ordbog', 'proev') && !kommandoAktiv(d, 'ordbog', 'importer') && !kommandoAktiv(d, 'ordbog', 'eksporter'));

  // Tilføj post
  klik(w, knapI(d, 'ordbog', 'tilfoej-post'));
  const typ = d.getElementById('opost-type'), vaerdi = d.getElementById('opost-vaerdi'), note = d.getElementById('opost-note');
  tjek('Tilføj: dialogen med type, værdi, note og en linje hjælp pr. type', aaben(d, 'dlg-opost') && d.getElementById('dlg-opost-h').textContent === 'Tilføj post' && typ.value === 'domaene' && d.getElementById('opost-type-hj').textContent.startsWith('Et DNS-domæne med punktum') && d.activeElement === vaerdi);
  vaelgType(w, typ, 'navnemoenster');
  tjek('Tilføj: hjælpen følger typen', d.getElementById('opost-type-hj').textContent.startsWith('# er ét ciffer, * er vilkårlige'));
  klik(w, d.getElementById('opost-ok')); await vent(5);
  tjek('Tilføj: tom værdi afvises i dialogen, intet kald', d.getElementById('opost-vaerdi-fejl').textContent === 'Skriv en værdi.' && !s.kald.some(k => k[0] === 'ordbog_tilfoej'));
  skriv(w, vaerdi, 'srv-[0-9]');
  klik(w, d.getElementById('opost-ok')); await vent(10);
  tjek('Tilføj: Rusts feltfejl står under feltet (aria-invalid), intet gemt', d.getElementById('opost-vaerdi-fejl').textContent === 'Et navnemønster må kun have bogstaver, cifre, -, # og *, og mindst ét bogstav.' && vaerdi.getAttribute('aria-invalid') === 'true' && aaben(d, 'dlg-opost') && rust.ob.db.length === 6);
  skriv(w, vaerdi, 'WS-*');
  skriv(w, note, 'arbejdsstationer');
  enter(w, note); await vent(10);
  const tk = s.kald.filter(k => k[0] === 'ordbog_tilfoej').pop();
  tjek('Tilføj: Enter gemmer med type, værdi og note', tk[1].type === 'navnemoenster' && tk[1].vaerdi === 'WS-*' && tk[1].note === 'arbejdsstationer' && !aaben(d, 'dlg-opost'));
  tjek('Tilføj: den nye post står i listen og er valgt', oRaekker(d).length === 7 && oRaekke(d, 'WS-*').classList.contains('sel') && kommandoAktiv(d, 'ordbog', 'ret'));
  klik(w, knapI(d, 'ordbog', 'tilfoej-post'));
  tjek('Tilføj: dialogen er tom igen', vaerdi.value === '' && note.value === '' && !vaerdi.hasAttribute('aria-invalid') && d.getElementById('opost-vaerdi-fejl').textContent === '');
  skriv(w, vaerdi, 'KONTOR.test');
  klik(w, d.getElementById('opost-ok')); await vent(10);
  tjek('Tilføj: dublet uafhængigt af store/små', d.getElementById('opost-vaerdi-fejl').textContent === 'Værdien står allerede i ordbogen.');
  vaelgType(w, typ, 'aldrig');
  skriv(w, vaerdi, 'uglebo');
  klik(w, d.getElementById('opost-ok')); await vent(10);
  tjek('Tilføj: maskér altid mod maskér aldrig afvises', d.getElementById('opost-vaerdi-fejl').textContent.startsWith('Værdien står allerede på den anden liste'));
  klik(w, d.querySelector('#dlg-opost [data-luk]'));

  // Ret (kommando og dobbeltklik)
  klik(w, oRaekke(d, 'Uglebo').children[0]);
  klik(w, knapI(d, 'ordbog', 'ret'));
  tjek('Ret: dialogen har posten; typen kan ikke ændres', aaben(d, 'dlg-opost') && d.getElementById('dlg-opost-h').textContent === 'Ret posten' && vaerdi.value === 'Uglebo' && note.value === 'projekt' && typ.value === 'ord' && typ.disabled && d.getElementById('opost-ok').textContent === 'Gem');
  skriv(w, vaerdi, 'Uglebo2');
  skriv(w, note, '');
  klik(w, d.getElementById('opost-ok')); await vent(10);
  const rk = s.kald.find(k => k[0] === 'ordbog_ret');
  tjek('Ret: ordbog_ret med id, værdi og ingen note', rk && rk[1].id === 4 && rk[1].vaerdi === 'Uglebo2' && rk[1].note === null && oRaekke(d, 'Uglebo2') && !aaben(d, 'dlg-opost'));
  oRaekke(d, 'kontor.test').dispatchEvent(new w.MouseEvent('dblclick', { bubbles: true }));
  tjek('Ret: dobbeltklik åbner posten', aaben(d, 'dlg-opost') && vaerdi.value === 'kontor.test');
  klik(w, d.querySelector('#dlg-opost [data-luk]'));

  // Fjern post med bekræftelse
  klik(w, oRaekke(d, 'localhost').children[0]);
  klik(w, knapI(d, 'ordbog', 'fjern-post'));
  tjek('Fjern: bekræftelsen nævner værdien', aaben(d, 'dlg-ofjern') && d.getElementById('dlg-ofjern-p').textContent.startsWith('«localhost» fjernes fra ordbogen'));
  klik(w, d.querySelector('#dlg-ofjern [data-luk]'));
  tjek('Fjern: Annullér fjerner intet', !s.kald.some(k => k[0] === 'ordbog_fjern') && oRaekker(d).length === 7);
  klik(w, knapI(d, 'ordbog', 'fjern-post'));
  klik(w, d.getElementById('ofjern-ok')); await vent(10);
  tjek('Fjern: ordbog_fjern med id; posten er væk, intet valgt', s.kald.some(k => k[0] === 'ordbog_fjern' && k[1].id === 6) && !oRaekke(d, 'localhost') && !kommandoAktiv(d, 'ordbog', 'fjern-post'));

  // Prøv på tekst
  klik(w, knapI(d, 'ordbog', 'proev'));
  const pt = d.getElementById('proev-tekst');
  tjek('Prøv: dialogen åbner med tomt felt i fokus', aaben(d, 'dlg-proev') && pt.value === '' && d.activeElement === pt);
  klik(w, d.getElementById('proev-ok')); await vent(5);
  tjek('Prøv: uden tekst kaldes intet', d.getElementById('proev-svar').textContent === 'Sæt en tekst ind først.' && !s.kald.some(k => k[0] === 'ordbog_proev'));
  pt.value = 'Projekt Uglebo2 kører på kontor.test\r\nprinteren 10.20.30.40\r\n';
  pt.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Enter', metaKey: true, bubbles: true }));
  await vent(10);
  const pr = [...d.querySelectorAll('#proev-svar tbody tr')];
  tjek('Prøv: ⌘↵ kører ordbog_proev; fundene vises (fanges og maskér aldrig)', s.kald.some(k => k[0] === 'ordbog_proev' && k[1].tekst.includes('Uglebo2')) && pr.length === 3 && d.getElementById('proev-svar').textContent.includes('Ordbogen fanger 2 værdier i teksten.') && pr[0].querySelector('.chip').textContent === 'iFanges' && pr[2].querySelector('.chip').textContent === '–Maskér aldrig');
  tjek('Prøv: teksten står ikke i localStorage', !JSON.stringify(Object.entries(w.localStorage)).includes('Uglebo2'));
  klik(w, d.querySelector('#dlg-proev [data-luk]'));
  tjek('Prøv: teksten og svaret slettes, når dialogen lukkes', pt.value === '' && d.getElementById('proev-svar').textContent === '');
  // Hjælpelinjens knap åbner også Prøv.
  klik(w, sek.querySelector('.hjaelpelinje button'));
  tjek('Prøv: hjælpelinjens knap åbner dialogen', aaben(d, 'dlg-proev'));
  klik(w, d.querySelector('#dlg-proev [data-luk]'));

  // English
  w.Sprog.saet('en'); await vent(5);
  tjek('English: grupper, kolonner og typer', sek.querySelector('.ordbogtabel tr.gruppe').textContent === 'Always mask caught in every case' && sek.querySelector('.ordbogtabel thead th:nth-child(2)').textContent === 'Value or pattern' && oRaekke(d, 'kontor.test').children[0].textContent === 'Domain');
  w.Sprog.saet('da');
}

// ── Ordbog, der ikke kan åbnes: tydelig besked, intet kan ændres ──
{
  const rust = falskOrdbogRust({ indst: { guide_vist: false }, laast: { art: 'beskadiget' } });
  const s = side({ hash: '#ordbog', rust });
  const { d } = s;
  await vent(10);
  const sek = d.querySelector('section[data-visning="ordbog"]');
  tjek('kan ikke åbnes: fejlbanner med årsag', sek.querySelector('.ban.danger') && sek.querySelector('.ban.danger').textContent.includes('Ordbogen kunne ikke åbnes: filen er beskadiget eller ændret. Grimnir bruger en tom ordbog og ændrer ikke filen.'));
  tjek('kan ikke åbnes: chip "Kan ikke åbnes"', sek.querySelector('.vl .chip').textContent === '?Kan ikke åbnes');
  tjek('kan ikke åbnes: Tilføj post nedtonet med forklaring', !kommandoAktiv(d, 'ordbog', 'tilfoej-post') && knapI(d, 'ordbog', 'tilfoej-post').title === 'Ordbogen kunne ikke åbnes, så den kan ikke ændres');
  tjek('kan ikke åbnes: guiden vises ikke', !aaben(d, 'dlg-guide'));
}

// ── Fra Maskér til ordbogen (O4) ──
{
  const rust = falskOrdbogRust({ indst: { guide_vist: true } });
  const s = side({ hash: '#masker', rust });
  const { d, w } = s;
  await vent(10);
  const sek = d.querySelector('section[data-visning="masker"]');
  indsaet(w, sek.querySelector('.tom'), TEKST);
  s.tast('Enter', { metaKey: true }); await vent(10);
  const knap = (id, hvad) => raekkeMed(d, id).querySelector(`[data-felt="ordbog-${hvad}"]`);
  tjek('Maskér: hver række har Altid og Aldrig som knapper med navn', fundRaekker(d).every(tr => tr.querySelectorAll('.ordbogknapper button').length === 2) && knap(24, 'altid').getAttribute('aria-label') === 'Maskér bruger060 altid: læg værdien i ordbogen' && knap(24, 'aldrig').textContent === 'Aldrig');
  tjek('Maskér: hemmeligheder kan ikke lægges i ordbogen (nedtonet, forklaring, ingen værdi i navnet)', [45, 67].every(id => knap(id, 'altid').disabled && knap(id, 'aldrig').disabled && knap(id, 'altid').title === 'Hemmeligheder kan ikke lægges i ordbogen' && !knap(id, 'aldrig').getAttribute('aria-label').includes(HEMMELIG) && !knap(id, 'aldrig').getAttribute('aria-label').includes('Zq8Xv2Lm9Pw4')));
  // Entydig art: en egen adresse bliver et eget net, og rækken maskeres efter den nye analyse.
  tjek('Maskér: Version-rækken er slået fra før', !raekkeMed(d, 70).querySelector('input[type="checkbox"]').checked);
  const foer = s.kald.filter(k => k[0] === 'analyser').length;
  klik(w, knap(70, 'altid')); await vent(20);
  const k1 = s.kald.filter(k => k[0] === 'ordbog_tilfoej').pop();
  tjek('Altid (entydig): ordbog_tilfoej som eget net uden at spørge', k1 && k1[1].type === 'eget_net' && k1[1].vaerdi === '10.2.3.4' && !aaben(d, 'dlg-opost'));
  tjek('Altid: teksten analyseres igen, og rækken maskeres nu', s.kald.filter(k => k[0] === 'analyser').length > foer && raekkeMed(d, 70).querySelector('input[type="checkbox"]').checked && raekkeMed(d, 70).querySelector('.chip').textContent === 'iFra ordbog');
  tjek('Altid: besked i statuslinjen', sek.querySelector('.besked').textContent === '10.2.3.4 står nu i ordbogen og maskeres altid.');
  tjek('Altid: brugerens øvrige valg er bevaret (Tjek selv stadig fra)', !raekkeMed(d, 67).querySelector('input[type="checkbox"]').checked && raekkeMed(d, 6).querySelector('input[type="checkbox"]').checked);
  // Tvetydig art: der spørges om typen.
  klik(w, knap(24, 'altid')); await vent(5);
  const typ = d.getElementById('opost-type');
  const synligeTyper = [...typ.options].filter(o => !o.disabled).map(o => o.value);
  tjek('Altid (tvetydig): der spørges om typen, med forslag og værdien udfyldt', aaben(d, 'dlg-opost') && d.getElementById('dlg-opost-h').textContent === 'Maskér altid' && !d.getElementById('dlg-opost-p').hidden && typ.value === 'ord' && d.getElementById('opost-vaerdi').value === 'bruger060' && JSON.stringify(synligeTyper) === JSON.stringify(['netbios', 'ord', 'person']), JSON.stringify(synligeTyper));
  vaelgType(w, typ, 'person');
  klik(w, d.getElementById('opost-ok')); await vent(20);
  const k2 = s.kald.filter(k => k[0] === 'ordbog_tilfoej').pop();
  tjek('Altid (tvetydig): gemt som den valgte type', k2[1].type === 'person' && k2[1].vaerdi === 'bruger060' && !aaben(d, 'dlg-opost') && raekkeMed(d, 24).querySelector('.chip').textContent === 'iFra ordbog');
  // Maskér aldrig: rækken forsvinder efter den nye analyse.
  klik(w, knap(6, 'aldrig')); await vent(20);
  const k3 = s.kald.filter(k => k[0] === 'ordbog_tilfoej').pop();
  tjek('Aldrig: ordbog_tilfoej som maskér aldrig, og rækken er væk', k3[1].type === 'aldrig' && k3[1].vaerdi === '10.20.30.11' && !raekkeMed(d, 6) && sek.querySelector('.besked').textContent === '10.20.30.11 står nu i ordbogen og maskeres aldrig.');
  // Modstrid: en værdi, der står under maskér altid, kan ikke også lægges på maskér aldrig.
  klik(w, knap(24, 'aldrig')); await vent(20);
  tjek('Aldrig: modstrid giver et fejlbanner, intet ændret', sek.querySelector('.ban.danger') && sek.querySelector('.ban.danger .ord').textContent.startsWith('Ordbogen blev ikke ændret: Værdien står allerede på den anden liste') && rust.ob.db.length === 3);
  // Annullér i typedialogen ændrer intet.
  const n = rust.ob.db.length;
  klik(w, knap(70, 'aldrig')); await vent(20);
  tjek('Aldrig: en værdi under maskér altid giver også modstrid her', rust.ob.db.length === n);
  // Ordbogen ændret i Ordbog-visningen: Maskér analyserer igen.
  const a0 = s.kald.filter(k => k[0] === 'analyser').length;
  await w.GrimnirOrdbog.tilfoej('ord', 'Projekt7', null); await vent(20);
  tjek('ændret ordbog: Maskér analyserer igen', s.kald.filter(k => k[0] === 'analyser').length > a0);
  tjek('Ordbog-visningen har de nye poster', oRaekker(d).length === 4);
}

// ── Advarslen ved egen kode i en navngiven sag (O7) ──
{
  const rust = falskOrdbogRust({ indst: { guide_vist: true } });
  const s = side({ hash: '#masker', rust });
  const { d, w } = s;
  await vent(10);
  const sek = d.querySelector('section[data-visning="masker"]');
  indsaet(w, sek.querySelector('.tom'), TEKST);
  s.tast('Enter', { metaKey: true }); await vent(10);
  const kode = () => raekkeMed(d, 24).querySelector('input[data-felt="kode"]');
  kode().value = 'kunde01';
  kode().dispatchEvent(new w.Event('change', { bubbles: true }));
  tjek('egen kode i en midlertidig sag uden gemte tekster: ingen advarsel', !raekkeMed(d, 24).querySelector('.raekkeadv'));
  s.tast('Enter', { metaKey: true }); await vent(400);
  s.tast('Enter', { metaKey: true }); await vent(10);
  klik(w, d.getElementById('sag-knap'));
  klik(w, d.getElementById('sag-gem-som'));
  skriv(w, d.getElementById('ny-sag-navn'), 'Prøvesag');
  klik(w, d.getElementById('ny-sag-opret')); await vent(10);
  tjek('sagen er nu navngiven med poster', d.getElementById('sag-knap').textContent.startsWith('Sag: Prøvesag'));
  indsaet(w, sek.querySelector('pre.tekst'), TEKST);
  s.tast('Enter', { metaKey: true }); await vent(10);
  kode().value = 'kunde02';
  kode().dispatchEvent(new w.Event('change', { bubbles: true }));
  await vent(400); // advarslen tegnes med tabellen efter den nye analyse (350 ms)
  const adv = raekkeMed(d, 24).querySelector('.raekkeadv');
  tjek('egen kode i en navngiven sag med gemte tekster: advarsel under feltet', adv && adv.textContent.startsWith('Sagen har gemt tidligere tekster: koden må ikke være et ord') && kode().getAttribute('aria-describedby') === adv.id);
  tjek('advarslen er ikke en fejl (intet aria-invalid, intet rødt banner)', !kode().hasAttribute('aria-invalid') && !sek.querySelector('.ban.danger'));
  tjek('rækker uden egen kode har ingen advarsel', !raekkeMed(d, 6).querySelector('.raekkeadv'));
}

// ── Guiden ved første start (O5) ──
{
  const rust = falskOrdbogRust();
  const s = side({ hash: '#masker', rust });
  const { d, w } = s;
  await vent(20);
  const dlg = d.getElementById('dlg-guide');
  const h = () => dlg.querySelector('.indhold h2').textContent;
  const fod = () => [...dlg.querySelectorAll('.fod button')];
  const trin = () => [...dlg.querySelectorAll('.trin .t')];
  tjek('guide: vises ved første start med tom ordbog', aaben(d, 'dlg-guide') && h() === 'Sådan arbejder Grimnir' && d.activeElement === dlg.querySelector('.indhold h2'));
  tjek('guide: dialogen har navn fra overskriften', dlg.getAttribute('aria-labelledby') === 'guide-h' && d.getElementById('guide-h') === dlg.querySelector('.indhold h2'));
  tjek('guide: tre trin; første siger tre sætninger, og at alt bliver på maskinen', trin().length === 3 && dlg.querySelectorAll('.guide-punkter li').length === 3 && dlg.querySelector('.guide-punkter').textContent.includes('Alt bliver på denne maskine'));
  tjek('guide: Spring over, Tilbage (nedtonet) og Næste', fod().map(b => b.textContent).join('|') === 'Spring over|Tilbage|Næste' && fod()[1].disabled);
  klik(w, fod()[2]); await vent(5);
  tjek('guide: Næste → trin 2 (domæner og NetBIOS)', h() === 'Dine domæner og NetBIOS-navne' && trin()[0].tagName === 'BUTTON' && dlg.querySelector('#guide-domaene'));
  const fd = d.getElementById('guide-domaene');
  skriv(w, fd, 'kontor.test');
  enter(w, fd); await vent(10);
  skriv(w, fd, 'KONTOR');
  klik(w, fd.parentElement.querySelector('button')); await vent(10);
  const tk = s.kald.filter(k => k[0] === 'ordbog_tilfoej').map(k => k[1].type + ':' + k[1].vaerdi);
  tjek('guide: domæne og NetBIOS-navn lægges i ordbogen (punktum afgør typen)', JSON.stringify(tk) === JSON.stringify(['domaene:kontor.test', 'netbios:KONTOR']) && fd.value === '');
  tjek('guide: listen viser det, der står i ordbogen', dlg.querySelector('.guide-liste').textContent.includes('kontor.test') && dlg.querySelector('.guide-liste').textContent.includes('KONTOR'));
  skriv(w, fd, 'kontor.test');
  enter(w, fd); await vent(10);
  tjek('guide: fejlen står under feltet', d.getElementById('guide-domaene-fejl').textContent === 'Værdien står allerede i ordbogen.' && fd.getAttribute('aria-invalid') === 'true');
  klik(w, fod()[1]); await vent(5);
  tjek('guide: Tilbage → trin 1', h() === 'Sådan arbejder Grimnir');
  klik(w, fod()[2]); klik(w, fod()[2]); await vent(5);
  tjek('guide: trin 3 (net og navnemønstre) med Færdig', h() === 'Dine net og maskinnavne' && fod()[2].textContent === 'Færdig' && d.getElementById('guide-net') && d.getElementById('guide-moenster'));
  skriv(w, d.getElementById('guide-net'), '10.20.0.0/16'); enter(w, d.getElementById('guide-net')); await vent(10);
  skriv(w, d.getElementById('guide-moenster'), 'srv-###'); enter(w, d.getElementById('guide-moenster')); await vent(10);
  tjek('guide: eget net og navnemønster lægges i ordbogen', rust.ob.db.map(p => p.type).join() === 'domaene,netbios,eget_net,navnemoenster');
  trin()[1].click(); await vent(5);
  tjek('guide: et nået trin kan klikkes', h() === 'Dine domæner og NetBIOS-navne');
  klik(w, fod()[2]); await vent(5); // Næste: trin 3 (et kommende trin kan ikke klikkes)
  klik(w, fod()[2]); await vent(10); // Færdig
  const gk = s.kald.filter(k => k[0] === 'indstillinger_gem').pop();
  tjek('guide: Færdig lukker og husker det i indstillingerne', !aaben(d, 'dlg-guide') && gk && gk[1].indstillinger.guide_vist === true && rust.ob.indst.guide_vist === true);
  // Næste start: vises ikke igen (heller ikke med tom ordbog).
  const s2 = side({ hash: '#masker', rust: falskOrdbogRust({ indst: { guide_vist: true } }) });
  await vent(20);
  tjek('guide: vises ikke igen, når den er afsluttet', !aaben(s2.d, 'dlg-guide'));
  // Spring over på første trin.
  const r3 = falskOrdbogRust();
  const s3 = side({ hash: '#masker', rust: r3 });
  await vent(20);
  klik(s3.w, s3.d.querySelector('#dlg-guide .fod button'));
  await vent(10);
  tjek('guide: Spring over lukker og husker det', !aaben(s3.d, 'dlg-guide') && r3.ob.indst.guide_vist === true && !s3.kald.some(k => k[0] === 'ordbog_tilfoej'));
  // Escape er det samme som Spring over.
  const r4 = falskOrdbogRust();
  const s4 = side({ hash: '#masker', rust: r4 });
  await vent(20);
  const ev = new s4.w.Event('cancel', { cancelable: true });
  s4.d.getElementById('dlg-guide').dispatchEvent(ev);
  await vent(10);
  tjek('guide: Escape springer over', !aaben(s4.d, 'dlg-guide') && r4.ob.indst.guide_vist === true && ev.defaultPrevented);
  // Ordbogen er ikke tom: guiden vises ikke.
  const s5 = side({ hash: '#masker', rust: falskOrdbogRust({ poster: ORDBOG() }) });
  await vent(20);
  tjek('guide: vises ikke, når ordbogen har poster', !aaben(s5.d, 'dlg-guide'));
  // Kan åbnes igen fra Indstillinger.
  s5.emit('menu', 'indstillinger');
  klik(s5.w, s5.d.getElementById('indst-guide')); await vent(5);
  tjek('guide: Vis guiden igen fra Indstillinger', aaben(s5.d, 'dlg-guide') && !aaben(s5.d, 'dlg-indst') && s5.d.querySelector('#dlg-guide .indhold h2').textContent === 'Sådan arbejder Grimnir');
  tjek('guide: listen i trin 2 viser ordbogens domæne', (() => { klik(s5.w, s5.d.querySelectorAll('#dlg-guide .fod button')[2]); return s5.d.querySelector('#dlg-guide .guide-liste').textContent.includes('kontor.test'); })());
}

// ── Indstillinger (O6) ──
{
  const rust = falskOrdbogRust({ indst: { guide_vist: true } });
  const s = side({ hash: '#masker', rust });
  const { d, w } = s;
  await vent(20);
  s.emit('menu', 'indstillinger');
  const radio = (navn, v) => d.querySelector(`input[name="${navn}"][value="${v}"]`);
  const fr = d.getElementById('indst-fremmede'), ok = d.getElementById('indst-oktet'), ud = d.getElementById('indst-udloeb');
  tjek('Indstillinger: tema og sprog som Vis-fanen', aaben(d, 'dlg-indst') && radio('indst-tema', 'system').checked && radio('indst-sprog', 'da').checked);
  tjek('Indstillinger: standard for nye sager (D4 fra, D5 til, intet udløb)', !fr.checked && ok.checked && ud.value === '' && !fr.disabled);
  tjek('Indstillinger: hver valgmulighed har et navn og en hjælpetekst', fr.getAttribute('aria-label') === 'Maskér fremmede offentlige adresser' && d.getElementById('indst-fremmede-hj').textContent.startsWith('Fra som standard') && d.getElementById('indst-oktet-hj').textContent.startsWith('Til som standard'));
  radio('indst-tema', 'moerk').checked = true;
  radio('indst-tema', 'moerk').dispatchEvent(new w.Event('change', { bubbles: true }));
  tjek('Indstillinger: tema skifter og huskes i localStorage', d.documentElement.getAttribute('data-tema') === 'moerk' && w.localStorage.getItem('grimnir-tema') === 'moerk' && d.querySelector('#baand [data-kommando="tema-moerk"]').getAttribute('aria-pressed') === 'true');
  radio('indst-sprog', 'en').checked = true;
  radio('indst-sprog', 'en').dispatchEvent(new w.Event('change', { bubbles: true }));
  tjek('Indstillinger: sprog skifter', d.documentElement.lang === 'en' && d.getElementById('dlg-indst-h').textContent === 'Settings' && radio('indst-sprog', 'en').checked);
  w.Sprog.saet('da');
  w.Tema.saet('system');
  tjek('Indstillinger: følger Vis-fanen', radio('indst-tema', 'system').checked && radio('indst-sprog', 'da').checked);
  fr.checked = true;
  fr.dispatchEvent(new w.Event('change', { bubbles: true })); await vent(5);
  ud.value = '30';
  ud.dispatchEvent(new w.Event('change', { bubbles: true })); await vent(5);
  const g = s.kald.filter(k => k[0] === 'indstillinger_gem');
  tjek('Indstillinger: hvert valg gemmes straks i Rust', g.length === 2 && g[0][1].indstillinger.masker_fremmede === true && g[1][1].indstillinger.udloeb_dage === 30 && g[1][1].indstillinger.masker_fremmede === true && rust.ob.indst.udloeb_dage === 30);
  tjek('Indstillinger: tema og sprog gemmes ikke i Rust', g.every(k => !('tema' in k[1].indstillinger) && !('sprog' in k[1].indstillinger)));
  klik(w, d.querySelector('#dlg-indst [data-luk]'));
  // Gælder en ny sag: den åbne sag beholder sine valg; efter Nulstil har den nye sag indstillingernes.
  const sek = d.querySelector('section[data-visning="masker"]');
  indsaet(w, sek.querySelector('.tom'), TEKST);
  s.tast('Enter', { metaKey: true }); await vent(10);
  s.tast('Enter', { metaKey: true }); await vent(10);
  klik(w, d.getElementById('sag-knap'));
  tjek('sagens dialog: valgene for den åbne sag (som før indstillingen)', aaben(d, 'dlg-sag') && !d.getElementById('sag-valg').hidden && !d.getElementById('sag-fremmede').checked && d.getElementById('sag-oktet').checked);
  tjek('sagens dialog: en ændring gælder kun nye værdier, og det står der', d.getElementById('sag-valg-hj').textContent === 'Sagen har allerede værdier: en ændring gælder kun nye værdier.');
  klik(w, d.getElementById('sag-nulstil')); await vent(10);
  indsaet(w, sek.querySelector('pre.tekst'), TEKST);
  s.tast('Enter', { metaKey: true }); await vent(10);
  s.tast('Enter', { metaKey: true }); await vent(10);
  klik(w, d.getElementById('sag-knap'));
  tjek('ny sag: får indstillingerne (fremmede adresser maskeres)', d.getElementById('sag-fremmede').checked && d.getElementById('sag-oktet').checked);
  const sv = d.getElementById('sag-oktet');
  sv.checked = false;
  sv.dispatchEvent(new w.Event('change', { bubbles: true })); await vent(10);
  const vk = s.kald.find(k => k[0] === 'sag_valg');
  tjek('sagens dialog: en ændring kalder sag_valg med begge valg', vk && vk[1].maskerFremmede === true && vk[1].bevarSidsteOktet === false && !d.getElementById('sag-oktet').checked);
  klik(w, d.querySelector('#dlg-sag [data-luk]'));
  // Standardudløbet foreslås i Ny sag.
  w.Grimnir.vis('sager'); await vent(5);
  klik(w, knapI(d, 'sager', 'ny-sag'));
  tjek('Ny sag: standardudløbet (30 dage) er foreslået', d.getElementById('ny-sag-udloeb').value === datoOm(30));
  klik(w, d.querySelector('#dlg-ny-sag [data-luk]'));
  // En fejl ved gemning står i dialogen, og valget springer tilbage.
  const r2 = falskOrdbogRust({ indst: { guide_vist: true }, gemFejl: true });
  const s2 = side({ hash: '#masker', rust: r2 });
  await vent(20);
  s2.emit('menu', 'indstillinger');
  const fr2 = s2.d.getElementById('indst-fremmede');
  fr2.checked = true;
  fr2.dispatchEvent(new s2.w.Event('change', { bubbles: true })); await vent(10);
  tjek('Indstillinger: en fejl står i dialogen, og valget springer tilbage', s2.d.getElementById('indst-fejl').textContent === 'Indstillingen blev ikke gemt: disken kunne ikke bruges (PermissionDenied).' && !fr2.checked);
}

// ══════════════════════════ V-FIL.1: Åbn fil og Gem som fil ══════════════════════════

/* Efterlignet Rust for filerne (samme felter som FilInfo, FilAnalyse, RaekkeSide, FilMaskering, FilDemaskering i
   src-tauri/src/maskering.rs). Filen har `antal` rækker (opdigtede adresser i 10.20.0.0/16 og én hemmelighed); søgning,
   filter og sider sker "i Rust" (her), så testen kan se, at webvisningen beder om dem i stedet for selv at have alle
   rækker. Ingen stier: Rust sender kun filnavnet. */
function falskFilRust({ antal = 1200, rester = [], forsinkelse = 0, kopierbar = true } = {}) {
  const r = falskRust({ rester });
  const RAEKKER = Array.from({ length: antal }, (_, i) => ({
    id: 10 + i * 30, art: i === 0 ? 'hemmelighed' : 'ipv4_egen', status: i === 1 ? 'tjek' : 'sikker', standard: i !== 1, hemmelig: i === 0,
    vaerdier: [i === 0 ? HEMMELIG : `10.20.${Math.floor(i / 250)}.${(i % 250) + 1}`], koder: [i === 0 ? 'GRIMNIR_SECRET_0001' : `198.18.${Math.floor(i / 250)}.${(i % 250) + 1}`],
    linje: i + 1, laast: false, antal: 1, kendt: false, rettet: false,
  }));
  let valgt = new Map(RAEKKER.map(x => [x.id, x.standard]));
  const fil = { masker: null, demasker: null };
  let sluppet = null;
  const gemt = [];
  const pause = () => new Promise(res => setTimeout(res, forsinkelse));
  const info = navn => ({ navn, bytes: 12345678, tegnsaet: 'utf16le', linjeskift: 'crlf', linjer: antal + 2, uddrag: 'Password=Sommer2026!;\r\nsrcip=10.20.0.2 msg=ok\r\n', ikke_vist: 1234567 });
  const side = sv => {
    const q = (sv.soeg || '').trim().toLowerCase(), vist = new Set(sv.vist || []);
    const alle = RAEKKER.map(x => ({ ...x, valgt: valgt.get(x.id) }));
    const passer = x => (sv.filter === 'tjek' ? x.status === 'tjek' : sv.filter === 'hemmelig' ? x.hemmelig : sv.filter === 'seneste' ? x.kendt : true)
      && (!q || x.koder.some(k => k.toLowerCase().includes(q)) || ((!x.hemmelig || vist.has(x.id)) && x.vaerdier.some(v => v.toLowerCase().includes(q))));
    const f = alle.filter(passer);
    return {
      raekker: f.slice(0, sv.antal), i_alt: f.length, valgte: alle.filter(x => x.valgt).length,
      antal: { alle: alle.length, tjek: alle.filter(x => x.status === 'tjek').length, hemmelig: alle.filter(x => x.hemmelig).length, seneste: 0, status_tjek: alle.filter(x => x.status === 'tjek').length },
    };
  };
  return {
    ...r,
    fil: { gemt, set sluppet(v) { sluppet = v; }, get aaben() { return fil; } },
    fil_aabn: async ({ visning }) => { await pause(); fil[visning] = info(visning === 'masker' ? 'app.log' : 'app.maskeret.log'); return fil[visning]; },
    fil_aabn_sluppet: ({ visning }) => { if (!sluppet) return null; fil[visning] = info(sluppet); sluppet = null; return fil[visning]; },
    fil_luk: ({ visning }) => { fil[visning] = null; return null; },
    fil_analyser: async ({ fravalgt, rort, side: sv }) => {
      await pause();
      valgt = new Map(RAEKKER.map(x => [x.id, rort ? (new Map(rort).has(x.id) ? new Map(rort).get(x.id) : x.standard) : fravalgt ? !fravalgt.includes(x.id) : x.standard]));
      return { side: side(sv), fejl: [], advarsler: [], bytes: 12345678, linjer: antal + 2, fravalgt: RAEKKER.filter(x => !valgt.get(x.id)).map(x => x.id) };
    },
    fil_raekker: ({ side: sv }) => side(sv),
    fil_gem_og_masker: async () => {
      await pause();
      return { uddrag: 'Password=GRIMNIR_SECRET_0001;\r\nsrcip=198.18.0.2 msg=ok\r\n', ikke_vist: 1234000, rester, advarsler: [], poster: antal, bytes: kopierbar ? 1000 : 6 * 1048576, kopierbar };
    },
    fil_demasker: async () => { await pause(); return { uddrag: 'Password=Sommer2026!;\r\n', ikke_vist: 99, advarsler: [], koder: ['198.18.0.2'], bytes: kopierbar ? 1000 : 6 * 1048576, kopierbar }; },
    fil_kopi: ({ visning }) => (visning === 'masker' ? 'MASKERET-HELE-FILEN' : 'RIGTIGE-HELE-FILEN'),
    fil_gem: ({ visning, ok }) => {
      if (visning === 'masker' && rester.length && !ok) throw { art: 'rester', antal: rester.length };
      if (visning === 'demasker' && !ok) throw { art: 'ikke_bekraeftet' };
      gemt.push([visning, ok]);
      return visning === 'masker' ? 'app.maskeret.log' : 'app.demaskeret.log';
    },
  };
}

// ── Statisk: ingen fil-rettigheder, ingen lytter på Tauris træk-og-slip med stier, tekster til Rusts filfejl ──
{
  const cap = JSON.parse(fs.readFileSync(path.join(repo, 'src-tauri', 'capabilities', 'default.json'), 'utf8'));
  tjek('capabilities: ingen fs- eller dialog-rettigheder (webvisningen har ingen fil-rettigheder)', !cap.permissions.some(p => /^(fs|dialog)[:-]/.test(p) || /plugin/.test(p)), cap.permissions.join(', '));
  const build = fs.readFileSync(path.join(repo, 'src-tauri', 'build.rs'), 'utf8');
  const kmd = [...build.matchAll(/^\s+"([a-z_]+)",$/gm)].map(m => m[1]);
  const mangler = kmd.filter(k => !cap.permissions.includes('allow-' + k.replace(/_/g, '-')));
  tjek('capabilities: hver kommando i build.rs har sin rettighed (også fil_*)', kmd.length >= 33 && kmd.includes('fil_gem') && mangler.length === 0, mangler.join(', '));
  const alle = fs.readdirSync(path.join(repo, 'ui', 'assets')).filter(f => f.endsWith('.js')).map(f => ui('assets/' + f)).join('\n') + ui('index.html');
  tjek('ui/: ingen lytter på tauri://drag-drop (stierne når aldrig webvisningen)', !/drag-drop|drag-enter|onDragDropEvent|tauri:\/\/drag/i.test(alle));
  tjek('ui/: ingen fil-API i webvisningen (FileReader, dataTransfer.files, input type=file)', !/FileReader|dataTransfer\.files|type=["']file["']/.test(alle));
  const filrs = fs.readFileSync(path.join(repo, 'src-tauri', 'src', 'fil.rs'), 'utf8');
  const blok = filrs.slice(filrs.indexOf('pub enum FilFejl {'), filrs.indexOf('\n}\n', filrs.indexOf('pub enum FilFejl {')));
  const snake = n => n.replace(/[A-Z]/g, (c, i) => (i ? '_' : '') + c.toLowerCase());
  const arter = [...blok.matchAll(/^ {4}([A-Z][A-Za-z0-9]+)/gm)].map(m => snake(m[1])).filter(a => a !== 'tegnsaet');
  const ligner = [...blok.matchAll(/`([a-z0-9_]+)`/g)].map(m => m[1]).filter(x => !['ligner', 'byte'].includes(x));
  const { w } = side();
  const T = w.Sprog.TEKST;
  const uden = [...arter.map(a => 'ffejl_' + a), ...ligner.map(l => 'ffejl_tegnsaet_' + l)].filter(k => !(k in T.da && k in T.en));
  tjek(`sprog: hver FilFejl (${arter.length}) og hvert "ligner" (${ligner.length}) fra fil.rs har en tekst`, arter.length >= 7 && ligner.length === 6 && uden.length === 0, uden.join(', '));
  tjek('fil.rs: hvert "ligner" i dokumentationen bruges i koden', ligner.every(l => filrs.includes(`"${l}"`)));
  const GMw = w.GrimnirMaskering;
  tjek('filfejl som tekst: Latin-1 med byteposition og stor fil med MB', GMw.filFejlTekst({ art: 'tegnsaet', ligner: 'enkeltbyte', byte: 1234 }).includes('position 1.234') && GMw.filFejlTekst({ art: 'for_stor', bytes: 110100480, maks: 104857600 }) === 'filen er 105.0 MB, og grænsen er 100.0 MB');
}

// ── Maskér med en fil: åbn, uddrag, rækker fra Rust, søgning over alle, gem, kopiér ──
{
  const skrevet = [];
  const rust = falskFilRust();
  const s = side({ rust, foer: w => Object.defineProperty(w.navigator, 'clipboard', { value: { writeText: async t => { skrevet.push(t); } }, configurable: true }) });
  const { d, w } = s;
  await vent(5);
  const G = w.GrimnirMaskering;
  const sek = d.querySelector('section[data-visning="masker"]');
  tjek('Maskér: Åbn fil er aktiv fra start, med genvejen ⌘O', kommandoAktiv(d, 'masker', 'aabn-fil') && knapI(d, 'masker', 'aabn-fil').title === 'Genvej: ⌘O');
  tjek('Maskér: den tomme tilstand har knappen Åbn fil', [...sek.querySelectorAll('.tom button')].some(b => b.textContent.trim() === 'Åbn fil'));
  tjek('Maskér: Gem maskeret fil er nedtonet uden fil, med forklaring', !kommandoAktiv(d, 'masker', 'gem-fil') && knapI(d, 'masker', 'gem-fil').title === 'Åbn en fil først; en indsat tekst kopieres med Kopiér');
  tjek('Maskér: Kvittering er stadig nedtonet (v2)', !kommandoAktiv(d, 'masker', 'kvittering') && knapI(d, 'masker', 'kvittering').title === 'Kommer i en senere version af Grimnir');
  s.emit('menu', 'aabn');
  await vent(10);
  tjek('Arkiv → Åbn… (⌘O): fil_aabn for Maskér', s.kald.some(k => k[0] === 'fil_aabn' && k[1].visning === 'masker') && G.M.st.fil && G.M.st.fil.navn === 'app.log');
  const fi = sek.querySelector('.vl .filinfo');
  tjek('værktøjslinjen: filnavn, størrelse, tegnsæt og linjeskift', fi && !fi.hidden && fi.textContent === 'app.log11.8 MBUTF-16 LECRLF', fi && fi.textContent);
  tjek('uddraget vises, og en linje siger, hvor meget der ikke vises', sek.querySelector('pre.tekst').textContent.startsWith('Password=') && sek.querySelector('.afkortet').textContent === 'Viser de første 200.000 tegn. 1.234.567 tegn mere er med i maskeringen, men vises ikke.' && !sek.querySelector('.afkortet').hidden);
  tjek('tekstpanelet viser filens linjer og størrelse', sek.querySelector('.panel .panel-hoved .muted').textContent.includes('1202'));
  s.tast('Enter', { metaKey: true });
  await vent(10);
  const fa = s.kald.filter(k => k[0] === 'fil_analyser');
  tjek('⌘↵: fil_analyser uden tekst, med kernens standard og første side', fa.length === 1 && !('tekst' in fa[0][1]) && fa[0][1].fravalgt === null && fa[0][1].side.antal === 500 && fa[0][1].side.filter === 'alle' && !s.kald.some(k => k[0] === 'analyser'));
  tjek('tabellen: 500 rækker ad gangen, "Viser 500 af 1200"', fundRaekker(d).length === 500 && sek.querySelector('.flere').textContent.includes('500') && sek.querySelector('.flere').textContent.includes('1200') && !sek.querySelector('.flere').hidden);
  const trae = n => d.querySelector(`.navdel[data-visning="masker"] [data-punkt="${n}"] .ant`).textContent;
  tjek('træets antal er over alle rækker (fra Rust)', [trae('alle'), trae('tjek'), trae('hemmelig'), trae('seneste')].join() === '1200,1,1,0');
  tjek('fodlinjen: alle fund og antal valgt (fra Rust)', d.getElementById('fod-venstre').textContent === '1200 fund · 1199 maskeres', d.getElementById('fod-venstre').textContent);
  sek.querySelector('.flere button').click();
  await vent(5);
  tjek('Vis flere: fil_raekker med 1000', s.kald.some(k => k[0] === 'fil_raekker' && k[1].side.antal === 1000) && fundRaekker(d).length === 1000);
  const soeg = sek.querySelector('.vl input[type="search"]');
  soeg.value = '10.20.4.150';
  soeg.dispatchEvent(new w.Event('input', { bubbles: true }));
  await vent(5);
  tjek('søgning dækker alle rækker: en adresse langt ude i filen findes', fundRaekker(d).length === 1 && fundRaekker(d)[0].textContent.includes('10.20.4.150') && s.kald.some(k => k[0] === 'fil_raekker' && k[1].side.soeg === '10.20.4.150'));
  soeg.value = 'sommer';
  soeg.dispatchEvent(new w.Event('input', { bubbles: true }));
  await vent(5);
  tjek('søgning: en skjult hemmelighed findes ikke på værdien', fundRaekker(d).length === 0);
  soeg.value = '';
  soeg.dispatchEvent(new w.Event('input', { bubbles: true }));
  await vent(5);
  d.querySelector('.navdel[data-visning="masker"] [data-punkt="hemmelig"]').click();
  await vent(5);
  tjek('filteret Hemmeligheder hentes fra Rust', fundRaekker(d).length === 1 && s.kald.some(k => k[0] === 'fil_raekker' && k[1].side.filter === 'hemmelig'));
  d.querySelector('.navdel[data-visning="masker"] [data-punkt="alle"]').click();
  await vent(5);
  const cb = raekkeMed(d, 70).querySelector('input[type="checkbox"]');
  cb.checked = false;
  cb.dispatchEvent(new w.Event('change', { bubbles: true }));
  await vent(400);
  const fa2 = s.kald.filter(k => k[0] === 'fil_analyser').pop();
  tjek('et fravalg sendes til Rust (fil_analyser med fravalgt)', fa2[1].fravalgt.includes(70) && d.getElementById('fod-venstre').textContent === '1200 fund · 1198 maskeres', d.getElementById('fod-venstre').textContent);
  s.tast('Enter', { metaKey: true });
  await vent(10);
  tjek('Gem og maskér: fil_gem_og_masker uden tekst', s.kald.some(k => k[0] === 'fil_gem_og_masker' && !('tekst' in k[1]) && k[1].fravalgt.includes(70)));
  tjek('efter maskeringen: det maskerede uddrag vises', sek.querySelector('pre.tekst').textContent.startsWith('Password=GRIMNIR_SECRET_0001') && sek.querySelector('.afkortet').textContent.includes('1.234.000'));
  tjek('Gem maskeret fil og Kopiér er aktive (⌘S og ⇧⌘C)', kommandoAktiv(d, 'masker', 'gem-fil') && knapI(d, 'masker', 'gem-fil').title === 'Genvej: ⌘S' && kommandoAktiv(d, 'masker', 'kopier'));
  knapI(d, 'masker', 'kopier').click();
  await vent(10);
  tjek('Kopiér: hele resultatet hentes fra Rust (fil_kopi) og kopieres', s.kald.some(k => k[0] === 'fil_kopi' && k[1].visning === 'masker') && skrevet.pop() === 'MASKERET-HELE-FILEN');
  tjek('V-LAAS.4: Kopiér af en maskeret fil melder intet til Rust', !s.kald.some(k => k[0] === 'udklip_kopieret'));
  s.emit('menu', 'gem');
  await vent(10);
  tjek('Arkiv → Gem… (⌘S): fil_gem for Maskér uden "alligevel"', rust.fil.gemt.length === 1 && rust.fil.gemt[0].join() === 'masker,false' && sek.querySelector('.besked').textContent === 'Gemt som app.maskeret.log.');
  tjek('ingen kommando har fået en sti eller hele filen', s.kald.every(k => !/sti|path|\//i.test(JSON.stringify(Object.keys(k[1]))) && !('tekst' in k[1] && /^fil_/.test(k[0]))));
  // En indsat tekst tager over: filen slippes i Rust.
  indsaet(w, sek.querySelector('pre.tekst'), TEKST);
  await vent(5);
  tjek('indsæt efter en fil: fil_luk, og værktøjslinjen viser ingen fil', s.kald.some(k => k[0] === 'fil_luk' && k[1].visning === 'masker') && G.M.st.fil === null && fi.hidden && G.M.st.tekst === TEKST);
}

// ── Maskér: rester kræver Gem alligevel; Kopiér over 5 MB er nedtonet ──
{
  const rust = falskFilRust({ antal: 3, rester: [{ art: 'original', type_: 'hemmelighed', tekst: 'SOMMER2026!', antal: 1, linje: 4 }], kopierbar: false });
  const s = side({ rust });
  const { d } = s;
  await vent(5);
  const sek = d.querySelector('section[data-visning="masker"]');
  knapI(d, 'masker', 'aabn-fil').click();
  await vent(10);
  s.tast('Enter', { metaKey: true }); await vent(10);
  s.tast('Enter', { metaKey: true }); await vent(10);
  tjek('rester: banneret om rester står', sek.textContent.includes('Lækagetjekket fandt 1 sted i resultatet, der stadig ligner en følsom værdi'));
  tjek('over 5 MB: Kopiér er nedtonet med forklaring', !kommandoAktiv(d, 'masker', 'kopier') && knapI(d, 'masker', 'kopier').title === 'Over 5 MB kan ikke kopieres; gem resultatet som fil');
  knapI(d, 'masker', 'gem-fil').click();
  await vent(5);
  const alligevel = [...sek.querySelectorAll('.ban button')].find(b => b.textContent === 'Gem alligevel');
  tjek('Gem maskeret fil med rester: intet gemt, et ekstra tryk kræves', rust.fil.gemt.length === 0 && !s.kald.some(k => k[0] === 'fil_gem') && alligevel && sek.textContent.includes('står i klartekst i filen'));
  alligevel.click();
  await vent(10);
  tjek('Gem alligevel: fil_gem med ok', rust.fil.gemt.length === 1 && rust.fil.gemt[0].join() === 'masker,true');
}

// ── Arbejder-tilstand: over et sekund vises "Grimnir arbejder", og kommandoerne er nedtonede ──
{
  const rust = falskFilRust({ antal: 3, forsinkelse: 1300 });
  const s = side({ rust });
  const { d } = s;
  await vent(5);
  const sek = d.querySelector('section[data-visning="masker"]');
  knapI(d, 'masker', 'aabn-fil').click();
  await vent(50);
  const arb = sek.querySelector('.arbejder');
  tjek('arbejder: kommandoerne er nedtonede med det samme', !kommandoAktiv(d, 'masker', 'aabn-fil') && knapI(d, 'masker', 'aabn-fil').title === 'Vent, Grimnir arbejder' && sek.querySelector('.vl .chip').textContent.includes('Arbejder'));
  tjek('arbejder: under et sekund vises ingen besked', arb.hidden);
  await vent(1050);
  tjek('arbejder: efter et sekund står "Grimnir arbejder" (role=status), og fladen er aria-busy', !arb.hidden && arb.getAttribute('role') === 'status' && arb.textContent.startsWith('Grimnir arbejder') && sek.querySelector('.flade').getAttribute('aria-busy') === 'true');
  await vent(300);
  tjek('arbejder: færdig: beskeden er væk, og Åbn fil er aktiv igen', arb.hidden && kommandoAktiv(d, 'masker', 'aabn-fil') && !sek.querySelector('.flade').hasAttribute('aria-busy'));
}

// ── Træk og slip: én fil åbnes; flere filer og en mappe afvises ──
{
  const rust = falskFilRust({ antal: 3 });
  const s = side({ rust });
  const { d, w } = s;
  await vent(5);
  const G = w.GrimnirMaskering;
  const flade = d.querySelector('section[data-visning="masker"] .flade');
  s.emit('fil-traek', true);
  tjek('træk over vinduet: fladen viser, at den tager imod', flade.hasAttribute('data-traek'));
  rust.fil.sluppet = 'sluppet.log';
  s.emit('fil-sluppet', { navn: 'sluppet.log', fejl: null });
  await vent(10);
  tjek('slip én fil: fil_aabn_sluppet i Maskér, og filen er åben', !flade.hasAttribute('data-traek') && s.kald.some(k => k[0] === 'fil_aabn_sluppet' && k[1].visning === 'masker') && G.M.st.fil && G.M.st.fil.navn === 'sluppet.log');
  s.emit('fil-sluppet', { navn: null, fejl: 'flere' });
  await vent(5);
  tjek('slip flere filer: afvist med besked', d.querySelector('section[data-visning="masker"]').textContent.includes('Træk én fil ad gangen ind'));
  s.w.location.hash = 'demasker';
  await vent(5);
  s.emit('fil-sluppet', { navn: null, fejl: 'mappe' });
  await vent(5);
  tjek('slip en mappe i Demaskér: afvist med besked dér', d.querySelector('section[data-visning="demasker"]').textContent.includes('En mappe kan ikke åbnes'));
  rust.fil.sluppet = 'svar.log';
  s.emit('fil-sluppet', { navn: 'svar.log', fejl: null });
  await vent(10);
  tjek('slip i Demaskér: filen åbnes i Demaskér', s.kald.some(k => k[0] === 'fil_aabn_sluppet' && k[1].visning === 'demasker') && G.D.st.fil && G.D.st.fil.navn === 'svar.log');
  s.w.location.hash = 'sager';
  await vent(5);
  rust.fil.sluppet = 'fra-sager.log';
  s.emit('fil-sluppet', { navn: 'fra-sager.log', fejl: null });
  await vent(20);
  tjek('slip i Sager: Maskér overtager og åbner filen', JSON.stringify(synlige(d)) === '["masker"]' && G.M.st.fil && G.M.st.fil.navn === 'fra-sager.log');
}

// ── Demaskér med en fil: bekræftelse før Gem som fil ──
{
  const skrevet = [];
  const rust = falskFilRust({ antal: 3 });
  const s = side({ hash: '#demasker', rust, foer: w => Object.defineProperty(w.navigator, 'clipboard', { value: { writeText: async t => { skrevet.push(t); } }, configurable: true }) });
  const { d, w } = s;
  await vent(5);
  w.GrimnirMaskering.saetSag(3);
  const sek = d.querySelector('section[data-visning="demasker"]');
  tjek('Demaskér: Åbn fil aktiv; Gem som fil nedtonet med forklaring', kommandoAktiv(d, 'demasker', 'aabn-fil') && !kommandoAktiv(d, 'demasker', 'gem-fil') && knapI(d, 'demasker', 'gem-fil').title === 'Åbn en fil først; en indsat tekst kopieres med Kopiér');
  s.emit('menu', 'aabn');
  await vent(10);
  tjek('Demaskér: fil_aabn for Demaskér, filinfo i værktøjslinjen', s.kald.some(k => k[0] === 'fil_aabn' && k[1].visning === 'demasker') && sek.querySelector('.vl .filinfo').textContent.startsWith('app.maskeret.log'));
  s.tast('Enter', { metaKey: true });
  await vent(10);
  tjek('Demaskér: fil_demasker uden tekst; de rigtige værdier i uddrag', s.kald.some(k => k[0] === 'fil_demasker' && !('tekst' in k[1])) && sek.querySelectorAll('pre.tekst')[1].textContent === 'Password=Sommer2026!;\r\n');
  tjek('Demaskér: Gem som fil er aktiv (⌘S)', kommandoAktiv(d, 'demasker', 'gem-fil') && knapI(d, 'demasker', 'gem-fil').title === 'Genvej: ⌘S');
  knapI(d, 'demasker', 'gem-fil').click();
  await vent(5);
  const dlg = d.getElementById('dlg-demfil');
  tjek('Gem som fil: først en bekræftelse om klartekst; intet gemt endnu', dlg.open && dlg.textContent.includes('rigtige værdier i klartekst') && !s.kald.some(k => k[0] === 'fil_gem') && d.activeElement === d.getElementById('demfil-nej'));
  d.getElementById('demfil-nej').click();
  await vent(5);
  tjek('Annullér: intet gemt', !dlg.open && !s.kald.some(k => k[0] === 'fil_gem'));
  s.emit('menu', 'gem');
  await vent(5);
  tjek('⌘S i Demaskér: også først bekræftelsen', dlg.open && !s.kald.some(k => k[0] === 'fil_gem'));
  d.getElementById('demfil-ok').click();
  await vent(10);
  tjek('Bekræftet: fil_gem for Demaskér med ok, og besked med filnavnet', !dlg.open && rust.fil.gemt.length === 1 && rust.fil.gemt[0].join() === 'demasker,true' && sek.querySelector('.besked').textContent === 'Gemt som app.demaskeret.log.');
  knapI(d, 'demasker', 'kopier-resultat').click();
  await vent(10);
  tjek('Kopiér resultat: fra Rust (fil_kopi)', skrevet.pop() === 'RIGTIGE-HELE-FILEN');
  tjek('V-LAAS.4: Kopiér af en demaskeret fil melder det til Rust (fil true)', JSON.stringify(s.kald.filter(k => k[0] === 'udklip_kopieret').map(k => k[1])) === '[{"fil":true}]');
}

// ── Windows: Ctrl+O og Ctrl+S ──
{
  const rust = falskFilRust({ antal: 3 });
  const s = side({ platform: 'windows', rust });
  const { d, w } = s;
  await vent(5);
  tjek('Windows: Åbn fil har genvejen Ctrl+O', knapI(d, 'masker', 'aabn-fil').title === 'Genvej: Ctrl+O');
  s.tast('o', { ctrlKey: true, code: 'KeyO' });
  await vent(10);
  tjek('Windows: Ctrl+O åbner en fil i Maskér', w.GrimnirMaskering.M.st.fil && w.GrimnirMaskering.M.st.fil.navn === 'app.log');
  s.tast('Enter', { ctrlKey: true }); await vent(10);
  s.tast('Enter', { ctrlKey: true }); await vent(10);
  s.tast('s', { ctrlKey: true, code: 'KeyS' });
  await vent(10);
  tjek('Windows: Ctrl+S gemmer den maskerede fil', rust.fil.gemt.length === 1 && rust.fil.gemt[0][0] === 'masker');
  const s2 = side({ rust: falskFilRust({ antal: 3 }) });
  await vent(5);
  s2.tast('o', { ctrlKey: true, code: 'KeyO' });
  await vent(10);
  tjek('macOS: Ctrl+O gør intet (menuen har ⌘O)', !s2.kald.some(k => k[0] === 'fil_aabn'));
}

// ── Ordbog (F5): Start forfra og advarslen om en adgangskode ──
{
  const rust = falskOrdbogRust({ indst: { guide_vist: true }, laast: { art: 'beskadiget' } });
  rust.ordbog_start_forfra = ({ dato }) => { rust.ob.laast = null; return { ordbog: { poster: [], fejl: null }, flyttet_til: `ordbog.${dato}.ulaeselig` }; };
  const s = side({ hash: '#ordbog', rust });
  const { d } = s;
  await vent(20);
  const sek = d.querySelector('section[data-visning="ordbog"]');
  const knap = [...sek.querySelectorAll('.ban button')].find(b => b.textContent === 'Start forfra');
  tjek('Ordbog, der ikke kan åbnes: banneret har Start forfra', Boolean(knap));
  knap.click();
  await vent(5);
  const dlg = d.getElementById('dlg-oforfra');
  const idag = (() => { const x = new Date(); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; })();
  tjek('Start forfra: bekræftelse med det nye filnavn; filen slettes ikke', dlg.open && dlg.textContent.includes(`ordbog.${idag}.ulaeselig`) && dlg.textContent.includes('slettes ikke') && !s.kald.some(k => k[0] === 'ordbog_start_forfra'));
  d.getElementById('oforfra-ok').click();
  await vent(10);
  tjek('Start forfra: kaldt med dagens dato; ordbogen er tom og kan ændres', s.kald.some(k => k[0] === 'ordbog_start_forfra' && k[1].dato === idag) && !dlg.open && sek.textContent.includes(`Den gamle ordbog hedder nu ordbog.${idag}.ulaeselig`) && kommandoAktiv(d, 'ordbog', 'tilfoej-post'));
}
{
  const rust = falskOrdbogRust({ indst: { guide_vist: true } });
  const s = side({ hash: '#ordbog', rust });
  const { d, w } = s;
  await vent(20);
  knapI(d, 'ordbog', 'tilfoej-post').click();
  await vent(5);
  const v = d.getElementById('opost-vaerdi'), adv = d.getElementById('opost-vaerdi-adv');
  vaelgType(w, d.getElementById('opost-type'), 'ord');
  v.value = 'Sommer2026!';
  v.dispatchEvent(new w.Event('input', { bubbles: true }));
  tjek('Tilføj post: et ord, der ligner en adgangskode, giver advarslen', !adv.hidden && adv.textContent === 'Ligner en adgangskode. Hemmeligheder hører ikke hjemme i ordbogen.' && v.getAttribute('aria-describedby').includes('opost-vaerdi-adv'));
  v.value = 'Uglebo';
  v.dispatchEvent(new w.Event('input', { bubbles: true }));
  tjek('Tilføj post: et almindeligt ord giver ingen advarsel', adv.hidden);
  v.value = 'Kort1!';
  v.dispatchEvent(new w.Event('input', { bubbles: true }));
  tjek('Tilføj post: under 8 tegn giver ingen advarsel', adv.hidden);
  vaelgType(w, d.getElementById('opost-type'), 'domaene');
  v.value = 'srv01-a.kontor.test';
  v.dispatchEvent(new w.Event('input', { bubbles: true }));
  tjek('Tilføj post: et domæne advares ikke (egen syntaks)', adv.hidden);
  vaelgType(w, d.getElementById('opost-type'), 'ord');
  v.value = 'Vinter2027#';
  v.dispatchEvent(new w.Event('input', { bubbles: true }));
  d.getElementById('opost-ok').click();
  await vent(10);
  tjek('Tilføj post: advarslen blokerer ikke (posten tilføjes)', rust.ob.db.some(p => p.vaerdi === 'Vinter2027#') && !d.getElementById('dlg-opost').open);
}

// ── V-RET.1 R1: tabellerne — Altid/Aldrig som ikonknapper, lange værdier forkortes og står hele i title ──
{
  const rust = falskOrdbogRust({ poster: ORDBOG(), sager: SAGER(), indst: { guide_vist: true } });
  const s = side({ rust });
  const { d, w } = s;
  await vent(20);
  const sek = d.querySelector('section[data-visning="masker"]');
  indsaet(w, sek.querySelector('.tom'), TEKST);
  s.tast('Enter', { metaKey: true });
  await vent(10);
  const tr = raekkeMed(d, 24);
  const [altid, aldrig] = [...tr.querySelectorAll('.ordbogknapper button')];
  tjek('R1: Altid og Aldrig er ikonknapper med ikon, navn, title og skjult ord', [altid, aldrig].every(b => b.classList.contains('ikonknap') && b.querySelector('svg.ik') && b.getAttribute('aria-label').length > 10 && b.title.length > 10 && b.querySelector('.skjult-tekst')) && altid.title === 'Maskér altid: læg værdien i ordbogen' && aldrig.title === 'Maskér aldrig: læg værdien i ordbogen');
  tjek('R1: Fundet værdi har hele værdien i title, i mono', tr.querySelector('.vaerdi .mono').title === 'bruger060' && tr.querySelector('.vaerdi .mono').textContent === 'bruger060');
  tjek('R1: erstatningsfeltet har koden i title, i mono', tr.querySelector('input[data-felt="kode"]').title === 'user0001' && tr.querySelector('input[data-felt="kode"]').classList.contains('mono'));
  const skjult = raekkeMed(d, 45);
  tjek('R1: en skjult hemmelighed har ingen title med værdien', !skjult.querySelector('.vaerdi [title]') && !skjult.innerHTML.includes(HEMMELIG));
  const hemmeligAldrig = skjult.querySelectorAll('.ordbogknapper button')[1];
  tjek('R1: nedtonet ikonknap forklarer hvorfor i title', hemmeligAldrig.disabled && hemmeligAldrig.title.length > 10 && hemmeligAldrig.title !== 'Maskér aldrig: læg værdien i ordbogen');
  tjek('R1: Maskér-tabellen har klassen fundtabel (kolonnerne i app.css)', sek.querySelector('table.tabel.fundtabel'));
  // Rester: teksten forkortes og står i title.
  s.tast('Enter', { metaKey: true });
  await vent(10);
  w.GrimnirMaskering.M.st.visRester = true;
  w.GrimnirMaskering.M.tegn();
  // Demaskér: tabellen har klassen advtabel, og koden står i title.
  w.location.hash = 'demasker';
  await vent(5);
  const dsek = d.querySelector('section[data-visning="demasker"]');
  indsaet(w, dsek.querySelector('.tom'), 'svar med h0099\n');
  s.tast('Enter', { metaKey: true });
  await vent(10);
  const at = dsek.querySelector('table.advtabel');
  tjek('R1: Demaskér-tabellen har klassen advtabel og koden forkortet med title', at && [...at.querySelectorAll('tbody td:nth-child(2) .mono')].every(k => k.classList.contains('kort') && k.title === k.textContent && k.title.length > 0));
  // Sager og Ordbog: navnet og værdien forkortes og står i title.
  w.location.hash = 'sager';
  await vent(10);
  const navn = d.querySelector('section[data-visning="sager"] .sagtabel tbody tr .sagnavn .kort');
  tjek('R1: Sager: navnet forkortes og står i title', navn && navn.title === navn.textContent && navn.textContent.length > 0);
  w.location.hash = 'ordbog';
  await vent(10);
  const ov = d.querySelector('section[data-visning="ordbog"] .ordbogtabel tbody tr[data-id] .mono');
  tjek('R1: Ordbog: værdien forkortes (mono) og står i title', ov && ov.classList.contains('kort') && ov.title === ov.textContent);
  const note = [...d.querySelectorAll('section[data-visning="ordbog"] .ordbogtabel tbody tr[data-id] .muted')].find(n => n.textContent);
  tjek('R1: Ordbog: noten står i title', note && note.title === note.textContent);
  const css = ui('assets/app.css');
  tjek('R1: ingen tabel har faste bredder uden for variablerne (th:nth-child med width i px eller %)', !/th:nth-child\(\d\)[^{]*\{\s*width:\s*\d/.test(css));
}
{
  const s = side({ hash: '#masker', rust: falskRust() });
  const { d, w } = s;
  await vent(5);
  w.GrimnirMaskering.M.st.resultat = { maskeret: 'x', rester: [{ art: 'nyt_fund', type_: 'hemmelighed', tekst: 'Hemmelig42', antal: 1, linje: 1 }], advarsler: [] };
  w.GrimnirMaskering.M.st.analyse = { raekker: [], fejl: [], advarsler: [], linjer: 1 };
  w.GrimnirMaskering.M.st.tekst = 'x';
  w.GrimnirMaskering.M.st.visRester = true;
  w.GrimnirMaskering.M.tegn();
  const rt = d.querySelector('.resttabel tbody td:nth-child(3) .mono');
  tjek('R1: rester: teksten forkortes (mono) og står i title', rt && rt.classList.contains('kort') && rt.title === 'Hemmelig42');
}

// ── V-RET.1 R2: tekstpanelerne bryder ikke linjer; "Ombryd" skifter, og valget huskes ikke ──
{
  const s = side({ rust: falskRust() });
  const { d, w } = s;
  await vent(5);
  const sek = d.querySelector('section[data-visning="masker"]');
  indsaet(w, sek.querySelector('.tom'), TEKST);
  await vent(5);
  const pre = sek.querySelector('pre.tekst');
  const knap = sek.querySelector('.panel-hoved .ombryd-knap');
  tjek('R2: Maskér: tekstpanelet har "Ombryd" i panelhovedet, ikke trykket, med navn og title', knap && knap.textContent === 'Ombryd' && knap.getAttribute('aria-pressed') === 'false' && knap.getAttribute('aria-label') === 'Ombryd lange linjer' && knap.title.includes('huskes ikke') && !pre.classList.contains('ombryd'));
  knap.click();
  tjek('R2: et klik ombryder (klassen ombryd, aria-pressed true)', pre.classList.contains('ombryd') && knap.getAttribute('aria-pressed') === 'true');
  knap.click();
  tjek('R2: endnu et klik slår ombrydning fra igen', !pre.classList.contains('ombryd') && knap.getAttribute('aria-pressed') === 'false');
  knap.click();
  tjek('R2: valget står ikke i localStorage', !JSON.stringify(Object.entries(w.localStorage)).toLowerCase().includes('ombryd'));
  const s2 = side({ rust: falskRust() });
  await vent(5);
  tjek('R2: ved næste start er tekstfeltet uden ombrydning', !s2.d.querySelector('section[data-visning="masker"] pre.tekst').classList.contains('ombryd') && s2.d.querySelector('section[data-visning="masker"] .ombryd-knap').getAttribute('aria-pressed') === 'false');
  const dk = [...d.querySelectorAll('section[data-visning="demasker"] .panel-hoved .ombryd-knap')];
  tjek('R2: Demaskér: begge tekstpaneler har hver sin "Ombryd"', dk.length === 2 && dk.every(b => b.closest('.panel').querySelector('pre.tekst')));
  dk[0].click();
  const dp = [...d.querySelectorAll('section[data-visning="demasker"] pre.tekst')];
  tjek('R2: Demaskér: knappen ombryder kun sit eget panel', dp[0].classList.contains('ombryd') && !dp[1].classList.contains('ombryd'));
  const css = ui('assets/app.css');
  tjek('R2: CSS: white-space: pre som standard, pre-wrap ved ombryd, og rullebjælken er altid synlig (::-webkit-scrollbar)', /\.tekst \{[^}]*white-space: pre;/.test(css) && /\.tekst\.ombryd \{[^}]*white-space: pre-wrap/.test(css) && /\.tekst::-webkit-scrollbar \{[^}]*height: 12px/.test(css));
}

// ── V-RET.1 R3: Demaskér viser Rusts linjetal (samme regel som Maskér og filer) ──
{
  const s = side({ rust: falskRust() });
  const { d, w } = s;
  await vent(5);
  indsaet(w, d.querySelector('section[data-visning="masker"] .tom'), TEKST);
  s.tast('Enter', { metaKey: true }); await vent(5);
  s.tast('Enter', { metaKey: true }); await vent(5);
  w.location.hash = 'demasker';
  await vent(5);
  const dsek = d.querySelector('section[data-visning="demasker"]');
  const info = () => dsek.querySelector('.panel .panel-hoved .muted').textContent;
  indsaet(w, dsek.querySelector('.tom'), 'a\r\nb\r\nc\r\nd\r\n');
  tjek('R3: Demaskér før demaskering: linjetallet venter på Rust ("…")', info().startsWith('… linjer'), info());
  s.tast('Enter', { metaKey: true }); await vent(5);
  tjek('R3: Demaskér efter demaskering: 4 linjer fra Rust (tekst med afsluttende CRLF)', info().startsWith('4 linjer'), info());
  const m = ui('assets/maskering.js');
  tjek('R3: ingen linjetælling i webvisningen (split på linjeskift)', !/split\(['"]\\n['"]\)/.test(m) && !/split\(\/\\r\?\\n\//.test(m));
}

// ── V-RET.1 R4: ental og flertal i begge sprog ──
{
  const { w } = side();
  const S = w.Sprog, T = S.TEKST;
  const FORM = /\{([vw]):((?:[^{}|]|\{[vw]\})*)\|((?:[^{}|]|\{[vw]\})*)\}/g;
  const former = s => [...s.matchAll(FORM)].map(m => m[1]);
  const talnoegler = Object.keys(T.da).filter(k => former(T.da[k]).length || former(T.en[k]).length);
  tjek(`R4: der er talnøgler med ental og flertal (${talnoegler.length})`, talnoegler.length >= 28);
  const skaev = talnoegler.filter(k => JSON.stringify([...new Set(former(T.da[k]))].sort()) !== JSON.stringify([...new Set(former(T.en[k]))].sort()));
  tjek('R4: hver talnøgle har ental og flertal for de samme tal i begge sprog', skaev.length === 0, skaev.join(', '));
  // Værn: et tal foran et navneord uden mønsteret (fx "{v} linjer") er en fejl.
  const NAVNEORD = /\{[vw]\} (værdier|værdi|linjer|linje|steder|sted|rækker|række|rettelser|kodepuljer|koder|kode|rester|rest|fund|sager|sag|poster|post|advarsler|advarsel|tegn|ukendte|values|value|lines|line|places|place|rows|row|changes|code|codes|leftovers|findings|cases|case|entries|entry|warnings|warning|characters|more characters|unknown)\b/;
  const umarkerede = [];
  for (const sprog of ['da', 'en']) for (const [k, v] of Object.entries(T[sprog])) if (NAVNEORD.test(v.replace(FORM, ''))) umarkerede.push(`${sprog}.${k}`);
  tjek('R4: intet tal står foran et navneord uden {v:ental|flertal}', umarkerede.length === 0, umarkerede.join(', '));
  const restDele = sprog => Object.values(T[sprog]).filter(v => /\{[vw]:/.test(v.replace(FORM, '')));
  tjek('R4: mønsteret er skrevet rigtigt overalt (ingen halve {v:…})', restDele('da').length === 0 && restDele('en').length === 0, [...restDele('da'), ...restDele('en')].join(' | '));
  tjek('R4: de gamle særnøgler til ental er væk (chipSag1, fodSag1, chipPost1, fodPost1)', ['chipSag1', 'fodSag1', 'chipPost1', 'fodPost1'].every(k => !(k in T.da) && !(k in T.en)));
  // 0, 1 og 2 giver de rigtige former: for hver talnøgle og hvert sprog står ental-formen ved 1 og flertal-formen ved 0 og 2.
  const forkerte = [];
  for (const sprog of ['da', 'en']) {
    S.saet(sprog);
    for (const k of talnoegler) {
      for (const n of [0, 1, 2]) {
        const ud = S.t(k, n, n);
        if (/\{[vw]/.test(ud)) forkerte.push(`${sprog}.${k}(${n}): ${ud}`);
        for (const m of T[sprog][k].matchAll(FORM)) {
          const form = (n === 1 ? m[2] : m[3]).replace(/\{[vw]\}/g, String(n));
          if (!ud.includes(form)) forkerte.push(`${sprog}.${k}(${n}) mangler «${form}»: ${ud}`);
        }
      }
    }
  }
  tjek('R4: 0, 1 og 2 giver den rigtige form for hver talnøgle i begge sprog', forkerte.length === 0, forkerte.slice(0, 5).join(' | '));
  const FORVENTET = [
    ['da', 'bAdvarsler', [0, '0 steder i svaret'], [1, '1 sted i svaret'], [2, '2 steder i svaret']],
    ['en', 'bAdvarsler', [0, '0 places in the reply'], [1, '1 place in the reply'], [2, '2 places in the reply']],
    ['da', 'restInfo', [0, '0 steder'], [1, '1 sted'], [2, '2 steder']],
    ['da', 'tekstInfo', [0, '0 linjer · 0.1 MB'], [1, '1 linje · 0.1 MB'], [2, '2 linjer · 0.1 MB']],
    ['en', 'tekstInfo', [0, '0 lines · 0.1 MB'], [1, '1 line · 0.1 MB'], [2, '2 lines · 0.1 MB']],
    ['da', 'chipSager', [0, '0 sager'], [1, '1 sag'], [2, '2 sager']],
    ['en', 'chipPoster', [0, '0 entries'], [1, '1 entry'], [2, '2 entries']],
    ['da', 'fodDemaskerTal', [0, '0 koder sat tilbage · 0 advarsler'], [1, '1 kode sat tilbage · 1 advarsel'], [2, '2 koder sat tilbage · 2 advarsler']],
    ['da', 'bAltTilbage', [0, 'Alle 0 koder i svaret er sat tilbage.'], [1, 'Den ene kode i svaret er sat tilbage.'], [2, 'Alle 2 koder i svaret er sat tilbage.']],
    ['en', 'bAltTilbage', [1, 'The one code in the reply has been put back.'], [2, 'All 2 codes in the reply have been put back.']],
    ['da', 'bGemRester', [1, 'fandt 1 rest, som står i klartekst i filen. Se den først'], [2, 'fandt 2 rester, som står i klartekst i filen. Se dem først']],
    ['en', 'bLaekRester', [1, 'found 1 place in the result that still looks sensitive'], [2, 'found 2 places in the result that still look sensitive']],
    ['da', 'midlertidigSag', [1, 'Midlertidig sag · 1 værdi'], [2, 'Midlertidig sag · 2 værdier']],
    ['da', 'chipUkendte', [1, '1 ukendt'], [2, '2 ukendte']],
  ];
  const forskel = [];
  for (const [sprog, k, ...par] of FORVENTET) {
    S.saet(sprog);
    for (const [n, f] of par) { const ud = S.t(k, n, k === 'tekstInfo' ? '0.1' : n); if (!ud.includes(f)) forskel.push(`${sprog}.${k}(${n}): «${ud}» ≠ «${f}»`); }
  }
  tjek('R4: udvalgte tekster ved 0, 1 og 2 (bl.a. "1 sted" / "2 steder")', forskel.length === 0, forskel.join(' | '));
  S.saet('da');
}
{
  // Sager og Ordbog i vinduet: chip og fodlinje med 1.
  const rust = falskOrdbogRust({ poster: [{ type: 'ord', vaerdi: 'Uglebo' }], sager: [{ id: hexId(1), navn: 'Supportsag 0042', poster: 1 }], indst: { guide_vist: true } });
  const s = side({ hash: '#sager', rust });
  const { d, w } = s;
  await vent(20);
  tjek('R4: Sager: chip og fodlinje siger "1 sag"', d.querySelector('section[data-visning="sager"] .vl .chip').textContent === 'i1 sag' && d.getElementById('fod-venstre').textContent === '1 sag');
  w.location.hash = 'ordbog';
  await vent(10);
  tjek('R4: Ordbog: chip og fodlinje siger "1 post"', d.querySelector('section[data-visning="ordbog"] .vl .chip').textContent === 'i1 post' && d.getElementById('fod-venstre').textContent === '1 post');
}

// ── V-LAAS.2: låseskærmen. Efterlignet Rust: låst ved start, laas_op svarer fra en kø, og hver kommando med sager,
// ordbog eller filer svarer `laast`, mens der er låst. Kaldene, mens der er låst, logges, så testen ser, at UI'et slet ikke
// spørger efter data. Kun opdigtede navne. ──
const AABNE_I_LAAST = ['kerne_version', 'menu_sprog', 'program_afslut', 'indstillinger_hent', 'indstillinger_gem', 'laas_status', 'laas_op', 'aktivitet'];
function falskLaasRust({ svar = [], laast = true, igen = null, efter: efterLaas = null, poster = [{ type: 'ord', vaerdi: 'Kragevig' }] } = {}) {
  const r = falskOrdbogRust({ poster, sager: [{ id: hexId(7), navn: 'Uglebo-sagen', poster: 7 }], indst: { guide_vist: false } });
  const st = { laast, igen, efterLaas, udenDoer: null, kue: [...svar], kaldLaast: [], opKald: [], aktivitet: 0, vent: null };
  const status = () => ({ laast: st.laast, igen: st.igen, uden_doer: st.udenDoer });
  /* Som Rust: ved oplåsning ryddes `igen`, og beskederne fra låsen gives én gang. */
  const efter = sv => {
    if (sv.svar === 'ok') { st.laast = false; st.udenDoer = null; }
    if (sv.svar === 'ikke_tilgaengelig') { st.laast = false; st.udenDoer = sv.hvorfor; }
    if (st.laast) return null;
    st.igen = null;
    const e = st.efterLaas;
    st.efterLaas = null;
    return e;
  };
  const ud = {};
  for (const [k, f] of Object.entries(r)) {
    if (typeof f !== 'function') { ud[k] = f; continue; }
    ud[k] = a => { if (st.laast && !AABNE_I_LAAST.includes(k)) { st.kaldLaast.push(k); throw { art: 'laast' }; } return f(a); };
  }
  for (const k of ['sag_status', 'sag_liste', 'fil_aabn', 'fil_aabn_sluppet', 'demasker']) {
    if (!(k in ud)) ud[k] = () => { if (st.laast) { st.kaldLaast.push(k); throw { art: 'laast' }; } return k === 'sag_liste' ? [] : { poster: 0, id: null, navn: null, udloeb: null }; };
  }
  ud.laas_status = () => status();
  ud.laas_op = async ({ sprog }) => {
    st.opKald.push(sprog);
    if (st.vent) await st.vent;
    if (!st.laast) return { svar: 'ok', status: status() };
    const sv = st.kue.length ? st.kue.shift() : { svar: 'annulleret' };
    const e = efter(sv);
    return { ...sv, status: status(), efter: e };
  };
  ud.aktivitet = () => { st.aktivitet++; return null; };
  /* Rust låser igen (dvale, skærm, brugerskift, stilstand): som laas_igen. */
  ud.laasIgen = (grund, efterLaas = null) => { st.laast = true; st.igen = grund; st.udenDoer = null; st.efterLaas = efterLaas; };
  ud.program_afslut = () => { st.afsluttet = true; return null; };
  ud.st = st;
  return ud;
}
/* Alt, siden viser eller har i attributter (tekst og attributværdier), til at lede efter sagernes indhold. */
const altIDom = d => d.documentElement.textContent + ' ' + [...d.querySelectorAll('*')].flatMap(e => [...e.attributes].map(a => a.value)).join(' ');
const laaseskaerm = d => d.documentElement.hasAttribute('data-laast');
const fremmedeKald = (kald, fra = 0) => kald.slice(fra).map(([c]) => c).filter(c => !AABNE_I_LAAST.includes(c));
{
  // Statisk: index.html starter låst; låseskærmen dækker arbejdsfladen; scriptet indlæses før Sager og Ordbog.
  const html = ui('index.html');
  tjek('Lås: <html data-laast> står fra start i index.html (låst før noget script)', /<html[^>]*\sdata-laast[\s>]/.test(html));
  tjek('Lås: laas.js indlæses efter app.js og før maskering.js, sager.js og ordbog.js', (() => { const i = n => html.indexOf('assets/' + n); return i('app.js') < i('laas.js') && i('laas.js') < i('maskering.js') && i('laas.js') < i('sager.js') && i('laas.js') < i('ordbog.js'); })());
  const css = ui('assets/app.css');
  tjek('Lås: CSS skjuler visningerne og viser låseskærmen, mens der er låst', /html\[data-laast\] \.arb > \.visning \{ display: none; \}/.test(css) && /\.laasskaerm \{ display: none; \}/.test(css) && /html\[data-laast\] \.laasskaerm \{/.test(css));
  tjek('Lås: båndet og NavPane er nedtonede, mens der er låst', /html\[data-laast\] #baand, html\[data-laast\] \.nav \{ opacity: \.45; \}/.test(css));
  const js = ui('assets/laas.js').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
  tjek('Lås: laas.js skriver ikke til konsollen og ikke til localStorage (koden uden kommentarer)', js.length > 2000 && !/console\.|localStorage/.test(js));
  const tekster = Object.values(ui('assets/sprog.js').match(/laasH:[\s\S]*?bGemFejlVedLaas: '[^']*'/g) || []).join(' ').toLowerCase();
  tjek('Lås: teksterne lover ikke mere end døren (ingen "beskytter dine sager", "sikker", "krypteret")', tekster.length > 500 && !/beskytter dine|beskytter sagerne|sikker|krypter|secure|protects your|encrypt/.test(tekster), tekster.slice(0, 80));
  tjek('Lås: teksterne siger, hvad låsen ikke gør (andre programmer)', /andre programmer/.test(tekster) && /other apps/.test(tekster));
}
{
  // Start låst → laas_op én gang med det samme → annulleret: låseskærmen står, intet fra sagerne i DOM'en.
  const rust = falskLaasRust({ svar: [{ svar: 'annulleret' }] });
  const s = side({ rust });
  const { d, kald } = s;
  await vent(20);
  tjek('Lås: laas_op kaldes én gang ved start, på UI\'ets sprog', JSON.stringify(rust.st.opKald) === '["da"]', JSON.stringify(rust.st.opKald));
  tjek('Lås: annulleret → Grimnir er stadig låst (låseskærmen)', laaseskaerm(d));
  tjek('Lås: låseskærmen har mærke, overskrift, én sætning og to knapper', d.querySelector('#laas .laas-mrk').textContent === 'G' && d.getElementById('laas-h').textContent === 'Grimnir er låst' && d.getElementById('laas-p').textContent === 'Lås op med Touch ID eller din adgangskode for at åbne dine sager og din ordbog.' && d.getElementById('laas-op').textContent === 'Lås op' && d.getElementById('laas-afslut').textContent === 'Afslut');
  tjek('Lås: Lås op er primær, Afslut sekundær; begge med aria-label', d.getElementById('laas-op').classList.contains('primary') && !d.getElementById('laas-afslut').classList.contains('primary') && /Touch ID/.test(d.getElementById('laas-op').getAttribute('aria-label')) && d.getElementById('laas-afslut').getAttribute('aria-label') === 'Afslut Grimnir');
  tjek('Lås: låseskærmen ligger på arbejdsfladen (#arb)', d.getElementById('laas').parentElement.id === 'arb');
  tjek('Lås: beskeden efter annullering', d.getElementById('laas-besked').textContent === 'Grimnir er stadig låst. Tryk Lås op for at prøve igen.', d.getElementById('laas-besked').textContent);
  tjek('Lås: fokus står på Lås op', d.activeElement === d.getElementById('laas-op'), d.activeElement && d.activeElement.id);
  tjek('Lås: båndet, visningsskiftet og træet er inert, med forklaring i title', [...d.getElementById('baand').children].every(e => e.hasAttribute('inert')) && d.getElementById('skift').hasAttribute('inert') && d.getElementById('navdele').hasAttribute('inert') && d.getElementById('baand').title === 'Grimnir er låst. Lås op for at bruge visningerne og kommandoerne.' && d.querySelector('nav.nav').title.length > 20);
  tjek('Lås: titellinjen er ikke inert (Indstillinger virker)', !d.querySelector('header.titel').closest('[inert]') && !d.getElementById('aabn-indst').closest('[inert]'));
  tjek('Lås: UI\'et har ikke spurgt efter sager, ordbog eller filer', fremmedeKald(kald).length === 0 && rust.st.kaldLaast.length === 0, JSON.stringify(fremmedeKald(kald)));
  const alt = altIDom(d);
  tjek('Lås: ingen sagsnavne, antal eller ordbogsværdier i DOM\'en', !/Uglebo|Kragevig|7 værdier|7 sag/.test(alt));
  tjek('Lås: titellinjen viser ingen sag', d.getElementById('sag-knap').hidden && d.getElementById('sag').textContent === 'Ingen sag åben');
  // ⌘2, indsæt og menuens Åbn gør intet.
  const foer = kald.length;
  s.tast('3', { metaKey: true, code: 'Digit3' });
  s.emit('menu', 'aabn');
  const e = new s.w.Event('paste', { bubbles: true, cancelable: true });
  e.clipboardData = { getData: () => 'srv-web01.kontor.test 10.20.0.5' };
  d.dispatchEvent(e);
  s.emit('fil-sluppet', { navn: 'indsat.log', fejl: null });
  await vent(10);
  tjek('Lås: ⌘3, indsæt, menuens Åbn og træk og slip gør intet', fremmedeKald(kald, foer).length === 0 && synlige(d).join() === 'masker' && !e.defaultPrevented, JSON.stringify(fremmedeKald(kald, foer)));
  tjek('Lås: stadig intet fra sagerne i DOM\'en', !/Uglebo|Kragevig/.test(altIDom(d)));
  // Om og Indstillinger virker; "Vis guiden igen" er nedtonet med forklaring.
  s.emit('menu', 'om');
  await vent(5);
  tjek('Lås: Om virker', d.getElementById('dlg-om').hasAttribute('open'));
  s.emit('menu', 'indstillinger');
  await vent(5);
  tjek('Lås: Indstillinger virker', d.getElementById('dlg-indst').hasAttribute('open') && !d.getElementById('dlg-om').hasAttribute('open'));
  tjek('Lås: "Lås efter stilstand" kan vælges, mens der er låst (15 minutter)', d.getElementById('indst-stilstand').value === '15' && !d.getElementById('indst-stilstand').disabled);
  tjek('Lås: "Vis guiden igen" er nedtonet med forklaring', d.getElementById('indst-guide').disabled && /låst/.test(d.getElementById('indst-guide').title));
  tjek('Lås: hjælpeteksten siger, hvad låsen ikke gør', /andre programmer/.test(d.getElementById('indst-laas-hj').textContent));
  d.getElementById('dlg-indst').close();
  // Enter på Afslut låser ikke op; Afslut lukker programmet.
  const opFoer = rust.st.opKald.length;
  d.getElementById('laas-afslut').focus();
  d.getElementById('laas-afslut').dispatchEvent(new s.w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  await vent(5);
  tjek('Lås: Enter på Afslut låser ikke op', rust.st.opKald.length === opFoer);
  d.getElementById('laas-afslut').click();
  await vent(5);
  tjek('Lås: Afslut kalder program_afslut', rust.st.afsluttet === true);
  // Afvist, så fejl, så ok med Enter.
  rust.st.kue.push({ svar: 'afvist' }, { svar: 'fejl', kode: -1004 }, { svar: 'ok' });
  d.getElementById('laas-op').focus();
  d.getElementById('laas-op').click();
  await vent(10);
  tjek('Lås: afvist → stadig låst med besked', laaseskaerm(d) && d.getElementById('laas-besked').textContent === 'Det lykkedes ikke at bekræfte, at det er dig. Grimnir er stadig låst.' && d.getElementById('laas-besked').classList.contains('fejl'));
  s.tast('Enter');
  await vent(10);
  tjek('Lås: Enter låser op (her: fejl -1004 → stadig låst, koden står)', laaseskaerm(d) && /-1004/.test(d.getElementById('laas-besked').textContent), d.getElementById('laas-besked').textContent);
  tjek('Lås: stadig ingen kald efter data', rust.st.kaldLaast.length === 0 && !/Uglebo|Kragevig/.test(altIDom(d)));
  s.tast('Enter');
  await vent(30);
  tjek('Lås: ok → låseskærmen er væk', !laaseskaerm(d) && !d.getElementById('baand').hasAttribute('title') && ![...d.getElementById('baand').children].some(x => x.hasAttribute('inert')) && !d.getElementById('skift').hasAttribute('inert'));
  tjek('Lås: ok → Sager og Ordbog henter nu (kontrol: navnet står i DOM\'en)', kald.some(([c]) => c === 'sag_liste') && kald.some(([c]) => c === 'ordbog_hent') && /Uglebo-sagen/.test(altIDom(d)), JSON.stringify(fremmedeKald(kald)));
  tjek('Lås: ok → intet banner', d.getElementById('laas-banner').children.length === 0);
  tjek('Lås: ok → "Vis guiden igen" virker igen', !d.getElementById('indst-guide').disabled && !d.getElementById('indst-guide').hasAttribute('title'));
  tjek('Lås: alle laas_op-kald var på dansk', rust.st.opKald.every(x => x === 'da') && rust.st.opKald.length === 4, JSON.stringify(rust.st.opKald));
  s.tast('3', { metaKey: true, code: 'Digit3' });
  await vent(5);
  tjek('Lås: låst op virker ⌘3 igen', synlige(d).join() === 'sager');
}
{
  // Ok med det samme: låseskærmen forsvinder uden flere dialoger; guiden vises først nu (den bruger ordbogen).
  const rust = falskLaasRust({ svar: [{ svar: 'ok' }] });
  const { d, kald } = side({ rust });
  await vent(30);
  tjek('Lås: ok ved start → låst op, én dialog', !laaseskaerm(d) && rust.st.opKald.length === 1);
  tjek('Lås: ok ved start → data hentes efter oplåsningen, ikke før', kald.findIndex(([c]) => c === 'laas_op') < kald.findIndex(([c]) => c === 'sag_status') && kald.findIndex(([c]) => c === 'laas_op') < kald.findIndex(([c]) => c === 'ordbog_hent') && rust.st.kaldLaast.length === 0);
  tjek('Lås: ordbogen har en post → ingen guide efter oplåsningen', !d.getElementById('dlg-guide').hasAttribute('open'));
}
{
  // Tom ordbog og guiden ikke vist: guiden åbner ikke over låseskærmen, men først efter oplåsningen.
  const rust = falskLaasRust({ svar: [{ svar: 'annulleret' }, { svar: 'ok' }], poster: [] });
  const { d } = side({ rust });
  await vent(20);
  tjek('Lås: tom ordbog → ingen guide, mens der er låst', laaseskaerm(d) && !d.getElementById('dlg-guide').hasAttribute('open'));
  d.getElementById('laas-op').click();
  await vent(30);
  tjek('Lås: tom ordbog → guiden vises efter oplåsningen', !laaseskaerm(d) && d.getElementById('dlg-guide').hasAttribute('open'));
}
{
  // Ikke tilgængelig: låst op uden dialog, med et vedvarende, afdæmpet banner.
  const rust = falskLaasRust({ svar: [{ svar: 'ikke_tilgaengelig', hvorfor: 'ingen_adgangskode' }] });
  const s = side({ rust });
  const { d } = s;
  await vent(30);
  const b = d.querySelector('#laas-banner .ban');
  tjek('Lås: ikke tilgængelig → låst op', !laaseskaerm(d));
  tjek('Lås: ikke tilgængelig → banner med den aftalte sætning', b && b.classList.contains('info') && b.querySelector('.ord').textContent === 'Denne maskine kan ikke bekræfte, hvem du er. Grimnir er ikke låst.' && b.getAttribute('role') === 'status', b && b.textContent);
  s.tast('3', { metaKey: true, code: 'Digit3' });
  await vent(10);
  tjek('Lås: banneret står også efter visningsskift (vedvarende)', d.querySelectorAll('#laas-banner .ban').length === 1 && synlige(d).join() === 'sager');
  // Engelsk: banneret skifter sprog.
  s.w.Sprog.saet('en');
  await vent(5);
  tjek('Lås: banneret på engelsk', d.querySelector('#laas-banner .ord').textContent === 'This machine cannot confirm who you are. Grimnir is not locked.');
}
{
  // Rust svarer, at der ikke er låst (V-LAAS.3: indstillingen er væk; det sker kun, hvis siden genindlæses efter
  // oplåsning): ingen dialog, intet banner.
  const rust = falskLaasRust({ laast: false });
  const { d } = side({ rust });
  await vent(20);
  tjek('Lås: ulåst ved start → ingen laas_op, ingen låseskærm', rust.st.opKald.length === 0 && !laaseskaerm(d) && d.getElementById('laas-banner').children.length === 0);
}
{
  // Engelsk: låseskærmen og laas_op på engelsk.
  const rust = falskLaasRust({ svar: [{ svar: 'annulleret' }] });
  const { d } = side({ rust, lager: { 'grimnir-sprog': 'en' } });
  await vent(20);
  tjek('Lås (en): laas_op på engelsk', JSON.stringify(rust.st.opKald) === '["en"]');
  tjek('Lås (en): låseskærmen på engelsk', d.getElementById('laas-h').textContent === 'Grimnir is locked' && d.getElementById('laas-p').textContent === 'Unlock with Touch ID or your password to open your cases and your dictionary.' && d.getElementById('laas-op').textContent === 'Unlock' && d.getElementById('laas-afslut').textContent === 'Quit' && d.getElementById('laas-besked').textContent === 'Grimnir is still locked. Press Unlock to try again.');
  tjek('Lås (en): forklaringen på båndet på engelsk', d.getElementById('baand').title === 'Grimnir is locked. Unlock to use the views and commands.');
  tjek('Lås (en): intet fra sagerne i DOM\'en', !/Uglebo|Kragevig/.test(altIDom(d)));
}
{
  // To tryk på Lås op, mens dialogen står: én dialog.
  const rust = falskLaasRust({ svar: [{ svar: 'annulleret' }, { svar: 'ok' }] });
  const s = side({ rust });
  const { d } = s;
  await vent(20);
  let slip = null;
  rust.st.vent = new Promise(r => { slip = r; });
  d.getElementById('laas-op').click();
  await vent(5);
  tjek('Lås: mens døren spørger, er Lås op optaget', d.getElementById('laas-op').disabled && d.getElementById('laas-op').getAttribute('aria-busy') === 'true' && d.getElementById('laas-besked').textContent === 'Venter på Touch ID eller din adgangskode …');
  d.getElementById('laas-op').click();
  s.tast('Enter');
  await vent(5);
  slip();
  await vent(20);
  tjek('Lås: to tryk og Enter mens døren spørger → ét kald', rust.st.opKald.length === 2 && !laaseskaerm(d), JSON.stringify(rust.st.opKald));
}
{
  // Windows (ingen dør i denne cyklus): hjælpeteksten lover ikke en lås ved start, men nævner stilstand.
  const { d } = side({ platform: 'windows' });
  await vent(10);
  tjek('Lås (Windows): hjælpeteksten siger, at Grimnir ikke starter låst her', d.getElementById('indst-laas-hj').textContent.startsWith('Denne maskine kan endnu ikke bekræfte, hvem du er, så Grimnir starter ikke låst her.') && /stået stille/.test(d.getElementById('indst-laas-hj').textContent));
}

// ── V-LAAS.3: låsen kan ikke slås fra, og Grimnir låser igen. Efterlignet Rust som V-LAAS.2 (falskLaasRust) med
// laasIgen (som Rusts laas_igen) og hændelsen `laast`. Kun opdigtede navne. ──
{
  // N1: "Lås Grimnir ved start" er væk i begge sprog: ingen afkrydsningsboks, ingen tekster, ingen kommando.
  // Kode og tekster, uden kommentarer (kommentarerne må gerne sige, at indstillingen er fjernet).
  const udenKommentarer = t => t.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const kilde = udenKommentarer(ui('index.html') + ui('assets/sprog.js') + ['laas.js', 'indstillinger.js', 'app.js'].map(f => ui('assets/' + f)).join('\n'));
  tjek('V-LAAS.3: kontrol: kilden uden kommentarer har stadig teksterne', kilde.length > 20000 && /Lås efter stilstand/.test(kilde) && /invoke\('laas_op'/.test(kilde));
  tjek('V-LAAS.3: "Lås Grimnir ved start" findes ikke i index.html, sprog.js eller scripts', !/indst-laas"|kLaasVedStart|hjLaasVedStart|laasFra|Lås Grimnir ved start|Lock Grimnir at startup|laas_ved_start/.test(kilde));
  const TEKST = {
    da: { label: 'Lås efter stilstand', valg: ['5 minutter', '15 minutter', '30 minutter', '60 minutter'], ord: [/dvale/, /skærmen slukker/, /skifter bruger/, /stået stille/, /andre programmer/] },
    en: { label: 'Lock after inactivity', valg: ['5 minutes', '15 minutes', '30 minutes', '60 minutes'], ord: [/sleep/, /display turns off/, /switch user/, /idle/, /other apps/] },
  };
  for (const lang of ['da', 'en']) {
    const rust = falskLaasRust({ svar: [{ svar: 'ok' }] });
    const s = side({ rust, lager: { 'grimnir-sprog': lang } });
    const { d } = s;
    await vent(30);
    s.emit('menu', 'indstillinger');
    await vent(5);
    const dlg = d.getElementById('dlg-indst');
    tjek(`V-LAAS.3 (${lang}): Indstillinger har ingen "Lås ved start"`, !d.getElementById('indst-laas') && !dlg.querySelector('input[type="checkbox"][id*="laas"]') && !/ved start|at startup/i.test(dlg.textContent), dlg.textContent.slice(0, 120));
    const sel = d.getElementById('indst-stilstand');
    const t = TEKST[lang];
    tjek(`V-LAAS.3 (${lang}): "${t.label}" med 5, 15, 30 og 60 minutter, ingen "aldrig"`, d.querySelector('label[for="indst-stilstand"]').textContent === t.label && JSON.stringify([...sel.options].map(o => o.value)) === '["5","15","30","60"]' && JSON.stringify([...sel.options].map(o => o.textContent)) === JSON.stringify(t.valg), JSON.stringify([...sel.options].map(o => o.textContent)));
    tjek(`V-LAAS.3 (${lang}): standard 15 minutter; aria-label og hjælpetekst`, sel.value === '15' && sel.getAttribute('aria-label') === t.label && sel.getAttribute('aria-describedby') === 'indst-laas-hj');
    const hj = d.getElementById('indst-laas-hj').textContent;
    tjek(`V-LAAS.3 (${lang}): hjælpeteksten siger, hvad låsen beskytter imod, og hvornår den låser igen`, t.ord.every(r => r.test(hj)), hj);
  }
}
{
  // "Lås efter stilstand" gemmes som de andre valg, uden laas_ved_start.
  const rust = falskLaasRust({ svar: [{ svar: 'ok' }] });
  const s = side({ rust });
  const { d, kald } = s;
  await vent(30);
  s.emit('menu', 'indstillinger');
  await vent(5);
  const sel = d.getElementById('indst-stilstand');
  sel.value = '5';
  sel.dispatchEvent(new s.w.Event('change', { bubbles: true }));
  await vent(10);
  const gemt = kald.filter(([c]) => c === 'indstillinger_gem').map(([, a]) => a.indstillinger);
  tjek('V-LAAS.3: 5 minutter gemmes (laas_efter_min: 5) uden laas_ved_start', gemt.length === 1 && gemt[0].laas_efter_min === 5 && !('laas_ved_start' in gemt[0]) && rust.ob.indst.laas_efter_min === 5, JSON.stringify(gemt));
  tjek('V-LAAS.3: valget står efter gemningen', sel.value === '5');
}
{
  // N3: låst op med sager og ordbog i DOM'en og en åben dialog; Rust låser igen → `laast` → siden genindlæses.
  const rust = falskLaasRust({ svar: [{ svar: 'ok' }] });
  const s = side({ rust, hash: '#sager' });
  const { d } = s;
  await vent(30);
  tjek('V-LAAS.3: kontrol: låst op, og sagens navn står i DOM\'en', !laaseskaerm(d) && /Uglebo-sagen/.test(altIDom(d)));
  s.emit('menu', 'om');
  await vent(5);
  const opFoer = rust.st.opKald.length;
  rust.laasIgen('dvale', { midlertidig_gemt: 'Midlertidig 2026-11-11 09.05.30', midlertidig_fejl: null, gem_fejl: null });
  s.emit('laast', 'dvale');
  await vent(10);
  tjek('V-LAAS.3: hændelsen laast genindlæser siden (location.reload)', s.jsdomFejl.some(m => /navigation/.test(m)), JSON.stringify(s.jsdomFejl));
  tjek('V-LAAS.3: visningerne skjules med det samme, før siden er genindlæst', laaseskaerm(d));
  tjek('V-LAAS.3: laast kalder ikke laas_op', rust.st.opKald.length === opFoer);
  // Den genindlæste side: samme Rust (låst igen), ny DOM og ny JS-hukommelse fra index.html.
  const g = side({ rust, hash: '#sager' });
  await vent(30);
  tjek('V-LAAS.3: efter genindlæsningen er siden låst', laaseskaerm(g.d));
  tjek('V-LAAS.3: efter genindlæsningen indeholder DOM\'en ingen af de opdigtede værdier', !/Uglebo|Kragevig|7 værdier|7 sag/.test(altIDom(g.d)));
  tjek('V-LAAS.3: efter genindlæsningen er laas_op ikke kaldt (ingen fingerdialog, mens du er væk)', rust.st.opKald.length === opFoer && !g.kald.some(([c]) => c === 'laas_op'), JSON.stringify(rust.st.opKald));
  tjek('V-LAAS.3: efter genindlæsningen er ingen dialog åben', g.d.querySelectorAll('dialog[open]').length === 0);
  tjek('V-LAAS.3: efter genindlæsningen spørger UI\'et ikke efter data', fremmedeKald(g.kald).length === 0 && rust.st.kaldLaast.length === 0, JSON.stringify(fremmedeKald(g.kald)));
  tjek('V-LAAS.3: låseskærmen siger, at Grimnir låste, og fokus står på Lås op', g.d.getElementById('laas-besked').textContent === 'Grimnir låste, mens du var væk. Tryk Lås op for at fortsætte.' && g.d.activeElement === g.d.getElementById('laas-op'), g.d.getElementById('laas-besked').textContent);
  // Først et tryk på Lås op giver dialogen; ok → beskeden om den midlertidige sag.
  rust.st.kue.push({ svar: 'ok' });
  g.d.getElementById('laas-op').click();
  await vent(30);
  tjek('V-LAAS.3: Lås op giver én dialog og låser op', rust.st.opKald.length === opFoer + 1 && !laaseskaerm(g.d));
  const b = g.d.querySelector('#laas-banner .ban[data-efter="bMidlertidigGemt"]');
  tjek('V-LAAS.3/4: beskeden om den midlertidige sag efter oplåsningen (V-LAAS.4: gemt under navnet)', b && b.querySelector('.ord').textContent === 'Den midlertidige sag blev gemt som «Midlertidig 2026-11-11 09.05.30».' && b.getAttribute('role') === 'status', b && b.textContent);
  const luk = b && b.querySelector('button');
  tjek('V-LAAS.3: beskeden har en Luk-knap med aria-label', luk && luk.textContent.trim() === 'Luk' && luk.getAttribute('aria-label') === 'Luk beskeden');
  if (luk) luk.click();
  tjek('V-LAAS.3: Luk fjerner beskeden', !g.d.querySelector('#laas-banner .ban[data-efter]'));
  tjek('V-LAAS.3: efter oplåsningen hentes data igen', g.kald.some(([c]) => c === 'sag_liste') && /Uglebo-sagen/.test(altIDom(g.d)));
}
{
  // Låst igen ved stilstand, og den åbne sag kunne ikke gemmes: annulleret → stadig låst, ingen ny dialog af sig selv;
  // Enter → dialogen → ok → advarslen uden indhold (engelsk).
  const rust = falskLaasRust({ laast: true, igen: 'stilstand', efter: { midlertidig_gemt: null, midlertidig_fejl: null, gem_fejl: { art: 'konflikt' } } });
  const s = side({ rust, lager: { 'grimnir-sprog': 'en' } });
  const { d } = s;
  await vent(30);
  tjek('V-LAAS.3 (en): låst igen → ingen laas_op og beskeden på engelsk', rust.st.opKald.length === 0 && d.getElementById('laas-besked').textContent === 'Grimnir locked while you were away. Press Unlock to continue.', d.getElementById('laas-besked').textContent);
  rust.st.kue.push({ svar: 'annulleret' }, { svar: 'ok' });
  s.tast('Enter');
  await vent(20);
  tjek('V-LAAS.3 (en): Enter → dialogen; annulleret → stadig låst', rust.st.opKald.length === 1 && laaseskaerm(d) && d.getElementById('laas-besked').textContent === 'Grimnir is still locked. Press Unlock to try again.');
  await vent(20);
  tjek('V-LAAS.3 (en): ingen ny dialog af sig selv efter annulleret', rust.st.opKald.length === 1);
  s.tast('Enter');
  await vent(30);
  const b = d.querySelector('#laas-banner .ban[data-efter="bGemFejlVedLaas"]');
  const ord = b && b.querySelector('.ord').textContent;
  tjek('V-LAAS.3 (en): ok → advarslen om sagen, der ikke kunne gemmes', !laaseskaerm(d) && b && b.classList.contains('warn') && ord.startsWith('The open case could not be saved when Grimnir locked: ') && ord.length > 60, ord);
  tjek('V-LAAS.3 (en): advarslen har intet fra sagerne', b && !/Uglebo|Kragevig/.test(b.textContent));
  tjek('V-LAAS.3 (en): beskeden gives én gang (Rust rydder den)', rust.st.efterLaas === null && d.querySelectorAll('#laas-banner .ban[data-efter]').length === 1);
}
{
  // Ved programmets start kaldes laas_op stadig af sig selv (én gang), også efter V-LAAS.3.
  const rust = falskLaasRust({ svar: [{ svar: 'annulleret' }] });
  side({ rust });
  await vent(30);
  tjek('V-LAAS.3: ved start kaldes laas_op én gang af sig selv', rust.st.opKald.length === 1);
}
{
  // Aktivitet: tastatur og mus melder `aktivitet` højst hvert 20. sekund, og ikke mens der er låst.
  const rust = falskLaasRust({ svar: [{ svar: 'ok' }] });
  const s = side({ rust });
  const { w, d } = s;
  await vent(30);
  const nu0 = Date.now();
  let nu = nu0;
  w.Date.now = () => nu;
  const n0 = rust.st.aktivitet;
  s.tast('a');
  d.dispatchEvent(new w.MouseEvent('pointermove', { bubbles: true }));
  d.dispatchEvent(new w.MouseEvent('pointerdown', { bubbles: true }));
  d.dispatchEvent(new w.WheelEvent('wheel', { bubbles: true }));
  await vent(5);
  tjek('V-LAAS.3: tastatur og mus → ét kald til aktivitet inden for 20 sekunder', rust.st.aktivitet === n0 + 1, String(rust.st.aktivitet - n0));
  nu = nu0 + 19999;
  s.tast('b');
  await vent(5);
  tjek('V-LAAS.3: 19,999 sekunder efter → intet nyt kald', rust.st.aktivitet === n0 + 1);
  nu = nu0 + 20000;
  d.dispatchEvent(new w.MouseEvent('pointermove', { bubbles: true }));
  await vent(5);
  tjek('V-LAAS.3: 20 sekunder efter → nyt kald', rust.st.aktivitet === n0 + 2);
  const l = falskLaasRust({ svar: [{ svar: 'annulleret' }] });
  const ls = side({ rust: l });
  await vent(30);
  ls.tast('x');
  ls.d.dispatchEvent(new ls.w.MouseEvent('pointermove', { bubbles: true }));
  await vent(5);
  tjek('V-LAAS.3: mens der er låst, sendes ingen aktivitet', l.st.aktivitet === 0 && laaseskaerm(ls.d));
}
{
  // N4: tandhjulet i titellinjen er et tandhjul, ikke solen; solen er stadig ikonet for Lys i Vis-fanen.
  const { w, d } = side();
  await vent(5);
  const I = w.Kit.IKONER;
  const tal = JSON.stringify(I.tandhjul).match(/-?\d+(\.\d+)?/g).map(Number);
  tjek('V-LAAS.3: tandhjul er en egen tegning, ikke solen', JSON.stringify(I.tandhjul) !== JSON.stringify(I.sol) && I.tandhjul.some(([el, a]) => el === 'path' && (a.d.match(/L/g) || []).length >= 18 && (a.d.match(/A/g) || []).length === 6), JSON.stringify(I.tandhjul).slice(0, 80));
  tjek('V-LAAS.3: tandhjulet holder sig inden for 24 × 24 med plads til stregen', tal.every(x => x >= 0 && x <= 22) && Math.max(...tal) <= 22 && Math.min(...tal.filter(x => x > 1)) >= 2);
  const knap = d.getElementById('aabn-indst');
  tjek('V-LAAS.3: titellinjens knap bruger tandhjul', knap.querySelector('svg path') && knap.querySelector('svg path').getAttribute('d') === I.tandhjul[0][1].d && knap.querySelectorAll('svg').length === 1);
  tjek('V-LAAS.3: knappens aria-label og title er uændrede', knap.getAttribute('aria-label') === 'Åbn indstillinger' && knap.title === 'Indstillinger (⌘,)');
  tjek('V-LAAS.3: solen er stadig ikonet for Lys i Vis-fanen', /id: 'tema-lys'[^}]*ikon: 'sol'/.test(ui('assets/app.js')));
  tjek('V-LAAS.3: ikonerne tegnes med 2 px streg (kit.css)', /stroke: currentColor; stroke-width: 2;/.test(ui('assets/kit.css')));
}

// ── V-LAAS.4: ved lås gemmes den midlertidige sag (beskeden med navnet), og udklipsholderen ryddes (meldingen efter
// Kopiér i Demaskér; teksten i Indstillinger). Efterlignet Rust som V-LAAS.3. Kun opdigtede navne. ──
{
  const udenKommentarer = t => t.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const kode = udenKommentarer(ui('index.html') + ['app.js', 'laas.js', 'maskering.js', 'sager.js', 'ordbog.js', 'indstillinger.js', 'kit.js', 'sprog.js', 'tema.js'].map(f => ui('assets/' + f)).join('\n'));
  tjek('V-LAAS.4: webvisningen læser aldrig udklipsholderen (ingen readText/read())', kode.length > 50000 && !/readText|clipboard\.read\(/.test(kode));
  tjek('V-LAAS.4: udklip_kopieret kaldes ét sted (Kopiér i Demaskér)', (kode.match(/invoke\('udklip_kopieret'/g) || []).length === 1);
  tjek('V-LAAS.4: den gamle besked "blev lukket" er væk', !/bMidlertidigLukket|blev lukket, da Grimnir|was closed when Grimnir/.test(kode));
}
// V-LAAS.5 N2: navnet har sekunder (TT.MM.SS); beskeden er ellers uændret.
const NAVN4 = { da: 'Midlertidig 2026-11-11 09.05.30', en: 'Temporary 2026-11-11 09.05.30' };
for (const lang of ['da', 'en']) {
  // Låst igen; den midlertidige sag er gemt. Lås op → beskeden med navnet (info, Luk-knap).
  const rust = falskLaasRust({ laast: true, igen: 'dvale', efter: { midlertidig_gemt: NAVN4[lang], midlertidig_fejl: null, gem_fejl: null } });
  const s = side({ rust, lager: { 'grimnir-sprog': lang } });
  const { d } = s;
  await vent(30);
  tjek(`V-LAAS.4 (${lang}): låst igen, ingen dialog af sig selv`, rust.st.opKald.length === 0 && laaseskaerm(d));
  rust.st.kue.push({ svar: 'ok' });
  s.tast('Enter');
  await vent(30);
  const b = d.querySelector('#laas-banner .ban[data-efter="bMidlertidigGemt"]');
  const ord = b && b.querySelector('.ord').textContent;
  const ventet = lang === 'da' ? `Den midlertidige sag blev gemt som «${NAVN4.da}».` : `The temporary case was saved as "${NAVN4.en}".`;
  tjek(`V-LAAS.4 (${lang}): beskeden nævner navnet`, !laaseskaerm(d) && ord === ventet, ord);
  tjek(`V-LAAS.4 (${lang}): beskeden er en oplysning med role=status og en Luk-knap`, b && b.classList.contains('info') && b.getAttribute('role') === 'status' && b.querySelector('button').getAttribute('aria-label') === (lang === 'da' ? 'Luk beskeden' : 'Close the message'));
  tjek(`V-LAAS.4 (${lang}): sagen åbnes ikke af sig selv (intet sag_aabn), og der er kun én besked`, !s.kald.some(([c]) => c === 'sag_aabn') && d.querySelectorAll('#laas-banner .ban[data-efter]').length === 1);
  tjek(`V-LAAS.4 (${lang}): navnet står som tekst, ikke som HTML`, b && b.querySelector('.ord').children.length === 0);
}
for (const lang of ['da', 'en']) {
  // Den midlertidige sag kunne ikke gemmes: advarslen uden indhold.
  const rust = falskLaasRust({ laast: true, igen: 'stilstand', efter: { midlertidig_gemt: null, midlertidig_fejl: { art: 'noeglering', hvad: 'andet' }, gem_fejl: null } });
  const s = side({ rust, lager: { 'grimnir-sprog': lang } });
  const { d } = s;
  await vent(30);
  rust.st.kue.push({ svar: 'ok' });
  d.getElementById('laas-op').click();
  await vent(30);
  const b = d.querySelector('#laas-banner .ban[data-efter="bMidlertidigFejl"]');
  const ord = b && b.querySelector('.ord').textContent;
  const start = lang === 'da' ? 'Den midlertidige sag kunne ikke gemmes, da Grimnir låste, og er lukket: ' : 'The temporary case could not be saved when Grimnir locked and has been closed: ';
  tjek(`V-LAAS.4 (${lang}): fejlbeskeden siger, at sagen ikke kunne gemmes og er lukket`, b && b.classList.contains('warn') && ord.startsWith(start) && ord.length > start.length + 10, ord);
  tjek(`V-LAAS.4 (${lang}): fejlbeskeden har intet fra sagerne og ingen gem-besked`, b && !/Uglebo|Kragevig|kontor\.test/.test(b.textContent) && !d.querySelector('#laas-banner .ban[data-efter="bMidlertidigGemt"]'));
}
for (const lang of ['da', 'en']) {
  // Indstillinger: én sætning om udklipsholderen i teksten om låsen (macOS). Windows rydder intet og lover det ikke.
  const s = side({ lager: { 'grimnir-sprog': lang } });
  await vent(10);
  s.emit('menu', 'indstillinger');
  await vent(5);
  const hj = s.d.getElementById('indst-laas-hj').textContent;
  // V-LAAS.5 N1: "når den låser eller afsluttes" / "when it locks or quits".
  const r = lang === 'da' ? /Har du kopieret en demaskeret tekst med Kopiér resultat, fjerner Grimnir den fra udklipsholderen, når den låser eller afsluttes, hvis den stadig ligger der\./ : /If you copied unmasked text with Copy result, Grimnir removes it from the clipboard when it locks or quits, if it is still there\./;
  tjek(`V-LAAS.4/5 (${lang}): Indstillinger siger, at kopieret demaskeret tekst fjernes fra udklipsholderen ved lås og ved afslut`, r.test(hj), hj);
  const win = side({ platform: 'windows', lager: { 'grimnir-sprog': lang } });
  await vent(10);
  tjek(`V-LAAS.4 (${lang}, Windows): teksten lover ikke at rydde udklipsholderen`, !/udklipsholder|clipboard/i.test(win.d.getElementById('indst-laas-hj').textContent));
}
{
  // En kopi, der ikke lykkedes, meldes ikke.
  const s = side({ hash: '#demasker', rust: falskRust(), foer: w => Object.defineProperty(w.navigator, 'clipboard', { value: { writeText: async () => { throw new Error('nægtet'); } }, configurable: true }) });
  const { d, w } = s;
  await vent(5);
  w.GrimnirMaskering.saetSag(3);
  indsaet(w, d.querySelector('section[data-visning="demasker"] .tom'), 'Prøv kunde01 på GRIMNIR_SECRET_0001\n');
  s.tast('Enter', { metaKey: true });
  await vent(5);
  knapI(d, 'demasker', 'kopier-resultat').click();
  await vent(5);
  tjek('V-LAAS.4: kontrol: demaskeret, og Kopiér er prøvet', s.kald.some(k => k[0] === 'demasker') && d.querySelector('section[data-visning="demasker"] .ban.danger'));
  tjek('V-LAAS.4: en kopi, der fejlede, meldes ikke til Rust', !s.kald.some(k => k[0] === 'udklip_kopieret'));
}

// ── V-LAAS.5: udklipsholderen ved Afslut (teksten i Indstillinger; se også V-LAAS.4-blokken), navnet med sekunder i
// beskeden (V-LAAS.4-blokken), og navn, slogan og beskrivelse (N3, ADR D22). Kun opdigtede navne. ──
{
  const NAVN = 'Wi24rd Grimnir', SLOGAN = 'Mask. Share. Restore.', BESKRIVELSE = 'Sensitive data masking tool for logs and scripts';
  const TITEL = `${NAVN} — ${SLOGAN}`;
  const { w } = side();
  await vent(5);
  const T = w.Sprog.TEKST;
  tjek('V-LAAS.5: navn, slogan og beskrivelse står præcist som besluttet og ens i begge sprog', ['da', 'en'].every(l => T[l].appNavn === NAVN && T[l].slogan === SLOGAN && T[l].beskrivelse === BESKRIVELSE && T[l].dokTitel === TITEL), JSON.stringify([T.da.appNavn, T.en.slogan, T.en.dokTitel]));
  tjek('V-LAAS.5: tankestregen i titlen er U+2014 med mellemrum om', TITEL.includes(' — ') && T.da.dokTitel.charCodeAt(NAVN.length + 1) === 0x2014);
  const sprog = ui('assets/sprog.js');
  const gange = x => sprog.split(`'${x}'`).length - 1;
  tjek('V-LAAS.5: teksterne står ét sted i sprog.js (ikke i hver tabel)', gange(NAVN) === 1 && gange(SLOGAN) === 1 && gange(BESKRIVELSE) === 1 && (sprog.match(/\.\.\.FAELLES,/g) || []).length === 2 && !/appNavn: '|slogan: '|beskrivelse: '|dokTitel: '/.test(sprog), [gange(NAVN), gange(SLOGAN), gange(BESKRIVELSE)].join(','));
  tjek('V-LAAS.5: den gamle nøgle wi24rd er væk', !('wi24rd' in T.da) && !('wi24rd' in T.en) && !/data-t="wi24rd"/.test(ui('index.html')));
  const konf = JSON.parse(fs.readFileSync(path.join(repo, 'src-tauri', 'tauri.conf.json'), 'utf8'));
  tjek('V-LAAS.5: vinduets titel i tauri.conf.json', konf.app.windows[0].title === TITEL, konf.app.windows[0].title);
  tjek('V-LAAS.5: productName er fortsat Grimnir', konf.productName === 'Grimnir');
  const html = ui('index.html');
  tjek('V-LAAS.5: <title> i index.html (før siden er indlæst)', html.includes(`<title>${TITEL}</title>`));
  const pm = fs.readFileSync(path.join(repo, 'src-tauri', 'src', 'programmenu.rs'), 'utf8');
  tjek('V-LAAS.5: programmenuen hedder fortsat Grimnir (begge sprog)', (pm.match(/app: "Grimnir",/g) || []).length === 2 && pm.includes('om: "Om Grimnir",') && pm.includes('om: "About Grimnir",'));
}
for (const lang of ['da', 'en']) {
  const s = side({ lager: { 'grimnir-sprog': lang } });
  const { d } = s;
  await vent(10);
  tjek(`V-LAAS.5 (${lang}): dokumentets titel`, d.title === 'Wi24rd Grimnir — Mask. Share. Restore.', d.title);
  // Titellinjen: navnet fremhævet (b), derefter sloganet nedtonet; Wi24rd står ikke længere for sig.
  const titel = d.querySelector('header.titel');
  const b = titel.querySelector('b'), sl = titel.querySelector('.slogan-plads > .slogan');
  tjek(`V-LAAS.5 (${lang}): titellinjen har navnet fremhævet og sloganet efter`, b && b.textContent === 'Wi24rd Grimnir' && sl && sl.textContent === 'Mask. Share. Restore.' && b.nextElementSibling === sl.parentElement, titel.textContent.replace(/\s+/g, ' '));
  tjek(`V-LAAS.5 (${lang}): titellinjen har ikke et ekstra "Wi24rd"`, (titel.textContent.match(/Wi24rd/g) || []).length === 1);
  // Om-dialogen: overskriften uændret; navnet, sloganet og beskrivelsen; derunder den forklarende sætning på UI-sproget.
  s.emit('menu', 'om');
  await vent(5);
  const om = d.getElementById('dlg-om');
  const linjer = [...om.querySelectorAll('.identitet p')].map(p => p.textContent);
  const omP = om.querySelector('p[data-t="omP"]');
  tjek(`V-LAAS.5 (${lang}): Om-dialogens overskrift er uændret`, om.querySelector('h2').textContent === (lang === 'da' ? 'Om Grimnir' : 'About Grimnir'));
  tjek(`V-LAAS.5 (${lang}): Om-dialogen har navn, slogan og beskrivelse i den rækkefølge`, JSON.stringify(linjer) === JSON.stringify(['Wi24rd Grimnir', 'Mask. Share. Restore.', 'Sensitive data masking tool for logs and scripts']), JSON.stringify(linjer));
  tjek(`V-LAAS.5 (${lang}): den forklarende sætning står under dem på UI-sproget`, om.querySelector('.identitet').compareDocumentPosition(omP) === 4 && omP.textContent.startsWith(lang === 'da' ? 'Wi24rd Grimnir maskerer' : 'Wi24rd Grimnir masks'), omP.textContent);
  om.querySelector('[data-luk]').click();
}
for (const lang of ['da', 'en']) {
  // Guiden ved første start: de tre linjer øverst på første skærm (over overskriften), ikke på de næste.
  const rust = falskOrdbogRust();
  const s = side({ hash: '#masker', rust, lager: { 'grimnir-sprog': lang } });
  const { d, w } = s;
  await vent(20);
  const dlg = d.getElementById('dlg-guide');
  const id = dlg.querySelector('.indhold .identitet');
  const linjer = id ? [...id.querySelectorAll('p')].map(p => p.textContent) : [];
  tjek(`V-LAAS.5 (${lang}): guiden er åben på første skærm`, aaben(d, 'dlg-guide') && dlg.querySelector('.indhold h2').textContent === (lang === 'da' ? 'Sådan arbejder Grimnir' : 'How Grimnir works'));
  tjek(`V-LAAS.5 (${lang}): guidens første skærm har navn, slogan og beskrivelse øverst`, id && !id.hidden && id === dlg.querySelector('.indhold').firstElementChild && JSON.stringify(linjer) === JSON.stringify(['Wi24rd Grimnir', 'Mask. Share. Restore.', 'Sensitive data masking tool for logs and scripts']), JSON.stringify(linjer));
  tjek(`V-LAAS.5 (${lang}): fokus står stadig på overskriften`, d.activeElement === dlg.querySelector('.indhold h2'));
  klik(w, [...dlg.querySelectorAll('.fod button')][2]);
  await vent(5);
  tjek(`V-LAAS.5 (${lang}): de tre linjer står ikke på næste skærm`, id && id.hidden);
  klik(w, [...dlg.querySelectorAll('.fod button')][1]);
  await vent(5);
  tjek(`V-LAAS.5 (${lang}): tilbage på første skærm står de igen`, id && !id.hidden);
}
{
  // Titellinjen i et smalt vindue (CSS; jsdom tegner ikke): navnet krymper aldrig, sloganet ombrydes ud af syne, før
  // noget andet giver efter, og det afkortes ikke. Farven er rail-text (kontrast.mjs har parret).
  const css = ui('assets/app.css');
  const regel = sel => { const m = css.match(new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{([^}]*)\\}')); return m ? m[1].replace(/\s+/g, ' ') : ''; };
  tjek('V-LAAS.5: navnet krymper aldrig og ombrydes ikke', /flex: none;/.test(regel('.titel b')) && /white-space: nowrap;/.test(regel('.titel b')));
  const plads = regel('.titel .slogan-plads');
  tjek('V-LAAS.5: sloganets plads giver efter først og skjuler en anden linje', /flex-wrap: wrap;/.test(plads) && /flex: 0 1000 auto;/.test(plads) && /min-width: 0;/.test(plads) && /height: 34px;/.test(plads) && /overflow: hidden;/.test(plads) && /align-content: flex-start;/.test(plads), plads);
  tjek('V-LAAS.5: titellinjen er 34 px høj (samme som pladsen)', /height: 34px;/.test(ui('assets/kit.css').match(/\.titel \{([^}]*)\}/)[1]));
  tjek('V-LAAS.5: et usynligt startpunkt foran sloganet (så det kan glide ned)', /content: ''; flex: none; width: 0; height: 34px;/.test(regel('.titel .slogan-plads::before')));
  const sl = regel('.titel .slogan');
  tjek('V-LAAS.5: sloganet afkortes og ombrydes ikke, og er nedtonet (rail-text)', /white-space: nowrap;/.test(sl) && /flex: none;/.test(sl) && /color: var\(--rail-text\);/.test(sl) && !/ellipsis/.test(sl), sl);
  const k = fs.readFileSync(path.join(repo, 'tests', 'ui', 'kontrast.mjs'), 'utf8');
  tjek('V-LAAS.5: kontrast.mjs har sloganets par (titellinjen, Om og guiden)', /\['rail-text', 'rail', TEKST, 'Titellinjen: sloganet/.test(k) && /\['text-muted', 'surface', TEKST, 'Om-dialogen og guiden: sloganet/.test(k));
}

console.log(`\n${ok + fejl} tjek: ${ok} ok, ${fejl} fejl`);
process.exit(fejl ? 1 : 0);
