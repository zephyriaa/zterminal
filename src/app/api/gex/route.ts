import { NextRequest, NextResponse } from "next/server";
import { fetchDeribitGex, type DeribitGexSummary } from "@/lib/market/deribit-gex";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CACHE_TTL_MS = 30_000;
const gexCache = new Map<string, { expiresAt: number; data: DeribitGexSummary }>();

export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams;
  const currencyParam = (search.get("currency") || "BTC").toUpperCase();
  const currency = currencyParam === "ETH" ? "ETH" : "BTC";

  const cached = gexCache.get(currency);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(cached.data);
  }

  try {
    const data = await fetchDeribitGex(currency);
    gexCache.set(currency, { expiresAt: Date.now() + CACHE_TTL_MS, data });
    return NextResponse.json(data);
  } catch (error) {
    // If cached stale data exists, return it with a warning
    if (cached) {
      return NextResponse.json(cached.data);
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch crypto options GEX data" },
      { status: 502 }
    );
  }
}
