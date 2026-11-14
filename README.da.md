# Wi24rd Grimnir

*Mask. Share. Restore.*

![Wi24rd Grimnir](docs/banner.jpg)

### [⬇ Hent Grimnir 1.0.0 til macOS](https://github.com/wi24rd-com/grimnir/releases/latest)
Signeret og notariseret af Apple · Apple silicon · macOS 11 eller nyere · åbn zip-filen, og træk programmet til Programmer

Sensitive data masking tool for logs and scripts. Wi24rd Grimnir er et skrivebordsprogram (Tauri), der erstatter følsomme værdier i en log eller et script, fx IP-adresser, maskinnavne, brugere og adgangskoder, med neutrale koder, før du deler teksten med en leverandørs support eller en chatbot. Når svaret kommer tilbage, sætter Wi24rd Grimnir de rigtige værdier ind igen i stedet for koderne.

**Privatliv:** programmet har ingen netværkskode og sender intet. Ingen telemetri, ingen konto og ingen Wi24rd-server: alt sker på din egen maskine. Koderne og de rigtige værdier gemmes kun i krypterede sagsfiler på maskinen. Knappen **Vejledning** beder kun styresystemet åbne en side i din browser.

**Status:** version 1.0.0 til macOS (Apple silicon), signeret med Developer ID og notariseret af Apple. Hent den under [Releases](https://github.com/wi24rd-com/grimnir/releases/latest). Windows-udgaven er ikke bygget.

## Programmet
- **Ét vindue** med fem faner i denne rækkefølge: **Maskér**, **Demaskér**, **Noter**, **Sager** og **Ordbog**. Hver fane har et bånd med sine kommandoer; en kommando, der ikke kan bruges endnu, er nedtonet og siger hvorfor.
- **Maskér:** sæt en tekst ind (⌘V) eller åbn en fil (⌘O, eller slip den på vinduet). Grimnir analyserer den med det samme og viser fundene som rækker: type, værdien, koden, den får, og status. Fjern fluebenet for at bevare en værdi, ret en erstatning, eller markér en tekst og vælg **Maskér markering** (⇧⌘M) for at tilføje en værdi, Grimnir ikke fandt. **Maskér** (⌘↵) erstatter værdierne. Derefter **Kopiér maskeret tekst** (⇧⌘C), **Gem maskeret fil** (⌘S) eller **Kopiér kvittering** (tallene fra maskeringen, uden værdier og uden filnavn). **Fortryd** og **Gentag** (⌘Z, ⇧⌘Z) virker på dine valg.
- **Demaskér:** sæt svaret ind eller åbn en fil, og **Demaskér** (⌘↵) sætter de rigtige værdier tilbage. Koder, Grimnir ikke kender, og koder, der ikke blev brugt, står som advarsler; **Næste advarsel** er ⌘G. **Kopiér resultat** (⇧⌘C) kopierer den demaskerede tekst. **Gem som fil** spørger først, fordi filen har de rigtige værdier i klartekst.
- **Noter:** dine egne noter til den åbne sag (også den midlertidige), med dato og klokkeslæt. Højst 4.000 tegn pr. note og 200 noter pr. sag. ⌘↵ gemmer en note. **Kopiér noterne** kopierer dem med sagens navn og tidspunkterne. Grimnir gennemsøger ikke noterne for værdier.
- **Sager:** listen over gemte sager med status og udløb. Åbn en sag, omdøb den, sæt et udløb, slet den, eller vis dens indhold: type, kode og rigtig værdi pr. post, med **Kopiér værdi** og **Slet** i rækkens **…**-menu.
- **Ordbog:** dine egne ord, som Grimnir altid skal finde eller aldrig maskere: Domæne, NetBIOS-domæne, Navnemønster, Eget net, Ord, Person og Maskér aldrig. **Prøv på tekst** viser, hvad ordbogen finder i en tekst, uden at gemme den. En kort guide (Velkommen, Dine domæner, Dine net og maskiner) åbner ved første start, når ordbogen er tom.
- **Filer:** op til 100 MB. UTF-8 med eller uden BOM og UTF-16 med BOM. Vinduet viser de første 200.000 tegn; analysen og maskeringen gælder hele filen. Kopiér virker op til 5 MB; et større resultat gemmes som fil. Den oprindelige fil ændres aldrig.
- **Indstillinger** (⌘,) har tema, sprog, tekststørrelse, standarderne for nye sager, låsen og **Vis guiden igen**. **Om Grimnir** viser versionen, licensen og tredjepartslicenserne.

## Hvad Grimnir finder
IPv4- og IPv6-adresser (eget net og offentlige; offentlige adresser maskeres kun, hvis du vælger det i Indstillinger), MAC-adresser, maskinnavne, domæner, NetBIOS-domæner, brugere, personer, databaser, ord fra din ordbog, hemmeligheder (adgangskoder, nøgler, tokens, JWT, private nøgler), SID, GUID, serienumre, CPR-numre, lange tilfældige strenge og værdier, der ligner en kode. Sammensatte værdier deles i deres dele, fx en e-mailadresse, `DOMÆNE\bruger`, en URL eller en UNC-sti. Hver række har en status: Sikker, Fra ordbog, Sandsynlig, Tjek selv eller Version.

## Hemmeligheder
- En hemmelighed vises som prikker i tabellerne. **Vis** viser den, **Skjul** skjuler den igen; en skjult hemmelighed søges ikke på værdien. Værdien sendes først til vinduet, når du vælger **Vis**.
- **Maskér som hemmelighed** (i båndet og i genvejsmenuen) maskerer en markeret værdi som hemmelighed.
- **Kopiér værdi** for en hemmelighed i en sags indhold skrives til udklipsholderen af Grimnirs Rust-kerne, så værdien aldrig går gennem vinduet.

## Sager og låsen
- En maskering hører altid til en sag. Uden en navngiven sag er det den **midlertidige sag**; når Grimnir låser eller afslutter, gemmes en midlertidig sag med poster som en navngiven sag med dato og klokkeslæt som navn.
- Hver sag er én krypteret fil (XChaCha20-Poly1305). Nøglen er 32 tilfældige bytes i macOS' nøglering. Noterne gemmes i sagens fil. En sag kan have et udløb; standarden for en ny sag er intet, 30 eller 90 dage (**Indstillinger**). En udløbet sag slettes ikke af sig selv.
- Grimnir starter altid låst. Du låser op med **Touch ID eller din adgangskode**. Den låser igen, når Mac'en går i dvale, når skærmen slukker, når du skifter bruger, og efter 5, 15, 30 eller 60 minutter uden aktivitet (**Lås efter stilstand**). Låsen kan ikke slås fra.
- Det, Grimnir kopierer fra en sag eller en demaskering (**Kopiér resultat**, **Kopiér noterne**, **Kopiér værdi**), skriver Grimnir selv til udklipsholderen med mærket for fortroligt indhold, `org.nspasteboard.ConcealedType` (nspasteboard.org), så programmer, der husker udklipsholderens historik og følger den konvention, kan springe det over. Står det stadig i udklipsholderen, når Grimnir låser eller afslutter, fjerner Grimnir det. Maskeret tekst og andre programmers indhold røres ikke.
- Låsen er for en person, der sætter sig ved din ulåste Mac og åbner Grimnir. Den beskytter ikke mod andre programmer på din Mac.

## Genveje
macOS: ⌘1 Maskér · ⌘2 Demaskér · ⌘3 Noter · ⌘4 Sager · ⌘5 Ordbog · ⌘O Åbn fil · ⌘S Gem · ⌘↵ Analysér og maskér (Maskér), Demaskér (Demaskér) eller gem noten (Noter) · ⇧⌘C Kopiér resultatet · ⇧⌘M Maskér markering · ⌘Z Fortryd · ⇧⌘Z Gentag · ⌘G Næste advarsel · ⌘+ ⌘− ⌘0 Tekststørrelse · ⌘, Indstillinger · ⌘Q Afslut.

## Tekststørrelse og tema
- **Tekststørrelse:** Lille, Normal eller Stor under **Indstillinger**, eller ⌘+ ⌘− ⌘0 (også i menuen **Vis**). Valget huskes.
- **Tema:** Lys, Mørk eller System (standard) under **Indstillinger**. **Sprog:** dansk (standard) eller engelsk. Farverne og skrifterne kommer fra Wi24rd UI Kit, så Grimnir ligner de andre Wi24rd-programmer.

## Byg og test (udvikling)
```
npm install
npm run tauri dev                         # kør programmet
npm run tauri build -- --debug            # en debug-bundle (Grimnir.app)
cargo test -p grimnir-core                # kernen
cargo test -p grimnir                     # skallen (Rust)
cargo clippy --workspace --all-targets -- -D warnings
npm run test:ui                           # UI-røgtesten (jsdom, højst 1 GB hukommelse)
npm run test:kontrast                     # farvekontrast i lyst og mørkt tema
npm run test:kolonner                     # tabellernes kolonnebredder fra 1024 px
npm run test:kit                          # pakken Wi24rd UI Kit 2
npm run tjek                              # kittets kopier i ui/assets svarer til pakken
npm run test:signer                       # signeringsscriptet med stubbe (signerer intet)
sh tools/signer.sh proeve                 # macOS: debug-bygning signeret med din egen Developer ID, uden notarisering
```
Kræver Rust (rustup) og Node.js.

## Licens
Apache-2.0: se [LICENSE](LICENSE) og [NOTICE](NOTICE). Tredjepartskomponenter: [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md).

[English](README.md)
