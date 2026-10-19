# Phase 02 handoff — local implementation verified; full acceptance blocked

18 October 2026, Asia/Baku. The user's direct instruction “contiune to phase 2” authorized this phase despite the incomplete Phase 01 acceptance dependency. Phases 00 and 01 remain BLOCKED. Phase 02 is also **BLOCKED for full acceptance**, with local implementation and checks finished. Phase 03 was not started. No deployment, publication, commit, staging or production mutation occurred.

## Revalidated boundary and chosen repair

Phase 01 had already removed wrong-instrument history and transparent cross-venue/simulation retries. Those fixes were retained and retested. The remaining local F04 boundary was that the toolbar changed an unused direct client while charts consumed the gateway's provider; the history loader collapsed identity-bearing results to arrays, and catalogue/subscription caches were not consistently scoped to the selected venue.

The existing workspace store now owns the selected venue. The existing shared gateway remains the live-data owner. A matching gateway can supply that selection; a different configured gateway produces an explicit unavailable state. No new event bus, store, direct streaming service or automatic venue substitution was introduced. Existing public adapter modules remain available for their other callers.

- All five exposed menu choices, including OKX, update the canonical selection. Main/secondary charts, book metadata, overlays, catalogue requests and legacy backtester history read it. Bybit/OKX history adapters are retained. Coinbase USDT perpetual history remains explicitly unsupported; a Gate-configured gateway cannot supply Binance/Bybit/OKX/Coinbase live streams. These promised capabilities remain unresolved rather than silently removed or certified.
- History returns a typed result with selected/effective venue, native/canonical instrument, product metadata, environment, status, retrieval/source timestamps, integrity, reason and cache origin. Client/server cache hits preserve original observations. Chart history is labelled HISTORICAL rather than LIVE; the rendered provenance badge exposes its identity, status and timestamps. Stream results separately report selected/effective/configured gateway identity, native/canonical instrument, mapped product, status, environment, timestamps, integrity and reason.
- Client history validation refuses foreign or incomplete provenance. The chart's cancellation/generation handling ignores superseded work; shared fetches are bounded and coalesced, so one caller cancelling does not abort another caller's request. Identity-tagged chart state withholds old selection data before an effect runs. Overlay buffers reset with venue changes.
- Shared stream subscriptions use venue/native keys, normalize aliases and reference-count symbols. Selection changes unsubscribe old symbols, invalidate callback generations and reject wrong-venue, wrong-environment, untagged or pre-selection events. Cleanup is idempotent and removes the store watcher/socket listeners when the last consumer leaves. A mismatched gateway cannot become the effective selected venue. Stream epoch guards are local containment; real reconnect/freshness/delivery acceptance remains Phase 03 work.
- Existing Gate/Binance gateway depth payloads now carry the venue and environment required for that validation. An older gateway lacking those tags has its depth withheld rather than accepted under a guessed identity. Gateway and web changes must be reviewed together for a future candidate. The empty order-book state explains that depth has not been verified.
- Catalogue requests/cache are selected-venue scoped. A foreign gateway catalogue cannot promote that selection as verified. Static references/favorites remain available and clearly unverified. The providers API was inspected and retained as capability metadata; it does not create live connections.
- Explicit mock history/streams remain separate simulation paths. The existing all-upstream-failure regressions still prohibit automatic mock/other-venue results. Non-finite mock cutoffs fail explicitly instead of reaching the generator.
- Application TypeScript compilation excludes `artifacts`, because immutable historical probes and byte-for-byte source backups are evidence rather than application inputs. Source, tests and mini-services remain typechecked. No compiler strictness was reduced.

## Verification and identities

| Check | Result and exact scope |
| --- | --- |
| Regression before repair | Three initial Phase 02 regressions failed against the earlier source; `evidence/regression-before.log` retained. |
| Final full TypeScript tests | **222 passed, 0 failed**, including five Phase 02 tests and the retained 12 Phase 01 identity tests. `evidence/typescript-tests.log`. |
| Typecheck | PASS, exit 0: `node node_modules/typescript/bin/tsc --noEmit --incremental false`. |
| Scoped lint | PASS, exit 0; four existing unused-disable warnings, no errors. Exact touched-file command is in `evidence/final-checks.json`. |
| Five exposed history providers | Controlled metadata/candle fixtures exercise actual history route and cache loader. Gate/Binance/Bybit/OKX return the selected native market; Coinbase returns an explicit unsupported result. This is fixture coverage, not live certification of those four venues. |
| Switching and cleanup | Fake socket.io transport drives the actual shared subscription code: Gate alias normalization, A→B→A, delayed old A timestamp rejection, repeated switching and final listener/watch disposal. Controlled delayed history tests reject cancelled A completion and retain B provenance. Pure checks reject implicit simulation and untagged/foreign events. These are not rendered-browser checks. |
| Real public HTTP | Current local source route in Node returned Gate BTC_USDT history with HISTORICAL/provider-ohlcv provenance. Immediate server cache and client memory cache retained the exact original retrieval and final-candle source timestamps. `evidence/local-provider-provenance.json`; reproducible driver `evidence/local-provider-probe.ts`. No gateway/live delivery or deployed endpoint was tested. |
| Preservation | Baseline records 1,402 files. Index unchanged; unrelated baseline files, original audit/plan, and Phase 00/01 artifacts unchanged. 15 existing source/config/test files changed and two files added; raw before bytes and exact phase delta retained. `evidence/preservation.json`, `evidence/source-manifest.json`, `phase02.patch`. |
| Browser/live acceptance | BLOCKED / NOT PERFORMED. No current browser, screenshots, actual gateway subscription delivery, rendered multi-pane switching/reload or real repeated subscription soak is claimed. |
| Candidate/build/Helper/deployed | NOT RUN. No assembled candidate, Helper execution or release. Source HEAD remains `80124f17ae500565fe4bb7a88ad44f4b693d4e02`, plus the existing dirty tree and exact local manifest hashes. Existing Node 22.23.2; no current browser/build/Helper runtime identity. |

Exact final test/typecheck/lint commands and exits are in `evidence/final-checks.json`. The live probe used `node node_modules/tsx/dist/cli.mjs artifacts/web-terminal-repair-2026-10-18-phase02/evidence/local-provider-probe.ts`. No task-owned server/browser needs cleanup.

## Remaining gates and decisions

1. Phase 00 B01 persists: Harness found no supported running browser, and automatic approval review rejected the isolated Chromium launch with “blocked by policy.” No unchanged retry, alternative driver or policy bypass was attempted in this phase. Browser confirmation of picker, pane/history/book labels, rapid switching, saved selection reload and leak-free mounted interactions remains required.
2. A usable venue-matched gateway and genuine events are needed to certify live chart/book/overlay delivery. Bybit/OKX/Coinbase live support is not supplied by the existing Gate/Binance/mock gateway. Current unavailable explanations are containment, not completed provider integration. Dynamic gateway venue routing is not invented in this phase.
3. Phase 01's discovered-universe/browser gates remain unresolved. No prior phase has been retroactively marked complete.
4. Source timestamp for OHLCV is the last candle's open time; retrieval time is the observed fetch time. Cache origin is independent of source status. Live history range/cutoff/pagination correctness remains Phase 04 work: including `to` in identity keys does not fix the existing upstream cutoff omission.
5. Actual reconnect/resubscribe health and freshness under network loss, gateway routing and release compatibility remain Phase 03 and later integration gates. No deployed F04 closure is claimed.

## Ledger and continuation

The full `repair-ledger.json` retains all **252 original audit assertions** and carries forward earlier records. Seven Phase 02 rows (A018, A085, A091, A097, A103, A109, A244) have scoped local evidence and remain PARTIAL, with empty browser/candidate/deployed evidence. `carry_forward_record` and `evidence_base` identify the origin of untouched historical evidence. `finding-ledger.json` leaves F04 unresolved. `stage-ledger.json` keeps 00/01/02 BLOCKED and all later stages NOT STARTED.

The next planned phase is **03**. No next phase is fully dependency-ready while these acceptance gates remain blocked. A direct user instruction may authorize that implementation scope without falsely closing its prerequisite, as it did for Phases 01/02. Do not start another phase automatically. Phase 19 still requires explicit authorization for the exact reviewed candidate and target.

All Phase 02 evidence lives in this separate Git-ignored directory. The original audit and previous phase evidence are immutable. Stop and wait for the user's instruction.
