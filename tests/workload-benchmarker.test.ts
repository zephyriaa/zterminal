import test from "node:test";
import assert from "node:assert/strict";
import {
  benchmarkBarThroughput,
  calculateCloudCostSavings,
  WorkloadMonitor,
} from "../src/lib/benchmark/workload-benchmarker";

test("benchmarkBarThroughput measures processing speed and returns positive metrics", () => {
  const result = benchmarkBarThroughput(10_000, 2);
  assert.equal(result.operationsCount, 20_000);
  assert.ok(result.durationMs > 0);
  assert.ok(result.throughputPerSecond > 0);
  assert.ok(result.heapUsedMb !== undefined && result.heapUsedMb > 0);
});

test("calculateCloudCostSavings computes avoided cloud bills accurately", () => {
  // 10 hours of heavy compute, 50 GB transferred
  const savings = calculateCloudCostSavings(10_000_000, 36_000, 50 * 1024 * 1024 * 1024);

  // 10 hours * $0.085/hr = $0.85
  assert.equal(savings.cloudEquivalentComputeCostUsd, 0.85);
  // 50 GB * $0.09/GB = $4.50
  assert.equal(savings.cloudEquivalentEgressCostUsd, 4.5);
  // Total = $5.35 saved
  assert.equal(savings.totalSavedUsd, 5.35);
  assert.equal(savings.costToUserUsd, 0);
});

test("WorkloadMonitor accumulates workloads and calculates running cost savings", () => {
  const monitor = new WorkloadMonitor();

  // Run 1: 50,000 bars in 1,000 ms
  monitor.recordWorkload(50_000, 1000, 10 * 1024 * 1024);
  // Run 2: 150,000 bars in 3,000 ms
  monitor.recordWorkload(150_000, 3000, 20 * 1024 * 1024);

  const report = monitor.getCumulativeCostSavings();
  assert.equal(report.totalBarsProcessed, 200_000);
  assert.equal(report.computeDurationSeconds, 4.0);
  assert.ok(report.totalSavedUsd >= 0);

  const bench = benchmarkBarThroughput(1000, 1);
  monitor.recordBenchmark(bench);
  assert.equal(monitor.getRecentBenchmarks().length, 1);
});
