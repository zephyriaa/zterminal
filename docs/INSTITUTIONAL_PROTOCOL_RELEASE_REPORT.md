# ZTerminal Institutional Protocol — Release Report

**Release commit:** `71f56bd343ba6de18b37913698061118450b76f6`

**Production URL:** <https://zterminal.onrender.com>

**Release status:** **Live and verified** on 2026-08-15.

## Release outcome

The Institutional Protocol workflow is now live in ZTerminal. It turns a cited research source into a bounded research workflow rather than an unconstrained strategy-generation surface. The release does not enable broker connectivity, credential storage, account access, automated trading, or order routing.

| Workflow stage | Delivered behavior | Guardrail |
|---|---|---|
| Research intake | Requires a retained academic source, author, year, reference, source text, and exactly one entry, exit, and sizing rule. | Generic prompts, missing citations, optimization wording, ambiguity, extra filters, regimes, ranges, and alternative conditions are blocked. |
| Data assessment | Resolves stated requirements into native verified, import-required, ambiguous, or unsupported coverage. | Generation remains blocked until the data requirement is resolved. |
| Generation | Creates a minimal, deterministic ZS artifact only for the supported explicit EMA-crossover grammar. | The adapter refuses unsupported natural-language logic instead of inventing unverified rules. |
| Assumption review | Records execution-model and long-only assumptions for each generated artifact. | All listed assumptions must be approved before baseline-code lock. |
| Baseline | Records a protected fingerprint, cost/execution configuration, result hash, confidence interval, sample adequacy, and provenance warnings. | Code and configuration are locked after approval; duplicate baseline fingerprints are reused rather than re-run. |
| Incremental testing | Allows a single staged change only, with direct-parent lineage and marginal result comparison. | Changes are visibly classified as **Tuned · One Variable** and cannot be blended into the baseline. |
| Journal | Reconstructs the source, rule revision, data assessment, generated artifact, baseline, incremental runs, and decision trail. | Manual trade notes remain explicitly separate and session-only. |

## Verification evidence

A fresh SQLite database accepted all three migrations, including `20260814130000_institutional_protocol`. The complete release suite passed: **26 unit tests**, TypeScript typechecking, ESLint, and a Next.js production build. The test suite covers citation completeness, three-rule validation, stage transitions, baseline fingerprints, one-variable validation, sample confidence intervals, data assessment, constrained generation, and the constrained source transformer.

Render built and deployed the release successfully. The deployment log showed an expected transient Caddy `502` during startup while Next.js bound `127.0.0.1:3000`; Next.js then reported ready, Render declared the service live, and the public `/healthz` endpoint remained successful. Live browser inspection verified the Research Lab’s **Institutional Protocol** interface and the Journal’s **Institutional Protocol Ledger** tab. The public service retained the configured security headers and the live market-data status appeared after client hydration.

## Important product boundaries

The current product increment persists the active protocol workspace in the browser through the existing local client store. The release includes additive Prisma entities and a tested migration path for durable server-side protocol records, but it does **not** yet expose authenticated multi-user persistence APIs. A protocol record therefore should not be represented as cross-device, shared, or server-durable until that API layer is released.

Generation is deliberately **not** an LLM claim in this increment. It is a narrow deterministic adapter that supports one transparent explicit grammar: a close/EMA crossover entry, the matching crossunder exit, and exactly one native contract. Other requests produce a precise refusal or required-review message. This preserves traceability and prevents fabricated research translations while the authenticated, source-linked model-integration layer is designed.

| Capability intentionally excluded | Current state |
|---|---|
| Live or automated trade execution | Disabled; no order-routing code was added. |
| Broker credentials or account data | Disabled; no credential persistence was added. |
| External primary-source retrieval | Not automatic; evidence must be supplied and retained by the researcher. |
| Full natural-language strategy translation | Not enabled; unsupported grammar is refused. |
| Cross-device or multi-user protocol history | Not enabled; database schema is ready but no authenticated persistence API is shipped. |
| Baseline optimization | Blocked by code/configuration locking and protected fingerprints. |

## Recommended next release

The next increment should add authenticated server APIs for the migration-backed protocol entities, content-hash evidence attachments, role-gated approval records, and a source-linked generation service that returns structured assumptions and citations. Before expanding the generation grammar, each new transformation should be paired with a versioned translator, compile test, and explicit no-hidden-rule review.
