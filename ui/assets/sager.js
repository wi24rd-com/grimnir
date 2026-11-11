/* Grimnir — Sager (V-SAG.1, G4): visningen Sager, titellinjens sag og dialogerne Ny sag, Omdøb, Udløb, Slet sag og
   "Gem den midlertidige sag?". Bygger på skallen (window.Grimnir), kittet (window.Kit) og Maskér/Demaskér
   (window.GrimnirMaskering).

   En sag ligger krypteret i én fil på denne maskine, og nøglen ligger i nøgleringen (Rust, src-tauri/src/sager.rs).
   Webvisningen får kun hovederne (navn, antal værdier, datoer, udløb) og aldrig nøgler eller originaler. Navnet vises,
   fordi brugeren selv har skrevet det. Intet her skriver til konsollen eller til localStorage.

   Rust-kommandoer: sag_status, sag_liste, sag_ny, sag_aabn, sag_luk, sag_nulstil, sag_omdoeb, sag_udloeb, sag_slet,
   program_afslut og (V-ORDBOG.1) sag_valg: sagens valg for fremmede adresser (D4) og sidste oktet (D5) i titellinjens
   dialog. V-LAAS.2: intet hentes, før Grimnir er låst op (window.GrimnirLaas.klar). Ny sag foreslår standardudløbet fra indstillingerne (indstillinger.js). Hændelsen 'menu' med "afslut" kommer, når programmet lukkes med en midlertidig sag med poster. */
(function () {
  'use strict';
  const G = window.Grimnir, K = window.Kit, S = window.Sprog, GM = window.GrimnirMaskering;
  if (!G || !K || !S || !GM) return;
  const invoke = G.tauri && G.tauri.core && G.tauri.core.invoke ? (c, a) => G.tauri.core.invoke(c, a) : () => Promise.reject({ art: 'ingen_rust' });
  const $ = id => document.getElementById(id);
  const UGE = 7; // "Udløber snart": inden 7 dage

  /* ── Datoer ── */
  const to = n => String(n).padStart(2, '0');
  function iDagUtc() { const n = new Date(); return Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()); }
  /* Hele dage fra i dag (lokal dato) til en dato ÅÅÅÅ-MM-DD; negativ, hvis den er passeret. */
  function dageTil(dato) {
    const [a, m, d] = dato.split('-').map(Number);
    return Math.round((Date.UTC(a, m - 1, d) - iDagUtc()) / 86400000);
  }
  const locale = () => (S.lang === 'en' ? 'en-GB' : 'da-DK');
  const fmtMs = ms => new Date(ms).toLocaleDateString(locale(), { day: 'numeric', month: 'short', year: 'numeric' });
  function fmtDato(dato) {
    const [a, m, d] = dato.split('-').map(Number);
    return new Date(a, m - 1, d).toLocaleDateString(locale(), { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function iDag() { const n = new Date(); return n.getFullYear() + '-' + to(n.getMonth() + 1) + '-' + to(n.getDate()); }
  function datoOmDage(n) { const t = new Date(); t.setDate(t.getDate() + n); return t.getFullYear() + '-' + to(t.getMonth() + 1) + '-' + to(t.getDate()); }

  /* Sagens status i listen: åben (kan åbnes), udløber snart (inden 7 dage), udløbet, kan ikke åbnes. */
  const STATUS = { aaben: ['ok', 'stAaben'], snart: ['warn', 'stUdloeberSnart'], udloebet: ['danger', 'stUdloebet'], kan_ikke: ['danger', 'stKanIkke'] };
  function statusFor(p) {
    if (p.fejl) return 'kan_ikke';
    if (p.udloeb) { const n = dageTil(p.udloeb); if (n < 0) return 'udloebet'; if (n <= UGE) return 'snart'; }
    return 'aaben';
  }
  const navnFor = p => (p.navn != null ? p.navn : S.t('sagUkendtNavn', p.id.slice(0, 8)));
  const fejlTekst = e => GM.sagFejlTekst(e);

  /* ═════════════════════════════ Den aktuelle sag og titellinjen ═════════════════════════════ */
  let status = { poster: 0, id: null, navn: null, udloeb: null, valg: null };
  const sagSpan = $('sag'), sagKnap = $('sag-knap');

  function tegnTitel() {
    const navngiven = Boolean(status.id);
    sagSpan.hidden = navngiven || status.poster > 0;
    sagKnap.hidden = !sagSpan.hidden;
    if (navngiven) {
      sagKnap.setAttribute('data-t', 'sagNavngiven');
      sagKnap.setAttribute('data-t-aria', 'ariaSagNavngiven');
      sagKnap.setAttribute('data-v', status.navn);
      sagKnap.setAttribute('data-w', String(status.poster));
    } else {
      sagKnap.setAttribute('data-t', 'midlertidigSag');
      sagKnap.setAttribute('data-t-aria', 'ariaSagKnap');
      sagKnap.setAttribute('data-v', String(status.poster));
      sagKnap.removeAttribute('data-w');
    }
    S.anvend(sagKnap);
  }

  /* Ny status fra Rust. nulstil: sagens indhold er skiftet, så Maskér og Demaskér glemmer analyse og resultat. */
  function anvend(s, nulstil) {
    status = { poster: s.poster, id: s.id || null, navn: s.navn || null, udloeb: s.udloeb || null, valg: s.valg || null };
    if (nulstil) { GM.M.nulstilt(); GM.D.nulstilt(); }
    GM.saetSag(status.poster);
    tegnTitel();
    tegn();
  }
  // Maskér har gemt: antallet af poster er ændret (også i en navngiven sag).
  document.addEventListener('grimnir-poster', e => {
    if (e.detail === status.poster) return;
    status.poster = e.detail;
    tegnTitel();
    if (status.id) opdater();
  });

  /* Titellinjens dialog: midlertidig sag (Gem som sag, Nulstil) eller navngiven (Skift sag, Luk sag). */
  sagKnap.addEventListener('click', () => {
    const navngiven = Boolean(status.id);
    const h = $('dlg-sag-h'), p = $('dlg-sag-p');
    h.setAttribute('data-t', navngiven ? 'sagNavngivenH' : 'sagH');
    h.setAttribute('data-v', navngiven ? status.navn : '');
    p.setAttribute('data-t', navngiven ? 'sagNavngivenP' : 'sagP');
    p.setAttribute('data-v', String(status.poster));
    $('sag-nulstil').hidden = navngiven;
    $('sag-gem-som').hidden = navngiven;
    $('sag-skift').hidden = !navngiven;
    $('sag-luk').hidden = !navngiven;
    tegnValg();
    S.anvend($('dlg-sag'));
    G.aabnDialog('dlg-sag');
  });

  /* Sagens valg (D4, D5). En ændring i en sag med værdier gælder kun nye værdier; det står i dialogen. */
  const vFremmede = $('sag-fremmede'), vOktet = $('sag-oktet');
  function tegnValg() {
    $('sag-valg').hidden = !status.valg;
    $('sag-valg-fejl').textContent = '';
    if (!status.valg) return;
    vFremmede.checked = status.valg.masker_fremmede;
    vOktet.checked = status.valg.bevar_sidste_oktet;
    const hj = $('sag-valg-hj');
    hj.setAttribute('data-t', status.poster > 0 ? 'sagValgNye' : 'sagValgTom');
    S.anvend(hj);
  }
  function gemValg() {
    invoke('sag_valg', { maskerFremmede: vFremmede.checked, bevarSidsteOktet: vOktet.checked })
      .then(s => { anvend(s, false); tegnValg(); GM.M.analyserIgen(); })
      .catch(e => { tegnValg(); $('sag-valg-fejl').textContent = S.t('bSagFejl', fejlTekst(e)); });
  }
  vFremmede.addEventListener('change', gemValg);
  vOktet.addEventListener('change', gemValg);
  $('sag-nulstil').addEventListener('click', () => {
    invoke('sag_nulstil').then(s => { $('dlg-sag').close(); anvend(s, true); }).catch(() => { /* sagen er uændret */ });
  });
  $('sag-gem-som').addEventListener('click', () => aabnNySag('gem-som'));
  $('sag-skift').addEventListener('click', () => { $('dlg-sag').close(); G.vis('sager'); });
  $('sag-luk').addEventListener('click', () => {
    invoke('sag_luk').then(s => { $('dlg-sag').close(); anvend(s, true); opdater(); }).catch(() => { /* uændret */ });
  });

  /* ═════════════════════════════ Sager-visningen ═════════════════════════════ */
  const d = G.dele.sager;
  const st = { liste: [], valgt: null, filter: 'alle', soeg: '', fejl: null };
  const ark = document.createElement('div');
  ark.className = 'arbejde sagliste';
  ark.hidden = true;
  const bannere = document.createElement('div');
  bannere.className = 'bannere';
  const vaert = document.createElement('div');
  vaert.className = 'tabelvaert';
  ark.append(bannere, vaert);
  d.flade.appendChild(ark);
  const tomKnap = K.knap({ t: 'kNySag', ikon: 'plus', variant: 'primary', ved: () => aabnNySag('sager') });
  d.tom.appendChild(tomKnap);
  S.anvend(tomKnap);

  const valgtPost = () => st.liste.find(p => p.id === st.valgt) || null;
  function filtrerede() {
    let r = st.liste;
    if (st.filter === 'udloeber') r = r.filter(p => ['snart', 'udloebet'].includes(statusFor(p)));
    else if (st.filter === 'uden-udloeb') r = r.filter(p => !p.fejl && !p.udloeb);
    const q = st.soeg.trim().toLowerCase();
    if (q) r = r.filter(p => p.navn != null && p.navn.toLowerCase().includes(q));
    return r;
  }

  function tegn() { tegnFlade(); tegnTabel(); tegnTrae(); tegnKommandoer(); tegnChip(); tegnFod(); }
  function tegnFlade() {
    const har = st.liste.length > 0;
    d.tom.hidden = har;
    ark.hidden = !har;
    d.soeg.disabled = !har;
    bannere.textContent = '';
    if (st.fejl) GM.banner(bannere, 'danger', 'bSagFejl', st.fejl);
    if (st.fejl && !har) { ark.hidden = false; }
  }
  function tegnTabel() {
    vaert.textContent = '';
    const r = filtrerede();
    const t = K.tabel({
      ariaT: 'pSager',
      kolonner: [{ t: 'kolNavn' }, { t: 'kolVaerdier', tal: true }, { t: 'kolOprettet' }, { t: 'kolSidstBrugt' }, { t: 'kolUdloeber' }, { t: 'kolStatus' }],
      raekker: r.map(p => {
        const navn = document.createElement('span');
        navn.className = 'sagnavn';
        const n = document.createElement('span');
        n.className = 'kort';
        n.textContent = navnFor(p);
        n.title = n.textContent; // forkortes med … i en smal kolonne (V-RET.1 R1)
        navn.appendChild(n);
        if (p.aaben) {
          const m = document.createElement('span');
          m.className = 'muted';
          m.setAttribute('data-t', 'iBrug');
          navn.appendChild(m);
        }
        const sNoegle = statusFor(p), sv = STATUS[sNoegle];
        const c = K.chip(sv[0], { t: sv[1] });
        if (p.fejl) c.setAttribute('title', S.t('hvorforKanIkkeAabnes', fejlTekst({ art: 'sag', fejl: p.fejl })));
        const udl = p.fejl ? '' : p.udloeb ? fmtDato(p.udloeb) : S.t('udloebAldrig');
        return { celler: [navn, p.fejl ? '' : String(p.poster), p.fejl ? '' : fmtMs(p.oprettet), p.fejl ? '' : fmtMs(p.sidst_brugt), udl, c], data: p.id };
      }),
      vedValg: (tr, id) => { st.valgt = id; tegnKommandoer(); },
    });
    t.classList.add('sagtabel');
    const tr = [...t.querySelectorAll('tbody tr')];
    r.forEach((p, i) => {
      tr[i].setAttribute('data-id', p.id);
      tr[i].addEventListener('dblclick', () => { st.valgt = p.id; aabnValgt(); });
      tr[i].addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); st.valgt = p.id; aabnValgt(); } });
    });
    vaert.appendChild(t);
    if (!r.length && st.liste.length) {
      const p = document.createElement('p');
      p.className = 'tabel-tom';
      p.setAttribute('data-t', 'ingenIFilter');
      vaert.appendChild(p);
    }
    const i = r.findIndex(p => p.id === st.valgt);
    if (i >= 0) t.vaelg(i); else if (!st.liste.some(p => p.id === st.valgt)) st.valgt = null;
    S.anvend(vaert);
  }
  function tegnTrae() {
    const ant = { alle: st.liste.length, udloeber: st.liste.filter(p => ['snart', 'udloebet'].includes(statusFor(p))).length, 'uden-udloeb': st.liste.filter(p => !p.fejl && !p.udloeb).length };
    for (const [id, n] of Object.entries(ant)) {
      const a = d.nd.querySelector(`[data-punkt="${id}"] .ant`);
      if (a) a.textContent = String(n);
    }
  }
  function tegnKommandoer() {
    const p = valgtPost();
    const kanIkke = p && p.fejl ? ['hvorforKanIkkeAabnes', fejlTekst({ art: 'sag', fejl: p.fejl })] : null;
    GM.kommando('sager', 'ny-sag', true);
    for (const id of ['aabn-i-masker', 'omdoeb', 'udloeb']) {
      GM.kommando('sager', id, p && !p.fejl, p ? 'hvorforKanIkkeAabnes' : 'hvorforVaelgSag');
      if (p && kanIkke) { const b = G.dele.sager.bar.knap(id); b.setAttribute('data-v', kanIkke[1]); S.anvend(b); }
    }
    GM.kommando('sager', 'slet-sag', Boolean(p), 'hvorforVaelgSag');
  }
  function tegnChip() {
    d.hoejre.textContent = '';
    const n = st.liste.length;
    const c = K.chip(n ? 'info' : 'none', { t: n ? 'chipSager' : 'chipIngenSager' });
    c.querySelector('.ord').setAttribute('data-v', String(n));
    d.hoejre.appendChild(c);
    S.anvend(d.hoejre);
  }
  function tegnFod() {
    if (G.aktiv !== 'sager') return;
    const fod = $('fod-venstre'), n = st.liste.length;
    fod.setAttribute('data-t', 'fodSagerTal');
    fod.setAttribute('data-v', String(n));
    S.anvend(fod);
  }

  /* Listen fra Rust. Maskér/Demaskér får antallet (Demaskérs tomme tilstand peger på Sager). */
  function opdater() {
    return invoke('sag_liste').then(l => {
      st.liste = l; st.fejl = null;
      GM.saetGemteSager(l.length);
      tegn();
    }).catch(e => {
      if (e && e.art === 'ingen_rust') return;
      st.fejl = fejlTekst(e);
      tegn();
    });
  }

  /* ── Åbn en sag ── */
  function aabnValgt() {
    const p = valgtPost();
    if (!p || p.fejl) return;
    if (p.id === status.id) { G.vis('masker'); return; }
    anmodAabn(p.id);
  }
  function anmodAabn(id) {
    // En midlertidig sag med poster går tabt, når en anden sag åbnes: spørg først.
    if (!status.id && status.poster > 0) { visKasser('aabn:' + id); return; }
    aabn(id);
  }
  function aabn(id) {
    return invoke('sag_aabn', { id }).then(s => { anvend(s, true); opdater(); G.vis('masker'); })
      .catch(e => { st.fejl = fejlTekst(e); opdater(); });
  }
  /* Efter en konflikt: læs den åbne sag igen fra disken. */
  function aabnIgen() { if (status.id) aabn(status.id); }

  /* ── Dialogerne ── */
  function visFejl(id, tekst) { const el = $(id); el.textContent = tekst || ''; }
  function vedEnter(input, fn) { input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); fn(); } }); }

  // Ny sag (også "Gem som sag" fra titellinjen og fra spørgsmålet ved lukning eller skift).
  let nyTil = 'sager';
  const nyNavn = $('ny-sag-navn'), nyUdloeb = $('ny-sag-udloeb');
  function aabnNySag(til) {
    nyTil = til;
    nyNavn.value = '';
    // Standardudløbet fra indstillingerne (ingen, 30 eller 90 dage).
    const dage = window.GrimnirIndst && window.GrimnirIndst.st.indst ? window.GrimnirIndst.st.indst.udloeb_dage : null;
    nyUdloeb.value = dage ? datoOmDage(dage) : '';
    nyUdloeb.min = iDag();
    visFejl('ny-sag-fejl', '');
    const p = $('dlg-ny-sag-p');
    p.setAttribute('data-t', status.id ? 'nySagTomP' : status.poster > 0 ? 'nySagMedPosterP' : 'nySagP');
    p.setAttribute('data-v', String(status.poster));
    S.anvend($('dlg-ny-sag'));
    G.aabnDialog('dlg-ny-sag');
    nyNavn.focus();
  }
  function opret() {
    const navn = nyNavn.value.trim();
    if (!navn) { visFejl('ny-sag-fejl', S.t('fejlNavnTomt')); nyNavn.focus(); return; }
    const fraNavngiven = Boolean(status.id);
    invoke('sag_ny', { navn, udloeb: nyUdloeb.value || null }).then(s => {
      $('dlg-ny-sag').close();
      anvend(s, fraNavngiven);
      opdater();
      if (nyTil === 'afslut') invoke('program_afslut').catch(() => { /* programmet lukker */ });
      else if (nyTil.startsWith('aabn:')) aabn(nyTil.slice(5));
    }).catch(e => visFejl('ny-sag-fejl', fejlTekst(e)));
  }
  $('ny-sag-opret').addEventListener('click', opret);
  vedEnter(nyNavn, opret);

  // Omdøb
  let omdoebId = null;
  const omNavn = $('omdoeb-navn');
  function aabnOmdoeb() {
    const p = valgtPost();
    if (!p || p.fejl) return;
    omdoebId = p.id;
    omNavn.value = p.navn;
    visFejl('omdoeb-fejl', '');
    G.aabnDialog('dlg-omdoeb');
    omNavn.focus();
    omNavn.select();
  }
  function omdoeb() {
    const navn = omNavn.value.trim();
    if (!navn) { visFejl('omdoeb-fejl', S.t('fejlNavnTomt')); return; }
    invoke('sag_omdoeb', { id: omdoebId, navn }).then(() => {
      $('dlg-omdoeb').close();
      opdater();
      if (omdoebId === status.id) invoke('sag_status').then(s => anvend(s, false)).catch(() => { /* uændret */ });
    }).catch(e => visFejl('omdoeb-fejl', fejlTekst(e)));
  }
  $('omdoeb-ok').addEventListener('click', omdoeb);
  vedEnter(omNavn, omdoeb);

  // Udløb
  let udloebId = null;
  const udDato = $('udloeb-dato'), udIngen = $('udloeb-ingen');
  function aabnUdloeb() {
    const p = valgtPost();
    if (!p || p.fejl) return;
    udloebId = p.id;
    udDato.value = p.udloeb || '';
    udIngen.checked = !p.udloeb;
    udDato.disabled = udIngen.checked;
    $('dlg-udloeb-p').setAttribute('data-v', p.navn);
    visFejl('udloeb-fejl', '');
    S.anvend($('dlg-udloeb'));
    G.aabnDialog('dlg-udloeb');
    (udIngen.checked ? udIngen : udDato).focus();
  }
  udIngen.addEventListener('change', () => { udDato.disabled = udIngen.checked; if (!udIngen.checked) udDato.focus(); });
  function gemUdloeb() {
    if (!udIngen.checked && !udDato.value) { visFejl('udloeb-fejl', S.t('fejlDatoMangler')); return; }
    invoke('sag_udloeb', { id: udloebId, udloeb: udIngen.checked ? null : udDato.value }).then(() => {
      $('dlg-udloeb').close();
      opdater();
      if (udloebId === status.id) invoke('sag_status').then(s => anvend(s, false)).catch(() => { /* uændret */ });
    }).catch(e => visFejl('udloeb-fejl', fejlTekst(e)));
  }
  $('udloeb-ok').addEventListener('click', gemUdloeb);

  // Slet: bekræftelsen nævner sagens navn.
  let sletId = null;
  function aabnSlet() {
    const p = valgtPost();
    if (!p) return;
    sletId = p.id;
    $('dlg-slet-p').setAttribute('data-v', navnFor(p));
    visFejl('slet-fejl', '');
    S.anvend($('dlg-slet'));
    G.aabnDialog('dlg-slet');
    $('slet-ok').focus();
  }
  $('slet-ok').addEventListener('click', () => {
    const var_aaben = sletId === status.id;
    invoke('sag_slet', { id: sletId }).then(s => {
      $('dlg-slet').close();
      st.valgt = null;
      anvend(s, var_aaben);
      opdater();
    }).catch(e => visFejl('slet-fejl', fejlTekst(e)));
  });

  // "Gem den midlertidige sag?" ved lukning af programmet eller før en anden sag åbnes.
  let kasserTil = 'afslut';
  function visKasser(til) {
    kasserTil = til;
    $('dlg-kasser-h').setAttribute('data-t', til === 'afslut' ? 'kasserAfslutH' : 'kasserAabnH');
    $('dlg-kasser-p').setAttribute('data-v', String(status.poster));
    S.anvend($('dlg-kasser'));
    G.aabnDialog('dlg-kasser');
    $('kasser-gem').focus();
  }
  $('kasser-ok').addEventListener('click', () => {
    $('dlg-kasser').close();
    if (kasserTil === 'afslut') invoke('program_afslut').catch(() => { /* programmet lukker */ });
    else aabn(kasserTil.slice(5));
  });
  $('kasser-gem').addEventListener('click', () => aabnNySag(kasserTil));

  /* ── Kommandoer, træ, søgning og hændelser ── */
  G.haandter('sager', 'ny-sag', () => aabnNySag('sager'));
  G.haandter('sager', 'aabn-i-masker', () => aabnValgt());
  G.haandter('sager', 'omdoeb', () => aabnOmdoeb());
  G.haandter('sager', 'udloeb', () => aabnUdloeb());
  G.haandter('sager', 'slet-sag', () => aabnSlet());
  d.soeg.addEventListener('input', () => { st.soeg = d.soeg.value; tegnTabel(); });
  document.addEventListener('grimnir-trae', e => {
    if (e.detail.visning !== 'sager') return;
    st.filter = e.detail.id === 'sager' ? 'alle' : e.detail.id;
    tegnTabel();
  });
  document.addEventListener('grimnir-visning', e => { if (e.detail === 'sager' && !G.laast) { opdater(); tegnFod(); } });
  document.addEventListener('grimnir-sprog', () => { tegnTabel(); tegnTitel(); });
  if (G.tauri && G.tauri.event && G.tauri.event.listen) {
    G.tauri.event.listen('menu', e => { if (e.payload === 'afslut') visKasser('afslut'); });
  }

  tegn();
  // V-LAAS.2: sagens status og listen hentes først, når Grimnir er låst op (laas.js); låst står intet fra sagerne her.
  (window.GrimnirLaas ? window.GrimnirLaas.klar : Promise.resolve()).then(() => {
    invoke('sag_status').then(s => anvend(s, false)).catch(() => anvend({ poster: 0 }, false));
    opdater();
  });
  window.GrimnirSager = { st, aabnIgen, opdater, get status() { return status; }, statusFor, dageTil };
})();
