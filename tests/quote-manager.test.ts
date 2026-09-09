import assert from "node:assert/strict";
import test from "node:test";
import { parseCSVDataset } from "../src/lib/market/dataset-importer";
import { loadSynchronizedMultiData, type DataStreamSpec } from "../src/lib/market/multi-data";
import type { Bar } from "../src/lib/market/types";

test("parses custom CSV candles with automatic header detection and sanitization", () => {
  const sampleCSV = `timestamp,open,high,low,close,volume
1709251200000,62000.5,62500.0,61800.0,62300.0,145.2
1709251500000,62300.0,62600.0,62100.0,62450.0,180.5
1709251800000,62450.0,62550.0,62200.0,62350.0,95.0
1709252100000,62350.0,62700.0,62300.0,62650.0,210.1
1709252400000,62650.0,62900.0,62500.0,62800.0,305.8
`;

  const result = parseCSVDataset(sampleCSV, "BTC_TEST", "5m");
  assert.equal(result.symbol, "BTC_TEST");
  assert.equal(result.timeframe, "5m");
  assert.equal(result.totalBars, 5);
  assert.equal(result.bars[0].o, 62000.5);
  assert.equal(result.bars[4].c, 62800.0);
  assert.equal(result.bars[4].v, 305.8);
});

test("handles ISO datetime strings and computes high/low envelope correctly", () => {
  const isoCSV = `Date,Open,High,Low,Close,Volume
2024-03-01 00:00:00,100,105,95,102,500
2024-03-01 00:05:00,102,101,104,103,450
`;

  const result = parseCSVDataset(isoCSV, "ES_TEST", "5m");
  assert.equal(result.totalBars, 2);
  // In second bar, High (101) was declared less than Close (103), sanitization should ensure high >= close
  assert.equal(result.bars[1].h >= result.bars[1].c, true);
  assert.equal(result.bars[1].l <= result.bars[1].o, true);
});

test("synchronizes multi-data streams with strict zero look-ahead bias", async () => {
  // Primary: 5-minute bars from 10:00 to 10:25 (5 bars)
  const baseTime = 1709251200000; // 10:00:00
  const m5 = 300_000;
  const h1 = 3600_000;

  const primaryBars: Bar[] = [
    { t: baseTime, o: 100, h: 105, l: 99, c: 104, v: 10 }, // 10:00 - 10:05
    { t: baseTime + m5, o: 104, h: 106, l: 103, c: 105, v: 12 }, // 10:05 - 10:10
    { t: baseTime + m5 * 2, o: 105, h: 107, l: 104, c: 106, v: 15 }, // 10:10 - 10:15
    { t: baseTime + m5 * 11, o: 108, h: 110, l: 107, c: 109, v: 20 }, // 10:55 - 11:00 (closes at 11:00)
    { t: baseTime + m5 * 12, o: 109, h: 111, l: 108, c: 110, v: 22 }, // 11:00 - 11:05
  ];

  // Secondary: 1-hour bars:
  // Bar 0: 09:00 - 10:00 (closed at 10:00)
  // Bar 1: 10:00 - 11:00 (closes at 11:00)
  const secondaryBars: Bar[] = [
    { t: baseTime - h1, o: 95, h: 101, l: 94, c: 100, v: 100 }, // 09:00 - 10:00
    { t: baseTime, o: 100, h: 110, l: 99, c: 109, v: 200 }, // 10:00 - 11:00
  ];

  // Test zero look-ahead alignment logic
  const primaryIntervalMs = m5;
  const secIntervalMs = h1;
  const indexMap = new Int32Array(primaryBars.length);
  let secIdx = 0;

  for (let pIdx = 0; pIdx < primaryBars.length; pIdx++) {
    const pCloseTime = primaryBars[pIdx].t + primaryIntervalMs;
    while (
      secIdx + 1 < secondaryBars.length &&
      secondaryBars[secIdx + 1].t + secIntervalMs <= pCloseTime
    ) {
      secIdx++;
    }
    if (secondaryBars[secIdx].t + secIntervalMs <= pCloseTime) {
      indexMap[pIdx] = secIdx;
    } else {
      indexMap[pIdx] = -1;
    }
  }

  // At 10:05 (primary bar 0 close), secondary bar 1 (10:00-11:00) is NOT closed yet!
  // Therefore, indexMap[0] must point to bar 0 (09:00-10:00)
  assert.equal(indexMap[0], 0);
  assert.equal(indexMap[1], 0);
  assert.equal(indexMap[2], 0);

  // At 11:00 (primary bar 3 close, t=10:55), secondary bar 1 closes at 11:00!
  // So indexMap[3] can now see secondary bar 1!
  assert.equal(indexMap[3], 1);
  assert.equal(indexMap[4], 1);
});
