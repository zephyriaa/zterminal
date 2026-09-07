"""ZTerminal signal API v1. Local Python execution; this is not a sandbox."""
from dataclasses import dataclass, field
import pandas as pd

__version__ = "1.0.0"

@dataclass
class Strategy:
    entries: pd.Series
    exits: pd.Series
    short_entries: pd.Series | None = None
    short_exits: pd.Series | None = None
    plots: dict[str, pd.Series] = field(default_factory=dict)

def sma(series, period=20):
    return series.rolling(_period(period), min_periods=period).mean()

def ema(series, period=20):
    return series.ewm(span=_period(period), adjust=False, min_periods=period).mean()

def rsi(series, period=14):
    period = _period(period)
    delta = series.diff()
    gain = delta.clip(lower=0).ewm(alpha=1 / period, adjust=False, min_periods=period).mean()
    loss = (-delta.clip(upper=0)).ewm(alpha=1 / period, adjust=False, min_periods=period).mean()
    return (100 - 100 / (1 + gain / loss)).where(loss != 0, 100).where((gain != 0) | (loss != 0), 50)

def crossover(a, b):
    if not isinstance(b, pd.Series):
        b = pd.Series(b, index=a.index)
    return (a > b) & (a.shift(1) <= b.shift(1))

def crossunder(a, b):
    if not isinstance(b, pd.Series):
        b = pd.Series(b, index=a.index)
    return (a < b) & (a.shift(1) >= b.shift(1))

def _period(value):
    if not isinstance(value, int) or isinstance(value, bool) or not 1 <= value <= 10000:
        raise ValueError("Indicator period must be an integer between 1 and 10,000")
    return value
