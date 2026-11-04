import { useEffect, useRef, useState } from "react";
import { LocalHistoryChart } from "../../src/components/terminal/observed-history-chart";
import type { Bar } from "../../src/lib/market/types";
import type { LocalSummary, LocalWorkspace, WorkstationPlatform } from "../../src/lib/workstation-platform";

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
    });
    // Single mount; the platform is fixed for the window lifetime.
  }, []);
  function canLeave() { return !dirty || window.confirm("Discard unsaved workspace name or chart range changes?"); }

  return <main className={busy ? "workstation busy" : "workstation"}>
    <header><strong>ZTERMINAL</strong><span>Local workstation</span><span className="local-badge">Offline · Device storage</span></header>
    <div className="body">
      <aside><h2>Workspaces</h2>
        <button disabled={busy} onClick={() => {
          if (!canLeave()) return;
          void perform(async () => { await display(await platform.create(crypto.randomUUID(), "Local research")); setList(await platform.list()); setStatus("Workspace created locally"); });
        }}>New workspace</button>
        {list.map(w => <button key={w.id} className={workspace?.document.id === w.id ? "selected" : ""} disabled={busy} onClick={() => {
          if (canLeave()) void perform(async () => { await display(await platform.open(w.id)); setStatus("Workspace opened locally"); });
        }}>{w.name}<small>Local · revision {w.revision}</small></button>)}
        {!list.length && <p>No saved workspaces yet.</p>}
      </aside>
      <section className="content">
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
            {bars.length ? <LocalHistoryChart bars={bars} from={workspace.chart.visibleFromMs} to={workspace.chart.visibleToMs} onRange={(from,to) => { if (from !== range.current.from || to !== range.current.to) { range.current={from,to}; setDirty(true); } }} /> : <div className="empty">Historical chart unavailable. Reopen the workspace to retry.</div>}
          </> : <div className="empty"><h2>No historical data available</h2><p>Import a local file to start chart inspection.</p></div>}
        </>}
      </section>
    </div>
    <footer role="status">{busy ? "Working locally…" : status}</footer>
  </main>;
}
