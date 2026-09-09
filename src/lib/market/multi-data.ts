"use client";

import type { Bar, Timeframe } from "./types";
import { TIMEFRAME_SECONDS } from "./types";
import { getOrFetchHistoricalBars } from "./cached-bars-provider";

export interface DataStreamSpec {
  id: string; // e.g., "data1", "data2"
  symbol: string;
  timeframe: Timeframe;
  role: "primary" | "secondary";
}

export interface SynchronizedMultiData {
  primary: {
    spec: DataStreamSpec;
    bars: Bar[];
  };
  secondaries: Map<
    string,
    {
      spec: DataStreamSpec;
      bars: Bar[];
      // indexMap[primaryIndex] = secondaryIndex (or -1 if none closed yet)
      indexMap: Int32Array;
    }
  >;
}

/**
 * Loads multiple data streams and synchronizes them with strict zero look-ahead bias.
 * For each primary bar at index `i`, maps it to the latest secondary bar that has
 * ALREADY CLOSED prior to or exactly at the close time of the primary bar.
 */
export async function loadSynchronizedMultiData(
  primarySpec: DataStreamSpec,
  secondarySpecs: DataStreamSpec[],
  fromMs: number,
  toMs: number,
  onProgress?: (msg: string) => void
): Promise<SynchronizedMultiData> {
  // 1. Fetch primary data
  onProgress?.(`Loading primary stream ${primarySpec.symbol} (${primarySpec.timeframe})...`);
  const primaryBars = await getOrFetchHistoricalBars(
    primarySpec.symbol,
    primarySpec.timeframe,
    fromMs,
    toMs,
    onProgress
  );

  const primaryIntervalMs = TIMEFRAME_SECONDS[primarySpec.timeframe] * 1_000;
  const secondaries = new Map<
    string,
    { spec: DataStreamSpec; bars: Bar[]; indexMap: Int32Array }
  >();

  // 2. Fetch each secondary stream
  for (const secSpec of secondarySpecs) {
    onProgress?.(`Loading secondary stream ${secSpec.symbol} (${secSpec.timeframe})...`);
    const secIntervalMs = TIMEFRAME_SECONDS[secSpec.timeframe] * 1_000;

    // We fetch a slightly wider lookback for secondaries to ensure pre-existing closed bars are available
    const secFromMs = fromMs - secIntervalMs * 2;
    const secBars = await getOrFetchHistoricalBars(
      secSpec.symbol,
      secSpec.timeframe,
      secFromMs,
      toMs,
      onProgress
    );

    // 3. Construct zero-look-ahead index mapping
    // Primary bar i closes at: primaryBars[i].t + primaryIntervalMs
    // Secondary bar j closes at: secBars[j].t + secIntervalMs
    // Condition: secBars[j].t + secIntervalMs <= primaryBars[i].t + primaryIntervalMs
    const indexMap = new Int32Array(primaryBars.length);
    let secIdx = 0;

    for (let pIdx = 0; pIdx < primaryBars.length; pIdx++) {
      const pCloseTime = primaryBars[pIdx].t + primaryIntervalMs;

      // Advance secIdx while the next secondary bar ALSO closed before or at pCloseTime
      while (
        secIdx + 1 < secBars.length &&
        secBars[secIdx + 1].t + secIntervalMs <= pCloseTime
      ) {
        secIdx++;
      }

      // Verify that secBars[secIdx] actually closed before or at pCloseTime
      if (secBars.length > 0 && secBars[secIdx].t + secIntervalMs <= pCloseTime) {
        indexMap[pIdx] = secIdx;
      } else {
        indexMap[pIdx] = -1; // No secondary bar has closed yet
      }
    }

    secondaries.set(secSpec.id, {
      spec: secSpec,
      bars: secBars,
      indexMap,
    });
  }

  return {
    primary: {
      spec: primarySpec,
      bars: primaryBars,
    },
    secondaries,
  };
}
