"""Tests for intrabar bracket execution, dynamic volatility sizing, and session/orderflow feeds."""
import unittest
import numpy as np
import pandas as pd

from engine import execute, digest
import zterminal as zt


def make_dataset(bars):
    start = bars[0]["t"]
    to = bars[-1]["t"] + 3_600_000
    config = {
        "provider": "gateio", "symbol": "BTC_USDT", "timeframe": "1h", "from": start,
        "to": to, "initialCapital": 10000, "feeBps": 0, "slippageBps": 0,
        "allocation": 1.0, "direction": "long", "multiplier": 1, "quantityStep": 1,
        "executionModel": "synthetic_next_open_v2", "tickSize": 0.1, "spreadBps": 0,
        "minimumQuantity": 1, "minimumNotional": 1
    }
    dataset = {
        "provider": "gateio", "symbol": "BTC_USDT", "timeframe": "1h", "from": start, "to": to,
        "version": 1, "product": "perpetual", "bars": bars,
        "hash": digest([[b[k] for k in ("t", "o", "h", "l", "c", "v")] for b in bars])
    }
    return config, dataset


class BracketAndSizingTests(unittest.TestCase):
    def test_stop_loss_intrabar_exit(self):
        # Bar 0: Enter signal generated -> fills at Bar 1 Open (100)
        # Bar 1: O=100, H=102, L=98, C=101
        # Bar 2: O=101, H=103, L=94, C=96 (Low breaches Stop Loss 95)
        # Bar 3: O=96, H=97, L=95, C=96
        start = 1_735_689_600_000
        bars = [
            {"t": start, "o": 99.0, "h": 101.0, "l": 98.0, "c": 100.0, "v": 100},
            {"t": start + 3_600_000, "o": 100.0, "h": 102.0, "l": 98.0, "c": 101.0, "v": 100},
            {"t": start + 7_200_000, "o": 101.0, "h": 103.0, "l": 94.0, "c": 96.0, "v": 100},
            {"t": start + 10_800_000, "o": 96.0, "h": 97.0, "l": 95.0, "c": 96.0, "v": 100},
        ]
        config, dataset = make_dataset(bars)
        source = """import pandas as pd
import zterminal as zt
def strategy(data, params):
    entries = pd.Series([True, False, False, False], index=data.index)
    exits = pd.Series([False, False, False, False], index=data.index)
    # Stop loss at 95.0
    return zt.Strategy(entries, exits, stop_loss=95.0)
"""
        result = execute({"name": "test_sl", "config": config, "dataset": dataset, "params": {}, "source": source})
        self.assertEqual(len(result["trades"]), 1)
        trade = result["trades"][0]
        self.assertEqual(trade["status"], "closed")
        self.assertEqual(trade["entryPrice"], 100.0)
        self.assertEqual(trade["exitPrice"], 95.0)
        self.assertEqual(trade["exitReason"], "stop_loss")

    def test_take_profit_intrabar_exit(self):
        # Bar 0: Enter -> fills at Bar 1 Open (100)
        # Bar 1: O=100, H=102, L=98, C=101
        # Bar 2: O=101, H=110, L=100, C=108 (High breaches Take Profit 108)
        start = 1_735_689_600_000
        bars = [
            {"t": start, "o": 99.0, "h": 101.0, "l": 98.0, "c": 100.0, "v": 100},
            {"t": start + 3_600_000, "o": 100.0, "h": 102.0, "l": 98.0, "c": 101.0, "v": 100},
            {"t": start + 7_200_000, "o": 101.0, "h": 110.0, "l": 100.0, "c": 108.0, "v": 100},
            {"t": start + 10_800_000, "o": 108.0, "h": 109.0, "l": 107.0, "c": 108.0, "v": 100},
        ]
        config, dataset = make_dataset(bars)
        source = """import pandas as pd
import zterminal as zt
def strategy(data, params):
    entries = pd.Series([True, False, False, False], index=data.index)
    exits = pd.Series([False, False, False, False], index=data.index)
    return zt.Strategy(entries, exits, take_profit=108.0)
"""
        result = execute({"name": "test_tp", "config": config, "dataset": dataset, "params": {}, "source": source})
        self.assertEqual(len(result["trades"]), 1)
        trade = result["trades"][0]
        self.assertEqual(trade["status"], "closed")
        self.assertEqual(trade["entryPrice"], 100.0)
        self.assertEqual(trade["exitPrice"], 108.0)
        self.assertEqual(trade["exitReason"], "take_profit")

    def test_pessimistic_tie_breaker(self):
        # Bar 2 breaches BOTH Stop Loss (95) and Take Profit (110): Low=92, High=112
        # Pessimistic resolution must choose Stop Loss!
        start = 1_735_689_600_000
        bars = [
            {"t": start, "o": 99.0, "h": 101.0, "l": 98.0, "c": 100.0, "v": 100},
            {"t": start + 3_600_000, "o": 100.0, "h": 102.0, "l": 98.0, "c": 101.0, "v": 100},
            {"t": start + 7_200_000, "o": 101.0, "h": 112.0, "l": 92.0, "c": 105.0, "v": 100},
            {"t": start + 10_800_000, "o": 105.0, "h": 106.0, "l": 104.0, "c": 105.0, "v": 100},
        ]
        config, dataset = make_dataset(bars)
        source = """import pandas as pd
import zterminal as zt
def strategy(data, params):
    entries = pd.Series([True, False, False, False], index=data.index)
    exits = pd.Series([False, False, False, False], index=data.index)
    return zt.Strategy(entries, exits, stop_loss=95.0, take_profit=110.0)
"""
        result = execute({"name": "test_tie", "config": config, "dataset": dataset, "params": {}, "source": source})
        self.assertEqual(len(result["trades"]), 1)
        trade = result["trades"][0]
        self.assertEqual(trade["exitPrice"], 95.0)
        self.assertEqual(trade["exitReason"], "stop_loss")

    def test_gap_open_below_stop(self):
        # Bar 2 gaps down at open to 90.0, which is already below Stop Loss (95.0)
        # Execution must be at the open price (90.0), not the stop price (95.0)
        start = 1_735_689_600_000
        bars = [
            {"t": start, "o": 99.0, "h": 101.0, "l": 98.0, "c": 100.0, "v": 100},
            {"t": start + 3_600_000, "o": 100.0, "h": 102.0, "l": 98.0, "c": 101.0, "v": 100},
            {"t": start + 7_200_000, "o": 90.0, "h": 92.0, "l": 88.0, "c": 89.0, "v": 100},
            {"t": start + 10_800_000, "o": 89.0, "h": 91.0, "l": 88.0, "c": 90.0, "v": 100},
        ]
        config, dataset = make_dataset(bars)
        source = """import pandas as pd
import zterminal as zt
def strategy(data, params):
    entries = pd.Series([True, False, False, False], index=data.index)
    exits = pd.Series([False, False, False, False], index=data.index)
    return zt.Strategy(entries, exits, stop_loss=95.0)
"""
        result = execute({"name": "test_gap", "config": config, "dataset": dataset, "params": {}, "source": source})
        trade = result["trades"][0]
        self.assertEqual(trade["exitPrice"], 90.0)
        self.assertEqual(trade["exitReason"], "stop_loss")

    def test_max_hold_bars_and_cooldown(self):
        # Enters at Bar 1. max_hold_bars = 2. Must close at Bar 3 Open.
        # Bar 3 has another entry signal, but cooldown_bars = 2. Must be rejected.
        start = 1_735_689_600_000
        bars = [
            {"t": start + i * 3_600_000, "o": 100.0 + i, "h": 102.0 + i, "l": 99.0 + i, "c": 101.0 + i, "v": 100}
            for i in range(6)
        ]
        config, dataset = make_dataset(bars)
        source = """import pandas as pd
import zterminal as zt
def strategy(data, params):
    # Signals at bar 0 (executes at bar 1) and bar 2 (executes at bar 3)
    entries = pd.Series([True, False, True, False, False, False], index=data.index)
    exits = pd.Series([False] * len(data), index=data.index)
    return zt.Strategy(entries, exits, max_hold_bars=2, cooldown_bars=2)
"""
        result = execute({"name": "test_hold", "config": config, "dataset": dataset, "params": {}, "source": source})
        self.assertEqual(len(result["trades"]), 1)
        trade = result["trades"][0]
        self.assertEqual(trade["exitReason"], "max_hold_bars")
        self.assertEqual(trade["exitPrice"], 103.0) # Bar 3 Open
        # Check order rejections for cooldown
        cooldown_rejections = [o for o in result["orders"] if o["reason"] == "cooldown_lockout"]
        self.assertTrue(len(cooldown_rejections) >= 1)

    def test_dynamic_volatility_sizing(self):
        start = 1_735_689_600_000
        bars = [
            {"t": start + i * 3_600_000, "o": 100.0, "h": 105.0, "l": 95.0, "c": 100.0, "v": 100}
            for i in range(4)
        ]
        config, dataset = make_dataset(bars)
        source = """import pandas as pd
import zterminal as zt
def strategy(data, params):
    entries = pd.Series([True, False, False, False], index=data.index)
    exits = pd.Series([False, False, True, False], index=data.index)
    # Explicit sizing: 7 contracts
    sizing = pd.Series([7.0, 7.0, 7.0, 7.0], index=data.index)
    return zt.Strategy(entries, exits, sizing=sizing)
"""
        result = execute({"name": "test_sizing", "config": config, "dataset": dataset, "params": {}, "source": source})
        trade = result["trades"][0]
        self.assertEqual(trade["quantity"], 7.0)

    def test_native_session_and_orderflow_context(self):
        start = 1_735_689_600_000
        bars = [
            {"t": start + i * 3_600_000, "o": 100.0, "h": 105.0, "l": 95.0, "c": 100.0, "v": 100}
            for i in range(4)
        ]
        config, dataset = make_dataset(bars)
        source = """import pandas as pd
import zterminal as zt
def strategy(data, params):
    # Verify data.session and order flow attributes exist
    assert hasattr(data, "session")
    assert hasattr(data.session, "RTH")
    assert hasattr(data.session, "ETH")
    assert hasattr(data.session, "between")
    assert "delta" in data.columns
    assert "cvd" in data.columns
    assert "large_prints" in data.columns
    return zt.Strategy(pd.Series(False, index=data.index), pd.Series(False, index=data.index))
"""
        result = execute({"name": "test_ctx", "config": config, "dataset": dataset, "params": {}, "source": source})
        self.assertEqual(result["trades"], [])


if __name__ == "__main__":
    unittest.main()
