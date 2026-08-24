# Native Local Scene Bridge Supervision Contract

**Status:** Internal Track B native hardening contract. `ZTerminalWindowsHost.exe` invokes `zt-local-scene-bridge.exe` only for an explicit bounded local scene request. The child process has a finite **15-second** local wait budget.

> A local scene sidecar that does not exit before the budget is terminated, reaped briefly, and reported as `LOCAL BRIDGE FAILURE`. The host does not wait indefinitely, retain an unverified replacement scene, retry the sidecar, or contact a provider or cloud service.

## Supervised lifecycle

| Stage | Required behavior |
|---|---|
| Start | The packaged sidecar path, explicit local root, normalized key, bounded visible count, explicit freshness budget, and temporary output file are prepared locally. |
| Wait | The host waits at most 15 seconds for the one-shot sidecar. |
| Timeout | The host terminates the child, waits briefly for process reaping, deletes temporary output, and returns a bridge-failure diagnostic. |
| Exit/error | A non-zero exit or wait failure deletes temporary output and returns a bridge-failure diagnostic. |
| Success | Only schema-versioned local-scene output is parsed; its existing `Live`/within-budget `Cached` gate still determines whether candles can render. |

The timeout does not prove a storage payload is corrupt or unavailable. It describes only a failed local bridge operation, so the native host keeps it distinct from local data availability states.

## Boundary

This supervision change is local process control only. It has no provider, network, Render, cloud synchronization, account, broker, order-routing, strategy-execution, credential, scheduler, daemon, public installer, updater, or release-distribution behavior.
