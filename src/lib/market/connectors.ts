/**
 * Z Terminal — Market Data Connector Architecture
 * 
 * Extensible, read-only data connector abstraction for built-in exchange feeds,
 * custom WebSocket feeds, custom REST endpoints, and local historical datasets.
 *
 * Security Principles:
 * - Strictly READ-ONLY: Never requests trading or withdrawal privileges.
 * - Secret Safety: API keys or secrets are NEVER stored in localStorage,
 *   sessionStorage, plain text files, or git.
 * - No Arbitrary Eval: Field mappings use safe property selectors, never arbitrary JS.
 */

import type { ProviderId } from "./types";

export type ConnectorType = "builtin" | "custom-ws" | "custom-rest" | "local-file";

export type ConnectorCapability =
  | "live_trades"
  | "ohlcv"
  | "depth"
  | "funding"
  | "open_interest"
  | "liquidations"
  | "historical_archive";

export interface DataFeedDiagnostics {
  providerId: ProviderId | string;
  providerName: string;
  transport: "WebSocket" | "REST" | "Local File";
  status: "connected" | "connecting" | "reconnecting" | "stale" | "disconnected" | "error";
  dataStatus: string;
  lastUpdateMs?: number;
  latencyMs?: number;
  symbol: string;
  contractType: string;
  healthReason?: string;
  messageCount?: number;
}

export interface ConnectorInfo {
  id: string;
  name: string;
  type: ConnectorType;
  transport: "WebSocket" | "REST" | "Local Disk";
  readOnly: true;
  status: "connected" | "connecting" | "reconnecting" | "stale" | "disconnected" | "error";
  capabilities: ConnectorCapability[];
  notice: string;
  endpoint?: string;
  symbolCount?: number;
}

export interface FieldMapping {
  timestamp: string; // e.g. "t" or "timestamp"
  symbol: string;    // e.g. "s" or "symbol"
  open: string;      // e.g. "o"
  high: string;      // e.g. "h"
  low: string;       // e.g. "l"
  close: string;     // e.g. "c"
  volume: string;    // e.g. "v"
}

export interface CustomConnectorConfig {
  id: string;
  name: string;
  type: "custom-ws" | "custom-rest";
  endpoint: string;
  authType: "none" | "header" | "query";
  headerName?: string;
  // Masked or runtime-only token reference, never plain stored secret
  hasCredential?: boolean;
  subscriptionPayload?: string;
  pollIntervalSec?: number;
  mapping: FieldMapping;
  createdAt: number;
}

export interface ConnectionTestCheck {
  id: string;
  name: string;
  passed: boolean;
  message: string;
}

export interface ConnectionTestResult {
  success: boolean;
  checks: ConnectionTestCheck[];
  sampleCandle?: {
    timestamp: number;
    symbol: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  };
  error?: string;
}

/** Built-in connectors catalogue */
export const BUILTIN_CONNECTORS: ConnectorInfo[] = [
  {
    id: "gateio",
    name: "Gate.io Futures",
    type: "builtin",
    transport: "WebSocket",
    readOnly: true,
    status: "connected",
    capabilities: ["live_trades", "ohlcv", "depth", "funding", "open_interest"],
    notice: "Verified production perpetuals stream. Public market-data read only.",
  },
  {
    id: "binance",
    name: "Binance Futures",
    type: "builtin",
    transport: "WebSocket",
    readOnly: true,
    status: "disconnected",
    capabilities: ["live_trades", "ohlcv", "depth", "funding", "open_interest", "liquidations"],
    notice: "Public adapter available. Regional and network verification required.",
  },
  {
    id: "mock",
    name: "Simulation Provider",
    type: "builtin",
    transport: "WebSocket",
    readOnly: true,
    status: "disconnected",
    capabilities: ["live_trades", "ohlcv", "historical_archive"],
    notice: "Deterministic market simulation generator for backtesting and UI development.",
  },
  {
    id: "local_cache",
    name: "Local Datasets (CSV/Parquet)",
    type: "local-file",
    transport: "Local Disk",
    readOnly: true,
    status: "connected",
    capabilities: ["ohlcv", "historical_archive"],
    notice: "Local historical research datasets. Read-only, stored in browser IndexedDB/cache.",
  },
];

/** Safe path resolver for JSON mapping without eval */
export function extractMappedValue(obj: Record<string, unknown>, path: string): unknown {
  if (!path) return undefined;
  const cleanPath = path.replace(/^\$\.?/, "");
  const keys = cleanPath.split(".");
  let curr: unknown = obj;
  for (const k of keys) {
    if (curr == null || typeof curr !== "object") return undefined;
    curr = (curr as Record<string, unknown>)[k];
  }
  return curr;
}

/** Validate and test a mock/custom payload against specified mapping */
export function testMappingOnPayload(
  payload: Record<string, unknown>,
  mapping: FieldMapping
): ConnectionTestResult {
  const checks: ConnectionTestCheck[] = [];

  // Check 1: Endpoint data parsed
  checks.push({
    id: "payload_received",
    name: "Payload parsed",
    passed: Boolean(payload && typeof payload === "object"),
    message: "Structured JSON data received.",
  });

  // Check 2: Timestamp
  const rawTime = extractMappedValue(payload, mapping.timestamp);
  let timeValid = false;
  let parsedTime = 0;
  if (typeof rawTime === "number" && rawTime > 0) {
    parsedTime = rawTime > 1e11 ? rawTime : rawTime * 1000;
    timeValid = Number.isFinite(parsedTime);
  } else if (typeof rawTime === "string") {
    parsedTime = new Date(rawTime).getTime();
    timeValid = Number.isFinite(parsedTime);
  }
  checks.push({
    id: "timestamp_valid",
    name: "Timestamp detected",
    passed: timeValid,
    message: timeValid ? `Timestamp resolved: ${new Date(parsedTime).toISOString()}` : "Timestamp field missing or invalid format.",
  });

  // Check 3: Symbol
  const rawSymbol = extractMappedValue(payload, mapping.symbol);
  const symbolValid = typeof rawSymbol === "string" && rawSymbol.length > 0;
  checks.push({
    id: "symbol_valid",
    name: "Symbol detected",
    passed: symbolValid,
    message: symbolValid ? `Symbol resolved: ${rawSymbol}` : "Symbol field missing or not a string.",
  });

  // Check 4: OHLC
  const rawO = Number(extractMappedValue(payload, mapping.open));
  const rawH = Number(extractMappedValue(payload, mapping.high));
  const rawL = Number(extractMappedValue(payload, mapping.low));
  const rawC = Number(extractMappedValue(payload, mapping.close));
  const ohlcValid =
    Number.isFinite(rawO) &&
    Number.isFinite(rawH) &&
    Number.isFinite(rawL) &&
    Number.isFinite(rawC) &&
    rawH >= Math.min(rawO, rawL, rawC) &&
    rawL <= Math.max(rawO, rawH, rawC);

  checks.push({
    id: "ohlc_valid",
    name: "OHLC geometry valid",
    passed: ohlcValid,
    message: ohlcValid
      ? `O:${rawO} H:${rawH} L:${rawL} C:${rawC}`
      : "One or more OHLC fields invalid or high/low invariant violated.",
  });

  // Check 5: Volume
  const rawV = Number(extractMappedValue(payload, mapping.volume));
  const volValid = Number.isFinite(rawV) && rawV >= 0;
  checks.push({
    id: "volume_valid",
    name: "Volume field valid",
    passed: volValid,
    message: volValid ? `Volume: ${rawV}` : "Volume field missing or negative.",
  });

  const allPassed = checks.every((c) => c.passed);

  return {
    success: allPassed,
    checks,
    sampleCandle: allPassed
      ? {
          timestamp: parsedTime,
          symbol: String(rawSymbol),
          open: rawO,
          high: rawH,
          low: rawL,
          close: rawC,
          volume: rawV,
        }
      : undefined,
  };
}
