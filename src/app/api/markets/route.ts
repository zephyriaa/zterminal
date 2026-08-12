import { NextResponse } from "next/server";
import { listContracts } from "@/lib/market/contracts";
import { generateBars, MOCK_ANCHOR_MS } from "@/lib/market/mock-provider";
import { TIMEFRAME_SECONDS, type Timeframe } from "@/lib/market/types";

export const dynamic = "force-dynamic";

/**
 * Markets snapshot for the watchlist. Deterministic given the day:
 * uses today's daily bar (SIMULATED) to compute change %.
 */
export async function GET() {
  const to = Date.now();
  const contracts = listContracts();
  const rows = contracts.map((c) => {
    // last 2 daily bars
    const tf: Timeframe = "1d";
    const sec = TIMEFRAME_SECONDS[tf];
    const from = to - 3 * sec * 1000;
    const bars = generateBars(c.symbol, tf, from, to);
    const last = bars[bars.length - 1];
    const prev = bars[bars.length - 2] ?? last;
    const price = last?.c ?? c.basePrice;
    const prevClose = prev?.c ?? price;
    const change = price - prevClose;
    const changePct = prevClose ? (change / prevClose) * 100 : 0;
    const dayHigh = Math.max(last?.h ?? price, prev?.h ?? price);
    const dayLow = Math.min(last?.l ?? price, prev?.l ?? price);
    const vol = bars.reduce((s, b) => s + b.v, 0);
    return {
      symbol: c.symbol,
      description: c.description,
      exchange: c.exchange,
      product: c.product,
      price,
      change,
      changePct,
      dayHigh,
      dayLow,
      volume: vol,
      supportsDepth: c.supportsDepth,
      supportsMBO: c.supportsMBO,
    };
  });
  return NextResponse.json({
    provider: "mock",
    environment: "simulation",
    dataStatus: "SIMULATED",
    at: to,
    rows,
  });
}
