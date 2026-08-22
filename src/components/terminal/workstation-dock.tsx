"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Bell,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Code2,
  Database,
  Dices,
  FlaskConical,
  GripHorizontal,
  Play,
  Radio,
  Save,
  Search,
  StickyNote,
  TerminalSquare,
} from "lucide-react";
import { CodeEditor } from "./code-editor";
import { useStrategy } from "@/stores/strategy";
import { useWorkspace } from "@/stores/workspace";
import { cn } from "@/lib/utils";
import { simulateTradeSequence, type MonteCarloSummary } from "@/domain/validation/resampling";

export type DockTab = "script" | "tester" | "research" | "data" | "alerts" | "trading";

const TABS: { id: DockTab; label: string; icon: typeof Code2 }[] = [
  { id: "script", label: "Python Research", icon: Code2 },
  { id: "tester", label: "Strategy Tester", icon: FlaskConical },
  { id: "research", label: "Research", icon: StickyNote },
  { id: "data", label: "Data", icon: Database },
  { id: "alerts", label: "Alerts", icon: Bell },
  { id: "trading", label: "Trading Panel", icon: Radio },
];

const DEFAULT_RESEARCH_STAGES = [
  { label: "Hypothesis", detail: "Momentum continuation above session VWAP", state: "active" },
  { label: "Data", detail: "Active provider · verified manifest required", state: "ready" },
  { label: "Chart evidence", detail: "EMA 20 / EMA 50 crossover", state: "ready" },
  { label: "Model", detail: "EMA Cross + VWAP Filter", state: "ready" },
  { label: "Backtest", detail: "Run strategy to attach evidence", state: "pending" },
  { label: "Validation", detail: "Out-of-sample review required", state: "pending" },
];

export function BottomDock() {
  const [tab, setTab] = useState<DockTab>("script");
  const [open, setOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [height, setHeight] = useState(() => {
    if (typeof window === "undefined") return 254;
    try {
      const saved = window.localStorage.getItem("zterminal.dock-height.v1");
      return saved ? Math.min(520, Math.max(180, Number(saved))) : 254;
    } catch {
      return 254;
    }
  });
  const [busy, setBusy] = useState<"validate" | "run" | null>(null);
  const [log, setLog] = useState<string[]>(["ready · local workspace initialized"]);
  const [search, setSearch] = useState("");
  const dragState = useRef<{ startY: number; startHeight: number } | null>(null);
  const { source, setSource, lastCompile, setLastCompile, lastResult } = useStrategy();
  const { symbol, timeframe } = useWorkspace();

  useEffect(() => {
    const openTab = (event: Event) => {
      const requested = (event as CustomEvent<DockTab>).detail;
      if (!TABS.some((item) => item.id === requested)) return;
      setTab(requested);
      setOpen(true);
      setMobileOpen(true);
    };
    window.addEventListener("zterminal:open-dock", openTab);
    return () => window.removeEventListener("zterminal:open-dock", openTab);
  }, []);

  useEffect(() => {
    try { window.localStorage.setItem("zterminal.dock-height.v1", String(height)); } catch { /* ignore */ }
  }, [height]);

  useEffect(() => {
    const move = (event: PointerEvent) => {
      if (!dragState.current) return;
      const next = dragState.current.startHeight + dragState.current.startY - event.clientY;
      setHeight(Math.min(520, Math.max(180, next)));
    };
    const stop = () => { dragState.current = null; document.body.style.removeProperty("user-select"); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", stop); };
  }, []);

  const appendLog = (message: string) => setLog((current) => [`${new Date().toISOString().slice(11, 19)} ${message}`, ...current].slice(0, 40));

  const validate = async () => {
    setBusy("validate");
    try {
      const response = await fetch("/api/research/artifacts/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schema_version: "research.v2.0", kind: "strategy", language: "python", source, runtime_lock: "python-3.12/research-sdk-0.1.0", rights_attestation: "I own or am authorized to use this research source.", origin: { kind: "native_python" } }),
      });
      const result = await response.json();
      setLastCompile({ status: result.status ?? "UNSUPPORTED", diagnostics: result.diagnostics ?? [{ code: result.code ?? "RESEARCH_API_UNAVAILABLE", level: "ERROR", message: result.error ?? "Python research API unavailable" }], sourceHash: result.source_hash, artifactId: result.artifact_id });
      appendLog(`${result.status ?? "UNSUPPORTED"} · Python artifact validation`);
    } catch {
      setLastCompile({ status: "UNSUPPORTED", diagnostics: [{ code: "RESEARCH_API_UNAVAILABLE", level: "ERROR", message: "No Python research service is configured." }] });
      appendLog("UNSUPPORTED · no Python research service configured");
    } finally {
      setBusy(null);
    }
  };

  const runBacktest = async () => {
    if (!lastCompile?.artifactId) {
      appendLog("BLOCKED · validate a Python artifact before requesting a research job");
      return;
    }
    setBusy("run");
    try {
      const now = Date.now();
      const response = await fetch("/api/research/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schema_version: "research.v2.0", kind: "strategy_backtest", artifact_id: lastCompile.artifactId, dataset_manifest: { provider: "binance", native_symbol: symbol, timeframe, from_ms: now - 30 * 86_400_000, to_ms: now, quality_status: "UNAVAILABLE" }, execution_policy: { fill_model: "next_bar_open", commission_per_contract: 0, slippage_ticks: 0, spread_ticks: 0, position_size: 1 } }),
      });
      const result = await response.json();
      appendLog(`${result.status ?? "UNSUPPORTED"} · ${result.diagnostics?.[0]?.message ?? result.error ?? "research job withheld"}`);
      setTab("tester");
    } catch {
      appendLog("UNSUPPORTED · no durable Python/Rust research queue is configured");
    } finally {
      setBusy(null);
    }
  };

  const startResize = (event: React.PointerEvent) => {
    event.preventDefault();
    dragState.current = { startY: event.clientY, startHeight: height };
    document.body.style.userSelect = "none";
  };

  return (
    <section className={cn("bottom-dock shrink-0 border-t hairline bg-panel", !open && "h-8", mobileOpen && "mobile-dock-expanded")} style={open ? { height } : undefined} aria-label="Research workspace dock">
      {open && <button aria-label="Resize lower workspace" onPointerDown={startResize} className="dock-resizer group absolute -translate-y-1/2 left-0 right-0 h-2 cursor-row-resize z-10">
        <span className="mx-auto block h-0.5 w-12 rounded-full bg-foreground/15 group-hover:bg-mdata/70" />
      </button>}
      <div className="dock-tabs h-8 shrink-0 border-b hairline flex items-center px-2 gap-0.5 bg-panel">
        <div className="flex items-center gap-1 pr-2 mr-1 border-r hairline">
          <TerminalSquare className="w-3.5 h-3.5 text-mdata" />
          <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Workspace</span>
        </div>
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => { setTab(id); setOpen(true); setMobileOpen(true); }} className={cn("dock-tab h-6 px-2 rounded-[3px] flex items-center gap-1.5 text-[10.5px] whitespace-nowrap", tab === id && open ? "bg-hover text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-hover/60")}>
            <Icon className="w-3 h-3" /><span className="dock-tab-label">{label}</span>
            {id === "tester" && lastResult && <span className="h-1.5 w-1.5 rounded-full bg-pos" />}
          </button>
        ))}
        <button onClick={() => setMobileOpen((value) => !value)} className="mobile-dock-toggle ml-auto grid h-6 w-7 place-items-center rounded-[3px] text-muted-foreground hover:bg-hover hover:text-foreground" aria-label={mobileOpen ? "Collapse workspace sheet" : "Expand workspace sheet"}>{mobileOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}</button>
        <button onClick={() => { setOpen((value) => !value); setMobileOpen(false); }} className="desktop-dock-toggle h-6 px-2 rounded-[3px] text-[10px] text-muted-foreground hover:text-foreground hover:bg-hover" aria-expanded={open}>{open ? "Collapse" : "Expand"}</button>
      </div>
      {open && <div className="dock-content h-[calc(100%-32px)] min-h-0 overflow-hidden">{tab === "script" && <ScriptPanel source={source} setSource={setSource} lastCompile={lastCompile} busy={busy} validate={validate} runBacktest={runBacktest} log={log} />}{tab === "tester" && <TesterPanel result={lastResult} log={log} />}{tab === "research" && <ResearchPanel hasResult={Boolean(lastResult)} />}{tab === "data" && <DataPanel symbol={symbol} timeframe={timeframe} />}{tab === "alerts" && <AlertsPanel search={search} setSearch={setSearch} />}{tab === "trading" && <TradingPanel />}</div>}
    </section>
  );
}

function ScriptPanel({ source, setSource, lastCompile, busy, validate, runBacktest, log }: { source: string; setSource: (value: string) => void; lastCompile: ReturnType<typeof useStrategy.getState>["lastCompile"]; busy: "validate" | "run" | null; validate: () => void; runBacktest: () => void; log: string[] }) {
  const errors = lastCompile?.diagnostics?.filter((item) => item.level === "ERROR") ?? [];
  return <div className="h-full flex flex-col">
    <div className="h-8 shrink-0 border-b hairline flex items-center gap-2 px-2.5">
      <span className="text-[10px] text-muted-foreground font-mono-num">strategy.py</span>
      <span className="text-[10px] text-muted-foreground/60">·</span>
      <span className="text-[10px] text-muted-foreground">Python Research API</span>
      <a href="/docs/python-research" target="_blank" rel="noreferrer" className="ml-1 inline-flex h-6 items-center gap-1 rounded-[3px] px-1.5 text-[10px] text-mdata hover:bg-mdata/10"><BookOpen className="h-3 w-3" />Python docs</a>
      <div className="ml-auto flex items-center gap-1">
        <button onClick={() => window.dispatchEvent(new Event("zterminal:saved"))} className="dock-action"><Save className="w-3 h-3" />Save</button>
        <button onClick={validate} disabled={busy !== null} className="dock-action"><CheckCircle2 className="w-3 h-3" />{busy === "validate" ? "Validating" : "Validate"}</button>
        <button onClick={runBacktest} disabled={busy !== null} className="dock-action primary"><Play className="w-3 h-3" />{busy === "run" ? "Running" : "Run"}</button>
      </div>
    </div>
    <div className="script-panel-grid min-h-0 flex-1 grid grid-cols-[minmax(0,1fr)_240px]">
      <div className="script-code min-w-0 min-h-0 border-r hairline"><CodeEditor value={source} onChange={setSource} /></div>
      <div className="script-details min-h-0 flex flex-col bg-surface/30">
        <div className="px-2.5 py-2 border-b hairline"><div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Execution</div><div className="mt-1 text-[11px] font-mono-num text-foreground">next bar open</div><div className="mt-1 text-[10px] text-muted-foreground">Deterministic runtime · no broker route</div></div>
        <div className="min-h-0 flex-1 overflow-y-auto scroll-thin p-2.5">
          <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-2">Diagnostics</div>
          {!lastCompile && <div className="text-[10px] text-muted-foreground">Validate to inspect the script.</div>}
          {lastCompile?.status === "VALID" && <div className="flex items-center gap-1.5 text-[10px] text-pos"><CheckCircle2 className="w-3 h-3" />Python artifact validated</div>}
          {errors.map((error, index) => <div key={index} className="mt-1 flex gap-1.5 text-[10px] text-neg"><AlertCircle className="w-3 h-3 shrink-0" />L{error.line ?? "—"} {error.message}</div>)}
        </div>
        <div className="h-16 shrink-0 border-t hairline p-2 overflow-y-auto scroll-thin"><div className="text-[9px] uppercase tracking-[0.16em] text-muted-foreground mb-1">Output</div>{log.slice(0, 2).map((line) => <div key={line} className="text-[10px] text-muted-foreground font-mono-num truncate">{line}</div>)}</div>
      </div>
    </div>
  </div>;
}

function TesterPanel({ result, log }: { result: ReturnType<typeof useStrategy.getState>["lastResult"]; log: string[] }) {
  const metrics = result?.metrics;
  const rows = metrics ? [
    ["Net profit", `${metrics.netProfit >= 0 ? "+" : "−"}$${Math.abs(metrics.netProfit).toLocaleString()}`, metrics.netProfit >= 0 ? "text-pos" : "text-neg"],
    ["Win rate", `${(metrics.winRate * 100).toFixed(1)}%`, "text-foreground"],
    ["Profit factor", metrics.profitFactor.toFixed(2), "text-foreground"],
    ["Sharpe", metrics.sharpe.toFixed(2), "text-foreground"],
    ["Max drawdown", `${metrics.maxDrawdownPct.toFixed(1)}%`, "text-neg"],
    ["Trades", String(metrics.totalTrades), "text-foreground"],
  ] : [];
  return <div className="h-full flex flex-col">
    <div className="h-8 shrink-0 border-b hairline flex items-center px-2.5 gap-2"><span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Backtest evidence</span>{result && <><span className="text-[10px] text-muted-foreground/50">·</span><span className="text-[10px] font-mono-num text-mdata">{result.config.symbol} · {result.config.timeframe}</span><span className="text-[10px] text-pos ml-auto">archived result</span></>}</div>
    {!result ? <div className="flex-1 grid place-items-center text-center"><div><FlaskConical className="mx-auto w-5 h-5 text-muted-foreground/60 mb-2" /><div className="text-[11px] text-muted-foreground">Queue a validated Python research job to attach reviewed trades to the chart.</div><div className="text-[10px] text-muted-foreground/60 mt-1">No performance values are shown until a deterministic run exists.</div></div></div> : <div className="tester-grid min-h-0 flex-1 grid grid-cols-[minmax(0,1fr)_280px]">
      <div className="min-w-0 min-h-0 overflow-y-auto scroll-thin"><table className="w-full text-[10.5px] tnum"><thead><tr className="border-b hairline text-[9px] uppercase tracking-[0.14em] text-muted-foreground"><th className="px-3 py-2 text-left font-medium">Trade</th><th className="px-3 py-2 text-left font-medium">Side</th><th className="px-3 py-2 text-right font-medium">Entry</th><th className="px-3 py-2 text-right font-medium">Exit</th><th className="px-3 py-2 text-right font-medium">P&amp;L</th></tr></thead><tbody>{result.trades.slice(-12).reverse().map((trade) => <tr key={trade.id} className="border-b hairline/60"><td className="px-3 py-1.5 text-muted-foreground">#{trade.id}</td><td className={cn("px-3 py-1.5 uppercase", trade.side === "long" ? "text-pos" : "text-neg")}>{trade.side}</td><td className="px-3 py-1.5 text-right text-muted-foreground">{trade.entryPrice.toLocaleString()}</td><td className="px-3 py-1.5 text-right text-muted-foreground">{trade.exitPrice.toLocaleString()}</td><td className={cn("px-3 py-1.5 text-right", trade.pnl >= 0 ? "text-pos" : "text-neg")}>{trade.pnl >= 0 ? "+" : "−"}{Math.abs(trade.pnl).toFixed(2)}</td></tr>)}</tbody></table></div>
      <div className="tester-metrics min-h-0 overflow-y-auto scroll-thin border-l hairline bg-surface/30 p-2.5"><div className="grid grid-cols-2 content-start gap-x-4 gap-y-2">{rows.map(([label, value, tone]) => <div key={label}><div className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground">{label}</div><div className={cn("mt-0.5 text-[12px] font-mono-num", tone)}>{value}</div></div>)}<div className="col-span-2 pt-2 border-t hairline text-[9px] text-muted-foreground font-mono-num truncate">{result.barsProcessed} bars · {result.hash}</div></div><MonteCarloPanel result={result} /></div>
    </div>}
    <div className="h-6 shrink-0 border-t hairline px-2.5 flex items-center gap-2 text-[9px] text-muted-foreground"><span className="uppercase tracking-[0.14em]">Run log</span><span className="truncate font-mono-num">{log[0]}</span></div>
  </div>;
}

function MonteCarloPanel({ result }: { result: NonNullable<ReturnType<typeof useStrategy.getState>["lastResult"]> }) {
  const [seed, setSeed] = useState(90210);
  const [paths, setPaths] = useState(1000);
  const tradePnl = result.trades.map((trade) => trade.pnl);
  const summary = useMemo<MonteCarloSummary | null>(() => tradePnl.length >= 10 ? simulateTradeSequence(tradePnl, { paths, initialEquity: result.config.initialCapital, seed }) : null, [paths, result.config.initialCapital, result.hash, seed, tradePnl.length]);
  return <section className="mt-4 border-t hairline pt-3"><div className="flex items-center gap-1.5"><Dices className="w-3.5 h-3.5 text-research" /><span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Monte Carlo · trade-path order</span></div><p className="mt-1 text-[9px] leading-4 text-muted-foreground">Resamples the completed closed-trade sequence only. It models path dependency, not price forecasting.</p><div className="mt-2 grid grid-cols-2 gap-2"><label className="text-[9px] text-muted-foreground">Paths<select value={paths} onChange={(event) => setPaths(Number(event.target.value))} className="mt-1 h-6 w-full border hairline bg-panel px-1.5 text-[10px] text-foreground outline-none"><option value={250}>250</option><option value={1000}>1,000</option><option value={2000}>2,000</option></select></label><label className="text-[9px] text-muted-foreground">Seed<input value={seed} onChange={(event) => setSeed(Math.max(0, Number(event.target.value) || 0))} inputMode="numeric" className="mt-1 h-6 w-full border hairline bg-panel px-1.5 text-[10px] font-mono-num text-foreground outline-none" /></label></div>{!summary ? <div className="mt-3 border border-warn/25 bg-warn/5 p-2 text-[9px] leading-4 text-warn">At least 10 closed trades are required before path-order uncertainty is displayed. This run contains {tradePnl.length}.</div> : <div className="mt-3 space-y-2"><MonteCarloRange label="Terminal equity · 5 / 50 / 95%" values={summary.terminalEquity} money /><MonteCarloRange label="Max drawdown · 5 / 50 / 95%" values={summary.maxDrawdown} money /><div className="border-t hairline pt-2 text-[9px] leading-4 text-muted-foreground">{summary.paths.toLocaleString()} seeded paths · source {result.hash.slice(0, 8)} · values remain in the backtest account currency.</div></div>}</section>;
}

function MonteCarloRange({ label, values, money }: { label: string; values: { lower: number; median: number; upper: number }; money?: boolean }) {
  const fmt = (value: number) => money ? `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : value.toLocaleString();
  return <div><div className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground">{label}</div><div className="mt-1 grid grid-cols-3 gap-1 text-[10px] font-mono-num"><span className="rounded bg-neg/10 px-1.5 py-1 text-neg">{fmt(values.lower)}</span><span className="rounded bg-foreground/5 px-1.5 py-1 text-foreground">{fmt(values.median)}</span><span className="rounded bg-pos/10 px-1.5 py-1 text-pos">{fmt(values.upper)}</span></div></div>;
}

function ResearchPanel({ hasResult }: { hasResult: boolean }) {
  const stages = DEFAULT_RESEARCH_STAGES.map((stage) => stage.label === "Backtest" ? { ...stage, detail: hasResult ? "Deterministic run attached to active context" : stage.detail, state: hasResult ? "ready" : stage.state } : stage);
  return <div className="h-full p-3 overflow-y-auto scroll-thin"><div className="flex items-start justify-between"><div><div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Research notebook</div><div className="text-[12px] mt-1">Momentum continuation above session VWAP</div></div><button className="dock-action"><Save className="w-3 h-3" />Save note</button></div><div className="research-stages mt-4 grid grid-cols-6 gap-1.5">{stages.map((stage, index) => <div key={stage.label} className="relative"><div className={cn("h-1 mb-2", stage.state === "active" ? "bg-mdata" : stage.state === "ready" ? "bg-pos/70" : "bg-foreground/15")} /><div className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground">0{index + 1} · {stage.label}</div><div className="mt-1 text-[10px] text-foreground/80 leading-snug">{stage.detail}</div></div>)}</div><div className="research-insights mt-5 grid grid-cols-[1fr_1fr] gap-3"><div className="border hairline bg-surface/40 p-2.5"><div className="text-[9px] uppercase tracking-[0.14em] text-muted-foreground">Observation</div><div className="mt-2 text-[10.5px] leading-relaxed text-foreground/80">Fast EMA is above slow EMA while price holds the session VWAP. Keep the claim tied to the selected verified window.</div></div><div className="border hairline bg-surface/40 p-2.5"><div className="text-[9px] uppercase tracking-[0.14em] text-muted-foreground">Next action</div><div className="mt-2 text-[10.5px] leading-relaxed text-foreground/80">{hasResult ? "Inspect the verified result, then compare it against an out-of-sample window." : "Run the strategy, inspect trade markers, then compare the result against an out-of-sample window."}</div></div></div></div>;
}

function DataPanel({ symbol, timeframe }: { symbol: string; timeframe: string }) {
  return <div className="data-panel-grid h-full grid grid-cols-[1fr_1fr] divide-x divide-[color-mix(in_oklch,var(--foreground)_8%,transparent)]"><div className="p-3"><div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Data contract</div><div className="mt-3 space-y-2">{[["Provider", "Gate.io"], ["Native symbol", symbol], ["Timeframe", timeframe], ["Coverage", "Verified historical window"], ["Execution", "Next-bar open"]].map(([label, value]) => <div key={label} className="flex items-center justify-between border-b hairline pb-1.5 text-[10.5px]"><span className="text-muted-foreground">{label}</span><span className="font-mono-num text-foreground">{value}</span></div>)}</div></div><div className="p-3"><div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Evidence rules</div><div className="mt-3 space-y-2 text-[10.5px] text-foreground/80 leading-relaxed"><div className="flex gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-pos shrink-0" />Source and coverage stay visible beside the chart.</div><div className="flex gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-pos shrink-0" />Stale or unavailable data is withheld.</div><div className="flex gap-2"><Radio className="w-3.5 h-3.5 text-warn shrink-0" />Public-market research only; execution is disabled.</div></div></div></div>;
}

function AlertsPanel({ search, setSearch }: { search: string; setSearch: (value: string) => void }) {
  const alerts = useMemo(() => [{ name: "EMA cross above VWAP", condition: "close > vwap and crossover(fast, slow)", state: "armed" }, { name: "Price level", condition: "QQQX_USDT > 105,000", state: "paused" }].filter((item) => `${item.name} ${item.condition}`.toLowerCase().includes(search.toLowerCase())), [search]);
  return <div className="h-full p-3"><div className="flex items-center gap-2"><div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Alert ledger</div><div className="ml-auto relative"><Search className="absolute left-2 top-1.5 w-3 h-3 text-muted-foreground" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Filter" className="h-6 w-36 bg-surface border hairline pl-6 pr-2 text-[10px] outline-none focus:border-mdata/50" /></div></div><table className="mt-3 w-full text-[10.5px]"><tbody>{alerts.map((alert) => <tr key={alert.name} className="border-b hairline"><td className="py-2 text-foreground">{alert.name}<div className="text-[9px] text-muted-foreground mt-0.5 font-mono-num">{alert.condition}</div></td><td className={cn("py-2 text-right uppercase tracking-[0.12em]", alert.state === "armed" ? "text-pos" : "text-muted-foreground")}>{alert.state}</td></tr>)}</tbody></table></div>;
}

function TradingPanel() {
  return <div className="h-full grid place-items-center"><div className="text-center"><Radio className="mx-auto w-5 h-5 text-warn/80 mb-2" /><div className="text-[11px] text-foreground">Execution disabled</div><div className="mt-1 text-[10px] text-muted-foreground">ZTerminal is a public-market research terminal with no broker route.</div><div className="mt-3 px-2 py-1 border border-warn/25 bg-warn/5 text-[9px] uppercase tracking-[0.14em] text-warn inline-block">Research only</div></div></div>;
}
