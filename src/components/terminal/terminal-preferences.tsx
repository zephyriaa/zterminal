"use client";
import { Palette } from "lucide-react";
import { useWorkspace, type ChartTimezone } from "@/stores/workspace";
import { cn } from "@/lib/utils";
import { APPEARANCE_PRESETS, DEFAULT_APPEARANCE, type TerminalAppearance } from "@/lib/terminal-appearance";
import { useTerminalAppearance } from "@/stores/terminal-appearance";
export { useTerminalAppearance, hydrateTerminalAppearance } from "@/stores/terminal-appearance";
import { usePrimaryDocument } from "./docking/use-primary-chart-document";
import { useChartDocuments } from "@/stores/chart-documents";
export function TerminalPreferences() {
 const { id } = usePrimaryDocument();
 const { timezone, setTimezone } = useWorkspace();
 const { appearance, update } = useTerminalAppearance();
 const changeAppearance = (next: Partial<TerminalAppearance>) => {
   update(next);
   const patch = {
     ...(next.chartBackground ? { backgroundColor: next.chartBackground } : {}),
     ...(next.upColor ? { candleUpColor: next.upColor, candleBorderUpColor: next.upColor, candleWickUpColor: next.upColor } : {}),
     ...(next.downColor ? { candleDownColor: next.downColor, candleBorderDownColor: next.downColor, candleWickDownColor: next.downColor } : {}),
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
  return <div className="zt-terminal-preferences zt-terminal-preferences-custom"><p>Personalize the workstation without changing market data. Settings are stored in this browser.</p><div className="zt-preference-section"><span className="zt-preference-section-title"><Palette />Appearance presets</span><div className="zt-preference-presets">{Object.keys(APPEARANCE_PRESETS).map((preset) => <button type="button" key={preset} aria-pressed={appearance.preset === preset} className={cn("zt-preference-preset", appearance.preset === preset && "is-active")} onClick={() => applyPreset(preset)}><i style={{ background: APPEARANCE_PRESETS[preset].accent }} /><span>{preset === "Graphite" ? "Classic Blue" : preset}</span></button>)}</div></div><div className="zt-preference-grid"><ColorControl label="Workspace" value={appearance.appBackground} onChange={(value) => onAppearanceChange({ appBackground: value })} /><ColorControl label="Panels" value={appearance.panelBackground} onChange={(value) => onAppearanceChange({ panelBackground: value })} /><ColorControl label="Chart canvas" value={appearance.chartBackground} onChange={(value) => onAppearanceChange({ chartBackground: value })} /><ColorControl label="Accent" value={appearance.accent} onChange={(value) => onAppearanceChange({ accent: value })} /><ColorControl label="Up candles" value={appearance.upColor} onChange={(value) => onAppearanceChange({ upColor: value })} /><ColorControl label="Down candles" value={appearance.downColor} onChange={(value) => onAppearanceChange({ downColor: value })} /></div><PreferenceRange label="Grid intensity" value={appearance.gridOpacity} min={0} max={18} suffix="%" onChange={(gridOpacity) => onAppearanceChange({ gridOpacity })} /><label className="zt-preference-select"><span>Information density</span><select value={appearance.density} onChange={(event) => onAppearanceChange({ density: event.target.value as TerminalAppearance["density"] })}><option value="compact">Compact</option><option value="comfortable">Comfortable</option></select></label><label className="zt-preference-select"><span>Chart timezone</span><select value={timezone} onChange={(event) => onTimezoneChange(event.target.value as ChartTimezone)}>{TIMEZONE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><div className="zt-terminal-preference-actions"><button type="button" onClick={onReset}>Reset appearance</button><span>Changes apply instantly</span></div></div>;
}

function ColorControl({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="zt-color-control"><span>{label}</span><input type="color" value={value} onChange={(event) => onChange(event.target.value)} /><code>{value.toUpperCase()}</code></label>;
}

