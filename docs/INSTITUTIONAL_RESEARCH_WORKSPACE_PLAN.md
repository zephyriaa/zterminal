# Canonical Institutional Quantitative Research Workspace Plan

**Status:** Accepted target architecture. This document supersedes stale claims
in older roadmaps and handover notes; it does not claim that planned phases are
already implemented.

## Product objective

ZTerminal is one coherent, chart-first research environment:

```text
hypothesis → code → configure → run → understand → test robustness
→ change one conceptual variable → rerun
```

The chart is permanently dominant. Strategy configuration precedes results;
reports open only when a run yields an artifact or an archived artifact is
explicitly selected.

## Architecture decisions

1. Web and native share versioned domain contracts and serialized artifacts,
   while retaining renderer-specific implementations.
2. The Windows Helper is the canonical execution boundary for the web product.
   Native Track B consumes the same local-engine protocol. The hosted Tauri
   wrapper is compatibility preview work only.
3. Auth.js identity uses Prisma against Supabase-hosted PostgreSQL. Server-side
   ownership authorization remains authoritative; PostgreSQL RLS is defense in
   depth. Missing production credentials fail closed.
4. Gemini is the first AI adapter, but product state depends only on
   `AIProvider`, `AIContextBundle`, and `TextEditSet` contracts. Persistent AI
   keys live only in an OS-backed Helper/native vault.
5. Deribit BTC/ETH options are the v1 GEX source. OI walls and gross gamma are
   factual snapshot calculations; signed GEX/gamma flip require explicit,
   labelled positioning assumptions.

## Versioned public contracts

| Contract | Role |
| --- | --- |
| `WorkspaceDocumentV2` | Identity, layout, chart IDs, active artifact, sync policy, revision, timestamps. |
| `ChartDocumentV3` | Workspace/chart identity, instrument, timeframe, studies, overlays, drawings, pane layout, link group, replay. |
| `DatasetManifestV3` | Immutable source hash, provider/units/types, range, availability time, quality epochs/gaps, fragments, calculation versions. |
| `StrategyRevisionV2` | Immutable source hash, runtime, parent revision, parameters, data requirements, API version. |
| `ExperimentRunV2` | Exact strategy/dataset/configuration/engine/seed, artifacts, metrics, result hash, lineage, one-variable change. |
| `ReplayClock` | `selecting`, `paused`, `playing`, or `complete`; availability cursor, speed, dataset, link group. |
| `AIProvider` / `AIContextBundle` / `TextEditSet` | Provider-neutral model work, bounded/redacted context, reviewable edits against a base hash. |
| `MarketDataProviderV3` | Capability declaration plus historical/live bars, trades, book snapshots/deltas, and option snapshots. |

Runtime functions must declare required data. A dataset that cannot satisfy a
function raises structured `DataUnavailableError`; it may not silently produce
a zero or false signal.

Stable Python namespaces are `zt.market`, `zt.indicators`, `zt.orderflow`,
`zt.options`, `zt.strategy`, and `zt.risk`.

## Data and provenance rules

- Source partitions and user imports are immutable. Content-addressed
  Parquet/Zstd fragments are partitioned by provider/instrument/type/time.
- Trades, periodic book checkpoints plus contiguous deltas, and options
  snapshots preserve exchange time, receive time, availability time, quality
  epochs, gaps, adapter versions, and units.
- Big Trades, delta, CVD, footprints, imbalance, heatmaps, and GEX are derived
  from source manifests. Versioned caches are accelerators, never primary truth.
- Cached reproducible copies may be LRU-evicted under local storage budgets;
  user strategies and runs never are.
- Raw high-frequency feeds do not sync by default. Metadata and explicitly
  approved small artifacts may sync; credentials, Helper tokens, provider keys,
  execution authority, raw logs, and API keys never do.

## UX invariants

- Workspace selection supports local/cloud status, manual/auto sync, rename,
  duplicate, delete, conflict, and offline state.
- Testing follows `NO RUN → CONFIGURED → QUEUED → RUNNING → PARTIAL RESULTS →
  COMPLETE/FAILED/CANCELLED`. Progress is emitted by engines, not timers.
- A run report identifies revision, run number, dataset hash/quality,
  instrument/timeframe/period, engine, and assumptions.
- The default comparison is baseline → one conceptual change → new run.
  Multi-parameter optimization is an advanced robustness tool with warnings.
- Indicators are instances with stable IDs, settings, pane placement, source,
  declared requirements, provenance, and calculation version.
- Replay applies one availability-time cursor to every linked consumer. Future
  values must be absent from both rendering and calculation inputs.

## Delivery phases

0. Audit closure and architecture stabilization.
1. Local-first workspace persistence and conflict-safe cloud sync.
2. Strategy developer and runtime contracts.
3. Tester, results, and research versioning.
4. AI coding and analysis.
5. Chart/indicator foundation.
6. Microstructure recording.
7. Order-flow overlays and Big Trades.
8. Programmable order flow.
9. Deribit options/GEX overlays.
10. Programmable options/GEX.
11. Authoritative replay.
12. Windows Helper/workstation distribution.
13. Performance, reliability, and release QA.

The dependency graph and current status are maintained in
[ROADMAP.md](ROADMAP.md). Every behavior change updates this document, the
capability matrix, and release notes in the same change.
