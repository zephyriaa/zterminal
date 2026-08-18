# Phase 15 Design Audit Notes

**Date:** 2026-08-18
**Branch:** `product/orderflow-research-terminal`
**Scope:** Existing one-screen terminal visual hierarchy and interaction density.

## Observed Live Workstation State

The local workstation rendered verified Gate.io chart data and a current Gate.io trade tape. The existing dark teal/violet palette, brand mark, verified-data labels, browser-local workspace status, and explicit no-execution footer were all present and should be retained. Flow Pulse was enabled from the Studies drawer and correctly rendered its live tape evidence while withholding a numeric depth result pending a reconciled public book.

## Design Risks Identified

| Area | Current issue | High-impact refinement target |
|---|---|---|
| Global hierarchy | The topbar, market command bar, instrument summary, chart controls, and footer all use similar dark bordered strips, making the top of the page visually dense. | Establish a stronger three-level hierarchy: global navigation, concise market command context, and a dominant chart canvas. |
| Instrument header | Venue, status, price, four metrics, coverage, and local-workspace state compete in one horizontal band. | Turn the price and verification status into the focal cluster; demote provenance and local state to compact, readable context chips. |
| Chart workspace | The chart container is framed by several adjacent borders and small controls. | Use a quieter canvas boundary, a more deliberate toolbar grouping, and better breathing room around time/range controls. |
| Overlays | Order-flow panels are correctly optional but can visually float over chart information when opened. | Give live panels a more deliberate glass-elevated system with clearer compact states and safer responsive stacking. |
| Typography | Small text is functionally dense but the flat weight hierarchy makes scanning harder. | Retain monospace numerical data while increasing contrast between micro-labels, primary values, and interaction labels. |
| Responsiveness | Existing rules preserve function but small layouts hide several controls abruptly. | Keep primary market and chart controls visible, collapse secondary context predictably, and ensure drawers/flow panels stack cleanly. |

## Non-Negotiable Product Boundaries

The design refinement must not alter market-query behavior, fabricate stale data, remove source/provenance status, store market snapshots or credentials locally, imply trade recommendations, or add an execution/broker surface. It should preserve TradingView Lightweight Charts attribution in the footer.

## Post-Refinement Browser Check

The revised desktop workstation loaded a verified Gate.io chart snapshot and history, with Gate.io tape `LIVE` and Binance/Bybit explicitly `DEGRADED`. The new command and context clusters visibly separated market selection, source health, price/metrics, coverage, and browser-local workspace status while retaining the existing dark teal/violet palette. In a cold-load state immediately prior, the same layout withheld Flow Pulse values and showed `WITHHELD`; after sources became current, Flow Pulse rendered a Gate.io-labelled 30-second tape delta and separately labelled Gate.io depth imbalance. No historical or cross-venue claim appeared.

A final desktop visual pass should retain the compact top bands, ensure instrument symbols remain on one line when space permits, and confirm the overlay does not occlude an important chart region at practical viewport widths.
