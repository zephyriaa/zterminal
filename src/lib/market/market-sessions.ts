/**
 * Z Terminal — Market Sessions Engine
 * 
 * Provides timezone-aware, DST-safe market session schedules and dynamic
 * event countdowns for New York, London, Tokyo, and CME Globex.
 *
 * Implements:
 * - Real IANA timezone calculations (America/New_York, Europe/London, Asia/Tokyo, America/Chicago)
 * - True Daylight Saving Time (DST) tracking via Intl
 * - Weekend and CME maintenance awareness
 * - Crypto vs exchange instrument semantics (Liquidity Sessions vs Exchange Sessions)
 */

import type { ChartTimezone } from "@/stores/workspace";

export interface MarketSessionInfo {
  id: "new_york" | "london" | "tokyo" | "cme";
  name: string;
  shortName: string;
  timeZone: string;
  isOpen: boolean;
  status: "open" | "closed" | "maintenance" | "weekend" | "pre" | "post";
  statusText: string;
  displayHours: string;
  startHourUtcFraction: number; // 0..24
  endHourUtcFraction: number;   // 0..24
  // Position across a normalized 24-hour day (in target timezone)
  timelineStartPct: number;    // 0..100
  timelineEndPct: number;      // 0..100
  crossesMidnight: boolean;
}

export interface NextSessionEvent {
  shortName: string;
  action: "opens" | "closes" | "maintenance" | "weekend" | "holiday";
  compactLabel: string;
  fullLabel: string;
  countdownMinutes: number;
}

export interface MarketSessionsSnapshot {
  sessions: MarketSessionInfo[];
  nextEvent: NextSessionEvent;
  currentClock: string;
  timezoneLabel: string;
  isCrypto: boolean;
  currentTimelinePct: number; // 0..100
}

/** Resolve user-friendly IANA timezone name */
export function resolveEffectiveTimezone(tz: ChartTimezone): string {
  if (tz === "local") {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    } catch {
      return "UTC";
    }
  }
  return tz;
}

export function formatTimezonePill(tz: ChartTimezone, nowMs: number = Date.now()): string {
  if (tz === "UTC") return "UTC";
  const effective = resolveEffectiveTimezone(tz);
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: effective,
      timeZoneName: "shortOffset",
    }).formatToParts(new Date(nowMs));
    const offsetPart = parts.find(p => p.type === "timeZoneName");
    if (offsetPart?.value) {
      // e.g. "GMT+4" or "UTC-5"
      return offsetPart.value.replace("GMT", "UTC");
    }
  } catch {
    // fallback
  }
  if (tz === "America/New_York") return "ET";
  if (tz === "Europe/London") return "LON";
  if (tz === "Asia/Tokyo") return "TYO";
  if (tz === "Asia/Dubai") return "DXB";
  return tz;
}

function getZonedParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    weekday: "short",
  });
  const parts = formatter.formatToParts(date);
  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;
  return {
    year: parseInt(map.year, 10),
    month: parseInt(map.month, 10),
    day: parseInt(map.day, 10),
    hour: parseInt(map.hour === "24" ? "0" : map.hour, 10),
    minute: parseInt(map.minute, 10),
    second: parseInt(map.second, 10),
    weekday: map.weekday || "Mon",
  };
}

/** Get exact UTC epoch ms for a target local time in a specific IANA timezone */
function zonedTimeToUtc(year: number, month: number, day: number, hour: number, minute: number, timeZone: string): number {
  let guess = Date.UTC(year, month - 1, day, hour, minute);
  for (let i = 0; i < 3; i++) {
    const zoned = getZonedParts(new Date(guess), timeZone);
    const zonedAsUtc = Date.UTC(zoned.year, zoned.month - 1, zoned.day, zoned.hour, zoned.minute);
    const diff = Date.UTC(year, month - 1, day, hour, minute) - zonedAsUtc;
    if (diff === 0) break;
    guess += diff;
  }
  return guess;
}

function formatMinutesDuration(totalMinutes: number): string {
  if (totalMinutes <= 0) return "now";
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h`;
  return `${mins}m`;
}

/**
 * Calculates current market session states, timelines, and next event countdown.
 */
export function calculateMarketSessions(
  nowMs: number = Date.now(),
  timezone: ChartTimezone = "America/New_York",
  isCrypto: boolean = true
): MarketSessionsSnapshot {
  const effectiveTz = resolveEffectiveTimezone(timezone);
  const targetZoned = getZonedParts(new Date(nowMs), effectiveTz);
  const currentMinutesInTargetDay = targetZoned.hour * 60 + targetZoned.minute;
  const currentTimelinePct = Math.min(100, Math.max(0, (currentMinutesInTargetDay / 1440) * 100));

  const pad = (n: number) => n.toString().padStart(2, "0");
  const currentClock = `${pad(targetZoned.hour)}:${pad(targetZoned.minute)} ${formatTimezonePill(timezone, nowMs)}`;

  // 1. LONDON (Europe/London: 08:00 - 16:30 local equity / 07:00 - 15:00 UTC core liquidity)
  const ldnZoned = getZonedParts(new Date(nowMs), "Europe/London");
  const isLdnWeekend = ldnZoned.weekday === "Sat" || ldnZoned.weekday === "Sun";
  const ldnOpenLocalMin = 8 * 60; // 08:00
  const ldnCloseLocalMin = 16 * 60 + 30; // 16:30
  const ldnCurrentLocalMin = ldnZoned.hour * 60 + ldnZoned.minute;

  const ldnOpenUtcMs = zonedTimeToUtc(ldnZoned.year, ldnZoned.month, ldnZoned.day, 8, 0, "Europe/London");
  const ldnCloseUtcMs = zonedTimeToUtc(ldnZoned.year, ldnZoned.month, ldnZoned.day, 16, 30, "Europe/London");

  const isLdnOpen = !isLdnWeekend && ldnCurrentLocalMin >= ldnOpenLocalMin && ldnCurrentLocalMin < ldnCloseLocalMin;

  // 2. NEW YORK (America/New_York: 09:30 - 16:00 local RTH)
  const nyZoned = getZonedParts(new Date(nowMs), "America/New_York");
  const isNyWeekend = nyZoned.weekday === "Sat" || nyZoned.weekday === "Sun";
  const nyOpenLocalMin = 9 * 60 + 30; // 09:30
  const nyCloseLocalMin = 16 * 60;    // 16:00
  const nyCurrentLocalMin = nyZoned.hour * 60 + nyZoned.minute;

  const nyOpenUtcMs = zonedTimeToUtc(nyZoned.year, nyZoned.month, nyZoned.day, 9, 30, "America/New_York");
  const nyCloseUtcMs = zonedTimeToUtc(nyZoned.year, nyZoned.month, nyZoned.day, 16, 0, "America/New_York");

  const isNyOpen = !isNyWeekend && nyCurrentLocalMin >= nyOpenLocalMin && nyCurrentLocalMin < nyCloseLocalMin;

  // 3. TOKYO (Asia/Tokyo: 09:00 - 15:00 JST)
  const tyoZoned = getZonedParts(new Date(nowMs), "Asia/Tokyo");
  const isTyoWeekend = tyoZoned.weekday === "Sat" || tyoZoned.weekday === "Sun";
  const tyoOpenLocalMin = 9 * 60;  // 09:00
  const tyoCloseLocalMin = 15 * 60; // 15:00
  const tyoCurrentLocalMin = tyoZoned.hour * 60 + tyoZoned.minute;

  const tyoOpenUtcMs = zonedTimeToUtc(tyoZoned.year, tyoZoned.month, tyoZoned.day, 9, 0, "Asia/Tokyo");
  const tyoCloseUtcMs = zonedTimeToUtc(tyoZoned.year, tyoZoned.month, tyoZoned.day, 15, 0, "Asia/Tokyo");

  const isTyoOpen = !isTyoWeekend && tyoCurrentLocalMin >= tyoOpenLocalMin && tyoCurrentLocalMin < tyoCloseLocalMin;

  // 4. CME GLOBEX (America/Chicago: Sunday 17:00 to Friday 16:00 CT; daily halt 16:00-17:00 CT)
  const cmeZoned = getZonedParts(new Date(nowMs), "America/Chicago");
  const cmeCurrentMin = cmeZoned.hour * 60 + cmeZoned.minute;
  const isCmeHalt = cmeCurrentMin >= 16 * 60 && cmeCurrentMin < 17 * 60;
  const isCmeWeekend =
    cmeZoned.weekday === "Sat" ||
    (cmeZoned.weekday === "Sun" && cmeCurrentMin < 17 * 60) ||
    (cmeZoned.weekday === "Fri" && cmeCurrentMin >= 16 * 60);

  const isCmeOpen = !isCmeWeekend && !isCmeHalt;

  // Helper to format start/end time formatted in user's selected timezone
  function formatHoursInTarget(startUtc: number, endUtc: number): { display: string; startPct: number; endPct: number; crosses: boolean } {
    const sZoned = getZonedParts(new Date(startUtc), effectiveTz);
    const eZoned = getZonedParts(new Date(endUtc), effectiveTz);
    const sMin = sZoned.hour * 60 + sZoned.minute;
    const eMin = eZoned.hour * 60 + eZoned.minute;

    const display = `${pad(sZoned.hour)}:${pad(sZoned.minute)} – ${pad(eZoned.hour)}:${pad(eZoned.minute)}`;
    const startPct = (sMin / 1440) * 100;
    const endPct = (eMin / 1440) * 100;
    return {
      display,
      startPct,
      endPct,
      crosses: eMin < sMin,
    };
  }

  const nyTimeline = formatHoursInTarget(nyOpenUtcMs, nyCloseUtcMs);
  const ldnTimeline = formatHoursInTarget(ldnOpenUtcMs, ldnCloseUtcMs);
  const tyoTimeline = formatHoursInTarget(tyoOpenUtcMs, tyoCloseUtcMs);
  // CME representative trading day: 17:00 CT prev to 16:00 CT
  const cmeOpenUtc = zonedTimeToUtc(cmeZoned.year, cmeZoned.month, cmeZoned.day - 1, 17, 0, "America/Chicago");
  const cmeCloseUtc = zonedTimeToUtc(cmeZoned.year, cmeZoned.month, cmeZoned.day, 16, 0, "America/Chicago");
  const cmeTimeline = formatHoursInTarget(cmeOpenUtc, cmeCloseUtc);

  const sessions: MarketSessionInfo[] = [
    {
      id: "new_york",
      name: "New York",
      shortName: "NY",
      timeZone: "America/New_York",
      isOpen: isNyOpen,
      status: isNyWeekend ? "weekend" : isNyOpen ? "open" : (nyCurrentLocalMin >= 4 * 60 && nyCurrentLocalMin < nyOpenLocalMin ? "pre" : "closed"),
      statusText: isNyWeekend ? "Weekend" : isNyOpen ? "Open" : "Closed",
      displayHours: nyTimeline.display,
      startHourUtcFraction: 13.5,
      endHourUtcFraction: 20,
      timelineStartPct: nyTimeline.startPct,
      timelineEndPct: nyTimeline.endPct,
      crossesMidnight: nyTimeline.crosses,
    },
    {
      id: "london",
      name: "London",
      shortName: "LDN",
      timeZone: "Europe/London",
      isOpen: isLdnOpen,
      status: isLdnWeekend ? "weekend" : isLdnOpen ? "open" : "closed",
      statusText: isLdnWeekend ? "Weekend" : isLdnOpen ? "Open" : "Closed",
      displayHours: ldnTimeline.display,
      startHourUtcFraction: 8,
      endHourUtcFraction: 16.5,
      timelineStartPct: ldnTimeline.startPct,
      timelineEndPct: ldnTimeline.endPct,
      crossesMidnight: ldnTimeline.crosses,
    },
    {
      id: "tokyo",
      name: "Tokyo",
      shortName: "TYO",
      timeZone: "Asia/Tokyo",
      isOpen: isTyoOpen,
      status: isTyoWeekend ? "weekend" : isTyoOpen ? "open" : "closed",
      statusText: isTyoWeekend ? "Weekend" : isTyoOpen ? "Open" : "Closed",
      displayHours: tyoTimeline.display,
      startHourUtcFraction: 0,
      endHourUtcFraction: 6,
      timelineStartPct: tyoTimeline.startPct,
      timelineEndPct: tyoTimeline.endPct,
      crossesMidnight: tyoTimeline.crosses,
    },
    {
      id: "cme",
      name: "CME Globex",
      shortName: "CME",
      timeZone: "America/Chicago",
      isOpen: isCmeOpen,
      status: isCmeWeekend ? "weekend" : isCmeHalt ? "maintenance" : isCmeOpen ? "open" : "closed",
      statusText: isCmeWeekend ? "Weekend" : isCmeHalt ? "Maintenance" : isCmeOpen ? "Open" : "Closed",
      displayHours: cmeTimeline.display,
      startHourUtcFraction: 22,
      endHourUtcFraction: 21,
      timelineStartPct: cmeTimeline.startPct,
      timelineEndPct: cmeTimeline.endPct,
      crossesMidnight: cmeTimeline.crosses,
    },
  ];

  // 5. NEXT MEANINGFUL EVENT CALCULATION
  type CandidateEvent = {
    shortName: string;
    action: "opens" | "closes" | "maintenance" | "weekend";
    eventUtcMs: number;
    descriptionPrefix: string;
  };

  const candidates: CandidateEvent[] = [];

  // London candidate
  if (isLdnWeekend) {
    const daysUntilMon = ldnZoned.weekday === "Sat" ? 2 : 1;
    const nextMonUtc = zonedTimeToUtc(ldnZoned.year, ldnZoned.month, ldnZoned.day + daysUntilMon, 8, 0, "Europe/London");
    candidates.push({ shortName: "LDN", action: "opens", eventUtcMs: nextMonUtc, descriptionPrefix: "London session begins" });
  } else if (isLdnOpen) {
    candidates.push({ shortName: "LDN", action: "closes", eventUtcMs: ldnCloseUtcMs, descriptionPrefix: "London session closes" });
  } else if (ldnCurrentLocalMin < ldnOpenLocalMin) {
    candidates.push({ shortName: "LDN", action: "opens", eventUtcMs: ldnOpenUtcMs, descriptionPrefix: "London session begins" });
  } else {
    const nextDay = ldnZoned.weekday === "Fri" ? 3 : 1;
    const nextLdnUtc = zonedTimeToUtc(ldnZoned.year, ldnZoned.month, ldnZoned.day + nextDay, 8, 0, "Europe/London");
    candidates.push({ shortName: "LDN", action: "opens", eventUtcMs: nextLdnUtc, descriptionPrefix: "London session begins" });
  }

  // NY candidate
  if (isNyWeekend) {
    const daysUntilMon = nyZoned.weekday === "Sat" ? 2 : 1;
    const nextMonUtc = zonedTimeToUtc(nyZoned.year, nyZoned.month, nyZoned.day + daysUntilMon, 9, 30, "America/New_York");
    candidates.push({ shortName: "NY", action: "opens", eventUtcMs: nextMonUtc, descriptionPrefix: "New York session begins" });
  } else if (isNyOpen) {
    candidates.push({ shortName: "NY", action: "closes", eventUtcMs: nyCloseUtcMs, descriptionPrefix: "New York session closes" });
  } else if (nyCurrentLocalMin < nyOpenLocalMin) {
    candidates.push({ shortName: "NY", action: "opens", eventUtcMs: nyOpenUtcMs, descriptionPrefix: "New York session begins" });
  } else {
    const nextDay = nyZoned.weekday === "Fri" ? 3 : 1;
    const nextNyUtc = zonedTimeToUtc(nyZoned.year, nyZoned.month, nyZoned.day + nextDay, 9, 30, "America/New_York");
    candidates.push({ shortName: "NY", action: "opens", eventUtcMs: nextNyUtc, descriptionPrefix: "New York session begins" });
  }

  // Tokyo candidate
  if (isTyoWeekend) {
    const daysUntilMon = tyoZoned.weekday === "Sat" ? 2 : 1;
    const nextMonUtc = zonedTimeToUtc(tyoZoned.year, tyoZoned.month, tyoZoned.day + daysUntilMon, 9, 0, "Asia/Tokyo");
    candidates.push({ shortName: "Tokyo", action: "opens", eventUtcMs: nextMonUtc, descriptionPrefix: "Tokyo session begins" });
  } else if (isTyoOpen) {
    candidates.push({ shortName: "Tokyo", action: "closes", eventUtcMs: tyoCloseUtcMs, descriptionPrefix: "Tokyo session closes" });
  } else if (tyoCurrentLocalMin < tyoOpenLocalMin) {
    candidates.push({ shortName: "Tokyo", action: "opens", eventUtcMs: tyoOpenUtcMs, descriptionPrefix: "Tokyo session begins" });
  } else {
    const nextDay = tyoZoned.weekday === "Fri" ? 3 : 1;
    const nextTyoUtc = zonedTimeToUtc(tyoZoned.year, tyoZoned.month, tyoZoned.day + nextDay, 9, 0, "Asia/Tokyo");
    candidates.push({ shortName: "Tokyo", action: "opens", eventUtcMs: nextTyoUtc, descriptionPrefix: "Tokyo session begins" });
  }

  // CME candidate
  if (isCmeHalt) {
    const haltEndUtc = zonedTimeToUtc(cmeZoned.year, cmeZoned.month, cmeZoned.day, 17, 0, "America/Chicago");
    candidates.push({ shortName: "CME", action: "opens", eventUtcMs: haltEndUtc, descriptionPrefix: "CME resumes" });
  }

  // Filter out past events, sort ascending by eventUtcMs
  const futureCandidates = candidates
    .filter(c => c.eventUtcMs > nowMs)
    .sort((a, b) => a.eventUtcMs - b.eventUtcMs);

  const closest = futureCandidates[0];

  let nextEvent: NextSessionEvent;
  if (!closest) {
    nextEvent = {
      shortName: "MKT",
      action: "weekend",
      compactLabel: "Weekend",
      fullLabel: "Markets closed for weekend",
      countdownMinutes: 0,
    };
  } else {
    const diffMs = Math.max(0, closest.eventUtcMs - nowMs);
    const countdownMinutes = Math.round(diffMs / 60_000);
    const durStr = formatMinutesDuration(countdownMinutes);
    const compactLabel = `${closest.shortName} ${closest.action} ${durStr}`;
    const fullLabel = `${closest.descriptionPrefix} in ${durStr}`;
    nextEvent = {
      shortName: closest.shortName,
      action: closest.action,
      compactLabel,
      fullLabel,
      countdownMinutes,
    };
  }

  return {
    sessions,
    nextEvent,
    currentClock,
    timezoneLabel: formatTimezonePill(timezone, nowMs),
    isCrypto,
    currentTimelinePct,
  };
}
