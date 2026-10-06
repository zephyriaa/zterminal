"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useCloudSyncStatus } from "@/stores/cloud-sync-status";
import type { DataStatus, Environment, ProviderId } from "@/lib/market/types";
import { useChartDocuments } from "@/stores/chart-documents";
import { workspaceChartDocuments } from "@/lib/chart/workspace-snapshot";
import type { ChartDocument } from "@/lib/chart/contracts";

export type ChartTimezone = "America/New_York" | "UTC" | "Europe/London" | "Asia/Tokyo" | "Asia/Dubai" | "local";

export type ViewId =
  | "markets"
  | "calendar"
  | "alerts"
  | "chart"
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
  timezone: ChartTimezone;
  createdAt: number;
  chartDocuments?: ChartDocument[];
}

interface WorkspaceState {
  activeWorkspaceId: string;
  activeView: ViewId;
  setView: (v: ViewId) => void;

  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebar: (collapsed: boolean) => void;

  symbol: string;
  setSymbol: (s: string) => void;

  timeframe: string;
  setTimeframe: (tf: string) => void;

  timezone: ChartTimezone;
  setTimezone: (timezone: ChartTimezone) => void;

  commandOpen: boolean;
  setCommandOpen: (o: boolean) => void;

  // Market data connection (mock by default). Provider identity stays canonical.
  connection: {
    state: "connected" | "connecting" | "reconnecting" | "stale" | "disconnected" | "degraded" | "unavailable";
    provider: ProviderId;
    environment: Environment;
    dataStatus: DataStatus;
  };
  setConnection: (c: Partial<WorkspaceState["connection"]>) => void;

  workspaces: SavedWorkspace[];
  cloudWorkspaces: SavedWorkspace[];
  cloudAuthenticated: boolean;
  setCloudAuthenticated: (authenticated: boolean) => void;
  suspendCloudAuthentication: () => void;
  saveWorkspace: (name: string) => void;
  loadWorkspace: (id: string) => void;
  mergeCloudWorkspaces: (workspaces: SavedWorkspace[]) => void;

  lastBacktestId: string | null;
  setLastBacktest: (id: string | null) => void;
}

const P0_DEFAULT_SYMBOL = "BTCUSDT";
const P0_TIMEFRAMES = new Set(["1m", "5m", "15m", "30m", "1h", "4h", "1d"]);

type PersistedWorkspace = Partial<Pick<WorkspaceState, "activeWorkspaceId" | "sidebarCollapsed" | "symbol" | "timeframe" | "timezone" | "workspaces">>;

const SUPPORTED_TIMEZONES = new Set<ChartTimezone>(["America/New_York", "UTC", "Europe/London", "Asia/Tokyo", "Asia/Dubai", "local"]);

function migratePersistedWorkspace(value: unknown): PersistedWorkspace {
  const persisted = (value ?? {}) as PersistedWorkspace;
  const timeframe = typeof persisted.timeframe === "string" && P0_TIMEFRAMES.has(persisted.timeframe)
    ? persisted.timeframe
    : "5m";
  const timezone = typeof persisted.timezone === "string" && SUPPORTED_TIMEZONES.has(persisted.timezone as ChartTimezone)
    ? persisted.timezone as ChartTimezone
    : "America/New_York";
  const workspaces = Array.isArray(persisted.workspaces)
      ? persisted.workspaces.map((workspace) => ({
        ...workspace,
        view: ["orderflow", "gex"].includes(workspace.view as string) ? "chart" : workspace.view,
        symbol: P0_DEFAULT_SYMBOL,
        timeframe: P0_TIMEFRAMES.has(workspace.timeframe) ? workspace.timeframe : "5m",
        timezone: SUPPORTED_TIMEZONES.has(workspace.timezone as ChartTimezone) ? workspace.timezone : timezone,
      }))
    : [];
  const activeWorkspaceId = typeof persisted.activeWorkspaceId === "string" && (persisted.activeWorkspaceId === "local-default" || workspaces.some(workspace => workspace.id === persisted.activeWorkspaceId)) ? persisted.activeWorkspaceId : "local-default";
  return { ...persisted, activeWorkspaceId, symbol: P0_DEFAULT_SYMBOL, timeframe, timezone, workspaces };
}

export const useWorkspace = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      activeWorkspaceId: "local-default",
      activeView: "chart",
      setView: (v) => set({ activeView: v }),

      sidebarCollapsed: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebar: (collapsed) => set({ sidebarCollapsed: collapsed }),

      symbol: P0_DEFAULT_SYMBOL,
      setSymbol: (s) => set({ symbol: s }),

      timeframe: "5m",
      setTimeframe: (tf) => set({ timeframe: tf }),

      timezone: "America/New_York",
      setTimezone: (timezone) => set({ timezone }),

      commandOpen: false,
      setCommandOpen: (o) => set({ commandOpen: o }),

      connection: {
        state: "connecting",
        provider: "gateio",
        environment: "live",
        dataStatus: "DISCONNECTED",
      },
      setConnection: (c) =>
        set((s) => ({ connection: { ...s.connection, ...c } })),

      workspaces: [],
      cloudWorkspaces: [],
      cloudAuthenticated: false,
      suspendCloudAuthentication: () => set({ cloudAuthenticated: false }),
      setCloudAuthenticated: (authenticated) => set((state) => ({
        cloudAuthenticated: authenticated,
        cloudWorkspaces: authenticated ? state.cloudWorkspaces : [],
        activeWorkspaceId: !authenticated && state.activeWorkspaceId !== "local-default" && !state.workspaces.some((workspace) => workspace.id === state.activeWorkspaceId)
          ? "local-default" : state.activeWorkspaceId,
      })),
      saveWorkspace: (name) => {
        const s = get();
        const ws: SavedWorkspace = {
          id: crypto.randomUUID(),
          name,
          view: s.activeView,
          symbol: s.symbol,
          timeframe: s.timeframe,
          timezone: s.timezone,
          createdAt: Date.now(),
        };
        ws.chartDocuments = workspaceChartDocuments(Object.values(useChartDocuments.getState().documents).filter(document => document.workspaceId === s.activeWorkspaceId), ws.id);
        useChartDocuments.getState().restoreDocuments(ws.id, ws.chartDocuments);
        set({ workspaces: [...s.workspaces, ws] });
        if (!s.cloudAuthenticated) return;
        // Attempt cloud sync; update status store so the UI reflects success/failure.
        void fetch("/api/cloud/workspaces", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(ws),
        })
          .then((res) => {
            if (res.ok) {
              useCloudSyncStatus.setState({ status: "Workspace saved to cloud" });
            } else {
              useCloudSyncStatus.setState({ status: "Cloud save failed · saved locally" });
            }
          })
          .catch(() => {
            useCloudSyncStatus.setState({ status: "Cloud unreachable · saved locally" });
          });
      },
      loadWorkspace: (id) => {
        const ws = [...get().workspaces, ...get().cloudWorkspaces].find((w) => w.id === id);
        if (!ws) return;
        useChartDocuments.getState().restoreDocuments(ws.id, ws.chartDocuments ?? []);
        set({
          activeWorkspaceId: ws.id,
          activeView: ws.view,
          symbol: ws.symbol,
          timeframe: ws.timeframe,
          timezone: ws.timezone,
        });
      },
      mergeCloudWorkspaces: (cloudWorkspaces) => {
        if (get().cloudAuthenticated) set({ cloudWorkspaces });
      },

      lastBacktestId: null,
      setLastBacktest: (id) => set({ lastBacktestId: id }),
    }),
    {
      name: "zterminal-workspace",
      version: 5,
      migrate: (persistedState) => migratePersistedWorkspace(persistedState),
      partialize: (s) => ({
        activeWorkspaceId: s.activeWorkspaceId,
        sidebarCollapsed: s.sidebarCollapsed,
        symbol: s.symbol,
        timeframe: s.timeframe,
        timezone: s.timezone,
        workspaces: s.workspaces,
      }),
    }
  )
);
