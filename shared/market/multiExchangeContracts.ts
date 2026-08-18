import type { SignedPublicTrade } from "./orderFlowContracts";

export type MultiExchangeProvider = "binance_usdm" | "bybit_linear";
export type MultiExchangeTrade = SignedPublicTrade & { provider: MultiExchangeProvider };

function finite(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function text(value: unknown) {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

/** Converts BTCUSDT-like linear contracts into the canonical BTC_USDT display/key form. */
export function normalizeUsdtPerpetualSymbol(value: unknown) {
  const native = text(value)?.toUpperCase() ?? null;
  const match = native?.match(/^([A-Z0-9]+)USDT$/);
  return match ? `${match[1]}_USDT` : null;
}

/**
 * Binance USDⓈ-M `aggTrade`: `m=true` means the buyer was maker, therefore the taker sold.
 * The result preserves that exchange-reported maker flag interpretation; it does not infer side from price.
 */
export function normalizeBinanceUsdmAggregateTrade(value: unknown): MultiExchangeTrade | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const payload = record.data && typeof record.data === "object" ? record.data as Record<string, unknown> : record;
  const symbol = normalizeUsdtPerpetualSymbol(payload.s);
  const id = text(payload.a);
  const price = finite(payload.p);
  const size = finite(payload.q);
  const timestamp = finite(payload.T);
  if (!symbol || !id || price === null || price <= 0 || size === null || size <= 0 || timestamp === null || typeof payload.m !== "boolean") return null;
  return {
    provider: "binance_usdm",
    symbol,
    id,
    price,
    signedSize: payload.m ? -size : size,
    timestamp,
    isInternal: null,
  };
}

/** Bybit V5 `publicTrade` supplies the taker side in `S` as `Buy` or `Sell`. */
export function normalizeBybitLinearPublicTrade(value: unknown): MultiExchangeTrade | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const symbol = normalizeUsdtPerpetualSymbol(record.s);
  const id = text(record.i);
  const price = finite(record.p);
  const size = finite(record.v);
  const timestamp = finite(record.T);
  const side = text(record.S)?.toUpperCase();
  if (!symbol || !id || price === null || price <= 0 || size === null || size <= 0 || timestamp === null || (side !== "BUY" && side !== "SELL")) return null;
  return {
    provider: "bybit_linear",
    symbol,
    id,
    price,
    signedSize: side === "BUY" ? size : -size,
    timestamp,
    isInternal: null,
  };
}

export function normalizeBybitLinearPublicTrades(value: unknown): MultiExchangeTrade[] {
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  if (!Array.isArray(record.data)) return [];
  return record.data.map(normalizeBybitLinearPublicTrade).filter((trade): trade is MultiExchangeTrade => trade !== null);
}
