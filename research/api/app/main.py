from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, status

from .models import ConvertPineRequest, ConvertPineResponse, CreateJobRequest, ResearchJob, ValidateArtifactRequest, ValidateArtifactResponse
from .pine import convert
from .service import ResearchService
from .postgres_store import PostgresResearchStore, PostgresStoreUnavailable

service = ResearchService()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    try:
        service.durable_store = await PostgresResearchStore.connect_from_environment()
    except PostgresStoreUnavailable:
        service.durable_store = None
    yield
    if service.durable_store is not None:
        await service.durable_store.close()


app = FastAPI(
    title="ZTerminal Research API",
    version="0.1.0",
    description="Python-first, read-only research control plane. User code is never executed in the API process.",
    lifespan=lifespan,
)


@app.get("/health")
def health() -> dict[str, str]:
    return {
        "status": "ok",
        "schema_version": "research.v2.0",
        "execution": "worker-required",
        "brokerage": "disabled",
    }


@app.post("/v1/artifacts/validate", response_model=ValidateArtifactResponse)
def validate_artifact(request: ValidateArtifactRequest) -> ValidateArtifactResponse:
    return service.validate_artifact(request)


@app.post("/v1/pine/convert", response_model=ConvertPineResponse)
def convert_pine(request: ConvertPineRequest) -> ConvertPineResponse:
    return convert(request)


@app.post("/v1/jobs", response_model=ResearchJob, status_code=status.HTTP_202_ACCEPTED)
async def create_job(request: CreateJobRequest) -> ResearchJob:
    return await service.enqueue_job(request)


@app.get("/v1/jobs/{job_id}", response_model=ResearchJob)
def get_job(job_id: str) -> ResearchJob:
    job = service.get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="research job not found")
    return job


@app.post("/v1/jobs/{job_id}/cancel", response_model=ResearchJob)
def cancel_job(job_id: str) -> ResearchJob:
    job = service.cancel_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="research job not found")
    return job
