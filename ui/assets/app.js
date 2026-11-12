/* Grimnir — programskallen bygget af kittet (window.Kit). Fire visninger (Maskér, Demaskér, Sager, Ordbog), hver med sin
   CommandBar (fanerne Start og Vis), sit træ i NavPane, sin værktøjslinje og en tom tilstand. Visningen står i adressen
   (#masker …) og skiftes med visningsskiftet eller ⌘1–⌘4 (Ctrl på Windows). Maskér og Demaskér (maskering.js), Sager
   (sager.js), Ordbog (ordbog.js) og Indstillinger (indstillinger.js) virker via window.Grimnir; resten af kommandoerne
   fra design/skaerme/ står nedtonet med en forklaring, til funktionen kommer (v2).
   V-LAAS.2: mens <html data-laast> står (laas.js), er visningsskiftet og båndet nedtonede, og ⌘1–⌘4 gør intet;
   Indstillinger (⌘, / Ctrl+,) og Om virker.
   Rust giver: kerne_version (fodlinjen), hændelsen 'menu' ("om" | "indstillinger" | "afslut"; "aabn" | "gem" håndteres
   af maskering.js), hændelsen 'fuldskaerm'
   (true | false) og platformen (<html data-platform>). */
(function () {
  'use strict';
  const K = window.Kit, S = window.Sprog, T = window.Tema;
  const tauri = window.__TAURI__ || null;
  const platform = window.__GRIMNIR_PLATFORM__ || document.documentElement.getAttribute('data-platform') || '';
  const mac = platform === 'macos';
  const mod = mac ? '⌘' : 'Ctrl+';

  /* Grimnirs egne ikoner (V-KIT.1: flyttet hertil fra kit.js; kittet har kun de almene). Samme format som kittets. */
  K.registrerIkoner({
    foerefter: [['rect', { x: 3, y: 5, width: 8, height: 14, rx: 1 }], ['rect', { x: 13, y: 5, width: 8, height: 14, rx: 1 }]],
    kvittering: [['path', { d: 'M6 3h12v18l-3-2-3 2-3-2-3 2z' }], ['path', { d: 'M9 8h6M9 12h6' }]],
    maske: [['path', { d: 'M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z' }], ['path', { d: 'M4 4l16 16' }]],
    naeste: [['path', { d: 'M12 4v10' }], ['path', { d: 'M12 18.5v.5' }], ['path', { d: 'M17 9l3 3-3 3' }]],
  });

  const senere = (id, t, ikon, pri) => ({ id, t, ikon, pri: Boolean(pri), deaktiveret: true, hvorfor: 'hvorforSenere' });
  /* En kommando, maskering.js styrer: starter nedtonet (indtil der er noget at gøre) og kalder den registrerede handling. */
  const HANDLINGER = {};
  const aktiv = (visning, id, t, ikon, pri, fra) => ({
    id, t, ikon, pri: Boolean(pri), deaktiveret: !fra, hvorfor: fra ? null : 'hvorforIndsaetFoerst',
    ved: e => { const h = HANDLINGER[visning + ':' + id]; if (h) h(e); },
  });

  /* Visningerne: kommandoer og træ efter design/skaerme/ (Main, Demasker, Sager, Ordbog). */
  const VISNINGER = [
    {
      id: 'masker', t: 'vMasker', ikon: 'maske', soeg: 'soegMasker', chip: 'chipIntetIndsat', fod: 'fodMasker',
      tom: ['tomMaskerH', 'tomMaskerP'],
      grupper: [
        { t: 'gTekst', knapper: [aktiv('masker', 'indsaet', 'kIndsaet', 'indsaet', false, true), aktiv('masker', 'aabn-fil', 'kAabnFil', 'fil', false, true)] },
        { t: 'gMaskering', knapper: [aktiv('masker', 'analyser', 'kAnalyser', 'soeg'), aktiv('masker', 'gem-masker', 'kGemMasker', 'skjold', true), aktiv('masker', 'foer-efter', 'kFoerEfter', 'foerefter')] },
        // V-FIL.1: Gem maskeret fil ved siden af Kopiér. V-KVIT.1: Kopiér kvittering (aktiv, når der er et maskeret resultat).
        { t: 'gResultat', knapper: [aktiv('masker', 'kopier', 'kKopier', 'kopier'), aktiv('masker', 'gem-fil', 'kGemMaskeretFil', 'gem'), aktiv('masker', 'kvittering', 'kKvittering', 'kvittering')] },
      ],
      trae: [
        { id: 'denne', t: 'tDenneTekst', boern: [{ id: 'alle', t: 'tAlleFund', antal: 0 }, { id: 'tjek', t: 'tSkalTjekkes', antal: 0 }, { id: 'hemmelig', t: 'tHemmeligheder', antal: 0 }] },
        { id: 'seneste', t: 'tSenesteISagen', antal: 0 },
      ],
      valgt: 'alle',
    },
    {
      id: 'demasker', t: 'vDemasker', ikon: 'oeje', soeg: 'soegDemasker', chip: 'chipIntetSvar', fod: 'fodDemasker',
      tom: ['tomDemaskerH', 'tomDemaskerP'],
      grupper: [
        { t: 'gSvar', knapper: [aktiv('demasker', 'indsaet', 'kIndsaet', 'indsaet', false, true), aktiv('demasker', 'aabn-fil', 'kAabnFil', 'fil', false, true)] },
        { t: 'gDemaskering', knapper: [aktiv('demasker', 'demasker', 'kDemasker', 'oeje', true), senere('naeste-advarsel', 'kNaesteAdvarsel', 'naeste')] },
        { t: 'gResultat', knapper: [aktiv('demasker', 'kopier-resultat', 'kKopierResultat', 'kopier'), aktiv('demasker', 'gem-fil', 'kGemFil', 'gem')] },
      ],
      trae: [
        { id: 'dette', t: 'tDetteSvar', boern: [{ id: 'alle', t: 'tAlleKoder', antal: 0 }, { id: 'advarsler', t: 'tAdvarsler', antal: 0 }, { id: 'ikke-brugt', t: 'tIkkeBrugt', antal: 0 }] },
      ],
      valgt: 'alle',
    },
    {
      id: 'sager', t: 'vSager', ikon: 'mappe', soeg: 'soegSager', chip: 'chipIngenSager', fod: 'fodSager',
      tom: ['tomSagerH', 'tomSagerP'],
      grupper: [
        { t: 'gSag', knapper: [aktiv('sager', 'ny-sag', 'kNySag', 'plus', true, true), aktiv('sager', 'aabn-i-masker', 'kAabnIMasker', 'aabn'), aktiv('sager', 'omdoeb', 'kOmdoeb', 'rediger'), aktiv('sager', 'udloeb', 'kUdloeb', 'kalender')] },
        { t: 'gDeling', knapper: [senere('eksporter', 'kEksporter', 'eksport'), senere('importer', 'kImporter', 'import')] },
        { t: 'gOprydning', knapper: [aktiv('sager', 'slet-sag', 'kSletSag', 'slet')] },
      ],
      trae: [
        { id: 'sager', t: 'tSager', boern: [{ id: 'alle', t: 'tAlle', antal: 0 }, { id: 'udloeber', t: 'tUdloeberSnart', antal: 0 }, { id: 'uden-udloeb', t: 'tUdenUdloeb', antal: 0 }] },
      ],
      valgt: 'alle',
    },
    {
      id: 'ordbog', t: 'vOrdbog', ikon: 'bog', soeg: 'soegOrdbog', chip: 'chipTomOrdbog', fod: 'fodOrdbog',
      tom: ['tomOrdbogH', 'tomOrdbogP'],
      grupper: [
        { t: 'gOrdbog', knapper: [aktiv('ordbog', 'tilfoej-post', 'kTilfoejPost', 'plus', true, true), aktiv('ordbog', 'ret', 'kRet', 'rediger'), aktiv('ordbog', 'proev', 'kProev', 'afspil', false, true)] },
        { t: 'gDeling', knapper: [senere('importer', 'kImporter', 'import'), senere('eksporter', 'kEksporter', 'eksport')] },
        { t: 'gOprydning', knapper: [aktiv('ordbog', 'fjern-post', 'kFjernPost', 'slet')] },
      ],
      // V-ORDBOG.1: listerne og alle seks typer under "maskér altid" (ordbog.js filtrerer og tæller).
      trae: [
        { id: 'lister', t: 'tLister', boern: [{ id: 'altid', t: 'tMaskerAltid', antal: 0 }, { id: 'aldrig', t: 'tMaskerAldrig', antal: 0 }] },
        { id: 'typer', t: 'tTyper', boern: ['domaene', 'netbios', 'navnemoenster', 'eget_net', 'ord', 'person'].map(x => ({ id: 't-' + x, t: 'tt_' + x, antal: 0 })) },
      ],
      valgt: 'lister',
    },
  ];
  const ID = VISNINGER.map(v => v.id);

  /* Vis-fanen er ens i alle visninger: tema og sprog. */
  const visFane = () => ({
    id: 'vis', t: 'faneVis',
    grupper: [
      { t: 'gTema', knapper: [
        { id: 'tema-lys', t: 'kLys', ikon: 'sol', trykket: T.valg === 'lys', ved: () => T.saet('lys') },
        { id: 'tema-moerk', t: 'kMoerk', ikon: 'maane', trykket: T.valg === 'moerk', ved: () => T.saet('moerk') },
        { id: 'tema-system', t: 'kSystem', ikon: 'skaerm', trykket: T.valg === 'system', ved: () => T.saet('system') },
      ] },
      { t: 'gSprog', knapper: [
        { id: 'sprog-da', t: 'kDansk', ikon: 'sprog', trykket: S.lang === 'da', ved: () => S.saet('da') },
        { id: 'sprog-en', t: 'kEngelsk', ikon: 'sprog', trykket: S.lang === 'en', ved: () => S.saet('en') },
      ] },
    ],
  });

  const $ = id => document.getElementById(id);
  const laast = () => document.documentElement.hasAttribute('data-laast');
  const baand = $('baand'), navdele = $('navdele'), arb = $('arb');
  const dele = {};

  for (const v of VISNINGER) {
    // CommandBar
    const cmd = document.createElement('div');
    cmd.dataset.visning = v.id;
    baand.appendChild(cmd);
    const bar = K.commandBar(cmd, { ariaT: 'cmdAria', faner: [{ id: 'start', t: 'faneStart', grupper: v.grupper }, visFane()] });

    // NavPane: overskrift og træ
    const nd = document.createElement('div');
    nd.className = 'navdel';
    nd.dataset.visning = v.id;
    const h3 = document.createElement('h3');
    h3.setAttribute('data-t', v.t);
    const ul = document.createElement('ul');
    nd.append(h3, ul);
    navdele.appendChild(nd);

    // Arbejdsfladen: værktøjslinje (søgning, filter, status) og tom tilstand
    const sek = document.createElement('section');
    sek.className = 'visning';
    sek.dataset.visning = v.id;
    sek.setAttribute('data-t-aria', v.t);
    const vl = document.createElement('div');
    vl.className = 'vl';
    const soeg = document.createElement('label');
    soeg.className = 'soeg';
    soeg.appendChild(K.ikon('soeg'));
    const inp = document.createElement('input');
    inp.type = 'search';
    inp.disabled = true;
    inp.spellcheck = false;
    inp.setAttribute('autocomplete', 'off');
    inp.setAttribute('data-t-ph', v.soeg);
    inp.setAttribute('data-t-aria', v.soeg);
    soeg.appendChild(inp);
    const fl = document.createElement('button');
    fl.type = 'button';
    fl.className = 'fl';
    fl.setAttribute('aria-disabled', 'true');
    fl.appendChild(K.ikon('filter'));
    const flTekst = document.createElement('span');
    fl.appendChild(flTekst);
    const hoejre = document.createElement('span');
    hoejre.className = 'hoejre';
    hoejre.appendChild(K.chip('none', { t: v.chip }));
    vl.append(soeg, fl, hoejre);
    // V-KITBRUG.1 N3: hvorfor filterknappen ikke kan bruges, står i kittets værktøjstip (mus og tastatur; før i title).
    K.vaerktoejstip(fl, { t: 'hvorforFilter' });
    const flade = document.createElement('div');
    flade.className = 'flade';
    // V-KITBRUG.1 N3: kittets tomme tilstand (ikon, overskrift og én sætning). Maskér og Demaskér gør den til en flade, der
    // tager imod indsat tekst og en sluppet fil (maskering.js); knapperne i den lægges til af visningerne.
    const tom = K.tomTilstand({ ikon: v.ikon, t: v.tom[0], p: { t: v.tom[1] } });
    const p = tom.querySelector('.tomt-p');
    flade.appendChild(tom);
    sek.append(vl, flade);
    arb.appendChild(sek);

    // Træet filtrerer arbejdsfladen; filterknappen viser valget.
    const noegle = id => {
      for (const p1 of v.trae) {
        if (p1.id === id) return p1.t;
        for (const b of p1.boern || []) if (b.id === id) return b.t;
      }
      return null;
    };
    const trae = K.navTrae(ul, v.trae, {
      ariaT: 'traeAria', valgt: v.valgt,
      vedValg: id => {
        flTekst.setAttribute('data-t', noegle(id));
        if (S) S.anvend(flTekst);
        document.dispatchEvent(new CustomEvent('grimnir-trae', { detail: { visning: v.id, id } }));
      },
    });
    dele[v.id] = { cmd, bar, nd, sek, trae, flTekst, soeg: inp, hoejre, flade, tom, tomP: p };
  }

  // Visningsskiftet nederst i NavPane
  const skift = K.visningsskift($('skift'), VISNINGER.map((v, i) => ({
    id: v.id, t: v.t, ikon: v.ikon, genvej: mod + (i + 1), genvejAria: (mac ? 'Meta+' : 'Control+') + (i + 1),
  })), { ariaT: 'visninger' });

  const fodVenstre = $('fod-venstre');
  let aktivVisning = null;
  function vis(id) {
    if (!ID.includes(id)) id = ID[0];
    aktivVisning = id;
    for (const v of VISNINGER) {
      const on = v.id === id;
      dele[v.id].cmd.hidden = !on;
      dele[v.id].nd.hidden = !on;
      dele[v.id].sek.hidden = !on;
    }
    skift.markér(id);
    fodVenstre.setAttribute('data-t', VISNINGER.find(v => v.id === id).fod);
    S.anvend(fodVenstre);
    document.dispatchEvent(new CustomEvent('grimnir-visning', { detail: id }));
  }
  const fraAdresse = () => vis(decodeURIComponent(location.hash.slice(1)));
  window.addEventListener('hashchange', fraAdresse);
  function gaaTil(id) {
    if (location.hash !== '#' + id) location.hash = id;
    else vis(id);
  }

  /* Tryk-tilstand på Vis-fanens knapper i alle fire bånd. */
  function opdaterVis() {
    for (const v of VISNINGER) {
      for (const [id, on] of [['tema-lys', T.valg === 'lys'], ['tema-moerk', T.valg === 'moerk'], ['tema-system', T.valg === 'system'], ['sprog-da', S.lang === 'da'], ['sprog-en', S.lang === 'en']]) {
        dele[v.id].bar.knap(id).setAttribute('aria-pressed', String(on));
      }
    }
  }
  document.addEventListener('grimnir-tema', opdaterVis);
  document.addEventListener('grimnir-sprog', opdaterVis);

  // Titellinjen: indstillinger
  const indstKnap = $('aabn-indst');
  indstKnap.appendChild(K.ikon('tandhjul', 'ik'));
  indstKnap.setAttribute('data-v', mod + ',');

  /* Dialoger. V-KITBRUG.1 N4: en dialog bygget med kittets Kit.dialog får sit gamle id (dlg-…), knapperne deres gamle
     id'er (knapId: { svar: id }), og den står i <body> fra start, så den kan findes, før den åbnes. Kun én dialog er
     åben ad gangen: aabnDialog lukker de andre (kittets og Grimnirs egne .dlg) og åbner den ene; fokus kan peges på
     (et knap-svar, et id eller et element), ellers vælger kittet. bekraeft er kittets Kit.bekraeft med samme regel. */
  const KITDLG = {};
  function kitDialog(id, o, knapId = {}) {
    const dl = K.dialog(o);
    dl.rod.id = id;
    for (const [svar, kid] of Object.entries(knapId)) dl.knap(svar).id = kid;
    document.body.appendChild(dl.rod);
    S.anvend(dl.rod);
    KITDLG[id] = dl;
    return dl;
  }
  function lukAndre(d) { for (const andet of document.querySelectorAll('dialog[open]')) if (andet !== d) andet.close(); }
  function aabnDialog(id, fokus) {
    const d = $(id);
    lukAndre(d);
    if (KITDLG[id]) KITDLG[id].aabn(fokus);
    else if (!d.open) d.showModal();
  }
  function bekraeft(o) { lukAndre(null); return K.bekraeft(o); }
  for (const b of document.querySelectorAll('dialog [data-luk]')) b.addEventListener('click', () => b.closest('dialog').close());

  // Om: navn, slogan, beskrivelse, versionerne og licensen, med kittets fletbånd øverst (ADR D16: ét sted).
  const elT = (tag, kl, t, id) => { const e = document.createElement(tag); if (kl) e.className = kl; if (t) e.setAttribute('data-t', t); if (id) e.id = id; return e; };
  const omIndhold = document.createElement('div');
  const identitet = elT('div', 'identitet');
  identitet.append(elT('p', 'id-navn', 'appNavn'), elT('p', 'id-slogan', 'slogan'), elT('p', 'id-beskrivelse', 'beskrivelse'));
  const omTal = elT('ul', 'om-tal');
  const omVersion = elT('li', 'mono', 'version', 'om-version'), omKerne = elT('li', 'mono', 'kerne', 'om-kerne');
  omVersion.setAttribute('data-v', '…');
  omKerne.setAttribute('data-v', '…');
  omTal.append(omVersion, omKerne, elT('li', null, 'licens'));
  omIndhold.append(identitet, elT('p', 'om-p', 'omP'), omTal);
  const om = kitDialog('dlg-om', { t: 'omH', indhold: omIndhold, knapper: [{ id: 'luk', t: 'luk' }] });
  const omFlet = elT('div', 'om-flet', null, 'om-flet');
  omFlet.appendChild(K.fletbaand());
  om.rod.prepend(omFlet);
  indstKnap.addEventListener('click', () => aabnDialog('dlg-indst'));
  const MENU = { indstillinger: 'dlg-indst', om: 'dlg-om' };

  // Tastatur: ⌘1–⌘4 (Ctrl på Windows); Ctrl+, på Windows (på macOS fanger programmenuen ⌘,). Visningernes egne
  // genveje (⌘↵, ⇧⌘C) står i maskering.js.
  document.addEventListener('keydown', e => {
    const modTast = mac ? e.metaKey && !e.ctrlKey : e.ctrlKey && !e.metaKey;
    if (!modTast || e.altKey || e.shiftKey) return;
    const tal = /^Digit([1-9])$/.exec(e.code || '') || /^([1-9])$/.exec(e.key || '');
    if (tal && Number(tal[1]) <= ID.length) {
      if (laast()) return;
      e.preventDefault();
      gaaTil(ID[Number(tal[1]) - 1]);
    } else if (!mac && (e.key === ',' || e.code === 'Comma')) {
      e.preventDefault();
      aabnDialog('dlg-indst');
    }
  });

  // Fodlinje og Om: programmets og kernens version.
  function saetVersion(ids, v) {
    for (const id of ids) {
      $(id).setAttribute('data-v', v);
      S.anvend($(id));
    }
  }
  if (tauri) {
    if (tauri.app && tauri.app.getVersion) tauri.app.getVersion().then(v => saetVersion(['fod-version', 'om-version'], v)).catch(() => { });
    if (tauri.core && tauri.core.invoke) tauri.core.invoke('kerne_version').then(v => saetVersion(['fod-kerne', 'om-kerne'], v)).catch(() => { });
    if (tauri.event && tauri.event.listen) {
      tauri.event.listen('menu', e => { if (MENU[e.payload]) aabnDialog(MENU[e.payload]); });
      // Fuldskærm på macOS: trafiklysene er skjult, og titellinjen giver ikke plads til dem (app.css).
      tauri.event.listen('fuldskaerm', e => document.documentElement.toggleAttribute('data-fuldskaerm', e.payload === true));
    }
  }

  fraAdresse();
  S.anvend(document);
  opdaterVis();
  /* maskering.js: registrér en handling for en kommando (visning:id) og nå visningernes dele. */
  const haandter = (visning, id, fn) => { HANDLINGER[visning + ':' + id] = fn; };
  window.Grimnir = { vis: gaaTil, get aktiv() { return aktivVisning; }, get laast() { return laast(); }, VISNINGER, dele, haandter, mac, mod, aabnDialog, kitDialog, bekraeft, tauri };
})();
