import { NextResponse } from "next/server";
import { PROVIDER_CATALOG } from "@/lib/market/capabilities";

export const dynamic = "force-static";

/** Public capability metadata only. This endpoint does not create a market-data connection. */
export function GET() {
  return NextResponse.json({
    generatedAt: Date.now(),
    aggregationPolicy: "Only validated equivalent instruments may participate in an aggregated view; venue-specific depth, funding, open interest, and liquidations remain source-labelled.",
    providers: PROVIDER_CATALOG,
  });
}
