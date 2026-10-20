import { verifiedServerSession } from "@/server/auth-session";
import { db } from "@/lib/db";
import { workspaceChartDocuments } from "@/lib/chart/workspace-snapshot";
import { type WorkspacePayload } from "@/lib/workspace-payload";
export { workspacePayloadSchema } from "@/lib/workspace-payload";

/**
 * Server-only workspace data access. Route handlers must use this boundary
 * rather than exposing Prisma or ownership decisions to client modules.
 */
export type { WorkspacePayload } from "@/lib/workspace-payload";

export class WorkspaceAccessError extends Error {
  constructor(public readonly code: "WORKSPACE_FORBIDDEN" | "NOT_FOUND" | "REVISION_CONFLICT", message: string) {
    super(message);
  }
}

export async function authenticatedWorkspaceOwner() {
  const session = await verifiedServerSession();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return null;
  return db.user.findUnique({ where: { id: userId } });
}

function serializeSnapshot(payload: WorkspacePayload) {
  if (payload.version === 3) return JSON.stringify({ ...payload, chartDocuments: workspaceChartDocuments(payload.chartDocuments, payload.id) });
  return JSON.stringify({ version: 2, view: payload.view, symbol: payload.symbol, timeframe: payload.timeframe, timezone: payload.timezone, createdAt: payload.createdAt, chartDocuments: workspaceChartDocuments(payload.chartDocuments, payload.id) });
}

export async function listWorkspaces(ownerId: string, id?: string) {
  return db.workspace.findMany({
    where: { ownerId, ...(id ? { id } : {}) },
    select: { id: true, name: true, createdAt: true, updatedAt: true, cloudState: { select: { schemaVersion: true, payload: true, updatedAt: true } } },
    orderBy: { updatedAt: "desc" },
  });
}

export async function saveWorkspace(ownerId: string, payload: WorkspacePayload, expectedRevision?: number | null) {
  return db.$transaction(async (tx) => {
    const existing = await tx.workspace.findUnique({ where: { id: payload.id }, select: { ownerId: true } });
    if (existing && existing.ownerId !== ownerId) throw new WorkspaceAccessError("WORKSPACE_FORBIDDEN", "A cloud workspace belongs to another account.");
    const previous = existing ? await tx.cloudWorkspaceState.findUnique({ where: { workspaceId: payload.id } }) : null;
    const previousPayload = previous?.payload ? JSON.parse(previous.payload) : null;
    // An older browser must not silently downgrade a newer workspace snapshot.
    if (payload.version !== 3 && previousPayload?.version === 3) throw new WorkspaceAccessError("REVISION_CONFLICT", "This workspace was updated in a newer browser. Reload it before saving.");
    if (payload.version === 3) {
      const revision = previous ? previousPayload?.revision ?? 0 : null;
      if (expectedRevision !== revision) throw new WorkspaceAccessError("REVISION_CONFLICT", "The cloud workspace changed elsewhere. Reload it or save your local version as a copy.");
    }
    const workspace = existing
      ? await tx.workspace.update({ where: { id: payload.id, ownerId }, data: { name: payload.name } })
      : await tx.workspace.create({ data: { id: payload.id, ownerId, name: payload.name } });
    const snapshot = payload.version === 3 ? { ...payload, revision: (previousPayload?.revision ?? 0) + 1 } : payload;
    if (payload.version === 3 && previous) {
      const changed = await tx.cloudWorkspaceState.updateMany({ where: { workspaceId: workspace.id, payload: previous.payload }, data: { schemaVersion: 3, payload: serializeSnapshot(snapshot) } });
      if (changed.count !== 1) throw new WorkspaceAccessError("REVISION_CONFLICT", "The cloud workspace changed during save. Your local changes are retained.");
      return { workspace: { id: workspace.id, name: workspace.name, updatedAt: workspace.updatedAt, cloudState: { schemaVersion: 3, revision: payload.version === 3 ? (previousPayload?.revision ?? 0) + 1 : 0 } }, created: false };
    }
    if (payload.version === 3) {
      await tx.cloudWorkspaceState.create({ data: { workspaceId: workspace.id, schemaVersion: 3, payload: serializeSnapshot(snapshot) } });
      return { workspace: { id: workspace.id, name: workspace.name, updatedAt: workspace.updatedAt, cloudState: { schemaVersion: 3, revision: 1 } }, created: !existing };
    }
    const cloudState = await tx.cloudWorkspaceState.upsert({
      where: { workspaceId: workspace.id },
      create: { workspaceId: workspace.id, schemaVersion: 2, payload: serializeSnapshot(snapshot) },
      update: { schemaVersion: 2, payload: serializeSnapshot(snapshot) },
      select: { schemaVersion: true, updatedAt: true },
    });
    return { workspace: { id: workspace.id, name: workspace.name, updatedAt: workspace.updatedAt, cloudState }, created: !existing };
  });
}

export async function deleteWorkspace(ownerId: string, id: string) {
  const result = await db.workspace.deleteMany({ where: { id, ownerId } });
  if (!result.count) throw new WorkspaceAccessError("NOT_FOUND", "Workspace not found or unauthorized");
}
