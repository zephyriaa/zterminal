"""Private local engine. This module executes user code with the user's permissions.

Only the controller may launch it; it never runs in Next.js or Render.
"""
import contextlib
import hashlib
import io
import json
import math
import platform
from importlib.metadata import version as package_version
import time
import traceback
import uuid
import random
from decimal import Decimal, ROUND_FLOOR, ROUND_CEILING

import numpy as np
import pandas as pd
import rfc8785
import zterminal as zt
import analytics

from validation import validate, digest, input_record, INDICATOR_ENGINE_VERSION

VERSION = "1.3.0"
INDICATOR_VERSION = INDICATOR_ENGINE_VERSION

class BoundedLog(io.StringIO):
    def write(self, value):
        remaining = max(0, 32_768 - self.tell())
        super().write(value[:remaining])
        return len(value)


def simulate(frame, signals, config, evidence=None):
    """One-position account; v2 reserves notional for both synthetic directions."""
    le, lx, se, sx = (s.to_numpy(dtype=bool) for s in signals)
    modern = config.get("executionModel") == "synthetic_next_open_v2"
    D = lambda value: Decimal(str(value))
    fee_rate, slip = D(config["feeBps"]) / 10000, D(config["slippageBps"]) / 10000
    spread = D(config.get("spreadBps", 0)) / 20000 if modern else D(0)
    multiplier, step = D(config["multiplier"]), D(config["quantityStep"])
    tick = D(config["tickSize"]) if modern else D(0)
    cash, reserved, realized, fees = D(config["initialCapital"]), D(0), D(0), D(0)
    position, exposure = None, 0
    equity_values, trades, states, orders, fills = [], [], [], [], []
    delay = config.get("executionDelayBars", 1)
    warmup = config.get("warmupBars", 0)
    evaluation_from = config.get("evaluationFrom", config["from"])

    def price(base, buy):
        adjusted = base * (1 + (slip + spread) * (1 if buy else -1))
        return (adjusted / tick).to_integral_value(rounding=ROUND_CEILING if buy else ROUND_FLOOR) * tick if tick else adjusted

    def record(i, side, action, status, reason, quantity=D(0), base=None, execution=None, cost=D(0), requested=None):
        now = int(frame.index[i].value // 1_000_000)
        decision_index = i - delay
        order = {"id": str(len(orders)), "side": side, "action": action, "type": "market", "status": status, "reason": reason,
                 "decisionTime": int(frame.index[decision_index].value // 1_000_000) if decision_index >= 0 else None,
                 "eligibleTime": now, "quantity": float(quantity), "requestedQuantity": float(quantity if requested is None else requested)}
        if reason == "split_boundary": order["decisionTime"] = now
        orders.append(order)
        if status == "filled":
            buy = (side == "long") == (action == "entry")
            sign = 1 if buy else -1
            slip_adjustment, spread_adjustment = base*slip*sign, base*spread*sign
            fills.append({**order, "orderId": order["id"], "basePrice": float(base), "price": float(execution), "fee": float(cost),
                          "slippageBps": float(slip * 10000), "spreadBps": float(spread * 20000), "tickSize": float(tick),
                          "priceAdjustment": float(execution - base), "multiplier": float(multiplier),
                          "slippageCost": float(abs(slip_adjustment)*quantity*multiplier), "spreadCost": float(abs(spread_adjustment)*quantity*multiplier),
                          "tickRoundingCost": float(abs(execution-base-slip_adjustment-spread_adjustment)*quantity*multiplier)})

    def close(i, base, reason):
        nonlocal cash, reserved, realized, fees, position
        direction = 1 if position["side"] == "long" else -1
        execution = price(base, direction == -1)
        exit_fee = execution * position["quantity"] * multiplier * fee_rate
        gross = direction * (execution - position["price"]) * position["quantity"] * multiplier
        pnl = gross - position["fee"] - exit_fee
        cash += reserved + gross - exit_fee
        reserved = D(0)
        realized += gross
        fees += exit_fee
        entry_value = position["price"] * position["quantity"] * multiplier + position["fee"]
        trades.append({"id": str(len(trades)), "side": position["side"], "entryTime": position["time"], "exitTime": int(frame.index[i].value // 1_000_000),
                       "entryPrice": float(position["price"]), "exitPrice": float(execution), "quantity": float(position["quantity"]), "pnl": float(pnl),
                       "return": float(pnl / entry_value), "accountReturn": float(pnl / position["account"]) if position["account"] > 0 else None,
                       "fees": float(position["fee"] + exit_fee), "status": "closed", "exitReason": reason})
        record(i, position["side"], "exit", "filled", reason, position["quantity"], base, execution, exit_fee)
        position = None

    for i, row in enumerate(frame.itertuples()):
        base, mark = D(row.open), D(row.close)
        now = int(frame.index[i].value // 1_000_000)
        eligible = i - delay >= warmup and i >= delay and int(frame.index[i-delay].value // 1_000_000) >= evaluation_from
        if position and eligible and (lx[i] if position["side"] == "long" else sx[i]):
            close(i, base, "strategy_signal")
        elif eligible:
            for requested, side in ((lx[i], "long"), (sx[i], "short")):
                if requested: record(i, side, "exit", "ignored", "no_matching_open_position")
        for requested, side in ((le[i], "long"), (se[i], "short")):
            if not requested: continue
            if not eligible:
                record(i, side, "entry", "rejected", "warmup_or_split_boundary")
                continue
            if position:
                record(i, side, "entry", "ignored", "position_already_open_no_pyramiding_or_reversal")
                continue
            execution = price(base, side == "long")
            if execution <= 0:
                record(i, side, "entry", "rejected", "nonpositive_execution_price")
                continue
            budget = max(D(0), cash) * D(config["allocation"])
            raw_quantity = budget / (execution * multiplier * (1 + fee_rate))
            quantity = (raw_quantity / step).to_integral_value(rounding=ROUND_FLOOR) * step
            notional = quantity * execution * multiplier
            entry_fee = notional * fee_rate
            if quantity < D(config.get("minimumQuantity", step)) or quantity <= 0 or notional < D(config.get("minimumNotional", 0)) or cash <= 0 or notional + entry_fee > cash:
                reason = "nonpositive_equity" if cash <= 0 else "insufficient_cash_after_rounding" if quantity <= 0 or notional+entry_fee > cash else "below_minimum_quantity" if quantity < D(config.get("minimumQuantity", step)) else "below_minimum_notional"
                record(i, side, "entry", "rejected", reason, quantity, requested=raw_quantity)
                continue
            account = cash
            cash -= notional + entry_fee
            reserved = notional
            fees += entry_fee
            position = {"side": side, "time": now, "price": execution, "quantity": quantity, "fee": entry_fee, "account": account}
            record(i, side, "entry", "filled", "strategy_signal", quantity, base, execution, entry_fee, raw_quantity)
        if position:
            exposure += 1
            if config.get("closeAtEnd") and i == len(frame) - 1:
                close(i, mark, "split_boundary")
        unrealized = (1 if position["side"] == "long" else -1) * (mark - position["price"]) * position["quantity"] * multiplier if position else D(0)
        equity = cash + reserved + unrealized
        equity_values.append(float(equity))
        states.append({"time": now, "cash": float(cash), "reservedCapital": float(reserved), "holdings": float(position["quantity"] * (1 if position["side"] == "long" else -1)) if position else 0,
                       "realizedPnl": float(realized), "unrealizedPnl": float(unrealized), "fees": float(fees), "equity": float(equity)})
    if position:
        mark = D(frame.close.iloc[-1])
        pnl = (1 if position["side"] == "long" else -1) * (mark - position["price"]) * position["quantity"] * multiplier - position["fee"]
        entry_value = reserved + position["fee"]
        trades.append({"id": str(len(trades)), "side": position["side"], "entryTime": position["time"], "exitTime": None,
                       "entryPrice": float(position["price"]), "exitPrice": float(mark), "quantity": float(position["quantity"]), "pnl": float(pnl),
                       "return": float(pnl / entry_value), "accountReturn": float(pnl / position["account"]) if position["account"] > 0 else None,
                       "fees": float(position["fee"]), "status": "open"})
    if evidence is not None:
        evidence.update(accounts=states, orders=orders, fills=fills)
    equity = pd.Series(equity_values, index=frame.index, dtype=float)
    if not np.isfinite(equity.to_numpy()).all(): raise ValueError("Simulation produced non-finite equity")
    return equity, trades, exposure / len(frame)


def resolve_parameters(declared, supplied):
    if not isinstance(declared, dict) or len(declared) > 50 or any(not isinstance(spec, zt.InputSpec) for spec in declared.values()):
        raise ValueError("PARAMETERS must map names to SDK input declarations")
    if declared and set(supplied) - set(declared): raise ValueError("Undeclared strategy parameters")
    resolved = dict(supplied)
    for name, spec in declared.items():
        value = supplied.get(name, spec.default)
        valid = {"integer": type(value) is int, "number": type(value) in (int, float), "boolean": type(value) is bool, "string": isinstance(value, str)}.get(spec.kind, False)
        if not valid or isinstance(value, (int, float)) and not isinstance(value, bool) and not math.isfinite(value): raise ValueError(f"Invalid parameter {name}")
        if spec.minimum is not None and value < spec.minimum or spec.maximum is not None and value > spec.maximum: raise ValueError(f"Parameter {name} outside declared constraints")
        resolved[name] = value
    return resolved


def execute(request, stage=lambda value: None):
    stage("validating")
    interval = validate(request)
    code = compile(request["source"], "strategy.py", "exec")
    stage("loading_data")
    config, dataset = request["config"], request["dataset"]
    if config.get("executionModel") == "synthetic_next_open_v2":
        seed = config.get("strategySeed", 42)
        random.seed(seed)
        np.random.seed(seed)
    frame = pd.DataFrame(dataset["bars"]).rename(columns={"o": "open", "h": "high", "l": "low", "c": "close", "v": "volume"})
    frame.index = pd.to_datetime(frame.pop("t"), unit="ms", utc=True)
    # A stable numeric dtype avoids recompiling vectorbt kernels for integer OHLC fixtures.
    frame = frame.astype("float64")
    if config.get("executionModel") == "synthetic_next_open_v2" and config.get("reserveHoldout"):
        frame = frame.iloc[:int(len(frame)*.8)]
        if len(frame) < 2: raise ValueError("Reserve holdout requires more history")
    effective_to = int(frame.index[-1].value // 1_000_000) + interval
    # Retain engine-owned values: user code may mutate only its own copy.
    namespace = {"__name__": "zterminal_user_strategy", "__file__": "strategy.py"}
    capture = BoundedLog()
    stage("running_strategy")
    with contextlib.redirect_stdout(capture), contextlib.redirect_stderr(capture):
        exec(code, namespace)
        if not callable(namespace.get("strategy")):
            raise ValueError("Define strategy(data, params) returning zterminal.Strategy")
        declared = namespace.get("PARAMETERS", {})
        params = resolve_parameters(declared, request.get("params", {}))
        strategy = namespace["strategy"](frame.copy(deep=True), params)
    if not isinstance(strategy, zt.Strategy):
        raise TypeError("Unsupported output: strategy must return zterminal.Strategy; no strategy is substituted")

    def signal(value, name, optional=False):
        if value is None and optional:
            return pd.Series(False, index=frame.index)
        if not isinstance(value, pd.Series) or not value.index.equals(frame.index) or not pd.api.types.is_bool_dtype(value.dtype) or value.isna().any():
            raise ValueError(f"{name} must be a boolean Series aligned to data.index, without missing values")
        return value.astype(bool)

    if any(key in vars(strategy) for key in ("orders", "stop", "limit", "stop_loss", "take_profit", "bracket")):
        raise ValueError("Only next-open market signals are supported; stop, limit and bracket orders are unsupported")
    le, lx = signal(strategy.entries, "entries"), signal(strategy.exits, "exits")
    se, sx = signal(strategy.short_entries, "short_entries", True), signal(strategy.short_exits, "short_exits", True)
    if (le & se).any() or (le & lx).any() or (se & sx).any():
        raise ValueError("Conflicting entry/exit or direction signals on the same bar")
    if config["direction"] == "long" and (se.any() or sx.any()):
        raise ValueError("Short signals require the Long + short direction setting")
    if not isinstance(strategy.plots, dict) or len(strategy.plots) > 12:
        raise ValueError("At most 12 named plots are supported")
    plots = {}
    for name, values in strategy.plots.items():
        if not isinstance(name, str) or not 0 < len(name) <= 80 or not isinstance(values, pd.Series) or not values.index.equals(frame.index) or not pd.api.types.is_numeric_dtype(values.dtype):
            raise ValueError("Plots must be named numeric Series aligned to data.index")
        if np.isinf(values.to_numpy(dtype=float)).any():
            raise ValueError("Plots cannot contain infinity")
        plots[name] = [{"time": int(t.value // 1_000_000), "value": float(v)} for t, v in values.items() if pd.notna(v)]

    stage("calculating_report")
    # All signals move one full bar. Final-bar signals have no manufactured fill.
    shifted = [s.shift(config.get("executionDelayBars", 1), fill_value=False) for s in (le, lx, se, sx)]
    evidence = {}
    equity, trades, exposure = simulate(frame, shifted, config, evidence)
    evaluation_from = config.get("evaluationFrom", config["from"])
    scoring_equity = equity[equity.index >= pd.Timestamp(evaluation_from, unit="ms", tz="UTC")]
    metrics, _, drawdowns, monthly, observations = analytics.report(scoring_equity, config["initialCapital"], trades, evaluation_from, effective_to, exposure)
    dd = 1 - equity / np.maximum.accumulate(np.r_[config["initialCapital"], equity.to_numpy()])[1:]
    # Passive price-only benchmark: starts at the first available open, same dataset.
    benchmark_open = frame.open.loc[scoring_equity.index[0]]
    benchmark = config["initialCapital"] * frame.close / benchmark_open
    if config.get("executionModel") == "synthetic_next_open_v2":
        d = lambda value: Decimal(str(value))
        tick, step = d(config["tickSize"]), d(config["quantityStep"])
        costs = (d(config["slippageBps"])+d(config["spreadBps"])/2)/10000
        rate, mult, initial = d(config["feeBps"])/10000, d(config["multiplier"]), d(config["initialCapital"])
        buy = (d(benchmark_open)*(1+costs)/tick).to_integral_value(rounding=ROUND_CEILING)*tick
        quantity = (initial/(buy*mult*(1+rate))/step).to_integral_value(rounding=ROUND_FLOOR)*step
        if quantity < d(config["minimumQuantity"]) or quantity*buy*mult < d(config["minimumNotional"]):
            quantity = d(0)
        cash_left = initial-quantity*buy*mult*(1+rate)
        benchmark = pd.Series([float(cash_left+quantity*d(value)*mult) for value in frame.close], index=frame.index)
        if config.get("closeAtEnd"):
            sell = (d(frame.close.iloc[-1])*(1-costs)/tick).to_integral_value(rounding=ROUND_FLOOR)*tick
            benchmark.iloc[-1] = float(cash_left+quantity*sell*mult*(1-rate))
    result = {"version": 1, "id": str(uuid.uuid4()), "createdAt": int(time.time() * 1000),
              "name": str(request.get("name", "Untitled"))[:120], "source": request["source"],
              "sourceHash": hashlib.sha256(request["source"].encode()).hexdigest(), "inputHash": digest(input_record(request)),
              "engine": {"engine": VERSION, "python": platform.python_version(), "vectorbt": package_version("vectorbt"), "sdk": zt.__version__, "analytics": analytics.VERSION},
              "config": config, "params": request.get("params", {}), "resolvedParams": params, "dataset": dataset, "metrics": metrics, "trades": trades, "plots": plots,
              "equity": [{"time": int(t.value // 1_000_000), "equity": float(v), "drawdown": float(d), "benchmark": float(b)} for t, v, d, b in zip(equity.index, equity, dd, benchmark)],
              "monthly": monthly, "drawdowns": drawdowns, "observations": observations,
              "logs": capture.getvalue().splitlines(),
              "assumptions": ["Completed-bar signals fill at the following open; final-bar signals remain unfilled.",
                              "One position; no pyramiding or reversal. Opposite entries while holding are ignored.",
                              "Allocation is a fraction of available unlevered cash; quantities are rounded down to the specified step.",
                              "Prices are multiplied by the instrument multiplier for contract accounting.",
                              "Open positions are marked to the final close and excluded from closed-trade statistics.",
                              "Funding, liquidation, leveraged margin and market impact are unmodeled.",
                              "Benchmark is passive price return from the first open, before costs.",
                              "Risk ratios use complete UTC daily returns, a 365-day crypto calendar and zero risk-free/target return.",
                              "User code can introduce look-ahead bias; the engine shifts signals but cannot validate the logic of arbitrary Python."]}
    if dataset.get("version") == 2:
        result["context"] = request["context"]
        result["assumptions"].extend([
            "Local CSV spot cash model v1: long only, unit multiplier, no short selling or leverage.",
            "Retained CSV hashes establish stored identity, not exchange authenticity.",
            "Fill prices apply proportional slippage; tick size is recorded but does not round simulated fills."])
    if config.get("executionModel") == "synthetic_next_open_v2":
        result.update(researchSchema=2, **evidence)
        result["seeds"] = {"pythonRandom": config.get("strategySeed", 42), "numpyLegacy": config.get("strategySeed", 42), "limitation": "User-created generators and external nondeterminism must be seeded by strategy code."}
        if "instrument" in request: result["instrument"] = request["instrument"]
        result["dailyReturns"] = analytics.daily_returns(scoring_equity, config["initialCapital"], evaluation_from, effective_to)
        result["benchmarkDailyReturns"] = analytics.daily_returns(benchmark.loc[scoring_equity.index], config["initialCapital"], evaluation_from, effective_to)
        result["engine"]["helper"] = "1.1.0-preview.1"
        result["quality"] = {"status": "complete", "requestedBars": len(frame), "actualBars": len(frame), "findings": [], "actualFrom": int(frame.index[0].value // 1_000_000), "actualTo": config["to"], "executionTo": effective_to, "holdoutReserved": bool(config.get("reserveHoldout"))}
        result["assumptions"] = ["Synthetic unlevered long/short OHLCV research; provider perpetual prices do not model perpetual execution.",
            "Free cash plus reserved entry notional plus unrealized P&L equals equity; short proceeds are unavailable.",
            "Market signals only. No stops, targets, limit orders, pyramiding, borrowing, funding or liquidation.",
            "Completed-bar signals execute after the captured delay at an eligible open; warm-up bars cannot trade.",
            "Passive benchmark allocates all capital to buy-and-hold, applying identical entry costs and quantity rules; segment close costs apply when positions close at boundaries.",
            "Spread is half per side, separate from slippage; prices round adversely to tick and quantities down to step.",
            "Arbitrary trusted Python can access files/network and introduce look-ahead bias; this is not a security sandbox."]
        benchmark_return = float(benchmark.iloc[-1] / config["initialCapital"] - 1)
        metrics.update(benchmarkReturn=analytics.metric(benchmark_return), excessReturn=analytics.metric(metrics["totalReturn"]["value"] - benchmark_return),
                       fees=analytics.metric(evidence["accounts"][-1]["fees"]), turnover=analytics.metric(sum(fill["price"] * fill["quantity"] * config["multiplier"] for fill in evidence["fills"]) / config["initialCapital"]))
        for key in ("slippageCost", "spreadCost", "tickRoundingCost"):
            metrics[key] = analytics.metric(sum(fill[key] for fill in evidence["fills"]))
        from research_analysis import assess
        result["assessment"] = assess(result)
        result["evidenceHash"] = digest({k: v for k, v in result.items() if k not in ("id", "createdAt")})
    result["resultHash"] = digest(result)
    return result


def execute_indicator(request, stage=lambda value: None):
    """Evaluate one immutable indicator revision against exactly the supplied dataset."""
    stage("validating")
    validate(request)
    captured_input = input_record({**request, "operation": "indicator"})
    artifact = request.get("artifact")
    if not isinstance(artifact, dict) or artifact.get("kind") != "indicator" or not isinstance(artifact.get("id"), str) or not isinstance(artifact.get("revision"), int):
        raise ValueError("Indicator evaluation requires an immutable indicator artifact revision")
    source = request["source"]
    code = compile(source, "indicator.py", "exec")
    stage("loading_data")
    dataset = request["dataset"]
    frame = pd.DataFrame(dataset["bars"]).rename(columns={"o": "open", "h": "high", "l": "low", "c": "close", "v": "volume"})
    frame.index = pd.to_datetime(frame.pop("t"), unit="ms", utc=True)
    frame = frame.astype("float64")
    namespace = {"__name__": "zterminal_user_indicator", "__file__": "indicator.py"}
    capture = BoundedLog()
    stage("running_strategy")
    with contextlib.redirect_stdout(capture), contextlib.redirect_stderr(capture):
        exec(code, namespace)
        calculate = namespace.get("calculate") or namespace.get("indicator")
        if not callable(calculate):
            raise ValueError("Define calculate(data, params) returning named aligned outputs")
        declared = namespace.get("PARAMETERS", {})
        if not isinstance(declared, dict) or len(declared) > 50 or any(not isinstance(name, str) or not 0 < len(name) <= 80 or not isinstance(spec, zt.InputSpec) for name, spec in declared.items()):
            raise ValueError("PARAMETERS must map bounded names to zterminal.input declarations")
        supplied = dict(request.get("params", {}))
        unknown = set(supplied) - set(declared) if declared else set()
        if unknown:
            raise ValueError(f"Undeclared indicator parameters: {', '.join(sorted(unknown))}")
        resolved, parameter_schema = {}, {}
        for name, spec in declared.items():
            value = supplied.get(name, spec.default)
            if spec.kind == "integer" and (isinstance(value, bool) or not isinstance(value, int)):
                raise ValueError(f"{name} must be an integer")
            if spec.kind == "number" and (isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value)):
                raise ValueError(f"{name} must be a finite number")
            if spec.kind == "boolean" and not isinstance(value, bool) or spec.kind == "string" and not isinstance(value, str):
                raise ValueError(f"{name} has the wrong parameter type")
            if spec.minimum is not None and value < spec.minimum or spec.maximum is not None and value > spec.maximum:
                raise ValueError(f"{name} is outside its declared range")
            resolved[name] = value
            parameter_schema[name] = {"kind": spec.kind, "default": spec.default, "minimum": spec.minimum, "maximum": spec.maximum}
        raw = calculate(frame.copy(deep=True), resolved if declared else supplied)
    if isinstance(raw, zt.Indicator):
        raw = raw.outputs
    if not isinstance(raw, dict) or not 0 < len(raw) <= 12:
        raise TypeError("Indicator must return 1 to 12 named outputs")
    definitions = request.get("outputs", {})
    if not isinstance(definitions, dict):
        raise ValueError("Indicator output definitions must be an object")
    outputs = {}
    for name, values in raw.items():
        if not isinstance(name, str) or not 0 < len(name) <= 80:
            raise ValueError("Indicator output names must be bounded strings")
        if isinstance(values, (list, tuple, np.ndarray)):
            values = pd.Series(values, index=frame.index if len(values) == len(frame) else None)
        if not isinstance(values, pd.Series) or not values.index.equals(frame.index) or not pd.api.types.is_numeric_dtype(values.dtype):
            raise ValueError(f"Output {name} must be a numeric Series aligned to data.index")
        numeric = values.to_numpy(dtype=float)
        if np.isinf(numeric).any():
            raise ValueError(f"Output {name} cannot contain infinity")
        style = definitions.get(name, {})
        plot = style.get("plot", "line") if isinstance(style, dict) else "line"
        if plot not in ("line", "histogram", "area", "marker", "level", "background"):
            raise ValueError(f"Unsupported plot type for {name}")
        outputs[name] = {"plot": plot, "points": [{"time": int(timestamp.value // 1_000_000), "value": float(value)} for timestamp, value in values.items() if pd.notna(value)]}
    source_hash = hashlib.sha256(source.encode()).hexdigest()
    params = resolved if declared else request.get("params", {})
    input_hash = digest(captured_input)
    result = {"version": 1, "kind": "indicator_evaluation", "id": str(uuid.uuid4()), "createdAt": int(time.time() * 1000), "artifact": {"id": artifact["id"], "revision": artifact["revision"], "name": str(artifact.get("name", "Untitled"))[:120]}, "sourceHash": source_hash, "datasetHash": dataset["hash"], "dataset": dataset, "input": captured_input, "inputHash": input_hash, "params": params, "parameters": parameter_schema, "outputs": outputs, "diagnostics": [], "logs": capture.getvalue().splitlines(), "engine": {"indicator": INDICATOR_VERSION, "helper": VERSION, "python": platform.python_version(), "sdk": zt.__version__}}
    result["resultHash"] = digest(result)
    return result


def diagnostic(error):
    result = {"message": f"{type(error).__name__}: {error}"}
    if isinstance(error, SyntaxError):
        result.update(line=error.lineno, column=error.offset)
    else:
        frames = [f for f in traceback.extract_tb(error.__traceback__) if f.filename == "strategy.py"]
        if frames:
            result["line"] = frames[-1].lineno
    return result
