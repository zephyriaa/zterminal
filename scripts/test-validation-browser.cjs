const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const { chromium } = require('playwright');

async function main() {
  const base = process.env.TERMINAL_URL || 'http://localhost:3000';
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zt-validation-e2e-'));
  const python = path.resolve('.venv-research/Scripts/python.exe');
  const output = path.resolve('artifacts/validation');
  fs.mkdirSync(output, { recursive: true });
  const unitsResponse = await fetch(base + '/api/research-instrument?provider=gateio&symbol=BTC_USDT');
  assert.equal(unitsResponse.status, 200, 'real instrument units are available');
  const units = await unitsResponse.json();
  const seed = spawnSync(python, ['scripts/validation-browser-fixture.py', root, JSON.stringify(units)], { encoding: 'utf8', windowsHide: true });
  assert.equal(seed.status, 0, seed.stderr);
  const fixture = JSON.parse(fs.readFileSync(path.join(root, 'browser-fixture.json'), 'utf8'));
  let helper, browser;
  const errors = [], consoleErrors = [], steps = [];
  try {
    // A busy port is an explicit failure; never stop a user's existing Helper.
    helper = spawn(python, ['research/desktop/server.py', '--data-dir', root], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
    let helperError = '';
    helper.stderr.on('data', data => { helperError += data.toString(); });
    const deadline = Date.now() + 20000;
    while (!fs.existsSync(path.join(root, 'pairing.json')) && Date.now() < deadline && helper.exitCode == null) await new Promise(resolve => setTimeout(resolve, 100));
    assert.equal(helper.exitCode, null, helperError);
    const pairing = JSON.parse(fs.readFileSync(path.join(root, 'pairing.json'), 'utf8'));
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: 'dark' });
    const page = await context.newPage();
    page.setDefaultTimeout(30000);
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
    const network = [];
    page.on('response', response => { if (response.url().includes('127.0.0.1:47321')) network.push({ path: new URL(response.url()).pathname, status: response.status() }); });
    await page.goto(base + '/healthz');
    await page.evaluate(async request => {
      const db = await new Promise((resolve, reject) => { const r = indexedDB.open('zterminal-research-drafts', 1); r.onupgradeneeded = () => r.result.createObjectStore('drafts'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
      const draft = { id: 'simulated-e2e', kind: 'strategy', name: request.name, source: request.source, savedSource: request.source, revision: 0, updatedAt: Date.now() };
      const envelope = JSON.stringify({ version: 1, state: { drafts: { [draft.id]: draft }, activeId: draft.id, config: request.config, params: request.params, minimap: false } });
      await new Promise((resolve, reject) => { const tx = db.transaction('drafts', 'readwrite'); tx.objectStore('drafts').put(envelope, 'research-drafts-v1'); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); });
      db.close();
    }, fixture);
    const nav = async name => {
      if (page.viewportSize().width <= 1100) {
        await page.getByRole('button', { name: 'Open workspace navigation', exact: true }).click();
        await page.getByRole('navigation', { name: 'Mobile workspace tools' }).getByRole('button', { name: new RegExp('^' + name) }).click();
      } else await page.getByRole('navigation', { name: 'Workspace tools', exact: true }).getByRole('button', { name, exact: true }).click();
    };
    await page.goto(base + '/terminal', { waitUntil: 'domcontentloaded' });
    await page.locator('[data-testid="workspace-dock"][data-ready="true"]').waitFor({ timeout: 90000 });
    await nav('Strategy Developer');
    await page.getByText('ZTerminal Helper not connected', { exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Run Backtest', exact: true }).isDisabled(), true);
    steps.push('unpaired backtest is disabled');
    await page.getByLabel('Connection code', { exact: false }).fill(pairing.code);
    await page.getByRole('button', { name: 'Connect Helper', exact: true }).click();
    await page.getByText('ZTerminal Helper connected', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Run Backtest', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Run Backtest', exact: true }).click();
    await nav('Research');
    await page.getByRole('navigation', { name: 'Research report views' }).getByRole('button', { name: 'Validation', exact: true }).click();
    await page.getByRole('button', { name: '▶ Run Validation Battery', exact: true }).waitFor({ timeout: 90000 });
    steps.push('exact Python backtest completed in paired Helper');
    await page.getByText('Rolling windows and parameter sweep', { exact: true }).click();
    await page.getByLabel('Two-parameter sweep (3 × 3)', { exact: true }).check();
    await page.getByLabel('Select grid parameters using training return only in each rolling window', { exact: true }).check();
    await page.getByRole('button', { name: '▶ Run Validation Battery', exact: true }).click();
    await page.getByText('Validation Envelope', { exact: true }).waitFor({ timeout: 180000 });
    const parentId = await page.getByLabel('Open archived backtest').inputValue();
    const token = await page.evaluate(() => sessionStorage.getItem('zterminal.local-research.session-token'));
    const reportsResponse = await fetch(`http://127.0.0.1:47321/v1/results/${parentId}/validations`, { headers: { Origin: new URL(base).origin, Authorization: 'Bearer ' + token } });
    assert.equal(reportsResponse.status, 200);
    const [report] = await reportsResponse.json();
    assert.equal(report.sourceRunId, parentId);
    assert.equal(report.sensitivity.grid.length, 3);
    assert.ok(report.walkForward.cycles.length >= 2);
    assert.equal(report.profile.oosPersistence, 'inconclusive');
    steps.push('full battery persisted: chronological reruns, rolling training selection, measured grid, cost reruns, seeded MC, regimes, concentration');
    await page.getByRole('button', { name: '↻ Reproduce Run', exact: true }).click();
    await page.getByText('↻ Reproduced from ' + parentId.slice(0, 8) + '…', { exact: true }).waitFor({ timeout: 90000 });
    const reproducedId = await page.getByLabel('Open archived backtest').inputValue();
    const reproducedResponse = await fetch(`http://127.0.0.1:47321/v1/results/${reproducedId}`, { headers: { Origin: new URL(base).origin, Authorization: 'Bearer ' + token } });
    assert.equal(reproducedResponse.status, 200);
    const reproduced = await reproducedResponse.json();
    assert.equal(reproduced.reproducedFrom, parentId);
    assert.equal(reproduced.reproduction.status, 'matched');
    assert.equal(reproduced.source, fixture.source);
    assert.deepEqual(reproduced.params, fixture.params);
    steps.push('reproduction creates a hashed, persistent link to the original run');
    await page.getByLabel('Open archived backtest').selectOption(parentId);
    await page.getByText(report.id, { exact: true }).waitFor();
    const validationNav = page.getByRole('navigation', { name: 'Validation Views' });
    // Keep the configuration collapsed so evidence occupies the report panel.
    await page.getByText('Rolling windows and parameter sweep', { exact: true }).click();
    for (const tab of ['OOS', 'Walk Forward', 'Monte Carlo', 'Sensitivity', 'Costs', 'Regimes', 'Concentration', 'Diagnostics', 'Provenance']) {
      await validationNav.getByRole('button', { name: tab, exact: true }).click();
      await page.screenshot({ path: path.join(output, `desktop-${tab.replaceAll(' ', '-')}.png`), fullPage: false });
    }
    // Restart the real Helper against the same temporary archive. Pairing tokens
    // persist by origin; completed validation must survive process restart.
    const stop = new Promise(resolve => helper.once('exit', resolve));
    helper.kill();
    await stop;
    helper = spawn(python, ['research/desktop/server.py', '--data-dir', root], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
    helper.stderr.on('data', data => { helperError += data.toString(); });
    const restartDeadline = Date.now() + 15000;
    while (Date.now() < restartDeadline) {
      try { const response = await fetch('http://127.0.0.1:47321/v1/capabilities', { headers: { Origin: new URL(base).origin } }); if (response.ok) break; } catch {}
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.equal(helper.exitCode, null, helperError);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('[data-testid="workspace-dock"][data-ready="true"]').waitFor();
    await nav('Research');
    await page.getByLabel('Open archived backtest').selectOption(parentId);
    await page.getByRole('navigation', { name: 'Research report views' }).getByRole('button', { name: 'Validation', exact: true }).click();
    await page.getByText(report.id, { exact: true }).waitFor();
    steps.push('Helper restart, page reload and reopen displays identical archived artifact');
    await page.setViewportSize({ width: 390, height: 844 });
    await nav('Research');
    await page.getByRole('navigation', { name: 'Validation Views' }).getByRole('button', { name: 'Sensitivity', exact: true }).click();
    await page.locator('text=Parameter Neighborhood Heatmap').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(output, 'narrow-sensitivity.png') });
    assert.ok(await page.locator('text=Parameter Neighborhood Heatmap').isVisible());
    assert.deepEqual(errors, []);
    const disconnected = new Promise(resolve => helper.once('exit', resolve));
    helper.kill();
    await disconnected;
    await page.getByRole('button', { name: '↻ Re-run Battery', exact: true }).click();
    await page.getByText(/Cannot reach the local helper/).first().waitFor();
    assert.equal(await page.getByText('Validation Envelope', { exact: true }).count(), 0);
    steps.push('disconnected validation fails visibly without displaying new evidence');
    fs.writeFileSync(path.join(output, 'validation-summary.json'), JSON.stringify({ base, simulated: true, parentId, validationId: report.id, fingerprint: report.provenance.fingerprint, evidenceRuns: Object.keys(report.evidenceRuns).length, steps, errors, consoleErrors, network }, null, 2));
    console.log('PASS: ' + steps.join('; '));
    await context.close();
  } finally {
    if (browser) await browser.close();
    if (helper && helper.exitCode == null) { helper.kill(); await new Promise(resolve => helper.once('exit', resolve)); }
    // Only the exact temporary directory created above is removed.
    if (path.dirname(path.resolve(root)) === path.resolve(os.tmpdir()) && path.basename(root).startsWith('zt-validation-e2e-')) fs.rmSync(root, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
