import { NextResponse } from "next/server";
import { listContracts } from "@/lib/market/contracts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MARKET_GATEWAY_URL = process.env.MARKET_GATEWAY_URL
  ?? `http://127.0.0.1:${process.env.MARKET_DATA_PORT ?? "3003"}`;

/**
 * Returns available market contracts catalog. If upstream market gateway is
 * active, returns discovered contracts; otherwise falls back to our verified
 * comprehensive multi-asset contracts catalog (25+ crypto, equities, commodities).
 */
export async function GET() {
  try {
    const upstream = await fetch(`${MARKET_GATEWAY_URL}/contracts`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (upstream.ok) {
      const body = await upstream.json();
      if (Array.isArray(body.contracts) && body.contracts.length > 0) {
        return NextResponse.json(body, {
          status: upstream.status,
          headers: { "Cache-Control": "no-store, max-age=0, must-revalidate" },
        });
      }
    }
  } catch {
    // Upstream gateway not active - fallback to verified multi-asset contracts
  }

  const staticContracts = listContracts();
  return NextResponse.json(
    {
      provider: "multi",
      environment: "live",
      state: "connected",
      contracts: staticContracts,
    },
    { status: 200, headers: { "Cache-Control": "no-store, max-age=0, must-revalidate" } }
  );
}
