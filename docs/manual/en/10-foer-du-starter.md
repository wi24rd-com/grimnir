# Before you start

## Requirements

- A Mac with Apple silicon.
- macOS 11 or newer.
- Touch ID or a password for your user account on the Mac. Grimnir starts locked, and you unlock with one of them.
- The window is at least 1024 × 560 points.

There is no Windows version yet.

## What Grimnir does

- **Finds sensitive values** in a text you paste or a file you open: IPv4 and IPv6 addresses, MAC addresses, machine names, domains, NetBIOS domains, users, people, databases, words from your dictionary, secrets (passwords, keys, tokens), SID, GUID, serial numbers, CPR numbers, long random strings and values that look like a code. You see each finding as a row before anything is replaced.
- **Masks**: replaces the values you chose with codes. The same value gets the same code.
- **Unmasks**: puts the real values back into a reply that uses the codes.
- **Remembers the codes in a case**, encrypted on your Mac, so a reply can be unmasked later. The log itself is not saved.
- **Locks** when you step away from the Mac, and when you press **Lock**.

## What Grimnir does not do

- **Grimnir can miss a value.** It finds values from patterns and your dictionary. Read the masked text before you share it, and look at the rows marked **Check yourself**.
- **The lock does not protect against other apps on your Mac.** It is for someone who sits down at your unlocked Mac and opens Grimnir. See [The lock](60-laasen.md).
- **A file you save from Unmask has the real values in clear text.** Grimnir asks before it is saved. Save it only somewhere you trust, and delete it when you are done.
- Grimnir sends no notifications, has no icon in the menu bar and does not start at login.
- Grimnir does not update itself and does not check for new versions.
- Grimnir never changes the file you open. It only writes a new file when you choose **Save masked file** or **Save as file**.

## Privacy

**Sent:** nothing. Grimnir has no network code, no telemetry, no account and no Wi24rd server. The **Guide** button at the top of the window only asks the operating system to open this guide in your browser. That is the browser's connection, not Grimnir's, and Grimnir sends nothing with it.

**Stored on your Mac:**

| What | How |
|---|---|
| Your cases: the codes, the real values and your notes | One encrypted file per case. The key is in the macOS keychain. |
| Your dictionary | One encrypted file. The key is in the keychain. |
| The settings for new cases, the lock and the guide | A plain file with nothing sensitive in it. |
| Theme, language and text size | In the program's web view. |

The text you paste is not saved. A case holds the codes and the real values, not the log itself. Where the files are is in [Data](70-data.md).

**Permissions:** Grimnir does not ask for camera, microphone, location or contacts. It uses Touch ID or your password for the lock, the keychain for the keys and the system's own Open and Save dialogs for files. It does not run in a sandbox.
