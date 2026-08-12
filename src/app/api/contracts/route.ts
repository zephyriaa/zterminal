import { NextRequest, NextResponse } from "next/server";
import { listContracts } from "@/lib/market/contracts";
import { GATEIO_REST_URL, GateContractSchema, gateContractToMetadata } from "@/lib/market/gateio";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Read-only contract metadata from the selected provider. */
export async function GET(request: NextRequest) {
  const provider = request.nextUrl.searchParams.get("provider") === "mock" ? "mock" : "gateio";
  if (provider === "mock") {
    return NextResponse.json({
      provider: "mock",
      environment: "simulation",
      dataStatus: "SIMULATED",
      contracts: listContracts(),
    });
  }

  try {
    const response = await fetch(`${GATEIO_REST_URL}/futures/usdt/contracts`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 60 },
    });
    if (!response.ok) throw new Error(`Gate.io contracts unavailable (${response.status})`);
    const raw = await response.json();
    if (!Array.isArray(raw)) throw new Error("invalid Gate.io contracts response");
    const contracts = raw.flatMap((value) => {
      const result = GateContractSchema.safeParse(value);
      return result.success && !result.data.in_delisting ? [gateContractToMetadata(result.data)] : [];
    });
    return NextResponse.json({ provider: "gateio", environment: "live", dataStatus: "LIVE", contracts });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gate.io contracts unavailable" },
      { status: 503 }
    );
  }
}
