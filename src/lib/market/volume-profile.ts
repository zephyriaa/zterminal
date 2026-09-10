import type { Bar } from "./types";

export interface VolumeProfileLevel {
  price: number;
  volume: number;
  buyVolume: number;
  sellVolume: number;
  delta: number;
}

export interface DevelopingProfilePoint {
  timestamp: number;
  poc: number;
  vah: number;
  val: number;
  accumulatedVolume: number;
}

export interface VolumeProfileResult {
  poc: number;
  vah: number;
  val: number;
  totalVolume: number;
  valueAreaVolume: number;
  levels: VolumeProfileLevel[];
  developing: DevelopingProfilePoint[];
}

export interface NakedPoc {
  sessionTimestamp: number;
  poc: number;
  untestedVolume: number;
}

/**
 * Rounds a price to the nearest tick increment.
 */
export function roundToTick(price: number, tickSize: number): number {
  if (tickSize <= 0) return price;
  const factor = Math.round(price / tickSize);
  return Number((factor * tickSize).toFixed(8));
}

/**
 * Computes the 70% Value Area (VAH and VAL) expanding outward symmetrically from the POC.
 */
export function calculateValueArea(
  sortedLevels: VolumeProfileLevel[],
  pocIndex: number,
  targetVolume: number,
): { vah: number; val: number; valueAreaVolume: number } {
  if (sortedLevels.length === 0) {
    return { vah: 0, val: 0, valueAreaVolume: 0 };
  }
  if (sortedLevels.length === 1) {
    const single = sortedLevels[0];
    return { vah: single.price, val: single.price, valueAreaVolume: single.volume };
  }

  let currentVolume = sortedLevels[pocIndex].volume;
  let upperIdx = pocIndex;
  let lowerIdx = pocIndex;

  while (currentVolume < targetVolume && (upperIdx < sortedLevels.length - 1 || lowerIdx > 0)) {
    const nextUpVolume =
      upperIdx < sortedLevels.length - 1 ? sortedLevels[upperIdx + 1].volume : -1;
    const nextDownVolume =
      lowerIdx > 0 ? sortedLevels[lowerIdx - 1].volume : -1;

    if (nextUpVolume >= nextDownVolume && upperIdx < sortedLevels.length - 1) {
      upperIdx += 1;
      currentVolume += sortedLevels[upperIdx].volume;
    } else if (lowerIdx > 0) {
      lowerIdx -= 1;
      currentVolume += sortedLevels[lowerIdx].volume;
    } else if (upperIdx < sortedLevels.length - 1) {
      upperIdx += 1;
      currentVolume += sortedLevels[upperIdx].volume;
    } else {
      break;
    }
  }

  return {
    vah: sortedLevels[upperIdx].price,
    val: sortedLevels[lowerIdx].price,
    valueAreaVolume: currentVolume,
  };
}

/**
 * Computes a Volume Profile for a given slice of historical bars.
 * Decomposes each bar's volume evenly across its High-Low price range.
 */
export function computeFixedRangeVolumeProfile(
  bars: Bar[],
  startIndex: number,
  endIndex: number,
  tickSize: number,
  valueAreaPct = 0.70,
): VolumeProfileResult {
  const safeStart = Math.max(0, Math.min(startIndex, bars.length - 1));
  const safeEnd = Math.max(safeStart, Math.min(endIndex, bars.length - 1));
  const slice = bars.slice(safeStart, safeEnd + 1);

  if (slice.length === 0) {
    return {
      poc: 0,
      vah: 0,
      val: 0,
      totalVolume: 0,
      valueAreaVolume: 0,
      levels: [],
      developing: [],
    };
  }

  const levelMap = new Map<number, { buyVolume: number; sellVolume: number }>();
  const developing: DevelopingProfilePoint[] = [];

  for (const bar of slice) {
    const isUpBar = bar.c >= bar.o;
    // Approximated aggressive split based on bar direction: 60/40 directional weight
    const buyFrac = isUpBar ? 0.6 : 0.4;
    const sellFrac = 1 - buyFrac;

    const minPrice = roundToTick(Math.min(bar.l, bar.h), tickSize);
    const maxPrice = roundToTick(Math.max(bar.l, bar.h), tickSize);
    const numTicks = Math.max(1, Math.round((maxPrice - minPrice) / tickSize) + 1);
    const volPerTick = bar.v / numTicks;

    for (let i = 0; i < numTicks; i++) {
      const price = Number((minPrice + i * tickSize).toFixed(8));
      const entry = levelMap.get(price) ?? { buyVolume: 0, sellVolume: 0 };
      entry.buyVolume += volPerTick * buyFrac;
      entry.sellVolume += volPerTick * sellFrac;
      levelMap.set(price, entry);
    }

    // Capture developing POC periodically
    let currentPoc = bar.c;
    let maxVol = 0;
    let accumVol = 0;
    for (const [p, v] of levelMap.entries()) {
      const tot = v.buyVolume + v.sellVolume;
      accumVol += tot;
      if (tot > maxVol) {
        maxVol = tot;
        currentPoc = p;
      }
    }
    developing.push({
      timestamp: bar.t,
      poc: currentPoc,
      vah: currentPoc,
      val: currentPoc,
      accumulatedVolume: accumVol,
    });
  }

  const sortedLevels: VolumeProfileLevel[] = Array.from(levelMap.entries())
    .map(([price, v]) => ({
      price,
      volume: v.buyVolume + v.sellVolume,
      buyVolume: v.buyVolume,
      sellVolume: v.sellVolume,
      delta: v.buyVolume - v.sellVolume,
    }))
    .sort((a, b) => a.price - b.price);

  let pocIndex = 0;
  let maxVolume = 0;
  let totalVolume = 0;

  for (let i = 0; i < sortedLevels.length; i++) {
    totalVolume += sortedLevels[i].volume;
    if (sortedLevels[i].volume > maxVolume) {
      maxVolume = sortedLevels[i].volume;
      pocIndex = i;
    }
  }

  const targetVolume = totalVolume * Math.min(0.99, Math.max(0.1, valueAreaPct));
  const { vah, val, valueAreaVolume } = calculateValueArea(
    sortedLevels,
    pocIndex,
    targetVolume,
  );

  return {
    poc: sortedLevels[pocIndex]?.price ?? 0,
    vah,
    val,
    totalVolume,
    valueAreaVolume,
    levels: sortedLevels,
    developing,
  };
}

/**
 * Computes Session Volume Profiles (e.g. daily/weekly) with Naked POC (nPoC) tracking.
 */
export function computeSessionVolumeProfile(
  bars: Bar[],
  tickSize: number,
  sessionIntervalMs = 86_400_000,
  valueAreaPct = 0.70,
): { sessions: (VolumeProfileResult & { sessionStart: number; sessionEnd: number })[]; nakedPocs: NakedPoc[] } {
  if (bars.length === 0) return { sessions: [], nakedPocs: [] };

  const sessions: (VolumeProfileResult & { sessionStart: number; sessionEnd: number })[] = [];
  let currentSessionBars: Bar[] = [];
  let currentSessionStart = Math.floor(bars[0].t / sessionIntervalMs) * sessionIntervalMs;

  for (const bar of bars) {
    const sessionBucket = Math.floor(bar.t / sessionIntervalMs) * sessionIntervalMs;
    if (sessionBucket !== currentSessionStart && currentSessionBars.length > 0) {
      const res = computeFixedRangeVolumeProfile(
        currentSessionBars,
        0,
        currentSessionBars.length - 1,
        tickSize,
        valueAreaPct,
      );
      sessions.push({
        ...res,
        sessionStart: currentSessionStart,
        sessionEnd: currentSessionBars[currentSessionBars.length - 1].t,
      });
      currentSessionBars = [];
      currentSessionStart = sessionBucket;
    }
    currentSessionBars.push(bar);
  }

  if (currentSessionBars.length > 0) {
    const res = computeFixedRangeVolumeProfile(
      currentSessionBars,
      0,
      currentSessionBars.length - 1,
      tickSize,
      valueAreaPct,
    );
    sessions.push({
      ...res,
      sessionStart: currentSessionStart,
      sessionEnd: currentSessionBars[currentSessionBars.length - 1].t,
    });
  }

  // Detect Naked POCs: POCs from prior sessions that were never touched by subsequent sessions' price range [low, high]
  const nakedPocs: NakedPoc[] = [];
  for (let s = 0; s < sessions.length - 1; s++) {
    const prior = sessions[s];
    let touched = false;
    for (let next = s + 1; next < sessions.length; next++) {
      const minP = sessions[next].levels[0]?.price ?? 0;
      const maxP = sessions[next].levels[sessions[next].levels.length - 1]?.price ?? 0;
      if (prior.poc >= minP && prior.poc <= maxP) {
        touched = true;
        break;
      }
    }
    if (!touched && prior.poc > 0) {
      nakedPocs.push({
        sessionTimestamp: prior.sessionStart,
        poc: prior.poc,
        untestedVolume: prior.totalVolume,
      });
    }
  }

  return { sessions, nakedPocs };
}
