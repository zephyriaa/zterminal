import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ path: string[] }> };

async function proxy(request: NextRequest, context: RouteContext) {
  const base = process.env.RESEARCH_API_URL;
  if (!base) {
    return NextResponse.json({
      error: "The Python research service is not configured for this deployment.",
      code: "RESEARCH_API_UNAVAILABLE",
      dataStatus: "UNAVAILABLE",
    }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }

  const { path } = await context.params;
  const upstream = new URL(`/v1/${path.join("/")}`, base);
  upstream.search = new URL(request.url).search;
  try {
    const response = await fetch(upstream, {
      method: request.method,
      headers: {
        "content-type": request.headers.get("content-type") ?? "application/json",
        "x-zterminal-origin": "terminal-web",
      },
      body: request.method === "GET" || request.method === "HEAD" ? undefined : await request.text(),
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
