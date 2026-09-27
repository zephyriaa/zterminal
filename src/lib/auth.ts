import { PrismaAdapter } from "@next-auth/prisma-adapter";
import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { resolveAuthRuntime } from "@/lib/auth-runtime";
import { db } from "@/lib/db";

const runtime = resolveAuthRuntime();

export const googleSignInConfigured = runtime.authConfigured;
export const cloudSyncConfigured = runtime.cloudSyncConfigured;
export const authConfigurationMissing = runtime.missing;

const providers: NonNullable<NextAuthOptions["providers"]> = runtime.authConfigured
  ? [
      GoogleProvider({
        clientId: runtime.googleClientId!,
        clientSecret: runtime.googleClientSecret!,
        authorization: {
          params: {
            scope: "openid email profile",
            prompt: "select_account",
          },
        },
      }),
    ]
  : [];

/**
 * Auth.js owns only verified Google identities. There is intentionally no
 * credentials-provider fallback, shared analyst account, or embedded secret.
 */
export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(db),
  secret: runtime.sessionSecret,
  session: {
    // Database sessions can be revoked on sign-out; JWT cookies cannot.
    strategy: "database",
    maxAge: 30 * 24 * 60 * 60,
    updateAge: 24 * 60 * 60,
  },
  providers,
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        (session.user as { id?: string }).id = user.id;
        session.user.email = user.email;
        session.user.name = user.name;
        session.user.image = user.image;
      }
      return session;
    },
    async signIn({ account, profile, user }) {
      if (account?.provider !== "google") return false;
      const googleProfile = profile as { email?: string | null; email_verified?: boolean } | undefined;
      return Boolean(googleProfile?.email && googleProfile.email_verified === true && user?.id);
    },
  },
  pages: {
    signIn: "/terminal?account=signin",
  },
};
