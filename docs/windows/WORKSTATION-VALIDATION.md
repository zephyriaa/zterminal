# Running the local workstation checks

The canonical domain crate currently comes from the pre-existing uncommitted user baseline. Review and commit `crates/zt-domain` and its root workspace membership before clean-checkout CI can pass. The consolidation commits intentionally do not silently include unrelated baseline changes.

## Local commands

```powershell
cargo test --locked --manifest-path src-tauri/workstation-core/Cargo.toml
npm test
npm run typecheck
npm run lint
npm run desktop:build
```

`desktop:build` produces a bundled executable without creating or publishing an installer. `desktop:dev` uses only the local Vite server. Native renderer research is available through `desktop:native:build` / `desktop:native:dev`.

## Browser UI regression

With browser-harness connected and recordings disabled:

```powershell
cargo build --locked --manifest-path src-tauri/workstation-core/Cargo.toml --example bridge
npm run workstation:dev
# In another terminal:
python scripts/test-workstation-browser.py
```

The driver is test-only. Each request starts a fresh Rust process against a temporary disk store. The test replaces Tauri transport, not the storage, import validator or engine. Fixture data is labelled TEST ONLY; it is never a product default.

## Native offline and process restart regression

Close only the executable being rebuilt first; Windows prevents replacing a running executable.

```powershell
npx tauri build --no-bundle --config src-tauri/tauri.workstation-test.conf.json
python scripts/test-workstation-browser.py --native
# Rebuild the actual product identifier after validation:
npm run desktop:build
```

The validation configuration uses `com.zterminal.workstation.validation` for separate storage. The native test requires that build, uses browser-harness on the app's WebView2 debugging port 9225, enables WebView network emulation offline, imports through the real Tauri command boundary, interacts with the chart, saves, removes original source files, and restarts the process. Debugging arguments are applied only to that test launch. The product launch has no debugging port configured. Native process restarts and browser reloads are distinct checks.

## Installation / upgrade gates (not implied by executable build)

Run in a disposable Windows user or VM, after all slice gates pass. Build an unsigned NSIS package locally with `npx tauri build --bundles nsis`. Do not sign or publish it. Check clean install, bundled startup without network, WebView2 already-installed and absent cases, first import/save, restart, upgrade retaining database and source artifacts, and uninstall retaining/removing user data according to an explicit policy. The current bootstrapper requires a network connection if WebView2 is missing; offline installation is not yet accepted. Do not use the old hosted-preview or native Inno Setup smoke results as evidence for this installer.

## Performance scope

Run `python scripts/test-workstation-browser.py --performance` after building the test driver. This measures a 10,000-row labelled fixture and a 2,000-bar scene using a new debug Rust process for each operation; results include process startup, disk work and integrity checks.

Measure with hardware/OS, row count, build profile and cold/warm state recorded. The product scene is bounded to 2,000 bars; imports are bounded to 100,000 rows / 8 MiB. Record import, save, scene, and restore timings independently. No claim about D3D comparison or a product frame-time budget follows from historical fixture renderer benchmarks. Whole-source integrity checks are currently repeated on each workspace load; optimize only after a measured bottleneck.
