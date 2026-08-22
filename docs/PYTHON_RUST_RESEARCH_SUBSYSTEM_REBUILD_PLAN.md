# Python/Rust Research Subsystem Rebuild Plan

## Goal

Rebuild ZTerminal’s indicator, strategy, backtest, documentation, and research-data subsystem around **Python authoring**, a **Rust deterministic research engine**, a **Python API and worker layer**, the existing **TypeScript terminal**, and a production-grade **SQL database**. The public landing page and the read-only terminal model remain intact. The rebuilt system must preserve the existing non-negotiable data rules: no brokerage execution, no synthetic market data, explicit provenance, and fail-closed behavior when source data or a requested capability is unavailable.

The current implementation is a monolithic Next/Node deployment with a small custom ZS language, an in-process compiler/runtime, and a direct `/api/backtest` endpoint. Its current persistence model already contains useful immutable strategy-version, dataset, provenance, and backtest-run concepts, but it is backed by Prisma/SQLite. The target architecture will retain those research invariants while replacing the authoring and execution stack.

> **Decision:** New indicators and strategies will be authored in Python. ZS will not remain a live authoring, compile, or execution language. It will be retained only as a clearly labelled archival/export format until users’ existing source and run records have been migrated or exported.

## Architecture Decision

| Option | Description | Trade-offs | Operational cost | Setup complexity |
|---|---|---|---|---|
| **A. Python-first single service** | A Python API runs authoring, conversion, sandboxed execution, and backtests, with TypeScript as the UI and PostgreSQL as storage. | Fastest way to remove ZS, but Python remains responsible for latency-sensitive simulation loops and heavy indicator computation. | Lower initial infrastructure footprint. | Moderate. |
| **B. Python authoring + Rust research core** | Python owns APIs, validation, conversion, isolated user-code workers, and orchestration; Rust owns deterministic bar processing, indicator kernels, execution simulation, risk/metrics, and high-volume data transforms. | Requires a formal inter-language contract and separate build pipeline, but directly meets the requested performance architecture. | More services and observability, but scales predictable compute independently. | Higher, phased. |
| **C. Full microservice split on day one** | Separate services for ingestion, Python execution, Rust core, API, queues, and storage before feature migration. | Strong isolation but delays user-visible improvements and creates unnecessary early operations work. | Highest. | High. |

**Chosen baseline: Option B, delivered in phases.** This follows the requested Rust/Python/TypeScript/SQL direction while avoiding a disruptive day-one rewrite of every production component. Option C remains a later scaling path only if benchmarked workloads justify it.

## Target Component Model

| Layer | Technology | Responsibility | Explicit boundary |
|---|---|---|---|
| Terminal UI | TypeScript, Next.js, React | Chart workspace, Python editor, indicator browser, Pine import review, run history, diagnostics, and provenance rendering. | No strategy evaluation, no secret access, no fabricated state. |
| Research API | Python, FastAPI | Authentication integration when enabled, project CRUD, artifact validation, job submission, conversion reports, result retrieval, and policy enforcement. | Does not run arbitrary submitted Python in the web/API process. |
| User-code worker | Isolated Python runtime | Executes approved Python indicators/strategy callbacks under hard CPU, memory, wall-clock, filesystem, network, and package constraints. | No brokerage credentials, no outbound network, no shell, no unrestricted imports. |
| Critical engine | Rust library/service | Deterministic bar replay, indicator kernels, next-bar execution model, costs/fills, drawdown/equity/metrics, data transformations, and stable result serialization. | No user-defined arbitrary code; consumes validated intents/series only. |
| Market ingestion | Existing verified provider adapter first; Rust migration later | Provider discovery, historical acquisition, stream normalization, feed health, sequence-safe L2 where available, and provenance. | All provider data remains labelled; unavailable L2/OI remains unavailable. |
| Persistence | PostgreSQL | Workspaces, immutable source versions, conversion records, datasets, run manifests, job state, output artifacts, and audit trail. | SQLite is migration-only; raw high-volume artefacts use object storage once required. |
| Job orchestration | PostgreSQL-backed job queue first | Durable long-running conversion/backtest requests, retries, cancellation, progress, and result linkage. | API requests never block on a long research run. |

### Authoring and execution contract

Python source will be treated as **research code**, not trusted server code. A strategy module will implement a constrained, documented contract rather than importing arbitrary libraries or controlling an order simulator directly. The initial contract will expose immutable market frames, declared parameters, deterministic indicator helpers, and functions that return series, plotted outputs, and research intents. The Rust engine will apply fills and cost assumptions, so a Python module cannot bypass next-bar evaluation, inject future data, or claim live execution.

The first approved runtime set will be intentionally small and version-pinned: Python standard-library-safe components plus a vetted numerical/dataframe subset selected during implementation. Imports, package versions, time/memory limits, random seeds, and execution environment hashes will be stored with each run. Any unavailable package or capability will produce a structured `UNSUPPORTED` result rather than a partial or silent fallback.

## Pine Script to Python Migration Workflow

ZTerminal will support a **reviewable conversion workflow**, not an unqualified claim of full Pine compatibility. Pine Script is a specialised language with a separate user manual and v6 language reference.[1] [2] The converter must only process source the user owns or has permission to use. It will not retrieve, decompile, infer, or reconstruct protected or invite-only TradingView code. TradingView distinguishes open-source and protected publication models, so provenance and rights acknowledgement are mandatory at import.[3]

| Stage | Behaviour | Acceptance condition |
|---|---|---|
| Source intake | User pastes/uploads source, declares ownership/permission, chooses target type: indicator or strategy. | Source is stored privately with a content hash, rights declaration, and original language/version. |
| Parse and classify | Pine v6 parser builds an intermediate representation and creates a capability report before any conversion. | Every construct is classified as supported, transformed, manual-review, or blocked. |
| Convert | Supported syntax maps to ZTerminal’s Python research API; no text substitution masquerades as translation. | Generated Python is formatted, linted, and linked to the exact source hash and converter version. |
| Review | Side-by-side Pine/Python view explains semantic changes, required user decisions, and unsupported features. | User explicitly accepts the converted version before it can be run. |
| Equivalence test | Both implementations run against a fixed, provider-labelled candle fixture where legal and technically possible. | Signal/output/trade differences are reported with tolerances; a mismatch is not silently accepted. |
| Publish | Converted artefact becomes an immutable Python strategy/indicator version. | Provenance, conversion report, runtime version, data manifest, and test result are durable records. |

### Initial converter support matrix

The first production release will target common, verifiable constructs: `indicator`/`strategy` metadata, `input.*`, OHLCV series, arithmetic/comparison/boolean expressions, standard `ta` indicator calls that have approved counterparts, plots, crossovers, long/short entry and close semantics, and bar-by-bar series references. It will explicitly reject or require manual redesign for unsupported behaviour, including `request.security`/multi-symbol or multi-timeframe calls, repaint-prone or lookahead configuration, custom/standard chart transformations that cannot be reproduced from verified source bars, external library imports, drawings/labels, alerts, brokerage features, protected dependencies, and unsupported intrabar/order-fill semantics.

No translation may advertise that a strategy "works" merely because it compiles. A converted strategy becomes runnable only after the converter, static validation, data-provenance checks, sandbox, and deterministic engine tests complete.

## Documentation and Product Changes

### Replace `/docs/zscript`

The current ZScript page will be replaced at the same public route with a migration landing page during the transition, then redirected to `/docs/python-research` after existing links are migrated. It will contain a plain-language ZS retirement notice, source-export instructions, conversion eligibility/rights rules, a Python research quickstart, the safe runtime contract, reproducibility guarantees, allowed/blocked API list, Pine conversion support matrix, equivalence-test interpretation, and a prompt template for generating **ZTerminal Python Research API** code.

The former ZS grammar reference will be retained as a versioned archival document only. It must not be presented as a recommended authoring surface and must not be linked from the primary strategy workflow after cutover.

### Indicator builder

The current client-side list of a few native overlays will become a complete research surface with three explicit paths: built-in Rust-backed indicators, user-authored Python indicators, and imported Pine-derived indicators. Each indicator version will include inputs, output schema, visual manifest, source/provenance, runtime version, compatibility state, test results, and enable/disable controls. Chart rendering remains TypeScript; it consumes a validated, bounded series payload from the research API rather than evaluating user source in the browser.

### Strategy builder and tester

The strategy workspace will become a project-oriented editor with Python source, parameter schema, dataset selector, execution assumptions, reproducible run manifest, job queue status, diagnostics, metrics, trade ledger, equity/drawdown, visual signal overlays, comparison runs, and full artefact history. It will replace the current direct synchronous backtest API with queued run creation and polling or streamed status. The UI will preserve the current read-only account panel and must never present research outcomes as broker orders or investment instructions.

## SQL Data Model and Migration

The existing entities for `Strategy`, `StrategyVersion`, `Dataset`, `BacktestRun`, research sources, and audit records are valuable foundations. The migration moves SQLite data to PostgreSQL, preserves immutable identifiers where practical, and adds explicit language and runtime records.

| New or revised record | Key fields | Purpose |
|---|---|---|
| `code_artifact` | language, source, source_hash, rights_attestation, parent_artifact_id, status | Immutable Python, imported Pine, and archived ZS source. |
| `conversion_report` | source_artifact_id, converter_version, capability_matrix, diagnostics, semantic_changes, reviewer_acceptance | Makes every Pine-to-Python decision inspectable. |
| `indicator_version` | code_artifact_id, output_schema, visual_manifest, runtime_lock, validation_status | Versioned chart studies with safe rendering metadata. |
| `strategy_version` | code_artifact_id, parameter_schema, execution_policy, runtime_lock, validation_status | Replaces ZS-specific strategy semantics. |
| `dataset_manifest` | provider, native_symbol, timeframe, requested_range, hashes, quality, provenance | Retains exact source and reproducibility metadata. |
| `research_job` | kind, inputs_hash, queue state, progress, worker/runtime version, cancellation metadata | Durable conversion/backtest/indicator work. |
| `research_run` | job_id, strategy_version_id, dataset_manifest_id, engine_version, result_hash, metrics/trades/equity references | Reproducible run identity and artefact linkage. |
| `validation_suite_run` | fixture version, expected/actual outputs, tolerances, status | Records Pine/Python and engine equivalence evidence. |

Migration is additive: export and checksum the SQLite database, establish PostgreSQL schema and backfill, verify row counts/hashes and sample run integrity, then move reads behind a repository boundary. There will be no destructive deletion of ZS source, historical backtests, or datasets until export/reconciliation and an agreed retention checkpoint complete.

## Implementation Phases

### Phase 0 — Architecture baseline and safety contract

Define the Python research API specification, deterministic engine protocol, stable result schemas, allowed import/package policy, resource limits, cancellation semantics, error taxonomy, rights attestation, data-provenance contract, and no-execution policy. Establish a threat model covering arbitrary code, dependency abuse, resource exhaustion, data exfiltration, future-data leakage, and conversion misrepresentation. Produce architecture decision records and golden test fixtures before building product UI.

### Phase 1 — SQL foundation and research-job control plane

Introduce PostgreSQL and a data-access boundary without deleting the existing SQLite records. Add immutable code artefacts, versioning, dataset manifests, job/run states, audit events, and migration tooling. Implement the Python API with health, artifact, dataset, and job endpoints, then attach TypeScript client types generated from the API schema. Run the old backtest path in read-only compatibility mode while validating data migration.

### Phase 2 — Rust deterministic research core

Build the Rust `research-core` with typed OHLCV frames, precise decimal/tick handling, calendar/session policy, indicator kernels, order lifecycle, next-bar fills, commission/slippage/spread models, equity/drawdown, metrics, and deterministic hashing. Expose a versioned contract to Python through a stable native binding or local service protocol. Port the current verified execution semantics into golden fixtures first; retain any differences as explicit versioned policy rather than changing historical results silently.

### Phase 3 — Sandboxed Python indicators and strategies

Implement isolated worker execution, approved Python authoring SDK, schema validation, source linting, deterministic runtime lock files, structured diagnostics, bounded output payloads, and cancellation. Integrate Python callback output with the Rust core so Python expresses research logic while Rust handles simulation. Add unit, property, anti-lookahead, determinism, worker-escape, resource-limit, and result-contract tests.

### Phase 4 — Pine importer and conversion verification

Create the parser/intermediate representation, initial support matrix, conversion generator, review interface, rights acknowledgement, and Pine/Python test harness. Ship only the supported subset with precise blocking diagnostics. Build a curated fixture library with openly licensed/user-owned examples. Do not label the importer generally compatible until each supported category has equivalence coverage.

### Phase 5 — Terminal, indicator, strategy, and documentation replacement

Replace the ZS editor path with Python-first indicator/strategy builders, job-driven test UI, conversion review, runtime/provenance panels, and visual indicator output. Replace `/docs/zscript` with the retirement/migration landing page and publish `/docs/python-research`. Remove ZS references from prompts, empty states, command palette, templates, and normal navigation. Keep archived ZS exports accessible only from a migration/history area.

### Phase 6 — Cutover, reconciliation, and decommissioning

Perform side-by-side shadow runs for representative historical datasets, compare old/new results only where semantics are intentionally preserved, and label expected differences. Migrate user artefacts, freeze new ZS creation, then remove the ZS compiler/runtime and direct `/api/backtest` execution after export, reconciliation, and rollback windows complete. Retain read-only archived run manifests and an auditable conversion history.

## Deployment Topology and Cutover

The current Render deployment is a single Node container that starts a TypeScript market gateway, Next.js application, and Caddy proxy as sibling processes. The target release will not place arbitrary Python execution inside that web container. The staged production topology is: a TypeScript terminal service, a Python API service, a worker service for isolated Python jobs, a Rust research-core service/library, PostgreSQL, and object storage for larger immutable run artefacts. The verified market gateway remains intact during Phases 0–3; its later Rust migration is separately benchmarked so Binance-specific fail-closed feed handling is not weakened.

A smaller single-service development environment remains useful for local tests, but production long-running research jobs must use a durable worker and database-backed queue. If the hosting target cannot provide the required isolated runtime, worker concurrency, PostgreSQL, and storage boundaries, the plan pauses before user-code execution rather than quietly running arbitrary Python in the existing web service.

## Quality Gates

| Gate | Required evidence |
|---|---|
| Determinism | Same source, runtime lock, data manifest, parameters, and execution policy produce the same result hash. |
| Data integrity | Every run includes provider, native symbol, range, timeframe, retrieval time, quality state, and an explicit unavailable/degraded state. |
| Anti-lookahead | Golden fixtures prove next-bar semantics and reject future-bar access from both Python and Rust layers. |
| Runtime safety | Worker escape, network, filesystem, import, CPU, memory, timeout, cancellation, and output-size tests pass. |
| Pine truthfulness | Unsupported constructs fail with diagnostics; supported fixture conversions contain a saved comparison report. |
| Engine parity | Rust core matches approved policy fixtures for fills, costs, series, metrics, and numerical tolerance. |
| Migration | PostgreSQL backfill has checksums/row counts, sampled artefact comparison, rollback procedure, and no destructive deletion before sign-off. |
| Product UX | Desktop and mobile editor, indicator browser, strategy tester, queue status, and documentation work without ZS references in the primary path. |
| Regression | Current terminal, root landing page, provider discovery, feed-health provenance, and fail-closed L2/OI behaviour remain tested. |

## Assumptions and Open Risks

This plan assumes that the requested first release remains **research-only** and does not add broker execution, custody, portfolio advice, or account-based trading. It also assumes users will supply Pine source they own or are permitted to convert. Full Pine parity is intentionally not a release promise because Pine features and TradingView platform behaviour do not map one-to-one to a standalone deterministic Python/Rust environment.

The stack decision requires production services capable of running Python workers, Rust binaries or bindings, PostgreSQL, and durable artefact storage. Existing free single-container hosting is appropriate for the current terminal but is not assumed sufficient for safe isolated user-code execution or sustained high-volume research workloads. Hosting capacity, isolation model, SQL provider, object-storage provider, and authentication design must be confirmed during Phase 0 before user code is enabled.

## References

[1]: https://www.tradingview.com/pine-script-docs/ "Pine Script® User Manual — TradingView"
[2]: https://www.tradingview.com/pine-script-reference/v6/ "Pine Script® Language Reference Manual v6 — TradingView"
[3]: https://www.tradingview.com/support/solutions/43000590599-script-publishing-rules/ "Script publishing rules — TradingView"
