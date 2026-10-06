import { getServerSession } from "next-auth";
import { authOptions, googleSignInConfigured } from "@/lib/auth";
import { sessionAvailabilityProbe } from "@/lib/auth-session";

/** Account APIs must distinguish an unavailable verifier from an anonymous visitor. */
export async function verifiedServerSession() {
  if (!googleSignInConfigured) return null;
  const probe = sessionAvailabilityProbe(authOptions);
  const session = await getServerSession(probe.options);
  if (probe.failed()) throw new Error("Session verification unavailable");
  return session;
}
