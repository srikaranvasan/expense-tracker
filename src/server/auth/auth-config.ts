import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe portion of the Auth.js configuration.
 *
 * Middleware runs on the Edge runtime, which cannot load the MongoDB driver or
 * bcrypt. Keeping providers out of this file lets middleware verify the session
 * cookie while the full configuration (with the Credentials provider) stays in
 * the Node runtime.
 */

export const AUTH_ROUTES = {
  login: "/login",
  register: "/register",
  afterLogin: "/dashboard",
} as const;

/** Paths that never require a session. */
const PUBLIC_PATH_PREFIXES = [
  "/login",
  "/register",
  "/api/auth",
  "/api/health",
  "/manifest.webmanifest",
  "/sw.js",
  "/offline",
  "/icons",
];

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export const authConfig = {
  // JWT sessions: the Credentials provider cannot use a database session
  // strategy, and a signed cookie means no session lookup per request.
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
    updateAge: 24 * 60 * 60,
  },

  pages: {
    signIn: AUTH_ROUTES.login,
    error: AUTH_ROUTES.login,
  },

  // Providers are added in auth.ts; middleware needs none.
  providers: [],

  callbacks: {
    /**
     * Persists the application user id on the token.
     *
     * `sub` is the only identity claim the application trusts; everything else is
     * re-read from the database (docs/12-SECURITY-AND-ERROR-HANDLING.md section 4).
     */
    jwt({ token, user }) {
      if (user?.id) {
        token.sub = user.id;
      }
      return token;
    },

    session({ session, token }) {
      if (token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },

    /** Used by middleware to decide whether a request may proceed. */
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      if (isPublicPath(pathname)) return true;
      return Boolean(auth?.user?.id);
    },
  },

  trustHost: true,
} satisfies NextAuthConfig;
