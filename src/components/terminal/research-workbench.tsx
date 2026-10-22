"use client";
import Link from "next/link";
import ResearchEditor from "./research-editor-host";
import { type FormEvent, useEffect, useState } from "react";
import { CheckCircle2, CircleAlert, Copy, Download, FilePlus2, LoaderCircle, Play, Save, Square, Trash2 } from "lucide-react";
import { recoverResearchDrafts, useResearch } from "@/stores/research";
import { EXAMPLES } from "@/lib/local-research/examples";
import { ResearchSettings } from "./research-settings";
import { getDraftStorageStatus } from "@/lib/local-research/drafts";
type HelperRelease = { available: boolean; version?: string; reason?: string; format?: "portable-zip" | "installer"; sha256?: string; bytes?: number; failed?: boolean };

function HelperConnectionPanel({ pairCode, setPairCode }: { pairCode: string; setPairCode: (value: string) => void }) {
  const state = useResearch();
  const [release, setRelease] = useState<HelperRelease | null>(null);
  const [downloadStarted, setDownloadStarted] = useState(false);
  const [releaseAttempt, setReleaseAttempt] = useState(0);
  const connecting = state.connection === "checking";
  const code = pairCode.trim();
  const connected = state.connection === "connected";

  useEffect(() => {
    let active = true;
    setRelease(null);
    void fetch("/api/releases/helper", { cache: "no-store", signal: AbortSignal.timeout(10000) })
      .then(async response => {
        const payload = await response.json() as HelperRelease;
        if ((!response.ok && response.status !== 503) || typeof payload.available !== "boolean" || (response.status === 503 && payload.available)) throw new Error("Release request failed");
        if (active) setRelease(payload);
      })
      .catch(() => { if (active) setRelease({ available: false, failed: true }); });
    return () => { active = false; };
  }, [releaseAttempt]);

  const connect = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!code || connecting) return;
    await state.connect(code);
    if (useResearch.getState().connection === "connected") setPairCode("");
  };
  const status = connected
    ? { label: "ZTerminal Helper connected", detail: "Helper connected. Run will prepare and verify the selected market data.", icon: CheckCircle2, tone: "connected" }
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
    {!connected && <><div className="zt-helper-download-row">{release?.available ? <a className="zt-helper-download" href="/download/helper" onClick={() => setDownloadStarted(true)}><Download size={13} aria-hidden="true" />Download Helper {release.format === "portable-zip" ? "ZIP" : "for Windows"}</a> : <button type="button" className="zt-helper-download" disabled><Download size={13} aria-hidden="true" />{release === null ? "Checking Helper release…" : "Helper download unavailable"}</button>}<a className="zt-helper-learn" href="/docs/python-research">Learn more</a><Link className="zt-helper-learn" href="/research/example" target="_blank" rel="noopener noreferrer">Explore an example report</Link></div>
      <p className="zt-helper-followup" role="status">{release === null ? "Loading Windows x64 release details…" : release.failed ? "Could not load the download. Your connection controls are still available." : !release.available ? release.reason === "HELPER_RELEASE_INCOMPATIBLE" ? "The configured package does not advertise this workbench's required research capabilities. A compatible Windows x64 release is needed. You can connect an already installed compatible Helper." : "No verified Helper download is available. Retry later or connect an already installed compatible Helper." : release.format === "portable-zip" ? "Download → Extract all → Open ZTerminalResearchHelper.exe → Copy Code → Connect. Optional: Install / update for my user in the Helper." : "Download → Install / Open → Copy Code → Connect."}{downloadStarted && " Download requested; keep the complete package together."}</p>
      {release?.available && <details className="zt-helper-followup"><summary>Unsigned preview · v{release.version} · {release.bytes ? Math.ceil(release.bytes / 1048576) + " MB" : "Windows x64"}</summary><p>No system Python or administrator rights required. Windows may warn about this unsigned application. Updates preserve your research archive.</p><p className="break-all">SHA-256: {release.sha256}</p></details>}
      {release?.available === false && <button type="button" className="zt-helper-retry" onClick={() => setReleaseAttempt(value => value + 1)}>Retry download check</button>}
      <form className="zt-helper-connect-form" onSubmit={connect}><label htmlFor="helper-connection-code">Connection code<span>Open ZTerminal Helper on your computer and paste its eight-digit code below.</span></label><div><input id="helper-connection-code" aria-describedby="helper-connection-help helper-connection-error" placeholder="0000 0000" value={pairCode} inputMode="numeric" autoComplete="one-time-code" maxLength={9} onChange={event => setPairCode(event.target.value.replace(/\D/g, "").slice(0, 8))} disabled={connecting} /><button type="submit" disabled={!/^\d{8}$/.test(code) || connecting}>{connecting ? "Connecting…" : "Connect Helper"}</button></div><p id="helper-connection-help" className="sr-only">Connection codes are used only to pair this browser session with your local ZTerminal Helper.</p></form>
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
  const [storageStatus, setStorageStatus] = useState(getDraftStorageStatus);
  const [draftsReady, setDraftsReady] = useState(false);
  const [paramsText, setParamsText] = useState(() => JSON.stringify(state.params));
  const [paramsError, setParamsError] = useState("");
  const busy = state.job && !["complete", "failed", "cancelled"].includes(state.job.stage);
  useEffect(() => {
    const warn = () => setStorageStatus(getDraftStorageStatus());
    window.addEventListener("zterminal:draft-storage-failed", warn);
    const stopHydration = useResearch.persist.onFinishHydration(current => setParamsText(JSON.stringify(current.params)));
    let active = true;
    void (async () => {
      try { await recoverResearchDrafts(); } catch { /* Preserve unread storage and permit in-memory editing. */ }
      if (!active) return;
      setDraftsReady(true);
      setParamsText(JSON.stringify(useResearch.getState().params));
      // Connecting mutates persisted state; recovery must finish first.
      if (getDraftStorageStatus() === "ready") await useResearch.getState().connect();
    })();
    return () => { active = false; window.removeEventListener("zterminal:draft-storage-failed", warn); stopHydration(); };
  }, []);
  useEffect(() => { if (!draftsReady) return; const timer = setTimeout(() => void useResearch.getState().verifyInstrument(), 500); return () => clearTimeout(timer); }, [draftsReady, state.config.provider, state.config.symbol, state.connection]);
  useEffect(() => { if (!draftsReady || state.connection !== "connected" || !state.helperFeatures.includes("script_inspection_v1")) return; const timer = setTimeout(() => void useResearch.getState().inspectScript(), 450); return () => clearTimeout(timer); }, [draftsReady, state.connection, state.helperFeatures, script?.source, state.params]);
  const exportSource = () => {
    const url = URL.createObjectURL(new Blob([script.source], { type: "text/x-python" }));
    const link = document.createElement("a"); link.href = url; link.download = `${script.name.replace(/[^a-z0-9_-]/gi, "_")}.py`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const exportDrafts = () => {
    const { drafts, activeId, config, params, minimap } = useResearch.getState();
    const url = URL.createObjectURL(new Blob([JSON.stringify({ version: 1, state: { drafts, activeId, config, params, minimap } }, null, 2)], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = "zterminal-draft-recovery.json"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  if (!draftsReady) return <p role="status">Recovering local research drafts…</p>;
  return <div className="zt-research-workbench">
    <div className="zt-research-files"><select aria-label="Current research artifact" value={state.activeId} onChange={e => state.selectScript(e.target.value)}>{Object.values(state.drafts).sort((a, b) => b.updatedAt - a.updatedAt).map(p => <option key={p.id} value={p.id}>{p.kind === "indicator" ? "ƒ " : "↗ "}{p.name}{p.source !== p.savedSource ? " •" : ""}</option>)}</select><button aria-label="New strategy" title="New strategy" onClick={() => state.createScript()}><FilePlus2 size={14} />S</button><button aria-label="New Python indicator" title="New Python indicator" onClick={() => state.createScript("Untitled indicator", undefined, "indicator")}><FilePlus2 size={14} />ƒ</button><button aria-label="Save artifact" title="Save (Ctrl/Cmd+S)" onClick={() => state.save()} ><Save size={14} /></button><button aria-label="Save As or duplicate artifact" title="Save As / duplicate" onClick={() => { setName(`${script.name} copy`); setScriptAction("copy"); }}><Copy size={14} /></button><button aria-label="Download Python source" title="Export source" onClick={exportSource}><Download size={14} /></button></div>
    <div className="zt-research-script-meta"><button onClick={() => { setName(script.name); setScriptAction("rename"); }}>Rename</button><span>{script.kind === "indicator" ? "Indicator" : "Strategy"} · {script.revision ? `Revision ${script.revision}` : "Unsaved"} {script.source !== (script.localSavedSource ?? script.savedSource) ? "· Draft changes" : "· Browser snapshot saved"} · {state.saveStatus}</span><button aria-label="Delete artifact" onClick={() => setScriptAction("delete")}><Trash2 size={12} /></button></div>
    {scriptAction && <form className="zt-research-inline-form" onSubmit={e => { e.preventDefault(); if (scriptAction === "delete") void state.deleteScript(); else void state.save(name, scriptAction === "copy"); setScriptAction(null); }}>
      {scriptAction === "delete" ? <p>Delete “{script.name}”? Archived runs and saved revisions remain in the helper.</p> : <label>Script name<input autoFocus required maxLength={120} value={name} onChange={e => setName(e.target.value)} /></label>}<button type="button" onClick={() => setScriptAction(null)}>Cancel</button><button type="submit">{scriptAction === "delete" ? "Delete script" : "Apply"}</button>
    </form>}
    <div className="zt-research-body"><div className="zt-research-main">
    <HelperConnectionPanel pairCode={pairCode} setPairCode={setPairCode} />
    <div className="zt-research-runbar"><button className="zt-backtest-button" aria-describedby={state.connection !== "connected" ? "helper-backtest-unavailable" : undefined} disabled={state.connection !== "connected" && !busy} onClick={() => { if (busy) { void state.cancel(); return; } try { const parsed = JSON.parse(paramsText); if (!parsed || Array.isArray(parsed) || typeof parsed !== "object" || Object.values(parsed).some(value => !["string", "number", "boolean"].includes(typeof value) || typeof value === "number" && !Number.isFinite(value))) throw new Error("Parameters must be a flat object of finite numbers, strings, or booleans."); useResearch.setState({ params: parsed }); setParamsError(""); void state.run(); } catch (error) { setParamsError((error as Error).message); } }}>{busy ? <Square size={12} /> : <Play size={12} />}{busy ? "Cancel" : script.kind === "indicator" ? "Preview + add" : "Run Backtest"}</button><span>{state.config.symbol} / {state.config.timeframe}</span><span>{script.kind === "indicator" ? "Immutable dataset evaluation" : `${state.config.initialCapital.toLocaleString()} quote`}</span>{state.connection !== "connected" && <span id="helper-backtest-unavailable" className="zt-backtest-unavailable">Connect ZTerminal Helper to run a local backtest.</span>}</div>
    <div className="zt-research-editor-tools"><label>Import .py<input type="file" accept=".py,text/x-python" onChange={async event => { const file = event.target.files?.[0]; if (!file) return; try { if (!file.name.toLowerCase().endsWith(".py") || file.size > 256_000) throw new Error("Choose a UTF-8 .py file up to 256 KB."); const source = new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer()); state.createScript(file.name.replace(/\.py$/i, ""), source); } catch (error) { useResearch.setState({ error: (error as Error).message }); } event.target.value = ""; }} /></label><select aria-label="Open educational example" value="" onChange={e => { const example = EXAMPLES.find(p => p.id === e.target.value); if (example) state.createScript(example.name, example.source); }}><option value="">Educational examples…</option>{EXAMPLES.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select><label><input type="checkbox" checked={state.minimap} onChange={e => useResearch.setState({ minimap: e.target.checked })} />Minimap</label><span>Ctrl/⌘ ↵</span></div>
    <div className="zt-research-editor"><ResearchEditor /></div>
    <div className="zt-research-status" aria-live="polite">{busy ? state.job!.stage.replaceAll("_", " ") : state.job?.stage === "complete" ? "Result archived locally" : "Python / ZTerminal SDK v1"}{storageStatus !== "ready" && <p role="alert">{storageStatus === "conflict" ? "Another tab changed the saved drafts. This tab's autosave is paused to preserve both versions." : "Browser draft recovery failed. Autosave is paused; existing storage has not been replaced."} Export this tab's drafts before closing or reloading. <button onClick={exportDrafts}>Export all drafts + configuration</button></p>}<p>Drafts stay in this browser. Helper saves and run archives stay on this computer. Offline runs require the Helper, an exact cached dataset, and instrument units already verified in this session; downloads and fresh unit verification need a connection.</p>{state.error && <p role="alert">{state.error}</p>}{state.diagnostic?.line && <button onClick={() => document.querySelector<HTMLElement>(".monaco-editor [role=textbox], textarea[aria-label=\"Python strategy editor (plain text)\"]")?.focus()}>Inspect line {state.diagnostic.line}</button>}</div>
    </div><ResearchSettings paramsText={paramsText} setParamsText={setParamsText} paramsError={paramsError} setParamsError={setParamsError} /></div>
  </div>;
}
