# Premium Workstation Production Release

**Production URL:** https://zterminal.onrender.com
**Render service:** `srv-d9uogdajobas73bbnn1g`
**Deployment branch:** `render-hosted-research-terminal`
**Pull request:** [#2](https://github.com/zephyriaa/zterminal/pull/2)
**Merged commit:** `3230e3624491516eb5151f57293009b2d0501f7a`

## Release status

Render accepted the merged premium-workstation commit, completed the Docker build, and marked the service live. The build produced the Vite client and Express server bundle successfully. The Render startup log confirms the server started on the assigned port and the service was published at the primary production URL.

## Configuration boundary

The production service continues to run without `OAUTH_SERVER_URL` and a database configuration. This leaves authenticated workspace synchronization deliberately unavailable while retaining the supported browser-local research-draft mode. No execution or broker path is enabled.

## Pending public smoke test

The post-release smoke test will verify the premium chart shell, the verified default market, study provenance, deterministic research evaluation, long partial coverage, and unsupported-symbol recovery on the public URL.

## Public Canvas smoke test

The public URL served the premium workstation shell and native multi-pane chart rather than the prior fixed SVG chart. The live QQQX/USDT view exposed a public Gate.io snapshot, verified 97-bar 15-minute coverage from `2026-08-17 10:30:00 UTC` to `2026-08-18 10:30:00 UTC`, candlesticks, EMA/VWAP overlays, POC/VAH/VAL levels, volume and momentum panes, visible price/time scales, and the public-market research/no-execution boundary.

## Public Research smoke test

Public Research mode opened without compressing the chart with a competing drawer. It disclosed a local research draft, verified QQQX/USDT data contract, historical-only methodology, and no-broker boundary. The deployed evaluation completed as `bt_a-754aa801` using `fnv1a-754aa801` over the verified 97-bar window with next-bar-open fills; the returned outcome was 0 trades, net P&L `+0.00`, return `+0.00%`, and maximum drawdown `0.00`.

## Public failure-recovery smoke test

Submitting `NOT_A_SYMBOL` did not blank the workstation or relabel old price data as the invalid request. The header explicitly retained `QQQX / USDT` as `LAST VERIFIED`, displayed `Requested: NOT / A_SYMBOL`, kept the prior verified chart and coverage visible, and surfaced the truthful provider reason: the requested instrument is not a Gate.io USDT perpetual symbol. A retry action remained available.

## Health verification

`https://zterminal.onrender.com/healthz` returned `{"status":"ok","service":"zterminal-research-terminal","execution":"disabled"}` after the premium release. This confirms the live process and the intentional absence of execution routing.
