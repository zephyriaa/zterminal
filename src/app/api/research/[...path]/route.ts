import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ path: string[] }> };

async function proxy(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  // Only stateless source inspection may cross the public proxy. The upstream
  // queue accepts client-chosen workspace IDs and exposes jobs by guessed ID.
  if (request.method !== "POST" || !["artifacts/validate", "pine/convert"].includes(path.join("/"))) {
    return NextResponse.json({
      code: "RESEARCH_JOBS_UNAVAILABLE",
      error: "Cloud research jobs are unavailable until account ownership is enforced by the research service.",
    }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  const base = process.env.RESEARCH_API_URL;
  if (!base) {
    return NextResponse.json({
      error: "The Python research service is not configured for this deployment.",
      code: "RESEARCH_API_UNAVAILABLE",
      dataStatus: "UNAVAILABLE",
    }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }

  const upstream = new URL(`/v1/${path.join("/")}`, base);
  upstream.search = new URL(request.url).search;
  try {
    const response = await fetch(upstream, {
      method: request.method,
      headers: {
        "content-type": request.headers.get("content-type") ?? "application/json",
        "x-zterminal-origin": "terminal-web",
      },
      body: await request.text(),
      cache: "no-store",
    });
    return new NextResponse(await response.arrayBuffer(), {
      status: response.status,
      headers: {
        "content-type": response.headers.get("content-type") ?? "application/json",
        "cache-control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({
      error: "The Python research service is unavailable. No local execution was attempted.",
      code: "RESEARCH_API_UNAVAILABLE",
      dataStatus: "UNAVAILABLE",
    }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

export async function GET(request: NextRequest, context: RouteContext) { return proxy(request, context); }
export async function POST(request: NextRequest, context: RouteContext) { return proxy(request, context); }
