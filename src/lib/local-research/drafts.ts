import type { StateStorage } from "zustand/middleware";
let database: Promise<IDBDatabase> | null = null;
function open() {
  if (!database) database = new Promise((resolve, reject) => {
    const request = indexedDB.open("zterminal-research-drafts", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("drafts");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { database = null; reject(request.error); };
  });
  return database;
}
async function operation(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest) {
  const db = await open();
  return new Promise<unknown>((resolve, reject) => {
    const transaction = db.transaction("drafts", mode);
    const request = action(transaction.objectStore("drafts"));
    transaction.oncomplete = () => resolve(request.result);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error ?? new Error("Draft write interrupted"));
  });
}
function warn() { if (typeof window !== "undefined") window.dispatchEvent(new Event("zterminal:draft-storage-failed")); }
export const draftStorage: StateStorage = {
  getItem: async name => { try { return (await operation("readonly", store => store.get(name))) as string | null ?? null; } catch { warn(); return null; } },
  setItem: async (name, value) => { try { await operation("readwrite", store => store.put(value, name)); } catch { warn(); } },
  removeItem: async name => { try { await operation("readwrite", store => store.delete(name)); } catch { warn(); } },
};
