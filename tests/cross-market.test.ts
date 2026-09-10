import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateReturns,
  pearsonCorrelation,
  computeCorrelationMatrix,
  computeBetaMetrics,
  computeRelativeStrength,
  generateSyntheticSpread,
} from "../src/lib/market/cross-market";
import type { Bar } from "../src/lib/market/types";

function makeBar(t: number, o: number, h: number, l: number, c: number, v = 100): Bar {
  return { t, o, h, l, c, v };
}

test("calculateReturns generates accurate percentage changes", () => {
  const bars: Bar[] = [
    makeBar(1000, 100, 105, 95, 100),
    makeBar(2000, 100, 110, 98, 110),
    makeBar(3000, 110, 115, 105, 104.5),
  ];
  const rets = calculateReturns(bars);
  assert.equal(rets.length, 2);
  assert.equal(Number(rets[0].toFixed(2)), 0.10); // (110 - 100) / 100 = +10%
  assert.equal(Number(rets[1].toFixed(2)), -0.05); // (104.5 - 110) / 110 = -5%
});

test("pearsonCorrelation computes correct correlation coefficients", () => {
  const x = [0.01, 0.02, 0.03, 0.04, 0.05];
  const y = [0.02, 0.04, 0.06, 0.08, 0.10]; // perfectly correlated
  const z = [-0.01, -0.02, -0.03, -0.04, -0.05]; // perfectly inverse

  assert.equal(pearsonCorrelation(x, y), 1.0);
  assert.equal(pearsonCorrelation(x, z), -1.0);

  const returnsMap = new Map<string, number[]>([
    ["BTC", x],
    ["ETH", y],
    ["SOL", z],
  ]);

  const matrix = computeCorrelationMatrix(["BTC", "ETH", "SOL"], returnsMap);
  assert.equal(matrix.symbols.length, 3);
  assert.equal(matrix.matrix[0][0], 1.0);
  assert.equal(matrix.matrix[0][1], 1.0);
  assert.equal(matrix.matrix[0][2], -1.0);
});

test("computeBetaMetrics computes beta, alpha and R-squared relative to benchmark", () => {
  const target = [0.02, 0.04, -0.02, 0.06, -0.04];
  const benchmark = [0.01, 0.02, -0.01, 0.03, -0.02]; // target moves at 2x benchmark

  const metrics = computeBetaMetrics(target, benchmark);
  assert.equal(metrics.beta, 2.0);
  assert.equal(metrics.rSquared, 1.0);
});

test("computeRelativeStrength and generateSyntheticSpread produce valid series", () => {
  const barsA: Bar[] = [
    makeBar(1000, 100, 102, 99, 100),
    makeBar(2000, 101, 105, 100, 104),
    makeBar(3000, 104, 110, 103, 108),
  ];

  const barsB: Bar[] = [
    makeBar(1000, 50, 52, 49, 50),
    makeBar(2000, 50, 51, 48, 49),
    makeBar(3000, 49, 52, 49, 50),
  ];

  const rs = computeRelativeStrength(barsA, barsB);
  assert.equal(rs.length, 3);
  assert.equal(rs[0].normalized, 100);
  assert.ok(rs[1].normalized > 100); // Asset A outperformed Asset B

  const spread = generateSyntheticSpread(barsA, barsB, 2.0);
  assert.equal(spread.length, 3);
  assert.equal(spread[0].open, 100 - 2 * 50); // 0
  assert.equal(spread[0].close, 100 - 2 * 50); // 0
  assert.equal(spread[1].close, 104 - 2 * 49); // 104 - 98 = 6
});
