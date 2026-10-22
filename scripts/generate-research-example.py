"""Regenerate the public fixed-fixture report with the real pinned Helper runtime."""
import json
import math
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "research" / "desktop"))
from engine import execute, digest

start = 1735689600000
prices = [100 + index * 0.05 + 5 * math.sin(index / 5) for index in range(128)]
bars = [{"t": start + index * 3600000, "o": price, "h": price + 1, "l": price - 1, "c": price + 0.2, "v": 10000} for index, price in enumerate(prices)]
source = """import zterminal as zt

def strategy(data, params):
    fast = data.close.rolling(5).mean()
    slow = data.close.rolling(15).mean()
    above = fast > slow
    return zt.Strategy(above & ~above.shift(1, fill_value=False), ~above & above.shift(1, fill_value=False))
"""
config = {"provider": "gateio", "symbol": "BTC_USDT", "timeframe": "1h", "from": start, "to": start + len(bars) * 3600000,
          "initialCapital": 10000, "feeBps": 10, "slippageBps": 5, "allocation": 0.1, "direction": "long", "multiplier": 1, "quantityStep": 0.000001,
          "executionModel": "synthetic_next_open_v2", "spreadBps": 0, "tickSize": 0.01, "minimumQuantity": 0.000001, "minimumNotional": 0,
          "warmupBars": 0, "executionDelayBars": 1, "reserveHoldout": False, "strategySeed": 42, "autoWarmup": False, "guardrails": True,
          "autoValidation": True, "impactModel": "fixed", "exchangeProfile": "custom", "fundingMode": "none"}
dataset = {key: config[key] for key in ("provider", "symbol", "timeframe", "from", "to")}
dataset.update(version=1, product="perpetual", bars=bars, hash=digest([[bar[key] for key in ("t", "o", "h", "l", "c", "v")] for bar in bars]))
request = {"name": "Educational synthetic fixture", "source": source, "params": {}, "config": config, "dataset": dataset}
first, second = execute(request), execute(request)
assert len(first["evidenceHash"]) == 64 and first["evidenceHash"] == second["evidenceHash"]
assert first["trades"] == second["trades"]
assert first["resultHash"] == digest({key: value for key, value in first.items() if key != "resultHash"})
target = ROOT / "public" / "research" / "example-result.json"
target.parent.mkdir(parents=True, exist_ok=True)
target.write_text(json.dumps(first, indent=2, allow_nan=False), encoding="utf-8", newline="")
print(f"Wrote {target}: {len(first['trades'])} trades, reproducible evidence {first['evidenceHash']}")
