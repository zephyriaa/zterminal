# Execute with Browser Harness after opening a dedicated local chart workspace's preferences.
# Example: exec(open("scripts/test-customization-browser.py", encoding="utf-8").read())
# Mutates only the QA origin's preferences and workspace. Recordings remain off.
assert current_tab()["url"].startswith("http://localhost:3107/workspaces/"), "Use the dedicated local QA origin."
import json, time
from pathlib import Path
out=Path("artifacts/customization")
results=[]
def wait_js(expression, timeout=15):
    end=time.monotonic()+timeout
    while time.monotonic()<end:
        value=js(expression)
        if value: return value
        time.sleep(.15)
    raise AssertionError("Timed out: "+expression)
def node(role,name):
    for n in cdp("Accessibility.getFullAXTree")["nodes"]:
        if n.get("role",{}).get("value")in ([role,"searchbox"] if role=="textbox" else [role]) and str(n.get("name",{}).get("value","")).casefold()==name.casefold():
            return n["backendDOMNodeId"]
    raise AssertionError(f"Missing {role}: {name}")
def click(role,name):
    n=node(role,name)
    cdp("DOM.scrollIntoViewIfNeeded",backendNodeId=n)
    q=cdp("DOM.getBoxModel",backendNodeId=n)["model"]["content"]
    click_at_xy(sum(q[0::2])/4,sum(q[1::2])/4)
    time.sleep(.35)
def fill(name,value):
    click("textbox",name); cdp("Input.dispatchKeyEvent",type="keyDown",key="a",code="KeyA",modifiers=2,windowsVirtualKeyCode=65,commands=["selectAll"]); cdp("Input.dispatchKeyEvent",type="keyUp",key="a",code="KeyA",modifiers=2,windowsVirtualKeyCode=65); cdp("Input.insertText",text=value);time.sleep(.2)
def check(name,expression):
    value=wait_js(expression)
    results.append({"check":name,"status":"PASS"})
    print("PASS",name,flush=True)
    (out/"browser-results.json").write_text(json.dumps(results,indent=2))
def snapshot():
    return js("new Promise((resolve,reject)=>{const r=indexedDB.open('zterminal-workspaces',1);r.onsuccess=()=>{const db=r.result;const t=db.transaction('records','readonly');const q=t.objectStore('records').get(location.pathname.split('/').at(-1));q.onsuccess=()=>{resolve(q.result.snapshot);db.close()};q.onerror=reject};r.onerror=reject})")
def preferences():
    return js("JSON.parse(localStorage.getItem('zterminal.customization.v1')).state.preferences")
cdp("Page.setWebLifecycleState",state="active");cdp("Emulation.setFocusEmulationEnabled",enabled=True)
wait_js("!!document.querySelector('.zt-customization')")
click("button","Reset appearance section")
before=snapshot()
click("button","Classic Blue")
check("application preset saved", "JSON.parse(localStorage.getItem('zterminal:appearance:v2')).state.appearance.preset==='Graphite'")
assert snapshot()['chartDocuments']==before['chartDocuments']
results.append({"check":"application preset preserves chart documents","status":"PASS"})
fill("Accent hex","#c4b5fd")
check("editable hex applied", "getComputedStyle(document.body).getPropertyValue('--zt-accent').trim()==='#c4b5fd'")
fill("Custom appearance name","QA violet glass")
click("button","Save appearance preset")
check("named appearance saved", "JSON.parse(localStorage.getItem('zterminal.customization.v1')).state.preferences.appearancePresets.some(p=>p.name==='QA violet glass')")
click("slider","Interface and editor text size · 12px")
press_key("Home");press_key("ArrowRight");press_key("ArrowRight");press_key("ArrowRight")
check("font size reaches rendered controls", "getComputedStyle(document.querySelector('.zt-customization nav button')).fontSize==='14px'")
click("checkbox","Reduce motion")
check("reduced motion applied", "document.body.dataset.terminalMotion==='reduced'")
click("button","Revert appearance session")
check("appearance revert restores defaults", "JSON.parse(localStorage.getItem('zterminal:appearance:v2')).state.appearance.preset==='Violet' && document.body.dataset.terminalMotion==='system'")
fill("Search preferences","shortcut")
check("search reveals relevant section", "document.querySelector('.zt-customization').innerText.includes('Application shortcuts') && !document.querySelector('.zt-customization').innerText.includes('Application appearance')")
fill("Search preferences","")
click("button","Keyboard")
click("button","Rebind Toggle sidebar")
press_key("9",modifiers=1)
check("shortcut rebind persisted", "JSON.parse(localStorage.getItem('zterminal.customization.v1')).state.preferences.bindings.sidebar==='Alt+9'")
click("button","Rebind Open preferences")
press_key("9",modifiers=1)
check("shortcut conflict rejected", "document.querySelector('.zt-preference-status').innerText.includes('already assigned')")
press_key("Escape")
# Focus the shell before testing global shortcuts, which intentionally ignore preferences controls.
click("button","Focus chart workspace")
old=js("document.querySelector('.zt-reference-body').dataset.sidebarCollapsed")
press_key("9",modifiers=1)
check("rebound shortcut executes", "document.querySelector('.zt-reference-body').dataset.sidebarCollapsed!=="+json.dumps(old))
click("button","Terminal preferences")
click("button","Keyboard")
click("button","Reset keyboard shortcuts")
click("button","Layout")
fill("Layout template name","QA arrangement")
click("button","Save layout template")
check("layout template saved", "JSON.parse(localStorage.getItem('zterminal.customization.v1')).state.preferences.layoutTemplates.some(p=>p.name==='QA arrangement')")
original_layout=snapshot()['dockLayout']
click("button","Multi-chart comparison")
check("multi-chart arrangement applied", "document.querySelector('.zt-customization').innerText.includes('Workspace arrangement')")
wait_js("document.querySelector('select')!==null")
time.sleep(.6)
assert snapshot()['multiChart']['layout']=='4'
click("button","Undo layout change")
time.sleep(.6)
assert snapshot()['multiChart']['layout']==before['multiChart']['layout']
results.append({"check":"layout change is undoable after panel remount","status":"PASS"})
click("checkbox","Lock panel dragging and resizing")
check("layout lock disables arrangement controls", "[...document.querySelectorAll('.zt-customization button')].find(b=>b.textContent==='Reset layout').disabled")
time.sleep(.6)
assert snapshot()['layoutLocked'] is True
click("checkbox","Lock panel dragging and resizing")
click("button","Charts")
wait_js("!!document.querySelector('.zt-chart-settings-panel')")
fill("Preset or template name","QA chart style")
click("button","Save chart style")
check("chart style saved", "JSON.parse(localStorage.getItem('zterminal.customization.v1')).state.preferences.chartStyles.some(p=>p.name==='QA chart style')")
click("button","Save indicator template")
check("indicator template saved separately", "JSON.parse(localStorage.getItem('zterminal.customization.v1')).state.preferences.indicatorTemplates.some(p=>p.name==='QA chart style')")
if js("[...document.querySelectorAll('.zt-chart-settings-panel input[type=checkbox]')].find(e=>e.parentElement.textContent.toLowerCase().includes('link candle')).checked"):
    click("checkbox","Link candle body, border and wick colors")
fill("Up wicks hex","#ffffff")
check("independent wick color control", "document.querySelector('[aria-label=\"Up wicks hex\"]').value==='#ffffff'")
time.sleep(.6)
after=snapshot()
assert any(d['settings']['candleWickUpColor']=='#ffffff' and d['settings']['candleUpColor']!='#ffffff' for d in after['chartDocuments'])
click("button","Use style for new charts")
check("new chart style default saved", "JSON.parse(localStorage.getItem('zterminal.customization.v1')).state.preferences.chartDefaults.candleWickUpColor==='#ffffff'")
click("button","Revert chart session")
time.sleep(.6)
assert snapshot()['chartDocuments'][0]['settings']==before['chartDocuments'][0]['settings']
results.append({"check":"chart session revert restores original settings","status":"PASS"})
click("button","Import / Export")
download=(out/"downloads").resolve();download.mkdir(exist_ok=True)
cdp("Browser.setDownloadBehavior",behavior="allow",downloadPath=str(download))
click("button","Export preferences")
for _ in range(60):
    files=list(download.glob('zterminal-preferences*.json'))
    if files:break
    time.sleep(.1)
assert files,"Export did not download"
exported=json.loads(max(files,key=lambda p:p.stat().st_mtime).read_text())
assert exported['version']==1
results.append({"check":"real preference export downloaded","status":"PASS"})
exported['customization']['fontSize']=15
valid=out/'valid-import.json';valid.write_text(json.dumps(exported))
invalid=out/'invalid-import.json';invalid.write_text('{"version":999}')
def upload(path):
    doc=cdp("DOM.getDocument")["root"]["nodeId"]
    n=cdp("DOM.querySelector",nodeId=doc,selector=".zt-customization input[type=file]")["nodeId"]
    cdp("DOM.setFileInputFiles",nodeId=n,files=[str(path.resolve())])
old=preferences()
upload(invalid)
check("invalid import rejected in UI", "document.querySelector('.zt-preference-status').innerText.includes('Import rejected')")
assert preferences()==old
upload(valid)
check("valid import previews before mutation", "!!document.querySelector('.zt-import-preview')")
assert preferences()==old
click("button","Apply imported preferences")
check("valid import applies after review", "getComputedStyle(document.querySelector('.zt-customization nav button')).fontSize==='15px'")
click("button","Appearance")
click("button","Reset appearance section")
click("button","Layout")
click("checkbox","Lock panel dragging and resizing")
time.sleep(1)
cdp("Page.reload",ignoreCache=True)
wait_for_load()
cdp("Page.setWebLifecycleState",state="active");cdp("Emulation.setFocusEmulationEnabled",enabled=True)
wait_js("!!document.querySelector('.zt-customization')")
click("button","Layout")
check("layout lock survives reload", "[...document.querySelectorAll('.zt-customization input[type=checkbox]')].some(e=>e.checked && e.parentElement.textContent.includes('Lock panel'))")
click("checkbox","Lock panel dragging and resizing")
click("button","Appearance")
check("workspace remains editable after reload", "!document.querySelector('.ws-banner')")
(out/"browser-results.json").write_text(json.dumps(results,indent=2))
print('BROWSER CHECKS COMPLETE',len(results),flush=True)
