import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateBlackScholesDelta,
  calculateBlackScholesGamma,
  calculateD1,
  normalCdf,
  normalPdf,
} from "../src/lib/gex/black-scholes";
import {
  calculateDollarGamma,
  computeGexProfile,
  findGammaFlipPrice,
} from "../src/lib/gex/gex-calculator";
import {
  normalizeDeribitOption,
  parseDeribitInstrument,
} from "../src/lib/gex/deribit-adapter";
import type { ParsedOptionContract, RawDeribitOptionSummary } from "../src/lib/gex/types";

test("Black-Scholes analytical core evaluates standard benchmarks accurately", () => {
  // S = 100, K = 100, T = 1 year, sigma = 20% (0.2), r = 0
  // d1 = (ln(1) + 0.5 * 0.04 * 1) / (0.2 * 1) = 0.02 / 0.2 = 0.1
  const d1 = calculateD1(100, 100, 1, 0.2, 0);
  assert.ok(Math.abs(d1 - 0.1) < 1e-9, `Expected d1 = 0.1, got ${d1}`);

  // N'(0.1) = exp(-0.005) / sqrt(2 * PI) ≈ 0.396952547
  const pdf = normalPdf(0.1);
  assert.ok(Math.abs(pdf - 0.396952547) < 1e-6);

  // Gamma = N'(d1) / (S * sigma * sqrt(T)) = 0.396952547 / (100 * 0.2 * 1) = 0.019847627
  const gamma = calculateBlackScholesGamma(100, 100, 1, 0.2, 0);
  assert.ok(Math.abs(gamma - 0.019847627) < 1e-6, `Expected ~0.0198476, got ${gamma}`);

  // Delta: N(0.1) ≈ 0.5398278
  const callDelta = calculateBlackScholesDelta(100, 100, 1, 0.2, "call", 0);
  const putDelta = calculateBlackScholesDelta(100, 100, 1, 0.2, "put", 0);
  assert.ok(Math.abs(callDelta - 0.5398278) < 1e-4);
  assert.ok(Math.abs(putDelta - (callDelta - 1)) < 1e-9);
});

test("Black-Scholes Greek engine safely handles singularities and boundaries (T -> 0, sigma <= 0)", () => {
  // T <= 0 or T -> 0
  assert.equal(calculateBlackScholesGamma(100, 100, 0, 0.5), 0.0);
  assert.equal(calculateBlackScholesGamma(100, 100, -1, 0.5), 0.0);
  assert.equal(calculateBlackScholesGamma(100, 100, 1e-7, 0.5), 0.0);

  // sigma <= 0
  assert.equal(calculateBlackScholesGamma(100, 100, 1, 0), 0.0);
  assert.equal(calculateBlackScholesGamma(100, 100, 1, -0.2), 0.0);
  assert.equal(calculateBlackScholesGamma(100, 100, 1, 1e-5), 0.0);

  // S <= 0 or K <= 0
  assert.equal(calculateBlackScholesGamma(0, 100, 1, 0.5), 0.0);
  assert.equal(calculateBlackScholesGamma(-50, 100, 1, 0.5), 0.0);
  assert.equal(calculateBlackScholesGamma(100, 0, 1, 0.5), 0.0);
  assert.equal(calculateBlackScholesGamma(100, -100, 1, 0.5), 0.0);

  // NaN or non-finite inputs
  assert.equal(calculateBlackScholesGamma(NaN, 100, 1, 0.5), 0.0);
  assert.equal(calculateBlackScholesGamma(100, Infinity, 1, 0.5), 0.0);
});

test("Dollar Gamma Exposure scales correctly with Open Interest and underlying price", () => {
  const gamma = 0.00005;
  const oi = 1000; // 1000 BTC contracts
  const spot = 60_000;

  // Dollar Gamma = Gamma * OI * S^2 * 0.01
  // = 0.00005 * 1000 * 3,600,000,000 * 0.01 = 0.05 * 36,000,000 = 1,800,000 USD
  const dollarGamma = calculateDollarGamma(gamma, oi, spot);
  assert.equal(dollarGamma, 1_800_000);

  // Boundary checks: 0 OI or 0 spot
  assert.equal(calculateDollarGamma(0, oi, spot), 0);
  assert.equal(calculateDollarGamma(gamma, 0, spot), 0);
  assert.equal(calculateDollarGamma(gamma, oi, 0), 0);
});

test("Deribit instrument parser decomposes contract names and handles valid/invalid dates", () => {
  const parsedCall = parseDeribitInstrument("BTC-27SEP26-65000-C");
  assert.ok(parsedCall);
  assert.equal(parsedCall.underlying, "BTC");
  assert.equal(parsedCall.strike, 65000);
  assert.equal(parsedCall.type, "call");
  // 27 SEP 2026, 08:00:00 UTC
  const expectedUtc = Date.UTC(2026, 8, 27, 8, 0, 0); // Month 8 is September (0-indexed)
  assert.equal(parsedCall.expiryTimestamp, expectedUtc);

  const parsedPut = parseDeribitInstrument("ETH-25DEC26-3000-P");
  assert.ok(parsedPut);
  assert.equal(parsedPut.underlying, "ETH");
  assert.equal(parsedPut.strike, 3000);
  assert.equal(parsedPut.type, "put");

  // Invalid formats
  assert.equal(parseDeribitInstrument("BTC-PERPETUAL"), null);
  assert.equal(parseDeribitInstrument("SOL-27SEP26-150-C"), null);
  assert.equal(parseDeribitInstrument("BTC-INVALIDDATE-65000-C"), null);
  assert.equal(parseDeribitInstrument("BTC-27SEP26-0-C"), null);
});

test("GEX surface computation separates Gross Gamma from Signed Dealer GEX and finds OI walls & Gamma Flip", () => {
  const spot = 60_000;
  const now = Date.UTC(2026, 0, 1, 0, 0, 0);
  const expiry = Date.UTC(2026, 5, 30, 8, 0, 0); // ~0.5 years out

  const contracts: ParsedOptionContract[] = [
    // Heavy Call Open Interest at 70,000 (Call Wall)
    {
      instrumentName: "BTC-30JUN26-70000-C",
      underlying: "BTC",
      expiryTimestamp: expiry,
      timeToExpiryYears: 0.5,
      strike: 70_000,
      type: "call",
      openInterest: 5000,
      markIv: 0.60,
      markPrice: 0.1,
      delta: 0.35,
      underlyingPrice: spot,
    },
    // Heavy Put Open Interest at 50,000 (Put Wall)
    {
      instrumentName: "BTC-30JUN26-50000-P",
      underlying: "BTC",
      expiryTimestamp: expiry,
      timeToExpiryYears: 0.5,
      strike: 50_000,
      type: "put",
      openInterest: 4000,
      markIv: 0.60,
      markPrice: 0.08,
      delta: -0.25,
      underlyingPrice: spot,
    },
    // ATM Options at 60,000
    {
      instrumentName: "BTC-30JUN26-60000-C",
      underlying: "BTC",
      expiryTimestamp: expiry,
      timeToExpiryYears: 0.5,
      strike: 60_000,
      type: "call",
      openInterest: 2000,
      markIv: 0.55,
      markPrice: 0.15,
      delta: 0.52,
      underlyingPrice: spot,
    },
    {
      instrumentName: "BTC-30JUN26-60000-P",
      underlying: "BTC",
      expiryTimestamp: expiry,
      timeToExpiryYears: 0.5,
      strike: 60_000,
      type: "put",
      openInterest: 1500,
      markIv: 0.55,
      markPrice: 0.14,
      delta: -0.48,
      underlyingPrice: spot,
    },
  ];

  const profile = computeGexProfile("BTC", spot, contracts, "DEALER_LONG_CALLS_SHORT_PUTS");

  // Research Integrity assertions
  assert.equal(profile.isEstimate, true);
  assert.equal(profile.underlying, "BTC");
  assert.equal(profile.indexPrice, spot);

  // OI Walls
  assert.equal(profile.callOiWall, 70_000);
  assert.equal(profile.putOiWall, 50_000);

  // Gross Gamma vs Signed GEX distinct separation
  assert.ok(profile.totalGrossGamma > 0);
  assert.equal(profile.totalGrossGamma, profile.totalCallGex + profile.totalPutGex);
  assert.equal(profile.netGex, profile.totalCallGex - profile.totalPutGex);

  // Strikes list verification
  assert.equal(profile.strikes.length, 3); // 50k, 60k, 70k
  const strike60k = profile.strikes.find(s => s.strike === 60_000);
  assert.ok(strike60k);
  assert.equal(strike60k.callOI, 2000);
  assert.equal(strike60k.putOI, 1500);
  assert.ok(strike60k.callGex > strike60k.putGex); // More call OI than put OI at ATM

  // Gamma Flip Price
  const flip = findGammaFlipPrice(contracts, spot, "DEALER_LONG_CALLS_SHORT_PUTS");
  assert.ok(flip !== null, "Expected valid Gamma Flip price");
  assert.ok(flip > 40_000 && flip < 80_000, `Gamma flip ${flip} should be reasonable near spot`);
});

test("GEX surface computation handles empty contract lists without throwing", () => {
  const profile = computeGexProfile("ETH", 3000, [], "DEALER_LONG_CALLS_SHORT_PUTS", "LIVE");
  assert.equal(profile.health, "UNAVAILABLE");
  assert.equal(profile.strikes.length, 0);
  assert.equal(profile.gammaFlip, null);
  assert.equal(profile.totalCallGex, 0);
  assert.equal(profile.totalPutGex, 0);
  assert.equal(profile.netGex, 0);
});
