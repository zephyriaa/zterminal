"use client";
import { useMemo, useState } from "react";
import { Eye, EyeOff, Search, Settings2, Star, Trash2 } from "lucide-react";
import { useStudies } from "@/stores/studies";
import { usePanels } from "@/stores/panels";
import { INDICATOR_LIBRARY, searchIndicators, validateStudy, type IndicatorInstance } from "@/lib/indicator-library";
import type { ChartStudy } from "./terminal-chart";
export type IndicatorToggleId = "vwap" | "ema20" | "ema50" | "volume" | "profile";
// Compatibility for the preserved experimental shell. The active site uses the shared store.
type LegacyProps = { layers?: Record<IndicatorToggleId, boolean>; customStudies?: ChartStudy[]; onToggleLayer?: (id: IndicatorToggleId) => void; onCreate?: (study: ChartStudy) => void; onUpdate?: (study: ChartStudy) => void; onRemove?: (id: string) => void };

export function IndicatorsBrowser(_props: LegacyProps) {
  const { instances, favorites, recent, add, update, remove, toggleFavorite } = useStudies();
  const [filter, setFilter] = useState("All");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const [editing, setEditing] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const filtered = useMemo(() => searchIndicators(query).filter(p => filter === "All" || filter === "Favorites" && favorites.includes(p.id) || filter === "Recent" && recent.includes(p.id) || p.category === filter).sort((a, b) => filter === "Recent" ? recent.indexOf(a.id) - recent.indexOf(b.id) : 0), [query, filter, favorites, recent]);
  const study = instances.find(p => p.id === editing);
  const addIndicator = (id: string) => {
    if (instances.length >= 50) { setNotice("The chart supports up to 50 indicator instances."); return; }
    add(id); setNotice(`${INDICATOR_LIBRARY.find(p => p.id === id)?.name} added to chart.`);
  };
  if (study) return <StudySettings key={study.id} study={study} onSave={next => { update(next); setEditing(null); }} onCancel={() => setEditing(null)} />;
  return <div className="zt-study-browser">
    <div className="zt-study-search"><Search size={14} /><input autoFocus aria-label="Search indicators" placeholder="Name, alias or calculation" value={query} onChange={event => { setQuery(event.target.value); setSelected(0); }} onKeyDown={event => {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); setSelected(i => Math.max(0, Math.min(filtered.length - 1, i + (event.key === "ArrowDown" ? 1 : -1)))); }
      if (event.key === "Enter" && filtered[selected]) { event.preventDefault(); addIndicator(filtered[selected].id); }
      if (event.key === "Escape") { if (query) { setQuery(""); setSelected(0); } else usePanels.getState().patch("indicators", { status: "closed" }); }
    }} aria-describedby="indicator-keyboard-help" /></div>
    <div className="zt-study-filters" aria-label="Indicator categories">{["All", "Favorites", "Recent", "Trend", "Volatility", "Volume", "On chart"].map(value => <button key={value} aria-pressed={filter === value} onClick={() => { setFilter(value); setSelected(0); }}>{value}{value === "On chart" ? ` (${instances.length})` : ""}</button>)}</div>
    <p id="indicator-keyboard-help" className="zt-study-help">↑ ↓ select · Enter adds · Esc clears or closes</p>
    <p className="sr-only" aria-live="polite">{notice || (filtered[selected] ? `Selected ${filtered[selected].name}` : "No matching indicators")}</p>
    <div className="zt-study-list">
      {filter !== "On chart" ? filtered.length ? filtered.map((item, i) => <article key={item.id} data-selected={i === selected} className="zt-study-row">
        <div className="zt-study-row-top"><strong>{item.name}</strong><button aria-label={`${favorites.includes(item.id) ? "Unfavorite" : "Favorite"} ${item.name}`} aria-pressed={favorites.includes(item.id)} onClick={() => toggleFavorite(item.id)}><Star size={13} fill={favorites.includes(item.id) ? "currentColor" : "none"} /></button></div>
        <p>{item.description}</p><div className="zt-study-row-bottom"><span>{item.category} / {item.display}</span><button onClick={() => addIndicator(item.id)} aria-label={`Add ${item.name}`}>+ Add</button></div>
      </article>) : <p className="p-4 text-muted-foreground">No supported indicators match this view.</p> : instances.map(item => <article key={item.id} className="zt-study-row">
        <div className="zt-study-row-top"><strong style={{ color: item.color }}>{item.name}</strong><span>{item.period ? `${item.period} bars` : item.kind}</span></div>
        <div className="zt-study-row-bottom"><span>{item.visible ? "Visible" : "Hidden"}</span><div className="flex gap-2"><button onClick={() => update({ ...item, visible: !item.visible })} aria-label={`${item.visible ? "Hide" : "Show"} ${item.name}`}>{item.visible ? <Eye size={14} /> : <EyeOff size={14} />}</button><button aria-label={`Edit ${item.name}`} onClick={() => setEditing(item.id)}><Settings2 size={14} /></button><button aria-label={`Remove ${item.name}`} onClick={() => remove(item.id)}><Trash2 size={14} /></button></div></div>
      </article>)}
    </div>
    <footer className="zt-study-help">Calculations use the selected chart dataset. Settings and studies are saved in this browser.</footer>
  </div>;
}

function StudySettings({ study, onSave, onCancel }: { study: IndicatorInstance; onSave: (next: IndicatorInstance) => void; onCancel: () => void }) {
  const [draft, setDraft] = useState(study);
  const [error, setError] = useState("");
  const set = (patch: Partial<IndicatorInstance>) => setDraft(s => ({ ...s, ...patch }));
  return <form className="zt-study-settings" onSubmit={event => { event.preventDefault(); try { validateStudy(draft); onSave(draft); } catch (error) { setError((error as Error).message); } }}>
    <span className="text-[9px] uppercase tracking-widest text-muted-foreground">Indicator settings / {study.kind}</span><h3>{study.name}</h3>
    <label>Name<input maxLength={80} value={draft.name} onChange={e => set({ name: e.target.value })} /></label>
    {!["volume", "profile", "vwap"].includes(study.kind) && <label>Length (bars)<input type="number" min={1} max={1000} step={1} value={draft.period ?? ""} onChange={e => set({ period: e.target.value === "" ? undefined : Number(e.target.value) })} required /></label>}
    {study.kind === "bollinger" && <label>Standard deviations<input type="number" min={.1} max={10} step={.1} value={draft.multiplier ?? ""} onChange={e => set({ multiplier: Number(e.target.value) })} required /></label>}
    {!["volume", "profile"].includes(study.kind) && <label>Line color<input type="color" value={draft.color} onChange={e => set({ color: e.target.value })} /></label>}
    <label className="flex items-center gap-2"><input type="checkbox" checked={draft.visible} onChange={e => set({ visible: e.target.checked })} />Visible on chart</label>
    {error && <p role="alert">{error}</p>}<div className="flex gap-3"><button type="button" onClick={onCancel}>Cancel</button><button type="submit">Apply settings</button></div>
  </form>;
}
