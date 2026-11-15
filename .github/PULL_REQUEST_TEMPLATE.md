## What and why


## Checked
- [ ] `cargo test -p grimnir-core` and `cargo test -p grimnir` pass
- [ ] `cargo clippy --workspace --all-targets -- -D warnings` is clean
- [ ] `npm run test:ui` passes (if the change touches `ui/`)
- [ ] Only made-up data in tests, examples and screenshots
- [ ] No network code and no new dependency that can open a connection
- [ ] README.md and README.da.md say the same (if the change touches either)

Pull requests are integrated locally by the maintainer, so an accepted pull request shows as closed, not merged.
