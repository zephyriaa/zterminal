# Phase 14 Closed Strategy Runtime Contract

**Status:** Implementation contract for the product branch
**Runtime name:** `ZS historical runtime v1`

## Purpose

The runtime connects a validated ZS source to a deterministic historical candle evaluation. It is an AST interpreter for a closed grammar, not an arbitrary JavaScript engine. Source text may declare historical **entry** and **close** signals; it cannot access any host capability or make any real/simulated broker action.

## Inputs and Time Semantics

| Input class | Supported values | Availability |
|---|---|---|
| Candle fields | `open`, `high`, `low`, `close`, `volume`, `time`, `hl2`, `hlc3`, `ohlc4` | Current verified historical candle and prior candles only. |
| Declared parameters | `input.int`, `input.float`, `input.bool`, `input.string` fixed defaults or typed UI overrides within declared limits | Constant throughout a single evaluated run. |
| Pure indicators | `ema`, `sma`, `vwap`, `highest`, `lowest`, `crossover`, `crossunder`, `max`, `min`, `abs` | Calculated solely from eligible loaded candles. |
| Strategy actions | `strategy.entry(id, strategy.long, qty=<positive finite literal>)`, `strategy.close(id)` | Creates a historical signal at the current bar close only. |

Signals are observed after the current candle closes. The historical backtest engine alone models a market fill at the next bar open. A runtime signal never reads a later candle, sees a future close, or uses a historical tick/depth/tape reconstruction.

## Explicitly Unsupported

| Category | Unsupported behavior |
|---|---|
| Code execution | JavaScript evaluation, `eval`, `Function`, imports, `require`, dynamic modules, prototype access, or generated code. |
| I/O and host state | Network, WebSocket, fetch, storage, DOM, browser globals, timers, file/shell/process APIs, credentials, or environment variables. |
| Market data not loaded as verified historical candles | Historical ticks, CVD, DOM/depth, Flow Pulse, order tape, large-order markers, GEX, and cross-venue liquidity. |
| Order types and leverage | Short entries, `strategy.exit`, stop/limit orders, pyramiding, margin, leverage, brackets, partial fills, or broker/paper order routes. |
| Research methods | Optimization, parameter sweep, walk-forward, Monte Carlo, forward performance claims, or silent template fallback. |

## Deterministic Behavior

Every evaluable source must produce the same ordered signal list for the same normalized bars and declared parameter values. Its source fingerprint is the exact validated source text plus runtime version and stable parameter map. The downstream backtest identity additionally includes the engine version, verified data provenance/fingerprint, execution model, and explicit cost configuration.

The runtime returns a diagnostic instead of an output when a valid closed-source construct is outside this version’s executable subset. A compiler-success result alone does not permit historical evaluation; the runtime validation result must also be successful.

## Safety Boundary

> `strategy.entry` and `strategy.close` are historical research declarations only. They do not create a real order, a paper order, a recurring task, an alert, a position, a broker session, or any autonomous action.
