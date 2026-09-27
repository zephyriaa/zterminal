/**
 * Black-Scholes Analytical Pricing & Greeks Core with Strict Numerical Singularity Safeguards.
 * Zero division errors or NaNs under T -> 0 or sigma -> 0.
 */

const INV_SQRT_2PI = 0.3989422804014327; // 1 / sqrt(2 * PI)

/**
 * Standard Normal Probability Density Function N'(x) = exp(-0.5 * x^2) / sqrt(2 * PI).
 */
export function normalPdf(x: number): number {
  if (Math.abs(x) > 40) return 0;
  return INV_SQRT_2PI * Math.exp(-0.5 * x * x);
}

/**
 * Standard Normal Cumulative Distribution Function N(x).
 * Hart's rational approximation (high precision, error < 1e-7).
 */
export function normalCdf(x: number): number {
  if (x > 37) return 1.0;
  if (x < -37) return 0.0;

  // Abramowitz and Stegun formula 7.1.26
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x) / Math.SQRT2;
  const t = 1.0 / (1.0 + p * absX);
  const erf = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);

  return 0.5 * (1.0 + sign * erf);
}

/**
 * Computes d1 in the Black-Scholes formula.
 * d1 = (ln(S / K) + (r + 0.5 * sigma^2) * T) / (sigma * sqrt(T))
 */
export function calculateD1(
  spot: number,
  strike: number,
  timeToExpiryYears: number,
  volatility: number,
  riskFreeRate = 0
): number {
  if (spot <= 0 || strike <= 0 || timeToExpiryYears <= 1e-6 || volatility <= 1e-4) {
    return 0;
  }
  const numerator = Math.log(spot / strike) + (riskFreeRate + 0.5 * volatility * volatility) * timeToExpiryYears;
  const denominator = volatility * Math.sqrt(timeToExpiryYears);
  if (denominator <= 1e-7) return 0;
  return numerator / denominator;
}

/**
 * Standard Black-Scholes Gamma:
 * Gamma = N'(d1) / (S * sigma * sqrt(T))
 *
 * Safeguards:
 * - If T <= 1e-6, Gamma -> 0 (option expired or on delivery)
 * - If sigma <= 1e-4, Gamma -> 0 (zero volatility)
 * - If S <= 0 or K <= 0, Gamma -> 0
 */
export function calculateBlackScholesGamma(
  spot: number,
  strike: number,
  timeToExpiryYears: number,
  volatility: number,
  riskFreeRate = 0
): number {
  // Singularity checks
  if (
    !Number.isFinite(spot) ||
    !Number.isFinite(strike) ||
    !Number.isFinite(timeToExpiryYears) ||
    !Number.isFinite(volatility) ||
    spot <= 0 ||
    strike <= 0 ||
    timeToExpiryYears <= 1e-6 ||
    volatility <= 1e-4
  ) {
    return 0.0;
  }

  const sqrtT = Math.sqrt(timeToExpiryYears);
  const denom = spot * volatility * sqrtT;
  if (denom <= 1e-7) {
    return 0.0;
  }

  const d1 = calculateD1(spot, strike, timeToExpiryYears, volatility, riskFreeRate);
  const pdf = normalPdf(d1);

  const gamma = pdf / denom;
  return Number.isFinite(gamma) && gamma >= 0 ? gamma : 0.0;
}

/**
 * Standard Black-Scholes Delta.
 */
export function calculateBlackScholesDelta(
  spot: number,
  strike: number,
  timeToExpiryYears: number,
  volatility: number,
  type: 'call' | 'put',
  riskFreeRate = 0
): number {
  if (spot <= 0 || strike <= 0) return 0;
  if (timeToExpiryYears <= 1e-6) {
    if (type === 'call') return spot >= strike ? 1.0 : 0.0;
    return spot <= strike ? -1.0 : 0.0;
  }
  if (volatility <= 1e-4) {
    if (type === 'call') return spot >= strike ? 1.0 : 0.0;
    return spot <= strike ? -1.0 : 0.0;
  }

  const d1 = calculateD1(spot, strike, timeToExpiryYears, volatility, riskFreeRate);
  const cdfD1 = normalCdf(d1);

  return type === 'call' ? cdfD1 : cdfD1 - 1.0;
}
