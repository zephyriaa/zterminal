import type {
  CalendarRequest,
  EconomicCalendarEvent,
  EconomicCalendarProvider,
  EconomicCalendarProviderResult,
  EconomicEventImpact,
} from "../types";

interface TreasuryAuctionRecord {
  record_date?: string;
  security_type?: string;
  security_term?: string;
  auction_date?: string;
  issue_date?: string;
  high_yield?: string | null;
  bid_to_cover_ratio?: string | null;
  cusip?: string;
}

interface TreasuryApiResponse {
  data?: TreasuryAuctionRecord[];
}

function classifyAuctionImpact(term?: string): EconomicEventImpact {
  if (!term) return "low";
  const lower = term.toLowerCase();
  if (lower.includes("10-year") || lower.includes("30-year") || lower.includes("2-year")) {
    return "medium";
  }
  return "low";
}

export class TreasuryAuctionsProvider implements EconomicCalendarProvider {
  readonly id = "treasury";
  readonly label = "U.S. Department of the Treasury (Auctions)";

  isConfigured(): boolean {
    return true; // Public open REST API
  }

  async fetchEvents(request: CalendarRequest): Promise<EconomicCalendarProviderResult> {
    if (request.currencies?.length && !request.currencies.includes("USD")) {
      return { providerId: this.id, status: "healthy", events: [] };
    }

    try {
      const fromYmd = request.from.toISOString().slice(0, 10);
      const toYmd = request.to.toISOString().slice(0, 10);

      // Query auctions whose record_date or auction_date is within window
      const url = `https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/od/auctions_query?filter=record_date:gte:${fromYmd},record_date:lte:${toYmd}&page[size]=100`;

      const response = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": "ZTerminal-Research/1.0" },
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        return {
          providerId: this.id,
          status: "degraded",
          events: [],
          message: `Treasury API returned status ${response.status}.`,
        };
      }

      const data = (await response.json()) as TreasuryApiResponse;
      if (!Array.isArray(data.data)) {
        return {
          providerId: this.id,
          status: "degraded",
          events: [],
          message: "Unexpected Fiscal Data payload.",
        };
      }

      const events: EconomicCalendarEvent[] = [];
      const nowMs = Date.now();

      for (const item of data.data) {
        const dateStr = item.auction_date ?? item.record_date;
        if (!dateStr || !item.security_term || !item.security_type) continue;

        // Treasury auctions typically close at 13:00 Eastern (17:00 or 18:00 UTC)
        const scheduledAt = `${dateStr}T17:00:00.000Z`;
        const scheduledMs = new Date(scheduledAt).getTime();
        const impact = classifyAuctionImpact(item.security_term);

        if (request.impacts?.length && !request.impacts.includes(impact)) continue;

        const title = `U.S. Treasury ${item.security_term} ${item.security_type} Auction`;
        const slug = `${item.security_term}-${item.security_type}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");
        const id = `ust:${slug}:${dateStr}`;

        const isPast = scheduledMs <= nowMs;
        const actualStr = item.high_yield && item.high_yield !== "null" ? `${item.high_yield}%` : null;

        events.push({
          id,
          title,
          country: "US",
          currency: "USD",
          scheduledAt,
          actual: actualStr,
          forecast: null,
          previous: null,
          revised: null,
          impact,
          status: isPast && actualStr !== null ? "released" : "scheduled",
          source: "U.S. Treasury",
          sourceUrl: "https://fiscaldata.treasury.gov/datasets/auctions-query/",
          providerEventId: item.cusip,
          unit: "%",
        });
      }

      return {
        providerId: this.id,
        status: "healthy",
        events,
        message: `Retrieved ${events.length} Treasury auction announcements.`,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      return {
        providerId: this.id,
        status: "failed",
        events: [],
        error: msg,
        message: "Failed to connect to U.S. Treasury Fiscal Data API.",
      };
    }
  }
}

