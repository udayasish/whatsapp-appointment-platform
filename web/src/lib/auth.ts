import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import pg from "pg";
import type { AdminRole } from "@/types/api";

const { Pool } = pg;

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL || "postgresql://wap:wap@127.0.0.1:5432/wap",
});


export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 hours
  },
  secret: process.env.NEXTAUTH_SECRET || "clinicconnect-super-secret-jwt-key-2026",
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        try {
          const result = await pool.query(
            `SELECT id, email, password_hash, name, role, tenant_id, status FROM admin_users WHERE email = $1 LIMIT 1`,
            [credentials.email.trim().toLowerCase()]
          );

          const user = result.rows[0];
          if (!user || user.status === "suspended") {
            return null;
          }

          const isValid = await bcrypt.compare(
            credentials.password,
            user.password_hash
          );

          if (!isValid) {
            return null;
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role as AdminRole,
            tenantId: user.tenant_id,
          };
        } catch (error) {
          console.error("Auth authorize error:", error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: AdminRole }).role;
        token.tenantId = (user as { tenantId?: string | null }).tenantId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = token.id as string;
        (session.user as { role?: AdminRole }).role = token.role as AdminRole;
        (session.user as { tenantId?: string | null }).tenantId = token.tenantId as string | null;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
};
