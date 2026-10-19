# Phase 04 — local history repair verified; full acceptance blocked

18 October 2026. The user changed the execution contract to automatically continue through the remaining phases. This authorizes Phase 04 and subsequent local implementation despite earlier acceptance blockers, without falsely closing those prerequisites. No deployment, publication, staging or commit occurred.

## Revalidation and interval contract

The existing checkout reproduced the cutoff defect with real Gate HTTP: a local source request ending 1 January 2020 returned October 2026 candles (`evidence/real-cutoff-before.json`). Phase 02 had already fixed the cache keys; those fixes were retained. The research route already used exact range adapters and strict validation; it was not replaced.

`SEMANTICS.md` records the contract before implementation: chart timestamps identify UTC candle opens; chart `to` is an exclusive candle-open cutoff. An aligned cutoff excludes that bucket; a cutoff inside the current bucket may include it, explicitly marked unfinished. Research remains strict closed-candle `[from,to)`. Weekly charts start Monday UTC; display timezone does not move source timestamps. Missing candles remain gaps, not generated data. Gate/OKX perpetual volume remains contracts; Binance/Bybit linear volume remains base coin.

## Changes

- Reused the existing Gate/Binance bounded range fetchers in `/api/bars`; supplied actual ranges to Bybit and OKX and bounded their pagination. OKX uses historical candles and UTC day/week intervals. Empty/out-of-retention coverage is explicit unavailable, with no alternate venue or mock fallback.
- Exactly N possible bucket opens are requested below the cutoff. Mock requests no longer emit N+1 bars. Real single-bucket tests exposed Gate's empty zero-width query; that request now spans the one requested candle while filtering any extra output bucket. Future/invalid cutoffs fail explicitly.
- Client/server caches preserve original retrieval/source observations and include provider, instrument, timeframe, cutoff and count. The client rejects a foreign range, misaligned candle, inconsistent coverage/open-candle flag or volume unit. Existing caches are corrected/versioned; no new cache layer was added.
- Shared OHLCV normalization rejects malformed/non-finite data, nonpositive prices, negative volume and impossible high/low ranges. It orders and canonicalizes duplicate opens. Gate/Binance no longer turn negative candle volume positive before strict research validation. `validateDataset` itself remains unchanged and continues rejecting gaps, duplicates, incomplete and unfinished datasets.
- Added older-history loading on leftward pan near the loaded edge and an explicit Load earlier history control. Pages end exclusively at the earliest loaded open, use one in-flight request, cancellation/identity guards and failed-cutoff suppression for automatic retries. A manual retry remains available. The session is bounded to 12,000 candles/20 older page attempts and explains that limit. Pages prepend without replacing current live values; the visible time range is restored after data/study updates. Archived snapshots are not paginated or rewritten. New live buckets open at the first observed trade rather than inventing a previous-close open across a gap.
- Updated earlier fixture timestamps to match the requested range/alignment and added range provenance. Their original venue/identity/cancellation assertions remain. The prior permissive chart-normalization test now verifies strict malformed rejection separately from valid ordering/deduplication.

Changed paths are listed exactly in `evidence/source-manifest.json`; `phase04.patch` is this phase's delta against raw starting bytes, not the dirty Git index. Fifteen existing files changed and one test file was added. Product scope is the history route/adapters/loader/chart and necessary regressions; research dataset validation, personal data and original archives remain unchanged.

## Verification

| Check | Result and actual scope |
| --- | --- |
| Initial regressions | Five of six initial checks failed before repair; the strict seven-timeframe research safeguard passed. `evidence/regression-before.log`. |
| Full suite | **243 passed, 0 failed**, including eleven Phase 04 tests. `evidence/typescript-tests.log`. |
| Typecheck/lint | Exit 0, all-source nonincremental TypeScript and scoped ESLint. Three pre-existing unused-disable warnings in terminal-chart; no errors. Commands/exits: `evidence/final-checks.json`. |
| Cache/range fixtures | Exclusive five-bar boundary; distinct cutoffs and in-flight coalescing; original retrieval/source time on reuse; unfinished versus future cutoff; older-page merge preserving current values; Bybit/OKX page boundaries and bounded cursor progression; Gate single-bucket range. |
| Strict research fixtures | Both providers × all seven exposed research timeframes return exactly five closed candles with the captured range/hash. JSON round-trip preserves bytes/numbers, hash and retrieval observation; removing a candle is rejected. This is interchange/cache-contract fixture evidence, not actual Helper import or browser download acceptance. Existing strict dataset safeguards remain passing. |
| Real provider comparison | **32** samples: Gate/Binance/Bybit/OKX × all eight chart timeframes. Five closed candles each, zero missing candles, exact numeric OHLCV equality with independent same-venue HTTP requests. Server cache hits retain the original retrieval observation. `evidence/local-history-providers.json`; driver `evidence/probe-history.ts`. |
| Real 2020 cutoff | Binance and OKX returned genuine 2019 candles. Gate reported retained-history unavailability; Bybit reported no coverage. None returned 2026 candles. These are local source-route invocations in Node with real public upstream HTTP. |
| Real single-bucket corner | Initial Gate request returned no coverage while the other three providers returned one candle (`evidence/real-single-bucket.json`). After repair Gate returns 200 with exactly the requested prior bucket (`real-single-bucket-after.json`). |
| Browser/Helper/candidate/deployed | NOT RUN / BLOCKED. No rendered scrolling, screenshot, mounted rapid-switch/replay/warm-up journey, actual Helper cache/import/reuse, assembled candidate or deployed success is claimed. No task-owned server was started. |
| Preservation | **1,496 baseline files**, index/unrelated work and original audit/plan/Phases 00–03 preserved. Original newline conventions retained. See preservation/source manifest and artifact hashes. |

Source HEAD is still `80124f17ae500565fe4bb7a88ad44f4b693d4e02`, plus pre-existing work and recorded phase hashes. Current source API invocations are local evidence, not a Next/Cloudflare candidate or deployed endpoint. The prior phase's unavailable Harness connection and rejected isolated Chromium launch remain external browser prerequisites; no unchanged launch retry or alternative driver was attempted.

## Remaining gates and continuation

Phase 04 remains **BLOCKED for full acceptance**. Required rendered pagination/scroll stability, replay-index interaction, study warm-up after pan and multi-pane switching need a usable supported browser. Actual Helper download/import/cache reuse needs the matching runtime journey; JSON round-trip tests cannot certify it. Source inspection found the research store currently validates bars after Helper cache lookup but broader envelope/job identity still needs Phase 07's captured-input checks. No Phase 07 code was changed here. The seven exposed research timeframes are distinct from weekly chart support; the current Helper source does not advertise weekly research.

Coinbase's missing perpetual mapping and history outside venue coverage remain unresolved capabilities. Sampled OHLCV agreement does not certify entire histories or all instruments. F05 remains unresolved until the required journey gates are verified. The nine assigned audit rows retain their originals; A016/A248 remain scoped regression safeguards, Coinbase remains BLOCKED, and other local repairs remain PARTIAL. No whole-product/deployed PASS is claimed.

Next: **Phase 05**, automatically under the user's updated authorization. Read its prompt and this ledger before changing its source. Earlier blocked prerequisites stay explicit. Phase 19 still requires separate authorization of the exact reviewed candidate and target.

Primary references consulted for range/unit/timezone semantics: [Bybit kline](https://bybit-exchange.github.io/docs/v5/market/kline), [OKX market history](https://app.okx.com/docs-v5/en/#rest-api-market-data-get-candlesticks-history), and [Gate API](https://www.gate.com/docs/developers/apiv4/en/). Installed Next route-handler docs and Lightweight Charts typings were read. No REA runtime/artifact question was needed for this source/range repair.
