from app.models import ArtifactKind, ArtifactLanguage, ArtifactOrigin, ValidateArtifactRequest
from app.policy import validate_python_source
from app.service import ResearchService


def test_accepts_a_single_research_entrypoint() -> None:
    result = validate_python_source(
        "from zterminal_research import strategy\n"
        "@strategy(name='test')\n"
        "def sample(ctx, length=20):\n"
        "    return None\n"
    )
    assert result.valid


def test_accepts_sdk_parameter_declarations() -> None:
    result = validate_python_source(
        "from zterminal_research import strategy, inputs\n"
        "@strategy(name='test')\n"
        "def sample(ctx, length=inputs.int(20, min=1, max=100)):\n"
        "    return None\n"
    )
    assert result.valid
    assert result.parameters[0].name == "length"
    assert result.parameters[0].minimum == 1


def test_rejects_network_imports() -> None:
    result = validate_python_source(
        "import requests\n"
        "from zterminal_research import indicator\n"
        "@indicator(name='bad')\n"
        "def sample(ctx):\n"
        "    return {}\n"
    )
    assert not result.valid
    assert any(item.code == "UNSUPPORTED_IMPORT" for item in result.diagnostics)


def test_archival_zs_cannot_become_a_live_artifact() -> None:
    response = ResearchService().validate_artifact(ValidateArtifactRequest(
        kind=ArtifactKind.STRATEGY,
        language=ArtifactLanguage.ZS_ARCHIVE,
        source="strategy('legacy')",
        runtime_lock="archive-only",
        rights_attestation="I own this archived strategy source.",
        origin=ArtifactOrigin(kind="zs_archive"),
    ))
    assert response.status == "UNSUPPORTED"
    assert response.diagnostics[0].code == "ZS_RETIRED"
