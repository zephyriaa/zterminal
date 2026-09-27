import type { L2OrderBookSnapshot } from "./l2-types";

export type ThrottleListener = (snapshot: L2OrderBookSnapshot) => void;

/**
 * Decouples high-frequency exchange WebSocket ingestion (1000+ msgs/sec)
 * from React rendering by throttling UI emissions to a fixed target rate (30-60 Hz).
 * Prevents V8 main-thread garbage collection stutter.
 */
export class ThrottledOrderBookBuffer {
  private latestSnapshot: L2OrderBookSnapshot | null = null;
  private listeners = new Set<ThrottleListener>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private rafId: number | null = null;
  private targetFps: number;
  private intervalMs: number;
  private isDirty = false;
  private depthLimit: number;

  constructor(targetFps = 30, depthLimit = 25) {
    this.targetFps = Math.max(1, Math.min(60, targetFps));
    this.intervalMs = Math.floor(1000 / this.targetFps);
    this.depthLimit = depthLimit;
  }

  push(snapshot: L2OrderBookSnapshot) {
    // Trim snapshot to prevent retaining large heap objects
    this.latestSnapshot = {
      ...snapshot,
      bids: snapshot.bids.slice(0, this.depthLimit),
      asks: snapshot.asks.slice(0, this.depthLimit),
    };
    this.isDirty = true;

    if (!this.timer && !this.rafId) {
      this.startLoop();
    }
  }

  subscribe(listener: ThrottleListener): () => void {
    this.listeners.add(listener);
    if (this.latestSnapshot) {
      listener(this.latestSnapshot);
    }
    if (!this.timer && !this.rafId && this.listeners.size > 0) {
      this.startLoop();
    }
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) {
        this.stopLoop();
      }
    };
  }

  private startLoop() {
    this.stopLoop();
    if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
      let lastTime = performance.now();
      const step = (time: number) => {
        if (time - lastTime >= this.intervalMs) {
          lastTime = time;
          this.flush();
        }
        if (this.listeners.size > 0) {
          this.rafId = window.requestAnimationFrame(step);
        }
      };
      this.rafId = window.requestAnimationFrame(step);
    } else {
      // Node.js or SSR environment fallback
      this.timer = setInterval(() => {
        this.flush();
      }, this.intervalMs);
    }
  }

  private stopLoop() {
    if (this.rafId !== null && typeof window !== "undefined") {
      window.cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private flush() {
    if (!this.isDirty || !this.latestSnapshot || this.listeners.size === 0) {
      return;
    }
    this.isDirty = false;
    const snap = this.latestSnapshot;
    for (const listener of this.listeners) {
      try {
        listener(snap);
      } catch (err) {
        console.error("ThrottledOrderBookBuffer listener error:", err);
      }
    }
  }

  destroy() {
    this.stopLoop();
    this.listeners.clear();
    this.latestSnapshot = null;
  }
}
