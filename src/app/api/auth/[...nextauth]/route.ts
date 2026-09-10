import { NextRequest } from "next/server";
import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

const handler = NextAuth(authOptions);
type AuthRouteContext = { params: Promise<{ nextauth?: string[] }> };

export async function GET(request: NextRequest, context: AuthRouteContext) {
  return handler(request, context);
}

export async function POST(request: NextRequest, context: AuthRouteContext) {
  return handler(request, context);
}
