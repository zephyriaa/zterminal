/**
 * WebSocket Streaming Enhancements
 * MultiCharts/Institutional-grade streaming resilience:
 * - Exponential backoff with decorrelated jitter
 * - High-frequency tick micro-burst coalescer
 * - Sequence gap detector & latency/jitter telemetry monitor
 * - Resilient subscription recovery manager
 */

export interface BackoffConfig {
  initialDelayMs: number;
  maxDelayMs: number;
  factor: number;
  jitterRatio: number; // 0.0 to 1.0
}

export const DEFAULT_BACKOFF_CONFIG: BackoffConfig = {
  initialDelayMs: 500,
  maxDelayMs: 30_000,
  factor: 1.8,
  jitterRatio: 0.3,
};

export class BackoffCalculator {
  private attempt = 0;
  private currentDelay: number;

  constructor(private config: BackoffConfig = DEFAULT_BACKOFF_CONFIG) {
    this.currentDelay = config.initialDelayMs;
  }

  public nextDelay(): number {
    this.attempt++;
    const base = Math.min(
      this.config.maxDelayMs,
      this.config.initialDelayMs * Math.pow(this.config.factor, this.attempt - 1),
    );
    // Decorrelated jitter: +/- jitterRatio
    const jitterRange = base * this.config.jitterRatio;
    const jitter = (Math.random() * 2 - 1) * jitterRange;
    this.currentDelay = Math.max(this.config.initialDelayMs, Math.round(base + jitter));
    return this.currentDelay;
  }

  public reset(): void {
    this.attempt = 0;
    this.currentDelay = this.config.initialDelayMs;
  }

  public getAttempt(): number {
    return this.attempt;
  }
}

export interface StreamTelemetry {
  latencyMs: number;
  jitterMs: number;
  packetsReceived: number;
  sequenceGaps: number;
  status: "HEALTHY" | "DEGRADED" | "CRITICAL";
  lastHeartbeat: number;
}

export class StreamHealthMonitor {
  private latencies: number[] = [];
  private lastSeq: number | null = null;
  private sequenceGaps = 0;
  private packetsReceived = 0;
  private lastHeartbeat = Date.now();

  constructor(
    private maxLatencyMs = 250,
    private criticalLatencyMs = 1000,
  ) {}

  public recordPing(latencyMs: number): void {
    this.latencies.push(latencyMs);
    if (this.latencies.length > 30) this.latencies.shift();
    this.lastHeartbeat = Date.now();
  }

  public recordPacket(seq?: number): void {
    this.packetsReceived++;
    if (seq !== undefined) {
      if (this.lastSeq !== null && seq > this.lastSeq + 1) {
        this.sequenceGaps += seq - (this.lastSeq + 1);
      }
      this.lastSeq = seq;
    }
  }

  public getTelemetry(): StreamTelemetry {
    const avgLatency =
      this.latencies.length > 0
        ? this.latencies.reduce((a, b) => a + b, 0) / this.latencies.length
        : 0;

    // Rolling jitter calculation: mean absolute difference between successive latencies
    let jitter = 0;
    if (this.latencies.length > 1) {
      let diffSum = 0;
      for (let i = 1; i < this.latencies.length; i++) {
        diffSum += Math.abs(this.latencies[i] - this.latencies[i - 1]);
      }
      jitter = diffSum / (this.latencies.length - 1);
    }

    let status: "HEALTHY" | "DEGRADED" | "CRITICAL" = "HEALTHY";
    const timeSinceHeartbeat = Date.now() - this.lastHeartbeat;

    if (timeSinceHeartbeat > 10_000 || avgLatency > this.criticalLatencyMs || this.sequenceGaps > 10) {
      status = "CRITICAL";
    } else if (avgLatency > this.maxLatencyMs || this.sequenceGaps > 0) {
      status = "DEGRADED";
    }

    return {
      latencyMs: Number(avgLatency.toFixed(1)),
      jitterMs: Number(jitter.toFixed(1)),
      packetsReceived: this.packetsReceived,
      sequenceGaps: this.sequenceGaps,
      status,
      lastHeartbeat: this.lastHeartbeat,
    };
  }

  public reset(): void {
    this.latencies = [];
    this.lastSeq = null;
    this.sequenceGaps = 0;
    this.packetsReceived = 0;
    this.lastHeartbeat = Date.now();
  }
}

/**
 * Coalesces high-frequency market tick bursts into frame-budgeted batches (e.g. 16ms)
 * to avoid UI thread saturation during market flash crashes or news spikes.
 */
export class MicroBurstCoalescer<T> {
  private buffer: T[] = [];
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private flushIntervalMs: number = 16,
    private onFlush: (items: T[]) => void = () => {},
  ) {}

  public push(item: T): void {
    this.buffer.push(item);
    if (!this.timer) {
      this.timer = setTimeout(() => this.flush(), this.flushIntervalMs);
    }
  }

  public flush(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.buffer.length > 0) {
      const items = this.buffer;
      this.buffer = [];
      this.onFlush(items);
    }
  }

  public size(): number {
    return this.buffer.length;
  }

  public clear(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.buffer = [];
  }
}

export interface SubscriptionManifest {
  symbol: string;
  channels: string[];
}

export class SubscriptionRecoveryManager {
  private activeSubscriptions = new Map<string, Set<string>>();

  public subscribe(symbol: string, channels: string[]): void {
    const set = this.activeSubscriptions.get(symbol) ?? new Set<string>();
    for (const ch of channels) set.add(ch);
    this.activeSubscriptions.set(symbol, set);
  }

  public unsubscribe(symbol: string, channels?: string[]): void {
    if (!channels) {
      this.activeSubscriptions.delete(symbol);
      return;
    }
    const set = this.activeSubscriptions.get(symbol);
    if (!set) return;
    for (const ch of channels) set.delete(ch);
    if (set.size === 0) {
      this.activeSubscriptions.delete(symbol);
    }
  }

  public getManifests(): SubscriptionManifest[] {
    const manifests: SubscriptionManifest[] = [];
    for (const [symbol, channels] of this.activeSubscriptions.entries()) {
      manifests.push({
        symbol,
        channels: Array.from(channels).sort(),
      });
    }
    return manifests;
  }

  public clear(): void {
    this.activeSubscriptions.clear();
  }
}
