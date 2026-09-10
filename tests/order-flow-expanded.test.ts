import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateDiagonalImbalances,
  detectCVDDivergences,
  type CVDPoint,
  type FootprintLevel,
} from "../src/lib/market/order-flow";

test("detects regular bullish CVD divergence (price lower low, CVD higher low)", () => {
  const bars = [
    { t: 100, h: 105, l: 98, c: 100 },
    { t: 200, h: 104, l: 95, c: 96 },
    { t: 300, h: 103, l: 93, c: 95 },
    { t: 400, h: 102, l: 91, c: 92 }, // Lower low in price
  ];
  const cvd: CVDPoint[] = [
    { timestamp: 100, endTimestamp: 200, buyVolume: 10, sellVolume: 10, delta: 0, tradeCount: 5, value: -50 },
    { timestamp: 200, endTimestamp: 300, buyVolume: 20, sellVolume: 10, delta: 10, tradeCount: 5, value: -20 },
    { timestamp: 300, endTimestamp: 400, buyVolume: 30, sellVolume: 10, delta: 20, tradeCount: 5, value: 0 },
    { timestamp: 400, endTimestamp: 500, buyVolume: 40, sellVolume: 10, delta: 30, tradeCount: 5, value: 30 }, // Higher low in CVD
  ];

  const divergences = detectCVDDivergences(bars, cvd, 2);
  assert.ok(divergences.length > 0, "should detect divergence");
  const bullish = divergences.find((d) => d.type === "bullish_regular");
  assert.ok(bullish, "should find a regular bullish divergence");
  assert.equal(bullish?.type, "bullish_regular");
});

test("detects diagonal footprint imbalance when ask exceeds bid ratio by 300%", () => {
  const levels: FootprintLevel[] = [
    { price: 100.0, buyVolume: 50, sellVolume: 10, delta: 40, totalVolume: 60, tradeCount: 5 },
    { price: 100.5, buyVolume: 350, sellVolume: 20, delta: 330, totalVolume: 370, tradeCount: 15 }, // Ask 350 vs lower sell 10 = 35x ratio
  ];

  const imbalances = calculateDiagonalImbalances(levels, 3.0);
  assert.equal(imbalances.length, 1);
  assert.equal(imbalances[0].price, 100.5);
  assert.equal(imbalances[0].imbalanceSide, "buy_imbalance");
  assert.ok(imbalances[0].ratio >= 3.0);
});
