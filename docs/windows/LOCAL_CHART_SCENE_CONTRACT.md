# Local Chart Scene Contract

**Status:** Implemented as a Rust-only local scene-preparation foundation. It is validated on Linux in this change and awaits the paired Windows MSVC validation. The Direct3D host remains **fixture-only** until a separately versioned FFI bridge consumes this contract.

## Purpose

`zt-core` now establishes the product boundary between durable local market-data segments and a bounded native chart scene. The boundary prevents arbitrary bytes, stale snapshots, gaps, unavailable ranges, and logically invalid OHLCV payloads from becoming visually continuous candles in the Windows renderer.

> The scene-preparation path reads an integrity-checked local segment. It has no network client, Render call, cloud synchronization, provider fallback, broker action, or synthetic-bar path.

| Contract element | Rust API | Responsibility |
|---|---|---|
| Immutable source | `zt-storage::SegmentStore` | Verifies persisted payload length and recorded corruption-detection hash before scene decoding. |
| Versioned bar payload | `encode_local_bar_segment` | Stores a captured-at timestamp and strictly contiguous observed bars for one `SegmentKey`. |
| Bounded request | `LocalSceneRequest` | Accepts an explicit source offset and 1–2,000 visible candles only. |
| Scene result | `prepare_local_chart_scene` | Returns a renderable candle subset only when local availability is `Live` or within-budget `Cached`; otherwise returns an explicit withheld state. |
| Host-facing model | `RenderableLocalScene` and `LocalChartScene` | Keeps total retained bars, source offset, truthful availability, and bounded visible candles distinct from Direct3D vertices. |

## Payload and validation rules

A local bar payload has the `ZTBAR001` magic, a version field, the provider-verification capture time, a bar count, and fixed-width `Bar` records. The capture time is stored inside the immutable payload because local cache access time is not evidence that the provider data is fresh. Every record must belong to the requested `SegmentKey`, have the declared interval, occupy the next exact interval start, contain a positive volume, and satisfy its OHLC bounds.

| Constraint | Enforced limit or outcome |
|---|---|
| Decoded local segment | At least 1 and at most **100,000** bars. |
| Render request | At least 1 and at most **2,000** visible candles. |
| Time continuity | Every `open_time_ns` must equal `SegmentKey.start_ns + index × interval_ns`; missing intervals are rejected. |
| Price and volume invariants | `low ≤ open/close ≤ high` and `volume > 0`; invalid records are rejected. |
| Segment integrity failure | `SegmentStore` withholds the stored bytes before decoder use. |
| Logical payload failure | The payload is reported as `Corrupt`; no candles are returned. |
| Request outside retained range | An explicit `InvalidRequest` error is returned; the source range is not clamped or invented. |

## Truthful availability outcomes

The contract computes local availability from persisted segment provenance, the payload’s capture time, the caller’s current time, and an explicit freshness budget. A worst-status rule also considers every contained bar. Therefore, a single gapped, unavailable, or stale bar cannot be hidden inside an otherwise healthy segment.

| Observed local condition | `LocalChartScene` result | Renderer rule |
|---|---|---|
| Verified data captured at the requested moment | `Renderable` with `Live` | The host may draw the bounded candles and label their provenance. |
| Verified data within the supplied freshness budget | `Renderable` with `Cached { age_ns }` | The host may draw it as cached, never as a new live feed. |
| Snapshot beyond the freshness budget or stale status | `Withheld { Stale }` | Do not render as a continuous market range. |
| Bar or segment status is `Gap` | `Withheld { Gap }` | Do not interpolate, fill, or continue candles through it. |
| Bar or segment status is `Unavailable` | `Withheld { Unavailable }` | Do not query a silent fallback provider. |
| Segment is missing | `Withheld { Unavailable }` | Show local absence, not a substitute history. |
| Segment verification or logical payload parsing fails | `Withheld { Corrupt }` | Withhold the range pending explicit repair or re-download. |

## Validation coverage

The Rust test suite exercises a 3,000-bar local segment whose scene request returns exactly 2,000 cached candles; it confirms the returned source offset and retains no excess visible candles. Separate tests confirm that `Gap`, `Stale`, missing, and logically corrupt data return withheld results with no candles, and that noncontiguous records and oversized draw requests are rejected.

This evidence validates only the Rust preparation contract. It is not a claim that the C++/Direct3D host has switched away from fixtures, that a provider transport persists production history, or that native 60 FPS performance has been accepted.

## Required next bridge

The next integration must introduce a narrow, versioned Rust-to-Windows scene bridge. It must pass `LocalChartScene` states and integer-tick candle values to the host, preserve the 2,000-candle output cap, and cause the host title/overlay to label `Live`, `Cached`, or a withheld reason. It must not expose raw arbitrary segment bytes to C++, use a WebView, activate cloud synchronization, or make the hosted wrapper the desktop product.

The Direct3D renderer still also needs resize/device-reset resilience, persistent vertex-range updates, and synchronized presentation/frame-pacing measurement on the documented reference tiers. Those performance and UX requirements remain distinct from the local data-integrity gate established here.
