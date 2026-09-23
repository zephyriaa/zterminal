import type { CalendarRequest, EconomicCalendarEvent, EconomicCalendarProvider, EconomicCalendarProviderResult, EconomicEventImpact } from "../types";

const FEED_URL = "https://apps.bea.gov/API/signup/release_dates.json";

function impactFor(title: string): EconomicEventImpact {
  if (/gross domestic product$|personal income and outlays|international trade in goods and services/i.test(title)) return "high";
  if (/corporate profits|international transactions|investment position|personal income by state/i.test(title)) return "medium";
  return "low";
}

export function parseBeaCalendar(payload: unknown, request: CalendarRequest): EconomicCalendarEvent[] {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("Invalid BEA calendar payload");
  const events: EconomicCalendarEvent[] = [];
  for (const [title, item] of Object.entries(payload)) {
    if (!item || typeof item !== "object" || !Array.isArray((item as { release_dates?: unknown }).release_dates)) continue;
    for (const value of (item as { release_dates: unknown[] }).release_dates) {
      if (typeof value !== "string" || !/(Z|[+-]\d{2}:\d{2})$/.test(value)) continue;
      const timestamp = Date.parse(value);
      if (!Number.isFinite(timestamp) || timestamp < request.from.getTime() || timestamp > request.to.getTime()) continue;
      const impact = impactFor(title);
      if (request.impacts?.length && !request.impacts.includes(impact)) continue;
      if (request.currencies?.length && !request.currencies.includes("USD")) continue;
      const scheduledAt = new Date(timestamp).toISOString();
      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      events.push({
        id: `bea:${slug}:${scheduledAt}`,
        title,
        country: "US",
        currency: "USD",
        scheduledAt,
        actual: null,
        forecast: null,
        previous: null,
        revised: null,
        impact,
        status: timestamp <= Date.now() ? "released" : "scheduled",
        source: "U.S. Bureau of Economic Analysis",
        sourceUrl: "https://www.bea.gov/news/schedule",
      });
    }
  }
  return [...new Map(events.map((event) => [event.id, event])).values()];
}

export class BeaCalendarProvider implements EconomicCalendarProvider {
  readonly id = "bea";
  readonly label = "U.S. Bureau of Economic Analysis";

  isConfigured(): boolean { return true; }

  async fetchEvents(request: CalendarRequest): Promise<EconomicCalendarProviderResult> {
    try {
      const response = await fetch(FEED_URL, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8000) });
      if (!response.ok) return { providerId: this.id, status: "failed", events: [], message: `BEA calendar returned HTTP ${response.status}.` };
      const payload: unknown = await response.json();
      const events = parseBeaCalendar(payload, request);
      return { providerId: this.id, status: "healthy", events, message: `Loaded ${events.length} official BEA release dates.` };
    } catch {
      return { providerId: this.id, status: "failed", events: [], message: "BEA calendar feed is temporarily unavailable." };
    }
  }
}
