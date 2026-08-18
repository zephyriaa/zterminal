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
| U1 | Command and contextual tools | Focus minimal mode, palette, Markets/Settings/Connections/Risk/Alerts surfaces | **Complete on recovery branch** (`2b19250`; not yet production-promoted) | Keyboard/accessibility/responsive tests; truthful local/simulated/unavailable states |
| S1 | Storage and security | Durable workspace decision, protected mutations, logging, rate limits, docs | **Complete on recovery branch** (`08be716`; not yet production-promoted; durable workspace remains configuration-blocked) | Auth/migration/export/restore/security tests; no durable claim before configuration |
| Q1 | Quality and controlled release | CI, performance budgets, browser E2E, responsive and production smoke evidence | **Complete on recovery branch** (`d2b7d28`; not yet production-promoted) | Passing check/test/build/audit-high, release record, local production smoke and rollback review |
| P1 | Freemium and desktop | Entitlement proposal and Tauri readiness after core trust | **Complete on recovery branch** (`4d77a0e`; non-binding and not production-promoted) | User-approved product policy and separate desktop release design |
| MEX1 | Product-sprint multi-exchange tape foundation | Gate.io, Bybit Linear, and Binance USDⓈ-M bounded public-tape contracts plus visible connection health | **Complete on product branch** (`f128572`; not production-promoted) | Normalization and lifecycle tests, live browser observation, source record; Binance remains `VERIFYING` because no release-environment WebSocket event was observed |
| MEX2 | Product-sprint local workspace and fail-closed states | Versioned browser-local preferences/watchlist and explicit fresh-source-only market data state | **Complete on product branch** (`c098cd7`; not production-promoted) | Local-store contracts, browser reload evidence, no snapshot/credential persistence, full regression and build |
| OF1 | Product-sprint professional order-flow studies | Optional Flow Pulse: 30-second selected-tape delta plus separately labelled Gate.io current-depth imbalance evidence | **Complete on product branch** (`65dbb5c`; not production-promoted) | Pure contract fixtures, workspace-boundary test, browser evidence of live tape plus withheld depth, full regression and build |
| P15 | Product-sprint premium one-screen design | Dark teal/violet workstation hierarchy, command/context clustering, chart-canvas emphasis, and responsive terminal chrome | **Complete on product branch** (`28336bb`; not production-promoted) | Current and fail-closed browser evidence, full regression and build, visual-boundary record |
| P14 | Product-sprint safe coded strategy evaluation | Closed ZS AST interpretation drives deterministic historical-candle signals and next-open evidence in the browser worker | **Complete on product branch** (`90cde49`; not production-promoted) | Runtime/engine fixtures, no-escape and unavailable-series tests, protocol-gate browser evidence, full regression and build |
| OF2 | Product-sprint professional order-flow context | Opt-in UTC session candle-volume context and selected-venue live reported-size large-print evidence | **Complete on product branch** (`c7f951e`; not production-promoted) | Pure source-contract fixtures, live and degraded browser states, full regression and build |

## First Active Slice

The validated recovery baseline is under review in [PR #4](https://github.com/zephyriaa/zterminal/pull/4) from `recovery/final-form-foundation` to `render-hosted-research-terminal`. It is **review-only**: no merge or deployment is authorized until a final explicit approval is received.

**Next active product slice: strengthen interaction quality and accessibility around the completed one-screen research workflow, starting with keyboard discoverability, focus behavior, and responsive drawer validation.** MEX1, MEX2, OF1, P15, P14, and OF2 are complete on `product/orderflow-research-terminal`. The product now exposes evidence-backed public-feed health, a bounded multi-exchange tape foundation, browser-local interface persistence, opt-in Flow Pulse, premium one-screen workstation hierarchy, a closed coded-strategy path to deterministic historical-candle evaluation, UTC session candle-volume context, and selected-venue live reported-size large-print evidence. Strategy source is not JavaScript and can neither access host capabilities nor create any execution route. Flow Pulse and large-print evidence remain descriptive rather than automated: selected-venue tape and Gate.io depth remain separately labelled, with no cross-venue consolidation, dollar-notional conversion, prediction, or execution claim. Binance’s adapter and fixtures exist but it remains `VERIFYING`; the UI displays `DEGRADED` rather than claiming a live feed until a release-environment WebSocket event is captured.

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
- [S1 security and durable-workspace boundary](./S1_SECURITY_DURABILITY_VALIDATION.md)
- [Q1 controlled release validation](./Q1_CONTROLLED_RELEASE_VALIDATION.md)
- [P1 freemium and desktop roadmap](./P1_FREEMIUM_DESKTOP_ROADMAP.md)
- [Final recovery release evidence](./FINAL_RECOVERY_RELEASE_EVIDENCE.md)
- [MEX1 multi-exchange tape validation](./MEX1_MULTI_EXCHANGE_TAPE_VALIDATION.md)
- [MEX2 local workspace validation](./MEX2_LOCAL_WORKSPACE_VALIDATION.md)
- [OF1 Flow Pulse validation](./OF1_FLOW_PULSE_VALIDATION.md)
- [Phase 15 premium one-screen design validation](./PHASE15_PREMIUM_DESIGN_VALIDATION.md)
- [Phase 14 safe strategy evaluation validation](./PHASE14_SAFE_STRATEGY_EVALUATION_VALIDATION.md)
- [OF2 order-flow context validation](./OF2_ORDER_FLOW_CONTEXT_VALIDATION.md)
