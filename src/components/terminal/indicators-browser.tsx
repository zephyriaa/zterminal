"use client";

import { useMemo, useState } from "react";
import { Check, Eye, EyeOff, Layers3, Plus, Search, Settings2, Trash2, X } from "lucide-react";
import type { ChartStudy } from "./terminal-chart";
import { cn } from "@/lib/utils";

export type IndicatorToggleId = "vwap" | "ema20" | "ema50" | "volume";

type IndicatorPreset = {
  id: string;
  name: string;
  category: "Trend" | "Volume" | "Custom";
  description: string;
  color: string;
  kind: ChartStudy["kind"] | "volume";
  period?: number;
  toggleId?: IndicatorToggleId;
};

const PRESETS: IndicatorPreset[] = [
  { id: "vwap", name: "VWAP", category: "Trend", description: "Session volume-weighted average price", color: "#f59e0b", kind: "vwap", toggleId: "vwap" },
  { id: "ema20", name: "Moving Average Exponential", category: "Trend", description: "Exponential moving average · 20", color: "#38bdf8", kind: "ema", period: 20, toggleId: "ema20" },
  { id: "ema50", name: "Moving Average Exponential", category: "Trend", description: "Exponential moving average · 50", color: "#a78bfa", kind: "ema", period: 50, toggleId: "ema50" },
  { id: "sma20", name: "Moving Average Simple", category: "Trend", description: "Simple moving average · 20", color: "#f97316", kind: "sma", period: 20 },
  { id: "volume", name: "Volume", category: "Volume", description: "Observed exchange trade volume", color: "#94a3b8", kind: "volume", toggleId: "volume" },
];

export function IndicatorsBrowser({ layers, customStudies, onToggleLayer, onCreate, onUpdate, onRemove }: { layers: Record<IndicatorToggleId, boolean>; customStudies: ChartStudy[]; onToggleLayer: (id: IndicatorToggleId) => void; onCreate: (study: ChartStudy) => void; onUpdate: (study: ChartStudy) => void; onRemove: (id: string) => void }) {
  const [tab, setTab] = useState<"library" | "chart">("library");
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const filtered = useMemo(() => PRESETS.filter((indicator) => `${indicator.name} ${indicator.category} ${indicator.description}`.toLowerCase().includes(query.trim().toLowerCase())), [query]);
  const active = [
    ...PRESETS.filter((indicator) => indicator.toggleId && layers[indicator.toggleId]),
    ...customStudies.filter((indicator) => indicator.visible).map((study) => ({ id: study.id, name: study.name, category: "Custom" as const, description: `${study.kind.toUpperCase()}${study.period ? ` · ${study.period}` : ""}`, color: study.color, kind: study.kind, period: study.period })),
  ];

  const addPreset = (preset: IndicatorPreset) => {
    if (preset.toggleId) { if (!layers[preset.toggleId]) onToggleLayer(preset.toggleId); return; }
    if (customStudies.some((study) => study.name === preset.name && study.kind === preset.kind && study.period === preset.period)) return;
    onCreate({ id: `indicator-${preset.id}-${Date.now()}`, name: preset.name, kind: preset.kind as ChartStudy["kind"], period: preset.period, color: preset.color, visible: true, source: "native" });
    setTab("chart");
  };

  return <div className="zt-indicators-browser">
    <header className="zt-indicators-header"><div><span className="zt-window-subtitle">CHART TOOLS</span><h2><Layers3 />Indicators</h2></div><button type="button" className="zt-indicators-create" onClick={() => { setCreating(true); setTab("library"); }}><Plus />Create</button></header>
    <div className="zt-indicators-tabs" role="tablist"><button role="tab" aria-selected={tab === "library"} className={cn(tab === "library" && "is-active")} onClick={() => setTab("library")}>Library</button><button role="tab" aria-selected={tab === "chart"} className={cn(tab === "chart" && "is-active")} onClick={() => setTab("chart")}>On chart <span>{active.length}</span></button></div>
    {creating ? <IndicatorCreator onCreate={(study) => { onCreate(study); setCreating(false); setTab("chart"); }} onCancel={() => setCreating(false)} /> : <>
      {tab === "library" && <><div className="zt-indicators-search"><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search indicators" aria-label="Search indicators" /><kbd>⌘ I</kbd></div><div className="zt-indicators-scroll scroll-thin">{(["Trend", "Volume"] as const).map((category) => <section key={category} className="zt-indicator-section"><h3>{category}</h3>{filtered.filter((indicator) => indicator.category === category).map((indicator) => <IndicatorLibraryRow key={indicator.id} indicator={indicator} added={Boolean(indicator.toggleId ? layers[indicator.toggleId] : customStudies.some((study) => study.name === indicator.name && study.kind === indicator.kind && study.period === indicator.period))} onAdd={() => addPreset(indicator)} />)}</section>)}{!filtered.length && <p className="zt-indicators-empty">No supported indicator matches this search.</p>}</div></>}
      {tab === "chart" && <div className="zt-indicators-scroll scroll-thin"><p className="zt-indicators-description">Active indicators use only deterministic native renderer calculations. Visibility and removal update the chart immediately.</p>{active.length ? active.map((indicator) => <ActiveIndicatorRow key={indicator.id} indicator={indicator} builtin={"toggleId" in indicator && Boolean(indicator.toggleId)} onToggle={() => { const preset = PRESETS.find((entry) => entry.id === indicator.id); if (preset?.toggleId) onToggleLayer(preset.toggleId); else { const study = customStudies.find((entry) => entry.id === indicator.id); if (study) onUpdate({ ...study, visible: !study.visible }); } }} onRemove={() => { const study = customStudies.find((entry) => entry.id === indicator.id); if (study) onRemove(study.id); }} />) : <p className="zt-indicators-empty">No indicators are on the chart. Open Library to add a supported calculation.</p>}</div>}
    </>}
    <footer className="zt-indicators-footer">Indicators are rendered locally from verified chart bars. Imported or protected third-party scripts are not executed.</footer>
  </div>;
}

function IndicatorLibraryRow({ indicator, added, onAdd }: { indicator: IndicatorPreset; added: boolean; onAdd: () => void }) {
  return <div className="zt-indicator-library-row"><span className="zt-indicator-color" style={{ backgroundColor: indicator.color }} /><div><b>{indicator.name}</b><p>{indicator.description}</p></div><button type="button" className={cn(added && "is-added")} onClick={onAdd}>{added ? <><Check />Added</> : <><Plus />Add</>}</button></div>;
}

function ActiveIndicatorRow({ indicator, builtin, onToggle, onRemove }: { indicator: { id: string; name: string; description: string; color: string }; builtin: boolean; onToggle: () => void; onRemove: () => void }) {
  return <article className="zt-active-indicator"><span className="zt-indicator-color" style={{ backgroundColor: indicator.color }} /><div><b>{indicator.name}</b><p>{indicator.description}</p></div><button type="button" onClick={onToggle} aria-label={`Hide ${indicator.name}`} title="Toggle visibility"><Eye /></button>{!builtin && <button type="button" onClick={onRemove} aria-label={`Remove ${indicator.name}`} title="Remove"><Trash2 /></button>}<button type="button" className="zt-active-indicator-settings" onClick={onToggle} aria-label={`Edit ${indicator.name}`} title="Toggle visibility"><Settings2 /></button></article>;
}

function IndicatorCreator({ onCreate, onCancel }: { onCreate: (study: ChartStudy) => void; onCancel: () => void }) {
  const [name, setName] = useState("Custom Moving Average");
  const [kind, setKind] = useState<ChartStudy["kind"]>("ema");
  const [period, setPeriod] = useState(34);
  const [color, setColor] = useState("#67e8f9");
  const create = () => onCreate({ id: `custom-indicator-${Date.now()}`, name: name.trim() || "Custom indicator", kind, period: kind === "vwap" ? undefined : Math.max(1, Math.min(1000, period)), color, visible: true, source: "native" });
  return <div className="zt-indicator-creator"><div className="zt-indicator-creator-top"><div><span className="zt-window-subtitle">INDICATOR SETTINGS</span><h3>Create indicator</h3></div><button type="button" onClick={onCancel} aria-label="Close creator"><X /></button></div><div className="zt-indicator-form-tabs"><span className="is-active">Inputs</span><span>Style</span><span>Visibility</span></div><label>Name<input value={name} onChange={(event) => setName(event.target.value)} /></label><label>Calculation<select value={kind} onChange={(event) => setKind(event.target.value as ChartStudy["kind"])}><option value="ema">Moving Average Exponential</option><option value="sma">Moving Average Simple</option><option value="vwap">Session VWAP</option></select></label>{kind !== "vwap" && <label>Length<input type="number" min={1} max={1000} value={period} onChange={(event) => setPeriod(Number(event.target.value))} /></label>}<label>Line color<input type="color" value={color} onChange={(event) => setColor(event.target.value)} /></label><p>Only supported native calculations can be added. Source is close; the selected chart timeframe provides the bars.</p><div><button type="button" onClick={onCancel}>Cancel</button><button type="button" onClick={create}>Add to chart</button></div></div>;
}
