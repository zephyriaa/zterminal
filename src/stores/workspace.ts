"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { DataStatus, Environment, ProviderId } from "@/lib/market/types";

export type ChartTimezone = "America/New_York" | "UTC" | "Europe/London" | "Asia/Dubai";

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
  saveWorkspace: (name: string) => void;
  loadWorkspace: (id: string) => void;

  lastBacktestId: string | null;
  setLastBacktest: (id: string | null) => void;
}

const P0_DEFAULT_SYMBOL = "BTCUSDT";
const P0_TIMEFRAMES = new Set(["1m", "5m", "15m", "30m", "1h", "4h", "1d"]);

type PersistedWorkspace = Partial<Pick<WorkspaceState, "sidebarCollapsed" | "symbol" | "timeframe" | "timezone" | "workspaces">>;

const SUPPORTED_TIMEZONES = new Set<ChartTimezone>(["America/New_York", "UTC", "Europe/London", "Asia/Dubai"]);

/**
 * Previous releases persisted Gate.io and legacy venue selections in browsers.
 * P0 opens the approved Binance Futures BTCUSDT research instrument, so stale
 * selections are migrated before the chart or socket layer can request an
 * unsupported provider symbol.
 */
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
        symbol: P0_DEFAULT_SYMBOL,
        timeframe: P0_TIMEFRAMES.has(workspace.timeframe) ? workspace.timeframe : "5m",
      }))
    : [];
  return { ...persisted, symbol: P0_DEFAULT_SYMBOL, timeframe, timezone, workspaces };
}

export const useWorkspace = create<WorkspaceState>()(
  persist(
    (set, get) => ({
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
        provider: "binance",
        environment: "live",
        dataStatus: "DISCONNECTED",
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
      version: 3,
      migrate: (persistedState) => migratePersistedWorkspace(persistedState),
      partialize: (s) => ({
        sidebarCollapsed: s.sidebarCollapsed,
        symbol: s.symbol,
        timeframe: s.timeframe,
        timezone: s.timezone,
        workspaces: s.workspaces,
      }),
    }
  )
);
