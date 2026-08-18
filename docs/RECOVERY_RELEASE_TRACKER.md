# ZTerminal Recovery Release Tracker

**Canonical branch:** `recovery/final-form-foundation`

**Rollback tag:** `release/premium-attribution-baseline-20260818` (`b6ebef0`)

**Operating rule:** A slice is not promoted merely because its UI renders. It must satisfy its listed contract, tests, review evidence, and production smoke conditions. Provider-dependent claims remain unavailable until their evidence slice passes.

| Slice | Scope | Source behavior / contract | Status | Required release evidence |
|---|---|---|---|---|
| G0 | Governance and canonicalization | Freeze Render baseline, prohibit direct merge, create approved plan and port ledger | **Complete** (`f7bc056`) | Git tag, ledger, recovery plan, clean branch state |
| M1 | Market/provider contracts | Provider catalog, contract metadata, data status, readiness semantics, contract documentation | Planned | Schema tests, invalid/partial coverage fixtures, readiness behavior, no fabricated active capability |
| O1 | Trade-tape verification | Gate.io trade-side semantics and real-time transport evidence spike | Planned | Official-source record, captured fixtures, ordering/reconnect/stale tests; no CVD enablement before pass |
| O2 | Honest order-flow foundation | CVD, DOM, footprint, and Time & Sales only after O1 proof | Blocked by O1 | Real event fixtures, depth reconciliation/gap tests, visible stale/unavailable state |
| R1 | Protocol-led hypothesis workflow | Citation, scope, approval, immutable baseline, one-variable incremental rules | Planned | Domain fixtures, protocol contracts, drawer interaction evidence |
| R2 | Safe ZS compiler | Closed parser/runtime, diagnostics, discovered inputs, no unsafe execution surface | Planned | Compile fixtures, forbidden-capability tests, protected tRPC contract |
| B1 | Reproducible backtester | Multi-strategy next-bar-open evaluation, costs, provenance, metrics, chart markers | Planned | Determinism, fill/cost/P&L/provenance tests; non-blocking execution evidence |
| U1 | Command and contextual tools | Focus minimal mode, palette, Markets/Settings/Connections/Risk/Alerts surfaces | Planned | Keyboard/accessibility/responsive tests; truthful local/simulated/unavailable states |
| S1 | Storage and security | Durable workspace decision, protected mutations, logging, rate limits, docs | Blocked by production DB/OAuth configuration | Auth/migration/export/restore/security tests; no durable claim before configuration |
| Q1 | Quality and controlled release | CI, performance budgets, browser E2E, responsive and production smoke evidence | Planned | Passing check/test/build/lint, release record, rollback verification |
| P1 | Freemium and desktop | Entitlement proposal and Tauri readiness after core trust | Deferred post-core | User-approved product policy and separate desktop release design |

## First Active Slice

**M1 — Market/provider contracts** begins only after reviewing the existing canonical market router, `marketContracts`, current data-status behavior, and the legacy market contracts/capability modules. Its first deliverable is a proposed, fully typed provider contract with explicit state semantics, followed by fixtures and tests before any UI expansion.

## Change-Control Checkpoints

| Checkpoint | Change allowed without a new product decision | Change requiring a new product decision |
|---|---|---|
| Provider verification | Read-only source validation, contracts, fixtures, safe unavailable states | New paid provider, credential collection, or altered data-license terms |
| Hosting | Local measurement and documented current-tier limits | Any plan, spend, or persistent-hosting change |
| Persistence | Local fallback and migration design | Database provisioning, OAuth configuration, retention, or backup policy |
| Research execution | Closed DSL and deterministic historical evaluation | Broker credentials, order routing, autonomous actions, or arbitrary user code |
| Freemium | Product model and entitlement design documents | Billing, payment processor, paid subscription, or user charge |

## Evidence Index

- [Approved product recovery plan](./ZTERMINAL_PRODUCT_RECOVERY_PLAN.md)
- [Canonical port ledger](./PORT_LEDGER.md)
- [Canonical runtime ADR](./ADR-0001-CANONICAL-RECOVERY-RUNTIME.md)
- [Premium production release record](./PREMIUM_PRODUCTION_RELEASE.md)
- [Chart attribution compliance record](./CHART_ATTRIBUTION_UPDATE.md)
