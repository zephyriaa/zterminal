import type { Session } from "next-auth";
import type { NextAuthOptions } from "next-auth";

/** Auth.js v4 otherwise converts adapter failures into an empty, successful session response. */
export function sessionAvailabilityProbe(options: NextAuthOptions) {
  let failed = false;
  const adapter = options.adapter;
  if (!adapter) return { options, failed: () => false };
  const wrapped = { ...adapter };
  if (adapter.getSessionAndUser) wrapped.getSessionAndUser = async token => {
    try { return await adapter.getSessionAndUser!(token); }
    catch { failed = true; throw new Error("Session storage unavailable"); }
  };
  if (adapter.deleteSession) wrapped.deleteSession = async token => {
    try { await adapter.deleteSession!(token); }
    catch { failed = true; throw new Error("Session storage unavailable"); }
  };
  if (adapter.updateSession) wrapped.updateSession = async session => {
    try { return await adapter.updateSession!(session); }
    catch { failed = true; throw new Error("Session storage unavailable"); }
  };
  return { options: { ...options, adapter: wrapped }, failed: () => failed };
}

export async function readVerifiedSession(response: Response): Promise<Session | null> {
  if (!response.ok) throw new Error("Session verification unavailable");
  const value: unknown = await response.json();
  if (value && typeof value === "object" && Object.keys(value).length === 0) return null;
  if (!value || typeof value !== "object") throw new Error("Invalid session response");
  const session = value as Session & { user?: { id?: unknown } };
  if (typeof session.user?.id !== "string" || !session.user.id || typeof session.expires !== "string" || !Number.isFinite(Date.parse(session.expires))) throw new Error("Invalid session response");
  if ([session.user.name, session.user.email, session.user.image].some(field => field != null && typeof field !== "string")) throw new Error("Invalid session identity");
  if (Date.parse(session.expires) <= Date.now()) return null;
  // Expose only the canonical identity DTO; never copy arbitrary token fields.
  return { user: { id: session.user.id, name: session.user.name, email: session.user.email, image: session.user.image } as Session["user"], expires: session.expires };
}
