# Workstation Restoration Validation

## Focus-mode review — 2026-08-21

The restored local terminal is serving the legacy workstation shell and verified chart surfaces. The initial Focus-mode review identified one regression inherited from the old stylesheet: the workspace selector is hidden when Focus Mode is active. This prevents clear discovery of Canvas and Research. The corrected restoration must retain the selector in Focus Mode, with only secondary panels collapsing.

## Canvas-mode review — 2026-08-21

Canvas Mode successfully restored the dense workstation header, persistent Layers catalogue, the current native-study inventory, verified chart, range dock, and the six-cell context deck. The public-data boundaries rendered correctly: GEX and resting liquidity were gated, while unsourced News, Fear & Greed, and COT displayed unavailable states rather than fabricated values.

The Canvas screenshot also exposed an unused grid track left by the hidden Research column. The CSS will be corrected so Canvas uses a three-column grid (tool rail, chart, Layers) and Research alone reserves the fourth Strategy Tester column.

## Research-mode review — 2026-08-21

The corrected desktop Research composition now follows the requested order: icon rail, Layers, dominant chart, then the full Strategy Tester. The tester compiled its displayed closed EMA-crossover source and completed a run on the current 97-bar verified Gate.io window. The Overview rendered an equity curve, historical metrics, source and execution disclosure, run ID/hash, and no-broker boundary. These values are the actual local historical-run result, not reference-image placeholder figures.

## Responsive smoke test — 2026-08-21

A 390 × 844 headless-browser capture confirmed the mobile Focus workspace keeps the branded header, horizontally scrollable Focus/Canvas/Research selector, icon controls, and a full-width readable chart without panel collision. Secondary workstation columns remain collapsed under the existing mobile rules rather than overlaying chart interaction.

## Automated and build gates

The complete suite passed after the restoration: 29 test files and 103 tests. TypeScript validation and the production PWA build also passed. The workspace-router regression was updated to explicitly assert the backward-compatible `workspaceMode: "focus"` normalization.
