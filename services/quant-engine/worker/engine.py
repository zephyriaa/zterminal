from __future__ import annotations

import contextlib
import io
import math
import time
import uuid
from typing import Any, Dict, List, Tuple
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

    started = time.perf_counter()
    frame = pd.DataFrame(bars)
    timestamp = "t" if "t" in frame else "timestamp"
    if timestamp not in frame:
        raise ValueError("Bars require millisecond timestamps")
    frame.index = pd.to_datetime(frame.pop(timestamp), unit="ms", utc=True)
    if frame.index.hasnans or not frame.index.is_monotonic_increasing or not frame.index.is_unique:
        raise ValueError("Bar timestamps must be unique and increasing")
    for col in ("open", "high", "low", "close", "volume"):
        if col not in frame and col[0] in frame:
            frame[col] = frame.pop(col[0])
        if col not in frame:
            raise ValueError(f"Missing bar column: {col}")
        frame[col] = frame[col].astype(float)
    prices = frame[["open", "high", "low", "close"]]
    if (not np.isfinite(frame[["open", "high", "low", "close", "volume"]]).all().all()
            or (prices <= 0).any().any() or (frame.volume < 0).any()
            or (frame.high < prices.max(axis=1)).any() or (frame.low > prices.min(axis=1)).any()):
        raise ValueError("Invalid OHLCV bars")
    for name, default, maximum in [
        ("initial_capital", 100000, math.inf), ("quantity_step", .001, math.inf),
        ("multiplier", 1, math.inf), ("allocation", 1, 1),
        ("fee_bps", 2.5, 10000), ("slippage_bps", 1, 9999)]:
        value = config.get(name, default)
        if (isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value)
                or value < 0 or value > maximum or value == 0 and name not in ("fee_bps", "slippage_bps")):
            raise ValueError(f"Invalid execution setting: {name}")
    direction = config.get("direction", "both")
    if direction not in ("long", "short", "both"):
        raise ValueError("Invalid direction")
    if any(isinstance(value, (list, tuple, np.ndarray)) for value in params.values()):
        raise ValueError("Parameter grids require cross-validation, which is unavailable")

    limiter.check()
    namespace = {"pd": pd, "np": np}
    output = io.StringIO()
    with contextlib.redirect_stdout(output):
        exec(compile(source, "<strategy>", "exec"), namespace)
        strategy = namespace.get("strategy")
        if not callable(strategy):
            raise ValueError("Source must define strategy(data, params)")
        signals = strategy(frame.copy(), dict(params))
    limiter.check()
    if not isinstance(signals, dict):
        raise ValueError("Strategy must return a signal dictionary")
    shifted = []
    for name in ("entries", "exits", "short_entries", "short_exits"):
        signal = signals.get(name, np.zeros(len(frame), dtype=bool))
        if isinstance(signal, pd.Series) and not signal.index.equals(frame.index):
            raise ValueError(f"Misaligned signal: {name}")
        values = np.asarray(signal)
        if values.shape != (len(frame),) or values.dtype != np.dtype(bool):
            raise ValueError(f"Signal must be an aligned boolean vector: {name}")
        shifted.append(np.r_[False, values[:-1]])
    if direction == "long": shifted[2][:] = False
    if direction == "short": shifted[0][:] = False
    equity, trades, exposure = simulate_positions(frame, *shifted, config, limiter)
    limiter.check()
    times = frame.index.as_unit("ms").asi8
    return {
        "result_id": str(uuid.uuid4()), "execution_model": "bar_next_open_v1",
        "metrics": compute_metrics(equity, float(config.get("initial_capital", 100000)),
                                   trades, int(times[0]), int(times[-1]), exposure),
        "equity_curve": [{"t": int(t), "equity": float(value)} for t, value in zip(times, equity)],
        "trades": trades, "bars_processed": len(frame), "stdout": output.getvalue(),
        "elapsed_ms": (time.perf_counter() - started) * 1000,
    }
