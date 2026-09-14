from __future__ import annotations

import json
import logging
import os
import time
import uuid
from typing import Any, Dict, Optional

logger = logging.getLogger("zterminal.quant.queue")


class JobQueueManager:
    """
    Task queue manager supporting Redis with local in-memory fallback.
    Handles enqueuing, status polling, cancellation, and job state updates.
    """

    QUEUE_KEY = "zt:quant:jobs:queued"
    JOB_PREFIX = "zt:quant:job:"
    CANCEL_PREFIX = "zt:quant:cancel:"

    def __init__(self, redis_url: Optional[str] = None):
        self.redis_url = redis_url or os.getenv("REDIS_URL", "redis://localhost:6379/0")
        self._redis = None
        self._memory_queue = []
        self._memory_jobs: Dict[str, Dict[str, Any]] = {}
        self._memory_cancels = set()
        self._connect()

    def _connect(self):
        try:
            import redis
            client = redis.Redis.from_url(self.redis_url, decode_responses=True)
            client.ping()
            self._redis = client
            logger.info("Connected to Redis task queue at %s", self.redis_url)
        except Exception as e:
            logger.warning("Redis unavailable (%s); using in-memory queue fallback", e)
            self._redis = None

    def is_redis_connected(self) -> bool:
        if not self._redis:
            return False
        try:
            return bool(self._redis.ping())
        except Exception:
            return False

    def enqueue(self, payload: Dict[str, Any]) -> str:
        job_id = f"job_{uuid.uuid4().hex[:16]}"
        now = int(time.time() * 1000)

        record = {
            "id": job_id,
            "workspace_id": payload.get("workspace_id", "default"),
            "status": "QUEUED",
            "stage": "queued",
            "payload": payload,
            "error": None,
            "result_id": None,
            "created_at_ms": now,
            "completed_at_ms": None,
            "diagnostics": [],
        }

        if self._redis:
            self._redis.set(f"{self.JOB_PREFIX}{job_id}", json.dumps(record), ex=86400)
            self._redis.rpush(self.QUEUE_KEY, job_id)
        else:
            self._memory_jobs[job_id] = record
            self._memory_queue.append(job_id)

        return job_id

    def get_job(self, job_id: str) -> Optional[Dict[str, Any]]:
        if self._redis:
            raw = self._redis.get(f"{self.JOB_PREFIX}{job_id}")
            return json.loads(raw) if raw else None
        return self._memory_jobs.get(job_id)

    def update_job(self, job_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        current = self.get_job(job_id)
        if not current:
            return None
        current.update(updates)
        if self._redis:
            # Free-tier policy: evict completed job states after 1 hour (3600s) to keep Redis footprint minimal
            ttl = 3600 if current.get("status") in ("SUCCEEDED", "FAILED", "CANCELLED") else 14400
            self._redis.set(f"{self.JOB_PREFIX}{job_id}", json.dumps(current), ex=ttl)
        else:
            self._memory_jobs[job_id] = current
        return current

    def cancel_job(self, job_id: str) -> bool:
        current = self.get_job(job_id)
        if not current:
            return False
        if current["status"] in ("SUCCEEDED", "FAILED", "CANCELLED"):
            return False

        if self._redis:
            self._redis.set(f"{self.CANCEL_PREFIX}{job_id}", "1", ex=3600)
        else:
            self._memory_cancels.add(job_id)

        self.update_job(job_id, {"status": "CANCELLED", "stage": "cancelled", "completed_at_ms": int(time.time() * 1000)})
        return True

    def is_cancelled(self, job_id: str) -> bool:
        if self._redis:
            return bool(self._redis.exists(f"{self.CANCEL_PREFIX}{job_id}"))
        return job_id in self._memory_cancels

    def pop_next(self, timeout_seconds: int = 5) -> Optional[Dict[str, Any]]:
        if self._redis:
            item = self._redis.blpop(self.QUEUE_KEY, timeout=timeout_seconds)
            if not item:
                return None
            job_id = item[1]
            return self.get_job(job_id)
        else:
            if not self._memory_queue:
                return None
            job_id = self._memory_queue.pop(0)
            return self._memory_jobs.get(job_id)

    def count_queued(self) -> int:
        if self._redis:
            return int(self._redis.llen(self.QUEUE_KEY))
        return len(self._memory_queue)
