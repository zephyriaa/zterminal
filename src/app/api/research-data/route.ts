import { NextRequest, NextResponse } from "next/server";
import { fetchGateioHistoricalBars, normalizeGateioSymbol, isGateioTimeframe } from "@/lib/market/gateio";
import { fetchBinanceHistoricalBars, normalizeBinanceSymbol } from "@/lib/market/binance";
import { validateDataset, intervalMs, sha256 } from "@/lib/local-research/dataset";
import type { Dataset } from "@/lib/local-research/contracts";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Public historical data only. Strategy source and Python execution never reach this route. */
export async function GET(request: NextRequest) {
  try {
    const query = request.nextUrl.searchParams;
    const provider = query.get("provider"), input = query.get("symbol") ?? "", timeframe = query.get("timeframe") ?? "1h";
    if (provider !== "gateio" && provider !== "binance") throw new Error("Select a supported verified provider.");
    if (!isGateioTimeframe(timeframe)) throw new Error("Unsupported timeframe.");
    const symbol = provider === "gateio" ? normalizeGateioSymbol(input) : normalizeBinanceSymbol(input);
    if (!symbol) throw new Error("Unsupported provider-native symbol.");
    const from = Number(query.get("from")), to = Number(query.get("to"));
    const interval = intervalMs(timeframe);
    if (!Number.isSafeInteger(from) || !Number.isSafeInteger(to) || from < 0 || from >= to || from % interval || to % interval || (to - from) / interval > 20_000 || to > Math.floor(Date.now() / interval) * interval) throw new Error("Select a complete, aligned range of 2–20,000 closed candles. Two years of hourly data is supported where available.");
    const fetcher = (url: string | URL, init?: RequestInit) => fetch(url, { ...init, signal: AbortSignal.any([request.signal, AbortSignal.timeout(20_000)]) });
    const raw = await (provider === "gateio" ? fetchGateioHistoricalBars(symbol, timeframe, from, to - interval, fetcher) : fetchBinanceHistoricalBars(symbol, timeframe, from, to - interval, fetcher));
    const bars = validateDataset(raw, { from, to, timeframe });
    const dataset: Dataset = { version: 1, provider, product: "perpetual", symbol, timeframe, from, to, bars, hash: await sha256(JSON.stringify(bars.map(b => [b.t, b.o, b.h, b.l, b.c, b.v]))) };
    return NextResponse.json(dataset, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Historical data unavailable. Adjust the range explicitly." }, { status: 422 });
  }
}
