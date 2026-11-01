import { db } from "@/lib/db";
import { exchangeNative, nativeTokenRequest } from "@/lib/native-auth";
import { nativeBody, nativeFailure, nativeResponse, nativeServerClient } from "@/lib/native-auth-http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try { nativeServerClient(request); const input = nativeTokenRequest.parse(JSON.parse(await nativeBody(request)));
    return nativeResponse(await exchangeNative(db, input)); }
  catch { return nativeFailure(); }
}
