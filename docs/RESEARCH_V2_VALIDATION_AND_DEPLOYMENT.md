# Research V2 Validation and Deployment Gate

## Purpose

This checklist validates the Python-first research subsystem before it becomes available to terminal users. It deliberately separates source scaffolding from a production authoring/runtime launch. The existing Node/Next/market-gateway container must not execute user Python merely to make a new button appear functional.

## Local validation

| Area | Command | Required result |
|---|---|---|
| Current terminal | `npm run typecheck && npm run lint && npm test && npm run build` | Existing landing page, terminal, verified catalogue, and fail-closed data protections remain green. |
| Python API policy | `cd research/api && python -m pytest -q` | Python syntax, allowed imports, SDK parameter declarations, ZS retirement, Pine blocking, and durable-queue withholding pass. |
| Rust core | `cd research/core && cargo fmt --check && cargo test` | Next-bar fill fixture, future-bar rejection, and repeatable result-hash tests pass. |
| SQL schema | `docker compose -f research/docker-compose.yml up --build` | PostgreSQL applies `research/db/schema.sql`; API health reports `worker-required`; no user code executes. |
| API contract | `curl http://localhost:8000/health` and contract fixture requests | Validation and Pine conversion use `research.v2.0`; a job without configured durable store returns `UNSUPPORTED`, not a local fallback. |

## Production prerequisites

The current Render web service hosts a Node/Next UI, TypeScript gateway, and Caddy proxy in one container. It is **not** an approved place to execute untrusted Python. Before enabling Research V2 in production, provision a separate Python API service, an isolated Python worker service, PostgreSQL, and durable object storage for longer artefacts. The Rust engine must be versioned alongside the worker or deployed as its own local service behind a private network boundary.

| Requirement | Production evidence |
|---|---|
| PostgreSQL | Managed PostgreSQL DSN is supplied as `RESEARCH_DATABASE_URL`; schema migration and backfill checksums complete. |
| Python API | API service is built from `research/api/Dockerfile`, exposes `/health`, and is set as the terminal’s `RESEARCH_API_URL`. |
| Worker isolation | A distinct worker image enforces no network, read-only filesystem, no child processes, CPU/memory/wall limits, and has no browser, account, or broker secrets. |
| Rust engine | `research-core` version is pinned, tested, and recorded in each completed run. |
| Queue | SQL-backed job claim/cancel protocol is exercised with concurrent workers and restart recovery. |
| Artefacts | Run manifests and larger trade/equity artefacts have durable retention and access control. |
| Observability | Structured job logs, worker policy violations, timeout counters, queue depth, and data-quality status are visible. |
| Migration | SQLite export/checksum and PostgreSQL reconciliation are signed off; old ZS source is exportable and archived. |

## Explicit release gate

The Python-first UI, ZS retirement pages, API proxy, Python API, Rust core, SQL schema, and conversion workflow may be merged as an **architecture and preview release**. However, public Python validation or backtest execution remains disabled until every production prerequisite above has evidence. In that state, the terminal must show `UNAVAILABLE`/`UNSUPPORTED` rather than run code in the web container or invent a successful run.
