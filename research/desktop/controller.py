import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import threading
import time
import uuid
from collections import OrderedDict

from archive import digest, encode
from process_limits import JobLimits
from validation import input_record, validate

STAGES = {"validating", "loading_data", "running_strategy", "calculating_report", "saving_result"}


class Controller:
    def __init__(self, archive, root, timeout=180, memory_mb=2048):
        if os.name == "nt" and sys.prefix != sys.base_prefix:
            raise RuntimeError("Windows venv redirectors cannot run supervised Helper jobs with the one-process limit. Use out/research-runtime/python.exe or the complete packaged Helper; see research/desktop/README.md.")
        self.archive, self.root, self.timeout, self.memory_mb = archive, Path(root), timeout, memory_mb
        self.root.mkdir(parents=True, exist_ok=True)
        self.lock = threading.Lock()
        self.active = None
        self.failures = OrderedDict()
        self.archive.recover_jobs()

    def status(self, job_id):
        return self.failures.get(job_id) or self.archive.get_job(job_id)

    def create(self, request):
        # Encode now: subsequent editor edits cannot mutate this request.
        captured = encode(request)
        if len(captured.encode()) > 32_000_000:
            raise ValueError("Request exceeds 32 MB")
        if request.get("operation") == "research_analysis" and request.get("kind") not in ("validation", "holdout", "monte_carlo", "assessment", "health"):
            raise ValueError("Unsupported research analysis")
        if request.get("operation") == "indicator":
            validate(request)
            cached = self.archive.cached_indicator(digest(input_record(request)))
            if cached:
                job = {"id": str(uuid.uuid4()), "stage": "complete", "resultId": cached["id"], "resultKind": "indicator"}
                self.archive.save_job(job)
                return job
        # A completed result is committed before its process resources finish closing.
        # Absorb that short lifecycle edge so an immediate next Backtest stays one-action.
        deadline = time.monotonic() + 2
        while self.active is not None and time.monotonic() < deadline:
            try:
                if self.status(self.active["id"])["stage"] not in ("complete", "failed", "cancelled"):
                    break
            except (KeyError, OSError):
                break
            time.sleep(.01)
        with self.lock:
            if self.active is not None:
                raise ValueError("A local job is already running; cancel it or wait for completion")
            job = {"id": str(uuid.uuid4()), "stage": "validating"}
            if request.get("operation") == "research_analysis":
                job["analysisContext"] = {"parentId": request["result"]["id"], "parentHash": request["result"]["resultHash"], "kind": request["kind"]}
            self.archive.save_job(job)
            self.active = {"id": job["id"], "cancel": threading.Event(), "limits": None}
            threading.Thread(target=self._run, args=(job, captured, self.active), daemon=True).start()
            return job

    def cancel(self, job_id):
        with self.lock:
            if self.active and self.active["id"] == job_id:
                self.active["cancel"].set()
                if self.active["limits"]:
                    self.active["limits"].terminate()
        return self.archive.get_job(job_id)

    def _run(self, job, captured, active):
        folder = Path(tempfile.mkdtemp(prefix="job-", dir=self.root))
        process = limits = None
        try:
            (folder / "request.json").write_text(captured, encoding="utf-8")
            # No inherited application tokens, API keys or cloud credentials.
            env = {k: os.environ[k] for k in ["SYSTEMROOT", "WINDIR", "SYSTEMDRIVE"] if k in os.environ}
            cache = self.root.parent / "numba-cache"
            cache.mkdir(exist_ok=True)
            env.update(TEMP=str(folder), TMP=str(folder), NUMBA_CACHE_DIR=str(cache), NUMBA_NUM_THREADS="2", OPENBLAS_NUM_THREADS="1", OMP_NUM_THREADS="1", PYTHONUTF8="1")
            process = subprocess.Popen([sys.executable, str(Path(__file__).with_name("child.py")), str(folder)], stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, cwd=folder, env=env, creationflags=subprocess.CREATE_NO_WINDOW)
            analysis_job = json.loads(captured).get("operation") == "research_analysis"
            limits = JobLimits(process.pid, self.memory_mb, cpu_seconds=1200 if analysis_job else 120)
            with self.lock:
                active["limits"] = limits
            process.stdin.write(b"run\n")
            process.stdin.close()
            started = time.monotonic()
            while process.poll() is None:
                if active["cancel"].wait(.1):
                    limits.terminate()
                    break
                deadline_seconds = max(self.timeout, 1800) if analysis_job else self.timeout
                if time.monotonic() - started > deadline_seconds:
                    limits.terminate()
                    raise TimeoutError(f"Local job exceeded the {deadline_seconds}-second wall-clock limit")
                status = folder / "status.json"
                if status.exists():
                    try:
                        next_status = json.loads(status.read_text(encoding="utf-8"))
                    except PermissionError as error:
                        if os.name == "nt" and getattr(error, "winerror", None) in (5, 32, 33):
                            continue  # The child is atomically replacing this status; retain the last one.
                        raise
                    if next_status.get("stage") in STAGES and any(job.get(k) != next_status.get(k) for k in ("stage", "completed", "total", "message")):
                        job.update({k: next_status[k] for k in ("stage", "completed", "total", "message") if k in next_status})
                        self.archive.save_job(job)
            process.wait(timeout=5)
            if active["cancel"].is_set():
                self.archive.save_job({**job, "stage": "cancelled"})
                return
            result_path = folder / "result.json"
            if process.returncode != 0 or not result_path.exists():
                status_path = folder / "status.json"
                status = json.loads(status_path.read_text(encoding="utf-8")) if status_path.exists() else {}
                self.archive.save_job({**job, "stage": "failed", "diagnostic": status.get("diagnostic", {"message": f"Strategy process exited with code {process.returncode} without a completed result; no result was saved", "exitCode": process.returncode})})
                return
            if result_path.stat().st_size > 128_000_000:
                raise ValueError("Result exceeds the 128 MB archive limit")
            result = json.loads(result_path.read_text(encoding="utf-8"))
            job["stage"] = "saving_result"
            self.archive.save_job(job)
            request = json.loads(captured)
            # Cancellation wins before commit; once commit starts its canonical
            # complete/failed status wins over a later cancellation request.
            with self.lock:
                if active["cancel"].is_set():
                    self.archive.save_job({**job, "stage": "cancelled"})
                    return
                if request.get("operation") == "research_analysis":
                    self.archive.save_analysis(result, job["id"])
                elif request.get("operation") == "monte_carlo":
                    result_id = request["result"]["id"]
                    self.archive.save_monte_carlo(result_id, result)
                    self.archive.save_job({"id": job["id"], "stage": "complete", "resultId": result_id})
                elif request.get("operation") == "indicator":
                    self.archive.save_indicator_evaluation(result, job["id"], request["dataset"])
                else:
                    self.archive.save_result(result, job["id"])
        except BaseException as error:
            failure = {**job, "stage": "failed", "diagnostic": {"message": f"{type(error).__name__}: {error}"}}
            self.failures[job["id"]] = failure
            while len(self.failures) > 1000:
                self.failures.popitem(last=False)
            try:
                self.archive.save_job(failure)
            except Exception:
                # An unreadable archive must not become a fictitious successful job.
                pass
        finally:
            if limits:
                limits.close()
            elif process and process.poll() is None:
                process.kill()
            if process:
                process.wait(timeout=5)
            # Only this controller-created job directory is removed.
            if folder.parent.resolve() == self.root.resolve():
                shutil.rmtree(folder, ignore_errors=True)
            with self.lock:
                if self.active is active:
                    self.active = None
