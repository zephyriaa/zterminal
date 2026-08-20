import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, CircleAlert, Code2, FileText, FlaskConical, GitBranch, LoaderCircle, LockKeyhole, Play, Save, ShieldCheck, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { DEFAULT_BACKTEST_CONFIG, STRATEGY_TEMPLATES, type BacktestBar, type BacktestConfig, type BacktestMarker, type BacktestResult, type BacktestRunContext } from "@shared/backtest/engine";
import {
  buildBaselineCandidate,
  lockBaseline,
  validateSingleVariableExperiment,
  type BaselineInput,
  type LockedBaseline,
  type ResearchCitation,
  type ResearchDatasetContext,
  type ResearchSourceType,
  type RuleSpec,
  type VariableChange,
} from "@shared/protocol/contracts";

const BASELINE_STORAGE_KEY = "zterminal.protocol.baseline.v1";

type Feedback = { kind: "info" | "success" | "warning"; message: string } | null;
type Tab = "hypothesis" | "strategy" | "backtest";
type ChangeField = VariableChange["field"];

const EMPTY_CITATION: ResearchCitation = { title: "", author: "", year: new Date().getUTCFullYear(), sourceType: "URL", reference: "", sourceText: "" };
const EMPTY_RULES: RuleSpec = { entry: "", exit: "", sizing: "" };

function readLocalBaseline(): LockedBaseline | null {
  try {
    const value = window.localStorage.getItem(BASELINE_STORAGE_KEY);
    if (!value) return null;
    const parsed = JSON.parse(value) as LockedBaseline;
    return typeof parsed?.fingerprint === "string" && parsed.rules && parsed.dataset ? parsed : null;
  } catch {
    return null;
  }
}

function baselineValue(baseline: LockedBaseline, field: ChangeField): string {
  if (field === "entry" || field === "exit" || field === "sizing") return baseline.rules[field];
  return String(baseline[field]);
}

function StatusPill({ tone, children }: { tone: "ready" | "blocked" | "pending"; children: string }) {
  return <span className={`protocol-status ${tone}`}>{tone === "ready" ? <CheckCircle2 size={12} /> : tone === "blocked" ? <CircleAlert size={12} /> : <ShieldCheck size={12} />}{children}</span>;
}

export function ProtocolResearchDrawer({ dataset, bars, dataContext, onBacktestMarkers, onFeedback, onClose }: { dataset: ResearchDatasetContext | null; bars: BacktestBar[]; dataContext?: BacktestRunContext["data"]; onBacktestMarkers: (markers: BacktestMarker[]) => void; onFeedback: (feedback: Feedback) => void; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("strategy");
  const [restoredBaseline] = useState<LockedBaseline | null>(() => typeof window === "undefined" ? null : readLocalBaseline());
  const [citation, setCitation] = useState<ResearchCitation>(() => restoredBaseline?.citation ?? EMPTY_CITATION);
  const [rules, setRules] = useState<RuleSpec>(() => restoredBaseline?.rules ?? EMPTY_RULES);
  const [approved, setApproved] = useState(Boolean(restoredBaseline));
  const [baseline, setBaseline] = useState<LockedBaseline | null>(restoredBaseline);
  const [changeField, setChangeField] = useState<ChangeField>("sizing");
  const [changeAfter, setChangeAfter] = useState("");
  const [changeRationale, setChangeRationale] = useState("");
  const [stagedChange, setStagedChange] = useState<VariableChange | null>(null);
  const [strategySource, setStrategySource] = useState(`# Closed ZS source — compilation produces syntax metadata only\nstrategy("Custom candle strategy", overlay=true)\ninput.int("Length", 20, minval=1, maxval=200, step=1)\nvar protocolEma = ema(close, Length)\nif crossover(close, protocolEma)\n  strategy.entry("protocol-long", strategy.long, qty=1)\nif crossunder(close, protocolEma)\n  strategy.close("protocol-long")`);
  const compile = trpc.strategy.compile.useMutation();
  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef(0);
  const [backtest, setBacktest] = useState<BacktestResult | null>(null);
  const [backtestError, setBacktestError] = useState<string | null>(null);
  const [backtestRunning, setBacktestRunning] = useState(false);
  const [showTradeMarkers, setShowTradeMarkers] = useState(true);
  const [backtestConfig, setBacktestConfig] = useState<BacktestConfig>(DEFAULT_BACKTEST_CONFIG);

  useEffect(() => {
    const worker = new Worker(new URL("../../workers/backtest.worker.ts", import.meta.url), { type: "module" });
    workerRef.current = worker;
    worker.onmessage = (event: MessageEvent<{ id: string; result?: BacktestResult; error?: string }>) => {
      if (event.data.id !== String(requestIdRef.current)) return;
      setBacktestRunning(false);
      if (event.data.result) { setBacktest(event.data.result); setBacktestError(null); onFeedback({ kind: "success", message: `Historical evidence ${event.data.result.runId} completed in the dedicated browser worker.` }); }
      else { setBacktestError(event.data.error ?? "The historical research worker returned no evidence package."); onFeedback({ kind: "warning", message: "The historical research worker could not complete the run." }); }
    };
    worker.onerror = () => { setBacktestRunning(false); setBacktestError("The dedicated browser worker could not start the deterministic evaluation."); };
    return () => { worker.terminate(); workerRef.current = null; onBacktestMarkers([]); };
  }, [onBacktestMarkers, onFeedback]);
  useEffect(() => { onBacktestMarkers(showTradeMarkers ? backtest?.markers ?? [] : []); }, [backtest, showTradeMarkers, onBacktestMarkers]);

  const input = useMemo<BaselineInput>(() => ({
    citation, rules, dataset,
    executionModel: "Signal on close; market fill at next bar open.",
    costModel: "Explicit commission, spread, slippage, tick size, multiplier, quantity.",
    initialCapital: 100_000, positionSize: 1,
  }), [citation, rules, dataset]);
  const candidate = useMemo(() => buildBaselineCandidate(input), [input]);
  const requestedChange = baseline ? { field: changeField, before: baselineValue(baseline, changeField), after: changeAfter, rationale: changeRationale } : null;
  const changeCheck = validateSingleVariableExperiment(baseline, requestedChange ? [requestedChange] : []);

  const updateCitation = <K extends keyof ResearchCitation>(key: K, value: ResearchCitation[K]) => setCitation(current => ({ ...current, [key]: value }));
  const updateRule = <K extends keyof RuleSpec>(key: K, value: RuleSpec[K]) => setRules(current => ({ ...current, [key]: value }));
  const lock = () => {
    const result = lockBaseline(input, candidate, approved);
    if (!result.locked) { onFeedback({ kind: "warning", message: result.reason ?? "The baseline could not be locked." }); return; }
    setBaseline(result.locked);
    window.localStorage.setItem(BASELINE_STORAGE_KEY, JSON.stringify(result.locked));
    onFeedback({ kind: "success", message: `Immutable browser-local baseline ${result.locked.fingerprint} locked after explicit approval.` });
  };
  const stageChange = () => {
    if (!requestedChange || !changeCheck.ok) { onFeedback({ kind: "warning", message: changeCheck.reason ?? "The incremental experiment is incomplete." }); return; }
    setStagedChange(requestedChange);
    onFeedback({ kind: "success", message: `One-variable ${requestedChange.field} experiment staged. It cannot replace the locked baseline.` });
  };
  const runHistoricalEvidence = () => {
    if (!dataset || !dataContext || !bars.length) { onFeedback({ kind: "warning", message: "Load a verified historical chart window before running a code-first backtest." }); return; }
    if (!compile.data?.ok) { onFeedback({ kind: "warning", message: "Compile the current closed ZS source successfully before running a backtest. Source is never evaluated as JavaScript." }); return; }
    const protocol = baseline ? stagedChange ? { kind: "INCREMENTAL" as const, baselineFingerprint: baseline.fingerprint, incrementField: stagedChange.field } : { kind: "BASELINE" as const, baselineFingerprint: baseline.fingerprint } : { kind: "DIRECT_SOURCE" as const };
    const parameters = Object.fromEntries(compile.data.inputs.map((input) => [input.name, input.default]));
    requestIdRef.current += 1;
    setBacktestRunning(true);
    setBacktestError(null);
    workerRef.current?.postMessage({ id: String(requestIdRef.current), mode: "closed_source", source: strategySource, bars, config: backtestConfig, context: { parameters, protocol, data: dataContext } });
  };
  const updateConfig = <K extends Exclude<keyof BacktestConfig, "executionModel">>(key: K, value: number) => setBacktestConfig(current => ({ ...current, [key]: value }));
  const resetBaseline = () => {
    window.localStorage.removeItem(BASELINE_STORAGE_KEY);
    setBaseline(null);
    setApproved(false);
    setStagedChange(null);
    onFeedback({ kind: "info", message: "Browser-local protocol baseline cleared. Create a new cited baseline before evaluation." });
  };

  return <aside className="research-drawer protocol-research-drawer" aria-label="Code-first research workspace">
    <div className="drawer-heading"><div><span className="drawer-kicker">Closed-source research</span><h2>Backtest lab</h2></div><button onClick={onClose} aria-label="Close research workspace"><X size={16} /></button></div>
    <div className="protocol-tabs" role="tablist" aria-label="Research workflow tabs">
      <button className={tab === "strategy" ? "active" : ""} onClick={() => setTab("strategy")} role="tab" aria-selected={tab === "strategy"}><GitBranch size={13} /> Strategy</button>
      <button className={tab === "backtest" ? "active" : ""} onClick={() => setTab("backtest")} role="tab" aria-selected={tab === "backtest"}><Play size={13} /> Backtest</button>
      <button className={tab === "hypothesis" ? "active" : ""} onClick={() => setTab("hypothesis")} role="tab" aria-selected={tab === "hypothesis"}><FileText size={13} /> Protocol <small>optional</small></button>
    </div>

    {tab === "hypothesis" && <div className="protocol-content">
      <div className="protocol-banner"><FlaskConical size={14} /><span><b>{baseline ? "Baseline locked" : candidate.stage.replaceAll("_", " ")}</b><small>{baseline ? "Browser-local immutable snapshot" : "Cite → scope → data review → explicit approval"}</small></span>{baseline ? <StatusPill tone="ready">LOCKED</StatusPill> : <StatusPill tone={candidate.blockers.length ? "blocked" : "ready"}>{candidate.blockers.length ? `${candidate.blockers.length} GATES` : "READY"}</StatusPill>}</div>

      <section className="protocol-section"><div className="protocol-section-heading"><span>1</span><div><b>Retained source</b><small>A cited record and retained evidence are required before rule extraction.</small></div></div>
        <div className="protocol-grid"><label>Title<input value={citation.title} disabled={Boolean(baseline)} onChange={event => updateCitation("title", event.target.value)} placeholder="Paper, note, or source title" /></label><label>Author / organization<input value={citation.author} disabled={Boolean(baseline)} onChange={event => updateCitation("author", event.target.value)} placeholder="Named author or organization" /></label><label>Year<input type="number" value={citation.year} disabled={Boolean(baseline)} onChange={event => updateCitation("year", Number(event.target.value))} /></label><label>Type<select value={citation.sourceType} disabled={Boolean(baseline)} onChange={event => updateCitation("sourceType", event.target.value as ResearchSourceType)}>{(["URL", "DOI", "ARXIV", "PDF", "PASTED_TEXT"] as ResearchSourceType[]).map(value => <option value={value} key={value}>{value}</option>)}</select></label></div>
        <label>Reference<input value={citation.reference} disabled={Boolean(baseline)} onChange={event => updateCitation("reference", event.target.value)} placeholder={citation.sourceType === "URL" ? "https://…" : "Retained document identifier"} /></label>
        <label>Retained source text or reviewed excerpt<textarea value={citation.sourceText} disabled={Boolean(baseline)} onChange={event => updateCitation("sourceText", event.target.value)} maxLength={4_000} placeholder="Retain the evidence that justifies the fixed rules. Do not paraphrase an uncited rule as source evidence." /></label>
        {candidate.citationFailures.length > 0 && <div className="protocol-issues">{candidate.citationFailures.map(issue => <span key={issue}><CircleAlert size={12} />{issue}</span>)}</div>}
      </section>

      <section className="protocol-section"><div className="protocol-section-heading"><span>2</span><div><b>Fixed rule specification</b><small>One unambiguous entry, exit, and sizing rule. Silent alternatives and optimization are rejected.</small></div></div>
        <label>Entry rule<textarea value={rules.entry} disabled={Boolean(baseline)} onChange={event => updateRule("entry", event.target.value)} maxLength={800} placeholder="State one exact entry condition." /></label>
        <label>Exit rule<textarea value={rules.exit} disabled={Boolean(baseline)} onChange={event => updateRule("exit", event.target.value)} maxLength={800} placeholder="State one exact exit condition." /></label>
        <label>Sizing rule<textarea value={rules.sizing} disabled={Boolean(baseline)} onChange={event => updateRule("sizing", event.target.value)} maxLength={500} placeholder="State one exact sizing rule." /></label>
        {candidate.scopeViolations.length > 0 && <div className="protocol-issues">{candidate.scopeViolations.map((issue, index) => <span key={`${issue.field}-${issue.code}-${index}`}><CircleAlert size={12} />{issue.field}: {issue.message}</span>)}</div>}
      </section>

      <section className="protocol-section"><div className="protocol-section-heading"><span>3</span><div><b>Data contract</b><small>The market context remains chart-bound and no missing history is invented.</small></div></div>
        <div className="protocol-data-card"><b>{dataset ? `${dataset.provider.toUpperCase()} · ${dataset.symbol} · ${dataset.interval}` : "Awaiting verified chart dataset"}</b><small>{dataset ? `${dataset.returnedBars.toLocaleString("en-US")} bars · ${dataset.coverageComplete ? "complete selected coverage" : "partial selected coverage"} · ${dataset.fingerprint ?? "no dataset fingerprint"}` : "Load verified historical bars before a baseline can be locked."}</small></div>
        <div className="protocol-requirements">{candidate.dataRequirements.map(requirement => <div key={requirement.id}><StatusPill tone={requirement.coverage === "NATIVE_VERIFIED" ? "ready" : requirement.coverage === "AMBIGUOUS" ? "pending" : "blocked"}>{requirement.coverage.replaceAll("_", " ")}</StatusPill><b>{requirement.label}</b><p>{requirement.detail}</p><small>{requirement.risk}</small></div>)}</div>
      </section>

      <section className="protocol-section protocol-lock-section"><div className="protocol-section-heading"><span>4</span><div><b>Human baseline approval</b><small>A fixed fingerprint is created only after all gates pass and a human explicitly approves the assumptions.</small></div></div>
        {!baseline ? <><div className="baseline-preview"><span>Candidate fingerprint</span><b>{candidate.fingerprint ?? "Blocked until citation, rule, and data gates pass"}</b><small>Execution: signal on close → market fill at next-bar open. Costs remain explicit in the later backtest configuration.</small></div><label className="protocol-approval"><input type="checkbox" checked={approved} onChange={event => setApproved(event.target.checked)} disabled={!candidate.fingerprint} /><span>I explicitly approve this cited rule, selected dataset, next-bar-open execution assumption, and fixed baseline configuration.</span></label><button className="terminal-primary-button" onClick={lock} disabled={!candidate.fingerprint || !approved}><LockKeyhole size={14} /> Lock immutable baseline</button>{candidate.blockers.length > 0 && <div className="protocol-blockers"><b>Baseline blockers</b>{candidate.blockers.map(blocker => <span key={blocker}>{blocker}</span>)}</div>}</> : <><div className="baseline-locked-card"><LockKeyhole size={15} /><div><span>Immutable baseline</span><b>{baseline.fingerprint}</b><small>Locked {new Date(baseline.lockedAt).toLocaleString()} · browser-local only until durable workspaces are configured.</small></div></div><button className="terminal-secondary-button" onClick={resetBaseline}>Clear local baseline</button></>}
      </section>

      {baseline && <section className="protocol-section incremental-section"><div className="protocol-section-heading"><span>5</span><div><b>One-variable increment</b><small>The locked baseline cannot be overwritten. Stage exactly one declared change for later evaluation.</small></div></div>
        <label>Variable<select value={changeField} onChange={event => { setChangeField(event.target.value as ChangeField); setChangeAfter(""); setStagedChange(null); }}><option value="entry">Entry rule</option><option value="exit">Exit rule</option><option value="sizing">Sizing rule</option><option value="executionModel">Execution model</option><option value="costModel">Cost model</option><option value="initialCapital">Initial capital</option><option value="positionSize">Position size</option></select></label><label>Locked baseline value<input value={baselineValue(baseline, changeField)} readOnly /></label><label>Proposed value<input value={changeAfter} onChange={event => { setChangeAfter(event.target.value); setStagedChange(null); }} placeholder="One changed value" /></label><label>Rationale<textarea value={changeRationale} onChange={event => { setChangeRationale(event.target.value); setStagedChange(null); }} maxLength={600} placeholder="Why test only this variable?" /></label><button className="terminal-primary-button" onClick={stageChange} disabled={!changeCheck.ok}><GitBranch size={14} /> Stage one-variable increment</button><small className={changeCheck.ok ? "protocol-ready-note" : "protocol-warning-note"}>{changeCheck.ok ? "Exactly one changed variable is declared." : changeCheck.reason}</small>{stagedChange && <div className="increment-staged"><Save size={14} /><span><b>Increment staged — not evaluated</b><small>{stagedChange.field}: {stagedChange.before} → {stagedChange.after}</small></span></div>}</section>}
    </div>}

    {tab === "strategy" && <div className="protocol-content strategy-compiler-panel"><div className="protocol-banner"><Code2 size={14} /><span><b>Closed ZS strategy source</b><small>Compile this source, then use the verified candle window. The Protocol tab is optional.</small></span><StatusPill tone={compile.data?.ok ? "ready" : "pending"}>{compile.data?.ok ? "READY FOR BACKTEST" : "READY TO COMPILE"}</StatusPill></div><section className="protocol-section"><div className="protocol-section-heading"><span>1</span><div><b>Strategy source</b><small>Required: a valid closed ZS source. The worker interprets its validated AST over verified historical candles; it never runs JavaScript.</small></div></div><label>ZS source<textarea className="strategy-source-editor" value={strategySource} onChange={event => { compile.reset(); setStrategySource(event.target.value); }} maxLength={16_000} spellCheck="false" /></label><div className="strategy-compile-actions"><button className="terminal-primary-button" onClick={() => compile.mutate({ source: strategySource })} disabled={!strategySource.trim() || compile.isPending}><Code2 size={14} /> {compile.isPending ? "Compiling closed source" : "Compile for diagnostics"}</button><small>{strategySource.length.toLocaleString("en-US")} / 16,000 characters · no execution surface</small></div></section>{compile.error && <div className="protocol-issues"><span><CircleAlert size={12} />Compiler procedure unavailable: {compile.error.message}</span></div>}{compile.data && <section className="protocol-section compile-result-section"><div className="protocol-section-heading"><span>2</span><div><b>{compile.data.ok ? "Validated compiler result" : "Compiler diagnostics"}</b><small>{compile.data.name} · {compile.data.engineVersion} · {compile.data.ok ? "eligible for closed historical interpretation" : "correct errors before later evaluation"}</small></div></div><div className="compile-inputs"><b>Discovered inputs</b>{compile.data.inputs.length ? compile.data.inputs.map(input => <span key={input.name}>{input.name} · {input.type} · default {String(input.default)}</span>) : <span>No declared inputs</span>}</div><div className="compile-diagnostics">{compile.data.diagnostics.map((diagnostic, index) => <div className={diagnostic.severity} key={`${diagnostic.line}-${diagnostic.col}-${index}`}><b>{diagnostic.severity.toUpperCase()}</b><span>{diagnostic.line ? `L${diagnostic.line}: ` : ""}{diagnostic.message}</span></div>)}</div><div className="compiler-boundary"><ShieldCheck size={13} /><span>Validated source may be interpreted only as a closed AST over verified historical candles. It is never JavaScript, imported, fetched, persisted, or routed to any broker.</span></div></section>}</div>}
    {tab === "backtest" && <div className="protocol-content backtest-evidence-panel"><div className="protocol-banner"><Play size={14} /><span><b>Deterministic historical evidence</b><small>Required: compiled source + verified candles. Signal at close; modeled market fill at next open.</small></span><StatusPill tone={backtest?.status === "COMPLETED" ? "ready" : "pending"}>{backtest?.classification.label ?? (compile.data?.ok ? "READY TO EVALUATE" : "SOURCE VALIDATION REQUIRED")}</StatusPill></div><section className="protocol-section"><div className="protocol-section-heading"><span>1</span><div><b>Execution and cost assumptions</b><small>Every cost remains explicit. No limit/stop simulation, optimization, forecast, or broker route is included.</small></div></div><div className="backtest-config-grid"><label>Initial capital<input type="number" min="1" value={backtestConfig.initialCapital} onChange={event => updateConfig("initialCapital", Number(event.target.value))} /></label><label>Quantity<input type="number" min="0.000001" step="any" value={backtestConfig.positionSize} onChange={event => updateConfig("positionSize", Number(event.target.value))} /></label><label>Multiplier<input type="number" min="0.000001" step="any" value={backtestConfig.multiplier} onChange={event => updateConfig("multiplier", Number(event.target.value))} /></label><label>Commission / unit<input type="number" min="0" step="any" value={backtestConfig.commissionPerUnit} onChange={event => updateConfig("commissionPerUnit", Number(event.target.value))} /></label><label>Spread ticks<input type="number" min="0" step="any" value={backtestConfig.spreadTicks} onChange={event => updateConfig("spreadTicks", Number(event.target.value))} /></label><label>Slippage ticks<input type="number" min="0" step="any" value={backtestConfig.slippageTicks} onChange={event => updateConfig("slippageTicks", Number(event.target.value))} /></label><label>Tick size<input type="number" min="0.00000001" step="any" value={backtestConfig.tickSize} onChange={event => updateConfig("tickSize", Number(event.target.value))} /></label></div><div className="backtest-run-actions"><button className="terminal-primary-button" onClick={runHistoricalEvidence} disabled={backtestRunning || !bars.length || !compile.data?.ok}>{backtestRunning ? <><LoaderCircle size={14} /> Preparing evidence</> : <><Play size={14} /> Run verified window</>}</button><label className="marker-toggle"><input type="checkbox" checked={showTradeMarkers} onChange={event => setShowTradeMarkers(event.target.checked)} /><span>Show entry / exit markers</span></label><small>{bars.length.toLocaleString("en-US")} verified chart bars · {compile.data?.ok ? "closed-source worker evaluation" : "compile source first"} · no cloud save</small></div></section>{backtestError && <div className="protocol-issues"><span><CircleAlert size={12} />{backtestError}</span></div>}{backtest && <><section className="protocol-section backtest-result-section"><div className="protocol-section-heading"><span>2</span><div><b>{backtest.status === "COMPLETED" ? "Reproducible evidence package" : "Evaluation unavailable"}</b><small>{backtest.runId} · {backtest.engineVersion} · {backtest.hash}</small></div></div><div className="backtest-classification"><StatusPill tone={backtest.classification.kind === "UNCLASSIFIED" ? "blocked" : "ready"}>{backtest.classification.label}</StatusPill><span>{backtest.classification.baselineFingerprint ?? (backtest.classification.kind === "DIRECT_SOURCE" ? "Closed source and declared costs retained" : "No immutable protocol fingerprint")}{backtest.classification.incrementField ? ` · changed ${backtest.classification.incrementField}` : ""}</span></div>{backtest.metrics ? <div className="backtest-metrics"><div><span>Net P&amp;L</span><b className={backtest.metrics.netPnl >= 0 ? "positive" : "negative"}>{backtest.metrics.netPnl >= 0 ? "+" : ""}{backtest.metrics.netPnl.toFixed(2)}</b></div><div><span>Return</span><b className={backtest.metrics.returnPct >= 0 ? "positive" : "negative"}>{backtest.metrics.returnPct >= 0 ? "+" : ""}{backtest.metrics.returnPct.toFixed(2)}%</b></div><div><span>Max DD</span><b>{backtest.metrics.maxDrawdown.toFixed(2)} · {backtest.metrics.maxDrawdownPct.toFixed(2)}%</b></div><div><span>Trades</span><b>{backtest.metrics.tradeCount}</b></div></div> : <div className="protocol-blockers"><b>Evaluation limitation</b><span>{backtest.limitations.at(-1)}</span></div>}<div className="backtest-provenance"><b>Verified provenance</b><span>{backtest.provenance.provider?.toUpperCase() ?? "PROVIDER UNSPECIFIED"} · {backtest.provenance.symbol ?? "SYMBOL UNSPECIFIED"} · {backtest.provenance.interval ?? "INTERVAL UNSPECIFIED"}</span><small>{backtest.provenance.normalizedBars.toLocaleString("en-US")} normalized bars · {backtest.provenance.coverageComplete ? "complete selected coverage" : "coverage not complete"} · {backtest.provenance.fingerprint ?? "no fingerprint"}</small><small>Source timestamp {backtest.provenance.sourceTimestamp ? new Date(backtest.provenance.sourceTimestamp).toISOString() : "unavailable"} · rejected {backtest.provenance.rejectedBars} · deduplicated {backtest.provenance.duplicateBars}</small></div></section>{backtest.metrics && <section className="protocol-section"><div className="protocol-section-heading"><span>3</span><div><b>Monthly outcomes and trades</b><small>Trade outcomes use the configured costs. Terminal marking is disclosed separately from next-open fills.</small></div></div><div className="monthly-outcomes">{backtest.monthlyOutcomes.map(outcome => <div key={outcome.month}><span>{outcome.month}</span><b className={outcome.returnPct >= 0 ? "positive" : "negative"}>{outcome.returnPct >= 0 ? "+" : ""}{outcome.returnPct.toFixed(2)}%</b><small>{outcome.pnl >= 0 ? "+" : ""}{outcome.pnl.toFixed(2)}</small></div>)}</div><div className="backtest-trades">{backtest.trades.slice(0, 12).map(trade => <div key={trade.id}><b>#{trade.id}</b><span>{new Date(trade.entryTime).toISOString().slice(0, 16).replace("T", " ")} → {new Date(trade.exitTime).toISOString().slice(0, 16).replace("T", " ")}</span><em className={trade.netPnl >= 0 ? "positive" : "negative"}>{trade.netPnl >= 0 ? "+" : ""}{trade.netPnl.toFixed(2)}</em><small>{trade.reason === "end_of_data_mark" ? "terminal mark" : "next-open exit"} · costs {trade.costs.toFixed(2)}</small></div>)}</div></section>}<div className="compiler-boundary"><ShieldCheck size={13} /><span>Historical research evidence only. It does not establish future performance, create orders, route to a broker, or evaluate arbitrary JavaScript source. Walk-forward, Monte Carlo, optimization, and historical tick/order-flow replay remain out of scope.</span></div></>}</div>}
  </aside>;
}
