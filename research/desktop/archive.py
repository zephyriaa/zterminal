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
from validation import validate, input_record


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
                CREATE TABLE IF NOT EXISTS research_analyses(id TEXT PRIMARY KEY, parent_id TEXT NOT NULL REFERENCES results(id), parent_hash TEXT NOT NULL, kind TEXT NOT NULL, created INTEGER NOT NULL, envelope TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS holdout_accesses(id TEXT PRIMARY KEY, fingerprint TEXT NOT NULL, selection_id TEXT NOT NULL, created INTEGER NOT NULL);
                CREATE TABLE IF NOT EXISTS holdout_import_bounds(fingerprint TEXT PRIMARY KEY, missing_count INTEGER NOT NULL);
                CREATE TABLE IF NOT EXISTS legacy(id TEXT PRIMARY KEY, payload TEXT NOT NULL, imported INTEGER NOT NULL);
                CREATE TABLE IF NOT EXISTS artifacts(id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('strategy','indicator')), name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', source TEXT NOT NULL, revision INTEGER NOT NULL, updated INTEGER NOT NULL);
                CREATE TABLE IF NOT EXISTS artifact_revisions(artifact_id TEXT NOT NULL, revision INTEGER NOT NULL, kind TEXT NOT NULL, source TEXT NOT NULL, hash TEXT NOT NULL, metadata TEXT NOT NULL, created INTEGER NOT NULL, PRIMARY KEY(artifact_id, revision));
                CREATE TABLE IF NOT EXISTS indicator_evaluations(id TEXT PRIMARY KEY, artifact_id TEXT NOT NULL, revision INTEGER NOT NULL, dataset_hash TEXT NOT NULL, input_hash TEXT NOT NULL UNIQUE, result_hash TEXT NOT NULL, created INTEGER NOT NULL, envelope TEXT NOT NULL);
                INSERT OR IGNORE INTO artifacts(id,kind,name,source,revision,updated) SELECT id,'strategy',name,source,revision,updated FROM scripts;
                INSERT OR IGNORE INTO artifact_revisions(artifact_id,revision,kind,source,hash,metadata,created) SELECT script_id,revision,'strategy',source,hash,'{}',created FROM revisions;
                PRAGMA user_version=2;
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
            if "input" in result:
                captured = result["input"]
                retained = result.get("dataset")
                if not isinstance(captured, dict) or not isinstance(retained, dict) or digest(captured) != result["inputHash"] or captured.get("artifactId") != artifact["id"] or captured.get("revision") != artifact["revision"] or captured.get("sourceHash") != result["sourceHash"] or captured.get("dataset") != {key: retained.get(key) for key in ("version", "provider", "product", "symbol", "timeframe", "from", "to", "hash")} or retained != dataset:
                    raise ValueError("Indicator input or dataset identity mismatch")
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
        request = input_record(result)
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
        if dataset.get("version") not in (1, 2) or not isinstance(dataset.get("bars"), list) or len(dataset["bars"]) > 100_000:
            raise ValueError("Invalid dataset envelope")
        if dataset["hash"] != digest([[b[k] for k in ["t", "o", "h", "l", "c", "v"]] for b in dataset["bars"]]):
            raise ValueError("Dataset hash mismatch")
        for key in ("equity", "trades", "assumptions", "logs", "monthly", "drawdowns", "observations"):
            if not isinstance(result.get(key), list):
                raise ValueError(f"Invalid {key}")
        expected_equity = int(len(dataset["bars"])*.8) if result.get("researchSchema") == 2 and result["config"].get("reserveHoldout") else len(dataset["bars"])
        if len(result["equity"]) != expected_equity:
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
        if result.get("researchSchema") == 2:
            Archive.validate_research_evidence(result)

    @staticmethod
    def validate_research_evidence(result):
        if result["config"].get("executionModel") != "synthetic_next_open_v2": raise ValueError("Research schema does not match execution model")
        expected = digest({k: v for k, v in result.items() if k not in ("id", "createdAt", "evidenceHash", "resultHash", "monteCarlo")})
        if result.get("evidenceHash") != expected: raise ValueError("Deterministic evidence hash mismatch")
        accounts = result.get("accounts")
        if not isinstance(accounts, list) or len(accounts) != len(result["equity"]): raise ValueError("Missing account ledger")
        def close(a, b): return math.isclose(a, b, rel_tol=1e-10, abs_tol=1e-7)
        for state, point in zip(accounts, result["equity"]):
            if state["time"] != point["time"] or not close(state["equity"], point["equity"]): raise ValueError("Account/equity alignment mismatch")
            if not close(state["cash"]+state["reservedCapital"]+state["unrealizedPnl"], state["equity"]): raise ValueError("Cash reconciliation failed")
            if not close(result["config"]["initialCapital"]+state["realizedPnl"]+state["unrealizedPnl"]-state["fees"], state["equity"]): raise ValueError("P&L reconciliation failed")
        orders, fills = result.get("orders"), result.get("fills")
        if not isinstance(orders, list) or not isinstance(fills, list): raise ValueError("Missing orders/fills")
        by_id = {order["id"]: order for order in orders}
        if len(by_id) != len(orders): raise ValueError("Duplicate order identity")
        for fill in fills:
            order = by_id.get(fill["orderId"])
            if not order or order["status"] != "filled" or fill["price"] <= 0 or fill["fee"] < 0: raise ValueError("Invalid fill")
            if fill["reason"] != "split_boundary" and (fill["decisionTime"] is None or fill["decisionTime"] >= fill["eligibleTime"]): raise ValueError("Execution predates eligible information")
        if not close(sum(fill["fee"] for fill in fills), accounts[-1]["fees"]): raise ValueError("Fill fees do not reconcile")
        if not close(sum(t["pnl"] for t in result["trades"]), accounts[-1]["equity"]-result["config"]["initialCapital"]): raise ValueError("Trade P&L does not reconcile")

    def analyses(self, parent_id):
        with self.connect() as db:
            return [json.loads(row[0]) for row in db.execute("SELECT envelope FROM research_analyses WHERE parent_id=? ORDER BY created,id", (parent_id,))]

    def analysis(self, identifier):
        with self.connect() as db:
            row = db.execute("SELECT envelope FROM research_analyses WHERE id=?", (identifier,)).fetchone()
            if row is None: raise KeyError("Research analysis not found")
            return json.loads(row[0])

    def holdout_access(self, parent, selection):
        bounds = selection["payload"]["splits"]["holdout"]
        bars = parent["dataset"]["bars"][bounds[0]:bounds[1]]
        fingerprint = digest({"provider": parent["dataset"]["provider"], "symbol": parent["dataset"]["symbol"], "product": parent["dataset"]["product"], "timeframe": parent["dataset"]["timeframe"], "from": bars[0]["t"], "to": bars[-1]["t"]})
        identifier, created = str(uuid.uuid4()), int(time.time()*1000)
        with self.connect() as db:
            db.execute("BEGIN IMMEDIATE")
            db.execute("INSERT INTO holdout_accesses VALUES(?,?,?,?)", (identifier, fingerprint, selection["id"], created))
            count = db.execute("SELECT count(*) FROM holdout_accesses WHERE fingerprint=?", (fingerprint,)).fetchone()[0]
            imported = db.execute("SELECT missing_count FROM holdout_import_bounds WHERE fingerprint=?", (fingerprint,)).fetchone()
            count += imported[0] if imported else 0
        return {"id": identifier, "fingerprint": fingerprint, "count": count, "requestedAt": created, "note": "Requests include failed/cancelled attempts; local history cannot certify external holdout use."}

    def holdout_usage(self, parent_id):
        with self.connect() as db:
            return [dict(row) for row in db.execute("SELECT a.id,a.fingerprint,a.created,a.selection_id AS selectionId,(SELECT count(*) FROM holdout_accesses b WHERE b.fingerprint=a.fingerprint)+coalesce((SELECT missing_count FROM holdout_import_bounds WHERE fingerprint=a.fingerprint),0) AS count FROM holdout_accesses a JOIN research_analyses s ON a.selection_id=s.id WHERE s.parent_id=? ORDER BY a.created", (parent_id,))]

    @staticmethod
    def validate_analysis(analysis, parent):
        if not isinstance(analysis, dict) or analysis.get("version") != 1 or analysis.get("kind") not in ("validation", "holdout", "monte_carlo", "assessment"):
            raise ValueError("Invalid research analysis")
        if analysis.get("hash") != digest({k: v for k, v in analysis.items() if k != "hash"}): raise ValueError("Analysis hash mismatch")
        if analysis.get("parentId") != parent["id"] or analysis.get("parentHash") != parent["resultHash"]: raise ValueError("Analysis parent hash mismatch")
        if not isinstance(analysis.get("payload"), dict) or not isinstance(analysis.get("id"), str) or type(analysis.get("createdAt")) is not int: raise ValueError("Invalid analysis envelope")
        payload = analysis["payload"]
        def number(value): return type(value) in (int, float) and math.isfinite(value)
        def summary(value):
            if not isinstance(value, dict) or any(not number(value.get(key)) for key in ("netReturn", "maxDrawdown")) or value.get("excessReturn") is not None and not number(value["excessReturn"]): raise ValueError("Invalid evaluation summary")
            if type(value.get("closedTrades")) is not int or value["closedTrades"] < 0: raise ValueError("Invalid closed-trade count")
            for key in ("dailyReturns", "benchmarkDailyReturns"):
                points = value.get(key)
                if not isinstance(points, list) or len(points) > 100000 or any(not isinstance(p, dict) or type(p.get("time")) is not int or not number(p.get("return")) for p in points): raise ValueError("Invalid daily return evidence")
        def assessment(value):
            labels = ("Insufficient evidence", "No convincing edge detected", "Promising but fragile", "Promising out-of-sample evidence; forward validation required")
            if not isinstance(value, dict) or value.get("label") not in labels or not isinstance(value.get("text"), str) or not isinstance(value.get("policyVersion"), str) or not isinstance(value.get("reasons"), list) or any(not isinstance(r, str) for r in value["reasons"]): raise ValueError("Invalid assessment evidence")
        if analysis["kind"] == "validation":
            if not isinstance(payload.get("selectedParams"), dict) or not isinstance(payload.get("splits"), dict) or not isinstance(payload.get("trials"), list): raise ValueError("Invalid frozen selection")
            for name in ("training", "validation", "holdout"):
                bounds = payload["splits"].get(name)
                if not isinstance(bounds, list) or len(bounds) != 2 or any(type(x) is not int for x in bounds) or not 0 <= bounds[0] < bounds[1] <= len(parent["dataset"]["bars"]): raise ValueError("Invalid split bounds")
            summary(payload.get("validation"))
            folds = payload.get("walkForward")
            if not isinstance(folds, list) or len(folds) != 3: raise ValueError("Invalid walk-forward evidence")
            for fold in folds: summary(fold.get("result"))
            if not isinstance(payload.get("stress"), dict) or set(payload["stress"]) != {"doubleCosts", "extraBarDelay"}: raise ValueError("Invalid stress evidence")
            for value in payload["stress"].values(): summary(value)
            if not isinstance(payload.get("neighbors"), list) or not isinstance(payload.get("causality"), dict) or payload["causality"].get("status") not in ("failed", "passed_sampled_checks"): raise ValueError("Invalid robustness evidence")
        elif analysis["kind"] == "holdout":
            summary(payload.get("result")); summary(payload.get("outOfSample")); assessment(payload.get("assessment"))
            if not isinstance(payload.get("selectionId"), str) or not isinstance(payload.get("selectionHash"), str) or not isinstance(payload.get("access"), dict) or type(payload["access"].get("count")) is not int or payload["access"]["count"] < 1: raise ValueError("Invalid holdout provenance")
        elif analysis["kind"] == "monte_carlo":
            if payload.get("method") not in ("stationary_daily", "iid_trades", "trade_permutation") or type(payload.get("simulations")) is not int or not 100 <= payload["simulations"] <= 5000: raise ValueError("Invalid simulation metadata")
            for key in ("lossFrequency", "drawdownThresholdFrequency", "drawdownThreshold"):
                if not number(payload.get(key)) or not 0 <= payload[key] <= 1: raise ValueError("Invalid conditional frequency")
            for key in ("endingEquity", "maxDrawdowns"):
                if not isinstance(payload.get(key), list) or len(payload[key]) != payload["simulations"] or any(not number(x) for x in payload[key]): raise ValueError("Invalid simulation distribution")
            bands = payload.get("bands")
            if not isinstance(bands, list) or not 2 <= len(bands) <= 400 or any(not isinstance(p, dict) or any(not number(p.get(k)) for k in ("step", "lower", "median", "upper")) for p in bands): raise ValueError("Invalid simulation paths")
            if not isinstance(payload.get("limitations"), str): raise ValueError("Missing simulation limitations")
        else: assessment(payload)
        encode(analysis)

    def import_bundle(self, bundle):
        parent, analyses = bundle["result"], bundle["analyses"]
        self.validate_result(parent)
        if not isinstance(analyses, list) or len(analyses) > 1000: raise ValueError("Invalid analysis bundle")
        for analysis in analyses: self.validate_analysis(analysis, parent)
        dataset = parent["dataset"]
        key = digest({k: v for k, v in dataset.items() if k != "bars"})
        with self.connect() as db:
            db.execute("BEGIN IMMEDIATE")
            existing = db.execute("SELECT envelope FROM results WHERE id=?", (parent["id"],)).fetchone()
            if existing and json.loads(existing[0]) != parent: raise ValueError("Conflicting imported result identity")
            db.execute("INSERT OR IGNORE INTO datasets VALUES(?,?)", (key, encode(dataset)))
            db.execute("INSERT OR IGNORE INTO results VALUES(?,?,?,?,?)", (parent["id"], parent["name"], parent["createdAt"], key, encode(parent)))
            for analysis in analyses:
                existing = db.execute("SELECT envelope FROM research_analyses WHERE id=?", (analysis["id"],)).fetchone()
                if existing and json.loads(existing[0]) != analysis: raise ValueError("Conflicting imported analysis identity")
                db.execute("INSERT OR IGNORE INTO research_analyses VALUES(?,?,?,?,?,?)", (analysis["id"], parent["id"], parent["resultHash"], analysis["kind"], analysis["createdAt"], encode(analysis)))
            # Imported access history is a lower bound; it cannot erase local requests.
            usage_records = bundle.get("holdoutUsage", [])
            for usage in usage_records:
                selection_id = usage.get("selectionId", "imported")
                if isinstance(usage.get("id"), str) and isinstance(usage.get("fingerprint"), str) and type(usage.get("created")) is int:
                    db.execute("INSERT OR IGNORE INTO holdout_accesses VALUES(?,?,?,?)", (usage["id"], usage["fingerprint"], selection_id, usage["created"]))
            for usage in usage_records:
                if type(usage.get("count")) is int and usage["count"] > 0:
                    local_count = db.execute("SELECT count(*) FROM holdout_accesses WHERE fingerprint=?", (usage["fingerprint"],)).fetchone()[0]
                    missing = max(0, usage["count"]-local_count)
                    db.execute("INSERT INTO holdout_import_bounds VALUES(?,?) ON CONFLICT(fingerprint) DO UPDATE SET missing_count=max(missing_count,excluded.missing_count)", (usage["fingerprint"], missing))
        return parent["id"]

    def save_analysis(self, analysis, job_id=None):
        parent = self.result(analysis["parentId"])
        self.validate_analysis(analysis, parent)
        encoded = encode(analysis)
        with self.connect() as db:
            db.execute("BEGIN IMMEDIATE")
            db.execute("INSERT INTO research_analyses VALUES(?,?,?,?,?,?)", (analysis["id"], analysis["parentId"], analysis["parentHash"], analysis["kind"], analysis["createdAt"], encoded))
            if job_id: db.execute("INSERT OR REPLACE INTO jobs VALUES(?,?)", (job_id, encode({"id": job_id, "stage": "complete", "resultId": parent["id"], "analysisId": analysis["id"], "resultKind": "analysis"})))

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
