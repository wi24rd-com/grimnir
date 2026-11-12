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
  // V-KITBRUG.2 N5: tabellen deler fladens højde med hjælpelinjen, så Prøv på tekst altid kan ses (app.css: .flade.fyld).
  d.flade.classList.add('fyld');
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
      v.className = 'mono kort';
      v.textContent = p.vaerdi;
      v.title = p.vaerdi; // forkortes med … i en smal kolonne (V-RET.1 R1)
      const n = document.createElement('span');
      n.className = 'muted';
      n.textContent = p.note || '';
      if (p.note) n.title = p.note;
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
    const c = st.fejl ? K.chip('danger', { t: 'chipOrdbogLaast' }) : K.chip(n ? 'info' : 'none', { t: n ? 'chipPoster' : 'chipTomOrdbog' });
    c.querySelector('.ord').setAttribute('data-v', String(n));
    d.hoejre.appendChild(c);
    S.anvend(d.hoejre);
  }
  function tegnFod() {
    if (G.aktiv !== 'ordbog') return;
    const fod = $('fod-venstre'), n = st.poster.length;
    fod.setAttribute('data-t', 'fodPosterTal');
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
  /* V-KITBRUG.2 N1: Tilføj post er kittets dialog med samme overskrift (skifter: Tilføj post, Ret posten, Maskér altid),
     sætning (kun fra Maskér), felter, fejl og knapper som før. Fejl i et felt står under feltet; andre fejl i kittets
     fejlfelt (G1, dlg-opost-fejl). Knappen venter på Rust (et løfte); Enter i et felt er et klik på den. Lukkes dialogen
     på en anden måde end ved at gemme (Annullér, Esc, en anden dialog), får Maskérs ventende løfte false (vedLuk). */
  function felt(id, etiket, attr, under) {
    const f = document.createElement('div');
    f.className = 'felt';
    const l = document.createElement('label');
    l.className = 'label';
    l.htmlFor = id;
    l.setAttribute('data-t', etiket);
    const i = document.createElement('input');
    i.id = id;
    i.type = 'text';
    for (const [k, v] of Object.entries(attr)) i.setAttribute(k, v);
    f.append(l, i, ...under);
    return f;
  }
  function span(kl, id, attr = {}) {
    const s = document.createElement('span');
    s.className = kl;
    s.id = id;
    for (const [k, v] of Object.entries(attr)) s.setAttribute(k, v);
    return s;
  }
  const FOELSOM = { spellcheck: 'false', autocomplete: 'off', autocorrect: 'off', autocapitalize: 'off' };
  // V-KITBRUG.1 N3: Type er kittets valgliste (Kit.valgliste) med samme id, valg, navn og hjælpetekst (opost-type-hj).
  const lType = K.valgliste({ id: 'opost-type', etiket: { t: 'feltType' }, valg: ['domaene', 'netbios', 'navnemoenster', 'eget_net', 'ord', 'person', 'aldrig'].map(x => ({ id: x, t: 'type_' + x })), hjaelp: { t: 'hjt_domaene' } });
  lType.select.setAttribute('data-t-aria', 'feltType');
  const postFelter = document.createElement('div');
  postFelter.className = 'dlg-felter';
  const advSpan = span('raekkeadv', 'opost-vaerdi-adv', { role: 'status' });
  advSpan.hidden = true;
  postFelter.append(
    lType.rod,
    felt('opost-vaerdi', 'feltVaerdi', { class: 'mono', maxlength: '253', 'data-t-aria': 'feltVaerdi', ...FOELSOM, 'aria-describedby': 'opost-vaerdi-fejl opost-vaerdi-adv' }, [span('hj fejltekst', 'opost-vaerdi-fejl'), advSpan]),
    felt('opost-note', 'feltNote', { maxlength: '200', 'data-t-aria': 'feltNote', ...FOELSOM, 'aria-describedby': 'opost-note-fejl' }, [span('hj fejltekst', 'opost-note-fejl')]),
  );
  const dPost = G.kitDialog({
    id: 'dlg-opost', t: 'opostTilfoejH', p: { t: 'opostP' }, indhold: postFelter, fejl: true,
    knapper: [{ id: 'annuller', t: 'annuller' }, { id: 'ok', knapId: 'opost-ok', t: 'kTilfoejPost', variant: 'primary', ved: () => gemPost() }],
    vedLuk: svar => {
      $('opost-vaerdi-adv').hidden = true;
      const f = post.efter;
      post.efter = null;
      if (f) f(svar === 'ok');
    },
  });
  const pType = $('opost-type'), pVaerdi = $('opost-vaerdi'), pNote = $('opost-note');
  let post = { tilstand: 'ny', id: null, efter: null };
  function feltFejl(felt, tekst) {
    const span = $('opost-' + felt + '-fejl'), inp = felt === 'vaerdi' ? pVaerdi : pNote;
    span.textContent = tekst || '';
    if (tekst) inp.setAttribute('aria-invalid', 'true'); else inp.removeAttribute('aria-invalid');
  }
  function nulstilFejl() { feltFejl('vaerdi', ''); feltFejl('note', ''); dPost.fejl(null); tegnAdvarsel(); }
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
    const h = dPost.overskrift, lead = $('dlg-opost-p');
    h.setAttribute('data-t', tilstand === 'ret' ? 'opostRetH' : tilstand === 'masker' ? 'opostMaskerH' : 'opostTilfoejH');
    // Sætningen står kun, når der er kommet fra Maskér; ellers beskriver den heller ikke dialogen (aria-describedby).
    lead.hidden = tilstand !== 'masker';
    if (lead.hidden) dPost.rod.removeAttribute('aria-describedby'); else dPost.rod.setAttribute('aria-describedby', lead.id);
    $('opost-ok').setAttribute('data-t', tilstand === 'ret' ? 'gem' : 'kTilfoejPost');
    nulstilFejl();
    visTypeHjaelp();
    S.anvend(dPost.rod);
    G.aabnDialog('dlg-opost', tilstand === 'masker' ? pType : pVaerdi);
  }
  pType.addEventListener('change', () => { visTypeHjaelp(); feltFejl('vaerdi', ''); });
  /* Knappens handling: false (tom værdi) eller et løfte, der giver true (gemt: dialogen lukker med svaret 'ok', og
     Maskérs ventende løfte får true i vedLuk) eller false (Rusts fejl står under feltet eller i fejlfeltet). */
  function gemPost() {
    nulstilFejl();
    if (!pVaerdi.value.trim()) { feltFejl('vaerdi', S.t('ofejl_tom')); pVaerdi.focus(); return false; }
    const note = pNote.value.trim() || null;
    const kald = post.tilstand === 'ret'
      ? aendring('ordbog_ret', { id: post.id, vaerdi: pVaerdi.value, note })
      : tilfoej(pType.value, pVaerdi.value, note);
    return kald.then(() => {
      if (post.tilstand === 'ny') { const ny = st.poster[st.poster.length - 1]; if (ny) { st.valgt = ny.id; tegnTabel(); tegnKommandoer(); } }
      return true;
    }, e => {
      if (e && e.art === 'ordbog') {
        for (const f of e.fejl) {
          if (f.felt === 'vaerdi' || f.felt === 'note') feltFejl(f.felt, feltTekst(f));
          else dPost.fejl(feltTekst(f));
        }
        (e.fejl.some(f => f.felt === 'vaerdi') ? pVaerdi : pNote).focus();
      } else {
        dPost.fejl(fejlTekst(e));
      }
      return false;
    });
  }
  for (const inp of [pVaerdi, pNote]) inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); dPost.knap('ok').click(); } });
  // V-PUDS.3 N4: en fejl under et felt ryddes, når der skrives i feltet (fejlfeltet for hele dialogen: app.js, kitDialog).
  pVaerdi.addEventListener('input', () => feltFejl('vaerdi', ''));
  pNote.addEventListener('input', () => feltFejl('note', ''));

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

  /* ═════════════════════════════ Start forfra (V-FIL.1 F5) ═════════════════════════════ */
  const iDag = () => { const d0 = new Date(); return `${d0.getFullYear()}-${String(d0.getMonth() + 1).padStart(2, '0')}-${String(d0.getDate()).padStart(2, '0')}`; };
  /* V-KITBRUG.2 N1: Start forfra og Fjern post er kittets bekræftelse, der kan fejle (Kit.bekraeft med ved, G2): fejlen
     står i dialogen, der bliver åben, i kittets felt med role="alert". Fokus på Annullér i begge (N2, Jan: også i Fjern
     post, så Enter ikke fjerner uden et Tab). Dialogen laves ved åbning og fjernes ved lukning; id'erne dlg-oforfra og
     dlg-ofjern sætter Grimnir selv (Kit.bekraeft har intet id; kit-ønske G12). */
  const somTekst = e => { throw fejlTekst(e); };
  function bekraeft(id, t, p, v, ja, ved) {
    return G.bekraeft({
      t, p: { t: p }, nej: { t: 'annuller' }, ja: { t: ja }, farlig: true, ved,
      udfyld: rod => { rod.id = id; rod.querySelector('.modal-tekst').setAttribute('data-v', v); S.anvend(rod); },
    });
  }
  function aabnStartForfra() {
    if (!st.fejl) return;
    let r = null;
    bekraeft('dlg-oforfra', 'oforfraH', 'oforfraP', iDag(), 'hStartForfra', () => invoke('ordbog_start_forfra', { dato: iDag() }).then(svar => { r = svar; }, somTekst))
      .then(ja => {
        if (!ja) return;
        st.infoBanner = r.flyttet_til || null;
        anvendSvar(r.ordbog);
      });
  }

  /* ═════════════════════════════ Fjern post ═════════════════════════════ */
  function aabnFjern() {
    const p = valgtPost();
    if (!p || st.fejl) return;
    const id = p.id;
    bekraeft('dlg-ofjern', 'ofjernH', 'ofjernP', p.vaerdi, 'kFjernPost', () => aendring('ordbog_fjern', { id }).catch(somTekst))
      .then(ja => {
        if (!ja) return;
        st.valgt = null;
        tegn();
      });
  }

  /* ═════════════════════════════ Prøv på tekst ═════════════════════════════ */
  /* V-KITBRUG.2 N1: kittets brede dialog (620 px) med samme overskrift, sætning, felt, svar (role="status", også fejlen)
     og knapper som før. Teksten gemmes ikke: den slettes, når dialogen lukkes, også når en anden dialog lukker den
     (vedLuk kaldes ved hver lukning). */
  const proevFelt = document.createElement('div');
  proevFelt.className = 'felt';
  const proevLabel = document.createElement('label');
  proevLabel.className = 'label';
  proevLabel.htmlFor = 'proev-tekst';
  proevLabel.setAttribute('data-t', 'feltTekst');
  const prTekst = document.createElement('textarea');
  prTekst.id = 'proev-tekst';
  prTekst.className = 'mono';
  prTekst.rows = 6;
  for (const [k, v] of Object.entries({ 'data-t-aria': 'feltTekst', ...FOELSOM })) prTekst.setAttribute(k, v);
  proevFelt.append(proevLabel, prTekst);
  const prSvar = document.createElement('div');
  prSvar.className = 'proev-svar';
  prSvar.id = 'proev-svar';
  prSvar.setAttribute('role', 'status');
  const proevIndhold = document.createDocumentFragment();
  proevIndhold.append(proevFelt, prSvar);
  let prNr = 0;
  const dProev = G.kitDialog({
    id: 'dlg-proev', t: 'proevH', p: { t: 'proevP' }, bred: true, indhold: proevIndhold,
    knapper: [{ id: 'luk', t: 'luk' }, { id: 'proev', knapId: 'proev-ok', t: 'kProevKoer', variant: 'primary', ved: () => { proev(); return false; } }],
    vedLuk: () => { prTekst.value = ''; prSvar.textContent = ''; prNr++; },
  });
  function aabnProev() {
    prTekst.value = '';
    prSvar.textContent = '';
    G.aabnDialog('dlg-proev', prTekst);
  }
  function proev() {
    prSvar.textContent = '';
    const tekst = prTekst.value;
    if (!tekst) { visProevBesked('bIngenTekstProev'); prTekst.focus(); return; }
    const nr = ++prNr;
    invoke('ordbog_proev', { tekst }).then(svar => {
      if (nr !== prNr || !dProev.aaben) return;
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
  prTekst.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); proev(); } });

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
  // V-LAAS.2: ordbogen hentes først, når Grimnir er låst op (laas.js).
  const klar = (window.GrimnirLaas ? window.GrimnirLaas.klar : Promise.resolve()).then(opdater);
  window.GrimnirOrdbog = { st, klar, opdater, tilfoej, fraMasker, kan, fejlTekst, aabnPost, aabnProev };
})();
