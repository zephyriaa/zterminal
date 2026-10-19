# Phase 01 handoff — local repair implemented; browser acceptance blocked

18 October 2026, Asia/Baku. The user explicitly instructed “move on to phase 1” after Phase 00 reported its browser blocker. That instruction authorized this phase despite the incomplete prerequisite. Phase 00 is **not** retroactively complete. Phase 01 is **BLOCKED for full acceptance**, with the local implementation and checks below finished. No Phase 02 work, deployment, commit, publication or production mutation was performed.

## Outcome and smallest coherent repair

- `/api/bars` no longer substitutes BTC for an unsupported symbol or a missing symbol. Equity/future names and malformed aliases receive explicit unavailable responses. Provider metadata must match the requested native instrument before history is fetched, and adapters receive that verified native symbol. A different venue or automatic mock result cannot be a transparent retry for a failed live instrument. Explicit mock requests remain supported and tested.
- Added one shared metadata resolver for the existing Gate.io, Binance, Bybit and OKX perpetual adapters. Binance/Bybit perpetual contracts and OKX linear USDT swaps are validated before use; OKX history uses the actual `-SWAP` native ID. Coinbase's existing spot adapter is not represented as a USDT perpetual: these requests are explicitly unavailable. Its promised integration remains unresolved, not deleted or certified.
- History includes the actual contract, exchange, product, tick, multiplier, available quantity increment and millisecond timestamp unit. The existing client cache rejects missing/foreign identity envelopes and carries contract metadata on cache hits. Its identity version excludes legacy provenance-free entries. Range-sensitive cache keys and historical pagination remain Phase 04 work.
- Extended the existing contract registry with provider-qualified entries and subscriptions, consumed by primary/secondary charts, document identity and order-book metadata. No second market-selection store or session owner was added. Unknown metadata lookups fail explicitly instead of returning BTC. Recovery offers an explicit user choice of BTC; it does not silently change the selected market.
- Static catalogue references are retained and marked unverified/unavailable rather than connected/live. Picker and broker wording distinguishes catalogue discovery from feed verification. Favorites/recent storage keys and saved entries are unchanged. Provider discovery now retains actual quantity increments where known.
- Primary/secondary documents use product and venue metadata rather than hardcoded perpetual/Binance identity. Provider metadata is required before live documents/drawings are used. Older identities remain stored separately with a recovery notice; no drawing is automatically reassigned to a different market. Persisted workspace migration preserves the selected market instead of resetting it to BTC.
- Charts/books/header labels use the provider tick, including non-power-of-ten ticks. Archived chart precision/multiplier/quantity use captured inputs; absent archived precision stays unknown and uses raw numeric formatting rather than current live precision. No archive was rewritten.

The history refusal to retry another venue/simulation overlaps a portion of F04/Phase 02, because a verified identity cannot safely survive a transparent instrument substitution. This does **not** execute or complete Phase 02: toolbar selection versus gateway state, stream/cache provenance, freshness and switching races remain its work.

## Verification

| Check | Result and actual scope |
| --- | --- |
| New regression before changes | Four initial identity regressions failed against the old source, retained in `evidence/regression-before.log`. |
| Final full TypeScript tests | **217 passed, 0 failed**, including 12 new market-identity tests. `evidence/typescript-tests.log`. |
| Typecheck | `node node_modules/typescript/bin/tsc --noEmit --incremental false`, exit 0. `evidence/typecheck.log`. |
| Scoped ESLint | Exit 0. Final touched-file checks and earlier full touched-file check retained. Three existing unused-disable warnings in terminal-chart; no lint errors. |
| All 11 equity/future names × five crypto-provider requests | Fixture checks return 422/UNAVAILABLE before upstream fetch. No relabelled BTC, other-venue retry or automatic simulated result. Research instrument route also rejects all 11 names for its two supported providers without upstream fetch. |
| All 23 static crypto mappings | Gate.io actual route/candle fixtures plus Binance/Bybit/OKX metadata fixtures validate instrument, venue, product, precision and units. These are controlled input checks, not live certification of those venues. Coinbase is explicitly unavailable for this perpetual contract. |
| Current local route with real Gate.io HTTP | All **34** original references individually exercised. **22** crypto markets returned history; closed OHLCV samples exactly matched independent requests for the same native contract and 5m interval. **11** equity/future selections returned 422/UNAVAILABLE. **QQQX_USDT** returned 503/UNAVAILABLE; independent metadata reports delisting. See `evidence/local-provider-sweep.json` and `qqqx-provider-metadata.json`. This is the current source invoked in Node, not a browser, gateway stream, assembled candidate or deployment. |
| Decimal-size follow-up | Initial sweep refused five decimal-size contracts. Inspection found identity/price/multiplier can be verified while quantity increment remains unknown; minimum order size is not assumed to be the increment. History remains usable for ETH/SOL/XRP/PEPE; QQQX remains unavailable due delisting. Initial result retained separately. Helper decimal-lot execution remains its existing unsupported prerequisite; no execution promise added. |
| Persistence | Pure workspace migration preserves SPY. Corrected document identity creates a separate document without changing the old drawing document. Browser reload/visual confirmation remains blocked. |
| Preservation | `evidence/preservation.json` verifies index unchanged, baseline originals/audit/plan unchanged outside the explicit task file allowlist, and unrelated pre-existing paths untouched. `evidence/source-manifest.json` binds the exact local files. |

No application/adapter release build was assembled in this phase; build and package gates belong to Phase 18. Historical deployed findings remain historical/deployed failures until actual authorized deployment and verification. No current browser observation or screenshot is claimed.

## Evidence identities and unresolved prerequisites

- Source HEAD is still `80124f17ae500565fe4bb7a88ad44f4b693d4e02`, plus the pre-existing dirty tree and this phase's recorded file hashes. The index was not changed. Node is the existing 22.23.2 installation. There is no new commit or candidate build identity.
- Browser acceptance remains blocked by Phase 00 B01: Harness found no running supported browser, and automatic approval review rejected the isolated cached Chromium launch with “blocked by policy.” No policy bypass, alternative browser driver or repeated launch attempt was used in Phase 01. Required rendered primary/secondary chart/book precision, picker/favorite behavior and recovery/reload checks remain unperformed.
- No usable current live gateway/discovered catalogue is available. Exhaustive verification of a future provider-discovered universe, live messages and correct per-pane subscriptions remains blocked. All currently retained static references were covered, but fixture-normalizable names do not imply exchange support.
- Equity/future availability, delisted QQQX, Coinbase perpetual mapping, decimal quantity increment/research compatibility and actual deployment remain unresolved capabilities. Explicit unavailable containment is not delivery of those promises.
- Provider toolbar state, stream provenance/switching, missing historical cutoff/cache keys and archive/research end-to-end verification are assigned to their saved later phases. No blanket F01 or product PASS is claimed.

Primary references consulted for precise provider contracts: [Gate futures API](https://www.gate.com/docs/developers/apiv4/en/futures/), [Bybit instruments](https://bybit-exchange.github.io/docs/v5/market/instrument), [OKX API](https://www.okx.com/docs-v5/). Gate's minimum order quantity and decimal support flag do not independently prove a quantity increment. Installed Next.js route-handler docs and Lightweight Charts price-format typings were also consulted.

## Ledger and continuation

`repair-ledger.json` preserves all 252 originals and updates only Phase 01's assigned rows and the narrow F04 containment cross-check. It separates fixture/local/provider evidence from empty candidate/deployed/browser results. `finding-ledger.json` leaves F01 unresolved with a locally repaired implementation. `stage-ledger.json` records the direct user prerequisite override and the still-blocked browser gates. Original Phase 00 evidence and the original audit remain unchanged.

The next planned implementation is **Phase 02**. Its normal Phase 01 acceptance dependency remains blocked; another phase must not be started automatically. Stop and wait for the user's instruction. If the browser connection becomes available, complete Phase 01's missing browser checks before changing its status to complete. Phase 05 has independent preparation scope, but was not requested here.

All new evidence is in `artifacts/web-terminal-repair-2026-10-18-phase01/` (Git-ignored). Exact changed files and their task deltas are in `evidence/source-manifest.json` and `phase01.patch`. No personal storage/account/archive was opened or mutated, and no task-owned service needs cleanup.
