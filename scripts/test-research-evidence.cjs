const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright');

async function main() {
  const result = JSON.parse(fs.readFileSync(process.argv[2] || 'out/research-evidence-result.json', 'utf8'));
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    // Fixture transport tests rendering/recovery only; no claim of live Helper pairing.
    await page.route('http://127.0.0.1:47321/v1/**', async route => {
      const path = new URL(route.request().url()).pathname;
      const body = path.endsWith('/capabilities') ? { protocol: 1, version: 'test-fixture', platform: 'windows-x64', activeJob: null }
        : path.endsWith('/results') ? [{ id: result.id, name: result.name, created: result.createdAt }]
          : path.endsWith(`/results/${result.id}`) ? result : [];
      await route.fulfill({ json: body, headers: { 'Access-Control-Allow-Origin': '*' } });
    });
    await page.goto((process.env.TERMINAL_URL || 'http://127.0.0.1:3100') + '/terminal');
    await page.locator('[data-testid="workspace-dock"][data-ready="true"]').waitFor({ timeout: 60000 });
    await page.getByRole('navigation', { name: 'Workspace tools', exact: true }).getByRole('button', { name: 'Strategy Developer', exact: true }).click();
    await page.locator('.monaco-editor').waitFor({ timeout: 45000 });
    await page.getByRole('navigation', { name: 'Workspace tools', exact: true }).getByRole('button', { name: 'Research', exact: true }).click();
    await page.getByRole('combobox', { name: 'Open archived backtest' }).selectOption(result.id);
    const evidence = page.getByRole('region', { name: 'Captured run evidence' });
    await evidence.waitFor();
    for (const name of ['Overview', 'Performance', 'Trades', 'Risk', 'Monte Carlo', 'Logs']) {
      await page.getByRole('navigation', { name: 'Research report views' }).getByRole('button', { name, exact: true }).click();
      assert.match(await evidence.innerText(), /closed candles; no missing timestamps/);
      assert.match(await evidence.innerText(), /Retrieved .*cached reuse/);
      assert.match(await evidence.innerText(), /Fees 0 bps per fill/);
      assert.match(await evidence.innerText(), /Completed-bar signals fill/);
    }
    await page.screenshot({ path: 'out/research-evidence-ui.png', fullPage: true });
    assert.deepEqual(errors, []);
    console.log('PASS: captured evidence, costs, freshness and fill assumptions visible on all six report tabs');
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
