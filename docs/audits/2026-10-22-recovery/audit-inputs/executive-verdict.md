# Executive Verdict — Independent ZTerminal Reality Audit

**Audit date:** 2026-10-22 · **Commit:** `e5f7f4d1a78cfe1a4b03b3f69ed480870aebdad7` (main, 2026-10-20) · **Production:** zterminal.dpdns.org · **Auditor environment:** Linux sandbox (no Windows, no Rust toolchain)

## The direct answer

**ZTerminal is an early but credible product built on unusually honest engineering — currently undermined by an operations problem, not a substance problem.**

It is not a marketing bubble: every headline claim I could test at the math level survived independent verification, and the product tells the truth about the things that are broken. It is not a finished platform either: on the day of the audit a first-time user could chart, replay, and study genuine Gate.io candles, but could not get a live quote, could not backtest without a Windows machine running an unsigned 170 MB preview Helper, and could lose an anonymous workspace by switching browsers.

## What is demonstrably real (verified, not believed)

1. **Market data is genuine.** 119 of 120 historical BTC/USDT 5m bars matched Gate.io's own API exactly (OHLC ±0.06, volume ±2%); the 120th was the just-opened candle between snapshots. Integrity metadata (`provider-ohlcv`, `environment: live`) is truthful.
2. **The strategy engine is correct.** I executed the actual Helper engine (v1.4.0, `research/desktop/engine.py`) on Linux against 27 independent hand-computed checks: buy-and-hold reconciled to the last decimal (entry 12.0, qty 83, pnl 288.2175, fees 2.2825), crossovers filled next-open exactly as independently replicated, losing strategies reported losses honestly, no-trade strategies cost nothing, reproducibility hashes are meaningful (`evidenceHash` byte-identical across runs), and final-bar signals are never manufactured into fills. Their own 19 executable engine tests pass.
3. **Anti-look-ahead is structural.** Static guardrails (default ON) reject negative lags at compile time; even with them disabled, a future-peeking strategy still lost money because next-open execution prices in the peek.
4. **Honesty is enforced by code.** Unavailable feeds display `UNAVAILABLE` with reasons; unverified instruments refuse to draw; the retired ZS engine returns an explicit 410 with an anti-fallback comment; result records embed their own limitations.
5. **TypeScript quality gates pass** (`tsc --noEmit` exit 0) across a 75+ file test tree; API routes validate and clamp inputs; cloud endpoints enforce auth (401).

## What is broken or overstated

1. **The live market-data gateway was down in production** for both providers during the audit window — the platform's core live experience failed, honestly displayed but still failed.
2. **Binance is geo-blocked at the server** (403 → 503), silently halving advertised provider coverage; switching to it strands the user on an empty chart after reload (reproducible persistence defect, no fallback to last-good provider).
3. **The advertised research loop is Windows-gated.** "Charts, Python strategies, backtesting" as one flow requires the private Helper; web-only users cannot backtest at all.
4. **Anonymous workspaces are fragile** (fresh browser context = gone; no export path) — the platform's "keep the evidence" promise is weakest exactly where users start.
5. **SECURITY.md is materially stale** (still claims SIMULATED-only data and a Rithmic-centric world while production serves live Gate data).

## Scoring (detail in the scorecards section of this report set)

- **Current Product Reality: 58/100** — verified substance (data, engine, UI) with hard operational failures (live feed down, Windows-gated loop, fragile local persistence).
- **Engineering Potential: 78/100** — correct primitives, versioned contracts, hash-covered evidence, honest failure states; discounted for five overlapping persistence stories, four Windows shell bets, and ops fragility.

## The one-paragraph truth

ZTerminal's creator asked whether they are building something real. The evidence says: **the foundation is real and better-engineered than the product's current usability suggests.** The rare risk here is not fakery — it is that a genuinely correct research engine sits behind a broken live feed and an unsigned Windows-only gate, so the world can't yet experience the part that is actually good. Fix the gateway, the provider-fallback/recovery flows, and ship a Helper users can install without a leap of faith, and this stops being a promising beta and starts being a defensible product.

### The Verdict: Product, Prototype, or Bubble?

**Early but credible product — a real one — with a prototype-grade delivery shell around a professionally engineered core.** Not a bubble: nothing material was found to be fake, inflated, or deceptively presented; several claims were *understated* relative to what the code delivers. The decisive test for the next milestone: one full research session (launch → live data → strategy → backtest → saved reproducible result) that a non-technical trader can complete unaided, on any platform the product advertises.
