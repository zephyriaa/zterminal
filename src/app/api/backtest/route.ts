import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * ZS backtesting is retired. New research runs are created through the
 * separately deployed Python research API and must be processed by an isolated
 * worker plus the Rust deterministic engine. Keeping this explicit prevents a
 * silent fallback to the former in-process JavaScript runtime.
 */
export async function POST() {
  return NextResponse.json({
    error: "The legacy ZS backtest endpoint is retired. Validate Python source and queue a research job through the Python Research API.",
    code: "ZS_BACKTEST_RETIRED",
    dataStatus: "UNAVAILABLE",
  }, { status: 410, headers: { "Cache-Control": "no-store" } });
}
