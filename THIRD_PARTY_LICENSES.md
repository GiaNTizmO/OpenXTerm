# Third-Party Licenses

OpenXTerm is licensed under the MIT License. It also includes and links software developed by third parties. This file records the hand-reviewed license notice surface for release hygiene.

This document is not legal advice. It is a project-maintained inventory of important third-party license obligations and references.

Generated dependency inventories live under `docs/legal/generated/`:

- `docs/legal/generated/cargo-licenses.json`
- `docs/legal/generated/npm-licenses.json`
- `docs/legal/generated/native-notices.json`
- `docs/legal/generated/dependency-license-summary.md`

## License-Sensitive Runtime Components

### libssh

OpenXTerm uses `libssh-rs` with the `vendored` feature enabled in `src-tauri/Cargo.toml`. The Rust crates `libssh-rs` and `libssh-rs-sys` are MIT-licensed, but the vendored native library built underneath them is upstream libssh.

- Upstream project: <https://www.libssh.org/>
- Source: <https://gitlab.com/libssh/libssh-mirror>
- License: GNU Lesser General Public License, version 2.1 or later, as published by upstream libssh.
- LGPL-2.1 text: <https://www.gnu.org/licenses/old-licenses/lgpl-2.1.en.html>

Release note: binary OpenXTerm artifacts should preserve libssh notices and provide a practical path to the corresponding source. Because the current Tauri build statically links vendored native code through the Rust dependency stack, release hardening should confirm the relinking/source-offer expectations before stable distribution.

### OpenSSL

OpenXTerm uses `libssh-rs` with the `vendored-openssl` feature enabled in `src-tauri/Cargo.toml`. The Rust crate `openssl-src` currently resolves to OpenSSL 3.x source through Cargo.

- Upstream project: <https://www.openssl.org/>
- Source: <https://github.com/openssl/openssl>
- License: Apache License 2.0 for OpenSSL 3.x.
- License text: <https://www.openssl.org/source/license.html>

Release note: binary OpenXTerm artifacts should include the relevant OpenSSL 3.x `LICENSE` and `NOTICE` material from the exact vendored source version used for the release. Until this is automated, release maintainers should inspect the `openssl-src` version resolved in `src-tauri/Cargo.lock`, locate the corresponding vendored OpenSSL source prepared by that crate during build, and copy the upstream `LICENSE` and `NOTICE` material into the release notice bundle.

### serialport-rs

OpenXTerm uses `serialport` for serial session support.

- Upstream project: <https://github.com/serialport/serialport-rs>
- Crate: <https://crates.io/crates/serialport>
- License: Mozilla Public License 2.0.
- MPL-2.0 text: <https://www.mozilla.org/en-US/MPL/2.0/>

OpenXTerm currently uses `serialport` as an unmodified dependency.

### MPL-2.0 transitive components

The generated license report currently flags additional MPL-2.0 transitive dependencies for review, including Rust crates used through the Tauri/WebKit/CSS stack and npm `lightningcss` packages used by frontend tooling.

Current review-sensitive groups include:

- `cssparser`, `cssparser-macros`, `selectors`, `dtoa-short`, `dwrote`, and `option-ext` in the Cargo graph.
- `lightningcss` and platform-specific `lightningcss-*` npm packages in the npm graph.

These are tracked in `docs/legal/generated/dependency-license-summary.md`. They are not known to be modified by OpenXTerm, but release maintainers should keep them visible during dependency updates.

## Other Rust Dependencies

OpenXTerm also depends on Rust crates under permissive licenses such as MIT, Apache-2.0, BSD, ISC, 0BSD, and similar terms. Important direct dependencies include:

- `tauri`, `tauri-build`, and `tauri-plugin-log`
- `serde` and `serde_json`
- `portable-pty`
- `font-kit`
- `arboard`
- `time`
- `log`
- `windows` and `windows-core` on Windows

The exact dependency graph is defined by `src-tauri/Cargo.toml` and `src-tauri/Cargo.lock`.

## npm Dependencies

OpenXTerm's frontend depends on npm packages under permissive licenses such as MIT, Apache-2.0, BSD, and ISC. Important direct runtime dependencies include:

- `@tauri-apps/api`
- `@xterm/xterm`, `@xterm/addon-fit`, and `@xterm/addon-search`
- `lucide-react`
- `react` and `react-dom`
- `zustand`

The exact npm dependency graph is defined by `package.json` and `package-lock.json`.

## Automation Status

This file is intentionally hand-written and conservative. The automated audit is implemented through:

- `npm run licenses:check`
- `npm run licenses:generate`
- `docs/legal/license-policy.json`
- `docs/legal/license-audit.md`

The CI/CD verify job runs the license check and uploads generated reports as workflow artifacts.
