# BACKTESTING

Z TERMINAL's backtester is an **event-driven, deterministic** engine that
runs ZS strategies bar-by-bar against normalized OHLCV bars. It is designed
around one principle: **identical inputs always produce identical trades.**

Source: `src/lib/strategy/zs-runtime.ts`. API entry point:
`POST /api/backtest` (`src/app/api/backtest/route.ts`).

## 1. Execution model — anti look-ahead

The single most important rule in the engine:

> **A signal generated on `bar[i]` (evaluated at bar close) is executed at
> `bar[i+1].open`, adjusted by slippage and commission. You cannot trade on
> the bar that produced the signal.**

Concretely, the main loop is:

```text
for i in 0..bars.length:
    1. processFills(i)            // fill pending orders from bar[i-1] at bar[i].open
    2. evaluate strategy at bar[i] // signals fire here, queue pending orders
    3. mark-to-market equity      // unrealized PnL at bar[i].close
```

- **Market orders** submitted at bar `i` enter a `pending` queue and fill at
  `bars[i+1].open` (next-bar-open fill model — `cfg.executionModel` is
  `"next_bar_open"`).
- **Slippage** is applied directionally: longs fill at `open + slip`, shorts
  fill at `open − slip`, where `slip = slippageTicks * tickSize`.
- **Commission** is charged per contract per side; a round-turn exit doubles
  it (`commissionPerContract * qty * 2`).
- **Reversal handling:** if a new `strategy.entry` arrives for the opposite
  side while a position is open, the engine closes the existing position at
  the current close (reason `"reverse"`) before opening the new one.
- **End of data:** any open position at the last bar is closed at the last
  close (reason `"end of data"`).

This prevents look-ahead bias by construction: the strategy cannot see
`bar[i+1]` when it decides to act at `bar[i]`.

## 2. Cost modeling

The following are **explicit** in `BacktestConfig` and contribute to the
determinism hash:

| Field                   | Meaning |
|-------------------------|---------|
| `commissionPerContract` | round-turn $ per contract |
| `slippageTicks`         | slippage in ticks applied against the fill |
| `spreadTicks`           | bid/ask spread modeling (declared; reserved for limit/stop fills) |
| `tickSize`               | from `ContractMetadata` — minimum price increment |
| `tickValue`             | $ value of one tick (per contract/share) |
| `multiplier`            | point multiplier (futures) or 1 (equities) |
| `positionSize`          | contracts per entry (default 1) |
| `initialCapital`        | starting cash |
| `executionModel`        | `"next_bar_open"` (the engine's anti-look-ahead mode) |

PnL is computed as:
```
gross  = (exit − entry) * qty * multiplier          // for longs
gross  = (entry − exit) * qty * multiplier          // for shorts
pnl    = gross − commission                          // net
```

## 3. Position sizing

Current: fixed `positionSize` contracts per entry (default 1). The engine
does **not** yet implement volatility-targeted sizing, Kelly fraction, or
risk-percent sizing — these are roadmap items (see `ROADMAP.md`).

## 4. Determinism guarantee

- **No `Math.random`** anywhere in the engine path. The mock provider's RNG
  is `mulberry32` seeded from `hashString("symbol|tf|globalBarIndex")` —
  fully deterministic. See `src/lib/market/rng.ts`.
- The result carries a **hash** (`hashInputs`) computed by FNV-1a over:
  ```
  src | symbol | timeframe | from | to | initialCapital |
  commissionPerContract | slippageTicks | spreadTicks |
  tickSize | tickValue | multiplier | positionSize | executionModel |
  JSON(params) | barsCount
  ```
- `runId = "bt_" + hash.slice(0, 10)`. Two runs with the same hash produce
  identical `trades`, `equity`, `drawdown`, and `metrics`.

## 5. What is PREVENTED

- **Look-ahead bias** — by the next-bar-open fill model above.
- **Future leakage** — the strategy's `var` series are lazy thunks
  `(i) => value`; `crossover`/`crossunder` evaluate the series at both `i`
  and `i-1` but never beyond `i`.
- **Non-determinism** — no `Math.random`, no `Date.now()` in the engine
  itself (only `ranAt` is wall-clock, which is metadata, not a trade input).
- **Hidden costs** — commission and slippage are always applied and always
  visible in the trade list and metrics.

## 6. What is MODELED

- **Commission** — per-contract, round-turn on exits.
- **Slippage** — directional, in ticks, applied at fill.
- **Spread** — declared in config (reserved for limit/stop fill modeling).
- **Tick alignment** — prices snap to `tickSize`.
- **Multiplier** — futures point multiplier (e.g. NQ = 20, ES = 50).
- **Session volume profile** — the mock provider's bar generator applies
  `sessionVolMultiplier(t)` (U-shape across RTH, lower overnight).

## 7. Types

```ts
interface BacktestConfig { /* see §2 */ }

interface BacktestTrade {
  id: number;
  side: "long" | "short";
  entryTime: number; entryPrice: number;
  exitTime: number;  exitPrice: number;   // net of slippage
  qty: number;
  pnl: number;          // net of commission
  pnlPct: number;
  bars: number;
  reason: string;       // "reverse" | "signal close" | "exit" | "end of data"
}

interface BacktestResult {
  config: BacktestConfig;
  trades: BacktestTrade[];
  equity: { t: number; v: number }[];      // mark-to-market per bar
  drawdown: { t: number; v: number }[];    // equity − running peak
  metrics: BacktestMetrics;                 // see STATISTICS.md
  runId: string;
  hash: string;                             // determinism key
  ranAt: number;
  barsProcessed: number;
}
```

The `/api/backtest` response additionally carries `monthly` returns and
`timeframeSeconds`.

## 8. Roadmap (not yet implemented)

The following are documented as roadmap items — they are **not** in the
current engine and must not be presented as available:

- **Limit / stop / bracket fills** — currently `strategy.exit` closes at
  market next bar. True limit/stop fill modeling (fill when next bar trades
  through the limit/stop price) is planned.
- **Walk-forward analysis** — in-sample fit, out-of-sample validation
  windows.
- **Monte Carlo simulation** — trade-order resampling for confidence
  intervals on drawdown and terminal equity. See `STATISTICS.md`.
- **Parameter sensitivity / optimization sweeps** — grid and randomized
  search with out-of-sample discipline.
- **Contract rolls / continuous contracts** — explicit roll on the
  configured roll date with ratio (back-adjusted) or pan (price) method.
  The mock provider currently exposes a single front-month synthetic
  series.
- **Volatility-targeted and risk-percent position sizing.**
