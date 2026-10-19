# Phase 11A implementation evidence — 2026-10-19

Status: **PARTIAL / IN PROGRESS**. Implementation resumed following the user's instruction. This report supersedes the planning document's historical paused execution state. It does not certify all of 11A or Phase 11 as complete.

## Implemented

- Independent trade/depth health from providers through gateway consumers. A book-only failure clears book-dependent results while healthy trades continue; a trade-only failure withholds trade studies while healthy depth remains available. Freshness expires each input independently.
- Shared, reference-counted study ownership scoped to market and workspace. Bounded retention uses a 2,000-trade ring, up to 120 depth observation frames and 32 cached study configurations. Immutable revision snapshots preserve calculation/render consistency; the last consumer releases subscriptions and timers. Publication is coalesced to 20 Hz. Existing pure calculations remain bounded reference calculations; this is not a complete incremental study engine.
- Gate book validation fails closed for malformed, crossed or negative books and invalid sequences. Both providers reject bootstrap overflow rather than silently losing deltas. Binance cannot invent an aggressor side when it is absent.
- Order Book and context views consume independent readiness. Numeric settings commit valid drafts on blur/Enter, preserving ordinary replacement typing. Existing settings survive reload and hide/show.
- Big Trades consumes shared observations. Sub-candle execution timestamps now project to the containing chart candle; the original execution timestamps remain available. Native canvas drawing was observed on actual Gate data.
- Provider dropdown clipping prevented real pointer selection despite accessible options. A scoped toolbar CSS change makes the menu clickable. Venue mismatch withholds prior-market output.
- Stable empty results and equal-state guards prevent a chart loading/switching render loop reproduced during verification.

## Verification

| Check | Result | Evidence under `evidence/` |
| --- | --- | --- |
| Complete TypeScript test suite | PASS, 339/339, concurrency 4 | `full-tests-final.log` |
| Typecheck | PASS | `typecheck-final.log` |
| Scoped ESLint | PASS, zero errors; three existing unused-disable warnings | `lint-final.log` |
| Real Gate/Binance gateway probes | PASS within short BTC windows; zero invalid books | `local-live-gateways.json`, `live-probe.log` |
| Independent live arithmetic | PASS for 100 Gate and 82 Binance prints | `independent-live-ledger.json`, `live-ledger.log` |
| Browser deterministic fixture arithmetic | PASS, 177 prints; CVD 236, total volume 354, microprice 100.5, imbalance 0.5 | `browser-fixture-ledger.json` |
| Browser separate failures/recovery/reconnect | PASS for exercised paths | `browser-depth-gap.json`, `browser-trade-gap.json`, `browser-recovered.json`, `browser-reconnect.json` |
| Browser controls and venue isolation | PASS for exercised paths | `browser-controls.json`, `browser-venue-switch.json`, `browser-big-trades-settings.json`, `browser-big-trades-lifecycle.json` |
| Real Gate browser and native Big Trades rendering | PASS smoke; 100 actual canvas arc calls observed, original drawing method restored | `browser-real-gate-final.json`, `browser-big-trades-native-draw.json`, `browser-big-trades-real-final.png` |
| Preservation | PASS, 1,101 baseline paths checked, no unexpected baseline edits, Git index unchanged | `preservation.json` |

Browser verification used browser-harness and real coordinate/keyboard controls. Chrome was occluded; task-tab CDP focus emulation enabled rendering and was disabled after checks. No recordings were created. Deterministic fixtures and real exchange traces are separate evidence. The chart's existing older-market-identity warning remains visible; these checks do not certify historical drawings or all history paths.

## Performance and remaining acceptance

The bounded synthetic probe processed 100,000 events twice at approximately 233k and 261k events/sec, with calculation p95 3.64/3.74 ms and stable post-GC heap near 8.7 MB. It exercised all nine bounded context calculations periodically. See `session-performance.json`; the slower before measurement is retained separately. These are synthetic ingestion/calculation measurements, not browser frame-rate, full-session, recording or release qualification. An earlier unqualified development/occluded-browser frame sample is retained in `browser-performance.json` and is not a passing performance result.

Open work includes sustained foreground browser performance and the planned soak, broader market/metadata admission, complete session/anchored semantics and incremental study coverage, accepted recording manifests/deterministic replay, and later milestones 11B–11F. No complete historical replay journey was accepted. The dormant public-stream adapter was not certified by the live gateway probes. No competitor advantage or full feature parity is claimed. Before further milestone execution, reconcile generated Phase 11 planning summaries with the revised design authority; the revision deliberately left those generated summaries unchanged.

## Workspace and continuation

`phase11a.patch` isolates this resume from its captured dirty-tree baseline. `repair-ledger.json` preserves the prior 269 rows, including all 252 original audit assertions, and adds ten assertions (279 rows total). `stage-ledger.json` keeps Phase 11 IN PROGRESS; prior assertions are not promoted merely because new tests pass.

The temporary fixture on port 3004 was stopped. The task-owned development app at `http://localhost:3000/terminal` and real Gate gateway on port 3003 remain running for review. Test-added order-flow layers and the current-market Big Trades overlay were removed through the UI, and the Indicators panel was closed. Other tabs, older-market documents and unrelated work were preserved. No commit, package installation, deployment, account connection or trade was performed. Linear search found no matching existing issue; no issue was created or changed.
