import { useEffect, useMemo, useRef, useState } from "react";
import { BarChart3, Code2, Heart, Plus, Search, Settings2, ShieldAlert, SlidersHorizontal, X } from "lucide-react";
import { NATIVE_STUDY_CATALOG, NATIVE_STUDY_CATEGORIES, type NativeStudyConfig, type NativeStudyDescriptor, type NativeStudyId } from "@shared/indicators/nativeStudies";
import type { CompiledIndicator } from "@shared/indicators/indicatorRuntime";
import type { ResearchLayerId } from "@/lib/terminalWorkspace";

export type IndicatorBrowserTab = "builtins" | "favorites" | "mine" | "gated";

type Props = {
  nativeStudies: NativeStudyConfig[];
  favorites: NativeStudyId[];
  activeLayers: ResearchLayerId[];
  customIndicators: CompiledIndicator[];
  intrabarState: "checking" | "available" | "unavailable";
  intrabarDetail: string;
  onToggleNative: (id: NativeStudyId) => void;
  onUpdateNative: (id: NativeStudyId, inputs: Record<string, number>) => void;
  onToggleFavorite: (id: NativeStudyId) => void;
  onToggleLayer: (id: ResearchLayerId) => void;
  onCreateIndicator: () => void;
  onClose: () => void;
  embedded?: boolean;
};

const legacyDataStudies: Array<{ id: ResearchLayerId; label: string; detail: string; enabled: boolean }> = [
  { id: "cvd", label: "Live Cumulative Volume Delta", detail: "Current bounded Gate.io public tape only. Withheld when the selected tape is not live.", enabled: true },
  { id: "tape", label: "Time & Sales", detail: "Current venue-labelled public tape only; no historical tick replay.", enabled: true },
  { id: "dom", label: "Live DOM", detail: "Current reconciled Gate.io public depth only; not executable liquidity.", enabled: true },
  { id: "footprint", label: "Live Footprint", detail: "Current bounded public-tape aggregation, not candle volume.", enabled: true },
  { id: "gex", label: "Gamma Exposure", detail: "Options-chain and Greeks provider required.", enabled: false },
];

function inputLabel(key: string) {
  return ({ length: "Length", fast: "Fast length", slow: "Slow length", signal: "Signal length", smooth: "Smoothing", mult: "Deviation multiplier" } as Record<string, string>)[key] ?? key;
}

function inputBounds(key: string) {
  if (key === "mult") return { min: 0.1, max: 5, step: 0.1 };
  if (key === "signal" || key === "smooth") return { min: 1, max: 100, step: 1 };
  return { min: 1, max: 500, step: 1 };
}

function StudyRow({ study, installed, favorite, intrabarState, intrabarDetail, onInstall, onFavorite, onConfigure }: { study: NativeStudyDescriptor; installed: boolean; favorite: boolean; intrabarState: "checking" | "available" | "unavailable"; intrabarDetail: string; onInstall: () => void; onFavorite: () => void; onConfigure: () => void }) {
  const gated = study.dataContract !== "LOADED_VERIFIED_OHLCV";
  const canInstallGated = study.dataContract === "VERIFIED_INTRABAR" && intrabarState === "available";
  const detail = gated ? (canInstallGated ? `Available · ${intrabarDetail}` : intrabarState === "checking" ? "Checking verified intrabar coverage for this range…" : study.dataGate) : study.description;
  return <article className={`indicator-browser-row ${gated ? "gated" : ""}`}>
    <button className="indicator-row-main" onClick={gated ? onConfigure : onInstall} aria-label={`${gated ? "Inspect" : installed ? "Remove" : "Add"} ${study.label}`}>
      <span className="indicator-row-icon">{gated ? <ShieldAlert size={15} /> : <BarChart3 size={15} />}</span>
      <span><b>{study.label}</b><small>{study.category} · {study.pane === "overlay" ? "Overlay" : study.pane === "volume" ? "Volume pane" : "New pane"}</small><em>{detail}</em></span>
    </button>
    <div className="indicator-row-actions">
      <button className={favorite ? "favorite active" : "favorite"} onClick={onFavorite} aria-label={`${favorite ? "Remove" : "Add"} ${study.label} ${favorite ? "from" : "to"} favorites`}><Heart size={14} /></button>
      {gated ? canInstallGated ? (installed ? <button className="configure-study" onClick={onConfigure} aria-label={`Configure ${study.label}`}><Settings2 size={14} /></button> : <button className="add-study" onClick={onInstall}><Plus size={14} /> Add</button>) : <button className="inspect-gate" onClick={onConfigure}>{intrabarState === "checking" ? "Checking" : "Details"}</button> : installed ? <button className="configure-study" onClick={onConfigure} aria-label={`Configure ${study.label}`}><Settings2 size={14} /></button> : <button className="add-study" onClick={onInstall}><Plus size={14} /> Add</button>}
    </div>
  </article>;
}

export function IndicatorsDialog({ nativeStudies, favorites, activeLayers, customIndicators, intrabarState, intrabarDetail, onToggleNative, onUpdateNative, onToggleFavorite, onToggleLayer, onCreateIndicator, onClose, embedded = false }: Props) {
  const searchRef = useRef<HTMLInputElement | null>(null);
  const [tab, setTab] = useState<IndicatorBrowserTab>("builtins");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<"All" | (typeof NATIVE_STUDY_CATEGORIES)[number]>("All");
  const [selectedId, setSelectedId] = useState<NativeStudyId | null>(null);
  const installed = useMemo(() => new Map(nativeStudies.map((item) => [item.id, item])), [nativeStudies]);
  const selected = selectedId ? NATIVE_STUDY_CATALOG.find((study) => study.id === selectedId) ?? null : null;
  const selectedConfig = selected ? installed.get(selected.id) : undefined;

  useEffect(() => { searchRef.current?.focus(); }, []);
  useEffect(() => { if (selectedId && !NATIVE_STUDY_CATALOG.some((study) => study.id === selectedId)) setSelectedId(null); }, [selectedId]);

  const filtered = NATIVE_STUDY_CATALOG.filter((study) => {
    const text = `${study.label} ${study.shortLabel} ${study.category} ${study.description}`.toLowerCase();
    const searchMatches = !query.trim() || text.includes(query.trim().toLowerCase());
    const categoryMatches = category === "All" || study.category === category;
    const tabMatches = tab === "builtins" ? study.dataContract === "LOADED_VERIFIED_OHLCV" : tab === "favorites" ? favorites.includes(study.id) : tab === "gated" ? study.dataContract !== "LOADED_VERIFIED_OHLCV" : false;
    return searchMatches && categoryMatches && tabMatches;
  });

  const configure = (id: NativeStudyId) => { setSelectedId(id); };
  const closeSettings = () => setSelectedId(null);
  const updateInput = (key: string, raw: string) => {
    if (!selected) return;
    const bounds = inputBounds(key); const parsed = Number(raw);
    const value = Number.isFinite(parsed) ? Math.min(bounds.max, Math.max(bounds.min, parsed)) : selected.defaultInputs[key]!;
    const current = selectedConfig?.inputs ?? selected.defaultInputs;
    onUpdateNative(selected.id, { ...current, [key]: value });
  };

  return <section className={`indicators-dialog ${embedded ? "embedded-indicators-dialog" : ""}`} role="dialog" aria-modal={embedded ? undefined : true} aria-label="Indicators">
    {!embedded && <header className="indicator-dialog-header"><div><span className="drawer-kicker">Studies</span><h2>Indicators</h2></div><button onClick={onClose} aria-label="Close indicators"><X size={16} /></button></header>}
    <div className="indicator-search"><Search size={15} /><input ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search indicators" aria-label="Search indicators" /><kbd>Esc</kbd></div>
    <nav className="indicator-tabs" role="tablist" aria-label="Indicator catalog"><button className={tab === "builtins" ? "active" : ""} onClick={() => setTab("builtins")} role="tab" aria-selected={tab === "builtins"}>Built-ins</button><button className={tab === "favorites" ? "active" : ""} onClick={() => setTab("favorites")} role="tab" aria-selected={tab === "favorites"}>Favorites <small>{favorites.length}</small></button><button className={tab === "mine" ? "active" : ""} onClick={() => setTab("mine")} role="tab" aria-selected={tab === "mine"}>My indicators <small>{customIndicators.length}</small></button><button className={tab === "gated" ? "active" : ""} onClick={() => setTab("gated")} role="tab" aria-selected={tab === "gated"}>Data-gated</button></nav>
    {tab !== "mine" && <div className="indicator-category-strip" aria-label="Indicator categories"><button className={category === "All" ? "active" : ""} onClick={() => setCategory("All")}>All</button>{NATIVE_STUDY_CATEGORIES.map((item) => <button key={item} className={category === item ? "active" : ""} onClick={() => setCategory(item)}>{item}</button>)}</div>}
    <div className="indicator-catalog">
      {tab === "mine" ? <section className="my-indicators-panel"><div><Code2 size={16} /><span><b>Indicator Lab</b><small>Local closed-formula studies over loaded verified OHLCV candles.</small></span><button className="add-study" onClick={onCreateIndicator}><Plus size={14} /> Create</button></div>{customIndicators.length ? customIndicators.map((indicator) => <article key={indicator.definition.name}><span><b>{indicator.definition.name}</b><small>{indicator.definition.output.pane === "overlay" ? "Overlay" : "New pane"} · closed AST runtime</small></span><em>Active on this chart</em></article>) : <p>Create a bounded formula in Indicator Lab. Pine Script, external code, network access, and strategy execution are not available.</p>}</section> : <>{filtered.length ? filtered.map((study) => <StudyRow key={study.id} study={study} installed={installed.has(study.id)} favorite={favorites.includes(study.id)} intrabarState={intrabarState} intrabarDetail={intrabarDetail} onInstall={() => onToggleNative(study.id)} onFavorite={() => onToggleFavorite(study.id)} onConfigure={() => configure(study.id)} />) : <div className="indicator-empty"><SlidersHorizontal size={18} /><b>No matching indicators</b><span>Adjust search, category, or favorites.</span></div>}{tab === "gated" && <section className="legacy-data-studies"><h3>Current-source studies</h3>{legacyDataStudies.map((study) => <article key={study.id}><span><b>{study.label}</b><small>{study.detail}</small></span>{study.enabled ? <button className={activeLayers.includes(study.id) ? "add-study active" : "add-study"} onClick={() => onToggleLayer(study.id)}>{activeLayers.includes(study.id) ? "Remove" : "Add"}</button> : <em>Provider required</em>}</article>)}</section>}</>}
    </div>
    {selected && <aside className="indicator-settings-panel" aria-label={`${selected.label} settings`}><header><div><span className="drawer-kicker">{selected.dataContract === "LOADED_VERIFIED_OHLCV" ? "Native study" : "Data contract"}</span><h3>{selected.label}</h3></div><button onClick={closeSettings} aria-label="Close indicator settings"><X size={15} /></button></header><p>{selected.description}</p><div className="indicator-contract"><b>{selected.dataContract === "LOADED_VERIFIED_OHLCV" ? "Loaded verified OHLCV" : selected.dataContract === "LIVE_VENUE_TAPE" ? "Current live venue tape" : "Verified intrabar coverage"}</b><small>{selected.dataGate ?? `Warmup: ${selected.warmup}. No look-ahead.`}</small></div>{selected.dataContract === "LOADED_VERIFIED_OHLCV" && <>{Object.keys(selected.defaultInputs).length ? <div className="indicator-inputs">{Object.entries(selected.defaultInputs).map(([key, defaultValue]) => { const bounds = inputBounds(key); const value = selectedConfig?.inputs?.[key] ?? defaultValue; return <label key={key}>{inputLabel(key)}<input type="number" min={bounds.min} max={bounds.max} step={bounds.step} value={value} onChange={(event) => updateInput(key, event.target.value)} /></label>; })}</div> : <small className="no-indicator-inputs">This study uses the full loaded verified window and has no configurable inputs.</small>}<button className={installed.has(selected.id) ? "add-study active full" : "add-study full"} onClick={() => onToggleNative(selected.id)}>{installed.has(selected.id) ? "Remove from chart" : "Add to chart"}</button></>}{selected.dataContract !== "LOADED_VERIFIED_OHLCV" && <div className="indicator-gate-detail"><ShieldAlert size={16} /><span><b>{intrabarState === "available" ? "Verified intrabar coverage available" : intrabarState === "checking" ? "Checking intrabar coverage" : "Withheld by design"}</b><small>{intrabarState === "available" ? intrabarDetail : intrabarState === "checking" ? "The study remains withheld until the bounded provider preflight completes." : selected.dataGate}</small></span></div>}{selected.dataContract !== "LOADED_VERIFIED_OHLCV" && intrabarState === "available" && <button className={installed.has(selected.id) ? "add-study active full" : "add-study full"} onClick={() => onToggleNative(selected.id)}>{installed.has(selected.id) ? "Remove from chart" : "Add estimated study"}</button>}</aside>}
  </section>;
}
