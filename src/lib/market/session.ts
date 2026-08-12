/**
 * SessionEngine — centralized session/timezone logic.
 *
 * Internally everything is UTC. Market sessions are expressed in
 * America/New_York (ET) for equity and CME ETH. Session calculations
 * are NOT scattered through the app — they live here.
 *
 * Note: this implements the US session calendar simply (no holiday
 * calendar) and is sufficient for the SIMULATED environment. Production
 * would integrate the exchange holiday calendar.
 */
import { TIMEFRAME_SECONDS, type Timeframe } from "./types";

export const ET_OFFSET_MIN = -5 * 60; // EST; DST handling simplified (see note)

/** Convert a UTC epoch-ms to "minutes since midnight ET" (approx, EST-based). */
export function minutesSinceMidnightET(utcMs: number): number {
  const d = new Date(utcMs);
  // shift to ET (EST; production uses full tz db). Subtract 5h.
  const et = new Date(d.getTime() + ET_OFFSET_MIN * 60_000);
  return et.getUTCHours() * 60 + et.getUTCMinutes();
}

export function dayOfWeekET(utcMs: number): number {
  const et = new Date(utcMs + ET_OFFSET_MIN * 60_000);
  return et.getUTCDay(); // 0=Sun
}

export interface SessionWindow {
  label: "overnight" | "pre" | "rth" | "post" | "closed";
  isRTH: boolean;
}

/** Classify a UTC timestamp against CME ETH + equity RTH windows. */
export function classifySession(symbolSession: "cme" | "equity", utcMs: number): SessionWindow {
  const m = minutesSinceMidnightET(utcMs);
  const dow = dayOfWeekET(utcMs);
  if (symbolSession === "equity") {
    // 04:00–09:30 pre, 09:30–16:00 RTH, 16:00–20:00 post
    if (dow === 0 || dow === 6) return { label: "closed", isRTH: false };
    if (m >= 240 && m < 570) return { label: "pre", isRTH: false };
    if (m >= 570 && m < 960) return { label: "rth", isRTH: true };
    if (m >= 960 && m < 1200) return { label: "post", isRTH: false };
    return { label: "closed", isRTH: false };
  }
  // CME ETH: 18:00 prev day → 17:00, with daily halt 16:00-17:00
  if (dow === 6) return { label: "closed", isRTH: false };
  if (m >= 960 && m < 1020) return { label: "closed", isRTH: false }; // maintenance
  // RTH 09:30–16:00
  if (m >= 570 && m < 960) return { label: "rth", isRTH: true };
  if (m >= 1080 || m < 570) return { label: "overnight", isRTH: false };
  return { label: "overnight", isRTH: false };
}

/** Intraday volatility profile (U-shape): higher at open/close, lower midday. */
export function sessionVolMultiplier(utcMs: number): number {
  const m = minutesSinceMidnightET(utcMs);
  // peak at 09:30 (570) and 16:00 (960), trough ~12:30 (750)
  if (m < 570 || m > 960) return 0.55; // overnight lower
  const t = (m - 570) / (960 - 570); // 0..1 across RTH
  const u = 4 * t * (1 - t); // parabola peaking 1.0 at t=0.5 -> invert
  return 0.7 + 0.6 * (1 - u); // ~0.7 midday .. ~1.3 open/close
}

/** Align a timestamp down to the start of a timeframe bucket (UTC). */
export function alignToTimeframe(utcMs: number, tf: Timeframe): number {
  const sec = TIMEFRAME_SECONDS[tf];
  const bucket = Math.floor(utcMs / 1000 / sec) * sec * 1000;
  return bucket;
}

export function formatClockET(utcMs: number): string {
  const et = new Date(utcMs + ET_OFFSET_MIN * 60_000);
  return et.toISOString().slice(11, 19) + " ET";
}
export function formatClockUTC(utcMs: number): string {
  return new Date(utcMs).toISOString().slice(11, 19) + " UTC";
}
