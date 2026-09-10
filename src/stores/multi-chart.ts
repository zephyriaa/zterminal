"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ChartType } from "@/lib/chart/contracts";
import type { Timeframe } from "@/lib/market/types";

export type MultiChartLayout = "1" | "2h" | "2v" | "3" | "4";

export interface ChartPaneConfig {
  id: string;
  symbol: string;
  timeframe: Timeframe;
  chartType: ChartType;
}

interface MultiChartState {
  layout: MultiChartLayout;
  activePaneIndex: number;
  syncCrosshairs: boolean;
  syncSymbol: boolean;
  panes: ChartPaneConfig[];
  setLayout: (layout: MultiChartLayout) => void;
  setActivePaneIndex: (index: number) => void;
  setPaneSymbol: (index: number, symbol: string) => void;
  setPaneTimeframe: (index: number, timeframe: Timeframe) => void;
  setPaneChartType: (index: number, chartType: ChartType) => void;
  toggleSyncCrosshairs: () => void;
  toggleSyncSymbol: () => void;
}

const DEFAULT_PANES: ChartPaneConfig[] = [
  { id: "pane-0", symbol: "BTCUSDT", timeframe: "5m", chartType: "candles" },
  { id: "pane-1", symbol: "ETHUSDT", timeframe: "15m", chartType: "candles" },
  { id: "pane-2", symbol: "SOLUSDT", timeframe: "1h", chartType: "candles" },
  { id: "pane-3", symbol: "BTCUSDT", timeframe: "4h", chartType: "candles" },
];

export const useMultiChart = create<MultiChartState>()(
  persist(
    (set, get) => ({
      layout: "1",
      activePaneIndex: 0,
      syncCrosshairs: true,
      syncSymbol: false,
      panes: DEFAULT_PANES,

      setLayout: (layout) => set({ layout }),

      setActivePaneIndex: (activePaneIndex) => set({ activePaneIndex }),

      setPaneSymbol: (index, symbol) => {
        const { panes, syncSymbol } = get();
        if (syncSymbol) {
          // If synced, update all panes to this symbol
          set({
            panes: panes.map((p) => ({ ...p, symbol })),
          });
        } else {
          const nextPanes = [...panes];
          if (nextPanes[index]) {
            nextPanes[index] = { ...nextPanes[index], symbol };
            set({ panes: nextPanes });
          }
        }
      },

      setPaneTimeframe: (index, timeframe) => {
        const { panes } = get();
        const nextPanes = [...panes];
        if (nextPanes[index]) {
          nextPanes[index] = { ...nextPanes[index], timeframe };
          set({ panes: nextPanes });
        }
      },

      setPaneChartType: (index, chartType) => {
        const { panes } = get();
        const nextPanes = [...panes];
        if (nextPanes[index]) {
          nextPanes[index] = { ...nextPanes[index], chartType };
          set({ panes: nextPanes });
        }
      },

      toggleSyncCrosshairs: () =>
        set((state) => ({ syncCrosshairs: !state.syncCrosshairs })),

      toggleSyncSymbol: () =>
        set((state) => ({ syncSymbol: !state.syncSymbol })),
    }),
    {
      name: "zterminal.multi-chart.v1",
      version: 1,
      skipHydration: true,
    }
  )
);
