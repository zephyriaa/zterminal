import { NextRequest, NextResponse } from "next/server";
import { cloudSyncConfigured } from "@/lib/auth";
import { isSameOriginMutation } from "@/lib/auth-policy";
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
export async function GET() {
  const access = await ownerOrResponse();
  if ("response" in access) return access.response;
  try {
    return NextResponse.json({ workspaces: await listWorkspaces(access.owner.id) });
  } catch (error) {
    return NextResponse.json({ code: "DB_ERROR", message: "Cloud workspaces are temporarily unavailable." }, { status: 503 });
  }
}

/** Create/update only an owned workspace. A guessed UUID cannot cross owners. */
export async function POST(request: NextRequest) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ code: "INVALID_ORIGIN" }, { status: 403 });
  const access = await ownerOrResponse();
  if ("response" in access) return access.response;
  const parsed = workspacePayloadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ code: "INVALID_WORKSPACE", issues: parsed.error.issues }, { status: 400 });
  try {
    const saved = await saveWorkspace(access.owner.id, parsed.data);
    return NextResponse.json({ workspace: saved.workspace }, { status: saved.created ? 201 : 200 });
  } catch (error) {
    if (error instanceof WorkspaceAccessError) return NextResponse.json({ code: error.code, message: error.message }, { status: 403 });
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
