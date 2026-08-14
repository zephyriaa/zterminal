import type { DataRequirement, RuleSpecRevision } from "./types";

const GATEIO_SYMBOLS = new Set(["QQQX_USDT"]);
const TIMEFRAME_PATTERN = /\b(1m|5m|15m|30m|1h|4h|1d)\b/i;
const SPECIAL_SERIES: Array<{ pattern: RegExp; label: string; detail: string }> = [
  { pattern: /\b(options? flow|implied volatility|iv|open interest)\b/i, label: "Options / derivatives series", detail: "Public Gate.io historical bars do not provide the required options or derivatives series." },
  { pattern: /\b(macro|cpi|gdp|unemployment|economic calendar)\b/i, label: "Macro-economic series", detail: "A time-aligned macro source or CSV import is required." },
  { pattern: /\b(order flow|footprint|market by order|mbo|level 2)\b/i, label: "Order-flow series", detail: "Historical public candle data is insufficient for this requirement." },
  { pattern: /\b(corporate action|dividend|split|survivorship)\b/i, label: "Corporate-action / survivorship data", detail: "An adjusted equities data source is required." },
];

function requirement(id: string, label: string, category: DataRequirement["category"], coverage: DataRequirement["coverage"], detail: string, risk: string): DataRequirement {
  return { id, label, category, coverage, detail, risk };
}

export function resolveDataRequirements(revision: Pick<RuleSpecRevision, "entry" | "exit" | "sizing">): DataRequirement[] {
  const combined = `${revision.entry}\n${revision.exit}\n${revision.sizing}`;
  const requirements: DataRequirement[] = [];
  const symbols = [...GATEIO_SYMBOLS].filter((symbol) => new RegExp(`\\b${symbol.replace("_", "[_ ]?")}\\b`, "i").test(combined));
  requirements.push(
    requirement(
      "instrument",
      "Instrument",
      "INSTRUMENT",
      symbols.length ? "NATIVE_VERIFIED" : "AMBIGUOUS",
      symbols.length ? `Verified native historical coverage is available for ${symbols.join(", ")}.` : "The rule text does not name a currently verified native instrument.",
      symbols.length ? "Coverage is limited to the declared native Gate.io perpetual contract." : "Clarify the exact tradable instrument before baseline generation."
    )
  );

  const timeframe = combined.match(TIMEFRAME_PATTERN)?.[0]?.toLowerCase();
  requirements.push(
    requirement(
      "timeframe",
      "Timeframe",
      "TIMEFRAME",
      timeframe ? "NATIVE_VERIFIED" : "AMBIGUOUS",
      timeframe ? `The rule explicitly names ${timeframe} bars.` : "No exact candle timeframe was found in the three extracted rules.",
      timeframe ? "Native coverage must still be bound to a fixed historical range." : "Timeframe ambiguity prevents an unambiguous backtest."
    )
  );

  requirements.push(
    requirement(
      "historical-bars",
      "Historical OHLCV bars",
      "BARS",
      "NATIVE_VERIFIED",
      "The current product can request public historical Gate.io candles for its verified mapped contract.",
      "Public provider corrections, coverage gaps, and exchange-specific microstructure remain visible provenance risks."
    )
  );

  if (/\b(lookback|last\s+\d+|previous\s+\d+)\b/i.test(combined)) {
    requirements.push(requirement("lookback", "Lookback window", "LOOKBACK", "AMBIGUOUS", "The rule appears to depend on prior observations but does not state an exact lookback length.", "Resolve the lookback rule before baseline generation."));
  }
  if (/\b(session|rth|overnight|ny|london|utc)\b/i.test(combined)) {
    requirements.push(requirement("session", "Session / calendar", "SESSION", "AMBIGUOUS", "The rule references session timing and needs an explicit exchange timezone/session policy.", "Session boundaries can materially alter results and cannot be silently inferred."));
  }

  for (const special of SPECIAL_SERIES) {
    if (special.pattern.test(combined)) {
      requirements.push(requirement(`special-${requirements.length}`, special.label, "SPECIAL_SERIES", "IMPORT_REQUIRED", special.detail, "Import a versioned external dataset and record coverage, licensing, and survivorship risk."));
    }
  }
  return requirements;
}

export function dataAssessmentReady(requirements: DataRequirement[]): boolean {
  return requirements.length > 0 && requirements.every((item) => item.coverage === "NATIVE_VERIFIED");
}
