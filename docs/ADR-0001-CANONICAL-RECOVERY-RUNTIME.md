# ADR-0001: Canonical Recovery Runtime and Branch Reconciliation

**Status:** Accepted — Gate A approval, 2026-08-18  
**Decision owner:** ZTerminal recovery program

## Context

ZTerminal has two independently rooted implementations in the same repository. The public Render deployment is sourced from `render-hosted-research-terminal`, a Vite client with an Express/TRPC service and a chart-first Canvas/Focus/Research interaction model. The default `main` branch is a separate Next.js/Prisma/Socket.IO application with useful market-adapter, analytical, strategy, backtest, and research-policy candidates.

The branches have no Git merge base. A conventional merge would join unrelated application trees, runtimes, build systems, dependency graphs, persistence strategies, and user interfaces. This would create an unreviewable release surface and would not be a controlled recovery.

## Decision

The recovery program will use the deployed **Vite/Express/TRPC Render architecture** as the canonical implementation runtime for the approved P0/P1 recovery increments.

The program will retain the production chart-first interaction vocabulary—**Focus, Canvas, Research**—as the user-facing design reference. It will port only verified, portable behavior from `main` through explicit contracts, fixtures, and tests. No direct branch merge is permitted.

The initial recovery branch is `recovery/canvas-data-foundation`, created from the audited production baseline commit `ddf9bd9350a006c885579004351bc37e2b73ee33` on `origin/render-hosted-research-terminal`.

## Consequences

| Area | Consequence |
|---|---|
| Release continuity | Existing Render routing, static deployment model, public URL, and current chart surface remain the smallest-change production baseline. |
| Domain migration | Pure behaviors from `main` may be ported only after source, input/output semantics, fixture coverage, and dependency requirements are documented. |
| User experience | The recovery will restore workflows contextually from the chart, rather than rebuild a permanent legacy dashboard. |
| Persistence | Browser-local or session-only research state will be replaced by a server-owned workspace model only after its ownership, migration, backup, and access-control contracts are defined. |
| Advanced data | CVD, order flow, GEX, portfolio/account data, brokerage connectivity, and execution remain unavailable until valid provider, entitlement, and methodology conditions are met. |
| Git hygiene | Each vertical slice uses logical commits. The production baseline remains a rollback reference. |

## Rejected alternatives

| Alternative | Why rejected for the first recovery increment |
|---|---|
| Merge `main` into the deployed branch | Technically unsafe because the branches have no shared ancestor; mixes unrelated systems without a verified migration path. |
| Immediate migration of production to `main` | Expands deployment, UI, persistence, and runtime risk before P0/P1 integrity gaps are controlled. |
| New split-service architecture | No measured runtime, latency, or workload evidence yet justifies additional operational complexity. |

## Verification requirements

Every ported behavior must have a versioned fixture or contract test. Every user-facing market value must disclose source and effective coverage. Every persisted research artifact must have user/workspace ownership, explicit migration handling, and recovery/export evidence before it is described as durable.
