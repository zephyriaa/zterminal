const { chromium } = require('playwright');

async function runScenarioAudit() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const metrics = {
    landing: { requests: 0, apiRequests: 0, staticRequests: 0, bytes: 0 },
    terminal: { requests: 0, apiRequests: 0, staticRequests: 0, bytes: 0 },
    symbolChange: { requests: 0, apiRequests: 0, staticRequests: 0, bytes: 0 },
    navigation: { requests: 0, apiRequests: 0, staticRequests: 0, bytes: 0 },
    apiUrls: [],
  };

  page.on('request', req => {
    const url = req.url();
    if (url.includes('/api/')) {
      metrics.apiUrls.push(url.split('?')[0]);
    }
  });

  page.on('response', async res => {
    const url = res.url();
    let size = 0;
    try {
      const headers = res.headers();
      size = Number(headers['content-length'] || 0);
    } catch {}

    const isApi = url.includes('/api/');
    const isStatic = url.includes('/_next/static/') || url.includes('/landing/') || url.includes('/brand/');

    if (currentScenario) {
      metrics[currentScenario].requests++;
      if (isApi) metrics[currentScenario].apiRequests++;
      if (isStatic) metrics[currentScenario].staticRequests++;
      metrics[currentScenario].bytes += size;
    }
  });

  let currentScenario = 'landing';
  console.log('--- Measuring Scenario A: Landing Page ---');
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  currentScenario = 'terminal';
  console.log('--- Measuring Scenario B: Terminal Page ---');
  await page.goto('http://localhost:3000/terminal', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  currentScenario = 'symbolChange';
  console.log('--- Measuring Scenario D: Changing Symbols in Terminal ---');
  // Trigger bar fetches by evaluating or changing symbol
  await page.evaluate(async () => {
    // Simulate symbol changes in client
    await fetch('/api/bars?provider=binance&symbol=ETHUSDT&tf=5m&bars=600');
    await fetch('/api/bars?provider=binance&symbol=SOLUSDT&tf=5m&bars=600');
    await fetch('/api/bars?provider=binance&symbol=ETHUSDT&tf=5m&bars=600'); // duplicate!
  });
  await page.waitForTimeout(1000);

  currentScenario = 'navigation';
  console.log('--- Measuring Scenario H: Repeated Navigation ---');
  await page.goto('http://localhost:3000/docs', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  await page.goto('http://localhost:3000/terminal', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  console.log('\n=== BASELINE MEASUREMENT RESULTS ===');
  console.log(JSON.stringify(metrics, null, 2));

  await browser.close();
}

runScenarioAudit().catch(err => {
  console.error(err);
  process.exit(1);
});
