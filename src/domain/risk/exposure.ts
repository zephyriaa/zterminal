/**
 * Institutional Portfolio Exposure Analytics
 * Features:
 * - Gross, Net, Long, and Short Notional Exposure
 * - Effective Leverage & Margin Utilization
 * - Concentration Analytics (Herfindahl-Hirschman Index - HHI)
 * - Funding Rate / Carry Cost Projections (8h, 24h, 30d)
 * - Asset Class / Sector Allocation
 */

export interface PositionExposureInput {
  symbol: string;
  assetClass?: "CRYPTO" | "EQUITY" | "FX" | "COMMODITY";
  quantity: number; // positive for long, negative for short
  markPrice: number;
  multiplier?: number;
  maintenanceMarginRatio?: number; // e.g. 0.05 for 20x max leverage
  fundingRate8h?: number; // e.g. 0.0001 (0.01% per 8h)
}

export interface InstrumentExposure {
  symbol: string;
  assetClass: string;
  direction: "LONG" | "SHORT" | "FLAT";
  notionalValue: number; // Absolute value
  netNotionalValue: number; // Signed value
  portfolioWeight: number; // % of gross exposure
  marginRequired: number;
  projectedFundingCost24h: number;
}

export interface PortfolioExposureReport {
  totalEquity: number;
  grossNotional: number;
  netNotional: number;
  longNotional: number;
  shortNotional: number;
  longShortRatio: number;
  effectiveLeverage: number;
  marginUtilizationPct: number;
  totalMarginRequired: number;
  freeMargin: number;
  concentrationHHI: number; // 0 to 1
  concentrationRisk: "DIVERSIFIED" | "MODERATE" | "CONCENTRATED";
  totalProjectedFundingCost24h: number;
  instruments: InstrumentExposure[];
  assetClassBreakdown: Record<string, { grossNotional: number; weightPct: number }>;
}

/**
 * Calculates comprehensive portfolio exposure and risk metrics.
 */
export function calculatePortfolioExposure(
  positions: PositionExposureInput[],
  accountEquity: number,
): PortfolioExposureReport {
  if (accountEquity <= 0) {
    throw new Error("Account equity must be greater than zero.");
  }

  let grossNotional = 0;
  let netNotional = 0;
  let longNotional = 0;
  let shortNotional = 0;
  let totalMarginRequired = 0;
  let totalProjectedFundingCost24h = 0;

  const intermediate: Array<{
    symbol: string;
    assetClass: string;
    direction: "LONG" | "SHORT" | "FLAT";
    notional: number;
    signedNotional: number;
    marginReq: number;
    funding24h: number;
  }> = [];

  for (const pos of positions) {
    const mult = pos.multiplier ?? 1;
    const signedNotional = pos.quantity * pos.markPrice * mult;
    const notional = Math.abs(signedNotional);
    const mmRatio = pos.maintenanceMarginRatio ?? 0.1;
    const marginReq = notional * mmRatio;
    const rate8h = pos.fundingRate8h ?? 0;
    // 24h cost = 3 * 8h payments: Long pays if rate > 0, receives if rate < 0
    const funding24h = signedNotional * rate8h * 3;

    grossNotional += notional;
    netNotional += signedNotional;
    totalMarginRequired += marginReq;
    totalProjectedFundingCost24h += funding24h;

    let direction: "LONG" | "SHORT" | "FLAT" = "FLAT";
    if (pos.quantity > 0) {
      direction = "LONG";
      longNotional += notional;
    } else if (pos.quantity < 0) {
      direction = "SHORT";
      shortNotional += notional;
    }

    intermediate.push({
      symbol: pos.symbol,
      assetClass: pos.assetClass ?? "CRYPTO",
      direction,
      notional,
      signedNotional,
      marginReq,
      funding24h,
    });
  }

  // Calculate weights & HHI
  let hhi = 0;
  const instruments: InstrumentExposure[] = [];
  const assetClassMap = new Map<string, number>();

  for (const item of intermediate) {
    const weight = grossNotional > 0 ? item.notional / grossNotional : 0;
    hhi += Math.pow(weight, 2);

    instruments.push({
      symbol: item.symbol,
      assetClass: item.assetClass,
      direction: item.direction,
      notionalValue: Number(item.notional.toFixed(2)),
      netNotionalValue: Number(item.signedNotional.toFixed(2)),
      portfolioWeight: Number((weight * 100).toFixed(2)),
      marginRequired: Number(item.marginReq.toFixed(2)),
      projectedFundingCost24h: Number(item.funding24h.toFixed(2)),
    });

    const currentClassGross = assetClassMap.get(item.assetClass) ?? 0;
    assetClassMap.set(item.assetClass, currentClassGross + item.notional);
  }

  const assetClassBreakdown: Record<string, { grossNotional: number; weightPct: number }> = {};
  for (const [cls, gross] of assetClassMap.entries()) {
    assetClassBreakdown[cls] = {
      grossNotional: Number(gross.toFixed(2)),
      weightPct: grossNotional > 0 ? Number(((gross / grossNotional) * 100).toFixed(2)) : 0,
    };
  }

  let concentrationRisk: PortfolioExposureReport["concentrationRisk"] = "DIVERSIFIED";
  if (hhi > 0.4) {
    concentrationRisk = "CONCENTRATED";
  } else if (hhi > 0.2) {
    concentrationRisk = "MODERATE";
  }

  const effectiveLeverage = Number((grossNotional / accountEquity).toFixed(2));
  const marginUtilizationPct = Number(((totalMarginRequired / accountEquity) * 100).toFixed(2));
  const freeMargin = Number((accountEquity - totalMarginRequired).toFixed(2));
  const longShortRatio =
    shortNotional > 0 ? Number((longNotional / shortNotional).toFixed(2)) : longNotional > 0 ? 999 : 1.0;

  return {
    totalEquity: accountEquity,
    grossNotional: Number(grossNotional.toFixed(2)),
    netNotional: Number(netNotional.toFixed(2)),
    longNotional: Number(longNotional.toFixed(2)),
    shortNotional: Number(shortNotional.toFixed(2)),
    longShortRatio,
    effectiveLeverage,
    marginUtilizationPct,
    totalMarginRequired: Number(totalMarginRequired.toFixed(2)),
    freeMargin,
    concentrationHHI: Number(hhi.toFixed(4)),
    concentrationRisk,
    totalProjectedFundingCost24h: Number(totalProjectedFundingCost24h.toFixed(2)),
    instruments,
    assetClassBreakdown,
  };
}
