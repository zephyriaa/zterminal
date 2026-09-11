"use client";

import { useMemo, useState } from "react";
import { Eye, EyeOff, Search, Settings2, Star, Trash2 } from "lucide-react";
import { useStudies } from "@/stores/studies";
import { usePanels } from "@/stores/panels";
import { INDICATOR_LIBRARY, searchIndicators, validateStudy, type IndicatorInstance } from "@/lib/indicator-library";
import { BIG_TRADES_OVERLAY_ID, createBigTradesOverlay, sanitizeBigTradesSettings, type ChartOverlayInstance } from "@/lib/chart/overlays/contracts";
import type { ChartStudy } from "./terminal-chart";

export type IndicatorToggleId = "vwap" | "ema20" | "ema50" | "volume" | "profile";
type LegacyProps = { layers?: Record<IndicatorToggleId, boolean>; customStudies?: ChartStudy[]; onToggleLayer?: (id: IndicatorToggleId) => void; onCreate?: (study: ChartStudy) => void; onUpdate?: (study: ChartStudy) => void; onRemove?: (id: string) => void };
type BrowserProps = LegacyProps & { overlays?: ChartOverlayInstance[]; onSetOverlay?: (overlay: ChartOverlayInstance) => void; onRemoveOverlay?: (overlayId: string) => void };

export function IndicatorsBrowser(props: BrowserProps) {
  const { instances, favorites, recent, add, update, remove, toggleFavorite } = useStudies();
  const [filter, setFilter] = useState("All");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const filtered = useMemo(() => searchIndicators(query)
    .filter(item => filter === "All" || filter === "Favorites" && favorites.includes(item.id) || filter === "Recent" && recent.includes(item.id) || item.category === filter)
    .sort((a, b) => filter === "Recent" ? recent.indexOf(a.id) - recent.indexOf(b.id) : 0), [favorites, filter, query, recent]);
  const study = instances.find(item => item.id === editing);
  if (study) return <StudySettings study={study} onSave={next => { update(next); setEditing(null); }} onCancel={() => setEditing(null)} />;
  const addIndicator = (id: string) => {
    if (instances.length >= 50) { setNotice("The chart supports up to 50 indicator instances."); return; }
    add(id);
    setNotice(`${INDICATOR_LIBRARY.find(item => item.id === id)?.name ?? "Indicator"} added to chart.`);
  };
  return <div className="zt-study-browser">
    <div className="zt-study-search"><Search size={14} /><input autoFocus aria-label="Search indicators" placeholder="Name, alias or calculation" value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key !== "Escape") return; if (query) setQuery(""); else usePanels.getState().patch("indicators", { status: "closed" }); }} /></div>
    <div className="zt-study-filters" aria-label="Indicator categories">{["All", "Favorites", "Recent", "Trend", "Volatility", "Volume", "Order Flow", "On chart"].map(value => <button type="button" key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{value}{value === "On chart" ? ` (${instances.length})` : ""}</button>)}</div>
    <p className="zt-study-help">Indicators persist with the chart. Live overlay payloads stay out of React and chart storage.</p>
    <p className="sr-only" aria-live="polite">{notice}</p>
    <div className="zt-study-list">
      {filter === "Order Flow" ? <BigTradesControl overlays={props.overlays ?? []} onSet={props.onSetOverlay} onRemove={props.onRemoveOverlay} /> : null}
      {filter === "On chart" ? instances.map(item => <ActiveStudyRow key={item.id} item={item} onToggle={() => update({ ...item, enabled: !item.enabled })} onEdit={() => setEditing(item.id)} onRemove={() => remove(item.id)} />) : filter !== "Order Flow" ? filtered.length ? filtered.map(item => <article key={item.id} className="zt-study-row"><div className="zt-study-row-top"><strong>{item.name}</strong><button type="button" aria-label={`${favorites.includes(item.id) ? "Unfavorite" : "Favorite"} ${item.name}`} aria-pressed={favorites.includes(item.id)} onClick={() => toggleFavorite(item.id)}><Star size={13} fill={favorites.includes(item.id) ? "currentColor" : "none"} /></button></div><p>{item.description}</p><div className="zt-study-row-bottom"><span>{item.category} / {item.display}</span><button type="button" onClick={() => addIndicator(item.id)} aria-label={`Add ${item.name}`}>+ Add</button></div></article>) : <p className="p-4 text-muted-foreground">No supported indicators match this view.</p> : null}
    </div>
  </div>;
}

function ActiveStudyRow({ item, onToggle, onEdit, onRemove }: { item: IndicatorInstance; onToggle: () => void; onEdit: () => void; onRemove: () => void }) {
  return <article className="zt-study-row"><div className="zt-study-row-top"><strong style={{ color: item.outputs[0]?.color }}>{item.name}</strong><span>{item.kind}</span></div><div className="zt-study-row-bottom"><span>{item.enabled ? `${item.paneId} / ${item.outputs.filter(output => output.visible).length} plots` : "Hidden"}</span><div className="flex gap-2"><button type="button" onClick={onToggle} aria-label={`${item.enabled ? "Hide" : "Show"} ${item.name}`}>{item.enabled ? <Eye size={14} /> : <EyeOff size={14} />}</button><button type="button" onClick={onEdit} aria-label={`Edit ${item.name}`}><Settings2 size={14} /></button><button type="button" onClick={onRemove} aria-label={`Remove ${item.name}`}><Trash2 size={14} /></button></div></div></article>;
}

function BigTradesControl({ overlays, onSet, onRemove }: { overlays: ChartOverlayInstance[]; onSet?: (overlay: ChartOverlayInstance) => void; onRemove?: (overlayId: string) => void }) {
  const existing = overlays.find(overlay => overlay.id === BIG_TRADES_OVERLAY_ID && overlay.type === "big-trades");
  const settings = sanitizeBigTradesSettings(existing?.settings);
  const update = (patch: Partial<typeof settings>) => {
    const base = existing ?? createBigTradesOverlay();
    onSet?.({ ...base, visible: true, settings: sanitizeBigTradesSettings({ ...settings, ...patch }) });
  };
  return <article className="zt-study-row" data-selected={existing?.visible === true}>
    <div className="zt-study-row-top"><strong>Big Trades</strong><span>{existing?.visible ? "On chart" : "Off"}</span></div>
    <p>Observed public prints bucketed by 250 ms, tick price, and aggressor side. Binance aggregate events remain labeled aggregate.</p>
    <label className="mt-2 flex items-center justify-between gap-2 text-[10px] text-muted-foreground">Minimum USD notional<input className="w-28" type="number" min={0} step={50_000} value={settings.minimumNotional} disabled={!existing?.visible} onChange={event => update({ minimumNotional: Number(event.target.value) })} /></label>
    <div className="zt-study-row-bottom"><span>{settings.maxVisible} max bubbles / {settings.opacity.toFixed(2)} opacity</span><button type="button" onClick={() => existing?.visible ? onRemove?.(BIG_TRADES_OVERLAY_ID) : onSet?.(createBigTradesOverlay())}>{existing?.visible ? "Remove" : "+ Add"}</button></div>
  </article>;
}

function StudySettings({ study, onSave, onCancel }: { study: IndicatorInstance; onSave: (next: IndicatorInstance) => void; onCancel: () => void }) {
  const [draft, setDraft] = useState(study);
  const [error, setError] = useState("");
  return <form className="zt-study-settings" onSubmit={event => { event.preventDefault(); try { validateStudy(draft); onSave(draft); } catch (cause) { setError((cause as Error).message); } }}><span className="text-[9px] uppercase tracking-widest text-muted-foreground">Indicator instance / {study.kind}</span><h3>{study.name}</h3><label>Name<input maxLength={80} value={draft.name} onChange={event => setDraft(current => ({ ...current, name: event.target.value }))} /></label><label className="flex items-center gap-2"><input type="checkbox" checked={draft.enabled} onChange={event => setDraft(current => ({ ...current, enabled: event.target.checked }))} />Enabled on chart</label>{draft.outputs.map((output, index) => <fieldset className="zt-study-output" key={output.id}><legend>{output.label}</legend><label>Color<input type="color" value={output.color} onChange={event => setDraft(current => ({ ...current, outputs: current.outputs.map((item, itemIndex) => itemIndex === index ? { ...item, color: event.target.value } : item) }))} /></label><label className="flex items-center gap-2"><input type="checkbox" checked={output.visible} onChange={event => setDraft(current => ({ ...current, outputs: current.outputs.map((item, itemIndex) => itemIndex === index ? { ...item, visible: event.target.checked } : item) }))} />Plot visible</label></fieldset>)}{error ? <p role="alert">{error}</p> : null}<div className="zt-study-settings-actions"><button type="button" onClick={onCancel}>Cancel</button><button type="submit">Apply</button></div></form>;
}
