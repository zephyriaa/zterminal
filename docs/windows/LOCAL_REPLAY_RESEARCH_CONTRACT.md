# Local Replay and Research Contract

**Status:** Initial native engine foundation is implemented and validated on the connected Windows MSVC machine.

ZTerminal replay and research are **local-device operations**. The native engine consumes only verified local bars, advances deterministically one bar at a time, and computes incremental indicators without a Render request or server-side historical replay job.

| Capability | Current local behavior | Prohibited behavior |
|---|---|---|
| Replay retention | The caller sets a maximum bar count before a session is created. | Unbounded in-memory replay or silent server spillover. |
| Missing history | A timestamp discontinuity yields `ReplayStep::Halted` with `DataStatus::Gap`. | Inserting zero-volume candles or inferred price bars. |
| Degraded provenance | Any non-`Live` bar status halts replay and research. | Treating stale, unavailable, or gap data as completed research input. |
| EMA research | A bounded EMA is incrementally calculated from observed close ticks on the local machine. | Claiming a complete result after the replay has halted. |
| Cloud dependency | None for replay, indicator state, or calculation. | Routing data through Render to complete a local result. |

The core tests cover a contiguous two-bar EMA replay and an interval discontinuity. They run on Linux and on the bound Windows MSVC machine. This is an engine contract, not a user-facing strategy language, backtesting suite, Monte Carlo engine, or broker integration; those remain later native capabilities.
