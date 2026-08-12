"use client";

import { useEffect, useState } from "react";
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
import { Panel, PanelHeader, Pill, SimulatedTag, StatRow } from "../terminal/primitives";
import { useStrategy } from "@/stores/strategy";
import { useWorkspace } from "@/stores/workspace";
import { listContracts, getContract } from "@/lib/market/contracts";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Timeframe } from "@/lib/market/types";
import type { BacktestResult } from "@/lib/strategy/zs-runtime";

const TIMEFRAMES: Timeframe[] = ["1m", "5m", "15m", "30m", "1h", "4h", "1d"];

export function StrategyView() {
  const {
    source, setSource,
    lastCompile, setLastCompile,
    params, setParams, setParam,
    config, setConfig,
    lastResult, setLastResult,
  } = useStrategy();
  const { setView, setSymbol } = useWorkspace();
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

  // run backtest
  const runBacktest = async () => {
    setBusy("backtest");
    try {
      const to = Date.now();
      const from = to - config.days * 86400_000;
      const r = await fetch("/api/backtest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          src: source,
          symbol: config.symbol,
          timeframe: config.timeframe,
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
      const j: BacktestResult & { diagnostics?: any[]; error?: string } = await r.json();
      if (j.error) {
        setLog((l) => [`[${new Date().toISOString().slice(11, 19)}] BACKTEST ERROR: ${j.error}`, ...l].slice(0, 50));
        setTab("errors");
        return;
      }
      setLastResult(j);
      setLog((l) => [
        `[${new Date().toISOString().slice(11, 19)}] backtest complete — ${j.metrics.totalTrades} trades · net ${(j.metrics.netProfit >= 0 ? "+" : "") + j.metrics.netProfit.toFixed(0)} · PF ${j.metrics.profitFactor.toFixed(2)} · DD ${j.metrics.maxDrawdownPct.toFixed(1)}% · hash ${j.hash}`,
        ...l,
      ].slice(0, 50));
      setSymbol(config.symbol);
      setView("backtester");
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
          <Play className="w-3.5 h-3.5" />{busy === "backtest" ? "Running…" : "Run Backtest"}
        </Button>
        <div className="ml-auto flex items-center gap-1.5">
          <Pill tone={lastCompile?.ok ? "pos" : "default"}>
            {lastCompile?.ok ? <><CheckCircle2 className="w-3 h-3" />Compiled</> : lastCompile ? <><AlertCircle className="w-3 h-3" />{errs.length} error{errs.length === 1 ? "" : "s"}</> : "Not compiled"}
          </Pill>
          <SimulatedTag />
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
            <CodeEditor value={source} onChange={setSource} />
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
            <CfgSelect label="Instrument" value={config.symbol} onChange={(v) => setConfig({ symbol: v })} options={listContracts().map((c) => c.symbol)} />
            <CfgSelect label="Timeframe" value={config.timeframe} onChange={(v) => setConfig({ timeframe: v })} options={TIMEFRAMES} />
            <Field label="Lookback (days)"><Input type="number" value={String(config.days)} onChange={(e) => setConfig({ days: Number(e.target.value) })} className="h-7 text-[12px] tnum bg-surface" /></Field>
            <Field label="Initial capital ($)"><Input type="number" value={String(config.initialCapital)} onChange={(e) => setConfig({ initialCapital: Number(e.target.value) })} className="h-7 text-[12px] tnum bg-surface" /></Field>
            <Field label="Position size"><Input type="number" value={String(config.positionSize)} onChange={(e) => setConfig({ positionSize: Number(e.target.value) })} className="h-7 text-[12px] tnum bg-surface" /></Field>
            <Field label="Commission / contract ($)"><Input type="number" value={String(config.commissionPerContract)} onChange={(e) => setConfig({ commissionPerContract: Number(e.target.value) })} className="h-7 text-[12px] tnum bg-surface" /></Field>
            <Field label="Slippage (ticks)"><Input type="number" value={String(config.slippageTicks)} onChange={(e) => setConfig({ slippageTicks: Number(e.target.value) })} className="h-7 text-[12px] tnum bg-surface" /></Field>
            <Field label="Spread (ticks)"><Input type="number" value={String(config.spreadTicks)} onChange={(e) => setConfig({ spreadTicks: Number(e.target.value) })} className="h-7 text-[12px] tnum bg-surface" /></Field>
            <div className="pt-2 border-t hairline">
              <StatRow label="Execution" value="next-bar open" tone="muted" hint="Anti look-ahead: signals on bar[i] fill at bar[i+1].open" />
              <StatRow label="Data" value="SIMULATED" tone="warn" />
            </div>
          </div>
        </div>
      </div>

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

function CfgSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <label className="block">
      <span className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{label}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-7 text-[12px] bg-surface"><SelectValue /></SelectTrigger>
        <SelectContent>
          {options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
        </SelectContent>
      </Select>
    </label>
  );
}
