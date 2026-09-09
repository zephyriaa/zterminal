import copy
import hashlib
import http.client
import json
from pathlib import Path
import tempfile
import threading
import time
import unittest
import uuid
from unittest.mock import patch

from archive import Archive, digest, encode
from controller import Controller
from engine import execute
from server import Service, Server
from test_engine import fixture


class ArchiveTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.path = Path(self.temp.name) / "archive.sqlite3"
        self.archive = Archive(self.path)

    def tearDown(self):
        self.temp.cleanup()

    def test_script_revisions_conflicts_and_delete_preservation(self):
        a = self.archive.save_script({"name": "Example", "source": "first"})
        b = self.archive.save_script({**a, "source": "second"})
        self.assertEqual(b["revision"], 2)
        with self.assertRaisesRegex(ValueError, "changed"):
            self.archive.save_script(a)
        self.archive.delete_script(a["id"])
        self.assertEqual(len(self.archive.revisions(a["id"])), 2)
        self.assertEqual(self.archive.scripts(), [])
        self.assertEqual(self.archive.save_script({**b, "source": "restored"})["revision"], 3)

    def test_artifact_migration_revisions_and_indicator_evaluation_are_additive(self):
        script = self.archive.save_script({"name": "Strategy", "source": "first"})
        reopened = Archive(self.path)
        migrated = {item["id"]: item for item in reopened.artifacts()}
        self.assertEqual(migrated[script["id"]]["kind"], "strategy")
        indicator = reopened.save_artifact({"kind": "indicator", "name": "EMA", "description": "Example", "source": "def calculate(data, params): pass", "metadata": {"outputs": ["ema"]}})
        indicator = reopened.save_artifact({**indicator, "source": indicator["source"] + "\n"})
        self.assertEqual(indicator["revision"], 2)
        self.assertEqual(len(reopened.artifact_revisions(indicator["id"])), 2)
        result = {"version": 1, "kind": "indicator_evaluation", "id": "evaluation", "createdAt": 1, "artifact": {"id": indicator["id"], "revision": 2, "name": "EMA"}, "sourceHash": hashlib.sha256(indicator["source"].encode()).hexdigest(), "datasetHash": "d" * 64, "inputHash": "i" * 64, "outputs": {"ema": {"plot": "line", "points": []}}, "diagnostics": [], "logs": [], "engine": {}}
        result["resultHash"] = digest(result)
        reopened.save_indicator_evaluation(result, "job")
        self.assertEqual(reopened.indicator_evaluation("evaluation"), result)
        self.assertEqual(reopened.get_job("job")["resultKind"], "indicator")

    def test_result_reopens_offline_export_roundtrip_and_exact_source(self):
        result = execute(fixture())
        self.archive.save_result(result)
        reopened = Archive(self.path).result(result["id"])
        self.assertEqual(result, reopened)
        manifest = {k: result["dataset"][k] for k in ("provider", "product", "symbol", "timeframe", "from", "to")}
        self.assertEqual(self.archive.find_dataset(manifest), result["dataset"])
        self.assertIsNone(self.archive.find_dataset({**manifest, "from": manifest["from"] + 3600000}))
        other = Archive(Path(self.temp.name) / "import.sqlite3")
        other.save_result(json.loads(encode(reopened)))
        self.assertEqual(other.result(result["id"]), result)
        corrupted = copy.deepcopy(result)
        corrupted["source"] += "\n# changed"
        with self.assertRaisesRegex(ValueError, "Source hash"):
            other.save_result(corrupted)

    def test_interrupted_transaction_rolls_back(self):
        with self.assertRaises(RuntimeError):
            with self.archive.connect() as db:
                db.execute("INSERT INTO scripts VALUES('x','draft','source',1,0)")
                raise RuntimeError("simulated interrupted write")
        self.assertEqual(self.archive.scripts(), [])

    def test_restart_marks_unfinished_jobs_failed(self):
        self.archive.save_job({"id": "interrupted", "stage": "saving_result"})
        self.archive.recover_jobs()
        self.assertEqual(self.archive.get_job("interrupted")["stage"], "failed")

    def test_legacy_import_is_non_destructive_and_incomplete(self):
        old = {"language": "EasyLanguage", "source": "Buy next bar at market", "randomHash": "old"}
        self.assertEqual(self.archive.import_legacy(old)["status"], "incomplete")
        self.archive.import_legacy(old)
        self.assertEqual(len(self.archive.legacy()), 1)
        self.assertEqual(self.archive.legacy()[0]["payload"], old)


class APITests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.service = Service(self.temp.name)
        self.server = Server(("127.0.0.1", 0), self.service)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.origin = "https://zterminal.onrender.com"

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()
        self.temp.cleanup()

    def request(self, method, path, body=None, **headers):
        connection = http.client.HTTPConnection("127.0.0.1", self.server.server_port, timeout=5)
        defaults = {"Origin": self.origin, "Content-Type": "application/json"}
        defaults.update(headers)
        connection.request(method, path, encode(body) if body is not None else None, defaults)
        response = connection.getresponse()
        raw = response.read()
        connection.close()
        return response.status, json.loads(raw) if raw else None

    def test_origin_host_auth_and_pairing(self):
        self.assertEqual(self.request("GET", "/v1/capabilities")[0], 200)
        self.assertEqual(self.request("GET", "/v1/scripts")[0], 403)
        self.assertEqual(self.request("GET", "/v1/capabilities", Origin="https://attacker.example")[0], 403)
        self.assertEqual(self.request("GET", "/v1/capabilities", Host="attacker.example")[0], 403)
        status, paired = self.request("POST", "/v1/pair", {"code": self.service.code})
        self.assertEqual(status, 200)
        auth = {"Authorization": "Bearer " + paired["token"]}
        self.assertEqual(self.request("GET", "/v1/scripts", **auth)[0], 200)
        self.assertEqual(self.request("GET", "/v1/scripts", Origin="http://127.0.0.1:3100", **auth)[0], 403)
        self.assertEqual(self.request("POST", "/v1/pair", {"code": self.service.code})[0], 403)
        restarted = Service(self.temp.name)
        self.assertTrue(restarted.authorized(self.origin, auth["Authorization"]))

    def test_pairing_attempt_limit_and_non_json_rejected(self):
        for _ in range(5):
            self.assertEqual(self.request("POST", "/v1/pair", {"code": "wrong"})[0], 403)
        self.assertEqual(self.request("POST", "/v1/pair", {"code": self.service.code})[0], 403)
        self.assertEqual(self.request("POST", "/v1/pair", {"code": "x"}, **{"Content-Type": "text/plain"})[0], 400)


class ProcessTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.shared = tempfile.TemporaryDirectory()

    @classmethod
    def tearDownClass(cls):
        cls.shared.cleanup()

    def setUp(self):
        name = str(uuid.uuid4())
        self.archive = Archive(Path(self.shared.name) / (name + ".sqlite3"))
        self.controller = Controller(self.archive, Path(self.shared.name) / ("jobs-" + name), timeout=180)

    def tearDown(self):
        if self.controller.active:
            self.controller.cancel(self.controller.active["id"])
            deadline = time.monotonic() + 10
            while self.controller.active and time.monotonic() < deadline:
                time.sleep(.05)

    def wait(self, job):
        deadline = time.monotonic() + 190
        while time.monotonic() < deadline:
            status = self.controller.status(job["id"])
            if status["stage"] in ("complete", "failed", "cancelled"):
                return status
            time.sleep(.05)
        self.fail("Helper job did not terminate")

    def test_real_child_runs_and_snapshots_input(self):
        request = fixture()
        expected = request["source"]
        job = self.controller.create(request)
        request["source"] = "invalid changed source"
        status = self.wait(job)
        self.assertEqual(status["stage"], "complete", status)
        self.assertEqual(self.archive.result(status["resultId"])["source"], expected)

    def test_indicator_job_archives_revision_and_reuses_exact_cache_key(self):
        source = "import zterminal as zt\ndef calculate(data, params):\n    return {'ema': zt.ema(data.close, 2)}\n"
        artifact = self.archive.save_artifact({"kind": "indicator", "name": "EMA", "source": source})
        request = fixture(source)
        request.update(operation="indicator", artifact={"id": artifact["id"], "kind": "indicator", "revision": artifact["revision"], "name": artifact["name"]}, outputs={"ema": {"plot": "line"}})
        first = self.controller.create(request)
        first_status = self.wait(first)
        self.assertEqual(first_status["stage"], "complete", first_status)
        result = self.archive.indicator_evaluation(first_status["resultId"])
        self.assertEqual(result["datasetHash"], request["dataset"]["hash"])
        cached = self.controller.create(request)
        self.assertEqual(cached["stage"], "complete")
        self.assertEqual(cached["resultId"], result["id"])

    def test_completed_job_allows_immediate_next_run(self):
        first = self.controller.create(fixture())
        first_status = self.wait(first)
        self.assertEqual(first_status["stage"], "complete", first_status)
        second = self.controller.create(fixture())
        second_status = self.wait(second)
        self.assertEqual(second_status["stage"], "complete", second_status)

    def test_one_job_and_cancellation(self):
        request = fixture("while True:\n    pass")
        job = self.controller.create(request)
        with self.assertRaisesRegex(ValueError, "already running"):
            self.controller.create(fixture())
        self.controller.cancel(job["id"])
        self.assertEqual(self.wait(job)["stage"], "cancelled")
        self.assertEqual(self.archive.results(), [])

    def test_resource_limit_and_process_crash_return_failures(self):
        for source in ["allocation = bytearray(3_000_000_000)", "import os\nos._exit(2)"]:
            job = self.controller.create(fixture(source))
            self.assertEqual(self.wait(job)["stage"], "failed")
            while self.controller.active:
                time.sleep(.05)
        self.assertEqual(self.archive.results(), [])

    def test_disk_failure_never_reports_success(self):
        with patch.object(self.archive, "save_result", side_effect=OSError("disk full")):
            job = self.controller.create(fixture())
            status = self.wait(job)
        self.assertEqual(status["stage"], "failed")
        self.assertIn("disk full", status["diagnostic"]["message"])
        self.assertEqual(self.archive.results(), [])


if __name__ == "__main__":
    unittest.main()
