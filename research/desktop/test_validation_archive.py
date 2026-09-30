"""Archive admission tests that do not require the numerical Python runtime."""
import json
import sqlite3
import tempfile
import unittest
from pathlib import Path

from archive import Archive, digest, encode


class ValidationArchiveTests(unittest.TestCase):
    def test_rejects_mismatched_inputs_and_tampering(self):
        with tempfile.TemporaryDirectory() as directory:
            archive = Archive(Path(directory) / "archive.sqlite3")
            parent = {"id": "run-1", "resultHash": "a" * 64}
            with archive.connect() as db:
                db.execute("INSERT INTO datasets VALUES(?,?)", ("dataset-1", "{}"))
                db.execute("INSERT INTO results VALUES(?,?,?,?,?)", ("run-1", "Fixture", 1, "dataset-1", encode(parent)))
            config = {"oosSplitRatio": 0.7, "monteCarloSeed": 42}
            validation = {
                "version": 2, "id": "validation-1", "sourceRunId": "run-1",
                "createdAt": 1, "config": config,
                "provenance": {
                    "sourceRunFingerprint": parent["resultHash"],
                    "validationConfigHash": digest(config), "engineVersion": "0.1.0",
                },
                "baseline": {"totalTrades": 3},
            }
            for altered in (
                {**validation, "config": {**config, "monteCarloSeed": 43}},
                {**validation, "provenance": {**validation["provenance"], "sourceRunFingerprint": "0" * 64}},
                {**validation, "sensitivity": {"grid": [[{"metricValue": 99}]]}},
            ):
                with self.assertRaises(ValueError):
                    archive.save_validation(altered)
            archive.save_validation(validation)
            self.assertEqual(archive.validation("validation-1"), validation)
            with self.assertRaises(sqlite3.IntegrityError):
                archive.save_validation(validation)
            with archive.connect() as db:
                row = db.execute("SELECT envelope FROM validations WHERE id=?", ("validation-1",)).fetchone()
                tampered = json.loads(row[0])
                tampered["baseline"]["totalTrades"] += 1
                db.execute("UPDATE validations SET envelope=? WHERE id=?", (encode(tampered), "validation-1"))
            with self.assertRaisesRegex(ValueError, "digest mismatch"):
                archive.validation("validation-1")


if __name__ == "__main__":
    unittest.main()
