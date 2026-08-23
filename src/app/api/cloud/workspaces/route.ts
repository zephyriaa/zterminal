import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions, cloudSyncConfigured } from "@/lib/auth";
import { db } from "@/lib/db";

const workspacePayload = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(80),
  view: z.enum(["markets", "calendar", "alerts", "chart", "orderflow", "strategy", "backtester", "research", "portfolio", "risk", "journal", "connections", "settings"]),
  symbol: z.string().trim().regex(/^[A-Z0-9]{3,24}$/),
  timeframe: z.enum(["1m", "5m", "15m", "30m", "1h", "4h", "1d"]),
  timezone: z.enum(["America/New_York", "UTC", "Europe/London", "Asia/Dubai"]),
  createdAt: z.number().int().positive(),
});

type WorkspacePayload = z.infer<typeof workspacePayload>;

function unavailable() {
  return NextResponse.json(
    {
      code: "CLOUD_SYNC_UNAVAILABLE",
      message: "Cloud workspace synchronization is not enabled until secure Google OAuth and a durable production database are configured.",
    },
    { status: 503 },
  );
}

async function authenticatedOwner() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) return null;
  return db.user.findUnique({ where: { email } });
}

function serializeSnapshot(payload: WorkspacePayload) {
  return JSON.stringify({
    version: 1,
    view: payload.view,
    symbol: payload.symbol,
    timeframe: payload.timeframe,
    timezone: payload.timezone,
    createdAt: payload.createdAt,
  });
}

/** List only the signed-in user’s named, validated cloud workspaces. */
export async function GET() {
  if (!cloudSyncConfigured) return unavailable();
  const owner = await authenticatedOwner();
  if (!owner) return NextResponse.json({ code: "AUTH_REQUIRED", message: "Sign in with a verified Google account to access cloud workspaces." }, { status: 401 });

  const workspaces = await db.workspace.findMany({
    where: { ownerId: owner.id },
    select: {
      id: true,
      name: true,
      createdAt: true,
      updatedAt: true,
      cloudState: { select: { schemaVersion: true, payload: true, updatedAt: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json({ workspaces });
}

/**
 * Create or update one signed-in user’s cloud workspace. Ownership is checked
 * before mutation so a guessed UUID cannot overwrite another user’s records.
 */
export async function POST(request: NextRequest) {
  if (!cloudSyncConfigured) return unavailable();
  const owner = await authenticatedOwner();
  if (!owner) return NextResponse.json({ code: "AUTH_REQUIRED", message: "Sign in with a verified Google account to synchronize workspaces." }, { status: 401 });

  const parsed = workspacePayload.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ code: "INVALID_WORKSPACE", issues: parsed.error.issues }, { status: 400 });

  const existing = await db.workspace.findUnique({
    where: { id: parsed.data.id },
    select: { id: true, ownerId: true },
  });
  if (existing && existing.ownerId !== owner.id) {
    return NextResponse.json({ code: "WORKSPACE_FORBIDDEN", message: "A cloud workspace belongs to another account." }, { status: 403 });
  }

  const workspace = existing
    ? await db.workspace.update({ where: { id: existing.id }, data: { name: parsed.data.name } })
    : await db.workspace.create({ data: { id: parsed.data.id, ownerId: owner.id, name: parsed.data.name } });

  const cloudState = await db.cloudWorkspaceState.upsert({
    where: { workspaceId: workspace.id },
    create: { workspaceId: workspace.id, schemaVersion: 1, payload: serializeSnapshot(parsed.data) },
    update: { schemaVersion: 1, payload: serializeSnapshot(parsed.data) },
    select: { schemaVersion: true, updatedAt: true },
  });

  return NextResponse.json({ workspace: { id: workspace.id, name: workspace.name, updatedAt: workspace.updatedAt, cloudState } }, { status: existing ? 200 : 201 });
}
