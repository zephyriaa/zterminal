from __future__ import annotations

import ast
import hashlib
from dataclasses import dataclass

from .models import DeclaredParameter, DiagnosticLevel, ResearchDiagnostic

ALLOWED_IMPORTS = {"zterminal_research"}
BLOCKED_NAMES = {
    "__import__", "eval", "exec", "compile", "open", "input", "globals", "locals",
    "vars", "getattr", "setattr", "delattr", "breakpoint", "help", "memoryview",
}
BLOCKED_MODULES = {
    "asyncio", "ctypes", "http", "httpx", "importlib", "inspect", "io", "multiprocessing",
    "os", "pathlib", "pickle", "platform", "requests", "shutil", "socket", "subprocess",
    "sys", "tempfile", "threading", "urllib", "webbrowser",
}
ALLOWED_DECORATORS = {"indicator", "strategy"}


@dataclass(frozen=True)
class PolicyResult:
    diagnostics: list[ResearchDiagnostic]
    parameters: list[DeclaredParameter]

    @property
    def valid(self) -> bool:
        return not any(item.level == DiagnosticLevel.ERROR for item in self.diagnostics)


def content_hash(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def environment_hash(runtime_lock: str) -> str:
    return content_hash(f"research.v2.0|{runtime_lock}|policy.v1")


def validate_python_source(source: str) -> PolicyResult:
    diagnostics: list[ResearchDiagnostic] = []
    parameters: list[DeclaredParameter] = []
    try:
        tree = ast.parse(source, mode="exec")
    except SyntaxError as error:
        return PolicyResult([
            ResearchDiagnostic(
                code="PYTHON_SYNTAX_ERROR",
                level=DiagnosticLevel.ERROR,
                message=error.msg,
                line=error.lineno,
                column=error.offset,
            )
        ], [])

    declared_entrypoints = 0
    for node in ast.walk(tree):
        if isinstance(node, (ast.Import, ast.ImportFrom)):
            module_names = [alias.name.split(".")[0] for alias in node.names] if isinstance(node, ast.Import) else [(node.module or "").split(".")[0]]
            for module in module_names:
                if module in BLOCKED_MODULES or module not in ALLOWED_IMPORTS:
                    diagnostics.append(_error("UNSUPPORTED_IMPORT", f"import of '{module}' is not permitted", node))
        if isinstance(node, (ast.With, ast.AsyncWith, ast.TryStar, ast.AsyncFunctionDef, ast.ClassDef, ast.Lambda, ast.Global, ast.Nonlocal)):
            diagnostics.append(_error("UNSUPPORTED_LANGUAGE_FEATURE", f"{type(node).__name__} is not part of the Python research contract", node))
        if isinstance(node, ast.Attribute) and node.attr.startswith("__"):
            diagnostics.append(_error("DUNDER_ACCESS_BLOCKED", "dunder attribute access is not permitted", node))
        if isinstance(node, ast.Name) and node.id in BLOCKED_NAMES:
            diagnostics.append(_error("BLOCKED_API", f"'{node.id}' is not available in the research worker", node))
        if isinstance(node, ast.Call):
            callee = _callee_name(node.func)
            if callee in BLOCKED_NAMES:
                diagnostics.append(_error("BLOCKED_API", f"'{callee}' is not available in the research worker", node))
        if isinstance(node, ast.FunctionDef):
            decorator_names = {_callee_name(decorator.func if isinstance(decorator, ast.Call) else decorator) for decorator in node.decorator_list}
            matching = decorator_names & ALLOWED_DECORATORS
            if matching:
                declared_entrypoints += 1
                if len(matching) != 1:
                    diagnostics.append(_error("ENTRYPOINT_AMBIGUOUS", "an entrypoint may use exactly one research decorator", node))
                parameters.extend(_extract_parameters(node, diagnostics))

    if declared_entrypoints == 0:
        diagnostics.append(ResearchDiagnostic(
            code="ENTRYPOINT_REQUIRED",
            level=DiagnosticLevel.ERROR,
            message="define exactly one function decorated with @indicator or @strategy",
        ))
    elif declared_entrypoints > 1:
        diagnostics.append(ResearchDiagnostic(
            code="ENTRYPOINT_AMBIGUOUS",
            level=DiagnosticLevel.ERROR,
            message="an artifact may declare exactly one @indicator or @strategy entrypoint",
        ))

    return PolicyResult(diagnostics, parameters)


def _extract_parameters(node: ast.FunctionDef, diagnostics: list[ResearchDiagnostic]) -> list[DeclaredParameter]:
    result: list[DeclaredParameter] = []
    positional = node.args.args
    if not positional or positional[0].arg != "ctx":
        diagnostics.append(_error("CONTEXT_REQUIRED", "first entrypoint argument must be 'ctx'", node))
        return result
    defaults = list(node.args.defaults)
    optional = positional[len(positional) - len(defaults):]
    for arg, default in zip(optional, defaults):
        parameter = _parameter_from_default(arg.arg, default)
        if parameter is None:
            diagnostics.append(_error("PARAMETER_DEFAULT_REQUIRED", f"parameter '{arg.arg}' must use a literal or inputs.* default", arg))
            continue
        result.append(parameter)
    return result


def _parameter_from_default(name: str, node: ast.expr) -> DeclaredParameter | None:
    value = _literal(node)
    if value is not None:
        kind = _parameter_kind(value)
        return DeclaredParameter(name=name, kind=kind, default=value) if kind else None
    if not isinstance(node, ast.Call) or _callee_name(node.func) not in {"inputs.int", "inputs.float", "inputs.bool", "inputs.string"}:
        return None
    if not node.args:
        return None
    default = _literal(node.args[0])
    kind_name = _callee_name(node.func).split(".")[-1]
    expected = {"int": int, "float": float, "bool": bool, "string": str}[kind_name]
    if default is None or type(default) is not expected:
        return None
    named = {keyword.arg: _literal(keyword.value) for keyword in node.keywords if keyword.arg}
    minimum = named.get("min")
    maximum = named.get("max")
    if minimum is not None and not isinstance(minimum, (int, float)):
        return None
    if maximum is not None and not isinstance(maximum, (int, float)):
        return None
    return DeclaredParameter(name=name, kind={"string": "str"}.get(kind_name, kind_name), default=default, minimum=minimum, maximum=maximum)


def _literal(node: ast.expr) -> int | float | bool | str | None:
    if isinstance(node, ast.Constant) and isinstance(node.value, (int, float, bool, str)):
        return node.value
    return None


def _parameter_kind(value: object) -> str | None:
    if isinstance(value, bool):
        return "bool"
    if isinstance(value, int):
        return "int"
    if isinstance(value, float):
        return "float"
    if isinstance(value, str):
        return "str"
    return None


def _callee_name(node: ast.expr) -> str:
    if isinstance(node, ast.Name):
        return node.id
    if isinstance(node, ast.Attribute):
        parent = _callee_name(node.value)
        return f"{parent}.{node.attr}" if parent else node.attr
    return ""


def _error(code: str, message: str, node: ast.AST) -> ResearchDiagnostic:
    return ResearchDiagnostic(code=code, level=DiagnosticLevel.ERROR, message=message, line=getattr(node, "lineno", None), column=getattr(node, "col_offset", None))
