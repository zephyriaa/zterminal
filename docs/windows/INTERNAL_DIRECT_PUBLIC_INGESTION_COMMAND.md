# Internal Direct Public Ingestion Command Boundary

**Status:** Internal development command contract. The proposed executable is compiled only with the existing `live-public` feature and remains absent from the default Rust workspace behavior. It is a finite foreground action, not a continuous data service or a public product feature.

## Purpose

The local engine already has an opt-in bounded public Binance aggregate-trade probe and a deterministic local persistence session. The internal command exposes their narrow composition for a user-invoked development smoke: it opens one direct public TLS WebSocket only after a complete explicit command, reads a fixed maximum number of aggregate-trade adapter events, and may perform one final immutable local flush.

> Starting the executable alone must never open a connection. It must reject missing/invalid arguments before any provider action. A successful finite run is evidence only of the explicit local sample; it must not be described as an ongoing live feed, entitlement, backfill, or production transport.

| Control | Rule |
|---|---|
| Build gate | The executable requires `zt-adapters/live-public`; default workspace builds do not compile its transport call. |
| Provider | Exact Binance public spot aggregate-trade stream only. No Gate, Render, or alternate endpoint fallback. |
| Credentials | No API key, private channel, account, balance, position, order, or broker action is accepted. |
| Request | Requires exact symbol ID, provider symbol, integer scales, stream ID, bar interval, finite event cap, local batch cap, local root, capture time, access time, and an explicit flush flag. |
| Event cap | Non-zero and no greater than the adapter’s `MAXIMUM_PUBLIC_INGESTION_EVENTS`. The WebSocket closes after the cap or an early stream end/error. |
| Persistence | Only completed contiguous `Live` bars can become an immutable local segment. The final flush is explicit and conflict-preserving. |
| Failure | Invalid input, transport failure, adapter gap, malformed frame, storage failure, existing key, or withheld batch never triggers retry, repair, fallback, or another provider. |
| Process lifetime | The process exits after one terminal result. It creates no daemon, listener, scheduler, reconnect loop, or background task. |

## Command outcomes

| Outcome | Meaning |
|---|---|
| `persisted` | The finite sample contained a non-empty healthy completed-bar batch that was written once to the caller-selected local store. |
| `not_requested` | The finite sample ended but the caller did not enable final persistence. |
| `empty` | The sample ended before any complete bar was eligible; active data was not fabricated. |
| `withheld` | A gap or degraded result invalidated the batch. |
| `existing_segment` | The same immutable key already existed and was preserved. |
| `error` | Configuration, direct public transport, or local I/O failure stopped the action. |

## Explicit exclusions and remaining gates

This internal command does not authorize unattended ingestion, automatic reconnect/backoff, historical backfill, rate-limit management, durable cursor recovery, multi-segment retention, cache quota coordination, sleep/resume recovery, entitlement enforcement, a user-facing subscription UI, cloud synchronization, execution, signing, installer release, or updates. Those require separately approved product design, security, ownership, provider-policy, and failure-recovery evidence.

## Windows package validation

The connected Windows reference device compiled the feature-gated executable into the private native build output as `zt-direct-public-ingest.exe`. The package guard then invoked it with **no arguments**. It returned the expected exit code 2 and `missing required argument: --provider` before the transport stage. The raw record declares `provider_connection_attempted: false` and `network_opened: false` at this strict no-request boundary and is retained at `docs/windows/benchmarks/windows-direct-public-ingest-guard.json`.

No live provider sample was run for this milestone. The build and guard evidence verify the opt-in boundary, not provider availability, market freshness, geographic access, entitlement, persistence success, or a production transport service.
