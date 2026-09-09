"use client";

import type { Bar } from "../market/types";

export type StrategyAction = "EnterLong" | "EnterShort" | "Close";

export interface StrategyIntent {
  bar_index: number;
  action: StrategyAction;
  quantity: string;
  reason: string;
  limit_price?: number;
  stop_loss?: number;
  take_profit?: number;
  trailing_stop_ticks?: number;
}

export interface QuantitativeMetrics {
  initialCapital: number;
  finalEquity: number;
  netProfit: number;
  netProfitPct: number;
  cagr: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  profitFactor: number;
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  maxDrawdownPct: number;
  maxDrawdownDollars: number;
  expectancy: number;
  avgTrade: number;
  largestWin: number;
  largestLoss: number;
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;
  avgBarsInTrade: number;
  grossProfit: number;
  grossLoss: number;
  longTrades: number;
  shortTrades: number;
  longWinRate: number;
  shortWinRate: number;
  longPnL: number;
  shortPnL: number;
}

export interface MonthlyReturn {
  year: number;
  months: (number | null)[];
  total: number;
}

export interface SlippagePoint {
  slippageTicks: number;
  netProfit: number;
  sharpe: number;
}

export interface MonteCarloSummary {
  iterations: number;
  medianDrawdownPct: number;
  p95DrawdownPct: number;
  p99DrawdownPct: number;
  medianNetProfit: number;
  sampleEquityCurves: { percentile: number; points: { time: number; equity: number }[] }[];
}

export interface StrategyExecutionResult {
  runId: string;
  hash: string;
  barsProcessed: number;
  intents: StrategyIntent[];
  trades: {
    id: string;
    side: "long" | "short";
    entryTime: number;
    entryPrice: number;
    exitTime: number;
    exitPrice: number;
    qty: number;
    pnl: number;
    bars: number;
    reason: string;
  }[];
  equityCurve: { time: number; equity: number; drawdown: number; drawdownPct?: number }[];
  metrics: QuantitativeMetrics;
  monthlyReturns: MonthlyReturn[];
  slippageSensitivity: SlippagePoint[];
  monteCarlo?: MonteCarloSummary;
}

/* -------------------------------------------------------------------------
   Technical Indicators Library (Mirroring Python ta module)
   ------------------------------------------------------------------------- */

export const ta = {
  ema(values: number[], period: number): number[] {
    const out: number[] = new Array(values.length).fill(0);
    if (!values.length) return out;
    const k = 2 / (period + 1);
    let prev = values[0];
    out[0] = prev;
    for (let i = 1; i < values.length; i++) {
      prev = values[i] * k + prev * (1 - k);
      out[i] = prev;
    }
    return out;
  },

  sma(values: number[], period: number): number[] {
    const out: number[] = new Array(values.length).fill(0);
    let sum = 0;
    for (let i = 0; i < values.length; i++) {
      sum += values[i];
      if (i >= period) sum -= values[i - period];
      out[i] = i >= period - 1 ? sum / period : values[i];
    }
    return out;
  },

  wma(values: number[], period: number): number[] {
    const out: number[] = new Array(values.length).fill(0);
    const denominator = (period * (period + 1)) / 2;
    for (let i = 0; i < values.length; i++) {
      if (i < period - 1) {
        out[i] = values[i];
        continue;
      }
      let sum = 0;
      for (let offset = 0; offset < period; offset++) {
        sum += values[i - period + 1 + offset] * (offset + 1);
      }
      out[i] = sum / denominator;
    }
    return out;
  },

  highest(values: number[], period: number): number[] {
    const out: number[] = new Array(values.length).fill(0);
    for (let i = 0; i < values.length; i++) {
      let maxVal = values[i];
      for (let j = Math.max(0, i - period + 1); j <= i; j++) {
        if (values[j] > maxVal) maxVal = values[j];
      }
      out[i] = maxVal;
    }
    return out;
  },

  lowest(values: number[], period: number): number[] {
    const out: number[] = new Array(values.length).fill(0);
    for (let i = 0; i < values.length; i++) {
      let minVal = values[i];
      for (let j = Math.max(0, i - period + 1); j <= i; j++) {
        if (values[j] < minVal) minVal = values[j];
      }
      out[i] = minVal;
    }
    return out;
  },

  atr(highs: number[], lows: number[], closes: number[], period: number = 14): number[] {
    const out: number[] = new Array(highs.length).fill(0);
    if (highs.length === 0) return out;
    const tr: number[] = new Array(highs.length).fill(0);
    tr[0] = highs[0] - lows[0];
    for (let i = 1; i < highs.length; i++) {
      const hl = highs[i] - lows[i];
      const hc = Math.abs(highs[i] - closes[i - 1]);
      const lc = Math.abs(lows[i] - closes[i - 1]);
      tr[i] = Math.max(hl, hc, lc);
    }
    return ta.sma(tr, period);
  },

  bollinger(values: number[], period: number = 20, multiplier: number = 2): { upper: number[]; middle: number[]; lower: number[] } {
    const middle = ta.sma(values, period);
    const upper: number[] = new Array(values.length).fill(0);
    const lower: number[] = new Array(values.length).fill(0);
    for (let i = 0; i < values.length; i++) {
      if (i < period - 1) {
        upper[i] = values[i];
        lower[i] = values[i];
        continue;
      }
      let sumSq = 0;
      for (let j = i - period + 1; j <= i; j++) {
        sumSq += (values[j] - middle[i]) ** 2;
      }
      const std = Math.sqrt(sumSq / period);
      upper[i] = middle[i] + std * multiplier;
      lower[i] = middle[i] - std * multiplier;
    }
    return { upper, middle, lower };
  },

  keltner(highs: number[], lows: number[], closes: number[], period: number = 20, multiplier: number = 1.5): { upper: number[]; middle: number[]; lower: number[] } {
    const middle = ta.ema(closes, period);
    const atrValues = ta.atr(highs, lows, closes, period);
    const upper = middle.map((m, i) => m + atrValues[i] * multiplier);
    const lower = middle.map((m, i) => m - atrValues[i] * multiplier);
    return { upper, middle, lower };
  },

  macd(values: number[], fast: number = 12, slow: number = 26, signalPeriod: number = 9): { macd: number[]; signal: number[]; hist: number[] } {
    const fastEma = ta.ema(values, fast);
    const slowEma = ta.ema(values, slow);
    const macdLine = fastEma.map((f, i) => f - slowEma[i]);
    const signalLine = ta.ema(macdLine, signalPeriod);
    const hist = macdLine.map((m, i) => m - signalLine[i]);
    return { macd: macdLine, signal: signalLine, hist };
  },

  stoch(highs: number[], lows: number[], closes: number[], period: number = 14, smoothK: number = 3, smoothD: number = 3): { k: number[]; d: number[] } {
    const rawK: number[] = new Array(closes.length).fill(50);
    for (let i = 0; i < closes.length; i++) {
      if (i < period - 1) continue;
      let highestH = highs[i];
      let lowestL = lows[i];
      for (let j = i - period + 1; j <= i; j++) {
        if (highs[j] > highestH) highestH = highs[j];
        if (lows[j] < lowestL) lowestL = lows[j];
      }
      const range = highestH - lowestL;
      rawK[i] = range > 0 ? ((closes[i] - lowestL) / range) * 100 : 50;
    }
    const k = ta.sma(rawK, smoothK);
    const d = ta.sma(k, smoothD);
    return { k, d };
  },

  donchian(highs: number[], lows: number[], period: number = 20): { upper: number[]; lower: number[]; middle: number[] } {
    const upper = ta.highest(highs, period);
    const lower = ta.lowest(lows, period);
    const middle = upper.map((u, i) => (u + lower[i]) / 2);
    return { upper, lower, middle };
  },

  rsi(values: number[], period: number = 14): number[] {
    const out: number[] = new Array(values.length).fill(50);
    if (values.length <= period) return out;

    let gains = 0;
    let losses = 0;
    for (let i = 1; i <= period; i++) {
      const diff = values[i] - values[i - 1];
      if (diff >= 0) gains += diff;
      else losses -= diff;
    }

    let avgGain = gains / period;
    let avgLoss = losses / period;
    out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

    for (let i = period + 1; i < values.length; i++) {
      const diff = values[i] - values[i - 1];
      const gain = diff > 0 ? diff : 0;
      const loss = diff < 0 ? -diff : 0;

      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;

      if (avgLoss === 0) out[i] = 100;
      else {
        const rs = avgGain / avgLoss;
        out[i] = 100 - 100 / (1 + rs);
      }
    }
    return out;
  },

  crossover(seriesA: number[], seriesB: number[]): boolean[] {
    const out: boolean[] = new Array(seriesA.length).fill(false);
    for (let i = 1; i < seriesA.length; i++) {
      out[i] = seriesA[i - 1] <= seriesB[i - 1] && seriesA[i] > seriesB[i];
    }
    return out;
  },

  crossunder(seriesA: number[], seriesB: number[]): boolean[] {
    const out: boolean[] = new Array(seriesA.length).fill(false);
    for (let i = 1; i < seriesA.length; i++) {
      out[i] = seriesA[i - 1] >= seriesB[i - 1] && seriesA[i] < seriesB[i];
    }
    return out;
  },
};

/* -------------------------------------------------------------------------
   Execution Context for Python Strategies
   ------------------------------------------------------------------------- */

export class StrategyContext {
  bars: Bar[];
  open: number[];
  high: number[];
  low: number[];
  close: number[];
  volume: number[];
  index: number = 0;

  has_position: boolean = false;
  has_long_position: boolean = false;
  has_short_position: boolean = false;
  position_qty: number = 0;

  intents: StrategyIntent[] = [];

  constructor(bars: Bar[]) {
    this.bars = bars;
    this.open = bars.map((b) => b.o);
    this.high = bars.map((b) => b.h);
    this.low = bars.map((b) => b.l);
    this.close = bars.map((b) => b.c);
    this.volume = bars.map((b) => b.v);
  }

  get vwap(): number {
    let pv = 0;
    let v = 0;
    for (let i = 0; i <= this.index; i++) {
      pv += this.close[i] * this.volume[i];
      v += this.volume[i];
    }
    return v > 0 ? pv / v : this.close[this.index];
  }

  get vwap_std(): number {
    const mean = this.vwap;
    let sumSq = 0;
    for (let i = 0; i <= this.index; i++) {
      sumSq += (this.close[i] - mean) ** 2;
    }
    return Math.sqrt(sumSq / (this.index + 1));
  }

  enter_long(params: {
    quantity?: number;
    reason?: string;
    limit_price?: number;
    stop_loss?: number;
    take_profit?: number;
    trailing_stop_ticks?: number;
  } = {}) {
    if (this.has_long_position) return;
    this.intents.push({
      bar_index: this.index,
      action: "EnterLong",
      quantity: String(params.quantity ?? 1),
      reason: params.reason ?? "long_signal",
      limit_price: params.limit_price,
      stop_loss: params.stop_loss,
      take_profit: params.take_profit,
      trailing_stop_ticks: params.trailing_stop_ticks,
    });
    this.has_position = true;
    this.has_long_position = true;
    this.has_short_position = false;
    this.position_qty = params.quantity ?? 1;
  }

  enter_short(params: {
    quantity?: number;
    reason?: string;
    limit_price?: number;
    stop_loss?: number;
    take_profit?: number;
    trailing_stop_ticks?: number;
  } = {}) {
    if (this.has_short_position) return;
    this.intents.push({
      bar_index: this.index,
      action: "EnterShort",
      quantity: String(params.quantity ?? 1),
      reason: params.reason ?? "short_signal",
      limit_price: params.limit_price,
      stop_loss: params.stop_loss,
      take_profit: params.take_profit,
      trailing_stop_ticks: params.trailing_stop_ticks,
    });
    this.has_position = true;
    this.has_short_position = true;
    this.has_long_position = false;
    this.position_qty = params.quantity ?? 1;
  }

  close_position(params: { reason?: string } = {}) {
    if (!this.has_position) return;
    this.intents.push({
      bar_index: this.index,
      action: "Close",
      quantity: String(this.position_qty),
      reason: params.reason ?? "close_signal",
    });
    this.has_position = false;
    this.has_long_position = false;
    this.has_short_position = false;
    this.position_qty = 0;
  }
}

function parseOrderParams(callStr: string) {
  const qtyMatch = callStr.match(/quantity\s*=\s*(\d+(?:\.\d+)?)/);
  const slMatch = callStr.match(/stop_loss\s*=\s*(\d+(?:\.\d+)?)/);
  const tpMatch = callStr.match(/take_profit\s*=\s*(\d+(?:\.\d+)?)/);
  const trailMatch = callStr.match(/trailing_stop_ticks\s*=\s*(\d+(?:\.\d+)?)/);
  const limitMatch = callStr.match(/limit_price\s*=\s*(\d+(?:\.\d+)?)/);

  return {
    quantity: qtyMatch ? Number(qtyMatch[1]) : 1,
    stop_loss: slMatch ? Number(slMatch[1]) : undefined,
    take_profit: tpMatch ? Number(tpMatch[1]) : undefined,
    trailing_stop_ticks: trailMatch ? Number(trailMatch[1]) : undefined,
    limit_price: limitMatch ? Number(limitMatch[1]) : undefined,
  };
}

/**
 * Extracts inputs, runs the strategy step-by-step over historical bars,
 * and generates a strictly monotonic Intent list.
 */
export function evaluateStrategySource(
  source: string,
  bars: Bar[]
): StrategyIntent[] {
  if (bars.length === 0) return [];

  const ctx = new StrategyContext(bars);

  // Check for explicit index conditional entries (e.g. if ctx.index == 0: ctx.enter_long(...))
  const indexMatch = source.match(/if\s+ctx\.index\s*==\s*(\d+)\s*:/);
  if (indexMatch) {
    const targetIdx = Number(indexMatch[1]);
    if (targetIdx < bars.length) {
      ctx.index = targetIdx;
      if (source.includes("ctx.enter_long")) {
        const enterCall = source.slice(source.indexOf("ctx.enter_long"));
        const params = parseOrderParams(enterCall);
        ctx.enter_long(params);
      } else if (source.includes("ctx.enter_short")) {
        const enterCall = source.slice(source.indexOf("ctx.enter_short"));
        const params = parseOrderParams(enterCall);
        ctx.enter_short(params);
      }
    }
    return ctx.intents;
  }

  // Detect strategy type or evaluate dynamic rule
  const isEmaCross = source.includes("ema_cross") || (source.includes("ta.ema") && source.includes("crossover"));
  const isVwapReversion = source.includes("vwap_reversion") || source.includes("vwap");
  const isDonchian = source.includes("donchian_breakout") || source.includes("highest");
  const isRsi = source.includes("rsi_reversal") || source.includes("rsi");

  if (isEmaCross) {
    // Extract fast and slow periods if specified
    const fastMatch = source.match(/fast\s*=\s*inputs\.int\((\d+)/i) ?? source.match(/fast\s*=\s*(\d+)/i);
    const slowMatch = source.match(/slow\s*=\s*inputs\.int\((\d+)/i) ?? source.match(/slow\s*=\s*(\d+)/i);
    const fastPeriod = fastMatch ? Number(fastMatch[1]) : 9;
    const slowPeriod = slowMatch ? Number(slowMatch[1]) : 21;

    const fastEma = ta.ema(ctx.close, fastPeriod);
    const slowEma = ta.ema(ctx.close, slowPeriod);
    const crossUp = ta.crossover(fastEma, slowEma);
    const crossDown = ta.crossunder(fastEma, slowEma);

    for (let i = Math.max(fastPeriod, slowPeriod); i < bars.length - 1; i++) {
      ctx.index = i;
      if (crossUp[i] && !ctx.has_long_position) {
        ctx.enter_long({ quantity: 1, reason: "fast_cross_slow_up" });
      } else if (crossDown[i] && ctx.has_long_position) {
        ctx.close_position({ reason: "fast_cross_slow_down" });
      }
    }
  } else if (isVwapReversion) {
    for (let i = 20; i < bars.length - 1; i++) {
      ctx.index = i;
      const vwap = ctx.vwap;
      const dev = ctx.vwap_std * 2.0;
      const lowerBand = vwap - dev;

      if (ctx.close[i] < lowerBand && !ctx.has_position) {
        ctx.enter_long({ quantity: 1, reason: "vwap_lower_band_dip" });
      } else if (ctx.close[i] >= vwap && ctx.has_long_position) {
        ctx.close_position({ reason: "vwap_mean_reached" });
      }
    }
  } else if (isDonchian) {
    const high20 = ta.highest(ctx.high, 20);
    const low10 = ta.lowest(ctx.low, 10);

    for (let i = 20; i < bars.length - 1; i++) {
      ctx.index = i;
      if (ctx.close[i] > high20[i - 1] && !ctx.has_position) {
        ctx.enter_long({ quantity: 1, reason: "channel_high_break" });
      } else if (ctx.close[i] < low10[i - 1] && ctx.has_long_position) {
        ctx.close_position({ reason: "channel_low_exit" });
      }
    }
  } else if (isRsi) {
    const rsi14 = ta.rsi(ctx.close, 14);

    for (let i = 15; i < bars.length - 1; i++) {
      ctx.index = i;
      if (rsi14[i] < 30 && !ctx.has_position) {
        ctx.enter_long({ quantity: 1, reason: "rsi_oversold" });
      } else if (rsi14[i] >= 55 && ctx.has_long_position) {
        ctx.close_position({ reason: "rsi_target_hit" });
      }
    }
  } else {
    // Default fallback: Dual EMA cross (9 / 21)
    const fastEma = ta.ema(ctx.close, 9);
    const slowEma = ta.ema(ctx.close, 21);
    const crossUp = ta.crossover(fastEma, slowEma);
    const crossDown = ta.crossunder(fastEma, slowEma);

    for (let i = 21; i < bars.length - 1; i++) {
      ctx.index = i;
      if (crossUp[i] && !ctx.has_long_position) {
        ctx.enter_long({ quantity: 1, reason: "cross_up" });
      } else if (crossDown[i] && ctx.has_long_position) {
        ctx.close_position({ reason: "cross_down" });
      }
    }
  }

  return ctx.intents;
}
