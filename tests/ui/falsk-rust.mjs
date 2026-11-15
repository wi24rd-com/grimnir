// De efterlignede Rust-svar, fælles for ui-roeg.mjs (jsdom) og fotobogen (sider.mjs, fotobog.mjs: headless Chrome).
// V-DOK.1: flyttet uændret hertil fra ui-roeg.mjs. Filen må ikke importere noget og ikke bruge Node: fotobogen sender den
// til siden som et almindeligt script (uden "export "), så de samme funktioner svarer i browseren. Kun opdigtede data.

/* En opdigtet tekst med CRLF og en efterlignet Rust, der svarer som src-tauri/src/maskering.rs (samme felter). */
export const TEKST = 'srcip=10.20.30.11 user="bruger060"\r\nPassword=Sommer2026!;\r\nversion 10.2.3.4\r\n';
export const HEMMELIG = 'Sommer2026!';
export function falskRust({ rester = [], afvis = null } = {}) {
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

/* Lokal dato om n dage (ÅÅÅÅ-MM-DD), som sager.js regner. */
export const datoOm = n => { const t = new Date(); t.setDate(t.getDate() + n); return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0'); };
export const hexId = n => String(n).repeat(32).slice(0, 32);
/* Efterlignet Rust for sagerne (samme felter som SagStatus og SagListePost i src-tauri/src/maskering.rs). Maskér og
   Demaskér går til falskRust. */
export function falskSagRust({ sager = [], konflikt = false } = {}) {
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
export function indholdPoster(n) {
  const TYPER = ['vaert', 'bruger', 'hemmelighed', 'ipv4_egen'];
  const ud = Array.from({ length: n }, (_, i) => {
    const t = TYPER[i % 4], k = String(Math.floor(i / 4) + 1).padStart(4, '0');
    const [kode, vaerdi] = { vaert: [`h${k}`, `srv-opdigtet-${k}`], bruger: [`user${k}`, `bruger-${k}`], hemmelighed: [`GRIMNIR_SECRET_${k}`, `Hemmelig-${k}!`], ipv4_egen: [`198.18.0.${(i % 250) + 1}`, `10.20.30.${(i % 250) + 1}`] }[t];
    return { nr: i, type: t, kode, vaerdi, hemmelig: t === 'hemmelighed', aliaser: i === 0 ? ['h9001'] : [], rettet: i === 0 };
  });
  return ud.sort((a, b) => TYPER.indexOf(a.type) - TYPER.indexOf(b.type));
}
export const SAGER = () => [
  { id: hexId(1), navn: 'Supportsag 0042', poster: 214, udloeb: null },
  { id: hexId(2), navn: 'Backup-script', poster: 17, udloeb: datoOm(3) },
  { id: hexId(3), navn: 'SQL-job fejler', poster: 42, udloeb: datoOm(-1) },
  { id: hexId(4), navn: null, poster: 0, fejl: { art: 'mangler_noegle' } },
  { id: hexId(5), navn: 'Firewall-log', poster: 9, udloeb: datoOm(60) },
];

/* Efterlignet Rust for ordbogen og indstillingerne (samme felter som OrdbogUd, OrdbogPost, FeltFejl, Proeve og
   Indstillinger i src-tauri/src/). Valideringen er et udsnit af Rusts (ordbog.rs), nok til at vise fejlene pr. felt.
   Analysen følger ordbogen: "maskér aldrig" fjerner rækken, "maskér altid" giver status ordbog. Kun opdigtede værdier. */
export function falskOrdbogRust({ poster = [], indst = {}, laast = null, sager = [], gemFejl = false } = {}) {
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
export const ORDBOG = () => [
  { type: 'domaene', vaerdi: 'kontor.test', note: 'hoveddomænet' },
  { type: 'navnemoenster', vaerdi: 'srv-###' },
  { type: 'eget_net', vaerdi: '10.20.0.0/16' },
  { type: 'ord', vaerdi: 'Uglebo', note: 'projekt' },
  { type: 'aldrig', vaerdi: '10.20.30.40', note: 'printeren' },
  { type: 'aldrig', vaerdi: 'localhost' },
];

/* Efterlignet Rust for filerne (samme felter som FilInfo, FilAnalyse, RaekkeSide, FilMaskering, FilDemaskering i
   src-tauri/src/maskering.rs). Filen har `antal` rækker (opdigtede adresser i 10.20.0.0/16 og én hemmelighed); søgning,
   filter og sider sker "i Rust" (her), så testen kan se, at webvisningen beder om dem i stedet for selv at have alle
   rækker. Ingen stier: Rust sender kun filnavnet. */
export function falskFilRust({ antal = 1200, rester = [], forsinkelse = 0, kopierbar = true } = {}) {
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
  const side = (sv, med) => {
    const q = (sv.soeg || '').trim().toLowerCase(), vist = new Set(sv.vist || []);
    const alle = RAEKKER.map(x => ({ ...x, valgt: valgt.get(x.id) }));
    const passer = x => (sv.filter === 'tjek' ? x.status === 'tjek' : sv.filter === 'hemmelig' ? x.hemmelig : sv.filter === 'seneste' ? x.kendt : true)
      && (!q || x.koder.some(k => k.toLowerCase().includes(q)) || ((!x.hemmelig || vist.has(x.id)) && x.vaerdier.some(v => v.toLowerCase().includes(q))));
    const f = alle.filter(passer);
    // V-OPBYG.7 N3: som Rust (side_af_med): med en række er siden det mindste multiplum af antal, der når den, og
    // svaret har rækkens plads (null, når filteret eller søgningen skjuler den).
    const i = med == null ? -1 : f.findIndex(x => x.id === med), plads = i >= 0 ? i : null;
    const n = plads != null && plads >= sv.antal ? sv.antal * (Math.floor(plads / sv.antal) + 1) : sv.antal;
    return {
      plads,
      // V-OPBYG.4 N1: som Rust (raekke_ud): en hemmelighed uden sin værdi.
      raekker: f.slice(0, n).map(x => (x.hemmelig ? { ...x, vaerdier: [] } : x)), i_alt: f.length, valgte: alle.filter(x => x.valgt).length,
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
    fil_raekker: ({ side: sv, med }) => side(sv, med),
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

// ── V-LAAS.2: låseskærmen. Efterlignet Rust: låst ved start, laas_op svarer fra en kø, og hver kommando med sager,
// ordbog eller filer svarer `laast`, mens der er låst. Kaldene, mens der er låst, logges, så testen ser, at UI'et slet ikke
// spørger efter data. Kun opdigtede navne. ──
export const AABNE_I_LAAST = ['kerne_version', 'menu_sprog', 'program_afslut', 'indstillinger_hent', 'indstillinger_gem', 'laas_status', 'laas_op', 'aktivitet'];
export function falskLaasRust({ svar = [], laast = true, igen = null, efter: efterLaas = null, poster = [{ type: 'ord', vaerdi: 'Kragevig' }] } = {}) {
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

// Efterlignet Rust for noterne (felterne som NoterUd og NoteUd i src-tauri/src/maskering.rs; fejlene som UiFejl::Note) oven på
// falskSagRust. Tidspunkterne er kl. 12 UTC, så datoen er den samme i enhver tidszone fra −11 til +11. Kun opdigtede data.
export const NOTE_MS = Date.UTC(2026, 10, 13, 12, 0);
export function falskNoterRust({ noter = [], sager = [] } = {}) {
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
export const TO_NOTER = () => [
  { nr: 1, tekst: 'Sendt den maskerede log til leverandøren (opdigtet sag 4471).', oprettet: NOTE_MS },
  { nr: 2, tekst: 'De beder om loggen fra fw-syd02.\nHusk samme sag.', oprettet: NOTE_MS + 1800000, rettet: NOTE_MS + 2400000 },
];
