"use client";
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import type { DockPanelId } from "@/lib/workspace-dock-layout";
export type { DockPanelId } from "@/lib/workspace-dock-layout";

export interface WorkspaceDockController {
  openPanel: (panelId: DockPanelId) => void;
  focusPanel: (panelId: DockPanelId) => void;
  resetLayout: () => void;
  activePanelId: DockPanelId | null;
}
type DockActions = Omit<WorkspaceDockController, "activePanelId">;
const Controller = createContext<(WorkspaceDockController & {
  attach: (actions: DockActions | null) => void;
  setActivePanelId: (id: DockPanelId | null) => void;
}) | null>(null);

export function WorkspaceDockProvider({ children }: { children: ReactNode }) {
  const actions = useRef<DockActions | null>(null);
  const pending = useRef<DockPanelId | "reset" | null>(null);
  const [activePanelId, setActivePanelId] = useState<DockPanelId | null>("chart");
  const attach = useCallback((next: DockActions | null) => {
    actions.current = next;
    if (next && pending.current) {
      if (pending.current === "reset") next.resetLayout(); else next.openPanel(pending.current);
      pending.current = null;
    }
  }, []);
  const openPanel = useCallback((id: DockPanelId) => { if (actions.current) actions.current.openPanel(id); else pending.current = id; }, []);
  const resetLayout = useCallback(() => { if (actions.current) actions.current.resetLayout(); else pending.current = "reset"; }, []);
  const value = useMemo(() => ({ openPanel, focusPanel: openPanel, resetLayout, activePanelId, setActivePanelId, attach }), [openPanel, resetLayout, activePanelId, attach]);
  return <Controller.Provider value={value}>{children}</Controller.Provider>;
}
export function useWorkspaceDock() {
  const controller = useContext(Controller);
  if (!controller) throw new Error("WorkspaceDockProvider is missing");
  return controller;
}
