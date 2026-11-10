/* Grimnir — Maskér og Demaskér (V-SKAL.2). Bygger på skallen (window.Grimnir fra app.js) og kittet (window.Kit).

   Teksten er den indsatte tekst, bytepræcist (M1): den tages fra indsæt-hændelsens clipboardData.getData('text/plain') og
   gemmes, som den er, i hukommelsen. Den vises i et felt, der ikke kan redigeres (<pre>), aldrig i et <textarea>, fordi
   et textarea gør CRLF til LF. Resultatet kopieres fra strengen i hukommelsen, ikke fra et felt.

   Intet her skriver til konsollen eller til localStorage. Teksten, fundene og resultatet lever kun i denne side og i
   Rust-processens hukommelse; lukkes programmet, er de væk. Sagen (nøgletabellen) gemmer Rust krypteret, når den er
   navngiven (V-SAG.1); titellinjen og sagerne styres af sager.js.

   Rust-kommandoer: analyser, gem_og_masker, demasker, menu_sprog. */
(function () {
  'use strict';
  const G = window.Grimnir, K = window.Kit, S = window.Sprog;
  if (!G || !K || !S) return;
  const invoke = G.tauri && G.tauri.core && G.tauri.core.invoke ? (c, a) => G.tauri.core.invoke(c, a) : () => Promise.reject({ art: 'ingen_rust' });

  const MAKS_BYTES = 5 * 1024 * 1024; // som MAKS_BYTES i src-tauri/src/maskering.rs
  const MAKS_DEMASKER = 8 * 1024 * 1024; // som MAKS_DEMASKER (V-SAG.1)
  const MAKS_VIST = 200000; // tegn, der vises i tekstfeltet
  const SIDE = 500; // rækker, der tegnes ad gangen

  /* ── Små hjælpere ── */
  function utf8Laengde(s) {
    let n = 0;
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      if (c < 0x80) n += 1;
      else if (c < 0x800) n += 2;
      else if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length && (s.charCodeAt(i + 1) & 0xfc00) === 0xdc00) { n += 4; i++; }
      else n += 3;
    }
    return n;
  }
  /* Et element med tekst fra en sprognøgle; v og w sættes i {v} og {w}. */
  function el(tag, kl, t, v, w) {
    const e = document.createElement(tag);
    if (kl) e.className = kl;
    if (t) {
      e.setAttribute('data-t', t);
      if (v != null) e.setAttribute('data-v', String(v));
      if (w != null) e.setAttribute('data-w', String(w));
    }
    return e;
  }
  const mb = b => (b / 1048576).toFixed(1);
  const fokusIFelt = e => e && e.target && e.target.closest && e.target.closest('input[type="text"], input[type="search"], textarea, [contenteditable="true"]');

  /* En kommando i båndet: aktiv (med genvej i title) eller nedtonet med en forklaring. */
  function kommando(visning, id, on, hvorfor, genvej) {
    const b = G.dele[visning].bar.knap(id);
    if (!b) return;
    b.removeAttribute('title');
    b.removeAttribute('data-v');
    if (on) {
      b.removeAttribute('aria-disabled');
      if (genvej) {
        b.setAttribute('data-t-title', genvej[0]);
        b.setAttribute('data-v', genvej[1]);
        b.setAttribute('aria-keyshortcuts', genvej[2]);
      } else {
        b.removeAttribute('data-t-title');
        b.removeAttribute('aria-keyshortcuts');
      }
    } else {
      b.setAttribute('aria-disabled', 'true');
      b.setAttribute('data-t-title', hvorfor || 'hvorforIndsaetFoerst');
      b.removeAttribute('aria-keyshortcuts');
    }
    S.anvend(b);
  }
  const GV = {
    analyser: () => ['genvejTitel', G.mod + '↵', (G.mac ? 'Meta' : 'Control') + '+Enter'],
    kopier: () => ['genvejTitel', (G.mac ? '⇧⌘' : 'Ctrl+Shift+') + 'C', (G.mac ? 'Meta' : 'Control') + '+Shift+C'],
  };

  /* En sagsfejl fra Rust ({art: 'sag', fejl: {art, …}}) som tekst på det aktuelle sprog. */
  function sagFejlTekst(e) {
    const f = e && e.art === 'sag' ? e.fejl : e && e.art === 'ingen_arkiv' ? { art: 'ingen_arkiv' } : { art: 'andet' };
    return S.t('sagfejl_' + f.art, f.version != null ? f.version : f.hvad) || S.t('sagfejl_andet');
  }

  /* Banner med sprognøgle, {v} og højst én handling. */
  function banner(rod, variant, t, v, handling) {
    const b = K.banner({ variant, t, handling: handling ? { t: handling.t, ved: handling.ved } : null });
    if (v != null) b.querySelector('.ord').setAttribute('data-v', String(v));
    rod.appendChild(b);
    S.anvend(b);
    return b;
  }

  /* Kopiér bytepræcist fra strengen. navigator.clipboard.writeText virker i WKWebView ved klik og tast (målt i V-SKAL.2);
     ellers execCommand('copy') med en copy-hændelse, der lægger strengen i clipboardData (også målt bytepræcis). */
  async function kopier(tekst) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try { await navigator.clipboard.writeText(tekst); return true; } catch (e) { /* prøv copy-hændelsen */ }
    }
    let ok = false;
    const h = e => { e.clipboardData.setData('text/plain', tekst); e.preventDefault(); ok = true; };
    document.addEventListener('copy', h, true);
    try { document.execCommand('copy'); } catch (e) { /* ok forbliver false */ }
    document.removeEventListener('copy', h, true);
    return ok;
  }

  /* Status → StatusChip (symbolet følger varianten). */
  const STATUS = { sikker: ['ok', 'stSikker'], ordbog: ['info', 'stOrdbog'], sandsynlig: ['warn', 'stSandsynlig'], tjek: ['danger', 'stTjek'], version: ['none', 'stVersion'] };
  const chip = (variant, t, v) => { const c = K.chip(variant, { t }); if (v != null) c.querySelector('.ord').setAttribute('data-v', String(v)); return c; };

  /* Fælles opbygning af en arbejdsflade: tom tilstand (eksisterer) + bannere + delt flade. */
  function byggeFlade(visning, opsaet) {
    const d = G.dele[visning];
    d.tom.tabIndex = 0;
    d.tom.setAttribute('data-t-aria', visning === 'masker' ? 'ariaIndsaetTekst' : 'ariaIndsaetSvar');
    d.tom.setAttribute('data-v', G.mod + 'V');
    const ark = el('div', 'arbejde');
    ark.hidden = true;
    const bannere = el('div', 'bannere');
    const besked = el('p', 'besked');
    besked.setAttribute('role', 'status');
    ark.append(bannere, besked);
    opsaet(ark);
    d.flade.appendChild(ark);
    // Bannere uden tekst (fx afvist indsæt) skal også kunne ses, før der er en tekst: de står over den tomme tilstand.
    const tomBannere = el('div', 'bannere tom-bannere');
    d.flade.insertBefore(tomBannere, d.tom);
    S.anvend(d.flade);
    return { d, ark, bannere, besked, tomBannere };
  }

  function panel(t, kl) {
    const p = el('section', 'panel' + (kl ? ' ' + kl : ''));
    const hoved = el('div', 'panel-hoved');
    const h = el('h3', null, t);
    const info = el('span', 'muted');
    hoved.append(h, info);
    p.append(hoved);
    p.setAttribute('data-t-aria', t);
    return { p, h, info };
  }

  function tekstVisning(aria) {
    const pre = el('pre', 'tekst mono');
    pre.tabIndex = 0;
    pre.setAttribute('data-t-aria', aria);
    const afk = el('p', 'afkortet', 'tekstAfkortet', '200.000');
    afk.hidden = true;
    return { pre, afk, vis(s) { pre.textContent = s.length > MAKS_VIST ? s.slice(0, MAKS_VIST) : s; afk.hidden = s.length <= MAKS_VIST; } };
  }

  /* Fokus bevares over en ny tegning af tabellen (rækkens id + hvilket felt). */
  function fokusNoegle() {
    const a = document.activeElement;
    if (!a || !a.closest) return null;
    const tr = a.closest('tr[data-id]');
    if (!tr) return null;
    return { id: tr.getAttribute('data-id'), felt: a.getAttribute('data-felt') || 'raekke' };
  }
  function genskabFokus(rod, n) {
    if (!n) return;
    const tr = rod.querySelector(`tr[data-id="${n.id}"]`);
    if (!tr) return;
    const m = n.felt === 'raekke' ? tr : tr.querySelector(`[data-felt="${n.felt}"]`);
    if (m && !m.disabled) m.focus();
  }

  /* ═════════════════════════════ Sagen ═════════════════════════════ */
  /* Antal poster i den aktuelle sag og antal gemte sager. Titellinjen og sagerne står i sager.js; den får besked med
     hændelsen 'grimnir-poster' og sætter selv tallene med saetSag og saetGemteSager. */
  let poster = 0, gemteSager = 0;
  function saetSag(n) {
    poster = n;
    D.opdater();
    document.dispatchEvent(new CustomEvent('grimnir-poster', { detail: n }));
  }
  function saetGemteSager(n) { gemteSager = n; D.opdater(); }

  /* ═════════════════════════════ Maskér ═════════════════════════════ */
  const M = (function () {
    const st = { tekst: null, bytes: 0, analyse: null, fravalgt: new Set(), rettelser: new Map(), fejl: new Map(), resultat: null, foerEfter: false, visRester: false, filter: 'alle', soeg: '', vist: new Set(), side: SIDE, nr: 0, travl: false, venter: null };
    let tv, tabelvaert, flere, flereTekst, tekstPanel, tabelPanel, delt;
    const f = byggeFlade('masker', ark => {
      delt = el('div', 'delt');
      tekstPanel = panel('pTekst');
      tv = tekstVisning('ariaTekst');
      tekstPanel.p.append(tv.pre, tv.afk);
      tabelPanel = panel('pFund');
      tabelvaert = el('div', 'tabelvaert');
      flere = el('div', 'flere');
      flereTekst = el('span', null);
      const flereKnap = K.knap({ t: 'visFlere', ved: () => { st.side += SIDE; tegnTabel(); } });
      flereKnap.classList.add('mini');
      flere.append(flereTekst, flereKnap);
      flere.hidden = true;
      tabelPanel.p.append(tabelvaert, flere);
      delt.append(tekstPanel.p, tabelPanel.p);
      ark.appendChild(delt);
    });
    const d = f.d;

    function nulstilValg() {
      st.analyse = null; st.fravalgt = new Set(); st.rettelser = new Map(); st.fejl = new Map(); st.resultat = null;
      st.foerEfter = false; st.visRester = false; st.vist = new Set(); st.side = SIDE; st.nr++; st.travl = false;
      if (st.venter) { clearTimeout(st.venter); st.venter = null; }
    }

    function modtag(s) {
      f.tomBannere.textContent = '';
      f.bannere.textContent = '';
      if (!s) { banner(st.tekst ? f.bannere : f.tomBannere, 'info', 'bIngenTekst'); return; }
      const bytes = utf8Laengde(s);
      if (bytes > MAKS_BYTES) { banner(st.tekst ? f.bannere : f.tomBannere, 'danger', 'bForStor', mb(bytes)); return; }
      nulstilValg();
      st.tekst = s;
      st.bytes = bytes;
      tegn();
      tv.pre.focus();
    }

    function rettelser() { return [...st.rettelser].map(([id, kode]) => ({ id, kode })); }

    function analyser() {
      if (!st.tekst) return Promise.resolve();
      if (st.venter) { clearTimeout(st.venter); st.venter = null; }
      const nr = ++st.nr;
      const foerste = !st.analyse;
      st.travl = true;
      tegnKommandoer();
      tegnChip();
      return invoke('analyser', { tekst: st.tekst, fravalgt: foerste ? null : [...st.fravalgt], rettelser: foerste ? null : rettelser() })
        .then(a => {
          if (nr !== st.nr) return;
          st.travl = false;
          if (foerste) st.fravalgt = new Set(a.raekker.filter(r => !r.valgt).map(r => r.id));
          for (const r of a.raekker) if (r.laast) st.fravalgt.delete(r.id);
          st.analyse = a;
          st.fejl = new Map(a.fejl.map(x => [x.id, x]));
          tegn();
        })
        .catch(e => { if (nr !== st.nr) return; st.travl = false; fejl(e); tegn(); });
    }
    function senere() {
      if (st.venter) clearTimeout(st.venter);
      st.venter = setTimeout(() => { st.venter = null; analyser(); }, 350);
    }
    function aendret() {
      if (st.resultat) { st.resultat = null; st.foerEfter = false; st.visRester = false; st.aendretEfter = true; }
      senere();
      tegnBannere(); tegnKommandoer(); tegnTekst(); tegnChip(); tegnFod();
    }

    async function gem() {
      if (!st.analyse || st.travl) return;
      if (st.venter) await analyser();
      const nr = ++st.nr;
      st.travl = true;
      tegnKommandoer();
      try {
        const m = await invoke('gem_og_masker', { tekst: st.tekst, fravalgt: [...st.fravalgt], rettelser: rettelser() });
        if (nr !== st.nr) return;
        st.resultat = m; st.foerEfter = true; st.visRester = false; st.aendretEfter = false; st.travl = false;
        st.fejl = new Map();
        saetSag(m.poster);
      } catch (e) {
        if (nr !== st.nr) return;
        st.travl = false;
        if (e && e.art === 'raekker') st.fejl = new Map(e.fejl.map(x => [x.id, x]));
        fejl(e);
      }
      tegn();
    }

    let fejlBanner = null;
    function fejl(e) {
      if (e && e.art === 'sag' && e.fejl && e.fejl.art === 'konflikt') {
        // To vinduer mod samme sag (D8): intet er overskrevet; brugeren åbner sagen igen fra disken.
        fejlBanner = ['bKonflikt', null, { t: 'hAabnIgen', ved: () => { if (window.GrimnirSager) window.GrimnirSager.aabnIgen(); } }];
      } else if (e && (e.art === 'sag' || e.art === 'ingen_arkiv')) {
        fejlBanner = ['bSagIkkeGemt', sagFejlTekst(e)];
      } else {
        fejlBanner = e && e.art === 'raekker' ? ['bRettelserAfvist', e.fejl.length] : e && e.art === 'for_stor' ? ['bForStor', mb(e.bytes)] : ['bFejl', null];
      }
    }

    /* ── tegning ── */
    function tegn() { tegnFlade(); tegnBannere(); tegnTekst(); tegnTabel(); tegnTrae(); tegnKommandoer(); tegnChip(); tegnFod(); }
    function tegnFlade() {
      d.tom.hidden = Boolean(st.tekst);
      f.tomBannere.hidden = Boolean(st.tekst);
      f.ark.hidden = !st.tekst;
      d.soeg.disabled = !st.analyse;
    }
    function tegnBannere() {
      f.bannere.textContent = '';
      if (fejlBanner) { banner(f.bannere, 'danger', fejlBanner[0], fejlBanner[1], fejlBanner[2]); fejlBanner = null; }
      if (st.resultat) {
        const n = st.resultat.rester.reduce((a, r) => a + r.antal, 0);
        if (n === 0) banner(f.bannere, 'ok', 'bLaekIngen');
        else banner(f.bannere, 'warn', 'bLaekRester', n, { t: st.visRester ? 'hVisFund' : 'hVisRester', ved: () => { st.visRester = !st.visRester; tegnBannere(); tegnTabel(); } });
        if (st.resultat.advarsler.length) banner(f.bannere, 'warn', 'bOverloeb', st.resultat.advarsler.length);
      } else if (st.aendretEfter) {
        banner(f.bannere, 'info', 'bValgAendret');
      }
      if (st.analyse && st.analyse.advarsler.length && !st.resultat) banner(f.bannere, 'warn', 'bOverloeb', st.analyse.advarsler.length);
    }
    function tegnTekst() {
      const efter = st.foerEfter && st.resultat;
      tv.vis(efter ? st.resultat.maskeret : st.tekst || '');
      tekstPanel.h.setAttribute('data-t', efter ? 'pMaskeret' : 'pTekst');
      tekstPanel.p.setAttribute('data-t-aria', efter ? 'pMaskeret' : 'pTekst');
      tv.pre.setAttribute('data-t-aria', efter ? 'ariaMaskeret' : 'ariaTekst');
      tekstPanel.info.setAttribute('data-t', 'tekstInfo');
      tekstPanel.info.setAttribute('data-v', st.analyse ? String(st.analyse.linjer) : '…');
      tekstPanel.info.setAttribute('data-w', mb(st.bytes));
      S.anvend(tekstPanel.p);
      G.dele.masker.bar.knap('foer-efter').setAttribute('aria-pressed', String(Boolean(efter)));
    }

    function valgt(r) { return r.laast || !st.fravalgt.has(r.id); }
    function filtrerede() {
      if (!st.analyse) return [];
      let r = st.analyse.raekker;
      if (st.filter === 'tjek') r = r.filter(x => x.status === 'tjek' || st.fejl.has(x.id));
      else if (st.filter === 'hemmelig') r = r.filter(x => x.hemmelig);
      else if (st.filter === 'seneste') r = r.filter(x => x.kendt);
      const q = st.soeg.trim().toLowerCase();
      if (q) r = r.filter(x => x.koder.some(k => k.toLowerCase().includes(q)) || ((!x.hemmelig || st.vist.has(x.id)) && x.vaerdier.some(v => v.toLowerCase().includes(q))));
      return r;
    }

    function vaerdiCelle(r) {
      const c = el('span', 'vaerdi');
      const skjult = r.hemmelig && !st.vist.has(r.id);
      if (skjult) {
        const p = el('span', 'prikker', 'skjultVaerdi');
        c.appendChild(p);
      } else {
        c.appendChild(el('span', 'mono')).textContent = r.vaerdier.join(', ');
      }
      if (r.hemmelig) {
        const b = el('button', 'mini', skjult ? 'vis' : 'skjul');
        b.type = 'button';
        b.setAttribute('data-felt', 'vis');
        b.setAttribute('data-t-aria', skjult ? 'ariaVis' : 'ariaSkjul');
        b.setAttribute('data-v', String(r.linje));
        b.addEventListener('click', () => {
          const n = fokusNoegle();
          if (st.vist.has(r.id)) st.vist.delete(r.id); else st.vist.add(r.id);
          tegnTabel();
          genskabFokus(tabelvaert, n);
        });
        c.appendChild(b);
      }
      return c;
    }
    function erstatningCelle(r, on) {
      const c = el('span', 'erstatning');
      const inp = document.createElement('input');
      inp.type = 'text';
      inp.className = 'mono';
      inp.spellcheck = false;
      inp.setAttribute('autocomplete', 'off');
      inp.setAttribute('autocorrect', 'off');
      inp.setAttribute('autocapitalize', 'off');
      inp.setAttribute('data-felt', 'kode');
      inp.setAttribute('data-t-aria', 'ariaErstatning');
      inp.setAttribute('data-v', String(r.linje));
      // Flere stavemåder: feltet viser alle koder; en ny kode omdøber hele enheden, og Rust spejler store/små (V-SAG.1).
      const vist = r.koder.join(', ');
      inp.value = st.rettelser.has(r.id) ? st.rettelser.get(r.id) : vist;
      if (!on) inp.disabled = true;
      const fe = st.fejl.get(r.id);
      c.appendChild(inp);
      if (fe) {
        const t = el('span', 'raekkefejl', 'fejl_' + fe.fejl, fe.kode);
        t.id = 'fejl-' + r.id;
        inp.setAttribute('aria-invalid', 'true');
        inp.setAttribute('aria-describedby', t.id);
        c.appendChild(t);
      }
      inp.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey) { e.preventDefault(); inp.blur(); } });
      inp.addEventListener('change', () => {
        const v = inp.value.trim();
        if (v === '' || (!st.rettelser.has(r.id) && v === vist)) {
          if (!st.rettelser.has(r.id)) { inp.value = vist; return; }
          st.rettelser.delete(r.id);
        } else if (st.rettelser.get(r.id) === v) {
          return;
        } else {
          st.rettelser.set(r.id, v);
        }
        st.fejl.delete(r.id);
        aendret();
      });
      return c;
    }

    function tegnTabel() {
      const n = fokusNoegle();
      tabelvaert.textContent = '';
      if (!st.analyse) {
        tabelvaert.appendChild(el('p', 'tabel-tom', st.travl ? 'analyserer' : 'tabelFoerAnalyse', G.mod + '↵'));
        flere.hidden = true;
        S.anvend(tabelvaert);
        tabelPanel.h.setAttribute('data-t', 'pFund');
        tabelPanel.info.removeAttribute('data-t');
        tabelPanel.info.textContent = '';
        S.anvend(tabelPanel.p);
        return;
      }
      if (st.visRester && st.resultat) return tegnRester();
      const alle = filtrerede();
      const vis = alle.slice(0, st.side);
      const t = K.tabel({
        ariaT: 'pFund',
        kolonner: [{ t: 'kolMasker' }, { t: 'kolType' }, { t: 'kolVaerdi' }, { t: 'kolErstatning' }, { t: 'kolAntal', tal: true }, { t: 'kolStatus' }],
        raekker: vis.map(r => {
          const on = valgt(r);
          const cb = document.createElement('input');
          cb.type = 'checkbox';
          cb.checked = on;
          cb.disabled = r.laast;
          cb.setAttribute('data-felt', 'valg');
          cb.setAttribute('data-t-aria', r.hemmelig ? 'ariaMaskerHemmelig' : 'ariaMasker');
          cb.setAttribute('data-v', r.hemmelig ? String(r.linje) : r.vaerdier[0]);
          if (r.laast) cb.setAttribute('data-t-title', 'hvorforLaast');
          cb.addEventListener('change', () => {
            if (cb.checked) st.fravalgt.delete(r.id); else st.fravalgt.add(r.id);
            const tr = cb.closest('tr');
            tr.classList.toggle('fra', !cb.checked);
            const k = tr.querySelector('[data-felt="kode"]');
            if (k) k.disabled = !cb.checked;
            aendret();
          });
          const st0 = STATUS[r.status] || STATUS.tjek;
          return { celler: [cb, el('span', null, 'art_' + r.art), vaerdiCelle(r), erstatningCelle(r, on), String(r.antal), chip(st0[0], st0[1])], data: r.id, fra: !on };
        }),
      });
      t.classList.add('fundtabel');
      const tr = [...t.querySelectorAll('tbody tr')];
      vis.forEach((r, i) => { tr[i].setAttribute('data-id', String(r.id)); if (!valgt(r)) tr[i].classList.add('fra'); });
      tabelvaert.appendChild(t);
      if (!vis.length) tabelvaert.appendChild(el('p', 'tabel-tom', st.analyse.raekker.length ? 'ingenIFilter' : 'ingenFund'));
      flere.hidden = alle.length <= vis.length;
      flereTekst.setAttribute('data-t', 'visesAf');
      flereTekst.setAttribute('data-v', String(vis.length));
      flereTekst.setAttribute('data-w', String(alle.length));
      tabelPanel.h.setAttribute('data-t', 'pFund');
      tabelPanel.info.setAttribute('data-t', 'fundInfo');
      tabelPanel.info.setAttribute('data-v', String(st.analyse.raekker.length));
      tabelPanel.info.setAttribute('data-w', String(st.analyse.raekker.filter(valgt).length));
      S.anvend(tabelPanel.p);
      genskabFokus(tabelvaert, n);
    }
    function tegnRester() {
      const t = K.tabel({
        ariaT: 'pRester',
        kolonner: [{ t: 'kolHvad' }, { t: 'kolType' }, { t: 'kolTekst' }, { t: 'kolAntal', tal: true }, { t: 'kolLinje', tal: true }],
        raekker: st.resultat.rester.map(r => {
          const tekst = el('span', 'mono');
          tekst.textContent = r.tekst;
          return { celler: [chip('warn', 'rest_' + r.art), el('span', null, 'art_' + r.type_), tekst, String(r.antal), String(r.linje)], data: r.linje };
        }),
      });
      t.classList.add('resttabel');
      tabelvaert.appendChild(t);
      flere.hidden = true;
      tabelPanel.h.setAttribute('data-t', 'pRester');
      tabelPanel.info.setAttribute('data-t', 'restInfo');
      tabelPanel.info.setAttribute('data-v', String(st.resultat.rester.length));
      S.anvend(tabelPanel.p);
    }
    function tegnTrae() {
      const r = st.analyse ? st.analyse.raekker : [];
      const ant = { alle: r.length, tjek: r.filter(x => x.status === 'tjek' || st.fejl.has(x.id)).length, hemmelig: r.filter(x => x.hemmelig).length, seneste: r.filter(x => x.kendt).length };
      for (const [id, n] of Object.entries(ant)) {
        const a = d.nd.querySelector(`[data-punkt="${id}"] .ant`);
        if (a) a.textContent = String(n);
      }
    }
    function tegnKommandoer() {
      const v = 'masker';
      kommando(v, 'analyser', Boolean(st.tekst) && !st.travl, st.tekst ? 'hvorforVent' : 'hvorforIndsaetFoerst', st.analyse ? null : GV.analyser());
      const gemHvorfor = !st.tekst ? 'hvorforIndsaetFoerst' : st.travl ? 'hvorforVent' : 'hvorforAnalyserFoerst';
      kommando(v, 'gem-masker', Boolean(st.analyse) && !st.travl, gemHvorfor, st.analyse ? GV.analyser() : null);
      kommando(v, 'foer-efter', Boolean(st.resultat), 'hvorforMaskerFoerst');
      kommando(v, 'kopier', Boolean(st.resultat), 'hvorforMaskerFoerst', GV.kopier());
    }
    function tegnChip() {
      d.hoejre.textContent = '';
      let c;
      if (!st.tekst) c = chip('none', 'chipIntetIndsat');
      else if (st.travl) c = chip('info', 'chipArbejder');
      else if (st.resultat) { const n = st.resultat.rester.length; c = n ? chip('warn', 'chipRester', n) : chip('ok', 'chipMaskeret'); }
      else if (!st.analyse) c = chip('info', 'chipIndsat');
      else { const n = st.analyse.raekker.filter(x => x.status === 'tjek').length; c = n ? chip('warn', 'chipVenter', n) : chip('ok', 'chipFund', st.analyse.raekker.length); }
      d.hoejre.appendChild(c);
      S.anvend(d.hoejre);
    }
    function tegnFod() {
      if (G.aktiv !== 'masker') return;
      const fod = document.getElementById('fod-venstre');
      if (st.analyse) { fod.setAttribute('data-t', 'fodMaskerTal'); fod.setAttribute('data-v', String(st.analyse.raekker.length)); fod.setAttribute('data-w', String(st.analyse.raekker.filter(valgt).length)); }
      else { fod.setAttribute('data-t', 'fodMasker'); fod.removeAttribute('data-v'); fod.removeAttribute('data-w'); }
      S.anvend(fod);
    }

    /* ── kommandoer og genveje ── */
    G.haandter('masker', 'analyser', () => analyser());
    G.haandter('masker', 'gem-masker', () => gem());
    G.haandter('masker', 'foer-efter', () => { st.foerEfter = !st.foerEfter; tegnTekst(); });
    G.haandter('masker', 'kopier', () => kopierResultat());
    G.haandter('masker', 'indsaet', () => indsaetVia(st.tekst ? tv.pre : d.tom, f));
    d.soeg.addEventListener('input', () => { st.soeg = d.soeg.value; st.side = SIDE; tegnTabel(); });
    async function kopierResultat() {
      if (!st.resultat) return;
      const ok = await kopier(st.resultat.maskeret);
      besked(f, ok ? 'bKopieret' : null);
      if (!ok) banner(f.bannere, 'danger', 'bKopiFejl');
    }

    return {
      st, modtag, analyser, gem, kopierResultat, tegn, tegnFod, tegnTabel,
      genvejEnter() { return st.analyse ? gem() : analyser(); },
      filter(id) { st.filter = id === 'denne' ? 'alle' : id; st.visRester = false; st.side = SIDE; tegnTabel(); tegnBannere(); },
      nulstilt() { if (st.tekst) { nulstilValg(); tegn(); } },
    };
  })();

  /* ═════════════════════════════ Demaskér ═════════════════════════════ */
  const D = (function () {
    const st = { tekst: null, bytes: 0, resultat: null, filter: 'alle', soeg: '', nr: 0, travl: false };
    let svar, ud, svarPanel, udPanel, tabelvaert, tabelPanel;
    const f = byggeFlade('demasker', ark => {
      const delt = el('div', 'delt lige');
      svarPanel = panel('pSvar');
      svar = tekstVisning('ariaSvar');
      svarPanel.p.append(svar.pre, svar.afk);
      udPanel = panel('pRigtige');
      ud = tekstVisning('ariaRigtige');
      udPanel.p.append(ud.pre, ud.afk);
      delt.append(svarPanel.p, udPanel.p);
      tabelPanel = panel('pAdvarsler', 'advarselpanel');
      tabelvaert = el('div', 'tabelvaert');
      tabelPanel.p.append(tabelvaert);
      ark.append(delt, tabelPanel.p);
    });
    const d = f.d;
    // Den tomme tilstand peger på Sager, når den aktuelle sag er tom, og der findes gemte sager (V-SAG.1).
    const tilSager = K.knap({ t: 'kGaaTilSager', ikon: 'mappe', ved: () => G.vis('sager') });
    tilSager.hidden = true;
    d.tom.appendChild(tilSager);
    S.anvend(tilSager);

    function modtag(s) {
      f.tomBannere.textContent = '';
      f.bannere.textContent = '';
      if (!s) { banner(st.tekst ? f.bannere : f.tomBannere, 'info', 'bIngenTekst'); return; }
      const bytes = utf8Laengde(s);
      if (bytes > MAKS_DEMASKER) { banner(st.tekst ? f.bannere : f.tomBannere, 'danger', 'bForStorDemasker', mb(bytes)); return; }
      st.tekst = s; st.bytes = bytes; st.resultat = null; st.nr++; st.travl = false;
      tegn();
      svar.pre.focus();
    }
    let fejlBanner = null;
    function demasker() {
      if (!st.tekst || st.travl || poster === 0) return Promise.resolve();
      const nr = ++st.nr;
      st.travl = true;
      tegnKommandoer();
      return invoke('demasker', { tekst: st.tekst }).then(r => {
        if (nr !== st.nr) return;
        st.travl = false; st.resultat = r; tegn();
      }).catch(e => {
        if (nr !== st.nr) return;
        st.travl = false; fejlBanner = e && e.art === 'for_stor' ? ['bForStorDemasker', mb(e.bytes)] : ['bFejl', null]; tegn();
      });
    }

    const ADV = {
      ukendt_adresse: 'danger', ukendt_kode: 'danger', ligner_anden_sag: 'danger',
      anden_stavemaade: 'warn', fqdn_forkortet: 'warn', domaene_alene: 'warn', escaped: 'warn', url_kodet: 'warn',
      ikke_brugt: 'none', overloeb_egne_net: 'warn', overloeb_fremmede: 'warn', overloeb_mac: 'warn', overloeb_ipv6: 'warn',
    };
    const advarsler = () => (st.resultat ? st.resultat.advarsler.filter(a => a.art !== 'ikke_brugt') : []);
    const ikkeBrugt = () => (st.resultat ? st.resultat.advarsler.filter(a => a.art === 'ikke_brugt') : []);

    function tegn() { tegnFlade(); tegnBannere(); tegnTekst(); tegnTabel(); tegnTrae(); tegnKommandoer(); tegnChip(); tegnFod(); }
    function tegnFlade() {
      d.tom.hidden = Boolean(st.tekst);
      f.tomBannere.hidden = Boolean(st.tekst);
      f.ark.hidden = !st.tekst;
      d.soeg.disabled = !st.resultat;
      d.tomP.setAttribute('data-t', poster > 0 ? 'tomDemaskerP' : gemteSager > 0 ? 'tomDemaskerAabnSagP' : 'tomDemaskerTomSagP');
      S.anvend(d.tomP);
      tilSager.hidden = !(poster === 0 && gemteSager > 0);
    }
    function tegnBannere() {
      f.bannere.textContent = '';
      if (fejlBanner) { banner(f.bannere, 'danger', fejlBanner[0], fejlBanner[1]); fejlBanner = null; }
      if (st.tekst && poster === 0 && !st.resultat) banner(f.bannere, 'info', gemteSager > 0 ? 'bSagTomAabn' : 'bSagTom', null, gemteSager > 0 ? { t: 'kGaaTilSager', ved: () => G.vis('sager') } : null);
      if (!st.resultat) return;
      const a = advarsler(), n = a.reduce((x, y) => x + y.antal, 0);
      if (n) banner(f.bannere, 'warn', 'bAdvarsler', n, { t: 'hVisAdvarsler', ved: () => vaelg('advarsler') });
      else banner(f.bannere, 'ok', 'bAltTilbage', st.resultat.koder.length);
      const ib = ikkeBrugt().length;
      if (ib) banner(f.bannere, 'info', 'bIkkeBrugt', ib, { t: 'hVisDem', ved: () => vaelg('ikke-brugt') });
    }
    function vaelg(id) { G.dele.demasker.trae.vaelg(id); }
    function tegnTekst() {
      svar.vis(st.tekst || '');
      ud.vis(st.resultat ? st.resultat.tekst : '');
      udPanel.info.setAttribute('data-t', st.resultat ? 'blivPaaMaskinen' : 'tryk');
      udPanel.info.setAttribute('data-v', G.mod + '↵');
      svarPanel.info.setAttribute('data-t', 'tekstInfo');
      svarPanel.info.setAttribute('data-v', String(st.tekst ? st.tekst.split('\n').length : 0));
      svarPanel.info.setAttribute('data-w', mb(st.bytes));
      S.anvend(svarPanel.p);
      S.anvend(udPanel.p);
    }
    function raekker() {
      if (!st.resultat) return [];
      let r = [];
      if (st.filter === 'alle') r = st.resultat.koder.map(k => ({ art: 'sat_tilbage', kode: k, antal: null, linje: 0 })).concat(st.resultat.advarsler);
      else if (st.filter === 'advarsler') r = advarsler();
      else if (st.filter === 'ikke-brugt') r = ikkeBrugt();
      const q = st.soeg.trim().toLowerCase();
      if (q) r = r.filter(x => x.kode.toLowerCase().includes(q));
      return r;
    }
    function tegnTabel() {
      tabelvaert.textContent = '';
      tabelPanel.p.hidden = !st.resultat;
      if (!st.resultat) return;
      const r = raekker();
      const vis = r.slice(0, SIDE * 4);
      const t = K.tabel({
        ariaT: 'pAdvarsler',
        kolonner: [{ t: 'kolHvad' }, { t: 'kolKode' }, { t: 'kolAntal', tal: true }, { t: 'kolLinje', tal: true }],
        raekker: vis.map(a => {
          const kode = el('span', 'mono');
          kode.textContent = a.kode;
          const c = a.art === 'sat_tilbage' ? chip('ok', 'adv_sat_tilbage') : chip(ADV[a.art] || 'warn', 'adv_' + a.art);
          return { celler: [c, kode, a.antal == null ? '' : String(a.antal), a.linje ? String(a.linje) : ''], data: a.kode };
        }),
      });
      tabelvaert.appendChild(t);
      if (!vis.length) tabelvaert.appendChild(el('p', 'tabel-tom', 'ingenIFilter'));
      tabelPanel.h.setAttribute('data-t', st.filter === 'alle' ? 'pAlleKoder' : st.filter === 'advarsler' ? 'pAdvarsler' : 'pIkkeBrugt');
      tabelPanel.info.setAttribute('data-t', 'raekkerInfo');
      tabelPanel.info.setAttribute('data-v', String(r.length));
      S.anvend(tabelPanel.p);
    }
    function tegnTrae() {
      const ant = { alle: st.resultat ? st.resultat.koder.length + st.resultat.advarsler.length : 0, advarsler: advarsler().length, 'ikke-brugt': ikkeBrugt().length };
      for (const [id, n] of Object.entries(ant)) {
        const a = d.nd.querySelector(`[data-punkt="${id}"] .ant`);
        if (a) a.textContent = String(n);
      }
    }
    function tegnKommandoer() {
      kommando('demasker', 'demasker', Boolean(st.tekst) && poster > 0 && !st.travl, poster === 0 ? (gemteSager > 0 ? 'hvorforAabnSag' : 'hvorforMaskerFoerstSag') : st.tekst ? 'hvorforVent' : 'hvorforIndsaetSvar', GV.analyser());
      kommando('demasker', 'kopier-resultat', Boolean(st.resultat), 'hvorforDemaskerFoerst', GV.kopier());
    }
    function tegnChip() {
      d.hoejre.textContent = '';
      if (!st.tekst) d.hoejre.appendChild(chip('none', 'chipIntetSvar'));
      else if (st.travl) d.hoejre.appendChild(chip('info', 'chipArbejder'));
      else if (!st.resultat) d.hoejre.appendChild(chip('info', 'chipIndsat'));
      else {
        d.hoejre.appendChild(chip('ok', 'chipSatTilbage', st.resultat.koder.length));
        const u = st.resultat.advarsler.filter(a => ADV[a.art] === 'danger').reduce((x, y) => x + y.antal, 0);
        if (u) d.hoejre.appendChild(chip('danger', 'chipUkendte', u));
      }
      S.anvend(d.hoejre);
    }
    function tegnFod() {
      if (G.aktiv !== 'demasker') return;
      const fod = document.getElementById('fod-venstre');
      if (st.resultat) { fod.setAttribute('data-t', 'fodDemaskerTal'); fod.setAttribute('data-v', String(st.resultat.koder.length)); fod.setAttribute('data-w', String(advarsler().length)); }
      else { fod.setAttribute('data-t', 'fodDemasker'); fod.removeAttribute('data-v'); fod.removeAttribute('data-w'); }
      S.anvend(fod);
    }

    G.haandter('demasker', 'demasker', () => demasker());
    G.haandter('demasker', 'kopier-resultat', () => kopierResultat());
    G.haandter('demasker', 'indsaet', () => indsaetVia(st.tekst ? svar.pre : d.tom, f));
    d.soeg.addEventListener('input', () => { st.soeg = d.soeg.value; tegnTabel(); });
    async function kopierResultat() {
      if (!st.resultat) return;
      const ok = await kopier(st.resultat.tekst);
      besked(f, ok ? 'bKopieret' : null);
      if (!ok) banner(f.bannere, 'danger', 'bKopiFejl');
    }
    return {
      st, modtag, demasker, kopierResultat, tegn, tegnFod,
      opdater() { tegnFlade(); tegnBannere(); tegnKommandoer(); },
      filter(id) { st.filter = id === 'dette' ? 'alle' : id; tegnTabel(); },
      nulstilt() { st.resultat = null; st.nr++; st.travl = false; tegn(); },
    };
  })();

  function besked(f, t) {
    f.besked.textContent = '';
    if (!t) return;
    f.besked.setAttribute('data-t', t);
    S.anvend(f.besked);
  }

  /* Indsæt-kommandoen: fokus på visningens felt og systemets Indsæt (samme vej som ⌘V). Kan webvisningen ikke selv
     hente udklipsholderen, står der, hvilken tast der virker. */
  function indsaetVia(maal, f) {
    if (maal && maal.focus) maal.focus();
    let ok = false;
    try { ok = document.execCommand('paste'); } catch (e) { ok = false; }
    if (!ok) besked(f, 'bTrykModV');
    if (!ok) { f.besked.setAttribute('data-v', G.mod + 'V'); S.anvend(f.besked); }
  }

  /* ⌘V (og menuens Indsæt) i Maskér og Demaskér: teksten fra clipboardData, uændret. I søgefeltet og i en erstatning
     virker indsæt som normalt. */
  document.addEventListener('paste', e => {
    if (fokusIFelt(e) || document.querySelector('dialog[open]')) return;
    const v = G.aktiv;
    if (v !== 'masker' && v !== 'demasker') return;
    const s = e.clipboardData ? e.clipboardData.getData('text/plain') : '';
    e.preventDefault();
    (v === 'masker' ? M : D).modtag(s);
  });

  /* Genveje: ⌘↵ Analysér og derefter Gem og maskér (Demaskér i Demaskér); ⇧⌘C kopiér resultatet. Ctrl på Windows. */
  document.addEventListener('keydown', e => {
    const modTast = G.mac ? e.metaKey && !e.ctrlKey : e.ctrlKey && !e.metaKey;
    if (!modTast || e.altKey || document.querySelector('dialog[open]')) return;
    const v = G.aktiv;
    if (v !== 'masker' && v !== 'demasker') return;
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (fokusIFelt(e)) e.target.blur();
      if (v === 'masker') M.genvejEnter(); else D.demasker();
    } else if (e.shiftKey && (e.code === 'KeyC' || e.key === 'c' || e.key === 'C')) {
      e.preventDefault();
      (v === 'masker' ? M : D).kopierResultat();
    }
  });

  document.addEventListener('grimnir-trae', e => {
    if (e.detail.visning === 'masker') M.filter(e.detail.id);
    else if (e.detail.visning === 'demasker') D.filter(e.detail.id);
  });
  document.addEventListener('grimnir-visning', () => { M.tegnFod(); D.tegnFod(); });

  /* Programmenuen følger UI'ets sprog. */
  const menuSprog = () => invoke('menu_sprog', { sprog: S.lang }).catch(() => { /* ingen menu (Windows) */ });
  document.addEventListener('grimnir-sprog', menuSprog);

  M.tegn();
  D.tegn();
  menuSprog();
  window.GrimnirMaskering = { M, D, utf8Laengde, MAKS_BYTES, MAKS_DEMASKER, saetSag, saetGemteSager, kommando, sagFejlTekst, banner, get poster() { return poster; } };
})();
