import { NextRequest, NextResponse } from "next/server";
import { generateBars } from "@/lib/market/mock-provider";
import { getContract } from "@/lib/market/contracts";
import { runStrategy, type BacktestConfig, type StrategyParams } from "@/lib/strategy/zs-runtime";
import { compileStrategy } from "@/lib/strategy/zs-compiler";
import { TIMEFRAME_SECONDS, type Timeframe } from "@/lib/market/types";

export const dynamic = "force-dynamic";

/**
 * Deterministic backtest endpoint.
 *
 * Identical inputs (source, symbol, timeframe, range, costs, params)
 * always produce an identical result (same hash + trades). No
 * randomness in the engine. Data is SIMULATED (mock provider).
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const src: string = body?.src ?? "";
  const symbol: string = (body?.symbol ?? "NQ").toUpperCase();
  const tf = (body?.timeframe ?? "5m") as Timeframe;
  const from = Number(body?.from ?? Date.now() - 30 * 86400_000);
  const to = Number(body?.to ?? Date.now());
  const initialCapital = Number(body?.initialCapital ?? 100_000);
  const commissionPerContract = Number(body?.commissionPerContract ?? 2.5);
  const slippageTicks = Number(body?.slippageTicks ?? 1);
  const spreadTicks = Number(body?.spreadTicks ?? 1);
  const positionSize = Number(body?.positionSize ?? 1);
  const params: StrategyParams = body?.params ?? {};
  const executionModel: "next_bar_open" = "next_bar_open";

  const c = getContract(symbol);
  if (!c) return NextResponse.json({ error: "unknown symbol" }, { status: 400 });

  const compiled = compileStrategy(src);
  if (!compiled.ok && compiled.diagnostics.some((d) => d.severity === "error")) {
    return NextResponse.json({ error: "strategy has compile errors", diagnostics: compiled.diagnostics }, { status: 400 });
  }

  const bars = generateBars(symbol, tf, from, to);
  if (bars.length < 5) {
    return NextResponse.json({ error: "insufficient data for the selected range" }, { status: 400 });
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
    dataStatus: "SIMULATED",
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
