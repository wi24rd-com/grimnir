/* Grimnir — Maskér og Demaskér (V-SKAL.2). Bygger på skallen (window.Grimnir fra app.js) og kittet (window.Kit).

   Teksten er den indsatte tekst, bytepræcist (M1): den tages fra indsæt-hændelsens clipboardData.getData('text/plain') og
   gemmes, som den er, i hukommelsen. Den vises i et felt, der ikke kan redigeres (<pre>), aldrig i et <textarea>, fordi
   et textarea gør CRLF til LF. Resultatet kopieres fra strengen i hukommelsen, ikke fra et felt.

   Intet her skriver til konsollen eller til localStorage. Teksten, fundene og resultatet lever kun i denne side og i
   Rust-processens hukommelse; lukkes programmet, er de væk. Sagen (nøgletabellen) gemmer Rust krypteret, når den er
   navngiven (V-SAG.1); titellinjen og sagerne styres af sager.js.

   Ordbogen (V-ORDBOG.1): hver række i Maskér-tabellen kan lægges i ordbogen som "maskér altid" eller "maskér aldrig"
   (ordbog.js). Når ordbogen ændres (hændelsen 'grimnir-ordbog'), analyseres teksten igen; rækker, brugeren selv har slået
   til eller fra, beholder valget, og nye rækker får kernens standard.

   Filer (V-FIL.1): "Åbn fil" (⌘O, menuen Arkiv, eller træk en fil ind) åbner styresystemets dialog fra Rust. Teksten bliver i
   Rust; her er kun filnavnet, tallene, et uddrag (de første 200.000 tegn) og én side rækker ad gangen. Søgning, filter og
   "Vis flere" henter rækker fra Rust, så de dækker alle rækker. "Gem maskeret fil" (⌘S) og "Gem som fil" skriver fra Rust;
   rester kræver "Gem alligevel", og den demaskerede fil kræver en bekræftelse. Stien ser webvisningen aldrig.

   Rust-kommandoer: analyser, gem_og_masker, demasker, menu_sprog; fil_aabn, fil_aabn_sluppet, fil_luk, fil_analyser,
   fil_raekker, fil_gem_og_masker, fil_demasker, fil_kopi, fil_gem; udklip_kopieret (V-LAAS.4, efter Kopiér i Demaskér);
   kvittering (V-KVIT.1: Kopiér kvittering i Maskér; teksten bygges i Rust og meldes ikke til udklip_kopieret).
   Hændelser fra Rust: menu ("aabn" | "gem"), fil-traek,
   fil-sluppet (kun filnavnet). */
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

  /* En kommando i båndet: aktiv (med genvej i title) eller nedtonet med en forklaring. V-KITBRUG.2 N3 (G11): forklaringen
     står i kittets værktøjstip (bar.saetDeaktiveret med hvorforTip; vises ved hover og ved Tab, læses efter navnet), ikke
     i title. v er {v} i forklaringen (fx årsagen til, at en sag ikke kan åbnes); kittets saetDeaktiveret tager kun
     nøglen, så Grimnir sætter data-v på tippet selv (kit-ønske G13). Tippet laves kun om, når forklaringen skifter, så
     et tip, der er vist, ikke blinker ved hver ny tegning. Genvejen står stadig i title på en aktiv kommando (title må
     gentage navnet). */
  const FORKLARET = new WeakMap();
  function kommando(visning, id, on, hvorfor, genvej, v) {
    const bar = G.dele[visning].bar, b = bar.knap(id);
    if (!b) return;
    const h = on ? null : hvorfor || 'hvorforIndsaetFoerst';
    const noegle = on ? '' : h + '|' + (v == null ? '' : String(v));
    if (FORKLARET.get(b) !== noegle) {
      bar.saetDeaktiveret(id, !on, h);
      FORKLARET.set(b, noegle);
      const tip = !on && document.getElementById(b.getAttribute('aria-describedby') || '');
      if (tip && v != null) tip.setAttribute('data-v', String(v));
    }
    b.removeAttribute('title');
    b.removeAttribute('data-v');
    if (on && genvej) {
      b.setAttribute('data-t-title', genvej[0]);
      b.setAttribute('data-v', genvej[1]);
      b.setAttribute('aria-keyshortcuts', genvej[2]);
    } else {
      b.removeAttribute('data-t-title');
      b.removeAttribute('aria-keyshortcuts');
    }
    S.anvend(b.parentElement);
  }
  const GV = {
    analyser: () => ['genvejTitel', G.mod + '↵', (G.mac ? 'Meta' : 'Control') + '+Enter'],
    kopier: () => ['genvejTitel', (G.mac ? '⇧⌘' : 'Ctrl+Shift+') + 'C', (G.mac ? 'Meta' : 'Control') + '+Shift+C'],
    aabn: () => ['genvejTitel', G.mod + 'O', (G.mac ? 'Meta' : 'Control') + '+O'],
    gem: () => ['genvejTitel', G.mod + 'S', (G.mac ? 'Meta' : 'Control') + '+S'],
  };
  const tal = n => Number(n).toLocaleString(S.lang === 'en' ? 'en-GB' : 'da-DK');

  /* En filfejl fra Rust (FilFejl i src-tauri/src/fil.rs: {art, …}) som tekst på det aktuelle sprog. Ingen sti, intet indhold. */
  function filFejlTekst(f) {
    if (!f) return S.t('sagfejl_andet');
    if (f.art === 'tegnsaet') return S.t('ffejl_tegnsaet_' + f.ligner, f.byte != null ? tal(f.byte) : null) || S.t('sagfejl_andet');
    if (f.art === 'for_stor') return S.t('ffejl_for_stor', mb(f.bytes), mb(f.maks));
    if (f.art === 'disk') return S.t('ffejl_disk', f.hvad);
    return S.t('ffejl_' + f.art) || S.t('sagfejl_andet');
  }

  /* "Grimnir arbejder": vises, når en kommando har kørt i mere end et sekund (F4), og fjernes, når den er færdig.
     V-KITBRUG.1 N3: kittets fremdrift (Kit.fremdrift, ubestemt: ring og tekst med role="status"); fladen er aria-busy, til
     arbejdet er færdigt (faerdig()). Den står øverst på fladen og fjernes igen. */
  function arbejder(f, on) {
    if (on) {
      if (!f.arbTimer && !f.frem) {
        f.arbTimer = setTimeout(() => {
          f.arbTimer = null;
          f.frem = K.fremdrift({ t: 'arbejder', omraade: f.d.flade });
          f.d.flade.insertBefore(f.frem.rod, f.d.flade.firstChild);
          S.anvend(f.frem.rod);
        }, 1000);
      }
    } else {
      clearTimeout(f.arbTimer);
      f.arbTimer = null;
      if (f.frem) { f.frem.faerdig(); f.frem.rod.remove(); f.frem = null; }
    }
  }

  /* Den åbne fil i værktøjslinjen: navn, størrelse, tegnsæt og linjeskift. */
  function tegnFilinfo(f, fil) {
    f.filinfo.textContent = '';
    f.filinfo.hidden = !fil;
    if (!fil) return;
    f.filinfo.appendChild(K.ikon('fil', 'ik'));
    const navn = el('span', 'mono filnavn');
    navn.textContent = fil.navn;
    f.filinfo.append(navn, el('span', 'muted', 'filStr', mb(fil.bytes)), el('span', 'muted', 'ts_' + fil.tegnsaet), el('span', 'muted', 'ls_' + fil.linjeskift));
    S.anvend(f.filinfo);
  }

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

  /* Fælles opbygning af en arbejdsflade: tom tilstand (eksisterer) + bannere + delt flade. Den tomme tilstand er kittets
     flade, der tager imod (app.js, G8: fokus, navn med ⌘V, Åbn fil); indsæt tages imod på hele siden nedenfor. */
  function byggeFlade(visning, opsaet) {
    const d = G.dele[visning];
    // V-KITBRUG.2 N5: arbejdet fylder fladen, og tekst og tabel deler højden (app.css: .flade.fyld).
    d.flade.classList.add('fyld');
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
    // V-FIL.1: den åbne fil i værktøjslinjen og "Åbn fil" i den tomme tilstand ("Grimnir arbejder": arbejder()).
    const filinfo = el('span', 'filinfo');
    filinfo.hidden = true;
    d.sek.querySelector('.vl').insertBefore(filinfo, d.hoejre);
    const fladen = { d, ark, bannere, besked, tomBannere, filinfo, frem: null, arbTimer: null };
    S.anvend(d.flade);
    return fladen;
  }

  function panel(t, kl) {
    const p = el('section', 'panel' + (kl ? ' ' + kl : ''));
    const hoved = el('div', 'panel-hoved');
    const h = el('h3', null, t);
    const info = el('span', 'muted');
    hoved.append(h, info);
    p.append(hoved);
    p.setAttribute('data-t-aria', t);
    return { p, h, info, hoved };
  }

  /* V-RET.1 R2: "Ombryd" i panelhovedet skifter tekstfeltet mellem én linje pr. linje (standard, med vandret rulning) og
     ombrydning. Valget huskes ikke: det står kun på elementet og er væk, når programmet lukkes. */
  function ombrydKnap(hoved, pre) {
    const b = el('button', 'mini ombryd-knap', 'kOmbryd');
    b.type = 'button';
    b.setAttribute('aria-pressed', 'false');
    b.setAttribute('data-t-aria', 'ariaOmbryd');
    b.setAttribute('data-t-title', 'titelOmbryd');
    b.addEventListener('click', () => {
      const on = !pre.classList.contains('ombryd');
      pre.classList.toggle('ombryd', on);
      b.setAttribute('aria-pressed', String(on));
    });
    hoved.appendChild(b);
    return b;
  }

  function tekstVisning(aria) {
    const pre = el('pre', 'tekst mono');
    pre.tabIndex = 0;
    pre.setAttribute('data-t-aria', aria);
    const afk = el('p', 'afkortet', 'tekstAfkortet');
    afk.hidden = true;
    /* ikkeVist: for en fil er s Rusts uddrag, og ikkeVist er antallet af tegn efter det (null: indsat tekst). */
    function vis(s, ikkeVist) {
      if (ikkeVist == null) {
        pre.textContent = s.length > MAKS_VIST ? s.slice(0, MAKS_VIST) : s;
        afk.setAttribute('data-t', 'tekstAfkortet');
        afk.removeAttribute('data-v');
        afk.hidden = s.length <= MAKS_VIST;
      } else {
        pre.textContent = s;
        afk.setAttribute('data-t', 'filAfkortet');
        afk.setAttribute('data-v', tal(ikkeVist));
        afk.hidden = ikkeVist === 0;
      }
      S.anvend(afk);
    }
    return { pre, afk, vis };
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
    // fil: den åbne fil (FilInfo fra Rust) eller null; så er tekst Rusts uddrag, og analyse.side er rækkerne fra Rust.
    const st = { tekst: null, bytes: 0, fil: null, analyse: null, fravalgt: new Set(), rort: new Map(), rettelser: new Map(), fejl: new Map(), resultat: null, foerEfter: false, visRester: false, spoergRester: false, filter: 'alle', soeg: '', vist: new Set(), side: SIDE, nr: 0, sideNr: 0, travl: false, venter: null };
    let tv, tabelvaert, flere, flereTekst, tekstPanel, tabelPanel, delt;
    const f = byggeFlade('masker', ark => {
      delt = el('div', 'delt');
      tekstPanel = panel('pTekst');
      tv = tekstVisning('ariaTekst');
      tekstPanel.p.append(tv.pre, tv.afk);
      ombrydKnap(tekstPanel.hoved, tv.pre);
      tabelPanel = panel('pFund');
      tabelvaert = el('div', 'tabelvaert');
      flere = el('div', 'flere');
      flereTekst = el('span', null);
      const flereKnap = K.knap({ t: 'visFlere', ved: () => { st.side += SIDE; if (st.fil) hentSide(); else tegnTabel(); } });
      flereKnap.classList.add('mini');
      flere.append(flereTekst, flereKnap);
      flere.hidden = true;
      tabelPanel.p.append(tabelvaert, flere);
      delt.append(tekstPanel.p, tabelPanel.p);
      ark.appendChild(delt);
    });
    const d = f.d;

    function nulstilValg() {
      st.analyse = null; st.fravalgt = new Set(); st.rort = new Map(); st.rettelser = new Map(); st.fejl = new Map(); st.resultat = null;
      st.foerEfter = false; st.visRester = false; st.spoergRester = false; st.vist = new Set(); st.side = SIDE; st.nr++; st.travl = false;
      if (st.venter) { clearTimeout(st.venter); st.venter = null; }
    }

    function modtag(s) {
      f.tomBannere.textContent = '';
      f.bannere.textContent = '';
      if (!s) { banner(st.tekst ? f.bannere : f.tomBannere, 'info', 'bIngenTekst'); return; }
      const bytes = utf8Laengde(s);
      if (bytes > MAKS_BYTES) { banner(st.tekst ? f.bannere : f.tomBannere, 'danger', 'bForStor', mb(bytes)); return; }
      slipFil();
      nulstilValg();
      st.tekst = s;
      st.bytes = bytes;
      tegn();
      tv.pre.focus();
    }

    /* ── filer (V-FIL.1) ── */
    /* En indsat tekst tager over: Rust slipper filen (og nulstiller teksten). */
    function slipFil() {
      if (!st.fil) return;
      st.fil = null;
      invoke('fil_luk', { visning: 'masker' }).catch(() => { /* intet at slippe */ });
    }
    /* Åbn fil (dialogen i Rust) eller filen fra et træk og slip (kommando 'fil_aabn_sluppet'). */
    function aabnFil(kommando) {
      if (st.travl) return Promise.resolve();
      if (st.venter) { clearTimeout(st.venter); st.venter = null; }
      const nr = ++st.nr;
      st.travl = true;
      tegnKommandoer();
      tegnChip();
      return invoke(kommando || 'fil_aabn', { visning: 'masker' })
        .then(info => { if (nr !== st.nr) return; st.travl = false; if (info) modtagFil(info); else tegn(); })
        .catch(e => { if (nr !== st.nr) return; st.travl = false; fejl(e); tegn(); });
    }
    function modtagFil(info) {
      f.tomBannere.textContent = '';
      f.bannere.textContent = '';
      nulstilValg();
      st.fil = info;
      st.tekst = info.uddrag;
      st.bytes = info.bytes;
      tegn();
      tv.pre.focus();
    }
    const sideValg = () => ({ filter: st.filter, soeg: st.soeg, vist: [...st.vist], antal: st.side });
    /* Svaret fra fil_analyser i samme form som analyser: rækkerne er den første side. */
    const fraFil = a => ({ ...a, raekker: a.side.raekker });
    /* Filter, søgning og "Vis flere" for en fil: rækkerne hentes fra Rust (over alle rækker). */
    function hentSide() {
      if (!st.fil || !st.analyse) return Promise.resolve();
      const nr = ++st.sideNr, analyse = st.analyse;
      return invoke('fil_raekker', { side: sideValg() }).then(s => {
        if (nr !== st.sideNr || analyse !== st.analyse) return;
        st.analyse = { ...analyse, raekker: s.raekker, side: s };
        tegnTabel(); tegnTrae(); tegnChip(); tegnFod();
      }).catch(e => { fejl(e); tegnBannere(); });
    }
    /* Gem maskeret fil: rester kræver først "Gem alligevel" (Rust kræver det også). Dialogen og skrivningen er i Rust. */
    function gemFil(alligevel) {
      if (!st.fil || !st.resultat || st.travl) return Promise.resolve();
      const n = st.resultat.rester.reduce((a, r) => a + r.antal, 0);
      if (n && !alligevel) { st.spoergRester = true; tegnBannere(); return Promise.resolve(); }
      st.spoergRester = false;
      st.travl = true;
      tegnKommandoer(); tegnChip(); tegnBannere();
      return invoke('fil_gem', { visning: 'masker', ok: Boolean(alligevel) }).then(navn => {
        st.travl = false;
        if (navn) { besked(f, 'bFilGemt'); f.besked.setAttribute('data-v', navn); S.anvend(f.besked); }
      }).catch(e => {
        st.travl = false;
        if (e && e.art === 'rester') st.spoergRester = true; else fejl(e);
      }).then(() => { tegnKommandoer(); tegnChip(); tegnBannere(); });
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
      const kald = st.fil
        ? invoke('fil_analyser', { fravalgt: foerste ? null : [...st.fravalgt], rort: null, rettelser: foerste ? null : rettelser(), side: sideValg() }).then(fraFil)
        : invoke('analyser', { tekst: st.tekst, fravalgt: foerste ? null : [...st.fravalgt], rettelser: foerste ? null : rettelser() });
      return kald
        .then(a => {
          if (nr !== st.nr) return;
          st.travl = false;
          if (st.fil) st.fravalgt = new Set(a.fravalgt);
          else if (foerste) st.fravalgt = new Set(a.raekker.filter(r => !r.valgt).map(r => r.id));
          for (const r of a.raekker) if (r.laast) st.fravalgt.delete(r.id);
          st.analyse = a;
          st.fejl = new Map(a.fejl.map(x => [x.id, x]));
          tegn();
        })
        .catch(e => { if (nr !== st.nr) return; st.travl = false; fejl(e); tegn(); });
    }
    /* Ordbogen eller sagens valg er ændret: analysér igen. Først med kernens standard (så nye rækker får den); rækker,
       brugeren har slået til eller fra (st.rort), beholder valget; derefter med det samlede valg, hvis det afviger.
       Rettelser til rækker, der ikke findes længere (fx lagt på "maskér aldrig"), droppes. Et resultat er forældet. */
    function analyserIgen() {
      if (!st.tekst || !st.analyse) return Promise.resolve();
      if (st.venter) { clearTimeout(st.venter); st.venter = null; }
      if (st.resultat) { st.resultat = null; st.foerEfter = false; st.visRester = false; st.aendretEfter = true; }
      const nr = ++st.nr;
      st.travl = true;
      tegnKommandoer();
      tegnChip();
      const ret = rettelser();
      // En fil: Rust gør begge trin i ét kald (rort = rækkerne, brugeren selv har slået til eller fra).
      if (st.fil) {
        return invoke('fil_analyser', { fravalgt: null, rort: [...st.rort], rettelser: ret, side: sideValg() }).then(fraFil)
          .then(a => {
            if (nr !== st.nr) return;
            const ukendte = new Set(a.fejl.filter(x => x.fejl === 'ukendt_raekke').map(x => x.id));
            for (const id of ukendte) st.rettelser.delete(id);
            a.fejl = a.fejl.filter(x => !ukendte.has(x.id));
            st.travl = false;
            st.fravalgt = new Set(a.fravalgt);
            st.analyse = a;
            st.fejl = new Map(a.fejl.map(x => [x.id, x]));
            tegn();
          })
          .catch(e => { if (nr !== st.nr) return; st.travl = false; fejl(e); tegn(); });
      }
      return invoke('analyser', { tekst: st.tekst, fravalgt: null, rettelser: ret })
        .then(a => {
          if (nr !== st.nr) return null;
          const ider = new Set(a.raekker.map(r => r.id));
          for (const id of [...st.rettelser.keys()]) if (!ider.has(id)) st.rettelser.delete(id);
          const fra = new Set();
          for (const r of a.raekker) {
            const on = st.rort.has(r.id) ? st.rort.get(r.id) : r.valgt;
            if (!on && !r.laast) fra.add(r.id);
          }
          const std = a.raekker.filter(r => !r.valgt).map(r => r.id);
          st.fravalgt = fra;
          const ret2 = rettelser();
          if (ret2.length === ret.length && std.length === fra.size && std.every(id => fra.has(id))) return a;
          return invoke('analyser', { tekst: st.tekst, fravalgt: [...fra], rettelser: ret2 });
        })
        .then(a => {
          if (!a || nr !== st.nr) return;
          st.travl = false;
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
        const m = st.fil
          ? fraFilMaskering(await invoke('fil_gem_og_masker', { fravalgt: [...st.fravalgt], rettelser: rettelser() }))
          : await invoke('gem_og_masker', { tekst: st.tekst, fravalgt: [...st.fravalgt], rettelser: rettelser() });
        if (nr !== st.nr) return;
        st.resultat = m; st.foerEfter = true; st.visRester = false; st.spoergRester = false; st.aendretEfter = false; st.travl = false;
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

    /* Svaret fra fil_gem_og_masker i samme form som gem_og_masker: maskeret er uddraget. */
    const fraFilMaskering = m => ({ maskeret: m.uddrag, ikkeVist: m.ikke_vist, rester: m.rester, advarsler: m.advarsler, poster: m.poster, bytes: m.bytes, kopierbar: m.kopierbar, fil: true });

    let fejlBanner = null;
    function fejl(e) {
      if (e && e.art === 'fil') { fejlBanner = ['bFilFejl', filFejlTekst(e.fejl)]; return; }
      if (e && e.art === 'foraeldet') { fejlBanner = ['bForaeldet', null]; return; }
      if (e && e.art === 'for_stor_til_kopi') { fejlBanner = ['bKopiForStor', null]; return; }
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
      tegnFilinfo(f, st.fil);
    }
    function tegnBannere() {
      f.bannere.textContent = '';
      // En fejl, før der er en tekst (fx en fil, der ikke kan åbnes), står over den tomme tilstand.
      if (fejlBanner) { if (!st.tekst) f.tomBannere.textContent = ''; banner(st.tekst ? f.bannere : f.tomBannere, 'danger', fejlBanner[0], fejlBanner[1], fejlBanner[2]); fejlBanner = null; }
      if (st.resultat) {
        const n = st.resultat.rester.reduce((a, r) => a + r.antal, 0);
        if (n === 0) banner(f.bannere, 'ok', 'bLaekIngen');
        else banner(f.bannere, 'warn', 'bLaekRester', n, { t: st.visRester ? 'hVisFund' : 'hVisRester', ved: () => { st.visRester = !st.visRester; tegnBannere(); tegnTabel(); } });
        if (n && st.spoergRester && st.fil) banner(f.bannere, 'warn', 'bGemRester', n, { t: 'kGemAlligevel', ved: () => gemFil(true) });
        if (st.resultat.advarsler.length) banner(f.bannere, 'warn', 'bOverloeb', st.resultat.advarsler.length);
      } else if (st.aendretEfter) {
        banner(f.bannere, 'info', 'bValgAendret');
      }
      if (st.analyse && st.analyse.advarsler.length && !st.resultat) banner(f.bannere, 'warn', 'bOverloeb', st.analyse.advarsler.length);
    }
    function tegnTekst() {
      const efter = st.foerEfter && st.resultat;
      tv.vis(efter ? st.resultat.maskeret : st.tekst || '', st.fil ? (efter ? st.resultat.ikkeVist : st.fil.ikke_vist) : null);
      tekstPanel.h.setAttribute('data-t', efter ? 'pMaskeret' : 'pTekst');
      tekstPanel.p.setAttribute('data-t-aria', efter ? 'pMaskeret' : 'pTekst');
      tv.pre.setAttribute('data-t-aria', efter ? 'ariaMaskeret' : 'ariaTekst');
      tekstPanel.info.setAttribute('data-t', 'tekstInfo');
      tekstPanel.info.setAttribute('data-v', st.fil ? String(st.fil.linjer) : st.analyse ? String(st.analyse.linjer) : '…');
      tekstPanel.info.setAttribute('data-w', mb(st.bytes));
      S.anvend(tekstPanel.p);
      G.dele.masker.bar.knap('foer-efter').setAttribute('aria-pressed', String(Boolean(efter)));
    }

    function valgt(r) { return r.laast || !st.fravalgt.has(r.id); }
    function filtrerede() {
      if (!st.analyse) return [];
      if (st.fil) return st.analyse.raekker; // Rust har filtreret og søgt (fil_raekker)
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
        const v = c.appendChild(el('span', 'mono'));
        v.textContent = r.vaerdier.join(', ');
        v.title = v.textContent; // forkortes med … i en smal kolonne (V-RET.1 R1)
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
          // En fil med søgning: om værdien kan søges, afhænger af Vis; Rust søger igen.
          if (st.fil && st.soeg.trim()) { hentSide().then(() => genskabFokus(tabelvaert, n)); return; }
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
      inp.title = inp.value;
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
      // V-KERNE.2 fund 2 (V-ORDBOG.1 O7): en egen kode i en navngiven sag, der allerede har gemt maskeringer, må ikke
      // være et ord fra en tidligere tekst; kernen kan ikke se det, så brugeren advares.
      const GS = window.GrimnirSager;
      if (!fe && st.rettelser.has(r.id) && GS && GS.status && GS.status.id && poster > 0) {
        const a = el('span', 'raekkeadv', 'advEgenKode');
        a.id = 'adv-' + r.id;
        inp.setAttribute('aria-describedby', a.id);
        c.appendChild(a);
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

    /* Rækkens vej til ordbogen (O4): "Altid" og "Aldrig". Nedtonet med forklaring for hemmeligheder, når ordbogen ikke kan
       åbnes, og ("Altid") for arter, ordbogen ikke har en type til. */
    function ordbogCelle(r) {
      const c = el('span', 'ordbogknapper');
      const GO = window.GrimnirOrdbog;
      for (const hvad of ['altid', 'aldrig']) {
        // V-RET.1 R1: små ikonknapper (maske: maskér altid, øje: maskér aldrig); ordet står skjult i knappen og i title.
        // V-PUDS.1 N3: ved brede tabeller gør app.css ordet synligt ved ikonet (kun CSS; title og aria-label er de samme).
        const b = el('button', 'mini ikonknap');
        b.type = 'button';
        b.append(K.ikon(hvad === 'altid' ? 'maske' : 'oeje', 'ik'), el('span', 'skjult-tekst', hvad === 'altid' ? 'kAltid' : 'kAldrig'));
        b.setAttribute('data-t-title', hvad === 'altid' ? 'kAltidTitel' : 'kAldrigTitel');
        b.setAttribute('data-felt', 'ordbog-' + hvad);
        b.setAttribute('data-t-aria', r.hemmelig ? 'ariaOrdbogHemmelig' : hvad === 'altid' ? 'ariaAltid' : 'ariaAldrig');
        b.setAttribute('data-v', r.hemmelig ? String(r.linje) : r.vaerdier[0]);
        const hvorfor = GO ? GO.kan(r, hvad) : 'hvorforOrdbogLaast';
        if (hvorfor) { b.disabled = true; b.setAttribute('data-t-title', hvorfor); }
        b.addEventListener('click', () => tilOrdbog(r, hvad));
        c.appendChild(b);
      }
      return c;
    }
    function tilOrdbog(r, hvad) {
      const GO = window.GrimnirOrdbog;
      if (!GO) return;
      // "Maskér altid": rækken skal maskeres efter den nye analyse (valget huskes, før ordbogen melder sig ændret).
      const foer = st.rort.has(r.id) ? st.rort.get(r.id) : undefined;
      if (hvad === 'altid') st.rort.set(r.id, true);
      const tilbage = () => { if (foer === undefined) st.rort.delete(r.id); else st.rort.set(r.id, foer); };
      GO.fraMasker(r, hvad).then(aendret => {
        if (!aendret) { tilbage(); return; }
        besked(f, hvad === 'altid' ? 'bLagtAltid' : 'bLagtAldrig');
        f.besked.setAttribute('data-v', r.vaerdier[0]);
        S.anvend(f.besked);
      }).catch(e => {
        tilbage();
        fejlBanner = ['bOrdbogFejl', GO.fejlTekst(e)];
        tegnBannere();
      });
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
      const vis = st.fil ? alle : alle.slice(0, st.side);
      // En fil: tallene er over alle rækker i Rust (side.i_alt, side.antal, side.valgte).
      const side = st.fil ? st.analyse.side : null;
      const iAlt = side ? side.i_alt : alle.length;
      const t = K.tabel({
        ariaT: 'pFund',
        kolonner: [{ t: 'kolMasker' }, { t: 'kolType' }, { t: 'kolVaerdi' }, { t: 'kolErstatning' }, { t: 'kolAntal', tal: true }, { t: 'kolStatus' }, { t: 'kolOrdbog' }],
        raekker: vis.map(r => {
          const on = valgt(r);
          // V-KITBRUG.2 N3 (G7): kittets afkrydsning uden synlig tekst (boksen alene, 16 px); rækken er det synlige navn,
          // og navnet står i aria-label ("Maskér 192.0.2.17"; en hemmelighed nævnes ved linjen, ikke ved værdien).
          const cb = K.afkrydsning({ ariaT: r.hemmelig ? 'ariaMaskerHemmelig' : 'ariaMasker', ariaV: r.hemmelig ? String(r.linje) : r.vaerdier[0], valgt: on, deaktiveret: r.laast }).input;
          cb.setAttribute('data-felt', 'valg');
          if (r.laast) cb.setAttribute('data-t-title', 'hvorforLaast');
          cb.addEventListener('change', () => {
            if (cb.checked) st.fravalgt.delete(r.id); else st.fravalgt.add(r.id);
            st.rort.set(r.id, cb.checked);
            const tr = cb.closest('tr');
            tr.classList.toggle('fra', !cb.checked);
            const k = tr.querySelector('[data-felt="kode"]');
            if (k) k.disabled = !cb.checked;
            aendret();
          });
          const st0 = STATUS[r.status] || STATUS.tjek;
          return { celler: [cb, el('span', null, 'art_' + r.art), vaerdiCelle(r), erstatningCelle(r, on), String(r.antal), chip(st0[0], st0[1]), ordbogCelle(r)], data: r.id, fra: !on };
        }),
      });
      t.classList.add('fundtabel');
      const tr = [...t.querySelectorAll('tbody tr')];
      vis.forEach((r, i) => { tr[i].setAttribute('data-id', String(r.id)); if (!valgt(r)) tr[i].classList.add('fra'); });
      tabelvaert.appendChild(t);
      if (!vis.length) tabelvaert.appendChild(el('p', 'tabel-tom', (side ? side.antal.alle : st.analyse.raekker.length) ? 'ingenIFilter' : 'ingenFund'));
      flere.hidden = iAlt <= vis.length;
      flereTekst.setAttribute('data-t', 'visesAf');
      flereTekst.setAttribute('data-v', String(vis.length));
      flereTekst.setAttribute('data-w', String(iAlt));
      tabelPanel.h.setAttribute('data-t', 'pFund');
      tabelPanel.info.setAttribute('data-t', 'fundInfo');
      tabelPanel.info.setAttribute('data-v', String(side ? side.antal.alle : st.analyse.raekker.length));
      tabelPanel.info.setAttribute('data-w', String(side ? side.valgte : st.analyse.raekker.filter(valgt).length));
      S.anvend(tabelPanel.p);
      genskabFokus(tabelvaert, n);
    }
    function tegnRester() {
      const t = K.tabel({
        ariaT: 'pRester',
        kolonner: [{ t: 'kolHvad' }, { t: 'kolType' }, { t: 'kolTekst' }, { t: 'kolAntal', tal: true }, { t: 'kolLinje', tal: true }],
        raekker: st.resultat.rester.map(r => {
          const tekst = el('span', 'mono kort');
          tekst.textContent = r.tekst;
          tekst.title = r.tekst;
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
      const ant = st.fil
        ? (st.analyse ? st.analyse.side.antal : { alle: 0, tjek: 0, hemmelig: 0, seneste: 0 })
        : { alle: r.length, tjek: r.filter(x => x.status === 'tjek' || st.fejl.has(x.id)).length, hemmelig: r.filter(x => x.hemmelig).length, seneste: r.filter(x => x.kendt).length };
      for (const id of ['alle', 'tjek', 'hemmelig', 'seneste']) {
        const n = ant[id];
        const a = d.nd.querySelector(`[data-punkt="${id}"] .ant`);
        if (a) a.textContent = String(n);
      }
    }
    function tegnKommandoer() {
      const v = 'masker', t = st.travl, res = st.resultat;
      kommando(v, 'aabn-fil', !t, 'hvorforVent', GV.aabn());
      kommando(v, 'analyser', Boolean(st.tekst) && !t, st.tekst ? 'hvorforVent' : 'hvorforIndsaetFoerst', st.analyse ? null : GV.analyser());
      const gemHvorfor = !st.tekst ? 'hvorforIndsaetFoerst' : t ? 'hvorforVent' : 'hvorforAnalyserFoerst';
      kommando(v, 'gem-masker', Boolean(st.analyse) && !t, gemHvorfor, st.analyse ? GV.analyser() : null);
      kommando(v, 'foer-efter', Boolean(res) && !t, res ? 'hvorforVent' : 'hvorforMaskerFoerst');
      // En fil over 5 MB kan ikke kopieres (F3): Kopiér er nedtonet med en forklaring.
      kommando(v, 'kopier', Boolean(res) && !t && (!res.fil || res.kopierbar), !res ? 'hvorforMaskerFoerst' : t ? 'hvorforVent' : 'hvorforForStorTilKopi', GV.kopier());
      kommando(v, 'gem-fil', Boolean(st.fil && res) && !t, !st.fil ? 'hvorforKunFil' : t ? 'hvorforVent' : 'hvorforMaskerFoerst', GV.gem());
      // V-KVIT.1: Kopiér kvittering, når der er et maskeret resultat (indsat tekst eller fil).
      kommando(v, 'kvittering', Boolean(res) && !t, res ? 'hvorforVent' : 'hvorforMaskerFoerst');
      arbejder(f, t);
    }
    function tegnChip() {
      d.hoejre.textContent = '';
      let c;
      // Arbejder også før der er en tekst (en fil åbnes).
      if (st.travl) c = chip('info', 'chipArbejder');
      else if (!st.tekst) c = chip('none', 'chipIntetIndsat');
      else if (st.resultat) { const n = st.resultat.rester.length; c = n ? chip('warn', 'chipRester', n) : chip('ok', 'chipMaskeret'); }
      else if (!st.analyse) c = chip('info', 'chipIndsat');
      else {
        const n = st.fil ? st.analyse.side.antal.status_tjek : st.analyse.raekker.filter(x => x.status === 'tjek').length;
        c = n ? chip('warn', 'chipVenter', n) : chip('ok', 'chipFund', st.fil ? st.analyse.side.antal.alle : st.analyse.raekker.length);
      }
      d.hoejre.appendChild(c);
      S.anvend(d.hoejre);
    }
    function tegnFod() {
      if (G.aktiv !== 'masker') return;
      const fod = document.getElementById('fod-venstre');
      const side = st.fil && st.analyse ? st.analyse.side : null;
      if (st.analyse) { fod.setAttribute('data-t', 'fodMaskerTal'); fod.setAttribute('data-v', String(side ? side.antal.alle : st.analyse.raekker.length)); fod.setAttribute('data-w', String(side ? side.valgte : st.analyse.raekker.filter(valgt).length)); }
      else { fod.setAttribute('data-t', 'fodMasker'); fod.removeAttribute('data-v'); fod.removeAttribute('data-w'); }
      S.anvend(fod);
    }

    /* ── kommandoer og genveje ── */
    G.haandter('masker', 'analyser', () => analyser());
    G.haandter('masker', 'gem-masker', () => gem());
    G.haandter('masker', 'foer-efter', () => { st.foerEfter = !st.foerEfter; tegnTekst(); });
    G.haandter('masker', 'kopier', () => kopierResultat());
    G.haandter('masker', 'indsaet', () => indsaetVia(st.tekst ? tv.pre : d.tom, f));
    G.haandter('masker', 'aabn-fil', () => aabnFil());
    G.haandter('masker', 'gem-fil', () => gemFil(false));
    G.haandter('masker', 'kvittering', () => kopierKvittering());
    d.soeg.addEventListener('input', () => { st.soeg = d.soeg.value; st.side = SIDE; if (st.fil) hentSide(); else tegnTabel(); });
    async function kopierResultat() {
      if (!st.resultat || st.travl) return;
      if (st.resultat.fil && !st.resultat.kopierbar) { fejlBanner = ['bKopiForStor', null]; tegnBannere(); return; }
      const ok = st.resultat.fil ? await kopierFraRust('masker', e => { fejl(e); tegnBannere(); }) : await kopier(st.resultat.maskeret);
      besked(f, ok ? 'bKopieret' : null);
      if (ok === false) banner(f.bannere, 'danger', 'bKopiFejl');
    }

    /* V-KVIT.1: Kopiér kvittering. Teksten bygges i Rust af tallene fra maskeringen (ingen originaler, koder eller
       filnavn) og kopieres ad samme vej som Kopiér af et filresultat. Den meldes ikke til Rust bagefter
       (udklip_kopieret): en kvittering er lavet til at blive delt og ryddes ikke ved lås eller afslutning. */
    async function kopierKvittering() {
      if (!st.resultat || st.travl) return;
      const hent = () => invoke('kvittering', { fil: Boolean(st.resultat.fil), sprog: S.lang });
      const ok = await kopierFraRust('masker', e => { fejl(e); tegnBannere(); }, hent);
      besked(f, ok ? 'bKvitteringKopieret' : null);
      if (ok === false) banner(f.bannere, 'danger', 'bKvitteringFejl');
    }

    document.addEventListener('grimnir-ordbog', () => analyserIgen());

    return {
      st, modtag, analyser, analyserIgen, gem, kopierResultat, kopierKvittering, tegn, tegnFod, tegnTabel,
      genvejEnter() { return st.analyse ? gem() : analyser(); },
      filter(id) { st.filter = id === 'denne' ? 'alle' : id; st.visRester = false; st.side = SIDE; if (st.fil) hentSide(); else tegnTabel(); tegnBannere(); },
      aabnFil, gemFil, modtagFil,
      aabnSluppet() { return aabnFil('fil_aabn_sluppet'); },
      slipAfvist(art) { fejlBanner = [art === 'mappe' ? 'bSlipMappe' : 'bSlipFlere', null]; tegnBannere(); },
      nulstilt() { if (st.tekst) { nulstilValg(); tegn(); } },
    };
  })();

  /* ═════════════════════════════ Demaskér ═════════════════════════════ */
  const D = (function () {
    const st = { tekst: null, bytes: 0, fil: null, resultat: null, filter: 'alle', soeg: '', nr: 0, travl: false };
    let svar, ud, svarPanel, udPanel, tabelvaert, tabelPanel;
    const f = byggeFlade('demasker', ark => {
      const delt = el('div', 'delt lige');
      svarPanel = panel('pSvar');
      svar = tekstVisning('ariaSvar');
      svarPanel.p.append(svar.pre, svar.afk);
      ombrydKnap(svarPanel.hoved, svar.pre);
      udPanel = panel('pRigtige');
      ud = tekstVisning('ariaRigtige');
      udPanel.p.append(ud.pre, ud.afk);
      ombrydKnap(udPanel.hoved, ud.pre);
      delt.append(svarPanel.p, udPanel.p);
      tabelPanel = panel('pAdvarsler', 'advarselpanel');
      tabelvaert = el('div', 'tabelvaert');
      tabelPanel.p.append(tabelvaert);
      ark.append(delt, tabelPanel.p);
    });
    const d = f.d;
    // Den tomme tilstand peger på Sager, når den aktuelle sag er tom, og der findes gemte sager (V-SAG.1). V-KITBRUG.2 N3
    // (G8): det er kittets anden handling ved siden af Åbn fil (app.js); den vises kun, når der skal en sag til.
    const tilSager = d.tom.querySelector('.tomt-handlinger').lastElementChild;
    tilSager.hidden = true;

    function modtag(s) {
      f.tomBannere.textContent = '';
      f.bannere.textContent = '';
      if (!s) { banner(st.tekst ? f.bannere : f.tomBannere, 'info', 'bIngenTekst'); return; }
      const bytes = utf8Laengde(s);
      if (bytes > MAKS_DEMASKER) { banner(st.tekst ? f.bannere : f.tomBannere, 'danger', 'bForStorDemasker', mb(bytes)); return; }
      slipFil();
      st.tekst = s; st.bytes = bytes; st.resultat = null; st.nr++; st.travl = false;
      tegn();
      svar.pre.focus();
    }
    let fejlBanner = null;
    function fejl(e) {
      fejlBanner = e && e.art === 'for_stor' ? ['bForStorDemasker', mb(e.bytes)]
        : e && e.art === 'fil' ? ['bFilFejl', filFejlTekst(e.fejl)]
          : e && e.art === 'for_stor_til_kopi' ? ['bKopiForStor', null] : ['bFejl', null];
    }
    function demasker() {
      if (!st.tekst || st.travl || poster === 0) return Promise.resolve();
      const nr = ++st.nr;
      st.travl = true;
      tegnKommandoer();
      tegnChip();
      const kald = st.fil
        ? invoke('fil_demasker').then(r => ({ tekst: r.uddrag, ikkeVist: r.ikke_vist, advarsler: r.advarsler, koder: r.koder, tilbage: r.tilbage, bytes: r.bytes, kopierbar: r.kopierbar, fil: true }))
        : invoke('demasker', { tekst: st.tekst });
      return kald.then(r => {
        if (nr !== st.nr) return;
        st.travl = false; st.resultat = r; tegn();
      }).catch(e => {
        if (nr !== st.nr) return;
        st.travl = false; fejl(e); tegn();
      });
    }

    /* ── filer (V-FIL.1) ── */
    function slipFil() {
      if (!st.fil) return;
      st.fil = null;
      invoke('fil_luk', { visning: 'demasker' }).catch(() => { /* intet at slippe */ });
    }
    function aabnFil(kommando) {
      if (st.travl) return Promise.resolve();
      const nr = ++st.nr;
      st.travl = true;
      tegnKommandoer();
      tegnChip();
      return invoke(kommando || 'fil_aabn', { visning: 'demasker' })
        .then(info => { if (nr !== st.nr) return; st.travl = false; if (info) modtagFil(info); else tegn(); })
        .catch(e => { if (nr !== st.nr) return; st.travl = false; fejl(e); tegn(); });
    }
    function modtagFil(info) {
      f.tomBannere.textContent = '';
      f.bannere.textContent = '';
      st.fil = info; st.tekst = info.uddrag; st.bytes = info.bytes; st.resultat = null; st.nr++; st.travl = false;
      tegn();
      svar.pre.focus();
    }
    /* Gem som fil: først en bekræftelse (filen får de rigtige værdier i klartekst); derefter dialogen i Rust. */
    // V-KITBRUG.1 N4: kittets bekræftelse (Kit.bekraeft): Annullér har fokus, "Vælg sted og gem" er den farlige handling.
    function gemFil() {
      if (!st.fil || !st.resultat || st.travl) return;
      G.bekraeft({
        t: 'demfilH', p: { t: 'demfilP' }, nej: { t: 'annuller' }, ja: { t: 'demfilOk' }, farlig: true,
        udfyld: rod => { rod.id = 'dlg-demfil'; S.anvend(rod); },
      }).then(ja => { if (ja) gemFilBekraeftet(); });
    }
    function gemFilBekraeftet() {
      if (!st.fil || !st.resultat || st.travl) return Promise.resolve();
      st.travl = true;
      tegnKommandoer(); tegnChip();
      return invoke('fil_gem', { visning: 'demasker', ok: true }).then(navn => {
        st.travl = false;
        if (navn) { besked(f, 'bFilGemt'); f.besked.setAttribute('data-v', navn); S.anvend(f.besked); }
      }).catch(e => { st.travl = false; fejl(e); }).then(() => { tegnKommandoer(); tegnChip(); tegnBannere(); });
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
      tegnFilinfo(f, st.fil);
      d.tomP.setAttribute('data-t', poster > 0 ? 'tomDemaskerP' : gemteSager > 0 ? 'tomDemaskerAabnSagP' : 'tomDemaskerTomSagP');
      S.anvend(d.tomP);
      tilSager.hidden = !(poster === 0 && gemteSager > 0);
    }
    function tegnBannere() {
      f.bannere.textContent = '';
      if (fejlBanner) { if (!st.tekst) f.tomBannere.textContent = ''; banner(st.tekst ? f.bannere : f.tomBannere, 'danger', fejlBanner[0], fejlBanner[1]); fejlBanner = null; }
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
      svar.vis(st.tekst || '', st.fil ? st.fil.ikke_vist : null);
      ud.vis(st.resultat ? st.resultat.tekst : '', st.fil && st.resultat ? st.resultat.ikkeVist : null);
      udPanel.info.setAttribute('data-t', st.resultat ? 'blivPaaMaskinen' : 'tryk');
      udPanel.info.setAttribute('data-v', G.mod + '↵');
      svarPanel.info.setAttribute('data-t', 'tekstInfo');
      // V-RET.1 R3: linjetallet kommer altid fra Rust (fil::antal_linjer), som i Maskér: for en fil med det samme, for en
      // indsat tekst med demaskeringen (indtil da "…").
      svarPanel.info.setAttribute('data-v', st.fil ? String(st.fil.linjer) : st.resultat && st.resultat.linjer != null ? String(st.resultat.linjer) : '…');
      svarPanel.info.setAttribute('data-w', mb(st.bytes));
      S.anvend(svarPanel.p);
      S.anvend(udPanel.p);
    }
    function raekker() {
      if (!st.resultat) return [];
      let r = [];
      // V-PUDS.1 N4: antal steder og første linje pr. kode kommer fra Rust (tilbage); webvisningen tæller intet selv.
      if (st.filter === 'alle') r = (st.resultat.tilbage || []).map(k => ({ art: 'sat_tilbage', kode: k.kode, antal: k.antal, linje: k.linje })).concat(st.resultat.advarsler);
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
          const kode = el('span', 'mono kort');
          kode.textContent = a.kode;
          kode.title = a.kode;
          const c = a.art === 'sat_tilbage' ? chip('ok', 'adv_sat_tilbage') : chip(ADV[a.art] || 'warn', 'adv_' + a.art);
          return { celler: [c, kode, a.antal == null ? '' : String(a.antal), a.linje ? String(a.linje) : ''], data: a.kode };
        }),
      });
      t.classList.add('advtabel');
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
      const t = st.travl, res = st.resultat;
      kommando('demasker', 'aabn-fil', !t, 'hvorforVent', GV.aabn());
      kommando('demasker', 'demasker', Boolean(st.tekst) && poster > 0 && !t, poster === 0 ? (gemteSager > 0 ? 'hvorforAabnSag' : 'hvorforMaskerFoerstSag') : st.tekst ? 'hvorforVent' : 'hvorforIndsaetSvar', GV.analyser());
      kommando('demasker', 'kopier-resultat', Boolean(res) && !t && (!res.fil || res.kopierbar), !res ? 'hvorforDemaskerFoerst' : t ? 'hvorforVent' : 'hvorforForStorTilKopi', GV.kopier());
      kommando('demasker', 'gem-fil', Boolean(st.fil && res) && !t, !st.fil ? 'hvorforKunFil' : t ? 'hvorforVent' : 'hvorforDemaskerFoerst', GV.gem());
      arbejder(f, t);
    }
    function tegnChip() {
      d.hoejre.textContent = '';
      if (st.travl) d.hoejre.appendChild(chip('info', 'chipArbejder'));
      else if (!st.tekst) d.hoejre.appendChild(chip('none', 'chipIntetSvar'));
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
    G.haandter('demasker', 'aabn-fil', () => aabnFil());
    G.haandter('demasker', 'gem-fil', () => gemFil());
    d.soeg.addEventListener('input', () => { st.soeg = d.soeg.value; tegnTabel(); });
    async function kopierResultat() {
      if (!st.resultat || st.travl) return;
      if (st.resultat.fil && !st.resultat.kopierbar) { fejlBanner = ['bKopiForStor', null]; tegnBannere(); return; }
      const fil = Boolean(st.resultat.fil);
      const ok = fil ? await kopierFraRust('demasker', e => { fejl(e); tegnBannere(); }) : await kopier(st.resultat.tekst);
      besked(f, ok ? 'bKopieret' : null);
      if (ok === false) banner(f.bannere, 'danger', 'bKopiFejl');
      /* V-LAAS.4: Rust får at vide, at udklipsholderen nu har det demaskerede resultat, så låsen kan rydde den (kun hvis
         ingen har skrevet til den siden). Kun her, ikke efter Kopiér i Maskér: maskeret tekst er lavet til at blive delt. */
      if (ok === true) invoke('udklip_kopieret', { fil }).catch(() => { /* låst eller uden Rust: intet at huske */ });
    }
    return {
      st, modtag, demasker, kopierResultat, tegn, tegnFod, aabnFil, gemFil, modtagFil,
      aabnSluppet() { return aabnFil('fil_aabn_sluppet'); },
      slipAfvist(art) { fejlBanner = [art === 'mappe' ? 'bSlipMappe' : 'bSlipFlere', null]; tegnBannere(); },
      opdater() { tegnFlade(); tegnBannere(); tegnKommandoer(); },
      filter(id) { st.filter = id === 'dette' ? 'alle' : id; tegnTabel(); },
      nulstilt() { st.resultat = null; st.nr++; st.travl = false; tegn(); },
    };
  })();

  /* Kopiér et filresultat (højst 5 MiB) fra Rust. WebKit vil have, at udklipsholderen skrives i selve klikket: med
     ClipboardItem gives teksten som et løfte, der først opfyldes, når Rust har svaret. Uden ClipboardItem hentes teksten
     først og kopieres som en indsat tekst. Svar: true | false | null (fejlen er vist med vedFejl).
     V-KVIT.1: `hent` er kaldet til Rust, der giver teksten (udeladt: fil_kopi for visningen). */
  async function kopierFraRust(visning, vedFejl, hent) {
    hent = hent || (() => invoke('fil_kopi', { visning }));
    if (window.ClipboardItem && navigator.clipboard && navigator.clipboard.write) {
      try {
        const blob = hent().then(t => new Blob([t], { type: 'text/plain' }));
        await navigator.clipboard.write([new window.ClipboardItem({ 'text/plain': blob })]);
        return true;
      } catch (e) { /* prøv den anden vej; en fejl fra Rust kommer igen dér */ }
    }
    let tekst;
    try { tekst = await hent(); } catch (e) { vedFejl(e); return null; }
    return kopier(tekst);
  }

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
    if (G.laast || fokusIFelt(e) || document.querySelector('dialog[open]')) return;
    const v = G.aktiv;
    if (v !== 'masker' && v !== 'demasker') return;
    const s = e.clipboardData ? e.clipboardData.getData('text/plain') : '';
    e.preventDefault();
    (v === 'masker' ? M : D).modtag(s);
  });

  /* Genveje: ⌘↵ Analysér og derefter Gem og maskér (Demaskér i Demaskér); ⇧⌘C kopiér resultatet. Ctrl på Windows. */
  document.addEventListener('keydown', e => {
    const modTast = G.mac ? e.metaKey && !e.ctrlKey : e.ctrlKey && !e.metaKey;
    if (!modTast || e.altKey || G.laast || document.querySelector('dialog[open]')) return;
    const v = G.aktiv;
    if (v !== 'masker' && v !== 'demasker') return;
    // Ctrl+O og Ctrl+S på Windows (på macOS fanger programmenuen ⌘O og ⌘S og sender hændelsen 'menu').
    if (!G.mac && !e.shiftKey && (e.code === 'KeyO' || e.key === 'o' || e.key === 'O')) { e.preventDefault(); (v === 'masker' ? M : D).aabnFil(); return; }
    if (!G.mac && !e.shiftKey && (e.code === 'KeyS' || e.key === 's' || e.key === 'S')) { e.preventDefault(); if (v === 'masker') M.gemFil(false); else D.gemFil(); return; }
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

  /* Filer fra menuen (Arkiv → Åbn… ⌘O, Gem… ⌘S) og træk og slip (V-FIL.1). Rust sender kun filnavnet eller hvorfor et
     træk blev afvist (flere filer, en mappe). En fil, der slippes uden for Maskér og Demaskér, åbnes i Maskér. */
  function maalVisning() {
    if (G.aktiv === 'demasker') return D;
    if (G.aktiv !== 'masker') G.vis('masker');
    return M;
  }
  /* V-KITBRUG.2 N3 (G8): mens en fil trækkes over vinduet, viser den tomme tilstand det med kittets .tomt-slip (kittet læser
     ingen filer; Rust melder trækket). Står der en tekst (den tomme tilstand er skjult), viser hele fladen det som før. */
  function traek(on) {
    for (const v of ['masker', 'demasker']) {
      const d = G.dele[v], her = on && G.aktiv === v;
      d.tom.classList.toggle('tomt-slip', her && !d.tom.hidden);
      d.flade.toggleAttribute('data-traek', her && d.tom.hidden);
    }
  }
  if (G.tauri && G.tauri.event && G.tauri.event.listen) {
    // V-LAAS.2: låst gør Åbn og Gem fra menuen og træk og slip intet (Rust svarer også `laast`).
    G.tauri.event.listen('menu', e => {
      if (G.laast || document.querySelector('dialog[open]')) return;
      if (e.payload === 'aabn') maalVisning().aabnFil();
      else if (e.payload === 'gem') { if (G.aktiv === 'masker') M.gemFil(false); else if (G.aktiv === 'demasker') D.gemFil(); }
    });
    G.tauri.event.listen('fil-traek', e => traek(e.payload === true && !G.laast));
    G.tauri.event.listen('fil-sluppet', e => {
      traek(false);
      if (G.laast) return;
      const p = e.payload || {};
      const X = maalVisning();
      if (p.fejl) { if (p.fejl !== 'ingen') X.slipAfvist(p.fejl); return; }
      X.aabnSluppet();
    });
  }

  /* Programmenuen følger UI'ets sprog. */
  const menuSprog = () => invoke('menu_sprog', { sprog: S.lang }).catch(() => { /* ingen menu (Windows) */ });
  document.addEventListener('grimnir-sprog', menuSprog);

  M.tegn();
  D.tegn();
  menuSprog();
  window.GrimnirMaskering = { M, D, utf8Laengde, MAKS_BYTES, MAKS_DEMASKER, saetSag, saetGemteSager, kommando, sagFejlTekst, filFejlTekst, banner, get poster() { return poster; } };
})();
