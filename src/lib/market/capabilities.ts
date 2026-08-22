import type { ProviderId } from "./types";

export type ProviderCapability =
  | "candles"
  | "ticker"
  | "best_bid_offer"
  | "depth"
  | "trades"
  | "aggregate_trades"
  | "mark_price"
  | "index_price"
  | "funding_rate"
  | "open_interest"
  | "liquidations";

export type ProviderCatalogEntry = {
  id: Exclude<ProviderId, "mock" | "rithmic-test" | "rithmic-prod" | "databento">;
  label: string;
  environment: "live";
  access: "public-read-only";
  canonicalExample: string;
  nativeExample: string;
  capabilities: readonly ProviderCapability[];
  streamIntegration: "active" | "catalogued";
  aggregation: "eligible-after-symbol-validation" | "not-yet-eligible";
  notice: string;
};

/**
 * This catalogue is intentionally capability-first. A provider is never
 * represented as equivalent to another venue merely because both list a BTC
 * perpetual: contract terms, price increments, and freshness remain source
 * specific until a mapping has passed validation.
 */
export const PROVIDER_CATALOG: readonly ProviderCatalogEntry[] = [
  {
    id: "gateio",
    label: "Gate.io",
    environment: "live",
    access: "public-read-only",
    canonicalExample: "QQQX_USDT",
    nativeExample: "QQQX_USDT",
    capabilities: ["candles", "ticker", "best_bid_offer", "depth", "trades", "mark_price", "index_price", "funding_rate"],
    streamIntegration: "active",
    aggregation: "not-yet-eligible",
    notice: "Live read-only stream active for mapped Gate.io USDT perpetuals. No account or order permissions are requested.",
  },
  {
    id: "binance",
    label: "Binance Futures",
    environment: "live",
    access: "public-read-only",
    canonicalExample: "BTC_USDT_PERP",
    nativeExample: "BTCUSDT",
    capabilities: ["candles", "ticker", "best_bid_offer", "depth", "trades", "aggregate_trades", "mark_price", "index_price", "funding_rate", "open_interest"],
    streamIntegration: "active",
    aggregation: "eligible-after-symbol-validation",
    notice: "Public read-only adapter active. Each contract remains selectable only after live catalogue, regional availability, and reconnect validation pass.",
  },
  {
    id: "bybit",
    label: "Bybit Derivatives",
    environment: "live",
    access: "public-read-only",
    canonicalExample: "BTC_USDT_PERP",
    nativeExample: "BTCUSDT",
    capabilities: ["candles", "ticker", "best_bid_offer", "depth", "trades", "mark_price", "index_price", "funding_rate", "open_interest", "liquidations"],
    streamIntegration: "catalogued",
    aggregation: "eligible-after-symbol-validation",
    notice: "Public market-data catalogued. Venue-specific contract category and event semantics must remain explicit.",
  },
  {
    id: "okx",
    label: "OKX",
    environment: "live",
    access: "public-read-only",
    canonicalExample: "BTC_USDT_PERP",
    nativeExample: "BTC-USDT-SWAP",
    capabilities: ["candles", "ticker", "best_bid_offer", "depth", "trades", "mark_price", "funding_rate", "open_interest"],
    streamIntegration: "catalogued",
    aggregation: "eligible-after-symbol-validation",
    notice: "Public market-data catalogued. Instrument-family and regional-domain mapping must be validated before streaming activation.",
  },
  {
    id: "mexc",
    label: "MEXC Futures",
    environment: "live",
    access: "public-read-only",
    canonicalExample: "BTC_USDT_PERP",
    nativeExample: "BTC_USDT",
    capabilities: ["candles", "ticker", "best_bid_offer", "depth", "trades", "mark_price", "index_price", "funding_rate"],
    streamIntegration: "catalogued",
    aggregation: "eligible-after-symbol-validation",
    notice: "Public market-data catalogued. Endpoint availability, regional access, and contract mapping must pass the provider adapter acceptance suite.",
  },
] as const;

export function getProviderCatalogEntry(id: ProviderId) {
  return PROVIDER_CATALOG.find((provider) => provider.id === id);
}
