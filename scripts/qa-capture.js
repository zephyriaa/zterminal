/* eslint-disable */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const OUT_DIR = 'C:\\Users\\aykhank\\.gemini\\antigravity-ide\\brain\\2b95983f-2a6d-4f25-8d5d-e0af35ab4ac9';

async function runQA() {
  const browser = await chromium.launch({ headless: true });

  // 1. Original index.html at 1672x941
  console.log('Capturing original index.html at 1672x941...');
  {
    const context = await browser.newContext({
      viewport: { width: 1672, height: 941 },
      deviceScaleFactor: 1,
      colorScheme: 'dark',
    });
    const page = await context.newPage();
    const originalUrl = 'file:///' + path.resolve('original-index.html').replace(/\\/g, '/');
    await page.goto(originalUrl, { waitUntil: 'load' });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(OUT_DIR, '01_original_index_1672x941.png') });
    await context.close();
  }

  // 2. New homepage hero at 1672x941
  console.log('Capturing new homepage hero at 1672x941...');
  {
    const context = await browser.newContext({
      viewport: { width: 1672, height: 941 },
      deviceScaleFactor: 1,
      colorScheme: 'dark',
    });
    const page = await context.newPage();
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1600);
    await page.screenshot({ path: path.join(OUT_DIR, '02_new_homepage_hero_1672x941.png') });
    await context.close();
  }

  // 3. New homepage at 1920x1080
  console.log('Capturing homepage at 1920x1080...');
  {
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 1,
      colorScheme: 'dark',
    });
    const page = await context.newPage();
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1600);
    await page.screenshot({ path: path.join(OUT_DIR, '03_homepage_1920x1080.png') });
    await context.close();
  }

  // 4. New homepage at 1440x900
  console.log('Capturing homepage at 1440x900...');
  {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
      colorScheme: 'dark',
    });
    const page = await context.newPage();
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1600);
    await page.screenshot({ path: path.join(OUT_DIR, '04_homepage_1440x900.png') });
    await context.close();
  }

  // 5. New homepage at 1280x800
  console.log('Capturing homepage at 1280x800...');
  {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      deviceScaleFactor: 1,
      colorScheme: 'dark',
    });
    const page = await context.newPage();
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1600);
    await page.screenshot({ path: path.join(OUT_DIR, '05_homepage_1280x800.png') });
    await context.close();
  }

  // 6. New homepage mobile (390x844)
  console.log('Capturing homepage mobile at 390x844...');
  {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      colorScheme: 'dark',
    });
    const page = await context.newPage();
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1600);
    await page.screenshot({ path: path.join(OUT_DIR, '06_homepage_mobile_390.png') });
    await context.close();
  }

  // 7. Full homepage screenshot
  console.log('Capturing full homepage screenshot...');
  {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
      colorScheme: 'dark',
    });
    const page = await context.newPage();
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    // Smooth scroll down to trigger all whileInView observers across the 11 sections
    await page.evaluate(async () => {
      await new Promise((resolve) => {
        let y = 0;
        const step = 350;
        const timer = setInterval(() => {
          window.scrollBy(0, step);
          y += step;
          if (y >= document.body.scrollHeight) {
            clearInterval(timer);
            window.scrollTo(0, 0);
            resolve();
          }
        }, 30);
      });
    });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(OUT_DIR, '07_full_homepage.png'), fullPage: true });
    await context.close();
  }

  // 8. /download desktop & mobile
  console.log('Capturing /download desktop & mobile...');
  {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
      colorScheme: 'dark',
    });
    const page = await context.newPage();
    await page.goto('http://localhost:3000/download', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(OUT_DIR, '08_download_desktop.png') });
    await context.close();
  }
  {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      colorScheme: 'dark',
    });
    const page = await context.newPage();
    await page.goto('http://localhost:3000/download', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(OUT_DIR, '08_download_mobile.png') });
    await context.close();
  }

  // 9. /docs desktop & mobile
  console.log('Capturing /docs desktop & mobile...');
  {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
      colorScheme: 'dark',
    });
    const page = await context.newPage();
    await page.goto('http://localhost:3000/docs', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(OUT_DIR, '09_docs_desktop.png') });
    await context.close();
  }
  {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      colorScheme: 'dark',
    });
    const page = await context.newPage();
    await page.goto('http://localhost:3000/docs', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(OUT_DIR, '09_docs_mobile.png') });
    await context.close();
  }

  // 10. Other public pages (/docs/windows/install, /docs/python-research)
  console.log('Capturing other public documentation subpages...');
  {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
      colorScheme: 'dark',
    });
    const page = await context.newPage();
    await page.goto('http://localhost:3000/docs/windows/install', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(OUT_DIR, '10_docs_windows_install.png') });

    await page.goto('http://localhost:3000/docs/python-research', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(OUT_DIR, '10_docs_python_research.png') });
    await context.close();
  }

  // 11. /terminal verification (MUST BE UNTOUCHED)
  console.log('Capturing /terminal to verify zero regression...');
  {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
      colorScheme: 'dark',
    });
    const page = await context.newPage();
    await page.goto('http://localhost:3000/terminal', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(OUT_DIR, '11_terminal_verification.png') });
    await context.close();
  }

  await browser.close();
  console.log('All QA captures completed successfully!');
}

runQA().catch((err) => {
  console.error('QA capture error:', err);
  process.exit(1);
});
