import asyncio

from app.models import (
    ArtifactKind,
    ArtifactLanguage,
    ArtifactOrigin,
    CreateJobRequest,
    DatasetManifest,
    ExecutionPolicy,
    ValidateArtifactRequest,
)
from app.service import ResearchService


def validated_artifact(service: ResearchService) -> str:
    result = service.validate_artifact(ValidateArtifactRequest(
        kind=ArtifactKind.STRATEGY,
        language=ArtifactLanguage.PYTHON,
        source="from zterminal_research import strategy\n@strategy(name='x')\ndef x(ctx):\n    return None\n",
        runtime_lock="python-3.12/research-sdk-0.1.0",
        rights_attestation="I own or am authorized to use this research source.",
        origin=ArtifactOrigin(kind="native_python"),
    ))
    assert result.artifact_id
    return result.artifact_id


def test_withholds_job_without_durable_queue() -> None:
    service = ResearchService()
    artifact_id = validated_artifact(service)
    job = asyncio.run(service.enqueue_job(CreateJobRequest(
        kind="strategy_backtest",
        artifact_id=artifact_id,
        dataset_manifest=DatasetManifest(provider="binance", native_symbol="BTCUSDT", timeframe="5m", from_ms=1, to_ms=2, quality_status="HISTORICAL"),
        execution_policy=ExecutionPolicy(commission_per_contract=0, slippage_ticks=0, spread_ticks=0, position_size=1),
    )))
    assert job.status == "UNSUPPORTED"
    assert any(item.code == "DURABLE_QUEUE_UNAVAILABLE" for item in job.diagnostics)
