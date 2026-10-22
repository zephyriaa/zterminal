import { z } from "zod";
import { copyWorkspace, workspaceSnapshotSchema, type WorkspaceSnapshot } from "./model";
import { workspaceChartDocuments } from "../chart/workspace-snapshot";
import type { ScriptRecord } from "../local-research/contracts";

const draftSchema = z.object({
  id: z.string().min(1).max(100), name: z.string().max(256), source: z.string().max(256000), savedSource: z.string().max(256000),
  localSavedSource: z.string().max(256000).optional(), updatedAt: z.number().finite().nonnegative(), revision: z.number().int().nonnegative(),
  kind: z.enum(["strategy", "indicator"]).optional(), description: z.string().max(16000).optional(),
});
const backupSchema = z.object({
  format: z.literal("zterminal-workspace"), version: z.literal(1), exportedAt: z.number().int().positive(),
  snapshot: workspaceSnapshotSchema, drafts: z.array(draftSchema).max(100), missingDraftIds: z.array(z.string().max(100)).max(100),
}).refine(value => new TextEncoder().encode(JSON.stringify(value)).length <= 8000000, "Backup exceeds 8 MB");

export function createWorkspaceBackup(snapshot: WorkspaceSnapshot, library: Record<string, ScriptRecord>) {
  const ids = new Set<string>();
  if (snapshot.research?.activeId) ids.add(snapshot.research.activeId);
  const collect = (values: unknown[]) => {
    for (const value of values) {
      const item = value as { artifactId?: unknown } | null;
      if (typeof item?.artifactId === "string") ids.add(item.artifactId);
    }
  };
  collect(snapshot.studies);
  for (const chart of snapshot.chartDocuments ?? []) collect((chart as { indicators?: unknown[] })?.indicators ?? []);
  return backupSchema.parse({ format: "zterminal-workspace", version: 1, exportedAt: Date.now(), snapshot,
    drafts: [...ids].flatMap(id => library[id] ? [library[id]] : []), missingDraftIds: [...ids].filter(id => !library[id]) });
}

/** Import never executes code, overwrites a workspace, or inherits cloud ownership. */
export function prepareWorkspaceImport(value: unknown) {
  const backup = backupSchema.parse(value), snapshot = copyWorkspace(backup.snapshot, backup.snapshot.name);
  const ids = new Map(backup.drafts.map(draft => [draft.id, crypto.randomUUID()]));
  if (ids.size !== backup.drafts.length) throw new Error("Backup contains duplicate Python artifact IDs");
  const drafts = Object.fromEntries(backup.drafts.map(draft => { const id = ids.get(draft.id)!; return [id, { ...draft, id }]; }));
  const remap = (values: unknown[]) => values.map(value => {
    const item = value as { artifactId?: string; presetId?: string } | null;
    return item?.artifactId && ids.has(item.artifactId) ? { ...item, artifactId: ids.get(item.artifactId), ...(item.presetId === `python:${item.artifactId}` ? { presetId: `python:${ids.get(item.artifactId)}` } : {}) } : value;
  });
  if (snapshot.research && ids.has(snapshot.research.activeId)) snapshot.research.activeId = ids.get(snapshot.research.activeId)!;
  snapshot.studies = remap(snapshot.studies);
  const documents = workspaceChartDocuments(snapshot.chartDocuments, snapshot.id);
  if (documents.length !== (snapshot.chartDocuments?.length ?? 0)) throw new Error("Backup includes incompatible charts; no workspace was imported");
  snapshot.chartDocuments = documents.map(chart => ({ ...chart, indicators: remap(chart.indicators) }));
  return { snapshot: workspaceSnapshotSchema.parse(snapshot), drafts, missingDraftIds: backup.missingDraftIds };
}
