import { legacyWorkspace, workspaceSnapshotSchema, type WorkspaceRecord, type WorkspaceSnapshot, type WorkspaceSummary } from "./model";

export class WorkspaceCloudError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
async function request(path: string, options?: RequestInit) {
  const response = await fetch(`/api/cloud/workspaces${path}`, { credentials: "same-origin", cache: "no-store", signal: AbortSignal.timeout(20000), ...options });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new WorkspaceCloudError(body.message ?? "Cloud synchronization is unavailable. Your local changes are retained.", response.status);
  return body;
}
export async function cloudWorkspaceSummaries(): Promise<WorkspaceSummary[]> {
  return (await request("?summary=1")).workspaces;
}
export async function fetchCloudWorkspace(id: string, ownerId: string): Promise<WorkspaceRecord> {
  const body = await request(`?id=${encodeURIComponent(id)}`);
  const entry = body.workspaces?.[0];
  if (!entry || entry.id !== id || !entry.cloudState?.payload) throw new Error("This workspace has no restorable snapshot.");
  const data = JSON.parse(entry.cloudState.payload);
  const snapshot = data.version === 3 ? workspaceSnapshotSchema.parse(data) : legacyWorkspace({ ...data, id: entry.id, name: entry.name });
  if (!snapshot || snapshot.id !== id) throw new Error("This workspace snapshot is incompatible. Its saved data has not been replaced.");
  return { snapshot, ownerId, cloudRevision: data.version === 3 ? data.revision : 0, dirty: false, updatedAt: Date.parse(entry.updatedAt), lastOpenedAt: 0 };
}
export async function saveCloudWorkspace(snapshot: WorkspaceSnapshot, expectedRevision: number | null): Promise<number> {
  const result = await request("", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...snapshot, expectedRevision }) });
  const revision = result.workspace?.cloudState?.revision;
  if (!Number.isSafeInteger(revision) || revision < 1) throw new Error("Cloud save was not confirmed. Local changes are retained.");
  return revision;
}
export async function removeCloudWorkspace(id: string) { await request(`?id=${encodeURIComponent(id)}`, { method: "DELETE" }); }
