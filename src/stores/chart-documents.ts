"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { CHART_DOCUMENT_SCHEMA_VERSION, createChartDocument, defaultDrawingStyle, drawingAnchorCount, migrateChartDocument, sanitizeDrawing, type ChartDocument, type ChartSettingsV2, type ChartType, type DrawingAnchor, type DrawingObject, type DrawingStyle, type DrawingType, type IndicatorInstanceV2, type InstrumentKey } from "@/lib/chart/contracts";
import { sanitizeChartOverlay, type ChartOverlayInstance } from "@/lib/chart/overlays/contracts";
import type { Timeframe } from "@/lib/market/types";

type DocumentSeed = { workspaceId?: string; chartId?: string; instrument: InstrumentKey; timeframe: Timeframe; settings?: Partial<ChartSettingsV2> };
type DrawingPatch = Omit<Partial<DrawingObject>, "id" | "instrument" | "chartId" | "schemaVersion" | "style"> & { style?: Partial<DrawingStyle> };
const serverStorage = { getItem: () => null, setItem: () => undefined, removeItem: () => undefined };
type State = {
  documents: Record<string, ChartDocument>;
  ensure: (seed: DocumentSeed) => string;
  setChartType: (id: string, chartType: ChartType) => void;
  setTimeframe: (id: string, timeframe: Timeframe) => void;
  updateSettings: (id: string, patch: Partial<ChartSettingsV2>) => void;
  resetSettings: (id: string) => void;
  setVolumePane: (id: string, patch: { visible?: boolean; height?: number }) => void;
  setIndicators: (id: string, indicators: IndicatorInstanceV2[]) => void;
  setOverlay: (id: string, overlay: ChartOverlayInstance) => void;
  removeOverlay: (id: string, overlayId: string) => void;
  createDrawing: (id: string, type: DrawingType, anchors: DrawingAnchor[], style?: Partial<DrawingStyle>) => string | null;
  updateDrawing: (id: string, drawingId: string, patch: DrawingPatch) => void;
  deleteDrawing: (id: string, drawingId: string) => void;
  duplicateDrawing: (id: string, drawingId: string) => string | null;
};

export const useChartDocuments = create<State>()(persist((set, get) => ({
  documents: {},
  ensure: seed => {
    const fallback = createChartDocument(seed);
    const existing = get().documents[fallback.id];
    if (!existing) set(state => ({ documents: { ...state.documents, [fallback.id]: fallback } }));
    else if (existing.schemaVersion !== CHART_DOCUMENT_SCHEMA_VERSION) set(state => ({ documents: { ...state.documents, [fallback.id]: migrateChartDocument(existing, fallback) } }));
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
  setIndicators: (id, indicators) => set(state => {
    const document = state.documents[id];
    return document ? { documents: { ...state.documents, [id]: { ...document, indicators, updatedAt: Date.now() } } } : state;
  }),
  setOverlay: (id, overlay) => {
    const sanitized = sanitizeChartOverlay(overlay);
    if (!sanitized) return;
    set(state => {
      const document = state.documents[id];
      if (!document) return state;
      return {
        documents: {
          ...state.documents,
          [id]: {
            ...document,
            overlays: [...document.overlays.filter(item => item.id !== sanitized.id), sanitized],
            updatedAt: Date.now(),
          },
        },
      };
    });
  },
  removeOverlay: (id, overlayId) => set(state => {
    const document = state.documents[id];
    return document ? {
      documents: {
        ...state.documents,
        [id]: { ...document, overlays: document.overlays.filter(overlay => overlay.id !== overlayId), updatedAt: Date.now() },
      },
    } : state;
  }),
  createDrawing: (id, type, anchors, style) => {
    const document = get().documents[id];
    if (!document || anchors.length !== drawingAnchorCount(type)) return null;
    const drawingId = crypto.randomUUID();
    const now = Date.now();
    const drawing = sanitizeDrawing({ schemaVersion: 1, id: drawingId, type, instrument: document.instrument, chartId: document.chartId, anchors, style: { ...defaultDrawingStyle(type), ...style }, visibility: { timeframes: "all" }, locked: false, hidden: false, zOrder: document.drawings.length, createdAt: now, updatedAt: now }, document);
    if (!drawing) return null;
    set(state => ({ documents: { ...state.documents, [id]: { ...state.documents[id], drawings: [...state.documents[id].drawings, drawing], updatedAt: now } } }));
    return drawingId;
  },
  updateDrawing: (id, drawingId, patch) => set(state => {
    const document = state.documents[id];
    if (!document) return state;
    const drawings = document.drawings.map(drawing => {
      if (drawing.id !== drawingId) return drawing;
      if (drawing.locked && (patch.anchors || patch.type)) return drawing;
      return sanitizeDrawing({ ...drawing, ...patch, style: { ...drawing.style, ...patch.style }, visibility: patch.visibility ?? drawing.visibility, updatedAt: Date.now() }, document) ?? drawing;
    });
    return { documents: { ...state.documents, [id]: { ...document, drawings, updatedAt: Date.now() } } };
  }),
  deleteDrawing: (id, drawingId) => set(state => {
    const document = state.documents[id];
    if (!document) return state;
    if (document.drawings.find(drawing => drawing.id === drawingId)?.locked) return state;
    return { documents: { ...state.documents, [id]: { ...document, drawings: document.drawings.filter(drawing => drawing.id !== drawingId), updatedAt: Date.now() } } };
  }),
  duplicateDrawing: (id, drawingId) => {
    const document = get().documents[id];
    const source = document?.drawings.find(drawing => drawing.id === drawingId);
    if (!document || !source) return null;
    const offset = 60_000;
    const duplicateId = get().createDrawing(id, source.type, source.anchors.map(anchor => ({ time: anchor.time + offset, price: anchor.price })), source.style);
    if (duplicateId) get().updateDrawing(id, duplicateId, { visibility: source.visibility });
    return duplicateId;
  },
}), {
  name: "zterminal.chart-documents",
  version: 5,
  storage: createJSONStorage(() => typeof localStorage === "undefined" ? serverStorage : localStorage),
  skipHydration: true,
  partialize: state => ({ documents: state.documents }),
  merge: (saved, current) => {
    const documents = (saved as Partial<State> | undefined)?.documents;
    return { ...current, documents: documents && typeof documents === "object" ? documents : {} };
  },
}));
