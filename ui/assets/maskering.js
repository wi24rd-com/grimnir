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
  /* V-PUDS.3 N5: linjetallet tælles i webvisningen, så snart teksten er indsat (før stod der "…" til analysen), efter
     samme regel som Rusts fil::antal_linjer (V-RET.1 R3): LF, CRLF og et enligt CR tæller hver som ét linjeskift, plus
     én, hvis teksten ikke slutter med et linjeskift; en tom tekst har 0. \r og \n er ét tegn i både UTF-16 og UTF-8 og
     indgår aldrig i et andet tegn, så tallet er det samme som Rusts. Teksten sendes ingen steder hen. Efter analysen
     (og for en fil) vises Rusts tal som før. tests/ui/ui-roeg.mjs prøver reglen mod tabellen i fil.rs. */
  function antalLinjer(s) {
    if (!s) return 0;
    let n = 0, i = -1;
    while ((i = s.indexOf('\n', i + 1)) !== -1) n++;
    i = -1;
    while ((i = s.indexOf('\r', i + 1)) !== -1) if (s.charCodeAt(i + 1) !== 10) n++;
    const sidste = s.charCodeAt(s.length - 1);
    return n + (sidste === 10 || sidste === 13 ? 0 : 1);
  }
  /* V-PUDS.3 N5: tekstens størrelse i panelhovedet i en enhed, der passer: bytes under 1 kB, hele kB under 0,1 MB og MB
     med én decimal derfra (1 kB = 1024 bytes og 1 MB = 1024 × 1024 bytes, som MAKS_BYTES), med sprogets talformat
     ("0,1 MB" på dansk, "0.1 MB" på engelsk). Før stod der "0.0 MB" for en lille tekst. */
  /* V-MANUEL.1 N5: bruges også i filinfoen og i fejlene om størrelse (før med fast punktum: "105.0 MB" uden sprogets talformat). */
  function stoerrelse(b) {
    const fmt = (n, d) => Number(n).toLocaleString(S.lang === 'en' ? 'en-GB' : 'da-DK', { minimumFractionDigits: d, maximumFractionDigits: d });
    if (b >= 0.1 * 1048576) return S.t('strMB', fmt(b / 1048576, 1));
    if (b >= 1024) return S.t('strKB', fmt(Math.round(b / 1024), 0));
    return S.t('strB', fmt(b, 0));
  }
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
    // V-MANUEL.1: ⇧⌘M Maskér dette, ⌘Z og ⇧⌘Z (Ctrl+Z og Ctrl+Y) Fortryd og Gentag, ⌘G (Ctrl+G) Næste advarsel.
    maskerDette: () => ['genvejTitel', (G.mac ? '⇧⌘' : 'Ctrl+Shift+') + 'M', (G.mac ? 'Meta' : 'Control') + '+Shift+M'],
    fortryd: () => ['genvejTitel', G.mod + 'Z', (G.mac ? 'Meta' : 'Control') + '+Z'],
    gentag: () => (G.mac ? ['genvejTitel', '⇧⌘Z', 'Meta+Shift+Z'] : ['genvejTitel', 'Ctrl+Y', 'Control+Y']),
    naeste: () => ['genvejTitel', G.mod + 'G', (G.mac ? 'Meta' : 'Control') + '+G'],
  };
  const tal = n => Number(n).toLocaleString(S.lang === 'en' ? 'en-GB' : 'da-DK');

  /* En filfejl fra Rust (FilFejl i src-tauri/src/fil.rs: {art, …}) som tekst på det aktuelle sprog. Ingen sti, intet indhold. */
  function filFejlTekst(f) {
    if (!f) return S.t('sagfejl_andet');
    if (f.art === 'tegnsaet') return S.t('ffejl_tegnsaet_' + f.ligner, f.byte != null ? tal(f.byte) : null) || S.t('sagfejl_andet');
    if (f.art === 'for_stor') return S.t('ffejl_for_stor', stoerrelse(f.bytes), stoerrelse(f.maks));
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
    f.filinfo.append(navn, el('span', 'muted', 'filStr', stoerrelse(fil.bytes)), el('span', 'muted', 'ts_' + fil.tegnsaet), el('span', 'muted', 'ls_' + fil.linjeskift));
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

  /* V-OPBYG.1 N2 (D27): status er resultatet. Før maskeringen: Maskeres (afkrydset), Bevares (ikke afkrydset) og Tjek selv
     (et usikkert fund, der ikke er afkrydset; advarslens udseende, !); efter maskeringen: Maskeret og Bevaret. Hvor sikkert
     fundet er (kernens status: Sikker, Fra ordbog, Sandsynlig, Tjek selv, Version, og Tilføjet for brugerens egne), står
     dæmpet ved typen (SIKKERHED) og i kvitteringen som før. */
  const SIKKERHED = { sikker: 'stSikker', ordbog: 'stOrdbog', sandsynlig: 'stSandsynlig', tjek: 'stTjek', version: 'stVersion' };
  const chip = (variant, t, v) => { const c = K.chip(variant, { t }); if (v != null) c.querySelector('.ord').setAttribute('data-v', String(v)); return c; };
  function statusChip(on, usikker, efter) {
    if (efter) return on ? chip('ok', 'stMaskeret') : chip('none', 'stBevaret');
    if (on) return chip('ok', 'stMaskeres');
    return usikker ? chip('warn', 'stTjek') : chip('none', 'stBevares');
  }

  /* V-OPBYG.1 N3 (D27): tre trin øverst i Maskér og Demaskér (en ordnet liste over værktøjslinjen). Det aktuelle trin er
     fremhævet (flade, fed skrift og aria-current="step"), et færdigt har flueben; hvert trin har en skjult tekst ("trin 2
     af 3, aktuelt"). Trinene er vejledning, ikke knapper. saet(nu, gjort) sætter trinnet og de færdige. */
  function trinVej(visning, noegler) {
    const d = G.dele[visning];
    const ol = el('ol', 'trinvej');
    ol.setAttribute('data-t-aria', 'ariaTrin');
    const li = noegler.map((t, i) => {
      const l = el('li');
      const nr = el('span', 'trin-nr');
      nr.setAttribute('aria-hidden', 'true');
      const sr = el('span', 'skjult-tekst', 'trinAf', i + 1, noegler.length);
      l.append(nr, el('span', 'trin-navn', t), sr);
      ol.appendChild(l);
      return { l, nr, sr };
    });
    d.sek.insertBefore(ol, d.sek.firstChild);
    return function saet(nu, gjort) {
      li.forEach((x, i) => {
        const n = i + 1, erNu = n === nu, erGjort = gjort(n);
        x.l.classList.toggle('nu', erNu);
        x.l.classList.toggle('gjort', erGjort);
        if (erNu) x.l.setAttribute('aria-current', 'step'); else x.l.removeAttribute('aria-current');
        x.nr.textContent = erGjort ? '✓' : String(n);
        x.sr.setAttribute('data-t', erNu && erGjort ? 'trinAktueltGjort' : erNu ? 'trinAktuelt' : erGjort ? 'trinGjort' : 'trinAf');
      });
      S.anvend(ol);
    };
  }
  /* Den kommando i båndet, der er næste skridt, er fremhævet (data-naeste: kant, flade og fed skrift i app.css, ikke kun
     farve); id null: ingen. */
  function naeste(visning, id) {
    const bar = G.dele[visning].bar;
    for (const b of bar.rod.querySelectorAll('.cb[data-naeste]')) b.removeAttribute('data-naeste');
    const b = id ? bar.knap(id) : null;
    if (b && b.getAttribute('aria-disabled') !== 'true') b.setAttribute('data-naeste', '');
  }

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
    /* V-MANUEL.1: teksten sættes kun, når den er en anden; ellers ville hver ny tegning (fx når en analyse er færdig)
       fjerne brugerens markering, mens der markeres til Maskér dette. */
    const saet = t => { if (pre.textContent !== t) pre.textContent = t; };
    function vis(s, ikkeVist) {
      if (ikkeVist == null) {
        saet(s.length > MAKS_VIST ? s.slice(0, MAKS_VIST) : s);
        afk.setAttribute('data-t', 'tekstAfkortet');
        afk.removeAttribute('data-v');
        afk.hidden = s.length <= MAKS_VIST;
      } else {
        saet(s);
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
    M.tegnTom();
    M.tegnBannere();
    document.dispatchEvent(new CustomEvent('grimnir-poster', { detail: n }));
  }
  /* V-MANUEL.2 N1: den åbne sag (navn og id fra sager.js) til den tomme flade. Kun navnet, som brugeren selv har skrevet. */
  const sagNu = () => (window.GrimnirSager ? window.GrimnirSager.status : { poster, id: null, navn: null });
  /* V-MANUEL.2 N1: "Vis sagens indhold" fra Maskér og Demaskér: Sager-visningen med den åbne sags poster. */
  const visSagensIndhold = () => { if (window.GrimnirSager) window.GrimnirSager.visIndhold(null); };
  function saetGemteSager(n) { gemteSager = n; D.opdater(); }

  /* ═════════════════════════════ Maskér ═════════════════════════════ */
  const M = (function () {
    // fil: den åbne fil (FilInfo fra Rust) eller null; så er tekst Rusts uddrag, og analyse.side er rækkerne fra Rust.
    // V-MANUEL.1: tilfoejede er brugerens egne værdier ({ vaerdi, art }) fra "Maskér dette"; resultatBrugt: resultatet er
    // kopieret eller gemt (Ryd spørger ellers); meld: den værdi, der lige er tilføjet (meldes, når analysen svarer).
    const st = { tekst: null, bytes: 0, linjer: null, fil: null, analyse: null, fravalgt: new Set(), rort: new Map(), rettelser: new Map(), fejl: new Map(), resultat: null, foerEfter: false, visRester: false, spoergRester: false, filter: 'alle', soeg: '', vist: new Set(), side: SIDE, nr: 0, sideNr: 0, travl: false, venter: null, tilfoejede: [], resultatBrugt: false, meld: null, visNy: null, afviste: new Set() };
    /* V-MANUEL.1 N2: Fortryd og Gentag. Hvert trin er et øjebliksbillede af brugerens valg FØR ændringen (fravalg, rørte
       rækker, rettelser og tilføjede værdier) og hvad der blev gjort ved hvilken værdi (til meldingen). Fortryd lægger
       valgene tilbage og analyserer igen; analysen er den samme for samme valg, så tabellen bliver som før. Kun valg i
       hukommelsen: ikke Gem og maskér (sagen), Demaskér, Sager, Ordbog eller Altid/Aldrig (ordbogen på disk). Historikken
       tømmes ved Gem og maskér, en ny tekst, en åben fil og Ryd. Højst HIST_MAKS trin. */
    const HIST_MAKS = 100;
    const hist = { bag: [], frem: [] };
    let tv, tabelvaert, flere, flereTekst, tekstPanel, tabelPanel, delt;
    const f = byggeFlade('masker', ark => {
      delt = el('div', 'delt');
      tekstPanel = panel('pTekst', 'tekstpanel');
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
    const trin = trinVej('masker', ['trinIndsaet', 'trinGennemgaa', 'trinMaskerKopier']);

    /* V-MANUEL.1 N1: genvejsmenuen ved højreklik på en markering i teksten (og ved Skift+F10 eller menutasten): Maskér dette
       og Kopiér. Uden en markering (eller når Maskér dette ikke kan bruges) kommer webvisningens egen menu. Menuen står i
       tekstpanelet under hovedet: et sted ved musen kræver en placering med inline-stil, som CSP'en og reglen i ui-roeg.mjs
       ikke tillader (kit-ønske G20). Piletaster flytter, Enter vælger, Esc lukker (fokus tilbage i teksten). */
    const menu = el('div', 'genvejsmenu');
    menu.setAttribute('role', 'menu');
    menu.setAttribute('data-t-aria', 'ariaGenvejsmenu');
    menu.hidden = true;
    const menupunkt = (t, genvej, ved) => {
      const b = el('button', 'menupunkt');
      b.type = 'button';
      b.setAttribute('role', 'menuitem');
      b.tabIndex = -1;
      const k = el('kbd');
      k.textContent = genvej;
      b.append(el('span', null, t), k);
      b.addEventListener('click', ved);
      return b;
    };
    const mpMasker = menupunkt('kMaskerDette', (G.mac ? '⇧⌘' : 'Ctrl+Shift+') + 'M', () => { lukMenu(true); maskerDette(); });
    const mpKopier = menupunkt('kKopierMarkering', G.mod + 'C', () => { lukMenu(true); try { document.execCommand('copy'); } catch (e) { /* intet kopieret */ } });
    menu.append(mpMasker, mpKopier);
    tekstPanel.p.appendChild(menu);
    const udenfor = e => { if (!menu.contains(e.target)) lukMenu(false); };
    /* Markeringen, da menuen blev åbnet: fokus flyttes til menuen, og nogle webvisninger (jsdom i testene) rydder så
       markeringen. Lukker menuen med fokus tilbage i teksten (Esc, Maskér dette, Kopiér), lægges markeringen tilbage. */
    let menuOmraade = null;
    function aabnMenu() {
      const sel = document.getSelection ? document.getSelection() : null;
      menuOmraade = sel && sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
      menu.hidden = false;
      S.anvend(menu);
      mpMasker.focus();
      document.addEventListener('mousedown', udenfor, true);
    }
    function lukMenu(fokus) {
      if (menu.hidden) return;
      menu.hidden = true;
      document.removeEventListener('mousedown', udenfor, true);
      if (fokus) {
        tv.pre.focus();
        const sel = document.getSelection ? document.getSelection() : null;
        if (sel && menuOmraade && tv.pre.contains(menuOmraade.startContainer)) { sel.removeAllRanges(); sel.addRange(menuOmraade); }
      }
      menuOmraade = null;
    }
    menu.addEventListener('mousedown', e => e.preventDefault());
    menu.addEventListener('keydown', e => {
      const p = [mpMasker, mpKopier], i = p.indexOf(document.activeElement);
      const ny = { ArrowDown: i + 1, ArrowUp: i - 1 + p.length, Home: 0, End: p.length - 1 }[e.key];
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); lukMenu(true); }
      else if (e.key === 'Tab') lukMenu(false);
      else if (ny != null) { e.preventDefault(); p[ny % p.length].focus(); }
    });
    tv.pre.addEventListener('contextmenu', e => {
      if (kanMarkere()) return;
      e.preventDefault();
      aabnMenu();
    });
    /* V-MANUEL.1 N1: markering med tastaturet. Tekstfeltet kan ikke redigeres, så WebKit flytter ingen markør: Skift +
       piletaster (⌥ et ord ad gangen), Skift + Home/End (linjens start og slutning) udvider markeringen her, fra dér hvor
       den er (eller hvor der er klikket), ellers fra tekstens begyndelse. Uden Skift ruller piletasterne som før. */
    const ORDTEGN = /[\p{L}\p{N}_]/u;
    function flyt(t, p, tast, ord) {
      const linjeStart = q => { let i = q; while (i > 0 && t[i - 1] !== '\n' && t[i - 1] !== '\r') i--; return i; };
      const linjeSlut = q => { let i = q; while (i < t.length && t[i] !== '\n' && t[i] !== '\r') i++; return i; };
      const hoejre = q => (q < t.length ? q + (/[\uD800-\uDBFF]/.test(t[q]) && /[\uDC00-\uDFFF]/.test(t[q + 1] || '') ? 2 : 1) : q);
      const venstre = q => (q > 0 ? q - (/[\uDC00-\uDFFF]/.test(t[q - 1]) && /[\uD800-\uDBFF]/.test(t[q - 2] || '') ? 2 : 1) : q);
      if (tast === 'ArrowRight') {
        if (!ord) return hoejre(p);
        while (p < t.length && !ORDTEGN.test(t[p])) p = hoejre(p);
        while (p < t.length && ORDTEGN.test(t[p])) p = hoejre(p);
        return p;
      }
      if (tast === 'ArrowLeft') {
        if (!ord) return venstre(p);
        while (p > 0 && !ORDTEGN.test(t[p - 1])) p = venstre(p);
        while (p > 0 && ORDTEGN.test(t[p - 1])) p = venstre(p);
        return p;
      }
      if (tast === 'Home') return linjeStart(p);
      if (tast === 'End') return linjeSlut(p);
      const kol = p - linjeStart(p);
      // Op og ned regner kolonnen i UTF-16-enheder; lander de midt i et tegn uden for BMP, går de til tegnets start.
      const hel = q => (q > 0 && /[\uD800-\uDBFF]/.test(t[q - 1]) && /[\uDC00-\uDFFF]/.test(t[q] || '') ? q - 1 : q);
      if (tast === 'ArrowUp') {
        const s0 = linjeStart(p);
        if (s0 === 0) return 0;
        const e1 = s0 - (t[s0 - 1] === '\n' && t[s0 - 2] === '\r' ? 2 : 1), s1 = linjeStart(e1);
        return hel(Math.min(s1 + kol, e1));
      }
      if (tast === 'ArrowDown') {
        const e0 = linjeSlut(p);
        if (e0 >= t.length) return t.length;
        const s1 = e0 + (t[e0] === '\r' && t[e0 + 1] === '\n' ? 2 : 1);
        return hel(Math.min(s1 + kol, linjeSlut(s1)));
      }
      return p;
    }
    tv.pre.addEventListener('keydown', e => {
      if ((e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) && !kanMarkere()) { e.preventDefault(); aabnMenu(); return; }
      if (!e.shiftKey || e.metaKey || e.ctrlKey || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) return;
      const n = tv.pre.firstChild, sel = document.getSelection ? document.getSelection() : null;
      if (!n || n.nodeType !== 3 || !sel) return;
      e.preventDefault();
      const her = sel.rangeCount && sel.anchorNode === n && sel.focusNode === n;
      const a = her ? sel.anchorOffset : 0, p = her ? sel.focusOffset : 0;
      sel.setBaseAndExtent(n, a, n, flyt(n.data, p, e.key, e.altKey));
      tegnMaskerDette();
    });

    function nulstilValg() {
      st.tilfoejede = []; st.resultatBrugt = false; st.meld = null; st.visNy = null; hist.bag = []; hist.frem = []; husket = null; lukMenu();
      // V-MANUEL.2 N3: et afvist forslag til et mønster kommer ikke igen for samme tekst; en ny tekst begynder forfra.
      st.afviste = new Set();
      st.analyse = null; st.fravalgt = new Set(); st.rort = new Map(); st.rettelser = new Map(); st.fejl = new Map(); st.resultat = null;
      st.foerEfter = false; st.visRester = false; st.spoergRester = false; st.vist = new Set(); st.side = SIDE; st.nr++; st.travl = false; st.kopieret = false;
      if (st.venter) { clearTimeout(st.venter); st.venter = null; }
    }

    function modtag(s) {
      f.tomBannere.textContent = '';
      f.bannere.textContent = '';
      if (!s) { banner(st.tekst ? f.bannere : f.tomBannere, 'info', 'bIngenTekst'); return; }
      const bytes = utf8Laengde(s);
      if (bytes > MAKS_BYTES) { banner(st.tekst ? f.bannere : f.tomBannere, 'danger', 'bForStor', stoerrelse(bytes)); return; }
      slipFil();
      nulstilValg();
      st.tekst = s;
      st.bytes = bytes;
      st.linjer = antalLinjer(s);
      tegn();
      tv.pre.focus();
      // V-OPBYG.1 N3 (D27): analysen sker, når teksten sættes ind ("Grimnir arbejder" vises efter et sekund, F4).
      analyser();
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
      // V-OPBYG.1 N3: også en åben fil analyseres med det samme (i Rust; uddraget står allerede i tekstfeltet).
      analyser();
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
        if (navn) st.resultatBrugt = true;
        if (navn) { besked(f, 'bFilGemt'); f.besked.setAttribute('data-v', navn); S.anvend(f.besked); }
      }).catch(e => {
        st.travl = false;
        if (e && e.art === 'rester') st.spoergRester = true; else fejl(e);
      }).then(() => { tegnKommandoer(); tegnChip(); tegnBannere(); });
    }

    function rettelser() { return [...st.rettelser].map(([id, kode]) => ({ id, kode })); }
    /* V-MANUEL.1: de tilføjede værdier, som de sendes til Rust (analyser og gem_og_masker). Svaret siger om hver (samme
       plads): rækken, antallet og hvorfor den evt. er afvist; rækkerne har tilfoejet = pladsen. */
    const tilfoejede = () => st.tilfoejede.map(x => ({ vaerdi: x.vaerdi, art: x.art }));

    /* rens (V-MANUEL.1): efter Fortryd, Gentag, Maskér dette, Fjern og et typeskift kan en række have fået et nyt id (en ny
       værdi kan tage en andens første forekomst); rettelser til rækker, der ikke findes længere, droppes, som i analyserIgen. */
    function analyser(o = {}) {
      if (!st.tekst) return Promise.resolve();
      if (st.venter) { clearTimeout(st.venter); st.venter = null; }
      const nr = ++st.nr;
      const foerste = !st.analyse;
      st.travl = true;
      tegnKommandoer();
      tegnChip();
      const sendt = st.fil ? [] : st.tilfoejede.map(x => ({ ...x }));
      const kald = st.fil
        ? invoke('fil_analyser', { fravalgt: foerste ? null : [...st.fravalgt], rort: null, rettelser: foerste ? null : rettelser(), side: sideValg() }).then(fraFil)
        : invoke('analyser', { tekst: st.tekst, fravalgt: foerste ? null : [...st.fravalgt], rettelser: foerste ? null : rettelser(), tilfoejede: tilfoejede() });
      return kald
        .then(a => {
          if (nr !== st.nr) return;
          st.travl = false;
          a.sendt = sendt;
          if (st.fil) st.fravalgt = new Set(a.fravalgt);
          else if (foerste) st.fravalgt = new Set(a.raekker.filter(r => !r.valgt).map(r => r.id));
          for (const r of a.raekker) if (r.laast) st.fravalgt.delete(r.id);
          if (o.rens) {
            const ukendte = new Set(a.fejl.filter(x => x.fejl === 'ukendt_raekke').map(x => x.id));
            for (const id of ukendte) st.rettelser.delete(id);
            a.fejl = a.fejl.filter(x => !ukendte.has(x.id));
          }
          st.analyse = a;
          st.fejl = new Map(a.fejl.map(x => [x.id, x]));
          const svar = tilfoejedeSvar(a);
          tegn();
          if (svar) meld(...svar);
          if (st.visNy != null) { const id = st.visNy; st.visNy = null; visRaekke(id); }
          if (svar && svar.igen) analyser({ rens: true });
        })
        .catch(e => { if (nr !== st.nr) return; st.travl = false; st.meld = null; fejl(e); tegn(); });
    }
    /* V-MANUEL.1: svaret om de tilføjede værdier. En værdi, Rust afviser (en kode i sagen, "maskér aldrig"), fjernes igen
       med grunden; var den lige tilføjet, fjernes trinnet i historikken også (det er aldrig sket). Svarer med meldingen
       til brugeren ([nøgle, v, w]) og om der skal analyseres igen (uden de afviste). */
    function tilfoejedeSvar(a) {
      const svar = a.tilfoejede || [];
      let ud = null;
      if (st.meld) {
        const x = svar.find((y, i) => a.sendt[i] && a.sendt[i].vaerdi === st.meld.v);
        if (x && x.afvist) ud = ['bAfvist_' + x.afvist, st.meld.v];
        else if (x) ud = [x.antal ? 'bTilfoejet' : 'bTilfoejetNul', st.meld.v, x.antal];
        st.meld = null;
      }
      const afvist = new Set(svar.filter(x => x.afvist && a.sendt[x.nr]).map(x => a.sendt[x.nr].vaerdi));
      if (afvist.size) {
        st.tilfoejede = st.tilfoejede.filter(x => !afvist.has(x.vaerdi));
        const sidst = hist.bag[hist.bag.length - 1];
        if (sidst && sidst.art === 'tilfoej' && afvist.has(sidst.navn.v)) hist.bag.pop();
        ud = ud || ['bAfvist_' + svar.find(x => x.afvist).afvist, [...afvist][0]];
        ud.igen = true;
      }
      return ud;
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
      const sendt = st.tilfoejede.map(x => ({ ...x }));
      return invoke('analyser', { tekst: st.tekst, fravalgt: null, rettelser: ret, tilfoejede: tilfoejede() })
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
          return invoke('analyser', { tekst: st.tekst, fravalgt: [...fra], rettelser: ret2, tilfoejede: tilfoejede() });
        })
        .then(a => {
          if (!a || nr !== st.nr) return;
          st.travl = false;
          a.sendt = sendt;
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
          : await invoke('gem_og_masker', { tekst: st.tekst, fravalgt: [...st.fravalgt], rettelser: rettelser(), tilfoejede: tilfoejede() });
        if (nr !== st.nr) return;
        st.resultat = m; st.foerEfter = true; st.visRester = false; st.spoergRester = false; st.aendretEfter = false; st.travl = false; st.kopieret = false;
        // V-MANUEL.1 N2: sagen er gemt; det kan ikke fortrydes, så historikken tømmes (forklaringen på knappen siger det).
        hist.bag = []; hist.frem = []; st.resultatBrugt = false;
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
        fejlBanner = e && e.art === 'raekker' ? ['bRettelserAfvist', e.fejl.length] : e && e.art === 'for_stor' ? ['bForStor', stoerrelse(e.bytes)] : ['bFejl', null];
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
      tegnTom();
    }
    /* V-MANUEL.2 N1, V-OPBYG.1 N4: uden tekst siger den tomme flade, hvilken sag der er åben (under sætningen, .tomt-sag):
       den midlertidige med skitsens ordlyd, en navngiven med navnet og antallet af gemte erstatninger. Sagens indhold
       åbnes fra venstre side (Gemte erstatninger). */
    const tomSag = d.tom.querySelector('.tomt-sag');
    function tegnTom() {
      const sag = sagNu(), n = poster;
      if (sag.navn) { tomSag.setAttribute('data-t', n > 0 ? 'tomMaskerSagP' : 'tomMaskerSagTomP'); tomSag.setAttribute('data-v', sag.navn); tomSag.setAttribute('data-w', String(n)); }
      else { tomSag.setAttribute('data-t', n > 0 ? 'tomMaskerMidlP' : 'tomMaskerMidlTomP'); tomSag.setAttribute('data-v', String(n)); tomSag.removeAttribute('data-w'); }
      S.anvend(d.tom);
    }
    /* V-MANUEL.2 N3: forslaget til et navnemønster (det første, brugeren ikke har afvist for denne tekst) som et banner over
       tabellen med "Læg i ordbogen" og "Ikke nu" (kittets banner har én handling; "Ikke nu" er kittets knap ved siden af,
       kit-ønske G24). Kun før Gem og maskér. Læg i ordbogen bruger ordbogens egen vej (ordbog.js), der melder ordbogen ændret,
       så teksten analyseres igen med mønsteret. */
    function moensterForslag() {
      if (!st.analyse || st.resultat || !st.analyse.moenstre) return null;
      return st.analyse.moenstre.find(m => !st.afviste.has(m.moenster)) || null;
    }
    function tegnMoenster() {
      const m = moensterForslag();
      if (!m) return;
      const GO = window.GrimnirOrdbog;
      const b = banner(f.bannere, 'info', 'bMoenster', m.navne, {
        t: 'kLaegIOrdbogen',
        ved: () => {
          if (!GO) return;
          st.afviste.add(m.moenster);
          GO.tilfoej('navnemoenster', m.moenster, null).then(() => {
            besked(f, 'bMoensterLagt');
            f.besked.setAttribute('data-v', m.moenster);
            S.anvend(f.besked);
          }).catch(e => {
            st.afviste.delete(m.moenster);
            fejlBanner = ['bMoensterFejl', GO.fejlTekst(e)];
            tegnBannere();
          });
          tegnBannere();
        },
      });
      b.classList.add('moenster-forslag');
      b.querySelector('.ord').setAttribute('data-w', m.moenster);
      const nej = K.knap({ t: 'kIkkeNu', variant: 'ghost', ved: () => { st.afviste.add(m.moenster); tegnBannere(); } });
      nej.classList.add('ikke-nu');
      b.appendChild(nej);
      S.anvend(b);
    }
    /* V-OPBYG.1 N2 (D27): én besked øverst: efter analysen "8 værdier fundet · 6 maskeres · 2 bevares" og hvad brugeren gør
       nu; efter maskeringen "6 værdier maskeret · 2 bevaret" med lækagetjekkets udfald i samme besked (og Gem som sag…, når
       sagen er midlertidig); efter Kopiér, hvor teksten skal hen. Overskriften er fed; teksterne er nøgler, så de følger
       sproget. Lækagetjekkets rester, overløb og fejl vises som før. */
    function antalValgt() {
      const a = st.analyse, side = st.fil && a ? a.side : null;
      const alle = side ? side.antal.alle : a ? a.raekker.length : 0;
      const m = side ? side.valgte : a ? a.raekker.filter(valgt).length : 0;
      const tj = side ? side.antal.status_tjek : a ? a.raekker.filter(x => x.status === 'tjek' && !valgt(x)).length : 0;
      return { alle, m, b: alle - m, tj };
    }
    function opsummering(variant, hoved, tekst, handling) {
      const b = K.banner({ variant, handling });
      b.classList.add('opsummering');
      const ord = b.querySelector('.ord');
      const h = el('b', 'ops-hoved');
      hoved.forEach(([t, v], i) => { if (i) h.append(' · '); h.appendChild(el('span', null, t, v)); });
      ord.append(h, ' ');
      for (const [t, v] of tekst) ord.append(el('span', null, t, v), ' ');
      f.bannere.appendChild(b);
      S.anvend(b);
      return b;
    }
    function tegnBannere() {
      f.bannere.textContent = '';
      // En fejl, før der er en tekst (fx en fil, der ikke kan åbnes), står over den tomme tilstand.
      if (fejlBanner) { if (!st.tekst) f.tomBannere.textContent = ''; banner(st.tekst ? f.bannere : f.tomBannere, 'danger', fejlBanner[0], fejlBanner[1], fejlBanner[2]); fejlBanner = null; }
      const tal = antalValgt(), midl = !sagNu().navn, GS = window.GrimnirSager;
      const gemSom = midl && GS ? { t: 'kGemSomSag', ved: () => GS.gemSomSag() } : null;
      const rester = st.resultat ? st.resultat.rester.reduce((a, r) => a + r.antal, 0) : 0;
      // Efter Kopiér: hvor teksten skal hen. Med rester bliver lækagetjekkets advarsel stående (som før).
      if (st.resultat && st.kopieret && rester === 0) {
        opsummering('ok', [['opsKopieretH', null]], [['opsKopieretP', null]], gemSom);
      } else if (st.resultat) {
        const n = rester;
        const hoved = [['opsMaskeret', tal.m], ['opsBevaret', tal.b]];
        if (n === 0) opsummering('ok', hoved, [['bLaekIngen', null], [midl ? 'opsKopierMidl' : 'opsKopier', null]], gemSom);
        else opsummering('warn', hoved, [['bLaekRester', n]], { t: st.visRester ? 'hVisFund' : 'hVisRester', ved: () => { st.visRester = !st.visRester; tegnBannere(); tegnTabel(); } });
        if (n && st.spoergRester && st.fil) banner(f.bannere, 'warn', 'bGemRester', n, { t: 'kGemAlligevel', ved: () => gemFil(true) });
        if (st.resultat.advarsler.length) banner(f.bannere, 'warn', 'bOverloeb', st.resultat.advarsler.length);
      } else if (st.aendretEfter) {
        banner(f.bannere, 'info', 'bValgAendret');
      } else if (st.analyse && !st.travl) {
        opsummering(tal.tj ? 'warn' : 'info', [['opsFundet', tal.alle], ['opsMaskeres', tal.m], ['opsBevares', tal.b]], tal.tj ? [['opsTjek', tal.tj], ['opsGoerNu', null]] : [['opsGoerNu', null]]);
      }
      if (st.analyse && st.analyse.advarsler.length && !st.resultat) banner(f.bannere, 'warn', 'bOverloeb', st.analyse.advarsler.length);
      tegnMoenster();
    }
    function tegnTekst() {
      const efter = st.foerEfter && st.resultat;
      tv.vis(efter ? st.resultat.maskeret : st.tekst || '', st.fil ? (efter ? st.resultat.ikkeVist : st.fil.ikke_vist) : null);
      // V-MANUEL.2 N1: for en åben fil hedder panelet "Fil · <filnavn>", ikke "Indsat tekst".
      const fil = st.fil && !efter;
      tekstPanel.h.setAttribute('data-t', efter ? 'pMaskeret' : fil ? 'pFil' : 'pTekst');
      tekstPanel.p.setAttribute('data-t-aria', efter ? 'pMaskeret' : fil ? 'ariaFilPanel' : 'pTekst');
      for (const e of [tekstPanel.h, tekstPanel.p]) { if (fil) e.setAttribute('data-v', st.fil.navn); else e.removeAttribute('data-v'); }
      tv.pre.setAttribute('data-t-aria', efter ? 'ariaMaskeret' : 'ariaTekst');
      tegnInfo();
      G.dele.masker.bar.knap('foer-efter').setAttribute('aria-pressed', String(Boolean(efter)));
    }
    /* Panelhovedet: linjer og størrelse. V-PUDS.3 N5: før analysen webvisningens tal (samme regel som Rust), derefter
       Rusts; for en fil Rusts med det samme. Kaldes også ved sprogskift (talformatet). */
    function tegnInfo() {
      tekstPanel.info.setAttribute('data-t', 'tekstInfo');
      // V-MANUEL.1 N5: linjetallet med sprogets tusindtalsskille ("162.361 linjer"; ental kun ved præcis "1").
      tekstPanel.info.setAttribute('data-v', st.fil ? tal(st.fil.linjer) : st.analyse ? tal(st.analyse.linjer) : st.linjer != null ? tal(st.linjer) : '…');
      tekstPanel.info.setAttribute('data-w', stoerrelse(st.bytes));
      S.anvend(tekstPanel.p);
    }

    function valgt(r) { return r.laast || !st.fravalgt.has(r.id); }
    function filtrerede() {
      if (!st.analyse) return [];
      if (st.fil) return st.analyse.raekker; // Rust har filtreret og søgt (fil_raekker)
      let r = st.analyse.raekker;
      if (st.filter === 'masker') r = r.filter(valgt);
      else if (st.filter === 'bevar') r = r.filter(x => !valgt(x));
      else if (st.filter === 'tjek') r = r.filter(x => x.status === 'tjek' || st.fejl.has(x.id));
      else if (st.filter === 'hemmelig') r = r.filter(x => x.hemmelig);
      else if (st.filter === 'seneste') r = r.filter(x => x.kendt);
      const q = st.soeg.trim().toLowerCase();
      if (q) r = r.filter(x => x.koder.some(k => k.toLowerCase().includes(q)) || ((!x.hemmelig || st.vist.has(x.id)) && x.vaerdier.some(v => v.toLowerCase().includes(q))));
      return r;
    }

    function vaerdiCelle(r, tf) {
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
      // V-MANUEL.1: en tilføjet værdi, der ikke står som et helt ord nogen steder, eller som er meget kort, advarer i rækken.
      const adv = tf && r.nul ? el('span', 'raekkeadv', 'advNulSteder') : tf && [...tf.vaerdi].length < 3 ? el('span', 'raekkeadv', 'advKort', r.antal) : null;
      if (adv) { c.classList.add('med-adv'); c.appendChild(adv); }
      return c;
    }
    function erstatningCelle(r, on) {
      // V-OPBYG.1 N2: en værdi, der bevares, har ingen kode: der står "bevares som den er" (ikke en grå kode).
      if (!on) return el('span', 'erstatning bevares', 'bevaresSomDen');
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
          husk('kode', navnAf(r));
          st.rettelser.delete(r.id);
        } else if (st.rettelser.get(r.id) === v) {
          return;
        } else {
          husk('kode', navnAf(r));
          st.rettelser.set(r.id, v);
        }
        st.fejl.delete(r.id);
        aendret();
      });
      return c;
    }

    /* Rækkens vej til ordbogen (O4): "Altid" og "Aldrig". Nedtonet med forklaring for hemmeligheder, når ordbogen ikke kan
       åbnes, og ("Altid") for arter, ordbogen ikke har en type til. */
    function ordbogCelle(r, tf) {
      const c = el('span', 'ordbogknapper');
      const GO = window.GrimnirOrdbog;
      // V-MANUEL.1: en tilføjet række har Altid (brugeren lægger selv værdien i ordbogen) og Fjern i stedet for Aldrig:
      // en værdi, brugeren selv har bedt om at maskere, fjernes i stedet for at lægges på "maskér aldrig".
      for (const hvad of tf ? ['altid', 'fjern'] : ['altid', 'aldrig']) {
        if (hvad === 'fjern') {
          const b = el('button', 'mini ikonknap fjern');
          b.type = 'button';
          b.append(K.ikon('luk', 'ik'), el('span', 'skjult-tekst', 'kFjern'));
          b.setAttribute('data-t-title', 'kFjernTitel');
          b.setAttribute('data-felt', 'fjern');
          b.setAttribute('data-t-aria', 'ariaFjern');
          b.setAttribute('data-v', tf.vaerdi);
          b.addEventListener('click', () => fjernTilfoejet(tf.vaerdi));
          c.appendChild(b);
          continue;
        }
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
      const tf = tilfoejetAf(r);
      // "Maskér altid": rækken skal maskeres efter den nye analyse (valget huskes, før ordbogen melder sig ændret).
      const foer = st.rort.has(r.id) ? st.rort.get(r.id) : undefined;
      if (hvad === 'altid') st.rort.set(r.id, true);
      const tilbage = () => { if (foer === undefined) st.rort.delete(r.id); else st.rort.set(r.id, foer); };
      GO.fraMasker(r, hvad).then(aendret => {
        if (!aendret) { tilbage(); return; }
        // V-MANUEL.1: en tilføjet værdi, der nu står i ordbogen, er ikke længere brugerens egen i denne tekst: ordbogen
        // finder den (med ordbogens type). Ikke et trin i historikken (ordbogen er på disk).
        if (tf) { st.tilfoejede = st.tilfoejede.filter(x => x.vaerdi.toLowerCase() !== tf.vaerdi.toLowerCase()); analyserIgen(); }
        besked(f, hvad === 'altid' ? 'bLagtAltid' : 'bLagtAldrig');
        f.besked.setAttribute('data-v', r.vaerdier[0]);
        S.anvend(f.besked);
      }).catch(e => {
        tilbage();
        fejlBanner = ['bOrdbogFejl', GO.fejlTekst(e)];
        tegnBannere();
      });
    }

    /* ═════ V-MANUEL.1 N1: Maskér dette ═════
       Brugeren markerer en værdi i den indsatte tekst (mus, eller Skift + piletaster i tekstfeltet) og vælger Maskér dette
       (båndet, genvejsmenuen ved højreklik eller ⇧⌘M / Ctrl+Shift+M). Værdien sendes til Rust med hver analyse og
       maskering (tilfoejede()); kernen finder den alle steder, hvor den står som et helt ord (samme grænseregel og samme
       store/små-regel som ordbogens ord). Den står som en ny række med en valgliste for typen, status "Tilføjet", Altid
       og Fjern. Den gemmes ikke i ordbogen (det gør Altid); Gem og maskér lægger den i sagen som ethvert andet fund. */
    const TYPER = ['ord', 'bruger', 'vaert', 'domaene', 'person'];
    /* Den tilføjede værdi bag en række ({ vaerdi, art }) eller null. Rækkens tilfoejet er pladsen i listen, analysen fik
       (a.sendt); typen tages fra den aktuelle liste (den kan være skiftet, før analysen svarer). */
    function tilfoejetAf(r) {
      if (r.nul) return r.tf;
      const a = st.analyse;
      if (r.tilfoejet == null || !a || !a.sendt || !a.sendt[r.tilfoejet]) return null;
      const v = a.sendt[r.tilfoejet].vaerdi;
      return st.tilfoejede.find(x => x.vaerdi === v) || null;
    }
    /* Tilføjede værdier, der ikke står som et helt ord nogen steder i teksten: rækker uden forekomster (0), med advarsel. */
    function nulRaekker() {
      const a = st.analyse;
      if (!a || st.fil || st.filter !== 'alle' || !a.tilfoejede || !a.sendt) return [];
      const q = st.soeg.trim().toLowerCase();
      const ud = [];
      for (const x of a.tilfoejede) {
        if (x.raekke != null || x.afvist || !a.sendt[x.nr]) continue;
        const i = st.tilfoejede.findIndex(y => y.vaerdi === a.sendt[x.nr].vaerdi);
        if (i < 0) continue;
        const tf = st.tilfoejede[i];
        if (q && !tf.vaerdi.toLowerCase().includes(q)) continue;
        ud.push({ id: 't' + i, nul: true, tf, art: tf.art, status: 'sikker', standard: true, valgt: false, laast: false, hemmelig: false, vaerdier: [tf.vaerdi], koder: [], antal: 0, linje: 0, rettet: false, kendt: false, tilfoejet: null });
      }
      return ud;
    }
    function typeValg(tf) {
      const v = K.valgliste({ etiket: null, ariaT: 'ariaTypeFor', valg: TYPER.map(id => ({ id, t: 'art_' + id })), valgt: tf.art });
      v.rod.classList.add('typevalg');
      v.select.setAttribute('data-v', tf.vaerdi);
      v.select.setAttribute('data-felt', 'type');
      v.select.setAttribute('data-t-title', 'titelType');
      v.select.addEventListener('change', () => skiftType(tf.vaerdi, v.select.value));
      return v.rod;
    }
    /* Navnet på en række i en melding: værdien, eller linjen for en hemmelighed (som aria-label). */
    const navnAf = r => (r.hemmelig ? { v: r.linje, h: true } : { v: r.vaerdier[0] });
    /* Markeringen i tekstfeltet (kun når den ligger helt i det), ellers den seneste markering, der var der (husket), ellers ''.
       Målt i WKWebView (V-MANUEL.1): fokus på en knap rydder dokumentets markering. Går brugeren med Tab fra teksten til
       båndets Maskér dette, er markeringen derfor væk, når knappen trykkes; den huskes her, til brugeren markerer igen,
       klikker i teksten (en tom markering i den) eller får en ny tekst. Bruges den huskede, lægges den tilbage i teksten
       (maskerDette), så brugeren ser, hvad der tilføjes. */
    let husket = null;
    const iTeksten = r => tv.pre.contains(r.startContainer) && tv.pre.contains(r.endContainer);
    function markering() {
      const sel = document.getSelection ? document.getSelection() : null;
      if (sel && sel.rangeCount && !sel.isCollapsed && iTeksten(sel.getRangeAt(0))) return sel.toString();
      if (sel && sel.rangeCount && tv.pre.contains(sel.anchorNode)) return '';
      return husket && iTeksten(husket) ? husket.toString() : '';
    }
    function markeringAendret() {
      const sel = document.getSelection ? document.getSelection() : null;
      if (sel && sel.rangeCount && tv.pre.contains(sel.anchorNode)) husket = sel.isCollapsed ? null : sel.getRangeAt(0).cloneRange();
      tegnMaskerDette();
    }
    /* Lægger den huskede markering tilbage i teksten, når dokumentets markering ikke længere står der. */
    function gendanMarkering() {
      const sel = document.getSelection ? document.getSelection() : null;
      if (!sel || !husket || !iTeksten(husket)) return;
      if (sel.rangeCount && !sel.isCollapsed && iTeksten(sel.getRangeAt(0))) return;
      sel.removeAllRanges();
      sel.addRange(husket.cloneRange());
    }
    /* Hvorfor Maskér dette ikke kan bruges (nøglen til forklaringen), eller null. */
    function kanMarkere() {
      if (!st.tekst) return 'hvorforIndsaetFoerst';
      if (st.fil) return 'hvorforKunIndsat';
      if (st.foerEfter && st.resultat) return 'hvorforVisTeksten';
      if (markering() === '') return 'hvorforMarker';
      return null;
    }
    function meld(t, v, w) {
      besked(f, t);
      for (const [a, x] of [['data-v', v], ['data-w', w]]) { if (x != null) f.besked.setAttribute(a, String(x)); else f.besked.removeAttribute(a); }
      S.anvend(f.besked);
    }
    /* Regler (V-MANUEL.1 Fase A): mellemrum i enderne skæres af; tom og linjeskift afvises med en forklaring; en værdi, der
       er præcis et eksisterende fund (uden hensyn til store/små), vælger den række (og slår den til) i stedet for at lave en
       ny; en af sagens koder (en låst række) afvises; alt andet tilføjes som Ord. Overlap, "maskér aldrig" og sagens koder,
       der ikke står i tabellen, afgør Rust (svaret i tilfoejedeSvar). */
    function maskerDette() {
      const hvorfor = kanMarkere();
      lukMenu(false);
      if (hvorfor) return meld(hvorfor);
      gendanMarkering();
      const v = markering().trim();
      if (!v) return meld('bMarkeringTom');
      if (/[\r\n]/.test(v)) return meld('bMarkeringLinjer');
      const lv = v.toLowerCase();
      const i = st.tilfoejede.findIndex(x => x.vaerdi.toLowerCase() === lv);
      if (i >= 0) { visRaekke(st.tilfoejede[i].vaerdi); return meld('bAlleredeTilfoejet', v); }
      const r = st.analyse ? st.analyse.raekker.find(x => x.vaerdier.some(y => y.toLowerCase() === lv)) : null;
      if (r && !tilfoejetAf(r)) {
        if (r.laast) return meld('bErKode', v);
        if (!valgt(r)) { husk('valg', navnAf(r)); st.fravalgt.delete(r.id); st.rort.set(r.id, true); st.visNy = r.id; aendretNu(); }
        visRaekke(r.id);
        return meld('bFindesAllerede', r.hemmelig ? S.t('linjeNr', r.linje) : v);
      }
      husk('tilfoej', { v });
      st.tilfoejede.push({ vaerdi: v, art: 'ord' });
      st.meld = { v };
      st.visNy = v;
      aendretNu();
    }
    /* Rækkens id for en tilføjet værdi (et tal fra Rust, eller 't<plads>' for en række uden forekomster). */
    function raekkeIdFor(vaerdi) {
      const r = st.analyse && st.analyse.raekker.find(x => { const tf = tilfoejetAf(x); return tf && tf.vaerdi === vaerdi; });
      if (r) return r.id;
      const i = st.tilfoejede.findIndex(x => x.vaerdi === vaerdi);
      return i >= 0 ? 't' + i : null;
    }
    /* Vælger en række (kittets valg i tabellen) og ruller den frem. id: rækkens id eller en tilføjet værdi. Fokus bliver,
       hvor det er (i teksten), så brugeren kan markere den næste; meldingen er høflig (role="status"). */
    function visRaekke(id) {
      if (typeof id === 'string' && !/^t\d+$/.test(id)) id = raekkeIdFor(id);
      if (id == null) return;
      const find = () => tabelvaert.querySelector(`tr[data-id="${id}"]`);
      if (!find() && (st.filter !== 'alle' || st.soeg)) { st.soeg = ''; d.soeg.value = ''; G.dele.masker.trae.vaelg('alle'); tegnTabel(); }
      if (!find() && typeof id === 'number') {
        const i = filtrerede().findIndex(x => x.id === id);
        if (i >= st.side) { st.side = Math.ceil((i + 1) / SIDE) * SIDE; tegnTabel(); }
      }
      const tr = find();
      if (!tr) return;
      const t = tr.closest('table');
      t.vaelg([...t.querySelectorAll('tbody tr')].indexOf(tr));
      if (tr.scrollIntoView) tr.scrollIntoView({ block: 'nearest' });
    }
    function skiftType(vaerdi, art) {
      const x = st.tilfoejede.find(y => y.vaerdi === vaerdi);
      if (!x || x.art === art || !TYPER.includes(art)) return;
      husk('type', { v: vaerdi });
      x.art = art;
      aendretNu();
    }
    function fjernTilfoejet(vaerdi) {
      const i = st.tilfoejede.findIndex(y => y.vaerdi === vaerdi);
      if (i < 0) return;
      husk('fjern', { v: vaerdi });
      const id = raekkeIdFor(vaerdi);
      if (typeof id === 'number') { st.fravalgt.delete(id); st.rort.delete(id); st.rettelser.delete(id); st.fejl.delete(id); }
      st.tilfoejede.splice(i, 1);
      meld('bFjernet', vaerdi);
      aendretNu();
      tv.pre.focus();
    }
    /* Et valg er ændret, og analysen skal med det samme (ikke efter 350 ms som ved en afkrydsning). */
    function aendretNu() {
      if (st.resultat) { st.resultat = null; st.foerEfter = false; st.visRester = false; st.aendretEfter = true; }
      tegnBannere(); tegnTekst(); tegnTabel(); tegnChip(); tegnFod();
      analyser({ rens: true });
    }

    /* ═════ V-MANUEL.1 N2: Fortryd og Gentag ═════ */
    const snap = () => ({ fravalgt: [...st.fravalgt], rort: [...st.rort], rettelser: [...st.rettelser], tilfoejede: st.tilfoejede.map(x => ({ ...x })) });
    /* Kaldes FØR et valg ændres: art er valg | kode | type | tilfoej | fjern, navn er { v, h } til meldingen. */
    function husk(art, navn) {
      hist.bag.push({ art, navn, s: snap() });
      if (hist.bag.length > HIST_MAKS) hist.bag.shift();
      hist.frem = [];
    }
    function skift(fra, til, hvad) {
      if (!st.tekst || !fra.length) return false;
      const e = fra.pop();
      til.push({ art: e.art, navn: e.navn, s: snap() });
      st.fravalgt = new Set(e.s.fravalgt); st.rort = new Map(e.s.rort); st.rettelser = new Map(e.s.rettelser);
      st.tilfoejede = e.s.tilfoejede.map(x => ({ ...x })); st.fejl = new Map();
      meld(hvad + '_' + e.art, e.navn.h ? S.t('linjeNr', e.navn.v) : e.navn.v);
      aendretNu();
      return true;
    }
    const fortryd = () => skift(hist.bag, hist.frem, 'fortrudt');
    const gentag = () => skift(hist.frem, hist.bag, 'gentaget');

    /* ═════ V-MANUEL.1 N3: Ryd ═════ Tømmer teksten, fundene, de tilføjede værdier og resultatet og går tilbage til den
       tomme flade; en åben fil slippes (Rust nulstiller den). Sagen og dens koder røres ikke. Er der valg (rettelser,
       fravalg, tilføjede værdier) eller et resultat, der hverken er kopieret eller gemt, spørges der først (kittets
       bekræftelse, fokus på Annullér). Svarer med true, når der er ryddet. */
    function harValg() {
      if (st.rettelser.size || st.tilfoejede.length) return true;
      if (st.fil) return st.rort.size > 0;
      return Boolean(st.analyse) && st.analyse.raekker.some(r => !r.laast && valgt(r) !== r.standard);
    }
    function ryd() {
      if (!st.tekst || st.travl) return Promise.resolve(false);
      const valg = harValg(), res = Boolean(st.resultat) && !st.resultatBrugt;
      const goer = () => {
        slipFil();
        nulstilValg();
        st.tekst = null; st.bytes = 0; st.linjer = null; fejlBanner = null;
        f.besked.textContent = ''; f.bannere.textContent = ''; f.tomBannere.textContent = '';
        const sel = document.getSelection ? document.getSelection() : null;
        if (sel && sel.rangeCount && tv.pre.contains(sel.anchorNode)) sel.removeAllRanges();
        tegn();
        d.tom.focus();
        return true;
      };
      if (!valg && !res) return Promise.resolve(goer());
      return G.bekraeft({
        t: 'rydH', p: { t: valg && res ? 'rydPBegge' : res ? 'rydPResultat' : 'rydPValg' }, nej: { t: 'annuller' }, ja: { t: 'kRydOk' }, farlig: true,
        udfyld: rod => { rod.id = 'dlg-ryd'; S.anvend(rod); },
      }).then(ja => (ja ? goer() : false));
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
      // V-MANUEL.1: tilføjede værdier, der ikke står nogen steder som et helt ord, står til sidst (kun under Alle fund).
      const vis = (st.fil ? alle : alle.slice(0, st.side)).concat(nulRaekker());
      // En fil: tallene er over alle rækker i Rust (side.i_alt, side.antal, side.valgte).
      const side = st.fil ? st.analyse.side : null;
      const iAlt = side ? side.i_alt : alle.length;
      const t = K.tabel({
        ariaT: 'pFund',
        kolonner: [{ t: 'kolMasker' }, { t: 'kolType' }, { t: 'kolVaerdi' }, { t: 'kolErstatning' }, { t: 'kolAntal', tal: true }, { t: 'kolStatus' }, { t: 'kolOrdbog' }],
        raekker: vis.map(r => {
          const tf = tilfoejetAf(r);
          const on = !r.nul && valgt(r);
          // V-KITBRUG.2 N3 (G7): kittets afkrydsning uden synlig tekst (boksen alene, 16 px); rækken er det synlige navn,
          // og navnet står i aria-label ("Maskér 192.0.2.17"; en hemmelighed nævnes ved linjen, ikke ved værdien).
          const cb = K.afkrydsning({ ariaT: r.hemmelig ? 'ariaMaskerHemmelig' : 'ariaMasker', ariaV: r.hemmelig ? String(r.linje) : r.vaerdier[0], valgt: on, deaktiveret: r.laast || r.nul }).input;
          cb.setAttribute('data-felt', 'valg');
          if (r.laast) cb.setAttribute('data-t-title', 'hvorforRaekkeLaast');
          if (r.nul) cb.setAttribute('data-t-title', 'hvorforNulSteder');
          // V-OPBYG.1 N2: status og erstatning følger afkrydsningen med det samme (analysen kommer 350 ms efter).
          let status = statusChip(on, r.status === 'tjek' && !r.nul, Boolean(st.resultat)), erst;
          cb.addEventListener('change', () => {
            husk('valg', navnAf(r));
            if (cb.checked) st.fravalgt.delete(r.id); else st.fravalgt.add(r.id);
            st.rort.set(r.id, cb.checked);
            const tr = cb.closest('tr');
            tr.classList.toggle('fra', !cb.checked);
            const ny = statusChip(cb.checked, r.status === 'tjek', false), nyErst = erstatningCelle(r, cb.checked);
            status.replaceWith(ny);
            erst.replaceWith(nyErst);
            status = ny; erst = nyErst;
            S.anvend(tr);
            aendret();
            tegnTrae();
          });
          // V-MANUEL.1: en tilføjet række har en valgliste med typen. V-OPBYG.1 N2: hvor sikkert fundet er (Sikker, Fra ordbog,
          // Sandsynlig, Tjek selv, Version; Tilføjet for brugerens egne) står dæmpet efter typen (ord, ikke kun farve).
          const type = el('span', 'typecelle');
          type.append(tf ? typeValg(tf) : el('span', null, 'art_' + r.art), ' ', el('span', 'sikkerhed', tf ? 'stTilfoejet' : SIKKERHED[r.status] || 'stTjek'));
          erst = r.nul ? el('span', 'muted ingen-kode') : erstatningCelle(r, on);
          if (r.nul) erst.textContent = '—';
          return { celler: [cb, type, vaerdiCelle(r, tf), erst, String(r.antal), status, ordbogCelle(r, tf)], data: r.id, fra: !on };
        }),
      });
      t.classList.add('fundtabel');
      const tr = [...t.querySelectorAll('tbody tr')];
      vis.forEach((r, i) => { tr[i].setAttribute('data-id', String(r.id)); if (r.nul || !valgt(r)) tr[i].classList.add('fra'); if (tilfoejetAf(r)) tr[i].classList.add('tilfoejet'); });
      tabelvaert.appendChild(t);
      // V-MANUEL.2: et tomt "Kendt fra sagen" siger, hvad filteret er.
      if (!vis.length) tabelvaert.appendChild(el('p', 'tabel-tom', !(side ? side.antal.alle : st.analyse.raekker.length) ? 'ingenFund' : st.filter === 'seneste' && !st.soeg.trim() ? 'ingenKendtFraSagen' : 'ingenIFilter'));
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
          return { celler: [chip('warn', 'rest_' + r.art), el('span', null, 'art_' + r.type_), tekst, String(r.antal), tal(r.linje)], data: r.linje };
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
    /* V-OPBYG.1 N2: filtrene Maskeres/Maskerede og Bevares/Bevarede (ordene skifter efter maskeringen) med tal; for en fil
       tæller Rust (side.valgte). */
    function tegnTrae() {
      const r = st.analyse ? st.analyse.raekker : [];
      const ant = st.fil
        ? (st.analyse ? { ...st.analyse.side.antal, masker: st.analyse.side.valgte, bevar: st.analyse.side.antal.alle - st.analyse.side.valgte } : { alle: 0, masker: 0, bevar: 0, tjek: 0, hemmelig: 0, seneste: 0 })
        : { alle: r.length, masker: r.filter(valgt).length, bevar: r.filter(x => !valgt(x)).length, tjek: r.filter(x => x.status === 'tjek' || st.fejl.has(x.id)).length, hemmelig: r.filter(x => x.hemmelig).length, seneste: r.filter(x => x.kendt).length };
      for (const id of ['alle', 'masker', 'bevar', 'tjek', 'hemmelig', 'seneste']) {
        const n = ant[id];
        const a = d.nd.querySelector(`[data-punkt="${id}"] .ant`);
        if (a) a.textContent = String(n);
      }
      const efter = Boolean(st.resultat);
      for (const [id, foer, eft] of [['masker', 'tMaskeres', 'tMaskerede'], ['bevar', 'tBevares', 'tBevarede']]) {
        const t = d.nd.querySelector(`[data-punkt="${id}"] [data-t]`);
        if (t) t.setAttribute('data-t', efter ? eft : foer);
      }
      S.anvend(d.nd);
    }
    function tegnMaskerDette() { const h = kanMarkere(); kommando('masker', 'masker-dette', !h, h, GV.maskerDette()); }
    function tegnKommandoer() {
      const v = 'masker', t = st.travl, res = st.resultat;
      kommando(v, 'aabn-fil', !t, 'hvorforVent', GV.aabn());
      // V-MANUEL.1: Ryd, Fortryd, Gentag og Maskér dette.
      kommando(v, 'ryd', Boolean(st.tekst) && !t, st.tekst ? 'hvorforVent' : 'hvorforIndsaetFoerst');
      kommando(v, 'fortryd', Boolean(st.tekst) && hist.bag.length > 0, st.tekst ? 'hvorforIntetFortryd' : 'hvorforIndsaetFoerst', GV.fortryd());
      kommando(v, 'gentag', Boolean(st.tekst) && hist.frem.length > 0, st.tekst ? 'hvorforIntetGentag' : 'hvorforIndsaetFoerst', GV.gentag());
      tegnMaskerDette();
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
      tegnTrin();
    }
    /* V-OPBYG.1 N3: trin 1 uden tekst (næste: Indsæt), trin 2 med en tekst (næste: Maskér, når analysen er der), trin 3
       med et resultat (næste: Kopiér maskeret tekst; færdigt, når resultatet er kopieret eller gemt). */
    function tegnTrin() {
      const res = st.resultat, nu = !st.tekst ? 1 : res ? 3 : 2;
      trin(nu, n => n < nu || (n === 3 && Boolean(res) && st.resultatBrugt));
      naeste('masker', nu === 1 ? 'indsaet' : nu === 2 ? (st.analyse && !st.travl ? 'gem-masker' : null) : st.resultatBrugt ? null : 'kopier');
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
    G.haandter('masker', 'masker-dette', () => maskerDette());
    G.haandter('masker', 'fortryd', () => fortryd());
    G.haandter('masker', 'gentag', () => gentag());
    G.haandter('masker', 'ryd', () => ryd());
    G.haandter('masker', 'tom-anden', () => visSagensIndhold());
    /* Båndets Maskér dette må ikke tage markeringen eller fokus fra teksten ved musetrykket (klikket virker som før). */
    G.dele.masker.bar.knap('masker-dette').addEventListener('mousedown', e => e.preventDefault());
    d.soeg.addEventListener('input', () => { st.soeg = d.soeg.value; st.side = SIDE; if (st.fil) hentSide(); else tegnTabel(); });
    async function kopierResultat() {
      if (!st.resultat || st.travl) return;
      if (st.resultat.fil && !st.resultat.kopierbar) { fejlBanner = ['bKopiForStor', null]; tegnBannere(); return; }
      const ok = st.resultat.fil ? await kopierFraRust('masker', e => { fejl(e); tegnBannere(); }) : await kopier(st.resultat.maskeret);
      if (ok === true) { st.resultatBrugt = true; st.kopieret = true; tegnBannere(); tegnKommandoer(); }
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
      st, modtag, analyser, analyserIgen, gem, kopierResultat, kopierKvittering, tegn, tegnFod, tegnTabel, tegnInfo, tegnBannere,
      genvejEnter() { return st.analyse ? gem() : analyser(); },
      filter(id) { st.filter = id === 'denne' ? 'alle' : id; st.visRester = false; st.side = SIDE; if (st.fil) hentSide(); else tegnTabel(); tegnBannere(); },
      aabnFil, gemFil, modtagFil,
      aabnSluppet() { return aabnFil('fil_aabn_sluppet'); },
      slipAfvist(art) { fejlBanner = [art === 'mappe' ? 'bSlipMappe' : 'bSlipFlere', null]; tegnBannere(); },
      nulstilt() { if (st.tekst) { nulstilValg(); tegn(); } },
      // V-MANUEL.1
      hist, maskerDette, fortryd, gentag, ryd, kanMarkere, markering, markeringAendret, tegnMaskerDette, flyt, menu,
      tegnFilinfo() { tegnFilinfo(f, st.fil); },
      lukMenu,
      // V-MANUEL.2
      tegnTom, moensterForslag,
    };
  })();

  /* ═════════════════════════════ Demaskér ═════════════════════════════ */
  const D = (function () {
    // V-MANUEL.1: resultatBrugt (kopieret eller gemt; Ryd spørger ellers), adv (Næste advarsel: pladsen i advarslerne).
    const st = { tekst: null, bytes: 0, linjer: null, fil: null, resultat: null, filter: 'alle', soeg: '', nr: 0, travl: false, resultatBrugt: false, adv: -1 };
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
    const trin = trinVej('demasker', ['trinIndsaetSvar', 'trinDemasker', 'trinKopierResultat']);
    // Den tomme tilstand peger på Sager, når den aktuelle sag er tom, og der findes gemte sager (V-SAG.1). V-OPBYG.1 N3: en
    // knap under linjen om ⌘V (app.js, .tomt-ekstra); Indsæt svar og Åbn fil er kittets to handlinger.
    const tilSager = d.tom.querySelector('.tomt-ekstra');
    const tomSag = d.tom.querySelector('.tomt-sag');

    function modtag(s) {
      f.tomBannere.textContent = '';
      f.bannere.textContent = '';
      if (!s) { banner(st.tekst ? f.bannere : f.tomBannere, 'info', 'bIngenTekst'); return; }
      const bytes = utf8Laengde(s);
      if (bytes > MAKS_DEMASKER) { banner(st.tekst ? f.bannere : f.tomBannere, 'danger', 'bForStorDemasker', stoerrelse(bytes)); return; }
      slipFil();
      st.tekst = s; st.bytes = bytes; st.linjer = antalLinjer(s); st.resultat = null; st.nr++; st.travl = false; st.resultatBrugt = false; st.adv = -1;
      tegn();
      svar.pre.focus();
    }
    let fejlBanner = null;
    function fejl(e) {
      fejlBanner = e && e.art === 'for_stor' ? ['bForStorDemasker', stoerrelse(e.bytes)]
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
        st.travl = false; st.resultat = r; st.resultatBrugt = false; st.adv = -1; tegn();
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
      st.fil = info; st.tekst = info.uddrag; st.bytes = info.bytes; st.resultat = null; st.nr++; st.travl = false; st.resultatBrugt = false; st.adv = -1;
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
        if (navn) st.resultatBrugt = true;
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
      // V-OPBYG.1 N3 (skitsen): sætningen nævner sagen ("den midlertidige sag" eller "sagen «navn»"); uden koder i sagen
      // siger den, hvad der mangler, som før. Under den: "Svaret bliver på denne maskine."
      const sag = sagNu();
      d.tomP.setAttribute('data-t', poster > 0 ? (sag.navn ? 'tomDemaskerSagP' : 'tomDemaskerP') : gemteSager > 0 ? 'tomDemaskerAabnSagP' : 'tomDemaskerTomSagP');
      if (sag.navn) d.tomP.setAttribute('data-v', sag.navn); else d.tomP.removeAttribute('data-v');
      tomSag.setAttribute('data-t', 'tomDemaskerLokalt');
      S.anvend(d.tom);
      // "Åbn Sager", når sagen ingen koder har, og der er gemte sager.
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
    function filter(id) { st.filter = id === 'dette' ? 'alle' : id; tegnTabel(); }
    function tegnTekst() {
      svar.vis(st.tekst || '', st.fil ? st.fil.ikke_vist : null);
      ud.vis(st.resultat ? st.resultat.tekst : '', st.fil && st.resultat ? st.resultat.ikkeVist : null);
      udPanel.info.setAttribute('data-t', st.resultat ? 'blivPaaMaskinen' : 'tryk');
      udPanel.info.setAttribute('data-v', G.mod + '↵');
      tegnInfo();
      S.anvend(udPanel.p);
    }
    /* Svarets panelhoved: linjer og størrelse (kaldes også ved sprogskift). */
    function tegnInfo() {
      svarPanel.info.setAttribute('data-t', 'tekstInfo');
      // V-RET.1 R3: linjetallet efter Rusts regel (fil::antal_linjer), som i Maskér: for en fil Rusts med det samme, for en
      // indsat tekst Rusts efter demaskeringen. V-PUDS.3 N5: indtil da webvisningens tal efter samme regel (før "…").
      svarPanel.info.setAttribute('data-v', st.fil ? tal(st.fil.linjer) : st.resultat && st.resultat.linjer != null ? tal(st.resultat.linjer) : st.linjer != null ? tal(st.linjer) : '…');
      svarPanel.info.setAttribute('data-w', stoerrelse(st.bytes));
      S.anvend(svarPanel.p);
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
          return { celler: [c, kode, a.antal == null ? '' : String(a.antal), a.linje ? tal(a.linje) : ''], data: a.kode };
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
      // V-MANUEL.1 N3 og N4: Ryd og Næste advarsel (slået til, så snart svaret har mindst én advarsel).
      kommando('demasker', 'ryd', Boolean(st.tekst) && !t, st.tekst ? 'hvorforVent' : 'hvorforIndsaetSvar');
      kommando('demasker', 'naeste-advarsel', Boolean(res) && !t && advarsler().length > 0, !res ? 'hvorforDemaskerFoerst' : t ? 'hvorforVent' : 'hvorforIngenAdvarsler', GV.naeste());
      arbejder(f, t);
      // V-OPBYG.1 N3: trin 1 uden svar (næste: Indsæt), trin 2 med et svar (næste: Demaskér), trin 3 med et resultat (næste:
      // Kopiér resultat; færdigt, når det er kopieret eller gemt).
      const nu = !st.tekst ? 1 : res ? 3 : 2;
      trin(nu, n => n < nu || (n === 3 && Boolean(res) && st.resultatBrugt));
      naeste('demasker', nu === 1 ? 'indsaet' : nu === 2 ? (poster > 0 && !t ? 'demasker' : null) : st.resultatBrugt ? null : 'kopier-resultat');
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
    // V-MANUEL.2 N1: den tomme flades anden handling: sagens indhold, når sagen har koder; ellers Sager (som før).
    G.haandter('demasker', 'tom-anden', () => { if (poster > 0) visSagensIndhold(); else G.vis('sager'); });
    G.haandter('demasker', 'kopier-resultat', () => kopierResultat());
    G.haandter('demasker', 'indsaet', () => indsaetVia(st.tekst ? svar.pre : d.tom, f));
    G.haandter('demasker', 'aabn-fil', () => aabnFil());
    G.haandter('demasker', 'gem-fil', () => gemFil());
    G.haandter('demasker', 'ryd', () => ryd());
    G.haandter('demasker', 'naeste-advarsel', () => naesteAdvarsel());

    /* V-MANUEL.1 N4: Næste advarsel. Hvert tryk vælger den næste række under Advarsler (filteret skiftes dertil, og en
       søgning ryddes), starter forfra efter den sidste, ruller den frem og viser stedet i svaret: linjen markeres i
       svarets tekstfelt og rulles frem (står den uden for det viste uddrag af en fil, eller har advarslen intet sted,
       siges det). Meldingen er høflig (role="status"). */
    function naesteAdvarsel() {
      const a = advarsler();
      if (!st.resultat || st.travl || !a.length) return;
      if (st.filter !== 'advarsler' || st.soeg) { st.soeg = ''; d.soeg.value = ''; vaelg('advarsler'); if (st.filter !== 'advarsler') filter('advarsler'); }
      st.adv = (st.adv + 1) % a.length;
      const x = a[st.adv];
      const t = tabelvaert.querySelector('table.tabel');
      const tr = t ? t.querySelectorAll('tbody tr')[st.adv] : null;
      if (tr) { t.vaelg(st.adv); if (tr.scrollIntoView) tr.scrollIntoView({ block: 'nearest' }); }
      const vist = visLinje(x.linje);
      besked(f, x.linje ? 'bNaesteAdv' : 'bNaesteAdvUdenSted');
      f.besked.setAttribute('data-v', `${st.adv + 1}/${a.length}`);
      if (x.linje) f.besked.setAttribute('data-w', tal(x.linje)); else f.besked.removeAttribute('data-w');
      S.anvend(f.besked);
      return vist;
    }
    /* Markerer linjen (1-baseret, efter Rusts regel: LF, CRLF og et enligt CR) i svarets tekstfelt og ruller den frem.
       Svarer med true, når linjen står i det viste. */
    function visLinje(linje) {
      const n = svar.pre.firstChild;
      if (!linje || !n || n.nodeType !== 3) return false;
      const t = n.data;
      let i = 0, l = 1;
      while (l < linje && i < t.length) {
        const c = t[i++];
        if (c === '\n' || (c === '\r' && t[i] !== '\n')) l++;
      }
      if (l < linje) return false;
      let j = i;
      while (j < t.length && t[j] !== '\n' && t[j] !== '\r') j++;
      const sel = document.getSelection ? document.getSelection() : null;
      if (sel) sel.setBaseAndExtent(n, i, n, j);
      const r = document.createRange();
      r.setStart(n, i);
      r.setEnd(n, j);
      if (typeof r.getBoundingClientRect === 'function') {
        const rr = r.getBoundingClientRect(), pr = svar.pre.getBoundingClientRect();
        if (rr.height) svar.pre.scrollTop += rr.top - pr.top - pr.height / 3;
      }
      return true;
    }
    /* V-MANUEL.1 N3: Ryd i Demaskér: svaret og det demaskerede resultat forsvinder (en åben fil slippes). Er resultatet
       hverken kopieret eller gemt, spørges der først. Sagen røres ikke. */
    function ryd() {
      if (!st.tekst || st.travl) return Promise.resolve(false);
      const goer = () => {
        slipFil();
        st.tekst = null; st.bytes = 0; st.linjer = null; st.resultat = null; st.resultatBrugt = false; st.adv = -1; st.nr++; fejlBanner = null;
        f.besked.textContent = ''; f.bannere.textContent = ''; f.tomBannere.textContent = '';
        const sel = document.getSelection ? document.getSelection() : null;
        if (sel && sel.rangeCount && (svar.pre.contains(sel.anchorNode) || ud.pre.contains(sel.anchorNode))) sel.removeAllRanges();
        tegn();
        d.tom.focus();
        return true;
      };
      if (!st.resultat || st.resultatBrugt) return Promise.resolve(goer());
      return G.bekraeft({
        t: 'rydH', p: { t: 'rydDemP' }, nej: { t: 'annuller' }, ja: { t: 'kRydOk' }, farlig: true,
        udfyld: rod => { rod.id = 'dlg-ryd-dem'; S.anvend(rod); },
      }).then(ja => (ja ? goer() : false));
    }
    d.soeg.addEventListener('input', () => { st.soeg = d.soeg.value; tegnTabel(); });
    async function kopierResultat() {
      if (!st.resultat || st.travl) return;
      if (st.resultat.fil && !st.resultat.kopierbar) { fejlBanner = ['bKopiForStor', null]; tegnBannere(); return; }
      const fil = Boolean(st.resultat.fil);
      const ok = fil ? await kopierFraRust('demasker', e => { fejl(e); tegnBannere(); }) : await kopier(st.resultat.tekst);
      if (ok === true) { st.resultatBrugt = true; tegnKommandoer(); }
      besked(f, ok ? 'bKopieret' : null);
      if (ok === false) banner(f.bannere, 'danger', 'bKopiFejl');
      /* V-LAAS.4: Rust får at vide, at udklipsholderen nu har det demaskerede resultat, så låsen kan rydde den (kun hvis
         ingen har skrevet til den siden). Kun her, ikke efter Kopiér i Maskér: maskeret tekst er lavet til at blive delt. */
      if (ok === true) invoke('udklip_kopieret', { fil }).catch(() => { /* låst eller uden Rust: intet at huske */ });
    }
    return {
      st, modtag, demasker, kopierResultat, tegn, tegnFod, tegnInfo, aabnFil, gemFil, modtagFil,
      aabnSluppet() { return aabnFil('fil_aabn_sluppet'); },
      slipAfvist(art) { fejlBanner = [art === 'mappe' ? 'bSlipMappe' : 'bSlipFlere', null]; tegnBannere(); },
      opdater() { tegnFlade(); tegnBannere(); tegnKommandoer(); },
      filter, nulstilt() { st.resultat = null; st.nr++; st.travl = false; tegn(); },
      // V-MANUEL.1
      ryd, naesteAdvarsel, visLinje, tegnFilinfo() { tegnFilinfo(f, st.fil); },
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
  /* V-PUDS.3 N6: uden en tekst er arbejdet (.arbejde, hvor beskeden står) skjult; før blev "Tryk ⌘V" så skrevet i et
     skjult element, og et klik på Indsæt så ud til at gøre intet. Nu står beskeden over den tomme flade (som de andre
     beskeder før en tekst, f.tomBannere), indtil der kommer en tekst. */
  function indsaetVia(maal, f) {
    if (maal && maal.focus) maal.focus();
    let ok = false;
    try { ok = document.execCommand('paste'); } catch (e) { ok = false; }
    if (ok) return;
    if (f.ark.hidden) {
      f.tomBannere.textContent = '';
      banner(f.tomBannere, 'info', 'bTrykModV', G.mod + 'V');
      return;
    }
    besked(f, 'bTrykModV');
    f.besked.setAttribute('data-v', G.mod + 'V');
    S.anvend(f.besked);
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

  /* V-MANUEL.1 N2: menuen Rediger → Fortryd og Gentag (hændelsen 'menu' med "fortryd" og "gentag", også fra ⌘Z og ⇧⌘Z,
     når siden ikke selv har brugt tastetrykket). Står fokus i et tekstfelt, fortryder feltet sin egen redigering
     (webvisningens fortryd via execCommand); ellers Grimnirs Fortryd og Gentag i Maskér. Kom tastetrykket lige før
     (sidstTast), er det allerede brugt: så gør menuens hændelse intet, så intet fortrydes to gange. */
  let sidstTast = 0;
  function redigerFraMenu(hvad) {
    const a = document.activeElement;
    if (a && a.matches && a.matches('input[type="text"], input[type="search"], textarea, [contenteditable="true"]')) {
      try { document.execCommand(hvad === 'fortryd' ? 'undo' : 'redo'); } catch (e) { /* feltet har intet at fortryde */ }
      return;
    }
    if (G.laast || document.querySelector('dialog[open]') || G.aktiv !== 'masker' || Date.now() - sidstTast < 400) return;
    if (hvad === 'fortryd') M.fortryd(); else M.gentag();
  }
  /* V-MANUEL.1 N1: Maskér dette følger markeringen i tekstfeltet. */
  document.addEventListener('selectionchange', () => { if (G.aktiv === 'masker') M.markeringAendret(); });

  /* Genveje: ⌘↵ Analysér og derefter Gem og maskér (Demaskér i Demaskér); ⇧⌘C kopiér resultatet. Ctrl på Windows.
     V-MANUEL.1: ⌘Z/⇧⌘Z, ⇧⌘M og ⌘G (se nedenfor). */
  document.addEventListener('keydown', e => {
    const modTast = G.mac ? e.metaKey && !e.ctrlKey : e.ctrlKey && !e.metaKey;
    if (!modTast || e.altKey || G.laast || document.querySelector('dialog[open]')) return;
    const v = G.aktiv;
    if (v !== 'masker' && v !== 'demasker') return;
    /* V-MANUEL.1 N2: ⌘Z og ⇧⌘Z (Ctrl+Z, Ctrl+Y og Ctrl+Shift+Z på Windows). Står fokus i et tekstfelt (Erstatning,
       søgningen), er det feltets egen fortryd: intet her, og tastetrykket går videre (på macOS til menuen Rediger, som
       sender 'fortryd'/'gentag' tilbage, se redigerFraMenu). Ellers er det Grimnirs Fortryd og Gentag i Maskér, og
       tastetrykket stoppes, så menuen ikke også slår til. */
    const z = e.code === 'KeyZ' || e.key === 'z' || e.key === 'Z';
    const y = !G.mac && !e.shiftKey && (e.code === 'KeyY' || e.key === 'y' || e.key === 'Y');
    if (z || y) {
      if (fokusIFelt(e) || v !== 'masker') return;
      e.preventDefault();
      sidstTast = Date.now();
      if (z && !e.shiftKey) M.fortryd(); else M.gentag();
      return;
    }
    // V-MANUEL.1: ⇧⌘M (Ctrl+Shift+M) Maskér dette; ⌘G (Ctrl+G) Næste advarsel.
    if (e.shiftKey && (e.code === 'KeyM' || e.key === 'm' || e.key === 'M')) { if (v === 'masker') { e.preventDefault(); M.maskerDette(); } return; }
    if (!e.shiftKey && (e.code === 'KeyG' || e.key === 'g' || e.key === 'G')) { if (v === 'demasker') { e.preventDefault(); D.naesteAdvarsel(); } return; }
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
    G.tauri.event.listen('menu', e => { if (e.payload === 'fortryd' || e.payload === 'gentag') redigerFraMenu(e.payload); });
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
  // V-PUDS.3 N5: størrelsen i panelhovedet står med sprogets talformat (data-w er en færdig tekst), så den laves om.
  document.addEventListener('grimnir-sprog', () => { if (M.st.tekst) M.tegnInfo(); if (D.st.tekst) D.tegnInfo(); });
  // V-MANUEL.1 N5: filinfoens størrelse følger også sproget.
  document.addEventListener('grimnir-sprog', () => { M.tegnFilinfo(); D.tegnFilinfo(); });

  M.tegn();
  D.tegn();
  menuSprog();
  window.GrimnirMaskering = { M, D, utf8Laengde, antalLinjer, stoerrelse, MAKS_BYTES, MAKS_DEMASKER, saetSag, saetGemteSager, kommando, sagFejlTekst, filFejlTekst, banner, get poster() { return poster; } };
})();
