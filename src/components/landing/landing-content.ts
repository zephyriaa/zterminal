export type ProductCapture = {
  src: string;
  mobileSrc?: string;
  width: number;
  height: number;
  alt: string;
  label: string;
  context: string;
};

// Actual application captures; provenance is recorded in docs/landing-redesign.md.
export const captures = {
  canvas: {
    src: "/landing/research-canvas-ee09e733.webp", mobileSrc: "/landing/research-market-detail-0e354e39.webp",
    width: 900, height: 1062,
    alt: "Detail of the actual archived BTC/USDT chart with hourly timeframe, drawing tools, moving averages, and volume",
    label: "The chart, in detail", context: "Actual archived chart · Hourly observations",
  },
  workspace: {
    src: "/landing/research-workspace-040b4ada.webp", mobileSrc: "/landing/research-workspace-detail-0e354e39.webp",
    width: 1600, height: 920,
    alt: "Actual ZTerminal workspace with an archived BTC/USDT chart beside the Python strategy editor and connected local research Helper",
    label: "Charts, code and research in context", context: "Actual workspace · Archived educational example",
  },
  market: {
    src: "/landing/research-market-35361d77.webp", mobileSrc: "/landing/research-market-detail-0e354e39.webp",
    width: 1600, height: 920,
    alt: "ZTerminal archived BTC/USDT hourly chart beside performance analysis from a real local educational backtest",
    label: "The market workspace", context: "Archived chart · Educational historical simulation",
  },
  strategy: {
    src: "/landing/research-strategy-040b4ada.webp", mobileSrc: "/landing/research-strategy-detail-96f7c0fe.webp",
    width: 1600, height: 920,
    alt: "ZTerminal Python Strategy Developer with an educational moving-average crossover and local research controls",
    label: "The strategy developer", context: "Standard Python · Paired local Helper",
  },
  assumptions: {
    src: "/landing/research-assumptions-bba7b115.webp", mobileSrc: "/landing/research-assumptions-detail-741862c8.webp",
    width: 1600, height: 920,
    alt: "Actual ZTerminal backtest configuration with explicit fees, slippage, cash allocation, direction, and verified instrument units",
    label: "The research assumptions", context: "Explicit costs · Local historical research",
  },
  report: {
    src: "/landing/research-report-35361d77.webp", mobileSrc: "/landing/research-report-detail-32aca238.webp",
    width: 1600, height: 920,
    alt: "ZTerminal performance report with actual metrics, equity curve, and trade distribution from an educational local backtest",
    label: "The research report", context: "Real local run · Historical simulation, not a forecast",
  },
  provenance: {
    src: "/landing/research-provenance-9ba85573.webp", mobileSrc: "/landing/research-provenance-detail-aeef0fbd.webp",
    width: 1600, height: 920,
    alt: "ZTerminal archived research logs showing source, dataset and result hashes, engine versions, and captured execution assumptions",
    label: "The archived evidence", context: "Source + dataset + result · Preserved locally",
  },
} satisfies Record<string, ProductCapture>;

export const researchSteps = [
  { id: "observe", label: "Observe", title: "Start with the market.",
    description: "Price, volume, studies and market context share one canvas. Follow an instrument across horizons, then turn an observation into a question worth testing.",
    detail: "Charts · indicators · market context", capture: captures.market },
  { id: "express", label: "Express", title: "Give the idea a rule.",
    description: "Write the hypothesis in standard Python. Keep the source, parameters and selected dataset in view, with local execution on your own machine.",
    detail: "Python · explicit parameters · local compute", capture: captures.strategy },
  { id: "test", label: "Test", title: "Make the assumptions visible.",
    description: "Declare the historical range, fees, slippage and sizing before the run. Completed-bar signals use a next-open research model; the result carries its assumptions with it.",
    detail: "Historical data · costs · next-bar fills", capture: captures.assumptions },
  { id: "inspect", label: "Inspect", title: "Read beyond the return.",
    description: "Inspect trades, equity, drawdown and risk. Monte Carlo resamples observed outcomes to explore sensitivity, rather than promise what the market will do next.",
    detail: "Performance · trades · risk · Monte Carlo", capture: captures.report },
  { id: "refine", label: "Refine", title: "Keep the evidence. Refine the idea.",
    description: "Preserve the source, data and configuration with the run. Return to an archived result, inspect its provenance, and make the next experiment attributable.",
    detail: "Local archive · source and dataset hashes", capture: captures.provenance },
] as const;
