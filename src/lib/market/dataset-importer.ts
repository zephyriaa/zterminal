"use client";

import type { Bar, Timeframe } from "./types";
import { cacheBars } from "./bar-cache";

export interface ParsedDatasetResult {
  symbol: string;
  timeframe: Timeframe;
  bars: Bar[];
  detectedTimeframe: string;
  earliestDate: string;
  latestDate: string;
  totalBars: number;
  warnings: string[];
}

/**
 * Parses raw CSV string content into normalized Bar objects.
 */
export function parseCSVDataset(
  csvContent: string,
  customSymbol: string,
  forcedTimeframe?: Timeframe
): ParsedDatasetResult {
  const lines = csvContent.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    throw new Error("CSV file is empty or missing data rows.");
  }

  // Parse Header
  const headerLine = lines[0].toLowerCase();
  const headers = headerLine.split(",").map((h) => h.trim().replace(/^["']|["']$/g, ""));

  const timeIdx = headers.findIndex((h) => ["time", "timestamp", "datetime", "date", "t"].includes(h));
  const openIdx = headers.findIndex((h) => ["open", "o"].includes(h));
  const highIdx = headers.findIndex((h) => ["high", "h"].includes(h));
  const lowIdx = headers.findIndex((h) => ["low", "l"].includes(h));
  const closeIdx = headers.findIndex((h) => ["close", "c"].includes(h));
  const volIdx = headers.findIndex((h) => ["volume", "vol", "v"].includes(h));

  if (timeIdx === -1 || openIdx === -1 || highIdx === -1 || lowIdx === -1 || closeIdx === -1) {
    throw new Error(
      `Invalid CSV format. Header must contain time, open, high, low, close columns. Found: ${headers.join(", ")}`
    );
  }

  const rawBars: Bar[] = [];
  const warnings: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const row = lines[i].split(",").map((col) => col.trim().replace(/^["']|["']$/g, ""));
    if (row.length < headers.length) continue;

    const rawTime = row[timeIdx];
    let timestamp = Number(rawTime);

    // If timestamp is not a number, attempt ISO date parsing
    if (!Number.isFinite(timestamp)) {
      const parsedDate = new Date(rawTime).getTime();
      if (Number.isFinite(parsedDate)) {
        timestamp = parsedDate;
      } else {
        continue; // Skip invalid date row
      }
    } else if (timestamp < 10_000_000_000) {
      // Unix seconds -> convert to ms
      timestamp *= 1_000;
    }

    const o = Number(row[openIdx]);
    const h = Number(row[highIdx]);
    const l = Number(row[lowIdx]);
    const c = Number(row[closeIdx]);
    const v = volIdx !== -1 ? Math.max(0, Number(row[volIdx]) || 0) : 0;

    if (![o, h, l, c].every(Number.isFinite)) continue;

    // Sanitize bar logic
    const sanitizedHigh = Math.max(h, o, c, l);
    const sanitizedLow = Math.min(l, o, c, h);

    rawBars.push({
      t: timestamp,
      o,
      h: sanitizedHigh,
      l: sanitizedLow,
      c,
      v,
    });
  }

  if (rawBars.length === 0) {
    throw new Error("No valid price bars could be parsed from the CSV file.");
  }

  // Sort ascending by timestamp
  rawBars.sort((a, b) => a.t - b.t);

  // Deduplicate timestamps (keep last)
  const uniqueBars: Bar[] = [];
  for (let i = 0; i < rawBars.length; i++) {
    if (i === 0 || rawBars[i].t !== rawBars[i - 1].t) {
      uniqueBars.push(rawBars[i]);
    } else {
      uniqueBars[uniqueBars.length - 1] = rawBars[i];
    }
  }

  // Auto-detect timeframe from median delta
  let detectedTf: Timeframe = forcedTimeframe ?? "5m";
  if (!forcedTimeframe && uniqueBars.length >= 5) {
    const deltas: number[] = [];
    for (let i = 1; i < Math.min(100, uniqueBars.length); i++) {
      deltas.push(uniqueBars[i].t - uniqueBars[i - 1].t);
    }
    deltas.sort((a, b) => a - b);
    const medianDeltaSeconds = Math.round(deltas[Math.floor(deltas.length / 2)] / 1_000);

    if (medianDeltaSeconds <= 65) detectedTf = "1m";
    else if (medianDeltaSeconds <= 350) detectedTf = "5m";
    else if (medianDeltaSeconds <= 1000) detectedTf = "15m";
    else if (medianDeltaSeconds <= 2000) detectedTf = "30m";
    else if (medianDeltaSeconds <= 4000) detectedTf = "1h";
    else if (medianDeltaSeconds <= 18000) detectedTf = "4h";
    else detectedTf = "1d";
  }

  const earliestDate = new Date(uniqueBars[0].t).toISOString().replace("T", " ").slice(0, 19);
  const latestDate = new Date(uniqueBars[uniqueBars.length - 1].t).toISOString().replace("T", " ").slice(0, 19);

  return {
    symbol: customSymbol.trim().toUpperCase(),
    timeframe: detectedTf,
    bars: uniqueBars,
    detectedTimeframe: detectedTf,
    earliestDate,
    latestDate,
    totalBars: uniqueBars.length,
    warnings,
  };
}

/**
 * Imports and persists a custom parsed dataset into IndexedDB.
 */
export async function importCustomDataset(
  csvContent: string,
  symbol: string,
  timeframe?: Timeframe
): Promise<ParsedDatasetResult> {
  const result = parseCSVDataset(csvContent, symbol, timeframe);
  await cacheBars(result.symbol, result.timeframe, result.bars, "custom_csv");
  return result;
}
