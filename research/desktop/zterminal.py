"""ZTerminal signal API v1. Local Python execution; this is not a sandbox."""
from dataclasses import dataclass, field
import numpy as np
import pandas as pd

__version__ = "1.1.0"

@dataclass
class Strategy:
    entries: pd.Series
    exits: pd.Series
    short_entries: pd.Series | None = None
    short_exits: pd.Series | None = None
    stop_loss: pd.Series | float | None = None
    take_profit: pd.Series | float | None = None
    sizing: pd.Series | float | None = None
    max_hold_bars: int | None = None
    cooldown_bars: int | None = None
    plots: dict[str, pd.Series] = field(default_factory=dict)

@dataclass
class Indicator:
    outputs: dict[str, pd.Series]

@dataclass(frozen=True)
class InputSpec:
    kind: str
    default: object
    minimum: float | None = None
    maximum: float | None = None

class input:
    @staticmethod
    def integer(default, min=None, max=None):
        return InputSpec("integer", default, min, max)

    @staticmethod
    def number(default, min=None, max=None):
        return InputSpec("number", default, min, max)

    @staticmethod
    def boolean(default):
        return InputSpec("boolean", default)

    @staticmethod
    def string(default):
        return InputSpec("string", default)

def sma(series, period=20):
    return series.rolling(_period(period), min_periods=period).mean()

def ema(series, period=20):
    return series.ewm(span=_period(period), adjust=False, min_periods=period).mean()

def atr(data_or_high, low=None, close=None, period=14):
    """Average True Range (ATR) supporting either (data, period) or (high, low, close, period)."""
    if hasattr(data_or_high, "high") and hasattr(data_or_high, "low") and hasattr(data_or_high, "close"):
        if isinstance(low, int) and close is None:
            period = low
        high = data_or_high.high
        low_s = data_or_high.low
        close_s = data_or_high.close
    else:
        high = data_or_high
        low_s = low
        close_s = close
    period = _period(period)
    prev_close = close_s.shift(1)
    tr1 = high - low_s
    tr2 = (high - prev_close).abs()
    tr3 = (low_s - prev_close).abs()
    tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
    return tr.ewm(alpha=1 / period, adjust=False, min_periods=period).mean()

def atr_volatility_size(dollar_risk, atr_series, multiplier=2.0, point_value=1.0, quantity_step=1.0):
    """Calculate position contracts based on ATR dollar stop distance:
    contracts = floor(dollar_risk / (atr * multiplier * point_value))
    """
    risk_per_unit = (atr_series * multiplier * point_value).replace(0, np.nan)
    raw_qty = (dollar_risk / risk_per_unit).fillna(0)
    return (raw_qty // quantity_step) * quantity_step

def risk_budget_size(dollar_risk, entry_price, stop_price, point_value=1.0, quantity_step=1.0):
    """Calculate contracts based on entry-to-stop dollar distance."""
    distance = (entry_price - stop_price).abs() * point_value
    distance = distance.replace(0, np.nan)
    raw_qty = (dollar_risk / distance).fillna(0)
    return (raw_qty // quantity_step) * quantity_step

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
