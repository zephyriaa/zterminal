import type { CalendarRequest, EconomicCalendarEvent, EconomicCalendarProvider, EconomicCalendarProviderResult, EconomicEventImpact } from "../types";

const FEED_URL = "https://www.bls.gov/schedule/news_release/bls.ics";

function impactFor(title: string): EconomicEventImpact {
  if (/employment situation|consumer price index|producer price index|job openings and labor turnover/i.test(title)) return "high";
  if (/employment cost index|productivity and costs|import and export price indexes|state employment and unemployment/i.test(title)) return "medium";
  return "low";
}

function easternDateTime(value: string): string | null {
  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?$/.exec(value);
  if (!match) return null;
  const [, year, month, day, hour, minute, second] = match;
  const localMs = Date.UTC(+year, +month - 1, +day, +hour, +minute, +second);
  if (!Number.isFinite(localMs)) return null;
  if (value.endsWith("Z")) return new Date(localMs).toISOString();
  const offset = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", timeZoneName: "shortOffset" })
    .formatToParts(new Date(localMs))
    .find((part) => part.type === "timeZoneName")?.value.match(/GMT([+-]\d{1,2})/)?.[1];
  if (!offset) return null;
  return new Date(localMs - Number(offset) * 3_600_000).toISOString();
}

export function parseBlsCalendar(ics: string, request: CalendarRequest): EconomicCalendarEvent[] {
  const events: EconomicCalendarEvent[] = [];
  const unfolded = ics.replace(/\r?\n[ \t]/g, "");
  for (const block of unfolded.matchAll(/BEGIN:VEVENT\r?\n([\s\S]*?)\r?\nEND:VEVENT/g)) {
    const lines = block[1].split(/\r?\n/);
    const field = (name: string) => {
      const line = lines.find((candidate) => candidate.startsWith(name));
      return line?.slice(line.indexOf(":") + 1).trim();
    };
    const rawDate = field("DTSTART");
    const title = field("SUMMARY:")?.replace(/\\([,;\\])/g, "$1");
    if (!rawDate || !title) continue;
    const scheduledAt = easternDateTime(rawDate);
    if (!scheduledAt) continue;
    const timestamp = Date.parse(scheduledAt);
    if (timestamp < request.from.getTime() || timestamp > request.to.getTime()) continue;
    const impact = impactFor(title);
    if (request.impacts?.length && !request.impacts.includes(impact)) continue;
    if (request.currencies?.length && !request.currencies.includes("USD")) continue;
    const uid = field("UID:") ?? `${title}:${scheduledAt}`;
    const day = scheduledAt.slice(0, 10);
    events.push({
      id: `bls:${uid}:${scheduledAt}`,
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
      source: "U.S. Bureau of Labor Statistics",
      sourceUrl: `https://www.bls.gov/schedule/${day.slice(0, 4)}/${day.slice(5, 7)}_sched.htm`,
      providerEventId: uid,
    });
  }
  return events;
}

export class BlsCalendarProvider implements EconomicCalendarProvider {
  readonly id = "bls";
  readonly label = "U.S. Bureau of Labor Statistics";

  isConfigured(): boolean { return true; }

  async fetchEvents(request: CalendarRequest): Promise<EconomicCalendarProviderResult> {
    try {
      const response = await fetch(FEED_URL, {
        headers: { Accept: "text/calendar", "User-Agent": "Mozilla/5.0 (compatible; ZTerminalCalendar/1.0; +https://zterminal-web.zephyria-inc.workers.dev)" },
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) return { providerId: this.id, status: "failed", events: [], message: `BLS calendar returned HTTP ${response.status}.` };
      const ics = await response.text();
      if (!ics.includes("BEGIN:VCALENDAR") || !ics.includes("BEGIN:VEVENT")) return { providerId: this.id, status: "degraded", events: [], message: "BLS returned an invalid calendar feed." };
      const events = parseBlsCalendar(ics, request);
      return { providerId: this.id, status: "healthy", events, message: `Loaded ${events.length} official BLS release dates.` };
    } catch {
      return { providerId: this.id, status: "failed", events: [], message: "BLS calendar feed is temporarily unavailable." };
    }
  }
}
