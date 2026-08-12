import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ConnectRequest = z.object({
  userId: z.string().trim().email().max(254),
  password: z.string().min(1).max(512),
  system: z.enum(["Rithmic Paper Trading", "Rithmic Test"]),
});

const attempts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 5;

function isRateLimited(request: NextRequest) {
  const key = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const now = Date.now();
  const current = attempts.get(key);
  if (!current || current.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  current.count += 1;
  return current.count > MAX_ATTEMPTS;
}

/**
 * Runtime-only connector boundary. Credentials are validated in memory for
 * this request and deliberately never persisted, logged, returned, or sent to
 * the browser. A real connection is enabled only when the official Rithmic
 * R | Protocol dev kit and conformance-approved adapter are installed.
 */
export async function POST(request: NextRequest) {
  if (isRateLimited(request)) {
    return NextResponse.json({ error: "Too many connection attempts. Please wait one minute." }, { status: 429 });
  }

  let password = "";
  try {
    const body = await request.json();
    const parsed = ConnectRequest.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Enter a valid Rithmic user ID, password, and system." }, { status: 400 });
    }
    password = parsed.data.password;

    // Deliberately do not log, cache, write, or return `password`. When the
    // approved adapter exists, this is the only handoff point to its in-memory
    // login call. No Rithmic protocol data, endpoint, or credential is guessed.
    return NextResponse.json(
      {
        ok: false,
        state: "unavailable",
        message:
          "Rithmic credentials were accepted for this request but were not stored. This deployment does not yet contain the official R | Protocol development kit and conformance-approved adapter required to connect.",
        requires: ["Official Rithmic R | Protocol development kit", "Rithmic Test integration", "Conformance approval"],
      },
      { status: 503 }
    );
  } catch {
    return NextResponse.json({ error: "Invalid connection request." }, { status: 400 });
  } finally {
    // Make the secret ineligible for any later use in this request scope.
    password = "";
  }
}
