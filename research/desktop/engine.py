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


def diagnostic(error):
    result = {"message": f"{type(error).__name__}: {error}"}
    if isinstance(error, SyntaxError):
        result.update(line=error.lineno, column=error.offset)
    else:
        frames = [f for f in traceback.extract_tb(error.__traceback__) if f.filename == "strategy.py"]
        if frames:
            result["line"] = frames[-1].lineno
    return result
