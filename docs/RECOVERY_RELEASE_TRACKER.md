# ZTerminal Recovery Release Tracker

**Canonical branch:** `recovery/final-form-foundation`

**Rollback tag:** `release/premium-attribution-baseline-20260818` (`b6ebef0`)

**Operating rule:** A slice is not promoted merely because its UI renders. It must satisfy its listed contract, tests, review evidence, and production smoke conditions. Provider-dependent claims remain unavailable until their evidence slice passes.

| Slice | Scope | Source behavior / contract | Status | Required release evidence |
|---|---|---|---|---|
| G0 | Governance and canonicalization | Freeze Render baseline, prohibit direct merge, create approved plan and port ledger | **Complete** (`f7bc056`) | Git tag, ledger, recovery plan, clean branch state |
| M1 | Market/provider contracts | Provider catalog, contract metadata, data status, readiness semantics, contract documentation | **Complete on recovery branch** (`5ad2def`; not yet production-promoted) | Schema tests, invalid/partial coverage fixtures, readiness behavior, no fabricated active capability |
| O1 | Trade-tape verification | Gate.io trade-side semantics and real-time transport evidence spike | **Complete on recovery branch** (`11d0b7b`; not yet production-promoted) | Official-source record, captured fixtures, ordering/reconnect/stale tests; no CVD enablement before pass |
| O2 | Honest order-flow foundation | CVD, DOM, footprint, and Time & Sales only after O1 proof | **Complete on recovery branch** (`cdcdf24`; not yet production-promoted) | Real event fixtures, depth reconciliation/gap tests, visible stale/unavailable state |
| R1 | Protocol-led hypothesis workflow | Citation, scope, approval, immutable baseline, one-variable incremental rules | **Complete on recovery branch** (`9647855`; not yet production-promoted) | Domain fixtures, protocol contracts, drawer interaction evidence |
| R2 | Safe ZS compiler | Closed parser/runtime, diagnostics, discovered inputs, no unsafe execution surface | **Complete on recovery branch** (`a5238e3`; not yet production-promoted) | Compile fixtures, forbidden-capability tests, protected tRPC contract |
| B1 | Reproducible backtester | Multi-strategy next-bar-open evaluation, costs, provenance, metrics, chart markers | **Complete on recovery branch** (`a400634`; not yet production-promoted) | Determinism, fill/cost/P&L/provenance tests; non-blocking execution evidence |
| U1 | Command and contextual tools | Focus minimal mode, palette, Markets/Settings/Connections/Risk/Alerts surfaces | **Complete on recovery branch** (pending commit; not yet production-promoted) | Keyboard/accessibility/responsive tests; truthful local/simulated/unavailable states |
| S1 | Storage and security | Durable workspace decision, protected mutations, logging, rate limits, docs | Blocked by production DB/OAuth configuration | Auth/migration/export/restore/security tests; no durable claim before configuration |
| Q1 | Quality and controlled release | CI, performance budgets, browser E2E, responsive and production smoke evidence | Planned | Passing check/test/build/lint, release record, rollback verification |
| P1 | Freemium and desktop | Entitlement proposal and Tauri readiness after core trust | Deferred post-core | User-approved product policy and separate desktop release design |

## First Active Slice

**Next active slice: S1 — Security and durable-workspace boundaries.** U1 completed on the recovery branch: the chart-first workstation now includes a dismissible keyboard command palette, strict Focus Mode with a reliable Escape exit, and truthful status messaging for unconfigured secondary tools. It has not been merged or deployed to production. S1 must document the missing production database/OAuth prerequisites, implement only safe dependency or public-surface hardening that does not fabricate durable storage, and defer protected cloud mutations until required configuration exists.

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
- [O1 trade-tape validation](./O1_TRADE_TAPE_VALIDATION.md)
- [O2 honest order-flow validation](./O2_DEPTH_DOM_VALIDATION.md)
- [R1 protocol-led research validation](./R1_PROTOCOL_RESEARCH_VALIDATION.md)
- [R2 closed compiler validation](./R2_CLOSED_COMPILER_VALIDATION.md)
- [B1 deterministic backtest evidence validation](./B1_BACKTEST_EVIDENCE_VALIDATION.md)
- [U1 interaction and accessibility validation](./U1_INTERACTION_ACCESSIBILITY_VALIDATION.md)
