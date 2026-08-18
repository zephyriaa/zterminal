# Production Deployment Validation

**Deployment date:** 2026-08-18
**Public URL:** https://zterminal.onrender.com
**Promoted production revision:** `23557cc` — merge of GitHub PR #5
**Render service:** `zterminal` (`srv-d9uogdajobas73bbnn1g`), Frankfurt, free tier

## Promotion and Build Evidence

| Checkpoint | Evidence | Result |
|---|---|---|
| Product promotion PR | [PR #5](https://github.com/zephyriaa/zterminal/pull/5) promoted `product/orderflow-research-terminal` to `render-hosted-research-terminal`. | Merged. |
| Remote quality gate | GitHub Actions run `32188099911` completed successfully after the workflow installed the declared `pnpm@10.34.5` before Node cache setup. | Passed. |
| Production branch | `origin/render-hosted-research-terminal` now resolves to merge commit `23557cc`. | Updated. |
| Render deploy | Render event `dep-da2cv3ql9ujc739vqbbg` reported **live** for `23557cc`. | Live. |

## Public Application Observation

The deployed public URL loaded the premium ZTerminal workstation with the supplied brand mark, chart/research/studies controls, local-workspace disclosure, public-feed health strip, verified chart data, historical coverage, and required chart-engine attribution. The live terminal reported Gate.io as **LIVE**, while Binance USDⓈ-M and Bybit Linear were **DEGRADED**; this matches the release policy rather than fabricating active provider status. The public terminal explicitly retained **“Public-market research only”** and **“Execution disabled · no broker route.”**

The first navigation sample occurred during the normal post-wake/request-settlement interval and briefly showed unavailable loading states. A repeat navigation returned verified Gate.io data and the intended degraded states for the other two feeds. This is recorded as a fail-closed recovery observation, not a data-availability defect.

## Retained Production Limits

| Limit | Production truth |
|---|---|
| Service tier | Free Render service; inactive instances can spin down and delay requests. |
| Binance | `VERIFYING`/degraded until a release-environment WebSocket event is captured. |
| Bybit | Degraded in the observed production browser session; no substitution or stale-tape fallback is claimed. |
| Durable workspaces | Disabled; the public app preserves browser-local interface preferences only. |
| Historical order flow | No historical tick, depth, CVD, footprint, or large-print archive. |
| Execution | No broker route, order route, paper trading, or automated trading capability. |
| GEX | Unavailable pending an options-feed provider. |

## Live Interaction Checks

The deployed terminal opened the `?` keyboard reference and retained its explicit no-order/no-execution language. `Escape` closed that reference. The documented lowercase `f` shortcut then entered Focus mode with the live status announcement **“Focus mode enabled. Chart workspace only. Press Escape to exit.”** The production Focus view contained only the chart workspace and exit control; `Escape` restored the full research workstation and announced the restoration. These checks confirm the deployed revision includes the IQ1 interaction-quality slice rather than only the earlier terminal baseline.
