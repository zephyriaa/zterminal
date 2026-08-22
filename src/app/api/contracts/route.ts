import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MARKET_GATEWAY_URL = process.env.MARKET_GATEWAY_URL
  ?? `http://127.0.0.1:${process.env.MARKET_DATA_PORT ?? "3003"}`;

/**
 * A browser-safe projection of the active read-only market provider's discovered
 * catalogue. This intentionally has no static or cross-venue fallback: a symbol
 * is selectable only when its provider adapter has validated it for this service.
 */
export async function GET() {
  try {
    const upstream = await fetch(`${MARKET_GATEWAY_URL}/contracts`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    const body = await upstream.json();
    return NextResponse.json(body, {
      status: upstream.status,
      headers: { "Cache-Control": "no-store, max-age=0, must-revalidate" },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Active provider catalogue unavailable",
        contracts: [],
      },
      { status: 503, headers: { "Cache-Control": "no-store, max-age=0, must-revalidate" } }
    );
  }
}
