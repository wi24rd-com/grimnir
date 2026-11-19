# Data

Everything Grimnir saves is on your own Mac. Nothing is sent anywhere.

## Where your data is

Grimnir's data folder is `~/Library/Application Support/com.wi24rd.grimnir/`.

| What | Where | How |
|---|---|---|
| Your cases (the codes, the real values and the notes) | `sager/` in the data folder, one file per case with the extension `.grimnir` | Encrypted (XChaCha20-Poly1305). The file name is the case id; the name is only stored encrypted in the file. |
| Your dictionary | `ordbog.grimnir` in the data folder | Encrypted. |
| The settings for new cases, the lock and the guide | `indstillinger.json` in the data folder | Plain text with nothing sensitive in it. |
| The name of a temporary case that was saved on lock or quit | `gemt-ved-afslut.json` in the data folder | Deleted when the banner has been shown after unlocking. |
| The keys | The macOS keychain, service `com.wi24rd.grimnir`: the account `ordbog` and one account `sag:<id>` per case | 32 random bytes per case. |
| Theme, language and text size | The program's web view | Not sensitive. |

The text you paste and the files you open are not saved by Grimnir. A case holds the codes and the real values, not the log itself.

## How long

- A case stays until you delete it. An expiry marks the case in the list as **Expiring soon** (within 7 days) or **Expired**; an expired case is not deleted automatically, and its codes can still be unmasked.
- You choose the default expiry for new cases under **Settings** (**No expiry**, **30 days** or **90 days**).
- The temporary case exists only in memory until Grimnir locks or quits. Then it is saved as a named case if it has values, unless you discard it.

## Delete a case

Select the case under **Cases**, and press **Delete case**. Grimnir deletes the case file and its key in the keychain. Replies with the case's codes can then no longer be unmasked. See [Cases](40-visninger/sager.md).

## Delete an entry in a case

Open the case in Mask, show its contents, and choose **Delete** in the row's **…** menu. The code is never given again, and a masked text with that code can no longer be unmasked. This cannot be undone.

## Remove an entry from the dictionary

Select the entry under **Dictionary**, and press **Remove entry**. See [Dictionary](40-visninger/ordbog.md).

## Files you save yourself

A file you save with **Save masked file** or **Save as file** is where you chose. Grimnir does not remember where it is and does not delete it. A file from **Unmask** has the real values in clear text; delete it when you are done.

## Export and import

**Export** and **Import** under **Cases** and **Dictionary** are coming in a later version of Grimnir.
