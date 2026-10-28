import test from "node:test";
import assert from "node:assert/strict";
import { appearanceChartStyle, defaultChartStyle, chartStyle, contrastRatio, DEFAULT_CUSTOMIZATION, defaultBindings, parseCustomization, parsePreferenceFile, shortcutFromEvent, validateBindings } from "../src/lib/customization";
import { DEFAULT_APPEARANCE } from "../src/lib/terminal-appearance";
import { createChartDocument, DEFAULT_CHART_SETTINGS } from "../src/lib/chart/contracts";
import { useChartDocuments } from "../src/stores/chart-documents";
import { useTerminalAppearance } from "../src/stores/terminal-appearance";
import { workspaceSnapshotSchema, newWorkspace } from "../src/lib/workspaces/model";

test("portable preferences round-trip and reject unsupported or invalid input before applying", () => {
  const file = { version: 1, appearance: DEFAULT_APPEARANCE, customization: DEFAULT_CUSTOMIZATION };
  assert.deepEqual(parsePreferenceFile(JSON.stringify(file)), { appearance: DEFAULT_APPEARANCE, customization: DEFAULT_CUSTOMIZATION });
  for (const input of [{ ...file, version: 2 }, { ...file, appearance: { ...DEFAULT_APPEARANCE, accent: "url(bad)" } }, { ...file, customization: { ...DEFAULT_CUSTOMIZATION, fontSize: 30 } }, { ...file, customization: { ...DEFAULT_CUSTOMIZATION, chartDefaults: { scaleMode: "percentage" } } }, { ...file, customization: { ...DEFAULT_CUSTOMIZATION, chartDefaults: { showGrid: "yes" } } }, { ...file, customization: { ...DEFAULT_CUSTOMIZATION, layoutTemplates: [{ name: "Bad", layout: {}, multiLayout: "1" }] } }]) assert.throws(() => parsePreferenceFile(JSON.stringify(input)));
  assert.throws(() => parsePreferenceFile("x".repeat(2_000_001)));
  assert.throws(() => parsePreferenceFile("not json"));
});

test("shortcut rebinds detect collisions and preserve editing and browser commands", () => {
  assert.equal(validateBindings({ ...defaultBindings, sidebar: "Alt+9" }).sidebar, "Alt+9");
  assert.equal(validateBindings({ ...defaultBindings, sidebar: "" }).sidebar, "");
  for (const value of ["Mod+K", "Mod+Z", "Mod+C", "Mod+S", "Mod+D", "Mod+L", "Shift+A", "Mod+Mod+B", "Alt+Mod+B"]) assert.throws(() => validateBindings({ ...defaultBindings, sidebar: value }));
  assert.throws(() => validateBindings({ ...defaultBindings, unknown: "Alt+9" }));
  assert.equal(shortcutFromEvent({ key: "k", ctrlKey: true, metaKey: false, altKey: false, shiftKey: false }), "Mod+K");
  assert.equal(shortcutFromEvent({ key: ",", ctrlKey: false, metaKey: true, altKey: false, shiftKey: true }), "Mod+Shift+,");
});

test("appearance defaults never overwrite chart overrides; styles preserve scales, identity and drawings", () => {
  const document = createChartDocument({ workspaceId: "customization-test", instrument: { provider: "binance", exchange: "BINANCE", product: "perpetual", nativeSymbol: "BTCUSDT" }, timeframe: "5m", settings: { backgroundColor: "#010203", scaleMode: "logarithmic", invertScale: true } });
  useChartDocuments.setState({ documents: { [document.id]: document } });
  useTerminalAppearance.getState().update({ accent: "#ffffff", chartBackground: "#080808" });
  assert.deepEqual(useChartDocuments.getState().documents[document.id], document);
  useChartDocuments.getState().updateSettings(document.id, chartStyle({ ...DEFAULT_CHART_SETTINGS, candleUpColor: "#112233", candleWickUpColor: "#445566" }));
  const updated = useChartDocuments.getState().documents[document.id];
  assert.equal(updated.settings.scaleMode, "logarithmic"); assert.equal(updated.settings.invertScale, true);
  assert.equal(updated.settings.candleUpColor, "#112233"); assert.equal(updated.settings.candleWickUpColor, "#445566");
  assert.deepEqual(updated.instrument, document.instrument); assert.equal(updated.timeframe, document.timeframe); assert.deepEqual(updated.drawings, document.drawings);
  const defaults = appearanceChartStyle(DEFAULT_APPEARANCE);
  assert.equal(defaults.candleUpColor, defaults.candleWickUpColor);
  assert.equal(defaults.candleUpColor, defaults.candleBorderUpColor);
});

test("old workspace snapshots gain an unlocked layout without losing their arrangement or linking", () => {
  const workspace = newWorkspace("Existing", "chart");
  const { layoutLocked: _, ...old } = workspace;
  const restored = workspaceSnapshotSchema.parse(old);
  assert.equal(restored.layoutLocked, false);
  assert.deepEqual(restored.multiChart, workspace.multiChart);
  assert.deepEqual(restored.dockLayout, workspace.dockLayout);
  assert.equal(workspaceSnapshotSchema.parse({ ...workspace, layoutLocked: true }).layoutLocked, true);
});

test("style and preset libraries are bounded and contrast feedback is numeric", () => {
  assert.throws(() => parseCustomization({ chartStyles: Array.from({ length: 31 }, () => ({ name: "style", settings: {} })) }));
  assert.throws(() => parseCustomization({ chartStyles: [{ name: "same", settings: {} }, { name: "same", settings: {} }] }));
  assert.throws(() => parseCustomization({ indicatorTemplates: [{ name: "bad", indicators: [{}] }] }));
  assert.equal(contrastRatio("#000000", "#ffffff"), 21);
  assert.equal(contrastRatio("#ffffff", "#ffffff"), 1);
});


test("restoring application style uses exactly the defaults that seed future charts", () => {
  const saved = { candleWickUpColor: "#ffffff", showGrid: false, showCrosshair: false };
  const defaults = defaultChartStyle(DEFAULT_APPEARANCE, saved);
  assert.equal(defaults.candleWickUpColor, "#ffffff");
  assert.equal(defaults.candleUpColor, DEFAULT_APPEARANCE.upColor);
  assert.equal(defaults.showGrid, false);
  assert.equal(defaults.showCrosshair, false);
  assert.ok(!Object.hasOwn(defaults, "scaleMode"));
  assert.ok(!Object.hasOwn(defaults, "futureBars"));
});
