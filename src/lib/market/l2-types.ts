/**
 * Z TERMINAL — Level 2 Order Book & Feed Health Contracts.
 * Strict research integrity: missing or desynchronized feeds explicitly show as
 * UNAVAILABLE or FEED: DISCONNECTED.
 */

export type FeedHealthStatus =
  | 'CONNECTING'
  | 'LIVE'
  | 'RECONNECTING'
  | 'DEGRADED'
  | 'FAILED'
  | 'UNAVAILABLE';

export type L2Exchange = 'binance' | 'okx' | 'coinbase';

export interface L2OrderBookSnapshot {
  exchange: L2Exchange;
  symbol: string;
  sequence: number;
  timestamp: number;
  bids: [price: number, size: number][];
  asks: [price: number, size: number][];
  health?: FeedHealthStatus;
}

export interface L2DeltaUpdate {
  exchange: L2Exchange;
  symbol: string;
  sequence: number;
  prevSequence?: number;
  timestamp: number;
  bids: [price: number, size: number][];
  asks: [price: number, size: number][];
  isSnapshot?: boolean;
}
