import { z } from "zod";
import { db } from "@/lib/db";
import { revokeNative } from "@/lib/native-auth";
import { nativeBody, nativeFailure, nativeResponse, nativeServerClient } from "@/lib/native-auth-http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try { nativeServerClient(request); const input = z.object({ refresh_token: z.string().regex(/^[A-Za-z0-9_-]{43}$/) }).strict().parse(JSON.parse(await nativeBody(request)));
    await revokeNative(db, input.refresh_token); return nativeResponse({ revoked: true }); }
  catch { return nativeFailure(); }
}
