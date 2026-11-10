/* Grimnir — sprog. Dansk først, engelsk med samme nøgler (mønsteret fra Huginn and Muninn: data-t). Valget huskes i
   localStorage['grimnir-sprog'] = da | en; dansk er standard. anvend(rod) udfylder:
     data-t="noegle"        → textContent
     data-t-aria="noegle"   → aria-label
     data-t-title="noegle"  → title
     data-t-ph="noegle"     → placeholder
   {v} i en tekst erstattes af elementets data-v (fx versionsnummeret). saet('en') skifter straks uden genindlæsning og
   melder 'grimnir-sprog' på document. Kun opdigtede eksempler i teksterne. */
(function () {
  'use strict';
  const NOEGLE = 'grimnir-sprog';
  const TEKST = {
    da: {
      dokTitel: 'Wi24rd Grimnir', appNavn: 'Grimnir', wi24rd: 'Wi24rd',
      ingenSag: 'Ingen sag åben', aabnIndst: 'Åbn indstillinger', aabnIndstTitel: 'Indstillinger ({v})',
      cmdAria: 'Handlingsbånd', faneStart: 'Start', faneVis: 'Vis',
      navAria: 'Navigation', visninger: 'Visninger', traeAria: 'Filtrér arbejdsfladen',
      vMasker: 'Maskér', vDemasker: 'Demaskér', vSager: 'Sager', vOrdbog: 'Ordbog',
      gTekst: 'Tekst', gMaskering: 'Maskering', gResultat: 'Resultat', gSvar: 'Svar', gDemaskering: 'Demaskering',
      gSag: 'Sag', gDeling: 'Deling', gOprydning: 'Oprydning', gOrdbog: 'Ordbog', gTema: 'Tema', gSprog: 'Sprog',
      kIndsaet: 'Indsæt', kAabnFil: 'Åbn fil', kAnalyser: 'Analysér', kGemMasker: 'Gem og maskér', kFoerEfter: 'Før og efter',
      kKopier: 'Kopiér', kKvittering: 'Kvittering', kDemasker: 'Demaskér', kNaesteAdvarsel: 'Næste advarsel',
      kKopierResultat: 'Kopiér resultat', kGemFil: 'Gem som fil', kNySag: 'Ny sag', kAabnIMasker: 'Åbn i Maskér',
      kEksporter: 'Eksportér', kImporter: 'Importér', kSletSag: 'Slet sag', kTilfoejPost: 'Tilføj post',
      kProev: 'Prøv på tekst', kFjernPost: 'Fjern post',
      kLys: 'Lys', kMoerk: 'Mørk', kSystem: 'System', kDansk: 'Dansk', kEngelsk: 'English',
      hvorforSenere: 'Kommer i en senere version af Grimnir', hvorforFilter: 'Vælg filter i træet til venstre',
      tDenneTekst: 'Denne tekst', tAlleFund: 'Alle fund', tSkalTjekkes: 'Skal tjekkes', tHemmeligheder: 'Hemmeligheder',
      tSenesteISagen: 'Seneste i sagen', tDetteSvar: 'Dette svar', tAlleKoder: 'Alle koder', tAdvarsler: 'Advarsler',
      tIkkeBrugt: 'Ikke brugt', tSager: 'Sager', tAlle: 'Alle', tUdloeberSnart: 'Udløber snart', tUdenUdloeb: 'Uden udløb',
      tLister: 'Lister', tMaskerAltid: 'Maskér altid', tMaskerAldrig: 'Maskér aldrig', tTyper: 'Typer',
      tDomaener: 'Domæner', tNavnemoenstre: 'Navnemønstre', tEgneNet: 'Egne net',
      soegMasker: 'Søg i fundene', soegDemasker: 'Søg i svaret', soegSager: 'Søg i sagerne', soegOrdbog: 'Søg i ordbogen',
      chipIntetIndsat: 'Intet indsat', chipIntetSvar: 'Intet svar', chipIngenSager: 'Ingen sager', chipTomOrdbog: 'Ordbogen er tom',
      tomMaskerH: 'Intet at maskere endnu',
      tomMaskerP: 'Her sætter du en log eller et script ind, og Grimnir erstatter de følsomme værdier, før du deler teksten.',
      tomDemaskerH: 'Intet svar endnu',
      tomDemaskerP: 'Her sætter du svaret fra support eller en chatbot ind, og Grimnir sætter de rigtige værdier tilbage på denne maskine.',
      tomSagerH: 'Ingen sager endnu',
      tomSagerP: 'En sag husker krypteret på denne maskine, hvad hver værdi blev erstattet med, så et svar kan demaskeres senere.',
      tomOrdbogH: 'Ordbogen er tom',
      tomOrdbogP: 'Ordbogen fortæller Grimnir, hvad der altid skal maskeres, og hvad der aldrig må røres, i alle sager.',
      fodMasker: '0 fund', fodDemasker: '0 koder', fodSager: '0 sager', fodOrdbog: '0 poster',
      kunLokalt: 'Kun på denne maskine', version: 'Version {v}', kerne: 'Kerne {v}',
      indstH: 'Indstillinger', indstP: 'Indstillingerne kommer i en senere version. Tema og sprog vælger du under Vis i båndet.',
      omH: 'Om Grimnir',
      omP: 'Wi24rd Grimnir maskerer følsomme værdier i logs og scripts, før du deler dem, og sætter dem tilbage bagefter. Alt sker på denne maskine.',
      licens: 'Licens: Apache-2.0', luk: 'Luk',
    },
    en: {
      dokTitel: 'Wi24rd Grimnir', appNavn: 'Grimnir', wi24rd: 'Wi24rd',
      ingenSag: 'No case open', aabnIndst: 'Open settings', aabnIndstTitel: 'Settings ({v})',
      cmdAria: 'Command bar', faneStart: 'Home', faneVis: 'View',
      navAria: 'Navigation', visninger: 'Views', traeAria: 'Filter the workspace',
      vMasker: 'Mask', vDemasker: 'Unmask', vSager: 'Cases', vOrdbog: 'Dictionary',
      gTekst: 'Text', gMaskering: 'Masking', gResultat: 'Result', gSvar: 'Reply', gDemaskering: 'Unmasking',
      gSag: 'Case', gDeling: 'Sharing', gOprydning: 'Clean-up', gOrdbog: 'Dictionary', gTema: 'Theme', gSprog: 'Language',
      kIndsaet: 'Paste', kAabnFil: 'Open file', kAnalyser: 'Analyse', kGemMasker: 'Save and mask', kFoerEfter: 'Before and after',
      kKopier: 'Copy', kKvittering: 'Receipt', kDemasker: 'Unmask', kNaesteAdvarsel: 'Next warning',
      kKopierResultat: 'Copy result', kGemFil: 'Save as file', kNySag: 'New case', kAabnIMasker: 'Open in Mask',
      kEksporter: 'Export', kImporter: 'Import', kSletSag: 'Delete case', kTilfoejPost: 'Add entry',
      kProev: 'Try on text', kFjernPost: 'Remove entry',
      kLys: 'Light', kMoerk: 'Dark', kSystem: 'System', kDansk: 'Dansk', kEngelsk: 'English',
      hvorforSenere: 'Coming in a later version of Grimnir', hvorforFilter: 'Choose a filter in the tree on the left',
      tDenneTekst: 'This text', tAlleFund: 'All findings', tSkalTjekkes: 'Needs checking', tHemmeligheder: 'Secrets',
      tSenesteISagen: 'Latest in the case', tDetteSvar: 'This reply', tAlleKoder: 'All codes', tAdvarsler: 'Warnings',
      tIkkeBrugt: 'Not used', tSager: 'Cases', tAlle: 'All', tUdloeberSnart: 'Expiring soon', tUdenUdloeb: 'No expiry',
      tLister: 'Lists', tMaskerAltid: 'Always mask', tMaskerAldrig: 'Never mask', tTyper: 'Types',
      tDomaener: 'Domains', tNavnemoenstre: 'Name patterns', tEgneNet: 'Own networks',
      soegMasker: 'Search the findings', soegDemasker: 'Search the reply', soegSager: 'Search the cases', soegOrdbog: 'Search the dictionary',
      chipIntetIndsat: 'Nothing pasted', chipIntetSvar: 'No reply', chipIngenSager: 'No cases', chipTomOrdbog: 'Dictionary is empty',
      tomMaskerH: 'Nothing to mask yet',
      tomMaskerP: 'This is where you paste a log or a script, and Grimnir replaces the sensitive values before you share the text.',
      tomDemaskerH: 'No reply yet',
      tomDemaskerP: 'This is where you paste the reply from support or a chatbot, and Grimnir puts the real values back on this machine.',
      tomSagerH: 'No cases yet',
      tomSagerP: 'A case remembers, encrypted on this machine, what each value was replaced with, so a reply can be unmasked later.',
      tomOrdbogH: 'The dictionary is empty',
      tomOrdbogP: 'The dictionary tells Grimnir what to always mask and what never to touch, in every case.',
      fodMasker: '0 findings', fodDemasker: '0 codes', fodSager: '0 cases', fodOrdbog: '0 entries',
      kunLokalt: 'Only on this machine', version: 'Version {v}', kerne: 'Core {v}',
      indstH: 'Settings', indstP: 'Settings arrive in a later version. Choose theme and language under View in the command bar.',
      omH: 'About Grimnir',
      omP: 'Wi24rd Grimnir masks sensitive values in logs and scripts before you share them, and puts them back afterwards. Everything happens on this machine.',
      licens: 'Licence: Apache-2.0', luk: 'Close',
    },
  };

  let lang = 'da';
  try {
    const v = localStorage.getItem(NOEGLE);
    if (v === 'da' || v === 'en') lang = v;
  } catch (e) { /* ingen lagring: dansk */ }

  const t = (k, v) => {
    const s = TEKST[lang][k];
    return s == null ? null : v == null ? s : s.replace(/\{v\}/g, String(v));
  };
  const ATTR = [['data-t', null], ['data-t-aria', 'aria-label'], ['data-t-title', 'title'], ['data-t-ph', 'placeholder']];

  function anvend(rod) {
    const r = rod || document;
    for (const [kilde, maal] of ATTR) {
      const liste = [...r.querySelectorAll(`[${kilde}]`)];
      if (r.nodeType === 1 && r.hasAttribute(kilde)) liste.push(r);
      for (const el of liste) {
        const tekst = t(el.getAttribute(kilde), el.getAttribute('data-v'));
        if (tekst == null) continue;
        if (maal) el.setAttribute(maal, tekst);
        else el.textContent = tekst;
      }
    }
    document.documentElement.lang = lang;
    document.title = t('dokTitel');
  }

  function saet(l) {
    lang = l === 'en' ? 'en' : 'da';
    try { localStorage.setItem(NOEGLE, lang); } catch (e) { /* valget gælder kun denne gang */ }
    anvend(document);
    document.dispatchEvent(new CustomEvent('grimnir-sprog'));
  }

  window.Sprog = { TEKST, get lang() { return lang; }, t, anvend, saet };
})();
