"""Browser-harness regression using real Rust persistence; only Tauri transport is replaced.

Prerequisites: npm run workstation:dev; cargo build --manifest-path
src-tauri/workstation-core/Cargo.toml --example bridge; connected browser-harness.
All test data is explicitly labelled and isolated in a temporary directory.
"""
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import time
import tempfile
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

REPO = Path(__file__).resolve().parents[1]
DRIVER = REPO / "src-tauri/workstation-core/target/debug/examples/bridge.exe"
HARNESS = shutil.which("browser-harness") or str(Path.home() / ".local/bin/browser-harness.exe")

def performance():
    """Measured smoke, not a claim about live feed or renderer performance."""
    with tempfile.TemporaryDirectory(prefix="zt-workstation-perf-") as folder:
        def call(command, args):
            start=time.perf_counter()
            response=json.loads(subprocess.run([str(DRIVER),folder],input=json.dumps({"command":command,"args":args}),text=True,capture_output=True,check=True).stdout)
            assert response["ok"],response
            return response["value"],round((time.perf_counter()-start)*1000,2)
        w,create_ms=call("create_workspace",{"id":"test-perf","name":"TEST ONLY performance"})
        csv="t,o,h,l,c,v\n"+"\n".join(f"{60000*(i+1)},10,12,9,11,2" for i in range(10_000))
        w,import_ms=call("import_history",{"id":"test-perf","revision":1,"input":{"csv":csv,"sourceName":"TEST ONLY performance.csv","symbol":"TEST ONLY","intervalMs":60_000,"tickSize":.01,"quantityStep":.000001}})
        _,scene_ms=call("load_scene",{"id":"test-perf","first":4000,"count":2000})
        w,save_ms=call("save_workspace",{"id":"test-perf","revision":w["document"]["revision"],"name":"TEST ONLY performance","from":240060000,"to":300060000})
        restored,restore_ms=call("restore_workspace",{})
        assert restored==w
        print(json.dumps({"fixture_only":True,"profile":"debug","rows":10_000,"scene_bars":2000,"each_call_new_process":True,"create_ms":create_ms,"import_ms":import_ms,"scene_ms":scene_ms,"save_ms":save_ms,"restore_ms":restore_ms},indent=2))


def main():
    native = "--native" in sys.argv
    native_process = None
    harness_env = os.environ.copy()
    if native:
        import sqlite3
        validation_id = "com.zterminal.workstation.validation.m1" if "--shell" in sys.argv else "com.zterminal.workstation.validation"
        validation_root = Path(os.environ["LOCALAPPDATA"]) / validation_id
        # Only the explicitly separate validation identifier may be reset; never touch product storage.
        actual_parent = validation_root.resolve().parent
        local_root = Path(os.environ["LOCALAPPDATA"]).resolve()
        if actual_parent != local_root:
            # Packaged Codex virtualizes LocalAppData into its own LocalCache.
            parts = actual_parent.relative_to(local_root).parts
            assert len(parts)==4 and parts[0]=="Packages" and parts[1].startswith("OpenAI.Codex_") and parts[2:]==("LocalCache","Local")
        assert validation_root.name in ("com.zterminal.workstation.validation", "com.zterminal.workstation.validation.m1")
        if (validation_root / "workstation.sqlite3").exists():
            with sqlite3.connect(validation_root / "workstation.sqlite3") as db:
                names=[r[0] for r in db.execute("SELECT name FROM workspaces")]
                assert all(n.startswith("TEST ONLY") for n in names), "Non-test workspace in validation storage; refusing reset"
                db.executescript("DELETE FROM state; DELETE FROM workspaces; DELETE FROM artifacts;")
        harness_env.update(BU_NAME=f"zt-validation-{os.getpid()}", BU_CDP_URL="http://127.0.0.1:9225")
        launch_env = os.environ.copy()
        launch_env["WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS"] = "--remote-debugging-port=9225"
        native_process = subprocess.Popen([str(REPO / "src-tauri/target/release/zterminal-desktop.exe")], env=launch_env)
    with tempfile.TemporaryDirectory(prefix="zt-workstation-test-") as folder:
        root = Path(folder)

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *_):
                pass

            def do_OPTIONS(self):
                self.send_response(204)
                self.send_header("Access-Control-Allow-Origin", "http://127.0.0.1:1420")
                self.send_header("Access-Control-Allow-Headers", "Content-Type")
                self.end_headers()

            def do_POST(self):
                if self.headers.get("Origin") != "http://127.0.0.1:1420":
                    self.send_error(403)
                    return
                length = int(self.headers.get("Content-Length", 0))
                if not 0 < length < 9 * 1024 * 1024:
                    self.send_error(413)
                    return
                # Every request runs a new OS process against the same real disk store.
                response = subprocess.run([str(DRIVER), str(root / "store")], input=self.rfile.read(length), capture_output=True, check=True).stdout
                self.send_response(200)
                self.send_header("Access-Control-Allow-Origin", "http://127.0.0.1:1420")
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(response)))
                self.end_headers()
                self.wfile.write(response)

        server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        threading.Thread(target=server.serve_forever, daemon=True).start()
        valid = root / "TEST-ONLY.csv"
        valid.write_text("t,o,h,l,c,v\n" + "\n".join(f"{60000*(i+1)},10,12,9,11,2" for i in range(200)), encoding="utf-8")
        invalid = root / "TEST-ONLY-invalid.csv"
        invalid.write_text("t,o,h,l,c,v\n60000,10,8,9,11,2", encoding="utf-8")
        script = r'''
import json, time
native=NATIVE_MODE
url='http://tauri.localhost/' if native else 'http://127.0.0.1:1420'
tabs=[t for t in list_tabs() if t.get('url','').startswith(url)]
if tabs: switch_tab(tabs[0]['targetId'])
elif native: raise AssertionError('Bundled workstation page missing')
else: new_tab(url)
# Background Brave tabs on this machine ignored compositor input; activate only this test tab.
activate_tab(current_tab())
bootstrap = "window.__testErrors=[]; addEventListener('error',e=>__testErrors.push(e.message)); window.__TAURI_INTERNALS__ = { invoke: async (command,args={}) => { const r = await fetch('BRIDGE_URL', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({command,args})}); const result=await r.json(); if(!result.ok) throw new Error(result.error); return result.value; }};"
if not native:
    cdp("Page.addScriptToEvaluateOnNewDocument", source=bootstrap)
    cdp("Page.reload")
else:
    cdp('Network.enable')
    cdp('Network.emulateNetworkConditions',offline=True,latency=0,downloadThroughput=0,uploadThroughput=0)
    network_spy = "window.__chartNetworkAttempts=[]; const originalFetch=window.fetch; window.fetch=(...args)=>{if(/api\\/market|socket.io|:3003/.test(String(args[0]))) window.__chartNetworkAttempts.push(String(args[0])); return originalFetch(...args)}; const OriginalWebSocket=window.WebSocket; window.WebSocket=new Proxy(OriginalWebSocket,{construct(target,args){window.__chartNetworkAttempts.push(String(args[0]));return Reflect.construct(target,args)}});"
    cdp('Page.addScriptToEvaluateOnNewDocument',source=network_spy)
    js(network_spy)

def wait_for(expression):
    deadline=time.monotonic()+15
    while time.monotonic()<deadline:
        if js(expression): return
        time.sleep(.1)
    raise AssertionError(expression + "\n" + str(js("document.body.innerText")) + "\n" + str(js("JSON.stringify(window.__testErrors)")))

def click(name, role="button"):
    nodes=cdp("Accessibility.getFullAXTree")["nodes"]
    nodes=[n for n in nodes if n.get("role",{}).get("value")==role and n.get("name",{}).get("value")==name and "backendDOMNodeId" in n]
    assert len(nodes)==1, (name, len(nodes))
    box=cdp("DOM.getBoxModel",backendNodeId=nodes[0]["backendDOMNodeId"])["model"]["content"]
    click_at_xy(sum(box[0::2])/4,sum(box[1::2])/4)

def enter(name,value):
    click(name,"textbox")
    cdp("Input.dispatchKeyEvent",type="keyDown",key="a",code="KeyA",modifiers=2,windowsVirtualKeyCode=65)
    cdp("Input.dispatchKeyEvent",type="keyUp",key="a",code="KeyA",modifiers=2,windowsVirtualKeyCode=65)
    cdp("Input.insertText",text=value)

def file(path):
    doc=cdp("DOM.getDocument")
    node=cdp("DOM.querySelector",nodeId=doc["root"]["nodeId"],selector='input[type="file"]')["nodeId"]
    assert node
    cdp("DOM.setFileInputFiles",nodeId=node,files=[path])

wait_for("document.body.innerText.includes('No saved workspaces yet.') && document.querySelector('footer')?.innerText==='Local storage ready'")
assert not js("document.body.innerText.includes('Synced')")
click("New workspace")
wait_for("document.body.innerText.includes('No historical data available')")
enter("Workspace name","TEST ONLY saved chart")
click("Save workspace")
wait_for("document.querySelector('footer')?.innerText==='Saved to this device'")
click("Import local history","DisclosureTriangle")
enter("Import symbol","TEST ONLY")
file(VALID_FILE)
wait_for("document.body.innerText.includes('200 bars') && document.querySelectorAll('canvas').length>0")
assert js("document.body.innerText.includes('exchange origin and live freshness are unverified')")
# Real compositor wheel interaction, then save its semantic viewport.
rect=js("JSON.stringify(document.querySelector('.local-chart').getBoundingClientRect().toJSON())")
rect=json.loads(rect)
cdp("Input.dispatchMouseEvent",type="mouseWheel",x=rect['x']+rect['width']/2,y=rect['y']+rect['height']/2,deltaX=0,deltaY=-400)
wait_for("document.body.innerText.includes('Unsaved changes')")
# Native pointer pan and crosshair movement on the rendered canvas.
x=rect['x']+rect['width']/2; y=rect['y']+rect['height']/2
cdp('Input.dispatchMouseEvent',type='mouseMoved',x=x,y=y)
cdp('Input.dispatchMouseEvent',type='mousePressed',x=x,y=y,button='left',buttons=1,clickCount=1)
cdp('Input.dispatchMouseEvent',type='mouseMoved',x=x+40,y=y,button='left',buttons=1)
cdp('Input.dispatchMouseEvent',type='mouseReleased',x=x+40,y=y,button='left',buttons=0,clickCount=1)
click("Save workspace")
wait_for("document.querySelector('footer')?.innerText==='Saved to this device'")
file(INVALID_FILE)
wait_for("document.querySelector('[role=alert]')!==null")
assert js("document.body.innerText.includes('200 bars')")
cdp("Page.reload")
wait_for("document.querySelector('footer')?.innerText==='Local storage ready' && document.body.innerText.includes('200 bars')")
assert js("document.querySelector('[aria-label=\"Workspace name\"]').value==='TEST ONLY saved chart'")
capture_screenshot(SCREENSHOT_FILE)
print("PASS: fresh startup, create, save, strict import, wheel zoom, pointer pan/crosshair, save, invalid import and reload")
'''
        if "--shell" in sys.argv:
            shell_evidence = REPO / "docs/windows/v2/evidence/m1-shell"
            shell_evidence.mkdir(parents=True, exist_ok=True)
            script = script.replace('click("New workspace")', 'capture_screenshot(' + json.dumps(str(shell_evidence / "empty.png")) + ')\nclick("New workspace")')
            script = script.replace('assert js("document.body.innerText.includes(\'200 bars\')")', 'assert js("document.body.innerText.includes(\'200 bars\')")\ncapture_screenshot(' + json.dumps(str(shell_evidence / "error-rejected-import.png")) + ')')
            script += (REPO / "docs/windows/v2/verify-shell.py").read_text(encoding="utf-8").replace("SHELL_EVIDENCE", json.dumps(str(REPO / "docs/windows/v2/evidence/m1-shell")))
        script = script.replace("NATIVE_MODE",str(native)).replace("BRIDGE_URL", f"http://127.0.0.1:{server.server_port}").replace("INVALID_FILE", json.dumps(str(invalid))).replace("VALID_FILE", json.dumps(str(valid))).replace("SCREENSHOT_FILE",json.dumps(str(REPO / "out/workstation-validation.png")))
        try:
            result = subprocess.run([HARNESS], input=script, text=True, capture_output=True, timeout=120,env=harness_env)
            print(result.stdout)
            if result.returncode:
                raise RuntimeError(result.stderr)
            if native:
                import sqlite3
                validation_root = Path(os.environ["LOCALAPPDATA"]) / validation_id
                with sqlite3.connect(validation_root / "workstation.sqlite3") as db:
                    restored=json.loads(db.execute("SELECT payload FROM workspaces").fetchone()[0])
                native_process.terminate(); native_process.wait(timeout=10)
                valid.unlink(); invalid.unlink()
                native_process=subprocess.Popen([str(REPO / "src-tauri/target/release/zterminal-desktop.exe")],env=launch_env)
                # Each OS process has a new CDP connection; a fresh daemon avoids stale Windows endpoint handles.
                harness_env["BU_NAME"] += "-restart"
                restart = """import time
tabs=[t for t in list_tabs() if t.get('url','')=='http://tauri.localhost/']
assert len(tabs)==1
switch_tab(tabs[0]['targetId'])
for _ in range(100):
    if js(\"document.querySelector('footer')?.innerText==='Local storage ready' && document.body.innerText.includes('200 bars')\"): break
    time.sleep(.1)
else: raise AssertionError('Native restart did not restore history')
print('PASS: native process restart restored imported history after original source removal')
"""
                result=subprocess.run([HARNESS],input=restart,text=True,capture_output=True,timeout=45,env=harness_env)
                print(result.stdout)
                if result.returncode: raise RuntimeError(result.stderr)
            else:
                request = json.dumps({"command": "restore_workspace", "args": {}})
                restored = json.loads(subprocess.run([str(DRIVER), str(root / "store")], input=request, text=True, capture_output=True, check=True).stdout)["value"]
            assert restored["chart"]["visibleFromMs"] is not None
            assert restored["chart"]["visibleToMs"] < 12_000_000, "Wheel zoom did not persist a narrowed viewport"
            assert restored["dataset"]["count"] == 200
            print("PASS: persisted viewport and immutable dataset verified outside the browser")
        finally:
            server.shutdown()
            if native_process:
                native_process.terminate(); native_process.wait(timeout=10)


if __name__ == "__main__":
    if "--performance" in sys.argv: performance()
    else: main()
