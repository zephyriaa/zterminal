# Final Recovery Release Evidence

**Recovery branch:** `recovery/final-form-foundation` at `4d77a0e2dce22677faaaf6e07ce2b705eef726d1` before this evidence record is committed.

**Current production branch:** `render-hosted-research-terminal` at `b6ebef0f4a3d912beeac54bd26ff44e4e4b4e51a`.

**Production URL:** <https://zterminal.onrender.com>.
**Promotion status:** **Not approved, not merged, and not deployed.**

## Executive Release Position

The approved recovery plan’s governed vertical slices are implemented and locally validated on the recovery branch. The current Render production service remains reachable, presents the earlier premium chart workstation, and successfully loaded a verified Gate.io `QQQX_USDT · 15m` public-data window during the final observation. It does **not** yet contain the recovery branch’s B1 worker backtest, U1 command palette/strict Focus Mode, S1 server hardening, Q1 workflow, or P1 roadmap work.

> **No production change has been made as part of the recovery implementation.** The next safe action is a human-reviewed pull request from the recovery branch to the production branch, followed by an explicit user approval before merge/deploy.

## Completed Evidence-Backed Slices

| Slice | Recovery commit | Delivered and verified boundary | Primary record |
|---|---:|---|---|
| G0 | `f7bc056` | Governance baseline, production freeze, canonical port ledger | [Release tracker](./RECOVERY_RELEASE_TRACKER.md) |
| M1 | `5ad2def` | Provider catalog, Gate.io contract metadata, data-state/readiness semantics | [M1 validation](./M1_MARKET_CONTRACT_VALIDATION.md) |
| O1 | `11d0b7b` | Public signed trade tape and live-only CVD proof | [O1 validation](./O1_TRADE_TAPE_VALIDATION.md) |
| O2 | `cdcdf24` | Reconciled public depth/DOM, bounded Time & Sales and footprint with degraded states | [O2 validation](./O2_DEPTH_DOM_VALIDATION.md) |
| R1 | `9647855` | Cited protocol, explicit approval, immutable baseline, one-variable staging | [R1 validation](./R1_PROTOCOL_RESEARCH_VALIDATION.md) |
| R2 | `a5238e3` | Closed ZS parser/diagnostics with no source execution or escape hatches | [R2 validation](./R2_CLOSED_COMPILER_VALIDATION.md) |
| B1 | `a400634` | Worker-backed deterministic evidence package, next-open model, explicit costs, provenance, markers | [B1 validation](./B1_BACKTEST_EVIDENCE_VALIDATION.md) |
| U1 | `2b19250` | Keyboard command palette and strict chart-only Focus Mode with Escape exit | [U1 validation](./U1_INTERACTION_ACCESSIBILITY_VALIDATION.md) |
| S1 | `08be716` | Public API limits, JWT-secret fail-closed guard, constrained HTTP surface, patched toolchain | [S1 validation](./S1_SECURITY_DURABILITY_VALIDATION.md) |
| Q1 | `d2b7d28` | CI workflow and production-built local smoke evidence | [Q1 validation](./Q1_CONTROLLED_RELEASE_VALIDATION.md) |
| P1 | `4d77a0e` | Non-binding open-core entitlement and desktop readiness proposal | [P1 roadmap](./P1_FREEMIUM_DESKTOP_ROADMAP.md) |

## Final Quality Evidence

| Gate | Result |
|---|---|
| Audited frozen install with lifecycle scripts disabled | Passed |
| TypeScript | `pnpm check` passed |
| Regression suite | `pnpm test` passed: 18 files, 55 tests |
| Production build | `pnpm build` passed; Vite 7.3.6 and dedicated backtest worker bundle emitted |
| Dependency audit release threshold | `pnpm audit --audit-level=high` passed: 0 critical, 0 high, 27 moderate, 8 low |
| Production-built local smoke | `/healthz` 200, `/readyz` 200 and Gate.io ready, `/` 200; security headers present |
| Public Render observation | Render service reachable; verified public Gate.io data loaded after initialization; recovery branch remains unpromoted |
| Working tree before this record | Clean and synchronized with `origin/recovery/final-form-foundation` |

## Explicit Boundaries That Remain

| Area | Current truthful state | Release implication |
|---|---|---|
| Durable workspaces | `DATABASE_URL`, `OAUTH_SERVER_URL`, `JWT_SECRET`, and storage prerequisites remain unconfigured in Render | Browser-local protocol state only; protected persistence must remain unavailable |
| GEX/options analytics | No approved options feed, entitlement, schema, or methodology | Must remain visibly unavailable |
| Trading/execution | No broker route, order entry, or automated trading capability | Must remain absent |
| Alerts and calendar | No approved live provider/persistence path | Must remain local/unavailable rather than presented as live |
| Freemium/payment | Roadmap only; no pricing or payment decision | No billing or entitlement enforcement change |
| Desktop | Readiness proposal only | No Tauri distribution or credential storage change |

## Required Production Approval Gate

Before a production promotion, the release owner must review this record and explicitly authorize the following sequence:

1. Create a pull request from `recovery/final-form-foundation` to `render-hosted-research-terminal`; do not merge unrelated `main` history.
2. Confirm the target Render environment intentionally remains public/read-only until its database, OAuth, JWT secret, and storage decisions are separately configured.
3. Review CI results and the rollback point at production commit `b6ebef0`.
4. After an approved merge/deploy, repeat the Render smoke: health/readiness, supported and unsupported symbol behavior, data states, Research/Backtest workflow, browser console, and security-header checks.
5. Record post-deploy evidence before calling the recovery branch production-complete.

This evidence record requests a production-promotion decision; it does not grant one.
