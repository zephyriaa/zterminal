"""Execute a validation plan. User source never runs in this orchestrator.

Every variant uses fresh CPython under the controller's inherited Windows Job.
The job is resource bounded, not sandboxed from the user's files or network.
"""
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile

from archive import Archive, encode
from validation_engine import normalize_config, static_plan, windows, parameter_candidates, request_for, select_training, verify_evidence


def execute(request, stage=lambda _value: None):
    parent = request["result"]
    Archive.validate_result(parent)
    cfg = normalize_config(request.get("config", {}), parent)
    evidence = {}
    stage("running_strategy")

    def run(key, req):
        with tempfile.TemporaryDirectory(prefix="variant-", dir=Path.cwd()) as directory:
            folder = Path(directory)
            (folder / "request.json").write_text(encode(req), encoding="utf-8")
            env = dict(os.environ, TEMP=directory, TMP=directory)
            # The fresh child inherits the outer Job Object and its kill-on-close.
            process = subprocess.Popen([sys.executable, str(Path(__file__).with_name("child.py")), directory], stdin=subprocess.PIPE,
                                       stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, cwd=directory, env=env,
                                       creationflags=subprocess.CREATE_NO_WINDOW)
            try:
                _stdout, stderr = process.communicate(b"run\n", timeout=120)
            except subprocess.TimeoutExpired:
                process.kill()
                process.communicate()
                raise TimeoutError(f"Validation variant {key} exceeded 120 seconds")
            output = folder / "result.json"
            if process.returncode != 0 or not output.exists():
                status_path = folder / "status.json"
                status = json.loads(status_path.read_text(encoding="utf-8")) if status_path.exists() else {}
                message = status.get("diagnostic", {}).get("message") or stderr.decode("utf-8", errors="replace")[:4096] or "Process stopped without a result"
                raise ValueError(f"Validation variant {key} failed: {message}")
            if output.stat().st_size > 128_000_000:
                raise ValueError("Validation variant exceeds the 128 MB limit")
            result = json.loads(output.read_text(encoding="utf-8"))
            Archive.validate_result(result)
            if any(result[k] != req[k] for k in req):
                raise ValueError(f"Validation variant {key} changed captured inputs")
            evidence[key] = result
            return result

    for key, req in static_plan(parent, cfg):
        run(key, req)
    for cycle, (a, b, c, d) in enumerate(windows(len(parent["dataset"]["bars"]), cfg)):
        candidates = parameter_candidates(parent, cfg) if cfg["walkForward"]["optimize"] else [parent["params"]]
        training = [run(f"wf:{cycle}:train:{i}", request_for(parent, a, b, params)) for i, params in enumerate(candidates)]
        selected = select_training(training)
        run(f"wf:{cycle}:test", request_for(parent, c, d, candidates[selected]))
    verify_evidence(parent, cfg, evidence, Archive.validate_result)
    # The parent controller independently computes all metrics and diagnostics.
    stage("calculating_report")
    return {"evidence": evidence}
