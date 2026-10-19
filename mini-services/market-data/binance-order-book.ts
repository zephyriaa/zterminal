export interface BinanceBookDelta {
  U: number;
  u: number;
  pu: number;
  E: number;
  b: [string, string][];
  a: [string, string][];
}

export interface BinanceBookSnapshot {
  lastUpdateId: number;
  bids: [string, string][];
  asks: [string, string][];
}

export interface BinanceBookLevel {
  price: number;
  size: number;
  side: "buy" | "sell";
}

function decimal(value: string | number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error("invalid Binance order-book decimal");
  return parsed;
}

/**
 * Local USDⓈ-M book built from the Binance REST snapshot plus diff-depth stream.
 * The first bridged event is allowed to span the snapshot sequence. Every later
 * event must link via `pu`, otherwise the book is unsafe and must be rebuilt.
 */
export class BinanceOrderBook {
  private bids = new Map<number, number>();
  private asks = new Map<number, number>();
  private pending: BinanceBookDelta[] = [];
  private sequence = 0;
  private ready = false;
  private snapshot: BinanceBookSnapshot | null = null;

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

  apply(delta: BinanceBookDelta): boolean {
    try {
    this.assertDelta(delta);
    if (!this.ready) {
      this.pending.push(delta);
      if (this.snapshot) this.bootstrap(this.snapshot);
      if (this.pending.length > 4_000) throw new Error("Binance book bootstrap overflow; resynchronize");
      return true;
    }
    if (delta.u <= this.sequence) return true;
    // Binance USDⓈ-M diff-depth explicitly supplies `pu`, the final update ID of
    // the preceding event. Event ranges can advance by more than one ID, so after
    // the first snapshot bridge `pu` is the authoritative continuity check.
    if (delta.pu !== this.sequence) { this.reset(); this.pending.push(delta); return false; }
    this.applyLevels(this.bids, delta.b);
    this.applyLevels(this.asks, delta.a);
    this.assertUncrossed();
    this.sequence = delta.u;
    return true;
    } catch (error) { this.reset(); throw error; }
  }

  bootstrap(snapshot: BinanceBookSnapshot): boolean {
    try {
    this.snapshot = snapshot;
    if (!Number.isInteger(snapshot.lastUpdateId)) throw new Error("invalid Binance snapshot sequence");
    this.bids.clear();
    this.asks.clear();
    this.applyLevels(this.bids, snapshot.bids);
    this.applyLevels(this.asks, snapshot.asks);
    this.sequence = snapshot.lastUpdateId;
    this.ready = false;

    const start = this.pending.findIndex((delta) => delta.U <= snapshot.lastUpdateId && delta.u >= snapshot.lastUpdateId);
    if (start < 0) return false;

    const bridged = this.pending.slice(start);
    this.pending = [];
    const first = bridged.shift();
    if (!first) return false;
    this.applyLevels(this.bids, first.b);
    this.applyLevels(this.asks, first.a);
    this.assertUncrossed();
    this.sequence = first.u;
    this.ready = true;
    this.snapshot = null;

    for (const delta of bridged) {
      if (!this.apply(delta)) {
        this.ready = false;
        return false;
      }
    }
    return true;
    } catch (error) { this.reset(); throw error; }
  }

  levels(limit = 100): BinanceBookLevel[] {
    if (!this.ready) return [];
    const bids = [...this.bids.entries()]
      .sort(([left], [right]) => right - left)
      .slice(0, limit)
      .map(([price, size]) => ({ price, size, side: "buy" as const }));
    const asks = [...this.asks.entries()]
      .sort(([left], [right]) => left - right)
      .slice(0, limit)
      .map(([price, size]) => ({ price, size, side: "sell" as const }));
    return [...bids, ...asks];
  }

  bestQuote() {
    if (!this.ready) return null;
    const bid = [...this.bids.entries()].sort(([left], [right]) => right - left)[0];
    const ask = [...this.asks.entries()].sort(([left], [right]) => left - right)[0];
    if (!bid || !ask) return null;
    return { bid: bid[0], bidSize: bid[1], ask: ask[0], askSize: ask[1] };
  }

  private assertDelta(delta: BinanceBookDelta) {
    if (!Number.isInteger(delta.U) || !Number.isInteger(delta.u) || !Number.isInteger(delta.pu) || delta.U > delta.u) {
      throw new Error("invalid Binance diff-depth sequence");
    }
  }

  private assertUncrossed() {
    const bid = Math.max(...this.bids.keys()), ask = Math.min(...this.asks.keys());
    if (bid >= ask) throw new Error("crossed Binance order book");
  }

  private applyLevels(target: Map<number, number>, levels: readonly [string, string][]) {
    for (const [rawPrice, rawSize] of levels) {
      const price = decimal(rawPrice);
      if (price <= 0) throw new Error("invalid Binance order-book price");
      const size = decimal(rawSize);
      if (size === 0) target.delete(price);
      else target.set(price, size);
    }
  }
}
