"use client";

import { useEffect, useMemo, useState } from "react";
import { useMarketStream } from "@/hooks/use-market-stream";
import { useWorkspace } from "@/stores/workspace";
import { useMarketContract } from "@/hooks/use-market-contract";
import { pricePrecision } from "@/lib/market/contracts";
import { chartDocumentKey, PRIMARY_CHART_ID } from "@/lib/chart/contracts";
import { CHART_OVERLAY_SCHEMA_VERSION } from "@/lib/chart/overlays/contracts";
import { DEFAULT_ORDER_FLOW_SETTINGS, ORDER_FLOW_CONTEXT_ID, sanitizeOrderFlowSettings } from "@/lib/market/order-flow-context";
import { useChartDocuments } from "@/stores/chart-documents";
import type { Timeframe } from "@/lib/market/types";
import { OrderFlowContext } from "./order-flow-context";

export function OrderbookPanel() {
  const { symbol, activeWorkspaceId, timeframe } = useWorkspace();
  const stream = useMarketStream(symbol, { trades: 2000, depth: true });
  const { depth, state, provider, dataStatus, reason } = stream;
  const contract = useMarketContract(symbol, provider);
  const seed = useMemo(() => ({ workspaceId: activeWorkspaceId, chartId: PRIMARY_CHART_ID, instrument: { provider, exchange: contract.exchange, product: contract.product, nativeSymbol: contract.verified ? contract.symbol : stream.nativeSymbol ?? symbol }, timeframe: timeframe as Timeframe }), [activeWorkspaceId, provider, contract, stream.nativeSymbol, symbol, timeframe]);
  const documentId = chartDocumentKey(activeWorkspaceId, PRIMARY_CHART_ID, seed.instrument);
  const document = useChartDocuments(current => current.documents[documentId]);
  const context = document?.overlays.find(overlay => overlay.id === ORDER_FLOW_CONTEXT_ID && overlay.type === "order-flow-context");
  const settings = useMemo(() => sanitizeOrderFlowSettings(context?.settings ?? DEFAULT_ORDER_FLOW_SETTINGS), [context?.settings]);
  const [preferencesReady, setPreferencesReady] = useState(false);
  useEffect(() => {
    let disposed = false;
    void Promise.resolve(useChartDocuments.persist.hasHydrated() ? undefined : useChartDocuments.persist.rehydrate()).then(() => { if (!disposed) setPreferencesReady(useChartDocuments.persist.hasHydrated()); });
    return () => { disposed = true; };
  }, []);
  const live = contract.verified === true && state === "connected" && (stream.depthStatus ?? dataStatus) === "LIVE";
  const levels = live
    ? depth.filter(level => Number.isFinite(level.price) && Number.isFinite(level.size) && level.size > 0)
    : [];
  const asks = levels.filter(level => level.side === "sell").sort((a, b) => a.price - b.price).slice(0, 12).reverse();
  const bids = levels.filter(level => level.side === "buy").sort((a, b) => b.price - a.price).slice(0, 12);
  const digits = Math.max(2, pricePrecision(contract.tickSize));

  const emptyStatusTitle = !live
    ? !contract.verified ? "UNVERIFIED INSTRUMENT" : stream.health?.streams?.depth ? `DEPTH: ${stream.health.streams.depth.state}` : dataStatus === "UNAVAILABLE"
      ? "UNAVAILABLE"
      : "FEED: DISCONNECTED"
    : "No verified depth available";

  return (
    <section className="zt-orderbook overflow-y-auto" aria-label="Live order book" data-testid="orderbook-panel">
      <header>
        <b>{symbol}</b>
        <span>{provider ?? "No provider"} · {live ? dataStatus : emptyStatusTitle}</span>
      </header>
      {!levels.length ? (
        <div className="zt-dock-empty" role="status">
          <b>{emptyStatusTitle}</b>
          <p>{stream.health?.streams?.depth.reason ?? reason ?? (!live ? "Exchange WebSocket disconnected or feed unavailable." : "Depth has not been verified for the selected venue and instrument.")}</p>
        </div>
      ) : (
        <table>
          <caption className="sr-only">Live bid and ask levels for {symbol}</caption>
          <thead>
            <tr>
              <th>Side</th>
              <th>Price</th>
              <th>Size</th>
            </tr>
          </thead>
          <tbody>
            {[...asks, ...bids].map(level => (
              <tr key={level.side + level.price} className={level.side === "buy" ? "is-bid" : "is-ask"}>
                <td>{level.side === "buy" ? "Bid" : "Ask"}</td>
                <td>{level.price.toLocaleString("en-US", { maximumFractionDigits: digits })}</td>
                <td>{level.size.toLocaleString("en-US", { maximumFractionDigits: 6 })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <OrderFlowContext scopeKey={documentId} stream={stream} contract={contract} settings={settings} visible={context?.visible === true} configurable={preferencesReady && (contract.verified === true || provider === "mock")}
        onChange={next => { const id = useChartDocuments.getState().ensure(seed); useChartDocuments.getState().setOverlay(id, { schemaVersion: CHART_OVERLAY_SCHEMA_VERSION, id: ORDER_FLOW_CONTEXT_ID, type: "order-flow-context", visible: true, zIndex: 0, settings: next }); }}
        onVisible={() => { if (context) useChartDocuments.getState().setOverlay(documentId, { ...context, visible: !context.visible }); }}
        onRemove={() => useChartDocuments.getState().removeOverlay(documentId, ORDER_FLOW_CONTEXT_ID)} />
      <footer>{contract.exchange} · {contract.product} · Tick {contract.tickSize}</footer>
    </section>
  );
}
