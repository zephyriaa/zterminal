import { nativeAvailable, nativeEnabled, nativeFailure, nativeResponse } from "@/lib/native-auth-http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET(request: Request) {
  try { nativeAvailable(request); return nativeResponse({ enabled: nativeEnabled(), protocol: 1 }); }
  catch { return nativeFailure(503); }
}
