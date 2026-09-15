/**
 * Cloudflare edge entry point for the ZTerminal web origin.
 *
 * The Worker deliberately has no application secrets and no application logic.
 * It caches only path-versioned static assets and transparently forwards every
 * other request (including Socket.IO upgrade requests) to the Node backend.
 */

const ONE_YEAR = "public, max-age=31536000, immutable";

function canCache(request, url) {
  if (request.method !== "GET") return false;
  if (request.headers.has("authorization") || request.headers.has("cookie")) return false;
  return url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/vendor/monaco-0.55.1/");
}

function originRequest(request, target, publicUrl) {
  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.set("x-forwarded-host", publicUrl.host);
  headers.set("x-forwarded-proto", publicUrl.protocol.slice(0, -1));
  headers.set("x-forwarded-for", request.headers.get("cf-connecting-ip") ?? "");
  return new Request(target, { method: request.method, headers, body: request.body, redirect: "manual" });
}

function immutable(response) {
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", ONE_YEAR);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

const edgeProxy = {
  async fetch(request, env, ctx) {
    if (!env.BACKEND_ORIGIN) return new Response("ZTerminal edge proxy is not configured.", { status: 503 });

    const publicUrl = new URL(request.url);
    const backend = new URL(env.BACKEND_ORIGIN);
    const target = new URL(`${publicUrl.pathname}${publicUrl.search}`, backend);
    const cacheable = canCache(request, publicUrl);
    const cache = caches.default;
    const cacheKey = new Request(publicUrl.toString(), { method: "GET" });

    if (cacheable) {
      const cached = await cache.match(cacheKey);
      if (cached) return cached;
    }

    const upstream = await fetch(originRequest(request, target, publicUrl));
    const response = cacheable ? immutable(upstream) : upstream;
    if (cacheable && response.ok) ctx.waitUntil(cache.put(cacheKey, response.clone()));
    return response;
  },
};

export default edgeProxy;
