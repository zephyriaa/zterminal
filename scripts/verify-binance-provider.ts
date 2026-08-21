import { BinanceFuturesProvider } from "../mini-services/market-data/binance-provider";

async function main() {
  const provider = new BinanceFuturesProvider();
  const counts = { trade: 0, quote: 0, depth: 0, derivatives: 0, liquidation: 0, status: 0 };
  const statuses: unknown[] = [];
  provider.on((event) => {
    counts[event.type] += 1;
    if (event.type === "status" && statuses.length < 20) statuses.push(event);
  });

  await provider.discoverContracts();
  await provider.subscribe("BTCUSDT");
  setTimeout(() => {
    provider.close();
    console.log(JSON.stringify({ counts, statuses }, null, 2));
    process.exit(counts.depth > 0 ? 0 : 1);
  }, 15_000);
}

void main();
