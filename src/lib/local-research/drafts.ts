import type { StateStorage } from "zustand/middleware";

export type DraftStorageStatus = "ready" | "failed" | "conflict";
let status: DraftStorageStatus = "ready";
let pendingWrite: Promise<void> = Promise.resolve();
export async function flushDraftWrites() {
  await pendingWrite;
  if (status !== "ready") throw new Error("Browser save was not confirmed. Export your drafts before closing this tab.");
}
export const getDraftStorageStatus = () => status;
function warn(next: DraftStorageStatus) {
  status = next;
  if (typeof window !== "undefined") window.dispatchEvent(new Event("zterminal:draft-storage-failed"));
}

/** Compare and write in one transaction; a stale tab must never replace local work. */
export function createDraftStorage(): StateStorage {
  let database: Promise<IDBDatabase> | null = null;
  let blocked = false;
  const snapshots = new Map<string, string | null>();
  function open() {
    if (!database) database = new Promise((resolve, reject) => {
      const request = indexedDB.open("zterminal-research-drafts", 1);
      const timer = setTimeout(() => { blocked = true; warn("failed"); reject(new Error("Draft recovery timed out; saved bytes were preserved")); }, 3000);
      request.onupgradeneeded = () => request.result.createObjectStore("drafts");
      request.onsuccess = () => {
        clearTimeout(timer);
        if (blocked) { request.result.close(); reject(new Error("Draft recovery is paused")); return; }
        request.result.onversionchange = () => { request.result.close(); database = null; };
        resolve(request.result);
      };
      request.onerror = () => { clearTimeout(timer); database = null; reject(request.error); };
      request.onblocked = () => { clearTimeout(timer); blocked = true; warn("failed"); reject(new Error("Draft database upgrade blocked")); };
    });
    return database;
  }
  async function write(name: string, value: string | null) {
    if (blocked) return;
    try {
      const db = await open();
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction("drafts", "readwrite");
        const timer = setTimeout(() => { blocked = true; warn("failed"); try { transaction.abort(); } catch { /* Already completed. */ } reject(new Error("Draft write timed out")); }, 3000);
        const store = transaction.objectStore("drafts");
        const request = store.get(name);
        request.onsuccess = () => {
          if (blocked || !snapshots.has(name) || (request.result ?? null) !== snapshots.get(name)) {
            blocked = true; warn("conflict"); transaction.abort(); return;
          }
          try {
            if (value === null) store.delete(name); else store.put(value, name);
          } catch { blocked = true; warn("failed"); transaction.abort(); }
        };
        transaction.oncomplete = () => { clearTimeout(timer); snapshots.set(name, value); resolve(); };
        transaction.onerror = () => { clearTimeout(timer); reject(transaction.error); };
        transaction.onabort = () => { clearTimeout(timer); reject(transaction.error ?? new Error("Draft write interrupted")); };
      });
    } catch { blocked = true; if (status !== "conflict") warn("failed"); }
  }
  return {
    getItem: async name => {
      try {
        const db = await open();
        const value = await new Promise<string | null>((resolve, reject) => {
          const transaction = db.transaction("drafts", "readonly");
          const timer = setTimeout(() => { blocked = true; warn("failed"); try { transaction.abort(); } catch { /* Already completed. */ } reject(new Error("Draft read timed out")); }, 3000);
          const request = transaction.objectStore("drafts").get(name);
          transaction.oncomplete = () => { clearTimeout(timer); resolve(request.result ?? null); };
          transaction.onerror = () => { clearTimeout(timer); reject(transaction.error); };
          transaction.onabort = () => { clearTimeout(timer); reject(transaction.error); };
        });
        if (value !== null) {
          const envelope = JSON.parse(value);
          if (envelope.version !== 1 || !envelope.state?.drafts || typeof envelope.state.drafts !== "object" || Array.isArray(envelope.state.drafts) || Object.entries(envelope.state.drafts).some(([id, draft]) => {
            const record = draft as { id?: string; source?: string; name?: string } | null;
            return !record || record.id !== id || typeof record.source !== "string" || record.source.length > 256_000 || typeof record.name !== "string";
          })) throw new Error("Invalid draft recovery envelope");
        }
        snapshots.set(name, value);
        return value;
      } catch (error) { blocked = true; warn("failed"); throw error; }
    },
    setItem: (name, value) => pendingWrite = pendingWrite.then(() => write(name, value)),
    removeItem: name => pendingWrite = pendingWrite.then(() => write(name, null)),
  };
}
export const draftStorage = createDraftStorage();
