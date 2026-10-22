import assert from "node:assert/strict";
import test from "node:test";
import { restoreCachedChartHistory } from "../src/lib/market/bar-cache";
import { fetchPublicBars, publicFetch } from "../src/lib/market/public-data";

test("concurrent public consumers share a request and retain independent response bodies", async () => {
  const before = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; return Response.json({ value: 12 }); };
  try {
    const [a, b] = await Promise.all([publicFetch("https://coalesce.test/data"), publicFetch("https://coalesce.test/data")]);
    assert.deepEqual(await a.json(), { value: 12 }); assert.deepEqual(await b.json(), { value: 12 });
    assert.equal(calls, 1);
  } finally { globalThis.fetch = before; }
});

test("a rate limit prevents immediate additional requests and explains recovery", async () => {
  const before = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; return new Response("limited", { status: 429, headers: { "Retry-After": "120" } }); };
  try {
    await assert.rejects(publicFetch("https://limited.test/data"), /rate-limited.*429/);
    await assert.rejects(publicFetch("https://limited.test/other"), /retry in 1[12][0-9] seconds/);
    assert.equal(calls, 1);
  } finally { globalThis.fetch = before; }
});

test("direct history preserves exact venue, units and exclusive cutoff without server routes", async () => {
  const before = globalThis.fetch;
  const urls: string[] = [];
  globalThis.fetch = async input => {
    const url = String(input); urls.push(url);
    if (url.includes("/contracts/")) return Response.json({ name: "BTC_USDT", quanto_multiplier: "0.0001", order_price_round: "0.1", enable_decimal: false });
    return Response.json([{ t: "900", o: "10", h: "11", l: "9", c: "10", v: "2" }]);
  };
  try {
    const result = await fetchPublicBars("gateio", "BTCUSDT", "5m", 1200000, 1);
    assert.equal(result.nativeSymbol, "BTC_USDT"); assert.equal(result.effectiveProvider, "gateio");
    assert.equal(result.requestedTo, 1200000); assert.equal(result.volumeUnit, "contracts");
    const saved = restoreCachedChartHistory(result, "gateio", "BTCUSDT", "5m", 1500000, 1, true);
    assert.equal(saved?.dataStatus, "STALE"); assert.equal(saved?.requestedTo, 1200000);
    assert.equal(restoreCachedChartHistory(result, "gateio", "BTCUSDT", "5m", 1500000, 1), null);
    assert.equal(restoreCachedChartHistory(result, "gateio", "BTCUSDT", "5m", 900000, 1, true), null);
    assert.equal(restoreCachedChartHistory(result, "binance", "BTCUSDT", "5m", 1500000, 1, true), null);
    assert.equal(restoreCachedChartHistory({ ...result, volumeUnit: "base" }, "gateio", "BTCUSDT", "5m", 1500000, 1, true), null);
    assert.equal(result.gapCount, 0); assert.equal(result.contract.multiplier, 0.0001);
    assert.deepEqual(result.bars.map(bar => bar.t), [900000]);
    assert.ok(urls.every(url => url.startsWith("https://api.gateio.ws/")));
  } finally { globalThis.fetch = before; }
});
