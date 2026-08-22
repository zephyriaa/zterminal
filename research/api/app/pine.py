from __future__ import annotations

import re
from dataclasses import dataclass

from .models import (
    ArtifactKind,
    ConvertPineRequest,
    ConvertPineResponse,
    DiagnosticLevel,
    PineConstruct,
    ResearchDiagnostic,
)
from .policy import content_hash

CONVERTER_VERSION = "pine-python-review-0.1.0"
BLOCKED_TOKENS = {
    "request.security": "multi-symbol or multi-timeframe request.security requires manual redesign",
    "lookahead_on": "lookahead-enabled source cannot be converted into an anti-lookahead research artifact",
    "alert(": "alerts are not part of the research runtime",
    "alertcondition": "alerts are not part of the research runtime",
    "label.": "chart labels require a separate reviewed visual specification",
    "line.": "chart drawings require a separate reviewed visual specification",
    "box.": "chart drawings require a separate reviewed visual specification",
    "table.": "tables require a separate reviewed visual specification",
    "import ": "Pine library imports are not converted automatically",
    "strategy.order": "custom order semantics require manual execution-policy review",
    "strategy.exit": "bracket/conditional exit semantics require manual execution-policy review",
}
SUPPORTED_TA = {
    "ta.ema": "ta.ema maps to ta.ema",
    "ta.sma": "ta.sma maps to ta.sma",
    "ta.crossover": "ta.crossover maps to ta.crossover",
    "ta.crossunder": "ta.crossunder maps to ta.crossunder",
}


@dataclass(frozen=True)
class PineAnalysis:
    constructs: list[PineConstruct]
    has_blocked: bool
    needs_manual_review: bool


def classify(source: str) -> PineAnalysis:
    constructs: list[PineConstruct] = []
    has_blocked = False
    needs_manual_review = False
    for number, raw in enumerate(source.splitlines(), start=1):
        line = raw.strip()
        if not line or line.startswith("//"):
            continue
        match = next(((token, message) for token, message in BLOCKED_TOKENS.items() if token in line), None)
        if match:
            token, message = match
            constructs.append(PineConstruct(line=number, source=token, status="BLOCKED", message=message))
            has_blocked = True
            continue
        if line.startswith("indicator(") or line.startswith("strategy("):
            constructs.append(PineConstruct(line=number, source=line.split("(", 1)[0], status="SUPPORTED", message="declaration is translated into a Python decorator"))
            continue
        if line.startswith("input.") or "= input." in line:
            constructs.append(PineConstruct(line=number, source="input.*", status="TRANSFORMED", message="input is translated to an inputs.* parameter declaration"))
            continue
        if re.match(r"^[A-Za-z_][A-Za-z0-9_]*\s*=", line):
            constructs.append(PineConstruct(line=number, source="assignment", status="MANUAL_REVIEW", message="assignment requires review for Pine series semantics before translation"))
            needs_manual_review = True
            continue
        supported = next(((token, message) for token, message in SUPPORTED_TA.items() if token in line), None)
        if supported:
            token, message = supported
            constructs.append(PineConstruct(line=number, source=token, status="TRANSFORMED", message=message))
            continue
        if "strategy.entry" in line or "strategy.close" in line:
            constructs.append(PineConstruct(line=number, source="strategy action", status="TRANSFORMED", message="action is mapped to a Python Context intent and Rust next-bar execution"))
            continue
        if line.startswith("if "):
            constructs.append(PineConstruct(line=number, source="if", status="MANUAL_REVIEW", message="conditional indentation and series semantics require review"))
            needs_manual_review = True
            continue
        constructs.append(PineConstruct(line=number, source=line[:80], status="MANUAL_REVIEW", message="construct is not in the initial automatic conversion subset"))
        needs_manual_review = True
    return PineAnalysis(constructs=constructs, has_blocked=has_blocked, needs_manual_review=needs_manual_review)


def convert(request: ConvertPineRequest) -> ConvertPineResponse:
    analysis = classify(request.source)
    source_hash = content_hash(request.source)
    diagnostics: list[ResearchDiagnostic] = []
    if analysis.has_blocked:
        diagnostics.append(ResearchDiagnostic(
            code="PINE_CONVERSION_BLOCKED",
            level=DiagnosticLevel.ERROR,
            message="one or more Pine constructs are incompatible with the safe deterministic conversion subset",
        ))
        return ConvertPineResponse(
            status="BLOCKED",
            source_hash=source_hash,
            converter_version=CONVERTER_VERSION,
            constructs=analysis.constructs,
            diagnostics=diagnostics,
        )
    generated = _template(request.target_kind, request.source)
    generated_hash = content_hash(generated)
    if analysis.needs_manual_review:
        diagnostics.append(ResearchDiagnostic(
            code="PINE_MANUAL_REVIEW_REQUIRED",
            level=DiagnosticLevel.WARNING,
            message="generated Python is a review draft; manual series-semantics approval is required before validation or execution",
        ))
    return ConvertPineResponse(
        status="MANUAL_REVIEW_REQUIRED" if analysis.needs_manual_review else "READY_FOR_REVIEW",
        source_hash=source_hash,
        converter_version=CONVERTER_VERSION,
        constructs=analysis.constructs,
        generated_python=generated,
        generated_python_hash=generated_hash,
        diagnostics=diagnostics,
    )


def _template(kind: ArtifactKind, source: str) -> str:
    decorator = "indicator" if kind == ArtifactKind.INDICATOR else "strategy"
    function_name = "converted_indicator" if kind == ArtifactKind.INDICATOR else "converted_strategy"
    body = "return {\"series\": []}" if kind == ArtifactKind.INDICATOR else "return None"
    pine_comments = "\n".join(f"# PINE {line}" for line in source.splitlines() if line.strip())
    return (
        "from zterminal_research import indicator, strategy, inputs, ta\n\n"
        f"@{decorator}(name=\"Converted Pine draft\")\n"
        f"def {function_name}(ctx):\n"
        "    # REVIEW REQUIRED: preserve Pine series semantics and confirm the conversion report.\n"
        f"    {body}\n\n"
        "# Original user-provided Pine source retained for review only:\n"
        f"{pine_comments}\n"
    )
