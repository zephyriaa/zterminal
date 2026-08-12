import { z } from "zod";
import type { Bar, ContractMetadata, Timeframe } from "./types";

/** Public, read-only Gate.io USDT perpetual market-data endpoints. */
export const GATEIO_REST_URL = "https://api.gateio.ws/api/v4";
export const GATEIO_WS_URL = "wss://fx-ws.gateio.ws/v4/ws/usdt";
export const GATEIO_PROVIDER = "gateio" as const;
export const GATEIO_DEFAULT_SYMBOL = "QQQX_USDT";

const ALIASES: Record<string, string> = {
  QQQX_USDT: "QQQX_USDT",
  QQQXUSDT: "QQQX_USDT",
  "QQQXUSDT.P": "QQQX_USDT",
  "GATEIO:QQQXUSDT.P": "QQQX_USDT",
};

export function normalizeGateioSymbol(input: string | null | undefined): string | null {
  if (!input) return null;
  const normalized = input.trim().toUpperCase();
  if (ALIASES[normalized]) return ALIASES[normalized];
  return /^[A-Z0-9]+_USDT$/.test(normalized) ? normalized : null;
}

export function isGateioTimeframe(value: string): value is Timeframe {
  return ["1m", "5m", "15m", "30m", "1h", "4h", "1d", "1w"].includes(value);
}

/**
 * Gate returns prices and quantities as strings. Parse only finite decimal
 * literals and reject malformed upstream values at the provider boundary.
 */
export function parseGateDecimal(value: unknown, field: string): number {
  const candidate = typeof value === "number" ? String(value) : value;
  if (typeof candidate !== "string" || !/^-?\d+(\.\d+)?$/.test(candidate.trim())) {
    throw new Error(`invalid Gate.io ${field}`);
  }
  const parsed = Number(candidate);
  if (!Number.isFinite(parsed)) throw new Error(`invalid Gate.io ${field}`);
  return parsed;
}

export const GateContractSchema = z.object({
  name: z.string().regex(/^[A-Z0-9]+_USDT$/),
  quanto_multiplier: z.union([z.string(), z.number()]).optional(),
  order_price_round: z.union([z.string(), z.number()]).optional(),
  order_size_min: z.union([z.string(), z.number()]).optional(),
  order_size_max: z.union([z.string(), z.number()]).optional(),
  in_delisting: z.boolean().optional(),
  delisting_time: z.number().optional(),
});

export type GateContract = z.infer<typeof GateContractSchema>;

export function gateContractToMetadata(contract: GateContract): ContractMetadata {
  const tickSize = contract.order_price_round
    ? parseGateDecimal(contract.order_price_round, "order_price_round")
    : 0.01;
  const multiplier = contract.quanto_multiplier
    ? parseGateDecimal(contract.quanto_multiplier, "quanto_multiplier")
    : 1;
  return {
    root: contract.name.replace(/_USDT$/, ""),
    symbol: contract.name,
    description: `${contract.name.replace("_", "/")} USDT Perpetual`,
    exchange: "GATEIO",
    product: "perpetual",
    tickSize,
    tickValue: tickSize * multiplier,
    multiplier,
    currency: "USDT",
    session: "crypto",
    supportsDepth: true,
    supportsMBO: false,
  };
}

export const GateCandleSchema = z.object({
  t: z.union([z.string(), z.number()]),
  o: z.union([z.string(), z.number()]),
  h: z.union([z.string(), z.number()]),
  l: z.union([z.string(), z.number()]),
  c: z.union([z.string(), z.number()]),
  v: z.union([z.string(), z.number()]),
});

export function gateCandleToBar(raw: unknown): Bar {
  const candle = GateCandleSchema.parse(raw);
  const seconds = parseGateDecimal(candle.t, "candle time");
  return {
    t: seconds * 1000,
    o: parseGateDecimal(candle.o, "candle open"),
    h: parseGateDecimal(candle.h, "candle high"),
    l: parseGateDecimal(candle.l, "candle low"),
    c: parseGateDecimal(candle.c, "candle close"),
    v: Math.abs(parseGateDecimal(candle.v, "candle volume")),
  };
}

/** Stable timestamp sort with duplicate timestamps replaced by the latest bar. */
export function normalizeBars(bars: Bar[]): Bar[] {
  const byTime = new Map<number, Bar>();
  for (const bar of bars) {
    if (Number.isFinite(bar.t) && [bar.o, bar.h, bar.l, bar.c, bar.v].every(Number.isFinite)) {
      byTime.set(bar.t, bar);
    }
  }
  return [...byTime.values()].sort((a, b) => a.t - b.t);
}

export function upsertBar(bars: Bar[], next: Bar, maxBars = 2_000): Bar[] {
  const normalized = normalizeBars([...bars, next]);
  return normalized.length > maxBars ? normalized.slice(-maxBars) : normalized;
}
