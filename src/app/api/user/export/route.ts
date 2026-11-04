import { NextResponse } from "next/server";
import { verifiedServerSession } from "@/server/auth-session";
import { db } from "@/lib/db";

/**
 * Data Subject Rights Export Endpoint (GDPR Article 20 - Data Portability / CCPA §1798.100 - Right to Know).
 * Returns all user profile data, connected account metadata, workspaces, and user content in structured JSON format.
 */
export async function GET() {
  try {
    const session = await verifiedServerSession();
    const userId = (session?.user as { id?: string } | undefined)?.id;
    if (!userId) {
      return NextResponse.json(
        { code: "AUTH_REQUIRED", message: "Sign in with a verified account to export personal data." },
        { status: 401 }
      );
    }

    const user = await db.user.findUnique({
      where: { id: userId },
      include: {
        accounts: {
          select: { id: true, provider: true, type: true },
        },
        workspaces: {
          include: {
            datasets: true,
            strategies: true,
            riskPlans: true,
            alerts: true,
            journals: true,
            backtests: true,
            audits: true,
          },
        },
        nativeSessions: {
          select: { id: true, name: true, scope: true, createdAt: true, expiresAt: true, revokedAt: true },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ code: "USER_NOT_FOUND", message: "User record does not exist." }, { status: 404 });
    }

    const exportPayload = {
      format: "ZTerminal-Data-Portability-Export",
      version: "1.0",
      complianceStandards: ["GDPR Article 20", "CCPA/CPRA §1798.100"],
      exportedAt: new Date().toISOString(),
      dataSubject: {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      connectedOAuthProviders: user.accounts,
      deviceSessions: user.nativeSessions,
      workspaces: user.workspaces,
    };

    return new NextResponse(JSON.stringify(exportPayload, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="zterminal-data-export-${userId}.json"`,
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch {
    return NextResponse.json(
      { code: "EXPORT_UNAVAILABLE", message: "Export service is temporarily unavailable. Try again shortly." },
      { status: 503 }
    );
  }
}
