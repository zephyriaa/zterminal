export type AuthEnvironment = Record<string, string | undefined>;

export type AuthRuntime = {
  isProduction: boolean;
  sessionSecret?: string;
  googleClientId?: string;
  googleClientSecret?: string;
  databaseUrl?: string;
  siteUrl?: string;
  durableDatabaseConfigured: boolean;
  googleOAuthConfigured: boolean;
  authConfigured: boolean;
  cloudSyncConfigured: boolean;
  missing: string[];
};

const value = (environment: AuthEnvironment, key: string) => environment[key]?.trim() || undefined;

/**
 * Resolves the minimum production boundary for Auth.js and workspace sync.
 * This module deliberately has no database or Auth.js imports so it can be
 * exercised in tests without opening a database connection.
 */
export function resolveAuthRuntime(environment: AuthEnvironment = process.env): AuthRuntime {
  const sessionSecret = value(environment, "NEXTAUTH_SECRET") ?? value(environment, "JWT_SECRET");
  const googleClientId = value(environment, "GOOGLE_CLIENT_ID");
  const googleClientSecret = value(environment, "GOOGLE_CLIENT_SECRET");
  const databaseUrl = value(environment, "DATABASE_URL");
  const isProduction = environment.NODE_ENV === "production";
  const siteUrl = value(environment, "NEXTAUTH_URL") ?? (isProduction ? undefined : "http://localhost:3000");
  let validSiteUrl = false;
  try {
    if (siteUrl) {
      const parsed = new URL(siteUrl);
      validSiteUrl = parsed.origin === siteUrl.replace(/\/$/, "") &&
        (parsed.protocol === "https:" || (!isProduction && parsed.hostname === "localhost"));
    }
  } catch { /* Invalid public origin is reported in missing. */ }
  const durableDatabaseConfigured = Boolean(databaseUrl && /^(?:postgres(?:ql)?|prisma):\/\//i.test(databaseUrl));
  const edgeDatabaseCompatible = typeof globalThis.caches === "undefined" || Boolean(databaseUrl?.startsWith("prisma://"));
  const googleOAuthConfigured = Boolean(googleClientId && googleClientSecret);
  const missing = [
    !sessionSecret && "NEXTAUTH_SECRET (or JWT_SECRET)",
    !googleClientId && "GOOGLE_CLIENT_ID",
    !googleClientSecret && "GOOGLE_CLIENT_SECRET",
    isProduction && !validSiteUrl && "NEXTAUTH_URL (public HTTPS origin)",
    isProduction && !durableDatabaseConfigured && "a PostgreSQL DATABASE_URL",
    isProduction && !edgeDatabaseCompatible && "a Prisma Accelerate DATABASE_URL for Cloudflare Workers",
  ].filter((entry): entry is string => Boolean(entry));
  const authConfigured = missing.length === 0;

  return {
    isProduction,
    sessionSecret,
    googleClientId,
    googleClientSecret,
    databaseUrl,
    siteUrl,
    durableDatabaseConfigured,
    googleOAuthConfigured,
    authConfigured,
    cloudSyncConfigured: authConfigured,
    missing,
  };
}

export function requireProductionAuthRuntime(runtime = resolveAuthRuntime()) {
  if (runtime.isProduction && !runtime.authConfigured) {
    throw new Error(`ZTerminal authentication is not configured for production: missing ${runtime.missing.join(", ")}.`);
  }
  return runtime;
}
