# ZTerminal Institutional Research Roadmap

This is the delivery status document. The detailed target design is
[INSTITUTIONAL_RESEARCH_WORKSPACE_PLAN.md](INSTITUTIONAL_RESEARCH_WORKSPACE_PLAN.md).
Status is evidence-based: a phase is not complete merely because a component,
schema, or mock exists.

| Phase | Status | Outcome |
| --- | --- | --- |
| 0. Audit closure and architecture stabilization | **In progress** | Canonical docs, truthful auth/cloud gate, active-shell lifecycle fixes, server-only workspace access, and reproducible baselines. |
| 1. Local-first workspace persistence and sync | Planned | `WorkspaceDocumentV2`, IndexedDB repository, outbox, revision cursor, and visible conflicts. |
| 2. Strategy developer and runtime contracts | Planned | Immutable `StrategyRevisionV2`, diagnostics, capability extraction, and web/native protocol parity. |
| 3. Strategy tester, results, and versioning | Planned | Configure → run → result lifecycle and immutable `ExperimentRunV2` artifacts. |
| 4. AI coding and analysis | Planned | Provider-neutral AI contracts; Gemini first; secret references only. |
| 5. Chart and indicator foundation | Planned | Chart controller/renderer split, workspace-scoped charts, and opt-in link groups. |
| 6. Market microstructure recording | Planned | Content-addressed manifests and lossless recorded trades/depth/options events. |
| 7. Order-flow indicators and Big Trades | Planned | Registered, capability-aware overlays with provenance and completed threshold modes. |
| 8. Programmable order flow | Planned | Typed `zt.orderflow` APIs and event replay compatibility checks. |
| 9. Options/GEX overlays | Planned | Honest BTC/ETH Deribit OI walls and gross/estimated gamma layers. |
| 10. Programmable options/GEX | Planned | Time-aligned, provenance-retaining `zt.options` API. |
| 11. Replay rebuild | Planned | Shared availability-time `ReplayClock` with no future records in inputs. |
| 12. Windows distribution | Planned | Track B workstation and Helper signed-release compatibility. |
| 13. Reliability and release QA | Planned | End-to-end recovery, security, performance, native, and browser gates. |

## Active audit recovery track — 22 October 2026

The GLM audit recovery is the current repair track, alongside the longer-term
institutional design above. It extends existing workspace, chart and Helper
contracts; it does not authorize replacing them with speculative V2 systems.
The original audit statements are historical inputs, not current acceptance.

| Repair slice | Current evidence | Remaining gate |
| --- | --- | --- |
| Preservation and audit reconciliation | Isolated `codex/audit-recovery`; original file/index baseline; eight audit inputs and historical assertions retained | Map each assertion to current journey evidence |
| Direct Gate/Binance feeds | Local browser observed both venues LIVE, source-matched history and provider switching; readiness regressions covered | Final assembled browser recovery and offline acceptance |
| Workspace portability | Versioned backup/import with Python source, fresh IDs and no inherited cloud ownership; focused tests pass | Fresh-profile export/import/reload and duplicate-source journey |
| Python research access | Actual engine-generated synthetic example with source, dataset and hashes; Helper runtime tests passed with six skips | Native launcher/install journey; packaged service browser pair/run/report/export payload passed locally |
| Design | Existing root DESIGN.md and PRODUCT.md already document graphite/violet workspace identity | Final responsive, focus, contrast and error-state verification |
| Exposed order flow | Existing shared book/trade calculations retained | Independent input/output reconciliation and browser acceptance |
| Security and release | Free public feeds and local Helper boundaries documented | Adapter build, exact candidate approval, authenticated cloud and package checks |

See [the recovery evidence](audits/2026-10-22-recovery/STATUS.md) and
[resume handoff](audits/2026-10-22-recovery/HANDOFF.md). Local tests and browser
observations do not certify deployment. The unsigned Helper remains a preview;
trusted signing, seven/thirty-day reliability observations, authoritative replay
and native Windows acceptance remain separate gates. No paid service, persistent
hosted feed gateway or hosted Python is required by this repair track.

## Phase 0 acceptance evidence

Implemented in the active Phase 0 slice:

- The Strategy Developer opens only its editor/configuration surface. A report
  opens after a completed result is retrieved or an archived result is selected.
- Missing Google OAuth credentials, a session secret, or PostgreSQL disable
  identity/cloud sync; there is no fabricated Google provider or shared analyst
  fallback. Production request boundaries reject incomplete auth configuration.
- Cloud workspace routes use a server-only data-access boundary and retain
  owner checks for list, mutation, and deletion.
- The canonical docs name the real active shell, Helper, and native boundaries.
- TypeScript typecheck and unit tests pass; lint ignores generated build output
  and handles the repository's CommonJS maintenance scripts explicitly.
- Active-shell browser smoke passes at 1440, 768, and 390 pixels, covering
  panels, navigation, layout persistence/recovery/reset, and the command palette.
- Incremental research groundwork exposes captured evidence on every report tab
  and protects browser draft writes from stale-tab overwrite. See
  [scope, validation, and remaining gates](research-integrity-recovery-notes.md).
  This does not complete Phase 1 persistence/sync or the Phase 2–3 V2 contracts.

Still required before Phase 0 closes:

- Inventory/consumer proof before retiring duplicate execution paths.
- A production-startup integration check with valid and invalid environment sets.

## Dependency order

```text
0 → 1 → { 2 → [3, 4], 5 → 6 → [7 → 8, 9 → 10] } → 11 → 12 → 13
```

No capability may advertise historical order-flow, GEX replay, AI-secured
credentials, conflict-safe sync, or web/native parity before its input contract
and corresponding acceptance tests exist.
