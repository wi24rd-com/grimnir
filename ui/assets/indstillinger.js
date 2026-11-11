/* Grimnir — Indstillinger og guiden ved første start (V-ORDBOG.1, O5 og O6). Bygger på skallen (window.Grimnir), kittet
   (window.Kit, Wizard), Ordbog (window.GrimnirOrdbog) og Maskér (window.GrimnirMaskering).

   Indstillingerne: tema og sprog (som Vis-fanen; de bliver i localStorage via tema.js og sprog.js), og standardvalgene
   for nye sager (fremmede adresser, D4; sidste oktet, D5; standardudløb). De sidste gemmer Rust i
   <app-data>/indstillinger.json (intet følsomt). Et valg gemmes, så snart det ændres.

   Guiden vises ved start, når ordbogen er tom, og guiden ikke er afsluttet eller sprunget over før (huskes i
   indstillingerne, ikke i ordbogen). Den kan åbnes igen fra Indstillinger. Tre trin: hvad Grimnir gør; egne domæner og
   NetBIOS-navne; egne net og navnemønstre. Spring over findes på alle trin; Escape er det samme som Spring over.

   V-LAAS.2: "Lås Grimnir ved start" (til som standard). At slå den til gemmes straks; at slå den fra kræver en
   oplåsning (Rust spørger døren med sin egen tekst), og først ved ok gemmes valget. Indstillingerne virker, mens Grimnir
   er låst; "Vis guiden igen" er da nedtonet (guiden bruger ordbogen).

   Rust-kommandoer: indstillinger_hent, indstillinger_gem, laas_ved_start (og ordbogens via ordbog.js). Intet her skriver til konsollen
   eller til localStorage. */
(function () {
  'use strict';
  const G = window.Grimnir, K = window.Kit, S = window.Sprog, T = window.Tema, GO = window.GrimnirOrdbog, GM = window.GrimnirMaskering;
  const GL = window.GrimnirLaas;
  if (!G || !K || !S || !T || !GO || !GM || !GL) return;
  const invoke = G.tauri && G.tauri.core && G.tauri.core.invoke ? (c, a) => G.tauri.core.invoke(c, a) : () => Promise.reject({ art: 'ingen_rust' });
  const $ = id => document.getElementById(id);
  const st = { indst: null, venterLaas: false };

  /* ═════════════════════════════ Indstillinger ═════════════════════════════ */
  const iFremmede = $('indst-fremmede'), iOktet = $('indst-oktet'), iUdloeb = $('indst-udloeb'), iLaas = $('indst-laas'), guideKnap = $('indst-guide');
  // Uden dør (i denne cyklus alt andet end macOS) starter Grimnir ikke låst; hjælpeteksten siger det.
  $('indst-laas-hj').setAttribute('data-t', G.mac ? 'hjLaasVedStart' : 'hjLaasVedStartIngen');
  S.anvend($('indst-laas-hj'));
  function tegnIndst() {
    for (const r of document.querySelectorAll('input[name="indst-tema"]')) r.checked = r.value === T.valg;
    for (const r of document.querySelectorAll('input[name="indst-sprog"]')) r.checked = r.value === S.lang;
    // Guiden lægger værdier i ordbogen: nedtonet med forklaring, mens Grimnir er låst.
    guideKnap.disabled = GL.laast;
    if (GL.laast) guideKnap.setAttribute('data-t-title', 'hvorforLaast');
    else { guideKnap.removeAttribute('data-t-title'); guideKnap.removeAttribute('title'); }
    S.anvend(guideKnap.parentNode);
    const i = st.indst;
    for (const e of [iFremmede, iOktet, iUdloeb]) e.disabled = !i;
    iLaas.disabled = !i || st.venterLaas;
    if (!i) return;
    iFremmede.checked = i.masker_fremmede;
    iOktet.checked = i.bevar_sidste_oktet;
    iUdloeb.value = i.udloeb_dage == null ? '' : String(i.udloeb_dage);
    iLaas.checked = i.laas_ved_start;
  }
  function gem(aendring) {
    if (!st.indst) return Promise.resolve(null);
    const ny = { ...st.indst, ...aendring };
    $('indst-fejl').textContent = '';
    return invoke('indstillinger_gem', { indstillinger: ny })
      .then(i => { st.indst = i; tegnIndst(); return i; })
      .catch(e => {
        tegnIndst();
        const f = e && e.art === 'indstillinger' && e.fejl ? GM.sagFejlTekst({ art: 'sag', fejl: e.fejl }) : S.t('sagfejl_andet');
        $('indst-fejl').textContent = S.t('bIndstIkkeGemt', f);
        return null;
      });
  }
  for (const r of document.querySelectorAll('input[name="indst-tema"]')) r.addEventListener('change', () => T.saet(r.value));
  for (const r of document.querySelectorAll('input[name="indst-sprog"]')) r.addEventListener('change', () => S.saet(r.value));
  iFremmede.addEventListener('change', () => gem({ masker_fremmede: iFremmede.checked }));
  iOktet.addEventListener('change', () => gem({ bevar_sidste_oktet: iOktet.checked }));
  iUdloeb.addEventListener('change', () => gem({ udloeb_dage: iUdloeb.value ? Number(iUdloeb.value) : null }));
  /* Lås ved start: fra kræver en oplåsning (Rust spørger døren). Mislykkes den, står fluebenet igen, og beskeden siger hvorfor. */
  const LAAS_FRA = { annulleret: 'laasFraAnnulleret', afvist: 'laasFraAfvist', fejl: 'laasFraFejl' };
  function saetLaasVedStart(til) {
    if (!st.indst || st.venterLaas) return Promise.resolve(null);
    st.venterLaas = true;
    $('indst-fejl').textContent = '';
    tegnIndst();
    return invoke('laas_ved_start', { til, sprog: S.lang })
      .then(r => {
        st.indst = { ...st.indst, laas_ved_start: r.status.ved_start };
        if (LAAS_FRA[r.svar]) $('indst-fejl').textContent = S.t(LAAS_FRA[r.svar], r.kode);
        GL.anvend(r);
        return r;
      })
      .catch(e => {
        const f = e && e.art === 'indstillinger' && e.fejl ? GM.sagFejlTekst({ art: 'sag', fejl: e.fejl }) : S.t('sagfejl_andet');
        $('indst-fejl').textContent = S.t('bIndstIkkeGemt', f);
        return null;
      })
      .finally(() => { st.venterLaas = false; tegnIndst(); });
  }
  iLaas.addEventListener('change', () => saetLaasVedStart(iLaas.checked));
  document.addEventListener('grimnir-laas', tegnIndst);
  $('indst-guide').addEventListener('click', () => { $('dlg-indst').close(); visGuide(); });
  document.addEventListener('grimnir-tema', tegnIndst);
  document.addEventListener('grimnir-sprog', () => { tegnIndst(); if ($('dlg-guide').open) tegnLister(); });

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

  // vedSkift kaldes også, mens guiden bygges; derfor let og en kontrol.
  let wiz = null;
  wiz = K.guide($('guide'), {
    hId: 'guide-h',
    trin: [
      { t: 'guideT1', h: 'guideH1', p: 'guideP1', indhold: trin1 },
      { t: 'guideT2', h: 'guideH2', p: 'guideP2', indhold: trin2 },
      { t: 'guideT3', h: 'guideH3', p: 'guideP3', indhold: trin3 },
    ],
    naeste: { t: 'naeste' }, tilbage: { t: 'tilbage' }, slut: { t: 'faerdig' }, spring: { t: 'springOver' },
    vedSlut: () => afslut(),
    vedSpring: () => afslut(),
    vedSkift: () => { tegnLister(); S.anvend($('guide')); if (wiz) wiz.overskrift.focus(); },
  });
  function visGuide() {
    wiz.gaaTil(0);
    G.aabnDialog('dlg-guide');
    wiz.overskrift.focus();
  }
  /* Afsluttet eller sprunget over: huskes i indstillingerne, så guiden ikke vises igen af sig selv. */
  // Lukkes guiden på anden måde (en anden dialog åbner oven på den), er den hverken afsluttet eller sprunget over.
  function afslut() {
    if ($('dlg-guide').open) $('dlg-guide').close();
    if (st.indst && !st.indst.guide_vist) gem({ guide_vist: true });
  }
  $('dlg-guide').addEventListener('cancel', e => { e.preventDefault(); afslut(); });

  /* ═════════════════════════════ Start ═════════════════════════════ */
  tegnIndst();
  S.anvend($('guide'));
  // Indstillingerne hentes straks (de virker også låst); guiden venter på ordbogen, der først hentes efter oplåsningen.
  const hentet = invoke('indstillinger_hent').catch(() => null).then(i => { st.indst = i; tegnIndst(); return i; });
  const klar = Promise.all([hentet, GO.klar]).then(([i]) => {
    const o = GO.st;
    if (i && !i.guide_vist && !o.fejl && o.poster.length === 0 && !document.querySelector('dialog[open]')) visGuide();
  });
  window.GrimnirIndst = { st, klar, visGuide, gem, wiz, saetLaasVedStart };
})();
