---
name: audit-and-rebuild
description: Investigate and rebuild substantial subsystems in an existing application, connecting root-cause analysis, architecture, implementation, and user-journey verification. Use for reliability overhauls and complex interaction engines; ordinary small fixes do not need this workflow.
---

# Audit and Rebuild

Preserve the product's existing engineering structure while repairing the full requested user journey. Adapt the depth to the subsystem and the user's scope.

## Establish the real system

Map the entry points, ownership boundaries, canonical state, persistence, external services, and deployment target before proposing replacement architecture. Read the repository instructions and installed framework documentation when version-specific APIs matter. Record the working-tree baseline so unrelated user edits stay out of implementation commits.

Trace failures across layers rather than treating the visible symptom as the root cause. Distinguish historical documentation, current local behavior, and current production behavior. Capture a reproducible baseline and evidence that tells those apart.

## Design around invariants

Prefer extending an existing canonical model over introducing a competing state system. Separate persisted domain data, derived geometry or presentation, interaction state, and service adapters. State explicit ownership and lifecycle rules: who can mutate data, what survives reload, what account or document it belongs to, and how it is invalidated.

Make failure states part of the model. Do not represent an unavailable service as an empty successful result. Protect asynchronous transitions against superseded responses and make cleanup idempotent where concurrent events can race.

For authentication or canvas/chart work, read [subsystem-patterns.md](references/subsystem-patterns.md) for concrete patterns learned from the ZTerminal rebuild. These are decision aids, not a requirement to use ZTerminal's libraries or schemas in another product.

## Implement and prove the user journey

Work in reviewable vertical slices that include model, behavior, persistence, and recovery. Preserve existing design conventions. For pointer-heavy features, keep transient preview updates outside persisted state and group one user gesture into one history operation.

Choose checks that observe meaningful behavior: focused unit tests for invariants, integration tests for protocol and storage boundaries, and browser journeys for interaction and lifecycle transitions. Exercise reload, navigation, cancellation, failure/retry, ownership changes, and isolation where relevant. Use visual inspection for rendering changes and report measured performance with its environment and limits.

Do not inflate confidence by counting implementation-mirroring tests or repeating unchanged broad suites. Run the repository's required checks and repeat affected checks after subsequent changes.

## Deliver evidence and release honestly

Record root causes, final architecture, meaningful validation, remaining limitations, and release requirements in a repository report when the rebuild warrants one. Commit only the work belonging to the task, using coherent implementation checkpoints.

Deploy only when the user authorizes it. Verify the production build for the actual runtime; a normal application build is not evidence that a hosting adapter bundle succeeded. Use the project's supported build platform or existing pipeline when the host cannot build correctly. Do not deploy partial output or substitute an unrelated temporary account.

Associate the release with a verified commit and pipeline/deployment result, then smoke-test the live entry points. Keep incomplete external verification explicit: initiating OAuth is not proof of a granted callback, and a healthy anonymous session endpoint is not proof of authenticated persistence.

If an external action fails, inspect the cause and retry after a concrete correction. Stop repeating the same blocked action; report the precise missing access or external change needed while finishing independent authorized work.
