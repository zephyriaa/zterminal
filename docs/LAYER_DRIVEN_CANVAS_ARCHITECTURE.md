# ZTerminal Layer-Driven Research Canvas Architecture

## Purpose and Product Boundary

ZTerminal is a **public-market research terminal**. Its core interaction is **Chart → Layer → Visual Evidence → Context → Research**, rather than a dashboard of disconnected metrics and pages. The chart is the primary analytical reference in all modes. The product currently uses Gate.io public snapshots and historical candles; it does not route orders, connect brokerage accounts, or represent unavailable trade-tape, options-chain, or GEX data as present.

> **Current boundary:** Research and analysis are enabled. Live execution, autonomous action, live execution-code generation, and broker connectivity are not implemented.

## Information Architecture

| Product state | Job | Persistent UI | Contextual UI | Chart allocation |
|---|---|---|---|---|
| **Canvas** | Primary market analysis | Compact brand/mode bar, instrument context, timeframe strip, layer palette, provenance dock | Selected-layer inspector | Majority viewport; chart remains dominant |
| **Focus** | Low-distraction analysis | Compact mode bar and essential timeframe controls | Activated only by deliberate request | Maximum chart-to-interface ratio; palette, inspector, and secondary metadata are hidden |
| **Research** | Hypothesis-to-evidence work | Same Canvas chart and controls | Research canvas containing hypothesis, validation condition, data contract, evidence requirements, and session-only staged definition | Chart remains visible alongside research context |

The previous permanent, separate areas for Order Flow, Strategy Builder, Backtester, Research Lab, Alerts, and Journal are not retained as top-level dashboard destinations. Their valid functions are either a chart layer, a contextual detail surface, a Research-mode capability, or intentionally deferred because required data or persistence is not yet available.

## Component Hierarchy

```text
Home
├── TerminalTopbar
│   ├── BrandLockup
│   ├── ModeSwitcher (Focus | Canvas | Research)
│   └── ContextActions
├── InstrumentStrip
│   ├── SymbolAndPriceContext
│   ├── Compact24HourMetrics
│   └── PublicSourceStatus
├── TerminalWorkspace
│   ├── LayerPalette (Canvas and Research only)
│   └── ResearchStage
│       ├── ChartToolbar
│       ├── NoticeRegion
│       └── AnalysisCanvas
│           ├── CanvasChart
│           │   ├── CandleGeometry
│           │   ├── VisualLayerOverlays
│           │   ├── VolumeDistribution
│           │   └── PriceAxis
│           ├── LayerInspector (Canvas only)
│           └── ResearchCanvas (Research only)
└── ProvenanceDock
```

The hierarchy is deliberately shallow. Every secondary surface is adjacent to the chart rather than a different top-level application.

## Chart and Layer Model

Each research layer declares an identifier, category, availability, source, and disclosure. The interface uses this capability record to decide whether it may be rendered, whether a user can toggle it, and which inspection detail must accompany it.

| Layer category | Current layers | Visual encoding | Data rule |
|---|---|---|---|
| Candle-derived studies | VWAP; EMA 20/50 | Lines over price | Derived only from the loaded verified Gate.io candle window; calculation semantics are disclosed |
| Candle-derived context | Volume profile; sessions; structure | Side distribution, subtle UTC regions, high/low/midpoint levels | Explicitly labeled as candle-window context, not tick-level or predictive analytics |
| Trade-flow | CVD | No series or simulated marker | Hidden from the chart until a verified public trade tape exists |
| Positioning | GEX | No zones, walls, or flip levels | Hidden from the chart until verified options-chain and Greek data exist |

Raw values are secondary. Chart-native evidence—lines, price levels, distributions, subtle session regions, and local overlays—comes first. The selected layer may open a compact inspector that reveals source, coverage, method, and availability without occupying permanent chart space.

## Interaction and State Model

| State | Type | Transition | Effect |
|---|---|---|---|
| `mode` | `Focus | Canvas | Research` | Mode switcher or context action | Changes disclosure level while retaining the same instrument, chart, and verified data queries |
| `timeframe` | Supported UI timeframe | Timeframe or range control | Maps to a Gate.io-supported interval and refreshes verified historical bars |
| `activeLayers` | Available layer identifiers | Layer palette | Adds or removes a verified visual encoding from the existing chart |
| `selectedLayer` | Layer identifier or none | Layer palette inspection | Opens contextual source/method detail; unavailable layers remain non-rendering capability gates |
| `replay` | Boolean | Replay control | Presents an earlier slice of the same verified dataset; no synthetic market data is introduced |
| Research draft | Browser-session state | Research form | Stages a human-reviewed hypothesis definition with current source, interval, timestamp, and coverage; no notification or execution action occurs |

Focus is not a separate UI product. It is a state that removes the palette, inspector, secondary instrument metadata, and provenance cards until requested. Research is also not a separate product. It adds the hypothesis-to-evidence drawer beside the same chart and never navigates the user away from the chart context.

## Responsive Behavior

Desktop Canvas presents the layer palette, a dominant chart, and one compact inspector. On medium screens, the inspector is removed before the chart is reduced. On mobile, the palette becomes an overlay, the Research canvas becomes a temporary right-side surface, and the mode switcher reduces to icons. Focus mode hides all optional inspection surfaces at every breakpoint.

The responsive priority order is: chart readability, timeframe access, mode switching, source status, layer control, contextual detail. No breakpoint restores legacy dashboard cards or permanent analytical panels.

## Visual System

The visual system uses a near-black indigo base, low-contrast violet structural lines, teal for available public-data studies and positive candle movement, and restrained violet for contrasting candle movement and secondary studies. Source and capability status use explicit text and small color tokens; color is not the sole indicator of availability.

The supplied ZTerminal mark appears in the brand lockup and compact account token. Typography is compact, numerical content uses a monospaced treatment where comparison matters, and permanent card surfaces are reserved for data contracts and contextual disclosure rather than generic dashboard metrics.

## Quality Gates

The selected design is accepted only if it passes the following checks:

| Test | Acceptance condition |
|---|---|
| Five-second test | Instrument, price context, timeframe, public-data status, and active layers are understandable without dashboard scanning |
| Chart test | Meaningful research occurs while attention stays on price and chart-native evidence |
| Clutter test | Any persistent element without a unique analytical purpose is removed or moved into a contextual surface |
| Differentiation test | The interaction model is layer-driven and chart-native, not a recolored conventional terminal dashboard |
| Progressive-disclosure test | Advanced source/method details are available when requested but do not permanently consume chart real estate |
| Consistency test | Focus, Canvas, and Research are visibly related states of one product and retain the same public-data contract |

## Future Capability Gates

True order flow requires verified trade-level data with documented coverage and timing. GEX requires a licensed or otherwise verified options-chain and Greek data provider with a documented calculation method, timestamp, and symbol mapping. AI-assisted strategy research may later convert user-authored hypotheses into a research schema or research-only code after separate model, privacy, and validation approval. None of these future capabilities may be inferred from candle data or silently added during interface work.
