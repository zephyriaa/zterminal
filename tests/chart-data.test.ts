import assert from "node:assert/strict";
import test from "node:test";
import { normalizeChartBars } from "../src/lib/market/chart-data";

test("normalizes chart bars by timestamp and ignores malformed rows", () => {
  const bars = normalizeChartBars([
    { t: 200, o: 2, h: 4, l: 1, c: 3, v: 20 },
    { t: 100, o: 1, h: 3, l: 0, c: 2, v: 10 },
    { t: 200, o: 2, h: 5, l: 1, c: 4, v: 25 },
    { t: 300, o: 3, h: 4, l: 3, c: Number.NaN, v: 5 },
  ]);
  assert.deepEqual(bars, [
    { t: 100, o: 1, h: 3, l: 0, c: 2, v: 10 },
    { t: 200, o: 2, h: 5, l: 1, c: 4, v: 25 },
  ]);
});

test("returns an empty list for an empty historical response", () => {
  assert.deepEqual(normalizeChartBars([]), []);
});

test("rejects a malformed historical response shape", () => {
  assert.throws(() => normalizeChartBars({ bars: [] }), /invalid historical data/);
});
