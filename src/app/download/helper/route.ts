import { NextResponse } from "next/server";

import { resolveResearchHelperRelease } from "@/lib/releases/helper-release";

export const dynamic = "force-dynamic";

export function GET() {
  const resolution = resolveResearchHelperRelease();
  if (!resolution.available) {
    const response = NextResponse.json({ available: false, reason: resolution.reason, message: resolution.reason === "HELPER_RELEASE_INCOMPATIBLE" ? "The configured Helper does not advertise the current research requirements. A compatible Windows x64 package must be published before downloading." : "A verified ZTerminal Helper package is not available. Retry later or connect an already installed compatible Helper." }, { status: 503 });
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("X-Content-Type-Options", "nosniff");
    return response;
  }

  const response = NextResponse.redirect(new URL(resolution.release.download_url), 302);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-Content-Type-Options", "nosniff");
  return response;
}
