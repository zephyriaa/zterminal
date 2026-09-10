import { NextRequest, NextResponse } from "next/server";
import { generateBars } from "@/lib/market/mock-provider";
import {
  GATEIO_REST_URL,
  gateCandleToBar,
  isGateioTimeframe,
  normalizeBars,
  normalizeGateioSymbol,
} from "@/lib/market/gateio";
import { fetchBybitHistoricalBars } from "@/lib/market/bybit";
import { fetchCoinbaseHistoricalBars } from "@/lib/market/coinbase";
import { fetchOkxHistoricalBars } from "@/lib/market/okx";
import { getContract } from "@/lib/market/contracts";
import { TIMEFRAME_SECONDS, type Bar, type Timeframe } from "@/lib/market/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BARS = 1_000;
const CACHE_TTL_MS = 15_000;
const cache = new Map<string, { expiresAt: number; payload: unknown }>();

const BINANCE_REST_URL = process.env.BINANCE_FUTURES_REST_URL ?? "https://fapi.binance.com";

function parseBinanceBar(raw: unknown): Bar {
  if (!Array.isArray(raw) || raw.length < 6) throw new Error("invalid Binance candle response");
  const values = raw.slice(0, 6).map(Number);
  if (!values.every(Number.isFinite)) throw new Error("invalid Binance candle values");
  const [openTime, open, high, low, close, volume] = values;
  if (openTime <= 0 || high < low || volume < 0) throw new Error("invalid Binance candle range");
  return { t: openTime, o: open, h: high, l: low, c: close, v: volume };
}

function cacheResponse(key: string, payload: unknown) {
  cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, payload });
  if (cache.size > 200) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
}

async function fetchFromBinance(symbol: string, timeframe: Timeframe, limit: number): Promise<Bar[]> {
  const cleanSymbol = symbol.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  const formattedSymbol = cleanSymbol.endsWith("USDT") ? cleanSymbol : `${cleanSymbol}USDT`;
  const url = new URL(`${BINANCE_REST_URL}/fapi/v1/klines`);
  url.searchParams.set("symbol", formattedSymbol);
  url.searchParams.set("interval", timeframe);
  url.searchParams.set("limit", String(limit));

  const response = await fetch(url, { headers: { Accept: "application/json" }, next: { revalidate: 0 } });
  if (!response.ok) throw new Error(`Binance returned ${response.status}`);
  const raw = await response.json();
  if (!Array.isArray(raw)) throw new Error("invalid Binance response");
  return raw.map(parseBinanceBar).sort((a, b) => a.t - b.t);
}

async function fetchFromGateio(symbolInput: string, timeframe: Timeframe, limit: number): Promise<Bar[]> {
  const symbol = normalizeGateioSymbol(symbolInput) ?? "BTC_USDT";
  const url = new URL(`${GATEIO_REST_URL}/futures/usdt/candlesticks`);
  url.searchParams.set("contract", symbol);
  url.searchParams.set("interval", timeframe);
  url.searchParams.set("limit", String(limit));

  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    next: { revalidate: 0 },
  });
  if (!response.ok) throw new Error(`Gate.io returned ${response.status}`);
  const raw = await response.json();
  if (!Array.isArray(raw)) throw new Error("invalid Gate.io response");
  return normalizeBars(raw.map(gateCandleToBar)).slice(-limit);
}

const SUPPORTED_PROVIDERS = ["gateio", "binance", "bybit", "coinbase", "okx", "mock"] as const;
type ProviderName = (typeof SUPPORTED_PROVIDERS)[number];

export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams;
  const requestedProvider = (search.get("provider")?.toLowerCase() || "gateio") as ProviderName;
  const requestedSymbol = search.get("symbol") || "BTCUSDT";
  const timeframe = (search.get("tf") || "5m") as Timeframe;
  const requestedBars = Number(search.get("bars") ?? 500);
  const barsCount = Number.isFinite(requestedBars) ? Math.max(1, Math.min(MAX_BARS, Math.floor(requestedBars))) : 500;

  if (!isGateioTimeframe(timeframe)) {
    return NextResponse.json({ error: "unsupported timeframe" }, { status: 400 });
  }

  // Handle Mock simulation explicitly if requested
  if (requestedProvider === "mock") {
    const symbol = requestedSymbol.toUpperCase();
    const contract = getContract(symbol);
    if (!contract || !TIMEFRAME_SECONDS[timeframe]) {
      return NextResponse.json({ error: "unknown mock symbol" }, { status: 400 });
    }
    const to = Number(search.get("to") ?? Date.now());
    const from = to - barsCount * TIMEFRAME_SECONDS[timeframe] * 1_000;
    return NextResponse.json({
      symbol,
      timeframe,
      provider: "mock",
      environment: "simulation",
      dataStatus: "SIMULATED",
      from,
      to,
      bars: generateBars(symbol, timeframe, from, to),
    });
  }

  const cacheKey = `${requestedProvider}:${requestedSymbol}:${timeframe}:${barsCount}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(cached.payload);
  }

  // Order of providers to try (starting with the user-selected one, followed by fallbacks)
  const providerSequence: ProviderName[] = [
    requestedProvider,
    "bybit",
    "gateio",
    "binance",
    "okx",
    "coinbase",
  ].filter((v, i, a) => a.indexOf(v) === i) as ProviderName[];

  let lastError: Error | null = null;
  let successfulBars: Bar[] | null = null;
  let effectiveProvider = requestedProvider;

  for (const prov of providerSequence) {
    try {
      if (prov === "bybit") {
        successfulBars = await fetchBybitHistoricalBars(requestedSymbol, timeframe, barsCount);
        effectiveProvider = "bybit";
        break;
      } else if (prov === "gateio") {
        successfulBars = await fetchFromGateio(requestedSymbol, timeframe, barsCount);
        effectiveProvider = "gateio";
        break;
      } else if (prov === "binance") {
        successfulBars = await fetchFromBinance(requestedSymbol, timeframe, barsCount);
        effectiveProvider = "binance";
        break;
      } else if (prov === "okx") {
        successfulBars = await fetchOkxHistoricalBars(requestedSymbol, timeframe, barsCount);
        effectiveProvider = "okx";
        break;
      } else if (prov === "coinbase") {
        successfulBars = await fetchCoinbaseHistoricalBars(requestedSymbol, timeframe, barsCount);
        effectiveProvider = "coinbase";
        break;
      }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      // continue to next provider in failover sequence
    }
  }

  if (!successfulBars || successfulBars.length === 0) {
    // If all live providers fail (e.g. offline environment), fallback gracefully to synthetic mock
    const fallbackContract = getContract(requestedSymbol);
    if (fallbackContract) {
      const to = Date.now();
      const from = to - barsCount * (TIMEFRAME_SECONDS[timeframe] || 300) * 1_000;
      const bars = generateBars(requestedSymbol, timeframe, from, to);
      const payload = {
        symbol: requestedSymbol,
        requestedSymbol,
        timeframe,
        provider: "mock",
        environment: "simulation",
        dataStatus: "FAILOVER_SIMULATED",
        from,
        to,
        bars,
      };
      return NextResponse.json(payload);
    }

    return NextResponse.json(
      { error: lastError?.message || "Market data temporarily unavailable across all providers" },
      { status: 503 }
    );
  }

  const payload = {
    symbol: requestedSymbol,
    requestedSymbol,
    timeframe,
    provider: effectiveProvider,
    requestedProvider,
    environment: "live",
    dataStatus: "LIVE",
    from: successfulBars[0]?.t ?? null,
    to: successfulBars.at(-1)?.t ?? null,
    bars: successfulBars,
  };

  cacheResponse(cacheKey, payload);
  return NextResponse.json(payload);
}
