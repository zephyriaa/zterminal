"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_APPEARANCE, normalizeTerminalAppearance, type TerminalAppearance } from "@/lib/terminal-appearance";

export const APPEARANCE_STORAGE_KEY = "zterminal:appearance";
export const useTerminalAppearance = create<{ appearance: TerminalAppearance; update: (next: Partial<TerminalAppearance>) => void }>()(persist((set) => ({
  appearance: DEFAULT_APPEARANCE,
  update: next => set(state => ({ appearance: normalizeTerminalAppearance({ ...state.appearance, ...next, preset: next.preset ?? "Custom" }) })),
}), {
  name: APPEARANCE_STORAGE_KEY + ":v2", skipHydration: true,
  merge: (persisted, current) => ({ ...current, appearance: normalizeTerminalAppearance((persisted as { appearance?: unknown } | undefined)?.appearance) }),
}));

let hydration: Promise<void> | undefined;
export function hydrateTerminalAppearance(): Promise<void> {
  if (hydration) return hydration;
  hydration = (async () => {
    await useTerminalAppearance.persist.rehydrate();
    try {
      if (localStorage.getItem(APPEARANCE_STORAGE_KEY + ":v2")) return;
      const legacy: unknown = JSON.parse(localStorage.getItem(APPEARANCE_STORAGE_KEY) || "null");
      if (legacy && typeof legacy === "object") useTerminalAppearance.setState({ appearance: normalizeTerminalAppearance(legacy) });
    } catch { /* Preference storage is optional; the terminal remains usable. */ }
  })();
  return hydration;
}
