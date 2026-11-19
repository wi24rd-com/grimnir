# Afinstallation

Grimnir lægger ingen start ved login, ingen baggrundstjeneste og intet ikon i menulinjen. Der er tre ting at fjerne: programmet, datamappen og posterne i nøgleringen.

## Før du begynder

Vil du kunne demaskere svar senere, så afinstallér ikke endnu: uden sagerne og deres nøgler kan svar med koderne ikke demaskeres.

Det letteste er at slette sagerne i Grimnir først: vælg hver sag under **Sager**, og tryk **Slet sag**. Så sletter Grimnir både sagens fil og dens nøgle i nøgleringen.

## Sådan gør du

1. **Afslut Grimnir** (⌘Q).
2. **Programmet:** træk `Grimnir.app` fra Programmer til papirkurven.
3. **Datamappen:** slet mappen `~/Library/Application Support/com.wi24rd.grimnir/`. Mappen har sagerne (`sager/`), ordbogen (`ordbog.grimnir`) og `indstillinger.json`.
4. **Nøglerne:** posterne ligger i macOS' nøglering under tjenesten `com.wi24rd.grimnir`: kontoen `ordbog` og en konto `sag:<id>` for hver sag, du ikke har slettet i Grimnir. Slet dem i programmet Keychain Access (søg efter `com.wi24rd.grimnir`), eller kør i Terminal:

   ```
   security delete-generic-password -s com.wi24rd.grimnir
   ```

   Kommandoen sletter én post ad gangen. Kør den igen, til den melder en fejl, fordi der ikke er flere.

## Det, macOS selv lægger

På en Mac, hvor Grimnir har kørt, kan der også ligge mapper og en fil med programmets id i navnet, som macOS og programmets webvisning selv laver. Grimnir lægger ikke sine sager eller sin ordbog der:

- `~/Library/WebKit/com.wi24rd.grimnir/`
- `~/Library/Caches/com.wi24rd.grimnir/`
- `~/Library/Preferences/com.wi24rd.grimnir.plist`

Vil du fjerne alt, så slet dem også.

## Filer, du selv har gemt

Filer, du har gemt med **Gem maskeret fil** eller **Gem som fil**, ligger, hvor du lagde dem. Grimnir ved ikke, hvor de er. En fil fra **Demaskér** har de rigtige værdier i klartekst; slet den, hvis du ikke skal bruge den.
