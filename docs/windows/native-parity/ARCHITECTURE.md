# Native parity architecture audit

28 October 2026, Asia/Baku. Phase 01: documentation only. This describes inspected source and existing artifacts, not a newly implemented or accepted product.

## Evidence and authority

- Native source: dirty `codex/auth-drawing-rebuild`, HEAD `80124f17ae500565fe4bb7a88ad44f4b693d4e02`. HEAD alone does not reproduce the working tree; see `BASELINE.json` and the external hashed initial-state manifest.
- Web reference: separately fetched and extracted `eef28dd4c0d4353b94d2afbbff6b252bfa5e4243`. The latest inspected production workflow, [40677788639](https://github.com/zephyriaa/zterminal/actions/runs/40677788639), completed its Cloudflare deployment job successfully. This freshly verifies the supplied historical pointer as the current successful deployment reference at inspection time. It is not a runtime build-hash attestation; none was obtained.
- The browser reached the live `/workspaces` dashboard, showed real saved records and the creation form. No new web workspace was submitted. Direct HTTP probes returned 403. Chart, docking, preferences, drawings and research behavior below is **source-inspected**, not live-tested in this audit.
- The supplied common contract and phase prompts govern the target. The two supplied PNGs were visually inspected. Older Figma plans are historical evidence; lack of access to old Figma exports does not block the supplied welcome/Home direction.
- All UI work after physical Escape was deferred at the user's request. Backend checks continued. Do not interpret the native creation click as a completed save/import/restart journey.

## Actual entrypoints and classification

| Path | Classification and finding |
|---|---|
| `apps/windows-host/winui/App.xaml.cpp` → `MainWindow.xaml.cpp` | Intended native product foundation: immediately constructs one workspace window, starts the native chart and restores the last local workspace. There is no welcome, account exchange, Home route or workspace tab manager. |
| `apps/windows-host/scripts/build-winui.ps1` → `winui/ZTerminalWindowsHost.vcxproj` | Builds `out/windows-app/Release/ZTerminal.exe`, native presentation static library, Rust Store adapter; copies runtime DLLs and available sidecars. WinUI project is unpackaged/self-contained, x64, Windows App SDK 2.5.1, C++/WinRT 3.0.260818.1, v143, SDK 10.0.26100, declared minimum 10.0.17763. Declaration is not OS compatibility testing. |
| `apps/windows-host/CMakeLists.txt`, `src/main.cpp`, `scripts/build-native.ps1` | Win32/D3D diagnostic host and shared chart presentation implementation. `ZTerminalWindowsHost.exe` is useful for diagnostics, not equivalent to the WinUI product. |
| `package.json` desktop commands | Current `desktop:dev/build` still invoke Tauri; `desktop:native:dev/build` invoke the Win32 script. No inspected npm command selects the WinUI script. The 7 October `NATIVE_DESKTOP_ENTRYPOINT.md` statement that default commands select native is stale. Correct the command routing in an authorized implementation phase. |
| `src-tauri/src`, `apps/workstation`, hosted preview workflows | Compatibility/preview UI paths, superseded as the Windows product. Do not add parity there or remove dirty files. |
| `src-tauri/workstation-core` | Active native repository library and CLI, despite directory name. Its dependency manifest does not require a Tauri UI to use `Store`. Reuse it. |
| `research/desktop/Launcher.cs`, `server.py` | Web Helper: WinForms launcher, paired loopback API on port 47321, separate research archive. It is not the native terminal and its browser pairing must not become the native data path. |
| `apps/zt-local-*`, offline importer, direct ingest | Bounded internal tools. Presence beside the product is not proof the UI calls them. |
| Renderer fixtures, `docs/windows/v2` HTML/Tauri evidence | Diagnostic/superseded acceptance evidence. Test candles are not product data; Tauri UI acceptance is not native acceptance. |

## Current process and store ownership

```text
WinUI ZTerminal.exe
  ├─ in-process C++ D3D11/DXGI + D2D/DirectWrite chart
  └─ background low-frequency native_store::call
       └─ zt-native-store.exe ROOT REQUEST.json RESPONSE.json
            └─ existing Rust Store + zt-domain/core/storage/protocol
                 ├─ workstation.sqlite3 (WAL, synchronous FULL, user_version 1)
                 ├─ content-addressed artifact bytes / workspace revisions
                 └─ hash-addressed verified SegmentStore data

Separate existing tools:
  direct public ingest / offline importer → SegmentStore
  local scene / segment catalog / workspace journal / Monte Carlo CLIs
  web browser → paired Helper HTTP → Controller → bounded Python child
                                      └─ research.sqlite3 archive
```

`native_store.h` uses temporary JSON sidecars and a new process per **storage action**, a 30-second wait, and a 32 MiB response limit. `Perform` and strategy saves run the call off the UI thread. Pointer/zoom/render events remain in-process; the chart timer coalesces demand into a nonrepeating 16 ms timer. Do not replace this adequate low-frequency path merely for uniformity. Do not extend it to one process/full-scene rewrite per tick.

`Store` owns workspace identity, revision checks, retained source/parameters and linked chart/dataset/strategy artifacts. `zt-storage::SegmentStore` owns immutable market segments and integrity metadata. The standalone local-workspace journal is another existing format; it must not become a second authority for WinUI workspace edits. Python's result archive is an artifact authority for jobs/results, not a competing workspace store. Link immutable run references from the existing workspace repository rather than copying mutable result state into a second workspace database.

Current `Summary` contains only id/name/revision. Native Home requires real timestamps, study catalog metadata and revision-keyed previews; those fields are not already available merely because SQLite is used. Thumbnail data needs a bounded cache, not a provider connection per card.

## Schema mismatch is a prerequisite, not a UI detail

| Contract | Actual scope |
|---|---|
| Web `src/lib/workspaces/model.ts` | Snapshot **v3**: UUID, revision, provider/symbol/timeframe/timezone, dock layout, studies, research selection, up to 32 chart documents and 1–4 multi-chart pane records; serialized snapshot bounded to 8 MB. IndexedDB `zterminal-workspaces` is the local record authority. |
| Web `src/lib/chart/contracts.ts` | Chart schema **v5**, drawing schema 1, `ChartSettingsV2`; candles/bars/line/area, normal/log/percentage, panes, overlays, drawings, indicator output styles and replay. |
| Native `crates/zt-domain/src/lib.rs` | `WorkspaceDocumentV2`, `ChartDocumentV3`, `StrategyRevisionV2`; chart settings are not the web settings object. `Product` currently represents Spot/UsdtPerpetual; it cannot silently represent a futures contract. |
| Native `Store::validate` | Explicitly rejects a non-primary chart, nonempty indicators, any drawings, replay or presentation. Exactly one chart plus optional strategy is accepted. A type in `zt-domain` is not an exposed native capability. |
| Native `native.rs` scene | Scene **v2**: string-encoded exact i64 units, decimal step strings, ns instants/cutoff, workspace/chart/dataset revisions and SHA identities. Rust filters completed bars before rendering. |
| Native CSV import / Python cash | Retained CSV/spot, not a live venue. 8 MiB input and 100,000-bar native bounds; contiguous completed intervals. `local_cash.capture` checks source/data/revision/units/range, rejects lossy numeric conversion, and declares `cash_next_open_v1`. |
| Newer web research | Includes `synthetic_next_open_v2`, saved Python indicator evaluations, validation/holdout/walk-forward/Monte Carlo artifacts. Reusing the native cash adapter does not automatically port these semantics. |

First extend the canonical versioned document and its actual Store validation/migration, then add the necessary explicit translation. Retain old bytes and fail visibly on unsupported content. Map ms ↔ ns and web time/price anchors explicitly; never cast a large epoch or exact tick count through f32. Freeze fixtures for normal/log/percentage/negative/zero prices, gaps, DST labels, replay cutoffs, source revisions, drawing anchors and linked chart ownership. Independent native rasterization can differ; semantic values cannot.

The native renderer is currently a singleton (`src/main.cpp` global renderer/view/scene). Its API takes no chart/session handle. Multiple workspace tabs or charts require explicit per-chart presentation ownership before concurrent scenes; merely adding a TabView would let tabs overwrite shared state. Prefer a small per-chart state owner around the existing renderer over a universal rendering framework or a rewrite in Rust.

## Target boundaries and smallest viable changes

```text
WinUI welcome / Home / workspace tabs
  ├─ existing Rust Store: one authoritative workspace/document/revision model
  ├─ per-chart owned C++ renderer + validated scene/settings/study/drawing inputs
  ├─ shared local provider subscription supervisor
  │    └─ supported SDK library or long-lived worker → normalized bounded events
  │         → core aggregation / SegmentStore → chart/replay/research readers
  └─ native research supervisor → existing Python Controller/child/archive
       └─ captured immutable input identity + durable workspace run reference

System browser ↔ bounded account exchange ↔ revocable device session
Optional server: identity, necessary entitlements, release metadata,
                explicitly enabled bounded metadata sync
```

Provider market data, credentials, raw order flow, scripts, datasets and research outputs stay local by default. Shared subscriptions are keyed by real provider/environment/exchange/instrument/capabilities. UI batches updates from bounded queues; overflow/gaps must be visible. A provider without sequence IDs cannot be assigned invented exchange sequence guarantees. Current `zt-protocol` provider enum and normalized event contract need explicit futures/provider/capability extension, not relabelling Binance or fixture data as Rithmic.

Current request inventory from inspected native paths:

| Trigger | Inspected destination / status |
|---|---|
| WinUI launch, restore, create/open/save/import/source save | Local Store process/files only; no ZTerminal request in the inspected call path. Zero observed TCP connections is only a sampled corroboration. |
| Pointer/keyboard/paint | In-process renderer; no HTTP/process spawn per input/frame. |
| Native account/release/sync | No implemented caller in the inspected shell. Future requests must be inventoried when introduced; absent code is not a tested offline auth feature. |
| Native research Run/report | Disconnected; no working native request lifecycle to measure yet. |
| Explicit standalone direct-public-ingest command | Direct Binance Spot aggregate-trade connection with explicit finite bounds; not an automatically started WinUI provider service. |
| Web research compatibility | Paired loopback Helper API, port 47321, plus provider data preparation. This is a separate web/Helper path; it is not native product origin traffic. |

For high-frequency SDK events, use the existing native process/library boundary and an efficient long-lived local channel with batched versioned events. Pick an in-process C++ SDK only after its exact ABI/compiler/architecture supports this x64 product and measurements justify sharing crash fate. A supervised worker is preferable if the SDK requires another runtime/bitness, can block callback threads, or benefits from crash isolation. Start with one supervised adapter, not a plugin framework. Do not choose .NET version, x86/x64 bridge or transport encoding without the actual kit. The published SDK family description alone does not settle them.

## Identity and credentials

`docs/NATIVE_AUTH_EXCHANGE_PLAN.md` is a design, not implemented auth. Searching the freshly extracted deployed source found web NextAuth PKCE/state, but no native code-exchange/device-session implementation. `App::OnLaunched` bypasses all welcome routing. Web workspace account identity and provider login remain distinct.

Phase 02 must implement the approved bounded exchange with the existing identity: unpredictable state, PKCE S256, allowlisted owned callback, short-lived hashed one-use code consumed atomically, scoped revocable/rotating device credentials and DPAPI/Credential Manager custody. Native access must use an explicitly scoped API boundary, not copied browser cookies. Test replay, wrong state/verifier, expiry, simultaneous exchange, denied/cancelled browser flow, sign-out and account switch. Offline choice durably completes onboarding without a fake account and remains useful when ZTerminal services fail.

`apps/windows-host/src/execution_vault.cpp` is an existing current-user DPAPI primitive and `CMakeLists.txt` describes it as intentionally unexposed. It is not wired native identity or provider UI. Reuse security primitives where appropriate without enabling trading. Do not send provider secrets through the web `/api/connectors/rithmic` placeholder; it is a server-side R|Protocol unavailable response, not the requested local plugin adapter.

## Rithmic: verified guidance and explicit gates

Official sources checked 28 October 2026:

1. [Rithmic connection guides](https://www.rithmic.com/platforms/guides): start Pro, enable Allow Plugins before login, connect the client via plugin, keep Pro running. This verifies the requested route; it does not document SDK-level bindings.
2. [Rithmic API suite](https://www.rithmic.com/apis): R|API+ offers C++/.NET; R|Protocol is a separate wire interface. R|API+ production access requires conformance; development/test access is distinct. An API page does not authorize this app/account or redistribution.
3. [Rithmic exchange capabilities](https://www.rithmic.com/platforms/exchanges): market data differs by venue, including top-of-book, depth, MBO and history. These are platform offerings, not proof this login/plugin supplies each capability.
4. [R|Trader Pro releases](https://www.rithmic.com/products/r-trader-pro/releases): published plugin reconnection changes make Pro-version pinning and restart/reconnect acceptance necessary. These Pro runtime notes are not the R|API+ SDK runtime contract.

No official kit headers/libraries or Rithmic-named package was located in the inspected source/build configuration, repository filename search, top-level Program Files directories or Downloads. No Rithmic/Pro process was found by the name check. This is a **bounded negative inventory**, not proof no SDK exists anywhere on the PC. Credentials were not opened or tested. No vendor contact, login, network connection or trade was performed.

| Required fact | Current result / action before SDK-dependent code |
|---|---|
| Eligible SDK and developer/application identity | BLOCKED: obtain an authorized R|API+ kit and its official plugin examples/terms from the user/vendor. Confirm plugin route for the exact kit; do not substitute Protocol. |
| Architecture, compiler/ABI and runtime | BLOCKED: native target is x64; inspect actual kit release notes, supported Windows/CRT or .NET versions and redistributables. No exact SDK version was verified. |
| Plugin configuration/API | General Pro steps verified. Encoding variables/ports/credentials must be verified against the eligible official kit; third-party mirrors were not accepted as binding SDK guidance. |
| Credentials/system/gateway/session counts | UNKNOWN: obtain explicit authorized test environment/account; Pro login is not assumed SSO. Confirm broker/prop permissions and simultaneous-session limits. |
| Quotes/trades | UNKNOWN for this account. Validate subscription callbacks and exact units before native display. |
| History, depth/MBP, MBO | UNKNOWN separately. Confirm entitled capabilities and plugin behavior per instrument; MBP is not MBO, candles are not an event archive. |
| Conformance | Vendor requirement verified; ZTerminal approval not supplied. Test access does not imply production approval. |
| Redistribution and price | UNKNOWN. Review actual license/redistributable list and account fees; no claim of free API access or redistribution permission. |

Native public ingestion, worker lifecycle, capability presentation and normalization can be implemented independently when their phase is authorized. Rithmic connection acceptance remains BLOCKED until real entitled test evidence exists.

## Conflicts resolved for the plan

- Latest welcome/Home images replace conflicting old layouts; their taskbar, sample cards, cloud badges, GEX and community labels do not authorize services or invented data.
- Web opens each workspace in a browser tab. Native target uses an in-app Home tab and workspace tabs; preserve equivalent independent ownership and recovery, not browser mechanics.
- Web currently has workspace cards, not the illustrated separate studies gallery or real chart-thumbnail cards. Home study discovery and previews need implementation.
- Historical material/effects plans do not make current Settings functional: `ShowSettings` creates ephemeral controls with no handlers or persisted preference changes.
- Native `Assets/mark.png` SHA differs from the deployed `zterminal-mark-kit-v1.png`. Different resolution can explain byte differences; approved geometry has **not** been established by hash comparison. Phase 02 must use the actual approved Logo Kit v1, preserving all three pieces, rather than tracing either screenshot.
- Tests executed existing October artifacts. No rebuild tied these binaries to all current dirty source bytes. Keep this artifact/source limitation visible in every later acceptance claim.
