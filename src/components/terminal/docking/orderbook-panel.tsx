"use client";
import { useMarketStream } from "@/hooks/use-market-stream";
import { useWorkspace } from "@/stores/workspace";
import { getContract } from "@/lib/market/contracts";
export function OrderbookPanel() {
  const symbol = useWorkspace(state => state.symbol);
  const { depth, state, provider, dataStatus, reason } = useMarketStream(symbol, { trades: 1, depth: true });
  const contract = getContract(symbol);
  const live = state === "connected" && dataStatus === "LIVE";
  const levels = live ? depth.filter(level => Number.isFinite(level.price) && Number.isFinite(level.size) && level.size > 0) : [];
  const asks = levels.filter(level => level.side === "sell").sort((a, b) => a.price - b.price).slice(0, 12).reverse();
  const bids = levels.filter(level => level.side === "buy").sort((a, b) => b.price - a.price).slice(0, 12);
  const digits = Math.max(2, Math.min(8, Math.ceil(-Math.log10(contract.tickSize))));
  return <section className="zt-orderbook" aria-label="Live order book" data-testid="orderbook-panel">
    <header><b>{symbol}</b><span>{provider ?? "No provider"} · {dataStatus}</span></header>
    {!levels.length ? <div className="zt-dock-empty" role="status"><b>{live ? "No depth available" : "Depth feed disconnected"}</b><p>{reason ?? "Order book levels appear when the selected market supplies live depth."}</p></div> : <table><caption className="sr-only">Live bid and ask levels for {symbol}</caption><thead><tr><th>Side</th><th>Price</th><th>Size</th></tr></thead><tbody>{[...asks, ...bids].map(level => <tr key={level.side + level.price} className={level.side === "buy" ? "is-bid" : "is-ask"}><td>{level.side === "buy" ? "Bid" : "Ask"}</td><td>{level.price.toLocaleString("en-US", { maximumFractionDigits: digits })}</td><td>{level.size.toLocaleString("en-US", { maximumFractionDigits: 6 })}</td></tr>)}</tbody></table>}
    <footer>{contract.exchange} · {contract.product} · Tick {contract.tickSize}</footer>
  </section>;
}
