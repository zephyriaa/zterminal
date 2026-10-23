# GLM recovery completion ledger — 23 October 2026

The user authorized completing GLM recovery first. The institutional/native
roadmap remains separate. The eight GLM reports and 252 older assertions are
historical inputs; their original contents and statuses remain preserved.

## Current execution gates

| Recovery phase | Evidence and implementation | Remaining acceptance |
| --- | --- | --- |
| 0. Baseline and reconciliation | Original dirty checkout preserved; eight report hashes retained; every older assertion has its own ledger row | Untested historical journeys must be exercised individually; grouped evidence is not blanket closure |
| 1. Direct public feeds | PRs #14/#15 deployed direct Gate/Binance; preserved workspace, provider switch and provenance verified on 22 October | Fresh browser recovery after restart; seven/thirty-day observation. New local capture failed live acceptance because exchange clocks were about two seconds ahead of this machine |
| 2. Portable recovery | Actual deployed workspace download, remapped identity and exact Python-source bytes verified; local fresh-context import/reload verified | Repeat the full downloaded-file restore after browser restart |
| 3. Windows research journey | Packaged Helper paired from the public app; real 30-day Gate run archived; source/input/dataset/result/accounting validation passes | Native launcher/install UI and report export/import through the browser after restart |
| 4. Existing design | Graphite/violet system preserved; provider/layout menus portalled; previous bounded responsive checks retained | Complete keyboard, focus, contrast and error-state browser acceptance |
| 5. Exposed order flow | Missing Binance aggressor flags no longer become buys; negative/unsafe depth IDs rejected. Captured raw trades, CVD, footprint/profile totals and reconstructed books reconcile offline | Clock-synchronized live browser reconciliation and stress/long-duration observation. Offline acceptance is not a historical replay engine |
| 6. Security, packaging and release | Production workerd gate; anonymous/cross-origin boundary smoke checks; 368 Node tests pass locally. Fifteen unused historical root artifacts relocated with byte hashes checked | Real OAuth/two-account isolation, native install acceptance and trusted signing remain unverified |
| 7. Institutional/native growth | Deferred by the user's current scope selection | Separate roadmap; no new execution engine, recorder or native application promised by this recovery release |

## Reproducible public-feed check

Run `node --import tsx scripts/reconcile-public-feed.ts gateio` or `binance`.
The tool captures 30 seconds from the existing public adapter, retaining raw
REST and WebSocket payloads under ignored `artifacts/feed-reconciliation/`.
It compares normalized print identities and values, retained-window membership,
CVD/footprint/profile totals, independently reconstructed book levels, imbalance
and microprice. Raw-frame bounds fail closed.

Supply a captured `raw.json` as the third argument for an offline recheck.
That mode uses only captured REST responses and a controlled parser clock,
preserves all exchange timestamps and returns a nonzero exit code: it cannot
silently satisfy live acceptance. A failed live run can still produce an
explicitly offline reconciliation result.

The 23 October captures reconciled 40 Gate trades / 678 frames and 97 Binance
aggregate trades / 7,584 frames. Both failed live acceptance because the adapter's
future-time guard rejected the source timestamps. The guard remains; the UI now
discloses the device-clock problem instead of silently discarding those prints.
These are bounded local measurements, not whole-product reliability claims.

## External gates

- Interactive browser: the prior attempt to restart the isolated test browser
  was rejected by automatic approval review. Browser Harness found no connected
  browser. Report-download, fresh restore and full visual acceptance remain open.
- Real OAuth and cloud isolation need interactive access to two user-controlled
  Google test identities. Existing fixture/protocol/owner checks do not prove the
  real callback, cloud persistence or sign-out journey.
- The Helper remains an unsigned preview. Published hashes verify byte identity,
  not publisher identity. Trusted signing needs an available signing identity;
  the strictly free constraint remains in force.
- Seven/thirty-day reliability needs actual elapsed observation. Short captures,
  simulated stress and a green deployment cannot establish it.

## Evidence

Local evidence is under `artifacts/audit-recovery`: `completion-all-tests.log`,
`completion-migrations.log`, `trade-integrity-before.log`,
`trade-integrity-after.log`, `root-artifact-relocations.json` and
`published-release-verification.json`. Raw capture/reconciliation manifests are
under `artifacts/feed-reconciliation`. Public releases #14 and #15 remain bounded
deployment evidence; subsequent candidates require their own successful workflow
and deployed checks.
