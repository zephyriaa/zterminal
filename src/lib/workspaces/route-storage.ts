import type { StateStorage } from "zustand/middleware";

export function isWorkspaceRoute() {
  return typeof window !== "undefined" && /^\/workspaces(?:\/|$)/.test(window.location?.pathname ?? "");
}
/** Old stores stay usable in native/legacy entrypoints; routed work never writes their shared keys. */
export const legacyWorkspaceStorage: StateStorage = {
  getItem: name => isWorkspaceRoute() || typeof localStorage === "undefined" ? null : localStorage.getItem(name),
  setItem: (name, value) => { if (!isWorkspaceRoute() && typeof localStorage !== "undefined") localStorage.setItem(name, value); },
  removeItem: name => { if (!isWorkspaceRoute() && typeof localStorage !== "undefined") localStorage.removeItem(name); },
};
