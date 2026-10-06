const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const base = process.env.LANDING_TEST_URL || process.env.LANDING_BASE_URL || 'http://localhost:3000';
const output = path.resolve(process.env.LANDING_TEST_OUTPUT || 'artifacts/landing-redesign/qa');
const widths = [360, 390, 430, 768, 1024, 1280, 1440, 1920];
fs.mkdirSync(output, { recursive: true });

async function main() {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE_PATH });
  const results = [];
  try {
    for (const width of widths) {
      const context = await browser.newContext({ viewport: { width, height: width < 768 ? 844 : 900 }, colorScheme: 'dark' });
      const page = await context.newPage();
      page.setDefaultNavigationTimeout(90000);
      await page.addInitScript(() => {
        window.landingShifts = [];
        new PerformanceObserver(list => {
          for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.landingShifts.push(entry.value);
        }).observe({ type: 'layout-shift', buffered: true });
      });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
      await page.goto(base, { waitUntil: 'load', timeout: 90000 });
      await page.getByRole('heading', { level: 1, name: 'See Further. Guess Less.' }).waitFor();
      assert.equal(await page.getByRole('heading', { level: 1 }).count(), 1);
      const hero = page.locator('section[aria-labelledby="hero-heading"]');
      await hero.locator('img').waitFor();
      await page.waitForFunction(() => document.querySelector('section[aria-labelledby="hero-heading"] img')?.naturalWidth > 0);
      assert.equal(await hero.getByRole('link', { name: 'Open ZTerminal', exact: true }).getAttribute('href'), '/terminal');
      assert.equal(await hero.getByRole('link', { name: 'Explore the workflow', exact: true }).getAttribute('href'), '#research-loop');
      const geometry = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth, imageTop: document.querySelector('section[aria-labelledby="hero-heading"] img').getBoundingClientRect().top }));
      assert.equal(geometry.overflow, false, `Horizontal overflow at ${width}`);
      assert.ok(geometry.imageTop < 900, `Product appears too late at ${width}`);
      await page.evaluate(() => Promise.all(document.getAnimations().map(animation => animation.finished.catch(() => {}))));
      await page.screenshot({ path: path.join(output, `hero-${width}.png`) });
      if (width <= 860) {
        const menu = page.getByRole('button', { name: 'Open navigation', exact: true });
        await menu.click();
        await page.getByRole('navigation', { name: 'Public navigation' }).waitFor({ state: 'visible' });
        await page.keyboard.press('Escape');
        await page.getByRole('navigation', { name: 'Public navigation' }).waitFor({ state: 'hidden' });
        assert.equal(await menu.evaluate(el => el === document.activeElement), true);
        await menu.click();
        await hero.locator('img').click();
        await page.getByRole('navigation', { name: 'Public navigation' }).waitFor({ state: 'hidden' });
      }
      const workflow = page.locator('[data-workflow]');
      assert.equal(await workflow.locator('[data-workflow-step]').count(), 5);
      if (width >= 1024) {
        await page.waitForFunction(() => document.querySelector('[data-workflow]')?.dataset.enhanced === 'true');
        for (const index of [0, 1, 2, 3, 4, 2, 0]) {
          await workflow.locator(`[data-workflow-step="${index}"]`).evaluate(el => {
            window.scrollTo(0, window.scrollY + el.getBoundingClientRect().top - innerHeight * .35);
          });
          await page.waitForFunction(value => document.querySelector('[data-workflow]')?.dataset.activeStep === String(value), index);
          await workflow.locator(`[data-workflow-screen="${index}"]`).waitFor({ state: 'visible' });
          await page.evaluate(() => Promise.all(document.getAnimations().map(animation => animation.finished.catch(() => {}))));
        }
        await page.screenshot({ path: path.join(output, `workflow-${width}.png`) });
        await page.setViewportSize({ width: 390, height: 844 });
        await page.waitForFunction(() => !document.querySelector('[data-workflow]')?.hasAttribute('data-enhanced'));
        assert.equal(await workflow.locator('[data-workflow-step="3"] img').isVisible(), true);
        await page.setViewportSize({ width, height: 900 });
        await page.waitForFunction(() => document.querySelector('[data-workflow]')?.dataset.enhanced === 'true');
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.waitForFunction(() => !document.querySelector('[data-workflow]')?.hasAttribute('data-enhanced'));
        await page.waitForFunction(() => getComputedStyle(document.querySelector('[data-hero-scene]')).getPropertyValue('--scene-travel').trim() === '0');
        assert.equal(await workflow.locator('[data-workflow-step="4"] img').isVisible(), true);
        assert.equal(await page.evaluate(() => document.getAnimations().filter(animation => animation.playState === 'running').length), 0, 'Reduced motion still has running effects');
        assert.equal(await hero.evaluate(el => getComputedStyle(el).getPropertyValue('--light-x').trim()), '62%', 'Reduced motion did not reset interactive lighting');
        await page.emulateMedia({ reducedMotion: 'no-preference' });
      } else {
        assert.equal(await workflow.getAttribute('data-enhanced'), null);
        for (let index = 0; index < 5; index++) {
          const image = workflow.locator(`[data-workflow-step="${index}"] img`);
          assert.equal(await image.isVisible(), true);
          await image.scrollIntoViewIfNeeded();
          await image.evaluate(image => image.decode());
        }
      }
      await page.locator('footer').scrollIntoViewIfNeeded();
      const broken = await page.locator('main img:visible').evaluateAll(images => images.filter(image => !image.complete || image.naturalWidth === 0).map(image => image.src));
      assert.deepEqual(broken, [], `Broken images at ${width}`);
      assert.deepEqual(errors, [], `Browser errors at ${width}`);
      await page.goto(base + '/#research-loop', { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForFunction(() => {
        const section = document.querySelector('#research-loop');
        return scrollY > 0 && Math.abs(section.getBoundingClientRect().top - parseFloat(getComputedStyle(section).scrollMarginTop)) < 1;
      });
      await page.reload({ waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready);
      // Browser scroll anchoring can adjust pixels during font/image restoration.
      // Verify the linked heading is visible below navigation after reload.
      await page.waitForFunction(() => {
        const top = document.querySelector('#workflow-heading').getBoundingClientRect().top;
        return scrollY > 0 && top >= 70 && top < innerHeight * .5;
      });
      assert.equal(new URL(page.url()).hash, '#research-loop');
      const cls = await page.evaluate(() => window.landingShifts.reduce((sum, value) => sum + value, 0));
      assert.ok(cls < .1, `Layout instability at ${width}: ${cls}`);
      results.push({ width, geometry, errors, cls, restoredScroll: true });
      await context.close();
    }
    for (const mode of ['reduced-motion', 'no-javascript']) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: mode === 'reduced-motion' ? 'reduce' : 'no-preference', javaScriptEnabled: mode !== 'no-javascript' });
      const page = await context.newPage();
      await page.goto(base, { waitUntil: 'load' });
      const workflow = page.locator('[data-workflow]');
      assert.equal(await workflow.getAttribute('data-enhanced'), null);
      for (let index = 0; index < 5; index++) assert.equal(await workflow.locator(`[data-workflow-step="${index}"] img`).isVisible(), true);
      await page.screenshot({ path: path.join(output, `${mode}.png`) });
      await context.close();
      results.push({ mode, allChaptersAvailable: true });
    }
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.goto(base);
    await page.keyboard.press('Tab');
    assert.equal(await page.getByRole('link', { name: 'Skip to content' }).evaluate(el => el === document.activeElement), true);
    await page.keyboard.press('Enter');
    assert.equal(new URL(page.url()).hash, '#landing-main');
    for (const route of ['/research', '/docs', '/docs/python-research', '/docs/windows/install', '/download', '/terminal?account=signin', '/page-that-does-not-exist']) {
      const response = await page.goto(base + route, { waitUntil: 'domcontentloaded', timeout: 90000 });
      assert.equal(response.status(), route.includes('does-not-exist') ? 404 : 200, `Unexpected status for ${route}`);
      if (route.includes('/terminal')) {
        await page.getByRole('button', { name: 'Open research account information' }).waitFor();
      } else assert.equal(await page.getByRole('heading', { level: 1 }).count(), 1);
      results.push({ route, status: response.status() });
    }
    await context.close();
    fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(results, null, 2));
    console.log(`Landing browser journeys passed: ${widths.length} widths, reduced motion, no JavaScript, keyboard and public routes.`);
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
