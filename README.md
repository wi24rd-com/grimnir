# Wi24rd Grimnir

*Mask. Share. Restore.*

![Wi24rd Grimnir](docs/banner.jpg)

### [⬇ Download Grimnir 1.0.0 for macOS](https://github.com/wi24rd-com/grimnir/releases/latest)
Signed and notarised by Apple · Apple silicon · macOS 11 or newer · open the zip and drag the app to Applications

Sensitive data masking tool for logs and scripts. Wi24rd Grimnir is a desktop app (Tauri) that replaces sensitive values in a log or script, such as IP addresses, machine names, users and passwords, with neutral codes before you share the text with vendor support or a chatbot. When the answer comes back, Wi24rd Grimnir puts the real values back in place of the codes.

**Privacy:** the app has no network code and sends nothing. No telemetry, no account and no Wi24rd server: everything happens on your own machine. The codes and the real values are stored only in encrypted case files on your machine. The **Guide** button only asks the operating system to open a web page in your browser.

**Status:** version 1.0.0 for macOS (Apple silicon), signed with Developer ID and notarised by Apple. Download it from [Releases](https://github.com/wi24rd-com/grimnir/releases/latest). The Windows version has not been built.

## The app
- **One window** with five tabs in this order: **Mask**, **Unmask**, **Notes**, **Cases** and **Dictionary**. Each tab has a band with its commands; a command that cannot be used yet is dimmed and says why.
- **Mask:** paste a text (⌘V) or open a file (⌘O, or drop it on the window). Grimnir analyses it at once and lists what it found as rows: type, the value, the code it will get and the status. Untick a row to keep the value, edit a replacement, or select text and choose **Mask selection** (⇧⌘M) to add a value Grimnir did not find. **Mask** (⌘↵) replaces the values. Then **Copy masked text** (⇧⌘C), **Save masked file** (⌘S) or **Copy receipt** (the figures from the masking, with no values and no file name). **Undo** and **Redo** (⌘Z, ⇧⌘Z) work on your choices.
- **Unmask:** paste the answer or open a file, and **Unmask** (⌘↵) puts the real values back. Codes Grimnir does not know, and codes that were not used, are listed as warnings; **Next warning** is ⌘G. **Copy result** (⇧⌘C) copies the unmasked text. **Save as file** asks first, because the file holds the real values in clear text.
- **Notes:** your own notes for the open case (also the temporary case), with date and time. At most 4,000 characters per note and 200 notes per case. ⌘↵ saves a note. **Copy the notes** copies them with the case name and the times. Grimnir does not search the notes for values.
- **Cases:** the list of saved cases with status and expiry. Open a case, rename it, set an expiry, delete it, or show its contents: type, code and real value per entry, with **Copy value** and **Delete** in each row's **…** menu.
- **Dictionary:** your own words that Grimnir should always find or never mask: Domain, NetBIOS domain, Name pattern, Own network, Word, Person and Never mask. **Try on text** shows what the dictionary finds in a text without saving it. A short guide (Welcome, Your domains, Your networks and machines) opens at the first start when the dictionary is empty.
- **Files:** up to 100 MB. UTF-8 with or without BOM, and UTF-16 with BOM. The window shows the first 200,000 characters; the analysis and the masking cover the whole file. Copy works up to 5 MB; larger results are saved as a file. The original file is never changed.
- **Settings** (⌘,) has theme, language, text size, the defaults for new cases, the lock and **Show the guide again**. **About Grimnir** shows the version, the licence and the third-party licences.

## What Grimnir finds
IPv4 and IPv6 addresses (own network and public; public addresses are only masked if you choose so in Settings), MAC addresses, machine names, domains, NetBIOS domains, users, persons, databases, words from your dictionary, secrets (passwords, keys, tokens, JWTs, private keys), SIDs, GUIDs, serial numbers, CPR numbers, long random strings and values that look like a code. Combined values are split into their parts, for example an e-mail address, `DOMAIN\user`, a URL or a UNC path. Each row has a status: Certain, From dictionary, Probable, Check yourself or Version.

## Secrets
- A secret is shown as dots in the tables. **Show** reveals it, **Hide** hides it again; a hidden secret is not searched by its value. The value is sent to the window only when you choose **Show**.
- **Mask as secret** (in the band and in the context menu) masks a selected value as a secret.
- **Copy value** for a secret in a case's contents is written to the clipboard by Grimnir's Rust core, so the value never passes through the window.

## Cases and the lock
- A masking always belongs to a case. Without a named case it is the **temporary case**; when Grimnir locks or quits, a temporary case with entries is saved as a named case with the date and time as its name.
- Each case is one encrypted file (XChaCha20-Poly1305). Its key is 32 random bytes in the macOS keychain. The notes are saved in the case file. A case can have an expiry; the default for a new case is none, 30 or 90 days (**Settings**). An expired case is not deleted by itself.
- Grimnir always starts locked. You unlock with **Touch ID or your password**. It locks again when the Mac goes to sleep, when the display turns off, when you switch user, and after 5, 15, 30 or 60 minutes without activity (**Lock after inactivity**). The lock cannot be turned off.
- What Grimnir copies from a case or an unmasking (**Copy result**, **Copy the notes**, **Copy value**) is written to the clipboard by Grimnir itself with the confidential marker `org.nspasteboard.ConcealedType` (nspasteboard.org), so clipboard history apps that follow that convention can skip it. If it is still on the clipboard when Grimnir locks or quits, Grimnir removes it. Masked text and other apps' content are left alone.
- The lock is for someone who sits down at your unlocked Mac and opens Grimnir. It does not protect against other apps on your Mac.

## Shortcuts
macOS: ⌘1 Mask · ⌘2 Unmask · ⌘3 Notes · ⌘4 Cases · ⌘5 Dictionary · ⌘O Open file · ⌘S Save · ⌘↵ Analyse and mask (Mask), Unmask (Unmask) or save the note (Notes) · ⇧⌘C Copy the result · ⇧⌘M Mask selection · ⌘Z Undo · ⇧⌘Z Redo · ⌘G Next warning · ⌘+ ⌘− ⌘0 Text size · ⌘, Settings · ⌘Q Quit.

## Text size and theme
- **Text size:** Small, Normal or Large under **Settings**, or ⌘+ ⌘− ⌘0 (also in the **View** menu). The choice is remembered.
- **Theme:** Light, Dark or System (default) under **Settings**. **Language:** Danish (default) or English. The colours and fonts come from the Wi24rd UI Kit, so Grimnir looks like the other Wi24rd apps.

## Build and test (development)
```
npm install
npm run tauri dev                         # run the app
npm run tauri build -- --debug            # a debug bundle (Grimnir.app)
cargo test -p grimnir-core                # the core
cargo test -p grimnir                     # the shell (Rust)
cargo clippy --workspace --all-targets -- -D warnings
npm run test:ui                           # the UI smoke test (jsdom, at most 1 GB of memory)
npm run test:kontrast                     # colour contrast in light and dark
npm run test:kolonner                     # table column widths at 1024 px and up
npm run test:kit                          # the Wi24rd UI Kit 2 package
npm run tjek                              # the kit's copies in ui/assets match the package
npm run test:signer                       # the signing script with stubs (signs nothing)
sh tools/signer.sh proeve                 # macOS: a debug build signed with your own Developer ID, no notarisation
```
Requires Rust (rustup) and Node.js.

## Licence
Apache-2.0: see [LICENSE](LICENSE) and [NOTICE](NOTICE). Third-party components: [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md).

[Dansk](README.da.md)
