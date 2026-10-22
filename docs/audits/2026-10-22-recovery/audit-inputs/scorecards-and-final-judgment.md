# Scorecards, Corrective Actions & Final Judgment — Independent ZTerminal Reality Audit

## 1. Current Product Reality — 58/100

| Category | Weight | Score | Rationale |
|---|---:|---:|---|
| Honesty and accuracy of current public claims | 20 | 17 | Claims are unusually candid (README even annotates its own screenshots with limitations). Only SECURITY.md is materially stale; landing-page emphasis slightly oversells the reachable loop for non-Windows users. |
| Usable end-to-end functionality | 20 | 10 | Chart/replay/indicators/drawings/strategy-editing work; the loop is broken at live data (gateway down) and at backtest (Windows-only Helper). Anonymous workspace fragility. |
| Backtesting and quantitative correctness | 20 | 17 | Engine verified correct to the cent on 27 independent checks; execution models explicit; guardrails default-on; Monte Carlo seeded. Points withheld because users cannot reach the engine from the web, and vectorbt is a metadata badge rather than an active dependency. |
| Market-data and order-flow integrity | 15 | 7 | Historical REST data proven genuine and honestly labeled; live streaming entirely unavailable during the audit (persistent across ≥3 days), Binance geo-blocked, order-flow runtime unexercisable. |
| Stability, persistence, and security | 15 | 8 | Typecheck clean; input validation and auth gating real; hash-covered records. Withheld: broken-provider persistence defect, local-workspace loss, unsigned Helper, stale security doc. |
| Charting, UX, and workflow quality | 10 | 7 | Clean, dense, professional-looking; feed-health panel is exemplary. Replay controls minimal; recovery flows rough. |
| **Total** | **100** | **58** | Provisional where runtime was blocked (Rust, cloud multi-user, Windows Helper E2E); no category was failed on missing evidence alone. |

**Critical failure gates check (§12.3):** none triggered. No fabricated data, no incorrect P&L, no look-ahead bias in the engine, no cross-user access observed, no silent corruption found. The live-feed outage is honest, not deceptive — it fails the user experience, not the trust gate.

## 2. Engineering Potential — 78/100

Disclosed weighting: architecture quality 25, technical foundations 25, integration ability 20, differentiation 15, maintainability 10, roadmap feasibility 5.

| Dimension | Score | Rationale |
|---|---:|---|
| Architecture quality | 19/25 | Right abstractions (dataset identity, evidence hashes, versioned execution models); fragmentation across five persistence stories and four Windows shells is real but acknowledged in the roadmap |
| Technical foundations | 22/25 | Verified-correct quant engine, typed TS codebase with 75+ test files, Rust crates, pinned runtimes, checksummed builds |
| Ability to integrate existing components | 14/20 | The Helper bridge and dashboard-first flow show integration progress; the live-gateway ops layer is the weak link |
| Differentiation potential | 13/15 | Provenance-first research loop + verified honesty is genuinely rare |
| Long-term maintainability | 6/10 | Solo-dev artifacts in the public tree; stale docs; multiple concurrent bets raise maintenance load |
| Roadmap feasibility | 4/5 | Phase ordering (unify Windows → charting → market structure → research → execution) is realistic |
| **Total** | **78/100** | |

## 3. Ten highest-priority corrective actions

1. **Restore the live market-data gateway in production and add uptime monitoring.** The single most damaging defect: the core "live" experience fails silently for days. Acceptance: feed inspector shows `Effective=live` on both providers for 7 consecutive days; alert fires on gateway heartbeat loss.
2. **Handle provider geo-blocks at the infrastructure level** (proxy egress or provider auto-selection). Acceptance: Binance candles load or the UI pre-filters unavailable venues with a clear reason, never a stranded empty chart.
3. **Fix broken-provider workspace recovery**: on load, if the persisted provider fails validation, fall back to the last healthy provider or show a one-click recovery affordance. Acceptance: reload after a Binance failure restores a rendered chart (repro: `06-after-reload.png`).
4. **Give local workspaces an export/import path** (JSON or file bundle) and a storage-clearly-warned state. Acceptance: a user can back up and restore a workspace without signing in.
5. **Sign the Helper binary** (even self-signed with published SHA256 + instructions today) and shrink the 170 MB payload. Acceptance: installer verifies publisher/hash before first run; documented in LOCAL_RESEARCH.md.
6. **Rewrite SECURITY.md to match the live system** (live provider data, Google-only auth, Helper trust boundary, current socket/WS topology). Acceptance: a security reviewer can map every claim to current code.
7. **Expose a no-Helper quantitative smoke path** — e.g., run the verified engine server-side in read-only demo mode on a fixed fixture dataset, clearly labeled — so non-Windows users can experience the research loop's output. Acceptance: a first-time visitor can view one real backtest report in ≤3 minutes without Windows.
8. **Consolidate persistence** behind one documented contract (browser store ↔ Prisma ↔ research archive) with a stated migration story. Acceptance: architecture doc names exactly one source of truth per artifact class.
9. **Add end-to-end tests for the two recovery paths found broken** (provider switch under 403/503; reload with unavailable feed). Acceptance: CI reproduces both `evidence/screenshots/04` and `06` scenarios green.
10. **Clean the public repo root** (move `worklog.md`, `verify-*.png`, `README_GITHUB_ORIGINAL.md`, landing reference HTML out of the tree) and reconcile README vs SECURITY vs docs/legacy. Acceptance: fresh-clone root contains only product-relevant artifacts.

Each item above targets making existing, verified functionality reachable and dependable before adding new surface area — consistent with the project's own roadmap philosophy.

## 4. Final professional judgment (spec §13.L)

1. **Is the current marketing generally fair?** Yes — with one emphasis caveat (the "Charts, Python strategies, backtesting" hero implies a loop most visitors cannot complete; the disclaimer and Helper section do disclose it).
2. **Is the README technically honest about maturity?** Exceptionally so — it annotates its own screenshots with what was *not* working when captured.
3. **Does the deployed product deliver the principal capabilities currently claimed?** Charting/replay: yes. Live data: no (gateway down). Backtesting: not from the browser (Windows Helper required).
4. **Is its market data trustworthy?** Historical: verified genuine. Live: unavailable at audit; honesty plumbing is trustworthy, the pipe is not yet.
5. **Is its strategy tester mathematically credible?** Yes — independently verified correct; assumptions explicit; reproducibility real.
6. **Does it possess serious, reusable engineering foundations?** Yes — the engine, contracts, validation, and test culture are reusable as-is.
7. **Is its Windows architecture moving toward one usable product?** Directionally yes (Phase 01 consolidation); today it is still four coexisting bets.
8. **Would I personally use ZTerminal for research today?** For historical chart study with verified data — yes, with interest. For the full loop — no; I would need the Helper and a live feed first.
9. **Would I recommend it to a professional trader today?** Not as a primary tool. I would recommend it to a quant developer who wants to inspect a genuinely well-built research engine and influence an early product.
10. **Most likely architectural failure if unchanged?** Divergent state across the five persistence layers (browser, SQLite, Postgres, Rust storage, research archive) producing "which result is real?" ambiguity — the exact failure the evidence-hash design was built to prevent, undermined by integration debt.
11. **Most defensible potential competitive advantage?** Provenance-first research: hash-covered, assumption-embedded, reproducible strategy runs paired with verified provider data and honest feed states.
12. **Single most convincing milestone?** A stranger completing launch → live chart → write strategy → run backtest → open a reproducible report, unaided, on the advertised platforms — with the live feed green for 30 consecutive days.

*Scores are provisional where runtime access was blocked (Windows Helper E2E, Rust suites, multi-user cloud). Every number above traces to evidence in `test-results.md`, `quantitative-validation.md`, `security-review.md`, and `evidence/`.*
