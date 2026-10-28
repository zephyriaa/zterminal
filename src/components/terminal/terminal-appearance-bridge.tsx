"use client";

import { useEffect } from "react";
import { hydrateCustomization, useCustomization } from "@/stores/customization";
import { hydrateTerminalAppearance, useTerminalAppearance } from "@/stores/terminal-appearance";

/** The terminal shell owns presentation tokens, including body-mounted portals. */
export function TerminalAppearanceBridge() {
  const appearance = useTerminalAppearance(state => state.appearance);
  const preferences = useCustomization(state => state.preferences);
  useEffect(() => { void hydrateTerminalAppearance(); void hydrateCustomization(); }, []);
  useEffect(() => {
    const body = document.body;
    body.dataset.terminalMotion = preferences.reduceMotion ? "reduced" : "system";
    body.dataset.terminalMaterial = appearance.material;
    document.documentElement.dataset.terminalDensity = appearance.density;
    const values = { "--zt-font-size": `${preferences.fontSize}px`, "--zt-app-bg": appearance.appBackground, "--zt-panel-bg": appearance.panelBackground, "--zt-chart-bg": appearance.chartBackground, "--zt-accent": appearance.accent, "--zt-grid-opacity": String(appearance.gridOpacity / 100) };
    Object.entries(values).forEach(([name, value]) => body.style.setProperty(name, value));
    return () => {
      Object.keys(values).forEach(name => body.style.removeProperty(name));
      delete body.dataset.terminalMaterial;
      delete body.dataset.terminalMotion;
      delete document.documentElement.dataset.terminalDensity;
    };
  }, [appearance, preferences.fontSize, preferences.reduceMotion]);
  return null;
}
