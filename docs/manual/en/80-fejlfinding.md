# Troubleshooting

These are the error texts Grimnir itself can show, word for word. […] stands for what changes: a name, a number or a reason. Many messages have a reason after a colon; the reasons have their own table.

## Paste and mask

| Error text in the program | What you can do |
|---|---|
| The clipboard holds no text. | Copy the text again, and paste it. |
| The text is […]. Grimnir takes at most 5 MB at a time here; use Open file for larger files (up to 100 MB). | Save the text as a file, and open it with **Open file**. |
| […] changes cannot be used, so nothing was saved. See the rows in red. | Fix or undo the changes in the red rows, and press **Mask** again. |
| […] already exists in the case or in the text. | Choose another replacement. |
| […] must start and end with a letter or a digit. | Enter a replacement that starts and ends with a letter or a digit. |
| The value has several spellings; the code cannot be changed here yet. | Keep Grimnir’s code for that value. |
| The row no longer exists. Analyse again. | Press **Analyse again**. |
| Grimnir could not do that. Try again. | Try again. If it happens again, quit and start Grimnir. |
| Grimnir could not copy the result. | Try again, or save the result as a file. |
| Grimnir could not copy the receipt. | Try again. |
| The result is over 5 MB and cannot be copied. Save it as a file. | Use **Save masked file** or **Save as file**. |
| The leak check found […] leftovers that are in clear text in the file. Look at them first, or save anyway. | Press **Show them**, and mask the values that are still there. Only save anyway if you are sure. |
| The case has changed since the masking. Mask the file again before you save it. | Press **Mask** again, and then save. |

## Mask selection

| Error text in the program | What you can do |
|---|---|
| The selection is empty or only spaces. | Select the value itself. |
| The selection spans several lines. Select a value on one line. | Select a value on one line. |
| The selection begins or ends in the middle of a character. Select whole characters. | Select whole characters. |
| The selection goes beyond the shown text. Only the first 200,000 characters can be selected; the row applies to the whole file. | Select within the first 200,000 characters, or add the value to the dictionary. |
| […] is already a code in the case and cannot be masked again. | Nothing to do: the value is already a code. |
| […] is a code in the case and cannot be masked again. | Nothing to do: the value is already a code. |
| […] is on Never mask in the dictionary, which wins over everything. Remove it there first. | Remove the value from **Never mask** under **Dictionary** if it should be masked. |
| […] cannot be added with that type. | Choose another type. |
| The selected value is already found as a secret and is masked; the row is selected. | Nothing to do: the secret is already masked. |

## Unmask

| Error text in the program | What you can do |
|---|---|
| The case is empty: mask a text in this session first. | Mask a text first, or open the case the reply belongs to. |
| The case is empty: open the case the reply belongs to under Cases. | Open the case under **Cases** with **Open in Mask**. |
| The text is […]. Unmask takes at most 8 MB at a time here; use Open file for larger files. | Save the reply as a file, and open it with **Open file**. |

## Files

When a file cannot be opened or saved, it says **The file could not be opened or saved: […].**, and the reason follows the colon:

| Error text in the program | What you can do |
|---|---|
| the file is […], and the limit is […] | Split the file into smaller files (at most 100 MB). |
| the file is empty | Choose a file with content. |
| it is a folder | Choose a file in the folder. |
| it is not a regular file | Choose a regular text file. |
| only one file at a time | Open one file at a time. |
| the file is not UTF-8 and has no BOM; it looks like Latin-1 or Windows-1252 (first unknown byte is at position […]) | Save the file as UTF-8 in your editor, and open it again. |
| the file is UTF-8 with an invalid byte at position […] | Save the file as UTF-8 again in your editor. |
| the file looks like UTF-16 without a BOM; save it with a BOM or as UTF-8 | Save the file with a BOM or as UTF-8. |
| the file is UTF-32; save it as UTF-8 or UTF-16 | Save the file as UTF-8 or UTF-16. |
| the file looks like a binary file (zero byte at position […]) | Grimnir only reads text. Choose a text file. |
| the file is UTF-16 with an invalid unit at byte […] | Save the file again as UTF-8 or UTF-16 with a BOM. |
| Grimnir never writes to the file the text came from; choose another name | Choose another file name. |
| the disk could not be used ([…]) | Check that there is space on the disk and that you may write to the folder. |

| Error text in the program | What you can do |
|---|---|
| Drag in one file at a time. Several files, folders and zip arrive in a later version. | Drag in one file at a time. |
| A folder cannot be opened. Drag in one file; folders and zip arrive in a later version. | Drag in one file. |

## Cases

When a case cannot be opened, saved or changed, it says e.g. **That did not work: […].**, **The case could not be saved, so nothing was masked: […].** or **The case cannot be opened: […]**, and the reason follows the colon:

| Error text in the program | What you can do |
|---|---|
| the file is from a newer version of Grimnir (format […]) | Use a newer version of Grimnir for that case. |
| the file is damaged or changed | The file cannot be read. If you have a backup of the data folder, you can restore the file from there. |
| the key is missing from the keychain | Without the key the case cannot be opened. If it was deleted from the keychain, the case can only be deleted. |
| the file no longer exists | The case was moved or deleted outside Grimnir. |
| the case was changed elsewhere; open it again | Open the case again (**Open again** in the banner). |
| the keychain could not be used | Check that your keychain is unlocked, and try again. |
| the disk could not be used ([…]) | Check that there is space on the disk. |
| the name must be 1–120 characters without line breaks | Enter a name of 1–120 characters on one line. |
| the date is not valid | Choose another date. |
| unknown case | The case no longer exists. Choose another. |
| the operating system gave no random numbers | Try again. If it happens again, restart your Mac. |
| Grimnir has no folder for cases | Check that your home folder is writable. |
| the file is being saved elsewhere right now; try again | Wait a moment, and try again. |
| unknown error | Try again. |

| Error text in the program | What you can do |
|---|---|
| The case was changed elsewhere. Open it again. | Press **Open again**. |
| Enter a name. | Enter a name. |
| Choose a date, or tick No expiry. | Choose a date, or tick **No expiry**. |
| The case contents cannot be shown: […] | See the reason after the colon above. |
| The case contents have changed and have been loaded again. Try again. | Try again. |
| The replacement is not deleted: […] | See the reason after the colon, and try again. |
| The value could not be copied. | Try again. |

## Dictionary

| Error text in the program | What you can do |
|---|---|
| Enter a value. | Enter a value. |
| The text is too long. | Shorten the value (at most 253 characters; a note at most 200). |
| Enter at least two characters. | Enter at least two characters. |
| The text must not contain line breaks or tabs. | Remove line breaks and tabs. |
| A domain has at least one dot and only letters, digits and - between the dots, e.g. kontor.test. | Fix the domain, or choose another type. |
| A NetBIOS name has at most 15 characters: letters, digits, - and _, and no dot. | Fix the name, or choose the type **Domain**. |
| A name pattern may only contain letters, digits, -, # and *, and at least one letter. | Fix the pattern. |
| Enter a network as address/prefix, e.g. 10.20.0.0/16, or one address. | Enter the network as address/prefix. |
| The network is too wide; use /8 or narrower. | Use a narrower network. |
| The value is already in the dictionary. | Nothing to do: the value is already there. |
| The value is already on the other list; it cannot be both always and never masked. | Remove the value from the other list first. |
| It looks like a secret, and secrets cannot be added to the dictionary. | Keep secrets in the case; mask them in **Mask**. |
| The entry no longer exists. | The entry is already gone. |
| Choose a type. | Choose a type. |
| Paste a text first. | Paste a text into the field. |
| The dictionary was not changed: […] | See the reason after the colon. |
| The dictionary was changed elsewhere. It has been read again; try again. | Try again. |
| the dictionary could not be saved ([…]) | Check that there is space on the disk and that the keychain can be used. |
| The dictionary could not be opened: […]. Grimnir uses an empty dictionary and does not change the file. | See the reason after the colon. If the file cannot be rescued, you can start over with an empty dictionary (see below). |
| the dictionary could not be opened at start ([…]), so it is not changed | The dictionary cannot be changed until it can be opened. |
| The pattern could not be added to the dictionary: […] | See the reason after the colon. |

## Notes

| Error text in the program | What you can do |
|---|---|
| Write something in the note first. | Write something in the note. |
| The note is too long: at most […] characters. | Shorten the note, or split it in two. |
| The case already has […] notes, the most it can have. Delete a note first. | Delete a note you do not need. |
| The note no longer exists in the case. | The note is already gone. |
| The notes cannot be shown: […] | See the reason after the colon. |

## The lock

| Error text in the program | What you can do |
|---|---|
| Grimnir is still locked. Press Unlock to try again. | Press **Unlock**. |
| Your identity could not be confirmed. Grimnir is still locked. | Press **Unlock**, and try again. |
| The operating system could not confirm who you are (error […]). Grimnir is still locked. | Try again. If it happens again, restart your Mac. |
| Grimnir could not ask to be unlocked. Grimnir is still locked. | Quit, and start Grimnir again. |
| This machine cannot confirm who you are. Grimnir is not locked. | Give your user account a password, and Grimnir can lock. |
| The temporary case could not be saved when Grimnir locked and has been closed: […]. | See the reason after the colon. The case values are gone; mask the text again if you need the codes. |
| The open case could not be saved when Grimnir locked: […]. | See the reason after the colon. Open the case, and mask again if something is missing. |

## Other

| Error text in the program | What you can do |
|---|---|
| The setting was not saved: […]. | See the reason after the colon, and choose again. |
| The guide could not be opened in the browser. | Open the guide in your browser yourself. |
| The third-party licences could not be shown. | The licences are also in the file THIRD_PARTY_LICENSES.md in the source code. |

## The dictionary file cannot be opened

If the dictionary file cannot be opened, Grimnir uses an empty dictionary and does not change the file. Under **Dictionary** you can choose **Start over**. Grimnir asks first (**Start over with an empty dictionary?**), renames the old file in the same folder (it is not deleted) and starts with an empty dictionary.

## When it is not an error text

- **A command is greyed out:** hold the mouse over it. The tooltip says why, e.g. **Paste a text first**.
- **Grimnir did not find a value:** select it, and choose **Mask selection**, or add it to the dictionary. See [Mask](40-visninger/masker.md).
- **A reply cannot be unmasked:** check that the case the reply belongs to is open. See [Unmask](40-visninger/demasker.md).
