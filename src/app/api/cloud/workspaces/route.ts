import { NextRequest, NextResponse } from "next/server";
import { cloudSyncConfigured } from "@/lib/auth";
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
  const owner = await authenticatedWorkspaceOwner();
  if (!owner) return { response: NextResponse.json({ code: "AUTH_REQUIRED", message: "Sign in with a verified Google account to access cloud workspaces." }, { status: 401 }) } as const;
  return { owner } as const;
}

/** List only the signed-in user's named, validated cloud workspaces. */
export async function GET() {
  const access = await ownerOrResponse();
  if ("response" in access) return access.response;
  try {
    return NextResponse.json({ workspaces: await listWorkspaces(access.owner.id) });
  } catch (error) {
    return NextResponse.json({ code: "DB_ERROR", message: error instanceof Error ? error.message : "Failed to load cloud workspaces" }, { status: 500 });
  }
}

/** Create/update only an owned workspace. A guessed UUID cannot cross owners. */
export async function POST(request: NextRequest) {
  const access = await ownerOrResponse();
  if ("response" in access) return access.response;
  const parsed = workspacePayloadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ code: "INVALID_WORKSPACE", issues: parsed.error.issues }, { status: 400 });
  try {
    const saved = await saveWorkspace(access.owner.id, parsed.data);
    return NextResponse.json({ workspace: saved.workspace }, { status: saved.created ? 201 : 200 });
  } catch (error) {
    if (error instanceof WorkspaceAccessError) return NextResponse.json({ code: error.code, message: error.message }, { status: 403 });
    return NextResponse.json({ code: "DB_ERROR", message: error instanceof Error ? error.message : "Failed to save cloud workspace" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const access = await ownerOrResponse();
  if ("response" in access) return access.response;
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ code: "MISSING_ID", message: "Workspace ID is required" }, { status: 400 });
  try {
    await deleteWorkspace(access.owner.id, id);
    return NextResponse.json({ success: true, deletedId: id });
  } catch (error) {
    if (error instanceof WorkspaceAccessError) return NextResponse.json({ code: error.code, message: error.message }, { status: 404 });
    return NextResponse.json({ code: "DB_ERROR", message: error instanceof Error ? error.message : "Failed to delete workspace" }, { status: 500 });
  }
}
