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
// V-OPBYG.6 N4: hvert afsnit (en blok eller en løkke øverst i filen) kører i sin egen async-funktion: await (async () => {
// … })();. Modulet er én lang async-funktion (top-level await), og V8 holder dens registre, også for en bloks const s, d
// og w efter blokken; så blev hvert jsdom-vindue (med sin kontekst og alle scripts, ca. 10 MB) i hukommelsen testen ud
// (fundet med et heap-snapshot: vinduerne holdtes fra "Stack roots"). Når funktionen returnerer, kan vinduet samles op.

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const ui = p => fs.readFileSync(path.join(repo, 'ui', p), 'utf8');
let ok = 0, fejl = 0;
const tjek = (navn, betingelse, detalje = '') => {
  if (betingelse) { ok++; console.log('ok   ' + navn); } else { fejl++; console.log('FEJL ' + navn + (detalje ? ' — ' + detalje : '')); }
};
const vent = (ms = 0) => new Promise(r => setTimeout(r, ms));
// V-OPBYG.1: flyttet hertil fra V-FANER.2-afsnittet, så alle afsnit kan vente på en hændelse eller en tilstand.
// Hændelsen grimnir-visning for id (app.js sender den, når visningen er skiftet). false, hvis den ikke kommer.
const visningSkift = (w, id, maks = 4000) => new Promise(r => {
  const t = w.setTimeout(() => { w.document.removeEventListener('grimnir-visning', f); r(false); }, maks);
  const f = e => { if (e.detail === id) { w.clearTimeout(t); w.document.removeEventListener('grimnir-visning', f); r(true); } };
  w.document.addEventListener('grimnir-visning', f);
});
// En tilstand i DOM'en: sand straks, eller ved den første ændring, der gør den sand. false, hvis den ikke indtræffer.
const ventTil = (w, betingelse, maks = 4000) => new Promise(r => {
  if (betingelse()) { r(true); return; }
  const mo = new w.MutationObserver(() => { if (betingelse()) { mo.disconnect(); w.clearTimeout(t); r(true); } });
  const t = w.setTimeout(() => { mo.disconnect(); r(betingelse()); }, maks);
  mo.observe(w.document, { subtree: true, attributes: true, childList: true, characterData: true });
});

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
        // V-OPBYG.2: uden en efterlignet Rust for noterne har sagen ingen noter.
        if (cmd === 'noter_hent') return { id: null, navn: null, noter: [], nr: null, maks_tegn: 4000, maks_antal: 200 };
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
// V-OPBYG.2 N2: fem visninger; Noter mellem Demaskér og Sager.
const VIS = ['masker', 'demasker', 'noter', 'sager', 'ordbog'];
// V-KITBRUG.2 N3 (G11): hvorfor en kommando er slået fra, står i kittets værktøjstip (aria-describedby → role="tooltip"),
// ikke i title. Teksten i tippet, eller null, hvis der intet tip er.
const forklaring = b => { const t = b && b.ownerDocument.getElementById(b.getAttribute('aria-describedby') || ''); return t && t.getAttribute('role') === 'tooltip' ? t.textContent : null; };
// En kommando, der er slået fra med en forklaring, står i kittets .tip-plads (G11); ellers står knappen selv i gruppen.
const plads = b => (b.parentElement.classList.contains('tip-plads') ? b.parentElement : b);

// ── Statisk: filerne ──
await (async () => {
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
})();

// ── Start, visningsskift og genveje ──
await (async () => {
  const s = side();
  const { d } = s;
  await vent();
  tjek('starter på Maskér', JSON.stringify(synlige(d)) === '["masker"]', JSON.stringify(synlige(d)));
  // V-FANER.2: visningerne er store knapper forrest i båndet (i hvert af de fire bånd; links er den viste visnings).
  const links = [...d.querySelectorAll('#baand > [data-visning]:not([hidden]) .vk')];
  const alleLinks = [...d.querySelectorAll('#baand .vk')];
  tjek('V-OPBYG.2: visningerne står forrest i båndet: fem i fast rækkefølge (Noter mellem Demaskér og Sager)', JSON.stringify(links.map(a => a.dataset.visning)) === JSON.stringify(VIS));
  tjek('V-OPBYG.2: aria-current="page" kun på den aktive visning (i alle fem bånd)', alleLinks.filter(a => a.getAttribute('aria-current') === 'page').map(a => a.dataset.visning).join() === 'masker,masker,masker,masker,masker');
  tjek('V-OPBYG.2: genvejene står i visningsknappernes værktøjstip (⌘1–⌘5 på macOS)', links.map(a => forklaring(a)).join() === '⌘1,⌘2,⌘3,⌘4,⌘5');
  for (const [i, id] of VIS.entries()) {
    s.w.location.hash = id;
    await vent(5);
    tjek(`#${id} viser ${id}`, JSON.stringify(synlige(d)) === JSON.stringify([id]));
    tjek(`${id}: aria-current flytter med`, alleLinks.filter(a => a.getAttribute('aria-current') === 'page').map(a => a.dataset.visning).join() === VIS.map(() => id).join());
    const bar = d.querySelector(`#baand > [data-visning="${id}"]`);
    tjek(`${id}: kun visningens CommandBar vises`, !bar.hidden && [...d.querySelectorAll('#baand > [data-visning]')].filter(b => !b.hidden).length === 1);
    tjek(`${id}: én primær kommando på Start`, bar.querySelectorAll('.grupper[data-fane="start"] .cb.pri').length === 1);
    // Uden tekst er alt nedtonet med en forklaring, undtagen Indsæt i Maskér og Demaskér, Ny sag i Sager (V-SAG.1),
    // Tilføj post og Prøv på tekst i Ordbog (V-ORDBOG.1) og Åbn fil i Maskér og Demaskér (V-FIL.1).
    tjek(`${id}: kommandoerne er nedtonede med forklaring`, [...bar.querySelectorAll('.grupper[data-fane="start"] .cb:not(.vk)')].every(b => (b.getAttribute('aria-disabled') === 'true' && (forklaring(b) || '').length > 10) || (['indsaet', 'aabn-fil'].includes(b.dataset.kommando) && ['masker', 'demasker'].includes(id)) || (['ny-sag', 'gem-som-sag'].includes(b.dataset.kommando) && id === 'sager') || (['tilfoej-post', 'proev'].includes(b.dataset.kommando) && id === 'ordbog') || (b.dataset.kommando === 'ny-note' && id === 'noter')));
    tjek(`${id}: tom tilstand med overskrift og én sætning`, (() => { const t = d.querySelector(`section[data-visning="${id}"] .tomt`); const p = t && t.querySelector('p').textContent; return t && t.querySelector('h2').textContent.length > 3 && p.length > 20 && (p.match(/[.]\s/g) || []).length === 0 && p.endsWith('.'); })());
    tjek(`V-OPBYG.2 N4: ${id}: fodlinjen siger sagens navn og antallet af gemte erstatninger`, d.getElementById('fod-venstre').textContent === 'Midlertidig sag · 0 gemte erstatninger', d.getElementById('fod-venstre').textContent);
    tjek(`${id}: træets valgte punkt har aria-current`, d.querySelectorAll(`.navdel[data-visning="${id}"] .tr[aria-current="true"]`).length === 1);
    tjek(`${id}: ${i + 1}. visning`, bar.querySelectorAll('.vk')[i]?.getAttribute('aria-current') === 'page' && bar.querySelectorAll('.vk')[i]?.dataset.visning === id);
  }
  // V-MANUEL.1: Ryd (Maskér og Demaskér), Fortryd og Gentag (gruppen Rediger) og Maskér dette (gruppen Maskering).
  // V-OPBYG.1 (D27): skitsens ord og rækkefølge (Maskér markering under Rediger; Gem som sag… først i Sager).
  // V-OPBYG.5 N1: Maskér som hemmelighed sidst i Maskérs bånd (sin egen gruppe).
  const kommandoer = { masker: ['Indsæt', 'Åbn fil', 'Ryd', 'Fortryd', 'Gentag', 'Maskér markering', 'Analysér igen', 'Maskér', 'Før og efter', 'Kopiér maskeret tekst', 'Gem maskeret fil', 'Kopiér kvittering', 'Maskér som hemmelighed'], demasker: ['Indsæt', 'Åbn fil', 'Ryd', 'Demaskér', 'Næste advarsel', 'Kopiér resultat', 'Gem som fil'], noter: ['Ny note', 'Ret note', 'Slet note', 'Kopiér noterne'], sager: ['Gem som sag…', 'Ny sag', 'Vis indhold', 'Åbn i Maskér', 'Omdøb', 'Udløb', 'Eksportér', 'Importér', 'Slet sag'], ordbog: ['Tilføj post', 'Ret', 'Prøv på tekst', 'Importér', 'Eksportér', 'Fjern post'] };
  for (const [id, liste] of Object.entries(kommandoer)) {
    const ord = [...d.querySelectorAll(`#baand > [data-visning="${id}"] .grupper[data-fane="start"] .cb:not(.vk)`)].map(b => b.textContent.trim());
    tjek(`${id}: kommandoerne fra design/skaerme/`, JSON.stringify(ord) === JSON.stringify(liste), JSON.stringify(ord));
  }
  const prim = Object.fromEntries(VIS.map(id => [id, d.querySelector(`#baand > [data-visning="${id}"] .cb.pri`).textContent.trim()]));
  tjek('primære kommandoer (Demaskér er primær i Demaskér, M4)', JSON.stringify(prim) === JSON.stringify({ masker: 'Maskér', demasker: 'Demaskér', noter: 'Ny note', sager: 'Ny sag', ordbog: 'Tilføj post' }), JSON.stringify(prim));
  // ⌘1–⌘5 (V-OPBYG.2: ⌘3 Noter, ⌘4 Sager, ⌘5 Ordbog)
  s.tast('2', { metaKey: true, code: 'Digit2' });
  await vent(5);
  tjek('⌘2 skifter til Demaskér', synlige(d).join() === 'demasker');
  s.tast('3', { metaKey: true, code: 'Digit3' });
  await vent(5);
  tjek('V-OPBYG.2: ⌘3 skifter til Noter', synlige(d).join() === 'noter');
  s.tast('4', { metaKey: true, code: 'Digit4' });
  await vent(5);
  tjek('V-OPBYG.2: ⌘4 skifter til Sager (før Ordbog)', synlige(d).join() === 'sager');
  s.tast('5', { metaKey: true, code: 'Digit5' });
  await vent(5);
  tjek('V-OPBYG.2: ⌘5 skifter til Ordbog', synlige(d).join() === 'ordbog');
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
  tjek('V-OPBYG.3 N2: titellinjen kan trækkes (deep), mærket er masken (kittets .mrk-maske, aria-hidden, intet bogstav)', d.querySelector('.titel').getAttribute('data-tauri-drag-region') === 'deep' && !d.querySelector('.titel .mrk') && d.querySelector('.titel > .mrk-maske.gr-mrk[aria-hidden="true"]') && d.querySelector('.titel .gr-mrk').textContent === '' && !d.querySelector('.titel .gr-mrk').children.length);
  // Menuen
  s.emit('menu', 'indstillinger');
  tjek('menuen "indstillinger" åbner Indstillinger', d.getElementById('dlg-indst').hasAttribute('open'));
  d.querySelector('#dlg-indst [data-svar="luk"]').click();
  tjek('Luk lukker dialogen', !d.getElementById('dlg-indst').hasAttribute('open'));
  s.emit('menu', 'om');
  tjek('menuen "om" åbner Om med versionerne', d.getElementById('dlg-om').hasAttribute('open') && d.getElementById('om-kerne').textContent === 'Kerne 0.1.0');
  s.emit('menu', 'noget-andet');
  tjek('ukendt menuhændelse gør intet', d.querySelectorAll('dialog[open]').length === 1);
  d.querySelector('#dlg-om [data-svar="luk"]').click();
  d.getElementById('aabn-indst').click();
  tjek('tandhjulet i titellinjen åbner Indstillinger', d.getElementById('dlg-indst').hasAttribute('open'));
  tjek('tandhjulet har aria-label og genvej i title', d.getElementById('aabn-indst').getAttribute('aria-label') === 'Åbn indstillinger' && d.getElementById('aabn-indst').title === 'Indstillinger (⌘,)');
})();

// ── Windows: Ctrl-genveje ──
await (async () => {
  const s = side({ platform: 'windows' });
  await vent();
  tjek('V-OPBYG.2: Windows: genvejene står som Ctrl+1–5 (i visningsknappernes værktøjstip)', [...s.d.querySelectorAll('#baand > [data-visning]:not([hidden]) .vk')].map(a => forklaring(a)).join() === 'Ctrl+1,Ctrl+2,Ctrl+3,Ctrl+4,Ctrl+5');
  s.tast('3', { ctrlKey: true, code: 'Digit3' });
  await vent(5);
  tjek('V-OPBYG.2: Windows: Ctrl+3 skifter til Noter', synlige(s.d).join() === 'noter');
  s.tast('4', { ctrlKey: true, code: 'Digit4' });
  await vent(5);
  tjek('V-OPBYG.2: Windows: Ctrl+4 skifter til Sager', synlige(s.d).join() === 'sager');
  s.tast(',', { ctrlKey: true, code: 'Comma' });
  tjek('Windows: Ctrl+, åbner Indstillinger', s.d.getElementById('dlg-indst').hasAttribute('open'));
  tjek('Windows: ingen plads til trafiklys (data-platform)', s.d.documentElement.getAttribute('data-platform') === 'windows');
})();

// ── Adressen bestemmer visningen ved start ──
await (async () => {
  const s = side({ hash: '#sager' });
  await vent();
  tjek('#sager ved start viser Sager', synlige(s.d).join() === 'sager');
  const u = side({ hash: '#findes-ikke' });
  await vent();
  tjek('ukendt adresse viser Maskér', synlige(u.d).join() === 'masker');
})();

// ── Tema ──
await (async () => {
  const s = side();
  const { d } = s;
  await vent();
  tjek('tema: system som standard', d.documentElement.getAttribute('data-tema') === 'system');
  // V-FANER.1: fanen Vis er væk; temaet vælges under tandhjulet (Indstillinger, radiogruppen indst-tema).
  const temaRadio = v => d.querySelector(`input[name="indst-tema"][value="${v}"]`);
  const vaelgTema = v => { temaRadio(v).checked = true; temaRadio(v).dispatchEvent(new s.w.Event('change', { bubbles: true })); };
  d.getElementById('aabn-indst').click();
  vaelgTema('moerk');
  tjek('Mørk: data-tema="moerk"', d.documentElement.getAttribute('data-tema') === 'moerk');
  tjek('Mørk: gemt', s.w.localStorage.getItem('grimnir-tema') === 'moerk');
  tjek('V-FANER.1: temaet i Indstillinger skifter ikke visningen', synlige(d).join() === 'masker' && temaRadio('moerk').checked);
  vaelgTema('lys');
  tjek('Lys: data-tema="lys"', d.documentElement.getAttribute('data-tema') === 'lys');
  vaelgTema('system');
  tjek('System: data-tema="system"', d.documentElement.getAttribute('data-tema') === 'system' && s.w.localStorage.getItem('grimnir-tema') === 'system');
  const igen = side({ lager: { 'grimnir-tema': 'moerk' } });
  tjek('gemt tema sættes, før siden tegnes (tema.js i head)', igen.d.documentElement.getAttribute('data-tema') === 'moerk');
  const skidt = side({ lager: { 'grimnir-tema': 'lilla' } });
  tjek('ukendt gemt tema giver system', skidt.d.documentElement.getAttribute('data-tema') === 'system');
  const tokens = ui('assets/tokens.css');
  tjek('tokens.css: lyst på :root, mørkt på [data-tema="moerk"] og ved system', /:root \{\n  color-scheme: light;/.test(tokens) && /:root\[data-tema="moerk"\] \{\n  color-scheme: dark;/.test(tokens) && /@media \(prefers-color-scheme: dark\) \{\n  :root\[data-tema="system"\]/.test(tokens));
})();

// ── Sprog ──
await (async () => {
  const s = side();
  const { d } = s;
  await vent();
  tjek('sprog: dansk som standard', d.documentElement.lang === 'da' && d.querySelector('.vk[data-visning="masker"] .vk-navn')?.textContent === 'Maskér');
  const bar = d.querySelector('#baand > [data-visning="masker"]');
  // V-FANER.1: fanen Vis er væk; sproget vælges under tandhjulet (Indstillinger, radiogruppen indst-sprog).
  const vaelgSprog = v => { const r = d.querySelector(`input[name="indst-sprog"][value="${v}"]`); r.checked = true; r.dispatchEvent(new s.w.Event('change', { bubbles: true })); };
  vaelgSprog('en');
  tjek('English: lang="en"', d.documentElement.lang === 'en');
  tjek('V-OPBYG.2: English: visningerne (Notes mellem Unmask og Cases)', [...bar.querySelectorAll('.vk .vk-navn')].map(x => x.textContent).join() === 'Mask,Unmask,Notes,Cases,Dictionary');
  tjek('English: kommandoer og grupper', bar.querySelector('[data-kommando="gem-masker"]').textContent.trim() === 'Mask' && [...bar.querySelectorAll('.cap')].slice(0, 2).map(c => c.textContent).join() === 'Text,Edit');
  tjek('English: aria-label og title følger med', d.getElementById('aabn-indst').getAttribute('aria-label') === 'Open settings' && forklaring(bar.querySelector('[data-kommando="analyser"]')) === 'Paste a text first' && forklaring(bar.querySelector('[data-kommando="kvittering"]')) === 'Mask the text first');
  tjek('English: placeholder følger med', d.querySelector('section[data-visning="masker"] input').placeholder === 'Search the findings');
  tjek('English: fodlinjen og kernen', d.getElementById('fod-lokalt').textContent.trim() === 'Only on this machine' && /^Core /.test(d.getElementById('fod-kerne').textContent));
  tjek('English: gemt', s.w.localStorage.getItem('grimnir-sprog') === 'en');
  const igen = side({ lager: { 'grimnir-sprog': 'en' } });
  await vent();
  tjek('gemt sprog bruges ved start', igen.d.documentElement.lang === 'en' && igen.d.querySelector('.vk .vk-navn')?.textContent === 'Mask');
  vaelgSprog('da');
  tjek('tilbage til dansk', d.documentElement.lang === 'da' && bar.querySelector('[data-kommando="gem-masker"]').textContent.trim() === 'Maskér');
})();

// ── Oversættelser og StatusChips i begge sprog ──
await (async () => { for (const sprog of ['da', 'en']) {
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
  tjek(`V-OPBYG.2: ${sprog}: der er StatusChips (én pr. visning, fem)`, chips.length === 5, String(chips.length));
  const daarlige = chips.filter(c => { const sym = c.querySelector('[aria-hidden="true"]'); const ord = c.querySelector('.ord'); return !sym || !sym.textContent.trim() || !ord || ord.textContent.trim().length < 2; });
  tjek(`${sprog}: hver StatusChip har symbol og ord`, daarlige.length === 0, daarlige.map(c => c.outerHTML).join(' '));
  const tomme = [...d.querySelectorAll('[data-t]')].filter(el => !el.textContent.trim());
  tjek(`${sprog}: ingen tomme tekster`, tomme.length === 0, tomme.map(e => e.getAttribute('data-t')).join(', '));
  const unavngivne = [...d.querySelectorAll('button, a[href], input, [role="tab"], [role="treeitem"]')].filter(el => !(el.getAttribute('aria-label') || el.textContent.trim()));
  tjek(`${sprog}: alt, der kan aktiveres, har et navn`, unavngivne.length === 0, unavngivne.map(e => e.outerHTML.slice(0, 80)).join(' | '));
} })();

// ── Kittet: komponenterne ──
await (async () => {
  const { w, d } = side();
  await vent();
  const K = w.Kit;
  tjek('Kit: StatusChip-symbolerne', ['ok', 'warn', 'danger', 'info', 'none'].map(v => K.chip(v, 'x').firstChild.textContent).join('') === '✓!×i–'); // V-KIT.5 (K30): danger er × (før ?)
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
  // V-FANER.2: visningerne er knapper i båndet; piletaster bruges ikke (båndets regel), mellemrum åbner (prøvet i V-FANER.2-blokken).
})();

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
    // V-OPBYG.1: linjetallet som Rusts fil::antal_linjer (før fast 3; analysen sker nu ved hver indsætning, også af andre tekster).
    // V-OPBYG.4 N1: som Rust: en hemmeligheds værdi står ikke i rækkerne; Vis henter den med raekke_vaerdi.
    analyser: a => { const b = beregn(a); return { raekker: b.raekker.map(r => (r.hemmelig ? { ...r, vaerdier: [] } : r)), fejl: b.fejl, advarsler: [], bytes: a.tekst.length, linjer: a.tekst === '' ? 0 : (a.tekst.match(/\r\n|\r|\n/g) || []).length + (/[\r\n]$/.test(a.tekst) ? 0 : 1) }; },
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
      // V-PUDS.1 N4: antal og første linje pr. kode, som Rust svarer (tilbage); den falske Rust tæller, webvisningen ikke.
      const brugt = Object.keys(koder).slice(1);
      const tilbage = brugt.map(k => ({ kode: k, antal: a.tekst.split(k).length - 1, linje: a.tekst.includes(k) ? (a.tekst.slice(0, a.tekst.indexOf(k)).match(/\r\n|\r|\n/g) || []).length + 1 : 0 }));
      return { tekst: t, linjer, koder: brugt, tilbage, advarsler: [{ art: 'ukendt_kode', kode: 'h0099', antal: 1, linje: 1 }, { art: 'ikke_brugt', kode: Object.keys(koder)[0], antal: 1, linje: 0 }] };
    },
    raekke_vaerdi: ({ id }) => { const r = RAEKKER.find(x => x.id === id && x.hemmelig); if (!r) throw { art: 'ukendt_raekke' }; return { id, vaerdier: [...r.vaerdier] }; },
    sag_status: () => ({ poster }),
    sag_nulstil: () => { poster = 0; koder = {}; return { poster: 0 }; },
    menu_sprog: () => null,
    // V-KVIT.1: teksten bygges i Rust; den efterlignede siger kun, hvad den blev bedt om.
    kvittering: ({ fil, sprog }) => `KVITTERING ${sprog} ${fil ? 'fil' : 'tekst'}\n`,
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
await (async () => {
  const js = fs.readdirSync(path.join(repo, 'ui', 'assets')).filter(f => f.endsWith('.js'));
  const medKonsol = js.filter(f => /\bconsole\s*\./.test(ui('assets/' + f)));
  tjek('ingen console.* i ui/assets/*.js', medKonsol.length === 0, medKonsol.join(', '));
  const lager = js.filter(f => /localStorage\s*\.\s*setItem|sessionStorage|indexedDB/.test(ui('assets/' + f)));
  // V-KIT.1: sprogets mekanik (og dermed skrivningen) er flyttet til kittets sprogmotor.js; sprog.js har kun teksterne.
  tjek('kun tema.js og sprogmotor.js skriver til localStorage (ingen sessionStorage/IndexedDB)', JSON.stringify(lager.sort()) === JSON.stringify(['sprogmotor.js', 'tema.js']), lager.join(', '));
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
})();

// ── Maskér: hele forløbet ──
await (async () => {
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
  const tom = sek.querySelector('.tomt');
  tjek('Maskér: tom tilstand tager imod ⌘V (kan få fokus, navn med genvej)', tom.tabIndex === 0 && tom.getAttribute('aria-label') === 'Tom flade: indsæt en log eller et script med ⌘V');
  tjek('Maskér: før indsæt er kun Indsæt aktiv', kommandoAktiv(d, 'masker', 'indsaet') && !kommandoAktiv(d, 'masker', 'analyser') && !kommandoAktiv(d, 'masker', 'gem-masker') && !kommandoAktiv(d, 'masker', 'kopier') && forklaring(knapI(d, 'masker', 'analyser')) === 'Indsæt en tekst først');
  tjek('menu_sprog kaldes ved start med da', s.kald.some(k => k[0] === 'menu_sprog' && k[1].sprog === 'da'));

  // For stor tekst afvises med besked; intet indsat.
  const stor = 'x'.repeat(5 * 1024 * 1024 + 1);
  tom.focus();
  indsaet(w, tom, stor);
  tjek('over 5 MB: afvist med banner, intet indsat', G.M.st.tekst === null && /Teksten er 5,0 MB\. Grimnir tager højst 5 MB/.test(sek.textContent) && sek.querySelector('.ban.danger'));
  tjek('utf8Laengde tæller bytes (æ = 2, € = 3, 😀 = 4)', G.utf8Laengde('aæ€😀') === 10 && G.MAKS_BYTES === 5242880);

  // ⌘V: teksten gemmes bytepræcist og vises i et felt, der ikke kan redigeres.
  const e = indsaet(w, tom, TEKST);
  tjek('⌘V: teksten er den indsatte, med CRLF', G.M.st.tekst === TEKST && (G.M.st.tekst.match(/\r\n/g) || []).length === 3 && e.defaultPrevented);
  const pre = sek.querySelector('pre.tekst');
  tjek('⌘V: vises i <pre>, ikke redigerbar, med CRLF', pre && pre.textContent === TEKST && !pre.isContentEditable && pre.tabIndex === 0 && !sek.querySelector('textarea'));
  tjek('V-OPBYG.1 N3: efter indsæt går analysen i gang med det samme; Analysér igen og Maskér venter, mens Grimnir arbejder', s.kald.filter(k => k[0] === 'analyser').length === 1 && !kommandoAktiv(d, 'masker', 'analyser') && !kommandoAktiv(d, 'masker', 'gem-masker') && forklaring(knapI(d, 'masker', 'gem-masker')) === 'Vent, Grimnir arbejder');
  // Indsæt i søgefeltet er almindeligt indsæt.
  const soeg = sek.querySelector('.vl input[type="search"]');
  const e2 = indsaet(w, soeg, 'noget andet');
  tjek('indsæt i søgefeltet tages ikke af Maskér', !e2.defaultPrevented && G.M.st.tekst === TEKST);

  // V-OPBYG.1 N3: analysen skete ved indsætningen (før: ⌘↵ første gang).
  await vent(5);
  const ak = s.kald.filter(k => k[0] === 'analyser');
  tjek('indsæt: analyser med teksten og kernens standard (uden ⌘↵)', ak.length === 1 && ak[0][1].tekst === TEKST && ak[0][1].fravalgt === null && ak[0][1].rettelser === null);
  let r = fundRaekker(d);
  tjek('tabellen: én række pr. enhed (5)', r.length === 5, String(r.length));
  tjek('tabellen: kolonnerne Type, Fundet værdi, Erstatning, Antal, Status, Ordbog', [...sek.querySelectorAll('.fundtabel th')].map(t => t.textContent).join('|') === '✓|Type|Fundet værdi|Erstatning|Antal|Status|Ordbog');
  tjek('Tjek selv og Version er slået fra; resten til', r.map(x => x.querySelector('input[type="checkbox"]').checked).join() === 'true,true,true,false,false');
  // V-OPBYG.1 N2 (D27): status er resultatet (Maskeres, Bevares, Tjek selv med advarslens !); sikkerheden står dæmpet ved typen.
  tjek('V-OPBYG.1: StatusChips: Maskeres, Tjek selv (!) og Bevares med symbol', r.map(x => x.querySelector('.chip').textContent).join('|') === '✓Maskeres|✓Maskeres|✓Maskeres|!Tjek selv|–Bevares', r.map(x => x.querySelector('.chip').textContent).join('|'));
  tjek('V-OPBYG.1: sikkerheden står dæmpet ved typen: Sikker, Sandsynlig, Sikker, Tjek selv, Version', r.map(x => x.querySelector('.typecelle .sikkerhed').textContent).join('|') === 'Sikker|Sandsynlig|Sikker|Tjek selv|Version');
  tjek('V-OPBYG.1: en værdi, der bevares, har "bevares som den er" i stedet for en kode', r.slice(3).every(x => !x.querySelector('input[data-felt="kode"]') && x.querySelector('.erstatning.bevares').textContent === 'bevares som den er') && r.slice(0, 3).every(x => x.querySelector('input[data-felt="kode"]')));
  {
    const ban = sek.querySelector('.arbejde .bannere .opsummering');
    tjek('V-OPBYG.1 N2: én besked efter analysen: "5 værdier fundet · 3 maskeres · 2 bevares", hvad 1 usikkert kræver, og hvad brugeren gør nu', ban && ban.classList.contains('warn') && ban.querySelector('.ops-hoved').textContent === '5 værdier fundet · 3 maskeres · 2 bevares' && ban.textContent.includes('1 kræver, at du selv tager stilling.') && ban.textContent.includes('Sæt flueben ved det, der skal maskeres, og tryk Maskér.') && sek.querySelectorAll('.arbejde .bannere .ban').length === 1, ban && ban.textContent);
  }
  tjek('hemmeligheder vises som prikker som standard', !sek.querySelector('.fundtabel').textContent.includes(HEMMELIG) && !sek.querySelector('.fundtabel').textContent.includes('Zq8Xv2Lm9Pw4') && raekkeMed(d, 45).querySelector('.prikker'));
  tjek('hemmelighedens afkrydsning nævner ikke værdien', !raekkeMed(d, 45).querySelector('input[type="checkbox"]').getAttribute('aria-label').includes(HEMMELIG));
  raekkeMed(d, 45).querySelector('button.mini').click();
  // V-OPBYG.4 N1: Vis henter værdien fra Rust (raekke_vaerdi); der ventes på rækken, ikke et fast antal ms.
  await ventTil(w, () => raekkeMed(d, 45) && raekkeMed(d, 45).textContent.includes(HEMMELIG));
  tjek('Vis viser hemmeligheden i rækken', raekkeMed(d, 45).textContent.includes(HEMMELIG) && raekkeMed(d, 45).querySelector('button.mini').textContent === 'Skjul');
  raekkeMed(d, 45).querySelector('button.mini').click();
  tjek('Skjul skjuler den igen', !raekkeMed(d, 45).textContent.includes(HEMMELIG));
  const trae = n => d.querySelector(`.navdel[data-visning="masker"] [data-punkt="${n}"] .ant`).textContent;
  tjek('V-OPBYG.1: træets antal: alle 5, maskeres 3, bevares 2, kræver gennemgang 1, hemmeligheder 2, kendt fra sagen 0', [trae('alle'), trae('masker'), trae('bevar'), trae('tjek'), trae('hemmelig'), trae('seneste')].join() === '5,3,2,1,2,0');
  tjek('V-OPBYG.1: filtrene i fast rækkefølge: Alle fund, Maskeres, Bevares, Kræver gennemgang, Hemmeligheder, Kendt fra sagen', [...d.querySelectorAll('.navdel[data-visning="masker"] [data-punkt] > span:not(.ant)')].map(x => x.textContent).filter(Boolean).join('|') === 'Denne tekst|Alle fund|Maskeres|Bevares|Kræver gennemgang|Hemmeligheder|Kendt fra sagen', [...d.querySelectorAll('.navdel[data-visning="masker"] [data-punkt] > span:not(.ant)')].map(x => x.textContent).join('|'));
  tjek('V-OPBYG.2 N4: fodlinjen som skitsen: værdier · maskeres · bevares', d.getElementById('fod-venstre').textContent === '5 værdier · 3 maskeres · 2 bevares', d.getElementById('fod-venstre').textContent);
  tjek('værktøjslinjen: "1 venter på dig"', sek.querySelector('.vl .chip').textContent === '!1 venter på dig');
  tjek('søgefeltet er aktivt efter analysen', !soeg.disabled);

  // Filtrene i træet og søgning
  const traeKnap = n => d.querySelector(`.navdel[data-visning="masker"] [data-punkt="${n}"]`);
  traeKnap('hemmelig').click();
  tjek('filter Hemmeligheder: 2 rækker', fundRaekker(d).length === 2 && sek.querySelector('.fl span').textContent === 'Hemmeligheder');
  traeKnap('masker').click();
  tjek('V-OPBYG.1: filter Maskeres: de 3 afkrydsede', fundRaekker(d).length === 3 && fundRaekker(d).every(x => x.querySelector('input[type="checkbox"]').checked) && sek.querySelector('.fl span').textContent === 'Maskeres');
  traeKnap('bevar').click();
  tjek('V-OPBYG.1: filter Bevares: de 2, der ikke er afkrydset', fundRaekker(d).length === 2 && fundRaekker(d).every(x => !x.querySelector('input[type="checkbox"]').checked));
  traeKnap('tjek').click();
  tjek('filter Kræver gennemgang: 1 række (Tjek selv)', fundRaekker(d).length === 1 && fundRaekker(d)[0].getAttribute('data-id') === '67');
  traeKnap('seneste').click();
  // V-MANUEL.2: filteret hedder "Kendt fra sagen", og den tomme tabel siger, hvad det er (før: "Ingen rækker passer til filteret.").
  tjek('filter Kendt fra sagen: ingen (sagen er ny)', fundRaekker(d).length === 0 && sek.textContent.includes('Ingen af fundene i denne tekst var kendt fra sagen i forvejen.'));
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
  tjek('V-OPBYG.1: slå fra: rækken bliver nedtonet straks, status Bevares, og "bevares som den er" står i stedet for koden', raekkeMed(d, 6).classList.contains('fra') && !raekkeMed(d, 6).querySelector('input[data-felt="kode"]') && raekkeMed(d, 6).querySelector('.erstatning.bevares').textContent === 'bevares som den er' && raekkeMed(d, 6).querySelector('.chip').textContent === '–Bevares');
  await vent(450);
  const ak2 = s.kald.filter(k => k[0] === 'analyser');
  const sidste = ak2[ak2.length - 1][1];
  tjek('ny analyse med fravalg og rettelse (én, efter 350 ms)', ak2.length === 2 && JSON.stringify(sidste.fravalgt.sort((a, b) => a - b)) === '[6,67,70]' && JSON.stringify(sidste.rettelser) === '[{"id":24,"kode":"kunde01"}]', JSON.stringify(sidste));
  tjek('rettelsen står i rækken', raekkeMed(d, 24).querySelector('input[data-felt="kode"]').value === 'kunde01');
  tjek('fodlinjen følger valget', d.getElementById('fod-venstre').textContent === '5 værdier · 2 maskeres · 3 bevares', d.getElementById('fod-venstre').textContent);

  // ⌘↵: Maskér (V-OPBYG.1: analysen skete ved indsætningen, så første ⌘↵ maskerer)
  s.tast('Enter', { metaKey: true });
  await vent(5);
  const gk = s.kald.filter(k => k[0] === 'gem_og_masker');
  tjek('⌘↵: Maskér (gem_og_masker) med valgene', gk.length === 1 && JSON.stringify(gk[0][1].fravalgt.sort((a, b) => a - b)) === '[6,67,70]' && gk[0][1].rettelser[0].kode === 'kunde01' && gk[0][1].tekst === TEKST);
  const forventet = TEKST.split('bruger060').join('kunde01').split(HEMMELIG).join('GRIMNIR_SECRET_0001');
  tjek('resultatet vises (efter), med CRLF', G.M.st.resultat.maskeret === forventet && pre.textContent === forventet && knapI(d, 'masker', 'foer-efter').getAttribute('aria-pressed') === 'true');
  tjek('lækagetjekket: grønt banner ved 0 rester', sek.querySelector('.arbejde .bannere .ban.ok') && sek.querySelector('.arbejde .bannere').textContent.includes('Lækagetjekket fandt ingen'));
  tjek('Kopiér og Før og efter er aktive', kommandoAktiv(d, 'masker', 'kopier') && kommandoAktiv(d, 'masker', 'foer-efter') && knapI(d, 'masker', 'kopier').title === 'Genvej: ⇧⌘C');
  tjek('V-OPBYG.1: titellinjen: Midlertidig sag · ikke gemt under et navn', d.getElementById('sag-knap').textContent === 'Midlertidig sag · ikke gemt under et navn' && !d.getElementById('sag-knap').hidden && d.getElementById('sag').hidden);
  {
    const ban = sek.querySelector('.arbejde .bannere .opsummering');
    tjek('V-OPBYG.1 N2: én besked efter maskeringen: "2 værdier maskeret · 3 bevaret" med lækagetjekkets udfald og Gem som sag… (midlertidig sag)', ban && ban.classList.contains('ok') && ban.querySelector('.ops-hoved').textContent === '2 værdier maskeret · 3 bevaret' && ban.textContent.includes('Lækagetjekket fandt ingen') && ban.textContent.includes('giv sagen et navn, så du kan demaskere svaret senere') && ban.querySelector('button')?.textContent === 'Gem som sag…' && sek.querySelectorAll('.arbejde .bannere .ban').length === 1, ban && ban.textContent);
    tjek('V-OPBYG.1 N2: status efter maskeringen: Maskeret og Bevaret', fundRaekker(d).map(x => x.querySelector('.chip').textContent).join('|') === '–Bevaret|✓Maskeret|✓Maskeret|–Bevaret|–Bevaret', fundRaekker(d).map(x => x.querySelector('.chip').textContent).join('|'));
    tjek('V-OPBYG.1 N2: filtrene hedder Maskerede og Bevarede efter maskeringen', d.querySelector('.navdel[data-visning="masker"] [data-punkt="masker"] > span').textContent === 'Maskerede' && d.querySelector('.navdel[data-visning="masker"] [data-punkt="bevar"] > span').textContent === 'Bevarede');
  }
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
  // V-KVIT.1: Kopiér kvittering er aktiv, når der er et maskeret resultat; teksten kommer fra Rust og kopieres.
  const kv = knapI(d, 'masker', 'kvittering');
  tjek('V-KVIT.1: Kopiér kvittering er aktiv efter maskeringen, i gruppen Resultat', kommandoAktiv(d, 'masker', 'kvittering') && kv.textContent.trim() === 'Kopiér kvittering' && !kv.title && kv.closest('.kn').textContent.includes('Gem maskeret fil') && kv.previousElementSibling === plads(knapI(d, 'masker', 'gem-fil')), kv.closest('.kn').outerHTML.slice(0, 300));
  kv.click();
  await vent(5);
  const kvKald = s.kald.filter(k => k[0] === 'kvittering');
  tjek('V-KVIT.1: kvitteringen hentes fra Rust (indsat tekst: fil false) på UI-sproget', kvKald.length === 1 && JSON.stringify(kvKald[0][1]) === '{"fil":false,"sprog":"da"}', JSON.stringify(kvKald));
  tjek('V-KVIT.1: kvitteringen kopieres, som Rust gav den', skrevet.length === 3 && skrevet[2] === 'KVITTERING da tekst\n', JSON.stringify(skrevet[2]));
  tjek('V-KVIT.1: bekræftelsen står i statuslinjen', sek.querySelector('.besked').textContent === 'Kvitteringen er kopieret. Den indeholder ingen originale værdier.' && sek.querySelector('.besked').getAttribute('role') === 'status');
  tjek('V-KVIT.1: kvitteringen meldes ikke til Rust (udklip_kopieret)', !s.kald.some(k => k[0] === 'udklip_kopieret'));
  tjek('V-KVIT.1: resultatet er urørt (Kopiér er stadig aktiv, den maskerede tekst vises)', kommandoAktiv(d, 'masker', 'kopier') && G.M.st.resultat.maskeret === forventet && pre.textContent === forventet);
  // Ændres et valg efter maskeringen, forsvinder resultatet.
  const cb2 = raekkeMed(d, 45).querySelector('input[type="checkbox"]');
  cb2.checked = false;
  cb2.dispatchEvent(new w.Event('change', { bubbles: true }));
  tjek('ændret valg efter maskering: resultat væk, Kopiér nedtonet, besked', !G.M.st.resultat && !kommandoAktiv(d, 'masker', 'kopier') && sek.textContent.includes('Valgene er ændret'));
  tjek('V-KVIT.1: ændret valg efter maskering: Kopiér kvittering er nedtonet igen, med forklaring', !kommandoAktiv(d, 'masker', 'kvittering') && forklaring(knapI(d, 'masker', 'kvittering')) === 'Maskér teksten først');
  knapI(d, 'masker', 'kvittering').click();
  await vent(5);
  tjek('V-KVIT.1: en nedtonet Kopiér kvittering gør intet', s.kald.filter(k => k[0] === 'kvittering').length === 1 && skrevet.length === 3);
  await vent(450);

  // Demaskér med den sag, der nu findes
  s.w.location.hash = 'demasker';
  await vent(5);
  const dsek = d.querySelector('section[data-visning="demasker"]');
  tjek('Demaskér: tom tilstand, når sagen har poster', dsek.querySelector('.tomt p').textContent === 'Har du fået svar fra support eller en chatbot, sætter Grimnir de rigtige værdier tilbage med koderne i den midlertidige sag.');
  const svarTekst = 'Prøv kunde01 på GRIMNIR_SECRET_0001\r\nog h0099\r\n';
  indsaet(w, dsek.querySelector('.tomt'), svarTekst);
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
  d.querySelector('#dlg-sag [data-svar="luk"]').click();
  tjek('Luk nulstiller ikke', !s.kald.some(k => k[0] === 'sag_nulstil') && !d.getElementById('sag-knap').hidden);
  d.getElementById('sag-knap').click();
  d.getElementById('sag-nulstil').click();
  await vent(5);
  tjek('V-OPBYG.1: Nulstil: sagen er tom, titellinjen siger Midlertidig sag · ikke gemt under et navn', s.kald.some(k => k[0] === 'sag_nulstil') && !d.getElementById('sag-knap').hidden && d.getElementById('sag-knap').textContent === 'Midlertidig sag · ikke gemt under et navn' && d.getElementById('sagdel-antal').textContent === '0' && !d.getElementById('dlg-sag').hasAttribute('open'));
  tjek('V-OPBYG.1 N4: efter Nulstil er Gemte erstatninger slået fra igen og siger hvorfor (0 erstatninger)', d.getElementById('sagdel-erst').getAttribute('aria-disabled') === 'true' && d.getElementById('sagdel-erst').title === 'Sagen har ingen gemte erstatninger endnu');
  tjek('Nulstil: Demaskér er nedtonet med forklaring', !kommandoAktiv(d, 'demasker', 'demasker') && forklaring(knapI(d, 'demasker', 'demasker')) === 'Maskér en tekst i denne session først');

  tjek('ingen konsoludskrift under hele forløbet', logget === 0, String(logget));
  const noegler = Object.keys(w.localStorage);
  tjek('localStorage har kun tema og sprog (her: intet valgt)', noegler.every(k => ['grimnir-tema', 'grimnir-sprog'].includes(k)), noegler.join());
  tjek('teksten og hemmeligheden står ikke i localStorage', !JSON.stringify(Object.entries(w.localStorage)).includes(HEMMELIG));

  // Sprogskift: tabellens tekster og programmenuen følger med
  s.w.location.hash = 'masker';
  await vent(5);
  tjek('Nulstil: Maskér beholder teksten, men analysen er væk (koderne gælder ikke længere)', G.M.st.tekst === TEKST && !G.M.st.analyse && fundRaekker(d).length === 0);
  w.Sprog.saet('en'); // V-FANER.1: før knappen English på fanen Vis (den kaldte det samme)
  await vent(5);
  s.tast('Enter', { metaKey: true });
  await vent(5);
  tjek('English: menu_sprog med en', s.kald.some(k => k[0] === 'menu_sprog' && k[1].sprog === 'en'));
  tjek('English: typer og status i tabellen', raekkeMed(d, 24).textContent.includes('User') && raekkeMed(d, 6).textContent.includes('Certain'));
  tjek('English: localStorage har kun tema og sprog', Object.keys(w.localStorage).every(k => ['grimnir-tema', 'grimnir-sprog'].includes(k)) && w.localStorage.getItem('grimnir-sprog') === 'en');
})();

// ── Maskér: rester, afvist rettelse og Windows-genveje ──
await (async () => {
  const skrevet = [];
  const s = side({ platform: 'windows', rust: falskRust({ rester: [{ art: 'nyt_fund', type_: 'hemmelighed', tekst: 'Hemmelig42', antal: 2, linje: 2 }], afvis: 'kollision01' }), foer: w => Object.defineProperty(w.navigator, 'clipboard', { value: { writeText: async t => { skrevet.push(t); } } }) });
  const { d, w } = s;
  await vent(5);
  const sek = d.querySelector('section[data-visning="masker"]');
  indsaet(w, sek.querySelector('.tomt'), TEKST);
  s.tast('Enter', { ctrlKey: true });
  await vent(5);
  tjek('Windows: Ctrl+↵ analyserer', s.kald.some(k => k[0] === 'analyser') && knapI(d, 'masker', 'analyser').getAttribute('aria-keyshortcuts') === null);
  // Afvist rettelse: rækken får fejlen, intet gemmes.
  const kode = raekkeMed(d, 24).querySelector('input[data-felt="kode"]');
  kode.value = 'kollision01';
  kode.dispatchEvent(new w.Event('change', { bubbles: true }));
  knapI(d, 'masker', 'gem-masker').click();
  await vent(5);
  tjek('afvist rettelse: fejlbanner, intet resultat, ingen sag', sek.querySelector('.ban.danger') && sek.textContent.includes('1 rettelse kan ikke bruges, så intet er gemt. Se rækken med rødt.') && !s.w.GrimnirMaskering.M.st.resultat && d.getElementById('sagdel-antal').textContent === '0');
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
})();

// ── Demaskér med tom sag ──
await (async () => {
  const s = side({ hash: '#demasker', rust: falskRust() });
  const { d, w } = s;
  await vent(5);
  const dsek = d.querySelector('section[data-visning="demasker"]');
  tjek('tom sag: tom tilstand siger, at der først skal maskeres', dsek.querySelector('.tomt p').textContent === 'Der er intet at demaskere endnu: maskér først en tekst i denne session, så kender Grimnir koderne.');
  indsaet(w, dsek.querySelector('.tomt'), 'h0001 og user0001\n');
  tjek('tom sag: svaret indsat, men Demaskér nedtonet med forklaring og banner', !kommandoAktiv(d, 'demasker', 'demasker') && dsek.querySelector('.ban.info') && dsek.textContent.includes('Sagen er tom'));
  s.tast('Enter', { metaKey: true });
  await vent(5);
  tjek('tom sag: ⌘↵ kalder ikke demasker', !s.kald.some(k => k[0] === 'demasker'));
})();

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
  const indholdKald = [];
  return {
    ...r,
    st: { db, get aaben() { return aaben; }, set konflikt(v) { konflikt = v; }, indholdKald },
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
    // V-MANUEL.2 N1: sagens poster i sider som maskering::sag_indhold (type, søgning, viste hemmeligheder, antal).
    sag_indhold: ({ id, valg }) => {
      const p = id ? post(id) : null;
      if (id && !p) throw sagfejl('mangler_fil');
      if (p && p.fejl) throw { art: 'sag', fejl: p.fejl };
      const den = id || aaben;
      const alle = indholdPoster(den ? post(den).poster : r.sag_status().poster);
      const vist = new Set(valg.vist || []), q = (valg.soeg || '').trim().toLowerCase();
      const typer = ['vaert', 'bruger', 'hemmelighed', 'ipv4_egen'].map(t => ({ type: t, antal: alle.filter(x => x.type === t).length })).filter(x => x.antal);
      const f = alle.filter(x => (!valg.type || x.type === valg.type)
        && (!q || x.kode.toLowerCase().includes(q) || x.aliaser.some(a => a.toLowerCase().includes(q)) || ((!x.hemmelig || vist.has(x.nr)) && x.vaerdi.toLowerCase().includes(q))));
      indholdKald.push({ id, valg });
      return {
        id: den, navn: den ? post(den).navn : null, aaben: !id || id === aaben, udloeb: den ? post(den).udloeb : null,
        i_alt: alle.length, typer, fundet: f.length,
        raekker: f.slice(0, valg.antal).map(x => ({ ...x, vaerdi: x.hemmelig && !vist.has(x.nr) ? null : x.vaerdi })),
      };
    },
  };
}
/* V-MANUEL.2: en sags poster (opdigtede): maskiner, brugere, hemmeligheder og adresser på skift, sorteret efter type. */
function indholdPoster(n) {
  const TYPER = ['vaert', 'bruger', 'hemmelighed', 'ipv4_egen'];
  const ud = Array.from({ length: n }, (_, i) => {
    const t = TYPER[i % 4], k = String(Math.floor(i / 4) + 1).padStart(4, '0');
    const [kode, vaerdi] = { vaert: [`h${k}`, `srv-opdigtet-${k}`], bruger: [`user${k}`, `bruger-${k}`], hemmelighed: [`GRIMNIR_SECRET_${k}`, `Hemmelig-${k}!`], ipv4_egen: [`198.18.0.${(i % 250) + 1}`, `10.20.30.${(i % 250) + 1}`] }[t];
    return { nr: i, type: t, kode, vaerdi, hemmelig: t === 'hemmelighed', aliaser: i === 0 ? ['h9001'] : [], rettet: i === 0 };
  });
  return ud.sort((a, b) => TYPER.indexOf(a.type) - TYPER.indexOf(b.type));
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
// V-KITBRUG.2: Kit.bekraeft fjerner sin dialog ved lukning; en dialog, der ikke er der, er ikke åben.
const aaben = (d, id) => { const e = d.getElementById(id); return Boolean(e && e.hasAttribute('open')); };

// ── Statisk: hver sagsfejl fra Rust har en tekst ──
await (async () => {
  const rs = fs.readFileSync(path.join(repo, 'src-tauri', 'src', 'sager.rs'), 'utf8');
  const enumKrop = rs.slice(rs.indexOf('pub enum SagFejl')).split('\n}\n')[0];
  const varianter = [...enumKrop.matchAll(/^    ([A-Z][A-Za-z]+)\b/gm)].map(m => m[1].replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase());
  const { w } = side();
  const T = w.Sprog.TEKST;
  const mangler = [...varianter, 'ingen_arkiv'].filter(v => !('sagfejl_' + v in T.da && 'sagfejl_' + v in T.en));
  tjek(`sprog: hver SagFejl i sager.rs har en tekst (${varianter.length})`, varianter.length >= 10 && mangler.length === 0, mangler.join(', ') + ' | ' + varianter.join(','));
  tjek('app.css: fuldskærm fjerner trafiklysenes plads', /\[data-platform="macos"\]\[data-fuldskaerm\] \.titel \{ padding-left: var\(--space-3\); \}/.test(ui('assets/app.css')));
  tjek('Maskér: en række med flere stavemåder kan rettes (intet readOnly)', !/readOnly/.test(ui('assets/maskering.js')));
})();

// ── Sager: ny sag fra en midlertidig sag med poster, titellinjen, luk sag ──
await (async () => {
  const rust = falskSagRust();
  const s = side({ hash: '#masker', rust });
  const { d, w } = s;
  await vent(5);
  const sagKnap = d.getElementById('sag-knap');
  tjek('V-OPBYG.1: titellinje: "Midlertidig sag · ikke gemt under et navn" ved en tom midlertidig sag', d.getElementById('sag').hidden && !sagKnap.hidden && sagKnap.textContent === 'Midlertidig sag · ikke gemt under et navn');
  const sek = d.querySelector('section[data-visning="masker"]');
  indsaet(w, sek.querySelector('.tomt'), TEKST);
  await vent(5); // V-OPBYG.1 N3: analysen sker ved indsætning (før ⌘↵ første gang)
  s.tast('Enter', { metaKey: true }); await vent(5);
  tjek('V-OPBYG.1: titellinje: "Midlertidig sag · ikke gemt under et navn" efter maskering (antallet i aria-label og i venstre side)', !sagKnap.hidden && sagKnap.textContent === 'Midlertidig sag · ikke gemt under et navn' && d.getElementById('sagdel-antal').textContent === '3' && sagKnap.getAttribute('aria-label') === 'Midlertidig sag, 3 værdier: gem som sag eller nulstil');
  klik(w, sagKnap);
  tjek('titellinje: dialogen tilbyder Gem som sag og Nulstil', aaben(d, 'dlg-sag') && !d.getElementById('sag-gem-som').hidden && !d.getElementById('sag-nulstil').hidden && d.getElementById('sag-luk').hidden && d.getElementById('dlg-sag-p').textContent.includes('3 værdier'));
  klik(w, d.getElementById('sag-gem-som'));
  tjek('Gem som sag: dialogen Ny sag åbner og nævner de 3 værdier', aaben(d, 'dlg-ny-sag') && !aaben(d, 'dlg-sag') && d.querySelector('#dlg-ny-sag .modal-tekst').textContent.includes('3 værdier') && d.activeElement === d.getElementById('ny-sag-navn'));
  klik(w, d.getElementById('ny-sag-opret')); await vent(5);
  tjek('Ny sag: tomt navn afvises i dialogen, intet kald', d.getElementById('dlg-ny-sag-fejl').textContent === 'Skriv et navn.' && !s.kald.some(k => k[0] === 'sag_ny'));
  skriv(w, d.getElementById('ny-sag-navn'), '  Supportsag 0042 ');
  d.getElementById('ny-sag-udloeb').value = '2027-01-31';
  d.getElementById('ny-sag-navn').dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  await vent(10);
  const nyKald = s.kald.find(k => k[0] === 'sag_ny');
  tjek('Ny sag: Enter opretter med navn og udløb', nyKald && nyKald[1].navn === 'Supportsag 0042' && nyKald[1].udloeb === '2027-01-31' && !aaben(d, 'dlg-ny-sag'));
  tjek('V-OPBYG.1: titellinje: "Sag: «Supportsag 0042» · gemmes automatisk"', sagKnap.textContent === 'Sag: «Supportsag 0042» · gemmes automatisk' && sagKnap.getAttribute('aria-label') === 'Sag Supportsag 0042, 3 værdier: skift eller luk sagen');
  tjek('Ny sag: resultatet i Maskér bliver stående (sagen er den samme)', Boolean(w.GrimnirMaskering.M.st.resultat));
  // Gem og maskér i den navngivne sag; konflikt.
  rust.st.konflikt = true;
  indsaet(w, sek.querySelector('pre.tekst'), TEKST);
  await vent(5); // V-OPBYG.1 N3: analysen sker ved indsætning (før ⌘↵ første gang)
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
  tjek('V-OPBYG.1: Luk sag: titellinjen er tilbage på "Midlertidig sag · ikke gemt under et navn"', s.kald.some(k => k[0] === 'sag_luk') && d.getElementById('sag').hidden && sagKnap.textContent === 'Midlertidig sag · ikke gemt under et navn');
})();

// ── Sager: liste, status, træ, søgning, åbn, omdøb, udløb, slet, kan ikke åbnes ──
await (async () => {
  const rust = falskSagRust({ sager: SAGER() });
  const s = side({ hash: '#sager', rust });
  const { d, w } = s;
  await vent(10);
  const sek = d.querySelector('section[data-visning="sager"]');
  const r = sagRaekker(d);
  tjek('Sager: alle fem sager i listen, tom tilstand skjult', r.length === 5 && sek.querySelector('.tomt').hidden);
  const hoved = [...sek.querySelectorAll('.sagtabel thead th')].map(t => t.textContent);
  tjek('V-OPBYG.2 N1: Sager: kolonnerne Navn, Erstatninger, Noter, Oprettet, Sidst brugt, Udløber, Status', JSON.stringify(hoved) === JSON.stringify(['Navn', 'Erstatninger', 'Noter', 'Oprettet', 'Sidst brugt', 'Udløber', 'Status']), JSON.stringify(hoved));
  const chipTekst = id => sagRaekke(d, id).querySelector('.chip').textContent;
  tjek('Sager: StatusChip Åben, Udløber snart, Udløbet, Kan ikke åbnes', chipTekst(hexId(1)) === '✓Åben' && chipTekst(hexId(2)) === '!Udløber snart' && chipTekst(hexId(3)) === '×Udløbet' && chipTekst(hexId(4)) === '×Kan ikke åbnes' && chipTekst(hexId(5)) === '✓Åben', [1, 2, 3, 4, 5].map(i => chipTekst(hexId(i))).join(','));
  tjek('Sager: "Kan ikke åbnes" har årsagen i title og et navn ud fra id', sagRaekke(d, hexId(4)).querySelector('.chip').title === 'Sagen kan ikke åbnes: nøglen mangler i nøgleringen' && sagRaekke(d, hexId(4)).textContent.startsWith('Sag 44444444…'));
  tjek('Sager: Udløber viser Aldrig eller datoen', sagRaekke(d, hexId(1)).children[5].textContent === 'Aldrig' && /\d/.test(sagRaekke(d, hexId(2)).children[5].textContent));
  const ant = id => d.querySelector(`.navdel[data-visning="sager"] [data-punkt="${id}"] .ant`).textContent;
  tjek('Sager: træet tæller Alle 5, Udløber snart 2, Ingen udløb 1', ant('alle') === '5' && ant('udloeber') === '2' && ant('uden-udloeb') === '1' && d.querySelector('.navdel[data-visning="sager"] [data-punkt="uden-udloeb"]').textContent.includes('Ingen udløb'));
  tjek('V-OPBYG.2 N4: Sager: chippen siger 5 sager, fodlinjen sagens navn og gemte erstatninger', sek.querySelector('.vl .chip').textContent === 'i5 sager' && d.getElementById('fod-venstre').textContent === 'Midlertidig sag · 0 gemte erstatninger', d.getElementById('fod-venstre').textContent);
  w.Grimnir.dele.sager.trae.vaelg('udloeber'); await vent(5);
  tjek('træ: Udløber snart viser to', sagRaekker(d).length === 2);
  w.Grimnir.dele.sager.trae.vaelg('alle'); await vent(5);
  const soeg = sek.querySelector('.vl input[type="search"]');
  skriv(w, soeg, 'backup');
  tjek('søgning på navn', sagRaekker(d).length === 1 && sagRaekker(d)[0].dataset.id === hexId(2));
  skriv(w, soeg, '');
  tjek('Sager: uden valg er Åbn, Omdøb, Udløb og Slet nedtonet med forklaring; Ny sag aktiv', kommandoAktiv(d, 'sager', 'ny-sag') && ['aabn-i-masker', 'omdoeb', 'udloeb', 'slet-sag'].every(id => !kommandoAktiv(d, 'sager', id) && forklaring(knapI(d, 'sager', id)) === 'Vælg en sag i listen først'));
  tjek('Sager: Eksportér og Importér er stadig nedtonet (v2)', !kommandoAktiv(d, 'sager', 'eksporter') && !kommandoAktiv(d, 'sager', 'importer'));
  // Kan ikke åbnes: kun Slet er aktiv.
  klik(w, sagRaekke(d, hexId(4)).children[0]);
  tjek('Kan ikke åbnes: Åbn, Omdøb og Udløb nedtonet med årsag, Slet aktiv', ['aabn-i-masker', 'omdoeb', 'udloeb'].every(id => !kommandoAktiv(d, 'sager', id) && forklaring(knapI(d, 'sager', id)) === 'Sagen kan ikke åbnes: nøglen mangler i nøgleringen') && kommandoAktiv(d, 'sager', 'slet-sag'));
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
  tjek('Udløb: dialogen har datoen og nævner sagen', aaben(d, 'dlg-udloeb') && d.getElementById('udloeb-dato').value === datoOm(3) && !d.getElementById('udloeb-ingen').checked && d.querySelector('#dlg-udloeb .modal-tekst').textContent === 'Sagen «Backup-script nat».');
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
  tjek('Udløb: uden dato og uden flueben afvises i dialogen', d.getElementById('dlg-udloeb-fejl').textContent === 'Vælg en dato, eller sæt flueben ved Ingen udløb.' && aaben(d, 'dlg-udloeb'));
  d.getElementById('udloeb-dato').value = datoOm(5);
  klik(w, d.getElementById('udloeb-ok')); await vent(10);
  tjek('Udløb: en dato inden 7 dage giver Udløber snart', s.kald.some(k => k[0] === 'sag_udloeb' && k[1].id === hexId(1) && k[1].udloeb === datoOm(5)) && chipTekst(hexId(1)) === '!Udløber snart');
  // Slet med bekræftelse
  klik(w, sagRaekke(d, hexId(3)).children[0]);
  klik(w, knapI(d, 'sager', 'slet-sag'));
  tjek('Slet: bekræftelsen nævner sagens navn', aaben(d, 'dlg-slet') && d.querySelector('#dlg-slet .modal-tekst').textContent.startsWith('Sagen «SQL-job fejler» og dens nøgle i nøgleringen slettes'));
  klik(w, d.querySelector('#dlg-slet [data-svar="nej"]'));
  tjek('Slet: Annullér sletter intet', !aaben(d, 'dlg-slet') && !s.kald.some(k => k[0] === 'sag_slet') && sagRaekker(d).length === 5);
  klik(w, knapI(d, 'sager', 'slet-sag'));
  klik(w, d.querySelector('#dlg-slet [data-svar="ja"]')); await vent(10);
  tjek('Slet: sag_slet, og sagen er væk', s.kald.some(k => k[0] === 'sag_slet' && k[1].id === hexId(3)) && !sagRaekke(d, hexId(3)) && sagRaekker(d).length === 4);
  // Åbn i Maskér (dobbeltklik og kommandoen)
  klik(w, sagRaekke(d, hexId(5)).children[0]);
  klik(w, knapI(d, 'sager', 'aabn-i-masker')); await vent(10);
  tjek('Åbn i Maskér: sag_aabn, Maskér vises, titellinjen har sagen', s.kald.some(k => k[0] === 'sag_aabn' && k[1].id === hexId(5)) && synlige(d).join() === 'masker' && d.getElementById('sag-knap').textContent === 'Sag: «Firewall-log» · gemmes automatisk');
  // English
  w.Sprog.saet('en'); w.Grimnir.vis('sager'); await vent(10);
  tjek('English: status og kolonner', chipTekst(hexId(1)) === '!Expiring soon' && sek.querySelector('.sagtabel thead th').textContent === 'Name' && d.getElementById('sag-knap').textContent === 'Case: “Firewall-log” · saved automatically');
  w.Sprog.saet('da');
})();

// ── Luk programmet med en midlertidig sag, og åbn en sag oven på en midlertidig ──
await (async () => {
  const rust = falskSagRust({ sager: SAGER() });
  const s = side({ hash: '#masker', rust });
  const { d, w } = s;
  await vent(10);
  const sek = d.querySelector('section[data-visning="masker"]');
  indsaet(w, sek.querySelector('.tomt'), TEKST);
  await vent(5); // V-OPBYG.1 N3: analysen sker ved indsætning (før ⌘↵ første gang)
  s.tast('Enter', { metaKey: true }); await vent(5);
  s.emit('menu', 'afslut');
  tjek('afslut: spørgsmålet med antal værdier og Gem som sag, Kassér, Annullér', aaben(d, 'dlg-kasser') && d.querySelector('#dlg-kasser h2').textContent === 'Gem den midlertidige sag, før Grimnir lukker?' && d.querySelector('#dlg-kasser .modal-tekst').textContent.startsWith('Den midlertidige sag har 3 værdier') && d.activeElement === d.getElementById('kasser-gem'));
  klik(w, d.querySelector('#dlg-kasser [data-svar="annuller"]'));
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
  indsaet(s2.w, s2.d.querySelector('section[data-visning="masker"] .tomt'), TEKST);
  await vent(5); // V-OPBYG.1 N3: analysen sker ved indsætning (før ⌘↵ første gang)
  s2.tast('Enter', { metaKey: true }); await vent(5);
  s2.emit('menu', 'afslut');
  klik(s2.w, s2.d.getElementById('kasser-ok')); await vent(5);
  tjek('afslut: Kassér lukker uden sag_ny', s2.kald.some(k => k[0] === 'program_afslut') && !s2.kald.some(k => k[0] === 'sag_ny'));
  // Åbn en gemt sag oven på en midlertidig sag med poster: der spørges først.
  const s3 = side({ hash: '#masker', rust: falskSagRust({ sager: SAGER() }) });
  await vent(10);
  indsaet(s3.w, s3.d.querySelector('section[data-visning="masker"] .tomt'), TEKST);
  await vent(5); // V-OPBYG.1 N3: analysen sker ved indsætning (før ⌘↵ første gang)
  s3.tast('Enter', { metaKey: true }); await vent(5);
  s3.w.Grimnir.vis('sager'); await vent(10);
  // V-MANUEL.2: dobbeltklik og Enter viser sagens indhold (læser kun); at åbne sagen er Åbn i Maskér i båndet.
  klik(s3.w, sagRaekke(s3.d, hexId(1))); await vent(5);
  klik(s3.w, knapI(s3.d, 'sager', 'aabn-i-masker')); await vent(5);
  tjek('åbn oven på midlertidig sag: der spørges først', aaben(s3.d, 'dlg-kasser') && s3.d.querySelector('#dlg-kasser h2').textContent === 'Gem den midlertidige sag, før en anden sag åbnes?' && !s3.kald.some(k => k[0] === 'sag_aabn'));
  klik(s3.w, s3.d.getElementById('kasser-ok')); await vent(10);
  tjek('åbn oven på midlertidig sag: Kassér åbner sagen', s3.kald.some(k => k[0] === 'sag_aabn' && k[1].id === hexId(1)) && s3.d.getElementById('sag-knap').textContent === 'Sag: «Supportsag 0042» · gemmes automatisk');
})();

// ── Demaskér peger på Sager; 8 MB; fuldskærm ──
await (async () => {
  const s = side({ hash: '#demasker', rust: falskSagRust({ sager: SAGER() }) });
  const { d, w } = s;
  await vent(10);
  const dsek = d.querySelector('section[data-visning="demasker"]');
  const tilSager = [...dsek.querySelectorAll('.tomt button')].find(b => b.textContent === 'Åbn Sager');
  tjek('Demaskér: tom sag med gemte sager peger på Sager', dsek.querySelector('.tomt p').textContent === 'Der er ingen koder i denne sag endnu. Åbn den sag, svaret hører til, under Sager.' && tilSager && !tilSager.hidden);
  tjek('Demaskér: nedtonet med "Åbn en gemt sag under Sager først"', forklaring(knapI(d, 'demasker', 'demasker')) === 'Åbn en gemt sag under Sager først');
  klik(w, tilSager); await vent(5);
  tjek('Demaskér: "Åbn Sager" går til Sager', synlige(d).join() === 'sager');
  w.Grimnir.vis('demasker'); await vent(5);
  const seks = 'h0001 '.repeat(1024 * 1024);
  indsaet(w, dsek.querySelector('.tomt'), seks);
  tjek('Demaskér: 6 MB tages imod (grænsen er 8 MB)', w.GrimnirMaskering.D.st.tekst === seks);
  indsaet(w, dsek.querySelector('pre.tekst'), 'x'.repeat(8 * 1024 * 1024 + 1));
  tjek('Demaskér: over 8 MB afvises med besked', w.GrimnirMaskering.D.st.tekst === seks && /Teksten er 8,0 MB\. Demaskér tager højst 8 MB/.test(dsek.textContent));
  s.emit('fuldskaerm', true);
  tjek('fuldskærm: <html data-fuldskaerm>', d.documentElement.hasAttribute('data-fuldskaerm'));
  s.emit('fuldskaerm', false);
  tjek('fuldskærm: væk igen', !d.documentElement.hasAttribute('data-fuldskaerm'));
  const tom = side({ hash: '#demasker' });
  await vent(5);
  const knap = [...tom.d.querySelectorAll('section[data-visning="demasker"] .tomt button')].find(b => b.textContent === 'Åbn Sager');
  tjek('Demaskér: uden gemte sager er knappen skjult og teksten som før', knap && knap.hidden && tom.d.querySelector('section[data-visning="demasker"] .tomt p').textContent.startsWith('Der er intet at demaskere endnu'));
})();

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
      // V-OPBYG.4 N1: en hemmelighed har ingen værdi i rækken (og kan ikke stå i ordbogen).
      svar.raekker = svar.raekker.filter(x => !aldrig.includes((x.vaerdier[0] || '').toLowerCase()))
        .map(x => (altid.includes((x.vaerdier[0] || '').toLowerCase()) ? { ...x, status: 'ordbog', standard: true, valgt: a.fravalgt == null ? true : x.valgt } : x));
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
await (async () => {
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
})();

// ── Ordbog: liste, grupper, træ, søgning, tilføj, ret, fjern, Prøv på tekst ──
await (async () => {
  const rust = falskOrdbogRust({ poster: ORDBOG(), indst: { guide_vist: true } });
  const s = side({ hash: '#ordbog', rust });
  const { d, w } = s;
  await vent(10);
  const sek = d.querySelector('section[data-visning="ordbog"]');
  tjek('Ordbog: guiden vises ikke (allerede vist)', !aaben(d, 'dlg-guide'));
  tjek('Ordbog: seks poster, tom tilstand skjult', oRaekker(d).length === 6 && sek.querySelector('.tomt').hidden);
  tjek('Ordbog: kolonnerne Type, Værdi eller mønster, Note', [...sek.querySelectorAll('.ordbogtabel thead th')].map(t => t.textContent).join('|') === 'Type|Værdi eller mønster|Note');
  const grupper = [...sek.querySelectorAll('.ordbogtabel tr.gruppe')].map(t => t.textContent);
  tjek('Ordbog: grupperne Maskér altid og Maskér aldrig med note', JSON.stringify(grupper) === JSON.stringify(['Maskér altid fanges i alle sager', 'Maskér aldrig røres ikke, selv om det ligner noget følsomt']), JSON.stringify(grupper));
  tjek('Ordbog: typerne står i Type-kolonnen (maskér aldrig efter, hvad værdien ligner)', oRaekke(d, 'kontor.test').children[0].textContent === 'Domæne' && oRaekke(d, 'srv-###').children[0].textContent === 'Navnemønster' && oRaekke(d, '10.20.30.40').children[0].textContent === 'Adresse' && oRaekke(d, 'localhost').children[0].textContent === 'Ord');
  tjek('Ordbog: værdien i mono, noten ved siden af', oRaekke(d, 'kontor.test').children[1].querySelector('.mono') && oRaekke(d, '10.20.30.40').children[2].textContent === 'printeren');
  tjek('Ordbog: banneret "Ordbogen ligger krypteret"', sek.querySelector('.ban.info').textContent.includes('Ordbogen ligger krypteret på denne maskine'));
  tjek('Ordbog: hjælpen om navnemønstre med Prøv på tekst', sek.querySelector('.hjaelpelinje').textContent.includes('srv-### fanger srv-068, også uden domæne') && sek.querySelector('.hjaelpelinje button').textContent === 'Prøv på tekst');
  const ant = id => d.querySelector(`.navdel[data-visning="ordbog"] [data-punkt="${id}"] .ant`).textContent;
  tjek('Ordbog: træet tæller listerne og typerne', [ant('altid'), ant('aldrig'), ant('t-domaene'), ant('t-netbios'), ant('t-navnemoenster'), ant('t-eget_net'), ant('t-ord'), ant('t-person')].join() === '4,2,1,0,1,1,1,0');
  tjek('V-OPBYG.2 N4: Ordbog: chippen siger 6 poster, fodlinjen sagens navn og gemte erstatninger', sek.querySelector('.vl .chip').textContent === 'i6 poster' && /^Midlertidig sag · \d+ (gemt erstatning|gemte erstatninger)$/.test(d.getElementById('fod-venstre').textContent), d.getElementById('fod-venstre').textContent);
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
  tjek('Ordbog: uden valg er Ret og Fjern post nedtonet med forklaring; Tilføj post og Prøv aktive; Importér og Eksportér stadig nedtonet', ['ret', 'fjern-post'].every(id => !kommandoAktiv(d, 'ordbog', id) && forklaring(knapI(d, 'ordbog', id)) === 'Vælg en post i listen først') && kommandoAktiv(d, 'ordbog', 'tilfoej-post') && kommandoAktiv(d, 'ordbog', 'proev') && !kommandoAktiv(d, 'ordbog', 'importer') && !kommandoAktiv(d, 'ordbog', 'eksporter'));

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
  klik(w, d.querySelector('#dlg-opost [data-svar="annuller"]'));

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
  klik(w, d.querySelector('#dlg-opost [data-svar="annuller"]'));

  // Fjern post med bekræftelse
  klik(w, oRaekke(d, 'localhost').children[0]);
  klik(w, knapI(d, 'ordbog', 'fjern-post'));
  tjek('Fjern: bekræftelsen nævner værdien', aaben(d, 'dlg-ofjern') && d.querySelector('#dlg-ofjern .modal-tekst').textContent.startsWith('«localhost» fjernes fra ordbogen'));
  klik(w, d.querySelector('#dlg-ofjern [data-svar="nej"]'));
  tjek('Fjern: Annullér fjerner intet', !s.kald.some(k => k[0] === 'ordbog_fjern') && oRaekker(d).length === 7);
  klik(w, knapI(d, 'ordbog', 'fjern-post'));
  klik(w, d.querySelector('#dlg-ofjern [data-svar="ja"]')); await vent(10);
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
  klik(w, d.querySelector('#dlg-proev [data-svar="luk"]'));
  tjek('Prøv: teksten og svaret slettes, når dialogen lukkes', pt.value === '' && d.getElementById('proev-svar').textContent === '');
  // Hjælpelinjens knap åbner også Prøv.
  klik(w, sek.querySelector('.hjaelpelinje button'));
  tjek('Prøv: hjælpelinjens knap åbner dialogen', aaben(d, 'dlg-proev'));
  klik(w, d.querySelector('#dlg-proev [data-svar="luk"]'));

  // English
  w.Sprog.saet('en'); await vent(5);
  tjek('English: grupper, kolonner og typer', sek.querySelector('.ordbogtabel tr.gruppe').textContent === 'Always mask caught in every case' && sek.querySelector('.ordbogtabel thead th:nth-child(2)').textContent === 'Value or pattern' && oRaekke(d, 'kontor.test').children[0].textContent === 'Domain');
  w.Sprog.saet('da');
})();

// ── Ordbog, der ikke kan åbnes: tydelig besked, intet kan ændres ──
await (async () => {
  const rust = falskOrdbogRust({ indst: { guide_vist: false }, laast: { art: 'beskadiget' } });
  const s = side({ hash: '#ordbog', rust });
  const { d } = s;
  await vent(10);
  const sek = d.querySelector('section[data-visning="ordbog"]');
  tjek('kan ikke åbnes: fejlbanner med årsag', sek.querySelector('.ban.danger') && sek.querySelector('.ban.danger').textContent.includes('Ordbogen kunne ikke åbnes: filen er beskadiget eller ændret. Grimnir bruger en tom ordbog og ændrer ikke filen.'));
  tjek('kan ikke åbnes: chip "Kan ikke åbnes"', sek.querySelector('.vl .chip').textContent === '×Kan ikke åbnes');
  tjek('kan ikke åbnes: Tilføj post nedtonet med forklaring', !kommandoAktiv(d, 'ordbog', 'tilfoej-post') && forklaring(knapI(d, 'ordbog', 'tilfoej-post')) === 'Ordbogen kunne ikke åbnes, så den kan ikke ændres');
  tjek('kan ikke åbnes: guiden vises ikke', !aaben(d, 'dlg-guide'));
})();

// ── Fra Maskér til ordbogen (O4) ──
await (async () => {
  const rust = falskOrdbogRust({ indst: { guide_vist: true } });
  const s = side({ hash: '#masker', rust });
  const { d, w } = s;
  await vent(10);
  const sek = d.querySelector('section[data-visning="masker"]');
  indsaet(w, sek.querySelector('.tomt'), TEKST);
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
  tjek('Altid: teksten analyseres igen, og rækken maskeres nu', s.kald.filter(k => k[0] === 'analyser').length > foer && raekkeMed(d, 70).querySelector('input[type="checkbox"]').checked && raekkeMed(d, 70).querySelector('.chip').textContent === '✓Maskeres' && raekkeMed(d, 70).querySelector('.sikkerhed').textContent === 'Fra ordbog');
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
  tjek('Altid (tvetydig): gemt som den valgte type', k2[1].type === 'person' && k2[1].vaerdi === 'bruger060' && !aaben(d, 'dlg-opost') && raekkeMed(d, 24).querySelector('.chip').textContent === '✓Maskeres' && raekkeMed(d, 24).querySelector('.sikkerhed').textContent === 'Fra ordbog');
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
})();

// ── Advarslen ved egen kode i en navngiven sag (O7) ──
await (async () => {
  const rust = falskOrdbogRust({ indst: { guide_vist: true } });
  const s = side({ hash: '#masker', rust });
  const { d, w } = s;
  await vent(10);
  const sek = d.querySelector('section[data-visning="masker"]');
  indsaet(w, sek.querySelector('.tomt'), TEKST);
  s.tast('Enter', { metaKey: true }); await vent(10);
  const kode = () => raekkeMed(d, 24).querySelector('input[data-felt="kode"]');
  kode().value = 'kunde01';
  kode().dispatchEvent(new w.Event('change', { bubbles: true }));
  tjek('egen kode i en midlertidig sag uden gemte tekster: ingen advarsel', !raekkeMed(d, 24).querySelector('.raekkeadv'));
  await vent(400); // V-OPBYG.1 N3: analysen sker ved indsætning (før ⌘↵ første gang)
  s.tast('Enter', { metaKey: true }); await vent(10);
  klik(w, d.getElementById('sag-knap'));
  klik(w, d.getElementById('sag-gem-som'));
  skriv(w, d.getElementById('ny-sag-navn'), 'Prøvesag');
  klik(w, d.getElementById('ny-sag-opret')); await vent(10);
  tjek('sagen er nu navngiven med poster', d.getElementById('sag-knap').textContent.startsWith('Sag: «Prøvesag»'));
  indsaet(w, sek.querySelector('pre.tekst'), TEKST);
  s.tast('Enter', { metaKey: true }); await vent(10);
  kode().value = 'kunde02';
  kode().dispatchEvent(new w.Event('change', { bubbles: true }));
  await vent(400); // advarslen tegnes med tabellen efter den nye analyse (350 ms)
  const adv = raekkeMed(d, 24).querySelector('.raekkeadv');
  tjek('egen kode i en navngiven sag med gemte tekster: advarsel under feltet', adv && adv.textContent.startsWith('Sagen har gemt tidligere tekster: koden må ikke være et ord') && kode().getAttribute('aria-describedby') === adv.id);
  tjek('advarslen er ikke en fejl (intet aria-invalid, intet rødt banner)', !kode().hasAttribute('aria-invalid') && !sek.querySelector('.ban.danger'));
  tjek('rækker uden egen kode har ingen advarsel', !raekkeMed(d, 6).querySelector('.raekkeadv'));
})();

// ── Guiden ved første start (O5) ──
await (async () => {
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
  // V-KITBRUG.2 N1: guiden er kittets dialog. Esc er browserens: 'cancel' og derefter lukning (jsdom lukker ikke selv), og
  // kittet melder svaret 'esc' i vedLuk, som springer over. Grimnir forhindrer ikke længere browserens lukning.
  const ev = new s4.w.Event('cancel', { cancelable: true });
  const gd = s4.d.getElementById('dlg-guide');
  gd.dispatchEvent(ev);
  if (!ev.defaultPrevented) gd.close();
  await vent(10);
  tjek('guide: Escape springer over', !aaben(s4.d, 'dlg-guide') && r4.ob.indst.guide_vist === true && !ev.defaultPrevented);
  // Ordbogen er ikke tom: guiden vises ikke.
  const s5 = side({ hash: '#masker', rust: falskOrdbogRust({ poster: ORDBOG() }) });
  await vent(20);
  tjek('guide: vises ikke, når ordbogen har poster', !aaben(s5.d, 'dlg-guide'));
  // Kan åbnes igen fra Indstillinger.
  s5.emit('menu', 'indstillinger');
  klik(s5.w, s5.d.getElementById('indst-guide')); await vent(5);
  tjek('guide: Vis guiden igen fra Indstillinger', aaben(s5.d, 'dlg-guide') && !aaben(s5.d, 'dlg-indst') && s5.d.querySelector('#dlg-guide .indhold h2').textContent === 'Sådan arbejder Grimnir');
  tjek('guide: listen i trin 2 viser ordbogens domæne', (() => { klik(s5.w, s5.d.querySelectorAll('#dlg-guide .fod button')[2]); return s5.d.querySelector('#dlg-guide .guide-liste').textContent.includes('kontor.test'); })());
})();

// ── Indstillinger (O6) ──
await (async () => {
  const rust = falskOrdbogRust({ indst: { guide_vist: true } });
  const s = side({ hash: '#masker', rust });
  const { d, w } = s;
  await vent(20);
  s.emit('menu', 'indstillinger');
  const radio = (navn, v) => d.querySelector(`input[name="${navn}"][value="${v}"]`);
  const fr = d.getElementById('indst-fremmede'), ok = d.getElementById('indst-oktet'), ud = d.getElementById('indst-udloeb');
  tjek('Indstillinger: tema og sprog (V-FANER.1: kun her; fanen Vis er væk)', aaben(d, 'dlg-indst') && radio('indst-tema', 'system').checked && radio('indst-sprog', 'da').checked);
  tjek('Indstillinger: standard for nye sager (D4 fra, D5 til, intet udløb)', !fr.checked && ok.checked && ud.value === '' && !fr.disabled);
  tjek('Indstillinger: hver valgmulighed har et navn og en hjælpetekst', fr.getAttribute('aria-label') === 'Maskér fremmede offentlige adresser' && d.getElementById('indst-fremmede-hj').textContent.startsWith('Fra som standard') && d.getElementById('indst-oktet-hj').textContent.startsWith('Til som standard'));
  radio('indst-tema', 'moerk').checked = true;
  radio('indst-tema', 'moerk').dispatchEvent(new w.Event('change', { bubbles: true }));
  tjek('Indstillinger: tema skifter og huskes i localStorage', d.documentElement.getAttribute('data-tema') === 'moerk' && w.localStorage.getItem('grimnir-tema') === 'moerk');
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
  klik(w, d.querySelector('#dlg-indst [data-svar="luk"]'));
  // Gælder en ny sag: den åbne sag beholder sine valg; efter Nulstil har den nye sag indstillingernes.
  const sek = d.querySelector('section[data-visning="masker"]');
  indsaet(w, sek.querySelector('.tomt'), TEKST);
  await vent(10); // V-OPBYG.1 N3: analysen sker ved indsætning (før ⌘↵ første gang)
  s.tast('Enter', { metaKey: true }); await vent(10);
  klik(w, d.getElementById('sag-knap'));
  tjek('sagens dialog: valgene for den åbne sag (som før indstillingen)', aaben(d, 'dlg-sag') && !d.getElementById('sag-valg').hidden && !d.getElementById('sag-fremmede').checked && d.getElementById('sag-oktet').checked);
  tjek('sagens dialog: en ændring gælder kun nye værdier, og det står der', d.getElementById('sag-valg-hj').textContent === 'Sagen har allerede værdier: en ændring gælder kun nye værdier.');
  klik(w, d.getElementById('sag-nulstil')); await vent(10);
  indsaet(w, sek.querySelector('pre.tekst'), TEKST);
  await vent(10); // V-OPBYG.1 N3: analysen sker ved indsætning (før ⌘↵ første gang)
  s.tast('Enter', { metaKey: true }); await vent(10);
  klik(w, d.getElementById('sag-knap'));
  tjek('ny sag: får indstillingerne (fremmede adresser maskeres)', d.getElementById('sag-fremmede').checked && d.getElementById('sag-oktet').checked);
  const sv = d.getElementById('sag-oktet');
  sv.checked = false;
  sv.dispatchEvent(new w.Event('change', { bubbles: true })); await vent(10);
  const vk = s.kald.find(k => k[0] === 'sag_valg');
  tjek('sagens dialog: en ændring kalder sag_valg med begge valg', vk && vk[1].maskerFremmede === true && vk[1].bevarSidsteOktet === false && !d.getElementById('sag-oktet').checked);
  klik(w, d.querySelector('#dlg-sag [data-svar="luk"]'));
  // Standardudløbet foreslås i Ny sag.
  w.Grimnir.vis('sager'); await vent(5);
  klik(w, knapI(d, 'sager', 'ny-sag'));
  tjek('Ny sag: standardudløbet (30 dage) er foreslået', d.getElementById('ny-sag-udloeb').value === datoOm(30));
  klik(w, d.querySelector('#dlg-ny-sag [data-svar="annuller"]'));
  // En fejl ved gemning står i dialogen, og valget springer tilbage.
  const r2 = falskOrdbogRust({ indst: { guide_vist: true }, gemFejl: true });
  const s2 = side({ hash: '#masker', rust: r2 });
  await vent(20);
  s2.emit('menu', 'indstillinger');
  const fr2 = s2.d.getElementById('indst-fremmede');
  fr2.checked = true;
  fr2.dispatchEvent(new s2.w.Event('change', { bubbles: true })); await vent(10);
  tjek('Indstillinger: en fejl står i dialogen, og valget springer tilbage', s2.d.getElementById('dlg-indst-fejl').textContent === 'Indstillingen blev ikke gemt: disken kunne ikke bruges (PermissionDenied).' && !fr2.checked);
})();

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
      // V-OPBYG.4 N1: som Rust (raekke_ud): en hemmelighed uden sin værdi.
      raekker: f.slice(0, sv.antal).map(x => (x.hemmelig ? { ...x, vaerdier: [] } : x)), i_alt: f.length, valgte: alle.filter(x => x.valgt).length,
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
    raekke_vaerdi: ({ fil: f, id }) => { const x = f ? RAEKKER.find(y => y.id === id && y.hemmelig) : null; if (!x) throw { art: 'ukendt_raekke' }; return { id, vaerdier: [...x.vaerdier] }; },
    fil_gem_og_masker: async () => {
      await pause();
      return { uddrag: 'Password=GRIMNIR_SECRET_0001;\r\nsrcip=198.18.0.2 msg=ok\r\n', ikke_vist: 1234000, rester, advarsler: [], poster: antal, bytes: kopierbar ? 1000 : 6 * 1048576, kopierbar };
    },
    fil_demasker: async () => { await pause(); return { uddrag: 'Password=Sommer2026!;\r\n', ikke_vist: 99, advarsler: [], koder: ['198.18.0.2'], tilbage: [{ kode: '198.18.0.2', antal: 3, linje: 2 }], bytes: kopierbar ? 1000 : 6 * 1048576, kopierbar }; },
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
await (async () => {
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
  tjek('filfejl som tekst: Latin-1 med byteposition og stor fil med MB', GMw.filFejlTekst({ art: 'tegnsaet', ligner: 'enkeltbyte', byte: 1234 }).includes('position 1.234') && GMw.filFejlTekst({ art: 'for_stor', bytes: 110100480, maks: 104857600 }) === 'filen er 105,0 MB, og grænsen er 100,0 MB');
})();

// ── Maskér med en fil: åbn, uddrag, rækker fra Rust, søgning over alle, gem, kopiér ──
await (async () => {
  const skrevet = [];
  const rust = falskFilRust();
  const s = side({ rust, foer: w => Object.defineProperty(w.navigator, 'clipboard', { value: { writeText: async t => { skrevet.push(t); } }, configurable: true }) });
  const { d, w } = s;
  await vent(5);
  const G = w.GrimnirMaskering;
  const sek = d.querySelector('section[data-visning="masker"]');
  tjek('Maskér: Åbn fil er aktiv fra start, med genvejen ⌘O', kommandoAktiv(d, 'masker', 'aabn-fil') && knapI(d, 'masker', 'aabn-fil').title === 'Genvej: ⌘O');
  tjek('Maskér: den tomme tilstand har knappen Åbn fil', [...sek.querySelectorAll('.tomt button')].some(b => b.textContent.trim() === 'Åbn fil'));
  tjek('Maskér: Gem maskeret fil er nedtonet uden fil, med forklaring', !kommandoAktiv(d, 'masker', 'gem-fil') && forklaring(knapI(d, 'masker', 'gem-fil')) === 'Åbn en fil først; en indsat tekst kopieres i stedet');
  tjek('V-KVIT.1: Maskér: Kopiér kvittering er nedtonet før en maskering, med forklaring', !kommandoAktiv(d, 'masker', 'kvittering') && forklaring(knapI(d, 'masker', 'kvittering')) === 'Maskér teksten først');
  s.emit('menu', 'aabn');
  await vent(10);
  tjek('Arkiv → Åbn… (⌘O): fil_aabn for Maskér', s.kald.some(k => k[0] === 'fil_aabn' && k[1].visning === 'masker') && G.M.st.fil && G.M.st.fil.navn === 'app.log');
  const fi = sek.querySelector('.vl .filinfo');
  tjek('værktøjslinjen: filnavn, størrelse, tegnsæt og linjeskift', fi && !fi.hidden && fi.textContent === 'app.log11,8 MBUTF-16 LECRLF', fi && fi.textContent);
  tjek('uddraget vises, og en linje siger, hvor meget der ikke vises', sek.querySelector('pre.tekst').textContent.startsWith('Password=') && sek.querySelector('.afkortet').textContent === 'Viser de første 200.000 tegn. 1.234.567 tegn mere er med i maskeringen, men vises ikke.' && !sek.querySelector('.afkortet').hidden);
  tjek('tekstpanelet viser filens linjer og størrelse', sek.querySelector('.panel .panel-hoved .muted').textContent.includes('1.202 linjer'));
  // V-OPBYG.6 N4: venter på, at filens analyse og derefter maskeringen er færdige (fodlinjen), i stedet for fast 10 ms:
  // under hukommelsespres (Nodes grænse på en maskine med 4 GB) nåede de det ikke altid. Påstandene nedenfor er uændrede.
  await ventTil(s.w, () => Boolean(G.M.st.analyse) && !G.M.st.travl);
  s.tast('Enter', { metaKey: true });
  await ventTil(s.w, () => /maskeret/.test(d.getElementById('fod-venstre').textContent));
  const fa = s.kald.filter(k => k[0] === 'fil_analyser');
  tjek('⌘↵: fil_analyser uden tekst, med kernens standard og første side', fa.length === 1 && !('tekst' in fa[0][1]) && fa[0][1].fravalgt === null && fa[0][1].side.antal === 500 && fa[0][1].side.filter === 'alle' && !s.kald.some(k => k[0] === 'analyser'));
  tjek('tabellen: 500 rækker ad gangen, "Viser 500 af 1200"', fundRaekker(d).length === 500 && sek.querySelector('.flere').textContent.includes('500') && sek.querySelector('.flere').textContent.includes('1200') && !sek.querySelector('.flere').hidden);
  const trae = n => d.querySelector(`.navdel[data-visning="masker"] [data-punkt="${n}"] .ant`).textContent;
  tjek('træets antal er over alle rækker (fra Rust)', [trae('alle'), trae('tjek'), trae('hemmelig'), trae('seneste')].join() === '1200,1,1,0');
  // V-OPBYG.1: ⌘↵ er Maskér, når analysen er der (filen analyseres ved åbningen), så filen er maskeret her.
  tjek('V-OPBYG.2 N4: fodlinjen: værdier, maskeret og bevaret efter maskeringen (fra Rust)', d.getElementById('fod-venstre').textContent === '1200 værdier · 1199 maskeret · 1 bevaret', d.getElementById('fod-venstre').textContent);
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
  tjek('et fravalg sendes til Rust (fil_analyser med fravalgt)', fa2[1].fravalgt.includes(70) && d.getElementById('fod-venstre').textContent === '1200 værdier · 1198 maskeres · 2 bevares', d.getElementById('fod-venstre').textContent);
  s.tast('Enter', { metaKey: true });
  await vent(10);
  tjek('Gem og maskér: fil_gem_og_masker uden tekst', s.kald.some(k => k[0] === 'fil_gem_og_masker' && !('tekst' in k[1]) && k[1].fravalgt.includes(70)));
  tjek('efter maskeringen: det maskerede uddrag vises', sek.querySelector('pre.tekst').textContent.startsWith('Password=GRIMNIR_SECRET_0001') && sek.querySelector('.afkortet').textContent.includes('1.234.000'));
  tjek('Gem maskeret fil og Kopiér er aktive (⌘S og ⇧⌘C)', kommandoAktiv(d, 'masker', 'gem-fil') && knapI(d, 'masker', 'gem-fil').title === 'Genvej: ⌘S' && kommandoAktiv(d, 'masker', 'kopier'));
  knapI(d, 'masker', 'kopier').click();
  await vent(10);
  tjek('Kopiér: hele resultatet hentes fra Rust (fil_kopi) og kopieres', s.kald.some(k => k[0] === 'fil_kopi' && k[1].visning === 'masker') && skrevet.pop() === 'MASKERET-HELE-FILEN');
  tjek('V-LAAS.4: Kopiér af en maskeret fil melder intet til Rust', !s.kald.some(k => k[0] === 'udklip_kopieret'));
  // V-KVIT.1: kvitteringen for en fil.
  tjek('V-KVIT.1: en maskeret fil: Kopiér kvittering er aktiv', kommandoAktiv(d, 'masker', 'kvittering'));
  knapI(d, 'masker', 'kvittering').click();
  await vent(10);
  tjek('V-KVIT.1: en maskeret fil: kvitteringen hentes med fil true og kopieres', JSON.stringify(s.kald.filter(k => k[0] === 'kvittering').map(k => k[1])) === '[{"fil":true,"sprog":"da"}]' && skrevet.pop() === 'KVITTERING da fil\n' && sek.querySelector('.besked').textContent.startsWith('Kvitteringen er kopieret.'));
  tjek('V-KVIT.1: en maskeret fil: kvitteringen meldes ikke til Rust, og filens resultat hentes ikke (fil_kopi kun én gang)', !s.kald.some(k => k[0] === 'udklip_kopieret') && s.kald.filter(k => k[0] === 'fil_kopi').length === 1);
  s.emit('menu', 'gem');
  await vent(10);
  tjek('Arkiv → Gem… (⌘S): fil_gem for Maskér uden "alligevel"', rust.fil.gemt.length === 1 && rust.fil.gemt[0].join() === 'masker,false' && sek.querySelector('.besked').textContent === 'Gemt som app.maskeret.log.');
  tjek('ingen kommando har fået en sti eller hele filen', s.kald.every(k => !/sti|path|\//i.test(JSON.stringify(Object.keys(k[1]))) && !('tekst' in k[1] && /^fil_/.test(k[0]))));
  // En indsat tekst tager over: filen slippes i Rust.
  indsaet(w, sek.querySelector('pre.tekst'), TEKST);
  await vent(5);
  tjek('indsæt efter en fil: fil_luk, og værktøjslinjen viser ingen fil', s.kald.some(k => k[0] === 'fil_luk' && k[1].visning === 'masker') && G.M.st.fil === null && fi.hidden && G.M.st.tekst === TEKST);
})();

// ── Maskér: rester kræver Gem alligevel; Kopiér over 5 MB er nedtonet ──
await (async () => {
  const rust = falskFilRust({ antal: 3, rester: [{ art: 'original', type_: 'hemmelighed', tekst: 'SOMMER2026!', antal: 1, linje: 4 }], kopierbar: false });
  const s = side({ rust });
  const { d } = s;
  await vent(5);
  const sek = d.querySelector('section[data-visning="masker"]');
  knapI(d, 'masker', 'aabn-fil').click();
  await vent(10);
  await vent(10); // V-OPBYG.1 N3: analysen sker ved indsætning (før ⌘↵ første gang)
  s.tast('Enter', { metaKey: true }); await vent(10);
  tjek('rester: banneret om rester står', sek.textContent.includes('Lækagetjekket fandt 1 sted i resultatet, der stadig ligner en følsom værdi'));
  tjek('over 5 MB: Kopiér er nedtonet med forklaring', !kommandoAktiv(d, 'masker', 'kopier') && forklaring(knapI(d, 'masker', 'kopier')) === 'Over 5 MB kan ikke kopieres; gem resultatet som fil');
  knapI(d, 'masker', 'gem-fil').click();
  await vent(5);
  const alligevel = [...sek.querySelectorAll('.ban button')].find(b => b.textContent === 'Gem alligevel');
  tjek('Gem maskeret fil med rester: intet gemt, et ekstra tryk kræves', rust.fil.gemt.length === 0 && !s.kald.some(k => k[0] === 'fil_gem') && alligevel && sek.textContent.includes('står i klartekst i filen'));
  alligevel.click();
  await vent(10);
  tjek('Gem alligevel: fil_gem med ok', rust.fil.gemt.length === 1 && rust.fil.gemt[0].join() === 'masker,true');
})();

// ── Arbejder-tilstand: over et sekund vises "Grimnir arbejder", og kommandoerne er nedtonede ──
await (async () => {
  const rust = falskFilRust({ antal: 3, forsinkelse: 1300 });
  const s = side({ rust });
  const { d } = s;
  await vent(5);
  const sek = d.querySelector('section[data-visning="masker"]');
  knapI(d, 'masker', 'aabn-fil').click();
  await vent(50);
  // V-KITBRUG.1: "Grimnir arbejder" er kittets fremdrift (.frem), som står på fladen, mens der arbejdes, og ellers ikke.
  const arb = () => sek.querySelector('.flade > .frem');
  tjek('arbejder: kommandoerne er nedtonede med det samme', !kommandoAktiv(d, 'masker', 'aabn-fil') && forklaring(knapI(d, 'masker', 'aabn-fil')) === 'Vent, Grimnir arbejder' && sek.querySelector('.vl .chip').textContent.includes('Arbejder'));
  tjek('arbejder: under et sekund vises ingen besked', !arb());
  await vent(1050);
  tjek('arbejder: efter et sekund står "Grimnir arbejder" (role=status), og fladen er aria-busy', Boolean(arb()) && arb().querySelector('.frem-tekst').getAttribute('role') === 'status' && arb().textContent.startsWith('Grimnir arbejder') && sek.querySelector('.flade').getAttribute('aria-busy') === 'true');
  // V-OPBYG.1 N3: når filen er åbnet, analyseres den med det samme (også 1,3 s i den efterlignede Rust), så der ventes på,
  // at også analysen er færdig.
  const faerdig = await ventTil(s.w, () => s.kald.some(k => k[0] === 'fil_analyser') && !arb() && kommandoAktiv(d, 'masker', 'aabn-fil'), 4000);
  tjek('arbejder: færdig (åbnet og analyseret): beskeden er væk, og Åbn fil er aktiv igen', faerdig && !arb() && kommandoAktiv(d, 'masker', 'aabn-fil') && !sek.querySelector('.flade').hasAttribute('aria-busy'));
})();

// ── Træk og slip: én fil åbnes; flere filer og en mappe afvises ──
await (async () => {
  const rust = falskFilRust({ antal: 3 });
  const s = side({ rust });
  const { d, w } = s;
  await vent(5);
  const G = w.GrimnirMaskering;
  const flade = d.querySelector('section[data-visning="masker"] .flade');
  s.emit('fil-traek', true);
  // V-KITBRUG.2 N3 (G8): på den tomme flade viser kittets .tomt-slip det (programmet sætter klassen; kittet læser ingen filer).
  const tomFlade = flade.querySelector('.tomt');
  tjek('træk over vinduet: fladen viser, at den tager imod', tomFlade.classList.contains('tomt-slip') && !tomFlade.hidden);
  rust.fil.sluppet = 'sluppet.log';
  s.emit('fil-sluppet', { navn: 'sluppet.log', fejl: null });
  await vent(10);
  tjek('slip én fil: fil_aabn_sluppet i Maskér, og filen er åben', !flade.hasAttribute('data-traek') && !tomFlade.classList.contains('tomt-slip') && s.kald.some(k => k[0] === 'fil_aabn_sluppet' && k[1].visning === 'masker') && G.M.st.fil && G.M.st.fil.navn === 'sluppet.log');
  s.emit('fil-sluppet', { navn: null, fejl: 'flere' });
  // V-OPBYG.3: venter på beskeden i stedet for 5 ms (fejlede én gang af tre under belastning); påstanden er uændret.
  await ventTil(w, () => d.querySelector('section[data-visning="masker"]').textContent.includes('Træk én fil ad gangen ind'));
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
})();

// ── Demaskér med en fil: bekræftelse før Gem som fil ──
await (async () => {
  const skrevet = [];
  const rust = falskFilRust({ antal: 3 });
  const s = side({ hash: '#demasker', rust, foer: w => Object.defineProperty(w.navigator, 'clipboard', { value: { writeText: async t => { skrevet.push(t); } }, configurable: true }) });
  const { d, w } = s;
  await vent(5);
  w.GrimnirMaskering.saetSag(3);
  const sek = d.querySelector('section[data-visning="demasker"]');
  tjek('Demaskér: Åbn fil aktiv; Gem som fil nedtonet med forklaring', kommandoAktiv(d, 'demasker', 'aabn-fil') && !kommandoAktiv(d, 'demasker', 'gem-fil') && forklaring(knapI(d, 'demasker', 'gem-fil')) === 'Åbn en fil først; en indsat tekst kopieres i stedet');
  s.emit('menu', 'aabn');
  await vent(10);
  tjek('Demaskér: fil_aabn for Demaskér, filinfo i værktøjslinjen', s.kald.some(k => k[0] === 'fil_aabn' && k[1].visning === 'demasker') && sek.querySelector('.vl .filinfo').textContent.startsWith('app.maskeret.log'));
  s.tast('Enter', { metaKey: true });
  await vent(10);
  tjek('Demaskér: fil_demasker uden tekst; de rigtige værdier i uddrag', s.kald.some(k => k[0] === 'fil_demasker' && !('tekst' in k[1])) && sek.querySelectorAll('pre.tekst')[1].textContent === 'Password=Sommer2026!;\r\n');
  {
    // V-PUDS.1 N4: en fil: Antal og Linje i rækken "Sat tilbage" kommer fra Rust (fil_demasker → tilbage).
    const tr = [...sek.querySelectorAll('.advtabel tbody tr')].find(x => x.textContent.includes('Sat tilbage'));
    const c = tr ? [...tr.querySelectorAll('td')].map(x => x.textContent) : [];
    tjek('V-PUDS.1 N4: fil: Sat tilbage viser Antal 3 og Linje 2 fra Rust', c[1] === '198.18.0.2' && c[2] === '3' && c[3] === '2', c.join(' | '));
  }
  tjek('Demaskér: Gem som fil er aktiv (⌘S)', kommandoAktiv(d, 'demasker', 'gem-fil') && knapI(d, 'demasker', 'gem-fil').title === 'Genvej: ⌘S');
  knapI(d, 'demasker', 'gem-fil').click();
  await vent(5);
  // V-KITBRUG.1: kittets bekræftelse (Kit.bekraeft) laves, når den åbner, og fjernes igen, når den lukker.
  const dlg = () => d.getElementById('dlg-demfil');
  const aaben = () => Boolean(dlg() && dlg().open);
  tjek('Gem som fil: først en bekræftelse om klartekst; intet gemt endnu', aaben() && dlg().textContent.includes('rigtige værdier i klartekst') && !s.kald.some(k => k[0] === 'fil_gem') && d.activeElement === dlg().querySelector('[data-svar="nej"]'));
  dlg().querySelector('[data-svar="nej"]').click();
  await vent(5);
  tjek('Annullér: intet gemt', !aaben() && !s.kald.some(k => k[0] === 'fil_gem'));
  s.emit('menu', 'gem');
  await vent(5);
  tjek('⌘S i Demaskér: også først bekræftelsen', aaben() && !s.kald.some(k => k[0] === 'fil_gem'));
  dlg().querySelector('[data-svar="ja"]').click();
  await vent(10);
  tjek('Bekræftet: fil_gem for Demaskér med ok, og besked med filnavnet', !aaben() && rust.fil.gemt.length === 1 && rust.fil.gemt[0].join() === 'demasker,true' && sek.querySelector('.besked').textContent === 'Gemt som app.demaskeret.log.');
  knapI(d, 'demasker', 'kopier-resultat').click();
  await vent(10);
  tjek('Kopiér resultat: fra Rust (fil_kopi)', skrevet.pop() === 'RIGTIGE-HELE-FILEN');
  tjek('V-LAAS.4: Kopiér af en demaskeret fil melder det til Rust (fil true)', JSON.stringify(s.kald.filter(k => k[0] === 'udklip_kopieret').map(k => k[1])) === '[{"fil":true}]');
})();

// ── Windows: Ctrl+O og Ctrl+S ──
await (async () => {
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
})();

// ── Ordbog (F5): Start forfra og advarslen om en adgangskode ──
await (async () => {
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
  dlg.querySelector('[data-svar="ja"]').click();
  await vent(10);
  tjek('Start forfra: kaldt med dagens dato; ordbogen er tom og kan ændres', s.kald.some(k => k[0] === 'ordbog_start_forfra' && k[1].dato === idag) && !dlg.open && sek.textContent.includes(`Den gamle ordbog hedder nu ordbog.${idag}.ulaeselig`) && kommandoAktiv(d, 'ordbog', 'tilfoej-post'));
})();
await (async () => {
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
})();

// ── V-RET.1 R1: tabellerne — Altid/Aldrig som ikonknapper, lange værdier forkortes og står hele i title ──
await (async () => {
  const rust = falskOrdbogRust({ poster: ORDBOG(), sager: SAGER(), indst: { guide_vist: true } });
  const s = side({ rust });
  const { d, w } = s;
  await vent(20);
  const sek = d.querySelector('section[data-visning="masker"]');
  indsaet(w, sek.querySelector('.tomt'), TEKST);
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
  indsaet(w, dsek.querySelector('.tomt'), 'svar med h0099\n');
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
})();
await (async () => {
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
})();

// ── V-PUDS.2 N1: en selvvalgt kode med andre store/små bogstaver giver rækken "Andre store/små bogstaver" i Demaskér-tabellen,
// med koden, antal og linje fra Rust; "sat tilbage" for koden har alle stederne. Webvisningen tæller intet selv. ──
await (async () => {
  const s = side({ hash: '#demasker', rust: falskRust() });
  const { d, w } = s;
  await vent(5);
  const D = w.GrimnirMaskering.D;
  D.st.tekst = 'Svar\r\nFW-YDRE og FW-YDRE\r\nFw-Ydre\r\nfw-ydre\r\n';
  D.st.bytes = D.st.tekst.length;
  D.st.resultat = {
    tekst: 'Svar\r\nFW01 og FW01\r\nfw01\r\nfw01\r\n', linjer: 4, koder: ['fw-ydre'],
    tilbage: [{ kode: 'fw-ydre', antal: 4, linje: 2 }],
    advarsler: [{ art: 'anden_stavemaade', kode: 'FW-YDRE', antal: 2, linje: 2 }, { art: 'anden_stavemaade', kode: 'Fw-Ydre', antal: 1, linje: 3 }],
  };
  D.tegn();
  const dsek = d.querySelector('section[data-visning="demasker"]');
  const celler = () => [...dsek.querySelectorAll('.advarselpanel tbody tr')].map(r => [...r.querySelectorAll('td')].map(c => c.textContent.trim()));
  D.filter('advarsler');
  const adv = celler();
  tjek('V-PUDS.2: Demaskér: rækken for den selvvalgte kode med store bogstaver (hvad, kode, antal, linje)',
    adv.length === 2 && adv.every(r => r[0].endsWith('Andre store/små bogstaver')) && adv[0].slice(1).join('|') === 'FW-YDRE|2|2' && adv[1].slice(1).join('|') === 'Fw-Ydre|1|3', JSON.stringify(adv));
  D.filter('alle');
  const alle = celler();
  tjek('V-PUDS.2: Demaskér: "sat tilbage" for den selvvalgte kode tæller alle fire steder fra linje 2', alle.length === 3 && alle[0].slice(1).join('|') === 'fw-ydre|4|2', JSON.stringify(alle));
  tjek('V-PUDS.2: Demaskér: advarslen står i banneret med antal steder', dsek.querySelector('.ban.warn') && dsek.querySelector('.ban.warn').textContent.includes('3 steder'), dsek.querySelector('.ban.warn') && dsek.querySelector('.ban.warn').textContent);
})();

// ── V-RET.1 R2: tekstpanelerne bryder ikke linjer; "Ombryd" skifter, og valget huskes ikke ──
await (async () => {
  const s = side({ rust: falskRust() });
  const { d, w } = s;
  await vent(5);
  const sek = d.querySelector('section[data-visning="masker"]');
  indsaet(w, sek.querySelector('.tomt'), TEKST);
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
})();

// ── V-RET.1 R3: Demaskér viser Rusts linjetal (samme regel som Maskér og filer) ──
await (async () => {
  const s = side({ rust: falskRust() });
  const { d, w } = s;
  await vent(5);
  indsaet(w, d.querySelector('section[data-visning="masker"] .tomt'), TEKST);
  await vent(5); // V-OPBYG.1 N3: analysen sker ved indsætning (før ⌘↵ første gang)
  s.tast('Enter', { metaKey: true }); await vent(5);
  w.location.hash = 'demasker';
  await vent(5);
  const dsek = d.querySelector('section[data-visning="demasker"]');
  const info = () => dsek.querySelector('.panel .panel-hoved .muted').textContent;
  indsaet(w, dsek.querySelector('.tomt'), 'a\r\nb\r\nc\r\nd\r\n');
  // V-PUDS.3 N5: før "…" til Rust svarede; nu tælles der straks i webvisningen efter Rusts regel (fil::antal_linjer).
  tjek('R3 (V-PUDS.3 N5): Demaskér før demaskering: linjetallet står straks, efter Rusts regel (4 linjer, afsluttende CRLF)', info().startsWith('4 linjer · '), info());
  s.tast('Enter', { metaKey: true }); await vent(5);
  tjek('R3: Demaskér efter demaskering: 4 linjer fra Rust (tekst med afsluttende CRLF)', info().startsWith('4 linjer'), info());
  const m = ui('assets/maskering.js');
  tjek('R3 (V-MANUEL.1 N5): webvisningen tæller linjerne uden split på linjeskift (efter Rusts regel, antalLinjer)', !/split\(['"]\\n['"]\)/.test(m) && !/split\(\/\\r\?\\n\//.test(m));
})();

// ── V-RET.1 R4: ental og flertal i begge sprog ──
await (async () => {
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
    ['da', 'tekstInfo', [0, '0 linjer · 0,1 MB'], [1, '1 linje · 0,1 MB'], [2, '2 linjer · 0,1 MB']],
    ['en', 'tekstInfo', [0, '0 lines · 0.1 MB'], [1, '1 line · 0.1 MB'], [2, '2 lines · 0.1 MB']],
    ['da', 'chipSager', [0, '0 sager'], [1, '1 sag'], [2, '2 sager']],
    ['en', 'chipPoster', [0, '0 entries'], [1, '1 entry'], [2, '2 entries']],
    ['da', 'fodDemaskerTal', [0, '0 koder sat tilbage · 0 advarsler'], [1, '1 kode sat tilbage · 1 advarsel'], [2, '2 koder sat tilbage · 2 advarsler']],
    ['da', 'bAltTilbage', [0, 'Alle 0 koder i svaret er sat tilbage.'], [1, 'Den ene kode i svaret er sat tilbage.'], [2, 'Alle 2 koder i svaret er sat tilbage.']],
    ['en', 'bAltTilbage', [1, 'The one code in the reply has been put back.'], [2, 'All 2 codes in the reply have been put back.']],
    ['da', 'bGemRester', [1, 'fandt 1 rest, som står i klartekst i filen. Se den først'], [2, 'fandt 2 rester, som står i klartekst i filen. Se dem først']],
    ['en', 'bLaekRester', [1, 'found 1 place in the result that still looks sensitive'], [2, 'found 2 places in the result that still look sensitive']],
    ['da', 'ariaSagKnap', [1, 'Midlertidig sag, 1 værdi'], [2, 'Midlertidig sag, 2 værdier']],
    ['da', 'opsFundet', [1, '1 værdi fundet'], [2, '2 værdier fundet']],
    ['en', 'opsTjek', [1, 'One needs you to decide.'], [2, '2 need you to decide.']],
    ['da', 'chipUkendte', [1, '1 ukendt'], [2, '2 ukendte']],
  ];
  const forskel = [];
  for (const [sprog, k, ...par] of FORVENTET) {
    S.saet(sprog);
    // V-PUDS.3 N5: størrelsen i tekstInfo er en færdig tekst med enhed og sprogets talformat ({w}).
    for (const [n, f] of par) { const ud = S.t(k, n, k === 'tekstInfo' ? (sprog === 'da' ? '0,1 MB' : '0.1 MB') : n); if (!ud.includes(f)) forskel.push(`${sprog}.${k}(${n}): «${ud}» ≠ «${f}»`); }
  }
  tjek('R4: udvalgte tekster ved 0, 1 og 2 (bl.a. "1 sted" / "2 steder")', forskel.length === 0, forskel.join(' | '));
  S.saet('da');
})();
await (async () => {
  // Sager og Ordbog i vinduet: chip og fodlinje med 1.
  const rust = falskOrdbogRust({ poster: [{ type: 'ord', vaerdi: 'Uglebo' }], sager: [{ id: hexId(1), navn: 'Supportsag 0042', poster: 1 }], indst: { guide_vist: true } });
  const s = side({ hash: '#sager', rust });
  const { d, w } = s;
  await vent(20);
  tjek('V-OPBYG.2 N4: R4: Sager: chippen siger "1 sag"; fodlinjen sagens navn og gemte erstatninger', d.querySelector('section[data-visning="sager"] .vl .chip').textContent === 'i1 sag' && /^Midlertidig sag · \d+ (gemt erstatning|gemte erstatninger)$/.test(d.getElementById('fod-venstre').textContent), d.getElementById('fod-venstre').textContent);
  w.location.hash = 'ordbog';
  await vent(10);
  tjek('V-OPBYG.2 N4: R4: Ordbog: chippen siger "1 post"; fodlinjen sagens navn og gemte erstatninger', d.querySelector('section[data-visning="ordbog"] .vl .chip').textContent === 'i1 post' && /^Midlertidig sag · \d+ (gemt erstatning|gemte erstatninger)$/.test(d.getElementById('fod-venstre').textContent), d.getElementById('fod-venstre').textContent);
})();

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
await (async () => {
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
})();
await (async () => {
  // Start låst → laas_op én gang med det samme → annulleret: låseskærmen står, intet fra sagerne i DOM'en.
  const rust = falskLaasRust({ svar: [{ svar: 'annulleret' }] });
  const s = side({ rust });
  const { d, kald } = s;
  await vent(20);
  tjek('Lås: laas_op kaldes én gang ved start, på UI\'ets sprog', JSON.stringify(rust.st.opKald) === '["da"]', JSON.stringify(rust.st.opKald));
  tjek('Lås: annulleret → Grimnir er stadig låst (låseskærmen)', laaseskaerm(d));
  tjek('V-OPBYG.3 N2: Lås: låseskærmen har mærket (masken), overskrift, én sætning og to knapper', d.querySelector('#laas .mrk-maske.laas-mrk[aria-hidden="true"]') && d.querySelector('#laas .laas-mrk').textContent === '' && d.getElementById('laas-h').textContent === 'Grimnir er låst' && d.getElementById('laas-p').textContent === 'Lås op med Touch ID eller din adgangskode for at åbne dine sager og din ordbog.' && d.getElementById('laas-op').textContent === 'Lås op' && d.getElementById('laas-afslut').textContent === 'Afslut');
  tjek('Lås: Lås op er primær, Afslut sekundær; begge med aria-label', d.getElementById('laas-op').classList.contains('primary') && !d.getElementById('laas-afslut').classList.contains('primary') && /Touch ID/.test(d.getElementById('laas-op').getAttribute('aria-label')) && d.getElementById('laas-afslut').getAttribute('aria-label') === 'Afslut Grimnir');
  tjek('Lås: låseskærmen ligger på arbejdsfladen (#arb)', d.getElementById('laas').parentElement.id === 'arb');
  tjek('Lås: beskeden efter annullering', d.getElementById('laas-besked').textContent === 'Grimnir er stadig låst. Tryk Lås op for at prøve igen.', d.getElementById('laas-besked').textContent);
  tjek('Lås: fokus står på Lås op', d.activeElement === d.getElementById('laas-op'), d.activeElement && d.activeElement.id);
  tjek('Lås: båndet (med visningerne) og træet er inert, med forklaring i title', [...d.getElementById('baand').children].every(e => e.hasAttribute('inert')) && [...d.querySelectorAll('#baand .vk')].length === 25 && d.getElementById('navdele').hasAttribute('inert') && d.getElementById('baand').title === 'Grimnir er låst. Lås op for at bruge visningerne og kommandoerne.' && d.querySelector('nav.nav').title.length > 20);
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
  tjek('Lås: hjælpeteksten siger, hvad låsen ikke gør', /andre programmer/.test(d.getElementById('indst-stilstand-hj').textContent));
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
  tjek('Lås: ok → låseskærmen er væk', !laaseskaerm(d) && !d.getElementById('baand').hasAttribute('title') && ![...d.getElementById('baand').children].some(x => x.hasAttribute('inert')) && !d.querySelector('#baand .vk[inert], #baand [inert] .vk'));
  tjek('Lås: ok → Sager og Ordbog henter nu (kontrol: navnet står i DOM\'en)', kald.some(([c]) => c === 'sag_liste') && kald.some(([c]) => c === 'ordbog_hent') && /Uglebo-sagen/.test(altIDom(d)), JSON.stringify(fremmedeKald(kald)));
  tjek('Lås: ok → intet banner', d.getElementById('laas-banner').children.length === 0);
  tjek('Lås: ok → "Vis guiden igen" virker igen', !d.getElementById('indst-guide').disabled && !d.getElementById('indst-guide').hasAttribute('title'));
  tjek('Lås: alle laas_op-kald var på dansk', rust.st.opKald.every(x => x === 'da') && rust.st.opKald.length === 4, JSON.stringify(rust.st.opKald));
  s.tast('3', { metaKey: true, code: 'Digit3' });
  await vent(5);
  tjek('Lås: låst op virker ⌘3 igen', synlige(d).join() === 'noter');
})();
await (async () => {
  // Ok med det samme: låseskærmen forsvinder uden flere dialoger; guiden vises først nu (den bruger ordbogen).
  const rust = falskLaasRust({ svar: [{ svar: 'ok' }] });
  const { d, kald } = side({ rust });
  await vent(30);
  tjek('Lås: ok ved start → låst op, én dialog', !laaseskaerm(d) && rust.st.opKald.length === 1);
  tjek('Lås: ok ved start → data hentes efter oplåsningen, ikke før', kald.findIndex(([c]) => c === 'laas_op') < kald.findIndex(([c]) => c === 'sag_status') && kald.findIndex(([c]) => c === 'laas_op') < kald.findIndex(([c]) => c === 'ordbog_hent') && rust.st.kaldLaast.length === 0);
  tjek('Lås: ordbogen har en post → ingen guide efter oplåsningen', !d.getElementById('dlg-guide').hasAttribute('open'));
})();
await (async () => {
  // Tom ordbog og guiden ikke vist: guiden åbner ikke over låseskærmen, men først efter oplåsningen.
  const rust = falskLaasRust({ svar: [{ svar: 'annulleret' }, { svar: 'ok' }], poster: [] });
  const { d } = side({ rust });
  await vent(20);
  tjek('Lås: tom ordbog → ingen guide, mens der er låst', laaseskaerm(d) && !d.getElementById('dlg-guide').hasAttribute('open'));
  d.getElementById('laas-op').click();
  await vent(30);
  tjek('Lås: tom ordbog → guiden vises efter oplåsningen', !laaseskaerm(d) && d.getElementById('dlg-guide').hasAttribute('open'));
})();
await (async () => {
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
  tjek('Lås: banneret står også efter visningsskift (vedvarende)', d.querySelectorAll('#laas-banner .ban').length === 1 && synlige(d).join() === 'noter');
  // Engelsk: banneret skifter sprog.
  s.w.Sprog.saet('en');
  await vent(5);
  tjek('Lås: banneret på engelsk', d.querySelector('#laas-banner .ord').textContent === 'This machine cannot confirm who you are. Grimnir is not locked.');
})();
await (async () => {
  // Rust svarer, at der ikke er låst (V-LAAS.3: indstillingen er væk; det sker kun, hvis siden genindlæses efter
  // oplåsning): ingen dialog, intet banner.
  const rust = falskLaasRust({ laast: false });
  const { d } = side({ rust });
  await vent(20);
  tjek('Lås: ulåst ved start → ingen laas_op, ingen låseskærm', rust.st.opKald.length === 0 && !laaseskaerm(d) && d.getElementById('laas-banner').children.length === 0);
})();
await (async () => {
  // Engelsk: låseskærmen og laas_op på engelsk.
  const rust = falskLaasRust({ svar: [{ svar: 'annulleret' }] });
  const { d } = side({ rust, lager: { 'grimnir-sprog': 'en' } });
  await vent(20);
  tjek('Lås (en): laas_op på engelsk', JSON.stringify(rust.st.opKald) === '["en"]');
  tjek('Lås (en): låseskærmen på engelsk', d.getElementById('laas-h').textContent === 'Grimnir is locked' && d.getElementById('laas-p').textContent === 'Unlock with Touch ID or your password to open your cases and your dictionary.' && d.getElementById('laas-op').textContent === 'Unlock' && d.getElementById('laas-afslut').textContent === 'Quit' && d.getElementById('laas-besked').textContent === 'Grimnir is still locked. Press Unlock to try again.');
  tjek('Lås (en): forklaringen på båndet på engelsk', d.getElementById('baand').title === 'Grimnir is locked. Unlock to use the views and commands.');
  tjek('Lås (en): intet fra sagerne i DOM\'en', !/Uglebo|Kragevig/.test(altIDom(d)));
})();
await (async () => {
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
})();
await (async () => {
  // Windows (ingen dør i denne cyklus): hjælpeteksten lover ikke en lås ved start, men nævner stilstand.
  const { d } = side({ platform: 'windows' });
  await vent(10);
  tjek('Lås (Windows): hjælpeteksten siger, at Grimnir ikke starter låst her', d.getElementById('indst-stilstand-hj').textContent.startsWith('Denne maskine kan endnu ikke bekræfte, hvem du er, så Grimnir starter ikke låst her.') && /stået stille/.test(d.getElementById('indst-stilstand-hj').textContent));
})();

// ── V-LAAS.3: låsen kan ikke slås fra, og Grimnir låser igen. Efterlignet Rust som V-LAAS.2 (falskLaasRust) med
// laasIgen (som Rusts laas_igen) og hændelsen `laast`. Kun opdigtede navne. ──
await (async () => {
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
    tjek(`V-LAAS.3 (${lang}): standard 15 minutter; aria-label og hjælpetekst`, sel.value === '15' && sel.getAttribute('aria-label') === t.label && sel.getAttribute('aria-describedby') === 'indst-stilstand-hj');
    const hj = d.getElementById('indst-stilstand-hj').textContent;
    tjek(`V-LAAS.3 (${lang}): hjælpeteksten siger, hvad låsen beskytter imod, og hvornår den låser igen`, t.ord.every(r => r.test(hj)), hj);
  }
})();
await (async () => {
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
})();
await (async () => {
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
})();
await (async () => {
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
})();
await (async () => {
  // Ved programmets start kaldes laas_op stadig af sig selv (én gang), også efter V-LAAS.3.
  const rust = falskLaasRust({ svar: [{ svar: 'annulleret' }] });
  side({ rust });
  await vent(30);
  tjek('V-LAAS.3: ved start kaldes laas_op én gang af sig selv', rust.st.opKald.length === 1);
})();
await (async () => {
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
})();
await (async () => {
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
  tjek('V-LAAS.3: ikonerne tegnes med 2 px streg (kit.css)', /stroke: currentColor; stroke-width: 2;/.test(ui('assets/kit.css')));
})();

// ── V-LAAS.4: ved lås gemmes den midlertidige sag (beskeden med navnet), og udklipsholderen ryddes (meldingen efter
// Kopiér i Demaskér; teksten i Indstillinger). Efterlignet Rust som V-LAAS.3. Kun opdigtede navne. ──
await (async () => {
  const udenKommentarer = t => t.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const kode = udenKommentarer(ui('index.html') + ['app.js', 'laas.js', 'maskering.js', 'sager.js', 'ordbog.js', 'indstillinger.js', 'kit.js', 'sprogmotor.js', 'sprog.js', 'tema.js'].map(f => ui('assets/' + f)).join('\n'));
  tjek('V-LAAS.4: webvisningen læser aldrig udklipsholderen (ingen readText/read())', kode.length > 50000 && !/readText|clipboard\.read\(/.test(kode));
  tjek('V-LAAS.4: udklip_kopieret kaldes ét sted (Kopiér i Demaskér)', (kode.match(/invoke\('udklip_kopieret'/g) || []).length === 1);
  tjek('V-KVIT.1: kvittering kaldes ét sted (Kopiér kvittering i Maskér), og dér meldes intet til udklip_kopieret', (kode.match(/invoke\('kvittering'/g) || []).length === 1 && !/udklip_kopieret/.test(kode.slice(kode.indexOf('async function kopierKvittering'), kode.indexOf("document.addEventListener('grimnir-ordbog'"))));
  tjek('V-LAAS.4: den gamle besked "blev lukket" er væk', !/bMidlertidigLukket|blev lukket, da Grimnir|was closed when Grimnir/.test(kode));
})();
// V-LAAS.5 N2: navnet har sekunder (TT.MM.SS); beskeden er ellers uændret.
const NAVN4 = { da: 'Midlertidig 2026-11-11 09.05.30', en: 'Temporary 2026-11-11 09.05.30' };
await (async () => { for (const lang of ['da', 'en']) {
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
} })();
await (async () => { for (const lang of ['da', 'en']) {
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
} })();
await (async () => { for (const lang of ['da', 'en']) {
  // Indstillinger: én sætning om udklipsholderen i teksten om låsen (macOS). Windows rydder intet og lover det ikke.
  const s = side({ lager: { 'grimnir-sprog': lang } });
  await vent(10);
  s.emit('menu', 'indstillinger');
  await vent(5);
  const hj = s.d.getElementById('indst-stilstand-hj').textContent;
  // V-LAAS.5 N1: "når den låser eller afsluttes" / "when it locks or quits".
  const r = lang === 'da' ? /Har du kopieret en demaskeret tekst med Kopiér resultat, fjerner Grimnir den fra udklipsholderen, når den låser eller afsluttes, hvis den stadig ligger der\./ : /If you copied unmasked text with Copy result, Grimnir removes it from the clipboard when it locks or quits, if it is still there\./;
  tjek(`V-LAAS.4/5 (${lang}): Indstillinger siger, at kopieret demaskeret tekst fjernes fra udklipsholderen ved lås og ved afslut`, r.test(hj), hj);
  const win = side({ platform: 'windows', lager: { 'grimnir-sprog': lang } });
  await vent(10);
  tjek(`V-LAAS.4 (${lang}, Windows): teksten lover ikke at rydde udklipsholderen`, !/udklipsholder|clipboard/i.test(win.d.getElementById('indst-stilstand-hj').textContent));
} })();
await (async () => {
  // En kopi, der ikke lykkedes, meldes ikke.
  const s = side({ hash: '#demasker', rust: falskRust(), foer: w => Object.defineProperty(w.navigator, 'clipboard', { value: { writeText: async () => { throw new Error('nægtet'); } }, configurable: true }) });
  const { d, w } = s;
  await vent(5);
  w.GrimnirMaskering.saetSag(3);
  indsaet(w, d.querySelector('section[data-visning="demasker"] .tomt'), 'Prøv kunde01 på GRIMNIR_SECRET_0001\n');
  s.tast('Enter', { metaKey: true });
  await vent(5);
  knapI(d, 'demasker', 'kopier-resultat').click();
  await vent(5);
  tjek('V-LAAS.4: kontrol: demaskeret, og Kopiér er prøvet', s.kald.some(k => k[0] === 'demasker') && d.querySelector('section[data-visning="demasker"] .ban.danger'));
  tjek('V-LAAS.4: en kopi, der fejlede, meldes ikke til Rust', !s.kald.some(k => k[0] === 'udklip_kopieret'));
})();

// ── V-LAAS.5: udklipsholderen ved Afslut (teksten i Indstillinger; se også V-LAAS.4-blokken), navnet med sekunder i
// beskeden (V-LAAS.4-blokken), og navn, slogan og beskrivelse (N3, ADR D22). Kun opdigtede navne. ──
await (async () => {
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
})();
await (async () => { for (const lang of ['da', 'en']) {
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
  om.querySelector('[data-svar="luk"]').click();
} })();
await (async () => { for (const lang of ['da', 'en']) {
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
} })();
await (async () => {
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
})();
// ── V-LAAS.6 N2: programmet blev afsluttet uden at spørge (Afslut fra Dock, log ud), og den midlertidige sag blev gemt.
// Ved næste start (låst, ikke "låst igen") kalder UI'et laas_op af sig selv, og svaret har beskeden med navnet: samme
// besked som efter en lås, én gang. Kun opdigtede navne. ──
const NAVN6 = { da: 'Midlertidig 2026-11-11 17.42.08', en: 'Temporary 2026-11-11 17.42.08' };
await (async () => { for (const lang of ['da', 'en']) {
  const rust = falskLaasRust({ laast: true, igen: null, svar: [{ svar: 'ok' }], efter: { midlertidig_gemt: NAVN6[lang], midlertidig_fejl: null, gem_fejl: null } });
  const s = side({ rust, lager: { 'grimnir-sprog': lang } });
  const { d } = s;
  await vent(30);
  tjek(`V-LAAS.6 (${lang}): ved start kaldes laas_op af sig selv, én gang, på UI'ets sprog`, JSON.stringify(rust.st.opKald) === JSON.stringify([lang]), JSON.stringify(rust.st.opKald));
  const b = d.querySelector('#laas-banner .ban[data-efter="bMidlertidigGemt"]');
  const ord = b && b.querySelector('.ord').textContent;
  const ventet = lang === 'da' ? `Den midlertidige sag blev gemt som «${NAVN6.da}».` : `The temporary case was saved as "${NAVN6.en}".`;
  tjek(`V-LAAS.6 (${lang}): efter oplåsningen ved start nævner beskeden navnet`, !laaseskaerm(d) && ord === ventet, ord);
  tjek(`V-LAAS.6 (${lang}): samme besked som efter en lås (info, role=status, Luk-knap)`, b && b.classList.contains('info') && b.getAttribute('role') === 'status' && b.querySelector('button').getAttribute('aria-label') === (lang === 'da' ? 'Luk beskeden' : 'Close the message'));
  tjek(`V-LAAS.6 (${lang}): én besked, navnet som tekst, og sagen åbnes ikke af sig selv`, d.querySelectorAll('#laas-banner .ban[data-efter]').length === 1 && b.querySelector('.ord').children.length === 0 && !s.kald.some(([c]) => c === 'sag_aabn'));
  b.querySelector('button').click();
  tjek(`V-LAAS.6 (${lang}): Luk fjerner beskeden`, !d.querySelector('#laas-banner .ban[data-efter]'));
  // Næste start igen: Rust har givet beskeden (og slettet filen); den kommer ikke igen.
  rust.st.laast = true;
  rust.st.kue.push({ svar: 'ok' });
  const s2 = side({ rust, lager: { 'grimnir-sprog': lang } });
  await vent(30);
  tjek(`V-LAAS.6 (${lang}): ved start efter det kommer beskeden ikke igen`, !laaseskaerm(s2.d) && rust.st.opKald.length === 2 && !s2.d.querySelector('#laas-banner .ban[data-efter]'));
} })();

// ── V-PUDS.1: småting efter låsecyklerne og vinduesprøven. N2: teksten i sagspanelet (begge sprog, ental og flertal).
// N3: Altid/Aldrig har ordet i knappen; app.css viser det fra 1200 px (jsdom anvender ikke @media, så reglerne læses som i
// kolonner.mjs; bredderne regnes i kolonner.mjs). N4: Demaskér-tabellen viser Antal og Linje fra Rust. Kun opdigtede data. ──
await (async () => {
  const SAGP = {
    da: [[1, 'Sagen husker 1 værdi i hukommelsen. Gem som sag gemmer den krypteret på denne maskine. Låser eller afsluttes Grimnir, gemmes sagen automatisk under et dato-navn, medmindre du kasserer den. Nulstil glemmer den, og et svar med den kode kan derefter ikke demaskeres.'],
      [2, 'Sagen husker 2 værdier i hukommelsen. Gem som sag gemmer den krypteret på denne maskine. Låser eller afsluttes Grimnir, gemmes sagen automatisk under et dato-navn, medmindre du kasserer den. Nulstil glemmer dem, og et svar med de koder kan derefter ikke demaskeres.']],
    en: [[1, 'The case remembers 1 value in memory. Save as case stores it encrypted on this machine. If Grimnir locks or quits, the case is saved automatically under a date name, unless you discard it. Reset forgets it, and a reply with that code can no longer be unmasked.'],
      [2, 'The case remembers 2 values in memory. Save as case stores it encrypted on this machine. If Grimnir locks or quits, the case is saved automatically under a date name, unless you discard it. Reset forgets them, and a reply with those codes can no longer be unmasked.']],
  };
  for (const lang of ['da', 'en']) {
    const s = side({ rust: falskRust(), lager: { 'grimnir-sprog': lang } });
    const { d, w } = s;
    await vent(5);
    for (const [n, ventet] of SAGP[lang]) {
      w.GrimnirMaskering.saetSag(n);
      d.getElementById('sag-knap').click();
      const p = d.getElementById('dlg-sag-p').textContent;
      tjek(`V-PUDS.1 N2 (${lang}, ${n}): sagspanelet siger, at sagen gemmes ved lås og afslutning`, d.getElementById('dlg-sag').hasAttribute('open') && p === ventet, p);
      d.querySelector('#dlg-sag [data-svar="luk"]').click();
    }
  }
  const T = side().w.Sprog.TEKST;
  tjek('V-PUDS.1 N2: ingen tekst siger længere "til Grimnir lukkes" / "until Grimnir closes"', !Object.values(T.da).some(x => /til Grimnir lukkes/.test(x)) && !Object.values(T.en).some(x => /until Grimnir closes/.test(x)));
})();
await (async () => {
  // N3: knapperne i begge sprog: ikon + ordet (det skjulte ord, som CSS'en viser ved brede tabeller); title og aria-label uændrede.
  for (const lang of ['da', 'en']) {
    const rust = falskOrdbogRust({ poster: ORDBOG(), sager: SAGER(), indst: { guide_vist: true } });
    const s = side({ rust, lager: { 'grimnir-sprog': lang } });
    const { d, w } = s;
    await vent(20);
    const sek = d.querySelector('section[data-visning="masker"]');
    indsaet(w, sek.querySelector('.tomt'), TEKST);
    s.tast('Enter', { metaKey: true });
    await vent(10);
    const [altid, aldrig] = [...raekkeMed(d, 24).querySelectorAll('.ordbogknapper button')];
    const ord = b => b.querySelector('.skjult-tekst') && b.querySelector('.skjult-tekst').textContent;
    const V = lang === 'da'
      ? { ord: ['Altid', 'Aldrig'], title: ['Maskér altid: læg værdien i ordbogen', 'Maskér aldrig: læg værdien i ordbogen'], kol: 'Ordbog' }
      : { ord: ['Always', 'Never'], title: ['Always mask: add the value to the dictionary', 'Never mask: add the value to the dictionary'], kol: 'Dictionary' };
    tjek(`V-PUDS.1 N3 (${lang}): Altid/Aldrig har ikonet og ordet i knappen (${V.ord.join('/')})`, [altid, aldrig].every(b => b.classList.contains('ikonknap') && b.firstElementChild.matches('svg.ik')) && ord(altid) === V.ord[0] && ord(aldrig) === V.ord[1]);
    tjek(`V-PUDS.1 N3 (${lang}): title og aria-label er de samme som før`, altid.title === V.title[0] && aldrig.title === V.title[1] && altid.getAttribute('aria-label') === w.Sprog.TEKST[lang].ariaAltid.replace('{v}', 'bruger060') && aldrig.getAttribute('aria-label') === w.Sprog.TEKST[lang].ariaAldrig.replace('{v}', 'bruger060'), altid.getAttribute('aria-label'));
    const th = [...sek.querySelectorAll('.fundtabel thead th')].map(x => x.textContent);
    tjek(`V-PUDS.1 N3 (${lang}): kolonnens overskrift er "${V.kol}" (kolOrdbog)`, th[6] === V.kol, th.join(' | '));
  }
  // CSS'en: ordet vises af @media-regler; 900 px rammer ingen af dem, 1200 px gør.
  const css = ui('assets/app.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const blokke = [...css.matchAll(/@media ([^{]+)\{((?:[^{}]*\{[^}]*\})*)\s*\}/g)].map(m => ({ hvor: m[1], indhold: m[2] }));
  const viser = blokke.filter(b => /\.fundtabel \.ordbogknapper \.skjult-tekst \{[^}]*position: static/.test(b.indhold));
  const passer = (hvor, W) => { const mn = hvor.match(/min-width:\s*(\d+)px/), mx = hvor.match(/max-width:\s*(\d+)px/); return (!mn || W >= +mn[1]) && (!mx || W <= +mx[1]); };
  tjek('V-PUDS.1 N3: ordet vises kun i @media-regler (uden for dem er det skjult som før)', viser.length >= 1 && !/^\s*\.fundtabel \.ordbogknapper \.skjult-tekst/m.test(css.replace(/@media[^{]+\{(?:[^{}]*\{[^}]*\})*\s*\}/g, '')));
  tjek('V-PUDS.1 N3: ved 900 px kun ikonet', !viser.some(b => passer(b.hvor, 900)));
  // V-OPBYG.5 N2: grænsen er flyttet fra 1200 til 1210 px ("…"-knappen står også i Ordbog-cellen).
  tjek('V-OPBYG.5 N2: ved 1210 px ikon og ord, med plads i Ordbog-kolonnen (--k7) i begge sprog', !viser.some(b => passer(b.hvor, 1209)) && viser.some(b => passer(b.hvor, 1210) && /(^|\s)(:root:not\(\[data-tekst="stor"\]\) )?\.fundtabel \{[^}]*--k7:/.test(b.indhold) && /(html|:root:not\(\[data-tekst="stor"\]\))\[lang="en"\] \.fundtabel \{[^}]*--k7:/.test(b.indhold)));
})();
await (async () => {
  // N4: indsat tekst: Antal og Linje for hver kode, der er sat tilbage, fra Rust (tilbage); CRLF og to gange på én linje.
  const s = side({ rust: falskRust() });
  const { d, w } = s;
  await vent(5);
  indsaet(w, d.querySelector('section[data-visning="masker"] .tomt'), TEKST);
  await vent(5); // V-OPBYG.1 N3: analysen sker ved indsætning (før ⌘↵ første gang)
  s.tast('Enter', { metaKey: true }); await vent(5);
  w.location.hash = 'demasker';
  await vent(5);
  const dsek = d.querySelector('section[data-visning="demasker"]');
  indsaet(w, dsek.querySelector('.tomt'), 'Svar fra leverandøren\r\nuser0001 og user0001 igen\r\nGRIMNIR_SECRET_0001\r\n');
  s.tast('Enter', { metaKey: true }); await vent(5);
  const raekke = kode => { const tr = [...dsek.querySelectorAll('.advtabel tbody tr')].find(x => x.children[1] && x.children[1].textContent === kode && x.textContent.includes('Sat tilbage')); return tr ? [...tr.children].map(c => c.textContent) : []; };
  const u = raekke('user0001'), g = raekke('GRIMNIR_SECRET_0001');
  tjek('V-PUDS.1 N4: indsat tekst: user0001 sat tilbage 2 steder, første på linje 2', u[2] === '2' && u[3] === '2', u.join(' | '));
  tjek('V-PUDS.1 N4: indsat tekst: GRIMNIR_SECRET_0001 sat tilbage 1 sted, linje 3', g[2] === '1' && g[3] === '3', g.join(' | '));
  const th = [...dsek.querySelectorAll('.advtabel thead th')].map(x => x.textContent);
  tjek('V-PUDS.1 N4: Demaskér-tabellen har kolonnerne Hvad, Kode, Antal, Linje', th.join() === 'Hvad,Kode,Antal,Linje', th.join());
  const m = ui('assets/maskering.js');
  const raekkerFn = m.slice(m.indexOf('function raekker() {', m.indexOf('Demaskér ═')), m.indexOf('function tegnTabel()', m.indexOf('Demaskér ═')));
  tjek('V-PUDS.1 N4: webvisningen tæller ikke selv (rækkerne bygges af tilbage fra Rust)', /st\.resultat\.tilbage/.test(raekkerFn) && !/split\(|indexOf\(|match\(/.test(raekkerFn) && /tilbage: r\.tilbage/.test(m));
})();

// ══════════════════════════ V-KVIT.1: Kopiér kvittering ══════════════════════════
// Engelsk, uden ClipboardItem (teksten hentes og kopieres med writeText), nedtonet mens Grimnir arbejder, fejl fra Rust,
// en kopi, der fejler, og Nulstil. Den efterlignede Rust svarer som src-tauri/src/maskering.rs (en tekst eller en fejl).
await (async () => {
  const skrevet = [];
  const s = side({ rust: falskRust(), lager: { 'grimnir-sprog': 'en' }, foer: w => Object.defineProperty(w.navigator, 'clipboard', { value: { writeText: async t => { skrevet.push(t); } }, configurable: true }) });
  const { d, w } = s;
  await vent(5);
  const sek = d.querySelector('section[data-visning="masker"]');
  const kv = knapI(d, 'masker', 'kvittering');
  tjek('V-KVIT.1: English: Copy receipt, nedtonet fra start med forklaring', kv.textContent.trim() === 'Copy receipt' && !kommandoAktiv(d, 'masker', 'kvittering') && forklaring(kv) === 'Mask the text first');
  indsaet(w, sek.querySelector('.tomt'), TEKST);
  s.tast('Enter', { metaKey: true }); await vent(5);
  tjek('V-KVIT.1: efter analysen alene er Copy receipt stadig nedtonet', !kommandoAktiv(d, 'masker', 'kvittering') && forklaring(kv) === 'Mask the text first');
  s.tast('Enter', { metaKey: true }); await vent(5);
  tjek('V-KVIT.1: English: aktiv efter maskeringen', kommandoAktiv(d, 'masker', 'kvittering') && !kv.title);
  kv.click(); await vent(5);
  tjek('V-KVIT.1: English: Rust får sproget en, og teksten kopieres', JSON.stringify(s.kald.filter(k => k[0] === 'kvittering').map(k => k[1])) === '[{"fil":false,"sprog":"en"}]' && skrevet.join('|') === 'KVITTERING en tekst\n');
  tjek('V-KVIT.1: English: bekræftelsen', sek.querySelector('.besked').textContent === 'The receipt is copied. It contains no original values.');
  tjek('V-KVIT.1: English: intet meldes til udklip_kopieret', !s.kald.some(k => k[0] === 'udklip_kopieret'));
  // Kan fokuseres og aktiveres med tastaturet som de andre kommandoer (en knap).
  tjek('V-KVIT.1: knappen er en <button> med ikon', kv.tagName === 'BUTTON' && Boolean(kv.querySelector('svg')));
  // Nulstil sagen: resultatet er væk, og knappen er nedtonet.
  w.GrimnirMaskering.M.nulstilt();
  tjek('V-KVIT.1: efter Nulstil er Copy receipt nedtonet', !kommandoAktiv(d, 'masker', 'kvittering') && forklaring(kv) === 'Mask the text first');
  kv.click(); await vent(5);
  tjek('V-KVIT.1: efter Nulstil hentes ingen kvittering', s.kald.filter(k => k[0] === 'kvittering').length === 1 && skrevet.length === 1);
})();
await (async () => {
  // Rust svarer med en fejl (intet resultat, eller låst imens): et banner, ingen bekræftelse og intet kopieret.
  const skrevet = [];
  const rust = { ...falskRust(), kvittering: () => { throw { art: 'intet_resultat' }; } };
  const s = side({ rust, foer: w => Object.defineProperty(w.navigator, 'clipboard', { value: { writeText: async t => { skrevet.push(t); } }, configurable: true }) });
  const { d, w } = s;
  await vent(5);
  const sek = d.querySelector('section[data-visning="masker"]');
  indsaet(w, sek.querySelector('.tomt'), TEKST);
  await vent(5); // V-OPBYG.1 N3: analysen sker ved indsætning (før ⌘↵ første gang)
  s.tast('Enter', { metaKey: true }); await vent(5);
  knapI(d, 'masker', 'kvittering').click(); await vent(5);
  tjek('V-KVIT.1: fejl fra Rust: banner, ingen bekræftelse, intet kopieret', Boolean(sek.querySelector('.arbejde .bannere .ban.danger')) && sek.querySelector('.besked').textContent === '' && skrevet.length === 0, sek.querySelector('.besked').textContent);
})();
await (async () => {
  // Udklipsholderen afviser: fejlbanner med kvitteringens egen tekst, ingen bekræftelse.
  const s = side({ rust: falskRust(), foer: w => Object.defineProperty(w.navigator, 'clipboard', { value: { writeText: async () => { throw new Error('nægtet'); } }, configurable: true }) });
  const { d, w } = s;
  await vent(5);
  const sek = d.querySelector('section[data-visning="masker"]');
  indsaet(w, sek.querySelector('.tomt'), TEKST);
  await vent(5); // V-OPBYG.1 N3: analysen sker ved indsætning (før ⌘↵ første gang)
  s.tast('Enter', { metaKey: true }); await vent(5);
  knapI(d, 'masker', 'kvittering').click(); await vent(5);
  tjek('V-KVIT.1: en kopi, der fejler: "Grimnir kunne ikke kopiere kvitteringen."', [...sek.querySelectorAll('.arbejde .bannere .ban.danger')].some(b => b.textContent.includes('Grimnir kunne ikke kopiere kvitteringen.')) && sek.querySelector('.besked').textContent === '');
  tjek('V-KVIT.1: en kopi, der fejler, meldes heller ikke til Rust', !s.kald.some(k => k[0] === 'udklip_kopieret'));
})();
await (async () => {
  // Med ClipboardItem (WebKit): teksten gives som et løfte i selve klikket, som for Kopiér af et filresultat.
  const skrevet = [];
  const s = side({
    rust: falskRust(),
    foer: w => {
      w.ClipboardItem = function (x) { this.x = x; };
      Object.defineProperty(w.navigator, 'clipboard', { value: { write: async items => { const b = await items[0].x['text/plain']; skrevet.push(await new Promise(r => { const fr = new w.FileReader(); fr.onload = () => r(fr.result); fr.readAsText(b); })); }, writeText: async () => { throw new Error('ikke denne vej'); } }, configurable: true });
    },
  });
  const { d, w } = s;
  await vent(5);
  const sek = d.querySelector('section[data-visning="masker"]');
  indsaet(w, sek.querySelector('.tomt'), TEKST);
  await vent(5); // V-OPBYG.1 N3: analysen sker ved indsætning (før ⌘↵ første gang)
  s.tast('Enter', { metaKey: true }); await vent(5);
  knapI(d, 'masker', 'kvittering').click(); await vent(10);
  tjek('V-KVIT.1: med ClipboardItem: kvitteringen skrives i klikket (samme vej som Kopiér af en fil)', skrevet.join('|') === 'KVITTERING da tekst\n' && s.kald.filter(k => k[0] === 'kvittering').length === 1 && sek.querySelector('.besked').textContent.startsWith('Kvitteringen er kopieret.'), JSON.stringify(skrevet));
})();
await (async () => {
  // Statisk: kommandoen står i Rust tre steder (generate_handler!, build.rs, capabilities), og teksterne findes på begge sprog.
  const rd = f => fs.readFileSync(path.join(repo, 'src-tauri', f), 'utf8');
  const lib = rd('src/lib.rs');
  tjek('V-KVIT.1: kvittering står i generate_handler!, build.rs og capabilities', /generate_handler!\[[^\]]*\bkvittering\b/.test(lib) && /"kvittering",/.test(rd('build.rs')) && JSON.parse(rd('capabilities/default.json')).permissions.includes('allow-kvittering'));
  const { w } = side();
  const T = w.Sprog.TEKST;
  tjek('V-KVIT.1: teksterne findes på dansk og engelsk', ['kKvittering', 'bKvitteringKopieret', 'bKvitteringFejl'].every(k => T.da[k] && T.en[k] && T.da[k] !== T.en[k]));
  tjek('V-KVIT.1: ingen gem-som-fil for kvitteringen (kun kopiering)', !/kvittering[^\n]*fil_gem|gem-kvittering/.test(ui('assets/maskering.js') + ui('assets/app.js')));
})();

// ── V-KITBRUG.1: kittets komponenter og tekststørrelsen (K17). Kun opdigtede data; ingen rigtig udklipsholder eller
// Nøglering (falske Rust-svar som i resten af filen). jsdom tegner ikke: zoom og målene er målt i WKWebView (HANDOFF);
// her prøves attributterne, valget, at det huskes, markup, navne, tilstande og tastaturet. ──
await (async () => {
  // N2: uden valg ingen attribut; Indstillinger har kittets radiogruppe med tre trin.
  const s = side();
  const { d, w } = s;
  await vent(5);
  const html = d.documentElement;
  tjek('V-KITBRUG.1 N2: uden valg står der ingen data-tekst på <html> og intet i localStorage', !html.hasAttribute('data-tekst') && w.localStorage.getItem('grimnir-tekst') === null && w.Tekst.valg === 'normal');
  tjek('V-KITBRUG.1 N2: <html> har de samme attributter som før (ingen ny)', JSON.stringify([...html.attributes].map(a => a.name).sort()) === JSON.stringify(['data-kit-praefiks', 'data-platform', 'data-tema', 'lang']), [...html.attributes].map(a => a.name).join());
  s.emit('menu', 'indstillinger'); await vent(5);
  const g = d.querySelector('#dlg-indst fieldset.valgsaet.vandret:has(input[name="indst-tekst"])');
  const r = v => d.querySelector(`input[name="indst-tekst"][value="${v}"]`);
  tjek('V-KITBRUG.1 N2: Indstillinger har Tekststørrelse som kittets radiogruppe (fieldset, legend, tre radioknapper i en række)', g && g.querySelector('legend').textContent === 'Tekststørrelse' && [...g.querySelectorAll('input.afk-boks[type="radio"]')].map(i => i.value).join() === 'lille,normal,stor');
  tjek('V-KITBRUG.1 N2: hvert trin har navn (etiket og aria-label) på dansk', ['lille', 'normal', 'stor'].map(v => r(v).closest('label').textContent + '/' + r(v).getAttribute('aria-label')).join() === 'Lille/Lille,Normal/Normal,Stor/Stor');
  tjek('V-KITBRUG.1 N2: Normal er valgt uden et valg', r('normal').checked && !r('lille').checked && !r('stor').checked);
  tjek('V-KITBRUG.1 N2: tema, sprog og tekststørrelse står i den rækkefølge øverst i Indstillinger', [...d.querySelectorAll('#indst-valg > fieldset.valgsaet legend')].map(l => l.textContent).join() === 'Tema,Sprog,Tekststørrelse');
  r('stor').checked = true;
  r('stor').dispatchEvent(new w.Event('change', { bubbles: true }));
  tjek('V-KITBRUG.1 N2: Stor virker straks: <html data-tekst="stor">, mens dialogen er åben', html.getAttribute('data-tekst') === 'stor' && aaben(d, 'dlg-indst') && d.getElementById('dlg-indst').closest('html') === html);
  tjek('V-KITBRUG.1 N2: valget huskes af kittet (localStorage grimnir-tekst)', w.localStorage.getItem('grimnir-tekst') === 'stor');
  r('lille').checked = true;
  r('lille').dispatchEvent(new w.Event('change', { bubbles: true }));
  tjek('V-KITBRUG.1 N2: Lille giver data-tekst="lille"', html.getAttribute('data-tekst') === 'lille' && w.localStorage.getItem('grimnir-tekst') === 'lille');
  r('normal').checked = true;
  r('normal').dispatchEvent(new w.Event('change', { bubbles: true }));
  tjek('V-KITBRUG.1 N2: Normal fjerner attributten igen', !html.hasAttribute('data-tekst') && w.localStorage.getItem('grimnir-tekst') === 'normal');
  w.Tekst.saet('stor');
  tjek('V-KITBRUG.1 N2: et skift fra koden (Tekst.saet) vises i Indstillinger (hændelsen grimnir-tekst)', r('stor').checked && !r('normal').checked);
  // Sprog: engelsk.
  w.Sprog.saet('en');
  tjek('V-KITBRUG.1 N2: på engelsk Text size med Small, Normal og Large', g.querySelector('legend').textContent === 'Text size' && ['lille', 'normal', 'stor'].map(v => r(v).closest('label').textContent + '/' + r(v).getAttribute('aria-label')).join() === 'Small/Small,Normal/Normal,Large/Large');
  w.Sprog.saet('da');
  // Huskes: en ny side med valget i localStorage.
  const s2 = side({ lager: { 'grimnir-tekst': 'stor' } });
  await vent(5);
  tjek('V-KITBRUG.1 N2: valget huskes ved næste start (sat af tema.js før første tegning)', s2.d.documentElement.getAttribute('data-tekst') === 'stor' && s2.d.querySelector('input[name="indst-tekst"][value="stor"]').checked);
})();
await (async () => {
  // N2: låseskærmen. Låst ved start: trinnet gælder, og Indstillinger (med tekststørrelsen) virker, mens der er låst.
  const rust = falskLaasRust({ svar: [{ svar: 'annulleret' }] });
  const s = side({ rust, lager: { 'grimnir-tekst': 'stor' } });
  const { d, w } = s;
  await vent(30);
  const html = d.documentElement;
  tjek('V-KITBRUG.1 N2: låst: låseskærmen står, og trinnet stor gælder for hele siden (<html>)', html.hasAttribute('data-laast') && html.getAttribute('data-tekst') === 'stor' && html.contains(d.getElementById('laas')));
  s.emit('menu', 'indstillinger'); await vent(5);
  const lille = d.querySelector('input[name="indst-tekst"][value="lille"]');
  lille.checked = true;
  lille.dispatchEvent(new w.Event('change', { bubbles: true }));
  tjek('V-KITBRUG.1 N2: låst: tekststørrelsen kan skiftes i Indstillinger', html.getAttribute('data-tekst') === 'lille' && html.hasAttribute('data-laast'));
})();
await (async () => {
  // N2: CSS'en. Kittets zoom; Grimnirs mål, der følger vinduet, er delt med trinnet; trafiklysene har 80 px i alle trin.
  const kit = ui('assets/kit.css'), app = ui('assets/app.css').replace(/\/\*[\s\S]*?\*\//g, '');
  tjek('V-KITBRUG.1 N2: kit.css har zoom 0,9 og 1,125 på roden (kittets, uændret)', /:root\[data-tekst="lille"\] \{ zoom: \.9; \}/.test(kit) && /:root\[data-tekst="stor"\] \{ zoom: 1\.125; \}/.test(kit));
  // V-KITBRUG.2 N3 (G10): trinnet er kittets --tekst-zoom (kit.css); Grimnirs egen --z er væk.
  tjek('V-KITBRUG.2 N3 (G10): app.css bruger kittets --tekst-zoom (1, ,9 og 1,125 i kit.css) og har ingen egen --z', /:root \{ --tekst-zoom: 1; \}/.test(kit) && /:root\[data-tekst="lille"\] \{ --tekst-zoom: \.9; \}/.test(kit) && /:root\[data-tekst="stor"\] \{ --tekst-zoom: 1\.125; \}/.test(kit) && !/--z\b/.test(app) && /var\(--tekst-zoom\)/.test(app));
  const vhvw = [...app.matchAll(/[^;{}]*\b\d+v[hw]\b[^;{}]*/g)].map(m => m[0].trim());
  tjek('V-KITBRUG.2 N3 (G10): hvert vh og vw i app.css er delt med trinnet (calc(… / var(--tekst-zoom)))', vhvw.length >= 2 && vhvw.every(x => /\d+v[hw] \/ var\(--tekst-zoom\)/.test(x)), vhvw.filter(x => !/\/ var\(--tekst-zoom\)/.test(x)).join(' | '));
  tjek('V-KITBRUG.1 N2: trafiklysenes plads er 80 px på skærmen i alle trin', /\[data-platform="macos"\] \.titel \{ padding-left: calc\(80px \/ var\(--tekst-zoom\)\); \}/.test(app));
  const medier = [...app.matchAll(/@media ([^{]+)\{/g)].map(m => m[1].trim()).filter(m => /width/.test(m));
  tjek('V-KITBRUG.1 N2: hver bredde-grænse findes også for stor (× 1,125)', [['min-width: 1200px', 'min-width: 1350px'], ['max-width: 1719px', 'max-width: 1934px'], ['min-width: 1210px', 'min-width: 1362px'], ['min-width: 1860px', 'min-width: 2093px'], ['max-width: 1099px', 'max-width: 1237px']].every(([a, b]) => medier.some(m => m.includes(a)) && medier.some(m => m.includes(b))), medier.join(' | '));
})();
await (async () => {
  // N3: afkrydsning, radiogruppe, valgliste og tom tilstand er kittets; id, navn og hjælpetekst er bevaret.
  const rust = falskOrdbogRust({ indst: { guide_vist: true } });
  const s = side({ rust });
  const { d, w } = s;
  await vent(20);
  tjek('V-KITBRUG.1 N3: ingen label.afkryds og ingen .tom tilbage i DOM\'en', !d.querySelector('.afkryds, .tom, .tom-ikon, .arbejder'));
  for (const [id, navn, hj] of [['indst-fremmede', 'Maskér fremmede offentlige adresser', 'indst-fremmede-hj'], ['indst-oktet', 'Bevar sidste oktet i egne net', 'indst-oktet-hj'], ['sag-fremmede', 'Maskér fremmede offentlige adresser', null], ['sag-oktet', 'Bevar sidste oktet i egne net', null], ['udloeb-ingen', 'Ingen udløb', null]]) {
    const i = d.getElementById(id);
    tjek(`V-KITBRUG.1 N3: ${id} er kittets afkrydsning (input.afk-boks i label.afk) med navn${hj ? ' og hjælpetekst' : ''}`, i && i.type === 'checkbox' && i.classList.contains('afk-boks') && i.closest('label.afk') && i.closest('.afk-felt') && i.getAttribute('aria-label') === navn && i.closest('label').textContent === navn && !i.hasAttribute('tabindex') && !i.hasAttribute('role') && (hj ? i.getAttribute('aria-describedby') === hj && d.getElementById(hj).classList.contains('afk-hj') && d.getElementById(hj).textContent.length > 20 : true));
  }
  for (const [navn, legend, n] of [['indst-tema', 'Tema', 3], ['indst-sprog', 'Sprog', 2], ['indst-tekst', 'Tekststørrelse', 3]]) {
    const ins = [...d.querySelectorAll(`input[name="${navn}"]`)];
    tjek(`V-KITBRUG.1 N3: ${legend} er kittets radiogruppe (browserens radioknapper, ét navn, legend)`, ins.length === n && ins.every(i => i.type === 'radio' && i.classList.contains('afk-boks') && i.getAttribute('aria-label') && !i.hasAttribute('tabindex')) && ins[0].closest('fieldset.valgsaet').querySelector('legend').textContent === legend);
  }
  for (const [id, etiket, vaerdier] of [['indst-udloeb', 'Standardudløb for en ny sag', ',30,90'], ['indst-stilstand', 'Lås efter stilstand', '5,15,30,60']]) {
    const sel = d.getElementById(id);
    tjek(`V-KITBRUG.1 N3: ${id} er kittets valgliste (select i .vliste med pil) med etiket, aria-label og de samme valg`, sel && sel.parentElement.classList.contains('vliste') && sel.parentElement.querySelector('svg[aria-hidden="true"]') && d.querySelector(`label[for="${id}"]`).textContent === etiket && sel.getAttribute('aria-label') === etiket && [...sel.options].map(o => o.value).join() === vaerdier);
  }
  const typ = d.getElementById('opost-type');
  tjek('V-KITBRUG.1 N3: Type i Tilføj post er kittets valgliste med navn, de syv typer og hjælpeteksten (opost-type-hj)', typ.parentElement.classList.contains('vliste') && typ.getAttribute('aria-label') === 'Type' && typ.getAttribute('aria-describedby') === 'opost-type-hj' && [...typ.options].map(o => o.value).join() === 'domaene,netbios,navnemoenster,eget_net,ord,person,aldrig' && typ.closest('.dlg-felter').firstElementChild === typ.closest('.felt'));
  tjek('V-KITBRUG.1 N3: Lås efter stilstand har sin hjælpetekst under sig (aria-describedby)', d.getElementById('indst-stilstand').getAttribute('aria-describedby') === 'indst-stilstand-hj' && /andre programmer/.test(d.getElementById('indst-stilstand-hj').textContent));
  for (const v of VIS) {
    const t = d.querySelector(`section[data-visning="${v}"] .flade > .tomt`);
    tjek(`V-KITBRUG.1 N3: ${v}: kittets tomme tilstand (ikon skjult for skærmlæsere, h2 og én sætning)`, t && t.querySelector('svg.tomt-ikon').getAttribute('aria-hidden') === 'true' && t.querySelector('h2.tomt-h').textContent.length > 3 && t.querySelector('p.tomt-p').textContent.endsWith('.'));
  }
  for (const [v, aria] of [['masker', 'Tom flade: indsæt en log'], ['demasker', 'Tom flade: indsæt svaret']]) {
    const t = d.querySelector(`section[data-visning="${v}"] .tomt`);
    tjek(`V-KITBRUG.1 N3: ${v}: den tomme tilstand kan stadig få fokus og tage imod ⌘V (tabIndex 0, aria-label)`, t.tabIndex === 0 && (t.getAttribute('aria-label') || '').startsWith(aria) && t.previousElementSibling && t.previousElementSibling.classList.contains('tom-bannere'), t.getAttribute('aria-label'));
  }
})();
await (async () => {
  // N3: værktøjstip. Filterknappens forklaring (før title) er kittets værktøjstip: tastaturfokus viser det, Esc skjuler det.
  const s = side();
  const { d, w } = s;
  await vent(5);
  const fl = d.querySelector('section[data-visning="masker"] .fl');
  const tip = d.getElementById(fl.getAttribute('aria-describedby') || '');
  tjek('V-KITBRUG.1 N3: filterknappen: forklaringen står i kittets værktøjstip (role="tooltip", aria-describedby), ikke i title', !fl.hasAttribute('title') && tip && tip.getAttribute('role') === 'tooltip' && tip.textContent === 'Vælg filter i træet til venstre' && tip.hidden && fl.getAttribute('aria-disabled') === 'true' && fl.parentElement.classList.contains('tip-plads'));
  fl.focus();
  tjek('V-KITBRUG.1 N3: filterknappen kan nås med tastaturet, og fokus viser værktøjstippet', d.activeElement === fl && !tip.hidden);
  s.tast('Escape');
  tjek('V-KITBRUG.1 N3: Esc skjuler værktøjstippet uden at flytte fokus', tip.hidden && d.activeElement === fl);
  w.Sprog.saet('en');
  tjek('V-KITBRUG.1 N3: værktøjstippet skifter sprog', tip.textContent === 'Choose a filter in the tree on the left');
})();
await (async () => {
  // N3: fremdriften: ringen er skjult for skærmlæsere; teksten har role="status" (resten prøves under Arbejder-tilstand).
  const rust = falskFilRust({ antal: 3, forsinkelse: 1300 });
  const s = side({ rust });
  const { d } = s;
  await vent(5);
  knapI(d, 'masker', 'aabn-fil').click();
  await vent(1060);
  const f = d.querySelector('section[data-visning="masker"] .flade > .frem.ubestemt');
  tjek('V-KITBRUG.1 N3: "Grimnir arbejder" er kittets fremdrift (ring aria-hidden, tekst med role="status") øverst på fladen', f && f.querySelector('.snurr').getAttribute('aria-hidden') === 'true' && f.querySelector('.frem-tekst').getAttribute('role') === 'status' && f.parentElement.firstElementChild === f);
  await vent(300);
})();
await (async () => {
  // N4: kittets dialoger. Overskrift, sætning, felter, fejlfelt og knapper i samme rækkefølge som før; navne fra overskrift
  // og sætning; den farlige og den primære knap; Esc; fokus tilbage; kun én dialog ad gangen; genvejene er slået fra.
  const rust = falskSagRust({ sager: SAGER() });
  const s = side({ hash: '#sager', rust });
  const { d, w } = s;
  await vent(10);
  const knapper = (id, dd = d) => [...dd.querySelectorAll(`#${id} .modal-fod button`)].map(b => b.textContent + (b.classList.contains('danger') ? '!' : b.classList.contains('primary') ? '*' : ''));
  const navn = (id, dd = d) => { const e = dd.getElementById(id); return dd.getElementById(e.getAttribute('aria-labelledby')).textContent; };
  const beskr = (id, dd = d) => { const e = dd.getElementById(id); const p = e.getAttribute('aria-describedby'); return p ? dd.getElementById(p).textContent : null; };
  // V-KITBRUG.2 N1: Slet sag, Fjern post og Start forfra er Kit.bekraeft, der laves ved åbning og fjernes ved lukning; de
  // åbnes her først (Fjern post og Start forfra i hver sin side med en ordbog), så de samme tjek kan prøve dem.
  const ordbogSide = side({ hash: '#ordbog', rust: falskOrdbogRust({ poster: ORDBOG(), indst: { guide_vist: true } }) });
  const forfraSide = side({ hash: '#ordbog', rust: falskOrdbogRust({ indst: { guide_vist: true }, laast: { art: 'beskadiget' } }) });
  await vent(20);
  klik(w, sagRaekke(d, hexId(3)).children[0]);
  klik(w, knapI(d, 'sager', 'slet-sag')); await vent(5);
  klik(ordbogSide.w, oRaekke(ordbogSide.d, 'localhost').children[0]);
  klik(ordbogSide.w, knapI(ordbogSide.d, 'ordbog', 'fjern-post')); await vent(5);
  [...forfraSide.d.querySelectorAll('section[data-visning="ordbog"] .ban button')].find(b => b.textContent === 'Start forfra').click(); await vent(5);
  const DOK = { 'dlg-ofjern': ordbogSide.d, 'dlg-oforfra': forfraSide.d };
  const FORVENTET = {
    'dlg-om': ['Om Grimnir', null, ['Luk']],
    'dlg-ny-sag': ['Ny sag', 'Giv sagen et navn', ['Annullér', 'Opret sag*']],
    'dlg-omdoeb': ['Omdøb sagen', null, ['Annullér', 'Omdøb*']],
    'dlg-udloeb': ['Udløb', 'Sagen «', ['Annullér', 'Gem*']],
    'dlg-slet': ['Slet sagen?', 'Sagen «', ['Annullér', 'Slet sag!']],
    'dlg-kasser': ['Gem den midlertidige sag, før Grimnir lukker?', null, ['Annullér', 'Kassér!', 'Gem som sag*']],
    'dlg-ofjern': ['Fjern posten?', '«', ['Annullér', 'Fjern post!']],
    'dlg-oforfra': ['Start forfra med en tom ordbog?', null, ['Annullér', 'Start forfra!']],
  };
  for (const [id, [h, p, kn]] of Object.entries(FORVENTET)) {
    const dd = DOK[id] || d, e = dd.getElementById(id);
    tjek(`V-KITBRUG.1 N4: ${id} er kittets dialog (dialog.modal) med navn fra overskriften`, e && e.tagName === 'DIALOG' && e.classList.contains('modal') && navn(id, dd) === h, e ? navn(id, dd) : 'mangler');
    tjek(`V-KITBRUG.1 N4: ${id}: knapperne som før (${kn.join(', ')})`, JSON.stringify(knapper(id, dd)) === JSON.stringify(kn), JSON.stringify(knapper(id, dd)));
    if (p) tjek(`V-KITBRUG.1 N4: ${id}: sætningen beskriver dialogen (aria-describedby)`, beskr(id, dd) !== null);
  }
  // V-KITBRUG.2 N1: fejlfeltet er kittets (G1/G2: .modal-fejl med role="alert" lige over fodlinjen).
  for (const id of ['dlg-ny-sag', 'dlg-omdoeb', 'dlg-udloeb', 'dlg-slet', 'dlg-ofjern', 'dlg-oforfra']) {
    const dd = DOK[id] || d, f = dd.querySelector(`#${id} .modal-fejl`);
    tjek(`V-KITBRUG.1 N4: ${id}: fejlfeltet (role="alert") står i dialogen før knapperne`, f && f.getAttribute('role') === 'alert' && f.closest('dialog').id === id && (f.compareDocumentPosition(dd.querySelector(`#${id} .modal-fod`)) & 4));
  }
  klik(w, d.querySelector('#dlg-slet [data-svar="nej"]'));
  tjek('V-KITBRUG.1 N4: Ny sag: felterne i samme rækkefølge (Navn, Udløber) og med navne', [...d.querySelectorAll('#dlg-ny-sag input')].map(i => i.id + ':' + i.getAttribute('aria-label')).join() === 'ny-sag-navn:Navn,ny-sag-udloeb:Udløber (valgfri)' && d.getElementById('ny-sag-navn').getAttribute('spellcheck') === 'false' && d.getElementById('ny-sag-navn').getAttribute('maxlength') === '120');
  // Fokus tilbage og Esc: Ny sag fra båndet; Esc (cancel + close som i browseren) lukker, og fokus går tilbage til knappen.
  const nyKnap = knapI(d, 'sager', 'ny-sag');
  nyKnap.focus();
  klik(w, nyKnap); await vent(5);
  tjek('V-KITBRUG.1 N4: Ny sag åbner med fokus i Navn', aaben(d, 'dlg-ny-sag') && d.activeElement === d.getElementById('ny-sag-navn'));
  skriv(w, d.getElementById('ny-sag-navn'), 'Prøvesag 0007');
  const ny = d.getElementById('dlg-ny-sag');
  ny.dispatchEvent(new w.Event('cancel'));
  ny.close();
  tjek('V-KITBRUG.1 N4: Esc lukker Ny sag uden at oprette', !aaben(d, 'dlg-ny-sag') && !s.kald.some(k => k[0] === 'sag_ny') && ny.returnValue !== 'opret');
  tjek('V-KITBRUG.1 N4: fokus går tilbage til det, der åbnede dialogen (Ny sag i båndet)', d.activeElement === nyKnap);
  klik(w, nyKnap); await vent(5);
  tjek('V-KITBRUG.1 N4: Ny sag åbner igen med tomt navn (intet bliver stående)', aaben(d, 'dlg-ny-sag') && d.getElementById('ny-sag-navn').value === '');
  // Kun én dialog ad gangen: Om fra menuen lukker Ny sag; Indstillinger lukker Om.
  s.emit('menu', 'om'); await vent(5);
  tjek('V-KITBRUG.1 N4: kun én dialog åben: Om fra menuen lukker Ny sag', aaben(d, 'dlg-om') && !aaben(d, 'dlg-ny-sag') && d.querySelectorAll('dialog[open]').length === 1);
  s.emit('menu', 'indstillinger'); await vent(5);
  tjek('V-KITBRUG.1 N4: kun én dialog åben: Indstillinger (Grimnirs egen) lukker Om (kittets)', aaben(d, 'dlg-indst') && !aaben(d, 'dlg-om') && d.querySelectorAll('dialog[open]').length === 1);
  d.querySelector('#dlg-indst [data-svar="luk"]').click();
  // Slet: fokus på Slet sag som før; Annullér via tastaturet (Enter på knappen = klik).
  klik(w, sagRaekke(d, hexId(3)).children[0]);
  klik(w, knapI(d, 'sager', 'slet-sag')); await vent(5);
  // V-KITBRUG.2 N2 (Jan): fokus står på Annullér (kittets standard ved en farlig handling); før på Slet sag.
  tjek('V-KITBRUG.2 N2: Slet sag: fokus står på Annullér, ikke på Slet sag', d.activeElement === d.querySelector('#dlg-slet [data-svar="nej"]') && d.activeElement.textContent === 'Annullér' && d.querySelector('dialog[open]') === d.getElementById('dlg-slet'));
  klik(w, d.querySelector('#dlg-slet [data-svar="nej"]'));
  tjek('V-KITBRUG.1 N4: Annullér lukker Slet sag, og intet er slettet', !aaben(d, 'dlg-slet') && !s.kald.some(k => k[0] === 'sag_slet'));
})();
await (async () => {
  // N4: genvejene er slået fra, mens en af kittets dialoger er åben (maskering.js spørger dialog[open]): ⌘↵ analyserer ikke.
  const s = side({ rust: falskRust() });
  const { d, w } = s;
  await vent(5);
  indsaet(w, d.querySelector('section[data-visning="masker"] .tomt'), TEKST);
  await vent(5); // V-OPBYG.1 N3: analysen skete ved indsætningen; ⌘↵ ville nu maskere
  s.emit('menu', 'om'); await vent(5);
  s.tast('Enter', { metaKey: true }); await vent(5);
  tjek('V-KITBRUG.1 N4: med Om (kittets dialog) åben gør ⌘↵ intet', aaben(d, 'dlg-om') && d.querySelector('dialog[open]') === d.getElementById('dlg-om') && s.kald.filter(k => k[0] === 'analyser').length === 1 && !s.kald.some(k => k[0] === 'gem_og_masker'));
  d.querySelector('#dlg-om [data-svar="luk"]').click();
  s.tast('Enter', { metaKey: true }); await vent(5);
  tjek('V-KITBRUG.1 N4: kontrol: lukket analyserer ⌘↵', s.kald.some(k => k[0] === 'analyser'));
})();
await (async () => {
  // N4: guiden. En anden dialog oven på guiden (Om fra menuen) lukker den, men den er hverken afsluttet eller sprunget over.
  const rust = falskOrdbogRust();
  const s = side({ hash: '#masker', rust });
  const { d } = s;
  await vent(20);
  tjek('V-KITBRUG.1 N4: kontrol: guiden står ved første start', aaben(d, 'dlg-guide'));
  s.emit('menu', 'om'); await vent(5);
  tjek('V-KITBRUG.1 N4: Om (kittets dialog) lukker guiden, uden at den gemmes som vist', aaben(d, 'dlg-om') && !aaben(d, 'dlg-guide') && !s.kald.some(k => k[0] === 'indstillinger_gem' && k[1].indstillinger && k[1].indstillinger.guide_vist));
})();
await (async () => {
  // N4: Prøv på tekst (Grimnirs egen dialog) tømmer feltet ved lukning; Fjern post (kittets) åbner med fokus på Fjern post.
  const rust = falskOrdbogRust({ poster: ORDBOG(), indst: { guide_vist: true } });
  const s = side({ hash: '#ordbog', rust });
  const { d, w } = s;
  await vent(20);
  klik(w, knapI(d, 'ordbog', 'proev')); await vent(5);
  d.getElementById('proev-tekst').value = 'Projekt Uglebo2 på kontor.test';
  s.emit('menu', 'om'); await vent(5);
  tjek('V-KITBRUG.1 N4: Prøv på tekst tømmes, også når en anden dialog lukker den', !aaben(d, 'dlg-proev') && d.getElementById('proev-tekst').value === '' && aaben(d, 'dlg-om'));
  d.querySelector('#dlg-om [data-svar="luk"]').click();
  klik(w, oRaekke(d, 'localhost').children[0]);
  klik(w, knapI(d, 'ordbog', 'fjern-post')); await vent(5);
  // V-KITBRUG.2 N2 (Jan): fokus på Annullér; før på Fjern post.
  tjek('V-KITBRUG.2 N2: Fjern post åbner med fokus på Annullér, ikke på Fjern post', aaben(d, 'dlg-ofjern') && d.activeElement === d.querySelector('#dlg-ofjern [data-svar="nej"]') && d.activeElement.textContent === 'Annullér');
})();
await (async () => {
  // N4: låsen. Med en kittets dialog åben og tekst i den låser Rust igen: siden genindlæses, og den nye side har ingen åben
  // dialog og ingen af teksterne.
  const rust = falskLaasRust({ svar: [{ svar: 'ok' }] });
  const s = side({ rust, hash: '#sager' });
  const { d, w } = s;
  await vent(30);
  klik(w, knapI(d, 'sager', 'ny-sag')); await vent(5);
  skriv(w, d.getElementById('ny-sag-navn'), 'Ravnsborg-sagen');
  tjek('V-KITBRUG.1 N4: kontrol: Ny sag er åben med et navn', aaben(d, 'dlg-ny-sag') && /Ravnsborg/.test(d.getElementById('ny-sag-navn').value));
  rust.laasIgen('dvale', null);
  s.emit('laast', 'dvale'); await vent(10);
  tjek('V-KITBRUG.1 N4: låsen genindlæser siden (location.reload)', s.jsdomFejl.some(m => /navigation/.test(m)));
  const g = side({ rust, hash: '#sager' });
  await vent(30);
  tjek('V-KITBRUG.1 N4: efter genindlæsningen er ingen dialog åben, og navnet står ingen steder', g.d.querySelectorAll('dialog[open]').length === 0 && !/Ravnsborg/.test(g.d.documentElement.outerHTML) && g.d.getElementById('ny-sag-navn').value === '');
})();
await (async () => {
  // N4: Kit.bekraeft (Gem som fil i Demaskér) laves ved åbning og fjernes ved lukning: ingen dialog bliver liggende.
  const html = ui('assets/maskering.js');
  tjek('V-KITBRUG.1 N4: Gem som fil bruger kittets bekræftelse (G.bekraeft → Kit.bekraeft) med den farlige handling', /G\.bekraeft\(\{[\s\S]{0,200}farlig: true/.test(html) && /function bekraeft\(o\) \{ lukAndre\(null\); return K\.bekraeft\(o\); \}/.test(ui('assets/app.js')));
  tjek('V-KITBRUG.2 N1: index.html har ingen dialoger tilbage (alle 14 er kittets)', !/<dialog\b/.test(ui('index.html')));
})();

// ── V-KITBRUG.2: de sidste fem dialoger på kittets dialog (N1), fokus på Annullér (N2), kit 2.5.0 i brug (N3:
// afkrydsningen, den tomme flade, --tekst-zoom og "hvorfor" i værktøjstip), tekststørrelsen med genveje og menu (N4) og
// rulning og ⌘1–⌘4 (N5). Kun opdigtede data; ingen rigtig udklipsholder eller Nøglering (falske Rust-svar). jsdom tegner
// ikke: målene (fladen ruller ikke, tippet klippes ikke, boksen er 16 px) er målt i WKWebView (HANDOFF). ──
const esc = (w, dlg) => { const ev = new w.Event('cancel', { cancelable: true }); dlg.dispatchEvent(ev); if (!ev.defaultPrevented) dlg.close(); return ev; };
await (async () => {
  // N1: Indstillinger er kittets brede dialog: navn, fokus på det første valg, Luk, Esc, fejlen i kittets fejlfelt.
  const rust = falskOrdbogRust({ indst: { guide_vist: true }, gemFejl: true });
  const s = side({ hash: '#masker', rust });
  const { d, w } = s;
  await vent(20);
  const tandhjul = d.getElementById('aabn-indst');
  tandhjul.focus();
  klik(w, tandhjul); await vent(5);
  const dlg = d.getElementById('dlg-indst');
  tjek('V-KITBRUG.2 N1: Indstillinger er kittets brede dialog (dialog.modal.bred) med navn fra overskriften', dlg.tagName === 'DIALOG' && dlg.classList.contains('modal') && dlg.classList.contains('bred') && d.getElementById(dlg.getAttribute('aria-labelledby')).textContent === 'Indstillinger' && aaben(d, 'dlg-indst'));
  tjek('V-KITBRUG.2 N1: Indstillinger: samme indhold i samme rækkefølge (Tema, Sprog, Tekststørrelse, Nye sager, Lås, Første start) og én knap, Luk', [...dlg.querySelectorAll('#indst-valg > fieldset > legend')].map(l => l.textContent).join() === 'Tema,Sprog,Tekststørrelse,Nye sager,Lås,Første start' && [...dlg.querySelectorAll('.modal-fod button')].map(b => b.textContent).join() === 'Luk' && d.getElementById('indst-guide').textContent === 'Vis guiden igen');
  tjek('V-KITBRUG.2 N1: Indstillinger åbner med fokus på det første valg (som browserens: Lys i Tema)', d.activeElement === d.querySelector('input[name="indst-tema"][value="lys"]'));
  const fr = d.getElementById('indst-fremmede');
  fr.checked = true;
  fr.dispatchEvent(new w.Event('change', { bubbles: true })); await vent(10);
  const f = d.getElementById('dlg-indst-fejl');
  tjek('V-KITBRUG.2 N1: Indstillinger: fejlen står i kittets fejlfelt (role="alert") lige over knapperne', f && f.classList.contains('modal-fejl') && f.getAttribute('role') === 'alert' && f.textContent.startsWith('Indstillingen blev ikke gemt') && f.nextElementSibling === dlg.querySelector('.modal-fod'));
  esc(w, dlg);
  tjek('V-KITBRUG.2 N1: Esc lukker Indstillinger, og fokus går tilbage til tandhjulet', !aaben(d, 'dlg-indst') && d.activeElement === tandhjul);
  s.emit('menu', 'indstillinger'); await vent(5);
  tjek('V-KITBRUG.2 N1: Indstillinger åbner igen uden den gamle fejl', aaben(d, 'dlg-indst') && f.textContent === '');
})();
await (async () => {
  // N1: sagens dialog. Kittets regel for flere primære (G4): skjulte knapper tæller ikke; den synlige primære står yderst.
  const rust = falskOrdbogRust({ indst: { guide_vist: true } });
  const s = side({ hash: '#masker', rust });
  const { d, w } = s;
  await vent(20);
  indsaet(w, d.querySelector('section[data-visning="masker"] .tomt'), TEKST);
  await vent(10); // V-OPBYG.1 N3: analysen sker ved indsætning (før ⌘↵ første gang)
  s.tast('Enter', { metaKey: true }); await vent(10);
  const sagKnap = d.getElementById('sag-knap');
  sagKnap.focus();
  klik(w, sagKnap); await vent(5);
  const dlg = d.getElementById('dlg-sag');
  const synligeKnapper = () => [...dlg.querySelectorAll('.modal-fod button')].filter(b => !b.hidden).map(b => b.textContent + (b.classList.contains('danger') ? '!' : b.classList.contains('primary') ? '*' : ''));
  tjek('V-KITBRUG.2 N1: sagens dialog er kittets (dialog.modal) med overskrift og sætning som navn og beskrivelse', dlg.classList.contains('modal') && dlg.getAttribute('aria-labelledby') === 'dlg-sag-h' && d.getElementById('dlg-sag-h').textContent === 'Midlertidig sag' && dlg.getAttribute('aria-describedby') === 'dlg-sag-p' && d.getElementById('dlg-sag-p').textContent.includes('3 værdier'));
  tjek('V-KITBRUG.2 N1: sagens dialog (midlertidig): Luk, Nulstil sagen (farlig), Vis indhold (V-MANUEL.2, sagen har værdier) og Gem som sag (primær, yderst); én synlig primær', JSON.stringify(synligeKnapper()) === JSON.stringify(['Luk', 'Nulstil sagen!', 'Vis indhold', 'Gem som sag*']), JSON.stringify(synligeKnapper()));
  tjek('V-KITBRUG.2 N1: sagens dialog åbner med fokus på det første valg (som browserens)', d.activeElement === d.getElementById('sag-fremmede'));
  // Fejlen ved et valg står i kittets fejlfelt.
  const gl = rust.sag_valg;
  rust.sag_valg = () => { throw { art: 'sag', fejl: { art: 'disk', hvad: 'PermissionDenied' } }; };
  const ok2 = d.getElementById('sag-oktet');
  ok2.checked = false;
  ok2.dispatchEvent(new w.Event('change', { bubbles: true })); await vent(10);
  const f = d.getElementById('dlg-sag-fejl');
  tjek('V-KITBRUG.2 N1: sagens dialog: en fejl står i kittets fejlfelt (role="alert") før knapperne', f && f.getAttribute('role') === 'alert' && f.textContent === 'Det lykkedes ikke: disken kunne ikke bruges (PermissionDenied).' && (f.compareDocumentPosition(dlg.querySelector('.modal-fod')) & 4) && ok2.checked);
  rust.sag_valg = gl;
  esc(w, dlg);
  tjek('V-KITBRUG.2 N1: Esc lukker sagens dialog uden at nulstille, og fokus går tilbage til sagsknappen', !aaben(d, 'dlg-sag') && !s.kald.some(k => k[0] === 'sag_nulstil') && d.activeElement === sagKnap);
  // Navngiven sag: Luk, Skift sag og Luk sag (primær, yderst).
  klik(w, sagKnap); await vent(5);
  klik(w, d.getElementById('sag-gem-som')); await vent(5);
  skriv(w, d.getElementById('ny-sag-navn'), 'Prøvesag 0011');
  klik(w, d.getElementById('ny-sag-opret')); await vent(10);
  klik(w, sagKnap); await vent(5);
  tjek('V-KITBRUG.2 N1: sagens dialog (navngiven): Luk, Vis indhold (V-MANUEL.2), Skift sag og Luk sag (primær, yderst); én synlig primær', JSON.stringify(synligeKnapper()) === JSON.stringify(['Luk', 'Vis indhold', 'Skift sag', 'Luk sag*']) && d.getElementById('dlg-sag-h').textContent === 'Sag: Prøvesag 0011', JSON.stringify(synligeKnapper()));
  tjek('V-KITBRUG.2 N1: kittets regel: den synlige primære er den sidste synlige knap, og de skjulte er skjult (hidden)', [...dlg.querySelectorAll('.modal-fod button')].filter(b => b.hidden).map(b => b.id).sort().join() === 'sag-gem-som,sag-nulstil' && synligeKnapper().filter(k => k.endsWith('*')).length === 1 && synligeKnapper().pop().endsWith('*'));
})();
await (async () => {
  // N1: Tilføj post. Fokus (Værdi; Type fra Maskér), fejlen i kittets fejlfelt, Esc, og Maskérs ventende løfte.
  const rust = falskOrdbogRust({ poster: ORDBOG(), indst: { guide_vist: true } });
  const s = side({ hash: '#ordbog', rust });
  const { d, w } = s;
  await vent(20);
  const GO = w.GrimnirOrdbog;
  const knap = knapI(d, 'ordbog', 'tilfoej-post');
  knap.focus();
  klik(w, knap); await vent(5);
  const dlg = d.getElementById('dlg-opost');
  tjek('V-KITBRUG.2 N1: Tilføj post er kittets dialog med navn fra overskriften; sætningen er skjult og beskriver ikke', dlg.classList.contains('modal') && d.getElementById(dlg.getAttribute('aria-labelledby')).textContent === 'Tilføj post' && d.getElementById('dlg-opost-p').hidden && !dlg.hasAttribute('aria-describedby'));
  tjek('V-KITBRUG.2 N1: Tilføj post: felterne Type, Værdi og Note i den rækkefølge; Annullér og Tilføj post (primær)', [...dlg.querySelectorAll('.dlg-felter > .felt label')].map(l => l.textContent).join('|') === 'Type|Værdi eller mønster|Note (valgfri)' && JSON.stringify([...dlg.querySelectorAll('.modal-fod button')].map(b => b.textContent + (b.classList.contains('primary') ? '*' : ''))) === JSON.stringify(['Annullér', 'Tilføj post*']));
  tjek('V-KITBRUG.2 N1: Tilføj post åbner med fokus i Værdi', d.activeElement === d.getElementById('opost-vaerdi'));
  rust.ob.laast = { art: 'beskadiget' };
  skriv(w, d.getElementById('opost-vaerdi'), 'Ravnsborg');
  klik(w, d.getElementById('opost-ok')); await vent(10);
  const f = d.getElementById('dlg-opost-fejl');
  tjek('V-KITBRUG.2 N1: Tilføj post: en fejl, der ikke hører til et felt, står i kittets fejlfelt (role="alert")', f && f.getAttribute('role') === 'alert' && /ordbogen kunne ikke åbnes/i.test(f.textContent) && aaben(d, 'dlg-opost'));
  rust.ob.laast = null;
  await GO.opdater();
  esc(w, dlg);
  tjek('V-KITBRUG.2 N1: Esc lukker Tilføj post uden at gemme, og fokus går tilbage', !aaben(d, 'dlg-opost') && !rust.ob.db.some(p => p.vaerdi === 'Ravnsborg') && d.activeElement === knap);
  // Fra Maskér: Esc, en anden dialog og Tilføj giver Maskérs ventende løfte false, false og true.
  const r = { art: 'vaert', vaerdier: ['srv-web01'], hemmelig: false };
  const p1 = GO.fraMasker(r, 'altid'); await vent(5);
  tjek('V-KITBRUG.2 N1: fra Maskér: Tilføj post åbner med fokus på Type og med sætningen som beskrivelse', aaben(d, 'dlg-opost') && d.activeElement === d.getElementById('opost-type') && !d.getElementById('dlg-opost-p').hidden && dlg.getAttribute('aria-describedby') === 'dlg-opost-p');
  esc(w, dlg);
  const v1 = await p1;
  const p2 = GO.fraMasker(r, 'altid'); await vent(5);
  s.emit('menu', 'om'); await vent(5);
  const v2 = await p2;
  d.querySelector('#dlg-om [data-svar="luk"]').click();
  const p3 = GO.fraMasker(r, 'altid'); await vent(5);
  klik(w, d.getElementById('opost-ok')); await vent(10);
  const v3 = await p3;
  tjek('V-KITBRUG.2 N1: Tilføj post: lukningen løser Maskérs ventende løfte (Esc: false, en anden dialog: false, gemt: true)', v1 === false && v2 === false && v3 === true && rust.ob.db.some(p => p.vaerdi === 'srv-web01'), [v1, v2, v3].join());
})();
await (async () => {
  // N1: Prøv på tekst. Kittets brede dialog; fokus i feltet; svaret (også en fejl) står i svaret med role="status"; Esc tømmer.
  const rust = falskOrdbogRust({ poster: ORDBOG(), indst: { guide_vist: true } });
  const s = side({ hash: '#ordbog', rust });
  const { d, w } = s;
  await vent(20);
  klik(w, knapI(d, 'ordbog', 'proev')); await vent(5);
  const dlg = d.getElementById('dlg-proev'), pt = d.getElementById('proev-tekst');
  tjek('V-KITBRUG.2 N1: Prøv på tekst er kittets brede dialog med navn og sætning; Luk og Prøv (primær)', dlg.classList.contains('modal') && dlg.classList.contains('bred') && d.getElementById(dlg.getAttribute('aria-labelledby')).textContent === 'Prøv ordbogen på en tekst' && dlg.hasAttribute('aria-describedby') && JSON.stringify([...dlg.querySelectorAll('.modal-fod button')].map(b => b.textContent + (b.classList.contains('primary') ? '*' : ''))) === JSON.stringify(['Luk', 'Prøv*']));
  tjek('V-KITBRUG.2 N1: Prøv på tekst åbner med fokus i feltet (mono, ingen stavekontrol)', d.activeElement === pt && pt.classList.contains('mono') && pt.getAttribute('spellcheck') === 'false' && pt.getAttribute('aria-label') === 'Tekst');
  rust.ordbog_proev = () => { throw { art: 'for_stor', bytes: 6 * 1048576 }; };
  pt.value = 'Projekt Uglebo2';
  klik(w, d.getElementById('proev-ok')); await vent(10);
  tjek('V-KITBRUG.2 N1: Prøv på tekst: en fejl står i svaret (role="status") som før', d.getElementById('proev-svar').getAttribute('role') === 'status' && d.querySelector('#proev-svar .dlg-fejl') && /6\.0/.test(d.getElementById('proev-svar').textContent));
  esc(w, dlg);
  tjek('V-KITBRUG.2 N1: Esc lukker Prøv på tekst og tømmer feltet og svaret', !aaben(d, 'dlg-proev') && pt.value === '' && d.getElementById('proev-svar').textContent === '');
})();
await (async () => {
  // N1: guiden er kittets brede dialog til en guide (G6): 820 px uden luft, navn fra guidens overskrift, fokus på den.
  const rust = falskOrdbogRust();
  const s = side({ hash: '#masker', rust });
  const { d } = s;
  await vent(20);
  const dlg = d.getElementById('dlg-guide');
  tjek('V-KITBRUG.2 N1: guiden står i kittets dialog til en guide (dialog.modal.modal-guide) uden egen overskrift og knapper', dlg.classList.contains('modal') && dlg.classList.contains('modal-guide') && !dlg.querySelector('.modal-top, .modal-fod') && dlg.querySelector('.modal-indhold > #guide'));
  tjek('V-KITBRUG.2 N1: guiden har navn fra guidens overskrift og fokus på den ved åbning', dlg.getAttribute('aria-labelledby') === 'guide-h' && d.activeElement === d.getElementById('guide-h'));
})();
await (async () => {
  // N1: låsen lukker alt og efterlader intet, også med en af de fem nye dialoger åben og tekst i den.
  for (const [id, aabn, skrivI, tekst] of [
    ['dlg-indst', s => s.emit('menu', 'indstillinger'), null, null],
    ['dlg-opost', s => klik(s.w, knapI(s.d, 'ordbog', 'tilfoej-post')), 'opost-vaerdi', 'Ravnsborg-skur'],
    ['dlg-proev', s => klik(s.w, knapI(s.d, 'ordbog', 'proev')), 'proev-tekst', 'Projekt Ravnsborg-skur'],
  ]) {
    const rust = falskLaasRust({ svar: [{ svar: 'ok' }] });
    const s = side({ rust, hash: '#ordbog' });
    await vent(30);
    aabn(s); await vent(5);
    if (skrivI) skriv(s.w, s.d.getElementById(skrivI), tekst);
    const foer = aaben(s.d, id);
    rust.laasIgen('dvale', null);
    s.emit('laast', 'dvale'); await vent(10);
    const g = side({ rust, hash: '#ordbog' });
    await vent(30);
    tjek(`V-KITBRUG.2 N1: lås med ${id} åben: siden genindlæses, og bagefter er ingen dialog åben og intet af teksten tilbage`, foer && s.jsdomFejl.some(m => /navigation/.test(m)) && g.d.querySelectorAll('dialog[open]').length === 0 && !/Ravnsborg/.test(g.d.documentElement.outerHTML));
  }
})();
await (async () => {
  // N1: de ni fra V-KITBRUG.1 bruger kittets egne muligheder: id og knapId (G3), fejlfelt (G1), ventende knap, foer (G5)
  // og Kit.bekraeft, der kan fejle (G2).
  const app = ui('assets/app.js'), sager = ui('assets/sager.js'), ordbog = ui('assets/ordbog.js');
  const kitDialogKrop = app.slice(app.indexOf('function kitDialog('), app.indexOf('function lukAndre('));
  tjek('V-KITBRUG.2 N1: kitDialog sætter ikke id bagefter (kittets id og knapId, G3) og lægger intet foran overskriften selv (foer, G5)', kitDialogKrop.length > 50 && !/\.id =|knapId|prepend/.test(kitDialogKrop) && !/\.knap\([^)]*\)\.id =|\.prepend\(/.test(app + sager + ordbog) && /foer: omFlet/.test(app));
  tjek('V-KITBRUG.2 N1: Grimnir bygger ingen egne fejlfelter (p.dlg-fejl med role="alert") i dialogerne længere (G1)', !/fejlFelt|setAttribute\('role', 'alert'\)/.test(sager + ordbog + ui('assets/indstillinger.js')));
  tjek('V-KITBRUG.2 N1: Slet sag, Fjern post og Start forfra er kittets bekræftelse med et løfte (G.bekraeft med ved)', /G\.bekraeft\(\{[\s\S]{0,300}ved: \(\) => invoke\('sag_slet'/.test(sager) && /function bekraeft\(id, t, p, v, ja, ved\) \{\s*return G\.bekraeft\(\{/.test(ordbog) && /'dlg-oforfra'[\s\S]{0,120}ordbog_start_forfra/.test(ordbog) && /'dlg-ofjern'[\s\S]{0,120}ordbog_fjern/.test(ordbog));
  const rust = falskSagRust({ sager: SAGER() });
  const s = side({ hash: '#sager', rust });
  const { d, w } = s;
  await vent(10);
  const om = (s.emit('menu', 'om'), d.getElementById('dlg-om'));
  tjek('V-KITBRUG.2 N1: Om har fletbåndet over overskriften i kittets .modal-foer (G5), og overskriften navngiver dialogen', om.firstElementChild.classList.contains('modal-foer') && om.firstElementChild.querySelector('svg.flet') && om.firstElementChild.nextElementSibling.classList.contains('modal-top') && om.getAttribute('aria-labelledby') === 'dlg-om-h');
  om.querySelector('[data-svar="luk"]').click();
  // Ventende knap (G1): Opret sag venter på Rust (aria-busy) og lukker selv, når sagen er oprettet.
  let slip;
  const gl = rust.sag_ny;
  rust.sag_ny = a => new Promise(r => { slip = () => r(gl(a)); });
  klik(w, knapI(d, 'sager', 'ny-sag')); await vent(5);
  skriv(w, d.getElementById('ny-sag-navn'), 'Ventesag 0001');
  const opret = d.getElementById('ny-sag-opret');
  klik(w, opret); await vent(5);
  const venter = opret.getAttribute('aria-busy') === 'true' && aaben(d, 'dlg-ny-sag');
  klik(w, opret); await vent(5);
  const kaldt = s.kald.filter(k => k[0] === 'sag_ny').length;
  slip(); await vent(10);
  tjek('V-KITBRUG.2 N1: Opret sag venter på Rust (aria-busy, kan ikke trykkes igen) og lukker selv bagefter (G1)', venter && kaldt === 1 && !aaben(d, 'dlg-ny-sag') && !opret.hasAttribute('aria-busy'));
  rust.sag_ny = gl;
  // Slet sag, der fejler, bliver åben med fejlen; ja kan trykkes igen og lykkes; dialogen fjernes ved lukning.
  const sl = rust.sag_slet;
  rust.sag_slet = () => { throw { art: 'sag', fejl: { art: 'disk', hvad: 'PermissionDenied' } }; };
  klik(w, sagRaekke(d, hexId(3)).children[0]);
  klik(w, knapI(d, 'sager', 'slet-sag')); await vent(5);
  klik(w, d.querySelector('#dlg-slet [data-svar="ja"]')); await vent(10);
  const fejlTekst = (d.querySelector('#dlg-slet .modal-fejl') || {}).textContent;
  tjek('V-KITBRUG.2 N1: Slet sag, der fejler, bliver åben med fejlen i kittets felt (role="alert"); intet er slettet', aaben(d, 'dlg-slet') && fejlTekst === 'disken kunne ikke bruges (PermissionDenied)' && d.querySelector('#dlg-slet .modal-fejl').getAttribute('role') === 'alert' && sagRaekker(d).length === 6, fejlTekst);
  rust.sag_slet = sl;
  klik(w, d.querySelector('#dlg-slet [data-svar="ja"]')); await vent(10);
  tjek('V-KITBRUG.2 N1: Slet sag kan trykkes igen og lykkes; bekræftelsen er fjernet fra siden', !d.getElementById('dlg-slet') && !sagRaekke(d, hexId(3)) && d.querySelectorAll('dialog.modal:not([id])').length === 0);
})();
await (async () => {
  // N1: app.css har ingen .dlg-regler (alle 14 dialoger er kittets); index.html har ingen dialog.
  const app = ui('assets/app.css').replace(/\/\*[\s\S]*?\*\//g, '');
  tjek('V-KITBRUG.2 N1: app.css har ingen .dlg-regler tilbage (.dlg, .dlg-bred, .dlg-guide, .dlg-knapper)', !/\.dlg(?![\w-])|\.dlg-bred|\.dlg-guide|\.dlg-knapper/.test(app));
  const s = side();
  await vent(5);
  tjek('V-KITBRUG.2 N1: ingen element bruger de gamle klasser (.dlg, .dlg-bred, .dlg-guide, .dlg-knapper, data-luk)', !s.d.querySelector('.dlg, .dlg-bred, .dlg-guide, .dlg-knapper, [data-luk]'));
})();
await (async () => {
  // N2: Slet sag og Fjern post: fokus på Annullér, og Enter (et klik på den knap, der har fokus) sletter ikke.
  const rust = falskSagRust({ sager: SAGER() });
  const s = side({ hash: '#sager', rust });
  const { d, w } = s;
  await vent(10);
  klik(w, sagRaekke(d, hexId(2)).children[0]);
  klik(w, knapI(d, 'sager', 'slet-sag')); await vent(5);
  klik(w, d.activeElement); await vent(10);
  tjek('V-KITBRUG.2 N2: Slet sag: Enter uden Tab rammer Annullér og sletter intet', !aaben(d, 'dlg-slet') && !s.kald.some(k => k[0] === 'sag_slet') && sagRaekker(d).length === 5);
  const r2 = falskOrdbogRust({ poster: ORDBOG(), indst: { guide_vist: true } });
  const s2 = side({ hash: '#ordbog', rust: r2 });
  await vent(20);
  klik(s2.w, oRaekke(s2.d, 'localhost').children[0]);
  klik(s2.w, knapI(s2.d, 'ordbog', 'fjern-post')); await vent(5);
  const fokus = s2.d.activeElement.textContent;
  klik(s2.w, s2.d.activeElement); await vent(10);
  tjek('V-KITBRUG.2 N2: Fjern post: fokus på Annullér, og Enter uden Tab fjerner intet', fokus === 'Annullér' && !s2.kald.some(k => k[0] === 'ordbog_fjern') && oRaekke(s2.d, 'localhost'));
})();
await (async () => {
  // N3 (G11): "hvorfor" i kittets værktøjstip i båndet. Hver kommando, der er slået fra, har sin forklaring på begge sprog
  // (intet title); Tab viser tippet; Esc skjuler det; låst viser båndet intet tip.
  const s = side({ rust: falskSagRust({ sager: SAGER() }) });
  const { d, w } = s;
  await vent(10);
  // V-OPBYG.1: sagens status skal være hentet (Gem som sag… slås til eller fra efter den), før kommandoerne tælles.
  await ventTil(w, () => !d.getElementById('sag-knap').hidden);
  const alle = () => [...d.querySelectorAll('#baand .grupper[data-fane="start"] .cb[aria-disabled="true"]')];
  const da = alle().map(b => [b.closest('[data-visning]').dataset.visning + ':' + b.dataset.kommando, forklaring(b), b.getAttribute('title')]);
  tjek('V-KITBRUG.2 N3 (G11): hver kommando, der er slået fra, har sin forklaring i et værktøjstip (role="tooltip") og intet title (dansk)', da.length >= 15 && da.every(([, f, t]) => f && f.length > 10 && !/^hvorfor/.test(f) && t === null), JSON.stringify(da.filter(([, f, t]) => !f || t !== null)));
  w.Sprog.saet('en'); await vent(5);
  const en = alle().map(b => [b.dataset.kommando, forklaring(b)]);
  tjek('V-KITBRUG.2 N3 (G11): … og på engelsk (anden tekst, ingen nøgle)', en.length === da.length && en.every(([, f], i) => f && f.length > 10 && !/^hvorfor/.test(f) && f !== da[i][1]), JSON.stringify([en.length, da.length, en.filter(([, f], i) => !(f && f.length > 10 && !/^hvorfor/.test(f) && f !== da[i][1]))]));
  w.Sprog.saet('da'); await vent(5);
  const b = knapI(d, 'masker', 'analyser');
  const tip = d.getElementById(b.getAttribute('aria-describedby'));
  tjek('V-KITBRUG.2 N3 (G11): kommandoen står i kittets .tip-plads, tippet er skjult, og knappen kan nås med Tab (aria-disabled, ikke disabled)', b.parentElement.classList.contains('tip-plads') && tip.hidden && !b.disabled && b.tabIndex === 0 && b.getAttribute('aria-disabled') === 'true');
  b.focus();
  tjek('V-KITBRUG.2 N3 (G11): Tab til en kommando, der er slået fra, viser forklaringen', d.activeElement === b && !tip.hidden && tip.textContent === 'Indsæt en tekst først');
  s.tast('Escape');
  tjek('V-KITBRUG.2 N3 (G11): Esc skjuler forklaringen uden at flytte fokus', tip.hidden && d.activeElement === b);
  // Når kommandoen slås til, forsvinder tippet og .tip-plads (genvejen står i title), og fokus bliver på knappen.
  indsaet(w, d.querySelector('section[data-visning="masker"] .tomt'), TEKST);
  // V-OPBYG.1 N3: analysen går i gang ved indsætningen; når den er færdig, er Analysér igen slået til (uden genvej: ⌘↵ er nu
  // Maskér, som har genvejen i title).
  await ventTil(w, () => !b.hasAttribute('aria-disabled'));
  b.focus();
  tjek('V-KITBRUG.2 N3 (G11): slået til: intet tip, ingen .tip-plads, genvejen i title', !b.hasAttribute('aria-disabled') && forklaring(b) === null && !b.parentElement.classList.contains('tip-plads') && !b.title && knapI(d, 'masker', 'gem-masker').title === 'Genvej: ⌘↵' && !knapI(d, 'masker', 'gem-masker').parentElement.classList.contains('tip-plads') && d.activeElement === b);
  // Sager: årsagen ({v}) står i tippet.
  w.Grimnir.vis('sager'); await vent(10);
  klik(w, sagRaekke(d, hexId(4)).children[0]);
  tjek('V-KITBRUG.2 N3 (G11): Sager: årsagen til, at en sag ikke kan åbnes, står i tippet på begge sprog', forklaring(knapI(d, 'sager', 'omdoeb')) === 'Sagen kan ikke åbnes: nøglen mangler i nøgleringen' && (w.Sprog.saet('en'), /^The case cannot be opened: /.test(forklaring(knapI(d, 'sager', 'omdoeb')))), forklaring(knapI(d, 'sager', 'omdoeb')));
  w.Sprog.saet('da');
  // CSS: intet i båndet klipper tippet (ingen overflow i .cmd, .grupper, .grp, .kn eller #baand), og låst skjules tip.
  const kit = ui('assets/kit.css'), app = ui('assets/app.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const baandRegler = [...(kit + app).matchAll(/(^|\n)([^{}\n]*(?:\.cmd|\.grupper|\.grp|\.kn|#baand)[^{}\n]*)\{([^}]*)\}/g)].filter(m => /overflow/.test(m[3])).map(m => m[2].trim());
  tjek('V-KITBRUG.2 N3 (G11): ingen regel for båndet sætter overflow, så tippet ikke klippes af båndets kant', baandRegler.length === 0, baandRegler.join(' | '));
  tjek('V-KITBRUG.2 N3 (G11): låst viser båndet intet tip (html[data-laast] #baand .tip { display: none; })', /html\[data-laast\] #baand \.tip \{ display: none; \}/.test(app));
  const rl = falskLaasRust({ svar: [{ svar: 'annulleret' }] });
  const sl = side({ rust: rl });
  await vent(30);
  tjek('V-KITBRUG.2 N3 (G11): låst: båndet er inert, og forklaringen står i title på båndet, ikke i tip', sl.d.documentElement.hasAttribute('data-laast') && [...sl.d.getElementById('baand').children].every(e => e.hasAttribute('inert')) && /låst/.test(sl.d.getElementById('baand').title));
})();
await (async () => {
  // N3 (G7): afkrydsningen i fundtabellen er kittets Kit.afkrydsning({ aria }): boksen alene, 16 px, navn i aria-label.
  const s = side({ rust: falskRust() });
  const { d, w } = s;
  await vent(5);
  indsaet(w, d.querySelector('section[data-visning="masker"] .tomt'), TEKST);
  s.tast('Enter', { metaKey: true }); await vent(10);
  const cb = fundRaekker(d)[0].querySelector('input[type="checkbox"]');
  tjek('V-KITBRUG.2 N3 (G7): fundtabellens afkrydsning er kittets boks alene (input.afk-boks i cellen, ingen label, ingen .afk-felt) med navn', cb && cb.classList.contains('afk-boks') && cb.parentElement.tagName === 'TD' && !cb.closest('label, .afk-felt') && /^Maskér /.test(cb.getAttribute('aria-label')) && cb.getAttribute('data-felt') === 'valg');
  const kit = ui('assets/kit.css'), app = ui('assets/app.css');
  tjek('V-KITBRUG.2 N3 (G7): boksen er 16 px fra kittets regel; Grimnirs egen regel for boksen i tabellen er væk', /\.tabel td input\.afk-boks \{ width: 16px; height: 16px; padding: 0; margin: 0; \}/.test(kit) && !/\.tabel td input\[type="checkbox"\]/.test(app));
  const foer = s.kald.filter(k => k[0] === 'analyser').length;
  cb.click(); await vent(400);
  tjek('V-KITBRUG.2 N3 (G7): et klik slår rækken fra som før (rækken er "fra", og der analyseres igen)', fundRaekker(d)[0].classList.contains('fra') && s.kald.filter(k => k[0] === 'analyser').length === foer + 1);
})();
await (async () => {
  // N3 (G8): den tomme flade i Maskér og Demaskér er kittets modtager: fokus, region med navn, Åbn fil, og i Demaskér
  // "Åbn Sager" som den anden handling, kun når der skal en sag til; .tomt-slip mens en fil trækkes over.
  const rust = falskSagRust({ sager: SAGER() });
  const s = side({ rust });
  const { d, w } = s;
  await vent(10);
  for (const [v, navn] of [['masker', 'Tom flade: indsæt en log eller et script med ⌘V'], ['demasker', 'Tom flade: indsæt svaret med ⌘V']]) {
    const t = d.querySelector(`section[data-visning="${v}"] .tomt`);
    tjek(`V-KITBRUG.2 N3 (G8): ${v}: den tomme flade er kittets modtager (.tomt-modtager, role="region", tabindex 0, navn med ⌘V)`, t.classList.contains('tomt-modtager') && t.getAttribute('role') === 'region' && t.tabIndex === 0 && t.getAttribute('aria-label') === navn, t.getAttribute('aria-label'));
    // Kittet: én handling står for sig selv; med en anden handling står de to i .tomt-handlinger.
    const h = t.querySelector('.tomt-handlinger'), knapper = [...t.querySelectorAll('button')].map(b => b.textContent + (b.classList.contains('primary') ? '*' : ''));
    // V-OPBYG.1 N3 (skitsen): Indsæt tekst/svar er den fremhævede handling og Åbn fil den anden (i .tomt-handlinger); under
    // dem linjen om ⌘V og at slippe en fil. I Demaskér står "Åbn Sager" under linjen, når der skal en sag til. "Vis sagens
    // indhold" (V-MANUEL.2) står nu i venstre side (Gemte erstatninger).
    tjek(`V-OPBYG.1 N3: ${v}: kittets handlinger: ${v === 'demasker' ? 'Indsæt svar' : 'Indsæt tekst'} (primær) og Åbn fil i .tomt-handlinger, linjen om ⌘V under${v === 'demasker' ? ', og Åbn Sager under den' : ''}`, h && h.children.length === 2 && knapper.join() === (v === 'demasker' ? 'Indsæt svar*,Åbn fil,Åbn Sager' : 'Indsæt tekst*,Åbn fil') && t.querySelector('.tomt-linje').textContent === 'Du kan også trykke ⌘V eller slippe en fil her.' && (v === 'masker' || t.querySelector('.tomt-linje').nextElementSibling.classList.contains('tomt-ekstra')), knapper.join());
  }
  const tilSager = d.querySelector('section[data-visning="demasker"] .tomt-ekstra');
  tjek('V-KITBRUG.2 N3 (G8): Demaskér: Åbn Sager vises, når sagen er tom og der er gemte sager (kittets regel: den hjælper videre)', !tilSager.hidden);
  klik(w, tilSager); await vent(5);
  tjek('V-KITBRUG.2 N3 (G8): Demaskér: Åbn Sager går til Sager', synlige(d).join() === 'sager');
  w.Grimnir.vis('masker'); await vent(5);
  const aabnFil = d.querySelector('section[data-visning="masker"] .tomt-handlinger > button:last-child');
  const r2 = falskFilRust({ antal: 3 });
  const s2 = side({ rust: r2 });
  await vent(5);
  tjek('V-KITBRUG.2 N3 (G8): Demaskér: Åbn Sager er skjult, når der ingen gemte sager er (den ville ikke hjælpe videre)', s2.d.querySelector('section[data-visning="demasker"] .tomt-ekstra').hidden);
  klik(s2.w, s2.d.querySelector('section[data-visning="masker"] .tomt-handlinger > button:last-child')); await vent(10);
  tjek('V-KITBRUG.2 N3 (G8): Åbn fil i den tomme flade åbner filvalget (fil_aabn) som kommandoen i båndet', s2.kald.some(k => k[0] === 'fil_aabn' && k[1].visning === 'masker') && aabnFil.textContent === 'Åbn fil');
  // Trækket: kittets .tomt-slip på den tomme flade; med en tekst hele fladen (data-traek) som før.
  const s3 = side({ rust: falskFilRust({ antal: 3 }) });
  await vent(5);
  const t3 = s3.d.querySelector('section[data-visning="masker"] .tomt'), f3 = t3.parentElement;
  s3.emit('fil-traek', true);
  const tom = t3.classList.contains('tomt-slip') && !f3.hasAttribute('data-traek');
  s3.emit('fil-traek', false);
  const vaek = !t3.classList.contains('tomt-slip');
  indsaet(s3.w, t3, TEKST);
  s3.emit('fil-traek', true);
  tjek('V-KITBRUG.2 N3 (G8): træk: .tomt-slip på den tomme flade (sat af Grimnir), væk igen bagefter; med en tekst hele fladen', tom && vaek && f3.hasAttribute('data-traek') && !t3.classList.contains('tomt-slip'));
  tjek('V-KITBRUG.2 N3 (G8): kittet læser ingen filer: ingen fil-API i Grimnirs og kittets JavaScript', !/FileReader|dataTransfer\.files|type=["']file["']/.test(ui('assets/kit.js') + ui('assets/maskering.js') + ui('assets/app.js')));
})();
await (async () => {
  // N4: ⌘+ ⌘− ⌘0 (⌘= er ⌘+), stopper ved lille og stor, virker låst og med en dialog åben, følger Indstillinger begge veje.
  const s = side();
  const { d, w } = s;
  await vent(5);
  const html = d.documentElement, r = v => d.querySelector(`input[name="indst-tekst"][value="${v}"]`);
  const tast = (key, x = {}) => { const e = new w.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, metaKey: true, ...x }); d.dispatchEvent(e); return e; };
  const e1 = tast('+');
  tjek('V-KITBRUG.2 N4: ⌘+ gør teksten større (normal → stor) og tager tasten (preventDefault, så menuen ikke også gør det)', html.getAttribute('data-tekst') === 'stor' && w.Tekst.valg === 'stor' && e1.defaultPrevented);
  tast('+');
  tjek('V-KITBRUG.2 N4: ⌘+ stopper ved stor', w.Tekst.valg === 'stor');
  tast('-'); tast('-'); tast('-');
  tjek('V-KITBRUG.2 N4: ⌘− gør teksten mindre og stopper ved lille', w.Tekst.valg === 'lille' && html.getAttribute('data-tekst') === 'lille');
  tast('=');
  tjek('V-KITBRUG.2 N4: ⌘= tæller som ⌘+ (lille → normal)', w.Tekst.valg === 'normal' && !html.hasAttribute('data-tekst'));
  tast('+', { shiftKey: true, code: 'Equal' });
  tjek('V-KITBRUG.2 N4: ⌘⇧= (+ på et engelsk tastatur) gør teksten større', w.Tekst.valg === 'stor');
  tast('0');
  tjek('V-KITBRUG.2 N4: ⌘0 giver normal', w.Tekst.valg === 'normal' && !html.hasAttribute('data-tekst'));
  tast('+', { metaKey: false, ctrlKey: true });
  tjek('V-KITBRUG.2 N4: Ctrl++ gør intet på macOS', w.Tekst.valg === 'normal');
  tast('+', { altKey: true });
  tjek('V-KITBRUG.2 N4: ⌥⌘+ gør intet', w.Tekst.valg === 'normal');
  // Følger Indstillinger begge veje, også med Indstillinger åben.
  s.emit('menu', 'indstillinger'); await vent(5);
  tast('+');
  tjek('V-KITBRUG.2 N4: genvejen virker med en dialog åben, og Indstillinger viser valget (Stor)', aaben(d, 'dlg-indst') && r('stor').checked && w.Tekst.valg === 'stor');
  r('lille').checked = true;
  r('lille').dispatchEvent(new w.Event('change', { bubbles: true }));
  tast('+');
  tjek('V-KITBRUG.2 N4: et valg i Indstillinger er udgangspunktet for genvejen (lille → normal)', w.Tekst.valg === 'normal' && r('normal').checked);
  d.querySelector('#dlg-indst [data-svar="luk"]').click();
  // Menuen Vis: hændelsen 'menu' med tekst-stoerre, tekst-mindre og tekst-normal.
  s.emit('menu', 'tekst-stoerre');
  const a = w.Tekst.valg;
  s.emit('menu', 'tekst-mindre'); s.emit('menu', 'tekst-mindre');
  const b = w.Tekst.valg;
  s.emit('menu', 'tekst-normal');
  tjek('V-KITBRUG.2 N4: menuens hændelser tekst-stoerre, tekst-mindre og tekst-normal skifter trinnet og åbner ingen dialog', a === 'stor' && b === 'lille' && w.Tekst.valg === 'normal' && d.querySelectorAll('dialog[open]').length === 0);
  tjek('V-KITBRUG.2 N4: valget huskes af kittet (localStorage grimnir-tekst), og Rust kaldes ikke', w.localStorage.getItem('grimnir-tekst') === 'normal' && !s.kald.some(k => /tekst/.test(k[0])));
  // Engelsk: samme taster; Indstillinger på engelsk viser valget.
  w.Sprog.saet('en');
  tast('-');
  tjek('V-KITBRUG.2 N4: på engelsk virker genvejene ens, og Indstillinger viser Small', w.Tekst.valg === 'lille' && r('lille').closest('label').textContent === 'Small' && r('lille').checked);
  w.Sprog.saet('da');
  // Låseskærmen.
  const rl = falskLaasRust({ svar: [{ svar: 'annulleret' }] });
  const sl = side({ rust: rl });
  await vent(30);
  sl.d.dispatchEvent(new sl.w.KeyboardEvent('keydown', { key: '+', metaKey: true, bubbles: true, cancelable: true }));
  const laastStor = sl.w.Tekst.valg;
  sl.emit('menu', 'tekst-mindre');
  tjek('V-KITBRUG.2 N4: genvejen og menuen virker på låseskærmen', sl.d.documentElement.hasAttribute('data-laast') && laastStor === 'stor' && sl.w.Tekst.valg === 'normal');
  // Windows: Ctrl.
  const sw = side({ platform: 'windows' });
  await vent(5);
  const ew = new sw.w.KeyboardEvent('keydown', { key: '=', ctrlKey: true, bubbles: true, cancelable: true });
  sw.d.dispatchEvent(ew);
  sw.d.dispatchEvent(new sw.w.KeyboardEvent('keydown', { key: '+', metaKey: true, bubbles: true, cancelable: true }));
  tjek('V-KITBRUG.2 N4: Windows: Ctrl+= gør teksten større; ⌘ (Windows-tasten) gør intet', sw.w.Tekst.valg === 'stor' && ew.defaultPrevented);
  sw.d.dispatchEvent(new sw.w.KeyboardEvent('keydown', { key: '0', ctrlKey: true, bubbles: true, cancelable: true }));
  tjek('V-KITBRUG.2 N4: Windows: Ctrl+0 giver normal', sw.w.Tekst.valg === 'normal');
})();
await (async () => {
  // N5: ⌘1–⌘4 med en dialog åben skifter ikke visningen bag den; lukket virker de igen.
  const s = side({ rust: falskSagRust({ sager: SAGER() }) });
  const { d } = s;
  await vent(10);
  s.emit('menu', 'om'); await vent(5);
  s.tast('2', { metaKey: true, code: 'Digit2' }); await vent(5);
  tjek('V-KITBRUG.2 N5: med en dialog åben gør ⌘2 intet (visningen bag dialogen skifter ikke)', synlige(d).join() === 'masker' && aaben(d, 'dlg-om'));
  d.querySelector('#dlg-om [data-svar="luk"]').click();
  s.tast('2', { metaKey: true, code: 'Digit2' }); await vent(5);
  tjek('V-KITBRUG.2 N5: kontrol: lukket skifter ⌘2 til Demaskér', synlige(d).join() === 'demasker');
  const sw = side({ platform: 'windows' });
  await vent(5);
  sw.emit('menu', 'om'); await vent(5);
  sw.tast('3', { ctrlKey: true, code: 'Digit3' }); await vent(5);
  tjek('V-KITBRUG.2 N5: Windows: med en dialog åben gør Ctrl+3 intet', synlige(sw.d).join() === 'masker');
})();
await (async () => {
  // N5: fladerne, der deler højden (Maskér, Demaskér, Ordbog), har ingen faste vh; fordelingen er fleksibel.
  const app = ui('assets/app.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const regler = [...app.matchAll(/(^|\n)\s*([^{}@]+)\{([^}]*)\}/g)].map(m => [m[2].trim(), m[3]]);
  const deler = regler.filter(([sel]) => /\.tekst\b|\.tabelvaert|\.delt|\.advarselpanel|\.ordbogflade|\.arbejde|\.fyld/.test(sel) && !/\.sagtabel|\.sagliste/.test(sel));
  tjek('V-KITBRUG.2 N5: ingen fast vh på de flader, der deler højden (tekst, tabel, delt, advarsler, ordbog)', deler.length >= 8 && deler.every(([, k]) => !/\dvh/.test(k)), deler.filter(([, k]) => /\dvh/.test(k)).map(([s]) => s).join(' | '));
  tjek('V-KITBRUG.2 N5: Maskér under hinanden: tekst og fund deler højden 24 : 44 med fr (ingen vh) i begge stak-grænser', (app.match(/\.delt:not\(\.lige\) \{ grid-template-columns: minmax\(0, 1fr\); grid-template-rows: minmax\(min-content, 24fr\) minmax\(min-content, 44fr\); \}/g) || []).length === 2);
  tjek('V-KITBRUG.2 N5: mindstehøjderne er der stadig (tekst og tabel), og fladen fylder (flex) i stedet for at rulle', /\.flade\.fyld \{ display: flex; flex-direction: column; --min-tekst: \d+px; --min-tabel: \d+px; \}/.test(app) && /min-height: var\(--min-tekst\)/.test(app) && /min-height: var\(--min-tabel\)/.test(app));
  const s = side({ rust: falskOrdbogRust({ indst: { guide_vist: true } }) });
  await vent(20);
  tjek('V-KITBRUG.2 N5: Maskér, Demaskér og Ordbog har .fyld på fladen; Sager har ikke', ['masker', 'demasker', 'ordbog'].every(v => s.d.querySelector(`section[data-visning="${v}"] > .flade`).classList.contains('fyld')) && !s.d.querySelector('section[data-visning="sager"] > .flade').classList.contains('fyld'));
  tjek('V-KITBRUG.2 N5: Ordbog: Prøv på tekst står i hjælpelinjen efter tabellen i den flade, der fylder (synlig uden at rulle; målt)', (() => { const a = s.d.querySelector('section[data-visning="ordbog"] .ordbogflade'); return a && a.lastElementChild.classList.contains('hjaelpelinje') && a.lastElementChild.querySelector('button').textContent === 'Prøv på tekst'; })() && /\.flade\.fyld \.ordbogflade > \.hjaelpelinje \{ flex: none; \}/.test(app));
})();

// ══════════════════ V-PUDS.3: rettelser efter vinduesprøven 2026-11-12 (N1–N7) ══════════════════
// En lille kaskade over kit.css og app.css uden @media (grundtilstanden), fordi jsdom ikke selv lægger CSS på: den regel,
// der passer på elementet (el.matches) og har størst specificitet (id, klasse/attribut/pseudoklasse, element), og ved lige
// specificitet den sidste. Regler, jsdom ikke kan læse (::backdrop, ::-webkit-…), springes over.
const CSS_REGLER = (() => {
  const ud = [];
  let nr = 0;
  for (const fil of ['assets/kit.css', 'assets/app.css']) {
    const t = ui(fil).replace(/\/\*[\s\S]*?\*\//g, '');
    let u = '', i = 0;
    while (i < t.length) {
      const m = t.indexOf('@', i);
      if (m < 0) { u += t.slice(i); break; }
      u += t.slice(i, m);
      const a = t.indexOf('{', m), semi = t.indexOf(';', m);
      if (semi >= 0 && (a < 0 || semi < a)) { i = semi + 1; continue; }
      let dyb = 1, j = a + 1;
      while (dyb && j < t.length) { if (t[j] === '{') dyb++; else if (t[j] === '}') dyb--; j++; }
      i = j;
    }
    for (const m of u.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
      const decl = {};
      for (const dd of m[2].split(';')) { const k = dd.indexOf(':'); if (k > 0) decl[dd.slice(0, k).trim()] = dd.slice(k + 1).trim(); }
      for (const sel of m[1].split(',').map(x => x.trim()).filter(Boolean)) ud.push({ sel, decl, nr: nr++ });
    }
  }
  return ud;
})();
const specificitet = sel => {
  const id = (sel.match(/#[\w-]+/g) || []).length;
  const kl = (sel.match(/\.[\w-]+|\[[^\]]+\]|:(?!:)[\w-]+/g) || []).length;
  const el = (sel.replace(/\[[^\]]*\]/g, '').match(/(^|[\s>+~(])[a-z][\w-]*/gi) || []).length;
  return id * 10000 + kl * 100 + el;
};
function cssVaerdi(e, prop) {
  let bedst = null;
  for (const r of CSS_REGLER) {
    if (!(prop in r.decl)) continue;
    let passer = false;
    try { passer = e.matches(r.sel); } catch (x) { passer = false; }
    if (!passer) continue;
    const sp = specificitet(r.sel);
    if (!bedst || sp > bedst.sp || (sp === bedst.sp && r.nr > bedst.nr)) bedst = { sp, nr: r.nr, v: r.decl[prop] };
  }
  return bedst ? bedst.v : null;
}
const elNavn = e => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (e.className && typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/\s+/).join('.') : '');
await (async () => {
  // Kontrol af kaskaden: kendte værdier fra kit.css og app.css.
  const { d } = side();
  await vent(5);
  const sp = d.createElement('span');
  sp.className = 'skjult-tekst';
  d.body.appendChild(sp);
  const tv = d.createElement('div');
  tv.className = 'tabelvaert';
  d.body.appendChild(tv);
  tjek('V-PUDS.3: kontrol: testens kaskade læser kit.css og app.css (.skjult-tekst er absolute, .tabelvaert har overflow: auto, et <p> uden regel har ingen position)', cssVaerdi(sp, 'position') === 'absolute' && cssVaerdi(tv, 'overflow') === 'auto' && cssVaerdi(d.createElement('p'), 'position') === null && CSS_REGLER.length > 300, String(CSS_REGLER.length));
  sp.remove();
  tv.remove();
})();

// ── N1: hjælpeteksterne i Indstillinger har dialogens bredde; de andre dialoger gennemgået ──
await (async () => {
  const s = side({ rust: falskOrdbogRust({ indst: { guide_vist: true } }) });
  const { d } = s;
  await vent(20);
  s.emit('menu', 'indstillinger'); await vent(5);
  const dlg = d.getElementById('dlg-indst');
  // Elementet og dets forfædre inde i dialogen: hvilke har en max-width (andet end none og 100 %)?
  const smal = e => { const ud = []; for (let a = e; a && !a.classList.contains('modal'); a = a.parentElement) { const v = cssVaerdi(a, 'max-width'); if (v && v !== 'none' && v !== '100%') ud.push(elNavn(a) + ': ' + v); } return ud; };
  const hj = d.getElementById('indst-stilstand-hj'), liste = d.getElementById('indst-stilstand');
  tjek('V-PUDS.3 N1: Indstillinger: hjælpen under "Lås efter stilstand" har dialogens bredde (ingen max-width på teksten eller en forfader i dialogen)', aaben(d, 'dlg-indst') && hj && smal(hj).length === 0, hj ? smal(hj).join(' | ') : 'ingen hjælp');
  tjek('V-PUDS.3 N1: … selve listen er stadig højst 260 px', cssVaerdi(liste.closest('.vliste'), 'max-width') === '260px' && smal(liste).join() === 'span.vliste: 260px', smal(liste).join(' | '));
  tjek('V-PUDS.3 N1: … og listens aria-describedby peger stadig på hjælpen (macOS: hjLaas)', liste.getAttribute('aria-describedby') === 'indst-stilstand-hj' && hj.textContent.startsWith('Grimnir låser altid, når den starter'));
  const guideHj = [...dlg.querySelectorAll('.valg > .hj')].find(h => h.getAttribute('data-t') === 'hjGuide');
  tjek('V-PUDS.3 N1: hjælpen under "Første start" står ved gruppens venstrekant (margin 0, ikke rykket 24 px ind) og har dialogens bredde', guideHj && cssVaerdi(guideHj, 'margin') === '0' && cssVaerdi(guideHj, 'margin-left') === null && smal(guideHj).length === 0, guideHj ? cssVaerdi(guideHj, 'margin') : 'ingen');
  const sagHj = d.getElementById('sag-valg-hj');
  tjek('V-PUDS.3 N1: kontrol: sagens dialog: hjælpen efter de to afkrydsninger står stadig 24 px inde under deres tekst (som før)', sagHj && sagHj.previousElementSibling.classList.contains('afk-felt') && cssVaerdi(sagHj, 'margin') === '-4px 0 0 24px');
  // Gennemgang af alle dialoger, der står i DOM'en fra start (de ti kittets dialoger; bekræftelserne har ingen felter).
  const dialoger = [...d.querySelectorAll('dialog.modal')];
  const tekster = dialoger.flatMap(x => [...x.querySelectorAll('.hj, .afk-hj, .fejltekst, .modal-fejl, .raekkeadv')]);
  const smalle = tekster.filter(t => smal(t).length).map(t => `${t.closest('dialog').id} ${elNavn(t)}: ${smal(t).join(', ')}`);
  tjek(`V-PUDS.3 N1: gennemgang: ingen hjælpe- eller fejltekst i de ${dialoger.length} dialoger er smallere end dialogen (${tekster.length} tekster)`, dialoger.length >= 10 && tekster.length >= 15 && smalle.length === 0, smalle.join(' | '));
  tjek('V-PUDS.3 N1: app.css: ingen regel giver .valg .felt en max-width (kun .vliste i den)', !CSS_REGLER.some(r => r.sel === '.valg .felt' && 'max-width' in r.decl) && CSS_REGLER.some(r => r.sel === '.valg .felt > .vliste' && r.decl['max-width'] === '260px'));
})();

// ── V-PUDS.3 N2 → V-MANUEL.1 N4: "Næste advarsel" er bygget (de to tjek om pladsholderen er erstattet af afsnittet
//    "V-MANUEL.1 N4" længere nede) ──

// ── N4: fejlen i en dialog ryddes, når feltet, den handler om, ændres ──
await (async () => {
  const rust = falskSagRust({ sager: SAGER() });
  const s = side({ hash: '#sager', rust });
  const { d, w } = s;
  await vent(10);
  klik(w, knapI(d, 'sager', 'ny-sag'));
  const fe = d.getElementById('dlg-ny-sag-fejl'), navn = d.getElementById('ny-sag-navn'), udl = d.getElementById('ny-sag-udloeb');
  klik(w, d.getElementById('ny-sag-opret')); await vent(5);
  tjek('V-PUDS.3 N4: Ny sag: tomt navn giver "Skriv et navn." (som før)', aaben(d, 'dlg-ny-sag') && fe.textContent === 'Skriv et navn.');
  udl.value = '2027-01-31';
  udl.dispatchEvent(new w.Event('input', { bubbles: true }));
  udl.dispatchEvent(new w.Event('change', { bubbles: true }));
  tjek('V-PUDS.3 N4: Ny sag: fejlen hører til Navn og bliver stående, når Udløb ændres', fe.textContent === 'Skriv et navn.');
  skriv(w, navn, 'S');
  tjek('V-PUDS.3 N4: Ny sag: fejlen forsvinder, så snart der skrives i Navn (dialogen er stadig åben)', fe.textContent === '' && aaben(d, 'dlg-ny-sag'));
  skriv(w, navn, '');
  klik(w, d.getElementById('ny-sag-opret')); await vent(5);
  tjek('V-PUDS.3 N4: Ny sag: et nyt forsøg med tomt navn viser fejlen igen', fe.textContent === 'Skriv et navn.');
  rust.sag_ny = () => { throw { art: 'sag', fejl: { art: 'disk', hvad: 'PermissionDenied' } }; };
  skriv(w, navn, 'Supportsag 0099');
  klik(w, d.getElementById('ny-sag-opret')); await vent(10);
  const rustFejl = fe.textContent;
  tjek('V-PUDS.3 N4: Ny sag: en fejl fra Rust efter et forsøg vises som før (fejlfeltet, dialogen åben)', rustFejl.length > 10 && rustFejl !== 'Skriv et navn.' && aaben(d, 'dlg-ny-sag'), rustFejl);
  udl.value = '2027-02-28';
  udl.dispatchEvent(new w.Event('change', { bubbles: true }));
  tjek('V-PUDS.3 N4: … og ryddes, når et vilkårligt felt ændres (her Udløb), fordi den ikke hører til ét felt', fe.textContent === '');
  // Åbnet igen efter "Skriv et navn.": kittet tømmer fejlfeltet ved åbning, og en fejl fra Rust gælder hele dialogen.
  skriv(w, navn, '');
  klik(w, d.getElementById('ny-sag-opret')); await vent(5);
  klik(w, d.querySelector('#dlg-ny-sag [data-svar="annuller"]'));
  klik(w, knapI(d, 'sager', 'ny-sag'));
  const tomVedAabning = fe.textContent === '';
  skriv(w, navn, 'Supportsag 0100');
  klik(w, d.getElementById('ny-sag-opret')); await vent(10);
  const igen = fe.textContent;
  udl.value = '2027-03-31';
  udl.dispatchEvent(new w.Event('change', { bubbles: true }));
  tjek('V-PUDS.3 N4: Ny sag åbnet igen efter "Skriv et navn.": fejlfeltet er tomt, og en fejl fra Rust ryddes stadig af et vilkårligt felt (her Udløb)', tomVedAabning && igen === rustFejl && fe.textContent === '', `${tomVedAabning} «${igen}» «${fe.textContent}»`);
  klik(w, d.querySelector('#dlg-ny-sag [data-svar="annuller"]'));
  // Omdøb
  klik(w, sagRaekke(d, hexId(1)).children[0]);
  klik(w, knapI(d, 'sager', 'omdoeb'));
  const ofe = d.getElementById('dlg-omdoeb-fejl'), onavn = d.getElementById('omdoeb-navn');
  skriv(w, onavn, '   ');
  klik(w, d.getElementById('omdoeb-ok')); await vent(5);
  tjek('V-PUDS.3 N4: Omdøb: tomt navn giver fejlen (som før)', aaben(d, 'dlg-omdoeb') && ofe.textContent === 'Skriv et navn.');
  skriv(w, onavn, 'Supportsag 0043');
  tjek('V-PUDS.3 N4: Omdøb: fejlen forsvinder, så snart der skrives i Navn', ofe.textContent === '');
  klik(w, d.querySelector('#dlg-omdoeb [data-svar="annuller"]'));
  // Udløb: fejlen handler om udløbet; både en dato og "Ingen udløb" rydder den.
  klik(w, knapI(d, 'sager', 'udloeb'));
  const ufe = d.getElementById('dlg-udloeb-fejl'), uingen = d.getElementById('udloeb-ingen'), udato = d.getElementById('udloeb-dato');
  const saetIngen = v => { uingen.checked = v; uingen.dispatchEvent(new w.Event('change', { bubbles: true })); };
  saetIngen(false);
  klik(w, d.getElementById('udloeb-ok')); await vent(5);
  tjek('V-PUDS.3 N4: Udløb: uden dato og uden flueben giver fejlen (som før)', ufe.textContent === 'Vælg en dato, eller sæt flueben ved Ingen udløb.');
  saetIngen(true);
  tjek('V-PUDS.3 N4: Udløb: fejlen forsvinder ved flueben i Ingen udløb', ufe.textContent === '');
  saetIngen(false);
  klik(w, d.getElementById('udloeb-ok')); await vent(5);
  udato.value = datoOm(20);
  udato.dispatchEvent(new w.Event('input', { bubbles: true }));
  tjek('V-PUDS.3 N4: Udløb: … og når en dato vælges', ufe.textContent === '' && aaben(d, 'dlg-udloeb'));
  klik(w, d.querySelector('#dlg-udloeb [data-svar="annuller"]'));
})();
await (async () => {
  // Tilføj post (fejl under feltet og i fejlfeltet), Indstillinger (fejl fra Rust) og guiden (fejl under feltet).
  const rust = falskOrdbogRust({ indst: { guide_vist: true }, gemFejl: true });
  const s = side({ hash: '#ordbog', rust });
  const { d, w } = s;
  await vent(20);
  klik(w, knapI(d, 'ordbog', 'tilfoej-post'));
  const vaerdi = d.getElementById('opost-vaerdi'), note = d.getElementById('opost-note'), vfe = d.getElementById('opost-vaerdi-fejl'), pfe = d.getElementById('dlg-opost-fejl');
  klik(w, d.getElementById('opost-ok')); await vent(5);
  tjek('V-PUDS.3 N4: Tilføj post: tom værdi giver fejlen under Værdi (som før)', vfe.textContent === 'Skriv en værdi.' && vaerdi.getAttribute('aria-invalid') === 'true');
  skriv(w, note, 'n');
  tjek('V-PUDS.3 N4: Tilføj post: fejlen under Værdi bliver stående, når Note ændres', vfe.textContent === 'Skriv en værdi.');
  skriv(w, vaerdi, 'k');
  tjek('V-PUDS.3 N4: Tilføj post: fejlen under Værdi forsvinder, så snart der skrives i Værdi (også aria-invalid)', vfe.textContent === '' && !vaerdi.hasAttribute('aria-invalid'));
  skriv(w, vaerdi, 'kontor.test');
  klik(w, d.getElementById('opost-ok')); await vent(10);
  const pf = pfe.textContent;
  tjek('V-PUDS.3 N4: Tilføj post: en fejl fra Rust, der ikke hører til et felt, står i fejlfeltet (som før)', pf.length > 10 && aaben(d, 'dlg-opost'), pf);
  skriv(w, note, 'arbejdsstationer');
  tjek('V-PUDS.3 N4: … og ryddes, når et vilkårligt felt ændres (her Note)', pfe.textContent === '');
  klik(w, d.querySelector('#dlg-opost [data-svar="annuller"]'));
  // Indstillinger: en fejl fra Rust efter en ændring; næste ændring rydder den.
  s.emit('menu', 'indstillinger'); await vent(5);
  const ife = d.getElementById('dlg-indst-fejl'), fremmede = d.getElementById('indst-fremmede');
  fremmede.checked = !fremmede.checked;
  fremmede.dispatchEvent(new w.Event('change', { bubbles: true })); await vent(10);
  tjek('V-PUDS.3 N4: Indstillinger: en fejl fra Rust efter en ændring vises som før', ife.textContent.length > 10, ife.textContent);
  const lys = d.querySelector('input[name="indst-tema"][value="moerk"]');
  lys.checked = true;
  lys.dispatchEvent(new w.Event('change', { bubbles: true }));
  tjek('V-PUDS.3 N4: … og ryddes ved næste ændring i dialogen (her Tema, som ikke går til Rust)', ife.textContent === '');
  // Guiden: fejlen under feltet ryddes, når der skrives i det.
  klik(w, d.getElementById('indst-guide')); await vent(5);
  klik(w, [...d.querySelectorAll('#dlg-guide .fod button')][2]); await vent(5);
  const gf = d.getElementById('guide-domaene'), gfe = d.getElementById('guide-domaene-fejl');
  klik(w, gf.closest('.guide-felt').querySelector('button'));
  tjek('V-PUDS.3 N4: guiden: tomt felt giver fejlen under feltet (som før)', gfe.textContent === 'Skriv en værdi.' && gf.getAttribute('aria-invalid') === 'true');
  skriv(w, gf, 'e');
  tjek('V-PUDS.3 N4: guiden: fejlen forsvinder, så snart der skrives i feltet', gfe.textContent === '' && !gf.hasAttribute('aria-invalid'));
  tjek('V-PUDS.3 N4: lytteren står i opsamlingsfasen på dialogen (input og change), så et felts egen fejl ved samme ændring bliver stående', /addEventListener\('input', ryd, true\)/.test(ui('assets/app.js')) && /addEventListener\('change', ryd, true\)/.test(ui('assets/app.js')));
})();

// ── N5: linjetal straks og størrelse i en enhed, der passer ──
await (async () => {
  const { w } = side();
  await vent(5);
  const GM = w.GrimnirMaskering;
  const rs = fs.readFileSync(path.join(repo, 'src-tauri', 'src', 'fil.rs'), 'utf8');
  const fra = rs.indexOf('fn antal_linjer_efter_reglen');
  const blok = rs.slice(fra, rs.indexOf('for &(t, n) in tilfaelde', fra));
  const tilf = [...blok.matchAll(/\("((?:[^"\\]|\\.)*)", (\d+)\)/g)].map(m => [m[1].replace(/\\(.)/g, (_, c) => ({ r: '\r', n: '\n', t: '\t' }[c] ?? c)), Number(m[2])]);
  const forkert = tilf.filter(([t, n]) => GM.antalLinjer(t) !== n).map(([t, n]) => `${JSON.stringify(t)}: ${GM.antalLinjer(t)} ≠ ${n}`);
  tjek(`V-PUDS.3 N5: webvisningens linjetal følger Rusts regel i alle ${tilf.length} tilfælde i fil.rs (antal_linjer_efter_reglen)`, fra > 0 && tilf.length >= 16 && forkert.length === 0, forkert.join(' | '));
  // Tilfældige tekster af LF, CR, CRLF, bogstaver, æ og et tegn uden for BMP mod reglen skrevet som i Rust (linjeskift_ved).
  const rustRegel = t => { if (!t) return 0; let n = 0; for (let i = 0; i < t.length; i++) { if (t[i] === '\n' || (t[i] === '\r' && t[i + 1] !== '\n')) n++; } return n + (/[\r\n]$/.test(t) ? 0 : 1); };
  let frø = 7, afv = [];
  const tilfaeldig = () => { frø = (frø * 1103515245 + 12345) % 2147483648; return frø / 2147483648; };
  const ALFA = ['a', 'b', '\r', '\n', '\r\n', 'æ', '😀', ' '];
  for (let k = 0; k < 3000; k++) {
    let t = '';
    const n = Math.floor(tilfaeldig() * 12);
    for (let i = 0; i < n; i++) t += ALFA[Math.floor(tilfaeldig() * ALFA.length)];
    if (GM.antalLinjer(t) !== rustRegel(t)) afv.push(JSON.stringify(t));
  }
  tjek('V-PUDS.3 N5: … og i 3000 tilfældige tekster af LF, CR, CRLF, æ og 😀 (samme regel skrevet tegn for tegn)', afv.length === 0, afv.slice(0, 3).join(' | '));
  const S = w.Sprog;
  const str = b => GM.stoerrelse(b);
  S.saet('da');
  const da = [0, 1, 2, 1023, 1024, 1535, 1536, 104857, 104858, 5 * 1048576, 8 * 1048576].map(str);
  tjek('V-PUDS.3 N5: størrelsen på dansk: bytes under 1 kB, hele kB under 0,1 MB, MB med én decimal og komma', da.join(' | ') === '0 bytes | 1 byte | 2 bytes | 1.023 bytes | 1 kB | 1 kB | 2 kB | 102 kB | 0,1 MB | 5,0 MB | 8,0 MB', da.join(' | '));
  S.saet('en');
  const en = [0, 1, 1023, 1024, 104857, 104858, 5 * 1048576].map(str);
  tjek('V-PUDS.3 N5: … og på engelsk med punktum og komma som tusindtalsskille', en.join(' | ') === '0 bytes | 1 byte | 1,023 bytes | 1 kB | 102 kB | 0.1 MB | 5.0 MB', en.join(' | '));
  S.saet('da');
})();
await (async () => {
  const s = side({ rust: falskRust() });
  const { d, w } = s;
  await vent(5);
  const GM = w.GrimnirMaskering;
  const sek = d.querySelector('section[data-visning="masker"]');
  const info = () => sek.querySelector('.panel .panel-hoved .muted').textContent;
  const kaldFoer = s.kald.length;
  indsaet(w, sek.querySelector('.tomt'), TEKST);
  const n = GM.utf8Laengde(TEKST);
  tjek(`V-PUDS.3 N5: Maskér før analysen: panelhovedet viser linjetallet straks og størrelsen i bytes ("3 linjer · ${n} bytes")`, info() === `3 linjer · ${n} bytes`, info());
  tjek('V-PUDS.3 N5: … uden et kald til Rust ud over analysen (teksten sendes ikke for at blive talt; V-OPBYG.1: analysen sker ved indsætningen)', s.kald.slice(kaldFoer).map(k => k[0]).join() === 'analyser', JSON.stringify(s.kald.slice(kaldFoer).map(k => k[0])));
  await vent(5);
  tjek('V-PUDS.3 N5: … og efter analysen det samme tal fra Rust', info() === `3 linjer · ${n} bytes` && s.kald.some(k => k[0] === 'analyser'), info());
  const stor = 'x'.repeat(200000) + '\n' + 'y'.repeat(10);
  indsaet(w, sek.querySelector('pre.tekst'), stor);
  tjek('V-PUDS.3 N5: en tekst på 200.011 bytes: "2 linjer · 0,2 MB"', info() === '2 linjer · 0,2 MB', info());
  w.Sprog.saet('en'); await vent(5);
  tjek('V-PUDS.3 N5: sprogskift: talformatet følger med ("2 lines · 0.2 MB")', info() === '2 lines · 0.2 MB', info());
  w.Sprog.saet('da'); await vent(5);
  w.location.hash = 'demasker'; await vent(5);
  const dsek = d.querySelector('section[data-visning="demasker"]');
  indsaet(w, dsek.querySelector('.tomt'), 'Prøv h0099\n');
  tjek('V-PUDS.3 N5: Demaskér før demaskering: "1 linje · 12 bytes" (det samme i Demaskér)', dsek.querySelector('.panel .panel-hoved .muted').textContent === '1 linje · 12 bytes', dsek.querySelector('.panel .panel-hoved .muted').textContent);
  tjek('V-PUDS.3 N5: sprog.js: tekstInfo har størrelsen som en færdig tekst ({w}) og enhederne bytes, kB og MB i begge sprog', ['da', 'en'].every(sp => /· \{w\}'?$/.test(w.Sprog.TEKST[sp].tekstInfo) && w.Sprog.TEKST[sp].strB === '{v} {v:byte|bytes}' && w.Sprog.TEKST[sp].strKB === '{v} kB' && w.Sprog.TEKST[sp].strMB === '{v} MB'));
})();

// ── N6: Indsæt i båndet ──
await (async () => {
  const s = side({ rust: falskRust() });
  const { d, w } = s;
  await vent(5);
  const kaldt = [];
  // jsdom indsætter ikke selv: som en webvisning, der ikke må hente udklipsholderen (execCommand giver false).
  d.execCommand = c => { kaldt.push(c); return false; };
  const sek = d.querySelector('section[data-visning="masker"]');
  const arb = sek.querySelector('.arbejde'), tb = sek.querySelector('.tom-bannere');
  const synlig = e => { for (let a = e; a; a = a.parentElement) if (a.hidden) return false; return true; };
  // Bannerets tekst (kittets banner har et symbol foran ordene).
  const ord = e => { const o = e && e.querySelector('.ban .ord'); return o ? o.textContent : null; };
  klik(w, knapI(d, 'masker', 'indsaet'));
  tjek('V-PUDS.3 N6: Indsæt kalder execCommand("paste") i selve klikket (en brugerhandling), samme vej som ⌘V', kaldt.join() === 'paste');
  tjek('V-PUDS.3 N6: Indsæt uden tekst: kan webvisningen ikke hente udklipsholderen, står "Tryk ⌘V for at indsætte." synligt over den tomme flade', arb.hidden && ord(tb) === 'Tryk ⌘V for at indsætte.' && synlig(tb.querySelector('.ban')), tb.textContent);
  tjek('V-PUDS.3 N6: … ikke i det skjulte arbejde (det var fejlen: beskeden stod i .arbejde .besked, som er skjult uden en tekst)', sek.querySelector('.arbejde .besked').textContent === '');
  klik(w, knapI(d, 'masker', 'indsaet'));
  tjek('V-PUDS.3 N6: et nyt klik giver stadig én besked, ikke to', tb.children.length === 1);
  indsaet(w, sek.querySelector('.tomt'), TEKST);
  tjek('V-PUDS.3 N6: … og beskeden forsvinder, når teksten kommer (⌘V)', tb.textContent === '' && !arb.hidden);
  klik(w, knapI(d, 'masker', 'indsaet'));
  const besk = sek.querySelector('.arbejde .besked');
  tjek('V-PUDS.3 N6: med en tekst står beskeden som før over teksten (synlig)', besk.textContent === 'Tryk ⌘V for at indsætte.' && synlig(besk) && tb.textContent === '');
  w.location.hash = 'demasker'; await vent(5);
  const dsek = d.querySelector('section[data-visning="demasker"]');
  klik(w, knapI(d, 'demasker', 'indsaet'));
  tjek('V-PUDS.3 N6: det samme i Demaskér uden tekst', dsek.querySelector('.arbejde').hidden && ord(dsek.querySelector('.tom-bannere')) === 'Tryk ⌘V for at indsætte.');
  d.execCommand = c => { kaldt.push(c); return true; };
  dsek.querySelector('.tom-bannere').textContent = '';
  klik(w, knapI(d, 'demasker', 'indsaet'));
  tjek('V-PUDS.3 N6: indsætter webvisningen selv (execCommand giver true), står der ingen besked', dsek.querySelector('.tom-bannere').textContent === '' && dsek.querySelector('.arbejde .besked').textContent === '');
  const sw = side({ platform: 'windows' });
  await vent(5);
  sw.d.execCommand = () => false;
  klik(sw.w, knapI(sw.d, 'masker', 'indsaet'));
  tjek('V-PUDS.3 N6: Windows: "Tryk Ctrl+V for at indsætte."', ord(sw.d.querySelector('section[data-visning="masker"] .tom-bannere')) === 'Tryk Ctrl+V for at indsætte.', sw.d.querySelector('section[data-visning="masker"] .tom-bannere').textContent);
})();

// ── N7: skjult tekst i en tabel trækker ikke siden med ──
await (async () => {
  const rust = falskOrdbogRust({ poster: [{ type: 'ord', vaerdi: 'Uglebo' }], indst: { guide_vist: true } });
  const s = side({ rust: { ...falskRust(), ...rust } });
  const { d, w } = s;
  await vent(20);
  indsaet(w, d.querySelector('section[data-visning="masker"] .tomt'), TEKST);
  s.tast('Enter', { metaKey: true }); await vent(10);
  const iTabel = [...d.querySelectorAll('table .skjult-tekst')].filter(e => cssVaerdi(e, 'position') === 'absolute');
  const udenForfader = e => { for (let a = e.parentElement; a; a = a.parentElement) { const p = cssVaerdi(a, 'position'); if (p && p !== 'static') return false; if (a.classList.contains('tabelvaert')) return true; } return true; };
  const uden = iTabel.filter(udenForfader);
  tjek('V-PUDS.3 N7: ingen absolut placeret skjult tekst i en tabel mangler en forfader med position (inden for tabellens rullefelt)', iTabel.length >= 10 && uden.length === 0, `${iTabel.length} i tabeller, ${uden.length} uden: ${uden.slice(0, 2).map(e => elNavn(e.parentElement)).join(', ')}`);
  tjek('V-PUDS.3 N7: rullefeltet (.tabelvaert) har position: relative, som kittets .tabel-rul', cssVaerdi(d.querySelector('section[data-visning="masker"] .tabelvaert'), 'position') === 'relative' && CSS_REGLER.some(r => r.sel === '.tabel-rul' && r.decl.position === 'relative'));
  // Gennemgang: alle skjulte tekster i Grimnirs visninger (alle fire, med indhold), også uden for tabeller.
  w.location.hash = 'ordbog'; await vent(10);
  w.location.hash = 'masker'; await vent(5);
  const alle = [...d.querySelectorAll('.skjult-tekst')].filter(e => cssVaerdi(e, 'position') === 'absolute');
  const udenNogen = alle.filter(e => { for (let a = e.parentElement; a; a = a.parentElement) { const p = cssVaerdi(a, 'position'); if (p && p !== 'static') return false; } return true; });
  tjek(`V-PUDS.3 N7: gennemgang: hver af de ${alle.length} skjulte tekster i Grimnir har en forfader med position`, alle.length >= 10 && udenNogen.length === 0, udenNogen.map(e => elNavn(e.parentElement)).join(', '));
})();

// ═════════════════════════════ V-MANUEL.1 ═════════════════════════════
// Maskér dette (N1), Fortryd og Gentag (N2), Ryd (N3), Næste advarsel (N4) og størrelser og linjetal (N5) med en
// efterlignet Rust (falskManuelRust), der finder de tilføjede værdier som kernen: alle steder ved en grænse (bogstaver og
// cifre er ikke grænser), uden hensyn til store/små bogstaver, ikke inde i adressen (overlap), og afviser "h0001" (en kode
// i sagen) og "aldrigord" (maskér aldrig). Kun opdigtede værdier. Ingen test læser den rigtige udklipsholder.
const MTEKST = 'login jdoe fra 10.20.30.11\nfejl: JDoe, jdoe2, xjdoe\nhost pc-17 og db1 og h0001\n';
function falskManuelRust() {
  const log = { analyser: [], gem: [] };
  const PRAEFIKS = { ord: 'ord', bruger: 'user', vaert: 'h', domaene: 'd', person: 'Person ', hemmelighed: 'GRIMNIR_SECRET_' };
  let poster = 0, koder = {};
  const graenseRe = v => new RegExp(`(?<![A-Za-z0-9])${v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![A-Za-z0-9])`, 'gi');
  const beregn = ({ tekst, fravalgt, rettelser, tilfoejede }) => {
    const ret = new Map((rettelser || []).map(r => [r.id, r.kode]));
    const ip = tekst.indexOf('10.20.30.11');
    const raa = [];
    if (ip >= 0) raa.push({ id: ip, art: 'ipv4_egen', status: 'sikker', standard: true, hemmelig: false, vaerdier: ['10.20.30.11'], koder: ['198.18.0.11'], antal: 1, linje: 1, laast: false, tilfoejet: null });
    const kode = tekst.indexOf('h0001');
    if (kode >= 0) raa.push({ id: kode, art: 'ligner_kode', status: 'sikker', standard: true, hemmelig: false, vaerdier: ['h0001'], koder: ['ord0099'], antal: 1, linje: 3, laast: true, tilfoejet: null });
    // V-OPBYG.4 N2: en genkendt hemmelighed (efter pwd=); en tilføjet værdi med samme tekst og en anden type afvises.
    const hem = tekst.indexOf('Fjeld-Ravn-77');
    if (hem >= 0) raa.push({ id: hem, art: 'hemmelighed', status: 'sikker', standard: true, hemmelig: true, vaerdier: ['Fjeld-Ravn-77'], koder: ['GRIMNIR_SECRET_0009'], antal: 1, linje: 4, laast: false, tilfoejet: null });
    const svar = (tilfoejede || []).map((t, nr) => {
      const v = t.vaerdi.trim();
      if (hem >= 0 && v === 'Fjeld-Ravn-77' && t.art !== 'hemmelighed') return { nr, raekke: hem, antal: 0, afvist: 'hemmelighed' };
      if (v === 'h0001') return { nr, raekke: null, antal: 0, afvist: 'kode' };
      if (v.toLowerCase() === 'aldrigord') return { nr, raekke: null, antal: 0, afvist: 'aldrig' };
      const steder = [...tekst.matchAll(graenseRe(v))].filter(m => !(ip >= 0 && m.index >= ip && m.index < ip + 11));
      if (!steder.length) return { nr, raekke: null, antal: 0, afvist: null };
      const stave = [...new Set(steder.map(m => m[0]))];
      raa.push({ id: steder[0].index, art: t.art, status: 'sikker', standard: true, hemmelig: t.art === 'hemmelighed', vaerdier: stave, koder: stave.map((_, j) => PRAEFIKS[t.art] + String(nr + 1).padStart(4, '0') + (j ? 'b' : '')), antal: steder.length, linje: tekst.slice(0, steder[0].index).split('\n').length, laast: false, tilfoejet: nr });
      return { nr, raekke: steder[0].index, antal: steder.length, afvist: null };
    });
    raa.sort((a, b) => a.id - b.id);
    const ider = new Set(raa.map(r => r.id));
    const fejl = [...ret.keys()].filter(id => !ider.has(id)).map(id => ({ id, fejl: 'ukendt_raekke', kode: ret.get(id) }));
    const raekker = raa.map(r => ({ ...r, kendt: false, rettet: ret.has(r.id), valgt: r.laast || (fravalgt == null ? r.standard : !fravalgt.includes(r.id)), koder: ret.has(r.id) ? r.koder.map(() => ret.get(r.id)) : r.koder }));
    return { raekker, fejl, tilfoejede: svar };
  };
  return {
    log,
    // V-OPBYG.4 N1: som Rust: en hemmelighed uden sin værdi i rækken; raekke_vaerdi giver den.
    analyser: a => { log.analyser.push(JSON.parse(JSON.stringify(a))); const b = beregn(a); log.sidste = b.raekker; return { raekker: b.raekker.map(r => (r.hemmelig ? { ...r, vaerdier: [] } : r)), fejl: b.fejl, advarsler: [], bytes: a.tekst.length, linjer: 4, tilfoejede: b.tilfoejede }; },
    raekke_vaerdi: ({ id }) => { const r = (log.sidste || []).find(x => x.id === id && x.hemmelig); if (!r) throw { art: 'ukendt_raekke' }; return { id, vaerdier: [...r.vaerdier] }; },
    gem_og_masker: a => {
      log.gem.push(JSON.parse(JSON.stringify(a)));
      const b = beregn(a);
      let m = a.tekst;
      koder = {};
      for (const r of b.raekker.filter(x => x.valgt)) r.vaerdier.forEach((v, i) => { m = m.split(v).join(r.koder[i]); koder[r.koder[i]] = v; });
      poster = Object.keys(koder).length;
      return { maskeret: m, rester: [], advarsler: [], poster };
    },
    demasker: a => {
      let t = a.tekst;
      for (const [k, o] of Object.entries(koder)) t = t.split(k).join(o);
      const adv = [{ art: 'ukendt_kode', kode: 'h0099', antal: 1, linje: 2 }, { art: 'overloeb_mac', kode: '', antal: 1, linje: 0 }, { art: 'anden_stavemaade', kode: 'USER0001', antal: 2, linje: 4 }, { art: 'ikke_brugt', kode: 'ord0001', antal: 1, linje: 0 }];
      return { tekst: t, linjer: 4, koder: Object.keys(koder), tilbage: [], advarsler: a.tekst.includes('ingen advarsler') ? adv.filter(x => x.art === 'ikke_brugt') : adv };
    },
    sag_status: () => ({ poster }),
    menu_sprog: () => null,
  };
}
const preM = d => d.querySelector('section[data-visning="masker"] pre.tekst');
/* Markerer [fra, til) i Maskérs tekstfelt (som musen gør) og melder selectionchange, som WebKit gør. */
function marker(w, d, fra, til) {
  const n = preM(d).firstChild;
  w.getSelection().setBaseAndExtent(n, fra, n, til);
  d.dispatchEvent(new w.Event('selectionchange'));
}
const markerOrd = (w, d, ord, n = 0) => { let i = -1; for (let k = 0; k <= n; k++) i = MTEKST.indexOf(ord, i + 1); marker(w, d, i, i + ord.length); };
const beskedM = d => d.querySelector('section[data-visning="masker"] .arbejde .besked');
const tilfRaekke = (d, v) => [...d.querySelectorAll('section[data-visning="masker"] .fundtabel tr.tilfoejet')].find(tr => tr.querySelector('.vaerdi .mono') && tr.querySelector('.vaerdi .mono').textContent.split(', ').some(x => x.toLowerCase() === v.toLowerCase()));
async function manuelSide(o = {}) {
  const rust = falskManuelRust();
  const s = side({ rust, ...o });
  const { d, w } = s;
  await vent(5);
  indsaet(w, d.querySelector('section[data-visning="masker"] .tomt'), MTEKST);
  s.tast('Enter', { metaKey: !o.platform || o.platform === 'macos', ctrlKey: o.platform === 'windows' });
  await vent(10);
  return { ...s, rust, GM: w.GrimnirMaskering };
}

// ── V-MANUEL.1 N1: Maskér dette fra båndet ──
await (async () => {
  const s = await manuelSide();
  const { d, w, GM, rust } = s;
  const b = knapI(d, 'masker', 'masker-dette');
  tjek('V-OPBYG.1: Maskér markering (før Maskér dette) står i båndets gruppe Rediger (sidst, efter Fortryd og Gentag)', b && b.textContent.trim() === 'Maskér markering' && b.closest('.grp').querySelector('.cap').textContent === 'Rediger' && b.closest('.kn').lastElementChild === plads(b));
  tjek('V-MANUEL.1 N1: uden markering er Maskér dette slået fra med en forklaring, der siger hvordan (mus, Skift + piletaster)', !kommandoAktiv(d, 'masker', 'masker-dette') && /^Markér en værdi i teksten først, med musen eller Skift \+ piletaster/.test(forklaring(b) || ''), forklaring(b));
  tjek('V-MANUEL.1 N1: hjælpeteksten siger grænsereglen (et helt ord; bogstav eller ciffer før eller efter = længere ord)', /som et helt ord/.test(forklaring(b)) && /et bogstav eller et ciffer lige før eller efter gør den til en del af et længere ord/.test(forklaring(b)));
  markerOrd(w, d, 'jdoe');
  tjek('V-MANUEL.1 N1: med en markering i teksten er Maskér dette slået til, med genvejen ⇧⌘M', kommandoAktiv(d, 'masker', 'masker-dette') && b.getAttribute('title') === 'Genvej: ⇧⌘M' && b.getAttribute('aria-keyshortcuts') === 'Meta+Shift+M', b.getAttribute('title'));
  const md = new w.MouseEvent('mousedown', { bubbles: true, cancelable: true });
  b.dispatchEvent(md);
  tjek('V-MANUEL.1 N1: musetrykket på båndets knap tager ikke markeringen eller fokus fra teksten (mousedown stoppes)', md.defaultPrevented && GM.M.markering() === 'jdoe');
  const foer = rust.log.analyser.length;
  b.click();
  await vent(10);
  const sidst = rust.log.analyser[rust.log.analyser.length - 1];
  tjek('V-MANUEL.1 N1: værdien sendes til Rust med analysen (tilfoejede, type Ord som standard)', rust.log.analyser.length === foer + 1 && JSON.stringify(sidst.tilfoejede) === '[{"vaerdi":"jdoe","art":"ord"}]', JSON.stringify(sidst && sidst.tilfoejede));
  const tr = tilfRaekke(d, 'jdoe');
  tjek('V-MANUEL.1 N1: en ny række med alle forekomster (jdoe og JDoe: 2; ikke jdoe2 og xjdoe)', tr && tr.querySelectorAll('td')[4].textContent === '2' && tr.querySelector('.vaerdi .mono').textContent === 'jdoe, JDoe');
  tjek('V-OPBYG.1: rækken er markeret som tilføjet med ord ("Tilføjet" dæmpet ved typen; status er resultatet: Maskeres med symbol)', tr && tr.querySelector('.typecelle .sikkerhed').textContent === 'Tilføjet' && tr.querySelector('.chip').textContent === '✓Maskeres' && tr.querySelector('.chip [aria-hidden]'));
  tjek('V-MANUEL.1 N1: rækken er afkrydset og har en erstatning (som de andre)', tr && tr.querySelector('[data-felt="valg"]').checked && tr.querySelector('[data-felt="kode"]').value.startsWith('ord0001'));
  const sel = tr && tr.querySelector('select[data-felt="type"]');
  tjek('V-MANUEL.1 N1: typen er en valgliste med Ord, Bruger, Maskine, Domæne og Person (kernens typer), Ord valgt', sel && [...sel.options].map(o => o.textContent).join() === 'Ord,Bruger,Maskine,Domæne,Person' && sel.value === 'ord' && sel.getAttribute('aria-label') === 'Type for jdoe');
  tjek('V-MANUEL.1 N1: Ordbog-cellen har Altid og Fjern (ikke Aldrig) for en tilføjet række', tr && tr.querySelector('[data-felt="ordbog-altid"]') && tr.querySelector('[data-felt="fjern"]') && !tr.querySelector('[data-felt="ordbog-aldrig"]') && tr.querySelector('[data-felt="fjern"]').getAttribute('aria-label') === 'Fjern jdoe fra fundene');
  tjek('V-MANUEL.1 N1: meldingen er høflig (role="status") og siger værdien og antallet', beskedM(d).getAttribute('role') === 'status' && beskedM(d).textContent === 'Tilføjet: jdoe (2 steder).', beskedM(d).textContent);
  tjek('V-MANUEL.1 N1: den nye række er valgt i tabellen (kittets valg), og fokus bliver i teksten', tr && tr.getAttribute('aria-selected') === 'true' && tr.classList.contains('sel'));
  tjek('V-MANUEL.1 N1: de andre rækker er ikke tilføjede', [...d.querySelectorAll('section[data-visning="masker"] .fundtabel tbody tr')].filter(x => x.classList.contains('tilfoejet')).length === 1);
  // Typen: erstatningens form skifter
  sel.value = 'bruger';
  sel.dispatchEvent(new w.Event('change', { bubbles: true }));
  await vent(10);
  const tr2 = tilfRaekke(d, 'jdoe');
  tjek('V-MANUEL.1 N1: skift typen til Bruger: Rust får typen, og erstatningen får formen user0001', JSON.stringify(rust.log.analyser[rust.log.analyser.length - 1].tilfoejede) === '[{"vaerdi":"jdoe","art":"bruger"}]' && tr2.querySelector('[data-felt="kode"]').value.startsWith('user0001') && tr2.querySelector('select').value === 'bruger');
  // En rettet erstatning bliver ved et typeskift
  const k = tr2.querySelector('[data-felt="kode"]');
  k.value = 'konto-a';
  k.dispatchEvent(new w.Event('change', { bubbles: true }));
  await vent(400);
  const s3 = tilfRaekke(d, 'jdoe').querySelector('select');
  s3.value = 'vaert';
  s3.dispatchEvent(new w.Event('change', { bubbles: true }));
  await vent(10);
  tjek('V-MANUEL.1 N1: en erstatning, brugeren selv har rettet, bliver ved et typeskift', tilfRaekke(d, 'jdoe').querySelector('[data-felt="kode"]').value === 'konto-a' && GM.M.st.tilfoejede[0].art === 'vaert');
  // Analysér igen beholder de tilføjede
  knapI(d, 'masker', 'analyser').click();
  await vent(10);
  tjek('V-MANUEL.1 N1: Analysér igen beholder de tilføjede værdier', JSON.stringify(rust.log.analyser[rust.log.analyser.length - 1].tilfoejede) === '[{"vaerdi":"jdoe","art":"vaert"}]' && tilfRaekke(d, 'jdoe'));
  // Fjern
  const fj = tilfRaekke(d, 'jdoe').querySelector('[data-felt="fjern"]');
  fj.click();
  await vent(10);
  tjek('V-MANUEL.1 N1: Fjern fjerner rækken (ikke kun fravalg): Rust får den ikke længere, rettelsen er væk, fokus i teksten', !tilfRaekke(d, 'jdoe') && GM.M.st.tilfoejede.length === 0 && JSON.stringify(rust.log.analyser[rust.log.analyser.length - 1].tilfoejede) === '[]' && GM.M.st.rettelser.size === 0 && d.activeElement === preM(d));
  tjek('V-MANUEL.1 N1: … og siger det', beskedM(d).textContent === 'Fjernet: jdoe.', beskedM(d).textContent);
})();

// ── V-MANUEL.1 N1: genvejsmenu, genvej og tastatur ──
await (async () => {
  const s = await manuelSide();
  const { d, w, GM, rust } = s;
  const pre = preM(d), menu = d.querySelector('section[data-visning="masker"] .tekstpanel .genvejsmenu');
  const uden = new w.MouseEvent('contextmenu', { bubbles: true, cancelable: true });
  w.getSelection().removeAllRanges();
  pre.dispatchEvent(uden);
  tjek('V-MANUEL.1 N1: højreklik uden markering: webvisningens egen menu (ikke stoppet), Grimnirs er skjult', !uden.defaultPrevented && menu.hidden);
  markerOrd(w, d, 'db1');
  const med = new w.MouseEvent('contextmenu', { bubbles: true, cancelable: true });
  pre.dispatchEvent(med);
  const punkter = [...menu.querySelectorAll('[role="menuitem"]')];
  tjek('V-OPBYG.4 N2: højreklik på markeringen: Grimnirs genvejsmenu med Maskér markering (⇧⌘M), Maskér som hemmelighed og Kopiér, fokus på Maskér markering', med.defaultPrevented && !menu.hidden && menu.getAttribute('role') === 'menu' && menu.getAttribute('aria-label') === 'Handlinger for markeringen' && punkter.map(p => p.textContent).join('|') === 'Maskér markering⇧⌘M|Maskér som hemmelighed|Kopiér⌘C' && d.activeElement === punkter[0], punkter.map(p => p.textContent).join('|'));
  menu.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
  const ned = d.activeElement === punkter[1];
  menu.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
  const ned2 = d.activeElement === punkter[2];
  menu.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
  tjek('V-OPBYG.4 N2: genvejsmenuen: piletasterne flytter gennem de tre punkter (og går rundt)', ned && ned2 && d.activeElement === punkter[0]);
  menu.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  tjek('V-MANUEL.1 N1: genvejsmenuen: Esc lukker, og fokus går tilbage til teksten (markeringen står)', menu.hidden && d.activeElement === pre && GM.M.markering() === 'db1', `${menu.hidden} ${d.activeElement && d.activeElement.tagName} «${GM.M.markering()}»`);
  pre.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'F10', shiftKey: true, bubbles: true, cancelable: true }));
  tjek('V-MANUEL.1 N1: Skift+F10 i teksten åbner genvejsmenuen fra tastaturet', !menu.hidden && d.activeElement === punkter[0], `${menu.hidden} ${GM.M.kanMarkere()}`);
  d.body.dispatchEvent(new w.MouseEvent('mousedown', { bubbles: true }));
  tjek('V-MANUEL.1 N1: et klik uden for genvejsmenuen lukker den', menu.hidden);
  markerOrd(w, d, 'db1');
  pre.dispatchEvent(new w.MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
  punkter[0].click();
  await vent(10);
  tjek('V-MANUEL.1 N1: Maskér dette fra genvejsmenuen tilføjer værdien og lukker menuen', menu.hidden && tilfRaekke(d, 'db1') && JSON.stringify(rust.log.analyser[rust.log.analyser.length - 1].tilfoejede) === '[{"vaerdi":"db1","art":"ord"}]');
  // Tastaturet: markér pc-17 med Skift + piletaster og brug genvejen ⇧⌘M
  pre.focus();
  const i = MTEKST.indexOf('pc-17');
  w.getSelection().setBaseAndExtent(pre.firstChild, i, pre.firstChild, i);
  for (let n = 0; n < 5; n++) pre.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'ArrowRight', shiftKey: true, bubbles: true, cancelable: true }));
  tjek('V-MANUEL.1 N1: Skift + højre pil markerer tegn for tegn i tekstfeltet (fra der, hvor der er klikket)', GM.M.markering() === 'pc-17' && kommandoAktiv(d, 'masker', 'masker-dette'), GM.M.markering());
  s.tast('M', { metaKey: true, shiftKey: true, code: 'KeyM' });
  await vent(10);
  tjek('V-MANUEL.1 N1: ⇧⌘M tilføjer markeringen (uden mus)', tilfRaekke(d, 'pc-17') && GM.M.st.tilfoejede.map(x => x.vaerdi).join() === 'db1,pc-17');
  w.getSelection().setBaseAndExtent(pre.firstChild, 0, pre.firstChild, 0);
  pre.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'ArrowRight', shiftKey: true, altKey: true, bubbles: true, cancelable: true }));
  tjek('V-MANUEL.1 N1: ⌥ + Skift + højre pil markerer et ord ad gangen', GM.M.markering() === 'login', GM.M.markering());
  const F = GM.M.flyt, T = 'ab cd\r\nef\n😀x';
  tjek('V-MANUEL.1 N1: markeringens trin: tegn, ord, linjens start og slut, op og ned med samme kolonne (CRLF og LF), et tegn uden for BMP er ét tegn (og op/ned lander ikke midt i det)',
    F(T, 0, 'ArrowRight', false) === 1 && F(T, 0, 'ArrowRight', true) === 2 && F(T, 2, 'ArrowRight', true) === 5 && F(T, 5, 'ArrowLeft', true) === 3 && F(T, 4, 'Home') === 0 && F(T, 1, 'End') === 5 && F(T, 1, 'ArrowDown') === 8 && F(T, 8, 'ArrowUp') === 1 && F(T, 8, 'ArrowDown') === 10 && F(T, 10, 'ArrowRight') === 12 && F(T, 12, 'ArrowLeft') === 10 && F(T, 0, 'ArrowUp') === 0 && F(T, 13, 'ArrowDown') === 13);
  // Tab fra teksten til båndets knap: fokus på en knap rydder markeringen (målt i WKWebView; jsdom gør det samme)
  markerOrd(w, d, 'fejl');
  const bk = knapI(d, 'masker', 'masker-dette');
  bk.focus();
  d.dispatchEvent(new w.Event('selectionchange'));
  const ryddet = w.getSelection().toString() === '';
  tjek('V-MANUEL.1 N1: Tab til båndets Maskér dette (markeringen ryddes af fokus): den seneste markering i teksten huskes, og knappen er slået til', ryddet && kommandoAktiv(d, 'masker', 'masker-dette') && GM.M.markering() === 'fejl');
  bk.click(); await vent(10);
  tjek('V-MANUEL.1 N1: … Enter/klik tilføjer den huskede værdi og lægger markeringen tilbage i teksten', tilfRaekke(d, 'fejl') && w.getSelection().toString() === 'fejl');
  const p0 = MTEKST.indexOf('host');
  w.getSelection().setBaseAndExtent(pre.firstChild, p0, pre.firstChild, p0);
  d.dispatchEvent(new w.Event('selectionchange'));
  tjek('V-MANUEL.1 N1: et klik i teksten (en tom markering i den) glemmer den huskede markering: Maskér dette er slået fra', !kommandoAktiv(d, 'masker', 'masker-dette') && GM.M.markering() === '');
  bk.focus();
  w.getSelection().removeAllRanges();
  d.dispatchEvent(new w.Event('selectionchange'));
  tjek('V-MANUEL.1 N1: … også når fokus derefter går til båndets knap (den gamle markering kommer ikke igen)', !kommandoAktiv(d, 'masker', 'masker-dette') && GM.M.markering() === '');
  const u = new w.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true });
  pre.dispatchEvent(u);
  tjek('V-MANUEL.1 N1: uden Skift ruller piletasterne som før (stoppes ikke)', !u.defaultPrevented);
  tjek('V-MANUEL.1 N1: genvejen ⇧⌘M er ikke brugt andre steder (menuen, ⌘1–⌘4, ⌘↵, ⇧⌘C, ⌘O, ⌘S, ⌘, ⌘Q, ⌘+/−/0, ⌘Z, ⇧⌘Z, ⌘G)', (() => {
    const kilde = ui('assets/maskering.js') + ui('assets/app.js') + fs.readFileSync(path.join(repo, 'src-tauri', 'src', 'programmenu.rs'), 'utf8');
    return !/CmdOrCtrl\+Shift\+M|CmdOrCtrl\+M"|CmdOrCtrl\+G"/.test(kilde) && (kilde.match(/'KeyM'/g) || []).length === 1 && (kilde.match(/'KeyG'/g) || []).length === 1;
  })());
})();

// ── V-MANUEL.1 N1: reglerne ──
await (async () => {
  const s = await manuelSide();
  const { d, w, GM, rust } = s;
  const pre = preM(d);
  const maskerDette = async () => { knapI(d, 'masker', 'masker-dette').click(); await vent(10); };
  const n0 = rust.log.analyser.length;
  marker(w, d, MTEKST.indexOf(' fra'), MTEKST.indexOf(' fra') + 1);
  await maskerDette();
  tjek('V-MANUEL.1 N1: kun mellemrum afvises med en forklaring (ingen analyse, intet tilføjet)', beskedM(d).textContent === 'Markeringen er tom eller kun mellemrum.' && rust.log.analyser.length === n0 && GM.M.st.tilfoejede.length === 0, beskedM(d).textContent);
  marker(w, d, MTEKST.indexOf('11\nfejl'), MTEKST.indexOf('11\nfejl') + 7);
  await maskerDette();
  tjek('V-MANUEL.1 N1: en markering over flere linjer afvises med en forklaring', beskedM(d).textContent === 'Markeringen går over flere linjer. Markér en værdi på én linje.' && GM.M.st.tilfoejede.length === 0);
  marker(w, d, MTEKST.indexOf(' jdoe ') , MTEKST.indexOf(' jdoe ') + 6);
  await maskerDette();
  tjek('V-MANUEL.1 N1: mellemrum i enderne skæres af (" jdoe " → jdoe)', GM.M.st.tilfoejede.map(x => x.vaerdi).join() === 'jdoe' && tilfRaekke(d, 'jdoe'));
  markerOrd(w, d, 'JDoe');
  await maskerDette();
  tjek('V-MANUEL.1 N1: en værdi, der allerede er tilføjet (også med andre store/små bogstaver), vælger dens række i stedet for en ny', GM.M.st.tilfoejede.length === 1 && beskedM(d).textContent === 'JDoe er allerede tilføjet; rækken er valgt.' && tilfRaekke(d, 'jdoe').getAttribute('aria-selected') === 'true', beskedM(d).textContent);
  // Et eksisterende fund: rækken vælges (og slås til, hvis den var fravalgt) i stedet for en ny
  const ipTr = raekkeMed(d, MTEKST.indexOf('10.20.30.11'));
  ipTr.querySelector('[data-felt="valg"]').click();
  await vent(400);
  const trin = GM.M.hist.bag.length;
  markerOrd(w, d, '10.20.30.11');
  await maskerDette();
  tjek('V-MANUEL.1 N1: en værdi, der præcis er et eksisterende fund, vælger den række (og slår den til) i stedet for en ny', GM.M.st.tilfoejede.length === 1 && raekkeMed(d, MTEKST.indexOf('10.20.30.11')).getAttribute('aria-selected') === 'true' && raekkeMed(d, MTEKST.indexOf('10.20.30.11')).querySelector('[data-felt="valg"]').checked && GM.M.hist.bag.length === trin + 1 && beskedM(d).textContent === '10.20.30.11 er allerede et fund; rækken er valgt.', `${raekkeMed(d, MTEKST.indexOf('10.20.30.11')).getAttribute('aria-selected')} ${GM.M.hist.bag.length - trin} ${beskedM(d).textContent}`);
  markerOrd(w, d, 'h0001');
  await maskerDette();
  tjek('V-MANUEL.1 N1: en af sagens koder (en låst række) afvises (som Ret gør)', GM.M.st.tilfoejede.length === 1 && beskedM(d).textContent === 'h0001 er allerede en kode i sagen og kan ikke maskeres igen.', beskedM(d).textContent);
  // Delvist overlap (inde i adressen) → 0 steder: rækken advarer
  markerOrd(w, d, '20.30');
  await maskerDette();
  const nul = tilfRaekke(d, '20.30');
  tjek('V-MANUEL.1 N1: en værdi, der kun står inde i et længere fund, tilføjes med 0 steder og en advarsel i rækken', nul?.querySelectorAll('td')[4]?.textContent === '0' && Boolean(nul?.querySelector('.raekkeadv')?.textContent.startsWith('Står ikke som et helt ord i teksten')) && nul?.querySelector('[data-felt="valg"]')?.disabled && nul?.querySelectorAll('td')[3]?.textContent === '—', nul && nul.textContent);
  tjek('V-MANUEL.1 N1: … og meldingen siger det', beskedM(d).textContent === 'Tilføjet: 20.30, men den står ikke som et helt ord i teksten.', beskedM(d).textContent);
  tjek('V-MANUEL.1 N1: … rækken har stadig typen, Altid og Fjern', Boolean(nul?.querySelector('select[data-felt="type"]') && nul?.querySelector('[data-felt="fjern"]') && nul?.querySelector('[data-felt="ordbog-altid"]')));
  // Et kort ord advarer om antallet
  markerOrd(w, d, 'og');
  await maskerDette();
  const kort = tilfRaekke(d, 'og');
  tjek('V-MANUEL.1 N1: et kort ord (under 3 tegn) tilføjes, men rækken advarer om antallet af steder', kort?.querySelector('.raekkeadv')?.textContent === 'Kort værdi: står 2 steder. Tjek, at det er de rigtige.', kort && kort.textContent);
  // Rust afviser: en kode i sagen, der ikke står som en række, og maskér aldrig
  const foerTrin = GM.M.hist.bag.length;
  GM.M.st.tilfoejede.push({ vaerdi: 'aldrigord', art: 'ord' });
  GM.M.st.meld = { v: 'aldrigord' };
  await GM.M.analyser();
  await vent(10);
  tjek('V-MANUEL.1 N1: en værdi på "maskér aldrig" afvises af Rust med grunden og fjernes igen', !GM.M.st.tilfoejede.some(x => x.vaerdi === 'aldrigord') && beskedM(d).textContent === 'aldrigord står på Maskér aldrig i ordbogen, og det vinder over alt. Fjern den dér først.' && GM.M.hist.bag.length === foerTrin, beskedM(d).textContent);
  // Før og efter med resultatet vist: Maskér dette er slået fra
  GM.M.st.foerEfter = true; GM.M.st.resultat = { maskeret: 'x', rester: [], advarsler: [] };
  tjek('V-MANUEL.1 N1: med det maskerede resultat vist er Maskér dette slået fra (vis den indsatte tekst)', GM.M.kanMarkere() === 'hvorforVisTeksten');
  GM.M.st.foerEfter = false; GM.M.st.resultat = null;
  GM.M.st.fil = { navn: 'x' };
  w.getSelection().collapse(pre.firstChild, 0);
  tjek('V-OPBYG.6 N1: i en åben fil er Maskér markering ikke længere kun for indsat tekst; uden markering forklarer den det viste uddrag og hele filen', GM.M.kanMarkere() === 'hvorforMarkerFil');
  GM.M.st.fil = null;
  // Gem og maskér sender de tilføjede, og en ny tekst fjerner dem
  s.tast('Enter', { metaKey: true }); await vent(10);
  tjek('V-MANUEL.1 N1: Gem og maskér sender de tilføjede værdier til Rust (de lægges i sagen)', rust.log.gem.length === 1 && rust.log.gem[0].tilfoejede.map(x => x.vaerdi).join() === 'jdoe,20.30,og');
  indsaet(w, pre, 'ny tekst om jdoe\n');
  await vent(5);
  tjek('V-MANUEL.1 N1: en ny indsat tekst fjerner de tilføjede værdier (og historikken)', GM.M.st.tilfoejede.length === 0 && GM.M.hist.bag.length === 0);
})();

// ── V-MANUEL.1 N2: Fortryd og Gentag ──
await (async () => {
  const s = await manuelSide();
  const { d, w, GM, rust } = s;
  const pre = preM(d);
  const fb = knapI(d, 'masker', 'fortryd'), gb = knapI(d, 'masker', 'gentag');
  tjek('V-MANUEL.1 N2: Fortryd og Gentag står i båndets gruppe Rediger', fb.closest('.grp').querySelector('.cap').textContent === 'Rediger' && gb.closest('.grp') === fb.closest('.grp'));
  tjek('V-MANUEL.1 N2: uden noget at fortryde er de slået fra; forklaringen siger, at Gem og maskér tømmer historikken', !kommandoAktiv(d, 'masker', 'fortryd') && forklaring(fb) === 'Intet at fortryde. Historikken tømmes ved Maskér, en ny tekst og Ryd' && !kommandoAktiv(d, 'masker', 'gentag') && /ved Maskér,/.test(forklaring(gb)), forklaring(fb));
  const ip = MTEKST.indexOf('10.20.30.11');
  // 1. afkrydsning, 2. Maskér dette, 3. type, 4. erstatning, 5. Fjern
  raekkeMed(d, ip).querySelector('[data-felt="valg"]').click(); await vent(400);
  markerOrd(w, d, 'jdoe'); knapI(d, 'masker', 'masker-dette').click(); await vent(10);
  const sel = tilfRaekke(d, 'jdoe').querySelector('select'); sel.value = 'person'; sel.dispatchEvent(new w.Event('change', { bubbles: true })); await vent(10);
  const k = tilfRaekke(d, 'jdoe').querySelector('[data-felt="kode"]'); k.value = 'anna-k'; k.dispatchEvent(new w.Event('change', { bubbles: true })); await vent(400);
  markerOrd(w, d, 'db1'); knapI(d, 'masker', 'masker-dette').click(); await vent(10);
  tilfRaekke(d, 'db1').querySelector('[data-felt="fjern"]').click(); await vent(10);
  tjek('V-MANUEL.1 N2: hver handling er ét trin (afkrydsning, Maskér dette ×2, type, erstatning, Fjern)', GM.M.hist.bag.map(x => x.art).join() === 'valg,tilfoej,type,kode,tilfoej,fjern', GM.M.hist.bag.map(x => x.art).join());
  tjek('V-MANUEL.1 N2: Fortryd er slået til med genvejen ⌘Z, Gentag er stadig slået fra', kommandoAktiv(d, 'masker', 'fortryd') && fb.getAttribute('title') === 'Genvej: ⌘Z' && !kommandoAktiv(d, 'masker', 'gentag'));
  const meldt = [];
  const tilbage = [];
  for (let n = 0; n < 6; n++) {
    d.body.focus();
    s.tast('z', { metaKey: true, code: 'KeyZ' });
    await vent(10);
    meldt.push(beskedM(d).textContent);
    tilbage.push(JSON.stringify(rust.log.analyser[rust.log.analyser.length - 1].tilfoejede));
  }
  tjek('V-MANUEL.1 N2: ⌘Z fortryder trin for trin og melder hvert (fodlinjens besked, role="status")', meldt.join(' | ') === 'Fortrudt: Fjern for db1 | Fortrudt: Maskér markering for db1 | Fortrudt: erstatning for jdoe | Fortrudt: type for jdoe | Fortrudt: Maskér markering for jdoe | Fortrudt: afkrydsning for 10.20.30.11', meldt.join(' | '));
  tjek('V-MANUEL.1 N2: … og Rust får valgene, som de var (tilføjede værdier og typer)', tilbage.join(' | ') === '[{"vaerdi":"jdoe","art":"person"},{"vaerdi":"db1","art":"ord"}] | [{"vaerdi":"jdoe","art":"person"}] | [{"vaerdi":"jdoe","art":"person"}] | [{"vaerdi":"jdoe","art":"ord"}] | [] | []', tilbage.join(' | '));
  tjek('V-MANUEL.1 N2: efter alle trin er valgene som før (afkrydset, ingen rettelser, intet tilføjet), og Fortryd er slået fra', raekkeMed(d, ip).querySelector('[data-felt="valg"]').checked && GM.M.st.rettelser.size === 0 && GM.M.st.tilfoejede.length === 0 && !kommandoAktiv(d, 'masker', 'fortryd') && kommandoAktiv(d, 'masker', 'gentag') && gb.getAttribute('title') === 'Genvej: ⇧⌘Z');
  for (let n = 0; n < 4; n++) { s.tast('Z', { metaKey: true, shiftKey: true, code: 'KeyZ' }); await vent(10); }
  tjek('V-MANUEL.1 N2: ⇧⌘Z gentager (fire trin: afkrydsning, Maskér dette, type, erstatning)', beskedM(d).textContent === 'Gentaget: erstatning for jdoe' && !raekkeMed(d, ip).querySelector('[data-felt="valg"]').checked && tilfRaekke(d, 'jdoe').querySelector('select').value === 'person' && tilfRaekke(d, 'jdoe').querySelector('[data-felt="kode"]').value === 'anna-k', beskedM(d).textContent);
  gb.click(); await vent(10);
  fb.click(); await vent(10);
  tjek('V-MANUEL.1 N2: båndets Gentag og Fortryd gør det samme', beskedM(d).textContent === 'Fortrudt: Maskér markering for db1' && GM.M.st.tilfoejede.map(x => x.vaerdi).join() === 'jdoe');
  // En ny handling efter Fortryd tømmer Gentag
  raekkeMed(d, ip).querySelector('[data-felt="valg"]').click(); await vent(400);
  tjek('V-MANUEL.1 N2: en ny handling efter Fortryd tømmer Gentag', GM.M.hist.frem.length === 0 && !kommandoAktiv(d, 'masker', 'gentag'));
  // I et tekstfelt: browserens egen fortryd
  const kode = tilfRaekke(d, 'jdoe').querySelector('[data-felt="kode"]');
  kode.focus();
  const tr0 = GM.M.hist.bag.length;
  const ev = new w.KeyboardEvent('keydown', { key: 'z', code: 'KeyZ', metaKey: true, bubbles: true, cancelable: true });
  kode.dispatchEvent(ev);
  await vent(10);
  tjek('V-MANUEL.1 N2: ⌘Z med fokus i et tekstfelt (Erstatning) er feltets egen fortryd: ikke stoppet, Grimnirs historik urørt', !ev.defaultPrevented && GM.M.hist.bag.length === tr0);
  const kaldt = [];
  d.execCommand = c => { kaldt.push(c); return true; };
  s.emit('menu', 'fortryd');
  s.emit('menu', 'gentag');
  await vent(10);
  tjek('V-MANUEL.1 N2: menuen Rediger → Fortryd/Gentag med fokus i et felt: webvisningens undo/redo i feltet (execCommand), historikken urørt', kaldt.join() === 'undo,redo' && GM.M.hist.bag.length === tr0, kaldt.join());
  d.body.focus();
  kode.blur();
  s.emit('menu', 'fortryd');
  await vent(10);
  tjek('V-MANUEL.1 N2: menuen Rediger → Fortryd uden fokus i et felt: Grimnirs Fortryd', GM.M.hist.bag.length === tr0 - 1 && beskedM(d).textContent === 'Fortrudt: afkrydsning for 10.20.30.11' && kaldt.length === 2, beskedM(d).textContent);
  // Tastetrykket og menuen sammen (hvis WebKit også lod menuen slå til): kun ét trin
  const tr1 = GM.M.hist.bag.length;
  s.tast('z', { metaKey: true, code: 'KeyZ' });
  s.emit('menu', 'fortryd');
  await vent(10);
  tjek('V-MANUEL.1 N2: ⌘Z og menuens hændelse lige efter fortryder kun ét trin', GM.M.hist.bag.length === tr1 - 1);
  // Mindst 50 trin; højst 100 huskes
  for (let n = 0; n < 60; n++) raekkeMed(d, ip).querySelector('[data-felt="valg"]').click();
  await vent(400);
  let fortrudt = 0;
  for (let n = 0; n < 55; n++) if (GM.M.fortryd()) fortrudt++;
  tjek('V-MANUEL.1 N2: mindst 50 trin kan fortrydes (60 afkrydsninger, 55 fortrudt)', fortrudt === 55 && GM.M.hist.bag.length >= 5);
  for (let n = 0; n < 130; n++) raekkeMed(d, ip).querySelector('[data-felt="valg"]').click();
  await vent(400);
  tjek('V-MANUEL.1 N2: historikken husker højst 100 trin', GM.M.hist.bag.length === 100);
  // Gem og maskér tømmer historikken
  s.tast('Enter', { metaKey: true }); await vent(10);
  tjek('V-MANUEL.1 N2: Gem og maskér tømmer historikken; Fortryd er slået fra og forklaringen siger hvorfor', GM.M.st.resultat && GM.M.hist.bag.length === 0 && GM.M.hist.frem.length === 0 && !kommandoAktiv(d, 'masker', 'fortryd') && /ved Maskér,/.test(forklaring(fb)));
  const efter = new w.KeyboardEvent('keydown', { key: 'z', code: 'KeyZ', metaKey: true, bubbles: true, cancelable: true });
  d.dispatchEvent(efter);
  tjek('V-MANUEL.1 N2: ⌘Z efter Gem og maskér fortryder intet (sagen er gemt)', GM.M.st.resultat && GM.M.hist.bag.length === 0);
  // Ikke i Demaskér, Sager eller Ordbog
  w.location.hash = 'ordbog'; await vent(5);
  const ord = new w.KeyboardEvent('keydown', { key: 'z', code: 'KeyZ', metaKey: true, bubbles: true, cancelable: true });
  d.dispatchEvent(ord);
  tjek('V-MANUEL.1 N2: ⌘Z i Ordbog bruges ikke af Grimnir (ikke stoppet)', !ord.defaultPrevented);
  // Altid/Aldrig (ordbogen på disk) er ikke et trin
  const m = ui('assets/maskering.js');
  const tilOrdbog = m.slice(m.indexOf('function tilOrdbog('), m.indexOf('/* ═════ V-MANUEL.1 N1: Maskér dette'));
  tjek('V-MANUEL.1 N2: Altid og Aldrig er ikke trin i historikken (de skriver i ordbogen på disk)', tilOrdbog.length > 100 && !/husk\(/.test(tilOrdbog));
})();
await (async () => {
  // Windows: Ctrl+Z og Ctrl+Y (og Ctrl+Shift+Z)
  const s = await manuelSide({ platform: 'windows' });
  const { d, w, GM } = s;
  const ip = MTEKST.indexOf('10.20.30.11');
  raekkeMed(d, ip).querySelector('[data-felt="valg"]').click(); await vent(400);
  raekkeMed(d, ip).querySelector('[data-felt="valg"]').click(); await vent(400);
  s.tast('z', { ctrlKey: true, code: 'KeyZ' }); await vent(10);
  const a = !raekkeMed(d, ip).querySelector('[data-felt="valg"]').checked;
  s.tast('y', { ctrlKey: true, code: 'KeyY' }); await vent(10);
  const b = raekkeMed(d, ip).querySelector('[data-felt="valg"]').checked;
  s.tast('z', { ctrlKey: true, code: 'KeyZ' }); await vent(10);
  s.tast('Z', { ctrlKey: true, shiftKey: true, code: 'KeyZ' }); await vent(10);
  tjek('V-MANUEL.1 N2: Windows: Ctrl+Z fortryder, Ctrl+Y og Ctrl+Shift+Z gentager; titlerne siger Ctrl+Z og Ctrl+Y', a && b && raekkeMed(d, ip).querySelector('[data-felt="valg"]').checked && knapI(d, 'masker', 'fortryd').getAttribute('title') === 'Genvej: Ctrl+Z' && (() => { GM.M.fortryd(); GM.M.tegn(); return knapI(d, 'masker', 'gentag').getAttribute('title') === 'Genvej: Ctrl+Y'; })());
})();

// ── V-MANUEL.1 N3: Ryd ──
await (async () => {
  const s = await manuelSide();
  const { d, w, GM, kald } = s;
  const sek = d.querySelector('section[data-visning="masker"]');
  const rb = knapI(d, 'masker', 'ryd');
  tjek('V-MANUEL.1 N3: Ryd står i båndets gruppe Tekst og er slået til med en tekst', rb.closest('.grp').querySelector('.cap').textContent === 'Tekst' && kommandoAktiv(d, 'masker', 'ryd'));
  const sagFoer = kald.filter(k => /^sag_/.test(k[0]) && k[0] !== 'sag_status').length;
  rb.click(); await vent(10);
  tjek('V-MANUEL.1 N3: uden valg og uden resultat rydder Ryd straks (ingen bekræftelse): tom flade, fokus på den', !d.querySelector('dialog[open]') && GM.M.st.tekst === null && GM.M.st.analyse === null && !sek.querySelector('.tomt').hidden && sek.querySelector('.arbejde').hidden && d.activeElement === sek.querySelector('.tomt'));
  tjek('V-MANUEL.1 N3: uden tekst er Ryd slået fra med en forklaring; sagen er ikke rørt', !kommandoAktiv(d, 'masker', 'ryd') && forklaring(rb) === 'Indsæt en tekst først' && kald.filter(k => /^sag_/.test(k[0]) && k[0] !== 'sag_status').length === sagFoer);
  // Med valg: bekræftelse med fokus på Annullér
  indsaet(w, sek.querySelector('.tomt'), MTEKST);
  s.tast('Enter', { metaKey: true }); await vent(10);
  markerOrd(w, d, 'jdoe'); knapI(d, 'masker', 'masker-dette').click(); await vent(10);
  rb.click(); await vent(5);
  const dlg = d.querySelector('dialog[open]');
  tjek('V-MANUEL.1 N3: med valg spørger Ryd først (kittets bekræftelse, fokus på Annullér, Ryd kan ikke fortrydes)', dlg && dlg.id === 'dlg-ryd' && dlg.querySelector('h2').textContent === 'Ryd teksten?' && /Ryd kan ikke fortrydes\.$/.test(dlg.querySelector('p').textContent) && /tilføjede værdier/.test(dlg.querySelector('p').textContent) && d.activeElement && d.activeElement.textContent === 'Annullér', dlg && dlg.textContent);
  [...dlg.querySelectorAll('button')].find(x => x.textContent === 'Annullér').click(); await vent(5);
  tjek('V-MANUEL.1 N3: Annullér: intet er ryddet', GM.M.st.tekst === MTEKST && GM.M.st.tilfoejede.length === 1);
  rb.click(); await vent(5);
  [...d.querySelector('dialog[open]').querySelectorAll('button')].find(x => x.textContent === 'Ryd').click(); await vent(10);
  tjek('V-MANUEL.1 N3: Ryd: teksten, fundene, de tilføjede værdier, historikken og resultatet er væk', GM.M.st.tekst === null && GM.M.st.tilfoejede.length === 0 && GM.M.hist.bag.length === 0 && GM.M.st.resultat === null && !sek.querySelector('.fundtabel'));
  // Et resultat, der hverken er kopieret eller gemt
  indsaet(w, sek.querySelector('.tomt'), MTEKST);
  await vent(10); // V-OPBYG.1 N3: analysen sker ved indsætning (før ⌘↵ første gang)
  s.tast('Enter', { metaKey: true }); await vent(10);
  rb.click(); await vent(5);
  const d2 = d.querySelector('dialog[open]');
  tjek('V-MANUEL.1 N3: et maskeret resultat, der ikke er kopieret eller gemt: Ryd spørger først', d2 && /hverken kopieret eller gemt/.test(d2.querySelector('p').textContent));
  [...d2.querySelectorAll('button')].find(x => x.textContent === 'Annullér').click(); await vent(5);
  w.navigator.clipboard = { writeText: async () => { } };
  knapI(d, 'masker', 'kopier').click(); await vent(10);
  rb.click(); await vent(10);
  tjek('V-MANUEL.1 N3: efter Kopiér rydder Ryd uden at spørge', !d.querySelector('dialog[open]') && GM.M.st.tekst === null);
  // Demaskér
  w.location.hash = 'demasker'; await vent(5);
  const dsek = d.querySelector('section[data-visning="demasker"]');
  const drb = knapI(d, 'demasker', 'ryd');
  indsaet(w, dsek.querySelector('.tomt'), 'svar med ord0001');
  s.tast('Enter', { metaKey: true }); await vent(10);
  drb.click(); await vent(5);
  const d3 = d.querySelector('dialog[open]');
  tjek('V-MANUEL.1 N3: Demaskér: et demaskeret resultat, der ikke er kopieret eller gemt: Ryd spørger først (fokus på Annullér)', d3 && d3.id === 'dlg-ryd-dem' && /Ryd kan ikke fortrydes\.$/.test(d3.querySelector('p').textContent) && d.activeElement.textContent === 'Annullér');
  [...d3.querySelectorAll('button')].find(x => x.textContent === 'Ryd').click(); await vent(10);
  tjek('V-MANUEL.1 N3: Demaskér: Ryd tømmer svaret og resultatet og går til den tomme flade', GM.D.st.tekst === null && GM.D.st.resultat === null && !dsek.querySelector('.tomt').hidden && d.activeElement === dsek.querySelector('.tomt') && !kommandoAktiv(d, 'demasker', 'ryd'));
  indsaet(w, dsek.querySelector('.tomt'), 'svar uden resultat');
  drb.click(); await vent(10);
  tjek('V-MANUEL.1 N3: Demaskér uden resultat: Ryd rydder straks', !d.querySelector('dialog[open]') && GM.D.st.tekst === null);
})();

// ── V-MANUEL.1 N4: Næste advarsel ──
await (async () => {
  const s = await manuelSide();
  const { d, w, GM } = s;
  s.tast('Enter', { metaKey: true }); await vent(10);
  w.location.hash = 'demasker'; await vent(5);
  const dsek = d.querySelector('section[data-visning="demasker"]');
  const nb = knapI(d, 'demasker', 'naeste-advarsel');
  const svar = 'linje et\r\nh0099 her\nlinje tre\rUSER0001 og USER0001\n';
  indsaet(w, dsek.querySelector('.tomt'), svar);
  tjek('V-MANUEL.1 N4: før demaskeringen er Næste advarsel slået fra (Demaskér først)', !kommandoAktiv(d, 'demasker', 'naeste-advarsel') && forklaring(nb) === 'Demaskér først');
  s.tast('Enter', { metaKey: true }); await vent(10);
  tjek('V-MANUEL.1 N4: med advarsler er Næste advarsel slået til med genvejen ⌘G (ikke længere "Kommer i en senere version")', kommandoAktiv(d, 'demasker', 'naeste-advarsel') && nb.getAttribute('title') === 'Genvej: ⌘G' && nb.getAttribute('aria-keyshortcuts') === 'Meta+G' && !/senere\('naeste-advarsel'/.test(ui('assets/app.js')));
  const beskedD = () => dsek.querySelector('.arbejde .besked');
  const valgtRk = () => [...dsek.querySelectorAll('.advtabel tbody tr')].findIndex(tr => tr.getAttribute('aria-selected') === 'true');
  const markeret = () => w.getSelection().toString();
  const forloeb = [];
  for (let n = 0; n < 4; n++) {
    if (n === 1) s.tast('g', { metaKey: true, code: 'KeyG' }); else nb.click();
    await vent(5);
    forloeb.push([GM.D.st.filter, valgtRk(), beskedD().textContent, markeret()]);
  }
  tjek('V-MANUEL.1 N4: hvert tryk (knap eller ⌘G) vælger den næste række under Advarsler og starter forfra efter den sidste', forloeb.map(x => x[0] + ':' + x[1]).join() === 'advarsler:0,advarsler:1,advarsler:2,advarsler:0', JSON.stringify(forloeb));
  tjek('V-MANUEL.1 N4: … viser stedet i svaret (linjen markeres; Rusts linjeregel: CRLF, LF og et enligt CR) og melder det høfligt', forloeb[0][2] === 'Advarsel 1/3: linje 2.' && forloeb[0][3] === 'h0099 her' && forloeb[1][2] === 'Advarsel 2/3: uden sted i svaret.' && forloeb[2][2] === 'Advarsel 3/3: linje 4.' && forloeb[2][3] === 'USER0001 og USER0001' && beskedD().getAttribute('role') === 'status', JSON.stringify(forloeb));
  tjek('V-MANUEL.1 N4: rækken er valgt i tabellen (kittets valg)', dsek.querySelectorAll('.advtabel tbody tr')[0].classList.contains('sel'));
  tjek('V-MANUEL.1 N4: visLinje: en linje efter det viste svar giver false (intet markeres)', GM.D.visLinje(99) === false && GM.D.visLinje(0) === false && GM.D.visLinje(3) === true && markeret() === 'linje tre');
  // Uden advarsler
  indsaet(w, dsek.querySelector('pre.tekst'), 'ingen advarsler her');
  s.tast('Enter', { metaKey: true }); await vent(10);
  tjek('V-MANUEL.1 N4: uden advarsler er den slået fra med forklaringen "Ingen advarsler i dette svar"', GM.D.st.resultat && !kommandoAktiv(d, 'demasker', 'naeste-advarsel') && forklaring(nb) === 'Ingen advarsler i dette svar', forklaring(nb));
  const foerG = beskedD().textContent, adv0 = GM.D.st.adv;
  const g = new w.KeyboardEvent('keydown', { key: 'g', code: 'KeyG', metaKey: true, bubbles: true, cancelable: true });
  d.dispatchEvent(g);
  tjek('V-MANUEL.1 N4: ⌘G uden advarsler gør intet', beskedD().textContent === foerG && GM.D.st.adv === adv0 && adv0 === -1);
  S_EN: {
    w.Sprog.saet('en'); await vent(5);
    tjek('V-MANUEL.1 N4: engelsk: "No warnings in this reply"', forklaring(nb) === 'No warnings in this reply', forklaring(nb));
    w.Sprog.saet('da'); await vent(5);
  }
})();

// ── V-MANUEL.1 N5: størrelser og linjetal med sprogets talformat ──
await (async () => {
  const s = side({ rust: falskRust() });
  const { d, w } = s;
  await vent(5);
  const GM = w.GrimnirMaskering;
  const linjer = 'a\n'.repeat(12344) + 'b';
  indsaet(w, d.querySelector('section[data-visning="masker"] .tomt'), linjer);
  const info = () => d.querySelector('section[data-visning="masker"] .panel-hoved .muted').textContent;
  tjek('V-MANUEL.1 N5: linjetallet har sprogets tusindtalsskille ("12.345 linjer")', info() === '12.345 linjer · 24 kB', info());
  w.Sprog.saet('en'); await vent(5);
  tjek('V-MANUEL.1 N5: … og på engelsk ("12,345 lines")', info() === '12,345 lines · 24 kB', info());
  tjek('V-MANUEL.1 N5: engelsk: fejlen om en stor fil og grænsen med punktum', GM.filFejlTekst({ art: 'for_stor', bytes: 110100480, maks: 104857600 }) === 'the file is 105.0 MB, and the limit is 100.0 MB');
  w.Sprog.saet('da'); await vent(5);
  indsaet(w, d.querySelector('section[data-visning="masker"] pre.tekst'), 'x');
  tjek('V-MANUEL.1 N5: ental ved præcis 1 ("1 linje")', info() === '1 linje · 1 byte', info());
  const m5 = ui('assets/maskering.js');
  tjek('V-MANUEL.1 N5: Linje i Rester- og Demaskér-tabellen har også sprogets tusindtalsskille (tal(…), ikke String(…))', /String\(r\.antal\), tal\(r\.linje\)\]/.test(m5) && /a\.linje \? tal\(a\.linje\) : ''/.test(m5) && !/String\(r\.linje\)\]|String\(a\.linje\)/.test(m5));
  tjek('V-MANUEL.1 N5: maskering.js har ikke længere sin egen MB-funktion med toFixed (alle størrelser går gennem stoerrelse)', !/toFixed/.test(ui('assets/maskering.js')) && !/\bmb\(/.test(ui('assets/maskering.js')));
  tjek('V-MANUEL.1 N5: sprog.js: filStr, bForStor, bForStorDemasker og ffejl_for_stor har størrelsen som en færdig tekst (ingen "{v} MB")', ['da', 'en'].every(sp => !/\{[vw]\} MB/.test([w.Sprog.TEKST[sp].filStr, w.Sprog.TEKST[sp].bForStor, w.Sprog.TEKST[sp].bForStorDemasker, w.Sprog.TEKST[sp].ffejl_for_stor].join(' '))));
})();
await (async () => {
  // Filinfoen følger sproget ved et sprogskift
  const s = side({ rust: { ...falskRust(), fil_aabn: () => ({ navn: 'app.log', bytes: 12345678, tegnsaet: 'utf8', linjeskift: 'lf', linjer: 1202, uddrag: 'x', ikke_vist: 0 }) } });
  const { d, w } = s;
  await vent(5);
  knapI(d, 'masker', 'aabn-fil').click(); await vent(10);
  const fi = () => d.querySelector('section[data-visning="masker"] .vl .filinfo').textContent;
  const da = fi();
  w.Sprog.saet('en'); await vent(5);
  tjek('V-MANUEL.1 N5: filinfoens størrelse følger sproget ("11,8 MB" → "11.8 MB")', da.includes('11,8 MB') && fi().includes('11.8 MB'), da + ' / ' + fi());
  w.Sprog.saet('da'); await vent(5);
})();

// ── V-MANUEL.1: tekster, CSS og regler ──
await (async () => {
  const { w } = side();
  const T = w.Sprog.TEKST;
  const nye = ['gRediger', 'kMaskerDette', 'kFortryd', 'kGentag', 'kRyd', 'hvorforMarker', 'hvorforKunIndsat', 'hvorforVisTeksten', 'hvorforIntetFortryd', 'hvorforIntetGentag', 'hvorforIngenAdvarsler', 'stTilfoejet', 'ariaTypeFor', 'kFjern', 'kFjernTitel', 'ariaFjern', 'advKort', 'advNulSteder', 'bTilfoejet', 'bTilfoejetNul', 'bMarkeringTom', 'bMarkeringLinjer', 'bFindesAllerede', 'bAlleredeTilfoejet', 'bErKode', 'bAfvist_kode', 'bAfvist_aldrig', 'bAfvist_tom', 'bAfvist_linjeskift', 'bAfvist_type', 'bFjernet', 'rydH', 'rydPValg', 'rydPResultat', 'rydPBegge', 'rydDemP', 'kRydOk', 'bNaesteAdv', 'bNaesteAdvUdenSted', 'ariaGenvejsmenu', 'kKopierMarkering', 'titelType', 'linjeNr', ...['valg', 'kode', 'type', 'tilfoej', 'fjern'].flatMap(a => ['fortrudt_' + a, 'gentaget_' + a])];
  // Oversat: dansk og engelsk er forskellige, undtagen hvor ordet er det samme (Type for {v}).
  const mangler = nye.filter(k => !(k in T.da && k in T.en) || (T.da[k] === T.en[k] && k !== 'ariaTypeFor'));
  tjek(`V-MANUEL.1: de ${nye.length} nye tekster findes på dansk og engelsk (og er oversat)`, mangler.length === 0, mangler.join(', '));
  const rs = fs.readFileSync(path.join(repo, 'src-tauri', 'src', 'maskering.rs'), 'utf8');
  const grunde = [...rs.slice(rs.indexOf('fn tag_tilfoejede')).split(/\n}\n/)[0].matchAll(/Some\("([a-z]+)"\)/g)].map(x => x[1]);
  tjek('V-MANUEL.1: hver grund, Rust kan afvise en tilføjet værdi med, har en tekst (bAfvist_*)', grunde.length === 5 && grunde.every(g => 'bAfvist_' + g in T.da && 'bAfvist_' + g in T.en), grunde.join());
  const typer = [...rs.matchAll(/pub const TILFOEJ_ARTER: \[Art; 9\] = \[([^\]]+)\]/g)].map(m => m[1])[0] || '';
  const m = ui('assets/maskering.js');
  const ui5 = (m.match(/const TYPER = \[([^\]]+)\]/) || [])[1] || '';
  tjek('V-OPBYG.4 N2: valglistens typer og Hemmelighed (genvejsmenuen) er nogle, Rust tager imod (TILFOEJ_ARTER med 9), og har tekster', ui5.split(',').map(x => x.trim().replace(/'/g, '')).concat('hemmelighed').every(t => t && ('art_' + t) in T.da && typer.includes({ ord: 'Art::Ord', bruger: 'Art::Bruger', vaert: 'Art::Vaert', domaene: 'Art::Domaene', person: 'Art::Person', hemmelighed: 'Art::Hemmelighed' }[t])), ui5);
  tjek('V-MANUEL.1: genvejsmenuen står i tekstpanelet uden inline-stil (CSS-reglen giver den position)', CSS_REGLER.some(r => r.sel === '.tekstpanel' && r.decl.position === 'relative') && CSS_REGLER.some(r => r.sel === '.genvejsmenu' && r.decl.position === 'absolute') && !/genvejsmenu[^\n]*\.style/.test(m));
  tjek('V-MANUEL.1: intet nyt skriver til konsollen eller localStorage, og teksten vises stadig i <pre>', !/\bconsole\s*\./.test(m) && !/localStorage\s*\.\s*setItem|sessionStorage|indexedDB/.test(m) && /el\('pre'/.test(m));
  tjek('V-MANUEL.1: de tilføjede værdier sendes kun til Rust (invoke) og står kun i hukommelsen (st.tilfoejede)', (m.match(/tilfoejede: tilfoejede\(\)/g) || []).length === 4);
})();

// ══════════════════════════ V-FANER.2 (D26): ét bånd, visningerne som store knapper forrest ══════════════════════════
// Erstatter V-FANER.1's fanerække over båndet. Maskér, Demaskér, Sager og Ordbog står som store knapper (kittets visninger
// i commandBar: links til #id med aria-current="page") forrest i hvert af de fire bånd; resten er visningens kommandoer,
// og det, der ikke er plads til på én række, står i kittets Mere-menu. Fanen Vis er stadig væk; venstre side er kun
// træet. Ingen fast ventetid: testene venter på hændelsen grimnir-visning eller på en tilstand i DOM'en (MutationObserver)
// med en grænse, der kun nås, når det, der ventes på, ikke sker. Kun opdigtede data.
// V-OPBYG.1: målt igen i WKWebView (scratchpad/maal: en kopi af ui/, 1800 × 900, intet flyttet): fanerne står i deres egen
// række, så båndet har kun visningens kommandoer (skitsens ord; Sager har Gem som sag…). bred er den sidste gruppes højre kant
// + båndets luft til højre (12 px × trin).
const MAALT_BAAND = {"lille":{"da":{"masker":{"grp":[188.2,239.1,234.8,345,161.5],"knap":[57.6,57.6,57.6,57.6,57.6,108.5,86,57.6,75.8,127.2,102.4,100,150.7],"bred":1233.3},"demasker":{"grp":[188.2,179,180.3],"knap":[57.6,57.6,57.6,69,96.4,90.5,77.1],"bred":590.6},"noter":{"grp":[193,102.6],"knap":[57.6,58.6,61.4,91.8],"bred":328},"sager":{"grp":[445.2,139.1,68.4],"knap":[95.6,57.6,72.9,83.1,57.6,57.6,65.6,59.9,57.6],"bred":695.8},"ordbog":{"grp":[224.5,139.1,78.4],"knap":[68.3,57.6,83.3,59.9,65.6,67.6],"bred":485.2}},"en":{"masker":{"grp":[193.1,223.5,259.5,308.1,104.3],"knap":[57.6,62.5,57.6,57.6,57.6,93,87.8,57.6,98.7,108.2,102.8,81.7,93.5],"bred":1153.3},"demasker":{"grp":[193.1,156.9,162.2],"knap":[57.6,62.5,57.6,59,84.4,74.8,74.7],"bred":555.4},"noter":{"grp":[217.3,104.6],"knap":[65.9,61.3,74.7,93.8],"bred":354.2},"sager":{"grp":[475,128.8,87.3],"knap":[92.9,67.5,92.1,86.5,57.7,57.6,57.6,57.6,76.5],"bred":734.3},"ordbog":{"grp":[212,128.8,97.7],"knap":[67.9,57.6,71.1,57.6,57.6,86.9],"bred":481.7}}},"normal":{"da":{"masker":{"grp":[209,265.4,260.4,382.6,179.3],"knap":[64,64,64,64,64,120.4,95.4,64,84,141.1,113.6,110.9,167.3],"bred":1368.6},"demasker":{"grp":[209,198.4,199.9],"knap":[64,64,64,76.5,106.9,100.4,85.5],"bred":655.3},"noter":{"grp":[213.9,113.8],"knap":[64,64.9,68,101.8],"bred":363.8},"sager":{"grp":[494,154,76],"knap":[106.1,64,80.8,92.1,64,64,72.7,66.3,64],"bred":772},"ordbog":{"grp":[249,154,87],"knap":[75.7,64,92.3,66.3,72.7,75],"bred":538}},"en":{"masker":{"grp":[214.2,248.1,287.8,341.6,115.8],"knap":[64,69.2,64,64,64,103.1,97.4,64,109.5,120.1,114,90.5,103.8],"bred":1279.5},"demasker":{"grp":[214.2,173.9,179.8],"knap":[64,69.2,64,65.3,93.6,83,82.8],"bred":615.9},"noter":{"grp":[240.7,116],"knap":[73,67.9,82.8,104],"bred":392.7},"sager":{"grp":[526.8,143,96.8],"knap":[103,74.8,102.2,95.9,64,64,64,64,84.8],"bred":814.6},"ordbog":{"grp":[235,143,108.4],"knap":[75.3,64,78.8,64,64,96.4],"bred":534.4}}},"stor":{"da":{"masker":{"grp":[235,298.2,292.3,429.5,201.4],"knap":[72,72,72,72,72,135.2,107.1,72,94.2,158.5,127.6,124.5,187.9],"bred":1537.5},"demasker":{"grp":[235,222.5,224.4],"knap":[72,72,72,85.8,120,112.7,96],"bred":736},"noter":{"grp":[240.1,127.8],"knap":[72,72.8,76.3,114.3],"bred":408.4},"sager":{"grp":[554.8,172.6,85.5],"knap":[119.1,72,90.6,103.4,72,72,81.5,74.3,72],"bred":867},"ordbog":{"grp":[279.5,172.6,97.6],"knap":[84.9,72,103.6,74.3,81.5,84.1],"bred":603.7}},"en":{"masker":{"grp":[240.6,278.7,323.2,383.5,130],"knap":[72,77.6,72,72,72,115.7,109.3,72,122.9,134.8,128,101.6,116.5],"bred":1437},"demasker":{"grp":[240.6,195,201.8],"knap":[72,77.6,72,73.2,105,93.1,93],"bred":691.4},"noter":{"grp":[269.9,130.3],"knap":[81.9,76.1,92.9,116.8],"bred":440.7},"sager":{"grp":[591.6,160.8,108.6],"knap":[115.6,83.9,114.7,107.6,72,72,72,72,95.1],"bred":915},"ordbog":{"grp":[263.8,160.8,121.7],"knap":[84.4,72,88.4,72,72,108.2],"bred":600.2}}}};
// V-OPBYG.1: det, kittets Mere flyttede i WKWebView ved 1024 × 560 og 1200 × 800 (samme kopi).
// V-OPBYG.2 N2: Noters bånd målt på samme måde (scratchpad/wk: en kopi af ui/, 1800 × 900; de fire andre bånd målte præcis
// som V-OPBYG.1's tal); ved 1024 og 1200 px flytter Mere intet i Noter.
// V-OPBYG.5 N1: Maskérs bånd målt igen med gruppen Hemmelighed sidst (scratchpad/maal: en kopi af ui/, 1800 × 900 for
// bredderne, 1024 × 560 og 1200 × 800 for Mere; WKWebView, macOS 26.6). Resten af Maskérs knapper målte som før; gruppen
// Resultat er 1 px bredere (den er ikke længere sidst og har sit skille). De fire andre bånd er ikke ændret.
const MAALT_FLYTTET = {"1024 lille da":{"masker":["gem-fil","kvittering","masker-hemmelig"],"demasker":[],"noter":[],"sager":[],"ordbog":[]},"1200 lille da":{"masker":["masker-hemmelig"],"demasker":[],"noter":[],"sager":[],"ordbog":[]},"1024 lille en":{"masker":["kvittering","masker-hemmelig"],"demasker":[],"noter":[],"sager":[],"ordbog":[]},"1200 lille en":{"masker":[],"demasker":[],"noter":[],"sager":[],"ordbog":[]},"1024 normal da":{"masker":["gem-fil","kvittering","masker-hemmelig"],"demasker":[],"noter":[],"sager":[],"ordbog":[]},"1200 normal da":{"masker":["kvittering","masker-hemmelig"],"demasker":[],"noter":[],"sager":[],"ordbog":[]},"1024 normal en":{"masker":["gem-fil","kvittering","masker-hemmelig"],"demasker":[],"noter":[],"sager":[],"ordbog":[]},"1200 normal en":{"masker":["kvittering","masker-hemmelig"],"demasker":[],"noter":[],"sager":[],"ordbog":[]},"1024 stor da":{"masker":["kopier","gem-fil","kvittering","masker-hemmelig"],"demasker":[],"noter":[],"sager":[],"ordbog":[]},"1200 stor da":{"masker":["gem-fil","kvittering","masker-hemmelig"],"demasker":[],"noter":[],"sager":[],"ordbog":[]},"1024 stor en":{"masker":["kopier","gem-fil","kvittering","masker-hemmelig"],"demasker":[],"noter":[],"sager":[],"ordbog":[]},"1200 stor en":{"masker":["gem-fil","kvittering","masker-hemmelig"],"demasker":[],"noter":[],"sager":[],"ordbog":[]}};
const visKnapper = d => [...d.querySelectorAll('#baand > [data-visning]:not([hidden]) .vk')];
const aktuelle = d => [...d.querySelectorAll('#baand .vk[aria-current="page"]')].map(a => a.dataset.visning);
const tastPaa = (w, el, key, x = {}) => { const e = new w.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...x }); if (el) el.dispatchEvent(e); return e; };
const klikVis = async (w, a, id) => { const p = visningSkift(w, id); a.click(); return p; };
await (async () => {
  const s = side();
  const { d, w } = s;
  await ventTil(w, () => !laaseskaerm(d));
  const titel = d.querySelector('header.titel');
  tjek('V-OPBYG.1 (D27): fanerne er båndets egne: titellinjen, låsebanneret og båndet står lige efter hinanden; fanerne står øverst inde i hvert bånd (.cmd-faner), og der er ingen #faner, ingen fanerække fra 2.6.0 og ingen tablist', titel.nextElementSibling.id === 'laas-banner' && d.getElementById('laas-banner').nextElementSibling.id === 'baand' && !d.getElementById('faner') && [...d.querySelectorAll('#baand > [data-visning]')].every(b => b.firstElementChild.classList.contains('cmd-faner')) && !d.querySelector('.vfaner, .vf, [role="tablist"], [role="tab"], .tabs') && !/id="faner"/.test(ui('index.html')));
  const baandene = [...d.querySelectorAll('#baand > [data-visning]')];
  tjek('V-OPBYG.2: hvert af de fem bånd har fanerne øverst (role="group", navnet er nøglen visninger: Visninger) og kun visningens egne grupper under dem (ingen gruppe Visninger)', baandene.length === 5 && baandene.every(b => { const f = b.querySelector(':scope > .cmd-faner'); return f && f.getAttribute('role') === 'group' && f.getAttribute('data-t-aria') === 'visninger' && f.getAttribute('aria-label') === 'Visninger' && !b.querySelector('.grp-visninger') && ![...b.querySelectorAll('.grupper .cap')].some(c => c.textContent === 'Visninger'); }));
  tjek('V-OPBYG.2: fem faner i fast rækkefølge i hvert bånd (Noter mellem Demaskér og Sager): links til #id (.vk.vfane, ikke .cb) uden ikon, som skitsen; Ordbog står for sig til højre (hoejre); navnene er de samme tekster som før', baandene.every(b => { const v = [...b.querySelectorAll('.cmd-faner .vk')]; return v.length === 5 && v.every((a, i) => a.tagName === 'A' && a.classList.contains('vfane') && !a.classList.contains('cb') && a.getAttribute('href') === '#' + VIS[i] && a.dataset.visning === VIS[i] && !a.querySelector('svg') && a.firstElementChild.className === 'vk-navn' && a.classList.contains('hoejre') === (VIS[i] === 'ordbog')) && v.map(a => a.querySelector('.vk-navn').textContent).join() === 'Maskér,Demaskér,Noter,Sager,Ordbog'; }) && ['vMasker', 'vDemasker', 'vNoter', 'vSager', 'vOrdbog'].map(k => w.Sprog.TEKST.da[k]).join() === 'Maskér,Demaskér,Noter,Sager,Ordbog');
  tjek('V-FANER.2: visningsknapperne er links (ingen rolle, ingen aria-selected, ingen aria-controls), båndet er role="group" med sit navn, og arbejdsfladen er ikke længere et fanepanel', d.querySelectorAll('#baand .vk').length === 25 && [...d.querySelectorAll('#baand .vk')].every(a => !a.hasAttribute('role') && !a.hasAttribute('aria-selected') && !a.hasAttribute('aria-controls')) && baandene.every(b => b.getAttribute('role') === 'group' && b.getAttribute('aria-label') === 'Handlingsbånd') && [...d.querySelectorAll('section.visning')].every(x => !x.hasAttribute('role') && x.getAttribute('aria-label')));
  tjek('V-OPBYG.2: aria-current="page" står kun på Maskér, i alle fem bånd', aktuelle(d).join() === 'masker,masker,masker,masker,masker');
  tjek('V-OPBYG.2: genvejene ⌘1–⌘5 står i knappens værktøjstip og i aria-keyshortcuts (Meta+1–5)', visKnapper(d).map(a => forklaring(a)).join() === '⌘1,⌘2,⌘3,⌘4,⌘5' && visKnapper(d).map(a => a.getAttribute('aria-keyshortcuts')).join() === 'Meta+1,Meta+2,Meta+3,Meta+4,Meta+5');
  const kit = ui('assets/kit.css');
  tjek('V-OPBYG.1 (CSS): den åbne fane har båndets flade, en kant, fed skrift og en streg på 2 px i accent øverst (ikke kun farve), og den hænger sammen med båndet (margin -1 px over rækkens kant)', /\n\.vfane\[aria-current="page"\] \{ background: var\(--surface-raised\); border-color: var\(--border\); font-weight: 600; box-shadow: inset 0 2px 0 var\(--accent\); \}/.test(kit) && /\n\.cmd \{ flex: none; background: var\(--surface-raised\);/.test(kit) && /margin-bottom: -1px;/.test(kit));
  const mereKn = [...d.querySelectorAll('#baand .cb-mere')];
  tjek('V-FANER.2: Mere står sidst i hvert bånd (efter grupperne), lukket, med aria-haspopup="menu", navnet Mere og menuen skjult; uden målte bredder (jsdom) er alt plads, og Mere er skjult', mereKn.length === 5 && mereKn.every(m => m.parentElement.classList.contains('mere-plads') && m.parentElement.parentElement.lastElementChild === m.parentElement && m.parentElement.hidden && m.getAttribute('aria-haspopup') === 'menu' && m.getAttribute('aria-expanded') === 'false' && m.textContent === 'Mere' && d.getElementById(m.getAttribute('aria-controls'))?.hidden));
  // Klik, mellemrum, piletaster, ⌘1–⌘4
  const okSager = await klikVis(w, visKnapper(d)[3], 'sager');
  tjek('V-OPBYG.2: et klik på Sager viser Sager (adressen #sager), og Sager er den åbne i alle fem bånd', okSager && synlige(d).join() === 'sager' && w.location.hash === '#sager' && aktuelle(d).join() === 'sager,sager,sager,sager,sager');
  const baand = () => [...d.querySelectorAll('#baand > [data-visning]')].filter(b => !b.hidden);
  tjek('V-OPBYG.1: kun Sagers bånd vises, med fanerne øverst og Sagers kommandoer under dem (Gem som sag… først)', baand().length === 1 && baand()[0].dataset.visning === 'sager' && baand()[0].querySelector('.cmd-faner + .grupper [data-kommando]').dataset.kommando === 'gem-som-sag');
  const ord = visKnapper(d)[4];
  ord.focus();
  const pOrd = visningSkift(w, 'ordbog');
  const mel = tastPaa(w, ord, ' ');
  tjek('V-FANER.2: mellemrum på Ordbog åbner Ordbog (som Enter på et link; kittet), og siden ruller ikke', mel.defaultPrevented && (await pOrd) && synlige(d).join() === 'ordbog' && aktuelle(d)[0] === 'ordbog');
  const vk = visKnapper(d);
  vk[4].focus();
  const pil = tastPaa(w, vk[4], 'ArrowLeft'), pil2 = tastPaa(w, vk[4], 'ArrowRight');
  tjek('V-FANER.2: piletaster gør intet på en visningsknap (båndets regel: Tab går fra knap til knap)', !pil.defaultPrevented && !pil2.defaultPrevented && w.location.hash === '#ordbog' && d.activeElement === vk[4]);
  const p2 = visningSkift(w, 'demasker');
  s.tast('2', { metaKey: true, code: 'Digit2' });
  tjek('V-FANER.2: ⌘2 viser Demaskér og flytter aria-current', (await p2) && synlige(d).join() === 'demasker' && aktuelle(d).join() === 'demasker,demasker,demasker,demasker,demasker');
  // En dialog åben: et klik og ⌘3 gør intet; lukket igen virker de.
  d.getElementById('aabn-indst').click();
  const kl = new w.MouseEvent('click', { bubbles: true, cancelable: true });
  visKnapper(d)[3].dispatchEvent(kl);
  s.tast('3', { metaKey: true, code: 'Digit3' });
  tjek('V-FANER.2: med en dialog åben gør et klik på en visning og ⌘3 intet (klikket stoppes; adressen og aria-current står)', aaben(d, 'dlg-indst') && kl.defaultPrevented && w.location.hash === '#demasker' && aktuelle(d)[0] === 'demasker');
  d.querySelector('#dlg-indst [data-svar="luk"]').click();
  tjek('V-FANER.2: lukket igen virker knapperne', (await klikVis(w, visKnapper(d)[3], 'sager')) && synlige(d).join() === 'sager');
  // Fanen Vis er væk; venstre side er kun træet; titellinjen er uændret.
  tjek('V-FANER.2: ingen fane Vis: båndene har ingen fanerække, ingen data-fane="vis" og ingen knapper for tema eller sprog', !d.querySelector('#baand .tabs, #baand .tab, #baand [role="tablist"], [data-fane="vis"]') && !d.querySelector('[data-kommando^="tema-"], [data-kommando^="sprog-"]') && [...d.querySelectorAll('#baand > [data-visning]')].every(b => b.classList.contains('enkel') && b.querySelectorAll('.grupper').length === 1));
  tjek('V-FANER.2: koden og teksterne, der kun hørte til fanen Vis og fanerækken, er væk (visFane, opdaterVis, faneVis, faneStart, faner: true, #faner)', !/visFane|opdaterVis|faneVis|faneStart|tema-lys|sprog-da|faner: true|\$\('faner'\)/.test(ui('assets/app.js')) && !/'faner'/.test(ui('assets/laas.js')) && !/#faner/.test(ui('assets/app.css')) && !['faneVis', 'faneStart'].some(k => k in w.Sprog.TEKST.da || k in w.Sprog.TEKST.en));
  d.getElementById('aabn-indst').click();
  tjek('V-FANER.2: alt, fanen Vis havde, findes under tandhjulet: tema (Lys, Mørk, System) og sprog (Dansk, English) i Indstillinger, og tekststørrelsen der og i menuen Vis', ['lys', 'moerk', 'system'].every(v => d.querySelector(`#dlg-indst input[name="indst-tema"][value="${v}"]`)) && ['da', 'en'].every(v => d.querySelector(`#dlg-indst input[name="indst-sprog"][value="${v}"]`)) && d.querySelectorAll('#dlg-indst input[name="indst-tekst"]').length === 3 && /TEKST_STOERRE[\s\S]*TEKST_MINDRE[\s\S]*TEKST_NORMAL/.test(fs.readFileSync(path.join(repo, 'src-tauri', 'src', 'programmenu.rs'), 'utf8')));
  d.querySelector('#dlg-indst [data-svar="luk"]').click();
  const nav = d.querySelector('nav.nav');
  tjek('V-OPBYG.1: venstre side er træet med filtre og under det den aktuelle sag og "Alt behandles på denne maskine" (intet visningsskift, ingen #skift, ingen faner, ingen visningsknapper)', [...nav.children].map(e => e.id || e.className).join() === 'navdele,sagdel,sagdel-lokalt' && !d.getElementById('skift') && !nav.querySelector('.skift, .vs, .vfaner, .vf, .vk') && d.querySelectorAll('nav.nav .navdel .trae').length === 5);
  const nd = d.querySelector('.navdel[data-visning="sager"]');
  tjek('V-FANER.2: venstre side fylder hele højden: den aktive visnings del og dens træ fylder ruden (flex 1, min-height 0), og navdele fylder nav', cssVaerdi(d.getElementById('navdele'), 'flex') === '1' && cssVaerdi(nd, 'flex') === '1 1 auto' && cssVaerdi(nd.querySelector('.trae'), 'flex') === '1 1 auto' && cssVaerdi(nd.querySelector('.trae'), 'min-height') === '0' && cssVaerdi(nd.querySelector('.trae'), 'overflow') === 'auto');
  tjek('V-OPBYG.3 N3: titellinjen: mærke (masken), navn, slogan, sagen, sagens knap, Vejledning, Lås, ⓘ og tandhjulet', [...titel.children].map(e => e.className || e.tagName).join() === 'mrk-maske gr-mrk,B,slogan-plads,hoejre' && [...titel.querySelector('.hoejre').children].map(e => e.id).join() === 'sag,sag-knap,vejledning,laas-nu,aabn-om,aabn-indst' && !titel.querySelector('.vk, .vf, [role="tab"]'));
  // Tab-rækkefølgen
  await klikVis(w, visKnapper(d)[0], 'masker');
  const fokuserbar = [...d.querySelectorAll('a[href], button, input, select, textarea, [tabindex]')].filter(e => e.tabIndex >= 0 && !e.disabled && !e.closest('[hidden], [inert], dialog, .tip'));
  const omraade = e => (e.closest('header.titel') ? 'titellinje' : e.closest('#laas-banner') ? 'banner' : e.closest('#baand') ? 'bånd' : e.closest('nav.nav') ? 'venstre' : e.closest('#arb') ? 'arbejdsflade' : e.closest('.fodl') ? 'fodlinje' : 'andet');
  const raekke = fokuserbar.map(omraade).filter((x, i, a) => i === 0 || a[i - 1] !== x);
  tjek('V-FANER.2: Tab-rækkefølgen er titellinjen, båndet, venstre side, arbejdsfladen (ingen række over båndet)', raekke.join(' → ') === 'titellinje → bånd → venstre → arbejdsflade', raekke.join(' → '));
  const iBaand = fokuserbar.filter(e => omraade(e) === 'bånd');
  tjek('V-OPBYG.2: i båndet kommer først de fem visninger (hver sit Tab-stop, også den åbne), så Maskérs kommandoer i rækkefølge', iBaand.slice(0, 5).map(a => a.dataset.visning).join() === VIS.join() && iBaand.slice(5).map(b => b.dataset.kommando).join() === 'indsaet,aabn-fil,ryd,fortryd,gentag,masker-dette,analyser,gem-masker,foer-efter,kopier,gem-fil,kvittering,masker-hemmelig', iBaand.map(e => e.dataset.visning || e.dataset.kommando).join());
})();
await (async () => {
  // Låst: båndet med visningerne er nedtonet og kan ikke bruges, og ⌘1–⌘4 gør intet. Første forsøg annulleres, andet (Enter) lykkes.
  const rust = falskLaasRust({ svar: [{ svar: 'annulleret' }, { svar: 'ok' }] });
  const s = side({ rust });
  const { d, w } = s;
  // Første forsøg (annulleret) er færdigt: beskeden står, og Lås op kan bruges igen.
  await ventTil(w, () => d.getElementById('laas-besked').textContent === 'Grimnir er stadig låst. Tryk Lås op for at prøve igen.' && !d.getElementById('laas-op').disabled);
  tjek('V-FANER.2 (låst): båndet med fanerne er inert og forklarer i title; CSS nedtoner båndet og skjuler tippet; ingen regel for #faner længere', laaseskaerm(d) && [...d.getElementById('baand').children].every(e => e.hasAttribute('inert')) && d.querySelectorAll('#baand .vk').length === 25 && [...d.querySelectorAll('#baand .vk')].every(a => a.closest('[inert]')) && d.getElementById('baand').title === 'Grimnir er låst. Lås op for at bruge visningerne og kommandoerne.' && CSS_REGLER.some(r => r.sel === 'html[data-laast] #baand' && r.decl.opacity === '.45') && CSS_REGLER.some(r => r.sel === 'html[data-laast] .nav' && r.decl.opacity === '.45') && CSS_REGLER.some(r => r.sel === 'html[data-laast] #baand .tip' && r.decl.display === 'none') && !CSS_REGLER.some(r => /#faner/.test(r.sel)), JSON.stringify([laaseskaerm(d), [...d.getElementById('baand').children].map(e => e.hasAttribute('inert')).join(), d.getElementById('baand').title, CSS_REGLER.filter(r => /data-laast\] #baand/.test(r.sel)).map(r => r.sel + JSON.stringify(r.decl))]));
  const kl = new w.MouseEvent('click', { bubbles: true, cancelable: true });
  visKnapper(d)[3].dispatchEvent(kl);
  s.tast('3', { metaKey: true, code: 'Digit3' });
  tjek('V-FANER.2 (låst): et klik på en visning og ⌘3 gør intet (klikket stoppes; adressen og aria-current står)', kl.defaultPrevented && w.location.hash === '' && aktuelle(d).join() === 'masker,masker,masker,masker,masker');
  s.tast('Enter');
  const op = await ventTil(w, () => !laaseskaerm(d));
  tjek('V-FANER.2 (låst op): båndet er ikke længere inert, title er væk, og et klik på Sager viser Sager', op && ![...d.getElementById('baand').children].some(e => e.hasAttribute('inert')) && !d.getElementById('baand').hasAttribute('title') && (await klikVis(w, visKnapper(d)[3], 'sager')) && synlige(d).join() === 'sager', JSON.stringify([op, synlige(d), d.getElementById('baand').title]));
})();
await (async () => {
  // Begge sprog og Windows.
  const s = side({ lager: { 'grimnir-sprog': 'en' }, platform: 'windows' });
  const { d, w } = s;
  await ventTil(w, () => !laaseskaerm(d));
  // V-OPBYG.1: fanernes række har gruppens navn (aria-label) i stedet for et gruppenavn i båndet.
  const f = visKnapper(d), cap = () => d.querySelector('#baand > [data-visning]:not([hidden]) .cmd-faner').getAttribute('aria-label');
  tjek('V-OPBYG.2 (English, Windows): gruppen hedder Views, knapperne Mask, Unmask, Notes, Cases, Dictionary, genvejene er Ctrl+1–5 (Control+1–5), og Mere hedder More', cap() === 'Views' && f.map(a => a.querySelector('.vk-navn').textContent).join() === 'Mask,Unmask,Notes,Cases,Dictionary' && f.map(a => forklaring(a)).join() === 'Ctrl+1,Ctrl+2,Ctrl+3,Ctrl+4,Ctrl+5' && f.map(a => a.getAttribute('aria-keyshortcuts')).join() === 'Control+1,Control+2,Control+3,Control+4,Control+5' && [...d.querySelectorAll('#baand .cb-mere')].every(m => m.textContent === 'More') && w.Sprog.TEKST.da.kMere === 'Mere' && w.Sprog.TEKST.en.kMere === 'More');
  w.Sprog.saet('da');
  tjek('V-FANER.2: et sprogskift skifter knappernes navne, gruppens navn og Mere uden genindlæsning', cap() === 'Visninger' && f.map(a => a.querySelector('.vk-navn').textContent).join() === 'Maskér,Demaskér,Noter,Sager,Ordbog' && d.querySelector('#baand .cb-mere').textContent === 'Mere');
  const p4 = visningSkift(w, 'ordbog');
  s.tast('5', { ctrlKey: true, code: 'Digit5' });
  tjek('V-OPBYG.2 (Windows): Ctrl+5 viser Ordbog og flytter aria-current', (await p4) && synlige(d).join() === 'ordbog' && aktuelle(d).join() === 'ordbog,ordbog,ordbog,ordbog,ordbog');
})();
await (async () => {
  // ── Én række ved den nye mindste bredde, regnet i jsdom ud fra bredder målt i WKWebView (som kolonner.mjs) ──
  // MAALT_BAAND: pr. trin, sprog og visning gruppernes og knappernes bredde i vinduets px (alle kommandoer i båndet,
  // målt i et vindue på 1800 px, hvor intet er flyttet), og båndets bredde på én række. MAALT_FLYTTET: det, kittets
  // Mere flyttede i WKWebView ved 1024 × 560 og 1200 × 800. Regnestykket: .grupper har 12 px luft i hver side og 12 px
  // mellem grupperne (× trinnet); med Mere vist er luften til højre 0, den sidste gruppe får sit skille (1 px), og
  // Mere-pladsen er 88 px (× trinnet); en flyttet knap tager sin bredde og 2 px mellemrum med sig. Kittets egen tilpas()
  // kører på jsdom med de regnede placeringer (getBoundingClientRect for båndets række og grupperne). Rækken står på én
  // linje, når den sidste synlige gruppes højre kant er inden for båndet (kittets regel).
  const konf = JSON.parse(fs.readFileSync(path.join(repo, 'src-tauri', 'tauri.conf.json'), 'utf8')).app.windows[0];
  const appMin = /:root \{ --vindue-min-bredde: (\d+)px; \}/.exec(ui('assets/app.css'));
  tjek('V-FANER.2: mindste vindue er 1024 × 560 i tauri.conf.json og i app.css (--vindue-min-bredde, kittets 2.7.0-regel deler det med trinnet)', konf.minWidth === 1024 && konf.minHeight === 560 && appMin && Number(appMin[1]) === konf.minWidth && /\n\.vindue, :root\[data-tekst\] \.vindue \{ min-width: calc\(var\(--vindue-min-bredde, 900px\) \/ var\(--tekst-zoom\)\);/.test(ui('assets/kit.css')));
  const Z = { lille: 0.9, normal: 1, stor: 1.125 };
  const s = side();
  const { d, w } = s;
  await ventTil(w, () => !laaseskaerm(d));
  const G = w.Grimnir;
  function regn(id, maal, z, W) {
    const bar = G.dele[id].bar, rod = bar.rod, panel = rod.querySelector('.grupper');
    const grpEl = [...panel.querySelectorAll(':scope > .grp')], knapEl = [...panel.querySelectorAll('.cb')];
    // Gruppernes placering på rækken (vinduets px fra båndets venstre kant) og båndets bredde på én række.
    const lag = () => {
      const vist = rod.classList.contains('mere-vist'), pos = new Map();
      let x = 12 * z, n = 0;
      grpEl.forEach((g, i) => {
        if (g.hasAttribute('data-mere-tom')) return;
        let b = maal.grp[i];
        for (const k of g.querySelectorAll('.cb[data-i-mere]')) b -= maal.knap[knapEl.indexOf(k)] + 2 * z;
        if (vist && i === grpEl.length - 1) b += z;
        if (n++) x += 12 * z;
        pos.set(g, [x, x + b]);
        x += b;
      });
      return { pos, indhold: x + (vist ? 0 : 12 * z), sidste: [...pos.values()].at(-1)[1] };
    };
    const plads = () => W - (rod.classList.contains('mere-vist') ? 88 * z : 0);
    const rect = (l, r) => ({ left: l, right: r, width: r - l, top: 0, bottom: 54, height: 54, x: l, y: 0 });
    panel.getBoundingClientRect = () => rect(0, Math.min(lag().indhold, plads()));
    for (const g of grpEl) g.getBoundingClientRect = () => { const p = lag().pos.get(g) || [0, 0]; return rect(p[0], p[1]); };
    bar.tilpas();
    const l = lag();
    return { flyttet: bar.mere.flyttet, bredde: l.indhold, sidste: l.sidste, plads: plads(), visningerFlyttet: [...panel.querySelectorAll('.vk[data-i-mere]')].length, pri: panel.querySelector('.cb.pri').hasAttribute('data-i-mere'), andre: knapEl.filter(k => !k.classList.contains('vk') && !k.classList.contains('pri')).every(k => k.hasAttribute('data-i-mere')) };
  }
  // Kontrol: regnestykket uden Mere giver den målte bredde på én række (alle 24 kombinationer, højst 0,6 px fra).
  let kontrol = [];
  for (const [t, z] of Object.entries(Z)) for (const sp of ['da', 'en']) {
    w.Sprog.saet(sp);
    for (const id of VIS) { const r = regn(id, MAALT_BAAND[t][sp][id], z, 5000); kontrol.push(Math.abs(r.bredde - MAALT_BAAND[t][sp][id].bred)); }
  }
  tjek('V-OPBYG.2 (regnet): kontrol: regnestykket giver båndets målte bredde i alle 30 kombinationer (trin × sprog × visning, med Noter) inden for 0,6 px', kontrol.length === 30 && Math.max(...kontrol) <= 0.6, Math.max(...kontrol).toFixed(2));
  // Ved 1024 og 1200 px flytter kittets tilpas() det samme som i WKWebView, og rækken står på én linje.
  for (const W of [1024, 1200]) for (const [t, z] of Object.entries(Z)) for (const sp of ['da', 'en']) {
    w.Sprog.saet(sp);
    const ud = VIS.map(id => ({ id, ...regn(id, MAALT_BAAND[t][sp][id], z, W) }));
    const maalt = MAALT_FLYTTET[`${W} ${t} ${sp}`];
    tjek(`V-OPBYG.2 (regnet, ${W} px, ${t}, ${sp}): én række i alle fem visninger, og Mere flytter det samme som målt i WKWebView`, ud.every(r => r.sidste <= r.plads + 1 && JSON.stringify(r.flyttet) === JSON.stringify(maalt[r.id])), JSON.stringify(ud.map(r => [r.id, r.flyttet, Math.round(r.sidste), Math.round(r.plads)])) + ' målt ' + JSON.stringify(maalt));
  }
  // V-OPBYG.1 N8: ved normal tekst i 1200 × 800 står alle fire bånd helt på én række på begge sprog (Maskér har 12 kommandoer).
  // V-OPBYG.5 N1: Maskér har 13 kommandoer (Maskér som hemmelighed sidst); ved 1200 px normal står den og Kopiér kvittering i
  // Mere (målt i WebKit), de fire andre bånd står helt som før.
  {
    const ved1200 = ['da', 'en'].map(sp => { w.Sprog.saet(sp); return VIS.map(id => ({ id, ...regn(id, MAALT_BAAND.normal[sp][id], 1, 1200) })); }).flat();
    tjek('V-OPBYG.5 N1 (regnet og målt): normal, 1200 px, begge sprog: Demaskér, Noter, Sager og Ordbog står helt på én række uden Mere; Maskér (13 kommandoer) har Kopiér kvittering og Maskér som hemmelighed i Mere', ved1200.every(r => r.sidste <= r.plads + 1 && JSON.stringify(r.flyttet) === (r.id === 'masker' ? '["kvittering","masker-hemmelig"]' : '[]')) && MAALT_BAAND.normal.da.masker.knap.length === 13 && ['1200 normal da', '1200 normal en'].every(k => Object.entries(MAALT_FLYTTET[k]).every(([id, x]) => JSON.stringify(x) === (id === 'masker' ? '["kvittering","masker-hemmelig"]' : '[]'))), JSON.stringify(ved1200.map(r => r.flyttet)));
  }
  // Ved normal står Demaskér, Sager og Ordbog helt fra 1024 px på begge sprog; for hver bredde fra 1024 til 2000 px står
  // båndet på én række, visningerne flyttes aldrig, og den primære kommando flyttes kun, når alle andre er flyttet.
  for (const [t, z] of Object.entries(Z)) for (const sp of ['da', 'en']) {
    w.Sprog.saet(sp);
    const brud = [];
    for (let W = 1024; W <= 2000; W++) for (const id of VIS) {
      const r = regn(id, MAALT_BAAND[t][sp][id], z, W);
      if (r.sidste > r.plads + 1 || r.visningerFlyttet || (r.pri && !r.andre) || (t === 'normal' && id !== 'masker' && r.flyttet.length)) brud.push(`${W} ${id}`);
    }
    tjek(`V-OPBYG.2 (regnet, ${t}, ${sp}): 1024–2000 px: én række i alle fem visninger, visningerne flyttes aldrig, den primære sidst${t === 'normal' ? ', og kun Maskér bruger Mere' : ''}`, brud.length === 0, brud.slice(0, 5).join(', '));
  }
  // Mere i Grimnir (1024 px, normal, dansk, Maskér): menuen, Tab-rækkefølgen og et punkt, der klikker den skjulte knap.
  w.Sprog.saet('da');
  const r = regn('masker', MAALT_BAAND.normal.da.masker, 1, 1024);
  const bar = G.dele.masker.bar, mk = bar.mere.knap, menu = bar.mere.menu;
  // V-OPBYG.5 N1: Maskér som hemmelighed står også i Mere; dens gruppe (kun den) er skjult.
  tjek('V-OPBYG.5 N1 (Mere, 1024 px): Mere vises sidst i Maskérs bånd; Gem maskeret fil, Kopiér kvittering og Maskér som hemmelighed står i den, Maskér (primær) og Kopiér maskeret tekst i båndet', !mk.parentElement.hidden && JSON.stringify(r.flyttet) === '["gem-fil","kvittering","masker-hemmelig"]' && !bar.knap('gem-masker').hasAttribute('data-i-mere') && !bar.knap('kopier').hasAttribute('data-i-mere') && [...bar.rod.querySelectorAll('.grp[data-mere-tom]')].length === 1 && bar.rod.querySelector('.grp[data-mere-tom]').contains(bar.knap('masker-hemmelig')), JSON.stringify(r.flyttet));
  const fok = [...bar.rod.querySelectorAll('a[href], button')].filter(e => e.tabIndex >= 0 && !e.closest('[hidden], .tip') && !e.hasAttribute('data-i-mere') && !e.closest('.grp[data-mere-tom]') && !e.closest('.mere-menu'));
  tjek('V-FANER.2 (Mere): Tab i båndet: visningerne, de synlige kommandoer og Mere til sidst', fok.at(-1) === mk && fok.slice(0, 5).every(a => a.classList.contains('vk')) && fok.length === 5 + 10 + 1, fok.map(e => e.dataset.visning || e.dataset.kommando || 'mere').join());
  mk.focus();
  mk.click();
  const punkter = [...menu.querySelectorAll('.mere-punkt')];
  // V-OPBYG.1: Før og efter står ikke længere i Mere ved 1024 px (menuitemcheckbox prøves i kittets test).
  tjek('V-OPBYG.5 N1 (Mere): med tastaturet åbner menuen med fokus på første punkt; punkterne (Gem maskeret fil, Kopiér kvittering, Maskér som hemmelighed) har samme navne, ikoner og tilstand som knapperne (slået fra, med hvorfor under navnet)', !menu.hidden && mk.getAttribute('aria-expanded') === 'true' && d.activeElement === punkter[0] && punkter.map(p => p.querySelector('.mere-navn').textContent).join() === 'Gem maskeret fil,Kopiér kvittering,Maskér som hemmelighed' && punkter.every(p => p.getAttribute('role') === 'menuitem' && p.querySelector('svg') && p.getAttribute('aria-disabled') === 'true' && d.getElementById(p.getAttribute('aria-describedby'))?.textContent === forklaring(bar.knap(p.dataset.kommando))), JSON.stringify([menu.hidden, d.activeElement?.className, punkter.map(p => [p.textContent, p.getAttribute('role'), p.getAttribute('aria-disabled'), forklaring(bar.knap(p.dataset.kommando))])]));
  tastPaa(w, punkter[0], 'Escape');
  tjek('V-FANER.2 (Mere): Esc lukker menuen med fokus på Mere', menu.hidden && d.activeElement === mk && mk.getAttribute('aria-expanded') === 'false');
  bar.saetDeaktiveret('kvittering', false);
  let klik = 0;
  bar.knap('kvittering').addEventListener('click', () => klik++);
  mk.click();
  const kp = [...menu.querySelectorAll('.mere-punkt')].find(p => p.dataset.kommando === 'kvittering');
  kp.click();
  tjek('V-FANER.2 (Mere): et punkt, der er slået til, lukker menuen og klikker den skjulte knap (samme handling som i båndet)', klik === 1 && menu.hidden && !kp.hasAttribute('aria-disabled'));
})();

// ══════════════════════════ V-OPBYG.6 N2: næste skridt i Mere ══════════════════════════
// Kittets tilpas() kører på jsdom med de regnede placeringer (som "Én række ved den nye mindste bredde" ovenfor, MAALT_BAAND).
// Det, der flyttes ved 1024 px, er målt i WebKit (MAALT_FLYTTET; HANDOFF-V-OPBYG.6, Målt mod regnet).
await (async () => {
  const Z = { lille: 0.9, normal: 1, stor: 1.125 };
  function regnN2(G, id, maal, z, W) {
    const bar = G.dele[id].bar, rod = bar.rod, panel = rod.querySelector('.grupper');
    const grpEl = [...panel.querySelectorAll(':scope > .grp')], knapEl = [...panel.querySelectorAll('.cb')];
    const lag = () => {
      const vist = rod.classList.contains('mere-vist'), pos = new Map();
      let x = 12 * z, n = 0;
      grpEl.forEach((g, i) => {
        if (g.hasAttribute('data-mere-tom')) return;
        let b = maal.grp[i];
        for (const k of g.querySelectorAll('.cb[data-i-mere]')) b -= maal.knap[knapEl.indexOf(k)] + 2 * z;
        if (vist && i === grpEl.length - 1) b += z;
        if (n++) x += 12 * z;
        pos.set(g, [x, x + b]);
        x += b;
      });
      return { pos, indhold: x + (vist ? 0 : 12 * z) };
    };
    const plads = () => W - (rod.classList.contains('mere-vist') ? 88 * z : 0);
    const rect = (l, r) => ({ left: l, right: r, width: r - l, top: 0, bottom: 54, height: 54, x: l, y: 0 });
    panel.getBoundingClientRect = () => rect(0, Math.min(lag().indhold, plads()));
    for (const g of grpEl) g.getBoundingClientRect = () => { const p = lag().pos.get(g) || [0, 0]; return rect(p[0], p[1]); };
    bar.tilpas();
    return bar.mere.flyttet;
  }
  // MAALT_N2: målt i WKWebView ved 1024 × 560 med den rigtige vej (indsæt → Maskér; Demaskér), pr. tekststørrelse og sprog:
  // hvad Mere flytter med Indsæt som næste skridt (t1), med Kopiér maskeret tekst som næste skridt (t3; markeringen gør
  // knappen fed og dermed bredere, så den ved normal dansk også flyttes) og med Kopiér resultat (d3), om Mere-knappen da er
  // markeret, og hvilket punkt i menuen der er markeret.
  const MAALT_N2 = {"lille da":{"t1":["gem-fil","kvittering","masker-hemmelig"],"t3":["gem-fil","kvittering","masker-hemmelig"],"d3":[],"mere":false,"punkt":[]},"lille en":{"t1":["kvittering","masker-hemmelig"],"t3":["gem-fil","kvittering","masker-hemmelig"],"d3":[],"mere":false,"punkt":[]},"normal da":{"t1":["gem-fil","kvittering","masker-hemmelig"],"t3":["kopier","gem-fil","kvittering","masker-hemmelig"],"d3":[],"mere":true,"punkt":["kopier"]},"normal en":{"t1":["gem-fil","kvittering","masker-hemmelig"],"t3":["gem-fil","kvittering","masker-hemmelig"],"d3":[],"mere":false,"punkt":[]},"stor da":{"t1":["kopier","gem-fil","kvittering","masker-hemmelig"],"t3":["kopier","gem-fil","kvittering","masker-hemmelig"],"d3":[],"mere":true,"punkt":["kopier"]},"stor en":{"t1":["kopier","gem-fil","kvittering","masker-hemmelig"],"t3":["kopier","gem-fil","kvittering","masker-hemmelig"],"d3":[],"mere":true,"punkt":["kopier"]}};
  tjek('V-OPBYG.6 N2 (målt i WebKit, 1024 px, 3 størrelser × 2 sprog): Indsæt og Kopiér resultat står aldrig i Mere; Kopiér maskeret tekst står i Mere ved normal dansk og stor tekst, og præcis dér er Mere-knappen og punktet Kopiér markeret', Object.entries(MAALT_N2).length === 6 && Object.entries(MAALT_N2).every(([k, m]) => !m.t1.includes('indsaet') && m.d3.length === 0 && m.t3.includes('kopier') === ['normal da', 'stor da', 'stor en'].includes(k) && m.mere === m.t3.includes('kopier') && JSON.stringify(m.punkt) === (m.mere ? '["kopier"]' : '[]')), JSON.stringify(MAALT_N2));
  const css = ui('assets/app.css');
  tjek('V-OPBYG.6 N2: punktet i Mere-menuen får kant, flade og fed skrift (ikke kun farve); Mere-knappen bruger knappens regel (.cb[data-naeste])', /\.mere-punkt\[data-naeste\] \{ box-shadow: inset 0 0 0 1px var\(--accent\); background: var\(--accent-soft\); font-weight: 600; \}/.test(css) && /\.cb\[data-naeste\] \{ border-color: var\(--accent\); background: var\(--accent-soft\); font-weight: 600; \}/.test(css));
  for (const sp of ['da', 'en']) {
    const rust = falskRust();
    const skrevet = [];
    const s = side({ hash: '#masker', rust, lager: { 'grimnir-sprog': sp }, foer: w => Object.defineProperty(w.navigator, 'clipboard', { value: { writeText: async t => { skrevet.push(t); } }, configurable: true }) });
    const { d, w } = s;
    await ventTil(w, () => !laaseskaerm(d));
    const G = w.Grimnir;
    const naeste = v => [...d.querySelectorAll(`#baand > [data-visning="${v}"] .cb[data-naeste]:not(.cb-mere)`)].map(b => b.dataset.kommando).join();
    const mk = v => G.dele[v].bar.mere.knap, menu = v => G.dele[v].bar.mere.menu;
    const punkt = (v, id) => menu(v).querySelector(`.mere-punkt[data-kommando="${id}"]`);
    const markeret = v => [...menu(v).querySelectorAll('.mere-punkt[data-naeste]')].map(p => p.dataset.kommando).join();
    // Trin 1: Indsæt er næste skridt. Ved 1024 px stor står den i båndet; først i et bånd på 200 px (under vinduets mindste
    // bredde, så kun for at vise, at markeringen følger med) flyttes den til Mere.
    regnN2(G, 'masker', MAALT_BAAND.stor[sp].masker, Z.stor, 1024);
    await vent(0);
    tjek(`V-OPBYG.6 N2 (${sp}, 1024 px stor): Indsæt er næste skridt og står i båndet; Mere er ikke markeret`, naeste('masker') === 'indsaet' && !G.dele.masker.bar.knap('indsaet').hasAttribute('data-i-mere') && !mk('masker').hasAttribute('data-naeste'));
    const smal = regnN2(G, 'masker', MAALT_BAAND.stor[sp].masker, Z.stor, 200);
    await ventTil(w, () => mk('masker').hasAttribute('data-naeste'));
    mk('masker').click();
    await ventTil(w, () => markeret('masker') !== '');
    tjek(`V-OPBYG.6 N2 (${sp}, smalt bånd): Indsæt i Mere: Mere-knappen og punktet Indsæt er markeret, intet andet punkt`, smal.includes('indsaet') && mk('masker').hasAttribute('data-naeste') && markeret('masker') === 'indsaet' && punkt('masker', 'indsaet') && !punkt('masker', 'indsaet').hasAttribute('aria-disabled'), JSON.stringify([smal, markeret('masker')]));
    G.dele.masker.bar.mere.luk();
    // Trin 3: Kopiér maskeret tekst er næste skridt.
    regnN2(G, 'masker', MAALT_BAAND.stor[sp].masker, Z.stor, 1024);
    const sek = d.querySelector('section[data-visning="masker"]');
    indsaet(w, sek.querySelector('.tomt'), TEKST);
    await ventTil(w, () => naeste('masker') === 'gem-masker');
    klik(w, knapI(d, 'masker', 'gem-masker'));
    await ventTil(w, () => naeste('masker') === 'kopier');
    const f1024 = regnN2(G, 'masker', MAALT_BAAND.stor[sp].masker, Z.stor, 1024);
    await ventTil(w, () => mk('masker').hasAttribute('data-naeste'));
    tjek(`V-OPBYG.6 N2 (${sp}, 1024 px stor): Kopiér maskeret tekst er næste skridt og står i Mere: Mere-knappen er markeret (data-naeste, samme regel som knappen)`, JSON.stringify(f1024) === JSON.stringify(MAALT_FLYTTET[`1024 stor ${sp}`].masker) && G.dele.masker.bar.knap('kopier').hasAttribute('data-i-mere') && mk('masker').hasAttribute('data-naeste') && mk('masker').classList.contains('cb'), JSON.stringify(f1024));
    mk('masker').focus();
    mk('masker').click();
    await ventTil(w, () => markeret('masker') !== '');
    tjek(`V-OPBYG.6 N2 (${sp}): i den åbne menu er punktet Kopiér maskeret tekst markeret, og kun det`, !menu('masker').hidden && markeret('masker') === 'kopier', markeret('masker'));
    G.dele.masker.bar.mere.luk();
    // Bredere (normal tekst): Kopiér står i båndet igen, og Mere er ikke længere markeret; smallere igen: markeret igen.
    regnN2(G, 'masker', MAALT_BAAND.normal[sp].masker, Z.normal, 1024);
    await ventTil(w, () => !mk('masker').hasAttribute('data-naeste'));
    tjek(`V-OPBYG.6 N2 (${sp}, 1024 px normal): Kopiér står i båndet med markeringen, og Mere er ikke markeret`, !G.dele.masker.bar.knap('kopier').hasAttribute('data-i-mere') && naeste('masker') === 'kopier' && !mk('masker').hasAttribute('data-naeste'));
    regnN2(G, 'masker', MAALT_BAAND.stor[sp].masker, Z.stor, 1024);
    await ventTil(w, () => mk('masker').hasAttribute('data-naeste'));
    tjek(`V-OPBYG.6 N2 (${sp}): flyttes Kopiér i Mere igen (stor tekst), er Mere markeret igen`, mk('masker').hasAttribute('data-naeste'));
    // Kopiér fra menuen: ingen næste skridt, og markeringen er væk.
    mk('masker').click();
    punkt('masker', 'kopier').click();
    await ventTil(w, () => naeste('masker') === '' && !mk('masker').hasAttribute('data-naeste'));
    tjek(`V-OPBYG.6 N2 (${sp}): efter Kopiér fra Mere (punktet klikker knappen) er der intet næste skridt, og Mere er ikke markeret`, skrevet.length === 1 && naeste('masker') === '' && !mk('masker').hasAttribute('data-naeste'));
    // Demaskér: Kopiér resultat er næste skridt. Ved 1024 px stor står den i båndet; i et smalt bånd (420 px) i Mere.
    w.Grimnir.vis('demasker');
    await ventTil(w, () => synlige(d).join() === 'demasker');
    indsaet(w, d.querySelector('section[data-visning="demasker"] .tomt'), 'Prøv user0001\n');
    klik(w, knapI(d, 'demasker', 'demasker'));
    await ventTil(w, () => naeste('demasker') === 'kopier-resultat');
    regnN2(G, 'demasker', MAALT_BAAND.stor[sp].demasker, Z.stor, 1024);
    await vent(0);
    tjek(`V-OPBYG.6 N2 (${sp}, 1024 px stor): Kopiér resultat står i Demaskérs bånd; Demaskérs Mere er ikke markeret`, !G.dele.demasker.bar.knap('kopier-resultat').hasAttribute('data-i-mere') && !mk('demasker').hasAttribute('data-naeste'));
    const dsmal = regnN2(G, 'demasker', MAALT_BAAND.stor[sp].demasker, Z.stor, 420);
    await ventTil(w, () => mk('demasker').hasAttribute('data-naeste'));
    mk('demasker').click();
    await ventTil(w, () => markeret('demasker') !== '');
    tjek(`V-OPBYG.6 N2 (${sp}, smalt bånd): Kopiér resultat i Demaskérs Mere: knappen og punktet er markeret; Maskérs Mere er det ikke`, dsmal.includes('kopier-resultat') && markeret('demasker') === 'kopier-resultat' && !mk('masker').hasAttribute('data-naeste'), JSON.stringify([dsmal, markeret('demasker')]));
  }
})();

// ══════════════════════════ V-MANUEL.2: sagens indhold, den tomme flade, Kendt fra sagen, mønstre, hvorforLaast ══════════════════════════
// Efterlignet Rust: falskSagRust med sag_indhold (indholdPoster), falskOrdbogRust for mønstrene og falskLaasRust for låsen.
// Kun opdigtede navne og værdier.
const indholdRaekker = d => [...d.querySelectorAll('section[data-visning="sager"] .indholdtabel tbody tr')];
const indholdVises = d => { const a = d.querySelector('section[data-visning="sager"] .sagindhold'); return Boolean(a && !a.hidden); };
const traePunkter = d => [...d.querySelectorAll('.navdel[data-visning="sager"] .tr')].map(b => b.textContent);
await (async () => {
  // N4: sprog.js har ingen nøgle to gange i en sprogblok. Skanneren springer strenge og kommentarer over og ser kun nøgler
  // på blokkens øverste niveau.
  function noegler(kilde) {
    const ud = [];
    let i = 0, dybde = 0, forventNoegle = false;
    while (i < kilde.length) {
      const c = kilde[i];
      if (c === '/' && kilde[i + 1] === '/') { i = kilde.indexOf('\n', i); if (i < 0) break; continue; }
      if (c === '/' && kilde[i + 1] === '*') { i = kilde.indexOf('*/', i) + 2; continue; }
      if (c === "'" || c === '"' || c === '`') { let j = i + 1; while (j < kilde.length && kilde[j] !== c) { if (kilde[j] === '\\') j++; j++; } i = j + 1; forventNoegle = false; continue; }
      if (c === '{') { dybde++; forventNoegle = dybde === 1; i++; continue; }
      if (c === '}') { dybde--; i++; continue; }
      if (c === ',' && dybde === 1) { forventNoegle = true; i++; continue; }
      const m = /^([A-Za-z_$][\w$]*)\s*:/.exec(kilde.slice(i, i + 80));
      if (forventNoegle && dybde === 1 && m) { ud.push(m[1]); i += m[0].length; forventNoegle = false; continue; }
      if (!/\s/.test(c)) forventNoegle = false;
      i++;
    }
    return ud;
  }
  const dobbelte = l => l.filter((k, i) => l.indexOf(k) !== i);
  const sprog = ui('assets/sprog.js');
  const blok = navn => { const a = sprog.indexOf(`    ${navn}: {`); return sprog.slice(sprog.indexOf('{', a), sprog.indexOf('\n    },', a) + 6); };
  tjek('V-MANUEL.2 N4: kontrol: skanneren finder en nøgle, der står to gange (også efter en streng med kolon og komma)', JSON.stringify(dobbelte(noegler("{ a: 'x: y, b: z', b: 'c', // a: kommentar\n c: `d`, b: 'igen' }"))) === '["b"]');
  for (const navn of ['da', 'en']) {
    const n = noegler(blok(navn));
    tjek(`V-MANUEL.2 N4: sprog.js (${navn}): ingen nøgle står to gange (${n.length} nøgler)`, n.length > 400 && dobbelte(n).length === 0, dobbelte(n).join(', '));
  }
  const { w } = side();
  const T = w.Sprog.TEKST;
  tjek('V-MANUEL.2 N4: hvorforRaekkeLaast og hvorforLaast er to tekster i begge sprog', T.da.hvorforRaekkeLaast.startsWith('Teksten har allerede en af sagens koder her') && T.da.hvorforLaast.startsWith('Grimnir er låst') && T.en.hvorforRaekkeLaast.startsWith('The text already holds') && T.en.hvorforLaast.startsWith('Grimnir is locked'));
  const NYE = ['tKendtFraSagen', 'ingenKendtFraSagen', 'pFil', 'tomMaskerSagP', 'tomMaskerMidlP', 'kVisSagensIndhold', 'kVisIndhold', 'bMoenster', 'kLaegIOrdbogen', 'kIkkeNu', 'bMoensterLagt', 'kTilbageTilSager', 'pSagIndhold', 'pMidlIndhold', 'indholdInfo', 'kolRigtigVaerdi', 'kolTidligereKoder', 'bIndholdLaest', 'bIndholdUdloebet', 'bIndholdFejl', 'soegIndhold', 'ingenIIndhold', 'fodIndholdTal'];
  tjek('V-MANUEL.2: de nye tekster findes på dansk og engelsk (forskellige)', NYE.every(k => T.da[k] && T.en[k] && T.da[k] !== T.en[k]), NYE.filter(k => !(T.da[k] && T.en[k] && T.da[k] !== T.en[k])).join(', '));
  tjek('V-MANUEL.2: "Seneste i sagen" er væk; filteret hedder "Kendt fra sagen" / "Known from the case"', !('tSenesteISagen' in T.da) && T.da.tKendtFraSagen === 'Kendt fra sagen' && T.en.tKendtFraSagen === 'Known from the case');
  const rd = f => fs.readFileSync(path.join(repo, 'src-tauri', f), 'utf8');
  tjek('V-MANUEL.2: sag_indhold står i generate_handler!, build.rs og capabilities', /generate_handler!\[[^\]]*\bsag_indhold\b/.test(rd('src/lib.rs')) && /"sag_indhold",/.test(rd('build.rs')) && JSON.parse(rd('capabilities/default.json')).permissions.includes('allow-sag-indhold'));
})();
await (async () => {
  // N4: en låst række i Maskér viser rækkens forklaring, ikke låseteksten.
  const rust = falskRust();
  const analyser = rust.analyser;
  rust.analyser = a => { const x = analyser(a); x.raekker[1] = { ...x.raekker[1], laast: true, valgt: true }; return x; };
  const s = side({ rust });
  const { d, w } = s;
  await vent(5);
  indsaet(w, d.querySelector('section[data-visning="masker"] .tomt'), TEKST);
  s.tast('Enter', { metaKey: true }); await vent(10);
  const cb = raekkeMed(d, 24).querySelector('input[type="checkbox"]');
  tjek('V-MANUEL.2 N4: en låst række har rækkens forklaring i title (ikke "Grimnir er låst")', cb.disabled && cb.title === 'Teksten har allerede en af sagens koder her; den skal maskeres, ellers sætter demaskeringen en forkert værdi ind', cb.title);
  // N1: filteret "Kendt fra sagen" i træet.
  const punkt = d.querySelector('.navdel[data-visning="masker"] [data-punkt="seneste"]');
  tjek('V-MANUEL.2 N1: træet i Maskér har "Kendt fra sagen" med antal', punkt && punkt.textContent === 'Kendt fra sagen0', punkt && punkt.textContent);
  w.Sprog.saet('en');
  tjek('V-MANUEL.2 N1 (English): "Known from the case"', punkt.textContent === 'Known from the case0');
  w.Sprog.saet('da');
})();
await (async () => {
  // N1: Sager → Vis indhold (båndet), tabellen, type i venstre side, søgning, Vis flere, hemmelighed, Tilbage.
  const rust = falskSagRust({ sager: [...SAGER(), { id: hexId(6), navn: 'Stor opdigtet sag', poster: 1200 }] });
  const s = side({ hash: '#sager', rust });
  const { d, w } = s;
  await vent(20);
  tjek('V-MANUEL.2 N1: uden valgt sag er Vis indhold nedtonet med forklaring', !kommandoAktiv(d, 'sager', 'vis-indhold') && forklaring(knapI(d, 'sager', 'vis-indhold')) === 'Vælg en sag i listen først');
  klik(w, sagRaekke(d, hexId(1))); await vent(5);
  tjek('V-MANUEL.2 N1: med en valgt sag er Vis indhold aktiv', kommandoAktiv(d, 'sager', 'vis-indhold'));
  klik(w, knapI(d, 'sager', 'vis-indhold')); await vent(10);
  const kald = rust.st.indholdKald;
  tjek('V-MANUEL.2 N1: Vis indhold henter sagens poster fra Rust (id, alle typer, ingen søgning, 500 ad gangen, ingen viste)', kald.length === 1 && kald[0].id === hexId(1) && kald[0].valg.type === '' && kald[0].valg.soeg === '' && kald[0].valg.antal === 500 && kald[0].valg.vist.length === 0, JSON.stringify(kald));
  tjek('V-MANUEL.2 N1: visningen erstatter listen (listen er skjult)', indholdVises(d) && d.querySelector('section[data-visning="sager"] .sagliste:not(.sagindhold)').hidden);
  const ths = [...d.querySelectorAll('section[data-visning="sager"] .indholdtabel thead th')].map(t => t.textContent);
  // V-OPBYG.5 N2: en femte kolonne med rækkens "…"-knap; dens overskrift er skjult tekst (Handlinger).
  const thSkjult = [...d.querySelectorAll('section[data-visning="sager"] .indholdtabel thead th')].map(t => Boolean(t.querySelector('.skjult-tekst')));
  tjek('V-OPBYG.5 N2: kolonnerne Type, Kode, Rigtig værdi, Tidligere koder (ingen Antal steder: sagen har ikke tallet) og Handlinger som skjult tekst', JSON.stringify(ths) === '["Type","Kode","Rigtig værdi","Tidligere koder","Handlinger"]' && JSON.stringify(thSkjult) === '[false,false,false,false,true]', JSON.stringify(ths));
  const sek = d.querySelector('section[data-visning="sager"]');
  tjek('V-MANUEL.2 N1: panelets overskrift og hoved siger sagens navn, antal og at antal steder ikke huskes', sek.querySelector('.indholdpanel h3').textContent === 'Indhold i «Supportsag 0042»' && sek.querySelector('.indholdpanel .panel-hoved .muted').textContent === '214 værdier · sagen husker ikke, hvor mange steder de stod');
  const r0 = indholdRaekker(d);
  tjek('V-MANUEL.2 N1: 214 værdier, de første 200+ vises (alle 214 under 500)', r0.length === 214);
  tjek('V-MANUEL.2 N1: en række har type, kode og rigtig værdi; tidligere koder står', r0[0].textContent.includes('Maskine') && r0[0].textContent.includes('h0001') && r0[0].textContent.includes('srv-opdigtet-0001') && r0[0].textContent.includes('h9001'));
  const hRaekke = r0.find(tr => tr.textContent.includes('GRIMNIR_SECRET_0001'));
  tjek('V-MANUEL.2 N1: en hemmelighed står som prikker med Vis; værdien er ikke sendt og står ikke i DOM\'en', hRaekke && hRaekke.querySelector('.prikker') && !/Hemmelig-/.test(altIDom(d)) && hRaekke.querySelector('[data-felt="vis"]').textContent === 'Vis' && hRaekke.querySelector('[data-felt="vis"]').getAttribute('aria-label') === 'Vis værdien for GRIMNIR_SECRET_0001');
  tjek('V-MANUEL.2 N1: venstre side viser sagens typer med antal', JSON.stringify(traePunkter(d)) === JSON.stringify(['Sagens indhold214', 'Maskine54', 'Bruger54', 'Hemmelighed53', 'IPv4, eget net53']), JSON.stringify(traePunkter(d)));
  tjek('V-MANUEL.2 N1: søgefeltet søger i koder og værdier, og filterknappen viser valget', d.querySelector('section[data-visning="sager"] input[type="search"]').placeholder === 'Søg i koder og værdier' && sek.querySelector('.fl span').textContent === 'Sagens indhold');
  tjek('V-OPBYG.2 N4: fokus står på Tilbage; fodlinjen siger sagen og dens gemte erstatninger (antallet i panelhovedet)', d.activeElement === d.getElementById('indhold-tilbage') && /· \d+ (gemt erstatning|gemte erstatninger)$/.test(d.getElementById('fod-venstre').textContent), d.getElementById('fod-venstre').textContent);
  tjek('V-MANUEL.2 N1: læst, ikke åbnet: banneret siger det (den midlertidige sag er stadig den åbne)', sek.querySelector('.sagindhold .bannere').textContent.includes('Sagen er kun læst, ikke åbnet: den midlertidige sag er stadig den åbne.') && !s.kald.some(k => k[0] === 'sag_aabn'));
  // Vis hemmeligheden: kun den sendes, og Skjul skjuler den igen.
  klik(w, hRaekke.querySelector('[data-felt="vis"]')); await vent(10);
  tjek('V-MANUEL.2 N1: Vis beder Rust om netop den hemmelighed', JSON.stringify(kald[kald.length - 1].valg.vist) === '[' + hRaekke.querySelector('[data-felt="vis"]').closest('tr').getAttribute('data-nr') + ']');
  tjek('V-MANUEL.2 N1: den viste hemmelighed står, de andre er stadig prikker', /Hemmelig-0001!/.test(altIDom(d)) && !/Hemmelig-0002!/.test(altIDom(d)));
  // Type i venstre side.
  klik(w, d.querySelector('.navdel[data-visning="sager"] [data-punkt="i-bruger"]')); await vent(10);
  tjek('V-MANUEL.2 N1: et klik på Bruger viser kun brugere', kald[kald.length - 1].valg.type === 'bruger' && indholdRaekker(d).length === 54 && indholdRaekker(d).every(tr => tr.textContent.startsWith('Bruger')) && sek.querySelector('.fl span').textContent === 'Bruger');
  // Søgning (i Rust).
  const soeg = d.querySelector('section[data-visning="sager"] input[type="search"]');
  skriv(w, soeg, 'BRUGER-001'); await vent(10);
  tjek('V-MANUEL.2 N1: søgning sendes til Rust og viser de poster, der passer', kald[kald.length - 1].valg.soeg === 'BRUGER-001' && indholdRaekker(d).length === 10, String(indholdRaekker(d).length));
  skriv(w, soeg, 'findes-ikke'); await vent(10);
  tjek('V-MANUEL.2 N1: ingen træf siger det', indholdRaekker(d).length === 0 && sek.querySelector('.sagindhold .tabel-tom').textContent === 'Ingen af sagens værdier passer til søgningen.');
  // Tilbage (Esc): listen står igen, værdierne er væk fra DOM'en, og søgningen og træet er listens.
  d.getElementById('indhold-tilbage').dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); await vent(5);
  tjek('V-MANUEL.2 N1: Esc går tilbage til listen; ingen værdier står tilbage i DOM\'en', !indholdVises(d) && sagRaekker(d).length === 5 + 1 && !/srv-opdigtet|bruger-0|Hemmelig-/.test(altIDom(d)));
  tjek('V-OPBYG.2 N4: tilbage i listen: træet og søgefeltet er listens, fodlinjen sagens, fokus på den valgte sag', JSON.stringify(traePunkter(d)) === JSON.stringify(['Sager', 'Alle6', 'Udløber snart2', 'Ingen udløb2']) && soeg.placeholder === 'Søg i sagerne' && soeg.value === '' && d.activeElement === sagRaekke(d, hexId(1)) && /· \d+ (gemt erstatning|gemte erstatninger)$/.test(d.getElementById('fod-venstre').textContent), JSON.stringify(traePunkter(d)));
  // Enter på en række viser indholdet; den viste hemmelighed fra før er skjult igen.
  sagRaekke(d, hexId(1)).dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })); await vent(10);
  tjek('V-MANUEL.2 N1: Enter på rækken viser indholdet igen, og hemmeligheden er skjult igen', indholdVises(d) && JSON.stringify(kald[kald.length - 1].valg.vist) === '[]' && !/Hemmelig-/.test(altIDom(d)));
  klik(w, d.getElementById('indhold-tilbage')); await vent(5);
  tjek('V-MANUEL.2 N1: Tilbage-knappen går tilbage til listen', !indholdVises(d) && sagRaekker(d).length === 6);
  // Dobbeltklik på den store sag: 500 ad gangen og Vis flere.
  sagRaekke(d, hexId(6)).dispatchEvent(new w.MouseEvent('dblclick', { bubbles: true })); await vent(10);
  tjek('V-MANUEL.2 N1: dobbeltklik viser indholdet; en stor sag viser 500 af 1200', indholdVises(d) && indholdRaekker(d).length === 500 && sek.querySelector('.sagindhold .flere').textContent.startsWith('Viser 500 af 1200'));
  klik(w, sek.querySelector('.sagindhold .flere button')); await vent(10);
  tjek('V-MANUEL.2 N1: Vis flere henter 1000', kald[kald.length - 1].valg.antal === 1000 && indholdRaekker(d).length === 1000);
  // En anden visning lukker indholdet.
  w.Grimnir.vis('masker'); await vent(10);
  tjek('V-MANUEL.2 N1: en anden visning lukker indholdet (værdierne er væk fra DOM\'en)', !indholdVises(d) && !/srv-opdigtet|bruger-0/.test(altIDom(d)));
  w.Grimnir.vis('sager'); await vent(10);
  tjek('V-MANUEL.2 N1: tilbage i Sager står listen', !indholdVises(d) && sagRaekker(d).length === 6);
  // En sag, der ikke kan åbnes, og en udløbet sag forklarer det.
  sagRaekke(d, hexId(4)).dispatchEvent(new w.MouseEvent('dblclick', { bubbles: true })); await vent(10);
  tjek('V-MANUEL.2 N1: en sag uden nøgle siger hvorfor (ingen tabel)', indholdVises(d) && sek.querySelector('.sagindhold .bannere').textContent.includes('Sagens indhold kan ikke vises: nøglen mangler i nøgleringen') && indholdRaekker(d).length === 0, sek.querySelector('.sagindhold .bannere').textContent);
  klik(w, d.getElementById('indhold-tilbage')); await vent(5);
  sagRaekke(d, hexId(3)).dispatchEvent(new w.MouseEvent('dblclick', { bubbles: true })); await vent(10);
  tjek('V-MANUEL.2 N1: en udløbet sag siger, at den er udløbet, og viser indholdet', /Sagen udløb .+\. Den slettes ikke af sig selv/.test(sek.querySelector('.sagindhold .bannere').textContent) && indholdRaekker(d).length === 42);
  w.Sprog.saet('en');
  tjek('V-OPBYG.5 N2 (English): heading, columns (Actions as hidden text) and back button', sek.querySelector('.indholdpanel h3').textContent === 'Contents of “SQL-job fejler”' && [...sek.querySelectorAll('.indholdtabel thead th')].map(t => t.textContent).join() === 'Type,Code,Real value,Earlier codes,Actions' && d.getElementById('indhold-tilbage').textContent === 'Back to the cases');
  w.Sprog.saet('da');
})();
await (async () => {
  // N1: sagens dialog i titellinjen og den tomme flade i Maskér og Demaskér viser den åbne sags indhold.
  const rust = falskSagRust({ sager: SAGER() });
  rust.sag_aabn({ id: hexId(5) });
  const s = side({ rust });
  const { d, w } = s;
  await vent(20);
  const msek = d.querySelector('section[data-visning="masker"]');
  // V-OPBYG.1 N4: sagen står under den tomme flades sætning (.tomt-sag) med skitsens ordlyd; sagens indhold åbnes fra venstre
  // side (Gemte erstatninger 9), ikke længere fra en anden handling i den tomme flade.
  const anden = d.getElementById('sagdel-erst');
  tjek('V-OPBYG.1 N4: Maskér uden tekst siger, hvilken sag der er åben, og hvor mange gemte erstatninger den har', msek.querySelector('.tomt .tomt-sag').textContent === 'Sagen «Firewall-log» er åben med 9 gemte erstatninger, så kendte værdier får samme kode som sidst.', msek.querySelector('.tomt .tomt-sag').textContent);
  tjek('V-OPBYG.1 N4: venstre side: Aktuel sag «Firewall-log», Gemmes automatisk, Gemte erstatninger 9 (slået til), ingen Gem som sag…', d.getElementById('sagdel-navn').textContent === 'Firewall-log' && d.getElementById('sagdel-status').textContent === 'Gemmes automatisk' && d.getElementById('sagdel-gem').hidden && !anden.hasAttribute('aria-disabled') && d.getElementById('sagdel-antal').textContent === '9' && anden.getAttribute('aria-label') === 'Gemte erstatninger: 9. Vis sagens indhold');
  klik(w, anden); await vent(20);
  tjek('V-OPBYG.1 N4: et klik på Gemte erstatninger viser den åbne sags indhold i Sager (ingen sag åbnes eller lukkes)', synlige(d).join() === 'sager' && indholdVises(d) && rust.st.indholdKald.at(-1).id === null && !s.kald.some(k => ['sag_luk', 'sag_nulstil'].includes(k[0])) && indholdRaekker(d).length === 9 && !d.querySelector('section[data-visning="sager"] .sagindhold .bannere').textContent.includes('kun læst'));
  w.Grimnir.vis('demasker'); await vent(10);
  const dsek = d.querySelector('section[data-visning="demasker"]');
  tjek('V-OPBYG.1 N3: Demaskér: sætningen nævner sagen («Firewall-log»), og Åbn Sager er skjult (sagen har koder)', dsek.querySelector('.tomt p').textContent === 'Har du fået svar fra support eller en chatbot, sætter Grimnir de rigtige værdier tilbage med koderne i sagen «Firewall-log».' && dsek.querySelector('.tomt-ekstra').hidden && dsek.querySelector('.tomt-sag').textContent === 'Svaret bliver på denne maskine.');
  klik(w, d.getElementById('sagdel-erst')); await vent(20);
  tjek('V-OPBYG.1 N4: fra Demaskér viser Gemte erstatninger i venstre side sagens indhold', synlige(d).join() === 'sager' && indholdVises(d));
  w.Grimnir.vis('masker'); await vent(10);
  klik(w, d.getElementById('sag-knap')); await vent(5);
  klik(w, d.getElementById('sag-vis-indhold')); await vent(20);
  tjek('V-MANUEL.2 N1: sagens dialog i titellinjen har Vis indhold; den lukker dialogen og viser indholdet', !aaben(d, 'dlg-sag') && synlige(d).join() === 'sager' && indholdVises(d));
  // Den midlertidige sag uden navn.
  const s2 = side({ rust: falskSagRust() });
  await vent(10);
  indsaet(s2.w, s2.d.querySelector('section[data-visning="masker"] .tomt'), TEKST);
  await vent(5); // V-OPBYG.1 N3: analysen sker ved indsætning (før ⌘↵ første gang)
  s2.tast('Enter', { metaKey: true }); await vent(5);
  klik(s2.w, knapI(s2.d, 'masker', 'ryd')); await vent(5);
  const ok = s2.d.querySelector('dialog[open] .btn.danger, dialog[open] .btn.primary');
  if (ok) { klik(s2.w, [...s2.d.querySelectorAll('dialog[open] button')].find(b => b.textContent === 'Ryd') || ok); await vent(5); }
  const p2 = s2.d.querySelector('section[data-visning="masker"] .tomt .tomt-sag').textContent;
  tjek('V-OPBYG.1 N4: den midlertidige sag: "Du arbejder i en midlertidig sag med 3 gemte erstatninger …"', p2 === 'Du arbejder i en midlertidig sag med 3 gemte erstatninger. Giv den et navn, når du vil gemme den.', p2);
})();
await (async () => {
  // N1: panelet hedder "Fil · <navn>" for en åben fil.
  const rust = falskFilRust({ antal: 3 });
  const s = side({ rust });
  const { d, w } = s;
  await vent(5);
  klik(w, knapI(d, 'masker', 'aabn-fil')); await vent(20);
  const h = d.querySelector('section[data-visning="masker"] .tekstpanel h3');
  tjek('V-MANUEL.2 N1: for en åben fil hedder panelet "Fil · app.log" (ikke "Indsat tekst")', h.textContent === 'Fil · app.log' && h.closest('.panel').getAttribute('aria-label') === 'Filen app.log', h.textContent);
  w.Sprog.saet('en');
  tjek('V-MANUEL.2 N1 (English): "File · app.log"', h.textContent === 'File · app.log');
  w.Sprog.saet('da');
  indsaet(w, d.querySelector('section[data-visning="masker"] pre.tekst'), TEKST); await vent(5);
  tjek('V-MANUEL.2 N1: indsat tekst hedder stadig "Indsat tekst"', h.textContent === 'Indsat tekst');
})();
await (async () => {
  // N3: forslaget til et navnemønster: banner med Læg i ordbogen og Ikke nu; afvist kommer ikke igen for samme tekst.
  const rust = falskOrdbogRust({ indst: { guide_vist: true } });
  const analyser = rust.analyser;
  rust.analyser = a => { const x = analyser(a); const i = rust.ob.db.map(p => p.vaerdi); x.moenstre = [{ moenster: 'srv-*', navne: 3 }, { moenster: 'pc-*', navne: 2 }].filter(m => !i.includes(m.moenster)); return x; };
  const s = side({ rust });
  const { d, w } = s;
  await vent(20);
  const sek = d.querySelector('section[data-visning="masker"]');
  indsaet(w, sek.querySelector('.tomt'), TEKST);
  s.tast('Enter', { metaKey: true }); await vent(10);
  const forslag = () => sek.querySelector('.ban.moenster-forslag');
  tjek('V-MANUEL.2 N3: banneret foreslår det første mønster med antal og to knapper', forslag() && forslag().querySelector('.ord').textContent === '3 maskinnavne i teksten har formen srv-*. Læg mønsteret i ordbogen, så Grimnir finder navne af den form fremover.' && [...forslag().querySelectorAll('button')].map(b => b.textContent).join() === 'Læg i ordbogen,Ikke nu', forslag() && forslag().textContent);
  tjek('V-MANUEL.2 N3: banneret står over tabellen, ikke i den', forslag().closest('.bannere') && !forslag().closest('.tabelvaert'));
  klik(w, [...forslag().querySelectorAll('button')].find(b => b.textContent === 'Ikke nu')); await vent(5);
  tjek('V-MANUEL.2 N3: Ikke nu: det næste forslag vises (pc-*)', forslag() && forslag().querySelector('.ord').textContent.includes('formen pc-*'));
  const analyserFoer = s.kald.filter(k => k[0] === 'analyser').length;
  klik(w, [...forslag().querySelectorAll('button')].find(b => b.textContent === 'Læg i ordbogen')); await vent(20);
  tjek('V-MANUEL.2 N3: Læg i ordbogen lægger mønsteret i ordbogen som Navnemønster', s.kald.some(k => k[0] === 'ordbog_tilfoej' && k[1].type === 'navnemoenster' && k[1].vaerdi === 'pc-*' && k[1].note === null));
  tjek('V-MANUEL.2 N3: teksten analyseres igen med ordbogen, og intet forslag står tilbage (srv-* er afvist for denne tekst)', s.kald.filter(k => k[0] === 'analyser').length > analyserFoer && !forslag() && sek.querySelector('.besked').textContent === 'Mønsteret pc-* er lagt i ordbogen.', sek.querySelector('.besked').textContent);
  // En ny tekst: det afviste forslag kommer igen (det, der er lagt i ordbogen, gør ikke).
  indsaet(w, sek.querySelector('pre.tekst'), TEKST + 'x');
  s.tast('Enter', { metaKey: true }); await vent(10);
  tjek('V-MANUEL.2 N3: en ny tekst: srv-* foreslås igen; pc-* står i ordbogen og foreslås ikke', forslag() && forslag().querySelector('.ord').textContent.includes('formen srv-*') && rust.ob.db.some(p => p.type === 'navnemoenster' && p.vaerdi === 'pc-*'));
  s.tast('Enter', { metaKey: true }); await vent(10);
  tjek('V-MANUEL.2 N3: efter Gem og maskér står forslaget ikke (kun før)', !forslag());
  w.Sprog.saet('en');
  tjek('V-MANUEL.2 N3 (English): texts', w.Sprog.t('bMoenster', 2, 'pc-*') === '2 machine names in the text have the form pc-*. Add the pattern to the dictionary, and Grimnir finds names of that form from now on.' && w.Sprog.t('kIkkeNu') === 'Not now');
  w.Sprog.saet('da');
})();
await (async () => {
  // N1: lås med tabellen åben: siden genindlæses, og ingen værdier står i DOM'en bagefter.
  const rust = falskLaasRust({ svar: [{ svar: 'ok' }] });
  const s = side({ rust, hash: '#sager' });
  const { d, w } = s;
  await vent(30);
  klik(w, sagRaekke(d, hexId(7))); await vent(5);
  klik(w, knapI(d, 'sager', 'vis-indhold')); await vent(20);
  tjek('V-MANUEL.2 N1 (lås): kontrol: værdierne står i DOM\'en med tabellen åben', indholdVises(d) && /srv-opdigtet-0001/.test(altIDom(d)));
  rust.laasIgen('dvale');
  s.emit('laast', 'dvale'); await vent(10);
  tjek('V-MANUEL.2 N1 (lås): laast genindlæser siden', s.jsdomFejl.some(m => /navigation/.test(m)) && laaseskaerm(d));
  const g = side({ rust, hash: '#sager' });
  await vent(30);
  tjek('V-MANUEL.2 N1 (lås): efter genindlæsningen står ingen af værdierne i DOM\'en, og sag_indhold er ikke kaldt', laaseskaerm(g.d) && !/srv-opdigtet|bruger-0|Hemmelig-/.test(altIDom(g.d)) && !g.kald.some(k => k[0] === 'sag_indhold'));
  rust.st.kue.push({ svar: 'ok' });
  g.d.getElementById('laas-op').click(); await vent(30);
  tjek('V-MANUEL.2 N1 (lås): efter oplåsningen står listen, ikke indholdet (værdierne hentes først, når visningen åbnes)', !laaseskaerm(g.d) && !indholdVises(g.d) && !g.kald.some(k => k[0] === 'sag_indhold'));
})();

// ══════════════════════════ V-OPBYG.1 (D27): trin, næste skridt, status som resultat og den aktuelle sag ══════════════════════════
// Skitsen claude_cowork/shared/design/Grimnir-skitse-2026-11-13.dc.html. Ingen fast ventetid: testene venter på en tilstand i
// DOM'en (ventTil) med en grænse, der kun nås, når det ventede ikke sker. Kun opdigtede data.
const trinAf = (d, v) => [...d.querySelectorAll(`section[data-visning="${v}"] .trinvej li`)];
const trinTilstand = (d, v) => trinAf(d, v).map(l => (l.getAttribute('aria-current') === 'step' ? '*' : '') + l.querySelector('.trin-nr').textContent).join(' ');
const naesteI = (d, v) => [...d.querySelectorAll(`#baand > [data-visning="${v}"] .cb[data-naeste]`)].map(b => b.dataset.kommando).join();
await (async () => {
  // N3: tre trin i Maskér og Demaskér, det næste skridt fremhævet i båndet; N2: én besked efter Kopiér; N4: Gem som sag… tre steder.
  const skrevet = [];
  const rust = falskSagRust();
  const s = side({ rust, foer: w => Object.defineProperty(w.navigator, 'clipboard', { value: { writeText: async t => { skrevet.push(t); } }, configurable: true }) });
  const { d, w } = s;
  await ventTil(w, () => !laaseskaerm(d) && !d.getElementById('sag-knap').hidden);
  const sek = d.querySelector('section[data-visning="masker"]');
  const tv = sek.querySelector('.trinvej');
  tjek('V-OPBYG.1 N3: Maskér har tre trin øverst (en ordnet liste med navn, før værktøjslinjen): Sæt teksten ind, Gennemgå fundene, Maskér og kopiér', tv && tv.tagName === 'OL' && tv.getAttribute('aria-label') === 'Trin' && sek.firstElementChild === tv && trinAf(d, 'masker').map(l => l.querySelector('.trin-navn').textContent).join('|') === 'Sæt teksten ind|Gennemgå fundene|Maskér og kopiér');
  tjek('V-OPBYG.1 N3: trinene er vejledning, ikke knapper (ingen knap, link eller tabindex i listen)', !tv.querySelector('button, a, [tabindex]'));
  tjek('V-OPBYG.1 N3: uden tekst er trin 1 det aktuelle (aria-current="step", "trin 1 af 3, aktuelt" til skærmlæseren), og Indsæt er næste skridt i båndet', trinTilstand(d, 'masker') === '*1 2 3' && trinAf(d, 'masker')[0].querySelector('.skjult-tekst').textContent === ', trin 1 af 3, aktuelt' && trinAf(d, 'masker')[1].querySelector('.skjult-tekst').textContent === ', trin 2 af 3' && naesteI(d, 'masker') === 'indsaet');
  tjek('V-OPBYG.1 N3: den tomme flade: overskrift, sætningen, sagen (midlertidig), Indsæt tekst fremhævet, Åbn fil og linjen om ⌘V', sek.querySelector('.tomt-h').textContent === 'Sæt en log eller et script ind' && sek.querySelector('.tomt-p').textContent === 'Grimnir finder de følsomme værdier og viser dem, før noget bliver erstattet.' && sek.querySelector('.tomt-sag').textContent === 'Du arbejder i en midlertidig sag. Giv den et navn, når du vil gemme den.' && sek.querySelector('.tomt-handlinger .btn.primary').textContent === 'Indsæt tekst');
  // N4: venstre side med den midlertidige sag.
  const sd = id => d.getElementById(id);
  tjek('V-OPBYG.1 N4: venstre side: Aktuel sag, Midlertidig sag, Ikke gemt under et navn endnu, Gem som sag…, Gemte erstatninger 0 (slået fra med forklaring) og "Alt behandles på denne maskine"', sd('sagdel-h').textContent === 'Aktuel sag' && sd('sagdel-navn').textContent === 'Midlertidig sag' && sd('sagdel-status').textContent === 'Ikke gemt under et navn endnu' && !sd('sagdel-gem').hidden && sd('sagdel-gem').textContent === 'Gem som sag…' && sd('sagdel-erst').getAttribute('aria-disabled') === 'true' && sd('sagdel-erst').title === 'Sagen har ingen gemte erstatninger endnu' && sd('sagdel-antal').textContent === '0' && d.querySelector('.sagdel-lokalt').textContent === 'Alt behandles på denne maskine');
  klik(w, sd('sagdel-erst'));
  tjek('V-OPBYG.1 N4: Gemte erstatninger uden erstatninger gør intet', synlige(d).join() === 'masker');
  for (const v of ['demasker', 'sager', 'ordbog']) {
    w.Grimnir.vis(v);
    await ventTil(w, () => synlige(d).join() === v);
    tjek(`V-OPBYG.1 N4: ${v}: den aktuelle sag står også her (samme del af venstre side)`, !sd('sagdel').hidden && sd('sagdel').closest('nav.nav') && sd('sagdel-navn').textContent === 'Midlertidig sag');
  }
  w.Grimnir.vis('masker');
  await ventTil(w, () => synlige(d).join() === 'masker');
  // Indsæt: analysen går i gang (N3), trin 2 aktuelt, næste skridt Maskér, når analysen er der.
  indsaet(w, sek.querySelector('.tomt'), TEKST);
  tjek('V-OPBYG.1 N3: lige efter indsæt: trin 2 er aktuelt, trin 1 har flueben, og intet er næste skridt, mens Grimnir analyserer', trinTilstand(d, 'masker') === '✓ *2 3' && naesteI(d, 'masker') === '' && trinAf(d, 'masker')[0].querySelector('.skjult-tekst').textContent === ', trin 1 af 3, færdigt');
  await ventTil(w, () => Boolean(w.GrimnirMaskering.M.st.analyse) && !w.GrimnirMaskering.M.st.travl);
  tjek('V-OPBYG.1 N3: efter analysen er Maskér næste skridt (fremhævet i båndet; ikke kun farve: kant, flade og fed skrift i app.css)', naesteI(d, 'masker') === 'gem-masker' && CSS_REGLER.some(r => r.sel === '.cb[data-naeste]' && r.decl['border-color'] === 'var(--accent)' && r.decl['font-weight'] === '600'));
  // Maskér: trin 3, næste Kopiér maskeret tekst; beskeden med Gem som sag…
  klik(w, knapI(d, 'masker', 'gem-masker'));
  await ventTil(w, () => Boolean(w.GrimnirMaskering.M.st.resultat));
  tjek('V-OPBYG.1 N3: efter Maskér er trin 3 aktuelt, og Kopiér maskeret tekst er næste skridt', trinTilstand(d, 'masker') === '✓ ✓ *3' && naesteI(d, 'masker') === 'kopier');
  const banGem = sek.querySelector('.opsummering button');
  if (banGem) klik(w, banGem);
  tjek('V-OPBYG.1 N4: Gem som sag… i beskeden efter Maskér åbner dialogen Ny sag', banGem?.textContent === 'Gem som sag…' && aaben(d, 'dlg-ny-sag'));
  if (aaben(d, 'dlg-ny-sag')) d.querySelector('#dlg-ny-sag [data-svar="annuller"]').click();
  klik(w, sd('sagdel-gem'));
  tjek('V-OPBYG.1 N4: Gem som sag… i venstre side åbner dialogen Ny sag', aaben(d, 'dlg-ny-sag'));
  d.querySelector('#dlg-ny-sag [data-svar="annuller"]').click();
  klik(w, knapI(d, 'masker', 'kopier'));
  await ventTil(w, () => skrevet.length === 1 && trinTilstand(d, 'masker') === '✓ ✓ *✓');
  tjek('V-OPBYG.1 N3: efter Kopiér er alle tre trin færdige (trin 3 stadig aktuelt med flueben), og intet er næste skridt', trinTilstand(d, 'masker') === '✓ ✓ *✓' && naesteI(d, 'masker') === '' && trinAf(d, 'masker')[2].querySelector('.skjult-tekst').textContent === ', trin 3 af 3, aktuelt og færdigt');
  const ban = sek.querySelector('.opsummering');
  tjek('V-OPBYG.1 N2: én besked efter Kopiér: "Kopieret" og hvor teksten skal hen (og Gem som sag…, da sagen er midlertidig)', ban && ban.classList.contains('ok') && ban.querySelector('.ops-hoved').textContent === 'Kopieret' && ban.textContent.includes('Sæt teksten ind i din mail eller chat. Når du får svar, sætter du det ind under Demaskér.') && ban.querySelector('button')?.textContent === 'Gem som sag…' && sek.querySelectorAll('.arbejde .bannere .ban').length === 1);
  tjek('V-OPBYG.1 N4: efter maskeringen viser venstre side 3 gemte erstatninger (slået til)', sd('sagdel-antal').textContent === '3' && !sd('sagdel-erst').hasAttribute('aria-disabled'));
  // Gem som sag… i båndet under Sager; derefter er sagen navngiven.
  w.Grimnir.vis('sager');
  await ventTil(w, () => synlige(d).join() === 'sager');
  tjek('V-OPBYG.1 N4: Gem som sag… står først i Sagers bånd og er slået til for den midlertidige sag', knapI(d, 'sager', 'gem-som-sag').textContent.trim() === 'Gem som sag…' && kommandoAktiv(d, 'sager', 'gem-som-sag'));
  klik(w, knapI(d, 'sager', 'gem-som-sag'));
  tjek('V-OPBYG.1 N4: Gem som sag… i båndet åbner dialogen Ny sag (den samme som titellinjens), med de 3 værdier', aaben(d, 'dlg-ny-sag') && d.querySelector('#dlg-ny-sag .modal-tekst').textContent.includes('3 værdier'));
  skriv(w, d.getElementById('ny-sag-navn'), 'Firewallanalyse');
  klik(w, d.getElementById('ny-sag-opret'));
  await ventTil(w, () => sd('sagdel-navn').textContent === 'Firewallanalyse');
  tjek('V-OPBYG.1 N4: en navngiven sag: venstre side viser navnet og Gemmes automatisk (med flueben), Gem som sag… er væk; titellinjen siger "Sag: «Firewallanalyse» · gemmes automatisk"', sd('sagdel-status').textContent === 'Gemmes automatisk' && sd('sagdel-status').classList.contains('gemmes') && sd('sagdel-gem').hidden && d.getElementById('sag-knap').textContent === 'Sag: «Firewallanalyse» · gemmes automatisk' && s.kald.some(k => k[0] === 'sag_ny' && k[1].navn === 'Firewallanalyse'));
  tjek('V-OPBYG.1 N4: Gem som sag… i båndet er slået fra med forklaring, når sagen har et navn', !kommandoAktiv(d, 'sager', 'gem-som-sag') && forklaring(knapI(d, 'sager', 'gem-som-sag')) === 'Sagen har allerede et navn');
  w.Grimnir.vis('masker');
  await ventTil(w, () => synlige(d).join() === 'masker');
  tjek('V-OPBYG.1 N4: beskeden i Maskér har ikke længere Gem som sag… (sagen har et navn)', !sek.querySelector('.opsummering button'));
  // Demaskér: tre trin; næste Demaskér; efter demaskering Kopiér resultat; efter kopi færdig.
  w.Grimnir.vis('demasker');
  await ventTil(w, () => synlige(d).join() === 'demasker');
  const dsek = d.querySelector('section[data-visning="demasker"]');
  tjek('V-OPBYG.1 N3: Demaskér har tre trin (Sæt svaret ind, Demaskér, Kopiér resultatet); trin 1 aktuelt, Indsæt næste skridt', trinAf(d, 'demasker').map(l => l.querySelector('.trin-navn').textContent).join('|') === 'Sæt svaret ind|Demaskér|Kopiér resultatet' && trinTilstand(d, 'demasker') === '*1 2 3' && naesteI(d, 'demasker') === 'indsaet' && dsek.querySelector('.tomt-h').textContent === 'Sæt svaret ind' && dsek.querySelector('.tomt-handlinger .btn.primary').textContent === 'Indsæt svar');
  indsaet(w, dsek.querySelector('.tomt'), 'Prøv h0001\n');
  tjek('V-OPBYG.1 N3: Demaskér efter indsæt: trin 2 aktuelt, Demaskér næste skridt', trinTilstand(d, 'demasker') === '✓ *2 3' && naesteI(d, 'demasker') === 'demasker');
  klik(w, knapI(d, 'demasker', 'demasker'));
  await ventTil(w, () => trinTilstand(d, 'demasker') === '✓ ✓ *3');
  tjek('V-OPBYG.1 N3: Demaskér efter demaskering: trin 3 aktuelt, Kopiér resultat næste skridt', naesteI(d, 'demasker') === 'kopier-resultat');
  klik(w, knapI(d, 'demasker', 'kopier-resultat'));
  const kopieret = await ventTil(w, () => trinTilstand(d, 'demasker') === '✓ ✓ *✓');
  tjek('V-OPBYG.1 N3: Demaskér efter Kopiér: alle tre trin færdige, intet næste skridt', kopieret && naesteI(d, 'demasker') === '');
  // Engelsk
  w.Sprog.saet('en');
  tjek('V-OPBYG.1 (English): steps, the current case and the empty state follow the language', trinAf(d, 'demasker').map(l => l.querySelector('.trin-navn').textContent).join('|') === 'Paste the reply|Unmask|Copy the result' && trinAf(d, 'masker').map(l => l.querySelector('.trin-navn').textContent).join('|') === 'Paste the text|Review the findings|Mask and copy' && sd('sagdel-h').textContent === 'Current case' && sd('sagdel-status').textContent === 'Saved automatically' && d.querySelector('.sagdel-lokalt').textContent === 'Everything is processed on this machine' && d.getElementById('sag-knap').textContent === 'Case: “Firewallanalyse” · saved automatically' && knapI(d, 'sager', 'gem-som-sag').textContent.trim() === 'Save as case…');
  w.Sprog.saet('da');
})();
await (async () => {
  // N2 på engelsk: statusord, filtre og beskeden; N3: ⌘↵ efter indsæt maskerer (analysen er sket).
  const s = side({ rust: falskRust(), lager: { 'grimnir-sprog': 'en' } });
  const { d, w } = s;
  await ventTil(w, () => !laaseskaerm(d));
  const sek = d.querySelector('section[data-visning="masker"]');
  indsaet(w, sek.querySelector('.tomt'), TEKST);
  await ventTil(w, () => Boolean(w.GrimnirMaskering.M.st.analyse) && !w.GrimnirMaskering.M.st.travl);
  const r = fundRaekker(d);
  tjek('V-OPBYG.1 N2 (English): status To mask, Check yourself (!) and To keep; certainty dimmed by the type', r.map(x => x.querySelector('.chip').textContent).join('|') === '✓To mask|✓To mask|✓To mask|!Check yourself|–To keep' && r.map(x => x.querySelector('.sikkerhed').textContent).join('|') === 'Certain|Probable|Certain|Check yourself|Version' && r[4].querySelector('.erstatning.bevares').textContent === 'kept as it is', r.map(x => x.querySelector('.chip').textContent).join('|'));
  tjek('V-OPBYG.1 N2 (English): filters All findings, To mask, To keep, Needs review, Secrets, Known from the case', [...d.querySelectorAll('.navdel[data-visning="masker"] [data-punkt] > span:not(.ant)')].map(x => x.textContent).slice(1).join('|') === 'All findings|To mask|To keep|Needs review|Secrets|Known from the case');
  tjek('V-OPBYG.1 N2 (English): one message: "5 values found · 3 to mask · 2 to keep"', sek.querySelector('.opsummering .ops-hoved').textContent === '5 values found · 3 to mask · 2 to keep' && sek.querySelector('.opsummering').textContent.includes('One needs you to decide.'));
  s.tast('Enter', { metaKey: true });
  await ventTil(w, () => Boolean(w.GrimnirMaskering.M.st.resultat));
  tjek('V-OPBYG.1 N3: ⌘↵ efter indsæt maskerer (analysen er sket ved indsætningen; én analyse, én maskering)', s.kald.filter(k => k[0] === 'analyser').length === 1 && s.kald.filter(k => k[0] === 'gem_og_masker').length === 1 && sek.querySelector('.opsummering .ops-hoved').textContent === '3 values masked · 2 kept');
})();
await (async () => {
  // N4 låst: intet om sagen står synligt, og den aktuelle sag er inert, mens der er låst.
  const s = side({ rust: falskLaasRust({ svar: [{ svar: 'annulleret' }] }) });
  const { d, w } = s;
  await ventTil(w, () => d.getElementById('laas-besked').textContent.length > 0 && !d.getElementById('laas-op').disabled);
  tjek('V-OPBYG.1 N4 (låst): den aktuelle sag er inert og skjult (CSS), og titellinjen siger "Ingen sag åben"', laaseskaerm(d) && d.getElementById('sagdel').hasAttribute('inert') && CSS_REGLER.some(r => r.sel === 'html[data-laast] .sagdel' && r.decl.visibility === 'hidden') && !d.getElementById('sag').hidden && d.getElementById('sag-knap').hidden);
})();

await (async () => {
  // N5: Sager og Ordbog efter skitsen (kun tekster; ingen funktion ændret).
  const s = side({ rust: falskSagRust({ sager: SAGER() }) });
  const { d, w } = s;
  await ventTil(w, () => !laaseskaerm(d));
  w.Grimnir.vis('sager');
  await ventTil(w, () => synlige(d).join() === 'sager' && d.querySelectorAll('section[data-visning="sager"] .sagtabel tbody tr').length > 0);
  const ssek = d.querySelector('section[data-visning="sager"]');
  const fk = ssek.querySelector('.sag-forklaring');
  tjek('V-OPBYG.1 N5: Sager: kolonnen hedder Erstatninger, og under listen står forklaringen (hvad en sag husker, at loggen ikke gemmes, og hvornår sagen gemmes)', [...ssek.querySelectorAll('.sagtabel thead th')].map(t => t.textContent)[1] === 'Erstatninger' && fk && fk.previousElementSibling.classList.contains('tabelvaert') && fk.textContent.startsWith('En sag husker, hvilken kode der hører til hvilken værdi, så du kan demaskere svaret senere. Selve loggen gemmes ikke. En sag med navn gemmes automatisk'));
  w.Grimnir.vis('ordbog');
  await ventTil(w, () => synlige(d).join() === 'ordbog');
  const of = d.querySelector('section[data-visning="ordbog"] .ordbog-forklaring');
  tjek('V-OPBYG.1 N5: Ordbog: forklaringen står øverst (før tabellen)', of && of.parentElement.firstElementChild === of && of.textContent === 'Ordbogen er det, Grimnir altid skal finde, uanset sag: dine domæner, dine net og formen på dine maskinnavne. Den ligger krypteret på denne maskine.');
  w.Sprog.saet('en');
  tjek('V-OPBYG.1 N5 (English): Replacements, and both explanations follow the language', [...ssek.querySelectorAll('.sagtabel thead th')].map(t => t.textContent)[1] === 'Replacements' && fk.textContent.startsWith('A case remembers which code') && of.textContent.startsWith('The dictionary is what Grimnir must always find'));
  w.Sprog.saet('da');
})();

await (async () => {
  // N7: Vejledning og Lås i titellinjen.
  const rust = falskLaasRust({ svar: [{ svar: 'annulleret' }, { svar: 'ok' }] });
  rust.vejledning_aabn = () => null;
  rust.laas_nu = () => null;
  const s = side({ rust });
  const { d, w } = s;
  await ventTil(w, () => d.getElementById('laas-besked').textContent.length > 0 && !d.getElementById('laas-op').disabled);
  const vj = d.getElementById('vejledning'), ln = d.getElementById('laas-nu');
  tjek('V-OPBYG.1 N7: Vejledning og Lås står i titellinjen som titellinjeknapper med ord (Vejledning med pil i CSS, navne til skærmlæseren)', vj.classList.contains('rk') && vj.textContent === 'Vejledning' && vj.getAttribute('aria-label') === 'Vejledning: åbn Grimnirs vejledning i browseren' && vj.title.includes('Grimnir sender intet med') && ln.classList.contains('rk') && ln.textContent === 'Lås' && ln.getAttribute('aria-label') === 'Lås Grimnir nu' && CSS_REGLER.some(r => r.sel === '#vejledning::after' && /↗/.test(r.decl.content)));
  tjek('V-OPBYG.1 N7 (låst): Lås er slået fra, og titellinjen er ikke inert', laaseskaerm(d) && ln.disabled && !d.querySelector('header.titel').closest('[inert]'));
  klik(w, vj);
  await ventTil(w, () => s.kald.some(k => k[0] === 'vejledning_aabn'));
  const vk = s.kald.filter(k => k[0] === 'vejledning_aabn');
  tjek('V-OPBYG.1 N7: Vejledning virker også, mens Grimnir er låst, og sender kun sproget (vejledning_aabn { sprog: "da" })', vk.length === 1 && JSON.stringify(vk[0][1]) === '{"sprog":"da"}');
  klik(w, ln);
  tjek('V-OPBYG.1 N7 (låst): et klik på Lås gør intet', !s.kald.some(k => k[0] === 'laas_nu'));
  s.tast('Enter');
  await ventTil(w, () => !laaseskaerm(d));
  tjek('V-OPBYG.1 N7: låst op: Lås er slået til', !laaseskaerm(d) && !ln.disabled);
  klik(w, ln);
  await ventTil(w, () => s.kald.some(k => k[0] === 'laas_nu'));
  tjek('V-OPBYG.1 N7: Lås kalder laas_nu (uden argumenter; Rust låser ad samme vej som ved stilstand og melder laast)', s.kald.filter(k => k[0] === 'laas_nu').length === 1 && JSON.stringify(s.kald.find(k => k[0] === 'laas_nu')[1]) === '{}');
  s.emit('laast', 'bruger');
  tjek('V-OPBYG.1 N7: hændelsen laast efter Lås: siden står låst og genindlæses som ved enhver lås', laaseskaerm(d) && s.jsdomFejl.some(x => /navigation/.test(x)));
  w.Sprog.saet('en');
  klik(w, vj);
  await ventTil(w, () => s.kald.filter(k => k[0] === 'vejledning_aabn').length === 2);
  tjek('V-OPBYG.1 N7 (English): Guide and Lock, and the guide is asked for in English (sprog: "en")', vj.textContent === 'Guide' && ln.textContent === 'Lock' && JSON.stringify(s.kald.filter(k => k[0] === 'vejledning_aabn')[1][1]) === '{"sprog":"en"}');
  w.Sprog.saet('da');
})();
await (async () => {
  // N7: kan vejledningen ikke åbnes, står det i et banner under titellinjen (det kan lukkes).
  const s = side({ rust: { vejledning_aabn: () => { throw 'kunne_ikke_aabne'; } } });
  const { d, w } = s;
  await ventTil(w, () => !laaseskaerm(d));
  klik(w, d.getElementById('vejledning'));
  const ban = await ventTil(w, () => Boolean(d.querySelector('#laas-banner .ban[data-vejledning]')));
  tjek('V-OPBYG.1 N7: Vejledning, der ikke kan åbnes: et banner under titellinjen siger det og kan lukkes', ban && d.querySelector('#laas-banner .ban[data-vejledning]').textContent.includes('Vejledningen kunne ikke åbnes i browseren.'));
  klik(w, d.querySelector('#laas-banner .ban[data-vejledning] button'));
  tjek('V-OPBYG.1 N7: … og Luk fjerner banneret', !d.querySelector('#laas-banner .ban[data-vejledning]'));
})();

// ══════════════════════════ V-OPBYG.2: Noter, linjenumre og markering, fodlinje og startvindue ══════════════════════════
// Efterlignet Rust for noterne (felterne som NoterUd og NoteUd i src-tauri/src/maskering.rs; fejlene som UiFejl::Note) oven på
// falskSagRust. Tidspunkterne er kl. 12 UTC, så datoen er den samme i enhver tidszone fra −11 til +11. Kun opdigtede data.
const NOTE_MS = Date.UTC(2026, 10, 13, 12, 0);
function falskNoterRust({ noter = [], sager = [] } = {}) {
  const r = falskSagRust({ sager });
  let liste = noter.map(n => ({ rettet: null, ...n }));
  let taeller = Math.max(0, ...liste.map(n => n.nr));
  let nu = NOTE_MS + 3600000;
  const kald = [];
  const navn = () => (r.st.aaben ? r.st.db.find(x => x.id === r.st.aaben).navn : null);
  const ud = nr => ({ id: r.st.aaben, navn: navn(), noter: liste.map(n => ({ ...n })), nr: nr == null ? null : nr, maks_tegn: 4000, maks_antal: 200 });
  const tjekTekst = t => { if (!t || !t.trim()) throw { art: 'note', hvad: 'tom', maks: 0 }; if ([...t].length > 4000) throw { art: 'note', hvad: 'for_lang', maks: 4000 }; };
  Object.defineProperty(r.st, 'noter', { get: () => liste });
  r.st.noteKald = kald;
  return {
    ...r,
    sag_status: () => ({ ...r.sag_status(), noter: liste.length }),
    noter_hent: () => { kald.push(['noter_hent']); return ud(); },
    note_tilfoej: ({ tekst }) => { kald.push(['note_tilfoej', tekst]); tjekTekst(tekst); liste.push({ nr: ++taeller, tekst, oprettet: nu += 60000, rettet: null }); return ud(taeller); },
    note_ret: ({ nr, tekst }) => { kald.push(['note_ret', nr, tekst]); tjekTekst(tekst); const n = liste.find(x => x.nr === nr); if (!n) throw { art: 'note', hvad: 'ukendt', maks: 0 }; n.tekst = tekst; n.rettet = nu += 60000; return ud(nr); },
    note_slet: ({ nr }) => { kald.push(['note_slet', nr]); const i = liste.findIndex(x => x.nr === nr); if (i < 0) throw { art: 'note', hvad: 'ukendt', maks: 0 }; liste.splice(i, 1); if (!liste.length) taeller = 0; return ud(); },
    udklip_kopieret: a => { kald.push(['udklip_kopieret', a]); return true; },
  };
}
const TO_NOTER = () => [
  { nr: 1, tekst: 'Sendt den maskerede log til leverandøren (opdigtet sag 4471).', oprettet: NOTE_MS },
  { nr: 2, tekst: 'De beder om loggen fra fw-syd02.\nHusk samme sag.', oprettet: NOTE_MS + 1800000, rettet: NOTE_MS + 2400000 },
];
const noteLi = d => [...d.querySelectorAll('section[data-visning="noter"] .noteliste[role="listbox"] li.note')];
const tidDa = ms => new Date(ms).toLocaleString('da-DK', { dateStyle: 'long', timeStyle: 'short' });
const tast2 = (w, el, key, x = {}) => { const e = new w.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...x }); el.dispatchEvent(e); return e; };

// ── N2: fanen Noter: forklaring, liste, valg med mus og tastatur, båndet, ny, ret, slet, ⌘↵, fejl ──
await (async () => {
  const rust = falskNoterRust({ noter: TO_NOTER() });
  const skrevet = [];
  const s = side({ hash: '#noter', rust, foer: w => Object.defineProperty(w.navigator, 'clipboard', { value: { writeText: async t => { skrevet.push(t); } }, configurable: true }) });
  const { d, w } = s;
  await ventTil(w, () => noteLi(d).length === 2);
  const sek = d.querySelector('section[data-visning="noter"]');
  tjek('V-OPBYG.2 N2: fanen Noter står mellem Demaskér og Sager og er åben (#noter)', synlige(d).join() === 'noter' && [...d.querySelectorAll('#baand > [data-visning="noter"] .vk')].map(a => a.dataset.visning).join() === VIS.join());
  tjek('V-OPBYG.2 N2: noterne hentes fra Rust, når fanen åbnes (noter_hent)', rust.st.noteKald.some(k => k[0] === 'noter_hent'));
  const ban = sek.querySelector('.bannere .ban.info .ord');
  tjek('V-OPBYG.2 N2: forklaringen for den midlertidige sag: noterne følger med, når sagen gemmes under et navn, og kommer aldrig med i den maskerede tekst eller kvitteringen', ban && ban.textContent === 'Noterne hører til den midlertidige sag. De følger med, når sagen gemmes under et navn, og kommer aldrig med i den maskerede tekst eller kvitteringen.', ban && ban.textContent);
  const li = noteLi(d);
  tjek('V-OPBYG.2 N2: listen er en liste (role="listbox" med navn), hver note en option; i tidsorden; én er et Tab-stop', sek.querySelector('.noteliste').getAttribute('aria-label') === 'Noter' && li.every(x => x.getAttribute('role') === 'option' && x.getAttribute('aria-selected') === 'false') && li.map(x => x.dataset.nr).join() === '1,2' && li.filter(x => x.tabIndex === 0).length === 1);
  tjek('V-OPBYG.2 N2: dato og klokkeslæt i sprogets format; en rettet note siger "rettet <tidspunkt>"; linjeskift står, som de er skrevet', li[0].querySelector('.note-tid').textContent === tidDa(NOTE_MS) && /^13\. november 2026/.test(li[0].querySelector('.note-tid').textContent) && li[1].querySelector('.note-tid').textContent === tidDa(NOTE_MS + 1800000) + ' · rettet ' + tidDa(NOTE_MS + 2400000) && li[1].querySelector('.note-tekst').textContent === 'De beder om loggen fra fw-syd02.\nHusk samme sag.', li.map(x => x.querySelector('.note-tid').textContent).join(' | '));
  const ret = knapI(d, 'noter', 'ret-note'), slet = knapI(d, 'noter', 'slet-note');
  tjek('V-OPBYG.2 N2: uden et valg er Ret note og Slet note slået fra med forklaringen "Vælg en note først"; Ny note og Kopiér noterne virker', !kommandoAktiv(d, 'noter', 'ret-note') && !kommandoAktiv(d, 'noter', 'slet-note') && forklaring(ret) === 'Vælg en note først' && forklaring(slet) === 'Vælg en note først' && kommandoAktiv(d, 'noter', 'ny-note') && kommandoAktiv(d, 'noter', 'kopier-noter'));
  klik(w, li[0]);
  tjek('V-OPBYG.2 N2: et klik vælger noten (aria-selected, fokus, Tab-stop), og Ret note og Slet note bliver slået til', li[0].getAttribute('aria-selected') === 'true' && d.activeElement === li[0] && li[0].tabIndex === 0 && li[1].tabIndex === -1 && kommandoAktiv(d, 'noter', 'ret-note') && kommandoAktiv(d, 'noter', 'slet-note'));
  tast2(w, li[0], 'ArrowDown');
  tjek('V-OPBYG.2 N2: pil ned flytter valget og fokus til næste note', d.activeElement === li[1] && li[1].getAttribute('aria-selected') === 'true' && li[0].getAttribute('aria-selected') === 'false');
  tast2(w, li[1], 'Home');
  tjek('V-OPBYG.2 N2: Home går til den første note (End til den sidste)', d.activeElement === li[0] && (tast2(w, li[0], 'End'), d.activeElement === li[1]));
  // Ny note: båndet sætter fokus i feltet; ⌘↵ gemmer.
  klik(w, knapI(d, 'noter', 'ny-note'));
  const ta = d.getElementById('note-tekst');
  tjek('V-OPBYG.2 N2: Ny note sætter fokus i feltet Ny note (et almindeligt textarea med etiket og skitsens hjælpetekst; ⌘↵ står under det)', d.activeElement === ta && ta.tagName === 'TEXTAREA' && d.querySelector('label[for="note-tekst"]').textContent === 'Ny note' && ta.placeholder === 'Hvem har du sendt loggen til, hvad svarede de, og hvad mangler du at følge op på?' && d.getElementById('note-hj').textContent === '⌘↵ gemmer noten.');
  ta.value = 'Ringet til leverandøren.\r\nVenter på svar.';
  tast2(w, ta, 'Enter', { metaKey: true });
  await ventTil(w, () => noteLi(d).length === 3);
  // Et textarea giver linjeskift som LF (HTML: feltets værdi normaliserer CRLF); de gemmes, som feltet giver dem.
  tjek('V-OPBYG.2 N2: ⌘↵ i feltet gemmer noten (note_tilfoej med teksten, linjeskift som feltet giver dem); feltet tømmes, og fokus bliver i feltet', JSON.stringify(rust.st.noteKald.find(k => k[0] === 'note_tilfoej')) === JSON.stringify(['note_tilfoej', 'Ringet til leverandøren.\nVenter på svar.']) && ta.value === '' && d.activeElement === ta);
  tjek('V-OPBYG.2 N2: den nye note er valgt, og venstre side siger Noter 3', noteLi(d)[2].getAttribute('aria-selected') === 'true' && d.getElementById('sagdel-noter-antal').textContent === '3' && d.getElementById('sagdel-noter').getAttribute('aria-label') === 'Noter: 3. Åbn fanen Noter');
  // Gem note med knappen; en tom note afvises med en fejl ved feltet.
  ta.value = '   ';
  klik(w, d.getElementById('note-gem'));
  await ventTil(w, () => !d.getElementById('note-fejl').hidden);
  tjek('V-OPBYG.2 N2: en tom note afvises med en fejl ved feltet (role="alert", aria-invalid), og intet er tilføjet', d.getElementById('note-fejl').textContent === 'Skriv noget i noten først.' && d.getElementById('note-fejl').getAttribute('role') === 'alert' && ta.getAttribute('aria-invalid') === 'true' && noteLi(d).length === 3);
  ta.value = 'x'.repeat(4001);
  ta.dispatchEvent(new w.Event('input', { bubbles: true }));
  tjek('V-OPBYG.2 N2: fejlen forsvinder, når der skrives i feltet', d.getElementById('note-fejl').hidden && !ta.hasAttribute('aria-invalid'));
  klik(w, d.getElementById('note-gem'));
  await ventTil(w, () => !d.getElementById('note-fejl').hidden);
  tjek('V-OPBYG.2 N2: en for lang note: "Noten er for lang: højst 4000 tegn."', d.getElementById('note-fejl').textContent === 'Noten er for lang: højst 4000 tegn.', d.getElementById('note-fejl').textContent);
  // Ret: den ugemte tekst bliver stående og kommer igen efter rettelsen.
  ta.value = 'Ugemt kladde';
  klik(w, noteLi(d)[0]);
  klik(w, knapI(d, 'noter', 'ret-note'));
  tjek('V-OPBYG.2 N2: Ret note åbner noten i feltet (etiketten Ret note, knapperne Gem og Annullér)', ta.value === TO_NOTER()[0].tekst && d.querySelector('label[for="note-tekst"]').textContent === 'Ret note' && !d.getElementById('note-annuller').hidden && d.getElementById('note-gem').textContent.trim() === 'Gem' && d.activeElement === ta);
  tast2(w, ta, 'Escape');
  tjek('V-OPBYG.2 N2: Esc (som Annullér) lægger den ugemte tekst tilbage og sætter fokus på noten', ta.value === 'Ugemt kladde' && d.querySelector('label[for="note-tekst"]').textContent === 'Ny note' && d.getElementById('note-annuller').hidden && d.activeElement === noteLi(d)[0]);
  klik(w, knapI(d, 'noter', 'ret-note'));
  ta.value = 'Sendt til leverandøren, rettet';
  klik(w, d.getElementById('note-gem'));
  await ventTil(w, () => noteLi(d)[0].querySelector('.note-tekst').textContent === 'Sendt til leverandøren, rettet');
  tjek('V-OPBYG.2 N2: Gem retter noten (note_ret med nummer og tekst); den viser "rettet <tidspunkt>", og den ugemte tekst står i feltet igen', JSON.stringify(rust.st.noteKald.filter(k => k[0] === 'note_ret').at(-1)) === JSON.stringify(['note_ret', 1, 'Sendt til leverandøren, rettet']) && / · rettet /.test(noteLi(d)[0].querySelector('.note-tid').textContent) && ta.value === 'Ugemt kladde' && d.activeElement === noteLi(d)[0]);
  // Slet: kittets bekræftelse med fokus på Annullér.
  klik(w, knapI(d, 'noter', 'slet-note'));
  await ventTil(w, () => aaben(d, 'dlg-slet-note'));
  const dlg = d.getElementById('dlg-slet-note');
  tjek('V-OPBYG.2 N2: Slet note spørger med kittets bekræftelse (farlig), fokus på Annullér, og nævner notens tidspunkt', aaben(d, 'dlg-slet-note') && d.activeElement && d.activeElement.textContent.trim() === 'Annullér' && dlg.querySelector('.modal-tekst').textContent === `Noten fra ${tidDa(NOTE_MS)} slettes fra sagen. Det kan ikke fortrydes.`);
  klik(w, d.activeElement);
  await ventTil(w, () => !aaben(d, 'dlg-slet-note'));
  tjek('V-OPBYG.2 N2: Annullér sletter intet', !rust.st.noteKald.some(k => k[0] === 'note_slet') && noteLi(d).length === 3);
  klik(w, knapI(d, 'noter', 'slet-note'));
  await ventTil(w, () => aaben(d, 'dlg-slet-note'));
  klik(w, [...d.getElementById('dlg-slet-note').querySelectorAll('button')].find(b => b.textContent.trim() === 'Slet note'));
  await ventTil(w, () => noteLi(d).length === 2);
  tjek('V-OPBYG.2 N2: Slet note sletter (note_slet med nummeret), og den næste note er valgt', JSON.stringify(rust.st.noteKald.find(k => k[0] === 'note_slet')) === JSON.stringify(['note_slet', 1]) && noteLi(d)[0].getAttribute('aria-selected') === 'true' && d.getElementById('sagdel-noter-antal').textContent === '2');
  // Kopiér noterne: teksten med tidspunkterne; Rust får besked (D21).
  klik(w, knapI(d, 'noter', 'kopier-noter'));
  await ventTil(w, () => rust.st.noteKald.some(k => k[0] === 'udklip_kopieret'));
  tjek('V-OPBYG.2 N2: Kopiér noterne lægger sagens navn, tidspunkterne og noterne i udklipsholderen og melder det til Rust (udklip_kopieret med noter: true)', skrevet.length === 1 && skrevet[0].startsWith('Noter · Midlertidig sag\n\n') && skrevet[0].includes('De beder om loggen fra fw-syd02.\nHusk samme sag.') && skrevet[0].includes('Ringet til leverandøren.\nVenter på svar.') && JSON.stringify(rust.st.noteKald.find(k => k[0] === 'udklip_kopieret')[1]) === '{"fil":false,"noter":true}');
  tjek('V-OPBYG.2 N2: … og en besked siger, at Grimnir rydder dem ved lås og afslutning', [...sek.querySelectorAll('.bannere .ban.ok .ord')].some(b => /rydder Grimnir dem, når den låser, og når du lukker den/.test(b.textContent)));
  // Søgning i noterne.
  skriv(w, d.querySelector('section[data-visning="noter"] .vl input'), 'fw-syd02');
  tjek('V-OPBYG.2 N2: søgningen viser kun de noter, der indeholder teksten', noteLi(d).length === 1 && noteLi(d)[0].dataset.nr === '2');
  skriv(w, d.querySelector('section[data-visning="noter"] .vl input'), '');
  // Faneskift: noterne fjernes fra DOM'en; den ugemte tekst bliver stående; tilbage hentes de igen.
  const foerHent = rust.st.noteKald.filter(k => k[0] === 'noter_hent').length;
  w.location.hash = 'masker';
  await visningSkift(w, 'masker');
  tjek('V-OPBYG.2 N2: en anden fane fjerner noternes tekst fra DOM\'en, men den ugemte tekst i feltet bliver stående', noteLi(d).length === 0 && !d.querySelector('section[data-visning="noter"]').textContent.includes('fw-syd02') && ta.value === 'Ugemt kladde');
  s.tast('3', { metaKey: true, code: 'Digit3' });
  await ventTil(w, () => noteLi(d).length === 2);
  tjek('V-OPBYG.2 N2: ⌘3 åbner Noter igen, og noterne hentes på ny fra Rust', synlige(d).join() === 'noter' && rust.st.noteKald.filter(k => k[0] === 'noter_hent').length === foerHent + 1);
  // English.
  w.Sprog.saet('en');
  tjek('V-OPBYG.2 N2 (English): Notes, New note, Edit note, Delete note, Copy the notes; the explanation and the time in English', knapI(d, 'noter', 'ny-note').textContent.trim() === 'New note' && knapI(d, 'noter', 'ret-note').textContent.trim() === 'Edit note' && knapI(d, 'noter', 'slet-note').textContent.trim() === 'Delete note' && knapI(d, 'noter', 'kopier-noter').textContent.trim() === 'Copy the notes' && sek.querySelector('.bannere .ban.info .ord').textContent.startsWith('The notes belong to the temporary case.') && /13 November 2026/.test(noteLi(d)[1].querySelector('.note-tid').textContent), noteLi(d)[1].querySelector('.note-tid').textContent);
  w.Sprog.saet('da');
  // En dialog åben: Ny note og ⌘1 gør intet bag dialogen (som de andre faner).
  d.getElementById('aabn-indst').click();
  s.tast('1', { metaKey: true, code: 'Digit1' });
  tjek('V-OPBYG.2 N2: med en dialog åben skifter ⌘1 ikke fanen', synlige(d).join() === 'noter' && aaben(d, 'dlg-indst'));
  d.querySelector('#dlg-indst [data-svar="luk"]').click();
})();
await (async () => {
  // Tom tilstand og en navngiven sag.
  const rust = falskNoterRust({ sager: [{ id: hexId(1), navn: 'Supportsag 0042', poster: 3 }] });
  rust.sag_aabn({ id: hexId(1) });
  const s = side({ hash: '#noter', rust });
  const { d, w } = s;
  await ventTil(w, () => !d.querySelector('section[data-visning="noter"] .tomt').hidden);
  const tom = d.querySelector('section[data-visning="noter"] .tomt');
  tjek('V-OPBYG.2 N2: uden noter står kittets tomme tilstand med én sætning og Ny note som handling', tom.querySelector('h2').textContent === 'Ingen noter endnu' && (tom.querySelector('p').textContent.match(/[.]\s/g) || []).length === 0 && d.getElementById('note-tom-ny').textContent.trim() === 'Ny note' && !kommandoAktiv(d, 'noter', 'kopier-noter') && forklaring(knapI(d, 'noter', 'kopier-noter')) === 'Sagen har ingen noter endnu');
  klik(w, d.getElementById('note-tom-ny'));
  tjek('V-OPBYG.2 N2: Ny note i den tomme tilstand viser feltet med fokus', d.activeElement === d.getElementById('note-tekst') && !d.querySelector('section[data-visning="noter"] .arbejde.noter').hidden);
  const ban = d.querySelector('section[data-visning="noter"] .bannere .ban.info .ord');
  tjek('V-OPBYG.2 N2: forklaringen for en navngiven sag nævner sagen', ban && ban.textContent === 'Noterne hører til sagen «Supportsag 0042». De gemmes krypteret sammen med sagen og kommer aldrig med i den maskerede tekst eller kvitteringen.', ban && ban.textContent);
  tjek('V-OPBYG.2 N4: fodlinjen siger sagens navn og antallet af gemte erstatninger', d.getElementById('fod-venstre').textContent === 'Supportsag 0042 · 3 gemte erstatninger', d.getElementById('fod-venstre').textContent);
})();
await (async () => {
  // Låst: intet hentes; fanen er inert; efter oplåsningen hentes noterne.
  // Første svar (annulleret) bruges af UI'ets eget laas_op ved start; Enter giver ok.
  const rust = { ...falskNoterRust({ noter: TO_NOTER() }), ...falskLaasRust({ svar: [{ svar: 'annulleret' }, { svar: 'ok' }] }) };
  const nr = falskNoterRust({ noter: TO_NOTER() });
  for (const k of ['noter_hent', 'note_tilfoej', 'note_ret', 'note_slet']) rust[k] = nr[k];
  const s = side({ hash: '#noter', rust });
  const { d, w } = s;
  await vent(20);
  tjek('V-OPBYG.2 N2 (låst): intet hentes, mens Grimnir er låst, og intet fra noterne står i DOM\'en', laaseskaerm(d) && !nr.st.noteKald.length && noteLi(d).length === 0 && !d.documentElement.textContent.includes('leverandøren'));
  s.tast('Enter');
  await ventTil(w, () => noteLi(d).length === 2);
  tjek('V-OPBYG.2 N2 (låst op): står fanen Noter åben, hentes noterne lige efter oplåsningen', !laaseskaerm(d) && nr.st.noteKald.filter(k => k[0] === 'noter_hent').length === 1, JSON.stringify([laaseskaerm(d), nr.st.noteKald, noteLi(d).length]));
})();

// ── N1/N2: venstre side, Sagers kolonne Noter, sagens indhold og spørgsmålet ved en midlertidig sag med noter ──
await (async () => {
  const sager = [{ id: hexId(1), navn: 'Supportsag 0042', poster: 214, noter: 3 }, { id: hexId(2), navn: 'Backup-script', poster: 17, noter: 0 }];
  const rust = falskNoterRust({ noter: [TO_NOTER()[0]], sager });
  const indhold = rust.sag_indhold;
  rust.sag_indhold = a => ({ ...indhold(a), noter: a.id === hexId(1) ? TO_NOTER() : [] });
  const s = side({ hash: '#sager', rust });
  const { d, w } = s;
  await ventTil(w, () => sagRaekker(d).length === 2);
  tjek('V-OPBYG.2 N2: venstre side: "Noter 1" under Gemte erstatninger (i alle faner)', d.getElementById('sagdel-noter').textContent === 'Noter1' && d.getElementById('sagdel-erst').nextElementSibling === d.getElementById('sagdel-noter'));
  tjek('V-OPBYG.2 N1: Sagers kolonne Noter viser antallet pr. sag (fra listen; ingen sag åbnes)', sagRaekke(d, hexId(1)).children[2].textContent === '3' && sagRaekke(d, hexId(2)).children[2].textContent === '0' && !rust.st.indholdKald.length);
  sagRaekke(d, hexId(1)).dispatchEvent(new w.MouseEvent('dblclick', { bubbles: true }));
  await ventTil(w, () => Boolean(d.querySelector('.noter-laes')));
  const laes = d.querySelector('.noter-laes');
  tjek('V-OPBYG.2 N1: sagens indhold for en anden sag viser dens noter under erstatningerne, kun til at læse (ingen liste med valg, ingen knapper)', laes && laes.previousElementSibling && laes.previousElementSibling.matches('.indholdtabel, .tabel-tom, table') && laes.querySelectorAll('li.note').length === 2 && !laes.querySelector('[role="listbox"], [role="option"], button') && laes.querySelector('h4').textContent === 'Noter' && laes.textContent.includes('Husk samme sag.'));
  klik(w, d.getElementById('indhold-tilbage'));
  klik(w, d.getElementById('sagdel-noter'));
  await ventTil(w, () => synlige(d).join() === 'noter');
  tjek('V-OPBYG.2 N2: et klik på Noter i venstre side åbner fanen Noter', synlige(d).join() === 'noter');
  // En midlertidig sag med kun noter: før en anden sag åbnes, spørges der (D21).
  w.location.hash = 'sager';
  await ventTil(w, () => sagRaekker(d).length === 2);
  klik(w, sagRaekke(d, hexId(2)));
  klik(w, knapI(d, 'sager', 'aabn-i-masker'));
  await ventTil(w, () => aaben(d, 'dlg-kasser'));
  tjek('V-OPBYG.2 N1 (D21): en midlertidig sag med noter (og ingen værdier) spørges der om, før en anden sag åbnes, og teksten nævner noterne', aaben(d, 'dlg-kasser') && d.querySelector('#dlg-kasser .modal-tekst').textContent === 'Den midlertidige sag har 0 værdier og 1 note, som kun ligger i hukommelsen. Kasserer du den, går noterne tabt, og svar med dens koder kan ikke demaskeres.', d.querySelector('#dlg-kasser .modal-tekst').textContent);
})();

// ── N3: linjenumre og markering (CSS.highlights efterlignet: et Map og en Highlight-klasse, som i WebKit) ──
const NTEKST = 'login fra pc-0042 til srv-web01\r\nbackup kørt af backup-bruger på srv-web01\rx\nsrv-web01 genstartet 🙂\n';
function falskMarkRust() {
  const R = [
    { id: 10, art: 'vaert', status: 'sikker', standard: true, vaerdier: ['pc-0042'], koder: ['h0002'] },
    { id: 22, art: 'vaert', status: 'sikker', standard: true, vaerdier: ['srv-web01'], koder: ['h0001'] },
    { id: 33, art: 'ord', status: 'tjek', standard: false, vaerdier: ['backup'], koder: ['ord0001'] },
  ];
  const steder = (t, v) => { const ud = []; for (const [r, x] of v) { let i = -1; while ((i = t.indexOf(x, i + 1)) !== -1) ud.push([i, i + x.length, r.id]); } return ud.sort((a, b) => a[0] - b[0] || a[1] - b[1]); };
  const kald = [];
  let svar = null;
  return {
    kald,
    vent(fn) { svar = fn; },
    analyser: a => {
      kald.push(['analyser', a]);
      const raekker = R.map(r => ({ ...r, laast: false, hemmelig: false, antal: a.tekst.split(r.vaerdier[0]).length - 1, linje: 1, rettet: false, kendt: false, tilfoejet: null, valgt: a.fravalgt == null ? r.standard : !a.fravalgt.includes(r.id) }));
      const ud = { raekker, fejl: [], advarsler: [], bytes: a.tekst.length, linjer: 4, moenstre: [], tilfoejede: [], steder: steder(a.tekst, R.map(r => [r, r.vaerdier[0]])) };
      return svar ? new Promise(ok => { const f = svar; svar = null; f(() => ok(ud)); }) : ud;
    },
    gem_og_masker: a => { let m = a.tekst; const v = R.filter(r => !a.fravalgt.includes(r.id)); for (const r of v) m = m.split(r.vaerdier[0]).join(r.koder[0]); return { maskeret: m, rester: [], advarsler: [], poster: v.length, steder: steder(m, v.map(r => [r, r.koder[0]])) }; },
    sag_status: () => ({ poster: 0 }),
  };
}
const hlFoer = w => { w.CSS = { highlights: new Map() }; w.Highlight = class Highlight extends Set { constructor(...r) { super(r); this.priority = 0; } }; };
const hl = (w, navn) => { const h = w.CSS.highlights.get(navn); return h ? [...h].map(r => r.startContainer.data.slice(r.startOffset, r.endOffset)) : []; };
await (async () => {
  const rust = falskMarkRust();
  const s = side({ rust, foer: hlFoer });
  const { d, w } = s;
  await ventTil(w, () => !laaseskaerm(d));
  const sek = d.querySelector('section[data-visning="masker"]');
  const pre = sek.querySelector('pre.tekst'), numre = sek.querySelector('.linjenumre');
  indsaet(w, d.querySelector('section[data-visning="masker"] .tomt'), NTEKST);
  await ventTil(w, () => fundRaekker(d).length === 3);
  tjek('V-OPBYG.2 N3: teksten er stadig én tekstnode efter analysen og markeringen (intet <span>)', pre.childNodes.length === 1 && pre.firstChild.nodeType === 3 && pre.firstChild.data === NTEKST && !pre.querySelector('*'));
  tjek('V-OPBYG.2 N3: linjenumrene står i en søjle ved siden af teksten (ikke i den), aria-hidden, med samme skrift (mono)', numre && numre.parentElement === pre.parentElement && numre.nextElementSibling === pre && !pre.contains(numre) && numre.getAttribute('aria-hidden') === 'true' && numre.classList.contains('mono'));
  tjek('V-OPBYG.2 N3: ét nummer pr. linje på skærmen: LF og CRLF er linjeskift, et enligt CR og et linjeskift til sidst giver ingen ny linje (målt i WebKit)', numre.textContent === '1\n2\n3', JSON.stringify(numre.textContent));
  const css = ui('assets/app.css');
  tjek('V-OPBYG.2 N3 (CSS): numrene kan ikke markeres (user-select: none) og har ingen plads i Kopiér; skjult søjle vises ikke', /\.linjenumre \{[^}]*-webkit-user-select: none; user-select: none;/.test(css) && /\.linjenumre\[hidden\] \{ display: none; \}/.test(css));
  tjek('V-OPBYG.2 N3: værdier, der maskeres, er markeret (grimnir-masker); et usikkert fund, der ikke maskeres, stiplet (grimnir-usikker)', JSON.stringify(hl(w, 'grimnir-masker')) === JSON.stringify(['pc-0042', 'srv-web01', 'srv-web01', 'srv-web01']) && JSON.stringify(hl(w, 'grimnir-usikker')) === JSON.stringify(['backup', 'backup']) && !w.CSS.highlights.has('grimnir-valgt'), JSON.stringify([hl(w, 'grimnir-masker'), hl(w, 'grimnir-usikker')]));
  tjek('V-OPBYG.2 N3 (CSS): ::highlight for alle fire, aldrig kun farve (understreget, stiplet, flade og streg over og under, flade og understreget)', /::highlight\(grimnir-masker\) \{ text-decoration-line: underline; text-decoration-style: solid;/.test(css) && /::highlight\(grimnir-usikker\) \{ text-decoration-line: underline; text-decoration-style: dashed;/.test(css) && /::highlight\(grimnir-valgt\) \{ background-color: var\(--warn-soft\); text-decoration-line: underline overline;/.test(css) && /::highlight\(grimnir-kode\) \{ background-color: var\(--ok-soft\); text-decoration-line: underline;/.test(css));
  // En afkrydsning opdaterer markeringen med det samme (før analysen er kørt igen).
  const kald = rust.kald.length;
  const cb = d.querySelector('section[data-visning="masker"] .fundtabel tr[data-id="33"] input[type="checkbox"]');
  cb.checked = true;
  cb.dispatchEvent(new w.Event('change', { bubbles: true }));
  tjek('V-OPBYG.2 N3: en afkrydsning af "Tjek selv" gør stiplet til understreget med det samme (uden at vente på analysen)', rust.kald.length === kald && hl(w, 'grimnir-masker').filter(x => x === 'backup').length === 2 && !w.CSS.highlights.has('grimnir-usikker'));
  // Valg af en række: alle steder markeres som valgt.
  klik(w, d.querySelector('section[data-visning="masker"] .fundtabel tr[data-id="22"]'));
  tjek('V-OPBYG.2 N3: den valgte række markeres alle steder (grimnir-valgt, højere prioritet)', JSON.stringify(hl(w, 'grimnir-valgt')) === JSON.stringify(['srv-web01', 'srv-web01', 'srv-web01']) && w.CSS.highlights.get('grimnir-valgt').priority === 2 && w.Grimnir && pre.childNodes.length === 1);
  // Skift + piletaster markerer i den ene tekstnode som før.
  pre.focus();
  const sel = d.getSelection();
  sel.removeAllRanges();
  tast2(w, pre, 'ArrowRight', { shiftKey: true, altKey: true });
  tjek('V-OPBYG.2 N3: Skift + ⌥ + pil højre markerer stadig ordet i den ene tekstnode (flyt)', sel.toString() === 'login' && sel.anchorNode === pre.firstChild);
  sel.removeAllRanges();
  // Ombryd skjuler numrene.
  const ob = sek.querySelector('.ombryd-knap');
  klik(w, ob);
  tjek('V-OPBYG.2 N3: under Ombryd er linjenumrene skjult (de ville ikke stå ud for de ombrudte linjer)', numre.hidden && pre.classList.contains('ombryd'));
  klik(w, ob);
  tjek('V-OPBYG.2 N3: uden Ombryd står de igen', !numre.hidden);
  // Maskér: koderne markeres; den valgte række følger med.
  klik(w, knapI(d, 'masker', 'gem-masker'));
  await ventTil(w, () => w.CSS.highlights.has('grimnir-kode'));
  tjek('V-OPBYG.2 N3: efter maskeringen er koderne markeret (grimnir-kode), og ingen værdier er markeret som før', JSON.stringify(hl(w, 'grimnir-kode')) === JSON.stringify(['h0002', 'h0001', 'ord0001', 'ord0001', 'h0001', 'h0001']) && !w.CSS.highlights.has('grimnir-masker') && JSON.stringify(hl(w, 'grimnir-valgt')) === JSON.stringify(['h0001', 'h0001', 'h0001']) && pre.childNodes.length === 1, JSON.stringify(hl(w, 'grimnir-kode')));
  tjek('V-OPBYG.2 N4: fodlinjen efter maskeringen: "3 værdier · 3 maskeret · 0 bevaret"', d.getElementById('fod-venstre').textContent === '3 værdier · 3 maskeret · 0 bevaret', d.getElementById('fod-venstre').textContent);
  // Før og efter: tilbage til teksten markeres værdierne igen.
  klik(w, knapI(d, 'masker', 'foer-efter'));
  tjek('V-OPBYG.2 N3: Før og efter viser den indsatte tekst med værdierne markeret igen', pre.firstChild.data === NTEKST && hl(w, 'grimnir-masker').length === 6 && !w.CSS.highlights.has('grimnir-kode'));
  tjek('V-OPBYG.2 N3: ingen linje siger, at markeringen mangler (API\'et findes)', sek.querySelector('.markinfo').hidden);
})();
await (async () => {
  // Demaskér: linjenumre i begge paneler; ingen markering. Uden CSS.highlights: linjen siger det, og alt andet virker.
  const s = side({ hash: '#demasker', rust: falskRust() });
  const { d, w } = s;
  await ventTil(w, () => !laaseskaerm(d));
  const n = [...d.querySelectorAll('section[data-visning="demasker"] .linjenumre')];
  tjek('V-OPBYG.2 N3: Demaskér har linjenumre i begge paneler (svaret og resultatet)', n.length === 2 && n.every(x => x.nextElementSibling && x.nextElementSibling.matches('pre.tekst')));
  const m = side({ rust: falskRust() });
  await ventTil(m.w, () => !laaseskaerm(m.d));
  indsaet(m.w, m.d.querySelector('section[data-visning="masker"] .tomt'), TEKST);
  await ventTil(m.w, () => fundRaekker(m.d).length > 0);
  const info = m.d.querySelector('section[data-visning="masker"] .markinfo');
  tjek('V-OPBYG.2 N3: en webvisning uden CSS.highlights: linjen under teksten siger, at værdierne ikke kan markeres; teksten er én tekstnode', !info.hidden && info.textContent === 'Denne webvisning kan ikke markere værdierne i teksten.' && m.d.querySelector('section[data-visning="masker"] pre.tekst').childNodes.length === 1);
})();
await (async () => {
  // ⌘↵ mens analysen kører, starter ikke en analyse til (sideeffekt-fund 1 i V-OPBYG.1).
  const rust = falskMarkRust();
  let slip = null;
  const s = side({ rust, foer: hlFoer });
  const { d, w } = s;
  await ventTil(w, () => !laaseskaerm(d));
  rust.vent(f => { slip = f; });
  indsaet(w, d.querySelector('section[data-visning="masker"] .tomt'), NTEKST);
  await ventTil(w, () => rust.kald.length === 1);
  s.tast('Enter', { metaKey: true });
  s.tast('Enter', { metaKey: true });
  await vent(5);
  tjek('V-OPBYG.2 N4: ⌘↵ mens analysen kører, starter ingen analyse til (og maskerer ikke)', rust.kald.filter(k => k[0] === 'analyser').length === 1 && !s.kald.some(k => k[0] === 'gem_og_masker'));
  slip();
  await ventTil(w, () => fundRaekker(d).length === 3);
  s.tast('Enter', { metaKey: true });
  await ventTil(w, () => s.kald.some(k => k[0] === 'gem_og_masker'));
  tjek('V-OPBYG.2 N4: når analysen er der, er ⌘↵ Maskér som før', s.kald.some(k => k[0] === 'gem_og_masker') && rust.kald.filter(k => k[0] === 'analyser').length === 1);
})();
await (async () => {
  // N4: startvinduet og kilderne.
  const konf = JSON.parse(fs.readFileSync(path.join(repo, 'src-tauri', 'tauri.conf.json'), 'utf8')).app.windows[0];
  tjek('V-OPBYG.2 N4: startvinduet er 1400 × 900; mindste mål er uændret 1024 × 560', konf.width === 1400 && konf.height === 900 && konf.minWidth === 1024 && konf.minHeight === 560);
  const nj = ui('assets/noter.js');
  const njKode = nj.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  tjek('V-OPBYG.2: noter.js skriver intet til konsollen eller localStorage og sætter ingen stil (koden uden kommentarer)', !/console\.|localStorage|sessionStorage|\.style\./.test(njKode) && njKode.length > 5000);
  tjek('V-OPBYG.2: index.html indlæser noter.js efter sager.js', /assets\/sager\.js" defer><\/script>\n<script src="assets\/noter\.js" defer>/.test(ui('index.html')));
})();

// ════════════════════════════════════════════════════════════════════ V-OPBYG.3
// ── N2: mærket er masken (titellinjen, låseskærmen, Om) ──
await (async () => {
  const app = ui('assets/app.css');
  const regel = sel => { const m = new RegExp('(?:^|\\n)' + sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ' \\{([^}]*)\\}').exec(app); return m ? m[1] : ''; };
  tjek('V-OPBYG.3 N2: titellinjens mærke bruger den lille tegning som maske (under 24 px)', /mask-image: url\(grimnir-maerke-lille\.svg\)/.test(regel('.gr-mrk')) && /-webkit-mask-image: url\(grimnir-maerke-lille\.svg\)/.test(regel('.gr-mrk')) && !/background/.test(regel('.gr-mrk')));
  tjek('V-OPBYG.3 N2: låseskærmens mærke (48 px) og Om-dialogens (40 px) bruger den fulde tegning i accent', /width: 48px; height: 48px; background: var\(--accent\);/.test(regel('.laas-mrk')) && /mask-image: url\(grimnir-maerke\.svg\)/.test(regel('.laas-mrk')) && /width: 40px; height: 40px; background: var\(--accent\);/.test(regel('.om-mrk')) && /mask-image: url\(grimnir-maerke\.svg\)/.test(regel('.om-mrk')));
  tjek('V-OPBYG.3 N2: billederne ligger i ui/assets (img-src \'self\') og er byte for byte kilderne i src-tauri/icons/kilde', ['grimnir-maerke.svg', 'grimnir-maerke-lille.svg'].every(n => fs.readFileSync(path.join(repo, 'ui', 'assets', n)).equals(fs.readFileSync(path.join(repo, 'src-tauri', 'icons', 'kilde', n)))));
  const tok = ui('assets/tokens.css');
  const vaerdi = (blok, navn) => (new RegExp('--' + navn + ': ([^;]+);').exec(blok) || [])[1];
  const lys = tok.slice(0, tok.indexOf(':root[data-tema="moerk"]')), moerk = tok.slice(tok.indexOf(':root[data-tema="moerk"]'));
  tjek('V-OPBYG.3 N2: mærket følger temaet (farven er et token, der findes i lyst og mørkt tema; ingen fast farve i reglerne)', ['accent', 'accent-on-rail'].every(n => vaerdi(lys, n) && vaerdi(moerk, n)) && !/#[0-9a-f]{3,8}/i.test(regel('.gr-mrk') + regel('.laas-mrk') + regel('.om-mrk')));
  tjek('V-OPBYG.3 N2: intet bogstav G som mærke i index.html', !/aria-hidden="true">G</.test(ui('index.html')) && (ui('index.html').match(/class="mrk-maske /g) || []).length === 2);
})();
await (async () => {
  const s = side();
  const { d, w } = s;
  await ventTil(w, () => d.getElementById('aabn-om').querySelector('svg'));
  const om = d.getElementById('aabn-om');
  tjek('V-OPBYG.3 N3: ⓘ står ved tandhjulet i titellinjen: en knap med kun et ikon (info), navnet "Om Grimnir" i aria-label og værktøjstip', om.tagName === 'BUTTON' && om.type === 'button' && om.classList.contains('rk') && om.nextElementSibling === d.getElementById('aabn-indst') && om.getAttribute('aria-label') === 'Om Grimnir' && om.title === 'Om Grimnir' && om.textContent.trim() === '' && om.querySelector('svg[aria-hidden="true"] circle') && om.tabIndex === 0);
  om.focus();
  om.click();
  await ventTil(w, () => aaben(d, 'dlg-om'));
  const dlg = d.getElementById('dlg-om');
  tjek('V-OPBYG.3 N3: ⓘ åbner Om Grimnir, og fokus står på Luk', aaben(d, 'dlg-om') && d.activeElement === dlg.querySelector('[data-svar="luk"]'));
  const omMrk = dlg.querySelector('.om-hoved > .mrk-maske.om-mrk[aria-hidden="true"]');
  tjek('V-OPBYG.3 N2/N3: øverst masken ved navn, slogan og beskrivelse', omMrk && omMrk.textContent === '' && omMrk.nextElementSibling.classList.contains('identitet') && [...dlg.querySelectorAll('.identitet p')].map(p => p.textContent).join('|') === 'Wi24rd Grimnir|Mask. Share. Restore.|Sensitive data masking tool for logs and scripts');
  const punkter = [...dlg.querySelectorAll('.om-punkter > li')];
  tjek('V-OPBYG.3 N3: "Det kan du forvente" med fem punkter, hvert med et ikon (aria-hidden), en overskrift og en sætning', dlg.querySelector('#om-forvent-h').textContent === 'Det kan du forvente' && dlg.querySelector('.om-forvent').getAttribute('aria-labelledby') === 'om-forvent-h' && punkter.length === 5 && punkter.every(li => li.firstElementChild.tagName.toLowerCase() === 'svg' && li.firstElementChild.getAttribute('aria-hidden') === 'true' && li.querySelector('.om-punkt-h').textContent && li.querySelector('.om-punkt-p').textContent));
  tjek('V-OPBYG.3 N3: punkterne i rækkefølge (dansk, macOS)', punkter.map(li => li.querySelector('.om-punkt-h').textContent).join('|') === 'Maskér, før du deler|Demaskér svaret|Sager gemmes krypteret på denne maskine|Låst, når du går fra den|Intet netværk og ingen telemetri' && punkter[0].querySelector('.om-punkt-p').textContent === 'Værdierne bliver til koder, og samme værdi får samme kode.' && punkter[1].querySelector('.om-punkt-p').textContent === 'Koderne bliver til dine værdier igen.' && /Touch ID eller Mac’ens adgangskode/.test(punkter[3].textContent) && /ingen netværkskode/.test(punkter[4].textContent));
  tjek('V-OPBYG.3 N3: versionerne står som før', d.getElementById('om-version').textContent === 'Version 9.8.7' && d.getElementById('om-kerne').textContent === 'Kerne 0.1.0');
  const lic = dlg.querySelector('.om-licens');
  tjek('V-OPBYG.3 N3: licensen: Apache-2.0 · Copyright (c) 2026 Jan Tingsvad og skrifterne (SIL Open Font License 1.1)', lic.querySelector('h3').textContent === 'Licens' && [...lic.querySelectorAll('.om-linje')].map(p => p.textContent).join('|') === 'Apache-2.0 · Copyright (c) 2026 Jan Tingsvad|Skrifter: Inter og JetBrains Mono (SIL Open Font License 1.1)');
  const orden = [dlg.querySelector('.om-hoved'), dlg.querySelector('.om-p'), dlg.querySelector('.om-forvent'), dlg.querySelector('.om-tal'), lic, dlg.querySelector('.om-handlinger')];
  tjek('V-OPBYG.3 N3: rækkefølgen: masken og navnet, sætningen, Det kan du forvente, versionerne, licensen, Åbn vejledningen', orden.every(Boolean) && orden.every((e, i) => i === 0 || orden[i - 1].compareDocumentPosition(e) === 4));
  const lk = d.getElementById('om-licenser'), lt = d.getElementById('om-licenstekst');
  tjek('V-OPBYG.3 N3: "Vis tredjepartslicenser" er en knap, der styrer en skjult tekst (aria-expanded false)', lk.tagName === 'BUTTON' && lk.type === 'button' && lk.textContent === 'Vis tredjepartslicenser' && lk.getAttribute('aria-expanded') === 'false' && lk.getAttribute('aria-controls') === 'om-licenstekst' && lt.hidden && lt.textContent === '');
  // Uden en efterlignet kommando fejler den: fejlen står i dialogen, og teksten er stadig skjult.
  lk.click();
  await ventTil(w, () => !d.getElementById('om-licensfejl').hidden);
  tjek('V-OPBYG.3 N3: kan licenserne ikke hentes, siger dialogen det', !d.getElementById('om-licensfejl').hidden && d.getElementById('om-licensfejl').textContent === 'Tredjepartslicenserne kunne ikke vises.' && lt.hidden && lk.getAttribute('aria-expanded') === 'false');
  d.querySelector('#dlg-om [data-svar="luk"]').click();
  tjek('V-OPBYG.3 N3: Luk lukker dialogen', !aaben(d, 'dlg-om'));
  // Menuens "Om Grimnir" (macOS) åbner den samme dialog.
  s.emit('menu', 'om');
  tjek('V-OPBYG.3 N3: programmenuens Om Grimnir åbner den samme dialog', aaben(d, 'dlg-om') && d.querySelectorAll('#dlg-om').length === 1);
  // Esc på en modal <dialog> er browserens: 'cancel' og så lukket (jsdom har det ikke; det gøres her som WebKit gør det).
  const dlgE = d.getElementById('dlg-om');
  const esc = new w.Event('cancel', { cancelable: true });
  dlgE.dispatchEvent(esc);
  if (!esc.defaultPrevented) dlgE.close();
  tjek('V-OPBYG.3 N3: Esc lukker dialogen (en modal <dialog>; kittet forhindrer ikke Esc)', dlgE.tagName === 'DIALOG' && !esc.defaultPrevented && !aaben(d, 'dlg-om'));
})();
await (async () => {
  // Licenserne og Åbn vejledningen med en efterlignet Rust; teksten er THIRD_PARTY_LICENSES.md (pakket med programmet).
  const LIC = fs.readFileSync(path.join(repo, 'THIRD_PARTY_LICENSES.md'), 'utf8');
  const s = side({ rust: { tredjepartslicenser: () => LIC, vejledning_aabn: () => null } });
  const { d, w } = s;
  await ventTil(w, () => d.getElementById('aabn-om').querySelector('svg'));
  d.getElementById('aabn-om').click();
  const lk = d.getElementById('om-licenser'), lt = d.getElementById('om-licenstekst');
  lk.click();
  await ventTil(w, () => !lt.hidden);
  tjek('V-OPBYG.3 N3: Vis tredjepartslicenser viser filens tekst i dialogen (pre, kan nås med Tab), og knappen hedder nu Skjul', !lt.hidden && lt.tagName === 'PRE' && lt.textContent === LIC && lt.tabIndex === 0 && lt.getAttribute('aria-label') === 'Tredjepartslicenser' && lk.getAttribute('aria-expanded') === 'true' && lk.textContent === 'Skjul tredjepartslicenser' && s.kald.filter(k => k[0] === 'tredjepartslicenser').length === 1);
  lk.click();
  tjek('V-OPBYG.3 N3: Skjul skjuler teksten igen', lt.hidden && lk.getAttribute('aria-expanded') === 'false' && lk.textContent === 'Vis tredjepartslicenser');
  lk.click();
  tjek('V-OPBYG.3 N3: vist igen uden et nyt kald (teksten er hentet)', !lt.hidden && s.kald.filter(k => k[0] === 'tredjepartslicenser').length === 1);
  const vk = d.getElementById('om-vejledning');
  vk.click();
  await ventTil(w, () => s.kald.some(k => k[0] === 'vejledning_aabn'));
  tjek('V-OPBYG.3 N3: Åbn vejledningen er samme kommando som titellinjens (kun sproget)', vk.tagName === 'BUTTON' && vk.textContent === 'Åbn vejledningen' && vk.getAttribute('aria-label') === d.getElementById('vejledning').getAttribute('aria-label') && JSON.stringify(s.kald.find(k => k[0] === 'vejledning_aabn')[1]) === '{"sprog":"da"}');
  const kildeKode = ui('assets/app.js');
  tjek('V-OPBYG.3 N3: der er stadig kun ét kald til vejledning_aabn i webvisningen (én funktion for begge knapper)', (kildeKode.match(/invoke\('vejledning_aabn'/g) || []).length === 1 && /\$\('vejledning'\)\.addEventListener\('click', aabnVejledning\)/.test(kildeKode) && /vejlKnap\.addEventListener\('click', aabnVejledning\)/.test(kildeKode));
})();
await (async () => { for (const lang of ['da', 'en']) {
  // Windows og engelsk: knappen og låsens punkt efter platformen.
  const s = side({ platform: 'windows', lager: { 'grimnir-sprog': lang } });
  const { d, w } = s;
  await ventTil(w, () => d.getElementById('aabn-om').querySelector('svg'));
  const om = d.getElementById('aabn-om');
  const navn = lang === 'da' ? 'Om Grimnir' : 'About Grimnir';
  tjek(`V-OPBYG.3 N3 (Windows, ${lang}): ⓘ står også på Windows med navnet i aria-label og værktøjstip`, om.getAttribute('aria-label') === navn && om.title === navn && om.nextElementSibling.id === 'aabn-indst');
  om.click();
  const dlg = d.getElementById('dlg-om');
  const laas = dlg.querySelectorAll('.om-punkter > li')[3].textContent;
  tjek(`V-OPBYG.3 N3 (Windows, ${lang}): låsens punkt lover ikke Touch ID, men siger, hvad der gælder på Windows`, !/Touch ID|Mac/.test(laas) && (lang === 'da' ? /Windows Hello kommer med Windows-udgaven/.test(laas) : /Windows Hello comes with the Windows version/.test(laas)));
  if (lang === 'en') tjek('V-OPBYG.3 N3 (en): overskrifterne og knappen på engelsk', dlg.querySelector('#om-forvent-h').textContent === 'What you can expect' && dlg.querySelector('#om-licens-h').textContent === 'Licence' && d.getElementById('om-licenser').textContent === 'Show third-party licences' && d.getElementById('om-vejledning').textContent === 'Open the guide' && dlg.querySelector('h2').textContent === 'About Grimnir');
} })();
await (async () => {
  // Låst: Om kan åbnes fra ⓘ (som fra menuen i dag), og licenserne kan vises; intet fra sagerne i DOM'en.
  const rust = falskLaasRust({ laast: true });
  rust.tredjepartslicenser = () => 'Tredjepartslicenser — prøve';
  const s = side({ rust, hash: '#masker' });
  const { d, w } = s;
  await ventTil(w, () => laaseskaerm(d) && d.getElementById('aabn-om').querySelector('svg'));
  d.getElementById('aabn-om').click();
  tjek('V-OPBYG.3 N3: låst kan Om åbnes fra ⓘ (titellinjen er ikke inert)', laaseskaerm(d) && aaben(d, 'dlg-om') && !d.querySelector('.titel').closest('[inert]'));
  d.getElementById('om-licenser').click();
  await ventTil(w, () => !d.getElementById('om-licenstekst').hidden);
  tjek('V-OPBYG.3 N3: låst kan tredjepartslicenserne vises (de rører hverken sager, ordbog, filer eller nøgler)', d.getElementById('om-licenstekst').textContent === 'Tredjepartslicenser — prøve' && !d.getElementById('om-licenstekst').hidden);
})();
await (async () => {
  // Teksterne lover ikke netværk, programmet ikke har.
  const sprogKode = ui('assets/sprog.js');
  const omNoegler = ['omForventH', 'omMaskerH', 'omMaskerP', 'omDemaskerH', 'omDemaskerP', 'omSagerH', 'omSagerP', 'omLaastH', 'omLaastPMac', 'omLaastPWin', 'omNetH', 'omNetP', 'omLicensH', 'omSkrifter', 'kVisLicenser', 'kSkjulLicenser', 'licenserFejl', 'kAabnVejledning', 'omP', 'licens'];
  const tekster = [];
  for (const n of omNoegler) for (const m of sprogKode.matchAll(new RegExp('\\b' + n + ": '([^']*)'", 'g'))) tekster.push(m[1]);
  tjek('V-OPBYG.3 N3: alle Om-teksterne findes på dansk og engelsk', tekster.length === omNoegler.length * 2, String(tekster.length));
  const LOEFTE = /opdater|update|sky\b|cloud|server|synkron|sync|upload|konto\b|account|log ind|sign in|backup|online|internet|download|hent(?:er|es)? (?:nye|fra)/i;
  tjek('V-OPBYG.3 N3: ingen Om-tekst nævner netværk, programmet ikke har (opdatering, sky, server, synkronisering, konto …)', !tekster.some(t => LOEFTE.test(t)), tekster.filter(t => LOEFTE.test(t)).join(' | '));
  tjek('V-OPBYG.3 N3: kontrol: mønsteret fanger "opdateres automatisk", "synced to the cloud" og "log ind"', ['opdateres automatisk', 'synced to the cloud', 'log ind på kontoen'].every(t => LOEFTE.test(t)));
})();

// ── N4: markering for en åben fil (stederne for uddraget og rækkerne bag dem kommer fra Rust) ──
function falskFilMarkRust() {
  const r = falskFilRust({ antal: 3 });
  const UDDRAG = 'Password=Sommer2026!;\r\nsrcip=10.20.0.2 msg=ok\r\nhost srv-fil01 og 10.20.0.2\r\n';
  const R = [
    { id: 9, vaerdi: 'Sommer2026!', kode: 'GRIMNIR_SECRET_0001', art: 'hemmelighed', status: 'sikker', standard: true, hemmelig: true },
    { id: 31, vaerdi: '10.20.0.2', kode: '198.18.0.2', art: 'ipv4_egen', status: 'sikker', standard: true, hemmelig: false },
    { id: 59, vaerdi: 'srv-fil01', kode: 'h0001', art: 'vaert', status: 'tjek', standard: false, hemmelig: false },
  ];
  const steder = (t, par) => { const ud = []; for (const [id, x] of par) { let i = -1; while ((i = t.indexOf(x, i + 1)) !== -1) ud.push([i, i + x.length, id]); } return ud.sort((a, b) => a[0] - b[0]); };
  let fra = R.filter(x => !x.standard).map(x => x.id);
  const kald = [];
  return {
    ...r, kald,
    fil_aabn: async ({ visning }) => ({ navn: 'app.log', bytes: 4800000, tegnsaet: 'utf8', linjeskift: 'crlf', linjer: 3, uddrag: UDDRAG, ikke_vist: 4700000 }),
    fil_analyser: async a => {
      kald.push(['fil_analyser', a]);
      if (a.fravalgt) fra = a.fravalgt.slice();
      if (a.rort) fra = R.filter(x => (new Map(a.rort).has(x.id) ? !new Map(a.rort).get(x.id) : !x.standard)).map(x => x.id);
      // Kun den første række er på siden (som når en fil har flere rækker, end siden viser); stederne gælder alle.
      const raekker = R.slice(0, 1).map(x => ({ id: x.id, art: x.art, status: x.status, standard: x.standard, valgt: !fra.includes(x.id), laast: false, hemmelig: x.hemmelig, vaerdier: [x.vaerdi], koder: [x.kode], antal: 1, linje: 1, rettet: false, kendt: false, tilfoejet: null }));
      return { side: { raekker, i_alt: 3, valgte: 3 - fra.length, antal: { alle: 3, tjek: 1, hemmelig: 1, seneste: 0, status_tjek: 1 } }, fejl: [], advarsler: [], bytes: 4800000, linjer: 3, fravalgt: fra.slice(), moenstre: [], steder: steder(UDDRAG, R.map(x => [x.id, x.vaerdi])), sted_raekker: R.map(x => [x.id, x.status === 'tjek', false]) };
    },
    fil_gem_og_masker: async ({ fravalgt }) => {
      let m = UDDRAG;
      const v = R.filter(x => !fravalgt.includes(x.id));
      for (const x of v) m = m.split(x.vaerdi).join(x.kode);
      return { uddrag: m, ikke_vist: 4700000, rester: [], advarsler: [], poster: v.length, bytes: m.length, kopierbar: true, steder: steder(m, v.map(x => [x.id, x.kode])) };
    },
  };
}
await (async () => {
  const rust = falskFilMarkRust();
  const s = side({ rust, foer: hlFoer });
  const { d, w } = s;
  await ventTil(w, () => !laaseskaerm(d));
  knapI(d, 'masker', 'aabn-fil').click();
  await ventTil(w, () => w.CSS.highlights.has('grimnir-masker'));
  const sek = d.querySelector('section[data-visning="masker"]');
  const pre = sek.querySelector('pre.tekst');
  tjek('V-OPBYG.3 N4: en åben fil: værdierne, der maskeres, er markeret i uddraget (grimnir-masker), også for en række, der ikke er på den viste side', JSON.stringify(hl(w, 'grimnir-masker')) === JSON.stringify(['Sommer2026!', '10.20.0.2', '10.20.0.2']) && fundRaekker(d).length === 1, JSON.stringify(hl(w, 'grimnir-masker')));
  tjek('V-OPBYG.3 N4: et usikkert fund i filen er stiplet (grimnir-usikker), og teksten er stadig én tekstnode', JSON.stringify(hl(w, 'grimnir-usikker')) === JSON.stringify(['srv-fil01']) && pre.childNodes.length === 1 && pre.firstChild.nodeType === 3);
  tjek('V-OPBYG.3 N4: linjen "Filens værdier markeres ikke i teksten endnu." er væk (også fra sprogene)', sek.querySelector('.markinfo').hidden && !/markeringFil|markeres ikke i teksten endnu|not marked in the text yet/.test(ui('assets/sprog.js') + ui('assets/maskering.js')));
  klik(w, sek.querySelector('.fundtabel tr[data-id="9"]'));
  tjek('V-OPBYG.3 N4: den valgte række i en fil markeres alle steder (grimnir-valgt)', JSON.stringify(hl(w, 'grimnir-valgt')) === JSON.stringify(['Sommer2026!']));
  const cb = sek.querySelector('.fundtabel tr[data-id="9"] input[type="checkbox"]');
  cb.checked = false;
  cb.dispatchEvent(new w.Event('change', { bubbles: true }));
  await ventTil(w, () => !hl(w, 'grimnir-masker').includes('Sommer2026!'));
  tjek('V-OPBYG.3 N4: en række, der slås fra, er ikke længere markeret som maskeret', JSON.stringify(hl(w, 'grimnir-masker')) === JSON.stringify(['10.20.0.2', '10.20.0.2']), JSON.stringify(hl(w, 'grimnir-masker')));
  cb.checked = true;
  cb.dispatchEvent(new w.Event('change', { bubbles: true }));
  await ventTil(w, () => hl(w, 'grimnir-masker').includes('Sommer2026!'));
  klik(w, knapI(d, 'masker', 'gem-masker'));
  await ventTil(w, () => w.CSS.highlights.has('grimnir-kode'));
  tjek('V-OPBYG.3 N4: efter maskeringen af filen er koderne markeret i det maskerede uddrag (grimnir-kode)', JSON.stringify(hl(w, 'grimnir-kode')) === JSON.stringify(['GRIMNIR_SECRET_0001', '198.18.0.2', '198.18.0.2']) && !w.CSS.highlights.has('grimnir-masker'), JSON.stringify(hl(w, 'grimnir-kode')));
  const mj = ui('assets/maskering.js');
  tjek('V-OPBYG.3 N4: webvisningen markerer fra Rusts steder og sted_raekker (ingen egen søgning i uddraget)', /st\.analyse\.sted_raekker/.test(mj) && !/if \(st\.fil\) return null;/.test(mj));
})();

// ══════════════════════════ V-OPBYG.6 N1: Maskér markering i en åben fil ══════════════════════════
// En efterlignet Rust med fil_marker: den får stedet (UTF-16) og typen, slår værdien op i sit eget uddrag, afviser som
// Rust (midt i et tegn, uden for, tom, linjeskift, allerede et fund/en hemmelighed) og svarer med en plads. Analysen og
// maskeringen får pladserne; rækken for en tilføjet værdi har 3 steder (også efter uddraget).
function falskFilMarkerRust() {
  const r = falskFilRust({ antal: 3 });
  const UDDRAG = 'kunde 😀 æøå Blåbær-Øst-7 srcip=10.20.0.2\r\nPassword=Sommer2026!; ref Kunde-Hemmelig-9\r\nslut\r\n';
  const R = [
    { id: 60, vaerdi: 'Sommer2026!', kode: 'GRIMNIR_SECRET_0001', art: 'hemmelighed', hemmelig: true, linje: 2 },
    { id: 33, vaerdi: '10.20.0.2', kode: '198.18.0.2', art: 'ipv4_egen', hemmelig: false, linje: 1 },
  ];
  const liste = [];
  const log = { marker: [], analyser: [], gem: [] };
  let fra = [];
  const hoej = c => c >= 0xD800 && c <= 0xDBFF;
  const raekker = tf => {
    const ud = R.map(x => ({ id: x.id, art: x.art, status: 'sikker', standard: true, valgt: !fra.includes(x.id), laast: false, hemmelig: x.hemmelig, vaerdier: x.hemmelig ? [] : [x.vaerdi], koder: [x.kode], antal: 1, linje: x.linje, rettet: false, kendt: false, tilfoejet: null }));
    tf.forEach((t, nr) => {
      const v = liste[t.tid], hem = t.art === 'hemmelighed';
      ud.push({ id: 1000 + t.tid, art: t.art, status: 'sikker', standard: true, valgt: !fra.includes(1000 + t.tid), laast: false, hemmelig: hem, vaerdier: hem ? [] : [v], koder: [hem ? 'GRIMNIR_SECRET_0002' : 'ord0001'], antal: 3, linje: 1, rettet: false, kendt: false, tilfoejet: nr });
    });
    return ud;
  };
  const steder = tf => { const ud = []; for (const [id, x] of R.map(y => [y.id, y.vaerdi]).concat(tf.map(t => [1000 + t.tid, liste[t.tid]]))) { let i = -1; while ((i = UDDRAG.indexOf(x, i + 1)) !== -1) ud.push([i, i + x.length, id]); } return ud.sort((a, b) => a[0] - b[0]); };
  return {
    ...r, log, liste,
    fil_aabn: async () => ({ navn: 'app.log', bytes: 4800000, tegnsaet: 'utf8', linjeskift: 'crlf', linjer: 3, uddrag: UDDRAG, ikke_vist: 4700000 }),
    fil_marker: ({ start, laengde, art }) => {
      log.marker.push({ start, laengde, art });
      const a = start, b = start + laengde;
      if (!laengde) return { tid: null, afvist: 'tom', raekke: null, linje: null, hemmelig: false };
      if (b > UDDRAG.length) return { tid: null, afvist: 'uden_for', raekke: null, linje: null, hemmelig: false };
      if ((a > 0 && hoej(UDDRAG.charCodeAt(a - 1))) || hoej(UDDRAG.charCodeAt(b - 1))) return { tid: null, afvist: 'midt_i_tegn', raekke: null, linje: null, hemmelig: false };
      const v = UDDRAG.slice(a, b).trim();
      if (!v) return { tid: null, afvist: 'tom', raekke: null, linje: null, hemmelig: false };
      if (/[\r\n]/.test(v)) return { tid: null, afvist: 'linjeskift', raekke: null, linje: null, hemmelig: false };
      const f = R.find(x => x.vaerdi.toLowerCase() === v.toLowerCase());
      if (f) return { tid: null, afvist: f.hemmelig && art !== 'hemmelighed' ? 'hemmelighed' : 'findes', raekke: f.id, linje: f.linje, hemmelig: f.hemmelig };
      let i = liste.findIndex(x => x.toLowerCase() === v.toLowerCase());
      if (i < 0) { liste.push(v); i = liste.length - 1; }
      return { tid: i, afvist: null, raekke: null, linje: null, hemmelig: false };
    },
    fil_analyser: async a => {
      log.analyser.push(a);
      const tf = a.tilfoejede || [];
      if (a.fravalgt) fra = a.fravalgt.slice();
      if (a.rort) { const m = new Map(a.rort); fra = raekker(tf).filter(x => (m.has(x.id) ? !m.get(x.id) : false)).map(x => x.id); }
      const rk = raekker(tf);
      return { side: { raekker: rk, i_alt: rk.length, valgte: rk.filter(x => x.valgt).length, antal: { alle: rk.length, tjek: 0, hemmelig: rk.filter(x => x.hemmelig).length, seneste: 0, status_tjek: 0 } }, fejl: [], advarsler: [], bytes: 4800000, linjer: 3, fravalgt: fra.slice(), moenstre: [], steder: steder(tf), sted_raekker: rk.map(x => [x.id, false, false]), tilfoejede: tf.map((t, nr) => ({ nr, raekke: 1000 + t.tid, antal: 3, afvist: null })) };
    },
    fil_raekker: () => { throw new Error('ikke brugt'); },
    raekke_vaerdi: ({ fil, id }) => { if (!fil || id < 1000) throw { art: 'ukendt_raekke' }; return { id, vaerdier: [liste[id - 1000]] }; },
    fil_gem_og_masker: async a => { log.gem.push(a); return { uddrag: UDDRAG, ikke_vist: 4700000, rester: [], advarsler: [], poster: 3, bytes: 100, kopierbar: true, steder: [] }; },
  };
}
await (async () => { for (const sprog of ['da', 'en']) {
  const da = sprog === 'da';
  // Rækkens "…" (som rmKnap/rmPunkt længere nede, der endnu ikke er defineret her).
  const rk = tr => tr && tr.querySelector('[data-felt="handlinger"].mere-knap');
  const rp = (tr, id) => tr && tr.querySelector(`.raekke-menu [data-punkt="${id}"]`);
  const rust = falskFilMarkerRust();
  const s = side({ rust, foer: hlFoer, lager: { 'grimnir-sprog': sprog } });
  const { d, w } = s;
  const TK = w => w.Sprog.TEKST[sprog];
  await ventTil(w, () => !laaseskaerm(d));
  knapI(d, 'masker', 'aabn-fil').click();
  await ventTil(w, () => fundRaekker(d).length === 2);
  const sek = d.querySelector('section[data-visning="masker"]');
  const pre = sek.querySelector('pre.tekst');
  const besked = () => sek.querySelector('.arbejde .besked').textContent;
  const vaelg = (fra, til) => { w.getSelection().setBaseAndExtent(pre.firstChild, fra, pre.firstChild, til); d.dispatchEvent(new w.Event('selectionchange')); };
  const vaelgOrd = o => { const i = pre.firstChild.data.indexOf(o); vaelg(i, i + o.length); };
  const tryk = async id => { const n = rust.log.analyser.length; knapI(d, 'masker', id).click(); await ventTil(w, () => rust.log.analyser.length > n || /./.test(besked()) && rust.log.marker.length > 0, 2000); await vent(5); };
  // Uden markering: forklaringen siger, at kun det viste kan markeres, og at rækken gælder hele filen.
  w.getSelection().collapse(pre.firstChild, 0);
  d.dispatchEvent(new w.Event('selectionchange'));
  tjek(`V-OPBYG.6 N1 (${sprog}): i en åben fil er Maskér markering slået fra uden markering; forklaringen siger "den viste tekst (200.000 tegn)" og "hele filen"`, !kommandoAktiv(d, 'masker', 'masker-dette') && forklaring(knapI(d, 'masker', 'masker-dette')) === TK(w).hvorforMarkerFil && (da ? /200\.000 tegn.*hele filen/ : /200,000 characters.*whole file/).test(TK(w).hvorforMarkerFil), forklaring(knapI(d, 'masker', 'masker-dette')));
  // Markér en værdi efter et emoji og æøå.
  vaelgOrd('Blåbær-Øst-7');
  tjek(`V-OPBYG.6 N1 (${sprog}): med en markering i filen er Maskér markering og Maskér som hemmelighed slået til`, kommandoAktiv(d, 'masker', 'masker-dette') && kommandoAktiv(d, 'masker', 'masker-hemmelig'));
  await tryk('masker-dette');
  await ventTil(w, () => fundRaekker(d).length === 3);
  const mk = s.kald.filter(k => k[0] === 'fil_marker');
  tjek(`V-OPBYG.6 N1 (${sprog}): fil_marker får stedet i UTF-16 (efter emojiet, der er to enheder) og typen, aldrig teksten`, mk.length === 1 && mk[0][1].start === 13 && mk[0][1].laengde === 12 && mk[0][1].art === 'ord' && JSON.stringify(Object.keys(mk[0][1]).sort()) === '["art","laengde","start"]' && !JSON.stringify(mk[0][1]).includes('Blåbær'), JSON.stringify(mk[0] && mk[0][1]));
  const fa = rust.log.analyser[rust.log.analyser.length - 1];
  tjek(`V-OPBYG.6 N1 (${sprog}): analysen af filen får pladsen og typen (tilfoejede: [{ tid, art }]), aldrig værdien`, JSON.stringify(fa.tilfoejede) === '[{"tid":0,"art":"ord"}]' && !JSON.stringify(fa).includes('Blåbær'), JSON.stringify(fa.tilfoejede));
  const tr = raekkeMed(d, 1000);
  tjek(`V-OPBYG.6 N1 (${sprog}): rækken står i tabellen som tilføjet med 3 steder (hele filen), og meldingen siger "i hele filen"`, tr && tr.classList.contains('tilfoejet') && tr.querySelectorAll('td')[4].textContent === '3' && besked() === TK(w).bTilfoejetFil.replace('{v}', 'Blåbær-Øst-7').replace('{w}', '3').replace(da ? '{w:sted|steder}' : '{w:place|places}', da ? 'steder' : 'places'), besked());
  tjek(`V-OPBYG.6 N1 (${sprog}): markeringen i teksten viser den tilføjede værdi med det samme (grimnir-masker)`, hl(w, 'grimnir-masker').includes('Blåbær-Øst-7') && pre.childNodes.length === 1, JSON.stringify(hl(w, 'grimnir-masker')));
  // Samme værdi igen: allerede tilføjet (samme plads fra Rust).
  vaelgOrd('Blåbær-Øst-7');
  await tryk('masker-dette');
  tjek(`V-OPBYG.6 N1 (${sprog}): samme værdi igen: "allerede tilføjet", og listen har den én gang`, besked() === TK(w).bAlleredeTilfoejet.replace('{v}', 'Blåbær-Øst-7') && rust.liste.length === 1, besked());
  // Fortryd og Gentag.
  knapI(d, 'masker', 'fortryd').click();
  await ventTil(w, () => !raekkeMed(d, 1000));
  tjek(`V-OPBYG.6 N1 (${sprog}): Fortryd sender listen uden pladsen, og rækken er væk`, JSON.stringify(rust.log.analyser[rust.log.analyser.length - 1].tilfoejede) === '[]' && !raekkeMed(d, 1000));
  knapI(d, 'masker', 'gentag').click();
  await ventTil(w, () => raekkeMed(d, 1000));
  tjek(`V-OPBYG.6 N1 (${sprog}): Gentag sender pladsen igen, og rækken er tilbage`, JSON.stringify(rust.log.analyser[rust.log.analyser.length - 1].tilfoejede) === '[{"tid":0,"art":"ord"}]' && Boolean(raekkeMed(d, 1000)));
  // Fjern i rækkens "…".
  rk(raekkeMed(d, 1000)).click();
  const fj = rp(raekkeMed(d, 1000), 'fjern');
  tjek(`V-OPBYG.6 N1 (${sprog}): rækkens "…" har Fjern for en tilføjet værdi i en fil`, fj && fj.getAttribute('aria-disabled') !== 'true');
  fj.click();
  await ventTil(w, () => !raekkeMed(d, 1000));
  tjek(`V-OPBYG.6 N1 (${sprog}): Fjern i "…" fjerner rækken, og Fortryd lægger den tilbage`, !raekkeMed(d, 1000) && JSON.stringify(rust.log.analyser[rust.log.analyser.length - 1].tilfoejede) === '[]');
  knapI(d, 'masker', 'fortryd').click();
  await ventTil(w, () => raekkeMed(d, 1000));
  // Maskér som hemmelighed: ingen værdi i tabellen; meldingen siger "en hemmelighed"; Vis henter den fra filen.
  vaelgOrd('Kunde-Hemmelig-9');
  await tryk('masker-hemmelig');
  await ventTil(w, () => raekkeMed(d, 1001));
  const th = raekkeMed(d, 1001);
  tjek(`V-OPBYG.6 N1 (${sprog}): Maskér som hemmelighed i en fil: fil_marker med typen hemmelighed; rækken har prikker og ingen værdi i tabellen`, s.kald.filter(k => k[0] === 'fil_marker').pop()[1].art === 'hemmelighed' && th.querySelector('.prikker') && !sek.querySelector('.fundtabel').innerHTML.includes('Kunde-Hemmelig-9'));
  tjek(`V-OPBYG.6 N1 (${sprog}): meldingen nævner ikke værdien ("en hemmelighed")`, !besked().includes('Kunde-Hemmelig-9') && besked().includes(TK(w).navnHemmelig), besked());
  th.querySelector('[data-felt="vis"]').click();
  await ventTil(w, () => raekkeMed(d, 1001).textContent.includes('Kunde-Hemmelig-9'));
  const rv = s.kald.filter(k => k[0] === 'raekke_vaerdi').pop();
  tjek(`V-OPBYG.6 N1 (${sprog}): Vis henter den med raekke_vaerdi fra filen`, rv && rv[1].fil === true && rv[1].id === 1001);
  // Afvisningerne.
  const e = pre.firstChild.data.indexOf('😀');
  vaelg(e + 1, e + 4);
  await tryk('masker-dette');
  tjek(`V-OPBYG.6 N1 (${sprog}): en markering, der begynder midt i et emoji, afvises med en klar grund`, besked() === TK(w).bMarkeringMidtITegn, besked());
  // Allerede et fund (slået fra først): rækken slås til og vælges, og intet er tilføjet.
  const cb33 = raekkeMed(d, 33).querySelector('input[type="checkbox"]');
  cb33.checked = false;
  cb33.dispatchEvent(new w.Event('change', { bubbles: true }));
  await ventTil(w, () => rust.log.analyser.at(-1).fravalgt?.includes(33) && !w.GrimnirMaskering.M.st.travl);
  vaelgOrd('10.20.0.2');
  await tryk('masker-dette');
  await ventTil(w, () => !rust.log.analyser.at(-1).fravalgt?.includes(33) && raekkeMed(d, 33)?.getAttribute('aria-selected') === 'true');
  tjek(`V-OPBYG.6 N1 (${sprog}): allerede et fund: "allerede et fund"; rækken slås til (sendes ikke som fravalgt) og vælges, og intet er tilføjet`, besked() === TK(w).bFindesAllerede.replace('{v}', '10.20.0.2') && rust.liste.length === 2 && !rust.log.analyser.at(-1).fravalgt.includes(33) && raekkeMed(d, 33).querySelector('input[type="checkbox"]').checked && raekkeMed(d, 33).getAttribute('aria-selected') === 'true', besked() + ' ' + JSON.stringify(rust.log.analyser.at(-1).fravalgt));
  // Rækken er allerede slået til, og en anden række er valgt: Maskér markering vælger fundets række.
  klik(w, raekkeMed(d, 60));
  vaelgOrd('10.20.0.2');
  await tryk('masker-dette');
  tjek(`V-OPBYG.6 N1 (${sprog}): allerede et fund, der allerede maskeres: rækken vælges (den anden række er ikke længere valgt)`, raekkeMed(d, 33).getAttribute('aria-selected') === 'true' && raekkeMed(d, 60).getAttribute('aria-selected') !== 'true' && besked() === TK(w).bFindesAllerede.replace('{v}', '10.20.0.2'));
  vaelgOrd('Sommer2026!');
  await tryk('masker-dette');
  tjek(`V-OPBYG.6 N1 (${sprog}): allerede en hemmelighed: afvist uden at nævne værdien, og rækken er valgt`, besked() === TK(w).bAfvist_hemmelighed && raekkeMed(d, 60).getAttribute('aria-selected') === 'true', besked());
  // Ordbogen ændret (analysér igen med de rørte rækker): pladserne sendes også dér.
  const nA = rust.log.analyser.length;
  d.dispatchEvent(new w.Event('grimnir-ordbog'));
  await ventTil(w, () => rust.log.analyser.length > nA);
  const ig = rust.log.analyser[rust.log.analyser.length - 1];
  tjek(`V-OPBYG.6 N1 (${sprog}): en ny analyse efter en ændret ordbog (rort) sender også pladserne og typerne`, Array.isArray(ig.rort) && JSON.stringify(ig.tilfoejede) === '[{"tid":0,"art":"ord"},{"tid":1,"art":"hemmelighed"}]', JSON.stringify(ig));
  await ventTil(w, () => raekkeMed(d, 1001) && !w.GrimnirMaskering.M.st.travl);
  // Gem og maskér sender pladserne.
  klik(w, knapI(d, 'masker', 'gem-masker'));
  await ventTil(w, () => rust.log.gem.length === 1);
  tjek(`V-OPBYG.6 N1 (${sprog}): Gem og maskér sender pladserne og typerne til fil_gem_og_masker, aldrig værdierne`, JSON.stringify(rust.log.gem[0]?.tilfoejede) === '[{"tid":0,"art":"ord"},{"tid":1,"art":"hemmelighed"}]' && !JSON.stringify(rust.log.gem[0]).includes('Kunde-Hemmelig-9'), JSON.stringify(rust.log.gem[0] && rust.log.gem[0].tilfoejede));
  tjek(`V-OPBYG.6 N1 (${sprog}): ingen fil-kommando har fået en tekst eller en værdi`, s.kald.filter(k => /^fil_/.test(k[0])).every(k => !('tekst' in k[1]) && !JSON.stringify(k[1]).includes('Kunde-Hemmelig-9') && !JSON.stringify(k[1]).includes('Blåbær')));
} })();

// ══════════════════════════ V-OPBYG.4 N1: hemmeligheder først ved Vis ══════════════════════════
await (async () => {
  for (const sprog of ['da', 'en']) {
    const rust = falskRust();
    const s = side({ hash: '#masker', rust, lager: { 'grimnir-sprog': sprog } });
    const { d, w } = s;
    await ventTil(w, () => !laaseskaerm(d));
    const sek = d.querySelector('section[data-visning="masker"]');
    const M = w.GrimnirMaskering.M;
    indsaet(w, sek.querySelector('.tomt'), TEKST);
    await ventTil(w, () => raekkeMed(d, 45));
    const analyseSvar = JSON.stringify(M.st.analyse.raekker);
    tjek(`V-OPBYG.4 N1 (${sprog}): rækkerne fra Rust har ingen hemmelighed, og DOM'en har den ikke før Vis`, !analyseSvar.includes(HEMMELIG) && !sek.querySelector('.fundtabel').innerHTML.includes(HEMMELIG) && M.st.hv.size === 0);
    const vis = () => raekkeMed(d, 45).querySelector('[data-felt="vis"]');
    vis().click();
    await ventTil(w, () => raekkeMed(d, 45).textContent.includes(HEMMELIG));
    const k = s.kald.filter(x => x[0] === 'raekke_vaerdi');
    tjek(`V-OPBYG.4 N1 (${sprog}): Vis henter værdien med raekke_vaerdi for netop den række (indsat tekst)`, k.length === 1 && k[0][1].id === 45 && k[0][1].fil === false && vis().textContent === (sprog === 'da' ? 'Skjul' : 'Hide'));
    tjek(`V-OPBYG.4 N1 (${sprog}): den anden hemmelighed er stadig prikker`, !sek.querySelector('.fundtabel').innerHTML.includes('Zq8Xv2Lm9Pw4') && raekkeMed(d, 67).querySelector('.prikker'));
    // Søgning: en vist hemmelighed findes på værdien, en skjult ikke; feltets forklaring siger det på begge sprog.
    d.querySelector('section[data-visning="masker"] input[type="search"]').value = 'sommer';
    d.querySelector('section[data-visning="masker"] input[type="search"]').dispatchEvent(new w.Event('input'));
    tjek(`V-OPBYG.4 N1 (${sprog}): søgning finder en vist hemmelighed på værdien`, fundRaekker(d).map(r => r.getAttribute('data-id')).join() === '45');
    const soeg = d.querySelector('section[data-visning="masker"] input[type="search"]');
    soeg.value = 'zq8x'; soeg.dispatchEvent(new w.Event('input'));
    tjek(`V-OPBYG.4 N1 (${sprog}): søgning finder ikke en skjult hemmelighed på værdien`, fundRaekker(d).length === 0);
    tjek(`V-OPBYG.4 N1 (${sprog}): søgefeltets forklaring siger, at en skjult hemmelighed ikke søges`, sprog === 'da' ? /skjult hemmelighed søges ikke/.test(soeg.title) : /hidden secret is not searched/.test(soeg.title), soeg.title);
    soeg.value = ''; soeg.dispatchEvent(new w.Event('input'));
    // Skjul fjerner værdien fra DOM'en og webvisningens hukommelse.
    vis().click();
    await ventTil(w, () => !raekkeMed(d, 45).textContent.includes(HEMMELIG));
    tjek(`V-OPBYG.4 N1 (${sprog}): Skjul fjerner værdien fra DOM'en og fra hukommelsen (st.hv)`, !sek.querySelector('.fundtabel').innerHTML.includes(HEMMELIG) && M.st.hv.size === 0 && !M.st.vist.has(45));
    // Faneskift.
    vis().click();
    await ventTil(w, () => M.st.hv.size === 1);
    s.tast('2', { metaKey: true, code: 'Digit2' });
    await ventTil(w, () => M.st.hv.size === 0);
    tjek(`V-OPBYG.4 N1 (${sprog}): et faneskift skjuler den viste hemmelighed igen`, M.st.hv.size === 0 && !sek.querySelector('.fundtabel').innerHTML.includes(HEMMELIG));
    s.tast('1', { metaKey: true, code: 'Digit1' });
    await ventTil(w, () => w.Grimnir.aktiv === 'masker' && raekkeMed(d, 45) && raekkeMed(d, 45).querySelector('.prikker'));
    // Et svar, der kommer, efter brugeren har skiftet fane, bruges ikke.
    {
      const gammel = rust.raekke_vaerdi;
      let svar;
      rust.raekke_vaerdi = a => new Promise(res => { svar = () => res(gammel(a)); });
      vis().click();
      await ventTil(w, () => typeof svar === 'function');
      s.tast('2', { metaKey: true, code: 'Digit2' });
      await ventTil(w, () => w.Grimnir.aktiv === 'demasker');
      svar();
      await vent(0); await vent(0);
      tjek(`V-OPBYG.4 N1 (${sprog}): et svar på Vis, der kommer efter et faneskift, vises ikke`, M.st.hv.size === 0 && !sek.querySelector('.fundtabel').innerHTML.includes(HEMMELIG));
      rust.raekke_vaerdi = gammel;
      s.tast('1', { metaKey: true, code: 'Digit1' });
      await ventTil(w, () => w.Grimnir.aktiv === 'masker');
    }
    // Lås.
    vis().click();
    const foerLaas = await ventTil(w, () => M.st.hv.size === 1);
    w.document.dispatchEvent(new w.CustomEvent('grimnir-laas', { detail: true }));
    tjek(`V-OPBYG.4 N1 (${sprog}): låsen skjuler den viste hemmelighed igen`, foerLaas && M.st.hv.size === 0 && !sek.querySelector('.fundtabel').innerHTML.includes(HEMMELIG));
    w.document.dispatchEvent(new w.CustomEvent('grimnir-laas', { detail: false }));
    // En ny tekst erstatter den gamle.
    vis().click();
    await ventTil(w, () => M.st.hv.size === 1);
    M.modtag(TEKST + 'ny linje\r\n');
    tjek(`V-OPBYG.4 N1 (${sprog}): en ny tekst glemmer den viste hemmelighed`, M.st.hv.size === 0 && M.st.vist.size === 0);
    // Låst i Rust: Vis svarer laast, og intet vises.
    await ventTil(w, () => raekkeMed(d, 45));
    rust.raekke_vaerdi = () => { throw { art: 'laast' }; };
    vis().click();
    await vent(0); await vent(0);
    tjek(`V-OPBYG.4 N1 (${sprog}): svarer Rust laast, vises intet`, M.st.hv.size === 0 && raekkeMed(d, 45).querySelector('.prikker'));
  }
  // En åben fil: Vis spørger med fil = true; rækkerne fra Rust har ingen hemmelighed.
  const rust = falskFilRust({ antal: 3 });
  const s = side({ hash: '#masker', rust });
  const { d, w } = s;
  await ventTil(w, () => !laaseskaerm(d));
  knapI(d, 'masker', 'aabn-fil').click();
  await ventTil(w, () => raekkeMed(d, 10));
  const M = w.GrimnirMaskering.M;
  tjek('V-OPBYG.4 N1: en fil: rækkerne fra Rust har ingen hemmelighed', !JSON.stringify(M.st.analyse.raekker).includes(HEMMELIG) && raekkeMed(d, 10).querySelector('.prikker'));
  raekkeMed(d, 10).querySelector('[data-felt="vis"]').click();
  await ventTil(w, () => raekkeMed(d, 10).textContent.includes(HEMMELIG));
  const k = s.kald.filter(x => x[0] === 'raekke_vaerdi');
  tjek('V-OPBYG.4 N1: en fil: Vis henter værdien med raekke_vaerdi (fil = true)', k.length === 1 && k[0][1].fil === true && k[0][1].id === 10);
  const mj = ui('assets/maskering.js');
  tjek('V-OPBYG.4 N1: webvisningen viser en hemmelighed kun fra raekke_vaerdi (st.hv), aldrig fra rækkens vaerdier', /invoke\('raekke_vaerdi'/.test(mj) && /r\.hemmelig \? st\.hv\.get\(r\.id\) \|\| \[\] : r\.vaerdier/.test(mj));
})();

// ══════════════════════════ V-OPBYG.4 N2: Hemmelighed som type i Maskér markering ══════════════════════════
await (async () => { for (const sprog of ['da', 'en']) {
  const s = await manuelSide({ lager: { 'grimnir-sprog': sprog } });
  const { d, w, GM, rust } = s;
  const sek = d.querySelector('section[data-visning="masker"]');
  const tabel = () => sek.querySelector('.fundtabel');
  const hRaekke = () => [...sek.querySelectorAll('.fundtabel tr.tilfoejet')].find(tr => tr.querySelector('[data-felt="type"][data-type="hemmelighed"]'));
  const en = sprog === 'da' ? 'en hemmelighed' : 'a secret';
  // Genvejsmenuen: Maskér som hemmelighed.
  markerOrd(w, d, 'pc-17');
  const pre = preM(d);
  pre.dispatchEvent(new w.MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
  const punkt = [...GM.M.menu.querySelectorAll('[role="menuitem"]')].find(p => p.textContent === (sprog === 'da' ? 'Maskér som hemmelighed' : 'Mask as secret'));
  tjek(`V-OPBYG.4 N2 (${sprog}): genvejsmenuen har Maskér som hemmelighed`, Boolean(punkt));
  punkt.click();
  await ventTil(w, () => hRaekke());
  const sidst = rust.log.analyser[rust.log.analyser.length - 1];
  tjek(`V-OPBYG.4 N2 (${sprog}): værdien sendes med typen hemmelighed`, JSON.stringify(sidst.tilfoejede) === '[{"vaerdi":"pc-17","art":"hemmelighed"}]', JSON.stringify(sidst.tilfoejede));
  const tr = hRaekke();
  tjek(`V-OPBYG.4 N2 (${sprog}): rækken viser prikker med Vis, og tabellen har ikke værdien (heller ikke i et attribut)`, tr.querySelector('.prikker') && tr.querySelector('[data-felt="vis"]') && !tabel().outerHTML.includes('pc-17'));
  tjek(`V-OPBYG.4 N2 (${sprog}): typen står som tekst (Hemmelighed), og Fjern nævner ikke værdien`, tr.querySelector('[data-felt="type"]').textContent === (sprog === 'da' ? 'Hemmelighed' : 'Secret') && !tr.querySelector('select') && tr.querySelector('[data-felt="fjern"]').getAttribute('aria-label') === (sprog === 'da' ? 'Fjern den tilføjede hemmelighed fra fundene' : 'Remove the added secret from the findings'));
  tjek(`V-OPBYG.4 N2 (${sprog}): meldingen siger "${en}", ikke værdien`, beskedM(d).textContent.includes(en) && !beskedM(d).outerHTML.includes('pc-17'), beskedM(d).textContent);
  tjek(`V-OPBYG.4 N2 (${sprog}): erstatningen er kernens kode for hemmeligheder`, tr.querySelector('[data-felt="kode"]').value.startsWith('GRIMNIR_SECRET_'));
  tr.querySelector('[data-felt="vis"]').click();
  await ventTil(w, () => hRaekke() && hRaekke().textContent.includes('pc-17'));
  tjek(`V-OPBYG.4 N2 (${sprog}): Vis henter den tilføjede hemmelighed fra Rust`, hRaekke().textContent.includes('pc-17') && s.kald.some(k => k[0] === 'raekke_vaerdi'));
  hRaekke().querySelector('[data-felt="vis"]').click();
  await ventTil(w, () => !tabel().outerHTML.includes('pc-17'));
  // Fortryd nævner ikke værdien.
  s.tast('z', { metaKey: true, code: 'KeyZ' });
  knapI(d, 'masker', 'fortryd').click();
  await ventTil(w, () => !hRaekke());
  tjek(`V-OPBYG.4 N2 (${sprog}): Fortryd siger "${en}", ikke værdien`, beskedM(d).textContent.includes(en) && !beskedM(d).outerHTML.includes('pc-17'), beskedM(d).textContent);
  // Valglisten for en tilføjet værdi har ikke Hemmelighed (den ville være for bred til Type-kolonnen på dansk).
  markerOrd(w, d, 'db1');
  knapI(d, 'masker', 'masker-dette').click();
  await ventTil(w, () => tilfRaekke(d, 'db1'));
  const sel = tilfRaekke(d, 'db1').querySelector('select[data-felt="type"]');
  tjek(`V-OPBYG.4 N2 (${sprog}): valglisten har ikke Hemmelighed (den vælges i genvejsmenuen)`, sel && ![...sel.options].some(o => o.value === 'hemmelighed'));
  // En værdi, der allerede er fundet som hemmelighed: afvist med rækken valgt, uden at værdien nævnes.
  GM.M.modtag(MTEKST + 'pwd=Fjeld-Ravn-77\n');
  await ventTil(w, () => !GM.M.st.travl && GM.M.st.analyse);
  const i = (MTEKST + 'pwd=Fjeld-Ravn-77\n').indexOf('Fjeld-Ravn-77');
  marker(w, d, i, i + 13);
  knapI(d, 'masker', 'masker-dette').click();
  await ventTil(w, () => /allerede fundet som en hemmelighed|already found as a secret/.test(beskedM(d).textContent));
  await ventTil(w, () => GM.M.st.tilfoejede.length === 0 && !GM.M.st.travl);
  tjek(`V-OPBYG.4 N2 (${sprog}): en værdi, der allerede er en hemmelighed, afvises med en melding uden værdien, og den tilføjes ikke`, !beskedM(d).outerHTML.includes('Fjeld-Ravn-77') && GM.M.st.tilfoejede.length === 0 && !tabel().outerHTML.includes('Fjeld-Ravn-77'), beskedM(d).textContent);
  tjek(`V-OPBYG.4 N2 (${sprog}): hemmelighedens række er valgt`, sek.querySelector(`.fundtabel tr[data-id="${i}"]`) && sek.querySelector(`.fundtabel tr[data-id="${i}"]`).getAttribute('aria-selected') === 'true');
} })();

// ══════════════════════════ V-OPBYG.5 N1: Ryd glemmer i Rust, Maskér som hemmelighed i båndet ══════════════════════════
// Efterlignet Rust: falskManuelRust (indsat tekst) med tekst_glem og falskFilRust (en fil). Kun opdigtede data. Ingen fast
// ventetid: testene venter på en tilstand (ventTil).
await (async () => { for (const sprog of ['da', 'en']) {
  const s = await manuelSide({ lager: { 'grimnir-sprog': sprog } });
  const { d, w, GM, rust } = s;
  rust.tekst_glem = () => null;
  await ventTil(w, () => GM.M.st.analyse && !GM.M.st.travl);
  const b = knapI(d, 'masker', 'masker-hemmelig');
  const grp = b && b.closest('.grp');
  const alleGrp = [...d.querySelectorAll('#baand > [data-visning="masker"] .grupper > .grp')];
  tjek(`V-OPBYG.5 N1 (${sprog}): båndet har Maskér som hemmelighed i sin egen gruppe sidst (${sprog === 'da' ? 'Hemmelighed' : 'Secret'})`, b && b.textContent.trim() === (sprog === 'da' ? 'Maskér som hemmelighed' : 'Mask as secret') && grp === alleGrp.at(-1) && grp.querySelector('.cap').textContent === (sprog === 'da' ? 'Hemmelighed' : 'Secret') && grp.querySelectorAll('.cb').length === 1 && b.querySelector('svg'), b && b.textContent);
  // Uden en markering: slået fra med samme forklaring som Maskér markering (kittets værktøjstip).
  w.getSelection().removeAllRanges();
  d.dispatchEvent(new w.Event('selectionchange'));
  await ventTil(w, () => b.getAttribute('aria-disabled') === 'true');
  const hvorfor = w.Sprog.TEKST[sprog].hvorforMarker;
  tjek(`V-OPBYG.5 N1 (${sprog}): uden en markering er den slået fra med forklaringen i værktøjstippet`, b.getAttribute('aria-disabled') === 'true' && forklaring(b) === hvorfor && forklaring(knapI(d, 'masker', 'masker-dette')) === hvorfor, forklaring(b));
  b.click();
  tjek(`V-OPBYG.5 N1 (${sprog}): slået fra tilføjer et klik intet`, GM.M.st.tilfoejede.length === 0);
  // Med en markering: slået til; musetrykket tager ikke markeringen; klikket tilføjer værdien som hemmelighed.
  markerOrd(w, d, 'pc-17');
  await ventTil(w, () => b.getAttribute('aria-disabled') !== 'true');
  const md = new w.MouseEvent('mousedown', { bubbles: true, cancelable: true });
  b.dispatchEvent(md);
  tjek(`V-OPBYG.5 N1 (${sprog}): med en markering er den slået til, og musetrykket tager ikke markeringen`, b.getAttribute('aria-disabled') !== 'true' && md.defaultPrevented && w.getSelection().toString() === 'pc-17');
  const n = rust.log.analyser.length;
  b.click();
  await ventTil(w, () => rust.log.analyser.length > n && !GM.M.st.travl);
  const sidst = rust.log.analyser[rust.log.analyser.length - 1];
  const hr = [...d.querySelectorAll('section[data-visning="masker"] .fundtabel tr.tilfoejet')].find(tr => tr.querySelector('[data-felt="type"][data-type="hemmelighed"]'));
  tjek(`V-OPBYG.5 N1 (${sprog}): båndets knap tilføjer markeringen med typen hemmelighed (som genvejsmenuen), skjult i tabellen`, JSON.stringify(sidst.tilfoejede) === '[{"vaerdi":"pc-17","art":"hemmelighed"}]' && hr && hr.querySelector('.prikker') && !d.querySelector('section[data-visning="masker"] .fundtabel').outerHTML.includes('pc-17'), JSON.stringify(sidst.tilfoejede));
  // Genvejsmenuen har stadig punktet.
  tjek(`V-OPBYG.5 N1 (${sprog}): genvejsmenuen har stadig Maskér som hemmelighed`, [...GM.M.menu.querySelectorAll('[role="menuitem"]')].some(p => p.textContent === (sprog === 'da' ? 'Maskér som hemmelighed' : 'Mask as secret')));
  // Ryd (der er en tilføjet værdi, så der spørges først): Rust bedes glemme hemmelighederne.
  knapI(d, 'masker', 'ryd').click();
  await ventTil(w, () => d.getElementById('dlg-ryd') && d.getElementById('dlg-ryd').hasAttribute('open'));
  const ja = [...d.getElementById('dlg-ryd').querySelectorAll('button')].find(x => x.textContent === (sprog === 'da' ? 'Ryd' : 'Clear'));
  ja.click();
  await ventTil(w, () => !GM.M.st.tekst);
  tjek(`V-OPBYG.5 N1 (${sprog}): Ryd beder Rust glemme den indsatte teksts hemmeligheder (tekst_glem, én gang, uden data)`, s.kald.filter(k => k[0] === 'tekst_glem').length === 1 && JSON.stringify(s.kald.find(k => k[0] === 'tekst_glem')[1]) === '{}' && !s.kald.some(k => k[0] === 'fil_luk'));
} })();
// Ryd, når Rust svarer laast: siden ryddes alligevel, og intet fejlbanner.
await (async () => {
  const s = await manuelSide();
  const { d, w, GM, rust } = s;
  rust.tekst_glem = () => { throw { art: 'laast' }; };
  await ventTil(w, () => GM.M.st.analyse && !GM.M.st.travl);
  knapI(d, 'masker', 'ryd').click();
  await ventTil(w, () => !GM.M.st.tekst);
  await ventTil(w, () => s.kald.some(k => k[0] === 'tekst_glem'));
  tjek('V-OPBYG.5 N1: svarer Rust laast på tekst_glem, ryddes siden alligevel uden fejlbanner', !GM.M.st.tekst && !d.querySelector('section[data-visning="masker"] .ban.danger') && d.querySelector('section[data-visning="masker"] .tomt') && !d.querySelector('section[data-visning="masker"] .tomt').hidden);
})();
// En åben fil: Ryd slipper filen (fil_luk) og kalder ikke tekst_glem.
await (async () => {
  const rust = falskFilRust({ antal: 3 });
  rust.tekst_glem = () => null;
  const s = side({ hash: '#masker', rust });
  const { d, w } = s;
  await ventTil(w, () => !laaseskaerm(d));
  knapI(d, 'masker', 'aabn-fil').click();
  await ventTil(w, () => raekkeMed(d, 10));
  const M = w.GrimnirMaskering.M;
  await ventTil(w, () => !M.st.travl);
  knapI(d, 'masker', 'ryd').click();
  await ventTil(w, () => !M.st.tekst || (d.getElementById('dlg-ryd') && d.getElementById('dlg-ryd').hasAttribute('open')));
  if (M.st.tekst) [...d.getElementById('dlg-ryd').querySelectorAll('button')].find(x => x.textContent === 'Ryd').click();
  await ventTil(w, () => !M.st.tekst);
  tjek('V-OPBYG.5 N1: en åben fil: Ryd slipper filen (fil_luk) og kalder ikke tekst_glem', s.kald.some(k => k[0] === 'fil_luk') && !s.kald.some(k => k[0] === 'tekst_glem'));
})();
// Kilden: Maskér som hemmelighed bruger samme handling og forklaring som Maskér markering.
await (async () => {
  const mj = ui('assets/maskering.js'), aj = ui('assets/app.js');
  tjek('V-OPBYG.5 N1: båndets Maskér som hemmelighed er maskerDette(\'hemmelighed\') med kanMarkere() som forklaring', /G\.haandter\('masker', 'masker-hemmelig', \(\) => maskerDette\('hemmelighed'\)\)/.test(mj) && /kommando\('masker', 'masker-hemmelig', !h, h\)/.test(mj) && /\{ t: 'gHemmelig', knapper: \[aktiv\('masker', 'masker-hemmelig', 'kMaskerSomHemmelighed', 'markeringHemmelig'\)\] \}/.test(aj));
})();

// ══════════════════════════ V-OPBYG.5 N2: rækkens "…"-menu, Kopiér værdi og Slet en post ══════════════════════════
// Efterlignet Rust: falskRust (fundtabellen), manuelSide (en tilføjet værdi) og falskSagRust med sagens indhold (fire
// opdigtede poster). Kun opdigtede data. Ingen fast ventetid.
// Fokus på el: sand straks, eller når fokus flyttes dertil (focusin); false, hvis det ikke sker inden for maks.
const fokusPaa = (w, el, maks = 4000) => new Promise(r => {
  if (w.document.activeElement === el) { r(true); return; }
  const f = () => { if (w.document.activeElement === el) { w.document.removeEventListener('focusin', f, true); w.clearTimeout(t); r(true); } };
  const t = w.setTimeout(() => { w.document.removeEventListener('focusin', f, true); r(w.document.activeElement === el); }, maks);
  w.document.addEventListener('focusin', f, true);
});
const rmKnap = tr => tr && tr.querySelector('[data-felt="handlinger"].mere-knap');
const rmMenu = tr => tr && tr.querySelector('.raekke-menu');
const rmPunkter = tr => [...rmMenu(tr).querySelectorAll('[role="menuitem"]')];
const rmPunkt = (tr, id) => rmMenu(tr).querySelector(`[data-punkt="${id}"]`);
await (async () => { for (const sprog of ['da', 'en']) {
  const da = sprog === 'da';
  const rust = falskRust();
  const s = side({ hash: '#masker', rust, lager: { 'grimnir-sprog': sprog } });
  const { d, w } = s;
  await ventTil(w, () => !laaseskaerm(d));
  const sek = d.querySelector('section[data-visning="masker"]');
  const M = w.GrimnirMaskering.M;
  indsaet(w, sek.querySelector('.tomt'), TEKST);
  await ventTil(w, () => raekkeMed(d, 45) && !M.st.travl);
  const tr = () => raekkeMed(d, 24);
  const b = rmKnap(tr());
  const sidsteCelle = tr().lastElementChild;
  tjek(`V-OPBYG.5 N2 (${sprog}): hver række har "…" sidst i rækken (efter Altid/Aldrig), en knap med menu og navn`, fundRaekker(d).every(x => rmKnap(x) && x.lastElementChild.contains(rmKnap(x))) && [...sidsteCelle.querySelectorAll('button')].at(-1) === b && b.getAttribute('aria-haspopup') === 'menu' && b.getAttribute('aria-expanded') === 'false' && b.tabIndex === 0 && b.getAttribute('aria-label') === (da ? 'Handlinger for bruger060' : 'Actions for bruger060') && tr().querySelectorAll('.ordbogknapper button').length === 2, b.getAttribute('aria-label'));
  const hb = rmKnap(raekkeMed(d, 45));
  tjek(`V-OPBYG.5 N2 (${sprog}): en hemmeligheds "…" hedder koden, aldrig værdien`, hb.getAttribute('aria-label') === (da ? 'Handlinger for GRIMNIR_SECRET_0001' : 'Actions for GRIMNIR_SECRET_0001') && !sek.querySelector('.fundtabel').outerHTML.includes(HEMMELIG));
  // Tastaturet: pil ned åbner med fokus på første punkt; piletaster, Home og End flytter; rækkens valg flyttes ikke.
  b.focus();
  // Tasterne, menuen bruger, går ikke videre til tabellen (rækkens egne taster).
  let naaet = 0;
  const taeller = e => { if (['ArrowDown', 'ArrowUp', 'Home', 'End', 'Escape'].includes(e.key)) naaet++; };
  sek.querySelector('.fundtabel').addEventListener('keydown', taeller);
  const valgtFoer = [...sek.querySelectorAll('.fundtabel tbody tr')].map(x => x.getAttribute('aria-selected')).join();
  tastPaa(w, b, 'ArrowDown');
  const p = rmPunkter(tr());
  tjek(`V-OPBYG.5 N2 (${sprog}): pil ned åbner menuen med fokus på første punkt (Bevar, Ret erstatning, Find i teksten)`, !rmMenu(tr()).hidden && b.getAttribute('aria-expanded') === 'true' && d.activeElement === p[0] && p.map(x => x.textContent).join('|') === (da ? 'Bevar|Ret erstatning|Find i teksten' : 'Keep|Edit replacement|Find in the text') && rmMenu(tr()).getAttribute('role') === 'menu' && p.every(x => x.getAttribute('role') === 'menuitem'), p.map(x => x.textContent).join('|'));
  tastPaa(w, d.activeElement, 'ArrowDown');
  const ned = d.activeElement === p[1];
  tastPaa(w, d.activeElement, 'End');
  const end = d.activeElement === p[2];
  tastPaa(w, d.activeElement, 'ArrowDown');
  const rundt = d.activeElement === p[0];
  tastPaa(w, d.activeElement, 'ArrowUp');
  const op = d.activeElement === p[2];
  tastPaa(w, d.activeElement, 'Home');
  const home = d.activeElement === p[0];
  const valgtEfter = [...sek.querySelectorAll('.fundtabel tbody tr')].map(x => x.getAttribute('aria-selected')).join();
  tjek(`V-OPBYG.5 N2 (${sprog}): piletasterne, Home og End flytter (og går rundt), tabellens rækkevalg flyttes ikke, og tasterne når ikke tabellen`, ned && end && rundt && op && home && valgtFoer === valgtEfter && naaet === 0, String(naaet));
  const esc = tastPaa(w, d.activeElement, 'Escape');
  tjek(`V-OPBYG.5 N2 (${sprog}): Esc lukker menuen med fokus på knappen`, rmMenu(tr()).hidden && d.activeElement === b && b.getAttribute('aria-expanded') === 'false' && esc.defaultPrevented && naaet === 0);
  sek.querySelector('.fundtabel').removeEventListener('keydown', taeller);
  tastPaa(w, b, 'ArrowUp');
  tjek(`V-OPBYG.5 N2 (${sprog}): pil op åbner med fokus på sidste punkt`, !rmMenu(tr()).hidden && d.activeElement === rmPunkter(tr()).at(-1));
  tastPaa(w, d.activeElement, 'Tab');
  tjek(`V-OPBYG.5 N2 (${sprog}): Tab lukker menuen`, rmMenu(tr()).hidden);
  b.click();
  tjek(`V-OPBYG.5 N2 (${sprog}): Enter og mellemrum (et klik) åbner med fokus på første punkt`, !rmMenu(tr()).hidden && d.activeElement === rmPunkter(tr())[0]);
  d.body.dispatchEvent(new w.MouseEvent('mousedown', { bubbles: true }));
  tjek(`V-OPBYG.5 N2 (${sprog}): et klik udenfor lukker menuen`, rmMenu(tr()).hidden);
  // Én menu ad gangen.
  b.click();
  rmKnap(raekkeMed(d, 6)).click();
  tjek(`V-OPBYG.5 N2 (${sprog}): åbnes en anden rækkes menu, lukkes den første`, rmMenu(tr()).hidden && !rmMenu(raekkeMed(d, 6)).hidden);
  tastPaa(w, d.activeElement, 'Escape');
  // Bevar og Maskér: samme som afkrydsningen.
  b.click();
  rmPunkt(tr(), 'valg').click();
  tjek(`V-OPBYG.5 N2 (${sprog}): Bevar slår rækken fra som afkrydsningen (status Bevares), lukker menuen og giver fokus til knappen`, !tr().querySelector('input[type="checkbox"]').checked && tr().classList.contains('fra') && rmMenu(tr()).hidden && d.activeElement === b && tr().textContent.includes(da ? 'Bevares' : 'To keep'));
  b.click();
  const ret = rmPunkt(tr(), 'ret');
  tjek(`V-OPBYG.5 N2 (${sprog}): en bevaret række: punktet hedder Maskér, og Ret erstatning er slået fra med hvorfor`, rmPunkt(tr(), 'valg').textContent === (da ? 'Maskér' : 'Mask') && ret.getAttribute('aria-disabled') === 'true' && d.getElementById(ret.getAttribute('aria-describedby')).textContent === w.Sprog.TEKST[sprog].hvorforRetBevaret);
  ret.click();
  tjek(`V-OPBYG.5 N2 (${sprog}): et punkt, der er slået fra, gør intet (menuen står)`, !rmMenu(tr()).hidden);
  rmPunkt(tr(), 'valg').click();
  await ventTil(w, () => tr() && tr().querySelector('input[type="checkbox"]').checked && !M.st.travl);
  tjek(`V-OPBYG.5 N2 (${sprog}): Maskér slår rækken til igen`, tr().querySelector('input[type="checkbox"]').checked && !tr().classList.contains('fra'));
  // Ret erstatning: fokus i rækkens felt.
  rmKnap(tr()).click();
  rmPunkt(tr(), 'ret').click();
  tjek(`V-OPBYG.5 N2 (${sprog}): Ret erstatning giver fokus til rækkens felt`, d.activeElement === tr().querySelector('[data-felt="kode"]'));
  // Find i teksten: rækken vælges (og markeres i teksten), fokus i teksten.
  rmKnap(tr()).click();
  rmPunkt(tr(), 'find').click();
  tjek(`V-OPBYG.5 N2 (${sprog}): Find i teksten vælger rækken og giver fokus til teksten`, tr().getAttribute('aria-selected') === 'true' && d.activeElement === sek.querySelector('pre.tekst') && M.st.valgtRaekke === 24);
  // En hemmelighed: Vis og Skjul i menuen (værdien hentes fra Rust som ved rækkens knap).
  const h = () => raekkeMed(d, 45);
  rmKnap(h()).click();
  const vis = rmPunkt(h(), 'vis');
  tjek(`V-OPBYG.5 N2 (${sprog}): en hemmelighed har Vis i menuen`, vis && vis.textContent === (da ? 'Vis' : 'Show'));
  vis.click();
  await ventTil(w, () => h() && h().textContent.includes(HEMMELIG));
  tjek(`V-OPBYG.5 N2 (${sprog}): Vis i menuen henter værdien med raekke_vaerdi, og fokus står på rækkens "…"`, s.kald.some(k => k[0] === 'raekke_vaerdi' && k[1].id === 45) && d.activeElement === rmKnap(h()));
  rmKnap(h()).click();
  tjek(`V-OPBYG.5 N2 (${sprog}): bagefter hedder punktet Skjul`, rmPunkt(h(), 'vis').textContent === (da ? 'Skjul' : 'Hide'));
  rmPunkt(h(), 'vis').click();
  await ventTil(w, () => h() && !h().textContent.includes(HEMMELIG));
  tjek(`V-OPBYG.5 N2 (${sprog}): Skjul i menuen skjuler værdien igen`, !sek.querySelector('.fundtabel').outerHTML.includes(HEMMELIG) && M.st.hv.size === 0);
} })();
// En tilføjet værdi: Fjern i menuen (som rækkens knap).
await (async () => {
  const s = await manuelSide();
  const { d, w, GM } = s;
  markerOrd(w, d, 'pc-17');
  knapI(d, 'masker', 'masker-dette').click();
  await ventTil(w, () => tilfRaekke(d, 'pc-17') && !GM.M.st.travl);
  const tr = tilfRaekke(d, 'pc-17');
  rmKnap(tr).click();
  tjek('V-OPBYG.5 N2: en tilføjet række har Fjern sidst i menuen', rmPunkter(tr).map(x => x.getAttribute('data-punkt')).join() === 'valg,ret,find,fjern');
  rmPunkt(tr, 'fjern').click();
  await ventTil(w, () => !tilfRaekke(d, 'pc-17') && !GM.M.st.travl);
  tjek('V-OPBYG.5 N2: Fjern i menuen fjerner den tilføjede værdi (som rækkens knap)', !tilfRaekke(d, 'pc-17') && GM.M.st.tilfoejede.length === 0);
})();
// Sagens indhold: Kopiér værdi, Vis/Skjul og Slet.
await (async () => { for (const sprog of ['da', 'en']) {
  const da = sprog === 'da';
  const rust = falskSagRust({ sager: SAGER() });
  const poster = indholdPoster(4); // h0001, user0001, GRIMNIR_SECRET_0001, 198.18.0.4 (sorteret efter type)
  let aabenSag = true, slet = null;
  rust.sag_status = () => ({ poster: poster.length, id: null, navn: null, udloeb: null });
  rust.sag_indhold = ({ valg }) => {
    const vist = new Set(valg.vist || []);
    return { id: null, navn: null, aaben: aabenSag, udloeb: null, i_alt: poster.length, typer: [], fundet: poster.length, raekker: poster.map(x => ({ ...x, vaerdi: x.hemmelig && !vist.has(x.nr) ? null : x.vaerdi })), noter: [] };
  };
  rust.sag_post_slet = ({ nr, kode }) => { if (slet) throw slet; const i = poster.findIndex(x => x.nr === nr && x.kode === kode); if (i < 0) throw { art: 'ukendt_post' }; poster.splice(i, 1); return { poster: poster.length, id: null, navn: null, udloeb: null }; };
  rust.sag_post_kopier = () => true;
  rust.udklip_vaerdi_kopieret = () => true;
  const skrevet = [];
  const s = side({ hash: '#sager', rust, lager: { 'grimnir-sprog': sprog }, foer: w => Object.defineProperty(w.navigator, 'clipboard', { value: { writeText: async t => { skrevet.push(t); } }, configurable: true }) });
  const { d, w } = s;
  await ventTil(w, () => !laaseskaerm(d));
  w.GrimnirSager.visIndhold(null);
  await ventTil(w, () => indholdRaekker(d).length === 4);
  const raekke = kode => indholdRaekker(d).find(x => x.querySelector('td:nth-child(2)').textContent === kode);
  const sek = d.querySelector('section[data-visning="sager"]');
  const besked = () => sek.querySelector('.sagindhold .besked');
  tjek(`V-OPBYG.5 N2 (${sprog}): sagens indhold har "…" sidst i hver række med koden som navn (også for en hemmelighed)`, indholdRaekker(d).every(x => rmKnap(x) && x.lastElementChild.contains(rmKnap(x))) && rmKnap(raekke('GRIMNIR_SECRET_0001')).getAttribute('aria-label') === (da ? 'Handlinger for GRIMNIR_SECRET_0001' : 'Actions for GRIMNIR_SECRET_0001') && !sek.querySelector('.indholdtabel').outerHTML.includes('Hemmelig-0001'));
  rmKnap(raekke('h0001')).click();
  tjek(`V-OPBYG.5 N2 (${sprog}): menuen i sagens indhold: Kopiér værdi og Slet (en hemmelighed også Vis)`, rmPunkter(raekke('h0001')).map(x => x.textContent).join('|') === (da ? 'Kopiér værdi|Slet' : 'Copy value|Delete') && (rmKnap(raekke('GRIMNIR_SECRET_0001')).click(), rmPunkter(raekke('GRIMNIR_SECRET_0001')).map(x => x.getAttribute('data-punkt')).join() === 'kopier,vis,slet'));
  tastPaa(w, d.activeElement, 'Escape');
  // Kopiér værdi: en almindelig værdi kopierer webvisningen og melder den til Rust.
  rmKnap(raekke('h0001')).click();
  rmPunkt(raekke('h0001'), 'kopier').click();
  await ventTil(w, () => s.kald.some(k => k[0] === 'udklip_vaerdi_kopieret'));
  const uk = s.kald.find(k => k[0] === 'udklip_vaerdi_kopieret');
  tjek(`V-OPBYG.5 N2 (${sprog}): Kopiér værdi (almindelig): webvisningen kopierer værdien og melder plads og kode til Rust (D21)`, skrevet.at(-1) === 'srv-opdigtet-0001' && uk[1].nr === 0 && uk[1].kode === 'h0001' && !('vaerdi' in uk[1]) && besked().textContent === w.Sprog.TEKST[sprog].bVaerdiKopieret, JSON.stringify(uk));
  // En hemmelighed: Rust skriver selv; værdien går ikke forbi webvisningen.
  const n = skrevet.length;
  rmKnap(raekke('GRIMNIR_SECRET_0001')).click();
  rmPunkt(raekke('GRIMNIR_SECRET_0001'), 'kopier').click();
  await ventTil(w, () => s.kald.some(k => k[0] === 'sag_post_kopier'));
  const pk = s.kald.find(k => k[0] === 'sag_post_kopier');
  await ventTil(w, () => besked().textContent === w.Sprog.TEKST[sprog].bVaerdiKopieret);
  tjek(`V-OPBYG.5 N2 (${sprog}): Kopiér værdi (skjult hemmelighed): Rust lægger den i udklipsholderen (sag_post_kopier med plads og kode); webvisningen kopierer intet og har ikke værdien`, skrevet.length === n && pk[1].kode === 'GRIMNIR_SECRET_0001' && Object.keys(pk[1]).sort().join() === 'kode,nr' && !d.body.outerHTML.includes('Hemmelig-0001'));
  rust.sag_post_kopier = () => false;
  rmKnap(raekke('GRIMNIR_SECRET_0001')).click();
  rmPunkt(raekke('GRIMNIR_SECRET_0001'), 'kopier').click();
  await ventTil(w, () => besked().textContent === w.Sprog.TEKST[sprog].bVaerdiIkkeKopieret);
  tjek(`V-OPBYG.5 N2 (${sprog}): kunne Rust ikke kopiere, siger meldingen det`, besked().textContent === w.Sprog.TEKST[sprog].bVaerdiIkkeKopieret);
  // Vis i menuen.
  rmKnap(raekke('GRIMNIR_SECRET_0001')).click();
  rmPunkt(raekke('GRIMNIR_SECRET_0001'), 'vis').click();
  await ventTil(w, () => raekke('GRIMNIR_SECRET_0001').textContent.includes('Hemmelig-0001!'));
  const fokusVis = await ventTil(w, () => d.activeElement === rmKnap(raekke('GRIMNIR_SECRET_0001')));
  tjek(`V-OPBYG.5 N2 (${sprog}): Vis i menuen viser hemmeligheden (sag_indhold med vist), fokus på rækkens "…"`, fokusVis && s.kald.filter(k => k[0] === 'sag_indhold').at(-1)[1].valg.vist.length === 1);
  rmKnap(raekke('GRIMNIR_SECRET_0001')).click();
  rmPunkt(raekke('GRIMNIR_SECRET_0001'), 'vis').click();
  await ventTil(w, () => !raekke('GRIMNIR_SECRET_0001').textContent.includes('Hemmelig-0001!'));
  await fokusPaa(w, rmKnap(raekke('GRIMNIR_SECRET_0001')));
  // Slet: kittets bekræftelse (farlig, fokus på Annullér) med koden; Annullér gør intet.
  rmKnap(raekke('h0001')).click();
  rmPunkt(raekke('h0001'), 'slet').click();
  await ventTil(w, () => d.getElementById('dlg-slet-post') && d.getElementById('dlg-slet-post').hasAttribute('open'));
  let dlg = d.getElementById('dlg-slet-post');
  const knapper = [...dlg.querySelectorAll('button')];
  const annuller = knapper.find(x => x.textContent === (da ? 'Annullér' : 'Cancel')), ok2 = knapper.find(x => x.textContent === (da ? 'Slet' : 'Delete'));
  await fokusPaa(w, annuller);
  tjek(`V-OPBYG.5 N2 (${sprog}): Slet spørger først (kittets bekræftelse, farlig, fokus på Annullér); teksten nævner koden og at den ikke kan demaskeres`, dlg.textContent.includes('h0001') && (da ? /ikke længere demaskeres/.test(dlg.textContent) : /can no longer be unmasked/.test(dlg.textContent)) && d.activeElement === annuller && ok2 && /danger/.test(ok2.className), [d.activeElement && d.activeElement.textContent, ok2 && ok2.className].join(' / '));
  annuller.click();
  await ventTil(w, () => !dlg.hasAttribute('open'));
  await ventTil(w, () => d.activeElement === rmKnap(raekke('h0001')));
  tjek(`V-OPBYG.5 N2 (${sprog}): Annullér sletter intet, og fokus er tilbage på "…"`, !s.kald.some(k => k[0] === 'sag_post_slet') && raekke('h0001') && d.activeElement === rmKnap(raekke('h0001')));
  rmKnap(raekke('h0001')).click();
  rmPunkt(raekke('h0001'), 'slet').click();
  await ventTil(w, () => d.getElementById('dlg-slet-post') && d.getElementById('dlg-slet-post').hasAttribute('open'));
  dlg = d.getElementById('dlg-slet-post');
  [...dlg.querySelectorAll('button')].find(x => x.textContent === (da ? 'Slet' : 'Delete')).click();
  await ventTil(w, () => !raekke('h0001') && indholdRaekker(d).length === 3);
  const sk = s.kald.find(k => k[0] === 'sag_post_slet');
  tjek(`V-OPBYG.5 N2 (${sprog}): Slet sender plads og kode til Rust; rækken er væk, og meldingen nævner koden`, sk[1].nr === 0 && sk[1].kode === 'h0001' && besked().textContent === w.Sprog.TEKST[sprog].bPostSlettet.replace('{v}', 'h0001'), besked().textContent);
  // Er indholdet ændret imens (ukendt_post), siges det, og det hentes igen.
  rmKnap(raekke('user0001')).click();
  rmPunkt(raekke('user0001'), 'slet').click();
  await ventTil(w, () => d.getElementById('dlg-slet-post') && d.getElementById('dlg-slet-post').hasAttribute('open'));
  dlg = d.getElementById('dlg-slet-post');
  slet = { art: 'ukendt_post' };
  [...dlg.querySelectorAll('button')].find(x => x.textContent === (da ? 'Slet' : 'Delete')).click();
  await ventTil(w, () => besked().textContent === w.Sprog.TEKST[sprog].bIndholdAendret);
  tjek(`V-OPBYG.5 N2 (${sprog}): en forældet række (ukendt_post) giver en melding, og indholdet hentes igen`, besked().textContent === w.Sprog.TEKST[sprog].bIndholdAendret && raekke('user0001'));
  // En anden sag end den åbne: Kopiér værdi og Slet er slået fra med forklaring.
  aabenSag = false;
  w.GrimnirSager.visIndhold(null);
  await ventTil(w, () => indholdRaekker(d).length === 3);
  rmKnap(raekke('user0001')).click();
  const kp = rmPunkt(raekke('user0001'), 'kopier'), sp = rmPunkt(raekke('user0001'), 'slet');
  tjek(`V-OPBYG.5 N2 (${sprog}): i en sag, der kun læses, er Kopiér værdi og Slet slået fra med forklaring`, [kp, sp].every(x => x.getAttribute('aria-disabled') === 'true' && d.getElementById(x.getAttribute('aria-describedby')).textContent === w.Sprog.TEKST[sprog].hvorforKunAabenSag));
} })();

console.log(`\n${ok + fejl} tjek: ${ok} ok, ${fejl} fejl`);
process.exit(fejl ? 1 : 0);
