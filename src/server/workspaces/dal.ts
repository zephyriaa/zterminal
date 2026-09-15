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
  const email = session?.user?.email;
  if (!email) return null;
  return db.user.upsert({
    where: { email },
    update: { name: session.user?.name ?? undefined, image: session.user?.image ?? undefined },
    create: { email, name: session.user?.name ?? "Research Analyst", image: session.user?.image ?? null, emailVerified: new Date() },
  });
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
  const existing = await db.workspace.findUnique({ where: { id: payload.id }, select: { id: true, ownerId: true } });
  if (existing && existing.ownerId !== ownerId) throw new WorkspaceAccessError("WORKSPACE_FORBIDDEN", "A cloud workspace belongs to another account.");
  const workspace = existing
    ? await db.workspace.update({ where: { id: existing.id }, data: { name: payload.name } })
    : await db.workspace.create({ data: { id: payload.id, ownerId, name: payload.name } });
  const cloudState = await db.cloudWorkspaceState.upsert({
    where: { workspaceId: workspace.id },
    create: { workspaceId: workspace.id, schemaVersion: 1, payload: serializeSnapshot(payload) },
    update: { schemaVersion: 1, payload: serializeSnapshot(payload) },
    select: { schemaVersion: true, updatedAt: true },
  });
  return { workspace: { id: workspace.id, name: workspace.name, updatedAt: workspace.updatedAt, cloudState }, created: !existing };
}

export async function deleteWorkspace(ownerId: string, id: string) {
  const existing = await db.workspace.findUnique({ where: { id }, select: { id: true, ownerId: true } });
  if (!existing || existing.ownerId !== ownerId) throw new WorkspaceAccessError("NOT_FOUND", "Workspace not found or unauthorized");
  await db.$transaction([
    db.cloudWorkspaceState.deleteMany({ where: { workspaceId: id } }),
    db.workspace.delete({ where: { id } }),
  ]);
}
