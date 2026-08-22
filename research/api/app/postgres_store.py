from __future__ import annotations

import json
import os
import time
from typing import Any

from .models import ResearchDiagnostic, ResearchJob


class PostgresStoreUnavailable(RuntimeError):
    pass


class PostgresResearchStore:
    """Optional durable research store.

    The service only enables this store when a PostgreSQL DSN is explicitly
    configured. The in-memory development store remains intentionally separate
    so an absent database cannot become a hidden persistence fallback.
    """

    def __init__(self, pool: Any):
        self.pool = pool

    @classmethod
    async def connect_from_environment(cls) -> "PostgresResearchStore":
        dsn = os.getenv("RESEARCH_DATABASE_URL", "")
        if not dsn.startswith("postgresql"):
            raise PostgresStoreUnavailable("RESEARCH_DATABASE_URL must be a PostgreSQL DSN before durable research jobs are enabled")
        try:
            import asyncpg
        except ImportError as error:  # pragma: no cover - deployment guard
            raise PostgresStoreUnavailable("asyncpg is not installed in the research API image") from error
        return cls(await asyncpg.create_pool(dsn=dsn, min_size=1, max_size=5, command_timeout=15))

    async def enqueue(self, job: ResearchJob, workspace_id: str, payload: dict[str, Any]) -> None:
        await self.pool.execute(
            """
            INSERT INTO research_job (id, workspace_id, kind, status, input_hash, request_payload, diagnostics, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, now(), now())
            """,
            job.id,
            workspace_id,
            job.kind,
            job.status,
            job.input_hash,
            json.dumps(payload, sort_keys=True),
            json.dumps([item.model_dump() for item in job.diagnostics]),
        )

    async def claim_next(self, worker_runtime_lock: str) -> dict[str, Any] | None:
        row = await self.pool.fetchrow(
            """
            WITH candidate AS (
              SELECT id FROM research_job
              WHERE status = 'QUEUED' AND cancel_requested_at IS NULL
              ORDER BY created_at
              FOR UPDATE SKIP LOCKED
              LIMIT 1
            )
            UPDATE research_job
            SET status = 'RUNNING', claimed_at = now(), updated_at = now(), worker_runtime_lock = $1
            WHERE id = (SELECT id FROM candidate)
            RETURNING id, kind, request_payload, input_hash
            """,
            worker_runtime_lock,
        )
        return dict(row) if row else None

    async def complete(self, job_id: str, status: str, diagnostics: list[ResearchDiagnostic], result: dict[str, Any] | None = None) -> None:
        if status not in {"SUCCEEDED", "FAILED", "CANCELLED", "UNSUPPORTED"}:
            raise ValueError("invalid terminal research job state")
        await self.pool.execute(
            """
            UPDATE research_job
            SET status = $2, diagnostics = $3::jsonb, completed_at = now(), updated_at = now()
            WHERE id = $1
            """,
            job_id,
            status,
            json.dumps([item.model_dump() for item in diagnostics]),
        )

    async def request_cancel(self, job_id: str) -> bool:
        updated = await self.pool.execute(
            """
            UPDATE research_job
            SET cancel_requested_at = now(), updated_at = now()
            WHERE id = $1 AND status IN ('QUEUED', 'RUNNING')
            """,
            job_id,
        )
        return updated.endswith("1")

    async def close(self) -> None:
        await self.pool.close()
