"use client";

import { useMemo, useState } from "react";
import { useResearch } from "@/stores/research";
import type {
  ValidationResult,
  ValidationRating,
  ValidationConfig,
} from "@/domain/validation/contracts";
import type { ResearchResult } from "@/lib/local-research/contracts";

const number = (val: number, maxDecimals = 2) =>
  val.toLocaleString("en-US", { maximumFractionDigits: maxDecimals });
const percent = (val: number) => `${number(val * 100, 1)}%`;
const date = (val: number) =>
  new Date(val).toISOString().slice(0, 16).replace("T", " ");

function ratingBadge(rating: ValidationRating) {
  switch (rating) {
    case "strong":
      return "bg-emerald-950/60 text-emerald-300 border-emerald-700/60";
    case "moderate":
      return "bg-amber-950/60 text-amber-300 border-amber-700/60";
    case "weak":
      return "bg-rose-950/60 text-rose-300 border-rose-700/60";
    default:
      return "bg-purple-950/40 text-purple-300 border-purple-800/40";
  }
}

export function ValidationReport({ result }: { result: ResearchResult }) {
  const {
    validationResult: validation,
    isValidating,
    runValidation,
    validationTab,
    setValidationTab,
    error,
  } = useResearch();

  const [seed, setSeed] = useState(42);
  const [splitRatio, setSplitRatio] = useState(0.7);
  const [method, setMethod] = useState<"trade_order_permutation" | "iid_trade_resampling">(
    "trade_order_permutation",
  );

  const exportValidation = () => {
    if (!validation) return;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(validation, null, 2)], {
        type: "application/json",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `zterminal-validation-${validation.id}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleRun = () => {
    const config: Partial<ValidationConfig> = {
      monteCarloSeed: seed,
      oosSplitRatio: splitRatio,
      monteCarloMethod: method,
    };
    void runValidation(config);
  };

  const tabs = [
    "Summary",
    "OOS",
    "Walk Forward",
    "Monte Carlo",
    "Sensitivity",
    "Costs",
    "Regimes",
    "Diagnostics",
  ] as const;

  return (
    <div className="space-y-4">
      {/* Validation Toolbar */}
      <section className="flex flex-wrap items-center justify-between gap-2 rounded border border-[#2e2a38] bg-[#16141c] p-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleRun}
            disabled={isValidating}
            className="flex items-center gap-1.5 rounded bg-purple-700 px-3 py-1.5 font-medium text-white transition hover:bg-purple-600 disabled:opacity-50"
          >
            {isValidating ? (
              <>
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Validating Battery…
              </>
            ) : validation ? (
              "↻ Re-run Battery"
            ) : (
              "▶ Run Validation Battery"
            )}
          </button>
          <label className="flex items-center gap-1.5 text-zinc-400">
            Seed
            <input
              type="number"
              min={0}
              max={4294967295}
              value={seed}
              onChange={(e) => setSeed(Number(e.target.value))}
              className="h-7 w-20 rounded border border-zinc-700 bg-zinc-900 px-1.5 font-mono text-zinc-200 outline-none"
            />
          </label>
          <label className="flex items-center gap-1.5 text-zinc-400">
            IS Split
            <select
              value={splitRatio}
              onChange={(e) => setSplitRatio(Number(e.target.value))}
              className="h-7 rounded border border-zinc-700 bg-zinc-900 px-2 text-zinc-200 outline-none"
            >
              <option value={0.6}>60% IS / 40% OOS</option>
              <option value={0.7}>70% IS / 30% OOS</option>
              <option value={0.8}>80% IS / 20% OOS</option>
            </select>
          </label>
          <label className="flex items-center gap-1.5 text-zinc-400">
            Monte Carlo
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as any)}
              className="h-7 rounded border border-zinc-700 bg-zinc-900 px-2 text-zinc-200 outline-none"
            >
              <option value="trade_order_permutation">Permutation (Without Replacement)</option>
              <option value="iid_trade_resampling">IID Bootstrap (With Replacement)</option>
            </select>
          </label>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportValidation}
            disabled={!validation}
            className="rounded border border-zinc-700 bg-zinc-800/80 px-2.5 py-1.5 text-zinc-300 hover:bg-zinc-700 disabled:opacity-40"
          >
            Export JSON
          </button>
        </div>
      </section>

      {error && (
        <div className="rounded border border-rose-800/60 bg-rose-950/40 p-2.5 text-xs text-rose-300">
          {error}
        </div>
      )}

      {!validation && !isValidating && (
        <div className="rounded border border-[#2b2736] bg-[#14121a] p-8 text-center">
          <div className="mx-auto max-w-lg space-y-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-purple-400">
              Evidence · Adversarial Scrutiny · Reproducibility
            </span>
            <h3 className="text-base font-semibold text-zinc-200">
              Does this strategy contain a real edge, or is it overfitted?
            </h3>
            <p className="text-xs leading-relaxed text-zinc-400">
              Rerun the exact strategy on disjoint chronological segments, then analyze rolling windows, seeded trade-order permutations,
              and projected fee/slippage decay. Parameter sensitivity requires separate Python runs.
            </p>
            <div className="pt-2">
              <button
                onClick={handleRun}
                className="rounded bg-purple-700 px-4 py-2 text-xs font-medium text-white hover:bg-purple-600"
              >
                Run Validation Battery Now →
              </button>
            </div>
          </div>
        </div>
      )}

      {validation && (
        <>
          {/* Validation Header Provenance */}
          <section className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 pb-2 text-[11px] text-zinc-400">
            <div className="flex items-center gap-2">
              <strong className="text-zinc-200">Validation Envelope</strong>
              <span className="font-mono text-zinc-400">{validation.id}</span>
              <span className="rounded border border-zinc-700/60 bg-zinc-800/40 px-1.5 py-0.5 text-[10px] text-zinc-300">
                Engine v{validation.provenance.engineVersion}
              </span>
            </div>
            <div className="flex items-center gap-4 text-[10px] text-zinc-500 font-mono">
              <span>Parent Fingerprint: {validation.provenance.sourceRunFingerprint.slice(0, 10)}…</span>
              <span>Config Digest: {validation.provenance.validationConfigHash.slice(0, 10)}…</span>
              <span>{date(validation.createdAt)} UTC</span>
            </div>
          </section>

          {/* Sub Navigation */}
          <nav className="flex flex-wrap gap-1 border-b border-zinc-800/80 pb-2" aria-label="Validation Views">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setValidationTab(tab)}
                aria-current={validationTab === tab ? "page" : undefined}
                className={`rounded px-2.5 py-1 text-xs font-medium transition ${
                  validationTab === tab
                    ? "bg-purple-900/50 text-purple-200 border border-purple-700/60"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
                }`}
              >
                {tab}
              </button>
            ))}
          </nav>

          {/* Tab 1: SUMMARY (5-Pillar Profile + Headline Metrics + Key Diagnostics) */}
          {validationTab === "Summary" && (
            <div className="space-y-4">
              <section className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    Validation Evidence Profile
                  </h4>
                  <span className="text-[10px] text-zinc-500">
                    Rule-grounded criteria · No arbitrary magic scores
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                  <ProfileCard
                    title="Later-Period Evidence"
                    rating={validation.profile.oosPersistence}
                    detail={
                      validation.outOfSample
                        ? `Δ Sharpe: ${
                            validation.outOfSample.degradation.sharpeDelta != null
                              ? `${percent(validation.outOfSample.degradation.sharpeDelta)}`
                              : "—"
                          }`
                        : "Insufficient data"
                    }
                  />
                  <ProfileCard
                    title="Parameter Stability"
                    rating={validation.profile.parameterStability}
                    detail={
                      validation.sensitivity
                        ? `Neighbor Ratio: ${validation.sensitivity.neighborDegradationRatio.toFixed(2)}`
                        : "No sweep params"
                    }
                  />
                  <ProfileCard
                    title="Friction Resilience"
                    rating={validation.profile.frictionResilience}
                    detail={`Break-even total friction: ${validation.costStress.breakEvenFrictionBps?.toFixed(1) ?? "unavailable"} bps`}
                  />
                  <ProfileCard
                    title="Regime Breadth"
                    rating={validation.profile.regimeBreadth}
                    detail={`Max Concentration: ${validation.regimes.dominantRegimePct.toFixed(1)}%`}
                  />
                  <ProfileCard
                    title="Sample Adequacy"
                    rating={validation.profile.sampleAdequacy}
                    detail={`${validation.baseline.totalTrades} closed trades`}
                  />
                </div>
              </section>

              {/* Headline Side-by-Side Comparison */}
              {validation.outOfSample && (
                <section className="rounded border border-[#2b2736] bg-[#14121a] p-3 text-xs">
                  <h5 className="mb-2 font-semibold text-zinc-300">
                    Chronological Split: In-Sample vs Out-of-Sample
                  </h5>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left font-mono">
                      <thead>
                        <tr className="border-b border-zinc-800 text-[10px] text-zinc-400">
                          <th className="py-1">Metric</th>
                          <th className="py-1">Full Backtest</th>
                          <th className="py-1">In-Sample ({percent(validation.outOfSample.splitRatio)})</th>
                          <th className="py-1">Out-of-Sample ({percent(1 - validation.outOfSample.splitRatio)})</th>
                          <th className="py-1 text-right">OOS Degradation</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
                        <tr>
                          <td className="py-1.5 text-zinc-400 font-sans">Net Return</td>
                          <td className="py-1.5">{percent(validation.baseline.totalReturn)}</td>
                          <td className="py-1.5">{percent(validation.outOfSample.inSampleMetrics.totalReturn)}</td>
                          <td className="py-1.5">{percent(validation.outOfSample.outOfSampleMetrics.totalReturn)}</td>
                          <td className="py-1.5 text-right text-zinc-500">Different period lengths</td>
                        </tr>
                        <tr>
                          <td className="py-1.5 text-zinc-400 font-sans">Sharpe Ratio</td>
                          <td className="py-1.5">{validation.baseline.sharpe ?? "—"}</td>
                          <td className="py-1.5">{validation.outOfSample.inSampleMetrics.sharpe ?? "—"}</td>
                          <td className="py-1.5">{validation.outOfSample.outOfSampleMetrics.sharpe ?? "—"}</td>
                          <td className={`py-1.5 text-right ${(validation.outOfSample.degradation.sharpeDelta ?? 0) >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                            {validation.outOfSample.degradation.sharpeDelta != null
                              ? `${(validation.outOfSample.degradation.sharpeDelta >= 0 ? "+" : "") + percent(validation.outOfSample.degradation.sharpeDelta)}`
                              : "—"}
                          </td>
                        </tr>
                        <tr>
                          <td className="py-1.5 text-zinc-400 font-sans">Max Drawdown</td>
                          <td className="py-1.5">{percent(validation.baseline.maxDrawdown)}</td>
                          <td className="py-1.5">{percent(validation.outOfSample.inSampleMetrics.maxDrawdown)}</td>
                          <td className="py-1.5">{percent(validation.outOfSample.outOfSampleMetrics.maxDrawdown)}</td>
                          <td className={`py-1.5 text-right ${validation.outOfSample.degradation.drawdownDelta <= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                            {validation.outOfSample.degradation.drawdownDelta > 0 ? "+" : ""}
                            {percent(validation.outOfSample.degradation.drawdownDelta)}
                          </td>
                        </tr>
                        <tr>
                          <td className="py-1.5 text-zinc-400 font-sans">Closed Trades</td>
                          <td className="py-1.5">{validation.baseline.totalTrades}</td>
                          <td className="py-1.5">{validation.outOfSample.inSampleMetrics.totalTrades}</td>
                          <td className="py-1.5">{validation.outOfSample.outOfSampleMetrics.totalTrades}</td>
                          <td className="py-1.5 text-right text-zinc-500">—</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {/* Plain-Language Diagnostics */}
              <section className="space-y-2">
                <h5 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Deterministic Quantitative Diagnostics
                </h5>
                <div className="space-y-1.5">
                  {validation.diagnostics.map((diag) => (
                    <div
                      key={diag.id}
                      className={`flex items-start gap-2.5 rounded border p-2.5 text-xs ${
                        diag.severity === "critical"
                          ? "border-rose-900/60 bg-rose-950/30 text-rose-200"
                          : diag.severity === "warning"
                          ? "border-amber-900/60 bg-amber-950/30 text-amber-200"
                          : "border-purple-900/40 bg-purple-950/20 text-purple-200"
                      }`}
                    >
                      <span className="mt-0.5 text-[11px] font-bold">
                        {diag.severity === "critical" ? "⚠️" : diag.severity === "warning" ? "⚡" : "ℹ️"}
                      </span>
                      <div className="space-y-0.5">
                        <strong className="font-medium text-zinc-100">{diag.headline}</strong>
                        <p className="text-[11px] text-zinc-400 leading-relaxed">{diag.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}

          {/* Tab 2: OUT OF SAMPLE */}
          {validationTab === "OOS" && (
            <div className="space-y-4">
              {!validation.outOfSample ? (
                <p className="rounded border border-amber-900/40 bg-amber-950/20 p-4 text-xs text-amber-300">
                  Out-of-sample split requires at least 6 closed trades and 30 historical candles.
                </p>
              ) : (
                <>
                  <p className="rounded border border-amber-900/40 bg-amber-950/20 p-3 text-xs text-amber-300">
                    These earlier and later segments were executed separately by the local Helper with the same source and parameters. The later segment is not a sealed holdout if the strategy or parameters were selected using the full history.
                  </p>
                  <div className="rounded border border-[#2b2736] bg-[#14121a] p-3 text-xs space-y-2">
                    <strong className="text-zinc-200">Temporal Split & Embargo Policy</strong>
                    <p className="text-zinc-400 text-[11px] leading-relaxed">
                      In-Sample period: {date(validation.outOfSample.inSampleRange.from)} → {date(validation.outOfSample.inSampleRange.to)} UTC.
                      <br />
                      Purge gap: {validation.outOfSample.purgeBars} bar(s) embargo to prevent boundary lookahead leakage.
                      <br />
                      Out-of-Sample period: {date(validation.outOfSample.outOfSampleRange.from)} → {date(validation.outOfSample.outOfSampleRange.to)} UTC.
                      <br />
                      Linked runs: {validation.outOfSample.inSampleRun.id} / {validation.outOfSample.outOfSampleRun.id}.
                    </p>
                  </div>
                  <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4 text-xs">
                    <MetricBox label="In-Sample Trades" value={validation.outOfSample.inSampleMetrics.totalTrades.toString()} />
                    <MetricBox label="OOS Trades" value={validation.outOfSample.outOfSampleMetrics.totalTrades.toString()} />
                    <MetricBox label="OOS Sharpe" value={validation.outOfSample.outOfSampleMetrics.sharpe?.toString() ?? "—"} />
                    <MetricBox label="OOS Max Drawdown" value={percent(validation.outOfSample.outOfSampleMetrics.maxDrawdown)} />
                  </dl>
                </>
              )}
            </div>
          )}

          {/* Tab 3: WALK FORWARD */}
          {validationTab === "Walk Forward" && (
            <div className="space-y-4">
              {!validation.walkForward ? (
                <p className="rounded border border-amber-900/40 bg-amber-950/20 p-4 text-xs text-amber-300">
                  Insufficient data for Walk-Forward Analysis. At least 5 cycles of 25 bars each are required.
                </p>
              ) : (
                <>
                  <p className="rounded border border-amber-900/40 bg-amber-950/20 p-3 text-xs text-amber-300">
                    Rolling-window attribution of one backtest. No strategy rerun or training-only parameter selection occurs in these windows; this is not a walk-forward optimization result.
                  </p>
                  <div className="flex flex-wrap items-center justify-between rounded border border-[#2b2736] bg-[#14121a] p-3 text-xs">
                    <div>
                      <span className="text-[10px] uppercase text-zinc-400">Later / Earlier Annualized Return Ratio</span>
                      <div className="text-lg font-bold font-mono text-purple-300">
                        {validation.walkForward.aggregateWfe}%
                      </div>
                      <small className="text-[10px] text-zinc-500">Descriptive ratio; overlapping windows are not independent trials.</small>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] uppercase text-zinc-400">Positive OOS Cycles</span>
                      <div className="text-lg font-bold font-mono text-zinc-200">
                        {validation.walkForward.positiveOosCycles} / {validation.walkForward.totalCycles}
                      </div>
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded border border-[#2b2736] bg-[#14121a]">
                    <table className="w-full text-left text-xs font-mono">
                      <thead className="border-b border-zinc-800 text-[10px] text-zinc-400">
                        <tr>
                          <th className="p-2">Cycle</th>
                          <th className="p-2">IS Return</th>
                          <th className="p-2">IS Sharpe</th>
                          <th className="p-2">OOS Return</th>
                          <th className="p-2">OOS Sharpe</th>
                          <th className="p-2 text-right">Cycle WFE</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
                        {validation.walkForward.cycles.map((c) => (
                          <tr key={c.cycle}>
                            <td className="p-2 font-sans font-medium text-zinc-400">Cycle #{c.cycle}</td>
                            <td className="p-2">{percent(c.inSample.return)}</td>
                            <td className="p-2">{c.inSample.sharpe ?? "—"}</td>
                            <td className={`p-2 ${c.outOfSample.return >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                              {percent(c.outOfSample.return)}
                            </td>
                            <td className="p-2">{c.outOfSample.sharpe ?? "—"}</td>
                            <td className="p-2 text-right text-purple-300">{c.wfe}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Tab 4: MONTE CARLO */}
          {validationTab === "Monte Carlo" && (
            <div className="space-y-4">
              {!validation.monteCarlo ? (
                <p className="rounded border border-amber-900/40 bg-amber-950/20 p-4 text-xs text-amber-300">
                  Monte Carlo analysis requires at least 5 closed trades.
                </p>
              ) : (
                <>
                  <p className="rounded border border-[#2b2736] bg-[#14121a] p-3 text-xs text-zinc-400">
                    {validation.monteCarlo.method === "trade_order_permutation"
                      ? "Trade-order permutation reorders the recorded PnLs without replacement. Ending equity and loss status are fixed by those PnLs; the distribution describes path-dependent drawdown only."
                      : "IID trade resampling samples recorded trade PnLs with replacement. It assumes independent, identically distributed trades and does not model changing markets."}
                  </p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 text-xs">
                    <MetricBox label="Method" value={validation.monteCarlo.method === "trade_order_permutation" ? "Permutation" : "Bootstrap"} />
                    <MetricBox label="Simulations" value={validation.monteCarlo.paths.toLocaleString()} />
                    <MetricBox label={validation.monteCarlo.method === "trade_order_permutation" ? "Recorded Net Loss" : "Resampled Loss Frequency"} value={percent(validation.monteCarlo.probabilityOfLoss)} />
                    <MetricBox label="Ruin Prob (DD≥50%)" value={percent(validation.monteCarlo.probabilityOfRuin)} />
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="rounded border border-[#2b2736] bg-[#14121a] p-3 text-xs space-y-1">
                      <strong className="text-zinc-300">{validation.monteCarlo.method === "trade_order_permutation" ? "Fixed Terminal Equity" : "Terminal Equity Percentiles"}</strong>
                      <div className="flex justify-between font-mono pt-2">
                        <span className="text-zinc-400">P05 (Worst 5%):</span>
                        <span className="text-rose-400">${number(validation.monteCarlo.terminalEquity.p05)}</span>
                      </div>
                      <div className="flex justify-between font-mono">
                        <span className="text-zinc-400">P50 (Median):</span>
                        <span className="text-zinc-200">${number(validation.monteCarlo.terminalEquity.p50)}</span>
                      </div>
                      <div className="flex justify-between font-mono">
                        <span className="text-zinc-400">P95 (Best 5%):</span>
                        <span className="text-emerald-400">${number(validation.monteCarlo.terminalEquity.p95)}</span>
                      </div>
                    </div>

                    <div className="rounded border border-[#2b2736] bg-[#14121a] p-3 text-xs space-y-1">
                      <strong className="text-zinc-300">Max Drawdown Percentiles</strong>
                      <div className="flex justify-between font-mono pt-2">
                        <span className="text-zinc-400">P05 (Mildest 5%):</span>
                        <span className="text-emerald-400">{percent(validation.monteCarlo.maxDrawdownPct.p05)}</span>
                      </div>
                      <div className="flex justify-between font-mono">
                        <span className="text-zinc-400">P50 (Median):</span>
                        <span className="text-zinc-200">{percent(validation.monteCarlo.maxDrawdownPct.p50)}</span>
                      </div>
                      <div className="flex justify-between font-mono">
                        <span className="text-zinc-400">P95 (Severe 5%):</span>
                        <span className="text-rose-400">{percent(validation.monteCarlo.maxDrawdownPct.p95)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Sample Trajectory Chart */}
                  {validation.monteCarlo.samplePaths.length > 0 && (
                    <figure className="rounded border border-[#2b2736] bg-[#14121a] p-3 text-xs">
                      <figcaption className="text-[11px] font-medium text-zinc-400 mb-2">
                        Monte Carlo Shuffled Trade Equity Paths ({validation.monteCarlo.samplePaths.length} Sample Paths)
                      </figcaption>
                      <MonteCarloChart paths={validation.monteCarlo.samplePaths} />
                    </figure>
                  )}
                </>
              )}
            </div>
          )}

          {/* Tab 5: SENSITIVITY */}
          {validationTab === "Sensitivity" && (
            <div className="space-y-4">
              {!validation.sensitivity ? (
                <p className="rounded border border-amber-900/40 bg-amber-950/20 p-4 text-xs text-amber-300">
                  Parameter sensitivity is unavailable. Each grid cell must be produced by an independent execution of the exact Python strategy; the current validator has no parameter sweep runner.
                </p>
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-between rounded border border-[#2b2736] bg-[#14121a] p-3 text-xs">
                    <div>
                      <span className="text-[10px] uppercase text-zinc-400">Surface Classification</span>
                      <div className="text-sm font-bold text-zinc-200 uppercase tracking-wide">
                        {validation.sensitivity.surfaceClassification.replace("_", " ")}
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <div>
                        <span className="text-[10px] uppercase text-zinc-400">Neighbor Stability Ratio (ρ)</span>
                        <div className="font-mono text-sm font-semibold text-purple-300">
                          {validation.sensitivity.neighborDegradationRatio.toFixed(2)}
                        </div>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase text-zinc-400">Coefficient of Variation</span>
                        <div className="font-mono text-sm font-semibold text-zinc-300">
                          {validation.sensitivity.coefficientOfVariation.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 2D Heatmap Grid */}
                  <div className="rounded border border-[#2b2736] bg-[#14121a] p-4 text-xs">
                    <h5 className="mb-2 text-[11px] font-semibold text-zinc-400">
                      Parameter Neighborhood Heatmap ({validation.sensitivity.paramX} × {validation.sensitivity.paramY})
                    </h5>
                    <div className="overflow-x-auto">
                      <table className="w-full text-center font-mono text-[11px]">
                        <thead>
                          <tr>
                            <th className="p-1 text-zinc-500 font-sans">{validation.sensitivity.paramY} \ {validation.sensitivity.paramX}</th>
                            {validation.sensitivity.xValues.map((x) => (
                              <th key={x} className="p-1 text-zinc-400">{x}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {validation.sensitivity.grid.map((row, yIdx) => (
                            <tr key={yIdx}>
                              <td className="p-1 font-bold text-zinc-400">{validation.sensitivity!.yValues[yIdx]}</td>
                              {row.map((cell, xIdx) => {
                                const isCenter = xIdx === 2 && yIdx === 2;
                                const isPos = cell.metricValue > 0;
                                return (
                                  <td
                                    key={xIdx}
                                    className={`p-2 border border-zinc-900 ${
                                      isCenter
                                        ? "ring-2 ring-purple-500"
                                        : ""
                                    } ${
                                      isPos
                                        ? "bg-emerald-950/40 text-emerald-300"
                                        : "bg-rose-950/40 text-rose-300"
                                    }`}
                                    title={`${validation.sensitivity!.paramX}: ${cell.x}, ${validation.sensitivity!.paramY}: ${cell.y} → Metric: ${cell.metricValue}`}
                                  >
                                    {cell.metricValue}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="mt-2 text-[10px] text-zinc-500">
                      Center cell with purple outline indicates the executed baseline parameters.
                    </p>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Tab 6: COSTS */}
          {validationTab === "Costs" && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between rounded border border-[#2b2736] bg-[#14121a] p-3 text-xs">
                <div>
                  <span className="text-[10px] uppercase text-zinc-400">Projected Break-Even Total Friction</span>
                  <div className="text-lg font-bold font-mono text-purple-300">
                    {validation.costStress.breakEvenFrictionBps?.toFixed(1) ?? "—"} bps
                  </div>
                  <small className="text-[10px] text-zinc-500">Linear haircut of recorded fills; strategy signals are not rerun</small>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase text-zinc-400">Friction Elasticity (+10 bps)</span>
                  <div className="text-lg font-bold font-mono text-zinc-200">
                    {validation.costStress.frictionElasticity.toFixed(1)}% drop
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto rounded border border-[#2b2736] bg-[#14121a]">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="border-b border-zinc-800 text-[10px] text-zinc-400">
                    <tr>
                      <th className="p-2">Added Friction</th>
                      <th className="p-2">Total Friction</th>
                      <th className="p-2">Net Profit</th>
                      <th className="p-2">Sharpe</th>
                      <th className="p-2">Expectancy</th>
                      <th className="p-2 text-right">Profit Factor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
                    {validation.costStress.tiers.map((t) => (
                      <tr key={t.totalFrictionBps}>
                        <td className="p-2 font-sans font-medium text-zinc-400">+{t.totalFrictionBps - validation.costStress.tiers[0].totalFrictionBps} bps</td>
                        <td className="p-2">{t.totalFrictionBps} bps</td>
                        <td className={`p-2 ${t.netProfit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                          ${number(t.netProfit)}
                        </td>
                        <td className="p-2">{t.sharpe ?? "—"}</td>
                        <td className="p-2">${number(t.expectancy)}</td>
                        <td className="p-2 text-right">{t.profitFactor ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tab 7: REGIMES */}
          {validationTab === "Regimes" && (
            <div className="space-y-4">
              <div className="rounded border border-[#2b2736] bg-[#14121a] p-3 text-xs space-y-1">
                <strong className="text-zinc-200">Market Regime Classification</strong>
                <p className="text-zinc-400 text-[11px] leading-relaxed">
                  Bars are partitioned into rolling ATR volatility tertiles (Low, Normal, High) and EMA50/200 trend regimes (Bull, Bear, Neutral). Trades are attributed based on market state at entry time.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {/* Volatility Regimes */}
                <div className="rounded border border-[#2b2736] bg-[#14121a] p-3 text-xs space-y-2">
                  <h5 className="font-semibold text-zinc-300">Volatility Regimes</h5>
                  <div className="divide-y divide-zinc-800/60 text-[11px]">
                    {validation.regimes.volatilityRegimes.map((r) => (
                      <div key={r.regime} className="py-2 flex justify-between items-center">
                        <div>
                          <strong className="text-zinc-200">{r.label}</strong>
                          <div className="text-[10px] text-zinc-500 font-mono">
                            {r.tradesCount} trades · Win {percent(r.winRate)}
                          </div>
                        </div>
                        <div className="text-right font-mono">
                          <span className={r.netProfit >= 0 ? "text-emerald-400" : "text-rose-400"}>
                            ${number(r.netProfit)}
                          </span>
                          <div className="text-[10px] text-zinc-500">{r.profitContributionPct}% of profit</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Trend Regimes */}
                <div className="rounded border border-[#2b2736] bg-[#14121a] p-3 text-xs space-y-2">
                  <h5 className="font-semibold text-zinc-300">Trend Regimes</h5>
                  <div className="divide-y divide-zinc-800/60 text-[11px]">
                    {validation.regimes.trendRegimes.map((r) => (
                      <div key={r.regime} className="py-2 flex justify-between items-center">
                        <div>
                          <strong className="text-zinc-200">{r.label}</strong>
                          <div className="text-[10px] text-zinc-500 font-mono">
                            {r.tradesCount} trades · Win {percent(r.winRate)}
                          </div>
                        </div>
                        <div className="text-right font-mono">
                          <span className={r.netProfit >= 0 ? "text-emerald-400" : "text-rose-400"}>
                            ${number(r.netProfit)}
                          </span>
                          <div className="text-[10px] text-zinc-500">{r.profitContributionPct}% of profit</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 8: DIAGNOSTICS & CONCENTRATION */}
          {validationTab === "Diagnostics" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 text-xs">
                <MetricBox label="Top 5 Trades % PnL" value={`${validation.concentration.top5TradesProfitPct.toFixed(1)}%`} />
                <MetricBox label="Top 10 Trades % PnL" value={`${validation.concentration.top10TradesProfitPct.toFixed(1)}%`} />
                <MetricBox label="Longest Loss Streak" value={`${validation.concentration.longestLossStreak} trades`} />
                <MetricBox label="Max DD Duration" value={`${validation.concentration.maxDrawdownDays} days`} />
              </div>

              <section className="space-y-2">
                <h5 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Comprehensive Diagnostics Ledger
                </h5>
                <div className="space-y-2">
                  {validation.diagnostics.map((diag) => (
                    <div
                      key={diag.id}
                      className="rounded border border-[#2b2736] bg-[#14121a] p-3 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <strong className="text-zinc-200">{diag.headline}</strong>
                        <span
                          className={`rounded px-1.5 py-0.5 text-[9px] uppercase font-bold ${
                            diag.severity === "critical"
                              ? "bg-rose-950 text-rose-300 border border-rose-800/60"
                              : diag.severity === "warning"
                              ? "bg-amber-950 text-amber-300 border border-amber-800/60"
                              : "bg-purple-950 text-purple-300 border border-purple-800/60"
                          }`}
                        >
                          {diag.severity}
                        </span>
                      </div>
                      <p className="text-zinc-400 text-[11px] leading-relaxed">{diag.detail}</p>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ProfileCard({
  title,
  rating,
  detail,
}: {
  title: string;
  rating: ValidationRating;
  detail: string;
}) {
  return (
    <div className="rounded border border-[#2b2736] bg-[#14121a] p-2.5 text-xs space-y-1">
      <span className="text-[10px] uppercase text-zinc-500 font-medium block truncate">
        {title}
      </span>
      <div className="flex items-center gap-1.5">
        <span
          className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${ratingBadge(
            rating,
          )}`}
        >
          {rating}
        </span>
      </div>
      <p className="text-[10px] text-zinc-400 font-mono truncate">{detail}</p>
    </div>
  );
}

function MetricBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-[#2b2736] bg-[#14121a] p-2.5">
      <span className="text-[10px] uppercase text-zinc-500 block truncate">{label}</span>
      <div className="text-sm font-semibold font-mono text-zinc-200 mt-1">{value}</div>
    </div>
  );
}

function MonteCarloChart({ paths }: { paths: number[][] }) {
  const allValues = paths.flatMap((p) => p);
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const range = max - min || 1;

  return (
    <svg viewBox="0 0 800 160" className="w-full h-40 bg-zinc-950/40 rounded border border-zinc-800/60" preserveAspectRatio="none">
      {paths.map((p, pIdx) => {
        const points = p
          .map((v, i) => {
            const x = (i / (p.length - 1)) * 800;
            const y = 150 - ((v - min) / range) * 140;
            return `${x},${y}`;
          })
          .join(" ");
        return (
          <polyline
            key={pIdx}
            fill="none"
            stroke={pIdx % 2 ? "#7c3aed" : "#a855f7"}
            strokeWidth="0.8"
            opacity="0.35"
            points={points}
          />
        );
      })}
    </svg>
  );
}
