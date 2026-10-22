# Audit recovery checkpoint — 22 October 2026

Historical local implementation checkpoint: `codex/audit-recovery`, isolated from
the original dirty checkout. The checks below preceded publication; no real trade.
The original 1,070 source files and Git index match their preservation baseline.

Publication continuation: PR #14 merged as `8ab71bd0`. Its successful deployment
failed at runtime because OpenNext 1.20.6 did not inline Next 16.4's preview-props
manifest. Production was rolled back to working Worker version
`e62ced6b-c899-4ca6-b7cb-87ac3d1f8373`. PR #15 pins OpenNext 1.20.13 and enforces
actual local workerd requests before deployment. The same smoke check failed
against the old bundle with the exact exception and passed against the repaired
bundle for auth capabilities, dashboard, workspace and example report. This
supersedes the earlier adapter-build-only acceptance; live acceptance still
requires checking the deployed version in a browser. Production dependency audit
after the repair remains zero critical/high/moderate and two low findings.

## Changes

- Default Gate/Binance public feeds now use the browser, sharing existing market
  subscribers and order-flow sessions. Socket-open is not LIVE evidence; depth
  gaps, malformed frames and reconnect races invalidate the book. Venue identity,
  contract units, trade granularity and independent stream quality are retained.
- Public catalogue/history has request deduplication, bounded timeouts and rate
  cooldowns. Initial charts can recover an explicitly STALE saved window; research
  and history paging retain exact-range requirements.
- Workspace export/import retains referenced Python strategies and chart-only
  indicators. Imports get fresh workspace/source IDs and no cloud owner. Duplicate
  before first open preserves imported source. Backups disclose missing artifacts.
- Added a no-install, read-only synthetic research example with actual engine
  output, input source/dataset and reproducibility hashes. Linked it from the
  dashboard and disconnected research flow. Provider/layout menus use existing
  portalled popovers to escape Dockview clipping.
- Preserved the existing DESIGN.md/PRODUCT.md. Updated architecture, deployment,
  security and roadmap guidance to match the candidate and keep future work gated.
- Updated Next.js to 16.4.2 and Monaco to 0.57.0, applied compatible lockfile fixes,
  and scoped a deepmerge-ts 8 override to Prisma configuration. Prisma generation,
  explicit configuration loading and schema validation pass. The CLI belongs in
  development dependencies. CI now enforces its existing high-severity threshold.

## Verified evidence

| Check | Result | Boundary |
| --- | --- | --- |
| Full TypeScript suite | PASS: 365 tests | Local SQLite fixture/integration checks |
| Typecheck and standalone build | PASS | Final application source, 151 Monaco assets/license |
| Whole-repo lint | PASS with 11 warnings, zero errors | Existing unused suppression warnings retained |
| Production dependency audit | PASS threshold: zero critical/high/moderate, two low | Registry scan, not a penetration test; low sanitizer-chain findings remain |
| Prisma migrations | PASS: all four checked-in migrations | Explicitly created empty disposable SQLite file; PostgreSQL runtime not tested |
| Cloudflare adapter build | PASS | Isolated Ubuntu WSL source copy; Worker and 151 assets verified, no deploy |
| Gate and Binance feeds | PASS local | Both LIVE with matching source history; venue switch and reload; aggregate/raw labels |
| Offline and recovery | PASS local | DISCONNECTED with retained candles; online returns LIVE; blocked history reload uses STALE disk provenance |
| Workspace recovery | PASS bounded journey | Import, duplicate before open, actual export blob, isolated-context restore, exact source bytes after reload |
| Packaged Helper service | PASS bounded journey | Newly built pinned-runtime package; browser pair, 30-day Gate strategy, archived report and export payload |
| Report integrity | PASS | Source and result hashes match the actual exported report: 14 closed trades, one open position |
| Order flow | PASS bounded checks | Independent fixture ledger; live DOM CVD/footprint/profile arithmetic, observed L2 heatmap rendering |
| Original preservation | PASS | 1,070 source file hashes and original Git index unchanged |

## Open acceptance gates

- Headless browser download-to-disk completion was not confirmed, including the
  static example link. Actual export payloads and fresh-context restore were
  verified; do not silently label OS file-save behavior accepted.
- Native Helper launcher/install UI, fresh OAuth and real multi-account cloud
  isolation are NOT TESTED. The package remains unsigned; hashes do not establish
  a trusted publisher. No paid signing or other paid service was introduced.
- Full independent raw-exchange ledger reconciliation, stress/performance budgets,
  seven/thirty-day reliability observations and authoritative event replay remain
  open. Short live consistency checks do not certify full-session market coverage.
- The 252 older assertions remain separately recorded; grouped reconciliation does
  not mark each historical assertion individually retested. See RECONCILIATION.md.
- Native Win32/Direct3D/WinUI, research lineage, recording and broader optional
  capabilities remain later gates. The user authorized publishing verified changes
  on each development pass on 22 October; later scope limits or pauses take precedence.

## Evidence locations

Local ignored evidence is under `artifacts/audit-recovery`: final test/build/lint
logs, production dependency audit, Prisma migration/config checks, Linux adapter
log and hashes, package checksums and browser JSON/PNG captures. `ledger.json`
records machine-readable status; original audit inputs remain byte-preserved.
