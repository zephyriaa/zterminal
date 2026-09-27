import type { FeedHealthStatus, L2Exchange, L2OrderBookSnapshot } from "../l2-types";

export type BookSide = "buy" | "sell";
export type BookLevel = { price: number; size: number; side: BookSide };

/**
 * Canonical local L2 state. Raw provider data is never exposed until its
 * provider synchronizer has proven sequence integrity. Prices are keyed by the
 * provider's decimal string to avoid floating-point identity drift.
 */
export class LocalOrderBook {
  private bids = new Map<string, { price: number; size: number }>();
  private asks = new Map<string, { price: number; size: number }>();

  clear() {
    this.bids.clear();
    this.asks.clear();
  }

  apply(side: BookSide, priceKey: string, rawSize: string | number) {
    const price = Number(priceKey), size = Number(rawSize);
    if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(size) || size < 0) {
      throw new Error("invalid order-book level");
    }
    const key = price.toString();
    const target = side === "buy" ? this.bids : this.asks;
    if (size === 0) {
      target.delete(key);
    } else {
      target.set(key, { price, size });
    }
  }

  top(side: BookSide, limit = 100): BookLevel[] {
    const source = side === "buy" ? this.bids : this.asks;
    return [...source.values()]
      .sort((a, b) => (side === "buy" ? b.price - a.price : a.price - b.price))
      .slice(0, limit)
      .map(level => ({ ...level, side }));
  }

  getSortedPairs(side: BookSide, limit = 100): [number, number][] {
    const source = side === "buy" ? this.bids : this.asks;
    return [...source.values()]
      .sort((a, b) => (side === "buy" ? b.price - a.price : a.price - b.price))
      .slice(0, limit)
      .map(level => [level.price, level.size]);
  }

  toSnapshot(
    exchange: L2Exchange,
    symbol: string,
    sequence: number,
    timestamp: number,
    health: FeedHealthStatus = "LIVE",
    limit = 100
  ): L2OrderBookSnapshot {
    return {
      exchange,
      symbol,
      sequence,
      timestamp,
      health,
      bids: this.getSortedPairs("buy", limit),
      asks: this.getSortedPairs("sell", limit),
    };
  }

  bestBid() {
    return this.top("buy", 1)[0];
  }

  bestAsk() {
    return this.top("sell", 1)[0];
  }

  isCrossed() {
    const bid = this.bestBid(), ask = this.bestAsk();
    return Boolean(bid && ask && bid.price >= ask.price);
  }
}
