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

from archive import encode
from process_limits import JobLimits

STAGES = {"validating", "loading_data", "running_strategy", "calculating_report", "saving_result"}


class Controller:
    def __init__(self, archive, root, timeout=180, memory_mb=2048):
        self.archive, self.root, self.timeout, self.memory_mb = archive, Path(root), timeout, memory_mb
        self.root.mkdir(parents=True, exist_ok=True)
        self.lock = threading.Lock()
        self.active = None
        self.failures = {}
        self.archive.recover_jobs()

    def status(self, job_id):
        return self.failures.get(job_id) or self.archive.get_job(job_id)

    def create(self, request):
        # Encode now: subsequent editor edits cannot mutate this request.
        captured = encode(request)
        if len(captured.encode()) > 32_000_000:
            raise ValueError("Request exceeds 32 MB")
        with self.lock:
            if self.active is not None:
                raise ValueError("A local job is already running; cancel it or wait for completion")
            job = {"id": str(uuid.uuid4()), "stage": "validating"}
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
            limits = JobLimits(process.pid, self.memory_mb)
            with self.lock:
                active["limits"] = limits
            process.stdin.write(b"run\n")
            process.stdin.close()
            started = time.monotonic()
            while process.poll() is None:
                if active["cancel"].wait(.1):
                    limits.terminate()
                    break
                if time.monotonic() - started > self.timeout:
                    limits.terminate()
                    raise TimeoutError(f"Local job exceeded the {self.timeout}-second wall-clock limit")
                status = folder / "status.json"
                if status.exists():
                    next_status = json.loads(status.read_text(encoding="utf-8"))
                    if next_status.get("stage") in STAGES and job["stage"] != next_status["stage"]:
                        job["stage"] = next_status["stage"]
                        self.archive.save_job(job)
            process.wait(timeout=5)
            if active["cancel"].is_set():
                self.archive.save_job({"id": job["id"], "stage": "cancelled"})
                return
            result_path = folder / "result.json"
            if process.returncode != 0 or not result_path.exists():
                status_path = folder / "status.json"
                status = json.loads(status_path.read_text(encoding="utf-8")) if status_path.exists() else {}
                self.archive.save_job({"id": job["id"], "stage": "failed", "diagnostic": status.get("diagnostic", {"message": "Strategy process stopped unexpectedly or exceeded its resource limit; no result was saved"})})
                return
            if result_path.stat().st_size > 128_000_000:
                raise ValueError("Result exceeds the 128 MB archive limit")
            result = json.loads(result_path.read_text(encoding="utf-8"))
            job["stage"] = "saving_result"
            self.archive.save_job(job)
            request = json.loads(captured)
            if request.get("operation") == "monte_carlo":
                result_id = request["result"]["id"]
                self.archive.save_monte_carlo(result_id, result)
                self.archive.save_job({"id": job["id"], "stage": "complete", "resultId": result_id})
            else:
                self.archive.save_result(result, job["id"])
        except BaseException as error:
            failure = {"id": job["id"], "stage": "failed", "diagnostic": {"message": f"{type(error).__name__}: {error}"}}
            self.failures[job["id"]] = failure
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
                self.active = None
