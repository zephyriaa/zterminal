import assert from "node:assert/strict";
import test from "node:test";
import config from "../next.config";

test("terminal CSP allows configured market providers and exact loopback gateway origins", async () => {
  const rules = await config.headers!();
  const terminal = rules.find(rule => rule.source === "/terminal")!;
  const csp = terminal.headers.find(header => header.key === "Content-Security-Policy")!.value;
  const connect = csp.split(";").find(directive => directive.trim().startsWith("connect-src"))!;
  const origins = connect.trim().split(/\s+/);
  for (const origin of ["http://localhost:3003", "ws://localhost:3003", "http://127.0.0.1:3003", "ws://127.0.0.1:3003", "http://127.0.0.1:47321", "https://fapi.binance.com", "wss://ws.okx.com:8443", "wss://stream.bybit.com", "wss://advanced-trade-ws.coinbase.com", "wss://fx-ws.gateio.ws"]) assert.ok(origins.includes(origin), origin);
  assert.ok(!origins.includes("*") && !origins.includes("ws:") && !origins.includes("http:"));
});
