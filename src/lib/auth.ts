import { PrismaAdapter } from "@next-auth/prisma-adapter";
import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { db } from "@/lib/db";

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
const sessionSecret = process.env.NEXTAUTH_SECRET ?? process.env.JWT_SECRET;

/**
 * OAuth client credentials alone are not sufficient for database-backed Auth.js
 * sessions. Do not expose a production sign-in flow until durable session storage
 * has been independently verified and explicitly enabled.
 */
const googleOAuthSecretsConfigured = Boolean(googleClientId && googleClientSecret && sessionSecret);

/**
 * Durable storage remains opt-in until an operator has verified the production
 * database and migration path. This flag must never be enabled merely to make
 * the interface look connected.
 */
export const cloudSyncConfigured = googleOAuthSecretsConfigured && process.env.CLOUD_SYNC_ENABLED === "true";

/**
 * Google sign-in uses database-backed sessions, so it is protected by the same
 * durability gate as cloud workspace writes. This prevents ephemeral or unknown
 * storage from accepting identities that cannot be safely retained.
 */
export const googleSignInConfigured = cloudSyncConfigured;

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(db),
  secret: sessionSecret,
  session: {
    strategy: "database",
    maxAge: 30 * 24 * 60 * 60,
    updateAge: 24 * 60 * 60,
  },
  providers: googleSignInConfigured
    ? [
        GoogleProvider({
          clientId: googleClientId!,
          clientSecret: googleClientSecret!,
          authorization: {
            params: {
              scope: "openid email profile",
              prompt: "select_account",
            },
          },
        }),
      ]
    : [],
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider !== "google") return false;
      const googleProfile = profile as { email?: string | null; email_verified?: boolean } | undefined;
      // A verified email is the minimum identity claim accepted by this public research product.
      return Boolean(googleProfile?.email && googleProfile.email_verified === true);
    },
  },
  pages: {
    signIn: "/terminal?account=signin",
  },
};
