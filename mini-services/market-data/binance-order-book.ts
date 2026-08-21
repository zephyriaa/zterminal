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

  apply(delta: BinanceBookDelta): boolean {
    this.assertDelta(delta);
    if (!this.ready) {
      this.pending.push(delta);
      if (this.pending.length > 4_000) this.pending.splice(0, this.pending.length - 4_000);
      return true;
    }
    if (delta.u <= this.sequence) return true;
    // Binance USDⓈ-M diff-depth explicitly supplies `pu`, the final update ID of
    // the preceding event. Event ranges can advance by more than one ID, so after
    // the first snapshot bridge `pu` is the authoritative continuity check.
    if (delta.pu !== this.sequence) return false;
    this.applyLevels(this.bids, delta.b);
    this.applyLevels(this.asks, delta.a);
    this.sequence = delta.u;
    return true;
  }

  bootstrap(snapshot: BinanceBookSnapshot): boolean {
    if (!Number.isInteger(snapshot.lastUpdateId)) throw new Error("invalid Binance snapshot sequence");
    this.bids.clear();
    this.asks.clear();
    this.applyLevels(this.bids, snapshot.bids);
    this.applyLevels(this.asks, snapshot.asks);
    this.sequence = snapshot.lastUpdateId;
    this.ready = false;

    const start = this.pending.findIndex((delta) => delta.U <= snapshot.lastUpdateId + 1 && delta.u >= snapshot.lastUpdateId + 1);
    if (start < 0) return false;

    const bridged = this.pending.slice(start);
    this.pending = [];
    const first = bridged.shift();
    if (!first) return false;
    this.applyLevels(this.bids, first.b);
    this.applyLevels(this.asks, first.a);
    this.sequence = first.u;
    this.ready = true;

    for (const delta of bridged) {
      if (!this.apply(delta)) {
        this.ready = false;
        return false;
      }
    }
    return true;
  }

  levels(limit = 100): BinanceBookLevel[] {
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

  private applyLevels(target: Map<number, number>, levels: readonly [string, string][]) {
    for (const [rawPrice, rawSize] of levels) {
      const price = decimal(rawPrice);
      const size = decimal(rawSize);
      if (size === 0) target.delete(price);
      else target.set(price, size);
    }
  }
}
