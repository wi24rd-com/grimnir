// UI-røgtest for Grimnirs skal: jsdom, stub for __TAURI__ (invoke, event.listen, app.getVersion), intet netværk.
// Mønsteret er Huginn and Muninns tests/ui/ui-roeg.mjs. Brug: npm run test:ui (= node tests/ui/ui-roeg.mjs).
// Tjekker: de fire visninger skifter (visningsskift, adresse og ⌘1–⌘4), tema og sprog skifter og huskes, hver StatusChip
// har symbol og ord, ingen data-t-nøgle mangler i et af sprogene, ingen farvekoder uden for tokens.css, ingen inline-stil
// eller inline-script, kittets komponenter opfører sig som beskrevet, og menuens hændelser åbner dialogerne.
// V-SKAL.2: Maskér og Demaskér med en efterlignet Rust (falskRust): indsæt → analysér → ret en kode → slå en række fra →
// gem og maskér → kopiér; demaskér; filtrene; hemmelighed skjult; banner ved rester; ingen console.log; localStorage har
// kun tema og sprog.
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
  w.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  const kald = [], lyttere = {};
  w.__TAURI__ = {
    core: {
      invoke: async (cmd, args) => {
        kald.push([cmd, args || {}]);
        if (cmd === 'kerne_version') return '0.1.0';
        if (rust && cmd in rust) return rust[cmd](args || {});
        if (cmd === 'sag_status') return { poster: 0 };
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
    // Uden tekst er alt nedtonet med en forklaring, undtagen Indsæt i Maskér og Demaskér.
    tjek(`${id}: kommandoerne er nedtonede med forklaring`, [...bar.querySelectorAll('.grupper[data-fane="start"] .cb')].every(b => (b.getAttribute('aria-disabled') === 'true' && b.title.length > 10) || (b.dataset.kommando === 'indsaet' && ['masker', 'demasker'].includes(id))));
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
  tjek('tabellen: kolonnerne Type, Fundet værdi, Erstatning, Antal, Status', [...sek.querySelectorAll('.fundtabel th')].map(t => t.textContent).join('|') === '✓|Type|Fundet værdi|Erstatning|Antal|Status');
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

console.log(`\n${ok + fejl} tjek: ${ok} ok, ${fejl} fejl`);
process.exit(fejl ? 1 : 0);
