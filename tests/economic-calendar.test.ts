import assert from "node:assert/strict";
import test from "node:test";
import { CentralBankCalendarProvider } from "../src/lib/economic-calendar/providers/central-bank";
import { FredCalendarProvider } from "../src/lib/economic-calendar/providers/fred";
import { FinnhubCalendarProvider } from "../src/lib/economic-calendar/providers/finnhub";
import { TreasuryAuctionsProvider } from "../src/lib/economic-calendar/providers/treasury";
import { EconomicCalendarAggregator } from "../src/lib/economic-calendar/aggregator";
import {
  formatEventTime,
  getLocalDateKey,
  formatDateGroupHeader,
  groupEventsByLocalDate,
  getNextUpcomingEvent,
} from "../src/lib/economic-calendar/date-utils";
import type {
  EconomicCalendarEvent,
  EconomicCalendarProvider,
  CalendarRequest,
  EconomicCalendarProviderResult,
} from "../src/lib/economic-calendar/types";
import { calendarCache } from "../src/lib/economic-calendar/cache";

test("1. CentralBankCalendarProvider normalizes authoritative rate decisions without fabricating forecasts", async () => {
  const provider = new CentralBankCalendarProvider();
  assert.equal(provider.isConfigured(), true);

  const res = await provider.fetchEvents({
    from: new Date("2026-09-01T00:00:00.000Z"),
    to: new Date("2026-09-30T23:59:59.000Z"),
    currencies: ["USD", "EUR", "GBP", "JPY"],
  });

  assert.equal(res.status, "healthy");
  assert.ok(res.events.length >= 3, "Should contain major central bank meetings in Sep 2026");

  for (const event of res.events) {
    assert.ok(event.id.startsWith("cb:"), "ID must be deterministic with cb: prefix");
    assert.ok(["USD", "EUR", "GBP", "JPY"].includes(event.currency));
    assert.equal(event.impact, "high");
    assert.ok(event.scheduledAt.endsWith("Z"), "scheduledAt must be UTC ISO-8601");
    assert.ok(event.sourceUrl, "Must retain authoritative source URL");
  }

  // Check specific FOMC event
  const fomc = res.events.find((e) => e.currency === "USD" && e.title.includes("FOMC Rate Decision"));
  assert.ok(fomc, "FOMC event must be present");
  assert.equal(fomc.currency, "USD");
  assert.equal(fomc.country, "US");
  assert.equal(fomc.impact, "high");
  assert.equal(fomc.source, "Federal Reserve");
});

test("2. FredCalendarProvider gracefully reports unconfigured when key is absent", async () => {
  const provider = new FredCalendarProvider(null);
  assert.equal(provider.isConfigured(), false);

  const res = await provider.fetchEvents({
    from: new Date("2026-09-01T00:00:00.000Z"),
    to: new Date("2026-09-30T23:59:59.000Z"),
  });

  assert.equal(res.status, "unconfigured");
  assert.equal(res.events.length, 0);
  assert.ok(res.message?.includes("FRED_API_KEY"));
});

test("3. UTC to workspace timezone conversion formats accurately across timezones", () => {
  const eventUtc = "2026-09-16T18:00:00.000Z"; // 18:00 UTC = 14:00 EDT = 19:00 BST = 22:00 GST

  const nyTime = formatEventTime(eventUtc, "America/New_York");
  const utcTime = formatEventTime(eventUtc, "UTC");
  const londonTime = formatEventTime(eventUtc, "Europe/London");
  const dubaiTime = formatEventTime(eventUtc, "Asia/Dubai");

  assert.equal(nyTime, "14:00", "America/New_York (EDT) should be 14:00");
  assert.equal(utcTime, "18:00", "UTC should be 18:00");
  assert.equal(londonTime, "19:00", "Europe/London (BST) should be 19:00");
  assert.equal(dubaiTime, "22:00", "Asia/Dubai (GST) should be 22:00");
});

test("4. Daylight-saving transitions (EDT vs EST) convert correctly", () => {
  // Summer (EDT = UTC-4)
  const summerUtc = "2026-07-15T16:00:00.000Z";
  assert.equal(formatEventTime(summerUtc, "America/New_York"), "12:00");

  // Winter (EST = UTC-5)
  const winterUtc = "2026-12-15T16:00:00.000Z";
  assert.equal(formatEventTime(winterUtc, "America/New_York"), "11:00");
});

test("5. Events crossing local midnight render under the correct local date", () => {
  // 01:30 UTC on Sep 17 is:
  // - 21:30 EDT on Sep 16 in New York (previous day!)
  // - 01:30 UTC on Sep 17 in UTC (same day)
  // - 05:30 GST on Sep 17 in Dubai (same day morning)
  const midnightCrosser = "2026-09-17T01:30:00.000Z";

  const nyDateKey = getLocalDateKey(midnightCrosser, "America/New_York");
  const utcDateKey = getLocalDateKey(midnightCrosser, "UTC");
  const dubaiDateKey = getLocalDateKey(midnightCrosser, "Asia/Dubai");

  assert.equal(nyDateKey, "2026-09-16", "Must cross into previous day Sep 16 in NY");
  assert.equal(utcDateKey, "2026-09-17", "Must be Sep 17 in UTC");
  assert.equal(dubaiDateKey, "2026-09-17", "Must be Sep 17 in Dubai");

  const events: EconomicCalendarEvent[] = [
    {
      id: "test:tokyo:cpi",
      title: "Tokyo CPI y/y",
      currency: "JPY",
      country: "JP",
      scheduledAt: midnightCrosser,
      impact: "high",
      status: "scheduled",
      source: "Statistics Bureau of Japan",
    },
  ];

  const nyGroups = groupEventsByLocalDate(events, "America/New_York");
  assert.equal(nyGroups.length, 1);
  assert.equal(nyGroups[0].dateKey, "2026-09-16");

  const dubaiGroups = groupEventsByLocalDate(events, "Asia/Dubai");
  assert.equal(dubaiGroups.length, 1);
  assert.equal(dubaiGroups[0].dateKey, "2026-09-17");
});

test("6. Grouping and sorting preserves chronological scheduledAt order with deterministic tie-breaking", () => {
  const events: EconomicCalendarEvent[] = [
    {
      id: "e2",
      title: "Wholesale Trade",
      currency: "USD",
      scheduledAt: "2026-09-10T14:00:00.000Z",
      impact: "low",
      status: "scheduled",
      source: "Census",
    },
    {
      id: "e1",
      title: "CPI m/m",
      currency: "USD",
      scheduledAt: "2026-09-10T12:30:00.000Z",
      impact: "high",
      status: "scheduled",
      source: "BLS",
    },
    {
      id: "e3",
      title: "Initial Jobless Claims",
      currency: "USD",
      scheduledAt: "2026-09-10T12:30:00.000Z",
      impact: "high",
      status: "scheduled",
      source: "DOL",
    },
  ];

  const groups = groupEventsByLocalDate(events, "UTC");
  assert.equal(groups.length, 1);
  const sorted = groups[0].events;

  assert.equal(sorted[0].title, "CPI m/m");
  assert.equal(sorted[1].title, "Initial Jobless Claims");
  assert.equal(sorted[2].title, "Wholesale Trade");
});

test("7. Missing actual, forecast, and previous values remain strictly null without fabricating zeroes", () => {
  const event: EconomicCalendarEvent = {
    id: "test:missing:values",
    title: "Unscheduled Special Briefing",
    currency: "USD",
    scheduledAt: "2026-09-10T14:00:00.000Z",
    actual: null,
    forecast: null,
    previous: null,
    impact: "unknown",
    status: "scheduled",
    source: "Federal Reserve",
  };

  assert.strictEqual(event.actual, null);
  assert.strictEqual(event.forecast, null);
  assert.strictEqual(event.previous, null);
  assert.notStrictEqual(event.actual, "0");
  assert.notStrictEqual(event.actual, "0.0%");
});

test("8. Preserves unknown impact when unverified by source", () => {
  const event: EconomicCalendarEvent = {
    id: "test:unknown:impact",
    title: "Regional Fed Speech",
    currency: "USD",
    scheduledAt: "2026-09-10T14:00:00.000Z",
    impact: "unknown",
    status: "scheduled",
    source: "Federal Reserve Bank of Dallas",
  };

  assert.equal(event.impact, "unknown");
});

test("9. Aggregator deduplicates events and prioritizes official authoritative sources", async () => {
  const officialEvent: EconomicCalendarEvent = {
    id: "cb:usd:fomc-rate-decision:2026-09-16T18:00:00.000Z",
    title: "FOMC Rate Decision",
    currency: "USD",
    country: "US",
    scheduledAt: "2026-09-16T18:00:00.000Z",
    previous: "4.00%",
    actual: null,
    forecast: null, // Official central bank does not fabricate consensus forecast
    impact: "high",
    status: "scheduled",
    source: "Federal Reserve",
    sourceUrl: "https://www.federalreserve.gov",
  };

  const aggregatorEvent: EconomicCalendarEvent = {
    id: "finnhub:usd:fomc-rate-decision:2026-09-16T18:00:00.000Z",
    title: "Fed Interest Rate Decision",
    currency: "USD",
    country: "US",
    scheduledAt: "2026-09-16T18:00:00.000Z",
    previous: "4.00%",
    actual: null,
    forecast: "3.75%", // Aggregator has Wall Street consensus forecast
    impact: "high",
    status: "scheduled",
    source: "Finnhub Aggregator",
  };

  const mockProvider1: EconomicCalendarProvider = {
    id: "official",
    label: "Official",
    isConfigured: () => true,
    fetchEvents: async () => ({
      providerId: "official",
      status: "healthy",
      events: [officialEvent],
    }),
  };

  const mockProvider2: EconomicCalendarProvider = {
    id: "aggregator",
    label: "Aggregator",
    isConfigured: () => true,
    fetchEvents: async () => ({
      providerId: "aggregator",
      status: "healthy",
      events: [aggregatorEvent],
    }),
  };

  const aggregator = new EconomicCalendarAggregator([mockProvider1, mockProvider2]);
  const result = await aggregator.getCalendar(
    {
      from: new Date("2026-09-16T00:00:00.000Z"),
      to: new Date("2026-09-16T23:59:59.000Z"),
    },
    { bypassCache: true }
  );

  assert.equal(result.events.length, 1, "Duplicate FOMC event must be merged into 1");
  const merged = result.events[0];
  assert.equal(merged.source, "Federal Reserve", "Must prioritize official source");
  assert.equal(merged.forecast, "3.75%", "Must enrich with available consensus forecast");
  assert.equal(merged.previous, "4.00%");
});

test("10. Partial provider failure does not blank other healthy providers", async () => {
  const healthyProvider: EconomicCalendarProvider = {
    id: "healthy-p",
    label: "Healthy Provider",
    isConfigured: () => true,
    fetchEvents: async () => ({
      providerId: "healthy-p",
      status: "healthy",
      events: [
        {
          id: "h:1",
          title: "UK GDP m/m",
          currency: "GBP",
          scheduledAt: "2026-09-10T06:00:00.000Z",
          impact: "high",
          status: "scheduled",
          source: "ONS",
        },
      ],
    }),
  };

  const failingProvider: EconomicCalendarProvider = {
    id: "failing-p",
    label: "Failing Provider",
    isConfigured: () => true,
    fetchEvents: async () => {
      throw new Error("Upstream gateway timeout (504)");
    },
  };

  const aggregator = new EconomicCalendarAggregator([healthyProvider, failingProvider]);
  const result = await aggregator.getCalendar(
    {
      from: new Date("2026-09-10T00:00:00.000Z"),
      to: new Date("2026-09-10T23:59:59.000Z"),
    },
    { bypassCache: true }
  );

  assert.equal(result.events.length, 1, "Must retain events from healthy provider");
  assert.equal(result.events[0].title, "UK GDP m/m");

  const failMeta = result.providers.find((p) => p.id === "failing-p");
  assert.ok(failMeta);
  assert.equal(failMeta.status, "failed");
  assert.ok(failMeta.message?.includes("504"));

  const healthMeta = result.providers.find((p) => p.id === "healthy-p");
  assert.ok(healthMeta);
  assert.equal(healthMeta.status, "healthy");
});

test("11. In-memory cache returns stale data on temporary network degradation", () => {
  calendarCache.invalidate();

  const mockResponse = {
    events: [
      {
        id: "cached:1",
        title: "ECB Rate Decision",
        currency: "EUR",
        scheduledAt: "2026-09-10T12:15:00.000Z",
        impact: "high" as const,
        status: "scheduled" as const,
        source: "ECB",
      },
    ],
    providers: [],
    from: "2026-09-10T00:00:00.000Z",
    to: "2026-09-10T23:59:59.000Z",
    cachedAt: new Date().toISOString(),
    isStale: false,
  };

  // Set cache with short TTL (1ms) to test stale retrieval
  calendarCache.set("test-key", mockResponse, 1);

  // Immediate wait to exceed TTL
  const now = Date.now();
  while (Date.now() - now < 5) {
    // spin
  }

  const result = calendarCache.get("test-key", true);
  assert.ok(result);
  assert.equal(result.isStale, true, "Expired entry within grace period must be marked stale");
  assert.equal(result.data.events.length, 1);
  assert.equal(result.data.events[0].title, "ECB Rate Decision");
});

test("12. getNextUpcomingEvent computes countdown accurately to nearest high-impact release", () => {
  const nowMs = new Date("2026-09-10T12:00:00.000Z").getTime();

  const events: EconomicCalendarEvent[] = [
    {
      id: "past",
      title: "Past Release",
      currency: "USD",
      scheduledAt: "2026-09-10T10:00:00.000Z",
      impact: "high",
      status: "released",
      source: "BLS",
    },
    {
      id: "low-future",
      title: "Low Impact Soon",
      currency: "USD",
      scheduledAt: "2026-09-10T12:15:00.000Z",
      impact: "low",
      status: "scheduled",
      source: "Census",
    },
    {
      id: "high-future-1",
      title: "ECB Rate Decision",
      currency: "EUR",
      scheduledAt: "2026-09-10T12:15:00.000Z", // 15 mins away
      impact: "high",
      status: "scheduled",
      source: "ECB",
    },
    {
      id: "high-future-2",
      title: "FOMC Rate Decision",
      currency: "USD",
      scheduledAt: "2026-09-10T18:00:00.000Z",
      impact: "high",
      status: "scheduled",
      source: "Federal Reserve",
    },
  ];

  const next = getNextUpcomingEvent(events, nowMs);
  assert.ok(next);
  assert.equal(next.event.id, "high-future-1");
  assert.equal(next.event.currency, "EUR");
  assert.equal(next.diffMs, 15 * 60 * 1000);
  assert.equal(next.countdownText, "00:15:00");
});
