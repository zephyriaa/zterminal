import { LocalOrderBook } from "./local-book";

export type BinanceDepth = { U: number; u: number; pu?: number; b: [string, string][]; a: [string, string][] };
export type BinanceSnapshot = { lastUpdateId: number; bids: [string, string][]; asks: [string, string][] };
export type BinanceBookStatus = "SYNCING" | "LIVE" | "ERROR";

/**
 * USD-M diff-depth bridge: discard u < snapshot id; first retained event must
 * cover the snapshot id, then each event's pu must equal the preceding u.
 * If the snapshot arrives before the stream has buffered its id, it is held
 * as pending until arriving deltas bridge it, preventing premature sync failure.
 */
export class BinanceDepthSynchronizer {
  readonly book = new LocalOrderBook();
  status: BinanceBookStatus = "SYNCING";
  private buffer: BinanceDepth[] = [];
  private sequence = 0;
  private pendingSnapshot: BinanceSnapshot | null = null;

  push(event: BinanceDepth) {
    if (this.status === "ERROR") return;
    if (!Number.isInteger(event.U) || !Number.isInteger(event.u) || event.U > event.u) {
      return this.fail();
    }
    if (this.status === "SYNCING") {
      if (this.buffer.length >= 2000) return this.fail();
      this.buffer.push(event);
      if (this.pendingSnapshot) {
        this.attemptPendingBridge();
      }
      return;
    }
    if (event.u <= this.sequence) return;
    if (event.pu !== this.sequence) {
      return this.fail();
    }
    try { this.apply(event); } catch { this.fail(); }
  }

  bridge(snapshot: BinanceSnapshot): boolean {
    if (this.status === "ERROR" || !Number.isInteger(snapshot.lastUpdateId)) return false;
    this.pendingSnapshot = snapshot;
    return this.attemptPendingBridge();
  }

  private attemptPendingBridge(): boolean {
    if (!this.pendingSnapshot || this.status === "ERROR") return false;
    const snapshot = this.pendingSnapshot;
    const lastId = snapshot.lastUpdateId;

    // Prune events completely superseded by snapshot
    this.buffer = this.buffer.filter(event => event.u >= lastId);

    // If the stream has not reached the snapshot ID, wait for more deltas.
    const maxU = this.buffer.reduce((max, e) => Math.max(max, e.u), 0);
    if (maxU < lastId) {
      return false;
    }

    const first = this.buffer.findIndex(event => event.U <= lastId && event.u >= lastId);
    if (first < 0) {
      // The stream passed the snapshot without a covering event: resynchronize.
      return this.fail();
    }

    const staged = new LocalOrderBook();
    try {
      for (const [p, q] of snapshot.bids) staged.apply("buy", p, q);
      for (const [p, q] of snapshot.asks) staged.apply("sell", p, q);
      let sequence = lastId;
      const eventsToApply = this.buffer.slice(first);
      for (let i = 0; i < eventsToApply.length; i++) {
        const event = eventsToApply[i];
        if (i > 0 && event.u <= sequence) continue;
        if (i > 0 && event.pu !== sequence) {
          return this.fail();
        }
        for (const [p, q] of event.b) staged.apply("buy", p, q);
        for (const [p, q] of event.a) staged.apply("sell", p, q);
        sequence = event.u;
      }
      if (staged.isCrossed()) return this.fail();
      this.book.clear();
      for (const level of staged.top("buy", Number.MAX_SAFE_INTEGER)) this.book.apply("buy", String(level.price), level.size);
      for (const level of staged.top("sell", Number.MAX_SAFE_INTEGER)) this.book.apply("sell", String(level.price), level.size);
      this.sequence = sequence;
      this.buffer = [];
      this.pendingSnapshot = null;
      this.status = "LIVE";
      return true;
    } catch {
      return this.fail();
    }
  }

  private apply(event: BinanceDepth) {
    for (const [p, q] of event.b) this.book.apply("buy", p, q);
    for (const [p, q] of event.a) this.book.apply("sell", p, q);
    if (this.book.isCrossed()) return this.fail();
    this.sequence = event.u;
  }

  private fail() {
    this.book.clear();
    this.buffer = [];
    this.pendingSnapshot = null;
    this.status = "ERROR";
    return false;
  }
}
