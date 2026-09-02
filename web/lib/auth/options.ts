import "server-only";

import { randomUUID } from "node:crypto";

import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

import { persistAuditEvent } from "@/lib/audit/events";
import { getServerConfig } from "@/lib/config";

import { authenticateUser } from "./users";

export const authOptions: NextAuthOptions = {
  secret: process.env.AUTH_SECRET,
  session: { strategy: "jwt" },
  providers: [
    CredentialsProvider({
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) {
          return null;
        }
        const user = await authenticateUser(
          credentials.email,
          credentials.password,
          getServerConfig(),
        );
        return user;
      },
    }),
  ],
  pages: { signIn: "/sign-in" },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.tenantId = user.tenantId;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token.userId && token.tenantId) {
        session.user.id = token.userId;
        session.user.tenantId = token.tenantId;
      }
      return session;
    },
  },
  events: {
    async signIn({ user }) {
      if (!user.id || !user.tenantId) {
        return;
      }
      const config = getServerConfig();
      await persistAuditEvent(
        {
          action: "USER_SIGNED_IN",
          actor: { userId: user.id, tenantId: user.tenantId },
          requestId: randomUUID(),
          context: { authenticationMethod: "EMAIL_PASSWORD" },
        },
        config,
      );
    },
  },
};
