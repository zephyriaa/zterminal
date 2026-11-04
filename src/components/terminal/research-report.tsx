"use client";
import { EdgeAssessment, ResearchAnalysisPanel } from "./research-analysis-panel";
import { useMemo, useState } from "react";
import { useResearch } from "@/stores/research";
import { useWorkspaceDock } from "./docking/workspace-dock-controller";
import { helper } from "@/lib/local-research/client";
import type { ResearchResult, ResearchTrade } from "@/lib/local-research/contracts";
import { researchEvidence } from "@/lib/local-research/evidence";
const number = (value: number) => value.toLocaleString("en-US", { maximumFractionDigits: 2 });
const percent = (value: number) => `${number(value * 100)}%`;
const date = (value: number) => new Date(value).toISOString().slice(0, 16).replace("T", " ");

export function ResearchReport() {
  const dock = useWorkspaceDock();
  const { result, job, archived, reportTab: tab, error } = useResearch();
  const [seed, setSeed] = useState(42), [simulations, setSimulations] = useState(1000);
  const [importMessage, setImportMessage] = useState("");
  const busy = Boolean(job && !["complete", "failed", "cancelled"].includes(job.stage));
  const exportResult = () => {
    if (!result) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(result.researchSchema === 2 ? { version: 2, kind: "research_bundle", result, analyses: useResearch.getState().analyses, holdoutUsage: useResearch.getState().holdoutUsage } : result)], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = `zterminal-${result.id}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <div className="zt-research-report">
    <header className="zt-report-toolbar"><select aria-label="Open archived backtest" value={result?.id ?? ""} onChange={e => { if (e.target.value) void useResearch.getState().openResult(e.target.value); }}><option value="">Local archive…</option>{archived.map(p => <option key={p.id} value={p.id}>{p.name} / {date(p.created)}</option>)}</select><button onClick={exportResult} disabled={!result}>Export JSON + data</button><label className="zt-report-import">Import<input type="file" accept=".json,application/json" onChange={async e => {
      const file = e.target.files?.[0]; if (!file) return;
      try { if (file.size > 32_000_000) throw new Error("Import limit: 32 MB."); const payload = JSON.parse(await file.text()); if (payload.kind === "research_bundle" || payload.version === 1 && payload.resultHash) { const { id } = await helper.importResult(payload); await useResearch.getState().connect(); await useResearch.getState().openResult(id); setImportMessage("Verified envelope imported. No source was executed."); } else { const imported = await helper.importLegacy(payload); setImportMessage(imported.reason); } } catch (error) { setImportMessage((error as Error).message); } finally { e.target.value = ""; }
    }} /></label></header>
    <nav className="zt-report-tabs" aria-label="Research report views">{["Overview", "Performance", "Trades", "Execution assumptions", "Risk", "Validation", "Monte Carlo", "Logs"].map(value => <button key={value} aria-current={tab === value ? "page" : undefined} onClick={() => useResearch.setState({ reportTab: value as typeof tab })}>{value}</button>)}</nav>
    {busy && <div className="zt-report-run-status" role="status">{job!.stage.replaceAll("_", " ")} {job?.message} {job?.completed ?? ""}{job?.total ? ` / ${job.total}` : ""} <button onClick={() => useResearch.getState().cancel()}>Cancel run</button><span>Historical-data download and first initialization are separate from cached execution. Direct vectorbt imports may compile kernels on first use.</span></div>}
    {importMessage && <p className="px-4 py-2 text-xs" role="status">{importMessage}</p>}
    <div className="zt-report-content">{error && <p role="alert" className="zt-report-error">{error}</p>}
      {!result ? <div className="zt-report-empty"><span>WRITE → BACKTEST → INSPECT</span><h3>A report starts with a testable idea.</h3><p>Write Python in the connected editor, pair the local Windows helper, and run a test against a complete historical dataset. Successful runs retain their source, data and assumptions.</p>{error && <p role="alert">{error}</p>}<button onClick={() => dock.openPanel("strategy")}>Open strategy editor →</button></div> : <>
        <div className="zt-report-identity"><strong>{result.name}</strong><span>{result.dataset.provider} / {result.dataset.symbol} / {result.dataset.timeframe}</span><span>{date(result.dataset.from)} — {date(result.dataset.to)} UTC (end exclusive)</span><span>Illustrates historical simulation / not live execution</span></div>
        <RunEvidence result={result} />
        {tab === "Overview" && <><EdgeAssessment result={result} /><Metrics result={result} keys={["totalReturn", "netProfit", "maxDrawdown", "returnToMaxDrawdown", "calmar", "totalTrades", "winRate", "profitFactor", "exposure"]} /><SeriesPlot label="Account equity and passive price benchmark" series={[{ values: result.equity.map(p => p.equity), color: "#b79be8", name: "Equity" }, { values: result.equity.map(p => p.benchmark), color: "#70798d", name: result.researchSchema === 2 ? "Benchmark after modeled costs" : "Benchmark before costs" }]} splitRatio={result.config.reserveHoldout ? (result.config.holdoutSplitRatio ?? 0.20) : undefined} /><ul className="zt-report-observations">{result.observations.map(p => <li key={p}>{p}</li>)}</ul><details><summary>Execution assumptions & reproducibility</summary><ul>{result.assumptions.map(p => <li key={p}>{p}</li>)}</ul><Provenance result={result} /></details></>}
        {tab === "Performance" && <><Metrics result={result} keys={["totalReturn", "cagr", "sharpe", "sortino", "profitFactor", "expectancy", "averageWinner", "averageLoser", "consecutiveWins", "consecutiveLosses"]} /><SeriesPlot label="Equity" series={[{ values: result.equity.map(p => p.equity), color: "#b79be8", name: "Quote-currency equity" }]} /><Histogram label="Closed-trade P&L distribution" values={result.trades.filter(p => p.status === "closed").map(p => p.pnl)} />{result.dataset.to - result.dataset.from >= 28 * 86400000 && <div className="zt-monthly">{result.monthly.map(p => <span key={p.period}>{p.period}<b>{p.return == null ? "Unavailable" : percent(p.return)}</b></span>)}</div>}</>}
        {tab === "Trades" && <><TradeList trades={result.trades} result={result} /><FillLedger result={result} /></>}
        {tab === "Execution assumptions" && <><Metrics result={result} keys={["fees", "slippageCost", "spreadCost", "tickRoundingCost", "turnover", "benchmarkReturn", "excessReturn", "averageHoldingMs"]} /><ul>{result.assumptions.map(p => <li key={p}>{p}</li>)}</ul><Provenance result={result} /></>}
        {tab === "Validation" && <ResearchAnalysisPanel result={result} mode="Validation" />}
        {tab === "Risk" && <><Metrics result={result} keys={["maxDrawdown", "exposure", "volatility", "downsideVolatility", "sharpe", "sortino", "calmar", "openTrades"]} /><SeriesPlot label="Drawdown from peak equity" series={[{ values: result.equity.map(p => -p.drawdown * 100), color: "#c48491", name: "Drawdown (%)" }]} /><div className="zt-drawdown-list">{result.drawdowns.slice(0, 100).map((p, i) => <p key={i}>{date(p.start)} → {p.recovery ? date(p.recovery) : "Unrecovered"}<b>{percent(p.depth)}</b><span>{number(p.durationMs / 86400000)} days</span></p>)}</div><p className="text-xs text-muted-foreground">Price-based, unlevered simulation. Funding, liquidation, margin and market impact are not modeled.</p></>}
        {tab === "Monte Carlo" && result.researchSchema === 2 && <ResearchAnalysisPanel result={result} mode="Monte Carlo" />}
        {tab === "Monte Carlo" && result.researchSchema !== 2 && <><p className="zt-method-note">Seeded bootstrap resamples closed-trade account returns with replacement. It assumes independent, identically distributed observations and compounds them from initial capital. This explores the historical sample; it is not a forecast.</p><div className="zt-monte-controls"><label>Seed<input type="number" min={0} max={4294967295} value={seed} onChange={e => setSeed(Number(e.target.value))} /></label><label>Paths<input type="number" min={100} max={5000} step={100} value={simulations} onChange={e => setSimulations(Number(e.target.value))} /></label><button disabled={busy} onClick={() => useResearch.getState().analyze(seed, simulations)}>Generate bootstrap</button></div>{result.monteCarlo && <><div className="zt-method-note">{result.monteCarlo.observations} closed trades / {result.monteCarlo.simulations} paths / seed {result.monteCarlo.seed}. Loss frequency: {percent(result.monteCarlo.probabilityOfLoss)}.{result.monteCarlo.observations < 30 && " Small sample: estimates may be unstable."}</div><SeriesPlot label="Bootstrap equity percentile bands (5 / 50 / 95%)" series={[{ values: result.monteCarlo.bands.map(p => p.lower), color: "#655376", name: "5th percentile" }, { values: result.monteCarlo.bands.map(p => p.median), color: "#c5a4eb", name: "Median" }, { values: result.monteCarlo.bands.map(p => p.upper), color: "#9882b2", name: "95th percentile" }]} /><SeriesPlot label="Twenty bounded sample paths" showLegend={false} series={result.monteCarlo.samplePaths.slice(0, 20).map((values, index) => ({ values, color: index % 2 ? "#5f536b" : "#766484", name: `Sample ${index + 1}` }))} /><Histogram label="Ending equity distribution" values={result.monteCarlo.endingEquity} /><Histogram label="Maximum drawdown distribution (%)" values={result.monteCarlo.maxDrawdowns.map(p => p * 100)} /></>}</>}
        {tab === "Logs" && <><Provenance result={result} /><pre className="zt-report-log">{result.logs.join("\n") || "No strategy output was logged."}</pre><details><summary>Exact executed Python source</summary><pre className="zt-report-log">{result.source}</pre></details><details><summary>Captured parameters</summary><pre className="zt-report-log">{JSON.stringify({ supplied: result.params, resolved: result.resolvedParams, seeds: result.seeds, instrument: result.instrument }, null, 2)}</pre></details></>}
      </>}
    </div>
  </div>;
}

function RunEvidence({ result }: { result: ResearchResult }) {
  const evidence = researchEvidence(result);
  return <section aria-label="Captured run evidence" className="zt-method-note">
    <strong>Captured run evidence · {result.dataset.provider} perpetual OHLCV</strong>
    <p>{evidence.coverage}</p><p>{evidence.freshness}</p>
    <p>Requested {date(result.config.from)} → {date(result.config.to)} UTC (end exclusive).</p>
    <p>Engine {result.engine.engine ?? "version not recorded"} · Python {result.engine.python} · vectorbt {result.engine.vectorbt} · SDK {result.engine.sdk} · analytics {result.engine.analytics}</p>
    <p>Fees {result.config.feeBps} bps per fill · slippage {result.config.slippageBps} bps per fill · capital {number(result.config.initialCapital)} quote · allocation {percent(result.config.allocation)} · {result.config.direction} · multiplier {result.config.multiplier} · quantity step {result.config.quantityStep}.</p>
    <p>{evidence.limitations}</p>
    <ul aria-label="Saved execution assumptions">{result.assumptions.map((value, index) => <li key={index}>{value}</li>)}</ul>
  </section>;
}
function Metrics({ result, keys }: { result: ResearchResult; keys: string[] }) {
  const fractions = new Set(["totalReturn", "benchmarkReturn", "excessReturn", "cagr", "maxDrawdown", "winRate", "exposure", "volatility", "downsideVolatility"]);
  return <dl className="zt-report-metrics">{keys.map(key => { const metric = result.metrics[key]; return <div key={key} title={metric?.reason}><dt>{key.replace(/([A-Z])/g, " $1")}</dt><dd>{metric?.value == null ? "—" : fractions.has(key) ? percent(metric.value) : number(metric.value)}</dd>{metric?.value == null && <small>{metric?.reason ?? "Unavailable"}</small>}</div>; })}</dl>;
}
function Provenance({ result }: { result: ResearchResult }) {
  return <dl className="zt-provenance"><dt>Source SHA-256</dt><dd>{result.sourceHash}</dd><dt>Dataset SHA-256</dt><dd>{result.dataset.hash}</dd><dt>Result SHA-256</dt><dd>{result.resultHash}</dd><dt>Engine</dt><dd>{result.engine.engine ? `engine ${result.engine.engine} / ` : ""}Python {result.engine.python} / vectorbt {result.engine.vectorbt} / SDK {result.engine.sdk} / analytics {result.engine.analytics}</dd><dt>Saved locally</dt><dd>{date(result.createdAt)} UTC · {result.dataset.bars.length.toLocaleString()} complete candles</dd></dl>;
}
function SeriesPlot({ label, series, showLegend = true, splitRatio }: { label: string; series: { name: string; values: number[]; color: string }[]; showLegend?: boolean; splitRatio?: number }) {
  const sampled = useMemo(() => series.map(p => ({ ...p, values: p.values.filter((_, i) => i % Math.max(1, Math.ceil(p.values.length / 800)) === 0 || i === p.values.length - 1) })), [series]);
  const all = sampled.flatMap(p => p.values).filter(Number.isFinite);
  if (all.length < 2) return <p className="zt-method-note">{label}: insufficient observations.</p>;
  const min = Math.min(...all), max = Math.max(...all), range = max - min || 1;
  const splitX = splitRatio ? Math.round(900 * (1 - splitRatio)) : null;
  return <figure className="zt-report-plot"><figcaption>{label}{showLegend && <span>{sampled.map(p => <i key={p.name} style={{ color: p.color }}>{p.name}</i>)}</span>}</figcaption><svg viewBox="0 0 900 180" role="img" aria-label={`${label}. Range ${number(min)} to ${number(max)}.`} preserveAspectRatio="none">{splitX && <><rect x="0" y="0" width={splitX} height="180" fill="#3b82f6" fillOpacity="0.04" /><rect x={splitX} y="0" width={900 - splitX} height="180" fill="#f59e0b" fillOpacity="0.06" /><line x1={splitX} y1="0" x2={splitX} y2="180" stroke="#f59e0b" strokeWidth="1" strokeDasharray="3 3" /><text x={splitX * 0.5} y="15" fill="#60a5fa" fontSize="9" textAnchor="middle" letterSpacing="1">IN-SAMPLE</text><text x={splitX + (900 - splitX) * 0.5} y="15" fill="#fbbf24" fontSize="9" textAnchor="middle" letterSpacing="1">OUT-OF-SAMPLE (HOLDOUT)</text></>}{[20, 60, 100, 140].map(y => <line key={y} x1="0" x2="900" y1={y} y2={y} stroke="#282631" strokeWidth=".6" />)}{sampled.map(p => <polyline key={p.name} fill="none" stroke={p.color} strokeWidth={showLegend ? "1.5" : ".75"} opacity={showLegend ? 1 : .55} vectorEffect="non-scaling-stroke" points={p.values.map((v, i) => `${i / Math.max(1, p.values.length - 1) * 900},${160 - (v - min) / range * 140}`).join(" ")} />)}</svg><div className="zt-plot-axis"><span>{number(min)}</span><span>Observation order →</span><span>{number(max)}</span></div></figure>;
}
function Histogram({ label, values }: { label: string; values: number[] }) {
  if (!values.length) return <p className="zt-method-note">{label}: no closed observations.</p>;
  let min = Infinity, max = -Infinity;
  for (const value of values) { if (value < min) min = value; if (value > max) max = value; }
  const span = max - min || 1, bins = Array(20).fill(0) as number[];
  values.forEach(v => bins[Math.min(19, Math.floor((v - min) / span * 20))]++);
  const peak = Math.max(...bins);
  return <figure className="zt-histogram"><figcaption>{label} / {values.length} observations</figcaption><div role="img" aria-label={`${label}: ${number(min)} to ${number(max)}`}>{bins.map((count, i) => <span key={i} title={`${number(min + i / 20 * span)}: ${count}`} style={{ height: `${Math.max(1, count / peak * 100)}%` }} />)}</div><footer>{number(min)} <span>{number(max)}</span></footer></figure>;
}
function TradeList({ trades, result }: { trades: ResearchTrade[]; result: ResearchResult }) {
  const dock = useWorkspaceDock();
  const [offset, setOffset] = useState(0);
  const selected = useResearch(s => s.selectedTrade);
  const start = Math.max(0, Math.floor(offset / 34) - 5), visible = trades.slice(start, start + 30);
  const trade = trades.find(p => p.id === selected);
  return <><p className="zt-method-note">Select a trade to inspect entry and exit on its archived chart. Times are UTC. Open trades are marked to the final close.</p><div className="zt-trade-heading"><span>Direction</span><span>Entry / UTC</span><span>Exit / UTC</span><span>P&L</span><span>Return</span></div><div className="zt-trade-scroll" onScroll={e => setOffset(e.currentTarget.scrollTop)} role="table" aria-label="Archived trades" aria-rowcount={trades.length}><div style={{ height: trades.length * 34, position: "relative" }}>{visible.map((p, i) => <button role="row" aria-rowindex={start + i + 1} aria-selected={p.id === selected} key={p.id} className="zt-trade-row" style={{ top: (start + i) * 34 }} onClick={() => { useResearch.setState({ chartResult: result, selectedTrade: p.id }); dock.focusPanel("chart"); }}><span role="cell">{p.side}</span><span role="cell">{date(p.entryTime)}</span><span role="cell">{p.exitTime ? date(p.exitTime) : "Open"}</span><span role="cell">{number(p.pnl)}</span><span role="cell">{percent(p.return)}</span></button>)}</div></div>{trade && <div className="zt-method-note" style={{ background: "rgba(255,255,255,0.03)", padding: "8px 12px", borderRadius: "4px", marginTop: "6px" }}><strong>Trade #{trade.id} ({trade.side.toUpperCase()}):</strong> Entry Fill {number(trade.entryPrice)} / Exit Fill {number(trade.exitPrice)} / Contracts {number(trade.quantity)} / Fees ${number(trade.fees)} / P&amp;L <b style={{ color: trade.pnl >= 0 ? "#4ade80" : "#f87171" }}>{number(trade.pnl)} ({percent(trade.return)})</b> / Exit Reason: <em>{trade.exitReason ?? "Signal"}</em></div>}</>;
}

function FillLedger({ result }: { result: ResearchResult }) {
  const [page, setPage] = useState(0);
  const fills = result.fills ?? [];
  const last = result.accounts?.at(-1);
  return <><h3>Fills and execution explanations</h3>{!result.fills && <p>No detailed fill ledger was retained in this legacy archive.</p>}{last && <p>Final reconciliation: cash {number(last.cash)} + reserved capital {number(last.reservedCapital)} + unrealized P&amp;L {number(last.unrealizedPnl)} = equity {number(last.equity)}. Realized gross P&amp;L {number(last.realizedPnl)}; accumulated fees {number(last.fees)}.</p>}<div style={{ overflowX: "auto" }}><table><caption>Decision timestamps identify the completed signal candle; execution occurs at the eligible later candle open, except explicit split-close exits.</caption><thead><tr><th>Action</th><th>Decision / UTC</th><th>Execution / UTC</th><th>Quantity</th><th>Base / execution price</th><th>Fee</th><th>Assumptions / reason</th></tr></thead><tbody>{fills.slice(page*100, page*100+100).map((fill, i) => <tr key={`${fill.orderId}-${i}`}><td>{fill.side} {fill.action}</td><td>{date(fill.decisionTime)}</td><td>{date(fill.eligibleTime)}</td><td>{number(fill.quantity)}</td><td>{number(fill.basePrice)} / {number(fill.price)}</td><td>{number(fill.fee)}</td><td>{fill.slippageBps} bps slippage, {fill.spreadBps} bps full spread, tick {fill.tickSize}; {fill.reason}</td></tr>)}</tbody></table></div><p>Fill page {page+1} / {Math.max(1, Math.ceil(fills.length/100))}. <button disabled={page===0} onClick={() => setPage(p=>p-1)}>Previous fills</button> <button disabled={(page+1)*100>=fills.length} onClick={() => setPage(p=>p+1)}>Next fills</button></p><details><summary>Orders and rejection/ignore reasons (first 200; export retains all)</summary><pre className="zt-report-log">{JSON.stringify(result.orders?.slice(0,200) ?? "Legacy archive has no order ledger", null, 2)}</pre></details></>;
}
