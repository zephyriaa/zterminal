export const EXAMPLES = [
  { id: "ema", name: "Moving-average crossover", source: `# Educational example. Historical observations are not forecasts.
import zterminal as zt

def strategy(data, params):
    fast = zt.ema(data.close, int(params.get("fast", 9)))
    slow = zt.ema(data.close, int(params.get("slow", 21)))
    return zt.Strategy(
        entries=zt.crossover(fast, slow),
        exits=zt.crossunder(fast, slow),
        plots={"Fast EMA": fast, "Slow EMA": slow},
    )
` },
  { id: "rsi", name: "RSI mean reversion", source: `# Educational example. Examine costs, sample size and risk.
import zterminal as zt

def strategy(data, params):
    rsi = zt.rsi(data.close, 14)
    return zt.Strategy(
        entries=zt.crossunder(rsi, 30),
        exits=zt.crossover(rsi, 50),
        plots={"RSI": rsi},
    )
` },
  { id: "breakout", name: "Donchian breakout", source: `# Educational example. Levels use prior completed bars.
import zterminal as zt

def strategy(data, params):
    upper = data.high.shift(1).rolling(20).max()
    lower = data.low.shift(1).rolling(10).min()
    return zt.Strategy(
        entries=data.close > upper,
        exits=data.close < lower,
        plots={"Prior 20-bar high": upper, "Prior 10-bar low": lower},
    )
` },
] as const;

export const INSTITUTIONAL_TEMPLATES = [
  {
    id: "academic-orb",
    name: "Academic ORB with Volatility Sizing",
    source: `# Academic Opening Range Breakout (ORB) with Dynamic Volatility Targeting.
# Mati / Matfin Institutional Blueprint.
import pandas as pd
import zterminal as zt

PARAMETERS = {
    "risk_budget": zt.input.number(500.0, min=50.0, max=50000.0),
    "atr_period": zt.input.integer(14, min=2, max=100),
    "atr_stop_multiplier": zt.input.number(1.5, min=0.5, max=5.0),
    "target_multiplier": zt.input.number(3.0, min=1.0, max=10.0),
}

def strategy(data, params):
    atr = zt.atr(data, int(params.get("atr_period", 14)))
    
    # 30-min Opening Range (09:30 - 10:00 ET) using native session engine
    is_orb_window = data.session.between("09:30", "10:00")
    orb_high = data.high.where(is_orb_window).groupby(data.index.date).transform("max")
    orb_low = data.low.where(is_orb_window).groupby(data.index.date).transform("min")
    
    # Eligible trading window: post-ORB up to 15:30 ET
    trade_window = data.session.between("10:00", "15:30")
    entries = zt.crossover(data.close, orb_high) & trade_window
    
    # Market close exit (15:55 ET)
    exits = data.session.between("15:55", "16:00")
    
    # Volatility brackets
    stop_distance = atr * float(params.get("atr_stop_multiplier", 1.5))
    stop_loss = orb_low.fillna(data.close - stop_distance)
    take_profit = data.close + (atr * float(params.get("target_multiplier", 3.0)))
    
    # Position Sizing: floor(Risk Budget / Dollar ATR Stop Distance)
    risk_budget = float(params.get("risk_budget", 500.0))
    sizing = zt.risk_budget_size(risk_budget, data.close, stop_loss)
    
    return zt.Strategy(
        entries=entries,
        exits=exits,
        stop_loss=stop_loss,
        take_profit=take_profit,
        sizing=sizing,
        max_hold_bars=35,
        cooldown_bars=5,
        plots={"ORB High": orb_high, "ORB Low": orb_low, "Stop Level": stop_loss}
    )
`
  },
  {
    id: "overnight-drift",
    name: "Overnight Inventory Drift (Red Day Filter)",
    source: `# Overnight Inventory Drift with Red Day Filter.
# Exploits institutional overnight rebalancing and morning gap digestion.
import pandas as pd
import zterminal as zt

PARAMETERS = {
    "risk_budget": zt.input.number(400.0, min=50.0, max=50000.0),
    "hold_bars": zt.input.integer(12, min=1, max=50),
}

def strategy(data, params):
    atr = zt.atr(data, 14)
    rth_open = data.open.where(data.session.session_open).ffill()
    is_red_day = data.close < rth_open
    
    # Globex overnight entry: Enter long after 18:00 ET following a red day
    globex_evening = data.session.between("18:00", "20:00")
    entries = globex_evening & is_red_day & (~data.session.RTH)
    
    # Exit into the next day's RTH open
    exits = data.session.session_open
    
    stop_loss = data.close - (atr * 2.0)
    take_profit = data.close + (atr * 2.5)
    sizing = zt.atr_volatility_size(float(params.get("risk_budget", 400.0)), atr, multiplier=2.0)
    
    return zt.Strategy(
        entries=entries,
        exits=exits,
        stop_loss=stop_loss,
        take_profit=take_profit,
        sizing=sizing,
        max_hold_bars=int(params.get("hold_bars", 12)),
        cooldown_bars=6,
        plots={"Overnight Stop": stop_loss}
    )
`
  },
  {
    id: "turtle-trend",
    name: "Turtle 40-Bar Trend Following (Shifted)",
    source: `# Classic Turtle 40-Bar Trend Following (Lookahead-Free / Shifted).
# Enforces strict 20-bar Donchian exit and 2*ATR stop trailing.
import pandas as pd
import zterminal as zt

PARAMETERS = {
    "entry_lookback": zt.input.integer(40, min=10, max=100),
    "exit_lookback": zt.input.integer(20, min=5, max=50),
    "risk_budget": zt.input.number(1000.0, min=100.0, max=100000.0),
}

def strategy(data, params):
    entry_lb = int(params.get("entry_lookback", 40))
    exit_lb = int(params.get("exit_lookback", 20))
    
    # Shifted to avoid lookahead bias
    upper_channel = data.high.shift(1).rolling(entry_lb).max()
    exit_channel = data.low.shift(1).rolling(exit_lb).min()
    atr = zt.atr(data, 20)
    
    entries = data.close > upper_channel
    exits = data.close < exit_channel
    
    stop_loss = data.close - (2.0 * atr)
    sizing = zt.atr_volatility_size(float(params.get("risk_budget", 1000.0)), atr, multiplier=2.0)
    
    return zt.Strategy(
        entries=entries,
        exits=exits,
        stop_loss=stop_loss,
        sizing=sizing,
        cooldown_bars=3,
        plots={"40-bar Donchian High": upper_channel, "20-bar Exit Low": exit_channel}
    )
`
  },
  {
    id: "delta-dislocation",
    name: "Delta Dislocation Mean-Reversion",
    source: `# Delta Dislocation & Whale Absorption Mean-Reversion.
# Triggers on aggressive selling/buying exhaustion where price fails to make new lows/highs.
import pandas as pd
import zterminal as zt

PARAMETERS = {
    "delta_threshold": zt.input.number(-150.0, min=-5000.0, max=0.0),
    "risk_budget": zt.input.number(500.0, min=50.0, max=50000.0),
}

def strategy(data, params):
    atr = zt.atr(data, 14)
    thresh = float(params.get("delta_threshold", -150.0))
    
    # Aggressive seller exhaustion: Heavy negative delta print on a candle with wick absorption
    lower_wick = (data.close.clip(lower=data.open) - data.low)
    body = (data.close - data.open).abs()
    absorption = lower_wick > body
    
    dislocation_buy = (data.delta < thresh) & absorption & (data.close > data.open)
    
    exits = zt.crossunder(data.delta, 0) | (data.close > data.high.shift(1).rolling(5).max())
    stop_loss = data.low.shift(1).rolling(3).min()
    take_profit = data.close + (atr * 2.0)
    
    sizing = zt.risk_budget_size(float(params.get("risk_budget", 500.0)), data.close, stop_loss)
    
    return zt.Strategy(
        entries=dislocation_buy,
        exits=exits,
        stop_loss=stop_loss,
        take_profit=take_profit,
        sizing=sizing,
        max_hold_bars=15,
        cooldown_bars=4,
        plots={"CVD": data.cvd, "Absorption Stop": stop_loss}
    )
`
  }
] as const;
