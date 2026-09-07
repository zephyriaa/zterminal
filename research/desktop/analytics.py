"""Versioned analytics. Returns and drawdowns are fractions, times UTC ms."""
import math
import numpy as np
import pandas as pd

VERSION = "1.0.0"

def metric(value, reason="Undefined for this sample"):
    return {"value": float(value)} if value is not None and math.isfinite(float(value)) else {"value": None, "reason": reason}

def report(equity, initial, trades, from_ms, to_ms, exposure):
    values = equity.to_numpy(dtype=float)
    # Include starting capital in the high-water mark, including first-bar fees.
    peak = np.maximum.accumulate(np.r_[initial, values])[1:]
    dd = 1 - values / peak
    closed = [t for t in trades if t["status"] == "closed"]
    pnl = np.array([t["pnl"] for t in closed], dtype=float)
    wins, losses = pnl[pnl > 0], pnl[pnl < 0]
    days = (to_ms - from_ms) / 86400000
    final = float(values[-1])
    # Exclude partial UTC days from daily risk ratios.
    daily = equity.resample("1D").last().dropna()
    day_start = pd.Timestamp(from_ms, unit="ms", tz="UTC").ceil("D")
    day_end = pd.Timestamp(to_ms, unit="ms", tz="UTC").floor("D")
    returns = daily.pct_change(fill_method=None)
    if from_ms % 86_400_000 == 0:
        returns.iloc[0] = daily.iloc[0] / initial - 1
    returns = returns[(returns.index >= day_start) & (returns.index < day_end)].dropna()
    valid_risk = len(returns) >= 30 and bool((daily > 0).all())
    std = float(returns.std(ddof=1)) if len(returns) > 1 else 0
    downside = float(np.sqrt(np.mean(np.minimum(returns, 0) ** 2))) if len(returns) else 0
    cagr = (final / initial) ** (365.25 / days) - 1 if days >= 365.25 and final > 0 else None
    max_dd = float(max(dd))
    risk_reason = "Requires 30 complete daily return observations and positive equity"
    metrics = {
        "totalReturn": metric(final / initial - 1), "finalEquity": metric(final),
        "netProfit": metric(final - initial), "cagr": metric(cagr, "Requires at least one year and positive ending equity"),
        "maxDrawdown": metric(max_dd), "exposure": metric(exposure),
        "sharpe": metric(float(returns.mean()) / std * math.sqrt(365) if valid_risk and std > 0 else None, risk_reason if not valid_risk else "Daily return variance is zero"),
        "sortino": metric(float(returns.mean()) / downside * math.sqrt(365) if valid_risk and downside > 0 else None, risk_reason if not valid_risk else "No downside deviation"),
        "volatility": metric(std * math.sqrt(365) if valid_risk else None, risk_reason),
        "downsideVolatility": metric(downside * math.sqrt(365) if valid_risk else None, risk_reason),
        "calmar": metric(cagr / max_dd if cagr is not None and max_dd > 0 else None),
        "totalTrades": metric(len(closed)), "openTrades": metric(len(trades) - len(closed)),
        "winners": metric(len(wins)), "losers": metric(len(losses)),
        "winRate": metric(len(wins) / len(closed) if closed else None, "No closed trades"),
        "profitFactor": metric(wins.sum() / abs(losses.sum()) if len(losses) else None, "No losing closed trades"),
        "expectancy": metric(pnl.mean() if len(pnl) else None),
        "medianTrade": metric(np.median(pnl) if len(pnl) else None),
        "averageWinner": metric(wins.mean() if len(wins) else None), "averageLoser": metric(losses.mean() if len(losses) else None),
        "largestWinner": metric(wins.max() if len(wins) else None), "largestLoser": metric(losses.min() if len(losses) else None),
        "averageHoldingMs": metric(np.mean([t["exitTime"] - t["entryTime"] for t in closed]) if closed else None),
        "longTrades": metric(sum(t["side"] == "long" for t in closed)), "shortTrades": metric(sum(t["side"] == "short" for t in closed)),
    }
    for name, positive in [("consecutiveWins", True), ("consecutiveLosses", False)]:
        count = best = 0
        for value in pnl:
            count = count + 1 if (value > 0 if positive else value < 0) else 0
            best = max(best, count)
        metrics[name] = metric(best)
    periods = []
    start = trough = None
    for i, depth in enumerate(dd):
        if depth > 1e-12:
            if start is None:
                start = max(0, i - 1)
                trough = i
            if depth > dd[trough]:
                trough = i
        elif start is not None:
            periods.append(_drawdown(equity, dd, start, trough, i))
            start = trough = None
    if start is not None:
        periods.append(_drawdown(equity, dd, start, trough, None))
    monthly = []
    previous = initial
    for period, value in equity.resample("ME").last().items():
        monthly.append({"period": period.strftime("%Y-%m"), "return": float(value / previous - 1) if previous > 0 else None})
        previous = float(value)
    observations = []
    if len(closed) < 30:
        observations.append(f"Only {len(closed)} closed trades; estimates may be unstable.")
    if max_dd >= 0.2:
        observations.append(f"Maximum drawdown reached {max_dd:.1%} of peak equity.")
    if len(wins) and wins.max() > wins.sum() / 2:
        observations.append("More than half of gross winning P&L comes from one trade.")
    if not closed:
        observations.append("No closed trades. Equity may include an open position.")
    return metrics, dd, periods, monthly, observations

def _drawdown(equity, dd, start, trough, recovery):
    time = lambda i: int(equity.index[i].value // 1_000_000)
    end = recovery if recovery is not None else len(equity) - 1
    return {"start": time(start), "trough": time(trough), "recovery": time(recovery) if recovery is not None else None,
            "depth": float(dd[trough]), "durationMs": time(end) - time(start)}

def monte_carlo(result, simulations=1000, seed=42):
    if not isinstance(simulations, int) or not 100 <= simulations <= 5000:
        raise ValueError("Simulations must be between 100 and 5,000")
    if not isinstance(seed, int) or not 0 <= seed <= 4294967295:
        raise ValueError("Seed must be an unsigned 32-bit integer")
    returns = np.array([t["accountReturn"] for t in result["trades"] if t["status"] == "closed"], dtype=float)
    if len(returns) < 2:
        raise ValueError("At least two closed trades are required for bootstrap analysis")
    if len(returns) * simulations > 10_000_000:
        raise ValueError("Reduce simulations: this sample exceeds the 10 million observation budget")
    if not np.isfinite(returns).all() or (returns <= -1).any():
        raise ValueError("Bootstrap requires finite returns greater than -100%")
    rng = np.random.default_rng(seed)
    initial = result["config"]["initialCapital"]
    samples = rng.choice(returns, size=(simulations, len(returns)), replace=True)
    paths = np.c_[np.full(simulations, initial), initial * np.cumprod(1 + samples, axis=1)]
    if not np.isfinite(paths).all():
        raise ValueError("Bootstrap overflow; reduce sizing or inspect extreme returns")
    max_dd = np.max(1 - paths / np.maximum.accumulate(paths, axis=1), axis=1)
    indices = np.unique(np.linspace(0, len(returns), min(len(returns) + 1, 400), dtype=int))
    lower, median, upper = np.quantile(paths[:, indices], [0.05, 0.5, 0.95], axis=0)
    return {"method": "iid_closed_trade_account_returns", "seed": seed, "simulations": simulations, "observations": len(returns),
            "initialCapital": initial, "bands": [{"step": int(i), "lower": float(lo), "median": float(mid), "upper": float(hi)} for i, lo, mid, hi in zip(indices, lower, median, upper)],
            "samplePaths": paths[:20, indices].tolist(), "endingEquity": paths[:, -1].tolist(), "maxDrawdowns": max_dd.tolist(),
            "probabilityOfLoss": float(np.mean(paths[:, -1] < initial))}
