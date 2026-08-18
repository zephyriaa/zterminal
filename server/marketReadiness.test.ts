import axios from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearMarketReadinessCache, getMarketReadiness } from "./marketReadiness";

vi.mock("axios", () => ({
  default: {
    get: vi.fn(),
  },
}));

const mockedGet = vi.mocked(axios.get);

describe("market readiness", () => {
  beforeEach(() => {
    clearMarketReadinessCache();
    mockedGet.mockReset();
  });

  it("is ready only when the bounded public provider probe returns a finite positive price", async () => {
    mockedGet.mockResolvedValueOnce({ data: [{ last: "123.45" }] } as never);

    await expect(getMarketReadiness(1_700_000_000_000)).resolves.toMatchObject({
      status: "READY",
      provider: "gateio",
      symbol: "QQQX_USDT",
      reason: null,
    });
  });

  it("is not ready when the provider probe fails and returns a safe classified reason", async () => {
    mockedGet.mockRejectedValueOnce(new Error("Gate.io returned 429"));

    await expect(getMarketReadiness(1_700_000_100_000)).resolves.toMatchObject({
      status: "NOT_READY",
      reasonCode: "RATE_LIMITED",
      provider: "gateio",
    });
  });

  it("does not treat an invalid provider payload as ready", async () => {
    mockedGet.mockResolvedValueOnce({ data: [{}] } as never);

    await expect(getMarketReadiness(1_700_000_200_000)).resolves.toMatchObject({
      status: "NOT_READY",
      reasonCode: "INVALID_PAYLOAD",
    });
  });
});
