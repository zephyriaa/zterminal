# Reference Rebuild Visual Notes

## Local review — compact shell, Focus and Canvas

The rebuilt local terminal was reviewed at `http://localhost:3001/terminal` after the reference-led shared shell replacement.

| Surface | Observed result | Follow-up |
|---|---|---|
| Focus | The app now uses one compact single-row header with 1m–D interval controls, Indicators/Layers/Research actions, compact quote/state, and icon tools. The chart occupies almost all remaining viewport height and the former mode-card strip and lower Context Deck are absent. | Keep this as the Focus baseline; later verify at desktop width. |
| Canvas | Layers appear as a true fixed left panel, followed by the main chart, instead of a right drawer or generic lower deck. The panel groups Price, Structure, Flow, Value, Positioning, Liquidity, installed studies, and custom indicators with source-gated state. | At the approximately 873px review viewport, the 218px Layers column makes chart width tight. Add a medium-width responsive overlay/collapse threshold before final validation so the chart stays the primary surface outside full desktop widths. |
| Visual status | The new header is materially more compact than the prior two-header workstation and retains no oversized explanatory mode menus. | Apply the same compact density to Research Mode, then run 1440px and mobile acceptance captures. |

No reference-image values were used as data. The local chart rendered current verified Gate.io historical candles and the existing source-gated layer controls.

## Local review — Research Mode

Research Mode now renders three separate regions rather than the prior generic drawer: a hypothesis pane, central chart/evidence canvas, and a Strategy Tester panel. The tester opens on Overview rather than the code editor, preserving the chart as the primary working surface.

At the local review viewport, all three regions are simultaneously visible and no Context Deck appears. The first-run Strategy Tester overview is appropriately empty because no historical run has been completed; it exposes a focused “Open strategy” action rather than fabricated backtest metrics. The next validation must confirm that the compact Research layout retains usable widths at a true 1440px desktop viewport and collapses panels cleanly at narrower CSS widths.

The compact Research Mode Strategy Tester was opened from its Overview empty state and compiled the visible closed EMA-crossover strategy successfully. The UI reported `READY TO RUN`, exposed the discovered `Length` input, and retained the closed-AST / no-broker boundary. This confirms the rebuild did not break code-first strategy compilation while moving it out of the dominant first-view layout.

The compiled strategy completed a verified 366-bar historical run in the browser worker. Research Mode then automatically returned the tester to Overview and rendered only the completed-run evidence: equity 92,698.10, net P&L -7,301.90, total return -7.30%, max drawdown 28.77%, win rate 14.3%, profit factor 0.76, and 21 modeled trades. The chart displayed the resulting historical entry/exit markers. These values are local test observations from the verified current window, not reference placeholders or predictions.

## Deterministic 1440px Focus capture

A fresh 1440×960 headless capture confirmed that Focus Mode has a single compact header row and a chart-dominant body. The header occupies 36px; the icon rail is a narrow left strip; no large workspace selector, second control strip, generic card deck, or persistent drawer remains. The price chart, integrated volume pane, and native oscillator pane fill the remaining workspace. This capture used the current public market returned to the local app and did not use any reference-image data.

## Deterministic mobile Focus capture

A fresh 390×844 headless capture confirmed that the narrow-header fallback remains one row: only the mark, compact market input, selected timeframe, iconized terminal actions, and status glyphs remain. The desktop rail is suppressed, the chart retains readable price/volume/oscillator panes, and no panel overlaps the chart. Canvas and Research panels use intentional overlays at narrow widths rather than permanent width-consuming columns.

## Technical acceptance

The post-rebuild quality gate passed: TypeScript validation, 29 test files / 103 tests, and the production client/server build. Existing workspace-preference tests continue to cover persisted Focus/Canvas/Research mode state, and the local end-to-end Strategy Tester run confirmed the rebuilt Research surface preserves compilation and historical worker evaluation.
