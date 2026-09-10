import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

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
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ code: "AUTH_REQUIRED", message: "Sign in with a verified Google account to view profile." }, { status: 401 });
  }

  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true, image: true, createdAt: true, updatedAt: true },
  });

  if (!user) {
    return NextResponse.json({ code: "USER_NOT_FOUND", message: "User record does not exist." }, { status: 404 });
  }

  return NextResponse.json({ profile: user });
}

export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) {
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

  const updatedUser = await db.user.upsert({
    where: { email },
    update: dataToUpdate,
    create: {
      email,
      name: parsed.data.name ?? "ZTerminal Quantitative Analyst",
      image: parsed.data.image ?? "https://lh3.googleusercontent.com/a/default-user=s96-c",
      emailVerified: new Date(),
    },
    select: { id: true, email: true, name: true, image: true, updatedAt: true },
  });

  return NextResponse.json({ ok: true, profile: updatedUser });
}
