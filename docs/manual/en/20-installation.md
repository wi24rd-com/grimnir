# Installation

> **Status:** version 1.0.0 exists for macOS on a Mac with Apple silicon. The Windows version has not been built.

## macOS

Requires macOS 11 or newer and a Mac with Apple silicon.

1. Download `Grimnir-1.0.0.zip` from the release on GitHub (`github.com/wi24rd-com/grimnir`, under Releases).
2. Open the zip file. It unpacks **Grimnir**.
3. Drag **Grimnir** to your Applications folder (`/Applications`).
4. Open the program.

The program is signed with Developer ID and notarised by Apple.

## Check what you downloaded

If you want to see for yourself that the program is the genuine one, run the four commands in Terminal when the program is in Applications and the zip file is in Downloads:

```
codesign --verify --deep --strict --verbose=2 /Applications/Grimnir.app
codesign -dv /Applications/Grimnir.app 2>&1 | grep TeamIdentifier      # TeamIdentifier=5DAVNFA355
spctl --assess --type execute --verbose /Applications/Grimnir.app      # accepted, source=Notarized Developer ID
shasum -a 256 ~/Downloads/Grimnir-1.0.0.zip
```

The first three lines check Apple's signature and notarisation. If the release notes list a SHA-256, the last line must give the same value.

## What happens the first time you open the program

1. Grimnir starts locked and asks for Touch ID or your password. See [Setup](30-opsaetning.md).
2. When you have unlocked, and your dictionary is empty, a short guide in three steps opens: **Welcome**, **Your domains** and **Your networks and machines**.
3. Your cases, your dictionary and the settings are saved in Grimnir's data folder. See [Data](70-data.md).

Grimnir adds no login item, no menu bar icon and no background service to your Mac.

## What is put on your Mac

| What | Where |
|---|---|
| The program | `/Applications/Grimnir.app` (if you put it there) |
| Data folder with cases, dictionary and settings | `~/Library/Application Support/com.wi24rd.grimnir/` |
| Keys for cases and dictionary | The macOS keychain, service `com.wi24rd.grimnir` |

How to remove it all again is in [Uninstalling](90-afinstallation.md).

## Windows

There is no Windows version yet.
