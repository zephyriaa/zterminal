import test from "node:test";
import assert from "node:assert/strict";
import {
  RemoteConfigService,
  DEFAULT_CONFIG,
  type RemoteConfigSchema,
  type RemoteConfigFetcher,
} from "../src/lib/config/remote-config";

test("RemoteConfigService provides defaults and supports feature lookups", () => {
  const service = new RemoteConfigService();
  const cfg = service.getConfig();

  assert.equal(cfg.version, DEFAULT_CONFIG.version);
  assert.equal(service.getFeature("enableOrderFlow"), true);
  assert.equal(service.isEmergencyHaltActive(), false);
});

test("RemoteConfigService fetches remote updates, notifies listeners, and caches by TTL", async () => {
  let fetchCount = 0;
  const mockFetcher: RemoteConfigFetcher = {
    async fetchConfig(): Promise<Partial<RemoteConfigSchema>> {
      fetchCount++;
      return {
        version: "1.1.0",
        features: {
          enableOrderFlow: false, // toggled off remotely
          enableSubBarMagnifier: true,
          enableNativeWebSockets: true,
          enableAiAssistant: true,
          maxConcurrentCharts: 12,
        },
        riskDefaults: {
          maxDailyLossUsd: 5_000,
          maxGrossExposureUsd: 100_000,
          emergencyHaltAll: true,
        },
      };
    },
  };

  const service = new RemoteConfigService(mockFetcher, DEFAULT_CONFIG, 10_000);

  let notified = false;
  const unsubscribe = service.subscribe((c) => {
    if (c.version === "1.1.0") notified = true;
  });

  await service.refresh();
  assert.equal(fetchCount, 1);
  assert.equal(notified, true);
  assert.equal(service.getConfig().version, "1.1.0");
  assert.equal(service.getFeature("enableOrderFlow"), false);
  assert.equal(service.getFeature("maxConcurrentCharts"), 12);
  assert.equal(service.isEmergencyHaltActive(), true);

  // Subsequent refresh within TTL should not re-fetch
  await service.refresh(false);
  assert.equal(fetchCount, 1);

  unsubscribe();
});

test("RemoteConfigService falls back safely to cached config if remote fetch fails", async () => {
  const failingFetcher: RemoteConfigFetcher = {
    async fetchConfig(): Promise<Partial<RemoteConfigSchema>> {
      throw new Error("503 Service Unavailable");
    },
  };

  const service = new RemoteConfigService(failingFetcher, DEFAULT_CONFIG, 0);
  const before = service.getConfig();

  // Refresh should not throw, but catch and preserve config
  await service.refresh(true);
  const after = service.getConfig();

  assert.deepEqual(after.features, before.features);
  assert.equal(after.version, before.version);
});
