"""Helper-owned validation planning and deterministic analysis. Never evaluates source.

Strategy execution lives in validation_runner's fresh, resource-bounded processes.
This module can be used by the archive to independently derive every report field.
"""
import copy
import math
import random
import statistics
import time
import uuid
from datetime import datetime, timezone

from validation import digest, validate

VERSION = "0.2.0"
SCHEMA = 4
DEFAULTS = {"version": 1, "oosSplitRatio": .7, "purgeBars": 1,
            "monteCarloPaths": 1000, "monteCarloSeed": 42,
            "monteCarloMethod": "trade_order_permutation", "costTiersBps": [0, 5, 10, 20, 30]}
REGIME_DEFINITION = {"volatilityWindow": 20, "historyWindow": 100,
                     "trendFast": 20, "trendSlow": 50, "neutralFraction": .001,
                     "attribution": "previous_closed_bar", "thresholds": "trailing_tertiles"}


def numeric(value):
    return not isinstance(value, bool) and isinstance(value, (int, float)) and math.isfinite(value)


def integer(value, low, high):
    return not isinstance(value, bool) and isinstance(value, int) and low <= value <= high


def normalize_config(raw, parent):
    if not isinstance(raw, dict) or set(raw) - (set(DEFAULTS) | {"sensitivityGrid", "walkForward", "regimes"}):
        raise ValueError("Unknown validation configuration field")
    cfg = {**copy.deepcopy(DEFAULTS), **copy.deepcopy(raw)}
    if cfg["version"] != 1 or isinstance(cfg["version"], bool):
        raise ValueError("Unsupported validation configuration version")
    if not numeric(cfg["oosSplitRatio"]) or not .5 <= cfg["oosSplitRatio"] <= .9 or not integer(cfg["purgeBars"], 1, 100):
        raise ValueError("Invalid chronological split or purge")
    if not integer(cfg["monteCarloPaths"], 100, 5000) or not integer(cfg["monteCarloSeed"], 0, 4294967295):
        raise ValueError("Invalid Monte Carlo count or seed")
    if cfg["monteCarloMethod"] not in ("trade_order_permutation", "iid_trade_resampling"):
        raise ValueError("Unsupported Monte Carlo methodology")
    costs = cfg["costTiersBps"]
    if not isinstance(costs, list) or not 2 <= len(costs) <= 10 or any(not numeric(x) or not 0 <= x <= 500 for x in costs) or 0 not in costs or len(set(costs)) != len(costs):
        raise ValueError("Specify 2–10 distinct added friction tiers including zero, from 0 to 500 bps")
    cfg["costTiersBps"] = sorted(costs)
    cfg["regimes"] = copy.deepcopy(REGIME_DEFINITION)
    if raw.get("regimes", REGIME_DEFINITION) != REGIME_DEFINITION:
        raise ValueError("Unsupported regime definition")
    grid = cfg.get("sensitivityGrid")
    if grid is not None:
        if not isinstance(grid, dict) or set(grid) != {"paramX", "paramY"}:
            raise ValueError("Sensitivity requires two numeric parameter axes")
        names = []
        for axis in (grid["paramX"], grid["paramY"]):
            if not isinstance(axis, dict) or set(axis) != {"name", "min", "max", "steps"}:
                raise ValueError("Invalid sensitivity axis")
            name = axis["name"]
            if not isinstance(name, str) or name not in parent["params"] or not numeric(parent["params"][name]):
                raise ValueError("Sensitivity axes must name submitted numeric parameters")
            if not all(numeric(axis[k]) for k in ("min", "max")) or not axis["min"] < axis["max"] or not axis["min"] <= parent["params"][name] <= axis["max"] or not integer(axis["steps"], 3, 7):
                raise ValueError("Sensitivity axes require 3–7 steps around the submitted value")
            values = axis_values(axis)
            if isinstance(parent["params"][name], int) and any(not x.is_integer() for x in values):
                raise ValueError("Integer parameters require integer grid points")
            names.append(name)
        if names[0] == names[1]:
            raise ValueError("Sensitivity axes must be different parameters")
    wf = cfg.get("walkForward")
    if wf is not None:
        if not isinstance(wf, dict) or set(wf) != {"trainingBars", "testingBars", "stepBars", "optimize"}:
            raise ValueError("Invalid rolling walk-forward configuration")
        n = len(parent["dataset"]["bars"])
        if not integer(wf["trainingBars"], 2, n) or not integer(wf["testingBars"], 2, n) or not integer(wf["stepBars"], wf["testingBars"], n) or not isinstance(wf["optimize"], bool):
            raise ValueError("Rolling test windows must be disjoint and contain at least two bars")
        if wf["optimize"] and grid is None:
            raise ValueError("Training-only optimization requires an explicit parameter grid")
        if not windows(n, cfg):
            raise ValueError("No complete walk-forward window fits this dataset")
        if len(windows(n, cfg)) > 10:
            raise ValueError("At most ten walk-forward cycles are supported")
    request_for(parent)
    # Work budget is explicit. Failure never truncates a requested battery.
    n = len(parent["dataset"]["bars"])
    if n >= 30 and n - math.floor(n * cfg["oosSplitRatio"]) - cfg["purgeBars"] < 2:
        raise ValueError("Insufficient disjoint later-period candles")
    count = 1 + (2 if n >= 30 else 0) + len(cfg["costTiersBps"]) - 1
    if grid:
        count += grid["paramX"]["steps"] * grid["paramY"]["steps"]
    candidates = len(parameter_candidates(parent, cfg)) if wf and wf["optimize"] else 1
    count += len(windows(len(parent["dataset"]["bars"]), cfg)) * (candidates + 1)
    if count > 80 or count * len(parent["dataset"]["bars"]) > 2_000_000:
        raise ValueError("Validation exceeds the 80-run / two-million-candle budget; reduce the grid or windows")
    # Preflight the retained evidence volume from this exact parent. Variants can
    # still change trade/plot counts; the controller enforces the actual 128 MB
    # output limit too. Never truncate a completed battery to fit an archive.
    import json
    estimated_bytes = len(json.dumps(parent, ensure_ascii=False).encode("utf-8")) * count
    if estimated_bytes > 100_000_000:
        raise ValueError("Estimated validation evidence exceeds 100 MB; reduce scenarios/windows or select a shorter ResearchRun")
    return cfg


def axis_values(axis):
    return [float(axis["min"] + (axis["max"] - axis["min"]) * i / (axis["steps"] - 1)) for i in range(axis["steps"])]


def parameter_candidates(parent, cfg):
    grid = cfg.get("sensitivityGrid")
    if not grid:
        return [copy.deepcopy(parent["params"])]
    return [{**parent["params"], grid["paramX"]["name"]: cast_param(parent, grid["paramX"]["name"], x),
             grid["paramY"]["name"]: cast_param(parent, grid["paramY"]["name"], y)}
            for y in axis_values(grid["paramY"]) for x in axis_values(grid["paramX"])]


def cast_param(parent, name, value):
    return int(value) if isinstance(parent["params"][name], int) else value


def request_for(parent, start=None, end=None, params=None, added=0):
    req = copy.deepcopy({k: parent[k] for k in ("name", "source", "config", "params", "dataset")})
    if start is not None:
        interval = parent["dataset"]["bars"][1]["t"] - parent["dataset"]["bars"][0]["t"]
        bars = req["dataset"]["bars"][start:end]
        bounds = {"from": bars[0]["t"], "to": bars[-1]["t"] + interval}
        req["config"].update(bounds)
        req["dataset"].update(bounds, bars=bars, hash=digest([[b[k] for k in ("t", "o", "h", "l", "c", "v")] for b in bars]))
    if params is not None:
        req["params"] = copy.deepcopy(params)
    # Added total per-fill friction is split equally across fees and slippage.
    req["config"]["feeBps"] += added / 2
    req["config"]["slippageBps"] += added / 2
    validate(req)
    return req


def static_plan(parent, cfg):
    plan = [("baseline", request_for(parent))]
    n = len(parent["dataset"]["bars"])
    if n >= 30:
        split, purge = math.floor(n * cfg["oosSplitRatio"]), cfg["purgeBars"]
        if n - split - purge < 2:
            raise ValueError("Insufficient disjoint later-period candles")
        plan += [("is", request_for(parent, 0, split)), ("oos", request_for(parent, split + purge, n))]
    plan += [(f"cost:{added}", request_for(parent, added=added)) for added in cfg["costTiersBps"] if added != 0]
    if cfg.get("sensitivityGrid"):
        plan += [(f"grid:{i}", request_for(parent, params=params)) for i, params in enumerate(parameter_candidates(parent, cfg))]
    return plan


def windows(n, cfg):
    wf = cfg.get("walkForward")
    if not wf:
        return []
    train, test, purge = wf["trainingBars"], wf["testingBars"], cfg["purgeBars"]
    return [(start, start + train, start + train + purge, start + train + purge + test)
            for start in range(0, n - train - purge - test + 1, wf["stepBars"])]


def select_training(runs):
    # Test results are not an argument. Stable first-grid-order ties are deliberate.
    return max(range(len(runs)), key=lambda i: runs[i]["metrics"]["totalReturn"]["value"])


def verify_evidence(parent, cfg, evidence, check_result):
    expected = dict(static_plan(parent, cfg))
    for cycle, (a, b, c, d) in enumerate(windows(len(parent["dataset"]["bars"]), cfg)):
        params = parameter_candidates(parent, cfg) if cfg["walkForward"]["optimize"] else [parent["params"]]
        training = []
        for i, candidate in enumerate(params):
            key = f"wf:{cycle}:train:{i}"
            expected[key] = request_for(parent, a, b, candidate)
            training.append(evidence.get(key))
        if any(run is None for run in training):
            raise ValueError("Missing walk-forward training evidence")
        for run in training:
            check_result(run)
        selected = select_training(training)
        expected[f"wf:{cycle}:test"] = request_for(parent, c, d, params[selected])
    if set(expected) != set(evidence):
        raise ValueError("Missing or unexpected validation execution evidence")
    for key, req in expected.items():
        run = evidence[key]
        check_result(run)
        if any(run[k] != req[k] for k in req):
            raise ValueError(f"Validation run inputs differ from planned request: {key}")
    baseline = evidence["baseline"]
    # A matching hash alone does not establish execution of an imported parent.
    # Reproduce it in fresh CPython and compare actual numerical evidence/runtime.
    for field in ("engine", "metrics", "trades", "equity", "plots", "monthly", "drawdowns", "assumptions"):
        if baseline[field] != parent[field]:
            raise ValueError(f"Parent cannot be reproduced under this runtime ({field}); reproduce the ResearchRun first")
    return expected


def baseline(run):
    keys = ("netProfit", "totalReturn", "cagr", "sharpe", "sortino", "maxDrawdown", "profitFactor", "winRate", "totalTrades")
    return {"initialCapital": run["config"]["initialCapital"], **{k: run["metrics"][k]["value"] for k in keys}}


def ref(run):
    return {"id": run["id"], "resultHash": run["resultHash"]}


def quantile(values, q):
    values = sorted(values)
    index = (len(values) - 1) * q
    low, high = math.floor(index), math.ceil(index)
    return values[low] + (values[high] - values[low]) * (index - low)


def monte_carlo(run, cfg):
    trades = sorted((t for t in run["trades"] if t["status"] == "closed"), key=lambda t: (t["exitTime"], t["entryTime"], t["id"]))
    pnls = [t["pnl"] for t in trades]
    if len(pnls) < 5:
        return None
    if len(pnls) * cfg["monteCarloPaths"] > 10_000_000:
        raise ValueError("Monte Carlo exceeds ten million observations")
    rng, initial = random.Random(cfg["monteCarloSeed"]), run["config"]["initialCapital"]
    terminals, drawdowns, paths = [], [], []
    for i in range(cfg["monteCarloPaths"]):
        sample = rng.sample(pnls, len(pnls)) if cfg["monteCarloMethod"] == "trade_order_permutation" else rng.choices(pnls, k=len(pnls))
        path, peak, dd = [initial], initial, 0
        for pnl in sample:
            value = path[-1] + pnl
            peak = max(peak, value)
            dd = max(dd, 1 - value / peak)
            path.append(value)
        # Permutation terminal equity is mathematically fixed, avoid float-order noise.
        terminals.append(initial + math.fsum(pnls) if cfg["monteCarloMethod"] == "trade_order_permutation" else path[-1])
        drawdowns.append(dd)
        if i < 20:
            paths.append([path[round(j * (len(path) - 1) / (min(50, len(path)) - 1))] for j in range(min(50, len(path)))])
    pct = lambda values: {key: quantile(values, q) for key, q in (("p05", .05), ("p50", .5), ("p95", .95))}
    return {"method": cfg["monteCarloMethod"], "seed": cfg["monteCarloSeed"], "paths": cfg["monteCarloPaths"], "observations": len(pnls),
            "terminalEquity": pct(terminals), "maxDrawdownPct": pct(drawdowns), "probabilityOfLoss": sum(x < initial for x in terminals) / len(terminals),
            "probabilityOfRuin": sum(x >= .5 for x in drawdowns) / len(drawdowns), "samplePaths": paths,
            "confidenceLevels": [.05, .5, .95], "model": "additive_closed_trade_pnl", "rng": "python_random_MT19937"}


def regime_labels(bars):
    vol, trend, vols, returns = [], [], [], []
    fast = slow = None
    for i, bar in enumerate(bars):
        # At bar i's open only bars through i-1 are known.
        if i == 0:
            vol.append("unknown")
            trend.append("unknown")
            continue
        close = bars[i - 1]["c"]
        fast = close if fast is None else fast + 2 / 21 * (close - fast)
        slow = close if slow is None else slow + 2 / 51 * (close - slow)
        trend.append("unknown" if i < 50 else "bull" if fast / slow - 1 > .001 else "bear" if fast / slow - 1 < -.001 else "neutral")
        if i >= 2:
            returns.append(math.log(close / bars[i - 2]["c"]))
        current = statistics.stdev(returns[-20:]) if len(returns) >= 20 else None
        history = vols[-100:]
        if current is None or len(history) < 20:
            vol.append("unknown")
        else:
            lo, hi = quantile(history, 1 / 3), quantile(history, 2 / 3)
            vol.append("low" if current < lo else "high" if current > hi else "normal")
        if current is not None:
            vols.append(current)
    return vol, trend


def regimes(run):
    bars = run["dataset"]["bars"]
    vol, trend = regime_labels(bars)
    indices = {b["t"]: i for i, b in enumerate(bars)}
    closed = [t for t in run["trades"] if t["status"] == "closed"]
    gross_wins = math.fsum(max(0, t["pnl"]) for t in closed)
    def group(labels, names):
        rows = []
        for name in names:
            trades = [t for t in closed if labels[indices[t["entryTime"]]] == name]
            rows.append({"regime": name, "label": name.title(), "barsCount": labels.count(name), "tradesCount": len(trades),
                         "winRate": sum(t["pnl"] > 0 for t in trades) / len(trades) if trades else None,
                         "netProfit": math.fsum(t["pnl"] for t in trades),
                         "profitContributionPct": math.fsum(max(0, t["pnl"]) for t in trades) / gross_wins * 100 if gross_wins else None,
                         "sharpe": None})
        return rows
    vr, tr = group(vol, ["low", "normal", "high", "unknown"]), group(trend, ["bull", "bear", "neutral", "unknown"])
    dominant = max(r["profitContributionPct"] for r in vr) if gross_wins else None
    return {"volatilityRegimes": vr, "trendRegimes": tr, "dominantRegimePct": dominant, "rating": "inconclusive", "definition": REGIME_DEFINITION}


def concentration(run):
    trades = sorted((t for t in run["trades"] if t["status"] == "closed"), key=lambda t: (t["exitTime"], t["entryTime"], t["id"]))
    wins = sorted((t["pnl"] for t in trades if t["pnl"] > 0), reverse=True)
    total = math.fsum(wins)
    ascending = sorted(wins)
    n = len(wins)
    streak = best = 0
    for trade in trades:
        streak = streak + 1 if trade["pnl"] < 0 else 0
        best = max(best, streak)
    def attribution(key):
        groups = {}
        for trade in trades:
            name = key(trade)
            row = groups.setdefault(name, {"group": name, "trades": 0, "netProfit": 0, "grossWinningPnl": 0})
            row["trades"] += 1
            row["netProfit"] += trade["pnl"]
            row["grossWinningPnl"] += max(0, trade["pnl"])
        return [{**row, "grossWinningContributionPct": row["grossWinningPnl"] / total * 100 if total else None} for _, row in sorted(groups.items())]
    return {"top5TradesProfitPct": math.fsum(wins[:5]) / total * 100 if total else None,
            "top10TradesProfitPct": math.fsum(wins[:10]) / total * 100 if total else None,
            "giniCoefficient": sum((2 * i - n - 1) * x for i, x in enumerate(ascending, 1)) / (n * total) if total else None,
            "herfindahlIndex": math.fsum((x / total) ** 2 for x in wins) if total else None,
            "longestLossStreak": best, "maxDrawdownDays": max((d["durationMs"] / 86400000 for d in run["drawdowns"]), default=0),
            "sampleSufficiency": "insufficient" if len(trades) < 30 else "marginal" if len(trades) < 100 else "adequate",
            "denominator": "gross_winning_closed_trade_pnl",
            "largestWinnerContributionPct": max(wins) / total * 100 if total else None,
            "periods": attribution(lambda t: datetime.fromtimestamp(t["exitTime"] / 1000, tz=timezone.utc).strftime("%Y-%m")),
            "directions": attribution(lambda t: t["side"])}


def summarize(parent, cfg, evidence):
    run = evidence["baseline"]
    b = baseline(run)
    out = {"version": SCHEMA, "id": str(uuid.uuid4()), "sourceRunId": parent["id"], "createdAt": int(time.time() * 1000), "config": cfg,
           "provenance": {"sourceRunFingerprint": parent["resultHash"], "validationConfigHash": digest(cfg), "engineVersion": VERSION,
                          "fingerprint": digest({"sourceRunFingerprint": parent["resultHash"], "config": cfg, "engineVersion": VERSION}),
                          "runtime": run["engine"], "execution": "helper_fresh_cpython_processes"},
           "baseline": b, "evidenceRuns": {key: ref(value) for key, value in evidence.items()},
           "monteCarlo": monte_carlo(run, cfg), "regimes": regimes(run), "concentration": concentration(run)}
    diagnostics = []
    def diag(id, category, headline, detail, severity="warning"):
        diagnostics.append({"id": id, "category": category, "severity": severity, "headline": headline, "detail": detail})
    diag("selection", "oos", "Researcher selection is not sealed", "Source and parameters may have been selected after viewing this history. Disjoint reruns do not prove absence of lookahead in arbitrary Python.")
    if "is" in evidence:
        earlier, later = evidence["is"], evidence["oos"]
        im, om = baseline(earlier), baseline(later)
        out["outOfSample"] = {"splitRatio": cfg["oosSplitRatio"], "purgeBars": cfg["purgeBars"], "inSampleRun": ref(earlier), "outOfSampleRun": ref(later),
                              "inSampleRange": {k: earlier["config"][k] for k in ("from", "to")}, "outOfSampleRange": {k: later["config"][k] for k in ("from", "to")},
                              "inSampleObservations": len(earlier["dataset"]["bars"]), "outOfSampleObservations": len(later["dataset"]["bars"]),
                              "inSampleMetrics": im, "outOfSampleMetrics": om, "degradation": {
                                  "sharpeDelta": (om["sharpe"] - im["sharpe"]) / abs(im["sharpe"]) if im["sharpe"] not in (None, 0) and om["sharpe"] is not None else None,
                                  "drawdownDelta": om["maxDrawdown"] - im["maxDrawdown"],
                                  "winRateDelta": om["winRate"] - im["winRate"] if im["winRate"] is not None and om["winRate"] is not None else None, "rating": "inconclusive"}}
        diag("later-result", "oos", f"Later-period net profit: {om['netProfit']:.2f}", f"{om['totalTrades']} closed trades across {len(later['dataset']['bars'])} bars; independent starting capital and indicator state.", "info")
        if om["totalTrades"] < 20:
            diag("later-thin", "sample", f"Only {om['totalTrades']} later-period closed trades", "Fewer than 20 later-period trades is a thin descriptive sample.")
    else:
        diag("no-oos", "sample", "Chronological split unavailable", "At least 30 bars are required; the requested purge and two-bar minimum must also fit.")
    tiers = []
    for added in cfg["costTiersBps"]:
        cost = run if added == 0 else evidence[f"cost:{added}"]
        m = cost["metrics"]
        tiers.append({"feeBps": cost["config"]["feeBps"], "slippageBps": cost["config"]["slippageBps"], "totalFrictionBps": cost["config"]["feeBps"] + cost["config"]["slippageBps"],
                      **{key: m[key]["value"] for key in ("netProfit", "sharpe", "profitFactor", "expectancy", "totalReturn", "finalEquity", "winRate", "totalTrades")}, "run": ref(cost)})
    first_loss = next((i for i, tier in enumerate(tiers) if tier["netProfit"] <= 0), None)
    bracket = [tiers[first_loss - 1]["totalFrictionBps"], tiers[first_loss]["totalFrictionBps"]] if first_loss is not None and first_loss > 0 else None
    ten = next((t for t, added in zip(tiers, cfg["costTiersBps"]) if added == 10), None)
    elasticity = (tiers[0]["expectancy"] - ten["expectancy"]) / abs(tiers[0]["expectancy"]) * 100 if ten and tiers[0]["expectancy"] not in (None, 0) and ten["expectancy"] is not None else None
    out["costStress"] = {"tiers": tiers, "breakEvenFrictionBps": None, "breakEvenBracketBps": bracket, "frictionElasticity": elasticity, "rating": "inconclusive"}
    diag("cost-method", "cost", "Costs were rerun in the simulator", "Each added per-fill friction tier is split equally between fee and slippage. Sizing, quantity rounding, fills and open equity are recalculated. A sampled sign change is a bracket, not an exact break-even estimate.", "info")
    if b["totalTrades"] < 30:
        diag("thin", "sample", f"Only {b['totalTrades']} closed trades", "Fewer than 30 closed trades is insufficient under this descriptive sample rule.")
    diag("duration", "sample", f"{len(run['dataset']['bars'])} observations over {(run['config']['to'] - run['config']['from']) / 86400000:.1f} days", "Daily risk ratios require 30 complete UTC daily returns. CAGR requires at least one year. Null statistics remain unavailable.", "info")
    diag("regimes", "regime", "Regime attribution uses the previous closed bar", "Trailing volatility thresholds and EMA trend use only past prices. Unknown warm-up bars remain a separate group. Contributions use gross winning PnL, not net PnL; regime grouping does not establish causality.", "info")
    diag("mc", "sample", "Monte Carlo uses recorded cash PnLs", "Additive paths do not model dynamic position sizing, dependence, intratrade risk or future regimes. Permutation fixes ending equity; IID resampling assumes independent trades. DD≥50% is a drawdown threshold, not literal bankruptcy.", "info")
    grid = cfg.get("sensitivityGrid")
    if grid:
        xs, ys = axis_values(grid["paramX"]), axis_values(grid["paramY"])
        cells = [{"x": params[grid["paramX"]["name"]], "y": params[grid["paramY"]["name"]], "metricValue": evidence[f"grid:{i}"]["metrics"]["totalReturn"]["value"],
                  "trades": evidence[f"grid:{i}"]["metrics"]["totalTrades"]["value"], "run": ref(evidence[f"grid:{i}"])} for i, params in enumerate(parameter_candidates(parent, cfg))]
        values = [cell["metricValue"] for cell in cells]
        best = max(range(len(values)), key=lambda i: values[i])
        bx, by = best % len(xs), best // len(xs)
        neighbors = [cell["metricValue"] for cell in cells if abs(xs.index(float(cell["x"])) - bx) <= 1 and abs(ys.index(float(cell["y"])) - by) <= 1 and cell != cells[best]]
        ratio = statistics.mean(neighbors) / values[best] if values[best] > 0 else None
        positive = sum(x > 0 for x in values) / len(values)
        maxima = [i for i, value in enumerate(values) if value == values[best]]
        boundary_only = all(i % len(xs) in (0, len(xs) - 1) or i // len(xs) in (0, len(ys) - 1) for i in maxima)
        classification = "broad_plateau" if ratio is not None and ratio >= .8 and positive >= .8 else "boundary_optimum" if values[best] > 0 and boundary_only else "narrow_spike" if ratio is not None and ratio < .5 else "unstable_surface"
        mean = statistics.mean(values)
        out["sensitivity"] = {"paramX": grid["paramX"]["name"], "paramY": grid["paramY"]["name"], "xValues": xs, "yValues": ys,
                              "baselinePoint": {"x": parent["params"][grid["paramX"]["name"]], "y": parent["params"][grid["paramY"]["name"]], "metricValue": b["totalReturn"]},
                              "grid": [cells[i:i + len(xs)] for i in range(0, len(cells), len(xs))], "neighborDegradationRatio": ratio,
                              "coefficientOfVariation": statistics.pstdev(values) / abs(mean) if mean != 0 else None, "surfaceClassification": classification, "rating": "inconclusive", "metric": "totalReturn", "neighborReference": "best_grid_cell"}
        diag("surface", "sensitivity", classification.replace("_", " ").title(), "Measured total returns from exact-source runs. Classification precedence: neighbor/best ≥0.8 and ≥80% profitable cells plateau; all positive maxima on boundary; neighbor/best <0.5 spike; otherwise unstable. Descriptive selection on the full history.", "info")
    wf_cycles = []
    for cycle, _window in enumerate(windows(len(parent["dataset"]["bars"]), cfg)):
        candidates = parameter_candidates(parent, cfg) if cfg["walkForward"]["optimize"] else [parent["params"]]
        training = [evidence[f"wf:{cycle}:train:{i}"] for i in range(len(candidates))]
        selected = select_training(training)
        earlier, later = training[selected], evidence[f"wf:{cycle}:test"]
        def period(r):
            return {"from": r["config"]["from"], "to": r["config"]["to"], "return": r["metrics"]["totalReturn"]["value"], "sharpe": r["metrics"]["sharpe"]["value"], "trades": r["metrics"]["totalTrades"]["value"], "observations": len(r["dataset"]["bars"]), "run": ref(r)}
        im, om = period(earlier), period(later)
        is_rate = im["return"] / (im["to"] - im["from"])
        oos_rate = om["return"] / (om["to"] - om["from"])
        wf_cycles.append({"cycle": cycle + 1, "inSample": im, "outOfSample": om, "wfe": oos_rate / is_rate * 100 if is_rate > 0 else None,
                          "selectedParams": earlier["params"], "trainingCandidates": [ref(r) for r in training]})
    if wf_cycles:
        out["walkForward"] = {"cycles": wf_cycles, "aggregateWfe": None, "positiveOosCycles": sum(c["outOfSample"]["return"] > 0 for c in wf_cycles), "totalCycles": len(wf_cycles), "rating": "inconclusive",
                              "selection": "training_total_return_stable_grid_order" if cfg["walkForward"]["optimize"] else "frozen_submitted_parameters", "statePolicy": "cold_start_no_warmup_or_positions_carried"}
        diag("wf", "oos", "Rolling test windows are disjoint", "Each window starts with fresh indicator state and capital; no warm-up or positions cross the purge. Grid selection uses only training total return with stable grid-order ties. Earlier tests may become later training data; researcher-selected source/grid remain unsealed. WFE is unavailable when training return is nonpositive.", "info")
    duration = (run["config"]["to"] - run["config"]["from"]) / 86400000
    later_trades = out.get("outOfSample", {}).get("outOfSampleMetrics", {}).get("totalTrades")
    known = sum(r["barsCount"] for r in out["regimes"]["volatilityRegimes"] if r["regime"] != "unknown")
    out["sample"] = {"observations": len(run["dataset"]["bars"]), "durationDays": duration, "closedTrades": b["totalTrades"], "laterClosedTrades": later_trades,
                     "volatilityKnownObservations": known, "volatilityCoverageFraction": known / len(run["dataset"]["bars"])}
    thin = b["totalTrades"] < 30 or duration < 30 or later_trades is None or later_trades < 20 or known / len(run["dataset"]["bars"]) < .5
    sample_rating = "weak" if thin else "moderate" if b["totalTrades"] < 100 else "strong"
    out["profile"] = {"oosPersistence": "inconclusive", "parameterStability": "inconclusive", "frictionResilience": "inconclusive", "regimeBreadth": "inconclusive", "sampleAdequacy": sample_rating}
    diag("sample-rule", "sample", "Sample labels are descriptive thresholds", "Weak: <30 trades, <30 days, unavailable/<20 later trades, or <50% known volatility bars. Otherwise moderate below 100 trades, strong at 100+. These thresholds do not establish statistical significance or independence.", "info")
    out["diagnostics"] = diagnostics
    out["resultHash"] = digest(out)
    return out
