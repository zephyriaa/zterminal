import { calculateEmaSeries, calculateVwapSeries, featureFingerprint, type MarketBar } from "@shared/features/registry";

export const BACKTEST_ENGINE_VERSION = "1.0.0";
export type StrategyTemplateId = "ema20_50_vwap_long";
export type BacktestBar = MarketBar;

export type StrategyDefinition = {
  id: StrategyTemplateId;
  version: string;
  label: string;
  description: string;
  signalTiming: "bar_close";
  entryRule: string;
  exitRule: string;
  limitations: string[];
};

export const STRATEGY_TEMPLATES: Record<StrategyTemplateId, StrategyDefinition> = {
  ema20_50_vwap_long: {
    id: "ema20_50_vwap_long",
    version: "1.0.0",
    label: "EMA 20/50 + VWAP long-only",
    description: "Enter after the fast EMA crosses above the slow EMA while the bar closes above loaded-window VWAP; exit on the inverse condition.",
    signalTiming: "bar_close",
    entryRule: "EMA 20 crosses above EMA 50 and close > loaded-window VWAP at bar close.",
    exitRule: "EMA 20 crosses below EMA 50 or close falls below loaded-window VWAP at bar close.",
    limitations: ["Long-only research template.", "Signals use the loaded verified window only.", "Fills occur at the next bar open; no intrabar fill claim.", "No order routing, broker connectivity, optimization, or forecast is provided."],
  },
};

export type BacktestConfig = {
  initialCapital: number;
  positionSize: number;
  multiplier: number;
  commissionPerUnit: number;
  slippageTicks: number;
  tickSize: number;
  executionModel: "next_bar_open";
};

export const DEFAULT_BACKTEST_CONFIG: BacktestConfig = {
  initialCapital: 100_000,
  positionSize: 1,
  multiplier: 1,
  commissionPerUnit: 0,
  slippageTicks: 0,
  tickSize: 0.01,
  executionModel: "next_bar_open",
};

export type Trade = {
  id: number;
  side: "long";
  signalTime: number;
  entryTime: number;
  entryPrice: number;
  exitTime: number;
  exitPrice: number;
  quantity: number;
  grossPnl: number;
  costs: number;
  netPnl: number;
  returnPct: number;
  barsHeld: number;
  reason: "signal_exit" | "end_of_data";
};

export type BacktestMetrics = {
  netPnl: number;
  returnPct: number;
  tradeCount: number;
  winRate: number | null;
  profitFactor: number | null;
  expectancy: number | null;
  maxDrawdown: number;
  finalEquity: number;
};

export type BacktestResult = {
  engineVersion: string;
  strategy: StrategyDefinition;
  config: BacktestConfig;
  data: { barCount: number; from: number | null; to: number | null; fingerprint: string | null };
  trades: Trade[];
  equity: Array<{ t: number; value: number }>;
  metrics: BacktestMetrics | null;
  runId: string;
  hash: string;
  status: "COMPLETED" | "INSUFFICIENT_DATA" | "INVALID_INPUT";
  limitations: string[];
};

type PendingOrder = { kind: "entry" | "exit"; signalTime: number };
type OpenPosition = { signalTime: number; entryTime: number; entryPrice: number; entryIndex: number };

function isFinitePositive(value: number) {
  return Number.isFinite(value) && value > 0;
}

function normalizeBars(bars: BacktestBar[]) {
  return bars.filter((bar) => Number.isFinite(bar.t) && [bar.o, bar.h, bar.l, bar.c, bar.v].every(Number.isFinite) && bar.o > 0 && bar.c > 0 && bar.h >= Math.max(bar.o, bar.c) && bar.l <= Math.min(bar.o, bar.c) && bar.v >= 0)
    .sort((a, b) => a.t - b.t)
    .filter((bar, index, values) => index === 0 || bar.t > values[index - 1].t);
}

function hashString(value: string) {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function validateConfig(config: BacktestConfig) {
  return isFinitePositive(config.initialCapital) && isFinitePositive(config.positionSize) && isFinitePositive(config.multiplier) && Number.isFinite(config.commissionPerUnit) && config.commissionPerUnit >= 0 && Number.isFinite(config.slippageTicks) && config.slippageTicks >= 0 && isFinitePositive(config.tickSize) && config.executionModel === "next_bar_open";
}

function emptyResult(strategy: StrategyDefinition, config: BacktestConfig, bars: BacktestBar[], status: BacktestResult["status"], detail: string): BacktestResult {
  const normalized = normalizeBars(bars);
  const fingerprint = featureFingerprint(normalized);
  const hash = hashString(JSON.stringify({ engine: BACKTEST_ENGINE_VERSION, strategy: strategy.id, config, fingerprint, status }));
  return { engineVersion: BACKTEST_ENGINE_VERSION, strategy, config, data: { barCount: normalized.length, from: normalized.at(0)?.t ?? null, to: normalized.at(-1)?.t ?? null, fingerprint }, trades: [], equity: [], metrics: null, runId: `bt_${hash.slice(-10)}`, hash, status, limitations: [...strategy.limitations, detail] };
}

function drawdown(equity: Array<{ value: number }>) {
  let peak = -Infinity;
  return equity.reduce((worst, point) => {
    peak = Math.max(peak, point.value);
    return Math.min(worst, point.value - peak);
  }, 0);
}

function metricsFor(trades: Trade[], equity: Array<{ value: number }>, config: BacktestConfig): BacktestMetrics {
  const netPnl = trades.reduce((total, trade) => total + trade.netPnl, 0);
  const wins = trades.filter((trade) => trade.netPnl > 0);
  const grossWin = wins.reduce((total, trade) => total + trade.netPnl, 0);
  const grossLoss = Math.abs(trades.filter((trade) => trade.netPnl < 0).reduce((total, trade) => total + trade.netPnl, 0));
  const finalEquity = equity.at(-1)?.value ?? config.initialCapital;
  return {
    netPnl,
    returnPct: (netPnl / config.initialCapital) * 100,
    tradeCount: trades.length,
    winRate: trades.length ? wins.length / trades.length : null,
    profitFactor: grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? Infinity : null,
    expectancy: trades.length ? netPnl / trades.length : null,
    maxDrawdown: drawdown(equity),
    finalEquity,
  };
}

export function runBacktest(strategyId: StrategyTemplateId, inputBars: BacktestBar[], suppliedConfig: Partial<BacktestConfig> = {}): BacktestResult {
  const strategy = STRATEGY_TEMPLATES[strategyId];
  const config = { ...DEFAULT_BACKTEST_CONFIG, ...suppliedConfig };
  const bars = normalizeBars(inputBars);
  if (!validateConfig(config)) return emptyResult(strategy, config, bars, "INVALID_INPUT", "The configuration has invalid capital, size, cost, or tick inputs; no evaluation was run.");
  if (bars.length < 52) return emptyResult(strategy, config, bars, "INSUFFICIENT_DATA", "At least 52 verified bars are required for the EMA 50 warm-up and next-bar evaluation.");

  const ema20 = calculateEmaSeries(bars, 20);
  const ema50 = calculateEmaSeries(bars, 50);
  const vwap = calculateVwapSeries(bars);
  const fingerprint = featureFingerprint(bars);
  const hash = hashString(JSON.stringify({ engine: BACKTEST_ENGINE_VERSION, strategy: { id: strategy.id, version: strategy.version }, config, fingerprint, bars: bars.length }));
  const trades: Trade[] = [];
  const equity: Array<{ t: number; value: number }> = [];
  const slippage = config.slippageTicks * config.tickSize;
  let cash = config.initialCapital;
  let position: OpenPosition | null = null;
  let pending: PendingOrder | null = null;

  const closePosition = (bar: BacktestBar, index: number, reason: Trade["reason"]) => {
    if (!position) return;
    const exitPrice = bar.o - slippage;
    const grossPnl = (exitPrice - position.entryPrice) * config.positionSize * config.multiplier;
    const costs = config.commissionPerUnit * config.positionSize * 2;
    const netPnl = grossPnl - costs;
    cash += netPnl;
    trades.push({ id: trades.length + 1, side: "long", signalTime: position.signalTime, entryTime: position.entryTime, entryPrice: position.entryPrice, exitTime: bar.t, exitPrice, quantity: config.positionSize, grossPnl, costs, netPnl, returnPct: ((exitPrice - position.entryPrice) / position.entryPrice) * 100, barsHeld: index - position.entryIndex, reason });
    position = null;
  };

  for (let index = 0; index < bars.length; index += 1) {
    const bar = bars[index];
    if (pending?.kind === "entry") {
      position = { signalTime: pending.signalTime, entryTime: bar.t, entryPrice: bar.o + slippage, entryIndex: index };
      pending = null;
    } else if (pending?.kind === "exit") {
      closePosition(bar, index, "signal_exit");
      pending = null;
    }

    const hasIndicators = index > 0 && Number.isFinite(ema20[index]) && Number.isFinite(ema50[index]) && Number.isFinite(vwap[index]);
    if (hasIndicators && !pending) {
      const crossedUp = ema20[index - 1] <= ema50[index - 1] && ema20[index] > ema50[index];
      const crossedDown = ema20[index - 1] >= ema50[index - 1] && ema20[index] < ema50[index];
      if (!position && crossedUp && bar.c > vwap[index]) pending = { kind: "entry", signalTime: bar.t };
      if (position && (crossedDown || bar.c < vwap[index])) pending = { kind: "exit", signalTime: bar.t };
    }

    const unrealized = position ? (bar.c - position.entryPrice) * config.positionSize * config.multiplier : 0;
    equity.push({ t: bar.t, value: cash + unrealized });
  }

  if (position) {
    const last = bars.at(-1)!;
    const syntheticCloseBar = { ...last, o: last.c };
    closePosition(syntheticCloseBar, bars.length - 1, "end_of_data");
    equity[equity.length - 1] = { t: last.t, value: cash };
  }

  return {
    engineVersion: BACKTEST_ENGINE_VERSION,
    strategy,
    config,
    data: { barCount: bars.length, from: bars.at(0)?.t ?? null, to: bars.at(-1)?.t ?? null, fingerprint },
    trades,
    equity,
    metrics: metricsFor(trades, equity, config),
    runId: `bt_${hash.slice(-10)}`,
    hash,
    status: "COMPLETED",
    limitations: strategy.limitations,
  };
}
