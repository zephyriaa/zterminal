const DEVELOPMENT_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000"];

export function resolveGatewayOrigins(environment: string | undefined, configuredOrigins: string | undefined) {
  const configured = (configuredOrigins ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  // A deployed Caddy route serves Socket.IO on the same HTTPS origin as the web app.
  // With no explicit origin, no cross-origin browser access is granted; same-origin traffic continues to work.
  if (environment === "production") return configured;
  return [...new Set([...DEVELOPMENT_ORIGINS, ...configured])];
}

export function validateSubscriptionRequest(
  request: { symbol?: string; types?: string[] },
  options: { activeSubscriptionCount: number; maximumSubscriptions: number },
): { ok: true; types: Set<"trade" | "quote" | "depth"> } | { ok: false; error: string } {
  if (!Number.isInteger(options.maximumSubscriptions) || options.maximumSubscriptions < 1) {
    return { ok: false, error: "gateway maximum subscription configuration is invalid" };
  }
  if (options.activeSubscriptionCount >= options.maximumSubscriptions) {
    return { ok: false, error: "subscription limit reached" };
  }
  const requested = request.types ?? ["trade", "quote", "depth"];
  const allowed = new Set(["trade", "quote", "depth"] as const);
  if (!requested.length || requested.some((type) => !allowed.has(type as "trade" | "quote" | "depth"))) {
    return { ok: false, error: "unsupported subscription event type" };
  }
  return { ok: true, types: new Set(requested as Array<"trade" | "quote" | "depth">) };
}
