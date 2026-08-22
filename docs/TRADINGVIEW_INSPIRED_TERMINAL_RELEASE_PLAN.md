# TradingView-Inspired Terminal Release Plan

## Objective

Rework `/terminal` as a coherent charting workstation inspired by familiar TradingView interaction patterns, while retaining ZTerminal’s own dark-purple visual language, the existing floating-window model, read-only market-research scope, and strict no-fabrication policy. The landing page at `/` is out of scope and must remain unchanged.

This release will remove the current **Studies** and **Order Flow / Flow** surfaces, replace them with a professional **Indicators** workflow, make chart movement behave like a modern charting terminal, expose verified broker and symbol availability without inventing availability, add a transparent account panel, and redesign the indicator and strategy creators around a chart-first research workflow.

> The design will reproduce useful, broadly familiar charting conventions, not TradingView code, copyrighted assets, product branding, or private implementation details.

## Design decisions

| User request | Release decision |
|---|---|
| Remove Studies | Remove the Studies tool, its floating window, and related generic wording. Existing active overlays will be retained and managed through the new Indicators workflow. |
| Remove Flow | Remove all Flow and observed-order-flow entry points from the main terminal. The underlying verified research backend remains intact and is not replaced by synthetic panels. |
| Better indicators list | Introduce an Indicators browser with search, categories, favorites, active-on-chart list, clear add/remove actions, input/style/visibility editing, and keyboard support. |
| Full symbol list | Populate the selector only from an active provider’s live verified instrument catalogue. No static substitutions, stale aliases, or guessed market lists will appear as selectable. |
| Broker names | Add a broker/provider directory that distinguishes **active and verified** providers from catalogued, unavailable, or future providers. |
| Account icon | Turn the top-right research account icon into an account drawer/popover that reports actual session, mode, provider, selected contract, saved layout status, and no-connected-account state. |
| Better creators | Redesign indicator and strategy creators as compact charting workspaces with separate Inputs, Style, and Review/Test sections. |
| Chart navigation | Restore reliable free time pan, cursor-anchored zoom, independent price-scale navigation, touch pinch, reset, and go-to-realtime behavior. |

## Phase 1: Chart-navigation foundation

Refactor the chart viewport into a dedicated controller for visible candle count, historical/right-edge offset, price zoom, and vertical price position. Implement bounded pure operations for time pan, time zoom at pointer, price-axis zoom, explicit price pan, reset, and go to realtime.

The plot will own its gestures. A primary drag in the chart will pan time after a small movement threshold, wheel and pinch gestures will zoom around the pointer or pinch midpoint, and the price axis will support independent stretch/zoom behavior. An explicit middle-mouse or modified plot gesture will pan the price range. Pointer capture and release will be deterministic so panning does not get lost when the chart is inside a floating desktop window.

The title bar and resize edges will remain the only controls that move or resize a desktop window. Live trades will update the latest verified candle without recentering or resetting the user’s manually panned view.

## Phase 2: Terminal chrome and tool-surface simplification

Replace the current Studies and Flow entry points in the header, rail, chart toolbar, and floating-window state with a single **Indicators** entry point. The icon rail will contain only purposeful tools: Indicators, Strategy Developer, Market/Provider Context, workspace layout reset, and feed details.

The chart toolbar will be simplified around timeframes, chart type, Indicators, symbol/provider context, and chart preferences. It will not present an unnecessary order-flow launcher. Supporting windows will retain the desktop-style drag, resize, minimize, maximize, close, focus, and persistence behavior already established for the workstation.

## Phase 3: Indicators browser and creator

Create an **Indicators** browser that feels native to the workstation rather than a generic tab. It will open as a focused floating library window or compact command surface, depending on available canvas space, and will include the following sections:

| Section | Functionality |
|---|---|
| Search | Instant filtering by indicator name, category, description, and supported formula type. |
| Categories | Trend, Momentum, Volatility, Volume, and Saved/Custom categories, each showing only indicators that the renderer can actually support. |
| Favorites and recent | Local-only user convenience state for starred and recently used indicators. |
| On-chart | A concise list of active overlays with visibility, settings, style, reorder where renderer semantics permit it, and removal controls. |
| Add flow | Selecting an indicator adds it to the chart only after its supported inputs are confirmed. |
| Settings | Inputs, Style, and Visibility tabs for each active indicator. |

The creator will replace the current basic “Create study” flow. It will offer a clear supported-indicator model with formula family, source series, length/parameters, color, line width, visibility, and validation. Initial supported renderer families will be explicitly scoped to deterministic native calculations such as EMA, SMA, session VWAP, and any additional calculations added only with deterministic rendering and tests.

The existing authorized-source migration feature will become an optional **Review source** path inside the creator. It may assess a user-supplied source for a narrow native equivalent, but it will never execute Pine code, scrape protected scripts, or claim an unsupported conversion is equivalent.

## Phase 4: Strategy developer redesign

Reframe the Strategy Developer as a charting-oriented research workspace with a professional editor and no trading-execution controls. The redesign will include:

| Area | Functionality |
|---|---|
| Editor | A ZScript-focused code editor with clear research-only status, syntax guidance, sample templates, validation feedback, and a link to ZScript documentation. |
| Inputs | Named strategy inputs, symbol/timeframe context inherited from the selected verified contract, and visible parameter constraints. |
| Logic | Explicit entry, exit, risk, and position-sizing rule sections. Unsupported syntax will fail visibly rather than being guessed. |
| Test | Review-only backtest configuration, deterministic validation, assumptions, data-status/provenance, results, and warnings. |
| Review | Persistent strategy metadata, change summary, source ownership acknowledgement, and no live order controls. |

The implementation will audit and remove stale Gate.io/QQQX defaults from strategy state. The default symbol/timeframe will follow the currently selected verified Binance instrument only when the active provider supports it; otherwise the strategy workspace will show an unavailable state instead of remapping the contract.

## Phase 5: Broker directory, verified symbol discovery, and account panel

### Broker directory

Create a broker/provider directory reachable from the symbol selector and market-context surface. It will use the existing capability catalogue but correct its presentation and status semantics. Every provider card will show its label, public read-only access model, native symbol format, market-data capabilities, and one of these status labels:

- **Active and verified**: current terminal provider with a healthy, source-validated contract catalogue and stream.
- **Available catalogue only**: known broker metadata but not selectable for live research until adapter, contract mapping, regional availability, and sequence/data acceptance checks pass.
- **Unavailable**: live catalogue/connection cannot be verified now; no symbols appear as selectable.

This preserves broker names and transparency without implying that a catalogued venue is currently connected or tradeable.

### Full verified symbol selector

Replace the static single-contract selector with a provider-backed catalogue service. For the active Binance Futures provider, obtain the current list of eligible perpetual contracts from Binance’s authoritative public exchange metadata and normalize it through the provider adapter. The UI will include search, symbol, quote asset, product type, status, recent selections, favorites, provider filter, and keyboard navigation.

A symbol is selectable only after the active provider has supplied and validated it. If Binance’s catalogue endpoint is blocked, throttled, regionally unavailable, stale, or fails schema validation, the selector will state that the catalogue is unavailable and preserve the currently verified selected contract. It will not display an invented complete list or silently fall back to Gate.io data.

### Account panel

Make the top-right account icon interactive. Its drawer/popover will state only actual facts: Research Mode, read-only permission scope, active provider, selected contract, feed health, local layout/saved-workspace information, and no connected brokerage account if none exists. It will deliberately omit fake balances, positions, P&L, identity, cloud-sync claims, or execution controls. A future connection option may be presented as disabled or “not configured” until a real user-authorized connector exists.

## Phase 6: Visual system and responsiveness

Unify the new surfaces with the existing ZTerminal design language: dark neutral canvas, disciplined purple highlights, muted mono market labels, high contrast for price-critical controls, compact professional iconography, and consistent desktop-window title bars. The Indicator browser, strategy editor, symbol selector, broker directory, and account panel will share one component vocabulary rather than receive separate one-off skins.

On desktop, dialogs and libraries will respect the chart canvas and can be moved/minimized like other supporting workspaces. On mobile, they will become full-height controlled sheets so the chart remains usable and browser zoom does not hijack gestures.

## Validation and release plan

| Validation layer | Required checks |
|---|---|
| Data integrity | Provider catalogue uses source-backed metadata; unavailable data is visibly withheld; no stale Gate.io symbols appear in the Binance terminal; no fake account data. |
| Chart interaction | Drag pan, anchored wheel/trackpad zoom, price-axis zoom, price pan, pinch, reset, go to realtime, keyboard navigation, floating-window focus, resize, minimize, maximize, and restore. |
| Indicator flow | Search, category filter, add, inputs, style, visibility, remove, favorites, persistence, creator validation, and unsupported-source refusal. |
| Strategy flow | Current verified symbol handoff, ZScript validation, documentation link, research-only status, deterministic backtest validation, and legacy symbol-default removal. |
| Responsive behavior | Desktop and mobile layouts, no horizontal overflow, touch gestures, keyboard navigation, focus states, and no browser console errors. |
| Build and release | TypeScript, lint, deterministic tests including new chart/catalogue/indicator tests, production build, local visual review, production deployment, public headers/markup, and live browser verification. |

## Important risks and assumptions

The request to “copy features” is interpreted as adopting familiar interaction patterns and feature categories, not copying proprietary source code, branding, third-party logos, scripts, protected indicator definitions, or private APIs. Any broker logo or third-party branding will be used only if a valid permitted asset/source is available; otherwise the directory will use neutral text labels.

“Full available symbols” means the complete current list returned by the active provider after normalization and validation. It does not mean a hard-coded market universe. This may require extending the existing Binance adapter and the contract API, because the current API and provider catalogue retain legacy Gate.io assumptions that must not leak into the new terminal.

The strategy and indicator improvements remain research and backtest tools. They will not add live brokerage login, trading execution, portfolio balances, or account management without a separately approved, authenticated connector and explicit safety review.

## Deliverable

One cohesive `/terminal` release, deployed only after all new surfaces, symbol catalogue behavior, chart navigation, data safeguards, desktop/mobile checks, and production validation pass. The landing page at `/` remains untouched.
