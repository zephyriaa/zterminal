"use client";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { createStudy, INDICATOR_LIBRARY, migrateStudy, resetStudy, validateStudy, type IndicatorInstance } from "@/lib/indicator-library";

type State = { instances: IndicatorInstance[]; favorites: string[]; recent: string[]; add: (id: string) => void; update: (study: IndicatorInstance) => void; remove: (id: string) => void; duplicate: (id: string) => void; reset: (id: string) => void; replaceInstances: (instances: IndicatorInstance[]) => void; toggleFavorite: (id: string) => void };
const serverStorage = { getItem: () => null, setItem: () => undefined, removeItem: () => undefined };
const defaults = () => [createStudy("vwap", "default-vwap"), createStudy("ema20", "default-ema20"), createStudy("volume", "default-volume")];

export const useStudies = create<State>()(persist((set) => ({
  instances: defaults(), favorites: [], recent: [],
  add: id => set(state => ({ instances: ["volume", "profile"].includes(id) && state.instances.some(item => item.definitionId === id) ? state.instances.map(item => item.definitionId === id ? { ...item, enabled: true } : item) : [...state.instances, createStudy(id)].slice(0, 50), recent: [id, ...state.recent.filter(item => item !== id)].slice(0, 10) })),
  update: study => { validateStudy(study); set(state => ({ instances: state.instances.map(item => item.id === study.id ? study : item) })); },
  remove: id => set(state => ({ instances: state.instances.filter(item => item.id !== id) })),
  duplicate: id => set(state => { const source = state.instances.find(item => item.id === id); return source ? { instances: [...state.instances, { ...source, id: crypto.randomUUID(), name: `${source.name} copy`, inputs: { ...source.inputs }, outputs: source.outputs.map(output => ({ ...output })) }].slice(0, 50) } : state; }),
  reset: id => set(state => ({ instances: state.instances.map(item => item.id === id ? { ...resetStudy(item), name: item.name } : item) })),
  replaceInstances: instances => set({ instances: instances.map(migrateStudy).filter((item): item is IndicatorInstance => item !== null).slice(0, 50) }),
  toggleFavorite: id => set(state => ({ favorites: state.favorites.includes(id) ? state.favorites.filter(item => item !== id) : [...state.favorites, id] })),
}), { name: "zterminal.studies", version: 2, storage: createJSONStorage(() => typeof localStorage === "undefined" ? serverStorage : localStorage), skipHydration: true, partialize: ({ instances, favorites, recent }) => ({ instances, favorites, recent }), merge: (saved, current) => {
  const state = saved as Partial<State> | undefined; if (!state || !Array.isArray(state.instances)) return current; const ids = new Set<string>();
  const instances = state.instances.map(migrateStudy).filter((item): item is IndicatorInstance => { if (!item || ids.has(item.id)) return false; try { validateStudy(item); ids.add(item.id); return true; } catch { return false; } }).slice(0, 50);
  const supported = (items: unknown) => Array.isArray(items) ? items.filter(id => typeof id === "string" && INDICATOR_LIBRARY.some(item => item.id === id)).slice(0, 20) : [];
  return { ...current, instances: instances.length ? instances : defaults(), favorites: supported(state.favorites), recent: supported(state.recent) };
} }));
