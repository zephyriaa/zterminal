"""TEST ONLY: real native adapter saves/restores source without executing it."""
import hashlib
import contextlib
import json
import pathlib
import sqlite3
import subprocess
import sys
import tempfile

exe = pathlib.Path(sys.argv[1]).resolve(strict=True)
evidence = pathlib.Path(sys.argv[2]).resolve()
evidence.mkdir(parents=True, exist_ok=True)
checks = []

with tempfile.TemporaryDirectory(prefix="zt-strat-") as directory:
    root = pathlib.Path(directory)
    store = root / "store"

    def call(command, **args):
        request, response = root / "request.json", root / "response.json"
        request.write_text(json.dumps(dict(command=command, **args)), encoding="utf-8")
        subprocess.run([exe, store, request, response], check=True, timeout=40)
        return json.loads(response.read_text(encoding="utf-8"))

    def ok(command, **args):
        response = call(command, **args)
        assert response["ok"], response
        return response["value"]

    ok("create", id="research", name="TEST ONLY")
    csv = root / "TEST ONLY.csv"
    csv.write_text("t,o,h,l,c,v\n60000,100,102,99,101,0\n120000,101,103,100,102,3\n180000,102,104,101,103,4", encoding="utf-8")
    ok("import", id="research", revision="1", path=str(csv), symbol="TEST ONLY",
       priceStep="0.25", quantityStep="1", intervalMs="60000")
    before = ok("save", id="research", revision="2", name="TEST ONLY saved",
                **{"from": "90000", "to": "180000"})
    scene = ok("scene", id="research", revision="3")
    source_file = root / "TEST ONLY.py"
    marker = root / "must-not-execute.txt"
    source = (f"# TEST ONLY — preserve CRLF and Unicode\r\n"
              f"from pathlib import Path\r\nPath({str(marker)!r}).write_text('executed')\r\n"
              "raise RuntimeError('must never execute')\r\n").encode("utf-8")
    source_file.write_bytes(source)
    saved = ok("save_strategy", id="research", revision="3", sourcePath=str(source_file),
               parameters={"period": 20, "enabled": True, "label": "α"})
    assert saved["chart"] == before["chart"] and saved["dataset"] == before["dataset"]
    assert saved["document"]["revision"] == 4
    strategy = saved["strategy"]
    assert strategy["source"].encode("utf-8") == source
    assert strategy["document"]["source"] == dict(sha256=hashlib.sha256(source).hexdigest(), bytes=len(source))
    assert strategy["document"]["revision"] == 1
    assert len(saved["document"]["documents"]) == 2
    assert not marker.exists()
    assert not call("save_strategy", id="research", revision="3", sourcePath=str(source_file), parameters={})["ok"]
    assert not call("save_strategy", id="research", revision="4", sourcePath=str(source_file), parameters={"nested": []})["ok"]
    rejected = root / "TEST ONLY rejected.py"
    for invalid_bytes in [b"x" * 256_001, b"\xff", b"   ", b"x\0"]:
        rejected.write_bytes(invalid_bytes)
        assert not call("save_strategy", id="research", revision="4", sourcePath=str(rejected), parameters={})["ok"]
    assert not call("save_strategy", id="research", revision="4", sourcePath=str(source_file), parameters={"oversize":"x" * 16_384})["ok"]
    rejected.unlink()
    assert ok("restore") == saved
    changed = ok("save_strategy", id="research", revision="4", sourcePath=str(source_file),
                 parameters={"period": 21, "enabled": True, "label": "α"})
    assert changed["strategy"]["document"]["revision"] == 2
    assert changed["strategy"]["document"]["source"] == strategy["document"]["source"]
    assert changed["strategy"]["document"]["parameters"] != strategy["document"]["parameters"]
    assert ok("save_strategy", id="research", revision="5", sourcePath=str(source_file),
              parameters=changed["strategy"]["parameters"]) == changed
    checks += ["workspace-linked exact source and parameters", "chart/dataset/viewport preserved",
               "source captured without execution", "stale and malformed saves preserve commit",
               "parameter change creates revision", "unchanged save creates no revision"]
    # Delete only these test-created files inside the isolated temporary directory.
    source_file.unlink()
    csv.unlink()
    restored = ok("restore")
    assert restored == changed
    assert ok("scene", id="research", revision="5")["bars"] == scene["bars"]
    assert ok("save", id="research", revision="5", name="TEST ONLY renamed",
              **{"from": "90000", "to": "180000"})["strategy"] == changed["strategy"]
    checks += ["new process restores without original Python or CSV", "ordinary workspace save retains strategy"]
    # Retention and integrity are checked against the real database, not a mock.
    with contextlib.closing(sqlite3.connect(store / "workstation.sqlite3")) as conn:
        old_hash = strategy["document"]["parameters"]["sha256"]
        old_bytes = conn.execute("SELECT bytes FROM artifacts WHERE hash=?", (old_hash,)).fetchone()[0]
        assert json.loads(old_bytes) == strategy["parameters"]
        assert hashlib.sha256(old_bytes).hexdigest() == old_hash
        conn.execute("UPDATE artifacts SET bytes=X'00' WHERE hash=?",
                     (changed["strategy"]["document"]["source"]["sha256"],))
        conn.commit()
    assert not call("restore")["ok"]
    assert not call("scene", id="research", revision="6")["ok"]
    checks += ["previous parameter artifacts retained", "corrupt strategy source fails closed"]

result = dict(status="Pass", adapterSha256=hashlib.sha256(exe.read_bytes()).hexdigest(), checks=checks)
(evidence / "results.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
print(json.dumps(result, indent=2))
