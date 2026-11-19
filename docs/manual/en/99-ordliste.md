# Glossary

| Word | Means |
|---|---|
| **Analysis** | When Grimnir reads the text and finds the sensitive values. Happens as soon as you paste a text or open a file. |
| **BOM** | Byte order mark: a few invisible bytes at the start of a file that say which character set it uses. |
| **CIDR** | A way of writing a network: address/prefix, e.g. `10.20.0.0/16`. |
| **Unmask** | To put the real values back in place of the codes. |
| **Developer ID** | Apple's certificate for programs that are downloaded outside the App Store. |
| **Own network** | A network that is yours: the private networks under RFC 1918 and the networks you add to the dictionary. |
| **Replacement** | What a value becomes in the masked text. The same as the code. |
| **Secret** | A password, a key, a token or similar. Shown as dots until you choose **Show**. |
| **Code** | The neutral value that stands in place of a real value, e.g. `h0001` for a machine, `user0001` for a user, `198.18.0.11` for an address in your own network and `GRIMNIR_SECRET_0001` for a secret. |
| **Receipt** | A short text with the figures from a masking, without original values. |
| **Leak check** | Grimnir's check of the result after masking: is there still an original or something that looks like a sensitive value? |
| **Mask** | To replace sensitive values with codes. |
| **Temporary case** | The case you work in when you have not chosen one. It exists only in memory until it is saved under a name, or Grimnir locks or quits. |
| **Name pattern** | The form of your machine names, e.g. `srv-###`, where `#` is one digit. |
| **NetBIOS domain** | A Windows domain name without a dot, e.g. `KONTOR`. |
| **Keychain** | The secure store in macOS for passwords and keys. Grimnir keeps the keys for the cases and the dictionary there. |
| **Notarisation** | Apple's check of a program before it is released outside the App Store. |
| **Public address** | An IP address outside your own networks. Only masked if you choose so. |
| **Dictionary** | Your own lists of what Grimnir must always find and what it must never touch. |
| **RFC 1918** | The standard for the private IPv4 networks that are not used on the internet. |
| **Case** | What remembers which code belongs to which value. One encrypted file per case. |
| **Inactivity** | Time without keyboard or mouse in Grimnir's window and without work in progress. |
| **Touch ID** | The fingerprint reader on the Mac. |
| **Expiry** | A date when the case is marked as expired. It is not deleted automatically. |
| **UTF-8 and UTF-16** | Character sets. Grimnir reads UTF-8 with or without a BOM and UTF-16 with a BOM. |
