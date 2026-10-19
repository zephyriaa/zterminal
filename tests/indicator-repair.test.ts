import assert from "node:assert/strict";
import test from "node:test";
import { createStudy, INDICATOR_LIBRARY } from "../src/lib/indicator-library";
import { evaluateIndicator } from "../src/lib/chart/indicators/evaluators";
import { VolumeProfilePrimitive } from "../src/lib/chart/overlays/volume-profile-primitive";
import type { SeriesAttachedParameter, Time } from "lightweight-charts";
import { buildVolumeProfile } from "../src/domain/analytics/market";
import type { ChartTimezone } from "../src/stores/workspace";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
import { renderToStaticMarkup } from "react-dom/server";
import { useStudies } from "../src/stores/studies";

const bars = Array.from({ length: 6 }, (_, i) => ({ t: Date.UTC(2025, 0, 1, i), o: i + 10, h: i + 12, l: i + 9, c: i + 11, v: i + 1 }));
test("invalid calculation inputs cannot silently calculate a default under a new label", () => {
  for (const value of [0, 1.5, NaN, Infinity, "wrong"]) { const study = createStudy("sma20"); study.inputs.length = value; assert.throws(() => evaluateIndicator(study, bars, "UTC")); }
});
test("VWAP with no observed volume is undefined, rather than a substituted close", () => {
  assert.deepEqual(evaluateIndicator(createStudy("vwap"), bars.map(b => ({ ...b, v: 0 })), "UTC")[0].values, bars.map(() => null));
});
test("all six chart timezone modes calculate VWAP using their actual local-date reset", () => {
  const input = Array.from({ length: 48 }, (_, i) => ({ t: Date.UTC(2025, 0, 1, i), o: i + 10, h: i + 12, l: i + 9, c: i + 11, v: 1 }));
  for (const timezone of ["America/New_York", "UTC", "Europe/London", "Asia/Tokyo", "Asia/Dubai", "local"] as ChartTimezone[]) {
    const actual = evaluateIndicator(createStudy("vwap"), input, timezone)[0].values;
    const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: timezone === "local" ? undefined : timezone });
    let values: number[] = [], day = "";
    input.forEach((bar, i) => { const key = formatter.format(bar.t); if (key !== day) { values = []; day = key; } values.push((bar.h + bar.l + bar.c) / 3); assert.ok(Math.abs(actual[i]! - values.reduce((a, b) => a + b, 0) / values.length) < 1e-10, timezone); });
  }
});
test("zero-volume profiles retain observations without inventing a POC or value area", () => {
  const profile = buildVolumeProfile(bars.map(b => ({ ...b, v: 0 })), 1);
  assert.equal(profile.pointOfControl, null); assert.equal(profile.valueAreaHigh, null); assert.equal(profile.valueAreaLow, null);
});
test("native settings render every declared calculation input from its shared definition", () => {
  const source = readFileSync(new URL("../src/components/terminal/indicators-browser.tsx", import.meta.url), "utf8");
  const tree = ts.createSourceFile("settings.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let fn = ""; tree.forEachChild(node => { if (ts.isFunctionDeclaration(node) && node.name?.text === "StudySettings") fn = node.getText(tree); }); assert.ok(fn);
  for (const definition of INDICATOR_LIBRARY) {
    const javascript = ts.transpileModule(`const view = (${fn})(props); view;`, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS } }).outputText;
    const element = vm.runInNewContext(javascript, { exports: {}, require: createRequire(import.meta.url), props: { study: createStudy(definition.id), onSave() {}, onCancel() {} }, useState: (value: unknown) => [value, () => {}], INDICATOR_LIBRARY });
    const html = renderToStaticMarkup(element);
    for (const input of definition.inputs) assert.ok(html.includes(`<label>${input.label}<input type="number"`), definition.id+":"+input.id);
  }
});
test("removing all studies remains an intentional empty chart after hydration", () => {
  const merged = useStudies.persist.getOptions().merge!({ instances: [], favorites: [], recent: [] }, useStudies.getState());
  assert.deepEqual(merged.instances, []);
});
test("profile uses native normal/log/inverted coordinates, clips price pane and updates transform", () => {
  const primitive = new VolumeProfilePrimitive();
  const calls: number[] = [], rectangles: number[][] = [], clips: number[][] = [];
  let transform = (price: number) => 200 - price * 2;
  const series = { priceToCoordinate: (price: number) => { calls.push(price); return transform(price); } };
  primitive.attached({ series, requestUpdate() {} } as unknown as SeriesAttachedParameter<Time>);
  primitive.setProfile({ levels: [{ price: 50, volume: 10 }, { price: 100, volume: 20 }], pointOfControl: 100, valueAreaLow: 50, valueAreaHigh: 100 }, 1);
  const context = { save() {}, restore() {}, beginPath() {}, rect: (...values: number[]) => clips.push(values), clip() {}, fillRect: (...values: number[]) => rectangles.push(values), fillText() {}, moveTo() {}, lineTo() {}, stroke() {} };
  const target = { useMediaCoordinateSpace: (draw: (scope: unknown) => void) => draw({ context, mediaSize: { width: 400, height: 200 } }) };
  for (const projection of [(p: number) => 200 - p * 2, (p: number) => Math.log(p) * 30, (p: number) => p]) {
    transform = projection; rectangles.length = 0; calls.length = 0;
    primitive.draw(target as never);
    assert.ok(calls.includes(50) && calls.includes(100));
    assert.ok(rectangles.some(rect => Math.abs((rect[1] + rect[3] / 2) - projection(50)) < 1e-9));
    assert.deepEqual(clips.at(-1), [0, 0, 400, 200]);
  }
  primitive.setProfile(null, 1); rectangles.length = 0; primitive.draw(target as never); assert.equal(rectangles.length, 0);
});
test("all eight computed native presets match independent last-window formulas and prefix recalculation", () => {
  for (const definition of INDICATOR_LIBRARY.filter(d => !["volume", "profile"].includes(d.kind))) {
    const study = createStudy(definition.id); if (study.inputs.length !== undefined) study.inputs.length = 3;
    const result = evaluateIndicator(study, bars, "UTC");
    const window = bars.slice(-3), mean = window.reduce((sum, b) => sum + b.c, 0) / 3;
    const values = Object.fromEntries(result.map(output => [output.id, output.values.at(-1)]));
    let expected: Record<string, number>;
    if (study.kind === "ema") expected = { value: bars.reduce((previous, b, i) => i ? (b.c + previous) / 2 : b.c, 0) };
    else if (study.kind === "sma") expected = { value: mean };
    else if (study.kind === "wma") expected = { value: window.reduce((sum, b, i) => sum + b.c * (i + 1), 0) / 6 };
    else if (study.kind === "vwma") expected = { value: window.reduce((sum, b) => sum + b.c * b.v, 0) / window.reduce((sum, b) => sum + b.v, 0) };
    else if (study.kind === "vwap") expected = { value: bars.reduce((sum, b) => sum + (b.h + b.l + b.c) / 3 * b.v, 0) / bars.reduce((sum, b) => sum + b.v, 0) };
    else if (study.kind === "donchian") expected = { upper: Math.max(...window.map(b => b.h)), lower: Math.min(...window.map(b => b.l)) };
    else { const deviation = Math.sqrt(window.reduce((sum, b) => sum + (b.c - mean) ** 2, 0) / 3); expected = { middle: mean, upper: mean + 2 * deviation, lower: mean - 2 * deviation }; }
    for (const [key, value] of Object.entries(expected)) assert.ok(Math.abs(values[key]! - value) < 1e-10, definition.id);
    for (let end = 1; end <= bars.length; end++) for (const output of evaluateIndicator(study, bars.slice(0, end), "UTC")) assert.deepEqual(output.values, result.find(r => r.id === output.id)!.values.slice(0, end), definition.id);
  }
});
