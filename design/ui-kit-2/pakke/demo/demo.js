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
        hMaerker: 'Mærker, data, skala og kort', pMaerker: 'Fra 2.1.0. Statusprikker, seks dataserier med akse og gitter, en skala i fem trin og kortets farver. Farven står aldrig alene: hvert mærke har et navn ved siden af.', hFarver: 'Farver', pFarver: 'Alle farver i det valgte tema. Skift tema i titellinjen eller på fanen Vis.',
        hSkrift: 'Skrift', pSkrift: 'Inter til alt, JetBrains Mono til værdier. Begge ligger i pakken.',
        hLuft: 'Luft, radier og skygger', pLuft: 'Luft i trin på 4 px; små radier; kanter frem for skygger.',
        pSkygge: 'shadow-pop: til dialoger og menuer over siden.', eksempelTekst: 'Ro, klarhed og ét tydeligt næste skridt',
        hBaandEnkel: 'Bånd med én fane', pBaandEnkel: 'Fra 2.2.0. Et program, man ser i, har få kommandoer: ingen fanerække (udenFaner), og en gruppe kan rumme en segmentknap eller en vælger.',
        gData: 'Data', gPeriode: 'Periode', gDomaene: 'Domæne', gHjaelp: 'Hjælp', kOpdater: 'Opdatér', kEksport: 'Eksportér', kHjaelp: 'Hjælp',
        navOtteH: 'Otte visninger', vOverblik: 'Overblik', vSiden: 'Siden sidst', vAngreb: 'Angreb', vRobotter: 'Robotter', vLogin: 'Login', vLand: 'Land lige nu', vBesoeg: 'Besøgende', vTek: 'Teknologi',
        pSidepanel: 'Fra 2.2.0. Et panel i højre side med overskrift, lukkeknap og indhold, der ruller. I brede vinduer skubber det arbejdsfladen; under 1200 px lægger det sig over. Esc lukker, og fokus går tilbage.',
        spAabn: 'Åbn hjælpen', spH: 'Hjælp', spLuk: 'Luk hjælpen', spArb: 'Arbejdsfladen. Den bliver smallere, når panelet skubber.', spTekst: 'Her står forklaringen til den visning, du ser. Panelet er ikke en dialog: resten af skærmen kan stadig bruges.',
        spLukket: 'Panelet blev lukket ({v}).',
        hVaelger: 'Vælger', pVaelger: 'Fra 2.2.0. En knap med den aktuelle værdi og en liste. Ét valg i titellinjen; flere valg med søgefelt og "Alle" i værktøjslinjen. Pil ned åbner, Esc lukker.',
        vlgLand: 'Land', vlgDomaener: 'Domæner', landDk: 'Danmark', landSe: 'Sverige', landNo: 'Norge', landDe: 'Tyskland', landFi: 'Finland',
        alleDomaener: 'Alle domæner', nValgt: '{v} valgt', soegDomaene: 'Søg i domænerne', soegDomaenePh: 'Søg', ingenFundet: 'Ingen domæner passer',
        hSegment: 'Segmentknap', pSegment: 'Fra 2.2.0. To til fem valg, præcis ét valgt. Tab går ind og ud som én kontrol; pilene flytter og vælger.',
        periodeAria: 'Periode', p7: '7 dage', p30: '30 dage', pAar: 'År',
        hFilterchip: 'Filterchip', pFilterchip: 'Fra 2.3.0. En chip, der kan klikkes: den slår et filter til og fra. Valgt har flueben, kant og fed skrift, ikke kun en farve. Den almindelige chip kan stadig ikke klikkes.',
        filterAria: 'Vis', fcFejl: 'Fejl', fcAdv: 'Advarsler', fcInfo: 'Oplysninger',
        pStatusTile: 'Fra 2.3.0. Ét tal, én etiket og én status; hele flisen er en knap, der åbner det, tallet tæller. En flise findes kun, når brugeren handler på tallet.',
        fliserAria: 'Status for sagen', flMaskeres: 'Maskeres', flVenter: 'Venter på dig', flHemmelige: 'Hemmeligheder', flRester: 'Rester efter maskering', stKlar: 'Klar', stTjek: 'Tjek selv', stKrypteres: 'Krypteres', stIngen: 'Ingen', udvEnMere: '1 mere end i går',
        hTom: 'Tom tilstand', pTom: 'Fra 2.3.0. Ikon, overskrift, én sætning og højst én handling: til en tom visning, en tom tabel og ingen træffere.', hTomTabel: 'Tom tabel og ingen træffere',
        tomSagerH: 'Ingen sager endnu', tomSagerP: 'Indsæt en tekst, så laves en midlertidig sag. Du kan gemme den bagefter.', nySag: 'Ny sag', ingenTraef: 'Ingen træffere', ingenTraefP: 'Intet passer på søgningen "srv-db".', kolNavn: 'Navn', kolOprettet: 'Oprettet',
        hFrem: 'Fremdrift', pFrem: 'Fra 2.3.0. En bestemt bjælke, når programmet ved, hvor langt det er, og en ring, der snurrer, når det ikke ved det. Altid med en tekst; ringen står stille, hvis du har bedt om mindre bevægelse.',
        fremAnalyserer: 'Analyserer filen …', fremNafM: '{v} af {w} filer', fremEtTrin: 'Et trin frem', fremFaerdig: 'Færdig',
        hTip: 'Værktøjstip', pTip: 'Fra 2.3.0. Vises ved hover og ved Tab, kan holdes åbent med musen og lukkes med Esc. Til forklaringer ud over navnet; navnet selv står i aria-label.',
        tipKopier: 'Kopiér', tipKopierHvorfor: 'Vælg en række i tabellen først.', tipKopierVaerdi: 'Kopiér værdien', tipKopierVaerdiTip: 'Kopierer den maskerede værdi, aldrig originalen.',
        hAfk: 'Afkrydsning', pAfk: 'Fra 2.3.0. Browserens egen afkrydsning med kittets tegning: flueben, delvis valgt (en streg), hjælp og fejl under.',
        afkAlle: 'Vælg alle typer', afkIp: 'IP-adresser', afkVaert: 'Værtsnavne', afkBruger: 'Brugernavne', afkFremmede: 'Maskér fremmede offentlige adresser', hjFremmede: 'Adresser, der hverken er dine eller dokumentationsnet.', afkVilkaar: 'Jeg har læst vejledningen', fejlVilkaar: 'Sæt kryds for at gå videre.',
        hKontakt: 'Kontakt', pKontakt: 'Fra 2.3.0. Til eller fra, der virker straks. Til og fra ses på knoppens plads og på ordet, ikke kun på farven.',
        kontaktLaas: 'Lås efter 5 minutter uden brug', kontaktLyd: 'Lyd ved fejl', til: 'Til', fra: 'Fra', hjLyd: 'Kan ikke bruges i denne demo.',
        hRadio: 'Radiogruppe', pRadio: 'Fra 2.3.0. Ét af få valg i en formular, alle synlige. Pilene flytter og vælger; Tab går ind og ud som ét stop.',
        radioMaske: 'Hvad maskeres?', radioAlt: 'Alt, der er fundet', radioHemmelig: 'Kun hemmeligheder', radioIntet: 'Intet', hjIntet: 'Teksten deles, som den er.', radioTema: 'Tema i vinduet', fejlRadio: 'Vælg et tema.',
        hValgliste: 'Valgliste', pValgliste: 'Fra 2.3.0. Browserens egen valgliste med kittets kant og pil. Til ét af mange valg i en formular.',
        vlUdloeb: 'Udløber efter', vl7: '7 dage', vl30: '30 dage', vl90: '90 dage', vlAldrig: 'Aldrig', hjUdloeb: 'Sagen slettes, når den udløber.', vlSprog: 'Sprog i kvitteringen', vlVaelg: 'Vælg …', fejlSprog: 'Vælg et sprog.',
        pDialog: 'Fra 2.3.0. Browserens egen dialog: fokus bliver i dialogen, Esc lukker, og fokus går tilbage bagefter. Den primære knap står til højre; en farlig handling har sin egen farve og får ikke fokus.',
        dlgOmdoeb: 'Omdøb sagen …', dlgOmdoebH: 'Omdøb sagen', dlgOmdoebP: 'Navnet ses kun på denne maskine.', dlgNavn: 'Nyt navn', dlgNavnFejl: 'Skriv et navn.', annuller: 'Annullér', gem: 'Gem', lukAria: 'Luk',
        dlgSlet: 'Slet sagen …', dlgSletH: 'Slet sagen?', dlgSletP: 'Sagen og dens nøgle slettes. Det kan ikke fortrydes.', slet: 'Slet sag', svaret: 'Svaret var: {v}',
        hTabelNy: 'Sortering, to hovedrækker og sideskift', pTabelNy: 'Fra 2.3.0. Klik på et kolonnehoved for at sortere (programmet sorterer selv); grupperne Afvist og Angreb står over deres kolonner; siderne skiftes under tabellen.',
        tabelNyAria: 'Domæner', kolDomaene: 'Domæne', thAfvist: 'Afvist', thIGaar: 'I går', th7: '7 dage', thAngreb: 'Angreb', thUge: 'Denne uge',
        siderAria: 'Sider i tabellen', forrige: 'Forrige', naeste: 'Næste', sideAf: 'Side {v} af {w}', prSide: 'Pr. side',
        hTekst: 'Tekststørrelse', pTekst: 'Fra 2.3.0. Tre trin som én skala for hele fladen; valget huskes og sættes, før siden tegnes. Prøv også ⌘+, ⌘− og ⌘0 (Ctrl på Windows): genvejene er programmets, funktionerne kittets.',
        tekstAria: 'Tekststørrelse', tLille: 'Lille', tNormal: 'Normal', tStor: 'Stor', gTekst: 'Tekst',
        hKasse: 'Kasse', pKasse: 'Fra 2.3.0. Kittets kort: en flade med overskrift, indhold, en valgfri handling i hovedet og en valgfri fodlinje. Klassen hedder .kasse.',
        hTabelAabn: 'Rækker, der åbner, og tabel uden rækkevalg', pTabelAabn: 'Fra 2.4.0. Øverst åbner en række noget med klik, Enter eller mellemrum; piletasterne flytter kun. Tallene er deres egne knapper og åbner ikke rækken. Rammen ruller vandret, og domænet står fast. Nederst en tabel, der kun skal læses: ingen række kan vælges, men knapperne virker.',
        tabelAabnNavn: 'Domæner, der kan åbnes', tabelRulAria: 'Domæner, ruller vandret', kolHvorfor: 'Hvorfor', kolAabn: 'Åbn', kolDetaljer: 'Detaljer', aabnFor: 'Åbn {v}', hentetTitel: 'Hentet i dag', intetAabnet: 'Intet åbnet endnu.', aabnet: 'Åbnet: {v}', talAria: '{v} afvist i går', talValgt: 'Tallet for {v} (rækken blev ikke åbnet)',
        stRoligt: 'Roligt', stHoldOeje: 'Hold øje', stHandl: 'Handl', hvorforTekst: 'Flest login-forsøg fra et ukendt net; alle blev stoppet.',
        tabelLaesNavn: 'De seneste hændelser', kolDag: 'Dag', kolHaendelse: 'Hændelse', hLogin: 'Login afvist', hDmarc: 'DMARC fejlede', hTrafik: 'Trafikken steg', visKilde: 'Vis', visKildeAria: 'Vis {v}', visValgt: 'Vist: {v}',
        gFra: 'Kopiér ⌘C (slået fra: tekst i --text-disabled)',
        h240: 'Hover, buer og svage flader', p240: 'Fra 2.4.0. Søjlerne skifter til mærkets hover-farve under musen (mærket blandet med tekstens farve). Under dem mærkernes svage flade (18 %) med tekst på. På kortet er buen, der er et angreb, rød som ringen; den blå bue betyder ingenting ud over vejen. Forklaringen står på en næsten dækkende flade (92 %).',
        svagTekst: 'Tekst på svag flade', kortAngreb: 'Angreb (danger-mark)', kortBue: 'Bue uden betydning (map-arc)',
        kasseSager: 'Seneste sager', kasseNet: 'Egne net', visAlle: 'Vis alle', kasseFod: 'Opdateret for 2 minutter siden', sag1: 'Supportsag 0042', sag2: 'Leverandør 0007', sag3: 'Test 0001', netTekst: 'Adresser i 192.0.2.0/24 og 2001:db8::/32 maskeres altid.',
        h250Titel: 'Mærke og titellinjeknapper (fra 2.5.0)', p250Titel: 'Mærket er programmets eget (her en maske af striber i titellinjens mærkefarve). Frem er slået fra, tandhjulet peger på det viste (streg forneden), og hjælp har sit panel åbent (ring); klik på hjælp for at skifte.', ariaFrem: 'Frem', ariaIndst: 'Indstillinger', ariaHjaelp: 'Hjælp', hjaelpAaben: 'Hjælp: panelet er åbent', hjaelpLukket: 'Hjælp: panelet er lukket', h250Hvorfor: 'Hvorfor i et værktøjstip (fra 2.5.0)', p250Hvorfor: 'Med hvorforTip: true står forklaringen i et værktøjstip, der vises ved Tab og læses op. Knappen under slår Kopiér til og fra.', kSlaaTil: 'Slå Kopiér til eller fra', h250Nav: 'Træ, der bygges om, og visningsskift med tal (fra 2.5.0)', p250Nav: 'Byg om skifter domænerne uden at miste valg, foldning eller fokus (og uden at kalde vedValg). Siden sidst har et tal, der kræver handling; Angreb er slået fra og siger hvorfor i et værktøjstip.', tSamlet: 'Alle domæner', vOversigt: 'Oversigt', vSiden: 'Siden sidst', vAngreb: 'Angreb', kraeverHandling: '{v} kræver handling', hvorforToken: 'Kræver en API-nøgle under Indstillinger.', kByggOm: 'Byg træet om', kSlaaAngreb: 'Slå Angreb til eller fra', h250Fod: 'Status med fremdrift (fra 2.5.0)', p250Fod: 'Statusdelen i fodlinjen: mærke, kort tekst, tynd fremdrift og en knap. Et trin læses ikke op; en ny tekst gør (høfligt).', koeHenter: 'Henter …', koeFaerdig: 'Alt er hentet', koeFejl: 'Hentningen fejlede', aabnOverblik: 'Åbn Overblik', kEtTrin: 'Et trin', kUbestemt: 'Ubestemt', kFaerdig: 'Færdig', kFejl: 'Fejl', h250Fliser: 'Valgt flise, to mål og frit indhold (fra 2.5.0)', p250Fliser: 'Klik på en flise for at vise den (aria-current, flade og dobbelt kant). Underteksten i den første er sit eget mål. Den sidste har to datoer med hvert sit link.', fliser250Aria: 'Afviste', flIGaar: 'Afvist i går', flIDag: 'Afvist i dag', iDagHidtil: 'I dag hidtil: 3', flSet: 'Først og sidst set', foerst: 'Først', sidst: 'Sidst', h250Kasse: 'Ikon i overskriften (fra 2.5.0)', p250Kasse: 'Et ikon i accent foran kassens overskrift.', kasseLaas: 'Lås', kasseLaasTekst: 'Låsen slår til efter 5 minutter uden brug.', h250Tom: 'En tom flade, der tager imod, og to handlinger (fra 2.5.0)', p250Tom: 'Fladen kan få fokus og tager imod ⌘V; den anden handling hjælper videre ad en anden vej.', tomModtagerH: 'Indsæt en tekst', tomModtagerP: 'Klik her og tryk ⌘V.', ariaModtager: 'Indsæt tekst med {v}', kAabnSager: 'Åbn Sager', modtaget: 'Modtaget: {v} tegn', h250Dialog: 'Dialoger, der kan fejle, og guiden (fra 2.5.0)', p250Dialog: 'Ny sag og Slet fejler første gang og lykkes anden gang: knappen venter, og fejlen står over fodlinjen. Om har fletbåndet over overskriften; guiden står i en bred dialog; Tre svar følger reglen for et spørgsmål med tre svar.', dlgNySag: 'Ny sag (kan fejle)', dlgNySagH: 'Ny sag', dlgNySagP: 'Første forsøg fejler, andet lykkes.', dlgNySagFejl: 'Der findes allerede en sag med det navn.', opretSag: 'Opret sag', dlgSletVent: 'Slet (kan fejle)', dlgSletVentP: 'Sletningen fejler første gang.', dlgSletFejl: 'Sagen kunne ikke slettes. Prøv igen.', dlgOm: 'Om', dlgOmH: 'Om demoen', dlgOmP: 'Fletbåndet står over overskriften; overskriften navngiver stadig dialogen.', kLuk: 'Luk', dlgGuide: 'Guide i dialog', dlgTre: 'Tre svar', dlgTreH: 'Gem den midlertidige sag?', dlgTreP: 'Den har 3 poster. Kassér sletter dem.', kKasser: 'Kassér', kGemSomSag: 'Gem som sag', h250Seg: 'Uden valg (fra 2.5.0)', p250Seg: 'Ved siden af et eget interval er intet valgt; et klik vælger og meldes.', pEget: 'Eget interval', h250Fjern: 'Aktive filtre, der kan fjernes (fra 2.5.0)', p250Fjern: 'Hele chippen fjerner filtret; fokus går til nabochippen. Nulstil lægger dem tilbage.', aktiveFiltre: 'Aktive filtre', fjernFilter: 'Fjern filter: {v}', fjernet: 'Fjernet: {v}', kNulstil: 'Nulstil', fltLand: 'Danmark', fltDato: '1.–4. november', h250Afk: 'Afkrydsning i en tabelrække (fra 2.5.0)', p250Afk: 'Boksen alene, 16 px; navnet siger, hvad den gør med rækken.', afk250Aria: 'Værdier, der maskeres', kolMaskeres: 'Maskér', kolVaerdi250: 'Værdi', ariaMaskerV: 'Maskér {v}', h250Raekke: 'Navn uden for komponenten (fra 2.5.0)', p250Raekke: 'Etiketten står i rækkens venstre side og navngiver kontrollen med aria-labelledby.', rTema: 'Tema', rTemaNote: 'Gælder kun dette vindue.', rSprog: 'Sprog', rAutostart: 'Start ved login', tekstZoom: '--tekst-zoom er {v} (fra 2.5.0)',
        h270Baand: 'Ét bånd: visningerne som store knapper (fra 2.7.0)', p270Baand: 'Under titellinjen står kun båndet. Visningerne er links forrest i båndet med aria-current på den åbne (flade, fed skrift og en streg); resten er visningens kommandoer. Siden sidst har et tal, Login er slået fra og siger hvorfor i tippet, og genvejen (Alt+1–4) står i tippet. Indstillinger er en kommando med aria-current, mens den er åben.', h270Mere: 'Mere: båndet står på én række (fra 2.7.0)', p270Mere: 'I et smalt bånd står de kommandoer, der ikke er plads til, i Mere sidst i båndet, med samme navne, ikoner og tilstande. Visningerne og den primære kommando bliver i båndet.', h270Otte: 'Otte visninger i båndet (fra 2.7.0)', p270Otte: 'Som Huginn and Muninn: otte visninger, Hent nu, hjælp og Indstillinger, med Mere.', kMere: 'Mere', kIndst: 'Indstillinger', gProgram: 'Program', kHent: 'Hent nu', kVejledning: 'Vejledning', kVisIndst: 'Indstillinger er åben',
        h260Faner: 'Visningerne som faner øverst (fra 2.6.0)', p260Faner: 'Visningsskiftet med faner: true står under titellinjen; båndet under (udenFaner) viser den valgte fanes kommandoer, og navigationsruden har kun træet. Piletasterne flytter og vælger; genvejen (Alt+1–4) står i fanens værktøjstip. Login er slået fra og siger hvorfor.', h260Otte: 'Otte faner i en smal række (fra 2.6.0)', p260Otte: 'Fanerne krymper med rækken; et navn, der ikke kan være der, afkortes med …, og rækken bliver aldrig bredere end vinduet.', h260Valgt: 'Valgt række under musen (fra 2.6.0)', p260Valgt: 'Hold musen over den valgte række: den viser valget, ikke hover-fladen.', hvorforLogin: 'Login kræver en API-nøgle under Indstillinger.', kUdskriv: 'Udskriv',
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
        hMaerker: 'Marks, data, scale and map', pMaerker: 'From 2.1.0. Status dots, six data series with axis and grid, a five-step scale and the map colours. Colour never stands alone: every mark has a name next to it.', hFarver: 'Colours', pFarver: 'All colours in the chosen theme. Switch theme in the title bar or on the View tab.',
        hSkrift: 'Type', pSkrift: 'Inter for everything, JetBrains Mono for values. Both are in the package.',
        hLuft: 'Spacing, radii and shadows', pLuft: 'Spacing in steps of 4 px; small radii; borders rather than shadows.',
        pSkygge: 'shadow-pop: for dialogs and menus above the page.', eksempelTekst: 'Calm, clarity and one clear next step',
        hBaandEnkel: 'Command bar with one tab', pBaandEnkel: 'From 2.2.0. A program you look at has few commands: no tab row (udenFaner), and a group can hold a segmented button or a picker.',
        gData: 'Data', gPeriode: 'Period', gDomaene: 'Domain', gHjaelp: 'Help', kOpdater: 'Refresh', kEksport: 'Export', kHjaelp: 'Help',
        navOtteH: 'Eight views', vOverblik: 'Overview', vSiden: 'Since last time', vAngreb: 'Attacks', vRobotter: 'Robots', vLogin: 'Login', vLand: 'Country now', vBesoeg: 'Visitors', vTek: 'Technology',
        pSidepanel: 'From 2.2.0. A panel on the right with a heading, a close button and content that scrolls. In wide windows it pushes the work area; below 1200 px it lies on top. Esc closes, and focus goes back.',
        spAabn: 'Open help', spH: 'Help', spLuk: 'Close help', spArb: 'The work area. It gets narrower when the panel pushes.', spTekst: 'This is where the explanation of the view you see goes. The panel is not a dialog: the rest of the screen can still be used.',
        spLukket: 'The panel was closed ({v}).',
        hVaelger: 'Picker', pVaelger: 'From 2.2.0. A button with the current value and a list. One choice in the title bar; several choices with a search field and "All" in the toolbar. Down arrow opens, Esc closes.',
        vlgLand: 'Country', vlgDomaener: 'Domains', landDk: 'Denmark', landSe: 'Sweden', landNo: 'Norway', landDe: 'Germany', landFi: 'Finland',
        alleDomaener: 'All domains', nValgt: '{v} selected', soegDomaene: 'Search the domains', soegDomaenePh: 'Search', ingenFundet: 'No domains match',
        hSegment: 'Segmented button', pSegment: 'From 2.2.0. Two to five choices, exactly one selected. Tab goes in and out as one control; the arrow keys move and select.',
        periodeAria: 'Period', p7: '7 days', p30: '30 days', pAar: 'Year',
        hFilterchip: 'Filter chip', pFilterchip: 'From 2.3.0. A chip that can be clicked: it turns a filter on and off. Selected has a tick, a border and bold text, not only a colour. The ordinary chip still cannot be clicked.',
        filterAria: 'Show', fcFejl: 'Errors', fcAdv: 'Warnings', fcInfo: 'Information',
        pStatusTile: 'From 2.3.0. One number, one label and one status; the whole tile is a button that opens what the number counts. A tile only exists when the user acts on the number.',
        fliserAria: 'Status of the case', flMaskeres: 'Will be masked', flVenter: 'Waiting for you', flHemmelige: 'Secrets', flRester: 'Left after masking', stKlar: 'Ready', stTjek: 'Check yourself', stKrypteres: 'Encrypted', stIngen: 'None', udvEnMere: '1 more than yesterday',
        hTom: 'Empty state', pTom: 'From 2.3.0. Icon, heading, one sentence and at most one action: for an empty view, an empty table and no matches.', hTomTabel: 'Empty table and no matches',
        tomSagerH: 'No cases yet', tomSagerP: 'Paste a text, and a temporary case is made. You can save it afterwards.', nySag: 'New case', ingenTraef: 'No matches', ingenTraefP: 'Nothing matches the search "srv-db".', kolNavn: 'Name', kolOprettet: 'Created',
        hFrem: 'Progress', pFrem: 'From 2.3.0. A determinate bar when the program knows how far it is, and a ring that spins when it does not. Always with a text; the ring stands still if you have asked for less motion.',
        fremAnalyserer: 'Analysing the file …', fremNafM: '{v} of {w} files', fremEtTrin: 'One step on', fremFaerdig: 'Done',
        hTip: 'Tooltip', pTip: 'From 2.3.0. Shown on hover and on Tab, can be kept open with the mouse and closed with Esc. For explanations beyond the name; the name itself is in aria-label.',
        tipKopier: 'Copy', tipKopierHvorfor: 'Select a row in the table first.', tipKopierVaerdi: 'Copy the value', tipKopierVaerdiTip: 'Copies the masked value, never the original.',
        hAfk: 'Checkbox', pAfk: 'From 2.3.0. The browser\'s own checkbox drawn by the kit: tick, partly selected (a line), help and error below.',
        afkAlle: 'Select all types', afkIp: 'IP addresses', afkVaert: 'Host names', afkBruger: 'User names', afkFremmede: 'Mask foreign public addresses', hjFremmede: 'Addresses that are neither yours nor documentation networks.', afkVilkaar: 'I have read the guide', fejlVilkaar: 'Tick the box to go on.',
        hKontakt: 'Switch', pKontakt: 'From 2.3.0. On or off, and it works at once. On and off are seen on the position of the knob and on the word, not only on the colour.',
        kontaktLaas: 'Lock after 5 minutes without use', kontaktLyd: 'Sound on errors', til: 'On', fra: 'Off', hjLyd: 'Cannot be used in this demo.',
        hRadio: 'Radio group', pRadio: 'From 2.3.0. One of a few choices in a form, all visible. The arrow keys move and select; Tab goes in and out as one stop.',
        radioMaske: 'What is masked?', radioAlt: 'Everything found', radioHemmelig: 'Only secrets', radioIntet: 'Nothing', hjIntet: 'The text is shared as it is.', radioTema: 'Theme in the window', fejlRadio: 'Choose a theme.',
        hValgliste: 'Select list', pValgliste: 'From 2.3.0. The browser\'s own select with the border and arrow of the kit. For one of many choices in a form.',
        vlUdloeb: 'Expires after', vl7: '7 days', vl30: '30 days', vl90: '90 days', vlAldrig: 'Never', hjUdloeb: 'The case is deleted when it expires.', vlSprog: 'Language of the receipt', vlVaelg: 'Choose …', fejlSprog: 'Choose a language.',
        pDialog: 'From 2.3.0. The browser\'s own dialog: focus stays in the dialog, Esc closes, and focus goes back afterwards. The primary button is on the right; a dangerous action has its own colour and does not get focus.',
        dlgOmdoeb: 'Rename the case …', dlgOmdoebH: 'Rename the case', dlgOmdoebP: 'The name is only seen on this machine.', dlgNavn: 'New name', dlgNavnFejl: 'Enter a name.', annuller: 'Cancel', gem: 'Save', lukAria: 'Close',
        dlgSlet: 'Delete the case …', dlgSletH: 'Delete the case?', dlgSletP: 'The case and its key are deleted. It cannot be undone.', slet: 'Delete case', svaret: 'The answer was: {v}',
        hTabelNy: 'Sorting, two header rows and paging', pTabelNy: 'From 2.3.0. Click a column header to sort (the program sorts itself); the groups Rejected and Attacks stand over their columns; the pages are changed below the table.',
        tabelNyAria: 'Domains', kolDomaene: 'Domain', thAfvist: 'Rejected', thIGaar: 'Yesterday', th7: '7 days', thAngreb: 'Attacks', thUge: 'This week',
        siderAria: 'Pages in the table', forrige: 'Previous', naeste: 'Next', sideAf: 'Page {v} of {w}', prSide: 'Per page',
        hTekst: 'Text size', pTekst: 'From 2.3.0. Three steps as one scale for the whole surface; the choice is remembered and set before the page is drawn. Also try ⌘+, ⌘− and ⌘0 (Ctrl on Windows): the shortcuts are the program\'s, the functions the kit\'s.',
        tekstAria: 'Text size', tLille: 'Small', tNormal: 'Normal', tStor: 'Large', gTekst: 'Text',
        hKasse: 'Box', pKasse: 'From 2.3.0. The card of the kit: a surface with a heading, content, an optional action in the header and an optional footer. The class is .kasse.',
        hTabelAabn: 'Rows that open, and a table without row selection', pTabelAabn: 'From 2.4.0. At the top a row opens something with a click, Enter or space; the arrow keys only move. The numbers are buttons of their own and do not open the row. The frame scrolls sideways, and the domain stays put. At the bottom a table that is only read: no row can be selected, but the buttons work.',
        tabelAabnNavn: 'Domains that can be opened', tabelRulAria: 'Domains, scrolls sideways', kolHvorfor: 'Why', kolAabn: 'Open', kolDetaljer: 'Details', aabnFor: 'Open {v}', hentetTitel: 'Fetched today', intetAabnet: 'Nothing opened yet.', aabnet: 'Opened: {v}', talAria: '{v} rejected yesterday', talValgt: 'The number for {v} (the row was not opened)',
        stRoligt: 'Calm', stHoldOeje: 'Watch', stHandl: 'Act', hvorforTekst: 'Most login attempts from an unknown network; all were stopped.',
        tabelLaesNavn: 'Latest events', kolDag: 'Day', kolHaendelse: 'Event', hLogin: 'Login rejected', hDmarc: 'DMARC failed', hTrafik: 'Traffic rose', visKilde: 'Show', visKildeAria: 'Show {v}', visValgt: 'Shown: {v}',
        gFra: 'Copy ⌘C (disabled: text in --text-disabled)',
        h240: 'Hover, arcs and faint surfaces', p240: 'From 2.4.0. The bars change to the hover colour of the mark under the mouse (the mark mixed with the text colour). Below them the faint surface of each mark (18 %) with text on it. On the map the arc that is an attack is red like the ring; the blue arc means nothing but the route. The legend stands on an almost opaque surface (92 %).',
        svagTekst: 'Text on a faint surface', kortAngreb: 'Attack (danger-mark)', kortBue: 'Arc without meaning (map-arc)',
        kasseSager: 'Latest cases', kasseNet: 'Own networks', visAlle: 'Show all', kasseFod: 'Updated 2 minutes ago', sag1: 'Support case 0042', sag2: 'Supplier 0007', sag3: 'Test 0001', netTekst: 'Addresses in 192.0.2.0/24 and 2001:db8::/32 are always masked.',
        h250Titel: 'Mark and title bar buttons (from 2.5.0)', p250Titel: 'The mark is the program’s own (here a mask of stripes in the title bar’s mark colour). Forward is disabled, the gear points to what is shown (line below), and help has its panel open (ring); click help to switch.', ariaFrem: 'Forward', ariaIndst: 'Settings', ariaHjaelp: 'Help', hjaelpAaben: 'Help: the panel is open', hjaelpLukket: 'Help: the panel is closed', h250Hvorfor: 'Why in a tooltip (from 2.5.0)', p250Hvorfor: 'With hvorforTip: true the explanation is in a tooltip that shows on Tab and is read out. The button below turns Copy on and off.', kSlaaTil: 'Turn Copy on or off', h250Nav: 'A tree that is rebuilt, and a view switcher with counts (from 2.5.0)', p250Nav: 'Rebuild changes the domains without losing the selection, folding or focus (and without calling vedValg). Since last time has a count that requires action; Attacks is disabled and says why in a tooltip.', tSamlet: 'All domains', vOversigt: 'Overview', vSiden: 'Since last time', vAngreb: 'Attacks', kraeverHandling: '{v} require action', hvorforToken: 'Requires an API key under Settings.', kByggOm: 'Rebuild the tree', kSlaaAngreb: 'Turn Attacks on or off', h250Fod: 'Status with progress (from 2.5.0)', p250Fod: 'The status part of the footer: mark, short text, thin progress and a button. A step is not read out; a new text is (politely).', koeHenter: 'Fetching …', koeFaerdig: 'Everything is fetched', koeFejl: 'Fetching failed', aabnOverblik: 'Open Overview', kEtTrin: 'One step', kUbestemt: 'Indeterminate', kFaerdig: 'Done', kFejl: 'Error', h250Fliser: 'Selected tile, two targets and free content (from 2.5.0)', p250Fliser: 'Click a tile to show it (aria-current, surface and double border). The subtext of the first is its own target. The last has two dates with a link each.', fliser250Aria: 'Rejected', flIGaar: 'Rejected yesterday', flIDag: 'Rejected today', iDagHidtil: 'Today so far: 3', flSet: 'First and last seen', foerst: 'First', sidst: 'Last', h250Kasse: 'Icon in the heading (from 2.5.0)', p250Kasse: 'An icon in accent before the box heading.', kasseLaas: 'Lock', kasseLaasTekst: 'The lock turns on after 5 minutes without use.', h250Tom: 'An empty surface that receives, and two actions (from 2.5.0)', p250Tom: 'The surface can take focus and receives ⌘V; the second action helps on another way.', tomModtagerH: 'Paste a text', tomModtagerP: 'Click here and press ⌘V.', ariaModtager: 'Paste text with {v}', kAabnSager: 'Open Cases', modtaget: 'Received: {v} characters', h250Dialog: 'Dialogs that can fail, and the guide (from 2.5.0)', p250Dialog: 'New case and Delete fail the first time and succeed the second: the button waits, and the error stands above the footer. About has the braid above the heading; the guide is in a wide dialog; Three answers follows the rule for a question with three answers.', dlgNySag: 'New case (can fail)', dlgNySagH: 'New case', dlgNySagP: 'The first attempt fails, the second succeeds.', dlgNySagFejl: 'A case with that name already exists.', opretSag: 'Create case', dlgSletVent: 'Delete (can fail)', dlgSletVentP: 'Deleting fails the first time.', dlgSletFejl: 'The case could not be deleted. Try again.', dlgOm: 'About', dlgOmH: 'About the demo', dlgOmP: 'The braid stands above the heading; the heading still names the dialog.', kLuk: 'Close', dlgGuide: 'Guide in a dialog', dlgTre: 'Three answers', dlgTreH: 'Save the temporary case?', dlgTreP: 'It has 3 entries. Discard deletes them.', kKasser: 'Discard', kGemSomSag: 'Save as case', h250Seg: 'Without a selection (from 2.5.0)', p250Seg: 'Next to a custom range nothing is selected; a click selects and is reported.', pEget: 'Custom range', h250Fjern: 'Active filters that can be removed (from 2.5.0)', p250Fjern: 'The whole chip removes the filter; focus goes to the neighbouring chip. Reset puts them back.', aktiveFiltre: 'Active filters', fjernFilter: 'Remove filter: {v}', fjernet: 'Removed: {v}', kNulstil: 'Reset', fltLand: 'Denmark', fltDato: '1–4 November', h250Afk: 'Checkbox in a table row (from 2.5.0)', p250Afk: 'The box alone, 16 px; the name says what it does with the row.', afk250Aria: 'Values that are masked', kolMaskeres: 'Mask', kolVaerdi250: 'Value', ariaMaskerV: 'Mask {v}', h250Raekke: 'Name outside the component (from 2.5.0)', p250Raekke: 'The label stands in the left side of the row and names the control with aria-labelledby.', rTema: 'Theme', rTemaNote: 'Applies to this window only.', rSprog: 'Language', rAutostart: 'Start at login', tekstZoom: '--tekst-zoom is {v} (from 2.5.0)',
        h270Baand: 'One command bar: the views as large buttons (from 2.7.0)', p270Baand: 'Below the title bar there is only the command bar. The views are links at the front of it with aria-current on the open one (surface, bold and a line); the rest is the view’s commands. Since last time has a number, Login is disabled and says why in the tooltip, and the shortcut (Alt+1–4) is in the tooltip. Settings is a command with aria-current while it is open.', h270Mere: 'More: the command bar stays on one row (from 2.7.0)', p270Mere: 'In a narrow command bar, the commands there is no room for are in More at the end, with the same names, icons and states. The views and the primary command stay in the bar.', h270Otte: 'Eight views in the command bar (from 2.7.0)', p270Otte: 'Like Huginn and Muninn: eight views, Fetch now, help and Settings, with More.', kMere: 'More', kIndst: 'Settings', gProgram: 'Program', kHent: 'Fetch now', kVejledning: 'Guide', kVisIndst: 'Settings is open',
        h260Faner: 'The views as tabs at the top (from 2.6.0)', p260Faner: 'The view switcher with faner: true stands below the title bar; the command bar below (udenFaner) shows the selected tab’s commands, and the navigation pane has only the tree. The arrow keys move and select; the shortcut (Alt+1–4) is in the tab’s tooltip. Login is disabled and says why.', h260Otte: 'Eight tabs in a narrow row (from 2.6.0)', p260Otte: 'The tabs shrink with the row; a name that does not fit is shortened with …, and the row never gets wider than the window.', h260Valgt: 'A selected row under the mouse (from 2.6.0)', p260Valgt: 'Hold the mouse over the selected row: it shows the selection, not the hover surface.', hvorforLogin: 'Login requires an API key under Settings.', kUdskriv: 'Print',
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

  /* 2.3.0: en tabel, der sorteres og deles i sider. Programmet (her demoen) sorterer og skærer rækkerne til; kittet melder
     kolonne, retning og side. Kun opdigtede domæner og tal. */
  const DOMAENE_NAVNE = ['eksempel.dk', 'shop.eksempel.dk', 'blog.eksempel.dk', 'api.eksempel.dk', 'intra.eksempel.dk', 'mail.eksempel.dk', 'www.eksempel.dk', 'test.eksempel.dk', 'filer.eksempel.dk', 'vpn.eksempel.dk', 'git.eksempel.dk', 'wiki.eksempel.dk'];
  const DOMAENE_TAL = DOMAENE_NAVNE.map((navn, i) => [navn, (i * 37) % 50, (i * 53) % 90 + 3, (i * 17) % 11]);
  let tabelSort = { kolonne: 0, retning: 'stigende' }, tabelSide = 1, tabelPr = 5;
  const antalSider = () => Math.ceil(DOMAENE_TAL.length / tabelPr);
  function sideRaekker() {
    const k = tabelSort.kolonne, fortegn = tabelSort.retning === 'faldende' ? -1 : 1;
    return DOMAENE_TAL.slice().sort((a, b) => (a[k] < b[k] ? -1 : a[k] > b[k] ? 1 : 0) * fortegn)
      .slice((tabelSide - 1) * tabelPr, tabelSide * tabelPr).map(r => ({ celler: r, mono: [0], data: r[0] }));
  }
  const tabelNy = K.tabel({
    ariaT: 'tabelNyAria',
    kolonnegrupper: [{ id: 'afvist', t: 'thAfvist' }, { id: 'angreb', t: 'thAngreb' }],
    kolonner: [{ t: 'kolDomaene', sort: true }, { t: 'thIGaar', tal: true, gruppe: 'afvist', sort: true, sortStart: 'faldende' }, { t: 'th7', tal: true, gruppe: 'afvist', sort: true, sortStart: 'faldende' }, { t: 'thUge', tal: true, gruppe: 'angreb', sort: true, sortStart: 'faldende' }],
    sortering: tabelSort, raekker: sideRaekker(),
    vedSortering: (kolonne, retning) => { tabelSort = { kolonne, retning }; tabelSide = 1; sider.saet(1); tabelNy.saetRaekker(sideRaekker()); S.anvend(sider.rod); },
    vedValg: (tr, data) => meld('tabel-ny-valgt', null, data),
  });
  const sider = K.sideskift({
    ariaT: 'siderAria', side: 1, sider: antalSider(), forrige: { t: 'forrige' }, naeste: { t: 'naeste' }, sideAf: { t: 'sideAf' },
    valg: [5, 10, 25], prSide: tabelPr, prSideEtiket: { t: 'prSide' },
    vedSide: n => { tabelSide = n; tabelNy.saetRaekker(sideRaekker()); S.anvend(sider.rod); },
    vedPrSide: n => { tabelPr = n; tabelSide = 1; sider.saet(1, antalSider()); tabelNy.saetRaekker(sideRaekker()); S.anvend(sider.rod); },
  });
  $('demo-tabel-ny').append(tabelNy, sider.rod);

  /* 2.4.0 (K36–K38): rækker, der åbner, i en rulleramme med fast første kolonne; tallene er knapper, der ikke åbner
     rækken. Under den en tabel, der kun skal læses (ingen rækkevalg), med en knap i hver række. Kun opdigtede data. */
  const meldV = (id, noegle, v) => { const p = $(id); p.setAttribute('data-t', noegle); p.setAttribute('data-v', String(v)); S.anvend(p); };
  const STATUS = [['ok', 'stRoligt'], ['warn', 'stHoldOeje'], ['danger', 'stHandl']];
  const tekstEl240 = (tag, t, v) => { const e = document.createElement(tag); e.setAttribute('data-t', t); if (v != null) e.setAttribute('data-v', String(v)); return e; };
  const aabnRaekker = DOMAENE_TAL.slice(0, 8).map(([navn, iGaar, syv, uge], i) => {
    const tal = document.createElement('button');
    tal.type = 'button';
    tal.className = 'demo-tal';
    tal.textContent = String(iGaar);
    tal.setAttribute('data-t-aria', 'talAria');
    tal.setAttribute('data-v', navn);
    tal.addEventListener('click', () => meldV('tabel-aabn-valgt', 'talValgt', navn));
    const chev = document.createElement('span');
    chev.append(K.ikon('hoejre', 'ik'));
    const skjult = tekstEl240('span', 'aabnFor', navn);
    skjult.className = 'skjult-tekst';
    chev.append(skjult);
    return { celler: [navn, K.chip(STATUS[i % 3][0], { t: STATUS[i % 3][1] }), tekstEl240('span', 'hvorforTekst'), tal, syv, uge, chev], data: navn, attr: { 'data-zone': 'z' + (i + 1) }, titelT: 'hentetTitel' };
  });
  const tabelAabn = K.tabel({
    titelT: 'tabelAabnNavn', raekkeHandling: 'aabn', layout: 'auto', fastFoerste: true,
    kolonnegrupper: [{ id: 'afvist', t: 'thAfvist', skille: true }, { id: 'angreb', t: 'thAngreb', skille: true }],
    kolonner: [{ t: 'kolDomaene', hoved: true }, { t: 'kolStatus' }, { t: 'kolHvorfor', bredde: 'l' }, { t: 'thIGaar', tal: true, gruppe: 'afvist', bredde: 's' }, { t: 'th7', tal: true, gruppe: 'afvist', bredde: 's' }, { t: 'thUge', tal: true, gruppe: 'angreb', bredde: 's' }, { t: 'kolAabn', bredde: 'xs', klasse: 'demo-chev' }],
    raekker: aabnRaekker,
    vedAabn: (tr, data) => meldV('tabel-aabn-valgt', 'aabnet', data),
  });
  const rul = K.tabelRul(tabelAabn, { ariaT: 'tabelRulAria' });
  $('demo-tabel-aabn').appendChild(rul.rod);
  const laesRaekker = [['2026-11-10', 'eksempel.dk', 'hLogin', 4], ['2026-11-10', 'shop.eksempel.dk', 'hDmarc', 1], ['2026-11-09', 'api.eksempel.dk', 'hTrafik', 12]].map(([dag, navn, h, n]) => {
    const vis = K.knap({ t: 'visKilde', variant: 'ghost', ved: () => meldV('tabel-laes-valgt', 'visValgt', navn) });
    vis.setAttribute('data-t-aria', 'visKildeAria');
    vis.setAttribute('data-v', navn);
    return { celler: [dag, navn, tekstEl240('span', h), n, vis], mono: [0, 1], data: navn };
  });
  $('demo-tabel-laes').appendChild(K.tabel({
    titelT: 'tabelLaesNavn', raekkeHandling: 'ingen',
    kolonner: [{ t: 'kolDag', bredde: 'l' }, { t: 'kolDomaene', hoved: true }, { t: 'kolHaendelse' }, { t: 'kolAntal', tal: true, bredde: 's' }, { t: 'kolDetaljer', bredde: 'm' }],
    raekker: laesRaekker,
  }));

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

  /* ── 2.2.0: otte visninger, bånd med én fane, vælger, sidepanel og segmentknap ── */
  K.visningsskift($('demo-skift-otte'), [
    ['overblik', 'vOverblik', 'mappe'], ['siden', 'vSiden', 'kalender'], ['angreb', 'vAngreb', 'skjold'], ['robotter', 'vRobotter', 'filter'],
    ['login', 'vLogin', 'laas'], ['land', 'vLand', 'sprog'], ['besoeg', 'vBesoeg', 'oeje'], ['tek', 'vTek', 'tandhjul'],
  ].map(([id, t, ikon], i) => ({ id, t, ikon, genvej: String(i + 1) })), { ariaT: 'visninger' }).markér('overblik');

  const DOMAENER = [{ id: 'z1', tekst: 'eksempel.dk', antal: 412 }, { id: 'z2', tekst: 'shop.eksempel.dk', antal: 87 }, { id: 'z3', tekst: 'blog.eksempel.dk', antal: 9 },
    { id: 'z4', tekst: 'api.eksempel.dk', antal: 1530 }, { id: 'z5', tekst: 'intra.eksempel.dk', antal: 0 }];
  const navneAf = ids => ids.map(id => DOMAENER.find(z => z.id === id).tekst).join(', ') || '–';

  const periode = K.segment({ ariaT: 'periodeAria', valgt: '7', valg: [{ id: '7', t: 'p7' }, { id: '30', t: 'p30' }, { id: 'aar', t: 'pAar' }], vedValg: id => meld('segment-valgt', { 7: 'p7', 30: 'p30', aar: 'pAar' }[id]) });
  $('demo-segment').appendChild(periode.rod);

  const baandPeriode = K.segment({ ariaT: 'periodeAria', valgt: '30', valg: [{ id: '7', t: 'p7' }, { id: '30', t: 'p30' }, { id: 'aar', t: 'pAar' }], vedValg: id => meld('baand-enkel-valgt', { 7: 'p7', 30: 'p30', aar: 'pAar' }[id]) });
  const baandDomaene = K.vaelger({ etiket: { t: 'gDomaene' }, punkter: DOMAENER.slice(0, 3), valgt: 'z1', vedValg: id => meld('baand-enkel-valgt', null, navneAf([id])) });
  K.commandBar($('demo-baand-enkel'), {
    ariaT: 'cmdAria', udenFaner: true,
    faner: [{ id: 'start', t: 'faneStart', grupper: [
      { t: 'gData', knapper: [
        { id: 'opdater', t: 'kOpdater', ikon: 'afspil', pri: true, ved: () => meld('baand-enkel-valgt', 'kOpdater') },
        { id: 'eksport', t: 'kEksport', ikon: 'eksport', ved: () => meld('baand-enkel-valgt', 'kEksport') },
      ] },
      { t: 'gPeriode', knapper: [{ id: 'periode', element: baandPeriode.rod }] },
      { t: 'gDomaene', knapper: [{ id: 'domaene', element: baandDomaene.rod }] },
      { t: 'gHjaelp', knapper: [{ id: 'hjaelp', t: 'kHjaelp', ikon: 'bog', ved: () => meld('baand-enkel-valgt', 'kHjaelp') }] },
    ] }],
  });

  const land = K.vaelger({
    etiket: { t: 'vlgLand' }, valgt: 'dk',
    punkter: [{ id: 'dk', t: 'landDk', antal: 12 }, { id: 'se', t: 'landSe', antal: 4 }, { id: 'no', t: 'landNo', antal: 3 }, { id: 'de', t: 'landDe', antal: 2 }, { id: 'fi', t: 'landFi' }],
    vedValg: id => meld('vaelger-valgt', { dk: 'landDk', se: 'landSe', no: 'landNo', de: 'landDe', fi: 'landFi' }[id]),
  });
  $('demo-vaelger-hoejre').appendChild(land.rod);
  const domaener = K.vaelger({
    etiket: { t: 'vlgDomaener' }, flere: true, alle: { t: 'alleDomaener' }, nValgt: { t: 'nValgt' },
    soeg: { ph: 'soegDomaenePh', ariaT: 'soegDomaene' }, ingen: { t: 'ingenFundet' },
    punkter: DOMAENER, valgt: DOMAENER.map(z => z.id),
    vedValg: ids => { S.anvend(domaener.rod); meld('vaelger-valgt', null, navneAf(ids)); },
  });
  $('demo-vaelger-vl').appendChild(domaener.rod);

  const spIndhold = document.createElement('p');
  spIndhold.setAttribute('data-t', 'spTekst');
  const panel = K.sidepanel($('demo-sidepanel'), {
    t: 'spH', lukAriaT: 'spLuk', indhold: spIndhold,
    vedLuk: aarsag => { const p = $('sp-valgt'); p.setAttribute('data-t', 'spLukket'); p.setAttribute('data-v', aarsag); S.anvend(p); },
  });
  $('demo-sp-aabn').addEventListener('click', () => panel.skift());

  /* ── 2.3.0: komponenterne (K10–K17) ── */
  const FC = { fejl: 'fcFejl', adv: 'fcAdv', info: 'fcInfo' };
  const filtre = K.filterchips({
    ariaT: 'filterAria', valgt: ['fejl'],
    chips: [{ id: 'fejl', t: 'fcFejl', antal: 3 }, { id: 'adv', t: 'fcAdv', antal: 12 }, { id: 'info', t: 'fcInfo', antal: 40 }],
    vedValg: ids => meld('filterchip-valgt', null, ids.map(id => S.t(FC[id])).join(', ') || '–'),
  });
  $('demo-filterchips').appendChild(filtre.rod);

  $('demo-fliser').appendChild(K.statusfliser({
    ariaT: 'fliserAria',
    fliser: [
      { t: 'flMaskeres', tal: 13, status: { variant: 'ok', t: 'stKlar' }, ved: () => meld('flise-valgt', 'flMaskeres') },
      { t: 'flVenter', tal: 2, status: { variant: 'warn', t: 'stTjek' }, udvikling: { retning: 'op', t: 'udvEnMere' }, ved: () => meld('flise-valgt', 'flVenter') },
      { t: 'flHemmelige', tal: 1, status: { variant: 'info', t: 'stKrypteres' }, ved: () => meld('flise-valgt', 'flHemmelige') },
      { t: 'flRester', tal: 0, status: { variant: 'ok', t: 'stIngen' }, ved: () => meld('flise-valgt', 'flRester') },
    ],
  }));

  $('demo-tom-stor').appendChild(K.tomTilstand({ ikon: 'mappe', t: 'tomSagerH', p: { t: 'tomSagerP' }, handling: { t: 'nySag', variant: 'primary', ved: () => meld('tom-valgt', 'nySag') } }));
  $('demo-tom-tabel').append(
    K.tabel({ ariaT: 'hTomTabel', kolonner: [{ t: 'kolNavn' }, { t: 'kolOprettet' }], raekker: [] }),
    K.tomTilstand({ lille: true, ikon: 'soeg', t: 'ingenTraef', p: { t: 'ingenTraefP' }, handling: { t: 'rydFilter', ved: () => meld('tom-valgt', 'rydFilter') } }),
  );

  const fremRamme = $('demo-frem');
  const fremU = K.fremdrift({ t: 'fremAnalyserer' });
  const fremB = K.fremdrift({ t: 'fremNafM', maks: 8, vaerdi: 3, omraade: fremRamme });
  fremB.rod.querySelector('.frem-tekst').setAttribute('data-v', '3');
  fremB.rod.querySelector('.frem-tekst').setAttribute('data-w', '8');
  fremRamme.append(fremU.rod, fremB.rod);
  let fremN = 3;
  $('demo-frem-knapper').appendChild(K.knap({ t: 'fremEtTrin', ved: () => {
    fremN = fremN >= 8 ? 0 : fremN + 1;
    fremB.saet(fremN, fremN === 8 ? { t: 'fremFaerdig' } : { t: 'fremNafM', v: fremN, w: 8 });
    if (fremN === 8) fremB.faerdig(); else fremRamme.setAttribute('aria-busy', 'true');
    S.anvend(fremB.rod);
  } }));

  const tipKnap = K.knap({ t: 'tipKopier', ikon: 'kopier' });
  tipKnap.setAttribute('aria-disabled', 'true');
  const tipIkon = K.knap({ ikon: 'kopier', ariaT: 'tipKopierVaerdi', variant: 'ghost' });
  tipIkon.setAttribute('data-t-title', 'tipKopierVaerdi');
  $('demo-tip').append(tipKnap, tipIkon);
  K.vaerktoejstip(tipKnap, { t: 'tipKopierHvorfor' });
  K.vaerktoejstip(tipIkon, { t: 'tipKopierVaerdiTip' });

  /* Afkrydsning: "Vælg alle" over tre typer er delvis valgt, når nogle er valgt. */
  const AFK = { ip: 'afkIp', vaert: 'afkVaert', bruger: 'afkBruger' };
  const typer = {};
  const alleTyper = K.afkrydsning({ t: 'afkAlle', delvis: true, vedSkift: v => { for (const a of Object.values(typer)) a.saetValgt(v); visTyper(); } });
  function visTyper() {
    const valgte = Object.keys(typer).filter(k => typer[k].valgt);
    if (valgte.length === 0 || valgte.length === 3) alleTyper.saetValgt(valgte.length === 3); else alleTyper.saetDelvis();
    meld('afk-valgt', null, valgte.map(k => S.t(AFK[k])).join(', ') || '–');
  }
  const typeListe = document.createElement('div');
  typeListe.className = 'demo-stak demo-ind';
  for (const [id, t] of Object.entries(AFK)) {
    typer[id] = K.afkrydsning({ t, valgt: id === 'ip', vedSkift: visTyper });
    typeListe.appendChild(typer[id].rod);
  }
  $('demo-afk').append(alleTyper.rod, typeListe,
    K.afkrydsning({ t: 'afkFremmede', valgt: true, hjaelp: { t: 'hjFremmede' } }).rod,
    K.afkrydsning({ t: 'afkVilkaar', fejl: { t: 'fejlVilkaar' } }).rod);

  const kontaktLaas = K.kontakt({ t: 'kontaktLaas', til: true, ord: { til: { t: 'til' }, fra: { t: 'fra' } }, vedSkift: til => meld('kontakt-valgt', til ? 'til' : 'fra') });
  $('demo-kontakt').append(kontaktLaas.rod, K.kontakt({ t: 'kontaktLyd', deaktiveret: true, ord: { til: { t: 'til' }, fra: { t: 'fra' } }, hjaelp: { t: 'hjLyd' } }).rod);

  const RADIO = { alt: 'radioAlt', hemmelig: 'radioHemmelig', intet: 'radioIntet' };
  const radioMaske = K.radiogruppe({ etiket: { t: 'radioMaske' }, valgt: 'alt', valg: [{ id: 'alt', t: 'radioAlt' }, { id: 'hemmelig', t: 'radioHemmelig' }, { id: 'intet', t: 'radioIntet', hjaelp: { t: 'hjIntet' } }], vedValg: id => meld('radio-valgt', RADIO[id]) });
  const radioTema = K.radiogruppe({ etiket: { t: 'radioTema' }, vandret: true, fejl: { t: 'fejlRadio' }, valg: [{ id: 'lys', t: 'kLys' }, { id: 'moerk', t: 'kMoerk' }, { id: 'system', t: 'kSystem' }] });
  $('demo-radio').append(radioMaske.rod, radioTema.rod);

  const VL = { 7: 'vl7', 30: 'vl30', 90: 'vl90', aldrig: 'vlAldrig' };
  $('demo-valgliste').append(
    K.valgliste({ etiket: { t: 'vlUdloeb' }, hjaelp: { t: 'hjUdloeb' }, valgt: '30', valg: [{ id: '7', t: 'vl7' }, { id: '30', t: 'vl30' }, { id: '90', t: 'vl90' }, { id: 'aldrig', t: 'vlAldrig' }], vedValg: id => meld('valgliste-valgt', VL[id]) }).rod,
    K.valgliste({ etiket: { t: 'vlSprog' }, fejl: { t: 'fejlSprog' }, valgt: '', valg: [{ id: '', t: 'vlVaelg' }, { id: 'da', t: 'kDansk' }, { id: 'en', t: 'kEngelsk' }] }).rod,
  );

  /* Dialog: en lille formular, der holder sig åben ved en fejl, og en bekræftelse af en farlig handling. */
  function svaret(v) { const p = $('dialog-valgt'); p.setAttribute('data-t', 'svaret'); p.setAttribute('data-v', v); S.anvend(p); }
  const navnFelt = K.felt({ etiket: { t: 'dlgNavn' }, vaerdi: 'Supportsag 0042', foelsom: true });
  const omdoeb = K.dialog({
    t: 'dlgOmdoebH', p: { t: 'dlgOmdoebP' }, indhold: navnFelt, luk: { ariaT: 'lukAria' },
    knapper: [{ id: 'gem', t: 'gem', variant: 'primary', ved: () => {
      const inp = navnFelt.querySelector('input'), hj = navnFelt.querySelector('.hj');
      const tomt = !inp.value.trim();
      inp.toggleAttribute('aria-invalid', tomt);
      hj.classList.toggle('fejltekst', tomt);
      if (tomt) { hj.setAttribute('data-t', 'dlgNavnFejl'); inp.setAttribute('aria-describedby', hj.id); S.anvend(hj); inp.focus(); return false; }
      return true;
    } }, { id: 'annuller', t: 'annuller' }],
    vedLuk: svaret,
  });
  $('demo-dialog').append(
    K.knap({ t: 'dlgOmdoeb', ved: () => { S.anvend(omdoeb.rod); omdoeb.aabn(); } }),
    K.knap({ t: 'dlgSlet', variant: 'danger', ikon: 'slet', ved: () => K.bekraeft({ t: 'dlgSletH', p: { t: 'dlgSletP' }, nej: { t: 'annuller' }, ja: { t: 'slet' }, farlig: true, udfyld: rod => S.anvend(rod) }).then(ja => svaret(String(ja))) }),
  );

  /* Tekststørrelse: kittets funktioner (tema.js), demoens egen segmentknap og genveje. */
  const TEKST_T = { lille: 'tLille', normal: 'tNormal', stor: 'tStor' };
  const tekstValg = K.segment({ ariaT: 'tekstAria', valgt: window.Tekst.valg, valg: window.Tekst.TRIN.map(id => ({ id, t: TEKST_T[id] })), vedValg: id => window.Tekst.saet(id) });
  $('demo-tekst').appendChild(tekstValg.rod);
  document.addEventListener('kit-demo-tekst', () => { tekstValg.vaelg(window.Tekst.valg); meld('tekst-valgt', TEKST_T[window.Tekst.valg]); });
  document.addEventListener('keydown', e => {
    if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
    if (e.key === '+' || e.key === '=') { e.preventDefault(); window.Tekst.større(); }
    else if (e.key === '-') { e.preventDefault(); window.Tekst.mindre(); }
    else if (e.key === '0') { e.preventDefault(); window.Tekst.nulstil(); }
  });

  const tekstEl = (tag, noegle, klasse) => { const e = document.createElement(tag); e.setAttribute('data-t', noegle); if (klasse) e.className = klasse; return e; };
  const sagListe = document.createElement('ul');
  sagListe.className = 'demo-liste';
  for (const n of ['sag1', 'sag2', 'sag3']) sagListe.appendChild(tekstEl('li', n));
  const kasseSager = K.kasse({ t: 'kasseSager', handling: K.knap({ t: 'visAlle', variant: 'ghost', ved: () => meld('kasse-valgt', 'visAlle') }), indhold: sagListe, fod: tekstEl('span', 'kasseFod') });
  const kasseNet = K.kasse({ t: 'kasseNet', indhold: tekstEl('p', 'netTekst', 'muted') });
  $('demo-kasser').append(kasseSager.rod, kasseNet.rod);

  /* ── Tokens-visningen. Navnene er dem i tokens.json (testen holder dem ens). ── */
  const FARVER = ['bg', 'surface', 'surface-raised', 'rail', 'rail-text', 'rail-strong', 'rail-active', 'accent-on-rail', 'border', 'border-strong', 'text', 'text-muted', 'text-disabled', 'accent', 'accent-hover', 'on-accent', 'accent-soft', 'ok', 'ok-soft', 'info', 'info-soft', 'warn', 'warn-soft', 'danger', 'danger-soft', 'ok-mark', 'warn-mark', 'danger-mark', 'info-mark', 'none-mark', 'ok-mark-hover', 'warn-mark-hover', 'danger-mark-hover', 'info-mark-hover', 'none-mark-hover', 'data-1', 'data-2', 'data-3', 'data-4', 'data-5', 'data-6', 'data-axis', 'data-grid', 'data-label', 'seq-1', 'seq-2', 'seq-3', 'seq-4', 'seq-5', 'map-sea', 'map-land', 'map-border', 'map-ring', 'map-arc'];
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

  /* ── Mærker, data, skala og kort (2.1.0). Kun tokens; programmet tegner selv prikken, søjlen og kortet. ── */
  for (const m of ['ok-mark', 'warn-mark', 'danger-mark', 'info-mark', 'none-mark']) {
    const d = document.createElement('span'), i = document.createElement('i');
    d.className = 'demo-prik';
    i.style.background = `var(--${m})`;
    d.append(i, mono(m));
    $('demo-maerker').appendChild(d);
  }
  [72, 48, 88, 36, 60, 24].forEach((h, n) => {
    const d = document.createElement('span'), i = document.createElement('i');
    d.className = 'demo-soejle';
    i.style.height = h + 'px';
    i.style.background = `var(--data-${n + 1})`;
    d.append(i, mono('data-' + (n + 1)));
    $('demo-data').appendChild(d);
  });
  for (let n = 1; n <= 5; n++) {
    const d = document.createElement('span'), i = document.createElement('i');
    d.className = 'demo-trin';
    i.style.background = `var(--seq-${n})`;
    d.append(i, mono('seq-' + n));
    $('demo-seq').appendChild(d);
  }
  {
    const NS = window.Kit.ikon('sol').namespaceURI;
    const el = (navn, attr, stil) => { const e = document.createElementNS(NS, navn); for (const k of Object.keys(attr)) e.setAttribute(k, attr[k]); e.setAttribute('style', stil); return e; };
    const svg = el('svg', { viewBox: '0 0 320 140', role: 'img', 'aria-hidden': 'true' }, '');
    svg.append(
      el('rect', { x: 0, y: 0, width: 320, height: 140 }, 'fill: var(--map-sea)'),
      el('path', { d: 'M20 40 L90 22 L130 48 L112 96 L48 108 Z' }, 'fill: var(--map-land); stroke: var(--map-border)'),
      el('path', { d: 'M170 30 L250 24 L296 62 L270 112 L196 104 Z' }, 'fill: var(--seq-3); stroke: var(--map-border)'),
      el('path', { d: 'M196 104 L270 112 L250 132 L204 128 Z' }, 'fill: var(--seq-5); stroke: var(--map-border)'),
      el('path', { d: 'M76 66 Q150 -10 232 66' }, 'fill: none; stroke: var(--map-arc); stroke-width: 2'),
      el('circle', { cx: 232, cy: 66, r: 9 }, 'fill: none; stroke: var(--map-ring); stroke-width: 2'),
      el('circle', { cx: 232, cy: 66, r: 3 }, 'fill: var(--map-ring)'),
    );
    $('demo-kort').appendChild(svg);
    for (const k of ['map-sea', 'map-land', 'map-border', 'map-ring', 'map-arc']) {
      const d = document.createElement('span'), i = document.createElement('i');
      d.className = 'demo-trin';
      i.style.background = `var(--${k})`;
      d.append(i, mono(k));
      $('demo-kortfarver').appendChild(d);
    }
  }

  /* ── 2.4.0: hover på mærker (K19), svage flader (K21) og en bue, der er et angreb (K20). Farverne står i demoens
     <style> med tokens og color-mix; her bygges kun elementerne. ── */
  for (const m of ['ok', 'warn', 'danger', 'info', 'none']) {
    const d = document.createElement('span'), i = document.createElement('i');
    i.className = m;
    d.append(i, mono(m + '-mark-hover'));
    $('demo-hover').appendChild(d);
    const f = tekstEl240('span', 'svagTekst');
    f.className = m;
    $('demo-svag').appendChild(f);
  }
  {
    const NS = window.Kit.ikon('sol').namespaceURI;
    const el = (navn, attr, stil) => { const e = document.createElementNS(NS, navn); for (const k of Object.keys(attr)) e.setAttribute(k, attr[k]); if (stil) e.setAttribute('style', stil); return e; };
    const svg = el('svg', { viewBox: '0 0 320 140', role: 'img', 'aria-hidden': 'true' });
    svg.append(
      el('rect', { x: 0, y: 0, width: 320, height: 140 }, 'fill: var(--map-sea)'),
      el('path', { d: 'M20 40 L90 22 L130 48 L112 96 L48 108 Z' }, 'fill: var(--map-land); stroke: var(--map-border)'),
      el('path', { d: 'M170 30 L250 24 L296 62 L270 112 L196 104 Z' }, 'fill: var(--map-land); stroke: var(--map-border)'),
      el('path', { d: 'M60 90 Q150 20 232 66', 'data-bue': 'angreb' }, 'fill: none; stroke: var(--danger-mark); stroke-width: 2'),
      el('path', { d: 'M76 50 Q160 0 270 44', 'data-bue': 'neutral' }, 'fill: none; stroke: var(--map-arc); stroke-width: 2'),
      el('circle', { cx: 232, cy: 66, r: 12, 'data-ring': 'svag' }, 'fill: color-mix(in srgb, var(--map-ring) 18%, transparent); stroke: var(--map-ring); stroke-width: 2'),
      el('circle', { cx: 232, cy: 66, r: 3 }, 'fill: var(--map-ring)'),
    );
    const forkl = document.createElement('div');
    forkl.className = 'demo-forklaring';
    const a = tekstEl240('span', 'kortAngreb'), b = tekstEl240('span', 'kortBue');
    a.className = 'angreb';
    b.className = 'bue';
    forkl.append(a, b);
    $('demo-kort240').append(svg, forkl);
  }

  /* ── 2.5.0: skallen, kontrollerne, fliserne og dialogen (K22–K26, K28, K31–K35, G1–G11) ── */
  const tEl = (tag, t, v, kl) => { const e = document.createElement(tag); if (kl) e.className = kl; if (t) e.setAttribute('data-t', t); if (v != null) e.setAttribute('data-v', String(v)); return e; };
  {
    // K22 og K23: titellinjen.
    const titel = $('demo-titel250');
    const mrk = document.createElement('span');
    mrk.className = 'mrk-maske demo-maske';
    mrk.setAttribute('aria-hidden', 'true');
    const rk = (ikonNavn, ariaT) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'rk'; b.setAttribute('data-t-aria', ariaT); b.appendChild(K.ikon(ikonNavn, 'ik')); return b; };
    const frem = rk('hoejre', 'ariaFrem');
    frem.disabled = true;
    const indst = rk('tandhjul', 'ariaIndst');
    indst.setAttribute('aria-current', 'page');
    indst.addEventListener('click', () => meld('titel250-valgt', 'ariaIndst'));
    const hj = rk('bog', 'ariaHjaelp');
    hj.setAttribute('aria-expanded', 'true');
    hj.addEventListener('click', () => {
      const aaben = hj.getAttribute('aria-expanded') !== 'true';
      hj.setAttribute('aria-expanded', String(aaben));
      meld('titel250-valgt', aaben ? 'hjaelpAaben' : 'hjaelpLukket');
    });
    const hoejre = document.createElement('span');
    hoejre.className = 'hoejre';
    hoejre.append(frem, indst, hj);
    titel.append(mrk, tEl('b', 'appNavn'), hoejre);
  }
  {
    // G11: hvorfor i et værktøjstip.
    const bt = K.commandBar($('demo-baand-tip'), { ariaT: 'cmdAria', udenFaner: true, hvorforTip: true, faner: [{ id: 'start', t: 'faneStart', grupper: [
      { t: 'gEksempel', knapper: [{ id: 'aabn', t: 'kAabn', ikon: 'fil', pri: true }, { id: 'kopier', t: 'kKopier', ikon: 'kopier', deaktiveret: true, hvorfor: 'hvorforIntetValgt' }] },
    ] }] });
    let fra = true;
    $('demo-baand-tip-knapper').appendChild(K.knap({ t: 'kSlaaTil', ved: () => { fra = !fra; bt.saetDeaktiveret('kopier', fra, 'hvorforIntetValgt'); S.anvend(bt.rod); } }));
  }
  {
    // K26 og K24: træet, der bygges om, og visningsskiftet med tal og et punkt slået fra.
    let flere = false;
    const navne = () => (flere ? ['eksempel.dk', 'shop.eksempel.dk', 'blog.eksempel.dk', 'api.eksempel.dk'] : ['eksempel.dk', 'shop.eksempel.dk']);
    const punkter = () => [{ id: 'samlet', t: 'tSamlet', antal: navne().length, boern: navne().map(n => ({ id: n, tekst: n })) }];
    const trae250 = K.navTrae($('demo-trae250'), punkter(), { ariaT: 'traeAria', valgt: 'samlet', kunBrugerValg: true, vedValg: id => meld('nav250-valgt', null, id) });
    const skift250 = K.visningsskift($('demo-skift250'), [
      { id: 'oversigt', t: 'vOversigt', ikon: 'skaerm' },
      { id: 'siden', t: 'vSiden', ikon: 'kalender', antal: 3, kraever: true, antalAriaT: 'kraeverHandling' },
      { id: 'angreb', t: 'vAngreb', ikon: 'skjold', antal: 12, deaktiveret: true, hvorfor: 'hvorforToken' },
    ], { ariaT: 'visninger' });
    skift250.markér('oversigt');
    $('demo-skift250').addEventListener('click', e => {
      const a = e.target.closest('.vs');
      if (!a) return;
      e.preventDefault();
      if (a.getAttribute('aria-disabled') === 'true') return;
      skift250.markér(a.dataset.visning);
      meld('nav250-valgt', { oversigt: 'vOversigt', siden: 'vSiden', angreb: 'vAngreb' }[a.dataset.visning]);
    });
    let angrebFra = true;
    $('demo-nav250-knapper').append(
      K.knap({ t: 'kByggOm', ved: () => { flere = !flere; trae250.saetPunkter(punkter()); S.anvend($('demo-trae250')); } }),
      K.knap({ t: 'kSlaaAngreb', ved: () => { angrebFra = !angrebFra; skift250.saetPunkt('angreb', { deaktiveret: angrebFra }); S.anvend($('demo-skift250')); } }),
    );
  }
  {
    // K25: status med fremdrift i fodlinjen.
    const koe = K.fodstatus({ status: 'henter', t: 'koeHenter', fremdrift: { maks: 8, vaerdi: 3 }, handling: { t: 'aabnOverblik', ved: () => meld('fod250-valgt', 'aabnOverblik') } });
    const venstre = tEl('span', 'fodVenstre', 16);
    venstre.setAttribute('data-w', '13');
    $('demo-fod250').append(koe.rod, venstre);
    let trin = 3;
    const aabn = { t: 'aabnOverblik', ved: () => meld('fod250-valgt', 'aabnOverblik') };
    const saet = n => { koe.saet(n); S.anvend(koe.rod); };
    $('demo-fod250-knapper').append(
      K.knap({ t: 'kEtTrin', ved: () => { trin = trin >= 8 ? 1 : trin + 1; saet({ status: 'henter', t: 'koeHenter', fremdrift: { maks: 8, vaerdi: trin }, handling: aabn }); } }),
      K.knap({ t: 'kUbestemt', ved: () => saet({ status: 'henter', t: 'koeHenter', fremdrift: 'ubestemt', handling: aabn }) }),
      K.knap({ t: 'kFaerdig', ved: () => saet({ status: 'ok', t: 'koeFaerdig', fremdrift: null, handling: null }) }),
      K.knap({ t: 'kFejl', ved: () => saet({ status: 'danger', t: 'koeFejl', fremdrift: null, handling: aabn }) }),
    );
  }
  {
    // K33 og K35: valgt flise, flise med to mål og flise med frit indhold.
    const dato = (t, v) => { const d = document.createElement('span'); const b = document.createElement('button'); b.type = 'button'; b.className = 'demo-tal'; b.textContent = v; b.addEventListener('click', () => meld('fliser250-valgt', null, v)); d.append(tEl('span', t), document.createTextNode(' '), b); return d; };
    const datoer = document.createElement('div');
    datoer.append(dato('foerst', '2026-10-02'), dato('sidst', '2026-11-11'));
    let liste = null;
    const vis = (i, t) => {
      for (const [j, m] of [...liste.querySelectorAll('.sflise-maal, button.sflise')].entries()) {
        if (j === i) m.setAttribute('aria-current', 'true');
        else m.removeAttribute('aria-current');
      }
      meld('fliser250-valgt', t);
    };
    liste = K.statusfliser({ ariaT: 'fliser250Aria', fliser: [
      { t: 'flIGaar', tal: 12, status: { variant: 'warn', t: 'stHoldOeje' }, valgt: true, ved: () => vis(0, 'flIGaar'), under: { t: 'iDagHidtil', ved: () => meld('fliser250-valgt', 'iDagHidtil') } },
      { t: 'flIDag', tal: 3, status: { variant: 'ok', t: 'stRoligt' }, ved: () => vis(1, 'flIDag') },
      { t: 'flSet', indhold: datoer },
    ] });
    $('demo-fliser250').appendChild(liste);
  }
  // K32: ikon i kassens overskrift.
  $('demo-kasser250').appendChild(K.kasse({ t: 'kasseLaas', ikon: 'laas', niveau: 3, indhold: tEl('p', 'kasseLaasTekst') }).rod);
  // G8: en tom flade, der tager imod, og to handlinger.
  $('demo-tom250').appendChild(K.tomTilstand({
    ikon: 'indsaet', t: 'tomModtagerH', p: { t: 'tomModtagerP' }, niveau: 3,
    handling: { t: 'kAabn', ikon: 'fil', ved: () => meld('tom250-valgt', 'kAabn') },
    anden: { t: 'kAabnSager', variant: 'ghost', ved: () => meld('tom250-valgt', 'kAabnSager') },
    modtager: { ariaT: 'ariaModtager', ariaV: '⌘V', vedIndsaet: tekst => meldV('tom250-valgt', 'modtaget', tekst.length) },
  }));
  {
    // G1, G2, G3, G5, G6 og G4: dialoger, der kan fejle, indhold over overskriften, guiden og et spørgsmål med tre svar.
    const svar250 = s => meldV('dialog250-valgt', 'svaret', s);
    const efter = (forsoeg, fejlT) => () => new Promise((ok, nej) => setTimeout(() => (++forsoeg.n % 2 ? nej({ t: fejlT }) : ok(true)), 400));
    const nyF = { n: 0 }, sletF = { n: 0 };
    const nyFelt = K.felt({ etiket: { t: 'dlgNavn' }, vaerdi: 'Supportsag 0043', foelsom: true });
    const nySag = K.dialog({
      id: 'demo-dlg-ny', t: 'dlgNySagH', p: { t: 'dlgNySagP' }, indhold: nyFelt, fejl: true, udfyld: e => S.anvend(e),
      knapper: [{ id: 'annuller', t: 'annuller' }, { id: 'opret', knapId: 'demo-dlg-ny-opret', t: 'opretSag', variant: 'primary', ved: efter(nyF, 'dlgNySagFejl') }],
      vedLuk: svar250,
    });
    const om = K.dialog({ t: 'dlgOmH', p: { t: 'dlgOmP' }, foer: K.fletbaand(), knapper: [{ id: 'luk', t: 'kLuk' }], vedLuk: svar250 });
    const tre = K.dialog({ t: 'dlgTreH', p: { t: 'dlgTreP' }, fokus: 'gem', knapper: [{ id: 'annuller', t: 'annuller' }, { id: 'kasser', t: 'kKasser', variant: 'danger' }, { id: 'gem', t: 'kGemSomSag', variant: 'primary' }], vedLuk: svar250 });
    const guideRod250 = document.createElement('div');
    const guideDlg = K.dialog({ guide: true, ariaLabelledby: 'demo-guide250-h', indhold: guideRod250, vedLuk: svar250 });
    const guide250 = K.guide(guideRod250, {
      hId: 'demo-guide250-h',
      trin: [{ t: 'wT1', h: 'wH1', p: 'wP1' }, { t: 'wT2', h: 'wH2', p: 'wP2' }, { t: 'wT3', h: 'wH3', p: 'wP3' }],
      naeste: { t: 'naeste' }, tilbage: { t: 'tilbage' }, slut: { t: 'faerdig' }, spring: { t: 'springOver' },
      vedSkift: () => S.anvend(guideRod250), vedSlut: () => guideDlg.luk('slut'), vedSpring: () => guideDlg.luk('spring'),
    });
    const aabn = d => () => { S.anvend(d.rod); d.aabn(); };
    $('demo-dialog250').append(
      K.knap({ t: 'dlgNySag', ved: aabn(nySag) }),
      K.knap({ t: 'dlgSletVent', variant: 'danger', ikon: 'slet', ved: () => K.bekraeft({ t: 'dlgSletH', p: { t: 'dlgSletVentP' }, nej: { t: 'annuller' }, ja: { t: 'slet' }, farlig: true, udfyld: rod => S.anvend(rod), ved: efter(sletF, 'dlgSletFejl') }).then(ja => svar250(String(ja))) }),
      K.knap({ t: 'dlgOm', ved: aabn(om) }),
      K.knap({ t: 'dlgGuide', ved: () => { guide250.gaaTil(0); aabn(guideDlg)(); } }),
      K.knap({ t: 'dlgTre', ved: aabn(tre) }),
    );
  }
  {
    // K28: segmentknap uden valg.
    const P = { 7: 'p7', 30: 'p30' };
    const seg = K.segment({ ariaT: 'periodeAria', valgt: null, valg: [{ id: '7', t: 'p7' }, { id: '30', t: 'p30' }], vedValg: id => meld('segment250-valgt', P[id]) });
    $('demo-segment250').append(seg.rod, K.knap({ t: 'pEget', variant: 'ghost', ved: () => { seg.vaelg(null); meld('segment250-valgt', 'pEget'); } }));
  }
  {
    // K34: aktive filtre, der kan fjernes.
    const ramme = document.createElement('div');
    ramme.className = 'fchips';
    ramme.setAttribute('role', 'group');
    ramme.setAttribute('data-t-aria', 'aktiveFiltre');
    const byg = () => {
      ramme.textContent = '';
      for (const [id, t] of [['land', 'fltLand'], ['domaene', null], ['dato', 'fltDato']]) {
        const tekst = t ? S.t(t) : 'shop.eksempel.dk';
        const c = K.filterchip({ id, tekst, ariaT: 'fjernFilter', ariaV: tekst, vedFjern: () => { c.remove(); meldV('fjern250-valgt', 'fjernet', tekst); } });
        ramme.appendChild(c);
      }
      S.anvend(ramme);
    };
    byg();
    document.addEventListener('kit-demo-sprog', byg);
    $('demo-fjern250').append(ramme, K.knap({ t: 'kNulstil', variant: 'ghost', ved: byg }));
  }
  {
    // G7: afkrydsning i en tabelrække.
    const VAERDIER = ['192.0.2.17', '192.0.2.44', 'srv-app01.eksempel.dk'];
    const tabel250 = K.tabel({ ariaT: 'afk250Aria', raekkeHandling: 'ingen', kolonner: [{ t: 'kolMaskeres', bredde: 's' }, { t: 'kolVaerdi250' }],
      raekker: VAERDIER.map((v, i) => ({ celler: [K.afkrydsning({ ariaT: 'ariaMaskerV', ariaV: v, valgt: i !== 1 }).rod, v], mono: [1] })) });
    $('demo-afk250').appendChild(tabel250);
  }
  {
    // K31: navn uden for komponenten, i rækker med etiketten til venstre.
    const raekke = (id, t, kontrol) => { const d = document.createElement('div'); d.className = 'demo-r'; const e = tEl('span', t); e.id = id; d.append(e, kontrol); return d; };
    const TEMA = { lys: 'kLys', moerk: 'kMoerk', system: 'kSystem' };
    $('demo-raekker250').append(
      raekke('demo-r-tema', 'rTema', K.radiogruppe({ ariaLabelledby: 'demo-r-tema', vandret: true, hjaelp: { t: 'rTemaNote' }, valgt: 'system', valg: [{ id: 'lys', t: 'kLys' }, { id: 'moerk', t: 'kMoerk' }, { id: 'system', t: 'kSystem' }], vedValg: id => meld('raekker250-valgt', TEMA[id]) }).rod),
      raekke('demo-r-sprog', 'rSprog', K.valgliste({ ariaLabelledby: 'demo-r-sprog', valgt: 'da', valg: [{ id: 'da', t: 'kDansk' }, { id: 'en', t: 'kEngelsk' }], vedValg: id => meld('raekker250-valgt', id === 'da' ? 'kDansk' : 'kEngelsk') }).rod),
      raekke('demo-r-auto', 'rAutostart', K.kontakt({ ariaLabelledby: 'demo-r-auto', til: true, ord: { til: { t: 'til' }, fra: { t: 'fra' } }, vedSkift: til => meld('raekker250-valgt', til ? 'til' : 'fra') }).rod),
    );
  }
  {
    // G10: trinnet som tal.
    const vis = () => {
      let v = '';
      try { v = getComputedStyle(document.documentElement).getPropertyValue('--tekst-zoom').trim(); } catch (e) { v = ''; }
      meldV('tekstzoom250', 'tekstZoom', v || '–');
    };
    document.addEventListener('kit-demo-tekst', vis);
    vis();
  }

  /* ── 2.6.0: visningerne som faner øverst, båndet under følger fanen, NavPane uden visningsskift ── */
  {
    const FIRE = [
      { id: 'oversigt', t: 'vOversigt', ikon: 'skaerm', knapper: [{ id: 'aabn', t: 'kAabn', ikon: 'fil', pri: true }, { id: 'gem', t: 'kGem', ikon: 'gem' }] },
      { id: 'siden', t: 'vSiden', ikon: 'kalender', antal: 3, kraever: true, antalAriaT: 'kraeverHandling', knapper: [{ id: 'kopier', t: 'kKopier', ikon: 'kopier', pri: true }] },
      { id: 'angreb', t: 'vAngreb', ikon: 'skjold', antal: 12, knapper: [{ id: 'udskriv', t: 'kUdskriv', ikon: 'eksport', pri: true }, { id: 'slet', t: 'kSlet', ikon: 'slet' }] },
      { id: 'login', t: 'vLogin', ikon: 'laas', deaktiveret: true, hvorfor: 'hvorforLogin', knapper: [{ id: 'aabn', t: 'kAabn', ikon: 'fil', pri: true }] },
    ];
    const baande = {};
    for (const v of FIRE) {
      const b = document.createElement('div');
      b.dataset.visning = v.id;
      $('demo-baand260').appendChild(b);
      K.commandBar(b, { ariaT: 'cmdAria', udenFaner: true, faner: [{ id: 'start', grupper: [{ t: 'gEksempel', knapper: v.knapper.map(k => ({ ...k, ved: () => meld('faner260-valgt', k.t) })) }] }] });
      baande[v.id] = b;
    }
    K.navTrae($('demo-trae260'), [{ id: 'alle', t: 'tAlle', antal: 16, boern: [{ id: 'tjek', t: 'tTjek', antal: 2 }] }], { ariaT: 'traeAria', valgt: 'alle' });
    const faner = K.visningsskift($('demo-faner260'), FIRE.map((v, i) => ({ ...v, genvej: 'Alt+' + (i + 1), genvejAria: 'Alt+' + (i + 1) })), { ariaT: 'visninger', faner: true });
    const vaelg = id => {
      faner.markér(id);
      for (const [vid, b] of Object.entries(baande)) b.hidden = vid !== id;
      meld('faner260-valgt', FIRE.find(v => v.id === id).t);
    };
    // Demoen skifter selv (ingen adresse): et klik og piletasterne (der klikker) går hertil; en fane slået fra gør intet.
    $('demo-faner260').addEventListener('click', e => {
      const a = e.target.closest('.vf');
      if (!a) return;
      e.preventDefault();
      if (a.getAttribute('aria-disabled') !== 'true') vaelg(a.dataset.visning);
    });
    document.addEventListener('keydown', e => {
      const n = /^Digit([1-4])$/.exec(e.code || '');
      if (!n || !e.altKey || e.ctrlKey || e.metaKey) return;
      const v = FIRE[Number(n[1]) - 1];
      e.preventDefault();
      if (!v.deaktiveret) vaelg(v.id);
    });
    faner.markér('oversigt');
    for (const [vid, b] of Object.entries(baande)) b.hidden = vid !== 'oversigt';
    const OTTE = [['overblik', 'vOverblik', 'mappe'], ['siden', 'vSiden', 'kalender'], ['angreb', 'vAngreb', 'skjold'], ['robotter', 'vRobotter', 'filter'],
      ['login', 'vLogin', 'laas'], ['land', 'vLand', 'sprog'], ['besoeg', 'vBesoeg', 'oeje'], ['tek', 'vTek', 'tandhjul']];
    const otte = K.visningsskift($('demo-faner260-otte'), OTTE.map(([id, t, ikon]) => ({ id, t, ikon })), { ariaT: 'visninger', faner: true });
    otte.markér('overblik');
    $('demo-faner260-otte').addEventListener('click', e => {
      const a = e.target.closest('.vf');
      if (!a) return;
      e.preventDefault();
      otte.markér(a.dataset.visning);
      meld('faner260-otte-valgt', OTTE.find(([id]) => id === a.dataset.visning)[1]);
    });
  }

  /* ── 2.7.0: ét bånd med visningerne som store knapper, aria-current på en kommando, Mere, otte visninger ── */
  {
    const FIRE = [
      { id: 'oversigt', t: 'vOversigt', ikon: 'skaerm', knapper: [{ id: 'aabn', t: 'kAabn', ikon: 'fil', pri: true }, { id: 'gem', t: 'kGem', ikon: 'gem' }] },
      { id: 'siden', t: 'vSiden', ikon: 'kalender', antal: 3, kraever: true, antalAriaT: 'kraeverHandling', knapper: [{ id: 'kopier', t: 'kKopier', ikon: 'kopier', pri: true }] },
      { id: 'angreb', t: 'vAngreb', ikon: 'skjold', antal: 12, knapper: [{ id: 'udskriv', t: 'kUdskriv', ikon: 'eksport', pri: true }, { id: 'slet', t: 'kSlet', ikon: 'slet' }] },
      { id: 'login', t: 'vLogin', ikon: 'laas', deaktiveret: true, hvorfor: 'hvorforLogin', knapper: [{ id: 'aabn', t: 'kAabn', ikon: 'fil', pri: true }] },
    ];
    const punkter = FIRE.map((v, i) => ({ ...v, genvej: 'Alt+' + (i + 1), genvejAria: 'Alt+' + (i + 1) }));
    const baande = {};
    let indstAaben = false;
    for (const v of FIRE) {
      const b = document.createElement('div');
      b.dataset.visning = v.id;
      $('demo-baand270').appendChild(b);
      baande[v.id] = K.commandBar(b, { ariaT: 'cmdAria', udenFaner: true, hvorforTip: true, visninger: { t: 'visninger', punkter }, mere: { t: 'kMere' }, faner: [{ id: 'start', grupper: [
        { t: 'gEksempel', knapper: v.knapper.map(k => ({ ...k, ved: () => meld('baand270-valgt', k.t) })) },
        { t: 'gProgram', knapper: [{ id: 'indst', t: 'kIndst', ikon: 'tandhjul', ved: () => { indstAaben = !indstAaben; vaelg(aaben); } }] },
      ] }] });
    }
    K.navTrae($('demo-trae270'), [{ id: 'alle', t: 'tAlle', antal: 16, boern: [{ id: 'tjek', t: 'tTjek', antal: 2 }] }], { ariaT: 'traeAria', valgt: 'alle' });
    let aaben = 'oversigt';
    function vaelg(id) {
      aaben = id;
      for (const [vid, bar] of Object.entries(baande)) {
        bar.rod.hidden = vid !== id;
        bar.visninger.markér(indstAaben ? null : id);
        bar.saetAktuel('indst', indstAaben);
      }
      meld('baand270-valgt', indstAaben ? 'kVisIndst' : FIRE.find(v => v.id === id).t);
    }
    // Demoen skifter selv (ingen adresse): et klik og mellemrum (kittet klikker) går hertil; en visning slået fra gør intet.
    $('demo-baand270').addEventListener('click', e => {
      const a = e.target.closest('.vk');
      if (!a) return;
      e.preventDefault();
      if (a.getAttribute('aria-disabled') === 'true') return;
      indstAaben = false;
      vaelg(a.dataset.visning);
    });
    document.addEventListener('keydown', e => {
      const n = /^Digit([1-4])$/.exec(e.code || '');
      if (!n || !e.altKey || e.ctrlKey || e.metaKey) return;
      const v = FIRE[Number(n[1]) - 1];
      if (v.deaktiveret) return;
      indstAaben = false;
      vaelg(v.id);
    });
    vaelg('oversigt');
    // Mere i et smalt bånd (600 px): de fire visninger og ni kommandoer; det, der ikke er plads til, står i Mere.
    const smal = K.commandBar($('demo-baand270-mere'), { ariaT: 'cmdAria', udenFaner: true, hvorforTip: true, visninger: { t: 'visninger', punkter }, mere: { t: 'kMere' }, faner: [{ id: 'start', grupper: [
      { t: 'gEksempel', knapper: [{ id: 'aabn', t: 'kAabn', ikon: 'fil' }, { id: 'gem', t: 'kGem', ikon: 'gem', pri: true }, { id: 'kopier', t: 'kKopier', ikon: 'kopier', deaktiveret: true, hvorfor: 'hvorforIntetValgt' }] },
      { t: 'gData', knapper: [{ id: 'opdater', t: 'kOpdater', ikon: 'afspil' }, { id: 'eksport', t: 'kEksport', ikon: 'eksport' }, { id: 'udskriv', t: 'kUdskriv', ikon: 'eksport' }] },
      { t: 'gProgram', knapper: [{ id: 'slet', t: 'kSlet', ikon: 'slet' }, { id: 'indst', t: 'kIndst', ikon: 'tandhjul' }] },
    ] }] });
    smal.visninger.markér('oversigt');
    for (const id of ['aabn', 'gem', 'kopier', 'opdater', 'eksport', 'udskriv', 'slet', 'indst']) smal.knap(id).addEventListener('click', () => meld('baand270-mere-valgt', smal.knap(id).querySelector('span').getAttribute('data-t')));
    $('demo-baand270-mere').addEventListener('click', e => { if (e.target.closest('.vk')) { e.preventDefault(); const a = e.target.closest('.vk'); if (a.getAttribute('aria-disabled') !== 'true') smal.visninger.markér(a.dataset.visning); } });
    // Otte visninger i båndet, som Huginn and Muninn (Hent nu, Vejledning, Indstillinger).
    const OTTE = [['overblik', 'vOverblik', 'mappe'], ['siden', 'vSiden', 'kalender'], ['angreb', 'vAngreb', 'skjold'], ['robotter', 'vRobotter', 'filter'],
      ['login', 'vLogin', 'laas'], ['land', 'vLand', 'sprog'], ['besoeg', 'vBesoeg', 'oeje'], ['tek', 'vTek', 'tandhjul']];
    const otte = K.commandBar($('demo-baand270-otte'), { ariaT: 'cmdAria', udenFaner: true, visninger: { t: 'visninger', punkter: OTTE.map(([id, t, ikon], i) => ({ id, t, ikon, genvej: '⌘' + (i + 1), genvejAria: 'Meta+' + (i + 1) })) }, mere: { t: 'kMere' }, faner: [{ id: 'start', grupper: [
      { t: 'gData', knapper: [{ id: 'hent', t: 'kHent', ikon: 'afspil', pri: true }] },
      { t: 'gHjaelp', knapper: [{ id: 'vejledning', t: 'kVejledning', ikon: 'bog' }] },
      { t: 'gProgram', knapper: [{ id: 'indst', t: 'kIndst', ikon: 'tandhjul' }] },
    ] }] });
    otte.visninger.markér('overblik');
    otte.visninger.saetPunkt('siden', { antal: 4, kraever: true, antalAriaT: 'kraeverHandling' });
    $('demo-baand270-otte').addEventListener('click', e => {
      const a = e.target.closest('.vk');
      if (!a) return;
      e.preventDefault();
      otte.visninger.markér(a.dataset.visning);
      meld('baand270-otte-valgt', OTTE.find(([id]) => id === a.dataset.visning)[1]);
    });
  }

  /* ── Start: udfyld teksterne, vis den rigtige visning ── */
  S.anvend(document);
  opdaterVis();
  filtrer();
  visning();
})();
