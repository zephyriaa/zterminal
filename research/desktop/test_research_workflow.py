"""Independent expectations for the synthetic research contract and artifacts."""
import copy
import tempfile
import unittest
from pathlib import Path
import numpy as np
from archive import Archive
from engine import execute
from research_analysis import artifact, assess, execute_analysis, prefix_checks, simulate_returns, stationary_indices
from test_engine import fixture
from validation import digest


def modern(source=None, prices=None, **patch):
    request = fixture(source, prices)
    request["config"].update(executionModel="synthetic_next_open_v2", tickSize=.1, minimumQuantity=1, minimumNotional=0,
                             spreadBps=0, warmupBars=0, executionDelayBars=1, reserveHoldout=False)
    request["config"].update(patch)
    return request


def history(days=400, reserve=True):
    request = modern('''import pandas as pd
import zterminal as zt
PARAMETERS = {'period': zt.input.integer(4, min=3, max=12)}
def strategy(data, params):
    i = pd.Series(range(len(data)), index=data.index)
    return zt.Strategy(i % params['period'] == 0, i % params['period'] == 2)
''', [100+i*.2+(i%4)*.1 for i in range(days)], reserveHoldout=reserve)
    start = request["config"]["from"]
    for i, bar in enumerate(request["dataset"]["bars"]): bar["t"] = start+i*86_400_000
    for target in (request["config"], request["dataset"]): target.update(timeframe="1d", to=start+days*86_400_000)
    request["dataset"]["hash"] = digest([[b[k] for k in ("t", "o", "h", "l", "c", "v")] for b in request["dataset"]["bars"]])
    return request


class AccountingTests(unittest.TestCase):
    def test_manual_long_and_synthetic_short(self):
        long = execute(modern())
        # Independent pencil calculation: 10 units bought at 12, sold at 11.
        self.assertEqual(long["trades"][0]["pnl"], -10)
        self.assertEqual(long["accounts"][1]["cash"], 880)
        self.assertEqual(long["accounts"][1]["reservedCapital"], 120)
        self.assertEqual(long["accounts"][1]["unrealizedPnl"], 5)
        self.assertEqual(long["accounts"][-1]["equity"], 990)
        request = modern(direction="both")
        request["source"] = request["source"].replace('zt.Strategy(i == 0, i == 2)', 'zt.Strategy(i < 0, i < 0, i == 0, i == 2)')
        short = execute(request)
        self.assertEqual(short["accounts"][1]["cash"], 880)  # No spendable short-sale proceeds.
        self.assertEqual(short["accounts"][1]["holdings"], -10)
        self.assertEqual(short["trades"][0]["pnl"], 10)
        self.assertEqual(short["accounts"][-1]["equity"], 1010)

    def test_manual_costs_rounding_no_double_spread(self):
        result = execute(modern(feeBps=100, slippageBps=100, spreadBps=100))
        trade = result["trades"][0]
        self.assertEqual((trade["quantity"], trade["entryPrice"], trade["exitPrice"]), (9, 12.2, 10.8))
        self.assertAlmostEqual(trade["fees"], 2.07)
        self.assertAlmostEqual(trade["pnl"], -14.67)
        self.assertAlmostEqual(result["metrics"]["slippageCost"]["value"], 2.07)
        self.assertAlmostEqual(result["metrics"]["spreadCost"]["value"], 1.035)
        self.assertAlmostEqual(result["metrics"]["tickRoundingCost"]["value"], .495)
        self.assertAlmostEqual(result["accounts"][-1]["equity"], 985.33)
        Archive.validate_result(result)

    def test_rejections_and_unsupported_orders(self):
        result = execute(modern(minimumNotional=100000))
        self.assertEqual(result["trades"], [])
        self.assertEqual(result["orders"][0]["status"], "rejected")
        for key in ("stopLoss", "takeProfit", "limitPrice", "leverage"):
            with self.subTest(key=key), self.assertRaisesRegex(ValueError, "Unsupported"):
                execute(modern(**{key: 10}))
        request = modern()
        request["source"] = request["source"].replace('return zt.Strategy(i == 0, i == 2)', 's = zt.Strategy(i == 0, i == 2)\n    s.stop_loss = 10\n    return s')
        with self.assertRaisesRegex(ValueError, "unsupported"): execute(request)

    def test_account_invariants_and_determinism(self):
        a, b = execute(modern()), execute(modern())
        self.assertEqual(a["evidenceHash"], b["evidenceHash"])
        self.assertNotEqual(a["id"], b["id"])
        for state in a["accounts"]:
            self.assertAlmostEqual(state["cash"]+state["reservedCapital"]+state["unrealizedPnl"], state["equity"])
        for fill in a["fills"]: self.assertLess(fill["decisionTime"], fill["eligibleTime"])
        altered = copy.deepcopy(a)
        altered["accounts"][0]["cash"] += 1
        with self.assertRaisesRegex(ValueError, "hash"): Archive.validate_result(altered)

    def test_open_position_fees_and_split_exit(self):
        request = modern(feeBps=100)
        request["source"] = request["source"].replace('i == 2', 'i < 0')
        open_result = execute(request)
        self.assertEqual(open_result["trades"][0]["status"], "open")
        self.assertEqual(len(open_result["fills"]), 1)
        Archive.validate_result(open_result)
        request["config"]["closeAtEnd"] = True
        closed = execute(request)
        self.assertEqual(closed["trades"][0]["exitReason"], "split_boundary")
        self.assertEqual(closed["fills"][-1]["basePrice"], 15.5)
        Archive.validate_result(closed)

    def test_warmup_first_eligible_and_final_bar(self):
        self.assertEqual(execute(modern(warmupBars=1))["trades"], [])
        request = modern()
        request["source"] = request["source"].replace('i == 0', 'i == 5')
        self.assertEqual(execute(request)["fills"], [])

    def test_reserved_holdout_never_reaches_python(self):
        request = history(100)
        request["source"] = 'import zterminal as zt\ndef strategy(data, params):\n    assert len(data)==80\n    return zt.Strategy(data.close<0, data.close<0)'
        result = execute(request)
        self.assertEqual(len(result["dataset"]["bars"]), 100)
        self.assertEqual(len(result["equity"]), 80)
        Archive.validate_result(result)

    def test_invalid_metadata_bars_and_params(self):
        for key in ("tickSize", "minimumQuantity", "minimumNotional", "spreadBps"):
            request = modern(); del request["config"][key]
            with self.assertRaises(ValueError): execute(request)
        for kind in ("duplicate", "gap", "ohlc"):
            request = modern()
            if kind == "duplicate": request["dataset"]["bars"][1]["t"] = request["dataset"]["bars"][0]["t"]
            if kind == "gap": request["dataset"]["bars"].pop()
            if kind == "ohlc": request["dataset"]["bars"][0]["h"] = 1
            with self.assertRaises(ValueError): execute(request)
        request = history(100); request["params"] = {"period": 2}
        with self.assertRaisesRegex(ValueError, "constraints"): execute(request)


class AnalysisTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls): cls.parent = execute(history())

    def test_seeded_simulations_and_permutation_terminal_invariant(self):
        options = {"method": "trade_permutation", "simulations": 100, "seed": 7}
        a = simulate_returns(self.parent, options, lambda _: None)
        b = simulate_returns(self.parent, options, lambda _: None)
        self.assertEqual(a, b)
        self.assertAlmostEqual(max(a["endingEquity"]), min(a["endingEquity"]))
        daily = simulate_returns(self.parent, {"simulations": 100}, lambda _: None)
        self.assertEqual(daily["horizonUnit"], "days")
        self.assertEqual(len(daily["excessReturnInterval"]), 2)

    def test_stationary_indices_reference_and_validation(self):
        # Expected block length 1 is IID restarts at every transition.
        idx = stationary_indices(np.random.default_rng(3), 10, 1000, 1, 2)
        self.assertTrue(((idx >= 0) & (idx < 10)).all())
        self.assertEqual(idx.tolist(), stationary_indices(np.random.default_rng(3), 10, 1000, 1, 2).tolist())
        with self.assertRaises(ValueError): simulate_returns(execute(modern()), {}, lambda _: None)
        with self.assertRaises(ValueError): simulate_returns(self.parent, {"horizon": 200000}, lambda _: None)
        bad = copy.deepcopy(self.parent); bad["dailyReturns"][0]["return"] = -1
        with self.assertRaises(ValueError): simulate_returns(bad, {}, lambda _: None)

    def test_future_dependent_signal_fails_prefix_checks(self):
        parent = copy.deepcopy(self.parent)
        parent["source"] = 'import zterminal as zt\ndef strategy(data, params):\n    return zt.Strategy(data.close > data.close.mean(), data.close < 0)'
        self.assertEqual(prefix_checks(parent, lambda _: None)["status"], "failed")

    def test_validation_freezes_selection_and_holdout_reuse(self):
        selection = execute_analysis({"result": self.parent, "kind": "validation", "options": {"grid": {"period": [4, 5]}}}, lambda _: None)
        self.assertFalse(selection["payload"]["holdoutEvaluated"])
        self.assertEqual(len(selection["payload"]["walkForward"]), 3)
        self.assertTrue(all(t["end"] <= 320 for t in selection["payload"]["trials"]))
        with tempfile.TemporaryDirectory() as root:
            archive = Archive(Path(root)/"research.sqlite3")
            archive.save_result(self.parent)
            archive.save_analysis(selection)
            access = archive.holdout_access(self.parent, selection)
            self.assertEqual(access["count"], 1)
            evaluation = execute_analysis({"result": self.parent, "kind": "holdout", "selection": selection, "access": access}, lambda _: None)
            archive.save_analysis(evaluation)
            self.assertEqual(archive.result(self.parent["id"]), self.parent)
            access2 = archive.holdout_access(self.parent, selection)
            evaluation2 = execute_analysis({"result": self.parent, "kind": "holdout", "selection": selection, "access": access2}, lambda _: None)
            self.assertEqual(evaluation2["payload"]["assessment"]["label"], "Insufficient evidence")
            self.assertEqual(len(archive.analyses(self.parent["id"])), 2)
            fresh = Archive(Path(root)/"imported.sqlite3")
            bundle = {"result": self.parent, "analyses": archive.analyses(self.parent["id"]), "holdoutUsage": archive.holdout_usage(self.parent["id"])}
            fresh.import_bundle(bundle)
            self.assertEqual(fresh.result(self.parent["id"]), self.parent)
            self.assertEqual(fresh.holdout_usage(self.parent["id"])[0]["count"], 2)
            self.assertEqual(fresh.holdout_access(self.parent, selection)["count"], 3)
            self.assertGreaterEqual(len(evaluation["payload"]["assessment"]["text"].split()), 150)
            self.assertLessEqual(len(evaluation["payload"]["assessment"]["text"].split()), 250)

    def test_ordinary_backtest_assessment_and_artifact_integrity(self):
        assessment = assess(self.parent)
        self.assertEqual(assessment["label"], "Insufficient evidence")
        with tempfile.TemporaryDirectory() as root:
            archive = Archive(Path(root)/"research.sqlite3"); archive.save_result(self.parent)
            value = artifact(self.parent, "assessment", assessment)
            value["payload"]["label"] = "tampered"
            with self.assertRaisesRegex(ValueError, "hash"): archive.save_analysis(value)
            malformed = artifact(self.parent, "validation", {"selectedParams": {}})
            with self.assertRaisesRegex(ValueError, "selection"): archive.save_analysis(malformed)


if __name__ == "__main__": unittest.main()
