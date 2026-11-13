/* Grimnir — programskallen bygget af kittet (window.Kit). Fem visninger (Maskér, Demaskér, Noter, Sager, Ordbog; V-OPBYG.2:
   Noter), hver med sin
   CommandBar (uden egen fanerække), sit træ i NavPane, sin værktøjslinje og en tom tilstand. V-FANER.2 (D26): der står
   kun ét bånd: de fire visninger er store knapper forrest i det (kittets visninger i commandBar, links til #id med
   aria-current="page"), og resten er den valgte visnings kommandoer; det, der ikke er plads til på én række, står i
   kittets Mere-menu sidst i båndet. Visningen står i adressen (#masker …) og skiftes med knapperne eller ⌘1–⌘4 (Ctrl på
   Windows; V-OPBYG.2: ⌘1–⌘5). Fanen Vis er væk (V-FANER.1): tema og sprog står under tandhjulet
   (Indstillinger), tekststørrelsen i Indstillinger og i menuen Vis. Maskér og Demaskér (maskering.js), Sager
   (sager.js), Ordbog (ordbog.js) og Indstillinger (indstillinger.js) virker via window.Grimnir; resten af kommandoerne
   fra design/skaerme/ står nedtonet med en forklaring, til funktionen kommer (v2).
   V-LAAS.2: mens <html data-laast> står (laas.js), er båndet (med visningerne) nedtonet, og ⌘1–⌘4 gør intet;
   Indstillinger (⌘, / Ctrl+,) og Om virker.
   Rust giver: kerne_version (fodlinjen), hændelsen 'menu' ("om" | "indstillinger" | "afslut"; "aabn" | "gem" håndteres
   af maskering.js; V-KITBRUG.2: "tekst-stoerre" | "tekst-mindre" | "tekst-normal" fra menuen Vis), hændelsen 'fuldskaerm'
   (true | false) og platformen (<html data-platform>). */
(function () {
  'use strict';
  const K = window.Kit, S = window.Sprog;
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
    // V-MANUEL.1: Fortryd, Gentag, Ryd og Maskér dette (en markering med et plus).
    fortryd: [['path', { d: 'M9 14L4 9l5-5' }], ['path', { d: 'M4 9h10.5a5.5 5.5 0 0 1 0 11H11' }]],
    gentag: [['path', { d: 'M15 14l5-5-5-5' }], ['path', { d: 'M20 9H9.5a5.5 5.5 0 0 0 0 11H13' }]],
    ryd: [['path', { d: 'M8 20h12' }], ['path', { d: 'M4.6 14.6l9.2-9.2a2 2 0 0 1 2.8 0l2 2a2 2 0 0 1 0 2.8L11 18.8H8.8z' }], ['path', { d: 'M9.5 9.7l4.8 4.8' }]],
    markering: [['path', { d: 'M4 8V5h3M17 5h3v3M20 16v3h-3M7 19H4v-3' }], ['path', { d: 'M12 8.5v7M8.5 12h7' }]],
    // V-OPBYG.3 N3: ⓘ for Om Grimnir i titellinjen (kittet har intet info-ikon; ønske G36).
    info: [['circle', { cx: 12, cy: 12, r: 9 }], ['path', { d: 'M12 11v6' }], ['path', { d: 'M12 7.5v.5' }]],
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
      tom: ['tomMaskerH', 'tomMaskerP'], modtager: 'ariaIndsaetTekst', indsaetT: 'kIndsaetTekst',
      grupper: [
        // V-MANUEL.1: Ryd i Tekst; Fortryd og Gentag i en egen gruppe (Rediger, som menuen); Maskér dette først i Maskering.
        { t: 'gTekst', knapper: [aktiv('masker', 'indsaet', 'kIndsaet', 'indsaet', false, true), aktiv('masker', 'aabn-fil', 'kAabnFil', 'fil', false, true), aktiv('masker', 'ryd', 'kRyd', 'ryd')] },
        // V-OPBYG.1 (D27): Maskér dette hedder Maskér markering og står under Rediger; Analysér igen og Maskér i Maskering.
        { t: 'gRediger', knapper: [aktiv('masker', 'fortryd', 'kFortryd', 'fortryd'), aktiv('masker', 'gentag', 'kGentag', 'gentag'), aktiv('masker', 'masker-dette', 'kMaskerDette', 'markering')] },
        { t: 'gMaskering', knapper: [aktiv('masker', 'analyser', 'kAnalyser', 'soeg'), aktiv('masker', 'gem-masker', 'kGemMasker', 'skjold', true), aktiv('masker', 'foer-efter', 'kFoerEfter', 'foerefter')] },
        // V-FIL.1: Gem maskeret fil ved siden af Kopiér. V-KVIT.1: Kopiér kvittering (aktiv, når der er et maskeret resultat).
        { t: 'gResultat', knapper: [aktiv('masker', 'kopier', 'kKopier', 'kopier'), aktiv('masker', 'gem-fil', 'kGemMaskeretFil', 'gem'), aktiv('masker', 'kvittering', 'kKvittering', 'kvittering')] },
      ],
      /* V-OPBYG.1 (D27): filtrene efter skitsen: Alle fund, Maskeres (Maskerede efter maskeringen), Bevares (Bevarede),
         Kræver gennemgang og Hemmeligheder. V-MANUEL.2's "Kendt fra sagen" (fundene, sagen kendte i forvejen) står som et
         filter under dem (maskering.js skifter ordene før og efter). */
      trae: [
        { id: 'denne', t: 'tDenneTekst', boern: [{ id: 'alle', t: 'tAlleFund', antal: 0 }, { id: 'masker', t: 'tMaskeres', antal: 0 }, { id: 'bevar', t: 'tBevares', antal: 0 }, { id: 'tjek', t: 'tSkalTjekkes', antal: 0 }, { id: 'hemmelig', t: 'tHemmeligheder', antal: 0 }, { id: 'seneste', t: 'tKendtFraSagen', antal: 0 }] },
      ],
      valgt: 'alle',
    },
    {
      id: 'demasker', t: 'vDemasker', ikon: 'oeje', soeg: 'soegDemasker', chip: 'chipIntetSvar', fod: 'fodDemasker',
      tom: ['tomDemaskerH', 'tomDemaskerP'], modtager: 'ariaIndsaetSvar', indsaetT: 'kIndsaetSvar', anden: { t: 'kGaaTilSager', ikon: 'mappe' },
      grupper: [
        // V-MANUEL.1: Ryd i Svar; Næste advarsel er bygget (N4) og styres af maskering.js som de andre.
        { t: 'gSvar', knapper: [aktiv('demasker', 'indsaet', 'kIndsaet', 'indsaet', false, true), aktiv('demasker', 'aabn-fil', 'kAabnFil', 'fil', false, true), aktiv('demasker', 'ryd', 'kRyd', 'ryd')] },
        { t: 'gDemaskering', knapper: [aktiv('demasker', 'demasker', 'kDemasker', 'oeje', true), aktiv('demasker', 'naeste-advarsel', 'kNaesteAdvarsel', 'naeste')] },
        { t: 'gResultat', knapper: [aktiv('demasker', 'kopier-resultat', 'kKopierResultat', 'kopier'), aktiv('demasker', 'gem-fil', 'kGemFil', 'gem')] },
      ],
      trae: [
        { id: 'dette', t: 'tDetteSvar', boern: [{ id: 'alle', t: 'tAlleKoder', antal: 0 }, { id: 'advarsler', t: 'tAdvarsler', antal: 0 }, { id: 'ikke-brugt', t: 'tIkkeBrugt', antal: 0 }] },
      ],
      valgt: 'alle',
    },
    /* V-OPBYG.2 N2: fanen Noter mellem Demaskér og Sager, som skitsen (noter.js). Båndet: Noter (Ny note, Ret note, Slet note)
       og Del (Kopiér noterne). Træet har ét punkt med antallet. */
    {
      id: 'noter', t: 'vNoter', ikon: 'rediger', soeg: 'soegNoter', chip: 'chipIngenNoter',
      tom: ['tomNoterH', 'tomNoterP'],
      grupper: [
        { t: 'gNoter', knapper: [aktiv('noter', 'ny-note', 'kNyNote', 'plus', true, true), aktiv('noter', 'ret-note', 'kRetNote', 'rediger'), aktiv('noter', 'slet-note', 'kSletNote', 'slet')] },
        { t: 'gDel', knapper: [aktiv('noter', 'kopier-noter', 'kKopierNoter', 'kopier')] },
      ],
      trae: [
        { id: 'noter', t: 'tNoterISagen', boern: [{ id: 'alle', t: 'tAlleNoter', antal: 0 }] },
      ],
      valgt: 'alle',
    },
    {
      id: 'sager', t: 'vSager', ikon: 'mappe', soeg: 'soegSager', chip: 'chipIngenSager', fod: 'fodSager',
      tom: ['tomSagerH', 'tomSagerP'],
      grupper: [
        // V-MANUEL.2 N1: Vis indhold (sagens koder og rigtige værdier; Enter og dobbeltklik på rækken gør det samme).
        // V-OPBYG.1 N4: Gem som sag… (den midlertidige sag får et navn; samme dialog som Ny sag) står først.
        { t: 'gSag', knapper: [aktiv('sager', 'gem-som-sag', 'kGemSomSag', 'gem'), aktiv('sager', 'ny-sag', 'kNySag', 'plus', true, true), aktiv('sager', 'vis-indhold', 'kVisIndhold', 'oeje'), aktiv('sager', 'aabn-i-masker', 'kAabnIMasker', 'aabn'), aktiv('sager', 'omdoeb', 'kOmdoeb', 'rediger'), aktiv('sager', 'udloeb', 'kUdloeb', 'kalender')] },
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

  const $ = id => document.getElementById(id);
  const laast = () => document.documentElement.hasAttribute('data-laast');
  const baand = $('baand'), navdele = $('navdele'), arb = $('arb');
  const dele = {};
  /* V-FANER.2 (D26): de fire visninger forrest i hvert bånd: ikon og navn, genvejen ⌘1–⌘4 (Ctrl på Windows) i knappens
     værktøjstip og i aria-keyshortcuts. Gruppenavnet er den nøgle, fanerækken havde som navn (Visninger/Views). */
  /* V-OPBYG.1 (D27): visningerne er båndets egne faner (kittets visninger med som: 'faner', 2.8.0) uden ikon, som i skitsen;
     Ordbog står for sig til højre. */
  const VIS_PUNKTER = VISNINGER.map((v, i) => ({ id: v.id, t: v.t, genvej: mod + (i + 1), genvejAria: (mac ? 'Meta+' : 'Control+') + (i + 1), hoejre: v.id === 'ordbog' }));

  for (const v of VISNINGER) {
    // CommandBar
    const cmd = document.createElement('div');
    cmd.dataset.visning = v.id;
    baand.appendChild(cmd);
    // V-KITBRUG.2 N3 (G11): "hvorfor" en kommando er slået fra, står i kittets værktøjstip (mus og tastatur), ikke i title.
    // V-FANER.2 (D26): ét bånd uden fanerække: visningerne forrest, så visningens kommandoer, og Mere sidst (G21: det, der
    // ikke er plads til på én række, står i Mere-menuen).
    const bar = K.commandBar(cmd, { ariaT: 'cmdAria', hvorforTip: true, udenFaner: true, visninger: { t: 'visninger', som: 'faner', punkter: VIS_PUNKTER }, mere: { t: 'kMere' }, faner: [{ id: 'start', grupper: v.grupper }] });

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
    sek.id = 'visning-' + v.id;
    // Arbejdsfladen er et område med visningens navn (V-FANER.2: ikke længere et fanepanel; visningerne er links).
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
    // V-KITBRUG.1 N3: kittets tomme tilstand (ikon, overskrift og én sætning); Sager og Ordbog lægger selv deres knap i den.
    // V-KITBRUG.2 N3 (G8): i Maskér og Demaskér er den kittets flade, der tager imod (fokus, navn med ⌘V), med Åbn fil og
    // i Demaskér "Åbn Sager" som den anden handling (vist af maskering.js, når der skal en sag til). Indsæt tager
    // maskering.js imod på hele siden (også her), og en fil, der slippes, kommer fra Rust; .tomt-slip sætter maskering.js.
    // V-MANUEL.2 N1: også Maskér har en anden handling, "Vis sagens indhold", når sagen har værdier, og i Demaskér bliver
    // den anden handling "Vis sagens indhold", når sagen har koder (maskering.js viser, skjuler og navngiver den; handlingen
    // er visningens 'tom-anden'). Uden en registreret handling går den til Sager som før.
    /* V-OPBYG.1 N3 (skitsen): i Maskér og Demaskér er Indsæt (tekst/svar) den fremhævede handling og Åbn fil den anden;
       under overskriften og sætningen står sagen (maskering.js udfylder .tomt-sag), og under knapperne linjen om ⌘V og at
       slippe en fil. "Vis sagens indhold" står nu i venstre side (Gemte erstatninger). Demaskér har desuden "Åbn Sager",
       når sagen ingen koder har, og der er gemte sager (maskering.js viser den). */
    const tomO = { ikon: v.ikon, t: v.tom[0], p: { t: v.tom[1] } };
    if (v.modtager) {
      tomO.modtager = { ariaT: v.modtager, ariaV: mod + 'V' };
      tomO.handling = { t: v.indsaetT, ikon: 'indsaet', variant: 'primary', ved: e => { const h = HANDLINGER[v.id + ':indsaet']; if (h) h(e); } };
      tomO.anden = { t: 'kAabnFil', ikon: 'fil', ved: e => { const h = HANDLINGER[v.id + ':aabn-fil']; if (h) h(e); } };
    }
    const tom = K.tomTilstand(tomO);
    const p = tom.querySelector('.tomt-p');
    if (v.modtager) {
      const sagP = document.createElement('p');
      sagP.className = 'tomt-sag';
      p.after(sagP);
      const linje = document.createElement('p');
      linje.className = 'tomt-linje';
      linje.setAttribute('data-t', 'tomLinje');
      linje.setAttribute('data-v', mod + 'V');
      tom.appendChild(linje);
      if (v.anden) {
        const ekstra = K.knap({ t: v.anden.t, ikon: v.anden.ikon, variant: 'ghost', ved: e => { const h = HANDLINGER[v.id + ':tom-anden']; if (h) h(e); else gaaTil('sager'); } });
        ekstra.classList.add('tomt-ekstra');
        ekstra.hidden = true;
        tom.appendChild(ekstra);
      }
    }
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

  /* V-FANER.2: et klik (og mellemrum, som kittet gør til et klik) på en visningsknap går via adressen som før. Mens
     Grimnir er låst, er båndet inert og nedtonet (laas.js, app.css); med en dialog åben dækker dialogen siden. Begge dele
     holdes også her: et klik gør intet, mens der er låst, eller en dialog er åben (som ⌘1–⌘4). */
  baand.addEventListener('click', e => {
    if (e.target.closest('.vk') && (laast() || document.querySelector('dialog[open]'))) e.preventDefault();
  }, true);
  const markér = id => { for (const v of VISNINGER) dele[v.id].bar.visninger.markér(id); };

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
    markér(id);
    // V-OPBYG.2 N4: fodlinjen tegnes af maskering.js (tegnFodlinje) ved 'grimnir-visning', ens i alle visninger.
    document.dispatchEvent(new CustomEvent('grimnir-visning', { detail: id }));
  }
  const fraAdresse = () => vis(decodeURIComponent(location.hash.slice(1)));
  window.addEventListener('hashchange', fraAdresse);
  function gaaTil(id) {
    if (location.hash !== '#' + id) location.hash = id;
    else vis(id);
  }

  /* V-OPBYG.1 N7: Vejledning beder styresystemet åbne Grimnirs vejledning i browseren (Rust: vejledning_aabn med kun
     sproget; to faste adresser). Virker også, mens Grimnir er låst. Går det ikke, står det i et banner under titellinjen. */
  const invoke = (c, a) => tauri.core.invoke(c, a);
  /* V-OPBYG.3 N3: samme kommando fra titellinjen og fra Om Grimnir (Åbn vejledningen). */
  function aabnVejledning() {
    if (!tauri || !tauri.core || !tauri.core.invoke) return;
    invoke('vejledning_aabn', { sprog: S.lang }).catch(() => {
      const rod = $('laas-banner');
      for (const b of rod.querySelectorAll('.ban[data-vejledning]')) b.remove();
      const b = K.banner({ variant: 'warn', t: 'bVejledningFejl', handling: { t: 'luk', ariaT: 'ariaLukBesked', ved: () => b.remove() } });
      b.dataset.vejledning = '';
      rod.appendChild(b);
      S.anvend(b);
    });
  }
  $('vejledning').addEventListener('click', aabnVejledning);

  // Titellinjen: indstillinger
  const indstKnap = $('aabn-indst');
  indstKnap.appendChild(K.ikon('tandhjul', 'ik'));
  indstKnap.setAttribute('data-v', mod + ',');
  // V-OPBYG.3 N3: ⓘ ved tandhjulet åbner Om Grimnir (kun ikonet; navnet i aria-label og værktøjstip), også låst.
  const omKnap = $('aabn-om');
  omKnap.appendChild(K.ikon('info', 'ik'));

  /* Dialoger. Alle Grimnirs dialoger er kittets (V-KITBRUG.2 N1: også Indstillinger, sagens dialog, Tilføj post, Prøv
     på tekst og guiden). kitDialog bygger med Kit.dialog: id og knappernes id'er giver kittet (G3: id, knapId), fejlfeltet
     giver kittet (G1: fejl, d.fejl), og en nøgle i fejlfeltet udfyldes af sproget. Dialogen står i <body> fra start, så
     den kan findes, før den åbnes. Kun én dialog er åben ad gangen: aabnDialog lukker de andre og åbner den ene; fokus
     kan peges på (et knap-svar, et id eller et element), ellers vælger kittet. bekraeft er kittets Kit.bekraeft med
     samme regel (fra 2.5.0 med ved: en bekræftelse, der kan fejle, G2). */
  /* V-PUDS.3 N4: fejlen i fejlfeltet ryddes, når brugeren ændrer det felt, den handler om (d.fejl(tekst, felt), også en
     liste af felter), eller et vilkårligt felt i dialogen, når den ikke hører til ét felt (d.fejl(tekst) og en fejl fra
     Rust efter et forsøg, som kittet selv viser). Feltet hører kun til den tekst, det blev sat med: en fejl, kittet
     selv har sat (fra Rust, eller fejlfeltet tømt ved åbning), gælder hele dialogen. Lytteren står i opsamlingsfasen,
     så en fejl, som feltets egen lytter sætter ved samme ændring, bliver stående. Kittet har det ikke (kit-ønske G17). */
  const KITDLG = {};
  function kitDialog(o) {
    const dl = K.dialog({ udfyld: e => S.anvend(e), ...o });
    document.body.appendChild(dl.rod);
    S.anvend(dl.rod);
    if (o.fejl) {
      const kitFejl = dl.fejl, fejlEl = dl.rod.querySelector('.modal-fejl');
      let fejlFelt = null, fejlTekst = null;
      dl.fejl = (v, felt) => {
        kitFejl(v);
        fejlFelt = v != null && felt ? [].concat(felt) : null;
        fejlTekst = fejlFelt ? fejlEl.textContent : null;
      };
      const ryd = e => {
        if (!fejlEl.textContent) return;
        const felt = fejlFelt && fejlEl.textContent === fejlTekst ? fejlFelt : null;
        if (felt && !felt.includes(e.target)) return;
        fejlFelt = null;
        kitFejl(null);
      };
      dl.rod.addEventListener('input', ryd, true);
      dl.rod.addEventListener('change', ryd, true);
    }
    KITDLG[o.id] = dl;
    return dl;
  }
  function lukAndre(d) { for (const andet of document.querySelectorAll('dialog[open]')) if (andet !== d) andet.close(); }
  function aabnDialog(id, fokus) {
    lukAndre(KITDLG[id].rod);
    KITDLG[id].aabn(fokus);
  }
  function bekraeft(o) { lukAndre(null); return K.bekraeft(o); }

  /* Om: med kittets fletbånd øverst (ADR D16: ét sted; G5: foer). V-OPBYG.3 N3 (D28): masken ved navn, slogan og
     beskrivelse; den forklarende sætning; "Det kan du forvente" (fem punkter med ikon, sande for programmet, som det er:
     låsen er forskellig på macOS og Windows); versionerne; licensen og skrifterne; "Vis tredjepartslicenser" viser
     THIRD_PARTY_LICENSES.md (pakket med programmet; Rust: tredjepartslicenser) i dialogen; "Åbn vejledningen" er samme
     kommando som titellinjens. Dialogen ruller, når den er højere end vinduet (kittets .modal). Fokus står på Luk. */
  const elT = (tag, kl, t, id) => { const e = document.createElement(tag); if (kl) e.className = kl; if (t) e.setAttribute('data-t', t); if (id) e.id = id; return e; };
  const omIndhold = document.createElement('div');
  const omHoved = elT('div', 'om-hoved');
  const omMrk = elT('span', 'mrk-maske om-mrk');
  omMrk.setAttribute('aria-hidden', 'true');
  const identitet = elT('div', 'identitet');
  identitet.append(elT('p', 'id-navn', 'appNavn'), elT('p', 'id-slogan', 'slogan'), elT('p', 'id-beskrivelse', 'beskrivelse'));
  omHoved.append(omMrk, identitet);
  const OM_PUNKTER = [
    ['maske', 'omMaskerH', 'omMaskerP'],
    ['oeje', 'omDemaskerH', 'omDemaskerP'],
    ['mappe', 'omSagerH', 'omSagerP'],
    ['laas', 'omLaastH', mac ? 'omLaastPMac' : 'omLaastPWin'],
    ['skjold', 'omNetH', 'omNetP'],
  ];
  const omForvent = elT('section', 'om-forvent');
  omForvent.setAttribute('aria-labelledby', 'om-forvent-h');
  const omPunkter = elT('ul', 'om-punkter');
  for (const [ikon, h, p] of OM_PUNKTER) {
    const li = document.createElement('li');
    const tekst = elT('div', 'om-punkt');
    tekst.append(elT('p', 'om-punkt-h', h), elT('p', 'om-punkt-p', p));
    li.append(K.ikon(ikon, 'om-ikon'), tekst);
    omPunkter.appendChild(li);
  }
  omForvent.append(elT('h3', 'om-h3', 'omForventH', 'om-forvent-h'), omPunkter);
  const omTal = elT('ul', 'om-tal');
  const omVersion = elT('li', 'mono', 'version', 'om-version'), omKerne = elT('li', 'mono', 'kerne', 'om-kerne');
  omVersion.setAttribute('data-v', '…');
  omKerne.setAttribute('data-v', '…');
  omTal.append(omVersion, omKerne);
  const omLicens = elT('section', 'om-licens');
  omLicens.setAttribute('aria-labelledby', 'om-licens-h');
  const licensKnap = elT('button', 'btn', 'kVisLicenser', 'om-licenser');
  licensKnap.type = 'button';
  licensKnap.setAttribute('aria-expanded', 'false');
  licensKnap.setAttribute('aria-controls', 'om-licenstekst');
  const licensTekst = elT('pre', 'licenstekst', null, 'om-licenstekst');
  licensTekst.hidden = true;
  licensTekst.tabIndex = 0;
  licensTekst.setAttribute('data-t-aria', 'ariaLicenstekst');
  const licensFejl = elT('p', 'om-licensfejl', null, 'om-licensfejl');
  licensFejl.hidden = true;
  omLicens.append(elT('h3', 'om-h3', 'omLicensH', 'om-licens-h'), elT('p', 'om-linje', 'licens'), elT('p', 'om-linje', 'omSkrifter'), licensKnap, licensFejl, licensTekst);
  const vejlKnap = elT('button', 'btn', 'kAabnVejledning', 'om-vejledning');
  vejlKnap.type = 'button';
  vejlKnap.setAttribute('data-t-aria', 'ariaVejledning');
  vejlKnap.setAttribute('data-t-title', 'titelVejledning');
  vejlKnap.addEventListener('click', aabnVejledning);
  const omHandlinger = elT('div', 'om-handlinger');
  omHandlinger.appendChild(vejlKnap);
  omIndhold.append(omHoved, elT('p', 'om-p', 'omP'), omForvent, omTal, omLicens, omHandlinger);
  /* Licensteksten hentes første gang, den vises (den er pakket med programmet; intet net), og står så i dialogen. Skjul
     skjuler den igen; den bliver i DOM'en (den er offentlig tekst). */
  let licenserHentet = false;
  licensKnap.addEventListener('click', () => {
    const vis = licensTekst.hidden;
    const saet = aaben => {
      licensTekst.hidden = !aaben;
      licensKnap.setAttribute('aria-expanded', String(aaben));
      licensKnap.setAttribute('data-t', aaben ? 'kSkjulLicenser' : 'kVisLicenser');
      S.anvend(licensKnap);
    };
    if (!vis) { saet(false); return; }
    if (licenserHentet) { saet(true); return; }
    if (!tauri || !tauri.core || !tauri.core.invoke) return;
    licensFejl.hidden = true;
    invoke('tredjepartslicenser').then(t => {
      licensTekst.textContent = String(t);
      licenserHentet = true;
      saet(true);
    }).catch(() => {
      licensFejl.setAttribute('data-t', 'licenserFejl');
      licensFejl.hidden = false;
      S.anvend(licensFejl);
    });
  });
  const omFlet = elT('div', 'om-flet', null, 'om-flet');
  omFlet.appendChild(K.fletbaand());
  kitDialog({ id: 'dlg-om', t: 'omH', foer: omFlet, indhold: omIndhold, knapper: [{ id: 'luk', t: 'luk' }] });
  indstKnap.addEventListener('click', () => aabnDialog('dlg-indst'));
  omKnap.addEventListener('click', () => aabnDialog('dlg-om'));
  const MENU = { indstillinger: 'dlg-indst', om: 'dlg-om' };

  /* V-KITBRUG.2 N4: tekststørrelsen med ⌘+ (⌘= tæller med), ⌘− og ⌘0 (Ctrl på Windows) og fra menuen Vis (hændelsen
     'menu' med "tekst-stoerre", "tekst-mindre" og "tekst-normal"). Kittets Tekst stopper ved lille og stor og husker valget;
     Indstillinger følger med (hændelsen grimnir-tekst). Virker også låst og med en dialog åben: tekststørrelsen er
     visningens, ikke en handling på data. Tasterne fanges her på begge platforme og stoppes (preventDefault), så
     menuens genvej ikke også slår til på macOS (WebKit giver siden tastetrykket før menuen): menuens accelerator kan
     ikke være "+" (Tauri tager kun fysiske taster), og "+" og "=" ligger forskellige steder på danske og engelske
     tastaturer. Rust gemmer intet om tekststørrelsen. */
  const Tk = window.Tekst;
  const TEKST_TAST = { '+': 'større', '=': 'større', '-': 'mindre', 0: 'nulstil' };
  const TEKST_KODE = { NumpadAdd: 'større', NumpadSubtract: 'mindre', Numpad0: 'nulstil' };
  const TEKST_MENU = { 'tekst-stoerre': 'større', 'tekst-mindre': 'mindre', 'tekst-normal': 'nulstil' };

  // Tastatur: ⌘1–⌘5 (Ctrl på Windows; V-OPBYG.2: ⌘1 Maskér, ⌘2 Demaskér, ⌘3 Noter, ⌘4 Sager, ⌘5 Ordbog, i fanernes
  // rækkefølge); Ctrl+, på Windows (på macOS fanger programmenuen ⌘,). Visningernes egne genveje (⌘↵, ⇧⌘C) står i
  // maskering.js. V-KITBRUG.2 N5: ⌘1–⌘5 gør intet, mens en dialog er åben (som de andre genveje): visningen bag
  // dialogen skifter ikke.
  document.addEventListener('keydown', e => {
    const modTast = mac ? e.metaKey && !e.ctrlKey : e.ctrlKey && !e.metaKey;
    if (!modTast || e.altKey) return;
    const tekst = TEKST_TAST[e.key] || TEKST_KODE[e.code];
    if (tekst) {
      e.preventDefault();
      Tk[tekst]();
      return;
    }
    if (e.shiftKey) return;
    const tal = /^Digit([1-9])$/.exec(e.code || '') || /^([1-9])$/.exec(e.key || '');
    if (tal && Number(tal[1]) <= ID.length) {
      if (laast() || document.querySelector('dialog[open]')) return;
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
      tauri.event.listen('menu', e => {
        if (TEKST_MENU[e.payload]) Tk[TEKST_MENU[e.payload]]();
        else if (MENU[e.payload]) aabnDialog(MENU[e.payload]);
      });
      // Fuldskærm på macOS: trafiklysene er skjult, og titellinjen giver ikke plads til dem (app.css).
      tauri.event.listen('fuldskaerm', e => document.documentElement.toggleAttribute('data-fuldskaerm', e.payload === true));
    }
  }

  fraAdresse();
  S.anvend(document);
  /* maskering.js: registrér en handling for en kommando (visning:id) og nå visningernes dele. */
  const haandter = (visning, id, fn) => { HANDLINGER[visning + ':' + id] = fn; };
  window.Grimnir = { vis: gaaTil, get aktiv() { return aktivVisning; }, get laast() { return laast(); }, VISNINGER, dele, haandter, mac, mod, aabnDialog, kitDialog, bekraeft, tauri };
})();
