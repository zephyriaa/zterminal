# ADR-0001: Introduce a Framework-Independent Shared Domain Core

**Status:** Accepted for the current incremental implementation.

## Context

ZTerminal currently has working Next.js client views, market-provider adapters, and a deterministic ZS backtest runtime, but several financial concepts remain embedded in presentation components or exist only as local state. The approved architecture requires web and future Windows desktop clients to share business rules without rewriting working market-data and strategy functionality.

## Decision

New financial concepts will be added under `src/domain/` as framework-independent TypeScript modules. These modules may import stable normalized market types, but they must not import React, Next.js route handlers, browser storage, Socket.IO, Prisma, or provider-specific adapters. The first modules cover reusable entity models, risk evaluation, deterministic market analytics, structured strategy definitions, validation/resampling contracts, alert models, and journal/performance models.

The existing `src/lib/market` provider adapters and `src/lib/strategy` ZS compiler/runtime remain in place. They will be integrated through application services in later increments rather than rewritten. UI views may consume pure domain results, but must not embed replacement financial calculations.

## Consequences

| Positive consequence | Cost / constraint |
|---|---|
| The web client and future Tauri client can share deterministic financial logic. | The repository will temporarily have both legacy `src/lib` and new `src/domain` boundaries while functionality migrates incrementally. |
| Domain code can be unit-tested without network, database, or UI setup. | New features require explicit input/output contracts before UI work. |
| Strategy, risk, alerts, journal, and validation gain stable contracts for persistence and APIs. | No domain module may imply broker authorization or place an order. |
| Existing ZS/backtest and Gate.io data paths remain operational during migration. | Full persistence, tenancy, and worker integration remain subsequent milestones. |

## Explicit non-goals

This decision does not add autonomous trading, broker execution, user authentication, a production database, background workers, or a Tauri shell. It establishes only the shared core required for those later, independently approved increments.
