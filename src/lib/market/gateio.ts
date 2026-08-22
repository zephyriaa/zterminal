import { z } from "zod";
import { TIMEFRAME_SECONDS, type Bar, type ContractMetadata, type Timeframe } from "./types";

/** Public, read-only Gate.io USDT perpetual market-data endpoints. */
export const GATEIO_REST_URL = "https://api.gateio.ws/api/v4";
export const GATEIO_WS_URL = "wss://fx-ws.gateio.ws/v4/ws/usdt";
export const GATEIO_PROVIDER = "gateio" as const;
export const GATEIO_DEFAULT_SYMBOL = "BTC_USDT";

const ALIASES: Record<string, string> = {
  BTC_USDT: "BTC_USDT",
  BTCUSDT: "BTC_USDT",
  "BINANCE:BTCUSDT": "BTC_USDT",
  QQQX_USDT: "QQQX_USDT",
  QQQXUSDT: "QQQX_USDT",
  "QQQXUSDT.P": "QQQX_USDT",
  "QQQX_USDT.P": "QQQX_USDT",
  "GATEIO:QQQXUSDT.P": "QQQX_USDT",
  "GATEIO:QQQX_USDT.P": "QQQX_USDT",
};

export function normalizeGateioSymbol(input: string | null | undefined): string | null {
  if (!input) return null;
  const normalized = input.trim().toUpperCase();
  if (ALIASES[normalized]) return ALIASES[normalized];
  if (/^[A-Z0-9]+USDT$/.test(normalized)) return `${normalized.slice(0, -4)}_USDT`;
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

const MAX_GATE_CANDLES_PER_REQUEST = 2_000;
const MAX_GATE_CANDLE_PAGES = 48;

type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

/**
 * Fetches an immutable range of public Gate.io USDT perpetual candles in
 * bounded pages. Results remain provider-labelled and are never replaced by
 * synthetic bars when an upstream request fails or yields no coverage.
 */
export async function fetchGateioHistoricalBars(
  inputSymbol: string,
  timeframe: Timeframe,
  fromMs: number,
  toMs: number,
  fetcher: FetchLike = fetch,
): Promise<Bar[]> {
  const symbol = normalizeGateioSymbol(inputSymbol);
  if (!symbol) throw new Error(`unsupported Gate.io USDT perpetual symbol: ${inputSymbol}`);
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || fromMs >= toMs) {
    throw new Error("invalid historical candle range");
  }

  const intervalMs = TIMEFRAME_SECONDS[timeframe] * 1_000;
  const output: Bar[] = [];
  let cursor = Math.floor(fromMs / intervalMs) * intervalMs;
  let pages = 0;

  while (cursor <= toMs) {
    if (pages >= MAX_GATE_CANDLE_PAGES) {
      throw new Error(`historical request exceeds ${MAX_GATE_CANDLE_PAGES} Gate.io pages; reduce the range or use a larger timeframe`);
    }
    const pageEnd = Math.min(toMs, cursor + intervalMs * (MAX_GATE_CANDLES_PER_REQUEST - 1));
    const url = new URL(`${GATEIO_REST_URL}/futures/usdt/candlesticks`);
    url.searchParams.set("contract", symbol);
    url.searchParams.set("interval", timeframe);
    url.searchParams.set("from", String(Math.floor(cursor / 1_000)));
    url.searchParams.set("to", String(Math.floor(pageEnd / 1_000)));

    const response = await fetcher(url, { headers: { Accept: "application/json" }, cache: "no-store" });
    if (!response.ok) throw new Error(`Gate.io historical candles failed (${response.status})`);
    const raw = await response.json();
    if (!Array.isArray(raw)) throw new Error("invalid Gate.io historical candle response");
    output.push(...raw.map(gateCandleToBar));

    if (pageEnd >= toMs) break;
    cursor = pageEnd + intervalMs;
    pages += 1;
  }

  return normalizeBars(output).filter((bar) => bar.t >= fromMs && bar.t <= toMs);
}
