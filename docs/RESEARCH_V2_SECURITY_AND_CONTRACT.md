# Research V2: Security, Determinism, and Service Contract

## Status

This document is the implementation contract for the Python-first research subsystem. It supersedes ZS for all new indicators, strategies, and backtests. It does not grant brokerage execution, account access, network access to research code, or permission to synthesize missing market data.

> **Core rule:** User-authored Python is untrusted research code. It may produce validated research intents and bounded series outputs, but it may not control fills, access future bars, access a network, write arbitrary files, execute a shell, load arbitrary packages, or submit orders.

## Service Responsibilities

| Service | Owns | Must not do |
|---|---|---|
| TypeScript terminal | Editing, review, input collection, job status, chart rendering, and provenance display. | Evaluate user Python, create market values, or treat a research signal as a trade order. |
| Python API | Artifact validation, rights acknowledgement, job creation, status/result retrieval, schema checks, and policy enforcement. | Evaluate user code in an API request or expose secrets to an artifact. |
| Python worker | Runs a version-pinned strategy or indicator callback in an isolated subprocess. | Access outbound network, parent secrets, host filesystem, shell, broker APIs, or uncontrolled imports. |
| Rust research core | Historical replay, approved indicator kernels, execution/cost policy, metrics, hashes, and result validation. | Execute arbitrary user code or infer unavailable source data. |
| Provider adapter | Supplies observed, explicitly labelled market data and health/provenance facts. | Invent a bar, book level, open interest value, or provider capability. |
| SQL database | Persists immutable artifacts, manifests, jobs, runs, validation results, and audit facts. | Store secrets in source or silently overwrite immutable run inputs. |

## Versioned API Contract

All V2 requests and responses use a `schema_version` string. The first implementation is `research.v2.0`. New fields may be added only when readers can safely ignore them; any semantic change requires a new major schema version.

### Artifact validation

`POST /v1/artifacts/validate`

```json
{
  "schema_version": "research.v2.0",
  "kind": "indicator",
  "language": "python",
  "source": "from zterminal_research import indicator\n...",
  "runtime_lock": "python-3.12/research-sdk-0.1.0",
  "rights_attestation": "I own or am authorized to use this source.",
  "origin": {"kind": "native_python"}
}
```

The response contains `status` (`VALID`, `INVALID`, or `UNSUPPORTED`), structured diagnostics, the source hash, declared parameters, declared output schema, an import manifest, and a deterministic environment hash. No validation response may claim that a strategy is profitable, safe to trade, or equivalent to Pine source.

### Run creation

`POST /v1/jobs`

```json
{
  "schema_version": "research.v2.0",
  "kind": "strategy_backtest",
  "artifact_id": "artifact_...",
  "dataset_manifest": {
    "provider": "binance",
    "native_symbol": "BTCUSDT",
    "timeframe": "5m",
    "from_ms": 0,
    "to_ms": 0,
    "quality_status": "HISTORICAL"
  },
  "parameters": {"fast_length": 8, "slow_length": 21},
  "execution_policy": {
    "fill_model": "next_bar_open",
    "commission_per_contract": 2.5,
    "slippage_ticks": 1,
    "spread_ticks": 1,
    "position_size": 1
  }
}
```

The API returns `202 Accepted` and a durable job identifier. The job result includes the immutable artifact/source hash, runtime lock, engine version, input manifest hash, status, structured diagnostics, and data provenance. A job is never executed inline in the HTTP process.

### Engine protocol

The Python worker sends only a validated research program result to the Rust core. The core accepts a typed frame and a sequence of permitted intents:

```json
{
  "schema_version": "research.v2.0",
  "engine_version": "research-core-0.1.0",
  "bars": [{"t": 0, "o": 0, "h": 0, "l": 0, "c": 0, "v": 0}],
  "intents": [{"bar_index": 4, "action": "ENTER_LONG", "quantity": 1, "reason": "ema_cross"}],
  "execution_policy": {"fill_model": "next_bar_open"}
}
```

The engine rejects an intent that references a future bar, contains an unsupported action, has an invalid quantity, lacks required data, or violates its versioned execution policy.

## Python Research SDK Contract

New Python code uses the `zterminal_research` package. Its public API begins with:

```python
from zterminal_research import indicator, strategy, inputs, ta, Series, Context

@indicator(name="EMA", overlay=True)
def ema_overlay(ctx: Context, length: int = inputs.int(20, min=1, max=500)):
    return {"ema": ta.ema(ctx.close, length)}

@strategy(name="EMA cross")
def ema_cross(ctx: Context, fast: int = inputs.int(8), slow: int = inputs.int(21)):
    fast_ema = ta.ema(ctx.close, fast)
    slow_ema = ta.ema(ctx.close, slow)
    if ta.crossover(fast_ema, slow_ema):
        ctx.enter_long(quantity=1, reason="ema_cross")
    if ta.crossunder(fast_ema, slow_ema):
        ctx.close(reason="ema_cross_down")
```

`Context` provides only approved historic values through the current bar, declared parameters, and intent methods. It does not expose `requests`, `subprocess`, `socket`, environment variables, raw filesystem paths, brokerage clients, or future series values.

## Runtime Policy

| Control | First-release policy | Required result on violation |
|---|---|---|
| Python version | Pinned Python 3.12 image | `UNSUPPORTED_RUNTIME` |
| Dependencies | Approved, hash-pinned SDK plus vetted numerical helpers | `UNSUPPORTED_IMPORT` |
| Network | Disabled in worker namespace | `RUNTIME_POLICY_VIOLATION` |
| Filesystem | Read-only runtime plus per-job empty temporary directory | `RUNTIME_POLICY_VIOLATION` |
| Process creation | No shell or child process capability | `RUNTIME_POLICY_VIOLATION` |
| CPU/wall time | Configured per artifact/run budget | `RESOURCE_LIMIT` |
| Memory | Configured hard process limit | `RESOURCE_LIMIT` |
| Randomness | No ambient randomness; approved seeded API only and seed recorded | `NONDETERMINISTIC_API` |
| Output | Typed, bounded output/intent payload | `OUTPUT_CONTRACT_VIOLATION` |
| Cancellation | Cooperative status plus forced worker termination after grace period | `CANCELLED` |

## Determinism and Data Truthfulness

Every completed run must persist the following fields: artifact hash, parent/conversion hash if applicable, Python runtime lock, worker image hash, Rust engine version, input dataset manifest hash, provider, native symbol, requested range, returned bar count, timezone/session policy, parameter set, execution policy, and final result hash.

The worker may only consume the bars in the declared manifest. The Rust engine enforces next-bar execution and performs fills/costs; no callback can fill against the same bar that emitted an intent. If historical bars, contract metadata, L2 depth, or OI are unavailable, the run or feature returns an explicit unavailable/degraded result. It must not substitute another provider or infer a missing value.

## Pine Import Policy

Pine source can be imported only after the user affirms ownership or authorization. The importer accepts only pasted/uploaded user-provided source; it never retrieves, decompiles, or reconstructs protected or invite-only scripts. A conversion report records source hash, source version, supported/transformed/blocked constructs, converter version, generated Python hash, manual changes, and acceptance state. A conversion is never labelled complete solely because it parses or compiles.

## Quality Fixtures

The first fixture suite includes: fixed OHLCV data, known indicator outputs, same-bar/future-bar rejection tests, next-bar fill tests, long/short reversal tests, commission/slippage/spread tests, missing-data failure tests, conversion support/blocked examples, deterministic repeat tests, and sandbox policy violations. Fixtures are versioned and their content hashes are stored with validation results.
