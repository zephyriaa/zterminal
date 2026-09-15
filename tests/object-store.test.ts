import assert from "node:assert/strict";
import test from "node:test";
import { ArtifactStore, LocalDiskObjectStore, MarketDataStore } from "../src/lib/storage/object-store";
import path from "node:path";
import fs from "node:fs/promises";

const TEST_DIR = path.resolve(process.cwd(), "data/test-storage");

test("MarketDataStore partitions keys correctly", () => {
  const store = new MarketDataStore(new LocalDiskObjectStore(TEST_DIR));
  const key = store.getPartitionKey("binance", "BTCUSDT", "1m", 2025);
  assert.equal(key, "historical/binance/BTCUSDT/1m/2025.parquet");
});

test("ArtifactStore stores and retrieves JSON artifacts", async () => {
  const underlying = new LocalDiskObjectStore(TEST_DIR);
  const store = new ArtifactStore(underlying);

  const payload = {
    metrics: { sharpe: 2.15, maxDrawdown: 0.12 },
    trades: [{ id: "1", pnl: 450 }],
  };

  const key = await store.storeArtifact("ws-123", "backtest", "art-456", payload);
  assert.equal(key, "artifacts/ws-123/backtest/art-456.json");

  const exists = await store.hasArtifact("ws-123", "backtest", "art-456");
  assert.equal(exists, true);

  const retrieved = await store.getArtifact<typeof payload>("ws-123", "backtest", "art-456");
  assert.deepEqual(retrieved, payload);

  await store.deleteArtifact("ws-123", "backtest", "art-456");
  const existsAfter = await store.hasArtifact("ws-123", "backtest", "art-456");
  assert.equal(existsAfter, false);

  // Clean up test dir
  await fs.rm(TEST_DIR, { recursive: true, force: true });
});
