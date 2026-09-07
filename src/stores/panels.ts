"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { defaultPlacement, emptyLayout, type Bounds, type PanelLayout, type PanelRecord, type Placement } from "@/lib/panel-layout";

type State = PanelLayout & {
  viewport: { width: number; height: number };
  register: (id: string, title: string, bounds: Bounds) => void;
  patch: (id: string, patch: Partial<PanelRecord>) => void;
  open: (id: string) => void;
  focus: (id: string) => void;
  place: (id: string, placement: Placement) => void;
  resizeDock: (placement: Placement, size: number) => void;
  setViewport: (width: number, height: number) => void;
  reset: () => void;
};
export const usePanels = create<State>()(persist((set, get) => ({
  ...emptyLayout(), viewport: { width: 1280, height: 720 },
  register: (id, title, bounds) => set(s => {
    const existing = s.panels[id];
    if (existing?.title === title) return s;
    return { panels: { ...s.panels, [id]: existing ? { ...existing, title } : { id, title, bounds, placement: defaultPlacement(id), status: id === "chart" ? "open" : "closed", maximized: false, order: 1 } } };
  }),
  patch: (id, patch) => set(s => s.panels[id] ? { panels: { ...s.panels, [id]: { ...s.panels[id], ...patch } } } : s),
  focus: id => set(s => ({ active: id, panels: s.panels[id] ? { ...s.panels, [id]: { ...s.panels[id], order: Math.max(0, ...Object.values(s.panels).map(p => p.order)) + 1 } } : s.panels })),
  open: id => { get().patch(id, { status: "open" }); get().focus(id); },
  place: (id, placement) => { get().patch(id, { placement, maximized: false, status: "open" }); get().focus(id); },
  resizeDock: (placement, size) => set(placement === "left" ? { left: Math.max(240, size) } : placement === "right" ? { right: Math.max(280, size) } : { bottom: Math.max(180, size) }),
  setViewport: (width, height) => set({ viewport: { width, height } }),
  reset: () => set(s => ({ ...emptyLayout(), panels: Object.fromEntries(Object.values(s.panels).map(p => [p.id, { ...p, placement: defaultPlacement(p.id), maximized: false, status: p.id === "chart" ? "open" : "closed", order: 1 }])) })),
}), { name: "zterminal.panels", version: 1, skipHydration: true,
  partialize: ({ panels, left, right, bottom, active }) => ({ panels, left, right, bottom, active }),
  merge: (stored, current) => {
    const data = stored as Partial<PanelLayout> | undefined;
    if (!data?.panels || typeof data.panels !== "object") return current;
    const panels = Object.fromEntries(Object.entries(data.panels).filter(([id, p]) => p?.id === id && p.bounds && ["center", "left", "right", "bottom", "floating"].includes(p.placement) && ["open", "minimized", "closed"].includes(p.status)));
    return { ...current, panels, active: typeof data.active === "string" ? data.active : "chart", left: Number.isFinite(data.left) ? data.left! : 280, right: Number.isFinite(data.right) ? data.right! : 420, bottom: Number.isFinite(data.bottom) ? data.bottom! : 300 };
  },
}));
