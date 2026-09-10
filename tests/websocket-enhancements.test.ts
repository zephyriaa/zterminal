import test from "node:test";
import assert from "node:assert/strict";
import {
  BackoffCalculator,
  StreamHealthMonitor,
  MicroBurstCoalescer,
  SubscriptionRecoveryManager,
} from "../src/lib/market/streaming-enhancements";

test("BackoffCalculator calculates exponential delays with jitter and resets", () => {
  const calc = new BackoffCalculator({
    initialDelayMs: 100,
    maxDelayMs: 2000,
    factor: 2.0,
    jitterRatio: 0.1, // +/- 10%
  });

  const d1 = calc.nextDelay();
  assert.ok(d1 >= 90 && d1 <= 110, `d1 ${d1} should be near 100`);
  assert.equal(calc.getAttempt(), 1);

  const d2 = calc.nextDelay();
  assert.ok(d2 >= 180 && d2 <= 220, `d2 ${d2} should be near 200`);

  const d3 = calc.nextDelay();
  assert.ok(d3 >= 360 && d3 <= 440, `d3 ${d3} should be near 400`);

  calc.reset();
  assert.equal(calc.getAttempt(), 0);
  const dReset = calc.nextDelay();
  assert.ok(dReset >= 90 && dReset <= 110);
});

test("StreamHealthMonitor tracks telemetry, jitter, sequence gaps, and status transitions", () => {
  const monitor = new StreamHealthMonitor(150, 500);

  monitor.recordPing(50);
  monitor.recordPing(60);
  monitor.recordPing(55);

  let telem = monitor.getTelemetry();
  assert.equal(telem.latencyMs, 55);
  assert.ok(telem.jitterMs > 0);
  assert.equal(telem.status, "HEALTHY");

  // Track sequence packets
  monitor.recordPacket(1);
  monitor.recordPacket(2);
  monitor.recordPacket(5); // gap of 2 packets (missing 3, 4)

  telem = monitor.getTelemetry();
  assert.equal(telem.sequenceGaps, 2);
  assert.equal(telem.status, "DEGRADED");

  // High latency trigger
  monitor.recordPing(2000);
  monitor.recordPing(2000);
  telem = monitor.getTelemetry();
  assert.equal(telem.status, "CRITICAL");
});

test("MicroBurstCoalescer batches ticks and flushes correctly", async () => {
  let flushedBatches: number[][] = [];
  const coalescer = new MicroBurstCoalescer<number>(20, (items) => {
    flushedBatches.push(items);
  });

  coalescer.push(1);
  coalescer.push(2);
  coalescer.push(3);
  assert.equal(coalescer.size(), 3);

  await new Promise((r) => setTimeout(r, 40));

  assert.equal(flushedBatches.length, 1);
  assert.deepEqual(flushedBatches[0], [1, 2, 3]);
  assert.equal(coalescer.size(), 0);
});

test("SubscriptionRecoveryManager preserves active channels and manifests across reconnects", () => {
  const mgr = new SubscriptionRecoveryManager();

  mgr.subscribe("BTCUSDT", ["trades", "depth"]);
  mgr.subscribe("ETHUSDT", ["trades"]);
  mgr.subscribe("BTCUSDT", ["liquidation"]);

  let manifests = mgr.getManifests();
  assert.equal(manifests.length, 2);
  const btc = manifests.find((m) => m.symbol === "BTCUSDT");
  assert.deepEqual(btc?.channels, ["depth", "liquidation", "trades"]);

  mgr.unsubscribe("BTCUSDT", ["depth"]);
  manifests = mgr.getManifests();
  const btcUpdated = manifests.find((m) => m.symbol === "BTCUSDT");
  assert.deepEqual(btcUpdated?.channels, ["liquidation", "trades"]);

  mgr.unsubscribe("ETHUSDT");
  assert.equal(mgr.getManifests().length, 1);
});
