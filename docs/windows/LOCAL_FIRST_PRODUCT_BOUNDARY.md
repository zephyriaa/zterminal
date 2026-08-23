# ZTerminal Local-First Native Product Boundary

**Status:** Approved product direction. This record supersedes any interpretation of the hosted Tauri preview as a desktop-product path.

## Decision

ZTerminal’s Windows product is a **native local-first terminal**. The installed Windows application is responsible for rendering, chart interaction, verified data normalization, local historical storage, replay, indicators, research, Monte Carlo simulation, and workspace state. Render remains a minimal optional service for the website and signed low-volume control metadata only.

> The private hosted Tauri preview is a temporary visual regression and installation check. It is not the local-first product, cannot become the production Windows renderer, and must not receive new terminal capabilities.

## Required ownership split

| Capability | Native client responsibility | Render boundary |
|---|---|---|
| Charts and workstation UI | Native Win32/Windows App SDK shell plus Direct3D rendering and local input handling. | No rendering, visual streaming, or browser-WebView product runtime. |
| Market-data processing | Local provider adapters where allowed, sequence validation, aggregation, indicators, local cache, replay, and truthful status. | At most a narrow authorization/entitlement handoff where a provider requires it. |
| Local research | Bounded Rust analytics, local Python strategy process, reproducibility data, and local simulation. | No hosted backtests, Python execution, Monte Carlo, or raw research-data handling. |
| User state | Local workspaces, drawings, settings, cache, migration state, and offline restore. | Optional explicit sync only after durable storage, migration, and ownership controls are proven. |
| Release/configuration | Local signature, publisher, hash, compatibility, and cache validation. | Small signed release/config records only; never binaries, signing keys, or arbitrary code/configuration. |

## Truthful offline contract

Offline operation means that the app launches and restores prior verified local data, workspaces, replay, indicators, and local research without a service connection. It cannot claim live prices without a verified current provider connection. The UI must show `live`, `cached`, `stale`, `gap`, `unavailable`, and provider provenance states without manufacturing missing data.

## Explicit exclusions

The local-first program does not introduce broker execution, order routing, broker credential storage, fabricated market/account data, undisclosed provider fallback, automatic cloud sync, remote executable code, or a public Windows download. Each would require separately approved design and acceptance work.

## Immediate engineering priority

The next executable gate is real Windows evidence for the native Phase 0 host: compile, run, and benchmark the existing Win32/Direct3D application on a Windows 10/11 build/test environment. No feature work should be added to the hosted wrapper before that evidence exists.
