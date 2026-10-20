/** A browser lock owns editing; takeover is cooperative so pending writes can finish first. */
export function workspaceEditLock(id: string, changed: (editing: boolean) => void, flush: () => Promise<void>) {
  let editing = false, closed = false, release: (() => void) | null = null;
  let waiting: { resolve: () => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> } | null = null;
  const channel = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel(`zterminal-workspace-editor:${id}`);
  const acquire = () => new Promise<boolean>((resolve, reject) => {
    if (!navigator.locks || !channel) { changed(false); resolve(false); return; }
    void navigator.locks.request(`zterminal-workspace:${id}`, { ifAvailable: true }, async lock => {
      if (!lock || closed) { resolve(false); return; }
      editing = true; changed(true); resolve(true);
      await new Promise<void>(done => { release = done; });
      release = null;
    }).catch(reject);
  });
  if (channel) channel.onmessage = async event => {
    if (event.data?.type === "takeover" && editing) {
      try {
        await flush();
        editing = false; changed(false); release?.();
        channel.postMessage({ type: "released" });
      } catch { channel.postMessage({ type: "failed", message: "The other tab has unsaved work. Save or export it before taking over." }); }
    } else if (waiting && ["released", "failed"].includes(event.data?.type)) {
      const request = waiting; waiting = null; clearTimeout(request.timer);
      if (event.data.type === "failed") request.reject(new Error(event.data.message)); else request.resolve();
    }
  };
  return {
    ready: acquire(),
    owns: () => editing && !closed,
    async takeover() {
      if (await acquire()) return;
      if (!channel || !navigator.locks) throw new Error("This browser cannot coordinate editing. Use a current browser with Web Locks support.");
      await new Promise<void>((resolve, reject) => {
        waiting = { resolve, reject, timer: setTimeout(() => { waiting = null; reject(new Error("The editing tab did not respond. Close that tab, then try again.")); }, 5000) };
        channel.postMessage({ type: "takeover" });
      });
      if (!await acquire()) throw new Error("Another tab acquired editing first. Try again.");
    },
    close() { closed = true; editing = false; release?.(); channel?.close(); if (waiting) { clearTimeout(waiting.timer); waiting.reject(new Error("Workspace closed")); waiting = null; } },
  };
}

export async function editClosedWorkspace<T>(id: string, operation: () => Promise<T>): Promise<T> {
  if (!navigator.locks) throw new Error("This browser cannot safely coordinate workspace changes.");
  return navigator.locks.request(`zterminal-workspace:${id}`, { ifAvailable: true }, lock => {
    if (!lock) throw new Error("This workspace is open in another tab. Close it before renaming or deleting it.");
    return operation();
  });
}
