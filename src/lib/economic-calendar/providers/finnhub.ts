import type {
  CalendarRequest,
  EconomicCalendarEvent,
  EconomicCalendarProvider,
  EconomicCalendarProviderResult,
  EconomicEventImpact,
  EconomicEventStatus,
} from "../types";

interface FinnhubEconomicEvent {
  actual?: number | null;
  prev?: number | null;
  estimate?: number | null;
  country?: string;
  currency?: string;
  event?: string;
  impact?: string; // "high", "medium", "low"
  time?: string;   // e.g. "2026-09-09 12:30:00"
  unit?: string;
}

interface FinnhubResponse {
  economicCalendar?: FinnhubEconomicEvent[];
}

function normalizeFinnhubImpact(raw?: string): EconomicEventImpact {
  if (!raw) return "unknown";
  const lower = raw.toLowerCase();
  if (lower.includes("high") || lower === "3") return "high";
  if (lower.includes("med") || lower === "2") return "medium";
  if (lower.includes("low") || lower === "1") return "low";
  return "unknown";
}

function formatNumericVal(val: number | null | undefined, unit?: string): string | null {
  if (val === null || val === undefined || Number.isNaN(val)) return null;
  const formatted = val.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return unit ? `${formatted}${unit}` : formatted;
}

export class FinnhubCalendarProvider implements EconomicCalendarProvider {
  readonly id = "finnhub";
  readonly label = "Global Economic Calendar (Finnhub)";

  private apiKey: string | null;

  constructor(apiKey: string | null = process.env.FINNHUB_API_KEY ?? null) {
    this.apiKey = apiKey && apiKey.trim().length > 0 ? apiKey.trim() : null;
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  async fetchEvents(request: CalendarRequest): Promise<EconomicCalendarProviderResult> {
    if (!this.apiKey) {
      return {
        providerId: this.id,
        status: "unconfigured",
        events: [],
        message: "Finnhub API key not configured. Set FINNHUB_API_KEY in environment for global consensus forecasts and multi-currency events.",
      };
    }

    try {
      const fromYmd = request.from.toISOString().slice(0, 10);
      const toYmd = request.to.toISOString().slice(0, 10);

      const url = `https://finnhub.io/api/v1/calendar/economic?from=${fromYmd}&to=${toYmd}&token=${this.apiKey}`;

      const response = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": "ZTerminal-Research/1.0" },
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        return {
          providerId: this.id,
          status: "failed",
          events: [],
          message: `Finnhub API responded with HTTP ${response.status}.`,
        };
      }

      const data = (await response.json()) as FinnhubResponse;
      if (!Array.isArray(data.economicCalendar)) {
        return {
          providerId: this.id,
          status: "degraded",
          events: [],
          message: "Unexpected Finnhub calendar payload shape.",
        };
      }

      const events: EconomicCalendarEvent[] = [];
      const nowMs = Date.now();

      for (const item of data.economicCalendar) {
        if (!item.event || !item.time) continue;

        // Finnhub timestamps are in UTC format "YYYY-MM-DD HH:mm:ss" or ISO
        const isoString = item.time.includes("T") ? item.time : `${item.time.replace(" ", "T")}.000Z`;
        const scheduledDate = new Date(isoString);
        if (Number.isNaN(scheduledDate.getTime())) continue;

        const scheduledAt = scheduledDate.toISOString();
        const currency = item.currency?.toUpperCase() ?? "USD";
        const impact = normalizeFinnhubImpact(item.impact);

        if (request.currencies?.length && !request.currencies.includes(currency)) continue;
        if (request.impacts?.length && !request.impacts.includes(impact)) continue;

        const actualStr = formatNumericVal(item.actual, item.unit);
        const forecastStr = formatNumericVal(item.estimate, item.unit);
        const prevStr = formatNumericVal(item.prev, item.unit);

        const isPast = scheduledDate.getTime() <= nowMs;
        const status: EconomicEventStatus = isPast && actualStr !== null ? "released" : "scheduled";

        const slug = item.event.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 30);
        const id = `finnhub:${currency.toLowerCase()}:${slug}:${scheduledAt}`;

        events.push({
          id,
          title: item.event,
          country: item.country?.toUpperCase(),
          currency,
          scheduledAt,
          actual: actualStr,
          forecast: forecastStr,
          previous: prevStr,
          revised: null,
          impact,
          status,
          source: "Finnhub Aggregator",
          providerEventId: `${slug}-${scheduledAt}`,
          unit: item.unit,
        });
      }

      return {
        providerId: this.id,
        status: "healthy",
        events,
        message: `Retrieved ${events.length} events from Finnhub.`,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      return {
        providerId: this.id,
        status: "failed",
        events: [],
        error: msg,
        message: "Failed to connect to Finnhub economic calendar endpoint.",
      };
    }
  }
}
