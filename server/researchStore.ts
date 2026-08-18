import { desc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { researchDrafts, workspaces, type ResearchDraft, type Workspace } from "../drizzle/schema";
import { getDb } from "./db";

export type ResearchDatasetReference = {
  provider: "gateio";
  symbol: string;
  interval: string;
  requestedFrom: number | null;
  requestedTo: number | null;
  effectiveFrom: number | null;
  effectiveTo: number | null;
  returnedBars: number;
  complete: boolean;
  sourceTimestamp: number | null;
  fetchedAt: number;
};

export type SaveResearchDraftInput = {
  id?: string;
  workspaceName?: string;
  title?: string;
  hypothesis: string;
  condition: string;
  dataset: ResearchDatasetReference;
};

export type StoredResearchDraft = Omit<ResearchDraft, "datasetJson"> & { dataset: ResearchDatasetReference };

export async function getOrCreateWorkspace(ownerId: number, requestedName?: string): Promise<Workspace | null> {
  const db = await getDb();
  if (!db) return null;
  const existing = await db.select().from(workspaces).where(eq(workspaces.ownerId, ownerId)).orderBy(desc(workspaces.updatedAt)).limit(1);
  if (existing[0]) return existing[0];

  const id = randomUUID();
  await db.insert(workspaces).values({ id, ownerId, name: requestedName?.trim().slice(0, 160) || "Research workspace" });
  const created = await db.select().from(workspaces).where(eq(workspaces.id, id)).limit(1);
  return created[0] ?? null;
}

export async function saveResearchDraft(ownerId: number, input: SaveResearchDraftInput): Promise<StoredResearchDraft | null> {
  const db = await getDb();
  if (!db) return null;
  const workspace = await getOrCreateWorkspace(ownerId, input.workspaceName);
  if (!workspace) return null;

  const id = input.id ?? randomUUID();
  const title = input.title?.trim().slice(0, 180) || "Untitled research draft";
  const hypothesis = input.hypothesis.trim();
  const condition = input.condition.trim();
  const datasetJson = JSON.stringify(input.dataset);
  await db.insert(researchDrafts).values({ id, workspaceId: workspace.id, title, hypothesis, condition, datasetJson }).onDuplicateKeyUpdate({
    set: { title, hypothesis, condition, datasetJson, updatedAt: new Date() },
  });

  const result = await db.select().from(researchDrafts).where(eq(researchDrafts.id, id)).limit(1);
  const draft = result[0];
  if (!draft) return null;
  return { ...draft, dataset: JSON.parse(draft.datasetJson) as ResearchDatasetReference };
}

export async function listResearchDrafts(ownerId: number): Promise<StoredResearchDraft[] | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select({ draft: researchDrafts }).from(researchDrafts)
    .innerJoin(workspaces, eq(researchDrafts.workspaceId, workspaces.id))
    .where(eq(workspaces.ownerId, ownerId))
    .orderBy(desc(researchDrafts.updatedAt));
  return rows.map(({ draft }) => ({ ...draft, dataset: JSON.parse(draft.datasetJson) as ResearchDatasetReference }));
}
