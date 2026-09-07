"""One job per process. Wait until the controller has attached OS resource limits."""
import json
import os
from pathlib import Path
import sys


def atomic(path, value):
    temporary = path.with_suffix(".tmp")
    temporary.write_text(json.dumps(value, allow_nan=False, ensure_ascii=False), encoding="utf-8")
    os.replace(temporary, path)


def main():
    if sys.stdin.readline().strip() != "run":
        return 2
    folder = Path(sys.argv[1])
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    try:
        import engine
        request = json.loads((folder / "request.json").read_text(encoding="utf-8"))
        if request.get("operation") == "monte_carlo":
            import analytics
            result = analytics.monte_carlo(request["result"], request["simulations"], request["seed"])
        else:
            result = engine.execute(request, lambda stage: atomic(folder / "status.json", {"stage": stage}))
        atomic(folder / "result.json", result)
        return 0
    except BaseException as error:
        # Syntax/name errors in strategy.py carry editor positions.
        import traceback
        details = {"message": f"{type(error).__name__}: {error}"}
        frames = [f for f in traceback.extract_tb(error.__traceback__) if f.filename == "strategy.py"]
        if isinstance(error, SyntaxError):
            details.update(line=error.lineno, column=error.offset)
        elif frames:
            details["line"] = frames[-1].lineno
        atomic(folder / "status.json", {"stage": "failed", "diagnostic": details})
        return 1


if __name__ == "__main__":
    sys.exit(main())
