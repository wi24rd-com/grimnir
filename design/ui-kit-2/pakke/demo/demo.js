/* Wi24rd UI Kit 2 — demosidens eget script. Det viser, hvad et program selv skal levere: teksterne (to sprog), indholdet
   til kittets funktioner og hvad der sker ved valg. Alt andet er pakkens filer. Kun opdigtede data. */
(function () {
  'use strict';
  const K = window.Kit, T = window.Tema;

  /* ── Teksterne: programmets egne, i to sprog med samme nøgler ── */
  const S = window.Sprog = window.KitSprog.opret({
    standard: 'da',
    titel: 'dokTitel',
    tekst: {
      da: {
        dokTitel: 'Wi24rd UI Kit 2 — demo', appNavn: 'Wi24rd UI Kit 2', undertitel: 'Demo · pakke {v}',
        ariaSkiftTema: 'Skift tema: lys, mørk eller som systemet', ariaSkiftSprog: 'Skift sprog', skiftSprog: 'English',
        cmdAria: 'Handlingsbånd', faneStart: 'Start', faneVis: 'Vis', gTema: 'Tema', gSprog: 'Sprog', gEksempel: 'Eksempel',
        kLys: 'Lys', kMoerk: 'Mørk', kSystem: 'System', kDansk: 'Dansk', kEngelsk: 'English',
        kAabn: 'Åbn fil', kGem: 'Gem', kKopier: 'Kopiér', kSlet: 'Slet', hvorforIntetValgt: 'Vælg en række i tabellen først',
        navAria: 'Navigation', navH: 'Komponenter', traeAria: 'Filtrér komponenterne', visninger: 'Visninger',
        tAlle: 'Alle', tSkal: 'Skal', tIndhold: 'Indhold', tKontroller: 'Kontroller', tGrundlag: 'Grundlag',
        vKomponenter: 'Komponenter', vTokens: 'Tokens',
        soegEtiket: 'Søg i komponenter', soegPh: 'Søg i komponenter', rydFilter: 'Ryd filter',
        chipViser: '{v} {v:komponent|komponenter}', chipIngen: 'Ingen fundet',
        fodAntal: '{v} {v:komponent vises|komponenter vises}', fodLokal: 'Intet hentes udefra', fodVersion: 'Pakke {v}',
        fodVenstre: '{v} fund · {w} maskeres',
        intetValgt: 'Intet valgt endnu.', valgt: 'Valgt: {v}',
        pAppShell: 'Hele denne side er skallen: titellinje, handlingsbånd, navigationsrude, arbejdsflade med værktøjslinje, og fodlinje.',
        pCommandBar: 'Faner skifter båndets indhold, aldrig visningen. Én primær kommando; en kommando, der ikke kan bruges, står nedtonet og siger hvorfor.',
        pNavPane: 'Træet filtrerer arbejdsfladen; visningsskiftet nederst skifter visning. Piletasterne flytter, højre og venstre folder ud og ind.',
        navDemoH: 'Filtre', tFund: 'Alle fund', tTjek: 'Skal tjekkes', tHemmelige: 'Hemmeligheder', tTyper: 'Typer', tAdresser: 'Adresser', tNavne: 'Navne',
        vEt: 'Første visning', vTo: 'Anden visning',
        pStatusFooter: 'Det, der altid gælder: antal til venstre, tillid og version til højre.',
        pDataTable: 'Hele rækken vælges med klik eller piletaster. Grupper deler tabellen; tal står til højre; værdier i mono.',
        kolVaerdi: 'Værdi', kolType: 'Type', kolStatus: 'Status', kolAntal: 'Antal',
        grpAdresser: 'Adresser', grpNavne: 'Navne', noteTo: '2 rækker', typeIp: 'IP-adresse', typeVaert: 'Værtsnavn', typeBruger: 'Brugernavn',
        cOk: 'Maskeres', cWarn: 'Skal tjekkes', cDanger: 'Ukendt', cInfo: 'Ny', cNone: 'Springes over',
        pStatusChip: 'Status har altid symbol, ord og farve. Fem varianter: ok, warn, danger, info og none.',
        pBanner: 'Én sætning og højst én handling. Advarsel og fejl læses op med det samme (role="alert").',
        bInfo: 'Teksten er indsat. Vælg Analysér for at finde værdierne.', bOk: 'Resultatet er kopieret.',
        bWarn: '2 værdier skal tjekkes, før du deler teksten.', bDanger: 'Filen kunne ikke åbnes.', hVis: 'Vis dem', hProev: 'Prøv igen',
        pWizard: 'Ét trin ad gangen. Trin, der er nået, kan klikkes; fodlinjen har de samme knapper hele vejen.',
        wT1: 'Velkommen', wT2: 'Dine domæner', wT3: 'Færdig',
        wH1: 'Sådan virker det', wP1: 'Tre ting, du skal vide, før du går i gang.',
        wH2: 'Dine domæner', wP2: 'Skriv de domæner, der er dine.', wH3: 'Du er klar', wP3: 'Du kan altid ændre det i indstillingerne.',
        naeste: 'Næste', tilbage: 'Tilbage', faerdig: 'Færdig', springOver: 'Spring over',
        feltDomaene: 'Domæne', hjDomaene: 'Fx eksempel.dk',
        pButton: 'Fire varianter: primær, sekundær, farlig og diskret. Højst én primær pr. skærm.',
        knPrimaer: 'Gem og maskér', knSekundaer: 'Åbn fil', knFarlig: 'Slet sag', knDiskret: 'Fortryd', knFra: 'Kan ikke bruges',
        pTextField: 'Etiket over feltet, hjælp eller fejl under. Følsomme felter har ingen stavekontrol eller autoudfyld.',
        fNavn: 'Navn', fVaert: 'Værtsnavn', fNet: 'Eget net', hjNavn: 'Det navn, du selv vil kende sagen på.',
        hjVaert: 'Står i mono, så det kan læses tegn for tegn.', fejlNet: 'Skriv et net som 192.0.2.0/24.',
        hIkoner: 'Ikoner', pIkoner: 'Stregikoner, 24 × 24, tegnet i tekstens farve. Et program lægger sine egne til med registrerIkoner.',
        pFletbaand: 'Kittets ene pynteelement. Ét sted pr. skærm, ingen betydning.',
        hGrundlag: 'Grundlag', pGrundlag: 'Hjælpeklasser: .label, .muted, .mono, .ik og .skjult-tekst. Fokusringen ses, når du bruger Tab.',
        gLabel: 'Etiket med store bogstaver', gMuted: 'Sekundær tekst', gIk: 'Ikon på 16 px ved siden af tekst',
        gSkjult: 'Her står en tekst, som kun skærmlæsere får.', gSkjultTekst: 'Denne tekst ses ikke, men læses op.',
        hFarver: 'Farver', pFarver: 'Alle farver i det valgte tema. Skift tema i titellinjen eller på fanen Vis.',
        hSkrift: 'Skrift', pSkrift: 'Inter til alt, JetBrains Mono til værdier. Begge ligger i pakken.',
        hLuft: 'Luft, radier og skygger', pLuft: 'Luft i trin på 4 px; små radier; kanter frem for skygger.',
        pSkygge: 'shadow-pop: til dialoger og menuer over siden.', eksempelTekst: 'Ro, klarhed og ét tydeligt næste skridt',
      },
      en: {
        dokTitel: 'Wi24rd UI Kit 2 — demo', appNavn: 'Wi24rd UI Kit 2', undertitel: 'Demo · package {v}',
        ariaSkiftTema: 'Switch theme: light, dark or as the system', ariaSkiftSprog: 'Switch language', skiftSprog: 'Dansk',
        cmdAria: 'Command bar', faneStart: 'Home', faneVis: 'View', gTema: 'Theme', gSprog: 'Language', gEksempel: 'Example',
        kLys: 'Light', kMoerk: 'Dark', kSystem: 'System', kDansk: 'Dansk', kEngelsk: 'English',
        kAabn: 'Open file', kGem: 'Save', kKopier: 'Copy', kSlet: 'Delete', hvorforIntetValgt: 'Select a row in the table first',
        navAria: 'Navigation', navH: 'Components', traeAria: 'Filter the components', visninger: 'Views',
        tAlle: 'All', tSkal: 'Shell', tIndhold: 'Content', tKontroller: 'Controls', tGrundlag: 'Basics',
        vKomponenter: 'Components', vTokens: 'Tokens',
        soegEtiket: 'Search the components', soegPh: 'Search the components', rydFilter: 'Clear filter',
        chipViser: '{v} {v:component|components}', chipIngen: 'None found',
        fodAntal: '{v} {v:component shown|components shown}', fodLokal: 'Nothing is fetched from outside', fodVersion: 'Package {v}',
        fodVenstre: '{v} findings · {w} will be masked',
        intetValgt: 'Nothing selected yet.', valgt: 'Selected: {v}',
        pAppShell: 'This whole page is the shell: title bar, command bar, navigation pane, work area with a toolbar, and footer.',
        pCommandBar: 'Tabs change the content of the bar, never the view. One primary command; a command that cannot be used is dimmed and says why.',
        pNavPane: 'The tree filters the work area; the view switcher at the bottom changes view. Arrow keys move, right and left expand and collapse.',
        navDemoH: 'Filters', tFund: 'All findings', tTjek: 'To be checked', tHemmelige: 'Secrets', tTyper: 'Types', tAdresser: 'Addresses', tNavne: 'Names',
        vEt: 'First view', vTo: 'Second view',
        pStatusFooter: 'What always applies: counts on the left, trust and version on the right.',
        pDataTable: 'The whole row is selected with a click or the arrow keys. Groups divide the table; numbers are right-aligned; values are in mono.',
        kolVaerdi: 'Value', kolType: 'Type', kolStatus: 'Status', kolAntal: 'Count',
        grpAdresser: 'Addresses', grpNavne: 'Names', noteTo: '2 rows', typeIp: 'IP address', typeVaert: 'Host name', typeBruger: 'User name',
        cOk: 'Will be masked', cWarn: 'To be checked', cDanger: 'Unknown', cInfo: 'New', cNone: 'Skipped',
        pStatusChip: 'A status always has a symbol, a word and a colour. Five variants: ok, warn, danger, info and none.',
        pBanner: 'One sentence and at most one action. Warnings and errors are announced at once (role="alert").',
        bInfo: 'The text is pasted. Choose Analyse to find the values.', bOk: 'The result is copied.',
        bWarn: '2 values must be checked before you share the text.', bDanger: 'The file could not be opened.', hVis: 'Show them', hProev: 'Try again',
        pWizard: 'One step at a time. Steps you have reached can be clicked; the footer has the same buttons all the way.',
        wT1: 'Welcome', wT2: 'Your domains', wT3: 'Done',
        wH1: 'How it works', wP1: 'Three things to know before you start.',
        wH2: 'Your domains', wP2: 'Enter the domains that are yours.', wH3: 'You are ready', wP3: 'You can always change it in the settings.',
        naeste: 'Next', tilbage: 'Back', faerdig: 'Done', springOver: 'Skip',
        feltDomaene: 'Domain', hjDomaene: 'E.g. example.com',
        pButton: 'Four variants: primary, secondary, danger and ghost. At most one primary per screen.',
        knPrimaer: 'Save and mask', knSekundaer: 'Open file', knFarlig: 'Delete case', knDiskret: 'Undo', knFra: 'Cannot be used',
        pTextField: 'Label above the field, help or error below. Sensitive fields have no spell check or autofill.',
        fNavn: 'Name', fVaert: 'Host name', fNet: 'Own network', hjNavn: 'The name you want to know the case by.',
        hjVaert: 'Shown in mono, so it can be read character by character.', fejlNet: 'Enter a network like 192.0.2.0/24.',
        hIkoner: 'Icons', pIkoner: 'Line icons, 24 × 24, drawn in the colour of the text. A program adds its own with registrerIkoner.',
        pFletbaand: 'The one ornament of the kit. One place per screen, no meaning.',
        hGrundlag: 'Basics', pGrundlag: 'Helper classes: .label, .muted, .mono, .ik and .skjult-tekst. The focus ring shows when you use Tab.',
        gLabel: 'Label in capitals', gMuted: 'Secondary text', gIk: '16 px icon next to text',
        gSkjult: 'Here is a text that only screen readers get.', gSkjultTekst: 'This text is not seen, but it is read aloud.',
        hFarver: 'Colours', pFarver: 'All colours in the chosen theme. Switch theme in the title bar or on the View tab.',
        hSkrift: 'Type', pSkrift: 'Inter for everything, JetBrains Mono for values. Both are in the package.',
        hLuft: 'Spacing, radii and shadows', pLuft: 'Spacing in steps of 4 px; small radii; borders rather than shadows.',
        pSkygge: 'shadow-pop: for dialogs and menus above the page.', eksempelTekst: 'Calm, clarity and one clear next step',
      },
    },
  });

  const $ = id => document.getElementById(id);
  const TEMA_IKON = { lys: 'sol', moerk: 'maane', system: 'skaerm' };

  /* ── Titellinjen: tema og sprog ── */
  const temaKnap = $('skift-tema'), sprogKnap = $('skift-sprog');
  temaKnap.addEventListener('click', () => T.saet(T.VALG[(T.VALG.indexOf(T.valg) + 1) % T.VALG.length]));
  sprogKnap.addEventListener('click', () => S.saet(S.lang === 'da' ? 'en' : 'da'));

  /* ── Handlingsbåndet (skallens) ── */
  const baand = K.commandBar($('baand'), {
    ariaT: 'cmdAria',
    valgt: 'vis',
    faner: [
      { id: 'start', t: 'faneStart', grupper: [
        { t: 'gEksempel', knapper: [
          { id: 'aabn', t: 'kAabn', ikon: 'fil', pri: true, ved: () => meld('baand-valgt', 'kAabn') },
          { id: 'gem', t: 'kGem', ikon: 'gem', ved: () => meld('baand-valgt', 'kGem') },
          { id: 'kopier', t: 'kKopier', ikon: 'kopier', deaktiveret: true, hvorfor: 'hvorforIntetValgt' },
        ] },
      ] },
      { id: 'vis', t: 'faneVis', grupper: [
        { t: 'gTema', knapper: T.VALG.map(v => ({ id: 'tema-' + v, t: { lys: 'kLys', moerk: 'kMoerk', system: 'kSystem' }[v], ikon: TEMA_IKON[v], trykket: T.valg === v, ved: () => T.saet(v) })) },
        { t: 'gSprog', knapper: [
          { id: 'sprog-da', t: 'kDansk', ikon: 'sprog', trykket: S.lang === 'da', ved: () => S.saet('da') },
          { id: 'sprog-en', t: 'kEngelsk', ikon: 'sprog', trykket: S.lang === 'en', ved: () => S.saet('en') },
        ] },
      ] },
    ],
  });
  function opdaterVis() {
    for (const v of T.VALG) baand.knap('tema-' + v).setAttribute('aria-pressed', String(T.valg === v));
    baand.knap('sprog-da').setAttribute('aria-pressed', String(S.lang === 'da'));
    baand.knap('sprog-en').setAttribute('aria-pressed', String(S.lang === 'en'));
    temaKnap.textContent = '';
    temaKnap.appendChild(K.ikon(TEMA_IKON[T.valg], 'ik'));
  }
  document.addEventListener('kit-demo-tema', opdaterVis);
  document.addEventListener('kit-demo-sprog', opdaterVis);

  /* Skriver "Valgt: …" under et eksempel. noegle er en tekstnøgle; ellers står teksten, som den er. */
  function meld(id, noegle, tekst) {
    const p = $(id);
    p.setAttribute('data-t', 'valgt');
    p.setAttribute('data-v', noegle ? S.t(noegle) : tekst);
    S.anvend(p);
  }

  /* ── Navigationsruden (skallens): træet filtrerer, visningsskiftet skifter ── */
  const sektioner = [...document.querySelectorAll('#v-komponenter .demo-sektion')];
  const soeg = $('soeg');
  const antalI = g => sektioner.filter(s => g === 'alle' || s.dataset.gruppe === g).length;
  let gruppe = 'alle';
  const trae = K.navTrae($('trae'), [
    { id: 'alle', t: 'tAlle', antal: antalI('alle'), boern: ['skal', 'indhold', 'kontroller', 'grundlag'].map(g => ({ id: g, t: 't' + g.charAt(0).toUpperCase() + g.slice(1), antal: antalI(g) })) },
  ], { ariaT: 'traeAria', valgt: 'alle', vedValg: id => { gruppe = id; filtrer(); } });

  const VISNINGER = ['komponenter', 'tokens'];
  const skift = K.visningsskift($('skift'), [
    { id: 'komponenter', t: 'vKomponenter', ikon: 'mappe', genvej: '1' },
    { id: 'tokens', t: 'vTokens', ikon: 'oeje', genvej: '2' },
  ], { ariaT: 'visninger' });
  function visning() {
    const id = VISNINGER.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'komponenter';
    for (const v of document.querySelectorAll('.visning')) v.hidden = v.dataset.visning !== id;
    skift.markér(id);
  }
  window.addEventListener('hashchange', visning);
  document.addEventListener('keydown', e => {
    if (e.target.closest('input,textarea,select') || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === '1' || e.key === '2') location.hash = VISNINGER[Number(e.key) - 1];
  });

  /* ── Værktøjslinjen: søgning, ryd og chippen med antallet ── */
  function filtrer() {
    const q = soeg.value.trim().toLowerCase();
    let n = 0;
    for (const s of sektioner) {
      const vis = (gruppe === 'alle' || s.dataset.gruppe === gruppe) && (!q || s.dataset.navn.toLowerCase().includes(q));
      s.hidden = !vis;
      if (vis) n++;
    }
    const plads = $('status-chip');
    plads.textContent = '';
    const chip = K.chip(n ? 'ok' : 'none', { t: n ? 'chipViser' : 'chipIngen' });
    chip.querySelector('.ord').setAttribute('data-v', String(n));
    plads.appendChild(chip);
    $('fod-antal').setAttribute('data-v', String(n));
    S.anvend(plads);
    S.anvend($('fod-antal'));
  }
  soeg.addEventListener('input', filtrer);
  $('ryd').addEventListener('click', () => { soeg.value = ''; trae.vaelg('alle'); });

  /* ── Fodlinjen ── */
  for (const id of ['fod-laas', 'demo-fod-laas']) {
    $(id).appendChild(K.ikon('laas'));
    const ord = document.createElement('span');
    ord.setAttribute('data-t', 'fodLokal');
    $(id).appendChild(ord);
  }

  /* ── Eksemplerne ── */
  $('flet-plads').appendChild(K.fletbaand());
  $('demo-flet').appendChild(K.fletbaand());

  K.commandBar($('demo-baand'), {
    ariaT: 'cmdAria',
    faner: [
      { id: 'a', t: 'faneStart', grupper: [
        { t: 'gEksempel', knapper: [
          { id: 'aabn', t: 'kAabn', ikon: 'fil', pri: true, ved: () => meld('baand-valgt', 'kAabn') },
          { id: 'gem', t: 'kGem', ikon: 'gem', ved: () => meld('baand-valgt', 'kGem') },
          { id: 'kopier', t: 'kKopier', ikon: 'kopier', deaktiveret: true, hvorfor: 'hvorforIntetValgt' },
          { id: 'slet', t: 'kSlet', ikon: 'slet', ved: () => meld('baand-valgt', 'kSlet') },
        ] },
        { t: 'gTema', knapper: [{ id: 'lys', t: 'kLys', ikon: 'sol', trykket: true }, { id: 'moerk', t: 'kMoerk', ikon: 'maane', trykket: false }] },
      ] },
      { id: 'b', t: 'faneVis', grupper: [{ t: 'gSprog', knapper: [{ id: 'da', t: 'kDansk', ikon: 'sprog', trykket: true }] }] },
    ],
  });

  K.navTrae($('demo-trae'), [
    { id: 'fund', t: 'tFund', antal: 16 },
    { id: 'tjek', t: 'tTjek', antal: 2 },
    { id: 'hemmelige', t: 'tHemmelige', antal: 1 },
    { id: 'typer', t: 'tTyper', boern: [{ id: 'adresser', t: 'tAdresser', antal: 9 }, { id: 'navne', t: 'tNavne', antal: 7 }] },
  ], { ariaT: 'traeAria', valgt: 'fund', vedValg: id => meld('trae-valgt', null, id) });
  K.visningsskift($('demo-skift'), [
    { id: 'komponenter', t: 'vEt', ikon: 'mappe', genvej: '1' },
    { id: 'tokens', t: 'vTo', ikon: 'bog', genvej: '2' },
  ], { ariaT: 'visninger' }).markér('komponenter');

  const tabel = K.tabel({
    ariaT: 'pDataTable',
    kolonner: [{ t: 'kolVaerdi' }, { t: 'kolType' }, { t: 'kolStatus' }, { t: 'kolAntal', tal: true }],
    raekker: [
      { gruppe: { t: 'grpAdresser' }, note: { t: 'noteTo' } },
      { celler: ['192.0.2.17', K.chip('none', { t: 'typeIp' }), K.chip('ok', { t: 'cOk' }), 4], mono: [0], data: '192.0.2.17' },
      { celler: ['2001:db8::17', K.chip('none', { t: 'typeIp' }), K.chip('warn', { t: 'cWarn' }), 1], mono: [0], data: '2001:db8::17' },
      { gruppe: { t: 'grpNavne' }, note: { t: 'noteTo' } },
      { celler: ['srv-app01.eksempel.dk', K.chip('none', { t: 'typeVaert' }), K.chip('ok', { t: 'cOk' }), 7], mono: [0], data: 'srv-app01.eksempel.dk' },
      { celler: ['testbruger', K.chip('none', { t: 'typeBruger' }), K.chip('info', { t: 'cInfo' }), 2], mono: [0], data: 'testbruger' },
    ],
    vedValg: (tr, data) => meld('tabel-valgt', null, data),
  });
  $('demo-tabel').appendChild(tabel);

  for (const [v, t] of [['ok', 'cOk'], ['warn', 'cWarn'], ['danger', 'cDanger'], ['info', 'cInfo'], ['none', 'cNone']]) $('demo-chips').appendChild(K.chip(v, { t }));

  $('demo-bannere').append(
    K.banner({ variant: 'info', t: 'bInfo' }),
    K.banner({ variant: 'ok', t: 'bOk' }),
    K.banner({ variant: 'warn', t: 'bWarn', handling: { t: 'hVis' } }),
    K.banner({ variant: 'danger', t: 'bDanger', handling: { t: 'hProev' } }),
  );

  const guideRod = $('demo-guide');
  const guide = K.guide(guideRod, {
    hId: 'demo-guide-h',
    trin: [
      { t: 'wT1', h: 'wH1', p: 'wP1' },
      { t: 'wT2', h: 'wH2', p: 'wP2', indhold: K.felt({ etiket: { t: 'feltDomaene' }, hjaelp: { t: 'hjDomaene' }, mono: true, foelsom: true }) },
      { t: 'wT3', h: 'wH3', p: 'wP3' },
    ],
    naeste: { t: 'naeste' }, tilbage: { t: 'tilbage' }, slut: { t: 'faerdig' }, spring: { t: 'springOver' },
    vedSkift: () => S.anvend(guideRod),
    vedSlut: () => guide.gaaTil(0),
    vedSpring: () => guide.gaaTil(2),
  });

  $('demo-knapper').append(
    K.knap({ t: 'knPrimaer', variant: 'primary', ikon: 'skjold', genvej: 'Ctrl+S' }),
    K.knap({ t: 'knSekundaer', ikon: 'fil' }),
    K.knap({ t: 'knFarlig', variant: 'danger', ikon: 'slet' }),
    K.knap({ t: 'knDiskret', variant: 'ghost' }),
  );
  $('demo-knapper-fra').append(
    K.knap({ t: 'knFra', variant: 'primary', deaktiveret: true }),
    K.knap({ t: 'knFra', deaktiveret: true }),
  );

  $('demo-felter').append(
    K.felt({ etiket: { t: 'fNavn' }, vaerdi: 'Supportsag 0042', hjaelp: { t: 'hjNavn' } }),
    K.felt({ etiket: { t: 'fVaert' }, vaerdi: 'srv-app01.eksempel.dk', mono: true, foelsom: true, hjaelp: { t: 'hjVaert' } }),
    K.felt({ etiket: { t: 'fNet' }, vaerdi: '192.0.2.0/33', mono: true, foelsom: true, fejl: { t: 'fejlNet' } }),
  );

  for (const navn of Object.keys(K.IKONER)) {
    const d = document.createElement('div');
    d.className = 'demo-ikon';
    d.appendChild(K.ikon(navn, 'ik'));
    const n = document.createElement('span');
    n.className = 'mono';
    n.textContent = navn;
    d.appendChild(n);
    $('demo-ikoner').appendChild(d);
  }

  /* ── Tokens-visningen. Navnene er dem i tokens.json (testen holder dem ens). ── */
  const FARVER = ['bg', 'surface', 'surface-raised', 'rail', 'rail-text', 'rail-strong', 'rail-active', 'accent-on-rail', 'border', 'border-strong', 'text', 'text-muted', 'accent', 'accent-hover', 'on-accent', 'accent-soft', 'info', 'info-soft', 'warn', 'warn-soft', 'danger', 'danger-soft'];
  const STILE = ['display', 'h1', 'h2', 'h3', 'body', 'small', 'label', 'mono'];
  const LUFT = ['space-1', 'space-2', 'space-3', 'space-4', 'space-6', 'space-8'];
  const RADIER = ['radius-sm', 'radius-md', 'radius-lg', 'radius-pill'];
  const mono = tekst => { const s = document.createElement('span'); s.className = 'mono'; s.textContent = tekst; return s; };
  for (const f of FARVER) {
    const d = document.createElement('div'), i = document.createElement('i');
    d.className = 'demo-farve';
    i.style.background = `var(--${f})`;
    d.append(i, mono(f));
    $('demo-farver').appendChild(d);
  }
  for (const s of STILE) {
    const d = document.createElement('div'), e = document.createElement('div');
    e.setAttribute('data-t', 'eksempelTekst');
    e.style.fontFamily = `var(--${s}-family)`;
    e.style.fontSize = `var(--${s}-size)`;
    e.style.lineHeight = `var(--${s}-line)`;
    e.style.fontWeight = `var(--${s}-weight)`;
    d.append(mono(s), e);
    $('demo-skrift').appendChild(d);
  }
  for (const l of LUFT) {
    const d = document.createElement('div'), i = document.createElement('i');
    i.style.width = `var(--${l})`;
    d.append(i, mono(l));
    $('demo-luft').appendChild(d);
  }
  for (const r of RADIER) {
    const d = document.createElement('span'), i = document.createElement('i');
    i.style.borderRadius = `var(--${r})`;
    d.append(i, mono(r));
    $('demo-radius').appendChild(d);
  }

  /* ── Start: udfyld teksterne, vis den rigtige visning ── */
  S.anvend(document);
  opdaterVis();
  filtrer();
  visning();
})();
