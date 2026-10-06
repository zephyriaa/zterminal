const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const base = process.env.THEME_TEST_URL || 'http://127.0.0.1:3100';
const output = path.resolve('artifacts/theme-rollout');
fs.mkdirSync(output, { recursive: true });
const appearanceKey = 'zterminal:appearance:v2';

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of [390, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: 'dark' });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      for (const route of ['/docs', '/docs/python-research', '/docs/zscript', '/docs/windows/install', '/research', '/download']) {
        await page.goto(base + route, { waitUntil: 'load' });
        await page.getByRole('heading', { level: 1 }).waitFor();
        await page.evaluate(() => document.fonts.ready);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, route + ' overflows');
        assert.equal(await page.locator('.publicScope').evaluate(el => getComputedStyle(el).getPropertyValue('--public-bg').trim()), '#090a10');
        if (width === 1440) await page.waitForFunction(() => document.documentElement.classList.contains('lenis'));
        if (width === 390) {
          const menu = page.getByRole('button', { name: 'Open navigation', exact: true });
          await menu.click(); await page.keyboard.press('Escape');
          assert.equal(await menu.evaluate(el => el === document.activeElement), true);
        }
        await page.evaluate(() => Promise.all(document.getAnimations().map(a => a.finished.catch(() => {}))));
        await page.screenshot({ path: path.join(output, route.slice(1).replaceAll('/', '-') + '-' + width + '.png') });
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.waitForFunction(() => !document.documentElement.classList.contains('lenis'));
        assert.equal(await page.locator('[data-reveal-state="pending"]').count(), 0);
        await page.emulateMedia({ reducedMotion: 'no-preference' });
      }
      assert.deepEqual(errors, []);
      await context.close();
    }
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' });
    const page = await context.newPage();
    const ready = async material => {
      await page.waitForFunction(m => document.body.dataset.terminalMaterial === m, material);
      await page.locator('[data-testid="workspace-dock"][data-ready="true"]').waitFor();
      await page.locator('[data-testid="primary-chart"] canvas').first().waitFor({ state: 'attached' });
    };
    await page.goto(base + '/terminal', { waitUntil: 'load' });
    await ready('violet');
    assert.equal(await page.evaluate(() => document.documentElement.classList.contains('lenis')), false);
    await page.screenshot({ path: path.join(output, 'terminal-violet.png') });
    await page.getByRole('button', { name: 'Terminal preferences', exact: true }).click();
    await page.getByRole('button', { name: 'Classic Blue', exact: true }).click();
    await ready('blue');
    await page.reload({ waitUntil: 'load' }); await ready('blue');
    const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)).state.appearance, appearanceKey);
    assert.equal(saved.preset, 'Graphite'); assert.equal(saved.accent, '#7dd3fc');
    await page.getByRole('button', { name: 'Terminal preferences', exact: true }).click();
    assert.equal(await page.getByRole('button', { name: 'Classic Blue', exact: true }).getAttribute('aria-pressed'), 'true');
    await page.screenshot({ path: path.join(output, 'terminal-blue-settings.png') });
    const documents = await page.evaluate(() => JSON.parse(localStorage.getItem('zterminal.chart-documents')).state.documents);
    await page.getByRole('button', { name: 'Violet', exact: true }).click();
    await ready('violet');
    await page.reload({ waitUntil: 'load' }); await ready('violet');
    const updated = await page.evaluate(() => JSON.parse(localStorage.getItem('zterminal.chart-documents')).state.documents);
    for (const [id, doc] of Object.entries(documents)) {
      assert.deepEqual(updated[id].drawings, doc.drawings);
      assert.equal(updated[id].timeframe, doc.timeframe);
    }
    await context.close();
    for (const legacyKey of ['zterminal:appearance', appearanceKey]) {
      const legacy = await browser.newContext();
      await legacy.addInitScript(({ key }) => {
        const appearance = { preset: 'Custom', appBackground: '#010203', panelBackground: '#040506', chartBackground: '#070809', accent: '#aabbcc', upColor: '#34d399', downColor: '#fb7185', gridOpacity: 11, density: 'comfortable' };
        localStorage.setItem(key, JSON.stringify(key.endsWith(':v2') ? { state: { appearance }, version: 0 } : appearance));
      }, { key: legacyKey });
      const tab = await legacy.newPage();
      await tab.goto(base + '/terminal', { waitUntil: 'load' });
      await tab.waitForFunction(() => document.body.dataset.terminalMaterial === 'blue' && document.body.style.getPropertyValue('--zt-accent') === '#aabbcc');
      await tab.waitForFunction(() => Object.values(JSON.parse(localStorage.getItem('zterminal.chart-documents') || '{}').state?.documents || {}).some(d => d.settings.backgroundColor === '#070809'));
      await legacy.close();
    }
    console.log('Theme journeys passed: public routes, mobile menus, live reduced motion, fresh Violet, Classic Blue reload, legacy custom preferences and chart preservation.');
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
