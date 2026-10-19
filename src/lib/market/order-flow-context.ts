import type { DepthEvent, ProviderId, TradeEvent } from "./types";
import { buildFootprint, calculateBookImbalance, calculateCVD, calculateMicroprice, detectResearchEvents, validateObservedTrades, type FootprintLevel } from "./order-flow";
import { tradeGranularity } from "./trade-units";

export const ORDER_FLOW_CONTEXT_ID = "order-flow.context";
export const ORDER_FLOW_LAYERS = [
  { id: "cvd", label: "Rolling CVD" }, { id: "delta", label: "Trade delta" },
  { id: "footprint", label: "Footprint" }, { id: "trade-profile", label: "Observed trade profile" },
  { id: "imbalance", label: "Book imbalance" }, { id: "microprice", label: "Microprice estimate" },
  { id: "heatmap", label: "L2 liquidity heatmap" }, { id: "absorption", label: "Absorption candidates" }, { id: "sweeps", label: "Sweep candidates" },
] as const;
export type OrderFlowLayer = typeof ORDER_FLOW_LAYERS[number]["id"];
export const ORDER_FLOW_INPUTS = [
  { id: "windowSeconds", label: "Observed window (seconds)", defaultValue: 60, min: 1, max: 900, step: 1 },
  { id: "bucketSeconds", label: "Delta / footprint bucket (seconds)", defaultValue: 1, min: 1, max: 60, step: 1 },
  { id: "tickGrouping", label: "Price grouping (ticks)", defaultValue: 1, min: 1, max: 100, step: 1 },
  { id: "bookLevels", label: "Book imbalance levels per side", defaultValue: 5, min: 1, max: 20, step: 1 },
  { id: "minimumVolume", label: "Candidate minimum native quantity", defaultValue: 5, min: 0, max: 1e12, step: .1 },
  { id: "dominance", label: "Candidate side dominance", defaultValue: .8, min: .5, max: 1, step: .05 },
  { id: "sweepLevels", label: "Sweep minimum price levels", defaultValue: 3, min: 1, max: 100, step: 1 },
  { id: "absorptionTicks", label: "Absorption maximum range (ticks)", defaultValue: 2, min: 1, max: 100, step: 1 },
] as const;
export type OrderFlowContextSettings = { layers: OrderFlowLayer[] } & Record<typeof ORDER_FLOW_INPUTS[number]["id"], number>;
export const DEFAULT_ORDER_FLOW_SETTINGS: OrderFlowContextSettings = { layers: [], ...(Object.fromEntries(ORDER_FLOW_INPUTS.map(input => [input.id, input.defaultValue])) as Omit<OrderFlowContextSettings, "layers">) };

export function sanitizeOrderFlowSettings(value: unknown): OrderFlowContextSettings {
  const source = value && typeof value === "object" ? value as Partial<OrderFlowContextSettings> : {};
  const layers = Array.isArray(source.layers) ? [...new Set(source.layers.filter(layer => ORDER_FLOW_LAYERS.some(item => item.id === layer)))] : [];
  const result: OrderFlowContextSettings = { ...DEFAULT_ORDER_FLOW_SETTINGS, layers };
  for (const input of ORDER_FLOW_INPUTS) {
    const raw = source[input.id];
    const number = typeof raw === "number" && Number.isFinite(raw) ? Math.min(input.max, Math.max(input.min, raw)) : input.defaultValue;
    result[input.id] = input.step === 1 ? Math.round(number) : number;
  }
  result.bucketSeconds = Math.min(result.bucketSeconds, result.windowSeconds);
  return result;
}

/** Frames are actual gateway snapshots, not interpolated columns or an accepted replay manifest. */
export function appendObservedDepth(frames: readonly DepthEvent[], event: DepthEvent): readonly DepthEvent[] {
  if (!Number.isSafeInteger(event.sequence) || event.sequence < 0 || !Number.isFinite(event.timestamp) || event.timestamp < 0 || calculateMicroprice(event.levels).value == null) throw new Error("A verified two-sided, uncrossed book is required.");
  const previous = frames.at(-1);
  if (previous && (previous.provider !== event.provider || previous.symbol !== event.symbol || previous.environment !== event.environment)) throw new Error("Depth identity changed; restart the observed window.");
  if (previous && (event.sequence < previous.sequence || event.timestamp < previous.timestamp)) throw new Error("Old or out-of-order depth; restart the observed window.");
  const levels = (["buy", "sell"] as const).flatMap(side => event.levels.filter(level => level.side === side && level.size > 0).sort((a, b) => side === "buy" ? b.price - a.price : a.price - b.price).slice(0, 20).map(level => ({ ...level })));
  if (previous?.sequence === event.sequence) {
    if (JSON.stringify(previous.levels) !== JSON.stringify(levels)) throw new Error("Conflicting book at the same sequence; restart the observed window.");
    return frames;
  }
  return [...frames, { ...event, levels }].slice(-120);
}

/** Every statistic is confined to this observed market/window; zero is never a missing observation. */
export function buildOrderFlowContext(input: { provider: ProviderId; symbol: string; available: boolean; depthAvailable?: boolean; trades: readonly TradeEvent[]; depth: DepthEvent | null; tickSize: number; now: number; settings: OrderFlowContextSettings }) {
  const settings = sanitizeOrderFlowSettings(input.settings), enabled = new Set(settings.layers);
  const environment = input.provider === "mock" ? "simulation" : "live";
  const matches = (event: TradeEvent | DepthEvent) => event.provider === input.provider && event.symbol === input.symbol && event.environment === environment;
  if (input.available && (input.trades.some(trade => !matches(trade)) || input.depth && !matches(input.depth))) throw new Error("Order-flow identity does not match the selected provider/market.");
  if (input.available) validateObservedTrades(input.trades);
  if (!Number.isFinite(input.tickSize) || input.tickSize <= 0) throw new Error("Verified positive tick size is required.");
  const from = input.now - settings.windowSeconds * 1000;
  const trades = input.available ? input.trades.slice(-2000).filter(trade => trade.timestamp >= from && trade.timestamp <= input.now) : [];
  const quantityUnit = trades[0]?.quantityUnit ?? (input.provider === "gateio" ? "contracts" : input.provider === "binance" ? "base" : "native units");
  if (trades.some(trade => trade.quantityUnit && trade.quantityUnit !== quantityUnit)) throw new Error("Mixed quantity units; restart the observed window.");
  const depthAvailable = input.depthAvailable ?? input.available;
  if (depthAvailable && input.depth && !matches(input.depth)) throw new Error("Order-flow depth identity does not match the selected provider/market.");
  const depth = depthAvailable && input.depth && input.now - input.depth.timestamp <= 15000 && input.depth.timestamp <= input.now ? input.depth.levels : [];
  const tickSize = input.tickSize * settings.tickGrouping;
  const cvd = enabled.has("cvd") || enabled.has("delta") ? calculateCVD(trades, settings.bucketSeconds * 1000) : [];
  const footprint = enabled.has("footprint") || enabled.has("trade-profile") ? buildFootprint(trades, tickSize, settings.bucketSeconds * 1000) : [];
  const profile = new Map<number, FootprintLevel>();
  if (enabled.has("trade-profile")) for (const bucket of footprint) for (const level of bucket.levels) {
    const previous = profile.get(level.price);
    profile.set(level.price, previous ? { price: level.price, buyVolume: previous.buyVolume + level.buyVolume, sellVolume: previous.sellVolume + level.sellVolume, delta: previous.delta + level.delta, totalVolume: previous.totalVolume + level.totalVolume, tradeCount: previous.tradeCount + level.tradeCount } : { ...level });
  }
  const candidates = enabled.has("absorption") || enabled.has("sweeps") ? detectResearchEvents(trades, { now: input.now, windowMs: settings.windowSeconds * 1000, minimumVolume: settings.minimumVolume, dominance: settings.dominance, minimumLevels: settings.sweepLevels, maxAbsorptionRangeTicks: settings.absorptionTicks, tickSize }).filter(event => event.kind === "absorption-candidate" ? enabled.has("absorption") : enabled.has("sweeps")) : [];
  return {
    status: input.available ? "observed" as const : "unavailable" as const,
    from: trades.at(0)?.timestamp ?? null, to: trades.at(-1)?.timestamp ?? null, tradeCount: trades.length, capped: input.trades.length >= 2000,
    quantityUnit, granularities: [...new Set(trades.map(tradeGranularity))], cvd, footprint,
    tradeProfile: [...profile.values()].sort((a, b) => b.price - a.price),
    imbalance: enabled.has("imbalance") && depthAvailable ? calculateBookImbalance(depth, settings.bookLevels) : null,
    microprice: enabled.has("microprice") && depthAvailable ? calculateMicroprice(depth) : null,
    candidates,
  };
}
