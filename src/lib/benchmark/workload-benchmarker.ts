/**
 * Workload Benchmarking & Cost Monitoring
 * Benchmarks local client/desktop compute throughput (bars/sec, evals/sec)
 * and monitors cloud compute cost savings from running 100% zero-server local compute.
 */

export interface BenchmarkMetrics {
  name: string;
  operationsCount: number;
  durationMs: number;
  throughputPerSecond: number; // e.g. 1,500,000 bars/sec
  heapUsedMb?: number;
  timestamp: number;
}

export interface CloudCostRates {
  cloudCpuPerHourUsd: number; // e.g. $0.08 / core-hour (c5.large)
  cloudEgressPerGbUsd: number; // e.g. $0.09 / GB
  cloudStoragePerGbMonthUsd: number; // e.g. $0.02 / GB
}

export const DEFAULT_CLOUD_RATES: CloudCostRates = {
  cloudCpuPerHourUsd: 0.085, // Standard vCPU hour rate
  cloudEgressPerGbUsd: 0.09, // AWS/GCP standard egress
  cloudStoragePerGbMonthUsd: 0.023,
};

export interface CostSavingsReport {
  totalBarsProcessed: number;
  computeDurationSeconds: number;
  dataTransferredBytes: number;
  cloudEquivalentComputeCostUsd: number;
  cloudEquivalentEgressCostUsd: number;
  totalSavedUsd: number;
  costToUserUsd: 0; // Local compute is $0
  effectiveRoiRatio: number;
}

/**
 * Runs a CPU-intensive synchronous benchmark evaluating throughput for synthetic market bars.
 */
export function benchmarkBarThroughput(
  numBars = 100_000,
  iterations = 5,
): BenchmarkMetrics {
  const start = performance.now();

  let accumulator = 0;
  for (let iter = 0; iter < iterations; iter++) {
    for (let i = 0; i < numBars; i++) {
      // Synthetic indicators: EMA update + True Range
      const close = 50000 + (i % 1000);
      const high = close + 50;
      const low = close - 50;
      accumulator += (high - low) / close;
    }
  }

  const durationMs = Math.max(1, performance.now() - start);
  const totalOperations = numBars * iterations;
  const throughputPerSecond = Math.round((totalOperations / durationMs) * 1000);

  let heapUsedMb: number | undefined;
  if (typeof process !== "undefined" && process.memoryUsage) {
    heapUsedMb = Number((process.memoryUsage().heapUsed / (1024 * 1024)).toFixed(2));
  }

  return {
    name: "Bar Processing Throughput",
    operationsCount: totalOperations,
    durationMs: Number(durationMs.toFixed(2)),
    throughputPerSecond,
    heapUsedMb,
    timestamp: Date.now(),
  };
}

/**
 * Calculates cloud infrastructure costs that were avoided by running 100% locally.
 */
export function calculateCloudCostSavings(
  totalBarsProcessed: number,
  computeDurationSeconds: number,
  dataTransferredBytes: number,
  rates: CloudCostRates = DEFAULT_CLOUD_RATES,
): CostSavingsReport {
  const computeHours = computeDurationSeconds / 3600;
  const dataGigabytes = dataTransferredBytes / (1024 * 1024 * 1024);

  const computeCost = computeHours * rates.cloudCpuPerHourUsd;
  const egressCost = dataGigabytes * rates.cloudEgressPerGbUsd;
  const totalSaved = computeCost + egressCost;

  return {
    totalBarsProcessed,
    computeDurationSeconds,
    dataTransferredBytes,
    cloudEquivalentComputeCostUsd: Number(computeCost.toFixed(4)),
    cloudEquivalentEgressCostUsd: Number(egressCost.toFixed(4)),
    totalSavedUsd: Number(totalSaved.toFixed(4)),
    costToUserUsd: 0,
    effectiveRoiRatio: totalSaved > 0 ? Infinity : 1.0,
  };
}

export class WorkloadMonitor {
  private benchmarks: BenchmarkMetrics[] = [];
  private cumulativeBarsProcessed = 0;
  private cumulativeDurationSeconds = 0;
  private cumulativeBytesTransferred = 0;

  constructor(private rates: CloudCostRates = DEFAULT_CLOUD_RATES) {}

  public recordWorkload(barsCount: number, durationMs: number, bytesTransferred = 0): void {
    this.cumulativeBarsProcessed += barsCount;
    this.cumulativeDurationSeconds += durationMs / 1000;
    this.cumulativeBytesTransferred += bytesTransferred;
  }

  public recordBenchmark(metric: BenchmarkMetrics): void {
    this.benchmarks.push(metric);
    if (this.benchmarks.length > 50) this.benchmarks.shift();
  }

  public getRecentBenchmarks(): BenchmarkMetrics[] {
    return [...this.benchmarks];
  }

  public getCumulativeCostSavings(): CostSavingsReport {
    return calculateCloudCostSavings(
      this.cumulativeBarsProcessed,
      this.cumulativeDurationSeconds,
      this.cumulativeBytesTransferred,
      this.rates,
    );
  }
}
