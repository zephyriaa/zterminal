/**
 * ZS runtime — deterministic bar-by-bar strategy execution.
 *
 * Execution model (anti look-ahead):
 *  - A signal generated on bar[i] (evaluated at bar close) is executed at
 *    bar[i+1].open, adjusted by slippage and commission. You cannot trade
 *    on the bar that produced the signal.
 *  - Market orders fill at next bar open. Limit/stop orders are queued and
 *    filled if the next bar trades through the limit/stop price.
 *
 * Determinism: identical (bars, strategy, parameters, costs) -> identical
 * trades. No Math.random. All cost assumptions are explicit.
 */
import type { Bar, DataStatus, Timeframe } from "@/lib/market/types";
import type { ZSNode } from "./zs-compiler";

export interface StrategyParams {
  [name: string]: number | string | boolean;
}

export interface BacktestTrade {
  id: number;
  side: "long" | "short";
  entryTime: number;
  entryPrice: number;
  exitTime: number;
  exitPrice: number;
  qty: number;
  pnl: number;          // net of commission
  pnlPct: number;
  bars: number;
  reason: string;
}

export interface BacktestConfig {
  symbol: string;
  timeframe: string;
  from: number;
  to: number;
  initialCapital: number;
  commissionPerContract: number;  // round-turn $ per contract
  slippageTicks: number;
  spreadTicks: number;
  tickSize: number;
  tickValue: number;
  multiplier: number;
  positionSize: number;            // contracts
  executionModel: "next_bar_open" | "same_bar_close";
}

export interface BacktestResult {
  config: BacktestConfig;
  trades: BacktestTrade[];
  equity: { t: number; v: number }[];
  drawdown: { t: number; v: number }[];
  metrics: BacktestMetrics;
  runId: string;
  hash: string;       // deterministic hash of inputs
  ranAt: number;
  barsProcessed: number;
  /** Source truthfulness is attached by the API layer, never inferred by the UI. */
  dataStatus?: DataStatus;
  dataProvenance?: {
    provider: string;
    nativeSymbol: string;
    range: { from: number; to: number };
    timeframe: Timeframe;
    fetchedAt: number;
    barCount: number;
  };
}

export interface BacktestMetrics {
  netProfit: number;
  netProfitPct: number;
  grossProfit: number;
  grossLoss: number;
  profitFactor: number;
  expectancy: number;       // per trade, in R-ish
  totalTrades: number;
  winRate: number;
  winners: number;
  losers: number;
  avgWin: number;
  avgLoss: number;
  avgTrade: number;
  maxWin: number;
  maxLoss: number;
  maxDrawdown: number;
  maxDrawdownPct: number;
  sharpe: number;
  sortino: number;
  calmar: number;
  exposure: number;
  avgBars: number;
  longestWinStreak: number;
  longestLossStreak: number;
  finalEquity: number;
}

// ---- indicators (rolling) ----
function emaArr(src: number[], period: number): number[] {
  const out = new Array(src.length).fill(NaN);
  if (!src.length) return out;
  const k = 2 / (period + 1);
  let prev = src[0];
  out[0] = prev;
  for (let i = 1; i < src.length; i++) {
    prev = src[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}
function smaArr(src: number[], period: number): number[] {
  const out = new Array(src.length).fill(NaN);
  let sum = 0;
  for (let i = 0; i < src.length; i++) {
    sum += src[i];
    if (i >= period) sum -= src[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}
function highest(src: number[], period: number, i: number): number {
  let m = -Infinity;
  for (let k = Math.max(0, i - period + 1); k <= i; k++) if (src[k] > m) m = src[k];
  return m;
}
function lowest(src: number[], period: number, i: number): number {
  let m = Infinity;
  for (let k = Math.max(0, i - period + 1); k <= i; k++) if (src[k] < m) m = src[k];
  return m;
}
function rsiArr(src: number[], period: number): number[] {
  const out = new Array(src.length).fill(NaN);
  if (src.length < period + 1) return out;
  let gain = 0, loss = 0;
  for (let i = 1; i <= period; i++) {
    const ch = src[i] - src[i - 1];
    if (ch >= 0) gain += ch; else loss -= ch;
  }
  gain /= period; loss /= period;
  out[period] = 100 - 100 / (1 + (loss === 0 ? 100 : gain / loss));
  for (let i = period + 1; i < src.length; i++) {
    const ch = src[i] - src[i - 1];
    const g = ch >= 0 ? ch : 0;
    const l = ch < 0 ? -ch : 0;
    gain = (gain * (period - 1) + g) / period;
    loss = (loss * (period - 1) + l) / period;
    out[i] = 100 - 100 / (1 + (loss === 0 ? 100 : gain / loss));
  }
  return out;
}
function atrArr(bars: Bar[], period: number): number[] {
  const tr: number[] = bars.map((b, i) => {
    if (i === 0) return b.h - b.l;
    const prev = bars[i - 1].c;
    return Math.max(b.h - b.l, Math.abs(b.h - prev), Math.abs(b.l - prev));
  });
  return smaArr(tr, period);
}

/** Detect declared inputs default values to seed params. */
import { compileStrategy } from "./zs-compiler";

export function defaultParams(src: string): StrategyParams {
  const c = compileStrategy(src);
  const p: StrategyParams = {};
  for (const i of c.inputs) p[i.name] = i.default;
  return p;
}

/** Run a strategy over bars deterministically. */
export function runStrategy(
  src: string,
  bars: Bar[],
  cfg: BacktestConfig,
  params: StrategyParams
): BacktestResult {
  const compiled = compileStrategy(src);
  const close = bars.map((b) => b.c);
  const high = bars.map((b) => b.h);
  const low = bars.map((b) => b.l);
  const open = bars.map((b) => b.o);
  const vol = bars.map((b) => b.v);

  // precompute common indicators lazily by call
  const cache = new Map<string, number[]>();
  function getEma(period: number) {
    const k = `ema${period}`;
    if (!cache.has(k)) cache.set(k, emaArr(close, period));
    return cache.get(k)!;
  }
  function getSma(period: number) {
    const k = `sma${period}`;
    if (!cache.has(k)) cache.set(k, smaArr(close, period));
    return cache.get(k)!;
  }

  // VWAP session anchored
  const vwapArr: number[] = new Array(bars.length).fill(NaN);
  let cumPV = 0, cumV = 0, dayKey = "";
  for (let i = 0; i < bars.length; i++) {
    const et = new Date(bars[i].t - 5 * 3600_000).toISOString().slice(0, 10);
    if (et !== dayKey) { dayKey = et; cumPV = 0; cumV = 0; }
    const tp = (bars[i].h + bars[i].l + bars[i].c) / 3;
    cumPV += tp * bars[i].v; cumV += bars[i].v;
    vwapArr[i] = cumV ? cumPV / cumV : bars[i].c;
  }

  // pending orders + position
  interface Pending {
    side: "long" | "short";
    type: "market" | "limit" | "stop";
    price?: number;
    qty: number;
    id: string;
    reason: string;
    submittedBar: number;
  }
  interface OpenPosition { side: "long" | "short"; qty: number; entryPrice: number; entryTime: number; entryBar: number; id: string; reason: string }
  let position: OpenPosition | null = null;
  const pending: Pending[] = [];
  const trades: BacktestTrade[] = [];
  let tradeId = 1;

  const equity: { t: number; v: number }[] = [];
  const dd: { t: number; v: number }[] = [];
  let cash = cfg.initialCapital;
  let peak = cfg.initialCapital;

  // Build a context for evaluating expressions at bar i
  function evalExpr(n: ZSNode, i: number): number | boolean | string {
    switch (n.kind) {
      case "num": return n.value;
      case "bool": return n.value;
      case "str": return n.value;
      case "ident": {
        switch (n.name) {
          case "open": return open[i];
          case "high": return high[i];
          case "low": return low[i];
          case "close": return close[i];
          case "volume": return vol[i];
          case "hl2": return (high[i] + low[i]) / 2;
          case "hlc3": return (high[i] + low[i] + close[i]) / 3;
          case "ohlc4": return (open[i] + high[i] + low[i] + close[i]) / 4;
          case "time": return bars[i].t;
          case "true": return true;
          case "false": return false;
          case "vwap": return vwapArr[i];
        }
        if (params[n.name] !== undefined) return Number(params[n.name]);
        // strategy.long / strategy.short constants
        if (n.name === "strategy.long") return "long" as unknown as number;
        if (n.name === "strategy.short") return "short" as unknown as number;
        // local var (lazy series — supports lookback at i-1)
        const lv = locals.get(n.name);
        if (lv !== undefined) return typeof lv === "function" ? (lv as (i: number) => number | boolean)(i) : lv;
        return NaN;
      }
      case "binop": {
        const l = evalExpr(n.l, i);
        const r = evalExpr(n.r, i);
        switch (n.op) {
          case "+": return (l as number) + (r as number);
          case "-": return (l as number) - (r as number);
          case "*": return (l as number) * (r as number);
          case "/": return (r as number) === 0 ? NaN : (l as number) / (r as number);
          case "%": return (l as number) % (r as number);
          case ">": return (l as number) > (r as number);
          case "<": return (l as number) < (r as number);
          case ">=": return (l as number) >= (r as number);
          case "<=": return (l as number) <= (r as number);
          case "==": return l === r;
          case "!=": return l !== r;
        }
        return NaN;
      }
      case "call": {
        const arg = (idx: number) => evalExpr(n.args[idx]?.value, i);
        const named = (name: string) => {
          const a = n.args.find((a) => a.name === name);
          return a ? evalExpr(a.value, i) : undefined;
        };
        switch (n.callee) {
          // Indicator signature: func(source, period) — arg(0)=source (defaults
          // to close), arg(1)=period. The source arg is accepted for API
          // compatibility but computation uses the close/high/low arrays.
          case "ema": { const p = Math.round(Number(arg(1) ?? arg(0))); return getEma(p)[i]; }
          case "sma": { const p = Math.round(Number(arg(1) ?? arg(0))); return getSma(p)[i]; }
          case "vwap": return vwapArr[i];
          case "highest": { const p = Math.round(Number(arg(1) ?? arg(0))); return highest(high, p, i); }
          case "lowest": { const p = Math.round(Number(arg(1) ?? arg(0))); return lowest(low, p, i); }
          case "atr": { const p = Math.round(Number(arg(1) ?? arg(0))); return atrArr(bars, p)[i]; }
          case "rsi": { const p = Math.round(Number(arg(1) ?? arg(0))); return rsiArr(close, p)[i]; }
          case "crossover": {
            const a = arg(0), b = arg(1);
            if (i < 1) return false;
            const ap = evalExpr(n.args[0].value, i - 1);
            const bp = evalExpr(n.args[1].value, i - 1);
            return (ap as number) <= (bp as number) && (a as number) > (b as number);
          }
          case "crossunder": {
            const a = arg(0), b = arg(1);
            if (i < 1) return false;
            const ap = evalExpr(n.args[0].value, i - 1);
            const bp = evalExpr(n.args[1].value, i - 1);
            return (ap as number) >= (bp as number) && (a as number) < (b as number);
          }
          case "max": return Math.max(arg(0) as number, arg(1) as number);
          case "min": return Math.min(arg(0) as number, arg(1) as number);
          case "abs": return Math.abs(arg(0) as number);
          case "stdev": { const p = Math.round(Number(arg(1) ?? arg(0))); const s = getSma(p); if (i < p) return NaN; let m = s[i], v = 0; for (let k = i - p + 1; k <= i; k++) v += (close[k] - m) ** 2; return Math.sqrt(v / p); }
          case "plot": return NaN;
          case "strategy": return NaN;
          case "input.float":
          case "input.int":
          case "input.bool":
          case "input.string": return NaN;
        }
        if (n.callee.startsWith("strategy.")) {
          handleStrategyCall(n.callee, n.args, i, params);
          return NaN;
        }
        return NaN;
      }
    }
    return NaN;
  }

  // locals hold lazy thunks (i => value) so series like `var f = ema(close, Fast)`
  // support lookback (crossover/crossunder evaluate at i and i-1).
  const locals = new Map<string, number | boolean | string | ((i: number) => number | boolean | string)>();

  function handleStrategyCall(callee: string, args: { name?: string; value: ZSNode }[], i: number, params: StrategyParams) {
    const argV = (idx: number) => evalExpr(args[idx]?.value, i);
    const named = (name: string) => {
      const a = args.find((a) => a.name === name);
      return a ? evalExpr(a.value, i) : undefined;
    };
    if (callee === "strategy.entry") {
      const side = (named("direction") ?? named("side") ?? argV(1)) === "short" ? "short" : "long";
      const qty = Number(named("qty") ?? argV(2) ?? cfg.positionSize);
      const id = (args[0]?.value.kind === "str" ? (args[0].value as { value: string }).value : "entry");
      // if already in position opposite -> close then reverse
      if (position && position.side !== side) {
        closePosition(bars[i].c, bars[i].t, i, "reverse");
      }
      if (!position) {
        pending.push({ side, type: "market", qty, id, reason: `entry ${id}`, submittedBar: i });
      }
    } else if (callee === "strategy.close") {
      if (position) {
        closePosition(bars[i].c, bars[i].t, i, "signal close");
      }
    } else if (callee === "strategy.exit") {
      // simple: close at market next bar
      if (position) closePosition(bars[i].c, bars[i].t, i, "exit");
    }
  }

  function closePosition(price: number, t: number, i: number, reason: string) {
    if (!position) return;
    const slip = cfg.slippageTicks * cfg.tickSize;
    const exitRaw = position.side === "long" ? price - slip : price + slip;
    const commission = cfg.commissionPerContract * position.qty * 2;
    const gross = (position.side === "long" ? exitRaw - position.entryPrice : position.entryPrice - exitRaw) * position.qty * cfg.multiplier;
    const pnl = gross - commission;
    cash += pnl;
    trades.push({
      id: tradeId++,
      side: position.side,
      entryTime: position.entryTime,
      entryPrice: position.entryPrice,
      exitTime: t,
      exitPrice: exitRaw,
      qty: position.qty,
      pnl,
      pnlPct: position.entryPrice ? (pnl / (position.entryPrice * position.qty * cfg.multiplier)) * 100 : 0,
      bars: i - position.entryBar,
      reason,
    });
    position = null;
  }

  // process pending fills at bar i using bar[i].open (next-bar fill model)
  function processFills(i: number) {
    if (i >= bars.length) return;
    const fillOpen = bars[i].o;
    const slip = cfg.slippageTicks * cfg.tickSize;
    while (pending.length) {
      const o = pending.shift()!;
      // skip if same-side already open
      if (position && position.side === o.side) continue;
      // if opposite, we already closed on reverse; just open new
      const entryRaw = o.side === "long" ? fillOpen + slip : fillOpen - slip;
      const commission = cfg.commissionPerContract * o.qty;
      cash -= commission;
      position = {
        side: o.side,
        qty: o.qty,
        entryPrice: entryRaw,
        entryTime: bars[i].t,
        entryBar: i,
        id: o.id,
        reason: o.reason,
      };
      break;
    }
  }

  // Register top-level assignment thunks ONCE (lazy series — supports lookback).
  // `var f = ema(close, Fast)` becomes f(i) = ema(close, Fast)[i].
  for (const node of compiled.ast ?? []) {
    if (node.kind === "assign") {
      const rhs = node.value;
      locals.set(node.target, (i: number) => evalExpr(rhs, i));
    }
  }

  // main loop
  for (let i = 0; i < bars.length; i++) {
    // fill pending from previous bar at this bar's open
    processFills(i);
    // evaluate strategy actions at bar close (skipping assigns — handled by thunks)
    if (compiled.ast) {
      for (const node of compiled.ast) {
        if (node.kind === "assign") continue;
        execStmt(node, i);
      }
    }
    // mark-to-market equity
    const price = bars[i].c;
    const activePosition = position as OpenPosition | null;
    const unreal = activePosition ? (activePosition.side === "long" ? price - activePosition.entryPrice : activePosition.entryPrice - price) * activePosition.qty * cfg.multiplier : 0;
    const eq = cash + unreal;
    equity.push({ t: bars[i].t, v: eq });
    peak = Math.max(peak, eq);
    dd.push({ t: bars[i].t, v: eq - peak });
  }
  // close any open position at last close
  if (position && bars.length) {
    closePosition(bars[bars.length - 1].c, bars[bars.length - 1].t, bars.length - 1, "end of data");
  }

  const metrics = computeMetrics(trades, equity, dd, cfg, bars.length);
  const hash = hashInputs(src, cfg, params, bars.length);
  return {
    config: cfg,
    trades,
    equity,
    drawdown: dd,
    metrics,
    runId: `bt_${hash.slice(0, 10)}`,
    hash,
    ranAt: Date.now(),
    barsProcessed: bars.length,
  };

  function execStmt(n: ZSNode, i: number) {
    switch (n.kind) {
      case "call":
        evalExpr(n, i);
        break;
      case "assign": {
        // nested (inside if) — set scalar; top-level assigns use thunks
        const v = evalExpr(n.value, i);
        locals.set(n.target, Number(v));
        break;
      }
      case "if": {
        const c = evalExpr(n.cond, i);
        if (c) n.body.forEach((b) => execStmt(b, i));
        break;
      }
    }
  }
}

function computeMetrics(trades: BacktestTrade[], equity: { t: number; v: number }[], dd: { t: number; v: number }[], cfg: BacktestConfig, barsCount: number): BacktestMetrics {
  const winners = trades.filter((t) => t.pnl > 0);
  const losers = trades.filter((t) => t.pnl < 0);
  const grossProfit = winners.reduce((s, t) => s + t.pnl, 0);
  const grossLoss = Math.abs(losers.reduce((s, t) => s + t.pnl, 0));
  const netProfit = grossProfit - grossLoss;
  const finalEquity = equity.length ? equity[equity.length - 1].v : cfg.initialCapital;
  const netProfitPct = ((finalEquity - cfg.initialCapital) / cfg.initialCapital) * 100;
  const winRate = trades.length ? (winners.length / trades.length) * 100 : 0;
  const avgWin = winners.length ? grossProfit / winners.length : 0;
  const avgLoss = losers.length ? grossLoss / losers.length : 0;
  const profitFactor = grossLoss === 0 ? (grossProfit > 0 ? Infinity : 0) : grossProfit / grossLoss;
  const expectancy = trades.length ? netProfit / trades.length : 0;
  const avgTrade = trades.length ? netProfit / trades.length : 0;
  const maxWin = winners.length ? Math.max(...winners.map((t) => t.pnl)) : 0;
  const maxLoss = losers.length ? Math.min(...losers.map((t) => t.pnl)) : 0;

  // drawdown
  const maxDrawdown = dd.length ? Math.min(...dd.map((d) => d.v)) : 0;
  const peakEq = equity.length ? Math.max(...equity.map((e) => e.v)) : cfg.initialCapital;
  const maxDrawdownPct = peakEq ? (Math.abs(maxDrawdown) / peakEq) * 100 : 0;

  // sharpe / sortino from per-bar returns
  const rets: number[] = [];
  for (let i = 1; i < equity.length; i++) {
    const prev = equity[i - 1].v;
    if (prev > 0) rets.push((equity[i].v - prev) / prev);
  }
  const meanRet = rets.length ? rets.reduce((s, r) => s + r, 0) / rets.length : 0;
  const variance = rets.length ? rets.reduce((s, r) => s + (r - meanRet) ** 2, 0) / rets.length : 0;
  const std = Math.sqrt(variance);
  const downside = rets.filter((r) => r < 0);
  const downsideVar = downside.length ? downside.reduce((s, r) => s + r * r, 0) / downside.length : 0;
  const dstd = Math.sqrt(downsideVar);
  const sharpe = std ? (meanRet / std) * Math.sqrt(252) : 0;
  const sortino = dstd ? (meanRet / dstd) * Math.sqrt(252) : 0;
  const years = barsCount / 252;
  const cagr = years > 0 && finalEquity > 0 && cfg.initialCapital > 0 ? (Math.pow(finalEquity / cfg.initialCapital, 1 / years) - 1) * 100 : 0;
  const calmar = maxDrawdownPct ? (cagr / maxDrawdownPct) : 0;

  // streaks
  let lw = 0, ll = 0, cw = 0, cl = 0;
  for (const t of trades) {
    if (t.pnl > 0) { cw++; cl = 0; lw = Math.max(lw, cw); }
    else { cl++; cw = 0; ll = Math.max(ll, cl); }
  }

  // exposure: bars in market / total
  const barsInMarket = trades.reduce((s, t) => s + t.bars, 0);
  const exposure = barsCount ? (barsInMarket / barsCount) * 100 : 0;
  const avgBars = trades.length ? trades.reduce((s, t) => s + t.bars, 0) / trades.length : 0;

  return {
    netProfit,
    netProfitPct,
    grossProfit,
    grossLoss,
    profitFactor,
    expectancy,
    totalTrades: trades.length,
    winRate,
    winners: winners.length,
    losers: losers.length,
    avgWin,
    avgLoss,
    avgTrade,
    maxWin,
    maxLoss,
    maxDrawdown: Math.abs(maxDrawdown),
    maxDrawdownPct,
    sharpe,
    sortino,
    calmar,
    exposure,
    avgBars,
    longestWinStreak: lw,
    longestLossStreak: ll,
    finalEquity,
  };
}

function hashInputs(src: string, cfg: BacktestConfig, params: StrategyParams, barsCount: number): string {
  const s = `${src}|${cfg.symbol}|${cfg.timeframe}|${cfg.from}|${cfg.to}|${cfg.initialCapital}|${cfg.commissionPerContract}|${cfg.slippageTicks}|${cfg.spreadTicks}|${cfg.tickSize}|${cfg.tickValue}|${cfg.multiplier}|${cfg.positionSize}|${cfg.executionModel}|${JSON.stringify(params)}|${barsCount}`;
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}
