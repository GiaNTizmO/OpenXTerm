# Dependency License Audit

OpenXTerm audits dependency licenses through `script/license_audit.mjs`.

The first implementation intentionally uses lockfile and metadata sources that already exist in the project:

- Cargo: `cargo metadata --manifest-path src-tauri/Cargo.toml --locked --format-version 1`
- npm: `package-lock.json`

This avoids installing a separate license checker in CI and keeps normal release checks less dependent on extra network access.
Cargo target-specific dependencies remain visible in the Cargo metadata package graph; native vendored dependencies still need the manual notes below.

## Commands

```bash
npm run licenses:check
npm run licenses:generate
```

`licenses:check` fails on missing, unknown, or unreviewed licenses.

`licenses:generate` writes deterministic reports to:

```text
docs/legal/generated/
  cargo-licenses.json
  npm-licenses.json
  native-notices.json
  dependency-license-summary.md
```

The npm report keeps development dependencies visible with a `dev` flag. The public release notice remains the hand-reviewed `THIRD_PARTY_LICENSES.md`; generated reports are audit inputs and CI artifacts for now.

## Policy

Policy lives in [`license-policy.json`](license-policy.json).

The policy has three buckets:

- allowed licenses: common permissive licenses that can pass automatically
- review licenses: licenses such as MPL/LGPL that should be visible in release review
- review packages: specific packages whose Cargo/npm metadata is not enough by itself

`serialport` is review-listed because it is MPL-2.0. `libssh-rs`, `libssh-rs-sys`, and `openssl-src` are review-listed because the Rust crate metadata does not fully describe the native vendored libssh/OpenSSL notice obligations.

## Tooling Decision

Evaluated first-pass options:

- `cargo-deny`: strong Cargo policy checker, good candidate for a future stricter CI layer.
- `cargo-about`: useful for generating bundled license text, good candidate for future release artifacts.
- `cargo-license`: lightweight inventory, but less useful than a combined policy/generation flow here.
- npm license checker packages: workable, but a custom `package-lock.json` reader is simpler and avoids an extra dependency for the first pass.

Current choice:

- custom Node script for both ecosystems
- generated JSON/Markdown committed for review
- generated reports uploaded as CI artifacts

## Known Limitations

Cargo metadata reports Rust crates. It does not fully model native vendored source obligations. For OpenXTerm that matters most for:

- libssh via `libssh-rs` / `libssh-rs-sys` with `vendored`
- OpenSSL via `openssl-src` with `vendored-openssl`

Those are represented in `native-notices.json` and kept review-required even when the Rust crate license looks permissive.

This audit does not replace legal review. It is a repeatable signal that catches new or changed dependency licenses before release.

## References

- [Cargo metadata command](https://doc.rust-lang.org/cargo/commands/cargo-metadata.html)
- [Cargo manifest license fields](https://doc.rust-lang.org/cargo/reference/manifest.html#the-license-and-license-file-fields)
- [npm package-lock.json format](https://docs.npmjs.com/cli/v11/configuring-npm/package-lock-json/)
- [SPDX License List](https://spdx.org/licenses/)
