# Product-Branch Promotion Proposal

**Prepared:** 2026-08-18
**Proposal branch:** `product/orderflow-research-terminal` at `6f29084`
**Current production baseline:** `origin/render-hosted-research-terminal` at `b6ebef0`
**Decision status:** **Review only. No merge, deployment, Render configuration change, or production-branch modification is authorized by this document.**

## Decision Requested

The product branch contains the completed recovery baseline plus seven validated product increments. It is ready for **user review as a promotion candidate**, not for automatic release. Any promotion requires an explicit user instruction identifying the target path and confirming acceptance of the limits below.

> The existing recovery pull request, [PR #4](https://github.com/zephyriaa/zterminal/pull/4), remains **OPEN** and review-only from `recovery/final-form-foundation` to `render-hosted-research-terminal`. It must not be merged as a proxy for approving product-branch work.

## Promotion Candidate Matrix

| Increment | Product revision | Verified outcome | Release-relevant boundary |
|---|---:|---|---|
| Recovery foundation | `0bbe74a` | Controlled public-market terminal baseline with validation evidence. | Already isolated in review-only PR #4; not production-promoted. |
| MEX1 | `f128572` | Venue-labelled bounded public tape foundation and exchange health strip. | Binance remains `VERIFYING`; UI correctly reports degraded state without a live claim. |
| MEX2 | `c098cd7` | Browser-local workspace preferences and fail-closed fresh-data presentation. | No snapshot data, credentials, or durable account workspace is stored. |
| OF1 | `65dbb5c` | Optional live Flow Pulse with 30-second tape and separately labelled current depth evidence. | Descriptive only; no alert, prediction, consolidated liquidity, or execution. |
| P15 | `28336bb` | Premium chart-first dark teal/violet workstation hierarchy and responsive chrome. | Design refinement only; no data-provider expansion. |
| P14 | `90cde49` | Closed ZS runtime drives deterministic historical-candle evaluation in a worker. | No arbitrary JavaScript, host access, broker route, paper trading, or historical order flow. |
| OF2 | `c7f951e` | UTC candle-volume context and selected-venue reported-size live large prints. | No tick-volume profile, USD notional, historical ticks, cross-venue flow, or signal. |
| IQ1 | `06f8718` | Keyboard reference, semantic palette navigation, Focus announcements, and strict chart-only Focus view. | Interaction-only; does not change data or execution posture. |

## Evidence Summary

| Quality area | Latest evidence |
|---|---|
| Regression quality | Latest full suite: **22 test files / 74 tests** passed. |
| Type safety and build | `pnpm check` and the production build passed for IQ1 and preceding slices. |
| Data integrity | Browser validation exercised live Gate.io evidence and explicit withholding when Binance was degraded. |
| Historical research integrity | Closed runtime rejects host escape hatches, dynamic position sizing, shorting, and unavailable historical order-flow inputs. |
| User experience | Browser validation covered `?` help, command-palette semantic selection, `Esc` exits, and a chart-only Focus-mode correction. |

The validation records supporting these statements are linked in the reference list below. They are product-branch evidence only; they do not prove a production deployment occurred.

## Known Limits and Release Blocks

| Topic | Current truth | Effect on promotion decision |
|---|---|---|
| Binance public WebSocket | REST reachability was observed, but no release-environment WebSocket trade event has been captured. | Keep Binance `VERIFYING` / degraded; do not advertise it as a live production venue. |
| Render environment | `DATABASE_URL`, `OAUTH_SERVER_URL`, and `JWT_SECRET` are not configured. | Durable authenticated workspaces remain disabled. A no-auth public research deployment is a separate explicit choice. |
| Render plan | The service is on a free/hobby tier and can spin down. | Do not characterize the deployment as always-on or real-time-service-grade. |
| Historical order flow | No historical tick, depth, footprint, CVD, or large-print archive exists. | Keep all such evidence live-only and withheld outside current bounded tape/depth states. |
| GEX | No options-feed provider is configured. | GEX remains unavailable; no proxy calculation is permitted. |
| Trading / broker actions | No execution surface exists. | Preserve no order routing, trading, paper trading, alerts, or automated recommendations. |
| Branch lineage | Product work is a branch candidate above the shared production merge-base, while PR #4 is a separate recovery review. | Do not merge unrelated histories or promote by an unchecked bulk merge. |

## Required Explicit Decisions Before Any Release Action

The following decisions are intentionally separate and require an explicit instruction from the user:

| Proposed action | Required user approval |
|---|---|
| Merge PR #4 | Explicit approval to merge **that recovery PR only** after review. |
| Open a product promotion PR | Approval of the exact source branch, target branch, reviewed commit range, and intended rollout approach. |
| Merge product work | Explicit approval after the product PR diff and checks are reviewed. |
| Deploy or redeploy Render | Explicit authorization naming the intended target revision and acknowledging the current Render/environment limits. |
| Configure auth/database secrets | User-provided configuration and approval for durable account workspaces. |
| Change provider status | Release-environment evidence that supports the status transition; no approval can replace missing live evidence. |

## Recommendation

The safe next decision is **not deployment**. First, review this proposal and decide whether to authorize a deliberately scoped product promotion PR. If authorized, the promotion should retain every fail-closed and no-execution boundary described above, use the product branch as the source of truth, and leave PR #4 as an independent review item unless separately approved.

## References

1. [Final recovery release evidence](./FINAL_RECOVERY_RELEASE_EVIDENCE.md)
2. [MEX1 multi-exchange tape validation](./MEX1_MULTI_EXCHANGE_TAPE_VALIDATION.md)
3. [MEX2 local workspace validation](./MEX2_LOCAL_WORKSPACE_VALIDATION.md)
4. [OF1 Flow Pulse validation](./OF1_FLOW_PULSE_VALIDATION.md)
5. [Phase 15 premium-design validation](./PHASE15_PREMIUM_DESIGN_VALIDATION.md)
6. [Phase 14 safe strategy-evaluation validation](./PHASE14_SAFE_STRATEGY_EVALUATION_VALIDATION.md)
7. [OF2 order-flow context validation](./OF2_ORDER_FLOW_CONTEXT_VALIDATION.md)
8. [IQ1 interaction and accessibility validation](./IQ1_INTERACTION_ACCESSIBILITY_VALIDATION.md)
9. [PR #4 review-only recovery proposal](https://github.com/zephyriaa/zterminal/pull/4)
