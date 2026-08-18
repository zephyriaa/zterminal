export const MARKET_INTERVALS = ["1m", "5m", "15m", "30m", "1h", "4h", "1d"] as const;

export type MarketInterval = (typeof MARKET_INTERVALS)[number];

export const MARKET_INTERVAL_MS: Record<MarketInterval, number> = {
  "1m": 60_000,
  "5m": 5 * 60_000,
  "15m": 15 * 60_000,
  "30m": 30 * 60_000,
  "1h": 60 * 60_000,
  "4h": 4 * 60 * 60_000,
  "1d": 24 * 60 * 60_000,
};

export type MarketDataState = "LOADING" | "CONNECTED" | "EMPTY" | "STALE" | "DEGRADED" | "RECONNECTING" | "UNAVAILABLE" | "ERROR";
export type MarketDataReason = "UPSTREAM_UNAVAILABLE" | "INVALID_PAYLOAD" | "INSUFFICIENT_COVERAGE" | "UNSUPPORTED_INSTRUMENT" | "INVALID_RANGE" | "RATE_LIMITED" | "UNKNOWN";

export type CoverageWindow = {
  requestedFrom: number | null;
  requestedTo: number | null;
  effectiveFrom: number | null;
  effectiveTo: number | null;
  returnedBars: number;
  complete: boolean;
  granularity: MarketInterval;
};

export type DatasetProvenance = {
  provider: "gateio";
  environment: "public-read-only";
  symbol: string;
  sourceTimestamp: number | null;
  fetchedAt: number;
  coverage: CoverageWindow;
};

const GATE_USDT_PERPETUAL = /^[A-Z0-9]+_USDT$/;
const GATE_ALIASES: Record<string, string> = {
  QQQX_USDT: "QQQX_USDT",
  QQQXUSDT: "QQQX_USDT",
  "QQQXUSDT.P": "QQQX_USDT",
  "QQQX_USDT.P": "QQQX_USDT",
  "GATEIO:QQQXUSDT.P": "QQQX_USDT",
  "GATEIO:QQQX_USDT.P": "QQQX_USDT",
};

/** Normalizes Gate.io perpetual aliases without inventing a venue or product. */
export function normalizeGatePerpetualSymbol(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim().toUpperCase();
  if (!normalized) return null;
  return GATE_ALIASES[normalized] ?? (GATE_USDT_PERPETUAL.test(normalized) ? normalized : null);
}

export function isMarketInterval(value: string): value is MarketInterval {
  return (MARKET_INTERVALS as readonly string[]).includes(value);
}

export function alignRange(from: number, to: number, interval: MarketInterval): { from: number; to: number } | null {
  if (!Number.isFinite(from) || !Number.isFinite(to) || from >= to) return null;
  const intervalMs = MARKET_INTERVAL_MS[interval];
  return { from: Math.floor(from / intervalMs) * intervalMs, to: Math.floor(to / intervalMs) * intervalMs };
}

export function coverageForBars(interval: MarketInterval, bars: Array<{ t: number }>, requested: { from: number | null; to: number | null }): CoverageWindow {
  const effectiveFrom = bars.at(0)?.t ?? null;
  const effectiveTo = bars.at(-1)?.t ?? null;
  const complete = requested.from === null || requested.to === null
    ? false
    : effectiveFrom !== null && effectiveTo !== null && effectiveFrom <= requested.from && effectiveTo >= requested.to - MARKET_INTERVAL_MS[interval];
  return { requestedFrom: requested.from, requestedTo: requested.to, effectiveFrom, effectiveTo, returnedBars: bars.length, complete, granularity: interval };
}

export function classifyProviderFailure(error: unknown): { reasonCode: MarketDataReason; message: string; retryable: boolean } {
  const message = error instanceof Error ? error.message : "Public market data is unavailable";
  const normalized = message.toLowerCase();
  if (normalized.includes("unsupported") || normalized.includes("contract")) return { reasonCode: "UNSUPPORTED_INSTRUMENT", message, retryable: false };
  if (normalized.includes("rate") || normalized.includes("429")) return { reasonCode: "RATE_LIMITED", message, retryable: true };
  if (normalized.includes("invalid") || normalized.includes("finite") || normalized.includes("payload")) return { reasonCode: "INVALID_PAYLOAD", message, retryable: false };
  if (normalized.includes("insufficient") || normalized.includes("coverage")) return { reasonCode: "INSUFFICIENT_COVERAGE", message, retryable: true };
  return { reasonCode: "UPSTREAM_UNAVAILABLE", message, retryable: true };
}
