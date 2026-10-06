import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { chromium } from "playwright";
import { db } from "../src/lib/db";
import { createChartDocument, defaultDrawingStyle, type DrawingObject } from "../src/lib/chart/contracts";

// Run against a local Next server with test-only Google configuration; never against production.
const origin = process.env.TERMINAL_URL || "http://localhost:3000";
if (new URL(origin).hostname !== "localhost") throw new Error("Session fixtures are permitted only on localhost");
async function main() {
  const browser = await chromium.launch({ headless: true });
  const user = await db.user.create({ data: { email: `${randomUUID()}@zterminal.test`, name: "Session Fixture" } });
  const token = randomUUID();
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const config = await context.request.get(origin + "/api/auth/config");
    assert.equal((await config.json()).enabled, true, "Start Next with test-only Google credentials and a session secret");
    await db.session.create({ data: { userId: user.id, sessionToken: token, expires: new Date(Date.now() + 300_000) } });
    await context.addCookies([{ name: "next-auth.session-token", value: token, url: origin, httpOnly: true, sameSite: "Lax", expires: Math.floor(Date.now() / 1000) + 300 }]);
    await context.route('**/api/bars?*', route => route.fulfill({ json: { bars: [] } }));
    const page = await context.newPage(), errors: string[] = [];
    page.on("pageerror", e => errors.push(e.message));
    await page.addInitScript(() => {
      const labels: string[] = [];
      (window as unknown as { accountLabels: string[] }).accountLabels = labels;
      new MutationObserver(() => {
        const label = document.querySelector(".zt-research-account b")?.textContent;
        if (label && labels.at(-1) !== label) labels.push(label);
      }).observe(document, { childList: true, subtree: true });
    });
    await page.goto(origin + "/terminal", { waitUntil: "domcontentloaded" });
    await page.locator(".zt-research-account").filter({ hasText: "Session Fixture" }).waitFor();
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator(".zt-research-account").filter({ hasText: "Session Fixture" }).waitFor();
    const labels = await page.evaluate(() => (window as unknown as { accountLabels: string[] }).accountLabels);
    assert.equal(labels.includes("Local workspace"), false, "SSR session restoration has no logged-out flash");
    await page.goto(origin + "/terminal?account=profile", { waitUntil: "domcontentloaded" });
    await page.goBack({ waitUntil: "domcontentloaded" });
    await page.locator(".zt-research-account").filter({ hasText: "Session Fixture" }).waitFor();
    let slowRequest = true, releaseSlow!: () => void, markSlowStarted!: () => void, markSlowFinished!: () => void;
    const slowStarted = new Promise<void>(resolve => { markSlowStarted = resolve; });
    const slowRelease = new Promise<void>(resolve => { releaseSlow = resolve; });
    const slowFinished = new Promise<void>(resolve => { markSlowFinished = resolve; });
    await page.route("**/api/auth/session", async route => {
      if (!slowRequest) { await route.continue(); return; }
      slowRequest = false; markSlowStarted(); await slowRelease;
      // An older anonymous reply must not overwrite a newer verified session.
      try { await route.fulfill({ json: {} }); }
      catch (error) { assert.match((error as Error).message, /Route is already handled|Target.*closed|Request.*cancel/i, "Only cancellation of the superseded request is expected"); }
      finally { markSlowFinished(); }
    });
    await page.evaluate(() => window.dispatchEvent(new Event("focus"))); await slowStarted;
    await Promise.all([page.waitForResponse(response => response.url().endsWith("/api/auth/session")), page.evaluate(() => window.dispatchEvent(new Event("focus")))]);
    releaseSlow(); await slowFinished; await page.unroute("**/api/auth/session");
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    assert.equal((await page.evaluate(() => (window as unknown as { accountLabels: string[] }).accountLabels)).includes("Local workspace"), false, "slow stale responses cannot resurrect anonymous state");
    const workspaceId = randomUUID(), instrument = { provider: "gateio" as const, exchange: "BINANCE" as const, product: "perpetual" as const, nativeSymbol: "BTCUSDT" };
    const chartDocument = createChartDocument({ workspaceId, instrument, timeframe: "5m" });
    const drawing: DrawingObject = { schemaVersion: 1, id: randomUUID(), chartId: chartDocument.chartId, instrument, type: "trend-line", anchors: [{ time: 1000, price: 10 }, { time: 2000, price: 20 }], style: defaultDrawingStyle("trend-line"), locked: false, hidden: false, visibility: { timeframes: "all" }, createdAt: 1, updatedAt: 1, zOrder: 0 };
    chartDocument.drawings = [drawing];
    const payload = { id: workspaceId, name: "Drawing fixture", view: "chart", symbol: "BTCUSDT", timeframe: "5m", timezone: "UTC", createdAt: Date.now(), chartDocuments: [chartDocument] };
    const saved = await context.request.post(origin + "/api/cloud/workspaces", { headers: { origin }, data: payload });
    assert.equal(saved.status(), 201);
    const cloud = await context.request.get(origin + "/api/cloud/workspaces");
    const entry = (await cloud.json()).workspaces.find((entry: { id: string }) => entry.id === workspaceId);
    assert.deepEqual(JSON.parse(entry.cloudState.payload).chartDocuments[0].drawings[0].anchors, drawing.anchors);
    assert.equal((await context.request.post(origin + "/api/cloud/workspaces", { headers: { origin: "https://foreign.test" }, data: payload })).status(), 403);
    const second = await context.newPage(); await second.goto(origin + "/terminal", { waitUntil: "domcontentloaded" });
    await second.locator(".zt-research-account").filter({ hasText: "Session Fixture" }).waitFor();
    await second.locator('[data-testid="workspace-dock"][data-ready="true"]').waitFor();
    await second.keyboard.press("Control+k"); await second.getByPlaceholder("Search symbols, views, actions…").fill("Drawing fixture");
    await second.getByRole("option", { name: "Open workspace: Drawing fixture", exact: true }).click();
    await second.waitForFunction(id => {
      const state = JSON.parse(localStorage.getItem("zterminal.chart-documents")!).state;
      return state.workspaceOwners[id] && Object.values(state.documents).some((doc: unknown) => (doc as { workspaceId: string }).workspaceId === id);
    }, workspaceId);
    // Restart a browser with its cookie jar in memory; no credential fixture is written to disk.
    const reopenedBrowser = await chromium.launch({ headless: true });
    try {
      const reopened = await reopenedBrowser.newContext({ storageState: await context.storageState() });
      await reopened.route('**/api/bars?*', route => route.fulfill({ json: { bars: [] } }));
      const reopenedPage = await reopened.newPage(); await reopenedPage.goto(origin + "/terminal", { waitUntil: "domcontentloaded" });
      await reopenedPage.locator(".zt-research-account").filter({ hasText: "Session Fixture" }).waitFor();
    } finally { await reopenedBrowser.close(); }
    await page.route("**/api/auth/session", route => route.fulfill({ status: 503, json: { code: "SESSION_UNAVAILABLE" } }));
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await page.locator(".zt-research-account").filter({ hasText: "Session unavailable" }).waitFor();
    await page.getByRole("button", { name: "Open research account information", exact: true }).click();
    await page.getByRole("button", { name: "Retry session verification" }).waitFor();
    await page.unroute("**/api/auth/session");
    await page.getByRole("button", { name: "Retry session verification" }).click();
    await page.locator(".zt-research-account").filter({ hasText: "Session Fixture" }).waitFor();
    await page.locator('button[title="Sign out of Google"]').click();
    await page.locator(".zt-research-account").filter({ hasText: "Local workspace" }).waitFor();
    await second.locator(".zt-research-account").filter({ hasText: "Local workspace" }).waitFor();
    await second.waitForFunction(id => {
      const state = JSON.parse(localStorage.getItem("zterminal.chart-documents")!).state;
      return !state.workspaceOwners[id] && !Object.values(state.documents).some((doc: unknown) => (doc as { workspaceId: string }).workspaceId === id);
    }, workspaceId);
    assert.equal(await db.session.findUnique({ where: { sessionToken: token } }), null, "logout revokes the database session");
    assert.equal((await context.request.get(origin + "/api/cloud/workspaces")).status(), 401);
    // A new valid session after logout can be restored immediately.
    const returning = randomUUID();
    await db.session.create({ data: { userId: user.id, sessionToken: returning, expires: new Date(Date.now() + 300_000) } });
    await context.addCookies([{ name: "next-auth.session-token", value: returning, url: origin, httpOnly: true, sameSite: "Lax" }]);
    await page.reload(); await page.locator(".zt-research-account").filter({ hasText: "Session Fixture" }).waitFor();
    await db.session.update({ where: { sessionToken: returning }, data: { expires: new Date(0) } });
    await page.reload(); await page.locator(".zt-research-account").filter({ hasText: "Local workspace" }).waitFor();
    assert.equal(await db.session.findUnique({ where: { sessionToken: returning } }), null);
    await context.addCookies([{ name: "next-auth.session-token", value: "invalid", url: origin, httpOnly: true, sameSite: "Lax" }]);
    await page.reload(); await page.locator(".zt-research-account").filter({ hasText: "Local workspace" }).waitFor();
    await page.goto(origin + "/api/auth/error?error=OAuthCallback");
    await page.getByText("Sign-in could not be verified. Enable cookies and start again from ZTerminal.").waitFor();
    assert.equal(new URL(page.url()).pathname, "/terminal");
    assert.equal(new URL(page.url()).searchParams.get("error"), "OAuthCallback");
    assert.deepEqual(errors, []);
    console.log("PASS auth browser: SSR, reload, browser back, stale slow response, new tab, browser restart with retained cookies, unavailable/retry, multi-tab logout, revocation, returning session, expiry, invalid cookie, callback error, cloud drawing round-trip and account-cache purge");
    await context.close();
  } finally { await browser.close(); await db.workspace.deleteMany({ where: { ownerId: user.id } }); await db.user.delete({ where: { id: user.id } }); await db.$disconnect(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
