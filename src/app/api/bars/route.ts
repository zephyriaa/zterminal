import { NextRequest, NextResponse } from "next/server";
import { generateBars } from "@/lib/market/mock-provider";
import { getContract } from "@/lib/market/contracts";
import { TIMEFRAME_SECONDS, type Timeframe } from "@/lib/market/types";

export const dynamic = "force-dynamic";

/**
 * Historical bars endpoint. Uses the deterministic mock provider so
 * identical requests always return identical bars (reproducible).
 * Data is SIMULATED — surfaced to the client as such.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const symbol = (sp.get("symbol") || "NQ").toUpperCase();
  const tf = (sp.get("tf") || "5m") as Timeframe;
  const to = Number(sp.get("to") || Date.now());
  const bars = Number(sp.get("bars") || 400);

  if (!getContract(symbol)) {
    return NextResponse.json({ error: "unknown symbol" }, { status: 400 });
  }
  const tfSec = TIMEFRAME_SECONDS[tf] ?? 300;
  const from = to - bars * tfSec * 1000;

  const data = generateBars(symbol, tf, from, to);
  return NextResponse.json({
    symbol,
    timeframe: tf,
    provider: "mock",
    environment: "simulation",
    dataStatus: "SIMULATED",
    from,
    to,
    bars: data,
  });
}
