import { PrismaAdapter } from "@next-auth/prisma-adapter";
import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { resolveAuthRuntime } from "@/lib/auth-runtime";
import { db } from "@/lib/db";
import { googleIdentityVerified, safeAuthRedirect } from "@/lib/auth-policy";

const runtime = resolveAuthRuntime();

export const googleSignInConfigured = runtime.authConfigured;
export const cloudSyncConfigured = runtime.cloudSyncConfigured;
export const authConfigurationMissing = runtime.missing;

const providers: NonNullable<NextAuthOptions["providers"]> = runtime.authConfigured
  ? [
      GoogleProvider({
        clientId: runtime.googleClientId!,
        clientSecret: runtime.googleClientSecret!,
        checks: ["pkce", "state"],
        authorization: {
          params: {
            scope: "openid email profile",
            prompt: "select_account",
          },
        },
      }),
    ]
  : [];

const adapter = PrismaAdapter(db);

/**
 * Auth.js owns only verified Google identities. There is intentionally no
 * credentials-provider fallback, shared analyst account, or embedded secret.
 */
export const authOptions: NextAuthOptions = {
  adapter: {
    ...adapter,
    // ZTerminal uses Google for identity only; retain no unnecessary provider credentials.
    async linkAccount(account) {
      const { userId, type, provider, providerAccountId } = account;
      return adapter.linkAccount!({ userId, type, provider, providerAccountId });
    },
    async deleteSession(sessionToken) {
      // Expiry/logout can be observed by several tabs and SSR/API requests at once.
      await db.session.deleteMany({ where: { sessionToken } });
    },
  },
  secret: runtime.sessionSecret,
  session: {
    // Database sessions can be revoked on sign-out; JWT cookies cannot.
    strategy: "database",
    maxAge: 30 * 24 * 60 * 60,
    updateAge: 24 * 60 * 60,
  },
  providers,
  useSecureCookies: runtime.siteUrl?.startsWith("https://") ?? runtime.isProduction,
  logger: {
    // Auth.js metadata can contain OAuth responses. Record diagnostic codes only.
    error(code) { console.error("ZTerminal authentication error", code); },
    warn(code) { console.warn("ZTerminal authentication warning", code); },
    debug() {},
  },
  callbacks: {
    async redirect({ url, baseUrl }) { return safeAuthRedirect(url, baseUrl); },
    async session({ session, user }) {
      if (session.user) {
        (session.user as { id?: string }).id = user.id;
        session.user.email = user.email;
        session.user.name = user.name;
        session.user.image = user.image;
      }
      return session;
    },
    async signIn({ account, profile }) {
      return googleIdentityVerified(account, profile);
    },
  },
  events: {
    async signIn({ user, account, profile }) {
      // Account(provider, subject) remains the owner even when Google changes the email.
      if (account?.provider !== "google" || !profile?.email || profile.email === user.email) return;
      try {
        const collision = await db.user.findUnique({ where: { email: profile.email }, select: { id: true } });
        if (collision && collision.id !== user.id) return; // Never merge another identity by email.
        await db.user.update({ where: { id: user.id }, data: { email: profile.email } });
      }
      catch { console.warn("ZTerminal authentication warning", "IDENTITY_EMAIL_UPDATE_UNAVAILABLE"); }
    },
  },
  pages: {
    signIn: "/terminal?account=signin",
    error: "/terminal",
  },
};
