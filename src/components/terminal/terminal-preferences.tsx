"use client";
import { Palette } from "lucide-react";
import { useWorkspace, type ChartTimezone } from "@/stores/workspace";
import { cn } from "@/lib/utils";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { usePrimaryDocument } from "./docking/use-primary-chart-document";
import { useChartDocuments } from "@/stores/chart-documents";
type TerminalAppearance = {
  preset: string;
  appBackground: string;
  panelBackground: string;
  chartBackground: string;
  accent: string;
  upColor: string;
  downColor: string;
  gridOpacity: number;
  density: "compact" | "comfortable";
};

const APPEARANCE_PRESETS: Record<string, Omit<TerminalAppearance, "preset">> = {
  Graphite: { appBackground: "#07090d", panelBackground: "#10141b", chartBackground: "#080b10", accent: "#7dd3fc", upColor: "#34d399", downColor: "#fb7185", gridOpacity: 7, density: "compact" },
  Midnight: { appBackground: "#050816", panelBackground: "#0b1224", chartBackground: "#060a18", accent: "#a78bfa", upColor: "#4ade80", downColor: "#f87171", gridOpacity: 6, density: "compact" },
  Sandstone: { appBackground: "#171512", panelBackground: "#24201a", chartBackground: "#15130f", accent: "#f0b35b", upColor: "#70d6a3", downColor: "#ee8f83", gridOpacity: 8, density: "comfortable" },
};

const DEFAULT_APPEARANCE: TerminalAppearance = { preset: "Graphite", ...APPEARANCE_PRESETS.Graphite };
const APPEARANCE_STORAGE_KEY = "zterminal:appearance";


export const useTerminalAppearance = create<{ appearance: TerminalAppearance; update: (next: Partial<TerminalAppearance>) => void }>()(persist((set) => ({ appearance: DEFAULT_APPEARANCE, update: next => set(state => ({ appearance: { ...state.appearance, ...next, preset: next.preset ?? "Custom" } })) }), { name: APPEARANCE_STORAGE_KEY + ":v2", skipHydration: true }));
export async function hydrateTerminalAppearance() {
  await useTerminalAppearance.persist.rehydrate();
  try {
    if (localStorage.getItem(APPEARANCE_STORAGE_KEY + ":v2")) return;
    const legacy = JSON.parse(localStorage.getItem(APPEARANCE_STORAGE_KEY) || "null");
    if (legacy && typeof legacy === "object") {
      const appearance = { ...DEFAULT_APPEARANCE };
      for (const key of ["appBackground", "panelBackground", "chartBackground", "accent", "upColor", "downColor"] as const) {
        if (typeof legacy[key] === "string" && /^#[0-9a-f]{6}$/i.test(legacy[key])) appearance[key] = legacy[key];
      }
      if (typeof legacy.gridOpacity === "number") appearance.gridOpacity = Math.max(0, Math.min(18, legacy.gridOpacity));
      if (legacy.density === "comfortable") appearance.density = "comfortable";
      appearance.preset = typeof legacy.preset === "string" ? legacy.preset : "Custom";
      useTerminalAppearance.setState({ appearance });
    }
  } catch { /* Keep local defaults if preference storage is unavailable. */ }
}
export function TerminalPreferences() {
 const { id } = usePrimaryDocument();
 const { timezone, setTimezone } = useWorkspace();
 const { appearance, update } = useTerminalAppearance();
 const changeAppearance = (next: Partial<TerminalAppearance>) => {
   update(next);
   const patch = {
     ...(next.chartBackground ? { backgroundColor: next.chartBackground } : {}),
     ...(next.upColor ? { candleUpColor: next.upColor } : {}),
     ...(next.downColor ? { candleDownColor: next.downColor } : {}),
     ...(typeof next.gridOpacity === "number" ? { gridOpacity: next.gridOpacity / 100 } : {}),
   };
   if (Object.keys(patch).length) useChartDocuments.getState().updateSettings(id, patch);
 };
 return <TerminalPreferencesWindow timezone={timezone} onTimezoneChange={setTimezone} appearance={appearance} onAppearanceChange={changeAppearance} onReset={() => changeAppearance(DEFAULT_APPEARANCE)} />;
}
function PreferenceRange({ label, value, min, max, suffix, onChange }: { label: string; value: number; min: number; max: number; suffix: string; onChange: (value: number) => void }) {
  return <label className="mt-4 block text-muted-foreground"><span className="flex justify-between"><span>{label}</span><b className="font-mono-num text-foreground">{value}{suffix}</b></span><input className="mt-2 w-full accent-[var(--zt-accent)]" type="range" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}

const TIMEZONE_OPTIONS: { value: ChartTimezone; label: string }[] = [
  { value: "America/New_York", label: "New York (ET)" },
  { value: "UTC", label: "UTC" },
  { value: "Europe/London", label: "London" },
  { value: "Asia/Dubai", label: "Dubai" },
];

function TerminalPreferencesWindow({ timezone, onTimezoneChange, appearance, onAppearanceChange, onReset }: { timezone: ChartTimezone; onTimezoneChange: (timezone: ChartTimezone) => void; appearance: TerminalAppearance; onAppearanceChange: (next: Partial<TerminalAppearance>) => void; onReset: () => void }) {
  const applyPreset = (preset: string) => onAppearanceChange({ preset, ...APPEARANCE_PRESETS[preset] });
  return <div className="zt-terminal-preferences zt-terminal-preferences-custom"><p>Personalize the workstation without changing market data. Settings are stored in this browser.</p><div className="zt-preference-section"><span className="zt-preference-section-title"><Palette />Appearance presets</span><div className="zt-preference-presets">{Object.keys(APPEARANCE_PRESETS).map((preset) => <button type="button" key={preset} className={cn("zt-preference-preset", appearance.preset === preset && "is-active")} onClick={() => applyPreset(preset)}><i style={{ background: APPEARANCE_PRESETS[preset].accent }} /><span>{preset}</span></button>)}</div></div><div className="zt-preference-grid"><ColorControl label="Workspace" value={appearance.appBackground} onChange={(value) => onAppearanceChange({ appBackground: value })} /><ColorControl label="Panels" value={appearance.panelBackground} onChange={(value) => onAppearanceChange({ panelBackground: value })} /><ColorControl label="Chart canvas" value={appearance.chartBackground} onChange={(value) => onAppearanceChange({ chartBackground: value })} /><ColorControl label="Accent" value={appearance.accent} onChange={(value) => onAppearanceChange({ accent: value })} /><ColorControl label="Up candles" value={appearance.upColor} onChange={(value) => onAppearanceChange({ upColor: value })} /><ColorControl label="Down candles" value={appearance.downColor} onChange={(value) => onAppearanceChange({ downColor: value })} /></div><PreferenceRange label="Grid intensity" value={appearance.gridOpacity} min={0} max={18} suffix="%" onChange={(gridOpacity) => onAppearanceChange({ gridOpacity })} /><label className="zt-preference-select"><span>Information density</span><select value={appearance.density} onChange={(event) => onAppearanceChange({ density: event.target.value as TerminalAppearance["density"] })}><option value="compact">Compact</option><option value="comfortable">Comfortable</option></select></label><label className="zt-preference-select"><span>Chart timezone</span><select value={timezone} onChange={(event) => onTimezoneChange(event.target.value as ChartTimezone)}>{TIMEZONE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><div className="zt-terminal-preference-actions"><button type="button" onClick={onReset}>Reset appearance</button><span>Changes apply instantly</span></div></div>;
}

function ColorControl({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="zt-color-control"><span>{label}</span><input type="color" value={value} onChange={(event) => onChange(event.target.value)} /><code>{value.toUpperCase()}</code></label>;
}

