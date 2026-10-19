"""Bounded research analyses of immutable runs. No future-probability claims.

Stationary bootstrap: Politis & Romano (1994), JASA 89:1303–1313,
doi:10.1080/01621459.1994.10476870. Trials run the existing engine.
"""
import copy
import itertools
import json
import math
import random
import time
import uuid
import numpy as np
import pandas as pd
from validation import digest
from engine import execute

VERSION = "1.1.0"


def artifact(parent, kind, payload):
    record = {"version": 1, "id": str(uuid.uuid4()), "createdAt": int(time.time() * 1000),
              "kind": kind, "parentId": parent["id"], "parentHash": parent["resultHash"],
              "analysisVersion": VERSION, "payload": payload}
    record["hash"] = digest(record)
    return record


def summary(result):
    closed = [t for t in result["trades"] if t["status"] == "closed"]
    positive = [t["pnl"] for t in closed if t["pnl"] > 0]
    scoring_from = result["config"].get("evaluationFrom", result["config"]["from"])
    equity = [p for p in result["equity"] if p["time"] >= scoring_from]
    series = pd.Series([p["equity"] for p in equity], index=pd.to_datetime([p["time"] for p in equity], unit="ms", utc=True))
    daily = series.resample("1D").last().dropna()
    changes = daily.diff()
    if len(changes): changes.iloc[0] = daily.iloc[0]-result["config"]["initialCapital"]
    eligible_days = {p["time"] for p in result.get("dailyReturns", [])}
    daily_pnl = [{"time": int(t.value//1_000_000), "pnl": float(value)} for t, value in changes.items() if int(t.value//1_000_000) in eligible_days]
    return {"netReturn": result["metrics"]["totalReturn"]["value"],
            "excessReturn": result["metrics"].get("excessReturn", {"value": None})["value"],
            "benchmarkReturn": result["metrics"].get("benchmarkReturn", {"value": None})["value"],
            "maxDrawdown": result["metrics"]["maxDrawdown"]["value"], "closedTrades": len(closed),
            "dailyReturns": result.get("dailyReturns", []), "benchmarkDailyReturns": result.get("benchmarkDailyReturns", []),
            "tradeConcentration": max(positive) / sum(positive) if positive else None,
            "dayConcentration": concentration([p["pnl"] for p in daily_pnl]), "dailyPnl": daily_pnl,
            "evidenceHash": result.get("evidenceHash", result["resultHash"]),
            "trades": closed, "equity": equity}


class ResearchRunner:
    def __init__(self, parent, stage):
        self.parent, self.stage, self.trials, self.bars = parent, stage, [], 0

    def run(self, start, end, params, patch=None, label="evaluation"):
        cfg = copy.deepcopy(self.parent["config"])
        bars = self.parent["dataset"]["bars"]
        warmup = cfg.get("warmupBars", 0)
        begin = max(0, start - warmup)
        selected = copy.deepcopy(bars[begin:end])
        if len(selected) < 2 or end - start < 2: raise ValueError("Each split needs at least two evaluation bars")
        self.bars += len(selected)
        if self.bars > 2_000_000: raise ValueError("Research request exceeds two million evaluated bars; reduce grid or history")
        cfg.update(patch or {})
        interval = bars[1]["t"] - bars[0]["t"]
        cfg.update(from_=selected[0]["t"])
        cfg["from"] = cfg.pop("from_")
        cfg.update(to=selected[-1]["t"] + interval, evaluationFrom=bars[start]["t"], warmupBars=max(0, warmup-(start-begin)), closeAtEnd=True, reserveHoldout=False)
        dataset = {**self.parent["dataset"], "from": cfg["from"], "to": cfg["to"], "bars": selected,
                   "hash": digest([[b[k] for k in ("t", "o", "h", "l", "c", "v")] for b in selected])}
        self.stage({"stage": "running_strategy", "completed": len(self.trials), "message": label})
        trial = {"label": label, "start": start, "end": end, "params": params, "configPatch": patch or {}}
        try:
            request = {"name": self.parent["name"], "source": self.parent["source"], "config": cfg, "dataset": dataset, "params": params}
            if "instrument" in self.parent: request["instrument"] = self.parent["instrument"]
            if cfg.get("fundingMode") == "historical":
                events = [e for e in self.parent["fundingData"]["events"] if cfg["from"] <= e["time"] < cfg["to"]]
                request["fundingData"] = {**self.parent["fundingData"], "from": cfg["from"], "to": cfg["to"], "events": events, "hash": digest(events)}
            result = execute(request)
            data = summary(result)
            trial.update(status="complete", netReturn=data["netReturn"], evidenceHash=data["evidenceHash"])
            self.trials.append(trial)
            return data
        except Exception as error:
            trial.update(status="failed", error=str(error)[:2000])
            self.trials.append(trial)
            error.research_trials = self.trials
            raise

    def select(self, start, end, candidates):
        scored = []
        for params in candidates:
            try:
                value = self.run(start, end, params, label="training selection")
                scored.append((value["netReturn"], json.dumps(params, sort_keys=True, separators=(",", ":")), params))
            except (ValueError, TypeError) as error:
                if "million evaluated bars" in str(error): raise
        if not scored:
            error = ValueError("Every training candidate failed; inspect source/parameters and retained trial diagnostics")
            error.research_trials = self.trials
            raise error
        return sorted(scored, key=lambda item: (-item[0], item[1]))[0][2]


def candidates_for(parent, grid):
    if not isinstance(grid, dict) or len(grid) > 8: raise ValueError("Parameter grid must be an object with at most eight parameters")
    keys = sorted(grid)
    if any(not isinstance(grid[k], list) or not grid[k] or len(grid[k]) > 100 for k in keys): raise ValueError("Each grid value must be a nonempty list")
    count = math.prod(len(grid[k]) for k in keys)
    if count > 100: raise ValueError("Grid exceeds 100 combinations")
    base = parent.get("resolvedParams", parent["params"])
    return [{**base, **dict(zip(keys, values))} for values in itertools.product(*(grid[k] for k in keys))]


def prefix_checks(parent, stage):
    """Compare strategy signals/plots, not fills, at sampled data prefixes."""
    import contextlib
    import zterminal as zt
    from engine import BoundedLog, strategy_parameters
    from script_inspection import compile_strategy
    bars = parent["dataset"]["bars"]
    frame = pd.DataFrame(bars).rename(columns={"o": "open", "h": "high", "l": "low", "c": "close", "v": "volume"})
    frame.index = pd.to_datetime(frame.pop("t"), unit="ms", utc=True)
    frame = frame.astype("float64")
    def evaluate(data):
        seed = parent["config"].get("strategySeed", 42)
        random.seed(seed)
        np.random.seed(seed)
        namespace = {"__name__": "zterminal_user_strategy", "__file__": "strategy.py"}
        with contextlib.redirect_stdout(BoundedLog()), contextlib.redirect_stderr(BoundedLog()):
            code, inspected = compile_strategy(parent["source"], parent["params"], False)
            exec(code, namespace)
            output = namespace["strategy"](data.copy(), strategy_parameters(namespace, parent["params"], inspected))
        if not isinstance(output, zt.Strategy): raise ValueError("Unsupported strategy output")
        return {**{k: getattr(output, k) for k in ("entries", "exits", "short_entries", "short_exits")}, **{f"plot:{k}": v for k, v in output.plots.items()}}
    full = evaluate(frame)
    findings = []
    for end in sorted({max(2, len(frame)//3), max(2, len(frame)*2//3)}):
        stage({"stage": "running_strategy", "message": "prefix causality checks"})
        part = evaluate(frame.iloc[:end])
        for key in set(full) | set(part):
            a, b = full.get(key), part.get(key)
            if a is None and b is None: continue
            if not isinstance(a, pd.Series) or not isinstance(b, pd.Series) or not a.iloc[:end].equals(b): findings.append({"prefixBars": end, "output": key})
    return {"status": "failed" if findings else "passed_sampled_checks", "findings": findings,
            "limitation": "Sampled checks cannot prove arbitrary local Python free of look-ahead bias or external information."}


def validate_strategy(parent, options, stage):
    n = len(parent["dataset"]["bars"])
    prefix = sum(bar["t"] < parent["config"].get("evaluationFrom", parent["config"]["from"]) for bar in parent["dataset"]["bars"])
    a, b = prefix+int((n-prefix)*.6), prefix+int((n-prefix)*.8)
    if a < 4 or b-a < 2 or n-b < 2: raise ValueError("History is too short for chronological validation")
    horizon, embargo = options.get("outcomeHorizonBars", 0), options.get("embargoBars", 0)
    if type(horizon) is not int or type(embargo) is not int or not 0 <= horizon <= 10000 or not horizon <= embargo <= 10000:
        raise ValueError("Declared overlapping outcomes require an embargo at least as long as their horizon")
    runner = ResearchRunner(parent, stage)
    runner.bars = b + max(2, b//3) + max(2, b*2//3)
    candidates = candidates_for(parent, options.get("grid", {}))
    selected = runner.select(prefix, a-embargo, candidates)
    validation = runner.run(a, b, selected, label="validation fixed parameters")
    folds = []
    edges = [prefix+int((b-prefix)*.5 + (b-prefix)*.5*i/3) for i in range(4)]
    for i in range(3):
        params = runner.select(prefix, edges[i]-embargo, candidates)
        folds.append({"train": [prefix, edges[i]-embargo], "test": [edges[i], edges[i+1]], "params": params,
                      "result": runner.run(edges[i], edges[i+1], params, label=f"walk-forward {i+1}")})
    costs = parent["config"]
    stress = {"doubleCosts": runner.run(a, b, selected, {k: costs.get(k, 0)*2 for k in ("feeBps", "slippageBps", "spreadBps")}, "double fees/spread; ATR impact unchanged" if costs.get("impactModel") == "atr_volume_v1" else "double costs"),
              "extraBarDelay": runner.run(a, b, selected, {"executionDelayBars": costs.get("executionDelayBars", 1)+1}, "extra bar delay")}
    neighbors = []
    for key, value in sorted(selected.items()):
        if type(value) not in (int, float): continue
        delta = 1 if type(value) is int else max(abs(value)*.1, .01)
        for adjacent in (value-delta, value+delta):
            params = {**selected, key: adjacent}
            try: neighbors.append({"params": params, "result": runner.run(a, b, params, label="parameter neighbor")})
            except (ValueError, TypeError) as error: neighbors.append({"params": params, "error": str(error)})
    periods = []
    for i in range(3):
        start, end = a+(b-a)*i//3, a+(b-a)*(i+1)//3
        if end-start >= 2: periods.append(runner.run(start, end, selected, label="chronological subperiod"))
    # Causality checks deliberately stop at development end: holdout is never evaluated here.
    development = copy.deepcopy(parent)
    development["dataset"]["bars"] = development["dataset"]["bars"][:b]
    development["params"] = selected
    causality = prefix_checks(development, stage)
    payload = {"splits": {"training": [prefix, a-embargo], "validation": [a, b], "holdout": [b, n]}, "embargoBars": embargo,
               "outcomeHorizonBars": horizon, "objective": "training_net_return_desc_then_canonical_params", "grid": options.get("grid", {}),
               "selectedParams": selected, "validation": validation, "walkForward": folds, "stress": stress,
               "neighbors": neighbors, "subperiods": periods, "causality": causality, "trials": runner.trials,
               "knownTrialsOnly": True, "holdoutEvaluated": False,
               "regimes": regime_analysis(validation)}
    return artifact(parent, "validation", payload)


def regime_analysis(data):
    daily = data["dailyReturns"]
    benchmark = {p["time"]: p["return"] for p in data["benchmarkDailyReturns"]}
    series = pd.Series([benchmark.get(p["time"], np.nan) for p in daily])
    volatility = series.shift(1).rolling(20, min_periods=20).std()
    # A fixed threshold uses only trailing observations, with no full-sample quantile.
    buckets = {"below_3pct_daily_volatility": [], "at_least_3pct_daily_volatility": []}
    for i, point in enumerate(daily):
        if pd.notna(volatility.iloc[i]): buckets[list(buckets)[int(volatility.iloc[i] >= .03)]].append(point["return"])
    return {"definition": "Prior 20 complete daily benchmark returns, sample volatility, fixed 3% daily threshold; initial 20 days excluded",
            "groups": {key: {"days": len(values), "compoundedReturn": float(np.prod(1+np.array(values))-1) if values else None} for key, values in buckets.items()}}


def holdout(parent, selection, access, stage):
    if selection["kind"] != "validation" or selection["parentHash"] != parent["resultHash"]: raise ValueError("Selection does not match the immutable run")
    payload = selection["payload"]
    start, end = payload["splits"]["holdout"]
    runner = ResearchRunner(parent, stage)
    result = runner.run(start, end, payload["selectedParams"], label="final holdout")
    combined = copy.deepcopy(result)
    for key in ("dailyReturns", "benchmarkDailyReturns", "trades"):
        combined[key] = payload["validation"][key] + result[key]
    combined["closedTrades"] = len(combined["trades"])
    combined["netReturn"] = (1+payload["validation"]["netReturn"])*(1+result["netReturn"])-1
    benchmark = (1+payload["validation"]["benchmarkReturn"])*(1+result["benchmarkReturn"])-1
    combined["excessReturn"] = float(combined["netReturn"]-benchmark)
    scale = 1+payload["validation"]["netReturn"]
    combined["equity"] = payload["validation"]["equity"] + [{**p, "equity": p["equity"]*scale} for p in result["equity"]]
    values = np.r_[parent["config"]["initialCapital"], [p["equity"] for p in combined["equity"]]]
    combined["maxDrawdown"] = float(np.max(1-values/np.maximum.accumulate(values)))
    combined["tradeConcentration"] = concentration([t["pnl"] for t in payload["validation"]["trades"]]+[t["pnl"]*scale for t in result["trades"]])
    combined["dailyPnl"] = payload["validation"]["dailyPnl"] + [{**p, "pnl": p["pnl"]*scale} for p in result["dailyPnl"]]
    combined["dayConcentration"] = concentration([p["pnl"] for p in combined["dailyPnl"]])
    combined["combinationPolicy"] = "Normalized segment returns compounded. Each segment starts flat at original capital; this composite is not a continuous execution replay and does not rerun quantity rounding at carried capital."
    interval = None
    try: interval = simulate_returns(parent, {"method": "stationary_daily", "seed": 42, "simulations": 1000}, stage, combined)["excessReturnInterval"]
    except ValueError: pass
    record = {"selectionId": selection["id"], "selectionHash": selection["hash"], "access": access, "result": result,
              "outOfSample": combined, "excessReturnInterval": interval, "trials": runner.trials}
    record["assessment"] = assess(parent, payload, record)
    return artifact(parent, "holdout", record)


def concentration(values):
    positive = [x for x in values if x > 0]
    return max(positive)/sum(positive) if positive else None


def stationary_indices(rng, observations, horizon, block_length, count):
    indices = np.empty((count, horizon), dtype=np.int64)
    indices[:, 0] = rng.integers(observations, size=count)
    for i in range(1, horizon):
        restart = rng.random(count) < 1/block_length
        fresh = rng.integers(observations, size=count)
        indices[:, i] = np.where(restart, fresh, (indices[:, i-1]+1) % observations)
    return indices


def simulate_returns(parent, options, stage, data=None):
    data = data or summary(parent)
    method, seed, simulations = options.get("method", "stationary_daily"), options.get("seed", 42), options.get("simulations", 1000)
    if type(seed) is not int or not 0 <= seed <= 2**32-1 or type(simulations) is not int or not 100 <= simulations <= 5000: raise ValueError("Use an unsigned 32-bit seed and 100–5000 paths")
    threshold = options.get("drawdownThreshold", .2)
    if type(threshold) not in (int, float) or not math.isfinite(threshold) or not 0 < threshold <= 1: raise ValueError("Drawdown threshold must be between zero and one")
    if method == "stationary_daily":
        points = data["dailyReturns"]
        returns = np.array([p["return"] for p in points], dtype=float)
        benchmark_map = {p["time"]: p["return"] for p in data["benchmarkDailyReturns"]}
        benchmark = np.array([benchmark_map.get(p["time"], np.nan) for p in points])
        if len(returns) < 60: raise ValueError("Stationary bootstrap requires 60 complete daily returns")
        block = options.get("blockLength", max(1, round(len(returns)**(1/3))))
        if type(block) is not int or block < 1 or len(returns)/block < 5: raise ValueError("Require at least five expected blocks")
        if not np.isfinite(benchmark).all() or (benchmark <= -1).any(): raise ValueError("Paired benchmark daily returns are unavailable or invalid")
        unit = "days"
    elif method in ("iid_trades", "trade_permutation"):
        returns = np.array([t["accountReturn"] for t in data["trades"] if t["status"] == "closed"], dtype=float)
        if len(returns) < 2: raise ValueError("At least two closed trades are required")
        benchmark, block, unit = None, None, "trades"
    else: raise ValueError("Unsupported simulation method")
    horizon = options.get("horizon", len(returns))
    if type(horizon) is not int or horizon < 1 or horizon*simulations > 10_000_000: raise ValueError("Simulation exceeds ten million observations or has an invalid horizon")
    if method == "trade_permutation" and horizon != len(returns): raise ValueError("Permutation horizon must equal the observed trade count")
    if not np.isfinite(returns).all() or (returns <= -1).any(): raise ValueError("Require finite account returns greater than -100%")
    rng, initial = np.random.default_rng(seed), parent["config"]["initialCapital"]
    steps = np.unique(np.linspace(0, horizon, min(horizon+1, 400), dtype=int))
    sampled_paths, endings, drawdowns, excesses = [], [], [], []
    for offset in range(0, simulations, 32):
        count = min(32, simulations-offset)
        if method == "stationary_daily": idx = stationary_indices(rng, len(returns), horizon, block, count)
        elif method == "trade_permutation": idx = np.array([rng.permutation(len(returns)) for _ in range(count)])
        else: idx = rng.integers(len(returns), size=(count, horizon))
        paths = np.c_[np.full(count, initial), initial*np.cumprod(1+returns[idx], axis=1)]
        if not np.isfinite(paths).all(): raise ValueError("Simulation overflow")
        sampled_paths.extend(paths[:, steps].tolist())
        endings.extend(paths[:, -1].tolist())
        drawdowns.extend(np.max(1-paths/np.maximum.accumulate(paths, axis=1), axis=1).tolist())
        if benchmark is not None: excesses.extend(((paths[:, -1]/initial-1)-(np.prod(1+benchmark[idx], axis=1)-1)).tolist())
        stage({"stage": "calculating_report", "completed": offset+count, "total": simulations, "message": method})
    lower, median, upper = np.quantile(sampled_paths, [.05, .5, .95], axis=0)
    return {"method": method, "seed": seed, "simulations": simulations, "observations": len(returns), "horizon": horizon, "horizonUnit": unit,
            "blockLength": block, "initialCapital": initial, "drawdownThreshold": threshold,
            "bands": [{"step": int(i), "lower": float(lo), "median": float(mid), "upper": float(hi)} for i, lo, mid, hi in zip(steps, lower, median, upper)],
            "samplePaths": sampled_paths[:20], "endingEquity": endings, "maxDrawdowns": drawdowns,
            "lossFrequency": float(np.mean(np.array(endings) < initial)), "drawdownThresholdFrequency": float(np.mean(np.array(drawdowns) >= threshold)),
            "excessReturnInterval": np.quantile(excesses, [.025, .975]).tolist() if excesses else None,
            "limitations": "Conditional historical simulation, not calibrated future probabilities. Return resampling does not replay orders, sizing, capital constraints or changed costs. Stationary bootstrap assumes weak stationarity; permutations preserve terminal compounded return and destroy order; IID resampling destroys dependence. Open positions are excluded from trade methods and marked in daily account returns."}


def monte_carlo(parent, options, stage):
    if options.get("method", "stationary_daily") == "stationary_daily":
        horizon = options.get("horizon", len(parent.get("dailyReturns", [])))
        simulations = options.get("simulations", 1000)
        if type(horizon) is not int or type(simulations) is not int or horizon*simulations*3 > 10_000_000:
            raise ValueError("Block analysis including two sensitivity runs exceeds ten million sampled observations")
    payload = simulate_returns(parent, options, stage)
    if payload["method"] == "stationary_daily":
        block = payload["blockLength"]
        sensitivity = []
        for length in sorted({max(1, block//2), block*2}):
            try:
                value = simulate_returns(parent, {**options, "blockLength": length}, stage)
                sensitivity.append({"blockLength": length, "lossFrequency": value["lossFrequency"], "excessReturnInterval": value["excessReturnInterval"]})
            except ValueError as error: sensitivity.append({"blockLength": length, "reason": str(error)})
        payload["blockSensitivity"] = sensitivity
    return artifact(parent, "monte_carlo", payload)


def assess(parent, validation=None, holdout_record=None):
    reasons = []
    label = "Insufficient evidence"
    oos = holdout_record["outOfSample"] if holdout_record else None
    if not validation or not holdout_record: reasons.append("Final holdout and chronological validation have not both been completed.")
    elif not parent["config"].get("reserveHoldout"):
        reasons.append("The holdout was already included in the original backtest; it was not reserved before research.")
    elif holdout_record["access"]["count"] > 1: reasons.append("The same historical holdout has been requested more than once.")
    elif validation["causality"]["status"] != "passed_sampled_checks": reasons.append("Sampled prefix-invariance checks failed.")
    elif len(oos["dailyReturns"]) < 60 or oos["closedTrades"] < 30: reasons.append("Fewer than 60 complete out-of-sample daily returns or 30 closed trades.")
    elif oos["netReturn"] <= 0 or oos["excessReturn"] is None or oos["excessReturn"] <= 0:
        label = "No convincing edge detected"
        reasons.append("Out-of-sample net return or benchmark-relative excess return is nonpositive.")
    else:
        label = "Promising but fragile"
        neighbors = validation["neighbors"]
        interval = holdout_record.get("excessReturnInterval")
        gates = {"all_three_walk_forward_folds_profitable": len(validation["walkForward"]) == 3 and all(f["result"]["netReturn"] > 0 for f in validation["walkForward"]),
                 "holdout_excess_positive": (holdout_record["result"]["excessReturn"] or 0) > 0,
                 "stress_profitable": all(s["netReturn"] > 0 for s in validation["stress"].values()),
                 "neighbor_majority_profitable": bool(neighbors) and sum(n.get("result", {}).get("netReturn", -1) > 0 for n in neighbors) > len(neighbors)/2,
                 "not_concentrated": all(oos.get(k) is not None and oos[k] <= .5 for k in ("tradeConcentration", "dayConcentration")),
                 "paired_interval_positive": bool(interval) and interval[0] > 0}
        reasons.extend(f"Screen failed: {key}." for key, value in gates.items() if not value)
        if all(gates.values()): label = "Promising out-of-sample evidence; forward validation required"
    historical = parent["metrics"]["totalReturn"]["value"]
    evidence = "Out-of-sample evidence is unavailable." if not oos else f"Out-of-sample net return is {oos['netReturn']:.2%}, excess return is {oos['excessReturn']:.2%}, with {oos['closedTrades']} closed trades and {len(oos['dailyReturns'])} complete daily returns."
    text = f"{label}. Historical profitability: the original run returned {historical:.2%} after its modeled fees, spread and slippage. That captured evaluation result is descriptive and does not by itself establish repeatability. {evidence} "
    text += "Repeatability and benchmark-relative evidence are screened separately using chronological validation, expanding walk-forward folds, a frozen final holdout, cost and execution-delay stress, parameter neighbors and concentration. "
    text += (reasons[0] if reasons else "All disclosed screening gates passed.") + " "
    text += "Remaining uncertainty: these are conservative, versioned screening rules, not a calibrated probability of alpha or future profitability. The passive price benchmark does not establish risk-adjusted alpha. Synthetic OHLCV execution omits borrowing, margin, liquidation and order-book behavior. Funding and impact are included only when captured in the run configuration, with the limitations in its assumptions. Prefix checks sample only a few cutoffs and cannot certify arbitrary Python against look-ahead bias or external data access. Known local trials do not reveal all prior strategy selection. PBO and Deflated Sharpe are not reported because complete selection-history inputs are unavailable. Forward paper observation with the frozen strategy and realistic execution costs is required before drawing stronger conclusions."
    return {"policyVersion": VERSION, "label": label, "reasons": reasons, "text": text, "screeningNotCalibration": True}


def automatic_health(parent, stage):
    """A disclosed diagnostic screen; never a probability that a strategy will work."""
    reasons, validation, simulation = [], None, None
    try:
        validation = validate_strategy(parent, {}, stage)["payload"]
    except (ValueError, TypeError) as error:
        reasons.append("Walk-forward unavailable: " + str(error))
    closed = [t for t in parent["trades"] if t["status"] == "closed"]
    method = "stationary_daily" if len(parent.get("dailyReturns", [])) >= 60 else "iid_trades"
    try:
        simulation = simulate_returns(parent, {"method": method, "simulations": 500, "seed": parent["config"].get("strategySeed", 42)}, stage)
    except (ValueError, TypeError) as error:
        reasons.append("Monte Carlo unavailable: " + str(error))
    risk, score = "Insufficient evidence", None
    if validation is not None and simulation is not None and len(closed) >= 30:
        folds = validation["walkForward"]
        positive = sum(f["result"]["netReturn"] > 0 for f in folds)
        score = 100 - (3-positive)*20
        if validation["causality"]["status"] == "failed": score = 0; reasons.append("Prefix outputs depend on future data")
        if validation["stress"]["doubleCosts"]["netReturn"] <= 0: score -= 20; reasons.append("Validation loses its edge under doubled fees and configured friction; ATR impact is unchanged")
        if validation["stress"]["extraBarDelay"]["netReturn"] <= 0: score -= 15; reasons.append("Validation loses its edge with one extra bar of delay")
        if simulation["lossFrequency"] >= .5: score -= 20; reasons.append("At least half of the modeled resampled paths finish below initial capital")
        score = max(0, score)
        risk = "Low" if score >= 85 and len(closed) >= 100 else "Medium" if score >= 60 else "High"
        reasons.insert(0, f"{positive}/3 chronological validation folds have positive modeled net return")
    elif len(closed) < 30:
        reasons.append(f"Only {len(closed)} closed trades; at least 30 are required for this screen")
    payload = {"policy": "diagnostic-screen-v1", "risk": risk, "score": score, "reasons": reasons,
               "walkForward": validation["walkForward"] if validation else [], "causality": validation["causality"] if validation else None,
               "monteCarlo": simulation, "monteCarloMethod": method, "closedTrades": len(closed),
               "holdoutEvaluated": False, "calibratedProbability": False,
               "limitations": "Heuristic screening, not a probability of overfitting or profitability. Unknown prior trials and selection/survivorship bias are not observable. These checks never evaluate the final 20%; it is only an untouched holdout if the base run also reserved it. IID trade paths assume independence when fewer than 60 complete days are available."}
    return artifact(parent, "health", payload)


def execute_analysis(request, stage):
    parent, options = request["result"], request.get("options", {})
    if parent.get("researchSchema") != 2: raise ValueError("Rerun with a compatible Helper and synthetic execution schema before research analysis")
    kind = request["kind"]
    if kind == "health": return automatic_health(parent, stage)
    if kind == "validation": return validate_strategy(parent, options, stage)
    if kind == "holdout": return holdout(parent, request["selection"], request["access"], stage)
    if kind == "monte_carlo": return monte_carlo(parent, options, stage)
    if kind == "assessment": return artifact(parent, kind, assess(parent))
    raise ValueError("Unsupported research analysis")
