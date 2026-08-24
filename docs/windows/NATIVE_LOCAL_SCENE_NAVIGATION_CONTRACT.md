# Native Local Scene Navigation Contract

**Status:** Internal Track B chart-navigation contract. It extends the existing one-shot local scene bridge with native keyboard navigation across an explicitly selected immutable local segment. It does not add a data source, network activity, provider fallback, replay feed, account data, or strategy execution.

> Keyboard navigation changes only the selected `first_bar` range of the same explicitly requested local segment. The host never creates a candle to fill a missing range.

## Controls and local request semantics

| Native control | Requested local range | Boundary behavior |
|---|---|---|
| `Page Up` | Move the absolute source offset earlier by half the current bridge window, with a minimum step of one bar. | At offset `0`, do nothing and do not launch the bridge. |
| `Page Down` | Move the absolute source offset later by half the current bridge window, with a minimum step of one bar. | At the final full bounded window, do nothing and do not launch the bridge. |
| `Home` | Request the first bounded window, starting at offset `0`. | If already at the first window, do nothing. |
| `End` | Request the final bounded window that fits the immutable segment. | If already at that window, do nothing. |

The host retains only the original local root, symbol, interval, segment start, visible-bar bound, and freshness budget. A navigation event copies that request and changes only `first_bar`. The `visible_bars` request remains between `1` and `2,000`; no key path can request a larger scene.

## Fail-closed transitions

| Condition | Host behavior |
|---|---|
| No renderable local scene is active | Navigation keys are ignored; fixture diagnostics cannot enter the local bridge path. |
| A requested offset is outside the known segment | The host clamps it to the explicit first or final valid window. |
| The local bridge withholds the refreshed scene | The host clears all candles, marks the chart source withheld, preserves the truthful availability/diagnostic, and does not retain the old scene as current. |
| The bridge reports malformed, unavailable, stale, corrupt, or gap data | The host clears all candles and renders no continuous chart. |
| A refresh returns a valid `Live` or in-budget `Cached` scene | The host replaces—not appends—the in-memory candle window and resets the relative chart view to a valid bounded range. |

## Scope and evidence

The host renders only the selected bounded window, capped at 2,000 candles. Native paging is intentionally a local sidecar reload, not background loading, reconnecting, polling, or cache repair. Diagnostics may expose counts, status, and source offset but must not serialize raw provider data. The existing startup options remain explicit and required: `--local-root`, `--symbol-id`, `--interval-ns`, `--start-ns`, `--first-bar`, `--visible-bars`, and `--freshness-budget-ns`.
