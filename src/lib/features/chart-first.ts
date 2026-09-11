export const chartFirstFeatures = {
  localRuntime: process.env.NEXT_PUBLIC_ZT_LOCAL_RUNTIME === "true",
  overlayEngine: process.env.NEXT_PUBLIC_ZT_OVERLAY_ENGINE !== "false",
  bigTrades: process.env.NEXT_PUBLIC_ZT_BIG_TRADES !== "false",
  l2Liquidity: process.env.NEXT_PUBLIC_ZT_L2_LIQUIDITY === "true",
  gex: process.env.NEXT_PUBLIC_ZT_GEX === "true",
  workspaceV2: process.env.NEXT_PUBLIC_ZT_WORKSPACE_V2 === "true",
} as const;

export type ChartFirstFeature = keyof typeof chartFirstFeatures;

export function chartFirstFeatureEnabled(feature: ChartFirstFeature) {
  return chartFirstFeatures[feature];
}
