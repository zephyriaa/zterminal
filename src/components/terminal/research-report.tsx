"use client";
import { useMemo, useState } from "react";
import { useResearch } from "@/stores/research";
import { usePanels } from "@/stores/panels";
import { helper } from "@/lib/local-research/client";
import type { ResearchResult, ResearchTrade } from "@/lib/local-research/contracts";
const number = (value: number) => value.toLocaleString("en-US", { maximumFractionDigits: 2 });
const percent = (value: number) => `${number(value * 100)}%`;
const date = (value: number) => new Date(value).toISOString().slice(0, 16).replace("T", " ");

export function ResearchReport() {
  const { result, job, archived, reportTab: tab, error } = useResearch();
  const [seed, setSeed] = useState(42), [simulations, setSimulations] = useState(1000);
  const [importMessage, setImportMessage] = useState("");
  const busy = Boolean(job && !["complete", "failed", "cancelled"].includes(job.stage));
  const exportResult = () => {
    if (!result) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(result)], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = `zterminal-${result.id}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <div className="zt-research-report">
    <header className="zt-report-toolbar"><select aria-label="Open archived backtest" value={result?.id ?? ""} onChange={e => { if (e.target.value) void useResearch.getState().openResult(e.target.value); }}><option value="">Local archive…</option>{archived.map(p => <option key={p.id} value={p.id}>{p.name} / {date(p.created)}</option>)}</select><button onClick={exportResult} disabled={!result}>Export JSON + data</button><label className="zt-report-import">Import<input type="file" accept=".json,application/json" onChange={async e => {
      const file = e.target.files?.[0]; if (!file) return;
      try { if (file.size > 32_000_000) throw new Error("Import limit: 32 MB."); const payload = JSON.parse(await file.text()); if (payload.version === 1 && payload.resultHash) { const { id } = await helper.importResult(payload); await useResearch.getState().connect(); await useResearch.getState().openResult(id); setImportMessage("Verified envelope imported. No source was executed."); } else { const imported = await helper.importLegacy(payload); setImportMessage(imported.reason); } } catch (error) { setImportMessage((error as Error).message); } finally { e.target.value = ""; }
    }} /></label></header>
    <nav className="zt-report-tabs" aria-label="Research report views">{["Overview", "Performance", "Trades", "Risk", "Monte Carlo", "Logs"].map(value => <button key={value} aria-current={tab === value ? "page" : undefined} onClick={() => useResearch.setState({ reportTab: value as typeof tab })}>{value}</button>)}</nav>
    {busy && <div className="zt-report-run-status" role="status">{job!.stage.replaceAll("_", " ")} <button onClick={() => useResearch.getState().cancel()}>Cancel run</button><span>Historical-data download and first initialization are separate from cached execution. Direct vectorbt imports may compile kernels on first use.</span></div>}
    {importMessage && <p className="px-4 py-2 text-xs" role="status">{importMessage}</p>}
    <div className="zt-report-content">{error && <p role="alert" className="zt-report-error">{error}</p>}
      {!result ? <div className="zt-report-empty"><span>WRITE → BACKTEST → INSPECT</span><h3>A report starts with a testable idea.</h3><p>Write Python in the connected editor, pair the local Windows helper, and run a test against a complete historical dataset. Successful runs retain their source, data and assumptions.</p>{error && <p role="alert">{error}</p>}<button onClick={() => usePanels.getState().open("strategy")}>Open strategy editor →</button></div> : <>
        <div className="zt-report-identity"><strong>{result.name}</strong><span>{result.config.provider} / {result.dataset.symbol} / {result.dataset.timeframe}</span><span>{date(result.dataset.from)} — {date(result.dataset.to)} UTC</span><span>Illustrates historical simulation / not live execution</span></div>
        {tab === "Overview" && <><Metrics result={result} keys={["totalReturn", "netProfit", "maxDrawdown", "totalTrades", "winRate", "profitFactor", "exposure", "openTrades"]} /><SeriesPlot label="Account equity and passive price benchmark" series={[{ values: result.equity.map(p => p.equity), color: "#b79be8", name: "Equity" }, { values: result.equity.map(p => p.benchmark), color: "#70798d", name: "Benchmark before costs" }]} /><ul className="zt-report-observations">{result.observations.map(p => <li key={p}>{p}</li>)}</ul><details><summary>Execution assumptions & reproducibility</summary><ul>{result.assumptions.map(p => <li key={p}>{p}</li>)}</ul><Provenance result={result} /></details></>}
        {tab === "Performance" && <><Metrics result={result} keys={["totalReturn", "cagr", "sharpe", "sortino", "profitFactor", "expectancy", "averageWinner", "averageLoser", "consecutiveWins", "consecutiveLosses"]} /><SeriesPlot label="Equity" series={[{ values: result.equity.map(p => p.equity), color: "#b79be8", name: "Quote-currency equity" }]} /><Histogram label="Closed-trade P&L distribution" values={result.trades.filter(p => p.status === "closed").map(p => p.pnl)} />{result.dataset.to - result.dataset.from >= 28 * 86400000 && <div className="zt-monthly">{result.monthly.map(p => <span key={p.period}>{p.period}<b>{p.return == null ? "Unavailable" : percent(p.return)}</b></span>)}</div>}</>}
        {tab === "Trades" && <TradeList trades={result.trades} result={result} />}
        {tab === "Risk" && <><Metrics result={result} keys={["maxDrawdown", "exposure", "volatility", "downsideVolatility", "sharpe", "sortino", "calmar", "openTrades"]} /><SeriesPlot label="Drawdown from peak equity" series={[{ values: result.equity.map(p => -p.drawdown * 100), color: "#c48491", name: "Drawdown (%)" }]} /><div className="zt-drawdown-list">{result.drawdowns.slice(0, 100).map((p, i) => <p key={i}>{date(p.start)} → {p.recovery ? date(p.recovery) : "Unrecovered"}<b>{percent(p.depth)}</b><span>{number(p.durationMs / 86400000)} days</span></p>)}</div><p className="text-xs text-muted-foreground">Price-based, unlevered simulation. Funding, liquidation, margin and market impact are not modeled.</p></>}
        {tab === "Monte Carlo" && <><p className="zt-method-note">Seeded bootstrap resamples closed-trade account returns with replacement. It assumes independent, identically distributed observations and compounds them from initial capital. This explores the historical sample; it is not a forecast.</p><div className="zt-monte-controls"><label>Seed<input type="number" min={0} max={4294967295} value={seed} onChange={e => setSeed(Number(e.target.value))} /></label><label>Paths<input type="number" min={100} max={5000} step={100} value={simulations} onChange={e => setSimulations(Number(e.target.value))} /></label><button disabled={busy} onClick={() => useResearch.getState().analyze(seed, simulations)}>Generate bootstrap</button></div>{result.monteCarlo && <><div className="zt-method-note">{result.monteCarlo.observations} closed trades / {result.monteCarlo.simulations} paths / seed {result.monteCarlo.seed}. Loss frequency: {percent(result.monteCarlo.probabilityOfLoss)}.{result.monteCarlo.observations < 30 && " Small sample: estimates may be unstable."}</div><SeriesPlot label="Bootstrap equity percentile bands (5 / 50 / 95%)" series={[{ values: result.monteCarlo.bands.map(p => p.lower), color: "#655376", name: "5th percentile" }, { values: result.monteCarlo.bands.map(p => p.median), color: "#c5a4eb", name: "Median" }, { values: result.monteCarlo.bands.map(p => p.upper), color: "#9882b2", name: "95th percentile" }]} /><SeriesPlot label="Twenty bounded sample paths" showLegend={false} series={result.monteCarlo.samplePaths.slice(0, 20).map((values, index) => ({ values, color: index % 2 ? "#5f536b" : "#766484", name: `Sample ${index + 1}` }))} /><Histogram label="Ending equity distribution" values={result.monteCarlo.endingEquity} /><Histogram label="Maximum drawdown distribution (%)" values={result.monteCarlo.maxDrawdowns.map(p => p * 100)} /></>}</>}
        {tab === "Logs" && <><Provenance result={result} /><pre className="zt-report-log">{result.logs.join("\n") || "No strategy output was logged."}</pre><details><summary>Exact executed Python source</summary><pre className="zt-report-log">{result.source}</pre></details><details><summary>Captured parameters</summary><pre className="zt-report-log">{JSON.stringify(result.params, null, 2)}</pre></details></>}
      </>}
    </div>
  </div>;
}

function Metrics({ result, keys }: { result: ResearchResult; keys: string[] }) {
  const fractions = new Set(["totalReturn", "cagr", "maxDrawdown", "winRate", "exposure", "volatility", "downsideVolatility"]);
  return <dl className="zt-report-metrics">{keys.map(key => { const metric = result.metrics[key]; return <div key={key} title={metric?.reason}><dt>{key.replace(/([A-Z])/g, " $1")}</dt><dd>{metric?.value == null ? "—" : fractions.has(key) ? percent(metric.value) : number(metric.value)}</dd>{metric?.value == null && <small>{metric?.reason ?? "Unavailable"}</small>}</div>; })}</dl>;
}
function Provenance({ result }: { result: ResearchResult }) {
  return <dl className="zt-provenance"><dt>Source SHA-256</dt><dd>{result.sourceHash}</dd><dt>Dataset SHA-256</dt><dd>{result.dataset.hash}</dd><dt>Result SHA-256</dt><dd>{result.resultHash}</dd><dt>Engine</dt><dd>{result.engine.engine ? `engine ${result.engine.engine} / ` : ""}Python {result.engine.python} / vectorbt {result.engine.vectorbt} / SDK {result.engine.sdk} / analytics {result.engine.analytics}</dd><dt>Saved locally</dt><dd>{date(result.createdAt)} UTC · {result.dataset.bars.length.toLocaleString()} complete candles</dd></dl>;
}
function SeriesPlot({ label, series, showLegend = true }: { label: string; series: { name: string; values: number[]; color: string }[]; showLegend?: boolean }) {
  const sampled = useMemo(() => series.map(p => ({ ...p, values: p.values.filter((_, i) => i % Math.max(1, Math.ceil(p.values.length / 800)) === 0 || i === p.values.length - 1) })), [series]);
  const all = sampled.flatMap(p => p.values).filter(Number.isFinite);
  if (all.length < 2) return <p className="zt-method-note">{label}: insufficient observations.</p>;
  const min = Math.min(...all), max = Math.max(...all), range = max - min || 1;
  return <figure className="zt-report-plot"><figcaption>{label}{showLegend && <span>{sampled.map(p => <i key={p.name} style={{ color: p.color }}>{p.name}</i>)}</span>}</figcaption><svg viewBox="0 0 900 180" role="img" aria-label={`${label}. Range ${number(min)} to ${number(max)}.`} preserveAspectRatio="none">{[20, 60, 100, 140].map(y => <line key={y} x1="0" x2="900" y1={y} y2={y} stroke="#282631" strokeWidth=".6" />)}{sampled.map(p => <polyline key={p.name} fill="none" stroke={p.color} strokeWidth={showLegend ? "1.5" : ".75"} opacity={showLegend ? 1 : .55} vectorEffect="non-scaling-stroke" points={p.values.map((v, i) => `${i / Math.max(1, p.values.length - 1) * 900},${160 - (v - min) / range * 140}`).join(" ")} />)}</svg><div className="zt-plot-axis"><span>{number(min)}</span><span>Observation order →</span><span>{number(max)}</span></div></figure>;
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
  const [offset, setOffset] = useState(0);
  const selected = useResearch(s => s.selectedTrade);
  const start = Math.max(0, Math.floor(offset / 34) - 5), visible = trades.slice(start, start + 30);
  const trade = trades.find(p => p.id === selected);
  return <><p className="zt-method-note">Select a trade to inspect entry and exit on its archived chart. Times are UTC. Open trades are marked to the final close.</p><div className="zt-trade-heading"><span>Direction</span><span>Entry / UTC</span><span>Exit / UTC</span><span>P&L</span><span>Return</span></div><div className="zt-trade-scroll" onScroll={e => setOffset(e.currentTarget.scrollTop)} role="table" aria-label="Archived trades" aria-rowcount={trades.length}><div style={{ height: trades.length * 34, position: "relative" }}>{visible.map((p, i) => <button role="row" aria-rowindex={start + i + 1} aria-selected={p.id === selected} key={p.id} className="zt-trade-row" style={{ top: (start + i) * 34 }} onClick={() => { useResearch.setState({ chartResult: result, selectedTrade: p.id }); usePanels.getState().open("chart"); }}><span role="cell">{p.side}</span><span role="cell">{date(p.entryTime)}</span><span role="cell">{p.exitTime ? date(p.exitTime) : "Open"}</span><span role="cell">{number(p.pnl)}</span><span role="cell">{percent(p.return)}</span></button>)}</div></div>{trade && <p className="zt-method-note">Entry {number(trade.entryPrice)} / exit or mark {number(trade.exitPrice)} / quantity {number(trade.quantity)} / multiplier {result.config.multiplier} / fees {number(trade.fees)} / account return {trade.accountReturn == null ? "Unavailable (nonpositive prior equity)" : percent(trade.accountReturn)}</p>}</>;
}
