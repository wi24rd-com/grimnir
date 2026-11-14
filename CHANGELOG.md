# Changelog

Posterne står efter udgave, nyeste først.

## [Ikke udgivet]

## [1.0.0] — 2026-11-14

Første offentlige udgave til macOS: signeret med Developer ID og notariseret af Apple.

### Maskér
- Indsat tekst (op til 5 MB) og åbne filer (op til 100 MB; UTF-8 med eller uden BOM og UTF-16 med BOM) analyseres med det samme, og fundene står som rækker med type, værdi, kode og status (Sikker, Fra ordbog, Sandsynlig, Tjek selv, Version).
- Kernen finder IPv4- og IPv6-adresser (eget net og offentlige), MAC-adresser, maskinnavne, domæner, NetBIOS-domæner, brugere, personer, databaser, hemmeligheder, SID, GUID, serienumre, CPR-numre, lange tilfældige strenge og værdier, der ligner en kode, og deler sammensatte værdier (e-mail, `DOMÆNE\bruger`, URL, UNC-sti) i deres dele. Offentlige adresser maskeres kun med et tilvalg.
- En række kan slås fra eller få en anden erstatning, og en tilføjet værdi kan skifte type. **Maskér markering** og **Maskér som hemmelighed** tilføjer en markeret værdi, også i en åben fil; rækken gælder hele filen. **Fortryd** og **Gentag** virker på valgene.
- **Kopiér maskeret tekst**, **Gem maskeret fil** og **Kopiér kvittering** (tallene fra maskeringen, uden værdier og filnavn). Den oprindelige fil ændres aldrig.
- En fil vises med de første 200.000 tegn; analysen og maskeringen gælder hele filen. Rækkerne kommer 500 ad gangen, og en række efter de første 500 vælges og rulles frem, når den findes ("allerede et fund").

### Demaskér
- Sætter de rigtige værdier tilbage i et svar eller en fil og viser ukendte og ubrugte koder som advarsler (**Næste advarsel**).
- **Kopiér resultat** og **Gem som fil**; Gem som fil spørger først, fordi filen har de rigtige værdier i klartekst.

### Sager
- Hver sag er én krypteret fil (XChaCha20-Poly1305) med en nøgle i macOS' nøglering. En maskering uden navngiven sag hører til den midlertidige sag, der gemmes under et navn med dato og klokkeslæt, når Grimnir låser eller afslutter.
- Sager kan åbnes, omdøbes, få et udløb og slettes. **Vis indhold** viser type, kode og rigtig værdi pr. post med **Kopiér værdi** og **Slet**; en slettet kode gives aldrig igen.
- **Noter** til den åbne sag: højst 4.000 tegn pr. note og 200 noter pr. sag; de gemmes krypteret i sagens fil. **Kopiér noterne** tager sagens navn og tidspunkterne med.

### Hemmeligheder
- En hemmelighed står som prikker i tabellerne, til du vælger **Vis**; først da sendes værdien til vinduet. En skjult hemmelighed søges ikke på værdien.
- **Kopiér værdi** for en hemmelighed skrives til udklipsholderen af Rust-kernen; værdien går ikke gennem vinduet.

### Ordbog
- Egne poster: Domæne, NetBIOS-domæne, Navnemønster, Eget net, Ord, Person og Maskér aldrig. **Prøv på tekst** uden at gemme teksten.
- En guide med tre trin ved første start, når ordbogen er tom; den kan vises igen fra Indstillinger.

### Lås og udklipsholder
- Grimnir starter altid låst og låses op med Touch ID eller adgangskoden. Den låser igen ved dvale, når skærmen slukker, ved brugerskift og efter 5, 15, 30 eller 60 minutter uden aktivitet.
- **Kopiér resultat**, **Kopiér noterne** og **Kopiér værdi** skriver Grimnir selv til udklipsholderen med mærket `org.nspasteboard.ConcealedType` (nspasteboard.org), så programmer, der husker udklipsholderens historik, kan springe det over. Står det der stadig, når Grimnir låser eller afslutter, fjernes det. Maskeret tekst og andre programmers indhold røres ikke.

### Udseende og betjening
- Fem faner: Maskér, Demaskér, Noter, Sager og Ordbog (⌘1–⌘5). Genveje til Åbn fil, Gem, Maskér/Demaskér, Kopiér, Maskér markering, Fortryd og Gentag.
- Lyst, mørkt eller systemets tema; dansk eller engelsk; tekststørrelsen Lille, Normal eller Stor (⌘+ ⌘− ⌘0). Farver og skrifter fra Wi24rd UI Kit.
- **Om Grimnir** med version, licens og tredjepartslicenser.

### Privatliv
- Ingen netværkskode og ingen telemetri; testene tjekker kernens og skallens afhængigheder og kildekode for netværk.
