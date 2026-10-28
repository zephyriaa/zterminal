"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_CUSTOMIZATION, parseCustomization, type Customization } from "@/lib/customization";

export type PreferenceSection = "Appearance" | "Charts" | "Layout" | "Keyboard" | "Import / Export";
export const useCustomization = create<{ preferences: Customization; update: (patch: Partial<Customization>) => void; hydrated: boolean; storageError: boolean; section: PreferenceSection }>()(persist((set) => ({
  preferences: DEFAULT_CUSTOMIZATION, hydrated: false, storageError: false, section: "Appearance",
  update: patch => set(state => ({ preferences: parseCustomization({ ...state.preferences, ...patch }) })),
}), { name: "zterminal.customization.v1", skipHydration: true,
  partialize: state => ({ preferences: state.preferences }),
  merge: (saved, current) => { try { return { ...current, preferences: parseCustomization((saved as { preferences?: unknown })?.preferences ?? {}) }; } catch { return { ...current, storageError: true }; } },
}));
let hydration: Promise<void> | undefined;
export function hydrateCustomization() {
  return hydration ??= Promise.resolve(useCustomization.persist.rehydrate()).then(() => { useCustomization.setState({ hydrated: true }); });
}
