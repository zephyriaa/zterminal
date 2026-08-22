import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * ZS compilation is archival only. New code is validated through the Python
 * Research API, which records runtime locks and applies the worker policy.
 */
export async function POST() {
  return NextResponse.json({
    error: "ZScript compilation is retired. Use /api/research/artifacts/validate for Python research artifacts.",
    code: "ZS_COMPILATION_RETIRED",
  }, { status: 410, headers: { "Cache-Control": "no-store" } });
}
