# Bounded Direct Public Sample Protocol

**Status:** One-time internal validation protocol. It permits exactly one user-authorized, credential-free, finite Binance public aggregate-trade sample on the connected Windows device. It does not establish a background feed or a production provider integration.

## Fixed safeguards

| Control | Protocol requirement |
|---|---|
| Executable | Run only the already packaged private `zt-direct-public-ingest.exe`; do not use Cargo at execution time. |
| Provider | Binance public spot aggregate-trade stream for `BTCUSDT` only; do not use a proxy, Render, Gate, or another provider if it fails. |
| Credentials and private data | No API key, private stream, account, balance, position, order, or broker action. |
| Duration | Request a finite cap of 20 observed adapter events. The process must exit after its result; no retry or reconnect command is issued. |
| Store | Use a temporary Windows local directory under the private build output. Preserve the produced segment only long enough to inspect it; no cloud copy. |
| Bar and flush | Use a 1 millisecond bar interval and a maximum local batch of 20 bars. Enable one explicit final flush only. |
| Capture time | Supply a current UTC capture timestamp and 60-second freshness budget only for local follow-up inspection. |
| Outcome truthfulness | Record the exact process exit and JSON result. `persisted`, `empty`, `withheld`, `existing_segment`, and `error` are all valid finite outcomes. Do not synthesize bars or retry against another provider. |

The exact live market contents are not copied into repository documentation or source. Only bounded operational metadata such as counts, terminal outcome, segment size, and the truthful local availability status may be retained as evidence.

## Exclusions

This protocol does not authorize scheduled collection, automatic reconnection, backfill, cursor persistence, long-term retention, quota policy changes, execution, cloud synchronization, signing, installer publication, a public release, or an updater.
