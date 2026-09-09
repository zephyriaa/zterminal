"use client";

import { useState } from "react";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Cpu,
  Layers,
  Play,
  RotateCcw,
  Sliders,
  Sparkles,
  TrendingUp,
  X,
} from "lucide-react";
import { useStrategy } from "@/stores/strategy";
import { useWorkspace } from "@/stores/workspace";
import { getContract } from "@/lib/market/contracts";
import { getOrFetchHistoricalBars } from "@/lib/market/cached-bars-provider";
import type { Timeframe } from "@/lib/market/types";
import {
  runGridSearch,
  runWalkForwardAnalysis,
  injectParameters,
  type OptimizationResult,
  type ParameterDefinition,
  type WfaResult,
} from "@/lib/research/optimizer";
import { cn } from "@/lib/utils";

export function OptimizerDialog() {
  const { showOptimizeDialog, setShowOptimizeDialog, source, setSource, config } = useStrategy();
  const { symbol, timeframe } = useWorkspace();

  const [mode, setMode] = useState<"grid" | "wfa">("grid");
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<{ completed: number; total: number } | null>(null);

  // Default parameters
  const [paramDefs, setParamDefs] = useState<ParameterDefinition[]>([
    { name: "fast", min: 5, max: 25, step: 5, type: "int" },
    { name: "slow", min: 20, max: 80, step: 10, type: "int" },
  ]);

  const [gridResult, setGridResult] = useState<OptimizationResult | null>(null);
  const [wfaResult, setWfaResult] = useState<WfaResult | null>(null);

  if (!showOptimizeDialog) return null;

  const handleRun = async () => {
    setIsRunning(true);
    setProgress(null);
    try {
      const to = Date.now();
      const from = to - config.days * 86400000;
      const bars = await getOrFetchHistoricalBars(symbol, timeframe as Timeframe, from, to);

      if (bars.length < 20) {
        throw new Error("Insufficient bars for optimization. At least 20 bars required.");
      }

      const contract = getContract(symbol);
      const backtestCfg = {
        symbol,
        timeframe,
        initialCapital: config.initialCapital,
        commissionPerContract: config.commissionPerContract,
        slippageTicks: config.slippageTicks,
        tickSize: contract.tickSize,
        multiplier: contract.multiplier,
      };

      if (mode === "grid") {
        const res = await runGridSearch(
          source,
          bars,
          backtestCfg,
          paramDefs,
          "sharpe",
          (completed, total) => setProgress({ completed, total })
        );
        setGridResult(res);
      } else {
        const res = await runWalkForwardAnalysis(source, bars, backtestCfg, paramDefs, {
          cycles: 5,
          inSampleRatio: 0.7,
        });
        setWfaResult(res);
      }
    } catch (err) {
      console.error("Optimization failed:", err);
    } finally {
      setIsRunning(false);
    }
  };

  const applyBestParams = (params: Record<string, number>) => {
    const updated = injectParameters(source, params);
    setSource(updated);
    setShowOptimizeDialog(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 sm:p-6 select-none animate-in fade-in duration-200">
      <div className="flex h-full w-full max-w-5xl flex-col rounded-lg border hairline bg-panel shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex h-12 shrink-0 items-center justify-between border-b hairline px-4 bg-surface/50">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-accent/15 text-accent">
              <Cpu className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold tracking-tight text-foreground">
                  Strategy Parameter Optimizer & Walk-Forward Suite
                </h2>
                <span className="rounded bg-accent/15 px-1.5 py-0.5 font-mono text-[9px] font-bold text-accent uppercase">
                  Multi-Worker Compute
                </span>
              </div>
              <div className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
                <span>{symbol}</span>
                <span>·</span>
                <span>{timeframe}</span>
                <span>·</span>
                <span>{config.days}d Historical Sample</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowOptimizeDialog(false)}
            className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-surface hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Configuration Bar */}
        <div className="flex flex-wrap items-center justify-between border-b hairline px-4 py-2 bg-surface/30 gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMode("grid")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1 rounded text-[11px] font-medium transition-colors",
                mode === "grid"
                  ? "bg-accent text-accent-foreground shadow-xs"
                  : "bg-surface text-muted-foreground hover:text-foreground"
              )}
            >
              <Sliders className="h-3.5 w-3.5" />
              <span>Grid Search Parameter Sweep</span>
            </button>
            <button
              type="button"
              onClick={() => setMode("wfa")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1 rounded text-[11px] font-medium transition-colors",
                mode === "wfa"
                  ? "bg-pos text-accent-foreground shadow-xs"
                  : "bg-surface text-muted-foreground hover:text-foreground"
              )}
            >
              <Activity className="h-3.5 w-3.5" />
              <span>Walk-Forward Analysis (WFA)</span>
            </button>
          </div>

          <button
            type="button"
            disabled={isRunning}
            onClick={handleRun}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] font-medium transition-all",
              isRunning
                ? "bg-muted text-muted-foreground cursor-not-allowed"
                : "bg-accent text-accent-foreground hover:bg-accent/90 shadow-xs"
            )}
          >
            <Play className="h-3 w-3 fill-current" />
            <span>
              {isRunning
                ? progress
                  ? `Evaluating ${progress.completed}/${progress.total}...`
                  : "Optimizing..."
                : "Run Optimization"}
            </span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 min-h-0 overflow-y-auto scroll-thin p-4 space-y-4">
          {/* Parameter Definition Form */}
          <div className="rounded-lg border hairline bg-surface/30 p-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
              Parameter Search Spaces
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {paramDefs.map((def, idx) => (
                <div key={def.name} className="flex items-center gap-2 rounded border hairline bg-surface/50 p-2 text-[11px] font-mono">
                  <span className="font-bold text-accent w-14 uppercase">{def.name}:</span>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <span>Min:</span>
                    <input
                      type="number"
                      value={def.min}
                      onChange={(e) => {
                        const updated = [...paramDefs];
                        updated[idx].min = Number(e.target.value);
                        setParamDefs(updated);
                      }}
                      className="w-12 rounded bg-background border hairline px-1 py-0.5 text-center text-foreground font-mono"
                    />
                  </div>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <span>Max:</span>
                    <input
                      type="number"
                      value={def.max}
                      onChange={(e) => {
                        const updated = [...paramDefs];
                        updated[idx].max = Number(e.target.value);
                        setParamDefs(updated);
                      }}
                      className="w-12 rounded bg-background border hairline px-1 py-0.5 text-center text-foreground font-mono"
                    />
                  </div>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <span>Step:</span>
                    <input
                      type="number"
                      value={def.step}
                      onChange={(e) => {
                        const updated = [...paramDefs];
                        updated[idx].step = Number(e.target.value);
                        setParamDefs(updated);
                      }}
                      className="w-12 rounded bg-background border hairline px-1 py-0.5 text-center text-foreground font-mono"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Grid Search Results View */}
          {mode === "grid" && gridResult && (
            <div className="space-y-4">
              {/* Best Candidate Banner */}
              {gridResult.bestCandidate && (
                <div className="flex flex-wrap items-center justify-between rounded-lg border hairline bg-pos/10 p-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-pos" />
                    <div>
                      <div className="text-xs font-bold text-foreground">
                        Optimal Configuration Found ({gridResult.totalCombinations} Combinations in {gridResult.elapsedMs}ms)
                      </div>
                      <div className="font-mono text-[11px] text-muted-foreground mt-0.5">
                        {Object.entries(gridResult.bestCandidate.params)
                          .map(([k, v]) => `${k}=${v}`)
                          .join(", ")}{" "}
                        · Sharpe:{" "}
                        <b className="text-pos">{gridResult.bestCandidate.sharpeRatio.toFixed(2)}</b>{" "}
                        · Net Profit:{" "}
                        <b className="text-pos">
                          ${gridResult.bestCandidate.netProfit.toLocaleString()}
                        </b>{" "}
                        · Win Rate:{" "}
                        <b>{(gridResult.bestCandidate.winRate * 100).toFixed(1)}%</b>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => applyBestParams(gridResult.bestCandidate!.params)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-pos text-accent-foreground text-xs font-bold hover:bg-pos/90 transition-colors shadow-xs"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Apply Optimal Settings</span>
                  </button>
                </div>
              )}

              {/* 2D Heatmap if Available */}
              {gridResult.heatmap && (
                <div className="rounded-lg border hairline bg-surface/30 p-4">
                  <div className="text-xs font-bold uppercase tracking-wider text-foreground mb-1">
                    Parameter Response Heatmap: {gridResult.heatmap.paramX} vs {gridResult.heatmap.paramY}
                  </div>
                  <p className="text-[11px] text-muted-foreground mb-3">
                    Color intensity highlights parameter stability and plateaus. Avoid isolated spike peaks that indicate overfitting.
                  </p>
                  <div className="overflow-x-auto">
                    <div className="inline-block font-mono text-[10px]">
                      <div className="flex items-center gap-1 mb-1">
                        <span className="w-16 text-right text-muted-foreground pr-2 font-bold">
                          {gridResult.heatmap.paramY} \ {gridResult.heatmap.paramX}
                        </span>
                        {gridResult.heatmap.xValues.map((x) => (
                          <div key={x} className="w-14 text-center font-bold text-foreground">
                            {x}
                          </div>
                        ))}
                      </div>

                      {gridResult.heatmap.yValues.map((y, yIdx) => (
                        <div key={y} className="flex items-center gap-1 mb-1">
                          <span className="w-16 text-right font-bold text-foreground pr-2">
                            {y}
                          </span>
                          {gridResult.heatmap!.grid[yIdx].map((val, xIdx) => {
                            const isPositive = val > 0;
                            return (
                              <div
                                key={xIdx}
                                className={cn(
                                  "w-14 h-8 flex items-center justify-center rounded border hairline transition-transform hover:scale-105",
                                  isPositive ? "bg-pos/25 text-pos border-pos/40 font-bold" : "bg-neg/25 text-neg border-neg/40"
                                )}
                                title={`Profit: $${val.toLocaleString()}`}
                              >
                                {val >= 0 ? "+" : ""}${Math.round(val / 1000)}k
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Candidate Leaderboard Table */}
              <div className="rounded-lg border hairline bg-surface/30 overflow-hidden">
                <div className="px-3 py-2 border-b hairline bg-surface/50 text-xs font-bold uppercase tracking-wider text-foreground">
                  Top Ranked Parameter Configurations
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[11px] font-mono">
                    <thead>
                      <tr className="border-b hairline text-[9px] uppercase tracking-wider text-muted-foreground bg-surface/20">
                        <th className="py-2 px-3">Rank</th>
                        <th className="py-2 px-3">Parameters</th>
                        <th className="py-2 px-3">Sharpe</th>
                        <th className="py-2 px-3">Net Profit</th>
                        <th className="py-2 px-3">Win Rate</th>
                        <th className="py-2 px-3">Profit Factor</th>
                        <th className="py-2 px-3">Max DD</th>
                        <th className="py-2 px-3">Trades</th>
                        <th className="py-2 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y hairline divide-border/20">
                      {gridResult.candidates.slice(0, 15).map((cand, idx) => (
                        <tr key={idx} className="hover:bg-surface/40 transition-colors">
                          <td className="py-2 px-3 font-bold text-muted-foreground">#{idx + 1}</td>
                          <td className="py-2 px-3 font-bold text-foreground">
                            {Object.entries(cand.params).map(([k, v]) => `${k}=${v}`).join(", ")}
                          </td>
                          <td className="py-2 px-3 text-accent font-bold">{cand.sharpeRatio.toFixed(2)}</td>
                          <td className={cn("py-2 px-3 font-semibold", cand.netProfit >= 0 ? "text-pos" : "text-neg")}>
                            {cand.netProfit >= 0 ? "+" : ""}${cand.netProfit.toLocaleString()}
                          </td>
                          <td className="py-2 px-3">{(cand.winRate * 100).toFixed(1)}%</td>
                          <td className="py-2 px-3">{cand.profitFactor.toFixed(2)}</td>
                          <td className="py-2 px-3 text-neg">{(cand.maxDrawdownPct * 100).toFixed(1)}%</td>
                          <td className="py-2 px-3 text-muted-foreground">{cand.totalTrades}</td>
                          <td className="py-2 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => applyBestParams(cand.params)}
                              className="px-2 py-0.5 rounded text-[10px] font-medium bg-surface hover:bg-surface/80 text-foreground border hairline"
                            >
                              Adopt
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Walk-Forward Analysis Results View */}
          {mode === "wfa" && wfaResult && (
            <div className="space-y-4">
              {/* WFE Aggregate Banner */}
              <div
                className={cn(
                  "flex flex-wrap items-center justify-between rounded-lg border hairline p-4",
                  wfaResult.isRobust ? "bg-pos/10 border-pos/40" : "bg-warn/10 border-warn/40"
                )}
              >
                <div>
                  <div className="flex items-center gap-2">
                    {wfaResult.isRobust ? (
                      <CheckCircle2 className="h-5 w-5 text-pos" />
                    ) : (
                      <Activity className="h-5 w-5 text-warn" />
                    )}
                    <h3 className="text-sm font-bold text-foreground">
                      Walk-Forward Efficiency (WFE): {wfaResult.aggregateWfe}% —{" "}
                      {wfaResult.isRobust ? "Statistically Robust" : "Curve-Fit Suspect"}
                    </h3>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {wfaResult.isRobust
                      ? "The strategy preserves over 50% of In-Sample profitability during unseen forward Out-of-Sample periods. Ready for live forward paper testing."
                      : "Walk-forward efficiency is below 50%, indicating significant performance decay on unseen data. Consider reducing parameters or widening indicator rules."}
                  </p>
                </div>
                <div className="font-mono text-right mt-2 sm:mt-0">
                  <div className="text-[10px] uppercase text-muted-foreground">Out-of-Sample Net Profit</div>
                  <div className={cn("text-lg font-bold", wfaResult.overallOosNetProfit >= 0 ? "text-pos" : "text-neg")}>
                    {wfaResult.overallOosNetProfit >= 0 ? "+" : ""}${wfaResult.overallOosNetProfit.toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Rolling Stages Breakdown Table */}
              <div className="rounded-lg border hairline bg-surface/30 overflow-hidden">
                <div className="px-3 py-2 border-b hairline bg-surface/50 text-xs font-bold uppercase tracking-wider text-foreground">
                  Walk-Forward Rolling Cycles (70% Training / 30% Forward Testing)
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[11px] font-mono">
                    <thead>
                      <tr className="border-b hairline text-[9px] uppercase tracking-wider text-muted-foreground bg-surface/20">
                        <th className="py-2 px-3">Cycle</th>
                        <th className="py-2 px-3">Optimal Parameters</th>
                        <th className="py-2 px-3">In-Sample Profit</th>
                        <th className="py-2 px-3">In-Sample Sharpe</th>
                        <th className="py-2 px-3">Out-of-Sample Profit</th>
                        <th className="py-2 px-3">Out-of-Sample Sharpe</th>
                        <th className="py-2 px-3 text-right">Cycle WFE</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y hairline divide-border/20">
                      {wfaResult.cycles.map((c) => (
                        <tr key={c.cycle} className="hover:bg-surface/40">
                          <td className="py-2 px-3 font-bold text-accent">Stage {c.cycle}</td>
                          <td className="py-2 px-3 font-semibold text-foreground">
                            {Object.entries(c.bestParams).map(([k, v]) => `${k}=${v}`).join(", ")}
                          </td>
                          <td className="py-2 px-3 text-pos">+${c.inSampleNetProfit.toLocaleString()}</td>
                          <td className="py-2 px-3">{c.inSampleSharpe.toFixed(2)}</td>
                          <td className={cn("py-2 px-3 font-bold", c.outOfSampleNetProfit >= 0 ? "text-pos" : "text-neg")}>
                            {c.outOfSampleNetProfit >= 0 ? "+" : ""}${c.outOfSampleNetProfit.toLocaleString()}
                          </td>
                          <td className="py-2 px-3">{c.outOfSampleSharpe.toFixed(2)}</td>
                          <td className="py-2 px-3 text-right">
                            <span
                              className={cn(
                                "px-1.5 py-0.5 rounded text-[10px] font-bold",
                                c.wfe >= 50 ? "bg-pos/20 text-pos" : "bg-neg/20 text-neg"
                              )}
                            >
                              {c.wfe.toFixed(1)}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
