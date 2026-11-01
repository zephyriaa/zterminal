# Bybit crypto integration — stage 4

2026-10-30 (Asia/Baku). Working target from stage 3: read-only Bybit USDT linear perpetuals through the existing single-provider market gateway. **Adapter, gateway and scoped local browser acceptance delivered.** Final integrity/readiness evidence and limits are recorded in [08-readiness.md](08-readiness.md). No deployment, purchases, private account access, vendor messages or native-parity work occurred.

## Implemented behavior

- `mini-services/market-data/bybit-provider.ts`: paginated public instrument discovery; filters for Trading/LinearPerpetual/USDT quote and settlement; validates symbol, tick and quantity increments; rejects failed pages without publishing a partial catalogue.
- Standard 50-level public L2 and trade subscriptions. Valid snapshots replace the book; deltas update/delete levels. Reset/inconsistent/malformed books invalidate depth and reconnect for a new snapshot. Price-level state is bounded to 50 bids and 50 asks. This is MBP, not MBO.
- Each execution retains its string `eventId` and `sourceSequence`. The legacy consumer receives a distinct adapter-local numeric delivery sequence, avoiding dropped executions when several trades share a cross-sequence. IDs are bounded to 128 characters; deduplication retains 4,096 IDs per instrument, not a durable historical archive.
- Best bid/ask and sizes come from the validated reconstructed book. Trade quantity is marked base with multiplier one for the selected linear scope. Individual prints are labelled raw trade, with block/RPI flags preserved when supplied.
- Per-stream freshness, acknowledgement timeout, 20-second heartbeat, silent-connection timeout, bounded reconnect backoff, subscription restoration and teardown. Source timestamps remain distinct from local transport liveness; no one-way network latency claim is made.
- `mini-services/market-data/index.ts`: explicit Bybit configuration, lifecycle dispatch, source-correct trade/quote/depth events, catalogue and health integration. A process still serves one venue; foreign-provider requests remain unavailable.
- `/api/contracts` accepts the matching Bybit upstream catalogue. The Bybit capability card and builtin connector now reflect candles/trades/L1/L2 rather than promising unsubscribed derivatives/liquidations. The current browser hook and chart history route are reused.

## Files owned by this slice

New: `mini-services/market-data/bybit-provider.ts`, `tests/bybit-provider.test.ts`, `tests/bybit-gateway.test.ts`, `tests/live-bybit-smoke.ts`, this report.

Surgically modified: `.env.example`, `mini-services/market-data/index.ts`, `src/app/api/contracts/route.ts`, `src/lib/market/types.ts`, `src/lib/market/capabilities.ts`, `src/lib/market/connectors.ts`. Browser acceptance subsequently required two one-line fixes in `src/hooks/use-market-stream.ts` and `src/components/terminal/feed-inspector.tsx`, covered by `tests/bybit-feed-status.test.ts`. Optional source identity fields extend legacy events without changing existing callers. No package or lockfile changes were made by this slice.

Pre-edit copies of those eight existing files are retained outside the repository at:

`C:\Users\aykhank\.codex\visualizations\2026\10\30\01a18c8d-5db9-7d50-85e0-133934062c4b\bybit-before`

The checkout already had extensive unrelated modifications; Git diffs against HEAD include that earlier work. Comparison against these copies shows only the bounded feed changes. Existing CRLF conventions were preserved. No commits/staging/reset/stash were performed, so unrelated staged changes remain untouched.

## Verification evidence

| Check | Result and scope |
| --- | --- |
| Test-first discovery | Initial test failed because adapter was absent; pagination/filter and partial-failure tests then passed |
| Test-first streaming | Initial integration failed on missing subscribe; real local WebSocket fixture now verifies trades, duplicate IDs, shared cross-sequence, L2 updates, snapshot reset, stale streams, reconnect and unsubscribe |
| Reset regression | Authored failing case showed a reset delta was ignored by ordinary ordering checks; reset validation now precedes them |
| Malformed quantity regression | Authored failing case showed blank size could be coerced to zero/deletion; blank values are now refused |
| Identity bound regression | Oversized ID test failed before the 128-character validation; malformed side/size/price/unsafe sequence cases pass |
| Gateway serving | Actual child gateway process configured Bybit against controlled HTTP/WS upstreams discovers, streams trade/L1/L2, reports health and rejects Binance subscription |
| Catalogue/capability route | Matching Bybit catalogue is verified; directly affected capability lists match subscribed data |
| Full repository tests | Final audit `npm test`: **358 passed, 0 failed, 0 skipped**; scoped follow-up also exercises delayed discovery and the actual canonical shared subscription. See stage 8 for the final checks |
| Typecheck | `npm run typecheck` passed; final source recheck also passed |
| Targeted lint | All changed/new TypeScript files passed ESLint |
| Repository lint | `npm run lint` passed with 0 errors and 10 unused-disable warnings in unchanged files |
| Production build | `npm run build` passed compilation, TypeScript, page generation, standalone copy and 121-asset Monaco/license packaging verification. Later edits only added the tested parser input guards and associated test coverage; final source type/lint checks passed |
| Whitespace | Task-only added lines have no trailing whitespace; existing CRLF conventions preserved. Diff against HEAD also reports pre-existing `connectors.ts:3` header whitespace, confirmed in the pre-edit copy and left untouched |
| Public network metadata | BTCUSDT instrument HTTP request succeeded with retCode 0 |
| Public live adapter | `node --import tsx tests/live-bybit-smoke.ts` succeeded: **815 eligible contracts, 28 trades, 50 quotes, 50 depth snapshots, 2,602 ms**, both trade/depth health LIVE, no reconnect in that short interval |
| Browser UI | Local Chrome via browser-harness: matching Bybit chart/history, live DOM, individual-trade label, CVD/delta and populated footprint verified. Stale wait-reason display fixed and rechecked; no standalone time-and-sales panel is claimed |

Full test/lint logs are retained under the same visualization directory as `bybit-full-tests.log` and `bybit-full-lint.log`. The public smoke check reports counts/health only; no raw feed archive was created. These measurements describe the observed short session, not long-run capacity or exchange-wide acceptance.

## Local use

Run the gateway in a separate PowerShell terminal with the chosen mode:

```powershell
Set-Location C:\Users\aykhank\Desktop\Others\Projects\ZT
$env:MARKET_PROVIDER = "bybit"
npm run market-data
```

Use the project's existing local web startup and choose Bybit. The gateway defaults to port 3003; do not replace or terminate an unrelated running service. If using another port, configure the existing server-side `MARKET_GATEWAY_URL` and browser build-time gateway origin consistently. No API key is needed for these public channels. Public endpoints and override variables are documented in `.env.example`; overrides are intended for reviewed environments and local protocol fixtures, not regional-access circumvention.

The independent live smoke is opt-in and excluded from offline `*.test.ts` runs:

```powershell
node --import tsx tests/live-bybit-smoke.ts
```

## Remaining limits and handoff

- The user allowed Chrome remote debugging; browser-harness verified the local page with recording disabled. The browser had been minimized during parts of the restart check, affecting background reconnect timing; resuming its window restored the live view. No alternate browser automation was substituted.
- Stage 8 adds deterministic synthetic input replay, a bounded 10.55-second loopback load/memory measurement, actual shared-client fixture recovery and public gateway/browser observations. These do not establish long-run or production-distribution acceptance.
- Standard-depth sequence handling does not claim a universal proof of every lost application message; it follows the selected channel, with conservative invalidation/recovery on detectable inconsistency and transport changes.
- Legacy floating-point event values remain the existing display/analytics boundary. String source IDs are retained; this is not adoption of the full lossless V2 transport or an order-level archive.
- Bybit funding/OI/liquidations, other crypto providers, futures, options, native live feeds and commercial redistribution are outside this slice. The older provider-less research cache identified in stage 1 is unchanged and should not be advertised as a new multi-provider research path.

Stage 8 completes the selected local first-feed audit and records production gates. Paid-provider branches remain conditional on an actual user selection/access decision; they were not executed as though all vendors had been selected. No production release is recommended solely from the local checks.
