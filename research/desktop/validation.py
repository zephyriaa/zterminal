"""Lightweight request validation shared by execution and non-executable archive import."""
import hashlib
import json
import math
import time
import rfc8785

INTERVALS = {"1m": 60_000, "3m": 180_000, "5m": 300_000, "15m": 900_000,
             "30m": 1_800_000, "1h": 3_600_000, "2h": 7_200_000, "4h": 14_400_000,
             "6h": 21_600_000, "8h": 28_800_000, "12h": 43_200_000, "1d": 86_400_000}


def digest(value):
    return hashlib.sha256(rfc8785.dumps(value)).hexdigest()


def validate(request):
    if not isinstance(request, dict) or not isinstance(request.get("source"), str) or not 0 < len(request["source"].encode()) <= 256_000:
        raise ValueError("Supply Python source, up to 256 KB")
    config, dataset = request["config"], request["dataset"]
    for name in ["initialCapital", "feeBps", "slippageBps", "allocation", "multiplier", "quantityStep"]:
        if isinstance(config[name], bool) or not isinstance(config[name], (int, float)) or not math.isfinite(config[name]):
            raise ValueError(f"Invalid {name}")
    if not 0 < config["initialCapital"] <= 1e12 or not 0 < config["allocation"] <= 1 or config["multiplier"] <= 0 or config["quantityStep"] <= 0:
        raise ValueError("Invalid capital or position sizing")
    if not all(0 <= config[k] <= 1000 for k in ["feeBps", "slippageBps"]):
        raise ValueError("Costs must be between 0 and 1,000 bps")
    if config["provider"] not in ("gateio", "binance") or config["direction"] not in ("long", "both"):
        raise ValueError("Unsupported provider or direction")
    interval = INTERVALS.get(config["timeframe"])
    start, end = config["from"], config["to"]
    if not interval or not isinstance(start, int) or not isinstance(end, int) or start >= end or start % interval or end % interval or end > int(time.time() * 1000) // interval * interval:
        raise ValueError("Range must contain complete closed candles aligned to the timeframe")
    if dataset.get("version") != 1 or dataset.get("product") != "perpetual" or any(dataset[k] != config[k] for k in ["provider", "symbol", "timeframe", "from", "to"]):
        raise ValueError("Dataset manifest does not match the run configuration")
    bars = dataset["bars"]
    if not 2 <= len(bars) <= 100_000 or len(bars) != (end - start) // interval:
        raise ValueError("Incomplete history; select a complete range explicitly")
    for i, b in enumerate(bars):
        if b["t"] != start + i * interval:
            raise ValueError(f"Unordered, duplicated or missing candle at index {i}")
        if any(isinstance(b[k], bool) or not isinstance(b[k], (int, float)) or not math.isfinite(b[k]) for k in ["o", "h", "l", "c", "v"]):
            raise ValueError(f"Non-finite OHLCV at index {i}")
        if min(b["o"], b["h"], b["l"], b["c"]) <= 0 or b["v"] < 0 or b["h"] < max(b["o"], b["c"]) or b["l"] > min(b["o"], b["c"]):
            raise ValueError(f"Invalid OHLCV at index {i}")
    if dataset["hash"] != digest([[b[k] for k in ["t", "o", "h", "l", "c", "v"]] for b in bars]):
        raise ValueError("Dataset SHA-256 mismatch")
    params = request.get("params", {})
    if not isinstance(params, dict) or len(json.dumps(params)) > 16384 or any(not isinstance(k, str) or len(k) > 80 or isinstance(v, (dict, list)) or not isinstance(v, (str, int, float, bool)) or (isinstance(v, float) and not math.isfinite(v)) for k, v in params.items()):
        raise ValueError("Invalid strategy parameters")
    return interval
