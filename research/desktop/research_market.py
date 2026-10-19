"""Public, allowlisted market preparation on the user's local Helper."""
import math
import re
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from validation import INTERVALS, digest

GATE = "https://api.gateio.ws/api/v4/futures/usdt"
BINANCE = "https://fapi.binance.com"


def read_json(url):
    import json
    try:
        with urlopen(Request(url, headers={"Accept": "application/json", "User-Agent": "ZTerminal-Research/1.2"}), timeout=15) as response:
            if not response.url.startswith((GATE + "/", BINANCE + "/")): raise ValueError("Unexpected provider redirect")
            data = response.read(4_000_001)
            if len(data) > 4_000_000: raise ValueError("Provider response exceeds 4 MB")
            return json.loads(data)
    except HTTPError as error:
        raise ValueError(f"Public market request failed (HTTP {error.code}). Retry later or explicitly select another venue.") from error
    except (URLError, TimeoutError) as error:
        raise ValueError("Cannot reach the selected exchange's public data service. Check the connection and retry.") from error


def identity(body):
    provider, symbol = body.get("provider"), body.get("symbol")
    if provider not in ("gateio", "binance") or not isinstance(symbol, str): raise ValueError("Select Gate or Binance and a native USDT perpetual symbol")
    symbol = symbol.upper().replace("/", "").replace("-", "").replace("_", "")
    if not re.fullmatch(r"[A-Z0-9]{1,36}USDT", symbol): raise ValueError("Invalid native USDT perpetual symbol")
    return provider, symbol[:-4] + "_USDT" if provider == "gateio" else symbol


def finite(value, positive=True):
    if isinstance(value, bool): raise ValueError("Invalid provider number")
    result = float(value)
    if not math.isfinite(result) or (result <= 0 if positive else result < 0): raise ValueError("Invalid provider precision or amount")
    return result


def instrument(body):
    provider, symbol = identity(body)
    if provider == "gateio":
        raw = read_json(f"{GATE}/contracts/{symbol}")
        if raw.get("name") != symbol or raw.get("in_delisting") is not False: raise ValueError("Instrument is not available for new research")
        # Decimal contracts need declared size precision; do not substitute whole contracts.
        if raw.get("enable_decimal") is not False: raise ValueError("Decimal Gate size increments are unavailable in this adapter")
        result = {"multiplier": finite(raw["quanto_multiplier"]), "quantityStep": 1,
                  "tickSize": finite(raw["order_price_round"]), "minimumQuantity": finite(raw["order_size_min"]), "minimumNotional": 0}
        for key, field in (("makerFeeBps", "maker_fee_rate"), ("takerFeeBps", "taker_fee_rate")):
            rate = float(raw.get(field, "nan")) * 10000
            if math.isfinite(rate) and -100 <= rate <= 1000: result[key] = rate
    else:
        raw = read_json(f"{BINANCE}/fapi/v1/exchangeInfo")
        contract = next((s for s in raw["symbols"] if s["symbol"] == symbol), {})
        if contract.get("contractType") != "PERPETUAL" or contract.get("quoteAsset") != "USDT" or contract.get("status") != "TRADING": raise ValueError("Select an active Binance USDT perpetual")
        filters = {f["filterType"]: f for f in contract["filters"]}
        lot = filters.get("MARKET_LOT_SIZE", filters["LOT_SIZE"])
        result = {"multiplier": 1, "quantityStep": finite(lot["stepSize"]), "tickSize": finite(filters["PRICE_FILTER"]["tickSize"]),
                  "minimumQuantity": finite(lot["minQty"]), "minimumNotional": finite(filters.get("MIN_NOTIONAL", {}).get("notional", 0), False)}
    return {"provider": provider, "symbol": symbol, **result, "verifiedAt": int(time.time()*1000), "source": "local_public_rest", "volumeUnit": "contracts" if provider == "gateio" else "base"}


def range_(body):
    provider, symbol = identity(body)
    interval, start, end = INTERVALS.get(body.get("timeframe")), body.get("from"), body.get("to")
    if not interval or type(start) is not int or type(end) is not int or start < 0 or start >= end or start % interval or end % interval or end > int(time.time()*1000)//interval*interval:
        raise ValueError("Choose an aligned range of complete closed candles")
    count = (end-start)//interval
    maximum = 10000 if provider == "gateio" else 100000
    if not 2 <= count <= maximum: raise ValueError(f"Requested {count:,} candles including warm-up; {provider} supports at most {maximum:,}. Shorten the dates or choose a larger timeframe.")
    if provider == "gateio" and start < int(time.time()*1000)//interval*interval - maximum*interval:
        raise ValueError("Gate retains only its most recent 10,000 candles at this timeframe. Choose a recent range or explicitly select Binance.")
    return provider, symbol, interval, start, end


def history(body):
    provider, symbol, interval, start, end = range_(body)
    bars, cursor, deadline = {}, start, time.monotonic()+180
    while cursor < end:
        if time.monotonic() > deadline: raise ValueError("History preparation exceeded three minutes; shorten the range")
        page_end = min(end, cursor + interval*1000)
        if provider == "gateio":
            query = urlencode({"contract": symbol, "interval": body["timeframe"], "from": cursor//1000, "to": (page_end-1)//1000})
            raw = read_json(f"{GATE}/candlesticks?{query}")
            page = [{"t": int(b["t"])*1000, "o": float(b["o"]), "h": float(b["h"]), "l": float(b["l"]), "c": float(b["c"]), "v": float(b["v"])} for b in raw]
        else:
            query = urlencode({"symbol": symbol, "interval": body["timeframe"], "startTime": cursor, "endTime": page_end-1, "limit": 1000})
            raw = read_json(f"{BINANCE}/fapi/v1/klines?{query}")
            page = [{"t": int(b[0]), "o": float(b[1]), "h": float(b[2]), "l": float(b[3]), "c": float(b[4]), "v": float(b[5])} for b in raw]
        for b in page:
            if cursor <= b["t"] < page_end:
                if b["t"] in bars and bars[b["t"]] != b: raise ValueError("Conflicting provider candles")
                bars[b["t"]] = b
        cursor = page_end
    ordered = [bars[t] for t in sorted(bars)]
    if len(ordered) != (end-start)//interval: raise ValueError(f"Incomplete history: {len(ordered):,} candles received. No missing bars are fabricated.")
    for i, b in enumerate(ordered):
        if b["t"] != start+i*interval or any(not math.isfinite(b[k]) for k in ("o", "h", "l", "c", "v")) or min(b[k] for k in ("o", "h", "l", "c")) <= 0 or b["v"] < 0 or b["h"] < max(b["o"], b["c"]) or b["l"] > min(b["o"], b["c"]):
            raise ValueError(f"Invalid or missing candle at index {i}")
    return {"version": 1, "provider": provider, "product": "perpetual", "symbol": symbol, "timeframe": body["timeframe"], "from": start, "to": end,
            "bars": ordered, "hash": digest([[b[k] for k in ("t", "o", "h", "l", "c", "v")] for b in ordered]), "retrievedAt": int(time.time()*1000)}


def funding(body):
    provider, symbol, _, start, end = range_(body)
    records, cursor = {}, start
    # Query short windows so neither provider's 1000-record cap silently truncates a schedule.
    while cursor < end:
        stop = min(end, cursor+7*86400000)
        if provider == "gateio":
            q = urlencode({"contract": symbol, "from": cursor//1000, "to": (stop-1)//1000, "limit": 1000})
            raw = read_json(f"{GATE}/funding_rate?{q}")
            page = [{"time": int(b.get("funding_time") or b["t"])*1000, "rate": float(b["r"])} for b in raw]
        else:
            q = urlencode({"symbol": symbol, "startTime": cursor, "endTime": stop-1, "limit": 1000})
            raw = read_json(f"{BINANCE}/fapi/v1/fundingRate?{q}")
            page = [{"time": int(b["fundingTime"]), "rate": float(b["fundingRate"]), "markPrice": float(b["markPrice"])} for b in raw]
        if len(raw) >= 1000: raise ValueError("Funding response reached its limit; complete coverage cannot be established")
        for b in page:
            if not cursor <= b["time"] < stop: continue
            if not math.isfinite(b["rate"]) or abs(b["rate"]) > 1: raise ValueError("Invalid historical funding rate")
            records[b["time"]] = b
        cursor = stop
    ordered = [records[t] for t in sorted(records)]
    if end-start >= 8*3600000 and (not ordered or ordered[0]["time"]-start > 8*3600000 or end-ordered[-1]["time"] > 8*3600000 or any(b["time"]-a["time"] > 8*3600000 for a, b in zip(ordered, ordered[1:]))):
        raise ValueError("Historical funding schedule is missing or has a gap; disable funding explicitly or choose covered dates")
    return {"provider": provider, "symbol": symbol, "from": start, "to": end, "events": ordered, "retrievedAt": int(time.time()*1000),
            "markPolicy": "exchange_mark" if provider == "binance" else "prior_closed_candle_proxy", "hash": digest(ordered)}
