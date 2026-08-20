# ZTerminal Recovery Release Tracker

**Canonical branch:** `recovery/final-form-foundation`

**Rollback tag:** `release/premium-attribution-baseline-20260818` (`b6ebef0`)

**Operating rule:** A slice is not promoted merely because its UI renders. It must satisfy its listed contract, tests, review evidence, and production smoke conditions. Provider-dependent claims remain unavailable until their evidence slice passes. **Production promotion completed via PR #5 and Render deploy `dep-da2cv3ql9ujc739vqbbg` at `23557cc` on 2026-08-18.**

| Slice | Scope | Source behavior / contract | Status | Required release evidence |
|---|---|---|---|---|
| G0 | Governance and canonicalization | Freeze Render baseline, prohibit direct merge, create approved plan and port ledger | **Complete** (`f7bc056`) | Git tag, ledger, recovery plan, clean branch state |
| M1 | Market/provider contracts | Provider catalog, contract metadata, data status, readiness semantics, contract documentation | **Complete in production** (`5ad2def`; deployed in `23557cc`) | Schema tests, invalid/partial coverage fixtures, readiness behavior, no fabricated active capability |
| O1 | Trade-tape verification | Gate.io trade-side semantics and real-time transport evidence spike | **Complete in production** (`11d0b7b`; deployed in `23557cc`) | Official-source record, captured fixtures, ordering/reconnect/stale tests; no CVD enablement before pass |
| O2 | Honest order-flow foundation | CVD, DOM, footprint, and Time & Sales only after O1 proof | **Complete in production** (`cdcdf24`; deployed in `23557cc`) | Real event fixtures, depth reconciliation/gap tests, visible stale/unavailable state |
| R1 | Protocol-led hypothesis workflow | Citation, scope, approval, immutable baseline, one-variable incremental rules | **Complete in production** (`9647855`; deployed in `23557cc`) | Domain fixtures, protocol contracts, drawer interaction evidence |
| R2 | Safe ZS compiler | Closed parser/runtime, diagnostics, discovered inputs, no unsafe execution surface | **Complete in production** (`a5238e3`; deployed in `23557cc`) | Compile fixtures, forbidden-capability tests, protected tRPC contract |
| B1 | Reproducible backtester | Multi-strategy next-bar-open evaluation, costs, provenance, metrics, chart markers | **Complete in production** (`a400634`; deployed in `23557cc`) | Determinism, fill/cost/P&L/provenance tests; non-blocking execution evidence |
| U1 | Command and contextual tools | Focus minimal mode, palette, Markets/Settings/Connections/Risk/Alerts surfaces | **Complete in production** (`2b19250`; deployed in `23557cc`) | Keyboard/accessibility/responsive tests; truthful local/simulated/unavailable states |
| S1 | Storage and security | Durable workspace decision, protected mutations, logging, rate limits, docs | **Complete in production** (`08be716`; deployed in `23557cc`; durable workspace remains configuration-blocked) | Auth/migration/export/restore/security tests; no durable claim before configuration |
| Q1 | Quality and controlled release | CI, performance budgets, browser E2E, responsive and production smoke evidence | **Complete in production** (`d2b7d28`; deployed in `23557cc`) | Passing check/test/build/audit-high, release record, local production smoke and rollback review |
| P1 | Freemium and desktop | Entitlement proposal and Tauri readiness after core trust | **Complete in production** (`4d77a0e`; non-binding proposal deployed in `23557cc`) | User-approved product policy and separate desktop release design |
| MEX1 | Product-sprint multi-exchange tape foundation | Gate.io, Bybit Linear, and Binance USDⓈ-M bounded public-tape contracts plus visible connection health | **Complete in production** (`f128572`; deployed in `23557cc`) | Normalization and lifecycle tests, live browser observation, source record; Binance remains `VERIFYING` because no release-environment WebSocket event was observed |
| MEX2 | Product-sprint local workspace and fail-closed states | Versioned browser-local preferences/watchlist and explicit fresh-source-only market data state | **Complete in production** (`c098cd7`; deployed in `23557cc`) | Local-store contracts, browser reload evidence, no snapshot/credential persistence, full regression and build |
| OF1 | Product-sprint professional order-flow studies | Optional Flow Pulse: 30-second selected-tape delta plus separately labelled Gate.io current-depth imbalance evidence | **Complete in production** (`65dbb5c`; deployed in `23557cc`) | Pure contract fixtures, workspace-boundary test, browser evidence of live tape plus withheld depth, full regression and build |
| P15 | Product-sprint premium one-screen design | Dark teal/violet workstation hierarchy, command/context clustering, chart-canvas emphasis, and responsive terminal chrome | **Complete in production** (`28336bb`; deployed in `23557cc`) | Current and fail-closed browser evidence, full regression and build, visual-boundary record |
| P14 | Product-sprint safe coded strategy evaluation | Closed ZS AST interpretation drives deterministic historical-candle signals and next-open evidence in the browser worker | **Complete in production** (`90cde49`; deployed in `23557cc`) | Runtime/engine fixtures, no-escape and unavailable-series tests, protocol-gate browser evidence, full regression and build |
| OF2 | Product-sprint professional order-flow context | Opt-in UTC session candle-volume context and selected-venue live reported-size large-print evidence | **Complete in production** (`c7f951e`; deployed in `23557cc`) | Pure source-contract fixtures, live and degraded browser states, full regression and build |
| IQ1 | Product-sprint interaction quality and accessibility | Keyboard reference, semantic command-palette navigation, focus restoration, live Focus-mode status, and strict chart-only Focus view | **Complete in production** (`06f8718`; deployed in `23557cc`) | Command fixtures, desktop browser evidence, static responsive-rule validation, full regression and build |
| PF1 | Product platform foundation | Public landing and explicit terminal/account routes, a closed candle-only Indicator Lab, and Coinbase Exchange USD-spot selected public tape | **Complete in production** (`6748114`; merged in `be53fd8`, deployed in `dep-da2dn27qj5pc73feira0`) | Closed-runtime and provider fixtures, live Coinbase browser evidence, no cross-venue Flow Pulse combination, `pnpm check`, 80-test regression, production build, and production route smoke checks |
| ACC1 | Direct Google account activation | Direct Google GIS sign-in with server verification, CSRF double-submit protection, TiDB-backed user/workspace schema, and a 14-day HTTP-only session boundary | **Complete in production** (`2a739a2`; deployed in `dep-da3e8ie7bikc739q8rgg`) | Live Render build/startup evidence, enabled public Google configuration, TiDB schema verification, 85-test release gate, and targeted CSRF-refresh correction |
| UX2 | Auth-aware terminal and code-first backtesting | Visible signed-in/guest terminal account control; closed-source strategy compile plus verified candles is sufficient for historical evaluation; optional protocol baseline remains intact | **Complete in production** (`2313870`; deployed in `dep-da3eovuk1f9s73eor4dg`) | TypeScript check, 88-test regression, production build, live guest account-control and code-first Research browser evidence; no arbitrary code or broker route |
| IND2 | Native indicator catalog | Source-attributed native trend, momentum, volatility, and price-context presets compiled through the existing closed AST runtime | **Complete in production** (`2313870`; deployed in `dep-da3eovuk1f9s73eor4dg`) | Catalog compilation/evaluation fixture, safe-runtime vocabulary tests, live catalog rendering over verified BTC candles, indicator source ledger; no Pine/community-script import |

## First Active Slice

The validated recovery baseline remains visible in [PR #4](https://github.com/zephyriaa/zterminal/pull/4) from `recovery/final-form-foundation` to `render-hosted-research-terminal`. The pull request is still open, but its cumulative recovery content was independently included in the user-authorized product promotion [PR #5](https://github.com/zephyriaa/zterminal/pull/5), merged as `23557cc` and deployed live on Render. PR #4 was not merged or altered by the production promotion.

**Current production state:** MEX1, MEX2, OF1, P15, P14, OF2, and IQ1 are live on `https://zterminal.onrender.com`. The product exposes evidence-backed public-feed health, a bounded multi-exchange tape foundation, browser-local interface persistence, opt-in Flow Pulse, premium one-screen workstation hierarchy, a closed coded-strategy path to deterministic historical-candle evaluation, UTC session candle-volume context, selected-venue live reported-size large-print evidence, and keyboard-first interaction quality. Strategy source is not JavaScript and can neither access host capabilities nor create any execution route. Flow Pulse and large-print evidence remain descriptive rather than automated: selected-venue tape and Gate.io depth remain separately labelled, with no cross-venue consolidation, dollar-notional conversion, prediction, or execution claim. Binance remains `VERIFYING`, and both Binance and Bybit were displayed as `DEGRADED` in the production verification; the interface does not claim live status absent current evidence.

**Next promotion candidate:** PF1 is complete on `product/orderflow-research-terminal` at `6748114`. It adds the public landing and account disclosure routes, safe local custom indicators, and a browser-verified Coinbase Exchange USD-spot tape for supported BTC/USD and ETH/USD mappings. Coinbase depth, cross-venue Flow Pulse combination, durable account persistence, and any execution path remain deliberately unavailable.

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
- [IQ1 interaction and accessibility validation](./IQ1_INTERACTION_ACCESSIBILITY_VALIDATION.md)
- [Production deployment validation](./PRODUCTION_DEPLOYMENT_VALIDATION.md)
- [Platform foundation validation](./PLATFORM_FOUNDATION_VALIDATION.md)
- [Indicator Lab validation](./INDICATOR_LAB_VALIDATION.md)
- [Coinbase adapter validation](./COINBASE_ADAPTER_VALIDATION.md)
- [Direct Google account activation validation](./DIRECT_GOOGLE_AUTH_VALIDATION.md)
- [Indicator research source ledger](./INDICATOR_RESEARCH_SOURCES.md)
