const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const KEY = 'zt_workspace_layout_v2';
const required = ['chart', 'orderbook', 'research', 'strategy'];
async function verifyTerminal(baseURL, options = {}) {
  const browser = await chromium.launch({ headless: true });
  const results = [];
  const output = path.resolve(options.output || 'artifacts/terminal');
  fs.mkdirSync(output, { recursive: true });
  try {
    for (const viewport of [{ width: 1440, height: 900 }, { width: 768, height: 1024 }, { width: 390, height: 844 }]) {
      const context = await browser.newContext({ viewport, colorScheme: 'dark', reducedMotion: 'reduce' });
      const page = await context.newPage();
      page.setDefaultNavigationTimeout(90000);
      const fatal = [], consoleErrors = [];
      results.push({ viewport, consoleErrors, uncaught: fatal });
      page.on('pageerror', error => { fatal.push(error.stack || error.message); console.error('Uncaught:', error.message); });
      page.on('console', message => { if (message.type() === 'error') { consoleErrors.push(message.text()); if (/dockview/i.test(message.text())) fatal.push(message.text()); } });
      const ready = async () => {
        await page.locator('[data-testid="workspace-dock"][data-ready="true"]').waitFor({ timeout: 60000 });
        await page.locator('[data-testid="primary-chart"] canvas').first().waitFor({ state: 'attached', timeout: 60000 });
        await page.waitForFunction(() => document.querySelector('[data-testid="primary-chart"] canvas')?.width > 0);
      };
      const saved = async () => {
        await page.waitForFunction(key => { try { return JSON.parse(localStorage.getItem(key))?.grid?.root?.type === 'branch'; } catch { return false; } }, KEY);
        return page.evaluate(key => JSON.parse(localStorage.getItem(key)), KEY);
      };
      const nav = async (name) => {
        if (viewport.width <= 1100) {
          await page.getByRole('button', { name: 'Open workspace navigation', exact: true }).click();
          await page.getByRole('navigation', { name: 'Mobile workspace tools' }).getByRole('button', { name: new RegExp('^' + name) }).click();
          await page.locator('[data-slot="sheet-content"]').waitFor({ state: 'hidden' });
        } else await page.getByRole('navigation', { name: 'Workspace tools', exact: true }).getByRole('button', { name, exact: true }).click();
      };
      const reset = async () => {
        if (viewport.width <= 1100) {
          await page.getByRole('button', { name: 'Open workspace navigation', exact: true }).click();
          await page.getByRole('button', { name: 'Reset workspace layout', exact: true }).click();
        } else { const button = page.getByRole('button', { name: 'Reset Layout', exact: true }); await button.focus(); await button.press('Enter'); }
        await ready();
        await page.waitForFunction(key => Object.keys(JSON.parse(localStorage.getItem(key) || '{}').panels || {}).length === 4, KEY);
      };
      const response = await page.goto(baseURL + '/terminal', { waitUntil: 'domcontentloaded' });
      assert.equal(response.status(), 200);
      await ready();
      const initial = await saved();
      assert.deepEqual(Object.keys(initial.panels).sort(), [...required].sort());
      if (viewport.width > 900) {
        await page.locator('[data-panel-id="orderbook"]').waitFor({ state: 'visible' });
        await page.locator('[data-panel-id="research"]').waitFor({ state: 'visible' });
        const workspace = await page.locator('[data-testid="workspace-dock"]').boundingBox();
        const chart = await page.locator('[data-panel-id="chart"]').boundingBox();
        assert.ok(chart.width / workspace.width > .65 && chart.width / workspace.width < .75, 'chart should occupy about 70%');
      }
      for (const [name, id] of [['Indicators', 'indicators'], ['Strategy Developer', 'strategy'], ['Research', 'research'], ['Market Context', 'orderbook'], ['Calendar', 'calendar'], ['Settings', 'settings'], ['Chart', 'chart']]) {
        await nav(name);
        await page.locator('[data-panel-id="' + id + '"]').waitFor({ state: 'visible' });
        assert.equal(await page.locator('.zt-sidebar-tool[aria-label="' + name + '"]').getAttribute('aria-current'), 'page', 'navigation tracks active Dockview panel');
        await page.waitForFunction(id => document.querySelector('[data-tab-panel-id="' + id + '"]')?.getAttribute('aria-selected') === 'true', id);
        if (id === 'strategy') await page.locator('[data-panel-id="strategy"] .monaco-editor').waitFor({ timeout: 45000 });
        if (viewport.width <= 900) {
          const bounds = await page.locator('[data-panel-id="' + id + '"]').boundingBox();
          assert.ok(bounds.width >= viewport.width - 8, id + ' must fill narrow workspace');
        }
      }
      // Reopening must focus the existing tab, never add a duplicate.
      await nav('Indicators'); await nav('Indicators');
      assert.equal(await page.locator('[data-tab-panel-id="indicators"]').count(), 1);
      await page.waitForFunction(key => Boolean(JSON.parse(localStorage.getItem(key) || '{}').panels?.indicators), KEY);
      if (viewport.width > 900) {
        const chart = await page.locator('[data-panel-id="chart"]').boundingBox();
        await page.mouse.move(chart.x + chart.width, chart.y + chart.height / 2);
        await page.mouse.down();
        await page.mouse.move(chart.x + chart.width - 90, chart.y + chart.height / 2, { steps: 8 });
        await page.mouse.up();
        await page.waitForTimeout(350);
        const resized = await page.locator('[data-panel-id="chart"]').boundingBox();
        assert.ok(resized.width < chart.width - 50, 'divider resizes chart');
      }
      const before = await saved();
      await page.reload(); await ready();
      const after = await saved();
      for (const key of Object.keys(before.panels)) {
        assert.ok(Object.hasOwn(after.panels, key), `Missing panel ${key} after reload`);
      }
      await reset();
      // Wait for history to settle; an honest unavailable state is also valid.
      await page.locator('[data-testid="primary-chart"]').getByText('loading…', { exact: true }).waitFor({ state: 'hidden', timeout: 60000 });
      await page.screenshot({ path: path.join(output, 'terminal-' + viewport.width + '.png') });
      for (const corrupt of ['{', JSON.stringify({ grid: { root: { type: 'splitview', views: [] } } }), JSON.stringify({ ...initial, grid: { ...initial.grid, root: { type: 'branch', data: 'invalid' } } }), JSON.stringify({ ...initial, panels: { ...initial.panels, chart: undefined } }), JSON.stringify({ ...initial, panels: { ...initial.panels, chart: { id: 'chart', contentComponent: 'unknown' } } })]) {
        // Seed in a fresh document before app code so pagehide cannot overwrite it.
        await page.goto(baseURL + '/healthz');
        await page.evaluate(({ key, value }) => localStorage.setItem(key, value), { key: KEY, value: corrupt });
        await page.goto(baseURL + '/terminal'); await ready();
        const savedPanels = (await saved()).panels;
        assert.ok(required.every(id => Object.hasOwn(savedPanels, id)));
      }
      await nav('Chart');
      // Command palette must target the same controller.
      await page.keyboard.press('Control+k');
      await page.getByPlaceholder('Search symbols, views, actions…').fill('Open Indicators');
      await page.getByRole('option', { name: /Open Indicators/ }).click();
      await page.locator('[data-panel-id="indicators"]').waitFor({ state: 'visible' });
      await reset();

      assert.deepEqual(fatal, [], 'uncaught exceptions or Dockview errors at ' + viewport.width);
      console.log('PASS terminal ' + viewport.width + ': panels, navigation, persistence, corruption, reset, command palette');
      await context.close();
    }
  } finally { fs.writeFileSync(path.join(output, 'terminal-summary.json'), JSON.stringify(results, null, 2)); await browser.close(); }
  return results;
}
module.exports = { verifyTerminal };
if (require.main === module) verifyTerminal(process.env.TERMINAL_URL || 'http://localhost:3000').catch(error => { console.error(error); process.exitCode = 1; });
