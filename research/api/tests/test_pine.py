from app.models import ArtifactKind, ConvertPineRequest
from app.pine import convert


def request(source: str) -> ConvertPineRequest:
    return ConvertPineRequest(
        source=source,
        rights_attestation="I own or am authorized to convert this Pine source.",
        source_version="v6",
        target_kind=ArtifactKind.STRATEGY,
    )


def test_blocks_lookahead_enabled_source() -> None:
    result = convert(request("strategy('x')\nrequest.security('BINANCE:BTCUSDT', '5', close, lookahead=barmerge.lookahead_on)"))
    assert result.status == "BLOCKED"
    assert any(item.status == "BLOCKED" for item in result.constructs)


def test_returns_a_review_draft_for_assignment_series_semantics() -> None:
    result = convert(request("strategy('x')\nfast = ta.ema(close, 8)"))
    assert result.status == "MANUAL_REVIEW_REQUIRED"
    assert result.generated_python is not None
    assert "REVIEW REQUIRED" in result.generated_python


def test_supported_declaration_can_reach_review_ready_state() -> None:
    result = convert(request("strategy('x')"))
    assert result.status == "READY_FOR_REVIEW"
    assert result.generated_python_hash is not None
