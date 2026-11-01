"""Isolated first-open/restart/recovery checks against the actual packaged adapter."""
import hashlib
import json
from pathlib import Path
import sqlite3
import subprocess
import sys
import tempfile

exe = Path(sys.argv[1]).resolve(strict=True)
evidence = Path(sys.argv[2]).resolve()
evidence.mkdir(parents=True, exist_ok=True)
root = Path(tempfile.mkdtemp(prefix="TEST-ONLY-STARTUP-", dir=evidence))
store = root / "store"


def call(command, target=store, **fields):
    request, response = root / "request.json", root / "response.json"
    request.write_text(json.dumps(dict(command=command, **fields)), encoding="utf-8")
    subprocess.run([exe, target, request, response], check=True, timeout=40)
    value = json.loads(response.read_text(encoding="utf-8"))
    assert value["ok"], value
    return value["value"]


assert call("startup") == {"onboardingComplete": False}
workspace = call("create", id="retained", name="TEST ONLY retained workspace")
assert call("startup") == {"onboardingComplete": False}  # Existing work is not consent.
assert call("complete_onboarding") == {"onboardingComplete": True}
assert call("startup") == {"onboardingComplete": True}  # A new OS process each call.
assert call("open", id="retained") == workspace
assert call("startup", target=root / "other-profile") == {"onboardingComplete": False}
with sqlite3.connect(store / "workstation.sqlite3") as conn:
    conn.execute("UPDATE state SET value='{broken' WHERE key='onboarding'")
request, response = root / "request.json", root / "response.json"
request.write_text(json.dumps(dict(command="startup")), encoding="utf-8")
subprocess.run([exe, store, request, response], check=True, timeout=40)
assert not json.loads(response.read_text())["ok"]
assert call("complete_onboarding") == {"onboardingComplete": True}
assert call("open", id="retained") == workspace
with sqlite3.connect(store / "workstation.sqlite3") as conn:
    retained = conn.execute("SELECT value FROM state WHERE key LIKE 'onboarding-recovery:%'").fetchone()[0]
    assert retained == "{broken"
result = dict(status="PASS", checks=["first open", "existing work is not onboarding completion", "durable explicit completion", "new-process restart", "retained workspace unchanged", "storage-root separation", "corruption fails visibly", "explicit recovery preserves corrupt bytes and work"], adapter_sha256=hashlib.sha256(exe.read_bytes()).hexdigest())
(evidence / "results.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
print(json.dumps(result, indent=2))
