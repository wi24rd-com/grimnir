/* Grimnir — Noter (V-OPBYG.2 N2): fanen Noter for den åbne sag (også den midlertidige), som skitsen: en forklaring øverst,
   noterne i tidsorden med dato og klokkeslæt (sprogets format, maskinens tidszone), og nederst feltet Ny note med Gem note
   (⌘↵ i feltet gemmer; Ctrl+Enter på Windows). Båndet: Ny note (fokus i feltet), Ret note og Slet note for den valgte note
   (slået fra med forklaring uden et valg; Slet spørger med kittets bekræftelse, fokus på Annullér), og Kopiér noterne.

   En note er brugerens egen tekst: feltet er et almindeligt <textarea> (linjeskift gemmes som skrevet), og Grimnir
   gennemsøger den ikke (D27). Rust gemmer en navngiven sag straks; den midlertidige følger D21 (gemmes ved lås og
   afslutning, og "Gem som sag" tager noterne med).

   Noternes tekst står kun i DOM'en og i denne fil, mens fanen er åben: den hentes fra Rust, hver gang fanen åbnes
   (noter_hent), og fjernes, når en anden fane vælges. Ugemt tekst i feltet bliver stående ved et faneskift; en lås
   genindlæser siden (laas.js), og så er alt væk, også den ugemte tekst. Kopiér noterne: webvisningen lægger teksten i
   udklipsholderen og melder det til Rust (udklip_kopieret med noter: true), så låsen og afslutningen rydder den, hvis den
   stadig står der (D21, som en demaskeret tekst). Intet skrives til konsollen eller til localStorage.
   Rust-kommandoer: noter_hent, note_tilfoej, note_ret, note_slet, udklip_kopieret. */
(function () {
  'use strict';
  const G = window.Grimnir, K = window.Kit, S = window.Sprog, GM = window.GrimnirMaskering, GS = window.GrimnirSager;
  if (!G || !K || !S || !GM || !GS) return;
  const invoke = G.tauri && G.tauri.core && G.tauri.core.invoke ? (c, a) => G.tauri.core.invoke(c, a) : () => Promise.reject({ art: 'ingen_rust' });
  const d = G.dele.noter;
  const el = (tag, kl, t) => { const e = document.createElement(tag); if (kl) e.className = kl; if (t) e.setAttribute('data-t', t); return e; };

  /* valgt: den valgte notes nummer; ret: nummeret på den note, der rettes i feltet (null: Ny note); kladde: den ugemte nye
     note, mens en anden rettes; skriv: feltet er vist, selv om sagen ingen noter har (Ny note fra den tomme flade). */
  const st = { svar: null, valgt: null, ret: null, kladde: '', skriv: false, soeg: '', fejl: null, kopieret: false, nr: 0, travl: false };

  /* Tid i sprogets format og maskinens tidszone ("13. november 2026 kl. 15.10" / "13 November 2026 at 15:10"). */
  const tid = ms => new Date(ms).toLocaleString(S.lang === 'en' ? 'en-GB' : 'da-DK', { dateStyle: 'long', timeStyle: 'short' });
  const genvej = () => (G.mac ? '⌘↵' : 'Ctrl+Enter');

  /* ── Arbejdsfladen ── */
  const ark = el('div', 'arbejde noter');
  ark.hidden = true;
  const bannere = el('div', 'bannere');
  const liste = el('ul', 'noteliste');
  liste.setAttribute('role', 'listbox');
  liste.setAttribute('data-t-aria', 'ariaNoteliste');
  const ingenISoeg = el('p', 'tabel-tom', 'ingenNoterISoeg');
  ingenISoeg.hidden = true;
  const felt = el('section', 'notefelt');
  const f = el('div', 'felt');
  const label = el('label', 'label', 'nyNoteLabel');
  label.htmlFor = 'note-tekst';
  label.id = 'note-label';
  const tekst = document.createElement('textarea');
  tekst.id = 'note-tekst';
  tekst.rows = 4;
  tekst.setAttribute('data-t-ph', 'notePh');
  tekst.setAttribute('aria-describedby', 'note-hj note-fejl');
  for (const [k, v] of Object.entries({ spellcheck: 'false', autocomplete: 'off', autocorrect: 'off', autocapitalize: 'off' })) tekst.setAttribute(k, v);
  const hj = el('span', 'hj', 'noteHj');
  hj.id = 'note-hj';
  hj.setAttribute('data-v', genvej());
  f.append(label, tekst, hj);
  const fejlEl = el('p', 'note-fejl');
  fejlEl.id = 'note-fejl';
  fejlEl.setAttribute('role', 'alert');
  fejlEl.hidden = true;
  const knapper = el('div', 'note-knapper');
  const annuller = K.knap({ t: 'annuller', ved: () => annullerRet() });
  annuller.id = 'note-annuller';
  annuller.hidden = true;
  const gemKnap = K.knap({ t: 'kGemNote', variant: 'primary', ved: () => gem() });
  gemKnap.id = 'note-gem';
  knapper.append(annuller, gemKnap);
  felt.append(f, fejlEl, knapper);
  ark.append(bannere, liste, ingenISoeg, felt);
  d.flade.appendChild(ark);
  // Den tomme tilstand er kittets (én sætning) med Ny note som handling.
  const tomKnap = K.knap({ t: 'kNyNote', ikon: 'plus', variant: 'primary', ved: () => nyNote() });
  tomKnap.id = 'note-tom-ny';
  d.tom.appendChild(tomKnap);
  S.anvend(ark);
  S.anvend(d.tom);

  const noter = () => (st.svar ? st.svar.noter : []);
  const noteAf = nr => noter().find(n => n.nr === nr) || null;
  function synlige() {
    const q = st.soeg.trim().toLowerCase();
    return q ? noter().filter(n => n.tekst.toLowerCase().includes(q)) : noter();
  }

  /* ── Tegning ── */
  function tegn() { tegnFlade(); tegnBannere(); tegnListe(); tegnFelt(); tegnKommandoer(); tegnChip(); tegnTrae(); }
  function tegnFlade() {
    const har = noter().length > 0;
    const vis = har || st.skriv || st.ret != null || Boolean(tekst.value);
    d.tom.hidden = vis || !st.svar;
    ark.hidden = !vis && Boolean(st.svar);
    d.soeg.disabled = !har;
  }
  function tegnBannere() {
    bannere.textContent = '';
    if (st.fejl) GM.banner(bannere, 'danger', 'bNoteFejl', st.fejl);
    if (!st.svar) return;
    if (st.svar.navn) GM.banner(bannere, 'info', 'noterForklaring', st.svar.navn);
    else GM.banner(bannere, 'info', 'noterForklaringMidl');
    if (st.kopieret) GM.banner(bannere, 'ok', 'bNoterKopieret');
  }
  function tegnListe() {
    liste.textContent = '';
    const vis = synlige();
    ingenISoeg.hidden = vis.length > 0 || !noter().length;
    liste.hidden = !vis.length;
    if (st.valgt != null && !vis.some(n => n.nr === st.valgt)) st.valgt = null;
    const stop = st.valgt != null ? st.valgt : vis.length ? vis[0].nr : null;
    for (const n of vis) {
      const li = el('li', 'note');
      li.id = 'note-' + n.nr;
      li.setAttribute('role', 'option');
      li.setAttribute('data-nr', String(n.nr));
      li.setAttribute('aria-selected', String(n.nr === st.valgt));
      li.classList.toggle('valgt', n.nr === st.valgt);
      li.tabIndex = n.nr === stop ? 0 : -1;
      const t = el('div', 'note-tid');
      t.textContent = tid(n.oprettet);
      if (n.rettet != null) {
        const r = el('span', 'note-rettet', 'noteRettet');
        r.setAttribute('data-v', tid(n.rettet));
        t.append(' · ', r);
      }
      const x = el('div', 'note-tekst');
      x.textContent = n.tekst;
      li.append(t, x);
      liste.appendChild(li);
    }
    S.anvend(liste);
  }
  function tegnFelt() {
    const ret = st.ret != null;
    label.setAttribute('data-t', ret ? 'retNoteLabel' : 'nyNoteLabel');
    gemKnap.setAttribute('data-t', ret ? 'gem' : 'kGemNote');
    annuller.hidden = !ret;
    hj.setAttribute('data-v', genvej());
    S.anvend(felt);
  }
  function tegnKommandoer() {
    const v = st.valgt != null && noteAf(st.valgt);
    GM.kommando('noter', 'ny-note', !G.laast, 'hvorforVent');
    GM.kommando('noter', 'ret-note', Boolean(v), 'hvorforVaelgNote');
    GM.kommando('noter', 'slet-note', Boolean(v), 'hvorforVaelgNote');
    GM.kommando('noter', 'kopier-noter', noter().length > 0, 'hvorforIngenNoter');
  }
  function tegnChip() {
    d.hoejre.textContent = '';
    const n = noter().length;
    const c = K.chip(n ? 'info' : 'none', { t: n ? 'chipNoter' : 'chipIngenNoter' });
    c.querySelector('.ord').setAttribute('data-v', String(n));
    d.hoejre.appendChild(c);
    S.anvend(d.hoejre);
  }
  function tegnTrae() {
    const a = d.nd.querySelector('[data-punkt="alle"] .ant');
    if (a) a.textContent = String(noter().length);
  }

  /* ── Rust ── */
  const fejlTekst = e => GM.sagFejlTekst(e);
  function hent() {
    if (G.laast) return Promise.resolve();
    const nr = ++st.nr;
    return invoke('noter_hent').then(svar => {
      if (nr !== st.nr) return;
      st.svar = svar; st.fejl = null;
      GS.saetNoter(svar.noter.length);
      tegn();
    }).catch(e => {
      if (nr !== st.nr || (e && e.art === 'ingen_rust')) return;
      st.svar = null; st.fejl = fejlTekst(e);
      tegn();
    });
  }
  /* Fanen forlades: noternes tekst fjernes fra DOM'en og fra denne fil (feltet med en ugemt tekst bliver). */
  function glem() {
    st.nr++;
    st.svar = null; st.valgt = null; st.kopieret = false;
    liste.textContent = '';
    bannere.textContent = '';
  }
  function visFejl(e) {
    if (e && e.art === 'note') {
      fejlEl.setAttribute('data-t', 'noteFejl_' + e.hvad);
      fejlEl.setAttribute('data-v', String(e.maks));
      fejlEl.hidden = false;
      tekst.setAttribute('aria-invalid', 'true');
      S.anvend(fejlEl);
      tekst.focus();
    } else if (e && e.art !== 'laast') {
      st.fejl = fejlTekst(e);
      tegnBannere();
    }
  }
  function rydFejl() {
    fejlEl.hidden = true;
    fejlEl.textContent = '';
    fejlEl.removeAttribute('data-t');
    tekst.removeAttribute('aria-invalid');
  }
  tekst.addEventListener('input', () => { if (!fejlEl.hidden) rydFejl(); });

  /* Gem note (Ny note) eller Gem (Ret note). Efter en rettelse står den ugemte nye note i feltet igen. */
  function gem() {
    if (st.travl || G.laast) return Promise.resolve();
    rydFejl();
    const ret = st.ret;
    const kald = ret != null ? invoke('note_ret', { nr: ret, tekst: tekst.value }) : invoke('note_tilfoej', { tekst: tekst.value });
    st.travl = true;
    return kald.then(svar => {
      st.travl = false;
      st.svar = svar; st.fejl = null; st.kopieret = false;
      st.valgt = svar.nr != null ? svar.nr : st.valgt;
      tekst.value = ret != null ? st.kladde : '';
      st.kladde = ''; st.ret = null; st.skriv = false;
      GS.saetNoter(svar.noter.length);
      tegn();
      if (ret != null) fokusNote(ret); else tekst.focus();
    }).catch(e => { st.travl = false; visFejl(e); });
  }
  function nyNote() {
    if (G.laast) return;
    if (st.ret != null) annullerRet(false);
    st.skriv = true;
    tegn();
    tekst.focus();
  }
  function retNote() {
    const n = st.valgt != null && noteAf(st.valgt);
    if (!n) return;
    if (st.ret == null) st.kladde = tekst.value;
    st.ret = n.nr;
    tekst.value = n.tekst;
    rydFejl();
    tegn();
    tekst.focus();
  }
  function annullerRet(fokus = true) {
    if (st.ret == null) return;
    const nr = st.ret;
    tekst.value = st.kladde;
    st.kladde = ''; st.ret = null;
    rydFejl();
    tegn();
    if (fokus) fokusNote(nr);
  }
  function sletNote() {
    const n = st.valgt != null && noteAf(st.valgt);
    if (!n) return;
    const nr = n.nr, plads = synlige().findIndex(x => x.nr === nr);
    let svar = null;
    G.bekraeft({
      t: 'sletNoteH', p: { t: 'sletNoteP' }, nej: { t: 'annuller' }, ja: { t: 'kSletNote' }, farlig: true,
      udfyld: rod => { rod.id = 'dlg-slet-note'; rod.querySelector('.modal-tekst').setAttribute('data-v', tid(n.oprettet)); S.anvend(rod); },
      ved: () => invoke('note_slet', { nr }).then(s => { svar = s; }, e => { throw e && e.art === 'note' ? S.t('noteFejl_' + e.hvad, e.maks) : fejlTekst(e); }),
    }).then(ja => {
      if (!ja || !svar) return;
      st.svar = svar; st.kopieret = false;
      if (st.ret === nr) { tekst.value = st.kladde; st.kladde = ''; st.ret = null; }
      const vis = synlige();
      st.valgt = vis.length ? vis[Math.min(plads, vis.length - 1)].nr : null;
      GS.saetNoter(svar.noter.length);
      tegn();
      if (st.valgt != null) fokusNote(st.valgt); else tekst.focus();
    });
  }
  /* Kopiér noterne: sagens navn øverst, så hver note med tidspunktet. Rust får besked (D21: ryddes ved lås og afslutning). */
  async function kopierNoter() {
    const n = noter();
    if (!n.length) return;
    const navn = st.svar.navn ? S.t('noterKopiSag', st.svar.navn) : S.t('noterKopiMidl');
    const dele = n.map(x => tid(x.oprettet) + (x.rettet != null ? ' · ' + S.t('noteRettet', tid(x.rettet)) : '') + '\n' + x.tekst);
    const ok = await GM.kopier(navn + '\n\n' + dele.join('\n\n') + '\n');
    if (!ok) return;
    invoke('udklip_kopieret', { fil: false, noter: true }).catch(() => { /* låst eller uden Rust: intet at huske */ });
    st.kopieret = true;
    tegnBannere();
  }

  /* ── Valg i listen: klik og piletaster (op/ned, Home/End); hver note er et stop ── */
  function vaelg(nr, fokus) {
    st.valgt = nr;
    for (const li of liste.querySelectorAll('li.note')) {
      const on = Number(li.getAttribute('data-nr')) === nr;
      li.setAttribute('aria-selected', String(on));
      li.classList.toggle('valgt', on);
      li.tabIndex = on ? 0 : -1;
      if (on && fokus) li.focus();
    }
    tegnKommandoer();
  }
  function fokusNote(nr) { const li = document.getElementById('note-' + nr); if (li) { vaelg(nr, false); li.focus(); } }
  liste.addEventListener('click', e => { const li = e.target.closest('li.note'); if (li) vaelg(Number(li.getAttribute('data-nr')), true); });
  liste.addEventListener('keydown', e => {
    const alle = [...liste.querySelectorAll('li.note')], i = alle.indexOf(e.target);
    if (i < 0) return;
    const ny = { ArrowDown: i + 1, ArrowUp: i - 1, Home: 0, End: alle.length - 1 }[e.key];
    if (ny == null) return;
    e.preventDefault();
    vaelg(Number(alle[Math.max(0, Math.min(alle.length - 1, ny))].getAttribute('data-nr')), true);
  });
  // ⌘↵ (Ctrl+Enter på Windows) i feltet gemmer; Esc under en rettelse annullerer den.
  tekst.addEventListener('keydown', e => {
    const mod = G.mac ? e.metaKey && !e.ctrlKey : e.ctrlKey && !e.metaKey;
    if (e.key === 'Enter' && mod && !e.altKey && !e.shiftKey) { e.preventDefault(); e.stopPropagation(); gem(); }
    else if (e.key === 'Escape' && st.ret != null && !document.querySelector('dialog[open]')) { e.preventDefault(); annullerRet(); }
  });

  /* Den skrivebeskyttede liste i sagens indhold for en anden sag (sager.js): tidspunkt og tekst, ingen valg. */
  function laesbare(liste2) {
    const sek = el('section', 'noter-laes');
    const h = el('h4', null, 'pIndholdNoter');
    const ul = el('ul', 'noteliste laes');
    ul.setAttribute('data-t-aria', 'pIndholdNoter');
    for (const n of liste2) {
      const li = el('li', 'note');
      const t = el('div', 'note-tid');
      t.textContent = tid(n.oprettet);
      if (n.rettet != null) { const r = el('span', 'note-rettet', 'noteRettet'); r.setAttribute('data-v', tid(n.rettet)); t.append(' · ', r); }
      const x = el('div', 'note-tekst');
      x.textContent = n.tekst;
      li.append(t, x);
      ul.appendChild(li);
    }
    sek.append(h, ul);
    S.anvend(sek);
    return sek;
  }

  /* ── Kommandoer, søgning og hændelser ── */
  G.haandter('noter', 'ny-note', () => nyNote());
  G.haandter('noter', 'ret-note', () => retNote());
  G.haandter('noter', 'slet-note', () => sletNote());
  G.haandter('noter', 'kopier-noter', () => kopierNoter());
  d.soeg.addEventListener('input', () => { st.soeg = d.soeg.value; tegnListe(); tegnKommandoer(); });
  document.addEventListener('grimnir-visning', e => {
    if (e.detail === 'noter') { tegn(); hent(); } else glem();
  });
  // Sagen er skiftet (åbnet, lukket, gemt som sag): den rettede note hørte til den gamle sag; feltets nye tekst bliver.
  document.addEventListener('grimnir-sag', e => {
    if (e.detail && e.detail.nulstil && st.ret != null) { tekst.value = st.kladde; st.kladde = ''; st.ret = null; }
    if (e.detail && e.detail.nulstil) st.valgt = null;
    if (G.aktiv === 'noter') hent();
  });
  document.addEventListener('grimnir-sprog', () => { if (G.aktiv === 'noter') { tegnListe(); tegnFelt(); } });

  tegn();
  /* V-LAAS.2: intet hentes, før Grimnir er låst op. Står fanen Noter åben ved oplåsningen, hentes noterne ved hændelsen
     'grimnir-sag', som sager.js melder, når den har hentet sagens status lige efter oplåsningen (ovenfor). */
  window.GrimnirNoter = { st, hent, laesbare, tegn, gem, nyNote, retNote, sletNote, kopierNoter };
})();
