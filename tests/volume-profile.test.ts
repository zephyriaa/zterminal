import assert from "node:assert/strict";
import test from "node:test";
import {
  computeFixedRangeVolumeProfile,
  computeSessionVolumeProfile,
  roundToTick,
} from "../src/lib/market/volume-profile";
import type { Bar } from "../src/lib/market/types";

function mockBar(t: number, o: number, h: number, l: number, c: number, v: number): Bar {
  return { t, o, h, l, c, v };
}

test("roundToTick correctly snaps floating prices to precise tick steps", () => {
  assert.equal(roundToTick(100.24, 0.25), 100.25);
  assert.equal(roundToTick(100.12, 0.25), 100);
  assert.equal(roundToTick(50000.35, 0.5), 50000.5);
  assert.equal(roundToTick(10.5, 0), 10.5);
});

test("computes Fixed Range Volume Profile and identifies POC within value area", () => {
  const bars: Bar[] = [
    mockBar(1_000, 100, 105, 95, 102, 1000),
    mockBar(2_000, 102, 108, 100, 105, 2000),
    mockBar(3_000, 105, 106, 104, 105, 5000), // Heavy consolidation around 105
    mockBar(4_000, 105, 110, 103, 108, 1500),
  ];

  const profile = computeFixedRangeVolumeProfile(bars, 0, bars.length - 1, 1.0, 0.70);

  assert.ok(profile.totalVolume > 0, "total volume should be > 0");
  assert.ok(profile.poc >= 104 && profile.poc <= 106, `expected POC around 105, got ${profile.poc}`);
  assert.ok(profile.vah >= profile.poc, "VAH must be >= POC");
  assert.ok(profile.val <= profile.poc, "VAL must be <= POC");
  assert.ok(profile.valueAreaVolume >= profile.totalVolume * 0.65, "Value area volume should contain ~70% of volume");
  assert.ok(profile.levels.length > 0, "profile must have price levels");
  assert.equal(profile.developing.length, bars.length, "should have developing POC for each bar");
});

test("computes Session Volume Profiles and correctly identifies Naked POCs", () => {
  const session1: Bar[] = [
    mockBar(0, 100, 105, 95, 100, 1000),
    mockBar(3600_000, 100, 100, 100, 100, 5000), // Heavy concentrated volume strictly at 100
  ];
  const session2: Bar[] = [
    // Gaps up into 150-160 range and never visits 100
    mockBar(86_400_000, 150, 160, 148, 155, 2000),
    mockBar(86_400_000 + 3600_000, 155, 158, 152, 156, 3000),
  ];

  const result = computeSessionVolumeProfile([...session1, ...session2], 1.0, 86_400_000, 0.70);

  assert.equal(result.sessions.length, 2, "should create 2 daily sessions");
  assert.equal(result.nakedPocs.length, 1, "session 1 POC should be marked as naked POC");
  assert.equal(result.nakedPocs[0].poc, 100);
});
