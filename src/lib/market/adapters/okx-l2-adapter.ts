import { LocalOrderBook } from "../public-stream/local-book";
import { validateOkxChecksum } from "../okx-crc32";
import type { FeedHealthStatus, L2OrderBookSnapshot } from "../l2-types";

export type OKXBookStatus = "SYNCING" | "LIVE" | "DEGRADED" | "ERROR";

export interface OKXBookPayload {
  action: "snapshot" | "update";
  arg: {
    channel: string;
    instId: string;
  };
  data: Array<{
    asks: Array<[price: string, size: string, liquidatedOrders?: string, ordersCount?: string]>;
    bids: Array<[price: string, size: string, liquidatedOrders?: string, ordersCount?: string]>;
    ts: string;
    checksum?: number;
    seqId?: number;
    prevSeqId?: number;
  }>;
}

/**
 * OKX Level 2 Order Book Synchronizer.
 * Enforces monotonic sequence integrity and IEEE 802.3 CRC32 checksum validation.
 * Any checksum mismatch or dropped sequence triggers immediate transition to ERROR.
 */
export class OKXDepthSynchronizer {
  readonly book = new LocalOrderBook();
  status: OKXBookStatus = "SYNCING";
  health: FeedHealthStatus = "CONNECTING";
  private sequence = -1;
  private symbol: string;

  constructor(symbol: string) {
    this.symbol = symbol;
  }

  handleMessage(payload: OKXBookPayload): boolean {
    if (!payload || !Array.isArray(payload.data) || payload.data.length === 0) {
      return false;
    }

    const item = payload.data[0];
    const action = payload.action;
    const seqId = typeof item.seqId === "number" ? item.seqId : -1;
    const prevSeqId = typeof item.prevSeqId === "number" ? item.prevSeqId : undefined;
    const checksum = typeof item.checksum === "number" ? item.checksum : undefined;
    const timestamp = Number(item.ts) || Date.now();

    if (action === "snapshot") {
      this.book.clear();
      for (const [p, q] of item.bids) {
        this.book.apply("buy", p, q);
      }
      for (const [p, q] of item.asks) {
        this.book.apply("sell", p, q);
      }

      if (this.book.isCrossed()) {
        return this.fail("Crossed book on snapshot");
      }

      if (checksum !== undefined) {
        const topBids = this.book.top("buy", 25).map(l => [String(l.price), String(l.size)] as [string, string]);
        const topAsks = this.book.top("sell", 25).map(l => [String(l.price), String(l.size)] as [string, string]);
        if (!validateOkxChecksum(topBids, topAsks, checksum)) {
          return this.fail(`CRC32 checksum mismatch on snapshot: expected ${checksum}`);
        }
      }

      this.sequence = seqId;
      this.status = "LIVE";
      this.health = "LIVE";
      return true;
    }

    if (action === "update") {
      if (this.status !== "LIVE") {
        return false;
      }

      // Check sequence monotonicity if provided by OKX
      if (prevSeqId !== undefined && prevSeqId !== -1 && this.sequence !== -1) {
        if (prevSeqId !== this.sequence) {
          return this.fail(`OKX sequence gap: expected prevSeqId ${this.sequence}, got ${prevSeqId}`);
        }
      } else if (seqId !== -1 && this.sequence !== -1 && seqId <= this.sequence) {
        // Out-of-order or duplicate packet
        return false;
      }

      // Apply deltas
      for (const [p, q] of item.bids) {
        this.book.apply("buy", p, q);
      }
      for (const [p, q] of item.asks) {
        this.book.apply("sell", p, q);
      }

      if (this.book.isCrossed()) {
        return this.fail("Crossed book after update");
      }

      // Verify CRC32 checksum if provided
      if (checksum !== undefined) {
        const topBids = this.book.top("buy", 25).map(l => [String(l.price), String(l.size)] as [string, string]);
        const topAsks = this.book.top("sell", 25).map(l => [String(l.price), String(l.size)] as [string, string]);
        if (!validateOkxChecksum(topBids, topAsks, checksum)) {
          return this.fail(`CRC32 checksum mismatch on update: expected ${checksum}`);
        }
      }

      this.sequence = seqId;
      return true;
    }

    return false;
  }

  getSnapshot(limit = 100): L2OrderBookSnapshot {
    return this.book.toSnapshot(
      "okx",
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
