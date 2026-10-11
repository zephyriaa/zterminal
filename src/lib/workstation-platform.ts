import { invoke } from "@tauri-apps/api/core";
import type { Bar } from "./market/types";

// IPC projection of zt-domain documents. Rust owns validation and persistence.
export interface LocalWorkspace {
  document: { version: 2; id: string; revision: number; name: string };
  chart: { version: 3; id: string; revision: number; intervalMs: number; visibleFromMs: number | null; visibleToMs: number | null };
  dataset: null | { symbol: string; sourceName: string; source: { sha256: string; bytes: number }; intervalMs: number; fromMs: number; count: number; tickSize: number; quantityStep: number; importedAtMs: number };
}
export interface LocalSummary { id: string; name: string; revision: number }
export interface LocalImport { csv: string; sourceName: string; symbol: string; intervalMs: number; tickSize: number; quantityStep: number }
export interface ShellPreferences { version: 1; material: "rich" | "reduced" | "opaque"; reducedMotion: boolean; density: "compact" | "comfortable"; gridPercent: number }
export const defaultShellPreferences: ShellPreferences = { version: 1, material: "rich", reducedMotion: false, density: "compact", gridPercent: 7 };
// Explicit platform boundary requested by this migration; no web provider effects.
export interface WorkstationPlatform {
  list(): Promise<LocalSummary[]>; restore(): Promise<LocalWorkspace | null>;
  open(id: string): Promise<LocalWorkspace>; create(id: string, name: string): Promise<LocalWorkspace>;
  save(workspace: LocalWorkspace, name: string, from: number | null, to: number | null): Promise<LocalWorkspace>;
  import(workspace: LocalWorkspace, input: LocalImport): Promise<LocalWorkspace>;
  scene(id: string, first: number, count: number): Promise<Bar[]>;
  preferences(): Promise<ShellPreferences>;
  savePreferences(preferences: ShellPreferences): Promise<ShellPreferences>;
}
export const localPlatform: WorkstationPlatform = {
  list: () => invoke("list_workspaces"), restore: () => invoke("restore_workspace"),
  open: id => invoke("open_workspace", { id }), create: (id, name) => invoke("create_workspace", { id, name }),
  save: (w, name, from, to) => invoke("save_workspace", { id: w.document.id, revision: w.document.revision, name, from, to }),
  import: (w, input) => invoke("import_history", { id: w.document.id, revision: w.document.revision, input }),
  scene: (id, first, count) => invoke("load_scene", { id, first, count }),
  preferences: () => invoke("get_shell_preferences"),
  savePreferences: preferences => invoke("save_shell_preferences", { preferences }),
};
