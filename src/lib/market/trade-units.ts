import type { TradeEvent } from "./types";

export function tradeGranularity(trade: TradeEvent): "individual" | "aggregate" | "unknown" {
  if (trade.conditions?.includes("aggregate-trade")) return "aggregate";
  if (trade.conditions?.includes("raw-trade")) return "individual";
  if (trade.provider === "binance") return "aggregate";
  if (trade.provider === "gateio") return "individual";
  return "unknown";
}

/** Quote-currency notional; native contract counts are never treated as base assets. */
export function tradeNotional(trade: TradeEvent): number | null {
  const unit = trade.quantityUnit ?? (["binance", "coinbase"].includes(trade.provider) ? "base" : undefined);
  const multiplier = unit === "base" ? 1 : unit === "contracts" ? trade.contractMultiplier : undefined;
  if (!Number.isFinite(multiplier) || multiplier! <= 0 || !Number.isFinite(trade.price) || trade.price <= 0 || !Number.isFinite(trade.quantity) || trade.quantity <= 0) return null;
  const value = trade.price * trade.quantity * multiplier!;
  return Number.isFinite(value) ? value : null;
}
