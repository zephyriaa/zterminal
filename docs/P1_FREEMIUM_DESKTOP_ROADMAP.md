# P1 Freemium and Desktop Readiness Roadmap

**Status:** product proposal only. This roadmap adds no billing, payment provider, entitlement enforcement, account claim, data-provider purchase, Tauri build, distribution, credential storage, or production deployment.

## Product Principle

> Core market research, reproducible local strategies, and truthful historical evaluation remain open and available without payment. An entitlement may add capacity or collaboration only after the durable account model is proven; it must never gate correctness, alter provider data state, conceal a limitation, or weaken the execution-disabled boundary.

## Proposed Entitlement Boundary

| Surface | Open core commitment | Potential future capacity tier | Gate before any implementation |
|---|---|---|---|
| Public market research | Gate.io public read-only snapshot, history, data status, CVD/DOM/Time & Sales/footprint where verified | Additional **verified** providers after separate contract, licensing, and evidence work | Provider entitlement, attribution, methodology, cost, and failure-state review |
| Research protocol | Browser-local cited baseline, immutable fingerprint, one-variable staging, closed compiler diagnostics | Authenticated durable workspace, shared protocol review, and organization controls | Database, OAuth, JWT secret, workspace ownership, migration/backup/export/restore evidence |
| Backtesting | Deterministic local-worker evaluation with explicit provenance and cost assumptions | Higher compute quota or longer verified retained history; never a claim of better methodology | Measured performance/cost budget, rate limits, anti-look-ahead regression evidence, user-approved policy |
| Alerts and journal | Unavailable or truthful local-only states until real data/persistence is configured | Durable alerts and trade-tagged journal storage | Approved provider, privacy model, retention, consent, audit and recovery plan |
| Execution | **Permanently absent from the current product scope** | None in this roadmap | A distinct future product decision; never inferred from research entitlement |

## Desktop Readiness Assessment

The web terminal remains the reference implementation. A Tauri wrapper may be assessed only after the browser release is promoted through the controlled release gate and after the account/durability model is real rather than browser-local.

| Desktop requirement | Current readiness | Required future proof before desktop work |
|---|---|---|
| Browser release baseline | Recovery branch is validated locally but not production-promoted | User-approved production release with post-deploy evidence and rollback tag |
| Tauri wrapper compatibility | Not assessed in this recovery slice | Build/install/smoke against the final promoted web code; no implicit port |
| Signing and auto-update | Not designed | Platform signing identities, update hosting, key rotation, rollback, and incident response plan |
| Credential handling | No provider credentials are stored in the browser | OS keychain design, no secret exposure in renderer, and threat-model review |
| Windows/macOS/Linux distribution | No artifacts planned | Per-platform packaging, sandboxing, accessibility, update, and uninstall/recovery evidence |
| Offline behavior | No offline data promise | Explicit cached-data lifecycle, provenance/staleness display, encryption, quota, and deletion rules |

## Decision Sequence

1. Complete an explicit production release review for the recovery branch without enabling persistence or payments.
2. Provision and validate durable workspace prerequisites only if the user approves that product direction.
3. Publish a separate entitlement policy defining capacity, fairness, retention, privacy, refund/support ownership, and provider-license boundaries before implementing any commercial integration.
4. Evaluate the final web app in the existing Tauri wrapper only after the web release gates, then produce a separate desktop threat model and release plan.

## Non-Goals and Guardrails

This proposal deliberately excludes pricing, payment collection, subscription changes, billing claims, support commitments, brokerage connections, live order entry, inferred trade signals, and unlicensed data. It also rejects any tier that would present unavailable data as live, change the reproducibility of local research, or hide the methodology used for a result.

P1 is complete on the recovery branch as a non-binding roadmap pending commit. Any move from proposal to implementation requires a new, explicit user decision and a separate vertical slice with its own validation evidence.
