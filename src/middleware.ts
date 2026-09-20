import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { REQUEST_ID_HEADER } from "@/config/constants";
import { authConfig, AUTH_ROUTES, isPublicPath } from "@/server/auth/auth-config";
import { resolveRequestId } from "@/lib/logging/request-id";

/**
 * Edge middleware.
 *
 * Two jobs:
 *  1. Stamp a correlation id on every request so client errors can be traced.
 *  2. Redirect unauthenticated navigation to the login screen.
 *
 * The redirect is a UX convenience only. Authorisation is enforced server-side in
 * the `(app)` layout and in every API route, because middleware alone is not a
 * security boundary.
 *
 * Uses the edge-safe `authConfig`: the full configuration pulls in MongoDB and
 * bcrypt, neither of which can run here.
 */
const { auth } = NextAuth(authConfig);

export default auth((request) => {
  const requestId = resolveRequestId(request.headers);
  const { pathname, search } = request.nextUrl;

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(REQUEST_ID_HEADER, requestId);

  const signedIn = Boolean(request.auth?.user?.id);

  if (!signedIn && !isPublicPath(pathname)) {
    // API clients get a JSON 401 from the route wrapper; only navigation is
    // redirected, and the target is preserved so sign-in can return there.
    if (!pathname.startsWith("/api/")) {
      const loginUrl = new URL(AUTH_ROUTES.login, request.nextUrl.origin);
      loginUrl.searchParams.set("next", `${pathname}${search}`);
      const redirect = NextResponse.redirect(loginUrl);
      redirect.headers.set(REQUEST_ID_HEADER, requestId);
      return redirect;
    }
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set(REQUEST_ID_HEADER, requestId);
  return response;
});

export const config = {
  // Static assets and Next internals are skipped.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons/).*)"],
};
