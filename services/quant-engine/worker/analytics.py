"""
Comprehensive quant statistics calculation for VectorBT and backtesting runs.
"""
from __future__ import annotations

import math
from typing import Any, Dict, List
import numpy as np
import pandas as pd


def metric(value: Any, reason: str = "Undefined for this sample") -> Dict[str, Any]:
    if value is not None and isinstance(value, (int, float)) and math.isfinite(float(value)):
        return {"value": float(value)}
    return {"value": None, "reason": reason}


def compute_metrics(
    equity: pd.Series,
    initial_capital: float,
    trades: List[Dict[str, Any]],
    from_ms: int,
    to_ms: int,
    exposure: float,
) -> Dict[str, Any]:
    values = equity.to_numpy(dtype=float)
    peak = np.maximum.accumulate(np.r_[initial_capital, values])[1:]
    drawdowns = 1.0 - values / peak
    closed = [t for t in trades if t.get("status") == "closed"]
    pnls = np.array([float(t["pnl"]) for t in closed], dtype=float)
    wins = pnls[pnls > 0]
    losses = pnls[pnls < 0]
    days = max(1.0, (to_ms - from_ms) / 86_400_000.0)
    final = float(values[-1]) if len(values) > 0 else initial_capital

    daily = equity.resample("1D").last().dropna()
    returns = daily.pct_change(fill_method=None).dropna()
    valid_risk = len(returns) >= 5 and bool((daily > 0).all())
    std = float(returns.std(ddof=1)) if len(returns) > 1 else 0.0
    downside = float(np.sqrt(np.mean(np.minimum(returns, 0) ** 2))) if len(returns) else 0.0

    cagr = (final / initial_capital) ** (365.25 / days) - 1.0 if days >= 30 and final > 0 else None
    max_dd = float(np.max(drawdowns)) if len(drawdowns) > 0 else 0.0

    sharpe = float(returns.mean()) / std * math.sqrt(365) if valid_risk and std > 0 else None
    sortino = float(returns.mean()) / downside * math.sqrt(365) if valid_risk and downside > 0 else None

    return {
        "totalReturn": metric(final / initial_capital - 1.0),
        "finalEquity": metric(final),
        "netProfit": metric(final - initial_capital),
        "cagr": metric(cagr),
        "maxDrawdown": metric(max_dd),
        "exposure": metric(exposure),
        "sharpe": metric(sharpe),
        "sortino": metric(sortino),
        "volatility": metric(std * math.sqrt(365) if valid_risk else None),
        "calmar": metric(cagr / max_dd if cagr is not None and max_dd > 0 else None),
        "totalTrades": metric(len(closed)),
        "openTrades": metric(len(trades) - len(closed)),
        "winRate": metric(len(wins) / len(closed) if len(closed) > 0 else None),
        "profitFactor": metric(wins.sum() / abs(losses.sum()) if len(losses) > 0 else None),
        "expectancy": metric(float(pnls.mean()) if len(pnls) > 0 else None),
    }
