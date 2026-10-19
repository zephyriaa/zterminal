import { NextResponse } from "next/server";
import { listContracts } from "@/lib/market/contracts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MARKET_GATEWAY_URL = process.env.MARKET_GATEWAY_URL
  ?? `http://127.0.0.1:${process.env.MARKET_DATA_PORT ?? "3003"}`;

/**
 * Returns available market contracts catalog. If upstream market gateway is
 * active, returns discovered contracts; otherwise retains unverified references.
 */
export async function GET(request?: Request) {
  const selectedProvider = new URL(request?.url ?? "http://localhost/api/contracts").searchParams.get("provider") ?? "gateio";
  try {
    const upstream = await fetch(`${MARKET_GATEWAY_URL}/contracts`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(5_000),
    });
    if (upstream.ok) {
      const body = await upstream.json();
      if (body.provider === selectedProvider && Array.isArray(body.contracts) && body.contracts.length > 0) {
        const verified = body.environment === "live" && ["gateio", "binance"].includes(body.provider);
        return NextResponse.json({ ...body, verified, contracts: body.contracts.map((contract: { verified?: boolean }) => ({ ...contract, verified: verified && contract.verified === true })) }, {
          status: upstream.status,
          headers: { "Cache-Control": "no-store, max-age=0, must-revalidate" },
        });
      }
    }
  } catch {
    // Preserve static references without asserting exchange verification.
  }

  const staticContracts = listContracts();
  return NextResponse.json(
    {
      provider: selectedProvider,
      state: "unavailable",
      verified: false,
      reason: "Selected provider catalogue unavailable on this gateway. Reference markets are unverified; selecting one requires valid provider metadata and history.",
      contracts: staticContracts.map(contract => ({ ...contract, verified: false })),
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
