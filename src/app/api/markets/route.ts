import { NextResponse } from "next/server";
import { GATEIO_DEFAULT_SYMBOL, GATEIO_REST_URL, parseGateDecimal } from "@/lib/market/gateio";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Read-only Gate.io market snapshot for the initial live watchlist. */
export async function GET() {
  try {
    const url = new URL(`${GATEIO_REST_URL}/futures/usdt/tickers`);
    url.searchParams.set("contract", GATEIO_DEFAULT_SYMBOL);
    const response = await fetch(url, { headers: { Accept: "application/json" }, next: { revalidate: 0 } });
    if (!response.ok) throw new Error(`Gate.io ticker unavailable (${response.status})`);
    const raw = await response.json();
    const ticker = Array.isArray(raw) ? raw[0] : raw;
    if (!ticker || typeof ticker !== "object") throw new Error("invalid Gate.io ticker response");
    const data = ticker as Record<string, unknown>;
    const price = parseGateDecimal(data.last, "ticker last");
    const changePct = parseGateDecimal(data.change_percentage ?? "0", "ticker change percentage");
    const previous = changePct === -100 ? price : price / (1 + changePct / 100);
    const rows = [{
      symbol: GATEIO_DEFAULT_SYMBOL,
      description: "QQQX / USDT Perpetual",
      exchange: "GATEIO",
      product: "perpetual",
      price,
      change: price - previous,
      changePct,
      dayHigh: parseGateDecimal(data.high_24h ?? data.last, "ticker high"),
      dayLow: parseGateDecimal(data.low_24h ?? data.last, "ticker low"),
      volume: Math.abs(parseGateDecimal(data.volume_24h_quote ?? data.volume_24h ?? "0", "ticker volume")),
      supportsDepth: true,
      supportsMBO: false,
    }];
    return NextResponse.json({ provider: "gateio", environment: "live", dataStatus: "LIVE", at: Date.now(), rows });
  } catch (error) {
    return NextResponse.json(
      { provider: "gateio", environment: "live", dataStatus: "UNAVAILABLE", error: error instanceof Error ? error.message : "Gate.io market unavailable", rows: [] },
      { status: 503 }
    );
  }
}
