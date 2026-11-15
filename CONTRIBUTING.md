# Contributing

Thank you for looking at Wi24rd Grimnir. The project is maintained by one person in spare time, so answers can take a while and not every change can be accepted. For anything larger than a small fix, open an issue first.

## Rules that are not negotiable
- **Made-up data only.** Tests, examples, screenshots and issues contain only invented values: documentation IP ranges (`192.0.2.0/24`, `198.51.100.0/24`, `203.0.113.0/24`), `example.com`, invented machine, user and database names. Never a real log, script or secret.
- **No network code.** Grimnir never opens a network connection. No HTTP client, updater or telemetry, and no dependency that brings one in. The tests check the dependency tree for this.
- **Real values never reach the disk in clear text**, and never appear in logs, error messages or test output.
- A new dependency needs a reason, a version and a licence that fits Apache-2.0.

## Build and test
Requires Rust (rustup) and Node.js.

```
npm install
npm run tauri dev                         # run the app
npm run tauri build -- --debug            # a debug bundle (Grimnir.app)
cargo test -p grimnir-core                # the core
cargo test -p grimnir                     # the shell (Rust)
cargo clippy --workspace --all-targets -- -D warnings
npm run test:ui                           # the UI smoke test (jsdom)
npm run test:kontrast                     # colour contrast in light and dark
npm run test:kolonner                     # table column widths
npm run test:kit                          # the Wi24rd UI Kit 2 package
npm run tjek                              # the kit's copies in ui/assets match the package
npm run test:signer                       # the signing script with stubs (signs nothing)
```

The same commands run in CI (`.github/workflows/ci.yml`).

## Language
The code, its comments and the commit messages are in Danish. Issues and pull requests are welcome in English or Danish. `README.md` and `README.da.md` must say the same.

## Pull requests
Pull requests are integrated locally by the maintainer and pushed from there. An accepted pull request therefore shows as **closed**, not merged, with a comment naming the commit. Your authorship is kept in the commit.

By contributing you agree that your contribution is licensed under Apache-2.0, like the rest of the repository.

## Releases (maintainer)
1. `sh tools/signer.sh udgiv` builds, signs with Developer ID, notarises and staples. The result is `Grimnir-<version>.zip` in the release folder outside the repository.
2. `shasum -a 256 Grimnir-<version>.zip` gives the SHA-256 of the final file. It goes into the release notes.
3. Create the release on GitHub as a **draft**, attach the zip, check the notes and the file, then publish by hand.
4. A published release and its tag are not changed afterwards. A mistake is fixed with a new version.
