"use client";

import { useMemo, useState } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  FlaskConical,
  TrendingDown,
} from "lucide-react";
import { TerminalChart, type ChartType, type ChartIndicators, type TradeMarker } from "../terminal/terminal-chart";
import { Panel, PanelHeader, Pill, StatRow } from "../terminal/primitives";
import { useStrategy } from "@/stores/strategy";
import { useWorkspace } from "@/stores/workspace";
import type { BacktestResult } from "@/lib/strategy/zs-runtime";
import type { Timeframe } from "@/lib/market/types";
import { cn } from "@/lib/utils";
import { useInstitutionalProtocol } from "@/stores/institutional-protocol";
import { ProtocolBacktestPanel } from "./protocol-backtest-panel";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  Cell,
  ReferenceLine,
} from "recharts";

export function BacktesterView() {
  const { lastResult } = useStrategy();
  const { setView } = useWorkspace();
  const { projects, activeProjectId } = useInstitutionalProtocol();
  const activeProtocol = projects.find((project) => project.id === activeProjectId) ?? null;
  const protocolRunClass = lastResult ? activeProtocol?.runs.find((run) => run.resultHash === lastResult.hash)?.runClass ?? null : null;

  const [tab, setTab] = useState<"equity" | "drawdown" | "trades" | "monthly">("equity");

  const markers: TradeMarker[] = useMemo(() => {
    if (!lastResult) return [];
    const m: TradeMarker[] = [];
    for (const t of lastResult.trades) {
      m.push({ t: t.entryTime, side: "buy", price: t.entryPrice, qty: t.qty, label: "L" });
      m.push({ t: t.exitTime, side: "sell", price: t.exitPrice, qty: t.qty, label: t.pnl >= 0 ? "W" : "L" });
    }
    return m;
  }, [lastResult]);

  if (!lastResult) {
    return (
      <div className="h-full flex flex-col bg-background">
        <Header result={null} setView={setView} protocolRunClass={null} />
        <div className="flex-1 grid place-items-center">
          <div className="text-center max-w-sm">
            <FlaskConical className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <h2 className="text-[14px] font-semibold">No backtest result</h2>
            <p className="text-[12px] text-muted-foreground mt-1.5 leading-relaxed">
              Write a strategy in the Strategy Builder, then run a backtest.
              Results are deterministic and reproducible.
            </p>
            <button
              onClick={() => setView("strategy")}
              className="mt-4 h-8 px-3 rounded-[5px] bg-research text-research-foreground text-[12px] hover:bg-research/90 transition-colors"
            >
              Open Strategy Builder
            </button>
          </div>
        </div>
      </div>
    );
  }

  const r = lastResult;
  const m = r.metrics;
  const equityData = r.equity.map((e) => ({ t: e.t, v: Math.round(e.v) }));
  const ddData = r.drawdown.map((d) => ({ t: d.t, v: Math.round(d.v) }));
  const monthlyData = (r as any).monthly as { month: string; ret: number }[] ?? [];

  return (
    <div className="h-full flex flex-col bg-background">
      <Header result={r} setView={setView} protocolRunClass={protocolRunClass} />
      {activeProtocol && <ProtocolBacktestPanel resultHash={r.hash} onOpenStrategy={() => setView("strategy")} />}

      <div className="flex-1 min-h-0 flex">
        {/* left/main: chart + bottom tabs */}
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex-1 min-h-0 border-b hairline">
            <TerminalChart
              symbol={r.config.symbol}
              timeframe={r.config.timeframe as Timeframe}
              chartType={"candles" as ChartType}
              indicators={{ vwap: true, ema20: true, ema50: false, volume: true } as ChartIndicators}
              markers={markers}
            />
          </div>
          {/* bottom tabs */}
          <div className="h-[260px] shrink-0 flex flex-col">
            <div className="h-8 border-b hairline bg-panel flex items-center px-2 gap-1">
              {(["equity", "drawdown", "trades", "monthly"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={cn(
                    "h-6 px-2.5 rounded-[3px] text-[11px] capitalize transition-colors",
                    tab === t ? "bg-hover text-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {t}
                </button>
              ))}
              <span className="ml-auto text-[10px] text-muted-foreground tnum">{r.runId} · hash {r.hash}</span>
            </div>
            <div className="flex-1 min-h-0">
              {tab === "equity" && (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={equityData} margin={{ top: 8, right: 56, bottom: 4, left: 8 }}>
                    <defs>
                      <linearGradient id="eqg" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--pos)" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="var(--pos)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="t" tickFormatter={(v) => new Date(v).toISOString().slice(5, 10)} tick={{ fontSize: 9, fill: "var(--muted-foreground)" }} stroke="var(--border)" />
                    <YAxis orientation="right" tick={{ fontSize: 9, fill: "var(--muted-foreground)" }} stroke="var(--border)" width={50} tickFormatter={(v) => v.toLocaleString()} />
                    <Tooltip
                      contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 11 }}
                      labelFormatter={(v) => new Date(v).toISOString().slice(0, 10)}
                      formatter={(v: number) => [`$${v.toLocaleString()}`, "Equity"]}
                    />
                    <Area type="monotone" dataKey="v" stroke="var(--pos)" strokeWidth={1.2} fill="url(#eqg)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
              {tab === "drawdown" && (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={ddData} margin={{ top: 8, right: 56, bottom: 4, left: 8 }}>
                    <defs>
                      <linearGradient id="ddg" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--neg)" stopOpacity={0.05} />
                        <stop offset="100%" stopColor="var(--neg)" stopOpacity={0.3} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="t" tickFormatter={(v) => new Date(v).toISOString().slice(5, 10)} tick={{ fontSize: 9, fill: "var(--muted-foreground)" }} stroke="var(--border)" />
                    <YAxis orientation="right" tick={{ fontSize: 9, fill: "var(--muted-foreground)" }} stroke="var(--border)" width={50} tickFormatter={(v) => v.toLocaleString()} />
                    <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 11 }} labelFormatter={(v) => new Date(v).toISOString().slice(0, 10)} formatter={(v: number) => [`$${v.toLocaleString()}`, "Drawdown"]} />
                    <Area type="monotone" dataKey="v" stroke="var(--neg)" strokeWidth={1} fill="url(#ddg)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
              {tab === "trades" && (
                <div className="h-full overflow-auto scroll-thin">
                  <table className="w-full text-[11px] tnum">
                    <thead className="sticky top-0 bg-panel border-b hairline">
                      <tr className="text-[9.5px] uppercase tracking-wider text-muted-foreground">
                        <th className="text-left font-medium px-2.5 py-1.5">#</th>
                        <th className="text-left font-medium px-2 py-1.5">Side</th>
                        <th className="text-left font-medium px-2 py-1.5">Entry</th>
                        <th className="text-right font-medium px-2 py-1.5">Entry px</th>
                        <th className="text-left font-medium px-2 py-1.5">Exit</th>
                        <th className="text-right font-medium px-2 py-1.5">Exit px</th>
                        <th className="text-right font-medium px-2 py-1.5">Bars</th>
                        <th className="text-right font-medium px-2.5 py-1.5">P&L</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.trades.map((t) => (
                        <tr key={t.id} className="border-b hairline/50 hover:bg-hover/40">
                          <td className="px-2.5 py-1 text-muted-foreground">{t.id}</td>
                          <td className="px-2 py-1"><Pill tone={t.side === "long" ? "pos" : "neg"}>{t.side}</Pill></td>
                          <td className="px-2 py-1 text-muted-foreground">{new Date(t.entryTime).toISOString().slice(5, 16).replace("T", " ")}</td>
                          <td className="px-2 py-1 text-right">{t.entryPrice.toLocaleString()}</td>
                          <td className="px-2 py-1 text-muted-foreground">{new Date(t.exitTime).toISOString().slice(5, 16).replace("T", " ")}</td>
                          <td className="px-2 py-1 text-right">{t.exitPrice.toLocaleString()}</td>
                          <td className="px-2 py-1 text-right text-muted-foreground">{t.bars}</td>
                          <td className={cn("px-2.5 py-1 text-right font-medium", t.pnl >= 0 ? "text-pos" : "text-neg")}>{t.pnl >= 0 ? "+" : ""}{t.pnl.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {tab === "monthly" && (
                <div className="h-full p-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyData} margin={{ top: 8, right: 56, bottom: 4, left: 8 }}>
                      <XAxis dataKey="month" tick={{ fontSize: 9, fill: "var(--muted-foreground)" }} stroke="var(--border)" />
                      <YAxis orientation="right" tick={{ fontSize: 9, fill: "var(--muted-foreground)" }} stroke="var(--border)" width={50} tickFormatter={(v) => `${v.toFixed(0)}%`} />
                      <ReferenceLine y={0} stroke="var(--border)" />
                      <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 11 }} formatter={(v: number) => [`${v.toFixed(2)}%`, "Return"]} />
                      <Bar dataKey="ret" radius={[2, 2, 0, 0]}>
                        {monthlyData.map((d, i) => <Cell key={i} fill={d.ret >= 0 ? "var(--pos)" : "var(--neg)"} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* right: performance summary */}
        <div className="w-[280px] shrink-0 border-l hairline bg-panel overflow-y-auto scroll-thin">
          <div className="h-8 border-b hairline bg-panel flex items-center px-2.5 gap-2">
            <Activity className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Performance</span>
          </div>
          <div className="p-2.5 space-y-3">
            <Panel className="p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Net Profit</div>
              <div className={cn("text-[22px] tnum font-semibold", m.netProfit >= 0 ? "text-pos" : "text-neg")}>
                {m.netProfit >= 0 ? "+" : ""}${m.netProfit.toLocaleString()}
              </div>
              <div className={cn("text-[11px] tnum", m.netProfitPct >= 0 ? "text-pos" : "text-neg")}>
                {m.netProfitPct >= 0 ? "+" : ""}{m.netProfitPct.toFixed(2)}%
              </div>
              <div className="text-[10px] text-muted-foreground mt-1.5">Final equity <span className="tnum text-foreground">${Math.round(m.finalEquity).toLocaleString()}</span></div>
            </Panel>

            <Panel className="p-3">
              <StatRow label="Profit factor" value={isFinite(m.profitFactor) ? m.profitFactor.toFixed(2) : "∞"} tone={m.profitFactor >= 1 ? "pos" : "neg"} />
              <StatRow label="Expectancy / trade" value={`${m.expectancy >= 0 ? "+" : ""}${m.expectancy.toFixed(0)}`} tone={m.expectancy >= 0 ? "pos" : "neg"} />
              <StatRow label="Win rate" value={`${m.winRate.toFixed(1)}%`} />
              <StatRow label="Trades" value={String(m.totalTrades)} />
              <StatRow label="Winners / losers" value={`${m.winners} / ${m.losers}`} />
              <StatRow label="Avg win" value={`+${m.avgWin.toLocaleString()}`} tone="pos" />
              <StatRow label="Avg loss" value={`-${m.avgLoss.toLocaleString()}`} tone="neg" />
              <StatRow label="Max win" value={`+${m.maxWin.toLocaleString()}`} tone="pos" />
              <StatRow label="Max loss" value={`${m.maxLoss.toLocaleString()}`} tone="neg" />
            </Panel>

            <Panel className="p-3">
              <StatRow label="Max drawdown" value={`$${m.maxDrawdown.toLocaleString()}`} tone="neg" />
              <StatRow label="Max drawdown %" value={`${m.maxDrawdownPct.toFixed(2)}%`} tone="neg" />
              <StatRow label="Sharpe" value={m.sharpe.toFixed(2)} tone={m.sharpe >= 1 ? "pos" : "default"} />
              <StatRow label="Sortino" value={m.sortino.toFixed(2)} tone={m.sortino >= 1 ? "pos" : "default"} />
              <StatRow label="Calmar" value={m.calmar.toFixed(2)} />
              <StatRow label="Exposure" value={`${m.exposure.toFixed(1)}%`} />
              <StatRow label="Avg bars / trade" value={m.avgBars.toFixed(1)} />
              <StatRow label="Win streak" value={String(m.longestWinStreak)} tone="pos" />
              <StatRow label="Loss streak" value={String(m.longestLossStreak)} tone="neg" />
            </Panel>

            <Panel className="p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Configuration</div>
              <StatRow label="Symbol" value={r.config.symbol} />
              <StatRow label="Data source" value={r.dataProvenance ? `${r.dataProvenance.provider.toUpperCase()} · ${r.dataProvenance.nativeSymbol}` : r.dataStatus ?? "UNLABELLED"} tone={r.dataStatus === "HISTORICAL" ? "pos" : "warn"} />
              <StatRow label="Timeframe" value={r.config.timeframe} />
              <StatRow label="Bars" value={String(r.barsProcessed)} />
              <StatRow label="Capital" value={`$${r.config.initialCapital.toLocaleString()}`} />
              <StatRow label="Commission" value={`$${r.config.commissionPerContract}/ctr`} />
              <StatRow label="Slippage" value={`${r.config.slippageTicks} ticks`} />
              <StatRow label="Execution" value="next-bar open" />
            </Panel>

            <div className="flex items-start gap-2 p-2 border border-warn/30 bg-warn/5 rounded-[5px]">
              <TrendingDown className="w-3.5 h-3.5 text-warn shrink-0 mt-0.5" />
              <p className="text-[10px] text-foreground/80 leading-relaxed">
                Historical market data and explicit cost assumptions improve reproducibility, but a profitable backtest is not evidence of an edge. Review data coverage, out-of-sample results, walk-forward stability, and cost stress before relying on a protocol.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Header({ result, setView, protocolRunClass }: { result: BacktestResult | null; setView: (v: any) => void; protocolRunClass: "BASELINE" | "INCREMENTAL" | null }) {
  return (
    <div className="h-10 shrink-0 border-b hairline bg-panel flex items-center gap-2 px-3">
      <FlaskConical className="w-3.5 h-3.5 text-research" />
      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Backtester</span>
      {result && (
        <>
          <span className="text-[12px] font-mono-num font-semibold ml-2">{result.config.symbol}</span>
          <span className="text-[10px] text-muted-foreground uppercase">{result.config.timeframe}</span>
          <span className="text-[10px] text-muted-foreground tnum">{new Date(result.config.from).toISOString().slice(0, 10)} → {new Date(result.config.to).toISOString().slice(0, 10)}</span>
          <span className="text-[10px] text-muted-foreground tnum">{result.barsProcessed} bars</span>
        </>
      )}
      <div className="ml-auto flex items-center gap-1.5">
        {protocolRunClass && <Pill tone={protocolRunClass === "BASELINE" ? "research" : "warn"}>{protocolRunClass === "BASELINE" ? "BASELINE · NO OPTIMIZATION" : "TUNED · ONE VARIABLE"}</Pill>}
        {result && <Pill tone={result.dataStatus === "HISTORICAL" ? "pos" : "warn"}>{result.dataStatus ?? "UNLABELLED"}</Pill>}
        <button onClick={() => setView("strategy")} className="h-7 px-2.5 rounded-[5px] border hairline bg-surface hover:bg-hover text-[11px]">Edit strategy</button>
      </div>
    </div>
  );
}

export { ArrowUpRight, ArrowDownRight };
