# Data

Alt, Grimnir gemmer, ligger på din egen Mac. Intet sendes nogen steder hen.

## Hvor dine data ligger

Grimnirs datamappe er `~/Library/Application Support/com.wi24rd.grimnir/`.

| Hvad | Hvor | Hvordan |
|---|---|---|
| Dine sager (koderne, de rigtige værdier og noterne) | `sager/` i datamappen, én fil pr. sag med endelsen `.grimnir` | Krypteret (XChaCha20-Poly1305). Filnavnet er sagens id; navnet står kun krypteret i filen. |
| Din ordbog | `ordbog.grimnir` i datamappen | Krypteret. |
| Indstillingerne for nye sager, låsen og guiden | `indstillinger.json` i datamappen | Almindelig tekst uden noget følsomt. |
| Navnet på en midlertidig sag, der blev gemt ved lås eller afslutning | `gemt-ved-afslut.json` i datamappen | Slettes, når banneret er vist efter oplåsningen. |
| Nøglerne | macOS' nøglering, tjenesten `com.wi24rd.grimnir`: kontoen `ordbog` og en konto `sag:<id>` pr. sag | 32 tilfældige bytes pr. sag. |
| Tema, sprog og tekststørrelse | Programmets webvisning | Ikke følsomt. |

Den tekst, du sætter ind, og de filer, du åbner, gemmes ikke af Grimnir. En sag har koderne og de rigtige værdier, ikke selve loggen.

## Hvor længe

- En sag ligger, til du sletter den. Et udløb markerer sagen i listen som **Udløber snart** (inden for 7 dage) eller **Udløbet**; en udløbet sag slettes ikke af sig selv, og koderne kan stadig demaskeres.
- Standardudløbet for nye sager vælger du under **Indstillinger** (**Ingen udløb**, **30 dage** eller **90 dage**).
- Den midlertidige sag ligger kun i hukommelsen, til Grimnir låser eller afslutter. Så gemmes den som en navngiven sag, hvis den har værdier, medmindre du kasserer den.

## Slet en sag

Vælg sagen under **Sager**, og tryk **Slet sag**. Grimnir sletter sagens fil og dens nøgle i nøgleringen. Svar med sagens koder kan derefter ikke demaskeres. Se [Sager](40-visninger/sager.md).

## Slet en post i en sag

Åbn sagen i Maskér, vis dens indhold, og vælg **Slet** i rækkens **…**-menu. Koden gives aldrig igen, og en maskeret tekst med den kode kan ikke længere demaskeres. Det kan ikke fortrydes.

## Fjern en post fra ordbogen

Vælg posten under **Ordbog**, og tryk **Fjern post**. Se [Ordbog](40-visninger/ordbog.md).

## Filer, du selv gemmer

En fil, du gemmer med **Gem maskeret fil** eller **Gem som fil**, ligger dér, hvor du valgte. Grimnir husker ikke, hvor den ligger, og sletter den ikke. En fil fra **Demaskér** har de rigtige værdier i klartekst; slet den, når du er færdig.

## Eksport og import

**Eksportér** og **Importér** under **Sager** og **Ordbog** kommer i en senere version af Grimnir.
