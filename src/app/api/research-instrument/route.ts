import { NextRequest, NextResponse } from "next/server";
import { GATEIO_REST_URL, normalizeGateioSymbol, parseGateDecimal } from "@/lib/market/gateio";
import { BINANCE_FUTURES_REST_URL, normalizeBinanceSymbol } from "@/lib/market/binance";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  try {
    const provider = request.nextUrl.searchParams.get("provider"), input = request.nextUrl.searchParams.get("symbol");
    if (provider !== "gateio" && provider !== "binance") throw new Error("Unsupported provider");
    const symbol = provider === "gateio" ? normalizeGateioSymbol(input) : normalizeBinanceSymbol(input);
    if (!symbol) throw new Error("Invalid native symbol");
    const response = await fetch(provider === "gateio" ? `${GATEIO_REST_URL}/futures/usdt/contracts/${symbol}` : `${BINANCE_FUTURES_REST_URL}/fapi/v1/exchangeInfo`, { signal: AbortSignal.any([request.signal, AbortSignal.timeout(15_000)]), cache: "no-store", headers: { "X-Gate-Size-Decimal": "1" } });
    if (!response.ok) throw new Error("Provider instrument metadata is unavailable");
    const raw = await response.json();
    let multiplier: number, quantityStep: number;
    if (provider === "gateio") {
      if (raw.name !== symbol || raw.in_delisting) throw new Error("Instrument is unavailable for new research requests");
      // Decimal lot contracts require a distinct precision contract; do not guess a step.
      if (raw.enable_decimal) throw new Error("Decimal Gate contract sizes are not supported in this preview. Select a whole-contract instrument.");
      multiplier = parseGateDecimal(raw.quanto_multiplier, "contract multiplier"); quantityStep = 1;
    } else {
      const contract = raw.symbols?.find((p: { symbol: string }) => p.symbol === symbol);
      if (contract?.contractType !== "PERPETUAL" || contract?.quoteAsset !== "USDT") throw new Error("Select a USDT perpetual instrument");
      const lot = contract.filters?.find((p: { filterType: string }) => p.filterType === "LOT_SIZE");
      multiplier = 1; quantityStep = Number(lot?.stepSize);
    }
    if (![multiplier, quantityStep].every(v => Number.isFinite(v) && v > 0)) throw new Error("Invalid provider quantity units");
    return NextResponse.json({ provider, symbol, multiplier, quantityStep, verifiedAt: Date.now() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return NextResponse.json({ error: (error as Error).message }, { status: 422 }); }
}
