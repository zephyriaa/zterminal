"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createStudy, INDICATOR_LIBRARY, validateStudy, type IndicatorInstance } from "@/lib/indicator-library";
type State = { instances: IndicatorInstance[]; favorites: string[]; recent: string[]; add: (id: string) => void; update: (study: IndicatorInstance) => void; remove: (id: string) => void; toggleFavorite: (id: string) => void };
export const useStudies = create<State>()(persist((set) => ({
  instances: [createStudy("vwap", "default-vwap"), createStudy("ema20", "default-ema20"), createStudy("volume", "default-volume")], favorites: [], recent: [],
  add: id => set(s => ({ instances: ["volume", "profile"].includes(id) && s.instances.some(p => p.presetId === id) ? s.instances.map(p => p.presetId === id ? { ...p, visible: true } : p) : [...s.instances, createStudy(id)].slice(0, 50), recent: [id, ...s.recent.filter(p => p !== id)].slice(0, 10) })),
  update: study => { validateStudy(study); set(s => ({ instances: s.instances.map(p => p.id === study.id ? study : p) })); },
  remove: id => set(s => ({ instances: s.instances.filter(p => p.id !== id) })),
  toggleFavorite: id => set(s => ({ favorites: s.favorites.includes(id) ? s.favorites.filter(p => p !== id) : [...s.favorites, id] })),
}), { name: "zterminal.studies", version: 1, skipHydration: true, partialize: ({ instances, favorites, recent }) => ({ instances, favorites, recent }), merge: (saved, current) => {
  const s = saved as Partial<State> | undefined;
  if (!s || !Array.isArray(s.instances)) return current;
  const ids = new Set<string>();
  const instances = s.instances.filter(p => { try { validateStudy(p); if (typeof p.id !== "string" || ids.has(p.id)) return false; ids.add(p.id); return true; } catch { return false; } }).slice(0, 50);
  const supported = (items: unknown) => Array.isArray(items) ? items.filter(id => INDICATOR_LIBRARY.some(p => p.id === id)).slice(0, 20) : [];
  return { ...current, instances, favorites: supported(s.favorites), recent: supported(s.recent) };
} }));
