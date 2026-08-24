# Internal Local Monte Carlo Command

**Status:** Internal Track B research sidecar contract. `zt-local-monte-carlo` is a one-shot local process that reads one explicit integrity-checked ZTerminal local segment, calculates the bounded deterministic Monte Carlo summary already defined by the core engine, and writes one versioned JSON outcome to standard output.

> The command does not open a socket, select a provider, call Render, use cloud synchronization, access an account, evaluate strategy code, execute orders, or persist a research result. It is local analysis only.

## Required arguments

| Argument | Meaning | Validation |
|---|---|---|
| `--root` | Local segment-store root | Must name an existing local layout to become available; a missing layout returns a versioned withheld result. |
| `--symbol-id` | Normalized local symbol ID | Unsigned 32-bit base-10 integer. |
| `--interval-ns` | Segment bar interval | Unsigned non-zero base-10 integer. |
| `--start-ns` | Segment start timestamp | Unsigned base-10 integer. |
| `--now-ns` | Explicit local freshness reference | Unsigned base-10 integer; never inferred from a provider. |
| `--freshness-budget-ns` | Explicit cache freshness budget | Unsigned base-10 integer. |
| `--simulations` | Local scenario count | Passed through the core bounded request, maximum 10,000. |
| `--horizon-bars` | Return draws per scenario | Passed through the core bounded request, maximum 1,000 and 1,000,000 total draws. |
| `--seed` | Reproducibility seed | Non-zero unsigned base-10 integer. |

Arguments are exact flag/value pairs. Missing, duplicate, malformed, or unsupported arguments terminate with exit code `2` before the local segment reader is opened. No fallback root, symbol, interval, segment, or provider is attempted.

## Versioned JSON outcomes

| `kind` | Meaning | Required fields |
|---|---|---|
| `complete` | One bounded scenario summary was calculated from a contiguous `Live` or within-budget `Cached` local segment. | `schema_version`, `availability`, `age_ns`, algorithm version, seed, source counts, simulation/horizon counts, and all integer basis-point summary fields. |
| `withheld` | The local layout, immutable segment, cache freshness, provenance, continuity, or source values did not support a result. | `schema_version`, `availability`, `age_ns`, `retained_bars`, and a stable withholding reason. |

The command never emits raw candle data, raw provider payloads, account information, credentials, or a claimed forecast. Summary values are additive integer basis points under the algorithm version and percentile convention documented in [`LOCAL_MONTE_CARLO_RESEARCH_CONTRACT.md`](LOCAL_MONTE_CARLO_RESEARCH_CONTRACT.md).

## Freshness and source gate

The sidecar opens a `SegmentStore` only after confirming that its `segments` and `metadata` directories already exist. The store provides integrity verification; the core decoder validates the versioned bar payload and exact segment continuity. `Unavailable`, `Corrupt`, `Gap`, and `Stale` sources return `kind: "withheld"`. Only `Live` and in-budget `Cached` sources are passed to the deterministic simulation engine; a continuity fault or degraded bar returned by that engine also withholds the entire analysis.

## Distribution boundary

The command is an internal binary copied beside the private Windows native host. It is not a public download, installer, signed release, updater, scheduled task, daemon, public provider ingestion route, or cloud service.
