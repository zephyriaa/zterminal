import { NextResponse } from "next/server";
import { BINANCE_FUTURES_REST_URL } from "@/lib/market/binance";
import { GATEIO_DEFAULT_SYMBOL, GATEIO_REST_URL, parseGateDecimal } from "@/lib/market/gateio";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Read-only provider-backed market snapshot for the live watchlist. */
export async function GET(request: Request) {
  const requestedProvider = new URL(request.url).searchParams.get("provider") ?? process.env.MARKET_PROVIDER ?? "gateio";
  const provider = requestedProvider === "binance" ? "binance" : "gateio";
  try {
    if (provider === "binance") {
      const symbol = "BTCUSDT";
      const url = new URL(`${BINANCE_FUTURES_REST_URL}/fapi/v1/ticker/24hr`);
      url.searchParams.set("symbol", symbol);
      const response = await fetch(url, { headers: { Accept: "application/json" }, next: { revalidate: 0 } });
      if (!response.ok) throw new Error(`Binance ticker unavailable (${response.status})`);
      const raw = await response.json();
      if (!raw || typeof raw !== "object") throw new Error("invalid Binance ticker response");
      const data = raw as Record<string, unknown>;
      const price = decimal(data.lastPrice, "ticker last price");
      const change = decimal(data.priceChange, "ticker price change");
      const changePct = decimal(data.priceChangePercent, "ticker change percentage");
      return NextResponse.json({ provider, environment: "live", dataStatus: "LIVE", at: Date.now(), rows: [{
        symbol,
        upstreamSymbol: symbol,
        description: "BTC / USDT Perpetual",
        exchange: "BINANCE",
        product: "perpetual",
        price,
        change,
        changePct,
        dayHigh: decimal(data.highPrice, "ticker high"),
        dayLow: decimal(data.lowPrice, "ticker low"),
        volume: Math.abs(decimal(data.quoteVolume, "ticker quote volume")),
        supportsDepth: true,
        supportsMBO: false,
      }] });
    }
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
      // The workspace uses the canonical BTCUSDT display symbol. The request
      // remains explicitly labelled Gate.io and uses BTC_USDT upstream.
      symbol: "BTCUSDT",
      upstreamSymbol: GATEIO_DEFAULT_SYMBOL,
      description: "BTC / USDT Perpetual",
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
      { provider, environment: "live", dataStatus: "UNAVAILABLE", error: error instanceof Error ? error.message : `${provider} market unavailable`, rows: [] },
      { status: 503 }
    );
  }
}

function decimal(value: unknown, field: string) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isFinite(parsed)) throw new Error(`invalid ${field}`);
  return parsed;
}
