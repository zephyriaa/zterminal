"""Real adapter checks with isolated, explicitly synthetic local catalog fixtures."""
import hashlib
import json
from pathlib import Path
import sqlite3
import subprocess
import sys
import time

exe = Path(sys.argv[1]).resolve(strict=True)
evidence = Path(sys.argv[2]).resolve()
evidence.mkdir(parents=True, exist_ok=True)
store = evidence / "TEST-ONLY-catalog-store"
request, response = evidence / "request.json", evidence / "response.json"


def call(command, expect=True, **fields):
    request.write_text(json.dumps(dict(command=command, **fields)), encoding="utf-8")
    subprocess.run([exe, store, request, response], check=True, timeout=40)
    result = json.loads(response.read_text(encoding="utf-8"))
    assert result["ok"] == expect, result
    return result.get("value")


assert not store.exists(), "Use a fresh evidence directory; never modify an existing profile"
original = call("create", id="seed", name="TEST ONLY seed")
call("complete_onboarding")
source = evidence / "TEST-ONLY-source.py"
source.write_bytes(b"# Exact non-executed source\r\nraise RuntimeError('test only')\r\n")
study = call("save_study", id="study", revision="0", name="TEST ONLY study", kind="indicator", sourcePath=str(source))
assert study["source"].encode() == source.read_bytes()
call("save_study", expect=False, id="study", revision="0", name="Stale", kind="indicator", sourcePath=str(source))
call("workspace_action", action="rename", id="seed", revision="1", name="TEST ONLY renamed")
call("workspace_action", expect=False, action="delete", id="seed", revision="1")
call("workspace_action", action="duplicate", id="seed", revision="2", newId="copy", name="TEST ONLY copy")
call("workspace_action", action="delete", id="copy", revision="1")
assert call("trash")[0]["key"] == "workspace:copy"
call("restore_catalog", key="workspace:copy")
assert call("open", id="copy")["document"]["name"] == "TEST ONLY copy"
call("close_tab", id="copy")
assert call("navigation")["tabs"] == ["seed"]
assert call("open", id="seed")["document"]["revision"] == 2
call("study_action", action="delete", id="study", revision="1")
call("restore_catalog", key="study:study")
assert call("study", id="study")["source"].encode() == source.read_bytes()

# Generate large valid catalog fixtures from the canonical saved document. These
# are catalog-scale fixtures, not claims that 1,000 datasets/runs were computed.
measurements = []
with sqlite3.connect(store / "workstation.sqlite3") as conn:
    payload = json.loads(conn.execute("SELECT payload FROM workspaces WHERE id='seed'").fetchone()[0])
    for count in (1, 100, 1000):
        # Keep the two operation-test records; scale counts are explicit below.
        existing = conn.execute("SELECT count(*) FROM workspaces").fetchone()[0]
        for index in range(existing, count):
            item = json.loads(json.dumps(payload))
            identity = f"fixture-{index:04}"
            item["document"]["id"] = identity
            item["document"]["name"] = f"TEST ONLY fixture {index:04}"
            data = json.dumps(item, separators=(",", ":")).encode()
            conn.execute("INSERT INTO workspaces VALUES(?,?,?,?,?)", (identity, item["document"]["name"], 2, data, hashlib.sha256(data).hexdigest()))
        conn.commit()
        start = time.perf_counter()
        page = call("catalog", kind="workspace", search="", recent=False, page="0")
        elapsed = (time.perf_counter() - start) * 1000
        assert len(page["items"]) <= 24
        measurements.append(dict(records=page["total"], adapter_page_ms=round(elapsed, 2), returned=len(page["items"])))
assert call("open", id="fixture-0999")["document"]["id"] == "fixture-0999"
assert call("catalog", kind="workspace", search="fixture 0999", recent=False, page="0")["total"] == 1
preview = call("catalog_previews", records=[dict(kind="workspace", id="seed", revision=1)])
assert preview[0]["preview"]["kind"] == "unavailable"
result = dict(status="PASS", adapter_sha256=hashlib.sha256(exe.read_bytes()).hexdigest(), checks=["independent processes", "exact source", "stale-write rejection", "rename", "duplicate identity", "soft delete and recovery", "tab ownership", "study recovery", "bounded catalog paging and search", "stale preview withheld"], measurements=measurements, scale_limit="Catalog metadata fixtures, not multi-chart/compute load")
(evidence / "results.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
print(json.dumps(result, indent=2))
