import NextAuth, { type DefaultSession } from "next-auth";
import Google from "next-auth/providers/google";
import { getDb } from "./db";

// ─── Type extensions ──────────────────────────────────────────────────────────

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      role: "admin" | "user";
    };
  }
}

// ─── Auth config ──────────────────────────────────────────────────────────────

export const { auth, handlers, signIn, signOut } = NextAuth({
  trustHost: true,
  secret: process.env.AUTH_SECRET,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/unauthorized",
  },
  callbacks: {
    // Block sign-in if the user isn't in the users table or is inactive
    async signIn({ user }) {
      if (!user.email) return false;
      try {
        const sql = getDb();
        const rows = await sql`
          SELECT id, active FROM users WHERE email = ${user.email}
        `;
        if (rows.length === 0 || !rows[0].active) return false;
        // Keep name + image in sync with Google profile
        await sql`
          UPDATE users
          SET name = ${user.name ?? null}, image = ${user.image ?? null}, updated_at = NOW()
          WHERE email = ${user.email}
        `;
        return true;
      } catch {
        return false;
      }
    },

    // Embed DB id + role into the JWT (cached for token lifetime)
    async jwt({ token }) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (token.email && !(token as any).dbUserId) {
        try {
          const sql = getDb();
          const rows = await sql`SELECT id, role FROM users WHERE email = ${token.email}`;
          if (rows.length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (token as any).dbUserId = rows[0].id;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (token as any).role = rows[0].role;
          }
        } catch { /* non-fatal */ }
      }
      return token;
    },

    // Surface id + role on the session object
    async session({ session, token }) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      session.user.id   = (token as any).dbUserId ?? "";
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      session.user.role = (token as any).role ?? "user";
      return session;
    },
  },
});
