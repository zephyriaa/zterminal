const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const baseURL = process.env.TERMINAL_URL || 'http://localhost:3000';

async function verifyDrawings() {
  let browser;
  const output = path.resolve('artifacts/drawings'); fs.mkdirSync(output, { recursive: true });
  const results = [];
  try {
    for (const deviceScaleFactor of [1, 2]) {
      // Native scaling also drives ResizeObserver device-pixel boxes on Windows.
      browser = await chromium.launch({ headless: true, args: [`--force-device-scale-factor=${deviceScaleFactor}`] });
      const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor, hasTouch: true });
      // Deterministic candles avoid depending on a live exchange during interaction tests.
      await context.route('**/api/bars?*', route => {
        const interval = ({ '1m': 60000, '5m': 300000, '15m': 900000, '1h': 3600000 })[new URL(route.request().url()).searchParams.get('tf')] || 300000;
        const bars = Array.from({ length: 300 }, (_, i) => ({ t: 1780000000000 + i * interval, o: 100 + i * .05, h: 102 + i * .05, l: 98 + i * .05, c: 100 + Math.sin(i / 5) + i * .05, v: 100 }));
        return route.fulfill({ json: { bars } });
      });
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(baseURL + '/terminal', { waitUntil: 'domcontentloaded' });
      const chart = page.locator('[data-drawing-chart="primary"]');
      await chart.locator('canvas').first().waitFor();
      const read = () => page.evaluate(() => Object.values(JSON.parse(localStorage.getItem('zterminal.chart-documents') || '{"state":{"documents":{}}}').state.documents).find(d => d.chartId === 'primary-chart')?.drawings || []);
      const count = async n => { await page.waitForFunction(n => Object.values(JSON.parse(localStorage.getItem('zterminal.chart-documents') || '{"state":{"documents":{}}}').state.documents).find(d => d.chartId === 'primary-chart')?.drawings.length === n, n); };
      const box = await chart.locator('.zt-drawing-input').boundingBox();
      const at = (x, y) => ({ x: box.x + x, y: box.y + y });
      const click = async (x, y, options) => { const p = at(x, y); await page.mouse.click(p.x, p.y, options); };
      const drag = async (x, y, dx, dy) => { const p = at(x, y); await page.mouse.move(p.x, p.y); await page.mouse.down(); await page.mouse.move(p.x + dx, p.y + dy, { steps: 10 }); await page.mouse.up(); };
      const tool = async (name, group) => {
        const button = chart.getByRole('button', { name, exact: true });
        if (await button.count()) await button.click();
        else { await chart.locator('.zt-tool-group-btn').nth(group).click({ button: 'right' }); await page.getByRole('menuitem', { name, exact: true }).click(); }
      };
      await tool('Trend Line', 1); await click(200, 150); await page.mouse.move(at(400, 250).x, at(400, 250).y); await click(400, 250); await count(1);
      const original = (await read())[0];
      await drag(300, 200, 40, 30);
      const moved = (await read())[0];
      assert.notDeepEqual(moved.anchors, original.anchors, 'whole-line drag changes market anchors');
      assert.ok(Math.abs((moved.anchors[1].time - moved.anchors[0].time) - (original.anchors[1].time - original.anchors[0].time)) < 1);
      await chart.getByRole('button', { name: 'Undo drawing', exact: true }).click();
      assert.deepEqual((await read())[0].anchors, original.anchors, 'drag is one history entry');
      await chart.getByRole('button', { name: 'Redo drawing', exact: true }).click();
      await drag(240, 180, 20, -30);
      assert.notEqual((await read())[0].anchors[0].price, moved.anchors[0].price, 'endpoint drag edits one anchor');
      await chart.getByRole('button', { name: 'Undo drawing', exact: true }).click();
      await chart.getByRole('button', { name: 'Undo drawing', exact: true }).click();
      await click(300, 200); await page.keyboard.press('Control+c'); await page.keyboard.press('Control+v'); await count(2);
      await page.keyboard.press('Control+z'); await count(1); await page.keyboard.press('Control+Shift+z'); await count(2);
      await page.keyboard.press('Delete'); await count(1);
      await click(300, 200, { button: 'right' }); await chart.getByRole('menuitem', { name: 'Duplicate', exact: true }).click(); await count(2);
      await chart.getByRole('button', { name: 'Undo drawing', exact: true }).click(); await count(1);
      await click(300, 200);
      const cancelStart = at(300, 200);
      await page.mouse.move(cancelStart.x, cancelStart.y); await page.mouse.down(); await page.mouse.move(cancelStart.x + 40, cancelStart.y + 30, { steps: 5 });
      assert.deepEqual((await read())[0].anchors, original.anchors, 'live preview never persists intermediate drag pixels');
      await chart.locator('.zt-drawing-input').dispatchEvent('pointercancel', { pointerId: 1, isPrimary: true }); await page.mouse.up();
      assert.deepEqual((await read())[0].anchors, original.anchors, 'cancelled edit rolls back');
      await drag(300, 200, 800, 0);
      assert.notDeepEqual((await read())[0].anchors, original.anchors, 'pointer capture continues beyond chart bounds');
      await chart.getByRole('button', { name: 'Undo drawing', exact: true }).click();
      await tool('Trend Line', 1); await click(450, 300); await page.keyboard.press('Escape'); await count(1);
      await tool('Trend Line', 1); await click(450, 300); await click(500, 350, { button: 'right' }); await count(1);
      await tool('Trend Line', 1); await click(450, 300);
      await chart.locator('.zt-drawing-input').dispatchEvent('pointercancel', { pointerId: 1, isPrimary: true }); await count(1);
      await page.keyboard.press('Escape');
      let expected = 1;
      for (const [name, group, anchors] of [
        ['Horizontal Line', 1, [[260, 350]]], ['Vertical Line', 1, [[480, 350]]],
        ['Rectangle', 3, [[250, 400], [380, 500]]], ['Ray', 1, [[450, 400], [550, 450]]],
        ['Ellipse', 3, [[580, 180], [720, 280]]], ['Parallel Channel', 1, [[400, 500], [530, 480], [490, 550]]],
        ['Fibonacci Retracement', 2, [[250, 200], [380, 300]]], ['Fibonacci Extension', 2, [[420, 200], [520, 300], [480, 330]]],
        ['Long Position', 5, [[480, 350], [580, 290]]], ['Short Position', 5, [[580, 350], [680, 390]]],
        ['Extended Line', 1, [[300, 450], [450, 490]]], ['Horizontal Ray', 1, [[650, 300], [750, 300]]], ['Cross Line', 1, [[760, 350]]],
        ['Arrow Marker', 3, [[600, 430], [650, 480]]], ['Price Label', 4, [[700, 510]]],
        ['Price Range', 5, [[650, 520], [740, 570]]], ['Date Range', 5, [[680, 510], [720, 550]]], ['Ruler', 5, [[550, 580], [700, 620]]],
        ['Callout / Note', 4, [[780, 560]]],
        ['Text', 4, [[220, 560]]],
      ]) {
        await page.keyboard.press('Escape'); await tool(name, group);
        for (const [x, y] of anchors) await click(x, y);
        try { await count(++expected); }
        catch (error) { await page.screenshot({ path: path.join(output, 'failed-tool.png') }); throw new Error(`${name}: expected ${expected}, received ${(await read()).length}`, { cause: error }); }
      }
      const textInput = chart.getByLabel('Text Label');
      await textInput.fill('Research note'); await textInput.blur();
      assert.equal((await read()).at(-1).style.text, 'Research note');
      await page.keyboard.press('Escape');
      await tool('Path / Polyline', 3); await click(300, 580); await click(400, 600); await click(500, 560); await page.keyboard.press('Enter'); await count(++expected);
      // Use the object list to select a specific drawing despite later overlapping tools.
      await chart.getByRole('button', { name: 'Drawing objects', exact: true }).click();
      await chart.locator(`[data-drawing-id="${original.id}"]`).getByRole('button', { name: /^Lock / }).click();
      await chart.locator(`[data-drawing-id="${original.id}"]`).getByRole('button', { name: 'Trend line', exact: true }).click();
      await chart.getByRole('button', { name: 'Close drawing objects', exact: true }).click();
      const locked = (await read()).find(d => d.locked); assert.ok(locked);
      await page.keyboard.press('Delete'); await count(expected);
      await chart.getByRole('button', { name: 'Drawing objects', exact: true }).click();
      const lockedRow = chart.locator(`[data-drawing-id="${locked.id}"]`);
      await lockedRow.getByRole('button', { name: /^Hide / }).click();
      assert.equal((await read()).find(d => d.id === locked.id).hidden, true);
      await lockedRow.getByRole('button', { name: /^Show / }).click();
      await chart.getByRole('button', { name: 'Close drawing objects', exact: true }).click();
      await page.keyboard.press('Escape');
      await page.mouse.move(at(750, 600).x, at(750, 600).y);
      const canvas = chart.locator('canvas').first();
      const beforePan = await canvas.evaluate(el => el.toDataURL());
      await drag(740, 600, -90, 0); await page.mouse.move(10, 10);
      assert.notEqual(await canvas.evaluate(el => el.toDataURL()), beforePan, 'empty chart space pans');
      const beforeZoom = await canvas.evaluate(el => el.toDataURL());
      await page.mouse.move(at(600, 400).x, at(600, 400).y); await page.mouse.wheel(0, -240); await page.mouse.move(10, 10);
      await page.waitForTimeout(250);
      assert.notEqual(await canvas.evaluate(el => el.toDataURL()), beforeZoom, 'wheel zoom remains available');
      const persisted = await read();
      await page.reload({ waitUntil: 'domcontentloaded' }); await chart.locator('canvas').first().waitFor(); await count(expected);
      assert.deepEqual(await read(), persisted, 'reload preserves market geometry and properties');
      await page.setViewportSize({ width: 1280, height: 900 });
      await chart.locator('canvas').first().waitFor();
      assert.deepEqual(await read(), persisted, 'resize preserves semantic anchors');
      await page.setViewportSize({ width: 1440, height: 1000 });
      await Promise.all([
        page.waitForResponse(response => response.url().includes('/api/bars?') && new URL(response.url()).searchParams.get('tf') === '15m'),
        page.locator('.zt-chart-timeframes').getByRole('button', { name: '15m', exact: true }).click(),
      ]);
      assert.deepEqual(await read(), persisted, 'timeframe changes preserve timestamps and prices');
      // Returning to a timeframe can legitimately use the existing candle cache.
      await page.locator('.zt-chart-timeframes').getByRole('button', { name: '5m', exact: true }).click();
      await page.getByRole('button', { name: 'Bar replay', exact: true }).click();
      await chart.getByText('Replay 181/300', { exact: true }).waitFor();
      await chart.getByRole('button', { name: 'Magnet off. Change snap mode', exact: true }).click();
      await chart.getByRole('button', { name: 'Magnet weak. Change snap mode', exact: true }).click();
      await tool('Horizontal Line', 1); await click(780, 250); await count(++expected);
      assert.ok((await read()).at(-1).anchors[0].time <= 1780000000000 + 180 * 300000, 'strong magnet cannot snap to replay-hidden candles');
      await page.getByRole('button', { name: 'Exit replay', exact: true }).click();
      await chart.getByRole('button', { name: 'Magnet strong. Change snap mode', exact: true }).click();
      await chart.getByRole('button', { name: 'Keep drawing tool active', exact: true }).click();
      await tool('Horizontal Line', 1); await click(740, 620); await count(++expected); await click(740, 650); await count(++expected);
      await chart.getByRole('button', { name: 'Keep drawing tool active', exact: true }).click(); await page.keyboard.press('Escape');
      // Save and load through the real command palette, rather than injecting store state.
      await page.keyboard.press('Control+k'); await page.getByPlaceholder('Search symbols, views, actions…').fill('save workspace');
      page.once('dialog', dialog => dialog.accept('Drawing regression'));
      await page.getByRole('option', { name: 'Save current workspace', exact: true }).click();
      await page.keyboard.press('Control+k'); await page.getByPlaceholder('Search symbols, views, actions…').fill('Drawing regression');
      await page.getByRole('option', { name: 'Open workspace: Drawing regression', exact: true }).click();
      const savedRead = () => page.evaluate(() => {
        const workspaceId = JSON.parse(localStorage.getItem('zterminal-workspace')).state.activeWorkspaceId;
        return Object.values(JSON.parse(localStorage.getItem('zterminal.chart-documents')).state.documents).find(d => d.workspaceId === workspaceId && d.chartId === 'primary-chart')?.drawings;
      });
      assert.equal((await savedRead()).length, expected, 'named workspace restores drawings');
      await tool('Horizontal Line', 1); await click(700, 620);
      await page.waitForFunction(n => {
        const workspaceId = JSON.parse(localStorage.getItem('zterminal-workspace')).state.activeWorkspaceId;
        return Object.values(JSON.parse(localStorage.getItem('zterminal.chart-documents')).state.documents).find(d => d.workspaceId === workspaceId && d.chartId === 'primary-chart')?.drawings.length === n;
      }, expected + 1);
      assert.equal((await read()).length, expected, 'editing saved workspace leaves source workspace unchanged');
      expected++;
      await page.reload({ waitUntil: 'domcontentloaded' }); await chart.locator('canvas').first().waitFor(); assert.equal((await savedRead()).length, expected, 'named workspace survives reload');
      await tool('Trend Line', 1);
      await page.touchscreen.tap(at(650, 150).x, at(650, 150).y); await page.touchscreen.tap(at(730, 200).x, at(730, 200).y);
      expected++;
      await page.waitForFunction(n => {
        const workspaceId = JSON.parse(localStorage.getItem('zterminal-workspace')).state.activeWorkspaceId;
        return Object.values(JSON.parse(localStorage.getItem('zterminal.chart-documents')).state.documents).find(d => d.workspaceId === workspaceId && d.chartId === 'primary-chart')?.drawings.length === n;
      }, expected);
      await page.waitForFunction(dpr => {
        const canvas = document.querySelector('[data-drawing-chart="primary"] canvas');
        return canvas && Math.abs(canvas.width / canvas.getBoundingClientRect().width - dpr) < .05;
      }, deviceScaleFactor);
      const dpr = await canvas.evaluate(el => ({ css: el.getBoundingClientRect().width, bitmap: el.width }));
      assert.ok(Math.abs(dpr.bitmap / dpr.css - deviceScaleFactor) < .05, 'chart primitive uses high-DPI backing canvas');
      await page.screenshot({ path: path.join(output, `drawings-dpr-${deviceScaleFactor}.png`) });
      await page.locator('button[title="Multi-Chart Layout Grid"]').click();
      await page.getByRole('button', { name: '2 Split (Side-by-Side)', exact: true }).click();
      const secondary = page.locator('[data-drawing-chart="pane-1"]'); await secondary.locator('canvas').first().waitFor();
      await secondary.getByRole('button', { name: 'Trend Line', exact: true }).click({ button: 'right' });
      await page.getByRole('menuitem', { name: 'Horizontal Line', exact: true }).click();
      const secondaryBox = await secondary.locator('.zt-drawing-input').boundingBox();
      await page.mouse.click(secondaryBox.x + 170, secondaryBox.y + 250);
      const readSecondary = symbol => page.evaluate(symbol => {
        const workspaceId = JSON.parse(localStorage.getItem('zterminal-workspace')).state.activeWorkspaceId;
        return Object.values(JSON.parse(localStorage.getItem('zterminal.chart-documents')).state.documents).find(d => d.workspaceId === workspaceId && d.chartId === 'pane-1' && d.instrument.nativeSymbol === symbol)?.drawings || [];
      }, symbol);
      assert.equal((await readSecondary('ETHUSDT')).length, 1); assert.equal((await savedRead()).length, expected, 'secondary drawing never enters primary document');
      await secondary.getByRole('button', { name: 'Undo drawing', exact: true }).click(); assert.equal((await readSecondary('ETHUSDT')).length, 0);
      await secondary.getByRole('button', { name: 'Redo drawing', exact: true }).click(); assert.equal((await readSecondary('ETHUSDT')).length, 1);
      const paneHeader = secondary.locator('..').locator('..').locator('select').first();
      await paneHeader.selectOption('SOLUSDT'); await secondary.locator('canvas').first().waitFor();
      assert.equal((await readSecondary('SOLUSDT')).length, 0, 'new symbol has no previous-symbol drawings');
      await paneHeader.selectOption('ETHUSDT'); assert.equal((await readSecondary('ETHUSDT')).length, 1, 'returning symbol restores its document');
      await page.screenshot({ path: path.join(output, `multi-chart-dpr-${deviceScaleFactor}.png`) });
      const beforeScale = await savedRead();
      await page.locator('button[title="Chart settings"]').click();
      await page.getByRole('tab', { name: 'Scales', exact: true }).click();
      await page.getByLabel(/^Price scale/).selectOption('logarithmic');
      await page.getByLabel('Invert price scale', { exact: true }).check();
      assert.deepEqual(await savedRead(), beforeScale, 'logarithmic and inverted price scales retain market geometry');
      await page.screenshot({ path: path.join(output, `log-invert-dpr-${deviceScaleFactor}.png`) });
      await page.getByLabel('Invert price scale', { exact: true }).uncheck();
      await page.getByLabel(/^Price scale/).selectOption('normal');
      let stress;
      if (deviceScaleFactor === 1) {
        // Seed a real semantic document through its public persistence contract.
        await page.evaluate(() => {
          const workspaceId = JSON.parse(localStorage.getItem('zterminal-workspace')).state.activeWorkspaceId;
          const persisted = JSON.parse(localStorage.getItem('zterminal.chart-documents'));
          const document = Object.values(persisted.state.documents).find(d => d.workspaceId === workspaceId && d.chartId === 'primary-chart');
          const source = document.drawings.find(d => d.type === 'trend-line');
          document.drawings = Array.from({ length: 1000 }, (_, i) => ({ ...source, id: `stress-${i}`, locked: false, hidden: false, zOrder: i, anchors: source.anchors.map(a => ({ ...a, price: a.price + i * .0005 })) }));
          localStorage.setItem('zterminal.chart-documents', JSON.stringify(persisted));
        });
        await page.reload({ waitUntil: 'domcontentloaded' }); await chart.locator('canvas').first().waitFor();
        assert.equal((await savedRead()).length, 1000);
        await tool('Horizontal Line', 1);
        const stressBox = await chart.locator('.zt-drawing-input').boundingBox();
        await page.mouse.click(stressBox.x + 180, stressBox.y + 130);
        assert.equal((await savedRead()).length, 1001);
        const before = (await savedRead()).at(-1).anchors;
        const timing = page.evaluate(() => new Promise(resolve => {
          const durations = []; let previous;
          const sample = time => {
            if (previous !== undefined) durations.push(time - previous);
            previous = time;
            if (durations.length < 60) requestAnimationFrame(sample);
            else { durations.sort((a, b) => a - b); resolve({ medianFrameMs: durations[30], p95FrameMs: durations[57], maxFrameMs: durations[59] }); }
          };
          requestAnimationFrame(sample);
        }));
        await page.mouse.move(stressBox.x + 230, stressBox.y + 130); await page.mouse.down();
        await page.mouse.move(stressBox.x + 260, stressBox.y + 170, { steps: 20 }); await page.mouse.up();
        stress = await timing;
        assert.notDeepEqual((await savedRead()).at(-1).anchors, before, '1000-drawing chart remains editable');
        await chart.getByRole('button', { name: 'Undo drawing', exact: true }).click();
        assert.deepEqual((await savedRead()).at(-1).anchors, before, '1000-drawing edit is one history operation');
        await page.screenshot({ path: path.join(output, 'stress-1000.png') });
      }
      assert.deepEqual(errors, [], 'no uncaught browser errors');
      results.push({ deviceScaleFactor, drawings: expected, stress, checks: 'all 22 types, mouse/touch click creation, move, anchors, history, clipboard, context-menu duplicate, Escape/right-click/pointer cancellation, edit rollback, drag beyond chart, text, lock, hide/show, pan, zoom, resize, timeframe, logarithmic/inverted scales, replay-safe strong magnet, persistent tool, named workspace save/load/reload/isolation, secondary pane history and symbol isolation, DPI, 1000-drawing edit/undo and frame sampling at DPR 1', errors });
      console.log(`PASS drawing browser DPR ${deviceScaleFactor}`);
      await context.close();
      await browser.close(); browser = undefined;
    }
  } finally { fs.writeFileSync(path.join(output, 'browser-summary.json'), JSON.stringify(results, null, 2)); if (browser) await browser.close(); }
}
if (require.main === module) verifyDrawings().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { verifyDrawings };
