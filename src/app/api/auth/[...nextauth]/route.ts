import { NextRequest, NextResponse } from "next/server";
import NextAuth from "next-auth";
import { authOptions, googleSignInConfigured } from "@/lib/auth";

const handler = NextAuth(authOptions);
type AuthRouteContext = { params: Promise<{ nextauth?: string[] }> };

async function disabledConfiguration(context: AuthRouteContext) {
  const { nextauth = [] } = await context.params;
  if (nextauth[0] === "providers") return NextResponse.json({});
  if (nextauth[0] === "session") return NextResponse.json(null);
  return NextResponse.json(
    { error: "GOOGLE_SIGN_IN_UNAVAILABLE", message: "Google sign-in is not configured on this server." },
    { status: 503 },
  );
}

export async function GET(request: NextRequest, context: AuthRouteContext) {
  if (!googleSignInConfigured) return disabledConfiguration(context);
  return handler(request, context);
}

export async function POST(request: NextRequest, context: AuthRouteContext) {
  if (!googleSignInConfigured) return disabledConfiguration(context);
  return handler(request, context);
}
