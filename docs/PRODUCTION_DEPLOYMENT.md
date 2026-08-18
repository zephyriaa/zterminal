# ZTerminal Production Deployment Record

**Date:** 2026-08-18
**Render service:** `srv-d9uogdajobas73bbnn1g` (`https://zterminal.onrender.com`)
**Deployed branch:** `render-hosted-research-terminal`
**Deployed commit:** `4aec81ed42233f00399578f64abeea72ee21b568`
**Render deployment:** `dep-da1r1k3l550s73ajoks0`

## Deployment outcome

The reviewed recovery pull request was merged into the Render service’s configured deployment branch and Render completed the Docker build and service rollout successfully. The deployment log reported that the service is live and listening on the Render-assigned port.

## Production configuration decision

The Render Environment view contained no configured environment variables and no linked environment group. Consequently, no `DATABASE_URL`, `OAUTH_SERVER_URL`, or related OAuth configuration was available. The release was therefore deployed in its intentionally supported **browser-local research-draft mode**. The additive workspace migration `drizzle/0001_add_research_workspaces.sql` was **not run**, preventing an unsafe migration against an unspecified database.

The Render startup log reports that `OAUTH_SERVER_URL` is not configured. This is consistent with the selected local-only mode: sign-in and durable workspace synchronization remain unavailable, while Canvas, truthful market data, local research drafts, and deterministic research evaluation remain usable.

## Follow-up needed for durable workspace mode

Before enabling authenticated workspace synchronization, configure the existing OAuth variables and a production `DATABASE_URL` in Render, validate connectivity, take a database backup, and then apply `drizzle/0001_add_research_workspaces.sql` once. A follow-up deployment and authenticated smoke test are required after that configuration change.

## Release lineage

The deployment source changed through merged pull request [#1](https://github.com/zephyriaa/zterminal/pull/1), whose merge commit is `4aec81ed42233f00399578f64abeea72ee21b568`. Render built and deployed that exact commit under deployment `dep-da1r1k3l550s73ajoks0`.

## Production Canvas smoke test

The public production terminal loaded the Gate.io QQQX/USDT snapshot and a verified 97-bar one-day dataset. The Canvas disclosed effective UTC coverage from `2026-08-17 01:00:00 UTC` to `2026-08-18 01:00:00 UTC`, `vwap · v1.0.0`, and dataset fingerprint `fnv1a-610e0156`. This confirms the deployed public-data, bounded-coverage, and shared-feature-provenance path.

## Production Research smoke test

Production Research mode correctly labelled the draft as local-only and exposed the sign-in option without implying authenticated persistence. The deterministic evaluation ran over the same 97 verified bars, returning run `bt_a-b1ebb730` with hash `fnv1a-b1ebb730`, two trades, net P&L `-0.24`, return `-0.00%`, and maximum drawdown `-2.82`. The panel visibly retained its research-only warning: no investment advice, broker route, forecast, optimization, or intrabar-fill claim.

## Health check

`https://zterminal.onrender.com/healthz` returned `{"status":"ok","service":"zterminal-research-terminal","execution":"disabled"}` after deployment. This confirms the process-level health contract and the continued absence of execution routing.
