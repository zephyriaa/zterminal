import { db } from "@/lib/db";
import { nativeIdentity } from "@/lib/native-auth";
import { nativeFailure, nativeResponse, nativeServerClient } from "@/lib/native-auth-http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try { nativeServerClient(request); const header = request.headers.get("authorization") ?? "";
    if (!/^Bearer [A-Za-z0-9_-]{43}$/.test(header)) return nativeFailure(401);
    return nativeResponse(await nativeIdentity(db, header.slice(7))); }
  catch { return nativeFailure(401); }
}
