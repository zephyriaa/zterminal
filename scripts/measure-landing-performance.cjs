const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const candidate = process.env.LANDING_BASE_URL || 'http://127.0.0.1:3100';
const baseline = 'https://zterminal-web.zephyria-inc.workers.dev';
const candidateOnly = process.argv.includes('--candidate-only');
const output = path.resolve('artifacts/landing-redesign/performance');
fs.mkdirSync(output, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE_PATH });
  const measurements = [];
  try {
    for (const [name, url] of candidateOnly ? [['after', candidate]] : [['before', baseline], ['after', candidate]]) {
      for (const width of [390, 1440]) {
        const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 900 }, colorScheme: 'dark' });
        await context.addInitScript(() => {
          window.landingPerformance = { lcp: null, cls: 0 };
          new PerformanceObserver(list => {
            for (const entry of list.getEntries()) window.landingPerformance.lcp = entry.startTime;
          }).observe({ type: 'largest-contentful-paint', buffered: true });
          new PerformanceObserver(list => {
            for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.landingPerformance.cls += entry.value;
          }).observe({ type: 'layout-shift', buffered: true });
        });
        const page = await context.newPage();
        const client = await context.newCDPSession(page);
        await client.send('Network.enable');
        await client.send('Network.emulateNetworkConditions', { offline: false, latency: 40, downloadThroughput: 500000, uploadThroughput: 125000 });
        await client.send('Emulation.setCPUThrottlingRate', { rate: 4 });
        await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 });
        await page.waitForTimeout(1000);
        const metrics = await page.evaluate(() => {
          const navigation = performance.getEntriesByType('navigation')[0];
          const resources = performance.getEntriesByType('resource');
          return {
            ...window.landingPerformance,
            ttfb: navigation.responseStart,
            transferredBytes: resources.reduce((sum, resource) => sum + resource.transferSize, 0) + navigation.transferSize,
            javascriptBytes: resources.filter(resource => /\.js(?:\?|$)/.test(resource.name)).reduce((sum, resource) => sum + resource.encodedBodySize, 0),
            imageBytes: resources.filter(resource => resource.initiatorType === 'img').reduce((sum, resource) => sum + resource.encodedBodySize, 0),
          };
        });
        await page.screenshot({ path: path.join(output, `${name}-${width}.png`) });
        measurements.push({ name, url, width, metrics });
        console.log(JSON.stringify({ name, width, metrics }));
        await context.close();
      }
    }
    fs.writeFileSync(path.join(output, candidateOnly ? 'atmosphere-results.json' : 'results.json'), JSON.stringify({ environment: 'Windows x64, Chromium, cold browser contexts, CPU 4x, 4 Mbps down / 1 Mbps up, 40 ms added latency. Baseline remote Cloudflare; candidate local Node standalone. Lab measurements, not field Core Web Vitals.', measurements }, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
