import { calculateEmaSeries, calculateVwapSeries, featureFingerprint, type MarketBar } from "@shared/features/registry";

export const BACKTEST_ENGINE_VERSION = "1.1.0";
export type StrategyTemplateId = "ema20_50_vwap_long";
export type BacktestBar = MarketBar;
export type ScalarParameter = string | number | boolean;

export type StrategyDefinition = {
  id: string;
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
    limitations: ["Long-only research template.", "Signals use the loaded verified window only.", "Signals are observed at bar close and market fills are modeled at the next bar open.", "No order routing, broker connectivity, optimization, or forecast is provided."],
  },
};

export type HistoricalSignal =
  | { kind: "entry"; time: number; barIndex: number; id: string; quantity: number }
  | { kind: "exit"; time: number; barIndex: number; id: string };

export type BacktestConfig = {
  initialCapital: number;
  positionSize: number;
  multiplier: number;
  commissionPerUnit: number;
  spreadTicks: number;
  slippageTicks: number;
  tickSize: number;
  executionModel: "next_bar_open";
};

export const DEFAULT_BACKTEST_CONFIG: BacktestConfig = {
  initialCapital: 100_000,
  positionSize: 1,
  multiplier: 1,
  commissionPerUnit: 0,
  spreadTicks: 0,
  slippageTicks: 0,
  tickSize: 0.01,
  executionModel: "next_bar_open",
};

export type BacktestDataContext = {
  provider?: string;
  symbol?: string;
  interval?: string;
  requestedFrom?: number | null;
  requestedTo?: number | null;
  effectiveFrom?: number | null;
  effectiveTo?: number | null;
  sourceTimestamp?: number | null;
  fetchedAt?: number | null;
  coverageComplete?: boolean | null;
  dataStatus?: "HISTORICAL" | "UNAVAILABLE";
};

export type ProtocolClassification = {
  kind: "BASELINE" | "INCREMENTAL" | "UNCLASSIFIED";
  label: "BASELINE · NO OPTIMIZATION" | "INCREMENTAL · ONE VARIABLE" | "UNCLASSIFIED · PROTOCOL REQUIRED";
  baselineFingerprint: string | null;
  incrementField: string | null;
};

export type BacktestRunContext = {
  sourceFingerprint?: string | null;
  parameters?: Record<string, ScalarParameter>;
  protocol?: Partial<ProtocolClassification>;
  data?: BacktestDataContext;
};

export type BacktestDataProvenance = {
  provider: string | null;
  symbol: string | null;
  interval: string | null;
  requestedFrom: number | null;
  requestedTo: number | null;
  effectiveFrom: number | null;
  effectiveTo: number | null;
  sourceTimestamp: number | null;
  fetchedAt: number | null;
  coverageComplete: boolean | null;
  dataStatus: "HISTORICAL" | "UNAVAILABLE";
  suppliedBars: number;
  normalizedBars: number;
  rejectedBars: number;
  duplicateBars: number;
  fingerprint: string | null;
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
  commissionCosts: number;
  spreadCosts: number;
  slippageCosts: number;
  costs: number;
  netPnl: number;
  returnPct: number;
  barsHeld: number;
  reason: "signal_exit" | "end_of_data_mark";
};

export type BacktestMarker = {
  id: string;
  time: number;
  position: "aboveBar" | "belowBar";
  shape: "arrowUp" | "arrowDown";
  color: string;
  text: string;
};

export type EquityPoint = { t: number; value: number };
export type DrawdownPoint = { t: number; value: number };
export type MonthlyOutcome = { month: string; startEquity: number; endEquity: number; pnl: number; returnPct: number };

export type BacktestMetrics = {
  netPnl: number;
  returnPct: number;
  tradeCount: number;
  winRate: number | null;
  profitFactor: number | null;
  expectancy: number | null;
  maxDrawdown: number;
  maxDrawdownPct: number;
  finalEquity: number;
};

export type BacktestResult = {
  engineVersion: string;
  strategy: StrategyDefinition;
  config: BacktestConfig;
  classification: ProtocolClassification;
  provenance: BacktestDataProvenance;
  data: { barCount: number; from: number | null; to: number | null; fingerprint: string | null };
  trades: Trade[];
  markers: BacktestMarker[];
  equity: EquityPoint[];
  drawdown: DrawdownPoint[];
  monthlyOutcomes: MonthlyOutcome[];
  metrics: BacktestMetrics | null;
  runId: string;
  hash: string;
  status: "COMPLETED" | "INSUFFICIENT_DATA" | "INVALID_INPUT";
  limitations: string[];
};

type PendingOrder = { kind: "entry" | "exit"; signalTime: number; quantity?: number };
type OpenPosition = { signalTime: number; entryTime: number; entryPrice: number; entryIndex: number; quantity: number };
type NormalizedBars = { bars: BacktestBar[]; rejectedBars: number; duplicateBars: number };

function isFinitePositive(value: number) { return Number.isFinite(value) && value > 0; }

function normalizeBars(inputBars: BacktestBar[]): NormalizedBars {
  const valid = inputBars.filter(bar => Number.isFinite(bar.t) && [bar.o, bar.h, bar.l, bar.c, bar.v].every(Number.isFinite) && bar.o > 0 && bar.c > 0 && bar.h >= Math.max(bar.o, bar.c) && bar.l <= Math.min(bar.o, bar.c) && bar.v >= 0)
    .sort((left, right) => left.t - right.t);
  const bars: BacktestBar[] = [];
  let duplicateBars = 0;
  for (const bar of valid) {
    if (bars.at(-1)?.t === bar.t) { duplicateBars += 1; continue; }
    bars.push(bar);
  }
  return { bars, duplicateBars, rejectedBars: inputBars.length - valid.length };
}

function hashString(value: string) {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) { hash ^= value.charCodeAt(index); hash = Math.imul(hash, 16_777_619); }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function stableObject(value: Record<string, ScalarParameter> | undefined) {
  return Object.fromEntries(Object.entries(value ?? {}).sort(([left], [right]) => left.localeCompare(right)));
}

function validateConfig(config: BacktestConfig) {
  return isFinitePositive(config.initialCapital) && isFinitePositive(config.positionSize) && isFinitePositive(config.multiplier) && Number.isFinite(config.commissionPerUnit) && config.commissionPerUnit >= 0 && Number.isFinite(config.spreadTicks) && config.spreadTicks >= 0 && Number.isFinite(config.slippageTicks) && config.slippageTicks >= 0 && isFinitePositive(config.tickSize) && config.executionModel === "next_bar_open";
}

function classificationFor(protocol?: Partial<ProtocolClassification>): ProtocolClassification {
  if (protocol?.kind === "BASELINE" && protocol.baselineFingerprint) return { kind: "BASELINE", label: "BASELINE · NO OPTIMIZATION", baselineFingerprint: protocol.baselineFingerprint, incrementField: null };
  if (protocol?.kind === "INCREMENTAL" && protocol.baselineFingerprint && protocol.incrementField) return { kind: "INCREMENTAL", label: "INCREMENTAL · ONE VARIABLE", baselineFingerprint: protocol.baselineFingerprint, incrementField: protocol.incrementField };
  return { kind: "UNCLASSIFIED", label: "UNCLASSIFIED · PROTOCOL REQUIRED", baselineFingerprint: null, incrementField: null };
}

function provenanceFor(inputBars: BacktestBar[], normalized: NormalizedBars, context?: BacktestDataContext): BacktestDataProvenance {
  const fingerprint = featureFingerprint(normalized.bars);
  return {
    provider: context?.provider ?? null,
    symbol: context?.symbol ?? null,
    interval: context?.interval ?? null,
    requestedFrom: context?.requestedFrom ?? null,
    requestedTo: context?.requestedTo ?? null,
    effectiveFrom: context?.effectiveFrom ?? normalized.bars.at(0)?.t ?? null,
    effectiveTo: context?.effectiveTo ?? normalized.bars.at(-1)?.t ?? null,
    sourceTimestamp: context?.sourceTimestamp ?? null,
    fetchedAt: context?.fetchedAt ?? null,
    coverageComplete: context?.coverageComplete ?? null,
    dataStatus: context?.dataStatus ?? "HISTORICAL",
    suppliedBars: inputBars.length,
    normalizedBars: normalized.bars.length,
    rejectedBars: normalized.rejectedBars,
    duplicateBars: normalized.duplicateBars,
    fingerprint,
  };
}

function emptyResult(strategy: StrategyDefinition, config: BacktestConfig, inputBars: BacktestBar[], context: BacktestRunContext, status: BacktestResult["status"], detail: string): BacktestResult {
  const normalized = normalizeBars(inputBars);
  const provenance = provenanceFor(inputBars, normalized, context.data);
  const classification = classificationFor(context.protocol);
  const hash = hashString(JSON.stringify({ engine: BACKTEST_ENGINE_VERSION, strategy: strategy.id, config, classification, provenance, sourceFingerprint: context.sourceFingerprint ?? null, parameters: stableObject(context.parameters), status }));
  return { engineVersion: BACKTEST_ENGINE_VERSION, strategy, config, classification, provenance, data: { barCount: provenance.normalizedBars, from: provenance.effectiveFrom, to: provenance.effectiveTo, fingerprint: provenance.fingerprint }, trades: [], markers: [], equity: [], drawdown: [], monthlyOutcomes: [], metrics: null, runId: `bt_${hash.slice(-10)}`, hash, status, limitations: [...strategy.limitations, detail] };
}

function drawdownSeries(equity: EquityPoint[]) {
  let peak = -Infinity;
  return equity.map(point => { peak = Math.max(peak, point.value); return { t: point.t, value: point.value - peak }; });
}

function metricsFor(trades: Trade[], equity: EquityPoint[], drawdown: DrawdownPoint[], config: BacktestConfig): BacktestMetrics {
  const netPnl = trades.reduce((total, trade) => total + trade.netPnl, 0);
  const wins = trades.filter(trade => trade.netPnl > 0);
  const grossWin = wins.reduce((total, trade) => total + trade.netPnl, 0);
  const grossLoss = Math.abs(trades.filter(trade => trade.netPnl < 0).reduce((total, trade) => total + trade.netPnl, 0));
  const finalEquity = equity.at(-1)?.value ?? config.initialCapital;
  const maxDrawdown = Math.min(0, ...drawdown.map(point => point.value));
  return { netPnl, returnPct: (netPnl / config.initialCapital) * 100, tradeCount: trades.length, winRate: trades.length ? wins.length / trades.length : null, profitFactor: grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? Infinity : null, expectancy: trades.length ? netPnl / trades.length : null, maxDrawdown, maxDrawdownPct: (maxDrawdown / config.initialCapital) * 100, finalEquity };
}

function monthlyOutcomes(equity: EquityPoint[]) {
  const buckets = new Map<string, { start: number; end: number }>();
  for (const point of equity) {
    const month = new Date(point.t).toISOString().slice(0, 7);
    const bucket = buckets.get(month) ?? { start: point.value, end: point.value };
    bucket.end = point.value;
    buckets.set(month, bucket);
  }
  let previousEnd: number | null = null;
  return Array.from(buckets.entries()).map(([month, bucket]) => {
    const startEquity = previousEnd ?? bucket.start;
    previousEnd = bucket.end;
    return { month, startEquity, endEquity: bucket.end, pnl: bucket.end - startEquity, returnPct: startEquity ? ((bucket.end - startEquity) / startEquity) * 100 : 0 };
  });
}

function tradeMarkers(trades: Trade[]): BacktestMarker[] {
  return trades.flatMap(trade => [
    { id: `trade-${trade.id}-entry`, time: trade.entryTime, position: "belowBar" as const, shape: "arrowUp" as const, color: "#24cbbf", text: `E${trade.id} · ${trade.entryPrice.toFixed(4)}` },
    { id: `trade-${trade.id}-exit`, time: trade.exitTime, position: "aboveBar" as const, shape: "arrowDown" as const, color: trade.netPnl >= 0 ? "#72d7b1" : "#ef8ab8", text: `X${trade.id} · ${trade.netPnl >= 0 ? "+" : ""}${trade.netPnl.toFixed(2)}` },
  ]);
}

/** Runs an intentionally non-executing, deterministic historical research template. */
export function runBacktest(strategyId: StrategyTemplateId, inputBars: BacktestBar[], suppliedConfig: Partial<BacktestConfig> = {}, context: BacktestRunContext = {}): BacktestResult {
  const strategy = STRATEGY_TEMPLATES[strategyId];
  const config = { ...DEFAULT_BACKTEST_CONFIG, ...suppliedConfig };
  if (!validateConfig(config)) return emptyResult(strategy, config, inputBars, context, "INVALID_INPUT", "The configuration has invalid capital, size, multiplier, commission, spread, slippage, or tick inputs; no evaluation was run.");
  const normalized = normalizeBars(inputBars);
  const bars = normalized.bars;
  if (bars.length < 52) return emptyResult(strategy, config, inputBars, context, "INSUFFICIENT_DATA", "At least 52 verified bars are required for the EMA 50 warm-up and next-bar evaluation.");

  const provenance = provenanceFor(inputBars, normalized, context.data);
  if (provenance.dataStatus !== "HISTORICAL") return emptyResult(strategy, config, inputBars, context, "INVALID_INPUT", "Historical evaluation requires an explicitly historical, verified dataset.");
  const classification = classificationFor(context.protocol);
  const ema20 = calculateEmaSeries(bars, 20);
  const ema50 = calculateEmaSeries(bars, 50);
  const vwap = calculateVwapSeries(bars);
  const hash = hashString(JSON.stringify({ engine: BACKTEST_ENGINE_VERSION, strategy: { id: strategy.id, version: strategy.version }, config, classification, provenance, sourceFingerprint: context.sourceFingerprint ?? null, parameters: stableObject(context.parameters) }));
  const trades: Trade[] = [];
  const equity: EquityPoint[] = [];
  const spreadPerFill = (config.spreadTicks * config.tickSize) / 2;
  const slippagePerFill = config.slippageTicks * config.tickSize;
  let cash = config.initialCapital;
  let position: OpenPosition | null = null;
  let pending: PendingOrder | null = null;

  const closePosition = (bar: BacktestBar, index: number, reason: Trade["reason"], terminalMark = false) => {
    if (!position) return;
    const exitPrice = (terminalMark ? bar.c : bar.o) - spreadPerFill - slippagePerFill;
    const grossPnl = (exitPrice - position.entryPrice) * position.quantity * config.multiplier;
    const commissionCosts = config.commissionPerUnit * position.quantity * 2;
    const spreadCosts = config.spreadTicks * config.tickSize * position.quantity * config.multiplier;
    const slippageCosts = config.slippageTicks * config.tickSize * position.quantity * config.multiplier * 2;
    const costs = commissionCosts + spreadCosts + slippageCosts;
    const netPnl = grossPnl - commissionCosts;
    cash += netPnl;
    trades.push({ id: trades.length + 1, side: "long", signalTime: position.signalTime, entryTime: position.entryTime, entryPrice: position.entryPrice, exitTime: bar.t, exitPrice, quantity: position.quantity, grossPnl, commissionCosts, spreadCosts, slippageCosts, costs, netPnl, returnPct: ((exitPrice - position.entryPrice) / position.entryPrice) * 100, barsHeld: index - position.entryIndex, reason });
    position = null;
  };

  for (let index = 0; index < bars.length; index += 1) {
    const bar = bars[index];
    if (pending?.kind === "entry") { position = { signalTime: pending.signalTime, entryTime: bar.t, entryPrice: bar.o + spreadPerFill + slippagePerFill, entryIndex: index, quantity: pending.quantity ?? config.positionSize }; pending = null; }
    else if (pending?.kind === "exit") { closePosition(bar, index, "signal_exit"); pending = null; }
    const hasNextOpen = index < bars.length - 1;
    const hasIndicators = index > 0 && Number.isFinite(ema20[index]) && Number.isFinite(ema50[index]) && Number.isFinite(vwap[index]);
    if (hasIndicators && !pending && hasNextOpen) {
      const crossedUp = ema20[index - 1] <= ema50[index - 1] && ema20[index] > ema50[index];
      const crossedDown = ema20[index - 1] >= ema50[index - 1] && ema20[index] < ema50[index];
      if (!position && crossedUp && bar.c > vwap[index]) pending = { kind: "entry", signalTime: bar.t, quantity: config.positionSize };
      if (position && (crossedDown || bar.c < vwap[index])) pending = { kind: "exit", signalTime: bar.t };
    }
    const unrealizedExit = position ? bar.c - spreadPerFill - slippagePerFill : 0;
    const unrealized = position ? (unrealizedExit - position.entryPrice) * position.quantity * config.multiplier : 0;
    equity.push({ t: bar.t, value: cash + unrealized });
  }

  if (position) {
    const last = bars.at(-1)!;
    closePosition(last, bars.length - 1, "end_of_data_mark", true);
    equity[equity.length - 1] = { t: last.t, value: cash };
  }
  const drawdown = drawdownSeries(equity);
  return { engineVersion: BACKTEST_ENGINE_VERSION, strategy, config, classification, provenance, data: { barCount: provenance.normalizedBars, from: provenance.effectiveFrom, to: provenance.effectiveTo, fingerprint: provenance.fingerprint }, trades, markers: tradeMarkers(trades), equity, drawdown, monthlyOutcomes: monthlyOutcomes(equity), metrics: metricsFor(trades, equity, drawdown, config), runId: `bt_${hash.slice(-10)}`, hash, status: "COMPLETED", limitations: [...strategy.limitations, "Terminal open positions are marked at the final close only for end-of-data accounting; this is not a next-bar market fill.", "Historical results are research evidence only and do not establish future performance."] };
}

/** Runs prevalidated closed-runtime signal declarations against verified historical bars. Source text is never executed here. */
export function runSignalBacktest(strategy: StrategyDefinition, suppliedSignals: HistoricalSignal[], inputBars: BacktestBar[], suppliedConfig: Partial<BacktestConfig> = {}, context: BacktestRunContext = {}): BacktestResult {
  const config = { ...DEFAULT_BACKTEST_CONFIG, ...suppliedConfig };
  if (!validateConfig(config)) return emptyResult(strategy, config, inputBars, context, "INVALID_INPUT", "The configuration has invalid capital, size, multiplier, commission, spread, slippage, or tick inputs; no evaluation was run.");
  const normalized = normalizeBars(inputBars);
  const bars = normalized.bars;
  if (bars.length < 2) return emptyResult(strategy, config, inputBars, context, "INSUFFICIENT_DATA", "At least two verified bars are required for a close signal and a later next-open fill.");
  const provenance = provenanceFor(inputBars, normalized, context.data);
  if (provenance.dataStatus !== "HISTORICAL") return emptyResult(strategy, config, inputBars, context, "INVALID_INPUT", "Historical evaluation requires an explicitly historical, verified dataset.");
  const signalMap = new Map<number, HistoricalSignal[]>();
  for (const signal of suppliedSignals) {
    const bar = bars[signal.barIndex];
    const valid = bar && bar.t === signal.time && typeof signal.id === "string" && signal.id.trim() && (signal.kind === "exit" || (Number.isFinite(signal.quantity) && signal.quantity > 0));
    if (!valid) return emptyResult(strategy, config, inputBars, context, "INVALID_INPUT", "Closed-runtime signals must reference an exact normalized bar timestamp and a positive entry quantity.");
    const atTime = signalMap.get(signal.time) ?? [];
    atTime.push(signal);
    signalMap.set(signal.time, atTime);
  }
  const classification = classificationFor(context.protocol);
  const hash = hashString(JSON.stringify({ engine: BACKTEST_ENGINE_VERSION, strategy: { id: strategy.id, version: strategy.version }, signals: suppliedSignals, config, classification, provenance, sourceFingerprint: context.sourceFingerprint ?? null, parameters: stableObject(context.parameters) }));
  const trades: Trade[] = [];
  const equity: EquityPoint[] = [];
  const spreadPerFill = (config.spreadTicks * config.tickSize) / 2;
  const slippagePerFill = config.slippageTicks * config.tickSize;
  let cash = config.initialCapital;
  let position: OpenPosition | null = null;
  let pending: PendingOrder | null = null;
  const closePosition = (bar: BacktestBar, index: number, reason: Trade["reason"], terminalMark = false) => {
    if (!position) return;
    const exitPrice = (terminalMark ? bar.c : bar.o) - spreadPerFill - slippagePerFill;
    const grossPnl = (exitPrice - position.entryPrice) * position.quantity * config.multiplier;
    const commissionCosts = config.commissionPerUnit * position.quantity * 2;
    const spreadCosts = config.spreadTicks * config.tickSize * position.quantity * config.multiplier;
    const slippageCosts = config.slippageTicks * config.tickSize * position.quantity * config.multiplier * 2;
    const costs = commissionCosts + spreadCosts + slippageCosts;
    const netPnl = grossPnl - commissionCosts;
    cash += netPnl;
    trades.push({ id: trades.length + 1, side: "long", signalTime: position.signalTime, entryTime: position.entryTime, entryPrice: position.entryPrice, exitTime: bar.t, exitPrice, quantity: position.quantity, grossPnl, commissionCosts, spreadCosts, slippageCosts, costs, netPnl, returnPct: ((exitPrice - position.entryPrice) / position.entryPrice) * 100, barsHeld: index - position.entryIndex, reason });
    position = null;
  };
  for (let index = 0; index < bars.length; index += 1) {
    const bar = bars[index]!;
    if (pending?.kind === "entry") { position = { signalTime: pending.signalTime, entryTime: bar.t, entryPrice: bar.o + spreadPerFill + slippagePerFill, entryIndex: index, quantity: pending.quantity ?? config.positionSize }; pending = null; }
    else if (pending?.kind === "exit") { closePosition(bar, index, "signal_exit"); pending = null; }
    if (index < bars.length - 1 && !pending) {
      const signals = signalMap.get(bar.t) ?? [];
      const entry = signals.find(signal => signal.kind === "entry");
      const exit = signals.find(signal => signal.kind === "exit");
      if (!position && entry?.kind === "entry") pending = { kind: "entry", signalTime: bar.t, quantity: entry.quantity };
      else if (position && exit?.kind === "exit") pending = { kind: "exit", signalTime: bar.t };
    }
    const unrealizedExit = position ? bar.c - spreadPerFill - slippagePerFill : 0;
    const unrealized = position ? (unrealizedExit - position.entryPrice) * position.quantity * config.multiplier : 0;
    equity.push({ t: bar.t, value: cash + unrealized });
  }
  if (position) {
    const last = bars.at(-1)!;
    closePosition(last, bars.length - 1, "end_of_data_mark", true);
    equity[equity.length - 1] = { t: last.t, value: cash };
  }
  const drawdown = drawdownSeries(equity);
  return { engineVersion: BACKTEST_ENGINE_VERSION, strategy, config, classification, provenance, data: { barCount: provenance.normalizedBars, from: provenance.effectiveFrom, to: provenance.effectiveTo, fingerprint: provenance.fingerprint }, trades, markers: tradeMarkers(trades), equity, drawdown, monthlyOutcomes: monthlyOutcomes(equity), metrics: metricsFor(trades, equity, drawdown, config), runId: `bt_${hash.slice(-10)}`, hash, status: "COMPLETED", limitations: [...strategy.limitations, "Signals were declared by the closed historical runtime; source text was not executed as JavaScript or connected to any broker.", "Terminal open positions are marked at the final close only for end-of-data accounting; this is not a next-bar market fill.", "Historical results are research evidence only and do not establish future performance."] };
}
