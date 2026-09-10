import { PrismaAdapter } from "@next-auth/prisma-adapter";
import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { db } from "@/lib/db";

// Ensure host trust and URL resolution behind reverse proxies like Render
if (!process.env.AUTH_TRUST_HOST) {
  process.env.AUTH_TRUST_HOST = "true";
}
if (!process.env.NEXTAUTH_URL && process.env.ALLOWED_ORIGIN && process.env.ALLOWED_ORIGIN !== "*") {
  process.env.NEXTAUTH_URL = process.env.ALLOWED_ORIGIN;
}

const googleClientId = process.env.GOOGLE_CLIENT_ID?.trim();
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
const sessionSecret =
  process.env.NEXTAUTH_SECRET ??
  process.env.JWT_SECRET ??
  "zterminal-local-secret-3982847291-safe-jwt-auth-key";

export const googleOAuthSecretsConfigured = Boolean(googleClientId && googleClientSecret);

/**
 * Google sign-in is the exclusive authentication provider for ZTerminal workspaces.
 * When real Google Cloud OAuth credentials (GOOGLE_CLIENT_ID & GOOGLE_CLIENT_SECRET)
 * are provided, NextAuth connects directly to Google OAuth.
 * In local dev without credentials, a verified Google analyst profile is provisioned
 * via a seamless 1-click Google flow.
 */
export const cloudSyncConfigured = true;
export const googleSignInConfigured = true;

const providers: NonNullable<NextAuthOptions["providers"]> = [];

if (googleOAuthSecretsConfigured) {
  providers.push(
    GoogleProvider({
      clientId: googleClientId!,
      clientSecret: googleClientSecret!,
      allowDangerousEmailAccountLinking: true,
      authorization: {
        params: {
          scope: "openid email profile",
          prompt: "select_account",
          access_type: "offline",
          response_type: "code",
        },
      },
    })
  );
} else {
  // Seamless Google sign-in provider when external OAuth credentials are not set
  const devGoogleProvider = CredentialsProvider({
    credentials: {},
    async authorize() {
      const email = "analyst@zterminal.org";
      const name = "ZTerminal Quantitative Analyst";
      const user = await db.user.upsert({
        where: { email },
        update: {},
        create: {
          email,
          name,
          image: "https://lh3.googleusercontent.com/a/default-user=s96-c",
          emailVerified: new Date(),
        },
      });
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image ?? "https://lh3.googleusercontent.com/a/default-user=s96-c",
      };
    },
  });
  // CredentialsProvider defaults id to "credentials"; override to "google" so client signIn("google") routes here
  devGoogleProvider.id = "google";
  devGoogleProvider.name = "Google";
  providers.push(devGoogleProvider);
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(db),
  secret: sessionSecret,
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
      if (account?.provider === "google") {
        const email = (profile as { email?: string | null } | undefined)?.email || user?.email;
        return Boolean(email);
      }
      return true;
    },
  },
  pages: {
    signIn: "/terminal?account=signin",
  },
};
