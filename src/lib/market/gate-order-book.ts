export interface GateBookLevel {
  p: string | number;
  s: string | number;
}

export interface GateBookDelta {
  U: number;
  u: number;
  t: number;
  b: GateBookLevel[];
  a: GateBookLevel[];
  full?: boolean;
}

export interface GateBookSnapshot {
  id: number;
  current: number;
  update: number;
  bids: [string, string][];
  asks: [string, string][];
}

export interface NormalizedBookLevel {
  price: number;
  size: number;
  side: "buy" | "sell";
}

function decimal(value: string | number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error("invalid order-book decimal");
  return parsed;
}

/**
 * Maintains a price-aggregated local Gate.io book. The caller must fetch a
 * REST snapshot with `with_id=true` and only publish after `bootstrap()` has
 * bridged that snapshot ID with buffered WebSocket deltas.
 */
export class GateOrderBook {
  private bids = new Map<number, number>();
  private asks = new Map<number, number>();
  private pending: GateBookDelta[] = [];
  private sequence = 0;
  private ready = false;
  private snapshot: GateBookSnapshot | null = null;

  isReady() {
    return this.ready;
  }

  lastSequence() {
    return this.sequence;
  }

  reset() {
    this.bids.clear();
    this.asks.clear();
    this.pending = [];
    this.sequence = 0;
    this.ready = false;
    this.snapshot = null;
  }

  buffer(delta: GateBookDelta) {
    if (!Number.isSafeInteger(delta.U) || !Number.isSafeInteger(delta.u) || delta.U < 0 || delta.U > delta.u) {
      this.reset();
      throw new Error("invalid Gate.io book sequence");
    }
    if (this.pending.length >= 2_000) { this.reset(); throw new Error("Gate.io book bootstrap overflow; resynchronize"); }
    this.pending.push(delta);
  }

  bootstrap(snapshot: GateBookSnapshot): boolean {
    try {
    if (!Number.isSafeInteger(snapshot.id) || snapshot.id < 0) throw new Error("invalid Gate.io snapshot sequence");
    this.snapshot = snapshot;
    this.bids.clear();
    this.asks.clear();
    this.applyLevels(this.bids, snapshot.bids);
    this.applyLevels(this.asks, snapshot.asks);
    this.assertUncrossed();
    this.sequence = snapshot.id;
    this.ready = false;

    const start = this.pending.findIndex(
      (delta) => delta.U <= snapshot.id + 1 && delta.u >= snapshot.id + 1
    );
    if (start < 0) return false;

    const deltas = this.pending.slice(start);
    this.pending = [];
    // Mark ready before applying the bridged range so `apply` validates each
    // delta against the snapshot sequence instead of re-buffering it.
    this.ready = true;
    this.snapshot = null;
    for (const delta of deltas) {
      if (!this.apply(delta)) {
        this.ready = false;
        return false;
      }
    }
    return true;
    } catch (error) { this.reset(); throw error; }
  }

  apply(delta: GateBookDelta): boolean {
    try {
    if (!Number.isSafeInteger(delta.u) || delta.u < 0 || !delta.full && (!Number.isSafeInteger(delta.U) || delta.U < 0 || delta.U > delta.u)) throw new Error("invalid Gate.io book sequence");
    if (delta.full) {
      if (this.ready && delta.u < this.sequence) return true;
      this.reset();
      this.applyLevels(this.bids, delta.b);
      this.applyLevels(this.asks, delta.a);
      this.assertUncrossed();
      this.sequence = delta.u;
      this.ready = true;
      return true;
    }
    if (!this.ready) {
      this.buffer(delta);
      if (this.snapshot) this.bootstrap(this.snapshot);
      return true;
    }
    if (delta.u <= this.sequence) return true; // duplicate/old update
    if (delta.U > this.sequence + 1) { this.reset(); this.buffer(delta); return false; } // sequence gap
    this.applyLevels(this.bids, delta.b);
    this.applyLevels(this.asks, delta.a);
    this.assertUncrossed();
    this.sequence = delta.u;
    return true;
    } catch (error) { this.reset(); throw error; }
  }

  levels(limit = 100): NormalizedBookLevel[] {
    if (!this.ready) return [];
    const bids = [...this.bids.entries()]
      .sort(([a], [b]) => b - a)
      .slice(0, limit)
      .map(([price, size]) => ({ price, size, side: "buy" as const }));
    const asks = [...this.asks.entries()]
      .sort(([a], [b]) => a - b)
      .slice(0, limit)
      .map(([price, size]) => ({ price, size, side: "sell" as const }));
    return [...bids, ...asks];
  }

  bestQuote() {
    if (!this.ready) return null;
    const bid = [...this.bids.entries()].sort(([a], [b]) => b - a)[0];
    const ask = [...this.asks.entries()].sort(([a], [b]) => a - b)[0];
    if (!bid || !ask) return null;
    return { bid: bid[0], bidSize: bid[1], ask: ask[0], askSize: ask[1] };
  }

  private applyLevels(target: Map<number, number>, levels: readonly (readonly [string, string] | GateBookLevel)[]) {
    for (const raw of levels) {
      let rawPrice: string | number;
      let rawSize: string | number;
      if (Array.isArray(raw)) {
        const tuple = raw as readonly [string, string];
        [rawPrice, rawSize] = tuple;
      } else {
        const level = raw as GateBookLevel;
        rawPrice = level.p;
        rawSize = level.s;
      }
      const price = decimal(rawPrice);
      const size = decimal(rawSize);
      if (price <= 0 || size < 0) throw new Error("invalid Gate.io book price or size");
      if (size === 0) target.delete(price);
      else target.set(price, size);
    }
  }

  private assertUncrossed() {
    if (Math.max(...this.bids.keys()) >= Math.min(...this.asks.keys())) throw new Error("crossed Gate.io order book");
  }
}
