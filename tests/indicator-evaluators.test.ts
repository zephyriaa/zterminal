import test from "node:test";
import assert from "node:assert/strict";
import { createStudy, migrateStudy, validateStudy } from "../src/lib/indicator-library";
import { evaluateIndicator } from "../src/lib/chart/indicators/evaluators";

const bars = Array.from({ length: 6 }, (_, index) => ({ t: Date.UTC(2025, 0, 1, 0, index), o: index + 1, h: index + 2, l: index, c: index + 1, v: 10 }));

test("legacy indicator instances migrate without changing stable identity", () => {
  const migrated = migrateStudy({ id: "saved-bb", presetId: "bollinger20", name: "Saved BB", kind: "bollinger", period: 3, multiplier: 1.5, color: "#123456", visible: false });
  assert.ok(migrated);
  assert.equal(migrated.id, "saved-bb");
  assert.deepEqual(migrated.inputs, { length: 3, multiplier: 1.5 });
  assert.equal(migrated.outputs.length, 3);
  assert.ok(migrated.outputs.every(output => output.color === "#123456"));
  assert.equal(migrated.enabled, false);
  validateStudy(migrated);
});

test("duplicate indicator settings remain structurally independent", () => {
  const original = createStudy("bollinger20", "one");
  const duplicate = { ...original, id: "two", inputs: { ...original.inputs }, outputs: original.outputs.map(output => ({ ...output })) };
  duplicate.inputs.length = 50; duplicate.outputs[0].color = "#ffffff";
  assert.equal(original.inputs.length, 20);
  assert.notEqual(original.outputs[0].color, duplicate.outputs[0].color);
});

test("multi-output evaluators align results to the supplied replay boundary", () => {
  const study = createStudy("bollinger20"); study.inputs.length = 3;
  const result = evaluateIndicator(study, bars.slice(0, 4), "UTC");
  assert.deepEqual(result.map(output => output.id), ["middle", "upper", "lower"]);
  assert.ok(result.every(output => output.values.length === 4));
  assert.equal(result[0].values[1], null);
  assert.equal(result[0].values[2], 2);
});
