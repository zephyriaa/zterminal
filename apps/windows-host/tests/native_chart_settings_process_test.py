"""Chart-settings protocol and persistence checks; no desktop interaction."""
import copy
import hashlib
import json
from pathlib import Path
import subprocess
import sys

exe=Path(sys.argv[1]).resolve(strict=True)
root=Path(sys.argv[2]).resolve()
assert not root.exists(), "Use a fresh isolated evidence directory"
root.mkdir(parents=True)
store=root/"TEST-ONLY-store"

def call(command, expect=True, **fields):
    request,response=root/"request.json",root/"response.json"
    request.write_text(json.dumps(dict(command=command,**fields)),encoding="utf-8")
    subprocess.run([exe,store,request,response],check=True,timeout=40)
    value=json.loads(response.read_text(encoding="utf-8"))
    assert value["ok"]==expect,value
    return value.get("value")

call("create",id="a",name="TEST ONLY A")
call("create",id="b",name="TEST ONLY B")
csv=root/"TEST-ONLY.csv"
csv.write_text("t,o,h,l,c,v\n60000,-1,1,-2,0,0\n120000,0,2,-1,1,4\n")
w=call("import",id="a",revision="1",path=str(csv),symbol="TEST-ONLY",priceStep="1",quantityStep="1",intervalMs="60000")
dataset=copy.deepcopy(w["dataset"])
original=call("presentation",id="a",revision="2")
p=copy.deepcopy(original["current"])
revision=2
for kind in ("candles","bars","line","area"):
    p["chartType"]=kind
    p["settings"]["candleUpColor"]="#abcdef"
    p["settings"]["invertScale"]=True
    p["volumeVisible"]=False
    w=call("save_presentation",id="a",revision=str(revision),presentation=p)
    revision=w["document"]["revision"]
    assert w["dataset"]==dataset
    assert call("presentation",id="a",revision=str(revision))["current"]==p
assert call("presentation",id="b",revision="1")["current"]==original["defaults"]
call("presentation",expect=False,id="a",revision="2")
call("save_presentation",expect=False,id="a",revision="2",presentation=original["defaults"])
for field,value in (("backgroundColor","url(secret)"),("futureBars",200.5),("scaleMode","unknown")):
    bad=copy.deepcopy(p);bad["settings"][field]=value
    call("save_presentation",expect=False,id="a",revision=str(revision),presentation=bad)
bad=copy.deepcopy(p);bad["version"]=5
call("save_presentation",expect=False,id="a",revision=str(revision),presentation=bad)
assert call("presentation",id="a",revision=str(revision))["current"]==p
assert call("save_presentation",id="a",revision=str(revision),presentation=p)["document"]["revision"]==revision
reset=call("save_presentation",id="a",revision=str(revision),presentation=original["defaults"])
assert reset["dataset"]==dataset
rev=reset["document"]["revision"]
assert call("presentation",id="a",revision=str(rev))["current"]==original["defaults"]
drawings=[
    dict(id="d1",kind="trend-line",anchors=[dict(timeMs=60000,priceTicks=0),dict(timeMs=60000,priceTicks=1)],color="#00ff88",width=2,lineStyle="solid",opacity=1.0,locked=False,hidden=False,zOrder=0),
    dict(id="d2",kind="horizontal-line",anchors=[dict(timeMs=120000,priceTicks=1)],color="#ffaa00",width=1,lineStyle="dashed",opacity=1.0,locked=False,hidden=False,zOrder=1),
]
w=call("save_drawings",id="a",revision=str(rev),drawings=drawings)
rev=w["document"]["revision"]
assert len(call("drawings",id="a",revision=str(rev)))==2
w=call("save_indicators",id="a",revision=str(rev),indicators=[dict(id="sma2",kind="sma",period=2)])
rev=w["document"]["revision"]
w=call("save_replay",id="a",revision=str(rev),replay=dict(version=1,dataset=w["chart"]["dataset"],availableThroughMs=120000,fromMs=60000,toMs=180000,speed=1.0,playing=False))
rev=w["document"]["revision"]
scene=call("scene",id="a",revision=str(rev))
assert len(scene["bars"])==1 and len(scene["drawings"])==1 and scene["indicators"][0]["values"]==[None]
w=call("save_replay",id="a",revision=str(rev),replay=None)
rev=w["document"]["revision"]
scene_full=call("scene",id="a",revision=str(rev))
assert len(scene_full["bars"])==2 and len(scene_full["drawings"])==2 and scene_full["indicators"][0]["values"]==[None,0.5]
result=dict(status="PASS",adapter_sha256=hashlib.sha256(exe.read_bytes()).hexdigest(),checks=["independent-process round trip for four chart types","dataset identity unchanged","workspace settings isolation","stale read/write rejection","invalid settings and unknown version rejected without mutation","unchanged Apply does not manufacture a revision","reset retains dataset","drawings indicators and replay roundtrip with causal cutoff"])
(root/"results.json").write_text(json.dumps(result,indent=2))
print(json.dumps(result,indent=2))
