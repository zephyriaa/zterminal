/** Explicit public-network check, excluded from the offline *.test.ts suite. */
import assert from "node:assert/strict";
import { OKXFuturesProvider } from "../mini-services/market-data/okx-provider";
import { tradeGranularity } from "../src/lib/market/trade-units";

async function main() {
  const provider = new OKXFuturesProvider(), started = Date.now();
  const counts = { trade: 0, quote: 0, depth: 0 };
  let contractMultiplier: number | undefined;
  provider.on(event => {
    if (event.type === "trade" || event.type === "quote" || event.type === "depth") {
      assert.equal(event.data.provider, "okx"); assert.equal(event.data.symbol, "BTC-USDT-SWAP"); counts[event.type]++;
      if (event.type === "trade") { assert.equal(event.data.quantityUnit, "contracts"); assert.equal(tradeGranularity(event.data), "aggregate"); contractMultiplier = event.data.contractMultiplier; }
    }
  });
  try {
    const contracts = await provider.discoverContracts();
    assert.ok(contracts.some(contract => contract.symbol === "BTC-USDT-SWAP" && contract.verified));
    await provider.subscribe("BTC-USDT-SWAP");
    const until = Date.now() + 25_000;
    while (Date.now() < until && (counts.trade < 10 || counts.depth < 10 || provider.health("BTC-USDT-SWAP").state !== "LIVE")) await new Promise(resolve => setTimeout(resolve, 100));
    const health = provider.health("BTC-USDT-SWAP");
    console.log(JSON.stringify({ scope: "public-read-only", provider: "okx", symbol: "BTC-USDT-SWAP", catalogueSize: contracts.length, elapsedMs: Date.now() - started, counts, contractMultiplier, health }));
    assert.ok(counts.trade >= 10 && counts.depth >= 10 && counts.quote >= 10, "Insufficient OKX public observations");
    assert.equal(health.state, "LIVE");
  } finally { provider.close(); }
}

main().catch(error => { console.error(error instanceof Error ? error.message : "OKX live check failed"); process.exitCode = 1; });
