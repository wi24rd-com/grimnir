# Installation

> **Status:** version 1.0.0 findes til macOS på en Mac med Apple silicon. Windows-udgaven er ikke bygget.

## macOS

Kræver macOS 11 eller nyere og en Mac med Apple silicon.

1. Hent `Grimnir-1.0.0.zip` fra udgivelsen på GitHub (`github.com/wi24rd-com/grimnir`, under Releases).
2. Åbn zip-filen. Den pakker **Grimnir** ud.
3. Træk **Grimnir** til din Programmer-mappe (`/Applications`).
4. Åbn programmet.

Programmet er signeret med Developer ID og notariseret af Apple.

## Kontrollér det, du har hentet

Vil du selv se, at programmet er det ægte, så kør de fire kommandoer i Terminal, når programmet ligger i Programmer, og zip-filen ligger i Overførsler:

```
codesign --verify --deep --strict --verbose=2 /Applications/Grimnir.app
codesign -dv /Applications/Grimnir.app 2>&1 | grep TeamIdentifier      # TeamIdentifier=5DAVNFA355
spctl --assess --type execute --verbose /Applications/Grimnir.app      # accepted, source=Notarized Developer ID
shasum -a 256 ~/Downloads/Grimnir-1.0.0.zip
```

De første tre linjer kontrollerer Apples signatur og notarisering. Står der en SHA-256 i udgivelsens noter, skal den sidste linje give samme værdi.

## Hvad der sker, første gang du åbner programmet

1. Grimnir starter låst og beder om Touch ID eller din adgangskode. Se [Opsætning](30-opsaetning.md).
2. Når du har låst op, og din ordbog er tom, åbner en kort guide i tre trin: **Velkommen**, **Dine domæner** og **Dine net og maskiner**.
3. Dine sager, din ordbog og indstillingerne gemmes i Grimnirs datamappe. Se [Data](70-data.md).

Grimnir lægger ingen start ved login, intet ikon i menulinjen og ingen baggrundstjeneste på din Mac.

## Hvad der bliver lagt på din Mac

| Hvad | Hvor |
|---|---|
| Programmet | `/Applications/Grimnir.app` (hvis du lægger det der) |
| Datamappe med sager, ordbog og indstillinger | `~/Library/Application Support/com.wi24rd.grimnir/` |
| Nøgler til sager og ordbog | macOS' nøglering, tjenesten `com.wi24rd.grimnir` |

Hvordan du fjerner det hele igen, står i [Afinstallation](90-afinstallation.md).

## Windows

Der findes endnu ingen Windows-udgave.
