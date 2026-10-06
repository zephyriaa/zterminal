import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifiedServerSession } from "@/server/auth-session";
import { db } from "@/lib/db";
import { isSameOriginMutation } from "@/lib/auth-policy";

const updateProfileSchema = z.object({
  name: z.string().trim().min(1, "Name cannot be empty").max(80, "Name cannot exceed 80 characters").optional(),
  image: z
    .string()
    .trim()
    .max(500000, "Image payload too large (maximum 500KB)")
    .refine(
      (val) => val === "" || val.startsWith("http://") || val.startsWith("https://") || val.startsWith("data:image/"),
      { message: "Image must be a valid HTTP(S) URL or base64 image data URI" }
    )
    .optional()
    .nullable(),
});

export async function GET() {
  try {
    const session = await verifiedServerSession();
    const userId = (session?.user as { id?: string } | undefined)?.id;
    if (!userId) {
      return NextResponse.json({ code: "AUTH_REQUIRED", message: "Sign in with a verified Google account to view profile." }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, image: true, createdAt: true, updatedAt: true },
    });

    if (!user) {
      return NextResponse.json({ code: "USER_NOT_FOUND", message: "User record does not exist." }, { status: 404 });
    }

    return NextResponse.json({ profile: user });
  } catch { return unavailable(); }
}

export async function PATCH(request: NextRequest) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ code: "INVALID_ORIGIN", message: "Open ZTerminal to update your profile." }, { status: 403 });
  try {
    const session = await verifiedServerSession();
    const userId = (session?.user as { id?: string } | undefined)?.id;
    if (!userId) {
      return NextResponse.json({ code: "AUTH_REQUIRED", message: "Sign in with a verified Google account to update profile." }, { status: 401 });
    }

    const rawBody = await request.json().catch(() => null);
    const parsed = updateProfileSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json({ code: "INVALID_PAYLOAD", errors: parsed.error.issues }, { status: 400 });
    }

    const dataToUpdate: { name?: string; image?: string | null } = {};
    if (parsed.data.name !== undefined) {
      dataToUpdate.name = parsed.data.name;
    }
    if (parsed.data.image !== undefined) {
      dataToUpdate.image = parsed.data.image || null;
    }

    const updatedUser = await db.user.update({
      where: { id: userId },
      data: dataToUpdate,
      select: { id: true, email: true, name: true, image: true, updatedAt: true },
    });

    return NextResponse.json({ ok: true, profile: updatedUser });
  } catch { return unavailable(); }
}

function unavailable() {
  return NextResponse.json({ code: "ACCOUNT_UNAVAILABLE", message: "Your account is temporarily unavailable. Try again shortly." }, { status: 503 });
}
