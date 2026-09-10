import { NextResponse } from "next/server";

import { publicHelperRelease } from "@/lib/releases/helper-release";

export const dynamic = "force-dynamic";

export function GET() {
  const release = publicHelperRelease();
  const response = NextResponse.json(release, { status: release.available ? 200 : 503 });
  response.headers.set("Cache-Control", release.available ? "public, s-maxage=60, stale-while-revalidate=300" : "no-store");
  response.headers.set("X-Content-Type-Options", "nosniff");
  return response;
}
