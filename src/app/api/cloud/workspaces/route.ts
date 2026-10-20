import { NextRequest, NextResponse } from "next/server";
import { cloudSyncConfigured } from "@/lib/auth";
import { isSameOriginMutation } from "@/lib/auth-policy";
import { parseCloudWorkspace } from "@/lib/workspace-payload";
import {
  authenticatedWorkspaceOwner,
  deleteWorkspace,
  listWorkspaces,
  saveWorkspace,
  WorkspaceAccessError,
  workspacePayloadSchema,
} from "@/server/workspaces/dal";

function unavailable() {
  return NextResponse.json(
    {
      code: "CLOUD_SYNC_UNAVAILABLE",
      message: "Cloud workspace synchronization is disabled until Google OAuth, a session secret, and PostgreSQL are configured.",
    },
    { status: 503 },
  );
}

async function ownerOrResponse() {
  if (!cloudSyncConfigured) return { response: unavailable() } as const;
  try {
    const owner = await authenticatedWorkspaceOwner();
    if (!owner) return { response: NextResponse.json({ code: "AUTH_REQUIRED", message: "Sign in with a verified Google account to access cloud workspaces." }, { status: 401 }) } as const;
    return { owner } as const;
  } catch {
    return { response: NextResponse.json({ code: "SESSION_UNAVAILABLE", message: "Your session could not be verified. Try again shortly." }, { status: 503 }) } as const;
  }
}

/** List only the signed-in user's named, validated cloud workspaces. */
export async function GET(request?: NextRequest) {
  const access = await ownerOrResponse();
  if ("response" in access) return access.response;
  try {
    const params = request ? new URL(request.url).searchParams : null;
    const id = params?.get("id") ?? undefined;
    const workspaces = await listWorkspaces(access.owner.id, id);
    if (id && !workspaces.length) return NextResponse.json({ code: "NOT_FOUND", message: "Workspace not found or unavailable to this account." }, { status: 404 });
    if (params?.get("summary") === "1") return NextResponse.json({ workspaces: workspaces.map(entry => {
      const snapshot = parseCloudWorkspace(entry);
      return { id: entry.id, name: entry.name, starter: snapshot?.version === 3 ? snapshot.starter : "chart", symbol: snapshot?.symbol ?? "", timeframe: snapshot?.timeframe ?? "", marketProvider: snapshot?.version === 3 ? snapshot.marketProvider : null, updatedAt: entry.updatedAt.getTime(), lastOpenedAt: 0, ownerId: access.owner.id, dirty: false };
    }) });
    return NextResponse.json({ workspaces });
  } catch (error) {
    return NextResponse.json({ code: "DB_ERROR", message: "Cloud workspaces are temporarily unavailable." }, { status: 503 });
  }
}

/** Create/update only an owned workspace. A guessed UUID cannot cross owners. */
export async function POST(request: NextRequest) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ code: "INVALID_ORIGIN" }, { status: 403 });
  const access = await ownerOrResponse();
  if ("response" in access) return access.response;
  const text = await request.text();
  if (text.length > 8_000_000) return NextResponse.json({ code: "WORKSPACE_TOO_LARGE" }, { status: 413 });
  let body: Record<string, unknown> | null = null;
  try { body = JSON.parse(text); } catch { /* Validated below. */ }
  const parsed = workspacePayloadSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ code: "INVALID_WORKSPACE", issues: parsed.error.issues }, { status: 400 });
  try {
    if (parsed.data.version === 3 && body?.expectedRevision !== null && (!Number.isSafeInteger(body?.expectedRevision) || (body!.expectedRevision as number) < 0)) return NextResponse.json({ code: "INVALID_REVISION" }, { status: 400 });
    const saved = await saveWorkspace(access.owner.id, parsed.data, body?.expectedRevision as number | null | undefined);
    return NextResponse.json({ workspace: saved.workspace }, { status: saved.created ? 201 : 200 });
  } catch (error) {
    if (error instanceof WorkspaceAccessError) return NextResponse.json({ code: error.code, message: error.message }, { status: error.code === "REVISION_CONFLICT" ? 409 : 403 });
    return NextResponse.json({ code: "DB_ERROR", message: "Cloud save is temporarily unavailable. Your local workspace remains available." }, { status: 503 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ code: "INVALID_ORIGIN" }, { status: 403 });
  const access = await ownerOrResponse();
  if ("response" in access) return access.response;
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ code: "MISSING_ID", message: "Workspace ID is required" }, { status: 400 });
  try {
    await deleteWorkspace(access.owner.id, id);
    return NextResponse.json({ success: true, deletedId: id });
  } catch (error) {
    if (error instanceof WorkspaceAccessError) return NextResponse.json({ code: error.code, message: error.message }, { status: 404 });
    return NextResponse.json({ code: "DB_ERROR", message: "Cloud deletion is temporarily unavailable." }, { status: 503 });
  }
}
