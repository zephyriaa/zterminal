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
                PRAGMA user_version=1;
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
            return {"id": script_id, "name": name.strip(), "source": source, "savedSource": source, "revision": revision, "updatedAt": now}

    def delete_script(self, script_id):
        # Revisions and immutable run source remain available after deletion.
        with self.connect() as db:
            db.execute("DELETE FROM scripts WHERE id=?", (script_id,))

    def revisions(self, script_id):
        with self.connect() as db:
            return [dict(row) for row in db.execute("SELECT revision, source, hash, created FROM revisions WHERE script_id=? ORDER BY revision DESC", (script_id,))]

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
        dataset = result["dataset"]
        with self.connect() as db:
            db.execute("BEGIN IMMEDIATE")
            # Provider, product and range live in the retained manifest, even if prices coincide.
            dataset_key = digest({k: v for k, v in dataset.items() if k != "bars"})
            db.execute("INSERT OR IGNORE INTO datasets VALUES(?,?)", (dataset_key, encode(dataset)))
            db.execute("INSERT INTO results VALUES(?,?,?,?,?)", (result["id"], result["name"], result["createdAt"], dataset_key, encode(result)))
            if job_id:
                db.execute("INSERT OR REPLACE INTO jobs VALUES(?,?)", (job_id, encode({"id": job_id, "stage": "complete", "resultId": result["id"]})))

    def results(self):
        with self.connect() as db:
            return [dict(row) for row in db.execute("SELECT id,name,created FROM results ORDER BY created DESC LIMIT 1000")]

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
            return json.loads(row[0])

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
