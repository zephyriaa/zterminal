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

Still required before Phase 0 closes:

- An active-shell browser smoke test.
- Inventory/consumer proof before retiring duplicate execution paths.
- A production-startup integration check with valid and invalid environment sets.

## Dependency order

```text
0 → 1 → { 2 → [3, 4], 5 → 6 → [7 → 8, 9 → 10] } → 11 → 12 → 13
```

No capability may advertise historical order-flow, GEX replay, AI-secured
credentials, conflict-safe sync, or web/native parity before its input contract
and corresponding acceptance tests exist.
