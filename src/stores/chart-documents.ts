"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createChartDocument, migrateChartDocument, type ChartDocument, type ChartSettingsV2, type ChartType, type InstrumentKey } from "@/lib/chart/contracts";
import type { Timeframe } from "@/lib/market/types";

type DocumentSeed = { workspaceId?: string; chartId?: string; instrument: InstrumentKey; timeframe: Timeframe; settings?: Partial<ChartSettingsV2> };
type State = {
  documents: Record<string, ChartDocument>;
  ensure: (seed: DocumentSeed) => string;
  setChartType: (id: string, chartType: ChartType) => void;
  setTimeframe: (id: string, timeframe: Timeframe) => void;
  updateSettings: (id: string, patch: Partial<ChartSettingsV2>) => void;
  resetSettings: (id: string) => void;
  setVolumePane: (id: string, patch: { visible?: boolean; height?: number }) => void;
};

export const useChartDocuments = create<State>()(persist((set, get) => ({
  documents: {},
  ensure: seed => {
    const fallback = createChartDocument(seed);
    const existing = get().documents[fallback.id];
    if (!existing) set(state => ({ documents: { ...state.documents, [fallback.id]: fallback } }));
    else if (existing.schemaVersion !== 2) set(state => ({ documents: { ...state.documents, [fallback.id]: migrateChartDocument(existing, fallback) } }));
    return fallback.id;
  },
  setChartType: (id, chartType) => set(state => state.documents[id] ? ({ documents: { ...state.documents, [id]: { ...state.documents[id], chartType, updatedAt: Date.now() } } }) : state),
  setTimeframe: (id, timeframe) => set(state => state.documents[id] ? ({ documents: { ...state.documents, [id]: { ...state.documents[id], timeframe, updatedAt: Date.now() } } }) : state),
  updateSettings: (id, patch) => set(state => {
    const document = state.documents[id];
    if (!document) return state;
    return { documents: { ...state.documents, [id]: migrateChartDocument({ ...document, settings: { ...document.settings, ...patch }, updatedAt: Date.now() }, document) } };
  }),
  resetSettings: id => set(state => {
    const document = state.documents[id];
    if (!document) return state;
    const fallback = createChartDocument({ workspaceId: document.workspaceId, chartId: document.chartId, instrument: document.instrument, timeframe: document.timeframe });
    return { documents: { ...state.documents, [id]: { ...document, settings: fallback.settings, updatedAt: Date.now() } } };
  }),
  setVolumePane: (id, patch) => set(state => {
    const document = state.documents[id];
    if (!document) return state;
    return { documents: { ...state.documents, [id]: { ...document, panes: document.panes.map(pane => pane.id === "volume" ? { ...pane, ...patch, height: patch.height === undefined ? pane.height : Math.min(0.45, Math.max(0.12, patch.height)) } : pane), updatedAt: Date.now() } } };
  }),
}), {
  name: "zterminal.chart-documents",
  version: 2,
  skipHydration: true,
  partialize: state => ({ documents: state.documents }),
  merge: (saved, current) => {
    const documents = (saved as Partial<State> | undefined)?.documents;
    return { ...current, documents: documents && typeof documents === "object" ? documents : {} };
  },
}));
