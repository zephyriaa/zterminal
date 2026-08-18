# ZTerminal Recovery Implementation Report

**Date:** 2026-08-18  
**Recovery branch:** `recovery/canvas-data-foundation`  
**Baseline:** `render-hosted-research-terminal` at `ddf9bd9350a006c885579004351bc37e2b73ee33`  
**Release candidate:** [PR #1](https://github.com/zephyriaa/zterminal/pull/1)  
**Candidate commit:** `83a73e539947929170d98d9ce062effc661da867`

## Executive outcome

The approved recovery was implemented as a controlled enhancement of the deployed Render/Vite/Express/TRPC runtime. The unrelated `main` and Render histories were **not merged**. Instead, portable behavior was rebuilt through explicit contracts, versioned shared calculations, deterministic tests, and a reviewable release-candidate branch.

The completed P0/P1 slices restore truthful market-data behavior, research provenance, durable-workspace foundations, and a minimal reproducible evaluation path while retaining the Canvas/Focus/Research interaction model. No production deployment, database migration, or direct merge has been performed.

| Area | Delivered outcome |
|---|---|
| Canonical runtime | `docs/ADR-0001-CANONICAL-RECOVERY-RUNTIME.md` records the Vite/Express/TRPC branch as the recovery runtime and prohibits an unsafe cross-root merge. |
| Market integrity | Canonical Gate.io perpetual symbols, bounded requested/effective coverage, provider/source metadata, safe unavailable states, and truthful range semantics. |
| Chart workflow | Symbol input, explicit `1D`–`MAX` request semantics, effective UTC coverage, and a provider-compatible range adapter. `MAX` is visibly bounded rather than presented as all history. |
| Durable research | Additive user-owned `workspaces` and `researchDrafts` schema, protected TRPC endpoints, local-only drafts for unauthenticated users, and authenticated migration/sync behavior when database and OAuth are configured. |
| Shared features | Versioned shared VWAP, EMA, candle-profile POC/value area, structure, and deterministic dataset fingerprinting used by the Canvas and research context. |
| Reproducible evaluation | Deterministic, research-only EMA 20/50 + VWAP long-only template with next-bar-open fills, explicit costs, run hash, input fingerprint, metrics, and limitations. |
| Security/release | Stack traces removed from browser errors, malformed analytics placeholder removed, production audit reduced to 0 critical and 0 high findings, and release checklist prepared. |

## Key implementation checkpoints

| Commit | Purpose |
|---|---|
| `36240d3` | Truthful market coverage workflow and canonical runtime ADR. |
| `e76061a` | Gate.io bounded-range adapter correction. |
| `19fd92b` | Durable research workspace schema, protected API, local-draft migration, and safe error boundary. |
| `2d23138` | Shared research feature registry and expanded test enforcement. |
| `8b26f2d` | Reproducible research evaluation engine and contextual panel. |
| `83a73e5` | Release-candidate hardening, dependency remediation, migration cleanup, and release checklist. |

## Verification evidence

The following gates passed on the candidate commit.

| Gate | Result |
|---|---|
| Type check | `pnpm check` passed. |
| Unit tests | `pnpm test` passed: **8 files, 20 tests**. |
| Production build | `pnpm build` passed with no unresolved analytics-placeholder warning. |
| Dependency audit | Production audit: **0 critical**, **0 high**, 26 moderate, 7 low. |
| Public-provider browser smoke test | Gate.io snapshot plus verified 97-bar 15-minute one-day data window loaded after the final dependency update. |
| Contract/provenance display | Requested/effective coverage, source, feature version, and dataset fingerprint were visible in Canvas. |
| Protected workspace route | Unauthenticated request returned HTTP 401 with no server stack trace or local path. |
| Evaluation workflow | Same verified chart window produced a visible run ID/hash under the next-bar-open research model and displayed non-advisory limitations. |

The detailed browser and integration observations are recorded in [`RECOVERY_VALIDATION.md`](./RECOVERY_VALIDATION.md). The exact release and rollback procedure is in [`RELEASE_CANDIDATE.md`](./RELEASE_CANDIDATE.md).

## Deployment gate

PR #1 is open for review against `render-hosted-research-terminal`. Before merge and Render deployment, the release owner must configure the existing OAuth environment, set `DATABASE_URL` if durable workspaces are desired, apply `drizzle/0001_add_research_workspaces.sql` once to the target database, and execute the production smoke checklist. The documented rollback is redeployment of baseline commit `ddf9bd9350a006c885579004351bc37e2b73ee33`.

## Controlled limitations and next increments

The candidate deliberately does not claim CVD, GEX, tick-level volume-at-price, alerts, account aggregation, brokerage connectivity, execution, short strategies, intrabar/limit/stop fills, optimization, or walk-forward analysis. It also does not claim durable workspace persistence until the database migration and OAuth/database configuration are complete in the deployment environment.

The recommended next increment is to merge PR #1 only after the release checklist is signed off, verify the deployed provider and persistence paths, then add verified order-flow or options providers one layer at a time behind explicit entitlement, methodology, coverage, and unavailable-state contracts.
