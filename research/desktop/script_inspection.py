"""Non-executing Python inspection for the research workbench."""
import ast
import math


def inspect_script(source, supplied=None):
    if not isinstance(source, str) or not 0 < len(source.encode()) <= 256_000:
        raise ValueError("Supply Python source up to 256 KB")
    tree = ast.parse(source, filename="strategy.py")
    parameters, values, warnings, diagnostics = {}, {}, [], []
    supplied = supplied or {}

    def scalar(value):
        return type(value) in (str, bool, int, float) and (not isinstance(value, (int, float)) or math.isfinite(value))

    def declare(key, value=None, minimum=None, maximum=None, kind=None):
        if not isinstance(key, str) or not 0 < len(key) <= 80 or len(parameters) >= 50 and key not in parameters:
            raise ValueError("Use at most 50 parameter names, each 1–80 characters")
        if value is not None and not scalar(value):
            raise ValueError(f"Parameter {key} must be a finite number, boolean or string")
        parameters[key] = {"kind": kind or {bool: "boolean", int: "integer", float: "number", str: "string"}.get(type(value), "number"),
                           "default": value, "minimum": minimum, "maximum": maximum, "required": value is None}
        if key in supplied or value is not None:
            values[key] = supplied.get(key, value)

    for statement in tree.body:
        if not isinstance(statement, (ast.Assign, ast.AnnAssign)):
            continue
        targets = statement.targets if isinstance(statement, ast.Assign) else [statement.target]
        names = [n.id for n in targets if isinstance(n, ast.Name)]
        if "CONFIG" in names:
            try:
                config = ast.literal_eval(statement.value)
            except (ValueError, TypeError):
                raise SyntaxError("CONFIG must be a dictionary of literal defaults", ("strategy.py", statement.lineno, statement.col_offset + 1, ""))
            if not isinstance(config, dict):
                raise ValueError("CONFIG must be a dictionary")
            for key, value in config.items():
                declare(key, value)
        if "PARAMETERS" in names and isinstance(statement.value, ast.Dict):
            for key, call in zip(statement.value.keys, statement.value.values):
                if not isinstance(key, ast.Constant) or not isinstance(call, ast.Call) or not isinstance(call.func, ast.Attribute) or not call.args:
                    continue
                if call.func.attr in ("integer", "number", "boolean", "string"):
                    try:
                        limits = {k.arg: ast.literal_eval(k.value) for k in call.keywords}
                        declare(key.value, ast.literal_eval(call.args[0]), limits.get("min"), limits.get("max"), call.func.attr)
                    except (ValueError, TypeError):
                        warnings.append(f"Line {call.lineno}: dynamic input declaration needs runtime validation")

    def is_params(node):
        return isinstance(node, ast.Name) and node.id in ("params", "CONFIG")

    # Discover defaults before resolving lookbacks, regardless of source walk order.
    for node in ast.walk(tree):
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) and is_params(node.func.value) and node.func.attr == "get" and node.args:
            try:
                key = ast.literal_eval(node.args[0])
                default = ast.literal_eval(node.args[1]) if len(node.args) > 1 else None
                if key not in parameters:
                    declare(key, default)
            except (ValueError, TypeError):
                warnings.append(f"Line {node.lineno}: dynamic parameter name cannot generate a control")
        if isinstance(node, ast.Subscript) and is_params(node.value):
            try:
                key = ast.literal_eval(node.slice)
                if key not in parameters:
                    declare(key)
            except (ValueError, TypeError):
                warnings.append(f"Line {node.lineno}: dynamic parameter name cannot generate a control")

    for key, spec in parameters.items():
        if key not in values:
            continue
        value = values[key]
        valid = {"integer": type(value) is int, "number": type(value) in (int, float), "boolean": type(value) is bool, "string": type(value) is str}[spec["kind"]]
        if not valid or not scalar(value) or spec["minimum"] is not None and value < spec["minimum"] or spec["maximum"] is not None and value > spec["maximum"]:
            raise ValueError(f"Invalid parameter {key}: value or declared constraints")

    locals_ = {}

    def number(node, depth=0):
        if depth > 15:
            return None
        if isinstance(node, ast.Constant) and type(node.value) in (int, float):
            return node.value
        if isinstance(node, ast.Name):
            return number(locals_[node.id], depth + 1) if node.id in locals_ else None
        if isinstance(node, ast.UnaryOp) and isinstance(node.op, (ast.USub, ast.UAdd)):
            v = number(node.operand, depth + 1)
            return None if v is None else -v if isinstance(node.op, ast.USub) else v
        if isinstance(node, ast.Subscript) and is_params(node.value) and isinstance(node.slice, ast.Constant):
            return values.get(node.slice.value)
        if isinstance(node, ast.Call):
            if isinstance(node.func, ast.Name) and node.func.id in ("int", "float") and node.args:
                return number(node.args[0], depth + 1)
            if isinstance(node.func, ast.Attribute) and is_params(node.func.value) and node.func.attr == "get" and node.args and isinstance(node.args[0], ast.Constant):
                return values.get(node.args[0].value)
        if isinstance(node, ast.BinOp) and isinstance(node.op, (ast.Add, ast.Sub, ast.Mult, ast.Div)):
            a, b = number(node.left, depth + 1), number(node.right, depth + 1)
            if type(a) not in (int, float) or type(b) not in (int, float):
                return None
            if isinstance(node.op, ast.Add): return a + b
            if isinstance(node.op, ast.Sub): return a - b
            if isinstance(node.op, ast.Mult): return a * b
            return a / b if b else None
        return None

    for node in ast.walk(tree):
        if isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name): locals_[target.id] = node.value
        elif isinstance(node, ast.AnnAssign) and isinstance(node.target, ast.Name):
            locals_[node.target.id] = node.value

    lookbacks = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Subscript) and isinstance(node.value, ast.Attribute) and node.value.attr in ("iloc", "iat") and isinstance(node.slice, ast.BinOp) and isinstance(node.slice.left, ast.Name):
            offset = number(node.slice.right)
            if type(offset) in (int, float) and (isinstance(node.slice.op, ast.Add) and offset > 0 or isinstance(node.slice.op, ast.Sub) and offset < 0):
                diagnostics.append({"message": "Future row indexing: a loop may only read the current or earlier bar", "line": node.lineno, "column": node.col_offset+1})
        if not isinstance(node, ast.Call) or not isinstance(node.func, ast.Attribute):
            continue
        name, kwargs = node.func.attr.lower(), {k.arg: k.value for k in node.keywords}
        def argument(key, position=0):
            return kwargs.get(key, node.args[position] if len(node.args) > position else None)
        message = None
        if name in ("shift", "diff", "pct_change"):
            period = number(argument("periods"))
            if type(period) in (int, float) and period < 0: message = "Future data reference: use a nonnegative lag instead of a negative shift"
        if name in ("bfill", "backfill") or name == "fillna" and isinstance(kwargs.get("method"), ast.Constant) and kwargs["method"].value in ("bfill", "backfill"):
            message = "Backward fill uses future observations; use a causal fill or leave warm-up values missing"
        if name == "rolling" and isinstance(kwargs.get("center"), ast.Constant) and kwargs["center"].value is True:
            message = "Centered windows include future bars; use a trailing window"
        if message: diagnostics.append({"message": message, "line": node.lineno, "column": node.col_offset + 1})
        period, bars = None, None
        if name in ("sma", "ema", "rsi", "atr"):
            period = number(argument("period", 1 if name != "atr" else 3))
            if period is None: period = 20 if name in ("sma", "ema") and len(node.args) < 2 else 14 if name in ("rsi", "atr") and len(node.args) < 2 else None
            if type(period) in (int, float) and period >= 1:
                alpha = 2 / (period + 1) if name == "ema" else 1 / period
                bars = int(period) if name == "sma" else 1 if alpha >= 1 else math.ceil(math.log(1e-6) / math.log1p(-alpha)) + 1
        elif name == "rolling":
            period = number(argument("window"))
            if type(period) in (int, float) and period >= 1: bars = int(period)
        elif name == "ewm":
            alpha = number(kwargs.get("alpha"))
            span, com = number(kwargs.get("span")), number(kwargs.get("com", node.args[0] if node.args else None))
            if alpha is None and type(span) in (int, float) and span >= 1: alpha = 2 / (span + 1)
            if alpha is None and type(com) in (int, float) and com >= 0: alpha = 1 / (com + 1)
            if type(alpha) in (int, float) and 0 < alpha <= 1: bars = 1 if alpha == 1 else math.ceil(math.log(1e-6) / math.log1p(-alpha)) + 1
        if name in ("sma", "ema", "rsi", "atr", "rolling", "ewm"):
            if bars is None: warnings.append(f"Line {node.lineno}: unresolved {name} lookback; specify manual warm-up")
            else: lookbacks.append({"line": node.lineno, "indicator": name, "lookback": period, "warmupBars": bars})
    # Sum lookbacks conservatively: chained or dependent indicators need more than max(period).
    warmup = sum(x["warmupBars"] for x in lookbacks)
    if warmup > 10000: raise ValueError("Detected warm-up exceeds 10,000 bars; simplify the indicator chain")
    return {"parameters": parameters, "resolvedParams": values, "warmupBars": warmup, "lookbacks": lookbacks,
            "diagnostics": diagnostics, "warnings": sorted(set(warnings)), "policy": "ast-v1; exponential seed residual <= 1e-6; conservative summed lookbacks"}


def check_source(source, supplied=None):
    inspected = inspect_script(source, supplied)
    if inspected["diagnostics"]:
        finding = inspected["diagnostics"][0]
        raise SyntaxError(finding["message"], ("strategy.py", finding["line"], finding["column"], source.splitlines()[finding["line"] - 1]))
    missing = [key for key, spec in inspected["parameters"].items() if spec["required"] and key not in inspected["resolvedParams"]]
    if missing: raise ValueError("Set required strategy parameters: " + ", ".join(missing))
    return inspected


def compile_strategy(source, supplied=None, guardrails=False):
    inspected = check_source(source, supplied) if guardrails else inspect_script(source, supplied)
    tree = ast.parse(source, filename="strategy.py")
    for statement in tree.body:
        targets = statement.targets if isinstance(statement, ast.Assign) else [statement.target] if isinstance(statement, ast.AnnAssign) else []
        if any(isinstance(t, ast.Name) and t.id == "CONFIG" for t in targets):
            original = ast.literal_eval(statement.value)
            updated = {key: inspected["resolvedParams"].get(key, value) for key, value in original.items()}
            statement.value = ast.copy_location(ast.parse(repr(updated), mode="eval").body, statement.value)
    return compile(ast.fix_missing_locations(tree), "strategy.py", "exec"), inspected
