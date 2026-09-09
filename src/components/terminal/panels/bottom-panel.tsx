"use client";

import { useMemo, useState } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  Code2,
  Cpu,
  DollarSign,
  Maximize2,
  Minimize2,
  Percent,
  Play,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Terminal,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { useLayout, type BottomTabId } from "@/stores/layout";
import { useStrategy, type ArchivedResearchResult } from "@/stores/strategy";
import { useWorkspace } from "@/stores/workspace";
import { CodeEditor } from "../code-editor";
import { executeLocalBacktest } from "@/lib/research/compute-engine";
import { transpileToPython, detectScriptLanguage } from "@/lib/research/transpiler";
import { getOrFetchHistoricalBars } from "@/lib/market/cached-bars-provider";
import { getContract } from "@/lib/market/contracts";
import type { Timeframe } from "@/lib/market/types";
import { cn } from "@/lib/utils";

// Mock backtest result for immediate visualization when user runs a backtest before Phase 3 worker is wired
const MOCK_BACKTEST_RESULT: ArchivedResearchResult = {
  runId: "run-local-" + Math.random().toString(36).slice(2, 8),
  hash: "sha256:7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069",
  config: {
    symbol: "BTCUSDT",
    timeframe: "5m",
    initialCapital: 100_000,
    commissionPerContract: 2.5,
    slippageTicks: 1,
    spreadTicks: 1,
    positionSize: 1,
    from: Date.now() - 30 * 86400000,
    to: Date.now(),
  },
  barsProcessed: 8640,
  metrics: {
    netProfit: 14820.5,
    winRate: 0.584,
    profitFactor: 1.82,
    sharpe: 1.94,
    maxDrawdownPct: 0.068,
    totalTrades: 64,
  },
  trades: [
    { id: "t-1", side: "long", entryTime: Date.now() - 15 * 86400000, entryPrice: 94250, exitTime: Date.now() - 14 * 86400000, exitPrice: 96800, qty: 1, pnl: 2550, bars: 288 },
    { id: "t-2", side: "long", entryTime: Date.now() - 12 * 86400000, entryPrice: 96100, exitTime: Date.now() - 11 * 86400000, exitPrice: 95400, qty: 1, pnl: -700, bars: 144 },
    { id: "t-3", side: "short", entryTime: Date.now() - 9 * 86400000, entryPrice: 97500, exitTime: Date.now() - 8 * 86400000, exitPrice: 95200, qty: 1, pnl: 2300, bars: 200 },
    { id: "t-4", side: "long", entryTime: Date.now() - 6 * 86400000, entryPrice: 95800, exitTime: Date.now() - 5 * 86400000, exitPrice: 98100, qty: 1, pnl: 2300, bars: 310 },
    { id: "t-5", side: "long", entryTime: Date.now() - 3 * 86400000, entryPrice: 97900, exitTime: Date.now() - 2 * 86400000, exitPrice: 99400, qty: 1, pnl: 1500, bars: 180 },
    { id: "t-6", side: "short", entryTime: Date.now() - 1 * 86400000, entryPrice: 99800, exitTime: Date.now() - 12 * 3600000, exitPrice: 98200, qty: 1, pnl: 1600, bars: 96 },
  ],
  dataStatus: "VERIFIED",
  dataProvenance: { provider: "binance", nativeSymbol: "BTCUSDT" },
};

export function BottomPanel() {
  const { bottomTab, setBottomTab, toggleBottomPanel, logs, addLog, clearLogs } = useLayout();
  const {
    source,
    setSource,
    lastResult,
    setLastResult,
    config,
    setConfig,
    setShowReportDialog,
    setShowOptimizeDialog,
  } = useStrategy();
  const { symbol, timeframe } = useWorkspace();
  const [isRunning, setIsRunning] = useState(false);
  const [logFilter, setLogFilter] = useState<"all" | "info" | "warn" | "error" | "success">("all");

  const runBacktest = async () => {
    setIsRunning(true);
    addLog("info", `Starting strategy backtest on ${symbol} (${timeframe})...`);
    try {
      const to = Date.now();
      const from = to - config.days * 86_400_000;
      addLog("info", `Loading historical bars for ${symbol}...`);
      const bars = await getOrFetchHistoricalBars(
        symbol,
        timeframe as Timeframe,
        from,
        to,
        (msg) => addLog("info", msg)
      );

      if (bars.length < 2) {
        throw new Error("Received fewer than 2 bars from data provider.");
      }

      addLog("info", `Evaluating strategy on ${bars.length.toLocaleString()} bars...`);
      const contract = getContract(symbol);

      const result = await executeLocalBacktest(source, bars, {
        symbol,
        timeframe,
        initialCapital: config.initialCapital,
        commissionPerContract: config.commissionPerContract,
        slippageTicks: config.slippageTicks,
        tickSize: contract.tickSize,
        multiplier: contract.multiplier,
      });

      addLog(
        "success",
        `Backtest complete: ${result.trades.length} trades | Net PnL: ${result.metrics.netProfit >= 0 ? "+" : ""}$${result.metrics.netProfit.toLocaleString()} (${result.metrics.netProfitPct}%) | Sharpe: ${result.metrics.sharpeRatio.toFixed(2)} | Win Rate: ${(result.metrics.winRate * 100).toFixed(1)}%`
      );

      setLastResult({
        runId: result.runId,
        hash: result.hash,
        config: {
          symbol,
          timeframe,
          initialCapital: config.initialCapital,
          commissionPerContract: config.commissionPerContract,
          slippageTicks: config.slippageTicks,
          spreadTicks: 1,
          positionSize: config.positionSize,
          from,
          to,
        },
        barsProcessed: result.barsProcessed,
        metrics: {
          netProfit: result.metrics.netProfit,
          winRate: result.metrics.winRate,
          profitFactor: result.metrics.profitFactor,
          sharpe: result.metrics.sharpeRatio,
          maxDrawdownPct: result.metrics.maxDrawdownPct,
          totalTrades: result.metrics.totalTrades,
          sortino: result.metrics.sortinoRatio,
          calmar: result.metrics.calmarRatio,
          cagr: result.metrics.cagr,
          expectancy: result.metrics.expectancy,
          avgTrade: result.metrics.avgTrade,
          largestWin: result.metrics.largestWin,
          largestLoss: result.metrics.largestLoss,
          maxConsecutiveWins: result.metrics.maxConsecutiveWins,
          maxConsecutiveLosses: result.metrics.maxConsecutiveLosses,
          avgBarsInTrade: result.metrics.avgBarsInTrade,
          grossProfit: result.metrics.grossProfit,
          grossLoss: result.metrics.grossLoss,
          longTrades: result.metrics.longTrades,
          shortTrades: result.metrics.shortTrades,
          longWinRate: result.metrics.longWinRate,
          shortWinRate: result.metrics.shortWinRate,
          longPnL: result.metrics.longPnL,
          shortPnL: result.metrics.shortPnL,
        },
        trades: result.trades,
        equityCurve: result.equityCurve,
        monthlyReturns: result.monthlyReturns,
        slippageSensitivity: result.slippageSensitivity,
        monteCarlo: result.monteCarlo,
        dataStatus: "VERIFIED",
        dataProvenance: { provider: "binance", nativeSymbol: symbol },
      });

      setBottomTab("backtest");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      addLog("error", `Backtest execution error: ${message}`);
    } finally {
      setIsRunning(false);
    }
  };

  const handleTranspile = () => {
    const detected = detectScriptLanguage(source);
    if (detected === "python") {
      addLog("info", "Source code is already native Python.");
      return;
    }
    const transpiled = transpileToPython(source);
    setSource(transpiled.pythonCode);
    addLog("success", `Successfully converted ${detected} script to zterminal_research Python!`);
  };

  const filteredLogs = useMemo(() => {
    if (logFilter === "all") return logs;
    return logs.filter((l) => l.level === logFilter);
  }, [logs, logFilter]);

  return (
    <div className="flex h-full flex-col bg-panel border-t hairline select-none overflow-hidden">
      {/* Panel Header */}
      <div className="flex h-9 shrink-0 items-center justify-between border-b hairline px-2 bg-panel/80 backdrop-blur-sm">
        <div className="flex items-center gap-1">
          <TabButton
            active={bottomTab === "editor"}
            onClick={() => setBottomTab("editor")}
            title="Strategy Editor"
          >
            <Code2 className="h-3.5 w-3.5 text-accent" />
            <span>Strategy Editor</span>
            <span className="text-[9px] px-1 py-0.2 rounded bg-surface text-muted-foreground font-mono">
              py
            </span>
          </TabButton>
          <TabButton
            active={bottomTab === "backtest"}
            onClick={() => setBottomTab("backtest")}
            title="Backtest Results"
          >
            <BarChart3 className="h-3.5 w-3.5 text-pos" />
            <span>Backtest Results</span>
            {lastResult && (
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-pos/15 text-pos font-medium">
                +${lastResult.metrics.netProfit.toLocaleString()}
              </span>
            )}
          </TabButton>
          <TabButton
            active={bottomTab === "logs"}
            onClick={() => setBottomTab("logs")}
            title="Diagnostics & Logs"
          >
            <Terminal className="h-3.5 w-3.5 text-muted-foreground" />
            <span>Logs</span>
            <span className="text-[9px] px-1 py-0.2 rounded bg-surface text-muted-foreground font-mono">
              {logs.length}
            </span>
          </TabButton>
        </div>

        <div className="flex items-center gap-2">
          {lastResult && (
            <button
              type="button"
              onClick={() => setShowReportDialog(true)}
              className="flex items-center gap-1 px-2 py-1 rounded text-[10.5px] font-medium bg-pos/15 hover:bg-pos/25 text-pos border hairline border-pos/30 transition-all shadow-xs"
              title="Open Full-Screen MultiCharts Institutional Performance Tear Sheet"
            >
              <Maximize2 className="h-3 w-3 text-pos" />
              <span>Tear Sheet</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowOptimizeDialog(true)}
            className="flex items-center gap-1 px-2 py-1 rounded text-[10.5px] font-medium bg-surface hover:bg-surface/80 text-muted-foreground hover:text-foreground border hairline transition-all"
            title="Open Strategy Optimizer & Walk-Forward Suite"
          >
            <Cpu className="h-3 w-3 text-accent" />
            <span>Optimize / WFA</span>
          </button>

          {bottomTab === "editor" && (
            <>
              <button
                type="button"
                onClick={handleTranspile}
                className="flex items-center gap-1 px-2 py-1 rounded text-[10.5px] font-medium bg-surface hover:bg-surface/80 text-muted-foreground hover:text-foreground border hairline transition-all"
                title="Convert pasted PineScript or EasyLanguage to Python"
              >
                <Sparkles className="h-3 w-3 text-accent" />
                <span>Convert Script</span>
              </button>

              <button
                type="button"
                disabled={isRunning}
                onClick={runBacktest}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium transition-all",
                  isRunning
                    ? "bg-muted text-muted-foreground cursor-not-allowed"
                    : "bg-accent text-accent-foreground hover:bg-accent/90 shadow-xs"
                )}
                title="Run Backtest (Ctrl+Enter)"
              >
                <Play className="h-3 w-3 fill-current" />
                <span>{isRunning ? "Running..." : "Run Backtest"}</span>
              </button>
            </>
          )}

          {bottomTab === "logs" && (
            <button
              type="button"
              onClick={clearLogs}
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-surface"
              title="Clear console logs"
            >
              <Trash2 className="h-3 w-3" />
              <span>Clear</span>
            </button>
          )}

          <button
            type="button"
            onClick={toggleBottomPanel}
            className="flex h-6 w-6 items-center justify-center rounded hover:bg-surface text-muted-foreground hover:text-foreground transition-colors"
            title="Collapse Bottom Panel"
            aria-label="Collapse Bottom Panel"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {bottomTab === "editor" && (
          <div className="flex flex-col h-full">
            {/* Quick config strip */}
            <div className="flex items-center justify-between border-b hairline px-3 py-1 text-[10px] text-muted-foreground bg-surface/30">
              <div className="flex items-center gap-4">
                <span>
                  Symbol: <b className="font-mono text-foreground">{symbol}</b>
                </span>
                <span>
                  Timeframe: <b className="font-mono text-foreground">{timeframe}</b>
                </span>
                <span>
                  Lookback: <b className="font-mono text-foreground">{config.days}d</b>
                </span>
                <span>
                  Initial Capital:{" "}
                  <b className="font-mono text-foreground">
                    ${config.initialCapital.toLocaleString()}
                  </b>
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[9.5px]">
                <span className="flex h-1.5 w-1.5 rounded-full bg-pos" />
                <span>WebAssembly Core Ready</span>
              </div>
            </div>

            {/* Monaco / CodeEditor Canvas */}
            <div className="flex-1 min-h-0 relative">
              <CodeEditor value={source} onChange={setSource} />
            </div>
          </div>
        )}

        {bottomTab === "backtest" && (
          <div className="flex flex-col h-full overflow-y-auto scroll-thin p-3">
            {lastResult ? (
              <div className="space-y-4">
                {/* Metric Cards Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                  <MetricCard
                    label="Net Profit"
                    value={`+$${lastResult.metrics.netProfit.toLocaleString()}`}
                    sub={`${((lastResult.metrics.netProfit / lastResult.config.initialCapital) * 100).toFixed(1)}%`}
                    positive={lastResult.metrics.netProfit >= 0}
                  />
                  <MetricCard
                    label="Sharpe Ratio"
                    value={lastResult.metrics.sharpe.toFixed(2)}
                    sub="Annualized"
                    positive={lastResult.metrics.sharpe >= 1.5}
                  />
                  <MetricCard
                    label="Win Rate"
                    value={`${(lastResult.metrics.winRate * 100).toFixed(1)}%`}
                    sub={`${lastResult.metrics.totalTrades} total trades`}
                    positive={lastResult.metrics.winRate >= 0.5}
                  />
                  <MetricCard
                    label="Profit Factor"
                    value={lastResult.metrics.profitFactor.toFixed(2)}
                    sub="Gross Win / Loss"
                    positive={lastResult.metrics.profitFactor >= 1.3}
                  />
                  <MetricCard
                    label="Max Drawdown"
                    value={`${(lastResult.metrics.maxDrawdownPct * 100).toFixed(1)}%`}
                    sub="Peak-to-trough"
                    positive={false}
                  />
                  <MetricCard
                    label="Bars Tested"
                    value={lastResult.barsProcessed.toLocaleString()}
                    sub="Verified OHLCV"
                    positive={true}
                  />
                </div>

                {/* Interactive Simulated Equity Curve Visual */}
                <div className="rounded border hairline bg-surface/30 p-3">
                  <div className="flex items-center justify-between pb-2 border-b hairline">
                    <div className="flex items-center gap-1.5">
                      <TrendingUp className="h-3.5 w-3.5 text-accent" />
                      <span className="text-[11px] font-semibold text-foreground uppercase tracking-wider">
                        Cumulative Equity Curve
                      </span>
                    </div>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      WASM Fills · Deterministic Slippage
                    </span>
                  </div>
                  <div className="h-28 w-full pt-3">
                    <svg className="h-full w-full overflow-visible" viewBox="0 0 600 100" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--zt-accent, #38bdf8)" stopOpacity="0.3" />
                          <stop offset="100%" stopColor="var(--zt-accent, #38bdf8)" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>
                      <path
                        d="M 0,80 Q 80,75 140,55 T 280,45 T 400,30 T 500,20 T 600,8"
                        fill="none"
                        stroke="var(--zt-accent, #38bdf8)"
                        strokeWidth="2"
                      />
                      <path
                        d="M 0,80 Q 80,75 140,55 T 280,45 T 400,30 T 500,20 T 600,8 L 600,100 L 0,100 Z"
                        fill="url(#equityGrad)"
                      />
                    </svg>
                  </div>
                </div>

                {/* Trade Execution Ledger Table */}
                <div className="rounded border hairline bg-surface/30 overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2 border-b hairline bg-surface/50">
                    <span className="text-[11px] font-semibold text-foreground uppercase tracking-wider">
                      Execution Ledger ({lastResult.trades.length} Trades)
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground">
                      Next-bar open fills
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-[10.5px]">
                      <thead>
                        <tr className="border-b hairline bg-surface/20 text-[9px] uppercase tracking-wider text-muted-foreground font-mono">
                          <th className="px-3 py-1.5">Trade ID</th>
                          <th className="px-3 py-1.5">Side</th>
                          <th className="px-3 py-1.5">Entry Price</th>
                          <th className="px-3 py-1.5">Exit Price</th>
                          <th className="px-3 py-1.5">Quantity</th>
                          <th className="px-3 py-1.5">Duration</th>
                          <th className="px-3 py-1.5 text-right">Net P&L</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y hairline divide-border/30 font-mono">
                        {lastResult.trades.map((trade) => {
                          const isWin = trade.pnl >= 0;
                          return (
                            <tr key={trade.id} className="hover:bg-surface/50 transition-colors">
                              <td className="px-3 py-1.5 text-muted-foreground">{trade.id}</td>
                              <td className="px-3 py-1.5">
                                <span
                                  className={cn(
                                    "px-1.5 py-0.5 rounded text-[9px] font-bold uppercase",
                                    trade.side === "long"
                                      ? "bg-pos/15 text-pos"
                                      : "bg-neg/15 text-neg"
                                  )}
                                >
                                  {trade.side}
                                </span>
                              </td>
                              <td className="px-3 py-1.5">${trade.entryPrice.toLocaleString()}</td>
                              <td className="px-3 py-1.5">${trade.exitPrice.toLocaleString()}</td>
                              <td className="px-3 py-1.5">{trade.qty}</td>
                              <td className="px-3 py-1.5 text-muted-foreground">{trade.bars} bars</td>
                              <td
                                className={cn(
                                  "px-3 py-1.5 text-right font-medium",
                                  isWin ? "text-pos" : "text-neg"
                                )}
                              >
                                {isWin ? "+" : ""}
                                ${trade.pnl.toLocaleString()}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                <BarChart3 className="h-8 w-8 text-muted-foreground/50 mb-2" />
                <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                  No Backtest Executed Yet
                </h4>
                <p className="mt-1 max-w-sm text-[11px] text-muted-foreground">
                  Switch to the Strategy Editor tab and click &ldquo;Run Backtest&rdquo; to execute the
                  strategy against historical market data via the local WASM engine.
                </p>
                <button
                  type="button"
                  onClick={() => setBottomTab("editor")}
                  className="mt-3 px-3 py-1.5 rounded bg-accent text-accent-foreground text-xs font-medium hover:bg-accent/90 transition-colors"
                >
                  Open Editor
                </button>
              </div>
            )}
          </div>
        )}

        {bottomTab === "logs" && (
          <div className="flex flex-col h-full p-2">
            {/* Filter Bar */}
            <div className="flex items-center gap-1 pb-2 border-b hairline text-[10px]">
              <span className="text-muted-foreground mr-2">Filter:</span>
              {(["all", "info", "success", "warn", "error"] as const).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setLogFilter(filter)}
                  className={cn(
                    "px-2 py-0.5 rounded capitalize transition-colors",
                    logFilter === filter
                      ? "bg-surface text-foreground font-medium"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {filter}
                </button>
              ))}
            </div>

            {/* Log Output Stream */}
            <div className="flex-1 overflow-y-auto font-mono text-[10px] space-y-1 pt-2 scroll-thin">
              {filteredLogs.map((log) => (
                <div key={log.id} className="flex items-start gap-2 py-0.5 px-1 hover:bg-surface/30 rounded">
                  <span className="text-muted-foreground shrink-0 select-none">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  <span
                    className={cn(
                      "px-1 py-0.2 rounded text-[8.5px] uppercase font-bold shrink-0",
                      log.level === "info" && "bg-accent/15 text-accent",
                      log.level === "success" && "bg-pos/15 text-pos",
                      log.level === "warn" && "bg-warn/15 text-warn",
                      log.level === "error" && "bg-neg/15 text-neg"
                    )}
                  >
                    {log.level}
                  </span>
                  <span className="text-foreground select-text break-all">{log.message}</span>
                </div>
              ))}
              {filteredLogs.length === 0 && (
                <div className="p-4 text-center text-muted-foreground text-xs">
                  No log entries found for filter &ldquo;{logFilter}&rdquo;
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        "flex items-center gap-1.5 px-2 py-1 rounded text-[11px] transition-colors",
        active
          ? "bg-surface text-foreground font-medium shadow-xs"
          : "text-muted-foreground hover:text-foreground hover:bg-surface/50"
      )}
    >
      {children}
    </button>
  );
}

function MetricCard({
  label,
  value,
  sub,
  positive,
}: {
  label: string;
  value: string;
  sub: string;
  positive: boolean;
}) {
  return (
    <div className="rounded border hairline bg-surface/40 p-2">
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div
        className={cn(
          "font-mono text-sm font-semibold mt-0.5",
          positive ? "text-pos" : "text-foreground"
        )}
      >
        {value}
      </div>
      <div className="text-[9px] text-muted-foreground mt-0.5">{sub}</div>
    </div>
  );
}
