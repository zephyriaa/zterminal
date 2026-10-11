"""Executed inside browser-harness after the native local-workflow check.
Uses real Tauri IPC. DPR emulation is renderer evidence, not native Windows DPI.
"""
import base64
from pathlib import Path

evidence = Path(SHELL_EVIDENCE)
evidence.mkdir(parents=True, exist_ok=True)
checks = []
captures = []

def check(label, expression):
    assert js(expression), label
    checks.append(label)

def key(name, code=None, modifiers=0):
    vk = {'Tab':9,'Enter':13,'Escape':27,'Home':36,'End':35,'ArrowDown':40}[name]
    cdp('Input.dispatchKeyEvent', type='keyDown', key=name, code=code or name, modifiers=modifiers, windowsVirtualKeyCode=vk)
    cdp('Input.dispatchKeyEvent', type='keyUp', key=name, code=code or name, modifiers=modifiers, windowsVirtualKeyCode=vk)

def capture(name):
    time.sleep(.2)
    png = cdp('Page.captureScreenshot', format='png', captureBeyondViewport=False)['data']
    (evidence / (name + '.png')).write_bytes(base64.b64decode(png))
    geometry = js("JSON.stringify({width:innerWidth,height:innerHeight,dpr:devicePixelRatio,header:document.querySelector('.header').getBoundingClientRect().toJSON(),sidebar:document.querySelector('.sidebar').getBoundingClientRect().toJSON(),dock:document.querySelector('.dock').getBoundingClientRect().toJSON(),chart:document.querySelector('.chart-group').getBoundingClientRect().toJSON(),dialog:document.querySelector('dialog').getBoundingClientRect().toJSON(),overflow:document.documentElement.scrollWidth>innerWidth,font:getComputedStyle(document.body).fontFamily})")
    captures.append(dict(name=name, **json.loads(geometry)))

# OS desktop's actual client capture, before emulation.
capture('native-client-actual')
click('Terminal preferences')
check('Native modal opened', "document.querySelector('dialog').open")
click('Material mode', 'combobox')
key('End'); key('Enter')
click('Reduced motion', 'checkbox')
click('Information density', 'combobox'); key('End'); key('Enter')
click('Save appearance')
wait_for("document.querySelector('main').dataset.material==='opaque' && document.querySelector('main').dataset.reducedMotion==='true'")
check('Comfortable density applies', "document.querySelector('.nav button').getBoundingClientRect().height===48")
capture('preferences-opaque')
click('Chart')
click('Grid intensity', 'slider'); key('Home')
click('Save appearance')
wait_for("document.querySelector('output').innerText==='0%'")
click('Done')
check('Dialog returns focus', "document.activeElement.getAttribute('aria-label')==='Terminal preferences'")
cdp('Page.reload')
wait_for("document.querySelector('footer')?.innerText==='Local storage ready' && document.querySelector('main').dataset.material==='opaque'")
check('Preference reload persisted', "document.querySelector('main').dataset.reducedMotion==='true'")
click('Terminal preferences'); click('Reset appearance')
wait_for("document.querySelector('main').dataset.material==='rich' && document.querySelector('main').dataset.reducedMotion==='false'")
key('Escape')
wait_for("!document.querySelector('dialog').open")
check('Escape closes modal', "!document.querySelector('dialog').open")
click('Terminal preferences'); click('Material mode', 'combobox'); key('Home'); key('ArrowDown')
key('Enter'); click('Save appearance')
wait_for("document.querySelector('main').dataset.material==='reduced'")
check('Reduced material applies', "document.querySelector('main').dataset.material==='reduced'")
capture('preferences-reduced')
click('Reset appearance'); wait_for("document.querySelector('main').dataset.material==='rich'"); key('Escape')
click('Collapse sidebar')
check('Explicit compact rail', "document.querySelector('.sidebar').getBoundingClientRect().width===42")
click('Expand sidebar')
click('Maximize chart')
check('Maximize presentation', "document.querySelector('.right-dock').getBoundingClientRect().width===0")
click('Restore chart layout')
click('Workspaces')
enter('Search workspaces', 'no match')
check('Library search empty state', "document.body.innerText.includes('No matching workspaces.')")
enter('Search workspaces', 'TEST ONLY')
check('Library search finds saved workspace', "document.querySelectorAll('.library>button').length===1")
click('Chart')
check('Navigation preserves imported history', "document.body.innerText.includes('200 bars') && document.querySelectorAll('canvas').length>0")

for width, height, label in [(1366,768,'compact'),(1440,900,'main'),(1920,1080,'expanded'),(911,512,'small'),(683,384,'smallest')]:
    for dpr in [1,1.5,2]:
        cdp('Emulation.setDeviceMetricsOverride', width=width, height=height, deviceScaleFactor=dpr, mobile=False)
        time.sleep(.1)
        check(f'{label} {dpr} no horizontal overflow', 'document.documentElement.scrollWidth<=innerWidth')
        capture(f'{label}-{width}x{height}-dpr{dpr}')
    if width < 1100:
        check(f'{label} automatic rail', "document.querySelector('.sidebar').getBoundingClientRect().width===42")
        click('Strategy Developer')
        check(f'{label} focused group reachable', "document.querySelector('.compact-presentation').getBoundingClientRect().width>0 && document.querySelector('.chart-group').getBoundingClientRect().width===0")
        capture(f'{label}-focused')
        click('Market Context')
        check(f'{label} context reachable', "document.querySelector('.compact-presentation .context').getBoundingClientRect().width>0")
        click('Chart')
        click('Terminal preferences')
        check(f'{label} modal fits work area', "(()=>{let r=document.querySelector('dialog').getBoundingClientRect();return r.x>=0&&r.y>=0&&r.right<=innerWidth&&r.bottom<=innerHeight})()")
        # Native Tab must remain inside the modal, including its scrollable pages.
        for _ in range(18): key('Tab')
        check(f'{label} modal confines focus', "document.querySelector('dialog').contains(document.activeElement)")
        capture(f'{label}-preferences')
        key('Escape')

cdp('Emulation.setDeviceMetricsOverride', width=1440, height=900, deviceScaleFactor=1, mobile=False)
click('Strategy Developer'); capture('focused-1440x900')
check('Focused 55/45 composition', "Math.abs(document.querySelector('.chart-group').getBoundingClientRect().width/document.querySelector('.dock').getBoundingClientRect().width-.55)<.002")
click('Research'); capture('evidence-empty-1440x900')
check('No fabricated research result', "document.body.innerText.includes('No archived run available') && document.body.innerText.includes('Runtime unavailable')")
click('Chart')
cdp('Emulation.setDeviceMetricsOverride', width=1440, height=870, deviceScaleFactor=1, mobile=False)
capture('comparison-main-client')
click('Terminal preferences'); capture('comparison-preferences-client'); key('Escape')
cdp('Emulation.setDeviceMetricsOverride', width=1440, height=900, deviceScaleFactor=1, mobile=False)
click('Terminal preferences'); capture('preferences-1440x900')
for _ in range(30): key('Tab')
check('Modal keyboard focus confinement', "document.querySelector('dialog').contains(document.activeElement)")
key('Escape')
click('Save workspace')
wait_for("document.querySelector('footer')?.innerText==='Saved to this device'")
nodes = cdp('Accessibility.getFullAXTree')['nodes']
unnamed=[n for n in nodes if not n.get('ignored') and n.get('role',{}).get('value')=='button' and not n.get('name',{}).get('value')]
assert not unnamed, unnamed
checks.append('All exposed buttons named')
check('Shared web chart stays offline', "Array.isArray(window.__chartNetworkAttempts) && window.__chartNetworkAttempts.length===0")
# Use real pointer and keyboard input to exercise reusable control states.
n=next(n for n in nodes if n.get('name',{}).get('value')=='Save workspace' and n.get('role',{}).get('value')=='button')
q=cdp('DOM.getBoxModel',backendNodeId=n['backendDOMNodeId'])['model']['content'];x=sum(q[0::2])/4;y=sum(q[1::2])/4
cdp('Input.dispatchMouseEvent',type='mouseMoved',x=x,y=y)
capture('control-hover')
cdp('Input.dispatchMouseEvent',type='mousePressed',x=x,y=y,button='left',buttons=1,clickCount=1)
capture('control-pressed')
cdp('Input.dispatchMouseEvent',type='mouseReleased',x=x,y=y,button='left',buttons=0,clickCount=1)
wait_for("!document.querySelector('main').classList.contains('busy')")
key('Tab'); capture('control-focus-disabled-selected')
check('Reduced and opaque available without domain mutation', "document.querySelector('[aria-label=\"Workspace name\"]').value==='TEST ONLY saved chart'")
cdp('Emulation.clearDeviceMetricsOverride')
(evidence / 'shell-results.json').write_text(json.dumps(dict(status='PASS',nativeIPC=True,recordings=False,checks=checks,captures=captures,limitations=['DPR is Chromium emulation, not OS DPI','Original Figma parity BLOCKED','No Narrator/IME or caption scaling acceptance']),indent=2))
print(f'PASS: {len(checks)} shell assertions; {len(captures)} screenshots; real IPC, recordings off')
