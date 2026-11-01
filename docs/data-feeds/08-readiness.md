# Bybit first-feed readiness audit — stage 8

2026-10-30, Asia/Baku. Scope: the Bybit USDT linear perpetual integration specified in stage 3, with source/fixture, public BTCUSDT and local browser evidence separated below. Stages 1–4 and this selected-provider audit constitute the first implementation pass. Stages 5–7 are conditional alternatives; no paid futures vendor or additional asset class was selected.

## Outcome

**The first additional feed works locally through ZTerminal's existing gateway and browser.** Matching Bybit history, live trades, L1/L2, DOM, rolling CVD/delta and footprint were observed for BTCUSDT. Recommend retaining this as a locally verified implementation for review. Production deployment, redistribution approval and a broader operational soak remain separate gates; nothing was deployed or merged.

## Requirement audit

| Requirement | Result | Authoritative evidence / practical limit |
| --- | --- | --- |
| Current baseline and provider comparison | Complete | `01-baseline.md`, `02-provider-comparison.md`; current adapter/consumer paths checked rather than trusting provider IDs |
| Bounded implementation contract | Complete | `03-integration-spec.md`; one Bybit linear-perpetual gateway path, not a generic new connector framework |
| Discovery/identity | Pass, fixtures + public | Cursor pagination/filtering/precision/failed-page tests; public adapter discovered 815 qualifying contracts. Only BTCUSDT received live runtime acceptance |
| Matching history | Pass, scoped | Existing route tests and local browser `/api/bars?provider=bybit&symbol=BTCUSDT`; browser provenance showed bybit/bybit, perpetual, base volume and matching source timestamps |
| Trade identity and classification | Pass, scoped | Distinct IDs sharing a cross-sequence survive; duplicate IDs are suppressed; unsafe/malformed IDs, sequence, side, price and size rejected. Bybit's documented taker sides are mapped; unknown side is not fabricated |
| L1/L2 | Pass, scoped | Snapshot, delta, delete, duplicate/older message, reset, stale state and reconnect fixtures; public live DOM has both bid/ask prices and sizes |
| MBP/MBO distinction | Pass | Only price-level depth advertised. No MBO lifecycle, queue-position, tick archive or historical-depth claim |
| Initial subscription readiness | Pass, regression | Actual gateway test holds discovery unfinished and asserts no subscribable provider identity; releasing discovery publishes identity and enables the subscription |
| Canonical consumer path | Pass, integration | `bybit-gateway.test.ts` uses `subscribeMarketTrades` from the actual terminal hook against the child gateway; receives matching source IDs and resumes after an upstream connection closes |
| Provider separation | Pass, fixtures + browser | Foreign Binance subscription rejected; original browser Gate.io selection against Bybit gateway was unavailable instead of silently substituted |
| Visible health | Pass, local browser | Inspector shows Bybit/Bybit/Bybit and individual trades; old waiting reason clears when live. Controlled gateway stop withholds live book and reports disconnected |
| Browser rendering | Pass, scoped | Local Chrome 156 via browser-harness, 1536 CSS-pixel viewport; actual chart, live order book, CVD and footprint outputs. Screenshot path below. No standalone tape component exists in the inspected terminal tree, so its separate rendering is not claimed |
| Recovery visibility | Pass with limit | Source/fixture transport recovery verified; live view recovered after resuming the minimized Chrome window. Timely reconnection while the OS keeps Chrome minimized/frozen is not established |
| Deterministic replay | Pass, synthetic input | `bybit-replay.test.ts` replays identical permitted synthetic input twice and compares trades, book, footprint and CVD; includes duplicate/older deltas. This is not a new product-level historical book replay feature |
| Buffer bounds/load | Pass for invariants; measurements informational | Loopback run below delivered all input and retained the specified 2,000 trades / 120 depth frames. No agreed production performance threshold or long-run capacity claim |
| Sessions/calendar | Applicable scope covered | Crypto source remains 24/7; no exchange holiday/DST calendar introduced. Stage-1 futures-calendar limitations remain outside this crypto slice |
| Price/quantity precision | Pass within legacy boundary | Metadata validates increments and finite values; string source IDs/sequences retained. Existing numeric display/analytics values are not a complete lossless V2 transport |
| Unsupported features | Explicitly excluded | Funding/OI/liquidation capability claims removed from Bybit card; no such subscriptions, MBO, options or private trading operations added |
| Security/access | Pass for scoped code review | Public instrument/WebSocket endpoints; commands subscribe/unsubscribe/ping; no API keys, account login, trading privileges or secret persistence. Vendor data shape/size, bounded IDs and frame sizes checked |
| Existing regressions | Pass | Full repository test suite passed 358 tests; targeted canonical/gateway recovery cases also passed after the readiness fix |
| Build/type/lint | Pass / documented warnings | Typecheck and targeted ESLint pass; repository lint has 0 errors and 10 unchanged-file unused-disable warnings; production build and Monaco packaging pass. Command logs retained below |
| Commercial/public deployment | Unverified, outside local delivery | No applicable new redistribution agreement or production entitlement audit. No vendor contact or purchase; personal/API access is not treated as a license grant |
| Native acceptance / additional vendors | Not selected | No Windows native live-feed implementation, Databento/Rithmic SDK integration or extra provider branch claimed |

## Review findings and corrections

1. **Reset ordering:** a reset delta could be treated as merely an old update before invalidating the book. Failing test added; reset check moved before ordering checks.
2. **Malformed quantity:** empty size could become numeric zero and delete a level. Failing test added; blank price/size strings refused.
3. **Bounded trade identity:** an oversized source ID could grow retained state disproportionately. Failing test added; source ID length bounded at 128, deduplication window at 4,096 per instrument.
4. **UI capability label:** inspector called Bybit trades unavailable even with live individual prints. Rendering regression and one-line provider label fix added.
5. **Stale wait reason:** merged gateway state retained the old reason when a new live message omitted it. Canonical-state regression added; reason now belongs to the incoming state transition.
6. **Startup subscription race:** a gateway could identify its serving provider before contract discovery completed. Early subscription failed, with no readiness transition to trigger the intended first subscription. Controlled-discovery test added; identity is withheld until initialized and readiness emits a fresh state.
7. **Test deadline:** one test waited 4 seconds for a reconnect whose deliberate backoff was itself 4 seconds, causing a full-suite boundary failure. The test now allows acknowledgement time (6 seconds) and explicitly waits for subscriptions. Production retry timing was not weakened.

Review used the installed code-review-and-quality, TDD, incremental implementation, API/interface and Ponytail guidance. No new dependency, universal adapter framework, drive-by cleanup or unrelated source migration was introduced.

## Public and browser observations

- Initial explicit live smoke: 815 contracts; 28 trades, 50 quotes and 50 depth events in 2,602 ms; BTCUSDT trades/depth LIVE, zero reconnects during that interval.
- A later actual local gateway/browser observation counted 5,644 trades and 9,785 quote/depth events, with BTCUSDT LIVE and zero adapter reconnects at that observation. Counts are snapshots, not an audited trading session.
- Browser structured checks confirmed the corrected individual-trade label, no stale wait reason, CVD heading, footprint heading, 632 footprint rows and individual/base quantity summary at capture. The chart/DOM screenshot was visually inspected.
- On a task-owned gateway stop, the live DOM disappeared and the inspector showed disconnected/effective unavailable. The browser window was minimized during part of recovery; after resuming it the live Bybit view returned. Synthetic canonical-client recovery is separately deterministic and passing.
- Initial browser navigation/commands sometimes exceeded the harness's five-second response timeout during compilation/background-window operation. Existing task tab was rechecked rather than duplicated. Recording stayed off; unrelated tabs were preserved.

Evidence directory:

`C:\Users\aykhank\.codex\visualizations\2026\10\30\01a18c8d-5db9-7d50-85e0-133934062c4b`

Artifacts: `bybit-ui-verified.png`, `bybit-load.json`, `bybit-full-tests.log`, `bybit-full-lint.log`, `bybit-build.log`, pre-edit copies under `bybit-before/`, and the task-attribution patch. Screenshots/aggregate counts are local evidence, not a raw feed recording or external publication.

## Bounded load measurement

Command: `node --import tsx tests/benchmark-bybit.ts` (opt-in, outside offline test discovery).

Machine: Windows 11, Intel Core i5-1335U, 12 logical CPUs, Node 22.23.2. Synthetic loopback WebSocket → Bybit adapter → real `OrderFlowSession`. Workload: 100 batches, 250 unique trades and two book updates per batch, 100 ms between batches. Producer/consumer share the machine and process; timestamps are local wall-clock milliseconds.

| Observation | Result |
| --- | --- |
| Duration | 10,553.5 ms |
| Delivered trades | 25,000 of 25,000 |
| Delivered book updates | 200 of 200 |
| Average delivered rate | 2,368.9 trades/second including configured pacing |
| Local timestamp-to-handler p50 / p95 / max | 2 / 4 / 7 ms |
| Peak producer backlog | 250 trades, one injected batch |
| Peak WebSocket buffered bytes sampled | 0 |
| Retained trade / depth histories | 2,000 / 120 |
| Heap initial / sampled peak / final | 11,568,264 / 27,836,656 / 16,892,088 bytes |
| RSS initial / sampled peak / final | 72,773,632 / 97,599,488 / 77,180,928 bytes |

This shows bounded retained state and complete delivery for this paced workload. It does not prove maximum throughput, a memory plateau over hours, multi-user capacity, slow-client behavior or vendor/network latency. No missing performance threshold was invented to label production performance a pass.

## Runnable checks and ownership

```powershell
npm test
npm run typecheck
npm run lint
npm run build
node --import tsx --test tests/bybit-gateway.test.ts tests/bybit-provider.test.ts tests/bybit-feed-status.test.ts tests/bybit-replay.test.ts
node --import tsx tests/live-bybit-smoke.ts
node --import tsx tests/benchmark-bybit.ts
```

The last two are explicit network/measurement commands, not part of offline `npm test`. Live check uses public data; benchmark is synthetic. Expected headless persistence/MockTimers warnings are scoped in the logs. An initial full-suite run exposed the test deadline and the new feed-status test's undeclared runtime reason-field typing; both were corrected and rerun, rather than counted as successful checks.

Task ownership extends the stage-4 list with `tests/bybit-feed-status.test.ts`, `tests/bybit-replay.test.ts`, `tests/benchmark-bybit.ts` and the two one-line consumer fixes. Concurrent unrelated chart credits/licenses/sidebar/adapter work appeared during this resumed session; it was not edited, staged or attributed to the feed task. Existing staged/unstaged work was preserved; no commit, merge or deployment occurred.

## Release recommendation and remaining gates

The requested first implementation pass is reviewable and locally verified. Keep the existing deployment unchanged. Before a public rollout, establish the actual distribution rights/user model, validate intended regions and symbols, agree performance/soak thresholds, and test a representative longer session with slow clients and operating-system background behavior. Those are production gates, not an assertion that every conditional provider prompt was executed.

The provider-less legacy optimizer cache, options metadata, MBO lifecycle and native feed route identified in the baseline remain separate work. Add another vendor only after selecting its target market/access model; do not infer that Databento/Rithmic commercial prerequisites were satisfied by this Bybit work.
