# Offline Provider Frame Import Contract

**Status:** Implemented and validated on Linux and Windows MSVC as a local-only import command. It accepts a user-selected local text file of Binance public aggregate-trade frames, but it neither opens a socket nor imports credentials, account data, positions, balances, orders, or cloud workspaces. Validation used deterministic local frame fixtures only; it did not open a provider connection.

## Purpose

The native host can already render a bounded scene from an integrity-checked local segment. The local persistence session can encode only completed contiguous `Live` bars. This command joins those local components for controlled offline verification: an operator supplies previously obtained provider frames, exact normalization scales, a local store root, and an explicit flush choice. It does not treat a file as live data merely because its records carry `Live` provider provenance; freshness is determined later from the caller-supplied verified capture time.

> Every input line is one provider-shaped JSON frame. A malformed line, wrong symbol, nonrepresentable decimal, aggregate-ID gap, engine gap, degraded result, out-of-order event, or batch-bound violation withholds the local batch. The command must never fill bars, skip the problem silently, call a provider, or select another provider.

| Input | Required rule |
|---|---|
| Provider | Exact `binance-spot-aggtrade` only. No alternate provider, symbol alias, Render proxy, or fallback. |
| Frame file | Caller-supplied UTF-8 text file, one non-empty JSON frame per line, bounded by byte and frame limits. The importer does not fetch URLs. |
| Subscription | Exact `symbol_id`, provider symbol, integer price/quantity scales, and stream ID. The adapter rejects any mismatched frame. |
| Bar interval | Explicit positive nanoseconds; completed observed bars are the only bars eligible for retention. |
| Local root | Explicit filesystem directory used by `SegmentStore`; no default cloud, browser, or server location. |
| Capture and access time | Explicit unsigned values; no synthetic clock substitution. Capture time is retained in the encoded local payload. |
| Flush | An explicit `--flush` flag is required before an immutable write. Without it, the command reports the local result but writes nothing. |

## Terminal outcomes

| Outcome | Meaning | Store behaviour |
|---|---|---|
| `not_requested` | Frames were processed but the caller did not request final persistence. | No write. |
| `empty` | No completed bar became eligible before input ended. | No write; active trailing bar is not fabricated. |
| `withheld` | A gap, rejection, or degraded condition invalidated the batch. | No write. |
| `persisted` | A non-empty contiguous batch encoded and passed immutable store checks. | One new local segment. |
| `existing_segment` | The exact local segment key already exists. | Existing bytes remain unchanged; no overwrite. |
| `error` | Configuration, input bound, decode, or local I/O failure. | No fallback, retry, merge, or write beyond a previously completed immutable operation. |

## Native host handoff

A successful result prints the exact segment identity (`symbol_id`, `interval_ns`, `start_ns`) and the local store root supplied by the caller. The native host may then be launched with its explicit local-scene request. A later host scene remains subject to integrity verification, 2,000-candle draw bounds, and current freshness/status checks; import success does not promise a currently live chart.

## Non-goals

This command is not a data downloader, historical backfill tool, sustained stream, reconnect controller, provider entitlement checker, scheduler, local database migration, cloud synchronizer, execution engine, installer, updater, or signed release mechanism. Those remain separate gated work.

## Validation evidence

The importer unit suite validates a successful verified three-frame import that creates an integrity-checked local segment and produces a renderable `LocalChartScene`; an aggregate-ID gap that is withheld with no segment write; explicit no-flush behaviour; and a restart conflict that leaves the original immutable segment bytes unchanged. The focused importer tests and strict linting passed on Linux and on the connected Windows MSVC device. The command’s end-to-end local fixture run reported `network_opened: false`, two retained completed bars, and one persisted 160-byte segment. This is evidence of the offline local path only, not a claim of current market availability or provider entitlement.

## Native host end-to-end evidence

The connected Windows device imported three explicitly **test-only** offline aggregate-trade frames through the local command, then passed the returned immutable segment identity to the native Direct3D host. The importer reported `network_opened: false`, `outcome: persisted`, and a 160-byte segment containing two completed bars. The native host reported `fixture_only: false`, `chart_source: local_scene`, and two rendered candles. It truthfully labelled the view `LOCAL CACHED` because the imported capture time had elapsed; it did not claim the offline fixture was currently live. Renderer resize, device-recovery, and present-failure counters were all zero for that run.

The raw test-only record is retained at `docs/windows/benchmarks/windows-offline-import-local-scene-smoke.json`. It proves the local import-to-scene-to-Direct3D handoff only. It does **not** prove a genuine provider connection, a fresh live chart, entitlement, backfill, reconnect, multiple segment navigation, cloud synchronization, execution, signing, installer delivery, or updates.
