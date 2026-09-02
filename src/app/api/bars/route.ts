import { NextRequest, NextResponse } from "next/server";
import { generateBars } from "@/lib/market/mock-provider";
import {
  GATEIO_REST_URL,
  gateCandleToBar,
  isGateioTimeframe,
  normalizeBars,
  normalizeGateioSymbol,
} from "@/lib/market/gateio";
import { getContract } from "@/lib/market/contracts";
import { TIMEFRAME_SECONDS, type Timeframe } from "@/lib/market/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BARS = 1_000;
const CACHE_TTL_MS = 15_000;
const cache = new Map<string, { expiresAt: number; payload: unknown }>();

const BINANCE_REST_URL = process.env.BINANCE_FUTURES_REST_URL ?? "https://fapi.binance.com";

function parseBinanceBar(raw: unknown) {
  if (!Array.isArray(raw) || raw.length < 6) throw new Error("invalid Binance candle response");
  const values = raw.slice(0, 6).map(Number);
  if (!values.every(Number.isFinite)) throw new Error("invalid Binance candle values");
  const [openTime, open, high, low, close, volume] = values;
  if (openTime <= 0 || high < low || volume < 0) throw new Error("invalid Binance candle range");
  return { t: openTime, o: open, h: high, l: low, c: close, v: volume };
}

function cacheResponse(key: string, payload: unknown) {
  cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, payload });
  if (cache.size > 100) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
}

/**
 * Returns historical bars from the selected read-only provider. Gate.io is
 * the default. The mock route remains available only when `provider=mock` is
 * explicitly requested for deterministic offline development.
 */
export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams;
  const requestedProvider = search.get("provider");
  if (requestedProvider && !["mock", "binance", "gateio"].includes(requestedProvider)) {
    return NextResponse.json({ error: "unsupported historical data provider" }, { status: 400 });
  }
  const provider = requestedProvider === "mock" || requestedProvider === "binance" ? requestedProvider : "gateio";
  const requestedSymbol = search.get("symbol") ?? (provider === "gateio" ? "BTC_USDT" : "BTCUSDT");
  const timeframe = search.get("tf") ?? "5m";
  const requestedBars = Number(search.get("bars") ?? 500);
  const barsCount = Number.isFinite(requestedBars) ? Math.max(1, Math.min(MAX_BARS, Math.floor(requestedBars))) : 500;

  if (!isGateioTimeframe(timeframe)) {
    return NextResponse.json({ error: "unsupported timeframe" }, { status: 400 });
  }

  if (provider === "mock") {
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

  if (provider === "binance") {
    const symbol = requestedSymbol.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!/^[A-Z0-9]+USDT$/.test(symbol)) return NextResponse.json({ error: "unsupported Binance Futures symbol" }, { status: 400 });
    const cacheKey = `binance:${symbol}:${timeframe}:${barsCount}`;
    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return NextResponse.json(cached.payload);
    try {
      const url = new URL(`${BINANCE_REST_URL}/fapi/v1/klines`);
      url.searchParams.set("symbol", symbol);
      url.searchParams.set("interval", timeframe);
      url.searchParams.set("limit", String(barsCount));
      const response = await fetch(url, { headers: { Accept: "application/json" }, next: { revalidate: 0 } });
      if (!response.ok) return NextResponse.json({ error: `Binance historical data unavailable (${response.status})` }, { status: 503 });
      const raw = await response.json();
      if (!Array.isArray(raw)) throw new Error("invalid Binance candle response");
      const bars = raw.map(parseBinanceBar).sort((a, b) => a.t - b.t);
      const payload = { symbol, requestedSymbol, timeframe, provider: "binance", environment: "live", dataStatus: "LIVE", from: bars[0]?.t ?? null, to: bars.at(-1)?.t ?? null, bars };
      cacheResponse(cacheKey, payload);
      return NextResponse.json(payload);
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Binance historical data unavailable" }, { status: 503 });
    }
  }

  const symbol = normalizeGateioSymbol(requestedSymbol);
  if (!symbol) return NextResponse.json({ error: "unsupported Gate.io symbol" }, { status: 400 });
  const cacheKey = `${symbol}:${timeframe}:${barsCount}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return NextResponse.json(cached.payload);

  try {
    const url = new URL(`${GATEIO_REST_URL}/futures/usdt/candlesticks`);
    url.searchParams.set("contract", symbol);
    url.searchParams.set("interval", timeframe);
    url.searchParams.set("limit", String(barsCount));
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      next: { revalidate: 0 },
    });
    if (!response.ok) {
      return NextResponse.json({ error: `Gate.io historical data unavailable (${response.status})` }, { status: 503 });
    }
    const raw = await response.json();
    if (!Array.isArray(raw)) throw new Error("invalid Gate.io candle response");
    const bars = normalizeBars(raw.map(gateCandleToBar)).slice(-barsCount);
    const payload = {
      symbol,
      requestedSymbol,
      timeframe,
      provider: "gateio",
      environment: "live",
      dataStatus: "LIVE",
      from: bars[0]?.t ?? null,
      to: bars.at(-1)?.t ?? null,
      bars,
    };
    cacheResponse(cacheKey, payload);
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gate.io historical data unavailable" },
      { status: 503 }
    );
  }
}
