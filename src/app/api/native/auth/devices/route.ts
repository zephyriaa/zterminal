import { db } from "@/lib/db";
import { revokeNativeDevices } from "@/lib/native-auth";
import { escapeNativeHtml as html, nativeBody, nativeBrowserSession, nativeFailure, nativeHtml } from "@/lib/native-auth-http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const user = await nativeBrowserSession(request); if (!user) return nativeFailure(401);
    const sessions = await db.nativeDeviceSession.findMany({ where: { userId: user.id, revokedAt: null, expiresAt: { gt: new Date() } }, select: { id: true, name: true, createdAt: true }, take: 20 });
    return nativeHtml(`<h1>Connected Windows devices</h1><p>${html(user.name)} · Removing a device preserves its local work.</p>${sessions.map(s => `<form method="post"><p>${html(s.name)} · connected ${html(s.createdAt.toISOString().slice(0,10))}</p><button name="session_id" value="${html(s.id)}">Remove device</button></form>`).join("")}<form method="post"><button name="session_id" value="all">Sign out everywhere</button></form>`);
  } catch { return nativeFailure(503); }
}
export async function POST(request: Request) {
  try {
    const user = await nativeBrowserSession(request, true); if (!user) return nativeFailure(401);
    const form = new URLSearchParams(await nativeBody(request)); const id = form.get("session_id");
    if (form.getAll("session_id").length !== 1 || !id || !/^[a-zA-Z0-9-]{1,100}$/.test(id)) return nativeFailure();
    await revokeNativeDevices(db, user.id, id);
    return nativeHtml(`<h1>Account access removed</h1><p>The selected access was revoked. Signing out everywhere also removes browser sessions. Local workspaces and studies remain on the computer.</p><a href="/api/native/auth/devices">Back to devices</a>`);
  } catch { return nativeFailure(); }
}
