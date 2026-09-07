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
