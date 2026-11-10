/* Grimnir — Ordbog (V-ORDBOG.1, O3 og O4): visningen Ordbog efter design/skaerme/Ordbog.dc.html, dialogerne Tilføj post,
   Ret, Fjern post og Prøv på tekst, og vejen fra en række i Maskér til ordbogen. Bygger på skallen (window.Grimnir),
   kittet (window.Kit) og Maskér (window.GrimnirMaskering).

   Ordbogen ligger krypteret på denne maskine (Rust, src-tauri/src/ordbog.rs); nøglen ligger i nøgleringen. Webvisningen
   får posterne (type, værdi, note), fordi brugeren selv har skrevet dem og skal kunne se og rette dem. Teksten i "Prøv på
   tekst" gemmes ingen steder: den slettes fra feltet, når dialogen lukkes. Intet her skriver til konsollen eller til
   localStorage.

   V-FIL.1 F5: en ordbog, der ikke kan åbnes, kan startes forfra (filen omdøbes til ordbog.<dato>.ulaeselig, den slettes
   ikke), og Tilføj post advarer, når et ord ligner en adgangskode (advarslen blokerer ikke).

   Rust-kommandoer: ordbog_hent, ordbog_tilfoej, ordbog_ret, ordbog_fjern, ordbog_proev, ordbog_start_forfra. En ændring melder
   'grimnir-ordbog' på document (Maskér analyserer igen). */
(function () {
  'use strict';
  const G = window.Grimnir, K = window.Kit, S = window.Sprog, GM = window.GrimnirMaskering;
  if (!G || !K || !S || !GM) return;
  const invoke = G.tauri && G.tauri.core && G.tauri.core.invoke ? (c, a) => G.tauri.core.invoke(c, a) : () => Promise.reject({ art: 'ingen_rust' });
  const $ = id => document.getElementById(id);

  const ALTID = ['domaene', 'netbios', 'navnemoenster', 'eget_net', 'ord', 'person'];
  const st = { poster: [], fejl: null, valgt: null, filter: 'lister', soeg: '', fejlBanner: null, infoBanner: null };

  /* "Maskér aldrig" har én type; i tabellen står, hvad værdien ligner (kun til visning). */
  const IPV4 = /^(\d{1,3}\.){3}\d{1,3}$/;
  function aldrigArt(v) {
    if (IPV4.test(v)) return 'aldrig_adresse';
    if (/^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/.test(v)) return 'aldrig_net';
    if (/^[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/.test(v) && /[A-Za-z]/.test(v)) return 'aldrig_domaene';
    return 'aldrig_vaerdi';
  }
  const typeNoegle = p => (p.type === 'aldrig' ? aldrigArt(p.vaerdi) : 'type_' + p.type);

  /* ── Fejltekster ── */
  function sagFejl(f) { return GM.sagFejlTekst({ art: 'sag', fejl: f }); }
  function feltTekst(f) { return S.t('ofejl_' + f.fejl) || S.t('bFejl'); }
  /* Én tekst for en fejl fra en ordbogskommando (bannere og guiden). */
  function fejlTekst(e) {
    if (e && e.art === 'ordbog') return e.fejl.map(feltTekst).join(' ');
    if (e && e.art === 'ordbog_laast') return S.t('bOrdbogLaast', sagFejl(e.fejl));
    if (e && e.art === 'ordbog_fil') return e.fejl.art === 'konflikt' ? S.t('bOrdbogKonflikt') : S.t('bOrdbogIkkeGemt', sagFejl(e.fejl));
    if (e && e.art === 'for_stor') return S.t('bForStor', (e.bytes / 1048576).toFixed(1));
    if (e && e.art === 'tom_tekst') return S.t('bIngenTekst');
    return S.t('bFejl');
  }

  /* ═════════════════════════════ Visningen ═════════════════════════════ */
  const d = G.dele.ordbog;
  const ark = document.createElement('div');
  ark.className = 'arbejde ordbogflade';
  ark.hidden = true;
  const bannere = document.createElement('div');
  bannere.className = 'bannere';
  const vaert = document.createElement('div');
  vaert.className = 'tabelvaert';
  // Hjælpen om navnemønstre med Prøv på tekst (som på skærmen).
  const hjaelp = document.createElement('div');
  hjaelp.className = 'hjaelpelinje';
  const hjS = document.createElement('span');
  hjS.className = 's';
  hjS.setAttribute('aria-hidden', 'true');
  hjS.textContent = 'i';
  const hjT = document.createElement('span');
  hjT.setAttribute('data-t', 'hjMoenster');
  const hjKnap = K.knap({ t: 'kProev', ved: () => aabnProev() });
  hjKnap.classList.add('mini');
  hjaelp.append(hjS, hjT, hjKnap);
  ark.append(bannere, vaert, hjaelp);
  d.flade.appendChild(ark);
  const tomKnap = K.knap({ t: 'kTilfoejPost', ikon: 'plus', variant: 'primary', ved: () => aabnPost('ny') });
  d.tom.appendChild(tomKnap);
  S.anvend(ark);
  S.anvend(tomKnap);

  const valgtPost = () => st.poster.find(p => p.id === st.valgt) || null;
  function filtrerede() {
    let r = st.poster;
    if (st.filter === 'altid') r = r.filter(p => p.type !== 'aldrig');
    else if (st.filter === 'aldrig') r = r.filter(p => p.type === 'aldrig');
    else if (st.filter.startsWith('t-')) r = r.filter(p => p.type === st.filter.slice(2));
    const q = st.soeg.trim().toLowerCase();
    if (q) r = r.filter(p => p.vaerdi.toLowerCase().includes(q) || (p.note || '').toLowerCase().includes(q));
    return r;
  }

  function tegn() { tegnFlade(); tegnTabel(); tegnTrae(); tegnKommandoer(); tegnChip(); tegnFod(); }
  function tegnFlade() {
    const har = st.poster.length > 0;
    d.tom.hidden = har || Boolean(st.fejl);
    ark.hidden = !har && !st.fejl && !st.infoBanner;
    d.soeg.disabled = !har;
    hjaelp.hidden = Boolean(st.fejl) && !har;
    bannere.textContent = '';
    if (st.fejl) GM.banner(bannere, 'danger', 'bOrdbogKanIkkeAabnes', sagFejl(st.fejl), { t: 'hStartForfra', ved: () => aabnStartForfra() });
    else GM.banner(bannere, 'info', 'bOrdbogKrypteret');
    if (st.infoBanner) { GM.banner(bannere, 'info', 'bOrdbogFlyttet', st.infoBanner); st.infoBanner = null; }
    if (st.fejlBanner) { GM.banner(bannere, 'danger', 'bOrdbogFejl', st.fejlBanner); st.fejlBanner = null; }
  }
  function tegnTabel() {
    vaert.textContent = '';
    const r = filtrerede();
    const raekker = [];
    const raekkeAf = p => {
      const type = document.createElement('span');
      type.setAttribute('data-t', typeNoegle(p));
      const v = document.createElement('span');
      v.className = 'mono';
      v.textContent = p.vaerdi;
      const n = document.createElement('span');
      n.className = 'muted';
      n.textContent = p.note || '';
      return { celler: [type, v, n], data: p.id };
    };
    const altid = r.filter(p => p.type !== 'aldrig'), aldrig = r.filter(p => p.type === 'aldrig');
    if (altid.length) raekker.push({ gruppe: { t: 'tMaskerAltid' }, note: { t: 'gruppeAltid' } }, ...altid.map(raekkeAf));
    if (aldrig.length) raekker.push({ gruppe: { t: 'tMaskerAldrig' }, note: { t: 'gruppeAldrig' } }, ...aldrig.map(raekkeAf));
    const t = K.tabel({
      ariaT: 'pOrdbog',
      kolonner: [{ t: 'kolType' }, { t: 'kolVaerdiMoenster' }, { t: 'kolNote' }],
      raekker,
      vedValg: (tr, id) => { st.valgt = id; tegnKommandoer(); },
    });
    t.classList.add('ordbogtabel');
    const tr = [...t.querySelectorAll('tbody tr:not(.gruppe)')];
    [...altid, ...aldrig].forEach((p, i) => {
      tr[i].setAttribute('data-id', String(p.id));
      tr[i].addEventListener('dblclick', () => { st.valgt = p.id; aabnPost('ret'); });
      tr[i].addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); st.valgt = p.id; aabnPost('ret'); } });
    });
    vaert.appendChild(t);
    if (!r.length && st.poster.length) {
      const p = document.createElement('p');
      p.className = 'tabel-tom';
      p.setAttribute('data-t', 'ingenIFilter');
      vaert.appendChild(p);
    }
    const i = [...altid, ...aldrig].findIndex(p => p.id === st.valgt);
    if (i >= 0) t.vaelg(i); else if (!st.poster.some(p => p.id === st.valgt)) st.valgt = null;
    S.anvend(vaert);
  }
  function tegnTrae() {
    const ant = { altid: st.poster.filter(p => p.type !== 'aldrig').length, aldrig: st.poster.filter(p => p.type === 'aldrig').length };
    for (const x of ALTID) ant['t-' + x] = st.poster.filter(p => p.type === x).length;
    for (const [id, n] of Object.entries(ant)) {
      const a = d.nd.querySelector(`[data-punkt="${id}"] .ant`);
      if (a) a.textContent = String(n);
    }
  }
  function tegnKommandoer() {
    const laast = Boolean(st.fejl);
    const p = valgtPost();
    GM.kommando('ordbog', 'tilfoej-post', !laast, 'hvorforOrdbogLaast');
    GM.kommando('ordbog', 'ret', !laast && Boolean(p), laast ? 'hvorforOrdbogLaast' : 'hvorforVaelgPost');
    GM.kommando('ordbog', 'fjern-post', !laast && Boolean(p), laast ? 'hvorforOrdbogLaast' : 'hvorforVaelgPost');
    GM.kommando('ordbog', 'proev', true);
    tomKnap.disabled = laast;
  }
  function tegnChip() {
    d.hoejre.textContent = '';
    const n = st.poster.length;
    const c = st.fejl ? K.chip('danger', { t: 'chipOrdbogLaast' }) : K.chip(n ? 'info' : 'none', { t: n === 1 ? 'chipPost1' : n ? 'chipPoster' : 'chipTomOrdbog' });
    c.querySelector('.ord').setAttribute('data-v', String(n));
    d.hoejre.appendChild(c);
    S.anvend(d.hoejre);
  }
  function tegnFod() {
    if (G.aktiv !== 'ordbog') return;
    const fod = $('fod-venstre'), n = st.poster.length;
    fod.setAttribute('data-t', n === 1 ? 'fodPost1' : 'fodPosterTal');
    fod.setAttribute('data-v', String(n));
    S.anvend(fod);
  }

  /* Ny ordbog fra Rust. Maskér får besked, så analysen bruger den nye ordbog. */
  function anvendSvar(ud) {
    st.poster = ud.poster || [];
    st.fejl = ud.fejl || null;
    tegn();
    document.dispatchEvent(new CustomEvent('grimnir-ordbog', { detail: { antal: st.poster.length, fejl: st.fejl } }));
    return ud;
  }
  function opdater() {
    return invoke('ordbog_hent').then(anvendSvar).catch(e => {
      if (e && e.art === 'ingen_rust') return null;
      st.fejlBanner = fejlTekst(e);
      tegn();
      return null;
    });
  }
  /* En ændring (tilføj, ret, fjern). Ved en konflikt har Rust læst ordbogen igen; den hentes, så listen er den gældende. */
  function aendring(kommando, args) {
    return invoke(kommando, args).then(anvendSvar).catch(e => {
      if (e && (e.art === 'ordbog_fil' || e.art === 'ordbog_laast')) opdater();
      throw e;
    });
  }
  const tilfoej = (type, vaerdi, note) => aendring('ordbog_tilfoej', { type, vaerdi, note: note || null });

  /* ═════════════════════════════ Tilføj og Ret ═════════════════════════════ */
  const pType = $('opost-type'), pVaerdi = $('opost-vaerdi'), pNote = $('opost-note');
  let post = { tilstand: 'ny', id: null, efter: null };
  function feltFejl(felt, tekst) {
    const span = $('opost-' + felt + '-fejl'), inp = felt === 'vaerdi' ? pVaerdi : pNote;
    span.textContent = tekst || '';
    if (tekst) inp.setAttribute('aria-invalid', 'true'); else inp.removeAttribute('aria-invalid');
  }
  function nulstilFejl() { feltFejl('vaerdi', ''); feltFejl('note', ''); $('opost-fejl').textContent = ''; tegnAdvarsel(); }
  function visTypeHjaelp() {
    const hj = $('opost-type-hj');
    hj.setAttribute('data-t', 'hjt_' + pType.value);
    S.anvend(hj);
  }
  /* tilstand: 'ny' | 'ret' | 'masker' (fra en række i Maskér: typen skal vælges). o: { type, vaerdi, typer, efter } */
  function aabnPost(tilstand, o = {}) {
    if (st.fejl) return;
    const p = tilstand === 'ret' ? valgtPost() : null;
    if (tilstand === 'ret' && !p) return;
    post = { tilstand, id: p ? p.id : null, efter: o.efter || null };
    const typer = o.typer || (tilstand === 'masker' ? ALTID : [...ALTID, 'aldrig']);
    for (const opt of pType.options) opt.hidden = opt.disabled = !typer.includes(opt.value) && !(p && p.type === opt.value);
    pType.value = p ? p.type : o.type || typer[0];
    pType.disabled = tilstand === 'ret';
    pVaerdi.value = p ? p.vaerdi : o.vaerdi || '';
    pNote.value = p ? p.note || '' : '';
    const h = $('dlg-opost-h'), lead = $('dlg-opost-p');
    h.setAttribute('data-t', tilstand === 'ret' ? 'opostRetH' : tilstand === 'masker' ? 'opostMaskerH' : 'opostTilfoejH');
    lead.hidden = tilstand !== 'masker';
    $('opost-ok').setAttribute('data-t', tilstand === 'ret' ? 'gem' : 'kTilfoejPost');
    nulstilFejl();
    visTypeHjaelp();
    S.anvend($('dlg-opost'));
    G.aabnDialog('dlg-opost');
    (tilstand === 'masker' ? pType : pVaerdi).focus();
  }
  pType.addEventListener('change', () => { visTypeHjaelp(); feltFejl('vaerdi', ''); });
  function gemPost() {
    nulstilFejl();
    if (!pVaerdi.value.trim()) { feltFejl('vaerdi', S.t('ofejl_tom')); pVaerdi.focus(); return; }
    const note = pNote.value.trim() || null;
    const kald = post.tilstand === 'ret'
      ? aendring('ordbog_ret', { id: post.id, vaerdi: pVaerdi.value, note })
      : tilfoej(pType.value, pVaerdi.value, note);
    kald.then(() => {
      const efter = post.efter;
      post.efter = null;
      $('dlg-opost').close();
      if (post.tilstand === 'ny') { const ny = st.poster[st.poster.length - 1]; if (ny) { st.valgt = ny.id; tegnTabel(); tegnKommandoer(); } }
      if (efter) efter(true);
    }).catch(e => {
      if (e && e.art === 'ordbog') {
        for (const f of e.fejl) {
          if (f.felt === 'vaerdi' || f.felt === 'note') feltFejl(f.felt, feltTekst(f));
          else $('opost-fejl').textContent = feltTekst(f);
        }
        (e.fejl.some(f => f.felt === 'vaerdi') ? pVaerdi : pNote).focus();
      } else {
        $('opost-fejl').textContent = fejlTekst(e);
      }
    });
  }
  $('opost-ok').addEventListener('click', gemPost);
  for (const inp of [pVaerdi, pNote]) inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); gemPost(); } });
  $('dlg-opost').addEventListener('close', () => { if (post.efter) { const f = post.efter; post.efter = null; f(false); } });

  /* Et ord, der ligner en adgangskode (V-FIL.1 F5): mindst 8 tegn uden mellemrum med både bogstaver, cifre og andre tegn.
     Kun for de frie typer (ord, person, maskér aldrig); de andre har deres egen syntaks. Advarslen blokerer ikke. */
  const LIGNER_ADGANGSKODE = v => v.length >= 8 && !/\s/.test(v) && /\p{L}/u.test(v) && /\d/.test(v) && /[^\p{L}\d]/u.test(v);
  function tegnAdvarsel() {
    const adv = $('opost-vaerdi-adv');
    const on = ['ord', 'person', 'aldrig'].includes(pType.value) && LIGNER_ADGANGSKODE(pVaerdi.value.trim());
    adv.hidden = !on;
    adv.textContent = on ? S.t('advAdgangskode') : '';
  }
  pVaerdi.addEventListener('input', tegnAdvarsel);
  pType.addEventListener('change', tegnAdvarsel);
  $('dlg-opost').addEventListener('close', () => { $('opost-vaerdi-adv').hidden = true; });

  /* ═════════════════════════════ Start forfra (V-FIL.1 F5) ═════════════════════════════ */
  const iDag = () => { const d0 = new Date(); return `${d0.getFullYear()}-${String(d0.getMonth() + 1).padStart(2, '0')}-${String(d0.getDate()).padStart(2, '0')}`; };
  function aabnStartForfra() {
    if (!st.fejl) return;
    $('dlg-oforfra-p').setAttribute('data-v', iDag());
    $('oforfra-fejl').textContent = '';
    S.anvend($('dlg-oforfra'));
    G.aabnDialog('dlg-oforfra');
    $('oforfra-nej').focus();
  }
  $('oforfra-ok').addEventListener('click', () => {
    invoke('ordbog_start_forfra', { dato: iDag() }).then(r => {
      $('dlg-oforfra').close();
      st.infoBanner = r.flyttet_til || null;
      anvendSvar(r.ordbog);
    }).catch(e => { $('oforfra-fejl').textContent = fejlTekst(e); });
  });

  /* ═════════════════════════════ Fjern post ═════════════════════════════ */
  let fjernId = null;
  function aabnFjern() {
    const p = valgtPost();
    if (!p || st.fejl) return;
    fjernId = p.id;
    $('dlg-ofjern-p').setAttribute('data-v', p.vaerdi);
    $('ofjern-fejl').textContent = '';
    S.anvend($('dlg-ofjern'));
    G.aabnDialog('dlg-ofjern');
    $('ofjern-ok').focus();
  }
  $('ofjern-ok').addEventListener('click', () => {
    aendring('ordbog_fjern', { id: fjernId }).then(() => {
      $('dlg-ofjern').close();
      st.valgt = null;
      tegn();
    }).catch(e => { $('ofjern-fejl').textContent = fejlTekst(e); });
  });

  /* ═════════════════════════════ Prøv på tekst ═════════════════════════════ */
  const prTekst = $('proev-tekst'), prSvar = $('proev-svar');
  let prNr = 0;
  function aabnProev() {
    prTekst.value = '';
    prSvar.textContent = '';
    G.aabnDialog('dlg-proev');
    prTekst.focus();
  }
  function proev() {
    prSvar.textContent = '';
    const tekst = prTekst.value;
    if (!tekst) { visProevBesked('bIngenTekstProev'); prTekst.focus(); return; }
    const nr = ++prNr;
    invoke('ordbog_proev', { tekst }).then(svar => {
      if (nr !== prNr || !$('dlg-proev').open) return;
      tegnProev(svar);
    }).catch(e => {
      if (nr !== prNr) return;
      prSvar.textContent = '';
      const p = document.createElement('p');
      p.className = 'dlg-fejl';
      p.textContent = fejlTekst(e);
      prSvar.appendChild(p);
    });
  }
  function visProevBesked(t, v) {
    const p = document.createElement('p');
    p.className = 'besked';
    p.setAttribute('data-t', t);
    if (v != null) p.setAttribute('data-v', String(v));
    prSvar.appendChild(p);
    S.anvend(prSvar);
  }
  function tegnProev(svar) {
    prSvar.textContent = '';
    const fanget = svar.fund.filter(f => f.status === 'fanget').length;
    visProevBesked(svar.fund.length ? 'proevResultat' : 'proevIntet', fanget);
    if (!svar.fund.length) return;
    const t = K.tabel({
      ariaT: 'pProev',
      kolonner: [{ t: 'kolHvad' }, { t: 'kolType' }, { t: 'kolTekst' }, { t: 'kolAntal', tal: true }, { t: 'kolLinje', tal: true }],
      raekker: svar.fund.map(f => {
        const tekst = document.createElement('span');
        tekst.className = 'mono';
        tekst.textContent = f.tekst;
        const c = f.status === 'fanget' ? K.chip('info', { t: 'proevFanget' }) : K.chip('none', { t: 'proevAldrig' });
        const art = document.createElement('span');
        art.setAttribute('data-t', 'art_' + f.art);
        return { celler: [c, art, tekst, String(f.antal), String(f.linje)], data: f.linje };
      }),
    });
    t.classList.add('proevtabel');
    prSvar.appendChild(t);
    S.anvend(prSvar);
  }
  $('proev-ok').addEventListener('click', proev);
  prTekst.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); proev(); } });
  // Teksten gemmes ikke: den slettes, når dialogen lukkes.
  $('dlg-proev').addEventListener('close', () => { prTekst.value = ''; prSvar.textContent = ''; prNr++; });

  /* ═════════════════════════════ Fra Maskér til ordbogen (O4) ═════════════════════════════ */
  /* Rækkens art → ordbogens type. Entydige arter lægges direkte i ordbogen; for de tvetydige spørges der om typen (med et
     forslag). Arter, der ikke kan stå under "maskér altid" (IPv6, MAC, SID, GUID, CPR), kan kun lægges på "maskér aldrig".
     Hemmeligheder kan ikke lægges i ordbogen. */
  const ENTYDIG = { domaene: 'domaene', netbios: 'netbios', person: 'person', ord: 'ord', ipv4_egen: 'eget_net', ipv4_fremmed: 'eget_net' };
  const TVETYDIG = { vaert: 'ord', bruger: 'ord', database: 'ord', serienummer: 'ord', ligner_kode: 'ord' };
  function kan(r, hvad) {
    if (r.hemmelig) return 'hvorforHemmelighedOrdbog';
    if (st.fejl) return 'hvorforOrdbogLaast';
    if (hvad === 'altid' && !ENTYDIG[r.art] && !TVETYDIG[r.art]) return 'hvorforIkkeAltid';
    return null;
  }
  /* Lægger rækkens værdi i ordbogen. Svarer med true, hvis ordbogen er ændret. */
  function fraMasker(r, hvad) {
    if (kan(r, hvad)) return Promise.resolve(false);
    const vaerdi = r.vaerdier[0];
    if (hvad === 'aldrig') return tilfoej('aldrig', vaerdi, null).then(() => true);
    if (ENTYDIG[r.art]) return tilfoej(ENTYDIG[r.art], vaerdi, null).then(() => true);
    const typer = vaerdi.includes('.') ? ['ord', 'person', 'domaene'] : ['ord', 'person', 'netbios'];
    return new Promise(ok => aabnPost('masker', { type: TVETYDIG[r.art], vaerdi, typer, efter: ok }));
  }

  /* ═════════════════════════════ Kommandoer, træ, søgning og hændelser ═════════════════════════════ */
  G.haandter('ordbog', 'tilfoej-post', () => aabnPost('ny'));
  G.haandter('ordbog', 'ret', () => aabnPost('ret'));
  G.haandter('ordbog', 'fjern-post', () => aabnFjern());
  G.haandter('ordbog', 'proev', () => aabnProev());
  d.soeg.addEventListener('input', () => { st.soeg = d.soeg.value; tegnTabel(); });
  document.addEventListener('grimnir-trae', e => {
    if (e.detail.visning !== 'ordbog') return;
    st.filter = e.detail.id;
    tegnTabel();
  });
  document.addEventListener('grimnir-visning', e => { if (e.detail === 'ordbog') tegnFod(); });
  document.addEventListener('grimnir-sprog', () => tegn());

  tegn();
  const klar = opdater();
  window.GrimnirOrdbog = { st, klar, opdater, tilfoej, fraMasker, kan, fejlTekst, aabnPost, aabnProev };
})();
