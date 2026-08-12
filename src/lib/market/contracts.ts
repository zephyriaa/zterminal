/**
 * Contract definitions. Futures are explicitly modeled with expiry —
 * they are NOT treated as perpetual instruments. Continuous contracts
 * must be explicitly constructed (see CONTINUOUS note below).
 *
 * Prices/volatility here are realistic reference levels used ONLY by
 * the SIMULATED mock provider for synthetic data generation.
 */
import type { ContractMetadata, SessionId } from "./types";

export interface ContractDef extends ContractMetadata {
  basePrice: number;     // reference level (mock only)
  dailyVolPct: number;   // daily volatility (mock only)
}

// Futures expiry helper: quarterly Mar(3)/Jun(6)/Sep(9)/Dec(12)
function futExpiry(year: number, month: number): string {
  // 3rd Friday of the month
  const d = new Date(Date.UTC(year, month - 1, 1));
  const dow = d.getUTCDay(); // 0=Sun
  const firstFriday = dow <= 5 ? 5 - dow : 12 - dow;
  const thirdFriday = firstFriday + 14;
  return new Date(Date.UTC(year, month - 1, thirdFriday)).toISOString().slice(0, 10);
}

/** Front-month futures symbols currently modeled. */
export const CONTRACTS: Record<string, ContractDef> = {
  NQ: {
    root: "NQ", symbol: "NQ", description: "E-mini Nasdaq-100 Futures",
    exchange: "CME", product: "future",
    tickSize: 0.25, tickValue: 5, multiplier: 20, currency: "USD",
    session: "cme", supportsDepth: true, supportsMBO: true,
    basePrice: 21450, dailyVolPct: 0.013,
  },
  MNQ: {
    root: "MNQ", symbol: "MNQ", description: "Micro E-mini Nasdaq-100 Futures",
    exchange: "CME", product: "future",
    tickSize: 0.25, tickValue: 0.5, multiplier: 2, currency: "USD",
    session: "cme", supportsDepth: true, supportsMBO: true,
    basePrice: 21450, dailyVolPct: 0.013,
  },
  ES: {
    root: "ES", symbol: "ES", description: "E-mini S&P 500 Futures",
    exchange: "CME", product: "future",
    tickSize: 0.25, tickValue: 12.5, multiplier: 50, currency: "USD",
    session: "cme", supportsDepth: true, supportsMBO: true,
    basePrice: 6050, dailyVolPct: 0.009,
  },
  MES: {
    root: "MES", symbol: "MES", description: "Micro E-mini S&P 500 Futures",
    exchange: "CME", product: "future",
    tickSize: 0.25, tickValue: 1.25, multiplier: 5, currency: "USD",
    session: "cme", supportsDepth: true, supportsMBO: true,
    basePrice: 6050, dailyVolPct: 0.009,
  },
  QQQ: {
    root: "QQQ", symbol: "QQQ", description: "Invesco QQQ Trust",
    exchange: "NASDAQ", product: "equity",
    tickSize: 0.01, tickValue: 0.01, multiplier: 1, currency: "USD",
    session: "equity", supportsDepth: false, supportsMBO: false,
    basePrice: 525, dailyVolPct: 0.011,
  },
  SPY: {
    root: "SPY", symbol: "SPY", description: "SPDR S&P 500 ETF Trust",
    exchange: "NYSE", product: "equity",
    tickSize: 0.01, tickValue: 0.01, multiplier: 1, currency: "USD",
    session: "equity", supportsDepth: false, supportsMBO: false,
    basePrice: 605, dailyVolPct: 0.008,
  },
};

export function getContract(symbol: string): ContractDef {
  const s = symbol.toUpperCase();
  return CONTRACTS[s] ?? CONTRACTS.NQ;
}

export function listContracts(): ContractDef[] {
  return Object.values(CONTRACTS);
}

/**
 * Continuous-contract note (per BACKTESTING.md):
 * A continuous series MUST be explicitly built by rolling on the
 * configured roll date and adjusting via ratio (back) or pan (price)
 * method. The mock provider currently exposes a single front-month
 * synthetic series for simulation; real continuous construction is a
 * documented roadmap item.
 */
export const SESSION_NOTE =
  "CME ETH sessions: 18:00 ET prior day → 17:00 ET (Sun-Fri). RTH equity: 09:30–16:00 ET.";

export const _futExpiry = futExpiry;
