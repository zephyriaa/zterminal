import assert from "node:assert/strict";
import test from "node:test";
import { createChartDocument, type ChartDocument } from "../src/lib/chart/contracts";
import { createPythonStudy } from "../src/lib/indicator-library";
import { newWorkspace } from "../src/lib/workspaces/model";
import { createWorkspaceBackup, prepareWorkspaceImport } from "../src/lib/workspaces/backup";

test("portable workspaces preserve Python bytes and import as independently owned copies", () => {
  const snapshot = newWorkspace("Research", "research");
  snapshot.research = { activeId: "original", config: {}, params: {}, minimap: false };
  snapshot.studies = [{ kind: "python", artifactId: "original", presetId: "python:original" }];
  const source = "# Unicode α\nprint('unchanged')\n";
  const draft = { id: "original", name: "Strategy", source, savedSource: source, updatedAt: 1, revision: 0 };
  const backup = createWorkspaceBackup(snapshot, { original: draft });
  const imported = prepareWorkspaceImport(JSON.parse(JSON.stringify({ ...backup, ownerId: "another-account" })));
  assert.notEqual(imported.snapshot.id, snapshot.id);
  assert.equal(imported.snapshot.revision, 0);
  assert.notEqual(imported.snapshot.research?.activeId, "original");
  assert.equal(imported.drafts[imported.snapshot.research!.activeId].source, source);
  assert.deepEqual(imported.snapshot.studies, [{ kind: "python", artifactId: imported.snapshot.research!.activeId, presetId: `python:${imported.snapshot.research!.activeId}` }]);
  assert.equal("ownerId" in imported, false);
  assert.equal(snapshot.research.activeId, "original");
});

test("a backup identifies missing referenced code and rejects incompatible formats", () => {
  const snapshot = newWorkspace("Research", "research");
  snapshot.research = { activeId: "missing", config: {}, params: {}, minimap: false };
  const backup = createWorkspaceBackup(snapshot, {});
  assert.deepEqual(backup.missingDraftIds, ["missing"]);
  assert.throws(() => prepareWorkspaceImport({ ...backup, version: 99 }));
  assert.throws(() => prepareWorkspaceImport({ ...backup, drafts: [{ id: "bad", source: 42 }] }));
});

test("chart-only Python indicators retain source and rekey their workspace and artifact identities", () => {
  const snapshot = newWorkspace("Indicator research", "chart");
  const chart = createChartDocument({ workspaceId: snapshot.id, instrument: { provider: "gateio", exchange: "GATEIO", product: "perpetual", nativeSymbol: "BTC_USDT" }, timeframe: "5m" });
  chart.indicators = [createPythonStudy({ artifactId: "indicator-source", name: "EMA", outputs: [{ id: "ema", plot: "line" }] })];
  snapshot.chartDocuments = [chart];
  const source = "import zterminal as zt\ndef calculate(data, params):\n    return {'ema': zt.ema(data.close, 2)}\n";
  const draft = { id: "indicator-source", name: "EMA", kind: "indicator" as const, source, savedSource: source, updatedAt: 1, revision: 0 };
  const imported = prepareWorkspaceImport(createWorkspaceBackup(snapshot, { [draft.id]: draft }));
  const restored = imported.snapshot.chartDocuments![0] as ChartDocument;
  assert.notEqual(restored.id, chart.id);
  assert.equal(restored.workspaceId, imported.snapshot.id);
  assert.notEqual(restored.indicators[0].artifactId, draft.id);
  assert.equal(imported.drafts[restored.indicators[0].artifactId!].source, source);
});

test("the backup limit counts UTF-8 bytes so an exported Unicode library remains importable", () => {
  const snapshot = newWorkspace("Unicode library", "research");
  const source = "\u00e9".repeat(256000);
  const drafts = Object.fromEntries(Array.from({ length: 9 }, (_, index) => {
    const id = `source-${index}`;
    return [id, { id, name: id, source, savedSource: source, updatedAt: 1, revision: 0 }];
  }));
  snapshot.studies = Object.keys(drafts).map(artifactId => ({ artifactId }));
  assert.throws(() => createWorkspaceBackup(snapshot, drafts), /8 MB/);
});
