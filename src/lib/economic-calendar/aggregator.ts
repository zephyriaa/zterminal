import type {
  CalendarRequest,
  EconomicCalendarEvent,
  EconomicCalendarProvider,
  EconomicCalendarResponse,
  ProviderMetadata,
} from "./types";
import { CentralBankCalendarProvider } from "./providers/central-bank";
import { FredCalendarProvider } from "./providers/fred";
import { FinnhubCalendarProvider } from "./providers/finnhub";
import { TreasuryAuctionsProvider } from "./providers/treasury";
import { calendarCache } from "./cache";

function normalizeEventSlug(title: string): string {
  const lower = title.toLowerCase();
  if (/fomc|fed.*interest rate|fed.*rate decision|interest rate decision|rate decision|bank rate decision|deposit facility rate/.test(lower)) {
    return "rate-decision";
  }
  if (/consumer price index|cpi/.test(lower)) {
    return "cpi";
  }
  if (/producer price index|ppi/.test(lower)) {
    return "ppi";
  }
  if (/gross domestic product|gdp/.test(lower)) {
    return "gdp";
  }
  if (/nonfarm payroll|employment situation/.test(lower)) {
    return "nonfarm-payrolls";
  }
  return lower
    .replace(/\b(the|and|or|of|for|in|on|at|to|m\/m|y\/y|mom|yoy|annualized|preliminary|flash|final)\b/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
}

export class EconomicCalendarAggregator {
  private providers: EconomicCalendarProvider[];

  constructor(providers?: EconomicCalendarProvider[]) {
    this.providers = providers ?? [
      new CentralBankCalendarProvider(),
      new FredCalendarProvider(),
      new FinnhubCalendarProvider(),
      new TreasuryAuctionsProvider(),
    ];
  }

  /**
   * Fetches events across all configured providers, deduplicates deterministically,
   * caches the combined response, and returns normalized calendar metadata.
   */
  async getCalendar(
    request: CalendarRequest,
    options: { bypassCache?: boolean } = {}
  ): Promise<EconomicCalendarResponse> {
    const fromIso = request.from.toISOString();
    const toIso = request.to.toISOString();
    const cacheKey = `cal:${fromIso.slice(0, 10)}:${toIso.slice(0, 10)}:${(request.currencies ?? []).sort().join(",")}:${(request.impacts ?? []).sort().join(",")}`;

    if (!options.bypassCache) {
      const cached = calendarCache.get(cacheKey);
      if (cached) return cached.data;
    }

    const providerMetadataList: ProviderMetadata[] = [];
    const allEvents: EconomicCalendarEvent[] = [];

    // Execute providers concurrently with individual safety
    const results = await Promise.allSettled(
      this.providers.map(async (provider) => {
        const res = await provider.fetchEvents(request);
        return { provider, res };
      })
    );

    for (let i = 0; i < this.providers.length; i++) {
      const provider = this.providers[i];
      const outcome = results[i];

      if (outcome.status === "fulfilled") {
        const { res } = outcome.value;
        providerMetadataList.push({
          id: provider.id,
          label: provider.label,
          status: res.status,
          message: res.message,
          lastUpdated: new Date().toISOString(),
        });
        allEvents.push(...res.events);
      } else {
        providerMetadataList.push({
          id: provider.id,
          label: provider.label,
          status: "failed",
          message: outcome.reason?.message ?? "Provider execution rejected.",
          lastUpdated: new Date().toISOString(),
        });
      }
    }

    // Deterministic deduplication
    const deduplicated = this.deduplicateEvents(allEvents);

    // Sort ascending by scheduledAt UTC, then currency, then title
    deduplicated.sort((a, b) => {
      const diff = new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime();
      if (diff !== 0) return diff;
      const ccyDiff = a.currency.localeCompare(b.currency);
      if (ccyDiff !== 0) return ccyDiff;
      return a.title.localeCompare(b.title);
    });

    const response: EconomicCalendarResponse = {
      events: deduplicated,
      providers: providerMetadataList,
      from: fromIso,
      to: toIso,
      cachedAt: new Date().toISOString(),
      isStale: false,
    };

    calendarCache.set(cacheKey, response);
    return response;
  }

  /**
   * Deduplicates events based on currency, normalized title keyword, and scheduled release date.
   * Gives precedence to official authoritative sources (Central Banks, FRED, Treasury) over aggregators.
   */
  private deduplicateEvents(events: EconomicCalendarEvent[]): EconomicCalendarEvent[] {
    const map = new Map<string, EconomicCalendarEvent>();

    for (const event of events) {
      // Create a normalized fingerprint for matching cross-source titles
      const dateKey = event.scheduledAt.slice(0, 10);
      const titleSlug = normalizeEventSlug(event.title);
      const dedupKey = `${event.currency}:${dateKey}:${titleSlug}`;

      const existing = map.get(dedupKey);
      if (!existing) {
        map.set(dedupKey, event);
        continue;
      }

      // If existing is an aggregator and incoming is an official source, replace with official
      const incomingIsOfficial =
        event.source.includes("Federal Reserve") ||
        event.source.includes("ECB") ||
        event.source.includes("Bank of England") ||
        event.source.includes("Treasury");

      const existingIsOfficial =
        existing.source.includes("Federal Reserve") ||
        existing.source.includes("ECB") ||
        existing.source.includes("Bank of England") ||
        existing.source.includes("Treasury");

      if (incomingIsOfficial && !existingIsOfficial) {
        // Carry over forecast from aggregator if official does not provide forecast
        const merged: EconomicCalendarEvent = {
          ...event,
          forecast: event.forecast ?? existing.forecast,
        };
        map.set(dedupKey, merged);
      } else if (!incomingIsOfficial && existingIsOfficial) {
        // Keep official event, but enrich with forecast if official has none
        if (!existing.forecast && event.forecast) {
          existing.forecast = event.forecast;
        }
      } else {
        // Different events or stable IDs; if IDs are truly different, keep the incoming with unique ID
        if (event.id !== existing.id) {
          map.set(event.id, event);
        }
      }
    }

    return Array.from(map.values());
  }
}

export const defaultAggregator = new EconomicCalendarAggregator();
