/**
 * MockMarketDataProvider — deterministic, SIMULATED market data.
 *
 * Generates synthetic OHLCV bars + live trades/quotes/depth. The data
 * is clearly labeled DataStatus="SIMULATED" everywhere it is surfaced.
 *
 * This provider is used when no real Rithmic environment is available.
 * It is NOT a substitute for exchange data. It exists so the terminal
 * UI, analytics, and backtest engine can be developed and demonstrated
 * end-to-end without credentials.
 *
 * Determinism: bars are a pure function of (symbol, timeframe, range).
 * Two identical requests produce identical bars — backtests are
 * reproducible. Live ticks are seeded from the symbol but are NOT
 * required to replay identically; they are clearly SIMULATED.
 */
import { TIMEFRAME_SECONDS, type Bar, type Timeframe } from "./types";
import { getContract, type ContractDef } from "./contracts";
import { mulberry32, gaussian, hashString } from "./rng";
import { sessionVolMultiplier, classifySession } from "./session";

export const MOCK_ANCHOR_MS = Date.UTC(2024, 0, 1, 0, 0, 0); // 2024-01-01 UTC

const DAY_MS = 86_400_000;

/** Round to tick size. */
function roundTick(price: number, tick: number): number {
  return Math.round(price / tick) * tick;
}

/**
 * Generate deterministic historical bars for [from, to] (UTC ms).
 * Bars are aligned to timeframe buckets. A bar is emitted per bucket
 * regardless of session (overnight bars have low volume).
 */
export function generateBars(
  symbol: string,
  tf: Timeframe,
  fromMs: number,
  toMs: number
): Bar[] {
  const c = getContract(symbol);
  const sec = TIMEFRAME_SECONDS[tf];
  const startBucket = Math.floor(fromMs / 1000 / sec) * sec * 1000;
  const endBucket = Math.floor(toMs / 1000 / sec) * sec * 1000;

  const bars: Bar[] = [];
  // Per-(symbol,tf) base seed keeps the walk stable across queries.
  const baseSeed = hashString(`${symbol}|${tf}`);
  const seriesRng = mulberry32(baseSeed);

  // Drift per bar (annualized-ish) — small, instrument-scaled.
  const driftPerBar =
    (c.dailyVolPct / Math.sqrt(252 * (6.5 * 3600) / sec)) * 0.15;

  // Seed an initial price from the base seed so each symbol differs.
  let price = c.basePrice * (0.97 + seriesRng() * 0.06);

  const anchorIndex = Math.floor((startBucket - MOCK_ANCHOR_MS) / 1000 / sec);

  for (let i = 0; ; i++) {
    const t = startBucket + i * sec * 1000;
    if (t > endBucket) break;
    // Per-bar RNG — deterministic given symbol/tf/globalIndex.
    const rng = mulberry32(hashString(`${symbol}|${tf}|${anchorIndex + i}`));
    const vol = c.dailyVolPct / Math.sqrt(252 * (6.5 * 3600) / sec);
    const sessionMul = sessionVolMultiplier(t);
    const shock = gaussian(rng) * vol * sessionMul;
    const open = price;
    const close = Math.max(open * (1 + driftPerBar + shock), c.tickSize);
    const range = open * vol * sessionMul * (0.6 + rng() * 1.1);
    const high = Math.max(open, close) + range * (0.2 + rng() * 0.6);
    const low = Math.min(open, close) - range * (0.2 + rng() * 0.6);
    const sess = classifySession(c.session, t);
    const baseVol = c.product === "equity" ? 180_000 : 220_000;
    const volMul =
      sess.label === "rth" ? 1 : sess.label === "overnight" ? 0.12 : 0.3;
    const v = Math.max(
      1,
      Math.floor(baseVol * volMul * (0.4 + rng() * 1.2) * (sec / 60))
    );
    const buyShare = 0.4 + rng() * 0.2;
    bars.push({
      t,
      o: roundTick(open, c.tickSize),
      h: roundTick(high, c.tickSize),
      l: roundTick(Math.max(low, c.tickSize), c.tickSize),
      c: roundTick(close, c.tickSize),
      v,
      buyVol: Math.floor(v * buyShare),
      sellVol: Math.floor(v * (1 - buyShare)),
    });
    price = close;
  }
  return bars;
}

/** A running simulated market state for live tick generation. */
export class MockLiveMarket {
  private price: number;
  private seq = 0;
  readonly contract: ContractDef;
  constructor(public readonly symbol: string, startPrice?: number) {
    this.contract = getContract(symbol);
    this.price = startPrice ?? this.contract.basePrice;
  }
  get currentPrice() {
    return this.price;
  }
  /** Advance one tick of "time" and return simulated trade + quote. */
  tick(now: number) {
    const rng = mulberry32(hashString(`${this.symbol}|live|${now}|${this.seq}`));
    const sess = classifySession(this.contract.session, now);
    const volMul = sessionVolMultiplier(now);
    const step =
      this.price *
      this.contract.dailyVolPct *
      0.05 *
      volMul *
      (sess.label === "closed" ? 0.15 : 1);
    const delta = gaussian(rng) * step;
    this.price = roundTick(Math.max(this.price + delta, this.contract.tickSize), this.contract.tickSize);
    const side = delta >= 0 ? "buy" : "sell";
    const qty = Math.max(1, Math.floor((this.contract.product === "equity" ? 80 : 6) * (0.3 + rng() * 2)));
    this.seq++;
    const spread = this.contract.tickSize;
    const bid = roundTick(this.price - spread / 2, this.contract.tickSize);
    const ask = roundTick(this.price + spread / 2, this.contract.tickSize);
    return {
      trade: {
        type: "trade" as const,
        provider: "mock" as const,
        environment: "simulation" as const,
        symbol: this.symbol,
        exchange: this.contract.exchange,
        timestamp: now,
        sequence: this.seq,
        price: this.price,
        quantity: qty,
        side,
      },
      quote: {
        type: "quote" as const,
        provider: "mock" as const,
        environment: "simulation" as const,
        symbol: this.symbol,
        exchange: this.contract.exchange,
        timestamp: now,
        sequence: this.seq,
        bid,
        ask,
        bidSize: Math.max(1, Math.floor(8 + rng() * 40)),
        askSize: Math.max(1, Math.floor(8 + rng() * 40)),
      },
    };
  }
  /** Simulated depth ladder around current price. */
  depth(now: number, levels = 10) {
    const rng = mulberry32(hashString(`${this.symbol}|depth|${now}|${this.seq}`));
    const out: { price: number; size: number; side: "buy" | "sell" }[] = [];
    for (let i = 1; i <= levels; i++) {
      out.push({
        price: roundTick(this.price - i * this.contract.tickSize, this.contract.tickSize),
        size: Math.max(1, Math.floor((this.contract.product === "equity" ? 200 : 12) * (0.5 + rng() * 2))),
        side: "buy",
      });
      out.push({
        price: roundTick(this.price + i * this.contract.tickSize, this.contract.tickSize),
        size: Math.max(1, Math.floor((this.contract.product === "equity" ? 200 : 12) * (0.5 + rng() * 2))),
        side: "sell",
      });
    }
    return out;
  }
}
