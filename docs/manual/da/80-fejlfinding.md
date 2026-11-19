# Fejlfinding

Her står de fejltekster, Grimnir selv kan vise, ordret. […] står for det, der skifter: et navn, et tal eller en grund. Mange beskeder har en grund efter et kolon; grundene står i deres egen tabel.

## Indsæt og maskér

| Fejltekst i programmet | Det kan du gøre |
|---|---|
| Udklipsholderen har ingen tekst. | Kopiér teksten igen, og sæt den ind. |
| Teksten er […]. Grimnir tager højst 5 MB ad gangen her; brug Åbn fil til større filer (op til 100 MB). | Gem teksten som fil, og åbn den med **Åbn fil**. |
| […] rettelser kan ikke bruges, så intet er gemt. Se rækkerne med rødt. | Ret eller fortryd rettelserne i de røde rækker, og tryk **Maskér** igen. |
| […] findes allerede i sagen eller i teksten. | Vælg en anden erstatning. |
| […] skal begynde og slutte med et bogstav eller et tal. | Skriv en erstatning, der begynder og slutter med et bogstav eller et tal. |
| Værdien har flere stavemåder; koden kan ikke rettes her endnu. | Behold Grimnirs kode for den værdi. |
| Rækken findes ikke længere. Analysér igen. | Tryk **Analysér igen**. |
| Grimnir kunne ikke gøre det. Prøv igen. | Prøv igen. Sker det igen, så afslut og start Grimnir. |
| Grimnir kunne ikke kopiere resultatet. | Prøv igen, eller gem resultatet som fil. |
| Grimnir kunne ikke kopiere kvitteringen. | Prøv igen. |
| Resultatet er over 5 MB og kan ikke kopieres. Gem det som fil. | Brug **Gem maskeret fil** eller **Gem som fil**. |
| Lækagetjekket fandt […] rester, som står i klartekst i filen. Se dem først, eller gem alligevel. | Tryk **Vis dem**, og maskér de værdier, der stadig står. Gem kun alligevel, hvis du er sikker. |
| Sagen er skiftet siden maskeringen. Maskér filen igen, før du gemmer den. | Tryk **Maskér** igen, og gem så. |

## Maskér markering

| Fejltekst i programmet | Det kan du gøre |
|---|---|
| Markeringen er tom eller kun mellemrum. | Markér selve værdien. |
| Markeringen går over flere linjer. Markér en værdi på én linje. | Markér en værdi på én linje. |
| Markeringen begynder eller slutter midt i et tegn. Markér hele tegn. | Markér hele tegn. |
| Markeringen går ud over den viste tekst. Kun de første 200.000 tegn kan markeres; rækken gælder hele filen. | Markér i de første 200.000 tegn, eller læg værdien i ordbogen. |
| […] er allerede en kode i sagen og kan ikke maskeres igen. | Intet at gøre: værdien er allerede en kode. |
| […] er en kode i sagen og kan ikke maskeres igen. | Intet at gøre: værdien er allerede en kode. |
| […] står på Maskér aldrig i ordbogen, og det vinder over alt. Fjern den dér først. | Fjern værdien fra **Maskér aldrig** under **Ordbog**, hvis den skal maskeres. |
| […] kan ikke tilføjes med den type. | Vælg en anden type. |
| Den markerede værdi er allerede fundet som en hemmelighed og maskeres; rækken er valgt. | Intet at gøre: hemmeligheden maskeres allerede. |

## Demaskér

| Fejltekst i programmet | Det kan du gøre |
|---|---|
| Sagen er tom: maskér først en tekst i denne session. | Maskér en tekst først, eller åbn den sag, svaret hører til. |
| Sagen er tom: åbn den sag, svaret hører til, under Sager. | Åbn sagen under **Sager** med **Åbn i Maskér**. |
| Teksten er […]. Demaskér tager højst 8 MB ad gangen her; brug Åbn fil til større filer. | Gem svaret som fil, og åbn det med **Åbn fil**. |

## Filer

Kan en fil ikke åbnes eller gemmes, står der **Filen kunne ikke åbnes eller gemmes: […].**, og grunden står efter kolon:

| Fejltekst i programmet | Det kan du gøre |
|---|---|
| filen er […], og grænsen er […] | Del filen i mindre filer (højst 100 MB). |
| filen er tom | Vælg en fil med indhold. |
| det er en mappe | Vælg en fil i mappen. |
| det er ikke en almindelig fil | Vælg en almindelig tekstfil. |
| kun én fil ad gangen | Åbn én fil ad gangen. |
| filen er ikke UTF-8 og har ingen BOM; den ligner Latin-1 eller Windows-1252 (første ukendte byte står på position […]) | Gem filen som UTF-8 i din editor, og åbn den igen. |
| filen er UTF-8 med en ugyldig byte ved position […] | Gem filen som UTF-8 igen i din editor. |
| filen ligner UTF-16 uden BOM; gem den med BOM eller som UTF-8 | Gem filen med BOM eller som UTF-8. |
| filen er UTF-32; gem den som UTF-8 eller UTF-16 | Gem filen som UTF-8 eller UTF-16. |
| filen ligner en binær fil (nul-byte ved position […]) | Grimnir læser kun tekst. Vælg en tekstfil. |
| filen er UTF-16 med en ugyldig enhed ved byte […] | Gem filen igen som UTF-8 eller UTF-16 med BOM. |
| Grimnir skriver aldrig til den fil, teksten kom fra; vælg et andet navn | Vælg et andet filnavn. |
| disken kunne ikke bruges ([…]) | Tjek, at der er plads på disken, og at du må skrive i mappen. |

| Fejltekst i programmet | Det kan du gøre |
|---|---|
| Træk én fil ad gangen ind. Flere filer, mapper og zip kommer i en senere version. | Træk én fil ind ad gangen. |
| En mappe kan ikke åbnes. Træk én fil ind; mapper og zip kommer i en senere version. | Træk én fil ind. |

## Sager

Kan en sag ikke åbnes, gemmes eller ændres, står der fx **Det lykkedes ikke: […].**, **Sagen kunne ikke gemmes, så intet er maskeret: […].** eller **Sagen kan ikke åbnes: […]**, og grunden står efter kolon:

| Fejltekst i programmet | Det kan du gøre |
|---|---|
| filen er fra en nyere udgave af Grimnir (format […]) | Brug en nyere udgave af Grimnir til den sag. |
| filen er beskadiget eller ændret | Filen kan ikke læses. Har du en sikkerhedskopi af datamappen, kan du lægge filen tilbage derfra. |
| nøglen mangler i nøgleringen | Uden nøglen kan sagen ikke åbnes. Er den slettet fra nøgleringen, kan sagen kun slettes. |
| filen findes ikke længere | Sagen er flyttet eller slettet uden for Grimnir. |
| sagen er ændret et andet sted; åbn den igen | Åbn sagen igen (**Åbn igen** i banneret). |
| nøgleringen kunne ikke bruges | Tjek, at din nøglering er låst op, og prøv igen. |
| disken kunne ikke bruges ([…]) | Tjek, at der er plads på disken. |
| navnet skal være 1–120 tegn uden linjeskift | Skriv et navn på 1–120 tegn på én linje. |
| datoen er ikke gyldig | Vælg en anden dato. |
| ukendt sag | Sagen findes ikke længere. Vælg en anden. |
| styresystemet gav ingen tilfældige tal | Prøv igen. Sker det igen, så genstart Mac'en. |
| Grimnir har ingen mappe til sager | Tjek, at din brugermappe kan skrives i. |
| filen gemmes lige nu et andet sted; prøv igen | Vent et øjeblik, og prøv igen. |
| ukendt fejl | Prøv igen. |

| Fejltekst i programmet | Det kan du gøre |
|---|---|
| Sagen er ændret et andet sted. Åbn den igen. | Tryk **Åbn igen**. |
| Skriv et navn. | Skriv et navn. |
| Vælg en dato, eller sæt flueben ved Ingen udløb. | Vælg en dato, eller sæt flueben ved **Ingen udløb**. |
| Sagens indhold kan ikke vises: […] | Se grunden efter kolon ovenfor. |
| Sagens indhold er ændret og er hentet igen. Prøv igen. | Prøv igen. |
| Erstatningen er ikke slettet: […] | Se grunden efter kolon, og prøv igen. |
| Værdien kunne ikke kopieres. | Prøv igen. |

## Ordbog

| Fejltekst i programmet | Det kan du gøre |
|---|---|
| Skriv en værdi. | Skriv en værdi. |
| Teksten er for lang. | Gør værdien kortere (højst 253 tegn; en note højst 200). |
| Skriv mindst to tegn. | Skriv mindst to tegn. |
| Teksten må ikke have linjeskift eller tabulatorer. | Fjern linjeskift og tabulatorer. |
| Et domæne har mindst ét punktum og kun bogstaver, cifre og - mellem punktummerne, fx kontor.test. | Ret domænet, eller vælg en anden type. |
| Et NetBIOS-navn har højst 15 tegn: bogstaver, cifre, - og _, og intet punktum. | Ret navnet, eller vælg typen **Domæne**. |
| Et navnemønster må kun have bogstaver, cifre, -, # og *, og mindst ét bogstav. | Ret mønstret. |
| Skriv et net som adresse/præfiks, fx 10.20.0.0/16, eller én adresse. | Skriv nettet som adresse/præfiks. |
| Nettet er for bredt; brug /8 eller smallere. | Brug et smallere net. |
| Værdien står allerede i ordbogen. | Intet at gøre: værdien er der allerede. |
| Værdien står allerede på den anden liste; den kan ikke både maskeres altid og aldrig. | Fjern værdien fra den anden liste først. |
| Det ligner en hemmelighed, og hemmeligheder kan ikke lægges i ordbogen. | Lad hemmeligheder blive i sagen; maskér dem i **Maskér**. |
| Posten findes ikke længere. | Posten er allerede væk. |
| Vælg en type. | Vælg en type. |
| Sæt en tekst ind først. | Sæt en tekst ind i feltet. |
| Ordbogen blev ikke ændret: […] | Se grunden efter kolon. |
| Ordbogen er ændret et andet sted. Den er læst igen; prøv igen. | Prøv igen. |
| ordbogen kunne ikke gemmes ([…]) | Tjek, at der er plads på disken, og at nøgleringen kan bruges. |
| Ordbogen kunne ikke åbnes: […]. Grimnir bruger en tom ordbog og ændrer ikke filen. | Se grunden efter kolon. Kan filen ikke reddes, kan du starte forfra med en tom ordbog (se nedenfor). |
| ordbogen kunne ikke åbnes ved start ([…]), så den ændres ikke | Ordbogen kan ikke ændres, før den kan åbnes. |
| Mønsteret kunne ikke lægges i ordbogen: […] | Se grunden efter kolon. |

## Noter

| Fejltekst i programmet | Det kan du gøre |
|---|---|
| Skriv noget i noten først. | Skriv noget i noten. |
| Noten er for lang: højst […] tegn. | Gør noten kortere, eller del den i to. |
| Sagen har allerede […] noter, så mange den kan have. Slet en note først. | Slet en note, du ikke har brug for. |
| Noten findes ikke længere i sagen. | Noten er allerede væk. |
| Noterne kan ikke vises: […] | Se grunden efter kolon. |

## Låsen

| Fejltekst i programmet | Det kan du gøre |
|---|---|
| Grimnir er stadig låst. Tryk Lås op for at prøve igen. | Tryk **Lås op**. |
| Det lykkedes ikke at bekræfte, at det er dig. Grimnir er stadig låst. | Tryk **Lås op**, og prøv igen. |
| Styresystemet kunne ikke bekræfte, hvem du er (fejl […]). Grimnir er stadig låst. | Prøv igen. Sker det igen, så genstart Mac'en. |
| Grimnir kunne ikke spørge om oplåsning. Grimnir er stadig låst. | Afslut, og start Grimnir igen. |
| Denne maskine kan ikke bekræfte, hvem du er. Grimnir er ikke låst. | Giv din brugerkonto en adgangskode, så kan Grimnir låse. |
| Den midlertidige sag kunne ikke gemmes, da Grimnir låste, og er lukket: […]. | Se grunden efter kolon. Sagens værdier er væk; maskér teksten igen, hvis du skal bruge koderne. |
| Den åbne sag kunne ikke gemmes, da Grimnir låste: […]. | Se grunden efter kolon. Åbn sagen, og maskér igen, hvis noget mangler. |

## Andet

| Fejltekst i programmet | Det kan du gøre |
|---|---|
| Indstillingen blev ikke gemt: […]. | Se grunden efter kolon, og vælg igen. |
| Vejledningen kunne ikke åbnes i browseren. | Åbn vejledningen i din browser selv. |
| Tredjepartslicenserne kunne ikke vises. | Licenserne står også i filen THIRD_PARTY_LICENSES.md i kildekoden. |

## Ordbogsfilen kan ikke åbnes

Kan ordbogsfilen ikke åbnes, bruger Grimnir en tom ordbog og ændrer ikke filen. Under **Ordbog** kan du vælge **Start forfra**. Grimnir spørger først (**Start forfra med en tom ordbog?**), omdøber den gamle fil i samme mappe (den slettes ikke) og begynder med en tom ordbog.

## Når det ikke er en fejltekst

- **En kommando er nedtonet:** hold musen over den. Værktøjstippet siger hvorfor, fx **Indsæt en tekst først**.
- **Grimnir fandt ikke en værdi:** markér den, og vælg **Maskér markering**, eller læg den i ordbogen. Se [Maskér](40-visninger/masker.md).
- **Et svar kan ikke demaskeres:** tjek, at den sag, svaret hører til, er åben. Se [Demaskér](40-visninger/demasker.md).
