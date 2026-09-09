import type { ChartTimezone } from "@/stores/workspace";
import type { EconomicCalendarEvent } from "./types";

/**
 * Returns formatted time string (e.g. "08:30" or "14:15") for a UTC ISO string
 * evaluated in the specified target timezone.
 */
export function formatEventTime(isoUtc: string, timezone: ChartTimezone): string {
  try {
    const date = new Date(isoUtc);
    if (Number.isNaN(date.getTime())) return "--:--";
    return new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: timezone,
    }).format(date);
  } catch {
    return "--:--";
  }
}

/**
 * Returns the local calendar day key `YYYY-MM-DD` for a given UTC timestamp
 * evaluated in the target timezone.
 *
 * Example: A release at `2026-09-10T01:30:00Z` returns `2026-09-09` in `America/New_York`
 * (EDT is UTC-4, so 21:30 on Sep 9), but `2026-09-10` in `UTC` and `Asia/Dubai`.
 */
export function getLocalDateKey(isoUtc: string, timezone: ChartTimezone): string {
  try {
    const date = new Date(isoUtc);
    if (Number.isNaN(date.getTime())) return "unknown-date";
    // Format year, month, day in target timezone
    const parts = new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: timezone,
    }).formatToParts(date);
    const year = parts.find((p) => p.type === "year")?.value ?? "1970";
    const month = parts.find((p) => p.type === "month")?.value ?? "01";
    const day = parts.find((p) => p.type === "day")?.value ?? "01";
    return `${year}-${month}-${day}`;
  } catch {
    return "unknown-date";
  }
}

/**
 * Formats a local date key `YYYY-MM-DD` into an authoritative terminal date header
 * (e.g. "TODAY · WED, SEP 9", "TOMORROW · THU, SEP 10", "FRI, SEP 11").
 */
export function formatDateGroupHeader(dateKey: string, timezone: ChartTimezone, nowMs: number = Date.now()): string {
  if (dateKey === "unknown-date") return "UNKNOWN DATE";
  try {
    const todayKey = getLocalDateKey(new Date(nowMs).toISOString(), timezone);
    const tomorrowDate = new Date(nowMs + 86_400_000);
    const tomorrowKey = getLocalDateKey(tomorrowDate.toISOString(), timezone);
    const yesterdayDate = new Date(nowMs - 86_400_000);
    const yesterdayKey = getLocalDateKey(yesterdayDate.toISOString(), timezone);

    // Parse the dateKey into year, month, day
    const [y, m, d] = dateKey.split("-").map(Number);
    // Construct local midnight representation
    const sampleDate = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));

    const dayName = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" }).format(sampleDate).toUpperCase();
    const monthName = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" }).format(sampleDate).toUpperCase();

    if (dateKey === todayKey) {
      return `TODAY · ${dayName}, ${monthName} ${d}`;
    }
    if (dateKey === tomorrowKey) {
      return `TOMORROW · ${dayName}, ${monthName} ${d}`;
    }
    if (dateKey === yesterdayKey) {
      return `YESTERDAY · ${dayName}, ${monthName} ${d}`;
    }
    return `${dayName}, ${monthName} ${d}`;
  } catch {
    return dateKey;
  }
}

export interface DateGroupedEvents {
  dateKey: string;
  header: string;
  events: EconomicCalendarEvent[];
}

/**
 * Groups events by their local date in the requested timezone and sorts them ascending.
 */
export function groupEventsByLocalDate(
  events: EconomicCalendarEvent[],
  timezone: ChartTimezone,
  nowMs: number = Date.now()
): DateGroupedEvents[] {
  const groups = new Map<string, EconomicCalendarEvent[]>();

  for (const event of events) {
    const key = getLocalDateKey(event.scheduledAt, timezone);
    const existing = groups.get(key);
    if (existing) {
      existing.push(event);
    } else {
      groups.set(key, [event]);
    }
  }

  // Sort groups by dateKey ascending
  const sortedKeys = Array.from(groups.keys()).sort();

  return sortedKeys.map((key) => {
    const groupEvents = groups.get(key)!;
    // Sort events within the day by scheduledAt UTC ascending, then title
    groupEvents.sort((a, b) => {
      const diff = new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime();
      if (diff !== 0) return diff;
      return a.title.localeCompare(b.title);
    });
    return {
      dateKey: key,
      header: formatDateGroupHeader(key, timezone, nowMs),
      events: groupEvents,
    };
  });
}

/**
 * Finds the nearest upcoming high-impact event (if any) and returns countdown metadata.
 */
export function getNextUpcomingEvent(
  events: EconomicCalendarEvent[],
  nowMs: number = Date.now()
): { event: EconomicCalendarEvent; diffMs: number; countdownText: string } | null {
  const futureHighImpact = events
    .filter((e) => e.impact === "high" && new Date(e.scheduledAt).getTime() > nowMs)
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());

  if (futureHighImpact.length === 0) return null;

  const next = futureHighImpact[0];
  const diffMs = Math.max(0, new Date(next.scheduledAt).getTime() - nowMs);

  const hours = Math.floor(diffMs / 3_600_000);
  const minutes = Math.floor((diffMs % 3_600_000) / 60_000);
  const seconds = Math.floor((diffMs % 60_000) / 1000);

  const pad = (n: number) => String(n).padStart(2, "0");
  const countdownText = hours > 99
    ? `${Math.floor(hours / 24)}d ${hours % 24}h`
    : `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;

  return { event: next, diffMs, countdownText };
}

export type DateFilterPreset = "today" | "tomorrow" | "this-week" | "next-week" | "all";

/**
 * Computes UTC `from` and `to` ISO strings for a given preset in the user's timezone.
 */
export function getPresetDateRange(
  preset: DateFilterPreset,
  timezone: ChartTimezone,
  now: Date = new Date()
): { from: string; to: string } {
  // Use date string in timezone to establish current local date
  const localTodayStr = getLocalDateKey(now.toISOString(), timezone);
  const [year, month, day] = localTodayStr.split("-").map(Number);

  // Local start of today (00:00:00) in timezone approximation
  const localToday = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));

  switch (preset) {
    case "today": {
      const from = new Date(localToday.getTime() - 24 * 3600 * 1000);
      const to = new Date(localToday.getTime() + 2 * 24 * 3600 * 1000);
      return { from: from.toISOString(), to: to.toISOString() };
    }
    case "tomorrow": {
      const from = new Date(localToday.getTime());
      const to = new Date(localToday.getTime() + 3 * 24 * 3600 * 1000);
      return { from: from.toISOString(), to: to.toISOString() };
    }
    case "this-week": {
      // Find Monday of current week
      const dayOfWeek = (localToday.getUTCDay() + 6) % 7; // 0 for Mon, 6 for Sun
      const monday = new Date(localToday.getTime() - dayOfWeek * 86_400_000 - 86_400_000);
      const sundayEnd = new Date(monday.getTime() + 9 * 86_400_000);
      return { from: monday.toISOString(), to: sundayEnd.toISOString() };
    }
    case "next-week": {
      const dayOfWeek = (localToday.getUTCDay() + 6) % 7;
      const nextMonday = new Date(localToday.getTime() + (7 - dayOfWeek) * 86_400_000 - 86_400_000);
      const nextSundayEnd = new Date(nextMonday.getTime() + 9 * 86_400_000);
      return { from: nextMonday.toISOString(), to: nextSundayEnd.toISOString() };
    }
    case "all":
    default: {
      const from = new Date(localToday.getTime() - 7 * 86_400_000);
      const to = new Date(localToday.getTime() + 21 * 86_400_000);
      return { from: from.toISOString(), to: to.toISOString() };
    }
  }
}
