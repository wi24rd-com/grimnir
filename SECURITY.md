# Security policy

Wi24rd Grimnir is maintained by one person in spare time. There is no guaranteed response time.

## Supported versions
Only the latest release is maintained. Fixes are made in a new release, not in older ones.

## Reporting a vulnerability
Please do not open a public issue for a vulnerability.

1. **Preferred:** use GitHub's private vulnerability reporting. On the repository page, open **Security** and choose **Report a vulnerability**.
2. If that button is not there, write to security@wi24rd.com.

Use made-up values in the report. Do not send real logs, case files, passwords or keys. A description of the pattern and the steps is enough.

## What Grimnir is built to do, and not to do
- Grimnir has no network code. It does not send your text, your cases or anything else anywhere. The **Guide** button asks the operating system to open a web page in your browser.
- Cases are stored as encrypted files (XChaCha20-Poly1305) on your own machine. The key for each case is kept in the operating system's keychain.
- The lock (Touch ID or your password) is for someone who sits down at your unlocked computer. It does not protect against other programs running as you, or against someone who controls your user account.
- Grimnir finds values by patterns and by your dictionary. It can miss a value. Read the masked text before you share it.
- A file saved from **Unmask** holds the real values in clear text. Grimnir asks before it saves one.

Reports that show one of the statements above to be wrong are especially welcome.
