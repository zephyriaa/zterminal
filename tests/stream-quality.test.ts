import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { freshFeedHealth } from "../src/lib/market/provenance";
import { OrderFlowSession } from "../src/lib/market/order-flow-session";

test("legacy health loss clears observations; explicit depth-only loss preserves healthy trades", () => {
  const tree = ts.createSourceFile("stream.ts", readFileSync(new URL("../src/hooks/use-market-stream.ts", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true);
  let callback = "";
  function visit(node: ts.Node) { if (ts.isVariableDeclaration(node) && node.name.getText(tree) === "receiveHealth") callback = node.initializer!.getText(tree); ts.forEachChild(node, visit); }
  visit(tree); assert.ok(callback);
  const session = new OrderFlowSession("binance", "BTCUSDT", "live");
  const trade = { type: "trade" as const, provider: "binance" as const, exchange: "BINANCE" as const, environment: "live" as const, symbol: "BTCUSDT", timestamp: 1000, sequence: 1, price: 100, quantity: 2, side: "buy" as const };
  const acceptingTrades = { current: true };
  const read = vm.runInNewContext(ts.transpileModule(`(${callback})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, {
    freshFeedHealth, session, provider: "binance", acceptingTrades, setHealth() {},
  });
  session.pushTrade(trade);
  read({ provider: "binance", symbol: "BTCUSDT", state: "GAP_DETECTED", updatedAt: Date.now() });
  assert.equal(session.trades.length, 0); assert.equal(acceptingTrades.current, false);
  session.pushTrade({ ...trade, sequence: 2 });
  read({ provider: "binance", symbol: "BTCUSDT", state: "GAP_DETECTED", updatedAt: Date.now(), streams: { trades: { state: "LIVE", lastMessageAt: Date.now() }, depth: { state: "GAP_DETECTED" } } });
  assert.equal(session.trades.length, 1); assert.equal(acceptingTrades.current, true); assert.equal(session.depth, null);
  session.dispose();
});
