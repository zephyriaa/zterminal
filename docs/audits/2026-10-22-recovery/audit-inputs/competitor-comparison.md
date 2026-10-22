# Competitor Comparison — Independent ZTerminal Reality Audit

**Basis disclosure:** competitors were NOT hands-on tested in this audit (single-environment constraint). TradingView/ATAS/DeepCharts/QuantConnect assessments are **documentation-based and experience-based**, per the spec's labeling requirement. ZTerminal's column is evidence-based from this audit.

| Dimension | ZTerminal (audited) | TradingView (docs-based) | ATAS (docs-based) | DeepCharts (docs-based) | QuantConnect / MultiCharts (docs-based) |
|---|---|---|---|---|---|
| Charting usability | lightweight-charts base; solid single-chart; replay works; multi-chart foundations; indicator set growing | Industry-standard UX, huge study library, mature drawing/persistence | Professional order-flow charts; steep but polished | Modern crypto order-flow charts | MultiCharts: mature desktop charting; QC: script-centric |
| Order-flow depth | CVD/large-trade/volume-profile/footprint foundations + L2 modules in code; **live feed down → runtime unverified** | Basic (paid tiers add some) | **Best-in-class footprint/cluster analytics** | Strong footprint/DOM focus | Limited (not their focus) |
| Data integrity | **Genuine provider OHLCV verified bar-by-bar; integrity metadata + honest UNAVAILABLE states; live path currently broken** | Mature commercial feeds | Mature commercial feeds | Mature | Mature |
| Strategy development | Python SDK + Monaco editor (web) **but execution requires Windows Helper**; ZS retired | Pine Script (proprietary, hosted) | Proprietary | Proprietary | Python/C# (QC) or EasyLanguage-style (MC) |
| Backtest credibility | **Engine independently verified correct to the cent; explicit execution models; guardrails; evidence hashes; Monte Carlo seeded** | Widely used; known repaint/execution caveats; not independently verified here | Position-centric backtests | Limited | Institutional-grade, widely validated |
| Research reproducibility | **Hash-covered runs, dataset identity, seeds, assumptions embedded — genuinely differentiated** | Limited (chart snapshots) | Limited | Limited | Good (QC datasets/versioning) |
| Stability (today) | Live feed outage + provider geo-block during audit; workspace-recovery rough edges | Very high | High | High | High |
| Learning curve | Low-moderate (clean UI) | Low | High | Moderate | High |
| Cost/accessibility | Free web beta; Helper private preview; source-available license | Freemium → paid | Paid (~$thousands/yr) | Paid | Free tier (QC) / paid (MC) |

## Where ZTerminal already competes

1. **Research provenance.** Hash-covered, assumption-embedded, seeded, reproducible research records are a real differentiator that none of the named competitors advertises as a first-class primitive. This is the platform's most defensible idea.
2. **Epistemic honesty.** Feed-health truth-telling and refusal to draw unverified data is not found in the comparison set in this explicit form.
3. **Backtest engine trustworthiness (verified).** Independent verification found zero arithmetic defects — better evidence than most competitors allow third parties to collect.

## Where ZTerminal seriously lags today

1. **Reliability and coverage.** A mature product does not have a total live-feed outage or half its providers geo-blocked during a normal audit window.
2. **Order-flow runtime.** ATAS-class footprint/cluster analytics are foundations here, unexercisable when the stream is down.
3. **Accessibility of the research loop.** Competitors run strategies in-browser or in one installer; ZTerminal needs a Windows machine + unsigned preview Helper.
4. **Study/library ecosystem and community** (TradingView's moat) — not close, and not claimed by the project.

## Verdict

Current product competitiveness: **low** — a professional user has no practical reason to switch today. Potential architectural differentiation: **real** — the provenance-first research model plus a verifiably correct engine is the kernel of something no incumbent offers as a unified loop. ZTerminal's honest self-positioning ("research beta, not a finished platform") matches this comparison almost exactly.
