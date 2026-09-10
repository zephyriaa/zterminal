# Microstructure Architecture Contract

**Status:** Phase 0 implemented. This is the authoritative architecture record
for event market data, microstructure research, and options data. Where older
roadmaps or market-data audits conflict with this record, this record governs
this scope. It does not change the native product boundary.

## Current implementation audit

The active local Python research implementation is `research/desktop`. Its
version-1 request embeds complete closed OHLCV candles and calls
`strategy(data, params)`. The helper owns pairing, bounded child processes,
SQLite research archives, and immutable source/result hashes. Phase 0 preserves
that behavior and contract.

`python-engine` has no tracked engine source. Its local virtual environment
contains NautilusTrader 1.231.0, but no tracked application module currently
constructs a Nautilus node, subscribes to a feed, or runs a Nautilus backtest.
Nautilus is therefore a verified compatibility target, not an existing product
integration.

The Socket.IO gateway and TypeScript `BinanceFuturesProvider` already demonstrate
snapshot/delta bootstrapping, reconnection, and health presentation. Their
browser-demand lifetime makes them unsuitable as the durable recorder owner.
Rust `zt-protocol`, `zt-storage`, and `zt-adapters` provide local provenance,
immutable segments, and a finite Binance trade-ingestion proof. Their current
segment contract is bar-oriented and must not be stretched to represent raw
event datasets without a versioned extension.

## Ownership and data flow

The installed Windows product owns ingestion, validation, persistence, replay,
research, and rendering. Render is not a market-data relay or research worker.
The Tauri-hosted preview is not expanded by this program.

```text
exchange -> Nautilus data adapter -> ingress provenance / quality guard
         -> native Nautilus event + ZTerminal sidecar -> recorder/catalog
         -> Nautilus data engine/book -> later feature engines
         -> bounded native/web presentation and local Python research

catalog + recorded ordering -> same native events -> Nautilus replay/backtest
```

There is exactly one ingestion owner for a venue/product/channel. Recording is
independent of chart subscriptions. Phase 0 starts no owner and records no data.

## Native types and ZTerminal sidecars

Nautilus types remain canonical inside the event engine:

| Meaning | Phase-0 decision |
| --- | --- |
| Trade | `TradeTick` |
| Incremental or snapshot book changes | `OrderBookDelta` / atomic `OrderBookDeltas` |
| Fixed top ten | `OrderBookDepth10`, only when that is the provider capability |
| Mark and index prices | `MarkPriceUpdate` / `IndexPriceUpdate` |
| Options risk and OI observation | `OptionGreeks` |
| Bars | `Bar` |

`InstrumentUnits`, `IngressProvenance`, `FeedQualityEpoch`, and
`EventDatasetManifest` are ZTerminal contracts because those facts are not
uniformly retained by native market events. They are sidecars; they do not wrap
every event in a second market-data model.

Wire JSON uses decimal strings for exact price, size, and multiplier fields and
strings for nanosecond timestamps and 64-bit identifiers. Python may use integers
internally. This prevents JavaScript precision loss.

## Time and deterministic availability

Four time meanings remain separate:

1. Exchange event time (`ts_event`).
2. Actual local receive UTC time (`received_at_ns`).
3. Nautilus object initialization time (`ts_init`).
4. Time at which an input or derived result became usable (`available_at_ns`).

`ts_init` is preserved but is not relabelled as socket receive time. Every
accepted ingress record receives a session-stable ordinal. Replay order is:

```text
available_at_ns, ingress_ordinal, stream_id, batch_index
```

Equal timestamps therefore replay in recorded arrival order. Original timestamps
are never rewritten to manufacture monotonicity. Imports lacking receive time use
`exchange_time_only` provenance and cannot support historical latency claims.

## Feed-quality epochs and atomic books

Integrity (`verified`, `gap`, `corrupt`, `incomplete`, `unavailable`) and
freshness (`live`, `historical`, `delayed`, `stale`) are independent. A gap,
checksum failure, malformed update, buffer overflow, or reconnect begins a new
quality epoch. Stateful book calculations may not cross an epoch boundary.

A native snapshot batch begins with `CLEAR`, contains one instrument, and ends
with `F_SNAPSHOT | F_LAST`. The batch is validated and applied atomically before
downstream publication. Arrow serialization flattens `OrderBookDeltas` to rows,
but the final flag must allow deterministic reconstruction with
`OrderBookDeltas.batch`. Fragment commits must not expose half a logical batch.

## Immutable event datasets

Event dataset version 2 references committed Parquet fragments rather than
embedding events in a research request. A manifest pins instruments, schemas,
fragment hashes, availability ranges, compression, timestamp provenance,
ordering, integrity, and explicit gaps. A verified manifest cannot contain a
declared gap. Manifest identity changes whenever any referenced byte or semantic
contract changes.

Parquet uses Zstd. Nautilus native Arrow schemas are reused. Custom sidecars use
registered Arrow schemas containing `ts_init`; Phase 0 proves serialization only.
Phase 1 must add staged writes, atomic manifests, recovery, and catalog ownership.

## Candle and event research modes

`candle` is the existing version-1 path. It keeps embedded complete bars,
next-open behavior, and current archive semantics.

`event` is a separate version-2 request mode. It references an immutable dataset
manifest and declares required data types. Phase 0 defines this contract but does
not route, execute, validate, or expose event strategies. No request is inferred
to be event mode from source text or function signatures.

## NautilusTrader 1.231.0 compatibility evidence

Offline tests against the installed Windows CPython 3.14 wheel verify:

- native `TradeTick` Arrow round trips;
- custom ingress-provenance Arrow round trips;
- atomic book snapshots survive Arrow flattening and reconstruction;
- custom Parquet fragments round trip with Zstd metadata;
- stable equal-availability replay ordering.

The target private helper uses CPython 3.12.10 Windows x64. PyPI exposes the
`nautilus_trader-1.231.0-cp312-cp312-win_amd64.whl`, so the interpreter/platform
combination has a binary distribution. `requirements-event.in` pins it separately
from the active version-1 lock. Phase 1 must build and test a complete event lock
inside the embedded 3.12 runtime before enabling event mode.

## Adapter gaps that block certification

### Binance USDⓈ-M books

Nautilus 1.231.0 buffers deltas during the REST snapshot request and discards
buffered messages whose final sequence is not newer than the snapshot. The
inspected `_handle_book_diff_update` otherwise parses and publishes native
deltas. Phase 0 did not find application-visible proof that the complete futures
continuity rule is enforced before each published update:

- bootstrap must satisfy the selected USDⓈ-M `U/u` snapshot boundary;
- after bootstrap, each `pu` must equal the prior event's `u`;
- a failure must invalidate the book before publication and force a new epoch;
- buffer overflow must fail closed rather than trim silently.

Phase 1/2 must preserve `U`, `u`, and `pu` in `IngressProvenance` before any
normalization step loses them, then run official provider-shaped fixtures through
the exact adapter path. Spot and futures rules are separate.

### Binance futures trade granularity

Nautilus 1.231.0 subscribes to Binance aggregate trades for futures. A
`TradeTick` from that channel is an exchange aggregate, even though the native
class describes a trade match. `trade_granularity=aggregate` is mandatory and
message count may not be presented as execution count. The existing TypeScript
gateway requests `@trade`; its availability and semantics require separate
current endpoint conformance evidence before any migration claim.

### Other open compatibility items

- `ParquetDataCatalog` calls PyArrow without a public compression setting in the
  inspected path; the recorder needs a tested Zstd writer seam without forking
  the catalog model.
- The catalog is documented as not thread-safe; Phase 1 needs one writer owner
  per catalog partition.
- Receipt time must be captured before adapter processing; `ts_init` alone is
  insufficient.
- Custom sidecar registration is process-local and must occur before reads and
  writes in every recorder/replay process.
- Native Arrow reads for trades and book deltas return Rust/PyO3 objects in the
  tested path even when Cython wrapper classes select the schema. Consumers that
  require Cython objects must normalize with the native `from_pyo3` conversion
  before equality checks or `OrderBookDeltas.batch` reconstruction.
- Options instrument/OI/Greek unit normalization is intentionally deferred.

## Phase-0 exclusions

No feed connection, recording service, feature calculation, chart layer, event
strategy execution, broker/execution client, paid provider, scraping, deployment,
or automatic migration is authorized by this contract.

## Phase-1 recorder handoff

Phase 1 implements a supervised local recorder behind an explicit start/stop
control. It must capture native events plus sidecars, own bounded queues, stage
Zstd fragments, commit immutable manifests, recover interrupted writes, expose a
durable cursor, and mark overflow/disk/corruption failures explicitly. Its first
offline acceptance test replays saved Binance futures payloads through the exact
adapter/guard and proves that no fragment is certified across a sequence gap.
Only after that test passes may an opt-in public read-only collection smoke run be
proposed.

## Phase-1 offline recorder implementation

The first recorder implementation is deliberately local and offline.  Its caller
constructs validated `RecordedEvent` values; it does not instantiate an adapter,
open a socket, schedule work, or expose an HTTP route.  Each accepted event is
written and fsynced to a session journal before it enters a bounded in-memory
queue, then its ingress ordinal is atomically checkpointed as the durable cursor.

On flush, homogeneous native events use Nautilus Arrow serialization.  Other
provider-shaped raw payloads use a small ZTerminal envelope schema.  Both paths
write Zstd Parquet to staging and atomically move it into an immutable fragment
location.  `commit` writes a content-addressed manifest only after every fragment
is present.  Recovery never adopts or deletes staging files: it reports orphaned
staging and hash-invalid manifests for an operator to inspect.

Queue overflow, a non-verified quality epoch, journal/checkpoint failures, and
fragment/manifest write failures fail closed.  They cannot produce a verified
manifest.  The recorder also refuses non-increasing ingress ordinals, retaining
the availability ordering contract at the write boundary.

The implementation is an optional event-runtime dependency.  The active
version-1 private helper lock and its candle research routes remain unchanged.
The Phase-1 test suite must run in the separately pinned event environment with
PyArrow and NautilusTrader available; the version-1 embedded runtime skips it.
