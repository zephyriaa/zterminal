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
            bars = [{"t": i * 3600000, "o": 100, "h": 101, "l": 99, "c": 100, "v": 1} for i in range(40)]
            parent = {
                "id": "run-1", "resultHash": "a" * 64, "source": "python",
                "sourceHash": "b" * 64, "params": {},
                "config": {"from": 0, "to": 40 * 3600000, "timeframe": "1h"},
                "dataset": {"bars": bars},
            }
            with archive.connect() as db:
                db.execute("INSERT INTO datasets VALUES(?,?)", ("dataset-1", "{}"))
                db.execute("INSERT INTO results VALUES(?,?,?,?,?)", ("run-1", "Fixture", 1, "dataset-1", encode(parent)))
            config = {"oosSplitRatio": 0.7, "purgeBars": 1, "monteCarloSeed": 42}
            validation = {
                "version": 3, "id": "validation-1", "sourceRunId": "run-1",
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
                {**validation, "outOfSample": {"inSampleRun": {"id": "missing", "resultHash": "x"}}},
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

            earlier, later = bars[:28], bars[29:]
            children = []
            for label, segment, child_hash in (("earlier", earlier, "c" * 64), ("later", later, "d" * 64)):
                child = {
                    **parent, "id": label, "resultHash": child_hash,
                    "config": {**parent["config"], "from": segment[0]["t"], "to": segment[-1]["t"] + 3600000},
                    "dataset": {"bars": segment, "hash": digest([[b[k] for k in ("t", "o", "h", "l", "c", "v")] for b in segment])},
                }
                children.append(child)
                with archive.connect() as db:
                    db.execute("INSERT INTO results VALUES(?,?,?,?,?)", (label, label, 2, "dataset-1", encode(child)))
            holdout = {
                "inSampleRun": {"id": children[0]["id"], "resultHash": children[0]["resultHash"]},
                "outOfSampleRun": {"id": children[1]["id"], "resultHash": children[1]["resultHash"]},
                "inSampleRange": {"from": 0, "to": 28 * 3600000},
                "outOfSampleRange": {"from": 29 * 3600000, "to": 40 * 3600000},
            }
            linked = {**validation, "id": "validation-2", "outOfSample": holdout}
            archive.save_validation(linked)
            self.assertEqual(archive.validation("validation-2"), linked)
            with self.assertRaisesRegex(ValueError, "dataset does not match"):
                archive.save_validation({**linked, "id": "validation-3", "outOfSample": {
                    **holdout, "inSampleRun": {"id": "later", "resultHash": children[1]["resultHash"]},
                }})


if __name__ == "__main__":
    unittest.main()
