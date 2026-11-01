# First additional feed: Bybit linear perpetual gateway

Stage 3, 2026-10-30. Inputs: [01-baseline.md](01-baseline.md), [02-provider-comparison.md](02-provider-comparison.md). Status: working default specification; no paid vendor, purchase, redistribution model or production launch is selected. If the user chooses a different first feed, replace this target before its dependent implementation. API-and-interface-design instructions were read to keep the adapter within existing contracts.

## Decision and alternatives

Target the existing web terminal's **Bybit USDT linear perpetual** path first, using BTCUSDT as the initial runtime acceptance instrument. Support catalogue discovery for qualifying contracts, but keep live acceptance claims bounded to instruments actually exercised. Environment: public mainnet read-only data; test fixtures are explicitly synthetic. Native live integration and the paused native-parity project are outside this slice.

The user was asked whether to prioritize Bybit, Databento or Rithmic. No response has been received at this writing. Bybit is a reversible engineering default drawn from the verified baseline, not an inferred preference for a paid feed. Personal/customer distribution, user count and budget remain unresolved for future commercial deployment. This slice must not publish or redistribute a new hosted feed.

Options considered:

1. Wire the standalone browser provider into the canonical hook. This creates two serving/health paths and leaves discovery/gateway mismatch unresolved. Defer.
2. Add one provider to the existing persistent market gateway. Reuses the hook, socket contract, UI, subscriptions and health path. **Selected for the initial implementation.**
3. Design a general multi-vendor gateway/plugin framework. Not justified for a single missing adapter. Defer.

One process continues to serve one configured provider. Selecting another venue in the UI must remain unavailable when that process does not serve it; automatic switching, multi-process routing and silent fallback are not added.

## In scope

- Bybit public linear REST discovery with pagination and strict filtering for currently trading USDT linear perpetuals; exact tick/quantity increments and product identity.
- Existing verified Bybit candle route, reused and regression-tested rather than replaced.
- Persistent public WebSocket subscription for standard-depth L2 and public trades. Derive best bid/ask from a valid reconstructed book where appropriate; avoid inventing sizes from ticker-only values.
- Gateway discovery/subscription/health/shutdown integration, matching contract verification and capability presentation.
- Main-hook/DOM/tape/footprint consumption through the existing normalized event path; tests must demonstrate actual source delivery through that path.
- Bounded state, subscription restoration, stale/disconnected handling, invalidation on malformed/reset/inconsistent books and honest unsupported capability states.

Excluded: MBO/full-depth channel, new spot/options model, arbitrary currencies, historical tick/depth recording, synchronized book replay, execution, liquidation channels, account/private endpoints, additional vendors, native UI, paid access and deployment. Existing Bybit funding/OI catalogue claims must not become a promise of subscribed derivatives data unless it is actually supplied and verified in the chosen slice; reduce only directly affected claims if necessary.

## Existing boundaries and expected file changes

| Boundary | Proposed work | Verification |
| --- | --- | --- |
| `mini-services/market-data/bybit-provider.ts` (new) | One concrete adapter matching existing discovery/subscribe/health/close lifecycle | Official-shaped REST/WS fixture tests, deterministic recovery and malformed-input cases |
| `mini-services/market-data/index.ts` | Add explicit Bybit mode, events, discovery, subscription dispatch and shutdown | Isolated gateway test configured for Bybit against controlled upstreams; foreign-provider requests still refused |
| `src/app/api/contracts/route.ts` | Recognize qualifying Bybit catalogue only when upstream provider/environment/contracts match | Route tests for valid/mismatched/unverified response |
| `src/lib/market/types.ts` if necessary | Add optional source event identity fields only if required to retain Bybit IDs without breaking consumers | Two trades sharing a source cross-sequence are retained separately; string IDs survive socket serialization |
| `src/lib/market/capabilities.ts`, `connectors.ts` | Correct directly affected Bybit availability/capability descriptions | Descriptive UI agrees with actual configured serving path; no hardcoded claim of current connection |
| Existing Bybit REST/history and stream consumers | Reuse; modify only where actual integration requires it | History metadata/units and no-fallback regressions |
| `.env.example` and development documentation, if needed | Document explicit provider mode and required public endpoint configuration | Reproducible local startup without exposing credentials |
| `tests/bybit-*.test.ts` (new focused tests) | Cover source semantics and serving lifecycle | Failing reproducer first, then passing implementation; no mirroring-only assertions |

Inspect live file contents and dirty diffs before editing. Existing modifications are not ours to reset or commit. No refactoring of Gate.io/Binance adapters merely to make their code resemble Bybit.

## Data semantics

- Provider `bybit`, exchange `BYBIT`, product `perpetual`, quote/settlement USDT. Validate `category=linear`, contract type/status and provider-native symbol. A symbol ending USDT alone is insufficient proof.
- Preserve tick size, quantity step, quantity unit and multiplier from the applicable verified metadata. Verify whether the selected linear trade size is base quantity; do not borrow inverse-contract units. Scope numeric conversion to the legacy display boundary and fail on unsafe/non-finite values.
- Preserve the source string trade ID. A Bybit trade cross-sequence can describe ordering context and must not be assumed to be a unique trade ID. The existing `OrderFlowSession.pushTrade` deduplicates by numeric `sequence`, so use a documented adapter-local monotonically increasing sequence if needed, while retaining source ID/sequence separately. Never claim that generated delivery order is an exchange sequence.
- Only map validated Buy/Sell taker sides; malformed/unknown sides must not become fabricated buys/sells. If meaningful unknown-side data is encountered, retain it through an appropriate existing lossless boundary or explicitly mark unsupported; do not widen the entire legacy pipeline speculatively.
- Preserve source event time separately from local receipt time where required for health. Exchange timestamps determine event identity; local receipt/freshness is not a measured one-way network latency.
- Trades are individual executions only if official channel semantics support that claim. Distinguish message batching from trade aggregation. Mark block/special trade conditions when supplied and define study inclusion explicitly.
- L2 remains market-by-price. Do not claim MBO, queue position or historical depth. Use normal standard-depth snapshot/delta rules; do not import the full-depth channel's bootstrap protocol.

## Lifecycle and state transitions

1. Gateway discovery loads bounded pages of qualifying contracts and rejects failed/invalid responses. Never emit a verified empty or partially failed catalogue as complete.
2. A valid client subscription must name a discovered instrument and match gateway provider. Retain existing client/subscription bounds and reference counting.
3. Subscribe to the required public topics on an open socket and track subscription rejection. Connected transport alone does not mean live trade/book streams.
4. Initial book is syncing. A valid snapshot replaces prior state atomically; standard-depth deltas update quantities and remove zero sizes. No delta may bootstrap an absent book.
5. Use the chosen channel's documented update/reset rules. Reject older/duplicate/inconsistent data as appropriate. Cross-sequence ordering is not automatically a contiguous message count. Do not claim detection of every lost message where the protocol does not expose a continuity proof.
6. On reset, socket generation change, invalid book, unsubscribe or timeout, withhold old depth and expose syncing/stale/disconnected state. Recover through a fresh valid snapshot and subscription restoration. Bound retries and suppress stale async callbacks after close/new generation.
7. Keep trade and depth freshness separate. No-trade intervals can make tape stale while a valid depth stream continues; one healthy stream cannot certify another. Health polling must not invent observations.
8. Teardown removes timers/listeners/subscriptions, closes socket and prevents reconnect after explicit close. History/UI selection cannot silently change the active venue.

## Implementation slices

1. Reproduce the missing serving path and source semantics in tests. Validate discovery paging/filtering and the trade-ID/cross-sequence issue.
2. Implement the concrete adapter and deterministic upstream fixture acceptance. Verify snapshot/delta/reset, bounded dedupe, malformed messages, per-stream health and teardown.
3. Wire it into the existing gateway and contract route. Exercise a real isolated gateway process with controlled public-protocol fixtures.
4. Correct directly affected capability/help/config text. Run focused regressions for Gate.io/Binance and canonical hook provenance.
5. Run a bounded public read-only probe if network/region permits, then browser acceptance using the installed browser workflow if available. Report restrictions/failures without switching domains to evade access controls or substituting another feed.

## Acceptance matrix

| Requirement | Proof required |
| --- | --- |
| Discovery and identity | Paged fixtures with mixed USDT/USDC/inverse/delisting records; only valid qualifying contracts admitted; malformed/failed pages do not yield trusted partial success |
| History | Selected Bybit symbol/metadata/units, valid requested timeframe/range, no fallback; existing route fixture coverage passes |
| Trade integrity | Two distinct IDs with same source sequence both delivered; duplicate ID suppressed; source identity preserved; invalid price/size/side refused; stale generation cannot publish |
| L2 integrity | Snapshot replacement, update/delete, duplicate/old event behavior, documented reset and no-delta-before-snapshot; crossed/malformed books withheld and recovery verified |
| Gateway wiring | Actual gateway process configured Bybit discovers contracts, accepts matching subscription, emits provider-correct events/health and rejects foreign provider; unsubscribe/close releases state |
| UI integration | Main terminal uses existing hook; same selected instrument reaches chart, tape, DOM and relevant order-flow views; unsupported panels remain unavailable; connection status matches data freshness |
| Regression | The stage-1 40-test selection plus directly affected adapter/route tests pass; run appropriate type/lint/build checks once code changes exist |
| Runtime scope | Fixture, local gateway, public-live and browser evidence listed separately; a blocked live probe is unverified, not a pass |
| Performance | Document workload, duration, machine/runtime, event processing/queue/memory behavior. Do not infer production capacity from fixtures. Establish missing thresholds before assigning performance pass/fail |
| Security/access | No secrets or private endpoints; no new trading paths, purchase, agreement, vendor message or production redistribution |

## Open decisions and rollback

The user's first-feed preference remains steerable. Paid futures providers, user/account model, commercial reuse rights and launch budget are not resolved by this spec. None is needed to implement an isolated read-only technical adapter and synthetic tests; they are gates for the corresponding commercial/runtime use.

Rollback is local and additive: disable explicit Bybit gateway configuration and revert only this task's owned changes. Do not reset the checkout or undo unrelated provider repairs. Keep existing Gate.io/Binance defaults and unavailable-on-mismatch behavior unless a directly scoped requirement demands otherwise.

## Sources and handoff

Official source links/access record: stage 2 B1–B3. Before coding further endpoints/fields, read the relevant current Bybit connection, heartbeat and limit documentation, and installed Next.js guides for any edited route. Source sequence guarantees and linear quantity units need targeted confirmation before tests codify them.

Stage 3 contract/specification is recorded. No application code or tests changed in stages 1–3. Next implementation stage is Prompt 4 using this Bybit working target unless the user steers otherwise. Required deliverable: `04-crypto-acceptance.md`, followed by the relevant stage-8 integrity/readiness audit. Databento/Rithmic/alternative-provider stages remain conditional branches, not an instruction to integrate every vendor.
