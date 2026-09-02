"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart3, Database, FlaskConical, Play, RefreshCw, ShieldCheck, Workflow } from "lucide-react";
import { useWorkspace } from "@/stores/workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { bootstrapMean, createWalkForwardWindows, simulateTradeSequence } from "@/domain/validation/resampling";
import type { Bar, ProviderId } from "@/lib/market/types";

type RunState = "idle" | "loading" | "ready" | "error";
type Result = {
  trades: number; netReturn: number; winRate: number; profitFactor: number; maxDrawdown: number;
  bootstrap: ReturnType<typeof bootstrapMean>; monteCarlo: ReturnType<typeof simulateTradeSequence>; walkForward: number;
  fast: number; slow: number; sensitivity: { fast: number; slow: number; netReturn: number; trades: number }[];
};

function ema(values: number[], period: number) {
  const output: number[] = []; const alpha = 2 / (period + 1); let previous = values[0] ?? 0;
  for (const value of values) { previous = value * alpha + previous * (1 - alpha); output.push(previous); }
  return output;
}

function runEmaCross(bars: Bar[], fastPeriod = 20, slowPeriod = 50) {
  if (bars.length < 60) return [];
  const closes = bars.map((bar) => bar.c); const fast = ema(closes, fastPeriod); const slow = ema(closes, slowPeriod);
  const returns: number[] = []; let position: -1 | 0 | 1 = 0; let entry = 0;
  for (let index = 50; index < bars.length; index += 1) {
    const nextPosition: -1 | 0 | 1 = fast[index] > slow[index] ? 1 : -1;
    if (nextPosition !== position) {
      if (position !== 0 && entry > 0) returns.push(((bars[index].c - entry) / entry) * position);
      position = nextPosition; entry = bars[index].c;
    }
  }
  if (position !== 0 && entry > 0) returns.push((((bars.at(-1)?.c ?? entry) - entry) / entry) * position);
  return returns.filter(Number.isFinite);
}

function summarize(returns: number[], totalBars: number, fast: number, slow: number, sensitivity: Result["sensitivity"]): Result {
  const wins = returns.filter((value) => value > 0); const losses = returns.filter((value) => value < 0);
  const grossWin = wins.reduce((sum, value) => sum + value, 0); const grossLoss = Math.abs(losses.reduce((sum, value) => sum + value, 0));
  let equity = 1; let peak = equity; let maxDrawdown = 0;
  for (const value of returns) { equity *= 1 + value; peak = Math.max(peak, equity); maxDrawdown = Math.max(maxDrawdown, (peak - equity) / peak); }
  return { trades: returns.length, netReturn: equity - 1, winRate: returns.length ? wins.length / returns.length : 0, profitFactor: grossLoss ? grossWin / grossLoss : wins.length ? Infinity : 0, maxDrawdown, bootstrap: bootstrapMean(returns, { samples: 500, confidenceLevel: 0.95, seed: 42 }), monteCarlo: simulateTradeSequence(returns, { paths: 500, initialEquity: 1, seed: 42 }), walkForward: createWalkForwardWindows(totalBars, { inSample: 300, outOfSample: 100, step: 100, purge: 1 }).length, fast, slow, sensitivity };
}

export function BacktesterView() {
  const { symbol, timeframe, connection } = useWorkspace();
  const [bars, setBars] = useState<Bar[]>([]); const [state, setState] = useState<RunState>("idle"); const [error, setError] = useState<string | null>(null); const [result, setResult] = useState<Result | null>(null); const [fast, setFast] = useState("20"); const [slow, setSlow] = useState("50");
  const provider: ProviderId = connection.provider === "binance" ? "binance" : "gateio";

  async function loadAndRun() {
    setState("loading"); setError(null);
    try {
      const response = await fetch(`/api/bars?provider=${provider}&symbol=${encodeURIComponent(symbol)}&tf=${timeframe}&bars=1000`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || !Array.isArray(payload.bars)) throw new Error(payload.error ?? "Historical data unavailable");
      const fastPeriod = Math.max(1, Math.min(200, Number(fast) || 20)); const slowPeriod = Math.max(2, Math.min(400, Number(slow) || 50));
      if (fastPeriod >= slowPeriod) throw new Error("Fast EMA must be smaller than slow EMA.");
      const nextBars = payload.bars as Bar[]; const returns = runEmaCross(nextBars, fastPeriod, slowPeriod);
      if (returns.length < 10) throw new Error("The verified window does not contain enough EMA-cross trades for validation.");
      const sensitivity = [12, 20, 30].flatMap((fastValue) => [35, 50, 75].filter((slowValue) => fastValue < slowValue).map((slowValue) => {
        const sample = runEmaCross(nextBars, fastValue, slowValue); let equity = 1;
        for (const value of sample) equity *= 1 + value;
        return { fast: fastValue, slow: slowValue, netReturn: equity - 1, trades: sample.length };
      }));
      setBars(nextBars); setResult(summarize(returns, nextBars.length, fastPeriod, slowPeriod, sensitivity)); setState("ready");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Research data unavailable"); setState("error"); setResult(null); }
  }

  useEffect(() => { // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadAndRun();
  }, [provider, symbol, timeframe]);
  const providerLabel = provider === "binance" ? "Binance Futures" : "Gate.io";
  const status = state === "loading" ? "Loading verified bars…" : state === "error" ? "Run unavailable" : state === "ready" ? "Run complete" : "Ready to run";
  const range = useMemo(() => bars.length ? `${new Date(bars[0].t).toLocaleDateString()} → ${new Date(bars.at(-1)!.t).toLocaleDateString()}` : "No verified window loaded", [bars]);

  return <div className="flex h-full flex-col bg-background"><header className="flex min-h-11 shrink-0 items-center gap-2 border-b hairline bg-panel px-3"><FlaskConical className="h-4 w-4 text-research" /><div><div className="text-[12px] font-semibold">Local research backtester</div><div className="text-[9px] uppercase tracking-[0.13em] text-muted-foreground">EMA cross · sensitivity · bootstrap · Monte Carlo · walk-forward</div></div><span className="ml-auto inline-flex items-center gap-1.5 rounded border hairline px-2 py-1 text-[10px] text-muted-foreground"><ShieldCheck className="h-3 w-3 text-research" />Read only</span></header><main className="min-h-0 flex-1 overflow-auto p-3 sm:p-4"><section className="mx-auto w-full max-w-5xl space-y-3"><div className="grid gap-3 sm:grid-cols-3"><RunRequirement icon={<Workflow className="h-4 w-4 text-mdata" />} title="Strategy" value={`EMA ${fast} / ${slow} cross`} detail="Parameters are explicit and evaluated only against the selected verified historical window." /><RunRequirement icon={<Database className="h-4 w-4 text-mdata" />} title="Dataset" value={`${providerLabel} · ${symbol} · ${timeframe}`} detail={`${bars.length ? `${bars.length} bars · ${range}` : "Verified historical bars required before a run."} No synthetic data is used.`} /><RunRequirement icon={<BarChart3 className="h-4 w-4 text-mdata" />} title="Execution" value="Next-bar research model" detail="Results are hypothetical research outputs; no orders, broker account state, or live fills are accessed." /></div><div className="flex flex-wrap items-end gap-2 border hairline bg-panel p-3"><label className="text-[10px] text-muted-foreground">Fast EMA<Input value={fast} onChange={(event) => setFast(event.target.value)} type="number" min="1" max="200" className="mt-1 h-8 w-24 bg-surface text-[11px]" /></label><label className="text-[10px] text-muted-foreground">Slow EMA<Input value={slow} onChange={(event) => setSlow(event.target.value)} type="number" min="2" max="400" className="mt-1 h-8 w-24 bg-surface text-[11px]" /></label><Button onClick={() => void loadAndRun()} disabled={state === "loading"} className="h-8 gap-1.5 bg-research text-[11px] text-research-foreground hover:bg-research/90"><Play className="h-3.5 w-3.5" />{state === "loading" ? "Running…" : "Run verified test"}</Button><Button variant="outline" onClick={() => void loadAndRun()} disabled={state === "loading"} className="h-8 gap-1.5 text-[11px]"><RefreshCw className="h-3.5 w-3.5" />Refresh data</Button><span className="text-[10px] text-muted-foreground">{status}</span>{error && <span className="text-[10px] text-warn">{error}</span>}</div>{result && <><div className="grid gap-2 sm:grid-cols-5">{[["Trades", result.trades.toString()], ["Net return", formatPercent(result.netReturn)], ["Win rate", formatPercent(result.winRate)], ["Profit factor", Number.isFinite(result.profitFactor) ? result.profitFactor.toFixed(2) : "∞"], ["Max drawdown", formatPercent(result.maxDrawdown)]].map(([label, value]) => <div key={label} className="border hairline bg-panel p-3"><div className="text-[9px] uppercase tracking-[0.13em] text-muted-foreground">{label}</div><div className="mt-2 font-mono-num text-[15px]">{value}</div></div>)}</div><div className="grid gap-3 lg:grid-cols-3"><ResultCard title={`Selected EMA ${result.fast} / ${result.slow}`} rows={[["Observed mean", formatPercent(result.bootstrap.mean)], ["95% lower", formatPercent(result.bootstrap.lower)], ["95% upper", formatPercent(result.bootstrap.upper)], ["Samples", result.bootstrap.samples.toString()]]} /><ResultCard title="Monte Carlo · shuffled trades" rows={[["Terminal P05", formatPercent(result.monteCarlo.terminalEquity.lower - 1)], ["Terminal median", formatPercent(result.monteCarlo.terminalEquity.median - 1)], ["Terminal P95", formatPercent(result.monteCarlo.terminalEquity.upper - 1)], ["Paths", result.monteCarlo.paths.toString()]]} /><ResultCard title="Walk-forward coverage" rows={[["Windows", result.walkForward.toString()], ["Policy", "300 IS / 100 OOS"], ["Purge", "1 bar"], ["Data", `${providerLabel} native bars`]]} /></div><div className="border hairline bg-panel p-3"><div className="flex items-center justify-between"><h2 className="text-[10px] uppercase tracking-[0.13em] text-muted-foreground">Parameter sensitivity · fixed verified window</h2><span className="text-[9px] text-muted-foreground">No optimization claim</span></div><div className="mt-2 grid grid-cols-3 gap-2">{result.sensitivity.map((cell) => <div key={`${cell.fast}-${cell.slow}`} className="border hairline bg-surface/40 p-2"><div className="text-[9px] text-muted-foreground">EMA {cell.fast} / {cell.slow}</div><div className={`mt-1 font-mono-num text-[11px] ${cell.netReturn >= 0 ? "text-pos" : "text-neg"}`}>{formatPercent(cell.netReturn)}</div><div className="text-[9px] text-muted-foreground">{cell.trades} trades</div></div>)}</div><p className="mt-2 text-[9.5px] leading-relaxed text-muted-foreground">Sensitivity cells are descriptive neighboring runs, not a parameter search or performance guarantee. Select one hypothesis, then validate it out of sample.</p></div><p className="border-t hairline pt-3 text-[10px] leading-5 text-muted-foreground">These statistics resample observed trade outcomes and do not forecast returns. They are not a performance guarantee. Treat the result as a reproducible research artifact, not an execution signal.</p></>}{!result && state !== "loading" && <div className="grid min-h-56 place-items-center border hairline bg-panel p-6 text-center"><div><FlaskConical className="mx-auto h-6 w-6 text-research" /><h2 className="mt-3 text-sm font-semibold">Run a verified research test</h2><p className="mt-2 max-w-lg text-[11px] leading-5 text-muted-foreground">The web backtester uses the active public provider and keeps provider, symbol, timeframe, and data state visible. If the provider is unavailable, results stay withheld.</p></div></div>}</section></main></div>;
}

function formatPercent(value: number) { return `${(value * 100).toFixed(2)}%`; }
function RunRequirement({ icon, title, value, detail }: { icon: React.ReactNode; title: string; value: string; detail: string }) { return <article className="border hairline bg-panel p-3"><div className="flex items-center gap-2">{icon}<span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{title}</span></div><div className="mt-3 font-mono-num text-[12px] text-foreground">{value}</div><p className="mt-2 text-[10px] leading-4 text-muted-foreground">{detail}</p></article>; }
function ResultCard({ title, rows }: { title: string; rows: [string, string][] }) { return <article className="border hairline bg-panel p-3"><h2 className="text-[10px] uppercase tracking-[0.13em] text-muted-foreground">{title}</h2><div className="mt-2 space-y-2">{rows.map(([label, value]) => <div key={label} className="flex items-center justify-between border-b hairline pb-1.5 text-[10.5px]"><span className="text-muted-foreground">{label}</span><span className="font-mono-num">{value}</span></div>)}</div></article>; }
