import test from "node:test";
import assert from "node:assert/strict";
import { calculateMarketSessions, formatTimezonePill, resolveEffectiveTimezone } from "../src/lib/market/market-sessions";
import { testMappingOnPayload } from "../src/lib/market/connectors";

test("calculateMarketSessions computes sessions accurately and handles DST-safe timezones", () => {
  // Test with fixed timestamp: 2026-09-10T10:49:35 UTC
  const testMs = Date.UTC(2026, 8, 10, 10, 49, 35);
  
  const snapshot = calculateMarketSessions(testMs, "UTC", true);
  assert.equal(snapshot.isCrypto, true);
  assert.equal(snapshot.sessions.length, 4);

  const ldn = snapshot.sessions.find(s => s.id === "london");
  const ny = snapshot.sessions.find(s => s.id === "new_york");
  const tyo = snapshot.sessions.find(s => s.id === "tokyo");
  const cme = snapshot.sessions.find(s => s.id === "cme");

  assert.ok(ldn);
  assert.ok(ny);
  assert.ok(tyo);
  assert.ok(cme);

  // In London at 10:49 UTC (11:49 BST): London equity is OPEN (08:00 - 16:30 local)
  assert.equal(ldn?.isOpen, true);

  // In New York at 10:49 UTC (06:49 EDT): New York RTH is CLOSED (opens 09:30 EDT = 13:30 UTC)
  assert.equal(ny?.isOpen, false);

  // Tokyo at 10:49 UTC (19:49 JST): Tokyo is CLOSED (closes 15:00 JST)
  assert.equal(tyo?.isOpen, false);

  // Next event should have a valid countdown
  assert.ok(snapshot.nextEvent);
  assert.ok(snapshot.nextEvent.compactLabel.length > 0);
  assert.ok(snapshot.nextEvent.fullLabel.length > 0);
});

test("formatTimezonePill formats timezones correctly without hardcoded assumptions", () => {
  assert.equal(formatTimezonePill("UTC"), "UTC");
  assert.match(formatTimezonePill("America/New_York"), /^UTC[+-]\d+$/);
  assert.match(formatTimezonePill("Europe/London"), /^UTC[+-]?\d*$/);
  assert.match(formatTimezonePill("Asia/Tokyo"), /^UTC\+9$/);
});

test("testMappingOnPayload verifies OHLC invariants and data mapping", () => {
  const validPayload = {
    symbol: "BTCUSDT",
    candle: {
      time: 1773138000000,
      open: 89000,
      high: 89500,
      low: 88800,
      close: 89200,
      vol: 120.5,
    },
  };

  const validMapping = {
    timestamp: "candle.time",
    symbol: "symbol",
    open: "candle.open",
    high: "candle.high",
    low: "candle.low",
    close: "candle.close",
    volume: "candle.vol",
  };

  const passResult = testMappingOnPayload(validPayload, validMapping);
  assert.equal(passResult.success, true);
  assert.equal(passResult.sampleCandle?.symbol, "BTCUSDT");
  assert.equal(passResult.sampleCandle?.close, 89200);

  // Invalidate OHLC geometry (High lower than Open)
  const invalidPayload = {
    ...validPayload,
    candle: {
      ...validPayload.candle,
      high: 88000, // Invalid: lower than open and low
    },
  };

  const failResult = testMappingOnPayload(invalidPayload, validMapping);
  assert.equal(failResult.success, false);
  const ohlcCheck = failResult.checks.find(c => c.id === "ohlc_valid");
  assert.equal(ohlcCheck?.passed, false);
});
