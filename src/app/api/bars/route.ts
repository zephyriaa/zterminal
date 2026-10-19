import { NextRequest, NextResponse } from "next/server";
import { generateBars } from "@/lib/market/mock-provider";
import { fetchGateioHistoricalBars, isGateioTimeframe, normalizeGateioSymbol } from "@/lib/market/gateio";
import { fetchBinanceHistoricalBars } from "@/lib/market/binance";
import { chartHistoryRange, normalizeChartBars } from "@/lib/market/chart-data";
import { alignToTimeframe } from "@/lib/market/session";
import { fetchBybitHistoricalBars } from "@/lib/market/bybit";
import { fetchOkxHistoricalBars } from "@/lib/market/okx";
import { getContract } from "@/lib/market/contracts";
import { fetchInstrument } from "@/lib/market/instrument";
import { TIMEFRAME_SECONDS, type Bar, type ContractMetadata, type Timeframe } from "@/lib/market/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BARS = 1_000;
const CACHE_TTL_MS = 15_000;
const cache = new Map<string, { expiresAt: number; payload: Record<string, unknown> }>();

function cacheResponse(key: string, payload: Record<string, unknown>) {
  cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, payload });
  if (cache.size > 200) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
}

const SUPPORTED_PROVIDERS = ["gateio", "binance", "bybit", "coinbase", "okx", "mock"] as const;
type ProviderName = (typeof SUPPORTED_PROVIDERS)[number];

export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams;
  const requestedProvider = (search.get("provider")?.toLowerCase() || "gateio") as ProviderName;
  const requestedSymbol = search.get("symbol") ?? "";
  const timeframe = (search.get("tf") || "5m") as Timeframe;
  const requestedBars = Number(search.get("bars") ?? 500);
  const barsCount = Number.isFinite(requestedBars) ? Math.max(1, Math.min(MAX_BARS, Math.floor(requestedBars))) : 500;

  const unavailable = (error: string, status = 422) => NextResponse.json({ symbol: requestedSymbol, requestedProvider, selectedProvider: requestedProvider, effectiveProvider: null, environment: requestedProvider === "mock" ? "simulation" : "live", dataStatus: "UNAVAILABLE", sourceTimestamp: null, integrity: "unavailable", reason: error, error }, { status, headers: { "Cache-Control": "no-store" } });
  if (!SUPPORTED_PROVIDERS.includes(requestedProvider)) return unavailable("Unsupported provider");
  if (requestedProvider !== "mock" && (!normalizeGateioSymbol(requestedSymbol) || requestedProvider === "coinbase")) return unavailable("No verified USDT perpetual mapping for this instrument and provider. Spot and tokenized products are distinct markets.");

  if (!isGateioTimeframe(timeframe)) {
    return unavailable("unsupported timeframe", 400);
  }

  const cutoff = Number(search.get("to") ?? Date.now());
  if (!Number.isSafeInteger(cutoff) || cutoff <= 0 || cutoff > Date.now()) return unavailable("Invalid or future historical cutoff");
  let range;
  try { range = chartHistoryRange(cutoff, barsCount, timeframe); } catch (error) { return unavailable(error instanceof Error ? error.message : "Invalid historical range"); }
  const interval = TIMEFRAME_SECONDS[timeframe] * 1000;

  // Handle Mock simulation explicitly if requested
  if (requestedProvider === "mock") {
    const symbol = requestedSymbol.toUpperCase();
    let contract;
    try { contract = getContract(symbol); } catch { return unavailable("Unknown mock instrument"); }
    if (!contract || !TIMEFRAME_SECONDS[timeframe]) {
      return NextResponse.json({ error: "unknown mock symbol" }, { status: 400 });
    }
    const { from, lastOpen: to } = range;
    const bars = normalizeChartBars(generateBars(symbol, timeframe, from, to));
    const retrievedAt = Date.now();
    return NextResponse.json({
      symbol,
      timeframe,
      provider: "mock",
      selectedProvider: "mock",
      effectiveProvider: "mock",
      nativeSymbol: contract.symbol,
      canonicalSymbol: contract.product === "perpetual" ? `${contract.root}${contract.currency}` : contract.symbol,
      cache: "network",
      retrievedAt,
      sourceTimestamp: bars.at(-1)?.t ?? null,
      requestedFrom: from, requestedTo: cutoff, requestedCount: barsCount, gapCount: 0, hasOpenCandle: to + interval > retrievedAt, volumeUnit: "simulated",
      integrity: "simulated",
      reason: "Explicit simulation selected",
      contract: { ...contract, verified: false },
      timestampUnit: "ms",
      environment: "simulation",
      dataStatus: "SIMULATED",
      from,
      to,
      bars,
    });
  }

  const cacheKey = `${requestedProvider}:${requestedSymbol}:${timeframe}:${barsCount}:${cutoff}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json({ ...cached.payload, cache: "server" });
  }

  // A different venue is a different instrument identity, not a transparent retry.
  const providerSequence: ProviderName[] = [requestedProvider];

  let lastError: Error | null = null;
  let successfulBars: Bar[] | null = null;
  let effectiveProvider = requestedProvider;
  let contract: ContractMetadata | null = null;

  for (const prov of providerSequence) {
    try {
      const fetcher = (url: string | URL, init?: RequestInit) => fetch(url, { ...init, signal: AbortSignal.any([request.signal, AbortSignal.timeout(20000)]) });
      const verified = await fetchInstrument(prov, requestedSymbol, request.signal);
      if (prov === "bybit") {
        successfulBars = await fetchBybitHistoricalBars(verified.symbol, timeframe, range.from, range.lastOpen, fetcher);
        effectiveProvider = "bybit";
        contract = verified;
        break;
      } else if (prov === "gateio") {
        successfulBars = await fetchGateioHistoricalBars(verified.symbol, timeframe, range.from, range.lastOpen, fetcher);
        effectiveProvider = "gateio";
        contract = verified;
        break;
      } else if (prov === "binance") {
        successfulBars = await fetchBinanceHistoricalBars(verified.symbol, timeframe, range.from, range.lastOpen, fetcher);
        effectiveProvider = "binance";
        contract = verified;
        break;
      } else if (prov === "okx") {
        successfulBars = await fetchOkxHistoricalBars(verified.symbol, timeframe, range.from, range.lastOpen, fetcher);
        effectiveProvider = "okx";
        contract = verified;
        break;
      }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      // The selected instrument remains unavailable; no other venue is substituted.
    }
  }

  if (successfulBars) successfulBars = normalizeChartBars(successfulBars).filter(bar => bar.t >= range.from && bar.t < cutoff);
  if (successfulBars?.some(bar => alignToTimeframe(bar.t, timeframe) !== bar.t)) return unavailable("Provider candle alignment does not match the UTC timeframe", 503);
  if (!successfulBars || successfulBars.length === 0 || !contract) {
    return unavailable(lastError?.message || "Selected venue has no candle coverage in the requested range", 503);
  }

  const retrievedAt = Date.now();
  const payload = {
    symbol: requestedSymbol,
    requestedSymbol,
    timeframe,
    provider: effectiveProvider,
    requestedProvider,
    selectedProvider: requestedProvider,
    effectiveProvider,
    nativeSymbol: contract.symbol,
    canonicalSymbol: `${contract.root}${contract.currency}`,
    cache: "network",
    retrievedAt,
    sourceTimestamp: successfulBars.at(-1)?.t ?? null,
    integrity: "provider-ohlcv",
    reason: successfulBars.length < range.expected ? "Partial historical coverage; absent candles are not filled" : "Historical OHLCV does not establish a live subscription",
    requestedFrom: range.from, requestedTo: cutoff, requestedCount: barsCount,
    gapCount: range.expected - successfulBars.length,
    hasOpenCandle: successfulBars.some(bar => bar.t + interval > retrievedAt),
    volumeUnit: effectiveProvider === "gateio" || effectiveProvider === "okx" ? "contracts" : "base",
    contract,
    timestampUnit: "ms",
    environment: "live",
    dataStatus: "HISTORICAL",
    from: successfulBars[0]?.t ?? null,
    to: successfulBars.at(-1)?.t ?? null,
    bars: successfulBars,
  };

  cacheResponse(cacheKey, payload);
  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
