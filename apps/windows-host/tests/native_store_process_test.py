"""TEST ONLY cross-process persistence, corruption and interrupted save checks."""
import json
import pathlib
import sqlite3
import subprocess
import sys
import tempfile

exe = pathlib.Path(sys.argv[1]).resolve(strict=True)
evidence = pathlib.Path(sys.argv[2]).resolve()
evidence.mkdir(parents=True, exist_ok=True)
results = []

with tempfile.TemporaryDirectory(prefix="TEST-ONLY-", dir=evidence) as directory:
    root = pathlib.Path(directory)
    store = root / "store"
    def call(command, **args):
        request, response = root / "request.json", root / "response.json"
        request.write_text(json.dumps(dict(command=command, **args)), encoding="utf-8")
        subprocess.run([exe, store, request, response], check=True, timeout=40)
        return json.loads(response.read_text(encoding="utf-8"))
    assert call("create", id="test-only", name="TEST ONLY")["ok"]
    source = root / "TEST ONLY.csv"
    source.write_text("t,o,h,l,c,v\n60000,100,102,99,101,0\n120000,101,103,100,102,3\n180000,102,104,101,103,4", encoding="utf-8")
    w = call("import", id="test-only", revision="1", path=str(source), symbol="TEST ONLY", priceStep="0.25", quantityStep="1", intervalMs="60000")
    assert w["ok"], w
    scene = call("scene", id="test-only", revision="2")["value"]
    assert len(scene["bars"]) == 3 and scene["bars"][0]["volume"] == "0"
    assert len(call("scene", id="test-only", revision="2", cutoffNs="120000000000")["value"]["bars"]) == 1
    assert not call("scene", id="test-only", revision="1")["ok"]
    assert call("save", id="test-only", revision="2", name="TEST ONLY saved", **{"from":"90000", "to":"180000"})["ok"]
    source.unlink()  # Named isolated fixture; never a product file.
    restored = call("restore")["value"]
    assert restored["chart"]["visibleFromMs"] == 90000
    assert call("scene", id="test-only", revision="3")["value"]["bars"] == scene["bars"]
    assert not call("save", id="test-only", revision="2", name="conflicting")["ok"]
    assert call("restore")["value"] == restored
    results += ["separate-process restore", "retained source after deletion", "exact fractional viewport", "stale scene rejected", "completion cutoff", "save conflict leaves commit"]
    # Hold the real SQLite write lock while an actual adapter process attempts a
    # save. Kill that process, then reopen in a new process and compare intent.
    conn = sqlite3.connect(store / "workstation.sqlite3")
    conn.execute("BEGIN IMMEDIATE")
    request, response = root / "interrupted.json", root / "interrupted-response.json"
    request.write_text(json.dumps(dict(command="save", id="test-only", revision="3", name="interrupted")))
    process = subprocess.Popen([exe, store, request, response])
    import time
    time.sleep(0.25)
    assert process.poll() is None
    process.kill(); process.wait(timeout=10)
    conn.rollback(); conn.close()
    assert not response.exists()
    assert call("restore")["value"] == restored
    results.append("terminated save has no success response or changed commit")
    conn = sqlite3.connect(store / "workstation.sqlite3")
    conn.execute("UPDATE artifacts SET bytes=X'00'")
    conn.commit(); conn.close()
    assert not call("restore")["ok"]
    assert not call("scene", id="test-only", revision="3")["ok"]
    results.append("corrupt references fail closed")

(evidence / "results.json").write_text(json.dumps(dict(status="Pass", checks=results), indent=2))
print(json.dumps(dict(status="Pass", checks=results), indent=2))
