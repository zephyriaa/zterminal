const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const base = process.env.LANDING_BASE_URL || 'http://localhost:3000';
const output = path.resolve('artifacts/landing');
const brave = 'C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe';
const executablePath = process.env.BROWSER_EXECUTABLE_PATH || (fs.existsSync(brave) ? brave : undefined);
const results = [];
fs.mkdirSync(output, { recursive: true });

async function loadImages(page) {
  for (const image of await page.locator('main img').all()) {
    await image.scrollIntoViewIfNeeded();
    await image.evaluate(element => element.decode());
  }
}

async function verifyTabs(page) {
  const ui = page.getByRole('tab', { name: 'Workbench View' });
  const code = page.getByRole('tab', { name: 'Python SDK Snippet' });
  await ui.scrollIntoViewIfNeeded();
  const panels = page.locator('#strategy-panel-ui').locator('..');
  const before = await panels.boundingBox();
  await ui.focus();
  await page.keyboard.press('ArrowRight');
  await assertSelected(code, ui);
  await page.getByRole('tabpanel').getByText('strategy_ema_crossover.py', { exact: true }).waitFor();
  const after = await panels.boundingBox();
  assert.ok(Math.abs(before.height - after.height) < .5, 'tab panels change height');
  await page.screenshot({ path: path.join(output, `tabs-code-${page.viewportSize().width}.png`) });
  for (const key of ['ArrowRight', 'ArrowLeft', 'Home', 'End']) {
    await page.keyboard.press(key);
    const active = page.getByRole('tab', { selected: true });
    assert.equal(await active.evaluate(element => element === document.activeElement), true);
  }
  await page.keyboard.press('Home');
  await page.keyboard.press('Space');
  await page.keyboard.press('Enter');
  await assertSelected(ui, code);
  for (let i = 0; i < 6; i++) { await code.click(); await ui.click(); }
  await ui.press("ArrowRight");
  await code.press("Home");
  const focus = await ui.evaluate(element => ({ visible: element.matches(':focus-visible'), outline: getComputedStyle(element).outlineStyle }));
  assert.ok(focus.visible && focus.outline !== 'none');
  await page.keyboard.press('Tab');
  assert.equal(await page.getByRole('tabpanel').evaluate(element => element === document.activeElement), true);
  return { stablePanelHeight: after.height, arrowKeys: true, rapidSwitching: true, visibleFocus: true };
}

async function assertSelected(selected, other) {
  assert.equal(await selected.getAttribute('aria-selected'), 'true');
  assert.equal(await selected.getAttribute('tabindex'), '0');
  assert.equal(await other.getAttribute('tabindex'), '-1');
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath });
  try {
    for (const width of [390, 768, 1440, 1920]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: 'no-preference' });
      await context.addInitScript(() => {
        window.landingShifts = [];
        new PerformanceObserver(list => {
          for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.landingShifts.push(entry.value);
        }).observe({ type: 'layout-shift', buffered: true });
      });
      const page = await context.newPage();
      const errors = [], videos = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
      page.on('request', request => { if (/\.(mp4|webm)(\?|$)/.test(request.url())) videos.push(request.url()); });
      await page.goto(base, { waitUntil: 'networkidle' });
      assert.equal(await page.locator('[data-landing]').count(), 1);
      assert.equal(await page.locator('main section').count(), 6);
      assert.match(await page.locator('h1').innerText(), /Turn market ideas\s+into evidence\./);
      const hero = await page.locator('h1 > span').evaluateAll(lines => lines.map(line => {
        const child = line.firstElementChild, style = getComputedStyle(child);
        return { outer: getComputedStyle(line).animationName, duration: style.animationDuration, delay: style.animationDelay, width: line.clientWidth, scrollWidth: line.scrollWidth };
      }));
      assert.deepEqual(hero.map(line => line.outer), ['none', 'none']);
      assert.deepEqual(hero.map(line => line.duration), ['0.64s', '0.64s']);
      assert.deepEqual(hero.map(line => line.delay), ['0s', '0.06s']);
      hero.forEach(line => assert.ok(line.scrollWidth <= line.width + 1));
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.locator('[data-reveal-state="pending"]').first().evaluate(element => {
        element.dataset.landingTest = 'once';
        element.landingStarts = 0;
        element.addEventListener('animationstart', () => element.landingStarts++);
      });
      const reveal = page.locator('[data-landing-test="once"]');
      await reveal.scrollIntoViewIfNeeded();
      await page.waitForFunction(() => document.querySelector('[data-landing-test="once"]').dataset.revealState === 'shown');
      await reveal.evaluate(element => Promise.all(element.getAnimations({subtree:true}).map(animation => animation.finished.catch(() => {}))));
      const revealTiming = await reveal.evaluate(element => {
        const children = element.dataset.publicReveal === 'group' ? [...element.querySelectorAll(':scope > [data-reveal-item]')] : [element];
        return children.map(child => { const style = getComputedStyle(child); return { duration: style.animationDuration, delay: style.animationDelay }; });
      });
      revealTiming.forEach(timing => {
        assert.equal(timing.duration, '0.48s');
        assert.ok(parseFloat(timing.delay) <= .18);
      });
      const starts = await reveal.evaluate(element => element.landingStarts);
      await page.evaluate(() => scrollTo(0, 0));
      await reveal.scrollIntoViewIfNeeded();
      await page.waitForTimeout(100);
      assert.equal(await reveal.evaluate(element => element.landingStarts), starts, 'scroll reveal replayed');
      await loadImages(page);
      for (const group of await page.locator('[data-public-reveal="group"]').all()) {
        await group.scrollIntoViewIfNeeded();
        await group.evaluate(element => new Promise(resolve => {
          if (element.dataset.revealState !== 'pending') return resolve();
          const observer = new MutationObserver(() => {
            if (element.dataset.revealState !== 'pending') { observer.disconnect(); resolve(); }
          });
          observer.observe(element, { attributes: true, attributeFilter: ['data-reveal-state'] });
        }));
      }
      const staggerGroups = await page.locator('[data-public-reveal="group"][data-reveal-state="shown"]').evaluateAll(groups => groups.map(group => [...group.querySelectorAll(':scope > [data-reveal-item]')].map((item, index) => ({
        expected: Math.min(index, 3) * .06,
        actual: parseFloat(getComputedStyle(item).animationDelay),
        name: getComputedStyle(item).animationName,
      }))));
      staggerGroups.flat().forEach(timing => {
        assert.ok(Math.abs(timing.actual - timing.expected) < .001, 'landing stagger overridden');
        assert.ok(timing.actual <= .18);
        assert.match(timing.name, /landingContentReveal/);
      });
      const initialCLS = await page.evaluate(() => window.landingShifts.reduce((sum, value) => sum + value, 0));
      assert.ok(initialCLS < .02, `initial layout shifts: ${initialCLS}`);
      const tabs = await verifyTabs(page);
      if (width <= 860) {
        await page.evaluate(() => scrollTo(0, 0));
        const toggle = page.getByRole('button', { name: 'Open navigation', exact: true });
        await toggle.click();
        await page.mouse.click(width / 2, 800);
        assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
        await toggle.click();
        await page.keyboard.press('Tab');
        await page.keyboard.press('Escape');
        assert.equal(await toggle.evaluate(element => element === document.activeElement), true);
        await toggle.click();
        await page.getByRole('navigation', { name: 'Public navigation' }).getByRole('link', { name: 'Product', exact: true }).click();
        assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
      }
      assert.equal(await page.getByRole('link', { name: 'Open ZTerminal account and Google sign-in', includeHidden: true }).getAttribute('href'), '/terminal?account=signin');
      await page.evaluate(() => scrollTo(0, 0));
      await page.getByRole('link', { name: /Explore the workflow/ }).click();
      assert.ok(page.url().endsWith('#research-loop'));
      await page.waitForTimeout(200);
      const restored = await page.evaluate(() => scrollY);
      await page.reload({ waitUntil: 'networkidle' });
      assert.ok(Math.abs(await page.evaluate(() => scrollY) - restored) < 5, 'scroll position not restored');
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.waitForFunction(() => !document.querySelector('[data-reveal-state="pending"]'));
      assert.equal(await page.locator('h1 > span > span').first().evaluate(element => getComputedStyle(element).animationName), 'none');
      await loadImages(page);
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({ path: path.join(output, `after-${width}.png`), fullPage: true });
      await page.screenshot({ path: path.join(output, `hero-${width}.png`) });
      const shifts = await page.evaluate(() => window.landingShifts.reduce((sum, value) => sum + value, 0));
      assert.ok(shifts < .02, `unexpected layout shifts: ${shifts}`);
      assert.deepEqual(errors, []);
      assert.deepEqual(videos, []);
      results.push({ width, hero, tabs, liveReducedMotion: true, restoredScroll: true, revealTiming, staggerGroups, initialCLS, cls: shifts, errors, videos });
      await context.close();
    }
    const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 1000 } });
    const page = await context.newPage();
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    assert.equal(await page.locator('[data-reveal-state="pending"]').count(), 0);
    for (const heading of await page.locator('main h1, main h2').all()) assert.equal(await heading.evaluate(element => getComputedStyle(element).opacity), '1');
    assert.equal(await page.getByRole('link', { name: /Start researching/ }).getAttribute('href'), '/terminal');
    results.push({ noJavaScript: 'core content and primary links readable' });
    await context.close();
    fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(results, null, 2));
    console.log(JSON.stringify(results));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
