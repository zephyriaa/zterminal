const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

async function verifyResearchFlow(baseURL = 'http://localhost:3000') {
  console.log(`Starting Research Core verification on ${baseURL}...`);
  const browser = await chromium.launch({ headless: true });
  const output = path.resolve('artifacts/terminal');
  fs.mkdirSync(output, { recursive: true });

  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      colorScheme: 'dark',
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    page.setDefaultNavigationTimeout(90000);

    const consoleErrors = [];
    const uncaught = [];
    page.on('pageerror', err => {
      uncaught.push(err.message);
      console.error('Page error:', err.message);
    });
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // 1. Navigate to terminal
    console.log('Navigating to /terminal...');
    const response = await page.goto(baseURL + '/terminal', { waitUntil: 'domcontentloaded' });
    assert.equal(response.status(), 200, 'Terminal page responded with 200');

    // Wait for dock to be ready
    await page.locator('[data-testid="workspace-dock"][data-ready="true"]').waitFor({ timeout: 60000 });
    console.log('Workspace dock is ready.');

    // 2. Open Strategy Developer panel
    console.log('Opening Strategy Developer...');
    const strategyNav = page.getByRole('navigation', { name: 'Workspace tools', exact: true }).getByRole('button', { name: 'Strategy Developer', exact: true });
    await strategyNav.click();
    await page.locator('[data-panel-id="strategy"]').waitFor({ state: 'visible', timeout: 30000 });
    await page.waitForFunction(() => document.querySelector('[data-tab-panel-id="strategy"]')?.getAttribute('aria-selected') === 'true');

    // 3. Verify editor loaded (Monaco or accessible fallback editor)
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

    // Verify NOT stuck on "Loading Python editor…"
    const loadingText = await page.locator('[data-panel-id="strategy"]').getByText('Loading Python editor…').isVisible().catch(() => false);
    assert.equal(loadingText, false, 'Editor is not stuck on loading spinner');

    // 4. Inspect Strategy Developer controls and Run button
    console.log('Verifying Run button...');
    const runButton = page.locator('[data-panel-id="strategy"] button').filter({ hasText: /Run/i }).first();
    await runButton.waitFor({ state: 'visible' });

    // 5. Test Run Backtest fail-closed behavior (helper disconnected)
    console.log('Verifying fail-closed state when helper is disconnected...');
    const isDisabled = await runButton.isDisabled();
    assert.ok(isDisabled, 'Run button must be disabled when local Python helper is not paired');
    const ariaDescribedBy = await runButton.getAttribute('aria-describedby');
    assert.equal(ariaDescribedBy, 'helper-backtest-unavailable', 'Button must describe helper unreachability');
    const unavailableEl = page.locator('#helper-backtest-unavailable');
    if (await unavailableEl.count() > 0) {
      const guidance = await unavailableEl.innerText();
      console.log(`Guidance displayed: "${guidance}"`);
    }

    // 6. Open Research Report panel
    console.log('Opening Research Report panel...');
    const researchNav = page.getByRole('navigation', { name: 'Workspace tools', exact: true }).getByRole('button', { name: 'Research', exact: true });
    if (await researchNav.isVisible()) {
      await researchNav.click();
    }
    await page.locator('[data-panel-id="research"]').waitFor({ state: 'visible', timeout: 30000 });

    // 7. Verify Research Report Toolbar
    console.log('Verifying Research Report Toolbar...');
    const toolbar = page.locator('.zt-report-toolbar');
    await toolbar.waitFor({ state: 'visible' });

    // Verify Reproduce Run button exists in toolbar
    const reproduceBtn = toolbar.locator('button').filter({ hasText: /Reproduce Run/i });
    assert.ok(await reproduceBtn.count() > 0, 'Toolbar must include "Reproduce Run" button');

    // Verify Export and Import buttons
    const exportBtn = toolbar.locator('button').filter({ hasText: /Export/i });
    assert.ok(await exportBtn.count() > 0, 'Toolbar must include "Export" button');
    const importLabel = toolbar.locator('label').filter({ hasText: /Import/i });
    assert.ok(await importLabel.count() > 0, 'Toolbar must include "Import" label');

    // 8. Capture screenshot
    const screenshotPath = path.join(output, 'research-core-verified.png');
    await page.screenshot({ path: screenshotPath });
    console.log(`Screenshot saved to ${screenshotPath}`);

    console.log('PASS: Research Core end-to-end browser verification succeeded.');
    await context.close();
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  verifyResearchFlow(process.env.TERMINAL_URL || 'http://localhost:3000')
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Research verification failed:', err);
      process.exit(1);
    });
}

module.exports = { verifyResearchFlow };
