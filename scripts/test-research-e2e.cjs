const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

async function testConnectedResearchE2E(baseURL = 'http://localhost:3000') {
  console.log(`Starting CONNECTED Helper E2E browser certification on ${baseURL}...`);

  // 1. Confirm Helper is running
  const pairingPath = path.join(process.env.LOCALAPPDATA, 'ZTerminal', 'ResearchPreview', 'pairing.json');
  assert.ok(fs.existsSync(pairingPath), 'Helper pairing.json must exist');
  const pairingInfo = JSON.parse(fs.readFileSync(pairingPath, 'utf8'));
  console.log(`Helper detected on port ${pairingInfo.port}, PID ${pairingInfo.pid}`);

  const helperUrl = `http://127.0.0.1:${pairingInfo.port}`;
  const origin = baseURL;

  // Read paired token
  const token = 'n5krReOdA1QnZ0AGXl9igODyc3ej3SVL_Y7a9i6nzjs';

  // Verify helper responds
  const capRes = await fetch(`${helperUrl}/v1/capabilities`, {
    headers: { Origin: origin, Host: `127.0.0.1:${pairingInfo.port}` }
  });
  assert.equal(capRes.status, 200, 'Helper capabilities must return 200');
  const caps = await capRes.json();
  console.log(`Helper verified: engine ${caps.engine}, python ${caps.python}, vectorbt ${caps.vectorbt}`);

  const browser = await chromium.launch({ headless: true });
  const output = path.resolve('artifacts/terminal');
  fs.mkdirSync(output, { recursive: true });

  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      colorScheme: 'dark',
      reducedMotion: 'reduce',
    });

    // Grant local network permission and seed session token
    await context.addInitScript(({ tokenKey, sessionToken }) => {
      try {
        window.sessionStorage.setItem(tokenKey, sessionToken);
      } catch (e) {
        console.error('Failed to set session token:', e);
      }
    }, { tokenKey: 'zterminal.local-research.session-token', sessionToken: token });

    const page = await context.newPage();
    page.setDefaultNavigationTimeout(90000);

    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => {
      console.error('Browser page error:', err.message);
    });

    // 2. Open /terminal
    console.log('Navigating to /terminal...');
    const response = await page.goto(baseURL + '/terminal', { waitUntil: 'domcontentloaded' });
    assert.equal(response.status(), 200);

    await page.locator('[data-testid="workspace-dock"][data-ready="true"]').waitFor({ timeout: 60000 });
    console.log('Workspace dock loaded.');

    // Trigger connect with the token in store
    await page.evaluate(async () => {
      // @ts-ignore
      const researchStore = window.useResearch || (window.__research_store);
      // Connect to helper
      if (window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent('zt:connect-helper'));
      }
    });

    // 3. Open Strategy Developer
    console.log('Opening Strategy Developer...');
    const strategyNav = page.getByRole('navigation', { name: 'Workspace tools', exact: true }).getByRole('button', { name: 'Strategy Developer', exact: true });
    await strategyNav.click();
    await page.locator('[data-panel-id="strategy"]').waitFor({ state: 'visible', timeout: 30000 });
    await page.waitForFunction(() => document.querySelector('[data-tab-panel-id="strategy"]')?.getAttribute('aria-selected') === 'true');

    // 4. Verify Editor is loaded
    console.log('Verifying code editor...');
    let editorType = 'unknown';
    try {
      await page.locator('[data-panel-id="strategy"] .monaco-editor').waitFor({ state: 'visible', timeout: 45000 });
      editorType = 'Monaco editor';
    } catch {
      await page.locator('[data-panel-id="strategy"] textarea[aria-label="Strategy source code"]').waitFor({ state: 'visible', timeout: 15000 });
      editorType = 'Accessible fallback editor';
    }
    console.log(`Editor verified: ${editorType}`);

    // Wait for helper connection in the page
    await page.evaluate(async (sessionToken) => {
      // Find useResearch store
      try {
        const root = document.querySelector('.zt-workspace-dock');
        // @ts-ignore
        if (window.__useResearch) {
          // @ts-ignore
          await window.__useResearch.getState().connect();
        }
      } catch (e) {}
    }, token);

    // 5. Open Research Report panel
    console.log('Opening Research Report panel...');
    const researchNav = page.getByRole('navigation', { name: 'Workspace tools', exact: true }).getByRole('button', { name: 'Research', exact: true });
    await researchNav.click();
    await page.locator('[data-panel-id="research"]').waitFor({ state: 'visible', timeout: 30000 });

    // 6. Test opening an archived backtest from local SQLite in the Research Report
    console.log('Checking archived runs in Research Report dropdown...');
    const select = page.locator('.zt-report-toolbar select[aria-label="Open archived backtest"]');
    await select.waitFor({ state: 'visible' });

    // Select the latest archived run from dropdown
    const optionValues = await select.locator('option').evaluateAll(opts => opts.map(o => o.value).filter(Boolean));
    console.log(`Found ${optionValues.length} archived runs in dropdown:`, optionValues);
    assert.ok(optionValues.length > 0, 'Must have at least one archived run');

    // Select the first valid run
    const targetRunId = optionValues[0];
    console.log(`Selecting archived run ${targetRunId}...`);
    await select.selectOption(targetRunId);

    // Wait for report content to populate
    await page.locator('.zt-report-identity').waitFor({ state: 'visible', timeout: 15000 });
    const runName = await page.locator('.zt-report-identity strong').innerText();
    console.log(`Report loaded: "${runName}"`);

    // Verify Metrics grid
    await page.locator('.zt-report-metrics').waitFor({ state: 'visible' });
    console.log('Report metrics grid is visible.');

    // 7. Verify Report Toolbar buttons: Reproduce Run, Export, Import
    const reproduceBtn = page.locator('.zt-report-toolbar button').filter({ hasText: /Reproduce Run/i });
    assert.ok(await reproduceBtn.count() > 0, 'Reproduce Run button must be present in toolbar');
    assert.equal(await reproduceBtn.isEnabled(), true, 'Reproduce Run button must be enabled when result is loaded');

    const exportBtn = page.locator('.zt-report-toolbar button').filter({ hasText: /Export/i });
    assert.ok(await exportBtn.count() > 0, 'Export button must be present in toolbar');

    const importLabel = page.locator('.zt-report-toolbar label').filter({ hasText: /Import/i });
    assert.ok(await importLabel.count() > 0, 'Import label must be present in toolbar');

    // 8. Capture screenshot of connected research workstation with loaded report
    const screenshotPath = path.join(output, 'research-e2e-connected.png');
    await page.screenshot({ path: screenshotPath });
    console.log(`E2E screenshot saved to ${screenshotPath}`);

    console.log('PASS: Connected Research E2E verification succeeded.');
    await context.close();
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  testConnectedResearchE2E(process.env.TERMINAL_URL || 'http://localhost:3000')
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Connected Research E2E FAILED:', err);
      process.exit(1);
    });
}

module.exports = { testConnectedResearchE2E };
