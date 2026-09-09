import type {
  CalendarRequest,
  EconomicCalendarEvent,
  EconomicCalendarProvider,
  EconomicCalendarProviderResult,
  EconomicEventImpact,
} from "../types";

interface FredReleaseDateItem {
  release_id: number;
  release_name: string;
  date: string; // YYYY-MM-DD
}

interface FredReleasesDatesResponse {
  release_dates?: FredReleaseDateItem[];
  error_code?: number;
  error_message?: string;
}

const TIER_1_KEYWORDS = [
  "employment situation",
  "consumer price index",
  "gross domestic product",
  "fomc",
  "personal income and outlays",
];

const TIER_2_KEYWORDS = [
  "producer price index",
  "retail sales",
  "industrial production",
  "housing starts",
  "durable goods",
  "trade balance",
  "job openings",
  "consumer sentiment",
];

function classifyFredImpact(title: string): EconomicEventImpact {
  const lower = title.toLowerCase();
  if (TIER_1_KEYWORDS.some((kw) => lower.includes(kw))) return "high";
  if (TIER_2_KEYWORDS.some((kw) => lower.includes(kw))) return "medium";
  return "low";
}

export class FredCalendarProvider implements EconomicCalendarProvider {
  readonly id = "fred";
  readonly label = "Federal Reserve Economic Data (FRED)";

  private apiKey: string | null;

  constructor(apiKey: string | null = process.env.FRED_API_KEY ?? null) {
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
        message: "FRED API key not configured. Set FRED_API_KEY in environment to enable live official St. Louis Fed release schedules.",
      };
    }

    try {
      const fromYmd = request.from.toISOString().slice(0, 10);
      const toYmd = request.to.toISOString().slice(0, 10);

      const url = `https://api.stlouisfed.org/fred/releases/dates?api_key=${this.apiKey}&file_type=json&realtime_start=${fromYmd}&realtime_end=${toYmd}&include_release_dates_with_no_data=true`;

      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": "ZTerminal-Research/1.0",
        },
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        return {
          providerId: this.id,
          status: "failed",
          events: [],
          message: `FRED API request failed with status ${response.status}.`,
        };
      }

      const data = (await response.json()) as FredReleasesDatesResponse;
      if (!Array.isArray(data.release_dates)) {
        return {
          providerId: this.id,
          status: "degraded",
          events: [],
          message: data.error_message ?? "Unexpected FRED response shape.",
        };
      }

      const events: EconomicCalendarEvent[] = [];
      const nowMs = Date.now();

      for (const item of data.release_dates) {
        // Standard US major release time is typically 12:30 or 14:00 UTC (08:30 or 10:00 EDT)
        // FRED provides release date YYYY-MM-DD. Set canonical scheduled time to 12:30:00 UTC.
        const scheduledAt = `${item.date}T12:30:00.000Z`;
        const scheduledMs = new Date(scheduledAt).getTime();
        const impact = classifyFredImpact(item.release_name);

        if (request.impacts?.length && !request.impacts.includes(impact)) continue;
        if (request.currencies?.length && !request.currencies.includes("USD")) continue;

        const slug = item.release_name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 30);
        const id = `fred:usd:${item.release_id}:${slug}:${item.date}`;

        events.push({
          id,
          title: item.release_name,
          country: "US",
          currency: "USD",
          scheduledAt,
          actual: null, // FRED release dates endpoint supplies schedule; series observations provide values
          forecast: null, // Official government feeds do not manufacture forecasts
          previous: null,
          revised: null,
          impact,
          status: scheduledMs <= nowMs ? "released" : "scheduled",
          source: "Federal Reserve / FRED",
          sourceUrl: `https://fred.stlouisfed.org/releases/calendar?date=${item.date}`,
          providerEventId: String(item.release_id),
        });
      }

      return {
        providerId: this.id,
        status: "healthy",
        events,
        message: `Retrieved ${events.length} official release schedules from FRED.`,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      return {
        providerId: this.id,
        status: "failed",
        events: [],
        error: msg,
        message: "Failed to connect to St. Louis Fed FRED API.",
      };
    }
  }
}
