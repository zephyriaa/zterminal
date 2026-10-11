"""Capture design examples, never application acceptance. Recordings stay off.

Start the original isolated source server on 8765 before running this file.
Uses the installed browser-harness and preserves unrelated tabs.
"""
import json
import os
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT.parents[2] / 'artifacts/figma-rebuild/revision-v2'
frames = json.loads((SOURCE / 'capture-state.json').read_text())['views'] + json.loads((SOURCE / 'journey-capture-state.json').read_text())['views']
scenarios = [dict(view=f['view'], width=f['width'], height=f['height'], nodeId=f['nodeId'], effects='rich') for f in frames]
scenarios += [dict(view=v, width=w, height=h, nodeId=None, effects=e) for v,w,h,e in [('equity',1440,900,'rich'),('trades',1440,900,'rich'),('empty',1440,900,'opaque'),('mixed-monitors',1920,1080,'rich'),('design-review',1440,900,'rich'),('chart',911,512,'reduced'),('studio',683,384,'opaque'),('configure',683,384,'opaque'),('chart',1440,900,'reduced'),('chart',1440,900,'opaque'),('detached',1024,680,'rich')]]
script = r'''
import json, time
from pathlib import Path
scenarios=SCENARIOS
out=Path(OUTPUT); out.mkdir(parents=True,exist_ok=True)
tabs=[t for t in list_tabs() if t.get('url','').startswith('http://127.0.0.1:8765/')]
if tabs: switch_tab(tabs[0]['targetId'])
else: new_tab('http://127.0.0.1:8765/')
results=[]
for i,s in enumerate(scenarios):
    cdp('Emulation.setDeviceMetricsOverride',width=s['width'],height=s['height'],deviceScaleFactor=1,mobile=False)
    goto_url('http://127.0.0.1:8765/?view='+s['view']+'&width='+str(s['width'])+'&height='+str(s['height'])+'&effects='+s['effects'])
    for _ in range(100):
        if js('window.__designReady===true'): break
        time.sleep(.05)
    else: raise AssertionError(s)
    data=json.loads(js("JSON.stringify({title:document.title,fonts:[...document.fonts].map(f=>({family:f.family,weight:f.weight,style:f.style,status:f.status})),controls:[...document.querySelectorAll('button,input,select,textarea,a[href],[role=slider],.pref-slider,.report-tabs span,.j-choice,.j-replay-track,.j-color-row i,.study-label,.j-table tbody tr,.plot')].filter(e=>e.getClientRects().length).map((e,j)=>{const r=e.getBoundingClientRect();return {index:j,tag:e.tagName,role:e.getAttribute('role'),name:e.getAttribute('aria-label')||e.getAttribute('title')||e.innerText?.trim()||e.closest('label')?.innerText?.trim()||e.getAttribute('placeholder')||'',type:e.getAttribute('type'),action:e.dataset.action||null,route:e.dataset.view||null,timeframe:e.dataset.timeframe||null,disabled:e.disabled||false,value:e.value??null,classes:e.className,rect:{x:r.x,y:r.y,width:r.width,height:r.height}}}),text:document.body.innerText,geometry:{appWidth:document.querySelector('#app').clientWidth,scrollWidth:document.documentElement.scrollWidth,sidebar:document.querySelector('.sidebar').getBoundingClientRect().width}})"))
    data['scenario']=s
    filename=f"source-{i:02d}-{s['view']}-{s['width']}-{s['effects']}.png"
    capture_screenshot(str(out/filename)); data['screenshot']=filename
    results.append(data)
(out/'source-inventory.json').write_text(json.dumps(results,indent=2),encoding='utf-8')
print(json.dumps({'scenarios':len(results),'controls':sum(len(x['controls']) for x in results),'output':str(out)}))
'''.replace('SCENARIOS',repr(scenarios)).replace('OUTPUT',repr(str(ROOT/'evidence/source')))
env = dict(os.environ, BH_RECORD='0')
harness = Path.home()/'.local/bin/browser-harness.exe'
result = subprocess.run([str(harness)],input=script,text=True,capture_output=True,env=env,timeout=240)
print(result.stdout)
if result.returncode:
    raise RuntimeError(result.stderr)
