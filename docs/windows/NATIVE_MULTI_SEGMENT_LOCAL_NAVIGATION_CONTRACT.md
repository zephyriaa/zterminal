# Native Multi-Segment Local Navigation Contract

**Status:** Internal Track B native-history navigation contract. The Win32 host may use the packaged `zt-local-segment-catalog.exe` sidecar only when intra-segment Page Up or Page Down has reached an immutable segment boundary. The catalog chooses another explicit locally verified record; the normal local-scene bridge still decides whether that record is renderable.

> Moving between catalog entries means only that the host selected another individually integrity-checked local record for the same requested symbol and interval. It does **not** assert contiguous history, fill a missing time range, merge candles, promote cached data to live, or derive data from a provider.

## Keyboard boundary behavior

| Key state | Native behavior |
|---|---|
| Page Up while `first_bar > 0` | Reloads an earlier bounded window of the current immutable segment. |
| Page Up while `first_bar == 0` | Selects the greatest cataloged `start_ns` less than the current explicit segment start and loads that segment’s first bounded window. |
| Page Down before the current segment’s last requested window | Reloads a later bounded window of the current immutable segment. |
| Page Down at the current segment’s last requested window | Selects the least cataloged `start_ns` greater than the current explicit segment start and loads that segment’s first bounded window. |
| Home / End | Remain bounded within the current immutable segment; they do not perform history discovery. |

The catalog is requested once per boundary action with its hard maximum of 256 entries. If the catalog is truncated, lacks the current key, lacks a directional neighbor, fails schema validation, is unavailable, or reports a local I/O/bridge failure, the host leaves the displayed local chart unchanged. It never guesses a segment beyond the catalog result and never retries against a provider.

## Source gates and research state

After a neighbor is selected, the host invokes the existing local-scene bridge with the same root, symbol, interval, visible-candle cap, and freshness budget, changing only `start_ns` and resetting `first_bar` to zero. `Live` and within-budget `Cached` results may replace the visible chart. `Stale`, `Gap`, `Unavailable`, `Corrupt`, and bridge-failure results clear/withhold that requested chart path rather than retaining candles as a new segment.

Cross-segment selection clears any earlier Monte Carlo summary. The earlier summary was tied to a different immutable segment, so it is not carried forward or recomputed automatically. A later explicit local research request is required for the newly selected segment.

## Boundary

The catalog bridge and scene bridge are local packaged child processes with bounded temporary output. This navigation path makes no network, Render, cloud synchronization, provider fallback, account, broker, order-routing, strategy-execution, credential, scheduler, daemon, public installer, updater, or release-distribution request.
