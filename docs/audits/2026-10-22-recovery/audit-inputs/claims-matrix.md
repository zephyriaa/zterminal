# Claim-vers-Reality Matrix — Independent ZTerminal Reality Audit

Sources: landing page (captured verbatim 2026-10-22), README @ `e5f7f4d1`, live product behavior, repository code, independent API verification. Classifications follow the audit spec's six categories.

| # | Public claim (exact/faithful) | Where | Classification | Implementation evidence | Runtime evidence | Verdict |
|---|---|---|---|---|---|---|
| 1 | "A market research environment … Charts, Python strategies, backtesting and analysis." | Landing hero | Available with limitations | Charting live; backtesting requires local Windows Helper | Chart E2E PASS; backtest BLOCKED by design from web | Mostly fair; backtesting unreachable for web-only users |
| 2 | "Web terminal available" | Landing badge, README | Currently advertised as available | Next.js app deployed | E2E session PASS | Verified |
| 3 | "Python runs on your machine … Python research runs through the paired local Helper on your machine." | Landing, README | Available with limitations (private preview) | `research/desktop/*` engine + pairing client; protocol handshake, memory-only token | Pairing UI present; engine executed independently by auditor (Linux) and is genuine | Honest; Windows-only today |
| 4 | "Completed-bar signals use a next-open research model; the result carries its assumptions with it." | Landing | Currently advertised | `shift(executionDelayBars)` + `assumptions` block in every result | Independently verified exact | **Verified** |
| 5 | "Declare the historical range, fees, slippage and sizing before the run." | Landing | Currently advertised | Backtest settings UI; config validated server-side in engine | Verified in UI + engine | Verified |
| 6 | "Monte Carlo resamples observed outcomes to explore sensitivity, rather than promise what the market will do next." | Landing | Currently advertised | `analytics.monte_carlo` bootstrap, seeded, bounded | Reproducibility verified | Verified, honestly framed |
| 7 | "Preserve the source, data and configuration with the run … traceable runs." | Landing | Currently advertised | sourceHash/inputHash/datasetHash/evidenceHash (RFC 8785) | Identical-run evidenceHash equality verified | Verified |
| 8 | "Provider, contract and feed state remain visible." | Landing | Currently advertised | Feed inspector panel | Shows UNAVAILABLE + reason truthfully | Verified (and exercised by reality) |
| 9 | "Market data streams can be delayed or incomplete." (disclaimer) | Landing footer | — | — | Live feed was fully unavailable at audit time; disclaimers proved **understated, not overstated** | Fair |
| 10 | "Public Binance and Gate market-data paths … visible data-health states. Coverage varies by source." | README | Available with limitations | `src/lib/market/{binance,gateio}.ts`, gateway policy, provenance | Gate historical genuine (119/120 exact); Binance 403 geo-block; live gateway down | PARTIAL — "coverage varies" is doing heavy lifting |
| 11 | "Sequence-aware order-book handling, observed-trade calculations, large-trade overlays, CVD, footprint foundations" | README | Available with limitations / partially unexercisable | order-flow modules + extensive tests in `tests/` | Live streams down at audit → runtime unverified; repo tests exist | Code present, runtime UNVERIFIED today |
| 12 | "Development environments may show explicitly labelled simulation data; simulation is never presented as a verified live feed." | README | Currently advertised | `mock-provider.ts`, `rng.ts`, DataStatus labels | Production served only real (or unavailable) data during audit; no mock leakage observed | Verified |
| 13 | "Windows: Engineering previews and local-first foundations only. No official publicly signed Windows installer." | README boundaries | Planned/aspirational correctly labeled | Win32/D3D prototype, Tauri, crates, Helper build script | Not runnable here (no Windows) — honestly labeled | Fair |
| 14 | "Not currently available … paper-order execution, and real-money automated trading." | README | Correctly scoped | `/api/backtest` returns 410 ZS_BACKTEST_RETIRED; no order routing | Probe confirms retirement | Verified |
| 15 | README screenshot caption: "the streaming feed is disconnected. Windows remains in development." | README | — | — | Matches audit's own experience exactly | **Unusually honest** |
| 16 | SECURITY.md: "Every market-data surface in this environment is SIMULATED and must be labeled as such" | docs | **Contradictory/outdated** | Production serves `environment:"live"` Gate data | Live data observed | Doc drift — SECURITY.md describes an older dev posture; needs rewrite |
| 17 | Landing "ZTERMINAL BETA … LOCAL ENGINE PYTHON 3.11+" | Landing | Available with limitations | Helper pins 3.12.10; web SDK works | Engine ran on 3.12.15 | Fair (minor version ambiguity) |
| 18 | Roadmap phases 01–06 labeled "Next priority/Planned/Future" | README | Planned | Roadmap table explicitly says "intended order of work, not announced delivery" | — | Fair; no false shipping claims found |

## Documentation-consistency findings

- Legacy ZS backtester: retired explicitly (410 `ZS_BACKTEST_RETIRED` with an anti-fallback comment). README/docs no longer advertise it. Consistent.
- Multiple Windows shells (Win32/D3D prototype, Tauri shell, desktop-phase0-cli, windows-host) coexist; roadmap Phase 01 openly declares consolidation intent. Honest, but real fragmentation.
- SECURITY.md is the one materially stale document (claims of SIMULATED-only data, Rithmic-centric guidance, `cors origin "*"` guidance) versus a production system now serving live provider data.
- README_GITHUB_ORIGINAL.md and README.md coexist; the repo root also contains `verify-*.png` screenshots and `worklog.md` — developer artifacts shipped in the public tree (cosmetic).

## Landing page vs reality gap

The landing page's strongest impression — "Charts, Python strategies, backtesting" as one loop — is **achievable today only with a Windows machine running an unsigned 170 MB preview Helper, on Gate.io data, without a live stream**. The README's own capture-note admits this ("the local Helper was unavailable…"). The landing page does disclose the Helper requirement in the environment section, so this is a presentation emphasis issue, not deception. A first-time non-Windows visitor can chart and replay, but cannot complete the advertised loop.
