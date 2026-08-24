# Local Scene Bridge Contract

**Status:** Implemented and validated as a local, read-only native integration slice. The bridge remains intentionally separate from network transport, cloud synchronization, broker execution, and the legacy hosted wrapper. No real provider-produced segment has yet been loaded on the reference machine.

## Purpose

The Direct3D host cannot receive arbitrary local segment bytes. It needs a narrow, versioned boundary that exposes only the bounded `LocalChartScene` result already prepared by `zt-core`. The first bridge uses a local child-process request/response protocol because the Rust workspace forbids unsafe code and no C ABI has yet been authorized. It is a temporary integration boundary, not a background service or a server.

> The native host must start in a **withheld/unavailable** chart state when it has not received an explicitly requested verified local scene. It must not auto-create fixture candles, query Render, or contact a market-data provider.

| Element | Rule |
|---|---|
| Bridge executable | A local `zt-local-scene-bridge` Rust binary invoked by the host only for an explicit local scene load. It has no listener, daemon, socket, or network dependency. |
| Request version | `1`; all fields are passed by exact command-line flags. Unknown/malformed values fail closed. |
| Source root | Caller-supplied local `SegmentStore` root. The bridge does not infer a cloud or server path. |
| Segment identity | Exact `symbol_id`, `interval_ns`, and `start_ns`; no symbol aliasing or provider fallback. |
| Freshness | Caller must supply `now_ns` and `freshness_budget_ns`; the payload’s durable capture time is used, never local access time. |
| Draw window | Exact `first_bar` and `visible_bars`; `zt-core` enforces the 2,000-candle limit. |
| Output | One schema-versioned JSON object on stdout. Diagnostics and errors are written to stderr; the process returns non-zero for malformed requests or local I/O errors. |
| Withheld range | A valid JSON `withheld` response, including only the status and retained count. It never includes candles. |

## Output schema

The first output schema is intended for direct, bounded host parsing without a JSON dependency. The bridge emits only ASCII enum labels, unsigned integer fields, signed integer OHLCV values, and a fixed candle order.

| Field | Meaning |
|---|---|
| `schema_version` | Constant `1`. The host must reject any other version. |
| `kind` | `renderable` or `withheld`. |
| `availability` | `live`, `cached`, `stale`, `gap`, `unavailable`, or `corrupt`; `cached` and `stale` also include an age. |
| `total_bars` and `first_bar` | Retained source count and exact visible-window origin for renderable scenes. |
| `candles` | Bounded array of integer-tick OHLCV candle objects for renderable scenes only. |
| `retained_bars` | Decoded count for a withheld scene when available. |

The host must make every unavailable/degraded state visible in its title or overlay and render no replacement candles. An unexpected bridge process failure is treated as `unavailable` locally; it is not a reason to call Render or a public provider.

## Host modes

| Host mode | Activation | Permitted data | Title/diagnostic expectation |
|---|---|---|---|
| Default native mode | No explicit fixture or verified local scene request | None | `LOCAL DATA UNAVAILABLE`; the chart surface is blank. |
| Local scene mode | Explicit bridge request with a local segment root and exact key/window | Only `renderable` bridge candles | `LOCAL LIVE` or `LOCAL CACHED`; diagnostics record `fixture_only: false`. |
| Withheld local mode | Valid bridge response for stale, gap, unavailable, or corrupt data | None | The specific truthful withheld reason; no continuity rendering. |
| Fixture diagnostic mode | Explicit `--fixture-candles` command-line flag | Deterministic fixtures only | `FIXTURE ONLY`; diagnostics record `fixture_only: true`. |

## Non-goals and subsequent work

This bridge does not persist provider bars, find or merge multiple segments, create market-data subscriptions, activate a local database migration, synchronize a workspace, implement C FFI, or improve Direct3D frame pacing. A later versioned in-process ABI may replace the child-process boundary only after it can preserve these same fail-closed semantics and comply with the workspace’s unsafe-code policy.

## Windows validation evidence

The Windows MSVC build packages `zt-local-scene-bridge.exe` beside `ZTerminalWindowsHost.exe`. The Rust bridge unit tests passed for strict flag validation and an absent local layout. The native host then passed three bounded two-second Windows smoke runs on the connected reference device: default startup reported `chart_source: withheld`, `fixture_only: false`, `LOCAL DATA UNAVAILABLE`, and zero candles; explicit `--fixture-candles=10000` reported `chart_source: fixture`, `fixture_only: true`, and 10,000 diagnostic candles; and an explicit local request for a missing local segment root reported the same truthful withheld/unavailable state with zero candles. None of these runs contacted a server or provider.

The raw record is retained at `docs/windows/benchmarks/windows-local-scene-smoke.json`.

This proves the fail-closed host and the fixture diagnostic separation. It does **not** prove a production live-data chart, multi-segment navigation, background persistence, entitlement, cloud sync, signing, updates, or performance acceptance.
