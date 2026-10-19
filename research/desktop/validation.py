"""Lightweight request validation shared by execution and non-executable archive import."""
import hashlib
import json
import math
import time
import re
import rfc8785

INTERVALS = {"1m": 60_000, "3m": 180_000, "5m": 300_000, "15m": 900_000,
             "30m": 1_800_000, "1h": 3_600_000, "2h": 7_200_000, "4h": 14_400_000,
             "6h": 21_600_000, "8h": 28_800_000, "12h": 43_200_000, "1d": 86_400_000}
INDICATOR_ENGINE_VERSION = "1.1.0"


def digest(value):
    return hashlib.sha256(rfc8785.dumps(value)).hexdigest()


def input_record(request):
    if request.get("operation") == "indicator":
        artifact = request.get("artifact")
        if not isinstance(artifact, dict) or artifact.get("kind") != "indicator" or not isinstance(artifact.get("id"), str) or not artifact["id"] or type(artifact.get("revision")) is not int or artifact["revision"] < 1:
            raise ValueError("Indicator evaluation requires a saved immutable artifact revision")
        return {"artifactId": artifact["id"], "revision": artifact["revision"], "sourceHash": hashlib.sha256(request["source"].encode()).hexdigest(),
                "params": request.get("params", {}), "dataset": {key: request["dataset"][key] for key in ("version", "provider", "product", "symbol", "timeframe", "from", "to", "hash")},
                "outputs": request.get("outputs", {}), "engine": INDICATOR_ENGINE_VERSION}
    captured = {"name": str(request.get("name", "Untitled"))[:120], "source": request["source"],
                "config": request["config"], "params": request.get("params", {}), "dataset": request["dataset"]}
    if request["dataset"].get("version") == 2:
        captured["context"] = request["context"]
    if "instrument" in request: captured["instrument"] = request["instrument"]
    return captured


def validate_local_cash(request):
    config, dataset = request["config"], request["dataset"]
    if (config.get("executionModel") != "cash_next_open_v1" or config.get("product") != "spot"
            or config.get("provider") != "csv" or dataset.get("provider") != "csv"
            or dataset.get("product") != "spot" or config.get("direction") != "long" or config.get("multiplier") != 1):
        raise ValueError("Local cash v1 requires CSV spot, long only, unit multiplier and explicit execution model")
    origin, context = dataset.get("origin"), request.get("context")
    if (not isinstance(origin, dict) or origin.get("kind") != "local_csv" or not isinstance(context, dict)
            or type(context.get("version")) is not int or context["version"] != 1):
        raise ValueError("Local research requires origin and workspace/strategy context")
    if not isinstance(dataset.get("symbol"), str) or not 0 < len(dataset["symbol"].encode()) <= 80:
        raise ValueError("Local research requires a declared instrument symbol")
    def sha(value):
        return isinstance(value, str) and re.fullmatch(r"[0-9a-f]{64}", value) is not None
    if not all(sha(origin.get(k)) for k in ("sourceSha256", "segmentSha256")):
        raise ValueError("Local dataset source/segment identities are missing")
    if not isinstance(origin.get("sourceName"), str) or not 0 < len(origin["sourceName"].encode()) <= 256:
        raise ValueError("Invalid retained source name")
    for key in ("workspace", "strategy"):
        reference = context.get(key)
        if (not isinstance(reference, dict) or not isinstance(reference.get("id"), str)
                or re.fullmatch(r"[A-Za-z0-9_-]{1,80}", reference["id"]) is None
                or type(reference.get("revision")) is not int or not 1 <= reference["revision"] <= 2**53-1):
            raise ValueError("Invalid local document identity/revision")
    strategy = context["strategy"]
    if (strategy.get("sdkVersion") != "1.0.0" or not sha(strategy.get("parameterArtifactSha256"))
            or strategy.get("sourceSha256") != hashlib.sha256(request["source"].encode()).hexdigest()):
        raise ValueError("Local strategy source identity or SDK contract mismatch")
    for key, field in (("tickSize", "priceStep"), ("quantityStep", "quantityStep")):
        step = origin.get(field)
        if not isinstance(step, str) or re.fullmatch(r"(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)", step) is None or len(step) > 20:
            raise ValueError("Local increments must be exact positive decimal strings")
        number = config.get(key)
        if isinstance(number, bool) or not isinstance(number, (int, float)) or not math.isfinite(number) or not number > 0 or number != float(step):
            raise ValueError("Research increments disagree with retained data")
    if type(dataset.get("retrievedAt")) is not int:
        raise ValueError("Local research requires the retained import timestamp")
    if len(json.dumps(request.get("params", {}), ensure_ascii=False, separators=(",", ":")).encode()) > 16384:
        raise ValueError("Local parameters exceed 16,384 UTF-8 bytes")


def validate(request):
    if not isinstance(request, dict) or not isinstance(request.get("source"), str) or not 0 < len(request["source"].encode()) <= 256_000:
        raise ValueError("Supply Python source, up to 256 KB")
    config, dataset = request["config"], request["dataset"]
    if config.get("executionModel") == "synthetic_next_open_v2":
        if type(config.get("strategySeed", 42)) is not int or not 0 <= config.get("strategySeed", 42) <= 2**32-1: raise ValueError("Invalid strategy seed")
        for key in ("tickSize", "minimumQuantity", "minimumNotional", "spreadBps"):
            value = config.get(key)
            if isinstance(value, bool) or not isinstance(value, (float, int)) or not math.isfinite(value) or value < 0:
                raise ValueError(f"Missing or invalid {key}")
        if config["tickSize"] <= 0 or config["minimumQuantity"] <= 0 or config["spreadBps"] > 1000:
            raise ValueError("Invalid instrument precision or spread")
        for key, default, minimum, maximum in (("warmupBars", 0, 0, 10000), ("executionDelayBars", 1, 1, 100)):
            value = config.get(key, default)
            if type(value) is not int or not minimum <= value <= maximum: raise ValueError(f"Invalid {key}")
        if any(key in config for key in ("stopLoss", "takeProfit", "limitPrice", "leverage", "funding")):
            raise ValueError("Unsupported order or leveraged execution configuration")
    elif config.get("executionModel") not in (None, "cash_next_open_v1"):
        raise ValueError("Unsupported execution model")
    if config.get("executionModel") == "cash_next_open_v1" and dataset.get("version") != 2:
        raise ValueError("The native spot cash model requires its explicit version-2 dataset contract")
    if type(dataset.get("version")) is not int:
        raise ValueError("Dataset version must be an integer")
    for name in ["initialCapital", "feeBps", "slippageBps", "allocation", "multiplier", "quantityStep"]:
        if isinstance(config[name], bool) or not isinstance(config[name], (int, float)) or not math.isfinite(config[name]):
            raise ValueError(f"Invalid {name}")
    if not 0 < config["initialCapital"] <= 1e12 or not 0 < config["allocation"] <= 1 or config["multiplier"] <= 0 or config["quantityStep"] <= 0:
        raise ValueError("Invalid capital or position sizing")
    if not all(0 <= config[k] <= 1000 for k in ["feeBps", "slippageBps"]):
        raise ValueError("Costs must be between 0 and 1,000 bps")
    if dataset.get("version") == 2:
        validate_local_cash(request)
    elif dataset.get("version") != 1 or config["provider"] not in ("gateio", "binance") or config["direction"] not in ("long", "both"):
        raise ValueError("Unsupported provider or direction")
    interval = INTERVALS.get(config["timeframe"])
    start, end = config["from"], config["to"]
    if not interval or type(start) is not int or type(end) is not int or start < 0 or start >= end or start % interval or end % interval or end > int(time.time() * 1000) // interval * interval:
        raise ValueError("Range must contain complete closed candles aligned to the timeframe")
    if (dataset.get("version") == 1 and dataset.get("product") != "perpetual") or any(dataset[k] != config[k] for k in ["provider", "symbol", "timeframe", "from", "to"]):
        raise ValueError("Dataset manifest does not match the run configuration")
    bars = dataset["bars"]
    if "retrievedAt" in dataset:
        retrieved = dataset["retrievedAt"]
        if isinstance(retrieved, bool) or not isinstance(retrieved, int) or not end <= retrieved <= int(time.time() * 1000) + 60_000:
            raise ValueError("Invalid dataset retrieval timestamp")
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
