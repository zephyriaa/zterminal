# Audit reconciliation — 22 October 2026

The eight supplied GLM reports are historical evidence at e5f7f4d1. Their
recommendations are inputs, not instructions to execute. Status below describes
the original isolated checkpoint. Production was subsequently published in PRs
#14/#15; [COMPLETION.md](COMPLETION.md) records the continuation and open gates.

| Finding | Current response | Status and acceptance boundary |
| --- | --- | --- |
| S-1: production live gateway unavailable | Gate/Binance now default to direct public REST/WebSockets; compatibility gateway remains explicit | PARTIAL: both venues observed LIVE locally; no new production evidence |
| S-2 / R-1: Binance server restriction strands chart | Browser-origin requests avoid requiring hosting egress; explicit venue quality and saved chart recovery | PARTIAL: actual local venue switch/reload passed; restrictions on the user's own network remain valid errors |
| S-3 / claim 16: stale simulated-only security guidance | Replaced docs/SECURITY.md with source-grounded browser, cloud, Helper and release boundaries | PASS for documentation correction; no penetration-test claim |
| S-4 / workspace portability claims | Dashboard export/import, bounded versioned file, referenced Python bytes, new IDs and ownership | PARTIAL: import, duplicate-before-open, actual export blob, isolated-context import and reload passed; headless disk download not confirmed |
| S-5: unsandboxed arbitrary Python | Preserve trust warning and process controls; import never executes source | Intentional disclosed limitation; no security sandbox claim |
| S-6: unsigned distribution | Preserve pinned package/checksums and unsigned preview language | PARTIAL: trusted publisher identity remains absent under the free constraint |
| S-7: cloud isolation | Existing owner/revision boundaries retained | NOT TESTED with real multiple accounts; fixture checks do not close it |
| Claims 1–3: chart/research availability and platform scope | Web charts plus Windows Helper; read-only no-install example report with actual engine inputs/output | PARTIAL: example and source restoration observed; packaged service browser run passed; native launcher/install acceptance remains open |
| Claims 4–5: fills, declared costs/range | Keep existing deterministic engine and immutable result assumptions | Earlier independent math plus local runtime tests retained; no newly inferred execution accuracy |
| Claims 6–10: analysis, replay and evidence | Keep explicit modeled assumptions and provenance | Not generalized beyond the audited tests; authoritative event replay remains future work |
| Claims 11–15,17–18: local preservation and future scope | Roadmap separates current repair slices from institutional/native targets | No broad completion claim; use original claim text and verify the individual journey before closure |

## Interpretation corrections

A losing future-peeking strategy does not prove causal isolation. Static guards
reject known patterns but arbitrary trusted Python can still introduce look-ahead
or selection bias. Claims about protection must describe their exact coverage.

A fresh browser with no local records is the expected browser storage boundary.
The repair is portable recovery and clear storage scope, not an automatic account
or silent upload. A successful import does not prove cloud synchronization.

A direct socket opening is not LIVE evidence. A malformed Binance depth frame
now revokes the ready book, clears the stale snapshot and schedules resync. The
new adapter regression failed before the fix and passes afterward. Gate sequence
gaps likewise prevent publication of disconnected levels.

Browser disk history retains provider identity, units and its original observed
window. Only an initial chart may opt into an older saved window. Research and
history paging retain exact-range requirements; a cache is not a freshly downloaded
dataset. Cached observations stay marked STALE.

## Evidence files

- `artifacts/audit-recovery/typescript-release-check.log`: 365 tests pass, zero failures.
- `artifacts/audit-recovery/lint-security.log`: scoped lint of changed TypeScript files.
- `artifacts/audit-recovery/build-local-final.log`: candidate build checkpoint.
- `artifacts/audit-recovery/browser/source-fixture.json`: input for source recovery.
- `artifacts/audit-recovery/browser/actual-export.json`: bytes emitted by the real dashboard export.
- `artifacts/audit-recovery/browser/import-reload.png`: fresh-context editor after reload.
- `artifacts/audit-recovery/browser/example-*.png`: report responsive inspection.
- `artifacts/audit-recovery/python-packaged-runtime.log`: earlier 78 runtime tests, six skips.

Ignored artifacts are local evidence, not committed distribution or deployed
acceptance. The ledger retains all 252 older assertions separately. Grouped
reconciliation here does not silently mark those assertions as individually tested.
