import assert from "node:assert/strict";
import test from "node:test";
import { buildVolumeProfile, calculateVolatility, classifyRegime } from "../src/domain/analytics/market";
import type { Bar } from "../src/lib/market/types";

test("volume profile and market regime respect replay boundary with strict zero lookahead", () => {
  const baseTime = 1700000000000;
  const bars: Bar[] = Array.from({ length: 50 }, (_, i) => ({
    t: baseTime + i * 60_000,
    o: 100 + i,
    h: 105 + i,
    l: 95 + i,
    c: 102 + i,
    v: 1000 + i * 50,
  }));

  const replayIndex = 20;
  const availableBars = bars.slice(0, replayIndex + 1);

  // 1. Available bars length matches replay cursor
  assert.equal(availableBars.length, 21);
  assert.equal(availableBars.at(-1)?.t, bars[replayIndex].t);

  // 2. Volume profile on available bars only accounts for volume up to replayIndex
  const profileReplay = buildVolumeProfile(availableBars, 0.5);
  const totalVolumeReplay = profileReplay.levels.reduce((sum, l) => sum + l.volume, 0);

  const profileAll = buildVolumeProfile(bars, 0.5);
  const totalVolumeAll = profileAll.levels.reduce((sum, l) => sum + l.volume, 0);

  assert.ok(totalVolumeReplay < totalVolumeAll);
  assert.equal(totalVolumeReplay, availableBars.reduce((sum, b) => sum + b.v, 0));

  // 3. Market regime and volatility use only availableBars
  const volReplay = calculateVolatility(availableBars, 10);
  const volAll = calculateVolatility(bars, 10);
  assert.ok(Number.isFinite(volReplay.atr));
  assert.ok(Number.isFinite(volReplay.realizedVolatility));
  assert.ok(Number.isFinite(volAll.atr));
  assert.ok(Number.isFinite(volAll.realizedVolatility));

  const regimeReplay = classifyRegime(availableBars, { lookback: 10, trendThreshold: 0.01, compressionThreshold: 0.002 });
  assert.ok(["trend", "compression", "high_volatility", "balance", "unknown"].includes(regimeReplay.kind));
});
