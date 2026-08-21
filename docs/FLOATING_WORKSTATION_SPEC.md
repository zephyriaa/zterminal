# ZTerminal Floating Workstation Specification

## Design interpretation

The supplied reference establishes a **dense institutional workstation**: a restrained dark navy surface, a compact two-tier command strip, a narrow tool rail, a dominant elevated chart canvas, and small source/status indicators. It will be used as the visual and interaction reference, but it will **not** restore the previously rejected Focus, Canvas, or Research workspace mode switcher.

## Desktop composition

The redesigned terminal will provide a compact brand-and-account bar, a market command strip, a left tool rail, and a matte workstation canvas. The verified chart becomes the primary elevated window: it has a title bar, clear data provenance, chart controls, depth through subtle borders and shadows, a drag handle, and a visible resize grip. The market summary, Indicators, and Strategy Tester become optional movable panels that can overlap the workstation canvas without consuming permanent chart width.

| Surface | Role | Interaction |
| --- | --- | --- |
| Chart canvas | Primary verified-market analysis surface | Drag by title bar; resize from lower-right grip; raise on interaction; reset layout from canvas controls |
| Market context | Quote, watchlist, and data-contract summary | Open/close; movable and resizable on desktop |
| Indicators | Searchable native-study and data-gated catalogue | Header-launched floating tool panel; movable and resizable |
| Strategy Tester | Code-first historical strategy evaluation | Header-launched floating tool panel; movable and resizable |
| Tool rail | Compact launcher for tools and chart reset | Opens tools without creating modes |

## Persistence and boundaries

Panel layout contains only bounded, non-sensitive geometry: panel x/y position, width, height, z-order, and minimized state. Guest users retain it locally; signed-in users synchronize the same bounded preference through the existing account-isolated workspace contract. No market data, credentials, trades, custom strategy source, or order-routing configuration is included.

The layout must preserve the existing verified-data labels, provider gating, closed indicator runtime, reproducible historical backtesting, account control, PWA behavior, and intentional lack of broker/execution routes. On small screens, panels collapse into the existing responsive flow; drag and resize affordances are suppressed rather than forcing a desktop canvas onto mobile users.
