/* eslint-disable */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const cases = [
  ["desktop-1920", 1920, 1080],
  ["desktop-1440", 1440, 900],
  ["desktop-1280", 1280, 720],
  ["tablet-1024", 1024, 768],
  ["mobile-430", 430, 932],
  ["mobile-390", 390, 844],
  ["mobile-375", 375, 667],
];

async function run() {
  const output = path.join(process.cwd(), "artifacts", "terminal-qa");
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const results = [];

  for (const [name, width, height] of cases) {
    const context = await browser.newContext({ viewport: { width, height }, colorScheme: "dark" });
    const page = await context.newPage();
    const errors = [];
    page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://127.0.0.1:3000/terminal", { waitUntil: "networkidle" });
    await page.waitForSelector(".zt-reference-terminal");
    await page.waitForTimeout(800);

    const before = await page.locator("#panel-chart").boundingBox();
    let collapseGain = null;
    const interactions = {};
    const sidebarInitiallyVisible = await page.locator(".zt-research-sidebar").isVisible();
    if (width >= 768 && sidebarInitiallyVisible) {
      await page.getByRole("button", { name: "Collapse sidebar" }).click();
      await page.waitForTimeout(220);
      const after = await page.locator("#panel-chart").boundingBox();
      collapseGain = Math.round((after?.width ?? 0) - (before?.width ?? 0));
      await page.getByRole("button", { name: "Expand sidebar" }).click();
    }

    if (name === "desktop-1440") {
      await page.locator(".zt-chart-timeframes").getByRole("button", { name: "15m", exact: true }).click();
      interactions.timeframeChanged = await page.locator(".zt-chart-timeframes").getByRole("button", { name: "15m", exact: true }).getAttribute("aria-pressed") === "true";
      await page.reload({ waitUntil: "networkidle" });
      await page.waitForSelector("#panel-chart canvas");
      interactions.timeframePersisted = await page.locator(".zt-chart-timeframes").getByRole("button", { name: "15m", exact: true }).getAttribute("aria-pressed") === "true";
      await page.locator(".zt-chart-timeframes").getByRole("button", { name: "5m", exact: true }).click();

      await page.getByRole("button", { name: "Indicators" }).first().click();
      interactions.indicatorsOpened = await page.locator("#panel-indicators").isVisible();
      await page.locator("#panel-indicators").getByRole("button", { name: "Close Indicators", exact: true }).click();

      const picker = page.locator(".zt-instrument-picker-trigger");
      const previousSymbol = (await picker.innerText()).trim();
      await picker.click();
      const alternatives = page.locator(".zt-instrument-row-select");
      if (await alternatives.count() > 1) {
        await alternatives.nth(1).click();
        interactions.symbolChanged = (await picker.innerText()).trim() !== previousSymbol;
      } else {
        interactions.symbolChanged = "catalogue-had-no-alternative";
      }
    }

    await page.keyboard.press("Control+K");
    const paletteOpen = await page.getByRole("dialog").isVisible();
    await page.keyboard.press("Escape");
    await page.waitForTimeout(220);

    const metrics = await page.evaluate(() => ({
      viewport: [window.innerWidth, window.innerHeight],
      shell: [document.querySelector(".zt-reference-terminal")?.clientWidth, document.querySelector(".zt-reference-terminal")?.clientHeight],
      pageScroll: [document.documentElement.scrollWidth - document.documentElement.clientWidth, document.documentElement.scrollHeight - document.documentElement.clientHeight],
      sidebarVisible: getComputedStyle(document.querySelector(".zt-research-sidebar")).display !== "none",
      chartVisible: Boolean(document.querySelector("#panel-chart canvas")),
      feedState: document.querySelector(".zt-chart-feed-indicator")?.textContent?.trim() ?? "mobile-hidden",
    }));

    await page.screenshot({ path: path.join(output, `${name}.png`) });
    results.push({ name, metrics, collapseGain, paletteOpen, interactions, errors });
    await context.close();
  }

  await browser.close();
  const report = { generatedAt: new Date().toISOString(), results };
  fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
