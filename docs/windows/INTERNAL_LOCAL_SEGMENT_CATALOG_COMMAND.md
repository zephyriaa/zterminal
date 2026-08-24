# Internal Local Segment Catalog Command

**Status:** Internal Track B local-history sidecar contract. `zt-local-segment-catalog` reads the bounded integrity-aware local catalog for one explicitly supplied normalized symbol and interval, then writes one versioned JSON result to standard output.

> The result lists independently verified immutable local records. It does not declare them contiguous, fresh, complete history, or eligible for rendering or research without a subsequent per-segment source gate.

## Required arguments

| Argument | Meaning | Validation |
|---|---|---|
| `--root` | Existing local segment-store root | Missing or incomplete local layouts return a versioned unavailable catalog without creating directories. |
| `--symbol-id` | Normalized local symbol ID | Unsigned 32-bit base-10 integer. |
| `--interval-ns` | Requested local bar interval | Non-zero unsigned base-10 integer. |
| `--maximum-entries` | Returned catalog bound | Integer from `1` through the storage catalog maximum of `256`. |

Arguments are strict flag/value pairs. A missing, duplicate, malformed, unsupported, zero-interval, or out-of-bound argument exits with code `2` before the local root is opened. The command does not infer a root, symbol, interval, or history range.

## Versioned JSON result

The command exits successfully only after writing a schema-version-1 `kind: "catalog"` JSON record. It includes `layout` (`available` or `unavailable`), `truncated`, three omission counts, and an ordered `entries` array. Every entry contains only `start_ns`, `bytes`, `last_access`, and `data_status`; no raw bar payload, content hash, account data, credential, or provider frame is emitted.

| Field | Meaning |
|---|---|
| `truncated` | The requested return, local metadata scan, or local payload-verification bound left potential matching entries unexamined. |
| `malformed_metadata_entries` | Local `.meta` records omitted because their schema or canonical identity could not be accepted. |
| `missing_payload_entries` | Matching metadata records omitted because the matching local payload was absent. |
| `corrupt_payload_entries` | Matching metadata records omitted because payload length/hash verification failed. |

The sidecar keeps storage errors as terminal command errors rather than reporting an inaccessible directory as empty history.

## Boundary

This is an internal one-shot local process copied beside the private Windows host. It has no provider, socket, Render, cloud synchronization, account, broker, order-routing, strategy-execution, credential, scheduler, daemon, public installer, updater, or release-distribution behavior.
