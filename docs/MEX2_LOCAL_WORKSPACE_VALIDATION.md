# MEX2 — Fail-Closed Data State and Local Workspace Validation

**Status:** Complete on `product/orderflow-research-terminal`. **Scope:** safe browser-local interface persistence and explicit market-data state boundaries.

## Released Behavior

MEX2 stores a versioned **browser-local workspace** containing only the selected market symbol, timeframe, historical-range preset, active tape provider, active study identifiers, and a bounded watchlist. It does not store account credentials, cookies, order instructions, market snapshots, candle windows, live tape, depth, or any durable server-side workspace record.

| Capability | Released behavior | Explicit non-claim |
|---|---|---|
| Watchlist | User can retain a bounded local list of USDT-perpetual symbols in the current browser | Cross-device, server-synced, or account-managed watchlist |
| Layout preferences | Selected symbol, timeframe, range, studies, and tape venue restore after reload | Durable authenticated workspace or cloud backup |
| Public data | A reload starts in a pending state until a new public response is verified | Persisted snapshot, candle, tape, or depth replay |
| Feed health | `LIVE`, `STALE`, `DEGRADED`, and `UNAVAILABLE` remain visible, with non-live tape withheld | Any inferred or cached live order-flow claim |

> **Fail-closed rule:** browser-local preferences may restore the requested view, but every market quote, historical window, live tape, and depth panel must re-establish from a current public source before it receives a verified or live label.

## Evidence

The local workspace contract tests prove versioned writes, symbol/watchlist normalization, malformed-payload rejection, and storage-failure-safe behavior. Browser verification confirmed the **+ Watch** action and **Local workspace saved · This browser only** status. Inspection of the persisted browser value found only interface preference fields and no snapshot or credential-like field. A browser reload restored the local preferences while the terminal returned to explicit pending market states until fresh public responses arrived. Full details are retained in `docs/evidence/mex2-local-workspace-ui-observation.md`.

## Quality Gates

| Gate | Result |
|---|---|
| `pnpm check` | Passed |
| Local workspace tests | Passed |
| Existing browser-local research draft tests | Passed |
| Browser-local workspace and reload observation | Passed |
| Full regression suite and production build | Passed: 21 test files / 65 tests; production build passed |

## Configuration Boundary

The existing durable-workspace decision is unchanged. Without configured database, OAuth, and production JWT-secret settings, browser-local preferences are the only released persistence layer. This slice does not weaken that boundary or represent local storage as account persistence.
