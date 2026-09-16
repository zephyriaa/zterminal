from __future__ import annotations

from enum import StrEnum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class JobStatus(StrEnum):
    QUEUED = "QUEUED"
    RUNNING = "RUNNING"
    SUCCEEDED = "SUCCEEDED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


class BacktestExecutionConfig(BaseModel):
    symbol: str
    timeframe: str
    initial_capital: float = Field(default=100000.0, gt=0)
    fee_bps: float = Field(default=2.5, ge=0)
    slippage_bps: float = Field(default=1.0, ge=0)
    direction: str = Field(default="both")
    allocation: float = Field(default=1.0, gt=0, le=1.0)
    quantity_step: float = Field(default=0.001, gt=0)
    multiplier: float = Field(default=1.0, gt=0)


class JobResourceLimits(BaseModel):
    max_bars: int = Field(default=100000, le=250000)
    max_wall_seconds: int = Field(default=180, le=300)
    max_memory_mb: int = Field(default=2048, le=4096)
    max_grid_combinations: int = Field(default=100, le=500)


class CreateBacktestJobRequest(BaseModel):
    workspace_id: str
    name: str = Field(default="Untitled Strategy", max_length=120)
    source: str
    config: BacktestExecutionConfig
    params: Dict[str, Any] = Field(default_factory=dict)
    dataset_manifest_id: Optional[str] = None
    bars: Optional[List[Dict[str, Any]]] = None
    limits: JobResourceLimits = Field(default_factory=JobResourceLimits)


class JobResponse(BaseModel):
    id: str
    workspace_id: str
    status: JobStatus
    stage: str = "queued"
    error: Optional[str] = None
    result_id: Optional[str] = None
    created_at_ms: int
    completed_at_ms: Optional[int] = None
    diagnostics: List[Dict[str, Any]] = Field(default_factory=list)


class TearSheet(BaseModel):
    sharpe_ratio: float
    deflated_sharpe_ratio: float
    sortino_ratio: float
    max_drawdown_pct: float

class BacktestResult(BaseModel):
    strategy_id: str
    optimized_params: dict
    tear_sheet: TearSheet

class SystemHealthResponse(BaseModel):
    status: str
    version: str
    redis_connected: bool
    database_connected: bool
    active_workers: int
    queued_jobs: int
    platform: str
