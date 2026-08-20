import { describe, expect, it } from "vitest";
import { resolveHistoricalWindow } from "./marketWindow";

describe("historical-window resolver", () => {
  const now = Date.UTC(2026, 7, 18, 12, 34, 56);

  it("maps a visible one-day selection to an aligned bounded UTC request", () => {
    expect(resolveHistoricalWindow("1D", "15m", now)).toMatchObject({
      from: Date.UTC(2026, 7, 17, 12, 30),
      to: Date.UTC(2026, 7, 18, 12, 30),
      requestedBars: 97,
      bounded: true,
    });
  });

  it("uses the provider cap for MAX rather than claiming all available history", () => {
    const window = resolveHistoricalWindow("MAX", "1m", now, 2_000);
    expect(window.to - window.from).toBe(1_999 * 60_000);
    expect(window.requestedBars).toBe(2_000);
    expect(window.label).toBe("MAX");
  });

  it("resolves year-to-date from the start of the UTC calendar year", () => {
    const window = resolveHistoricalWindow("YTD", "1d", now);
    expect(window.from).toBe(Date.UTC(2026, 0, 1));
    expect(window.to).toBe(Date.UTC(2026, 7, 18));
  });

  it("exposes the uncapped bar requirement for long dense windows", () => {
    const window = resolveHistoricalWindow("1Y", "15m", now);
    expect(window.requiredBars).toBe(35_041);
    expect(window.requestedBars).toBe(2_000);
  });
});
