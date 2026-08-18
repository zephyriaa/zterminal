# ZTerminal Premium Workstation Architecture

## Product intent

ZTerminal will become a **chart-first, open-source-friendly research workstation**. The immediate release establishes a premium professional foundation rather than falsely claiming feature parity with every proprietary TradingView capability. It replaces the fixed SVG mock-chart with a real interactive market chart, makes data truth and research workflow contextual instead of dominant, and gives the interface a coherent premium visual hierarchy based on the supplied reference.

## Design translation from the supplied reference

| Reference principle | ZTerminal implementation |
|---|---|
| Full-screen chart dominates | A central interactive multi-pane chart occupies the workspace; contextual panels are drawers rather than permanent visual competition. |
| Quiet dark shell with disciplined violet and cyan accents | Deep near-black surfaces, subtle violet depth, precise borders, legible monospaced numerics, cyan/up and violet/down market states. |
| Professional rails and compact toolbars | Left chart-tools rail, top interval and study controls, right contextual drawer, and a restrained bottom command dock. |
| Integrated data visuals | Candles, EMA, VWAP, volume, profile, and market-structure levels belong in the chart space rather than fragmented cards. |
| Readable scales and current state | Native time/price scales, crosshair, OHLC context, last-price line, connection status, and explicit coverage status. |
| Multi-pane analysis | Price/volume primary pane plus an optional lower momentum pane; specialist layers remain truthfully gated until their source data exists. |

## Chart engine decision

The replacement will use **Lightweight Charts 5.2**, an interactive financial-chart library with native candlesticks, price/time scales, crosshair behavior, series types, plugins, and multi-pane support. Its maintained v5 API supports multiple independently managed panes, flexible pane sizing, programmatic price-scale control, and the data-density characteristics needed for the current bounded historical windows. The primary documentation and release notes support this choice.[1][2]

The existing verified-data contracts, shared VWAP/EMA/profile registry, range resolver, and deterministic research engine remain application-owned. The chart library renders that verified data; it does not become a data source or a substitute for provenance.

## Rebuild architecture

| Module | Responsibility |
|---|---|
| `TerminalWorkbench` | Coordinates instrument, interval, range, chart controls, loading/error state, and workspace mode. |
| `ProfessionalChart` | Owns chart lifecycle, resize observer, native pan/zoom, crosshair, price scale, time scale, candle and volume series, and safe cleanup. |
| `MarketStudies` | Adapts existing feature-registry outputs into EMA, VWAP, volume profile, market-structure, and lower-pane momentum visuals. |
| `ChartStatus` | Communicates loading, partial coverage, provider errors, last verified data, and recovery actions without stale messages. |
| `InstrumentCommand` | Provides validated symbol entry, suggested starting markets, last-good-symbol recovery, venue label, and latest quote context. |
| `InsightsDrawer` | Progressive-disclosure surface for study provenance, data contract, research definition, and reproducible evaluation. |
| `TerminalTheme` | Tokens and layout rules for the premium dark visual system, desktop workstation, and narrow-screen fallback. |

## Data and safety rules

The chart must continue to show only verified public Gate.io data and must display the effective coverage and partial-coverage state. When a new symbol, interval, or range is loading, the last verified chart stays visible with an updating state. When a request fails, the last-good data remains available and an actionable error describes what happened. Unsupported symbols never fabricate data and do not replace a verified chart with a blank canvas.

CVD and GEX remain visible as **locked research capabilities** with explanations. The release will not render or imply tick-derived order flow or options Greeks without verified data sources. Research evaluation remains explicitly historical, deterministic, research-only, and disconnected from brokerage execution.

## Acceptance criteria

| Category | Release requirement |
|---|---|
| Chart behavior | Mouse crosshair, visible OHLC context, time/price scales, pan, zoom, autoscale, current-price line, responsive resize, and a non-empty initial visible range all work against verified candles. |
| Data switching | BTC_USDT and QQQX_USDT update snapshot, candles, studies, coverage, and quote context; last verified content persists during loading. |
| Failure handling | Unsupported symbols and provider failures use actionable inline error treatment and retain the last verified market state. |
| Studies | EMA 20, EMA 50, VWAP, volume profile, and structure levels can be toggled; their provenance/version/fingerprint remains inspectable. |
| Historical windows | Long windows render legibly with native range interaction; partial provider coverage is disclosed without unreadable SVG overplotting. |
| Research | Research definition save and deterministic evaluation remain accessible through the insights drawer with clear local-only/sync status. |
| Visual quality | The chart workspace is visually dominant; controls remain legible at 1440px desktop width and usable on narrow screens; no design relies on dense permanent small-text panels. |
| Quality gates | Type checking, unit tests, production build, and browser validation pass before release. |

## Deferred scope

The immediate release does not claim advanced chart-drawing tools, persistent watchlists, real-time tick streaming, authenticated workspace sync, CVD, GEX, broker execution, options chains, alerts, social/community features, or multi-provider routing. Those are valid future freemium product increments, but each requires a distinct data, persistence, or entitlement design.

## References

[1]: https://tradingview.github.io/lightweight-charts/ "Lightweight Charts documentation"
[2]: https://tradingview.github.io/lightweight-charts/docs/release-notes "Lightweight Charts release notes"
