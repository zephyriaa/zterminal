# Premium Rebuild Validation

## Automated quality gates

| Gate | Result |
|---|---|
| TypeScript (`pnpm check`) | Passed after the professional-chart integration and resize lifecycle corrections. |
| Unit tests (`pnpm test`) | Passed: 8 test files and 20 tests. |
| Production build (`pnpm build`) | Passed. The Vite client build and Express production bundle were produced successfully. |

## Browser validation

| Scenario | Result |
|---|---|
| Verified default market | QQQX/USDT snapshot, 97-bar coverage, feature overlays, native price/time scales, volume pane, and momentum pane rendered. |
| Crosshair | Hovering the chart updated the displayed timestamp and OHLC context for the hovered candle. |
| Long historical window | A 2,001-bar partial range remained legible through a native visible range rather than fixed-SVG overplotting; partial coverage remained disclosed. |
| Studies drawer | Version, source, coverage, fingerprint, and unavailable CVD/GEX gates were inspectable. |
| Research drawer | Local-draft status, verified dataset reference, deterministic historical evaluation, and no-broker boundary remained functional. |
| Failure handling | Unsupported-symbol responses retained the last verified chart and presented the provider’s non-fabrication reason with a retry action. |
| Drawer behavior | Studies and Research are now mutually exclusive, avoiding a chart-compressing double-sidebar state. |

## Console review

The local browser contained historical resize warnings generated before the resize correction. After explicitly clearing the console and loading the updated chart lifecycle, no newly recorded runtime exception was observed. The chart component now uses `autoSize: false` with the library’s dedicated `resize()` API instead of mixing automatic sizing with manually applied width/height options.

## Deployment readiness

The premium rebuild is ready for commit, pull-request review, and Render deployment after the production dependency audit completes. The release must be smoke-tested on the public URL for a supported symbol, a long partial window, the study drawer, the research evaluation, and an unsupported-symbol recovery path.

## Dependency audit

`pnpm audit --prod --audit-level=high` completed without critical or high-severity findings. The registry reported 7 low and 26 moderate findings across the broader production dependency graph; these do not block the release under the high-severity gate, but they should be addressed in a separate dependency-maintenance pass.
