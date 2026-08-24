# Internal Local Tool Packaging Boundary

**Status:** The Windows native CMake build now places four unsigned internal executables in its private build output: `ZTerminalWindowsHost.exe`, `zt-local-scene-bridge.exe`, `zt-offline-provider-import.exe`, and `zt-direct-public-ingest.exe`. This is an internal engineering package only. It is **not** an installer, public download, signed release, updater, or production distribution channel.

## Local package composition

| Executable | Local responsibility | Network and service boundary |
|---|---|---|
| `ZTerminalWindowsHost.exe` | Win32/Direct3D local chart surface, dirty-frame presentation, bounded local-scene rendering, and truthful withheld status. | It does not contact Render, a provider, cloud sync, or a broker. |
| `zt-local-scene-bridge.exe` | One-shot read-only decoding of a specific integrity-checked local segment into a bounded scene. | It has no listener, daemon, socket, or fallback provider. |
| `zt-offline-provider-import.exe` | Bounded import of a caller-selected local Binance aggregate-trade frame file into one immutable local segment on explicit flush. | It reads no URL, opens no socket, accepts no credential, and performs no cloud or execution action. |
| `zt-direct-public-ingest.exe` | Opt-in finite direct Binance public sample into one local persistence session. | It is feature-gated and exits on a strict explicit request; no-argument startup rejects before any provider action. It has no reconnect, fallback, credential, cloud, or execution path. |

The CMake build uses Cargo only while compiling these internal tools. The resulting sidecar executables run directly beside the native host; Cargo is not an execution dependency for the packaged local workflow.

## Windows execution evidence

The connected Windows reference device built all three sidecar executables, then executed the importer binary directly—without Cargo—to process three explicitly **test-only** local frames. The raw smoke record declares `packaged_importer: true`, `execution_uses_cargo: false`, and `network_opened: false`. It reports one persisted immutable 160-byte segment and a host-rendered two-candle `LOCAL CACHED` local scene with no fixture source, resize failure, device recovery, or present failure.

The raw record is retained at `docs/windows/benchmarks/windows-offline-import-local-scene-smoke.json`. The packaged direct-ingestion sidecar also passed its strict empty-request guard: it returned exit code 2 for missing `--provider` before any connection attempt. That raw record is retained at `docs/windows/benchmarks/windows-direct-public-ingest-guard.json`.

## Explicit exclusions

This package remains deliberately outside every production distribution path. It includes no Authenticode signature, public installer, public download link, release asset, CDN/object-store integration, auto-update feed, update agent, updater UI, public release configuration, Render release resolver activation, telemetry, cloud sync, broker execution, or provider fallback. Those capabilities remain separately blocked pending explicit authorization and their own security, ownership, infrastructure, and recovery evidence.
