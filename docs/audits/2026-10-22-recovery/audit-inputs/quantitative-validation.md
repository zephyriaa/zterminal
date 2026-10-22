# Quantitative Validation — Independent ZTerminal Reality Audit

Audited engine: **Helper engine v1.4.0** (`research/desktop/engine.py`, execution model `synthetic_next_open_v2` where applicable; classic v1 path also tested). All numbers below were produced by executing the actual engine code on Linux (Python 3.12.15, numpy/pandas/rfc8785; vectorbt stubbed for metadata only) and comparing against independent hand calculations.

## 1. Hand-verified benchmark: buy & hold

Fixture: 6×1h bars, prices [10,12,14,11,13,15], o=p, c=p+0.5, capital 1000, fee 0.1%, allocation 100%, entry signal bar 0, `closeAtEnd`.

Independent expectation:
- Signal bar 0 → shifted 1 → eligible bar 1 → fill at open 12
- qty = floor(1000 / (12 × 1.001)) = **83**
- entry fee = 83×12×0.001 = **0.996**; exit at final mark 15.5; exit fee = **1.2865**
- gross = (15.5−12)×83 = **290.5**; net pnl = **288.2175**

Engine output: entryPrice 12.0, quantity 83, pnl 288.2175, fees 2.2825 — **exact match to the last decimal**. Final equity reconciles (1000 + 288.2175 = 1288.2175).

## 2. Signal-timing integrity (anti-look-ahead)

- The engine shifts every signal series by `executionDelayBars` (default 1) before simulation; decisions at bar i fill at bar i+delay's open.
- Independent SMA(2)/SMA(4) crossover replication on 16 bars produced signal bar 10 → engine fill bar 11 at open 13.0, qty 76, fee 1.976, pnl 36.024 — exact match. (An initial apparent discrepancy was the auditor's own index miscount, corrected and documented.)
- Final-bar signals are **never** manufactured into fills (F8): a strategy entering on the last bar produces zero trades.
- Exit fills use the exit bar's **open**; boundary closes (`closeAtEnd`) use the final **close** and are labeled `split_boundary` — consistent and disclosed.
- Static guardrails (default ON in the shipped UI config, `src/lib/local-research/contracts.ts`) reject negative lags at compile time: `SyntaxError: Future data reference: use a nonnegative lag instead of a negative shift`.
- Even with guardrails disabled, a `shift(-1)` peeking strategy **still lost** (−22.85%, winRate 0/4) because next-open execution already prices the peeked information. Structural resistance, verified empirically.
- The impact model (`atr_volume_v1`) consumes only candles completed **before** each opening (`.shift(1)` on ATR-14 and volume-MA-20), verified by source and by their test `test_current_and_future_candles_cannot_change_opening_impact`.

## 3. Accounting & metric integrity

- Decimal-exact cash/fee/quantity arithmetic; quantities floored to step; adverse tick rounding on fills (verified: v2 entry 12.0 → 12.1 with spread 1bp/tick 0.1 scenario; exit 13.0 → 12.9).
- No-trade strategy: zero trades, zero fees, flat equity — no hidden costs.
- Fee metamorphic test: raising feeBps 0→50 never improved total return.
- Trade-list ↔ equity reconciliation: open positions are marked to final close and excluded from closed-trade statistics (disclosed in every result's `assumptions`).
- Reproducibility: identical inputs produce identical trades/metrics; only `id` (uuid4), `createdAt`, and `resultHash` differ. `evidenceHash` (schema 2) excludes those and is byte-identical — a genuine reproducibility fingerprint covering source hash, input record, dataset hash, config, seeds, and outcomes.
- Result records embed a candid `assumptions` block, including: "Synthetic unlevered long/short OHLCV research; provider perpetual prices do not model perpetual execution", "Arbitrary trusted Python can access files/network and introduce look-ahead bias; this is not a security sandbox."

## 4. Edge cases

| Case | Behavior |
|---|---|
| Flat candles / zero volume | Runs clean (no-trade) |
| Short dataset (2 bars) vs slow indicator | Handled without crash; no signals |
| Open position at dataset boundary | Marked to final close; status `open`; excluded from closed stats |
| Negative initial capital | Rejected (ValueError) |
| Conflicting same-bar entry/exit | Rejected (ValueError) |
| Short signals with long-only direction | Rejected (ValueError) — no silent conversion |
| Non-finite equity | Detected and raised |
| `bars=99999999` API request | Clamped to 1000 server-side |

## 5. Monte Carlo

`analytics.monte_carlo(result, simulations=1000, seed=42)`: bootstrap of **observed closed-trade account returns**; seeded numpy Generator (reproducibility verified: same seed → identical bands; different seed → different); simulations bounded [100, 5000]; input validation (≥2 closed trades, finite returns, >−100%); observation budget (≤10M). The UI presents it as sensitivity exploration, not prediction — the correct epistemic framing.

## 6. Verdict (Phase V/§7.7)

**Would I trust ZTerminal's strategy tester with a trading idea that might eventually influence real financial decisions?**

- Computational correctness: **yes** — every independent check reconciled exactly.
- Execution realism: **credible for research** — next-open fills, explicit fee/slippage/spread/tick/impact/funding assumptions, honest boundary handling; perpetual funding modeled only in historical mode, liquidation/margin unmodeled **and disclosed**.
- Reproducibility: **yes** — hash-covered evidence, seeded RNG, pinned runtime (CPython 3.12.10, vectorbt 0.28.1 in the build script).
- Overall research usefulness: **good, with an access asterisk** — the engine is only reachable through the Windows Helper (unsigned preview) today; web-only users cannot run it at all.
- Residual risk: engine-level correctness cannot certify arbitrary strategy logic (disclosed); backtests remain hypothetical (disclosed).

The strategy tester is not illusion — it is the most defensibly engineered component audited.
