import { NextResponse } from "next/server";

import { resolveWindowsRelease } from "@/lib/releases/windows-release";

export const dynamic = "force-dynamic";

export function GET() {
  const resolution = resolveWindowsRelease();
  if (!resolution.available) {
    const response = NextResponse.json(
      {
        available: false,
        reason: resolution.reason,
        message: "An official signed Windows release is not available yet.",
      },
      { status: 503 },
    );
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("X-Content-Type-Options", "nosniff");
    return response;
  }

  const response = NextResponse.redirect(new URL(resolution.release.package_url), 302);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-Content-Type-Options", "nosniff");
  return response;
}
