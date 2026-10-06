import assert from "node:assert/strict";
import { test } from "node:test";
import { APPEARANCE_PRESETS, DEFAULT_APPEARANCE, normalizeTerminalAppearance } from "../src/lib/terminal-appearance";

test("fresh appearance is Violet and the original blue preset keeps its colors", () => {
  assert.equal(DEFAULT_APPEARANCE.material, "violet");
  assert.deepEqual(normalizeTerminalAppearance({ preset: "Graphite" }), { preset: "Graphite", ...APPEARANCE_PRESETS.Graphite });
  assert.equal(APPEARANCE_PRESETS.Graphite.accent, "#7dd3fc");
  assert.equal(APPEARANCE_PRESETS.Graphite.chartBackground, "#080b10");
});

test("legacy custom colors and density survive migration", () => {
  const legacy = { preset: "Custom", appBackground: "#010203", panelBackground: "#040506", chartBackground: "#070809", accent: "#aabbcc", upColor: "#11cc22", downColor: "#ee3344", gridOpacity: 11, density: "comfortable" };
  assert.deepEqual(normalizeTerminalAppearance(legacy), { ...legacy, material: "blue" });
  assert.equal(normalizeTerminalAppearance({ ...legacy, material: "violet" }).material, "violet");
});

test("invalid saved colors and numbers cannot reach chart presentation", () => {
  for (const input of [null, false, [], "broken"]) assert.deepEqual(normalizeTerminalAppearance(input), DEFAULT_APPEARANCE);
  const result = normalizeTerminalAppearance({ preset: "Violet", accent: "url(bad)", gridOpacity: Infinity, density: "bad", material: "bad" });
  assert.deepEqual(result, DEFAULT_APPEARANCE);
  assert.equal(normalizeTerminalAppearance({ gridOpacity: 90 }).gridOpacity, 18);
  assert.equal(normalizeTerminalAppearance({ gridOpacity: -5 }).gridOpacity, 0);
});
