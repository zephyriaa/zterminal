"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { CHART_DOCUMENT_SCHEMA_VERSION, createChartDocument, defaultDrawingStyle, drawingAnchorCount, migrateChartDocument, sanitizeDrawing, type ChartDocument, type ChartSettingsV2, type ChartType, type DrawingAnchor, type DrawingObject, type DrawingStyle, type DrawingType, type IndicatorInstanceV2, type InstrumentKey } from "@/lib/chart/contracts";
import { sanitizeChartOverlay, type ChartOverlayInstance } from "@/lib/chart/overlays/contracts";
import type { Timeframe } from "@/lib/market/types";
import { workspaceChartDocuments } from "@/lib/chart/workspace-snapshot";

type DocumentSeed = { workspaceId?: string; chartId?: string; instrument: InstrumentKey; timeframe: Timeframe; settings?: Partial<ChartSettingsV2> };
type DrawingPatch = Omit<Partial<DrawingObject>, "id" | "instrument" | "chartId" | "schemaVersion" | "style"> & { style?: Partial<DrawingStyle> };
const serverStorage = { getItem: () => null, setItem: () => undefined, removeItem: () => undefined };
type State = {
  documents: Record<string, ChartDocument>;
  workspaceOwners: Record<string, string>;
  bindCloudWorkspace: (workspaceId: string, ownerId: string) => void;
  purgeCloudDocuments: (ownerId: string | null) => void;
  drawingHistory: Record<string, { past: DrawingObject[][]; future: DrawingObject[][] }>;
  undoDrawings: (id: string) => void;
  redoDrawings: (id: string) => void;
  clearDrawings: (id: string) => void;
  pasteDrawing: (id: string, source: DrawingObject) => string | null;
  restoreDocuments: (workspaceId: string, documents: unknown[]) => void;
  removeWorkspaceDocuments: (workspaceId: string) => void;
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

function drawingChange(state: State, id: string, drawings: DrawingObject[]) {
  const document = state.documents[id];
  if (!document || JSON.stringify(document.drawings) === JSON.stringify(drawings)) return state;
  const history = state.drawingHistory[id] ?? { past: [], future: [] };
  return {
    documents: { ...state.documents, [id]: { ...document, drawings, updatedAt: Date.now() } },
    drawingHistory: { ...state.drawingHistory, [id]: { past: [...history.past, document.drawings].slice(-100), future: [] } },
  };
}

export const useChartDocuments = create<State>()(persist((set, get) => ({
  documents: {},
  workspaceOwners: {},
  bindCloudWorkspace: (workspaceId, ownerId) => set(state => ({ workspaceOwners: { ...state.workspaceOwners, [workspaceId]: ownerId } })),
  purgeCloudDocuments: ownerId => {
    // Do not write the initial empty store before persisted documents have hydrated.
    if (!Object.values(get().workspaceOwners).some(owner => owner !== ownerId)) return;
    set(state => {
      const documents = { ...state.documents }, drawingHistory = { ...state.drawingHistory }, workspaceOwners = { ...state.workspaceOwners };
      for (const [workspaceId, owner] of Object.entries(workspaceOwners)) if (owner !== ownerId) {
        for (const document of Object.values(documents)) if (document.workspaceId === workspaceId) { delete documents[document.id]; delete drawingHistory[document.id]; }
        delete workspaceOwners[workspaceId];
      }
      return { documents, drawingHistory, workspaceOwners };
    });
  },
  drawingHistory: {},
  removeWorkspaceDocuments: workspaceId => set(state => {
    const documents = { ...state.documents }, drawingHistory = { ...state.drawingHistory }, workspaceOwners = { ...state.workspaceOwners };
    for (const document of Object.values(documents)) if (document.workspaceId === workspaceId) { delete documents[document.id]; delete drawingHistory[document.id]; }
    delete workspaceOwners[workspaceId];
    return { documents, drawingHistory, workspaceOwners };
  }),
  undoDrawings: id => set(state => {
    const history = state.drawingHistory[id], document = state.documents[id];
    if (!document || !history?.past.length) return state;
    return { documents: { ...state.documents, [id]: { ...document, drawings: history.past.at(-1)!, updatedAt: Date.now() } }, drawingHistory: { ...state.drawingHistory, [id]: { past: history.past.slice(0, -1), future: [document.drawings, ...history.future] } } };
  }),
  redoDrawings: id => set(state => {
    const history = state.drawingHistory[id], document = state.documents[id];
    if (!document || !history?.future.length) return state;
    return { documents: { ...state.documents, [id]: { ...document, drawings: history.future[0], updatedAt: Date.now() } }, drawingHistory: { ...state.drawingHistory, [id]: { past: [...history.past, document.drawings], future: history.future.slice(1) } } };
  }),
  clearDrawings: id => set(state => drawingChange(state, id, state.documents[id]?.drawings.filter(drawing => drawing.locked) ?? [])),
  pasteDrawing: (id, source) => {
    const document = get().documents[id];
    if (!document) return null;
    const drawingId = crypto.randomUUID(), now = Date.now();
    const offset = ({ "1m": 60_000, "5m": 300_000, "15m": 900_000, "30m": 1800_000, "1h": 3600_000, "4h": 14400_000, "1d": 86400_000 })[document.timeframe];
    const drawing = sanitizeDrawing({ ...source, id: drawingId, instrument: document.instrument, chartId: document.chartId, locked: false, hidden: false, anchors: source.anchors.map(anchor => ({ ...anchor, time: anchor.time + offset })), zOrder: Math.max(0, ...document.drawings.map(item => item.zOrder)) + 1, createdAt: now, updatedAt: now }, document);
    if (!drawing) return null;
    set(state => drawingChange(state, id, [...state.documents[id].drawings, drawing]));
    return drawingId;
  },
  restoreDocuments: (workspaceId, values) => set(state => {
    const documents = { ...state.documents }, drawingHistory = { ...state.drawingHistory };
    for (const restored of workspaceChartDocuments(values, workspaceId)) {
      if (!documents[restored.id] || documents[restored.id].updatedAt < restored.updatedAt) {
        documents[restored.id] = restored;
        delete drawingHistory[restored.id]; // Undo must never resurrect an externally replaced revision.
      }
    }
    return { documents, drawingHistory };
  }),
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
    if (!document || (type === "polyline" ? anchors.length < 2 : anchors.length !== drawingAnchorCount(type))) return null;
    const drawingId = crypto.randomUUID();
    const now = Date.now();
    const drawing = sanitizeDrawing({ schemaVersion: 1, id: drawingId, type, instrument: document.instrument, chartId: document.chartId, anchors, style: { ...defaultDrawingStyle(type), ...style }, visibility: { timeframes: "all" }, locked: false, hidden: false, zOrder: Math.max(0, ...document.drawings.map(item => item.zOrder)) + 1, createdAt: now, updatedAt: now }, document);
    if (!drawing) return null;
    set(state => drawingChange(state, id, [...state.documents[id].drawings, drawing]));
    return drawingId;
  },
  updateDrawing: (id, drawingId, patch) => set(state => {
    const document = state.documents[id];
    if (!document) return state;
    const drawings = document.drawings.map(drawing => {
      if (drawing.id !== drawingId) return drawing;
      if (drawing.locked && (patch.anchors || patch.type || patch.style)) return drawing;
      const sanitized = sanitizeDrawing({ ...drawing, ...patch, style: { ...drawing.style, ...patch.style }, visibility: patch.visibility ?? drawing.visibility, createdAt: drawing.createdAt, updatedAt: drawing.updatedAt }, document);
      return sanitized && JSON.stringify(sanitized) !== JSON.stringify(drawing) ? { ...sanitized, updatedAt: Date.now() } : drawing;
    });
    return drawingChange(state, id, drawings);
  }),
  deleteDrawing: (id, drawingId) => set(state => {
    const document = state.documents[id];
    if (!document) return state;
    if (document.drawings.find(drawing => drawing.id === drawingId)?.locked) return state;
    return drawingChange(state, id, document.drawings.filter(drawing => drawing.id !== drawingId));
  }),
  duplicateDrawing: (id, drawingId) => {
    const document = get().documents[id];
    const source = document?.drawings.find(drawing => drawing.id === drawingId);
    if (!document || !source) return null;
    return get().pasteDrawing(id, source);
  },
}), {
  name: "zterminal.chart-documents",
  version: 5,
  migrate: saved => saved,
  storage: createJSONStorage(() => typeof localStorage === "undefined" ? serverStorage : localStorage),
  skipHydration: true,
  partialize: state => ({ documents: state.documents, workspaceOwners: state.workspaceOwners }),
  merge: (saved, current) => {
    const documents = (saved as Partial<State> | undefined)?.documents;
    const sanitized: Record<string, ChartDocument> = {};
    if (documents && typeof documents === "object") for (const input of Object.values(documents)) {
      if (!input || typeof input.workspaceId !== "string") continue;
      const restored = workspaceChartDocuments([input], input.workspaceId)[0];
      if (restored && input.id === restored.id) sanitized[restored.id] = restored;
    }
    const owners = (saved as Partial<State> | undefined)?.workspaceOwners;
    const workspaceOwners: Record<string, string> = {};
    if (owners && typeof owners === "object") for (const [id, owner] of Object.entries(owners)) if (typeof owner === "string" && owner.length > 0 && owner.length <= 100) workspaceOwners[id] = owner;
    return { ...current, documents: sanitized, workspaceOwners, drawingHistory: {} };
  },
}));
