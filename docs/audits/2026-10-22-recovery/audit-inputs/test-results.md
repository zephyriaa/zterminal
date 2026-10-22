# Test Results — Independent ZTerminal Reality Audit

**Audit date:** 2026-10-22 (UTC+8 session; production data timestamps 2026-10-20/21)
**Audited commit:** `e5f7f4d1a78cfe1a4b03b3f69ed480870aebdad7` (main, 2026-10-20 09:19 +0400, "Add dashboard-first isolated workspaces with safe autosave (#13)")
**Production:** https://zterminal.dpdns.org (+ /terminal → /workspaces)
**Auditor environment:** Linux x64, no Windows, no Rust toolchain, no local Helper
**Method:** live black-box browser session + direct API probes + independent exchange-API comparison + execution of the Helper's actual Python engine on Linux with independent benchmark strategies.

Result vocabulary: PASS / FAIL / PARTIAL / BLOCKED / NOT TESTED.

## 1. First-session usability (Phase II, live product)

| ID | Task | Result | Evidence |
|---|---|---|---|
| WS-01 | Open the terminal | PASS | `/terminal` redirects to dashboard `/workspaces` (new dashboard-first flow) |
| WS-02 | Create a workspace | PASS | Templates: Chart / Order Flow / Python Research; venue Gate/Binance; market; timeframe 1m–1D. `01–02-*.png` |
| WS-03 | Open BTC/USDT chart | PASS | 600×5m bars from Gate rendered on lightweight-charts canvas |
| WS-04 | Select exchange & timeframe | PARTIAL | UI works; **Binance returns 403 → 503 (geo-block at the server); only Gate is usable today** (`04-binance-provider.png`) |
| WS-05 | Historical candles available | PASS | Verified genuine vs Gate API (see §3) |
| WS-06 | Real-time data connected | **FAIL** | Feed inspector: `Effective=unavailable, Gateway=unknown, Reason="Market gateway connection unavailable"` for BOTH providers at audit time. Displayed honestly, not faked. `03-chart-initial-gateio.png` |
| WS-07 | Add/configure indicators | PASS | VWAP + EMA 20 added; "On chart (2)"; panel with Trend/Volatility/Volume/Order-Flow categories |
| WS-08 | Draw and edit objects | PASS | Trend line drawn; floating toolbar (color/width/lock/duplicate/delete) appeared |
| WS-09–11 | Save / reload / recover | PARTIAL | Reload restores workspace identity and provider, **but restores the broken Binance provider with an empty chart + 403 error and no fallback** (`06-after-reload.png`). Fresh browser context: anonymous local workspace is gone (no export path) |
| WS-12 | Historical replay | PASS | "Replay 481/600", prev/play/next controls, chart truncates at cursor (`07-replay-mode.png`) |
| WS-13–14 | Access research, write strategy | PASS | Monaco editor loads; educational EMA-crossover template; browser autosave of drafts |
| WS-15 | Execute a backtest | **BLOCKED (by design)** | `Run Backtest` disabled until a local Windows Helper is paired (8-digit code). Helper = "Unsigned preview · v1.2.0-preview.1 · 170 MB" (`08-strategy-developer.png`) |
| WS-16–17 | Inspect/export report | BLOCKED | Same Helper dependency; only "Download Python source" is available |
| WS-18 | Auth model | PASS | Google-only OAuth; anonymous = "Local until sign-in"; cloud backup gated on verified Google account (401 observed) |

## 2. Live-feed diagnostics

- `/api/bars?provider=binance...` → **503** `{"reason":"Binance instrument unavailable (403)"}` — the production egress IP is geo-blocked by Binance; the server-side gateway surfaces it as 503.
- Gate.io historical REST: works (verified genuine, §3).
- Gate.io/Binance live streaming: feed inspector reports gateway connection unavailable for both; `socket.io/?EIO=4&transport=polling` probe returned no gateway response. **The production live-data gateway was effectively down at audit time.**
- Credit where due: the UI never fabricates a live feed; it labels `UNAVAILABLE` with a reason, and refuses to draw prices until "provider history must confirm the market".

## 3. Independent market-data verification (Phase III)

Direct comparison: ZTerminal `/api/bars?provider=gateio&BTCUSDT&tf=5m` (120 bars) vs Gate.io v4 `futures/usdt/candlesticks` fetched independently seconds apart.

- **119 / 120 bars matched exactly** (OHLC tolerance ±0.06, volume ±2%).
- The 1 remaining bar = the just-opened unfinished candle between the two snapshots.
- API metadata: `environment: "live"`, `dataStatus: "HISTORICAL"`, `integrity: "provider-ohlcv"`, `includes unfinished candle` disclosed in the UI tooltip.
- Chart's displayed last price (82,496.60) equals the corresponding Gate candle close exactly.
- Conclusion: **historical candles are genuine provider OHLCV, not synthetic, not reconstructed fiction.**
- Not testable here: live trade-level stream, L2 book reconciliation (gateway down); see `logs/bars-comparison.json`.

## 4. Repo quality gates (Phase VIII, this environment)

| Command | Result |
|---|---|
| `npm ci` | Completed (Node 24) |
| `npx tsc --noEmit` | **PASS (exit 0)** |
| `node --import tsx --test tests/*.test.ts` (75+ files) | Executed; DB-dependent auth tests error with "ZTerminal database error" in this sandbox (no PostgreSQL configured) — environmental, not classified as product failures |
| `cargo fmt/clippy/test` | **BLOCKED** — no Rust toolchain in audit environment |
| Helper Python engine tests (`research/desktop`) | **19/19 executable tests pass** on Python 3.12.15 (1 test requires real vectorbt; audit used a metadata stub) |

## 5. Strategy-engine benchmark suite (Phase V) — run against the REAL engine

Independent expectations were hand-computed in `evidence/scripts/audit-benchmarks.py` and compared with engine output (Helper engine v1.4.0, `research/desktop/engine.py`):

| ID | Check | Result |
|---|---|---|
| A1–A6 | Buy & hold: trade count, entry 12.0, qty 83, pnl 288.2175, fees 2.2825, equity reconciliation | **PASS (exact)** |
| B1–B3 | No trades → zero trades, zero cost, flat equity 1000.0 | **PASS** |
| C1–C2 | SMA(2)/SMA(4) crossover: engine fills match independent signal replication (next-open) | **PASS** |
| D1 | Deterministic alternation matches independent loop | **PASS** |
| E1–E2 | Losing strategy reports loss honestly after costs | **PASS** |
| M1a–c | Identical inputs → identical trades & metrics (only `id`/`createdAt`/`resultHash` differ) | **PASS** |
| M2 | Higher fees never improve total return | **PASS** |
| M3a | Trade list reconciles with equity; open position excluded from closed stats | **PASS** |
| F1–F8 | Flat candles, short datasets, boundary-open marking (15.5 exact), invalid config, conflicting signals, short-without-permission rejection, final-bar signal not manufactured into a fill | **PASS** (rejections surface as `ValueError` = correct behavior) |

Anti-lookahead:
- Static guardrail (default ON in the UI contract) rejects `close.shift(-1)` at compile time: "Future data reference: use a nonnegative lag instead of a negative shift".
- With guardrails off, the same peeking strategy **still loses** (−22.85%, winRate 0) because next-open execution structurally prices in the peek — a strong design property, not an accident.
- Engine embeds the honest assumption: "User code can introduce look-ahead bias; the engine shifts signals but cannot validate the logic of arbitrary Python."

Monte Carlo (`analytics.monte_carlo`): trade-return bootstrap; seeded (`np.random.default_rng`), seed-reproducible (verified), simulations bounded 100–5000, inputs validated; UI labels it "resamples observed outcomes to explore sensitivity, rather than promise what the market will do next."

## 6. Coverage summary

Genuinely examined: web product E2E (18 tasks), market-data REST path vs exchange, backtest engine math (independent), guardrails, Monte Carlo, API input validation, auth gating, repo quality gates (TS), docs claims.
Not examinable here: Windows Helper pairing E2E, Rust crates, live trade/L2 streams (gateway down), mobile devices, multi-user cloud isolation with real accounts, competitor products hands-on.
