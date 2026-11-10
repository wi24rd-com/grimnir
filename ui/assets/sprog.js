/* Grimnir — sprog. Dansk først, engelsk med samme nøgler (mønsteret fra Huginn and Muninn: data-t). Valget huskes i
   localStorage['grimnir-sprog'] = da | en; dansk er standard. anvend(rod) udfylder:
     data-t="noegle"        → textContent
     data-t-aria="noegle"   → aria-label
     data-t-title="noegle"  → title
     data-t-ph="noegle"     → placeholder
   {v} og {w} i en tekst erstattes af elementets data-v og data-w (fx versionsnummeret eller to antal). saet('en') skifter straks uden genindlæsning og
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
      // V-SKAL.2: Maskér og Demaskér
      midlertidigSag: 'Midlertidig sag · {v} værdier', ariaSagKnap: 'Midlertidig sag, {v} værdier: vis og nulstil',
      sagH: 'Midlertidig sag',
      sagP: 'Sagen husker {v} værdier i hukommelsen, til Grimnir lukkes. Nulstil glemmer dem, og et svar med de koder kan derefter ikke demaskeres.',
      nulstilSag: 'Nulstil sagen',
      hvorforIndsaetFoerst: 'Indsæt en tekst først', hvorforVent: 'Vent, Grimnir arbejder', hvorforAnalyserFoerst: 'Analysér teksten først',
      hvorforMaskerFoerst: 'Gem og maskér først', hvorforMaskerFoerstSag: 'Maskér en tekst i denne session først',
      hvorforIndsaetSvar: 'Indsæt et svar først', hvorforDemaskerFoerst: 'Demaskér først',
      hvorforLaast: 'Teksten har allerede en af sagens koder her; den skal maskeres, ellers sætter demaskeringen en forkert værdi ind',
      hvorforFlereStavemaader: 'Værdien står med flere stavemåder; koden kan ikke rettes her endnu',
      genvejTitel: 'Genvej: {v}',
      ariaIndsaetTekst: 'Tom flade: indsæt en log eller et script med {v}', ariaIndsaetSvar: 'Tom flade: indsæt svaret med {v}',
      tekstAfkortet: 'Viser de første {v} tegn. Resten er med i maskeringen, men vises ikke.',
      pTekst: 'Indsat tekst', pMaskeret: 'Maskeret tekst', pFund: 'Fund og erstatninger', pRester: 'Rester fra lækagetjekket',
      pSvar: 'Svar med koder', pRigtige: 'Med de rigtige værdier', pAdvarsler: 'Advarsler', pAlleKoder: 'Alle koder', pIkkeBrugt: 'Ikke brugt',
      ariaTekst: 'Den indsatte tekst (kan ikke redigeres; indsæt igen for at ændre den)', ariaMaskeret: 'Den maskerede tekst',
      ariaSvar: 'Det indsatte svar med koder', ariaRigtige: 'Svaret med de rigtige værdier',
      tekstInfo: '{v} linjer · {w} MB', fundInfo: '{v} fund · {w} maskeres', restInfo: '{v} steder', raekkerInfo: '{v} rækker',
      visFlere: 'Vis flere', visesAf: 'Viser {v} af {w}. Søg eller filtrér for at finde resten.',
      bIngenTekst: 'Udklipsholderen har ingen tekst.',
      bForStor: 'Teksten er {v} MB. Grimnir tager højst 5 MB ad gangen her; Åbn fil kommer i en senere version.',
      bRettelserAfvist: '{v} rettelser kan ikke bruges, så intet er gemt. Se rækkerne med rødt.',
      bFejl: 'Grimnir kunne ikke gøre det. Prøv igen.',
      bLaekIngen: 'Lækagetjekket fandt ingen originaler eller følsomme værdier i resultatet.',
      bLaekRester: 'Lækagetjekket fandt {v} steder i resultatet, der stadig ligner følsomme værdier.',
      hVisRester: 'Vis dem', hVisFund: 'Vis fundene',
      bOverloeb: '{v} kodepuljer løb over; nogle koder er taget fra en reservepulje.',
      bValgAendret: 'Valgene er ændret. Tryk Gem og maskér igen for at få et nyt resultat.',
      bKopieret: 'Kopieret.', bKopiFejl: 'Grimnir kunne ikke kopiere resultatet.',
      bTrykModV: 'Tryk {v} for at indsætte.',
      bSagTom: 'Sagen er tom: maskér først en tekst i denne session.',
      bAdvarsler: '{v} steder i svaret kunne ikke sættes sikkert tilbage eller var ændret.', hVisAdvarsler: 'Vis dem',
      bAltTilbage: 'Alle {v} koder i svaret er sat tilbage.',
      bIkkeBrugt: '{v} af sagens koder forekommer ikke i svaret. Det er normalt, når svaret kun er et uddrag.', hVisDem: 'Vis dem',
      skjultVaerdi: '••••••••', vis: 'Vis', skjul: 'Skjul', ariaVis: 'Vis hemmeligheden på linje {v}', ariaSkjul: 'Skjul hemmeligheden på linje {v}',
      ariaErstatning: 'Erstatning for fundet på linje {v}', ariaMasker: 'Maskér {v}', ariaMaskerHemmelig: 'Maskér hemmeligheden på linje {v}',
      fejl_kollision: '{v} findes allerede i sagen eller i teksten.', fejl_ugyldig: '{v} skal begynde og slutte med et bogstav eller et tal.',
      fejl_flere_stavemaader: 'Værdien har flere stavemåder; koden kan ikke rettes her endnu.', fejl_ukendt_raekke: 'Rækken findes ikke længere. Analysér igen.',
      analyserer: 'Grimnir analyserer teksten …', tabelFoerAnalyse: 'Tryk Analysér ({v}) for at finde de følsomme værdier.',
      ingenIFilter: 'Ingen rækker passer til filteret.', ingenFund: 'Grimnir fandt intet at maskere i teksten.',
      kolMasker: '✓', kolType: 'Type', kolVaerdi: 'Fundet værdi', kolErstatning: 'Erstatning', kolAntal: 'Antal', kolStatus: 'Status',
      kolHvad: 'Hvad', kolTekst: 'Tekst', kolLinje: 'Linje', kolKode: 'Kode',
      art_ipv4_egen: 'IPv4, eget net', art_ipv4_fremmed: 'IPv4, offentlig', art_ipv6_egen: 'IPv6, eget net', art_ipv6_fremmed: 'IPv6, offentlig',
      art_mac: 'MAC-adresse', art_vaert: 'Maskine', art_domaene: 'Domæne', art_netbios: 'NetBIOS-domæne', art_bruger: 'Bruger',
      art_person: 'Person', art_database: 'Database', art_ord: 'Ord', art_hemmelighed: 'Hemmelighed', art_sid: 'SID', art_guid: 'GUID',
      art_serienummer: 'Serienummer', art_cpr: 'CPR-nummer', art_entropi: 'Lang tilfældig streng', art_ligner_kode: 'Ligner en kode',
      stSikker: 'Sikker', stOrdbog: 'Fra ordbog', stSandsynlig: 'Sandsynlig', stTjek: 'Tjek selv', stVersion: 'Version',
      rest_original: 'Original står tilbage', rest_nyt_fund: 'Ligner følsom værdi',
      chipArbejder: 'Arbejder …', chipRester: '{v} rester', chipMaskeret: 'Maskeret', chipIndsat: 'Indsat', chipVenter: '{v} venter på dig',
      chipFund: '{v} fund', chipSatTilbage: '{v} sat tilbage', chipUkendte: '{v} ukendte',
      fodMaskerTal: '{v} fund · {w} maskeres', fodDemaskerTal: '{v} koder sat tilbage · {w} advarsler',
      tomDemaskerTomSagP: 'Der er intet at demaskere endnu: maskér først en tekst i denne session, så kender Grimnir koderne.',
      blivPaaMaskinen: 'bliver på denne maskine', tryk: 'tryk Demaskér ({v})',
      adv_sat_tilbage: 'Sat tilbage', adv_ukendt_adresse: 'Ukendt adresse i sagens net', adv_ukendt_kode: 'Ukendt kode',
      adv_anden_stavemaade: 'Andre store/små bogstaver', adv_fqdn_forkortet: 'Maskine uden domæne', adv_domaene_alene: 'Domæne alene',
      adv_escaped: 'Escaped skråstreg', adv_url_kodet: 'URL-kodet', adv_ikke_brugt: 'Ikke i svaret', adv_ligner_anden_sag: 'Ligner en anden sag',
      adv_overloeb_egne_net: 'Pulje løb over: egne net', adv_overloeb_fremmede: 'Pulje løb over: offentlige adresser',
      adv_overloeb_mac: 'Pulje løb over: MAC-adresser', adv_overloeb_ipv6: 'Pulje løb over: IPv6',
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
      // V-SKAL.2: Mask and Unmask
      midlertidigSag: 'Temporary case · {v} values', ariaSagKnap: 'Temporary case, {v} values: show and reset',
      sagH: 'Temporary case',
      sagP: 'The case remembers {v} values in memory until Grimnir closes. Reset forgets them, and a reply with those codes can no longer be unmasked.',
      nulstilSag: 'Reset the case',
      hvorforIndsaetFoerst: 'Paste a text first', hvorforVent: 'Wait, Grimnir is working', hvorforAnalyserFoerst: 'Analyse the text first',
      hvorforMaskerFoerst: 'Save and mask first', hvorforMaskerFoerstSag: 'Mask a text in this session first',
      hvorforIndsaetSvar: 'Paste a reply first', hvorforDemaskerFoerst: 'Unmask first',
      hvorforLaast: 'The text already holds one of the case codes here; it must be masked, or unmasking would put in a wrong value',
      hvorforFlereStavemaader: 'The value appears in several spellings; the code cannot be changed here yet',
      genvejTitel: 'Shortcut: {v}',
      ariaIndsaetTekst: 'Empty area: paste a log or a script with {v}', ariaIndsaetSvar: 'Empty area: paste the reply with {v}',
      tekstAfkortet: 'Showing the first {v} characters. The rest is included in the masking but not shown.',
      pTekst: 'Pasted text', pMaskeret: 'Masked text', pFund: 'Findings and replacements', pRester: 'Leftovers from the leak check',
      pSvar: 'Reply with codes', pRigtige: 'With the real values', pAdvarsler: 'Warnings', pAlleKoder: 'All codes', pIkkeBrugt: 'Not used',
      ariaTekst: 'The pasted text (cannot be edited; paste again to change it)', ariaMaskeret: 'The masked text',
      ariaSvar: 'The pasted reply with codes', ariaRigtige: 'The reply with the real values',
      tekstInfo: '{v} lines · {w} MB', fundInfo: '{v} findings · {w} masked', restInfo: '{v} places', raekkerInfo: '{v} rows',
      visFlere: 'Show more', visesAf: 'Showing {v} of {w}. Search or filter to find the rest.',
      bIngenTekst: 'The clipboard holds no text.',
      bForStor: 'The text is {v} MB. Grimnir takes at most 5 MB at a time here; Open file arrives in a later version.',
      bRettelserAfvist: '{v} changes cannot be used, so nothing was saved. See the rows in red.',
      bFejl: 'Grimnir could not do that. Try again.',
      bLaekIngen: 'The leak check found no originals or sensitive values in the result.',
      bLaekRester: 'The leak check found {v} places in the result that still look sensitive.',
      hVisRester: 'Show them', hVisFund: 'Show the findings',
      bOverloeb: '{v} code pools ran out; some codes come from a reserve pool.',
      bValgAendret: 'The choices have changed. Press Save and mask again for a new result.',
      bKopieret: 'Copied.', bKopiFejl: 'Grimnir could not copy the result.',
      bTrykModV: 'Press {v} to paste.',
      bSagTom: 'The case is empty: mask a text in this session first.',
      bAdvarsler: '{v} places in the reply could not be put back safely or had been changed.', hVisAdvarsler: 'Show them',
      bAltTilbage: 'All {v} codes in the reply have been put back.',
      bIkkeBrugt: '{v} of the case codes do not appear in the reply. That is normal when the reply is only an excerpt.', hVisDem: 'Show them',
      skjultVaerdi: '••••••••', vis: 'Show', skjul: 'Hide', ariaVis: 'Show the secret on line {v}', ariaSkjul: 'Hide the secret on line {v}',
      ariaErstatning: 'Replacement for the finding on line {v}', ariaMasker: 'Mask {v}', ariaMaskerHemmelig: 'Mask the secret on line {v}',
      fejl_kollision: '{v} already exists in the case or in the text.', fejl_ugyldig: '{v} must start and end with a letter or a digit.',
      fejl_flere_stavemaader: 'The value has several spellings; the code cannot be changed here yet.', fejl_ukendt_raekke: 'The row no longer exists. Analyse again.',
      analyserer: 'Grimnir is analysing the text …', tabelFoerAnalyse: 'Press Analyse ({v}) to find the sensitive values.',
      ingenIFilter: 'No rows match the filter.', ingenFund: 'Grimnir found nothing to mask in the text.',
      kolMasker: '✓', kolType: 'Type', kolVaerdi: 'Value found', kolErstatning: 'Replacement', kolAntal: 'Count', kolStatus: 'Status',
      kolHvad: 'What', kolTekst: 'Text', kolLinje: 'Line', kolKode: 'Code',
      art_ipv4_egen: 'IPv4, own network', art_ipv4_fremmed: 'IPv4, public', art_ipv6_egen: 'IPv6, own network', art_ipv6_fremmed: 'IPv6, public',
      art_mac: 'MAC address', art_vaert: 'Machine', art_domaene: 'Domain', art_netbios: 'NetBIOS domain', art_bruger: 'User',
      art_person: 'Person', art_database: 'Database', art_ord: 'Word', art_hemmelighed: 'Secret', art_sid: 'SID', art_guid: 'GUID',
      art_serienummer: 'Serial number', art_cpr: 'CPR number', art_entropi: 'Long random string', art_ligner_kode: 'Looks like a code',
      stSikker: 'Certain', stOrdbog: 'From dictionary', stSandsynlig: 'Probable', stTjek: 'Check yourself', stVersion: 'Version',
      rest_original: 'Original left behind', rest_nyt_fund: 'Looks sensitive',
      chipArbejder: 'Working …', chipRester: '{v} leftovers', chipMaskeret: 'Masked', chipIndsat: 'Pasted', chipVenter: '{v} waiting for you',
      chipFund: '{v} findings', chipSatTilbage: '{v} put back', chipUkendte: '{v} unknown',
      fodMaskerTal: '{v} findings · {w} masked', fodDemaskerTal: '{v} codes put back · {w} warnings',
      tomDemaskerTomSagP: 'There is nothing to unmask yet: mask a text in this session first, so Grimnir knows the codes.',
      blivPaaMaskinen: 'stays on this machine', tryk: 'press Unmask ({v})',
      adv_sat_tilbage: 'Put back', adv_ukendt_adresse: 'Unknown address in the case network', adv_ukendt_kode: 'Unknown code',
      adv_anden_stavemaade: 'Different upper/lower case', adv_fqdn_forkortet: 'Machine without domain', adv_domaene_alene: 'Domain alone',
      adv_escaped: 'Escaped backslash', adv_url_kodet: 'URL-encoded', adv_ikke_brugt: 'Not in the reply', adv_ligner_anden_sag: 'Looks like another case',
      adv_overloeb_egne_net: 'Pool ran out: own networks', adv_overloeb_fremmede: 'Pool ran out: public addresses',
      adv_overloeb_mac: 'Pool ran out: MAC addresses', adv_overloeb_ipv6: 'Pool ran out: IPv6',
    },
  };

  let lang = 'da';
  try {
    const v = localStorage.getItem(NOEGLE);
    if (v === 'da' || v === 'en') lang = v;
  } catch (e) { /* ingen lagring: dansk */ }

  const t = (k, v, w) => {
    let s = TEKST[lang][k];
    if (s == null) return null;
    if (v != null) s = s.replace(/\{v\}/g, String(v));
    if (w != null) s = s.replace(/\{w\}/g, String(w));
    return s;
  };
  const ATTR = [['data-t', null], ['data-t-aria', 'aria-label'], ['data-t-title', 'title'], ['data-t-ph', 'placeholder']];

  function anvend(rod) {
    const r = rod || document;
    for (const [kilde, maal] of ATTR) {
      const liste = [...r.querySelectorAll(`[${kilde}]`)];
      if (r.nodeType === 1 && r.hasAttribute(kilde)) liste.push(r);
      for (const el of liste) {
        const tekst = t(el.getAttribute(kilde), el.getAttribute('data-v'), el.getAttribute('data-w'));
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
