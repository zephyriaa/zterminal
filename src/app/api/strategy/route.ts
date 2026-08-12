import { NextRequest, NextResponse } from "next/server";
import { compileStrategy } from "@/lib/strategy/zs-compiler";
import { defaultParams } from "@/lib/strategy/zs-runtime";

export const dynamic = "force-dynamic";

/** Compile + validate strategy source. Returns inputs + diagnostics. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const src: string = body?.src ?? "";
  if (!src.trim()) {
    return NextResponse.json({ ok: false, inputs: [], diagnostics: [{ line: 0, col: 0, severity: "error", message: "Empty strategy source" }], name: "Untitled", compiledAt: Date.now() });
  }
  const result = compileStrategy(src);
  const params = defaultParams(src);
  return NextResponse.json({
    ...result,
    params,
  });
}
