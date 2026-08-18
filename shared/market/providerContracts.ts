export const PROVIDER_IDS = ["gateio", "mock", "deribit_options", "rithmic"] as const;

export type ProviderId = (typeof PROVIDER_IDS)[number];
export type ProviderLifecycle = "ACTIVE" | "CATALOGUED" | "BLOCKED";
export type ProviderAccess = "PUBLIC_READ_ONLY" | "DEVELOPMENT_ONLY" | "CREDENTIALS_REQUIRED";
export type ProviderCapability =
  | "SNAPSHOT"
  | "HISTORICAL_CANDLES"
  | "CONTRACT_METADATA"
  | "PUBLIC_TRADES"
  | "BEST_BID_OFFER"
  | "ORDER_BOOK_DEPTH"
  | "CANDLE_STREAM"
  | "OPTIONS_CHAIN"
  | "GREEKS"
  | "OPEN_INTEREST_BY_STRIKE";
export type ProviderCapabilityState = "AVAILABLE" | "VERIFYING" | "UNAVAILABLE";

export type ProviderCapabilityDetail = {
  capability: ProviderCapability;
  state: ProviderCapabilityState;
  reason: string;
};

export type ProviderCatalogEntry = {
  id: ProviderId;
  label: string;
  lifecycle: ProviderLifecycle;
  access: ProviderAccess;
  environments: readonly ("PRODUCTION" | "TESTNET" | "LOCAL")[];
  capabilities: readonly ProviderCapabilityDetail[];
  notice: string;
};

export const PROVIDER_CATALOG: readonly ProviderCatalogEntry[] = [
  {
    id: "gateio",
    label: "Gate.io USDT Perpetuals",
    lifecycle: "ACTIVE",
    access: "PUBLIC_READ_ONLY",
    environments: ["PRODUCTION", "TESTNET"],
    capabilities: [
      { capability: "SNAPSHOT", state: "AVAILABLE", reason: "Public REST ticker endpoint is used by the canonical market contract." },
      { capability: "HISTORICAL_CANDLES", state: "AVAILABLE", reason: "Public REST candle endpoint is used with bounded range semantics and coverage disclosure." },
      { capability: "CONTRACT_METADATA", state: "AVAILABLE", reason: "Public futures contract metadata is available through the provider contract endpoint." },
      { capability: "PUBLIC_TRADES", state: "VERIFYING", reason: "Official taker-side semantics are documented; canonical stream, reconnect, and deduplication fixtures are not yet released." },
      { capability: "BEST_BID_OFFER", state: "VERIFYING", reason: "A public WebSocket channel exists; canonical lifecycle and stale-state verification is pending." },
      { capability: "ORDER_BOOK_DEPTH", state: "VERIFYING", reason: "Snapshot-plus-sequenced-delta reconciliation is documented but not yet implemented in the canonical runtime." },
      { capability: "CANDLE_STREAM", state: "VERIFYING", reason: "A public WebSocket channel exists; canonical lifecycle and candle-close contract verification is pending." },
      { capability: "OPTIONS_CHAIN", state: "UNAVAILABLE", reason: "USDT perpetual market data is not an options-chain source." },
      { capability: "GREEKS", state: "UNAVAILABLE", reason: "USDT perpetual market data does not provide options Greeks." },
      { capability: "OPEN_INTEREST_BY_STRIKE", state: "UNAVAILABLE", reason: "USDT perpetual market data does not provide options open interest by strike." },
    ],
    notice: "Active public read-only provider. All real-time order-flow capabilities remain unavailable until their stream-contract release gates pass.",
  },
  {
    id: "mock",
    label: "Deterministic simulated provider",
    lifecycle: "CATALOGUED",
    access: "DEVELOPMENT_ONLY",
    environments: ["LOCAL"],
    capabilities: [
      { capability: "SNAPSHOT", state: "VERIFYING", reason: "Legacy deterministic generator must be ported with seed and labeling tests." },
      { capability: "HISTORICAL_CANDLES", state: "VERIFYING", reason: "Legacy deterministic generator must be ported with seed and labeling tests." },
      { capability: "CONTRACT_METADATA", state: "VERIFYING", reason: "Metadata must be explicitly simulated and never presented as exchange sourced." },
      { capability: "PUBLIC_TRADES", state: "UNAVAILABLE", reason: "Simulated data is not a verified public trade tape." },
      { capability: "BEST_BID_OFFER", state: "UNAVAILABLE", reason: "Simulated data is not a verified exchange BBO feed." },
      { capability: "ORDER_BOOK_DEPTH", state: "UNAVAILABLE", reason: "Simulated depth must not be presented as market depth." },
      { capability: "CANDLE_STREAM", state: "UNAVAILABLE", reason: "No canonical simulated stream has been released." },
      { capability: "OPTIONS_CHAIN", state: "UNAVAILABLE", reason: "No options simulation is in scope." },
      { capability: "GREEKS", state: "UNAVAILABLE", reason: "No options simulation is in scope." },
      { capability: "OPEN_INTEREST_BY_STRIKE", state: "UNAVAILABLE", reason: "No options simulation is in scope." },
    ],
    notice: "Catalogued only. It may be enabled in local development after deterministic fixtures and explicit SIMULATED labeling are complete.",
  },
  {
    id: "deribit_options",
    label: "Deribit options",
    lifecycle: "CATALOGUED",
    access: "PUBLIC_READ_ONLY",
    environments: ["PRODUCTION", "TESTNET"],
    capabilities: [
      { capability: "SNAPSHOT", state: "UNAVAILABLE", reason: "No canonical adapter is implemented." },
      { capability: "HISTORICAL_CANDLES", state: "UNAVAILABLE", reason: "No canonical adapter is implemented." },
      { capability: "CONTRACT_METADATA", state: "UNAVAILABLE", reason: "No canonical adapter is implemented." },
      { capability: "PUBLIC_TRADES", state: "UNAVAILABLE", reason: "No canonical adapter is implemented." },
      { capability: "BEST_BID_OFFER", state: "UNAVAILABLE", reason: "No canonical adapter is implemented." },
      { capability: "ORDER_BOOK_DEPTH", state: "UNAVAILABLE", reason: "No canonical adapter is implemented." },
      { capability: "CANDLE_STREAM", state: "UNAVAILABLE", reason: "No canonical adapter is implemented." },
      { capability: "OPTIONS_CHAIN", state: "VERIFYING", reason: "A provider candidate exists; market, license, and canonical adapter contracts are not yet approved." },
      { capability: "GREEKS", state: "VERIFYING", reason: "A provider candidate exists; market, license, and canonical adapter contracts are not yet approved." },
      { capability: "OPEN_INTEREST_BY_STRIKE", state: "VERIFYING", reason: "A provider candidate exists; market, license, and canonical adapter contracts are not yet approved." },
    ],
    notice: "Catalogued provider candidate. It must not power GEX until entitlement, methodology, and adapter verification are complete.",
  },
  {
    id: "rithmic",
    label: "Rithmic futures",
    lifecycle: "BLOCKED",
    access: "CREDENTIALS_REQUIRED",
    environments: ["PRODUCTION"],
    capabilities: [
      { capability: "SNAPSHOT", state: "UNAVAILABLE", reason: "Credentials and a verified integration environment are not configured." },
      { capability: "HISTORICAL_CANDLES", state: "UNAVAILABLE", reason: "Credentials and a verified integration environment are not configured." },
      { capability: "CONTRACT_METADATA", state: "UNAVAILABLE", reason: "Credentials and a verified integration environment are not configured." },
      { capability: "PUBLIC_TRADES", state: "UNAVAILABLE", reason: "Credentials and a verified integration environment are not configured." },
      { capability: "BEST_BID_OFFER", state: "UNAVAILABLE", reason: "Credentials and a verified integration environment are not configured." },
      { capability: "ORDER_BOOK_DEPTH", state: "UNAVAILABLE", reason: "Credentials and a verified integration environment are not configured." },
      { capability: "CANDLE_STREAM", state: "UNAVAILABLE", reason: "Credentials and a verified integration environment are not configured." },
      { capability: "OPTIONS_CHAIN", state: "UNAVAILABLE", reason: "No options entitlement or adapter is configured." },
      { capability: "GREEKS", state: "UNAVAILABLE", reason: "No options entitlement or adapter is configured." },
      { capability: "OPEN_INTEREST_BY_STRIKE", state: "UNAVAILABLE", reason: "No options entitlement or adapter is configured." },
    ],
    notice: "Blocked until the user provides a valid development-kit and credential path; no connection attempt is made by ZTerminal.",
  },
] as const;

export type MarketContractMetadata = {
  provider: "gateio";
  nativeSymbol: string;
  displaySymbol: string;
  product: "PERPETUAL";
  settlementAsset: "USDT";
  tickSize: number | null;
  multiplier: number | null;
  inDelisting: boolean | null;
  source: "gateio-futures-contracts";
  fetchedAt: number;
};

function finiteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function displaySymbol(nativeSymbol: string): string {
  const [base, quote] = nativeSymbol.split("_");
  return base && quote ? `${base}/${quote}` : nativeSymbol;
}

/** Converts a public Gate.io futures-contract record without inferring unsupported metadata. */
export function gateContractToMarketMetadata(value: unknown, fetchedAt: number): MarketContractMetadata | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const nativeSymbol = typeof record.name === "string" ? record.name.trim().toUpperCase() : "";
  if (!/^[A-Z0-9]+_USDT$/.test(nativeSymbol)) return null;
  const inDelisting = typeof record.in_delisting === "boolean" ? record.in_delisting : null;
  return {
    provider: "gateio",
    nativeSymbol,
    displaySymbol: displaySymbol(nativeSymbol),
    product: "PERPETUAL",
    settlementAsset: "USDT",
    tickSize: finiteNumber(record.order_price_round),
    multiplier: finiteNumber(record.quanto_multiplier),
    inDelisting,
    source: "gateio-futures-contracts",
    fetchedAt,
  };
}

export function getProviderCatalogEntry(id: ProviderId): ProviderCatalogEntry | null {
  return PROVIDER_CATALOG.find(provider => provider.id === id) ?? null;
}

export function providerCapability(entry: ProviderCatalogEntry, capability: ProviderCapability): ProviderCapabilityDetail | null {
  return entry.capabilities.find(item => item.capability === capability) ?? null;
}
