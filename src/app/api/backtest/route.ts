import { NextRequest, NextResponse } from "next/server";
import { getContract } from "@/lib/market/contracts";
import { fetchGateioHistoricalBars, isGateioTimeframe, normalizeGateioSymbol } from "@/lib/market/gateio";
import { fetchBinanceHistoricalBars, normalizeBinanceSymbol } from "@/lib/market/binance";
import { runStrategy, type BacktestConfig, type StrategyParams } from "@/lib/strategy/zs-runtime";
import { compileStrategy } from "@/lib/strategy/zs-compiler";
import { TIMEFRAME_SECONDS } from "@/lib/market/types";

export const dynamic = "force-dynamic";

/**
 * Deterministic backtest endpoint.
 *
 * Identical inputs (source, symbol, timeframe, range, costs, params)
 * always produce an identical result (same hash + trades). No
 * randomness enters the engine. Candles are fetched only from the configured
 * public provider and provenance is returned with every successful run.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const provider = process.env.MARKET_PROVIDER === "binance" ? "binance" : "gateio";
  const src: string = body?.src ?? "";
  const symbol: string = (body?.symbol ?? (provider === "binance" ? "BTCUSDT" : "QQQX_USDT")).toUpperCase();
  const tf = String(body?.timeframe ?? "5m");
  const from = Number(body?.from ?? Date.now() - 30 * 86400_000);
  const to = Number(body?.to ?? Date.now());
  const initialCapital = Number(body?.initialCapital ?? 100_000);
  const commissionPerContract = Number(body?.commissionPerContract ?? 2.5);
  const slippageTicks = Number(body?.slippageTicks ?? 1);
  const spreadTicks = Number(body?.spreadTicks ?? 1);
  const positionSize = Number(body?.positionSize ?? 1);
  const params: StrategyParams = body?.params ?? {};
  const executionModel: "next_bar_open" = "next_bar_open";

  if (!isGateioTimeframe(tf)) return NextResponse.json({ error: `unsupported ${provider === "binance" ? "Binance" : "Gate.io"} historical timeframe` }, { status: 400 });
  if (![from, to, initialCapital, commissionPerContract, slippageTicks, spreadTicks, positionSize].every(Number.isFinite)) {
    return NextResponse.json({ error: "backtest configuration must contain finite numeric values" }, { status: 400 });
  }
  if (from >= to || from < 0) return NextResponse.json({ error: "backtest range must have a valid start before its end" }, { status: 400 });
  if (initialCapital <= 0 || positionSize <= 0 || commissionPerContract < 0 || slippageTicks < 0 || spreadTicks < 0) {
    return NextResponse.json({ error: "capital and position size must be positive; execution costs cannot be negative" }, { status: 400 });
  }
  const maxHistoricalRangeMs = TIMEFRAME_SECONDS[tf] * 1_000 * 2_000 * 48;
  if (to - from > maxHistoricalRangeMs) {
    return NextResponse.json({ error: `requested historical range exceeds the verified ${provider === "binance" ? "Binance" : "Gate.io"} pagination limit for this timeframe` }, { status: 400 });
  }

  const c = getContract(symbol);
  const nativeSymbol = provider === "binance" ? normalizeBinanceSymbol(symbol) : normalizeGateioSymbol(symbol);
  if (!nativeSymbol) {
    return NextResponse.json({
      error: `historical data is currently unavailable for ${symbol} on the active ${provider === "binance" ? "Binance" : "Gate.io"} provider`,
      dataStatus: "UNAVAILABLE",
    }, { status: 400 });
  }

  const compiled = compileStrategy(src);
  if (!compiled.ok && compiled.diagnostics.some((d) => d.severity === "error")) {
    return NextResponse.json({ error: "strategy has compile errors", diagnostics: compiled.diagnostics }, { status: 400 });
  }

  let bars;
  try {
    bars = provider === "binance"
      ? await fetchBinanceHistoricalBars(nativeSymbol, tf as keyof typeof TIMEFRAME_SECONDS, from, to)
      : await fetchGateioHistoricalBars(nativeSymbol, tf as keyof typeof TIMEFRAME_SECONDS, from, to);
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "historical market data is unavailable",
      dataStatus: "UNAVAILABLE",
    }, { status: 502 });
  }
  if (bars.length < 5) {
    return NextResponse.json({ error: "insufficient verified historical data for the selected range", dataStatus: "UNAVAILABLE" }, { status: 400 });
  }

  const cfg: BacktestConfig = {
    symbol,
    timeframe: tf,
    from,
    to,
    initialCapital,
    commissionPerContract,
    slippageTicks,
    spreadTicks,
    tickSize: c.tickSize,
    tickValue: c.tickValue,
    multiplier: c.multiplier,
    positionSize,
    executionModel,
  };

  const result = runStrategy(src, bars, cfg, params);

  // monthly returns
  const monthly = monthlyReturns(result.equity);

  return NextResponse.json({
    ...result,
    monthly,
    timeframeSeconds: TIMEFRAME_SECONDS[tf],
    diagnostics: compiled.diagnostics,
    dataStatus: "HISTORICAL",
    dataProvenance: {
      provider,
      nativeSymbol,
      range: { from, to },
      timeframe: tf,
      fetchedAt: Date.now(),
      barCount: bars.length,
    },
  });
}

function monthlyReturns(equity: { t: number; v: number }[]) {
  if (!equity.length) return [];
  const byMonth = new Map<string, { start: number; end: number }>();
  for (const p of equity) {
    const key = new Date(p.t).toISOString().slice(0, 7);
    const cur = byMonth.get(key) ?? { start: p.v, end: p.v };
    cur.end = p.v;
    byMonth.set(key, cur);
  }
  const out: { month: string; ret: number }[] = [];
  let prevEnd = equity[0].v;
  for (const [month, v] of byMonth) {
    const ret = prevEnd ? (v.end - prevEnd) / prevEnd : 0;
    out.push({ month, ret: ret * 100 });
    prevEnd = v.end;
  }
  return out;
}
