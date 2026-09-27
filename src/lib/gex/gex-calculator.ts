import { calculateBlackScholesGamma } from "./black-scholes";
import type {
  DealerConvention,
  GexProfile,
  GexStrike,
  ParsedOptionContract,
} from "./types";
import type { FeedHealthStatus } from "../market/l2-types";

/**
 * Calculates Dollar Gamma Exposure:
 * Dollar Gamma = Gamma * Open Interest * S^2 * 0.01
 * Measures the dollar change in delta per 1% change in spot price.
 */
export function calculateDollarGamma(
  gamma: number,
  openInterest: number,
  spotPrice: number
): number {
  if (gamma <= 0 || openInterest <= 0 || spotPrice <= 0) return 0;
  return gamma * openInterest * spotPrice * spotPrice * 0.01;
}

/**
 * Evaluates net aggregate dealer GEX at a given hypothetical underlying price s.
 */
function evaluateNetGexAtPrice(
  contracts: ParsedOptionContract[],
  testPrice: number,
  convention: DealerConvention
): number {
  let net = 0;
  for (const c of contracts) {
    if (c.openInterest <= 0 || c.timeToExpiryYears <= 1e-6 || c.markIv <= 1e-4) continue;
    const gamma = calculateBlackScholesGamma(testPrice, c.strike, c.timeToExpiryYears, c.markIv);
    const dollarGamma = calculateDollarGamma(gamma, c.openInterest, testPrice);

    if (convention === "DEALER_LONG_CALLS_SHORT_PUTS") {
      net += c.type === "call" ? dollarGamma : -dollarGamma;
    } else {
      // DEALER_SHORT_ALL
      net -= dollarGamma;
    }
  }
  return net;
}

/**
 * Finds the Gamma Flip price (the underlying spot price where Net Dealer GEX changes sign).
 * Uses robust 1D bracketed bisection root finding.
 */
export function findGammaFlipPrice(
  contracts: ParsedOptionContract[],
  currentSpot: number,
  convention: DealerConvention = "DEALER_LONG_CALLS_SHORT_PUTS"
): number | null {
  if (currentSpot <= 0 || contracts.length === 0) return null;

  // Bracket between 35% and 250% of spot price
  let low = currentSpot * 0.35;
  let high = currentSpot * 2.5;

  let fLow = evaluateNetGexAtPrice(contracts, low, convention);
  let fHigh = evaluateNetGexAtPrice(contracts, high, convention);

  // If both endpoints have the same sign, check intermediate sample points
  if (fLow * fHigh > 0) {
    const steps = 10;
    let foundBracket = false;
    for (let i = 1; i < steps; i++) {
      const mid = low + (i / steps) * (high - low);
      const fMid = evaluateNetGexAtPrice(contracts, mid, convention);
      if (fLow * fMid <= 0) {
        high = mid;
        fHigh = fMid;
        foundBracket = true;
        break;
      } else if (fMid * fHigh <= 0) {
        low = mid;
        fLow = fMid;
        foundBracket = true;
        break;
      }
    }
    if (!foundBracket) {
      return null;
    }
  }

  // Bisection loop
  const maxIterations = 35;
  const tolerance = Math.max(0.5, currentSpot * 0.0001); // 0.01% price tolerance

  for (let iter = 0; iter < maxIterations; iter++) {
    const mid = 0.5 * (low + high);
    if ((high - low) < tolerance) {
      return Math.round(mid * 100) / 100;
    }

    const fMid = evaluateNetGexAtPrice(contracts, mid, convention);
    if (Math.abs(fMid) < 1e-5) {
      return Math.round(mid * 100) / 100;
    }

    if (fLow * fMid < 0) {
      high = mid;
      fHigh = fMid;
    } else {
      low = mid;
      fLow = fMid;
    }
  }

  return Math.round(0.5 * (low + high) * 100) / 100;
}

/**
 * Computes the full GEX surface and metrics for a list of parsed options contracts.
 */
export function computeGexProfile(
  underlying: 'BTC' | 'ETH',
  spotPrice: number,
  contracts: ParsedOptionContract[],
  dealerConvention: DealerConvention = "DEALER_LONG_CALLS_SHORT_PUTS",
  health: FeedHealthStatus = "LIVE"
): GexProfile {
  if (contracts.length === 0 || spotPrice <= 0) {
    return {
      underlying,
      indexPrice: spotPrice,
      gammaFlip: null,
      totalCallGex: 0,
      totalPutGex: 0,
      netGex: 0,
      totalGrossGamma: 0,
      callOiWall: 0,
      putOiWall: 0,
      timestamp: Date.now(),
      isEstimate: true,
      dealerConvention,
      health: health === "LIVE" ? "UNAVAILABLE" : health,
      strikes: [],
    };
  }

  // Aggregate by strike
  const strikeMap = new Map<number, {
    callGex: number;
    putGex: number;
    grossGamma: number;
    callOI: number;
    putOI: number;
    callVolume: number;
    putVolume: number;
  }>();

  let totalCallGex = 0;
  let totalPutGex = 0;

  for (const c of contracts) {
    const strike = c.strike;
    let entry = strikeMap.get(strike);
    if (!entry) {
      entry = {
        callGex: 0,
        putGex: 0,
        grossGamma: 0,
        callOI: 0,
        putOI: 0,
        callVolume: 0,
        putVolume: 0,
      };
      strikeMap.set(strike, entry);
    }

    const gamma = calculateBlackScholesGamma(spotPrice, c.strike, c.timeToExpiryYears, c.markIv);
    const dollarGamma = calculateDollarGamma(gamma, c.openInterest, spotPrice);

    if (c.type === "call") {
      entry.callGex += dollarGamma;
      entry.callOI += c.openInterest;
      totalCallGex += dollarGamma;
    } else {
      entry.putGex += dollarGamma;
      entry.putOI += c.openInterest;
      totalPutGex += dollarGamma;
    }

    entry.grossGamma += dollarGamma;
  }

  // Convert to sorted strike array
  const strikes: GexStrike[] = [];
  let maxCallOI = -1;
  let callOiWall = 0;
  let maxPutOI = -1;
  let putOiWall = 0;

  const sortedStrikes = Array.from(strikeMap.keys()).sort((a, b) => a - b);

  for (const strike of sortedStrikes) {
    const entry = strikeMap.get(strike)!;

    const netGex =
      dealerConvention === "DEALER_LONG_CALLS_SHORT_PUTS"
        ? entry.callGex - entry.putGex
        : -(entry.callGex + entry.putGex);

    if (entry.callOI > maxCallOI) {
      maxCallOI = entry.callOI;
      callOiWall = strike;
    }

    if (entry.putOI > maxPutOI) {
      maxPutOI = entry.putOI;
      putOiWall = strike;
    }

    strikes.push({
      strike,
      callGex: entry.callGex,
      putGex: entry.putGex,
      netGex,
      grossGamma: entry.grossGamma,
      callOI: entry.callOI,
      putOI: entry.putOI,
      callVolume: entry.callVolume,
      putVolume: entry.putVolume,
    });
  }

  const netGex =
    dealerConvention === "DEALER_LONG_CALLS_SHORT_PUTS"
      ? totalCallGex - totalPutGex
      : -(totalCallGex + totalPutGex);

  const totalGrossGamma = totalCallGex + totalPutGex;

  const gammaFlip = findGammaFlipPrice(contracts, spotPrice, dealerConvention);

  return {
    underlying,
    indexPrice: spotPrice,
    gammaFlip,
    totalCallGex,
    totalPutGex,
    netGex,
    totalGrossGamma,
    callOiWall,
    putOiWall,
    timestamp: Date.now(),
    isEstimate: true,
    dealerConvention,
    health,
    strikes,
  };
}
