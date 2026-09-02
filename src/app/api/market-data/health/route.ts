import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MARKET_GATEWAY_URL = process.env.MARKET_GATEWAY_URL
  ?? `http://127.0.0.1:${process.env.MARKET_DATA_PORT ?? "3003"}`;

/** Read-only gateway diagnostics; upstream health is never converted to LIVE. */
export async function GET() {
  try {
    const upstream = await fetch(`${MARKET_GATEWAY_URL}/healthz`, { cache: "no-store", headers: { Accept: "application/json" } });
    const body = await upstream.json();
    return NextResponse.json(body, { status: upstream.status, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ ok: false, state: "unavailable", dataStatus: "UNAVAILABLE", reason: error instanceof Error ? error.message : "Market-data gateway unavailable", at: Date.now() }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
