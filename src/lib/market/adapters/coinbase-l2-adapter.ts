import { LocalOrderBook } from "../public-stream/local-book";
import type { FeedHealthStatus, L2OrderBookSnapshot } from "../l2-types";

export type CoinbaseBookStatus = "SYNCING" | "LIVE" | "DEGRADED" | "ERROR";

export interface CoinbaseL2Event {
  type: "snapshot" | "l2update" | "update";
  product_id: string;
  updates: Array<{
    side: "bid" | "offer" | "buy" | "sell";
    event_time?: string;
    price_level: string;
    new_quantity: string;
  }>;
}

export interface CoinbaseL2Message {
  channel: "l2_data" | "level2";
  sequence_num: number;
  events?: CoinbaseL2Event[];
}

/**
 * Coinbase Advanced Trade Level 2 Synchronizer.
 * Enforces monotonic sequence numbers and level delta reconstruction.
 */
export class CoinbaseDepthSynchronizer {
  readonly book = new LocalOrderBook();
  status: CoinbaseBookStatus = "SYNCING";
  health: FeedHealthStatus = "CONNECTING";
  private sequence = -1;
  private symbol: string;

  constructor(symbol: string) {
    this.symbol = symbol;
  }

  handleMessage(message: CoinbaseL2Message): boolean {
    if (!message || !Array.isArray(message.events)) {
      return false;
    }

    const sequence = Number(message.sequence_num);
    if (!Number.isFinite(sequence)) {
      return this.fail("Non-numeric sequence number in Coinbase frame");
    }

    let appliedAny = false;

    for (const event of message.events) {
      if (event.type === "snapshot") {
        this.book.clear();
        for (const update of event.updates || []) {
          const side = update.side === "bid" || update.side === "buy" ? "buy" : "sell";
          this.book.apply(side, update.price_level, update.new_quantity);
        }

        if (this.book.isCrossed()) {
          return this.fail("Crossed book on Coinbase snapshot");
        }

        this.sequence = sequence;
        this.status = "LIVE";
        this.health = "LIVE";
        appliedAny = true;
      } else {
        // Delta update
        if (this.status !== "LIVE") {
          continue;
        }

        // Check sequence monotonicity
        if (this.sequence !== -1) {
          if (sequence <= this.sequence) {
            // Duplicate frame
            continue;
          }
          if (sequence > this.sequence + 1) {
            // Sequence gap detected
            return this.fail(`Coinbase sequence gap: expected ${this.sequence + 1}, got ${sequence}`);
          }
        }

        for (const update of event.updates || []) {
          const side = update.side === "bid" || update.side === "buy" ? "buy" : "sell";
          this.book.apply(side, update.price_level, update.new_quantity);
        }

        if (this.book.isCrossed()) {
          return this.fail("Crossed book after Coinbase delta");
        }

        this.sequence = sequence;
        appliedAny = true;
      }
    }

    return appliedAny;
  }

  getSnapshot(limit = 100): L2OrderBookSnapshot {
    return this.book.toSnapshot(
      "coinbase",
      this.symbol,
      this.sequence,
      Date.now(),
      this.health,
      limit
    );
  }

  private fail(reason: string): false {
    this.book.clear();
    this.status = "ERROR";
    this.health = "DEGRADED";
    this.sequence = -1;
    return false;
  }
}
