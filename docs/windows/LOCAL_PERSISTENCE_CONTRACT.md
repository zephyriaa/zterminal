# ZTerminal Local Persistence Contract

**Status:** Initial native local-first foundation implemented and validated on Linux and Windows MSVC. This contract does not enable cloud synchronization, provider connectivity, remote storage, or production migration.

## Purpose

The native Windows terminal must continue to launch and remain useful when Render, an identity service, or a market-data provider is unavailable. It therefore owns verified local segments and workspace intent before it attempts any optional server acknowledgement.

> A cached local segment is never relabelled as live. The application must expose its provider provenance and a truthful `live`, `cached`, `stale`, `gap`, `unavailable`, or `corrupt` state.

## Implemented foundation

| Component | Location | Behaviour |
|---|---|---|
| Bounded cache index | `crates/zt-storage::CacheIndex` | Retains only the configured byte budget and returns LRU evictions for the storage worker. |
| Immutable local segment store | `crates/zt-storage::SegmentStore` | Writes a new payload and readable metadata record, flushes both locally, rejects overwrite, and verifies length plus a recorded FNV-1a corruption-detection hash before returning bytes. |
| Offline availability mapping | `crates/zt-storage::local_availability` | Converts verified provenance/freshness into `Live`, `Cached`, `Stale`, `Gap`, `Unavailable`, or `Corrupt` without manufacturing continuity. |
| Workspace journal | `crates/zt-storage::WorkspaceJournal` | Appends flushed, quota-bounded local workspace snapshots and replays only the latest revision for each workspace without a network call. |
| Local quota policy | `CacheBudget` and `WorkspaceJournalBudget` | Makes cache and journal bounds explicit; a write that exceeds a local quota fails truthfully rather than deleting arbitrary user data. |

The current segment format is deliberately simple and dependency-light: immutable binary payloads are stored separately from versioned text metadata under a caller-provided local root. This makes its failure behaviour testable before the later SQLite/WAL metadata migration and compressed segment codec are introduced.

## File and failure semantics

A local segment identity is `(symbol_id, interval_ns, start_ns)`. The storage implementation accepts a new identity once and will not silently replace its bytes. A metadata write failure removes the new payload, and all completed payload/metadata writes are flushed before success is returned. Eviction deletion is explicit. Startup listing ignores incomplete records whose payload is missing.

| Condition | Local result | User-visible implication |
|---|---|---|
| Fresh verified data | `Live` or `Cached` within freshness budget | Data remains locally available with provenance. |
| Data beyond freshness budget | `Stale` | Display remains usable for research/replay but must not be called live. |
| Provider sequence gap | `Gap` | Relevant range is withheld; no interpolation or artificial bar is created. |
| No verified local range | `Unavailable` | The terminal shows no data instead of a substitute provider or synthetic history. |
| Payload length/hash mismatch | `Corrupt` | The damaged segment is withheld pending explicit deletion or re-download. |
| Cache/journal quota exceeded | Storage error | The terminal keeps existing data and asks for user action; it does not silently remove unsynced workspace state. |
| Cloud or Render outage | No local storage failure | Local workspace, verified cache, replay, and research remain independent of the outage. |

## Scope boundary

The FNV-1a value detects accidental local corruption; it is **not** a provider-authenticity or release-signature mechanism. Provider validation, signed update manifests, and any future remote configuration remain separate trust boundaries.

Cloud synchronization remains intentionally disabled. A later opt-in sync path must operate above the local journal, require durable owner isolation and migration evidence, surface conflicts explicitly, and treat the local state as the source of truth until a verified acknowledgement arrives.

## Next integration slice

The next native chart vertical slice consumes only `SegmentStore::read` results and the `LocalAvailability` state. It must draw verified local candles for 10k and 100k points, visibly label source/freshness, and refuse to render a missing/corrupt/gapped range as continuous market history.
