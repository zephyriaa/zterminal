import copy
import unittest
import numpy as np
import pandas as pd

from engine import execute, execute_indicator, digest, diagnostic, validate
from analytics import report, monte_carlo


def fixture(source=None, prices=None, **options):
    prices = prices or [10, 12, 14, 11, 13, 15]
    start = 1_735_689_600_000
    bars = [{"t": start + i * 3_600_000, "o": p, "h": p + 1, "l": p - 1, "c": p + .5, "v": 100} for i, p in enumerate(prices)]
    config = {"provider": "gateio", "symbol": "BTC_USDT", "timeframe": "1h", "from": start,
              "to": start + len(bars) * 3_600_000, "initialCapital": 1000, "feeBps": 0,
              "slippageBps": 0, "allocation": .12, "direction": "long", "multiplier": 1, "quantityStep": 1}
    config.update(options)
    dataset = {k: config[k] for k in ["provider", "symbol", "timeframe", "from", "to"]}
    dataset.update(version=1, product="perpetual", bars=bars, hash=digest([[b[k] for k in ["t", "o", "h", "l", "c", "v"]] for b in bars]))
    return {"name": "fixture", "config": config, "dataset": dataset, "params": {}, "source": source or '''import pandas as pd
import zterminal as zt
def strategy(data, params):
    i = pd.Series(range(len(data)), index=data.index)
    return zt.Strategy(i == 0, i == 2)
'''}


class ExecutionTests(unittest.TestCase):
    def test_custom_indicator_outputs_are_aligned_hashed_and_bounded_to_input(self):
        request = fixture('''import zterminal as zt
def calculate(data, params):
    return {"fast": zt.ema(data.close, params["length"]), "volume": data.volume}
''')
        request.update(operation="indicator", artifact={"id": "indicator-1", "kind": "indicator", "revision": 3, "name": "Fast EMA"}, params={"length": 2}, outputs={"fast": {"plot": "line"}, "volume": {"plot": "histogram"}})
        result = execute_indicator(request)
        self.assertEqual(result["kind"], "indicator_evaluation")
        self.assertEqual(result["artifact"]["revision"], 3)
        self.assertEqual(result["datasetHash"], request["dataset"]["hash"])
        self.assertEqual(len(result["outputs"]["volume"]["points"]), len(request["dataset"]["bars"]))
        self.assertEqual(result["resultHash"], digest({key: value for key, value in result.items() if key != "resultHash"}))
        truncated = copy.deepcopy(request)
        truncated["dataset"]["bars"] = truncated["dataset"]["bars"][:3]
        truncated["config"]["to"] = truncated["config"]["from"] + 3 * 3_600_000
        truncated["dataset"]["to"] = truncated["config"]["to"]
        truncated["dataset"]["hash"] = digest([[bar[key] for key in ["t", "o", "h", "l", "c", "v"]] for bar in truncated["dataset"]["bars"]])
        replay = execute_indicator(truncated)
        self.assertEqual(len(replay["outputs"]["volume"]["points"]), 3)
        self.assertNotEqual(replay["inputHash"], result["inputHash"])

    def test_custom_indicator_rejects_misaligned_and_infinite_outputs(self):
        for expression in ["data.close.reset_index(drop=True)", "data.close * float('inf')"]:
            request = fixture(f"def calculate(data, params):\n    return {{'bad': {expression}}}")
            request.update(operation="indicator", artifact={"id": "bad", "kind": "indicator", "revision": 1}, outputs={})
            with self.assertRaises((ValueError, TypeError)):
                execute_indicator(request)

    def test_next_open_accounting_and_benchmark(self):
        result = execute(fixture())
        trade = result["trades"][0]
        self.assertEqual(trade["entryPrice"], 12)
        self.assertEqual(trade["exitPrice"], 11)
        self.assertEqual(trade["quantity"], 10)
        self.assertEqual(trade["pnl"], -10)
        self.assertEqual(trade["accountReturn"], -.01)
        self.assertEqual(result["equity"][-1]["equity"], 990)
        self.assertEqual(result["equity"][0]["benchmark"], 1050)
        self.assertIsNone(result["metrics"]["cagr"]["value"])
        self.assertIsNone(result["metrics"]["sharpe"]["value"])

    def test_arbitrary_python_changes_trades(self):
        original = fixture()
        changed = copy.deepcopy(original)
        changed["source"] = changed["source"].replace("i == 2", "i == sum([1, 3])")
        a, b = execute(original), execute(changed)
        self.assertNotEqual(a["trades"][0]["pnl"], b["trades"][0]["pnl"])
        self.assertNotEqual(a["sourceHash"], b["sourceHash"])
        self.assertEqual(b["trades"][0]["exitPrice"], 15)

    def test_errors_are_errors_with_line_diagnostics(self):
        for source, exception, line in [("def strategy(:", SyntaxError, 1), ("def strategy(data, params):\n    return unknown_name", NameError, 2)]:
            try:
                execute(fixture(source))
                self.fail("Invalid code returned a result")
            except exception as error:
                self.assertEqual(diagnostic(error)["line"], line)
        with self.assertRaisesRegex(TypeError, "Unsupported output"):
            execute(fixture("def strategy(data, params):\n    return [1, 2]"))

    def test_fees_quantity_and_multiplier(self):
        result = execute(fixture(feeBps=100, multiplier=2))
        trade = result["trades"][0]
        # 120 cash budget / (12 * 2 * 1.01) -> 4 whole contracts.
        self.assertEqual(trade["quantity"], 4)
        self.assertAlmostEqual(trade["fees"], 1.84)
        self.assertAlmostEqual(trade["pnl"], -9.84)

    def test_open_position_and_no_final_bar_fill(self):
        request = fixture()
        request["source"] = request["source"].replace("i == 2", "i == 5")
        result = execute(request)
        trade = result["trades"][0]
        self.assertEqual(trade["status"], "open")
        self.assertIsNone(trade["exitTime"])
        self.assertEqual(result["metrics"]["totalTrades"]["value"], 0)
        self.assertEqual(result["equity"][-1]["equity"], 1035)
        request["source"] = request["source"].replace("i == 0", "i == 5").replace("i == 5)", "i == 99)")
        self.assertEqual(execute(request)["trades"], [])

    def test_short_accounting(self):
        request = fixture(direction="both")
        request["source"] = request["source"].replace("zt.Strategy(i == 0, i == 2)", "zt.Strategy(i < 0, i < 0, i == 0, i == 2)")
        trade = execute(request)["trades"][0]
        self.assertEqual(trade["side"], "short")
        self.assertEqual(trade["pnl"], 10)

    def test_conflicts_and_wrong_alignment_rejected(self):
        request = fixture()
        request["source"] = request["source"].replace("i == 2", "i == 0")
        with self.assertRaisesRegex(ValueError, "Conflicting"):
            execute(request)
        request["source"] = request["source"].replace("i == 0, i == 0", "(i == 0).reset_index(drop=True), i == 2")
        with self.assertRaisesRegex(ValueError, "aligned"):
            execute(request)

    def test_dataset_coverage_and_hash(self):
        request = fixture()
        request["dataset"]["bars"][1]["t"] += 1
        with self.assertRaisesRegex(ValueError, "candle"):
            validate(request)
        request = fixture()
        request["dataset"]["hash"] = "fake"
        with self.assertRaisesRegex(ValueError, "SHA-256"):
            validate(request)
        request = fixture()
        request["params"] = {"nested": [1, 2]}
        with self.assertRaisesRegex(ValueError, "parameters"):
            validate(request)

    def test_user_data_mutation_does_not_change_engine_prices(self):
        request = fixture()
        request["source"] = request["source"].replace("    i =", "    data['open'] = 999\n    i =")
        self.assertEqual(execute(request)["trades"][0]["entryPrice"], 12)

    def test_bundled_vectorbt_can_generate_supported_signals(self):
        source = '''import vectorbt as vbt
import zterminal as zt
def strategy(data, params):
    fast = vbt.MA.run(data.close, window=2).ma
    slow = vbt.MA.run(data.close, window=3).ma
    return zt.Strategy(zt.crossover(fast, slow), zt.crossunder(fast, slow))
'''
        result = execute(fixture(source, prices=[10, 9, 8, 9, 10, 8, 7, 9]))
        self.assertEqual(result["engine"]["vectorbt"], "0.28.1")
        self.assertGreaterEqual(len(result["trades"]), 1)


class AnalyticsTests(unittest.TestCase):
    def test_first_complete_daily_return_is_included(self):
        returns = np.array([.03] + [.01, -.005] * 15)
        index = pd.date_range("2025-01-01", periods=len(returns), tz="UTC")
        equity = pd.Series(1000 * np.cumprod(1 + returns), index=index)
        start = int(index[0].value // 1e6)
        result = report(equity, 1000, [], start, start + len(returns) * 86400000, 0)[0]
        self.assertAlmostEqual(result["sharpe"]["value"], returns.mean() / returns.std(ddof=1) * np.sqrt(365))

    def test_drawdown_recovery_and_undefined_metrics(self):
        equity = pd.Series([100, 80, 90, 100, 95], index=pd.date_range("2025-01-01", periods=5, tz="UTC"))
        metrics, dd, periods, _, _ = report(equity, 100, [], int(equity.index[0].value // 1e6), int(equity.index[-1].value // 1e6), 0)
        self.assertAlmostEqual(max(dd), .2)
        self.assertEqual(len(periods), 2)
        self.assertIsNotNone(periods[0]["recovery"])
        self.assertIsNone(periods[1]["recovery"])
        self.assertIsNone(metrics["profitFactor"]["value"])

    def test_seeded_bootstrap_is_reproducible_not_permutation(self):
        result = {"config": {"initialCapital": 1000}, "trades": [{"status": "closed", "accountReturn": v} for v in [-.1, .2, .05]]}
        a, b = monte_carlo(result, 1000, 7), monte_carlo(result, 1000, 7)
        self.assertEqual(a, b)
        self.assertGreater(len(set(a["endingEquity"])), 1)
        self.assertNotEqual(a, monte_carlo(result, 1000, 8))
        self.assertEqual(a["bands"][0]["median"], 1000)
        self.assertEqual(len(a["samplePaths"]), 20)

    def test_daily_ratios_ignore_intraday_sampling_frequency(self):
        index = pd.date_range("2025-01-01", periods=60 * 24, freq="h", tz="UTC")
        equity = pd.Series(1000 * np.cumprod(1 + np.sin(np.arange(len(index))) * .001), index=index)
        start = int(index[0].value // 1e6)
        end = start + 60 * 86400000
        hourly = report(equity, 1000, [], start, end, 0)[0]
        daily = report(equity.resample("D").last(), 1000, [], start, end, 0)[0]
        self.assertAlmostEqual(hourly["sharpe"]["value"], daily["sharpe"]["value"])


if __name__ == "__main__":
    unittest.main()
