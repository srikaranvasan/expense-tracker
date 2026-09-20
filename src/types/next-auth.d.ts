import type { DefaultSession } from "next-auth";

/**
 * Adds the application user id to the session type.
 *
 * Only the id is exposed. Profile data such as currency and timezone is read from
 * the database so a stale cookie cannot drive financial behaviour.
 */
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    sub?: string;
  }
}
