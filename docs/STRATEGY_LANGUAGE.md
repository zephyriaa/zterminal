# STRATEGY_LANGUAGE

**ZS — Z Strategy Language** is a small custom DSL for authoring bar-by-bar
trading strategies that run against Z TERMINAL's deterministic backtest
engine. It is **Pine-like in spirit** (series, inputs, `strategy.entry`)
but it is explicitly **NOT Pine-compatible**. Compilation does not fake
Pine compatibility — Pine-specific functions, namespaces, and behaviors are
not supported.

Source: `src/lib/strategy/zs-compiler.ts` (tokenizer + parser + AST),
`src/lib/strategy/zs-runtime.ts` (bar-by-bar evaluator).

## 1. What ZS is (and is not)

**ZS is:**
- A custom DSL with a documented grammar subset (below).
- Deterministic: identical `(source, bars, config, params)` → identical
  trades and metrics.
- Designed for the backtest engine's anti-look-ahead execution model
  (signal on `bar[i]` fills at `bar[i+1].open`).
- Strongly shaped around series + indicators + a small set of strategy
  actions.

**ZS is NOT:**
- Pine Script. There is no `ta.*` namespace, no `plotshape`, no
  `request.security`, no `barmerge.*`, no Pine v5/v6 object model. Code
  written for TradingView will **not** compile unchanged.
- A general-purpose language. No loops, no user-defined functions, no
  arrays (yet). The grammar is intentionally small.
- A live-trading language. Strategies produce backtest trades; they do not
  route orders to any exchange.

## 2. Grammar subset

```text
strategy("name", overlay=true, initial_capital=100000)
input.float("Fast", 8, minval=1, maxval=200, step=1)
input.int("Slow", 21, minval=1)
input.bool("UseVwap", true)
input.string("Mode", "default")

var fastEma = ema(close, Fast)
var slowEma = ema(close, Slow)

plot(fastEma, "EMA Fast")
plot(slowEma, "EMA Slow")
plot(vwap, "VWAP")

if close > vwap
  if crossover(fastEma, slowEma)
    strategy.entry("long", strategy.long, qty=1)

if crossunder(fastEma, slowEma)
  strategy.close("long")
```

### Statements
- `strategy("name", …)` — declares strategy name (first string arg).
- `input.float / input.int / input.bool / input.string("Name", default,
  minval=, maxval=, step=)` — declares a parameter surfaced to the UI and
  the backtest config.
- `var name = expr` — top-level series assignment. Becomes a lazy thunk
  `(i) => value` so the series supports lookback for `crossover`/
  `crossunder`.
- `name = expr` — scalar assignment (inside `if` bodies).
- `plot(series, "label")` — **no-op** at runtime; reserved for future
  chart overlay rendering.
- `if cond <single statement>` — single-statement body. Multi-statement
  bodies require explicit grouping or separate `if` statements (the
  parser consumes exactly one following statement).

### Expressions
- Numeric, string (`"…"` or `'…'`), boolean (`true` / `false`).
- Binary ops: `+ - * / %`, comparisons `> < >= <= == !=`.
- Unary `-` and `!`.
- Identifiers: built-in series, built-in funcs, declared inputs, local
  vars, and the constants `strategy.long` / `strategy.short`.
- Calls: `func(arg, …, name=value)` — positional and named arguments
  supported.

### Comments
`#` to end of line.

## 3. Built-in series

| Series   | Value at bar `i` |
|----------|------------------|
| `open`   | `bars[i].o` |
| `high`   | `bars[i].h` |
| `low`    | `bars[i].l` |
| `close`  | `bars[i].c` |
| `volume` | `bars[i].v` |
| `time`   | `bars[i].t` (UTC ms) |
| `hl2`    | `(high + low) / 2` |
| `hlc3`   | `(high + low + close) / 3` |
| `ohlc4`  | `(open + high + low + close) / 4` |

## 4. Built-in functions

| Function | Signature | Notes |
|----------|-----------|-------|
| `ema`    | `ema(source, period)` | EMA over `close`; source arg accepted for API compatibility |
| `sma`    | `sma(source, period)` | SMA over `close` |
| `vwap`   | `vwap` (no args) | Session-anchored (resets per ET day) |
| `highest`| `highest(source, period)` | Rolling high of `high` |
| `lowest` | `lowest(source, period)` | Rolling low of `low` |
| `atr`    | `atr(source, period)` | Average true range |
| `rsi`    | `rsi(source, period)` | Wilder's RSI over `close` |
| `stdev`  | `stdev(source, period)` | Standard deviation of `close` |
| `crossover`   | `crossover(a, b)` | `a[i-1] <= b[i-1] && a[i] > b[i]` |
| `crossunder`  | `crossunder(a, b)` | `a[i-1] >= b[i-1] && a[i] < b[i]` |
| `max`    | `max(a, b)` | |
| `min`    | `min(a, b)` | |
| `abs`    | `abs(a)` | |
| `plot`   | `plot(series, "label")` | No-op for display (reserved) |

Indicators are memoized per period (`ema`, `sma`) so repeated calls are
cheap. `crossover` / `crossunder` evaluate both `i` and `i-1` of their
arguments; this is why top-level `var` assignments are lazy thunks rather
than scalars.

## 5. Strategy actions

| Action              | Behavior |
|---------------------|----------|
| `strategy.entry("id", strategy.long \| strategy.short, qty=N)` | Queue a market entry at next bar open. If a position is open on the opposite side, close it (reason `"reverse"`) before opening. |
| `strategy.close("id")` | Close the open position at the current bar close (reason `"signal close"`). |
| `strategy.exit("id", …)` | Close the open position (reason `"exit"`). Currently market-only; limit/stop/bracket fills are a roadmap item (see `BACKTESTING.md`). |

The constants `strategy.long` and `strategy.short` resolve to `"long"` and
`"short"` respectively in the evaluator.

## 6. Inputs

Declared via `input.*` calls. Each input is extracted by the compiler and
surfaced as a `ZSInput`:

```ts
interface ZSInput {
  name: string;
  type: "float" | "int" | "bool" | "string";
  default: number | string | boolean;
  minval?: number;
  maxval?: number;
  step?: number;
}
```

Inputs become keys in `StrategyParams` and are available as identifiers in
the strategy body (e.g. `input.float("Fast", 8)` makes `Fast` a usable
identifier). `defaultParams(src)` returns the input defaults, which the
backtester merges with user-supplied params.

## 7. Diagnostics

The compiler emits `ZSDiagnostic`s:

```ts
interface ZSDiagnostic {
  line: number;
  col: number;
  severity: "error" | "warning" | "info";
  message: string;
}
```

Examples:
- `error` — parser failures (e.g. missing `=` in `var`).
- `warning` — unknown function call, unknown identifier.
- `info` — no inputs declared (strategy runs with fixed parameters).

A result with `ok: false` (one or more `error` diagnostics) is rejected by
`/api/backtest` with HTTP 400 and the diagnostics array.

## 8. Worked example

```zs
# EMA Cross + VWAP Filter
strategy("EMA Cross + VWAP Filter", overlay=true)

input.float("Fast", 8, minval=1, maxval=200, step=1)
input.float("Slow", 21, minval=1, maxval=400, step=1)

var fastEma = ema(close, Fast)
var slowEma = ema(close, Slow)

plot(fastEma, "EMA Fast")
plot(slowEma, "EMA Slow")
plot(vwap, "VWAP")

if close > vwap
  if crossover(fastEma, slowEma)
    strategy.entry("long", strategy.long, qty=1)

if crossunder(fastEma, slowEma)
  strategy.close("long")
```

How this runs bar-by-bar:

1. `fastEma` and `slowEma` are lazy series — `ema(close, 8)` and
   `ema(close, 21)`, memoized.
2. At each bar `i`, the evaluator checks the top-level `if` statements.
3. When `close > vwap` **and** `crossover(fastEma, slowEma)` both fire, a
   `strategy.entry("long", strategy.long, qty=1)` is queued.
4. On bar `i+1`, the engine fills the entry at `bars[i+1].open + slip`,
   charges commission, and opens a long position of 1 contract.
5. When `crossunder(fastEma, slowEma)` fires, `strategy.close("long")`
   closes the position at the current bar close (minus slippage, minus
   round-turn commission), and the trade is recorded with reason
   `"signal close"`.

The default strategy source in `src/stores/strategy.ts` is exactly this
example — it is the starting point for new users.

## 9. Roadmap

- Multi-statement `if` bodies (explicit `{ }` grouping).
- User-defined functions.
- Loops with bounded iteration.
- Limit / stop / bracket order actions.
- `plot` rendering on the chart overlay.
- A Pine-to-ZS migration guide (one-way; not a compatibility shim).
