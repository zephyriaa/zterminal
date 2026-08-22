from __future__ import annotations

import hashlib
import json
import time
import uuid
from dataclasses import dataclass, field
from typing import Any

from .models import (
    ArtifactLanguage,
    CreateJobRequest,
    DiagnosticLevel,
    ResearchDiagnostic,
    ResearchJob,
    ValidateArtifactRequest,
    ValidateArtifactResponse,
)
from .policy import content_hash, environment_hash, validate_python_source


@dataclass
class ResearchService:
    artifacts: dict[str, ValidateArtifactRequest] = field(default_factory=dict)
    jobs: dict[str, ResearchJob] = field(default_factory=dict)
    durable_store: Any | None = None

    def validate_artifact(self, request: ValidateArtifactRequest) -> ValidateArtifactResponse:
        source_hash = content_hash(request.source)
        env_hash = environment_hash(request.runtime_lock)
        if request.language == ArtifactLanguage.ZS_ARCHIVE:
            return ValidateArtifactResponse(
                status="UNSUPPORTED",
                source_hash=source_hash,
                environment_hash=env_hash,
                diagnostics=[ResearchDiagnostic(
                    code="ZS_RETIRED",
                    level=DiagnosticLevel.INFO,
                    message="ZS source is archival only. Export or convert it to the Python research contract.",
                )],
            )
        if request.language == ArtifactLanguage.PINE:
            return ValidateArtifactResponse(
                status="UNSUPPORTED",
                source_hash=source_hash,
                environment_hash=env_hash,
                diagnostics=[ResearchDiagnostic(
                    code="PINE_REVIEW_REQUIRED",
                    level=DiagnosticLevel.INFO,
                    message="Pine source must pass the conversion-review workflow before it becomes Python research code.",
                )],
            )
        result = validate_python_source(request.source)
        if not result.valid:
            return ValidateArtifactResponse(
                status="INVALID",
                source_hash=source_hash,
                environment_hash=env_hash,
                diagnostics=result.diagnostics,
                parameters=result.parameters,
            )
        artifact_id = f"artifact_{uuid.uuid4().hex}"
        self.artifacts[artifact_id] = request
        return ValidateArtifactResponse(
            status="VALID",
            source_hash=source_hash,
            environment_hash=env_hash,
            diagnostics=result.diagnostics,
            parameters=result.parameters,
            artifact_id=artifact_id,
        )

    def create_job(self, request: CreateJobRequest) -> ResearchJob:
        diagnostics: list[ResearchDiagnostic] = []
        if request.kind in {"indicator_evaluation", "strategy_backtest"}:
            if not request.artifact_id or request.artifact_id not in self.artifacts:
                diagnostics.append(ResearchDiagnostic(
                    code="ARTIFACT_NOT_FOUND",
                    level=DiagnosticLevel.ERROR,
                    message="a validated Python artifact is required before a research job can be queued",
                ))
            if not request.dataset_manifest:
                diagnostics.append(ResearchDiagnostic(
                    code="DATASET_MANIFEST_REQUIRED",
                    level=DiagnosticLevel.ERROR,
                    message="a provider-labelled dataset manifest is required",
                ))
            elif request.dataset_manifest.quality_status in {"UNAVAILABLE", "DEGRADED"}:
                diagnostics.append(ResearchDiagnostic(
                    code="DATASET_UNAVAILABLE",
                    level=DiagnosticLevel.ERROR,
                    message="research jobs do not execute with unavailable or degraded source data",
                ))
        if request.kind == "strategy_backtest" and not request.execution_policy:
            diagnostics.append(ResearchDiagnostic(
                code="EXECUTION_POLICY_REQUIRED",
                level=DiagnosticLevel.ERROR,
                message="a next-bar execution policy is required for a strategy backtest",
            ))
        if request.kind == "pine_conversion":
            if not request.pine_source or not request.rights_attestation or len(request.rights_attestation.strip()) < 12:
                diagnostics.append(ResearchDiagnostic(
                    code="RIGHTS_ATTESTATION_REQUIRED",
                    level=DiagnosticLevel.ERROR,
                    message="Pine conversion requires pasted source and a rights/authorization attestation",
                ))

        now = int(time.time() * 1000)
        job_id = f"job_{uuid.uuid4().hex}"
        input_hash = hashlib.sha256(json.dumps(request.model_dump(mode="json"), sort_keys=True).encode()).hexdigest()
        status = "QUEUED" if not diagnostics else "UNSUPPORTED"
        job = ResearchJob(
            id=job_id,
            kind=request.kind,
            status=status,
            created_at_ms=now,
            updated_at_ms=now,
            input_hash=input_hash,
            diagnostics=diagnostics,
            result=None,
        )
        self.jobs[job_id] = job
        return job

    async def enqueue_job(self, request: CreateJobRequest) -> ResearchJob:
        job = self.create_job(request)
        if job.status != "QUEUED":
            return job
        if self.durable_store is None:
            job.status = "UNSUPPORTED"
            job.diagnostics.append(ResearchDiagnostic(
                code="DURABLE_QUEUE_UNAVAILABLE",
                level=DiagnosticLevel.ERROR,
                message="research jobs require the configured PostgreSQL queue; no in-memory execution fallback is permitted",
            ))
            job.updated_at_ms = int(time.time() * 1000)
            return job
        await self.durable_store.enqueue(job, request.workspace_id, request.model_dump(mode="json"))
        return job

    def get_job(self, job_id: str) -> ResearchJob | None:
        return self.jobs.get(job_id)

    def cancel_job(self, job_id: str) -> ResearchJob | None:
        job = self.jobs.get(job_id)
        if job is None:
            return None
        if job.status in {"QUEUED", "RUNNING"}:
            job.status = "CANCELLED"
            job.updated_at_ms = int(time.time() * 1000)
        return job
