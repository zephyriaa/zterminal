import { normalizeGateioSymbol } from "./gateio";
import type { DataStatus, Environment, FeedHealth, ProviderId } from "./types";

export interface GatewayState {
  state?: string;
  provider?: ProviderId;
  environment?: Environment;
  dataStatus?: DataStatus;
  reason?: string;
  at?: number;
}

export function streamSymbol(symbol: string, provider: ProviderId): string | null {
  if (provider === "mock") return /^[A-Z0-9]+(?:[_-][A-Z0-9]+)*$/.test(symbol) ? symbol : null;
  const native = normalizeGateioSymbol(symbol.toUpperCase().replace(/-SWAP$/, ""));
  if (!native) return null;
  return provider === "gateio" ? native : provider === "okx" ? `${native.replace("_", "-")}-SWAP` : native.replace("_", "");
}

/** A gateway connection does not authorize a different venue or automatic simulation. */
export function gatewayMatches(provider: ProviderId, gateway: GatewayState): boolean {
  return gateway.provider === provider && gateway.environment === (provider === "mock" ? "simulation" : "live") && (provider === "mock" ? gateway.dataStatus === "SIMULATED" : gateway.dataStatus !== "SIMULATED");
}

export function acceptsStreamEvent(provider: ProviderId, gateway: GatewayState, event: { provider?: ProviderId; environment?: Environment; timestamp?: number }, since = 0): boolean {
  return gatewayMatches(provider, gateway) && event.provider === provider && event.environment === (provider === "mock" ? "simulation" : "live") && typeof event.timestamp === "number" && Number.isFinite(event.timestamp) && event.timestamp >= since;
}

/** A previously healthy response expires even if the socket stops delivering health. */
export function freshFeedHealth(health: FeedHealth | null, now: number): FeedHealth | null {
  if (!health) return health;
  if (health.streams) {
    const streams = { ...health.streams };
    for (const kind of ["trades", "depth"] as const) {
      const input = streams[kind];
      if (input.state === "LIVE" && (!input.lastMessageAt || now - health.updatedAt > 6000 || now - input.lastMessageAt > 15000 || input.lastMessageAt > now)) streams[kind] = { ...input, state: "STALE", reason: `${kind} observations or gateway health are stale` };
    }
    return { ...health, streams, state: health.state === "LIVE" && (streams.trades.state !== "LIVE" || streams.depth.state !== "LIVE") ? "STALE" : health.state };
  }
  if (health.state !== "LIVE") return health;
  if (!health.lastMessageAt || now - health.updatedAt > 6000 || now - health.lastMessageAt > 15000 || !health.depthReady || !health.lastDepthAt || now - health.lastDepthAt > 15000) return { ...health, state: "STALE", reason: "Instrument messages, depth or gateway health are stale" };
  return health;
}
