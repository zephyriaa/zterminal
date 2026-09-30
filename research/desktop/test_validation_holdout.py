"""Exact-source chronological run linkage against the real CPython engine."""
import copy
import tempfile
import unittest
from pathlib import Path

from archive import Archive, digest
from engine import execute
from test_engine import fixture


class HoldoutIntegrationTests(unittest.TestCase):
    def test_separate_execution_and_archived_linkage(self):
        request = fixture(prices=[10 + (i % 7) for i in range(40)])
        with tempfile.TemporaryDirectory() as directory:
            archive = Archive(Path(directory) / "research.sqlite3")
            parent = execute(request)
            archive.save_result(parent)

            def segment(bars):
                selected = copy.deepcopy(request)
                selected["dataset"]["bars"] = bars
                selected["config"]["from"] = selected["dataset"]["from"] = bars[0]["t"]
                selected["config"]["to"] = selected["dataset"]["to"] = bars[-1]["t"] + 3_600_000
                selected["dataset"]["hash"] = digest([[b[k] for k in ("t", "o", "h", "l", "c", "v")] for b in bars])
                result = execute(selected)
                archive.save_result(result)
                self.assertEqual(result["sourceHash"], parent["sourceHash"])
                self.assertNotEqual(result["dataset"]["hash"], parent["dataset"]["hash"])
                return result

            bars = request["dataset"]["bars"]
            earlier, later = segment(bars[:28]), segment(bars[29:])
            config = {"oosSplitRatio": 0.7, "purgeBars": 1}
            validation = {
                "version": 3, "id": "validation-linked", "sourceRunId": parent["id"],
                "createdAt": 1, "config": config,
                "provenance": {
                    "sourceRunFingerprint": parent["resultHash"],
                    "validationConfigHash": digest(config), "engineVersion": "0.1.0",
                },
                "outOfSample": {
                    "inSampleRun": {"id": earlier["id"], "resultHash": earlier["resultHash"]},
                    "outOfSampleRun": {"id": later["id"], "resultHash": later["resultHash"]},
                    "inSampleRange": {"from": earlier["config"]["from"], "to": earlier["config"]["to"]},
                    "outOfSampleRange": {"from": later["config"]["from"], "to": later["config"]["to"]},
                },
            }
            with self.assertRaisesRegex(ValueError, "not independently verified"):
                archive.save_validation(validation)
            self.assertEqual(archive.validations_for_run(parent["id"]), [])
            with self.assertRaisesRegex(ValueError, "identity mismatch"):
                archive.save_validation({**validation, "id": "wrong-run", "outOfSample": {
                    **validation["outOfSample"],
                    "outOfSampleRun": {"id": later["id"], "resultHash": "0" * 64},
                }})


if __name__ == "__main__":
    unittest.main()
