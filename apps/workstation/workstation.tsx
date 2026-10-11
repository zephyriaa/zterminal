import { useEffect, useRef, useState, type ReactNode } from "react";
import { Activity, BarChart3, CalendarDays, CircleUserRound, Database, Check, ChevronDown, Code2, FlaskConical, FolderOpen, Layers3, Maximize2, Minimize2, PanelLeftClose, RotateCcw, Search, Settings2, X, type LucideIcon } from "lucide-react";
import { LocalHistoryChart } from "../../src/components/terminal/observed-history-chart";
import type { Bar } from "../../src/lib/market/types";
import type { LocalSummary, LocalWorkspace, WorkstationPlatform } from "../../src/lib/workstation-platform";
import { defaultShellPreferences, type ShellPreferences } from "../../src/lib/workstation-platform";
import mark from "./assets/mark.png?url";

type View = "chart" | "studio" | "results" | "context" | "library";
function IconButton({ label, icon: Icon, onClick, disabled = false }: { label: string; icon: LucideIcon; onClick?: () => void; disabled?: boolean }) {
  return <button className="icon-button" aria-label={label} title={label} onClick={onClick} disabled={disabled}><Icon size={14} aria-hidden="true" /></button>;
}
function Group({ title, icon: Icon, children, tools }: { title: string; icon: LucideIcon; children: ReactNode; tools?: ReactNode }) {
  return <section className="group"><div className="tabbar"><span className="tab active"><Icon size={13} aria-hidden="true" />{title}</span><span className="grow" />{tools}</div>{children}</section>;
}

export function LocalWorkstation({ platform }: { platform: WorkstationPlatform }) {
  const [list, setList] = useState<LocalSummary[]>([]);
  const [workspace, setWorkspace] = useState<LocalWorkspace | null>(null);
  const [bars, setBars] = useState<Bar[]>([]);
  const [name, setName] = useState("");
  const [first, setFirst] = useState(0);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("Opening local storage…");
  const [dirty, setDirty] = useState(false);
  const [symbol, setSymbol] = useState("");
  const [interval, setInterval] = useState(60000);
  const [tick, setTick] = useState("0.01");
  const [quantity, setQuantity] = useState("0.000001");
  const [view, setView] = useState<View>("chart");
  const [collapsed, setCollapsed] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const [editorTab, setEditorTab] = useState("Python strategy");
  const [search, setSearch] = useState("");
  const [preferences, setPreferences] = useState(defaultShellPreferences);
  const [draftPreferences, setDraftPreferences] = useState(defaultShellPreferences);
  const [preferencePage, setPreferencePage] = useState("Appearance");
  const [preferenceError, setPreferenceError] = useState("");
  const [savingPreferences, setSavingPreferences] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const preferenceOpener = useRef<HTMLElement | null>(null);
  const range = useRef<{ from: number | null; to: number | null }>({ from: null, to: null });
  const pending = useRef(false);

  async function display(w: LocalWorkspace | null, start?: number) {
    setWorkspace(w); setName(w?.document.name ?? ""); setBars([]); setDirty(false);
    range.current = { from: w?.chart.visibleFromMs ?? null, to: w?.chart.visibleToMs ?? null };
    if (w?.dataset) {
      const offset = start ?? Math.max(0, Math.min(w.dataset.count - 1, Math.floor(((w.chart.visibleFromMs ?? w.dataset.fromMs) - w.dataset.fromMs) / w.dataset.intervalMs)));
      setFirst(offset);
      const scene = await platform.scene(w.document.id, offset, Math.min(2000, w.dataset.count - offset));
      setBars(scene);
      if (range.current.from == null && scene.length > 1) range.current = { from: scene[0].t, to: scene[scene.length - 1].t };
    }
  }
  async function perform(action: () => Promise<void>) {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError("");
    try { await action(); } catch (e) { setError(String(e)); setStatus("Operation failed"); }
    finally { pending.current = false; setBusy(false); }
  }
  useEffect(() => {
    void perform(async () => {
      setList(await platform.list()); await display(await platform.restore()); setStatus("Local storage ready");
      try { setPreferences(await platform.preferences()); } catch (e) { setPreferenceError(String(e)); }
    });
    // Single mount; the platform is fixed for the window lifetime.
  }, []);
  function canLeave() { return !dirty || window.confirm("Discard unsaved workspace name or chart range changes?"); }

  function openPreferences() {
    preferenceOpener.current = document.activeElement as HTMLElement;
    setDraftPreferences(preferences); setPreferencePage("Appearance"); dialog.current?.showModal();
  }
  function resetLayout() { setView("chart"); setCollapsed(false); setMaximized(false); setEditorTab("Python strategy"); }
  async function savePreferences(value: ShellPreferences) {
    setSavingPreferences(true); setPreferenceError("");
    try { const saved = await platform.savePreferences(value); setPreferences(saved); setDraftPreferences(saved); setStatus("Appearance saved on this device"); }
    catch (e) { setPreferenceError(String(e)); }
    finally { setSavingPreferences(false); }
  }
  const nav: [View, LucideIcon, string, string][] = [["chart", BarChart3, "Chart", "Market canvas"], ["studio", Code2, "Strategy Developer", "Python research"], ["results", FlaskConical, "Research", "Reports and archive"], ["context", Activity, "Market Context", "Feed and contract"], ];
  const context = <Group title="Market Context" icon={Activity}><div className="context panel-content"><h2>{workspace?.dataset?.symbol ?? "No instrument selected"}</h2><p>Imported historical data · UTC</p><dl><dt>Data availability</dt><dd>{workspace?.dataset ? `${workspace.dataset.count.toLocaleString()} bars` : "Unavailable"}</dd><dt>Source</dt><dd>{workspace?.dataset?.sourceName ?? "Import required"}</dd><dt>Provider connection</dt><dd>Disconnected</dd><dt>Workspace revision</dt><dd>{workspace?.document.revision ?? "—"}</dd></dl><div className="context-note">Validation and integrity verified locally; exchange origin and live freshness are unverified.</div>{workspace?.dataset && <p className="mono hash">SHA-256 {workspace.dataset.source.sha256}</p>}</div></Group>;
  const research = <Group title={view === "results" ? "Evidence report" : "Research source"} icon={view === "results" ? FlaskConical : Code2}><div className="research-tabs" role="group" aria-label="Research presentations">{["Python strategy", "Evidence"].map(tab => <button key={tab} aria-pressed={editorTab === tab} onClick={() => setEditorTab(tab)}>{tab}</button>)}</div><div className="panel-content research-empty"><Code2 size={24} aria-hidden="true" /><h2>{editorTab === "Python strategy" ? "No research source open" : "No archived run available"}</h2><p>{editorTab === "Python strategy" ? "Local editor and supervised jobs become available in the research milestone." : "Evidence requires a completed archived run."}</p><button disabled title="Requires the research execution milestone">Run locally</button><p className="muted">Runtime unavailable · no job started</p></div></Group>;

  return <main className={`workstation ${busy ? "busy" : ""} ${collapsed ? "collapsed" : ""} ${maximized ? "max-chart" : ""} ${view === "studio" || view === "results" ? "focused" : ""}`} data-material={preferences.material} data-density={preferences.density} data-reduced-motion={preferences.reducedMotion} aria-busy={busy}>
    <header className="header"><button className="brand" aria-label="Focus chart workspace" onClick={() => { setView("chart"); setMaximized(false); }}><img src={mark} alt="ZTerminal" /></button><span className="vline" /><button className="instrument" onClick={() => setView("context")}><strong className="mono">{workspace?.dataset?.symbol ?? "No dataset"}</strong><small>{workspace?.dataset ? "Local CSV" : "Import required"}</small><ChevronDown size={13} aria-hidden="true" /></button><div className="workspace-label">RESEARCH WORKSPACE<small>Write / backtest / inspect</small></div><span className="grow" /><div className="utility"><IconButton label="Economic calendar (planned)" icon={CalendarDays} disabled /><IconButton label="Python strategy developer" icon={Code2} onClick={() => setView("studio")} /><IconButton label="Search local workspaces" icon={Search} onClick={() => setView("library")} /><IconButton label="Terminal preferences" icon={Settings2} onClick={openPreferences} /><span className="vline" /><span className="local-badge">Local workspace<small>Offline · On this device</small></span></div></header>
    <div className="body">
      <aside className="sidebar"><div className="sidebar-title"><span className="copy"><b>ZTERMINAL</b><small>Research terminal</small></span><span className="grow" /><IconButton label={collapsed ? "Expand sidebar" : "Collapse sidebar"} icon={PanelLeftClose} onClick={() => setCollapsed(!collapsed)} /></div><div className="section-label copy">WORKSPACE</div><nav className="nav" aria-label="Workspace navigation">{nav.map(([target, Icon, title, subtitle]) => <span key={target}><button aria-label={title} aria-pressed={view === target} className={view === target ? "active" : ""} onClick={() => { setView(target); if (target === "results") setEditorTab("Evidence"); if (target === "studio") setEditorTab("Python strategy"); setMaximized(false); }} title={title}><Icon size={16} aria-hidden="true" /><span className="copy"><b>{title}</b><small>{subtitle}</small></span></button>{target === "chart" && <button disabled title="Studies require the data and chart milestone" aria-label="Indicators"><Layers3 size={16} aria-hidden="true" /><span className="copy"><b>Indicators</b><small>Studies and overlays</small></span></button>}</span>)}<button disabled title="Economic events are planned" aria-label="Calendar"><CalendarDays size={16} aria-hidden="true" /><span className="copy"><b>Calendar</b><small>Economic events</small></span></button><button onClick={openPreferences} aria-label="Settings"><Settings2 size={16} aria-hidden="true" /><span className="copy"><b>Settings</b><small>Terminal preferences</small></span></button><div className="section-label copy">LOCAL LIBRARY</div><button aria-label="Workspaces" aria-pressed={view === "library"} onClick={() => { setView("library"); setMaximized(false); }} title="Workspaces"><FolderOpen size={16} aria-hidden="true" /><span className="copy"><b>Workspaces</b><small>Projects on this device</small></span></button><button aria-label="Datasets" onClick={() => { setView("context"); setMaximized(false); }} title="Inspect current workspace dataset"><Database size={16} aria-hidden="true" /><span className="copy"><b>Datasets</b><small>Current import and coverage</small></span></button></nav><div className="sidebar-footer"><button aria-label="Reset layout" onClick={resetLayout} title="Reset presentation; preserve workspace and history"><RotateCcw size={14} aria-hidden="true" /><span className="copy">Reset Layout</span></button><small className="copy">Data stays on this device</small></div>
      </aside>
      <div className={`dock view-${view}`}>
      <section className={`group chart-group ${view === "context" ? "small-hidden" : ""}`}><div className="tabbar"><span className="tab active"><BarChart3 size={13} aria-hidden="true" />Primary Chart</span><span className="grow" /><IconButton label={maximized ? "Restore chart layout" : "Maximize chart"} icon={maximized ? Minimize2 : Maximize2} onClick={() => { setView("chart"); setMaximized(!maximized); }} /><IconButton label="Chart preferences" icon={Settings2} onClick={openPreferences} /></div><div className="workspace-controls">
      <h2>Workspaces</h2>
        <button disabled={busy} onClick={() => {
          if (!canLeave()) return;
          void perform(async () => { await display(await platform.create(crypto.randomUUID(), "Local research")); setList(await platform.list()); setStatus("Workspace created locally"); });
        }}>New workspace</button>
      </div>
      {view === "library" && <div className="library panel-content"><label>Search workspaces<input aria-label="Search workspaces" value={search} onChange={e => setSearch(e.target.value)} /></label>
        {list.filter(w => w.name.toLowerCase().includes(search.toLowerCase())).map(w => <button key={w.id} className={workspace?.document.id === w.id ? "selected" : ""} disabled={busy} onClick={() => {
          if (canLeave()) void perform(async () => { await display(await platform.open(w.id)); setStatus("Workspace opened locally"); });
        }}>{w.name}<small>Local · revision {w.revision}</small></button>)}
        {!list.length && <p>No saved workspaces yet.</p>}
        {list.length > 0 && !list.some(w => w.name.toLowerCase().includes(search.toLowerCase())) && <p>No matching workspaces.</p>}
      </div>}
      <section className="content">
        {!list.length && view !== "library" && <p className="no-workspaces">No saved workspaces yet.</p>}
        {error && <p role="alert" className="error">{error}</p>}
        {!workspace ? <div className="empty"><h1>Your local research workspace</h1><p>Create a workspace, then import historical data from a local CSV file.</p><p>Data is unavailable until you import it. The workstation makes no market or cloud connection.</p>
          {error && <button disabled={busy} onClick={() => void perform(async () => { setList(await platform.list()); await display(await platform.restore()); setStatus("Local storage ready"); })}>Retry local storage</button>}
        </div> : <>
          <div className="toolbar"><label>Workspace<input aria-label="Workspace name" value={name} disabled={busy} maxLength={256} onChange={e => { setName(e.target.value); setDirty(true); }} /></label>
            <button disabled={busy || !name.trim()} onClick={() => void perform(async () => {
              const saved = await platform.save(workspace, name, range.current.from, range.current.to);
              setWorkspace(saved); setDirty(false); setList(await platform.list()); setStatus("Saved to this device");
            })}>Save workspace</button><span>{dirty ? "Unsaved changes" : "Saved locally"}</span>
          </div>
          <details className="import"><summary>Import local history</summary>
            <p>Strict CSV header: <code>t,o,h,l,c,v</code>. UTC epoch milliseconds; prices and volume must match the increments below. Only contiguous, closed candles with positive volume are accepted. No rows are repaired or filled.</p>
            <fieldset disabled={busy}><label>Symbol<input aria-label="Import symbol" value={symbol} maxLength={80} onChange={e => setSymbol(e.target.value)} /></label>
              <label>Interval<select aria-label="Import interval" value={interval} onChange={e => setInterval(Number(e.target.value))}>{[[60000,"1m"],[300000,"5m"],[900000,"15m"],[1800000,"30m"],[3600000,"1h"],[14400000,"4h"],[86400000,"1d"]].map(([value,text]) => <option key={value} value={value}>{text}</option>)}</select></label>
              <label>Price increment<input aria-label="Price increment" type="number" min="0" step="any" value={tick} onChange={e => setTick(e.target.value)} /></label>
              <label>Quantity increment<input aria-label="Quantity increment" type="number" min="0" step="any" value={quantity} onChange={e => setQuantity(e.target.value)} /></label>
              <label className="file">Select CSV<input aria-label="Select CSV" type="file" accept=".csv,text/csv" disabled={!symbol.trim() || !(Number(tick)>0) || !(Number(quantity)>0)} onChange={e => {
                const file=e.target.files?.[0]; e.target.value=""; if (!file) return;
                if (!canLeave()) return;
                void perform(async () => {
                  if (file.size > 8*1024*1024) throw new Error("Import exceeds 8 MiB");
                  const imported = await platform.import(workspace, { csv:await file.text(),sourceName:file.name,symbol:symbol.trim(),intervalMs:interval,tickSize:Number(tick),quantityStep:Number(quantity) });
                  await display(imported); setList(await platform.list()); setStatus("History validated, imported and saved locally");
                });
              }} /></label>
            </fieldset>
          </details>
          {workspace.dataset ? <>
            <div className="data-info"><strong>{workspace.dataset.symbol} · Imported historical data</strong><span>{workspace.dataset.count.toLocaleString()} bars · {workspace.dataset.sourceName}</span><small>SHA-256 {workspace.dataset.source.sha256}</small><small>Validation and integrity verified locally; exchange origin and live freshness are unverified.</small></div>
            <div className="chart-tools"><button disabled={busy || first===0} onClick={() => void perform(async () => { await display({...workspace,chart:{...workspace.chart,visibleFromMs:null,visibleToMs:null}},Math.max(0,first-2000)); setDirty(true); })}>Earlier history</button>
              <span>Bars {first+1}–{first+bars.length}</span>
              <button disabled={busy || first+2000>=workspace.dataset.count} onClick={() => void perform(async () => { await display({...workspace,chart:{...workspace.chart,visibleFromMs:null,visibleToMs:null}},first+2000); setDirty(true); })}>Later history</button>
              <button disabled={busy} onClick={() => { range.current={from:bars[0]?.t??null,to:bars[bars.length-1]?.t??null}; setWorkspace({...workspace,chart:{...workspace.chart,visibleFromMs:null,visibleToMs:null}}); setBars([...bars]); setDirty(true); }}>Fit chart</button></div>
            {bars.length ? <LocalHistoryChart symbol={workspace.dataset.symbol} intervalMs={workspace.dataset.intervalMs} gridPercent={preferences.gridPercent} bars={bars} from={workspace.chart.visibleFromMs} to={workspace.chart.visibleToMs} onRange={(from,to) => { if (from !== range.current.from || to !== range.current.to) { range.current={from,to}; setDirty(true); } }} /> : <div className="empty">Historical chart unavailable. Reopen the workspace to retry.</div>}
          </> : <div className="empty"><h2>No historical data available</h2><p>Import a local file to start chart inspection.</p></div>}
        </>}
      </section>
      </section><div className="right-dock">{context}{research}</div>
      <div className="compact-presentation">{view === "context" ? context : view === "studio" || view === "results" ? research : null}</div>
      </div>
    </div>
    <footer role="status">{busy ? "Working locally…" : status}</footer>
    <dialog ref={dialog} className="dialog" aria-labelledby="preferences-title" onCancel={e => { if (savingPreferences) e.preventDefault(); }} onClose={() => preferenceOpener.current?.focus()}>
      <div className="dialog-header"><Settings2 size={18} aria-hidden="true" /><strong id="preferences-title">Terminal preferences</strong><span className="grow" /><IconButton label="Close preferences" icon={X} disabled={savingPreferences} onClick={() => dialog.current?.close()} /></div>
      <div className="dialog-body"><nav className="dialog-nav" aria-label="Preference pages">{["Appearance", "Chart", "Workspace", "Shortcuts", "Local storage", "Runtime"].map(page => <button key={page} aria-pressed={preferencePage === page} className={preferencePage === page ? "active" : ""} onClick={() => setPreferencePage(page)}>{page}</button>)}</nav><div className="preferences">
      {preferencePage === "Appearance" ? <><h3>A quieter kind of glass.</h3><p>Personalize the workspace. Keep the market clear.</p><div className="theme-grid">{["Violet", "Classic Blue", "Graphite"].map((theme, i) => <button key={theme} className={`theme-option ${i === 0 ? "active" : ""}`} disabled={i !== 0} title={i ? "Additional theme references remain unresolved" : "Current theme"} aria-pressed={i === 0}><div className="theme-preview"><div className="theme-lines">{[12,21,16,26,19,24,14,20].map((h,j) => <i key={j} style={{height:h}} />)}</div></div><span className="theme-name">{!i && <Check size={12} aria-hidden="true" />}{theme}</span></button>)}</div><label className="pref-row">Material mode<small>Chrome only; research surfaces remain matte</small><select aria-label="Material mode" value={draftPreferences.material} onChange={e => setDraftPreferences({...draftPreferences,material:e.target.value as ShellPreferences["material"]})}>{["rich","reduced","opaque"].map(mode => <option key={mode}>{mode}</option>)}</select></label><label className="pref-row">Reduced motion<input type="checkbox" checked={draftPreferences.reducedMotion} onChange={e => setDraftPreferences({...draftPreferences,reducedMotion:e.target.checked})} /></label><label className="pref-row">Information density<select value={draftPreferences.density} onChange={e => setDraftPreferences({...draftPreferences,density:e.target.value as ShellPreferences["density"]})}><option value="compact">Compact</option><option value="comfortable">Comfortable</option></select></label><label className="pref-row">Grid intensity<input aria-label="Grid intensity" type="range" min="0" max="20" value={draftPreferences.gridPercent} onChange={e => setDraftPreferences({...draftPreferences,gridPercent:Number(e.target.value)})} /><output>{draftPreferences.gridPercent}%</output></label><label className="pref-row">Chart timezone<select disabled value="UTC"><option>UTC</option></select></label><p>Other timezones require the data and chart milestone. Import timestamps remain UTC.</p></> : preferencePage === "Chart" ? <><h3>Chart presentation</h3><label className="pref-row">Grid intensity<input aria-label="Grid intensity" type="range" min="0" max="20" value={draftPreferences.gridPercent} onChange={e => setDraftPreferences({...draftPreferences,gridPercent:Number(e.target.value)})} /><output>{draftPreferences.gridPercent}%</output></label><label className="pref-row">Chart timezone<select disabled value="UTC"><option>UTC</option></select></label><p>Other timezones require the data and chart milestone. Import timestamps remain UTC.</p></> : <><h3>{preferencePage}</h3><p>{({Workspace:"Workspaces are saved transactionally on this device. Reset Layout changes presentation only; save workspace preserves name and chart range.",Shortcuts:"Tab and Shift+Tab move focus. Enter and Space activate buttons. Escape closes preferences. Shortcut customization belongs to the remaining preferences milestone.","Local storage":"SQLite and immutable history are owned by the application on this device. Folder selection, backup and cleanup require the documents and storage milestones.",Runtime:"Research runtime is unavailable. No repair, installation or job execution is performed by the shell."} as Record<string,string>)[preferencePage]}</p></>}
      {preferenceError && <p role="alert" className="error">{preferenceError}</p>}
      </div></div><div className="dialog-footer"><span role="status">{savingPreferences ? "Saving appearance…" : "Changes apply when saved"}</span><span className="grow" /><button disabled={savingPreferences} onClick={() => void savePreferences(defaultShellPreferences)}>Reset appearance</button><button className="primary" disabled={savingPreferences} onClick={() => void savePreferences(draftPreferences)}>Save appearance</button><button disabled={savingPreferences} onClick={() => dialog.current?.close()}>Done</button></div>
    </dialog>
  </main>;
}
