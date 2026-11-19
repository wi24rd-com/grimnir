// Fotobogens poster og det, siden får i stedet for Rust. Mønsteret er Huginn and Muninns tests/ui/sider.mjs (kun læst).
// De efterlignede Rust-svar er de samme som ui-roeg.mjs' (falsk-rust.mjs); her vælger hver post, hvilken af dem der svarer,
// og hvad der skal gøres på siden, før billedet tages. Kun opdigtede data (dokumentations-IP-områder, eksempel.dk).
// GR_REPO peger på en anden kopi af repoet, GR_NU sætter uret.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TEKST } from './falsk-rust.mjs';

const repo = process.env.GR_REPO || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/* Fast ur, så datoer og tidspunkter i billederne er ens fra kørsel til kørsel. Det går videre derfra, så ventetider virker.
   Datoerne i falsk-rust.mjs er enten regnet fra uret (sagernes udløb) eller skrevet med 2026 (noterne). */
export const NU_MS = Date.parse(process.env.GR_NU || '2026-11-14T09:30:00Z');
export const UR_STUB = `(()=>{const D=Date,n=${NU_MS},s=D.now();Date=class extends D{constructor(...a){if(a.length)super(...a);else super(n+D.now()-s)}static now(){return n+D.now()-s}}})();`;

/* Versionerne er programmets egne: fodlinjen og Om Grimnir viser den udgave, billederne beskriver. */
export const VERSION = JSON.parse(fs.readFileSync(path.join(repo, 'src-tauri', 'tauri.conf.json'), 'utf8')).version;
export const KERNE = /^version = "([^"]+)"/m.exec(fs.readFileSync(path.join(repo, 'grimnir-core', 'Cargo.toml'), 'utf8'))[1];

/* falsk-rust.mjs som et almindeligt script til siden: samme funktioner, uden "export". */
export const FALSK_KILDE = fs.readFileSync(path.join(repo, 'tests', 'ui', 'falsk-rust.mjs'), 'utf8').replace(/^export /gm, '');

/* Svar på det, ingen af de efterlignede Rust-svar har (som side() i ui-roeg.mjs, plus indstillingerne og ordbogen, så
   Noter kan bruge falskNoterRust). En kommando, der hverken står her eller i postens Rust, er en fejl i fotobogen. */
export const STANDARD = `{
  kerne_version: () => ${JSON.stringify(KERNE)},
  laas_status: () => ({ laast: false, igen: null, uden_doer: null }),
  aktivitet: () => null,
  sag_status: () => ({ poster: 0, id: null, navn: null, udloeb: null }),
  sag_liste: () => [],
  menu_sprog: () => null,
  noter_hent: () => ({ id: null, navn: null, noter: [], nr: null, maks_tegn: 4000, maks_antal: 200 }),
  indstillinger_hent: () => ({ masker_fremmede: false, bevar_sidste_oktet: true, udloeb_dage: null, guide_vist: true, laas_efter_min: 15 }),
  ordbog_hent: () => ({ poster: [], fejl: null }),
}`;

/* Hjælpere, siden får sammen med falsk-rust.mjs (SPROG er billedets sprog, sat af fotobog.mjs).
   medTekst: stederne i teksten (start, slut, række i UTF-16), som Rust giver dem, og som ui-roeg.mjs' falskMarkRust regner
   dem; falskRust giver ingen, og så står teksten uden markering. Analysen markerer værdierne (en hemmeligheds værdi hentes,
   som Vis gør, med raekke_vaerdi), maskeringen koderne for de rækker, der blev maskeret. Demaskér svarer som Rust ud fra
   koderne i svaret: de kendte sættes tilbage (tilbage: antal og første linje), en kode, sagen ikke kender, er en advarsel,
   og en kode fra sagen, der ikke står i svaret, er "ikke brugt" (falskRusts demasker svarer det samme uanset svaret).
   paaSprog: de data, en bruger selv skriver (sagernes navne, ordbogens noter, noterne, svaret), på billedets sprog. */
export const HJAELP = `const paaSprog = (da, en) => (SPROG === 'en' ? en : da);
function medTekst(r) {
  const find = (t, par) => { const ud = []; for (const [id, x] of par) { if (!x) continue; let i = -1; while ((i = t.indexOf(x, i + 1)) !== -1) ud.push([i, i + x.length, id]); } return ud.sort((a, b) => a[0] - b[0] || a[1] - b[1]); };
  const vaerdi = x => x.vaerdier[0] || (x.hemmelig ? r.raekke_vaerdi({ id: x.id }).vaerdier[0] : null);
  const linjeAf = (t, i) => (t.slice(0, i).match(/\\r\\n|\\r|\\n/g) || []).length + 1;
  let sidst = [], kort = [];
  return { ...r,
    analyser: a => { const s = r.analyser(a); sidst = s.raekker; return { ...s, steder: find(a.tekst, s.raekker.map(x => [x.id, vaerdi(x)])) }; },
    gem_og_masker: a => {
      const m = r.gem_og_masker(a), valgt = sidst.filter(x => (a.fravalgt ? !a.fravalgt.includes(x.id) : x.standard));
      kort = valgt.map(x => [x.koder[0], vaerdi(x)]);
      return { ...m, steder: find(m.maskeret, valgt.map(x => [x.id, x.koder[0]])) };
    },
    demasker: a => {
      const t0 = a.tekst; let t = t0;
      const brugt = kort.filter(([k]) => t0.includes(k));
      for (const [k, v] of brugt) t = t.split(k).join(v);
      const kendte = new Set(kort.map(([k]) => k));
      const ukendte = [...new Set(t0.match(/\\b(h\\d{4}|user\\d{4}|GRIMNIR_SECRET_\\d{4})\\b/g) || [])].filter(k => !kendte.has(k));
      const linjer = t0 === '' ? 0 : (t0.match(/\\r\\n|\\r|\\n/g) || []).length + (/[\\r\\n]$/.test(t0) ? 0 : 1);
      return {
        tekst: t, linjer, koder: brugt.map(([k]) => k),
        tilbage: brugt.map(([k]) => ({ kode: k, antal: t0.split(k).length - 1, linje: linjeAf(t0, t0.indexOf(k)) })),
        advarsler: [...ukendte.map(k => ({ art: 'ukendt_kode', kode: k, antal: t0.split(k).length - 1, linje: linjeAf(t0, t0.indexOf(k)) })),
          ...kort.filter(([k]) => !t0.includes(k)).map(([k]) => ({ art: 'ikke_brugt', kode: k, antal: 1, linje: 0 }))],
      };
    },
  };
}
/* En åben fil: uddraget er de første linjer af en opdigtet log uden hemmeligheden (falskFilRusts uddrag begynder med
   adgangskoden i klartekst, og uddraget vises, som filen er). Rækkerne er falskFilRusts (adresser i 10.20.0.0/16). I
   Demaskér er hver af uddragets 14 koder sat tilbage én gang, så tallene passer med teksten. */
const LOG = Array.from({ length: 14 }, (_, i) => '2026-11-14 08:' + (10 + i) + ':0' + (i % 10) + ' srcip=10.20.0.' + (i + 2) + ' dst=192.0.2.' + (10 + i) + ' msg=' + ['ok', 'ok', 'timeout', 'ok'][i % 4]);
function medFil(r) {
  const kode = l => l.replace(/10\\.20\\.0\\.(\\d+)/g, '198.18.0.$1');
  return { ...r,
    fil_aabn: async a => { const i = await r.fil_aabn(a); i.uddrag = (a.visning === 'masker' ? LOG : LOG.map(kode)).join('\\r\\n') + '\\r\\n'; return i; },
    fil_gem_og_masker: async a => ({ ...(await r.fil_gem_og_masker(a)), uddrag: LOG.map(kode).join('\\r\\n') + '\\r\\n' }),
    fil_demasker: async a => ({ ...(await r.fil_demasker(a)), uddrag: LOG.join('\\r\\n') + '\\r\\n', koder: LOG.map((_, i) => '198.18.0.' + (i + 2)), tilbage: LOG.map((_, i) => ({ kode: '198.18.0.' + (i + 2), antal: 1, linje: i + 1 })) }),
  };
}
const SAGER_SPROG = () => SAGER().map(x => ({ ...x, navn: paaSprog(x.navn, { 'Supportsag 0042': 'Support case 0042', 'Backup-script': 'Backup script', 'SQL-job fejler': 'SQL job failing', 'Firewall-log': 'Firewall log' }[x.navn] || x.navn) }));
const ORDBOG_SPROG = () => ORDBOG().map(p => ({ ...p, note: p.note && paaSprog(p.note, { 'hoveddomænet': 'main domain', projekt: 'project', printeren: 'the printer' }[p.note]) }));
const NOTER_SPROG = () => paaSprog(TO_NOTER(), [
  { nr: 1, tekst: 'Sent the masked log to the vendor (made-up case 4471).', oprettet: NOTE_MS },
  { nr: 2, tekst: 'They ask for the log from fw-syd02.\\nSame case.', oprettet: NOTE_MS + 1800000, rettet: NOTE_MS + 2400000 },
]);`;

// ── Data til posterne (opdigtede) ──
/* Svaret fra en leverandør med to af koderne fra den maskerede TEKST (falskRust: user0001 og 198.18.0.11) og én kode, sagen
   ikke kender (h0099): Demaskér advarer om den. Hemmeligheden (GRIMNIR_SECRET_0001) står ikke i svaret, så dens værdi ikke
   står i klartekst i billedet; den er "ikke i svaret". Linjerne er korte, så de står helt i det halve felt. */
export const SVAR = {
  da: 'Hej,\r\nuser0001 logger ind fra 198.18.0.11\r\nkl. 08.14, men bliver afvist.\r\nPrøv igen fra h0099, og send en ny log.\r\n',
  en: 'Hi,\r\nuser0001 signs in from 198.18.0.11\r\nat 08:14 but is rejected.\r\nPlease try again from h0099 and send a new log.\r\n',
};
/* Prøv på tekst: et ord fra ordbogen (Uglebo, typen Ord) og adressen fra "maskér aldrig". Ingen domæner: falskOrdbogRusts
   ordbog_proev giver hvert fund fra ordbogen typen Ord, og et domæne stod så med en forkert type i billedet. */
export const PROEVE = {
  da: 'Projekt Uglebo: backup kørt kl. 02.00\nprinteren 10.20.30.40 svarer ikke',
  en: 'Project Uglebo: backup ran at 02:00\nprinter 10.20.30.40 does not respond',
};

// ── Vælgere ──
const M = 'section[data-visning="masker"]', DM = 'section[data-visning="demasker"]', SG = 'section[data-visning="sager"]', OB = 'section[data-visning="ordbog"]';
const kmd = (v, id) => `#baand > [data-visning="${v}"] [data-kommando="${id}"]`;
const mere = v => `#baand > [data-visning="${v}"] .cb-mere`;
const raekke = id => `${M} .fundtabel tr[data-id="${id}"]`;
const sag = n => `${SG} .sagtabel tr[data-id="${String(n).repeat(32)}"]`;
const MED_SAGER = 'falskOrdbogRust({ poster: ORDBOG_SPROG(), sager: SAGER_SPROG(), indst: { guide_vist: true } })';
/* Standard: ordbogen uden poster, guiden er vist (ellers står guiden over billedet). */
export const STD_RUST = 'falskOrdbogRust({ indst: { guide_vist: true } })';

/* Trinene før billedet. En tekst er en vælger, der klikkes. { indsaet, tekst } indsætter som ⌘V (en paste-hændelse med
   teksten). { skriv, v } skriver i et felt. { vent } venter, til vælgeren er synlig. { hash } skifter visning som
   båndets faner. { tast, paa } trykker en tast på et element. { dobbelt } dobbeltklikker. Hvert trin venter selv op til
   4 s på sin vælger; rammer den ikke, er det en fejl. { rulTop } ruller et element til toppen (Om Grimnir er højere end
   vinduet og åbner med fokus på Luk nederst; billedet viser toppen, som når brugeren ruller op). */
const indsaetTekst = [{ indsaet: `${M} .tomt`, tekst: TEKST }, { vent: raekke(45) }];
const maskeret = [...indsaetTekst, kmd('masker', 'gem-masker'), { vent: `${kmd('masker', 'kopier')}:not([aria-disabled="true"])` }];

/* Hver post er ét billede. id giver filnavnet og bruges af vejledningen; det må ikke skifte. hash er visningen ved start
   (uden #). visning er den visning, der skal stå bagefter; den står på hver post (også når den er den samme som hash), så
   en forkert hash ikke giver et billede af en anden visning end postens navn. rust er den efterlignede Rust (et udtryk med
   funktionerne fra falsk-rust.mjs; standard: ordbogen uden poster). trin gøres før billedet, rod skal være synlig
   bagefter, og luk lukker igen i anden kørsel (det prøver, at dialogen kan lukkes). bredde giver et andet vindue,
   tekst en anden tekststørrelse (kittets lille | stor; standard: normal), sprog kun de sprog (standard: alle). */
export const SIDER = [
  /* Låseskærmen, før brugeren har svaret (Jan, 2026-11-15): laas_op svarer aldrig, så linjen er "Venter på Touch ID …",
     som mens macOS' dialog står åben, og ikke linjen efter et annulleret Touch ID. */
  { id: 'laas', navn: 'låseskærmen, før brugeren har svaret', hash: 'masker', visning: 'masker', rust: 'Object.assign(falskLaasRust(), { laas_op: () => new Promise(() => {}) })',
    trin: [{ vent: '#laas-besked[data-t="laasVenter"]' }], rod: '#laas' },
  { id: 'guide-1', navn: 'guiden, trin 1: Velkommen', hash: 'masker', visning: 'masker', rust: 'falskOrdbogRust({ indst: { guide_vist: false } })', rod: '#dlg-guide' },
  { id: 'guide-2', navn: 'guiden, trin 2: Dine domæner', hash: 'masker', visning: 'masker', rust: 'falskOrdbogRust({ indst: { guide_vist: false } })',
    trin: [{ vent: '#dlg-guide[open]' }, '#dlg-guide .fod .btn.primary', { skriv: '#guide-domaene', v: 'eksempel.dk' }, '#dlg-guide [data-t-aria="ariaTilfoejDomaene"]', { vent: '#dlg-guide .guide-liste li' }], rod: '#guide-domaene' },
  { id: 'guide-3', navn: 'guiden, trin 3: Dine net og maskiner', hash: 'masker', visning: 'masker', rust: 'falskOrdbogRust({ indst: { guide_vist: false } })',
    trin: [{ vent: '#dlg-guide[open]' }, '#dlg-guide .fod .btn.primary', '#dlg-guide .fod .btn.primary', { skriv: '#guide-net', v: '192.0.2.0/24' }, '#dlg-guide [data-t-aria="ariaTilfoejNet"]', { skriv: '#guide-moenster', v: 'srv-###' }, '#dlg-guide [data-t-aria="ariaTilfoejMoenster"]', { vent: '#dlg-guide .guide-liste li + li' }], rod: '#guide-net' },
  { id: 'masker-tom', navn: 'Maskér uden tekst', hash: 'masker', visning: 'masker', rod: `${M} .tomt` },
  { id: 'masker-fund', navn: 'Maskér med fund', hash: 'masker', visning: 'masker', rust: 'medTekst(falskRust())', trin: indsaetTekst, rod: `${M} .fundtabel` },
  { id: 'masker-valgt', navn: 'Maskér med en valgt række', hash: 'masker', visning: 'masker', rust: 'medTekst(falskRust())', trin: [...indsaetTekst, `${raekke(24)} td:nth-child(3)`, { vent: `${raekke(24)}[aria-selected="true"]` }], rod: `${raekke(24)}[aria-selected="true"]` },
  { id: 'masker-hemmelighed', navn: 'Maskér med en hemmelighed vist', hash: 'masker', visning: 'masker', rust: 'medTekst(falskRust())', trin: [...indsaetTekst, `${raekke(45)} [data-felt="vis"]`, { vent: `${raekke(45)}:not(:has(.prikker))` }], rod: raekke(45) },
  { id: 'masker-raekkemenu', navn: 'Maskér med rækkens "…"', hash: 'masker', visning: 'masker', rust: 'medTekst(falskRust())', trin: [...indsaetTekst, `${raekke(24)} [data-felt="handlinger"].mere-knap`], rod: `${raekke(24)} .raekke-menu` },
  { id: 'masker-maskeret', navn: 'Maskér efter maskeringen', hash: 'masker', visning: 'masker', rust: 'medTekst(falskRust())', trin: maskeret, rod: `${M} .fundtabel` },
  { id: 'masker-fil', navn: 'Maskér med en åben fil', hash: 'masker', visning: 'masker', rust: 'medFil(falskFilRust({ antal: 1200 }))', trin: [kmd('masker', 'aabn-fil'), { vent: `${M} .fundtabel tr[data-id="40"]` }], rod: `${M} .fundtabel` },
  /* Normal tekststørrelse og kun dansk (Jan, 2026-11-15): målt i V-DOK.1 står næste skridt kun under Mere på dansk ved
     1024 px; på engelsk står Kopiér i båndet ved den bredde. */
  { id: 'masker-mere', navn: 'Maskér i et smalt vindue: næste skridt under Mere', hash: 'masker', visning: 'masker', rust: 'medFil(falskFilRust({ antal: 1200 }))', bredde: 1024, sprog: ['da'],
    trin: [kmd('masker', 'aabn-fil'), { vent: `${M} .fundtabel tr[data-id="40"]` }, kmd('masker', 'gem-masker'), { vent: `${mere('masker')}[data-naeste]` }, mere('masker')], rod: `${mere('masker')}[data-naeste]` },
  { id: 'demasker-tom', navn: 'Demaskér uden svar', hash: 'demasker', visning: 'demasker', rod: `${DM} .tomt` },
  { id: 'demasker-resultat', navn: 'Demaskér med resultat og en advarsel', hash: 'masker', visning: 'demasker', rust: 'medTekst(falskRust())',
    trin: [...maskeret, { hash: 'demasker' }, { indsaet: `${DM} .tomt`, tekst: SVAR }, { vent: `${kmd('demasker', 'demasker')}:not([aria-disabled="true"])` }, kmd('demasker', 'demasker'), { vent: `${kmd('demasker', 'kopier-resultat')}:not([aria-disabled="true"])` }], rod: `${DM} .bannere, ${DM} [role="alert"]` },
  { id: 'noter-tom', navn: 'Noter uden noter', hash: 'noter', visning: 'noter', rust: 'falskNoterRust()', rod: 'section[data-visning="noter"]' },
  { id: 'noter', navn: 'Noter med to noter', hash: 'noter', visning: 'noter', rust: 'falskNoterRust({ noter: NOTER_SPROG() })', trin: [{ vent: 'section[data-visning="noter"] li.note' }], rod: 'section[data-visning="noter"] li.note' },
  { id: 'sager', navn: 'Sager', hash: 'sager', visning: 'sager', rust: MED_SAGER, trin: [{ vent: sag(1) }], rod: `${SG} .sagtabel` },
  { id: 'sag-indhold', navn: 'sagens indhold', hash: 'sager', visning: 'sager', rust: MED_SAGER, trin: [sag(1), kmd('sager', 'vis-indhold'), { vent: `${SG} tr[data-nr]` }], rod: `${SG} tr[data-nr]` },
  { id: 'sag-ny-dialog', navn: 'dialogen Ny sag', hash: 'sager', visning: 'sager', rust: MED_SAGER, trin: [{ vent: sag(1) }, kmd('sager', 'ny-sag'), { skriv: '#ny-sag-navn', v: { da: 'Supportsag 0043', en: 'Support case 0043' } }], rod: '#dlg-ny-sag', luk: '#dlg-ny-sag [data-svar="annuller"]' },
  { id: 'sag-udloeb-dialog', navn: 'dialogen Udløb', hash: 'sager', visning: 'sager', rust: MED_SAGER, trin: [sag(2), kmd('sager', 'udloeb')], rod: '#dlg-udloeb', luk: '#dlg-udloeb [data-svar="annuller"]' },
  { id: 'sag-slet-dialog', navn: 'bekræftelsen Slet sag', hash: 'sager', visning: 'sager', rust: MED_SAGER, trin: [sag(3), kmd('sager', 'slet-sag')], rod: '#dlg-slet', luk: '#dlg-slet [data-svar="nej"]' },
  { id: 'post-slet-dialog', navn: 'bekræftelsen Slet en post i sagens indhold', hash: 'sager', visning: 'sager', rust: MED_SAGER,
    trin: [sag(1), kmd('sager', 'aabn-i-masker'), { vent: '#sagdel-erst:not([aria-disabled="true"])' }, '#sagdel-erst', { vent: `${SG} tr[data-nr] [data-felt="handlinger"]` }, `${SG} tr[data-nr] [data-felt="handlinger"]`, `${SG} tr[data-nr] [data-punkt="slet"]`], rod: '#dlg-slet-post', luk: '#dlg-slet-post [data-svar="nej"]' },
  { id: 'ordbog', navn: 'Ordbog', hash: 'ordbog', visning: 'ordbog', rust: MED_SAGER, trin: [{ vent: `${OB} .ordbogtabel tr[data-id]` }], rod: `${OB} .ordbogtabel` },
  { id: 'ordbog-post-dialog', navn: 'dialogen Tilføj post', hash: 'ordbog', visning: 'ordbog', rust: MED_SAGER, trin: [{ vent: `${OB} .ordbogtabel tr[data-id]` }, kmd('ordbog', 'tilfoej-post')], rod: '#dlg-opost', luk: '#dlg-opost [data-svar="annuller"]' },
  { id: 'ordbog-proev-dialog', navn: 'dialogen Prøv på tekst', hash: 'ordbog', visning: 'ordbog', rust: MED_SAGER, trin: [{ vent: `${OB} .ordbogtabel tr[data-id]` }, kmd('ordbog', 'proev'), { skriv: '#dlg-proev textarea', v: PROEVE }, '#dlg-proev [data-svar="proev"]'], rod: '#dlg-proev', luk: '#dlg-proev [data-svar="luk"]' },
  /* Dialoger, brugeren kan nå, som ikke stod i planens liste (V-DOK.1 N2). */
  { id: 'sag-dialog', navn: 'sagens dialog fra titellinjen (midlertidig sag)', hash: 'masker', visning: 'masker', rust: 'medTekst(' + MED_SAGER + ')', trin: [...maskeret, '#sag-knap'], rod: '#dlg-sag', luk: '#dlg-sag [data-svar="luk"]' },
  { id: 'sag-omdoeb-dialog', navn: 'dialogen Omdøb', hash: 'sager', visning: 'sager', rust: MED_SAGER, trin: [sag(2), kmd('sager', 'omdoeb')], rod: '#dlg-omdoeb', luk: '#dlg-omdoeb [data-svar="annuller"]' },
  { id: 'sag-kasser-dialog', navn: 'spørgsmålet Gem den midlertidige sag?, før en anden sag åbnes', hash: 'masker', visning: 'sager', rust: 'medTekst(' + MED_SAGER + ')',
    trin: [...maskeret, { hash: 'sager' }, sag(1), kmd('sager', 'aabn-i-masker')], rod: '#dlg-kasser', luk: '#dlg-kasser [data-svar="annuller"]' },
  { id: 'note-slet-dialog', navn: 'bekræftelsen Slet note', hash: 'noter', visning: 'noter', rust: 'falskNoterRust({ noter: NOTER_SPROG() })', trin: ['section[data-visning="noter"] li.note', kmd('noter', 'slet-note')], rod: '#dlg-slet-note', luk: '#dlg-slet-note [data-svar="nej"]' },
  { id: 'ordbog-fjern-dialog', navn: 'bekræftelsen Fjern post', hash: 'ordbog', visning: 'ordbog', rust: MED_SAGER, trin: [`${OB} .ordbogtabel tr[data-id="4"]`, kmd('ordbog', 'fjern-post')], rod: '#dlg-ofjern', luk: '#dlg-ofjern [data-svar="nej"]' },
  { id: 'masker-ryd-dialog', navn: 'bekræftelsen Ryd efter maskeringen', hash: 'masker', visning: 'masker', rust: 'medTekst(falskRust())', trin: [...maskeret, kmd('masker', 'ryd')], rod: '#dlg-ryd', luk: '#dlg-ryd [data-svar="nej"]' },
  { id: 'demasker-fil-gem-dialog', navn: 'bekræftelsen Gem som fil i Demaskér (rigtige værdier i klartekst)', hash: 'demasker', visning: 'demasker', rust: "Object.assign(medFil(falskFilRust({ antal: 12 })), { sag_status: () => ({ poster: 14, id: null, navn: null, udloeb: null }) })",
    trin: [kmd('demasker', 'aabn-fil'), { vent: `${kmd('demasker', 'demasker')}:not([aria-disabled="true"])` }, kmd('demasker', 'demasker'), { vent: `${kmd('demasker', 'gem-fil')}:not([aria-disabled="true"])` }, kmd('demasker', 'gem-fil')], rod: '#dlg-demfil', luk: '#dlg-demfil [data-svar="nej"]' },
  { id: 'indstillinger-dialog', navn: 'dialogen Indstillinger', hash: 'masker', visning: 'masker', trin: ['#aabn-indst'], rod: '#dlg-indst', luk: '#dlg-indst [data-svar="luk"]' },
  { id: 'om-dialog', navn: 'dialogen Om Grimnir', hash: 'masker', visning: 'masker', trin: ['#aabn-om', { rulTop: '#dlg-om[open]' }], rod: '#dlg-om', luk: '#dlg-om [data-svar="luk"]' },
];
