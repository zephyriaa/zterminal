"""Versioned candle execution assumptions, never millisecond liquidity claims."""
import math
import pandas as pd

PROFILES = {
    "custom": {"label": "Custom fees", "provider": None, "makerBps": None, "takerBps": None, "source": "User-entered scenario"},
    "gate_public": {"label": "Gate public contract schedule", "provider": "gateio", "makerBps": None, "takerBps": None, "source": "Current public contract metadata; account discounts and historical fee changes not inferred"},
    "binance_retail": {"label": "Binance retail scenario", "provider": "binance", "makerBps": 2, "takerBps": 5, "source": "Reference USD-M scenario, not authenticated account rates; https://www.binance.com/en/fee/futureFee"},
    "binance_vip9": {"label": "Binance VIP 9 scenario", "provider": "binance", "makerBps": 0, "takerBps": 1.7, "source": "2021-12-21 published reference schedule, not current account entitlement; https://www.binance.com/en/support/announcement/detail/88ee9834fef947de96e01b77e888414e"},
    "coinbase_advanced": {"label": "Coinbase Advanced", "provider": "coinbase", "makerBps": None, "takerBps": None, "unavailable": "Coinbase spot data/execution is not supported by this perpetual research adapter. Account fee tier required.", "source": "https://help.coinbase.com/en/coinbase/trading-and-funding/advanced-trade/advanced-trade-fees"},
}
PARTICIPATION = {"small": .001, "medium": .01, "institutional": .05}


def validate_execution(config, instrument):
    profile = PROFILES.get(config.get("exchangeProfile", "custom"))
    if profile is None or profile.get("unavailable"): raise ValueError("Unsupported exchange profile for this dataset")
    if profile["provider"] and profile["provider"] != config["provider"]: raise ValueError("Exchange fee profile does not match the selected market")
    expected = instrument.get("takerFeeBps") if config.get("exchangeProfile") == "gate_public" else profile["takerBps"]
    if config.get("exchangeProfile") != "custom" and expected is not None and not math.isclose(config["feeBps"], expected, abs_tol=1e-9): raise ValueError("Fee rate does not match the captured exchange profile; refresh metadata or choose Custom fees")
    if config.get("exchangeProfile") == "gate_public" and expected is None: raise ValueError("Public Gate fee schedule is unavailable")
    if config.get("impactModel", "fixed") not in ("fixed", "atr_volume_v1") or config.get("liquidityTier", "small") not in PARTICIPATION: raise ValueError("Unsupported market impact model or liquidity tier")
    if config.get("fundingMode", "none") not in ("none", "historical"): raise ValueError("Unsupported funding mode")


def liquidity_inputs(frame):
    # Every row uses only candles completed before its opening timestamp.
    previous = frame.close.shift(1)
    tr = pd.concat([frame.high-frame.low, (frame.high-previous).abs(), (frame.low-previous).abs()], axis=1).max(axis=1)
    return tr.rolling(14, min_periods=14).mean().shift(1), frame.volume.rolling(20, min_periods=20).mean().shift(1)


def impact_bps(base, quantity, multiplier, atr, volume, provider):
    if not all(math.isfinite(float(x)) for x in (base, quantity, multiplier, atr, volume)) or base <= 0 or atr < 0 or volume <= 0:
        raise ValueError("ATR/volume impact needs 20 prior complete, positive-volume candles; enable automatic warm-up")
    units = quantity if provider == "gateio" else quantity*multiplier
    participation = units/volume
    return .5 * atr/base * math.sqrt(participation) * 10000, participation
