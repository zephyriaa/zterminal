import test from "node:test";
import assert from "node:assert/strict";
import {
  calculatePortfolioExposure,
  type PositionExposureInput,
} from "../src/domain/risk/exposure";

test("calculatePortfolioExposure calculates gross, net, leverage, and margin metrics accurately", () => {
  const equity = 100_000;
  const positions: PositionExposureInput[] = [
    {
      symbol: "BTCUSDT",
      assetClass: "CRYPTO",
      quantity: 2.0, // Long 2 BTC @ $60,000 = $120,000
      markPrice: 60_000,
      maintenanceMarginRatio: 0.05, // 5% = $6,000 margin
      fundingRate8h: 0.0001, // 0.01%
    },
    {
      symbol: "ETHUSDT",
      assetClass: "CRYPTO",
      quantity: -10.0, // Short 10 ETH @ $3,000 = $30,000
      markPrice: 3_000,
      maintenanceMarginRatio: 0.05, // 5% = $1,500 margin
      fundingRate8h: 0.0001,
    },
  ];

  const report = calculatePortfolioExposure(positions, equity);

  // Gross: 120,000 + 30,000 = 150,000
  assert.equal(report.grossNotional, 150_000);
  // Net: 120,000 - 30,000 = 90,000
  assert.equal(report.netNotional, 90_000);
  assert.equal(report.longNotional, 120_000);
  assert.equal(report.shortNotional, 30_000);
  assert.equal(report.longShortRatio, 4.0); // 120k / 30k = 4.0

  // Leverage: 150,000 / 100,000 = 1.5x
  assert.equal(report.effectiveLeverage, 1.5);

  // Margin required: 6,000 + 1,500 = 7,500
  assert.equal(report.totalMarginRequired, 7_500);
  assert.equal(report.freeMargin, 92_500);
  assert.equal(report.marginUtilizationPct, 7.5);

  // Funding:
  // BTC long: 120,000 * 0.0001 * 3 = 36
  // ETH short: -30,000 * 0.0001 * 3 = -9 (received)
  // Total = 36 - 9 = 27
  assert.equal(report.totalProjectedFundingCost24h, 27);
});

test("calculatePortfolioExposure detects concentration risk with HHI index", () => {
  const equity = 100_000;

  // Single concentrated position: 100% BTC
  const concentrated: PositionExposureInput[] = [
    {
      symbol: "BTCUSDT",
      quantity: 1,
      markPrice: 60_000,
    },
  ];

  const repConc = calculatePortfolioExposure(concentrated, equity);
  assert.equal(repConc.concentrationHHI, 1.0);
  assert.equal(repConc.concentrationRisk, "CONCENTRATED");

  // Diversified portfolio across 4 equal assets: 25% each -> HHI = 4 * (0.25)^2 = 0.25
  const balanced: PositionExposureInput[] = [
    { symbol: "A", quantity: 1, markPrice: 25_000 },
    { symbol: "B", quantity: 1, markPrice: 25_000 },
    { symbol: "C", quantity: 1, markPrice: 25_000 },
    { symbol: "D", quantity: 1, markPrice: 25_000 },
  ];

  const repBal = calculatePortfolioExposure(balanced, equity);
  assert.equal(repBal.concentrationHHI, 0.25);
  assert.equal(repBal.concentrationRisk, "MODERATE");
});
