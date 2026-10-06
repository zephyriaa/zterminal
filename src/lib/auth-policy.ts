/** Only return to this application's origin. Never trust callback URL input. */
export function safeAuthRedirect(url: string, baseUrl: string) {
  const base = new URL(baseUrl);
  try {
    const target = new URL(url, base);
    if (target.origin === base.origin && !target.username && !target.password) return target.href;
  } catch { /* Fall back to the public terminal on malformed input. */ }
  return new URL("/terminal", base).href;
}

export function googleIdentityVerified(account: { provider?: string; providerAccountId?: string } | null, profile: unknown) {
  if (!profile || typeof profile !== "object") return false;
  const claims = profile as { sub?: unknown; email?: unknown; email_verified?: unknown };
  return account?.provider === "google" && typeof claims.sub === "string" && claims.sub.length > 0 &&
    account.providerAccountId === claims.sub && typeof claims.email === "string" && claims.email.includes("@") && claims.email_verified === true;
}

export function authErrorMessage(code: string | null) {
  if (!code) return null;
  if (code === "OAuthAccountNotLinked") return "This email is linked to another sign-in method. Use that method before linking Google.";
  if (code === "AccessDenied") return "Google sign-in was cancelled or permission was denied.";
  if (code === "OAuthCallback") return "Sign-in could not be verified. Enable cookies and start again from ZTerminal.";
  return "We couldn't complete Google sign-in. Please try again.";
}

/** Cookie-authenticated mutations require the browser's same-origin boundary. */
export function isSameOriginMutation(request: Request) {
  const origin = request.headers.get("origin");
  return origin === new URL(request.url).origin && request.headers.get("sec-fetch-site") !== "cross-site";
}
