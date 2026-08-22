"use client";

/* Initial strategy validation intentionally synchronizes editor diagnostics on mount. */
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  Code2,
  FileCode2,
  Info,
  Play,
  Save,
  Terminal as TerminalIcon,
  TriangleAlert,
} from "lucide-react";
import { CodeEditor } from "../terminal/code-editor";
import { Panel, PanelHeader, Pill, StatRow } from "../terminal/primitives";
import { useStrategy } from "@/stores/strategy";
import { useWorkspace } from "@/stores/workspace";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Timeframe } from "@/lib/market/types";
import type { BacktestResult } from "@/lib/strategy/zs-runtime";
import { useInstitutionalProtocol } from "@/stores/institutional-protocol";
import { ProtocolStrategyPanel } from "./protocol-strategy-panel";
import { assessSampleAdequacy, baselineFingerprint } from "@/domain/protocol/policy";
import { buildSingleVariableSource } from "@/domain/protocol/generation";


export function StrategyView() {
  const {
    source, setSource,
    lastCompile, setLastCompile,
    params, setParams, setParam,
    config, setConfig,
    lastResult, setLastResult,
  } = useStrategy();
  const { symbol: workspaceSymbol, timeframe: workspaceTimeframe } = useWorkspace();
  const { projects, activeProjectId, addRun, completeIncrementalRun } = useInstitutionalProtocol();
  const activeProtocol = projects.find((project) => project.id === activeProjectId) ?? null;
  const lockedArtifact = activeProtocol?.artifacts.at(-1);
  const protocolBaselineLocked = lockedArtifact?.approval === "APPROVED";
  const [busy, setBusy] = useState<"validate" | "backtest" | null>(null);
  const [tab, setTab] = useState<"console" | "errors" | "warnings">("console");
  const [log, setLog] = useState<string[]>([]);

  // validate / compile
  const validate = async () => {
    setBusy("validate");
    try {
      const r = await fetch("/api/strategy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ src: source }),
      });
      const j = await r.json();
      setLastCompile(j);
      // sync params with defaults
      const np: Record<string, number | string | boolean> = {};
      for (const inp of j.inputs ?? []) {
        np[inp.name] = params[inp.name] ?? inp.default;
      }
      setParams(np);
      setLog((l) => [
        `[${new Date().toISOString().slice(11, 19)}] validate — ${j.ok ? "OK" : "FAILED"} (${j.inputs?.length ?? 0} inputs, ${j.diagnostics?.length ?? 0} diagnostics)`,
        ...l,
      ].slice(0, 50));
      if (j.ok) setTab("console");
      else setTab("errors");
    } finally {
      setBusy(null);
    }
  };

  // Protocol baselines are immutable; downstream tests consume exactly one staged variable change.
  const runBacktest = async () => {
    const pendingChange = activeProtocol?.pendingVariableChange ?? null;
    const protocolReady = Boolean(activeProtocol && protocolBaselineLocked && lockedArtifact && activeProtocol.revisions.at(-1) && activeProtocol.assessments.at(-1)?.selectedDataset);
    const isProtocolIncremental = Boolean(protocolReady && pendingChange);
    const isProtocolBaseline = Boolean(protocolReady && !pendingChange);
    const to = Date.now();
    const from = to - config.days * 86400_000;
    const baseInput = protocolReady && activeProtocol && lockedArtifact
      ? {
          ruleSpecRevisionHash: activeProtocol.revisions.at(-1)!.hash,
          generatedArtifactHash: lockedArtifact.hash,
          datasetIdentity: JSON.stringify(activeProtocol.assessments.at(-1)!.selectedDataset),
          executionModel: "next-bar-open",
          costModel: `commission:${config.commissionPerContract}|slippage:${config.slippageTicks}|spread:${config.spreadTicks}`,
          initialCapital: config.initialCapital,
          positionSize: config.positionSize,
        }
      : null;
    const fingerprint = isProtocolBaseline && baseInput ? baselineFingerprint(baseInput) : null;
    const existingBaseline = fingerprint && activeProtocol?.runs.find((run) => run.runClass === "BASELINE" && run.fingerprint === fingerprint);
    const priorProtocolBaseline = activeProtocol && lockedArtifact ? activeProtocol.runs.find((run) => run.runClass === "BASELINE" && run.generatedArtifactId === lockedArtifact.id) : null;
    if (isProtocolBaseline && priorProtocolBaseline && fingerprint && priorProtocolBaseline.fingerprint !== fingerprint) {
      setLog((current) => [`[${new Date().toISOString().slice(11, 19)}] BASELINE BLOCKED: settings differ from the immutable baseline. Create one declared Stage 6 variable change instead.`, ...current].slice(0, 50));
      setTab("errors");
      return;
    }
    if (existingBaseline) {
      setLog((current) => [`[${new Date().toISOString().slice(11, 19)}] baseline reused — fingerprint ${fingerprint}. Changed settings require a one-variable incremental experiment.`, ...current].slice(0, 50));
      setLog((current) => [`[${new Date().toISOString().slice(11, 19)}] baseline already exists — review the retained run below before starting a declared incremental experiment.`, ...current].slice(0, 50));
      setTab("console");
      return;
    }
    if (activeProtocol && protocolBaselineLocked && !baseInput) {
      setLog((current) => [`[${new Date().toISOString().slice(11, 19)}] BASELINE BLOCKED: attach a verified dataset before running the frozen protocol code.`, ...current].slice(0, 50));
      setTab("errors");
      return;
    }
    const transformed = isProtocolIncremental && pendingChange ? buildSingleVariableSource(lockedArtifact!.source, pendingChange) : null;
    if (transformed && !transformed.ok) {
      setLog((current) => [`[${new Date().toISOString().slice(11, 19)}] INCREMENTAL BLOCKED: ${transformed.reason}`, ...current].slice(0, 50));
      setTab("errors");
      return;
    }
    const executionSource = transformed?.ok ? transformed.source : source;
    setBusy("backtest");
    try {
      const r = await fetch("/api/backtest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          src: executionSource,
          symbol: workspaceSymbol,
          timeframe: workspaceTimeframe,
          from,
          to,
          initialCapital: config.initialCapital,
          commissionPerContract: config.commissionPerContract,
          slippageTicks: config.slippageTicks,
          spreadTicks: config.spreadTicks,
          positionSize: config.positionSize,
          params,
        }),
      });
      const j: BacktestResult & { diagnostics?: unknown[]; error?: string } = await r.json();
      if (j.error) {
        setLog((l) => [`[${new Date().toISOString().slice(11, 19)}] BACKTEST ERROR: ${j.error}`, ...l].slice(0, 50));
        setTab("errors");
        return;
      }
      setLastResult(j);
      const adequacy = assessSampleAdequacy(j.metrics.winners, j.metrics.totalTrades);
      const common = activeProtocol && lockedArtifact ? {
        ruleSpecRevisionId: activeProtocol.revisions.at(-1)!.id,
        generatedArtifactId: lockedArtifact.id,
        resultHash: j.hash,
        metrics: { totalTrades: j.metrics.totalTrades, winRate: j.metrics.winRate, avgWin: j.metrics.avgWin, avgLoss: j.metrics.avgLoss, expectancy: j.metrics.expectancy, maxDrawdown: j.metrics.maxDrawdown, netProfit: j.metrics.netProfit },
        adequacy,
        provenanceWarnings: activeProtocol.assessments.at(-1)?.selectedDataset?.qualityWarnings ?? ["Dataset provenance is not attached."],
        createdAt: new Date().toISOString(),
      } : null;
      if (isProtocolBaseline && activeProtocol && fingerprint && common) {
        addRun(activeProtocol.id, { id: `run_${j.runId}`, runClass: "BASELINE", fingerprint, parentRunId: null, variableChange: null, ...common });
        setLog((l) => [`[${new Date().toISOString().slice(11, 19)}] BASELINE COMPLETE — no optimization · ${j.metrics.totalTrades} trades · 95% hit-rate interval ${(adequacy.hitRateInterval.lower * 100).toFixed(1)}–${(adequacy.hitRateInterval.upper * 100).toFixed(1)}% · ${adequacy.status}`, ...l].slice(0, 50));
      } else if (isProtocolIncremental && activeProtocol && pendingChange && priorProtocolBaseline && baseInput && common) {
        const incrementalFingerprint = baselineFingerprint({ ...baseInput, datasetIdentity: `${baseInput.datasetIdentity}|variable:${pendingChange.id}`, executionModel: "next-bar-open-incremental", costModel: `${baseInput.costModel}|variable:${pendingChange.kind}:${pendingChange.after}` });
        completeIncrementalRun(activeProtocol.id, { id: `run_${j.runId}`, runClass: "INCREMENTAL", fingerprint: incrementalFingerprint, parentRunId: priorProtocolBaseline.id, variableChange: pendingChange, ...common });
        setLog((l) => [`[${new Date().toISOString().slice(11, 19)}] INCREMENTAL COMPLETE — ${pendingChange.label} · direct-parent comparison is labelled TUNED and kept separate from baseline.`, ...l].slice(0, 50));
      } else {
        setLog((l) => [`[${new Date().toISOString().slice(11, 19)}] standard backtest complete — ${j.metrics.totalTrades} trades · net ${(j.metrics.netProfit >= 0 ? "+" : "") + j.metrics.netProfit.toFixed(0)} · PF ${j.metrics.profitFactor.toFixed(2)} · DD ${j.metrics.maxDrawdownPct.toFixed(1)}% · hash ${j.hash}`, ...l].slice(0, 50));
      }
      setLog((current) => [`[${new Date().toISOString().slice(11, 19)}] chart context retained — ${workspaceSymbol} · ${workspaceTimeframe}. Historical-provider provenance is attached to the run.`, ...current].slice(0, 50));
    } finally {
      setBusy(null);
    }
  };

  // auto-validate on mount once
  useEffect(() => {
    if (!lastCompile) validate();
  }, []);

  const errs = lastCompile?.diagnostics?.filter((d) => d.severity === "error") ?? [];
  const warns = lastCompile?.diagnostics?.filter((d) => d.severity === "warning") ?? [];
  const infos = lastCompile?.diagnostics?.filter((d) => d.severity === "info") ?? [];

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Top action bar */}
      <div className="h-10 shrink-0 border-b hairline bg-panel flex items-center gap-2 px-3">
        <Code2 className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-[12.5px] font-semibold">{lastCompile?.name ?? "Untitled"}</span>
        <span className="text-[10px] text-muted-foreground uppercase">.zs</span>
        <div className="w-px h-5 bg-border/60 mx-1" />
        <Button size="sm" variant="ghost" className="h-7 text-[12px] gap-1.5"><Save className="w-3.5 h-3.5" />Save</Button>
        <Button size="sm" variant="outline" onClick={validate} disabled={busy === "validate"} className="h-7 text-[12px] gap-1.5">
          {busy === "validate" ? "Validating…" : "Validate"}
        </Button>
        <Button size="sm" variant="outline" onClick={validate} disabled={busy === "validate"} className="h-7 text-[12px] gap-1.5">Compile</Button>
        <Button size="sm" onClick={runBacktest} disabled={busy === "backtest"} className="h-7 text-[12px] gap-1.5 bg-research text-research-foreground hover:bg-research/90">
          <Play className="w-3.5 h-3.5" />{busy === "backtest" ? "Running…" : protocolBaselineLocked ? "Run Baseline · no optimization" : "Run Backtest"}
        </Button>
        <div className="ml-auto flex items-center gap-1.5">
          <Pill tone={lastCompile?.ok ? "pos" : "default"}>
            {lastCompile?.ok ? <><CheckCircle2 className="w-3 h-3" />Compiled</> : lastCompile ? <><AlertCircle className="w-3 h-3" />{errs.length} error{errs.length === 1 ? "" : "s"}</> : "Not compiled"}
          </Pill>
          <Pill tone="pos">Research only</Pill>
          <Link href="/docs/zscript" className="rounded-[3px] border hairline px-2 py-1 text-[10px] text-mdata hover:bg-hover hover:text-foreground">ZScript docs</Link>
        </div>
      </div>

      {/* Body: editor | right config | bottom console */}
      <div className="flex-1 min-h-0 flex">
        {/* editor */}
        <div className="flex-1 min-w-0 flex flex-col border-r hairline">
          <div className="h-7 border-b hairline bg-panel flex items-center px-2.5 gap-2">
            <FileCode2 className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-[11px] text-muted-foreground">strategy.zs</span>
          </div>
          <div className="flex-1 min-h-0">
            <CodeEditor value={source} onChange={setSource} readOnly={protocolBaselineLocked} />
          </div>
        </div>

        {/* right config */}
        <div className="w-[260px] shrink-0 bg-panel flex flex-col overflow-hidden">
          <div className="h-7 border-b hairline bg-panel flex items-center px-2.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Inputs</span>
          </div>
          <div className="overflow-y-auto scroll-thin p-2.5 space-y-2 border-b hairline">
            {lastCompile?.inputs?.length ? (
              lastCompile.inputs.map((inp) => (
                <div key={inp.name}>
                  <label className="flex items-center justify-between text-[10.5px] uppercase tracking-wider text-muted-foreground mb-1">
                    <span>{inp.name}</span>
                    <span className="text-[9px] opacity-70">{inp.type}</span>
                  </label>
                  <Input
                    type="number"
                    value={String(params[inp.name] ?? inp.default)}
                    onChange={(e) => setParam(inp.name, Number(e.target.value))}
                    disabled={protocolBaselineLocked}
                    className="h-7 text-[12px] tnum bg-surface"
                  />
                  {(inp.minval != null || inp.maxval != null) && (
                    <div className="text-[9px] text-muted-foreground mt-0.5 tnum">
                      {inp.minval ?? "—"} … {inp.maxval ?? "—"}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="text-[11px] text-muted-foreground">No inputs detected. Validate to refresh.</div>
            )}
          </div>

          <div className="h-7 border-b hairline bg-panel flex items-center px-2.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Configuration</span>
          </div>
          <div className="overflow-y-auto scroll-thin p-2.5 space-y-2">
            <MarketContextField symbol={workspaceSymbol} timeframe={workspaceTimeframe as Timeframe} />
            <Field label="Lookback (days)"><Input type="number" min="1" max="60" value={String(config.days)} onChange={(e) => setConfig({ days: Math.max(1, Math.min(60, Number(e.target.value) || 1)) })} disabled={protocolBaselineLocked} className="h-7 text-[12px] tnum bg-surface" /></Field>
            <Field label="Initial capital (USDT)"><Input type="number" min="1" value={String(config.initialCapital)} onChange={(e) => setConfig({ initialCapital: Math.max(1, Number(e.target.value) || 1) })} disabled={protocolBaselineLocked} className="h-7 text-[12px] tnum bg-surface" /></Field>
            <Field label="Native contract quantity"><Input type="number" min="1" step="1" value={String(config.positionSize)} onChange={(e) => setConfig({ positionSize: Math.max(1, Math.floor(Number(e.target.value) || 1)) })} disabled={protocolBaselineLocked} className="h-7 text-[12px] tnum bg-surface" /></Field>
            <Field label="Commission / native contract (USDT)"><Input type="number" min="0" step="0.0001" value={String(config.commissionPerContract)} onChange={(e) => setConfig({ commissionPerContract: Math.max(0, Number(e.target.value) || 0) })} disabled={protocolBaselineLocked} className="h-7 text-[12px] tnum bg-surface" /></Field>
            <Field label="Slippage (ticks)"><Input type="number" min="0" step="0.1" value={String(config.slippageTicks)} onChange={(e) => setConfig({ slippageTicks: Math.max(0, Number(e.target.value) || 0) })} disabled={protocolBaselineLocked} className="h-7 text-[12px] tnum bg-surface" /></Field>
            <Field label="Spread (ticks)"><Input type="number" min="0" step="0.1" value={String(config.spreadTicks)} onChange={(e) => setConfig({ spreadTicks: Math.max(0, Number(e.target.value) || 0) })} disabled={protocolBaselineLocked} className="h-7 text-[12px] tnum bg-surface" /></Field>
            <div className="text-[9.5px] text-muted-foreground leading-relaxed">{protocolBaselineLocked ? "Baseline code and configuration are frozen. Any changed setting must be created as one declared downstream variable, never rerun as a baseline." : "The chart’s active verified provider supplies the historical request. If it is unavailable, the run is withheld rather than substituted."}</div>
            <div className="pt-2 border-t hairline">
              <StatRow label="Execution" value="next-bar open" tone="muted" hint="Anti look-ahead: signals on bar[i] fill at bar[i+1].open" />
              <StatRow label="Data" value="ACTIVE PROVIDER · HISTORICAL" tone="pos" hint="Public candles and source provenance are attached to each successful run." />
            </div>
          </div>
        </div>
      </div>

      {activeProtocol && <ProtocolStrategyPanel onAdoptSource={(generatedSource) => { setSource(generatedSource); setLastCompile(null); setLog((current) => [`[${new Date().toISOString().slice(11, 19)}] protocol generation staged — validate the generated minimal source before baseline review`, ...current].slice(0, 50)); }} />}

      {/* Bottom console */}
      <div className="h-[200px] shrink-0 border-t hairline bg-panel flex flex-col">
        <div className="h-7 border-b hairline flex items-center px-2 gap-1">
          <TerminalIcon className="w-3.5 h-3.5 text-muted-foreground" />
          {(["console", "errors", "warnings"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "h-6 px-2 rounded-[3px] text-[11px] capitalize transition-colors",
                tab === t ? "bg-hover text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t}
              {t === "errors" && errs.length > 0 && <span className="ml-1 text-neg">{errs.length}</span>}
              {t === "warnings" && warns.length > 0 && <span className="ml-1 text-warn">{warns.length}</span>}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto scroll-thin p-2 font-mono-num text-[11.5px]">
          {tab === "console" && (
            log.length ? (
              log.map((l, i) => <div key={i} className="text-foreground/85 leading-relaxed">{l}</div>)
            ) : (
              <div className="text-muted-foreground">$ Run Validate then Run Backtest. Results are deterministic.</div>
            )
          )}
          {tab === "errors" && (
            errs.length ? errs.map((d, i) => (
              <div key={i} className="flex items-start gap-2 text-neg leading-relaxed">
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>line {d.line}: {d.message}</span>
              </div>
            )) : <div className="text-muted-foreground">No errors.</div>
          )}
          {tab === "warnings" && (
            (warns.length || infos.length) ? [...warns, ...infos].map((d, i) => (
              <div key={i} className={cn("flex items-start gap-2 leading-relaxed", d.severity === "warning" ? "text-warn" : "text-mdata")}>
                {d.severity === "warning" ? <TriangleAlert className="w-3.5 h-3.5 mt-0.5 shrink-0" /> : <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />}
                <span>line {d.line}: {d.message}</span>
              </div>
            )) : <div className="text-muted-foreground">No warnings.</div>
          )}
          {lastResult && tab === "console" && (
            <div className="mt-2 pt-2 border-t hairline text-muted-foreground">
              Last run: {lastResult.runId} · {lastResult.barsProcessed} bars · hash {lastResult.hash}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{label}</span>
      {children}
    </label>
  );
}

function MarketContextField({ symbol, timeframe }: { symbol: string; timeframe: Timeframe }) {
  return <div className="rounded-[3px] border hairline bg-surface p-2"><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Chart context</div><div className="mt-1 flex items-center justify-between gap-2 font-mono-num text-[11px] text-foreground"><span>{symbol}</span><span className="rounded bg-research/15 px-1.5 py-0.5 text-[9px] text-research">{timeframe}</span></div><p className="mt-1 text-[9px] leading-relaxed text-muted-foreground">Backtests use this selected market only when the active provider returns verified historical bars.</p></div>;
}
