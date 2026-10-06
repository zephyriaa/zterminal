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
  constructor(public readonly code: "WORKSPACE_FORBIDDEN" | "NOT_FOUND", message: string) {
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
  return JSON.stringify({ version: 2, view: payload.view, symbol: payload.symbol, timeframe: payload.timeframe, timezone: payload.timezone, createdAt: payload.createdAt, chartDocuments: workspaceChartDocuments(payload.chartDocuments, payload.id) });
}

export async function listWorkspaces(ownerId: string) {
  return db.workspace.findMany({
    where: { ownerId },
    select: { id: true, name: true, createdAt: true, updatedAt: true, cloudState: { select: { schemaVersion: true, payload: true, updatedAt: true } } },
    orderBy: { updatedAt: "desc" },
  });
}

export async function saveWorkspace(ownerId: string, payload: WorkspacePayload) {
  return db.$transaction(async (tx) => {
    const existing = await tx.workspace.findUnique({ where: { id: payload.id }, select: { ownerId: true } });
    if (existing && existing.ownerId !== ownerId) throw new WorkspaceAccessError("WORKSPACE_FORBIDDEN", "A cloud workspace belongs to another account.");
    const workspace = existing
      ? await tx.workspace.update({ where: { id: payload.id, ownerId }, data: { name: payload.name } })
      : await tx.workspace.create({ data: { id: payload.id, ownerId, name: payload.name } });
    const cloudState = await tx.cloudWorkspaceState.upsert({
      where: { workspaceId: workspace.id },
      create: { workspaceId: workspace.id, schemaVersion: 2, payload: serializeSnapshot(payload) },
      update: { schemaVersion: 2, payload: serializeSnapshot(payload) },
      select: { schemaVersion: true, updatedAt: true },
    });
    return { workspace: { id: workspace.id, name: workspace.name, updatedAt: workspace.updatedAt, cloudState }, created: !existing };
  });
}

export async function deleteWorkspace(ownerId: string, id: string) {
  const result = await db.workspace.deleteMany({ where: { id, ownerId } });
  if (!result.count) throw new WorkspaceAccessError("NOT_FOUND", "Workspace not found or unauthorized");
}
