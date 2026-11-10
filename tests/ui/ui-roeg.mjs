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
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

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
  const dom = new JSDOM(html.replace(/<script[^>]*><\/script>/g, ''), { url: 'http://tauri.localhost/index.html' + hash, runScripts: 'outside-only', pretendToBeVisual: true });
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
  return { w, d: w.document, kald, emit, tast, scripts };
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
    // Uden tekst er alt nedtonet med en forklaring, undtagen Indsæt i Maskér og Demaskér, Ny sag i Sager (V-SAG.1) og
    // Tilføj post og Prøv på tekst i Ordbog (V-ORDBOG.1).
    tjek(`${id}: kommandoerne er nedtonede med forklaring`, [...bar.querySelectorAll('.grupper[data-fane="start"] .cb')].every(b => (b.getAttribute('aria-disabled') === 'true' && b.title.length > 10) || (b.dataset.kommando === 'indsaet' && ['masker', 'demasker'].includes(id)) || (b.dataset.kommando === 'ny-sag' && id === 'sager') || (['tilfoej-post', 'proev'].includes(b.dataset.kommando) && id === 'ordbog')));
    tjek(`${id}: tom tilstand med overskrift og én sætning`, (() => { const t = d.querySelector(`section[data-visning="${id}"] .tom`); const p = t && t.querySelector('p').textContent; return t && t.querySelector('h2').textContent.length > 3 && p.length > 20 && (p.match(/[.]\s/g) || []).length === 0 && p.endsWith('.'); })());
    tjek(`${id}: fodlinjen siger, hvad fladen viser`, /^0 /.test(d.getElementById('fod-venstre').textContent));
    tjek(`${id}: træets valgte punkt har aria-current`, d.querySelectorAll(`.navdel[data-visning="${id}"] .tr[aria-current="true"]`).length === 1);
    tjek(`${id}: ${i + 1}. visning`, links[i].classList.contains('on'));
  }
  const kommandoer = { masker: ['Indsæt', 'Åbn fil', 'Analysér', 'Gem og maskér', 'Før og efter', 'Kopiér', 'Kvittering'], demasker: ['Indsæt', 'Åbn fil', 'Demaskér', 'Næste advarsel', 'Kopiér resultat', 'Gem som fil'], sager: ['Ny sag', 'Åbn i Maskér', 'Omdøb', 'Udløb', 'Eksportér', 'Importér', 'Slet sag'], ordbog: ['Tilføj post', 'Ret', 'Prøv på tekst', 'Importér', 'Eksportér', 'Fjern post'] };
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
      return { tekst: t, koder: Object.keys(koder).slice(1), advarsler: [{ art: 'ukendt_kode', kode: 'h0099', antal: 1, linje: 1 }, { art: 'ikke_brugt', kode: Object.keys(koder)[0], antal: 1, linje: 0 }] };
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
  tjek('Demaskér: advarsel som banner og ikke-brugt som oplysning', dsek.querySelector('.ban.warn') && dsek.querySelector('.ban.warn').textContent.includes('1 steder i svaret') && dsek.querySelector('.ban.info'));
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
  tjek('afvist rettelse: fejlbanner, intet resultat, ingen sag', sek.querySelector('.ban.danger') && sek.textContent.includes('1 rettelser kan ikke bruges') && !s.w.GrimnirMaskering.M.st.resultat && d.getElementById('sag-knap').hidden);
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
  let i0 = { masker_fremmede: false, bevar_sidste_oktet: true, udloeb_dage: null, guide_vist: false, ...indst };
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

console.log(`\n${ok + fejl} tjek: ${ok} ok, ${fejl} fejl`);
process.exit(fejl ? 1 : 0);
