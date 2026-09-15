import { NextRequest, NextResponse } from "next/server";
import NextAuth from "next-auth";
import { authOptions, googleSignInConfigured, requireAuthConfiguration } from "@/lib/auth";

const handler = NextAuth(authOptions);
type AuthRouteContext = { params: Promise<{ nextauth?: string[] }> };

function unavailable() {
  return Response.json(
    {
      code: "AUTH_UNAVAILABLE",
      message: "Authentication is disabled until Google OAuth, a session secret, and PostgreSQL are configured.",
    },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}

function disabledClientResponse(method: "GET" | "POST", nextauth?: string[]) {
  const action = nextauth?.[0];
  // Keep the local-only terminal quiet: useSession treats a null session and
  // empty provider list as an unauthenticated state, not an application error.
  if (method === "GET" && action === "session") return NextResponse.json(null, { headers: { "Cache-Control": "no-store" } });
  if (method === "GET" && action === "providers") return NextResponse.json({}, { headers: { "Cache-Control": "no-store" } });
  if (method === "POST" && action === "_log") return new Response(null, { status: 204 });
  return unavailable();
}

export async function GET(request: NextRequest, context: AuthRouteContext) {
  requireAuthConfiguration();
  const params = await context.params;
  if (!googleSignInConfigured) return disabledClientResponse("GET", params.nextauth);
  return handler(request, { params });
}

export async function POST(request: NextRequest, context: AuthRouteContext) {
  requireAuthConfiguration();
  const params = await context.params;
  if (!googleSignInConfigured) return disabledClientResponse("POST", params.nextauth);
  return handler(request, { params });
}
