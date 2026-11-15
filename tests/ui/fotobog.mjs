// Fotobog: et skærmbillede af hver post i sider.mjs, i headless Chrome, uden at starte programmet og uden netværk ud af
// maskinen. Mønsteret er Huginn and Muninns tests/ui/fotobog.mjs (kun læst). Brug: npm run test:foto.
// Matrix: lyst tema × dansk og engelsk × 1200×860 for alle poster; mørkt tema kun for masker-fund (begge sprog). En post
// med bredde (masker-mere) tages i den bredde. GR_FOTO_MATRIX=lille giver kun lyst tema på dansk. GR_FOTO_KUN=id,id tager
// kun de poster. Output: tests/ui/out/<dato>/fotobog/<id>--<tema>-<sprog>-<BxH>.png + manifest.json; GR_FOTO_UD
// overstyrer mappen. GR_CHROME peger på Chrome, GR_REPO på en anden kopi af repoet, GR_NU sætter uret (sider.mjs).
// Hver post hentes to gange: første gang tager billedet, anden gang (--dump-dom) gør det samme igen, henter fejlene ud og
// tjekker, at siden viser den visning og det element, posten siger, og at en dialog kan lukkes. Exit 1 ved en fejl, eller
// hvis et billede mangler, har en forkert størrelse eller er under 5 KB.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';

const repo = process.env.GR_REPO || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
process.env.GR_REPO = repo;
const { SIDER, UR_STUB, NU_MS, VERSION, KERNE, FALSK_KILDE, STANDARD, HJAELP, STD_RUST } = await import('./sider.mjs');

const CHROME = [process.env.GR_CHROME, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].find(f => f && fs.existsSync(f));
if (!CHROME) { console.log('Chrome findes ikke (sæt GR_CHROME)'); process.exit(1); }
const MINDST = 5 * 1024, BUDGET = 9000, VENT = 2500, TID = 60000;
const lille = process.env.GR_FOTO_MATRIX === 'lille';
const kun = process.env.GR_FOTO_KUN ? process.env.GR_FOTO_KUN.split(',') : null;
const SPROG = lille ? ['da'] : ['da', 'en'];
/* Mørkt tema kun for én post (planen): resten er lyst. Temaets navn i filen er HAM's (light/dark); i localStorage Grimnirs. */
const MOERK = new Set(lille ? [] : ['masker-fund']);
const TEMA_NOEGLE = { light: 'lys', dark: 'moerk' };
const HOEJDE = 860, BREDDE = 1200;

/* Mappen hedder efter kørslens rigtige dato, ikke testens ur: billederne skal kunne findes igen. */
const nu = new Date(), to = n => String(n).padStart(2, '0'), dato = `${nu.getFullYear()}-${to(nu.getMonth() + 1)}-${to(nu.getDate())}`;
const ud = path.resolve(process.env.GR_FOTO_UD || path.join(repo, 'tests', 'ui', 'out', dato, 'fotobog'));
fs.mkdirSync(ud, { recursive: true });
const profiler = fs.mkdtempSync(path.join(os.tmpdir(), 'gr-foto-'));
const linje = (cmd, ...a) => { const r = spawnSync(cmd, a, { encoding: 'utf8' }); return r.status === 0 ? r.stdout.trim() : null; };

/* Fanger fejl fra første linje, før noget af programmet er kørt. CSP-brud og filer, der ikke kan hentes, tæller også: så ser
   billedet forkert ud uden at kaste. Én melding er ikke en fejl, men står i manifestet (stoej): Chromes "ResizeObserver
   loop completed with undelivered notifications", som kittets bånd giver, når det flytter knapper til Mere i et smalt
   vindue (ui/assets/kit.js, commandBar: ResizeObserver → tilpas). Meldingen siger kun, at målingen kommer i næste
   billede; programmet kan ikke rettes herfra (HANDOFF-V-DOK.1, sideeffekt-fund). */
const STOEJ = 'ResizeObserver loop completed with undelivered notifications.';
const FANG = `(()=>{window.__GR_FEJL__=[];window.__GR_STOEJ__=[];const f=(k,a)=>__GR_FEJL__.push((k+': '+a.map(x=>(x&&x.stack)||(x&&typeof x==='object'?JSON.stringify(x):String(x))).join(' ')).slice(0,500));
window.onerror=(m,fil,l,c)=>{if(m===${JSON.stringify(STOEJ)}){__GR_STOEJ__.push(m);return}f('onerror',[m,fil,l,c])};addEventListener('unhandledrejection',e=>f('unhandledrejection',[e.reason]));
addEventListener('error',e=>{if(e.target!==window)f('ressource',[e.target.src||e.target.href||e.target.tagName])},true);
addEventListener('securitypolicyviolation',e=>f('csp',[e.effectiveDirective,e.blockedURI]));
for(const m of['error','warn']){const o=console[m];console[m]=(...a)=>{f('console.'+m,a);o.apply(console,a)}}})();`;

/* Det, Rust og Tauri giver siden: valgene i localStorage (Grimnirs nøgler), platformen som init-scriptet sætter den
   (programmenu::platform_skript), og __TAURI__ med core.invoke, event.listen og app.getVersion. Programmet starter låst
   (<html data-laast>); laas_status svarer "låst op" undtagen i posten laas. */
const stub = (post, tema, sprog, tjek) => `${UR_STUB}${FANG}
localStorage.setItem('grimnir-sprog',${JSON.stringify(sprog)});localStorage.setItem('grimnir-tema',${JSON.stringify(TEMA_NOEGLE[tema])});${post.tekst ? `localStorage.setItem('grimnir-tekst',${JSON.stringify(post.tekst)});` : `localStorage.removeItem('grimnir-tekst');`}
Object.defineProperty(window,'__GRIMNIR_PLATFORM__',{value:'macos'});document.documentElement.setAttribute('data-platform','macos');
window.__GR_POST__=${JSON.stringify(post)};window.__GR_TJEK__=${tjek};window.__GR_SPROG__=${JSON.stringify(sprog)};window.__GR_KLAR__=new Promise(r=>document.addEventListener('DOMContentLoaded',()=>r(),{once:true}));`;
/* Svaret kommer i en senere opgave og først, når alle scripts er indlæst (DOMContentLoaded): et svar før det kunne komme,
   før noter.js var indlæst, og så gik sagens status (grimnir-sag) efter oplåsningen forbi noter.js, og noterne blev ikke
   hentet (set i 1 af 2 kørsler af noter-tom). I programmet kommer oplåsningen først efter Touch ID; jsdom i ui-roeg.mjs
   indlæser alle scripts, før noget løfte opfyldes. (HANDOFF-V-DOK.1, sideeffekt-fund.) Der ventes på selve hændelsen, ikke
   på document.readyState: den er "interactive", allerede før de udskudte scripts (defer) har kørt. */
const rustStub = (post, sprog) => `(()=>{const SPROG=${JSON.stringify(sprog)};${HJAELP}
const F=window.__GR_FEJL__;const RUST=Object.assign(${STANDARD},${post.rust || STD_RUST});
const kopi=x=>x===undefined?null:JSON.parse(JSON.stringify(x)),senere=()=>window.__GR_KLAR__.then(()=>new Promise(r=>setTimeout(r,0)));
window.__TAURI__={core:{invoke:async(c,a)=>{await senere();const f=RUST[c];if(typeof f!=='function'){F.push('ukendt kommando: '+c);throw{art:'ukendt_kommando'}}return kopi(await f(a||{}))}},
event:{listen:async()=>()=>{}},app:{getVersion:async()=>${JSON.stringify(VERSION)}}};})();`;

/* Trinene gøres før billedet (sider.mjs). Anden kørsel venter næsten lige så længe som billedet og tjekker så visningen og
   rod, og at luk lukker: ellers viser billedet noget andet end sit navn, uden at noget fejler. */
const GANG = `addEventListener('load', async () => {
  const sov = ms => new Promise(r => setTimeout(r, ms)), v = window.__GR_POST__, F = window.__GR_FEJL__;
  /* En tekst kan stå pr. sprog ({ da, en }): det, brugeren selv skriver eller indsætter, er på billedets sprog. */
  const paaSprog = x => (x && typeof x === 'object' ? x[window.__GR_SPROG__] : x);
  const find = async (sel, maks = 4000) => { for (let t = 0; t <= maks; t += 50) { const e = [...document.querySelectorAll(sel)].find(x => x.checkVisibility()); if (e) return e; await sov(50); } return null; };
  await sov(350);
  for (const t of v.trin || []) {
    const sel = typeof t === 'string' ? t : t.indsaet || t.skriv || t.vent || t.dobbelt || t.paa || t.rulTop;
    if (t.hash) { location.hash = t.hash; await sov(250); continue; }
    const e = await find(sel);
    if (!e) { F.push('gennemløb: trinet rammer ikke ' + sel); break; }
    if (typeof t === 'string') e.click();
    else if (t.indsaet) { const dt = new DataTransfer(); dt.setData('text/plain', paaSprog(t.tekst)); e.focus(); e.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); }
    else if (t.skriv) { e.focus(); e.value = paaSprog(t.v); e.dispatchEvent(new Event('input', { bubbles: true })); }
    else if (t.dobbelt) e.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    else if (t.tast) e.dispatchEvent(new KeyboardEvent('keydown', { key: t.tast, bubbles: true, cancelable: true }));
    else if (t.rulTop) e.scrollTop = 0;
    await sov(150);
  }
  if (!window.__GR_TJEK__) return;
  await sov(${VENT});
  const set = [...document.querySelectorAll('section.visning:not([hidden])')].map(e => e.dataset.visning).join(), vil = v.visning;
  if (set !== vil) F.push('gennemløb: viser ' + (set || 'ingenting') + ', ikke ' + vil);
  const rod = v.rod ? [...document.querySelectorAll(v.rod)].find(x => x.checkVisibility()) : null;
  if (v.rod && !rod) F.push('gennemløb: rod er ikke synlig: ' + v.rod);
  /* En åben dialog, posten ikke nævner (fx guiden over en tom visning), dækker billedet: rod står stadig "synlig" bag den. */
  for (const d of document.querySelectorAll('dialog[open]')) if (!(rod && (d.contains(rod) || rod.contains(d)))) F.push('gennemløb: en dialog står åben, som posten ikke nævner: ' + (d.id || d.className));
  if (v.luk) { const e = document.querySelector(v.luk); if (e) { e.click(); await sov(300); if (document.querySelector('dialog[open]')) F.push('gennemløb: luk lukkede ikke ' + v.luk); } else F.push('gennemløb: luk rammer ikke ' + v.luk); }
  document.body.textContent = 'MAALT:' + JSON.stringify({ fejl: F, stoej: window.__GR_STOEJ__ }) + ':SLUT';
});`;

const CSP = JSON.parse(fs.readFileSync(path.join(repo, 'src-tauri', 'tauri.conf.json'), 'utf8')).app.security.csp;
const typer = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const uiMappe = path.join(repo, 'ui'), index = fs.readFileSync(path.join(uiMappe, 'index.html'), 'utf8');
/* Kun til billederne: tekstmarkøren blinker og stod med i nogle billeder og ikke i andre. Den gøres gennemsigtig; resten
   af siden er programmets egen CSS. */
const FOTO_CSS = '*, *::before, *::after { caret-color: transparent !important; }\n';
const genereret = new Map([['foto-gang.js', GANG], ['falsk-rust.js', FALSK_KILDE], ['foto.css', FOTO_CSS]]);
const FOERSTE = '<script src="assets/tema.js"></script>';
if (!index.includes(FOERSTE) || !index.includes('</body>') || !index.includes('</head>')) { console.log('ui/index.html: kan ikke finde ' + FOERSTE); process.exit(1); }
/* Kun 127.0.0.1, og kun filerne i ui/ og det, testen selv laver. Programmets CSP står som header på hvert svar. */
const vaert = http.createServer((q, s) => {
  const sti = decodeURIComponent(new URL(q.url, 'http://x').pathname).slice(1), f = path.join(uiMappe, sti), g = genereret.get(sti);
  if (g === undefined && (!f.startsWith(uiMappe + path.sep) || !fs.existsSync(f))) { s.writeHead(404); return s.end(); }
  s.writeHead(200, { 'Content-Type': typer[path.extname(sti)] || 'application/octet-stream', 'Content-Security-Policy': CSP });
  s.end(g === undefined ? fs.readFileSync(f) : g);
});
await new Promise(r => vaert.listen(0, '127.0.0.1', r));

/* TZ=UTC, så datoerne på siderne står ens på alle maskiner. Chrome uden baggrundstrafik, synkronisering, udvidelser og
   crash-rapporter: intet skal ud af maskinen, og Chromes crashpad-hjælper kunne blive hængende efter Chrome og holde et rør
   åbent. Derfor skriver Chrome også til en fil (ikke et rør), og der ventes på, at Chrome selv er færdig ('exit'). */
/* Browserens sprog følger billedets; en-GB som programmets egne datoer på engelsk (noter.js). Målt i V-DOK.1: på macOS
   ændrer --lang ikke datofeltets format (det står dd/mm/yyyy på begge sprog), og Cocoas -AppleLanguages/-AppleLocale gav
   ingen billeder (Chrome exit 13). HANDOFF-V-DOK.1, spørgsmål til Jan. */
const LANG = { da: 'da-DK', en: 'en-GB' };
const CHROME_FLAG = ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--disable-background-networking', '--disable-component-update', '--disable-sync', '--disable-crash-reporter', '--disable-breakpad', '--metrics-recording-only', '--force-device-scale-factor=1'];
const chrome = (profil, sprog, args) => new Promise(ok => {
  fs.mkdirSync(profil, { recursive: true });
  const udFil = path.join(profil, 'stdout.txt'), fd = fs.openSync(udFil, 'w');
  const p = spawn(CHROME, [...CHROME_FLAG, `--lang=${LANG[sprog]}`, `--user-data-dir=${profil}`, `--virtual-time-budget=${BUDGET}`, ...args], { env: { ...process.env, TZ: 'UTC' }, stdio: ['ignore', fd, 'ignore'] });
  fs.closeSync(fd);
  const ur = setTimeout(() => p.kill('SIGKILL'), TID);
  p.on('exit', (kode, signal) => { clearTimeout(ur); ok({ tekst: fs.readFileSync(udFil, 'utf8'), kode, signal }); });
});

const side = (n, post, tema, sprog, tjek) => {
  const navn = `foto-${n}-${tjek ? 'tjek' : 'billede'}`;
  genereret.set(`${navn}-stub.js`, stub(post, tema, sprog, tjek));
  genereret.set(`${navn}-rust.js`, rustStub(post, sprog));
  genereret.set(`${navn}.html`, index.replace(FOERSTE, `<script src="${navn}-stub.js"></script><script src="falsk-rust.js"></script><script src="${navn}-rust.js"></script>${FOERSTE}`).replace('</head>', '<link rel="stylesheet" href="foto.css"></head>').replace('</body>', '<script src="foto-gang.js"></script></body>'));
  return `http://127.0.0.1:${vaert.address().port}/${navn}.html#${post.hash}`;
};

const ukendt = kun ? kun.filter(id => !SIDER.some(p => p.id === id)) : [];
if (ukendt.length) { console.log('GR_FOTO_KUN: ukendte poster: ' + ukendt.join(', ')); process.exit(1); }
const udenVisning = SIDER.filter(p => !p.visning || !p.hash).map(p => p.id);
if (udenVisning.length) { console.log('sider.mjs: poster uden hash eller visning: ' + udenVisning.join(', ')); process.exit(1); }
const poster = SIDER.filter(p => !kun || kun.includes(p.id));
const opgaver = poster.flatMap(post => ['light', ...(MOERK.has(post.id) ? ['dark'] : [])].flatMap(tema => SPROG.map(sprog => ({ post, tema, sprog, bredde: post.bredde || BREDDE, hoejde: HOEJDE }))));
const billeder = new Array(opgaver.length);
const tag = async ({ post, tema, sprog, bredde, hoejde }, n) => {
  const fil = `${post.id}--${tema}-${sprog}-${bredde}x${hoejde}.png`, sti = path.join(ud, fil), profil = path.join(profiler, String(n)), vindue = `--window-size=${bredde},${hoejde}`, fejl = [];
  /* Headless Chrome hænger en sjælden gang (målt: 2 af ca. 280 kørsler, uden fejl på siden) og dræbes efter TID. Så prøves
     den kørsel én gang til; det står i manifestet (forsoeg) og i udskriften, så en gentagelse ikke skjules. */
  let foto, m, forsoeg = [0, 0];
  do { forsoeg[0]++; fs.rmSync(sti, { force: true }); /* et billede fra en tidligere kørsel må ikke tælle som dette */
    foto = await chrome(profil, sprog, [`--screenshot=${sti}`, vindue, side(n, post, tema, sprog, false)]); } while (forsoeg[0] < 2 && !fs.existsSync(sti));
  do { forsoeg[1]++; m = /MAALT:(.*):SLUT/s.exec((await chrome(profil, sprog, [vindue, '--dump-dom', side(n, post, tema, sprog, true)])).tekst); } while (forsoeg[1] < 2 && !m);
  for (const k of [`foto-${n}-billede`, `foto-${n}-tjek`]) for (const x of ['.html', '-stub.js', '-rust.js']) genereret.delete(k + x);
  const maalt = m ? JSON.parse(m[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')) : null;
  if (maalt) fejl.push(...maalt.fejl); else fejl.push('gennemløb: siden svarede ikke');
  const png = fs.existsSync(sti) ? fs.readFileSync(sti) : null;
  if (!png) fejl.push(`billedet mangler (Chrome: exit ${foto.kode}, signal ${foto.signal})`); else if (png.length < MINDST) fejl.push(`billedet er kun ${png.length} bytes`);
  else if (png.readUInt32BE(16) !== bredde || png.readUInt32BE(20) !== hoejde) fejl.push(`billedet er ${png.readUInt32BE(16)}×${png.readUInt32BE(20)}, ikke ${bredde}×${hoejde}`);
  billeder[n] = { id: post.id, navn: post.navn, hash: post.hash, tema, sprog, bredde, hoejde, fil, bytes: png ? png.length : 0, fejl, stoej: maalt ? maalt.stoej.length : 0, forsoeg };
};

let naeste = 0;
const arbejder = async () => { while (naeste < opgaver.length) { const n = naeste++; await tag(opgaver[n], n); } };
await Promise.all(Array.from({ length: Math.max(2, Math.min(6, os.availableParallelism() >> 1)) }, arbejder));
vaert.close();
fs.rmSync(profiler, { recursive: true, force: true });

fs.writeFileSync(path.join(ud, 'manifest.json'), JSON.stringify({ dato, commit: linje('git', '-C', repo, 'log', '-1', '--format=%h'), chrome: linje(CHROME, '--version'), ur: new Date(NU_MS).toISOString(), version: VERSION, kerne: KERNE, billeder }, null, 2) + '\n');
const daarlige = billeder.filter(b => b.fejl.length);
for (const b of daarlige) console.log(`FEJL ${b.fil}: ${b.fejl.slice(0, 3).join(' | ')}`);
const gentaget = billeder.filter(b => b.forsoeg.some(x => x > 1));
if (gentaget.length) console.log(`gentaget (Chrome hang og blev prøvet igen): ${gentaget.map(b => `${b.fil} [billede ${b.forsoeg[0]}, tjek ${b.forsoeg[1]}]`).join(', ')}`);
const stoej = billeder.filter(b => b.stoej);
if (stoej.length) console.log(`støj (ikke fejl): "${STOEJ}" i ${stoej.map(b => b.fil).join(', ')}`);
console.log(`${billeder.length} billeder, ${daarlige.length} med fejl, mappe: ${ud}`);
process.exit(daarlige.length ? 1 : 0);
