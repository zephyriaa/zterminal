"""Transactional, non-executable local research archive. No pickle deserialization."""
import hashlib
import json
import sqlite3
import time
import uuid
import math
from contextlib import contextmanager
from pathlib import Path
import rfc8785
from validation import validate


def encode(value):
    return json.dumps(value, allow_nan=False, ensure_ascii=False, separators=(",", ":"))


def digest(value):
    return hashlib.sha256(rfc8785.dumps(value)).hexdigest()


class Archive:
    def __init__(self, path):
        self.path = str(path)
        Path(self.path).parent.mkdir(parents=True, exist_ok=True)
        with self.connect() as db:
            db.executescript('''
                PRAGMA journal_mode=WAL;
                CREATE TABLE IF NOT EXISTS scripts(id TEXT PRIMARY KEY, name TEXT NOT NULL, source TEXT NOT NULL, revision INTEGER NOT NULL, updated INTEGER NOT NULL);
                CREATE TABLE IF NOT EXISTS revisions(script_id TEXT NOT NULL, revision INTEGER NOT NULL, source TEXT NOT NULL, hash TEXT NOT NULL, created INTEGER NOT NULL, PRIMARY KEY(script_id, revision));
                CREATE TABLE IF NOT EXISTS datasets(hash TEXT PRIMARY KEY, manifest TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS results(id TEXT PRIMARY KEY, name TEXT NOT NULL, created INTEGER NOT NULL, dataset_hash TEXT NOT NULL REFERENCES datasets(hash), envelope TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY, status TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS legacy(id TEXT PRIMARY KEY, payload TEXT NOT NULL, imported INTEGER NOT NULL);
                CREATE TABLE IF NOT EXISTS artifacts(id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('strategy','indicator')), name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', source TEXT NOT NULL, revision INTEGER NOT NULL, updated INTEGER NOT NULL);
                CREATE TABLE IF NOT EXISTS artifact_revisions(artifact_id TEXT NOT NULL, revision INTEGER NOT NULL, kind TEXT NOT NULL, source TEXT NOT NULL, hash TEXT NOT NULL, metadata TEXT NOT NULL, created INTEGER NOT NULL, PRIMARY KEY(artifact_id, revision));
                CREATE TABLE IF NOT EXISTS indicator_evaluations(id TEXT PRIMARY KEY, artifact_id TEXT NOT NULL, revision INTEGER NOT NULL, dataset_hash TEXT NOT NULL, input_hash TEXT NOT NULL UNIQUE, result_hash TEXT NOT NULL, created INTEGER NOT NULL, envelope TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS validations(id TEXT PRIMARY KEY, source_run_id TEXT NOT NULL REFERENCES results(id), created INTEGER NOT NULL, config_hash TEXT NOT NULL, envelope TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS validation_receipts(validation_id TEXT PRIMARY KEY REFERENCES validations(id), result_hash TEXT NOT NULL, origin TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS validation_run_links(validation_id TEXT NOT NULL REFERENCES validations(id), run_id TEXT NOT NULL REFERENCES results(id), role TEXT NOT NULL, PRIMARY KEY(validation_id,role));
                INSERT OR IGNORE INTO artifacts(id,kind,name,source,revision,updated) SELECT id,'strategy',name,source,revision,updated FROM scripts;
                INSERT OR IGNORE INTO artifact_revisions(artifact_id,revision,kind,source,hash,metadata,created) SELECT script_id,revision,'strategy',source,hash,'{}',created FROM revisions;
                PRAGMA user_version=4;
            ''')

    @contextmanager
    def connect(self):
        db = sqlite3.connect(self.path, timeout=5)
        db.row_factory = sqlite3.Row
        db.execute("PRAGMA foreign_keys=ON")
        db.execute("PRAGMA synchronous=FULL")
        try:
            with db:
                yield db
        finally:
            db.close()

    @staticmethod
    def script(row):
        return {"id": row["id"], "name": row["name"], "source": row["source"], "savedSource": row["source"], "revision": row["revision"], "updatedAt": row["updated"]}

    def scripts(self):
        with self.connect() as db:
            return [self.script(row) for row in db.execute("SELECT * FROM scripts ORDER BY updated DESC")]

    def save_script(self, payload):
        name, source = payload.get("name"), payload.get("source")
        if not isinstance(name, str) or not name.strip() or len(name) > 120 or not isinstance(source, str) or len(source.encode()) > 256_000:
            raise ValueError("Script requires a name up to 120 characters and source up to 256 KB")
        script_id = str(payload.get("id") or uuid.uuid4())
        if len(script_id) > 100:
            raise ValueError("Invalid script ID")
        now = int(time.time() * 1000)
        with self.connect() as db:
            db.execute("BEGIN IMMEDIATE")
            previous = db.execute("SELECT revision FROM scripts WHERE id=?", (script_id,)).fetchone()
            if previous and payload.get("revision") != previous[0]:
                raise ValueError("Script changed since it was opened; reload or Save As to preserve both versions")
            last_revision = db.execute("SELECT MAX(revision) FROM revisions WHERE script_id=?", (script_id,)).fetchone()[0] or 0
            revision = last_revision + 1
            db.execute("INSERT OR REPLACE INTO scripts VALUES(?,?,?,?,?)", (script_id, name.strip(), source, revision, now))
            db.execute("INSERT INTO revisions VALUES(?,?,?,?,?)", (script_id, revision, source, hashlib.sha256(source.encode()).hexdigest(), now))
            db.execute("INSERT OR REPLACE INTO artifacts VALUES(?,?,?,?,?,?,?)", (script_id, "strategy", name.strip(), "", source, revision, now))
            db.execute("INSERT OR IGNORE INTO artifact_revisions VALUES(?,?,?,?,?,?,?)", (script_id, revision, "strategy", source, hashlib.sha256(source.encode()).hexdigest(), "{}", now))
            return {"id": script_id, "name": name.strip(), "source": source, "savedSource": source, "revision": revision, "updatedAt": now}

    def delete_script(self, script_id):
        # Revisions and immutable run source remain available after deletion.
        with self.connect() as db:
            db.execute("DELETE FROM scripts WHERE id=?", (script_id,))
            db.execute("DELETE FROM artifacts WHERE id=? AND kind='strategy'", (script_id,))

    def revisions(self, script_id):
        with self.connect() as db:
            return [dict(row) for row in db.execute("SELECT revision, source, hash, created FROM revisions WHERE script_id=? ORDER BY revision DESC", (script_id,))]

    @staticmethod
    def artifact(row):
        return {"id": row["id"], "kind": row["kind"], "name": row["name"], "description": row["description"], "source": row["source"], "savedSource": row["source"], "revision": row["revision"], "updatedAt": row["updated"]}

    def artifacts(self, kind=None):
        if kind is not None and kind not in ("strategy", "indicator"):
            raise ValueError("Unsupported artifact kind")
        with self.connect() as db:
            rows = db.execute("SELECT * FROM artifacts" + (" WHERE kind=?" if kind else "") + " ORDER BY updated DESC", (() if kind is None else (kind,))).fetchall()
            return [self.artifact(row) for row in rows]

    def save_artifact(self, payload):
        kind, name, source = payload.get("kind"), payload.get("name"), payload.get("source")
        description = payload.get("description", "")
        metadata = payload.get("metadata", {})
        if kind not in ("strategy", "indicator") or not isinstance(name, str) or not name.strip() or len(name) > 120 or not isinstance(description, str) or len(description) > 1000 or not isinstance(source, str) or len(source.encode()) > 256_000 or not isinstance(metadata, dict):
            raise ValueError("Artifact requires a valid kind, name, description, source, and metadata")
        artifact_id = str(payload.get("id") or uuid.uuid4())
        if len(artifact_id) > 100:
            raise ValueError("Invalid artifact ID")
        now = int(time.time() * 1000)
        with self.connect() as db:
            db.execute("BEGIN IMMEDIATE")
            previous = db.execute("SELECT revision,kind FROM artifacts WHERE id=?", (artifact_id,)).fetchone()
            if previous and (payload.get("revision") != previous["revision"] or kind != previous["kind"]):
                raise ValueError("Artifact changed since it was opened; reload or Save As")
            revision = (db.execute("SELECT MAX(revision) FROM artifact_revisions WHERE artifact_id=?", (artifact_id,)).fetchone()[0] or 0) + 1
            source_hash = hashlib.sha256(source.encode()).hexdigest()
            db.execute("INSERT OR REPLACE INTO artifacts VALUES(?,?,?,?,?,?,?)", (artifact_id, kind, name.strip(), description, source, revision, now))
            db.execute("INSERT INTO artifact_revisions VALUES(?,?,?,?,?,?,?)", (artifact_id, revision, kind, source, source_hash, encode(metadata), now))
            return {"id": artifact_id, "kind": kind, "name": name.strip(), "description": description, "source": source, "savedSource": source, "revision": revision, "updatedAt": now}

    def artifact_revisions(self, artifact_id):
        with self.connect() as db:
            return [{**dict(row), "metadata": json.loads(row["metadata"])} for row in db.execute("SELECT revision,kind,source,hash,metadata,created FROM artifact_revisions WHERE artifact_id=? ORDER BY revision DESC", (artifact_id,))]

    def delete_artifact(self, artifact_id):
        with self.connect() as db:
            db.execute("DELETE FROM artifacts WHERE id=?", (artifact_id,))

    def cached_indicator(self, input_hash):
        with self.connect() as db:
            row = db.execute("SELECT envelope FROM indicator_evaluations WHERE input_hash=?", (input_hash,)).fetchone()
            return json.loads(row[0]) if row else None

    def save_indicator_evaluation(self, result, job_id=None, dataset=None):
        if not isinstance(result, dict) or result.get("version") != 1 or result.get("kind") != "indicator_evaluation" or result.get("resultHash") != digest({key: value for key, value in result.items() if key != "resultHash"}):
            raise ValueError("Invalid indicator evaluation envelope")
        artifact = result.get("artifact", {})
        if not isinstance(artifact.get("id"), str) or not isinstance(artifact.get("revision"), int) or not isinstance(result.get("datasetHash"), str) or not isinstance(result.get("inputHash"), str):
            raise ValueError("Incomplete indicator provenance")
        outputs = result.get("outputs")
        if not isinstance(outputs, dict) or len(outputs) > 12 or any(not isinstance(output, dict) or output.get("plot") not in ("line", "histogram", "area", "marker", "level", "background") or not isinstance(output.get("points"), list) or len(output["points"]) > 100_000 for output in outputs.values()):
            raise ValueError("Invalid indicator outputs")
        encode(result)
        with self.connect() as db:
            db.execute("BEGIN IMMEDIATE")
            revision = db.execute("SELECT hash FROM artifact_revisions WHERE artifact_id=? AND revision=? AND kind='indicator'", (artifact["id"], artifact["revision"])).fetchone()
            if not revision or revision["hash"] != result.get("sourceHash"):
                raise ValueError("Indicator source does not match its immutable archived revision")
            if dataset is not None:
                if dataset.get("hash") != result["datasetHash"]:
                    raise ValueError("Indicator dataset provenance mismatch")
                dataset_key = digest({key: value for key, value in dataset.items() if key != "bars"})
                db.execute("INSERT OR IGNORE INTO datasets VALUES(?,?)", (dataset_key, encode(dataset)))
            db.execute("INSERT OR REPLACE INTO indicator_evaluations VALUES(?,?,?,?,?,?,?,?)", (result["id"], artifact["id"], artifact["revision"], result["datasetHash"], result["inputHash"], result["resultHash"], result["createdAt"], encode(result)))
            if job_id:
                db.execute("INSERT OR REPLACE INTO jobs VALUES(?,?)", (job_id, encode({"id": job_id, "stage": "complete", "resultId": result["id"], "resultKind": "indicator"})))

    def indicator_evaluation(self, result_id):
        with self.connect() as db:
            row = db.execute("SELECT envelope FROM indicator_evaluations WHERE id=?", (result_id,)).fetchone()
            if not row:
                raise KeyError("Indicator evaluation not found")
            return json.loads(row[0])

    def save_job(self, job):
        with self.connect() as db:
            db.execute("INSERT OR REPLACE INTO jobs VALUES(?,?)", (job["id"], encode(job)))

    def get_job(self, job_id):
        with self.connect() as db:
            row = db.execute("SELECT status FROM jobs WHERE id=?", (job_id,)).fetchone()
            if not row:
                raise KeyError("Job not found")
            return json.loads(row[0])

    def recover_jobs(self):
        with self.connect() as db:
            for row in db.execute("SELECT id,status FROM jobs").fetchall():
                job = json.loads(row["status"])
                if job["stage"] not in ("complete", "failed", "cancelled"):
                    job.update(stage="failed", diagnostic={"message": "Helper stopped before this run completed. No successful result was recorded."})
                    db.execute("UPDATE jobs SET status=? WHERE id=?", (encode(job), row["id"]))

    @staticmethod
    def validate_result(result):
        if not isinstance(result, dict) or result.get("version") != 1 or not isinstance(result.get("source"), str):
            raise ValueError("Unsupported or incomplete result envelope")
        if result.get("sourceHash") != hashlib.sha256(result["source"].encode()).hexdigest():
            raise ValueError("Source hash mismatch")
        request = {key: result[key] for key in ("name", "source", "config", "params", "dataset")}
        validate(request)  # Only data validation; never compile or import retained source.
        if result.get("inputHash") != digest(request):
            raise ValueError("Captured input hash mismatch")
        if not isinstance(result.get("id"), str) or not 0 < len(result["id"]) <= 100 or not isinstance(result.get("name"), str) or len(result["name"]) > 120:
            raise ValueError("Invalid result identity")
        def numeric(value):
            return not isinstance(value, bool) and isinstance(value, (int, float)) and math.isfinite(value)
        if not numeric(result.get("createdAt")) or result["createdAt"] < 0 or result["createdAt"] > 8e15:
            raise ValueError("Invalid result timestamp")
        unsigned = {k: v for k, v in result.items() if k not in ("resultHash", "monteCarlo")}
        if result.get("resultHash") != digest(unsigned):
            raise ValueError("Result hash mismatch")
        reproduction = result.get("reproduction")
        if result.get("reproducedFrom") is not None and (not isinstance(result["reproducedFrom"], str) or not 0 < len(result["reproducedFrom"]) <= 100):
            raise ValueError("Invalid reproduction parent identity")
        if reproduction is not None:
            if not result.get("reproducedFrom") or not isinstance(reproduction, dict) or reproduction.get("status") not in ("matched", "different") or not isinstance(reproduction.get("parentResultHash"), str) or len(reproduction["parentResultHash"]) != 64 or any(not isinstance(reproduction.get(k), list) or len(reproduction[k]) > 10 or any(not isinstance(x, str) or len(x) > 40 for x in reproduction[k]) for k in ("comparedFields", "differences")):
                raise ValueError("Invalid reproduction comparison")
        dataset = result["dataset"]
        if dataset.get("version") != 1 or not isinstance(dataset.get("bars"), list) or len(dataset["bars"]) > 100_000:
            raise ValueError("Invalid dataset envelope")
        if dataset["hash"] != digest([[b[k] for k in ["t", "o", "h", "l", "c", "v"]] for b in dataset["bars"]]):
            raise ValueError("Dataset hash mismatch")
        for key in ("equity", "trades", "assumptions", "logs", "monthly", "drawdowns", "observations"):
            if not isinstance(result.get(key), list):
                raise ValueError(f"Invalid {key}")
        if len(result["equity"]) != len(dataset["bars"]):
            raise ValueError("Equity must align with the retained dataset")
        for point, bar in zip(result["equity"], dataset["bars"]):
            if point.get("time") != bar["t"] or any(not numeric(point.get(k)) for k in ("equity", "drawdown", "benchmark")):
                raise ValueError("Invalid or misaligned equity")
        times = {bar["t"] for bar in dataset["bars"]}
        if len(result["trades"]) > len(times):
            raise ValueError("Too many trades for one-position execution")
        for trade in result["trades"]:
            if not isinstance(trade.get("id"), str) or trade.get("side") not in ("long", "short") or trade.get("status") not in ("closed", "open"):
                raise ValueError("Invalid trade")
            if trade.get("entryTime") not in times or (trade.get("status") == "closed" and (trade.get("exitTime") not in times or trade["exitTime"] < trade["entryTime"])) or (trade.get("status") == "open" and trade.get("exitTime") is not None):
                raise ValueError("Invalid trade timestamps")
            if any(not numeric(trade.get(k)) for k in ("entryPrice", "exitPrice", "quantity", "pnl", "return", "fees")) or (trade.get("accountReturn") is not None and not numeric(trade["accountReturn"])):
                raise ValueError("Invalid trade values")
        if not isinstance(result.get("metrics"), dict) or any(not isinstance(v, dict) or (v.get("value") is not None and not numeric(v["value"])) or (v.get("value") is None and not isinstance(v.get("reason"), str)) for v in result["metrics"].values()):
            raise ValueError("Invalid metrics")
        if not isinstance(result.get("engine"), dict) or any(not isinstance(result["engine"].get(k), str) for k in ("python", "vectorbt", "sdk", "analytics")) or (result["engine"].get("engine") is not None and not isinstance(result["engine"]["engine"], str)):
            raise ValueError("Missing engine versions")
        for key in ("assumptions", "logs", "observations"):
            if any(not isinstance(v, str) for v in result[key]):
                raise ValueError(f"Invalid {key}")
        if not isinstance(result.get("plots"), dict) or len(result["plots"]) > 12:
            raise ValueError("Invalid plots")
        for points in result["plots"].values():
            if not isinstance(points, list) or len(points) > len(times) or any(p.get("time") not in times or not numeric(p.get("value")) for p in points):
                raise ValueError("Invalid plot observations")
        for period in result["monthly"]:
            if not isinstance(period.get("period"), str) or (period.get("return") is not None and not numeric(period["return"])):
                raise ValueError("Invalid monthly returns")
        for period in result["drawdowns"]:
            if any(period.get(k) not in times for k in ("start", "trough")) or (period.get("recovery") is not None and period["recovery"] not in times) or any(not numeric(period.get(k)) for k in ("depth", "durationMs")):
                raise ValueError("Invalid drawdown period")
        if result.get("monteCarlo") is not None:
            analysis = result["monteCarlo"]
            if not isinstance(analysis, dict) or analysis.get("method") != "iid_closed_trade_account_returns" or not isinstance(analysis.get("simulations"), int) or not 100 <= analysis["simulations"] <= 5000:
                raise ValueError("Invalid bootstrap analysis")
            for key in ("endingEquity", "maxDrawdowns"):
                if not isinstance(analysis.get(key), list) or len(analysis[key]) != analysis["simulations"] or any(not numeric(v) for v in analysis[key]):
                    raise ValueError("Invalid bootstrap distribution")
            if not isinstance(analysis.get("bands"), list) or not 2 <= len(analysis["bands"]) <= 400 or any(any(not numeric(p.get(k)) for k in ("step", "lower", "median", "upper")) for p in analysis["bands"]):
                raise ValueError("Invalid bootstrap bands")
            if not isinstance(analysis.get("samplePaths"), list) or len(analysis["samplePaths"]) > 20 or any(not isinstance(p, list) or len(p) != len(analysis["bands"]) or any(not numeric(v) for v in p) for p in analysis["samplePaths"]):
                raise ValueError("Invalid bootstrap sample paths")
            if any(not numeric(analysis.get(k)) for k in ("seed", "observations", "initialCapital", "probabilityOfLoss")):
                raise ValueError("Invalid bootstrap metadata")
        encode(result)  # Reject NaN/infinity and non-JSON values.

    def save_result(self, result, job_id=None):
        self.validate_result(result)
        if result.get("reproducedFrom") is not None and not job_id:
            raise ValueError("Import the original run and rerun it locally; imported envelopes cannot claim a Helper reproduction")
        dataset = result["dataset"]
        with self.connect() as db:
            db.execute("BEGIN IMMEDIATE")
            # Provider, product and range live in the retained manifest, even if prices coincide.
            if result.get("reproducedFrom") is not None:
                parent = db.execute("SELECT envelope FROM results WHERE id=?", (result["reproducedFrom"],)).fetchone()
                original = json.loads(parent[0]) if parent else None
                if not original or result["id"] == original["id"] or any(result[k] != original[k] for k in ("source", "sourceHash", "config", "params", "dataset")):
                    raise ValueError("Reproduction inputs do not match the archived parent")
                self.validate_result(original)
            dataset_key = digest({k: v for k, v in dataset.items() if k != "bars"})
            db.execute("INSERT OR IGNORE INTO datasets VALUES(?,?)", (dataset_key, encode(dataset)))
            db.execute("INSERT INTO results VALUES(?,?,?,?,?)", (result["id"], result["name"], result["createdAt"], dataset_key, encode(result)))
            if job_id:
                db.execute("INSERT OR REPLACE INTO jobs VALUES(?,?)", (job_id, encode({"id": job_id, "stage": "complete", "resultId": result["id"]})))

    def results(self):
        with self.connect() as db:
            return [dict(row) for row in db.execute("SELECT id,name,created FROM results WHERE NOT EXISTS (SELECT 1 FROM validation_run_links WHERE run_id=results.id) ORDER BY created DESC LIMIT 1000")]

    def find_dataset(self, query):
        keys = ("provider", "product", "symbol", "timeframe", "from", "to")
        if any(key not in query for key in keys):
            raise ValueError("Supply the exact provider, product, symbol, timeframe and range")
        with self.connect() as db:
            row = db.execute("SELECT manifest FROM datasets WHERE " + " AND ".join("json_extract(manifest, '$." + key + "')=?" for key in keys) + " LIMIT 1", tuple(query[k] for k in keys)).fetchone()
            return json.loads(row[0]) if row else None

    def result(self, result_id):
        with self.connect() as db:
            row = db.execute("SELECT envelope FROM results WHERE id=?", (result_id,)).fetchone()
            if not row:
                raise KeyError("Result not found")
            result = json.loads(row[0])
            self.validate_result(result)
            if result.get("reproducedFrom") is not None:
                parent = db.execute("SELECT envelope FROM results WHERE id=?", (result["reproducedFrom"],)).fetchone()
                original = json.loads(parent[0]) if parent else None
                if not original or result["id"] == original["id"] or any(result[k] != original[k] for k in ("source", "sourceHash", "config", "params", "dataset")):
                    raise ValueError("Archived reproduction linkage mismatch")
                self.validate_result(original)
            return result

    def save_monte_carlo(self, result_id, analysis):
        with self.connect() as db:
            db.execute("BEGIN IMMEDIATE")
            row = db.execute("SELECT envelope FROM results WHERE id=?", (result_id,)).fetchone()
            if not row:
                raise KeyError("Result not found")
            result = json.loads(row[0])
            result["monteCarlo"] = analysis
            db.execute("UPDATE results SET envelope=? WHERE id=?", (encode(result), result_id))
            return result

    def import_legacy(self, payload):
        # Preserve arbitrary old language/data without asserting reproducibility or executing it.
        serialized = encode(payload)
        if len(serialized.encode()) > 8_000_000:
            raise ValueError("Legacy record exceeds 8 MB")
        identifier = hashlib.sha256(serialized.encode()).hexdigest()
        with self.connect() as db:
            db.execute("INSERT OR IGNORE INTO legacy VALUES(?,?,?)", (identifier, serialized, int(time.time() * 1000)))
        return {"id": identifier, "status": "incomplete", "reason": "Legacy source and dataset have not been verified against the v1 execution contract"}

    def legacy(self):
        with self.connect() as db:
            return [{"id": row["id"], "payload": json.loads(row["payload"]), "imported": row["imported"], "status": "incomplete"} for row in db.execute("SELECT * FROM legacy ORDER BY imported DESC")]

    def save_validation(self, validation):
        if not isinstance(validation, dict) or validation.get("version") != 3:
            raise ValueError("Invalid validation envelope")
        val_id = validation.get("id")
        source_run_id = validation.get("sourceRunId")
        created = validation.get("createdAt")
        provenance = validation.get("provenance", {})
        config_hash = provenance.get("validationConfigHash", "")
        if not isinstance(val_id, str) or not 0 < len(val_id) <= 100 or not isinstance(source_run_id, str) or not isinstance(created, int):
            raise ValueError("Missing validation identity or timestamps")
        if not isinstance(validation.get("config"), dict) or config_hash != digest(validation["config"]):
            raise ValueError("Validation configuration hash mismatch")
        if validation.get("sensitivity") is not None:
            raise ValueError("Parameter sensitivity requires independently executed strategy variants")
        if not isinstance(provenance, dict) or provenance.get("engineVersion") != "0.1.0":
            raise ValueError("Unsupported validation engine version")
        with self.connect() as db:
            db.execute("BEGIN IMMEDIATE")
            parent = db.execute("SELECT envelope FROM results WHERE id=?", (source_run_id,)).fetchone()
            parent_result = json.loads(parent[0]) if parent else None
            if not parent_result or parent_result.get("resultHash") != provenance.get("sourceRunFingerprint"):
                raise ValueError("Validation parent fingerprint mismatch")
            holdout = validation.get("outOfSample")
            if holdout is not None:
                if not isinstance(holdout, dict):
                    raise ValueError("Invalid holdout evidence")
                cfg = validation["config"]
                bars = parent_result["dataset"]["bars"]
                ratio, purge = cfg.get("oosSplitRatio"), cfg.get("purgeBars")
                if isinstance(ratio, bool) or not isinstance(ratio, (int, float)) or not 0.5 <= ratio <= 0.9 or isinstance(purge, bool) or not isinstance(purge, int) or not 1 <= purge <= 100:
                    raise ValueError("Invalid holdout split configuration")
                split = math.floor(len(bars) * ratio)
                if split < 2 or len(bars) - split - purge < 2:
                    raise ValueError("Insufficient disjoint holdout candles")
                expected_segments = (bars[:split], bars[split + purge:])
                for label, expected_bars, range_key in zip(("inSample", "outOfSample"), expected_segments, ("inSampleRange", "outOfSampleRange")):
                    reference = holdout.get(label + "Run")
                    period = holdout.get(range_key)
                    if not isinstance(reference, dict) or not isinstance(period, dict) or not isinstance(reference.get("id"), str):
                        raise ValueError("Missing linked holdout run")
                    child_row = db.execute("SELECT envelope FROM results WHERE id=?", (reference["id"],)).fetchone()
                    child = json.loads(child_row[0]) if child_row else None
                    if not child or child.get("resultHash") != reference.get("resultHash") or child.get("sourceHash") != parent_result.get("sourceHash") or child.get("source") != parent_result.get("source") or child.get("params") != parent_result.get("params"):
                        raise ValueError("Holdout result identity mismatch")
                    if child["dataset"]["bars"] != expected_bars or child["dataset"].get("hash") != digest([[b[k] for k in ("t", "o", "h", "l", "c", "v")] for b in expected_bars]):
                        raise ValueError("Holdout dataset does not match the chronological partition")
                    expected_range = {"from": expected_bars[0]["t"], "to": expected_bars[-1]["t"] + (bars[1]["t"] - bars[0]["t"])}
                    if period != expected_range or any(child["config"].get(key) != value for key, value in {**parent_result["config"], **expected_range}.items()):
                        raise ValueError("Holdout run configuration or period mismatch")
            # Linkage alone does not authenticate browser-computed metrics, ratings or
            # diagnostics. Do not promote this draft analysis to a durable artifact.
            raise ValueError("Validation metrics are not independently verified by the Helper; archive admission is unavailable")

    def save_generated_validation(self, request, bundle, job_id):
        """Controller-only admission. Client envelopes never reach this method.

        Recalculate the report outside user-code processes from verified executions.
        Commit every child, the immutable report and job completion together.
        """
        from validation_engine import normalize_config, verify_evidence, summarize
        parent = request["result"]
        self.validate_result(parent)
        cfg = normalize_config(request["config"], parent)
        if not isinstance(bundle, dict) or set(bundle) != {"evidence"} or not isinstance(bundle["evidence"], dict):
            raise ValueError("Invalid validation execution bundle")
        evidence = bundle["evidence"]
        verify_evidence(parent, cfg, evidence, self.validate_result)
        report = summarize(parent, cfg, evidence)
        with self.connect() as db:
            db.execute("BEGIN IMMEDIATE")
            row = db.execute("SELECT envelope FROM results WHERE id=?", (parent["id"],)).fetchone()
            saved_parent = json.loads(row[0]) if row else None
            if not saved_parent or saved_parent.get("resultHash") != parent["resultHash"]:
                raise ValueError("Validation parent changed during computation")
            self.validate_result(saved_parent)
            for run in evidence.values():
                dataset = run["dataset"]
                dataset_key = digest({k: v for k, v in dataset.items() if k != "bars"})
                db.execute("INSERT OR IGNORE INTO datasets VALUES(?,?)", (dataset_key, encode(dataset)))
                db.execute("INSERT INTO results VALUES(?,?,?,?,?)", (run["id"], run["name"], run["createdAt"], dataset_key, encode(run)))
            db.execute("INSERT INTO validations VALUES(?,?,?,?,?)", (report["id"], parent["id"], report["createdAt"], report["provenance"]["validationConfigHash"], encode(report)))
            db.execute("INSERT INTO validation_receipts VALUES(?,?,?)", (report["id"], report["resultHash"], "helper_generated_current_reproduction"))
            for role, run in evidence.items():
                db.execute("INSERT INTO validation_run_links VALUES(?,?,?)", (report["id"], run["id"], role))
            db.execute("INSERT OR REPLACE INTO jobs VALUES(?,?)", (job_id, encode({"id": job_id, "stage": "complete", "resultId": report["id"], "resultKind": "validation"})))
        return report

    def _verify_validation(self, row, db):
        report = json.loads(row[0])
        receipt = db.execute("SELECT result_hash,origin FROM validation_receipts WHERE validation_id=?", (report.get("id"),)).fetchone()
        if not receipt or receipt["origin"] != "helper_generated_current_reproduction" or report.get("version") != 4:
            raise ValueError("Archived validation is not Helper-verified and cannot be displayed as research evidence")
        if receipt["result_hash"] != report.get("resultHash") or report["resultHash"] != digest({k: v for k, v in report.items() if k != "resultHash"}):
            raise ValueError("Archived validation integrity check failed")
        provenance = report["provenance"]
        if provenance["validationConfigHash"] != digest(report["config"]) or provenance["fingerprint"] != digest({"sourceRunFingerprint": provenance["sourceRunFingerprint"], "config": report["config"], "engineVersion": provenance["engineVersion"]}):
            raise ValueError("Archived validation provenance mismatch")
        references = {**report["evidenceRuns"], "parent": {"id": report["sourceRunId"], "resultHash": provenance["sourceRunFingerprint"]}}
        for reference in references.values():
            child_row = db.execute("SELECT envelope FROM results WHERE id=?", (reference["id"],)).fetchone()
            child = json.loads(child_row[0]) if child_row else None
            if not child or child.get("resultHash") != reference["resultHash"]:
                raise ValueError("Archived validation run linkage mismatch")
            self.validate_result(child)
        # Opening an archive verifies bytes and references, never recalculates a
        # historical report under the currently installed quantitative engine.
        return report

    def validation(self, val_id):
        with self.connect() as db:
            row = db.execute("SELECT envelope FROM validations WHERE id=?", (val_id,)).fetchone()
            if not row:
                raise KeyError("Validation not found")
            return self._verify_validation(row, db)

    def validations_for_run(self, source_run_id):
        with self.connect() as db:
            rows = db.execute(
                "SELECT envelope FROM validations WHERE source_run_id=? AND (COALESCE(json_extract(envelope,'$.version'),0)>=4 OR EXISTS (SELECT 1 FROM validation_receipts WHERE validation_id=validations.id)) ORDER BY created DESC",
                (source_run_id,)
            ).fetchall()
            return [self._verify_validation(row, db) for row in rows]

    def export_validation(self, val_id):
        from artifacts import make_bundle, MAX_BYTES
        with self.connect() as db:
            # Read one SQLite snapshot; an export never mixes concurrent edits.
            db.execute("BEGIN")
            row = db.execute("SELECT envelope FROM validations WHERE id=?", (val_id,)).fetchone()
            if not row:
                raise KeyError("Validation not found")
            report = self._verify_validation(row, db)
            runs = {}
            active = set()
            retained_bytes = len(encode(report).encode("utf-8"))
            def collect(identifier):
                nonlocal retained_bytes
                if identifier in active:
                    raise ValueError("Cyclic reproduction lineage")
                if identifier in runs:
                    return
                if len(runs) + len(active) >= 200:
                    raise ValueError("Evidence graph exceeds 200 ResearchRuns")
                child_row = db.execute("SELECT envelope FROM results WHERE id=?", (identifier,)).fetchone()
                if not child_row:
                    raise ValueError("Evidence graph is missing a ResearchRun")
                run = json.loads(child_row[0])
                self.validate_result(run)
                run.pop("monteCarlo", None)
                retained_bytes += len(encode(run).encode("utf-8"))
                if retained_bytes > MAX_BYTES:
                    raise ValueError("Evidence bundle exceeds 32 MB; a larger streaming format is required")
                active.add(identifier)
                if run.get("reproducedFrom"):
                    collect(run["reproducedFrom"])
                active.remove(identifier)
                runs[identifier] = run
            collect(report["sourceRunId"])
            for reference in report["evidenceRuns"].values():
                collect(reference["id"])
            return make_bundle(report, runs.values())

