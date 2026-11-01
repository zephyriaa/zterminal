import { db } from "@/lib/db";
import { authorizeNative, nativeAuthorization, nativeConsent, verifyNativeConsent } from "@/lib/native-auth";
import { escapeNativeHtml as html, nativeBody, nativeBrowserSession, nativeFailure, nativeHeaders, nativeHtml } from "@/lib/native-auth-http";
import { resolveAuthRuntime } from "@/lib/auth-runtime";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parameters(values: URLSearchParams) {
  if ([...values.keys()].some((key, i, keys) => keys.indexOf(key) !== i)) throw new Error("Duplicate parameter");
  return nativeAuthorization.parse(Object.fromEntries(values));
}
export async function GET(request: Request) {
  try {
    const query = new URL(request.url).searchParams, input = parameters(query);
    const user = await nativeBrowserSession(request);
    if (!user) return new Response(null, { status: 303, headers: { ...nativeHeaders, Location: `/native/sign-in?${query}` } });
    const consent = nativeConsent(input, user.id, resolveAuthRuntime().sessionSecret!, Date.now() + 300_000);
    return nativeHtml(`<h1>Connect ZTerminal for Windows</h1><p>Continue as ${html(user.name)}?</p><p>This connects your account identity to this Windows app. It does not upload workspaces, datasets or studies, or connect a market-data provider.</p><form method="post"><input type="hidden" name="consent" value="${html(consent)}"><button name="decision" value="approve">Connect this device</button><button name="decision" value="deny">Cancel</button></form><p><a href="/api/native/auth/devices">Manage connected Windows devices</a></p>`);
  } catch { return nativeFailure(503); }
}
export async function POST(request: Request) {
  try {
    const input = parameters(new URL(request.url).searchParams), user = await nativeBrowserSession(request, true);
    if (!user) return nativeFailure(401);
    const form = new URLSearchParams(await nativeBody(request));
    if (form.getAll("consent").length !== 1 || form.getAll("decision").length !== 1 ||
        !verifyNativeConsent(form.get("consent") ?? "", input, user.id, resolveAuthRuntime().sessionSecret!)) return nativeFailure();
    const callback = new URL(input.redirect_uri); callback.searchParams.set("state", input.state);
    if (form.get("decision") === "deny") callback.searchParams.set("error", "access_denied");
    else if (form.get("decision") === "approve") callback.searchParams.set("code", await authorizeNative(db, user.id, input));
    else return nativeFailure();
    return new Response(null, { status: 303, headers: { ...nativeHeaders, Location: callback.href } });
  } catch { return nativeFailure(); }
}
