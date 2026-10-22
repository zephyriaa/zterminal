import { legacyWorkspace, summarize, workspaceSnapshotSchema, type WorkspaceRecord, type WorkspaceSnapshot, type WorkspaceSummary } from "./model";

let database: Promise<IDBDatabase> | null = null;
function open() {
  return database ??= new Promise((resolve, reject) => {
    const request = indexedDB.open("zterminal-workspaces", 1);
    let expired = false;
    const timer = setTimeout(() => { expired = true; database = null; reject(new Error("Workspace storage timed out. Close other ZTerminal tabs and retry.")); }, 5000);
    request.onupgradeneeded = () => {
      request.result.createObjectStore("records", { keyPath: "snapshot.id" });
      request.result.createObjectStore("summaries", { keyPath: "id" });
      request.result.createObjectStore("meta");
    };
    request.onsuccess = () => { clearTimeout(timer); if (expired) { request.result.close(); return; } request.result.onversionchange = () => { request.result.close(); database = null; }; resolve(request.result); };
    request.onerror = () => { clearTimeout(timer); database = null; reject(new Error("Workspace storage is unavailable. Allow browser storage and retry.")); };
    request.onblocked = () => { clearTimeout(timer); database = null; reject(new Error("Workspace storage is blocked by another tab. Close it and retry.")); };
  });
}
async function read<T>(store: string, key?: string): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readonly"), object = tx.objectStore(store);
    const request = key === undefined ? object.getAll() : object.get(key);
    tx.oncomplete = () => resolve(request.result as T);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error("Workspace read interrupted"));
  });
}
export const getWorkspace = (id: string) => read<WorkspaceRecord | undefined>("records", id);
export const getMigrationBackup = () => read<Record<string, string> | undefined>("meta", "legacy-backup");
export const listLocalWorkspaces = async (ownerId: string | null) => (await read<WorkspaceSummary[]>("summaries")).filter(item => item.ownerId === null || item.ownerId === ownerId);

/** One transaction per workspace; editing another tab cannot replace the catalog or another record. */
export async function updateWorkspace(id: string, update: (current: WorkspaceRecord | undefined) => WorkspaceRecord | null) {
  const db = await open();
  const result = await new Promise<WorkspaceRecord | null>((resolve, reject) => {
    const tx = db.transaction(["records", "summaries"], "readwrite");
    const store = tx.objectStore("records"), request = store.get(id);
    let next: WorkspaceRecord | null = null, failure: unknown;
    request.onsuccess = () => {
      try {
        next = update(request.result);
        if (next) {
          next.snapshot = workspaceSnapshotSchema.parse(next.snapshot);
          if (next.snapshot.id !== id) throw new Error("Workspace identity changed during save");
          store.put(next); tx.objectStore("summaries").put(summarize(next));
        } else { store.delete(id); tx.objectStore("summaries").delete(id); }
      } catch (error) { failure = error; tx.abort(); }
    };
    tx.oncomplete = () => resolve(next);
    tx.onerror = () => reject(failure ?? tx.error);
    tx.onabort = () => reject(failure ?? tx.error ?? new Error("Workspace save interrupted"));
  });
  announceWorkspaceChange(id);
  return result;
}
export function announceWorkspaceChange(id: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("zterminal:workspace-catalog"));
  if (typeof BroadcastChannel !== "undefined") { const channel = new BroadcastChannel("zterminal-workspaces"); channel.postMessage({ type: "changed", id }); channel.close(); }
}
export const createWorkspace = (snapshot: WorkspaceSnapshot, importedDrafts?: WorkspaceRecord["importedDrafts"]) => updateWorkspace(snapshot.id, current => {
  if (current) throw new Error("A workspace with this ID already exists");
  return { snapshot, ...(importedDrafts ? { importedDrafts } : {}), updatedAt: Date.now(), lastOpenedAt: 0, ownerId: null, cloudRevision: null, dirty: false };
});

export async function migrateLegacyWorkspaces() {
  const db = await open();
  const migrated = await read<{ skipped: number } | undefined>("meta", "legacy-migrated");
  if (migrated) return migrated;
  const sources = ["zterminal-workspace", "zterminal.chart-documents", "zt_workspace_layout_v2", "zterminal.multi-chart.v1", "zterminal.studies"];
  const backup: Record<string, string> = {};
  for (const key of sources) { const value = localStorage.getItem(key); if (value !== null) backup[key] = value; }
  const parse = (key: string) => { try { return JSON.parse(backup[key] ?? "null")?.state ?? {}; } catch { return {}; } };
  const state = parse("zterminal-workspace"), charts = parse("zterminal.chart-documents");
  const records: WorkspaceRecord[] = [];
  let legacyResearch: unknown = null;
  if (Object.keys(backup).length) legacyResearch = await new Promise(resolve => {
    const request = indexedDB.open("zterminal-research-drafts", 1);
    request.onupgradeneeded = () => { request.transaction?.abort(); };
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
    request.onsuccess = () => {
      const old = request.result;
      if (!old.objectStoreNames.contains("drafts")) { old.close(); resolve(null); return; }
      const tx = old.transaction("drafts", "readonly"), data = tx.objectStore("drafts").get("research-drafts-v1");
      tx.oncomplete = () => { old.close(); try { const state = JSON.parse(data.result ?? "null")?.state; resolve(state?.config ? { activeId: state.activeId ?? "", config: state.config, params: state.params ?? {}, minimap: Boolean(state.minimap) } : null); } catch { resolve(null); } };
      tx.onerror = () => { old.close(); resolve(null); };
    };
  });
  const documents = charts.documents && typeof charts.documents === "object" ? Object.values(charts.documents) as { workspaceId: string }[] : [];
  const named = Array.isArray(state.workspaces) ? state.workspaces : [];
  const active = typeof state.activeWorkspaceId === "string" ? state.activeWorkspaceId : "local-default";
  let skipped = 0;
  for (const saved of named) {
    const snapshot = legacyWorkspace(saved, null);
    if (!snapshot) { skipped++; continue; }
    snapshot.chartDocuments = documents.filter(d => d.workspaceId === snapshot.id).length ? documents.filter(d => d.workspaceId === snapshot.id) : snapshot.chartDocuments;
    records.push({ snapshot, ownerId: null, cloudRevision: null, dirty: false, updatedAt: snapshot.createdAt, lastOpenedAt: 0 });
  }
  // Cloud-only state must not become a local workspace visible to the next signed-out user.
  const privateCloud = charts.workspaceOwners?.[active] && !records.some(r => r.snapshot.id === active);
  if (Object.keys(backup).length && !privateCloud) {
    let current = records.find(r => r.snapshot.id === active);
    if (!current) {
      const snapshot = legacyWorkspace({ ...state, id: crypto.randomUUID(), name: "Recovered workspace", view: "chart", symbol: state.symbol ?? "BTCUSDT", timeframe: state.timeframe ?? "5m", timezone: state.timezone ?? "UTC", createdAt: Date.now() }, state.marketProvider ?? null);
      if (snapshot) { current = { snapshot, ownerId: null, cloudRevision: null, dirty: false, updatedAt: Date.now(), lastOpenedAt: Date.now() }; records.push(current); }
      else skipped++;
    }
    if (current) {
      const snapshot = current.snapshot;
      snapshot.marketProvider = state.marketProvider ?? snapshot.marketProvider;
      snapshot.chartDocuments = documents.filter(d => d.workspaceId === active);
      snapshot.sidebarCollapsed = Boolean(state.sidebarCollapsed);
      try { snapshot.dockLayout = JSON.parse(backup.zt_workspace_layout_v2 ?? "null"); } catch { /* Original bytes remain in backup. */ }
      const multi = parse("zterminal.multi-chart.v1");
      const withMulti = workspaceSnapshotSchema.safeParse({ ...snapshot, multiChart: multi });
      if (withMulti.success) snapshot.multiChart = withMulti.data.multiChart;
      const studies = parse("zterminal.studies").instances;
      if (Array.isArray(studies)) snapshot.studies = studies.slice(0, 50);
      const research = workspaceSnapshotSchema.safeParse({ ...snapshot, research: legacyResearch });
      if (research.success) snapshot.research = research.data.research;
    }
  }
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(["records", "summaries", "meta"], "readwrite");
    const meta = tx.objectStore("meta"), done = meta.get("legacy-migrated");
    done.onsuccess = () => {
      if (done.result) return;
      meta.put(backup, "legacy-backup");
      for (const record of records) {
        // A partially completed older import never overwrites work created since then.
        const request = tx.objectStore("records").get(record.snapshot.id);
        request.onsuccess = () => { if (!request.result) { tx.objectStore("records").put(record); tx.objectStore("summaries").put(summarize(record)); } };
      }
      meta.put({ skipped, at: Date.now() }, "legacy-migrated");
    };
    tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
  });
  return read<{ skipped: number }>("meta", "legacy-migrated");
}
