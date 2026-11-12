/* Grimnir — Indstillinger og guiden ved første start (V-ORDBOG.1, O5 og O6). Bygger på skallen (window.Grimnir), kittet
   (window.Kit, Wizard), Ordbog (window.GrimnirOrdbog) og Maskér (window.GrimnirMaskering).

   Indstillingerne: tema og sprog (som Vis-fanen; de bliver i localStorage via tema.js og sprog.js), og standardvalgene
   for nye sager (fremmede adresser, D4; sidste oktet, D5; standardudløb). De sidste gemmer Rust i
   <app-data>/indstillinger.json (intet følsomt). Et valg gemmes, så snart det ændres.

   Guiden vises ved start, når ordbogen er tom, og guiden ikke er afsluttet eller sprunget over før (huskes i
   indstillingerne, ikke i ordbogen). Den kan åbnes igen fra Indstillinger. Tre trin: hvad Grimnir gør; egne domæner og
   NetBIOS-navne; egne net og navnemønstre. Spring over findes på alle trin; Escape er det samme som Spring over.

   V-LAAS.3: "Lås Grimnir ved start" er fjernet; låsen kan ikke slås fra (ADR D20). "Lås efter stilstand" (5, 15, 30
   eller 60 minutter; standard 15) gemmes som de andre valg; der er ingen "aldrig". Hjælpeteksten siger, hvad låsen
   beskytter imod, og hvornår Grimnir låser igen. Indstillingerne virker, mens Grimnir er låst; "Vis guiden igen" er da
   nedtonet (guiden bruger ordbogen).

   Rust-kommandoer: indstillinger_hent, indstillinger_gem (og ordbogens via ordbog.js). Intet her skriver til konsollen
   eller til localStorage. */
(function () {
  'use strict';
  const G = window.Grimnir, K = window.Kit, S = window.Sprog, T = window.Tema, GO = window.GrimnirOrdbog, GM = window.GrimnirMaskering;
  const GL = window.GrimnirLaas;
  if (!G || !K || !S || !T || !GO || !GM || !GL) return;
  const invoke = G.tauri && G.tauri.core && G.tauri.core.invoke ? (c, a) => G.tauri.core.invoke(c, a) : () => Promise.reject({ art: 'ingen_rust' });
  const $ = id => document.getElementById(id);
  const st = { indst: null };

  /* ═════════════════════════════ Indstillinger ═════════════════════════════ */
  /* V-KITBRUG.1: kontrollerne er kittets. Tema, sprog og tekststørrelse er radiogrupper med valgene i en række (Kit.
     radiogruppe, vandret; navnene indst-tema, indst-sprog og indst-tekst); de virker straks som Vis-fanen. Tekststørrelsen
     er kittets tre trin (window.Tekst i tema.js, som husker valget i localStorage['grimnir-tekst'] og sætter <html
     data-tekst>; normal sætter ingen attribut). Afkrydsningerne (Kit.afkrydsning) og valglisterne (Kit.valgliste) har de
     samme id'er som før, og hver knap og liste har stadig sit navn i aria-label. */
  const Tk = window.Tekst;
  /* V-KITBRUG.2 N1: Indstillinger er kittets dialog (Kit.dialog, bred: 620 px) med samme overskrift, indhold, fejl og
     knap som før: tema, sprog og tekststørrelse øverst, Nye sager, Lås og Første start; fejlen står i kittets fejlfelt
     (G1, dlg-indst-fejl, role="alert"); én knap, Luk. Fokus ved åbning som browserens: det første valg. */
  function el(tag, kl, t, id) {
    const e = document.createElement(tag);
    if (kl) e.className = kl;
    if (t) e.setAttribute('data-t', t);
    if (id) e.id = id;
    return e;
  }
  function gruppe(id, legend) {
    const f = el('fieldset', 'valg lodret', null, id);
    f.appendChild(el('legend', 'label', legend));
    return f;
  }
  const indstValg = el('div', 'indst', null, 'indst-valg');
  const indstGuide = gruppe(null, 'indstGuide');
  const guideKnapRamme = document.createElement('div');
  const guideKnapEl = el('button', 'btn', 'visGuideIgen', 'indst-guide');
  guideKnapEl.type = 'button';
  guideKnapRamme.appendChild(guideKnapEl);
  indstGuide.append(el('span', 'hj', 'hjGuide'), guideKnapRamme);
  indstValg.append(gruppe('indst-nye', 'indstNyeSager'), gruppe('indst-laasvalg', 'indstLaas'), indstGuide);
  const dIndst = G.kitDialog({ id: 'dlg-indst', t: 'indstH', bred: true, indhold: indstValg, fejl: true, knapper: [{ id: 'luk', t: 'luk' }] });
  function radiogruppe(navn, etiket, valg, valgt, ved) {
    const g = K.radiogruppe({ navn, etiket: { t: etiket }, valg, valgt, vandret: true, vedValg: ved });
    for (const i of g.inputs) i.setAttribute('data-t-aria', valg.find(v => v.id === i.value).t);
    return g;
  }
  const gTema = radiogruppe('indst-tema', 'gTema', [{ id: 'lys', t: 'kLys' }, { id: 'moerk', t: 'kMoerk' }, { id: 'system', t: 'kSystem' }], T.valg, v => T.saet(v));
  const gSprog = radiogruppe('indst-sprog', 'gSprog', [{ id: 'da', t: 'kDansk' }, { id: 'en', t: 'kEngelsk' }], S.lang, v => S.saet(v));
  const gTekst = radiogruppe('indst-tekst', 'gTekstStr', [{ id: 'lille', t: 'kTekstLille' }, { id: 'normal', t: 'kTekstNormal' }, { id: 'stor', t: 'kTekstStor' }], Tk.valg, v => Tk.saet(v));
  $('indst-valg').prepend(gTema.rod, gSprog.rod, gTekst.rod);
  function afkrydsning(id, t, hj) {
    const a = K.afkrydsning({ id, t, hjaelp: hj ? { t: hj } : undefined });
    a.input.setAttribute('data-t-aria', t);
    return a;
  }
  const lUdloeb = K.valgliste({ id: 'indst-udloeb', etiket: { t: 'feltStdUdloeb' }, valg: [{ id: '', t: 'ingenUdloeb' }, { id: '30', t: 'udloeb30' }, { id: '90', t: 'udloeb90' }] });
  lUdloeb.select.setAttribute('data-t-aria', 'feltStdUdloeb');
  $('indst-nye').append(afkrydsning('indst-fremmede', 'valgFremmede', 'hjFremmede').rod, afkrydsning('indst-oktet', 'valgOktet', 'hjOktet').rod, lUdloeb.rod);
  // Uden dør (i denne cyklus alt andet end macOS) starter Grimnir ikke låst; hjælpeteksten siger det (indst-stilstand-hj).
  const lStilstand = K.valgliste({ id: 'indst-stilstand', etiket: { t: 'kLaasEfter' }, valg: [5, 15, 30, 60].map(n => ({ id: String(n), t: 'stilstand' + n })), hjaelp: { t: G.mac ? 'hjLaas' : 'hjLaasIngen' } });
  lStilstand.select.setAttribute('data-t-aria', 'kLaasEfter');
  $('indst-laasvalg').append(lStilstand.rod);
  S.anvend($('dlg-indst'));

  const iFremmede = $('indst-fremmede'), iOktet = $('indst-oktet'), iUdloeb = $('indst-udloeb'), iStilstand = $('indst-stilstand'), guideKnap = $('indst-guide');
  function tegnIndst() {
    gTema.vaelg(T.valg);
    gSprog.vaelg(S.lang);
    gTekst.vaelg(Tk.valg);
    // Guiden lægger værdier i ordbogen: nedtonet med forklaring, mens Grimnir er låst.
    guideKnap.disabled = GL.laast;
    if (GL.laast) guideKnap.setAttribute('data-t-title', 'hvorforLaast');
    else { guideKnap.removeAttribute('data-t-title'); guideKnap.removeAttribute('title'); }
    S.anvend(guideKnap.parentNode);
    const i = st.indst;
    for (const e of [iFremmede, iOktet, iUdloeb, iStilstand]) e.disabled = !i;
    if (!i) return;
    iFremmede.checked = i.masker_fremmede;
    iOktet.checked = i.bevar_sidste_oktet;
    iUdloeb.value = i.udloeb_dage == null ? '' : String(i.udloeb_dage);
    iStilstand.value = String(i.laas_efter_min);
  }
  function gem(aendring) {
    if (!st.indst) return Promise.resolve(null);
    const ny = { ...st.indst, ...aendring };
    dIndst.fejl(null);
    return invoke('indstillinger_gem', { indstillinger: ny })
      .then(i => { st.indst = i; tegnIndst(); return i; })
      .catch(e => {
        tegnIndst();
        const f = e && e.art === 'indstillinger' && e.fejl ? GM.sagFejlTekst({ art: 'sag', fejl: e.fejl }) : S.t('sagfejl_andet');
        dIndst.fejl(S.t('bIndstIkkeGemt', f));
        return null;
      });
  }
  iFremmede.addEventListener('change', () => gem({ masker_fremmede: iFremmede.checked }));
  iOktet.addEventListener('change', () => gem({ bevar_sidste_oktet: iOktet.checked }));
  iUdloeb.addEventListener('change', () => gem({ udloeb_dage: iUdloeb.value ? Number(iUdloeb.value) : null }));
  iStilstand.addEventListener('change', () => gem({ laas_efter_min: Number(iStilstand.value) }));
  document.addEventListener('grimnir-laas', tegnIndst);
  $('indst-guide').addEventListener('click', () => { $('dlg-indst').close(); visGuide(); });
  document.addEventListener('grimnir-tema', tegnIndst);
  document.addEventListener('grimnir-tekst', tegnIndst);
  document.addEventListener('grimnir-sprog', () => { tegnIndst(); if (dGuide.aaben) tegnLister(); });

  /* ═════════════════════════════ Guiden (kittets Wizard) ═════════════════════════════ */
  function tekst(tag, kl, t) {
    const e = document.createElement(tag);
    if (kl) e.className = kl;
    if (t) e.setAttribute('data-t', t);
    return e;
  }
  /* Et felt med Tilføj: lægger værdien i ordbogen som `type(værdi)`. Fejlen står under feltet. */
  function tilfoejFelt(id, etiket, type) {
    const rod = tekst('div', 'felt guide-felt');
    const lab = tekst('label', 'label', etiket);
    lab.htmlFor = id;
    const linje = tekst('div', 'guide-linje');
    const inp = document.createElement('input');
    inp.id = id;
    inp.type = 'text';
    inp.className = 'mono';
    inp.spellcheck = false;
    for (const [k, v] of [['autocomplete', 'off'], ['autocorrect', 'off'], ['autocapitalize', 'off'], ['data-t-aria', etiket], ['aria-describedby', id + '-fejl']]) inp.setAttribute(k, v);
    const fejl = tekst('span', 'hj fejltekst');
    fejl.id = id + '-fejl';
    const ok = () => {
      const v = inp.value.trim();
      fejl.textContent = '';
      inp.removeAttribute('aria-invalid');
      if (!v) { fejl.textContent = S.t('ofejl_tom'); inp.setAttribute('aria-invalid', 'true'); inp.focus(); return; }
      GO.tilfoej(type(v), v, null).then(() => { inp.value = ''; tegnLister(); inp.focus(); })
        .catch(e => { fejl.textContent = GO.fejlTekst(e); inp.setAttribute('aria-invalid', 'true'); inp.focus(); });
    };
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); ok(); } });
    const knap = K.knap({ t: 'kTilfoej', ikon: 'plus', ved: ok });
    knap.setAttribute('data-t-aria', 'ariaTilfoej' + id.replace('guide-', '').replace(/^./, c => c.toUpperCase()));
    linje.append(inp, knap);
    rod.append(lab, linje, fejl);
    return rod;
  }
  /* Det, der allerede står i ordbogen af trinnets typer. */
  function liste(typer, tomT) {
    const ul = tekst('ul', 'guide-liste');
    ul.dataset.typer = typer.join(' ');
    ul.dataset.tom = tomT;
    return ul;
  }
  function tegnLister() {
    for (const ul of document.querySelectorAll('#guide .guide-liste')) {
      ul.textContent = '';
      const typer = ul.dataset.typer.split(' ');
      const p = GO.st.poster.filter(x => typer.includes(x.type));
      if (!p.length) {
        const li = tekst('li', 'muted', ul.dataset.tom);
        ul.appendChild(li);
      }
      for (const x of p) {
        const li = document.createElement('li');
        const t = tekst('span', 'muted', 'type_' + x.type);
        const v = document.createElement('span');
        v.className = 'mono';
        v.textContent = x.vaerdi;
        li.append(t, ' ', v);
        ul.appendChild(li);
      }
      S.anvend(ul);
    }
  }

  // Trin 1: hvad Grimnir gør, i tre sætninger.
  const trin1 = tekst('ul', 'guide-punkter');
  for (const t of ['guide1a', 'guide1b', 'guide1c']) trin1.appendChild(tekst('li', null, t));
  // Trin 2: egne domæner og NetBIOS-navne (et punktum gør det til et domæne).
  const trin2 = tekst('div', 'guide-trin');
  trin2.append(tilfoejFelt('guide-domaene', 'feltDomaeneNetbios', v => (v.includes('.') ? 'domaene' : 'netbios')), liste(['domaene', 'netbios'], 'guideIngenDomaener'));
  // Trin 3: egne net ud over RFC 1918 og navnemønstre for maskiner.
  const trin3 = tekst('div', 'guide-trin');
  const hj3 = tekst('p', 'hj', 'hjMoenster');
  trin3.append(tilfoejFelt('guide-net', 'feltEgetNet', () => 'eget_net'), tilfoejFelt('guide-moenster', 'feltNavnemoenster', () => 'navnemoenster'), hj3, liste(['eget_net', 'navnemoenster'], 'guideIngenNet'));

  // V-LAAS.5 N3 (ADR D22): navn, slogan og beskrivelse (ens på dansk og engelsk; teksterne står i sprog.js).
  const identitet = tekst('div', 'identitet');
  identitet.append(tekst('p', 'id-navn', 'appNavn'), tekst('p', 'id-slogan', 'slogan'), tekst('p', 'id-beskrivelse', 'beskrivelse'));
  /* V-KITBRUG.2 N1: guiden står i kittets brede dialog til en guide (G6: Kit.dialog med guide: true, 820 px uden luft),
     navngivet af guidens overskrift (guide-h), som får fokus ved åbning. Esc er det samme som Spring over (svaret 'esc'
     i vedLuk); lukkes den på anden måde (en anden dialog åbner oven på den, svaret 'kode'), er den hverken afsluttet
     eller sprunget over. */
  const guideRod = el('div', null, null, 'guide');
  const dGuide = G.kitDialog({ id: 'dlg-guide', guide: true, ariaLabelledby: 'guide-h', indhold: guideRod, vedLuk: svar => { if (svar === 'esc') afslut(); } });
  // vedSkift kaldes også, mens guiden bygges; derfor let og en kontrol.
  let wiz = null;
  wiz = K.guide(guideRod, {
    hId: 'guide-h',
    trin: [
      { t: 'guideT1', h: 'guideH1', p: 'guideP1', indhold: trin1 },
      { t: 'guideT2', h: 'guideH2', p: 'guideP2', indhold: trin2 },
      { t: 'guideT3', h: 'guideH3', p: 'guideP3', indhold: trin3 },
    ],
    naeste: { t: 'naeste' }, tilbage: { t: 'tilbage' }, slut: { t: 'faerdig' }, spring: { t: 'springOver' },
    vedSlut: () => afslut(),
    vedSpring: () => afslut(),
    vedSkift: i => { identitet.hidden = i !== 0; tegnLister(); S.anvend($('guide')); if (wiz) wiz.overskrift.focus(); },
  });
  // V-LAAS.5 N3: guidens første skærm har navnet, sloganet og beskrivelsen øverst (som Om-dialogen), over overskriften.
  wiz.overskrift.before(identitet);
  function visGuide() {
    wiz.gaaTil(0);
    G.aabnDialog('dlg-guide');
  }
  /* Afsluttet eller sprunget over: huskes i indstillingerne, så guiden ikke vises igen af sig selv. */
  // Lukkes guiden på anden måde (en anden dialog åbner oven på den), er den hverken afsluttet eller sprunget over.
  function afslut() {
    dGuide.luk('slut');
    if (st.indst && !st.indst.guide_vist) gem({ guide_vist: true });
  }

  /* ═════════════════════════════ Start ═════════════════════════════ */
  tegnIndst();
  S.anvend($('guide'));
  // Indstillingerne hentes straks (de virker også låst); guiden venter på ordbogen, der først hentes efter oplåsningen.
  const hentet = invoke('indstillinger_hent').catch(() => null).then(i => { st.indst = i; tegnIndst(); return i; });
  const klar = Promise.all([hentet, GO.klar]).then(([i]) => {
    const o = GO.st;
    if (i && !i.guide_vist && !o.fejl && o.poster.length === 0 && !document.querySelector('dialog[open]')) visGuide();
  });
  window.GrimnirIndst = { st, klar, visGuide, gem, wiz };
})();
