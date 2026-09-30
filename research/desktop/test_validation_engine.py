"""Explicitly simulated OHLC fixtures execute actual Python, not invented trade PnLs."""
import copy
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from archive import Archive, digest, encode
from engine import execute
from test_engine import fixture
from validation_engine import normalize_config, static_plan, parameter_candidates, request_for, windows, select_training, verify_evidence, summarize, regime_labels

PERIODIC = '''import pandas as pd
import zterminal as zt
def strategy(data, params):
    i = pd.Series(range(len(data)), index=data.index)
    return zt.Strategy(i % 4 == 0, i % 4 == 2)
'''


def parent_run(source=PERIODIC, n=80, params=None):
    request = fixture(source, prices=([100, 100, 100.5, 101] * ((n + 3) // 4))[:n], allocation=1, quantityStep=.001)
    request["params"] = params or {"x": 2, "y": 2}
    request["dataset"]["simulated"] = True
    return execute(request)


def config(parent, **changes):
    return normalize_config({"monteCarloPaths": 100, "costTiersBps": [0, 10, 100], **changes}, parent)


def evidence_for(parent, cfg):
    evidence = {key: execute(req) for key, req in static_plan(parent, cfg)}
    for cycle, (a, b, c, d) in enumerate(windows(len(parent["dataset"]["bars"]), cfg)):
        candidates = parameter_candidates(parent, cfg) if cfg["walkForward"]["optimize"] else [parent["params"]]
        training = []
        for i, params in enumerate(candidates):
            child = execute(request_for(parent, a, b, params))
            evidence[f"wf:{cycle}:train:{i}"] = child
            training.append(child)
        selected = select_training(training)
        evidence[f"wf:{cycle}:test"] = execute(request_for(parent, c, d, candidates[selected]))
    verify_evidence(parent, cfg, evidence, Archive.validate_result)
    return evidence


GRID = {"paramX": {"name": "x", "min": 1, "max": 3, "steps": 3},
        "paramY": {"name": "y", "min": 1, "max": 3, "steps": 3}}


class ValidationEngineTests(unittest.TestCase):
    def test_exact_chronological_runs_use_helper_metrics_and_boundary_bars(self):
        parent = parent_run()
        cfg = config(parent)
        runs = evidence_for(parent, cfg)
        report = summarize(parent, cfg, runs)
        split = report["outOfSample"]
        earlier, later = runs["is"], runs["oos"]
        self.assertEqual(earlier["dataset"]["bars"], parent["dataset"]["bars"][:56])
        self.assertEqual(later["dataset"]["bars"], parent["dataset"]["bars"][57:])
        self.assertLess(earlier["config"]["to"], later["config"]["from"])
        for field in ("totalReturn", "sharpe", "maxDrawdown", "netProfit"):
            self.assertEqual(split["outOfSampleMetrics"][field], later["metrics"][field]["value"])
        self.assertIsNone(split["outOfSampleMetrics"]["sharpe"])
        self.assertEqual(split["degradation"]["rating"], "inconclusive")
        self.assertGreater(later["trades"][0]["entryTime"], later["config"]["from"])
        self.assertNotEqual(earlier["dataset"]["hash"], later["dataset"]["hash"])

    def test_stable_surface_and_overfit_spike_are_measured_by_python(self):
        stable = parent_run()
        cfg = config(stable, sensitivityGrid=GRID)
        stable_report = summarize(stable, cfg, evidence_for(stable, cfg))
        self.assertEqual(stable_report["sensitivity"]["surfaceClassification"], "broad_plateau")
        spike_source = PERIODIC.replace("i % 4 == 0", "(i % 4 == 0) & (params['x'] == 2) & (params['y'] == 2)")
        spike = parent_run(spike_source)
        spike_cfg = config(spike, sensitivityGrid=GRID)
        report = summarize(spike, spike_cfg, evidence_for(spike, spike_cfg))
        self.assertEqual(report["sensitivity"]["surfaceClassification"], "narrow_spike")
        cells = [cell for row in report["sensitivity"]["grid"] for cell in row]
        self.assertEqual(sum(cell["trades"] > 0 for cell in cells), 1)
        self.assertEqual(len({cell["run"]["id"] for cell in cells}), 9)

    def test_cost_fragility_reexecutes_sizing_fills_and_open_marks(self):
        parent = parent_run()
        cfg = config(parent)
        runs = evidence_for(parent, cfg)
        report = summarize(parent, cfg, runs)
        tiers = report["costStress"]["tiers"]
        self.assertGreater(tiers[0]["netProfit"], 0)
        self.assertLess(tiers[-1]["netProfit"], 0)
        self.assertEqual(report["costStress"]["breakEvenBracketBps"], [10, 100])
        self.assertIsNone(report["costStress"]["breakEvenFrictionBps"])
        stressed = runs["cost:100"]
        self.assertNotEqual(parent["trades"][0]["entryPrice"], stressed["trades"][0]["entryPrice"])
        self.assertNotEqual(parent["trades"][0]["quantity"], stressed["trades"][0]["quantity"])
        self.assertEqual(tiers[-1]["finalEquity"], stressed["metrics"]["finalEquity"]["value"])

    def test_seeded_monte_carlo_permutation_terminal_is_fixed(self):
        parent = parent_run()
        cfg = config(parent)
        runs = evidence_for(parent, cfg)
        a, b = summarize(parent, cfg, runs), summarize(parent, cfg, runs)
        self.assertEqual(a["monteCarlo"], b["monteCarlo"])
        self.assertEqual(len(set(a["monteCarlo"]["terminalEquity"].values())), 1)
        changed = config(parent, monteCarloMethod="iid_trade_resampling")
        c = summarize(parent, changed, runs)
        self.assertNotEqual(c["monteCarlo"]["terminalEquity"]["p05"], c["monteCarlo"]["terminalEquity"]["p95"])
        self.assertEqual(a["provenance"]["fingerprint"], b["provenance"]["fingerprint"])
        self.assertNotEqual(a["provenance"]["fingerprint"], c["provenance"]["fingerprint"])

    def test_future_prices_cannot_change_prior_regime_labels(self):
        bars = parent_run(n=160)["dataset"]["bars"]
        labels = regime_labels(bars)
        changed = copy.deepcopy(bars)
        for bar in changed[90:]:
            bar["c"] *= 10
        later = regime_labels(changed)
        self.assertEqual(labels[0][:91], later[0][:91])
        self.assertEqual(labels[1][:91], later[1][:91])
        self.assertEqual(labels[0][0], "unknown")
        self.assertEqual(labels[1][49], "unknown")

    def test_rolling_optimizer_only_sees_training_and_never_crosses_test_boundaries(self):
        parent = parent_run(n=100)
        cfg = config(parent, sensitivityGrid=GRID, walkForward={"trainingBars": 40, "testingBars": 20, "stepBars": 20, "optimize": True})
        runs = evidence_for(parent, cfg)
        report = summarize(parent, cfg, runs)
        cycles = report["walkForward"]["cycles"]
        self.assertEqual(len(cycles), 2)
        self.assertEqual(cycles[0]["selectedParams"], {"x": 1, "y": 1})  # stable grid-order ties
        self.assertLessEqual(cycles[0]["outOfSample"]["to"], cycles[1]["outOfSample"]["from"])
        for cycle in cycles:
            self.assertLess(cycle["inSample"]["to"], cycle["outOfSample"]["from"])
        altered = copy.deepcopy(runs)
        altered["wf:0:test"]["metrics"]["totalReturn"]["value"] = 100
        training = [altered[f"wf:0:train:{i}"] for i in range(9)]
        self.assertEqual(select_training(training), 0)
        wrong = execute(request_for(parent, 41, 61, {"x": 3, "y": 3}))
        altered["wf:0:test"] = wrong
        with self.assertRaisesRegex(ValueError, "inputs differ"):
            verify_evidence(parent, cfg, altered, Archive.validate_result)

    def test_future_data_trap_cannot_reach_first_training_selection(self):
        # Deliberately noncausal source exposes whole-frame leakage. Training
        # frames must end before later prices even if source reads their last row.
        source = PERIODIC.replace("i % 4 == 0", "(i % 4 == 0) & (params['x'] == int(data.close.iloc[-1] // 100))")
        first = parent_run(source, n=100)
        request = request_for(first)
        for bar in request["dataset"]["bars"][41:]:
            for field in ("o", "h", "l", "c"):
                bar[field] += 200
        request["dataset"]["hash"] = digest([[b[k] for k in ("t", "o", "h", "l", "c", "v")] for b in request["dataset"]["bars"]])
        second = execute(request)
        wf = {"trainingBars": 40, "testingBars": 20, "stepBars": 20, "optimize": True}
        selections = []
        for parent in (first, second):
            cfg = config(parent, sensitivityGrid=GRID, walkForward=wf)
            report = summarize(parent, cfg, evidence_for(parent, cfg))
            selections.append(report["walkForward"]["cycles"][0]["selectedParams"])
        self.assertEqual(selections[0], {"x": 1, "y": 1})
        self.assertEqual(selections[0], selections[1])

    def test_concentrated_and_regime_dependent_simulated_price_paths(self):
        parent = parent_run(n=160)
        req = request_for(parent)
        # A single profitable event, all other completed trades are flat.
        for i, bar in enumerate(req["dataset"]["bars"]):
            price = 200 if i == 123 else 100
            bar.update(o=price, h=price + 1, l=price - 1, c=price)
        req["dataset"]["hash"] = digest([[b[k] for k in ("t", "o", "h", "l", "c", "v")] for b in req["dataset"]["bars"]])
        concentrated = execute(req)
        cfg = config(concentrated)
        report = summarize(concentrated, cfg, evidence_for(concentrated, cfg))
        self.assertEqual(report["concentration"]["top5TradesProfitPct"], 100)
        self.assertEqual(report["concentration"]["herfindahlIndex"], 1)
        self.assertEqual(sum(r["profitContributionPct"] or 0 for r in report["regimes"]["volatilityRegimes"]), 100)
        self.assertEqual(report["regimes"]["dominantRegimePct"], 100)

    def test_indicator_warmup_and_next_open_restart_in_each_test_window(self):
        source = PERIODIC.replace("i % 4 == 0", "(i == 4) & data.close.rolling(5).mean().notna()").replace("i % 4 == 2", "i == 6")
        parent = parent_run(source, n=100)
        cfg = config(parent, walkForward={"trainingBars": 40, "testingBars": 20, "stepBars": 20, "optimize": False})
        runs = evidence_for(parent, cfg)
        for cycle in range(2):
            child = runs[f"wf:{cycle}:test"]
            self.assertEqual(child["trades"][0]["entryTime"], child["config"]["from"] + 5 * 3600000)
            self.assertEqual(child["trades"][0]["exitTime"], child["config"]["from"] + 7 * 3600000)

    def test_deliberately_high_volatility_edge_is_exposed_by_regime_attribution(self):
        source = PERIODIC.replace("i % 4 == 0", "(i % 4 == 0) & (data.close.pct_change().rolling(20).std() > .02)")
        high_volatility = [price for amplitude in range(5, 25) for price in (100, 100, 100 + amplitude, 100 + 2 * amplitude)]
        request = fixture(source, prices=[100, 100, 100.5, 101] * 40 + high_volatility + [100, 100, 100.5, 101] * 40, allocation=1, quantityStep=.001)
        request["params"] = {"x": 2, "y": 2}
        request["dataset"]["simulated"] = True
        parent = execute(request)
        cfg = config(parent)
        report = summarize(parent, cfg, evidence_for(parent, cfg))
        groups = {row["regime"]: row for row in report["regimes"]["volatilityRegimes"]}
        self.assertGreater(parent["metrics"]["netProfit"]["value"], 0)
        self.assertGreater(groups["high"]["profitContributionPct"], 50)
        self.assertGreater(groups["high"]["tradesCount"], 0)
        self.assertGreater(groups["normal"]["barsCount"], groups["high"]["barsCount"])

    def test_zero_trades_remain_zero_and_undefined_statistics_remain_null(self):
        source = "import zterminal as zt\ndef strategy(data, params):\n    return zt.Strategy(data.close < 0, data.close < 0)"
        parent = parent_run(source)
        cfg = config(parent)
        report = summarize(parent, cfg, evidence_for(parent, cfg))
        self.assertEqual(report["baseline"]["totalTrades"], 0)
        self.assertEqual(report["baseline"]["netProfit"], 0)
        self.assertIsNone(report["monteCarlo"])
        self.assertIsNone(report["concentration"]["top5TradesProfitPct"])
        self.assertIsNone(report["costStress"]["tiers"][0]["expectancy"])
        self.assertIsNone(report["outOfSample"]["degradation"]["winRateDelta"])

    def test_rejects_invalid_configs_and_numerically_fabricated_parent(self):
        parent = parent_run()
        for invalid in ({"monteCarloSeed": True}, {"purgeBars": 0}, {"costTiersBps": [1, 10]},
                        {"sensitivityGrid": {**GRID, "paramY": GRID["paramX"]}},
                        {"walkForward": {"trainingBars": 20, "testingBars": 20, "stepBars": 10, "optimize": False}}):
            with self.assertRaises(ValueError):
                config(parent, **invalid)
        cfg = config(parent)
        runs = evidence_for(parent, cfg)
        fabricated = copy.deepcopy(parent)
        fabricated["metrics"]["sharpe"] = {"value": 100}
        fabricated["resultHash"] = digest({k: v for k, v in fabricated.items() if k != "resultHash"})
        Archive.validate_result(fabricated)  # Internal hashes are insufficient proof of execution.
        with self.assertRaisesRegex(ValueError, "cannot be reproduced"):
            verify_evidence(fabricated, cfg, runs, Archive.validate_result)

    def test_archive_is_atomic_reopens_without_computing_and_rejects_rehashed_tampering(self):
        parent = parent_run()
        cfg = config(parent)
        runs = evidence_for(parent, cfg)
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "research.sqlite3"
            archive = Archive(path)
            archive.save_result(parent)
            request = {"operation": "validation", "result": parent, "config": cfg}
            bad = copy.deepcopy(runs)
            bad.pop("oos")
            with self.assertRaises(ValueError):
                archive.save_generated_validation(request, {"evidence": bad}, "bad-job")
            self.assertEqual(len(archive.results()), 1)
            report = archive.save_generated_validation(request, {"evidence": runs}, "job")
            self.assertEqual(archive.get_job("job")["resultKind"], "validation")
            restarted = Archive(path)
            legacy = {"id": "legacy", "version": 3}
            with restarted.connect() as db:
                db.execute("INSERT INTO validations VALUES(?,?,?,?,?)", ("legacy", parent["id"], report["createdAt"] - 1, "old", encode(legacy)))
            with patch("validation_engine.summarize", side_effect=AssertionError("Must not recompute archived metrics")):
                self.assertEqual(restarted.validation(report["id"]), report)
                self.assertEqual(restarted.validations_for_run(parent["id"]), [report])
            with self.assertRaisesRegex(ValueError, "not Helper-verified"):
                restarted.validation("legacy")
            edited = copy.deepcopy(report)
            edited["baseline"]["sharpe"] = 100
            edited["resultHash"] = digest({k: v for k, v in edited.items() if k != "resultHash"})
            with restarted.connect() as db:
                db.execute("UPDATE validations SET envelope=? WHERE id=?", (encode(edited), report["id"]))
            with self.assertRaisesRegex(ValueError, "integrity check failed"):
                restarted.validation(report["id"])


if __name__ == "__main__":
    unittest.main()
