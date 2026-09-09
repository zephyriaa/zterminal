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

import numpy as np
import pandas as pd
import rfc8785
import zterminal as zt
import analytics

from validation import validate, digest

VERSION = "1.1.0"
INDICATOR_VERSION = "1.0.0"

class BoundedLog(io.StringIO):
    def write(self, value):
        remaining = max(0, 32_768 - self.tell())
        super().write(value[:remaining])
        return len(value)


def simulate(frame, signals, config):
    """Deterministic one-position price simulation; all four signals are already next-bar shifted."""
    le, lx, se, sx = (s.to_numpy(dtype=bool) for s in signals)
    opens, closes = frame.open.to_numpy(), frame.close.to_numpy()
    fee_rate, slip = config["feeBps"] / 10000, config["slippageBps"] / 10000
    multiplier, step = config["multiplier"], config["quantityStep"]
    account, position, exposure = float(config["initialCapital"]), None, 0
    equity_values, trades = [], []
    for i, (open_price, close_price) in enumerate(zip(opens, closes)):
        if position is not None:
            wants_exit = lx[i] if position["side"] == "long" else sx[i]
            if wants_exit:
                direction = 1 if position["side"] == "long" else -1
                exit_price = open_price * (1 - slip * direction)
                exit_fee = abs(exit_price * position["quantity"] * multiplier) * fee_rate
                pnl = direction * (exit_price - position["entryPrice"]) * position["quantity"] * multiplier - position["entryFee"] - exit_fee
                account += pnl
                entry_value = position["entryPrice"] * position["quantity"] * multiplier + position["entryFee"]
                trades.append({"id": str(len(trades)), "side": position["side"], "entryTime": position["entryTime"],
                               "exitTime": int(frame.index[i].value // 1_000_000), "entryPrice": position["entryPrice"],
                               "exitPrice": float(exit_price), "quantity": position["quantity"], "pnl": float(pnl),
                               "return": float(pnl / entry_value), "accountReturn": float(pnl / position["account"]) if position["account"] > 0 else None,
                               "fees": float(position["entryFee"] + exit_fee), "status": "closed"})
                position = None
        # Opposite entries while holding are ignored. Same-direction entries do not pyramid.
        if position is None and (le[i] or se[i]):
            side = "long" if le[i] else "short"
            direction = 1 if side == "long" else -1
            entry_price = open_price * (1 + slip * direction)
            raw_quantity = account * config["allocation"] / (entry_price * multiplier * (1 + fee_rate))
            quantity = math.floor((raw_quantity + step * 1e-12) / step) * step
            if quantity >= step and quantity > 0:
                entry_fee = abs(entry_price * quantity * multiplier) * fee_rate
                position = {"side": side, "entryTime": int(frame.index[i].value // 1_000_000), "entryPrice": float(entry_price),
                            "quantity": float(quantity), "entryFee": float(entry_fee), "account": float(account)}
        if position is None:
            equity_values.append(account)
        else:
            exposure += 1
            direction = 1 if position["side"] == "long" else -1
            equity_values.append(account + direction * (close_price - position["entryPrice"]) * position["quantity"] * multiplier - position["entryFee"])
    if position is not None:
        direction = 1 if position["side"] == "long" else -1
        mark = float(closes[-1])
        pnl = direction * (mark - position["entryPrice"]) * position["quantity"] * multiplier - position["entryFee"]
        entry_value = position["entryPrice"] * position["quantity"] * multiplier + position["entryFee"]
        trades.append({"id": str(len(trades)), "side": position["side"], "entryTime": position["entryTime"], "exitTime": None,
                       "entryPrice": position["entryPrice"], "exitPrice": mark, "quantity": position["quantity"], "pnl": float(pnl),
                       "return": float(pnl / entry_value), "accountReturn": float(pnl / position["account"]) if position["account"] > 0 else None,
                       "fees": position["entryFee"], "status": "open"})
    equity = pd.Series(equity_values, index=frame.index, dtype=float)
    if not np.isfinite(equity.to_numpy()).all():
        raise ValueError("Simulation produced non-finite equity")
    return equity, trades, exposure / len(frame)


def execute(request, stage=lambda value: None):
    stage("validating")
    interval = validate(request)
    code = compile(request["source"], "strategy.py", "exec")
    stage("loading_data")
    config, dataset = request["config"], request["dataset"]
    frame = pd.DataFrame(dataset["bars"]).rename(columns={"o": "open", "h": "high", "l": "low", "c": "close", "v": "volume"})
    frame.index = pd.to_datetime(frame.pop("t"), unit="ms", utc=True)
    # A stable numeric dtype avoids recompiling vectorbt kernels for integer OHLC fixtures.
    frame = frame.astype("float64")
    # Retain engine-owned values: user code may mutate only its own copy.
    namespace = {"__name__": "zterminal_user_strategy", "__file__": "strategy.py"}
    capture = BoundedLog()
    stage("running_strategy")
    with contextlib.redirect_stdout(capture), contextlib.redirect_stderr(capture):
        exec(code, namespace)
        if not callable(namespace.get("strategy")):
            raise ValueError("Define strategy(data, params) returning zterminal.Strategy")
        strategy = namespace["strategy"](frame.copy(deep=True), dict(request.get("params", {})))
    if not isinstance(strategy, zt.Strategy):
        raise TypeError("Unsupported output: strategy must return zterminal.Strategy; no strategy is substituted")

    def signal(value, name, optional=False):
        if value is None and optional:
            return pd.Series(False, index=frame.index)
        if not isinstance(value, pd.Series) or not value.index.equals(frame.index) or not pd.api.types.is_bool_dtype(value.dtype) or value.isna().any():
            raise ValueError(f"{name} must be a boolean Series aligned to data.index, without missing values")
        return value.astype(bool)

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
    shifted = [s.shift(1, fill_value=False) for s in (le, lx, se, sx)]
    equity, trades, exposure = simulate(frame, shifted, config)
    metrics, dd, drawdowns, monthly, observations = analytics.report(equity, config["initialCapital"], trades, config["from"], config["to"], exposure)
    # Passive price-only benchmark: starts at the first available open, same dataset.
    benchmark = config["initialCapital"] * frame.close / frame.open.iloc[0]
    result = {"version": 1, "id": str(uuid.uuid4()), "createdAt": int(time.time() * 1000),
              "name": str(request.get("name", "Untitled"))[:120], "source": request["source"],
              "sourceHash": hashlib.sha256(request["source"].encode()).hexdigest(), "inputHash": digest({"name": str(request.get("name", "Untitled"))[:120], "source": request["source"], "config": config, "params": request.get("params", {}), "dataset": dataset}),
              "engine": {"engine": VERSION, "python": platform.python_version(), "vectorbt": package_version("vectorbt"), "sdk": zt.__version__, "analytics": analytics.VERSION},
              "config": config, "params": request.get("params", {}), "dataset": dataset, "metrics": metrics, "trades": trades, "plots": plots,
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
    result["resultHash"] = digest(result)
    return result


def execute_indicator(request, stage=lambda value: None):
    """Evaluate one immutable indicator revision against exactly the supplied dataset."""
    stage("validating")
    validate(request)
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
    input_hash = digest({"artifactId": artifact["id"], "revision": artifact["revision"], "sourceHash": source_hash, "params": params, "datasetHash": dataset["hash"], "engine": INDICATOR_VERSION})
    result = {"version": 1, "kind": "indicator_evaluation", "id": str(uuid.uuid4()), "createdAt": int(time.time() * 1000), "artifact": {"id": artifact["id"], "revision": artifact["revision"], "name": str(artifact.get("name", "Untitled"))[:120]}, "sourceHash": source_hash, "datasetHash": dataset["hash"], "inputHash": input_hash, "params": params, "parameters": parameter_schema, "outputs": outputs, "diagnostics": [], "logs": capture.getvalue().splitlines(), "engine": {"indicator": INDICATOR_VERSION, "helper": VERSION, "python": platform.python_version(), "sdk": zt.__version__}}
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
