from __future__ import annotations

import ast
import hashlib
import os
import platform
import time
from typing import Any, Dict, List
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware

try:
    from .models import (
        CreateBacktestJobRequest,
        JobResponse,
        JobStatus,
        SystemHealthResponse,
    )
    from .queue import JobQueueManager
except ImportError:
    from api.models import (
        CreateBacktestJobRequest,
        JobResponse,
        JobStatus,
        SystemHealthResponse,
    )
    from api.queue import JobQueueManager

app = FastAPI(
    title="ZTerminal Quant & Research API",
    version="1.0.0",
    description="Dedicated asynchronous quantitative engine control plane.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

queue_mgr = JobQueueManager()


@app.get("/health", response_model=SystemHealthResponse)
def health() -> SystemHealthResponse:
    redis_ok = queue_mgr.is_redis_connected()
    return SystemHealthResponse(
        status="ok" if redis_ok or os.getenv("ALLOW_IN_MEMORY_QUEUE", "1") == "1" else "degraded",
        version="1.0.0",
        redis_connected=redis_ok,
        database_connected=bool(os.getenv("DATABASE_URL")),
        active_workers=1,
        queued_jobs=queue_mgr.count_queued(),
        platform=platform.platform(),
    )


@app.get("/ready")
def ready() -> Dict[str, Any]:
    return {"ready": True, "at": int(time.time() * 1000)}


@app.post("/v1/artifacts/validate")
def validate_artifact(payload: Dict[str, Any]) -> Dict[str, Any]:
    source = payload.get("source", "")
    diagnostics: List[Dict[str, Any]] = []

    try:
        tree = ast.parse(source)
        # Verify strategy or calculate is defined
        fns = [node.name for node in ast.walk(tree) if isinstance(node, ast.FunctionDef)]
        if not any(name in ("strategy", "calculate", "indicator") for name in fns):
            diagnostics.append({
                "code": "MISSING_STRATEGY_FUNCTION",
                "level": "ERROR",
                "message": "Source must define a function named 'strategy(data, params)' or 'calculate(data, params)'",
            })
    except SyntaxError as err:
        diagnostics.append({
            "code": "SYNTAX_ERROR",
            "level": "ERROR",
            "message": str(err.msg),
            "line": err.lineno,
            "column": err.offset,
        })

    is_valid = len(diagnostics) == 0
    source_hash = hashlib.sha256(source.encode()).hexdigest()

    return {
        "status": "VALID" if is_valid else "INVALID",
        "source_hash": source_hash,
        "artifact_id": f"art_{source_hash[:16]}",
        "diagnostics": diagnostics,
    }


@app.post("/v1/jobs", response_model=JobResponse, status_code=status.HTTP_202_ACCEPTED)
def create_job(request: CreateBacktestJobRequest) -> JobResponse:
    job_id = queue_mgr.enqueue(request.model_dump())
    job = queue_mgr.get_job(job_id)
    if not job:
        raise HTTPException(status_code=500, detail="Failed to enqueue job")

    return JobResponse(
        id=job["id"],
        workspace_id=job["workspace_id"],
        status=JobStatus(job["status"]),
        stage=job["stage"],
        created_at_ms=job["created_at_ms"],
        diagnostics=job.get("diagnostics", []),
    )


@app.get("/v1/jobs/{job_id}", response_model=Dict[str, Any])
def get_job(job_id: str) -> Dict[str, Any]:
    job = queue_mgr.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
    return job


@app.post("/v1/jobs/{job_id}/cancel", response_model=Dict[str, Any])
def cancel_job(job_id: str) -> Dict[str, Any]:
    success = queue_mgr.cancel_job(job_id)
    if not success:
        raise HTTPException(status_code=400, detail="Cannot cancel completed or non-existent job")
    return {"id": job_id, "status": "CANCELLED"}
