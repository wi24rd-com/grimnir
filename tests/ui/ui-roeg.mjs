// UI-røgtest for Grimnirs skal: jsdom, stub for __TAURI__ (invoke, event.listen, app.getVersion), intet netværk.
// Mønsteret er Huginn and Muninns tests/ui/ui-roeg.mjs. Brug: npm run test:ui (= node tests/ui/ui-roeg.mjs).
// Tjekker: de fire visninger skifter (visningsskift, adresse og ⌘1–⌘4), tema og sprog skifter og huskes, hver StatusChip
// har symbol og ord, ingen data-t-nøgle mangler i et af sprogene, ingen farvekoder uden for tokens.css, ingen inline-stil
// eller inline-script, kittets komponenter opfører sig som beskrevet, og menuens hændelser åbner dialogerne.
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
function side({ hash = '', lager = {}, platform = 'macos' } = {}) {
  const html = ui('index.html');
  const scripts = [...html.matchAll(/<script src="([^"]+)"(?: defer)?><\/script>/g)].map(m => m[1]);
  const dom = new JSDOM(html.replace(/<script[^>]*><\/script>/g, ''), { url: 'http://tauri.localhost/index.html' + hash, runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  for (const [k, v] of Object.entries(lager)) w.localStorage.setItem(k, v);
  Object.defineProperty(w, '__GRIMNIR_PLATFORM__', { value: platform });
  w.document.documentElement.setAttribute('data-platform', platform);
  w.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  w.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  const kald = [], lyttere = {};
  w.__TAURI__ = {
    core: { invoke: async (cmd, args) => { kald.push([cmd, args || {}]); if (cmd === 'kerne_version') return '0.1.0'; throw new Error('ukendt kommando ' + cmd); } },
    event: { listen: async (navn, cb) => { (lyttere[navn] ||= []).push(cb); return () => { }; } },
    app: { getVersion: async () => '9.8.7' },
  };
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
    tjek(`${id}: kommandoerne er nedtonede med forklaring`, [...bar.querySelectorAll('.grupper[data-fane="start"] .cb')].every(b => b.getAttribute('aria-disabled') === 'true' && b.title.length > 10));
    tjek(`${id}: tom tilstand med overskrift og én sætning`, (() => { const t = d.querySelector(`section[data-visning="${id}"] .tom`); const p = t && t.querySelector('p').textContent; return t && t.querySelector('h2').textContent.length > 3 && p.length > 20 && (p.match(/[.]\s/g) || []).length === 0 && p.endsWith('.'); })());
    tjek(`${id}: fodlinjen siger, hvad fladen viser`, /^0 /.test(d.getElementById('fod-venstre').textContent));
    tjek(`${id}: træets valgte punkt har aria-current`, d.querySelectorAll(`.navdel[data-visning="${id}"] .tr[aria-current="true"]`).length === 1);
    tjek(`${id}: ${i + 1}. visning`, links[i].classList.contains('on'));
  }
  const kommandoer = { masker: ['Indsæt', 'Åbn fil', 'Analysér', 'Gem og maskér', 'Før og efter', 'Kopiér', 'Kvittering'], demasker: ['Indsæt', 'Åbn fil', 'Demaskér', 'Næste advarsel', 'Kopiér resultat', 'Gem som fil'], sager: ['Ny sag', 'Åbn i Maskér', 'Eksportér', 'Importér', 'Slet sag'], ordbog: ['Tilføj post', 'Prøv på tekst', 'Importér', 'Eksportér', 'Fjern post'] };
  for (const [id, liste] of Object.entries(kommandoer)) {
    const ord = [...d.querySelectorAll(`#baand > [data-visning="${id}"] .grupper[data-fane="start"] .cb`)].map(b => b.textContent.trim());
    tjek(`${id}: kommandoerne fra design/skaerme/`, JSON.stringify(ord) === JSON.stringify(liste), JSON.stringify(ord));
  }
  const prim = Object.fromEntries(VIS.map(id => [id, d.querySelector(`#baand > [data-visning="${id}"] .cb.pri`).textContent.trim()]));
  tjek('primære kommandoer som på skærmene', JSON.stringify(prim) === JSON.stringify({ masker: 'Gem og maskér', demasker: 'Kopiér resultat', sager: 'Ny sag', ordbog: 'Tilføj post' }), JSON.stringify(prim));
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
  tjek('English: aria-label og title følger med', d.getElementById('aabn-indst').getAttribute('aria-label') === 'Open settings' && bar.querySelector('[data-kommando="analyser"]').title === 'Coming in a later version of Grimnir');
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

console.log(`\n${ok + fejl} tjek: ${ok} ok, ${fejl} fejl`);
process.exit(fejl ? 1 : 0);
