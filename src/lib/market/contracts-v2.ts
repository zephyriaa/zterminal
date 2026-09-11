/**
 * Boundary types for the local runtime and hosted fallback. Exact financial
 * values, source timestamps, IDs and sequences are strings at this boundary
 * so JavaScript, Rust and Python share one lossless representation.
 */
export type CapabilityAccess = "available" | "unavailable" | "entitled" | "restricted" | "unknown";

export interface ProviderCapabilities {
  provider: string;
  trades: CapabilityAccess;
  tradeGranularity: "individual" | "aggregate" | "mixed" | "unknown";
  l1: CapabilityAccess;
  l2: CapabilityAccess;
  historicalTicks: CapabilityAccess;
  historicalDepth: CapabilityAccess;
  options: CapabilityAccess;
  greeks: CapabilityAccess;
  openInterest: CapabilityAccess;
  recording: CapabilityAccess;
  reason?: string;
}

export interface FeedQualityEpoch {
  id: string;
  provider: string;
  symbol: string;
  startedAtNs: string;
  integrity: "live" | "syncing" | "stale" | "gap" | "resyncing" | "unavailable";
  reason?: string;
}

export interface TradeEventV2 {
  kind: "trade";
  provider: string;
  symbol: string;
  eventId: string;
  timestampNs: string;
  sequence: string;
  price: string;
  quantity: string;
  side: "buy" | "sell" | "unknown";
  tradeGranularity: ProviderCapabilities["tradeGranularity"];
  qualityEpoch: string;
}

export interface OrderBookLevelV2 { price: string; quantity: string; }
export interface OrderBookSnapshotV2 {
  kind: "book-snapshot";
  provider: string;
  symbol: string;
  timestampNs: string;
  sequence: string;
  bids: OrderBookLevelV2[];
  asks: OrderBookLevelV2[];
  qualityEpoch: string;
}
export interface OrderBookDeltaV2 {
  kind: "book-delta";
  provider: string;
  symbol: string;
  timestampNs: string;
  firstSequence: string;
  lastSequence: string;
  previousSequence?: string;
  bids: OrderBookLevelV2[];
  asks: OrderBookLevelV2[];
  qualityEpoch: string;
}

export interface StreamManifest {
  version: 2;
  streamId: string;
  provider: string;
  symbol: string;
  capabilities: ProviderCapabilities;
  qualityEpoch: FeedQualityEpoch;
  transport: "loopback" | "hosted-gateway" | "replay";
  maximumBatchEvents: number;
  maximumBatchIntervalMs: number;
}
