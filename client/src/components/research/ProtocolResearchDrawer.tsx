import { useMemo, useState } from "react";
import { CheckCircle2, CircleAlert, FileText, FlaskConical, GitBranch, LockKeyhole, Play, Save, ShieldCheck, X } from "lucide-react";
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

export function ProtocolResearchDrawer({ dataset, onFeedback, onClose }: { dataset: ResearchDatasetContext | null; onFeedback: (feedback: Feedback) => void; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("hypothesis");
  const [citation, setCitation] = useState<ResearchCitation>(EMPTY_CITATION);
  const [rules, setRules] = useState<RuleSpec>(EMPTY_RULES);
  const [approved, setApproved] = useState(false);
  const [baseline, setBaseline] = useState<LockedBaseline | null>(() => typeof window === "undefined" ? null : readLocalBaseline());
  const [changeField, setChangeField] = useState<ChangeField>("sizing");
  const [changeAfter, setChangeAfter] = useState("");
  const [changeRationale, setChangeRationale] = useState("");
  const [stagedChange, setStagedChange] = useState<VariableChange | null>(null);

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
  const resetBaseline = () => {
    window.localStorage.removeItem(BASELINE_STORAGE_KEY);
    setBaseline(null);
    setApproved(false);
    setStagedChange(null);
    onFeedback({ kind: "info", message: "Browser-local protocol baseline cleared. Create a new cited baseline before evaluation." });
  };

  return <aside className="research-drawer protocol-research-drawer" aria-label="Protocol-led research workspace">
    <div className="drawer-heading"><div><span className="drawer-kicker">Research protocol</span><h2>Evidence lab</h2></div><button onClick={onClose} aria-label="Close research workspace"><X size={16} /></button></div>
    <div className="protocol-tabs" role="tablist" aria-label="Research workflow tabs">
      <button className={tab === "hypothesis" ? "active" : ""} onClick={() => setTab("hypothesis")} role="tab" aria-selected={tab === "hypothesis"}><FileText size={13} /> Hypothesis</button>
      <button className={tab === "strategy" ? "active" : ""} onClick={() => setTab("strategy")} role="tab" aria-selected={tab === "strategy"}><GitBranch size={13} /> Strategy</button>
      <button className={tab === "backtest" ? "active" : ""} onClick={() => setTab("backtest")} role="tab" aria-selected={tab === "backtest"}><Play size={13} /> Backtest</button>
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

    {tab === "strategy" && <div className="protocol-gated-tab"><GitBranch size={19} /><h3>Strategy compiler is protocol-gated</h3><p>{baseline ? "The approved baseline is retained. The next R2 slice will compile closed ZS source with diagnostics; no arbitrary code, imports, network access, or execution is available here." : "Complete the cited hypothesis, data contract, and explicit baseline approval before a strategy source may be compiled."}</p><StatusPill tone={baseline ? "pending" : "blocked"}>{baseline ? "R2 COMPILE PENDING" : "BASELINE REQUIRED"}</StatusPill></div>}
    {tab === "backtest" && <div className="protocol-gated-tab"><Play size={19} /><h3>Backtest evidence is not available yet</h3><p>{baseline ? "The baseline is classified as fixed and non-optimized. The next B1 slice will add deterministic historical evaluation with a provenance package and next-bar-open fills." : "No backtest can run before a cited, scoped, human-approved baseline is locked."}</p><StatusPill tone={baseline ? "pending" : "blocked"}>{baseline ? "B1 EVIDENCE PENDING" : "BASELINE REQUIRED"}</StatusPill></div>}
  </aside>;
}
