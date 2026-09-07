import test from "node:test";
import assert from "node:assert/strict";
import { createStudy, searchIndicators, validateStudy } from "../src/lib/indicator-library";
test("indicator search supports aliases, categories and misspellings", () => {
  assert.ok(searchIndicators("sma").some(p => p.id === "sma20"));
  assert.ok(searchIndicators("bolinger").some(p => p.id === "bollinger20"));
  assert.equal(searchIndicators("volatility").length, 2);
  assert.equal(searchIndicators("unsupported stochastic").length, 0);
});
test("indicator instances have separate stable identity and validated settings", () => {
  const a = createStudy("ema20"), b = createStudy("ema20");
  assert.notEqual(a.id, b.id);
  validateStudy(a);
  for (const period of [0, -1, 1.5, NaN, 1001]) assert.throws(() => validateStudy({ ...a, period }));
  assert.throws(() => validateStudy({ ...createStudy("bollinger20"), multiplier: Infinity }));
});
