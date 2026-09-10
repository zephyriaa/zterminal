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
  // Top Cryptocurrencies
  BTCUSDT: {
    root: "BTC", symbol: "BTCUSDT", description: "Bitcoin / USDT Perpetual",
    exchange: "BINANCE", product: "perpetual",
    tickSize: 0.1, tickValue: 0.1, multiplier: 1, currency: "USDT",
    session: "crypto", supportsDepth: true, supportsMBO: false,
    basePrice: 100_000, dailyVolPct: 0.025,
  },
  ETHUSDT: {
    root: "ETH", symbol: "ETHUSDT", description: "Ethereum / USDT Perpetual",
    exchange: "BINANCE", product: "perpetual",
    tickSize: 0.01, tickValue: 0.01, multiplier: 1, currency: "USDT",
    session: "crypto", supportsDepth: true, supportsMBO: false,
    basePrice: 3_200, dailyVolPct: 0.03,
  },
  SOLUSDT: {
    root: "SOL", symbol: "SOLUSDT", description: "Solana / USDT Perpetual",
    exchange: "BINANCE", product: "perpetual",
    tickSize: 0.01, tickValue: 0.01, multiplier: 1, currency: "USDT",
    session: "crypto", supportsDepth: true, supportsMBO: false,
    basePrice: 180, dailyVolPct: 0.045,
  },
  XRPUSDT: {
    root: "XRP", symbol: "XRPUSDT", description: "XRP / USDT Perpetual",
    exchange: "BINANCE", product: "perpetual",
    tickSize: 0.0001, tickValue: 0.0001, multiplier: 1, currency: "USDT",
    session: "crypto", supportsDepth: true, supportsMBO: false,
    basePrice: 2.2, dailyVolPct: 0.05,
  },
  DOGEUSDT: {
    root: "DOGE", symbol: "DOGEUSDT", description: "Dogecoin / USDT Perpetual",
    exchange: "BINANCE", product: "perpetual",
    tickSize: 0.00001, tickValue: 0.00001, multiplier: 1, currency: "USDT",
    session: "crypto", supportsDepth: true, supportsMBO: false,
    basePrice: 0.25, dailyVolPct: 0.06,
  },
  BNBUSDT: {
    root: "BNB", symbol: "BNBUSDT", description: "BNB / USDT Perpetual",
    exchange: "BINANCE", product: "perpetual",
    tickSize: 0.01, tickValue: 0.01, multiplier: 1, currency: "USDT",
    session: "crypto", supportsDepth: true, supportsMBO: false,
    basePrice: 650, dailyVolPct: 0.025,
  },
  SUIUSDT: {
    root: "SUI", symbol: "SUIUSDT", description: "Sui / USDT Perpetual",
    exchange: "BINANCE", product: "perpetual",
    tickSize: 0.0001, tickValue: 0.0001, multiplier: 1, currency: "USDT",
    session: "crypto", supportsDepth: true, supportsMBO: false,
    basePrice: 3.5, dailyVolPct: 0.055,
  },
  PEPEUSDT: {
    root: "PEPE", symbol: "PEPEUSDT", description: "Pepe / USDT Perpetual",
    exchange: "BINANCE", product: "perpetual",
    tickSize: 0.0000001, tickValue: 0.0000001, multiplier: 1, currency: "USDT",
    session: "crypto", supportsDepth: true, supportsMBO: false,
    basePrice: 0.000012, dailyVolPct: 0.07,
  },
  NEARUSDT: {
    root: "NEAR", symbol: "NEARUSDT", description: "NEAR Protocol / USDT Perpetual",
    exchange: "BINANCE", product: "perpetual",
    tickSize: 0.001, tickValue: 0.001, multiplier: 1, currency: "USDT",
    session: "crypto", supportsDepth: true, supportsMBO: false,
    basePrice: 6.8, dailyVolPct: 0.05,
  },
  AVAXUSDT: {
    root: "AVAX", symbol: "AVAXUSDT", description: "Avalanche / USDT Perpetual",
    exchange: "BINANCE", product: "perpetual",
    tickSize: 0.01, tickValue: 0.01, multiplier: 1, currency: "USDT",
    session: "crypto", supportsDepth: true, supportsMBO: false,
    basePrice: 35, dailyVolPct: 0.045,
  },
  LINKUSDT: {
    root: "LINK", symbol: "LINKUSDT", description: "Chainlink / USDT Perpetual",
    exchange: "BINANCE", product: "perpetual",
    tickSize: 0.001, tickValue: 0.001, multiplier: 1, currency: "USDT",
    session: "crypto", supportsDepth: true, supportsMBO: false,
    basePrice: 22, dailyVolPct: 0.04,
  },
  ADAUSDT: {
    root: "ADA", symbol: "ADAUSDT", description: "Cardano / USDT Perpetual",
    exchange: "BINANCE", product: "perpetual",
    tickSize: 0.0001, tickValue: 0.0001, multiplier: 1, currency: "USDT",
    session: "crypto", supportsDepth: true, supportsMBO: false,
    basePrice: 0.95, dailyVolPct: 0.045,
  },
  APTUSDT: {
    root: "APT", symbol: "APTUSDT", description: "Aptos / USDT Perpetual",
    exchange: "BINANCE", product: "perpetual",
    tickSize: 0.001, tickValue: 0.001, multiplier: 1, currency: "USDT",
    session: "crypto", supportsDepth: true, supportsMBO: false,
    basePrice: 11.5, dailyVolPct: 0.05,
  },
  ARBUSDT: {
    root: "ARB", symbol: "ARBUSDT", description: "Arbitrum / USDT Perpetual",
    exchange: "BINANCE", product: "perpetual",
    tickSize: 0.0001, tickValue: 0.0001, multiplier: 1, currency: "USDT",
    session: "crypto", supportsDepth: true, supportsMBO: false,
    basePrice: 0.85, dailyVolPct: 0.055,
  },
  OPUSDT: {
    root: "OP", symbol: "OPUSDT", description: "Optimism / USDT Perpetual",
    exchange: "BINANCE", product: "perpetual",
    tickSize: 0.0001, tickValue: 0.0001, multiplier: 1, currency: "USDT",
    session: "crypto", supportsDepth: true, supportsMBO: false,
    basePrice: 1.75, dailyVolPct: 0.055,
  },
  TIAUSDT: {
    root: "TIA", symbol: "TIAUSDT", description: "Celestia / USDT Perpetual",
    exchange: "BINANCE", product: "perpetual",
    tickSize: 0.001, tickValue: 0.001, multiplier: 1, currency: "USDT",
    session: "crypto", supportsDepth: true, supportsMBO: false,
    basePrice: 7.2, dailyVolPct: 0.06,
  },
  RENDERUSDT: {
    root: "RENDER", symbol: "RENDERUSDT", description: "Render / USDT Perpetual",
    exchange: "BINANCE", product: "perpetual",
    tickSize: 0.001, tickValue: 0.001, multiplier: 1, currency: "USDT",
    session: "crypto", supportsDepth: true, supportsMBO: false,
    basePrice: 8.5, dailyVolPct: 0.055,
  },
  INJUSDT: {
    root: "INJ", symbol: "INJUSDT", description: "Injective / USDT Perpetual",
    exchange: "BINANCE", product: "perpetual",
    tickSize: 0.001, tickValue: 0.001, multiplier: 1, currency: "USDT",
    session: "crypto", supportsDepth: true, supportsMBO: false,
    basePrice: 28, dailyVolPct: 0.055,
  },
  FETUSDT: {
    root: "FET", symbol: "FETUSDT", description: "Artificial Superintelligence Alliance / USDT Perpetual",
    exchange: "BINANCE", product: "perpetual",
    tickSize: 0.0001, tickValue: 0.0001, multiplier: 1, currency: "USDT",
    session: "crypto", supportsDepth: true, supportsMBO: false,
    basePrice: 1.6, dailyVolPct: 0.06,
  },
  LTCUSDT: {
    root: "LTC", symbol: "LTCUSDT", description: "Litecoin / USDT Perpetual",
    exchange: "BINANCE", product: "perpetual",
    tickSize: 0.01, tickValue: 0.01, multiplier: 1, currency: "USDT",
    session: "crypto", supportsDepth: true, supportsMBO: false,
    basePrice: 110, dailyVolPct: 0.035,
  },
  SHIBUSDT: {
    root: "SHIB", symbol: "SHIBUSDT", description: "Shiba Inu / USDT Perpetual",
    exchange: "BINANCE", product: "perpetual",
    tickSize: 0.000001, tickValue: 0.000001, multiplier: 1, currency: "USDT",
    session: "crypto", supportsDepth: true, supportsMBO: false,
    basePrice: 0.000022, dailyVolPct: 0.065,
  },
  DOTUSDT: {
    root: "DOT", symbol: "DOTUSDT", description: "Polkadot / USDT Perpetual",
    exchange: "BINANCE", product: "perpetual",
    tickSize: 0.001, tickValue: 0.001, multiplier: 1, currency: "USDT",
    session: "crypto", supportsDepth: true, supportsMBO: false,
    basePrice: 8.5, dailyVolPct: 0.045,
  },
  QQQX_USDT: {
    root: "QQQX", symbol: "QQQX_USDT", description: "QQQX / USDT Perpetual (Gate.io)",
    exchange: "GATEIO", product: "perpetual",
    tickSize: 0.01, tickValue: 0.0001, multiplier: 0.01, currency: "USDT",
    session: "crypto", supportsDepth: true, supportsMBO: false,
    basePrice: 600, dailyVolPct: 0.02,
  },

  // Index & Commodity Futures
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

  // Equities & Major ETFs
  SPY: {
    root: "SPY", symbol: "SPY", description: "SPDR S&P 500 ETF Trust",
    exchange: "NYSE", product: "equity",
    tickSize: 0.01, tickValue: 0.01, multiplier: 1, currency: "USD",
    session: "equity", supportsDepth: false, supportsMBO: false,
    basePrice: 605, dailyVolPct: 0.008,
  },
  QQQ: {
    root: "QQQ", symbol: "QQQ", description: "Invesco QQQ Trust",
    exchange: "NASDAQ", product: "equity",
    tickSize: 0.01, tickValue: 0.01, multiplier: 1, currency: "USD",
    session: "equity", supportsDepth: false, supportsMBO: false,
    basePrice: 525, dailyVolPct: 0.011,
  },
  NVDA: {
    root: "NVDA", symbol: "NVDA", description: "NVIDIA Corporation",
    exchange: "NASDAQ", product: "equity",
    tickSize: 0.01, tickValue: 0.01, multiplier: 1, currency: "USD",
    session: "equity", supportsDepth: false, supportsMBO: false,
    basePrice: 140, dailyVolPct: 0.025,
  },
  AAPL: {
    root: "AAPL", symbol: "AAPL", description: "Apple Inc.",
    exchange: "NASDAQ", product: "equity",
    tickSize: 0.01, tickValue: 0.01, multiplier: 1, currency: "USD",
    session: "equity", supportsDepth: false, supportsMBO: false,
    basePrice: 235, dailyVolPct: 0.012,
  },
  TSLA: {
    root: "TSLA", symbol: "TSLA", description: "Tesla, Inc.",
    exchange: "NASDAQ", product: "equity",
    tickSize: 0.01, tickValue: 0.01, multiplier: 1, currency: "USD",
    session: "equity", supportsDepth: false, supportsMBO: false,
    basePrice: 280, dailyVolPct: 0.035,
  },
  GLD: {
    root: "GLD", symbol: "GLD", description: "SPDR Gold Shares ETF",
    exchange: "NYSE", product: "equity",
    tickSize: 0.01, tickValue: 0.01, multiplier: 1, currency: "USD",
    session: "equity", supportsDepth: false, supportsMBO: false,
    basePrice: 260, dailyVolPct: 0.009,
  },
  USO: {
    root: "USO", symbol: "USO", description: "United States Oil Fund",
    exchange: "NYSE", product: "equity",
    tickSize: 0.01, tickValue: 0.01, multiplier: 1, currency: "USD",
    session: "equity", supportsDepth: false, supportsMBO: false,
    basePrice: 75, dailyVolPct: 0.018,
  },
};

const runtimeContracts = new Map<string, ContractDef>();

/** Registers contracts emitted by the active provider adapter after schema validation. */
export function registerRuntimeContracts(contracts: ContractMetadata[]) {
  for (const contract of contracts) {
    if (!contract?.symbol || !Number.isFinite(contract.tickSize) || contract.tickSize <= 0) continue;
    runtimeContracts.set(contract.symbol.toUpperCase(), {
      ...contract,
      basePrice: 100,
      dailyVolPct: 0.03,
    });
  }
}

export function getContract(symbol: string): ContractDef {
  const s = symbol.toUpperCase().trim();
  const direct = runtimeContracts.get(s) ?? CONTRACTS[s];
  if (direct) return direct;
  // Handle alias normalizations like BTC_USDT -> BTCUSDT
  const stripped = s.replace(/[^A-Z0-9]/g, "");
  const strippedMatch = runtimeContracts.get(stripped) ?? CONTRACTS[stripped];
  if (strippedMatch) return strippedMatch;
  return CONTRACTS.BTCUSDT;
}

export function listContracts(): ContractDef[] {
  return [...Object.values(CONTRACTS), ...runtimeContracts.values()];
}

export function formatSymbol(symbol: string): string {
  if (!symbol) return "";
  if (symbol.includes("_")) return symbol.replace("_", " / ");
  if (symbol.endsWith("USDT")) return `${symbol.slice(0, -4)} / USDT`;
  return symbol;
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
