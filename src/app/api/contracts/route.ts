import { NextResponse } from "next/server";
import { listContracts } from "@/lib/market/contracts";

export const dynamic = "force-dynamic";

/** Contract metadata for the symbol universe. */
export async function GET() {
  return NextResponse.json({
    provider: "mock",
    environment: "simulation",
    dataStatus: "SIMULATED",
    contracts: listContracts(),
  });
}
