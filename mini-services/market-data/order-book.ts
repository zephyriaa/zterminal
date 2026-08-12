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
  }

  buffer(delta: GateBookDelta) {
    if (!Number.isInteger(delta.U) || !Number.isInteger(delta.u) || delta.U > delta.u) {
      throw new Error("invalid Gate.io book sequence");
    }
    this.pending.push(delta);
    if (this.pending.length > 2_000) this.pending.splice(0, this.pending.length - 2_000);
  }

  bootstrap(snapshot: GateBookSnapshot): boolean {
    this.bids.clear();
    this.asks.clear();
    this.applyLevels(this.bids, snapshot.bids);
    this.applyLevels(this.asks, snapshot.asks);
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
    for (const delta of deltas) {
      if (!this.apply(delta)) {
        this.ready = false;
        return false;
      }
    }
    return true;
  }

  apply(delta: GateBookDelta): boolean {
    if (!this.ready) {
      this.buffer(delta);
      return true;
    }
    if (delta.full) {
      this.bids.clear();
      this.asks.clear();
      this.applyLevels(this.bids, delta.b);
      this.applyLevels(this.asks, delta.a);
      this.sequence = delta.u;
      return true;
    }
    if (delta.u <= this.sequence) return true; // duplicate/old update
    if (delta.U > this.sequence + 1) return false; // sequence gap
    this.applyLevels(this.bids, delta.b);
    this.applyLevels(this.asks, delta.a);
    this.sequence = delta.u;
    return true;
  }

  levels(limit = 100): NormalizedBookLevel[] {
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
      if (size === 0) target.delete(price);
      else target.set(price, Math.abs(size));
    }
  }
}
