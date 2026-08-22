# Terminal Reference Rebuild Plan

## Objective

Rebuild the public `/terminal` experience as one coherent floating workstation rather than applying further isolated style patches. The result will preserve the landing page at `/`, retain the read-only Binance/P0 research architecture, and use the supplied reference as the visual and interaction contract.

> The rebuilt terminal is a research workstation, not an execution platform. Provider availability, L2 sequencing, open-interest availability, and order-flow withholding will remain explicit and fail closed.

## Acceptance Contract

| Area | Required outcome |
| --- | --- |
| Overall composition | A fixed two-row workstation header, a narrow vertical tool rail, and one quiet chart-first floating canvas. The initial state must look intentional before any tool is opened. |
| Brand area | The top-left area contains only the Z mark. The `ZTERMINAL` wordmark and descriptive label are removed from the terminal header. |
| Visual language | Near-black navy surfaces, restrained violet/cyan edge lighting, thin cool-gray borders, dense financial typography, and low-contrast grid texture. No decorative purple gradients competing with the chart. |
| Header controls | A centered instrument search, compact venue/quote context, one concise workspace label, and a small utility/account cluster. Persistent decorative or duplicate controls are removed. |
| Instrument strip | A professional instrument combobox at the left, compact timeframe buttons, and only actions that affect the active chart. It must not duplicate the top header. |
| Symbol selection | Searchable, keyboard-accessible contract picker with recent instruments, favourites, and verified contracts from the current market API. It must not present a raw text field or fabricated symbols/data. |
| Tool rail | Four or five purposeful, consistently sized icons: studies, strategy/backtest, market context, order flow, and layout reset. Icons use the same stroke weight, tooltip treatment, pressed state, and semantic placement. |
| Chart window | A single floating chart panel, aligned to the canvas grid. Its header contains a drag affordance, small provenance label, instrument/timeframe, replay, refresh, and compact window controls. The chart fills the available workspace. |
| Panels | Studies, strategy/backtest, market context, and order-flow tools open only on demand as floating windows or sheets. They never permanently crowd the initial chart canvas. |
| Data integrity | Feed health remains inspectable but moves out of the visual hierarchy. Unavailable or degraded data is shown only where the user asks for that data, never as a decorative always-on status bar. |
| Mobile | Preserve the existing no-page-zoom policy and chart pinch/pan behavior. Convert desktop tool panels into touch sheets without shrinking the chart into an unusable column. |

## One-Release Implementation Sequence

| Workstream | Scope | Completion check |
| --- | --- | --- |
| 1. Reference shell | Replace the current generic terminal shell with a dedicated `ReferenceWorkstationShell` that owns the two header rows, tool rail, canvas, and panel layering. | No sidebar, duplicate navigation, or wordmark is present on `/terminal`. |
| 2. Visual token system | Consolidate the terminal-only color, spacing, border, shadow, and typography tokens. Remove the overlapping purple restoration CSS and scope a single design system to the terminal route. | The chart, header, rail, popovers, and sheets share one visual language. |
| 3. Header and instrument strip | Build the reference-led header as a responsive layout. Keep only the logo mark at upper left; use an instrument control in the appropriate strip; remove crossed-out duplicate/status elements. | Desktop header remains one calm visual hierarchy at 1363px wide and does not overflow at tablet widths. |
| 4. Instrument picker | Replace the existing generic command trigger with `InstrumentPicker`: verified contract rows, symbol/description, provider label, recent list, favourites, loading and unavailable states, keyboard navigation, and mobile sheet behavior. | Selecting a contract updates the existing P0 workspace store and chart without invented quotes or contracts. |
| 5. Chart workspace | Recompose the existing verified `TerminalChart` and chart controls inside the new floating panel. Make initial chart bounds reference-like, preserve maximize/minimize behavior, and keep the minimised form compact. | Chart uses the complete panel canvas and all existing canvas gestures still work. |
| 6. Purposeful tools | Rebuild the rail and workspace actions around the actual product surface: studies, strategy/backtesting, verified order flow, market context, and reset. Replace generic or redundant icons with a consistent semantic set. | Every icon opens a real capability and has an accessible name and tooltip. |
| 7. On-demand research panels | Restyle existing studies, strategy, context, CVD, and footprint surfaces into matching floating panels. Hide them in the initial state and retain P0 data gates. | No unavailable L2/OI/order-flow panel renders values as if they were live. |
| 8. Responsiveness and persistence | Tune desktop, tablet, and mobile layouts; keep panel state and chart preferences safe in local storage; retain the mobile viewport and gesture protections. | No horizontal overflow, browser zoom conflict, or lost chart interaction on a phone-size viewport. |
| 9. Stale-client retirement | Keep the service-worker retirement path and no-store response policy while moving to the final shell. | Fresh browser requests load Next assets only; archived Vite assets are not a required part of the terminal. |

## Component Plan

| Component | Responsibility | Existing system retained |
| --- | --- | --- |
| `ReferenceWorkstationShell` | Terminal-only structure, route composition, keyboard shortcuts, panel orchestration. | Workspace state store and command palette. |
| `WorkstationHeader` | Logo mark, concise workspace label, global utilities, account state. | Auth/session information only when actually available. |
| `InstrumentPicker` | Verified contract discovery, search, recent/favourite access, keyboard/mobile interaction. | `/api/markets`, market contract normalization, workspace symbol state. |
| `InstrumentToolbar` | Active instrument, timeframes, minimal chart actions. | Current timeframe state and chart action events. |
| `ReferenceToolRail` | Consistent tool icons and active states. | Existing studies, strategy, order-flow, and context capabilities. |
| `ReferenceChartWindow` | Floating-panel geometry, compact header, chart controls and canvas region. | `TerminalChart`, market stream hook, chart settings, replay, study overlays. |
| `ReferencePanel` | Shared floating/drawer behavior for supporting research tools. | Current fail-closed market, CVD, footprint, and strategy components. |

## Explicit Non-Goals

The rebuild will not add order placement, account trading, broker integration, or synthetic market values. It will not show a provider as live merely because trade prints arrive when sequence-safe depth is absent. It will not reintroduce the obsolete Gate.io/QQX Vite client as the production terminal.

## Validation Gate

The release will be accepted only after the following checks pass together:

| Test | Required evidence |
| --- | --- |
| Functional | TypeScript, lint, existing deterministic test suite, and production build pass. |
| Desktop visual | A clean browser review at the reference desktop hierarchy: logo mark only, compact header, professional symbol picker, purposeful rail, and chart-first floating panel. |
| Mobile visual | A phone-size browser review confirms no accidental page zoom, no horizontal overflow, usable picker sheet, and preserved chart gestures. |
| Data integrity | Historical bars, live quote/trade state, L2/order-flow gates, and unavailable states remain sourced from the existing P0 contracts. |
| Release integrity | `/` remains the landing page; `/terminal` serves the new Next workstation; service-worker retirement and no-store checks remain effective. |

## Delivery Boundary

This is intentionally a **single terminal release**. I will first complete the whole reference shell, picker, tool rail, panel treatment, and responsive behavior in one branch/commit sequence, then run the validation gate and present one coherent preview for review before publishing.
