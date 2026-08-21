"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Bell,
  CheckCircle2,
  Code2,
  Database,
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

export type DockTab = "script" | "tester" | "research" | "data" | "alerts" | "trading";

const TABS: { id: DockTab; label: string; icon: typeof Code2 }[] = [
  { id: "script", label: "Script Editor", icon: Code2 },
  { id: "tester", label: "Strategy Tester", icon: FlaskConical },
  { id: "research", label: "Research", icon: StickyNote },
  { id: "data", label: "Data", icon: Database },
  { id: "alerts", label: "Alerts", icon: Bell },
  { id: "trading", label: "Trading Panel", icon: Radio },
];

const DEFAULT_RESEARCH_STAGES = [
  { label: "Hypothesis", detail: "Momentum continuation above session VWAP", state: "active" },
  { label: "Data", detail: "Gate.io · verified candles · 5m", state: "ready" },
  { label: "Chart evidence", detail: "EMA 20 / EMA 50 crossover", state: "ready" },
  { label: "Model", detail: "EMA Cross + VWAP Filter", state: "ready" },
  { label: "Backtest", detail: "Run strategy to attach evidence", state: "pending" },
  { label: "Validation", detail: "Out-of-sample review required", state: "pending" },
];

export function BottomDock() {
  const [tab, setTab] = useState<DockTab>("script");
  const [open, setOpen] = useState(true);
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
  const { source, setSource, lastCompile, setLastCompile, params, setParams, config, lastResult, setLastResult } = useStrategy();
  const { symbol, timeframe, setSymbol } = useWorkspace();

  useEffect(() => {
    const openTab = (event: Event) => {
      const requested = (event as CustomEvent<DockTab>).detail;
      if (!TABS.some((item) => item.id === requested)) return;
      setTab(requested);
      setOpen(true);
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
      const response = await fetch("/api/strategy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ src: source }),
      });
      const result = await response.json();
      setLastCompile(result);
      const nextParams: Record<string, number | string | boolean> = {};
      for (const input of result.inputs ?? []) nextParams[input.name] = params[input.name] ?? input.default;
      setParams(nextParams);
      appendLog(result.ok ? `compile ok · ${result.name ?? "strategy"}` : `compile failed · ${result.diagnostics?.length ?? 0} diagnostic(s)`);
    } catch (error) {
      appendLog(`compile error · ${error instanceof Error ? error.message : "request failed"}`);
    } finally {
      setBusy(null);
    }
  };

  const runBacktest = async () => {
    setBusy("run");
    const to = Date.now();
    try {
      const response = await fetch("/api/backtest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          src: source,
          symbol: config.symbol || symbol,
          timeframe: config.timeframe || timeframe,
          from: to - config.days * 86_400_000,
          to,
          initialCapital: config.initialCapital,
          commissionPerContract: config.commissionPerContract,
          slippageTicks: config.slippageTicks,
          spreadTicks: config.spreadTicks,
          positionSize: config.positionSize,
          params,
        }),
      });
      const result = await response.json();
      if (!response.ok || result.error) throw new Error(result.error ?? "backtest unavailable");
      setLastResult(result);
      setSymbol(config.symbol || symbol);
      setTab("tester");
      appendLog(`backtest complete · ${result.metrics?.totalTrades ?? 0} trades · hash ${result.hash ?? "—"}`);
    } catch (error) {
      appendLog(`backtest error · ${error instanceof Error ? error.message : "request failed"}`);
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
    <section className={cn("shrink-0 border-t hairline bg-panel", !open && "h-8")} style={open ? { height } : undefined} aria-label="Research workspace dock">
      {open && <button aria-label="Resize lower workspace" onPointerDown={startResize} className="group absolute -translate-y-1/2 left-0 right-0 h-2 cursor-row-resize z-10">
        <span className="mx-auto block h-0.5 w-12 rounded-full bg-foreground/15 group-hover:bg-mdata/70" />
      </button>}
      <div className="h-8 shrink-0 border-b hairline flex items-center px-2 gap-0.5 bg-panel">
        <div className="flex items-center gap-1 pr-2 mr-1 border-r hairline">
          <TerminalSquare className="w-3.5 h-3.5 text-mdata" />
          <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Workspace</span>
        </div>
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => { setTab(id); setOpen(true); }} className={cn("h-6 px-2 rounded-[3px] flex items-center gap-1.5 text-[10.5px] whitespace-nowrap", tab === id && open ? "bg-hover text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-hover/60")}>
            <Icon className="w-3 h-3" />{label}
            {id === "tester" && lastResult && <span className="h-1.5 w-1.5 rounded-full bg-pos" />}
          </button>
        ))}
        <button onClick={() => setOpen((value) => !value)} className="ml-auto h-6 px-2 rounded-[3px] text-[10px] text-muted-foreground hover:text-foreground hover:bg-hover" aria-expanded={open}>{open ? "Collapse" : "Expand"}</button>
      </div>
      {open && <div className="h-[calc(100%-32px)] min-h-0 overflow-hidden">{tab === "script" && <ScriptPanel source={source} setSource={setSource} lastCompile={lastCompile} busy={busy} validate={validate} runBacktest={runBacktest} log={log} />}{tab === "tester" && <TesterPanel result={lastResult} log={log} />}{tab === "research" && <ResearchPanel hasResult={Boolean(lastResult)} />}{tab === "data" && <DataPanel symbol={symbol} timeframe={timeframe} />}{tab === "alerts" && <AlertsPanel search={search} setSearch={setSearch} />}{tab === "trading" && <TradingPanel />}</div>}
    </section>
  );
}

function ScriptPanel({ source, setSource, lastCompile, busy, validate, runBacktest, log }: { source: string; setSource: (value: string) => void; lastCompile: ReturnType<typeof useStrategy.getState>["lastCompile"]; busy: "validate" | "run" | null; validate: () => void; runBacktest: () => void; log: string[] }) {
  const errors = lastCompile?.diagnostics?.filter((item) => item.severity === "error") ?? [];
  return <div className="h-full flex flex-col">
    <div className="h-8 shrink-0 border-b hairline flex items-center gap-2 px-2.5">
      <span className="text-[10px] text-muted-foreground font-mono-num">strategy.zs</span>
      <span className="text-[10px] text-muted-foreground/60">·</span>
      <span className="text-[10px] text-muted-foreground">ZS runtime</span>
      <div className="ml-auto flex items-center gap-1">
        <button onClick={() => window.dispatchEvent(new Event("zterminal:saved"))} className="dock-action"><Save className="w-3 h-3" />Save</button>
        <button onClick={validate} disabled={busy !== null} className="dock-action"><CheckCircle2 className="w-3 h-3" />{busy === "validate" ? "Validating" : "Validate"}</button>
        <button onClick={runBacktest} disabled={busy !== null} className="dock-action primary"><Play className="w-3 h-3" />{busy === "run" ? "Running" : "Run"}</button>
      </div>
    </div>
    <div className="min-h-0 flex-1 grid grid-cols-[minmax(0,1fr)_240px]">
      <div className="min-w-0 min-h-0 border-r hairline"><CodeEditor value={source} onChange={setSource} /></div>
      <div className="min-h-0 flex flex-col bg-surface/30">
        <div className="px-2.5 py-2 border-b hairline"><div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Execution</div><div className="mt-1 text-[11px] font-mono-num text-foreground">next bar open</div><div className="mt-1 text-[10px] text-muted-foreground">Deterministic runtime · no broker route</div></div>
        <div className="min-h-0 flex-1 overflow-y-auto scroll-thin p-2.5">
          <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-2">Diagnostics</div>
          {!lastCompile && <div className="text-[10px] text-muted-foreground">Validate to inspect the script.</div>}
          {lastCompile?.ok && <div className="flex items-center gap-1.5 text-[10px] text-pos"><CheckCircle2 className="w-3 h-3" />No errors · {lastCompile.inputs.length} inputs</div>}
          {errors.map((error, index) => <div key={index} className="mt-1 flex gap-1.5 text-[10px] text-neg"><AlertCircle className="w-3 h-3 shrink-0" />L{error.line}:{error.col} {error.message}</div>)}
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
    <div className="h-8 shrink-0 border-b hairline flex items-center px-2.5 gap-2"><span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Backtest evidence</span>{result && <><span className="text-[10px] text-muted-foreground/50">·</span><span className="text-[10px] font-mono-num text-mdata">{result.config.symbol} · {result.config.timeframe}</span><span className="text-[10px] text-pos ml-auto">verified runtime</span></>}</div>
    {!result ? <div className="flex-1 grid place-items-center text-center"><div><FlaskConical className="mx-auto w-5 h-5 text-muted-foreground/60 mb-2" /><div className="text-[11px] text-muted-foreground">Run the active script to attach trades to the chart.</div><div className="text-[10px] text-muted-foreground/60 mt-1">No performance values are shown until a deterministic run exists.</div></div></div> : <div className="min-h-0 flex-1 grid grid-cols-[minmax(0,1fr)_250px]">
      <div className="min-w-0 min-h-0 overflow-y-auto scroll-thin"><table className="w-full text-[10.5px] tnum"><thead><tr className="border-b hairline text-[9px] uppercase tracking-[0.14em] text-muted-foreground"><th className="px-3 py-2 text-left font-medium">Trade</th><th className="px-3 py-2 text-left font-medium">Side</th><th className="px-3 py-2 text-right font-medium">Entry</th><th className="px-3 py-2 text-right font-medium">Exit</th><th className="px-3 py-2 text-right font-medium">P&amp;L</th></tr></thead><tbody>{result.trades.slice(-12).reverse().map((trade) => <tr key={trade.id} className="border-b hairline/60"><td className="px-3 py-1.5 text-muted-foreground">#{trade.id}</td><td className={cn("px-3 py-1.5 uppercase", trade.side === "long" ? "text-pos" : "text-neg")}>{trade.side}</td><td className="px-3 py-1.5 text-right text-muted-foreground">{trade.entryPrice.toLocaleString()}</td><td className="px-3 py-1.5 text-right text-muted-foreground">{trade.exitPrice.toLocaleString()}</td><td className={cn("px-3 py-1.5 text-right", trade.pnl >= 0 ? "text-pos" : "text-neg")}>{trade.pnl >= 0 ? "+" : "−"}{Math.abs(trade.pnl).toFixed(2)}</td></tr>)}</tbody></table></div>
      <div className="border-l hairline bg-surface/30 p-2.5 grid grid-cols-2 content-start gap-x-4 gap-y-2">{rows.map(([label, value, tone]) => <div key={label}><div className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground">{label}</div><div className={cn("mt-0.5 text-[12px] font-mono-num", tone)}>{value}</div></div>)}<div className="col-span-2 pt-2 border-t hairline text-[9px] text-muted-foreground font-mono-num truncate">{result.barsProcessed} bars · {result.hash}</div></div>
    </div>}
    <div className="h-6 shrink-0 border-t hairline px-2.5 flex items-center gap-2 text-[9px] text-muted-foreground"><span className="uppercase tracking-[0.14em]">Run log</span><span className="truncate font-mono-num">{log[0]}</span></div>
  </div>;
}

function ResearchPanel({ hasResult }: { hasResult: boolean }) {
  const stages = DEFAULT_RESEARCH_STAGES.map((stage) => stage.label === "Backtest" ? { ...stage, detail: hasResult ? "Deterministic run attached to active context" : stage.detail, state: hasResult ? "ready" : stage.state } : stage);
  return <div className="h-full p-3 overflow-y-auto scroll-thin"><div className="flex items-start justify-between"><div><div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Research notebook</div><div className="text-[12px] mt-1">Momentum continuation above session VWAP</div></div><button className="dock-action"><Save className="w-3 h-3" />Save note</button></div><div className="mt-4 grid grid-cols-6 gap-1.5">{stages.map((stage, index) => <div key={stage.label} className="relative"><div className={cn("h-1 mb-2", stage.state === "active" ? "bg-mdata" : stage.state === "ready" ? "bg-pos/70" : "bg-foreground/15")} /><div className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground">0{index + 1} · {stage.label}</div><div className="mt-1 text-[10px] text-foreground/80 leading-snug">{stage.detail}</div></div>)}</div><div className="mt-5 grid grid-cols-[1fr_1fr] gap-3"><div className="border hairline bg-surface/40 p-2.5"><div className="text-[9px] uppercase tracking-[0.14em] text-muted-foreground">Observation</div><div className="mt-2 text-[10.5px] leading-relaxed text-foreground/80">Fast EMA is above slow EMA while price holds the session VWAP. Keep the claim tied to the selected verified window.</div></div><div className="border hairline bg-surface/40 p-2.5"><div className="text-[9px] uppercase tracking-[0.14em] text-muted-foreground">Next action</div><div className="mt-2 text-[10.5px] leading-relaxed text-foreground/80">{hasResult ? "Inspect the verified result, then compare it against an out-of-sample window." : "Run the strategy, inspect trade markers, then compare the result against an out-of-sample window."}</div></div></div></div>;
}

function DataPanel({ symbol, timeframe }: { symbol: string; timeframe: string }) {
  return <div className="h-full grid grid-cols-[1fr_1fr] divide-x divide-[color-mix(in_oklch,var(--foreground)_8%,transparent)]"><div className="p-3"><div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Data contract</div><div className="mt-3 space-y-2">{[["Provider", "Gate.io"], ["Native symbol", symbol], ["Timeframe", timeframe], ["Coverage", "Verified historical window"], ["Execution", "Next-bar open"]].map(([label, value]) => <div key={label} className="flex items-center justify-between border-b hairline pb-1.5 text-[10.5px]"><span className="text-muted-foreground">{label}</span><span className="font-mono-num text-foreground">{value}</span></div>)}</div></div><div className="p-3"><div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Evidence rules</div><div className="mt-3 space-y-2 text-[10.5px] text-foreground/80 leading-relaxed"><div className="flex gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-pos shrink-0" />Source and coverage stay visible beside the chart.</div><div className="flex gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-pos shrink-0" />Stale or unavailable data is withheld.</div><div className="flex gap-2"><Radio className="w-3.5 h-3.5 text-warn shrink-0" />Public-market research only; execution is disabled.</div></div></div></div>;
}

function AlertsPanel({ search, setSearch }: { search: string; setSearch: (value: string) => void }) {
  const alerts = useMemo(() => [{ name: "EMA cross above VWAP", condition: "close > vwap and crossover(fast, slow)", state: "armed" }, { name: "Price level", condition: "QQQX_USDT > 105,000", state: "paused" }].filter((item) => `${item.name} ${item.condition}`.toLowerCase().includes(search.toLowerCase())), [search]);
  return <div className="h-full p-3"><div className="flex items-center gap-2"><div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Alert ledger</div><div className="ml-auto relative"><Search className="absolute left-2 top-1.5 w-3 h-3 text-muted-foreground" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Filter" className="h-6 w-36 bg-surface border hairline pl-6 pr-2 text-[10px] outline-none focus:border-mdata/50" /></div></div><table className="mt-3 w-full text-[10.5px]"><tbody>{alerts.map((alert) => <tr key={alert.name} className="border-b hairline"><td className="py-2 text-foreground">{alert.name}<div className="text-[9px] text-muted-foreground mt-0.5 font-mono-num">{alert.condition}</div></td><td className={cn("py-2 text-right uppercase tracking-[0.12em]", alert.state === "armed" ? "text-pos" : "text-muted-foreground")}>{alert.state}</td></tr>)}</tbody></table></div>;
}

function TradingPanel() {
  return <div className="h-full grid place-items-center"><div className="text-center"><Radio className="mx-auto w-5 h-5 text-warn/80 mb-2" /><div className="text-[11px] text-foreground">Execution disabled</div><div className="mt-1 text-[10px] text-muted-foreground">ZTerminal is a public-market research terminal with no broker route.</div><div className="mt-3 px-2 py-1 border border-warn/25 bg-warn/5 text-[9px] uppercase tracking-[0.14em] text-warn inline-block">Research only</div></div></div>;
}
