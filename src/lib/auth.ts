import { PrismaAdapter } from "@next-auth/prisma-adapter";
import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { requireProductionAuthRuntime, resolveAuthRuntime } from "@/lib/auth-runtime";
import { db } from "@/lib/db";

const runtime = resolveAuthRuntime();

export const googleOAuthSecretsConfigured = runtime.googleOAuthConfigured;
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
            access_type: "offline",
            response_type: "code",
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
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
    updateAge: 24 * 60 * 60,
  },
  providers,
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        token.picture = user.image;
      }
      if (trigger === "update" && session) {
        if (session.name !== undefined) token.name = session.name;
        if (session.image !== undefined) token.picture = session.image;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = (token.id as string) ?? (token.sub as string);
        if (token.email) session.user.email = token.email;
        if (token.name) session.user.name = token.name;
        if (token.picture) session.user.image = token.picture as string;
      }
      return session;
    },
    async signIn({ account, profile, user }) {
      if (account?.provider !== "google") return false;
      const email = (profile as { email?: string | null } | undefined)?.email || user?.email;
      return Boolean(email);
    },
  },
  pages: {
    signIn: "/terminal?account=signin",
  },
};

/** Call this at production request/startup boundaries before invoking Auth.js. */
export function requireAuthConfiguration() {
  return requireProductionAuthRuntime(runtime);
}
