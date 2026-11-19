# Før du starter

## Krav

- En Mac med Apple silicon.
- macOS 11 eller nyere.
- Touch ID eller en adgangskode til din brugerkonto på Mac'en. Grimnir starter låst, og du låser op med en af dem.
- Vinduet er mindst 1024 × 560 punkter.

Der findes endnu ingen udgave til Windows.

## Hvad Grimnir gør

- **Finder følsomme værdier** i en tekst, du sætter ind, eller en fil, du åbner: IPv4- og IPv6-adresser, MAC-adresser, maskinnavne, domæner, NetBIOS-domæner, brugere, personer, databaser, ord fra din ordbog, hemmeligheder (adgangskoder, nøgler, tokens), SID, GUID, serienumre, CPR-numre, lange tilfældige strenge og værdier, der ligner en kode. Du ser hvert fund som en række, før noget bliver erstattet.
- **Maskerer**: erstatter de værdier, du har valgt, med koder. Samme værdi får samme kode.
- **Demaskerer**: sætter de rigtige værdier tilbage i et svar, der bruger koderne.
- **Husker koderne i en sag**, krypteret på din Mac, så et svar kan demaskeres senere. Selve loggen gemmes ikke.
- **Låser**, når du går fra Mac'en, og når du trykker **Lås**.

## Hvad Grimnir ikke gør

- **Grimnir kan overse en værdi.** Den finder værdier ud fra mønstre og din ordbog. Læs den maskerede tekst, før du deler den, og se på de rækker, der er mærket **Tjek selv**.
- **Låsen beskytter ikke mod andre programmer på din Mac.** Den er for en person, der sætter sig ved din ulåste Mac og åbner Grimnir. Se [Låsen](60-laasen.md).
- **En fil, du gemmer fra Demaskér, har de rigtige værdier i klartekst.** Grimnir spørger, før den gemmes. Gem den kun et sted, du stoler på, og slet den, når du er færdig.
- Grimnir sender ingen notifikationer, har intet ikon i menulinjen og starter ikke ved login.
- Grimnir opdaterer ikke sig selv og tjekker ikke for nye versioner.
- Grimnir ændrer aldrig den fil, du åbner. Den skriver kun en ny fil, når du vælger **Gem maskeret fil** eller **Gem som fil**.

## Privatliv

**Sendes:** intet. Grimnir har ingen netværkskode, ingen telemetri, ingen konto og ingen Wi24rd-server. Knappen **Vejledning** øverst i vinduet beder kun styresystemet åbne denne vejledning i din browser. Det er browserens forbindelse, ikke Grimnirs, og Grimnir sender intet med.

**Gemmes på din Mac:**

| Hvad | Hvordan |
|---|---|
| Dine sager: koderne, de rigtige værdier og dine noter | Én krypteret fil pr. sag. Nøglen ligger i macOS' nøglering. |
| Din ordbog | Én krypteret fil. Nøglen ligger i nøgleringen. |
| Indstillingerne for nye sager, låsen og guiden | En almindelig fil uden noget følsomt. |
| Tema, sprog og tekststørrelse | I programmets webvisning. |

Den tekst, du sætter ind, gemmes ikke. En sag har koderne og de rigtige værdier, ikke selve loggen. Hvor filerne ligger, står i [Data](70-data.md).

**Rettigheder:** Grimnir beder ikke om kamera, mikrofon, placering eller kontakter. Den bruger Touch ID eller din adgangskode til låsen, nøgleringen til nøglerne og systemets egne Åbn- og Gem-dialoger til filer. Den kører ikke i sandkasse.
