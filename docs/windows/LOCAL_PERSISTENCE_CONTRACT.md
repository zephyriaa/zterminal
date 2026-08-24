# Local Persistence and Workspace Contract

**Status:** Native local-first storage is implemented and validated on Linux and Windows MSVC. This contract does **not** enable cloud synchronization, provider connectivity, remote storage, production migration, or account-based workspace sharing.

## Purpose

The native Windows terminal must launch and remain useful when Render, an identity service, or a market-data provider is unavailable. It therefore owns verified local segments and local workspace intent before any future optional server acknowledgement is considered.

> A cached local segment is never relabelled as live. The application must expose provider provenance and a truthful `live`, `cached`, `stale`, `gap`, `unavailable`, or `corrupt` state.

| Component | Location | Behaviour |
|---|---|---|
| Bounded cache index | `crates/zt-storage::CacheIndex` | Retains only the configured byte budget and returns LRU evictions for the storage worker. |
| Immutable local segment store | `crates/zt-storage::SegmentStore` | Writes a new payload and readable metadata record, flushes both locally, rejects overwrite, and verifies length plus a recorded FNV-1a corruption-detection hash before returning bytes. |
| Offline availability mapping | `crates/zt-storage::local_availability` | Converts verified provenance and freshness into `Live`, `Cached`, `Stale`, `Gap`, `Unavailable`, or `Corrupt` without manufacturing continuity. |
| Workspace journal | `crates/zt-storage::WorkspaceJournal` | Appends flushed, quota-bounded local workspace snapshots and replays only the latest revision for each workspace without a network call. |
| Workspace compaction | `crates/zt-storage::WorkspaceJournal::compact` | Rewrites a journal to the latest revision per workspace after checking the configured local budget. The Windows path flushes a writable temporary journal, then uses a recoverable in-place local rewrite that satisfies Windows handle requirements. |
| Local quota policy | `CacheBudget` and `WorkspaceJournalBudget` | Makes cache and journal bounds explicit; a write that exceeds a local quota fails truthfully rather than deleting arbitrary user data. |

The current segment format is deliberately simple and dependency-light: immutable binary payloads are stored separately from versioned text metadata under a caller-provided local root. This keeps failure behaviour testable before any later SQLite/WAL metadata migration and compressed segment codec are considered.

## Local workspace lifecycle

A workspace snapshot is identified by a caller-stable `workspace_id` and a strictly increasing local `revision`. Its opaque payload belongs to the calling UI schema; the storage layer neither interprets it nor contacts a service while persisting it. `latest()` replays the newest valid snapshot for every workspace identifier, and `compact()` retains that same newest snapshot set while reducing append-only journal growth.

| State or action | Local outcome | Network behaviour | Safety rule |
|---|---|---|---|
| Save snapshot | Appends and flushes one local record within the configured journal budget. | None. | The caller supplies a newer local revision; no implicit merge occurs. |
| Reopen terminal | Replays the latest valid snapshot per workspace from the local journal. | None. | The local device remains the source of truth. |
| Compact journal | Retains only the newest local revision per workspace and flushes the compacted result. | None. | It preserves retained `LocalOnly`, `Queued`, `Synced`, or `Conflict` labels exactly; it does not resolve a conflict. |
| Journal budget exceeded | Returns `WorkspaceBudgetExceeded`; prior journal contents remain available. | None. | The terminal must request explicit user action instead of silently discarding workspace intent. |
| Local I/O replacement error | Returns a storage error and attempts to restore the prior in-memory journal bytes on the Windows in-place replacement path. | None. | The application must surface the failure and must not claim the compaction completed. |
| Cloud, Render, or identity outage | Local workspaces, verified cache, replay, and research continue independently. | No retry is initiated by this crate. | An outage cannot convert cached state into live state or erase the local workspace. |

The durable journal is a **single-device local source of truth** in this phase. `WorkspaceSyncState` records an explicit state vocabulary for a future, separately authorized synchronization layer, but it does not open a connection, enqueue an HTTP request, activate `/api/cloud/workspaces`, or authenticate a user.

## File and data-failure semantics

A local segment identity is `(symbol_id, interval_ns, start_ns)`. The storage implementation accepts a new identity once and will not silently replace its bytes. A metadata-write failure removes the new payload, and all completed payload/metadata writes are flushed before success is returned. Eviction deletion is explicit. Startup listing ignores incomplete records whose payload is missing.

| Condition | Local result | User-visible implication |
|---|---|---|
| Fresh verified data | `Live` or `Cached` within freshness budget | Data remains locally available with provenance. |
| Data beyond freshness budget | `Stale` | Display remains usable for research/replay but must not be called live. |
| Provider sequence gap | `Gap` | Relevant range is withheld; no interpolation or artificial bar is created. |
| No verified local range | `Unavailable` | The terminal shows no data instead of a substitute provider or synthetic history. |
| Payload length/hash mismatch | `Corrupt` | The damaged segment is withheld pending explicit deletion or re-download. |
| Cache or journal quota exceeded | Storage error | Existing data is retained; the terminal must ask for an explicit retention decision. |
| Cloud or Render outage | No local storage failure | Local workspace, verified cache, replay, and research remain independent of the outage. |

## Import, export, and cloud boundary

Portable workspace import and export are **not yet implemented**. Until a versioned container, schema validation, byte budget, provenance policy, and explicit conflict/overwrite UX exist, the product must not expose a workspace import action. In particular, it must never silently overwrite a local workspace with an imported file.

Cloud synchronization remains intentionally disabled. A later opt-in sync path must operate above the local journal, require durable owner isolation and migration evidence, surface conflicts explicitly, and treat the local state as the source of truth until a verified acknowledgement arrives. It must remain disabled unless those independent readiness gates have been demonstrated.

The FNV-1a value detects accidental local corruption; it is **not** a provider-authenticity or release-signature mechanism. Provider validation, signed update manifests, and any future remote configuration remain separate trust boundaries.

## Next integration slice

The fixture-only Direct3D chart must be replaced by a Rust scene contract that consumes `SegmentStore::read` results and `LocalAvailability` state. The native renderer must label source and freshness, handle resize/device reset and frame pacing, and refuse to render a missing, corrupt, or gapped range as continuous market history. That future work remains local-first and does not authorize the hosted wrapper to become the desktop product.
