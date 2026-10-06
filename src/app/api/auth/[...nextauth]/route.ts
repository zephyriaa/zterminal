import { NextRequest, NextResponse } from "next/server";
import NextAuth from "next-auth";
import { authOptions, googleSignInConfigured } from "@/lib/auth";
import { sessionAvailabilityProbe } from "@/lib/auth-session";

type AuthRouteContext = { params: Promise<{ nextauth?: string[] }> };

async function configuredResponse(request: NextRequest, params: { nextauth?: string[] }) {
  const probe = sessionAvailabilityProbe(authOptions);
  const response = await NextAuth(probe.options)(request, { params });
  if (probe.failed()) return NextResponse.json({ code: "SESSION_UNAVAILABLE", message: "Your session could not be verified. Try again shortly." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  return response;
}

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
  // NextAuth v4 calls Object.keys() on the JSON response and converts an empty
  // object to a null client session. JSON null throws during client refetches.
  if (method === "GET" && action === "session") return NextResponse.json({}, { headers: { "Cache-Control": "no-store" } });
  if (method === "GET" && action === "providers") return NextResponse.json({}, { headers: { "Cache-Control": "no-store" } });
  if (method === "POST" && action === "_log") return new Response(null, { status: 204 });
  return unavailable();
}

export async function GET(request: NextRequest, context: AuthRouteContext) {
  const params = await context.params;
  if (!googleSignInConfigured) return disabledClientResponse("GET", params.nextauth);
  return configuredResponse(request, params);
}

export async function POST(request: NextRequest, context: AuthRouteContext) {
  const params = await context.params;
  if (!googleSignInConfigured) return disabledClientResponse("POST", params.nextauth);
  return configuredResponse(request, params);
}
