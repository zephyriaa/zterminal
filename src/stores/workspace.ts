"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ViewId =
  | "markets"
  | "calendar"
  | "alerts"
  | "chart"
  | "orderflow"
  | "strategy"
  | "backtester"
  | "research"
  | "portfolio"
  | "risk"
  | "journal"
  | "connections"
  | "settings";

export interface SavedWorkspace {
  id: string;
  name: string;
  view: ViewId;
  symbol: string;
  timeframe: string;
  createdAt: number;
}

interface WorkspaceState {
  activeView: ViewId;
  setView: (v: ViewId) => void;

  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebar: (collapsed: boolean) => void;

  symbol: string;
  setSymbol: (s: string) => void;

  timeframe: string;
  setTimeframe: (tf: string) => void;

  commandOpen: boolean;
  setCommandOpen: (o: boolean) => void;

  // Market data connection (mock by default)
  connection: {
    state: "connected" | "connecting" | "reconnecting" | "disconnected" | "degraded";
    provider: "mock" | "rithmic-test" | "rithmic-prod";
    environment: "simulation" | "paper" | "live";
    dataStatus: "SIMULATED" | "LIVE" | "HISTORICAL" | "DELAYED" | "DISCONNECTED";
  };
  setConnection: (c: Partial<WorkspaceState["connection"]>) => void;

  workspaces: SavedWorkspace[];
  saveWorkspace: (name: string) => void;
  loadWorkspace: (id: string) => void;

  lastBacktestId: string | null;
  setLastBacktest: (id: string | null) => void;
}

export const useWorkspace = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      activeView: "chart",
      setView: (v) => set({ activeView: v }),

      sidebarCollapsed: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebar: (collapsed) => set({ sidebarCollapsed: collapsed }),

      symbol: "NQ",
      setSymbol: (s) => set({ symbol: s }),

      timeframe: "5m",
      setTimeframe: (tf) => set({ timeframe: tf }),

      commandOpen: false,
      setCommandOpen: (o) => set({ commandOpen: o }),

      connection: {
        state: "connecting",
        provider: "mock",
        environment: "simulation",
        dataStatus: "SIMULATED",
      },
      setConnection: (c) =>
        set((s) => ({ connection: { ...s.connection, ...c } })),

      workspaces: [],
      saveWorkspace: (name) => {
        const s = get();
        const ws: SavedWorkspace = {
          id: crypto.randomUUID(),
          name,
          view: s.activeView,
          symbol: s.symbol,
          timeframe: s.timeframe,
          createdAt: Date.now(),
        };
        set({ workspaces: [...s.workspaces, ws] });
      },
      loadWorkspace: (id) => {
        const ws = get().workspaces.find((w) => w.id === id);
        if (!ws) return;
        set({
          activeView: ws.view,
          symbol: ws.symbol,
          timeframe: ws.timeframe,
        });
      },

      lastBacktestId: null,
      setLastBacktest: (id) => set({ lastBacktestId: id }),
    }),
    {
      name: "zterminal-workspace",
      partialize: (s) => ({
        sidebarCollapsed: s.sidebarCollapsed,
        symbol: s.symbol,
        timeframe: s.timeframe,
        workspaces: s.workspaces,
      }),
    }
  )
);
