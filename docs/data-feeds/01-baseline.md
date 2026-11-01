# Data-feed baseline — stage 1

Inspected 2026-10-30 (Asia/Baku). Scope: current source, existing local tests and the active consumer paths; application code is unchanged by this stage. This report supersedes the preliminary research report where actual consumer tracing revealed narrower support.

## Starting state and method

- Checkout: `C:\Users\aykhank\Desktop\Others\Projects\ZT`.
- Branch: `codex/auth-drawing-rebuild`; HEAD: `80124f17ae500565fe4bb7a88ad44f4b693d4e02`.
- Initial porcelain status contained 344 entries, including staged, unstaged and untracked work. A path/status snapshot is retained in [01-starting-git-status.txt](01-starting-git-status.txt). No reset, stash, commit or application edit was made.
- Existing worktrees were enumerated. This read-only source audit reused the current checkout because its uncommitted feed work is part of the authoritative baseline; auditing an older clean checkout would omit that work.
- Runtime: Node 22.23.2. Installed packages: Next.js 16.3.6, tsx 4.23.12, TypeScript 5.9.3. No package installation was needed.
- Read root `AGENTS.md`, the supplied user directives, the prompt set and preliminary research. Used source-driven-development instructions to avoid interpreting declarations as runtime evidence. Stage 1 makes no new vendor/API claims and required no external documentation lookup.
- Evidence below gives repository-relative files and one-based lines. Searches covered web source, market gateway, tests, relevant native store/projection and research consumers. Native UI execution, exchange connections, credentialed access and deployment were not exercised.

## Main findings

1. **The production-facing hook uses the gateway, not the multi-provider browser class.** `src/hooks/use-market-stream.ts:68` creates a Socket.IO client, and lines 160 onward feed terminal consumers. `PublicMarketDataProvider` exists at `src/lib/market/public-stream.ts:65`, but a source-reference search found its import/use only in `tests/public-stream-resilience.test.ts` and `tests/provider-l2-sync.test.ts`. The exported singleton is not wired into the inspected terminal hook. Five browser parser implementations are therefore not proof of five selectable live terminal feeds.
2. **One gateway process serves one selected venue.** `mini-services/market-data/index.ts:12` selects Binance, explicit mock, or Gate.io; lines 107–108 instantiate only the two live adapters. Discovery at line 195 and subscription dispatch at line 257 use that choice. Requests for a foreign provider are refused at line 276. Selecting Bybit/OKX/Coinbase in the workspace cannot make that process serve them.
3. **History is broader than live gateway support, but Coinbase is explicitly unavailable.** `src/app/api/bars/route.ts:28` lists five crypto provider names plus mock, but line 41 rejects Coinbase and non-matching USDT perpetuals before upstream fetch. Lines 102–122 dispatch Gate.io, Binance, Bybit and OKX after verified metadata. A one-element provider sequence at line 95 prevents transparent cross-venue fallback. The preliminary report's statement that the route accepts all five needs this qualification.
4. **The legacy research cache is a different path with weaker identity.** `src/lib/market/cached-bars-provider.ts:11` takes no provider argument and line 42 fetches Binance. `src/lib/market/bar-cache.ts:22` keys stored bars by symbol/timeframe/time, with the compound index at line 52 omitting provider. CSV imports write into that same store (`dataset-importer.ts:152`). The current chart uses the provenance-aware `bars-dedup.ts` route instead, so this is a specific legacy optimizer/download/import risk, not a claim that every chart cache mixes venues.

## Consumer and transport trace

| Area | Owning source and path | Evidence and limit |
| --- | --- | --- |
| Selection/persistence | `src/stores/workspace.ts:108`; `src/lib/market/types.ts:14` | Persists Gate.io, Binance, Bybit, OKX, Coinbase or mock. Selection does not switch the gateway process |
| Discovery | `src/hooks/use-contract-catalog.ts:29` → `src/app/api/contracts/route.ts:15` → gateway `/contracts` | Route accepts a matching upstream catalogue, verifies only Gate.io/Binance, otherwise returns unverified static references at line 34 |
| Instrument metadata | `src/lib/market/instrument.ts:6` | Fetches/validates Gate.io and Binance USDT perpetuals, Bybit linear perpetuals and OKX linear USDT swaps. Other mappings throw. Metadata validates precision/multiplier rather than borrowing another venue's values |
| Symbol picker | `src/components/terminal/instrument-picker.tsx` (`useContractCatalogue`, `choose`, `BrokerDirectory`) | Shows reference/capability distinctions; a descriptive broker card does not establish a subscription |
| Historical chart | `src/components/terminal/terminal-chart.tsx:257` → `src/lib/market/bars-dedup.ts` → `/api/bars` | Chart reads selected/effective provider identity and verified history; fixture tests exercise refusal of wrong venue/product and cancelled-response handling |
| Live hook | `src/hooks/use-market-stream.ts:68`, `:160` → Socket.IO → `mini-services/market-data/index.ts:274` | Shared subscription and source filtering; gateway mismatch becomes unavailable. Main hook does not consume `public-stream.ts` |
| Live provenance/health | `src/lib/market/provenance.ts:12`, `:20`, `:25`, `:30`; hook `gatewayView` and `requestHealth` | Symbol normalization, gateway environment matching, foreign-event refusal and expiring per-stream health |
| Tape/DOM/footprint | `src/components/terminal/docking/orderbook-panel.tsx:17`; `src/components/terminal/terminal-chart.tsx:194`; `src/lib/market/order-flow-session.ts:59`, `:79`, `:109` | Shared observed trades/depth feed studies. Trade ring is bounded at 2,000; observed depth history is bounded at 120 frames (`order-flow-context.ts:40`) |
| Connection display | `src/components/terminal/data-connections-popover.tsx:31`, `:47`; `terminal-status-bar.tsx:32` | Uses actual hook health, but descriptive connector lookup falls back to first builtin when provider is absent from that catalogue; this can show mismatched descriptive information |
| Candle replay | `src/components/terminal/terminal-chart.tsx:202`, `:218`, `:319`; `tests/replay-lookahead.test.ts:6` | Candle cursor and two analytical cutoff checks exist. These do not establish synchronized tick/book replay or licensed historical depth |
| Download/import/cache | `src/components/terminal/quote-manager-dialog.tsx:85`, `:109`; `dataset-importer.ts:146`; `bar-cache.ts:71` | CSV OHLCV import and IndexedDB bar persistence; no inspected path establishes a durable live tick/MBO archive |
| Legacy optimizer history | `src/components/terminal/optimizer-dialog.tsx:58`; `panels/bottom-panel.tsx:95`; `multi-data.ts:44` | Calls provider-less cached history, currently Binance-specific. Distinct from the newer helper research dataset manifest |
| Helper research boundary | `src/lib/local-research/client.ts:48`; `dataset.ts:51` | Requests provider/product/symbol/range and validates retained dataset identity/hash. This does not prove a live tick feed or exchange entitlement |
| Native import/projection | `src-tauri/workstation-core/src/lib.rs:395`, `:467`; `native.rs:30`, `:98`; `apps/windows-host/src/local_scene_bridge.cpp` | Local import, segment integrity and exact chart scene marked `verified imported history`. No new native live-provider acceptance is established by this audit |

## Provider capability matrix

Legend: **I** implemented source, live behavior unverified; **D** declaration/interface/catalogue only in the inspected path; **U** explicitly unavailable/unsupported in that path; **?** unknown/no acceptance evidence; **O** observed runtime (scope must be named). A passing parser fixture is recorded separately and is not a live-provider O.

| Provider | Selection | Verified discovery via current API | Metadata + bars via current API | Main gateway trades / L1 / L2 | Separate browser stream source |
| --- | --- | --- | --- | --- | --- |
| Gate.io | I | I, matching gateway only | I / I | I / I / I | I, not main hook |
| Binance | I | I, matching gateway only | I / I | I / I / I | I, not main hook |
| Bybit | I | U, no gateway adapter | I / I | U / U / U | I; L2 fixture passes |
| OKX | I | U, no gateway adapter | I / I | U / U / U | I, not main hook |
| Coinbase | I | U, no gateway adapter | U / U (explicit perpetual-path refusal) | U / U / U | I; L2 fixture passes |
| MEXC | D in catalogue; not workspace allowlist | U | U / U | U / U / U | U |
| Deribit | D in ProviderId only | U | U / U | U / U / U | U |
| Databento | D in ProviderId only | U | U / U | U / U / U | U |
| Rithmic test/prod | D interfaces/form boundary | U | U / U | U / U / U | U; valid form returns 503 |

For Rithmic, `src/lib/market/provider.ts:62` declares lifecycle methods; the executable request boundary is `src/app/api/connectors/rithmic/route.ts`, which returns 503 and states kit/conformance prerequisites. Provider comment blocks are not evidence of concrete live classes. For Databento/Deribit/MEXC, a reference search in the inspected market/gateway scope found no serving adapter. Coinbase has a standalone candle helper, but that does not overcome the current chart API's explicit product refusal.

| Advanced capability / path | Current evidence |
| --- | --- |
| Individual/aggregate trade semantics | Source implementations vary by provider; catalogue has no equivalent granular entitlement contract. Must inspect the selected adapter before using prints for footprint interpretation |
| Order-level MBO on any named live provider | D in interface/type flags; U in actual current gateway/event path. Legacy depth and V2 snapshot/delta represent price levels, not order lifecycle |
| Historical ticks / historical depth for named live feeds | ? No accepted serving/recording path established by this audit |
| Durable tick/book recording and synchronized replay | ? V2 has recording/transport declarations, and local storage/import exists, but inspected declarations/candle replay do not establish a live-event archive integration |
| Live options/Greeks | D capability vocabulary in V2; U in the inspected public provider route and legacy instrument metadata |
| Native external live feeds | ? Native imported-history projection inspected; no connected external provider observed |
| Local simulation gateway | O: isolated process, Socket.IO handshake, subscription bound, reconnect and cleanup exercised by tests |
| Authenticated/live exchange/runtime UI acceptance | ? Not run, including for Gate.io/Binance |

## Catalogue mismatch

- `src/lib/market/types.ts:12` has more provider IDs than the selectable list at line 14.
- `src/lib/market/capabilities.ts:35` advertises Gate.io/Binance as active and Bybit/OKX/MEXC as catalogued; Coinbase is omitted even though it is selectable. This catalogue drives `/api/providers` (`src/app/api/providers/route.ts`) and broker-directory presentation.
- `src/lib/market/connectors.ts:102` lists Gate.io, Binance, simulation and local datasets only, with static connection-status fields. It drives the connection popover's descriptive fallback at `data-connections-popover.tsx:47`.
- The main gateway serves a single configured provider and cannot make the broader catalogues operational. Capability presentation should be reconciled with actual serving path, not by simply changing labels to active.

## Contract and session limitations

| Concern | Current evidence | Requirement before expanding |
| --- | --- | --- |
| Prices, IDs and time precision | Legacy `types.ts:74` uses numeric price/sequence and epoch milliseconds. `contracts-v2.ts:32` uses strings, nanoseconds and explicit event IDs | Preserve source precision at the owning boundary; do not round 64-bit IDs/nanoseconds through JS numbers |
| Unknown aggressor | Legacy `Aggressor` alias allows unknown but `TradeEvent.side` at `types.ts:84` uses buy/sell `Side`; V2 trade side includes unknown | Do not force unclassified prints into a buy/sell bucket when adding a feed |
| MBP vs MBO | Legacy `DepthLevel`/`DepthEvent` (`types.ts:105`) and V2 books (`contracts-v2.ts:46`) contain price-level quantities; no order-ID lifecycle | A subscription string `mbo` in `provider.ts:32` does not deliver MBO. Retain order-level semantics separately if required |
| Spot/options and currencies | `types.ts:49` product permits future/perpetual/equity/index; currency permits USD/USDT | Scope a deliberate metadata extension for selected spot/options/non-USD instruments; Coinbase must not masquerade as a perpetual |
| Legacy session math | `session.ts:14` fixed EST offset and simplified weekday schedule. `classifySession` consumers found in mock provider; `alignToTimeframe` also used by history/chart code | Trace the selected feed's actual session/trading-date consumers; do not assert all chart sessions are fixed EST |
| Session UI | `market-sessions.ts:136` uses IANA zones and checks weekdays/maintenance; consumed by `market-sessions-popover.tsx:28` | Existing DST-safe UI is not a venue holiday/early-close calendar or a contract-specific live schedule |
| Nonpositive prices | `chart-data.ts:5` requires positive OHLC in `isRenderableBar` | Determine instrument policy before advertising markets that can legitimately contain zero/negative values |
| Research cache identity | `bar-cache.ts:52` symbol/timeframe/time index; `cached-bars-provider.ts:42` fixed Binance retrieval | Partition provider/product identity through readers/writers if used across feeds; migrate or quarantine old ambiguous cache entries |

V2 is a useful existing boundary, but reference searches did not establish a live V2 provider wired through the main legacy hook. A schema's precision and capabilities do not prove adoption by all consumers.

## Baseline verification

Command run from the checkout:

```powershell
node --import tsx --test tests/provider-provenance.test.ts tests/market-identity.test.ts tests/provider-l2-sync.test.ts tests/market-sessions-and-connectors.test.ts tests/microstructure-contracts.test.ts tests/replay-lookahead.test.ts tests/order-flow-integrity.test.ts tests/gateway-recovery.test.ts
```

Result: **40 tests passed, 0 failed, 0 skipped**, exit code 0, reported duration 6,506 ms. Tests were read to establish what they cover, rather than treating their names as acceptance proof.

- Provider identity tests use stubbed REST responses and local socket servers; they verify native instrument routing, refusal of equity/future selections on crypto paths, no cross-venue history retry and cancellation/provenance behavior.
- Bybit/Coinbase L2 tests call the separate browser provider parser with snapshot/delta/duplicate/gap fixtures. They do not connect these providers to the main hook.
- `gateway-recovery.test.ts:61` launches the actual gateway in explicit mock mode on an ephemeral port; its companion test at line 112 exercises the canonical shared client against a local server. This is observed simulation/local transport, not live exchange data.
- MBO precision/replay checks are shared synthetic fixture checks; two analytical cutoff checks do not prove a complete tick/book replay engine.
- Expected headless-environment output included Zustand persistence-unavailable warnings and Node's experimental MockTimers warning. These did not fail tests. Browser storage/UI and external exchange behavior remain unverified.
- No build/typecheck/lint or broad UI/performance suite was run: application code was unchanged, and those checks would not resolve the source-routing questions. No deployment or authenticated sessions were attempted.

## Prioritized gaps and next step

1. **High: unsupported selected-provider live path.** Bybit/OKX/Coinbase selection is broader than the gateway. Complete one coherent provider through serving, catalogue, history, source identity and UI status instead of treating the unused browser class as integrated.
2. **High for research users: legacy cache provenance.** Optimizer/download/import history can share a symbol-keyed cache while retrieval is Binance-specific. Bound any later fix to these actual consumers; preserve the stronger chart-history behavior already tested.
3. **Medium: capability/catalogue contradictions.** UI provider lists and descriptive popover information can disagree. Update only claims affected by an actual verified integration.
4. **Expansion prerequisites: precision, product identity, sessions and MBO lifecycle.** Databento/Rithmic/options cannot safely be enabled by adding provider IDs or bypassing route refusals.
5. **Acceptance gap: live/native/browser/long-run evidence.** Local unit and gateway simulation checks leave these explicitly unverified.

The smallest independently useful implementation candidate is **Bybit USDT linear perpetual completion**, because verified metadata/history helpers and L2 parser fixtures already exist while its serving gateway path is absent. OKX has similar groundwork but adds swap contract-unit handling; Coinbase requires a distinct spot metadata/history model and is not an interchangeable shortcut. This is a provisional engineering recommendation, not a selected paid vendor or authorization to skip stages 2–3.

Acceptance for that candidate: one explicit instrument discovered from real provider metadata; bars and main-hook trades/L1/L2 retain the same provider/instrument/units; source-specific snapshot recovery and stale/unavailable states; no fallback; existing Gate.io/Binance regressions pass. Public read-only live and browser evidence must be recorded separately from fixtures.

## Handoff

Stage 1 is complete. Files added: this baseline and its starting Git-status evidence. Application code/tests/dependencies were not edited. Next: stage 2 provider/commercial comparison, using the corrected gateway and Coinbase findings above. Stage 3 must resolve market, client/distribution model and budget before committing to a paid provider. The overall data-feed goal remains open; neither a new live feed nor production readiness has been delivered.
