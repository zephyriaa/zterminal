import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * Server-only workspace data access. Route handlers must use this boundary
 * rather than exposing Prisma or ownership decisions to client modules.
 */
export const workspacePayloadSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(80),
  view: z.enum(["markets", "calendar", "alerts", "chart", "strategy", "backtester", "research", "portfolio", "risk", "journal", "connections", "settings"]),
  symbol: z.string().trim().regex(/^[A-Z0-9]{3,24}$/),
  timeframe: z.enum(["1m", "5m", "15m", "30m", "1h", "4h", "1d"]),
  timezone: z.enum(["America/New_York", "UTC", "Europe/London", "Asia/Dubai", "Asia/Tokyo", "local"]),
  createdAt: z.number().int().positive(),
});

export type WorkspacePayload = z.infer<typeof workspacePayloadSchema>;

export class WorkspaceAccessError extends Error {
  constructor(public readonly code: "WORKSPACE_FORBIDDEN" | "NOT_FOUND", message: string) {
    super(message);
  }
}

export async function authenticatedWorkspaceOwner() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return null;
  return db.user.findUnique({ where: { id: userId } });
}

function serializeSnapshot(payload: WorkspacePayload) {
  return JSON.stringify({ version: 1, view: payload.view, symbol: payload.symbol, timeframe: payload.timeframe, timezone: payload.timezone, createdAt: payload.createdAt });
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
      create: { workspaceId: workspace.id, schemaVersion: 1, payload: serializeSnapshot(payload) },
      update: { schemaVersion: 1, payload: serializeSnapshot(payload) },
      select: { schemaVersion: true, updatedAt: true },
    });
    return { workspace: { id: workspace.id, name: workspace.name, updatedAt: workspace.updatedAt, cloudState }, created: !existing };
  });
}

export async function deleteWorkspace(ownerId: string, id: string) {
  const result = await db.workspace.deleteMany({ where: { id, ownerId } });
  if (!result.count) throw new WorkspaceAccessError("NOT_FOUND", "Workspace not found or unauthorized");
}
