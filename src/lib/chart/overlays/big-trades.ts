import type { TradeEvent } from "@/lib/market/types";
import type { BigTradesOverlaySettings } from "./contracts";

export const BIG_TRADES_CALCULATION_VERSION = "1.0.0";

export type BigTradeCluster = {
  id: string;
  timestamp: number;
  firstTimestamp: number;
  lastTimestamp: number;
  price: number;
  side: "buy" | "sell";
  quantity: number;
  notional: number;
  count: number;
  provider: TradeEvent["provider"];
  symbol: string;
  granularity: "individual" | "aggregate" | "unknown";
};

export type BigTradesSnapshot = {
  calculationVersion: typeof BIG_TRADES_CALCULATION_VERSION;
  clusters: BigTradeCluster[];
};

function priceBucket(price: number, tickSize: number) {
  if (!Number.isFinite(price) || !Number.isFinite(tickSize) || tickSize <= 0) return price;
  const decimals = Math.max(0, Math.min(12, Math.ceil(-Math.log10(tickSize)) + 2));
  return Number((Math.round(price / tickSize) * tickSize).toFixed(decimals));
}

function tradeGranularity(trade: TradeEvent): BigTradeCluster["granularity"] {
  if (trade.provider === "binance") return "aggregate";
  if (trade.provider === "gateio") return "individual";
  return "unknown";
}

/**
 * Deterministically groups observed exchange prints by bucket, tick price and
 * aggressor side. It never infers a side or promotes aggregate prints to
 * individual executions.
 */
export function aggregateBigTrades(
  trades: readonly TradeEvent[],
  tickSize: number,
  settings: BigTradesOverlaySettings,
): BigTradesSnapshot {
  const grouped = new Map<string, BigTradeCluster>();
  const windowMs = settings.aggregationWindowMs;
  for (const trade of trades) {
    const quantity = Number.isFinite(trade.quantity) && trade.quantity > 0 ? trade.quantity : 0;
    const notional = quantity * trade.price;
    if (!Number.isFinite(trade.price) || trade.price <= 0 || quantity < settings.minimumQuantity) continue;
    const timestamp = Math.floor(trade.timestamp / windowMs) * windowMs;
    const price = priceBucket(trade.price, tickSize);
    const key = `${trade.provider}:${trade.symbol}:${timestamp}:${price}:${trade.side}`;
    const current = grouped.get(key);
    if (current) {
      current.quantity += quantity;
      current.notional += notional;
      current.count += 1;
      current.lastTimestamp = Math.max(current.lastTimestamp, trade.timestamp);
      continue;
    }
    grouped.set(key, {
      id: key,
      timestamp,
      firstTimestamp: trade.timestamp,
      lastTimestamp: trade.timestamp,
      price,
      side: trade.side,
      quantity,
      notional,
      count: 1,
      provider: trade.provider,
      symbol: trade.symbol,
      granularity: tradeGranularity(trade),
    });
  }
  return {
    calculationVersion: BIG_TRADES_CALCULATION_VERSION,
    clusters: [...grouped.values()]
      .filter(cluster => cluster.notional >= settings.minimumNotional)
      .sort((left, right) => left.timestamp - right.timestamp || left.price - right.price || left.side.localeCompare(right.side)),
  };
}

/** A bounded mutable accumulator for the renderer's direct stream subscription. */
export class BigTradesBuffer {
  private readonly trades: TradeEvent[] = [];

  constructor(private readonly capacity = 10_000) {}

  push(trade: TradeEvent) {
    this.trades.push(trade);
    if (this.trades.length > this.capacity) this.trades.splice(0, this.trades.length - this.capacity);
  }

  snapshot(tickSize: number, settings: BigTradesOverlaySettings): BigTradesSnapshot {
    return aggregateBigTrades(this.trades, tickSize, settings);
  }

  clear() { this.trades.length = 0; }
}
