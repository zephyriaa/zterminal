# ADR-0002: Institutional Protocol Workflow Boundary

**Status:** Accepted for the current implementation increment.

## Context

ZTerminal already provides a terminal shell, a deterministic ZS strategy runtime, a historical Gate.io backtest path, a product-domain persistence foundation, and research/backtest/journal views. The Institutional Protocol requires the product to actively oppose overfitting: cited source evidence must precede a three-rule specification; generated behavior must be minimal and traceable; the first run must be immutable and non-optimized; and all later complexity must enter through one variable at a time.

## Decisions

| Decision | Rationale |
|---|---|
| Protocol research begins with a citation and exactly `entry`, `exit`, and `sizing` rule fields. | Prevents anonymous ideas and hidden complexity from becoming apparent research artifacts. |
| Rule specs, generated artifacts, baselines, variable changes, and decisions are immutable revisions linked by hashes. | Makes the result trail reconstructable and prevents silent edits to prior evidence. |
| A baseline fingerprint includes rule-spec revision, generated artifact, dataset identity, execution/cost configuration, and sizing. | Identical baseline submissions are idempotent; changed inputs are explicitly incremental research rather than a second baseline. |
| A tuned experiment has one parent and exactly one `VariableChange`. | The product can calculate and display marginal contribution rather than only cumulative results. |
| The first product increment uses a deterministic local generation adapter. | The protocol must be useful and testable without sending papers, financial data, or user research to a model provider. An external provider remains an optional server-side adapter. |
| Manus API v2, if approved later, is used through a server-only adapter with strict structured output, idempotency, and an explicit consent/retention policy. | Prevents a free-form AI strategy generator and keeps credentials and source documents out of the browser. |
| Existing unauthenticated client state is treated as a local protocol workspace. | It enables a safe feature increment without falsely claiming durable multi-user ownership. Durable remote APIs remain blocked until authentication and production data storage are implemented. |
| Gate.io historical candles are the only native verified dataset in this increment; anything else is marked import-required or unavailable. | Avoids overstating coverage, order-flow quality, or historical availability. |
| All protocol work remains research-only. | No broker credential, account access, order routing, automatic order, or trading authority is introduced. |

## State Transition Contract

```text
Draft
  -> Needs source
  -> Needs rule clarification
  -> Ready for data review
  -> Ready for generation
  -> Baseline running
  -> Baseline reviewed
  -> Incremental research
  -> Paused | Archived
```

Only server/domain policy transitions are permitted. In this increment the same policy is enforced in a shared deterministic client service, with state/history records retained in local workspace storage; later authenticated repository services must use the same policy.

## Consequences

The project adds protocol models and strict guardrails without replacing the ZS runtime, existing standard non-protocol backtester, or read-only Gate.io integration. Research Lab becomes the workflow entry point. Strategy Builder receives a bounded generation/review path. Backtester receives baseline and incremental classifications. Journal receives a reconstructable local protocol ledger.

The product must not claim real academic-document ingestion, CSV persistence, multi-user authorization, production LLM generation, or institutional data coverage until the corresponding approved storage, identity, licensing, and adapter work exists.
