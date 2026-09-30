# Validation methodology — schema 4 / engine 0.2.0

The browser submits a parent ResearchRun ID and version-1 configuration to the paired Windows Helper. It never submits authoritative metrics. The Helper reproduces the exact parent inputs in fresh CPython, checks runtime and full numerical evidence, then executes every requested variant in another fresh process. A mismatch or failed variant fails the entire validation. The server computes the report from checked runs and commits all runs, the report, its consistency receipt, and job completion in one SQLite transaction.

User Python runs with the user's filesystem/network permissions. Windows Job Objects bound resources; this is **not a security sandbox**. Exact-source execution and hashes cannot prove a strategy causal, that a researcher avoided later data, or that malicious Python cannot alter local files. Imported ResearchRuns are not execution attestations. Validation requires a fresh matching reproduction and preserves the original parent provenance.

## Metrics and chronological segments

Return, net profit and drawdown use the Helper's full marked equity, including open positions. Closed-trade statistics exclude open positions. Sharpe/Sortino use complete UTC daily returns, a 365-day calendar and zero target rate; fewer than 30 daily observations is unavailable. CAGR requires at least 365.25 days. Profit factor without losing trades and expectancy without closed trades are null, never a sentinel or zero. See `research/desktop/analytics.py` for the versioned implementation.

With at least 30 complete candles, split at `floor(N × oosSplitRatio)`. Earlier bars are `[0, split)`, later bars `[split + purgeBars, N)`. At least one purge bar and two bars per segment are required. Bounds are start-inclusive/end-exclusive. Each run starts with independent initial capital and cold indicator state. No bars, indicator state, position or training optimization carries into the later request. Different period returns are displayed separately; no ratio of unequal-duration total returns is called degradation. Sharpe degradation is `(later − earlier) / abs(earlier)` only when both exist and earlier is nonzero. Win-rate difference is null if either is unavailable.

This is an earlier/later chronological rerun, **not a sealed researcher holdout**. OOS strength remains inconclusive. Arbitrary Python can still use future rows within each supplied frame or external data.

## Rolling walk-forward

Configuration explicitly records training bars, testing bars, step bars, optimization and purge. Step must be at least testing length, so test windows do not overlap. Training windows roll; previous tests can legitimately become later training data. Complete windows only; no partial final test.

With optimization, execute the explicit two-dimensional parameter grid on training data alone. Select highest training total return; ties use stable grid order (Y outer, X inner). Only then execute the selected parameters on the disjoint test frame. Test results are never an optimizer input. Without optimization, retain the submitted parameters. All windows start cold: user-defined indicator warm-up consumes bars inside that window, and next-open signals cannot fill before the following bar. No state or positions cross the purge. This can discard boundary positions and is intentionally different from continuous deployment with warm-up/history.

Per-cycle WFE is `100 × (test return / test duration) / (training return / training duration)`, with negative test results preserved. Nonpositive training return makes WFE unavailable. No pooled WFE or robustness grade is calculated. Source/grid selection by the researcher remains unsealed; rolling tests do not prove independent trials or unseen source selection.

## Measured sensitivity

Two different submitted numeric parameters, 3–7 points per axis, explicit bounded ranges including the submitted values. Integer parameters require integer grid points. Every cell executes exact source with controlled parameter changes and unchanged dataset/runtime/costs. Cell metric is marked-equity total return. The baseline is separately reproduced; it need not coincide with a grid point.

For the best grid cell, average its existing local neighbors (up to eight) and divide by its positive return. Nonpositive best return makes this ratio unavailable. Coefficient of variation is population standard deviation of cell returns / absolute mean; zero mean is unavailable. Classification precedence:

1. Broad plateau: neighbor/best ≥0.8 and at least 80% of cells have positive returns.
2. Boundary optimum: positive maximum and all tied maxima lie on the grid boundary.
3. Narrow spike: neighbor/best <0.5.
4. Otherwise unstable surface.

These are deterministic descriptions of this historical grid. Parameter stability profile remains inconclusive; full-history sweeps are selection evidence, not independent validation.

## Cost stress

Each tier specifies **added total per-fill friction** above submitted costs. Added bps are split equally between fee and slippage; both settings and exact run references are retained. The source is rerun and the simulator recalculates signal fills, capital, sizing, rounding, fees, slippage and final open marks. Return, Sharpe, profit factor, expectancy, final equity, trade count and win rate come from each actual run.

If sampled net profit changes from positive to nonpositive, record the first adjacent sampled bracket. No interpolation, extrapolation or exact break-even claim. An unobserved crossing is unavailable, not +100 bps. Expectancy elasticity is measured only at exactly +10 bps with available, nonzero baseline expectancy. Costs can alter sizing/trades, so monotonic performance is not guaranteed. The profile remains inconclusive.

## Monte Carlo

Versioned model: additive closed-trade cash PnL paths. Sort trades by exit time, entry time, then ID. Minimum five trades; configured 100–5,000 paths and unsigned 32-bit seed. Python `random.Random` (MT19937) is recorded alongside runtime; percentiles use linear interpolation at 5%, 50%, 95%.

Permutation samples without replacement: terminal equity and net-loss status are fixed. Its variation concerns trade-close drawdown paths. IID resampling samples cash PnLs with replacement and assumes independent identically distributed trades. Neither model includes dynamic position sizing, serial dependence, intratrade mark-to-market drawdown or future market changes. The frequency of drawdown ≥50% is a drawdown threshold frequency, **not literal bankruptcy probability**. At most 20 paths/50 points are retained for display. These simulations are stress descriptions, not forecasts or confidence that an edge persists.

## Regimes, concentration and samples

At an entry open, classify from the previous closed bar only. Volatility: sample standard deviation of the previous 20 close log returns against tertiles of up to 100 previous volatility estimates, requiring at least 20 prior estimates. Below/above thresholds is low/high; ties are normal. Trend: EMA20/EMA50 ratio, initialized from the first close, after 50 prior bars; >+0.1% bull, <−0.1% bear, otherwise neutral. Unknown warm-up bars/trades remain explicit. Full-sample thresholds and same-bar entry closes are never used. Group PnL uses closed trades attributed by entry state; no group Sharpe is invented. Grouping does not establish causality.

Profit contributions, top 5/10, Gini, Herfindahl and largest winner use **gross winning closed-trade PnL** as denominator. Losing/zero-net strategies do not acquire infinite or misleading shares. No winning trades makes shares unavailable. UTC exit-month and direction contributions expose period/side dependence. Loss streak uses chronological closes; drawdown duration uses full Helper equity drawdown periods. Concentration is exposed without automatically calling it bad.

Sample profile: weak if <30 closed trades, <30 days, unavailable/<20 later trades, or <50% known volatility bars. Otherwise moderate below 100 trades, strong at 100+. Expose all counts, duration and coverage. These pragmatic descriptive thresholds do not establish significance, independence or statistical power. OOS, regime, parameter and friction profiles remain inconclusive with factual evidence beneath them.

## Identity, persistence and limits

RFC 8785 SHA-256 canonicalization. Deterministic validation fingerprint is `{sourceRunFingerprint, config, engineVersion}`; report ID/time are excluded. Each intentional rerun creates a new immutable report with the same fingerprint for the same parent/config/version. Artifact hash covers its complete saved envelope except its own hash. Evidence IDs/hashes, source parent, runtime, schema and material configuration are retained.

Reopen checks receipt digest, envelope hash, configuration fingerprint, parent and all linked ResearchRun hashes; it **does not recalculate metrics or execute source**. Older browser-generated validations remain in the database and cannot be displayed as verified evidence. Their direct fetch fails explicitly; they do not hide valid newer reports.

Limits: one active job; at most 80 variant executions, conservative two-million-candle plan budget, 100 MB estimated / 128 MB actual bundle limit, 10 rolling cycles, 10 cost tiers, and ten million Monte Carlo observations. Validation has a 540-second default total wall limit; each variant has a 120-second wall/CPU limit. Windows process tree has eight-process and combined 2 GB memory limits and is killed on cancellation/close. Data/strategy-dependent larger output may still fail the actual bound. No partial evidence or truncated battery is saved as success.

ResearchRun reproduction now uses an authenticated archived-parent endpoint. Its parent link and runtime/numerical comparison are included before hashing and saving. Matching evidence is reported for that rerun; divergent evidence remains a real run with an explicit difference status. Linked reproduction imports are refused; import the original and rerun locally. Sharing/migration of full reproduction graphs is later artifact work.

## Verification

`npm run test:python`, `npm test`, `npm run typecheck`, `npm run build`; changed-file ESLint. `npm run test:validation` requires the local app on port 3000, locked Python environment, Playwright Chromium, available real instrument metadata and unused Helper port 47321. It creates only a temporary Helper archive, labels its candles simulated, executes real Python through pairing, tests the battery/reproduction/restart/reopen and unavailable Helper failure, and saves observed screenshots/summary in ignored `artifacts/validation/`.
