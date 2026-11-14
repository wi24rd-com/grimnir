/* Grimnir — Sager (V-SAG.1, G4): visningen Sager, titellinjens sag og dialogerne Ny sag, Omdøb, Udløb, Slet sag og
   "Gem den midlertidige sag?". Bygger på skallen (window.Grimnir), kittet (window.Kit) og Maskér/Demaskér
   (window.GrimnirMaskering).

   En sag ligger krypteret i én fil på denne maskine, og nøglen ligger i nøgleringen (Rust, src-tauri/src/sager.rs).
   Webvisningen får kun hovederne (navn, antal værdier, datoer, udløb) og aldrig nøgler eller originaler. Navnet vises,
   fordi brugeren selv har skrevet det. Intet her skriver til konsollen eller til localStorage.

   V-MANUEL.2 N1: "Vis indhold" (båndet, Enter eller dobbeltklik på rækken, sagens dialog i titellinjen, og den tomme flade i
   Maskér og Demaskér) viser sagens poster: type, kode, rigtig værdi og tidligere koder, i sider fra Rust (sag_indhold), med
   søgning og type i venstre side. Værdierne hentes først, når visningen åbnes, og står kun i DOM'en og i denne fil, mens
   den er åben; Tilbage, Esc, en anden visning og en lås (genindlæsningen) fjerner dem. En hemmelighed hentes først, når
   brugeren trykker Vis, og skjules igen, når visningen forlades. En anden sag end den åbne læses kun (den åbne skiftes ikke).
   Rust-kommandoer: sag_status, sag_liste, sag_ny, sag_aabn, sag_luk, sag_nulstil, sag_omdoeb, sag_udloeb, sag_slet, sag_indhold,
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
  let status = { poster: 0, id: null, navn: null, udloeb: null, valg: null, noter: 0 };
  const sagSpan = $('sag'), sagKnap = $('sag-knap');

  /* V-OPBYG.1 N4 (D27): titellinjen siger altid, hvilken sag der er åben, når status er hentet (efter oplåsningen):
     "Midlertidig sag · ikke gemt under et navn" eller "Sag: «navn» · gemmes automatisk"; knappen åbner sagens dialog som
     før. Indtil status er hentet (låst), står "Ingen sag åben". Venstre side viser det samme under Aktuel sag. */
  let kendt = false;
  const sd = { navn: $('sagdel-navn'), status: $('sagdel-status'), gem: $('sagdel-gem'), erst: $('sagdel-erst'), antal: $('sagdel-antal'), noter: $('sagdel-noter'), noterAntal: $('sagdel-noter-antal') };
  function tegnTitel() {
    const navngiven = Boolean(status.id);
    sagSpan.hidden = kendt;
    sagKnap.hidden = !kendt;
    tegnSagdel();
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

  /* V-OPBYG.1 N4: Aktuel sag i venstre side (alle visninger): navnet eller "Midlertidig sag"; den midlertidige siger "Ikke
     gemt under et navn endnu" og har Gem som sag…; en navngiven "Gemmes automatisk". Gemte erstatninger (tallet) åbner
     sagens indhold (V-MANUEL.2); uden erstatninger er den slået fra og siger hvorfor. Kun navnet, brugeren selv har skrevet. */
  function tegnSagdel() {
    const navngiven = Boolean(status.id);
    if (navngiven) { sd.navn.removeAttribute('data-t'); sd.navn.textContent = status.navn; } else sd.navn.setAttribute('data-t', 'midlertidigSagNavn');
    sd.status.setAttribute('data-t', navngiven ? 'sagGemmesAuto' : 'sagIkkeGemt');
    sd.status.classList.toggle('gemmes', navngiven);
    sd.gem.hidden = navngiven;
    sd.antal.textContent = String(status.poster);
    sd.erst.setAttribute('data-v', String(status.poster));
    if (status.poster > 0) { sd.erst.removeAttribute('aria-disabled'); sd.erst.removeAttribute('data-t-title'); sd.erst.removeAttribute('title'); }
    else { sd.erst.setAttribute('aria-disabled', 'true'); sd.erst.setAttribute('data-t-title', 'hvorforIngenErstatninger'); }
    // V-OPBYG.2 N2: Noter N under Gemte erstatninger (alle faner); et klik åbner fanen Noter, også uden noter (dér skrives
    // den første).
    sd.noterAntal.textContent = String(status.noter || 0);
    sd.noter.setAttribute('data-v', String(status.noter || 0));
    S.anvend(sd.navn.parentElement);
  }
  sd.gem.addEventListener('click', () => gemSomSag());
  sd.noter.addEventListener('click', () => { if (!G.laast) G.vis('noter'); });
  sd.erst.addEventListener('click', () => { if (sd.erst.getAttribute('aria-disabled') !== 'true') visIndhold(null); });

  /* Ny status fra Rust. nulstil: sagens indhold er skiftet, så Maskér og Demaskér glemmer analyse og resultat. */
  function anvend(s, nulstil) {
    kendt = true;
    status = { poster: s.poster, id: s.id || null, navn: s.navn || null, udloeb: s.udloeb || null, valg: s.valg || null, noter: s.noter || 0 };
    if (nulstil) { GM.M.nulstilt(); GM.D.nulstilt(); }
    GM.saetSag(status.poster);
    tegnTitel();
    tegn();
    // V-OPBYG.2: fanen Noter og fodlinjen følger den åbne sag.
    document.dispatchEvent(new CustomEvent('grimnir-sag', { detail: { id: status.id, nulstil: Boolean(nulstil) } }));
    // Viser indholdet den åbne sag, er den skiftet eller ændret: hent igen (en anden sag på disk er uændret).
    if (ind.aktiv && (ind.id === null || ind.id === status.id || nulstil)) hentIndhold();
  }
  // Maskér har gemt: antallet af poster er ændret (også i en navngiven sag).
  document.addEventListener('grimnir-poster', e => {
    if (e.detail === status.poster) return;
    status.poster = e.detail;
    tegnTitel();
    if (status.id) opdater();
    if (ind.aktiv && (ind.id === null || ind.id === status.id)) hentIndhold();
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
      // V-MANUEL.2 N1: sagens indhold, når den har værdier.
      { id: 'vis-indhold', knapId: 'sag-vis-indhold', t: 'kVisIndhold', ved: () => { visIndhold(status.id); return true; } },
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
    dSag.knap('vis-indhold').hidden = !(status.poster > 0);
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
  // V-OPBYG.1 N5 (skitsen): en forklarende linje under listen om, hvad en sag husker, og hvornår den gemmes.
  const forklaring = document.createElement('p');
  forklaring.className = 'sag-forklaring';
  forklaring.setAttribute('data-t', 'sagForklaring');
  S.anvend(forklaring);
  ark.append(bannere, vaert, forklaring);
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
    d.tom.hidden = har || ind.aktiv;
    ark.hidden = !har || ind.aktiv;
    indArk.hidden = !ind.aktiv;
    d.soeg.disabled = !har && !ind.aktiv;
    bannere.textContent = '';
    if (st.fejl) GM.banner(bannere, 'danger', 'bSagFejl', st.fejl);
    if (st.fejl && !har && !ind.aktiv) { ark.hidden = false; }
  }
  function tegnTabel() {
    vaert.textContent = '';
    const r = filtrerede();
    const t = K.tabel({
      ariaT: 'pSager',
      // V-OPBYG.2 N1: kolonnen Noter (antallet fra sagens hoved; Rust læser ikke sagens indhold for listen).
      kolonner: [{ t: 'kolNavn' }, { t: 'kolVaerdier', tal: true }, { t: 'kolNoter', tal: true }, { t: 'kolOprettet' }, { t: 'kolSidstBrugt' }, { t: 'kolUdloeber' }, { t: 'kolStatus' }],
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
        return { celler: [navn, p.fejl ? '' : String(p.poster), p.fejl ? '' : String(p.noter || 0), p.fejl ? '' : fmtMs(p.oprettet), p.fejl ? '' : fmtMs(p.sidst_brugt), udl, c], data: p.id };
      }),
      vedValg: (tr, id) => { st.valgt = id; tegnKommandoer(); },
    });
    t.classList.add('sagtabel');
    const tr = [...t.querySelectorAll('tbody tr')];
    r.forEach((p, i) => {
      tr[i].setAttribute('data-id', p.id);
      // V-MANUEL.2 N1: Enter og dobbeltklik viser sagens indhold (Åbn i Maskér står i båndet). En sag, der ikke kan åbnes,
      // viser hvorfor.
      tr[i].addEventListener('dblclick', () => { st.valgt = p.id; visIndhold(p.id); });
      tr[i].addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); st.valgt = p.id; visIndhold(p.id); } });
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
    // V-OPBYG.1 N4: Gem som sag… for den midlertidige sag; en navngiven har allerede et navn.
    GM.kommando('sager', 'gem-som-sag', !status.id, 'hvorforHarNavn');
    // V-MANUEL.2 N1: Vis indhold for enhver valgt sag (en sag, der ikke kan åbnes, viser årsagen i visningen).
    GM.kommando('sager', 'vis-indhold', Boolean(p), 'hvorforVaelgSag');
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
  // V-OPBYG.2 N4: fodlinjen er sagens navn og antal gemte erstatninger (maskering.js), også i sagens indhold.
  function tegnFod() { if (G.aktiv === 'sager') GM.tegnFodlinje(); }

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

  /* ═════════════════════════════ Sagens indhold (V-MANUEL.2 N1) ═════════════════════════════ */
  /* Tabellen er til at læse: type, kode, rigtig værdi og tidligere koder (D18). Sagen gemmer ikke, hvor mange steder en
     værdi stod, så den kolonne er der ikke (panelhovedet siger det). id null er den åbne sag (også den midlertidige); en
     anden sag læses kun.
     V-OPBYG.5 N2: rækkens "…"-knap sidst i rækken (GM.raekkeMenu; overskriften "Handlinger" er skjult tekst): Kopiér værdi,
     Vis/Skjul for en hemmelighed og Slet. Kopiér værdi og Slet kun i den åbne sag (ellers slået fra med forklaring). En
     almindelig værdi kopierer webvisningen og melder det (udklip_vaerdi_kopieret); en hemmelighed lægger Rust selv i
     udklipsholderen (sag_post_kopier), så værdien ikke går forbi webvisningen. Begge ryddes ved lås og afslutning, hvis de
     stadig står der (D21). Slet beder om kittets bekræftelse (farlig, fokus på Annullér); Rust gemmer en navngiven sag
     straks (sag_post_slet), og Ret en post er fravalgt (Jan). */
  const SIDE = 500;
  const ind = { aktiv: false, id: null, type: '', soeg: '', vist: new Set(), antal: SIDE, svar: null, fejl: null, nr: 0, foerSoeg: '', foerFilter: null };
  const indArk = document.createElement('div');
  indArk.className = 'arbejde sagliste sagindhold';
  indArk.hidden = true;
  const indTop = document.createElement('div');
  indTop.className = 'indhold-top';
  const tilbageKnap = K.knap({ t: 'kTilbageTilSager', ariaT: 'ariaTilbageTilSager', ved: () => lukIndhold(true) });
  tilbageKnap.id = 'indhold-tilbage';
  indTop.appendChild(tilbageKnap);
  const indBannere = document.createElement('div');
  indBannere.className = 'bannere';
  const indPanel = document.createElement('section');
  indPanel.className = 'panel indholdpanel';
  const indHoved = document.createElement('div');
  indHoved.className = 'panel-hoved';
  const indH = document.createElement('h3');
  const indInfo = document.createElement('span');
  indInfo.className = 'muted';
  indHoved.append(indH, indInfo);
  const indVaert = document.createElement('div');
  indVaert.className = 'tabelvaert';
  const indFlere = document.createElement('div');
  indFlere.className = 'flere';
  const indFlereTekst = document.createElement('span');
  const indFlereKnap = K.knap({ t: 'visFlere', ved: () => { ind.antal += SIDE; hentIndhold(); } });
  indFlereKnap.classList.add('mini');
  indFlere.append(indFlereTekst, indFlereKnap);
  indPanel.append(indHoved, indVaert, indFlere);
  // V-OPBYG.5 N2: meldingen efter Kopiér værdi og Slet (høflig, role="status").
  const indBesked = document.createElement('p');
  indBesked.className = 'besked';
  indBesked.setAttribute('role', 'status');
  indArk.append(indTop, indBannere, indBesked, indPanel);
  d.flade.appendChild(indArk);
  // Esc i visningen går tilbage til listen (også fra tabellen og knapperne).
  indArk.addEventListener('keydown', e => { if (e.key === 'Escape' && !document.querySelector('dialog[open]')) { e.preventDefault(); lukIndhold(true); } });

  // Venstre side: Sagers træ viser typerne med antal, mens indholdet vises (kittets saetPunkter; valget kommer som
  // 'grimnir-trae'), og listens punkter igen bagefter.
  const LISTE_PUNKTER = G.VISNINGER.find(v => v.id === 'sager').trae;
  function vaelgType(id) { ind.type = id === 'i-alle' ? '' : id.slice(2); ind.antal = SIDE; tegnFilterTekst(); hentIndhold(); }
  S.anvend(indArk);
  function tegnFilterTekst() {
    d.flTekst.setAttribute('data-t', ind.type ? 'art_' + ind.type : 'tIndhold');
    S.anvend(d.flTekst);
  }

  /* Viser sagens indhold: id er sagens id (null: den åbne sag i hukommelsen). */
  function visIndhold(id) {
    if (G.laast) return;
    const var_aktiv = ind.aktiv;
    Object.assign(ind, { aktiv: true, id: id || null, type: '', soeg: '', vist: new Set(), antal: SIDE, svar: null, fejl: null });
    indMeld(null);
    if (id) st.valgt = id;
    if (!var_aktiv) {
      ind.foerSoeg = d.soeg.value;
      ind.foerFilter = d.flTekst.getAttribute('data-t');
    }
    d.soeg.value = '';
    d.soeg.setAttribute('data-t-ph', 'soegIndhold');
    d.soeg.setAttribute('data-t-aria', 'soegIndhold');
    S.anvend(d.soeg.parentElement);
    d.trae.saetPunkter([{ id: 'i-alle', t: 'tIndhold', antal: 0 }], 'i-alle');
    S.anvend(d.nd);
    tegnFilterTekst();
    if (G.aktiv !== 'sager') G.vis('sager');
    tegnIndhold();
    tegn();
    tilbageKnap.focus();
    return hentIndhold();
  }
  /* Tilbage til listen. Værdierne fjernes fra DOM'en og fra hukommelsen her; viste hemmeligheder er skjult næste gang. */
  function lukIndhold(fokus) {
    if (!ind.aktiv) return;
    Object.assign(ind, { aktiv: false, svar: null, fejl: null, vist: new Set(), soeg: '', type: '' });
    ind.nr++;
    indMeld(null);
    indVaert.textContent = '';
    indBannere.textContent = '';
    d.soeg.value = ind.foerSoeg;
    d.soeg.setAttribute('data-t-ph', 'soegSager');
    d.soeg.setAttribute('data-t-aria', 'soegSager');
    S.anvend(d.soeg.parentElement);
    d.trae.saetPunkter(LISTE_PUNKTER, st.filter);
    S.anvend(d.nd);
    if (ind.foerFilter) d.flTekst.setAttribute('data-t', ind.foerFilter); else d.flTekst.removeAttribute('data-t');
    S.anvend(d.flTekst);
    tegn();
    if (fokus) {
      const tr = vaert.querySelector(`tr[data-id="${st.valgt}"]`);
      (tr || vaert.querySelector('tbody tr') || d.soeg).focus();
    }
  }
  /* V-OPBYG.5 N2: meldingen i sagens indhold (t: sprognøgle, v: {v}); uden t ryddes den. */
  function indMeld(t, v) {
    for (const a of ['data-t', 'data-v']) indBesked.removeAttribute(a);
    indBesked.textContent = '';
    if (t) { indBesked.setAttribute('data-t', t); if (v != null) indBesked.setAttribute('data-v', String(v)); S.anvend(indBesked); }
  }
  /* V-OPBYG.5 N2: rækkens handlinger i sagens indhold. */
  function indholdPunkter(p, svar) {
    const hvorfor = svar && svar.aaben ? null : 'hvorforKunAabenSag';
    const ud = [{ id: 'kopier', t: 'rmKopier', hvorfor, ved: () => kopierVaerdi(p) }];
    if (p.hemmelig) ud.push({ id: 'vis', t: p.vaerdi == null ? 'vis' : 'skjul', fokusTilbage: false, ved: () => skiftVis(p, 'handlinger') });
    ud.push({ id: 'slet', t: 'rmSlet', farlig: true, hvorfor, fokusTilbage: false, ved: () => sletPost(p) });
    return ud;
  }
  const raekkeKnap = (nr, felt) => indVaert.querySelector(`tr[data-nr="${nr}"] [data-felt="${felt}"]`);
  /* Vis/Skjul en hemmelighed (rækkens knap og menuens punkt); fokus bliver på det felt, der blev brugt. */
  function skiftVis(p, felt) {
    if (ind.vist.has(p.nr)) ind.vist.delete(p.nr); else ind.vist.add(p.nr);
    return hentIndhold().then(() => { const n = raekkeKnap(p.nr, felt); if (n) n.focus(); });
  }
  async function kopierVaerdi(p) {
    let ok = false;
    try {
      if (p.hemmelig) ok = (await invoke('sag_post_kopier', { nr: p.nr, kode: p.kode })) === true;
      else if (p.vaerdi != null) {
        ok = (await GM.kopier(p.vaerdi)) === true;
        if (ok) invoke('udklip_vaerdi_kopieret', { nr: p.nr, kode: p.kode }).catch(() => { /* låst: låsen har ryddet */ });
      }
    } catch (e) {
      if (e && e.art === 'ukendt_post') { indMeld('bIndholdAendret'); hentIndhold(); return false; }
      ok = false;
    }
    indMeld(ok ? 'bVaerdiKopieret' : 'bVaerdiIkkeKopieret');
    return ok;
  }
  function sletPost(p) {
    return G.bekraeft({
      t: 'sletPostH', p: { t: 'sletPostP' }, nej: { t: 'annuller' }, ja: { t: 'kSletPostOk' }, farlig: true,
      udfyld: rod => { rod.id = 'dlg-slet-post'; const x = rod.querySelector('[data-t="sletPostP"]'); if (x) x.setAttribute('data-v', p.kode); S.anvend(rod); },
    }).then(ja => {
      if (!ja) { const b = raekkeKnap(p.nr, 'handlinger'); if (b) b.focus(); return false; }
      return invoke('sag_post_slet', { nr: p.nr, kode: p.kode }).then(s => {
        anvend(s);
        indMeld('bPostSlettet', p.kode);
        // Maskér: en analyse, der viste koden, laves igen med sagen, som den er nu.
        if (GM.M.st.analyse) GM.M.analyserIgen();
        return hentIndhold().then(() => { (indVaert.querySelector('[data-felt="handlinger"]') || tilbageKnap).focus(); return true; });
      }).catch(e => {
        if (e && e.art === 'ukendt_post') { indMeld('bIndholdAendret'); hentIndhold(); return false; }
        indMeld('bPostIkkeSlettet', fejlTekst(e));
        return false;
      });
    });
  }
  function hentIndhold() {
    if (!ind.aktiv) return Promise.resolve();
    const nr = ++ind.nr;
    return invoke('sag_indhold', { id: ind.id, valg: { type: ind.type, soeg: ind.soeg, vist: [...ind.vist], antal: ind.antal } })
      .then(svar => { if (nr !== ind.nr || !ind.aktiv) return; ind.svar = svar; ind.fejl = null; tegnIndhold(); })
      .catch(e => { if (nr !== ind.nr || !ind.aktiv) return; ind.svar = null; ind.fejl = fejlTekst(e); tegnIndhold(); });
  }
  function celle(tekst, mono) {
    const c = document.createElement('span');
    c.className = (mono ? 'mono ' : '') + 'kort';
    c.textContent = tekst;
    c.title = tekst;
    return c;
  }
  function vaerdiCelle(p) {
    const c = document.createElement('span');
    c.className = 'vaerdi';
    if (p.hemmelig && p.vaerdi == null) {
      const prik = document.createElement('span');
      prik.className = 'prikker';
      prik.setAttribute('data-t', 'skjultVaerdi');
      c.appendChild(prik);
    } else {
      c.appendChild(celle(p.vaerdi == null ? '' : p.vaerdi, true));
    }
    if (p.hemmelig) {
      const skjult = p.vaerdi == null;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'mini';
      b.setAttribute('data-t', skjult ? 'vis' : 'skjul');
      b.setAttribute('data-t-aria', skjult ? 'ariaVisKode' : 'ariaSkjulKode');
      b.setAttribute('data-v', p.kode);
      b.setAttribute('data-felt', 'vis');
      b.addEventListener('click', () => skiftVis(p, 'vis'));
      c.appendChild(b);
    }
    return c;
  }
  function tegnIndhold() {
    indBannere.textContent = '';
    indVaert.textContent = '';
    const svar = ind.svar;
    indH.setAttribute('data-t', svar && svar.navn ? 'pSagIndhold' : svar || ind.id === null ? 'pMidlIndhold' : 'tIndhold');
    if (svar && svar.navn) indH.setAttribute('data-v', svar.navn); else indH.removeAttribute('data-v');
    indPanel.setAttribute('data-t-aria', indH.getAttribute('data-t'));
    if (indH.hasAttribute('data-v')) indPanel.setAttribute('data-v', indH.getAttribute('data-v')); else indPanel.removeAttribute('data-v');
    indInfo.hidden = !svar;
    if (svar) { indInfo.setAttribute('data-t', 'indholdInfo'); indInfo.setAttribute('data-v', String(svar.i_alt)); }
    if (ind.fejl) GM.banner(indBannere, 'danger', 'bIndholdFejl', ind.fejl);
    if (svar && !svar.aaben) {
      if (status.navn) GM.banner(indBannere, 'info', 'bIndholdLaest', status.navn); else GM.banner(indBannere, 'info', 'bIndholdLaestMidl');
    }
    if (svar && svar.udloeb && dageTil(svar.udloeb) < 0) GM.banner(indBannere, 'warn', 'bIndholdUdloebet', fmtDato(svar.udloeb));
    indFlere.hidden = true;
    if (svar) {
      const t = K.tabel({
        ariaT: 'tIndhold', raekkeHandling: 'ingen',
        kolonner: [{ t: 'kolType' }, { t: 'kolKode' }, { t: 'kolRigtigVaerdi' }, { t: 'kolTidligereKoder' }, { t: 'kolHandlinger' }],
        raekker: svar.raekker.map(p => {
          const type = document.createElement('span');
          type.setAttribute('data-t', 'art_' + p.type);
          // V-OPBYG.5 N2: navnet er koden (også for en hemmelighed; aldrig værdien).
          const menu = GM.raekkeMenu({ ariaT: 'ariaHandlinger', ariaV: p.kode, punkter: () => indholdPunkter(p, ind.svar) });
          return { celler: [type, celle(p.kode, true), vaerdiCelle(p), p.aliaser.length ? celle(p.aliaser.join(', '), true) : '—', menu], data: p.nr, attr: { 'data-nr': String(p.nr) } };
        }),
      });
      t.classList.add('indholdtabel');
      // V-OPBYG.5 N2: kolonnen med "…" har en overskrift for skærmlæsere (skjult tekst; kolonnen er 40 px).
      const th5 = t.querySelector('thead th:last-child');
      if (th5) { th5.removeAttribute('data-t'); th5.textContent = ''; const sk = document.createElement('span'); sk.className = 'skjult-tekst'; sk.setAttribute('data-t', 'kolHandlinger'); th5.appendChild(sk); }
      indVaert.appendChild(t);
      // V-OPBYG.2 N1: en anden sags noter står skrivebeskyttet under erstatningerne (læst som dem; den åbnes ikke).
      if (!svar.aaben && svar.noter && svar.noter.length && window.GrimnirNoter) indVaert.appendChild(window.GrimnirNoter.laesbare(svar.noter));
      if (!svar.raekker.length) {
        const tom = document.createElement('p');
        tom.className = 'tabel-tom';
        tom.setAttribute('data-t', svar.i_alt ? 'ingenIIndhold' : 'indholdTom');
        indVaert.appendChild(tom);
      }
      indFlere.hidden = svar.fundet <= svar.raekker.length;
      indFlereTekst.setAttribute('data-t', 'visesAf');
      indFlereTekst.setAttribute('data-v', String(svar.raekker.length));
      indFlereTekst.setAttribute('data-w', String(svar.fundet));
      const valgt = ind.type ? 'i-' + ind.type : 'i-alle';
      d.trae.saetPunkter([{ id: 'i-alle', t: 'tIndhold', antal: svar.i_alt, boern: svar.typer.map(x => ({ id: 'i-' + x.type, t: 'art_' + x.type, antal: x.antal })) }], valgt);
      S.anvend(d.nd);
    }
    S.anvend(indArk);
    tegnIndholdFod();
  }
  function tegnIndholdFod() { tegnFod(); }

  /* ── Åbn en sag ── */
  function aabnValgt() {
    const p = valgtPost();
    if (!p || p.fejl) return;
    if (p.id === status.id) { G.vis('masker'); return; }
    anmodAabn(p.id);
  }
  function anmodAabn(id) {
    // En midlertidig sag med poster går tabt, når en anden sag åbnes: spørg først.
    // V-OPBYG.2: også en midlertidig sag med noter (D21: intet går tabt uden at spørge).
    if (!status.id && (status.poster > 0 || status.noter > 0)) { visKasser('aabn:' + id); return; }
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
    const kp = dKasser.rod.querySelector('.modal-tekst');
    kp.setAttribute('data-t', status.noter > 0 ? 'kasserNoterP' : 'kasserP');
    kp.setAttribute('data-v', String(status.poster));
    kp.setAttribute('data-w', String(status.noter || 0));
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
  // V-OPBYG.1 N4: Gem som sag… (båndet, venstre side og beskeden efter Maskér) åbner dialogen Ny sag, som titellinjens.
  function gemSomSag() { if (!G.laast && !status.id) aabnNySag('gem-som'); }
  G.haandter('sager', 'gem-som-sag', () => gemSomSag());
  G.haandter('sager', 'aabn-i-masker', () => aabnValgt());
  G.haandter('sager', 'omdoeb', () => aabnOmdoeb());
  G.haandter('sager', 'udloeb', () => aabnUdloeb());
  G.haandter('sager', 'slet-sag', () => aabnSlet());
  d.soeg.addEventListener('input', () => {
    if (ind.aktiv) { ind.soeg = d.soeg.value; ind.antal = SIDE; hentIndhold(); return; }
    st.soeg = d.soeg.value;
    tegnTabel();
  });
  G.haandter('sager', 'vis-indhold', () => { const p = valgtPost(); if (p) visIndhold(p.id); });
  document.addEventListener('grimnir-trae', e => {
    if (e.detail.visning !== 'sager') return;
    // V-MANUEL.2 N1: mens indholdet vises, er træets punkter sagens typer.
    if (ind.aktiv) { vaelgType(e.detail.id); return; }
    st.filter = e.detail.id === 'sager' ? 'alle' : e.detail.id;
    tegnTabel();
  });
  document.addEventListener('grimnir-visning', e => {
    // V-MANUEL.2 N1: forlades Sager, lukkes indholdet (værdierne fjernes, og en vist hemmelighed er skjult igen).
    if (e.detail !== 'sager') lukIndhold(false);
    if (e.detail === 'sager' && !G.laast) { opdater(); tegnFod(); }
  });
  document.addEventListener('grimnir-sprog', () => { tegnTabel(); tegnTitel(); if (ind.aktiv) tegnIndhold(); });
  if (G.tauri && G.tauri.event && G.tauri.event.listen) {
    G.tauri.event.listen('menu', e => { if (e.payload === 'afslut') visKasser('afslut'); });
  }

  tegn();
  // V-LAAS.2: sagens status og listen hentes først, når Grimnir er låst op (laas.js); låst står intet fra sagerne her.
  (window.GrimnirLaas ? window.GrimnirLaas.klar : Promise.resolve()).then(() => {
    invoke('sag_status').then(s => anvend(s, false)).catch(() => anvend({ poster: 0 }, false));
    opdater();
  });
  /* V-OPBYG.2: noter.js melder antallet efter en ændring (status.noter; venstre side, listen og spørgsmålet ved en anden sag). */
  function saetNoter(n) {
    if (status.noter === n) return;
    status.noter = n;
    tegnSagdel();
    if (status.id) opdater();
  }
  window.GrimnirSager = { st, aabnIgen, opdater, get status() { return status; }, statusFor, dageTil, ind, visIndhold, lukIndhold, gemSomSag, saetNoter };
})();
