# ADR-0004: Versioned, local-first institutional research workspace

**Status:** Accepted

## Decision

ZTerminal will evolve through shared, versioned domain contracts for workspace,
charts, datasets, strategy revisions, experiment runs, replay, indicators, AI,
order flow, and options. The Next.js terminal and native Windows workstation
share behavior and serialized artifacts, not renderer code.

The Windows Helper is the web-local research execution boundary. Auth.js uses
Prisma with Supabase PostgreSQL for identity/ownership/sync metadata. Persistent
secrets are OS-backed Helper/native secrets referenced through opaque IDs only.
Gemini is introduced through a provider-neutral adapter. Deribit BTC/ETH is the
first options source, with signed gamma analytics explicitly estimated.

## Consequences

- Zustand is an in-memory projection over workspace repositories, not the
  durable workspace authority.
- Sync uses a durable operation outbox, revision cursor, idempotency keys, and
  three-way conflicts; shallow snapshot merge is retired after migration.
- User Python never executes in the Next.js or hosted API process. AI edits are
  reviewable and never automatically applied or run.
- Future microstructure/options research requires immutable manifests and
  availability-time ordering. Missing data fails closed.
- The legacy ZS execution path, duplicate unrestricted quant executor, and
  hosted-Tauri product positioning are deprecated only after consumer inventory
  and migration verification; no destructive retirement occurs in this ADR.
