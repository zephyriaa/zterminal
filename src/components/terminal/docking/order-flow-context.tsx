"use client";

import { useMemo, type ReactNode } from "react";
import type { MarketStream } from "@/hooks/use-market-stream";
import type { ContractMetadata, DepthEvent } from "@/lib/market/types";
import { buildOrderFlowContext, ORDER_FLOW_INPUTS, ORDER_FLOW_LAYERS, sanitizeOrderFlowSettings, type OrderFlowContextSettings } from "@/lib/market/order-flow-context";
import { ORDER_FLOW_CALCULATION_VERSION } from "@/lib/market/order-flow";

const number = (value: number | null | undefined) => value == null || !Number.isFinite(value) ? "Unavailable" : value.toLocaleString(undefined, { maximumFractionDigits: 8 });
const time = (value: number) => new Date(value).toISOString().slice(11, 23);

export function OrderFlowContext({ stream, contract, settings, visible, configurable, scopeKey, onChange, onVisible, onRemove }: {
  stream: MarketStream; contract: ContractMetadata; settings: OrderFlowContextSettings; visible: boolean; configurable: boolean; scopeKey: string;
  onChange: (settings: OrderFlowContextSettings) => void; onVisible: () => void; onRemove: () => void;
}) {
  const enabled = new Set(settings.layers);
  const verified = contract.verified === true || stream.provider === "mock";
  const tradesReady = verified && ["LIVE", "SIMULATED"].includes(stream.tradeStatus ?? stream.dataStatus);
  const depthReady = verified && ["LIVE", "SIMULATED"].includes(stream.depthStatus ?? stream.dataStatus);
  const available = stream.state === "connected" && (tradesReady || depthReady);
  return <section aria-label="Order-flow context" className="border-t hairline p-3 space-y-3">
    <div className="flex flex-wrap justify-between gap-2"><b>Order-flow context</b><div className="flex gap-2"><button type="button" disabled={!configurable} onClick={onVisible}>{visible ? "Hide all" : "Show selected"}</button><button type="button" disabled={!configurable} onClick={onRemove}>Remove all</button></div></div>
    <p>Primary live market · {stream.provider}/{stream.nativeSymbol ?? "unavailable"} · {stream.dataStatus}. These observations do not replay an archived candle chart.</p>
    <p role="status">Trades: {stream.tradeStatus ?? stream.dataStatus} · Depth: {stream.depthStatus ?? stream.dataStatus}. {stream.health?.streams?.depth.reason}</p>
    {!configurable && <p role="status">Controls are unavailable until saved preferences and instrument metadata are ready. Existing settings are retained.</p>}
    <fieldset disabled={!configurable} className="grid grid-cols-2 gap-2" aria-label="Order-flow layers">{ORDER_FLOW_LAYERS.map(layer => <label key={layer.id} className="flex items-start gap-2"><input type="checkbox" checked={enabled.has(layer.id)} onChange={event => onChange(sanitizeOrderFlowSettings({ ...settings, layers: event.target.checked ? [...settings.layers, layer.id] : settings.layers.filter(id => id !== layer.id) }))} />{layer.label}</label>)}</fieldset>
    <details><summary>Window and calculation settings</summary><p>Press Enter or leave a field to apply.</p><fieldset disabled={!configurable} className="space-y-2 mt-2">{ORDER_FLOW_INPUTS.map(input => <label key={input.id} className="flex flex-wrap justify-between gap-2">{input.label}<input key={`${input.id}:${settings[input.id]}`} className="w-24 border hairline bg-transparent" type="number" min={input.min} max={input.max} step={input.step} defaultValue={settings[input.id]} onKeyDown={event => { if (event.key === "Enter") event.currentTarget.blur(); }} onBlur={event => { const raw = event.currentTarget.value; if (!raw.trim() || !Number.isFinite(Number(raw))) { event.currentTarget.value = String(settings[input.id]); return; } const next = sanitizeOrderFlowSettings({ ...settings, [input.id]: Number(raw) }); event.currentTarget.value = String(next[input.id]); onChange(next); }} /></label>)}</fieldset></details>
    <p>Only settings persist. Latest 2,000 observed prints and 120 observed book frames at most; no complete-session or historical coverage is implied. L2 is price-aggregated, not MBO. Calculation {ORDER_FLOW_CALCULATION_VERSION}.</p>
    {!visible || !settings.layers.length ? <p role="status">Select layers to start an observed window.</p> : !available ? <p role="status">Unavailable: {stream.reason ?? stream.health?.reason ?? "the selected market feed is not verified and fresh"}. Dependent outputs are withheld.</p> : <ObservedFlow key={`${scopeKey}:${stream.provider}:${stream.nativeSymbol}`} stream={stream} contract={contract} settings={settings} tradesReady={tradesReady} depthReady={depthReady} />}
  </section>;
}

function ObservedFlow({ stream, contract, settings, tradesReady, depthReady }: { stream: MarketStream; contract: ContractMetadata; settings: OrderFlowContextSettings; tradesReady: boolean; depthReady: boolean }) {
  const heatmap = settings.layers.includes("heatmap"), depth = stream.depthSnapshot;
  const now = stream.observation?.now || stream.retrievedAt || Date.now();
  const result = useMemo(() => {
    try { return { model: stream.observations
      ? stream.observations.context(settings, contract.tickSize, tradesReady, depthReady, now, stream.observation)
      : buildOrderFlowContext({ provider: stream.provider, symbol: stream.nativeSymbol ?? "", available: tradesReady, depthAvailable: depthReady, trades: stream.trades, depth: stream.depthSnapshot, tickSize: contract.tickSize, now, settings }), error: "" }; }
    catch (error) { return { model: null, error: (error as Error).message }; }
  }, [stream.observation, stream.observations, stream.provider, stream.nativeSymbol, stream.trades, stream.depthSnapshot, contract.tickSize, now, settings, tradesReady, depthReady]);
  const model = result.model;
  if (!model) return <p role="status">Unavailable: {result.error}</p>;
  const enabled = new Set(settings.layers), displayedFrames = (depthReady ? stream.observation?.frames ?? (depth ? [depth] : []) : []).filter(frame => frame.timestamp >= now - settings.windowSeconds * 1000 && frame.timestamp <= now);
  return <div className="space-y-4" aria-label="Observed order-flow outputs">
    <p>{model.tradeCount} retained prints · quantity {model.quantityUnit} · messages {model.granularities.join(" / ") || "unavailable"} · {model.from == null ? "waiting for observed trades" : `${time(model.from)}–${time(model.to!)} UTC`}{model.capped ? " · capped; earlier prints excluded" : ""}.</p>
    {(enabled.has("cvd") || enabled.has("delta")) && <section><b>{enabled.has("cvd") ? "Rolling CVD / delta" : "Trade delta"}</b><p>Buy minus sell native quantity. CVD starts at zero at the oldest retained print and is rebased as the rolling window advances.</p>{model.cvd.length ? <><FlowTable headings={["UTC bucket", "Buy", "Sell", "Delta", ...(enabled.has("cvd") ? ["CVD"] : [])]}>{model.cvd.map(point => <tr key={point.timestamp}><td>{time(point.timestamp)}</td><td>{number(point.buyVolume)}</td><td>{number(point.sellVolume)}</td><td>{number(point.delta)}</td>{enabled.has("cvd") && <td>{number(point.value)}</td>}</tr>)}</FlowTable></> : <p role="status">Unavailable: no observed classified trades in this window.</p>}</section>}
    {enabled.has("footprint") && <section><b>Footprint · {settings.tickGrouping} tick grouping</b>{model.footprint.length ? <FlowTable headings={["UTC bucket", "Price", "Buy", "Sell", "Delta"]}>{model.footprint.flatMap(bucket => bucket.levels.map(level => <tr key={`${bucket.timestamp}:${level.price}`}><td>{time(bucket.timestamp)}</td><td>{number(level.price)}</td><td>{number(level.buyVolume)}</td><td>{number(level.sellVolume)}</td><td>{number(level.delta)}</td></tr>))}</FlowTable> : <p role="status">Unavailable: no observed classified trades.</p>}</section>}
    {enabled.has("trade-profile") && <section><b>Observed trade profile · {settings.tickGrouping} tick grouping</b><p>Executed-message quantities at observed prices. Aggregate messages do not identify individual fills; no candle volume is substituted.</p>{model.tradeProfile.length ? <FlowTable headings={["Price", "Buy", "Sell", "Total"]}>{model.tradeProfile.map(level => <tr key={level.price}><td>{number(level.price)}</td><td>{number(level.buyVolume)}</td><td>{number(level.sellVolume)}</td><td>{number(level.totalVolume)}</td></tr>)}</FlowTable> : <p role="status">Unavailable: no trade-price observations.</p>}</section>}
    {enabled.has("imbalance") && <section><b>Top-{settings.bookLevels} L2 imbalance</b><p>{number(model.imbalance?.value)} · bid quantity {number(model.imbalance?.bidDepth)} / ask {number(model.imbalance?.askDepth)}. (Bid − ask) / (bid + ask); requires a fresh two-sided book.</p></section>}
    {enabled.has("microprice") && <section><b>Microprice estimate</b><p>{number(model.microprice?.value)} · opposite price weighted by best-level sizes; an estimate, not an executable fill.</p></section>}
    {heatmap && <section><b>Observed L2 liquidity heatmap</b><p>Up to 20 nearest levels per side, 120 actual snapshots. Columns mark observations only; missing intervals are blank and do not imply zero liquidity. Quantities are in the venue's native book units.</p>{displayedFrames.length ? <DepthHeatmap frames={displayedFrames} /> : <p role="status">Unavailable: waiting for verified depth snapshots.</p>}</section>}
    {(enabled.has("absorption") || enabled.has("sweeps")) && <section><b>Absorption / sweep candidates</b><p>Derived trade-flow estimates, not evidence of resting-order absorption or trading signals. Minimum {settings.minimumVolume} native quantity, dominance {settings.dominance}, sweep {settings.sweepLevels} prices, absorption range ≤ {settings.absorptionTicks} grouped ticks; same observed window.</p>{!model.tradeCount ? <p role="status">Unavailable: no observed classified trades.</p> : model.candidates.length ? model.candidates.map(event => <article key={event.id} className="border hairline p-2"><p>{event.summary}</p><p>{time(event.timestamp)} UTC · {event.source.tradeCount} prints · delta {number(event.metrics.delta)} · quote notional {number(event.metrics.notional)} · {event.calculationVersion}</p></article>) : <p>No candidate meets these thresholds in the observed window.</p>}</section>}
    <p>Book source {depth ? `${time(depth.timestamp)} UTC / sequence ${depth.sequence}` : "unavailable"}. Source freshness and gaps gate these outputs. Recorded replay requires a validated event manifest; candle archives cannot supply it.</p>
  </div>;
}

function FlowTable({ headings, children }: { headings: string[]; children: ReactNode }) {
  return <div className="max-h-56 overflow-auto"><table><thead><tr>{headings.map(heading => <th key={heading}>{heading}</th>)}</tr></thead><tbody>{children}</tbody></table></div>;
}

export function DepthHeatmap({ frames }: { frames: readonly DepthEvent[] }) {
  const levels = frames.flatMap(frame => frame.levels), prices = levels.map(level => level.price);
  if (!levels.length) return <p role="status">Unavailable: no observed price levels.</p>;
  const low = Math.min(...prices), high = Math.max(...prices), maximum = Math.max(...levels.map(level => level.size));
  const first = frames[0].timestamp, last = frames.at(-1)!.timestamp;
  const x = (timestamp: number) => 55 + (timestamp - first) / Math.max(1, last - first) * 435;
  const y = (price: number) => 145 - (price - low) / Math.max(Number.EPSILON, high - low) * 130;
  return <svg viewBox="0 0 500 175" role="img" aria-label="Actual observed L2 snapshots, price versus UTC source time" className="w-full bg-background">
    <text x="2" y="16" fill="currentColor" fontSize="9">{number(high)}</text><text x="2" y="145" fill="currentColor" fontSize="9">{number(low)}</text>
    {frames.flatMap(frame => frame.levels.map(level => <rect key={`${frame.sequence}:${level.side}:${level.price}`} x={x(frame.timestamp)} y={y(level.price) - 1} width="2" height="2" fill={level.side === "buy" ? "#38bdf8" : "#fb7185"} opacity={maximum ? .15 + .85 * level.size / maximum : 0}><title>{time(frame.timestamp)} UTC · {level.side} {level.price} × {level.size}</title></rect>))}
    <text x="55" y="169" fill="currentColor" fontSize="9">{time(first)} UTC</text><text x="490" y="169" textAnchor="end" fill="currentColor" fontSize="9">{time(last)} UTC</text>
  </svg>;
}
