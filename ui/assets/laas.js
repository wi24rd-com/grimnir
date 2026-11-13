/* Grimnir — låseskærmen (V-LAAS.2, L3 og L4; V-LAAS.3, N3). Bygger på skallen (window.Grimnir), kittet (window.Kit) og
   sproget.

   Grimnir starter altid låst (V-LAAS.3: indstillingen "Lås Grimnir ved start" er fjernet). <html data-laast> står
   allerede i index.html, så siden er låst, før noget script har kørt (og forbliver låst, hvis et script fejler). Her
   spørges Rust (laas_status); er der låst ved start, kaldes laas_op straks én gang: macOS viser sin dialog med Touch ID og
   adgangskoden som reserve. Svaret:
     ok                → låseskærmen forsvinder, og Sager og Ordbog henter deres data (GrimnirLaas.klar).
     annulleret/afvist → Grimnir bliver låst med låseskærmen; "Lås op" prøver igen; programmet lukker ikke.
     ikke_tilgaengelig → maskinen kan ikke bekræfte brugeren (ingen adgangskode, eller ingen dør på platformen):
                         Grimnir låses op, og et vedvarende, afdæmpet banner siger, at Grimnir ikke er låst.
     fejl              → som annulleret, med fejlkoden.
   Mens der er låst, står intet fra sagerne eller ordbogen i DOM'en: de hentes først efter oplåsningen, og Rust svarer
   `laast` på hver kommando, der bruger dem. Fanerne øverst (V-FANER.1; før visningsskiftet) og båndet er nedtonede (inert)
   med en forklaring i title;
   titellinjen, menuen, Indstillinger og Om virker. Fokus står på "Lås op"; Enter låser op.

   V-LAAS.3, lås igen: når Rust låser (dvale, skærmen slukker, brugerskift, stilstand), kommer hændelsen `laast`, og
   siden genindlæses (location.reload). Så starter den forfra fra index.html i låst tilstand, og intet fra sager, ordbog,
   tekster eller resultater ligger tilbage i DOM'en eller i JS-hukommelsen; åbne dialoger lukkes af genindlæsningen.
   Efter en ny lås svarer laas_status med `igen`, og laas_op kaldes IKKE af sig selv (ellers stod fingerdialogen og
   ventede, mens brugeren er væk): låseskærmen siger "Grimnir låste, mens du var væk", og dialogen kommer først ved tryk på
   Lås op eller Enter. Efter oplåsningen vises det, der skete ved låsen (svaret `efter`): V-LAAS.4: at en midlertidig sag
   blev gemt under et dato-navn (navnet står i beskeden), at den ikke kunne gemmes og er lukket, eller at den åbne sag
   ikke kunne gemmes (fejlene uden indhold). V-LAAS.6: det samme svar kan komme ved oplåsningen ved start, når
   programmet sidst blev afsluttet uden at spørge (Afslut fra Dock, log ud) og den midlertidige sag blev gemt; UI'et
   viser den samme besked (Rust giver den én gang).
   Aktivitet: tastatur og mus i vinduet sender kommandoen `aktivitet` højst hvert 20. sekund (Rust måler stilstand; hver
   anden kommando tæller også).

   Døren beskytter mod en person, der sætter sig ved en ulåst maskine og åbner Grimnir. Den beskytter ikke mod et andet
   program, der kører som brugeren; ingen tekst her må love mere end det.

   Rust-kommandoer: laas_status, laas_op, program_afslut, aktivitet. Rust-hændelser: laast. Intet her skriver til
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
  // V-FANER.2: visningerne står i båndet (ingen række over det).
  const nedtonet = () => [...$('baand').children, $('navdele')];
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
    for (const b of bannerRod.querySelectorAll('.ban[data-hvorfor]')) b.remove();
    if (!udenDoer) return;
    const b = K.banner({ variant: 'info', t: 'bIkkeLaast' });
    b.dataset.hvorfor = udenDoer;
    bannerRod.prepend(b);
    S.anvend(bannerRod);
  }

  /* V-LAAS.3: det, der skete, da Grimnir låste igen (svaret `efter` fra laas_op). Én sætning pr. besked og en Luk-knap. */
  function visEfter(efter) {
    if (!efter) return;
    const beskeder = [];
    const GM = window.GrimnirMaskering;
    const fejltekst = f => GM ? GM.sagFejlTekst({ art: 'sag', fejl: f }) : S.t('sagfejl_andet');
    // V-LAAS.4: den midlertidige sag er gemt under et dato-navn (den åbnes ikke af sig selv; den står i Sager).
    if (efter.midlertidig_gemt) beskeder.push(['info', 'bMidlertidigGemt', efter.midlertidig_gemt]);
    if (efter.midlertidig_fejl) beskeder.push(['warn', 'bMidlertidigFejl', fejltekst(efter.midlertidig_fejl)]);
    if (efter.gem_fejl) beskeder.push(['warn', 'bGemFejlVedLaas', fejltekst(efter.gem_fejl)]);
    for (const [variant, t, v] of beskeder) {
      const b = K.banner({ variant, t, handling: { t: 'luk', ariaT: 'ariaLukBesked', ved: () => b.remove() } });
      b.dataset.efter = t;
      if (v != null) b.querySelector('.ord').setAttribute('data-v', v);
      bannerRod.appendChild(b);
    }
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
  /* Svaret fra laas_op: låsens tilstand bagefter gælder; efter en ny lås også beskederne (`efter`). */
  function anvend(r) {
    const st = r && r.status;
    if (!st) return;
    saetBanner(st.uden_doer);
    if (!st.laast) { if (html.hasAttribute('data-laast')) saetLaast(false); visEfter(r.efter); return; }
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

  /* V-LAAS.3: Rust har låst igen. Siden genindlæses og starter låst fra index.html; intet bliver tilbage. */
  const api = { genindlaes: () => window.location.reload() };
  // Visningerne skjules med det samme (CSS: html[data-laast]), også i det øjeblik, genindlæsningen tager.
  if (G.tauri && G.tauri.event) G.tauri.event.listen('laast', () => { html.setAttribute('data-laast', ''); api.genindlaes(); });

  /* V-LAAS.3: tastatur og mus i vinduet er aktivitet (stilstand). Højst ét kald hvert 20. sekund; ikke mens der er låst. */
  const AKTIVITET_MS = 20000;
  let sidstMeldt = -Infinity;
  function aktivitet() {
    if (html.hasAttribute('data-laast')) return;
    const nu = Date.now();
    if (nu - sidstMeldt < AKTIVITET_MS) return;
    sidstMeldt = nu;
    invoke('aktivitet').catch(() => { /* Rust måler selv; et tabt kald giver højst en tidligere lås */ });
  }
  for (const h of ['keydown', 'pointerdown', 'pointermove', 'wheel']) document.addEventListener(h, aktivitet, { capture: true, passive: true });

  /* Start: spørg Rust. Uden Rust (forhåndsvisning i en browser) er der intet at låse. Ved programmets start kaldes
     laas_op én gang af sig selv; efter en ny lås (st.igen) venter låseskærmen på brugeren. */
  const start = invoke('laas_status').then(st => {
    if (st && st.laast) {
      saetLaast(true);
      if (st.igen) { saetBesked('laasIgen'); return null; }
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

  Object.assign(api, { klar, start, laasOp, anvend, aktivitet });
  Object.defineProperty(api, 'laast', { get: () => html.hasAttribute('data-laast'), enumerable: true });
  window.GrimnirLaas = api;
})();
