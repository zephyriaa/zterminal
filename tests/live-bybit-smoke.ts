/** Explicit public-network check; not included in the offline *.test.ts suite. */
import assert from "node:assert/strict";
import { BybitFuturesProvider } from "../mini-services/market-data/bybit-provider";

const provider = new BybitFuturesProvider();
const startedAt = Date.now();
const counts = { trade: 0, quote: 0, depth: 0 };
let firstTradeId: string | undefined;
provider.on(event => {
  if (event.type === "trade" || event.type === "quote" || event.type === "depth") {
    assert.equal(event.data.provider, "bybit");
    assert.equal(event.data.symbol, "BTCUSDT");
    counts[event.type]++;
    if (event.type === "trade") firstTradeId ??= event.data.eventId;
  }
});

async function main() {
  try {
    const contracts = await provider.discoverContracts();
    assert.ok(contracts.some(contract => contract.symbol === "BTCUSDT" && contract.verified));
    await provider.subscribe("BTCUSDT");
    const until = Date.now() + 25_000;
    while (Date.now() < until && (counts.trade < 10 || counts.depth < 10 || provider.health("BTCUSDT").state !== "LIVE")) await new Promise(resolve => setTimeout(resolve, 100));
    const health = provider.health("BTCUSDT");
    console.log(JSON.stringify({ environment: "public-read-only", provider: "bybit", symbol: "BTCUSDT", catalogueSize: contracts.length, elapsedMs: Date.now() - startedAt, counts, firstTradeId, health }));
    assert.ok(counts.trade >= 10 && counts.depth >= 10 && counts.quote >= 10, "Insufficient public observations");
    assert.equal(health.state, "LIVE");
  } finally { provider.close(); }
}

main().catch(error => { console.error(error instanceof Error ? error.message : "Bybit smoke failed"); process.exitCode = 1; });
