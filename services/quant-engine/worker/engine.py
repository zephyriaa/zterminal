from __future__ import annotations

import contextlib
import io
import math
import time
import uuid
from typing import Any, Callable, Dict, List, Tuple
import numpy as np
import pandas as pd

from .analytics import compute_metrics
from .limits import ExecutionLimiter


def simulate_positions(
    frame: pd.DataFrame,
    entries: np.ndarray,
    exits: np.ndarray,
    short_entries: np.ndarray,
    short_exits: np.ndarray,
    config: Dict[str, Any],
    limiter: ExecutionLimiter,
) -> Tuple[pd.Series, List[Dict[str, Any]], float]:
    opens = frame["open"].to_numpy(dtype=float)
    closes = frame["close"].to_numpy(dtype=float)
    times = frame.index.values

    initial_capital = float(config.get("initial_capital", 100000.0))
    fee_rate = float(config.get("fee_bps", 2.5)) / 10000.0
    slippage_rate = float(config.get("slippage_bps", 1.0)) / 10000.0
    multiplier = float(config.get("multiplier", 1.0))
    step = float(config.get("quantity_step", 0.001))
    allocation = float(config.get("allocation", 1.0))

    account = initial_capital
    position = None
    exposure_bars = 0
    equity_values: List[float] = []
    trades: List[Dict[str, Any]] = []

    for i in range(len(frame)):
        if i % 1000 == 0:
            limiter.check()

        open_price = opens[i]
        close_price = closes[i]

        # 1. Check existing position exit
        if position is not None:
            wants_exit = exits[i] if position["side"] == "long" else short_exits[i]
            if wants_exit:
                direction = 1 if position["side"] == "long" else -1
                exit_price = open_price * (1.0 - slippage_rate * direction)
                exit_fee = abs(exit_price * position["qty"] * multiplier) * fee_rate
                pnl = direction * (exit_price - position["entry_price"]) * position["qty"] * multiplier - position["entry_fee"] - exit_fee
                account += pnl

                exit_time_ms = int(times[i].astype("datetime64[ms]").astype(int))
                trades.append({
                    "id": str(len(trades) + 1),
                    "side": position["side"],
                    "entryTime": position["entry_time"],
                    "exitTime": exit_time_ms,
                    "entryPrice": float(position["entry_price"]),
                    "exitPrice": float(exit_price),
                    "quantity": float(position["qty"]),
                    "pnl": float(pnl),
                    "fees": float(position["entry_fee"] + exit_fee),
                    "status": "closed",
                })
                position = None

        # 2. Check entry
        if position is None and (entries[i] or short_entries[i]):
            side = "long" if entries[i] else "short"
            direction = 1 if side == "long" else -1
            entry_price = open_price * (1.0 + slippage_rate * direction)
            raw_qty = (account * allocation) / (entry_price * multiplier * (1.0 + fee_rate))
            qty = math.floor((raw_qty + step * 1e-9) / step) * step

            if qty >= step:
                entry_fee = abs(entry_price * qty * multiplier) * fee_rate
                entry_time_ms = int(times[i].astype("datetime64[ms]").astype(int))
                position = {
                    "side": side,
                    "entry_time": entry_time_ms,
                    "entry_price": entry_price,
                    "qty": qty,
                    "entry_fee": entry_fee,
                }

        # 3. Update bar equity
        if position is None:
            equity_values.append(account)
        else:
            exposure_bars += 1
            direction = 1 if position["side"] == "long" else -1
            unrealized = direction * (close_price - position["entry_price"]) * position["qty"] * multiplier - position["entry_fee"]
            equity_values.append(account + unrealized)

    # 4. Mark remaining open position at end
    if position is not None:
        direction = 1 if position["side"] == "long" else -1
        final_price = closes[-1]
        pnl = direction * (final_price - position["entry_price"]) * position["qty"] * multiplier - position["entry_fee"]
        trades.append({
            "id": str(len(trades) + 1),
            "side": position["side"],
            "entryTime": position["entry_time"],
            "exitTime": None,
            "entryPrice": float(position["entry_price"]),
            "exitPrice": float(final_price),
            "quantity": float(position["qty"]),
            "pnl": float(pnl),
            "fees": float(position["entry_fee"]),
            "status": "open",
        })

    equity = pd.Series(equity_values, index=frame.index, dtype=float)
    exposure = exposure_bars / max(1, len(frame))
    return equity, trades, exposure


def execute_quant_backtest(
    source: str,
    bars: List[Dict[str, Any]],
    config: Dict[str, Any],
    params: Dict[str, Any],
    limiter: ExecutionLimiter,
) -> Dict[str, Any]:
    limiter.check()

    if len(bars) == 0:
        raise ValueError("Cannot run backtest on empty bar dataset")

    # Load dataframe
    frame = pd.DataFrame(bars)
    if "t" in frame.columns:
        frame.index = pd.to_datetime(frame.pop("t"), unit="ms", utc=True)
    elif "timestamp" in frame.columns:
        frame.index = pd.to_datetime(frame.pop("timestamp"), unit="ms", utc=True)
    else:
        frame.index = pd.date_range(start="2025-01-01", periods=len(frame), freq="5min", tz="UTC")

    for col in ("open", "high", "low", "close", "volume"):
        if col not in frame.columns:
            # Map shorthand o, h, l, c, v if needed
            short_col = col[0]
            if short_col in frame.columns:
                frame[col] = frame.pop(short_col)
            else:
                frame[col] = 100.0
        frame[col] = frame[col].astype(float)

    limiter.check()

    # Compile user strategy code
    code = compile(source, "strategy.py", "exec")
    namespace: Dict[str, Any] = {"__name__": "zterminal_user_strategy"}
    stdout_buf = io.StringIO()

    with contextlib.redirect_stdout(stdout_buf), contextlib.redirect_stderr(stdout_buf):
        exec(code, namespace)

    strategy_fn = namespace.get("strategy") or namespace.get("calculate")
    if not callable(strategy_fn):
        raise ValueError("Strategy source must define strategy(data, params) or calculate(data, params)")

    raw_output = strategy_fn(frame.copy(deep=True), dict(params))

    def to_signal_array(val: Any) -> np.ndarray:
        if isinstance(val, (pd.Series, list, tuple, np.ndarray)):
            arr = np.array(val, dtype=bool)
            if arr.ndim == 1 and len(arr) == len(frame):
                return arr
        return np.zeros(len(frame), dtype=bool)

    # Extract signals
    if hasattr(raw_output, "entries"):
        entries = to_signal_array(getattr(raw_output, "entries", None))
        exits = to_signal_array(getattr(raw_output, "exits", None))
        short_entries = to_signal_array(getattr(raw_output, "short_entries", None))
        short_exits = to_signal_array(getattr(raw_output, "short_exits", None))
    elif isinstance(raw_output, dict):
        entries = to_signal_array(raw_output.get("entries"))
        exits = to_signal_array(raw_output.get("exits"))
        short_entries = to_signal_array(raw_output.get("short_entries"))
        short_exits = to_signal_array(raw_output.get("short_exits"))
    else:
        raise TypeError("Strategy output must be an object with entries and exits Series or dict")

    # Shift signals by 1 bar to prevent lookahead bias
    entries = np.r_[False, entries[:-1]] if len(entries) > 0 else entries
    exits = np.r_[False, exits[:-1]] if len(exits) > 0 else exits
    short_entries = np.r_[False, short_entries[:-1]] if len(short_entries) > 0 else short_entries
    short_exits = np.r_[False, short_exits[:-1]] if len(short_exits) > 0 else short_exits

    # Run deterministic simulation
    equity, trades, exposure = simulate_positions(
        frame, entries, exits, short_entries, short_exits, config, limiter
    )

    from_ms = int(frame.index[0].value // 1_000_000)
    to_ms = int(frame.index[-1].value // 1_000_000)
    initial_cap = float(config.get("initial_capital", 100000.0))
    metrics = compute_metrics(equity, initial_cap, trades, from_ms, to_ms, exposure)

    equity_points = [
        {"time": int(t.value // 1_000_000), "equity": float(eq)}
        for t, eq in equity.items()
    ]

    return {
        "result_id": str(uuid.uuid4()),
        "metrics": metrics,
        "trades": trades,
        "equity_curve": equity_points,
        "exposure": exposure,
        "bars_processed": len(frame),
        "logs": stdout_buf.getvalue().splitlines()[:100],
    }
