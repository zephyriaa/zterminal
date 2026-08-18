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

## PR #6 Promotion Observation — In Progress

GitHub PR #6 merged the platform-foundation promotion as `be53fd84a155e8a4fea83e9d405961d375a08f45` at 2026-08-18T22:09:39Z after its required `Quality Gates/verify` workflow passed. The first public-root navigation immediately after merge still returned the prior terminal-at-root behavior, which is consistent with the prior Render artifact remaining live while a deployment is queued. After a 60-second propagation interval, a direct TLS request transiently failed and the browser page became blank. This is recorded as a deployment-transition observation only; it is **not** evidence that PR #6 is live. A later successful landing-route check is required before this release can be marked deployed.

The production branch ref was subsequently confirmed to point to the PR #6 merge commit, while GitHub exposed no external Render deployment status on that commit. The Render dashboard was reachable through the existing browser session but initially presented its cookie-preference interstitial; a subsequent dashboard load closed its connection. Direct navigation to the known service page then succeeded and confirmed that the free-tier `zterminal` service is bound to `zephyriaa/zterminal` branch `render-hosted-research-terminal`, but its prior deployments were manually triggered from the dashboard. No deploy event existed initially for PR #6. A repeat public-root request again served the prior terminal-at-root artifact.

The user-authorized **Deploy latest commit** action was then started from the Render service page. Render created deployment `dep-da2dn27qj5pc73feira0`, checked out `be53fd84a155e8a4fea83e9d405961d375a08f45` from `render-hosted-research-terminal`, and entered the Docker build. The displayed build command reached its install/build stage with `corepack pnpm install --frozen-lockfile && corepack pnpm run build`. Render completed the image build successfully, including bundles for `LandingPage`, `AccountPage`, and `Home`, then reported `==> Deploying...`. Render subsequently reported **Your service is live** and exposed the primary URL. Startup logged the expected `OAUTH_SERVER_URL is not configured` warning while the server began listening on the assigned port; this matches the intentionally browser-local account boundary and is not an application-start failure.

Public root smoke testing then confirmed the new ZTerminal landing page with the visible navigation routes **Research**, **Data contract**, **Access**, and **Open terminal**, rather than the prior terminal-at-root artifact. The deployed `/account` route rendered a guest-safe access page with the sign-in path and **Continue as guest** route to `/terminal`, along with the explicit no-password/no-trading-credentials boundary. The account entry remains an identity/access surface; the deployment does not claim durable account-backed workspace persistence while OAuth and database settings are unconfigured.

The deployed `/terminal` route also loaded successfully. Immediately after navigation, public feeds and market data were visibly withheld while the service initialized. A repeat view recovered verified Gate.io QQQX/USDT quote and 97-bar coverage, while the public tape chips remained accurately `DEGRADED` rather than inventing live states. This confirms the intended fail-closed lifecycle behavior on the production build.

For the supported production Coinbase path, switching the canonical terminal market to `BTC_USDT` allowed the public-feed strip to reach **Coinbase Exchange USD Spot — LIVE**. Selecting it displayed the provenance notice that the separate Coinbase USD-spot tape was selected while the Gate.io chart history and DOM remained in force until a cross-venue contract is released. This confirms the deployed adapter’s venue/product boundary as well as its live connectivity; it does not add Coinbase depth, CVD, or a cross-venue Flow Pulse claim.
