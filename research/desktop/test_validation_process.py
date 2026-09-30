"""Real authenticated loopback + fresh bounded CPython validation jobs on Windows."""
import os
import time
import unittest

import test_helper
from test_validation_engine import parent_run, PERIODIC


@unittest.skipUnless(os.name == "nt", "Windows Job Object execution required")
class ValidationProcessTests(test_helper.APITests):
    # Reuse only API setup/request helpers, not the parent's test methods.
    test_origin_host_auth_and_pairing = None
    test_pairing_attempt_limit_and_non_json_rejected = None

    def tearDown(self):
        if self.service.controller.active:
            self.service.controller.cancel(self.service.controller.active["id"])
        deadline = time.monotonic() + 10
        while self.service.controller.active and time.monotonic() < deadline:
            time.sleep(.05)
        super().tearDown()

    def pair(self):
        status, paired = self.request("POST", "/v1/pair", {"code": self.service.code})
        self.assertEqual(status, 200)
        return {"Authorization": "Bearer " + paired["token"]}

    def wait_job(self, job):
        deadline = time.monotonic() + 90
        while time.monotonic() < deadline:
            state = self.service.controller.status(job["id"])
            if state["stage"] in ("complete", "failed", "cancelled"):
                return state
            time.sleep(.1)
        self.fail("Validation job exceeded integration-test deadline")

    def test_authenticated_validation_executes_and_reopens_evidence(self):
        parent = parent_run()
        self.service.archive.save_result(parent)
        route = f"/v1/results/{parent['id']}/validate"
        self.assertEqual(self.request("POST", route, {"config": {}})[0], 403)
        auth = self.pair()
        self.assertEqual(self.request("POST", route, {"config": {}, "baseline": {"sharpe": 100}}, **auth)[0], 400)
        status, job = self.request("POST", route, {"config": {"monteCarloPaths": 100, "costTiersBps": [0, 10]}}, **auth)
        self.assertEqual(status, 202)
        done = self.wait_job(job)
        self.assertEqual(done["stage"], "complete", done)
        status, report = self.request("GET", f"/v1/validations/{done['resultId']}", **auth)
        self.assertEqual(status, 200)
        self.assertEqual(report["sourceRunId"], parent["id"])
        self.assertEqual(report["provenance"]["execution"], "helper_fresh_cpython_processes")
        self.assertEqual(len(report["evidenceRuns"]), 4)
        status, reports = self.request("GET", f"/v1/results/{parent['id']}/validations", **auth)
        self.assertEqual(status, 200)
        self.assertEqual(reports, [report])
        export_route = f"/v1/validations/{report['id']}/export"
        self.assertEqual(self.request("GET", export_route)[0], 403)
        status, exported = self.request("GET", export_route, **auth)
        self.assertEqual(status, 200)
        from artifacts import verify_bundle
        self.assertEqual(verify_bundle(exported)["runCount"], 5)
        self.assertEqual(exported["validation"], report)
        for ref in report["evidenceRuns"].values():
            run = self.service.archive.result(ref["id"])
            self.assertEqual(run["source"], parent["source"])
        self.assertEqual(self.request("POST", "/v1/validations", report, **auth)[0], 400)

    def test_one_failed_variant_archives_no_partial_results_or_report(self):
        source = PERIODIC.replace("i = pd.Series", "if len(data) < 30: raise RuntimeError('later window failure')\n    i = pd.Series")
        parent = parent_run(source)
        self.service.archive.save_result(parent)
        auth = self.pair()
        status, job = self.request("POST", f"/v1/results/{parent['id']}/validate", {"config": {"costTiersBps": [0, 10]}}, **auth)
        self.assertEqual(status, 202)
        done = self.wait_job(job)
        self.assertEqual(done["stage"], "failed")
        self.assertIn("later window failure", done["diagnostic"]["message"])
        self.assertEqual(len(self.service.archive.results()), 1)
        self.assertEqual(self.service.archive.validations_for_run(parent["id"]), [])

    def test_reproduction_link_is_hashed_persistent_and_exact(self):
        parent = parent_run()
        self.service.archive.save_result(parent)
        auth = self.pair()
        route = f"/v1/results/{parent['id']}/reproduce"
        self.assertEqual(self.request("POST", route, {"params": {"x": 99}}, **auth)[0], 400)
        status, job = self.request("POST", route, {}, **auth)
        self.assertEqual(status, 202)
        done = self.wait_job(job)
        self.assertEqual(done["stage"], "complete", done)
        child = self.service.archive.result(done["resultId"])
        self.assertEqual(child["reproducedFrom"], parent["id"])
        self.assertEqual(child["reproduction"]["status"], "matched")
        for field in ("source", "config", "dataset", "params", "metrics", "trades", "equity"):
            self.assertEqual(child[field], parent[field])
        self.service.archive.validate_result(child)
        from archive import Archive
        restarted = Archive(self.service.archive.path)
        self.assertEqual(restarted.result(child["id"]), child)
        self.assertEqual(self.request("POST", "/v1/results", child, **auth)[0], 400)
        status, validation_job = self.request("POST", f"/v1/results/{child['id']}/validate", {"config": {"monteCarloPaths": 100, "costTiersBps": [0, 10]}}, **auth)
        self.assertEqual(status, 202, validation_job)
        validated = self.wait_job(validation_job)
        self.assertEqual(validated["stage"], "complete", validated)
        bundle = restarted.export_validation(validated["resultId"])
        from artifacts import verify_bundle
        self.assertEqual(verify_bundle(bundle)["runCount"], 6)  # child, ancestor, baseline, IS, OOS, cost
        exported = {run["id"]: run for run in bundle["runs"]}
        self.assertEqual(exported[child["id"]]["reproducedFrom"], parent["id"])
        self.assertEqual(exported[parent["id"]], parent)

    def test_cancellation_kills_validation_process_tree(self):
        source = PERIODIC.replace("i = pd.Series", "if len(data) < 30:\n        import time\n        time.sleep(60)\n    i = pd.Series")
        parent = parent_run(source)
        self.service.archive.save_result(parent)
        auth = self.pair()
        status, job = self.request("POST", f"/v1/results/{parent['id']}/validate", {"config": {"costTiersBps": [0, 10]}}, **auth)
        self.assertEqual(status, 202)
        # Wait until the orchestrator starts, then exercise inherited Job kill.
        deadline = time.monotonic() + 10
        while self.service.controller.status(job["id"])["stage"] == "validating" and time.monotonic() < deadline:
            time.sleep(.05)
        self.service.controller.cancel(job["id"])
        done = self.wait_job(job)
        self.assertEqual(done["stage"], "cancelled", done)
        self.assertEqual(len(self.service.archive.results()), 1)
        self.assertEqual(self.service.archive.validations_for_run(parent["id"]), [])

    def test_nondeterministic_reproduction_is_persisted_as_different(self):
        from pathlib import Path
        from engine import execute
        from test_engine import fixture
        counter = str(Path(self.temp.name) / "counter.json")
        source = f'''import pandas as pd
import zterminal as zt
from pathlib import Path
def strategy(data, params):
    path = Path({counter!r})
    value = int(path.read_text()) + 1 if path.exists() else 1
    path.write_text(str(value))
    i = pd.Series(range(len(data)), index=data.index)
    return zt.Strategy(i == 0, i == 2, plots={{"counter": data.close * 0 + value}})
'''
        parent = execute(fixture(source))
        self.service.archive.save_result(parent)
        auth = self.pair()
        status, job = self.request("POST", f"/v1/results/{parent['id']}/reproduce", {}, **auth)
        self.assertEqual(status, 202)
        done = self.wait_job(job)
        self.assertEqual(done["stage"], "complete", done)
        rerun = self.service.archive.result(done["resultId"])
        self.assertEqual(rerun["reproduction"]["status"], "different")
        self.assertIn("plots", rerun["reproduction"]["differences"])


if __name__ == "__main__":
    unittest.main()
