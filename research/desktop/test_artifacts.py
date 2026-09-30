"""Offline bundle identity tests; base evidence executes labeled simulated candles."""
import copy
import tempfile
import time
import unittest
from pathlib import Path
from unittest.mock import patch

from archive import Archive, digest, encode
from artifacts import make_bundle, manifest, verify_bundle, verify_file
from test_validation_engine import parent_run, config, evidence_for
from validation_engine import summarize


def seal(bundle):
    bundle["runs"].sort(key=lambda run: run["id"])
    bundle["manifest"] = manifest(bundle["validation"], bundle["runs"])
    bundle["graphFingerprint"] = digest(bundle["manifest"])
    bundle["bundleHash"] = digest({k: v for k, v in bundle.items() if k != "bundleHash"})
    return bundle


def rehash_run(run):
    run["resultHash"] = digest({k: v for k, v in run.items() if k not in ("resultHash", "monteCarlo")})


def relink(bundle):
    report = bundle["validation"]
    by_id = {run["id"]: run for run in bundle["runs"]}
    report["provenance"]["sourceRunFingerprint"] = by_id[report["sourceRunId"]]["resultHash"]
    for reference in report["evidenceRuns"].values():
        reference["resultHash"] = by_id[reference["id"]]["resultHash"]
    p = report["provenance"]
    p["fingerprint"] = digest({"sourceRunFingerprint": p["sourceRunFingerprint"], "config": report["config"], "engineVersion": p["engineVersion"]})
    report["resultHash"] = digest({k: v for k, v in report.items() if k != "resultHash"})
    return seal(bundle)


class EvidenceArtifactTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.parent = parent_run()
        cls.cfg = config(cls.parent)
        cls.evidence = evidence_for(cls.parent, cls.cfg)
        cls.report = summarize(cls.parent, cls.cfg, cls.evidence)
        cls.bundle = make_bundle(cls.report, [cls.parent, *cls.evidence.values()])

    def test_export_identity_is_stable_without_execution_or_recalculation(self):
        with tempfile.TemporaryDirectory() as directory:
            archive = Archive(Path(directory) / "archive.sqlite3")
            parent = copy.deepcopy(self.parent)
            from analytics import monte_carlo
            parent["monteCarlo"] = monte_carlo(parent, 100, 42)
            archive.save_result(parent)
            report = archive.save_generated_validation({"result": parent, "config": self.cfg}, {"evidence": self.evidence}, "job")
            with patch("engine.execute", side_effect=AssertionError("Never execute exported source")), patch("validation_engine.summarize", side_effect=AssertionError("Never recalculate retained metrics")):
                first = archive.export_validation(report["id"])
                with patch("artifacts.time.time", return_value=time.time() + 1):
                    second = archive.export_validation(report["id"])
                self.assertEqual(first["graphFingerprint"], second["graphFingerprint"])
                self.assertNotEqual(first["bundleHash"], second["bundleHash"])
                self.assertEqual(first["validation"], report)
                self.assertTrue(all("monteCarlo" not in run for run in first["runs"]))
                self.assertEqual(verify_bundle(first)["status"], "identity_verified_computation_not_reproduced")
                path = Path(directory) / "bundle.json"
                path.write_text(encode(first), encoding="utf-8")
                self.assertEqual(verify_file(path)["runCount"], len(self.evidence) + 1)
            with patch("artifacts.MAX_BYTES", 10):
                with self.assertRaisesRegex(ValueError, "32 MB"):
                    archive.export_validation(report["id"])
            with archive.connect() as db:
                bad = copy.deepcopy(report)
                bad["baseline"]["netProfit"] += 1
                bad["resultHash"] = digest({k: v for k, v in bad.items() if k != "resultHash"})
                db.execute("UPDATE validations SET envelope=? WHERE id=?", (encode(bad), report["id"]))
            with self.assertRaisesRegex(ValueError, "integrity check failed"):
                archive.export_validation(report["id"])

    def test_missing_unrelated_duplicate_and_detached_runs_are_rejected(self):
        for change in (lambda b: b["runs"].pop(), lambda b: b["runs"].append(copy.deepcopy(b["runs"][0])),
                       lambda b: b["runs"][0].update(monteCarlo={"ignored": True})):
            bundle = copy.deepcopy(self.bundle)
            change(bundle)
            with self.assertRaises(ValueError):
                verify_bundle(seal(bundle))
        bundle = copy.deepcopy(self.bundle)
        unrelated = parent_run()
        bundle["runs"].append(unrelated)
        with self.assertRaisesRegex(ValueError, "unrelated"):
            verify_bundle(seal(bundle))

    def test_outer_rehash_cannot_hide_inner_identity_or_reference_tampering(self):
        for change in (lambda b: b["runs"][0].update(source="raise RuntimeError('tampered')"),
                       lambda b: b["runs"][0]["dataset"]["bars"][0].update(c=123),
                       lambda b: b["validation"]["baseline"].update(netProfit=123),
                       lambda b: b["validation"]["evidenceRuns"]["baseline"].update(resultHash="a" * 64)):
            bundle = copy.deepcopy(self.bundle)
            change(bundle)
            with self.assertRaises(ValueError):
                verify_bundle(seal(bundle))
        bundle = copy.deepcopy(self.bundle)
        bundle["manifest"]["runs"][0]["payloadHash"] = "a" * 64
        bundle["bundleHash"] = digest({k: v for k, v in bundle.items() if k != "bundleHash"})
        with self.assertRaisesRegex(ValueError, "manifest mismatch"):
            verify_bundle(bundle)

    def test_identity_verification_does_not_attest_numerical_claims(self):
        bundle = copy.deepcopy(self.bundle)
        bundle["validation"]["baseline"]["sharpe"] = 100  # deliberately fabricated claim
        # An attacker can rehash claimed content. Offline verification is not
        # the locally stored Helper receipt and must not be labeled reproduction.
        verified = verify_bundle(relink(bundle))
        self.assertEqual(verified["status"], "identity_verified_computation_not_reproduced")

    def test_reproduction_ancestors_required_and_cycles_rejected(self):
        bundle = copy.deepcopy(self.bundle)
        by_id = {run["id"]: run for run in bundle["runs"]}
        parent = by_id[self.parent["id"]]
        baseline = by_id[self.report["evidenceRuns"]["baseline"]["id"]]
        # Deliberately altered identity fixtures challenge graph structure only.
        parent["reproducedFrom"] = baseline["id"]
        rehash_run(parent)
        verify_bundle(relink(bundle))
        baseline["reproducedFrom"] = parent["id"]
        rehash_run(baseline)
        with self.assertRaisesRegex(ValueError, "Cyclic"):
            verify_bundle(relink(bundle))
        del baseline["reproducedFrom"]
        rehash_run(baseline)
        parent["reproducedFrom"] = "missing-ancestor"
        rehash_run(parent)
        with self.assertRaisesRegex(ValueError, "missing"):
            verify_bundle(relink(bundle))

    def test_limits_and_ambiguous_json_fail_closed(self):
        with patch("artifacts.MAX_BYTES", 10):
            with self.assertRaisesRegex(ValueError, "32 MB"):
                verify_bundle(self.bundle)
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "ambiguous.json"
            path.write_text('{"version":1,"version":1}', encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "Duplicate JSON"):
                verify_file(path)
            with patch("artifacts.MAX_BYTES", 10):
                with self.assertRaisesRegex(ValueError, "32 MB"):
                    verify_file(path)
        altered = copy.deepcopy(self.bundle)
        altered["limitations"] = ["Recipient computation is certified"]
        with self.assertRaisesRegex(ValueError, "interpretation limits"):
            verify_bundle(seal(altered))


if __name__ == "__main__":
    unittest.main()
