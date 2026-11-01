import { getServerSession } from "next-auth";
import { authOptions, googleSignInConfigured } from "./auth";
import { resolveAuthRuntime } from "./auth-runtime";
import { sessionAvailabilityProbe } from "./auth-session";
import { isSameOriginMutation } from "./auth-policy";

export const nativeHeaders = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Frame-Options": "DENY",
  "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'" };
export const nativeEnabled = () => googleSignInConfigured && process.env.ZTERMINAL_NATIVE_AUTH_ENABLED === "1";
export function nativeAvailable(request: Request) {
  if (!nativeEnabled() || new URL(request.url).origin !== resolveAuthRuntime().siteUrl?.replace(/\/$/, "")) throw new Error("Native identity unavailable");
}
export async function nativeBrowserSession(request: Request, mutation = false) {
  nativeAvailable(request);
  if (mutation && !isSameOriginMutation(request)) throw new Error("Invalid origin");
  const probe = sessionAvailabilityProbe(authOptions);
  const session = await getServerSession(probe.options);
  if (probe.failed()) throw new Error("Identity storage unavailable");
  const id = (session?.user as { id?: string } | undefined)?.id;
  return id && session && Date.parse(session.expires) > Date.now() ? { id, name: session.user?.name ?? "ZTerminal account" } : null;
}
export async function nativeBody(request: Request) {
  if (Number(request.headers.get("content-length")) > 4096) throw new Error("Request too large");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Missing request");
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) { const { value, done } = await reader.read(); if (done) break; size += value.byteLength;
      if (size > 4096) throw new Error("Request too large"); chunks.push(value); }
  } finally { await reader.cancel(); }
  return Buffer.concat(chunks).toString("utf-8");
}
export function nativeServerClient(request: Request) {
  nativeAvailable(request);
  // Browser cookie sessions and CORS never grant access to the native token boundary.
  if (request.headers.has("origin") || request.headers.has("cookie")) throw new Error("Native client required");
}
export function nativeResponse(value: unknown, status = 200) { return Response.json(value, { status, headers: nativeHeaders }); }
export function nativeFailure(status = 400) { return nativeResponse({ error: status === 503 ? "temporarily_unavailable" : "invalid_grant", message: "Sign-in could not be verified. Start again or continue offline." }, status); }
export const escapeNativeHtml = (value: string) => value.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
export function nativeHtml(content: string) {
  return new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ZTerminal · Windows connection</title><style>body{color-scheme:dark;background:#090a10;color:#f0eff5;font:16px/1.6 system-ui;margin:0;padding:32px}main{max-width:480px;margin:10vh auto}button,a{font:inherit}button{padding:12px 20px;border:1px solid #a8a2b5;border-radius:8px;background:#b5a2e8;color:#14111d;margin:8px 12px 8px 0;cursor:pointer}button:focus-visible,a:focus-visible{outline:3px solid #b5a2e8;outline-offset:4px}a{color:#b5a2e8}</style><main>${content}</main></html>`, { headers: { ...nativeHeaders, "Content-Type": "text/html; charset=utf-8" } });
}
