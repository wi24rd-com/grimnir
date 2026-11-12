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

  /* V-KITBRUG.1 N3: sagens valg og "Ingen udløb" (i Udløb nedenfor) er kittets afkrydsning (samme id'er; navnet står
     stadig i aria-label). */
  function afkrydsning(id, t) {
    const a = K.afkrydsning({ id, t });
    a.input.setAttribute('data-t-aria', t);
    return a.rod;
  }

  /* V-KITBRUG.1 N4: felterne i kittets dialoger (Ny sag, Omdøb, Udløb) er kittets TextField (.felt) i samme rækkefølge
     som før. V-KITBRUG.2 N1: fejlen står i kittets fejlfelt (G1: fejl: true, d.fejl; id <dialog>-fejl, role="alert"),
     og knappens handling er et løfte (knappen venter, aria-busy; true lukker, afvist viser fejlen). */
  const FOELSOM = { spellcheck: 'false', autocomplete: 'off', autocorrect: 'off', autocapitalize: 'off' };
  function feltMed(id, etiket, type, attr, hj) {
    const f = document.createElement('div');
    f.className = 'felt';
    const l = document.createElement('label');
    l.className = 'label';
    l.htmlFor = id;
    l.setAttribute('data-t', etiket);
    const i = document.createElement('input');
    i.id = id;
    i.type = type;
    for (const [k, v] of Object.entries(attr)) i.setAttribute(k, v);
    f.append(l, i);
    if (hj) {
      const h = document.createElement('span');
      h.className = 'hj';
      h.id = id + '-hj';
      h.setAttribute('data-t', hj);
      f.appendChild(h);
    }
    return f;
  }
  function felter(...f) { const e = document.createElement('div'); e.className = 'dlg-felter'; e.append(...f); return e; }

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

  /* Titellinjens dialog: midlertidig sag (Gem som sag, Nulstil) eller navngiven (Skift sag, Luk sag). V-KITBRUG.2 N1:
     kittets dialog med samme overskrift (dlg-sag-h), sætning (dlg-sag-p), valg, fejl og knapper som før; fejlen står i
     kittets fejlfelt (G1). Knapperne er Luk, Nulstil sagen (farlig), Gem som sag (primær), Skift sag og Luk sag
     (primær), og to af dem er skjult: en midlertidig sag viser Luk, Nulstil sagen og Gem som sag, en navngiven Luk,
     Skift sag og Luk sag. Kittets regel (G4): skjulte knapper tæller ikke med i reglen om én primær; kittet flytter kun
     den første primære (Gem som sag) yderst, og Luk sag står sidst i listen, så den også står yderst, når den vises. */
  const sagValg = document.createElement('fieldset');
  sagValg.className = 'valg lodret sag-valg';
  sagValg.id = 'sag-valg';
  const sagLegend = document.createElement('legend');
  sagLegend.className = 'label';
  sagLegend.setAttribute('data-t', 'sagValgH');
  const sagValgHj = document.createElement('span');
  sagValgHj.className = 'hj';
  sagValgHj.id = 'sag-valg-hj';
  sagValgHj.setAttribute('data-t', 'sagValgNye');
  sagValg.append(sagLegend, afkrydsning('sag-fremmede', 'valgFremmede'), afkrydsning('sag-oktet', 'valgOktet'), sagValgHj);
  const dSag = G.kitDialog({
    id: 'dlg-sag', t: 'sagH', p: { t: 'sagP' }, indhold: sagValg, fejl: true,
    knapper: [
      { id: 'luk', t: 'luk' },
      { id: 'nulstil', knapId: 'sag-nulstil', t: 'nulstilSag', variant: 'danger', ved: () => invoke('sag_nulstil').then(s => { anvend(s, true); return true; }, () => false) },
      { id: 'gem-som', knapId: 'sag-gem-som', t: 'gemSomSag', variant: 'primary', ved: () => { aabnNySag('gem-som'); return false; } },
      { id: 'skift', knapId: 'sag-skift', t: 'skiftSag', ved: () => { G.vis('sager'); } },
      { id: 'luk-sag', knapId: 'sag-luk', t: 'lukSag', variant: 'primary', ved: () => invoke('sag_luk').then(s => { anvend(s, true); opdater(); return true; }, () => false) },
    ],
  });
  sagKnap.addEventListener('click', () => {
    const navngiven = Boolean(status.id);
    const h = dSag.overskrift, p = $('dlg-sag-p');
    h.setAttribute('data-t', navngiven ? 'sagNavngivenH' : 'sagH');
    h.setAttribute('data-v', navngiven ? status.navn : '');
    p.setAttribute('data-t', navngiven ? 'sagNavngivenP' : 'sagP');
    p.setAttribute('data-v', String(status.poster));
    dSag.knap('nulstil').hidden = navngiven;
    dSag.knap('gem-som').hidden = navngiven;
    dSag.knap('skift').hidden = !navngiven;
    dSag.knap('luk-sag').hidden = !navngiven;
    tegnValg();
    S.anvend(dSag.rod);
    // Fokus som browserens: det første valg, eller Luk, når sagen ingen valg har (fieldset'et er skjult).
    G.aabnDialog('dlg-sag', status.valg ? undefined : 'luk');
  });

  /* Sagens valg (D4, D5). En ændring i en sag med værdier gælder kun nye værdier; det står i dialogen. */
  const vFremmede = $('sag-fremmede'), vOktet = $('sag-oktet');
  function tegnValg() {
    sagValg.hidden = !status.valg;
    dSag.fejl(null);
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
      .catch(e => { tegnValg(); dSag.fejl(S.t('bSagFejl', fejlTekst(e))); });
  }
  vFremmede.addEventListener('change', gemValg);
  vOktet.addEventListener('change', gemValg);
  // Nulstil sagen og Luk sag: kan de ikke, er sagen uændret, og dialogen bliver åben (som før, uden besked).

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
    // Årsagen til, at en sag ikke kan åbnes, står som {v} i forklaringen (kittets værktøjstip, G11).
    for (const id of ['aabn-i-masker', 'omdoeb', 'udloeb']) GM.kommando('sager', id, p && !p.fejl, p ? 'hvorforKanIkkeAabnes' : 'hvorforVaelgSag', null, kanIkke ? kanIkke[1] : null);
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
  // Enter i et felt er det samme som et klik på dialogens primære knap (kittets knap venter på løftet og lukker selv).
  function vedEnter(input, knap) { input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); knap.click(); } }); }
  // En fejl fra Rust som tekst i kittets fejlfelt (et afvist løfte med en tekst).
  const somTekst = e => { throw fejlTekst(e); };

  // Ny sag (også "Gem som sag" fra titellinjen og fra spørgsmålet ved lukning eller skift).
  let nyTil = 'sager';
  const dNy = G.kitDialog({
    id: 'dlg-ny-sag', t: 'nySagH', p: { t: 'nySagP' }, fejl: true,
    indhold: felter(
      feltMed('ny-sag-navn', 'feltNavn', 'text', { ...FOELSOM, maxlength: '120', 'data-t-aria': 'feltNavn', 'aria-describedby': 'dlg-ny-sag-fejl' }),
      feltMed('ny-sag-udloeb', 'feltUdloebValgfri', 'date', { 'data-t-aria': 'feltUdloebValgfri', 'aria-describedby': 'ny-sag-udloeb-hj' }, 'hjUdloeb'),
    ),
    knapper: [{ id: 'annuller', t: 'annuller' }, { id: 'opret', knapId: 'ny-sag-opret', t: 'opretSag', variant: 'primary', ved: () => opret() }],
  });
  const nyNavn = $('ny-sag-navn'), nyUdloeb = $('ny-sag-udloeb');
  function aabnNySag(til) {
    nyTil = til;
    nyNavn.value = '';
    // Standardudløbet fra indstillingerne (ingen, 30 eller 90 dage).
    const dage = window.GrimnirIndst && window.GrimnirIndst.st.indst ? window.GrimnirIndst.st.indst.udloeb_dage : null;
    nyUdloeb.value = dage ? datoOmDage(dage) : '';
    nyUdloeb.min = iDag();
    const p = dNy.rod.querySelector('.modal-tekst');
    p.setAttribute('data-t', status.id ? 'nySagTomP' : status.poster > 0 ? 'nySagMedPosterP' : 'nySagP');
    p.setAttribute('data-v', String(status.poster));
    S.anvend(dNy.rod);
    G.aabnDialog('dlg-ny-sag', nyNavn);
  }
  function opret() {
    const navn = nyNavn.value.trim();
    // V-PUDS.3 N4: fejlen hører til Navn og ryddes, når der skrives i det (app.js, kitDialog).
    if (!navn) { dNy.fejl(S.t('fejlNavnTomt'), nyNavn); nyNavn.focus(); return false; }
    const fraNavngiven = Boolean(status.id);
    return invoke('sag_ny', { navn, udloeb: nyUdloeb.value || null }).then(s => {
      anvend(s, fraNavngiven);
      opdater();
      if (nyTil === 'afslut') invoke('program_afslut').catch(() => { /* programmet lukker */ });
      else if (nyTil.startsWith('aabn:')) aabn(nyTil.slice(5));
      return true;
    }, somTekst);
  }
  vedEnter(nyNavn, dNy.knap('opret'));

  // Omdøb
  let omdoebId = null;
  const dOmdoeb = G.kitDialog({
    id: 'dlg-omdoeb', t: 'omdoebH', fejl: true,
    indhold: felter(feltMed('omdoeb-navn', 'feltNavn', 'text', { ...FOELSOM, maxlength: '120', 'data-t-aria': 'feltNavn', 'aria-describedby': 'dlg-omdoeb-fejl' })),
    knapper: [{ id: 'annuller', t: 'annuller' }, { id: 'ok', knapId: 'omdoeb-ok', t: 'kOmdoeb', variant: 'primary', ved: () => omdoeb() }],
  });
  const omNavn = $('omdoeb-navn');
  function aabnOmdoeb() {
    const p = valgtPost();
    if (!p || p.fejl) return;
    omdoebId = p.id;
    omNavn.value = p.navn;
    G.aabnDialog('dlg-omdoeb', omNavn);
    omNavn.select();
  }
  function omdoeb() {
    const navn = omNavn.value.trim();
    if (!navn) { dOmdoeb.fejl(S.t('fejlNavnTomt'), omNavn); return false; }
    return invoke('sag_omdoeb', { id: omdoebId, navn }).then(() => {
      opdater();
      if (omdoebId === status.id) invoke('sag_status').then(s => anvend(s, false)).catch(() => { /* uændret */ });
      return true;
    }, somTekst);
  }
  vedEnter(omNavn, dOmdoeb.knap('ok'));

  // Udløb
  let udloebId = null;
  const dUdloeb = G.kitDialog({
    id: 'dlg-udloeb', t: 'udloebH', p: { t: 'udloebP' }, fejl: true,
    indhold: felter(
      feltMed('udloeb-dato', 'feltUdloeb', 'date', { 'data-t-aria': 'feltUdloeb', 'aria-describedby': 'dlg-udloeb-fejl' }),
      afkrydsning('udloeb-ingen', 'ingenUdloeb'),
    ),
    knapper: [{ id: 'annuller', t: 'annuller' }, { id: 'ok', knapId: 'udloeb-ok', t: 'gem', variant: 'primary', ved: () => gemUdloeb() }],
  });
  const udDato = $('udloeb-dato'), udIngen = $('udloeb-ingen');
  function aabnUdloeb() {
    const p = valgtPost();
    if (!p || p.fejl) return;
    udloebId = p.id;
    udDato.value = p.udloeb || '';
    udIngen.checked = !p.udloeb;
    udDato.disabled = udIngen.checked;
    dUdloeb.rod.querySelector('.modal-tekst').setAttribute('data-v', p.navn);
    S.anvend(dUdloeb.rod);
    G.aabnDialog('dlg-udloeb', udIngen.checked ? udIngen : udDato);
  }
  udIngen.addEventListener('change', () => { udDato.disabled = udIngen.checked; if (!udIngen.checked) udDato.focus(); });
  function gemUdloeb() {
    // V-PUDS.3 N4: fejlen handler om udløbet: den ryddes af en dato og af "Ingen udløb".
    if (!udIngen.checked && !udDato.value) { dUdloeb.fejl(S.t('fejlDatoMangler'), [udDato, udIngen]); return false; }
    return invoke('sag_udloeb', { id: udloebId, udloeb: udIngen.checked ? null : udDato.value }).then(() => {
      opdater();
      if (udloebId === status.id) invoke('sag_status').then(s => anvend(s, false)).catch(() => { /* uændret */ });
      return true;
    }, somTekst);
  }

  /* Slet: bekræftelsen nævner sagens navn. V-KITBRUG.2 N1: kittets bekræftelse, der kan fejle (Kit.bekraeft med ved,
     G2): fejlen står i dialogen, der bliver åben. N2 (Jan): fokus står på Annullér (kittets standard ved en farlig
     handling), så Enter ikke sletter uden et Tab. Dialogen laves ved åbning og fjernes ved lukning; id'et dlg-slet
     sætter Grimnir selv (Kit.bekraeft har intet id; kit-ønske G12). */
  function aabnSlet() {
    const p = valgtPost();
    if (!p) return;
    const id = p.id, var_aaben = id === status.id;
    let svar = null;
    G.bekraeft({
      t: 'sletH', p: { t: 'sletP' }, nej: { t: 'annuller' }, ja: { t: 'kSletSag' }, farlig: true,
      udfyld: rod => { rod.id = 'dlg-slet'; rod.querySelector('.modal-tekst').setAttribute('data-v', navnFor(p)); S.anvend(rod); },
      ved: () => invoke('sag_slet', { id }).then(s => { svar = s; }, somTekst),
    }).then(ja => {
      if (!ja) return;
      st.valgt = null;
      anvend(svar, var_aaben);
      opdater();
    });
  }

  // "Gem den midlertidige sag?" ved lukning af programmet eller før en anden sag åbnes. Tre knapper som før: Annullér,
  // Kassér (farlig) og Gem som sag (primær, har fokus; kittets regel for et spørgsmål med tre svar, G4).
  let kasserTil = 'afslut';
  const dKasser = G.kitDialog({
    id: 'dlg-kasser', t: 'kasserAfslutH', p: { t: 'kasserP' },
    knapper: [
      { id: 'annuller', t: 'annuller' },
      { id: 'kasser', knapId: 'kasser-ok', t: 'kasser', variant: 'danger', ved: () => { kasser(); return false; } },
      { id: 'gem', knapId: 'kasser-gem', t: 'gemSomSag', variant: 'primary', ved: () => { aabnNySag(kasserTil); return false; } },
    ],
  });
  function visKasser(til) {
    kasserTil = til;
    dKasser.overskrift.setAttribute('data-t', til === 'afslut' ? 'kasserAfslutH' : 'kasserAabnH');
    dKasser.rod.querySelector('.modal-tekst').setAttribute('data-v', String(status.poster));
    S.anvend($('dlg-kasser'));
    G.aabnDialog('dlg-kasser', 'gem');
  }
  function kasser() {
    $('dlg-kasser').close();
    if (kasserTil === 'afslut') invoke('program_afslut').catch(() => { /* programmet lukker */ });
    else aabn(kasserTil.slice(5));
  }

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
