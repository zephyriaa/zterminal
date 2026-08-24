# Opt-In Public Ingestion Contract

**Status:** Implemented as a feature-gated, finite local ingestion foundation and fully validated on Linux with deterministic supplied-event tests. The default build opens no provider connection. Windows feature validation is pending because the connected device’s terminal bridge disconnected during the final check; no Windows result is claimed by this document. This contract does not authorize a reconnecting service, background process, cloud proxy, provider fallback, private channel, credential, broker action, or public release.

## Purpose

The direct Binance aggregate-trade probe is currently a credential-free, bounded development utility. The local provider persistence session can now write only completed contiguous `Live` bars into immutable local segments. This contract defines the narrow join between them: a caller may explicitly request one bounded public sample, pass each received adapter result through the persistence session, and choose whether to perform one final explicit local flush.

> The ingestion operation is a finite foreground action. It starts with an explicit user-selected provider subscription and local store root, reads no more than the configured event limit, performs no reconnect or fallback, and exits after one result.

| Requirement | Contract |
|---|---|
| Compile gate | The path exists only under `zt-adapters` feature `live-public`; default Rust and native builds have no network dependency at runtime. |
| Provider | Binance public spot aggregate trades only. Any unsupported provider is rejected; Gate and Render are never substituted. |
| Credentials and accounts | None. The operation does not accept keys, user accounts, private channels, balances, positions, orders, or broker routes. |
| Event limit | Caller supplies a non-zero limit bounded by the implementation. A connection cannot continue after the limit. |
| Storage | `LocalProviderPersistenceSession` receives every normalized result. It retains only completed contiguous `Live` bars. |
| Gap or rejection | The session is withheld and final flush is refused. No synthetic continuity, repair, fallback, or partial healthy segment is emitted. |
| Flush | Persistence occurs only when the caller explicitly enables the final flush and a non-empty healthy batch exists. A completed trailing active bar is not fabricated. |
| Conflict | Existing immutable segment keys are reported and preserved. No overwrite or merge happens. |
| Result | The caller receives counts and an explicit terminal state, never a claim that local cache equals an ongoing live feed. |

## Lifecycle

| Stage | Permitted action | Terminal behaviour |
|---|---|---|
| Configure | Validate exact subscription, interval, event cap, batch bound, capture time, and local store root. | Invalid configuration returns before any network request. |
| Connect | Open one direct TLS WebSocket only when the feature and caller action are both present. | Transport error returns without fallback or background retry. |
| Normalize | Strictly decode selected provider frames into `AdapterEvent`. | Malformed input is withheld. |
| Aggregate | Feed adapter events into the local persistence session. | Sequence/provider gap clears the batch and prevents healthy flush. |
| Stop | End after the requested number of observed adapter events. | No reconnect, timer, or daemon remains. |
| Flush | Optionally persist a healthy complete batch once. | Empty/degraded/conflicting batches are reported; existing local data stays intact. |

## Remaining gates

A sustained local stream remains future work. It requires a user-visible lifecycle controller, explicit reconnect and backoff bounds, provider rate-limit policy, durable cursor/recovery semantics, a verified backfill policy, cache-quota coordination, multiple segment management, machine sleep/resume handling, and full provenance UI. Those gates must be completed before any claim of a production live native chart.
