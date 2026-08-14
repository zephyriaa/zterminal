"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, GitFork, LockKeyhole, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { VariableChange } from "@/domain/protocol/types";
import { useInstitutionalProtocol } from "@/stores/institutional-protocol";
import { Panel, Pill, StatRow } from "../terminal/primitives";

function id() {
  return `change_${typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)}`;
}

export function ProtocolBacktestPanel({ resultHash, onOpenStrategy }: { resultHash: string; onOpenStrategy: () => void }) {
  const { projects, activeProjectId, stageVariableChange } = useInstitutionalProtocol();
  const project = projects.find((item) => item.id === activeProjectId) ?? null;
  const [label, setLabel] = useState("");
  const [kind, setKind] = useState<VariableChange["kind"]>("FILTER");
  const [after, setAfter] = useState("");
  const [rationale, setRationale] = useState("");
  const [error, setError] = useState<string | null>(null);

  const baseline = project?.runs.find((run) => run.runClass === "BASELINE") ?? null;
  const current = project?.runs.find((run) => run.resultHash === resultHash) ?? null;
  const parent = current?.parentRunId ? project?.runs.find((run) => run.id === current.parentRunId) ?? null : null;
  const margin = useMemo(() => current && parent ? {
    netProfit: current.metrics.netProfit - parent.metrics.netProfit,
    expectancy: current.metrics.expectancy - parent.metrics.expectancy,
    drawdown: current.metrics.maxDrawdown - parent.metrics.maxDrawdown,
  } : null, [current, parent]);

  if (!project) return null;

  const stage = () => {
    const change: VariableChange = { id: id(), label: label.trim(), kind, before: "Baseline / parent version", after: after.trim(), rationale: rationale.trim() };
    const result = stageVariableChange(project.id, change);
    if (!result.ok) {
      setError(result.reason ?? "The variable change was not accepted.");
      return;
    }
    setError(null);
  };

  return (
    <div className="border-b hairline bg-panel px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2"><ShieldCheck className="h-4 w-4 text-research" /><span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Institutional Protocol result classification</span>{current ? <Pill tone={current.runClass === "BASELINE" ? "research" : "warn"}>{current.runClass === "BASELINE" ? "BASELINE · NO OPTIMIZATION" : "TUNED · ONE VARIABLE"}</Pill> : <Pill tone="default">STANDARD BACKTEST · NOT PROTOCOL EVIDENCE</Pill>}</div>
      {current && <div className="mt-2 grid gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(280px,.65fr)]"><Panel className="p-2.5"><div className="grid gap-1 text-[10px] sm:grid-cols-2 lg:grid-cols-4"><StatRow label="Sample" value={`${current.adequacy.sampleSize} trades`} /><StatRow label="Hit rate · 95% CI" value={`${(current.adequacy.hitRate * 100).toFixed(1)}% · ${(current.adequacy.hitRateInterval.lower * 100).toFixed(1)}–${(current.adequacy.hitRateInterval.upper * 100).toFixed(1)}%`} /><StatRow label="Adequacy" value={current.adequacy.status} tone={current.adequacy.status === "INSUFFICIENT" ? "neg" : current.adequacy.status === "LIMITED" ? "warn" : "pos"} /><StatRow label="Run hash" value={current.resultHash.slice(0, 12)} /></div><p className="mt-1.5 text-[9.5px] leading-relaxed text-muted-foreground">{current.adequacy.reason}</p>{current.provenanceWarnings.map((warning) => <p key={warning} className="mt-1 text-[9.5px] leading-relaxed text-warn">Data warning: {warning}</p>)}</Panel>{margin ? <Panel className="p-2.5"><div className="flex items-center gap-1.5 text-[10px] font-medium"><GitFork className="h-3.5 w-3.5 text-research" />Marginal effect vs direct parent</div><div className="mt-1 grid grid-cols-3 gap-2 text-[10px]"><div><span className="text-muted-foreground">Net P&L</span><p className={margin.netProfit >= 0 ? "text-pos" : "text-neg"}>{margin.netProfit >= 0 ? "+" : ""}{margin.netProfit.toFixed(0)}</p></div><div><span className="text-muted-foreground">Expectancy</span><p className={margin.expectancy >= 0 ? "text-pos" : "text-neg"}>{margin.expectancy >= 0 ? "+" : ""}{margin.expectancy.toFixed(2)}</p></div><div><span className="text-muted-foreground">Max DD</span><p className={margin.drawdown <= 0 ? "text-pos" : "text-neg"}>{margin.drawdown >= 0 ? "+" : ""}{margin.drawdown.toFixed(0)}</p></div></div></Panel> : null}</div>}

      {baseline && !project.pendingVariableChange && <Panel className="mt-2.5 p-2.5"><div className="flex items-center gap-1.5"><GitFork className="h-3.5 w-3.5 text-research" /><span className="text-[10.5px] font-medium">Stage exactly one variable for an incremental test</span><Pill tone="warn">TUNED RESULTS STAY DISTINCT</Pill></div><div className="mt-2 grid gap-2 md:grid-cols-4"><Input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Variable label" className="h-7 bg-surface text-[11px]" /><select value={kind} onChange={(event) => setKind(event.target.value as VariableChange["kind"])} className="h-7 rounded border hairline bg-surface px-2 text-[11px]"><option value="FILTER">Filter</option><option value="REGIME">Regime condition</option><option value="TIMEFRAME">Second timeframe</option><option value="SIZING">Sizing adjustment</option><option value="OTHER">Other</option></select><Input value={after} onChange={(event) => setAfter(event.target.value)} placeholder="One changed value only" className="h-7 bg-surface text-[11px]" /><Input value={rationale} onChange={(event) => setRationale(event.target.value)} placeholder="Isolated hypothesis rationale" className="h-7 bg-surface text-[11px]" /></div><div className="mt-2 flex items-center gap-2"><Button size="sm" onClick={stage} className="h-7 bg-research text-[11px] text-research-foreground hover:bg-research/90"><LockKeyhole className="mr-1 h-3.5 w-3.5" />Stage one variable</Button>{error && <span className="text-[9.5px] text-neg">{error}</span>}</div></Panel>}
      {baseline && project.pendingVariableChange && <Panel className="mt-2.5 p-2.5"><div className="flex flex-wrap items-center gap-2"><Pill tone="warn">ONE VARIABLE STAGED</Pill><span className="text-[10.5px]">{project.pendingVariableChange.label}: {project.pendingVariableChange.before} → {project.pendingVariableChange.after}</span><Button size="sm" onClick={onOpenStrategy} className="ml-auto h-7 bg-research text-[11px] text-research-foreground hover:bg-research/90">Open controlled incremental test</Button></div><p className="mt-1 text-[9.5px] text-muted-foreground">No additional variable can be staged while this experiment is pending. Baseline charts and tuned results will remain separately labelled.</p></Panel>}
      {!baseline && <div className="mt-2 flex items-start gap-2 rounded border border-warn/35 bg-warn/5 p-2 text-[9.5px] text-foreground/85"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warn" />A cited protocol cannot add complexity before one immutable baseline has completed. Standard backtest results are never silently promoted to protocol evidence.</div>}
    </div>
  );
}
