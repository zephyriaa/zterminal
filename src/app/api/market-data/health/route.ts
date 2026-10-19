import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MARKET_GATEWAY_URL = process.env.MARKET_GATEWAY_URL
  ?? `http://127.0.0.1:${process.env.MARKET_DATA_PORT ?? "3003"}`;
const feed = z.object({ provider: z.enum(["gateio", "binance", "mock"]), symbol: z.string().max(80), state: z.enum(["LIVE", "SYNCING", "STALE", "GAP_DETECTED", "RESYNCING", "DEGRADED", "UNAVAILABLE", "DISCONNECTED"]), updatedAt: z.number().finite(), lastMessageAt: z.number().finite().optional(), lastDepthAt: z.number().finite().optional(), depthReady: z.boolean().optional() });
const health = z.object({ ok: z.literal(true), provider: z.enum(["gateio", "binance", "mock"]), state: z.enum(["connecting", "live", "reconnecting", "stale", "degraded", "unavailable", "simulated"]), dataStatus: z.enum(["LIVE", "SIMULATED", "STALE", "DEGRADED", "UNAVAILABLE", "DISCONNECTED"]), initialized: z.boolean(), activeSymbols: z.array(z.string().max(80)).max(200), feeds: z.array(feed).max(200), at: z.number().finite() });

/** Process liveness and per-instrument readiness remain separate diagnostics. */
export async function GET() {
  try {
    const upstream = await fetch(`${MARKET_GATEWAY_URL}/healthz`, { cache: "no-store", redirect: "error", headers: { Accept: "application/json" }, signal: AbortSignal.timeout(5000) });
    if (!upstream.ok || !upstream.headers.get("content-type")?.includes("application/json")) { await upstream.body?.cancel(); throw new Error("Invalid health response"); }
    const reader = upstream.body?.getReader();
    if (!reader) throw new Error("Empty health response");
    let text = "", bytes = 0;
    const decoder = new TextDecoder();
    try {
      for (;;) {
        const chunk = await reader.read(); if (chunk.done) break;
        bytes += chunk.value.byteLength;
        if (bytes > 65536) throw new Error("Health response too large");
        text += decoder.decode(chunk.value, { stream: true });
      }
      text += decoder.decode();
    } finally { await reader.cancel(); }
    const body = health.parse(JSON.parse(text));
    // A stale/malformed LIVE claim cannot certify data, even from a running gateway.
    if (body.dataStatus === "LIVE" && (Date.now() - body.at > 15000 || !body.feeds.length || body.feeds.some(f => f.provider !== body.provider || f.state !== "LIVE" || !f.lastMessageAt || Date.now() - f.lastMessageAt > 15000 || !f.depthReady || !f.lastDepthAt || Date.now() - f.lastDepthAt > 15000))) body.dataStatus = "DEGRADED";
    return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ ok: false, state: "unavailable", dataStatus: "UNAVAILABLE", reason: "Market-data gateway health unavailable or invalid", at: Date.now() }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
