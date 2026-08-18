import { describe, expect, it } from "vitest";
import { evaluateClosedZS } from "./zsRuntime";

const bars = [
  { t: 1_000, o: 10, h: 11, l: 9, c: 10, v: 4 },
  { t: 2_000, o: 10, h: 12, l: 9, c: 11, v: 5 },
  { t: 3_000, o: 11, h: 13, l: 10, c: 12, v: 6 },
  { t: 4_000, o: 12, h: 13, l: 10, c: 10, v: 5 },
];

const validSource = `strategy("Closed crossover", overlay=true)
input.int("Length", 2, minval=1, maxval=20)
var mean = sma(close, Length)
if crossover(close, mean)
  strategy.entry("long", strategy.long, qty=2)
if crossunder(close, mean)
  strategy.close("long")`;

describe("closed ZS historical runtime", () => {
  it("interprets only the validated AST over prior/current historical candles and returns deterministic signal declarations", () => {
    const first = evaluateClosedZS(validSource, bars);
    const second = evaluateClosedZS(validSource, bars);
    expect(first).toMatchObject({ ok: true, runtimeVersion: "zs-historical-runtime-v1", strategyName: "Closed crossover" });
    expect(first.signals).toEqual(second.signals);
    expect(first.signals).toEqual([
      { kind: "entry", time: 2_000, barIndex: 1, id: "long", quantity: 2 },
      { kind: "exit", time: 4_000, barIndex: 3, id: "long" },
    ]);
    expect(first.fingerprint).toBe(second.fingerprint);
  });

  it("rejects escape hatches and unsupported historical order-flow identifiers instead of evaluating or substituting a template", () => {
    const escaped = evaluateClosedZS(`strategy("bad")\nif fetch("https://example.invalid")\n  strategy.entry("x", strategy.long, qty=1)`, bars);
    const unavailableSeries = evaluateClosedZS(`strategy("bad flow")\nif cvd > 0\n  strategy.entry("x", strategy.long, qty=1)`, bars);
    expect(escaped.ok).toBe(false);
    expect(escaped.signals).toEqual([]);
    expect(escaped.diagnostics.some(item => item.message.includes("fetch"))).toBe(true);
    expect(unavailableSeries.ok).toBe(false);
    expect(unavailableSeries.signals).toEqual([]);
    expect(unavailableSeries.diagnostics.some(item => item.message.includes("cvd"))).toBe(true);
  });

  it("fails closed when a syntactically valid construct is outside the executable v1 subset", () => {
    const unsupported = evaluateClosedZS(`strategy("short not supported")\nstrategy.entry("short", strategy.short, qty=1)`, bars);
    const dynamicQuantity = evaluateClosedZS(`strategy("dynamic sizing not supported")\ninput.int("Quantity", 2)\nstrategy.entry("long", strategy.long, qty=Quantity)`, bars);
    expect(unsupported.ok).toBe(false);
    expect(unsupported.signals).toEqual([]);
    expect(unsupported.diagnostics.some(item => item.message.includes("long-only"))).toBe(true);
    expect(dynamicQuantity.ok).toBe(false);
    expect(dynamicQuantity.signals).toEqual([]);
    expect(dynamicQuantity.diagnostics.some(item => item.message.includes("dynamic sizing"))).toBe(true);
  });
});
