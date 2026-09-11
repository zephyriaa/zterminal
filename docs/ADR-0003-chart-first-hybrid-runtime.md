# ADR-0003: Chart-first hybrid market runtime

## Decision

ZTerminal keeps `/terminal` as the primary interface. The installed runtime is the future authoritative owner of high-rate ingestion, sequence validation, books, aggregation, recording, and replay. The Socket.IO gateway remains the bounded hosted-web fallback. Python consumes immutable recorded datasets and derived research contracts; it does not own live books or rendering.

The first executable slice enables the chart overlay boundary and Big Trades only. It intentionally does not claim L2 liquidity, GEX, historical depth, durable local recording, or professional-feed support.

## Contract rules

- Persist an overlay definition and settings, never live overlay payloads.
- Renderer subscriptions retain bounded mutable buffers and schedule canvas updates; React receives coarse UI state only.
- Aggregate-trade channels are labeled aggregate, never individual executions.
- Tools stay capability- and freshness-gated. Missing, stale, or unsupported data is explicit.
- Wire V2 prices, quantities, timestamps, sequences, and IDs will be decimal strings when the versioned loopback stream is introduced.

## Consequences

The obsolete standalone GEX and Order Flow windows are removed. Big Trades is reached through **Indicators → Order Flow → Big Trades**. The old TypeScript order-flow calculations remain as the hosted fallback until fixture-matched Rust engines supersede them.
