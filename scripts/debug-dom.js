const { chromium } = require('playwright');

async function debug() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://127.0.0.1:3000', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const heroDetails = await page.evaluate(() => {
    const heroCopy = document.querySelector('[class*="heroCopy"]');
    const computer = document.querySelector('[class*="computer"]');
    const h1 = document.querySelector('h1');
    const problem = document.querySelector('[class*="problemSection"]');
    const viewport = document.querySelector('[class*="viewport"]');

    function info(el) {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const s = window.getComputedStyle(el);
      return {
        tag: el.tagName,
        class: el.className,
        rect: { top: r.top, left: r.left, width: r.width, height: r.height },
        style: {
          display: s.display,
          opacity: s.opacity,
          visibility: s.visibility,
          transform: s.transform,
          zIndex: s.zIndex,
        }
      };
    }

    return {
      viewport: info(viewport),
      heroCopy: info(heroCopy),
      computer: info(computer),
      h1: info(h1),
      problem: info(problem),
    };
  });

  console.log('DOM info:', JSON.stringify(heroDetails, null, 2));
  await browser.close();
}

debug();
