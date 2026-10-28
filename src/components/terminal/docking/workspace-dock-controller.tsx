"use client";
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import type { DockPanelId } from "@/lib/workspace-dock-layout";
import { useMultiChart, type MultiChartLayout } from "@/stores/multi-chart";
import type { SerializedDockview } from "dockview-core";
export type { DockPanelId } from "@/lib/workspace-dock-layout";

export interface WorkspaceDockController {
  openPanel: (panelId: DockPanelId) => void;
  focusPanel: (panelId: DockPanelId) => void;
  resetLayout: () => void;
  getLayout: () => SerializedDockview | null;
  restoreLayout: (layout: unknown) => void;
  useStarter: (starter: "chart" | "research" | "orderflow") => void;
  rememberLayout: () => void;
  undoLayout: () => void;
  canUndoLayout: boolean;
  activePanelId: DockPanelId | null;
}
type DockActions = Omit<WorkspaceDockController, "activePanelId" | "rememberLayout" | "undoLayout" | "canUndoLayout">;
const Controller = createContext<(WorkspaceDockController & {
  attach: (actions: DockActions | null) => void;
  setActivePanelId: (id: DockPanelId | null) => void;
}) | null>(null);

export function WorkspaceDockProvider({ children }: { children: ReactNode }) {
  const actions = useRef<DockActions | null>(null);
  const previous = useRef<{ layout: SerializedDockview; multiLayout: MultiChartLayout } | null>(null);
  const [canUndoLayout, setCanUndoLayout] = useState(false);
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
  const getLayout = useCallback(() => actions.current?.getLayout() ?? null, []);
  const restoreLayout = useCallback((layout: unknown) => actions.current?.restoreLayout(layout), []);
  const useStarter = useCallback((starter: "chart" | "research" | "orderflow") => actions.current?.useStarter(starter), []);
  const rememberLayout = useCallback(() => { const layout = actions.current?.getLayout(); if (layout) { previous.current = { layout, multiLayout: useMultiChart.getState().layout }; setCanUndoLayout(true); } }, []);
  const undoLayout = useCallback(() => { if (previous.current) { actions.current?.restoreLayout(previous.current.layout); useMultiChart.getState().setLayout(previous.current.multiLayout); previous.current = null; setCanUndoLayout(false); } }, []);
  const value = useMemo(() => ({ openPanel, focusPanel: openPanel, resetLayout, getLayout, restoreLayout, useStarter, rememberLayout, undoLayout, canUndoLayout, activePanelId, setActivePanelId, attach }), [openPanel, resetLayout, getLayout, restoreLayout, useStarter, rememberLayout, undoLayout, canUndoLayout, activePanelId, attach]);
  return <Controller.Provider value={value}>{children}</Controller.Provider>;
}
export function useWorkspaceDock() {
  const controller = useContext(Controller);
  if (!controller) throw new Error("WorkspaceDockProvider is missing");
  return controller;
}
