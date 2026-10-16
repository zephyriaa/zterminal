"""Run explicitly against an extracted release, with isolated disposable research data."""
import http.client
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import time
import unittest


def verify_package(package):
    package = Path(package).resolve()
    python, script = package / "runtime/python.exe", package / "app/server.py"
    with tempfile.TemporaryDirectory(prefix="zt-package-") as folder:
        root = Path(folder)
        process = subprocess.Popen([str(python), "-B", str(script), "--launcher", "--data-dir", folder], stdin=subprocess.PIPE, stderr=subprocess.PIPE, creationflags=subprocess.CREATE_NO_WINDOW, cwd=folder)
        try:
            deadline = time.monotonic() + 60
            while not (root / "pairing.json").exists() and time.monotonic() < deadline and process.poll() is None:
                time.sleep(.1)
            assert process.poll() is None, process.stderr.read().decode()
            pair = json.loads((root / "pairing.json").read_text())
            before = (root / "pairing.json").read_bytes()
            competing = subprocess.run([str(python), "-B", str(script), "--launcher", "--data-dir", folder], input=b"", capture_output=True, creationflags=subprocess.CREATE_NO_WINDOW, timeout=60)
            assert competing.returncode != 0 and b"WinError 100" in competing.stderr, competing.stderr
            assert (root / "pairing.json").read_bytes() == before
            origin = "https://zterminal.dpdns.org"

            def request(method, path, body=None, token=None):
                connection = http.client.HTTPConnection("127.0.0.1", 47321, timeout=15)
                headers = {"Origin": origin, "Content-Type": "application/json"}
                if token:
                    headers["Authorization"] = "Bearer " + token
                connection.request(method, "/v1/" + path, json.dumps(body) if body is not None else None, headers)
                response = connection.getresponse()
                result = response.status, json.loads(response.read())
                connection.close()
                return result

            assert request("GET", "capabilities")[1]["version"] == "1.0.0-preview.4"
            assert request("POST", "pair", {"code": "wrong"})[0] == 403
            status, paired = request("POST", "pair", {"code": pair["code"]})
            assert status == 200
            token = paired["token"]
            assert request("POST", "pair", {"code": pair["code"]})[0] == 403
            saved = request("POST", "scripts", {"name": "Package archive preservation", "source": "# preserved"}, token)[1]
            process.stdin.write(b"new-code\n"); process.stdin.flush()
            deadline = time.monotonic() + 15
            while time.monotonic() < deadline:
                current = json.loads((root / "pairing.json").read_text())
                if not current["consumed"] and current["code"] != pair["code"]:
                    break
                time.sleep(.05)
            assert current["pid"] == pair["pid"] and not current["consumed"], {"consumed": current["consumed"], "exit": process.poll()}
            assert request("GET", "scripts", token=token)[1][0]["id"] == saved["id"]
            # Inputs come from the existing fixture; execution resolves only packaged app/runtime paths.
            from test_engine import fixture
            for source, operation in [(None, "analysis"), ("import zterminal as zt\ndef calculate(data, params):\n    return {'ema': zt.ema(data.close, 2)}", "indicator")]:
                body = fixture() if source is None else fixture(source)
                body["operation"] = operation
                if operation == "indicator":
                    artifact = request("POST", "artifacts", {"kind": "indicator", "name": "EMA", "source": source}, token)[1]
                    body.update(artifact={key: artifact[key] for key in ["id", "kind", "revision", "name"]}, outputs={"ema": {"plot": "line"}})
                # Analysis uses the existing jobs route with no explicit operation.
                if operation == "analysis":
                    body.pop("operation")
                status, job = request("POST", "jobs", body, token)
                assert status == 202, job
                deadline = time.monotonic() + 190
                while time.monotonic() < deadline:
                    result = request("GET", "jobs/" + job["id"], token=token)[1]
                    if result["stage"] in ["complete", "failed", "cancelled"]:
                        break
                    time.sleep(.1)
                assert result["stage"] == "complete", result
            process.stdin.close()  # Simulate losing the launcher, including a launcher crash.
            assert process.wait(timeout=15) == 0
            from archive import Archive
            assert Archive(root / "research.sqlite3").scripts()[0]["id"] == saved["id"]
            print("Packaged production-origin pairing, conflict, rotation, strategy, indicator, archive and pipe-loss cleanup: PASS")
        finally:
            if process.poll() is None:
                process.kill(); process.wait(timeout=10)


if __name__ == "__main__":
    verify_package(sys.argv[1])
