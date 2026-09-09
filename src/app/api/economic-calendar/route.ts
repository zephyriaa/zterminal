import { NextRequest, NextResponse } from "next/server";
import { defaultAggregator } from "@/lib/economic-calendar/aggregator";
import type { EconomicEventImpact } from "@/lib/economic-calendar/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_WINDOW_DAYS = 31;
const ONE_YEAR_MS = 365 * 24 * 3600 * 1000;

export async function GET(request: NextRequest) {
  try {
    const search = request.nextUrl.searchParams;

    const fromParam = search.get("from");
    const toParam = search.get("to");
    const currencyParam = search.get("currency");
    const impactParam = search.get("impact");
    const refreshParam = search.get("refresh") === "true";

    const now = new Date();

    // Default window: start of current week (Monday) to Sunday + 1 week
    let fromDate: Date;
    let toDate: Date;

    if (fromParam) {
      fromDate = new Date(fromParam);
      if (Number.isNaN(fromDate.getTime())) {
        return NextResponse.json({ error: "Invalid 'from' parameter. Expected ISO-8601 string or YYYY-MM-DD." }, { status: 400 });
      }
    } else {
      const day = (now.getUTCDay() + 6) % 7;
      fromDate = new Date(now.getTime() - day * 86_400_000 - 86_400_000);
    }

    if (toParam) {
      toDate = new Date(toParam);
      if (Number.isNaN(toDate.getTime())) {
        return NextResponse.json({ error: "Invalid 'to' parameter. Expected ISO-8601 string or YYYY-MM-DD." }, { status: 400 });
      }
    } else {
      toDate = new Date(fromDate.getTime() + 14 * 86_400_000);
    }

    // Validation: inverted range
    if (fromDate.getTime() > toDate.getTime()) {
      return NextResponse.json({ error: "'from' date must be before or equal to 'to' date." }, { status: 400 });
    }

    // Validation: absurd dates
    const diffMs = toDate.getTime() - fromDate.getTime();
    if (diffMs > MAX_WINDOW_DAYS * 86_400_000) {
      return NextResponse.json({ error: `Requested range exceeds maximum supported window of ${MAX_WINDOW_DAYS} days.` }, { status: 400 });
    }

    if (Math.abs(fromDate.getTime() - now.getTime()) > ONE_YEAR_MS || Math.abs(toDate.getTime() - now.getTime()) > ONE_YEAR_MS) {
      return NextResponse.json({ error: "Requested dates are beyond the supported 1-year historical/forward horizon." }, { status: 400 });
    }

    const currencies = currencyParam
      ? currencyParam.split(",").map((c) => c.trim().toUpperCase()).filter(Boolean)
      : undefined;

    const impacts = impactParam
      ? (impactParam.split(",").map((i) => i.trim().toLowerCase()).filter((i) => ["high", "medium", "low", "unknown"].includes(i)) as EconomicEventImpact[])
      : undefined;

    const response = await defaultAggregator.getCalendar(
      {
        from: fromDate,
        to: toDate,
        currencies,
        impacts,
      },
      { bypassCache: refreshParam }
    );

    return NextResponse.json(response, {
      status: 200,
      headers: {
        "Cache-Control": "private, max-age=60, stale-while-revalidate=600",
        "Content-Type": "application/json",
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal economic calendar error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

