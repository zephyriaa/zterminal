import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FeedInspector } from "../src/components/terminal/feed-inspector";
import { useWorkspace } from "../src/stores/workspace";

test("feed inspector recognizes the implemented Bybit individual trade stream", () => {
  const markup = renderToStaticMarkup(createElement(FeedInspector, { provider: "bybit", effectiveProvider: "bybit", gatewayProvider: "bybit", dataStatus: "LIVE", health: null }));
  assert.match(markup, /Individual public trades/);
});

test("gateway recovery clears the preceding wait reason when the live state omits it", async () => {
  const socketIo = createRequire(import.meta.url)("socket.io-client"), original = socketIo.io;
  const handlers = new Map<string, (value: unknown) => void>();
  const socket = { on(name: string, listener: (value: unknown) => void) { handlers.set(name, listener); return socket; }, emit() {}, disconnect() {}, removeAllListeners() { handlers.clear(); } };
  socketIo.io = () => socket;
  const previous = useWorkspace.getState().marketProvider;
  const reason = () => { const connection = useWorkspace.getState().connection; return "reason" in connection ? connection.reason : undefined; };
  let remove = () => {};
  try {
    const { subscribeMarketTrades } = await import("../src/hooks/use-market-stream");
    useWorkspace.getState().setMarketProvider("bybit");
    remove = subscribeMarketTrades("BTCUSDT", () => {});
    handlers.get("state")!({ provider: "bybit", environment: "live", state: "degraded", dataStatus: "DEGRADED", reason: "Waiting for fresh data" });
    assert.equal(reason(), "Waiting for fresh data");
    handlers.get("state")!({ provider: "bybit", environment: "live", state: "live", dataStatus: "LIVE" });
    assert.equal(reason(), undefined);
  } finally { remove(); useWorkspace.getState().setMarketProvider(previous); socketIo.io = original; }
});
