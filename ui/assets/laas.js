/* Grimnir — låseskærmen (V-LAAS.2, L3 og L4). Bygger på skallen (window.Grimnir), kittet (window.Kit) og sproget.

   Grimnir starter låst, når "Lås Grimnir ved start" er til. <html data-laast> står allerede i index.html, så siden er
   låst, før noget script har kørt (og forbliver låst, hvis et script fejler). Her spørges Rust (laas_status); er der
   låst, kaldes laas_op straks én gang: macOS viser sin dialog med Touch ID og adgangskoden som reserve. Svaret:
     ok                → låseskærmen forsvinder, og Sager og Ordbog henter deres data (GrimnirLaas.klar).
     annulleret/afvist → Grimnir bliver låst med låseskærmen; "Lås op" prøver igen; programmet lukker ikke.
     ikke_tilgaengelig → maskinen kan ikke bekræfte brugeren (ingen adgangskode, eller ingen dør på platformen):
                         Grimnir låses op, og et vedvarende, afdæmpet banner siger, at Grimnir ikke er låst.
     fejl              → som annulleret, med fejlkoden.
   Mens der er låst, står intet fra sagerne eller ordbogen i DOM'en: de hentes først efter oplåsningen, og Rust svarer
   `laast` på hver kommando, der bruger dem. Visningsskiftet og båndet er nedtonede (inert) med en forklaring i title;
   titellinjen, menuen, Indstillinger og Om virker. Fokus står på "Lås op"; Enter låser op.

   Døren beskytter mod en person, der sætter sig ved en ulåst maskine og åbner Grimnir. Den beskytter ikke mod et andet
   program, der kører som brugeren; ingen tekst her må love mere end det.

   Rust-kommandoer: laas_status, laas_op, program_afslut (og laas_ved_start fra indstillinger.js). Intet her skriver til
   konsollen eller til localStorage. */
(function () {
  'use strict';
  const G = window.Grimnir, K = window.Kit, S = window.Sprog;
  if (!G || !K || !S) return;
  const invoke = G.tauri && G.tauri.core && G.tauri.core.invoke ? (c, a) => G.tauri.core.invoke(c, a) : () => Promise.reject({ art: 'ingen_rust' });
  const $ = id => document.getElementById(id);
  const html = document.documentElement;

  let loesKlar = null;
  const klar = new Promise(r => { loesKlar = r; });
  let venter = false;

  const knapOp = $('laas-op'), knapAfslut = $('laas-afslut'), besked = $('laas-besked'), bannerRod = $('laas-banner');
  const nedtonet = () => [...$('baand').children, $('navdele'), $('skift')];
  const forklaret = () => [$('baand'), document.querySelector('nav.nav')];

  /* Beskeden under knapperne: en nøgle (og et tal) eller ingen. */
  function saetBesked(t, v, fejl) {
    besked.classList.toggle('fejl', Boolean(fejl));
    if (!t) { besked.removeAttribute('data-t'); besked.removeAttribute('data-v'); besked.textContent = ''; return; }
    besked.setAttribute('data-t', t);
    if (v != null) besked.setAttribute('data-v', String(v)); else besked.removeAttribute('data-v');
    S.anvend(besked);
  }

  /* Banneret, når Grimnir er låst op uden bekræftelse (L3). Vedvarende: det står, til programmet lukkes. */
  function saetBanner(udenDoer) {
    bannerRod.textContent = '';
    if (!udenDoer) return;
    const b = K.banner({ variant: 'info', t: 'bIkkeLaast' });
    b.dataset.hvorfor = udenDoer;
    bannerRod.appendChild(b);
    S.anvend(bannerRod);
  }

  function saetLaast(on) {
    html.toggleAttribute('data-laast', on);
    for (const e of nedtonet()) e.toggleAttribute('inert', on);
    for (const e of forklaret()) {
      if (on) e.setAttribute('data-t-title', 'hvorforLaast');
      else { e.removeAttribute('data-t-title'); e.removeAttribute('title'); }
    }
    if (on) {
      S.anvend(document.body);
      knapOp.focus();
    } else {
      if ($('laas').contains(document.activeElement)) document.activeElement.blur();
      saetBesked(null);
      loesKlar();
    }
    document.dispatchEvent(new CustomEvent('grimnir-laas', { detail: on }));
  }

  const SVAR = { annulleret: 'laasAnnulleret', afvist: 'laasAfvist' };
  /* Svaret fra laas_op eller laas_ved_start: låsens tilstand bagefter gælder. */
  function anvend(r) {
    const st = r && r.status;
    if (!st) return;
    saetBanner(st.uden_doer);
    if (!st.laast) { if (html.hasAttribute('data-laast')) saetLaast(false); return; }
    if (r.svar === 'fejl') saetBesked('laasFejl', r.kode, true);
    else if (SVAR[r.svar]) saetBesked(SVAR[r.svar], null, r.svar === 'afvist');
  }

  function laasOp() {
    if (venter || !html.hasAttribute('data-laast')) return Promise.resolve(null);
    venter = true;
    knapOp.disabled = true;
    knapOp.setAttribute('aria-busy', 'true');
    saetBesked('laasVenter');
    return invoke('laas_op', { sprog: S.lang })
      .then(r => { anvend(r); return r; })
      .catch(() => { saetBesked('laasUkendt', null, true); return null; })
      .finally(() => {
        venter = false;
        knapOp.disabled = false;
        knapOp.removeAttribute('aria-busy');
        if (html.hasAttribute('data-laast') && !document.querySelector('dialog[open]')) knapOp.focus();
      });
  }

  knapOp.addEventListener('click', () => laasOp());
  knapAfslut.addEventListener('click', () => invoke('program_afslut').catch(() => { /* programmet lukker */ }));
  /* Enter låser op (også når fokus står på selve knappen; ikke på Afslut og ikke i en dialog). */
  document.addEventListener('keydown', e => {
    if (e.key !== 'Enter' || !html.hasAttribute('data-laast') || document.querySelector('dialog[open]')) return;
    if (e.target === knapAfslut) return;
    e.preventDefault();
    e.stopPropagation();
    laasOp();
  }, true);
  document.addEventListener('grimnir-sprog', () => { if (html.hasAttribute('data-laast')) S.anvend(document.body); });

  /* Start: spørg Rust. Uden Rust (forhåndsvisning i en browser) er der intet at låse. */
  const start = invoke('laas_status').then(st => {
    if (st && st.laast) {
      saetLaast(true);
      return laasOp();
    }
    saetBanner(st && st.uden_doer);
    saetLaast(false);
    return null;
  }).catch(e => {
    if (e && e.art === 'ingen_rust') { saetLaast(false); return null; }
    saetLaast(true);
    saetBesked('laasUkendt', null, true);
    return null;
  });

  window.GrimnirLaas = { klar, start, laasOp, anvend, get laast() { return html.hasAttribute('data-laast'); } };
})();
