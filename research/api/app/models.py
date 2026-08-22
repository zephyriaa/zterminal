from __future__ import annotations

from enum import Enum
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

SCHEMA_VERSION = "research.v2.0"


class ArtifactKind(str, Enum):
    INDICATOR = "indicator"
    STRATEGY = "strategy"


class ArtifactLanguage(str, Enum):
    PYTHON = "python"
    PINE = "pine"
    ZS_ARCHIVE = "zs_archive"


class DiagnosticLevel(str, Enum):
    ERROR = "ERROR"
    WARNING = "WARNING"
    INFO = "INFO"


class ResearchDiagnostic(BaseModel):
    model_config = ConfigDict(extra="forbid")

    code: str
    level: DiagnosticLevel
    message: str
    line: int | None = None
    column: int | None = None


class ArtifactOrigin(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: Literal["native_python", "pine_import", "zs_archive"]
    source_version: str | None = None
    parent_artifact_id: str | None = None


class ValidateArtifactRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    schema_version: Literal[SCHEMA_VERSION] = SCHEMA_VERSION
    kind: ArtifactKind
    language: ArtifactLanguage
    source: str = Field(min_length=1, max_length=200_000)
    runtime_lock: str = Field(min_length=1, max_length=200)
    rights_attestation: str = Field(min_length=12, max_length=2_000)
    origin: ArtifactOrigin


class DeclaredParameter(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str
    kind: Literal["int", "float", "bool", "str"]
    default: int | float | bool | str
    minimum: int | float | None = None
    maximum: int | float | None = None


class ValidateArtifactResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    schema_version: Literal[SCHEMA_VERSION] = SCHEMA_VERSION
    status: Literal["VALID", "INVALID", "UNSUPPORTED"]
    source_hash: str
    environment_hash: str
    diagnostics: list[ResearchDiagnostic]
    parameters: list[DeclaredParameter] = Field(default_factory=list)
    artifact_id: str | None = None


class DatasetManifest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    provider: str = Field(min_length=1, max_length=64)
    native_symbol: str = Field(min_length=1, max_length=64)
    timeframe: str = Field(pattern=r"^(1m|3m|5m|15m|30m|1h|4h|1d)$")
    from_ms: int = Field(ge=0)
    to_ms: int = Field(ge=0)
    quality_status: Literal["HISTORICAL", "OBSERVED", "DEGRADED", "UNAVAILABLE"]
    bar_count: int | None = Field(default=None, ge=0)

    @field_validator("to_ms")
    @classmethod
    def end_must_follow_start(cls, value: int, info: Any) -> int:
        start = info.data.get("from_ms")
        if start is not None and value <= start:
            raise ValueError("to_ms must be greater than from_ms")
        return value


class ExecutionPolicy(BaseModel):
    model_config = ConfigDict(extra="forbid")

    fill_model: Literal["next_bar_open"] = "next_bar_open"
    commission_per_contract: float = Field(ge=0, le=1_000_000)
    slippage_ticks: float = Field(ge=0, le=1_000_000)
    spread_ticks: float = Field(ge=0, le=1_000_000)
    position_size: float = Field(gt=0, le=1_000_000)


class CreateJobRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    schema_version: Literal[SCHEMA_VERSION] = SCHEMA_VERSION
    workspace_id: str = Field(default="anonymous-research", min_length=1, max_length=128)
    kind: Literal["indicator_evaluation", "strategy_backtest", "pine_conversion"]
    artifact_id: str | None = None
    dataset_manifest: DatasetManifest | None = None
    parameters: dict[str, int | float | bool | str] = Field(default_factory=dict)
    execution_policy: ExecutionPolicy | None = None
    pine_source: str | None = Field(default=None, max_length=200_000)
    rights_attestation: str | None = Field(default=None, max_length=2_000)


class ResearchJob(BaseModel):
    model_config = ConfigDict(extra="forbid")

    schema_version: Literal[SCHEMA_VERSION] = SCHEMA_VERSION
    id: str
    kind: str
    status: Literal["QUEUED", "RUNNING", "SUCCEEDED", "FAILED", "CANCELLED", "UNSUPPORTED"]
    created_at_ms: int
    updated_at_ms: int
    input_hash: str
    diagnostics: list[ResearchDiagnostic] = Field(default_factory=list)
    result: dict[str, Any] | None = None


class PineConstruct(BaseModel):
    model_config = ConfigDict(extra="forbid")

    line: int
    source: str
    status: Literal["SUPPORTED", "TRANSFORMED", "MANUAL_REVIEW", "BLOCKED"]
    message: str


class ConvertPineRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    schema_version: Literal[SCHEMA_VERSION] = SCHEMA_VERSION
    source: str = Field(min_length=1, max_length=200_000)
    rights_attestation: str = Field(min_length=12, max_length=2_000)
    source_version: Literal["v4", "v5", "v6", "unknown"] = "unknown"
    target_kind: ArtifactKind


class ConvertPineResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    schema_version: Literal[SCHEMA_VERSION] = SCHEMA_VERSION
    status: Literal["READY_FOR_REVIEW", "MANUAL_REVIEW_REQUIRED", "BLOCKED"]
    source_hash: str
    converter_version: str
    constructs: list[PineConstruct]
    generated_python: str | None = None
    generated_python_hash: str | None = None
    diagnostics: list[ResearchDiagnostic] = Field(default_factory=list)
