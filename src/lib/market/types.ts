/**
 * Z TERMINAL — Normalized market-data model.
 *
 * These schemas are the internal source of truth. Provider adapters
 * (Mock / Rithmic Test / Rithmic Production / future Databento) MUST
 * normalize their native messages into these types. Analytics must
 * never depend on provider-specific code.
 *
 * See MARKET_DATA_SCHEMA.md for the full specification.
 */

export type ProviderId = "mock" | "gateio" | "rithmic-test" | "rithmic-prod" | "databento";
export type Environment = "simulation" | "paper" | "live";

export type Exchange = "CME" | "CBOT" | "COMEX" | "NYMEX" | "NASDAQ" | "NYSE" | "ICE" | "GATEIO";
export type Side = "buy" | "sell";
export type Aggressor = "buy" | "sell" | "unknown";

/** ISO contract metadata. Futures are NOT perpetual — model expiry explicitly. */
export interface ContractMetadata {
  root: string;            // e.g. "NQ"
  symbol: string;          // e.g. "NQH5"
  description: string;     // e.g. "E-mini Nasdaq-100 (Mar 2025)"
  exchange: Exchange;
  product: "future" | "perpetual" | "equity" | "index";
  tickSize: number;        // minimum price increment
  tickValue: number;       // $ value of one tick (per contract / share)
  multiplier: number;      // point multiplier (futures) or 1 (equities)
  currency: "USD" | "USDT";
  expiry?: string;         // ISO date for futures
  session: SessionId;
  /** True only when the underlying provider genuinely supplies real depth/MBO. */
  supportsDepth: boolean;
  supportsMBO: boolean;
}

export type SessionId = "cme" | "equity" | "crypto";

/** Trade (time & sales) — normalized across providers. */
export interface TradeEvent {
  type: "trade";
  provider: ProviderId;
  environment: Environment;
  symbol: string;
  exchange: Exchange;
  timestamp: number;      // epoch ms (UTC)
  sequence: number;
  price: number;
  quantity: number;
  side: Side;              // aggressor side
  conditions?: string[];
}

/** Top-of-book quote. */
export interface QuoteEvent {
  type: "quote";
  provider: ProviderId;
  environment: Environment;
  symbol: string;
  exchange: Exchange;
  timestamp: number;
  sequence: number;
  bid: number;
  ask: number;
  bidSize: number;
  askSize: number;
}

/** Full or partial depth of book. */
export interface DepthLevel {
  price: number;
  size: number;
  side: Side;
  orders?: number;
}
export interface DepthEvent {
  type: "depth";
  provider: ProviderId;
  environment: Environment;
  symbol: string;
  exchange: Exchange;
  timestamp: number;
  sequence: number;
  levels: DepthLevel[];
}

/** Market-by-order (MBO) — only when provider genuinely supplies it. */
export interface MBOEvent {
  type: "mbo";
  provider: ProviderId;
  environment: Environment;
  symbol: string;
  exchange: Exchange;
  timestamp: number;
  sequence: number;
  orderId: string;
  side: Side;
  price: number;
  quantity: number;
  action: "add" | "update" | "remove" | "execute";
}

/** OHLCV bar. */
export interface Bar {
  t: number;   // bar open timestamp (epoch ms, UTC)
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  buyVol?: number;
  sellVol?: number;
}

export type BarEvent = Bar & {
  type: "bar";
  provider: ProviderId;
  environment: Environment;
  symbol: string;
  timeframe: Timeframe;
};

export type Timeframe =
  | "1m" | "5m" | "15m" | "30m"
  | "1h" | "4h"
  | "1d" | "1w";

export const TIMEFRAME_SECONDS: Record<Timeframe, number> = {
  "1m": 60, "5m": 300, "15m": 900, "30m": 1800,
  "1h": 3600, "4h": 14400, "1d": 86400, "1w": 604800,
};

/** Normalized order (execution domain). */
export type OrderSide = Side;
export type OrderType = "market" | "limit" | "stop" | "stop_limit";
export type OrderStatus =
  | "pending"
  | "working"
  | "filled"
  | "partially_filled"
  | "cancelled"
  | "rejected";

export interface Order {
  id: string;
  strategyId?: string;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  qty: number;
  filledQty: number;
  limitPrice?: number;
  stopPrice?: number;
  tif: "day" | "gtc" | "ioc" | "fok";
  status: OrderStatus;
  avgFillPrice?: number;
  createdAt: number;
  updatedAt: number;
}

export interface Execution {
  id: string;
  orderId: string;
  symbol: string;
  side: OrderSide;
  qty: number;
  price: number;
  commission: number;
  timestamp: number;
}

export interface Position {
  symbol: string;
  net: number;
  avgPrice: number;
  realized: number;
  unrealized: number;
}

export interface AccountSnapshot {
  accountId: string;
  environment: Environment;
  balance: number;
  equity: number;
  marginUsed: number;
  marginAvailable: number;
  currency: "USD" | "USDT";
}

export type ConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "stale"
  | "degraded"
  | "error";

export type DataStatus =
  | "LIVE"
  | "HISTORICAL"
  | "DELAYED"
  | "SIMULATED"
  | "STALE"
  | "DEGRADED"
  | "UNAVAILABLE"
  | "DISCONNECTED";
