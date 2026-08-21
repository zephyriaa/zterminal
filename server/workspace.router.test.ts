import { beforeEach, describe, expect, it, vi } from "vitest";

const { getTerminalWorkspace, saveTerminalWorkspace, WorkspaceRevisionConflictError } = vi.hoisted(() => {
  class MockWorkspaceRevisionConflictError extends Error {
    constructor() {
      super("Cloud workspace changed on another device.");
    }
  }
  return {
    getTerminalWorkspace: vi.fn(),
    saveTerminalWorkspace: vi.fn(),
    WorkspaceRevisionConflictError: MockWorkspaceRevisionConflictError,
  };
});

vi.mock("./db", () => ({ getTerminalWorkspace, saveTerminalWorkspace, WorkspaceRevisionConflictError }));

import { appRouter } from "./routers";

function contextFor(userId: number) {
  return {
    user: {
      id: userId,
      openId: `google:${userId}`,
      name: "Workspace user",
      email: `user-${userId}@example.test`,
      loginMethod: "google",
      role: "user" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { headers: {} },
    res: {},
  } as never;
}

const preferences = {
  version: 1 as const,
  symbol: "BTC_USDT",
  timeframe: "15m" as const,
  rangePreset: "1D" as const,
  activeTapeProvider: "gateio" as const,
  activeLayers: ["ema", "vwap"] as const,
  watchlist: ["BTC_USDT", "ETH_USDT"],
};

describe("workspace router", () => {
  beforeEach(() => {
    getTerminalWorkspace.mockReset();
    saveTerminalWorkspace.mockReset();
    getTerminalWorkspace.mockResolvedValue({ workspace: { id: "workspace", ownerId: 1 }, preferences: null, revision: null, updatedAt: null });
    saveTerminalWorkspace.mockResolvedValue({ workspace: { id: "workspace", ownerId: 1 }, preferences, revision: 1, updatedAt: new Date() });
  });

  it("derives reads from the authenticated user rather than a client-provided owner", async () => {
    const first = appRouter.createCaller(contextFor(17));
    const second = appRouter.createCaller(contextFor(29));

    await first.workspace.getTerminal();
    await second.workspace.getTerminal();

    expect(getTerminalWorkspace).toHaveBeenNthCalledWith(1, 17);
    expect(getTerminalWorkspace).toHaveBeenNthCalledWith(2, 29);
  });

  it("passes a validated preference snapshot and revision only for the authenticated owner", async () => {
    const caller = appRouter.createCaller(contextFor(17));

    await caller.workspace.saveTerminal({ preferences, expectedRevision: 4 });

    expect(saveTerminalWorkspace).toHaveBeenCalledWith(17, { ...preferences, nativeStudies: [], indicatorFavorites: [] }, 4);
  });

  it("rejects extra or sensitive payload fields before persistence", async () => {
    const caller = appRouter.createCaller(contextFor(17));

    await expect(caller.workspace.saveTerminal({
      preferences: { ...preferences, accessToken: "do-not-store" },
      expectedRevision: 1,
    } as never)).rejects.toThrow();
    expect(saveTerminalWorkspace).not.toHaveBeenCalled();
  });
});
