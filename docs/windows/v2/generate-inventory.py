"""Rebuild the source census contracts and reference manifest from captured evidence."""
import csv
import hashlib
import json
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parent
manifest_path=ROOT/'reference-manifest.json'
if manifest_path.exists() and json.loads(manifest_path.read_text(encoding='utf-8')).get('scopedException'):
 raise SystemExit('Reference ledger has EX-M1-01; merge regenerated candidates explicitly; no files changed')
REPO = ROOT.parents[2]
SOURCE = REPO / 'artifacts/figma-rebuild/revision-v2'
captures = json.loads((ROOT/'evidence/source/source-inventory.json').read_text(encoding='utf-8'))
hash_file = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
families = {
 'A01': ('Windows/Tauri window manager','Live native window','Native window transition; child close redocks','Window placement; preserve unsaved document','OS state changes; failure leaves document recoverable'),
 'A02': ('React presentation + Rust repository','Workspace or truthful empty state','Select referenced destination','Presentation only; documents unchanged','Destination or actionable missing-artifact error'),
 'A03': ('Rust workspace repository','Explicit local selection; valid name and expected revision','Create/open/rename/duplicate/save selected workspace','WorkspaceDocumentV2 transaction and last selection','Durable success; conflict/disk failure preserves previous commit'),
 'A04': ('Rust library query + React','Local catalog','Filter/search/select record','Selected identity only on open','Actual matching records or empty/error state; drafts open source'),
 'A05': ('Presentation repository + Tauri','Existing dock document','Resize/reorder/select/focus/detach/redock/close group','Presentation artifact; document identity/draft retained','Panel moves; recovery/redock on failure or monitor removal'),
 'A06': ('Presentation repository','Reviewed layout/preset','Collapse/expand/reset/select layout','Layout only; no dataset/source deletion','194/42 DIP mode or preset; failure preserves documents'),
 'A07': ('Rust import validator','User-selected original plus explicit semantics','Edit/validate import mapping','Transient candidate; original retained','Exact validation/diagnostics; rejection creates no usable manifest'),
 'A08': ('Rust import/catalog','Valid strict candidate before commit','Choose/validate/commit dataset','Immutable original/segment and atomic catalog references','Validated data or rejection; prior workspace remains intact'),
 'A09': ('Rust dataset repository','Local manifest integrity','Search/filter/select/inspect/reopen dataset','Chart dataset identity on selection','Coverage/hash/source verified or withheld with recovery'),
 'A10': ('Rust provider broker','Verified instrument/product; explicit connection/ack','Search/select/connect/disconnect/retrieve','Provider state and immutable dataset references','Exact source or rate-limit/gap/unavailable with cancellation'),
 'A11': ('Rust data adapter + chart','Verified requested history coverage','Select timeframe/range/latest','ChartDocumentV3 interval/viewport','Observed aggregation or explicit unavailable; no synthetic bars'),
 'A12': ('Shared chart + Rust bounded scene','Observed dataset and replay prefix','Pan/zoom/crosshair/fit/scale','Viewport saved; pointer readout transient','Correct known bar/range; missing/future data withheld'),
 'A13': ('Chart drawing repository','Dataset; tool and selected anchors','Create/edit/lock/toggle/delete/undo/redo drawing','Semantic drawing artifact in ChartDocumentV3','Advertised tool effect; invalid anchor/error preserves prior drawing'),
 'A14': ('Rust study capability + chart','Supported study with required input','Search/apply/edit/remove study','ChartDocumentV3 study configuration','Correct fixture output; unsupported/invalid config explains failure'),
 'A15': ('Rust ReplayClock','Verified dataset and range','Play/pause/step/speed/range/stop','Shared availability boundary; playback policy pending','Same prefix across views; future unavailable; boundary stops'),
 'A16': ('React editor + Rust strategy repository','Selected source or new draft','Edit/search/open/save/revise draft','Atomic draft plus immutable StrategyRevisionV2','Source saved or visible conflict/recovery; prior run source unchanged'),
 'A17': ('Rust config validator','Source/dataset/runtime with required coverage','Edit/preflight/capture configuration or cancel','Transient until immutable captured run','Valid captured inputs or field/preflight diagnostics'),
 'A18': ('Rust broker + supervised Python','Immutable validated inputs and approved isolation','Queue/run/cancel/retry/inspect lifecycle','ExperimentRunV2 state and bounded diagnostics','Completed archive only on success; failed/cancelled/interrupted no final result'),
 'A19': ('Rust completed archive repository','Integrity-valid completed result','Open/select evidence section/inspect hashes','Immutable evidence; selected section transient','Real values and undefined reasons; draft/missing/corrupt withheld'),
 'A20': ('Rust comparison service','Two compatible completed runs','Choose/compare/inspect pair','Captured comparison identities','Real differences or explicit incompatibility warning'),
 'A21': ('Python evidence worker through Rust','Completed closed-trade account returns','Set seed/count/source; run/export bootstrap','New seeded/versioned robustness artifact','Reproducible replacement sample or no-data/input failure'),
 'A22': ('Rust filesystem picker and export','Actual referenced bytes; user-selected destination','Choose/cancel/write export','Durable selected output only','Verified bytes written; cancelled/denied/disk-full never fake success'),
 'A23': ('Rust preferences + React appearance','Reviewed theme/material variants','Select/toggle/reset appearance','Restart-persisted preferences','Visible advertised effect; failure retains prior setting'),
 'A24': ('Chart/preferences repository','Reviewed grid/timezone policy','Set grid intensity/timezone','Persist setting; semantic time anchors unchanged','Correct grid/timezone/DST; invalid value rejected'),
 'A25': ('React preferences + Rust settings','Supported local preference page','Open/edit/search preference page','Only explicit setting changes durable','Functional page or reason/recovery; no empty promised page'),
 'A26': ('Rust runtime broker','Reviewed bundled runtime/repair policy','Inspect/repair/retry preflight','Version/hash/diagnostics captured','Readiness verified or missing-package/runtime diagnostic'),
 'A27': ('Rust recovery/storage + presentation','Preserved journal/artifacts and explicit selection','Inspect/recover/restore/cleanup reviewed records','Originals retained; verified transactional restore','Valid parts restored visibly; corrupt records exposed'),
 'A28': ('React dialog','Open named dialog','Cancel/done/close/Escape and focus return','Only explicit commit action saves','Focus trapped/restored; cancelled edits not falsely saved'),
 'A29': ('Capability registry','Planned/unavailable capability','Disabled with reason and recovery/roadmap','None','No hidden execution; prerequisite-based states can recover'),
 'A30': ('Isolated design preview','Review-only source','Navigate design example','None in product','Review source only; no product success inferred'),
 'A31': ('Rust evidence projection','Verified artifact/readout','Read/inspect information; no assumed activation','None','Values and accessibility match inputs; corrupt/unavailable explained'),
}

exact = {}
def assign(family, names):
 for name in names.split('|'): exact[name] = family
assign('A01','Minimize window|Maximize window|Close window')
assign('A03','New workspace|Create local workspace|Workspace name|Open existing folder|Local workspace\nOn this device')
assign('A04','Recent|Strategies|Archived runs|Search workspaces|Open|Edit draft|Open editor|Workspace library')
assign('A05','Detach panel|Maximize group|Panel actions|Redock panel|Redock editor|Primary Chart|Python Strategy|Research Report')
assign('A06','Collapse sidebar|Expand sidebar|Reset Layout|Chart layout')
assign('A07','Instrument|Timestamp field|Timezone|Duplicate handling')
assign('A08','Choose an import|Import dataset|Add validated sample|Import validation|Import rejected|Back to library')
assign('A09','Search datasets|All datasets|Verified|Needs attention|Dataset library|View exact provenance')
assign('A10','Search verified markets|View provider readiness|Instrument query|Local catalog|Provider discovery|Open cached chart|Connect first|BTCUSDT\nBinance Spot|BTCUSDT')
assign('A11','1m|5m|15m|1h|4h|1D|5D|1M|3M|6M|YTD|ALL|Go to latest')
assign('A13','Cursor|Crosshair|Trend line|Horizontal line|Text|Measure|Magnet|Drawing visibility|Delete selected drawing')
assign('A14','Indicators|Applied · 1|Trend|Momentum|Volatility|Volume|Search indicators|Length|Source|Offset|Line width|Apply sample settings|Indicator settings')
assign('A15','Replay|Step back|Play replay|Step forward|1×|Exit replay|Inspect replay')
assign('A16','Save strategy|Strategy actions|Python strategy developer|Strategy Developer|Open strategy')
assign('A17','Configure|Dataset|Period|Commission|EMA length|Period · UTC|Entry deviation|Commission per fill|Slippage|Initial capital|Position sizing|Review configuration|Review run setup')
assign('A18','Run locally|Preview local run|Inspect cancellation state|Continue editing|Inspect queue|Inspect worker|Diagnostics|Back to jobs|Local run lifecycle|View failed run|Failed run diagnostics')
assign('A19','Overview|Equity|Equity & drawdown|Trade inspection|Trades|Evidence|Assumptions & provenance|Assumptions and provenance|Job diagnostics|Inspect recorded assumptions|Open archived report|Inspect provenance|Return to overview|Back to report|Back to evidence')
assign('A20','Compare baseline|Compare completed runs|Baseline comparison|Inspect baseline')
assign('A21','Robustness|Test robustness|Monte Carlo robustness|Source evidence|Simulation count|Random seed|Trade sampling')
assign('A22','Export evidence|Export issue details')
assign('A23','Violet|Classic Blue|Graphite|Liquid glass enabled|Reduced motion disabled|Compact|Reset appearance')
assign('A24','UTC|Chart settings')
assign('A25','Terminal preferences|Settings|Appearance|Chart|Workspace|Shortcuts|Local storage|Runtime|Runtime & storage|Application|Runtime and storage')
assign('A26','Open runtime health|Inspect runtime')
assign('A27','Recovery|Review recovered draft|Review draft|Open archive|Restore verified workspace|Open workspace library|Detached view|Open recovery|Workspace recovery|Review recovered workspace')
assign('A28','Cancel|Done|Close dialog|Close preferences')
assign('A29','Economic calendar|Calendar|Not available')
assign('A30','View valid sample|Review rejection example|Design handoff|Review main workspace|Review import|Design review|Native design review')

rows=[]
unclassified=[]
for si, capture in enumerate(captures):
 s=capture['scenario']
 for c in capture['controls']:
  name=c['name']; cls=c['classes']; family=exact.get(name)
  if not name and c['action']=='reset': family='A06';name='Reset layout — MISSING accessible name in compact source'
  if c['tag']=='TR': family='A31'
  elif cls=='plot': family='A12';name='Historical plot: pan, zoom, crosshair'
  elif 'pref-slider' in cls: family='A24';name='Grid intensity (static preview slider)'
  elif 'j-replay-track' in cls: family='A15';name='Replay range (static preview track)'
  elif 'study-label' in cls: family='A14';name='Applied EMA: edit/remove (static preview label)'
  elif c['tag']=='I' and not name: family='A14';name='Indicator line color (static preview swatch)'
  elif 'j-choice' in cls: family='A17' if s['view']=='configure' else 'A26'
  elif c['tag']=='A': family='A30'
  elif name=='Inspect': family='A09' if s['view']=='datasets' else 'A18'
  elif name=='Review': family='A08'
  elif name=='Manage local datasets' or name=='Choose a dataset': family='A09'
  elif name=='Focus chart workspace' or name=='Workspaces' or name=='Datasets' or name=='Research' or name=='Market Context': family='A02'
  elif name=='Open detached example': family='A05'
  elif name=='Local workspace\nNot created yet': family='A31'
  elif name=='No completed experiment' or name=='Window restoration': family='A31'
  if family is None:
   unclassified.append((s['view'],name,c['tag'])); family='A31'
  owner,pre,transition,persist,outcome=families[family]
  instance=f'S{si:02d}-C{c["index"]:03d}'
  rows.append(dict(id=instance,reference=s['nodeId'] or 'UNAPPROVED-SOURCE',view=s['view'],size=f'{s["width"]}x{s["height"]}',effects=s['effects'],location=json.dumps(c['rect'],separators=(',',':')),accessible_name=name or 'MISSING NAME — design decision required',observed_name=c['name'],observed_tag=c['tag'],observed_disabled=c['disabled'],prototype_binding=c['action'] or c['route'] or c['timeframe'] or 'STATIC / NO HANDLER',contract=family,preconditions=pre,owner=owner,state_transition=transition,persistence=persist,success_failure=outcome,acceptance_test=f'{family}:{instance}',product_test_status='NOT RUN',approval='Pending reference/control review; synthesized names are proposed corrections, not observed AX names'))

required = {
 'A03':['Rename workspace','Duplicate workspace','Save workspace','Save as','Choose workspace folder'],
 'A05':['Resize dock','Reorder dock/tab','Close panel','Restore focused group','Link symbols/timeframe/crosshair/replay'],
 'A06':['Preset menu contents'],
 'A07':['Choose CSV/Parquet/other approved format','Import units/product/interval','Cancel validation','Validation progress'],
 'A10':['Connect/disconnect public provider','Acknowledge subscription','Historical pagination/cancel','Rate-limit recovery'],
 'A12':['Fit chart','Price scale gestures'],
 'A13':['Edit drawing','Lock drawing','Undo drawing','Redo drawing'],
 'A14':['Add EMA/RSI/Volume','Remove study','Volume pane configuration'],
 'A15':['Pause replay','Stop replay','Select speed/range','Rewind consistency'],
 'A16':['Editable source buffer','Source search','Revision selector','Open source file','Recover draft'],
 'A18':['Cancel queued/running job','Retry failed/interrupted as new job'],
 'A19':['Expand complete hashes','Select trade/fill','Undefined metric explanation'],
 'A20':['Select baseline/candidate','Incompatibility warning'],
 'A21':['Run seeded robustness','Export robustness'],
 'A22':['Destination picker','Export cancellation/permission/disk-full'],
 'A23':['Rich/reduced/opaque mode','Reduced motion','Density choices'],
 'A25':['Preference page bodies','Shortcut edit/conflict','Preference search'],
 'A26':['Runtime repair/retry'],
 'A27':['Storage cleanup preview','Corrupt-record diagnostics','Safe monitor placement recovery']}
for family,names in required.items():
 for name in names:
  owner,pre,transition,persist,outcome=families[family];instance=f'REQUIRED-{len(rows):04d}'
  rows.append(dict(id=instance,reference='GOVERNING-BRIEF / MISSING APPROVED STATE',view='unresolved',size='unresolved',effects='unresolved',location='unresolved',accessible_name=name,observed_name='not supplied',observed_tag='not supplied',observed_disabled='',prototype_binding='not supplied',contract=family,preconditions=pre,owner=owner,state_transition=transition,persistence=persist,success_failure=outcome,acceptance_test=f'{family}:{instance}',product_test_status='BLOCKED',approval='Design/scope review required; label is a requirement, not approved wording'))
with (ROOT/'control-inventory.csv').open('w',newline='',encoding='utf-8') as f:
 w=csv.DictWriter(f,fieldnames=list(rows[0]),lineterminator='\n');w.writeheader();w.writerows(rows)

source_files=sorted(p for p in SOURCE.rglob('*') if p.is_file())
legacy_files=sorted(p for p in SOURCE.parent.iterdir() if p.is_file())
with zipfile.ZipFile(ROOT/'evidence/design-source.zip','w',zipfile.ZIP_DEFLATED) as z:
 for p in source_files: z.write(p,p.relative_to(SOURCE).as_posix())
 for p in legacy_files: z.write(p,'legacy/'+p.name)
legacy=json.loads((SOURCE.parent/'design-system-state.json').read_text())
(ROOT/'legacy-design-system-inventory.json').write_text(json.dumps(legacy,indent=2),encoding='utf-8')
historical=json.loads((SOURCE/'journey-capture-state.json').read_text())
core=json.loads((SOURCE/'capture-state.json').read_text())
manifest=dict(schemaVersion=1,date='2026-10-11',status='BLOCKED — review manifest frozen, approval not granted',governing='docs/windows/V2-PRODUCT-BUILD-PROMPT.md',fileKey=core['fileKey'],pageId='3:3',referencePriority='Existing accepted V2 direction over earlier 35-screen draft; prepared local corrections require review',approvalAuthority='Human product/design gate; source inspection and capture completion do not grant approval',frames=[])
for si,capture in enumerate(captures[:25]):
 s=capture['scenario'];old=next((v for v in historical['views'] if v['nodeId']==s['nodeId']),None)
 manifest['frames'].append(dict(nodeId=s['nodeId'],view=s['view'],dimensionsDip=[s['width'],s['height']],sourceComposition='app.js + journeys.js + design-gate.js',localSourceExport='evidence/source/'+capture['screenshot'],localSourceSha256=hash_file(ROOT/'evidence/source'/capture['screenshot']),originalFigmaExport='evidence/figma-33-1080.png' if s['nodeId']=='33:1080' else None,originalFigmaSha256=hash_file(ROOT/'evidence/figma-33-1080.png') if s['nodeId']=='33:1080' else None,historicalReview=old['visualReview'] if old else ('main visually inspected' if s['nodeId']=='14:1080' else 'source reviewed; Figma individual audit not established'),currentReview='Fresh metadata + 1440x900 PNG shows correct comparison, not diagnostics; awaiting approval' if s['nodeId']=='33:1080' else 'BLOCKED: full-resolution Figma export/layer verification unavailable at quota',fonts='Source declares real Geist/Geist Mono variable normal 100–900; actual Figma style names unverified',tokens='native-design-tokens.json is explicitly unapproved; source token/style hashes frozen below',interactions='ACTIONS.md + control-inventory.csv; prototype is design-only',approvedExceptions=[]))
manifest['missingOrUnapproved']=['24 original full-resolution frame exports unavailable this run','Figma node fonts/types/image fills/bounds/clipping, components/variables/prototype wiring','Earlier eight Figma compositions lack propagated local library destinations','Equity/drawdown, trade detail, empty and mixed-monitor source additions have no accepted V2 node','Rich/reduced/opaque variants, themes/density, high-DPI 911x512 and 683x384 source variants lack approval','All interaction state variants and full menu contents','Provider connection/history failures, perpetual research/funding/mark coverage and liquidation states','Editable editor/revisions, actual cancellation/retry/repair, comparison incompatibility, export failure/pickers','All preference page bodies, shortcuts, cleanup/recovery failure and accessibility review','Current comparison header says Binance Futures, saved source says Binance Spot; decide exact product identity','Prepared token capability milestone numbers conflict with governing milestones; use governing sequence']
manifest['preparedSourceSnapshots']=[dict(path=p.relative_to(SOURCE).as_posix(),bytes=p.stat().st_size,sha256=hash_file(p)) for p in source_files]
manifest['legacyRecords']=[dict(path='legacy/'+p.name,bytes=p.stat().st_size,sha256=hash_file(p),status='Earlier editor-first draft; not accepted V2 target; do not replay construction requests') for p in legacy_files]
manifest['sourceSnapshotArchive']=dict(path='evidence/design-source.zip',sha256=hash_file(ROOT/'evidence/design-source.zip'),purpose='Exact original ignored source/handoff/fonts packaged for review; not an approved design')
manifest['additionalSourceArrangements']=[dict(**c['scenario'],export='evidence/source/'+c['screenshot'],sha256=hash_file(ROOT/'evidence/source'/c['screenshot']),status='UNAPPROVED SOURCE') for c in captures[25:]]
# Preserve human authorization/provenance; regeneration must not erase the review ledger.
manifest_path=ROOT/'reference-manifest.json'
if manifest_path.exists() and json.loads(manifest_path.read_text()).get('scopedException'):
 raise SystemExit('Reference ledger has EX-M1-01; merge regenerated candidates into it explicitly instead of overwriting authorization')
manifest_path.write_text(json.dumps(manifest,indent=2),encoding='utf-8')
print(json.dumps(dict(sourceCandidates=1711,totalRows=len(rows),unclassified=unclassified),ensure_ascii=True))
