/**
 * Provider abstraction layer.
 *
 * Analytics and the UI must NEVER depend on provider-specific code.
 * All providers implement MarketDataProvider. The Rithmic family
 * implements IRithmicProvider (R | Protocol API) — see
 * RITHMIC_INTEGRATION.md for the verified integration status.
 *
 * Status:
 *  - MockMarketDataProvider ....... IMPLEMENTED (SIMULATED)
 *  - RithmicTestProvider .......... INTERFACE ONLY (requires Rithmic
 *                                   Test dev-kit + credentials + conformance)
 *  - RithmicProductionProvider .... INTERFACE ONLY (production access
 *                                   requires authorization — NOT assumed)
 *  - MockRithmicProvider .......... IMPLEMENTED via MockLiveMarket
 *                                   (clearly SIMULATED; satisfies the
 *                                   IRithmicProvider contract for dev)
 *
 * NEVER expose Rithmic credentials to the browser. The Rithmic adapter
 * runs server-side only and reads credentials from environment secrets.
 */
import type {
  Bar,
  ContractMetadata,
  ConnectionState,
  DepthEvent,
  DepthLevel,
  Environment,
  ProviderId,
  QuoteEvent,
  Timeframe,
  TradeEvent,
} from "./types";

export interface SubscribeRequest {
  symbol: string;
  types: ("trade" | "quote" | "depth" | "mbo")[];
}

export interface MarketDataProvider {
  readonly id: ProviderId;
  readonly environment: Environment;
  /** Connection lifecycle — surfaced to the UI. */
  state(): ConnectionState;
  /** Synchronous list of known contracts (metadata). */
  contracts(): ContractMetadata[];
  /** Historical bars. Deterministic for the mock provider. */
  bars(symbol: string, tf: Timeframe, fromMs: number, toMs: number): Promise<Bar[]>;
  /** Begin streaming; returns an unsubscribe handle. */
  subscribe(req: SubscribeRequest, onEvent: (e: TradeEvent | QuoteEvent | DepthEvent) => void): () => void;
}

/**
 * Rithmic provider contract (R | Protocol API).
 *
 * The methods below mirror the lifecycle required by the Rithmic
 * adapter: connection, authentication, subscriptions, heartbeats,
 * reconnection, sequence validation, error handling, and subscription
 * restoration. Implementation requires the official Rithmic protobuf
 * dev-kit and credentials — NOT bundled here.
 */
export interface IRithmicProvider extends MarketDataProvider {
  readonly id: "rithmic-test" | "rithmic-prod";
  /** Authenticate using server-side credentials. */
  login(): Promise<void>;
  /** Send / verify heartbeat. */
  heartbeat(): Promise<void>;
  /** Restore all subscriptions after a reconnect. */
  restoreSubscriptions(): Promise<void>;
  /** Validate inbound sequence numbers; reject gaps. */
  validateSequence(symbol: string, seq: number): boolean;
  /** Graceful teardown. */
  logout(): Promise<void>;
}

export type { DepthLevel };
