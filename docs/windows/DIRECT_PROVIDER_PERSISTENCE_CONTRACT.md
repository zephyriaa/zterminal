# Direct Provider Persistence Contract

**Status:** Design and implementation boundary for deterministic local ingestion. This contract does **not** activate the `live-public` feature, reconnect a provider, open a socket, backfill history, use Render, synchronize cloud data, or route orders.

## Purpose

The existing direct Binance adapter normalizes one explicitly selected public aggregate-trade frame and reports an aggregate-ID discontinuity rather than hiding it. The local engine converts only observed normalized trades into completed bars. This contract connects those two foundations to immutable local storage without allowing a raw transport frame, a partial active bar, or a degraded range to become a renderable segment.

> A persisted segment contains only complete bars whose source `DataStatus` is `Live` and whose time intervals are exactly contiguous. A gap, malformed frame, rejected trade, stale/degraded bar, or incomplete active bar is not persisted as a healthy segment.

| Boundary | Responsibility | Explicitly excluded |
|---|---|---|
| Direct adapter | Produces `Trade`, `Gap`, or `Rejected` from one selected provider’s received frame. | Provider selection fallback, credentials, account channels, persistence, or execution. |
| Local bar engine | Builds a completed bar only when a later observed interval begins. | Filler bars, historical repair, inferred continuity, or transport reconnect. |
| Persistence session | Buffers a bounded sequence of complete local `Live` bars for one exact symbol and interval, then writes one immutable segment. | Raw-frame storage, active-bar writes, automatic batch flush, cloud request, or data mutation. |
| `SegmentStore` | Verifies immutable bytes and rejects overwrites. | Merge, replacement, or conflict resolution. |
| Local chart scene | Decodes only integrity-checked contiguous segments and withholds degraded states. | Visual interpolation or a silent provider fallback. |

## Session lifecycle

A local persistence session is created with an explicit `symbol_id`, fixed interval, caller-chosen local segment budget, and `SegmentStore` root. It begins in `Collecting`, accepts only `EngineEvent::Completed` bars for its exact key, and reaches `Ready` only when the caller explicitly invokes a flush. A session never starts a transport, schedules a timer, or opens a background task.

| Input or action | Session result | Local-storage outcome |
|---|---|---|
| Valid same-interval observed trade | `UpdatedActiveBar` | No write. The active bar remains provisional. |
| Completed `Live` bar contiguous with batch | Buffered | No write until an explicit flush. |
| Completed non-`Live` bar | Degraded and discarded | No healthy segment is written. |
| Sequence or interval gap | Degraded and batch cleared | No filler or replacement segment is written. |
| Malformed/rejected/out-of-order event | Withheld | No write. |
| Explicit flush with a complete contiguous batch | Immutable segment write | Encodes capture time and writes through `SegmentStore`; existing keys are never replaced. |
| Explicit flush with an existing segment key | Explicit conflict result | Existing local history remains intact; no overwrite occurs. |
| Restart before flush | No implicit recovery or write | Buffered memory is intentionally lost; only previously successful immutable segments remain. |

## Bounds and local truthfulness

The initial implementation retains at most **100,000** completed bars in a session and rejects a zero interval or a zero bar budget. It encodes the batch through `encode_local_bar_segment`, which records the verification capture time rather than deriving freshness from access time. The caller supplies the capture timestamp and `SegmentStore` access clock explicitly; a persistence session does not use the device clock as a substitute for provider evidence.

A single gap or degraded input invalidates the in-memory batch before an explicit flush. This is intentionally conservative: the implementation does not split, repair, backfill, or retain a partial healthy prefix as if the later discontinuity were irrelevant. A future user-visible recovery workflow may create a new session only after an independently verified recovery boundary.

## Scope gates

The later direct transport lifecycle must remain separately authorized and testable. Before the opt-in `live-public` probe can be elevated into a sustained local connection, it needs explicit subscription ownership, reconnect/backoff limits, provider rate-limit handling, verified backfill semantics, durable cache quota coordination, user-visible entitlement/provenance, and device lifecycle control. No part of this persistence session authorizes those capabilities.
