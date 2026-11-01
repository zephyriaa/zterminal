# OKX continuation

2026-10-30, Asia/Baku. Authorized by the user's request to continue the data-feed work. Target: the next prepared public feed, OKX linear USDT swaps, through the existing single-provider gateway. Paid futures, native live connectors, execution and deployment are not selected.

## Contract and verification plan

1. Discover only live SWAP/linear/USDT-settled instruments with a base-currency contract value and valid tick/lot/multiplier. Verify exclusions and failed-response behavior.
2. Subscribe to public JSON `books` and `trades`; reuse the existing depth synchronizer. Enforce snapshot/`prevSeqId` linkage, no-change updates and maintenance sequence resets. Modern zero checksum is deprecated, not a CRC verification result.
3. Preserve source trade ID and sequence strings. The `trades` channel aggregates matches: label it aggregate, retain native contract quantities and apply `ctVal * ctMult` for quote notional. Do not label contract counts as base quantity or individual fills.
4. Integrate discovery, serving, health, shutdown, catalogue and inspector into the existing gateway/hook. Test real isolated gateway and canonical-client delivery, source mismatch, reconnect and malformed frames.
5. Run relevant/full checks, a bounded public read-only probe and local browser acceptance where available. Record each evidence scope separately. Keep production unchanged and preserve unrelated working-tree changes.

Official documentation read live: [OKX V5 JSON market-data documentation](https://www.okx.com/docs-v5/en/#order-book-trading-market-data-ws-order-book-channel), [public trades](https://www.okx.com/docs-v5/en/#order-book-trading-market-data-ws-trades-channel), accessed 2026-10-30; additionally queried through Context7's official `/websites/okx_docs-v5_en` source. SBE/private/VIP channel semantics are not substituted for public JSON.

Pre-edit copies are under the task visualization directory's `okx-before/`, including the starting Git status. Existing Bybit work is retained.

## Delivered implementation

- `mini-services/market-data/okx-provider.ts`: read-only public linear USDT swap discovery, validated contract metadata, `books` and `trades`, native contract units, string source trade IDs, bounded deduplication, per-stream freshness, acknowledgement/heartbeat monitoring, reconnect/resubscribe and teardown.
- Gateway integration reuses the existing data-event handler for Bybit/OKX and keeps one configured serving provider per process. Contract discovery/verification, capabilities, builtin connector and inspector are wired to the actual OKX path.
- The shared OKX depth synchronizer now recognizes modern deprecated zero checksums while requiring sequence fields. It preserves `prevSeqId` linkage, no-change packets and maintenance resets. Legacy nonzero checksum validation remains; no modern zero is claimed as successful CRC integrity verification.
- The new gateway bounds retained book state to 400 levels per side. Delivery sequence is adapter-local and monotonic; source sequence is retained separately, so maintenance sequence resets do not break existing observed-book consumers.
- Aggregate trade messages retain contract quantities and metadata multiplier rather than being relabelled base assets/individual fills. Capability text does not advertise unsubscribed funding/OI/liquidation feeds.
- Default WebSocket endpoint uses port 443, `wss://ws.okx.com/ws/v5/public`. Informational notice 64010 (port 8443 retirement) does not close a connection; upgrade notice 64008 triggers recovery. This distinction was verified against the live protocol and official docs, then covered by a failing/passing regression.

## Verification

| Check | Result and scope |
| --- | --- |
| Offline tests | `npm test`: **363 passed, 0 failed, 0 skipped**; includes five new OKX tests plus existing Bybit and other regressions |
| Provider fixtures | Eligible product filtering, multiplier/tick/lot metadata, large string IDs, aggregate notional, no-change/reset/gap handling, reconnect and zero-checksum continuity verified |
| Actual gateway process | Controlled HTTP/WS upstreams; source-correct contract/trade/quote/depth/health, foreign-provider rejection and matching catalogue verified |
| Typecheck | `npm run typecheck` passed |
| Lint | Targeted files passed; full `npm run lint` passed with 0 errors and 10 existing unused-disable warnings |
| Build | `npm run build` passed, including TypeScript, static generation, standalone packaging and 121 Monaco asset/license checks |
| Public adapter | `node --import tsx tests/live-okx-smoke.ts`: **517 eligible contracts, 10 trade messages, 62 quote/depth events in 8,376 ms**, BTC-USDT-SWAP LIVE, multiplier **0.01**, no reconnect during that interval |
| Public instrument/history helpers | Existing `fetchInstrument('okx','BTCUSDT')` verified the swap/multiplier; existing history helper returned three requested 1-minute bars. No helper replacement was necessary |
| Public gateway/browser | Observed 409 trade messages and 202 book/quote events at one gateway sample; local browser showed matching OKX history, native swap identity, contract volume, live DOM and correct aggregate label |
| Observed studies | Structured browser checks passed for CVD, footprint and contract/aggregate summary; one capture had 901 retained messages and 639 table rows |
| Visual inspection | `okx-ui-verified.png` captured through browser-harness and inspected; recording stayed off; unrelated tabs untouched |

TDD evidence includes the initially missing gateway/adapter failures, the modern-zero-checksum failure, a missing-sequence refusal failure, and the informational-notice reconnect failure. Fixes were tested against these cases rather than weakening the expected result.

Initial public probing was not all green: the first adapter attempt received an informational retirement notice on 8443 and incorrectly reconnected, producing no usable observations. Direct protocol diagnosis established the cause; after migrating to the official 443 endpoint and distinguishing notices, the check passed. A separate Python HTTP probe received 403, while the actual Node instrument/history helpers succeeded; no alternate domain, credentials or access-control bypass was used. These differing access results are not treated as evidence of universal regional availability.

The first local page request/navigation exceeded a short timeout during Next compilation. The existing task tab was rechecked rather than duplicated. Provider selection was performed through the real UI. Actual browser provenance confirmed `okx / okx`, `BTC-USDT-SWAP`, perpetual and contract volume; Bybit history was not silently reused as OKX history.

## Evidence and local use

Evidence directory: `C:\Users\aykhank\.codex\visualizations\2026\10\30\01a18c8d-5db9-7d50-85e0-133934062c4b`.

Artifacts: `okx-tests.log`, `okx-lint.log`, `okx-build.log`, `okx-ui-verified.png`, pre-edit copies under `okx-before/`, and the task-attribution patch. Public observations were summarized; no raw live feed archive or external publication was created.

```powershell
$env:MARKET_PROVIDER = "okx"
npm run market-data
```

Use the existing local web startup and choose OKX. One gateway serves one configured provider; selecting Bybit against an OKX gateway remains unavailable, not a transparent source substitution. Do not terminate an unrelated service to reuse port 3003. Endpoint overrides are documented in `.env.example`; the public check is opt-in:

```powershell
node --import tsx tests/live-okx-smoke.ts
```

New files: the OKX provider, `tests/okx-provider.test.ts`, `tests/okx-gateway.test.ts`, `tests/live-okx-smoke.ts`, and this report. Existing modifications are limited to the gateway, shared OKX synchronizer, contract route, capability/connector descriptions, inspector and `.env.example`. No new package/lockfile, trading/account path, deployment or native live connector was added. Pre-existing/concurrent unrelated work remains untouched and unstaged.

## Readiness limits

This is a locally verified second public feed. Live acceptance is scoped to BTC-USDT-SWAP, not all 517 discovered instruments, every region or a full trading session. No new OKX load/soak or native-device acceptance is claimed; Bybit's earlier synthetic performance results are not reused as OKX measurements. Legacy numeric display/analytics limitations remain; unsafe numeric source sequences are refused while source trade IDs remain strings.

MBO, historical tick/depth recording, individual-match reconstruction from aggregate messages, private channels, derivatives-context subscriptions and commercial redistribution are not implemented by this slice. A production rollout still needs its applicable rights, operational thresholds and longer-running acceptance. Temporary services and the task-created local browser tab are stopped/closed after verification; source and evidence remain saved. Nothing is deployed, merged or committed.
