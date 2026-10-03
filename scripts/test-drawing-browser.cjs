const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

// Uses exchange history through the app; does not seed or mock market candles.
async function main() {
  const output = path.resolve('artifacts/qa-drawings');
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const results = [], errors = [];
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(30000);
  page.setDefaultNavigationTimeout(120000);
  page.on('pageerror', error => errors.push(error.message));
  const drawings = () => page.evaluate(() => Object.values(JSON.parse(localStorage.getItem('zterminal.chart-documents') || '{}').state?.documents || {}).flatMap(document => document.drawings));
  const select = async (group, label) => {
    if (group) {
      await page.getByRole('button', { name: `More ${group}`, exact: true }).click();
      const item = page.getByRole('menuitem', { name: label, exact: true });
      await item.waitFor({ state: 'visible' });
      const rect = await item.boundingBox();
      const visible = await item.evaluate(el => { const r = el.getBoundingClientRect(); return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)); });
      assert.ok(rect.width > 100 && visible, `${label} flyout is visible and clickable`);
      await item.click();
    } else await page.getByRole('button', { name: label, exact: true }).click();
    await page.waitForFunction(label => document.querySelector(`.zt-drawing-toolbar button[aria-label="${label}"]`)?.getAttribute('aria-pressed') === 'true', label);
  };
  try {
    await page.goto((process.env.TERMINAL_URL || 'http://localhost:3000') + '/terminal', { waitUntil: 'domcontentloaded' });
    await page.locator('[data-testid="workspace-dock"][data-ready="true"]').waitFor({ timeout: 60000 });
    await page.locator('[data-testid="primary-chart"]').getByText('loading…', { exact: true }).waitFor({ state: 'hidden', timeout: 60000 });
    await page.waitForFunction(() => document.querySelector('.zt-chart-readout')?.textContent.includes('—') === false, null, { timeout: 60000 });
    const layer = page.getByLabel('Chart drawing interaction layer', { exact: true });
    const bounds = await layer.boundingBox();
    assert.ok(bounds && bounds.width > 200, 'real history and chart are available');
    const start = { x: bounds.x + bounds.width * .6, y: bounds.y + bounds.height * .35 };
    const end = { x: bounds.x + bounds.width - 90, y: bounds.y + bounds.height * .25 };
    const draw = async (click = false) => {
      await page.mouse.move(start.x, start.y);
      await page.mouse.down();
      if (!click) await page.mouse.move(end.x, end.y, { steps: 8 });
      await page.mouse.up();
    };
    const cases = [
      ['Trend Lines', 'Trend Line', 'trend-line'], ['Trend Lines', 'Ray', 'ray'], ['Trend Lines', 'Extended Line', 'extended-line'],
      ['Trend Lines', 'Horizontal Line', 'horizontal-line'], ['Trend Lines', 'Horizontal Ray', 'horizontal-ray'], ['Trend Lines', 'Vertical Line', 'vertical-line'],
      [null, 'Fibonacci Retracement', 'fibonacci-retracement'], ['Geometric Shapes', 'Rectangle', 'rectangle'], ['Geometric Shapes', 'Arrow Marker', 'arrow'],
      ['Annotation Tools', 'Text', 'text'], ['Annotation Tools', 'Price Label', 'price-label'],
      ['Prediction and Measurement', 'Long Position', 'long-position'], ['Prediction and Measurement', 'Short Position', 'short-position'],
      ['Prediction and Measurement', 'Price Range', 'price-range'], ['Prediction and Measurement', 'Date Range', 'date-range'], ['Prediction and Measurement', 'Ruler', 'ruler'],
    ];
    for (const [group, label, type] of cases) {
      const before = (await drawings()).length;
      await select(group, label);
      await draw();
      await page.waitForFunction(count => Object.values(JSON.parse(localStorage.getItem('zterminal.chart-documents')).state.documents).flatMap(d => d.drawings).length === count, before + 1);
      const latest = (await drawings()).at(-1);
      assert.equal(latest.type, type, `${label} creates correct drawing type`);
      await page.getByRole('toolbar', { name: 'Floating drawing settings bar', exact: true }).waitFor();
      results.push({ feature: label, status: 'passed', anchors: latest.anchors });
    }
    // Resize the position from its right border, as in the user's screenshot.
    for (const label of ['Long Position', 'Short Position']) {
      await select('Prediction and Measurement', label);
      await draw();
      const original = (await drawings()).at(-1);
      const edgeY = (start.y + end.y) / 2;
      await page.mouse.move(end.x, edgeY);
      await page.mouse.down();
      await page.mouse.move(end.x + 55, edgeY + 12, { steps: 8 });
      await page.mouse.up();
      const updated = (await drawings()).find(item => item.id === original.id);
      assert.deepEqual(updated.anchors[0], original.anchors[0], `${label} edge resize keeps entry fixed`);
      assert.equal(updated.anchors[1].price, original.anchors[1].price, `${label} edge resize keeps target fixed`);
      assert.equal(updated.style.stopPrice, original.style.stopPrice, `${label} edge resize keeps stop fixed`);
      assert.ok(updated.anchors[1].time > original.anchors[1].time, `${label} right edge extends into future`);
      results.push({ feature: `${label} right-edge resize`, status: 'passed' });
    }
    // Extend existing line/position endpoints further into empty future space.
    for (const [group, label, type] of [['Trend Lines', 'Trend Line', 'trend-line'], ['Prediction and Measurement', 'Long Position', 'long-position'], ['Prediction and Measurement', 'Short Position', 'short-position']]) {
      await select(group, label);
      await draw();
      const original = (await drawings()).at(-1);
      assert.equal(original.type, type);
      await page.mouse.move(end.x, end.y);
      await page.mouse.down();
      await page.mouse.move(end.x + 35, end.y, { steps: 8 });
      await page.mouse.up();
      const updated = (await drawings()).find(item => item.id === original.id);
      assert.ok(updated.anchors[1].time > original.anchors[1].time, `${label} endpoint extends further into future space`);
      results.push({ feature: `${label} future extension`, status: 'passed' });
    }
    // Pointer cancellation must abandon a create gesture.
    await select('Trend Lines', 'Trend Line');
    const beforeCancel = (await drawings()).length;
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: start.x, y: start.y }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: end.x, y: end.y }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
    assert.equal((await drawings()).length, beforeCancel);
    results.push({ feature: 'Pointer cancellation', status: 'passed' });
    // Keyboard flyout navigation and focus restoration.
    const more = page.getByRole('button', { name: 'More Prediction and Measurement', exact: true });
    await more.focus(); await more.press('Enter');
    await page.getByRole('menuitem', { name: 'Long Position', exact: true }).waitFor();
    assert.equal(await page.evaluate(() => document.activeElement.textContent.trim()), 'Long Position');
    await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
    assert.equal(await more.evaluate(el => el === document.activeElement), true);
    await page.waitForFunction(() => document.querySelector('.zt-drawing-toolbar button[aria-label="Short Position"]')?.getAttribute('aria-pressed') === 'true');
    results.push({ feature: 'Keyboard flyout selection', status: 'passed' });
    // Duplicate only once, including the bubbling keyboard shortcut path.
    await select('Cursor Tools', 'Arrow / Select');
    const beforeDuplicate = (await drawings()).length;
    await layer.focus(); await layer.press('Control+d');
    await page.waitForTimeout(100);
    assert.equal((await drawings()).length, beforeDuplicate + 1, 'Ctrl+D duplicates exactly once');
    results.push({ feature: 'Keyboard duplicate', status: 'passed' });
    await page.screenshot({ path: path.join(output, 'all-drawings-desktop.png') });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('.zt-drawing-toolbar').waitFor();
    assert.equal((await drawings()).length, beforeDuplicate + 1, 'drawings survive reload');
    results.push({ feature: 'Drawing persistence', status: 'passed' });
    await page.setViewportSize({ width: 390, height: 844 });
    await select('Prediction and Measurement', 'Short Position');
    await page.screenshot({ path: path.join(output, 'drawings-narrow.png') });
    results.push({ feature: 'Narrow drawing flyout', status: 'passed' });
    assert.deepEqual(errors, [], 'no uncaught browser errors');
  } catch (error) {
    results.push({ status: 'failed', error: error.stack });
    await page.screenshot({ path: path.join(output, 'drawing-failure.png') }).catch(() => {});
    throw error;
  } finally {
    fs.writeFileSync(path.join(output, 'drawing-browser-summary.json'), JSON.stringify({ results, errors }, null, 2));
    await browser.close();
  }
  console.log(`PASS: ${results.length} drawing browser checks`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
