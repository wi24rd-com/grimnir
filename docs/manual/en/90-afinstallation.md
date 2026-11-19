# Uninstalling

Grimnir adds no login item, no background service and no menu bar icon. There are three things to remove: the program, the data folder and the entries in the keychain.

## Before you begin

If you want to be able to unmask replies later, do not uninstall yet: without the cases and their keys, replies with the codes cannot be unmasked.

The easiest is to delete the cases in Grimnir first: select each case under **Cases**, and press **Delete case**. Then Grimnir deletes both the case file and its key in the keychain.

## How to do it

1. **Quit Grimnir** (⌘Q).
2. **The program:** drag `Grimnir.app` from Applications to the Bin.
3. **The data folder:** delete the folder `~/Library/Application Support/com.wi24rd.grimnir/`. The folder holds the cases (`sager/`), the dictionary (`ordbog.grimnir`) and `indstillinger.json`.
4. **The keys:** the entries are in the macOS keychain under the service `com.wi24rd.grimnir`: the account `ordbog` and one account `sag:<id>` for each case you have not deleted in Grimnir. Delete them in the app Keychain Access (search for `com.wi24rd.grimnir`), or run in Terminal:

   ```
   security delete-generic-password -s com.wi24rd.grimnir
   ```

   The command deletes one entry at a time. Run it again until it reports an error because there are no more.

## What macOS adds itself

On a Mac where Grimnir has run, there may also be folders and a file with the program's id in the name, which macOS and the program's web view create themselves. Grimnir does not put its cases or its dictionary there:

- `~/Library/WebKit/com.wi24rd.grimnir/`
- `~/Library/Caches/com.wi24rd.grimnir/`
- `~/Library/Preferences/com.wi24rd.grimnir.plist`

If you want to remove everything, delete them too.

## Files you saved yourself

Files you saved with **Save masked file** or **Save as file** are where you put them. Grimnir does not know where they are. A file from **Unmask** has the real values in clear text; delete it if you do not need it.
