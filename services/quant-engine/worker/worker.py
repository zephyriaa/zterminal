from __future__ import annotations

import logging
import os
import signal
import sys
import time
from typing import Any, Dict

try:
    from api.queue import JobQueueManager
except ImportError:
    from ..api.queue import JobQueueManager
from .engine import execute_quant_backtest
from .limits import ExecutionLimiter, ResourceLimitExceeded

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("zterminal.quant.worker")


class QuantWorker:
    def __init__(self, queue_manager: JobQueueManager):
        self.queue = queue_manager
        self.running = True

    def stop(self):
        self.running = False

    def process_job(self, job: Dict[str, Any]):
        job_id = job["id"]
        logger.info("Claimed job %s", job_id)

        self.queue.update_job(job_id, {"status": "RUNNING", "stage": "running"})

        payload = job.get("payload", {})
        source = payload.get("source", "")
        config = payload.get("config", {})
        params = payload.get("params", {})
        bars = payload.get("bars", [])
        limits_cfg = payload.get("limits", {})

        limiter = ExecutionLimiter(
            max_wall_seconds=int(limits_cfg.get("max_wall_seconds", 180)),
            max_memory_mb=int(limits_cfg.get("max_memory_mb", 2048)),
            is_cancelled=lambda: self.queue.is_cancelled(job_id),
        )

        try:
            result = execute_quant_backtest(source, bars, config, params, limiter)
            now = int(time.time() * 1000)
            self.queue.update_job(job_id, {
                "status": "SUCCEEDED",
                "stage": "complete",
                "result_id": result["result_id"],
                "completed_at_ms": now,
                "result": result,
            })
            logger.info("Job %s completed successfully", job_id)

        except ResourceLimitExceeded as e:
            now = int(time.time() * 1000)
            is_cancel = "cancelled" in str(e).lower()
            status = "CANCELLED" if is_cancel else "FAILED"
            self.queue.update_job(job_id, {
                "status": status,
                "stage": "cancelled" if is_cancel else "failed",
                "error": str(e),
                "completed_at_ms": now,
            })
            logger.warning("Job %s stopped due to resource limit: %s", job_id, e)

        except Exception as e:
            now = int(time.time() * 1000)
            self.queue.update_job(job_id, {
                "status": "FAILED",
                "stage": "failed",
                "error": f"{type(e).__name__}: {str(e)}",
                "completed_at_ms": now,
            })
            logger.error("Job %s failed with exception: %s", job_id, e, exc_info=True)

    def run(self):
        logger.info("Quant worker started. Listening for jobs...")
        while self.running:
            try:
                job = self.queue.pop_next(timeout_seconds=2)
                if job:
                    self.process_job(job)
            except KeyboardInterrupt:
                break
            except Exception as e:
                logger.error("Worker error in poll loop: %s", e)
                time.sleep(1)
        logger.info("Quant worker exiting.")


def main():
    queue = JobQueueManager()
    worker = QuantWorker(queue)

    def handle_signal(_sig, _frame):
        worker.stop()

    signal.signal(signal.SIGINT, handle_signal)
    signal.signal(signal.SIGTERM, handle_signal)

    worker.run()


if __name__ == "__main__":
    main()
