# Internal Local Workspace Command

**Status:** Internal Track B workstation-persistence contract. `zt-local-workspace` is a one-shot local command over the existing durable `WorkspaceJournal`. It supports an explicit local save, local read summary, and local compaction operation. It does not create an account, authorize cloud sync, transmit workspace content, or start background synchronization.

> Workspace payloads remain opaque bytes owned by the native workstation schema. The command never prints payload bytes, assumes a strategy or account schema, or changes a local-only snapshot into a queued or synchronized cloud state.

## Strict operations

| Operation | Required flags | Local effect |
|---|---|---|
| `save` | `--root`, `--workspace-id`, `--revision`, `--saved-at-ns`, `--payload-file`, `--journal-budget-bytes` | Reads one explicit bounded local payload file, appends a `LocalOnly` snapshot, flushes the journal, and emits aggregate metadata only. |
| `read` | `--root`, `--workspace-id`, `--journal-budget-bytes` | Replays local journal rows, returns the latest snapshot summary for the requested ID, and never emits its payload. |
| `compact` | `--root`, `--journal-budget-bytes` | Retains the latest local snapshot per workspace through the existing local compaction implementation. |

Each operation uses strict flag/value pairs. Missing, duplicate, malformed, unsupported, zero, or out-of-range values exit with code `2` before an operation begins. The payload is accepted only from a supplied existing regular file, is bounded to **64 KiB**, and is never read from standard input, command-line text, a network location, or a provider response. The journal budget is explicit and constrained to **64 KiB through 4 MiB**.

The command requires a positive workspace ID and revision. It writes only `WorkspaceSyncState::LocalOnly`; the `Queued`, `Synced`, and `Conflict` states are not command inputs.

## Versioned output

A successful command writes exactly one schema-version-1 JSON summary with `kind: "workspace"`, the requested `operation`, `network_opened: false`, and aggregate local metadata. `save` reports `workspace_id`, `revision`, and payload byte count. `read` reports `found`, then only the stored revision, save time, sync state, and payload byte count if found. `compact` reports only local success. No payload text, account data, credential, provider data, raw journal row, or cloud token appears in output.

A missing journal on `read` is represented truthfully as `found: false`. Malformed or inaccessible journal records remain terminal command errors rather than being represented as an empty workstation.

## Boundary

The command is an internal packaged local process. It has no provider, socket, Render, cloud synchronization, user authentication, account, broker, order-routing, strategy execution, credential, scheduler, daemon, public installer, updater, or release-distribution behavior.
