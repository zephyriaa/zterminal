# Local Contiguous-History Monte Carlo Contract

**Status:** Internal Track B local-research extension. A multi-segment local Monte Carlo request may include a bounded chain of immutable local segments for one explicit symbol and interval. It returns a deterministic result only if every selected segment independently passes the existing integrity, provenance, and freshness source gate **and** their decoded bars form one exact contiguous timeline.

> Catalog order alone is not evidence of history continuity. The research loader proves continuity from decoded bar timestamps and the declared interval; it never interpolates, skips, merges, or invents a missing bar.

## Bounds

The request starts from one explicit `SegmentKey` and permits at most **16** adjacent local segments and **100,000** decoded bars in total. The storage catalog is used only to select ordered local keys for the same symbol and interval. It is bounded independently and must not be truncated. A request that would exceed either segment or bar bound is withheld before simulation.

The existing Monte Carlo limits remain in force: source must provide at least two returns, scenarios and horizon must be bounded, their product must remain bounded, and all summary outputs remain integer basis points with the explicit algorithm version and seed.

## Eligibility proof

For every cataloged selected key, the loader performs the existing `load_local_research_source` gate. `Live` and within-budget `Cached` segments may proceed; `Stale`, `Gap`, `Unavailable`, `Corrupt`, malformed, and I/O-failed records withhold the entire history request. The loader then requires that the first bar of every later segment has `open_time_ns` exactly equal to the previous retained bar’s `open_time_ns + interval_ns`.

| Condition | Outcome |
|---|---|
| Catalog is unavailable, truncated, omits the explicit start key, or cannot supply the requested directional chain. | Entire history request is withheld; no result is synthesized. |
| Any selected segment fails its individual local source gate. | Entire history request is withheld with that truthful local availability. |
| Decoded symbol, interval, first timestamp, or cross-segment next timestamp does not match exactly. | Entire history request is withheld as `Gap`. |
| Segment count or cumulative bar count exceeds its hard bound. | Entire history request is withheld as unavailable-to-research, without partial simulation. |
| Every segment and boundary passes. | The deterministic local engine analyzes the assembled verified bar sequence and records the actual segment count. |

## Boundary

This extension performs local filesystem reads only. It has no provider, socket, Render, cloud synchronization, account, broker, order-routing, strategy-execution, credential, scheduler, daemon, public installer, updater, or release-distribution behavior. It remains research-only and does not imply a forecast, recommendation, or order signal.
