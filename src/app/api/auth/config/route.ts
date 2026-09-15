import { NextResponse } from "next/server";
import { authConfigurationMissing, googleSignInConfigured } from "@/lib/auth";

/** Public capability disclosure only. It never exposes configuration values. */
export function GET() {
  return NextResponse.json(
    {
      enabled: googleSignInConfigured,
      provider: googleSignInConfigured ? "google" : null,
      unavailableReason: googleSignInConfigured ? null : "Cloud identity is not configured for this deployment.",
      missing: googleSignInConfigured ? [] : authConfigurationMissing,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
