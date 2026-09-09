"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type LeftTabId = "watchlist" | "indicators" | "files";
export type BottomTabId = "editor" | "backtest" | "logs";
export type RightTabId = "context" | "risk" | "settings";

export type TerminalAppearance = {
  preset: string;
  appBackground: string;
  panelBackground: string;
  chartBackground: string;
  accent: string;
  upColor: string;
  downColor: string;
  gridOpacity: number;
  density: "compact" | "comfortable";
};

export const APPEARANCE_PRESETS: Record<string, Omit<TerminalAppearance, "preset">> = {
  Graphite: {
    appBackground: "#07090d",
    panelBackground: "#0d1117",
    chartBackground: "#07090d",
    accent: "#38bdf8",
    upColor: "#10b981",
    downColor: "#f43f5e",
    gridOpacity: 6,
    density: "compact",
  },
  Midnight: {
    appBackground: "#040714",
    panelBackground: "#090d1f",
    chartBackground: "#040714",
    accent: "#818cf8",
    upColor: "#34d399",
    downColor: "#fb7185",
    gridOpacity: 5,
    density: "compact",
  },
  Sandstone: {
    appBackground: "#14120f",
    panelBackground: "#1c1915",
    chartBackground: "#14120f",
    accent: "#f59e0b",
    upColor: "#4ade80",
    downColor: "#f87171",
    gridOpacity: 7,
    density: "comfortable",
  },
};

export const DEFAULT_APPEARANCE: TerminalAppearance = {
  preset: "Graphite",
  ...APPEARANCE_PRESETS.Graphite,
};

interface LayoutState {
  // Panel Visibility
  leftPanelOpen: boolean;
  bottomPanelOpen: boolean;
  rightPanelOpen: boolean;

  // Active Tabs
  leftTab: LeftTabId;
  bottomTab: BottomTabId;
  rightTab: RightTabId;

  // Layout sizing
  leftSize: number;
  rightSize: number;
  bottomSize: number;

  // Appearance
  appearance: TerminalAppearance;

  // Diagnostics / Console Logs
  logs: { id: string; timestamp: number; level: "info" | "warn" | "error" | "success"; message: string }[];

  // Actions
  toggleLeftPanel: () => void;
  toggleBottomPanel: () => void;
  toggleRightPanel: () => void;
  setLeftPanelOpen: (open: boolean) => void;
  setBottomPanelOpen: (open: boolean) => void;
  setRightPanelOpen: (open: boolean) => void;

  setLeftTab: (tab: LeftTabId) => void;
  setBottomTab: (tab: BottomTabId) => void;
  setRightTab: (tab: RightTabId) => void;

  setLeftSize: (size: number) => void;
  setRightSize: (size: number) => void;
  setBottomSize: (size: number) => void;

  updateAppearance: (partial: Partial<TerminalAppearance>) => void;
  resetLayout: () => void;

  addLog: (level: "info" | "warn" | "error" | "success", message: string) => void;
  clearLogs: () => void;
}

const DEFAULT_LOGS = [
  { id: "log-init-1", timestamp: Date.now() - 3000, level: "info" as const, message: "ZTerminal quantitative workstation initialized." },
  { id: "log-init-2", timestamp: Date.now() - 2000, level: "info" as const, message: "Client WebAssembly research core loaded." },
  { id: "log-init-3", timestamp: Date.now() - 1000, level: "success" as const, message: "Binance verified market feed ready." },
];

export const useLayout = create<LayoutState>()(
  persist(
    (set) => ({
      leftPanelOpen: true,
      bottomPanelOpen: true,
      rightPanelOpen: true,

      leftTab: "watchlist",
      bottomTab: "editor",
      rightTab: "context",

      leftSize: 20,
      rightSize: 22,
      bottomSize: 36,

      appearance: DEFAULT_APPEARANCE,

      logs: DEFAULT_LOGS,

      toggleLeftPanel: () => set((s) => ({ leftPanelOpen: !s.leftPanelOpen })),
      toggleBottomPanel: () => set((s) => ({ bottomPanelOpen: !s.bottomPanelOpen })),
      toggleRightPanel: () => set((s) => ({ rightPanelOpen: !s.rightPanelOpen })),

      setLeftPanelOpen: (open) => set({ leftPanelOpen: open }),
      setBottomPanelOpen: (open) => set({ bottomPanelOpen: open }),
      setRightPanelOpen: (open) => set({ rightPanelOpen: open }),

      setLeftTab: (leftTab) => set({ leftTab, leftPanelOpen: true }),
      setBottomTab: (bottomTab) => set({ bottomTab, bottomPanelOpen: true }),
      setRightTab: (rightTab) => set({ rightTab, rightPanelOpen: true }),

      setLeftSize: (leftSize) => set({ leftSize }),
      setRightSize: (rightSize) => set({ rightSize }),
      setBottomSize: (bottomSize) => set({ bottomSize }),

      updateAppearance: (partial) =>
        set((s) => ({
          appearance: {
            ...s.appearance,
            ...partial,
            preset: partial.preset ?? "Custom",
          },
        })),

      resetLayout: () =>
        set({
          leftPanelOpen: true,
          bottomPanelOpen: true,
          rightPanelOpen: true,
          leftTab: "watchlist",
          bottomTab: "editor",
          rightTab: "context",
          leftSize: 20,
          rightSize: 22,
          bottomSize: 36,
          appearance: DEFAULT_APPEARANCE,
        }),

      addLog: (level, message) =>
        set((s) => ({
          logs: [
            ...s.logs.slice(-99),
            {
              id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              timestamp: Date.now(),
              level,
              message,
            },
          ],
        })),

      clearLogs: () => set({ logs: [] }),
    }),
    {
      name: "zterminal-layout-v1",
      partialize: (s) => ({
        leftPanelOpen: s.leftPanelOpen,
        bottomPanelOpen: s.bottomPanelOpen,
        rightPanelOpen: s.rightPanelOpen,
        leftTab: s.leftTab,
        bottomTab: s.bottomTab,
        rightTab: s.rightTab,
        leftSize: s.leftSize,
        rightSize: s.rightSize,
        bottomSize: s.bottomSize,
        appearance: s.appearance,
      }),
    }
  )
);
