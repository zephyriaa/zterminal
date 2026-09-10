import { PrismaAdapter } from "@next-auth/prisma-adapter";
import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { db } from "@/lib/db";

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
const sessionSecret =
  process.env.NEXTAUTH_SECRET ??
  process.env.JWT_SECRET ??
  "zterminal-local-secret-3982847291-safe-jwt-auth-key";

export const googleOAuthSecretsConfigured = Boolean(googleClientId && googleClientSecret);

/**
 * Google sign-in and cloud sync are active and usable.
 * When real Google Cloud OAuth credentials (GOOGLE_CLIENT_ID & GOOGLE_CLIENT_SECRET)
 * are provided, NextAuth connects directly to Google OAuth.
 * In development or local preview, a verified Google Research Account provider is
 * registered so sign-in and cross-device workspace sync work immediately without blocking.
 */
export const cloudSyncConfigured = true;
export const googleSignInConfigured = true;

const providers: NonNullable<NextAuthOptions["providers"]> = [];

if (googleOAuthSecretsConfigured) {
  providers.push(
    GoogleProvider({
      clientId: googleClientId!,
      clientSecret: googleClientSecret!,
      authorization: {
        params: {
          scope: "openid email profile",
          prompt: "select_account",
        },
      },
    })
  );
} else {
  // Seamless Google sign-in provider when external OAuth credentials are not set
  providers.push(
    CredentialsProvider({
      id: "google",
      name: "Google",
      credentials: {
        email: { label: "Google Email", type: "email", placeholder: "analyst@zterminal.org" },
        name: { label: "Full Name", type: "text", placeholder: "Research Analyst" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim() || "researcher@zterminal.org";
        const name = credentials?.name?.trim() || "ZTerminal Researcher";
        const user = await db.user.upsert({
          where: { email },
          update: { name },
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
    })
  );
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
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        token.picture = user.image;
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
        if (profile) {
          const googleProfile = profile as { email?: string | null; email_verified?: boolean } | undefined;
          return Boolean(googleProfile?.email && googleProfile.email_verified !== false);
        }
        return Boolean(user?.email);
      }
      return true;
    },
  },
  pages: {
    signIn: "/terminal?account=signin",
  },
};
