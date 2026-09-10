"use client";
import dynamic from "next/dynamic";
import { type FormEvent, useEffect, useState } from "react";
import { CheckCircle2, CircleAlert, Copy, Download, FilePlus2, LoaderCircle, Play, Save, Square, Trash2 } from "lucide-react";
import { useResearch } from "@/stores/research";
import { EXAMPLES } from "@/lib/local-research/examples";
import { intervalMs } from "@/lib/local-research/dataset";
const ResearchEditor = dynamic(() => import("./research-editor"), { ssr: false, loading: () => <p className="p-4 text-xs text-muted-foreground">Loading Python editor…</p> });
type HelperRelease = { available: boolean; version?: string; reason?: string };

function HelperConnectionPanel({ pairCode, setPairCode }: { pairCode: string; setPairCode: (value: string) => void }) {
  const state = useResearch();
  const [release, setRelease] = useState<HelperRelease | null>(null);
  const [downloadStarted, setDownloadStarted] = useState(false);
  const connecting = state.connection === "checking";
  const code = pairCode.trim();
  const connected = state.connection === "connected";

  useEffect(() => {
    let active = true;
    void fetch("/api/releases/helper", { cache: "no-store" })
      .then(async response => ({ payload: await response.json() as HelperRelease }))
      .then(({ payload }) => { if (active) setRelease(payload); })
      .catch(() => { if (active) setRelease({ available: false }); });
    return () => { active = false; };
  }, []);

  const connect = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!code || connecting) return;
    await state.connect(code);
    if (useResearch.getState().connection === "connected") setPairCode("");
  };
  const status = connected
    ? { label: "ZTerminal Helper connected", detail: "Local backtesting engine ready", icon: CheckCircle2, tone: "connected" }
    : connecting
      ? { label: "Connecting to ZTerminal Helper", detail: "Checking the local connection…", icon: LoaderCircle, tone: "checking" }
      : state.connection === "invalid_code"
        ? { label: "Connection code rejected", detail: "Paste a current code from ZTerminal Helper and try again.", icon: CircleAlert, tone: "error" }
      : state.connection === "permission_denied"
          ? { label: "Local network permission needed", detail: "Allow local network access for this site, then retry.", icon: CircleAlert, tone: "error" }
          : state.connection === "unavailable"
            ? { label: "ZTerminal Helper could not be reached", detail: "Open the Helper and try again.", icon: CircleAlert, tone: "error" }
          : state.connection === "incompatible"
            ? { label: "ZTerminal Helper update required", detail: "Install a compatible Windows Helper, then reconnect.", icon: CircleAlert, tone: "error" }
            : { label: "ZTerminal Helper not connected", detail: "Local backtesting is unavailable until the Helper is connected.", icon: CircleAlert, tone: "idle" };
  const StatusIcon = status.icon;
  return <section className="zt-helper-connection" aria-labelledby="helper-connection-title">
    <div className="zt-helper-connection-header"><div><p className="zt-helper-eyebrow">LOCAL BACKTESTING</p><h2 id="helper-connection-title">{connected ? "ZTerminal Helper" : "ZTerminal Helper required"}</h2></div><div className={`zt-helper-status is-${status.tone}`} role="status" aria-live="polite"><StatusIcon size={13} aria-hidden="true" className={connecting ? "zt-helper-spin" : ""} />{status.label}</div></div>
    <p className="zt-helper-description">{connected ? "This browser session can run Python backtests on your computer." : "The Helper runs ZTerminal's local Python backtesting engine and connects it securely to this browser session."}</p>
    {connected && state.helperVersion && <p className="zt-helper-version">Helper v{state.helperVersion}</p>}
    {!connected && <><div className="zt-helper-download-row">{release?.available ? <a className="zt-helper-download" href="/download/helper" onClick={() => setDownloadStarted(true)}><Download size={13} aria-hidden="true" />Download ZTerminal Helper</a> : <button type="button" className="zt-helper-download" disabled title="A verified ZTerminal Helper installer has not been configured for this release."><Download size={13} aria-hidden="true" />Download ZTerminal Helper for Windows</button>}<a className="zt-helper-learn" href="/docs/python-research">Learn more</a></div>{(downloadStarted || release?.available === false) && <p className="zt-helper-followup">{downloadStarted ? "After installation, open ZTerminal Helper and connect it below." : "A verified Helper installer is not configured for this release yet."}</p>}
      <form className="zt-helper-connect-form" onSubmit={connect}><label htmlFor="helper-connection-code">Connection code<span>Open ZTerminal Helper on your computer and paste its connection code below.</span></label><div><input id="helper-connection-code" aria-describedby="helper-connection-help helper-connection-error" placeholder="Paste connection code" value={pairCode} inputMode="numeric" autoComplete="one-time-code" maxLength={32} onChange={event => setPairCode(event.target.value)} disabled={connecting} /><button type="submit" disabled={!code || connecting}>{connecting ? "Connecting…" : "Connect Helper"}</button></div><p id="helper-connection-help" className="sr-only">Connection codes are used only to pair this browser session with your local ZTerminal Helper.</p></form>
      <button type="button" className="zt-helper-retry" onClick={() => void state.connect()} disabled={connecting}>{connecting ? "Checking connection…" : "Retry connection"}</button></>}
    <p className="zt-helper-status-detail">{status.detail}</p>{!connected && state.error && <p id="helper-connection-error" className="zt-helper-error" role="alert">{state.error}</p>}
  </section>;
}

export function ResearchWorkbench() {
  const state = useResearch();
  const script = state.drafts[state.activeId];
  const [pairCode, setPairCode] = useState("");
  const [scriptAction, setScriptAction] = useState<"rename" | "copy" | "delete" | null>(null);
  const [name, setName] = useState("");
  const [storageFailed, setStorageFailed] = useState(false);
  const [paramsText, setParamsText] = useState(() => JSON.stringify(state.params));
  const [paramsError, setParamsError] = useState("");
  const busy = state.job && !["complete", "failed", "cancelled"].includes(state.job.stage);
  useEffect(() => {
    const warn = () => setStorageFailed(true);
    window.addEventListener("zterminal:draft-storage-failed", warn);
    const stopHydration = useResearch.persist.onFinishHydration(current => setParamsText(JSON.stringify(current.params)));
    void useResearch.persist.rehydrate();
    void useResearch.getState().connect();
    return () => { window.removeEventListener("zterminal:draft-storage-failed", warn); stopHydration(); };
  }, []);
  const period = (days: number) => { const interval = intervalMs(state.config.timeframe), to = Math.floor(Date.now() / interval) * interval; state.configure({ from: to - days * 86400000, to }); };
  useEffect(() => { const timer = setTimeout(() => void useResearch.getState().verifyInstrument(), 500); return () => clearTimeout(timer); }, [state.config.provider, state.config.symbol]);
  const exportSource = () => {
    const url = URL.createObjectURL(new Blob([script.source], { type: "text/x-python" }));
    const link = document.createElement("a"); link.href = url; link.download = `${script.name.replace(/[^a-z0-9_-]/gi, "_")}.py`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <div className="zt-research-workbench">
    <div className="zt-research-files"><select aria-label="Current research artifact" value={state.activeId} onChange={e => state.selectScript(e.target.value)}>{Object.values(state.drafts).sort((a, b) => b.updatedAt - a.updatedAt).map(p => <option key={p.id} value={p.id}>{p.kind === "indicator" ? "ƒ " : "↗ "}{p.name}{p.source !== p.savedSource ? " •" : ""}</option>)}</select><button aria-label="New strategy" title="New strategy" onClick={() => state.createScript()}><FilePlus2 size={14} />S</button><button aria-label="New Python indicator" title="New Python indicator" onClick={() => state.createScript("Untitled indicator", undefined, "indicator")}><FilePlus2 size={14} />ƒ</button><button aria-label="Save artifact" title="Save (Ctrl/Cmd+S)" onClick={() => state.save()} disabled={state.connection !== "connected"}><Save size={14} /></button><button aria-label="Save As or duplicate artifact" title="Save As / duplicate" onClick={() => { setName(`${script.name} copy`); setScriptAction("copy"); }}><Copy size={14} /></button><button aria-label="Download Python source" title="Export source" onClick={exportSource}><Download size={14} /></button></div>
    <div className="zt-research-script-meta"><button onClick={() => { setName(script.name); setScriptAction("rename"); }}>Rename</button><span>{script.kind === "indicator" ? "Indicator" : "Strategy"} · {script.revision ? `Revision ${script.revision}` : "Unsaved"} {script.source !== script.savedSource ? "· Draft changes" : "· Saved"}</span><button aria-label="Delete artifact" onClick={() => setScriptAction("delete")}><Trash2 size={12} /></button></div>
    {scriptAction && <form className="zt-research-inline-form" onSubmit={e => { e.preventDefault(); if (scriptAction === "delete") void state.deleteScript(); else if (scriptAction === "copy" && state.connection !== "connected") state.createScript(name, script.source); else if (scriptAction === "rename" && !script.revision) useResearch.setState(s => ({ drafts: { ...s.drafts, [s.activeId]: { ...s.drafts[s.activeId], name } } })); else void state.save(name, scriptAction === "copy"); setScriptAction(null); }}>
      {scriptAction === "delete" ? <p>Delete “{script.name}”? Archived runs and saved revisions remain in the helper.</p> : <label>Script name<input autoFocus required maxLength={120} value={name} onChange={e => setName(e.target.value)} /></label>}<button type="button" onClick={() => setScriptAction(null)}>Cancel</button><button type="submit">{scriptAction === "delete" ? "Delete script" : "Apply"}</button>
    </form>}
    <HelperConnectionPanel pairCode={pairCode} setPairCode={setPairCode} />
    <div className="zt-research-runbar"><button className="zt-backtest-button" aria-describedby={state.connection !== "connected" ? "helper-backtest-unavailable" : undefined} disabled={(state.connection !== "connected" || !state.instrument || state.instrument.symbol !== state.config.symbol || state.instrument.provider !== state.config.provider) && !busy} onClick={() => busy ? state.cancel() : state.run()}>{busy ? <Square size={12} /> : <Play size={12} />}{busy ? "Cancel" : script.kind === "indicator" ? "Preview + add" : "Run Backtest"}</button><span>{state.config.symbol} / {state.config.timeframe}</span><span>{script.kind === "indicator" ? "Immutable dataset evaluation" : `${state.config.initialCapital.toLocaleString()} quote`}</span>{state.connection !== "connected" && <span id="helper-backtest-unavailable" className="zt-backtest-unavailable">Connect ZTerminal Helper to run a local backtest.</span>}</div>
    <details className="zt-research-config"><summary>Dataset & capital <span>{Math.round((state.config.to - state.config.from) / 86400000)} days · UTC</span></summary><div className="zt-research-form-grid"><label>Provider<select value={state.config.provider} onChange={e => state.configure({ provider: e.target.value as "gateio" | "binance", symbol: e.target.value === "gateio" ? "BTC_USDT" : "BTCUSDT" })}><option value="gateio">Gate.io</option><option value="binance">Binance USDⓈ-M</option></select></label><label>Native symbol<input value={state.config.symbol} onChange={e => state.configure({ symbol: e.target.value.toUpperCase() })} /></label><label>Timeframe<select value={state.config.timeframe} onChange={e => { const interval = intervalMs(e.target.value); state.configure({ timeframe: e.target.value, from: Math.floor(state.config.from / interval) * interval, to: Math.floor(state.config.to / interval) * interval }); }}>{["1m", "5m", "15m", "30m", "1h", "4h", "1d"].map(tf => <option key={tf}>{tf}</option>)}</select></label><label>Capital<input type="number" min={1} value={state.config.initialCapital} onChange={e => state.configure({ initialCapital: Number(e.target.value) })} /></label><label>From (UTC)<input type="datetime-local" value={new Date(state.config.from).toISOString().slice(0, 16)} onChange={e => { const from = Date.parse(`${e.target.value}Z`); if (Number.isFinite(from)) state.configure({ from }); }} /></label><label>To, exclusive (UTC)<input type="datetime-local" value={new Date(state.config.to).toISOString().slice(0, 16)} onChange={e => { const to = Date.parse(`${e.target.value}Z`); if (Number.isFinite(to)) state.configure({ to }); }} /></label></div><div className="flex gap-3"><button onClick={() => period(90)}>90 days</button><button onClick={() => period(730)}>2 years</button></div></details>
    <details className="zt-research-config"><summary>{script.kind === "indicator" ? "Parameters & reproducibility" : "Advanced / execution assumptions"}</summary>{script.kind !== "indicator" && <div className="zt-research-form-grid">{([["feeBps", "Fees (bps)"], ["slippageBps", "Slippage (bps)"], ["allocation", "Cash allocation (fraction)"]] as const).map(([key, label]) => <label key={key}>{label}<input type="number" step="any" value={state.config[key]} onChange={e => state.configure({ [key]: Number(e.target.value) })} /></label>)}<label>Direction<select value={state.config.direction} onChange={e => state.configure({ direction: e.target.value as "long" | "both" })}><option value="long">Long only</option><option value="both">Long + short</option></select></label></div>}<label className="zt-params-json">{script.kind === "indicator" ? "Calculation parameters" : "Strategy parameters"} (JSON object)<textarea value={paramsText} spellCheck={false} rows={3} onChange={e => setParamsText(e.target.value)} onBlur={() => { try { const parsed = JSON.parse(paramsText); if (!parsed || Array.isArray(parsed) || typeof parsed !== "object" || Object.entries(parsed).some(([key, value]) => key.length > 80 || !["string", "number", "boolean"].includes(typeof value) || typeof value === "number" && !Number.isFinite(value))) throw new Error("Use a JSON object with finite number, string, or boolean values."); useResearch.setState({ params: parsed }); setParamsError(""); } catch (error) { setParamsError((error as Error).message); } }} /></label>{paramsError && <p role="alert">{paramsError} The last valid parameters remain active.</p>}<p>{state.instrument ? `Verified quantity units: multiplier ${state.instrument.multiplier}, quantity step ${state.instrument.quantityStep}.` : "Instrument units have not been verified."} <button onClick={() => state.verifyInstrument()}>Verify units</button></p><p>{script.kind === "indicator" ? "Evaluations retain source, parameter, dataset, input, result, helper, and engine hashes." : "One unlevered position. Signals at completed-bar close fill at the next open. No funding, liquidation or margin model. Open positions remain marked to market."}</p></details>
    <div className="zt-research-editor-tools"><select aria-label="Open educational example" value="" onChange={e => { const example = EXAMPLES.find(p => p.id === e.target.value); if (example) state.createScript(example.name, example.source); }}><option value="">Educational examples…</option>{EXAMPLES.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select><label><input type="checkbox" checked={state.minimap} onChange={e => useResearch.setState({ minimap: e.target.checked })} />Minimap</label><span>Ctrl/⌘ ↵</span></div>
    <div className="zt-research-editor"><ResearchEditor /></div>
    <div className="zt-research-status" aria-live="polite">{busy ? state.job!.stage.replaceAll("_", " ") : state.job?.stage === "complete" ? "Result archived locally" : "Python / ZTerminal SDK v1"}{storageFailed && <p role="alert">Browser draft recovery is unavailable. Export your source to preserve unsaved work.</p>}{state.error && <p role="alert">{state.error}</p>}{state.diagnostic?.line && <button onClick={() => document.querySelector<HTMLElement>(".monaco-editor textarea")?.focus()}>Inspect line {state.diagnostic.line}</button>}</div>
  </div>;
}
