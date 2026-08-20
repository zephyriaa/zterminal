# Full Workstation Redesign Validation

## Scope

This release replaces the prior compact chart-shell presentation with a dense ZTerminal workstation. The release follows the approved composition: branded global bar, Focus/Canvas/Research layouts, dominant verified chart, persistent Layers and Research columns, and a six-cell lower context/action deck.

## Implemented Surface

| Area | Implemented behavior | Truthfulness boundary |
|---|---|---|
| Global workspace header | Full ZTerminal wordmark; Focus, Canvas, and Research layout controls; search, alert-state, settings, install, and account controls. | The controls preserve the same terminal state and do not imply product destinations or broker access. |
| Main canvas | Verified Gate.io historical chart, native study overlays, replay, timeframe/range selection, provider evidence, and live-only context pane. | Historical and live states remain separately labelled. |
| Layers column | Persistent grouped Price, Structure, Flow, Value, Positioning, Liquidity, and My Indicators catalogue. | Unavailable GEX and liquidity capabilities remain gated; custom studies remain closed-runtime local indicators. |
| Research column | Persistent strategy-first Backtest Lab using validated closed ZS source and browser-worker historical evaluation. | Protocol remains optional; no arbitrary code, forecast, trade order, or broker route exists. |
| Lower context deck | UTC Sessions, Market Status, source-gated News, Fear & Greed, and COT, plus Quick Actions. | No external headlines, sentiment values, commitments values, or fake alerts are rendered without a source contract. |
| Responsive behavior | Desktop uses simultaneous columns; tablet stacks research below canvas; mobile uses one column and compact global/market controls. | Mobile retains source labels and does not hide decision-support limits. |
| PWA delivery | Automatic service-worker activation and controller-change reload retained from the preceding delivery repair. | API, auth, and market data remain outside runtime cache routes. |

## Verification Evidence

| Check | Result |
|---|---|
| TypeScript | `pnpm check` passed |
| Automated tests | `pnpm test` passed: 27 files, 93 tests |
| Production bundle | `pnpm build` passed; PWA service worker generated |
| Desktop layout | Local workstation loaded at 1280px with persistent Layers and Research columns, source-gated lower deck, and verified BTC/USDT 15-minute data. |
| Chart geometry | Verified chart container measured 647px wide × 894px high; rendered canvas measured 566px × 527px. |
| Data context | Browser validation observed 97 verified 15-minute bars, Gate.io coverage timestamps, a dataset fingerprint, and labelled live/degraded order-flow conditions. |

## Explicitly Deferred Product Work

Fixed OOS holds, seeded bootstrap confidence analysis, Monte Carlo, walk-forward validation, parameter sensitivity, risk-plan persistence, context-aware alerts, journaling, execution analysis, and a Tauri Windows client remain roadmap items. They require dedicated data, persistence, statistical, or notification contracts and are not represented as currently available in this release.

> ZTerminal remains research and decision-support software. It provides context and historical evidence; the user makes the decision. No execution surface, broker connection, or automatic trade action is included.
